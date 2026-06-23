// ============================================================================
// Themed balance-invoice templates.
//
// Each theme drives the hero band + tagline of the email sent when the owner
// closes out a party. All themes share the same body layout (deposit + add-ons
// + grand total + Stripe pay button) — only the hero changes, plus a few
// thematic accent colors used in the totals box.
//
// Email-safe: no SVG, no external images beyond the existing logo. Theme art
// is rendered with large emoji + CSS gradients so it works in Gmail, Apple
// Mail, Outlook web, etc.
// ============================================================================

export type InvoiceThemeSlug =
  | 'wonderland'
  | 'hot_wheels'
  | 'princess'
  | 'dinosaurs'
  | 'superheroes'
  | 'frozen'
  | 'jungle';

export type InvoiceTheme = {
  slug: InvoiceThemeSlug;
  name: string;
  // For the admin theme picker UI
  blurb: string;
  swatchClass: string; // tailwind class for the preview tile
  // For the email hero
  heroBg: string;
  heroEyebrow: string;
  heroEmoji: string; // rendered large in the hero band
  // Used in the "Balance due" callout box in the email body
  accentBg: string;
  accentText: string;
  // Subject-line flavor word, e.g. "Hot Wheels party"
  subjectFlavor: string;
};

export const INVOICE_THEMES: Record<InvoiceThemeSlug, InvoiceTheme> = {
  wonderland: {
    slug: 'wonderland',
    name: 'Wonderland (neutral)',
    blurb: 'Coral + cream — our brand colors. Safe default.',
    swatchClass: 'bg-gradient-to-br from-coral via-coral-300 to-sunshine',
    heroBg: 'linear-gradient(135deg, #ff7783 0%, #fdda26 100%)',
    heroEyebrow: 'Final invoice',
    heroEmoji: '🎉',
    accentBg: '#FFF4F5',
    accentText: '#ff7783',
    subjectFlavor: 'party',
  },
  hot_wheels: {
    slug: 'hot_wheels',
    name: 'Hot Wheels / Cars',
    blurb: 'Race-track blue + orange flames.',
    swatchClass: 'bg-gradient-to-br from-blue-700 via-blue-500 to-orange-500',
    heroBg: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 55%, #f97316 100%)',
    heroEyebrow: 'Ready · set · party',
    heroEmoji: '🏎️🔥',
    accentBg: '#FFF1E6',
    accentText: '#c2410c',
    subjectFlavor: 'Hot Wheels party',
  },
  princess: {
    slug: 'princess',
    name: 'Princess / Unicorn',
    blurb: 'Pink, lavender, sparkles.',
    swatchClass: 'bg-gradient-to-br from-pink-300 via-fuchsia-300 to-purple-300',
    heroBg: 'linear-gradient(135deg, #f9a8d4 0%, #d8b4fe 60%, #a78bfa 100%)',
    heroEyebrow: 'Royal invoice',
    heroEmoji: '👑🦄✨',
    accentBg: '#FDF4FF',
    accentText: '#a21caf',
    subjectFlavor: 'princess party',
  },
  dinosaurs: {
    slug: 'dinosaurs',
    name: 'Dinosaurs',
    blurb: 'Jungle green + earthy amber.',
    swatchClass: 'bg-gradient-to-br from-green-700 via-lime-500 to-amber-600',
    heroBg: 'linear-gradient(135deg, #166534 0%, #65a30d 60%, #b45309 100%)',
    heroEyebrow: 'Roar-some invoice',
    heroEmoji: '🦖🌿',
    accentBg: '#F0FDF4',
    accentText: '#15803d',
    subjectFlavor: 'dino party',
  },
  superheroes: {
    slug: 'superheroes',
    name: 'Superheroes',
    blurb: 'Red, blue, comic-book yellow.',
    swatchClass: 'bg-gradient-to-br from-red-600 via-yellow-400 to-blue-700',
    heroBg: 'linear-gradient(135deg, #dc2626 0%, #facc15 55%, #1d4ed8 100%)',
    heroEyebrow: 'Mission briefing',
    heroEmoji: '🦸‍♀️💥🦸‍♂️',
    accentBg: '#FEF2F2',
    accentText: '#b91c1c',
    subjectFlavor: 'superhero party',
  },
  frozen: {
    slug: 'frozen',
    name: 'Frozen / Ice',
    blurb: 'Ice blue + lavender shimmer.',
    swatchClass: 'bg-gradient-to-br from-sky-200 via-blue-300 to-indigo-400',
    heroBg: 'linear-gradient(135deg, #bae6fd 0%, #93c5fd 50%, #818cf8 100%)',
    heroEyebrow: 'Snowy invoice',
    heroEmoji: '❄️✨⛄',
    accentBg: '#EFF6FF',
    accentText: '#1d4ed8',
    subjectFlavor: 'Frozen party',
  },
  jungle: {
    slug: 'jungle',
    name: 'Jungle / Safari',
    blurb: 'Leafy green + safari tan.',
    swatchClass: 'bg-gradient-to-br from-green-600 via-emerald-500 to-yellow-700',
    heroBg: 'linear-gradient(135deg, #16a34a 0%, #10b981 55%, #a16207 100%)',
    heroEyebrow: 'Wild things',
    heroEmoji: '🦁🌴🐒',
    accentBg: '#F0FDF4',
    accentText: '#15803d',
    subjectFlavor: 'safari party',
  },
};

export const INVOICE_THEME_LIST: InvoiceTheme[] = Object.values(INVOICE_THEMES);

export function getInvoiceTheme(slug: string | null | undefined): InvoiceTheme {
  if (slug && slug in INVOICE_THEMES) {
    return INVOICE_THEMES[slug as InvoiceThemeSlug];
  }
  return INVOICE_THEMES.wonderland;
}
