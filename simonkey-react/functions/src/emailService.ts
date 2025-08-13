import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
const sgMail = require('@sendgrid/mail');

// Inicializar SendGrid con tu API Key
// Debes configurarla con: firebase functions:config:set sendgrid.key="TU_API_KEY"
const SENDGRID_API_KEY = functions.config().sendgrid?.key;

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

export const sendCredentialEmail = functions.https.onCall(async (data, context) => {
  // Verificar que el usuario está autenticado y es admin
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
  }

  // Verificar que es un admin (puedes ajustar esta lógica)
  const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
  const userData = userDoc.data();
  
  if (!userData || userData.schoolRole !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'No tienes permisos para enviar emails');
  }

  const { to, userName, email, password, schoolName, loginUrl } = data;

  const msg = {
    to: to,
    from: 'noreply@simonkey.ai', // Asegúrate de verificar este dominio en SendGrid
    subject: `Bienvenido a Simonkey - ${schoolName}`,
    text: `
Hola ${userName},

Tu cuenta ha sido creada exitosamente.

Credenciales de acceso:
Email: ${email}
Contraseña temporal: ${password}

Inicia sesión en: ${loginUrl}

IMPORTANTE: Deberás cambiar esta contraseña en tu primer inicio de sesión.

Saludos,
Equipo Simonkey
    `,
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    .container { 
      font-family: Arial, sans-serif; 
      max-width: 600px; 
      margin: 0 auto;
    }
    .header { 
      background: linear-gradient(135deg, #6147ff 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .content { 
      padding: 30px;
      background: #f8f9fa;
    }
    .credentials {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .password {
      font-family: monospace;
      font-size: 20px;
      background: #f0f0f0;
      padding: 12px;
      border-radius: 4px;
      display: inline-block;
      color: #2c3e50;
      font-weight: bold;
    }
    .button {
      display: inline-block;
      padding: 14px 35px;
      background: #6147ff;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      margin-top: 20px;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>¡Bienvenido a Simonkey! 🎓</h1>
      <p>${schoolName}</p>
    </div>
    
    <div class="content">
      <p>Hola <strong>${userName}</strong>,</p>
      
      <p>Tu cuenta ha sido creada exitosamente. Tus credenciales de acceso son:</p>
      
      <div class="credentials">
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Contraseña temporal:</strong></p>
        <p class="password">${password}</p>
      </div>
      
      <center>
        <a href="${loginUrl}" class="button">Iniciar Sesión</a>
      </center>
      
      <p style="margin-top: 30px; color: #666; font-size: 14px;">
        Nota: Deberás cambiar esta contraseña en tu primer inicio de sesión.
      </p>
    </div>
  </div>
</body>
</html>
    `
  };

  try {
    await sgMail.send(msg);
    console.log('Email enviado exitosamente a:', to);
    return { success: true, message: 'Email enviado' };
  } catch (error) {
    console.error('Error enviando email:', error);
    throw new functions.https.HttpsError('internal', 'Error al enviar el email');
  }
});

// Función alternativa: Listener de Firestore (no requiere CORS)
export const processMailQueue = functions.firestore
  .document('mail/{docId}')
  .onCreate(async (snap, context) => {
    const mailData = snap.data();
    
    if (!SENDGRID_API_KEY) {
      console.error('SendGrid API key no configurada');
      await snap.ref.update({
        'delivery.state': 'ERROR',
        'delivery.error': 'SendGrid API key not configured'
      });
      return;
    }

    try {
      const msg = {
        to: mailData.to,
        from: 'noreply@simonkey.ai',
        subject: mailData.message.subject,
        text: mailData.message.text,
        html: mailData.message.html
      };

      await sgMail.send(msg);
      
      // Marcar como enviado
      await snap.ref.update({
        'delivery.state': 'SUCCESS',
        'delivery.sentAt': admin.firestore.FieldValue.serverTimestamp(),
        'delivery.attempts': 1
      });
      
      console.log('Email enviado exitosamente');
    } catch (error: any) {
      console.error('Error enviando email:', error);
      
      // Marcar como error
      await snap.ref.update({
        'delivery.state': 'ERROR',
        'delivery.error': error.message || 'Unknown error',
        'delivery.attempts': 1
      });
    }
  });