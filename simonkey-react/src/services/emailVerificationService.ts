import { 
  sendEmailVerification, 
  reload, 
  User
} from 'firebase/auth';
import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

export interface EmailVerificationState {
  isEmailVerified: boolean;
  verificationSentAt?: Date;
  verificationCount: number;
  lastVerificationSent?: Date;
}

/**
 * Configuración de verificación de email
 */
const VERIFICATION_CONFIG = {
  // Tiempo mínimo entre envíos de verificación (en minutos)
  MIN_RESEND_INTERVAL: 5,
  // Máximo número de verificaciones por día
  MAX_VERIFICATIONS_PER_DAY: 5,
  // Tiempo de espera para verificación automática (en minutos)
  AUTO_CHECK_INTERVAL: 30
};

/**
 * Envía un email de verificación al usuario actual
 */
export const sendVerificationEmail = async (user: User): Promise<{ success: boolean; message: string }> => {
  try {
    console.log('📧 Enviando email de verificación para:', user.email);
    
    // Verificar si ya está verificado
    await reload(user);
    if (user.emailVerified) {
      console.log('✅ Email ya está verificado');
      await updateUserVerificationStatus(user.uid, true);
      return { success: true, message: 'El email ya está verificado' };
    }

    // Verificar límites de envío
    const canSend = await canSendVerificationEmail(user.uid);
    if (!canSend.allowed) {
      console.log('❌ No se puede enviar verificación:', canSend.reason);
      return { success: false, message: canSend.reason };
    }

    // Configurar parámetros de verificación
    const actionCodeSettings = {
      url: `${window.location.origin}/verify-email?uid=${user.uid}`,
      handleCodeInApp: true,
    };

    // Enviar email de verificación
    await sendEmailVerification(user, actionCodeSettings);
    
    // Actualizar estadísticas en Firestore
    await updateVerificationStats(user.uid);
    
    console.log('✅ Email de verificación enviado exitosamente');
    return { 
      success: true, 
      message: `Email de verificación enviado a ${user.email}. Revisa tu bandeja de entrada y spam.` 
    };
    
  } catch (error: any) {
    console.error('❌ Error enviando email de verificación:', error);
    
    let errorMessage = 'Error enviando email de verificación';
    if (error.code === 'auth/too-many-requests') {
      errorMessage = 'Demasiadas solicitudes. Intenta más tarde.';
    } else if (error.code === 'auth/user-token-expired') {
      errorMessage = 'Sesión expirada. Inicia sesión nuevamente.';
    }
    
    return { success: false, message: errorMessage };
  }
};

/**
 * Verifica si un usuario puede enviar un email de verificación
 */
export const canSendVerificationEmail = async (userId: string): Promise<{ allowed: boolean; reason: string }> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return { allowed: true, reason: '' };
    }

    const userData = userDoc.data();
    const verificationData = userData.emailVerification || {};
    
    const now = new Date();
    const lastSent = verificationData.lastVerificationSent?.toDate();
    const verificationCount = verificationData.verificationCount || 0;
    
    // Verificar intervalo mínimo
    if (lastSent) {
      const minutesSinceLastSent = (now.getTime() - lastSent.getTime()) / (1000 * 60);
      if (minutesSinceLastSent < VERIFICATION_CONFIG.MIN_RESEND_INTERVAL) {
        const remainingMinutes = Math.ceil(VERIFICATION_CONFIG.MIN_RESEND_INTERVAL - minutesSinceLastSent);
        return { 
          allowed: false, 
          reason: `Espera ${remainingMinutes} minuto(s) antes de solicitar otro email` 
        };
      }
    }
    
    // Verificar límite diario
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastSentDate = lastSent ? new Date(lastSent) : null;
    lastSentDate?.setHours(0, 0, 0, 0);
    
    const isToday = lastSentDate && lastSentDate.getTime() === today.getTime();
    if (isToday && verificationCount >= VERIFICATION_CONFIG.MAX_VERIFICATIONS_PER_DAY) {
      return { 
        allowed: false, 
        reason: 'Límite diario de verificaciones alcanzado. Intenta mañana.' 
      };
    }
    
    return { allowed: true, reason: '' };
    
  } catch (error) {
    console.error('Error verificando límites de envío:', error);
    return { allowed: true, reason: '' }; // Permitir por defecto en caso de error
  }
};

/**
 * Actualiza las estadísticas de verificación en Firestore
 */
export const updateVerificationStats = async (userId: string): Promise<void> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.exists() ? userDoc.data() : {};
    const verificationData = userData.emailVerification || {};
    
    const now = new Date();
    const lastSent = verificationData.lastVerificationSent?.toDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Resetear contador si es un nuevo día
    let newCount = 1;
    if (lastSent) {
      const lastSentDate = new Date(lastSent);
      lastSentDate.setHours(0, 0, 0, 0);
      if (lastSentDate.getTime() === today.getTime()) {
        newCount = (verificationData.verificationCount || 0) + 1;
      }
    }
    
    const updateData = {
      emailVerification: {
        ...verificationData,
        verificationCount: newCount,
        lastVerificationSent: serverTimestamp(),
        verificationSentAt: serverTimestamp()
      }
    };
    
    await updateDoc(doc(db, 'users', userId), updateData);
    console.log('📊 Estadísticas de verificación actualizadas');
    
  } catch (error) {
    console.error('Error actualizando estadísticas:', error);
  }
};

/**
 * Verifica el estado de verificación de email del usuario
 */
export const checkEmailVerificationStatus = async (user: User): Promise<boolean> => {
  try {
    console.log('🔍 Verificando estado de email para:', user.email);
    
    // Recargar información del usuario
    await reload(user);
    
    const isVerified = user.emailVerified;
    console.log('📧 Estado de verificación:', isVerified ? 'Verificado' : 'No verificado');
    
    // Actualizar estado en Firestore si está verificado
    if (isVerified) {
      await updateUserVerificationStatus(user.uid, true);
    }
    
    return isVerified;
    
  } catch (error) {
    console.error('Error verificando estado de email:', error);
    return false;
  }
};

/**
 * Actualiza el estado de verificación de email en Firestore
 */
export const updateUserVerificationStatus = async (userId: string, isVerified: boolean): Promise<void> => {
  try {
    const updateData = {
      emailVerified: isVerified,
      emailVerificationStatus: {
        isVerified,
        verifiedAt: isVerified ? serverTimestamp() : null,
        lastChecked: serverTimestamp()
      }
    };
    
    await updateDoc(doc(db, 'users', userId), updateData);
    console.log(`✅ Estado de verificación actualizado: ${isVerified ? 'verificado' : 'no verificado'}`);
    
  } catch (error) {
    console.error('Error actualizando estado de verificación:', error);
  }
};

/**
 * Monitorea automáticamente el estado de verificación
 */
export const startVerificationMonitoring = (user: User, onVerified: () => void): () => void => {
  console.log('🔄 Iniciando monitoreo de verificación de email');
  
  const intervalId = setInterval(async () => {
    try {
      const isVerified = await checkEmailVerificationStatus(user);
      if (isVerified) {
        console.log('🎉 Email verificado exitosamente');
        clearInterval(intervalId);
        onVerified();
      }
    } catch (error) {
      console.error('Error en monitoreo de verificación:', error);
    }
  }, VERIFICATION_CONFIG.AUTO_CHECK_INTERVAL * 1000);
  
  // Retornar función para limpiar el intervalo
  return () => clearInterval(intervalId);
};

/**
 * Obtiene el estado de verificación desde Firestore
 */
export const getVerificationState = async (userId: string): Promise<EmailVerificationState> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return {
        isEmailVerified: false,
        verificationCount: 0
      };
    }
    
    const userData = userDoc.data();
    const verificationData = userData.emailVerification || {};
    
    return {
      isEmailVerified: userData.emailVerified || false,
      verificationSentAt: verificationData.verificationSentAt?.toDate(),
      verificationCount: verificationData.verificationCount || 0,
      lastVerificationSent: verificationData.lastVerificationSent?.toDate()
    };
    
  } catch (error) {
    console.error('Error obteniendo estado de verificación:', error);
    return {
      isEmailVerified: false,
      verificationCount: 0
    };
  }
};

/**
 * Limpia los datos de verificación (para uso administrativo)
 */
export const resetVerificationData = async (userId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, 'users', userId), {
      emailVerification: {
        verificationCount: 0,
        lastVerificationSent: null,
        verificationSentAt: null
      }
    });
    console.log('🔄 Datos de verificación reiniciados');
  } catch (error) {
    console.error('Error reiniciando datos de verificación:', error);
  }
};