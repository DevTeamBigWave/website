import { notFound } from 'next/navigation';
import { FUNNELS, getFunnel } from '@/lib/funnels';
import { FunnelClient } from './FunnelClient';

// Distraction-light funnel landing pages at /go/<slug>. Indexable like the rest
// of the site (no hardcoded noindex). Built from lib/funnels.ts config.

export function generateStaticParams() {
  return Object.keys(FUNNELS).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const funnel = getFunnel(slug);
  if (!funnel) return { title: 'Not found' };
  return {
    title: funnel.title,
    description: funnel.subtitle,
    alternates: { canonical: `/go/${funnel.slug}` },
  };
}

export default async function FunnelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const funnel = getFunnel(slug);
  if (!funnel) notFound();

  return (
    <main className="min-h-screen bg-gradient-to-b from-cream to-sky-50">
      <FunnelClient funnel={funnel} />
    </main>
  );
}
