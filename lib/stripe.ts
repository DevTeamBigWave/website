import Stripe from 'stripe';

let _stripe: Stripe | null = null;

// Lazy: avoids throwing at module-load time during `next build` page-data collection
// when STRIPE_SECRET_KEY isn't present in the build environment.
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    if (!_stripe) {
      _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2025-02-24.acacia',
        typescript: true,
      });
    }
    return Reflect.get(_stripe, prop, receiver);
  },
});
