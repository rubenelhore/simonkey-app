import { auth, db, app } from '../services/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { UserSubscriptionType } from '../types/interfaces';
import { httpsCallable, getFunctions } from 'firebase/functions';

// Usar la app de Firebase ya inicializada
const functions = getFunctions(app);

/**
 * Función para crear el perfil de usuario faltante
 * Ejecutar en la consola del navegador: window.fixUserProfile()
 */
export const fixUserProfile = async () => {
  console.log('🔧 === ARREGLANDO PERFIL DE USUARIO ===');
  
  try {
    // 1. Verificar usuario actual
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('❌ No hay usuario autenticado');
      return false;
    }
    
    console.log('👤 Usuario actual:', currentUser.email);
    console.log('🆔 UID:', currentUser.uid);
    
    // 2. Verificar si ya existe el documento
    const userDocRef = doc(db, 'users', currentUser.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      console.log('✅ Usuario ya existe en Firestore');
      const userData = userDoc.data();
      console.log('📋 Datos actuales:', {
        subscription: userData.subscription,
        email: userData.email,
        maxNotebooks: userData.maxNotebooks
      });
      return true;
    }
    
    // 3. Intentar crear perfil usando Cloud Functions (bypass de reglas)
    console.log('⚠️ Usuario no existe en Firestore, intentando crear perfil via Cloud Functions...');
    
    try {
      const createUserProfile = httpsCallable(functions, 'createUserProfile');
      const result = await createUserProfile({
        userId: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName,
        emailVerified: currentUser.emailVerified
      });
      
      console.log('✅ Perfil creado via Cloud Functions:', result.data);
      
      // 4. Recargar página después de un breve delay
      console.log('🔄 Recargando página en 3 segundos...');
      setTimeout(() => {
        window.location.reload();
      }, 3000);
      
      return true;
      
    } catch (functionError: any) {
      console.log('⚠️ Cloud Function falló, intentando método directo...');
      
      // 5. Método directo como fallback
      const userData = {
        id: currentUser.uid,
        email: currentUser.email || '',
        username: currentUser.displayName || currentUser.email?.split('@')[0] || 'Usuario',
        nombre: currentUser.displayName || currentUser.email?.split('@')[0] || 'Usuario',
        displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Usuario',
        birthdate: '',
        subscription: currentUser.email === 'ruben.elhore@gmail.com' ? UserSubscriptionType.SUPER_ADMIN : UserSubscriptionType.FREE,
        notebookCount: 0,
        maxNotebooks: currentUser.email === 'ruben.elhore@gmail.com' ? -1 : 4,
        maxConceptsPerNotebook: currentUser.email === 'ruben.elhore@gmail.com' ? -1 : 100,
        notebooksCreatedThisWeek: 0,
        conceptsCreatedThisWeek: 0,
        weekStartDate: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        emailVerified: currentUser.emailVerified,
        // Campos adicionales para usuarios escolares
        schoolRole: null,
        schoolId: null,
        idAdmin: null
      };
      
      await setDoc(userDocRef, userData);
      console.log('✅ Perfil de usuario creado exitosamente (método directo)');
      console.log('📋 Datos creados:', {
        subscription: userData.subscription,
        email: userData.email,
        maxNotebooks: userData.maxNotebooks,
        schoolRole: userData.schoolRole
      });
      
      // 6. Recargar página después de un breve delay
      console.log('🔄 Recargando página en 3 segundos...');
      setTimeout(() => {
        window.location.reload();
      }, 3000);
      
      return true;
    }
    
  } catch (error: any) {
    console.error('❌ Error creando perfil de usuario:', error);
    console.error('Detalles del error:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    
    // 7. Método de emergencia: usar localStorage para indicar que se necesita crear perfil
    console.log('🚨 Método de emergencia: marcando para crear perfil en localStorage');
    const currentUser = auth.currentUser;
    localStorage.setItem('needsProfileCreation', 'true');
    localStorage.setItem('pendingUserEmail', currentUser?.email || '');
    localStorage.setItem('pendingUserId', currentUser?.uid || '');
    
    return false;
  }
};

/**
 * Función para diagnosticar el estado actual del usuario
 */
export const diagnoseUserStatus = async () => {
  console.log('🔍 === DIAGNÓSTICO DE ESTADO DE USUARIO ===');
  
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('❌ No hay usuario autenticado');
      return;
    }
    
    console.log('👤 Usuario autenticado:', currentUser.email);
    console.log('🆔 UID:', currentUser.uid);
    console.log('📧 Email verificado:', currentUser.emailVerified);
    
    // Verificar documento en Firestore
    const userDocRef = doc(db, 'users', currentUser.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      console.log('✅ Documento de usuario existe');
      console.log('📋 Datos del usuario:', {
        subscription: userData.subscription,
        email: userData.email,
        schoolRole: userData.schoolRole,
        schoolId: userData.schoolId,
        maxNotebooks: userData.maxNotebooks
      });
    } else {
      console.log('❌ Documento de usuario NO existe');
      console.log('💡 Ejecuta: window.fixUserProfile() para crear el perfil');
    }
    
    // Verificar localStorage
    const needsProfileCreation = localStorage.getItem('needsProfileCreation');
    if (needsProfileCreation === 'true') {
      console.log('⚠️ Marcado para crear perfil en localStorage');
    }
    
  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
  }
};

/**
 * Función de emergencia para crear perfil usando localStorage
 */
export const emergencyCreateProfile = async () => {
  console.log('🚨 === CREACIÓN DE PERFIL DE EMERGENCIA ===');
  
  const pendingUserEmail = localStorage.getItem('pendingUserEmail');
  const pendingUserId = localStorage.getItem('pendingUserId');
  
  if (!pendingUserEmail || !pendingUserId) {
    console.log('❌ No hay datos pendientes en localStorage');
    return;
  }
  
  console.log('📧 Email pendiente:', pendingUserEmail);
  console.log('🆔 UID pendiente:', pendingUserId);
  
  // Crear perfil básico
  const userData = {
    id: pendingUserId,
    email: pendingUserEmail,
    username: pendingUserEmail.split('@')[0],
    nombre: pendingUserEmail.split('@')[0],
    displayName: pendingUserEmail.split('@')[0],
    birthdate: '',
    subscription: pendingUserEmail === 'ruben.elhore@gmail.com' ? UserSubscriptionType.SUPER_ADMIN : UserSubscriptionType.FREE,
    notebookCount: 0,
    maxNotebooks: pendingUserEmail === 'ruben.elhore@gmail.com' ? -1 : 4,
    maxConceptsPerNotebook: pendingUserEmail === 'ruben.elhore@gmail.com' ? -1 : 100,
    notebooksCreatedThisWeek: 0,
    conceptsCreatedThisWeek: 0,
    weekStartDate: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    emailVerified: true,
    schoolRole: null,
    schoolId: null,
    idAdmin: null
  };
  
  try {
    const userDocRef = doc(db, 'users', pendingUserId);
    await setDoc(userDocRef, userData);
    console.log('✅ Perfil de emergencia creado exitosamente');
    
    // Limpiar localStorage
    localStorage.removeItem('needsProfileCreation');
    localStorage.removeItem('pendingUserEmail');
    localStorage.removeItem('pendingUserId');
    
    // Recargar página
    setTimeout(() => {
      window.location.reload();
    }, 2000);
    
  } catch (error: any) {
    console.error('❌ Error creando perfil de emergencia:', error);
  }
};

// Exponer funciones globalmente para uso en consola
if (typeof window !== 'undefined') {
  (window as any).fixUserProfile = fixUserProfile;
  (window as any).diagnoseUserStatus = diagnoseUserStatus;
  (window as any).emergencyCreateProfile = emergencyCreateProfile;
  
  console.log('🔧 Función fixUserProfile() disponible en la consola');
  console.log('🔍 Función diagnoseUserStatus() disponible en la consola');
  console.log('🚨 Función emergencyCreateProfile() disponible en la consola');
  console.log('💡 Ejecuta: window.fixUserProfile() para arreglar el perfil de usuario');
} 