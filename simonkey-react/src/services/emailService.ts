import { functions } from './firebase';
import { httpsCallable } from 'firebase/functions';

interface EmailCredentials {
  to: string;
  studentName: string;
  email: string;
  password: string;
  schoolName: string;
  loginUrl?: string;
}

interface PasswordResetEmail {
  to: string;
  studentName: string;
  resetCode: string;
  resetUrl?: string;
}

/**
 * Servicio para enviar emails a estudiantes
 */
export class EmailService {
  /**
   * Envía credenciales temporales al estudiante
   */
  static async sendStudentCredentials(data: EmailCredentials): Promise<boolean> {
    try {
      const sendEmail = httpsCallable(functions, 'sendStudentCredentials');
      
      const emailData = {
        to: data.to,
        subject: `Bienvenido a Simonkey - ${data.schoolName}`,
        template: 'student-credentials',
        data: {
          studentName: data.studentName,
          email: data.email,
          password: data.password,
          schoolName: data.schoolName,
          loginUrl: data.loginUrl || 'https://simonkey.ai/login',
          instructions: [
            'Guarda esta información en un lugar seguro',
            'En tu primer inicio de sesión, se te pedirá cambiar la contraseña',
            'Si tienes problemas, contacta a tu profesor o administrador'
          ]
        }
      };
      
      const result = await sendEmail(emailData);
      console.log('📧 Email de credenciales enviado:', result);
      return true;
    } catch (error) {
      console.error('❌ Error enviando email de credenciales:', error);
      return false;
    }
  }

  /**
   * Envía código de recuperación de contraseña
   */
  static async sendPasswordReset(data: PasswordResetEmail): Promise<boolean> {
    try {
      const sendEmail = httpsCallable(functions, 'sendPasswordReset');
      
      const emailData = {
        to: data.to,
        subject: 'Recuperación de Contraseña - Simonkey',
        template: 'password-reset',
        data: {
          studentName: data.studentName,
          resetCode: data.resetCode,
          resetUrl: data.resetUrl || `https://simonkey.ai/reset-password?code=${data.resetCode}`,
          expirationTime: '30 minutos'
        }
      };
      
      const result = await sendEmail(emailData);
      console.log('📧 Email de recuperación enviado:', result);
      return true;
    } catch (error) {
      console.error('❌ Error enviando email de recuperación:', error);
      return false;
    }
  }

  /**
   * Envía notificación de cambio de contraseña exitoso
   */
  static async sendPasswordChangeConfirmation(email: string, studentName: string): Promise<boolean> {
    try {
      const sendEmail = httpsCallable(functions, 'sendPasswordChangeConfirmation');
      
      const emailData = {
        to: email,
        subject: 'Contraseña Actualizada - Simonkey',
        template: 'password-changed',
        data: {
          studentName,
          changeDate: new Date().toLocaleString('es-MX'),
          supportEmail: 'soporte@simonkey.ai'
        }
      };
      
      const result = await sendEmail(emailData);
      console.log('📧 Confirmación de cambio enviada:', result);
      return true;
    } catch (error) {
      console.error('❌ Error enviando confirmación:', error);
      return false;
    }
  }

  /**
   * Envía credenciales masivas a múltiples estudiantes
   */
  static async sendBulkCredentials(students: EmailCredentials[]): Promise<{
    sent: string[];
    failed: string[];
  }> {
    const sent: string[] = [];
    const failed: string[] = [];
    
    // Enviar de a 5 emails en paralelo para no sobrecargar
    const batchSize = 5;
    for (let i = 0; i < students.length; i += batchSize) {
      const batch = students.slice(i, i + batchSize);
      const promises = batch.map(async (student) => {
        const success = await this.sendStudentCredentials(student);
        if (success) {
          sent.push(student.email);
        } else {
          failed.push(student.email);
        }
      });
      
      await Promise.all(promises);
      
      // Pequeña pausa entre lotes
      if (i + batchSize < students.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return { sent, failed };
  }
}

/**
 * Templates HTML para emails (estos normalmente estarían en el backend)
 * Aquí los incluyo como referencia
 */
export const EMAIL_TEMPLATES = {
  'student-credentials': `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .credentials { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
        .important { background: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>¡Bienvenido a Simonkey! 🚀</h1>
          <p>{{schoolName}}</p>
        </div>
        <div class="content">
          <h2>Hola {{studentName}},</h2>
          <p>Tu cuenta ha sido creada exitosamente. Aquí están tus credenciales de acceso:</p>
          
          <div class="credentials">
            <strong>📧 Correo:</strong> {{email}}<br>
            <strong>🔐 Contraseña temporal:</strong> {{password}}
          </div>
          
          <div class="important">
            <strong>⚠️ Importante:</strong>
            <ul style="margin: 10px 0; padding-left: 20px;">
              {{#instructions}}
              <li>{{.}}</li>
              {{/instructions}}
            </ul>
          </div>
          
          <center>
            <a href="{{loginUrl}}" class="button">Iniciar Sesión</a>
          </center>
          
          <div class="footer">
            <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
            <p>© 2024 Simonkey - Todos los derechos reservados</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `
};