// Static layout tables for the command card + helpers to build tooltips.
import { UNITS, LINES } from '../data/units.js';
import { BUILDINGS } from '../data/buildings.js';
import { TECHS } from '../data/techs.js';
import { CIVS } from '../data/civs.js';
import { AGE_NAMES, RES } from '../data/constants.js';

// 5 x 3 grid: Q W E R T / A S D F G / Z X C V B
export const HOTKEYS = ['q', 'w', 'e', 'r', 't', 'a', 's', 'd', 'f', 'g', 'z', 'x', 'c', 'v', 'b'];

export const BUILD_PAGES = {
  eco: ['house', 'mill', 'lumber_camp', 'mining_camp', 'farm', 'market', 'blacksmith', 'university', 'monastery', 'town_center', 'wonder'],
  mil: ['barracks', 'archery_range', 'stable', 'siege_workshop', 'castle', 'outpost', 'watch_tower', 'palisade', 'stone_wall', 'gate'],
};

// slot kinds: { line } unit line | { tech: [chain] } | { unique:true } | { elite:true } | { civTech:true } | null
export const BUILDING_SLOTS = {
  town_center: [{ line: 'villager' }, { tech: ['loom'] }, { tech: ['wheelbarrow', 'hand_cart'] }, { tech: ['town_watch', 'town_patrol'] }, { tech: ['feudal_age', 'castle_age', 'imperial_age'] }],
  barracks: [{ line: 'swordsman' }, { line: 'spearman' }, { line: 'huskarl', onlyIfProduces: true }, null, null,
    { tech: ['man_at_arms', 'long_swordsman', 'two_handed', 'champion'] }, { tech: ['pikeman', 'halberdier'] }, { tech: ['squires'] }],
  archery_range: [{ line: 'archer' }, { line: 'skirmisher' }, { line: 'cavarcher' }, null, null,
    { tech: ['crossbowman', 'arbalester'] }, { tech: ['elite_skirmisher'] }, { tech: ['heavy_cav_archer'] }, { tech: ['thumb_ring'] }],
  stable: [{ line: 'scout' }, { line: 'knight' }, { line: 'camel' }, null, null,
    { tech: ['light_cavalry', 'hussar'] }, { tech: ['cavalier', 'paladin'] }, { tech: ['heavy_camel'] }, { tech: ['bloodlines'] }, { tech: ['husbandry'] }],
  siege_workshop: [{ line: 'ram' }, { line: 'mangonel' }, { line: 'scorpion' }, null, null,
    { tech: ['capped_ram', 'siege_ram'] }, { tech: ['onager', 'siege_onager'] }, { tech: ['heavy_scorpion'] }],
  castle: [{ unique: true }, { line: 'trebuchet' }, null, null, null,
    { elite: true }, { civTech: true }, { tech: ['conscription'] }, { tech: ['hoardings'] }],
  monastery: [{ line: 'monk' }, null, null, null, null,
    { tech: ['fervor'] }, { tech: ['sanctity'] }, { tech: ['illumination'] }, { tech: ['redemption'] }, { tech: ['atonement'] }, { tech: ['block_printing'] }],
  blacksmith: [{ tech: ['forging', 'iron_casting', 'blast_furnace'] }, { tech: ['scale_mail', 'chain_mail', 'plate_mail'] }, { tech: ['scale_barding', 'chain_barding', 'plate_barding'] },
    { tech: ['fletching', 'bodkin_arrow', 'bracer'] }, { tech: ['padded_archer_armor', 'leather_archer_armor', 'ring_archer_armor'] }],
  university: [{ tech: ['masonry', 'architecture'] }, { tech: ['ballistics'] }, { tech: ['treadmill_crane'] }, { tech: ['siege_engineers'] }, { tech: ['guard_tower', 'keep'] }, { tech: ['fortified_wall'] }],
  mill: [{ tech: ['horse_collar', 'heavy_plow', 'crop_rotation'] }],
  lumber_camp: [{ tech: ['double_bit_axe', 'bow_saw', 'two_man_saw'] }],
  mining_camp: [{ tech: ['gold_mining', 'gold_shaft_mining'] }, { tech: ['stone_mining', 'stone_shaft_mining'] }],
  market: [{ tech: ['coinage', 'banking'] }],
};

export const RES_NAMES = { food: 'Food', wood: 'Wood', gold: 'Gold', stone: 'Stone' };

export function costText(cost) {
  return RES.filter(r => cost[r]).map(r => `${cost[r]} ${r}`).join(', ');
}

/** HTML for a cost row with affordability coloring. icons: map res -> data URL */
export function costHtml(cost, player, icons) {
  let h = '<div class="tt-cost">';
  for (const r of RES) {
    if (!cost[r]) continue;
    const ok = !player || player.res[r] >= cost[r] - 1e-6;
    h += `<span class="${ok ? '' : 'no'}"><img src="${icons[r]}" width="16" height="16" style="vertical-align:-3px"> ${cost[r]}</span>`;
  }
  return h + '</div>';
}

export function unitStatLines(def) {
  const parts = [];
  const atk = [];
  for (const k in def.atk) {
    if (k === 'melee' || k === 'pierce') atk.push(`${Math.round(def.atk[k] * 10) / 10}`);
    else atk.push(`+${def.atk[k]} vs ${k}s`);
  }
  if (atk.length) parts.push(`Attack ${atk.join(', ')}`);
  parts.push(`HP ${def.hp}`);
  parts.push(`Armor ${def.armor.melee}/${def.armor.pierce}`);
  if (def.range) parts.push(`Range ${def.range}`);
  return parts.join(' • ');
}
