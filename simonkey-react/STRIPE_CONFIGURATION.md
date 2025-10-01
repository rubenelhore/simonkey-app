# Configuración de Stripe para Simonkey

Esta guía te ayudará a configurar Stripe para procesar pagos de suscripciones PRO en Simonkey.

## 📋 Requisitos Previos

1. Cuenta de Stripe (crea una en [stripe.com](https://stripe.com))
2. Acceso al Dashboard de Firebase
3. Acceso al proyecto de Simonkey

## 🔑 Paso 1: Obtener Claves de API de Stripe

1. Inicia sesión en tu [Dashboard de Stripe](https://dashboard.stripe.com)
2. Ve a **Developers → API keys**
3. Anota las siguientes claves:
   - **Publishable key** (empieza con `pk_`)
   - **Secret key** (empieza con `sk_`)

⚠️ **IMPORTANTE**: Usa las claves de **modo de prueba** para desarrollo y las claves de **modo producción** para el despliegue final.

## 💰 Paso 2: Crear Productos y Precios en Stripe

### 2.1 Crear Producto PRO

1. En el Dashboard de Stripe, ve a **Products → Add product**
2. Crea un producto con estos datos:
   - **Nombre**: Simonkey PRO
   - **Descripción**: Suscripción PRO con cuadernos ilimitados

### 2.2 Crear Precios

Crea dos precios para el producto:

#### Precio Mensual
- **Tipo**: Recurring
- **Precio**: $149 MXN
- **Frecuencia**: Monthly
- **ID del precio**: Anota el `price_id` (empieza con `price_`)

#### Precio Anual
- **Tipo**: Recurring
- **Precio**: $1,199 MXN
- **Frecuencia**: Yearly
- **ID del precio**: Anota el `price_id`

## 🌐 Paso 3: Configurar Variables de Entorno

### 3.1 Frontend (React)

Crea o actualiza el archivo `.env` en la raíz del proyecto:

\`\`\`env
# Stripe - Frontend
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxx
VITE_STRIPE_PRICE_PRO_MONTHLY=price_xxxxxxxxxxxxx
VITE_STRIPE_PRICE_PRO_YEARLY=price_xxxxxxxxxxxxx
\`\`\`

### 3.2 Firebase Functions

Configura las variables de entorno en Firebase Functions:

\`\`\`bash
# Navega a la carpeta de functions
cd functions

# Configura las claves secretas de Stripe
firebase functions:config:set stripe.secret_key="sk_test_xxxxxxxxxxxxx"
firebase functions:config:set stripe.webhook_secret="whsec_xxxxxxxxxxxxx"
\`\`\`

O puedes usar el archivo `.env` en `functions/`:

\`\`\`env
# Stripe - Backend
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
\`\`\`

## 🔗 Paso 4: Configurar Webhook de Stripe

### 4.1 URL del Webhook

Una vez que despliegues las functions, obtendrás una URL como:
\`\`\`
https://us-central1-tu-proyecto.cloudfunctions.net/stripeWebhook
\`\`\`

### 4.2 Crear Webhook en Stripe

1. En el Dashboard de Stripe, ve a **Developers → Webhooks**
2. Click en **Add endpoint**
3. Ingresa la URL del webhook
4. Selecciona los siguientes eventos:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Click en **Add endpoint**
6. Copia el **Signing secret** (empieza con `whsec_`)
7. Actualiza la variable `STRIPE_WEBHOOK_SECRET` con este valor

## 🚀 Paso 5: Desplegar Functions

\`\`\`bash
# Compilar functions
cd functions
npm run build

# Desplegar functions
firebase deploy --only functions
\`\`\`

## 📱 Paso 6: Agregar Ruta de Payment Success

Asegúrate de que tu archivo de rutas (`App.tsx` o similar) incluya la ruta:

\`\`\`typescript
import PaymentSuccess from './pages/PaymentSuccess';

// En tus rutas:
<Route path="/payment-success" element={<PaymentSuccess />} />
\`\`\`

## ✅ Paso 7: Probar el Flujo

### 7.1 Modo de Prueba

1. Navega a `/pricing`
2. Click en "Elegir Pro"
3. Usa una tarjeta de prueba:
   - Número: `4242 4242 4242 4242`
   - Fecha: Cualquier fecha futura
   - CVC: Cualquier 3 dígitos
   - ZIP: Cualquier código postal válido

### 7.2 Verificar Actualización de Usuario

Después del pago exitoso:
1. El usuario debe ser redirigido a `/payment-success`
2. En Firestore, verifica que el documento del usuario tenga:
   - `subscription: "pro"`
   - `stripeCustomerId: "cus_..."`
   - `stripeSubscriptionId: "sub_..."`
   - `subscriptionStatus: "active"`

## 🔐 Seguridad

### Reglas de Firestore

Asegúrate de que las reglas de Firestore protejan los datos de suscripción:

\`\`\`javascript
match /users/{userId} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow write: if request.auth != null && request.auth.uid == userId;

  // Los campos de Stripe solo pueden ser actualizados por Functions
  allow update: if request.auth != null
    && request.auth.uid == userId
    && !request.resource.data.diff(resource.data).affectedKeys()
      .hasAny(['stripeCustomerId', 'stripeSubscriptionId', 'subscriptionStatus']);
}
\`\`\`

## 🐛 Debugging

### Ver Logs de Firebase Functions

\`\`\`bash
firebase functions:log
\`\`\`

### Ver Eventos de Webhook en Stripe

1. Ve a **Developers → Webhooks**
2. Click en tu endpoint
3. Ve a la pestaña **Events**

### Probar Webhook Localmente

Usa el Stripe CLI:

\`\`\`bash
# Instalar Stripe CLI
# https://stripe.com/docs/stripe-cli

# Forward webhooks a tu localhost
stripe listen --forward-to http://localhost:5001/tu-proyecto/us-central1/stripeWebhook
\`\`\`

## 📊 Gestión de Suscripciones

Los usuarios PRO pueden gestionar su suscripción (cancelar, actualizar método de pago) usando el Customer Portal de Stripe, que se abre llamando a la función `createStripePortalSession`.

## 🌍 Modo Producción

Antes de ir a producción:

1. ✅ Cambia las claves de API de **modo de prueba** a **modo de producción**
2. ✅ Actualiza los `price_id` con los IDs de producción
3. ✅ Configura el webhook con la URL de producción
4. ✅ Prueba el flujo completo con una tarjeta real
5. ✅ Verifica que los webhooks estén funcionando
6. ✅ Configura alertas de errores

## 💡 Funcionalidades Implementadas

- ✅ Checkout de Stripe para suscripciones mensuales y anuales
- ✅ Actualización automática de usuarios a PRO al completar el pago
- ✅ Webhooks para manejar eventos de suscripción
- ✅ Customer Portal para gestión de suscripciones
- ✅ Degradación automática a FREE al cancelar suscripción
- ✅ Manejo de pagos fallidos
- ✅ Página de éxito de pago personalizada

## 🆘 Soporte

Si tienes problemas:
1. Revisa los logs de Firebase Functions
2. Verifica los eventos en el Dashboard de Stripe
3. Asegúrate de que todas las variables de entorno estén configuradas
4. Verifica que el webhook esté recibiendo eventos correctamente
