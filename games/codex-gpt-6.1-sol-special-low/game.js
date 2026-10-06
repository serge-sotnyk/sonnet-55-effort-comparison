"use strict";
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)],
  TAU = Math.PI * 2,
  AGE = ["Dark Age", "Feudal Age", "Castle Age", "Imperial Age"],
  COLORS = ["#4fa9ec", "#d75b51", "#d4b74b", "#af7ed5"],
  ICON = { food: "🌾", wood: "🪵", gold: "◆", stone: "⬟" },
  CIV = {
    Britons: {
      bonus: "Archers gain +2 range. Shepherds gather 25% faster.",
      unique: "Longbowman",
      lang: "en-GB",
      lines: {
        select: ["Yea, my lord.", "At thy service.", "Ready."],
        move: ["Ic gange.", "To þære stowe.", "Forþ, min hlaford."],
        gather: ["Ic wyrce.", "To weorce."],
        build: ["Ic timbrie.", "We shall build."],
        attack: ["Forþ to guþe!", "For the king!"],
      },
    },
    Franks: {
      bonus: "Cavalry have 20% more health. Farms gather 15% faster.",
      unique: "Throwing Axeman",
      lang: "fr-FR",
      lines: {
        select: ["Oïl, sire.", "À vostre service.", "Prêt, mon seigneur."],
        move: ["Je vais.", "En avant.", "Par ici."],
        gather: ["Au travail.", "Je recueille."],
        build: ["Je bâtis.", "À la besogne."],
        attack: ["Montjoie!", "Pour le roi!"],
      },
    },
    Byzantines: {
      bonus: "Buildings have 25% more health. Fire Ships deal 25% more damage.",
      unique: "Cataphract",
      lang: "el-GR",
      lines: {
        select: ["Έτοιμος.", "Πρόσταγμα.", "Μάλιστα."],
        move: ["Πορεύομαι.", "Εμπρός."],
        gather: ["Εργάζομαι.", "Συλλέγω."],
        build: ["Οικοδομώ.", "Θεμελιώνω."],
        attack: ["Επίθεση!", "Για την αυτοκρατορία!"],
      },
    },
    Vikings: {
      bonus: "Fishing Ships gather 20% faster. Infantry have 20% more health.",
      unique: "Berserk",
      lang: "is-IS",
      lines: {
        select: ["Já, herra.", "Til þjónustu.", "Ek em búinn."],
        move: ["Ek geng.", "Fram.", "Þangað."],
        gather: ["Ek vinn.", "Til verks."],
        build: ["Ek byggi.", "Hér rís hús."],
        attack: ["Til vígs!", "Fyrir konung!"],
      },
    },
  };
const cost = (food = 0, wood = 0, gold = 0, stone = 0) => ({
  food,
  wood,
  gold,
  stone,
});
const B = {
  "Town Center": {
    cost: cost(0, 275, 0, 100),
    age: 0,
    hp: 2200,
    pop: 10,
    size: 2.6,
    cap: 15,
    range: 7,
    atk: 8,
    desc: "Trains villagers, advances ages, shelters 15 units.",
  },
  House: {
    cost: cost(0, 25),
    age: 0,
    hp: 350,
    pop: 5,
    size: 1.3,
    desc: "Adds 5 population.",
  },
  Mill: {
    cost: cost(0, 100),
    age: 0,
    hp: 600,
    size: 1.5,
    desc: "Food drop-off. Research farm improvements.",
  },
  "Lumber Camp": {
    cost: cost(0, 100),
    age: 0,
    hp: 550,
    size: 1.5,
    desc: "Wood drop-off and lumber technologies.",
  },
  "Mining Camp": {
    cost: cost(0, 100),
    age: 0,
    hp: 550,
    size: 1.5,
    desc: "Gold and stone drop-off.",
  },
  Farm: {
    cost: cost(0, 60),
    age: 0,
    hp: 200,
    size: 1.8,
    desc: "Renewable food source. One assigned farmer.",
  },
  Barracks: {
    cost: cost(0, 175),
    age: 0,
    hp: 1000,
    size: 2,
    desc: "Trains infantry and spear units.",
  },
  "Archery Range": {
    cost: cost(0, 175),
    age: 1,
    hp: 1000,
    size: 2,
    req: "Barracks",
    desc: "Trains archers and skirmishers.",
  },
  Stable: {
    cost: cost(0, 175),
    age: 1,
    hp: 1100,
    size: 2,
    req: "Barracks",
    desc: "Trains mounted scouts and knights.",
  },
  Blacksmith: {
    cost: cost(0, 150),
    age: 1,
    hp: 900,
    size: 1.6,
    desc: "Improve army attack and armor.",
  },
  Market: {
    cost: cost(0, 175),
    age: 1,
    hp: 1200,
    size: 2,
    req: "Mill",
    desc: "Trade resources and train Trade Carts.",
  },
  Monastery: {
    cost: cost(0, 175),
    age: 2,
    hp: 1000,
    size: 2,
    desc: "Trains monks. Stored relics yield gold.",
  },
  University: {
    cost: cost(0, 200),
    age: 2,
    hp: 1100,
    size: 2.2,
    desc: "Research Ballistics and defensive Masonry.",
  },
  "Siege Workshop": {
    cost: cost(0, 200),
    age: 2,
    hp: 1100,
    size: 2,
    desc: "Trains rams and mangonels.",
  },
  Castle: {
    cost: cost(0, 0, 0, 650),
    age: 2,
    hp: 3000,
    size: 2.6,
    cap: 20,
    atk: 18,
    range: 9,
    desc: "Trains unique units and trebuchets. Shelters 20.",
  },
  Tower: {
    cost: cost(0, 50, 0, 125),
    age: 1,
    hp: 1000,
    size: 1,
    cap: 5,
    atk: 7,
    range: 8,
    desc: "Defensive arrows; shelters 5 units.",
  },
  Wall: {
    cost: cost(0, 0, 0, 8),
    age: 1,
    hp: 650,
    size: 0.7,
    desc: "Blocks movement and protects your settlement.",
  },
  Gate: {
    cost: cost(0, 0, 0, 30),
    age: 1,
    hp: 900,
    size: 1,
    desc: "Friendly units can pass through.",
  },
  Dock: {
    cost: cost(0, 150),
    age: 0,
    hp: 1200,
    size: 2,
    desc: "Shoreline building. Trains ships; accepts fish and sea trade.",
  },
};
const U = {
  Villager: {
    cost: cost(50),
    age: 0,
    at: "Town Center",
    hp: 40,
    atk: 3,
    range: 1.2,
    speed: 1.6,
    time: 9,
    role: "worker",
  },
  Militia: {
    cost: cost(60, 0, 20),
    age: 0,
    at: "Barracks",
    hp: 55,
    atk: 7,
    range: 1.2,
    speed: 1.5,
    time: 10,
    role: "infantry",
  },
  Spearman: {
    cost: cost(35, 25),
    age: 1,
    at: "Barracks",
    hp: 50,
    atk: 4,
    range: 1.5,
    speed: 1.55,
    time: 10,
    role: "spear",
  },
  Archer: {
    cost: cost(0, 25, 45),
    age: 1,
    at: "Archery Range",
    hp: 35,
    atk: 5,
    range: 6,
    speed: 1.5,
    time: 12,
    role: "archer",
  },
  Skirmisher: {
    cost: cost(25, 35),
    age: 1,
    at: "Archery Range",
    hp: 40,
    atk: 3,
    range: 5,
    speed: 1.5,
    time: 10,
    role: "skirm",
  },
  Scout: {
    cost: cost(80),
    age: 1,
    at: "Stable",
    hp: 65,
    atk: 6,
    range: 1.4,
    speed: 2.8,
    time: 12,
    role: "cavalry",
  },
  Knight: {
    cost: cost(60, 0, 75),
    age: 2,
    at: "Stable",
    hp: 110,
    atk: 12,
    range: 1.4,
    speed: 2.3,
    time: 15,
    role: "cavalry",
  },
  Monk: {
    cost: cost(0, 0, 100),
    age: 2,
    at: "Monastery",
    hp: 35,
    atk: 0,
    range: 6,
    speed: 1.3,
    time: 17,
    role: "monk",
  },
  Ram: {
    cost: cost(0, 160, 75),
    age: 2,
    at: "Siege Workshop",
    hp: 220,
    atk: 35,
    range: 1.5,
    speed: 0.8,
    time: 20,
    role: "siege",
  },
  Mangonel: {
    cost: cost(0, 160, 135),
    age: 2,
    at: "Siege Workshop",
    hp: 65,
    atk: 30,
    range: 8,
    speed: 1,
    time: 22,
    role: "siege",
  },
  Trebuchet: {
    cost: cost(0, 200, 200),
    age: 3,
    at: "Castle",
    hp: 160,
    atk: 70,
    range: 13,
    speed: 0.7,
    time: 25,
    role: "siege",
  },
  Longbowman: {
    cost: cost(0, 35, 40),
    age: 2,
    at: "Castle",
    hp: 45,
    atk: 7,
    range: 8,
    speed: 1.5,
    time: 12,
    role: "archer",
    civ: "Britons",
  },
  "Throwing Axeman": {
    cost: cost(55, 0, 25),
    age: 2,
    at: "Castle",
    hp: 70,
    atk: 9,
    range: 4,
    speed: 1.5,
    time: 12,
    role: "infantry",
    civ: "Franks",
  },
  Cataphract: {
    cost: cost(70, 0, 75),
    age: 2,
    at: "Castle",
    hp: 140,
    atk: 13,
    range: 1.5,
    speed: 2.2,
    time: 17,
    role: "cavalry",
    civ: "Byzantines",
  },
  Berserk: {
    cost: cost(65, 0, 25),
    age: 2,
    at: "Castle",
    hp: 85,
    atk: 11,
    range: 1.3,
    speed: 1.7,
    time: 12,
    role: "infantry",
    civ: "Vikings",
  },
  "Fishing Ship": {
    cost: cost(0, 75),
    age: 0,
    at: "Dock",
    hp: 70,
    atk: 0,
    range: 0,
    speed: 1.8,
    time: 12,
    role: "fish",
    water: true,
  },
  "Transport Ship": {
    cost: cost(0, 125),
    age: 1,
    at: "Dock",
    hp: 160,
    atk: 0,
    range: 0,
    speed: 2,
    time: 15,
    role: "transport",
    water: true,
    cap: 12,
  },
  Galley: {
    cost: cost(0, 90, 30),
    age: 1,
    at: "Dock",
    hp: 125,
    atk: 9,
    range: 7,
    speed: 2,
    time: 16,
    role: "warship",
    water: true,
  },
  "Fire Ship": {
    cost: cost(0, 75, 45),
    age: 2,
    at: "Dock",
    hp: 150,
    atk: 14,
    range: 3,
    speed: 1.8,
    time: 18,
    role: "fire",
    water: true,
  },
  "Demolition Ship": {
    cost: cost(0, 70, 50),
    age: 2,
    at: "Dock",
    hp: 70,
    atk: 100,
    range: 1.8,
    speed: 2.4,
    time: 16,
    role: "demo",
    water: true,
  },
  "Trade Cart": {
    cost: cost(0, 100, 50),
    age: 1,
    at: "Market",
    hp: 70,
    atk: 0,
    range: 0,
    speed: 1.9,
    time: 15,
    role: "trade",
  },
  "Trade Cog": {
    cost: cost(0, 100, 50),
    age: 1,
    at: "Dock",
    hp: 100,
    atk: 0,
    range: 0,
    speed: 1.9,
    time: 15,
    role: "trade",
    water: true,
  },
  "Cobra Car": {
    cost: cost(),
    age: 0,
    hp: 500,
    atk: 24,
    range: 8,
    speed: 4.6,
    time: 0,
    role: "cobra",
  },
};
const TECH = {
  "Double-bit Axe": {
    at: "Lumber Camp",
    age: 1,
    cost: cost(100, 50),
    desc: "Wood gathering +30%.",
    effect: "wood",
  },
  "Horse Collar": {
    at: "Mill",
    age: 1,
    cost: cost(75, 75),
    desc: "Farms gather +25%.",
    effect: "farm",
  },
  "Gold Mining": {
    at: "Mining Camp",
    age: 1,
    cost: cost(100, 75),
    desc: "Mining +30%.",
    effect: "mining",
  },
  Forging: {
    at: "Blacksmith",
    age: 1,
    cost: cost(150, 0, 50),
    desc: "Military attack +2.",
    effect: "attack",
  },
  "Scale Armor": {
    at: "Blacksmith",
    age: 1,
    cost: cost(100, 0, 75),
    desc: "Military armor +2.",
    effect: "armor",
  },
  "Man-at-Arms": {
    at: "Barracks",
    age: 1,
    cost: cost(100, 0, 40),
    desc: "Militia gain +20 HP and +3 attack.",
    effect: "infantry",
  },
  Pikeman: {
    at: "Barracks",
    age: 2,
    cost: cost(160, 0, 90),
    desc: "Spearmen gain +20 HP; counter cavalry.",
    effect: "spear",
  },
  Crossbowman: {
    at: "Archery Range",
    age: 2,
    cost: cost(125, 0, 75),
    desc: "Archers gain +10 HP, +3 attack.",
    effect: "archer",
  },
  "War Galley": {
    at: "Dock",
    age: 2,
    cost: cost(0, 200, 150),
    desc: "Galleys gain +40 HP, +5 attack.",
    effect: "galley",
  },
  Galleon: {
    at: "Dock",
    age: 3,
    cost: cost(0, 300, 250),
    req: "War Galley",
    desc: "Galleys gain a further +60 HP, +6 attack.",
    effect: "galleon",
  },
  Ballistics: {
    at: "University",
    age: 2,
    cost: cost(0, 200, 150),
    desc: "Ranged attacks deal +20% damage.",
    effect: "ballistics",
  },
  Masonry: {
    at: "University",
    age: 2,
    cost: cost(150, 0, 0, 100),
    desc: "Buildings gain +30% health.",
    effect: "masonry",
  },
  Sanctity: {
    at: "Monastery",
    age: 2,
    cost: cost(0, 0, 120),
    desc: "Monks gain +20 HP.",
    effect: "sanctity",
  },
  Redemption: {
    at: "Monastery",
    age: 2,
    cost: cost(0, 0, 250),
    desc: "Monks may convert siege engines.",
    effect: "redemption",
  },
  Paladin: {
    at: "Stable",
    age: 3,
    cost: cost(300, 0, 250),
    desc: "Knights gain +50 HP and +5 attack.",
    effect: "paladin",
  },
};
let G = null,
  editing = false,
  customDesign = null,
  selected = [],
  buildMode = null,
  commandMode = null,
  menuGroup = "main",
  cam = { x: 0, y: 0, z: 1.2 },
  mouse = { x: 0, y: 0 },
  drag = null,
  keys = {},
  last = 0,
  uiClock = 0,
  paused = false,
  history = [],
  future = [],
  editorTool = "grass",
  brush = 1,
  editorOwner = 0,
  editorKind = "terrain",
  moveObject = null;
const canvas = $("#world"),
  ctx = canvas.getContext("2d"),
  mini = $("#minimap").getContext("2d");
let idSeq = 1;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
  clamp = (v, a, b) => Math.max(a, Math.min(b, v)),
  rand = (a, b) => a + Math.random() * (b - a),
  alive = (e) => e && e.hp > 0 && !e.garrison;
function seeded(seed) {
  let a = Number(seed) || 1024;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function tile(x, y) {
  return G?.tiles[Math.floor(y)]?.[Math.floor(x)];
}
function height(x, y) {
  return tile(x, y)?.h || 0;
}
function water(x, y) {
  return tile(x, y)?.t === "water";
}
function iso(x, y, h = height(x, y)) {
  return {
    x: canvas.width / 2 + (x - y) * 25 * cam.z - cam.x,
    y: canvas.height * 0.42 + (x + y) * 12.5 * cam.z - h * 9 * cam.z - cam.y,
  };
}
function uniso(x, y) {
  let a = (x - canvas.width / 2 + cam.x) / (25 * cam.z),
    b = (y - canvas.height * 0.42 + cam.y) / (12.5 * cam.z);
  let p = { x: (a + b) / 2, y: (b - a) / 2 };
  for (let i = 0; i < 2; i++) {
    b =
      (y - canvas.height * 0.42 + cam.y + height(p.x, p.y) * 9 * cam.z) /
      (12.5 * cam.z);
    p = { x: (a + b) / 2, y: (b - a) / 2 };
  }
  return p;
}
function entity(type, x, y, owner = -1, extra = {}) {
  const d = B[type] || U[type];
  let e = {
    id: idSeq++,
    type,
    x,
    y,
    owner,
    hp: d?.hp || { sheep: 25, deer: 30, boar: 100, wolf: 55 }[type] || 100,
    maxHp: d?.hp || { sheep: 25, deer: 30, boar: 100, wolf: 55 }[type] || 100,
    kind: B[type]
      ? "building"
      : U[type]
        ? "unit"
        : ["sheep", "deer", "boar", "wolf"].includes(type)
          ? "animal"
          : "resource",
    task: null,
    phase: rand(0, 10),
    cool: 0,
    path: [],
    carry: 0,
    carryType: "",
    queue: [],
    built: 1,
    occupants: [],
    relics: 0,
    stock:
      {
        tree: 250,
        berry: 250,
        gold: 700,
        stone: 600,
        fish: 700,
        sheep: 150,
        deer: 140,
        boar: 300,
        Farm: 550,
      }[type] || 0,
    ...extra,
  };
  if (owner >= 0 && d) {
    let civ = G.players[owner]?.civ;
    if (
      (civ === "Byzantines" && e.kind === "building") ||
      (civ === "Franks" && d.role === "cavalry") ||
      (civ === "Vikings" && d.role === "infantry")
    ) {
      e.hp *= civ === "Byzantines" ? 1.25 : 1.2;
      e.maxHp = e.hp;
    }
  }
  if (owner >= 0 && d) {
    let tech = G.players[owner]?.tech || [],
      bonus = 0;
    if (tech.includes("Masonry") && e.kind === "building")
      bonus += e.maxHp * 0.3;
    for (let [name, type, amount] of [
      ["Man-at-Arms", "Militia", 20],
      ["Pikeman", "Spearman", 20],
      ["Crossbowman", "Archer", 10],
      ["War Galley", "Galley", 40],
      ["Galleon", "Galley", 60],
      ["Sanctity", "Monk", 20],
      ["Paladin", "Knight", 50],
    ])
      if (tech.includes(name) && e.type === type) bonus += amount;
    e.maxHp += bonus;
    e.hp += bonus;
  }
  G.entities.push(e);
  return e;
}
function reachableResource(e, type) {
  let candidates = G.entities
    .filter((t) => t.type === type && t.stock > 0 && t.hp > 0)
    .sort((a, b) => dist(a, e) - dist(b, e));
  return candidates
    .slice(0, 16)
    .find((t) => dist(e, t) < 1 || pathfind(e, t.x, t.y, t).length);
}
function nearest(e, fn) {
  let best = null,
    d = Infinity;
  for (const a of G.entities) {
    if (a.hp <= 0 || a.garrison || !fn(a)) continue;
    let q = dist(e, a);
    if (q < d) {
      d = q;
      best = a;
    }
  }
  return best;
}
function friends(a, b) {
  return a === b || (a >= 0 && b >= 0 && G.players[a]?.relations[b] === "ally");
}
function hostile(a, b) {
  return a >= 0 && b >= 0 && a !== b && G.players[a]?.relations[b] === "war";
}
function generate(settings, blank = false) {
  idSeq = 1;
  const r = seeded(settings.seed),
    n = Number(settings.size),
    count = Number(settings.opponents) + 1;
  G = {
    settings,
    n,
    tiles: [],
    entities: [],
    players: [],
    time: 0,
    effects: [],
    revealed: Array.from({ length: n }, () => Array(n).fill(false)),
    visible: Array.from({ length: n }, () => Array(n).fill(false)),
    instant: false,
    bell: false,
    won: false,
    aiTick: 0,
  };
  let pos = [];
  if (settings.map === "islands")
    pos = [
      [0.22, 0.23],
      [0.77, 0.76],
      [0.22, 0.76],
      [0.77, 0.23],
    ];
  else
    pos = [
      [0.22, 0.25],
      [0.76, 0.72],
      [0.22, 0.74],
      [0.76, 0.24],
    ];
  for (let y = 0; y < n; y++) {
    G.tiles[y] = [];
    for (let x = 0; x < n; x++) {
      let w = false;
      if (!blank) {
        if (settings.map === "coast")
          w =
            (x > n * 0.54 && Math.abs(y - n * 0.5) < n * 0.12) ||
            (x > n * 0.83 && y > n * 0.1 && y < n * 0.9);
        if (settings.map === "islands")
          w = !pos.some((p) => Math.hypot(x / n - p[0], y / n - p[1]) < 0.19);
      }
      let hh =
        blank || w
          ? 0
          : clamp(
              Math.round(
                (Math.sin(x * 0.22) +
                  Math.cos(y * 0.25) +
                  Math.sin((x + y) * 0.1)) *
                  0.65,
              ),
              0,
              3,
            );
      if (
        pos
          .slice(0, count)
          .some((p) => Math.hypot(x - p[0] * n, y - p[1] * n) < 5.8)
      )
        hh = 0;
      if (
        settings.map === "islands" &&
        !w &&
        Math.min(
          ...pos.map((p) =>
            Math.abs(Math.hypot(x / n - p[0], y / n - p[1]) - 0.19),
          ),
        ) < 0.035
      )
        hh = 0;
      G.tiles[y][x] = {
        t: w ? "water" : r() < 0.08 ? "dirt" : "grass",
        h: hh,
        v: r(),
      };
    }
  }
  let available = [...COLORS];
  available[0] = settings.color;
  available = available.filter((v, i, a) => a.indexOf(v) === i);
  while (available.length < 4) available.push("#55b993");
  let civi = Object.keys(CIV);
  for (let i = 0; i < count; i++) {
    let resources =
      settings.resources === "rich"
        ? 2000
        : settings.resources === "scarce"
          ? 200
          : 500;
    G.players.push({
      id: i,
      name:
        i === 0
          ? settings.name
          : ["Lord Beaumont", "Jarl Eirik", "Empress Irene"][i - 1],
      color: available[i],
      civ: i === 0 ? settings.civ : civi[i],
      age: Number(settings.age),
      res: cost(resources, resources, resources, resources),
      tech: [],
      relations: [],
      start: { x: pos[i][0] * n, y: pos[i][1] * n },
      ai: i > 0,
      defeated: false,
      aiPlan: 0,
      attackTime: 0,
    });
  }
  for (let p of G.players)
    for (let q of G.players)
      p.relations[q.id] =
        p.id === q.id
          ? "ally"
          : settings.teams === "teams" && p.id % 2 === q.id % 2
            ? "ally"
            : "war";
  if (!blank) {
    for (let y = 1; y < n - 1; y++)
      for (let x = 1; x < n - 1; x++) {
        if (
          pos
            .slice(0, count)
            .some((p) => Math.hypot(x - p[0] * n, y - p[1] * n) < 5.3)
        )
          continue;
        if (water(x, y)) {
          if (r() < 0.025) entity("fish", x + 0.5, y + 0.5);
        } else if (r() < 0.17)
          entity("tree", x + 0.5, y + 0.5, -1, {
            variant: Math.floor(r() * 3),
          });
        else if (r() < 0.014) entity("gold", x + 0.5, y + 0.5);
        else if (r() < 0.014) entity("stone", x + 0.5, y + 0.5);
        else if (r() < 0.009) entity("deer", x + 0.5, y + 0.5);
        else if (r() < 0.003) entity("wolf", x + 0.5, y + 0.5);
        else if (r() < 0.002) entity("relic", x + 0.5, y + 0.5);
      }
    for (let p of G.players) {
      let { x, y } = p.start;
      for (let yy = Math.floor(y) - 3; yy <= y + 3; yy++)
        for (let xx = Math.floor(x) - 3; xx <= x + 3; xx++)
          if (G.tiles[yy]?.[xx]) G.tiles[yy][xx] = { t: "grass", h: 0, v: r() };
      entity("Town Center", x, y, p.id);
      entity("House", x - 3, y + 1, p.id);
      for (let j = 0; j < 5; j++)
        entity("Villager", x - 2 + j * 0.8, y + 2, p.id);
      entity("Scout", x + 2, y + 2, p.id);
      for (let j = 0; j < 4; j++) entity("sheep", x - 3 + j * 0.6, y + 3, -1);
      for (let j = 0; j < 7; j++)
        entity("tree", x - 5 + j * 0.55, y - 2, -1, { variant: j % 3 });
      for (let j = 0; j < 4; j++) entity("berry", x + 4 + j * 0.6, y + 2);
      entity("gold", x + 3, y - 4);
      entity("stone", x - 3, y - 4);
      entity("boar", x + 5, y + 4);
      entity("deer", x + 5, y - 3);
    }
    let rp = { x: n * 0.48, y: n * 0.42 };
    if (water(rp.x, rp.y))
      rp = { x: G.players[0].start.x + 4, y: G.players[0].start.y - 2 };
    entity("relic", rp.x, rp.y);
  }
  return G;
}
function settings() {
  let f = new FormData($("#setupForm"));
  return Object.fromEntries(
    [...f.entries()].concat([
      ["cheats", f.has("cheats")],
      ["tips", f.has("tips")],
    ]),
  );
}
function startMatch(custom = null) {
  $("#notifications").innerHTML = "";
  $("#objectiveText").textContent =
    "Build an economy. Defeat hostile kingdoms.";
  let s = settings();
  editing = false;
  $("#editorBar").hidden = true;
  if (custom) {
    G = JSON.parse(JSON.stringify(custom));
    G.settings = { ...s, ...G.settings, cheats: s.cheats, tips: s.tips };
    G.time = 0;
    G.effects = [];
    G.won = false;
    G.instant = false;
    G.bell = false;
    for (let p of G.players) {
      p.ai = p.id > 0;
      p.defeated = false;
      p.aiPlan = 0;
      p.attackTime = 0;
      p.tech = p.tech || [];
      p.res = cost(
        s.resources === "rich" ? 2000 : 500,
        s.resources === "rich" ? 2000 : 500,
        s.resources === "rich" ? 2000 : 500,
        s.resources === "rich" ? 2000 : 500,
      );
    }
    idSeq = Math.max(...G.entities.map((e) => e.id)) + 1;
  } else generate(s);
  showGame();
  let p = G.players[0].start;
  center(p);
  selected = [];
  paused = false;
  AudioSys.init();
  updateVisibility();
  updateUI();
  notify("Your reign begins. Select villagers and right-click resources.");
  if (s.tips)
    $("#tip").textContent =
      "Drag to select · Right-click to command · Wheel to zoom · WASD / arrows to pan · H selects Town Center · Enter for chat";
  $("#tip").hidden = !s.tips;
}
function showGame() {
  $("#menu").hidden = true;
  $("#game").hidden = false;
  resize();
  $("#mapLabel").textContent =
    (editing ? "MAP EDITOR" : G.settings.map.toUpperCase()) +
    " · SEED " +
    G.settings.seed;
}
function center(p) {
  cam.x = (p.x - p.y) * 25 * cam.z;
  cam.y = (p.x + p.y) * 12.5 * cam.z - height(p.x, p.y) * 9 * cam.z;
}
function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
window.addEventListener("resize", resize);
function notify(s) {
  while ($("#notifications").children.length >= 4)
    $("#notifications").firstElementChild.remove();
  let n = document.createElement("div");
  n.className = "notice";
  n.textContent = s;
  $("#notifications").append(n);
  setTimeout(() => n.remove(), 6500);
}
function population(p) {
  return G.entities.filter(
    (e) => e.owner === p && e.kind === "unit" && e.hp > 0,
  ).length;
}
function popcap(p) {
  return Math.min(
    200,
    G.entities.reduce(
      (v, e) =>
        v +
        (e.owner === p && e.hp > 0 && e.built >= 1 ? B[e.type]?.pop || 0 : 0),
      0,
    ),
  );
}
function canPay(p, c) {
  return Object.keys(c).every((k) => p.res[k] >= c[k]);
}
function pay(p, c) {
  for (let k in c) p.res[k] -= c[k];
}
function costs(c) {
  return Object.entries(c)
    .filter(([k, v]) => v)
    .map(([k, v]) => v + " " + k)
    .join(" · ");
}
function prerequisites(p, d) {
  if (p.age < d.age) return AGE[d.age] + " required";
  if (
    d.req &&
    !p.tech.includes(d.req) &&
    !G.entities.some(
      (e) => e.owner === p.id && e.type === d.req && e.built >= 1 && e.hp > 0,
    )
  )
    return d.req + " required";
  if (d.civ && d.civ !== p.civ) return d.civ + " only";
  return "";
}
function queue(b, type, kind = "unit") {
  let p = G.players[b.owner],
    d =
      kind === "age"
        ? {
            cost: [cost(500), cost(800, 0, 200), cost(1000, 0, 800)][p.age],
            age: p.age,
            time: 40,
          }
        : kind === "tech"
          ? TECH[type]
          : U[type];
  if (!d) return;
  if (prerequisites(p, d)) {
    if (p.id === 0) notify(prerequisites(p, d));
    return false;
  }
  if (
    kind === "tech" &&
    (p.tech.includes(type) || b.queue.some((q) => q.type === type))
  )
    return false;
  if (kind === "age" && (p.age === 3 || b.queue.some((q) => q.kind === "age")))
    return false;
  if (
    kind === "unit" &&
    population(p.id) +
      G.entities
        .filter((e) => e.owner === p.id)
        .reduce(
          (s, e) => s + e.queue.filter((q) => q.kind === "unit").length,
          0,
        ) >=
      popcap(p.id)
  ) {
    if (p.id === 0) notify("Build more Houses to increase population.");
    return false;
  }
  if (!canPay(p, d.cost)) {
    if (p.id === 0) notify("Not enough resources: " + costs(d.cost));
    return false;
  }
  pay(p, d.cost);
  b.queue.push({ type, kind, left: d.time || 24, total: d.time || 24 });
  updateUI();
  return true;
}
function validSite(type, x, y) {
  let d = B[type];
  if (!tile(x, y)) return "Outside map";
  if (type === "Dock") {
    if (!water(x, y)) return "Dock foundation must be on water";
    if (!shore({ x, y }, 3)) return "Dock requires nearby land";
  } else if (water(x, y)) return "Requires land";
  if (
    G.entities.some(
      (e) =>
        e.hp > 0 &&
        e.kind === "building" &&
        dist(e, { x, y }) < (B[e.type].size + d.size) * 0.45,
    )
  )
    return "Overlaps a building";
  if (
    G.entities.some(
      (e) => e.hp > 0 && e.type === "tree" && dist(e, { x, y }) < d.size * 0.5,
    )
  )
    return "Trees block this site";
  return "";
}
function construct(type, x, y, owner = 0, instant = false) {
  let p = G.players[owner],
    d = B[type];
  let reason = prerequisites(p, d) || validSite(type, x, y);
  if (reason) {
    if (owner === 0) notify(reason);
    return null;
  }
  if (!canPay(p, d.cost)) {
    if (owner === 0) notify("Not enough resources: " + costs(d.cost));
    return null;
  }
  pay(p, d.cost);
  let b = entity(type, x, y, owner, {
    built: instant || G.instant ? 1 : 0.02,
    hp: instant || G.instant ? d.hp : Math.max(1, d.hp * 0.02),
  });
  return b;
}
function blocked(x, y, e, goal) {
  let t = tile(x, y);
  if (!t) return true;
  if (!!U[e.type]?.water !== (t.t === "water")) return true;
  for (let o of G.entities) {
    if (o.hp <= 0 || o.id === e.id || o.id === goal?.id || o.garrison) continue;
    if (o.type === "tree" && o.stock > 0 && dist(o, { x, y }) < 0.48)
      return true;
    if (
      o.kind === "building" &&
      o.type !== "Farm" &&
      (o.type !== "Gate" || !friends(e.owner, o.owner)) &&
      dist(o, { x, y }) < B[o.type].size * 0.39
    )
      return true;
  }
  return false;
}
function pathfind(e, x, y, target) {
  let grid = G.tiles.map((row) =>
    row.map((t) => !!U[e.type]?.water !== (t.t === "water")),
  );
  for (let o of G.entities) {
    if (o.hp <= 0 || o.garrison || o.id === e.id || o.id === target?.id)
      continue;
    let radius =
      o.type === "tree" && o.stock > 0
        ? 0.48
        : o.kind === "building" &&
            o.type !== "Farm" &&
            (o.type !== "Gate" || !friends(e.owner, o.owner))
          ? B[o.type].size * 0.39
          : 0;
    if (!radius) continue;
    for (let yy = Math.floor(o.y - radius); yy <= o.y + radius; yy++)
      for (let xx = Math.floor(o.x - radius); xx <= o.x + radius; xx++)
        if (
          grid[yy]?.[xx] !== undefined &&
          Math.hypot(xx + 0.5 - o.x, yy + 0.5 - o.y) < radius
        )
          grid[yy][xx] = true;
  }
  let block = (x, y) => grid[Math.floor(y)]?.[Math.floor(x)] !== false;
  let sx = Math.floor(e.x),
    sy = Math.floor(e.y),
    tx = clamp(Math.floor(x), 0, G.n - 1),
    ty = clamp(Math.floor(y), 0, G.n - 1);
  let goal = { x: tx + 0.5, y: ty + 0.5 };
  if (block(goal.x, goal.y)) {
    let found = false;
    for (let r = 1; r <= 4 && !found; r++)
      for (let yy = ty - r; yy <= ty + r && !found; yy++)
        for (let xx = tx - r; xx <= tx + r && !found; xx++)
          if (!block(xx + 0.5, yy + 0.5)) {
            tx = xx;
            ty = yy;
            found = true;
          }
  }
  let open = [{ x: sx, y: sy, g: 0, f: 0 }],
    came = new Map(),
    seen = new Set(),
    end = null,
    loops = 0;
  while (open.length && loops++ < 5000) {
    open.sort((a, b) => b.f - a.f);
    let a = open.pop(),
      key = a.x + "," + a.y;
    if (seen.has(key)) continue;
    seen.add(key);
    if (a.x === tx && a.y === ty) {
      end = a;
      break;
    }
    for (let [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ]) {
      let nx = a.x + dx,
        ny = a.y + dy,
        k = nx + "," + ny;
      if (
        seen.has(k) ||
        block(nx + 0.5, ny + 0.5) ||
        Math.abs(height(nx, ny) - height(a.x, a.y)) > 1
      )
        continue;
      if (
        dx &&
        dy &&
        (block(a.x + dx + 0.5, a.y + 0.5) || block(a.x + 0.5, a.y + dy + 0.5))
      )
        continue;
      let g =
        a.g +
        (dx && dy ? 1.42 : 1) +
        Math.abs(height(nx, ny) - height(a.x, a.y)) * 0.3;
      if (came.has(k) && came.get(k).g <= g) continue;
      came.set(k, { parent: key, g });
      open.push({ x: nx, y: ny, g, f: g + Math.hypot(nx - tx, ny - ty) });
    }
  }
  let path = [];
  if (end) {
    let k = end.x + "," + end.y;
    while (k !== sx + "," + sy && came.has(k)) {
      let [px, py] = k.split(",").map(Number);
      path.unshift({ x: px + 0.5, y: py + 0.5 });
      k = came.get(k).parent;
    }
    if (!block(x, y)) path.push({ x, y });
  }
  return path;
}
function setTask(e, task) {
  if (task?.kind === "garrison" && e.task?.kind !== "garrison")
    e.previous = e.task ? { ...e.task } : null;
  e.task = task;
  e.path = [];
  e.pathTimer = 0;
  e.work = 0;
  e.moveFail = 0;
  e.loadPoint = null;
  if (task?.target) {
    let a = G.entities.find((a) => a.id === task.target);
    if (a) {
      task.x = a.x;
      task.y = a.y;
    }
  }
}
function go(e, target, dt, stop = 0.8) {
  let d = dist(e, target);
  if (d < stop) {
    e.moving = false;
    return true;
  }
  e.pathTimer = (e.pathTimer || 0) - dt;
  if (
    (!e.path.length && e.pathTimer <= 0) ||
    (e.pathTimer < 0 && e.pathTarget && dist(e.pathTarget, target) > 2)
  ) {
    e.path = pathfind(e, target.x, target.y, target);
    e.pathTimer = 3;
    e.pathTarget = { x: target.x, y: target.y };
  }
  if (!e.path.length) {
    e.moving = false;
    e.moveFail = (e.moveFail || 0) + dt;
    return false;
  }
  let q = e.path[0],
    dd = dist(e, q),
    speed = (U[e.type]?.speed || 1.6) * dt;
  let old = { x: e.x, y: e.y };
  if (dd < speed) {
    e.x = q.x;
    e.y = q.y;
    e.path.shift();
  } else {
    e.x += ((q.x - e.x) / dd) * speed;
    e.y += ((q.y - e.y) / dd) * speed;
  }
  e.dir = Math.atan2(e.y - old.y, e.x - old.x);
  e.moving = true;
  return false;
}
function shore(e, r = 3) {
  let pts = [];
  for (let y = Math.floor(e.y) - r; y <= e.y + r; y++)
    for (let x = Math.floor(e.x) - r; x <= e.x + r; x++)
      if (
        tile(x, y) &&
        !water(x, y) &&
        Math.abs(x - e.x) + Math.abs(y - e.y) < r + 1
      )
        pts.push({ x: x + 0.5, y: y + 0.5 });
  pts.sort((a, b) => dist(a, e) - dist(b, e));
  return pts[0];
}
function boardingPoint(tr, e) {
  let points = [];
  for (let y = Math.floor(tr.y) - 4; y <= tr.y + 4; y++)
    for (let x = Math.floor(tr.x) - 4; x <= tr.x + 4; x++) {
      let p = { x: x + 0.5, y: y + 0.5 };
      if (
        tile(x, y) &&
        !water(x, y) &&
        dist(p, tr) < 4.8 &&
        !blocked(p.x, p.y, e, tr)
      )
        points.push(p);
    }
  points.sort((a, b) => dist(a, e) - dist(b, e));
  return points.find((p) => dist(p, e) < 1 || pathfind(e, p.x, p.y).length);
}
function exitSpot(b, waterUnit = false) {
  let dummy = { ...b, type: waterUnit ? "Galley" : "Villager" };
  for (let r = 1; r < 6; r++)
    for (let i = 0; i < 24; i++) {
      let a = (i * TAU) / 24,
        p = { x: b.x + Math.cos(a) * r, y: b.y + Math.sin(a) * r };
      if (!blocked(p.x, p.y, dummy)) return p;
    }
  return { x: b.x, y: b.y };
}
function damage(e, amount, by) {
  if (e.hp <= 0) return;
  e.hp -= amount;
  e.flash = 0.22;
  if (e.hp <= 0) {
    e.hp = 0;
    e.death = G.time;
    G.effects.push({
      type:
        e.kind === "building"
          ? "collapse"
          : U[e.type]?.water
            ? "splash"
            : "blood",
      x: e.x,
      y: e.y,
      t: 1.4,
      max: 1.4,
    });
    AudioSys.fx("death", 0.25);
    if (e.kind === "animal" && e.type !== "wolf") {
      e.carcass = true;
      e.hp = 0.1;
      e.task = null;
      return;
    }
    if (e.relic) {
      entity("relic", e.x, e.y);
      e.relic = false;
    }
    if (e.relics) {
      for (let j = 0; j < e.relics; j++)
        entity("relic", e.x + j * 0.3, e.y + 1);
      e.relics = 0;
    }
    if (e.occupants?.length) {
      if (U[e.type]?.water && !shore(e, 4)) {
        for (let id of e.occupants) {
          let u = G.entities.find((a) => a.id === id);
          if (u) {
            u.garrison = null;
            damage(u, 99999, e);
          }
        }
        e.occupants = [];
      } else if (U[e.type]?.water) unload(e);
      else ungarrison(e);
    }
    if (e.owner === 0 && e.kind === "building") notify(e.type + " destroyed!");
  }
}
function attack(e, t, dt) {
  let d = U[e.type] || B[e.type] || {},
    p = G.players[e.owner],
    range = d.range || 1.2;
  if (p?.civ === "Britons" && d.role === "archer") range += 2;
  if (
    go(e, t, dt, range + (t.kind === "building" ? B[t.type].size * 0.25 : 0))
  ) {
    e.action = "attack";
    if (e.cool <= 0) {
      let amt = d.atk || 5;
      if (p?.tech.includes("Forging")) amt += 2;
      if (p?.tech.includes("Man-at-Arms") && e.type === "Militia") amt += 3;
      if (p?.tech.includes("Crossbowman") && e.type === "Archer") amt += 3;
      if (p?.tech.includes("War Galley") && e.type === "Galley") amt += 5;
      if (p?.tech.includes("Galleon") && e.type === "Galley") amt += 6;
      if (p?.tech.includes("Paladin") && e.type === "Knight") amt += 5;
      if (d.role === "spear" && U[t.type]?.role === "cavalry") amt *= 4;
      if (d.role === "skirm" && U[t.type]?.role === "archer") amt *= 3;
      if (d.role === "cavalry" && U[t.type]?.role === "archer") amt *= 1.4;
      if (d.role === "siege") amt *= t.kind === "building" ? 2.4 : 0.6;
      if (e.type === "Cataphract" && U[t.type]?.role === "infantry") amt *= 1.8;
      if (d.role === "fire" && p?.civ === "Byzantines") amt *= 1.25;
      let dh = height(e.x, e.y) - height(t.x, t.y);
      amt *= dh > 0 ? 1.25 : dh < 0 ? 0.75 : 1;
      if (p?.tech.includes("Ballistics") && range > 3) amt *= 1.2;
      if (G.players[t.owner]?.tech.includes("Scale Armor") && t.kind === "unit")
        amt = Math.max(1, amt - 2);
      e.cool =
        e.type === "Cobra Car"
          ? 0.18
          : d.role === "fire"
            ? 0.6
            : range > 3
              ? 1.7
              : 1.2;
      if (d.role === "demo") {
        for (let a of G.entities)
          if (a.hp > 0 && hostile(e.owner, a.owner) && dist(e, a) < 3.5)
            damage(a, amt, e);
        damage(e, 9999);
        G.effects.push({ type: "explosion", x: e.x, y: e.y, t: 1, max: 1 });
      } else if (range > 3 || d.role === "fire") {
        G.effects.push({
          type:
            d.role === "fire" ? "fire" : d.role === "siege" ? "rock" : "arrow",
          x: e.x,
          y: e.y,
          tx: t.x,
          ty: t.y,
          t: 0.35,
          max: 0.35,
        });
        damage(t, amt, e);
      } else damage(t, amt, e);
      AudioSys.fx(d.role === "fire" ? "fire" : range > 3 ? "bow" : "hit", 0.14);
      if (t.kind === "animal" && t.type === "boar" && !t.carcass)
        setTask(t, { kind: "attack", target: e.id });
      else if (t.type === "deer" && !t.carcass)
        setTask(t, {
          kind: "move",
          x: clamp(t.x + (t.x - e.x) * 3, 1, G.n - 2),
          y: clamp(t.y + (t.y - e.y) * 3, 1, G.n - 2),
        });
    }
  }
}
function resourceType(t) {
  return t.type === "tree"
    ? "wood"
    : t.type === "gold"
      ? "gold"
      : t.type === "stone"
        ? "stone"
        : "food";
}
function dropoff(e, type) {
  return nearest(
    e,
    (b) =>
      b.owner === e.owner &&
      b.kind === "building" &&
      b.built >= 1 &&
      (b.type === "Town Center" ||
        (type === "wood" && b.type === "Lumber Camp") ||
        (["gold", "stone"].includes(type) && b.type === "Mining Camp") ||
        (type === "food" &&
          ["Mill", "Dock"].includes(b.type) &&
          !!U[e.type]?.water === (b.type === "Dock"))),
  );
}
function garrison(e, b) {
  if (
    !B[b.type]?.cap ||
    !friends(e.owner, b.owner) ||
    b.occupants.length >= B[b.type].cap ||
    e.kind !== "unit" ||
    U[e.type]?.water ||
    U[e.type]?.role === "siege"
  )
    return false;
  if (e.task?.kind !== "garrison") e.previous = e.task ? { ...e.task } : null;
  e.garrison = b.id;
  b.occupants.push(e.id);
  e.task = null;
  e.path = [];
  return true;
}
function ungarrison(b) {
  for (let id of b.occupants) {
    let e = G.entities.find((e) => e.id === id);
    if (e && e.hp > 0) {
      e.garrison = null;
      Object.assign(e, exitSpot(b));
      setTask(e, e.previous || null);
      e.previous = null;
    }
  }
  b.occupants = [];
}
function bell() {
  G.bell = !G.bell;
  for (let e of G.entities.filter(
    (e) => e.owner === 0 && e.type === "Villager" && e.hp > 0,
  )) {
    if (G.bell && !e.garrison) {
      let b = nearest(
        e,
        (b) =>
          b.owner === 0 &&
          B[b.type]?.cap &&
          b.built >= 1 &&
          b.occupants.length < B[b.type].cap,
      );
      if (b) {
        e.bellPrevious = e.task ? { ...e.task } : null;
        setTask(e, { kind: "garrison", target: b.id });
      }
    } else if (!G.bell) {
      if (e.garrison) {
        let b = G.entities.find((b) => b.id === e.garrison);
        if (b) b.occupants = b.occupants.filter((id) => id !== e.id);
        e.garrison = null;
        Object.assign(e, exitSpot(b || e));
      }
      setTask(e, e.bellPrevious || e.previous || null);
      e.bellPrevious = null;
    }
  }
  notify(
    G.bell
      ? "Town Bell: villagers seek shelter."
      : "Town Bell stopped: villagers resume work.",
  );
  updateUI();
}
function commandAt(p, target, forced = null) {
  let speech = "move";
  for (let e of selected.filter((e) => e.owner === 0 && alive(e))) {
    if (e.kind === "building") {
      e.rally = { ...p };
      continue;
    }
    let role = U[e.type]?.role;
    let kind = forced || "move";
    if (!forced && target) {
      if (hostile(e.owner, target.owner)) {
        kind = role === "monk" ? "convert" : "attack";
      } else if (
        role === "worker" &&
        target.kind === "building" &&
        friends(e.owner, target.owner)
      ) {
        kind =
          target.built < 1
            ? "build"
            : target.hp < target.maxHp
              ? "repair"
              : target.type === "Farm"
                ? "gather"
                : B[target.type].cap
                  ? "garrison"
                  : "move";
      } else if (
        role === "worker" &&
        ((target.kind === "resource" && target.type !== "relic") ||
          (target.kind === "animal" && target.type !== "wolf"))
      )
        kind = "gather";
      else if (
        (role === "worker" &&
          target.owner === e.owner &&
          ["Ram", "Mangonel", "Trebuchet"].includes(target.type)) ||
        (role === "worker" &&
          U[target.type]?.water &&
          friends(e.owner, target.owner) &&
          target.hp < target.maxHp)
      )
        kind = "repair";
      else if (role === "fish" && target.type === "fish") kind = "gather";
      else if (role === "monk" && target.type === "relic") kind = "relic";
      else if (
        role === "monk" &&
        friends(e.owner, target.owner) &&
        target.kind === "unit" &&
        !U[target.type]?.water &&
        U[target.type]?.role !== "siege"
      )
        kind = "heal";
      else if (
        role === "monk" &&
        target.type === "Monastery" &&
        target.owner === e.owner &&
        e.relic
      )
        kind = "deposit";
      else if (
        role === "trade" &&
        target.owner !== e.owner &&
        friends(e.owner, target.owner) &&
        target.type === (U[e.type]?.water ? "Dock" : "Market")
      )
        kind = "trade";
      else if (
        target.type === "Transport Ship" &&
        target.owner === e.owner &&
        !U[e.type]?.water
      )
        kind = "load";
    }
    if (e.type === "sheep") kind = "move";
    if (
      kind === "trade" &&
      target &&
      !pathfind(e, target.x, target.y, target).length &&
      dist(e, target) > 2
    ) {
      notify("No valid trade route to that destination.");
      continue;
    }
    let offset =
      kind === "move"
        ? { x: rand(-0.4, 0.4), y: rand(-0.4, 0.4) }
        : { x: 0, y: 0 };
    setTask(e, {
      kind,
      target: target?.id,
      x: p.x + offset.x,
      y: p.y + offset.y,
    });
    speech = ["gather", "build", "attack", "repair", "convert"].includes(kind)
      ? { repair: "build", convert: "attack" }[kind] || kind
      : "move";
  }
  AudioSys.voice(speech);
  commandMode = null;
  G.effects.push({ type: "order", x: p.x, y: p.y, t: 0.7, max: 0.7 });
  updateUI();
}
function tradeStep(e, t, dt) {
  if (!t || !friends(e.owner, t.owner) || t.owner === e.owner) {
    setTask(e, null);
    return;
  }
  let home =
    G.entities.find((a) => a.id === e.tradeHome && a.hp > 0) ||
    nearest(e, (b) => b.owner === e.owner && b.type === t.type && b.built >= 1);
  if (!home) {
    setTask(e, null);
    return;
  }
  e.tradeHome = home.id;
  let dest = e.tradeReturn ? home : t;
  if (go(e, dest, dt, 2)) {
    if (e.tradeReturn) {
      let income = Math.max(5, Math.floor(dist(home, t) * 2.5));
      G.players[e.owner].res.gold += income;
      e.tradeReturn = false;
      e.tradeTrips = (e.tradeTrips || 0) + 1;
      if (e.owner === 0) notify("Trade returned " + income + " gold.");
    } else e.tradeReturn = true;
    e.path = [];
    e.pathTimer = 0;
  }
}
function updateUnit(e, dt) {
  e.cool = Math.max(0, e.cool - dt);
  e.flash = Math.max(0, (e.flash || 0) - dt);
  e.phase += dt;
  e.action = "idle";
  if (e.garrison || e.hp <= 0) return;
  if (e.type === "Berserk") e.hp = Math.min(e.maxHp, e.hp + dt * 0.5);
  let d = U[e.type],
    t =
      e.task &&
      G.entities.find((a) => a.id === e.task.target && a.hp > 0 && !a.garrison);
  if (e.kind === "animal") {
    if (e.carcass) return;
    if (e.type === "sheep") {
      e.capture = (e.capture || 0) - dt;
      if (e.capture <= 0) {
        let guard = nearest(
          e,
          (a) =>
            a.kind === "unit" &&
            a.owner === e.owner &&
            !U[a.type]?.water &&
            dist(e, a) < 3,
        );
        let cap = nearest(
          e,
          (a) =>
            a.kind === "unit" &&
            a.owner >= 0 &&
            !U[a.type]?.water &&
            dist(e, a) < 2.5,
        );
        if (cap && cap.owner !== e.owner && !guard) {
          e.owner = cap.owner;
          e.capture = 5;
          e.task = null;
          if (
            e.owner === 0 &&
            (G.lastSheepNotice === undefined || G.time - G.lastSheepNotice > 2)
          ) {
            G.lastSheepNotice = G.time;
            notify("Sheep discovered! Yours while guarded within 3 tiles.");
          }
        }
      }
    }
    if (e.type === "wolf") {
      let prey = nearest(
        e,
        (a) => a.kind === "unit" && !U[a.type]?.water && dist(e, a) < 4,
      );
      if (prey && !e.task) setTask(e, { kind: "attack", target: prey.id });
    }
    if (e.type === "deer") {
      let danger = nearest(e, (a) => a.kind === "unit" && dist(e, a) < 3);
      if (danger && (!e.task || e.task.kind !== "move"))
        setTask(e, {
          kind: "move",
          x: clamp(e.x + (e.x - danger.x) * 3, 1, G.n - 2),
          y: clamp(e.y + (e.y - danger.y) * 3, 1, G.n - 2),
        });
    }
    if (!e.task && e.type !== "sheep" && Math.random() < dt * 0.05)
      setTask(e, {
        kind: "move",
        x: clamp(e.x + rand(-3, 3), 1, G.n - 2),
        y: clamp(e.y + rand(-3, 3), 1, G.n - 2),
      });
  }
  if (!e.task) {
    if (d?.atk > 0 && d.role !== "worker") {
      let enemy = nearest(
        e,
        (a) => hostile(e.owner, a.owner) && dist(e, a) < (d.range || 1) + 4,
      );
      if (enemy) setTask(e, { kind: "attack", target: enemy.id });
    } else if (d?.role === "monk") {
      let hurt = nearest(
        e,
        (a) =>
          friends(e.owner, a.owner) &&
          a.kind === "unit" &&
          a.hp < a.maxHp &&
          !U[a.type]?.water &&
          U[a.type]?.role !== "siege" &&
          dist(e, a) < 6,
      );
      if (hurt) setTask(e, { kind: "heal", target: hurt.id });
    }
    return;
  }
  t =
    e.task &&
    G.entities.find((a) => a.id === e.task.target && a.hp > 0 && !a.garrison);
  let task = e.task;
  if (
    d &&
    ((["build", "repair", "gather"].includes(task.kind) &&
      d.role !== "worker" &&
      !(task.kind === "gather" && d.role === "fish")) ||
      (["heal", "convert", "relic", "deposit"].includes(task.kind) &&
        d.role !== "monk") ||
      (task.kind === "trade" && d.role !== "trade"))
  ) {
    setTask(e, null);
    return;
  }
  if (task.kind === "move") {
    if (go(e, task, dt, 0.25) || e.moveFail > 5) setTask(e, null);
  } else if (task.kind === "attack") {
    if (
      t &&
      (t.kind === "animal" ||
        hostile(e.owner, t.owner) ||
        (["wolf", "boar"].includes(e.type) && t.kind === "unit"))
    ) {
      attack(e, t, dt);
      if (t.carcass && d?.role === "worker")
        setTask(e, { kind: "gather", target: t.id });
    } else setTask(e, null);
  } else if (task.kind === "gather") {
    if (!t || t.stock <= 0) {
      let next = nearest(
        e,
        (a) =>
          a.stock > 0 &&
          (e.gatherType ? a.type === e.gatherType : a.type === "tree"),
      );
      if (next) setTask(e, { kind: "gather", target: next.id });
      else setTask(e, null);
      return;
    }
    e.gatherType = t.type;
    if (t.kind === "animal" && !t.carcass) {
      attack(e, t, dt);
      return;
    }
    if (t.type === "fish" && d?.role !== "fish") {
      setTask(e, null);
      return;
    }
    if (e.carry >= 12) {
      let b = dropoff(e, e.carryType);
      if (b && go(e, b, dt, 2)) {
        G.players[e.owner].res[e.carryType] += e.carry;
        e.carry = 0;
        e.path = [];
        e.pathTimer = 0;
      }
      return;
    }
    if (go(e, t, dt, t.type === "Farm" ? 1 : 0.9)) {
      e.action =
        t.type === "tree"
          ? "chop"
          : ["gold", "stone"].includes(t.type)
            ? "mine"
            : t.type === "Farm"
              ? "farm"
              : t.type === "fish"
                ? "fish"
                : "gather";
      let p = G.players[e.owner],
        rate = 2.5;
      if (
        (p.tech.includes("Double-bit Axe") && t.type === "tree") ||
        (p.tech.includes("Gold Mining") && ["gold", "stone"].includes(t.type))
      )
        rate *= 1.3;
      if (p.tech.includes("Horse Collar") && t.type === "Farm") rate *= 1.25;
      if (p.civ === "Britons" && t.type === "sheep") rate *= 1.25;
      if (p.civ === "Franks" && t.type === "Farm") rate *= 1.15;
      if (p.civ === "Vikings" && d.role === "fish") rate *= 1.2;
      let amount = Math.min(t.stock, rate * dt);
      t.stock -= amount;
      e.carry += amount;
      e.carryType = resourceType(t);
      if (
        Math.floor(e.phase * 2) !== Math.floor((e.phase - dt) * 2) &&
        e.owner === 0
      )
        AudioSys.fx(e.action, 0.07);
      if (t.stock <= 0) {
        if (t.type === "Farm") t.stock = 550;
        else {
          t.depleted = true;
          if (t.type !== "tree") t.hp = 0;
          if (e.carry) {
            let b = dropoff(e, e.carryType);
            if (b) {
              G.players[e.owner].res[e.carryType] += e.carry;
              e.carry = 0;
            }
          }
        }
      }
    }
  } else if (task.kind === "build") {
    if (!t || t.built >= 1) {
      setTask(e, null);
      return;
    }
    if (go(e, t, dt, B[t.type].size * 0.7 + 1)) {
      e.action = "build";
      t.built = Math.min(1, t.built + dt / 18);
      t.hp = Math.max(t.hp, t.maxHp * t.built);
      if (t.built >= 1) {
        t.hp = t.maxHp;
        if (t.type === "Farm") setTask(e, { kind: "gather", target: t.id });
        else setTask(e, null);
        if (e.owner === 0) notify(t.type + " completed.");
      }
    }
  } else if (task.kind === "repair") {
    if (!t || !friends(e.owner, t.owner) || t.hp >= t.maxHp) {
      setTask(e, null);
      return;
    }
    if (go(e, t, dt, U[t.type]?.water ? 3.5 : 2)) {
      e.action = "build";
      let p = G.players[e.owner],
        r =
          t.kind === "building" && ["Castle", "Tower", "Wall"].includes(t.type)
            ? "stone"
            : "wood";
      if (p.res[r] > dt) {
        p.res[r] -= dt;
        t.hp = Math.min(t.maxHp, t.hp + dt * 18);
      }
    }
  } else if (task.kind === "garrison") {
    if (!t) {
      setTask(e, null);
      return;
    }
    if (go(e, t, dt, 2)) {
      if (!garrison(e, t)) setTask(e, null);
    }
  } else if (task.kind === "heal") {
    if (
      !t ||
      !friends(e.owner, t.owner) ||
      t.hp >= t.maxHp ||
      U[t.type]?.role === "siege" ||
      U[t.type]?.water
    ) {
      setTask(e, null);
      return;
    }
    if (go(e, t, dt, 5)) {
      e.action = "heal";
      t.hp = Math.min(t.maxHp, t.hp + dt * 6);
      if (Math.random() < dt * 3)
        G.effects.push({ type: "heal", x: t.x, y: t.y, t: 0.8, max: 0.8 });
    }
  } else if (task.kind === "convert") {
    if (
      !t ||
      !hostile(e.owner, t.owner) ||
      t.kind !== "unit" ||
      U[t.type]?.water ||
      (U[t.type]?.role === "siege" &&
        !G.players[e.owner].tech.includes("Redemption"))
    ) {
      setTask(e, null);
      return;
    }
    if (go(e, t, dt, 6)) {
      e.action = "heal";
      e.work = (e.work || 0) + dt;
      if (e.cool <= 0 && e.work > 7) {
        t.owner = e.owner;
        t.task = null;
        e.cool = 12;
        e.work = 0;
        setTask(e, null);
        if (e.owner === 0) notify(t.type + " converted!");
      }
    }
  } else if (task.kind === "relic") {
    if (!t) {
      setTask(e, null);
      return;
    }
    if (go(e, t, dt, 1)) {
      t.hp = 0;
      e.relic = true;
      let b = nearest(
        e,
        (b) => b.owner === e.owner && b.type === "Monastery" && b.built >= 1,
      );
      if (b) setTask(e, { kind: "deposit", target: b.id });
      else setTask(e, null);
    }
  } else if (task.kind === "deposit") {
    if (!t || !e.relic) {
      setTask(e, null);
      return;
    }
    if (go(e, t, dt, 2)) {
      t.relics++;
      e.relic = false;
      setTask(e, null);
      if (e.owner === 0) notify("Relic housed: +1 gold per second.");
    }
  } else if (task.kind === "load") {
    if (!t || t.type !== "Transport Ship") {
      setTask(e, null);
      return;
    }
    e.boardRetry = (e.boardRetry || 0) - dt;
    let land = e.loadPoint && dist(e.loadPoint, t) < 5 ? e.loadPoint : null;
    if (!land && e.boardRetry <= 0) {
      land = boardingPoint(t, e);
      e.loadPoint = land;
      e.boardRetry = 3;
    }
    if (land && go(e, land, dt, 1) && dist(e, t) < 5.5) {
      if (t.occupants.length < 12) {
        e.previous = null;
        e.garrison = t.id;
        t.occupants.push(e.id);
        setTask(e, null);
      }
    }
  } else if (task.kind === "trade") tradeStep(e, t, dt);
}
function updateBuilding(b, dt) {
  if (b.hp <= 0) return;
  if (G.instant && b.built < 1) {
    b.built = 1;
    b.hp = b.maxHp;
  }
  if (b.built < 1) return;
  let p = G.players[b.owner];
  if (b.relics) p.res.gold += b.relics * dt;
  if (b.queue.length) {
    let q = b.queue[0];
    q.left -= G.instant ? 9999 : dt;
    if (q.left <= 0) {
      b.queue.shift();
      if (q.kind === "unit") {
        let spot = exitSpot(b, U[q.type]?.water),
          u = entity(q.type, spot.x, spot.y, b.owner);
        if (b.rally) setTask(u, { kind: "move", ...b.rally });
        if (p.ai) aiAssign(u);
      } else if (q.kind === "age") {
        p.age++;
        if (p.id === 0) {
          notify("Your kingdom enters the " + AGE[p.age] + ".");
          AudioSys.fx("age", 0.7);
        }
      } else {
        p.tech.push(q.type);
        let tech = TECH[q.type];
        for (let e of G.entities.filter(
          (e) => e.owner === b.owner && e.hp > 0,
        )) {
          let hp =
            tech.effect === "masonry" && e.kind === "building"
              ? e.maxHp * 0.3
              : tech.effect === "infantry" && e.type === "Militia"
                ? 20
                : tech.effect === "archer" && e.type === "Archer"
                  ? 10
                  : tech.effect === "galley" && e.type === "Galley"
                    ? 40
                    : tech.effect === "galleon" && e.type === "Galley"
                      ? 60
                      : tech.effect === "sanctity" && e.type === "Monk"
                        ? 20
                        : tech.effect === "paladin" && e.type === "Knight"
                          ? 50
                          : tech.effect === "spear" && e.type === "Spearman"
                            ? 20
                            : 0;
          e.maxHp += hp;
          e.hp += hp;
        }
        if (p.id === 0) notify(q.type + " researched.");
      }
      updateUI();
    }
  }
  if (B[b.type].atk) {
    b.cool = (b.cool || 0) - dt;
    let t = nearest(
      b,
      (e) => hostile(b.owner, e.owner) && dist(b, e) < B[b.type].range,
    );
    if (t && b.cool <= 0) {
      let amt = B[b.type].atk + b.occupants.length * 2;
      amt *=
        height(b.x, b.y) > height(t.x, t.y)
          ? 1.25
          : height(b.x, b.y) < height(t.x, t.y)
            ? 0.75
            : 1;
      damage(t, amt, b);
      b.cool = 1.6;
      G.effects.push({
        type: "arrow",
        x: b.x,
        y: b.y,
        tx: t.x,
        ty: t.y,
        t: 0.35,
        max: 0.35,
      });
    }
  }
}
function aiAssign(e) {
  if (e.type === "Villager") {
    let p = G.players[e.owner],
      resources = ["tree", "berry", "gold", "stone"],
      workers = G.entities.filter(
        (a) => a.owner === e.owner && a.type === "Villager",
      ).length;
    let type = resources[workers % 4];
    let t = nearest(e, (a) => a.stock > 0 && a.type === type);
    if (t) setTask(e, { kind: "gather", target: t.id });
  }
  if (e.type === "Fishing Ship") {
    let t = nearest(e, (a) => a.type === "fish" && a.stock > 0);
    if (t) setTask(e, { kind: "gather", target: t.id });
  }
}
function aiBuild(p, type) {
  if (
    G.entities.filter(
      (e) =>
        e.owner === p.id && e.kind === "building" && e.hp > 0 && e.built < 1,
    ).length >= 2
  )
    return;
  let tc = G.entities.find(
    (e) => e.owner === p.id && e.type === "Town Center" && e.hp > 0,
  );
  if (!tc) return;
  let pt = null;
  if (type === "Dock") {
    let spots = [];
    for (let y = 0; y < G.n; y++)
      for (let x = 0; x < G.n; x++)
        if (
          water(x, y) &&
          shore({ x: x + 0.5, y: y + 0.5 }, 2) &&
          dist(tc, { x, y }) < 18 &&
          !validSite(type, x + 0.5, y + 0.5)
        )
          spots.push({ x: x + 0.5, y: y + 0.5 });
    spots.sort((a, b) => dist(tc, a) - dist(tc, b));
    let v = nearest(tc, (e) => e.owner === p.id && e.type === "Villager");
    pt = spots.slice(0, 16).find((q) => v && boardingPoint(q, v));
  } else
    for (let i = 0; i < 40 && !pt; i++) {
      let a = rand(0, TAU),
        r = rand(4, 9),
        q = { x: tc.x + Math.cos(a) * r, y: tc.y + Math.sin(a) * r };
      if (
        !validSite(type, q.x, q.y) &&
        G.entities.some(
          (v) =>
            v.owner === p.id &&
            v.type === "Villager" &&
            v.hp > 0 &&
            pathfind(v, q.x, q.y).length,
        )
      )
        pt = q;
    }
  if (!pt) return;
  let b = construct(type, pt.x, pt.y, p.id);
  let v = nearest(
    b || tc,
    (e) =>
      e.owner === p.id &&
      e.type === "Villager" &&
      !e.garrison &&
      e.task?.kind !== "build",
  );
  if (b && v) setTask(v, { kind: "build", target: b.id });
}
function aiUpdate(p) {
  let ents = G.entities.filter((e) => e.owner === p.id && e.hp > 0),
    tc = ents.find((e) => e.type === "Town Center");
  if (!tc) {
    p.defeated = true;
    return;
  }
  let difficulty = G.settings.difficulty,
    bonus = difficulty === "hard" ? 1.7 : difficulty === "easy" ? 0.7 : 1;
  for (let k in p.res) p.res[k] += bonus * 5;
  let workers = ents.filter((e) => e.type === "Villager");
  for (let e of workers) if (!e.task && !e.garrison) aiAssign(e);
  if (p.res.wood < 250) {
    let woodworkers = workers.filter(
      (v) =>
        v.task?.kind === "gather" &&
        G.entities.find((t) => t.id === v.task.target)?.type === "tree",
    );
    for (let v of workers
      .filter((v) => v.task?.kind !== "build" && !v.garrison)
      .slice(0, Math.max(0, 5 - woodworkers.length))) {
      let tree = reachableResource(v, "tree");
      if (tree) setTask(v, { kind: "gather", target: tree.id });
    }
  }
  for (let b of ents.filter((e) => e.kind === "building" && e.built < 1)) {
    if (
      !workers.some((v) => v.task?.kind === "build" && v.task.target === b.id)
    ) {
      let v = nearest(
        b,
        (e) =>
          e.owner === p.id &&
          e.type === "Villager" &&
          e.task?.kind !== "build" &&
          !e.garrison,
      );
      if (v) setTask(v, { kind: "build", target: b.id });
    }
  }
  if (workers.length < 14 && tc.queue.length < 2) queue(tc, "Villager");
  if (
    population(p.id) > popcap(p.id) - 4 &&
    !ents.some((e) => e.type === "House" && e.built < 1)
  )
    aiBuild(p, "House");
  if (
    p.age < 3 &&
    workers.length >= 7 &&
    G.time > (p.age + 1) * (difficulty === "easy" ? 100 : 60) &&
    !tc.queue.some((q) => q.kind === "age")
  )
    queue(tc, "advance", "age");
  let desired = [
    "Lumber Camp",
    "Mill",
    "Mining Camp",
    "Barracks",
    ...(G.settings.map !== "land" ? ["Dock"] : []),
    ...(p.age >= 1 ? ["Archery Range", "Stable", "Market"] : []),
    ...(p.age >= 2
      ? ["Blacksmith", "Monastery", "Siege Workshop", "Castle"]
      : []),
  ];
  let missing = desired.find((t) => !ents.some((e) => e.type === t));
  if (missing) aiBuild(p, missing);
  for (let b of ents
    .filter((e) => e.kind === "building" && e.built >= 1 && e.queue.length < 2)
    .sort(
      (a, b) => (a.type === "Dock" ? -1 : 0) - (b.type === "Dock" ? -1 : 0),
    )) {
    let type =
      b.type === "Barracks"
        ? p.age
          ? "Spearman"
          : "Militia"
        : b.type === "Archery Range"
          ? "Archer"
          : b.type === "Stable"
            ? p.age >= 2
              ? "Knight"
              : "Scout"
            : b.type === "Castle"
              ? CIV[p.civ].unique
              : b.type === "Siege Workshop"
                ? "Ram"
                : b.type === "Monastery" &&
                    ents.filter((e) => e.type === "Monk").length < 2
                  ? "Monk"
                  : null;
    if (b.type === "Dock") {
      let fish = ents.filter((e) => e.type === "Fishing Ship").length;
      type =
        fish < 3
          ? "Fishing Ship"
          : p.age && ents.filter((e) => e.type === "Transport Ship").length < 1
            ? "Transport Ship"
            : p.age >= 2
              ? Math.random() < 0.3
                ? "Fire Ship"
                : "Galley"
              : p.age
                ? "Galley"
                : null;
    }
    if (type) queue(b, type);
    if (G.time > 180 && b.queue.length === 0) {
      let tech = Object.entries(TECH).find(
        ([name, d]) =>
          d.at === b.type &&
          !p.tech.includes(name) &&
          !prerequisites(p, d) &&
          canPay(p, d.cost),
      );
      if (tech) queue(b, tech[0], "tech");
    }
    if (b.type === "Monastery")
      for (let m of ents.filter((e) => e.type === "Monk" && !e.task)) {
        let relic = nearest(m, (e) => e.type === "relic");
        if (relic) setTask(m, { kind: "relic", target: relic.id });
        else {
          let enemy = nearest(
            m,
            (e) =>
              hostile(p.id, e.owner) &&
              e.kind === "unit" &&
              !U[e.type]?.water &&
              dist(m, e) < 8,
          );
          if (enemy && m.cool <= 0)
            setTask(m, { kind: "convert", target: enemy.id });
        }
      }
    if (b.type === "Market" || b.type === "Dock") {
      let friend = G.entities.find(
        (e) =>
          e.kind === "building" &&
          e.type === b.type &&
          e.owner !== p.id &&
          friends(e.owner, p.id) &&
          e.hp > 0,
      );
      if (
        friend &&
        !ents.some(
          (e) => e.type === (b.type === "Dock" ? "Trade Cog" : "Trade Cart"),
        )
      )
        queue(b, b.type === "Dock" ? "Trade Cog" : "Trade Cart");
      for (let u of ents.filter((e) => U[e.type]?.role === "trade" && !e.task))
        if (friend) setTask(u, { kind: "trade", target: friend.id });
    }
  }
  let enemy = G.players.find((q) => hostile(p.id, q.id) && !q.defeated),
    target =
      enemy &&
      G.entities.find(
        (e) => e.owner === enemy.id && e.type === "Town Center" && e.hp > 0,
      );
  if (!target) return;
  let army = ents.filter(
    (e) =>
      e.kind === "unit" &&
      U[e.type]?.atk > 0 &&
      e.type !== "Villager" &&
      !U[e.type]?.water &&
      !e.garrison,
  );
  if (G.time > (difficulty === "easy" ? 240 : 130) && army.length >= 4) {
    for (let u of army)
      if (!u.task || u.task.kind === "gather") {
        let path = pathfind(u, target.x, target.y, target);
        if (path.length) setTask(u, { kind: "attack", target: target.id });
        else {
          let tr = ents.find(
            (e) => e.type === "Transport Ship" && e.occupants.length < 10,
          );
          if (tr && !tr.transportSailing) {
            let sh = shore(tr, 4);
            if (sh) {
              setTask(tr, { kind: "move", x: tr.x, y: tr.y });
              setTask(u, { kind: "load", target: tr.id });
            }
          }
        }
      }
  }
  for (let tr of ents.filter((e) => e.type === "Transport Ship")) {
    if (tr.occupants.length >= 3 && !tr.transportSailing) {
      let coast = [];
      for (let y = 0; y < G.n; y++)
        for (let x = 0; x < G.n; x++)
          if (water(x, y) && shore({ x: x + 0.5, y: y + 0.5 }, 2))
            coast.push({ x: x + 0.5, y: y + 0.5 });
      coast.sort((a, b) => dist(a, target) - dist(b, target));
      let dest = coast.find((q) => pathfind(tr, q.x, q.y).length);
      if (dest) {
        tr.transportSailing = true;
        setTask(tr, { kind: "move", ...dest });
        tr.landing = dest;
      }
    }
    if (tr.transportSailing && tr.landing && dist(tr, tr.landing) < 1) {
      unload(tr);
      tr.transportSailing = false;
      for (let u of army)
        if (!u.garrison) setTask(u, { kind: "attack", target: target.id });
    }
  }
  for (let ship of ents.filter((e) =>
    ["warship", "fire", "demo"].includes(U[e.type]?.role),
  )) {
    let navy = nearest(
      ship,
      (e) => hostile(p.id, e.owner) && (U[e.type]?.water || e.type === "Dock"),
    );
    if (navy) setTask(ship, { kind: "attack", target: navy.id });
    else {
      let coast = nearest(
        ship,
        (e) => hostile(p.id, e.owner) && e.kind === "building" && shore(e, 3),
      );
      if (coast) setTask(ship, { kind: "attack", target: coast.id });
    }
  }
}
function unload(tr) {
  let s = shore(tr, 4);
  if (!s) {
    notify("Move within four tiles of land to unload.");
    return false;
  }
  tr.landedCount = (tr.landedCount || 0) + tr.occupants.length;
  for (let id of tr.occupants) {
    let e = G.entities.find((e) => e.id === id);
    if (e && e.hp > 0) {
      e.garrison = null;
      let spot = exitSpot({ ...s, owner: tr.owner, type: "House" });
      e.x = spot.x;
      e.y = spot.y;
      setTask(e, null);
    }
  }
  tr.occupants = [];
  if (tr.owner === 0) notify("Transport unloaded on the shore.");
  return true;
}
function updateVisibility() {
  if (!G) return;
  G.visible = Array.from({ length: G.n }, () => Array(G.n).fill(false));
  for (let e of G.entities)
    if (e.hp > 0 && friends(0, e.owner) && !e.garrison) {
      let r = e.kind === "building" ? 8 : e.type === "Scout" ? 9 : 6;
      for (
        let y = Math.max(0, Math.floor(e.y - r));
        y < Math.min(G.n, e.y + r);
        y++
      )
        for (
          let x = Math.max(0, Math.floor(e.x - r));
          x < Math.min(G.n, e.x + r);
          x++
        )
          if (Math.hypot(x - e.x, y - e.y) < r) {
            G.visible[y][x] = true;
            G.revealed[y][x] = true;
          }
    }
}
function tick(dt) {
  G.time += dt;
  for (let e of [...G.entities])
    if (e.kind === "building") updateBuilding(e, dt);
    else if (e.kind === "unit" || e.kind === "animal") updateUnit(e, dt);
  G.effects = G.effects.filter((e) => (e.t -= dt) > 0);
  G.aiTick += dt;
  if (G.aiTick > 3) {
    G.aiTick = 0;
    for (let p of G.players.filter((p) => p.ai && !p.defeated)) aiUpdate(p);
    updateVisibility();
    if (G.time > 10) {
      for (let p of G.players)
        if (
          !G.entities.some(
            (e) => e.owner === p.id && e.hp > 0 && e.type === "Town Center",
          )
        )
          p.defeated = true;
      if (G.players[0].defeated && !G.won) {
        G.won = true;
        notify("Your Town Centers have fallen. Your chronicle ends.");
        $("#objectiveText").textContent =
          "Defeat · Restart from the menu to try again.";
      } else if (
        G.players.filter((p) => hostile(0, p.id) && !p.defeated).length === 0 &&
        !G.won
      ) {
        G.won = true;
        notify("Victory! All hostile kingdoms have fallen or made peace.");
        $("#objectiveText").textContent =
          "Victory · Your kingdom prevails. You may keep playing.";
      }
    }
  }
}
// Hand-painted isometric primitives. Every game object is rendered from editable code.
function poly(c, points, fill, stroke = null) {
  c.beginPath();
  points.forEach((p, i) => (i ? c.lineTo(...p) : c.moveTo(...p)));
  c.closePath();
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = 0.7;
    c.stroke();
  }
}
function ellipse(c, x, y, rx, ry, fill) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, TAU);
  c.fillStyle = fill;
  c.fill();
}
function line(c, x, y, x2, y2, color, width = 1) {
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x2, y2);
  c.strokeStyle = color;
  c.lineWidth = width;
  c.stroke();
}
function box(
  c,
  x,
  y,
  w,
  d,
  h,
  front = "#c3b495",
  side = "#91856d",
  roof = "#ddd0ad",
) {
  poly(
    c,
    [
      [x, y],
      [x + w, y + d * 0.5],
      [x + w, y + d * 0.5 - h],
      [x, y - h],
    ],
    front,
    "#514d3e",
  );
  poly(
    c,
    [
      [x, y],
      [x - d, y + d * 0.5],
      [x - d, y + d * 0.5 - h],
      [x, y - h],
    ],
    side,
    "#514d3e",
  );
  poly(
    c,
    [
      [x, y - h],
      [x + w, y + d * 0.5 - h],
      [x + w - d, y - h],
      [x - d, y + d * 0.5 - h],
    ],
    roof,
    "#514d3e",
  );
}
function roof(c, x, y, w, d, h, col = "#a3573e") {
  poly(
    c,
    [
      [x - d, y + d * 0.5],
      [x, y - h],
      [x + w, y + d * 0.5],
    ],
    col,
    "#543d32",
  );
  poly(
    c,
    [
      [x + w, y + d * 0.5],
      [x, y - h],
      [x + w - d, y - h - d * 0.5],
      [x + w - d, y],
    ],
    "#754638",
    "#543d32",
  );
  for (let i = 1; i < 5; i++)
    line(
      c,
      x - d + (i * (w + d)) / 5,
      y + d * 0.5,
      x + (i * w) / 5,
      y - h + i * d * 0.1,
      "#ce8b5a88",
      0.6,
    );
}
function flag(c, x, y, color, t = 0) {
  line(c, x, y, x, y - 23, "#67513b", 1.5);
  poly(
    c,
    [
      [x, y - 23],
      [x + 13, y - 22 + Math.sin(t) * 2],
      [x + 12, y - 13],
      [x, y - 15],
    ],
    color,
    "#e8d7a088",
  );
}
function treeArt(c, x, y, v = 0, t = 0, depleted = false) {
  ellipse(c, x, y + 3, 14, 6, "#182d1c55");
  if (depleted) {
    box(c, x, y, 3, 3, 4, "#997953", "#65503b", "#b69a64");
    line(c, x + 4, y, x + 12, y + 4, "#6d553b", 3);
    return;
  }
  line(c, x, y + 2, x + Math.sin(t) * 1.2, y - 25, "#6e6144", 5);
  line(c, x, y - 13, x - 7, y - 27, "#6e6144", 2);
  if (v === 2) {
    for (let j = 0; j < 3; j++)
      poly(
        c,
        [
          [x - 15 + j * 3, y - 12 - j * 10],
          [x + Math.sin(t) * 2, y - 43 - j * 4],
          [x + 15 - j * 3, y - 12 - j * 10],
        ],
        ["#355b3d", "#447647", "#5a8550"][j],
        "#294d32",
      );
  } else {
    ellipse(c, x - 8, y - 25, 12, 13, "#365e3c");
    ellipse(c, x + 7, y - 29, 14, 14, "#487447");
    ellipse(c, x - 2, y - 38, 13, 12, v === 1 ? "#7d9053" : "#61854c");
    ellipse(c, x + 3, y - 37, 8, 7, "#84a45f77");
    ellipse(c, x - 10, y - 26, 6, 5, "#8baa6055");
  }
}
function buildingArt(c, e, x, y, s = 1, preview = false) {
  let type = e.type,
    p = G?.players[e.owner],
    col = p?.color || "#4fa9ec",
    age = p?.age || 0,
    t = G?.time || 0;
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  let w = B[type]?.size * 13 || 22;
  ellipse(c, 0, 8, w + 9, w * 0.4, "#13271855");
  if (e.built < 1 && !preview) {
    let a = e.built;
    poly(
      c,
      [
        [-w, 0],
        [0, -w * 0.5],
        [w, 0],
        [0, w * 0.5],
      ],
      "#9e896055",
      "#b5a674",
    );
    for (let i = -1; i <= 1; i++) {
      line(c, i * w * 0.6, 8, i * w * 0.6, -12 - a * 30, "#8c7650", 3);
      line(c, -w, 5 - i * 8, w, -i * 8, "#b79b67", 2);
    }
    if (a < 0.5) {
      box(c, -7, 2, 7, 6, 4, "#b79d74", "#8b7653", "#c8af7c");
      c.restore();
      return;
    }
    c.globalAlpha = 0.65;
  }
  if (type === "Farm") {
    poly(
      c,
      [
        [-25, 0],
        [0, -12],
        [25, 0],
        [0, 12],
      ],
      "#806d3d",
      "#a9a165",
    );
    for (let j = -4; j <= 4; j++) {
      line(c, j * 4 - 12, 5 - j * 2, j * 4 + 10, -6 - j * 2, "#4f5730", 2);
      for (let k = 0; k < 4; k++) {
        let xx = j * 4 - 10 + k * 6,
          yy = 4 - j * 2 - k * 3;
        line(c, xx, yy, xx, yy - 5, "#aeb65c", 1);
        ellipse(c, xx, yy - 5, 2, 1, "#d2c077");
      }
    }
    c.restore();
    return;
  }
  if (type === "Wall" || type === "Gate") {
    box(
      c,
      0,
      4,
      type === "Gate" ? 19 : 12,
      11,
      19,
      "#b0b5a0",
      "#858f7d",
      "#d1d0b1",
    );
    for (let i = 0; i < 4; i++)
      box(c, 3 + i * 4, -15, 2, 3, 4, "#d1cfb2", "#87917e", "#e1d5b6");
    if (type === "Gate") {
      poly(
        c,
        [
          [3, 12],
          [15, 18],
          [15, 0],
          [9, -6],
          [3, -3],
        ],
        "#403d2e",
      );
      line(c, 8, -3, 8, 14, "#948063", 2);
    }
    c.restore();
    return;
  }
  if (["Tower", "Castle", "Town Center"].includes(type)) {
    if (type === "Town Center") {
      box(
        c,
        0,
        3,
        28,
        25,
        22,
        age > 1 ? "#d0c4a3" : "#c7b695",
        "#8e9278",
        "#e3d3a8",
      );
      roof(c, 0, -19, 28, 25, 18, age > 1 ? "#73818b" : "#ad6645");
      box(c, -20, 8, 10, 10, 18, "#bdb99b", "#808b72", "#dcc7a2");
      roof(c, -20, -10, 10, 10, 11);
      box(c, 18, 13, 12, 10, 20, "#cfbc98", "#928c72", "#d7c2a0");
      roof(c, 18, -7, 12, 10, 12);
      for (let i = 0; i < 3; i++) {
        line(c, 4 + i * 8, 7 + i * 4, 4 + i * 8, -12 + i * 4, "#675c46", 2);
        poly(
          c,
          [
            [7 + i * 8, -5 + i * 4],
            [11 + i * 8, -3 + i * 4],
            [11 + i * 8, 4 + i * 4],
            [7 + i * 8, 2 + i * 4],
          ],
          "#344f4c",
        );
      }
      poly(
        c,
        [
          [-10, 8],
          [-2, 12],
          [-2, -4],
          [-6, -7],
          [-10, -6],
        ],
        "#3e493a",
      );
      flag(c, 10, -27, col, t * 3);
      line(c, -34, 12, 32, 24, "#9b8660", 3);
      for (let i = -3; i <= 3; i++)
        line(c, i * 9, 19 + i * 2, i * 9, 9 + i * 2, "#997d53", 2);
    } else {
      let castle = type === "Castle";
      if (castle) {
        box(c, 0, 6, 28, 24, 27, "#c7c9b0", "#899b8d", "#d9d4b7");
        poly(
          c,
          [
            [1, 9],
            [12, 15],
            [12, -3],
            [7, -9],
            [1, -6],
          ],
          "#34453e",
        );
        box(c, 11, -21, 10, 10, 20, "#d0ceb1", "#91a18d", "#dfd8b9");
        roof(c, 11, -41, 10, 10, 10, "#687d87");
      }
      let towers = castle
        ? [
            [-22, 6],
            [23, 17],
            [0, -9],
          ]
        : [[0, 7]];
      for (let [xx, yy] of towers) {
        box(
          c,
          xx,
          yy,
          12,
          11,
          castle ? 35 : 42,
          "#c2c8ad",
          "#8d9c88",
          "#dcd8b5",
        );
        for (let j = 0; j < 3; j++) {
          box(
            c,
            xx + j * 4,
            yy - (castle ? 35 : 42) + j * 2,
            2,
            3,
            5,
            "#d7d4b7",
            "#9aab92",
            "#e8dcbb",
          );
        }
        poly(
          c,
          [
            [xx + 4, yy - 19],
            [xx + 7, yy - 17],
            [xx + 7, yy - 27],
            [xx + 4, yy - 29],
          ],
          "#42544a",
        );
        line(c, xx - 9, yy - 21, xx, yy - 25, col, 4);
      }
      flag(c, castle ? 17 : 7, castle ? -42 : -38, col, t * 3);
    }
  } else if (type === "Dock") {
    poly(
      c,
      [
        [-35, 5],
        [0, -14],
        [37, 6],
        [0, 23],
      ],
      "#817859",
      "#494e3c",
    );
    for (let i = -3; i <= 3; i++)
      line(c, i * 8 - 15, 10 - i * 4, i * 8 + 16, -6 - i * 4, "#a9986c", 2);
    box(c, -2, 1, 19, 17, 17, "#c9b594", "#7e8870", "#c8b28e");
    roof(c, -2, -16, 19, 17, 15);
    line(c, -28, 7, -28, -8, "#625d43", 3);
    line(c, 27, 8, 27, -10, "#625d43", 3);
    ellipse(c, 23, 5, 4, 5, "#b89960");
    flag(c, 9, -24, col, t * 3);
  } else if (type === "Monastery") {
    box(c, 0, 8, 27, 22, 27, "#d6cbb1", "#9da68f", "#e8d8b8");
    roof(c, 0, -19, 27, 22, 19, "#75858b");
    box(c, -10, 0, 10, 10, 48, "#ccc9af", "#8fa18f", "#e2d3b3");
    roof(c, -10, -48, 10, 10, 13, "#70818d");
    line(c, -6, -61, -6, -73, "#d1b877", 2);
    line(c, -11, -68, -1, -68, "#d1b877", 2);
    for (let i = 0; i < 3; i++) {
      poly(
        c,
        [
          [4 + i * 7, -4 + i * 4],
          [8 + i * 7, -2 + i * 4],
          [8 + i * 7, -11 + i * 4],
          [6 + i * 7, -14 + i * 4],
          [4 + i * 7, -13 + i * 4],
        ],
        "#547d8a",
      );
      line(c, 6 + i * 7, -12 + i * 4, 6 + i * 7, -3 + i * 4, "#cab879");
    }
    flag(c, 20, -18, col, t);
  } else if (type === "Mill") {
    box(c, 0, 8, 18, 18, 19, "#d0c49d", "#9e9e79", "#e2d0a6");
    roof(c, 0, -11, 18, 18, 15);
    box(c, -2, -10, 8, 8, 25, "#b3b794", "#8f9673", "#d9c89e");
    roof(c, -2, -35, 8, 8, 12);
    c.save();
    c.translate(5, -28);
    c.rotate(t * 0.6);
    for (let i = 0; i < 4; i++) {
      c.rotate(Math.PI / 2);
      poly(
        c,
        [
          [1, 2],
          [4, 2],
          [5, 23],
          [-2, 21],
        ],
        "#e0d3b3",
        "#7d7254",
      );
      for (let j = 5; j < 21; j += 4) line(c, -1, j, 5, j, "#9f9371");
    }
    c.restore();
    flag(c, 14, -12, col, t);
  } else {
    let tall = [
        "University",
        "Market",
        "Barracks",
        "Stable",
        "Siege Workshop",
        "Archery Range",
      ].includes(type),
      ww = tall ? 25 : 16,
      dd = tall ? 20 : 15;
    box(c, 0, 9, ww, dd, tall ? 23 : 16, "#c9bb97", "#909d79", "#d9c8a4");
    roof(
      c,
      0,
      tall ? -14 : -7,
      ww,
      dd,
      tall ? 20 : 14,
      age >= 2 ? "#697c80" : "#a96543",
    );
    for (let i = 0; i < 3; i++)
      line(c, 3 + i * 7, 10 + i * 3, 3 + i * 7, -9 + i * 3, "#665c42", 2);
    poly(
      c,
      [
        [4, 11],
        [13, 15],
        [13, 0],
        [8, -5],
        [4, -3],
      ],
      "#354b3c",
    );
    flag(c, ww - 5, -20, col, t * 2);
    if (type === "Blacksmith") {
      box(c, -15, 8, 8, 8, 9, "#7b8171", "#4b5d52", "#a6b094");
      ellipse(c, -13, 5, 4, 2, "#efb151");
      for (let i = 0; i < 3; i++)
        ellipse(
          c,
          -10 + Math.sin(t + i) * 3,
          -20 - i * 8,
          4 + i,
          3 + i,
          "#9bac9a44",
        );
    }
    if (type === "Lumber Camp") {
      for (let i = 0; i < 4; i++) {
        line(c, -23 + i * 4, 6, -7 + i * 4, 13, "#8b6b43", 5);
        ellipse(c, -23 + i * 4, 6, 2, 3, "#c7a976");
      }
    }
    if (type === "Mining Camp") {
      poly(
        c,
        [
          [-22, 13],
          [-18, 1],
          [-8, 8],
          [-5, 17],
        ],
        "#9c9e83",
      );
      line(c, -14, 8, -22, -4, "#715d3f", 2);
    }
    if (type === "Archery Range") {
      ellipse(c, -17, 5, 7, 10, "#c2b98c");
      ellipse(c, -17, 5, 4, 6, col);
      ellipse(c, -17, 5, 1.5, 2, "#d8cab0");
    }
    if (type === "Market") {
      poly(
        c,
        [
          [-25, 3],
          [-9, -6],
          [7, 3],
          [-9, 12],
        ],
        col,
      );
      for (let j = 0; j < 3; j++) {
        ellipse(
          c,
          -19 + j * 8,
          13 + j * 2,
          3,
          2,
          ["#d2b74f", "#a86746", "#819b52"][j],
        );
      }
    }
    if (type === "Stable") {
      animalArt(c, { type: "horse", phase: t, owner: e.owner }, -18, 17, 0.75);
    }
    if (type === "Siege Workshop") {
      line(c, -21, 15, -9, 20, "#795f40", 4);
      ellipse(c, -20, 18, 4, 5, "#6f644c");
      ellipse(c, -8, 23, 4, 5, "#6f644c");
      line(c, -15, 17, -16, 1, "#9d8155", 3);
    }
  }
  if (
    ["Town Center", "Monastery", "Castle", "Tower", "University"].includes(type)
  ) {
    for (let j = 0; j < 5; j++) {
      let yy = 7 - j * 5;
      line(c, 1, yy, w * 0.85, yy + w * 0.32, "#5b6e4b28", 0.65);
      for (let i = 0; i < 3; i++)
        line(
          c,
          4 + i * 7 + (j % 2) * 3,
          yy + 2 + i * 2,
          4 + i * 7 + (j % 2) * 3,
          yy - 2 + i * 2,
          "#5b6e4b25",
          0.65,
        );
    }
  } else if (!["Farm", "Dock", "Wall", "Gate"].includes(type)) {
    line(c, -12, -6, -12, 12, "#65563e", 1.5);
    line(c, -12, 8, -3, 0, "#66573e", 1.2);
    line(c, 15, 16, 15, 2, "#67563e", 1.5);
  }
  if (e.hp < e.maxHp * 0.55 && e.built >= 1) {
    for (let i = 0; i < 3; i++) {
      ellipse(
        c,
        -7 + i * 13,
        5 - i * 4,
        3 + Math.sin(t * 9 + i) * 2,
        7,
        "#e69a3888",
      );
      ellipse(c, -7 + i * 13, 1 - i * 4, 2, 5, "#e8c465");
    }
  }
  c.restore();
}
function animalArt(c, e, x, y, s = 1) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  let t = e.phase || 0,
    walk = e.moving ? Math.sin(t * 10) * 3 : 0,
    col =
      e.type === "sheep"
        ? "#e6dfc1"
        : e.type === "boar"
          ? "#695747"
          : e.type === "wolf"
            ? "#8b9886"
            : "#b2915d";
  ellipse(c, 0, 3, 10, 4, "#18321f55");
  if (e.carcass) {
    ellipse(c, 0, 0, 9, 4, col);
    line(c, -4, 1, 6, 3, "#8c4e3d", 2);
    c.restore();
    return;
  }
  for (let i = 0; i < 4; i++)
    line(
      c,
      -6 + i * 4,
      -1,
      -6 + i * 4 + walk * (i % 2 ? 1 : -1),
      7,
      col === "e6dfc1" ? "#847b5b" : "#69583f",
      2,
    );
  ellipse(
    c,
    0,
    -3,
    e.type === "horse" ? 12 : 9,
    e.type === "sheep" ? 7 : 5,
    col,
  );
  ellipse(c, 9, -7, 4, 4, col);
  line(c, 7, -8, 5, -15, col, 3);
  ellipse(c, 11, -8, 1, 1, "#26372d");
  if (e.type === "deer") {
    line(c, 8, -10, 9, -20, "#735f40", 1.2);
    line(c, 9, -17, 13, -21, "#735f40");
    line(c, 9, -16, 5, -19, "#735f40");
  }
  if (e.type === "sheep" && e.owner >= 0) {
    c.fillStyle = G.players[e.owner].color;
    c.fillRect(-4, -8, 6, 5);
  }
  if (e.type === "boar") {
    line(c, 11, -4, 14, -6, "#dfccb1", 2);
  }
  if (e.type === "wolf")
    poly(
      c,
      [
        [5, -10],
        [7, -17],
        [10, -10],
      ],
      col,
    );
  c.restore();
}
function unitArt(c, e, x, y, s = 1) {
  let d = U[e.type] || {},
    p = G?.players[e.owner],
    color = p?.color || "#6797b0",
    t = e.phase || 0,
    walk = e.moving ? Math.sin(t * 11) : 0,
    action = e.action || "idle",
    swing = Math.sin(t * 10);
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  if (U[e.type]?.water) {
    let w = e.type === "Transport Ship" ? 24 : 18;
    ellipse(c, 0, 5, w + 5, 8, "#112f3f44");
    for (let j = 0; j < 3; j++)
      line(c, -w - 4, 8 + j * 3, w + 4, 8 + j * 3, "#b5d5c13b", 0.8);
    poly(
      c,
      [
        [-w, -1],
        [-w + 4, 7],
        [0, 13],
        [w, 4],
        [w + 5, -5],
        [3, 2],
      ],
      "#634f35",
      "#2c4037",
    );
    poly(
      c,
      [
        [-w, -1],
        [2, -9],
        [w + 5, -5],
        [3, 2],
      ],
      "#b4a074",
      "#514a37",
    );
    line(c, -8, -2, -8, -36, "#786447", 2);
    poly(
      c,
      [
        [-7, -34],
        [-7, -7],
        [14, -17 + Math.sin(t * 3)],
      ],
      e.type === "Fishing Ship" ? "#cfd2b1" : color,
      "#e8d9af",
    );
    line(c, -8, -36, 10, -29, "#bcb390");
    if (e.type === "Galley" || e.type === "Fire Ship") {
      for (let j = 0; j < 5; j++) {
        let off = e.moving ? Math.sin(t * 5 + j) * 3 : 0;
        line(
          c,
          -13 + j * 6,
          8 - j * 2,
          -23 + j * 6 + off,
          15 - j * 2,
          "#b5aa7e",
          1.5,
        );
      }
      box(c, 8, 1, 5, 6, 5, "#928468", "#605f4a", "#bfb18a");
    }
    if (e.type === "Demolition Ship")
      for (let j = 0; j < 3; j++) ellipse(c, -10 + j * 7, -1, 4, 4, "#8f6749");
    if (e.type === "Fishing Ship") {
      line(c, 11, 0, 19, -12, "#aaa57d", 1);
      line(c, 19, -12, 25, 6, "#d4d4b1", 0.6);
      if (action === "fish")
        poly(
          c,
          [
            [15, 5],
            [27, 5],
            [21, 16],
          ],
          "#c0d4b655",
        );
    }
    if (e.moving) {
      for (let j = 0; j < 3; j++)
        line(
          c,
          -24 - j * 7,
          9 + j * 3,
          -17 - j * 7,
          11 + j * 3,
          "#d0e5d878",
          1.2,
        );
    }
    if (action === "attack" && e.type === "Fire Ship")
      for (let j = 0; j < 4; j++)
        ellipse(
          c,
          22 + j * 5,
          -2 + Math.sin(t * 12 + j) * 3,
          6 - j,
          3,
          ["#e5a34d", "#eac569", "#d77733", "#d76a31"][j],
        );
    c.restore();
    return;
  }
  ellipse(c, 0, 3, d.role === "cavalry" ? 15 : 9, 4, "#152c1d55");
  if (d.role === "cobra") {
    box(c, 0, 3, 17, 12, 8, "#4d8c9b", "#275963", "#7fbdc5");
    for (let [xx, yy] of [
      [-10, 6],
      [6, 14],
      [17, 8],
      [-1, 0],
    ])
      ellipse(c, xx, yy, 4, 4, "#29342d");
    poly(
      c,
      [
        [-2, -4],
        [5, -12],
        [16, -6],
        [13, 1],
      ],
      "#a6d3d4",
      "#335f63",
    );
    line(c, 12, -5, 28, -10, "#3e4a44", 3);
    c.restore();
    return;
  }
  if (d.role === "siege" || d.role === "trade") {
    let ww = e.type === "Trebuchet" ? 19 : 15;
    line(c, -ww, 1, ww, 9, "#a28352", 5);
    for (let [xx, yy] of [
      [-ww, 3],
      [ww, 11],
      [-3, -3],
      [10, 3],
    ])
      ellipse(c, xx, yy, 4, 5, "#756d4c");
    if (e.type === "Ram") {
      poly(
        c,
        [
          [-17, -8],
          [-4, -19],
          [18, -8],
          [5, 3],
        ],
        "#b69c66",
        "#5a5b40",
      );
      poly(
        c,
        [
          [-17, -8],
          [5, 3],
          [5, 10],
          [-17, -1],
        ],
        color,
      );
      line(c, -20, -1, 22, 8, "#735334", 5);
    } else if (e.type === "Trade Cart") {
      box(c, -2, 2, 13, 12, 12, "#aa8c58", "#756844", "#c6aa70");
      poly(
        c,
        [
          [-17, 0],
          [-7, -10],
          [14, 0],
          [4, 10],
        ],
        "#c9c69f",
      );
      animalArt(c, { type: "horse", phase: t, moving: e.moving }, 24, 14, 0.6);
    } else {
      line(c, -4, 0, -5, e.type === "Trebuchet" ? -43 : -22, "#ba9c66", 4);
      line(c, -14, 0, 4, -25, "#8d744c", 3);
      line(
        c,
        -4,
        -15,
        15,
        -27 - (action === "attack" ? swing * 8 : 0),
        "#c4a16a",
        3,
      );
      ellipse(c, 16, -28, 5, 3, "#757d69");
      flag(c, -9, -10, color, t);
    }
    c.restore();
    return;
  }
  let mounted = d.role === "cavalry",
    base = mounted ? -12 : 0;
  if (mounted) {
    animalArt(c, { type: "horse", phase: t, moving: e.moving }, 0, 0, 1.05);
    poly(
      c,
      [
        [-6, -7],
        [3, -12],
        [9, -8],
        [0, -3],
      ],
      color,
    );
  }
  let lean = ["chop", "mine", "build", "farm", "gather"].includes(action)
    ? swing * 2
    : 0;
  c.translate(lean, base);
  line(c, -3, -4, -4 - walk * 3, 4 + Math.abs(walk), "#4d4b3b", 2.5);
  line(c, 3, -4, 4 + walk * 3, 4 - Math.abs(walk), "#4d4b3b", 2.5);
  poly(
    c,
    [
      [-5, -16],
      [4, -16],
      [6, -3],
      [-5, -3],
    ],
    d.role === "monk" ? "#bdc8b4" : color,
    "#394b39",
  );
  ellipse(c, 0, -21, 3.6, 4.5, "#d4b18b");
  if (["infantry", "spear", "cavalry"].includes(d.role)) {
    poly(
      c,
      [
        [-4, -22],
        [-3, -26],
        [2, -27],
        [5, -22],
      ],
      "#b7c4bb",
      "#5b7061",
    );
  } else if (d.role === "worker") {
    poly(
      c,
      [
        [-5, -24],
        [3, -25],
        [6, -20],
        [-6, -20],
      ],
      "#b3ad7b",
    );
  } else if (d.role === "monk") {
    poly(
      c,
      [
        [-5, -19],
        [-3, -28],
        [3, -28],
        [5, -18],
      ],
      "#d3d4b6",
    );
    line(c, 7, -13, 8, 5, "#8d7956", 2);
    line(c, 7, -16, 7, -22, "#d7c681", 1.4);
    line(c, 4, -19, 10, -19, "#d7c681", 1.4);
    if (e.relic) ellipse(c, 0, -11, 4, 5, "#e6c769");
  }
  let arm =
    action === "idle"
      ? 0
      : action === "attack"
        ? swing * 8
        : ["chop", "mine", "build"].includes(action)
          ? swing * 11
          : action === "farm"
            ? swing * 4
            : walk * 3;
  line(c, -4, -15, -9, -8 + walk * 2, "#d4b08b", 2);
  line(c, 4, -15, 10, -10 - arm, "#d4b08b", 2);
  if (d.role === "worker") {
    if (["chop", "mine", "build", "farm"].includes(action)) {
      line(c, 10, -10 - arm, 17, -20 - arm, "#9e865d", 2);
      if (action === "chop")
        poly(
          c,
          [
            [14, -20 - arm],
            [21, -25 - arm],
            [22, -17 - arm],
            [17, -15 - arm],
          ],
          "#b9c0b3",
        );
      if (action === "mine")
        line(c, 12, -22 - arm, 24, -19 - arm, "#b3bdb0", 3);
      if (action === "build")
        box(c, 15, -19 - arm, 4, 4, 4, "#bec4b1", "#879886", "#c8cab5");
      if (action === "farm")
        line(c, 12, -22 - arm, 20, -22 - arm, "#a5af8f", 2);
    }
    if (action === "attack") {
      line(c, 10, -10 - arm, 21, -28 - arm, "#b6a172", 1.8);
      poly(
        c,
        [
          [19, -28 - arm],
          [23, -33 - arm],
          [23, -26 - arm],
        ],
        "#c5cbb8",
      );
    }
    if (e.carry > 0) {
      ellipse(
        c,
        -10,
        -10,
        4,
        5,
        e.carryType === "wood"
          ? "#8f704a"
          : e.carryType === "gold"
            ? "#c9ae58"
            : "#af9970",
      );
      if (e.carryType === "wood") line(c, -13, -16, -5, -11, "#b29a65", 3);
    }
  } else if (d.role === "archer" || d.role === "skirm") {
    c.beginPath();
    c.arc(11, -12, 9, -1.7, 1.7);
    c.strokeStyle = "#d4b785";
    c.lineWidth = 1.5;
    c.stroke();
    line(c, 10, -21, 10, -3, "#e1d5ae", 0.7);
    if (action === "attack") line(c, 2, -12, 21, -12, "#b8c2b0");
  } else if (d.role === "spear")
    line(c, 10, 1, 15, -35 - arm * 0.3, "#bda16b", 1.7);
  else if (d.role !== "monk") {
    line(c, 10, -10 - arm, 18, -24 - arm, "#c5cec1", 2);
    ellipse(c, -9, -10, 4, 6, "#8c9276");
    ellipse(c, -9, -10, 2, 4, color);
  }
  if (action === "heal") {
    ellipse(c, 0, -32, 7 + Math.sin(t * 5) * 2, 2, "#e1d58666");
    line(c, -10, -36, -10, -29, "#e5dfaa");
    line(c, -13, -33, -7, -33, "#e5dfaa");
  }
  c.restore();
}
function resourceArt(c, e, x, y, s = 1) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  if (e.type === "tree")
    treeArt(c, 0, 0, e.variant || 0, (G?.time || 0) * 0.6 + e.id, e.depleted);
  else if (["gold", "stone"].includes(e.type)) {
    ellipse(c, 0, 4, 15, 5, "#25422d44");
    let gold = e.type === "gold";
    for (let i = 0; i < 4; i++) {
      let xx = (i - 1.5) * 7,
        yy = (i % 2) * 4;
      poly(
        c,
        [
          [xx - 6, yy],
          [xx - 4, yy - 10],
          [xx + 2, yy - 14],
          [xx + 8, yy - 3],
          [xx + 4, yy + 4],
        ],
        gold ? "#a5a074" : "#8eaaa0",
        "#5b7460",
      );
      poly(
        c,
        [
          [xx - 4, yy - 10],
          [xx + 2, yy - 14],
          [xx + 4, yy - 5],
        ],
        gold ? "#d2b558" : "#bfcebb",
      );
      if (gold) line(c, xx - 1, yy - 5, xx + 5, yy - 1, "#e4c369", 2);
    }
  } else if (e.type === "berry" || e.type === "shrub") {
    ellipse(c, 0, 3, 12, 4, "#233d2455");
    for (let i = 0; i < 5; i++) {
      let xx = Math.sin(i * 2) * 8,
        yy = Math.cos(i * 2) * 4;
      ellipse(c, xx, yy - 5, 6, 6, ["#587f43", "#6b904c", "#3f693d"][i % 3]);
      if (e.type === "berry")
        for (let j = 0; j < 3; j++)
          ellipse(c, xx - 3 + j * 3, yy - 7 + (j % 2), 1.4, 1.4, "#b75648");
    }
  } else if (e.type === "fish") {
    let t = G?.time || 0;
    for (let i = 0; i < 4; i++) {
      let xx = Math.sin(t + i * 2) * 9,
        yy = Math.cos(t * 0.7 + i) * 4;
      ellipse(c, xx, yy, 4, 1.5, "#bad3c47a");
      poly(
        c,
        [
          [xx + 3, yy],
          [xx + 6, yy - 2],
          [xx + 6, yy + 2],
        ],
        "#bad3c45a",
      );
    }
    ellipse(c, 0, 0, 16, 7, "#9ad2c218");
  } else if (e.type === "relic") {
    ellipse(c, 0, 2, 8, 4, "#cbbf6155");
    box(c, 0, 0, 5, 5, 10, "#c4a458", "#8c874f", "#e0d391");
    line(c, 0, -8, 0, -20, "#ead494", 2);
    line(c, -4, -16, 4, -16, "#ead494", 2);
  }
  c.restore();
}
function drawTerrain() {
  let z = cam.z,
    time = G.time;
  for (let sum = 0; sum < G.n * 2; sum++)
    for (let x = Math.max(0, sum - G.n + 1); x <= Math.min(G.n - 1, sum); x++) {
      let y = sum - x,
        t = G.tiles[y][x],
        p = iso(x, y, t.h);
      if (
        p.x < -60 * z ||
        p.x > canvas.width + 60 * z ||
        p.y < -40 * z ||
        p.y > canvas.height + 60 * z
      )
        continue;
      let reveal =
        editing || G.settings.visibility !== "fog" || G.revealed[y][x];
      if (!reveal) {
        poly(
          ctx,
          [
            [p.x, p.y],
            [p.x + 25 * z, p.y + 12.5 * z],
            [p.x, p.y + 25 * z],
            [p.x - 25 * z, p.y + 12.5 * z],
          ],
          "#122523",
        );
        continue;
      }
      let land = t.t !== "water",
        v = t.v || 0.5,
        colour =
          t.t === "sand"
            ? `rgb(${155 + v * 15},${146 + v * 12},${95 + v * 10})`
            : t.t === "dirt"
              ? `rgb(${114 + v * 12},${119 + v * 10},${72 + v * 10})`
              : land
                ? `rgb(${75 + v * 17 + t.h * 5},${110 + v * 17 + t.h * 4},${65 + v * 13})`
                : `rgb(${37 + v * 7},${89 + v * 12},${99 + v * 15})`;
      if (land && t.h > 0) {
        let edge = height(x + 1, y) < t.h || height(x, y + 1) < t.h;
        if (edge) {
          poly(
            ctx,
            [
              [p.x + 25 * z, p.y + 12.5 * z],
              [p.x, p.y + 25 * z],
              [p.x - 25 * z, p.y + 12.5 * z],
              [p.x - 25 * z, p.y + (12.5 + t.h * 9) * z],
              [p.x, p.y + (25 + t.h * 9) * z],
              [p.x + 25 * z, p.y + (12.5 + t.h * 9) * z],
            ],
            "#66704a",
            "#758052",
          );
        }
      }
      poly(
        ctx,
        [
          [p.x, p.y],
          [p.x + 25 * z, p.y + 12.5 * z],
          [p.x, p.y + 25 * z],
          [p.x - 25 * z, p.y + 12.5 * z],
        ],
        colour,
      );
      if (land) {
        if (t.v > 0.5) {
          for (let j = 0; j < 3; j++) {
            let xx = p.x + (t.v * 19 - 10 + j * 6) * z,
              yy = p.y + (12 + j * 2) * z;
            line(ctx, xx, yy, xx + 1 * z, yy - 2 * z, "#aac08340", 0.7);
          }
        }
        if (t.v > 0.93) {
          ellipse(ctx, p.x + 5 * z, p.y + 13 * z, 1.2 * z, 1 * z, "#d5ca8f");
          ellipse(ctx, p.x - 8 * z, p.y + 14 * z, 0.8 * z, 1 * z, "#e1c2a0");
        }
      } else {
        let wave = Math.sin(time * 1.2 + x * 0.7 + y * 0.5);
        line(
          ctx,
          p.x - 10 * z,
          p.y + (11 + wave) * z,
          p.x + 9 * z,
          p.y + (11 + wave) * z,
          "#8dc6c133",
          1,
        );
        if (
          !water(x + 1, y) ||
          !water(x, y + 1) ||
          !water(x - 1, y) ||
          !water(x, y - 1)
        ) {
          line(
            ctx,
            p.x - 20 * z,
            p.y + 12 * z,
            p.x,
            p.y + 22 * z,
            "#c5d2a37a",
            1.8 * z,
          );
          line(
            ctx,
            p.x,
            p.y + 22 * z,
            p.x + 18 * z,
            p.y + 13 * z,
            "#c5d2a36a",
            1.6 * z,
          );
        }
      }
      if (!editing && G.settings.visibility !== "all" && !G.visible[y][x])
        poly(
          ctx,
          [
            [p.x, p.y],
            [p.x + 25 * z, p.y + 12.5 * z],
            [p.x, p.y + 25 * z],
            [p.x - 25 * z, p.y + 12.5 * z],
          ],
          "#0b222875",
        );
    }
}
function visibleEntity(e) {
  return (
    editing ||
    e.owner === 0 ||
    G.settings.visibility === "all" ||
    (tile(e.x, e.y) && G.visible[Math.floor(e.y)]?.[Math.floor(e.x)]) ||
    (e.kind === "building" &&
      (G.settings.visibility === "explored" ||
        G.revealed[Math.floor(e.y)]?.[Math.floor(e.x)]))
  );
}
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!G) return;
  drawTerrain();
  let ents = G.entities
    .filter(
      (e) =>
        !e.garrison &&
        (e.hp > 0 || (e.death && G.time - e.death < 2)) &&
        visibleEntity(e),
    )
    .sort((a, b) => a.x + a.y - (b.x + b.y));
  for (let e of ents) {
    let p = iso(e.x, e.y);
    if (
      p.x < -100 ||
      p.x > canvas.width + 100 ||
      p.y < -100 ||
      p.y > canvas.height + 100
    )
      continue;
    let s = cam.z;
    if (selected.includes(e)) {
      ctx.strokeStyle = e.owner >= 0 ? G.players[e.owner].color : "#ded5a0";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(
        p.x,
        p.y + 4 * s,
        (e.kind === "building" ? B[e.type].size * 14 : 14) * s,
        (e.kind === "building" ? B[e.type].size * 7 : 7) * s,
        0,
        0,
        TAU,
      );
      ctx.stroke();
    }
    if (e.hp <= 0) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - (G.time - e.death) / 2);
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.PI * 0.4);
      if (e.kind === "unit") unitArt(ctx, e, 0, 0, s);
      ctx.restore();
      continue;
    }
    if (e.kind === "building") buildingArt(ctx, e, p.x, p.y, s);
    else if (e.kind === "unit") unitArt(ctx, e, p.x, p.y, s);
    else if (e.kind === "animal") animalArt(ctx, e, p.x, p.y, s);
    else resourceArt(ctx, e, p.x, p.y, s);
    if (selected.includes(e) || (e.hp < e.maxHp * 0.8 && !e.carcass)) {
      let yy =
          p.y - (e.kind === "building" ? 50 : U[e.type]?.water ? 40 : 32) * s,
        w = 30 * s;
      ctx.fillStyle = "#182b23";
      ctx.fillRect(p.x - w / 2, yy, w, 4 * s);
      ctx.fillStyle = e.owner >= 0 ? G.players[e.owner].color : "#99ac70";
      ctx.fillRect(p.x - w / 2, yy, (w * e.hp) / e.maxHp, 3 * s);
      if (e.built < 1) {
        ctx.fillStyle = "#d7c581";
        ctx.fillRect(p.x - w / 2, yy + 6 * s, w * e.built, 2 * s);
      }
    }
    if (e.relics) {
      ctx.fillStyle = "#e5cf87";
      ctx.font = `${11 * s}px Georgia`;
      ctx.fillText("✦ " + e.relics, p.x - 8 * s, p.y - 55 * s);
    }
    if (e.task?.kind === "convert" && e.work > 0) {
      ctx.fillStyle = "#dec779";
      ctx.fillRect(p.x - 12 * s, p.y - 37 * s, (24 * s * e.work) / 7, 2 * s);
    }
  }
  for (let e of G.effects) {
    let p = iso(e.x, e.y),
      progress = 1 - e.t / e.max;
    ctx.save();
    if (["arrow", "fire", "rock"].includes(e.type)) {
      let q = iso(e.tx, e.ty),
        x = p.x + (q.x - p.x) * progress,
        y =
          p.y +
          (q.y - p.y) * progress -
          Math.sin(progress * Math.PI) * (e.type === "rock" ? 50 : 20) * cam.z;
      if (e.type === "arrow")
        line(
          ctx,
          x,
          y,
          x - (q.x - p.x) * 0.07,
          y - (q.y - p.y) * 0.07,
          "#e4d6b1",
          1.5,
        );
      else
        ellipse(
          ctx,
          x,
          y,
          e.type === "rock" ? 4 : 7,
          e.type === "rock" ? 4 : 4,
          e.type === "fire" ? "#edb45d" : "#7a806a",
        );
    } else if (e.type === "order") {
      ctx.globalAlpha = e.t / e.max;
      ctx.strokeStyle = "#e4d28d";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 16 + progress * 12, 8 + progress * 6, 0, 0, TAU);
      ctx.stroke();
    } else if (e.type === "heal") {
      ctx.globalAlpha = e.t / e.max;
      line(
        ctx,
        p.x,
        p.y - 20 - progress * 12,
        p.x,
        p.y - 30 - progress * 12,
        "#e4de9e",
        2,
      );
      line(
        ctx,
        p.x - 5,
        p.y - 25 - progress * 12,
        p.x + 5,
        p.y - 25 - progress * 12,
        "#e4de9e",
        2,
      );
    } else {
      for (let i = 0; i < 9; i++) {
        let a = (i * TAU) / 9,
          r = progress * 30;
        ellipse(
          ctx,
          p.x + Math.cos(a) * r,
          p.y + Math.sin(a) * r * 0.5,
          4 * (1 - progress) + 1,
          3 * (1 - progress) + 1,
          e.type === "splash"
            ? "#c3e2d9"
            : e.type === "blood"
              ? "#9e6249"
              : e.type === "explosion"
                ? "#edb157"
                : "#b3aa85",
        );
      }
    }
    ctx.restore();
  }
  if (buildMode) {
    let p = uniso(mouse.x, mouse.y),
      q = iso(p.x, p.y);
    ctx.save();
    ctx.globalAlpha = 0.7;
    buildingArt(
      ctx,
      {
        type: buildMode,
        owner: 0,
        built: 1,
        hp: B[buildMode].hp,
        maxHp: B[buildMode].hp,
      },
      q.x,
      q.y,
      cam.z,
      true,
    );
    ctx.strokeStyle = validSite(buildMode, p.x, p.y) ? "#e17a65" : "#c2df95";
    ctx.beginPath();
    ctx.ellipse(
      q.x,
      q.y,
      B[buildMode].size * 15 * cam.z,
      B[buildMode].size * 8 * cam.z,
      0,
      0,
      TAU,
    );
    ctx.stroke();
    ctx.restore();
  }
  if (editing && editorKind === "terrain") {
    let p = uniso(mouse.x, mouse.y),
      q = iso(Math.floor(p.x), Math.floor(p.y));
    ctx.strokeStyle = "#e0d28b";
    ctx.lineWidth = 2;
    let b = brush * 25 * cam.z;
    poly(
      ctx,
      [
        [q.x, q.y],
        [q.x + b, q.y + b * 0.5],
        [q.x, q.y + b],
        [q.x - b, q.y + b * 0.5],
      ],
      null,
      "#e0d28b",
    );
  }
  if (drag && drag.selecting) {
    ctx.fillStyle = "#9ec69b18";
    ctx.strokeStyle = "#d4dab7";
    ctx.fillRect(drag.x, drag.y, mouse.x - drag.x, mouse.y - drag.y);
    ctx.strokeRect(drag.x, drag.y, mouse.x - drag.x, mouse.y - drag.y);
  }
  drawMini();
}
function drawMini() {
  let w = 190,
    h = 134;
  mini.clearRect(0, 0, w, h);
  for (let y = 0; y < G.n; y++)
    for (let x = 0; x < G.n; x++) {
      let t = G.tiles[y][x];
      mini.fillStyle =
        !editing && G.settings.visibility === "fog" && !G.revealed[y][x]
          ? "#142825"
          : t.t === "water"
            ? "#346f80"
            : t.h > 1
              ? "#879163"
              : "#60734a";
      mini.fillRect((x / G.n) * w, (y / G.n) * h, w / G.n + 1, h / G.n + 1);
    }
  for (let e of G.entities)
    if (e.hp > 0 && !e.garrison && visibleEntity(e)) {
      mini.fillStyle =
        e.owner >= 0
          ? G.players[e.owner].color
          : e.type === "tree"
            ? "#354e30"
            : e.type === "gold"
              ? "#d7b760"
              : e.type === "fish"
                ? "#b8d7c6"
                : "#b9bea0";
      let r = e.kind === "building" ? 3 : e.kind === "unit" ? 2 : 1;
      mini.fillRect((e.x / G.n) * w - r / 2, (e.y / G.n) * h - r / 2, r, r);
    }
  let p = uniso(canvas.width / 2, canvas.height * 0.48);
  mini.strokeStyle = "#e0dfb8";
  mini.lineWidth = 1;
  mini.strokeRect((p.x / G.n) * w - 18, (p.y / G.n) * h - 14, 36, 28);
}
function iconCanvas(type, size = 48) {
  let c = document.createElement("canvas");
  c.width = size * 2;
  c.height = size * 2;
  let cc = c.getContext("2d");
  cc.scale(2, 2);
  if (B[type])
    buildingArt(
      cc,
      { type, owner: 0, built: 1, hp: 9999, maxHp: 9999 },
      size / 2,
      size * 0.78,
      0.65,
      true,
    );
  else if (U[type])
    unitArt(
      cc,
      { type, owner: 0, phase: 0, action: "idle" },
      size / 2,
      size * 0.75,
      0.9,
    );
  else if (["sheep", "deer", "wolf", "boar"].includes(type))
    animalArt(cc, { type, phase: 0 }, size / 2, size * 0.7, 1);
  else if (
    ["tree", "berry", "gold", "stone", "fish", "relic", "shrub"].includes(type)
  )
    resourceArt(cc, { type, variant: 0 }, size / 2, size * 0.8, 0.9);
  else if (
    ["grass", "dirt", "sand", "water", "raise", "lower"].includes(type)
  ) {
    poly(
      cc,
      [
        [size / 2, 9],
        [size - 3, size / 2],
        [size / 2, size - 4],
        [3, size / 2],
      ],
      {
        grass: "#7b9a58",
        dirt: "#a58d5a",
        sand: "#c3b878",
        water: "#4a95a6",
        raise: "#9f9b67",
        lower: "#788c61",
      }[type],
      "#b7c195",
    );
    if (type === "water") line(cc, 12, 22, 34, 22, "#b6d4c6", 1.5);
    if (type === "raise" || type === "lower") {
      cc.fillStyle = "#e2d5a4";
      cc.font = "24px Georgia";
      cc.fillText(type === "raise" ? "↑" : "↓", 15, 30);
    }
  } else {
    cc.font = `${size * 0.55}px Georgia`;
    cc.textAlign = "center";
    cc.fillStyle = "#d4be87";
    cc.fillText(
      {
        advance: "♜",
        bell: "♧",
        unload: "⇩",
        garrison: "⌂",
        military: "⚔",
        economic: "⚒",
        back: "↶",
        stop: "■",
        heal: "✚",
        attack: "⚔",
        repair: "⚒",
        technology: "✦",
        market: "⇄",
        delete: "×",
      }[type] || "✦",
      size / 2,
      size * 0.7,
    );
  }
  return c;
}
function button(name, type, fn, tip = "", key = "", locked = false) {
  let b = document.createElement("button");
  b.className = "command" + (locked ? " locked" : "");
  b.dataset.tip = tip || name;
  b.title = tip || name;
  b.append(iconCanvas(type, 42));
  let label = document.createElement("span");
  label.textContent = name;
  b.append(label);
  if (key) {
    let k = document.createElement("kbd");
    k.textContent = key;
    b.append(k);
  }
  if (locked) {
    let l = document.createElement("span");
    l.className = "lock";
    l.textContent = "▣";
    b.append(l);
  }
  b.onclick = fn;
  $("#commands").append(b);
  return b;
}
function updateUI() {
  if (!G) return;
  let p = G.players[0];
  $("#playerLabel").innerHTML =
    p.name.replace(/[<>]/g, "") +
    '<small style="color:' +
    p.color +
    '">' +
    p.civ +
    "</small>";
  $("#resources").innerHTML =
    Object.entries(p.res)
      .map(
        ([k, v]) =>
          '<div class="res"><span style="color:' +
          {
            gold: "#d5b863",
            stone: "#b9c8bd",
            food: "#d7bf83",
            wood: "#c1a077",
          }[k] +
          '">' +
          ICON[k] +
          "</span><div><b>" +
          Math.floor(v) +
          "</b><small>" +
          k.toUpperCase() +
          "</small></div></div>",
      )
      .join("") +
    '<div class="res"><span>♟</span><div><b>' +
    population(0) +
    " / " +
    popcap(0) +
    "</b><small>POPULATION</small></div></div>";
  $("#ageLabel").innerHTML =
    (editing ? "Map Editor" : AGE[p.age]) +
    "<br><small>" +
    Math.floor(G.time / 60) +
    ":" +
    String(Math.floor(G.time % 60)).padStart(2, "0") +
    "</small>";
  selected = selected.filter((e) => e.hp > 0);
  let e = selected[0],
    panel = $("#selectionPanel");
  $("#commands").innerHTML = "";
  if (!e) {
    panel.innerHTML =
      '<div class="empty-selection"><span>♜</span><strong>Your kingdom awaits</strong><small>Select villagers to work. Right-click to command.</small></div>';
    return;
  }
  let owner = G.players[e.owner];
  panel.innerHTML =
    '<div class="selection-name">' +
    (selected.length > 1 ? selected.length + " units · " : "") +
    e.type +
    '</div><div id="portrait" class="portrait"></div><div style="font-size:10px;color:' +
    (owner?.color || "#c4c998") +
    '">' +
    (owner?.name || "Neutral wildlife") +
    '</div><div class="health-track"><div style="width:' +
    Math.min(100, (e.hp / e.maxHp) * 100) +
    '%"></div></div><small>' +
    Math.ceil(e.hp) +
    " / " +
    Math.ceil(e.maxHp) +
    ' HP</small><div class="stats">' +
    (e.kind === "unit"
      ? "⚔ " +
        (U[e.type]?.atk || 0) +
        " attack · ◎ " +
        (U[e.type]?.range || 0) +
        " range<br><b>" +
        (e.garrison ? "Garrisoned" : e.task?.kind || "Standing by") +
        "</b>"
      : e.kind === "building"
        ? "<b>" +
          (e.built < 1
            ? "Construction " + Math.floor(e.built * 100) + "%"
            : "Completed") +
          "</b>" +
          (B[e.type].cap
            ? " · " + e.occupants.length + "/" + B[e.type].cap + " sheltered"
            : "") +
          (e.type === "Monastery"
            ? "<br>✦ " + e.relics + " relics · " + e.relics + " gold/sec"
            : "")
        : e.stock
          ? "Food / resources: " + Math.ceil(e.stock)
          : "") +
    (e.carry > 0
      ? "<br>Carrying " + Math.floor(e.carry) + " " + e.carryType
      : "") +
    (e.queue.length
      ? "<br>Queue: " +
        e.queue.map((q) => q.type + " " + Math.ceil(q.left) + "s").join(" → ")
      : "") +
    "</div>";
  $("#portrait").append(iconCanvas(e.type, 70));
  if (editing) return;
  if (e.owner !== 0) return;
  if (e.type === "Villager") {
    if (menuGroup === "main") {
      button(
        "Economy",
        "economic",
        () => {
          menuGroup = "economic";
          updateUI();
        },
        "Economic construction menu",
        "B",
      );
      button(
        "Military",
        "military",
        () => {
          menuGroup = "military";
          updateUI();
        },
        "Military construction menu",
        "V",
      );
      button(
        "Repair",
        "repair",
        () => {
          commandMode = "repair";
          notify(
            "Right-click a friendly building, ship or siege engine to repair.",
          );
        },
        "Repair with wood, or stone for fortifications.",
        "R",
      );
      button(
        "Garrison",
        "garrison",
        () => {
          commandMode = "garrison";
          notify("Right-click a Town Center, Tower or Castle.");
        },
        "Seek shelter.",
        "G",
      );
    } else {
      button(
        "Back",
        "back",
        () => {
          menuGroup = "main";
          updateUI();
        },
        "Return",
        "Esc",
      );
      let types =
        menuGroup === "economic"
          ? [
              "House",
              "Mill",
              "Lumber Camp",
              "Mining Camp",
              "Farm",
              "Town Center",
              "Market",
              "Dock",
              "Monastery",
              "University",
            ]
          : [
              "Barracks",
              "Archery Range",
              "Stable",
              "Blacksmith",
              "Siege Workshop",
              "Tower",
              "Wall",
              "Gate",
              "Castle",
            ];
      for (let type of types) {
        let d = B[type],
          reason = prerequisites(p, d);
        button(
          type,
          type,
          () => {
            if (reason) return notify(reason);
            buildMode = type;
            $("#placementHint").hidden = false;
            $("#placementHint").textContent =
              "Place " + type + " · " + costs(d.cost) + " · Esc cancels";
          },
          type + "\n" + costs(d.cost) + "\n" + (reason || d.desc),
          "",
          !!reason,
        );
      }
    }
  }
  if (e.kind === "building" && e.built >= 1) {
    for (let [type, d] of Object.entries(U))
      if (d.at === e.type && (!d.civ || d.civ === p.civ)) {
        let reason = prerequisites(p, d);
        button(
          type,
          type,
          () => queue(e, type),
          type +
            "\n" +
            costs(d.cost) +
            "\n" +
            (reason || d.role + " · " + d.hp + " HP · " + d.atk + " attack"),
          type === "Villager" ? "Q" : "",
          !!reason,
        );
      }
    if (e.type === "Town Center") {
      if (p.age < 3) {
        let d = {
          cost: [cost(500), cost(800, 0, 200), cost(1000, 0, 800)][p.age],
        };
        button(
          AGE[p.age + 1],
          "advance",
          () => queue(e, "advance", "age"),
          AGE[p.age + 1] +
            "\n" +
            costs(d.cost) +
            "\nUnlock new buildings, units and technology.",
          "A",
        );
      }
      button(
        "Town Bell",
        "bell",
        bell,
        "Recall villagers to shelter. Toggle off to resume previous work.",
        "T",
      );
    }
    for (let [type, d] of Object.entries(TECH))
      if (d.at === e.type && !p.tech.includes(type)) {
        let reason = prerequisites(p, d);
        button(
          type,
          "technology",
          () => queue(e, type, "tech"),
          type + "\n" + costs(d.cost) + "\n" + (reason || d.desc),
          "",
          !!reason,
        );
      }
    if (e.type === "Monastery" && e.relics > 0)
      button(
        "Release relic",
        "relic",
        () => {
          const spot = exitSpot(e);
          entity("relic", spot.x, spot.y);
          e.relics--;
          updateUI();
        },
        "Place one stored relic outside for a monk to collect.",
      );
    if (e.occupants.length)
      button(
        "Ungarrison",
        "unload",
        () => {
          ungarrison(e);
          updateUI();
        },
        "Release all occupants and resume tasks.",
        "U",
      );
    if (e.queue.length)
      button(
        "Cancel last",
        "stop",
        () => {
          let q = e.queue.pop(),
            d =
              q.kind === "unit"
                ? U[q.type]
                : q.kind === "tech"
                  ? TECH[q.type]
                  : {
                      cost: [cost(500), cost(800, 0, 200), cost(1000, 0, 800)][
                        p.age
                      ],
                    };
          for (let k in d.cost) p.res[k] += d.cost[k];
          updateUI();
        },
        "Cancel last queued action; resources refunded.",
      );
    if (e.type === "Market")
      button(
        "Exchange",
        "market",
        marketPanel,
        "Buy and sell resources for gold.",
      );
  }
  if (e.type === "Transport Ship")
    button(
      "Unload",
      "unload",
      () => {
        unload(e);
        updateUI();
      },
      "Unload all passengers within 4 tiles of a valid shore.",
      "U",
    );
  if (e.kind === "unit" || e.kind === "animal") {
    button(
      "Stop",
      "stop",
      () => {
        for (let u of selected) setTask(u, null);
        updateUI();
      },
      "Stop current orders",
      "X",
    );
    if (e.type === "Monk") {
      button(
        "Heal",
        "heal",
        () => {
          commandMode = "heal";
          notify("Right-click a friendly living unit to heal.");
        },
        "Heal friendly living units. Cannot repair ships or machines.",
      );
      if (e.relic)
        button(
          "Drop relic",
          "relic",
          () => {
            entity("relic", e.x, e.y);
            e.relic = false;
            updateUI();
          },
          "Drop the carried relic here.",
        );
    }
  }
}
function marketPanel() {
  modal(
    '<h2>Royal exchange</h2><p>Sell 100 resources for 70 gold. Buy 100 resources for 130 gold.</p><div id="exchange"></div>',
  );
  for (let k of ["food", "wood", "stone"]) {
    let row = document.createElement("div");
    row.style.margin = "12px 0";
    for (let buy of [false, true]) {
      let b = document.createElement("button");
      b.textContent = (buy ? "Buy " : "Sell ") + 100 + " " + k;
      b.style.marginRight = "10px";
      b.onclick = () => {
        let p = G.players[0],
          from = buy ? "gold" : k,
          price = buy ? 130 : 100;
        if (p.res[from] < price) return notify("Not enough " + from);
        p.res[from] -= price;
        p.res[buy ? k : "gold"] += buy ? 100 : 70;
        updateUI();
      };
      row.append(b);
    }
    $("#exchange").append(row);
  }
}
function modal(html) {
  $("#modalContent").innerHTML = html;
  $("#modal").hidden = false;
}
$("#closeModal").onclick = () => ($("#modal").hidden = true);
function help() {
  modal(
    '<div class="eyebrow">THE FIELD GUIDE</div><h2>The art of a kingdom</h2><div class="help-grid"><div><h3>Command & economy</h3><p>Click to select; drag a box for groups. Shift adds to selection. Right-click to move, gather, hunt, build, repair, attack, heal, collect relics or enter a transport. WASD / arrow keys pan; wheel zooms. H selects your Town Center. B / V opens villager construction. A advances an age at the Town Center; Q trains a villager. Escape cancels placement. Enter opens chat.</p><p>Workers carry 12 resources to a suitable drop-off. Build Houses for population. Farms replenish when exhausted. Buildings need a villager to finish construction. Research and units use paid queues with age requirements.</p><h3>Sheep & wild country</h3><p>Land units capture sheep within 2.5 tiles if no unit of the current owner guards within 3 tiles. A capture has a 5-second lock. Captured sheep obey movement commands. Villagers slaughter and gather them. Deer flee, boar retaliate, and wolves attack exposed units.</p><h3>Terrain & combat</h3><p>Higher ground deals 125% damage; lower ground deals 75%. Cliffs steeper than one height step block paths. Trees and buildings block movement. Ranged projectiles can pass over forests and walls; range uses ground distance. Spearmen counter cavalry, skirmishers counter archers, and siege engines counter buildings.</p></div><div><h3>Coasts, faith & diplomacy</h3><p>Docks sit on water within 3 tiles of land. Fishing Ships collect visible fish and return food to a Dock. Right-click a Transport Ship with land units to board; sail near shore and use Unload. Fire Ships burn nearby targets; Demolition Ships explode. Galleys can attack nearby coasts.</p><p>Monks heal living units, convert enemy units after 7 seconds, collect relics and take them to Monasteries. Each relic earns 1 gold/sec. Ships, siege and buildings require villager repairs. Town Bell recalls villagers; switch it off to resume work.</p><p>Diplomacy changes targeting immediately. Trade Carts / Cogs must right-click another allied player’s Market / Dock. Routes award 2.5 gold per tile of distance on returning home. Destroyed destinations or lost alliances stop trade. Victory requires your Town Center to survive and all hostile players to lose their Town Centers or accept peace; allies and peaceful players do not block victory.</p><h3>Cheats · Enter to type</h3><p>cheese steak jimmy’s / cheese steak jimmy\'s: +10,000 food<br>lumberjack: +10,000 wood<br>robin hood: +10,000 gold<br>rock on: +10,000 stone<br>marco: reveal map · polo: remove fog<br>aegis: toggle instant production and construction<br>how do you turn this on: controllable Cobra Car</p></div></div><p style="font-size:11px">Crown & Tide is an original homage with procedural art and simplified strategy rules. Voices use your browser’s speech synthesis: pronunciation and historical authenticity vary with installed voices.</p>',
  );
}
$("#helpBtn").onclick = help;
$("#menuHelp").onclick = help;
function diplomacy() {
  let p = G.players[0];
  modal(
    '<div class="eyebrow">THE COUNCIL CHAMBER</div><h2>Diplomacy & tribute</h2><p>Allies and peaceful kingdoms stop attacking. Victory excludes them. Tribute incurs a 10% fee. Proposals are judged by age, military strength and difficulty.</p><table><thead><tr><th>Kingdom</th><th>Relations</th><th>Proposals</th><th>Tribute</th></tr></thead><tbody id="dipRows"></tbody></table>',
  );
  for (let q of G.players.slice(1)) {
    let row = document.createElement("tr");
    row.innerHTML =
      '<td style="color:' +
      q.color +
      '">● ' +
      q.name +
      "<br><small>" +
      q.civ +
      " · " +
      AGE[q.age] +
      (q.defeated ? " · Defeated" : "") +
      "</small></td><td>" +
      p.relations[q.id] +
      '</td><td class="actions"></td><td class="tribute"></td>';
    for (let type of ["ally", "peace", "war"]) {
      let b = document.createElement("button");
      b.textContent = type;
      b.style.cssText = "font-size:10px;padding:5px;margin:2px";
      b.onclick = () => {
        let accepted =
          type === "war" ||
          p.relations[q.id] !== "war" ||
          G.settings.difficulty === "easy" ||
          (p.age >= q.age && population(0) >= population(q.id) * 0.6);
        if (accepted) {
          p.relations[q.id] = type;
          q.relations[0] = type;
          for (let e of G.entities)
            if (e.task && ["attack", "convert"].includes(e.task.kind)) {
              let t = G.entities.find((a) => a.id === e.task.target);
              if (t && !hostile(e.owner, t.owner)) setTask(e, null);
            }
          G.won = false;
          notify(
            q.name +
              ": " +
              (type === "war" ? "hostilities declared." : type + " accepted."),
          );
          diplomacy();
        } else
          notify(
            q.name + " rejects the proposal: demonstrate a stronger kingdom.",
          );
      };
      row.querySelector(".actions").append(b);
    }
    let select = document.createElement("select");
    select.style.cssText = "width:85px;font-size:10px;padding:5px";
    select.innerHTML = Object.keys(p.res)
      .map((k) => "<option>" + k + "</option>")
      .join("");
    let b = document.createElement("button");
    b.textContent = "Send 100";
    b.style.cssText = "font-size:10px;padding:5px";
    b.onclick = () => {
      let k = select.value;
      if (p.res[k] < 110)
        return notify("Tribute needs 110 " + k + " including the fee.");
      p.res[k] -= 110;
      q.res[k] += 100;
      notify("Sent 100 " + k + " to " + q.name + " · fee 10.");
      updateUI();
    };
    row.querySelector(".tribute").append(select, b);
    $("#dipRows").append(row);
  }
}
$("#diplomacyBtn").onclick = diplomacy;
function cheat(raw) {
  let code = raw.trim().toLowerCase().replace(/’/g, "'"),
    p = G.players[0],
    map = {
      "cheese steak jimmy's": "food",
      lumberjack: "wood",
      "robin hood": "gold",
      "rock on": "stone",
    };
  let known =
    map[code] ||
    ["marco", "polo", "aegis", "how do you turn this on"].includes(code);
  if (!known) {
    notify(p.name + ": " + raw);
    return false;
  }
  if (!G.settings.cheats) {
    notify("Cheats are disabled for this match.");
    return false;
  }
  if (map[code]) {
    p.res[map[code]] += 10000;
    notify("+10,000 " + map[code]);
  } else if (code === "marco") {
    G.settings.visibility = "explored";
    G.revealed = G.revealed.map((r) => r.map(() => true));
    notify("Marco: the map is revealed.");
  } else if (code === "polo") {
    G.settings.visibility = "all";
    notify("Polo: fog of war removed.");
  } else if (code === "aegis") {
    G.instant = !G.instant;
    notify(
      "Instant construction, training and research " +
        (G.instant ? "enabled." : "disabled."),
    );
  } else {
    let tc = G.entities.find(
        (e) => e.type === "Town Center" && e.owner === 0 && e.hp > 0,
      ),
      spot = exitSpot(
        tc || { x: p.start.x, y: p.start.y, owner: 0, type: "House" },
      ),
      e = entity("Cobra Car", spot.x, spot.y, 0);
    selected = [e];
    notify("Cobra Car ready. Right-click to drive or attack.");
  }
  updateUI();
  return true;
}
const AudioSys = {
  context: null,
  vol: { music: 0.25, effects: 0.45, voice: 0.7 },
  muted: false,
  lastFx: 0,
  lastVoice: 0,
  voiceIndex: 0,
  playing: null,
  manifest: null,
  musicTimer: null,
  note: 0,
  async init() {
    if (!this.context) {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
      this.noise = this.context.createBuffer(
        1,
        this.context.sampleRate * 0.7,
        this.context.sampleRate,
      );
      let a = this.noise.getChannelData(0);
      for (let i = 0; i < a.length; i++) a[i] = (Math.random() * 2 - 1) * 0.5;
      fetch("audio/manifest.json")
        .then((r) => r.json())
        .then((m) => (this.manifest = m));
      this.musicTimer = setInterval(() => this.music(), 300);
      this.environmentTimer = setInterval(() => {
        if (G && !editing && !paused && Math.random() < 0.55)
          this.fx(
            water(G.players[0].start.x + 12, G.players[0].start.y)
              ? "water"
              : "bird",
            0.11,
          );
      }, 3500);
    }
    if (this.context.state === "suspended") await this.context.resume();
  },
  tone(freq, duration, vol, type = "triangle", start = 0) {
    if (!this.context || this.muted) return;
    let c = this.context,
      o = c.createOscillator(),
      g = c.createGain(),
      time = c.currentTime + start;
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.001, time);
    g.gain.exponentialRampToValueAtTime(Math.max(0.002, vol), time + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, time + duration);
    o.connect(g);
    g.connect(this.master);
    o.start(time);
    o.stop(time + duration + 0.02);
  },
  music() {
    if (!G || editing || paused || this.muted || !this.vol.music) return;
    let melody = [
        62, 69, 67, 65, 64, 62, 60, 62, 57, 62, 65, 64, 62, 60, 57, 60, 62, 65,
        69, 72, 69, 67, 65, 64, 62, 60, 57, 60, 62, 65, 64, 62,
      ],
      m = melody[this.note++ % melody.length],
      f = 440 * Math.pow(2, (m - 69) / 12),
      v = this.vol.music;
    this.tone(f, 0.7, v * 0.055, "triangle");
    this.tone(f * 2, 0.28, v * 0.019, "sine");
    if (this.note % 4 === 0) {
      this.tone(146.83, 1.3, v * 0.035, "sine");
      this.tone(220, 1.1, v * 0.025, "triangle");
    }
    if (this.note % 2 === 0) this.tone(82, 0.14, v * 0.045, "sine");
  },
  fx(type, level = 0.2) {
    if (!this.context || this.muted) return;
    let now = performance.now();
    if (now - this.lastFx < 95 && type !== "age") return;
    this.lastFx = now;
    let v = this.vol.effects * level;
    if (["bow", "bird", "age", "heal"].includes(type)) {
      if (type === "age")
        for (let i = 0; i < 6; i++)
          this.tone(
            [293, 349, 440, 523, 587, 698][i],
            0.8,
            v * 0.3,
            "triangle",
            i * 0.12,
          );
      else if (type === "bird") {
        this.tone(1500, 0.12, v * 0.1, "sine");
        this.tone(2100, 0.14, v * 0.1, "sine", 0.15);
      } else this.tone(type === "bow" ? 700 : 880, 0.08, v * 0.3, "triangle");
      return;
    }
    let c = this.context,
      s = c.createBufferSource(),
      g = c.createGain(),
      filter = c.createBiquadFilter();
    s.buffer = this.noise;
    filter.type = "lowpass";
    filter.frequency.value =
      {
        chop: 1300,
        mine: 3200,
        build: 1900,
        farm: 500,
        gather: 700,
        hit: 1800,
        fire: 900,
        fish: 350,
        water: 250,
        death: 600,
      }[type] || 700;
    s.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    g.gain.setValueAtTime(v, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18);
    s.start();
    s.stop(c.currentTime + 0.2);
    if (["mine", "build", "hit"].includes(type))
      this.tone(type === "mine" ? 1600 : 260, 0.07, v * 0.2, "triangle");
  },
  voice(action) {
    if (
      !G ||
      editing ||
      this.muted ||
      !this.vol.voice ||
      performance.now() - this.lastVoice < 240
    )
      return;
    this.lastVoice = performance.now();
    let civ = G.players[0].civ,
      clips = this.manifest?.[civ]?.[action];
    if (this.playing) {
      this.playing.pause();
      this.playing.currentTime = 0;
    }
    if (clips) {
      let a = new Audio(clips[this.voiceIndex++ % clips.length]);
      a.volume = this.vol.voice;
      this.playing = a;
      a.play().catch(() => {});
    } else if (window.speechSynthesis) {
      speechSynthesis.cancel();
      let lines = CIV[civ].lines[action] || CIV[civ].lines.select,
        u = new SpeechSynthesisUtterance(
          lines[this.voiceIndex++ % lines.length],
        );
      u.lang = CIV[civ].lang;
      u.volume = this.vol.voice;
      u.rate = 0.95;
      speechSynthesis.speak(u);
    }
  },
};
function audioPanel() {
  AudioSys.init();
  modal(
    '<div class="eyebrow">SOUNDS OF THE KINGDOM</div><h2>Music & audio</h2><p>Original synthesized lute-style music, environmental and work effects, and local spoken acknowledgements.</p><div id="audioControls"></div><label><input id="muteAll" type="checkbox" style="width:auto" ' +
      (AudioSys.muted ? "checked" : "") +
      "> Mute all audio</label><p><small>Voices are locally synthesized historical-language-style lines, not authentic historical recordings. Old English and Old Norse pronunciation is approximate.</small></p>",
  );
  for (let key of ["music", "effects", "voice"]) {
    let row = document.createElement("div");
    row.className = "audio-row";
    row.innerHTML =
      "<label>" +
      key +
      '</label><input aria-label="' +
      key +
      ' volume" type="range" min="0" max="100" value="' +
      AudioSys.vol[key] * 100 +
      '"><span>' +
      Math.round(AudioSys.vol[key] * 100) +
      "%</span>";
    row.querySelector("input").oninput = (e) => {
      AudioSys.vol[key] = Number(e.target.value) / 100;
      row.querySelector("span").textContent = e.target.value + "%";
      if (key === "voice" && AudioSys.playing)
        AudioSys.playing.volume = AudioSys.vol.voice;
      localStorage.setItem("crownAudio", JSON.stringify(AudioSys.vol));
    };
    $("#audioControls").append(row);
  }
  $("#muteAll").onchange = (e) => {
    AudioSys.muted = e.target.checked;
    if (AudioSys.playing && AudioSys.muted) AudioSys.playing.pause();
    if (window.speechSynthesis && AudioSys.muted) speechSynthesis.cancel();
  };
}
try {
  AudioSys.vol = JSON.parse(localStorage.getItem("crownAudio")) || AudioSys.vol;
} catch {}
$("#audioBtn").onclick = audioPanel;
// Editor stores the same terrain and entities used by the simulation.
function snapshot() {
  history.push(JSON.stringify(G));
  if (history.length > 40) history.shift();
  future = [];
}
function openEditor() {
  editing = true;
  if (customDesign) G = JSON.parse(JSON.stringify(customDesign));
  else generate({ ...settings(), visibility: "all" });
  G.settings.visibility = "all";
  G.effects = [];
  history = [];
  future = [];
  selected = [];
  showGame();
  center(G.players[0].start);
  $("#editorBar").hidden = false;
  $("#tip").hidden = false;
  $("#tip").textContent =
    "Left-click to paint or place · Right-click cancels · Wheel zooms · WASD pans · Undo preserves your design";
  renderEditor();
  updateUI();
}
function renderEditor() {
  let bar = $("#editorBar");
  bar.innerHTML =
    '<div class="eyebrow">THE CARTOGRAPHER</div><h3>Create your frontier</h3><div class="row"><button id="edGenerated">Generate</button><button id="edBlank">Blank</button></div><label>Tool</label><select id="edKind"><option value="terrain">Terrain & elevation</option><option value="resource">Resources & wildlife</option><option value="building">Buildings</option><option value="unit">Units & ships</option><option value="select">Select / move / delete</option><option value="start">Player starting location</option><option value="erase">Erase objects</option></select><div id="palette" class="palette"></div><div id="edPreview" class="editor-preview"></div><label>Brush size</label><input id="edBrush" type="range" min="1" max="5" value="' +
    brush +
    '"><label>Owner / start player</label><select id="edOwner"></select><div class="row"><button id="edAdd">+ AI player</button><button id="edDelete">Delete selected</button></div><div class="row"><button id="edUndo">↶ Undo</button><button id="edRedo">↷ Redo</button></div><label>Map name</label><input id="edName" value="' +
    (G.designName || "My frontier") +
    '"><div class="row"><button id="edSave">Save</button><button id="edLoad">Reload saved</button></div><div class="row"><button id="edExport">Export</button><button id="edImport">Import</button></div><input type="file" id="edFile" accept="application/json,.json" hidden><button class="primary" id="edPlay" style="margin-top:13px">▶ Play this map</button>';
  $("#edKind").value = editorKind;
  $("#edOwner").innerHTML =
    '<option value="-1">Neutral</option>' +
    G.players
      .map(
        (p) =>
          '<option value="' +
          p.id +
          '">' +
          (p.id === 0 ? "Human" : "Computer") +
          " · " +
          p.name +
          "</option>",
      )
      .join("");
  $("#edOwner").value = editorOwner;
  $("#edKind").onchange = (e) => {
    editorKind = e.target.value;
    editorTool = "";
    palette();
  };
  $("#edOwner").onchange = (e) => (editorOwner = Number(e.target.value));
  $("#edBrush").oninput = (e) => (brush = Number(e.target.value));
  $("#edGenerated").onclick = () => {
    snapshot();
    generate({ ...settings(), visibility: "all" });
    center(G.players[0].start);
    renderEditor();
  };
  $("#edBlank").onclick = () => {
    snapshot();
    generate({ ...settings(), visibility: "all" }, true);
    center({ x: G.n / 2, y: G.n / 2 });
    renderEditor();
  };
  $("#edUndo").onclick = () => {
    if (!history.length) return;
    future.push(JSON.stringify(G));
    G = JSON.parse(history.pop());
    selected = [];
    renderEditor();
    updateUI();
  };
  $("#edRedo").onclick = () => {
    if (!future.length) return;
    history.push(JSON.stringify(G));
    G = JSON.parse(future.pop());
    selected = [];
    renderEditor();
    updateUI();
  };
  $("#edAdd").onclick = () => {
    if (G.players.length >= 4)
      return notify("Maximum: one human and three computers.");
    snapshot();
    let i = G.players.length;
    G.players.push({
      id: i,
      name: ["Lord Beaumont", "Jarl Eirik", "Empress Irene"][i - 1],
      color: COLORS[i],
      civ: Object.keys(CIV)[i],
      age: Number(G.settings.age),
      res: cost(500, 500, 500, 500),
      tech: [],
      relations: [],
      start: null,
      ai: true,
      aiPlan: 0,
      attackTime: 0,
      defeated: false,
    });
    for (let p of G.players)
      for (let q of G.players)
        p.relations[q.id] = p.id === q.id ? "ally" : "war";
    editorOwner = i;
    renderEditor();
    notify("Computer added. Place its Town Center or set its start.");
  };
  $("#edDelete").onclick = () => {
    snapshot();
    G.entities = G.entities.filter((e) => !selected.includes(e));
    selected = [];
    updateUI();
  };
  $("#edSave").onclick = () => {
    G.designName = $("#edName").value;
    customDesign = JSON.parse(JSON.stringify(G));
    localStorage.setItem("crownMap", JSON.stringify(customDesign));
    notify("Saved " + G.designName + " locally.");
  };
  $("#edLoad").onclick = () => {
    let raw = localStorage.getItem("crownMap");
    if (!raw) return notify("No saved map yet.");
    snapshot();
    G = JSON.parse(raw);
    customDesign = JSON.parse(raw);
    idSeq = Math.max(0, ...G.entities.map((e) => e.id)) + 1;
    renderEditor();
    updateUI();
    notify("Saved map loaded.");
  };
  $("#edExport").onclick = () => {
    G.designName = $("#edName").value;
    let a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(G, null, 2)], { type: "application/json" }),
    );
    a.download =
      (G.designName || "frontier").replace(/[^a-z0-9]/gi, "-") + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  $("#edImport").onclick = () => $("#edFile").click();
  $("#edFile").onchange = async (e) => {
    try {
      let obj = JSON.parse(await e.target.files[0].text());
      if (
        !Array.isArray(obj.tiles) ||
        !Array.isArray(obj.entities) ||
        !Array.isArray(obj.players) ||
        obj.n > 100 ||
        obj.n < 10 ||
        obj.tiles.length !== obj.n ||
        obj.tiles.some(
          (row) =>
            row.length !== obj.n ||
            row.some(
              (t) =>
                !["grass", "dirt", "sand", "water"].includes(t.t) ||
                !Number.isFinite(t.h),
            ),
        ) ||
        obj.players.length < 1 ||
        obj.players.length > 4 ||
        obj.entities.some(
          (e) =>
            !Number.isFinite(e.x) ||
            !Number.isFinite(e.y) ||
            (!B[e.type] &&
              !U[e.type] &&
              ![
                "tree",
                "shrub",
                "berry",
                "gold",
                "stone",
                "fish",
                "sheep",
                "deer",
                "boar",
                "wolf",
                "relic",
              ].includes(e.type)),
        )
      )
        throw Error("Invalid Crown & Tide map");
      snapshot();
      G = obj;
      G.effects = [];
      G.settings.visibility = "all";
      idSeq = Math.max(0, ...G.entities.map((e) => e.id)) + 1;
      renderEditor();
      center(G.players[0].start || { x: G.n / 2, y: G.n / 2 });
      notify("Map imported.");
    } catch (err) {
      notify("Import failed: " + err.message);
    }
  };
  $("#edPlay").onclick = () => {
    let errors = validateMap();
    if (errors.length)
      return modal("<h2>Check your map</h2><p>" + errors.join("<br>") + "</p>");
    G.designName = $("#edName").value;
    customDesign = JSON.parse(JSON.stringify(G));
    for (let p of customDesign.players) {
      let tc = customDesign.entities.find(
        (e) => e.owner === p.id && e.type === "Town Center",
      );
      p.start = { x: tc.x, y: tc.y };
    }
    startMatch(customDesign);
    notify(
      "Custom map running. Menu → Map Editor returns to your saved design.",
    );
  };
  palette();
}
function palette() {
  let list =
    editorKind === "terrain"
      ? ["grass", "dirt", "sand", "water", "raise", "lower"]
      : editorKind === "resource"
        ? [
            "tree",
            "shrub",
            "berry",
            "gold",
            "stone",
            "fish",
            "sheep",
            "deer",
            "boar",
            "wolf",
            "relic",
          ]
        : editorKind === "building"
          ? Object.keys(B)
          : editorKind === "unit"
            ? Object.keys(U).filter((t) => t !== "Cobra Car")
            : [];
  if (!list.includes(editorTool)) editorTool = list[0] || "";
  let el = $("#palette");
  el.innerHTML = "";
  for (let type of list) {
    let b = document.createElement("button");
    b.className = editorTool === type ? "active" : "";
    if (["grass", "dirt", "sand", "water", "raise", "lower"].includes(type)) {
      b.textContent = {
        grass: "▧ Grass",
        dirt: "▨ Dirt",
        sand: "▱ Sand",
        water: "≈ Water",
        raise: "↟ Raise",
        lower: "↡ Lower",
      }[type];
    } else {
      b.append(iconCanvas(type, 28));
      let s = document.createElement("div");
      s.textContent = type;
      b.append(s);
    }
    b.onclick = () => {
      editorTool = type;
      palette();
    };
    el.append(b);
  }
  $("#edPreview").innerHTML = "";
  if (editorTool) {
    $("#edPreview").append(iconCanvas(editorTool, 40));
    let s = document.createElement("span");
    s.textContent = "Placing: " + editorTool;
    $("#edPreview").append(s);
  }
}
function editorPaint(p, target, record = true) {
  if (!tile(p.x, p.y)) return;
  if (editorKind === "select") {
    if (moveObject) {
      snapshot();
      moveObject.x = p.x;
      moveObject.y = p.y;
      moveObject = null;
      notify("Object moved.");
      return;
    }
    selected = target ? [target] : [];
    moveObject = target;
    updateUI();
    if (target)
      notify(
        "Selected " +
          target.type +
          ". Click a location to move; Delete removes.",
      );
    return;
  }
  if (record) snapshot();
  if (editorKind === "terrain") {
    let xx = Math.floor(p.x),
      yy = Math.floor(p.y);
    for (let y = yy - Math.floor(brush / 2); y < yy + Math.ceil(brush / 2); y++)
      for (
        let x = xx - Math.floor(brush / 2);
        x < xx + Math.ceil(brush / 2);
        x++
      ) {
        let t = tile(x, y);
        if (t) {
          if (editorTool === "raise") t.h = clamp(t.h + 1, 0, 5);
          else if (editorTool === "lower") t.h = clamp(t.h - 1, 0, 5);
          else {
            t.t = editorTool;
            if (editorTool === "water") t.h = 0;
          }
        }
      }
  } else if (editorKind === "erase") {
    G.entities = G.entities.filter((e) => dist(e, p) > brush * 0.8);
  } else if (editorKind === "start") {
    if (editorOwner < 0) return notify("Choose a player owner first.");
    G.players[editorOwner].start = { ...p };
    let tc = G.entities.find(
      (e) => e.type === "Town Center" && e.owner === editorOwner,
    );
    if (tc) {
      tc.x = p.x;
      tc.y = p.y;
    } else entity("Town Center", p.x, p.y, editorOwner);
    notify(G.players[editorOwner].name + " start set.");
  } else {
    let type = editorTool;
    if (["building", "unit"].includes(editorKind) && editorOwner < 0)
      return notify("Units and buildings require a player owner.");
    if (type) {
      let e = entity(
        type,
        p.x,
        p.y,
        ["building", "unit"].includes(editorKind) || ["sheep"].includes(type)
          ? editorOwner
          : -1,
      );
      if (type === "Town Center") G.players[editorOwner].start = { ...p };
      if (editorKind === "resource" && brush > 1)
        for (let i = 1; i < brush; i++)
          entity(
            type,
            p.x + rand(-brush * 0.4, brush * 0.4),
            p.y + rand(-brush * 0.4, brush * 0.4),
            -1,
          );
    }
  }
  updateUI();
}
function validateMap() {
  let errors = [];
  if (G.players.length < 2) errors.push("Add at least one computer player.");
  for (let p of G.players) {
    let tc = G.entities.find(
      (e) => e.owner === p.id && e.type === "Town Center" && e.hp > 0,
    );
    if (!tc) errors.push(p.name + " needs a Town Center / starting location.");
    else if (water(tc.x, tc.y))
      errors.push(p.name + " Town Center is on water.");
  }
  let buildings = G.entities.filter((e) => e.kind === "building");
  for (let e of G.entities) {
    if (!tile(e.x, e.y)) errors.push(e.type + " is outside the map.");
    if ((e.type === "fish" || U[e.type]?.water) && !water(e.x, e.y))
      errors.push(e.type + " must be placed on water.");
    if (
      ((e.kind === "unit" && !U[e.type]?.water) ||
        (e.kind === "building" && e.type !== "Dock") ||
        e.kind === "animal") &&
      water(e.x, e.y)
    )
      errors.push(e.type + " must be placed on land.");
    if (e.type === "Dock" && (!water(e.x, e.y) || !shore(e, 3)))
      errors.push("Dock needs water beside a shoreline.");
  }
  for (let i = 0; i < buildings.length; i++)
    for (let j = i + 1; j < buildings.length; j++)
      if (
        dist(buildings[i], buildings[j]) <
        (B[buildings[i].type].size + B[buildings[j].type].size) * 0.4
      )
        errors.push(
          "Overlapping " +
            buildings[i].type +
            " and " +
            buildings[j].type +
            ".",
        );
  for (let i = 0; i < G.entities.length; i++)
    for (let j = i + 1; j < G.entities.length; j++) {
      let a = G.entities[i],
        b = G.entities[j];
      if (a.hp > 0 && b.hp > 0 && dist(a, b) < 0.2)
        errors.push("Overlapping " + a.type + " and " + b.type + ".");
      if (
        (a.kind === "building" &&
          b.type === "tree" &&
          dist(a, b) < B[a.type].size * 0.4) ||
        (b.kind === "building" &&
          a.type === "tree" &&
          dist(a, b) < B[b.type].size * 0.4)
      )
        errors.push("A tree overlaps a building.");
    }
  return [...new Set(errors)].slice(0, 15);
}
$("#openEditor").onclick = openEditor;
function hitAt(x, y) {
  let best = null,
    score = Infinity;
  for (let e of G.entities) {
    if (!alive(e) || !visibleEntity(e)) continue;
    let p = iso(e.x, e.y),
      d = Math.hypot(
        x - p.x,
        y -
          p.y +
          (e.kind === "building" ? 22 : e.kind === "unit" ? 14 : 9) * cam.z,
      ),
      r =
        (e.kind === "building"
          ? B[e.type].size * 18
          : e.type === "tree"
            ? 22
            : 16) * cam.z;
    if (d < r && d < score) {
      best = e;
      score = d;
    }
  }
  return best;
}
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("pointerdown", (e) => {
  if (!G) return;
  AudioSys.init();
  mouse = { x: e.clientX, y: e.clientY };
  let p = uniso(mouse.x, mouse.y),
    target = hitAt(mouse.x, mouse.y);
  if (e.button === 2) {
    if (editing) {
      moveObject = null;
      return;
    }
    if (buildMode) {
      buildMode = null;
      $("#placementHint").hidden = true;
      return;
    }
    commandAt(p, target, commandMode);
    return;
  }
  if (e.button === 1) {
    drag = { x: e.clientX, y: e.clientY, pan: true, cx: cam.x, cy: cam.y };
    return;
  }
  if (editing) {
    editorPaint(p, target);
    if (["terrain", "erase"].includes(editorKind))
      drag = {
        editorStroke: true,
        lastTile: Math.floor(p.x) + "," + Math.floor(p.y),
      };
    return;
  }
  if (buildMode) {
    let b = construct(buildMode, p.x, p.y);
    if (b) {
      for (let u of selected.filter((e) => e.type === "Villager"))
        setTask(u, { kind: "build", target: b.id });
      AudioSys.voice("build");
      if (!e.shiftKey) {
        buildMode = null;
        $("#placementHint").hidden = true;
      }
      updateUI();
    }
    return;
  }
  drag = {
    x: e.clientX,
    y: e.clientY,
    target,
    shift: e.shiftKey,
    selecting: false,
  };
});
window.addEventListener("pointermove", (e) => {
  mouse = { x: e.clientX, y: e.clientY };
  if (drag?.editorStroke) {
    let p = uniso(mouse.x, mouse.y),
      key = Math.floor(p.x) + "," + Math.floor(p.y);
    if (key !== drag.lastTile) {
      drag.lastTile = key;
      editorPaint(p, null, false);
    }
  } else if (drag?.pan) {
    cam.x = drag.cx - (mouse.x - drag.x);
    cam.y = drag.cy - (mouse.y - drag.y);
  } else if (drag && Math.hypot(mouse.x - drag.x, mouse.y - drag.y) > 6)
    drag.selecting = true;
});
window.addEventListener("pointerup", () => {
  if (!drag) return;
  if (drag.pan || drag.editorStroke) {
    drag = null;
    return;
  }
  if (drag.selecting) {
    let a = Math.min(mouse.x, drag.x),
      b = Math.max(mouse.x, drag.x),
      c = Math.min(mouse.y, drag.y),
      d = Math.max(mouse.y, drag.y);
    let group = G.entities.filter(
      (e) =>
        e.owner === 0 &&
        alive(e) &&
        (e.kind === "unit" || e.kind === "animal") &&
        (() => {
          let p = iso(e.x, e.y);
          return p.x > a && p.x < b && p.y > c && p.y < d;
        })(),
    );
    selected = drag.shift ? [...new Set([...selected, ...group])] : group;
  } else
    selected = drag.target
      ? drag.shift
        ? [...new Set([...selected, drag.target])]
        : [drag.target]
      : [];
  if (selected.length && selected[0].owner === 0) AudioSys.voice("select");
  menuGroup = "main";
  drag = null;
  updateUI();
});
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    let p = uniso(e.clientX, e.clientY);
    cam.z = clamp(cam.z * (e.deltaY > 0 ? 0.9 : 1.1), 0.5, 2.2);
    let q = iso(p.x, p.y);
    cam.x += q.x - e.clientX;
    cam.y += q.y - e.clientY;
  },
  { passive: false },
);
$("#minimap").onclick = (e) => {
  let r = e.target.getBoundingClientRect();
  center({
    x: ((e.clientX - r.left) / r.width) * G.n,
    y: ((e.clientY - r.top) / r.height) * G.n,
  });
};
window.addEventListener("keydown", (e) => {
  if (!G || $("#game").hidden) return;
  if (e.target.matches("input,select,textarea")) {
    if (e.target.id === "chat" && e.key === "Enter") {
      cheat(e.target.value);
      e.target.value = "";
      e.target.hidden = true;
      e.target.blur();
      e.preventDefault();
    } else if (e.target.id === "chat" && e.key === "Escape") {
      e.target.hidden = true;
      e.target.blur();
    }
    return;
  }
  if (!$("#modal").hidden) {
    if (e.key === "Escape") $("#modal").hidden = true;
    return;
  }
  if (e.key === "Enter" && !editing) {
    $("#chat").hidden = false;
    $("#chat").focus();
    e.preventDefault();
    return;
  }
  keys[e.key.toLowerCase()] = true;
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key))
    e.preventDefault();
  if (e.key === "Escape") {
    buildMode = null;
    commandMode = null;
    menuGroup = "main";
    moveObject = null;
    $("#placementHint").hidden = true;
    updateUI();
  }
  if (editing) {
    if (e.key === "Delete" || e.key === "Backspace") $("#edDelete").click();
    if ((e.ctrlKey || e.metaKey) && e.key === "z") {
      e.preventDefault();
      $(e.shiftKey ? "#edRedo" : "#edUndo").click();
    }
    return;
  }
  let k = e.key.toLowerCase();
  if (k === "h") {
    let tc = G.entities.find(
      (e) => e.owner === 0 && e.type === "Town Center" && e.hp > 0,
    );
    if (tc) {
      selected = [tc];
      center(tc);
      menuGroup = "main";
      updateUI();
      AudioSys.voice("select");
    }
  }
  if (k === "b" && selected.some((e) => e.type === "Villager")) {
    menuGroup = "economic";
    updateUI();
  }
  if (k === "v" && selected.some((e) => e.type === "Villager")) {
    menuGroup = "military";
    updateUI();
  }
  if (k === "q" && selected[0]?.type === "Town Center")
    queue(selected[0], "Villager");
  if (k === "a" && selected[0]?.type === "Town Center")
    queue(selected[0], "advance", "age");
  if (k === "t") bell();
  if (k === "u" && selected[0]?.occupants.length) {
    selected[0].type === "Transport Ship"
      ? unload(selected[0])
      : ungarrison(selected[0]);
    updateUI();
  }
  if (k === "x") {
    for (const unit of selected) setTask(unit, null);
    updateUI();
  }
  if (k === "g") commandMode = "garrison";
  if (k === "r") commandMode = "repair";
  if (e.key === " ") togglePause();
});
window.addEventListener("keyup", (e) => (keys[e.key.toLowerCase()] = false));
window.addEventListener("blur", () => (keys = {}));
function togglePause() {
  paused = !paused;
  $("#pauseBtn").textContent = paused ? "▶" : "Ⅱ";
  notify(paused ? "Chronicle paused." : "Chronicle resumed.");
}
$("#pauseBtn").onclick = togglePause;
$("#exitBtn").onclick = () => {
  if (editing) customDesign = JSON.parse(JSON.stringify(G));
  $("#game").hidden = true;
  $("#menu").hidden = false;
  paused = true;
  selected = [];
  buildMode = null;
  $("#placementHint").hidden = true;
  if (AudioSys.playing) AudioSys.playing.pause();
};
$("#setupForm").onsubmit = (e) => {
  e.preventDefault();
  startMatch();
};
$("#setupForm select[name=civ]").onchange = () => {
  $("#civBonus").textContent =
    CIV[$("#setupForm select[name=civ]").value].bonus +
    " Unique unit: " +
    CIV[$("#setupForm select[name=civ]").value].unique;
};
$("#setupForm select[name=civ]").onchange();
function frame(now) {
  let dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  if (G && !$("#game").hidden) {
    if (
      !$("#chat").matches(":focus") &&
      !document.activeElement.matches("input,select") &&
      $("#modal").hidden
    ) {
      let dx =
          (keys.d || keys.arrowright ? 1 : 0) -
          (keys.a || keys.arrowleft ? 1 : 0),
        dy =
          (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
      if (selected[0]?.type === "Town Center" && keys.a) dx = 0;
      cam.x += dx * dt * 500;
      cam.y += dy * dt * 500;
    }
    if (!paused && !editing) tick(dt * Number(G.settings.speed || 1));
    render();
    uiClock += dt;
    if (uiClock > 0.5) {
      uiClock = 0;
      updateUI();
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// Main-menu panorama is generated with the same art as the playable world.
function vista() {
  let c = $("#vista"),
    r = c.getBoundingClientRect();
  c.width = r.width * devicePixelRatio;
  c.height = r.height * devicePixelRatio;
  let v = c.getContext("2d");
  v.scale(devicePixelRatio, devicePixelRatio);
  let w = r.width,
    h = r.height,
    gradient = v.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, "#31564f");
  gradient.addColorStop(0.45, "#61836a");
  gradient.addColorStop(1, "#284a40");
  v.fillStyle = gradient;
  v.fillRect(0, 0, w, h);
  let old = G;
  G = { players: [{ color: "#61a9ba", age: 2 }], time: 0 };
  let scale = w / 610;
  v.save();
  v.translate(w * 0.5, h * 0.61);
  v.scale(scale, scale);
  for (let sum = -15; sum < 27; sum++)
    for (let x = -15; x < 16; x++) {
      let y = sum - x;
      if (y < -14 || y > 15) continue;
      let xx = (x - y) * 25,
        yy = (x + y) * 12.5;
      let waterTile = x > 5 && y < 8;
      poly(
        v,
        [
          [xx, yy],
          [xx + 25, yy + 12.5],
          [xx, yy + 25],
          [xx - 25, yy + 12.5],
        ],
        waterTile ? "#3d7982" : (x + y) % 3 === 0 ? "#718957" : "#6e8554",
      );
      if (waterTile) line(v, xx - 9, yy + 14, xx + 11, yy + 14, "#a8c9b54a");
    }
  for (let i = 0; i < 70; i++) {
    let x = Math.sin(i * 13.4) * 330,
      y = Math.cos(i * 4.7) * 180 + 80;
    if (Math.hypot(x, y) < 160 || (x > 100 && y < 100)) continue;
    treeArt(v, x, y, i % 3, 0);
  }
  for (let [type, x, y] of [
    ["Castle", -90, -55],
    ["Town Center", 0, 50],
    ["Monastery", -180, 45],
    ["Mill", -50, 160],
    ["House", 90, 110],
    ["House", -100, 125],
    ["House", -30, -25],
    ["Blacksmith", 20, 180],
    ["Barracks", -150, 185],
    ["Dock", 190, 35],
    ["Farm", -25, 205],
    ["Farm", -70, 225],
    ["House", -200, 115],
  ])
    buildingArt(
      v,
      { type, owner: 0, built: 1, hp: 9999, maxHp: 9999 },
      x,
      y,
      1.75,
      true,
    );
  unitArt(v, { type: "Galley", owner: 0, phase: 0 }, 280, 110, 2);
  unitArt(v, { type: "Fishing Ship", owner: 0, phase: 0 }, 260, -15, 1.5);
  for (let i = 0; i < 9; i++)
    unitArt(
      v,
      {
        type: i % 3 === 0 ? "Knight" : "Villager",
        owner: 0,
        phase: i,
        action: i % 2 ? "idle" : "farm",
      },
      -50 + i * 24,
      85 + Math.sin(i) * 45,
      1.2,
    );
  for (let i = 0; i < 4; i++)
    animalArt(v, { type: "sheep", phase: i }, -150 + i * 18, 80, 1.3);
  v.restore();
  G = old;
}
vista();
window.addEventListener("resize", () => {
  if (!$("#menu").hidden) vista();
});
// Test access exposes the real simulation, not a parallel mock.
window.RTS = {
  get state() {
    return G;
  },
  get selected() {
    return selected;
  },
  get editing() {
    return editing;
  },
  get audio() {
    return AudioSys;
  },
  generate,
  startMatch,
  tick,
  entity,
  setTask,
  construct,
  queue,
  pathfind,
  damage,
  cheat,
  bell,
  garrison,
  ungarrison,
  unload,
  validateMap,
  openEditor,
  editorPaint,
  updateVisibility,
  updateUI,
  center,
  iso,
  uniso,
  render,
  commandAt,
  aiUpdate,
  tradeStep,
  attack,
  prerequisites,
  saveDesign() {
    customDesign = JSON.parse(JSON.stringify(G));
    localStorage.setItem("crownMap", JSON.stringify(G));
  },
  select(ids) {
    selected = G.entities.filter((e) => ids.includes(e.id));
    updateUI();
  },
  pause(v = true) {
    paused = v;
  },
  setCamera(v) {
    Object.assign(cam, v);
  },
};
