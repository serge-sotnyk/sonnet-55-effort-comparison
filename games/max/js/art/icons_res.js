// Resource icons 'res:food|wood|gold|stone|pop': transparent, bold, readable at 24 px on a dark HUD.
import { C, S, circ, ell, rr, poly, smooth, renderIcon } from './icons_kit.js';

const BONE = ['#fffdf4', '#efe5cb', '#b8aa86'];
const MEAT = ['#ffa28a', '#d94a3c', '#8a1c1c'];
const BARK = ['#c98f57', '#8d5a2c', '#4e2e14'];

function logSide(g, x0, y0, len, h) {
  const r = h / 2;
  g.obj(S(`M${x0} ${y0}H${x0 + len}V${y0 + h}H${x0}Z`), ['#f2b878', '#c4813e', '#7c4a22'], { lw: 1.5, ang: 90, hi: 0.4 });
  g.clip(S(`M${x0} ${y0}H${x0 + len}V${y0 + h}H${x0}Z`), () => {
    for (let i = 0; i < 4; i++) g.line(x0 + 4 + i * (len - 6) / 4, y0 + 2, x0 + 3 + i * (len - 6) / 4, y0 + h - 2, 'rgba(60,28,8,0.40)', 1.2, { cap: 'butt' });
    g.flat(rr(x0, y0, len, 2.2, 0), 'rgba(255,230,180,0.5)');
  });
  g.obj(ell(x0 + len, y0 + r, 4.6, r), ['#fff2c8', '#f2c880', '#c48a42'], { lw: 1.4, hi: 0.2 });
  g.stroke(ell(x0 + len, y0 + r, 2.2, r * 0.5), 'rgba(110,60,20,0.7)', 1, { lw: 0 });
}

const RES = {
  food(g) {
    // ham on the bone
    g.tube(20, 44, 9, 54, 7, BONE, { lw: 1.6 });
    g.obj(circ(6.5, 52, 5), BONE, { lw: 1.5 }); g.obj(circ(11, 58, 5), BONE, { lw: 1.5 });
    g.obj(smooth([[15, 31], [17, 18], [29, 7], [45, 7], [58, 17], [61, 31], [53, 46], [37, 53], [22, 48]]), MEAT, { lw: 1.7, ang: 60 });
    g.clip(smooth([[15, 31], [17, 18], [29, 7], [45, 7], [58, 17], [61, 31], [53, 46], [37, 53], [22, 48]]), () => {
      g.flat(ell(31, 19, 11, 6, -28), 'rgba(255,255,255,0.35)');
      g.stroke(S('M26 36 Q38 30 52 38'), 'rgba(255,215,190,0.55)', 2.6, { lw: 0 });
      g.stroke(S('M30 44 Q40 40 50 44'), 'rgba(120,20,20,0.35)', 2.4, { lw: 0 });
      g.flat(ell(52, 44, 9, 6, -35), 'rgba(80,10,10,0.25)');
      g.flat(ell(40, 34, 11, 8.5, -20), ['#ffd0c0', '#f08c78', '#c4483c']);
      g.stroke(ell(40, 34, 7, 5, -20), 'rgba(255,240,230,0.7)', 1.6, { lw: 0 });
    });
    g.flat(ell(25, 16, 3, 1.8, -28), 'rgba(255,255,255,0.8)');
  },
  wood(g) {
    logSide(g, 5, 42, 39, 15);
    logSide(g, 13, 27, 39, 15);
    logSide(g, 5, 12, 39, 15);
  },
  gold(g) {
    const bar = (x, y, w) => {
      g.obj(poly([[x + 7, y], [x + w - 7, y], [x + w - 2, y + 8], [x + 2, y + 8]]), ['#fffbd0', '#ffe27a', '#e8b030'], { lw: 1.5, ang: 90, hi: 0.2, sh: 0 });
      g.obj(poly([[x + 2, y + 8], [x + w - 2, y + 8], [x + w, y + 19], [x, y + 19]]), ['#ffd860', '#e0a020', '#8a5410'], { lw: 1.5, ang: 70, hi: 0.4 });
      g.flat(poly([[x + 3.5, y + 11], [x + 11, y + 11], [x + 10.5, y + 13], [x + 3, y + 13]]), 'rgba(255,255,255,0.6)');
    };
    bar(1, 37, 31); bar(32, 37, 31); bar(16, 19, 31);
    g.spark(54, 12, 5.5, '#fff', '#ffe27a'); g.spark(9, 28, 3.2, '#fff');
  },
  stone(g) {
    const rock = smooth([[6, 42], [11, 22], [27, 9], [46, 13], [57, 30], [54, 50], [32, 58], [12, 54]]);
    g.obj(rock, ['#e2e6ee', '#9aa2b2', '#4c5362'], { lw: 1.7, ang: 60, hi: 0.5 });
    g.clip(rock, () => {
      g.flat(poly([[11, 22], [27, 9], [36, 27], [20, 36]]), 'rgba(255,255,255,0.32)');
      g.flat(poly([[27, 9], [46, 13], [43, 30], [36, 27]]), 'rgba(255,255,255,0.08)');
      g.flat(poly([[46, 13], [57, 30], [54, 50], [43, 30]]), 'rgba(0,0,30,0.26)');
      g.flat(poly([[20, 36], [36, 27], [43, 30], [54, 50], [32, 58], [12, 54], [6, 42]]), 'rgba(0,0,30,0.10)');
      g.line(20, 36, 36, 27, 'rgba(20,24,40,0.5)', 1.1); g.line(36, 27, 43, 30, 'rgba(20,24,40,0.45)', 1.1); g.line(43, 30, 54, 50, 'rgba(20,24,40,0.4)', 1.1);
      g.line(20, 36, 12, 54, 'rgba(20,24,40,0.35)', 1);
    });
    g.flat(ell(21, 20, 4, 2, -35), 'rgba(255,255,255,0.7)');
  },
  pop(g) {
    // little house with a villager in front
    g.obj(rr(4, 29, 34, 28, 0.6), ['#f6ecd0', '#d9c79a', '#8c7a4a'], { lw: 1.6, ang: 30 });
    g.obj(poly([[-1, 32], [21, 8], [43, 32]]), ['#f0906a', '#c04e2c', '#6c2410'], { lw: 1.6, ang: 40 });
    g.obj(rr(14, 41, 10, 16, 1), ['#7a4a26', '#4a2a12', '#24130a'], { lw: 1.1, hi: 0.1 });
    // villager
    g.obj(smooth([[33, 62], [35, 46], [44, 41], [53, 44], [58, 62]]), ['#8ec4ff', '#3d78d8', '#1a3e88'], { lw: 1.6, ang: 70 });
    g.obj(circ(46, 30, 8.5), ['#ffe6c8', '#eab88a', '#b07650'], { lw: 1.6, ang: 70 });
    g.obj(S('M36.5 28 Q46 14 55.5 28 Q46 24 36.5 28 Z'), ['#f0d070', '#c8a030', '#7a5a14'], { lw: 1.2, hi: 0.4 });
    g.obj(ell(46, 26.5, 11.5, 3), ['#f0d070', '#c8a030', '#7a5a14'], { lw: 1.2, hi: 0.4 });
  },
};

export const RES_KINDS = Object.keys(RES);
export function buildRes(kind, size) {
  const f = RES[kind] || RES.food;
  return renderIcon(size, g => f(g), { shadow: 0.8 });
}
