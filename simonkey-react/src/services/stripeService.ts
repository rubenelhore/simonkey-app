/**
 * Servicio de Stripe
 * Maneja la integración con Stripe para pagos y suscripciones
 */
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { auth } from './firebase';

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
    const user = auth.currentUser;
    if (!user) {
      throw new Error('Usuario no autenticado');
    }

    const idToken = await user.getIdToken();

    const successUrl = `${window.location.origin}/payment-success`;
    const cancelUrl = `${window.location.origin}/pricing`;

    const response = await fetch('https://createstripecheckoutsession-235501879490.us-central1.run.app', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          priceId,
          successUrl,
          cancelUrl,
        },
        auth: {
          uid: user.uid,
          token: idToken,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

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
    const user = auth.currentUser;
    if (!user) {
      throw new Error('Usuario no autenticado');
    }

    const idToken = await user.getIdToken();
    const returnUrl = `${window.location.origin}/profile`;

    const response = await fetch('https://createstripeportalsession-235501879490.us-central1.run.app', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          returnUrl,
        },
        auth: {
          uid: user.uid,
          token: idToken,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

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
