// Route: /privacy

export const metadata = {
  title: "Privacy Policy · Wonderland Playhouse",
  description:
    "How Wonderland Playhouse collects, uses, and protects your personal information, including mobile messaging consent.",
};

export default function PrivacyPage() {
  return (
    <main className="legal">
      <div className="legal__inner">
        <h1>Privacy Policy</h1>
        <p className="legal__meta">Last updated: June 24, 2026</p>

        <p>
          This Privacy Policy explains how Wonderland Playhouse (“we,” “us,” or
          “our”) collects, uses, and shares information when you visit
          wonderlandplayhouse.com (the “Site”), book a party or visit, or
          purchase a membership or gift card. By using the Site, you agree to
          this policy.
        </p>

        <h2>Information we collect</h2>
        <ul>
          <li>
            <strong>Information you give us:</strong> your name, email address,
            mobile phone number, and booking details such as your party or
            reservation date, guest count, and a birthday child’s first name and
            age, along with the contents of any message you send us.
          </li>
          <li>
            <strong>Payment information:</strong> payments are processed securely
            by our third-party payment processor. We never see or store your full
            card number — the processor handles it and shares only limited
            details (such as the result of the charge and the last four digits)
            so we can manage your booking.
          </li>
          <li>
            <strong>Information collected automatically:</strong> like most
            websites, we collect device and usage data (IP address, browser type,
            pages viewed, and referring links) through cookies and similar
            technologies.
          </li>
        </ul>

        <h2>How we use your information</h2>
        <ul>
          <li>To process and manage your bookings, visits, memberships, and gift cards.</li>
          <li>To send booking and party confirmations, reminders, and account or membership notifications.</li>
          <li>To send promotional messages, such as weekday party offers, when you’ve opted in. You can unsubscribe at any time.</li>
          <li>To respond to your questions and provide support.</li>
          <li>To operate, secure, and improve the Site and prevent fraud.</li>
        </ul>

        <h2>Text messaging (SMS)</h2>
        <p>
          If you opt in to receive text messages from Wonderland Playhouse, the
          mobile number and consent you provide are used only to send the
          messages you signed up for, such as booking confirmations, reminders,
          and offers.
        </p>
        <p className="legal__callout">
          No mobile information will be shared with third parties or affiliates
          for marketing or promotional purposes. Information sharing with
          subcontractors who support our services, such as our SMS provider, is
          permitted solely to deliver those messages. All other use-case
          categories exclude text-messaging originator opt-in data and consent;
          this information will not be shared with any third parties.
        </p>
        <p>
          You can opt out at any time by replying STOP to any message, and reply
          HELP for help. Message frequency varies. Message and data rates may
          apply. See our <a href="/terms">Terms of Service</a> for full SMS
          program terms.
        </p>

        <h2>Cookies &amp; analytics</h2>
        <p>
          We use cookies and similar technologies to run the Site and to
          understand how it’s used, including analytics tools that help us measure
          traffic and improve the experience. You can adjust or block cookies in
          your browser settings, though some features may not work as well.
        </p>

        <h2>How we share information</h2>
        <p>
          We do not sell your personal information. We share it only with service
          providers who help us run the business — such as our booking platform,
          payment processor, email and SMS providers, and analytics tools —
          limited to what they need to perform their services. We may also
          disclose information if required by law or to protect our rights,
          guests, staff, or the public. As stated above, we do not share mobile
          opt-in data or consent with third parties for their own marketing.
        </p>

        <h2>Your choices &amp; rights</h2>
        <p>
          Depending on where you live, you may have the right to access, correct,
          delete, or receive a copy of your personal information, and to opt out
          of certain sharing. You can unsubscribe from promotional messages at any
          time. To make a request, email us at info@wonderlandplayhouse.com and
          we’ll respond as required by applicable law.
        </p>

        <h2>Data retention &amp; security</h2>
        <p>
          We keep your information for as long as needed to provide our services,
          comply with our legal obligations, resolve disputes, and enforce our
          agreements. We use reasonable technical and organizational measures to
          protect it, though no method of transmission or storage is completely
          secure.
        </p>

        <h2>Children’s privacy</h2>
        <p>
          Wonderland Playhouse welcomes families with young children, and we take
          children’s privacy seriously. Our website and online services are
          directed to parents and guardians, not to children, and we do not
          knowingly collect personal information directly from children under 13.
          Any information about a child is provided to us by a parent or guardian
          to arrange a visit or event. If you believe a child has provided us
          personal information without parental consent, email
          info@wonderlandplayhouse.com and we will delete it.
        </p>

        <h2>Changes to this policy</h2>
        <p>
          We may update this policy from time to time. When we do, we’ll revise
          the “Last updated” date above, and material changes will be made clear
          on this page.
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
        <p>
          See also our <a href="/terms">Terms of Service</a>.
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
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto,
            Helvetica, Arial, sans-serif;
          font-size: 1.0625rem;
          line-height: 1.7;
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
