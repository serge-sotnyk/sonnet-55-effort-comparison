// Audio analysis helpers (browser + node compatible): metrics, FFT, spectrogram drawing.
// Used by tools/audio-harness.mjs (in the page) and the preview pages.

export const dB = (x) => 20 * Math.log10(Math.max(x, 1e-12));
export const dBp = (p) => 10 * Math.log10(Math.max(p, 1e-18));

/* ---------------------------------------------------------------- FFT */
const twCache = new Map();
function twiddles(N) {
  let t = twCache.get(N);
  if (t) return t;
  const cos = new Float64Array(N / 2), sin = new Float64Array(N / 2);
  for (let i = 0; i < N / 2; i++) { cos[i] = Math.cos(2 * Math.PI * i / N); sin[i] = -Math.sin(2 * Math.PI * i / N); }
  const rev = new Uint32Array(N);
  const bits = Math.log2(N);
  for (let i = 0; i < N; i++) { let r = 0, x = i; for (let b = 0; b < bits; b++) { r = (r << 1) | (x & 1); x >>= 1; } rev[i] = r; }
  t = { cos, sin, rev };
  twCache.set(N, t);
  return t;
}
/** in-place radix-2 complex FFT */
export function fft(re, im) {
  const N = re.length, { cos, sin, rev } = twiddles(N);
  for (let i = 0; i < N; i++) { const j = rev[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let size = 2; size <= N; size <<= 1) {
    const half = size >> 1, step = N / size;
    for (let i = 0; i < N; i += size) {
      for (let j = 0, k = 0; j < half; j++, k += step) {
        const a = i + j, b = a + half;
        const tr = re[b] * cos[k] - im[b] * sin[k], ti = re[b] * sin[k] + im[b] * cos[k];
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
      }
    }
  }
}
const hannCache = new Map();
export function hann(N) {
  let w = hannCache.get(N);
  if (!w) { w = new Float64Array(N); for (let i = 0; i < N; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N); hannCache.set(N, w); }
  return w;
}
/** A-weighting gain (linear amplitude), 1.0 at 1 kHz */
export function aWeight(f) {
  const f2 = f * f;
  const ra = (12194 ** 2 * f2 * f2) / ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2));
  return ra / 0.7943; // normalise: A(1k) = +0.0 dB  (raw value at 1 kHz is ~0.7943)
}

/** Short-time spectra of a mono signal: returns { N, hop, frames: Float32Array[] (magnitude, N/2+1 bins), sr } */
export function stft(x, sr, N = 2048, hop = 1024, maxFrames = 100000) {
  const w = hann(N), re = new Float64Array(N), im = new Float64Array(N);
  const frames = [];
  const n = x.length;
  for (let s = 0; s + 1 <= n && frames.length < maxFrames; s += hop) {
    for (let i = 0; i < N; i++) { const v = s + i < n ? x[s + i] : 0; re[i] = v * w[i]; im[i] = 0; }
    fft(re, im);
    const mag = new Float32Array(N / 2 + 1);
    for (let k = 0; k <= N / 2; k++) mag[k] = Math.hypot(re[k], im[k]);
    frames.push(mag);
  }
  return { N, hop, frames, sr };
}

function mono(chs) {
  if (chs.length === 1) return chs[0];
  const n = chs[0].length, m = new Float32Array(n);
  for (let c = 0; c < chs.length; c++) { const d = chs[c]; for (let i = 0; i < n; i++) m[i] += d[i] / chs.length; }
  return m;
}

/* ---------------------------------------------------------------- metrics */
/**
 * Objective metrics of a rendered buffer. chs: array of Float32Array channels.
 * Returns dur, peak(dB), rms(dB, whole file), rmsAct(dB over the active region), loudA (A-weighted max 100ms level, dB),
 * lead/trail silence (s), endDb (peak level of final 20 ms, dBFS), clip count, nan count, dc, centroid (Hz), hf (>5k energy fraction).
 */
export function analyze(chs, sr, o = {}) {
  const n = chs[0].length;
  let peak = 0, ss = 0, sum = 0, nan = 0, clip = 0, cnt = 0;
  for (const d of chs) {
    for (let i = 0; i < n; i++) {
      const v = d[i];
      if (!Number.isFinite(v)) { nan++; continue; }
      const a = v < 0 ? -v : v;
      if (a > peak) peak = a;
      if (a >= 0.999) clip++;
      ss += v * v; sum += v; cnt++;
    }
  }
  const m = mono(chs);
  const thr = Math.max(peak * 0.003, 1e-4); // -50 dB re peak
  let first = -1, last = -1;
  for (let i = 0; i < n; i++) if (Math.abs(m[i]) > thr) { first = i; break; }
  for (let i = n - 1; i >= 0; i--) if (Math.abs(m[i]) > thr) { last = i; break; }
  const lead = first < 0 ? n / sr : first / sr;
  const trail = last < 0 ? n / sr : (n - 1 - last) / sr;
  let a0 = Math.max(first, 0), a1 = last < 0 ? n - 1 : last;
  let sa = 0; for (let i = a0; i <= a1; i++) sa += m[i] * m[i];
  const rmsAct = Math.sqrt(sa / Math.max(1, a1 - a0 + 1));
  let endPk = 0; for (let i = Math.max(0, n - Math.floor(sr * 0.02)); i < n; i++) endPk = Math.max(endPk, Math.abs(m[i]));

  // spectral analysis
  const N = 2048, hop = 1024;
  const S = stft(m, sr, N, hop);
  const w = hann(N); let W2 = 0; for (let i = 0; i < N; i++) W2 += w[i] * w[i];
  const awTab = new Float64Array(N / 2 + 1);
  for (let k = 0; k <= N / 2; k++) awTab[k] = aWeight(Math.max(k * sr / N, 1));
  const pA = [], pU = [], cents = [], hfs = [];
  for (const mag of S.frames) {
    let e = 0, ea = 0, num = 0, den = 0, hfE = 0;
    for (let k = 0; k <= N / 2; k++) {
      const c = (k === 0 || k === N / 2) ? 1 : 2, p = c * mag[k] * mag[k];
      e += p; ea += p * awTab[k] * awTab[k];
      const f = k * sr / N; num += f * mag[k]; den += mag[k];
      if (f > 5000) hfE += p;
    }
    pA.push(ea / (N * W2)); pU.push(e / (N * W2));
    cents.push(den > 0 ? num / den : 0); hfs.push(e > 0 ? hfE / e : 0);
  }
  // short-term (3 frames ~ 100 ms) A-weighted level
  let loudA = -200;
  for (let i = 0; i < pA.length; i++) {
    let s3 = 0, c3 = 0;
    for (let j = i - 1; j <= i + 1; j++) if (j >= 0 && j < pA.length) { s3 += pA[j]; c3++; }
    loudA = Math.max(loudA, dBp(s3 / 3));
  }
  let meanAp = 0; for (const p of pA) meanAp += p; meanAp /= Math.max(1, pA.length);
  // energy-weighted centroid / hf over the loud frames
  let maxP = 0; for (const p of pU) maxP = Math.max(maxP, p);
  let cw = 0, cs = 0, hw = 0;
  for (let i = 0; i < pU.length; i++) { if (pU[i] < maxP * 1e-3) continue; cs += cents[i] * pU[i]; hw += hfs[i] * pU[i]; cw += pU[i]; }
  return {
    dur: n / sr, peak: dB(peak), rms: dB(Math.sqrt(ss / Math.max(cnt, 1))), rmsAct: dB(rmsAct), loudA,
    lead, trail, endDb: dB(endPk), clip, nan, dc: sum / Math.max(cnt, 1),
    centroid: cw ? cs / cw : 0, hf: cw ? hw / cw : 0,
    peakLin: peak, meanA: dBp(meanAp),
  };
}

/** Long-term statistics for music: level distribution over 1 s windows. */
export function levelStats(chs, sr) {
  const m = mono(chs), win = sr, out = [];
  for (let s = 0; s + win <= m.length; s += win) {
    let ss = 0; for (let i = s; i < s + win; i++) ss += m[i] * m[i];
    out.push(dB(Math.sqrt(ss / win)));
  }
  out.sort((a, b) => a - b);
  const q = (p) => out[Math.min(out.length - 1, Math.floor(p * out.length))];
  return { p10: q(0.1), p50: q(0.5), p90: q(0.9), min: out[0], max: out[out.length - 1], count: out.length };
}

/* ---------------------------------------------------------------- spectrogram drawing */
const MAGMA = [[0, 0, 4], [40, 11, 84], [101, 21, 110], [159, 42, 99], [212, 72, 66], [245, 125, 21], [250, 193, 39], [252, 255, 164]];
function colormap(t) {
  t = Math.min(1, Math.max(0, t)) * (MAGMA.length - 1);
  const i = Math.min(MAGMA.length - 2, Math.floor(t)), f = t - i, a = MAGMA[i], b = MAGMA[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/**
 * Draw a log-frequency spectrogram + amplitude envelope.
 * c2d: CanvasRenderingContext2D, chs: channels, rect {x,y,w,h}, opts {fmin, fmax, range (dB), N, title}
 */
export function drawSpectrogram(c2d, chs, sr, rect, o = {}) {
  const { x, y, w, h } = rect;
  const fmin = o.fmin || 40, fmax = Math.min(o.fmax || 16000, sr / 2), range = o.range || 80;
  const N = o.N || 2048;
  const m = mono(chs);
  const dur = m.length / sr;
  const specH = Math.floor(h * 0.78), envH = h - specH - 14;
  const hop = Math.max(64, Math.floor(m.length / w));
  const S = stft(m, sr, N, hop);
  // normalise to the loudest bin
  let mx = 1e-9; for (const f of S.frames) for (let k = 0; k < f.length; k++) if (f[k] > mx) mx = f[k];
  const img = c2d.createImageData(w, specH);
  for (let px = 0; px < w; px++) {
    const fr = S.frames[Math.min(S.frames.length - 1, Math.floor(px * S.frames.length / w))];
    for (let py = 0; py < specH; py++) {
      const f = fmin * Math.pow(fmax / fmin, 1 - py / (specH - 1));
      const kf = f * N / sr, k0 = Math.floor(kf), fr1 = kf - k0;
      const v = fr[k0] * (1 - fr1) + (fr[Math.min(k0 + 1, fr.length - 1)] || 0) * fr1;
      const t = (dB(v / mx) + range) / range;
      const [r, g, b] = colormap(t);
      const idx = (py * w + px) * 4;
      img.data[idx] = r; img.data[idx + 1] = g; img.data[idx + 2] = b; img.data[idx + 3] = 255;
    }
  }
  c2d.putImageData(img, x, y);
  // frequency grid
  c2d.font = '10px monospace'; c2d.fillStyle = '#fff'; c2d.strokeStyle = 'rgba(255,255,255,0.25)';
  for (const f of [100, 200, 500, 1000, 2000, 5000, 10000]) {
    if (f < fmin || f > fmax) continue;
    const py = y + (1 - Math.log(f / fmin) / Math.log(fmax / fmin)) * (specH - 1);
    c2d.beginPath(); c2d.moveTo(x, py + 0.5); c2d.lineTo(x + w, py + 0.5); c2d.stroke();
    c2d.fillText(f >= 1000 ? (f / 1000) + 'k' : String(f), x + 2, py - 2);
  }
  // time grid
  const step = dur > 30 ? 10 : dur > 8 ? 2 : dur > 3 ? 1 : dur > 1 ? 0.5 : 0.1;
  for (let t = 0; t <= dur; t += step) {
    const px = x + (t / dur) * (w - 1);
    c2d.beginPath(); c2d.moveTo(px + 0.5, y); c2d.lineTo(px + 0.5, y + specH); c2d.stroke();
    c2d.fillText(t.toFixed(step < 1 ? 1 : 0) + 's', px + 2, y + specH + 11);
  }
  // envelope (peak per column) in dB
  const ey = y + specH + 14;
  c2d.fillStyle = '#10141c'; c2d.fillRect(x, ey, w, envH);
  c2d.strokeStyle = '#6cf'; c2d.beginPath();
  const per = m.length / w;
  for (let px = 0; px < w; px++) {
    let pk = 0; const s0 = Math.floor(px * per), s1 = Math.min(m.length, Math.floor((px + 1) * per) + 1);
    for (let i = s0; i < s1; i++) { const a = Math.abs(m[i]); if (a > pk) pk = a; }
    const lvl = Math.max(0, (dB(pk) + 60) / 60);
    const py = ey + envH - lvl * envH;
    if (px === 0) c2d.moveTo(x + px, py); else c2d.lineTo(x + px, py);
  }
  c2d.stroke();
  c2d.fillStyle = '#9ab'; c2d.fillText('peak env (-60..0 dB)', x + 4, ey + 10);
  if (o.title) { c2d.fillStyle = '#fff'; c2d.font = 'bold 12px monospace'; c2d.fillText(o.title, x + 6, y + 14); }
}
