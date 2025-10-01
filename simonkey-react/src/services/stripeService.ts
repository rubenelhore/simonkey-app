// src/services/stripeService.ts
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

// Inicializar Stripe (usa la clave pública de Stripe)
let stripePromise: Promise<Stripe | null>;

export const getStripe = () => {
  if (!stripePromise) {
    const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      console.error('VITE_STRIPE_PUBLISHABLE_KEY no está configurada');
      return null;
    }
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
};

/**
 * Precios de Stripe (IDs de los productos/precios creados en Stripe Dashboard)
 * IMPORTANTE: Debes crear estos precios en tu Dashboard de Stripe y reemplazar estos IDs
 */
export const STRIPE_PRICES = {
  SUPER_SIMONKEY_MONTHLY: import.meta.env.VITE_STRIPE_PRICE_SUPER_SIMONKEY_MONTHLY || 'price_xxx_monthly',
  SUPER_SIMONKEY_YEARLY: import.meta.env.VITE_STRIPE_PRICE_SUPER_SIMONKEY_YEARLY || 'price_xxx_yearly',
};

/**
 * Crear una sesión de checkout de Stripe
 */
export const createCheckoutSession = async (priceId: string): Promise<{ url: string }> => {
  try {
    const createCheckout = httpsCallable(functions, 'createStripeCheckoutSession');

    const successUrl = `${window.location.origin}/payment-success`;
    const cancelUrl = `${window.location.origin}/pricing`;

    const result = await createCheckout({
      priceId,
      successUrl,
      cancelUrl,
    });

    const data = result.data as { sessionId: string; url: string };

    return { url: data.url };
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw new Error('No se pudo crear la sesión de pago. Por favor, intenta de nuevo.');
  }
};

/**
 * Redirigir a Stripe Checkout
 */
export const redirectToCheckout = async (priceId: string): Promise<void> => {
  try {
    const { url } = await createCheckoutSession(priceId);

    // Redirigir a la página de checkout de Stripe
    window.location.href = url;
  } catch (error) {
    console.error('Error redirecting to checkout:', error);
    throw error;
  }
};

/**
 * Crear una sesión del portal del cliente de Stripe
 * Permite al usuario gestionar su suscripción (cancelar, actualizar método de pago, etc.)
 */
export const createPortalSession = async (): Promise<{ url: string }> => {
  try {
    const createPortal = httpsCallable(functions, 'createStripePortalSession');

    const returnUrl = `${window.location.origin}/profile`;

    const result = await createPortal({ returnUrl });
    const data = result.data as { url: string };

    return { url: data.url };
  } catch (error) {
    console.error('Error creating portal session:', error);
    throw new Error('No se pudo acceder al portal de suscripción. Por favor, intenta de nuevo.');
  }
};

/**
 * Redirigir al portal del cliente de Stripe
 */
export const redirectToCustomerPortal = async (): Promise<void> => {
  try {
    const { url } = await createPortalSession();
    window.location.href = url;
  } catch (error) {
    console.error('Error redirecting to portal:', error);
    throw error;
  }
};
