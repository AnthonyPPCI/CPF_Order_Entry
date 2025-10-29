import { loadStripe } from '@stripe/stripe-js';

// Single Stripe promise instance shared across the application
const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
export const stripePromise = stripePublicKey ? loadStripe(stripePublicKey) : null;
