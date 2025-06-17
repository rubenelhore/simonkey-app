import { db, auth } from './firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { UserSubscriptionType, SchoolRole, UserProfile, SubscriptionLimits } from '../types/interfaces';

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
        notebookCount: userData.notebookCount,
        maxNotebooks: userData.maxNotebooks
      });
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