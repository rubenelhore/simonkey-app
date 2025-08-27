import { db, auth } from '../services/firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  getDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  deleteDoc
} from 'firebase/firestore';
import { UserSubscriptionType, SchoolRole } from '../types/interfaces';
import { syncStudentSubjects } from './syncStudentSubjects';
import { testRankingSystem, testNotebookRanking } from './testRankingSystem';
import { initializeAllTeacherMetrics, checkTeacherMetricsById } from './initializeTeacherMetrics';
import { updateTeacherMetrics, updateAllTeacherMetrics, checkTeacherMetricsStatus } from './updateTeacherMetrics';
import { debugTeacherData } from './debugTeacherData';
import { debugStudentRankings } from './debugStudentRankings';
import { updateInstitutionRankings, updateAllInstitutionRankings, getInstitutionRankingStats } from './updateInstitutionRankings';
import { testUpdateKPIs } from './testUpdateKPIs';
import { createTestStudySessions } from './createTestStudySessions';
import { debugWeeklyStudyTime } from './debugWeeklyStudyTime';
import { saveCurrentPositionToHistory, getPositionHistory, initializePositionHistory } from './createPositionHistory';
import { verifyKPIsData } from './verifyKPIsData';
import { forceWeeklyTimeUpdate, updateWeeklyTimeFromSessions } from './forceWeeklyTimeUpdate';
import { updateAllStudentsWeeklyTime, quickUpdateAllWeeklyTime } from './updateAllStudentsWeeklyTime';
import { debugConceptTracking, debugSpecificSession } from './debugConceptTracking';
import { debugConceptCounting } from './debugConceptCounting';
import { debugStudySessionCompletion } from './debugStudySessionCompletion';
import { fixMissingConceptsInSessions, validateSessionConcepts } from './fixMissingConcepts';
import { debugTeacherMetrics } from './debugTeacherMetrics';
import { fixTeacherMetrics, fixCurrentTeacherMetrics } from './fixTeacherMetrics';

/**
 * Actualizar usuario actual como super admin
 * Solo funciona si el email es ruben.elhore@gmail.com
 */
export const updateCurrentUserAsSuperAdmin = async () => {
  try {
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      console.error('No hay usuario autenticado');
      return false;
    }

    if (currentUser.email !== 'ruben.elhore@gmail.com' && currentUser.email !== 'santiagoarceofel@gmail.com') {
      console.error('Solo ruben.elhore@gmail.com o santiagoarceofel@gmail.com pueden ser super admin');
      return false;
    }

    console.log('Actualizando usuario como Super Admin...');
    console.log('Usuario actual:', currentUser.email);
    console.log('UID:', currentUser.uid);
    
    // Verificar si el documento existe
    const userDocRef = doc(db, 'users', currentUser.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      console.error('Documento de usuario no encontrado');
      console.log('Intentando crear el documento de usuario...');
      
      // Crear el documento si no existe
      await setDoc(userDocRef, {
        email: currentUser.email,
        subscription: UserSubscriptionType.SUPER_ADMIN,
        maxNotebooks: -1,
        maxConceptsPerNotebook: -1,
        notebooksCreatedThisWeek: 0,
        conceptsCreatedThisWeek: 0,
        weekStartDate: new Date(),
        createdAt: serverTimestamp()
      });
      
      console.log('✅ Documento de usuario creado como Super Admin');
      console.log('Recarga la página para ver los cambios');
      return true;
    }

    const userData = userDoc.data();
    console.log('Estado actual del usuario:', {
      subscription: userData.subscription,
      email: userData.email
    });

    // Si ya es super admin, no hacer nada
    if (userData.subscription === UserSubscriptionType.SUPER_ADMIN) {
      console.log('✅ El usuario ya es Super Admin');
      return true;
    }

    // Intentar actualizar usando updateDoc primero
    try {
      await updateDoc(userDocRef, {
        subscription: UserSubscriptionType.SUPER_ADMIN,
        maxNotebooks: -1,
        maxConceptsPerNotebook: -1,
        notebooksCreatedThisWeek: 0,
        conceptsCreatedThisWeek: 0,
        weekStartDate: new Date()
      });
      
      console.log('✅ Usuario actualizado exitosamente como Super Admin');
      console.log('Recarga la página para ver los cambios');
      return true;
    } catch (updateError: any) {
      console.error('Error con updateDoc:', updateError.message);
      
      // Si updateDoc falla, intentar con setDoc
      try {
        await setDoc(userDocRef, {
          subscription: UserSubscriptionType.SUPER_ADMIN,
          maxNotebooks: -1,
          maxConceptsPerNotebook: -1,
          notebooksCreatedThisWeek: 0,
          conceptsCreatedThisWeek: 0,
          weekStartDate: new Date()
        }, { merge: true });
        
        console.log('✅ Usuario actualizado exitosamente como Super Admin (con setDoc)');
        console.log('Recarga la página para ver los cambios');
        return true;
      } catch (setError: any) {
        console.error('Error con setDoc:', setError.message);
        throw setError;
      }
    }
  } catch (error: any) {
    console.error('❌ Error actualizando usuario:', error.message);
    
    if (error.code === 'permission-denied' || error.message.includes('Missing or insufficient permissions')) {
      console.log('');
      console.log('⚠️ SOLUCIÓN: El error es de permisos de Firebase.');
      console.log('');
      console.log('Para solucionarlo, necesitas actualizar las reglas de Firestore:');
      console.log('1. Ve a Firebase Console: https://console.firebase.google.com');
      console.log('2. Selecciona tu proyecto: simonkey-5c78f');
      console.log('3. Ve a Firestore Database > Rules');
      console.log('4. Agrega esta regla temporal para tu usuario:');
      console.log('');
      console.log('```');
      console.log('// Permitir que estos usuarios específicos actualicen su propio documento');
      console.log(`allow write: if request.auth != null && request.auth.uid == resource.id && request.auth.token.email in ['ruben.elhore@gmail.com', 'santiagoarceofel@gmail.com'];`);
      console.log('```');
      console.log('');
      console.log('O usa Firebase CLI:');
      console.log(`firebase firestore:update users/UJwItor6k5gHfFgrxmFkbln15D62 --data '{"subscription":"super_admin","maxNotebooks":-1,"maxConceptsPerNotebook":-1}'`);
    }
    
    return false;
  }
};

/**
 * Crear admin faltante para casos específicos
 */
export const createMissingAdmin = async (adminId: string, adminName: string, institutionId: string) => {
  try {
    console.log('🔧 Creando admin faltante...');
    
    await setDoc(doc(db, 'schoolAdmins', adminId), {
      id: adminId,
      nombre: adminName,
      email: 'admin@escuela.edu.mx',
      password: '1234',
      idInstitucion: institutionId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    console.log('✅ Admin creado exitosamente!');
    return true;
  } catch (error) {
    console.error('❌ Error creando admin:', error);
    return false;
  }
};

/**
 * Verificar y arreglar el usuario actual si es necesario
 */
export const checkAndFixCurrentUser = async (): Promise<boolean> => {
  try {
    console.log('🔧 checkAndFixCurrentUser - Iniciando verificación...');
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('🔧 checkAndFixCurrentUser - No hay usuario autenticado');
      return false;
    }
    
    console.log(`🔧 checkAndFixCurrentUser - Verificando usuario: ${currentUser.email} (${currentUser.uid})`);
    
    // IMPORTANTE: Primero verificar si es un usuario escolar vinculado
    const { checkUserExistsByEmail } = await import('../services/userService');
    if (currentUser.email) {
      const existingCheck = await checkUserExistsByEmail(currentUser.email);
      
      if (existingCheck.exists && existingCheck.userData) {
        const isSchoolUser = existingCheck.userData.subscription === UserSubscriptionType.SCHOOL;
        
        if (isSchoolUser && existingCheck.userId) {
          console.log(`🔧 Usuario escolar detectado con ID: ${existingCheck.userId}`);
          console.log(`🔧 No es un usuario huérfano - es un usuario escolar vinculado`);
          return false; // No es huérfano, es un usuario escolar
        }
      }
    }
    
    // Si no es usuario escolar, verificar normalmente con el UID de Google
    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    
    console.log(`🔧 checkAndFixCurrentUser - Documento existe: ${userDoc.exists()}`);
    
    if (!userDoc.exists()) {
      console.log(`🔧 Usuario huérfano detectado: ${currentUser.email}`);
      // Usar la cloud function para arreglar usuarios huérfanos
      const { fixOrphanUsers } = await import('../services/firebaseFunctions');
      await fixOrphanUsers(currentUser.uid);
      return true;
    } else {
      console.log(`🔧 Usuario ya existe en Firestore: ${currentUser.email}`);
      const userData = userDoc.data();
      console.log(`🔧 Datos del usuario:`, userData);
      return false;
    }
  } catch (error) {
    console.error('Error verificando usuario actual:', error);
    return false;
  }
};

// Función global para actualizar el perfil del usuario con idNotebook
export const updateUserProfileWithNotebook = async (userId: string, notebookId: string) => {
  try {
    console.log('🔧 Actualizando perfil del usuario...');
    
    const { doc, updateDoc } = await import('../services/firebase');
    const { db } = await import('../services/firebase');
    
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      idNotebook: notebookId
    });
    
    console.log('✅ Perfil del usuario actualizado con idNotebook:', notebookId);
    return true;
  } catch (error) {
    console.error('❌ Error actualizando perfil:', error);
    return false;
  }
};

// Función global para completar el proceso de asignación de notebooks
export const completeNotebookAssignment = async (studentEmail: string) => {
  try {
    console.log('🔍 Buscando estudiante:', studentEmail);
    
    const { query, collection, where, getDocs, updateDoc, doc } = await import('../services/firebase');
    const { db } = await import('../services/firebase');
    
    // Buscar el estudiante en schoolStudents
    const studentQuery = query(
      collection(db, 'schoolStudents'),
      where('email', '==', studentEmail)
    );
    const studentSnapshot = await getDocs(studentQuery);
    
    if (studentSnapshot.empty) {
      console.log('❌ No se encontró el estudiante en schoolStudents');
      return false;
    }

    const studentData = studentSnapshot.docs[0].data();
    console.log('👨‍🎓 Estudiante encontrado:', studentData.nombre);
    console.log('📚 idNotebook:', studentData.idNotebook);

    if (!studentData.idNotebook) {
      console.log('❌ El estudiante no tiene idNotebook asignado');
      return false;
    }

    // Actualizar el perfil del usuario en users
    const userRef = doc(db, 'users', studentData.id);
    await updateDoc(userRef, {
      idNotebook: studentData.idNotebook
    });
    
    console.log('✅ Perfil del usuario actualizado con idNotebook:', studentData.idNotebook);
    console.log('💡 El estudiante puede recargar la página para ver los notebooks');
    return true;

  } catch (error) {
    console.error('❌ Error:', error);
    return false;
  }
};

// Exponer funciones globalmente para uso en consola
if (typeof window !== 'undefined') {
  (window as any).updateAsSuperAdmin = updateCurrentUserAsSuperAdmin;
  (window as any).createMissingAdmin = createMissingAdmin;
  (window as any).checkAndFixCurrentUser = checkAndFixCurrentUser;
  (window as any).updateUserProfileWithNotebook = updateUserProfileWithNotebook;
  (window as any).completeNotebookAssignment = completeNotebookAssignment;
  // (window as any).analyzeSchoolNotebooksSubjects = analyzeSchoolNotebooksSubjects; // removed
  // (window as any).assignSubjectToNotebook = assignSubjectToNotebook; // removed
  (window as any).syncStudentSubjects = syncStudentSubjects;
  // (window as any).migrateAllSchoolStudentKPIs = migrateAllSchoolStudentKPIs; // removed
  // (window as any).checkSchoolStudentsNeedingKPIs = checkSchoolStudentsNeedingKPIs; // removed
  (window as any).testRankingSystem = testRankingSystem;
  (window as any).testNotebookRanking = testNotebookRanking;
  
  // Teacher metrics functions
  (window as any).initializeAllTeacherMetrics = initializeAllTeacherMetrics;
  (window as any).checkTeacherMetricsById = checkTeacherMetricsById;
  (window as any).updateTeacherMetrics = updateTeacherMetrics;
  (window as any).updateAllTeacherMetrics = updateAllTeacherMetrics;
  (window as any).checkTeacherMetricsStatus = checkTeacherMetricsStatus;
  (window as any).debugTeacherData = debugTeacherData;
  (window as any).debugStudentRankings = debugStudentRankings;
  
  // Rankings pre-calculados
  (window as any).updateInstitutionRankings = updateInstitutionRankings;
  (window as any).updateAllInstitutionRankings = updateAllInstitutionRankings;
  (window as any).getInstitutionRankingStats = getInstitutionRankingStats;
  
  // Test KPIs update
  (window as any).testUpdateKPIs = testUpdateKPIs;
  (window as any).createTestStudySessions = createTestStudySessions;
  (window as any).debugWeeklyStudyTime = debugWeeklyStudyTime;
  (window as any).verifyKPIsData = verifyKPIsData;
  (window as any).forceWeeklyTimeUpdate = forceWeeklyTimeUpdate;
  (window as any).updateWeeklyTimeFromSessions = updateWeeklyTimeFromSessions;
  (window as any).updateAllStudentsWeeklyTime = updateAllStudentsWeeklyTime;
  (window as any).quickUpdateAllWeeklyTime = quickUpdateAllWeeklyTime;
  
  // Debug concept tracking
  (window as any).debugConceptTracking = debugConceptTracking;
  (window as any).debugSpecificSession = debugSpecificSession;
  (window as any).debugConceptCounting = debugConceptCounting;
  (window as any).debugStudySessionCompletion = debugStudySessionCompletion;
  
  // Fix missing concepts
  (window as any).fixMissingConceptsInSessions = fixMissingConceptsInSessions;
  (window as any).validateSessionConcepts = validateSessionConcepts;
  
  // Position history
  (window as any).saveCurrentPositionToHistory = saveCurrentPositionToHistory;
  (window as any).getPositionHistory = getPositionHistory;
  (window as any).initializePositionHistory = initializePositionHistory;
  
  // Función específica para el estudiante actual
  (window as any).fixCurrentStudentNotebook = async () => {
    return await completeNotebookAssignment('0161875@up.edu.mx');
  };
  
  // Función para actualizar directamente el usuario específico
  (window as any).fixUserNotebookDirect = async () => {
    return await updateUserProfileWithNotebook('u1fRjwpdmOPFTtlEUsMGiWnqwST2', '1vKFhWs3IX2AbDDt853l');
  };
  
  // Teacher metrics debugging
  (window as any).debugTeacherMetrics = debugTeacherMetrics;
  (window as any).fixTeacherMetrics = fixTeacherMetrics;
  (window as any).fixCurrentTeacherMetrics = fixCurrentTeacherMetrics;
} 