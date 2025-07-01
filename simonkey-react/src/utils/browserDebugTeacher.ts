import { auth, db } from '../services/firebase';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';

// Función global para debugging desde la consola del navegador
export async function debugTeacherIssue() {
  console.log('🔍 === DIAGNÓSTICO DE PROFESOR ===');
  console.log('=====================================');
  
  try {
    const user = auth.currentUser;
    if (!user) {
      console.log('❌ No hay usuario autenticado');
      return;
    }
    
    console.log('👤 Usuario Firebase:', {
      uid: user.uid,
      email: user.email
    });
    
    // 1. Buscar el documento del usuario por email
    console.log('\n📋 Buscando documento del usuario por email...');
    const usersQuery = query(
      collection(db, 'users'),
      where('email', '==', user.email)
    );
    
    const userSnapshot = await getDocs(usersQuery);
    if (userSnapshot.empty) {
      console.log('❌ No se encontró documento de usuario con ese email');
      return;
    }
    
    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();
    const teacherId = userDoc.id;
    
    console.log('✅ Documento de usuario encontrado:', {
      documentId: teacherId,
      nombre: userData.nombre,
      subscription: userData.subscription,
      schoolRole: userData.schoolRole,
      googleAuthUid: userData.googleAuthUid
    });
    
    // 2. Verificar que es profesor
    if (userData.subscription !== 'school' || userData.schoolRole !== 'teacher') {
      console.log('❌ El usuario no es un profesor escolar');
      return;
    }
    
    // 3. Buscar materias del profesor
    console.log('\n📚 Buscando materias asignadas...');
    console.log(`🔍 Buscando con idProfesor === "${teacherId}"`);
    
    try {
      // Intentar buscar materias
      const subjectsQuery = query(
        collection(db, 'schoolSubjects'),
        where('idProfesor', '==', teacherId)
      );
      
      const subjectsSnapshot = await getDocs(subjectsQuery);
      console.log(`📊 Materias encontradas: ${subjectsSnapshot.size}`);
      
      if (subjectsSnapshot.size === 0) {
        console.log('❌ No hay materias asignadas a este profesor');
        console.log('💡 Solución: Un administrador debe asignar materias al profesor');
        
        // Verificar si hay materias con el Firebase UID
        console.log('\n🔍 Verificando si hay materias con Firebase UID...');
        const subjectsWithUIDQuery = query(
          collection(db, 'schoolSubjects'),
          where('idProfesor', '==', user.uid)
        );
        
        const subjectsWithUID = await getDocs(subjectsWithUIDQuery);
        if (subjectsWithUID.size > 0) {
          console.log(`⚠️ PROBLEMA DETECTADO: Hay ${subjectsWithUID.size} materias usando Firebase UID`);
          console.log('   Estas materias deben ser actualizadas para usar el ID del documento');
          console.log(`   Firebase UID: ${user.uid}`);
          console.log(`   Document ID: ${teacherId}`);
        }
      } else {
        const subjectIds: string[] = [];
        console.log('✅ Materias asignadas:');
        subjectsSnapshot.docs.forEach((doc, index) => {
          const data = doc.data();
          console.log(`   ${index + 1}. ${data.nombre} (ID: ${doc.id})`);
          subjectIds.push(doc.id);
        });
        
        // 4. Buscar cuadernos de las materias
        console.log('\n📓 Buscando cuadernos de las materias...');
        const notebooksQuery = query(
          collection(db, 'schoolNotebooks'),
          where('idMateria', 'in', subjectIds)
        );
        
        const notebooksSnapshot = await getDocs(notebooksQuery);
        console.log(`📊 Cuadernos encontrados: ${notebooksSnapshot.size}`);
        
        if (notebooksSnapshot.size === 0) {
          console.log('❌ Las materias no tienen cuadernos asignados');
          console.log('💡 Solución: Un administrador debe crear cuadernos para las materias');
        } else {
          console.log('✅ Cuadernos disponibles:');
          notebooksSnapshot.docs.forEach((doc, index) => {
            const data = doc.data();
            console.log(`   ${index + 1}. ${data.titulo} (Materia: ${data.idMateria})`);
          });
        }
      }
    } catch (error: any) {
      console.error('❌ Error al buscar datos:', error);
      if (error.code === 'permission-denied') {
        console.log('🔐 Error de permisos detectado');
        console.log('   Las reglas de Firestore pueden estar bloqueando el acceso');
      }
    }
    
    // 5. Resumen
    console.log('\n📊 RESUMEN:');
    console.log('=====================================');
    console.log(`✅ Usuario autenticado: ${user.email}`);
    console.log(`✅ Documento de profesor: ${teacherId}`);
    console.log(`✅ Rol: ${userData.schoolRole}`);
    console.log(`✅ Suscripción: ${userData.subscription}`);
    
    console.log('\n💡 PRÓXIMOS PASOS:');
    if (!userData.googleAuthUid || userData.googleAuthUid !== user.uid) {
      console.log('⚠️ El documento no tiene vinculado el Firebase UID correcto');
      console.log('   Esto puede causar problemas de acceso');
    }
    console.log('1. Verificar que el administrador haya asignado materias');
    console.log('2. Verificar que las materias tengan cuadernos creados');
    console.log('3. Contactar al administrador si faltan configuraciones');
    
  } catch (error) {
    console.error('❌ Error general en diagnóstico:', error);
  }
}

// Función simplificada para verificar estado
export async function checkTeacherStatusSimple() {
  const user = auth.currentUser;
  if (!user) {
    console.log('❌ No autenticado');
    return;
  }
  
  console.log('✅ Autenticado como:', user.email);
  console.log('🔍 Firebase UID:', user.uid);
  
  try {
    // Buscar documento por email
    const q = query(collection(db, 'users'), where('email', '==', user.email));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      const data = doc.data();
      console.log('✅ Documento encontrado:', doc.id);
      console.log('   Rol:', data.schoolRole);
      console.log('   Suscripción:', data.subscription);
      console.log('   Google UID:', data.googleAuthUid);
      
      if (data.subscription === 'school' && data.schoolRole === 'teacher') {
        console.log('✅ Configurado correctamente como profesor');
        console.log('💡 Si no ves cuadernos, contacta al administrador');
      }
    } else {
      console.log('❌ No se encontró documento');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Hacer las funciones disponibles globalmente
if (typeof window !== 'undefined') {
  (window as any).debugTeacherIssue = debugTeacherIssue;
  (window as any).checkTeacherStatusSimple = checkTeacherStatusSimple;
}