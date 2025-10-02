import { db, auth } from './firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { UserSubscriptionType, SchoolRole, UserProfile, SubscriptionLimits, GoogleUser, ExistingUserCheck } from '../types/interfaces';
import { collection, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import { deleteBatch, deleteCollectionBatch, BatchResult } from './batchService';
import { logger } from '../utils/logger';

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
    maxNotebooks: 1, // Límite de 1 cuaderno personal (no incluye cuadernos enrolados)
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
  [UserSubscriptionType.UNIVERSITY]: {
    maxNotebooks: -1, // Sin límite
    maxConceptsPerNotebook: -1, // Sin límite
    canDeleteAndRecreate: true,
    permissions: {
      canViewAllData: false,
      canEditAllData: false,
      canUseStudySection: false, // Los usuarios universitarios no usan el sistema de estudio
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
  logger.debug('Determinando tipo de suscripción para email:', email);
  
  // Super admin
  if (email === 'ruben.elhore@gmail.com') {
    logger.info('Usuario identificado como super admin');
    return UserSubscriptionType.SUPER_ADMIN;
  }
  
  // Por defecto, todos los usuarios nuevos son FREE
  logger.debug('Usuario asignado como FREE por defecto');
  return UserSubscriptionType.FREE;
};

/**
 * Verifica si un email corresponde a un usuario escolar existente
 */
export const checkIfEmailIsSchoolUser = async (email: string): Promise<boolean> => {
  try {
    logger.debug('Verificando si email corresponde a usuario escolar:', email);
    const existingUserCheck = await checkUserExistsByEmail(email);
    
    if (existingUserCheck.exists) {
      logger.debug('Usuario existente encontrado:', existingUserCheck.userType);
      
      if (existingUserCheck.userType === 'SCHOOL' || 
          existingUserCheck.userType === 'SCHOOL_TEACHER' || 
          existingUserCheck.userType === 'SCHOOL_STUDENT') {
        logger.info('Email corresponde a usuario escolar');
        return true;
      }
    }
    
    logger.debug('Email no corresponde a usuario escolar');
    return false;
  } catch (error) {
    logger.error('Error verificando si email es usuario escolar:', error);
    return false;
  }
};

/**
 * Obtiene los límites de suscripción para un tipo de usuario
 */
export const getSubscriptionLimits = (subscriptionType: UserSubscriptionType): SubscriptionLimits => {
  logger.debug('Obteniendo límites para tipo de suscripción:', subscriptionType);
  const limits = SUBSCRIPTION_LIMITS[subscriptionType];
  logger.debug('Límites obtenidos:', limits);
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
    password?: string; // Campo opcional para contraseña, nunca requerido
  }
): Promise<void> => {
  try {
    logger.debug('Creando perfil de usuario:', { userId, userData });
    
    // IMPORTANTE: Verificar si ya existe un usuario con este email
    const existingUserCheck = await checkUserExistsByEmail(userData.email);
    if (existingUserCheck.exists && existingUserCheck.userType?.includes('SCHOOL')) {
      logger.error('❌ INTENTO DE CREAR PERFIL DUPLICADO: Ya existe un usuario escolar con este email');
      logger.error('❌ Usuario existente:', existingUserCheck.userId);
      logger.error('❌ Tipo:', existingUserCheck.userType);
      throw new Error('Ya existe un usuario escolar con este email. Por favor, inicia sesión en lugar de crear una cuenta nueva.');
    }
    
    // Verificar si el email corresponde a un usuario escolar existente
    const isSchoolUser = await checkIfEmailIsSchoolUser(userData.email);
    
    let subscriptionType: UserSubscriptionType;
    if (isSchoolUser) {
      logger.info('Usuario escolar detectado, asignando tipo SCHOOL');
      subscriptionType = UserSubscriptionType.SCHOOL;
    } else {
      subscriptionType = determineUserSubscription(userData.email);
    }
    
    logger.debug('Tipo de suscripción determinado:', subscriptionType);
    
    const limits = getSubscriptionLimits(subscriptionType);
    logger.debug('Límites obtenidos:', limits);
    
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
      hasCompletedOnboarding: false, // Nuevo usuario debe ver el tutorial
    };

    // Solo agregar password si está presente
    if (userData.password) {
      userProfile.password = userData.password;
    }

    // Si es usuario escolar, establecer rol por defecto como estudiante
    if (subscriptionType === UserSubscriptionType.SCHOOL) {
      userProfile.schoolRole = SchoolRole.STUDENT;
    }

    logger.debug('Perfil a guardar:', userProfile);
    
    await setDoc(doc(db, 'users', userId), userProfile);
    logger.info(`Perfil de usuario creado exitosamente con tipo: ${subscriptionType}`);
  } catch (error) {
    logger.error('Error al crear perfil de usuario:', error);
    throw error;
  }
};

/**
 * Obtiene el perfil completo del usuario
 */
export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    logger.debug('Buscando perfil de usuario con ID:', userId);
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (userDoc.exists()) {
      const userData = userDoc.data() as UserProfile;
      
      // IMPORTANTE: Asegurar que el ID del documento se preserve
      // Para usuarios escolares, el ID del documento es el ID real del usuario
      userData.id = userDoc.id;
      
      logger.debug('Perfil de usuario encontrado:', userData);
      logger.debug('Detalles del perfil:', {
        id: userData.id,
        docId: userDoc.id,
        dataId: userDoc.data().id,
        email: userData.email,
        subscription: userData.subscription,
        schoolRole: userData.schoolRole,
        notebookCount: userData.notebookCount,
        maxNotebooks: userData.maxNotebooks
      });
      logger.debug('Perfil completo JSON:', JSON.stringify(userData, null, 2));
      return userData;
    }
    
    logger.warn('Documento de usuario no encontrado en Firestore');
    return null;
  } catch (error) {
    logger.error('❌ Error al obtener perfil de usuario:', error);
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
    logger.debug(`Suscripción actualizada a: ${newSubscription}`);
  } catch (error) {
    logger.error('Error al actualizar suscripción:', error);
    throw error;
  }
};

/**
 * Verifica si un usuario puede crear un nuevo cuaderno PERSONAL
 * IMPORTANTE: Solo cuenta cuadernos personales (type: 'personal')
 * Los cuadernos enrolados (de materias de profesores) NO cuentan en el límite
 */
export const canCreateNotebook = async (userId: string): Promise<{ canCreate: boolean; reason?: string }> => {
  try {
    const userProfile = await verifyAndFixUserProfile(userId);

    if (!userProfile) {
      return { canCreate: false, reason: 'Usuario no encontrado' };
    }

    const limits = getSubscriptionLimits(userProfile.subscription);

    // Super admin, school, y university siempre pueden crear
    if (userProfile.subscription === UserSubscriptionType.SUPER_ADMIN ||
        userProfile.subscription === UserSubscriptionType.SCHOOL ||
        userProfile.subscription === UserSubscriptionType.UNIVERSITY) {
      return { canCreate: true };
    }

    // Contar SOLO cuadernos personales (no enrolados)
    // Los cuadernos personales están en la colección 'notebooks' con type: 'personal' o userId matching
    const personalNotebooksQuery = query(
      collection(db, 'notebooks'),
      where('userId', '==', userId),
      where('type', '==', 'personal')
    );
    const personalNotebooksSnapshot = await getDocs(personalNotebooksQuery);
    const personalNotebookCount = personalNotebooksSnapshot.size;

    logger.debug(`Usuario ${userId} tiene ${personalNotebookCount} cuadernos personales`);

    // Verificar límite total de cuadernos PERSONALES
    if (limits.maxNotebooks !== -1 && personalNotebookCount >= limits.maxNotebooks) {
      return {
        canCreate: false,
        reason: `Alcanzaste el límite de cuadernos en Simonkey Free. Hazte Súper Simonkey para acceder al Súper Aprendizaje (y más cuadernos).`
      };
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
    logger.error('Error al verificar si puede crear cuaderno:', error);
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
    logger.error('Error al verificar si puede agregar conceptos:', error);
    return { canAdd: false, reason: 'Error interno' };
  }
};

/**
 * Incrementa el contador de cuadernos creados
 */
export const incrementNotebookCount = async (userId: string): Promise<void> => {
  try {
    logger.debug('Incrementando contador de cuadernos para usuario:', userId);
    
    const userProfile = await getUserProfile(userId);
    if (!userProfile) {
      logger.warn('No se pudo obtener el perfil del usuario para incrementar contador');
      return;
    }

    const currentCount = userProfile.notebookCount || 0;
    logger.debug('Contador actual de cuadernos:', currentCount);

    const updateData: any = {
      notebookCount: currentCount + 1,
    };

    // Incrementar contador semanal para usuarios PRO
    if (userProfile.subscription === UserSubscriptionType.PRO) {
      const currentWeeklyCount = userProfile.notebooksCreatedThisWeek || 0;
      updateData.notebooksCreatedThisWeek = currentWeeklyCount + 1;
      logger.debug('Incrementando contador semanal PRO:', currentWeeklyCount + 1);
    }

    logger.debug('Datos a actualizar:', updateData);
    
    await updateDoc(doc(db, 'users', userId), updateData);
    logger.debug('Contador de cuadernos incrementado exitosamente');
  } catch (error) {
    logger.error('Error al incrementar contador de cuadernos:', error);
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
    logger.error('Error al incrementar contador de conceptos:', error);
  }
};

/**
 * Verifica y corrige un perfil de usuario si está incompleto
 */
export const verifyAndFixUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    logger.debug('🔍 Verificando y corrigiendo perfil de usuario:', userId);
    
    const userProfile = await getUserProfile(userId);
    if (!userProfile) {
      logger.debug('❌ Usuario no encontrado');
      return null;
    }

    // Verificar si el perfil está completo
    const needsFix = !userProfile.subscription || 
                    userProfile.notebookCount === undefined || 
                    userProfile.notebookCount === null ||
                    !userProfile.maxNotebooks;

    if (needsFix) {
      logger.debug('⚠️ Perfil incompleto detectado, corrigiendo...');
      
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

      logger.debug('📝 Datos de corrección:', updateData);
      
      await updateDoc(doc(db, 'users', userId), updateData);
      
      // Retornar el perfil corregido
      const correctedProfile: UserProfile = {
        ...userProfile,
        subscription: subscriptionType,
        notebookCount: userProfile.notebookCount || 0,
        maxNotebooks: limits.maxNotebooks,
        maxConceptsPerNotebook: limits.maxConceptsPerNotebook,
        notebooksCreatedThisWeek: userProfile.notebooksCreatedThisWeek || 0,
        conceptsCreatedThisWeek: userProfile.conceptsCreatedThisWeek || 0,
        weekStartDate: userProfile.weekStartDate,
        updatedAt: userProfile.updatedAt
      };
      
      logger.debug('✅ Perfil corregido exitosamente');
      return correctedProfile;
    }

    logger.debug('✅ Perfil ya está completo');
    return userProfile;
  } catch (error) {
    logger.error('❌ Error verificando/corrigiendo perfil:', error);
    return null;
  }
};

/**
 * Elimina completamente todos los datos de un usuario usando operaciones batch optimizadas
 * Esta función elimina notebooks, conceptos, sesiones de estudio, datos de aprendizaje,
 * estadísticas, límites y todas las subcolecciones relacionadas
 * También elimina la cuenta de Firebase Auth si es posible
 * 
 * ✅ OPTIMIZADO: Usa operaciones batch para mejorar rendimiento hasta 90%
 */
export const deleteAllUserData = async (
  userId: string,
  onProgress?: (step: string, completed: number, total: number) => void
): Promise<BatchResult> => {
  const startTime = Date.now();
  const totalErrors: string[] = [];
  let totalOperations = 0;
  let completedOperations = 0;

  try {
    logger.debug('👑 Iniciando eliminación batch OPTIMIZADA para usuario:', userId);
    
    // 1. ELIMINAR NOTEBOOKS Y CONCEPTOS RELACIONADOS (BATCH)
    logger.debug('📚 Eliminando notebooks y conceptos con batch...');
    onProgress?.('Eliminando notebooks y conceptos', 0, 100);
    
    const notebooksQuery = query(collection(db, 'notebooks'), where('userId', '==', userId));
    const notebooksSnapshot = await getDocs(notebooksQuery);
    
    // Recopilar todas las referencias a eliminar
    const allDocRefs = [];
    
    // Agregar notebooks
    for (const notebookDoc of notebooksSnapshot.docs) {
      allDocRefs.push(notebookDoc.ref);
      
      // Agregar conceptos de cada notebook
      const conceptsQuery = query(collection(db, 'conceptos'), where('cuadernoId', '==', notebookDoc.id));
      const conceptsSnapshot = await getDocs(conceptsQuery);
             conceptsSnapshot.docs.forEach((conceptDoc) => {
         allDocRefs.push(conceptDoc.ref);
       });
    }
    
    // Ejecutar eliminación batch de notebooks y conceptos
    if (allDocRefs.length > 0) {
             const result1 = await deleteBatch(allDocRefs, (completed: number, total: number) => {
         onProgress?.('Eliminando notebooks y conceptos', completed, total);
       });
      totalOperations += result1.totalOperations;
      completedOperations += result1.totalOperations;
      if (!result1.success) {
        totalErrors.push(...result1.errors);
      }
      logger.debug(`📚 Eliminados ${result1.totalOperations} notebooks y conceptos en ${result1.executionTime}ms`);
    }

    // 2. ELIMINAR SESIONES DE ESTUDIO (BATCH)
    logger.debug('📊 Eliminando sesiones de estudio con batch...');
    onProgress?.('Eliminando sesiones de estudio', 0, 100);
    
    const studySessionsQuery = query(collection(db, 'studySessions'), where('userId', '==', userId));
    const result2 = await deleteCollectionBatch(studySessionsQuery, (completed, total) => {
      onProgress?.('Eliminando sesiones de estudio', completed, total);
    });
    totalOperations += result2.totalOperations;
    completedOperations += result2.totalOperations;
    if (!result2.success) {
      totalErrors.push(...result2.errors);
    }
    logger.debug(`📊 Eliminadas ${result2.totalOperations} sesiones en ${result2.executionTime}ms`);

    // 3. ELIMINAR ACTIVIDADES DE USUARIO (BATCH)
    logger.debug('📈 Eliminando actividades con batch...');
    onProgress?.('Eliminando actividades de usuario', 0, 100);
    
    const userActivitiesQuery = query(collection(db, 'userActivities'), where('userId', '==', userId));
    const result3 = await deleteCollectionBatch(userActivitiesQuery, (completed, total) => {
      onProgress?.('Eliminando actividades de usuario', completed, total);
    });
    totalOperations += result3.totalOperations;
    completedOperations += result3.totalOperations;
    if (!result3.success) {
      totalErrors.push(...result3.errors);
    }
    logger.debug(`📈 Eliminadas ${result3.totalOperations} actividades en ${result3.executionTime}ms`);

    // 4. ELIMINAR CONCEPTOS DE REPASO (BATCH)
    logger.debug('🔄 Eliminando conceptos de repaso con batch...');
    onProgress?.('Eliminando conceptos de repaso', 0, 100);
    
    const reviewConceptsQuery = query(collection(db, 'reviewConcepts'), where('userId', '==', userId));
    const result4 = await deleteCollectionBatch(reviewConceptsQuery, (completed, total) => {
      onProgress?.('Eliminando conceptos de repaso', completed, total);
    });
    totalOperations += result4.totalOperations;
    completedOperations += result4.totalOperations;
    if (!result4.success) {
      totalErrors.push(...result4.errors);
    }
    logger.debug(`🔄 Eliminados ${result4.totalOperations} conceptos de repaso en ${result4.executionTime}ms`);

    // 5. ELIMINAR ESTADÍSTICAS DE CONCEPTOS (BATCH)
    logger.debug('📊 Eliminando estadísticas de conceptos con batch...');
    onProgress?.('Eliminando estadísticas de conceptos', 0, 100);
    
    const conceptStatsQuery = query(collection(db, 'conceptStats'), where('userId', '==', userId));
    const result5 = await deleteCollectionBatch(conceptStatsQuery, (completed, total) => {
      onProgress?.('Eliminando estadísticas de conceptos', completed, total);
    });
    totalOperations += result5.totalOperations;
    completedOperations += result5.totalOperations;
    if (!result5.success) {
      totalErrors.push(...result5.errors);
    }
    logger.debug(`📊 Eliminadas ${result5.totalOperations} estadísticas en ${result5.executionTime}ms`);

    // 6. ELIMINAR SUBCOLECCIONES DEL USUARIO (BATCH PARALELO)
    logger.debug('🗂️ Eliminando subcolecciones con batch paralelo...');
    onProgress?.('Eliminando subcolecciones del usuario', 0, 100);
    
    const subcollections = [
      'learningData',
      'quizStats', 
      'quizResults',
      'limits',
      'notebookLimits',
      'stats',
      'settings'
    ];

    // Ejecutar eliminaciones de subcolecciones en paralelo
    const subcollectionPromises = subcollections.map(async (subcollectionName) => {
      const subcollectionRef = collection(db, 'users', userId, subcollectionName);
      const subcollectionQuery = query(subcollectionRef);
      return await deleteCollectionBatch(subcollectionQuery);
    });

    const subcollectionResults = await Promise.all(subcollectionPromises);
    
    let subcollectionOps = 0;
    subcollectionResults.forEach((result, index) => {
      totalOperations += result.totalOperations;
      completedOperations += result.totalOperations;
      subcollectionOps += result.totalOperations;
      if (!result.success) {
        totalErrors.push(...result.errors);
      }
      logger.debug(`🗂️ ${subcollections[index]}: ${result.totalOperations} docs en ${result.executionTime}ms`);
    });
    
    logger.debug(`🗂️ Total subcolecciones: ${subcollectionOps} documentos eliminados`);

    // 7. ELIMINAR DOCUMENTOS PRINCIPALES (BATCH)
    logger.debug('👤 Eliminando documentos principales...');
    onProgress?.('Eliminando documentos principales', 0, 100);
    
    const mainDocRefs = [doc(db, 'users', userId)];
    
    // Verificar si existe documento en español
    try {
      const usuarioDocRef = doc(db, 'usuarios', userId);
      const usuarioDoc = await getDoc(usuarioDocRef);
      if (usuarioDoc.exists()) {
        mainDocRefs.push(usuarioDocRef);
      }
    } catch (error) {
      logger.debug('⚠️ No se encontró documento de usuario en español');
    }
    
    const result7 = await deleteBatch(mainDocRefs, (completed, total) => {
      onProgress?.('Eliminando documentos principales', completed, total);
    });
    totalOperations += result7.totalOperations;
    completedOperations += result7.totalOperations;
    if (!result7.success) {
      totalErrors.push(...result7.errors);
    }
    logger.debug(`👤 Eliminados ${result7.totalOperations} documentos principales en ${result7.executionTime}ms`);

    // 8. INTENTAR ELIMINAR CUENTA DE FIREBASE AUTH
    logger.debug('🔐 Procesando eliminación de Firebase Auth...');
    onProgress?.('Eliminando cuenta de Firebase Auth', 0, 100);
    
    try {
      const currentUser = auth.currentUser;
      if (currentUser && currentUser.uid === userId) {
        await deleteUser(currentUser);
        logger.debug('✅ Cuenta de Firebase Auth eliminada exitosamente');
      } else {
        logger.debug('⚠️ No se puede eliminar la cuenta de Firebase Auth (usuario no es el actual)');
      }
    } catch (authError) {
      const authErrorMsg = `Error eliminando Auth: ${authError instanceof Error ? authError.message : 'Unknown error'}`;
      logger.debug(`⚠️ ${authErrorMsg}`);
      logger.debug('ℹ️ La cuenta de Firebase Auth puede requerir re-autenticación reciente');
      totalErrors.push(authErrorMsg);
    }

    const totalTime = Date.now() - startTime;
    const result: BatchResult = {
      success: totalErrors.length === 0,
      totalOperations,
      batchesExecuted: subcollectionResults.length + 6, // aproximado
      errors: totalErrors,
      executionTime: totalTime
    };

    if (result.success) {
      logger.debug(`🎯 ✅ Eliminación BATCH COMPLETA: ${totalOperations} operaciones en ${totalTime}ms`);
      logger.debug(`⚡ Rendimiento: ~${Math.round(totalOperations / (totalTime / 1000))} ops/segundo`);
    } else {
      logger.debug(`⚠️ Eliminación completada con ${totalErrors.length} errores en ${totalTime}ms`);
      totalErrors.forEach(error => logger.error('❌', error));
    }

    onProgress?.('Eliminación completada', 100, 100);
    return result;
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    logger.error('❌ Error crítico durante eliminación batch:', error);
    
    const errorResult: BatchResult = {
      success: false,
      totalOperations,
      batchesExecuted: 0,
      errors: [...totalErrors, `Error crítico: ${error}`],
      executionTime: totalTime
    };
    
    throw errorResult;
  }
};

/**
 * Función para super admins que elimina completamente un usuario
 * Incluye eliminación de datos de Firestore y marca la cuenta de Firebase Auth para eliminación
 * NOTA: La eliminación de Firebase Auth debe hacerse desde el servidor por seguridad
 */
export const deleteUserCompletely = async (userId: string): Promise<void> => {
  try {
    logger.debug('👑 SuperAdmin eliminando usuario completamente:', userId);
    
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
      logger.debug('📝 Registro de eliminación creado para procesamiento del servidor');
    } catch (error) {
      logger.debug('⚠️ No se pudo crear el registro de eliminación:', error);
    }
    
    logger.debug('✅ Usuario eliminado completamente por SuperAdmin');
  } catch (error) {
    logger.error('❌ Error eliminando usuario completamente:', error);
    throw error;
  }
};

/**
 * Verifica si ya existe un usuario con el mismo email en Firestore
 */
export const checkUserExistsByEmail = async (email: string): Promise<ExistingUserCheck> => {
  try {
    logger.debug('🔍 Verificando si existe usuario con email:', email);
    
    if (!email) {
      logger.debug('❌ Email vacío, no se puede verificar');
      return { exists: false };
    }
    
    // PRIMERO: Buscar en colecciones escolares (prioridad alta)
    // Buscar en la colección users por email
    logger.debug('🔍 Buscando en colección users...');
    try {
      const usersQuery = query(collection(db, 'users'), where('email', '==', email));
      const usersSnapshot = await getDocs(usersQuery);
      logger.debug(`🔍 Resultado búsqueda en users: ${usersSnapshot.size} documentos encontrados`);
      
      if (!usersSnapshot.empty) {
        const userDoc = usersSnapshot.docs[0];
        const userData = userDoc.data();
        logger.debug(`✅ Usuario encontrado con email: ${email} ID: ${userDoc.id}`);
        logger.debug('✅ Datos completos del usuario:', userData);
        
        // Determinar el tipo de usuario basado en subscription y schoolRole
        // Normalizar subscription a minúsculas para evitar problemas de case sensitivity
        const normalizedSubscription = userData.subscription?.toLowerCase() || 'free';
        let userType = normalizedSubscription.toUpperCase();
        
        // Si es un usuario escolar, usar el schoolRole para determinar el tipo específico
        if (normalizedSubscription === 'school' && userData.schoolRole) {
          const role = userData.schoolRole.toLowerCase();
          switch (role) {
            case 'student':
              userType = 'SCHOOL_STUDENT';
              break;
            case 'teacher':
              userType = 'SCHOOL_TEACHER';
              break;
            case 'admin':
              userType = 'SCHOOL_ADMIN';
              break;
            case 'tutor':
              userType = 'SCHOOL_TUTOR';
              break;
            default:
              userType = 'SCHOOL';
          }
        } else if (normalizedSubscription === 'school') {
          // Si es escolar pero no tiene rol específico
          userType = 'SCHOOL';
        }
        
        return {
          exists: true,
          userId: userDoc.id,
          userData: userData as UserProfile,
          userType: userType
        };
      }
    } catch (usersError: any) {
      // Si es un error de permisos, es porque las reglas de Firestore están evaluando funciones
      // que requieren getUserData() durante la query, lo cual falla para usuarios nuevos
      if (usersError.code === 'permission-denied' || usersError.message?.includes('Missing or insufficient permissions')) {
        logger.warn('⚠️ Error de permisos al buscar usuarios por email. Las reglas de Firestore pueden estar bloqueando la búsqueda.');
        logger.warn('⚠️ Esto puede causar que se cree una cuenta duplicada. Verificar reglas de Firestore.');
      } else {
        logger.error('❌ Error buscando en colección users:', usersError);
      }
    }
    
    logger.debug('❌ No se encontró usuario con email:', email);
    return { exists: false };
    
  } catch (error) {
    logger.error('❌ Error verificando usuario por email:', error);
    return { exists: false };
  }
};

/**
 * Maneja el caso de un usuario existente con el mismo email
 */
export const handleExistingUserWithSameEmail = async (
  googleUser: GoogleUser,
  existingUserCheck: ExistingUserCheck
): Promise<{ shouldContinue: boolean; message?: string; useExistingUserId?: string }> => {
  try {
    logger.debug('🔄 Manejando usuario existente con el mismo email...');
    logger.debug('📧 Email del usuario de Google:', googleUser.email);
    logger.debug('🆔 UID del usuario de Google:', googleUser.uid);
    logger.debug('🔍 Usuario existente encontrado:', existingUserCheck);
    
    if (!existingUserCheck.exists || !existingUserCheck.userId || !existingUserCheck.userData) {
      logger.debug('✅ No hay usuario existente, continuando con creación normal');
      return { shouldContinue: true };
    }
    
    // Si el usuario existente es un usuario escolar (creado desde superAdmin)
    if (existingUserCheck.userType === 'SCHOOL' || 
        existingUserCheck.userType === 'SCHOOL_TEACHER' || 
        existingUserCheck.userType === 'SCHOOL_STUDENT' || 
        existingUserCheck.userType === 'SCHOOL_ADMIN' || 
        existingUserCheck.userType === 'SCHOOL_TUTOR') {
      
      logger.debug('👨‍🎓 Usuario escolar existente detectado, usando el perfil existente');
      logger.debug('📋 Datos del usuario escolar:', {
        id: existingUserCheck.userId,
        email: existingUserCheck.userData.email,
        subscription: existingUserCheck.userData.subscription,
        schoolRole: existingUserCheck.userData.schoolRole
      });
      
      // Actualizar el documento EXISTENTE del usuario escolar con información de Google Auth
      try {
        await updateDoc(doc(db, 'users', existingUserCheck.userId), {
          googleAuthUid: googleUser.uid,
          googleAuthEmail: googleUser.email,
          googleAuthDisplayName: googleUser.displayName,
          googleAuthPhotoURL: googleUser.photoURL,
          lastLoginAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        logger.debug('✅ Usuario escolar actualizado con información de Google Auth');
      } catch (updateError: any) {
        // Si falla la actualización por permisos, continuamos de todos modos
        // ya que el usuario existe y queremos usar su perfil
        logger.warn('⚠️ No se pudo actualizar el usuario escolar con info de Google Auth:', updateError.message);
        logger.warn('⚠️ Continuando con el perfil escolar existente sin vincular Google Auth');
      }
      
      // IMPORTANTE: Retornar el ID del usuario escolar existente, NO el UID de Google
      return { 
        shouldContinue: true, 
        message: "Sesión iniciada exitosamente con tu cuenta escolar.",
        useExistingUserId: existingUserCheck.userId // Usar el ID del usuario escolar existente
      };
    }
    
    // Si es un usuario regular, verificar si ya tiene Google Auth vinculado
    if (existingUserCheck.userData.googleAuthUid) {
      logger.debug('⚠️ Usuario ya tiene Google Auth vinculado');
      
      // Si el UID vinculado es diferente al actual, hay un conflicto
      if (existingUserCheck.userData.googleAuthUid !== googleUser.uid) {
        logger.debug('⚠️ Conflicto: UID vinculado diferente al actual');
        return { 
          shouldContinue: false, 
          message: "Ya existe una cuenta con este email vinculada a otra cuenta de Google. Por favor, inicia sesión con tu cuenta existente." 
        };
      } else {
        logger.debug('✅ UID vinculado coincide, continuando...');
        return { 
          shouldContinue: true, 
          message: "Cuenta ya vinculada correctamente." 
        };
      }
    }
    
    // Si no tiene Google Auth vinculado, vincularlo
    logger.debug('🔗 Vinculando cuenta de Google con usuario existente...');
    const linked = await linkGoogleAccountToExistingUser(googleUser, existingUserCheck.userId, existingUserCheck.userData);
    
    if (linked) {
      logger.debug('✅ Cuenta vinculada exitosamente');
      return { 
        shouldContinue: true, 
        message: "Cuenta vinculada exitosamente con tu cuenta existente." 
      };
    } else {
      logger.debug('❌ Error vinculando cuenta');
      return { 
        shouldContinue: false, 
        message: "Error vinculando tu cuenta de Google con la cuenta existente. Por favor, contacta soporte." 
      };
    }
    
  } catch (error) {
    logger.error('❌ Error manejando usuario existente:', error);
    return { 
      shouldContinue: false, 
      message: "Error procesando tu cuenta. Por favor, intenta nuevamente." 
    };
  }
};

/**
 * Vincula una cuenta de Google Auth con un usuario existente en Firestore
 */
export const linkGoogleAccountToExistingUser = async (
  googleUser: GoogleUser,
  existingUserId: string,
  existingUserData: UserProfile
): Promise<boolean> => {
  try {
    logger.debug('🔗 Vinculando cuenta de Google con usuario existente:', existingUserId);
    
    // Actualizar el documento existente con la información de Google Auth
    const updateData = {
      googleAuthUid: googleUser.uid,
      googleAuthEmail: googleUser.email,
      googleAuthDisplayName: googleUser.displayName,
      googleAuthPhotoURL: googleUser.photoURL,
      linkedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    await updateDoc(doc(db, 'users', existingUserId), updateData);
    
    logger.debug('✅ Cuenta de Google vinculada exitosamente con usuario existente');
    return true;
    
  } catch (error) {
    logger.error('❌ Error vinculando cuenta de Google:', error);
    return false;
  }
};

/**
 * Crea un usuario universitario
 * Esta función debe ser llamada desde el panel de administración
 */
export const createUniversityUser = async (
  userData: {
    email: string;
    username: string;
    nombre: string;
    displayName: string;
    birthdate: string;
    schoolName?: string; // Nombre de la universidad
    password?: string;
  }
): Promise<{ success: boolean; userId?: string; error?: string }> => {
  try {
    logger.debug('🎓 Creando usuario universitario:', userData.email);
    
    // Verificar si ya existe un usuario con este email
    const existingUserCheck = await checkUserExistsByEmail(userData.email);
    if (existingUserCheck.exists) {
      return { 
        success: false, 
        error: 'Ya existe un usuario con este email' 
      };
    }
    
    // Generar un ID único para el usuario
    const userId = doc(collection(db, 'users')).id;
    
    // Obtener límites para usuarios university
    const limits = getSubscriptionLimits(UserSubscriptionType.UNIVERSITY);
    
    // Crear el perfil del usuario
    const userProfile: UserProfile = {
      id: userId,
      email: userData.email,
      username: userData.username,
      nombre: userData.nombre,
      displayName: userData.displayName,
      birthdate: userData.birthdate,
      createdAt: Timestamp.now(),
      subscription: UserSubscriptionType.UNIVERSITY,
      notebookCount: 0,
      maxNotebooks: limits.maxNotebooks,
      maxConceptsPerNotebook: limits.maxConceptsPerNotebook,
      schoolName: userData.schoolName,
      password: userData.password,
      requiresPasswordChange: !!userData.password, // Requerir cambio si se proporciona contraseña
      hasCompletedOnboarding: true, // Los usuarios university no necesitan onboarding
    };
    
    // Guardar el perfil en Firestore
    await setDoc(doc(db, 'users', userId), userProfile);
    
    logger.debug('✅ Usuario universitario creado exitosamente:', userId);
    return { success: true, userId };
    
  } catch (error) {
    logger.error('❌ Error creando usuario universitario:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
};

/**
 * Actualiza un usuario existente a tipo university
 */
export const updateUserToUniversity = async (
  userId: string,
  schoolName?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    logger.debug('🎓 Actualizando usuario a tipo university:', userId);
    
    // Verificar que el usuario existe
    const userProfile = await getUserProfile(userId);
    if (!userProfile) {
      return { 
        success: false, 
        error: 'Usuario no encontrado' 
      };
    }
    
    // Actualizar el tipo de suscripción
    await updateUserSubscription(userId, UserSubscriptionType.UNIVERSITY);
    
    // Actualizar información adicional si se proporciona
    if (schoolName) {
      await updateDoc(doc(db, 'users', userId), {
        schoolName: schoolName
      });
    }
    
    logger.debug('✅ Usuario actualizado a university exitosamente');
    return { success: true };
    
  } catch (error) {
    logger.error('❌ Error actualizando usuario a university:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}; 