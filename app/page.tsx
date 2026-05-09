export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-6 py-24">
      <p className="text-xs uppercase tracking-[0.2em] text-ink-soft">
        Wonderland Playhouse · Brooklyn
      </p>
      <h1 className="font-serif text-5xl leading-tight text-ink sm:text-6xl">
        A soft place to land for kids 0&ndash;7.
      </h1>
      <p className="max-w-xl text-lg leading-relaxed text-ink/80">
        4,000 square feet of imaginative play, birthday parties, and open play
        on Nostrand Ave. The new site is being put together now &mdash; come
        back soon.
      </p>
      <div className="flex flex-wrap gap-3 pt-2">
        <a
          href="mailto:info@wonderlandplayhouse.com"
          className="rounded-xl bg-terracotta px-5 py-3 text-sm font-medium text-cream transition hover:bg-terracotta-600"
        >
          Email us
        </a>
        <a
          href="tel:+17188891777"
          className="rounded-xl border border-ink/15 px-5 py-3 text-sm font-medium text-ink transition hover:border-ink/40"
        >
          (718) 889&#8209;1777
        </a>
      </div>
      <p className="pt-12 text-sm text-ink-soft">
        3830 Nostrand Ave, Brooklyn, NY 11235
      </p>
    </main>
  );
}
