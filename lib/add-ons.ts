// Catalog of party add-ons surfaced in the admin "add to party" dropdown.
// Mirrors /parties — keep in sync when prices change.
//
// price_cents = 0 means "variable, owner enters at add time" (e.g. custom cake).

export type AddOnCatalogItem = {
  id: string;
  name: string;
  category: 'food' | 'decor' | 'entertainment' | 'extras';
  price_cents: number;
  default_qty?: number;
  hint?: string;
};

export const ADD_ON_CATALOG: AddOnCatalogItem[] = [
  // Food
  { id: 'pizza_pie', name: 'Additional pizza pie', category: 'food', price_cents: 2200 },
  { id: 'french_fries', name: 'French fries', category: 'food', price_cents: 3000 },
  { id: 'chicken_nuggets', name: 'Chicken nuggets', category: 'food', price_cents: 4000 },
  { id: 'themed_cupcakes', name: 'Theme-based cupcakes', category: 'food', price_cents: 600, hint: 'Per cupcake — adjust qty' },
  { id: 'custom_cake', name: 'Custom cake', category: 'food', price_cents: 25000, hint: 'Starting at $250 — adjust price for the actual quote' },

  // Decor
  { id: 'themed_decor', name: 'Balloons & theme-based decor', category: 'decor', price_cents: 55000, hint: 'Starting at $550 — adjust for the actual quote' },
  { id: 'goodie_bags', name: 'Upgraded theme-based goodie bags', category: 'decor', price_cents: 800, hint: 'Each — adjust qty' },

  // Entertainment (45-min activities)
  { id: 'character_meet_greet', name: 'Character meet & greet', category: 'entertainment', price_cents: 15000, hint: '+$100 for mascot — bump price' },
  { id: 'face_painting', name: 'Face painting', category: 'entertainment', price_cents: 20000 },
  { id: 'glitter_tattoos', name: 'Glitter tattoos', category: 'entertainment', price_cents: 10000 },
  { id: 'balloon_twisting', name: 'Balloon twisting', category: 'entertainment', price_cents: 12500 },
  { id: 'dance_games', name: 'Dance party & games', category: 'entertainment', price_cents: 15000 },
  { id: 'pinata', name: 'Candy-filled piñata', category: 'entertainment', price_cents: 10000 },
  { id: 'diy_slime', name: 'DIY slime station', category: 'entertainment', price_cents: 20000 },
  { id: 'diy_bracelet', name: 'DIY bracelet making station', category: 'entertainment', price_cents: 17500 },
  { id: 'glam_spa', name: 'Glam spa day', category: 'entertainment', price_cents: 17500 },
];

export const CATEGORY_LABEL: Record<AddOnCatalogItem['category'], string> = {
  food: 'Food',
  decor: 'Decor',
  entertainment: 'Entertainment',
  extras: 'Extras',
};

export function findCatalogItem(id: string): AddOnCatalogItem | null {
  return ADD_ON_CATALOG.find((i) => i.id === id) ?? null;
}
