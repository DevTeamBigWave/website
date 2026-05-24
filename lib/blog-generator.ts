// Blog post generator — calls Claude to produce a fully structured post in
// the Wonderland Playhouse voice, targeting a specific SEO keyword.
//
// Output is structured JSON (block-typed content), not raw HTML, so rendering
// is safe and consistent.

import Anthropic from '@anthropic-ai/sdk';
import {
  BLOG_TOPIC_CATALOGUE,
  getRecentlyCoveredTopics,
  slugify,
  type BlogBlock,
  type BlogPost,
} from '@/lib/blog';
import { supabaseAdmin } from '@/lib/supabase';

const MODEL = 'claude-sonnet-4-6';

const BRAND_VOICE = `
WONDERLAND PLAYHOUSE — brand context for every post:

- We are a magical, low-stim birthday venue and play space in South Brooklyn (3830 Nostrand Ave, near Sheepshead Bay / Marine Park / Manhattan Beach / Brighton / Mill Basin / Bergen Beach).
- For kids 0–8. Under 10 months is free.
- We sell two party packages: Semi-Private ($650, dedicated party room while open play continues elsewhere in the venue) and Private ($1,250, the whole venue closed to the public — this is what we want most parents to pick).
- Mon–Thu private parties are 20% off (limited-time offer).
- Open play: $25/kid, 12pm–7pm daily. Memberships $150/month unlimited (2h/day cap).
- We are NOT a chaotic warehouse with ball pits and arcade games. The decor is custom and intentional. The space is calm. Photos look beautiful, not loud. Sensory-friendly without making a clinical thing of it.
- Tone: warm, honest, parent-to-parent. Slight wit. No corporate marketing-speak. No exclamation marks every sentence. No "magical experiences await!" cliches. Treat the reader like an adult planning something for someone they love.
- Always 0–8 years old. Never "all ages" — that's a different business.
- Custom decor and themed setups are an add-on for parties (not included in semi).
- We coordinate add-ons (cake, entertainment, etc) so parents don't have to juggle vendors.
- Phone: (718) 889-1777. Address: 3830 Nostrand Ave, Brooklyn, NY 11235.
- Booking pages: /parties (overview), /book (party booking), /book/open-play (open play), /tour (free tour), /inquire (book a call), /memberships, /gift-cards.
`;

const SYSTEM_PROMPT = `You are a senior content writer for Wonderland Playhouse, a small family-owned birthday venue and play space in South Brooklyn. You write SEO-optimized blog posts that genuinely help parents — never thin keyword-stuffed filler.

${BRAND_VOICE}

WRITING RULES:
1. Hook in the first paragraph. State a specific, concrete observation a Brooklyn parent would nod at — not a generic "Looking for the perfect birthday party?" opener.
2. Be specific. Mention neighborhoods, ages, real numbers. Avoid words like "amazing," "unforgettable," "magical experience," "perfect," "world-class."
3. Honest assessment > sales pitch. If a $1,250 private party isn't right for someone, say so. Trust earns conversions later.
4. Mention Wonderland naturally, NOT in every paragraph. Reference our specific offerings (private vs semi, low-stim, free tours, etc) where they're genuinely the answer to what the section is about. Aim for 2-4 natural mentions in a 700-1000 word post.
5. Use 2-3 H2 sections + occasional H3. Vary paragraph length. Throw in a short list when it earns its place.
6. End with a CTA block that's relevant to the post's topic — not a generic "book now!" button. E.g. for a tour post, the CTA is to book a free tour. For a birthday post, it's to see party packages.
7. Length: 700-1100 words of actual prose. No fluff to hit a word count.
8. Avoid clichés. No "the perfect birthday awaits." No "creating memories that last a lifetime." No "your one-stop shop."

OUTPUT FORMAT:
You MUST return a single valid JSON object with this exact shape. No markdown code fences. No prose before or after.

{
  "title": "string — 50-70 chars, includes the primary keyword naturally",
  "slug": "kebab-case-slug",
  "excerpt": "string — 140-160 chars meta description, includes primary keyword, ends with no period",
  "primaryKeyword": "string — the keyword from the brief, as-is",
  "keywords": ["string", "string", ...],  // 5-10 related secondary keywords
  "heroEmoji": "single emoji that fits the post (e.g. 🎂 ✨ 🎈 🥳 🌟 🦄 🍰)",
  "blocks": [
    { "type": "p", "text": "..." },
    { "type": "h2", "text": "..." },
    { "type": "p", "text": "..." },
    { "type": "ul", "items": ["...", "..."] },
    { "type": "h2", "text": "..." },
    { "type": "p", "text": "..." },
    { "type": "quote", "text": "...", "cite": "optional citation" },
    { "type": "h3", "text": "..." },
    { "type": "p", "text": "..." },
    { "type": "cta", "heading": "Short line", "body": "1-2 sentences", "href": "/parties OR /tour OR /inquire OR /book OR /book/open-play OR /memberships OR /gift-cards", "label": "Button text" }
  ]
}

Allowed block types: p, h2, h3, ul, ol, quote, cta. ul/ol have "items" (array of strings). Other blocks have "text" (string). cta has heading/body/href/label.

For prose blocks, write the text inline — no HTML, no markdown formatting characters except plain text. The renderer handles paragraphs.

If you want to emphasize a phrase inline, just use it as plain text and let context carry the weight. Don't use **bold** or *italic* syntax.`;

export type GeneratePostInput = {
  keyword: string;
  brief: string;
  recentTitles: string[];
};

export type GeneratedPost = {
  title: string;
  slug: string;
  excerpt: string;
  primaryKeyword: string;
  keywords: string[];
  heroEmoji: string;
  blocks: BlogBlock[];
};

export async function generatePost(input: GeneratePostInput): Promise<GeneratedPost> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const recentList =
    input.recentTitles.length > 0
      ? `\n\nRECENT POSTS WE'VE ALREADY PUBLISHED (do not repeat angles or examples from these):\n${input.recentTitles.map((t) => `- ${t}`).join('\n')}`
      : '';

  const userMessage = `Write a blog post targeting the keyword: "${input.keyword}"

ANGLE / BRIEF: ${input.brief}${recentList}

Return only the JSON object as specified.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  // Extract text response
  const text = response.content
    .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('');

  // Strip any accidental code fences
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  let parsed: GeneratedPost;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Generator returned invalid JSON for "${input.keyword}": ${err instanceof Error ? err.message : 'parse error'}\n\nRaw response:\n${cleaned.slice(0, 500)}`);
  }

  // Light validation
  if (!parsed.title || !parsed.slug || !parsed.blocks || !Array.isArray(parsed.blocks)) {
    throw new Error(`Generator output missing required fields for "${input.keyword}"`);
  }

  // Re-slugify to enforce our format
  parsed.slug = slugify(parsed.slug || parsed.title);

  return parsed;
}

// Pick N topics from the catalogue that haven't been covered in the last 60 days.
// Returns them in a random-ish order to keep the rotation feeling fresh.
export async function pickFreshTopics(count: number): Promise<Array<{ keyword: string; brief: string }>> {
  const { primaryKeywords: recentKeywords, titles: recentTitles } = await getRecentlyCoveredTopics(60);
  const recentSet = new Set(recentKeywords.map((k) => k.toLowerCase()));
  const recentTitleWords = new Set(
    recentTitles.flatMap((t) => t.toLowerCase().split(/\W+/).filter((w) => w.length > 4)),
  );

  const available = BLOG_TOPIC_CATALOGUE.filter((t) => !recentSet.has(t.keyword.toLowerCase()));

  // Score by how "different" each topic is from recent ones — prefer topics
  // whose keywords share fewer significant words with recent titles.
  const scored = available.map((t) => {
    const words = t.keyword.toLowerCase().split(/\W+/).filter((w) => w.length > 4);
    const overlap = words.filter((w) => recentTitleWords.has(w)).length;
    return { topic: t, score: overlap, jitter: Math.random() };
  });
  scored.sort((a, b) => a.score - b.score || a.jitter - b.jitter);

  return scored.slice(0, count).map((s) => s.topic);
}

async function insertWithUniqueSlug(
  base: Omit<BlogPost, 'id' | 'created_at' | 'updated_at' | 'slug'> & { slug: string },
): Promise<BlogPost | null> {
  const db = supabaseAdmin();
  let slug = base.slug;
  for (let attempt = 0; attempt < 6; attempt++) {
    const { data: row, error } = await db
      .from('blog_posts')
      .insert({ ...base, slug })
      .select()
      .single();
    if (!error && row) return row as BlogPost;
    // Unique violation: append/increment suffix and retry
    if (error?.code === '23505') {
      slug = attempt === 0 ? `${base.slug}-2` : `${base.slug}-${attempt + 2}`;
      continue;
    }
    console.error('insertWithUniqueSlug failed:', error);
    return null;
  }
  return null;
}

export type BatchResult = {
  saved: BlogPost[];
  failures: Array<{ keyword: string; error: string }>;
};

// Generate N posts in PARALLEL and persist as 'published'. Returns saved
// posts plus any per-topic failures so the caller can surface them.
export async function generateAndPublishBatch(count: number): Promise<BatchResult> {
  const topics = await pickFreshTopics(count);
  const { titles: recentTitles } = await getRecentlyCoveredTopics(90);

  // Fire all generations in parallel — Anthropic handles concurrency fine
  // at this scale and total wall time stays under 30s instead of 180s.
  const results = await Promise.allSettled(
    topics.map((topic) =>
      generatePost({
        keyword: topic.keyword,
        brief: topic.brief,
        recentTitles,
      }).then(async (post) => {
        const row = await insertWithUniqueSlug({
          slug: post.slug,
          title: post.title,
          excerpt: post.excerpt,
          content: post.blocks,
          primary_keyword: post.primaryKeyword,
          keywords: post.keywords ?? [],
          hero_emoji: post.heroEmoji || '✨',
          status: 'published',
          published_at: new Date().toISOString(),
          generated_by: 'ai',
          model: MODEL,
        });
        if (!row) throw new Error('Database insert returned no row');
        return { row, keyword: topic.keyword };
      }),
    ),
  );

  const saved: BlogPost[] = [];
  const failures: Array<{ keyword: string; error: string }> = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      saved.push(r.value.row);
    } else {
      const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
      failures.push({ keyword: topics[i].keyword, error: msg });
      console.error(`Blog generation failed for "${topics[i].keyword}":`, r.reason);
    }
  });

  return { saved, failures };
}
