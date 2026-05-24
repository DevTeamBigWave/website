// Wonderland Playhouse waiver — single source of truth for the legal text.
//
// Versioning: bump WAIVER_VERSION whenever the substance of any clause changes.
// Existing waivers on prior versions remain valid until their expires_at, but
// /waiver will force re-sign for anyone hitting a new version.

export const WAIVER_VERSION = 'v1-2026-05';
export const WAIVER_VALIDITY_DAYS = 365;

export type WaiverSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export const WAIVER_TITLE = 'Acknowledgment and Release';

export const WAIVER_INTRO =
  'I hereby acknowledge and agree to the terms and conditions of this liability waiver as a condition of participating in the activities and using the facilities provided by Wonderland Playhouse, LLC located at 3830 Nostrand Avenue, Brooklyn, NY 11235 (hereinafter referred to as "the Playhouse").';

export const WAIVER_SECTIONS: WaiverSection[] = [
  {
    heading: 'Assumption of Risk',
    paragraphs: [
      'I understand that participation in physical activities at Wonderland Playhouse LLC involves inherent risks, including but not limited to falls, collisions, and other accidents. I voluntarily assume all risks associated with participation.',
    ],
  },
  {
    heading: 'Supervision Requirement',
    paragraphs: [
      'I acknowledge that I must accompany and supervise my child(ren) at all times while at the Playhouse. I understand that the Playhouse does not provide child supervision and is not responsible for the care, custody, or control of my child(ren).',
    ],
  },
  {
    heading: 'Release of Liability',
    paragraphs: [
      'I hereby waive, release, and discharge Wonderland Playhouse LLC, its owners, employees, agents, and affiliates from any and all liability, claims, demands, or causes of action that may arise from any injury, illness, accident, or loss sustained by myself or my child(ren) while at the facility.',
    ],
  },
  {
    heading: 'Property Loss',
    paragraphs: [
      'I understand that Wonderland Playhouse LLC is not responsible for any lost, damaged, or stolen personal property brought onto the premises.',
    ],
  },
  {
    heading: 'Rules and Conduct',
    paragraphs: [
      'I agree to comply, and ensure my child(ren) comply, with all facility rules, including but not limited to:',
    ],
    bullets: [
      'Socks must be worn in all play areas by both children and adults.',
      'No food or drinks are allowed in the play zones.',
      'No roughhousing, unsafe behavior, or disrespect toward staff or other guests.',
      'If any child presents as visibly ill or exhibits symptoms that could pose a risk to others (e.g., fever, persistent cough, vomiting, rash, etc.), Wonderland Playhouse LLC reserves the right to kindly ask that child and their guardian to leave in the interest of protecting the health of all guests.',
    ],
  },
  {
    heading: 'Medical Emergencies',
    paragraphs: [
      'In the event of an emergency, I authorize the staff of Wonderland Playhouse LLC to obtain medical treatment for my child(ren) if I am not present or immediately available. I understand that I am responsible for any medical expenses incurred.',
    ],
  },
  {
    heading: 'Food-Related Disclaimer',
    paragraphs: [
      'I understand and agree that Wonderland Playhouse LLC is not responsible for any food-related issues, including but not limited to food allergies, allergic reactions, or sensitivities. It is the sole responsibility of the parent or guardian to monitor and manage their child’s dietary needs and to ensure any food brought or consumed is safe for them. I agree to hold the Playhouse harmless and release the Playhouse for any claims or damages that may arise as the result of the consumption of the said foods and beverages at the Playhouse.',
    ],
  },
  {
    heading: 'Photography and Social Media',
    paragraphs: [
      'I consent to the use of any photographs, videos, or recordings taken of me and my child(ren) during our visit to the Venue. I understand that Wonderland Playhouse LLC may use these images for promotional purposes on social media or in other marketing materials without any further consent or compensation.',
    ],
  },
  {
    heading: 'Use of Email Address',
    paragraphs: [
      'I authorize Wonderland Playhouse LLC to use my email address to send future promotional materials, special offers, and relevant information about the Venue. I understand that I may opt out from receiving such communications at any time.',
    ],
  },
  {
    heading: 'Payment, Cancellation & Refund Policy',
    paragraphs: ['Open Play Sessions'],
    bullets: [
      'Open play sessions are two (2) hours in duration and are priced at $25 plus applicable tax per child.',
      'Once payment has been made and this waiver is signed by a parent or legal guardian, open play admissions are non-cancelable and non-refundable once the child has entered the premises or play area, for any reason.',
      'All open play payments must be completed in person. Wonderland Playhouse does not accept phone or online payments for open play admissions.',
    ],
  },
  {
    heading: 'Private Parties',
    paragraphs: [],
    bullets: [
      'A non-refundable deposit is required to secure all private party reservations.',
      'All deposits are non-refundable in the event of cancellation, regardless of reason, including but not limited to illness, weather, or personal scheduling conflicts.',
    ],
  },
  {
    heading: 'Refund Exceptions',
    paragraphs: [],
    bullets: [
      'In the event of unique or unforeseen circumstances, refund requests must be communicated to staff prior to or during the visit.',
      'Any refunds or credits are issued solely at the discretion of Wonderland Playhouse management and are not guaranteed.',
    ],
  },
  {
    heading: 'Credit Card Authorization',
    paragraphs: [
      'By paying with a credit card and signing this waiver, the parent or legal guardian authorizes Wonderland Playhouse to charge the credit card on file for all fees incurred under this agreement, including but not limited to open play admissions, party deposits, remaining balances, add-ons, applicable taxes, and any approved recurring charges.',
      'The cardholder acknowledges that all charges are final and subject to the Payment, Cancellation & Refund Policy outlined above.',
      'In the event of a credit card chargeback or payment dispute, Wonderland Playhouse reserves the right to formally contest the chargeback. Proof of this signed agreement, transaction records, attendance logs, time-stamped records, and video surveillance footage may be submitted to the bank or payment processor as evidence to support the validity of the charge.',
      'Repeated, fraudulent, or bad-faith chargebacks may result in the suspension or permanent loss of admission or booking privileges at Wonderland Playhouse.',
    ],
  },
  {
    heading: 'Consent and Signature',
    paragraphs: [
      'I certify that I am the parent or legal guardian of the child(ren) listed above. I have read and understood this Waiver and Release of Liability. I voluntarily agree to its terms.',
    ],
  },
];
