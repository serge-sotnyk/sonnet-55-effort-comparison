"use strict";
(() => {
  const $ = (s) => document.querySelector(s),
    canvas = $("#world"),
    ctx = canvas.getContext("2d"),
    mini = $("#minimap"),
    mctx = mini.getContext("2d");
  const WORLD = 52,
    TW = 76,
    TH = 38,
    TEAM = "#e1c780",
    ENEMY = "#bc6453";
  const RES = {
    food: {
      name: "Food",
      color: "#b29758",
      path: '<path d="M13 24V7m0 10C4 17 3 9 3 9c9 0 10 8 10 8m0-5C5 12 5 4 5 4c8 1 8 8 8 8m0 8c9 0 10-8 10-8-9 0-10 8-10 8m0-7c8 0 8-9 8-9-8 1-8 9-8 9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    },
    wood: {
      name: "Wood",
      color: "#7a8d62",
      path: '<path d="M12 2L3 13h4l-5 7h9v6h3v-6h9l-5-7h4L13 2z" fill="currentColor"/><path d="M12 8v12" stroke="#f4f2e6" stroke-width=".8"/>',
    },
    gold: {
      name: "Gold",
      color: "#c5a251",
      path: '<path d="M4 17l5-8h10l5 8-3 7H7z" fill="currentColor"/><path d="M9 9l3 8h12M4 17h8l-5 7m5-7 7-8" fill="none" stroke="#f4f2e6" stroke-width="1"/>',
    },
    stone: {
      name: "Stone",
      color: "#8d9587",
      path: '<path d="M3 20l3-10 8-5 9 6 2 12-13 3z" fill="currentColor"/><path d="M6 10l7 7 10-6M13 17l-1 9" fill="none" stroke="#f4f2e6" stroke-width="1"/>',
    },
    pop: {
      name: "Population",
      color: "#74816a",
      path: '<circle cx="13" cy="8" r="4" fill="currentColor"/><path d="M5 25v-7c0-7 16-7 16 0v7z" fill="currentColor"/><circle cx="23" cy="11" r="3" fill="currentColor"/><path d="M23 17c5 0 5 5 5 8h-4" fill="currentColor"/>',
    },
  };
  const BUILDINGS = {
    town: {
      name: "Town center",
      cost: { wood: 300, stone: 200 },
      hp: 1800,
      size: 3,
      time: 42,
      age: 1,
      description:
        "The heart of your kingdom. Trains villagers, supports 10 population, and fires on nearby enemies.",
      key: "T",
    },
    house: {
      name: "House",
      cost: { wood: 50 },
      hp: 400,
      size: 2,
      time: 12,
      age: 1,
      description:
        "A home for your people. Adds 5 to your population capacity.",
      key: "Q",
    },
    mill: {
      name: "Mill",
      cost: { wood: 100 },
      hp: 550,
      size: 2,
      time: 18,
      age: 1,
      description:
        "Gathering food near a mill is 25% faster. Unlocks fertile farms.",
      key: "F",
    },
    lumber: {
      name: "Lumber camp",
      cost: { wood: 100 },
      hp: 500,
      size: 2,
      time: 16,
      age: 1,
      description: "Gathering wood near a lumber camp is 25% faster.",
      key: "E",
    },
    farm: {
      name: "Farm",
      cost: { wood: 60 },
      hp: 300,
      size: 2,
      time: 8,
      age: 1,
      description:
        "A renewable supply of food. Assign a villager to work the field.",
      key: "R",
    },
    barracks: {
      name: "Barracks",
      cost: { wood: 150 },
      hp: 1000,
      size: 3,
      time: 25,
      age: 1,
      description:
        "Train militia to protect your borders. Soldiers improve as you advance.",
      key: "B",
    },
    archery: {
      name: "Archery range",
      cost: { wood: 175 },
      hp: 900,
      size: 3,
      time: 25,
      age: 2,
      description:
        "Train archers. Ranged troops excel behind a line of infantry.",
    },
    stable: {
      name: "Stable",
      cost: { wood: 175 },
      hp: 1100,
      size: 3,
      time: 25,
      age: 2,
      description:
        "Train swift, powerful knights. Ideal for raids and pursuing archers.",
    },
    tower: {
      name: "Watchtower",
      cost: { wood: 75, stone: 100 },
      hp: 1400,
      size: 2,
      time: 30,
      age: 2,
      description:
        "Defends your settlement with arrows. Long range and sturdy stone walls.",
    },
    workshop: {
      name: "Siege workshop",
      cost: { wood: 200, gold: 100 },
      hp: 1000,
      size: 3,
      time: 30,
      age: 3,
      description: "Train siege rams that devastate enemy buildings.",
    },
    castle: {
      name: "Castle",
      cost: { stone: 500, wood: 200 },
      hp: 3600,
      size: 4,
      time: 55,
      age: 3,
      description:
        "A mighty fortress. Fires volleys of arrows and supports 10 population.",
    },
  };
  const UNITS = {
    villager: {
      name: "Villager",
      cost: { food: 50 },
      hp: 55,
      attack: 4,
      range: 0.8,
      speed: 1.35,
      time: 12,
      from: "town",
      age: 1,
      description:
        "Builds your settlement and gathers food, wood, gold, or stone.",
    },
    militia: {
      name: "Man-at-arms",
      cost: { food: 60, gold: 20 },
      hp: 105,
      attack: 13,
      range: 1,
      speed: 1.45,
      time: 16,
      from: "barracks",
      age: 1,
      description:
        "Dependable infantry. Strong against buildings and other infantry.",
    },
    archer: {
      name: "Archer",
      cost: { wood: 30, gold: 40 },
      hp: 65,
      attack: 10,
      range: 5.5,
      speed: 1.45,
      time: 17,
      from: "archery",
      age: 2,
      description:
        "Attacks from a distance. Keep protected from enemy cavalry.",
    },
    knight: {
      name: "Knight",
      cost: { food: 80, gold: 70 },
      hp: 210,
      attack: 22,
      range: 1.3,
      speed: 2.1,
      time: 24,
      from: "stable",
      age: 2,
      description: "Armored cavalry with high health and speed.",
    },
    ram: {
      name: "Siege ram",
      cost: { wood: 120, gold: 100 },
      hp: 320,
      attack: 42,
      range: 1.5,
      speed: 0.8,
      time: 30,
      from: "workshop",
      age: 3,
      description:
        "Deals triple damage to buildings. Needs an army to protect it.",
    },
    scout: {
      name: "Scout",
      cost: { food: 70 },
      hp: 100,
      attack: 8,
      range: 1.1,
      speed: 2.6,
      time: 18,
      from: "stable",
      age: 1,
      description:
        "Fast cavalry with a wide field of vision. Explore the realm.",
    },
  };
  const AGES = [
    null,
    { name: "Darkness", label: "Dark Age" },
    {
      name: "Discovery",
      label: "Feudal Age",
      cost: { food: 400, gold: 100 },
      time: 45,
    },
    {
      name: "Fortresses",
      label: "Castle Age",
      cost: { food: 700, gold: 300 },
      time: 60,
    },
    {
      name: "Empires",
      label: "Imperial Age",
      cost: { food: 1000, gold: 600 },
      time: 75,
    },
  ];
  const TECHS = {
    tools: {
      name: "Forged tools",
      cost: { wood: 100, food: 100 },
      age: 1,
      description: "All villagers gather resources 25% faster.",
    },
    armor: {
      name: "Iron armor",
      cost: { food: 150, gold: 100 },
      age: 2,
      description: "All military units gain 30% health.",
    },
    weapons: {
      name: "Steel weapons",
      cost: { wood: 150, gold: 150 },
      age: 2,
      description: "All military units deal 25% more damage.",
    },
  };
  let state,
    camera = { x: 0, y: 0, zoom: 1 },
    selection = [],
    tab = "build",
    placement = null,
    pointer = { x: 0, y: 0, wx: 0, wy: 0 },
    drag = null,
    keys = {},
    paused = true,
    speed = 1,
    started = false,
    soundEnabled = false,
    audioCtx = null,
    lastTime = 0,
    uiTimer = 0,
    visionTimer = 0,
    saveTimer = 0,
    toastTimer = 0,
    terrain,
    terrainOrigin,
    fogLayer = null,
    fogDirty = true,
    particles = [],
    projectiles = [],
    decor = [],
    enemySeen = false,
    screenW = 0,
    screenH = 0,
    dpr = 1,
    modalWasPaused = true;
  let seed = 7412;
  function rand() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  function iso(x, y) {
    return { x: ((x - y) * TW) / 2, y: ((x + y) * TH) / 2 };
  }
  function uniso(x, y) {
    return { x: x / TW + y / TH, y: y / TH - x / TW };
  }
  function screen(x, y) {
    const p = iso(x, y);
    return {
      x: (p.x - camera.x) * camera.zoom + screenW / 2,
      y: (p.y - camera.y) * camera.zoom + screenH / 2,
    };
  }
  function world(sx, sy) {
    return uniso(
      (sx - screenW / 2) / camera.zoom + camera.x,
      (sy - screenH / 2) / camera.zoom + camera.y,
    );
  }
  function newId() {
    return ++state.uid;
  }
  function costString(cost) {
    return Object.entries(cost || {})
      .map(([r, n]) => `${n} ${r}`)
      .join(" · ");
  }
  function canAfford(cost, team = 0) {
    return Object.entries(cost || {}).every(
      ([r, n]) => state.resources[team][r] >= n,
    );
  }
  function pay(cost, team = 0) {
    for (const [r, n] of Object.entries(cost || {}))
      state.resources[team][r] -= n;
  }
  function getEntity(id) {
    return (
      state.units.find((e) => e.id === id) ||
      state.buildings.find((e) => e.id === id) ||
      state.nodes.find((e) => e.id === id)
    );
  }
  function completed(team, type) {
    return state.buildings.filter(
      (b) =>
        b.team === team &&
        !b.dead &&
        b.progress >= 1 &&
        (!type || b.type === type),
    );
  }
  function population(team) {
    return state.units.filter((u) => u.team === team && !u.dead).length;
  }
  function capacity(team) {
    return completed(team).reduce(
      (n, b) =>
        n +
        (b.type === "town"
          ? 10
          : b.type === "house"
            ? 5
            : b.type === "castle"
              ? 10
              : 0),
      0,
    );
  }
  function ageStats(team) {
    return 1 + (state.age[team] - 1) * 0.22;
  }
  function militaryCount(team) {
    return state.units.filter(
      (u) => u.team === team && !u.dead && u.type !== "villager",
    ).length;
  }
  function addBuilding(type, x, y, team = 0, built = true) {
    const def = BUILDINGS[type];
    let b = {
      id: newId(),
      kind: "building",
      type,
      x,
      y,
      team,
      hp: built ? def.hp : 20,
      maxHp: def.hp,
      size: def.size,
      progress: built ? 1 : 0,
      queue: [],
      rally: { x: x + def.size * 0.6, y: y + def.size * 0.6 },
      cooldown: 0,
      dead: false,
    };
    state.buildings.push(b);
    return b;
  }
  function addUnit(type, x, y, team = 0) {
    let def = UNITS[type],
      mult = type === "villager" ? 1 : ageStats(team),
      hp =
        def.hp *
        mult *
        (type !== "villager" && state.tech[team].armor ? 1.3 : 1);
    let u = {
      id: newId(),
      kind: "unit",
      type,
      x,
      y,
      team,
      hp,
      maxHp: hp,
      task: "idle",
      target: null,
      move: null,
      path: [],
      cooldown: 0,
      carry: 0,
      gatherType: null,
      anim: rand() * 10,
      dead: false,
    };
    state.units.push(u);
    return u;
  }
  function node(type, x, y, amount) {
    let n = {
      id: newId(),
      kind: "node",
      type,
      x,
      y,
      amount,
      maxAmount: amount,
      variant: Math.floor(rand() * 5),
      dead: false,
    };
    state.nodes.push(n);
    return n;
  }
  function initGame() {
    $("#toast-container").innerHTML = "";
    $("#tooltip").classList.add("hidden");
    $(".chapter-panel h1").textContent = "A humble beginning.";
    $("#commands").dataset.content = "";
    toastTimer = 0;
    seed = 7412;
    state = {
      uid: 0,
      time: 0,
      resources: [
        { food: 240, wood: 340, gold: 180, stone: 180 },
        { food: 700, wood: 800, gold: 500, stone: 600 },
      ],
      age: [1, 1],
      tech: [{}, {}],
      advancing: [null, null],
      units: [],
      buildings: [],
      nodes: [],
      explored: Array(WORLD * WORLD).fill(0),
      visible: Array(WORLD * WORLD).fill(0),
      ai: { timer: 0, raid: 150, raidCount: 0, buildTimer: 15, trainTimer: 5 },
      stats: { kills: 0, lost: 0, gathered: 0, built: 0 },
      over: null,
    };
    particles = [];
    projectiles = [];
    enemySeen = false;
    addBuilding("town", 15, 32);
    addBuilding("house", 19, 32);
    addBuilding("house", 15, 37);
    addBuilding("mill", 12, 36);
    addBuilding("lumber", 11, 29);
    const tc = addBuilding("town", 39, 16, 1);
    addBuilding("house", 43, 16, 1);
    addBuilding("house", 40, 21, 1);
    addBuilding("barracks", 36, 20, 1);
    addBuilding("mill", 43, 21, 1);
    addBuilding("lumber", 35, 13, 1);
    const clusters = [
      ["wood", 7, 25, 26],
      ["wood", 22, 26, 24],
      ["wood", 8, 39, 20],
      ["wood", 25, 40, 30],
      ["wood", 34, 10, 26],
      ["wood", 45, 24, 25],
      ["wood", 30, 26, 28],
      ["wood", 17, 15, 23],
      ["wood", 6, 10, 30],
      ["wood", 39, 40, 25],
      ["wood", 47, 43, 23],
      ["wood", 15, 47, 22],
      ["wood", 27, 6, 20],
    ];
    for (const [type, x, y, count] of clusters)
      for (let i = 0; i < count; i++) {
        let a = rand() * Math.PI * 2,
          r = Math.sqrt(rand()) * 4.2;
        node(
          type,
          x + Math.cos(a) * r,
          y + Math.sin(a) * r,
          180 + rand() * 100,
        );
      }
    for (const [type, x, y, count] of [
      ["food", 9, 34, 9],
      ["gold", 20, 36, 7],
      ["stone", 21, 30, 6],
      ["food", 43, 13, 8],
      ["gold", 34, 17, 8],
      ["stone", 41, 11, 6],
      ["food", 28, 32, 7],
      ["gold", 30, 44, 7],
      ["stone", 13, 18, 6],
      ["gold", 26, 21, 6],
    ])
      for (let i = 0; i < count; i++)
        node(
          type,
          x + (rand() - 0.5) * 3,
          y + (rand() - 0.5) * 3,
          type === "food" ? 250 : 650,
        );
    state.nodes = state.nodes.filter((n) => !blocked(n.x, n.y));
    for (let i = 0; i < 7; i++) {
      let u = addUnit(
        "villager",
        14 + (i % 3) * 0.7,
        34 + Math.floor(i / 3) * 0.8,
      );
      let resource = i < 3 ? "food" : i < 6 ? "wood" : "gold";
      assignGather(u, nearestNode(u, resource));
    }
    let scout = addUnit("scout", 19, 35);
    for (let i = 0; i < 8; i++) {
      let u = addUnit(
        "villager",
        38 + (i % 3),
        18 + Math.floor(i / 3) * 0.6,
        1,
      );
      assignGather(u, nearestNode(u, i < 3 ? "food" : i < 6 ? "wood" : "gold"));
    }
    addUnit("militia", 36, 18, 1);
    addUnit("militia", 37, 18, 1);
    decor = [];
    for (let i = 0; i < 350; i++)
      decor.push({
        x: rand() * WORLD,
        y: rand() * WORLD,
        type: rand() < 0.4 ? "flower" : "grass",
        variant: rand(),
      });
    for (let i = 0; i < 10; i++)
      decor.push({
        x: 25 + rand() * 8,
        y: 31 + rand() * 5,
        type: "deer",
        variant: rand(),
      });
    selection = [state.buildings[0].id];
    tab = "build";
    placement = null;
    camera = { ...iso(15, 32), zoom: Math.min(1.08, screenW / 1200 + 0.18) };
    camera.y += 38;
    reveal();
    buildTerrain();
    updateUI();
  }
  function nearestNode(u, type) {
    let nodes = state.nodes.filter(
      (n) => n.type === type && !n.dead && n.amount > 0,
    );
    if (type === "food")
      nodes = nodes.concat(completed(u.team, "farm").map((b) => b));
    return nodes.sort((a, b) => distance(u, a) - distance(u, b))[0];
  }
  function svgIcon(type) {
    const start =
        '<svg viewBox="0 0 64 52" xmlns="http://www.w3.org/2000/svg">',
      end = "</svg>";
    if (type === "villager")
      return (
        start +
        '<path d="M21 46l3-16h15l4 16" fill="#7b8a6d"/><path d="M24 32l-8 10m21-10 9 8" stroke="#c2ae87" stroke-width="5"/><circle cx="31" cy="21" r="8" fill="#d5bf94"/><path d="M21 20q10-17 21 0z" fill="#9a8455"/><path d="M17 43l30-24" stroke="#8b7850" stroke-width="2"/>' +
        end
      );
    if (["militia", "archer", "knight", "scout", "ram"].includes(type)) {
      if (type === "ram")
        return (
          start +
          '<path d="M11 34l7-18 30 2 8 20-37 3z" fill="#927a52"/><path d="M18 16l25 1 10 14-28-1z" fill="#5e7363"/><path d="M5 33h49" stroke="#c8b995" stroke-width="5"/><circle cx="19" cy="42" r="5" fill="#646657"/><circle cx="47" cy="43" r="5" fill="#646657"/>' +
          end
        );
      return (
        start +
        (["knight", "scout"].includes(type)
          ? '<path d="M12 35q2-16 17-13l11 3 5-12 6 1-2 20-10 2-2 12h-5V36l-13 1-3 11h-5z" fill="#9c8c70"/>'
          : "") +
        '<path d="M25 43l2-19h12l4 19z" fill="#667d69"/><circle cx="33" cy="18" r="7" fill="#cab99b"/><path d="M25 18q0-12 8-12t8 12" fill="#9aa397"/><path d="M42 36l9-27" stroke="#8e988d" stroke-width="3"/>' +
        (type === "archer"
          ? '<path d="M46 13q14 10 0 23z" fill="none" stroke="#9c8154" stroke-width="2"/>'
          : '<path d="M20 28l9 2-1 12-5 4-6-7z" fill="#c1ac6c" stroke="#897c57"/>') +
        end
      );
    }
    if (type === "age")
      return (
        start +
        '<path d="M9 15l12 11 11-18 10 18 13-11-6 28H16z" fill="#c1a065"/><path d="M16 47h33" stroke="#c1a065" stroke-width="3"/><circle cx="32" cy="30" r="4" fill="#ece8d6"/>' +
        end
      );
    if (type === "tools" || type === "weapons" || type === "armor")
      return (
        start +
        (type === "armor"
          ? '<path d="M17 9l10-4 6 7 6-7 10 4-5 14-5-3 4 24H22l3-24-5 3z" fill="#91a089" stroke="#697b61"/>'
          : '<path d="M17 44L43 9" stroke="#8b7851" stroke-width="5"/><path d="M27 12l12-8 14 9-3 8-12-6-5 5z" fill="#91a089" stroke="#697b61"/>') +
        end
      );
    if (type === "farm")
      return (
        start +
        '<path d="M7 28l24-14 26 14-25 15z" fill="#a49563"/>' +
        [0, 1, 2, 3, 4]
          .map(
            (i) =>
              `<path d="M${12 + i * 5} ${29 - i * 2.8}l23 13" stroke="#75844e" stroke-width="3"/>`,
          )
          .join("") +
        end
      );
    if (type === "lumber")
      return (
        start +
        '<path d="M7 29l14-9 20 10-14 9z" fill="#b6a078"/><path d="M7 29v11l20 11V39m0 0 14-9v11L27 51" fill="#a28d68"/><path d="M5 27l16-14 23 13-17 14z" fill="#6e8067"/><path d="M43 5l-8 15h5l-7 10h20l-7-10h5z" fill="#87946e"/><path d="M43 28v15" stroke="#8d7952" stroke-width="3"/>' +
        end
      );
    if (type === "tower" || type === "castle")
      return (
        start +
        '<path d="M16 12l9-5 21 10v29l-9 5-21-10z" fill="#a3ab98"/><path d="M16 12v29l21 10V22z" fill="#c6c6ac"/><path d="M16 12l9-5 21 10-9 5z" fill="#d8d6ba"/><path d="M16 12V5l5 2v8m5 1V9l5 2v8m6 3v-7l5 2v7m0-7 4-2v7" fill="none" stroke="#bcc1a8" stroke-width="5"/><path d="M25 29v10l5 3V32z" fill="#697664"/><path d="M27 7V0l14 3-14 4" fill="#bba365"/>' +
        end
      );
    let roof =
      type === "town"
        ? "#63766b"
        : type === "barracks" || type === "archery"
          ? "#7b8170"
          : "#b38f69";
    return (
      start +
      `<path d="M10 28l20-12 24 13-20 12z" fill="#c4b795"/><path d="M10 28v13l24 10V36z" fill="#d2c4a4"/><path d="M34 36l20-11v15L34 51z" fill="#a9a285"/><path d="M6 26l15-16 17 7 21 9-25 15z" fill="${roof}"/><path d="M21 10l17 7 21 9-18-15z" fill="#859280"/><path d="M27 48V35l7 3v13" fill="#7c8068"/><path d="M15 31v13m-5-7 17 7" stroke="#998d6c" stroke-width="2"/>` +
      (type === "mill"
        ? '<path d="M42 4v33M27 20h30M31 9l24 24M30 32 54 9" stroke="#e0d5b5" stroke-width="3"/><circle cx="42" cy="20" r="3" fill="#8c835f"/>'
        : type === "town"
          ? '<path d="M28 15V0l15 3-15 6" fill="#bda064"/>'
          : "") +
      end
    );
  }
  function toast(message, alert = false) {
    let e = document.createElement("div");
    e.className = "toast" + (alert ? " alert" : "");
    e.textContent = message;
    $("#toast-container").append(e);
    while ($("#toast-container").children.length > 3)
      $("#toast-container").firstElementChild.remove();
    setTimeout(() => e.remove(), 4200);
    if (alert) tone(180, 0.1, "triangle");
  }
  function tone(freq, duration = 0.04, type = "sine", vol = 0.035) {
    if (!soundEnabled) return;
    try {
      audioCtx =
        audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      let o = audioCtx.createOscillator(),
        g = audioCtx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(
        0.001,
        audioCtx.currentTime + duration,
      );
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  }
  function start() {
    started = true;
    paused = false;
    $("#modal-root").innerHTML = "";
    $("#status-text").textContent = "A kingdom in the making";
    tone(440, 0.15);
    toast(
      "Your villagers are gathering. Build a barracks to prepare your army.",
    );
    lastTime = performance.now();
  }
  function showModal(html) {
    modalWasPaused = paused;
    paused = true;
    $("#modal-root").innerHTML =
      `<div class="modal-shade"><div class="modal">${html}</div></div>`;
  }
  function closeModal() {
    $("#modal-root").innerHTML = "";
    paused = modalWasPaused;
    lastTime = performance.now();
  }
  function welcome() {
    showModal(
      `<div class="crown-illustration">${svgIcon("age")}</div><div class="eyebrow">THE FIRST CHAPTER OF YOUR REIGN</div><h2>A kingdom starts with you.</h2><p>Seven villagers. An open frontier. A rival beyond the woods.<br>Turn a small settlement into an empire worth remembering.</p><div class="welcome-features"><div><strong>Gather & grow</strong><span>Build a thriving<br>medieval economy.</span></div><div><strong>Forge an army</strong><span>Advance through<br>four historic ages.</span></div><div><strong>Claim the realm</strong><span>Defeat the rival<br>House Ashford.</span></div></div><button class="primary-button" id="begin-btn">Begin your reign <span>→</span></button>${localStorage.getItem("crownfall-save-v1") ? '<button class="secondary-button" id="continue-btn">Continue your saved reign</button>' : ""}<div class="modal-note">A complete solo skirmish · About 20–35 minutes · Progress saves automatically</div>`,
    );
    $("#begin-btn").onclick = start;
    if ($("#continue-btn"))
      $("#continue-btn").onclick = () => {
        if (loadGame()) start();
        else toast("The saved kingdom could not be loaded.");
      };
  }
  function guide() {
    showModal(
      `<button class="close" id="close-modal">×</button><div class="eyebrow">THE ROYAL FIELD GUIDE</div><h2>The art of building a kingdom.</h2><div class="guide-grid"><div><strong>01 · Command your people</strong><p>Left click to select. Drag to select an army. Right click to move, attack, gather, or build. Double click selects nearby units of the same type.</p></div><div><strong>02 · Build an economy</strong><p>Villagers gather automatically once assigned. Right click trees, berries, ore, or farms. Camps speed up nearby gathering. Houses add population.</p></div><div><strong>03 · Raise your army</strong><p>Build a barracks, then use Military to train infantry. Later ages unlock archers, knights, towers, castles, and siege rams.</p></div><div><strong>04 · Claim victory</strong><p>Explore northeast with your scout. Destroy Ashford’s town center to win. Keep your own town center standing. Enemy raids grow stronger with time.</p></div><div><strong>Useful keys</strong><p>WASD / arrows: pan · Scroll: zoom<br>H: home · Space: pause · Esc: cancel<br>1: idle villagers · 2: entire army<br>Shift + click a training button: train 5</p></div><div><strong>Tips from your steward</strong><p>Keep training villagers. Build farms before berries run out. Advancing improves your soldiers. Research tools early and bring siege to the final attack.</p></div></div><button class="primary-button" id="close-guide">Return to your kingdom</button>`,
    );
    $("#close-modal").onclick = closeModal;
    $("#close-guide").onclick = closeModal;
  }
  function settings() {
    showModal(
      `<button class="close" id="close-modal">×</button><div class="eyebrow">THE KINGDOM IS AT REST</div><h2>A moment to reflect.</h2><p>Your settlement is safe while this menu is open.</p><button class="primary-button" id="resume">Return to your kingdom</button><button class="secondary-button" id="save">Save this kingdom</button><button class="secondary-button" id="load">Load saved kingdom</button><button class="secondary-button" id="new">Start a new reign</button><div class="modal-note">Saves stay in this browser. Autosave runs every 30 seconds.</div>`,
    );
    $("#close-modal").onclick = closeModal;
    $("#resume").onclick = closeModal;
    $("#save").onclick = () => {
      saveGame();
      toast("Your kingdom has been saved.");
      closeModal();
    };
    $("#load").onclick = () => {
      if (loadGame()) {
        closeModal();
        started = true;
        paused = false;
        toast("Your kingdom has been restored.");
      } else toast("No saved kingdom was found.");
    };
    $("#new").onclick = () => {
      initGame();
      closeModal();
      started = true;
      paused = false;
      toast("A new chapter begins.");
    };
  }
  function saveGame() {
    if (!started || state.over) return;
    try {
      localStorage.setItem(
        "crownfall-save-v1",
        JSON.stringify({ state, camera, decor, speed }),
      );
    } catch (e) {}
  }
  function loadGame() {
    try {
      let data = JSON.parse(localStorage.getItem("crownfall-save-v1"));
      if (!data?.state?.units) return false;
      state = data.state;
      camera = data.camera;
      decor = data.decor;
      speed = data.speed || 1;
      selection = [completed(0, "town")[0]?.id].filter(Boolean);
      placement = null;
      particles = [];
      projectiles = [];
      $("#toast-container").innerHTML = "";
      reveal();
      buildTerrain();
      updateUI();
      return true;
    } catch (e) {
      return false;
    }
  }
  function endGame(winner) {
    state.over = winner === 0 ? "victory" : "defeat";
    paused = true;
    showModal(
      `<div class="crown-illustration">${svgIcon("age")}</div><div class="eyebrow">${winner === 0 ? "THE REALM IS YOURS" : "EVERY KINGDOM HAS ITS STORY"}</div><h2>${winner === 0 ? "Long live your kingdom." : "Your reign has ended."}</h2><p>${winner === 0 ? "House Ashford has fallen. Your people have found a home,<br>and your name will echo through the borderlands." : "Your town center has fallen to House Ashford.<br>Gather your courage, and begin again."}</p><div class="welcome-features"><div><strong>${Math.floor(state.time / 60)} min</strong><span>Length of reign</span></div><div><strong>${state.stats.kills}</strong><span>Enemies defeated</span></div><div><strong>${state.stats.built}</strong><span>Buildings raised</span></div></div><button class="primary-button" id="play-again">Begin another chapter →</button>`,
    );
    $("#play-again").onclick = () => {
      initGame();
      start();
    };
  }
  function blocked(x, y, ignoreId = null) {
    if (x < 1 || y < 1 || x > WORLD - 2 || y > WORLD - 2) return true;
    return state.buildings.some(
      (b) =>
        !b.dead &&
        b.id !== ignoreId &&
        b.type !== "farm" &&
        Math.abs(x - b.x) < b.size / 2 + 0.1 &&
        Math.abs(y - b.y) < b.size / 2 + 0.1,
    );
  }
  function findPath(u, goal, ignoreId = null) {
    let gx = Math.max(1, Math.min(WORLD - 2, Math.round(goal.x))),
      gy = Math.max(1, Math.min(WORLD - 2, Math.round(goal.y)));
    if (blocked(gx, gy, ignoreId)) {
      let opts = [];
      for (let dx = -3; dx <= 3; dx++)
        for (let dy = -3; dy <= 3; dy++)
          if (!blocked(gx + dx, gy + dy, ignoreId))
            opts.push({ x: gx + dx, y: gy + dy });
      opts.sort(
        (a, b) =>
          distance(a, goal) +
          distance(a, u) * 0.05 -
          distance(b, goal) -
          distance(b, u) * 0.05,
      );
      if (opts.length) {
        gx = opts[0].x;
        gy = opts[0].y;
      } else return [];
    }
    let sx = Math.round(u.x),
      sy = Math.round(u.y),
      start = sy * WORLD + sx,
      end = gy * WORLD + gx,
      open = [start],
      came = {},
      g = { [start]: 0 },
      f = { [start]: Math.hypot(gx - sx, gy - sy) },
      closed = new Set(),
      iterations = 0;
    while (open.length && iterations++ < 1400) {
      open.sort((a, b) => f[a] - f[b]);
      let cur = open.shift();
      if (cur === end) {
        let path = [];
        while (cur !== start) {
          path.push({ x: cur % WORLD, y: Math.floor(cur / WORLD) });
          cur = came[cur];
        }
        path.reverse();
        if (!blocked(goal.x, goal.y, ignoreId)) path.push({ ...goal });
        return path;
      }
      closed.add(cur);
      let x = cur % WORLD,
        y = Math.floor(cur / WORLD);
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++) {
          if (!dx && !dy) continue;
          let nx = x + dx,
            ny = y + dy;
          if (blocked(nx, ny, ignoreId)) continue;
          if (
            dx &&
            dy &&
            (blocked(x + dx, y, ignoreId) || blocked(x, y + dy, ignoreId))
          )
            continue;
          let ni = ny * WORLD + nx;
          if (closed.has(ni)) continue;
          let score = g[cur] + (dx && dy ? 1.414 : 1);
          if (g[ni] === undefined || score < g[ni]) {
            came[ni] = cur;
            g[ni] = score;
            f[ni] = score + Math.hypot(gx - nx, gy - ny);
            if (!open.includes(ni)) open.push(ni);
          }
        }
    }
    return [{ x: gx, y: gy }];
  }
  function moveTo(u, pos) {
    u.move = {
      x: Math.max(0.5, Math.min(WORLD - 0.5, pos.x)),
      y: Math.max(0.5, Math.min(WORLD - 0.5, pos.y)),
    };
    u.path = findPath(u, u.move);
    u.repath = 1.3;
  }
  function approach(u, target, range, dt) {
    if (distance(u, target) <= range) {
      u.path = [];
      u.move = null;
      return true;
    }
    u.repath = (u.repath || 0) - dt;
    if (!u.path.length || u.repath <= 0) {
      let a = Math.atan2(u.y - target.y, u.x - target.x),
        p = {
          x: target.x + Math.cos(a) * range * 0.86,
          y: target.y + Math.sin(a) * range * 0.86,
        };
      moveTo(u, p);
    }
    walk(u, dt);
    return false;
  }
  function walk(u, dt) {
    if (!u.path.length) return;
    let p = u.path[0],
      dx = p.x - u.x,
      dy = p.y - u.y,
      len = Math.hypot(dx, dy),
      step = UNITS[u.type].speed * dt;
    if (len < step + 0.05) {
      u.x = p.x;
      u.y = p.y;
      u.path.shift();
    } else {
      u.x += (dx / len) * step;
      u.y += (dy / len) * step;
    }
    u.facing = dx + dy;
    u.anim += dt * 8;
  }
  function assignGather(u, n) {
    if (!n) return;
    u.task = "gather";
    u.target = n.id;
    u.gatherType = n.kind === "building" ? "food" : n.type;
    u.carry = 0;
    u.path = [];
    u.move = null;
    moveTo(u, n);
  }
  function commandUnits(target, pos) {
    let units = selection
      .map(getEntity)
      .filter((e) => e?.kind === "unit" && e.team === 0 && !e.dead);
    if (!units.length) {
      let b = selection
        .map(getEntity)
        .find((e) => e?.kind === "building" && e.team === 0);
      if (b) {
        b.rally = pos;
        toast("Rally point set.");
        particles.push({
          type: "rally",
          x: pos.x,
          y: pos.y,
          life: 1.5,
          max: 1.5,
        });
      }
      return;
    }
    units.forEach((u, i) => {
      u.path = [];
      u.carry = 0;
      if (target?.team === 1) {
        u.task = "attack";
        u.target = target.id;
        u.strategicTarget = null;
        moveTo(u, target);
      } else if (u.type === "villager" && target?.kind === "node") {
        assignGather(u, target);
      } else if (
        u.type === "villager" &&
        target?.kind === "building" &&
        target.team === 0 &&
        target.progress < 1
      ) {
        u.task = "build";
        u.target = target.id;
        moveTo(u, target);
      } else if (
        u.type === "villager" &&
        target?.kind === "building" &&
        target.type === "farm" &&
        target.team === 0
      ) {
        assignGather(u, target);
      } else if (
        u.type === "villager" &&
        target?.kind === "building" &&
        target.team === 0 &&
        target.hp < target.maxHp
      ) {
        u.task = "repair";
        u.target = target.id;
        moveTo(u, target);
      } else {
        u.task = "move";
        u.target = null;
        let offset =
          units.length > 1
            ? {
                x: ((i % 5) - 2) * 0.55,
                y: (Math.floor(i / 5) - Math.floor(units.length / 10)) * 0.55,
              }
            : { x: 0, y: 0 };
        moveTo(u, { x: pos.x + offset.x, y: pos.y + offset.y });
      }
    });
    particles.push({
      type: target?.team === 1 ? "attackMarker" : "rally",
      x: pos.x,
      y: pos.y,
      life: 0.8,
      max: 0.8,
    });
    tone(330, 0.045);
  }
  function train(type, team = 0) {
    let def = UNITS[type];
    if (state.age[team] < def.age) {
      if (team === 0) toast(`Requires the ${AGES[def.age].label}.`);
      return false;
    }
    let buildings = completed(team, def.from).sort(
      (a, b) => a.queue.length - b.queue.length,
    );
    let selected = selection
      .map(getEntity)
      .find((b) => b?.type === def.from && b.progress >= 1);
    let b = team === 0 && selected?.team === 0 ? selected : buildings[0];
    if (!b) {
      if (team === 0)
        toast(`Build a ${BUILDINGS[def.from].name.toLowerCase()} first.`);
      return false;
    }
    let queued = state.buildings
      .filter((e) => e.team === team)
      .reduce((n, e) => n + e.queue.length, 0);
    if (population(team) + queued >= capacity(team)) {
      if (team === 0) toast("Build more houses to support your people.");
      return false;
    }
    if (!canAfford(def.cost, team)) {
      if (team === 0) toast("You need more resources to train this unit.");
      return false;
    }
    pay(def.cost, team);
    b.queue.push({ type, remaining: def.time, total: def.time });
    if (team === 0) {
      tone(500, 0.05);
      updateUI();
    }
    return true;
  }
  function startPlacement(type) {
    if (state.age[0] < BUILDINGS[type].age) return;
    if (!canAfford(BUILDINGS[type].cost)) {
      toast("You need more resources for this building.");
      return;
    }
    let villagers = selection
      .map(getEntity)
      .filter((u) => u?.type === "villager" && u.team === 0);
    if (!villagers.length) {
      let idle = state.units.filter(
        (u) => u.team === 0 && u.type === "villager" && !u.dead,
      );
      idle.sort(
        (a, b) => (a.task === "idle" ? -1 : 0) - (b.task === "idle" ? -1 : 0),
      );
      if (!idle.length) {
        toast("Train a villager to construct buildings.");
        return;
      }
      selection = [idle[0].id];
    }
    placement = type;
    $("#placement-hint").classList.remove("hidden");
    $("#placement-hint").textContent =
      `Place ${BUILDINGS[type].name.toLowerCase()} · Left click to build · Esc to cancel`;
    canvas.style.cursor = "crosshair";
    updateUI();
  }
  function validPlacement(type, x, y) {
    let s = BUILDINGS[type].size;
    if (
      x - s / 2 < 1 ||
      y - s / 2 < 1 ||
      x + s / 2 > WORLD - 1 ||
      y + s / 2 > WORLD - 1
    )
      return false;
    if (!state.explored[Math.floor(y) * WORLD + Math.floor(x)]) return false;
    if (
      state.buildings.some(
        (b) =>
          !b.dead &&
          Math.abs(x - b.x) < (s + b.size) / 2 + 0.2 &&
          Math.abs(y - b.y) < (s + b.size) / 2 + 0.2,
      )
    )
      return false;
    if (
      state.nodes.some(
        (n) =>
          !n.dead &&
          n.amount > 0 &&
          Math.abs(x - n.x) < s / 2 &&
          Math.abs(y - n.y) < s / 2,
      )
    )
      return false;
    return true;
  }
  function placeBuilding(type, x, y, team = 0) {
    if (team === 0 && !validPlacement(type, x, y)) return false;
    if (!canAfford(BUILDINGS[type].cost, team)) return false;
    pay(BUILDINGS[type].cost, team);
    let b = addBuilding(type, x, y, team, false),
      workers =
        team === 0
          ? selection
              .map(getEntity)
              .filter(
                (u) =>
                  u?.kind === "unit" && u.type === "villager" && u.team === 0,
              )
          : state.units
              .filter(
                (u) => u.team === team && u.type === "villager" && !u.dead,
              )
              .slice(0, 2);
    if (!workers.length && team === 0) {
      workers = state.units
        .filter((u) => u.team === 0 && u.type === "villager" && !u.dead)
        .sort((a, c) => distance(a, b) - distance(c, b))
        .slice(0, 1);
    }
    for (const u of workers) {
      u.task = "build";
      u.target = b.id;
      u.path = [];
      moveTo(u, b);
    }
    if (team === 0) {
      state.stats.built++;
      toast(`${BUILDINGS[type].name} foundation laid.`);
      tone(250, 0.07);
      cancelPlacement();
      updateUI();
    }
    return b;
  }
  function cancelPlacement() {
    placement = null;
    $("#placement-hint").classList.add("hidden");
    canvas.style.cursor = "default";
  }
  function advance(team = 0) {
    let next = AGES[state.age[team] + 1];
    if (!next || state.advancing[team]) return false;
    if (!canAfford(next.cost, team)) {
      if (!team) toast("Gather more food and gold to advance.");
      return false;
    }
    pay(next.cost, team);
    state.advancing[team] = { remaining: next.time, total: next.time };
    if (!team) {
      toast(`Your kingdom is advancing to the ${next.label}.`);
      updateUI();
    }
    return true;
  }
  function research(type) {
    let def = TECHS[type];
    if (state.tech[0][type] || state.age[0] < def.age) return;
    if (!canAfford(def.cost)) {
      toast("Gather more resources to research this upgrade.");
      return;
    }
    pay(def.cost);
    state.tech[0][type] = true;
    if (type === "armor")
      for (const u of state.units.filter(
        (u) => u.team === 0 && u.type !== "villager",
      )) {
        u.hp *= 1.3;
        u.maxHp *= 1.3;
      }
    toast(`${def.name} researched. ${def.description}`);
    tone(660, 0.15);
    updateUI();
  }
  function reveal() {
    fogDirty = true;
    state.visible.fill(0);
    let observers = [
      ...state.units.filter((u) => u.team === 0 && !u.dead),
      ...state.buildings.filter((b) => b.team === 0 && !b.dead),
    ];
    for (const u of observers) {
      let r = u.type === "scout" ? 10 : u.kind === "building" ? 7 : 6;
      for (
        let y = Math.max(0, Math.floor(u.y - r));
        y <= Math.min(WORLD - 1, Math.ceil(u.y + r));
        y++
      )
        for (
          let x = Math.max(0, Math.floor(u.x - r));
          x <= Math.min(WORLD - 1, Math.ceil(u.x + r));
          x++
        )
          if (Math.hypot(x - u.x, y - u.y) <= r) {
            let i = y * WORLD + x;
            state.visible[i] = 1;
            state.explored[i] = 1;
          }
    }
    if (!enemySeen && completed(1, "town").some((b) => visible(b))) {
      enemySeen = true;
      toast(
        "House Ashford discovered. Destroy their town center to claim victory.",
      );
    }
  }
  function visible(e) {
    return !!state.visible[
      Math.floor(Math.max(0, Math.min(WORLD - 1, e.y))) * WORLD +
        Math.floor(Math.max(0, Math.min(WORLD - 1, e.x)))
    ];
  }
  function explored(e) {
    return !!state.explored[
      Math.floor(Math.max(0, Math.min(WORLD - 1, e.y))) * WORLD +
        Math.floor(Math.max(0, Math.min(WORLD - 1, e.x)))
    ];
  }
  function damage(target, amount, source) {
    if (target.dead) return;
    target.hp -= amount;
    target.flash = 0.12;
    if (
      target.kind === "unit" &&
      target.task !== "attack" &&
      target.task !== "move" &&
      target.type !== "villager"
    ) {
      target.task = "attack";
      target.target = source.id;
      target.path = [];
    }
    if (target.hp <= 0) {
      target.dead = true;
      particles.push({
        type: "dust",
        x: target.x,
        y: target.y,
        life: 1,
        max: 1,
      });
      if (target.team === 1) state.stats.kills++;
      else state.stats.lost++;
      if (
        target.kind === "building" &&
        target.type === "town" &&
        !completed(target.team, "town").length
      )
        endGame(1 - target.team);
      if (target.team === 0 && target.kind === "building")
        toast(`${BUILDINGS[target.type].name} has fallen!`, true);
      selection = selection.filter((id) => id !== target.id);
    }
  }
  function attack(u, target, dt) {
    let def = UNITS[u.type],
      range = def.range + (target.kind === "building" ? target.size * 0.4 : 0);
    if (approach(u, target, range, dt) && u.cooldown <= 0) {
      let amount =
        def.attack * ageStats(u.team) * (state.tech[u.team].weapons ? 1.25 : 1);
      if (u.type === "ram" && target.kind === "building") amount *= 3;
      if (u.type === "knight" && target.type === "archer") amount *= 1.3;
      u.cooldown = u.type === "ram" ? 1.8 : 1.1;
      u.swing = 0.25;
      if (def.range > 3) {
        projectiles.push({
          x: u.x,
          y: u.y,
          tx: target.x,
          ty: target.y,
          progress: 0,
          duration: distance(u, target) / 13,
          team: u.team,
          target: target.id,
          damage: amount,
        });
      } else damage(target, amount, u);
      if (visible(u)) tone(130 + rand() * 100, 0.025, "triangle", 0.008);
    }
  }
  function unitUpdate(u, dt) {
    if (u.dead) return;
    u.cooldown -= dt;
    u.swing = Math.max(0, (u.swing || 0) - dt);
    u.flash = Math.max(0, (u.flash || 0) - dt);
    u.anim += dt;
    if (u.task === "move") {
      walk(u, dt);
      if (!u.path.length) {
        u.task = "idle";
        u.move = null;
      }
    } else if (u.task === "gather") {
      let n = getEntity(u.target);
      if (!n || n.dead || (n.kind === "node" && n.amount <= 0)) {
        let next = nearestNode(u, u.gatherType);
        if (next) assignGather(u, next);
        else {
          u.task = "idle";
          u.target = null;
        }
        return;
      }
      let range = n.kind === "building" ? n.size * 0.6 : 1;
      if (approach(u, n, range, dt)) {
        let r = n.kind === "building" ? "food" : n.type,
          rate =
            (r === "food" ? 0.95 : r === "wood" ? 0.95 : 0.78) *
            (state.tech[u.team].tools ? 1.25 : 1),
          camp = r === "wood" ? "lumber" : r === "food" ? "mill" : null;
        if (camp && completed(u.team, camp).some((b) => distance(b, n) < 9))
          rate *= 1.25;
        rate *= 1 + (state.age[u.team] - 1) * 0.08;
        let amount = rate * dt;
        if (n.kind === "node") {
          amount = Math.min(amount, n.amount);
          n.amount -= amount;
          if (n.amount <= 0) n.dead = true;
        }
        state.resources[u.team][r] += amount;
        if (!u.team) state.stats.gathered += amount;
        u.workAnim = (u.workAnim || 0) + dt * 4;
      }
    } else if (u.task === "build" || u.task === "repair") {
      let b = getEntity(u.target);
      if (!b || b.dead) {
        u.task = "idle";
        return;
      }
      if (approach(u, b, b.size * 0.65 + 0.5, dt)) {
        u.workAnim = (u.workAnim || 0) + dt * 5;
        if (u.task === "build") {
          b.progress = Math.min(1, b.progress + dt / BUILDINGS[b.type].time);
          b.hp = Math.max(b.hp, b.maxHp * b.progress);
          if (b.progress >= 1) {
            if (!u.team) toast(`${BUILDINGS[b.type].name} completed.`);
            let workers = state.units.filter(
              (w) => w.target === b.id && w.task === "build",
            );
            for (const w of workers) {
              if (b.type === "farm") assignGather(w, b);
              else {
                w.task = "idle";
                w.target = null;
              }
            }
          }
        } else {
          if (state.resources[u.team].wood > 0) {
            b.hp = Math.min(b.maxHp, b.hp + dt * 22);
            state.resources[u.team].wood = Math.max(
              0,
              state.resources[u.team].wood - dt * 0.3,
            );
          }
          if (b.hp >= b.maxHp) u.task = "idle";
        }
      }
    } else if (u.task === "attack") {
      let target = getEntity(u.target);
      if (
        target?.kind === "building" &&
        distance(u, target) > UNITS[u.type].range + target.size * 0.4 &&
        u.type !== "villager" &&
        u.type !== "ram"
      ) {
        let defender = state.units
          .filter(
            (e) =>
              e.team !== u.team &&
              !e.dead &&
              (u.team === 1 || visible(e)) &&
              distance(u, e) < 5,
          )
          .sort((a, b) => distance(u, a) - distance(u, b))[0];
        if (defender) {
          u.strategicTarget = target.id;
          u.target = defender.id;
          target = defender;
          u.path = [];
        }
      }
      if (!target || target.dead) {
        let strategic = getEntity(u.strategicTarget);
        if (strategic && !strategic.dead) {
          u.target = strategic.id;
          u.strategicTarget = null;
          u.path = [];
        } else {
          u.task = "idle";
          u.target = null;
          u.path = [];
        }
      } else attack(u, target, dt);
    }
    if (u.type !== "villager" && u.task === "idle") {
      let enemies = [...state.units, ...state.buildings].filter(
        (e) =>
          e.team !== u.team &&
          !e.dead &&
          (u.team === 1 || visible(e)) &&
          distance(u, e) < (u.type === "archer" ? 7 : 5),
      );
      enemies.sort((a, b) => distance(u, a) - distance(u, b));
      if (enemies[0]) {
        u.task = "attack";
        u.target = enemies[0].id;
        u.path = [];
      }
    }
    // Small separation keeps armies readable while preserving formation orders.
    if (u.kind === "unit" && u.task !== "gather" && u.task !== "build") {
      for (const other of state.units) {
        if (other.id === u.id || other.dead) continue;
        let dx = u.x - other.x,
          dy = u.y - other.y,
          d = Math.hypot(dx, dy);
        if (d > 0 && d < 0.37) {
          let push = (0.37 - d) * dt * 3;
          let nx = u.x + (dx / d) * push,
            ny = u.y + (dy / d) * push;
          if (!blocked(nx, ny)) {
            u.x = nx;
            u.y = ny;
          }
        }
      }
    }
  }
  function buildingUpdate(b, dt) {
    if (b.dead || b.progress < 1) return;
    b.cooldown -= dt;
    b.flash = Math.max(0, (b.flash || 0) - dt);
    if (b.queue.length) {
      let q = b.queue[0];
      q.remaining -= dt;
      if (q.remaining <= 0) {
        if (population(b.team) < capacity(b.team)) {
          let p = { x: b.x + b.size * 0.65, y: b.y + b.size * 0.6 };
          if (blocked(p.x, p.y)) {
            for (let i = 0; i < 16; i++) {
              let a = (i * Math.PI) / 8,
                candidate = {
                  x: b.x + Math.cos(a) * (b.size * 0.7 + 1),
                  y: b.y + Math.sin(a) * (b.size * 0.7 + 1),
                };
              if (!blocked(candidate.x, candidate.y)) {
                p = candidate;
                break;
              }
            }
          }
          let u = addUnit(q.type, p.x, p.y, b.team);
          b.queue.shift();
          if (u.type === "villager") {
            assignGather(
              u,
              nearestNode(
                u,
                b.team === 0
                  ? ["food", "wood", "gold"][population(0) % 3]
                  : aiGatherChoice(),
              ),
            );
            if (!b.team) toast("A villager joins your settlement.");
          } else {
            u.task = "move";
            moveTo(u, b.rally);
          }
        } else q.remaining = 0;
      }
    }
    if (["town", "tower", "castle"].includes(b.type) && b.cooldown <= 0) {
      let range = b.type === "castle" ? 9 : b.type === "tower" ? 8 : 6;
      let target = state.units
        .filter(
          (u) =>
            u.team !== b.team &&
            !u.dead &&
            distance(u, b) < range &&
            (b.team === 1 || visible(u)),
        )
        .sort((a, c) => distance(b, a) - distance(b, c))[0];
      if (target) {
        let arrows = b.type === "castle" ? 3 : 1;
        for (let i = 0; i < arrows; i++)
          projectiles.push({
            x: b.x,
            y: b.y,
            tx: target.x,
            ty: target.y,
            progress: 0,
            duration: distance(b, target) / 15 + 0.08 * i,
            team: b.team,
            target: target.id,
            damage: b.type === "town" ? 8 : 15,
            building: true,
            source: b.id,
          });
        b.cooldown = b.type === "castle" ? 1.1 : 1.6;
        if (!b.team && state.time - toastTimer > 20) {
          toast("Your settlement is under attack!", true);
          toastTimer = state.time;
        }
      }
    }
  }
  function aiGatherChoice() {
    const goals = { food: 5, wood: 4, gold: 2 };
    return Object.keys(goals).sort(
      (a, b) =>
        state.units.filter(
          (u) => u.team === 1 && u.task === "gather" && u.gatherType === a,
        ).length /
          goals[a] -
        state.units.filter(
          (u) => u.team === 1 && u.task === "gather" && u.gatherType === b,
        ).length /
          goals[b],
    )[0];
  }
  function aiUpdate(dt) {
    let ai = state.ai;
    ai.timer += dt;
    ai.trainTimer -= dt;
    ai.buildTimer -= dt;
    if (ai.trainTimer <= 0) {
      ai.trainTimer = 8;
      if (
        population(1) < 17 &&
        state.units.filter(
          (u) => u.team === 1 && u.type === "villager" && !u.dead,
        ).length +
          state.buildings
            .filter((b) => b.team === 1)
            .reduce(
              (n, b) => n + b.queue.filter((q) => q.type === "villager").length,
              0,
            ) <
          11
      )
        train("villager", 1);
      let type =
        state.age[1] >= 3 && completed(1, "workshop").length && rand() < 0.18
          ? "ram"
          : state.age[1] >= 2 && completed(1, "stable").length && rand() < 0.35
            ? "knight"
            : state.age[1] >= 2 &&
                completed(1, "archery").length &&
                rand() < 0.4
              ? "archer"
              : "militia";
      let reserve =
        state.age[1] < 4 &&
        !state.advancing[1] &&
        state.time > state.age[1] * 170
          ? AGES[state.age[1] + 1].cost
          : null;
      let budget =
        !reserve ||
        (state.resources[1].food - (UNITS[type].cost.food || 0) >=
          reserve.food &&
          state.resources[1].gold - (UNITS[type].cost.gold || 0) >=
            reserve.gold);
      if (militaryCount(1) < [0, 10, 18, 28, 40][state.age[1]] && budget)
        train(type, 1);
    }
    if (ai.buildTimer <= 0) {
      ai.buildTimer = 22;
      let desired =
        population(1) > capacity(1) - 5
          ? "house"
          : state.resources[1].food < 200 && completed(1, "farm").length < 4
            ? "farm"
            : state.age[1] >= 3 && !completed(1, "workshop").length
              ? "workshop"
              : state.age[1] >= 2 && !completed(1, "archery").length
                ? "archery"
                : state.age[1] >= 2 && !completed(1, "stable").length
                  ? "stable"
                  : state.age[1] >= 2 && !completed(1, "tower").length
                    ? "tower"
                    : null;
      if (desired) {
        for (let i = 0; i < 30; i++) {
          let x = Math.round(39 + (rand() - 0.5) * 15),
            y = Math.round(17 + (rand() - 0.5) * 15),
            s = BUILDINGS[desired].size;
          if (x < 30 || x > 47 || y < 6 || y > 27) continue;
          if (
            !state.buildings.some(
              (b) =>
                !b.dead &&
                Math.abs(x - b.x) < (s + b.size) / 2 + 0.5 &&
                Math.abs(y - b.y) < (s + b.size) / 2 + 0.5,
            )
          ) {
            placeBuilding(desired, x, y, 1);
            break;
          }
        }
      }
    }
    if (
      !state.advancing[1] &&
      state.age[1] < 4 &&
      state.time > state.age[1] * 210
    )
      advance(1);
    for (const u of state.units.filter(
      (u) =>
        u.team === 1 && u.type === "villager" && !u.dead && u.task === "idle",
    ))
      assignGather(u, nearestNode(u, ["food", "wood", "gold"][u.id % 3]));
    if (state.time >= ai.raid) {
      let army = state.units.filter(
          (u) =>
            u.team === 1 &&
            u.type !== "villager" &&
            !u.dead &&
            u.task !== "attack",
        ),
        size = Math.min(army.length, 3 + ai.raidCount * 2);
      let target = completed(0, "town")[0];
      if (target) {
        for (const u of army.slice(0, size)) {
          u.task = "attack";
          u.target = target.id;
          u.strategicTarget = null;
          moveTo(u, target);
        }
        if (size) {
          ai.raidCount++;
          ai.raid = state.time + Math.max(75, 150 - ai.raidCount * 12);
          toast("Ashford’s troops are marching toward your borders.", true);
        } else ai.raid = state.time + 30;
      }
    }
  }
  function simulate(dt) {
    if (paused || !started || state.over) return;
    state.time += dt;
    for (const u of state.units) unitUpdate(u, dt);
    for (const b of state.buildings) buildingUpdate(b, dt);
    for (let team = 0; team < 2; team++) {
      let a = state.advancing[team];
      if (a) {
        a.remaining -= dt;
        if (a.remaining <= 0) {
          state.age[team]++;
          state.advancing[team] = null;
          for (const u of state.units.filter(
            (u) => u.team === team && u.type !== "villager" && !u.dead,
          )) {
            let bonus =
              UNITS[u.type].hp * 0.22 * (state.tech[team].armor ? 1.3 : 1);
            u.hp += bonus;
            u.maxHp += bonus;
          }
          if (team === 0) {
            toast(
              `Welcome to the ${AGES[state.age[0]].label}. New possibilities await.`,
            );
            tone(740, 0.25);
            updateUI();
          } else
            toast(`House Ashford has reached the ${AGES[state.age[1]].label}.`);
        }
      }
    }
    aiUpdate(dt);
    for (const p of projectiles) {
      p.progress += dt / Math.max(0.12, p.duration);
      if (p.progress >= 1) {
        let t = getEntity(p.target);
        if (t && !t.dead)
          damage(t, p.damage, getEntity(p.source) || { id: 0, team: p.team });
        p.dead = true;
      }
    }
    projectiles = projectiles.filter((p) => !p.dead);
    visionTimer += dt;
    if (visionTimer > 0.6) {
      visionTimer = 0;
      reveal();
    }
    saveTimer += dt;
    if (saveTimer >= 30) {
      saveTimer = 0;
      saveGame();
    }
    state.units = state.units.filter((u) => !u.dead);
    state.buildings = state.buildings.filter((b) => !b.dead);
  }
  // Hand-drawn isometric art. Everything is rendered locally, including the terrain and portraits.
  function poly(points, fill, stroke = null, width = 1) {
    ctx.beginPath();
    points.forEach((p, i) =>
      i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]),
    );
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.stroke();
    }
  }
  function line(points, color, width = 1) {
    ctx.beginPath();
    points.forEach((p, i) =>
      i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]),
    );
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }
  function ellipse(x, y, rx, ry, color) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  function tilePoly(x, y, size = 1) {
    let a = iso(x - size / 2, y - size / 2),
      b = iso(x + size / 2, y - size / 2),
      c = iso(x + size / 2, y + size / 2),
      d = iso(x - size / 2, y + size / 2);
    return [
      [a.x, a.y],
      [b.x, b.y],
      [c.x, c.y],
      [d.x, d.y],
    ];
  }
  function buildTerrain() {
    terrain = document.createElement("canvas");
    terrain.width = WORLD * TW + 200;
    terrain.height = WORLD * TH + 200;
    terrainOrigin = { x: (WORLD * TW) / 2 + 100, y: 60 };
    let t = terrain.getContext("2d"),
      old = ctx;
    seed = 7412;
    let colors = [
      "#98aa83",
      "#99ab84",
      "#9bad86",
      "#99ab84",
      "#98aa83",
      "#9aac85",
    ];
    t.fillStyle = "#9aac86";
    t.fillRect(0, 0, terrain.width, terrain.height);
    t.save();
    t.translate(terrainOrigin.x, terrainOrigin.y);
    for (let y = 0; y < WORLD; y++)
      for (let x = 0; x < WORLD; x++) {
        let p = iso(x, y),
          n = Math.sin(x * 0.4 + y * 0.7) * 0.5 + 0.5;
        t.fillStyle = colors[Math.floor(rand() * colors.length)];
        t.beginPath();
        t.moveTo(p.x, p.y - TH / 2 - 1);
        t.lineTo(p.x + TW / 2 + 1, p.y);
        t.lineTo(p.x, p.y + TH / 2 + 1);
        t.lineTo(p.x - TW / 2 - 1, p.y);
        t.fill();
        for (let k = 0; k < 3; k++) {
          let dx = (rand() - 0.5) * TW * 0.55,
            dy = (rand() - 0.5) * TH * 0.5;
          t.strokeStyle = rand() < 0.5 ? "#718c622b" : "#bec69738";
          t.lineWidth = 1;
          t.beginPath();
          t.moveTo(p.x + dx, p.y + dy);
          t.lineTo(p.x + dx + 2, p.y + dy - 3);
          t.stroke();
        }
      }
    // A winding stream and soft banks at the edge of the realm.
    let banks = [],
      river = [];
    for (let y = 0; y <= WORLD; y += 0.4) {
      let x = 47 + Math.sin(y * 0.17) * 1.7,
        p = iso(x, y);
      banks.push(p);
      river.push(p);
    }
    for (const [w, c] of [
      [70, "#c0bc94"],
      [51, "#7d9d97"],
      [34, "#8dac9f"],
    ]) {
      t.beginPath();
      banks.forEach((p, i) => (i ? t.lineTo(p.x, p.y) : t.moveTo(p.x, p.y)));
      t.strokeStyle = c;
      t.lineWidth = w;
      t.lineCap = "round";
      t.stroke();
    }
    for (let i = 0; i < river.length; i += 4) {
      let p = river[i];
      t.strokeStyle = "#cfdfc14a";
      t.beginPath();
      t.moveTo(p.x - 8, p.y - 2);
      t.lineTo(p.x + 10, p.y - 4);
      t.stroke();
    }
    // Footpaths wind between homes and the town square.
    function road(points, w = 18) {
      t.beginPath();
      points.forEach(([x, y], i) => {
        let p = iso(x, y);
        i ? t.lineTo(p.x, p.y) : t.moveTo(p.x, p.y);
      });
      t.strokeStyle = "#c0b58e88";
      t.lineWidth = w;
      t.lineCap = "round";
      t.lineJoin = "round";
      t.stroke();
      t.strokeStyle = "#d2c59b42";
      t.lineWidth = w * 0.65;
      t.stroke();
    }
    road(
      [
        [10, 29],
        [12, 31],
        [15, 32],
        [17, 34],
        [19, 32],
      ],
      24,
    );
    road(
      [
        [15, 32],
        [14, 34],
        [12, 36],
        [15, 37],
      ],
      20,
    );
    road(
      [
        [15, 32],
        [20, 28],
        [26, 26],
        [31, 23],
        [36, 20],
        [39, 16],
      ],
      13,
    );
    road(
      [
        [35, 13],
        [39, 16],
        [43, 16],
        [43, 21],
        [40, 21],
        [36, 20],
      ],
      22,
    );
    t.restore();
  }
  function cube(
    x,
    y,
    w,
    d,
    height,
    front = "#d4cbb0",
    side = "#aaa98c",
    top = "#ded3b4",
  ) {
    let a = iso(x - w / 2, y - d / 2),
      b = iso(x + w / 2, y - d / 2),
      c = iso(x + w / 2, y + d / 2),
      e = iso(x - w / 2, y + d / 2);
    poly(
      [
        [b.x, b.y],
        [c.x, c.y],
        [c.x, c.y - height],
        [b.x, b.y - height],
      ],
      side,
      "#53644930",
    );
    poly(
      [
        [e.x, e.y],
        [c.x, c.y],
        [c.x, c.y - height],
        [e.x, e.y - height],
      ],
      front,
      "#53644930",
    );
    poly(
      [
        [a.x, a.y - height],
        [b.x, b.y - height],
        [c.x, c.y - height],
        [e.x, e.y - height],
      ],
      top,
    );
    return { a, b, c, e };
  }
  function roof(x, y, w, d, base, rise, color = "#657c72") {
    let a = iso(x - w / 2, y - d / 2),
      b = iso(x + w / 2, y - d / 2),
      c = iso(x + w / 2, y + d / 2),
      e = iso(x - w / 2, y + d / 2),
      r1 = iso(x, y - d / 2),
      r2 = iso(x, y + d / 2);
    poly(
      [
        [e.x - 4, e.y - base],
        [c.x + 4, c.y - base],
        [r2.x, r2.y - base - rise],
      ],
      "#d7cbaa",
    );
    poly(
      [
        [a.x - 5, a.y - base],
        [e.x - 5, e.y - base],
        [r2.x, r2.y - base - rise],
        [r1.x, r1.y - base - rise],
      ],
      color,
      "#405b4c66",
    );
    poly(
      [
        [r1.x, r1.y - base - rise],
        [r2.x, r2.y - base - rise],
        [c.x + 5, c.y - base],
        [b.x + 5, b.y - base],
      ],
      shade(color, 12),
      "#405b4c66",
    );
    for (let t = 0.22; t < 1; t += 0.2) {
      let lx = (a.x - 5) * (1 - t) + r1.x * t,
        ly = (a.y - base) * (1 - t) + (r1.y - base - rise) * t,
        ex = (e.x - 5) * (1 - t) + r2.x * t,
        ey = (e.y - base) * (1 - t) + (r2.y - base - rise) * t;
      line(
        [
          [lx, ly],
          [ex, ey],
        ],
        "#e0e4cf24",
        1,
      );
    }
    line(
      [
        [r1.x, r1.y - base - rise],
        [r2.x, r2.y - base - rise],
      ],
      "#d7d3b575",
      2,
    );
  }
  function shade(hex, amount) {
    let n = parseInt(hex.slice(1), 16);
    return `rgb(${Math.min(255, Math.max(0, (n >> 16) + amount))},${Math.min(255, Math.max(0, ((n >> 8) & 255) + amount))},${Math.min(255, Math.max(0, (n & 255) + amount))})`;
  }
  function flag(x, y, height, team, small = false) {
    let p = iso(x, y);
    line(
      [
        [p.x, p.y],
        [p.x, p.y - height],
      ],
      "#7b795b",
      1.5,
    );
    let f = small ? 12 : 20,
      wave = Math.sin(state.time * 2 + x) * 2;
    poly(
      [
        [p.x, p.y - height],
        [p.x + f, p.y - height + 3 + wave],
        [p.x + f - 3, p.y - height + 10 + wave],
        [p.x, p.y - height + 9],
      ],
      team === 0 ? TEAM : ENEMY,
      "#61705260",
    );
    line(
      [
        [p.x + 2, p.y - height + 1],
        [p.x + 2, p.y - height + 8],
      ],
      "#f7eccc77",
      1,
    );
  }
  function timber(x, y, w, d, height) {
    let a = iso(x - w / 2, y + d / 2),
      b = iso(x + w / 2, y + d / 2),
      c = iso(x + w / 2, y - d / 2);
    for (let t = 0; t <= 1.01; t += 0.33) {
      let px = a.x * (1 - t) + b.x * t,
        py = a.y * (1 - t) + b.y * t;
      line(
        [
          [px, py],
          [px, py - height],
        ],
        "#8d85647f",
        3,
      );
    }
    line(
      [
        [a.x, a.y - height * 0.4],
        [b.x, b.y - height * 0.4],
      ],
      "#9a8a6877",
      2,
    );
    for (let t = 0.2; t < 1; t += 0.4) {
      let px = b.x * (1 - t) + c.x * t,
        py = b.y * (1 - t) + c.y * t;
      line(
        [
          [px, py],
          [px, py - height],
        ],
        "#7c7d6077",
        2,
      );
    }
  }
  function door(x, y, h = 20) {
    let p = iso(x, y);
    poly(
      [
        [p.x - 7, p.y],
        [p.x - 7, p.y - h + 5],
        [p.x - 3, p.y - h],
        [p.x + 5, p.y - h + 3],
        [p.x + 5, p.y],
      ],
      "#696f55",
    );
    line(
      [
        [p.x - 1, p.y],
        [p.x - 1, p.y - h + 2],
      ],
      "#9b8c67",
      1,
    );
    ellipse(p.x + 2, p.y - 8, 1, 1, "#d8b46a");
  }
  function windows(x, y, z, number = 2) {
    let p = iso(x, y);
    for (let i = 0; i < number; i++) {
      let dx = i * 15;
      poly(
        [
          [p.x + dx, p.y - z],
          [p.x + dx, p.y - z - 9],
          [p.x + dx + 5, p.y - z - 7],
          [p.x + dx + 5, p.y - z + 2],
        ],
        "#596957",
      );
      line(
        [
          [p.x + dx + 2.5, p.y - z - 8],
          [p.x + dx + 2.5, p.y - z + 1],
        ],
        "#c6bfa0",
        0.7,
      );
    }
  }
  function stoneLines(x, y, w, d, h) {
    let a = iso(x - w / 2, y + d / 2),
      b = iso(x + w / 2, y + d / 2);
    for (let z = 8; z < h; z += 9) {
      line(
        [
          [a.x, a.y - z],
          [b.x, b.y - z],
        ],
        "#7f8b7460",
        0.7,
      );
      for (let t = 0.15; t < 1; t += 0.22) {
        let dx = (z % 18 ? 0 : 0.07) + t;
        if (dx >= 1) continue;
        let px = a.x * (1 - dx) + b.x * dx,
          py = a.y * (1 - dx) + b.y * dx;
        line(
          [
            [px, py - z],
            [px, py - z + 8],
          ],
          "#7f8b7440",
          0.7,
        );
      }
    }
  }
  function drawBuilding(b, ghost = false) {
    let p = iso(b.x, b.y),
      s = b.size,
      color = b.team === 0 ? "#687f73" : "#826f66",
      opacity = ctx.globalAlpha;
    ellipse(p.x + 15, p.y + 6, s * TW * 0.45, s * TH * 0.38, "#304b3330");
    poly(tilePoly(b.x, b.y, s + 0.25), "#b7b18d99");
    if (b.progress < 1 && !ghost) {
      cube(b.x, b.y, s - 0.25, s - 0.25, 8, "#b8b596", "#aaa98b", "#d0c5a3");
      for (let dx = -s / 2; dx <= s / 2; dx += s / 2) {
        let a = iso(b.x + dx, b.y + s / 2);
        line(
          [
            [a.x, a.y],
            [a.x, a.y - 42],
          ],
          "#968760",
          3,
        );
      }
      let a = iso(b.x - s / 2, b.y + s / 2),
        c = iso(b.x + s / 2, b.y + s / 2);
      line(
        [
          [a.x, a.y - 35],
          [c.x, c.y - 35],
        ],
        "#a2926b",
        3,
      );
      for (let i = 0; i < 5; i++)
        line(
          [
            [p.x - 22 + i * 10, p.y + 1 - i * 3],
            [p.x + 9 + i * 10, p.y + 15 - i * 3],
          ],
          "#baa37a",
          4,
        );
      drawBar(p.x, p.y - 54, 54, b.progress, "#c6b674");
      return;
    }
    if (b.type === "farm") {
      poly(tilePoly(b.x, b.y, s), "#a58c61");
      for (let i = -0.8; i <= 0.8; i += 0.23) {
        let a = iso(b.x + i, b.y - 0.85),
          c = iso(b.x + i, b.y + 0.85);
        line(
          [
            [a.x, a.y],
            [c.x, c.y],
          ],
          "#776e4666",
          5,
        );
        line(
          [
            [a.x, a.y - 2],
            [c.x, c.y - 2],
          ],
          "#b3b268",
          2.5,
        );
        for (let j = -0.7; j <= 0.7; j += 0.26) {
          let q = iso(b.x + i, b.y + j);
          line(
            [
              [q.x, q.y],
              [q.x - 2, q.y - 5],
            ],
            "#ddcc7a",
            1,
          );
        }
      }
      poly(tilePoly(b.x, b.y, s + 0.08), null, "#d0b689", 2);
      return;
    }
    if (b.type === "town") {
      cube(b.x - 0.65, b.y + 0.35, 1.5, 2.25, 32);
      timber(b.x - 0.65, b.y + 0.35, 1.5, 2.25, 32);
      roof(b.x - 0.65, b.y + 0.35, 1.7, 2.5, 32, 27, color);
      cube(b.x + 0.7, b.y - 0.3, 1.15, 1.65, 39, "#d8d1b8", "#aeb198");
      timber(b.x + 0.7, b.y - 0.3, 1.15, 1.65, 39);
      roof(b.x + 0.7, b.y - 0.3, 1.4, 1.95, 39, 28, color);
      cube(b.x, b.y - 0.8, 0.85, 0.85, 72, "#d1cbb0", "#a2aa92");
      stoneLines(b.x, b.y - 0.8, 0.85, 0.85, 72);
      roof(b.x, b.y - 0.8, 1.05, 1.05, 72, 27, color);
      windows(b.x - 0.25, b.y - 0.38, 53, 1);
      door(b.x - 0.5, b.y + 1.45, 23);
      windows(b.x - 1.3, b.y + 1.45, 20, 2);
      flag(b.x, b.y - 0.8, 119, b.team);
      cube(
        b.x + 1.15,
        b.y + 1.15,
        0.5,
        0.4,
        6,
        "#a09c77",
        "#858e6d",
        "#c4bc93",
      );
      let q = iso(b.x + 1.15, b.y + 1.15);
      ellipse(q.x, q.y - 7, 10, 5, "#768f87");
    } else if (b.type === "house") {
      cube(b.x, b.y, 1.4, 1.3, 25);
      timber(b.x, b.y, 1.4, 1.3, 25);
      roof(b.x, b.y, 1.7, 1.6, 25, 24, "#a78b61");
      door(b.x, b.y + 0.68, 17);
      windows(b.x - 0.6, b.y + 0.65, 17, 1);
      cube(
        b.x + 0.45,
        b.y - 0.35,
        0.2,
        0.25,
        52,
        "#a5ab92",
        "#8b967d",
        "#bac0a5",
      );
      let q = iso(b.x + 0.45, b.y - 0.35);
      for (let i = 0; i < 3; i++)
        ellipse(
          q.x + Math.sin(state.time + i) * 4 + i * 3,
          q.y - 57 - i * 8,
          5 + i * 2,
          3 + i,
          "#e3e1c944",
        );
    } else if (b.type === "mill") {
      cube(b.x, b.y, 1.15, 1.25, 46);
      timber(b.x, b.y, 1.15, 1.25, 46);
      roof(b.x, b.y, 1.4, 1.55, 46, 22, "#9e845d");
      door(b.x, b.y + 0.65, 19);
      let q = iso(b.x + 0.45, b.y + 0.65);
      q.y -= 39;
      let a = state.time * 0.3;
      for (let i = 0; i < 4; i++) {
        let angle = a + (i * Math.PI) / 2,
          dx = Math.cos(angle),
          dy = Math.sin(angle);
        line(
          [
            [q.x, q.y],
            [q.x + dx * 35, q.y + dy * 35],
          ],
          "#8c805c",
          3,
        );
        poly(
          [
            [q.x + dx * 9 - dy * 2, q.y + dy * 9 + dx * 2],
            [q.x + dx * 33 - dy * 2, q.y + dy * 33 + dx * 2],
            [q.x + dx * 33 - dy * 9, q.y + dy * 33 + dx * 9],
            [q.x + dx * 9 - dy * 5, q.y + dy * 9 + dx * 5],
          ],
          "#ded5b4",
          "#ab9e77",
          0.7,
        );
      }
      ellipse(q.x, q.y, 4, 4, "#8d805c");
    } else if (b.type === "lumber") {
      cube(b.x + 0.2, b.y, 1.4, 1.1, 16, "#b2a681", "#9e9778");
      roof(b.x + 0.2, b.y, 1.7, 1.35, 16, 16, "#8a9676");
      for (let i = 0; i < 5; i++) {
        let q = iso(b.x - 0.7 + i * 0.16, b.y + 0.7);
        line(
          [
            [q.x - 10, q.y - 4],
            [q.x + 12, q.y + 6],
          ],
          "#8c7755",
          7,
        );
        ellipse(q.x + 12, q.y + 6, 3, 3, "#c1ad7c");
      }
      let q = iso(b.x - 0.8, b.y - 0.5);
      line(
        [
          [q.x, q.y],
          [q.x - 4, q.y - 17],
        ],
        "#8f7957",
        3,
      );
      poly(
        [
          [q.x - 4, q.y - 17],
          [q.x + 5, q.y - 21],
          [q.x + 8, q.y - 14],
          [q.x - 3, q.y - 11],
        ],
        "#9ba691",
      );
    } else if (b.type === "tower") {
      cube(b.x, b.y, 1.25, 1.25, 77, "#c9c9ae", "#9eaa92", "#d4d3b7");
      stoneLines(b.x, b.y, 1.25, 1.25, 77);
      cube(b.x, b.y, 1.5, 1.5, 5, "#b4baa1", "#97a38a");
      let corners = [
        [-0.6, -0.6],
        [0.6, -0.6],
        [0.6, 0.6],
        [-0.6, 0.6],
      ];
      for (const [dx, dy] of corners) {
        let q = iso(b.x + dx, b.y + dy);
        poly(
          [
            [q.x - 5, q.y - 77],
            [q.x - 5, q.y - 86],
            [q.x + 5, q.y - 83],
            [q.x + 5, q.y - 74],
          ],
          "#c9ccb0",
        );
      }
      windows(b.x - 0.3, b.y + 0.63, 54, 1);
      door(b.x, b.y + 0.63, 20);
      flag(b.x, b.y, 108, b.team, true);
    } else if (b.type === "castle") {
      cube(b.x, b.y, 2.65, 2.65, 56, "#c2c4ac", "#98a58e", "#caceb4");
      stoneLines(b.x, b.y, 2.65, 2.65, 56);
      for (const [dx, dy] of [
        [-1.2, -1.2],
        [1.2, -1.2],
        [-1.2, 1.2],
        [1.2, 1.2],
      ]) {
        cube(b.x + dx, b.y + dy, 0.9, 0.9, 84, "#cacbb0", "#9ba890", "#d6d7b9");
        stoneLines(b.x + dx, b.y + dy, 0.9, 0.9, 84);
        roof(b.x + dx, b.y + dy, 1.15, 1.15, 84, 27, color);
      }
      cube(b.x, b.y - 0.2, 1.1, 1.2, 93, "#d0cfb0", "#a2ad94");
      roof(b.x, b.y - 0.2, 1.4, 1.5, 93, 30, color);
      door(b.x, b.y + 1.35, 36);
      flag(b.x, b.y - 0.2, 144, b.team);
    } else {
      let w = 2.1,
        d = 1.9;
      cube(b.x, b.y, w, d, 32);
      timber(b.x, b.y, w, d, 32);
      roof(b.x, b.y, w + 0.3, d + 0.3, 32, 28, color);
      door(b.x + 0.4, b.y + d / 2, 25);
      windows(b.x - 0.85, b.y + d / 2, 21, 2);
      flag(b.x - 0.5, b.y - 0.5, 84, b.team, true);
      if (b.type === "stable") {
        let q = iso(b.x + 0.9, b.y + 1.25);
        ellipse(q.x, q.y - 7, 15, 6, "#827e60");
        line(
          [
            [q.x - 10, q.y - 8],
            [q.x - 10, q.y + 2],
          ],
          "#686b52",
          3,
        );
        line(
          [
            [q.x + 10, q.y - 8],
            [q.x + 10, q.y + 2],
          ],
          "#686b52",
          3,
        );
        line(
          [
            [q.x + 12, q.y - 8],
            [q.x + 17, q.y - 17],
          ],
          "#827e60",
          7,
        );
      }
      if (b.type === "barracks" || b.type === "archery") {
        for (let i = 0; i < 2; i++) {
          let q = iso(b.x - 1.15, b.y + 0.3 + i * 0.65);
          line(
            [
              [q.x, q.y],
              [q.x, q.y - 17],
            ],
            "#8d7f5d",
            2,
          );
          ellipse(q.x, q.y - 15, 9, 7, "#d5cba5");
          ellipse(q.x, q.y - 15, 5, 4, "#a87659");
          ellipse(q.x, q.y - 15, 2, 2, "#d5cba5");
        }
      }
      if (b.type === "workshop") {
        let q = iso(b.x + 1, b.y + 1);
        ellipse(q.x, q.y - 5, 10, 10, "#7a805e");
        ellipse(q.x, q.y - 5, 6, 6, "#c4b387");
      }
    }
    if (b.hp < b.maxHp || selection.includes(b.id)) {
      drawBar(
        p.x,
        p.y -
          (b.type === "castle"
            ? 148
            : b.type === "tower"
              ? 113
              : b.type === "town"
                ? 124
                : 88),
        60,
        b.hp / b.maxHp,
        b.team === 0 ? "#8ea076" : "#b76e55",
      );
    }
    if (
      selection.includes(b.id) &&
      b.team === 0 &&
      ["town", "barracks", "archery", "stable", "workshop"].includes(b.type)
    ) {
      let r = iso(b.rally.x, b.rally.y);
      line(
        [
          [r.x, r.y],
          [r.x, r.y - 18],
        ],
        "#938960",
        1,
      );
      poly(
        [
          [r.x, r.y - 18],
          [r.x + 10, r.y - 15],
          [r.x, r.y - 11],
        ],
        "#dbc58a",
      );
      ellipse(r.x, r.y + 1, 5, 2, "#ede1b56a");
    }
    if (b.queue.length) {
      let q = b.queue[0];
      drawBar(p.x, p.y + 29, 48, 1 - q.remaining / q.total, "#c4ac64");
    }
    ctx.globalAlpha = opacity;
  }
  function drawNode(n) {
    let p = iso(n.x, n.y);
    if (n.type === "wood") {
      let h = 38 + n.variant * 6;
      ellipse(p.x + 8, p.y + 2, 18, 8, "#3c56322c");
      line(
        [
          [p.x, p.y],
          [p.x, p.y - h * 0.55],
        ],
        "#82795a",
        4,
      );
      let shades = ["#526e50", "#5f7954", "#66815b", "#739067", "#69845c"];
      for (let k = 0; k < 3; k++) {
        let base = p.y - 9 - k * 11,
          w = 20 - k * 3.5;
        poly(
          [
            [p.x - w, base],
            [p.x + 2, base - 29 - n.variant * 2],
            [p.x + w, base],
            [p.x + 9, base - 1],
            [p.x + 3, base + 4],
          ],
          shades[(n.variant + k) % 5],
        );
        poly(
          [
            [p.x + 2, base - 29 - n.variant * 2],
            [p.x + w, base],
            [p.x + 7, base + 1],
            [p.x + 3, base - 13],
          ],
          "#2b4f3d23",
        );
        line(
          [
            [p.x - 2, base - 19],
            [p.x - 11, base - 4],
          ],
          "#acb68026",
          1,
        );
      }
    } else if (n.type === "food") {
      ellipse(p.x, p.y + 2, 15, 6, "#58734725");
      for (let i = 0; i < 5; i++) {
        let dx = Math.sin(i * 4 + n.variant) * 11,
          dy = Math.cos(i * 4) * 4;
        ellipse(p.x + dx, p.y - 5 + dy, 9, 8, i % 2 ? "#72874f" : "#637d4a");
        for (let k = 0; k < 3; k++)
          ellipse(
            p.x + dx + (k - 1) * 4,
            p.y - 5 + dy + Math.sin(k + i) * 4,
            1.8,
            1.7,
            "#ad6d55",
          );
      }
    } else {
      ellipse(p.x + 4, p.y + 2, 16, 6, "#52664726");
      let gold = n.type === "gold",
        cols = gold
          ? ["#ada681", "#c5b477", "#ded096"]
          : ["#9ca48e", "#b8bba5", "#d0cfb7"];
      poly(
        [
          [p.x - 15, p.y],
          [p.x - 10, p.y - 15],
          [p.x + 1, p.y - 23],
          [p.x + 15, p.y - 12],
          [p.x + 17, p.y + 2],
          [p.x + 1, p.y + 6],
        ],
        cols[0],
        "#7c856742",
      );
      poly(
        [
          [p.x - 10, p.y - 15],
          [p.x + 1, p.y - 23],
          [p.x + 15, p.y - 12],
          [p.x + 2, p.y - 7],
        ],
        cols[2],
      );
      poly(
        [
          [p.x + 2, p.y - 7],
          [p.x + 15, p.y - 12],
          [p.x + 17, p.y + 2],
          [p.x + 1, p.y + 6],
        ],
        cols[1],
      );
      if (gold) {
        poly(
          [
            [p.x - 6, p.y - 10],
            [p.x - 1, p.y - 14],
            [p.x + 2, p.y - 8],
            [p.x - 3, p.y - 5],
          ],
          "#e3c470",
        );
        poly(
          [
            [p.x + 9, p.y - 5],
            [p.x + 13, p.y - 7],
            [p.x + 14, p.y - 1],
            [p.x + 10, p.y + 2],
          ],
          "#e3c470",
        );
      }
    }
  }
  function drawUnit(u) {
    let p = iso(u.x, u.y),
      moving = u.path.length > 0,
      step = moving ? Math.sin(u.anim * 5) * 2 : Math.sin(u.anim * 2) * 0.3,
      team = u.team === 0 ? TEAM : ENEMY;
    ellipse(
      p.x + 2,
      p.y + 2,
      u.type === "knight" || u.type === "scout" ? 11 : 6,
      u.type === "knight" || u.type === "scout" ? 5 : 3,
      "#3b503440",
    );
    if (selection.includes(u.id)) {
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 2, 11, 5, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "#f1e5a4";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    if (u.type === "ram") {
      poly(
        [
          [p.x - 18, p.y - 5],
          [p.x - 14, p.y - 24],
          [p.x + 13, p.y - 19],
          [p.x + 20, p.y],
          [p.x, p.y + 5],
        ],
        "#8b8260",
      );
      poly(
        [
          [p.x - 14, p.y - 24],
          [p.x - 4, p.y - 30],
          [p.x + 20, p.y - 16],
          [p.x + 13, p.y - 19],
        ],
        "#829177",
      );
      line(
        [
          [p.x - 24, p.y - 7],
          [p.x + 24, p.y + 6],
        ],
        "#bca878",
        5,
      );
      ellipse(p.x - 9, p.y + 2, 5, 5, "#5e6c52");
      ellipse(p.x + 15, p.y + 6, 5, 5, "#5e6c52");
      line(
        [
          [p.x - 9, p.y],
          [p.x - 9, p.y + 4],
        ],
        "#ac9c72",
        1,
      );
      flag(u.x, u.y, 43, u.team, true);
    } else {
      let horse = u.type === "knight" || u.type === "scout",
        off = horse ? 12 : 0;
      if (horse) {
        ellipse(
          p.x,
          p.y - 8,
          13,
          7,
          u.type === "knight" ? "#898675" : "#a58d69",
        );
        line(
          [
            [p.x - 8, p.y - 8],
            [p.x - 9 + step, p.y + 4],
          ],
          "#6d705b",
          3,
        );
        line(
          [
            [p.x + 8, p.y - 8],
            [p.x + 9 - step, p.y + 4],
          ],
          "#6d705b",
          3,
        );
        poly(
          [
            [p.x + 8, p.y - 8],
            [p.x + 10, p.y - 21],
            [p.x + 16, p.y - 23],
            [p.x + 20, p.y - 15],
            [p.x + 13, p.y - 13],
          ],
          "#9b8e72",
        );
        line(
          [
            [p.x - 12, p.y - 10],
            [p.x - 17, p.y - 15],
          ],
          "#686f58",
          2,
        );
      }
      line(
        [
          [p.x - 2, p.y - off - 8],
          [p.x - 3 + step, p.y - off + 1],
          [p.x - 5 + step, p.y - off + 1],
        ],
        "#6b725d",
        2.5,
      );
      line(
        [
          [p.x + 2, p.y - off - 8],
          [p.x + 3 - step, p.y - off + 1],
          [p.x + 5 - step, p.y - off + 1],
        ],
        "#6b725d",
        2.5,
      );
      poly(
        [
          [p.x - 4, p.y - off - 18],
          [p.x + 4, p.y - off - 18],
          [p.x + 5, p.y - off - 6],
          [p.x - 5, p.y - off - 6],
        ],
        u.type === "villager"
          ? "#e0d1a5"
          : u.type === "militia"
            ? "#8f9c8b"
            : "#a7ada0",
        "#71816550",
      );
      poly(
        [
          [p.x - 4, p.y - off - 16],
          [p.x + 4, p.y - off - 16],
          [p.x + 3, p.y - off - 12],
          [p.x - 4, p.y - off - 12],
        ],
        team,
      );
      ellipse(p.x, p.y - off - 22, 4, 4, "#cfb78c");
      if (u.type === "villager") {
        poly(
          [
            [p.x - 6, p.y - off - 24],
            [p.x, p.y - off - 29],
            [p.x + 6, p.y - off - 24],
          ],
          "#b19a65",
        );
        line(
          [
            [p.x - 3, p.y - off - 18],
            [p.x - 7, p.y - off - 10],
          ],
          "#c9b38a",
          2,
        );
        let swing =
          u.task === "gather" || u.task === "build"
            ? Math.sin((u.workAnim || 0) * 3) * 5
            : 0;
        line(
          [
            [p.x + 4, p.y - off - 16],
            [p.x + 8, p.y - off - 11 - swing],
          ],
          "#c9b38a",
          2,
        );
        line(
          [
            [p.x + 7, p.y - off - 5],
            [p.x + 10, p.y - off - 22 - swing],
          ],
          "#8c7a54",
          1.5,
        );
        if (u.task === "gather" && u.gatherType === "wood")
          poly(
            [
              [p.x + 9, p.y - off - 22 - swing],
              [p.x + 15, p.y - off - 22 - swing],
              [p.x + 15, p.y - off - 18 - swing],
              [p.x + 9, p.y - off - 18 - swing],
            ],
            "#aeb6a4",
          );
      } else {
        poly(
          [
            [p.x - 4, p.y - off - 23],
            [p.x - 3, p.y - off - 27],
            [p.x + 3, p.y - off - 27],
            [p.x + 5, p.y - off - 23],
          ],
          u.type === "scout" ? "#9a8762" : "#aeb5a5",
        );
        if (u.type === "archer") {
          line(
            [
              [p.x + 3, p.y - off - 16],
              [p.x + 8, p.y - off - 16],
            ],
            "#c9b38a",
            2,
          );
          ctx.beginPath();
          ctx.arc(p.x + 6, p.y - off - 15, 8, -1.4, 1.4);
          ctx.strokeStyle = "#b29a6d";
          ctx.lineWidth = 1.5;
          ctx.stroke();
          line(
            [
              [p.x + 7, p.y - off - 23],
              [p.x + 7, p.y - off - 7],
            ],
            "#d4caa4",
            0.6,
          );
        } else {
          let swing = u.swing > 0 ? -12 : 0;
          line(
            [
              [p.x + 4, p.y - off - 16],
              [p.x + 8, p.y - off - 11],
            ],
            "#aab4a0",
            2,
          );
          line(
            [
              [p.x + 8, p.y - off - 10],
              [p.x + 12 - swing, p.y - off - 29 + (swing ? -3 : 0)],
            ],
            "#d1d7c1",
            2,
          );
          poly(
            [
              [p.x - 7, p.y - off - 18],
              [p.x - 2, p.y - off - 16],
              [p.x - 3, p.y - off - 9],
              [p.x - 6, p.y - off - 7],
              [p.x - 9, p.y - off - 13],
            ],
            team,
            "#9b9168",
            0.7,
          );
        }
      }
    }
    if (u.hp < u.maxHp || selection.includes(u.id))
      drawBar(
        p.x,
        p.y -
          (u.type === "ram"
            ? 45
            : u.type === "knight" || u.type === "scout"
              ? 47
              : 34),
        23,
        u.hp / u.maxHp,
        u.team === 0 ? "#d2dca4" : "#c78066",
      );
  }
  function drawBar(x, y, w, value, color) {
    ctx.fillStyle = "#344c3c99";
    ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 4);
    ctx.fillStyle = color;
    ctx.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, value)), 2);
  }
  function drawDecor(d) {
    let p = iso(d.x, d.y);
    if (d.type === "deer") {
      ellipse(p.x, p.y, 7, 3, "#314d3225");
      ellipse(p.x, p.y - 7, 7, 4, "#a48f69");
      line(
        [
          [p.x - 4, p.y - 6],
          [p.x - 5, p.y],
        ],
        "#7e7856",
        1.5,
      );
      line(
        [
          [p.x + 4, p.y - 6],
          [p.x + 5, p.y],
        ],
        "#7e7856",
        1.5,
      );
      line(
        [
          [p.x + 5, p.y - 8],
          [p.x + 7, p.y - 14],
        ],
        "#a48f69",
        3,
      );
      ellipse(p.x + 9, p.y - 14, 3, 2, "#a48f69");
      line(
        [
          [p.x + 7, p.y - 15],
          [p.x + 5, p.y - 20],
          [p.x + 3, p.y - 19],
        ],
        "#827b5e",
        1,
      );
    } else if (d.type === "flower") {
      for (let i = 0; i < 3; i++) {
        line(
          [
            [p.x + i * 3, p.y],
            [p.x + i * 3 - 2, p.y - 4],
          ],
          "#81916c",
          0.8,
        );
        ellipse(
          p.x + i * 3 - 2,
          p.y - 4,
          1.4,
          1.4,
          d.variant > 0.5 ? "#e3d4a0" : "#dbdac4",
        );
      }
    } else
      for (let i = 0; i < 3; i++)
        line(
          [
            [p.x + i * 2, p.y],
            [p.x + i * 3 - 2, p.y - 4],
          ],
          "#6f86565a",
          1,
        );
  }
  function inView(e, margin = 150) {
    let p = screen(e.x, e.y);
    return (
      p.x > -margin &&
      p.x < screenW + margin &&
      p.y > -margin &&
      p.y < screenH + margin
    );
  }
  function render(dt) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, screenW, screenH);
    ctx.fillStyle = "#8da17a";
    ctx.fillRect(0, 0, screenW, screenH);
    ctx.save();
    ctx.translate(
      screenW / 2 - camera.x * camera.zoom,
      screenH / 2 - camera.y * camera.zoom,
    );
    ctx.scale(camera.zoom, camera.zoom);
    ctx.drawImage(terrain, -terrainOrigin.x, -terrainOrigin.y);
    let entities = [
      ...decor.filter((e) => explored(e)),
      ...state.nodes.filter((e) => !e.dead && explored(e)),
      ...state.buildings.filter(
        (e) => !e.dead && (e.team === 0 || explored(e)),
      ),
      ...state.units.filter((e) => !e.dead && (e.team === 0 || visible(e))),
    ].filter((e) => inView(e));
    entities.sort(
      (a, b) => a.x + a.y - (b.x + b.y) || (a.kind === "unit" ? 1 : -1),
    );
    for (const e of entities) {
      ctx.globalAlpha = e.team === 1 && !visible(e) ? 0.5 : 1;
      if (e.kind === "building") {
        if (selection.includes(e.id)) {
          poly(tilePoly(e.x, e.y, e.size + 0.4), "#e4d99b25", "#f0e3ad", 1.5);
        }
        drawBuilding(e);
      } else if (e.kind === "unit") drawUnit(e);
      else if (e.kind === "node") drawNode(e);
      else drawDecor(e);
    }
    ctx.globalAlpha = 1;
    // A cached soft fog mask keeps the frontier atmospheric and rendering fast.
    if (fogDirty || !fogLayer) buildFog();
    ctx.drawImage(
      fogLayer,
      -terrainOrigin.x,
      -terrainOrigin.y,
      terrain.width,
      terrain.height,
    );
    for (const p of projectiles) {
      let t = Math.min(1, p.progress),
        pos = iso(p.x * (1 - t) + p.tx * t, p.y * (1 - t) + p.ty * t);
      let y = pos.y - 22 - Math.sin(t * Math.PI) * 20;
      line(
        [
          [pos.x - 4, y + 2],
          [pos.x + 4, y - 2],
        ],
        "#d4cda2",
        1.3,
      );
    }
    for (const p of particles) {
      p.life -= dt;
      let pos = iso(p.x, p.y),
        v = p.life / p.max;
      ctx.globalAlpha = v;
      if (p.type === "rally" || p.type === "attackMarker") {
        ctx.beginPath();
        ctx.ellipse(
          pos.x,
          pos.y,
          19 + (1 - v) * 15,
          9 + (1 - v) * 8,
          0,
          0,
          Math.PI * 2,
        );
        ctx.strokeStyle = p.type === "rally" ? "#f5e7a7" : "#c6785c";
        ctx.lineWidth = 2;
        ctx.stroke();
        line(
          [
            [pos.x - 5, pos.y],
            [pos.x + 5, pos.y],
          ],
          ctx.strokeStyle,
          1,
        );
        line(
          [
            [pos.x, pos.y - 3],
            [pos.x, pos.y + 3],
          ],
          ctx.strokeStyle,
          1,
        );
      } else
        for (let i = 0; i < 6; i++)
          ellipse(
            pos.x + Math.sin(i * 3) * 15 * (1 - v),
            pos.y - 8 - Math.cos(i * 2) * 12 * (1 - v),
            7,
            5,
            "#c8c3a0",
          );
    }
    particles = particles.filter((p) => p.life > 0);
    ctx.globalAlpha = 1;
    if (placement) {
      let x = Math.round(pointer.wx),
        y = Math.round(pointer.wy),
        valid = validPlacement(placement, x, y),
        p = iso(x, y);
      poly(
        tilePoly(x, y, BUILDINGS[placement].size + 0.2),
        valid ? "#d9e2a866" : "#c5857566",
        valid ? "#f0edbf" : "#b06751",
        2,
      );
      ctx.globalAlpha = 0.55;
      drawBuilding(
        {
          type: placement,
          x,
          y,
          size: BUILDINGS[placement].size,
          team: 0,
          hp: BUILDINGS[placement].hp,
          maxHp: BUILDINGS[placement].hp,
          progress: 1,
          queue: [],
        },
        true,
      );
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    if (drag && drag.moved) {
      ctx.fillStyle = "#e0d9a429";
      ctx.strokeStyle = "#e9e0ab";
      ctx.lineWidth = 1;
      ctx.fillRect(drag.x, drag.y, pointer.x - drag.x, pointer.y - drag.y);
      ctx.strokeRect(drag.x, drag.y, pointer.x - drag.x, pointer.y - drag.y);
    }
    if (paused && started && !$("#modal-root").children.length) {
      ctx.fillStyle = "#203f2c99";
      ctx.fillRect(screenW / 2 - 76, 99, 152, 34);
      ctx.fillStyle = "#f5f1d9";
      ctx.font = '10px "DM Sans",sans-serif';
      ctx.textAlign = "center";
      ctx.fillText("K I N G D O M  P A U S E D", screenW / 2, 120);
    }
    renderMinimap();
  }
  function buildFog() {
    const scale = 0.25,
      raw = document.createElement("canvas");
    raw.width = Math.ceil(terrain.width * scale);
    raw.height = Math.ceil(terrain.height * scale);
    let f = raw.getContext("2d");
    f.setTransform(
      scale,
      0,
      0,
      scale,
      terrainOrigin.x * scale,
      terrainOrigin.y * scale,
    );
    for (let y = 0; y < WORLD; y++)
      for (let x = 0; x < WORLD; x++) {
        let i = y * WORLD + x;
        if (state.visible[i]) continue;
        let pts = tilePoly(x, y, 1.06);
        f.beginPath();
        pts.forEach((p, k) =>
          k ? f.lineTo(p[0], p[1]) : f.moveTo(p[0], p[1]),
        );
        f.closePath();
        f.fillStyle = state.explored[i] ? "#485e4c30" : "#566e5bed";
        f.fill();
      }
    fogLayer = document.createElement("canvas");
    fogLayer.width = raw.width;
    fogLayer.height = raw.height;
    let out = fogLayer.getContext("2d");
    out.filter = "blur(4px)";
    out.drawImage(raw, 0, 0);
    fogDirty = false;
  }
  function renderMinimap() {
    const w = mini.width,
      h = mini.height;
    mctx.fillStyle = "#546b58";
    mctx.fillRect(0, 0, w, h);
    for (let y = 0; y < WORLD; y++)
      for (let x = 0; x < WORLD; x++) {
        let i = y * WORLD + x;
        if (!state.explored[i]) continue;
        mctx.fillStyle = state.visible[i] ? "#a3b28a" : "#7c9273";
        mctx.fillRect(
          (x / WORLD) * w,
          (y / WORLD) * h,
          w / WORLD + 1,
          h / WORLD + 1,
        );
      }
    for (const n of state.nodes) {
      if (!n.dead && explored(n)) {
        mctx.fillStyle =
          n.type === "wood"
            ? "#526e4e"
            : n.type === "gold"
              ? "#d3bb75"
              : n.type === "stone"
                ? "#bfc5ac"
                : "#a18263";
        mctx.fillRect((n.x / WORLD) * w - 1, (n.y / WORLD) * h - 1, 2, 2);
      }
    }
    for (const b of state.buildings) {
      if (b.dead || (b.team === 1 && !explored(b))) continue;
      mctx.fillStyle = b.team === 0 ? "#eed38b" : "#c47059";
      mctx.fillRect(
        ((b.x - b.size / 2) / WORLD) * w,
        ((b.y - b.size / 2) / WORLD) * h,
        (b.size / WORLD) * w,
        (b.size / WORLD) * h,
      );
    }
    for (const u of state.units) {
      if (u.dead || (u.team === 1 && !visible(u))) continue;
      mctx.fillStyle = u.team === 0 ? "#f5e4ac" : "#df8b71";
      mctx.fillRect((u.x / WORLD) * w - 1, (u.y / WORLD) * h - 1, 2, 2);
    } // Mark rival's known frontier, even before the scout arrives.
    let tc = completed(1, "town")[0];
    if (tc && !explored(tc)) {
      mctx.strokeStyle = "#ba7c68";
      mctx.strokeRect((tc.x / WORLD) * w - 3, (tc.y / WORLD) * h - 3, 6, 6);
    }
    mctx.beginPath();
    [
      [0, 84],
      [screenW, 84],
      [screenW, screenH - 200],
      [0, screenH - 200],
    ].forEach(([x, y], i) => {
      let p = world(x, y);
      i
        ? mctx.lineTo((p.x / WORLD) * w, (p.y / WORLD) * h)
        : mctx.moveTo((p.x / WORLD) * w, (p.y / WORLD) * h);
    });
    mctx.closePath();
    mctx.strokeStyle = "#f5ecd3bb";
    mctx.lineWidth = 1;
    mctx.stroke();
  }
  function commandButton(type, kind) {
    let def =
      kind === "build"
        ? BUILDINGS[type]
        : kind === "train"
          ? UNITS[type]
          : kind === "tech"
            ? TECHS[type]
            : AGES[state.age[0] + 1];
    if (!def) return "";
    let disabled =
      kind === "age"
        ? !!state.advancing[0]
        : state.age[0] < (def.age || 1) ||
          (kind === "tech" && state.tech[0][type]);
    let label =
      kind === "age"
        ? `Age ${["", "I", "II", "III", "IV"][state.age[0] + 1]}`
        : def.name;
    if (kind === "tech" && state.tech[0][type]) label = "Researched";
    return `<button class="command ${kind === "age" ? "primary" : ""}" data-action="${kind}" data-type="${type}" ${disabled ? "disabled" : ""} aria-label="${kind === "train" ? "Train " : kind === "build" ? "Build " : ""}${def.name || def.label}"><span class="shortcut">${kind === "build" ? def.key || "" : ""}</span><span class="icon">${svgIcon(kind === "age" ? "age" : type)}</span><span class="name">${label}</span><span class="cost">${disabled && state.age[0] < (def.age || 1) ? "AGE " + ["", "I", "II", "III", "IV"][def.age] : kind === "age" && state.advancing[0] ? Math.ceil(state.advancing[0].remaining) + "s remaining" : kind === "tech" && state.tech[0][type] ? "✓ Complete" : costString(def.cost)}</span></button>`;
  }
  function updateUI() {
    if (!state) return;
    let res = state.resources[0],
      income = { food: 0, wood: 0, gold: 0, stone: 0 };
    for (const u of state.units)
      if (u.team === 0 && u.task === "gather") income[u.gatherType]++;
    $("#resources").innerHTML = Object.entries(RES)
      .map(
        ([r, def]) =>
          `<div class="resource" title="${r === "pop" ? "Population / capacity. Houses add 5 capacity." : `${def.name}: ${income[r]} villagers assigned`}"><svg viewBox="0 0 30 30" style="color:${def.color}">${def.path}</svg><div><strong>${r === "pop" ? population(0) + '<span style="font-size:11px;color:#929984"> / ' + capacity(0) + "</span>" : Math.floor(res[r])}${r !== "pop" && income[r] ? '<span class="income">+' + income[r] + "</span>" : ""}</strong><small>${def.name.toUpperCase()}</small></div></div>`,
      )
      .join("");
    $("#age-number").textContent = ["", "I", "II", "III", "IV"][state.age[0]];
    $("#age-name").textContent = AGES[state.age[0]].name;
    $("#speed-btn").textContent = speed + "×";
    $("#time").textContent =
      Math.floor(state.time / 60)
        .toString()
        .padStart(2, "0") +
      ":" +
      Math.floor(state.time % 60)
        .toString()
        .padStart(2, "0");
    $("#pause-btn").textContent = paused ? "▷" : "Ⅱ";
    $("#status-text").textContent = state.over
      ? state.over === "victory"
        ? "The realm is yours"
        : "Your reign has ended"
      : paused
        ? "Kingdom paused"
        : "Your kingdom is growing";
    let villagers = state.units.filter(
        (u) => u.team === 0 && u.type === "villager" && !u.dead,
      ).length,
      age = state.age[0];
    let goals = [
      {
        name: "Grow your village",
        done: villagers >= 12,
        count: Math.min(12, villagers) + "/12 villagers",
      },
      {
        name: "Reach the Feudal Age",
        done: age >= 2,
        count: age >= 2 ? "Complete" : "Age II",
      },
      {
        name: "Raise a fighting force",
        done: militaryCount(0) >= 10,
        count: Math.min(10, militaryCount(0)) + "/10 troops",
      },
      {
        name: "Defeat House Ashford",
        done: state.over === "victory",
        count: "Town center",
      },
    ];
    $("#objectives").innerHTML = goals
      .map(
        (g) =>
          `<div class="objective ${g.done ? "done" : ""}"><span class="check">${g.done ? "✓" : ""}</span><span>${g.name}</span><span class="count">${g.count}</span></div>`,
      )
      .join("");
    if (age >= 2) {
      $(".chapter-panel h1").textContent =
        age === 2
          ? "A kingdom takes shape."
          : age === 3
            ? "An age of ambition."
            : "An empire rises.";
    }
    selection = selection.filter((id) => {
      let e = getEntity(id);
      return e && !e.dead;
    });
    let chosen = selection.map(getEntity),
      e = chosen[0];
    let panel = $("#selection-panel");
    if (e) {
      let def =
        e.kind === "building"
          ? BUILDINGS[e.type]
          : e.kind === "unit"
            ? UNITS[e.type]
            : {
                name:
                  e.type === "wood"
                    ? "Forest"
                    : e.type === "food"
                      ? "Berry bushes"
                      : e.type === "gold"
                        ? "Gold deposit"
                        : "Stone deposit",
                description:
                  "Select a villager and right click here to gather.",
              };
      let multi = chosen.length > 1;
      let totalHp = chosen.reduce((n, u) => n + (u.hp || 0), 0),
        maxHp = chosen.reduce((n, u) => n + (u.maxHp || 0), 0);
      let task = multi
        ? "Right click to issue an order"
        : e.kind === "unit"
          ? {
              gather: "Gathering " + e.gatherType,
              build: "Constructing",
              repair: "Repairing",
              move: "Moving",
              attack: "In combat",
              idle: "Awaiting your command",
            }[e.task]
          : e.kind === "building"
            ? e.progress < 1
              ? "Under construction"
              : e.team === 1
                ? "House Ashford"
                : "Your settlement"
            : "Natural resource";
      panel.innerHTML = `<div class="selection-top"><div class="portrait">${svgIcon(e.kind === "node" ? (e.type === "wood" ? "lumber" : e.type === "food" ? "farm" : "tower") : e.type)}</div><div><h2>${multi ? chosen.length + " units selected" : def.name}</h2><p>${task}</p>${maxHp ? `<div class="health-track"><div style="width:${(totalHp / maxHp) * 100}%"></div></div>` : ""}</div></div><div class="selection-details"><span>${maxHp ? Math.ceil(totalHp) + " / " + Math.ceil(maxHp) + " HP" : Math.floor(e.amount) + " remaining"}</span><span>${e.kind === "unit" ? (e.type === "villager" ? "ECONOMY" : "MILITARY") : e.kind === "building" ? (e.progress < 1 ? Math.floor(e.progress * 100) + "% built" : e.team === 0 ? "HOUSE OF THE CROWN" : "HOUSE ASHFORD") : "GATHERABLE"}</span></div>${
        e.queue?.length
          ? `<div class="queue">${e.queue
              .slice(0, 4)
              .map(
                (q) =>
                  `<div class="queue-item" style="--progress:${(1 - q.remaining / q.total) * 100}%">${UNITS[q.type].name} ${Math.ceil(q.remaining)}s</div>`,
              )
              .join(
                "",
              )}${e.queue.length > 4 ? "<span>+" + (e.queue.length - 4) + "</span>" : ""}</div>`
          : `<p class="selection-description">${multi ? "An army is stronger together. Protect your archers and send siege against buildings." : def.description}</p>`
      }`;
    } else
      panel.innerHTML = `<div class="selection-top"><div class="portrait">${svgIcon("age")}</div><div><h2>Your kingdom</h2><p>Select a unit or building</p></div></div><p class="selection-description">Left click to select. Right click to send your people to work, explore, or battle.</p>`;
    let html = "";
    if (tab === "build") {
      let types =
        state.age[0] === 1
          ? ["house", "mill", "lumber", "farm", "barracks", "tower", "castle"]
          : state.age[0] === 2
            ? [
                "house",
                "farm",
                "barracks",
                "archery",
                "stable",
                "tower",
                "castle",
              ]
            : [
                "house",
                "farm",
                "archery",
                "stable",
                "tower",
                "workshop",
                "castle",
              ];
      html = types.map((t) => commandButton(t, "build")).join("");
      $("#command-context").textContent = placement
        ? "CHOOSE A PLACE TO BUILD"
        : "SHAPE YOUR SETTLEMENT";
    } else if (tab === "military") {
      html = ["villager", "militia", "archer", "knight", "ram", "scout"]
        .map((t) => commandButton(t, "train"))
        .join("");
      $("#command-context").textContent = "RAISE YOUR PEOPLE & YOUR ARMY";
    } else {
      html =
        commandButton("age", "age") +
        Object.keys(TECHS)
          .map((t) => commandButton(t, "tech"))
          .join("");
      if (state.age[0] === 4)
        html =
          `<div style="padding:20px;font-size:11px;color:#6a7d5e">The Imperial Age<br><small>Your kingdom has reached its full potential.</small></div>` +
          html;
      $("#command-context").textContent = "A NEW CHAPTER AWAITS";
    }
    // Avoid replacing buttons while they are hovered or pressed, so tooltips and rapid training remain reliable.
    let commands = $("#commands");
    if (commands.dataset.content !== html) {
      commands.innerHTML = html;
      commands.dataset.content = html;
      for (const button of commands.querySelectorAll("button")) {
        button.onclick = (ev) => {
          let type = button.dataset.type,
            kind = button.dataset.action;
          if (kind === "build") startPlacement(type);
          else if (kind === "train") {
            for (let i = 0; i < (ev.shiftKey ? 5 : 1); i++)
              if (!train(type)) break;
          } else if (kind === "age") advance();
          else research(type);
        };
        button.onmouseenter = () => showTooltip(button);
        button.onmouseleave = () => $("#tooltip").classList.add("hidden");
      }
    }
    for (const button of $(".tabs").children)
      button.classList.toggle("active", button.dataset.tab === tab);
  }
  function showTooltip(button) {
    let type = button.dataset.type,
      kind = button.dataset.action,
      def =
        kind === "build"
          ? BUILDINGS[type]
          : kind === "train"
            ? UNITS[type]
            : kind === "tech"
              ? TECHS[type]
              : AGES[state.age[0] + 1];
    if (!def) return;
    let tooltip = $("#tooltip");
    tooltip.innerHTML = `<strong>${def.name || def.label}</strong>${kind === "age" ? "Unlock new buildings and units. All military units gain more health and attack." : def.description}<br><small>${costString(def.cost)}${kind === "train" ? " · " + def.time + "s · Requires " + BUILDINGS[def.from].name : kind === "age" ? " · " + def.time + "s" : ""}</small>`;
    tooltip.classList.remove("hidden");
    let r = button.getBoundingClientRect();
    tooltip.style.left = Math.min(screenW - 270, Math.max(10, r.left)) + "px";
    tooltip.style.top = r.top - tooltip.offsetHeight - 9 + "px";
  }
  function hitTest(sx, sy) {
    let p = world(sx, sy),
      units = state.units
        .filter((u) => !u.dead && (u.team === 0 || visible(u)))
        .sort((a, b) => b.x + b.y - (a.x + a.y));
    for (const u of units) {
      let s = screen(u.x, u.y),
        h = u.type === "knight" || u.type === "scout" ? 40 : 30;
      if (
        Math.abs(sx - s.x) < 15 * camera.zoom &&
        sy > s.y - h * camera.zoom &&
        sy < s.y + 8 * camera.zoom
      )
        return u;
    }
    let buildings = state.buildings
      .filter((b) => !b.dead && (b.team === 0 || explored(b)))
      .sort((a, b) => b.x + b.y - (a.x + a.y));
    for (const b of buildings) {
      if (Math.abs(p.x - b.x) < b.size / 2 && Math.abs(p.y - b.y) < b.size / 2)
        return b;
      let s = screen(b.x, b.y);
      if (
        Math.abs(sx - s.x) < b.size * 15 * camera.zoom &&
        sy < s.y &&
        sy > s.y - (b.type === "town" ? 105 : 65) * camera.zoom
      )
        return b;
    }
    let nodes = state.nodes
      .filter((n) => !n.dead && explored(n))
      .sort((a, b) => distance(a, p) - distance(b, p));
    if (nodes[0] && distance(nodes[0], p) < 1.05) return nodes[0];
    return null;
  }
  function selectEntity(e, shift = false) {
    if (!shift) selection = [];
    if (e) {
      if (shift && selection.includes(e.id))
        selection = selection.filter((id) => id !== e.id);
      else selection.push(e.id);
      tone(440, 0.025);
    }
    updateUI();
  }
  function resize() {
    screenW = window.innerWidth;
    screenH = window.innerHeight;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = screenW * dpr;
    canvas.height = screenH * dpr;
    canvas.style.width = screenW + "px";
    canvas.style.height = screenH + "px";
  }
  function home() {
    let b = completed(0, "town")[0];
    if (b) {
      camera.x = iso(b.x, b.y).x;
      camera.y = iso(b.x, b.y).y + 38;
      selection = [b.id];
      updateUI();
    }
  }
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("pointerdown", (e) => {
    if (!started || state.over) return;
    let p = world(e.clientX, e.clientY);
    if (e.button === 2) {
      if (placement) {
        cancelPlacement();
        return;
      }
      commandUnits(hitTest(e.clientX, e.clientY), p);
      updateUI();
    } else if (e.button === 0) {
      if (placement) {
        let x = Math.round(p.x),
          y = Math.round(p.y);
        if (!placeBuilding(placement, x, y))
          toast("Choose an open, explored patch of land.");
        return;
      }
      drag = { x: e.clientX, y: e.clientY, moved: false };
      canvas.setPointerCapture(e.pointerId);
    } else if (e.button === 1) {
      drag = {
        x: e.clientX,
        y: e.clientY,
        middle: true,
        camX: camera.x,
        camY: camera.y,
      };
      e.preventDefault();
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    let p = world(pointer.x, pointer.y);
    pointer.wx = p.x;
    pointer.wy = p.y;
    if (drag) {
      if (drag.middle) {
        camera.x = drag.camX - (pointer.x - drag.x) / camera.zoom;
        camera.y = drag.camY - (pointer.y - drag.y) / camera.zoom;
      } else if (Math.hypot(pointer.x - drag.x, pointer.y - drag.y) > 6)
        drag.moved = true;
    } else if (!placement) {
      let hit = hitTest(pointer.x, pointer.y);
      canvas.style.cursor = hit ? "pointer" : "default";
    }
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!drag) return;
    if (drag.middle) {
      drag = null;
      return;
    }
    if (drag.moved) {
      let left = Math.min(drag.x, pointer.x),
        right = Math.max(drag.x, pointer.x),
        top = Math.min(drag.y, pointer.y),
        bottom = Math.max(drag.y, pointer.y);
      let chosen = state.units.filter((u) => {
        let p = screen(u.x, u.y);
        return (
          u.team === 0 &&
          !u.dead &&
          p.x >= left &&
          p.x <= right &&
          p.y >= top &&
          p.y <= bottom
        );
      });
      selection = e.shiftKey
        ? [...new Set([...selection, ...chosen.map((u) => u.id)])]
        : chosen.map((u) => u.id);
      updateUI();
    } else selectEntity(hitTest(e.clientX, e.clientY), e.shiftKey);
    drag = null;
  });
  canvas.addEventListener("dblclick", (e) => {
    let u = hitTest(e.clientX, e.clientY);
    if (u?.kind === "unit" && u.team === 0) {
      selection = state.units
        .filter(
          (o) => o.team === 0 && o.type === u.type && !o.dead && inView(o, 0),
        )
        .map((o) => o.id);
      updateUI();
    }
  });
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      let before = world(e.clientX, e.clientY);
      camera.zoom = Math.max(
        0.45,
        Math.min(1.7, camera.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08)),
      );
      let after = world(e.clientX, e.clientY),
        offset = iso(before.x - after.x, before.y - after.y);
      camera.x += offset.x;
      camera.y += offset.y;
    },
    { passive: false },
  );
  mini.addEventListener("pointerdown", (e) => {
    if (!started) return;
    let r = mini.getBoundingClientRect(),
      p = iso(
        ((e.clientX - r.left) / r.width) * WORLD,
        ((e.clientY - r.top) / r.height) * WORLD,
      );
    camera.x = p.x;
    camera.y = p.y;
  });
  window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    if (
      ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
        e.code,
      )
    )
      e.preventDefault();
    keys[e.code] = true;
    if (e.repeat) return;
    if (e.code === "Escape") {
      if (placement) cancelPlacement();
      else if ($("#modal-root").children.length && started) closeModal();
      else {
        selection = [];
        updateUI();
      }
    }
    if (!started || $("#modal-root").children.length) return;
    if (e.code === "Space") {
      paused = !paused;
      updateUI();
    }
    if (e.code === "KeyH") home();
    if (e.code === "Digit1") {
      selection = state.units
        .filter(
          (u) =>
            u.team === 0 &&
            u.type === "villager" &&
            u.task === "idle" &&
            !u.dead,
        )
        .map((u) => u.id);
      updateUI();
      toast(
        selection.length
          ? selection.length + " idle villagers selected."
          : "All villagers are working.",
      );
    }
    if (e.code === "Digit2") {
      selection = state.units
        .filter((u) => u.team === 0 && u.type !== "villager" && !u.dead)
        .map((u) => u.id);
      updateUI();
    }
    if (["KeyQ", "KeyF", "KeyE", "KeyR", "KeyB", "KeyT"].includes(e.code)) {
      let type = Object.keys(BUILDINGS).find(
        (t) => BUILDINGS[t].key === e.key.toUpperCase(),
      );
      if (type) startPlacement(type);
    }
  });
  window.addEventListener("keyup", (e) => (keys[e.code] = false));
  window.addEventListener("blur", () => (keys = {}));
  window.addEventListener("resize", resize);
  $(".tabs").addEventListener("click", (e) => {
    if (e.target.dataset.tab) {
      tab = e.target.dataset.tab;
      $("#tooltip").classList.add("hidden");
      updateUI();
    }
  });
  $("#home-btn").onclick = home;
  $("#guide-btn").onclick = guide;
  $("#menu-btn").onclick = () => {
    if (started) settings();
  };
  $("#pause-btn").onclick = () => {
    if (!started || $("#modal-root").children.length) return;
    paused = !paused;
    updateUI();
  };
  $("#speed-btn").onclick = () => {
    speed = speed === 1 ? 2 : speed === 2 ? 3 : 1;
    updateUI();
    toast("Game speed: " + speed + "×");
  };
  $("#sound-btn").onclick = () => {
    soundEnabled = !soundEnabled;
    $("#sound-btn").style.background = soundEnabled ? "#dce5ce" : "";
    $("#sound-btn").title = soundEnabled ? "Sound on" : "Sound off";
    tone(520, 0.1);
    toast("Sound " + (soundEnabled ? "enabled" : "muted"));
  };
  window.addEventListener("beforeunload", saveGame);
  function frame(time) {
    let rawDt = Math.min(0.05, (time - lastTime) / 1000 || 0.016);
    lastTime = time;
    if (started && !$("#modal-root").children.length) {
      let pan = (420 * rawDt) / camera.zoom;
      if (keys.KeyW || keys.ArrowUp) camera.y -= pan;
      if (keys.KeyS || keys.ArrowDown) camera.y += pan;
      if (keys.KeyA || keys.ArrowLeft) camera.x -= pan;
      if (keys.KeyD || keys.ArrowRight) camera.x += pan;
      let p = uniso(camera.x, camera.y);
      p.x = Math.max(1, Math.min(WORLD - 1, p.x));
      p.y = Math.max(1, Math.min(WORLD - 1, p.y));
      let clamped = iso(p.x, p.y);
      camera.x = clamped.x;
      camera.y = clamped.y;
    }
    let dt = rawDt * speed;
    for (let i = 0; i < speed; i++) simulate(rawDt);
    uiTimer += rawDt;
    if (uiTimer > 0.4) {
      uiTimer = 0;
      updateUI();
    }
    render(rawDt);
    requestAnimationFrame(frame);
  }
  resize();
  initGame();
  welcome();
  requestAnimationFrame(frame);
  // Small inspection surface used by browser tests and useful for checking a saved skirmish.
  window.Crownfall = {
    get state() {
      return state;
    },
    get camera() {
      return camera;
    },
    get selection() {
      return selection;
    },
    get paused() {
      return paused;
    },
    start,
    train,
    advance,
    research,
    placeBuilding,
    validPlacement,
    commandUnits,
    addUnit,
    addBuilding,
    select(ids) {
      selection = ids;
      updateUI();
    },
    setTab(t) {
      tab = t;
      updateUI();
    },
    step(seconds) {
      for (let i = 0; i < seconds * 10 && !state.over; i++) simulate(0.1);
      reveal();
      updateUI();
    },
    screen,
    world,
    home,
    save: saveGame,
    load: loadGame,
    getEntity,
    damage,
    reveal,
    reset() {
      initGame();
      start();
    },
  };
})();
