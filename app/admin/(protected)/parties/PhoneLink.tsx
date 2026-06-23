'use client';

// Phone link rendered inside each party card on the parties list. Lives
// in its own client file because the parent card is a `<Link>` to the
// party detail page — without stopPropagation, tapping the phone number
// would navigate into the party instead of launching the dialer.

export function PhoneLink({ phone }: { phone: string }) {
  const digits = phone.replace(/\D/g, '');
  const d = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  const display =
    d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : phone;
  return (
    <a
      href={`tel:${phone.replace(/[^\d+]/g, '')}`}
      onClick={(e) => e.stopPropagation()}
      className="hover:underline"
    >
      📞 {display}
    </a>
  );
}
