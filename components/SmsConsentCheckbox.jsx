// Drop this into your booking / reservation / sign-up form.
// Unchecked by default. Only enroll a number when its value is true.

"use client";

import { useState } from "react";

export default function SmsConsentCheckbox({ onChange }) {
  const [checked, setChecked] = useState(false); // must start unchecked

  function handleChange(e) {
    setChecked(e.target.checked);
    if (onChange) onChange(e.target.checked);
  }

  return (
    <label className="sms-consent">
      <input
        type="checkbox"
        name="smsConsent"
        checked={checked}
        onChange={handleChange}
      />
      <span className="sms-consent__text">
        I agree to receive transactional and promotional text messages from
        Wonderland Playhouse at the number provided (booking confirmations,
        reminders, and offers). Consent is not a condition of purchase. Message
        frequency varies. Msg &amp; data rates may apply. Reply STOP to cancel,
        HELP for help. See our{" "}
        <a href="/privacy-policy" target="_blank" rel="noopener noreferrer">
          Privacy Policy
        </a>{" "}
        and{" "}
        <a href="/sms-terms" target="_blank" rel="noopener noreferrer">
          SMS Terms
        </a>
        .
      </span>

      <style jsx>{`
        .sms-consent {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 0.875rem;
          line-height: 1.5;
          color: #4a463f;
          cursor: pointer;
        }
        .sms-consent input {
          margin-top: 3px;
          width: 16px;
          height: 16px;
          flex-shrink: 0;
          accent-color: #b5651d;
        }
        .sms-consent__text a {
          color: #b5651d;
          text-decoration: underline;
        }
      `}</style>
    </label>
  );
}
