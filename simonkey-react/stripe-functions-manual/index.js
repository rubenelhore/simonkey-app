const functions = require('@google-cloud/functions-framework');
const Stripe = require('stripe');
const admin = require('firebase-admin');

// Inicializar Firebase Admin
admin.initializeApp();

// Función para obtener instancia de Stripe
const getStripe = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY no está configurada');
  }
  return new Stripe(secretKey, {
    apiVersion: '2024-12-18.acacia',
  });
};

// Función 1: Crear sesión de checkout
functions.http('createStripeCheckoutSession', async (req, res) => {
  // Configurar CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    const { data, auth } = req.body;

    if (!auth || !auth.uid) {
      res.status(401).json({ error: 'Usuario no autenticado' });
      return;
    }

    const { priceId, successUrl, cancelUrl } = data;

    if (!priceId || !successUrl || !cancelUrl) {
      res.status(400).json({ error: 'Faltan parámetros requeridos' });
      return;
    }

    const userId = auth.uid;
    const stripe = getStripe();

    // Obtener datos del usuario
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    // Crear sesión de checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: userData.email,
      metadata: {
        userId: userId,
        userEmail: userData.email,
      },
    });

    console.log(`Checkout session created for user ${userId}: ${session.id}`);

    res.status(200).json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Función 2: Webhook de Stripe
functions.http('stripeWebhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    res.status(400).json({ error: 'Missing signature or webhook secret' });
    return;
  }

  try {
    const stripe = getStripe();
    const event = stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      webhookSecret
    );

    console.log(`Stripe webhook event received: ${event.type}`);

    // Manejar diferentes tipos de eventos
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        await handleCheckoutSessionCompleted(session);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        await handleInvoicePaymentSucceeded(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Función 3: Portal del cliente
functions.http('createStripePortalSession', async (req, res) => {
  // Configurar CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    const { data, auth } = req.body;

    if (!auth || !auth.uid) {
      res.status(401).json({ error: 'Usuario no autenticado' });
      return;
    }

    const { returnUrl } = data;

    if (!returnUrl) {
      res.status(400).json({ error: 'returnUrl es requerido' });
      return;
    }

    const userId = auth.uid;
    const stripe = getStripe();

    // Obtener datos del usuario
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData || !userData.stripeCustomerId) {
      res.status(404).json({ error: 'No se encontró información de suscripción' });
      return;
    }

    // Crear sesión del portal
    const session = await stripe.billingPortal.sessions.create({
      customer: userData.stripeCustomerId,
      return_url: returnUrl,
    });

    res.status(200).json({
      url: session.url,
    });
  } catch (error) {
    console.error('Error creating portal session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Funciones auxiliares para webhook
async function handleCheckoutSessionCompleted(session) {
  const userId = session.metadata?.userId;

  if (!userId) {
    console.error('No userId in session metadata');
    return;
  }

  try {
    await admin.firestore().collection('users').doc(userId).update({
      subscription: 'pro',
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
      subscriptionStatus: 'active',
      subscriptionStartDate: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`User ${userId} upgraded to PRO`);
  } catch (error) {
    console.error('Error updating user subscription:', error);
    throw error;
  }
}

async function handleSubscriptionUpdated(subscription) {
  const customerId = subscription.customer;

  try {
    const usersRef = admin.firestore().collection('users');
    const querySnapshot = await usersRef.where('stripeCustomerId', '==', customerId).get();

    if (querySnapshot.empty) {
      console.error(`No user found with stripeCustomerId: ${customerId}`);
      return;
    }

    const userDoc = querySnapshot.docs[0];

    await userDoc.ref.update({
      subscriptionStatus: subscription.status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Subscription updated for customer ${customerId}: ${subscription.status}`);
  } catch (error) {
    console.error('Error updating subscription:', error);
    throw error;
  }
}

async function handleSubscriptionDeleted(subscription) {
  const customerId = subscription.customer;

  try {
    const usersRef = admin.firestore().collection('users');
    const querySnapshot = await usersRef.where('stripeCustomerId', '==', customerId).get();

    if (querySnapshot.empty) {
      console.error(`No user found with stripeCustomerId: ${customerId}`);
      return;
    }

    const userDoc = querySnapshot.docs[0];

    await userDoc.ref.update({
      subscription: 'free',
      subscriptionStatus: 'canceled',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`User downgraded to FREE due to subscription cancellation`);
  } catch (error) {
    console.error('Error handling subscription deletion:', error);
    throw error;
  }
}

async function handleInvoicePaymentSucceeded(invoice) {
  console.log(`Payment succeeded for invoice ${invoice.id}`);
}

async function handleInvoicePaymentFailed(invoice) {
  const customerId = invoice.customer;

  try {
    const usersRef = admin.firestore().collection('users');
    const querySnapshot = await usersRef.where('stripeCustomerId', '==', customerId).get();

    if (querySnapshot.empty) {
      console.error(`No user found with stripeCustomerId: ${customerId}`);
      return;
    }

    const userDoc = querySnapshot.docs[0];

    await userDoc.ref.update({
      subscriptionStatus: 'past_due',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`User subscription marked as past_due due to payment failure`);
  } catch (error) {
    console.error('Error handling payment failure:', error);
    throw error;
  }
}
