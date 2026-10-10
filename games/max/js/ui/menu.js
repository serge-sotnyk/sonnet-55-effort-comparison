// Menu screens: main menu, game setup, how-to-play, options.
import * as art from '../art/index.js';
import { CIVS, CIV_ORDER } from '../data/civs.js';
import { UNITS, LINES } from '../data/units.js';
import { TECHS } from '../data/techs.js';
import { MAP_TYPES, MAP_SIZES } from '../sim/map.js';
import { DIFFICULTY } from '../sim/game.js';

const $ = (id) => document.getElementById(id);

export const DEFAULT_CONFIG = { civ: 'britons', opponents: 1, difficulty: 'standard', map: 'highlands', size: 'medium', res: 'standard', reveal: false, wonder: false };

const HOW_TO = [
  ['Goal', `Build a thriving medieval town, advance through the four ages (Dark → Feudal → Castle → Imperial) and destroy every building and villager of your rival. The enemy is controlled by a computer opponent that expands, researches and attacks.`],
  ['Economy', `Villagers gather <b>food</b> (berries, hunting, farms), <b>wood</b>, <b>gold</b> and <b>stone</b>. Build a <b>Mill</b> near berries and farms, a <b>Lumber Camp</b> beside forests and a <b>Mining Camp</b> beside mines so they walk less. Build <b>Houses</b> to raise your population limit. Keep the Town Center training villagers!`],
  ['Mouse', `<b>Left-click</b> selects • <b>drag</b> box-selects • <b>double-click</b> selects all units of a type • <b>Right-click</b> is a smart command: move, gather, build, repair, garrison, attack. <b>Shift</b> + right-click queues commands. <b>Mouse wheel</b> zooms. <b>Middle-drag</b> pans the map. Move the mouse to a screen edge or use the <kbd>arrow keys</kbd> to scroll.`],
  ['Command Card', `The grid at the bottom-left matches your keyboard: <kbd>Q W E R T</kbd> / <kbd>A S D F G</kbd> / <kbd>Z X C V B</kbd>. Select a villager and press <kbd>Q</kbd> for economic buildings or <kbd>W</kbd> for military ones. Hold <kbd>Shift</kbd> to train five units at once.`],
  ['Hotkeys', `<kbd>H</kbd> Town Center • <kbd>.</kbd> idle villager • <kbd>,</kbd> idle soldier • <kbd>Ctrl</kbd>+<kbd>M</kbd> all military • <kbd>Ctrl</kbd>+<kbd>1-9</kbd> set group, <kbd>1-9</kbd> recall (twice to center) • <kbd>Space</kbd> jump to last alert • <kbd>Del</kbd> delete • <kbd>P</kbd> pause • <kbd>+</kbd>/<kbd>-</kbd> game speed • <kbd>Alt</kbd> show health bars • <kbd>Esc</kbd> cancel / menu.`],
  ['Advancing', `Select your Town Center and research the next age. You need <b>two different buildings</b> from the previous age (e.g. Mill + Lumber Camp → Feudal; Barracks-era buildings such as Market + Blacksmith → Castle). Each age unlocks stronger buildings, units and technologies.`],
  ['Combat', `Know your counters: <b>spearmen</b> stop cavalry • <b>archers</b> shred infantry • <b>cavalry</b> run down archers • <b>skirmishers</b> beat archers • <b>rams</b> break buildings (guard them from infantry!) • <b>monks</b> heal and convert. Blacksmith upgrades make armies far stronger. Garrison soldiers inside towers and the Town Center for extra arrows.`],
  ['Tips', `Scout early with your cavalry to find hunt and the enemy. Use the <b>Market</b> to turn surplus wood and food into gold. Walls and gates can stall an attack. Rally points (<kbd>V</kbd>) send new villagers straight to work. Pause with <kbd>P</kbd> any time to plan.`],
];

export class Menus {
  constructor(app) {
    this.app = app;
    this.cfg = Object.assign({}, DEFAULT_CONFIG, JSON.parse(localStorage.getItem('aoc.config') || '{}'));
    if (!CIVS[this.cfg.civ]) this.cfg.civ = 'britons';
    this.screens = ['main', 'setup', 'how', 'options', 'loading', 'pause', 'end'];
    this.buildSetup();
    this.buildHow();
    this.buildOptions();
    $('mm-play').onclick = () => { this.app.audioClick(); this.show('setup'); };
    $('mm-how').onclick = () => { this.app.audioClick(); this.prevScreen = 'main'; this.show('how'); };
    $('mm-options').onclick = () => { this.app.audioClick(); this.prevScreen = 'main'; this.show('options'); };
    $('setup-back').onclick = () => this.show('main');
    $('how-back').onclick = () => this.show(this.prevScreen === 'pause' ? 'pause' : 'main', this.prevScreen === 'pause');
    $('options-back').onclick = () => { this.app.saveSettings(); this.show(this.prevScreen === 'pause' ? 'pause' : 'main', this.prevScreen === 'pause'); };
    $('setup-start').onclick = () => { localStorage.setItem('aoc.config', JSON.stringify(this.cfg)); this.app.startGame(Object.assign({}, this.cfg)); };
    // crest
    const crest = $('main-crest'); crest.innerHTML = '';
    const cv = art.getIcon('age:3', 128); cv.style.width = '100%'; cv.style.height = '100%'; crest.appendChild(cv);
  }

  show(name, overlay) {
    for (const s of this.screens) $('screen-' + s).classList.add('hidden');
    if (name) $('screen-' + name).classList.remove('hidden');
    if (name === 'pause' || name === 'end') { /* overlay on top of game */ }
    this.current = name;
  }
  hideAll() { for (const s of this.screens) $('screen-' + s).classList.add('hidden'); this.current = null; }

  // ------------------------------------------------------------ setup
  seg(containerId, items, getter, setter, onChange) {
    const c = $(containerId); c.innerHTML = '';
    for (const [val, label] of items) {
      const b = document.createElement('button'); b.textContent = label;
      if (getter() === val) b.classList.add('on');
      b.onclick = () => { setter(val); for (const x of c.children) x.classList.remove('on'); b.classList.add('on'); this.app.audioClick(); if (onChange) onChange(); };
      c.appendChild(b);
    }
  }
  buildSetup() {
    const cards = $('civ-cards'); cards.innerHTML = '';
    for (const id of CIV_ORDER) {
      const civ = CIVS[id];
      const d = document.createElement('div'); d.className = 'civ-card' + (this.cfg.civ === id ? ' sel' : '');
      const cv = art.getCivEmblem(id, 128); d.appendChild(cv);
      d.insertAdjacentHTML('beforeend', `<div class="nm">${civ.name}</div><div class="tg">${civ.tagline}</div>`);
      d.onclick = () => { this.cfg.civ = id; for (const x of cards.children) x.classList.remove('sel'); d.classList.add('sel'); this.app.audioClick(); this.civDetail(); };
      cards.appendChild(d);
    }
    this.civDetail();
    this.seg('opt-opp', [[1, '1'], [2, '2'], [3, '3']], () => this.cfg.opponents, v => this.cfg.opponents = v);
    this.seg('opt-diff', Object.entries(DIFFICULTY).map(([k, v]) => [k, v.name]), () => this.cfg.difficulty, v => this.cfg.difficulty = v, () => { $('diff-desc').textContent = DIFFICULTY[this.cfg.difficulty].desc; });
    $('diff-desc').textContent = DIFFICULTY[this.cfg.difficulty].desc;
    this.seg('opt-map', Object.entries(MAP_TYPES).map(([k, v]) => [k, v.name]), () => this.cfg.map, v => this.cfg.map = v, () => { $('map-desc').textContent = MAP_TYPES[this.cfg.map].desc; });
    $('map-desc').textContent = MAP_TYPES[this.cfg.map].desc;
    this.seg('opt-size', [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']], () => this.cfg.size, v => this.cfg.size = v);
    this.seg('opt-res', [['low', 'Low'], ['standard', 'Standard'], ['high', 'High']], () => this.cfg.res, v => this.cfg.res = v);
    const rv = $('opt-reveal'), wv = $('opt-wonder');
    rv.checked = !!this.cfg.reveal; wv.checked = !!this.cfg.wonder;
    rv.onchange = () => this.cfg.reveal = rv.checked; wv.onchange = () => this.cfg.wonder = wv.checked;
  }
  civDetail() {
    const civ = CIVS[this.cfg.civ];
    const uu = UNITS[LINES[civ.uu][0]];
    const uts = civ.techs.map(t => TECHS[t].name).join(', ');
    $('civ-detail').innerHTML = `<div class="blurb"><b>${civ.name}</b> — ${civ.blurb}</div><ul>${civ.bonuses.map(b => `<li>${b}</li>`).join('')}</ul>
      <div><span class="uu">Unique unit:</span> ${uu.name} — ${uu.desc}</div><div><span class="uu">Unique techs:</span> ${uts}</div>`;
  }

  // ------------------------------------------------------------ how to
  buildHow() {
    const c = $('how-content'); c.innerHTML = '';
    for (const [h, t] of HOW_TO) { const d = document.createElement('div'); d.innerHTML = `<h4>${h}</h4><p>${t}</p>`; c.appendChild(d); }
  }

  // ------------------------------------------------------------ options
  buildOptions() {
    const s = this.app.settings, c = $('options-content'); c.innerHTML = '';
    const slider = (label, key, min, max, step, fmt, onInput) => {
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${s[key]}"><span class="val" style="min-width:42px;text-align:right">${fmt(s[key])}</span>`;
      const inp = row.querySelector('input'), val = row.querySelector('.val');
      inp.oninput = () => { s[key] = parseFloat(inp.value); val.textContent = fmt(s[key]); if (onInput) onInput(); };
      c.appendChild(row);
    };
    const check = (label, key, onChange) => {
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML = `<label class="chk"><input type="checkbox" ${s[key] ? 'checked' : ''}> ${label}</label>`;
      row.querySelector('input').onchange = (e) => { s[key] = e.target.checked; if (onChange) onChange(); };
      c.appendChild(row);
    };
    const pct = v => Math.round(v * 100) + '%';
    slider('Master volume', 'master', 0, 1, 0.01, pct, () => this.app.applyAudio());
    slider('Sound effects', 'sfx', 0, 1, 0.01, pct, () => this.app.applyAudio());
    slider('Music', 'music', 0, 1, 0.01, pct, () => this.app.applyAudio());
    slider('Scroll speed', 'scrollSpeed', 0.4, 2.5, 0.05, v => v.toFixed(1) + 'x', () => this.app.applySettings());
    slider('Interface size', 'uiScale', 0.8, 1.5, 0.05, v => v.toFixed(2) + 'x', () => this.app.applySettings());
    check('Edge scrolling', 'edgeScroll', () => this.app.applySettings());
    check('Always show health bars', 'showBars', () => this.app.applySettings());
    check('Show helpful hints', 'hints', () => this.app.applySettings());
    check('Mute all sound', 'muted', () => this.app.applyAudio());
  }
}
