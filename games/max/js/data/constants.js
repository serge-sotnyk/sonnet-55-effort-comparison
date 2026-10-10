// Global constants shared by simulation, rendering and UI. No DOM access here (runs in Node too).

export const TILE_W = 64;          // iso tile width in px at zoom 1
export const TILE_H = 32;          // iso tile height in px at zoom 1
export const TICK = 0.05;          // seconds of game time per simulation tick (20 Hz)
export const POP_MAX = 200;

export const RES = ['food', 'wood', 'gold', 'stone'];
export const AGE_NAMES = ['Dark Age', 'Feudal Age', 'Castle Age', 'Imperial Age'];
export const AGE_SHORT = ['Dark', 'Feudal', 'Castle', 'Imperial'];

// Index 0 is Gaia (neutral: animals, resources). Players are 1..N.
export const PLAYER_COLORS = [
  { name: 'Gaia',   main: '#8d8d85', light: '#c9c9c0', dark: '#4b4b46' },
  { name: 'Blue',   main: '#2f6fe0', light: '#86b4ff', dark: '#173a82' },
  { name: 'Red',    main: '#d93a32', light: '#ff9388', dark: '#7e1712' },
  { name: 'Green',  main: '#2fa84f', light: '#85e39b', dark: '#175a2a' },
  { name: 'Yellow', main: '#e8c02a', light: '#fbe58a', dark: '#8a6e0a' },
  { name: 'Cyan',   main: '#27b9c9', light: '#8aeaf3', dark: '#0f6670' },
  { name: 'Purple', main: '#9a4fd0', light: '#cf9cf5', dark: '#52207d' },
  { name: 'Orange', main: '#ee8626', light: '#ffc07f', dark: '#8c4709' },
];

// Terrain ids used in the map grid
export const T = { GRASS: 0, DIRT: 1, SAND: 2, SHALLOW: 3, DEEP: 4, FOREST: 5 };

// Directions: index 0..7. Facing vector in WORLD (tile) space; screen direction in parentheses.
//  0:+x (SE)  1:+x+y (S)  2:+y (SW)  3:-x+y (W)  4:-x (NW)  5:-x-y (N)  6:-y (NE)  7:+x-y (E)
export const DIR_VEC = [
  [1, 0], [0.7071, 0.7071], [0, 1], [-0.7071, 0.7071],
  [-1, 0], [-0.7071, -0.7071], [0, -1], [0.7071, -0.7071],
];
export function dirFromVec(dx, dy) {
  const a = Math.atan2(dy, dx);                  // world angle
  return ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
}

// Base gather rates (resource per game-second per villager)
export const GATHER_RATES = {
  wood: 0.40, berries: 0.50, farm: 0.33, hunt: 0.75, sheep: 0.75, gold: 0.38, stone: 0.36,
};

// Default number of resources per node
export const NODE_AMOUNT = {
  tree: 100, berries: 200, deer: 140, boar: 340, sheep: 100, gold: 800, stone: 350, farm: 200,
};

// Stance ids
export const STANCES = ['aggressive', 'defensive', 'standground', 'passive'];
