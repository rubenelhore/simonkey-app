import { auth, db } from '../services/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { UserSubscriptionType, SchoolRole } from '../types/interfaces';

/**
 * Diagnóstico específico para usuarios schoolStudent
 */
export const diagnoseSchoolStudentIssue = async (email?: string) => {
  console.log('🔍 === DIAGNÓSTICO ESPECÍFICO PARA SCHOOL STUDENT ===');
  
  const currentUser = auth.currentUser;
  const userEmail = email || currentUser?.email;
  
  if (!userEmail) {
    console.log('❌ No hay email disponible para diagnóstico');
    return;
  }
  
  console.log('📧 Email a diagnosticar:', userEmail);
  console.log('👤 Usuario actual de Firebase Auth:', currentUser);
  
  try {
    // 1. Verificar si existe en la colección schoolStudents
    console.log('\n🔍 1. Verificando colección schoolStudents...');
    try {
      const studentsQuery = query(collection(db, 'schoolStudents'), where('email', '==', userEmail));
      const studentsSnapshot = await getDocs(studentsQuery);
      
      if (!studentsSnapshot.empty) {
        const studentDoc = studentsSnapshot.docs[0];
        const studentData = studentDoc.data();
        console.log('✅ Estudiante encontrado en schoolStudents:');
        console.log('  - ID:', studentDoc.id);
        console.log('  - Datos:', studentData);
      } else {
        console.log('❌ No se encontró estudiante en schoolStudents');
      }
    } catch (error) {
      console.error('❌ Error accediendo a schoolStudents:', error);
    }
    
    // 2. Verificar si existe en la colección users
    console.log('\n🔍 2. Verificando colección users...');
    try {
      const usersQuery = query(collection(db, 'users'), where('email', '==', userEmail));
      const usersSnapshot = await getDocs(usersQuery);
      
      if (!usersSnapshot.empty) {
        const userDoc = usersSnapshot.docs[0];
        const userData = userDoc.data();
        console.log('✅ Usuario encontrado en users:');
        console.log('  - ID:', userDoc.id);
        console.log('  - Subscription:', userData.subscription);
        console.log('  - SchoolRole:', userData.schoolRole);
        console.log('  - Datos completos:', userData);
      } else {
        console.log('❌ No se encontró usuario en users');
      }
    } catch (error) {
      console.error('❌ Error accediendo a users:', error);
    }
    
    // 3. Verificar si existe en schoolTeachers (por si acaso)
    console.log('\n🔍 3. Verificando colección schoolTeachers...');
    try {
      const teachersQuery = query(collection(db, 'schoolTeachers'), where('email', '==', userEmail));
      const teachersSnapshot = await getDocs(teachersQuery);
      
      if (!teachersSnapshot.empty) {
        const teacherDoc = teachersSnapshot.docs[0];
        const teacherData = teacherDoc.data();
        console.log('⚠️ Usuario encontrado en schoolTeachers (no debería estar aquí si es estudiante):');
        console.log('  - ID:', teacherDoc.id);
        console.log('  - Datos:', teacherData);
      } else {
        console.log('✅ No se encontró en schoolTeachers (correcto para estudiante)');
      }
    } catch (error) {
      console.error('❌ Error accediendo a schoolTeachers:', error);
    }
    
    // 4. Verificar el perfil actual si hay usuario autenticado
    if (currentUser) {
      console.log('\n🔍 4. Verificando perfil actual del usuario autenticado...');
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          console.log('✅ Perfil actual del usuario autenticado:');
          console.log('  - UID:', currentUser.uid);
          console.log('  - Subscription:', userData.subscription);
          console.log('  - SchoolRole:', userData.schoolRole);
          console.log('  - Email:', userData.email);
          console.log('  - Datos completos:', userData);
        } else {
          console.log('❌ No se encontró perfil para el UID actual:', currentUser.uid);
        }
      } catch (error) {
        console.error('❌ Error obteniendo perfil actual:', error);
      }
    }
    
    // 5. Análisis de permisos
    console.log('\n🔍 5. Análisis de permisos...');
    console.log('  - Usuario autenticado:', !!currentUser);
    console.log('  - Email verificado:', currentUser?.emailVerified);
    console.log('  - UID:', currentUser?.uid);
    
    // 6. Recomendaciones
    console.log('\n🔍 6. RECOMENDACIONES:');
    console.log('  - Si el estudiante existe en schoolStudents pero no en users:');
    console.log('    → El problema está en la vinculación de cuentas');
    console.log('  - Si el estudiante existe en users pero con schoolRole incorrecto:');
    console.log('    → El problema está en la asignación de roles');
    console.log('  - Si no existe en ninguna colección:');
    console.log('    → El estudiante no fue creado correctamente');
    console.log('  - Si hay problemas de permisos:');
    console.log('    → Revisar las reglas de Firestore');
    
  } catch (error) {
    console.error('❌ Error general en diagnóstico:', error);
  }
  
  console.log('=====================================');
};

/**
 * Función para arreglar automáticamente el problema de schoolStudent
 */
export const fixSchoolStudentIssue = async (email?: string) => {
  console.log('🔧 === ARREGLANDO PROBLEMA DE SCHOOL STUDENT ===');
  
  const currentUser = auth.currentUser;
  const userEmail = email || currentUser?.email;
  
  if (!userEmail) {
    console.log('❌ No hay email disponible para arreglar');
    return;
  }
  
  try {
    // 1. Buscar el estudiante en schoolStudents
    const studentsQuery = query(collection(db, 'schoolStudents'), where('email', '==', userEmail));
    const studentsSnapshot = await getDocs(studentsQuery);
    
    if (studentsSnapshot.empty) {
      console.log('❌ No se encontró estudiante en schoolStudents');
      return;
    }
    
    const studentDoc = studentsSnapshot.docs[0];
    const studentData = studentDoc.data();
    console.log('✅ Estudiante encontrado:', studentData);
    
    // 2. Verificar si existe en users
    const usersQuery = query(collection(db, 'users'), where('email', '==', userEmail));
    const usersSnapshot = await getDocs(usersQuery);
    
    if (usersSnapshot.empty) {
      console.log('⚠️ No se encontró en users, creando perfil...');
      
      // Crear perfil en users usando el ID del estudiante
      const { setDoc, serverTimestamp } = await import('firebase/firestore');
      
      const userProfile = {
        id: studentDoc.id,
        email: studentData.email,
        username: studentData.nombre,
        nombre: studentData.nombre,
        displayName: studentData.nombre,
        birthdate: '',
        subscription: UserSubscriptionType.SCHOOL,
        schoolRole: SchoolRole.STUDENT,
        notebookCount: 0,
        maxNotebooks: 0,
        maxConceptsPerNotebook: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        googleAuthUid: currentUser?.uid || null,
        googleAuthEmail: currentUser?.email || null,
        linkedAt: serverTimestamp()
      };
      
      await setDoc(doc(db, 'users', studentDoc.id), userProfile);
      console.log('✅ Perfil creado exitosamente en users');
      
    } else {
      console.log('✅ Usuario ya existe en users, actualizando rol...');
      
      const userDoc = usersSnapshot.docs[0];
      const userData = userDoc.data();
      
      // Actualizar el rol si es necesario
      if (userData.subscription !== UserSubscriptionType.SCHOOL || userData.schoolRole !== SchoolRole.STUDENT) {
        const { updateDoc, serverTimestamp } = await import('firebase/firestore');
        
        await updateDoc(doc(db, 'users', userDoc.id), {
          subscription: UserSubscriptionType.SCHOOL,
          schoolRole: SchoolRole.STUDENT,
          maxNotebooks: 0,
          maxConceptsPerNotebook: 0,
          updatedAt: serverTimestamp()
        });
        
        console.log('✅ Rol actualizado a SCHOOL_STUDENT');
      } else {
        console.log('✅ Rol ya está correcto');
      }
    }
    
    console.log('✅ Problema de schoolStudent arreglado');
    
  } catch (error) {
    console.error('❌ Error arreglando problema de schoolStudent:', error);
  }
};

// Exponer funciones globalmente para uso en consola
if (typeof window !== 'undefined') {
  (window as any).diagnoseSchoolStudentIssue = diagnoseSchoolStudentIssue;
  (window as any).fixSchoolStudentIssue = fixSchoolStudentIssue;
} 