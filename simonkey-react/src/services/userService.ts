import { db, auth } from './firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { UserSubscriptionType, SchoolRole, UserProfile, SubscriptionLimits } from '../types/interfaces';
import { collection, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import { deleteBatch, deleteCollectionBatch, BatchResult } from './batchService';

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
 * Verifica si un email corresponde a un usuario escolar existente
 */
export const checkIfEmailIsSchoolUser = async (email: string): Promise<boolean> => {
  try {
    console.log('🔍 Verificando si email corresponde a usuario escolar:', email);
    const existingUserCheck = await checkUserExistsByEmail(email);
    
    if (existingUserCheck.exists) {
      console.log('✅ Usuario existente encontrado:', existingUserCheck.userType);
      
      if (existingUserCheck.userType === 'SCHOOL' || 
          existingUserCheck.userType === 'SCHOOL_TEACHER' || 
          existingUserCheck.userType === 'SCHOOL_STUDENT') {
        console.log('👨‍🎓 Email corresponde a usuario escolar');
        return true;
      }
    }
    
    console.log('❌ Email no corresponde a usuario escolar');
    return false;
  } catch (error) {
    console.error('❌ Error verificando si email es usuario escolar:', error);
    return false;
  }
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
    password?: string; // Campo opcional para contraseña, nunca requerido
  }
): Promise<void> => {
  try {
    console.log('🚀 Creando perfil de usuario:', { userId, userData });
    
    // Verificar si el email corresponde a un usuario escolar existente
    const isSchoolUser = await checkIfEmailIsSchoolUser(userData.email);
    
    let subscriptionType: UserSubscriptionType;
    if (isSchoolUser) {
      console.log('👨‍🎓 Usuario escolar detectado, asignando tipo SCHOOL');
      subscriptionType = UserSubscriptionType.SCHOOL;
    } else {
      subscriptionType = determineUserSubscription(userData.email);
    }
    
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

    // Solo agregar password si está presente
    if (userData.password) {
      userProfile.password = userData.password;
    }

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
    console.log('👑 Iniciando eliminación batch OPTIMIZADA para usuario:', userId);
    
    // 1. ELIMINAR NOTEBOOKS Y CONCEPTOS RELACIONADOS (BATCH)
    console.log('📚 Eliminando notebooks y conceptos con batch...');
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
             conceptsSnapshot.docs.forEach((conceptDoc: any) => {
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
      console.log(`📚 Eliminados ${result1.totalOperations} notebooks y conceptos en ${result1.executionTime}ms`);
    }

    // 2. ELIMINAR SESIONES DE ESTUDIO (BATCH)
    console.log('📊 Eliminando sesiones de estudio con batch...');
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
    console.log(`📊 Eliminadas ${result2.totalOperations} sesiones en ${result2.executionTime}ms`);

    // 3. ELIMINAR ACTIVIDADES DE USUARIO (BATCH)
    console.log('📈 Eliminando actividades con batch...');
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
    console.log(`📈 Eliminadas ${result3.totalOperations} actividades en ${result3.executionTime}ms`);

    // 4. ELIMINAR CONCEPTOS DE REPASO (BATCH)
    console.log('🔄 Eliminando conceptos de repaso con batch...');
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
    console.log(`🔄 Eliminados ${result4.totalOperations} conceptos de repaso en ${result4.executionTime}ms`);

    // 5. ELIMINAR ESTADÍSTICAS DE CONCEPTOS (BATCH)
    console.log('📊 Eliminando estadísticas de conceptos con batch...');
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
    console.log(`📊 Eliminadas ${result5.totalOperations} estadísticas en ${result5.executionTime}ms`);

    // 6. ELIMINAR SUBCOLECCIONES DEL USUARIO (BATCH PARALELO)
    console.log('🗂️ Eliminando subcolecciones con batch paralelo...');
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
      console.log(`🗂️ ${subcollections[index]}: ${result.totalOperations} docs en ${result.executionTime}ms`);
    });
    
    console.log(`🗂️ Total subcolecciones: ${subcollectionOps} documentos eliminados`);

    // 7. ELIMINAR DOCUMENTOS PRINCIPALES (BATCH)
    console.log('👤 Eliminando documentos principales...');
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
      console.log('⚠️ No se encontró documento de usuario en español');
    }
    
    const result7 = await deleteBatch(mainDocRefs, (completed, total) => {
      onProgress?.('Eliminando documentos principales', completed, total);
    });
    totalOperations += result7.totalOperations;
    completedOperations += result7.totalOperations;
    if (!result7.success) {
      totalErrors.push(...result7.errors);
    }
    console.log(`👤 Eliminados ${result7.totalOperations} documentos principales en ${result7.executionTime}ms`);

    // 8. INTENTAR ELIMINAR CUENTA DE FIREBASE AUTH
    console.log('🔐 Procesando eliminación de Firebase Auth...');
    onProgress?.('Eliminando cuenta de Firebase Auth', 0, 100);
    
    try {
      const currentUser = auth.currentUser;
      if (currentUser && currentUser.uid === userId) {
        await deleteUser(currentUser);
        console.log('✅ Cuenta de Firebase Auth eliminada exitosamente');
      } else {
        console.log('⚠️ No se puede eliminar la cuenta de Firebase Auth (usuario no es el actual)');
      }
    } catch (authError: any) {
      const authErrorMsg = `Error eliminando Auth: ${authError.message}`;
      console.log(`⚠️ ${authErrorMsg}`);
      console.log('ℹ️ La cuenta de Firebase Auth puede requerir re-autenticación reciente');
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
      console.log(`🎯 ✅ Eliminación BATCH COMPLETA: ${totalOperations} operaciones en ${totalTime}ms`);
      console.log(`⚡ Rendimiento: ~${Math.round(totalOperations / (totalTime / 1000))} ops/segundo`);
    } else {
      console.log(`⚠️ Eliminación completada con ${totalErrors.length} errores en ${totalTime}ms`);
      totalErrors.forEach(error => console.error('❌', error));
    }

    onProgress?.('Eliminación completada', 100, 100);
    return result;
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error('❌ Error crítico durante eliminación batch:', error);
    
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

/**
 * Verifica si ya existe un usuario con el mismo email en Firestore
 */
export const checkUserExistsByEmail = async (email: string): Promise<{ exists: boolean; userId?: string; userData?: any; userType?: string }> => {
  try {
    console.log('🔍 Verificando si existe usuario con email:', email);
    
    if (!email) {
      console.log('❌ Email vacío, no se puede verificar');
      return { exists: false };
    }
    
    // PRIMERO: Buscar en colecciones escolares (prioridad alta)
    console.log('🔍 Buscando en colección schoolStudents...');
    try {
      const studentsQuery = query(collection(db, 'schoolStudents'), where('email', '==', email));
      const studentsSnapshot = await getDocs(studentsQuery);
      console.log('🔍 Resultado búsqueda en schoolStudents:', studentsSnapshot.size, 'documentos encontrados');
      
      if (!studentsSnapshot.empty) {
        const studentDoc = studentsSnapshot.docs[0];
        const studentData = studentDoc.data();
        console.log('✅ Estudiante escolar encontrado con email:', email, 'ID:', studentDoc.id);
        console.log('✅ Datos completos del estudiante:', studentData);
        return {
          exists: true,
          userId: studentDoc.id,
          userData: studentData,
          userType: 'SCHOOL_STUDENT'
        };
      }
    } catch (studentsError) {
      console.error('❌ Error buscando en colección schoolStudents:', studentsError);
      console.log('⚠️ Posible problema de permisos en schoolStudents');
    }
    
    console.log('🔍 Buscando en colección schoolTeachers...');
    try {
      const teachersQuery = query(collection(db, 'schoolTeachers'), where('email', '==', email));
      const teachersSnapshot = await getDocs(teachersQuery);
      console.log('🔍 Resultado búsqueda en schoolTeachers:', teachersSnapshot.size, 'documentos encontrados');
      
      if (!teachersSnapshot.empty) {
        const teacherDoc = teachersSnapshot.docs[0];
        const teacherData = teacherDoc.data();
        console.log('✅ Profesor escolar encontrado con email:', email, 'ID:', teacherDoc.id);
        console.log('✅ Datos completos del profesor:', teacherData);
        return {
          exists: true,
          userId: teacherDoc.id,
          userData: teacherData,
          userType: 'SCHOOL_TEACHER'
        };
      }
    } catch (teachersError) {
      console.error('❌ Error buscando en colección schoolTeachers:', teachersError);
      console.log('⚠️ Posible problema de permisos en schoolTeachers');
    }
    
    // SEGUNDO: Buscar en la colección users por email
    console.log('🔍 Buscando en colección users...');
    try {
      const usersQuery = query(collection(db, 'users'), where('email', '==', email));
      const usersSnapshot = await getDocs(usersQuery);
      console.log('🔍 Resultado búsqueda en users:', usersSnapshot.size, 'documentos encontrados');
      
      if (!usersSnapshot.empty) {
        const userDoc = usersSnapshot.docs[0];
        const userData = userDoc.data();
        console.log('✅ Usuario encontrado en users con email:', email, 'ID:', userDoc.id, 'Tipo:', userData.subscription);
        console.log('✅ Datos completos del usuario:', userData);
        return {
          exists: true,
          userId: userDoc.id,
          userData: userData,
          userType: userData.subscription || 'FREE'
        };
      }
    } catch (usersError) {
      console.error('❌ Error buscando en colección users:', usersError);
    }
    
    console.log('❌ No se encontró usuario con email:', email);
    return { exists: false };
    
  } catch (error) {
    console.error('❌ Error verificando usuario por email:', error);
    return { exists: false };
  }
};

/**
 * Maneja el caso de un usuario existente con el mismo email
 */
export const handleExistingUserWithSameEmail = async (
  googleUser: any,
  existingUserCheck: { exists: boolean; userId?: string; userData?: any; userType?: string }
): Promise<{ shouldContinue: boolean; message?: string; useExistingUserId?: string }> => {
  try {
    console.log('🔄 Manejando usuario existente con el mismo email...');
    console.log('📧 Email del usuario de Google:', googleUser.email);
    console.log('🆔 UID del usuario de Google:', googleUser.uid);
    console.log('🔍 Usuario existente encontrado:', existingUserCheck);
    
    if (!existingUserCheck.exists || !existingUserCheck.userId || !existingUserCheck.userData) {
      console.log('✅ No hay usuario existente, continuando con creación normal');
      return { shouldContinue: true };
    }
    
    // Si el usuario existente es un usuario escolar (creado desde superAdmin)
    if (existingUserCheck.userType === 'SCHOOL' || 
        existingUserCheck.userType === 'SCHOOL_TEACHER' || 
        existingUserCheck.userType === 'SCHOOL_STUDENT') {
      
      console.log('👨‍🎓 Usuario escolar existente detectado, vinculando con Google Auth');
      
      // Verificar si ya existe un perfil en la colección users con el UID de Google Auth
      const googleUserDoc = await getDoc(doc(db, 'users', googleUser.uid));
      
      if (!googleUserDoc.exists()) {
        console.log('⚠️ No existe perfil en users con UID de Google Auth, creando...');
        
        // Crear el perfil en la colección users usando el UID de Google Auth (NO el ID del usuario escolar)
        const userData = {
          email: googleUser.email || '',
          username: existingUserCheck.userData.nombre || googleUser.displayName || '',
          nombre: existingUserCheck.userData.nombre || googleUser.displayName || '',
          displayName: existingUserCheck.userData.nombre || googleUser.displayName || '',
          birthdate: existingUserCheck.userData.birthdate || ''
        };
        
        // Usar el UID de Google Auth, NO el ID del usuario escolar
        await createUserProfile(googleUser.uid, userData);
        console.log('✅ Perfil creado en users con UID de Google Auth');
      } else {
        console.log('✅ Perfil ya existe en users con UID de Google Auth');
      }
      
      // Actualizar con información de Google Auth y vincular con el usuario escolar
      await updateDoc(doc(db, 'users', googleUser.uid), {
        googleAuthUid: googleUser.uid,
        googleAuthEmail: googleUser.email,
        googleAuthDisplayName: googleUser.displayName,
        googleAuthPhotoURL: googleUser.photoURL,
        linkedSchoolUserId: existingUserCheck.userId, // Vincular con el ID del usuario escolar
        linkedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      console.log('✅ Usuario escolar vinculado exitosamente con Google Auth');
      return { 
        shouldContinue: true, 
        message: "Cuenta vinculada exitosamente con tu cuenta escolar existente.",
        useExistingUserId: googleUser.uid // Usar el UID de Google Auth, no el ID del usuario escolar
      };
    }
    
    // Si es un usuario regular, verificar si ya tiene Google Auth vinculado
    if (existingUserCheck.userData.googleAuthUid) {
      console.log('⚠️ Usuario ya tiene Google Auth vinculado');
      
      // Si el UID vinculado es diferente al actual, hay un conflicto
      if (existingUserCheck.userData.googleAuthUid !== googleUser.uid) {
        console.log('⚠️ Conflicto: UID vinculado diferente al actual');
        return { 
          shouldContinue: false, 
          message: "Ya existe una cuenta con este email vinculada a otra cuenta de Google. Por favor, inicia sesión con tu cuenta existente." 
        };
      } else {
        console.log('✅ UID vinculado coincide, continuando...');
        return { 
          shouldContinue: true, 
          message: "Cuenta ya vinculada correctamente." 
        };
      }
    }
    
    // Si no tiene Google Auth vinculado, vincularlo
    console.log('🔗 Vinculando cuenta de Google con usuario existente...');
    const linked = await linkGoogleAccountToExistingUser(googleUser, existingUserCheck.userId, existingUserCheck.userData);
    
    if (linked) {
      console.log('✅ Cuenta vinculada exitosamente');
      return { 
        shouldContinue: true, 
        message: "Cuenta vinculada exitosamente con tu cuenta existente." 
      };
    } else {
      console.log('❌ Error vinculando cuenta');
      return { 
        shouldContinue: false, 
        message: "Error vinculando tu cuenta de Google con la cuenta existente. Por favor, contacta soporte." 
      };
    }
    
  } catch (error) {
    console.error('❌ Error manejando usuario existente:', error);
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
  googleUser: any,
  existingUserId: string,
  existingUserData: any
): Promise<boolean> => {
  try {
    console.log('🔗 Vinculando cuenta de Google con usuario existente:', existingUserId);
    
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
    
    console.log('✅ Cuenta de Google vinculada exitosamente con usuario existente');
    return true;
    
  } catch (error) {
    console.error('❌ Error vinculando cuenta de Google:', error);
    return false;
  }
}; 