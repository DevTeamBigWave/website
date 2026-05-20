import Image from 'next/image';

type Props = {
  src?: string;
  alt: string;
  className?: string;
  tone?: 'coral' | 'sky' | 'sunshine' | 'mixed';
  rounded?: string;
};

/**
 * Renders a real photo if `src` is provided, otherwise a styled gradient
 * placeholder using brand colors so layouts don't look like broken images.
 * Swap-in: drop a real photo at the path and pass it as `src`.
 */
export function PhotoPlaceholder({
  src,
  alt,
  className = '',
  tone = 'mixed',
  rounded = 'rounded-3xl',
}: Props) {
  if (src) {
    return (
      <div className={`relative overflow-hidden ${rounded} ${className}`}>
        <Image src={src} alt={alt} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
      </div>
    );
  }

  const gradients: Record<NonNullable<Props['tone']>, string> = {
    coral: 'from-coral-200 via-coral-100 to-sunshine-100',
    sky: 'from-sky-200 via-sky-100 to-cream',
    sunshine: 'from-sunshine-200 via-sunshine-100 to-coral-100',
    mixed: 'from-coral-100 via-sunshine-100 to-sky-200',
  };

  return (
    <div
      className={`relative overflow-hidden ${rounded} bg-gradient-to-br ${gradients[tone]} ${className}`}
      aria-label={alt}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="font-display text-xs uppercase tracking-[0.3em] text-slate-400">
          Photo coming soon
        </div>
      </div>
    </div>
  );
}
