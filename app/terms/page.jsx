// Route: /terms

export const metadata = {
  title: "Terms of Service · Wonderland Playhouse",
  description:
    "The terms that govern your use of the Wonderland Playhouse website, your bookings, and our text messaging program.",
};

export default function TermsPage() {
  return (
    <main className="legal">
      <div className="legal__inner">
        <h1>Terms of Service</h1>
        <p className="legal__meta">Last updated: June 24, 2026</p>

        <p>
          These Terms of Service (“Terms”) govern your access to and use of the
          Wonderland Playhouse website at wonderlandplayhouse.com (the “Site”) and
          any booking or purchase you make from us. By using the Site, booking a
          visit, or purchasing a membership or gift card, you agree to these
          Terms. If you don’t agree, please don’t use the Site.
        </p>

        <h2>Eligibility</h2>
        <p>
          You must be at least 18 years old to book a party, reserve a visit, or
          make a purchase. Children must be supervised by a parent or guardian at
          all times while in the venue.
        </p>

        <h2>Bookings &amp; pricing</h2>
        <p>
          All prices are in U.S. dollars. We offer private parties, semi-private
          parties, open play, memberships, and gift cards. Our play area is
          designed for children ages 0–8. We make every effort to display accurate
          prices and details, but errors can happen; we reserve the right to
          correct them and to refuse or cancel a booking (including after it’s
          placed), in which case we’ll refund any amount charged.
        </p>

        <h2>Deposits &amp; payment</h2>
        <p>
          A deposit (currently 50% of the party rate) is required to hold your
          date. Payments are processed securely by our third-party payment
          processor. By providing a payment method, you represent that you’re
          authorized to use it and authorize us to charge the order total,
          including any applicable taxes and fees.
        </p>

        <h2>Rescheduling &amp; cancellations</h2>
        <p>
          Plans change — please contact us as soon as possible if you need to
          reschedule or cancel. The applicable deposit, cancellation window, and
          any fees are explained at the time of booking and apply to your
          reservation.
        </p>

        <h2>Health, safety &amp; waiver</h2>
        <p>
          For everyone’s safety, all guests must follow venue rules. Grip socks
          are required in the play area and are available at the door if you
          forget. The play area is for children ages 0–8, who must be supervised
          by an accompanying adult at all times. A signed waiver may be required
          before participating; see our <a href="/waiver">Waiver</a>.
        </p>

        <h2>Memberships &amp; gift cards</h2>
        <p>
          Memberships are subject to the terms presented at sign-up. Gift cards
          are redeemable toward bookings and purchases on the Site, carry no cash
          value except where required by law, and are non-refundable.
        </p>

        <h2>Promotions &amp; discount codes</h2>
        <p>
          Promotional offers, such as weekday private-party discounts, are subject
          to their stated terms, can’t be combined unless we say so, carry no cash
          value, and may be changed or ended at any time.
        </p>

        <h2>Text messaging (SMS)</h2>
        <p>
          By opting in — for example, by checking the SMS consent box on our
          booking or sign-up forms, completing an in-venue form, or texting a
          keyword where offered — you agree to receive recurring text messages
          from Wonderland Playhouse, including booking and party confirmations,
          reminders, account and membership notifications, and occasional offers.
          Consent is not a condition of any purchase. Message frequency varies.
          Message and data rates may apply. Reply STOP to cancel at any time, or
          HELP for help; you can also call (718) 889-1777 or email
          info@wonderlandplayhouse.com. Carriers are not liable for delayed or
          undelivered messages. See our <a href="/privacy">Privacy Policy</a> for
          how we handle your information.
        </p>

        <h2>Intellectual property</h2>
        <p>
          The Site and its content — including the Wonderland Playhouse name, logo,
          text, photography, and designs — are owned by us or our licensors and
          protected by intellectual property laws. You may not copy, reproduce, or
          use them without our prior written permission.
        </p>

        <h2>Acceptable use</h2>
        <p>
          You agree not to misuse the Site — including attempting to disrupt it,
          access it without authorization, scrape it, or use it for any unlawful
          purpose.
        </p>

        <h2>Disclaimers &amp; limitation of liability</h2>
        <p>
          The Site and our services are provided “as is” to the fullest extent
          permitted by law. To the maximum extent permitted by law, Wonderland
          Playhouse will not be liable for indirect, incidental, or consequential
          damages, and our total liability for any claim relating to a booking
          will not exceed the amount you paid for that booking. Nothing in these
          Terms limits any liability that can’t be limited under applicable law.
        </p>

        <h2>Governing law</h2>
        <p>
          These Terms are governed by the laws of the State of New York, without
          regard to its conflict-of-laws rules. Any dispute will be resolved in
          the state or federal courts located in New York.
        </p>

        <h2>Changes</h2>
        <p>
          We may update these Terms from time to time. Changes take effect when
          posted, and the “Last updated” date above will reflect the latest
          version.
        </p>

        <h2>Contact</h2>
        <p>
          Wonderland Playhouse
          <br />
          3830 Nostrand Ave, Brooklyn, NY 11235
          <br />
          Phone: (718) 889-1777
          <br />
          Email: info@wonderlandplayhouse.com
        </p>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .legal {
          background: var(--brand-bg);
          color: var(--brand-fg);
          padding: 64px 20px 96px;
        }
        .legal__inner {
          max-width: 720px;
          margin: 0 auto;
          font-family: var(--font-sans), Nunito, system-ui, sans-serif;
          font-size: 1.0625rem;
          line-height: 1.7;
        }
        .legal h1 {
          font-family: var(--font-display), Fredoka, system-ui, sans-serif;
          font-size: 2.25rem;
          line-height: 1.15;
          margin: 0 0 8px;
          font-weight: 700;
          letter-spacing: -0.01em;
        }
        .legal__meta {
          color: var(--brand-muted);
          font-size: 0.9rem;
          margin: 0 0 36px;
        }
        .legal h2 {
          font-family: var(--font-display), Fredoka, system-ui, sans-serif;
          font-size: 1.3rem;
          margin: 40px 0 12px;
          font-weight: 600;
        }
        .legal p {
          margin: 0 0 16px;
        }
        .legal a {
          color: var(--brand-accent);
          text-decoration: underline;
        }
        .legal strong {
          font-weight: 700;
        }
      `,
        }}
      />
    </main>
  );
}
