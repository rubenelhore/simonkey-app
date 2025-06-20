import { db, auth } from './firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { UserSubscriptionType, SchoolRole, UserProfile, SubscriptionLimits } from '../types/interfaces';
import { collection, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';

/**
 * Configuración de límites por tipo de suscripción
 */
const SUBSCRIPTION_LIMITS: Record<UserSubscriptionType, SubscriptionLimits> = {
  [UserSubscriptionType.SUPER_ADMIN]: {
    maxNotebooks: -1, // Sin límite
    maxConceptsPerNotebook: -1, // Sin límite
    canDeleteAndRecreate: true,
    permissions: {
      canViewAllData: true,
      canEditAllData: true,
      canUseStudySection: true,
      canManageUsers: true,
    },
  },
  [UserSubscriptionType.FREE]: {
    maxNotebooks: 4,
    maxConceptsPerNotebook: 100,
    canDeleteAndRecreate: false, // No puede recrear cuadernos eliminados
    permissions: {
      canViewAllData: false,
      canEditAllData: false,
      canUseStudySection: true,
      canManageUsers: false,
    },
  },
  [UserSubscriptionType.PRO]: {
    maxNotebooks: -1, // Sin límite total
    maxConceptsPerNotebook: 100,
    maxNotebooksPerWeek: 10,
    maxConceptsPerWeek: 100,
    canDeleteAndRecreate: true,
    permissions: {
      canViewAllData: false,
      canEditAllData: false,
      canUseStudySection: true,
      canManageUsers: false,
    },
  },
  [UserSubscriptionType.SCHOOL]: {
    maxNotebooks: -1, // Sin límite
    maxConceptsPerNotebook: -1, // Sin límite
    canDeleteAndRecreate: true,
    permissions: {
      canViewAllData: false,
      canEditAllData: false,
      canUseStudySection: true,
      canManageUsers: false,
    },
  },
};

/**
 * Permisos específicos por rol escolar
 */
const SCHOOL_ROLE_PERMISSIONS: Record<SchoolRole, Partial<SubscriptionLimits['permissions']>> = {
  [SchoolRole.ADMIN]: {
    canViewAllData: true,
    canEditAllData: false,
    canUseStudySection: true,
    canManageUsers: false,
  },
  [SchoolRole.TEACHER]: {
    canViewAllData: false,
    canEditAllData: true,
    canUseStudySection: true,
    canManageUsers: false,
  },
  [SchoolRole.STUDENT]: {
    canViewAllData: false,
    canEditAllData: false,
    canUseStudySection: true,
    canManageUsers: false,
  },
  [SchoolRole.TUTOR]: {
    canViewAllData: false,
    canEditAllData: false,
    canUseStudySection: true,
    canManageUsers: false,
  },
};

/**
 * Determina el tipo de suscripción basado en el email del usuario
 */
export const determineUserSubscription = (email: string): UserSubscriptionType => {
  console.log('🔍 Determinando tipo de suscripción para email:', email);
  
  // Super admin
  if (email === 'ruben.elhore@gmail.com') {
    console.log('👑 Usuario identificado como super admin');
    return UserSubscriptionType.SUPER_ADMIN;
  }
  
  // Por defecto, todos los usuarios nuevos son FREE
  console.log('👤 Usuario asignado como FREE por defecto');
  return UserSubscriptionType.FREE;
};

/**
 * Obtiene los límites de suscripción para un tipo de usuario
 */
export const getSubscriptionLimits = (subscriptionType: UserSubscriptionType): SubscriptionLimits => {
  console.log('📊 Obteniendo límites para tipo de suscripción:', subscriptionType);
  const limits = SUBSCRIPTION_LIMITS[subscriptionType];
  console.log('📋 Límites obtenidos:', limits);
  return limits;
};

/**
 * Obtiene los permisos específicos para un rol escolar
 */
export const getSchoolRolePermissions = (role: SchoolRole): Partial<SubscriptionLimits['permissions']> => {
  return SCHOOL_ROLE_PERMISSIONS[role];
};

/**
 * Crea o actualiza el perfil de usuario con el tipo de suscripción apropiado
 */
export const createUserProfile = async (
  userId: string,
  userData: {
    email: string;
    username: string;
    nombre: string;
    displayName: string;
    birthdate: string;
  }
): Promise<void> => {
  try {
    console.log('🚀 Creando perfil de usuario:', { userId, userData });
    
    const subscriptionType = determineUserSubscription(userData.email);
    console.log('📋 Tipo de suscripción determinado:', subscriptionType);
    
    const limits = getSubscriptionLimits(subscriptionType);
    console.log('📊 Límites obtenidos:', limits);
    
    const userProfile: Partial<UserProfile> = {
      id: userId,
      email: userData.email,
      username: userData.username,
      nombre: userData.nombre,
      displayName: userData.displayName,
      birthdate: userData.birthdate,
      createdAt: serverTimestamp() as any,
      subscription: subscriptionType,
      notebookCount: 0,
      maxNotebooks: limits.maxNotebooks,
      maxConceptsPerNotebook: limits.maxConceptsPerNotebook,
      notebooksCreatedThisWeek: 0,
      conceptsCreatedThisWeek: 0,
      weekStartDate: serverTimestamp() as any,
    };

    // Si es usuario escolar, establecer rol por defecto como estudiante
    if (subscriptionType === UserSubscriptionType.SCHOOL) {
      userProfile.schoolRole = SchoolRole.STUDENT;
    }

    console.log('📝 Perfil a guardar:', userProfile);
    
    await setDoc(doc(db, 'users', userId), userProfile);
    console.log(`✅ Perfil de usuario creado exitosamente con tipo: ${subscriptionType}`);
  } catch (error) {
    console.error('❌ Error al crear perfil de usuario:', error);
    throw error;
  }
};

/**
 * Obtiene el perfil completo del usuario
 */
export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    console.log('🔍 Buscando perfil de usuario con ID:', userId);
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (userDoc.exists()) {
      const userData = userDoc.data() as UserProfile;
      console.log('✅ Perfil de usuario encontrado:', userData);
      console.log('📋 Detalles del perfil:', {
        id: userData.id,
        email: userData.email,
        subscription: userData.subscription,
        schoolRole: userData.schoolRole,
        notebookCount: userData.notebookCount,
        maxNotebooks: userData.maxNotebooks
      });
      console.log('📋 Perfil completo JSON:', JSON.stringify(userData, null, 2));
      return userData;
    }
    
    console.log('❌ Documento de usuario no encontrado en Firestore');
    return null;
  } catch (error) {
    console.error('❌ Error al obtener perfil de usuario:', error);
    return null;
  }
};

/**
 * Actualiza el tipo de suscripción de un usuario
 */
export const updateUserSubscription = async (
  userId: string,
  newSubscription: UserSubscriptionType,
  schoolRole?: SchoolRole
): Promise<void> => {
  try {
    const limits = getSubscriptionLimits(newSubscription);
    
    const updateData: Partial<UserProfile> = {
      subscription: newSubscription,
      maxNotebooks: limits.maxNotebooks,
      maxConceptsPerNotebook: limits.maxConceptsPerNotebook,
    };

    // Si es usuario escolar, actualizar el rol
    if (newSubscription === UserSubscriptionType.SCHOOL && schoolRole) {
      updateData.schoolRole = schoolRole;
    }

    await updateDoc(doc(db, 'users', userId), updateData);
    console.log(`Suscripción actualizada a: ${newSubscription}`);
  } catch (error) {
    console.error('Error al actualizar suscripción:', error);
    throw error;
  }
};

/**
 * Verifica si un usuario puede crear un nuevo cuaderno
 */
export const canCreateNotebook = async (userId: string): Promise<{ canCreate: boolean; reason?: string }> => {
  try {
    const userProfile = await verifyAndFixUserProfile(userId);
    
    if (!userProfile) {
      return { canCreate: false, reason: 'Usuario no encontrado' };
    }

    const limits = getSubscriptionLimits(userProfile.subscription);

    // Super admin siempre puede crear
    if (userProfile.subscription === UserSubscriptionType.SUPER_ADMIN) {
      return { canCreate: true };
    }

    // Verificar límite total de cuadernos
    if (limits.maxNotebooks !== -1 && userProfile.notebookCount >= limits.maxNotebooks) {
      return { canCreate: false, reason: 'Límite de cuadernos alcanzado' };
    }

    // Verificar límite semanal para usuarios PRO
    if (userProfile.subscription === UserSubscriptionType.PRO && limits.maxNotebooksPerWeek) {
      const currentWeek = new Date();
      currentWeek.setHours(0, 0, 0, 0);
      
      if (userProfile.weekStartDate) {
        const weekStart = userProfile.weekStartDate.toDate();
        weekStart.setHours(0, 0, 0, 0);
        
        // Si es una nueva semana, resetear contadores
        if (currentWeek.getTime() !== weekStart.getTime()) {
          await updateDoc(doc(db, 'users', userId), {
            notebooksCreatedThisWeek: 0,
            conceptsCreatedThisWeek: 0,
            weekStartDate: serverTimestamp(),
          });
          return { canCreate: true };
        }
      }

      if (userProfile.notebooksCreatedThisWeek && userProfile.notebooksCreatedThisWeek >= limits.maxNotebooksPerWeek) {
        return { canCreate: false, reason: 'Límite semanal de cuadernos alcanzado' };
      }
    }

    return { canCreate: true };
  } catch (error) {
    console.error('Error al verificar si puede crear cuaderno:', error);
    return { canCreate: false, reason: 'Error interno' };
  }
};

/**
 * Verifica si un usuario puede agregar conceptos a un cuaderno
 */
export const canAddConcepts = async (
  userId: string,
  notebookId: string,
  currentConceptCount: number
): Promise<{ canAdd: boolean; reason?: string }> => {
  try {
    const userProfile = await getUserProfile(userId);
    if (!userProfile) {
      return { canAdd: false, reason: 'Usuario no encontrado' };
    }

    const limits = getSubscriptionLimits(userProfile.subscription);

    // Super admin siempre puede agregar
    if (userProfile.subscription === UserSubscriptionType.SUPER_ADMIN) {
      return { canAdd: true };
    }

    // Verificar límite por cuaderno
    if (limits.maxConceptsPerNotebook !== -1 && currentConceptCount >= limits.maxConceptsPerNotebook) {
      return { canAdd: false, reason: 'Límite de conceptos por cuaderno alcanzado' };
    }

    // Verificar límite semanal para usuarios PRO
    if (userProfile.subscription === UserSubscriptionType.PRO && limits.maxConceptsPerWeek) {
      const currentWeek = new Date();
      currentWeek.setHours(0, 0, 0, 0);
      
      if (userProfile.weekStartDate) {
        const weekStart = userProfile.weekStartDate.toDate();
        weekStart.setHours(0, 0, 0, 0);
        
        // Si es una nueva semana, resetear contadores
        if (currentWeek.getTime() !== weekStart.getTime()) {
          await updateDoc(doc(db, 'users', userId), {
            notebooksCreatedThisWeek: 0,
            conceptsCreatedThisWeek: 0,
            weekStartDate: serverTimestamp(),
          });
          return { canAdd: true };
        }
      }

      if (userProfile.conceptsCreatedThisWeek && userProfile.conceptsCreatedThisWeek >= limits.maxConceptsPerWeek) {
        return { canAdd: false, reason: 'Límite semanal de conceptos alcanzado' };
      }
    }

    return { canAdd: true };
  } catch (error) {
    console.error('Error al verificar si puede agregar conceptos:', error);
    return { canAdd: false, reason: 'Error interno' };
  }
};

/**
 * Incrementa el contador de cuadernos creados
 */
export const incrementNotebookCount = async (userId: string): Promise<void> => {
  try {
    console.log('📈 Incrementando contador de cuadernos para usuario:', userId);
    
    const userProfile = await getUserProfile(userId);
    if (!userProfile) {
      console.log('❌ No se pudo obtener el perfil del usuario para incrementar contador');
      return;
    }

    const currentCount = userProfile.notebookCount || 0;
    console.log('📊 Contador actual de cuadernos:', currentCount);

    const updateData: any = {
      notebookCount: currentCount + 1,
    };

    // Incrementar contador semanal para usuarios PRO
    if (userProfile.subscription === UserSubscriptionType.PRO) {
      const currentWeeklyCount = userProfile.notebooksCreatedThisWeek || 0;
      updateData.notebooksCreatedThisWeek = currentWeeklyCount + 1;
      console.log('📅 Incrementando contador semanal PRO:', currentWeeklyCount + 1);
    }

    console.log('📝 Datos a actualizar:', updateData);
    
    await updateDoc(doc(db, 'users', userId), updateData);
    console.log('✅ Contador de cuadernos incrementado exitosamente');
  } catch (error) {
    console.error('❌ Error al incrementar contador de cuadernos:', error);
  }
};

/**
 * Incrementa el contador de conceptos creados
 */
export const incrementConceptCount = async (userId: string): Promise<void> => {
  try {
    const userProfile = await getUserProfile(userId);
    if (!userProfile) return;

    const updateData: any = {};

    // Incrementar contador semanal para usuarios PRO
    if (userProfile.subscription === UserSubscriptionType.PRO) {
      updateData.conceptsCreatedThisWeek = (userProfile.conceptsCreatedThisWeek || 0) + 1;
    }

    if (Object.keys(updateData).length > 0) {
      await updateDoc(doc(db, 'users', userId), updateData);
    }
  } catch (error) {
    console.error('Error al incrementar contador de conceptos:', error);
  }
};

/**
 * Verifica y corrige un perfil de usuario si está incompleto
 */
export const verifyAndFixUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    console.log('🔍 Verificando y corrigiendo perfil de usuario:', userId);
    
    const userProfile = await getUserProfile(userId);
    if (!userProfile) {
      console.log('❌ Usuario no encontrado');
      return null;
    }

    // Verificar si el perfil está completo
    const needsFix = !userProfile.subscription || 
                    userProfile.notebookCount === undefined || 
                    userProfile.notebookCount === null ||
                    !userProfile.maxNotebooks;

    if (needsFix) {
      console.log('⚠️ Perfil incompleto detectado, corrigiendo...');
      
      const subscriptionType = determineUserSubscription(userProfile.email);
      const limits = getSubscriptionLimits(subscriptionType);
      
      const updateData = {
        subscription: subscriptionType,
        notebookCount: userProfile.notebookCount || 0,
        maxNotebooks: limits.maxNotebooks,
        maxConceptsPerNotebook: limits.maxConceptsPerNotebook,
        notebooksCreatedThisWeek: userProfile.notebooksCreatedThisWeek || 0,
        conceptsCreatedThisWeek: userProfile.conceptsCreatedThisWeek || 0,
        weekStartDate: userProfile.weekStartDate || serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      console.log('📝 Datos de corrección:', updateData);
      
      await updateDoc(doc(db, 'users', userId), updateData);
      
      // Retornar el perfil corregido
      const correctedProfile = {
        ...userProfile,
        ...updateData,
        subscription: subscriptionType,
        notebookCount: userProfile.notebookCount || 0,
        maxNotebooks: limits.maxNotebooks,
        maxConceptsPerNotebook: limits.maxConceptsPerNotebook,
      };
      
      console.log('✅ Perfil corregido exitosamente');
      return correctedProfile;
    }

    console.log('✅ Perfil ya está completo');
    return userProfile;
  } catch (error) {
    console.error('❌ Error verificando/corrigiendo perfil:', error);
    return null;
  }
};

/**
 * Elimina completamente todos los datos de un usuario
 * Esta función elimina notebooks, conceptos, sesiones de estudio, datos de aprendizaje,
 * estadísticas, límites y todas las subcolecciones relacionadas
 * También elimina la cuenta de Firebase Auth si es posible
 */
export const deleteAllUserData = async (userId: string): Promise<void> => {
  try {
    console.log('🗑️ Iniciando eliminación completa de datos para usuario:', userId);
    
    // 1. Eliminar notebooks y sus conceptos relacionados
    console.log('📚 Eliminando notebooks...');
    const notebooksQuery = query(collection(db, 'notebooks'), where('userId', '==', userId));
    const notebooksSnapshot = await getDocs(notebooksQuery);
    
    for (const notebookDoc of notebooksSnapshot.docs) {
      const notebookId = notebookDoc.id;
      console.log(`📖 Eliminando notebook: ${notebookId}`);
      
      // Eliminar conceptos asociados a este notebook
      const conceptsQuery = query(collection(db, 'conceptos'), where('cuadernoId', '==', notebookId));
      const conceptsSnapshot = await getDocs(conceptsQuery);
      
      for (const conceptDoc of conceptsSnapshot.docs) {
        console.log(`📝 Eliminando documento de conceptos: ${conceptDoc.id}`);
        await deleteDoc(conceptDoc.ref);
      }
      
      // Eliminar el notebook
      await deleteDoc(notebookDoc.ref);
    }
    
    // 2. Eliminar sesiones de estudio
    console.log('📊 Eliminando sesiones de estudio...');
    const studySessionsQuery = query(collection(db, 'studySessions'), where('userId', '==', userId));
    const studySessionsSnapshot = await getDocs(studySessionsQuery);
    
    for (const sessionDoc of studySessionsSnapshot.docs) {
      console.log(`⏱️ Eliminando sesión de estudio: ${sessionDoc.id}`);
      await deleteDoc(sessionDoc.ref);
    }
    
    // 3. Eliminar actividades de usuario
    console.log('📈 Eliminando actividades de usuario...');
    const userActivitiesQuery = query(collection(db, 'userActivities'), where('userId', '==', userId));
    const userActivitiesSnapshot = await getDocs(userActivitiesQuery);
    
    for (const activityDoc of userActivitiesSnapshot.docs) {
      console.log(`📊 Eliminando actividad: ${activityDoc.id}`);
      await deleteDoc(activityDoc.ref);
    }
    
    // 4. Eliminar conceptos de repaso
    console.log('🔄 Eliminando conceptos de repaso...');
    const reviewConceptsQuery = query(collection(db, 'reviewConcepts'), where('userId', '==', userId));
    const reviewConceptsSnapshot = await getDocs(reviewConceptsQuery);
    
    for (const reviewDoc of reviewConceptsSnapshot.docs) {
      console.log(`🔄 Eliminando concepto de repaso: ${reviewDoc.id}`);
      await deleteDoc(reviewDoc.ref);
    }
    
    // 5. Eliminar estadísticas de conceptos
    console.log('📊 Eliminando estadísticas de conceptos...');
    const conceptStatsQuery = query(collection(db, 'conceptStats'), where('userId', '==', userId));
    const conceptStatsSnapshot = await getDocs(conceptStatsQuery);
    
    for (const statDoc of conceptStatsSnapshot.docs) {
      console.log(`📊 Eliminando estadística: ${statDoc.id}`);
      await deleteDoc(statDoc.ref);
    }
    
    // 6. Eliminar subcolecciones del usuario
    console.log('🗂️ Eliminando subcolecciones del usuario...');
    
    // Eliminar datos de aprendizaje (learningData)
    const learningDataRef = collection(db, 'users', userId, 'learningData');
    const learningDataSnapshot = await getDocs(learningDataRef);
    for (const learningDoc of learningDataSnapshot.docs) {
      console.log(`🧠 Eliminando datos de aprendizaje: ${learningDoc.id}`);
      await deleteDoc(learningDoc.ref);
    }
    
    // Eliminar estadísticas de quiz (quizStats)
    const quizStatsRef = collection(db, 'users', userId, 'quizStats');
    const quizStatsSnapshot = await getDocs(quizStatsRef);
    for (const quizStatDoc of quizStatsSnapshot.docs) {
      console.log(`📝 Eliminando estadística de quiz: ${quizStatDoc.id}`);
      await deleteDoc(quizStatDoc.ref);
    }
    
    // Eliminar resultados de quiz (quizResults)
    const quizResultsRef = collection(db, 'users', userId, 'quizResults');
    const quizResultsSnapshot = await getDocs(quizResultsRef);
    for (const quizResultDoc of quizResultsSnapshot.docs) {
      console.log(`📊 Eliminando resultado de quiz: ${quizResultDoc.id}`);
      await deleteDoc(quizResultDoc.ref);
    }
    
    // Eliminar límites de estudio (limits)
    const limitsRef = collection(db, 'users', userId, 'limits');
    const limitsSnapshot = await getDocs(limitsRef);
    for (const limitDoc of limitsSnapshot.docs) {
      console.log(`⏰ Eliminando límite: ${limitDoc.id}`);
      await deleteDoc(limitDoc.ref);
    }
    
    // Eliminar límites de notebooks (notebookLimits)
    const notebookLimitsRef = collection(db, 'users', userId, 'notebookLimits');
    const notebookLimitsSnapshot = await getDocs(notebookLimitsRef);
    for (const notebookLimitDoc of notebookLimitsSnapshot.docs) {
      console.log(`📚 Eliminando límite de notebook: ${notebookLimitDoc.id}`);
      await deleteDoc(notebookLimitDoc.ref);
    }
    
    // Eliminar estadísticas del usuario (stats)
    const statsRef = collection(db, 'users', userId, 'stats');
    const statsSnapshot = await getDocs(statsRef);
    for (const statDoc of statsSnapshot.docs) {
      console.log(`📈 Eliminando estadística: ${statDoc.id}`);
      await deleteDoc(statDoc.ref);
    }
    
    // Eliminar configuraciones (settings)
    const settingsRef = collection(db, 'users', userId, 'settings');
    const settingsSnapshot = await getDocs(settingsRef);
    for (const settingDoc of settingsSnapshot.docs) {
      console.log(`⚙️ Eliminando configuración: ${settingDoc.id}`);
      await deleteDoc(settingDoc.ref);
    }
    
    // 7. Eliminar el documento principal del usuario
    console.log('👤 Eliminando documento principal del usuario...');
    const userDocRef = doc(db, 'users', userId);
    await deleteDoc(userDocRef);
    
    // 8. Eliminar de la colección de usuarios en español (si existe)
    try {
      const usuarioDocRef = doc(db, 'usuarios', userId);
      const usuarioDoc = await getDoc(usuarioDocRef);
      if (usuarioDoc.exists()) {
        console.log('👤 Eliminando documento de usuario en español...');
        await deleteDoc(usuarioDocRef);
      }
    } catch (error) {
      console.log('⚠️ No se encontró documento de usuario en español o ya fue eliminado');
    }
    
    // 9. Intentar eliminar la cuenta de Firebase Auth
    try {
      const currentUser = auth.currentUser;
      if (currentUser && currentUser.uid === userId) {
        console.log('🔐 Eliminando cuenta de Firebase Auth...');
        await deleteUser(currentUser);
        console.log('✅ Cuenta de Firebase Auth eliminada exitosamente');
      } else {
        console.log('⚠️ No se puede eliminar la cuenta de Firebase Auth (usuario no es el actual)');
      }
    } catch (authError: any) {
      console.log('⚠️ No se pudo eliminar la cuenta de Firebase Auth:', authError.message);
      console.log('ℹ️ La cuenta de Firebase Auth puede requerir re-autenticación reciente para ser eliminada');
    }
    
    console.log('✅ Eliminación completa de datos finalizada para usuario:', userId);
  } catch (error) {
    console.error('❌ Error durante la eliminación de datos del usuario:', error);
    throw new Error(`Error al eliminar datos del usuario: ${error}`);
  }
};

/**
 * Función para super admins que elimina completamente un usuario
 * Incluye eliminación de datos de Firestore y marca la cuenta de Firebase Auth para eliminación
 * NOTA: La eliminación de Firebase Auth debe hacerse desde el servidor por seguridad
 */
export const deleteUserCompletely = async (userId: string): Promise<void> => {
  try {
    console.log('👑 SuperAdmin eliminando usuario completamente:', userId);
    
    // 1. Eliminar todos los datos de Firestore
    await deleteAllUserData(userId);
    
    // 2. Crear un registro de eliminación para que el servidor procese la eliminación de Firebase Auth
    try {
      const deletionRecord = {
        userId: userId,
        deletedAt: serverTimestamp(),
        deletedBy: auth.currentUser?.uid || 'super-admin',
        status: 'pending_auth_deletion'
      };
      
      await setDoc(doc(db, 'userDeletions', userId), deletionRecord);
      console.log('📝 Registro de eliminación creado para procesamiento del servidor');
    } catch (error) {
      console.log('⚠️ No se pudo crear el registro de eliminación:', error);
    }
    
    console.log('✅ Usuario eliminado completamente por SuperAdmin');
  } catch (error) {
    console.error('❌ Error eliminando usuario completamente:', error);
    throw error;
  }
}; 