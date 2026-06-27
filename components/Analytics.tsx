import Script from 'next/script';

// Google Analytics 4 — loads only when the client's own measurement ID is set
// (NEXT_PUBLIC_GA_MEASUREMENT_ID, e.g. "G-XXXXXXXXXX"). No ID → renders nothing,
// so dev/preview stay clean and nothing ships to a stranger's property.
export function Analytics() {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!id) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${id}');
        `}
      </Script>
    </>
  );
}
