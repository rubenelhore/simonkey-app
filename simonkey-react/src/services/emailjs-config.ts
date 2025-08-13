// Configuración de EmailJS
// 1. Ve a https://www.emailjs.com/
// 2. Crea una cuenta
// 3. Añade tu servicio de email (Gmail, Outlook, etc)
// 4. Crea un template
// 5. Copia estos IDs

export const EMAILJS_CONFIG = {
  SERVICE_ID: 'service_x71i3xa', // Pega aquí tu Service ID de EmailJS
  TEMPLATE_ID: 'template_2io1umh', // Pega aquí tu Template ID de EmailJS
  PUBLIC_KEY: 'Ow1pOFGF96LJ76i5G' // Pega aquí tu Public Key de EmailJS
};

// Template variables que debes configurar en EmailJS:
// {{to_email}} - Email del destinatario
// {{to_name}} - Nombre del usuario
// {{user_email}} - Email de login
// {{temp_password}} - Contraseña temporal
// {{school_name}} - Nombre de la escuela
// {{login_url}} - URL de login