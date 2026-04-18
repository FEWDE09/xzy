/** Classic 40-space Monopoly-style loop (0 = GO, clockwise). Stellar-themed labels. */

export const BOARD_SIZE = 40;

/** Jail / Just Visiting corner (classic index 10). */
export const JAIL_POSITION = 10;

export const CELL_TYPES = {
  GO: 'go',
  PROPERTY: 'property',
  CHANCE: 'chance',
  COMMUNITY: 'community_chest',
  TAX: 'tax',
  JAIL: 'jail',
  PARKING: 'parking',
  GO_TO_JAIL: 'go_to_jail',
  RAILROAD: 'railroad',
  UTILITY: 'utility',
};

/**
 * 1-based CSS grid lines on an 11×11 board (outer ring = play spaces).
 * GO bottom-right; counter-clockwise numbering matches classic clockwise travel from GO.
 */
function g(gr, gc) {
  return { gridRow: gr, gridCol: gc };
}

/** @type {Array<{
 *   id: number;
 *   type: string;
 *   name: string;
 *   price?: number;
 *   rent?: number;
 *   group?: string;
 *   color?: string;
 *   taxAmount?: number;
 *   gridRow: number;
 *   gridCol: number;
 * }>} */
export const BOARD = [
  { id: 0, type: CELL_TYPES.GO, name: 'GO — Collect salary', ...g(11, 11) },
  {
    id: 1,
    type: CELL_TYPES.PROPERTY,
    name: 'Mediterranean Ave',
    price: 60,
    rent: 8,
    group: 'brown',
    color: 'from-amber-800 to-amber-950',
    ...g(11, 10),
  },
  { id: 2, type: CELL_TYPES.COMMUNITY, name: 'Community Chest', ...g(11, 9) },
  {
    id: 3,
    type: CELL_TYPES.PROPERTY,
    name: 'Baltic Ave',
    price: 60,
    rent: 10,
    group: 'brown',
    color: 'from-amber-800 to-amber-950',
    ...g(11, 8),
  },
  { id: 4, type: CELL_TYPES.TAX, name: 'Income Tax', taxAmount: 100, ...g(11, 7) },
  {
    id: 5,
    type: CELL_TYPES.RAILROAD,
    name: 'Reading Railroad',
    price: 200,
    ...g(11, 6),
  },
  {
    id: 6,
    type: CELL_TYPES.PROPERTY,
    name: 'Oriental Ave',
    price: 100,
    rent: 12,
    group: 'light_blue',
    color: 'from-sky-400 to-sky-700',
    ...g(11, 5),
  },
  { id: 7, type: CELL_TYPES.CHANCE, name: 'Chance', ...g(11, 4) },
  {
    id: 8,
    type: CELL_TYPES.PROPERTY,
    name: 'Vermont Ave',
    price: 100,
    rent: 12,
    group: 'light_blue',
    color: 'from-sky-400 to-sky-700',
    ...g(11, 3),
  },
  {
    id: 9,
    type: CELL_TYPES.PROPERTY,
    name: 'Connecticut Ave',
    price: 120,
    rent: 14,
    group: 'light_blue',
    color: 'from-sky-400 to-sky-700',
    ...g(11, 2),
  },
  { id: 10, type: CELL_TYPES.JAIL, name: 'Jail / Just Visiting', ...g(11, 1) },
  {
    id: 11,
    type: CELL_TYPES.PROPERTY,
    name: 'St. Charles Place',
    price: 140,
    rent: 16,
    group: 'pink',
    color: 'from-pink-400 to-fuchsia-700',
    ...g(10, 1),
  },
  {
    id: 12,
    type: CELL_TYPES.UTILITY,
    name: 'Electric Company',
    price: 150,
    ...g(9, 1),
  },
  {
    id: 13,
    type: CELL_TYPES.PROPERTY,
    name: 'States Ave',
    price: 140,
    rent: 16,
    group: 'pink',
    color: 'from-pink-400 to-fuchsia-700',
    ...g(8, 1),
  },
  {
    id: 14,
    type: CELL_TYPES.PROPERTY,
    name: 'Virginia Ave',
    price: 160,
    rent: 18,
    group: 'pink',
    color: 'from-pink-400 to-fuchsia-700',
    ...g(7, 1),
  },
  {
    id: 15,
    type: CELL_TYPES.RAILROAD,
    name: 'Pennsylvania RR',
    price: 200,
    ...g(6, 1),
  },
  {
    id: 16,
    type: CELL_TYPES.PROPERTY,
    name: 'St. James Place',
    price: 180,
    rent: 20,
    group: 'orange',
    color: 'from-orange-400 to-orange-700',
    ...g(5, 1),
  },
  { id: 17, type: CELL_TYPES.COMMUNITY, name: 'Community Chest', ...g(4, 1) },
  {
    id: 18,
    type: CELL_TYPES.PROPERTY,
    name: 'Tennessee Ave',
    price: 180,
    rent: 20,
    group: 'orange',
    color: 'from-orange-400 to-orange-700',
    ...g(3, 1),
  },
  {
    id: 19,
    type: CELL_TYPES.PROPERTY,
    name: 'New York Ave',
    price: 200,
    rent: 22,
    group: 'orange',
    color: 'from-orange-400 to-orange-700',
    ...g(2, 1),
  },
  { id: 20, type: CELL_TYPES.PARKING, name: 'Free Parking', ...g(1, 1) },
  {
    id: 21,
    type: CELL_TYPES.PROPERTY,
    name: 'Kentucky Ave',
    price: 220,
    rent: 24,
    group: 'red',
    color: 'from-red-500 to-red-800',
    ...g(1, 2),
  },
  { id: 22, type: CELL_TYPES.CHANCE, name: 'Chance', ...g(1, 3) },
  {
    id: 23,
    type: CELL_TYPES.PROPERTY,
    name: 'Indiana Ave',
    price: 220,
    rent: 24,
    group: 'red',
    color: 'from-red-500 to-red-800',
    ...g(1, 4),
  },
  {
    id: 24,
    type: CELL_TYPES.PROPERTY,
    name: 'Illinois Ave',
    price: 240,
    rent: 26,
    group: 'red',
    color: 'from-red-500 to-red-800',
    ...g(1, 5),
  },
  {
    id: 25,
    type: CELL_TYPES.RAILROAD,
    name: 'B. & O. Railroad',
    price: 200,
    ...g(1, 6),
  },
  {
    id: 26,
    type: CELL_TYPES.PROPERTY,
    name: 'Atlantic Ave',
    price: 260,
    rent: 28,
    group: 'yellow',
    color: 'from-yellow-300 to-amber-600',
    ...g(1, 7),
  },
  {
    id: 27,
    type: CELL_TYPES.PROPERTY,
    name: 'Ventnor Ave',
    price: 260,
    rent: 28,
    group: 'yellow',
    color: 'from-yellow-300 to-amber-600',
    ...g(1, 8),
  },
  {
    id: 28,
    type: CELL_TYPES.UTILITY,
    name: 'Water Works',
    price: 150,
    ...g(1, 9),
  },
  {
    id: 29,
    type: CELL_TYPES.PROPERTY,
    name: 'Marvin Gardens',
    price: 280,
    rent: 30,
    group: 'yellow',
    color: 'from-yellow-300 to-amber-600',
    ...g(1, 10),
  },
  { id: 30, type: CELL_TYPES.GO_TO_JAIL, name: 'Go To Jail', ...g(1, 11) },
  {
    id: 31,
    type: CELL_TYPES.PROPERTY,
    name: 'Pacific Ave',
    price: 300,
    rent: 32,
    group: 'green',
    color: 'from-emerald-500 to-emerald-800',
    ...g(2, 11),
  },
  {
    id: 32,
    type: CELL_TYPES.PROPERTY,
    name: 'N. Carolina Ave',
    price: 300,
    rent: 32,
    group: 'green',
    color: 'from-emerald-500 to-emerald-800',
    ...g(3, 11),
  },
  { id: 33, type: CELL_TYPES.COMMUNITY, name: 'Community Chest', ...g(4, 11) },
  {
    id: 34,
    type: CELL_TYPES.PROPERTY,
    name: 'Pennsylvania Ave',
    price: 320,
    rent: 34,
    group: 'green',
    color: 'from-emerald-500 to-emerald-800',
    ...g(5, 11),
  },
  {
    id: 35,
    type: CELL_TYPES.RAILROAD,
    name: 'Short Line',
    price: 200,
    ...g(6, 11),
  },
  { id: 36, type: CELL_TYPES.CHANCE, name: 'Chance', ...g(7, 11) },
  {
    id: 37,
    type: CELL_TYPES.PROPERTY,
    name: 'Park Place',
    price: 350,
    rent: 40,
    group: 'navy',
    color: 'from-indigo-600 to-violet-900',
    ...g(8, 11),
  },
  { id: 38, type: CELL_TYPES.TAX, name: 'Luxury Tax', taxAmount: 75, ...g(9, 11) },
  {
    id: 39,
    type: CELL_TYPES.PROPERTY,
    name: 'Boardwalk',
    price: 400,
    rent: 50,
    group: 'navy',
    color: 'from-indigo-600 to-violet-900',
    ...g(10, 11),
  },
];

export const GO_REWARD_XLM = 200;

/** @param {number} cellId */
export function getCell(cellId) {
  return BOARD[((cellId % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE];
}

/** Railroad rent by number of railroads owned (1–4). */
export const RAILROAD_RENTS = [0, 20, 40, 80, 160];
