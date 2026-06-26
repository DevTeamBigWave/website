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
  // If true, only one row of this item makes sense on a party (kosher upgrade,
  // decor package, custom cake, entertainment activities, etc). The admin
  // editor will hard-disable the checkbox once it's already on the party.
  // Items without singleton can be re-added freely (extra pizza, more cupcakes,
  // additional goodie bags, etc).
  singleton?: boolean;
  // If true, this item is admin-only — hidden from the customer /book flow.
  // Used for items already captured by other form fields (extra_kid by
  // headcount, time_extension by the extension picker).
  customer_hidden?: boolean;
  // If true, no editable price or qty inputs in the UI — just a one-click
  // add. Use for activities where qty/price never vary (face painting,
  // dance party, piñata, etc). Submitted with qty=1 + the catalog price.
  fixed?: boolean;
};

export const ADD_ON_CATALOG: AddOnCatalogItem[] = [
  // Food
  { id: 'kosher_party_upgrade', name: 'Upgrade included pizzas to kosher', category: 'food', price_cents: 4000, hint: '$20 per pie · covers both included pies ($40 total)', singleton: true },
  { id: 'pizza_pie', name: 'Additional regular pizza pie', category: 'food', price_cents: 2500 },
  { id: 'kosher_pizza_pie', name: 'Additional kosher pizza pie', category: 'food', price_cents: 4000 },
  { id: 'french_fries', name: 'French fries', category: 'food', price_cents: 3000 },
  { id: 'chicken_nuggets', name: 'Chicken nuggets', category: 'food', price_cents: 5000 },
  { id: 'themed_cupcakes', name: 'Theme-based cupcakes', category: 'food', price_cents: 600, hint: 'Per cupcake — adjust qty' },
  { id: 'custom_cake', name: 'Custom cake', category: 'food', price_cents: 25000, hint: 'Starting at $250 — adjust price for the actual quote', singleton: true },

  // Decor
  { id: 'themed_decor', name: 'Balloons & theme-based decor', category: 'decor', price_cents: 55000, singleton: true, fixed: true },
  { id: 'goodie_bags', name: 'Upgraded theme-based goodie bags', category: 'decor', price_cents: 800, hint: 'Each — adjust qty' },

  // Entertainment (45-min activities — one of each per party)
  // character_meet_greet keeps editable price for the "+$150 if mascot" bump;
  // every other entertainment item is a flat-price single-click add.
  { id: 'character_meet_greet', name: 'Character meet & greet', category: 'entertainment', price_cents: 15000, hint: '+$150 if mascot — bump price', singleton: true },
  { id: 'face_painting', name: 'Face painting', category: 'entertainment', price_cents: 20000, singleton: true, fixed: true },
  { id: 'glitter_tattoos', name: 'Glitter tattoos', category: 'entertainment', price_cents: 10000, singleton: true, fixed: true },
  { id: 'balloon_twisting', name: 'Balloon twisting', category: 'entertainment', price_cents: 12500, singleton: true, fixed: true },
  { id: 'dance_games', name: 'Dance party & games', category: 'entertainment', price_cents: 20000, singleton: true, fixed: true },
  { id: 'pinata', name: 'Candy-filled piñata', category: 'entertainment', price_cents: 15000, singleton: true, fixed: true },
  { id: 'diy_slime', name: 'DIY slime station', category: 'entertainment', price_cents: 25000, singleton: true, fixed: true },
  { id: 'diy_squishy', name: 'DIY squishy station', category: 'entertainment', price_cents: 30000, singleton: true, fixed: true },
  { id: 'diy_bracelet', name: 'DIY bracelet making station', category: 'entertainment', price_cents: 20000, singleton: true, fixed: true },
  { id: 'glam_spa', name: 'Glam spa day', category: 'entertainment', price_cents: 20000, singleton: true, fixed: true },

  // Extras
  { id: 'outside_food_fee', name: 'Outside food fee', category: 'extras', price_cents: 8500, hint: 'Per the parent bringing in outside catering', singleton: true },
  { id: 'extra_kid', name: 'Extra kid over package', category: 'extras', price_cents: 2500, hint: '$25/kid above the package headcount — adjust qty', customer_hidden: true },
  { id: 'time_extension', name: 'Time extension (30 min)', category: 'extras', price_cents: 15000, hint: 'Adjust qty for additional 30-min blocks', customer_hidden: true },
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
