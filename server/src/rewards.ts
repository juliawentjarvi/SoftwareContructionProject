/**
 * Reward points are spent on treats, appearance options and themes and are separate from daily energy:
 * starting Sudoku costs energy only, and completing a game earns reward points only.
 */
export const REWARD_PER_SUDOKU_GAME = 10;

export type ItemKind = 'treat' | 'appearance' | 'theme';

export interface CatalogItem {
  id: string;
  kind: ItemKind;
  name: string;
  /** Reward points. Treats can be bought again and again; appearance options and themes are unlocked once. */
  cost: number;
}

export const DEFAULT_THEME = 'meadow';

export const CATALOG: CatalogItem[] = [
  { id: 'honey', kind: 'treat', name: 'Honey', cost: 5 },
  { id: 'berries', kind: 'treat', name: 'Berries', cost: 5 },
  { id: 'cake', kind: 'treat', name: 'Birthday cake', cost: 10 },
  { id: 'bow', kind: 'appearance', name: 'Bow tie', cost: 20 },
  { id: 'party-hat', kind: 'appearance', name: 'Party hat', cost: 30 },
  { id: 'sunglasses', kind: 'appearance', name: 'Sunglasses', cost: 40 },
  { id: 'meadow', kind: 'theme', name: 'Meadow', cost: 0 },
  { id: 'sunset', kind: 'theme', name: 'Sunset', cost: 20 },
  { id: 'night', kind: 'theme', name: 'Starry night', cost: 30 },
  { id: 'berry', kind: 'theme', name: 'Berry patch', cost: 40 },
];

export const findItem = (id: string): CatalogItem | undefined => CATALOG.find((item) => item.id === id);
