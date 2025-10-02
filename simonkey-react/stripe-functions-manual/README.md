# Stripe Functions - Despliegue Manual

Este directorio contiene el código de las funciones de Stripe para despliegue manual en Cloud Run.

## Funciones Incluidas

1. **createStripeCheckoutSession** - Crea sesiones de pago de Stripe
2. **stripeWebhook** - Procesa eventos de webhooks de Stripe
3. **createStripePortalSession** - Crea sesiones del portal de gestión de suscripciones

## Despliegue

Las funciones se desplegaron usando:

```bash
gcloud run deploy [FUNCTION_NAME] \
  --source . \
  --function=[FUNCTION_NAME] \
  --region=us-central1 \
  --allow-unauthenticated \
  --set-env-vars=STRIPE_SECRET_KEY=sk_xxx \
  --memory=256Mi \
  --timeout=60 \
  --max-instances=10 \
  --min-instances=0 \
  --build-service-account=projects/simonkey-5c78f/serviceAccounts/cloud-functions-builder@simonkey-5c78f.iam.gserviceaccount.com \
  --service-account=firebase-functions-sa@simonkey-5c78f.iam.gserviceaccount.com \
  --project=simonkey-5c78f
```

## URLs Desplegadas

- **Checkout**: https://createstripecheckoutsession-235501879490.us-central1.run.app
- **Webhook**: https://stripewebhook-235501879490.us-central1.run.app
- **Portal**: https://createstripeportalsession-235501879490.us-central1.run.app

## Variables de Entorno Requeridas

- `STRIPE_SECRET_KEY` - Clave secreta de Stripe
- `STRIPE_WEBHOOK_SECRET` - Secret del webhook (solo para stripeWebhook)
