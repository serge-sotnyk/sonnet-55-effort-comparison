// Lightweight particle system for cosmetic effects (dust, smoke, flames, sparks, glows, floating text).
const MAX = 2500;

export class FX {
  constructor() { this.p = []; this.texts = []; this.shake = 0; }
  add(o) { if (this.p.length < MAX) this.p.push(o); }

  // world position (tile coords) + height z in px
  dust(x, y, n = 6, size = 9, z = 2) {
    for (let i = 0; i < n; i++) this.add({ t: 'dust', x: x + (Math.random() - 0.5) * 0.8, y: y + (Math.random() - 0.5) * 0.8, z, vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6, vz: 10 + Math.random() * 14, life: 0, max: 0.7 + Math.random() * 0.6, size: size * (0.7 + Math.random() * 0.6), a: 0.5 });
  }
  debris(x, y, n = 8, z = 6, col = '#7a6a54') {
    for (let i = 0; i < n; i++) this.add({ t: 'debris', x, y, z, vx: (Math.random() - 0.5) * 3.2, vy: (Math.random() - 0.5) * 3.2, vz: 40 + Math.random() * 60, life: 0, max: 0.7 + Math.random() * 0.5, size: 2 + Math.random() * 2.5, col });
  }
  sparks(x, y, n = 5, col = '#ffe9a0', z = 14) {
    for (let i = 0; i < n; i++) this.add({ t: 'spark', x, y, z, vx: (Math.random() - 0.5) * 2.4, vy: (Math.random() - 0.5) * 2.4, vz: 20 + Math.random() * 40, life: 0, max: 0.25 + Math.random() * 0.25, size: 1.6, col });
  }
  chips(x, y, col = '#a8814f', n = 3) {
    for (let i = 0; i < n; i++) this.add({ t: 'debris', x, y, z: 16, vx: (Math.random() - 0.5) * 1.6, vy: (Math.random() - 0.5) * 1.6, vz: 30 + Math.random() * 30, life: 0, max: 0.5, size: 1.6, col });
  }
  flame(x, y, z, size = 1) {
    this.add({ t: 'flame', x, y, z, vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.15, vz: 20 + Math.random() * 18, life: 0, max: 0.5 + Math.random() * 0.4, size: (7 + Math.random() * 6) * size });
  }
  smoke(x, y, z, size = 1, dark = 0.5) {
    this.add({ t: 'smoke', x, y, z, vx: 0.15 + Math.random() * 0.15, vy: -0.1 + Math.random() * 0.1, vz: 14 + Math.random() * 10, life: 0, max: 1.6 + Math.random() * 1.2, size: (8 + Math.random() * 8) * size, a: 0.35 + dark * 0.3 });
  }
  glow(x, y, z, col, size = 18, life = 0.8) {
    this.add({ t: 'glow', x, y, z, vx: 0, vy: 0, vz: 12, life: 0, max: life, size, col });
  }
  ring(x, y, col, size = 24, life = 0.7) {
    this.add({ t: 'ring', x, y, z: 2, vx: 0, vy: 0, vz: 0, life: 0, max: life, size, col });
  }
  text(x, y, str, col, z = 30) {
    if (this.texts.length < 40) this.texts.push({ x, y, z, str, col, life: 0, max: 1.3 });
  }
  update(dt) {
    const p = this.p; let w = 0;
    for (let i = 0; i < p.length; i++) {
      const q = p[i]; q.life += dt;
      if (q.life >= q.max) continue;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      if (q.t === 'debris' || q.t === 'spark') { q.vz -= 160 * dt; if (q.z < 0) { q.z = 0; q.vz *= -0.3; q.vx *= 0.5; q.vy *= 0.5; } }
      p[w++] = q;
    }
    p.length = w;
    const tx = this.texts; let k = 0;
    for (let i = 0; i < tx.length; i++) { const q = tx[i]; q.life += dt; q.z += 22 * dt; if (q.life < q.max) tx[k++] = q; }
    tx.length = k;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 3);
  }
  /** Draw particles; `proj(x,y,z)` -> [sx,sy] in CSS px. */
  draw(ctx, cam, bounds) {
    const z = cam.zoom;
    for (const q of this.p) {
      if (q.x < bounds.x0 || q.x > bounds.x1 || q.y < bounds.y0 || q.y > bounds.y1) continue;
      const t = q.life / q.max;
      const sx = ((q.x - q.y) * 32 - cam.x) * z + cam.vw / 2, sy = ((q.x + q.y) * 16 - q.z - cam.y) * z + cam.vh / 2;
      switch (q.t) {
        case 'dust': {
          ctx.globalAlpha = q.a * (1 - t); ctx.fillStyle = '#cdbf9c';
          ctx.beginPath(); ctx.ellipse(sx, sy, q.size * z * (0.6 + t), q.size * z * (0.4 + t * 0.5), 0, 0, 6.2832); ctx.fill(); break;
        }
        case 'debris': ctx.globalAlpha = 1 - t * t; ctx.fillStyle = q.col; ctx.fillRect(sx - q.size * z / 2, sy - q.size * z / 2, q.size * z, q.size * z); break;
        case 'spark': ctx.globalAlpha = 1 - t; ctx.fillStyle = q.col; ctx.fillRect(sx - 1, sy - 1, q.size * z + 0.5, q.size * z + 0.5); break;
        case 'smoke': {
          ctx.globalAlpha = q.a * (1 - t) * Math.min(1, t * 6); ctx.fillStyle = '#4a4540';
          ctx.beginPath(); ctx.arc(sx, sy, q.size * z * (0.5 + t * 1.2), 0, 6.2832); ctx.fill(); break;
        }
        case 'flame': {
          const s = q.size * z * (1 - t * 0.6);
          ctx.globalCompositeOperation = 'lighter';
          const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, s);
          g.addColorStop(0, `rgba(255,240,170,${0.9 * (1 - t)})`); g.addColorStop(0.4, `rgba(255,140,30,${0.7 * (1 - t)})`); g.addColorStop(1, 'rgba(200,30,0,0)');
          ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, s, 0, 6.2832); ctx.fill();
          ctx.globalCompositeOperation = 'source-over'; break;
        }
        case 'glow': {
          const s = q.size * z * (0.6 + t * 0.8);
          ctx.globalCompositeOperation = 'lighter';
          const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, s);
          g.addColorStop(0, q.col + 'cc'); g.addColorStop(1, q.col + '00');
          ctx.globalAlpha = (1 - t); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, s, 0, 6.2832); ctx.fill();
          ctx.globalCompositeOperation = 'source-over'; break;
        }
        case 'ring': {
          ctx.globalAlpha = (1 - t) * 0.9; ctx.strokeStyle = q.col; ctx.lineWidth = 2 * z;
          ctx.beginPath(); ctx.ellipse(sx, sy, q.size * z * (0.3 + t), q.size * z * (0.3 + t) * 0.5, 0, 0, 6.2832); ctx.stroke(); break;
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.font = `bold ${Math.round(12 * Math.max(0.9, z))}px Georgia, serif`; ctx.textAlign = 'center';
    for (const q of this.texts) {
      const sx = ((q.x - q.y) * 32 - cam.x) * z + cam.vw / 2, sy = ((q.x + q.y) * 16 - q.z - cam.y) * z + cam.vh / 2;
      const t = q.life / q.max;
      ctx.globalAlpha = Math.min(1, (1 - t) * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillText(q.str, sx + 1, sy + 1);
      ctx.fillStyle = q.col; ctx.fillText(q.str, sx, sy);
    }
    ctx.globalAlpha = 1;
  }
}
