// Route: /sms-terms

export const metadata = {
  title: "SMS Terms & Conditions — Wonderland Playhouse",
  description:
    "Terms and conditions for the Wonderland Playhouse text messaging program, including opt-out and help instructions.",
};

export default function SmsTermsPage() {
  return (
    <main className="legal">
      <div className="legal__inner">
        <p className="legal__eyebrow">Wonderland Playhouse · Brooklyn</p>
        <h1>SMS Terms &amp; Conditions</h1>
        <p className="legal__meta">Effective date: June 29, 2026</p>

        <p>
          These Terms &amp; Conditions govern the Wonderland Playhouse text
          messaging program (the “Program”). By opting in, you agree to these
          terms.
        </p>

        <h2>Program description</h2>
        <p>
          When you opt in, Wonderland Playhouse will send recurring text
          messages related to your bookings, visits, and membership, including
          booking and party confirmations, reminders, account and membership
          notifications, and occasional promotional offers such as weekday party
          discounts.
        </p>

        <h2>How to opt in</h2>
        <p>
          You can join the Program by checking the SMS consent box on our
          booking or sign-up forms at wonderlandplayhouse.com, by completing an
          in-venue sign-up form, or by texting a keyword to our number where
          offered. Consent is not a condition of any purchase.
        </p>

        <h2>Message frequency</h2>
        <p>
          Message frequency varies based on your bookings and activity. You may
          receive messages tied to your reservations as well as periodic
          promotional messages.
        </p>

        <h2>Cost</h2>
        <p>
          Message and data rates may apply. Wonderland Playhouse does not charge
          for the messages, but your mobile carrier’s standard rates apply.
          Check with your carrier for details about your plan.
        </p>

        <h2>How to opt out</h2>
        <p>
          You can cancel at any time by replying <strong>STOP</strong> to any
          message. After you send STOP, we will send a one-time confirmation and
          will not send further messages unless you opt back in. You may also
          reply UNSUBSCRIBE, CANCEL, END, or QUIT.
        </p>

        <h2>Help</h2>
        <p>
          For help, reply <strong>HELP</strong> to any message, call
          (718) 889-1777, or email info@wonderlandplayhouse.com.
        </p>

        <h2>Carrier liability</h2>
        <p>
          Carriers are not liable for delayed or undelivered messages. Delivery
          of messages is subject to effective transmission by your mobile
          carrier and is not guaranteed.
        </p>

        <h2>Eligibility</h2>
        <p>
          By opting in, you confirm that you are the account holder or
          authorized user of the mobile number provided and that you are at
          least 18 years of age.
        </p>

        <h2>Privacy</h2>
        <p>
          Your privacy matters to us. The mobile information you share to opt in
          is used only to run this Program and is not shared with third parties
          or affiliates for their marketing. For details, see our{" "}
          <a href="/privacy-policy">Privacy Policy</a>.
        </p>

        <h2>Changes</h2>
        <p>
          We may update these Terms from time to time. Continued participation in
          the Program after changes take effect constitutes acceptance of the
          updated Terms.
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
        .legal a {
          color: #b5651d;
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
