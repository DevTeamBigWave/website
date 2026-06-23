import { supabaseAdmin } from '@/lib/supabase';

// Structured content blocks. Add a new variant here AND in BlogContent.tsx.
export type BlogBlock =
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'quote'; text: string; cite?: string }
  | { type: 'cta'; heading: string; body: string; href: string; label: string };

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: BlogBlock[];
  primary_keyword: string | null;
  keywords: string[];
  hero_emoji: string;
  status: 'draft' | 'published' | 'archived';
  published_at: string | null;
  generated_by: string;
  model: string | null;
  created_at: string;
  updated_at: string;
};

// SEO topic catalogue — the generator picks from here, avoiding anything
// covered by a post in the last 60 days. Edit freely; new topics appear
// in the rotation immediately.
//
// Each entry: { keyword: primary SEO phrase, brief: what angle to take }
export const BLOG_TOPIC_CATALOGUE: Array<{ keyword: string; brief: string }> = [
  // Core SEO targets
  { keyword: 'kids birthday party Brooklyn', brief: 'why Brooklyn parents are moving away from chaotic warehouse-style party venues toward intimate, decor-forward spaces. Mention low-stim, 0-8 age range, custom decor.' },
  { keyword: 'birthday play space Brooklyn', brief: 'what to look for in a birthday play space: floor plan, sensory load, host quality, included add-ons. Position Wonderland as the calm-but-magical option.' },
  { keyword: 'sensory-friendly birthday party', brief: 'practical guide to throwing a sensory-friendly birthday — lighting, noise, crowd size, food. Helpful even for kids without diagnoses; many kids do better with less stimulation.' },
  { keyword: 'toddler birthday party ideas Brooklyn', brief: 'how toddler parties differ from older-kid parties: shorter window, fewer guests, more parent involvement, why the venue matters more than the entertainment.' },
  { keyword: 'first birthday party venue Brooklyn', brief: 'why first birthdays are really for the parents and grandparents — and how to choose a venue that handles that crowd while still being safe for crawlers.' },
  { keyword: 'second birthday party ideas', brief: 'what works at age 2 that doesn\'t work at age 4 (and vice versa). Theme suggestions that aren\'t cliché.' },
  { keyword: 'third birthday party ideas', brief: 'age 3 is the sweet spot — parallel play tipping into real play. Activity suggestions and a timeline for a 2-hour window.' },
  { keyword: 'fourth birthday party ideas', brief: 'social birthdays start at 4. Tips on guest list management, party games that work for the age, and avoiding meltdowns.' },
  { keyword: 'fifth birthday party planning', brief: '5 is when kids really start understanding "MY birthday." How to make them feel celebrated without overspending.' },
  { keyword: 'indoor birthday party NYC', brief: 'NYC apartment realities — why indoor venues beat home parties for families with small apartments and many guests.' },
  { keyword: 'magical birthday party theme', brief: 'how decor sets the magic, not character licensing. Practical theme ideas: enchanted garden, candy land, ice cream parlor, woodland animals.' },
  { keyword: 'birthday party with custom cake', brief: 'why custom dessert tables outperform store-bought sheet cakes for both the photos AND the kids actually eating it. What to ask a custom baker.' },
  { keyword: 'birthday party planning checklist', brief: 'realistic 8-week countdown for a kid birthday party. Honest about what matters and what doesn\'t.' },
  { keyword: 'private vs semi-private birthday party', brief: 'when does the upgrade to private make sense? Calculate it by guest count, kid temperament, photo expectations.' },
  { keyword: 'birthday party 10 kids Brooklyn', brief: 'what a 10-kid birthday actually looks like — pacing, food, party host\'s role, when to call it.' },
  { keyword: 'birthday party 15 kids Brooklyn', brief: 'scaling up to 15 — what changes from a small party, why a dedicated host becomes non-negotiable.' },
  { keyword: 'birthday party 20 kids Brooklyn', brief: 'bigger guest list considerations — flow, headcount math, why exclusive venue use stops feeling optional.' },
  { keyword: 'birthday party food for kids', brief: 'what kids actually eat at parties vs what parents over-order. The 3 things that always go.' },
  { keyword: 'low-stim birthday party for autistic kids', brief: 'thoughtful guide for parents of neurodivergent kids — what makes a venue work, questions to ask, why "quiet hour" parties exist.' },
  { keyword: 'birthday party entertainment kids 0-8', brief: 'survey of entertainment options — bubble shows, face painting, magicians, character visits. Which work at which ages.' },
  { keyword: 'birthday party Brooklyn Sheepshead Bay', brief: 'neighborhood-specific — why the Sheepshead Bay/Nostrand corridor is becoming a go-to for South Brooklyn families.' },
  { keyword: 'open play space Brooklyn kids', brief: 'what open play is and why it\'s become essential winter survival for Brooklyn parents. Compare drop-in vs membership.' },
  { keyword: 'kids party venue rental Brooklyn', brief: 'price ranges across Brooklyn venues, what\'s typically included vs not, hidden fees to ask about.' },
  { keyword: 'rainy day birthday party backup plan', brief: 'why having an indoor backup matters more than the outdoor original plan. How to lock in a backup without paying twice.' },
  { keyword: 'small birthday party intimate', brief: 'why some families are deliberately shrinking guest lists — quality over quantity in early childhood birthdays.' },

  // BROOKLYN PLAY SPACE — high-priority cluster the owner flagged
  { keyword: 'Brooklyn play space', brief: 'overview of what makes a great Brooklyn play space — what to look for beyond ball pits and slides: cleanliness, sensory load, age-appropriate zones, food rules.' },
  { keyword: 'best indoor play space Brooklyn', brief: 'real comparison framework for indoor play spaces — not a competitor takedown, but the categories that actually matter when picking one.' },
  { keyword: 'South Brooklyn play space for kids', brief: 'why South Brooklyn families (Sheepshead Bay, Marine Park, Mill Basin, Manhattan Beach, Bergen Beach, Brighton) finally have a calm, magical indoor option close to home — no more schlepping to Park Slope or Williamsburg.' },
  { keyword: 'South Brooklyn indoor activities for toddlers', brief: 'what South Brooklyn families do with toddlers when the weather is bad — survey of options and what makes each one worth (or not worth) the trip.' },
  { keyword: 'Sheepshead Bay kids activities', brief: 'neighborhood-focused — kid-friendly things to do in and around Sheepshead Bay, with Wonderland as the indoor centerpiece.' },
  { keyword: 'Marine Park kids activities', brief: 'Marine Park families: where to take little kids when the actual park isn\'t working (cold, rain, attention span). Indoor alternatives within a 10-minute drive.' },
  { keyword: 'Mill Basin family activities kids', brief: 'Mill Basin parents: a short, honest guide to nearby indoor options for kids 0–8.' },
  { keyword: 'Manhattan Beach Brooklyn kids', brief: 'Manhattan Beach (Brooklyn, not California) — what to do with little ones nearby, especially off-season.' },
  { keyword: 'Brighton Beach kids activities', brief: 'Brighton Beach families: nearby indoor play options for the cold months.' },
  { keyword: 'Bergen Beach Brooklyn kids', brief: 'Bergen Beach parents — closest indoor options for toddler/preschool meltdown days.' },
  { keyword: 'indoor playground Brooklyn 0-8', brief: 'what makes an indoor playground actually work for the full 0–8 range vs. only-toddlers or only-bigger-kids spaces.' },
  { keyword: 'Brooklyn winter activities for kids', brief: 'how Brooklyn parents survive February — indoor activities ranked by sanity, cost, and how long they hold attention.' },
  { keyword: 'Brooklyn snow day indoor activities kids', brief: 'snow day playbook — places open during snow, what to pack, when to commit vs. stay home.' },
  { keyword: 'Brooklyn rainy day kids activities', brief: 'rainy-day options across Brooklyn — what\'s actually open during weekday rain, what\'s worth the subway ride.' },
  { keyword: 'Brooklyn family owned play space', brief: 'why family-owned indoor play differs from franchise chains — accountability, decor, consistent staff, fewer corporate rules.' },
  { keyword: 'playdate venue Brooklyn', brief: 'beyond birthdays — using indoor play spaces as playdate hosts. Etiquette, cost-splitting, how to organize.' },
  { keyword: 'best kids birthday party Brooklyn', brief: 'opinion-piece framing — what "best" actually means for kid birthdays, and how to evaluate venues without falling for marketing.' },
  { keyword: 'where to have a 3 year old birthday party Brooklyn', brief: 'long-tail SEO target — practical, opinionated venue-picking guide for parents of 3-year-olds specifically.' },
  { keyword: 'where to have a 4 year old birthday party Brooklyn', brief: 'long-tail — practical guide for the 4-year-old age. Different needs than 3 (more social, longer attention span).' },
  { keyword: 'kids party packages Brooklyn cost', brief: 'plain-English breakdown of what Brooklyn kid party packages typically cost in 2026, what\'s included, where the upsells hide.' },
  { keyword: 'unique birthday party venue Brooklyn', brief: 'why some parents are bored of the standard ball-pit warehouse and what they\'re choosing instead.' },
];

export async function getPublishedPosts(limit = 50): Promise<BlogPost[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from('blog_posts')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as BlogPost[];
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const db = supabaseAdmin();
  const { data } = await db
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();
  return (data as BlogPost | null) ?? null;
}

export async function getAllPostsForAdmin(limit = 100): Promise<BlogPost[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from('blog_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as BlogPost[];
}

// Topics already covered in the last N days — the generator avoids these
// to prevent near-duplicates.
export async function getRecentlyCoveredTopics(days = 60): Promise<{
  titles: string[];
  primaryKeywords: string[];
}> {
  const db = supabaseAdmin();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await db
    .from('blog_posts')
    .select('title, primary_keyword')
    .gte('created_at', since);
  const rows = (data ?? []) as Array<{ title: string; primary_keyword: string | null }>;
  return {
    titles: rows.map((r) => r.title),
    primaryKeywords: rows.map((r) => r.primary_keyword).filter((x): x is string => !!x),
  };
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
