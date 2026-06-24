// Route: /privacy-policy
// Replace [EFFECTIVE DATE] and [LEGAL ENTITY NAME] before publishing.

export const metadata = {
  title: "Privacy Policy — Wonderland Playhouse",
  description:
    "How Wonderland Playhouse collects, uses, and protects your information, including mobile messaging consent.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="legal">
      <div className="legal__inner">
        <p className="legal__eyebrow">Wonderland Playhouse · Brooklyn</p>
        <h1>Privacy Policy</h1>
        <p className="legal__meta">Effective date: [EFFECTIVE DATE]</p>

        <p>
          This Privacy Policy explains how [LEGAL ENTITY NAME], doing business as
          Wonderland Playhouse (“Wonderland Playhouse,” “we,” “us,” or “our”),
          collects, uses, and shares information when you visit
          wonderlandplayhouse.com, book a party or visit, purchase a membership
          or gift card, or otherwise interact with us. By using our services,
          you agree to the practices described here.
        </p>

        <h2>Information we collect</h2>
        <ul>
          <li>
            <strong>Contact and booking details</strong> you provide — name,
            email address, mobile phone number, and information about your
            reservation, party, or membership.
          </li>
          <li>
            <strong>Children’s information you provide as a parent or guardian</strong>
            {" "}— such as a birthday child’s first name, age, or guest count,
            given to us so we can host your event. We collect this from the
            adult booking the event, not from children directly.
          </li>
          <li>
            <strong>Payment information</strong>, which is processed by our
            third-party payment processor. We do not store full card numbers on
            our systems.
          </li>
          <li>
            <strong>Usage and device information</strong> collected
            automatically when you visit our site, such as IP address, browser
            type, and pages viewed, through cookies and similar technologies.
          </li>
        </ul>

        <h2>How we use your information</h2>
        <ul>
          <li>To process bookings, memberships, gift cards, and payments.</li>
          <li>
            To send transactional messages such as booking confirmations, party
            reminders, and account or membership notifications.
          </li>
          <li>
            To send promotional messages, such as weekday party offers, where
            you have consented to receive them.
          </li>
          <li>To respond to inquiries and provide customer support.</li>
          <li>To operate, maintain, and improve our website and services.</li>
          <li>To comply with legal obligations and enforce our terms.</li>
        </ul>

        <h2>Mobile messaging (SMS)</h2>
        <p>
          If you opt in to receive text messages from Wonderland Playhouse, the
          mobile phone number you provide and your consent are used only to send
          the messages you signed up for.
        </p>
        <p className="legal__callout">
          No mobile information will be shared with third parties or affiliates
          for marketing or promotional purposes. Information sharing with
          subcontractors who support our services, such as our SMS provider or
          customer-service vendors, is permitted solely to deliver those
          messages. All other use-case categories exclude text-messaging
          originator opt-in data and consent; this information will not be shared
          with any third parties.
        </p>
        <p>
          You can opt out at any time by replying STOP to any message, and reply
          HELP for assistance. Message frequency varies. Message and data rates
          may apply. See our{" "}
          <a href="/sms-terms">SMS Terms &amp; Conditions</a> for details.
        </p>

        <h2>How we share information</h2>
        <p>We share personal information only as described below:</p>
        <ul>
          <li>
            <strong>Service providers</strong> who help us operate, such as our
            booking platform, payment processor, email provider, SMS provider,
            and analytics tools — limited to what they need to perform their
            services.
          </li>
          <li>
            <strong>Legal and safety reasons</strong>, when required by law or to
            protect the rights, safety, or property of our guests, staff, or
            business.
          </li>
          <li>
            <strong>Business transfers</strong>, in connection with a merger,
            acquisition, or sale of assets.
          </li>
        </ul>
        <p>
          We do not sell your personal information, and as stated above we do not
          share mobile opt-in data or consent with third parties for their own
          marketing.
        </p>

        <h2>Children’s privacy</h2>
        <p>
          Wonderland Playhouse serves families with young children, and we take
          children’s privacy seriously. Our website and online services are
          directed to parents and guardians, not to children. We do not knowingly
          collect personal information directly from children under 13. Any
          information about a child is provided to us by a parent or guardian for
          the purpose of arranging a visit or event. If you believe a child has
          provided us personal information without parental consent, please
          contact us at info@wonderlandplayhouse.com and we will delete it.
        </p>

        <h2>Cookies and analytics</h2>
        <p>
          We use cookies and similar technologies to operate our site, remember
          preferences, and understand how the site is used. You can control
          cookies through your browser settings; disabling them may affect some
          features.
        </p>

        <h2>Data retention</h2>
        <p>
          We keep personal information for as long as needed to provide our
          services, comply with our legal obligations, resolve disputes, and
          enforce our agreements.
        </p>

        <h2>Your choices and rights</h2>
        <p>
          You may request access to, correction of, or deletion of your personal
          information, and you may unsubscribe from promotional messages at any
          time. Depending on where you live, you may have additional rights under
          applicable privacy laws. To make a request, contact us using the
          details below.
        </p>

        <h2>Changes to this policy</h2>
        <p>
          We may update this Privacy Policy from time to time. When we do, we
          will revise the effective date above and, where appropriate, provide
          additional notice.
        </p>

        <h2>Contact us</h2>
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
          background: #faf7f2;
          color: #2c2a28;
          padding: 64px 20px 96px;
        }
        .legal__inner {
          max-width: 720px;
          margin: 0 auto;
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI,
            Roboto, Helvetica, Arial, sans-serif;
          font-size: 1.0625rem;
          line-height: 1.7;
        }
        .legal__eyebrow {
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-size: 0.75rem;
          color: #9a8f80;
          margin: 0 0 12px;
        }
        .legal h1 {
          font-size: 2.25rem;
          line-height: 1.15;
          margin: 0 0 8px;
          font-weight: 700;
          letter-spacing: -0.01em;
        }
        .legal__meta {
          color: #8a8276;
          font-size: 0.9rem;
          margin: 0 0 36px;
        }
        .legal h2 {
          font-size: 1.3rem;
          margin: 40px 0 12px;
          font-weight: 700;
        }
        .legal p {
          margin: 0 0 16px;
        }
        .legal ul {
          margin: 0 0 16px;
          padding-left: 1.2em;
        }
        .legal li {
          margin: 0 0 8px;
        }
        .legal a {
          color: #b5651d;
          text-decoration: underline;
        }
        .legal__callout {
          background: #fff;
          border: 1px solid #ece4d7;
          border-left: 3px solid #b5651d;
          border-radius: 8px;
          padding: 16px 18px;
          font-weight: 500;
        }
      `,
        }}
      />
    </main>
  );
}
