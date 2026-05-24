import Link from 'next/link';
import type { BlogBlock } from '@/lib/blog';

export function BlogContent({ blocks }: { blocks: BlogBlock[] }) {
  return (
    <div className="space-y-6">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'h2':
            return (
              <h2 key={i} className="mt-8 font-display text-3xl text-slate-700 sm:text-4xl">
                {block.text}
              </h2>
            );
          case 'h3':
            return (
              <h3 key={i} className="mt-6 font-display text-2xl text-slate-700">
                {block.text}
              </h3>
            );
          case 'p':
            return (
              <p key={i} className="text-base leading-relaxed text-slate-600 sm:text-lg">
                {block.text}
              </p>
            );
          case 'ul':
            return (
              <ul key={i} className="ml-5 list-disc space-y-2 text-slate-600">
                {block.items.map((item, j) => (
                  <li key={j} className="leading-relaxed">{item}</li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={i} className="ml-5 list-decimal space-y-2 text-slate-600">
                {block.items.map((item, j) => (
                  <li key={j} className="leading-relaxed">{item}</li>
                ))}
              </ol>
            );
          case 'quote':
            return (
              <blockquote
                key={i}
                className="border-l-4 border-coral bg-coral-50 px-5 py-4 text-slate-700"
              >
                <p className="text-base italic leading-relaxed sm:text-lg">"{block.text}"</p>
                {block.cite && (
                  <footer className="mt-2 text-xs font-bold uppercase tracking-wider text-coral-700">
                    — {block.cite}
                  </footer>
                )}
              </blockquote>
            );
          case 'cta':
            return (
              <div
                key={i}
                className="my-8 rounded-3xl bg-slate-700 p-7 text-white shadow-card sm:p-9"
              >
                <h3 className="font-display text-2xl sm:text-3xl">{block.heading}</h3>
                <p className="mt-2 text-white/85">{block.body}</p>
                <Link
                  href={block.href}
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-coral px-6 py-3 text-sm font-bold text-white shadow-playful transition hover:bg-coral-600"
                >
                  {block.label} →
                </Link>
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
