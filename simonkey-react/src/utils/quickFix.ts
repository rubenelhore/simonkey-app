import { auth, db } from '../services/firebase';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { UserSubscriptionType } from '../types/interfaces';
import { getAuth } from 'firebase/auth';
import { collection, getDocs, query, where, limit, addDoc } from 'firebase/firestore';

/**
 * Solución rápida para problemas de autenticación
 * Ejecutar en la consola del navegador: window.quickFix()
 */
export const quickFix = async () => {
  console.log('🚀 === SOLUCIÓN RÁPIDA DE AUTENTICACIÓN ===');
  
  try {
    // 1. Verificar usuario actual
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('❌ No hay usuario autenticado');
      return false;
    }
    
    console.log('👤 Usuario actual:', currentUser.email);
    
    // 2. Verificar documento en Firestore
    const userDocRef = doc(db, 'users', currentUser.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      console.log('✅ Usuario ya existe en Firestore');
      const userData = userDoc.data();
      console.log('Datos actuales:', {
        subscription: userData.subscription,
        schoolRole: userData.schoolRole,
        email: userData.email
      });
      return true;
    }
    
    // 3. Crear perfil de usuario
    console.log('⚠️ Usuario no existe en Firestore, creando perfil...');
    
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
      emailVerified: currentUser.emailVerified
    };
    
    await setDoc(userDocRef, userData);
    console.log('✅ Perfil de usuario creado exitosamente');
    console.log('Datos creados:', {
      subscription: userData.subscription,
      email: userData.email,
      maxNotebooks: userData.maxNotebooks
    });
    
    // 4. Recargar página
    console.log('🔄 Recargando página en 2 segundos...');
    setTimeout(() => {
      window.location.reload();
    }, 2000);
    
    return true;
    
  } catch (error) {
    console.error('❌ Error en solución rápida:', error);
    return false;
  }
};

// Función para diagnosticar problemas de permisos de Firestore
export async function diagnoseFirestorePermissions() {
  console.log('🔍 Diagnóstico de permisos de Firestore...');
  
  try {
    // Verificar autenticación
    const user = auth.currentUser;
    if (!user) {
      console.error('❌ Usuario no autenticado');
      return;
    }
    
    console.log('✅ Usuario autenticado:', user.uid);
    
    // Obtener perfil del usuario
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists()) {
      console.error('❌ Documento de usuario no encontrado');
      return;
    }
    
    const userData = userDoc.data();
    console.log('📋 Datos del usuario:', userData);
    
    // Verificar campos críticos
    console.log('🔍 Verificando campos críticos:');
    console.log('  - subscription:', userData.subscription);
    console.log('  - schoolRole:', userData.schoolRole);
    console.log('  - schoolId:', userData.schoolId);
    
    // Intentar acceder a schoolNotebooks
    console.log('🔍 Probando acceso a schoolNotebooks...');
    try {
      const testQuery = query(collection(db, 'schoolNotebooks'), limit(1));
      const testSnapshot = await getDocs(testQuery);
      console.log('✅ Acceso a schoolNotebooks exitoso');
      console.log('  - Documentos encontrados:', testSnapshot.size);
    } catch (error) {
      console.error('❌ Error al acceder a schoolNotebooks:', error);
    }
    
    // Intentar acceder a schoolSubjects
    console.log('🔍 Probando acceso a schoolSubjects...');
    try {
      const testQuery = query(collection(db, 'schoolSubjects'), limit(1));
      const testSnapshot = await getDocs(testQuery);
      console.log('✅ Acceso a schoolSubjects exitoso');
      console.log('  - Documentos encontrados:', testSnapshot.size);
    } catch (error) {
      console.error('❌ Error al acceder a schoolSubjects:', error);
    }
    
  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
  }
}

// Función para arreglar el perfil del usuario escolar siguiendo la jerarquía correcta
export async function fixSchoolUserProfileHierarchy() {
  console.log('🔧 Arreglando perfil de usuario escolar (jerarquía correcta)...');
  
  try {
    const user = auth.currentUser;
    if (!user) {
      console.error('❌ Usuario no autenticado');
      return;
    }
    
    console.log('👤 Usuario actual:', user.email);
    
    // 1. Buscar el profesor en schoolTeachers
    const teacherQuery = query(
      collection(db, 'schoolTeachers'),
      where('email', '==', user.email)
    );
    const teacherSnapshot = await getDocs(teacherQuery);
    
    if (teacherSnapshot.empty) {
      console.error('❌ No se encontró profesor con este email en schoolTeachers');
      return;
    }
    
    const teacherDoc = teacherSnapshot.docs[0];
    const teacherData = teacherDoc.data();
    
    console.log('👨‍🏫 Profesor encontrado:', teacherData);
    console.log('  - idAdmin:', teacherData.idAdmin);
    
    // 2. Si el profesor no tiene idAdmin, buscar un admin disponible
    let adminId = teacherData.idAdmin;
    let institutionId = '';
    
    if (!adminId || adminId === '') {
      console.log('⚠️ Profesor no tiene admin asignado, buscando admin disponible...');
      
      // Buscar admins disponibles
      const adminQuery = query(collection(db, 'schoolAdmins'));
      const adminSnapshot = await getDocs(adminQuery);
      
      if (adminSnapshot.empty) {
        console.error('❌ No hay admins disponibles en el sistema');
        return;
      }
      
      // Usar el primer admin disponible
      const firstAdmin = adminSnapshot.docs[0];
      adminId = firstAdmin.id;
      const adminData = firstAdmin.data();
      institutionId = adminData.idInstitucion || '';
      
      console.log('✅ Admin asignado:', adminData.nombre);
      console.log('  - Admin ID:', adminId);
      console.log('  - Institution ID:', institutionId);
      
      // Actualizar el profesor con el admin asignado
      await updateDoc(doc(db, 'schoolTeachers', teacherDoc.id), {
        idAdmin: adminId,
        updatedAt: serverTimestamp()
      });
      
      console.log('✅ Profesor actualizado con admin asignado');
    } else {
      // 3. Si tiene admin, obtener la institución
      const adminDoc = await getDoc(doc(db, 'schoolAdmins', adminId));
      if (adminDoc.exists()) {
        const adminData = adminDoc.data();
        institutionId = adminData.idInstitucion || '';
        console.log('🏫 Institución del admin:', institutionId);
      }
    }
    
    // 4. Actualizar perfil del usuario
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      subscription: 'school',
      schoolRole: 'teacher',
      schoolId: institutionId, // Usar el ID de la institución
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Perfil de usuario actualizado correctamente');
    console.log('  - subscription: school');
    console.log('  - schoolRole: teacher');
    console.log('  - schoolId (institution):', institutionId);
    
    // Recargar la página para aplicar cambios
    setTimeout(() => {
      window.location.reload();
    }, 1000);
    
  } catch (error) {
    console.error('❌ Error al arreglar perfil:', error);
  }
}

// Función para diagnosticar la jerarquía completa
export async function diagnoseSchoolHierarchy() {
  console.log('🔍 Diagnóstico de jerarquía escolar...');
  
  try {
    const user = auth.currentUser;
    if (!user) {
      console.error('❌ Usuario no autenticado');
      return;
    }
    
    console.log('👤 Usuario:', user.email);
    
    // 1. Verificar en schoolTeachers
    const teacherQuery = query(
      collection(db, 'schoolTeachers'),
      where('email', '==', user.email)
    );
    const teacherSnapshot = await getDocs(teacherQuery);
    
    if (teacherSnapshot.empty) {
      console.log('❌ No encontrado en schoolTeachers');
      return;
    }
    
    const teacherData = teacherSnapshot.docs[0].data();
    console.log('👨‍🏫 Profesor:', teacherData);
    
    // 2. Verificar admin
    if (teacherData.idAdmin) {
      const adminDoc = await getDoc(doc(db, 'schoolAdmins', teacherData.idAdmin));
      if (adminDoc.exists()) {
        const adminData = adminDoc.data();
        console.log('👨‍💼 Admin:', adminData);
        
        // 3. Verificar institución
        if (adminData.idInstitucion) {
          const institutionDoc = await getDoc(doc(db, 'schoolInstitutions', adminData.idInstitucion));
          if (institutionDoc.exists()) {
            const institutionData = institutionDoc.data();
            console.log('🏫 Institución:', institutionData);
          } else {
            console.log('❌ Institución no encontrada');
          }
        } else {
          console.log('⚠️ Admin no tiene institución asignada');
        }
      } else {
        console.log('❌ Admin no encontrado');
      }
    } else {
      console.log('⚠️ Profesor no tiene admin asignado');
    }
    
  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
  }
}

// Función para diagnosticar específicamente el problema de SchoolNotebookDetail
export async function diagnoseSchoolNotebookDetailPermissions() {
  console.log('🔍 Diagnóstico específico de permisos para SchoolNotebookDetail...');
  
  try {
    const user = auth.currentUser;
    if (!user) {
      console.error('❌ Usuario no autenticado');
      return;
    }
    
    console.log('👤 Usuario autenticado:', user.uid);
    
    // 1. Verificar perfil del usuario
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists()) {
      console.error('❌ Documento de usuario no encontrado');
      return;
    }
    
    const userData = userDoc.data();
    console.log('📋 Perfil del usuario:', userData);
    
    // 2. Verificar si cumple con isSchoolUser()
    const isSchoolUser = userData.subscription === UserSubscriptionType.SCHOOL;
    console.log('🔍 Verificación isSchoolUser():', isSchoolUser);
    
    // 3. Intentar acceder a un documento específico de schoolNotebooks
    console.log('🔍 Probando acceso a un documento específico de schoolNotebooks...');
    
    // Primero, obtener la lista de cuadernos disponibles
    const notebooksQuery = query(collection(db, 'schoolNotebooks'), limit(1));
    const notebooksSnapshot = await getDocs(notebooksQuery);
    
    if (notebooksSnapshot.empty) {
      console.log('⚠️ No hay cuadernos disponibles para probar');
      return;
    }
    
    const testNotebookId = notebooksSnapshot.docs[0].id;
    console.log('📚 Probando acceso al cuaderno:', testNotebookId);
    
    try {
      const notebookDoc = await getDoc(doc(db, 'schoolNotebooks', testNotebookId));
      if (notebookDoc.exists()) {
        console.log('✅ Acceso exitoso al cuaderno específico');
        console.log('📋 Datos del cuaderno:', notebookDoc.data());
      } else {
        console.log('⚠️ Cuaderno no encontrado (pero acceso permitido)');
      }
    } catch (error) {
      console.error('❌ Error al acceder al cuaderno específico:', error);
    }
    
    // 4. Verificar la función isSchoolUser en las reglas
    console.log('🔍 Verificando función isSchoolUser en reglas...');
    console.log('  - subscription:', userData.subscription);
    console.log('  - schoolRole:', userData.schoolRole);
    console.log('  - schoolId:', userData.schoolId);
    
    // 5. Probar acceso a conceptos escolares también
    console.log('🔍 Probando acceso a schoolConcepts...');
    try {
      const conceptsQuery = query(collection(db, 'schoolConcepts'), limit(1));
      const conceptsSnapshot = await getDocs(conceptsQuery);
      console.log('✅ Acceso a schoolConcepts exitoso');
      console.log('  - Conceptos escolares encontrados:', conceptsSnapshot.size);
    } catch (error) {
      console.error('❌ Error al acceder a schoolConcepts:', error);
    }
    
  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
  }
}

// Función para forzar la actualización del perfil del usuario
export async function forceUpdateUserProfile() {
  console.log('🔧 Forzando actualización del perfil del usuario...');
  
  try {
    const user = auth.currentUser;
    if (!user) {
      console.error('❌ Usuario no autenticado');
      return;
    }
    
    // Obtener datos actuales
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists()) {
      console.error('❌ Documento de usuario no encontrado');
      return;
    }
    
    const userData = userDoc.data();
    console.log('📋 Perfil actual:', userData);
    
    // Forzar actualización con todos los campos necesarios
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      subscription: 'school',
      schoolRole: 'teacher',
      schoolId: userData.schoolId || '',
      updatedAt: serverTimestamp(),
      // Asegurar que todos los campos estén presentes
      email: user.email || '',
      displayName: user.displayName || userData.displayName || '',
      username: userData.username || user.displayName || '',
      nombre: userData.nombre || user.displayName || ''
    });
    
    console.log('✅ Perfil forzado actualizado');
    
    // Recargar la página
    setTimeout(() => {
      window.location.reload();
    }, 1000);
    
  } catch (error) {
    console.error('❌ Error al forzar actualización:', error);
  }
}

// Función para verificar conceptos vinculados a schoolNotebooks
export async function checkSchoolConcepts() {
  console.log('🔍 Verificando conceptos escolares...');
  
  try {
    // 1. Obtener un schoolNotebook para usar como referencia
    const notebooksQuery = query(collection(db, 'schoolNotebooks'), limit(1));
    const notebooksSnapshot = await getDocs(notebooksQuery);
    
    if (notebooksSnapshot.empty) {
      console.log('⚠️ No hay schoolNotebooks disponibles');
      return;
    }
    
    const schoolNotebookId = notebooksSnapshot.docs[0].id;
    console.log('📚 SchoolNotebook ID:', schoolNotebookId);
    
    // 2. Buscar conceptos escolares vinculados a este schoolNotebook
    const conceptsQuery = query(
      collection(db, 'schoolConcepts'),
      where('cuadernoId', '==', schoolNotebookId)
    );
    
    try {
      const conceptsSnapshot = await getDocs(conceptsQuery);
      console.log('📝 Conceptos escolares encontrados:', conceptsSnapshot.size);
      
      if (!conceptsSnapshot.empty) {
        const conceptData = conceptsSnapshot.docs[0].data();
        console.log('📋 Datos del concepto escolar:', conceptData);
        console.log('🔗 cuadernoId del concepto:', conceptData.cuadernoId);
        
        // 3. Verificar si el schoolNotebook existe
        const notebookDoc = await getDoc(doc(db, 'schoolNotebooks', conceptData.cuadernoId));
        console.log('✅ SchoolNotebook existe:', notebookDoc.exists());
      }
    } catch (error) {
      console.error('❌ Error al buscar conceptos escolares:', error);
    }
    
    // 4. Probar acceso directo a conceptos escolares
    console.log('🔍 Probando acceso directo a schoolConcepts...');
    const allConceptsQuery = query(collection(db, 'schoolConcepts'), limit(1));
    
    try {
      const allConceptsSnapshot = await getDocs(allConceptsQuery);
      if (!allConceptsSnapshot.empty) {
        const conceptId = allConceptsSnapshot.docs[0].id;
        const conceptData = allConceptsSnapshot.docs[0].data();
        console.log('📝 Concepto escolar encontrado:', conceptId);
        console.log('📋 Datos:', conceptData);
        
        // Intentar acceder directamente al concepto
        const conceptDoc = await getDoc(doc(db, 'schoolConcepts', conceptId));
        console.log('✅ Acceso directo exitoso:', conceptDoc.exists());
      }
    } catch (error) {
      console.error('❌ Error en acceso directo:', error);
    }
    
  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

// Función para migrar conceptos existentes a schoolConcepts
export async function migrateConceptsToSchoolConcepts() {
  console.log('🔄 Migrando conceptos a schoolConcepts...');
  
  try {
    // 1. Obtener todos los conceptos existentes
    const conceptsQuery = query(collection(db, 'conceptos'));
    const conceptsSnapshot = await getDocs(conceptsQuery);
    
    console.log(`📝 Encontrados ${conceptsSnapshot.size} conceptos para migrar`);
    
    let migrated = 0;
    let errors = 0;
    
    for (const conceptDoc of conceptsSnapshot.docs) {
      try {
        const conceptData = conceptDoc.data();
        
        // 2. Verificar si el cuadernoId corresponde a un schoolNotebook
        const notebookDoc = await getDoc(doc(db, 'schoolNotebooks', conceptData.cuadernoId));
        
        if (notebookDoc.exists()) {
          // 3. Crear el concepto en schoolConcepts
          await addDoc(collection(db, 'schoolConcepts'), {
            ...conceptData,
            migradoDesde: conceptDoc.id,
            migradoEn: serverTimestamp()
          });
          
          console.log(`✅ Concepto migrado: ${conceptDoc.id} -> schoolConcepts`);
          migrated++;
        } else {
          console.log(`⚠️ Concepto ${conceptDoc.id} no vinculado a schoolNotebook, saltando`);
        }
        
      } catch (error) {
        console.error(`❌ Error migrando concepto ${conceptDoc.id}:`, error);
        errors++;
      }
    }
    
    console.log(`🎯 Migración completada: ${migrated} migrados, ${errors} errores`);
    
  } catch (error) {
    console.error('❌ Error en migración:', error);
  }
}

// Función para crear un concepto escolar de prueba
export async function createTestSchoolConcept() {
  console.log('🔧 Creando concepto escolar de prueba...');
  
  try {
    // 1. Obtener un schoolNotebook
    const notebooksQuery = query(collection(db, 'schoolNotebooks'), limit(1));
    const notebooksSnapshot = await getDocs(notebooksQuery);
    
    if (notebooksSnapshot.empty) {
      console.error('❌ No hay schoolNotebooks disponibles');
      return;
    }
    
    const schoolNotebookId = notebooksSnapshot.docs[0].id;
    console.log('📚 Usando schoolNotebook:', schoolNotebookId);
    
    // 2. Crear un concepto escolar de prueba
    const testConcept = {
      cuadernoId: schoolNotebookId,
      usuarioId: auth.currentUser?.uid || '',
      conceptos: [
        {
          id: '1',
          término: 'Concepto Escolar de Prueba',
          definición: 'Este es un concepto escolar de prueba para verificar permisos',
          fuente: 'Manual'
        }
      ],
      creadoEn: serverTimestamp()
    };
    
    // 3. Agregar el concepto a schoolConcepts
    const conceptRef = await addDoc(collection(db, 'schoolConcepts'), testConcept);
    console.log('✅ Concepto escolar de prueba creado:', conceptRef.id);
    
    // 4. Verificar acceso
    const conceptDoc = await getDoc(conceptRef);
    console.log('✅ Acceso verificado:', conceptDoc.exists());
    
  } catch (error) {
    console.error('❌ Error creando concepto escolar de prueba:', error);
  }
}

// 🔍 Función para diagnosticar acceso a SchoolNotebookDetail
export const diagnoseSchoolNotebookDetailAccess = async () => {
  console.log('🔍 === DIAGNÓSTICO DE ACCESO A SCHOOL NOTEBOOK DETAIL ===');
  
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      console.log('❌ No hay usuario autenticado');
      return;
    }
    
    console.log('✅ Usuario autenticado:', user.email);
    
    // Obtener perfil del usuario
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists()) {
      console.log('❌ Perfil de usuario no encontrado');
      return;
    }
    
    const userProfile = userDoc.data();
    console.log('✅ Perfil de usuario:', userProfile);
    
    // Verificar si es usuario escolar
    if (userProfile.subscription !== 'school') {
      console.log('❌ Usuario no es escolar');
      return;
    }
    
    console.log('✅ Usuario es escolar con rol:', userProfile.schoolRole);
    
    // Verificar schoolId
    if (!userProfile.schoolId) {
      console.log('❌ schoolId no configurado');
      return;
    }
    
    console.log('✅ schoolId configurado:', userProfile.schoolId);
    
    // Verificar acceso a schoolNotebooks
    try {
      const notebooksQuery = query(
        collection(db, 'schoolNotebooks'),
        where('idMateria', 'in', ['7Gudhk8KYQaZ9YJa5wyt']) // Usar el ID de materia que sabemos que existe
      );
      
      const notebooksSnapshot = await getDocs(notebooksQuery);
      console.log('✅ Acceso a schoolNotebooks:', notebooksSnapshot.size, 'cuadernos encontrados');
      
      if (notebooksSnapshot.size > 0) {
        const notebook = notebooksSnapshot.docs[0];
        console.log('📚 Cuaderno de prueba:', notebook.id, notebook.data());
        
        // Verificar acceso a schoolConcepts para este cuaderno
        try {
          const conceptsQuery = query(
            collection(db, 'schoolConcepts'),
            where('idNotebook', '==', notebook.id)
          );
          
          const conceptsSnapshot = await getDocs(conceptsQuery);
          console.log('✅ Acceso a schoolConcepts:', conceptsSnapshot.size, 'conceptos encontrados');
          
          if (conceptsSnapshot.size > 0) {
            console.log('📖 Concepto de prueba:', conceptsSnapshot.docs[0].id, conceptsSnapshot.docs[0].data());
          }
          
        } catch (conceptsError) {
          console.log('❌ Error accediendo a schoolConcepts:', conceptsError);
        }
      }
      
    } catch (notebooksError) {
      console.log('❌ Error accediendo a schoolNotebooks:', notebooksError);
    }
    
    console.log('🔍 === FIN DEL DIAGNÓSTICO ===');
    
  } catch (error) {
    console.log('❌ Error en diagnóstico:', error);
  }
};

// 🔧 Función para crear un concepto escolar de prueba manualmente
export const createTestSchoolConceptManual = async () => {
  console.log('🔧 Creando concepto escolar de prueba manualmente...');
  
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      console.error('❌ No hay usuario autenticado');
      return;
    }
    
    // 1. Obtener un schoolNotebook
    const notebooksQuery = query(collection(db, 'schoolNotebooks'), limit(1));
    const notebooksSnapshot = await getDocs(notebooksQuery);
    
    if (notebooksSnapshot.empty) {
      console.error('❌ No hay schoolNotebooks disponibles');
      return;
    }
    
    const schoolNotebookId = notebooksSnapshot.docs[0].id;
    console.log('📚 Usando schoolNotebook:', schoolNotebookId);
    
    // 2. Crear un concepto escolar de prueba manual
    const testConcept = {
      cuadernoId: schoolNotebookId,
      usuarioId: user.uid,
      conceptos: [
        {
          id: `manual_test_${Date.now()}`,
          término: 'Concepto Escolar Manual de Prueba',
          definición: 'Este es un concepto escolar creado manualmente para verificar que la funcionalidad funciona correctamente',
          fuente: 'Manual',
          ejemplos: ['Ejemplo 1', 'Ejemplo 2'],
          importancia: 'Importante para verificar el sistema'
        }
      ],
      creadoEn: serverTimestamp()
    };
    
    // 3. Agregar el concepto a schoolConcepts
    const conceptRef = await addDoc(collection(db, 'schoolConcepts'), testConcept);
    console.log('✅ Concepto escolar manual creado:', conceptRef.id);
    
    // 4. Verificar acceso
    const conceptDoc = await getDoc(conceptRef);
    console.log('✅ Acceso verificado:', conceptDoc.exists());
    
    return conceptRef.id;
    
  } catch (error) {
    console.error('❌ Error creando concepto escolar manual:', error);
  }
};

// Función para diagnosticar y arreglar el tipo de suscripción
export const fixUserSubscription = async () => {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.error('❌ No hay usuario autenticado');
      return;
    }

    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists()) {
      console.error('❌ Documento de usuario no encontrado');
      return;
    }

    const userData = userDoc.data();
    console.log('📊 Datos actuales del usuario:', {
      subscription: userData.subscription,
      subscriptionType: userData.subscriptionType,
      userType: userData.userType,
      schoolId: userData.schoolId
    });

    // Verificar si necesita corrección
    if (userData.subscription === UserSubscriptionType.SCHOOL && userData.subscriptionType !== 'SCHOOL') {
      console.log('🔧 Corrigiendo tipo de suscripción...');
      await updateDoc(doc(db, 'users', user.uid), {
        subscriptionType: 'SCHOOL'
      });
      console.log('✅ Tipo de suscripción corregido a SCHOOL');
    } else {
      console.log('✅ Tipo de suscripción ya está correcto');
    }

    // Verificar límites
    const limits = {
      FREE: { dailyGeminiCalls: 50, maxConceptsPerFile: 20 },
      PRO: { dailyGeminiCalls: 200, maxConceptsPerFile: 50 },
      SCHOOL: { dailyGeminiCalls: 500, maxConceptsPerFile: 100 }
    };

    const currentSubscription = userData.subscriptionType || userData.subscription || 'FREE';
    const currentLimits = limits[currentSubscription as keyof typeof limits] || limits.FREE;
    
    console.log('📋 Límites actuales:', {
      subscription: currentSubscription,
      limits: currentLimits
    });

  } catch (error) {
    console.error('❌ Error arreglando suscripción:', error);
  }
};

/**
 * Función específica para arreglar el problema del profesor que no puede ver sus cuadernos
 */
export const fixTeacherNotebooksIssue = async () => {
  console.log('🔧 === ARREGLANDO PROBLEMA DE PROFESOR ===');
  
  try {
    const { getAuth } = await import('firebase/auth');
    const { db } = await import('../services/firebase');
    const { collection, query, where, getDocs, doc, setDoc, serverTimestamp } = await import('firebase/firestore');
    const { UserSubscriptionType } = await import('../types/interfaces');
    
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      console.log('❌ No hay usuario autenticado');
      return;
    }
    
    console.log('👤 Usuario:', user.uid);
    console.log('📧 Email:', user.email);
    
    // 1. Verificar si ya existe en schoolTeachers
    const teacherQuery = query(
      collection(db, 'schoolTeachers'),
      where('id', '==', user.uid)
    );
    const teacherSnapshot = await getDocs(teacherQuery);
    
    if (teacherSnapshot.empty) {
      console.log('🔄 Creando registro en schoolTeachers...');
      
      // Crear registro en schoolTeachers usando el ID del usuario como ID del documento
      // Esto debería funcionar porque las reglas permiten create si request.auth.uid == teacherId
      await setDoc(doc(db, 'schoolTeachers', user.uid), {
        id: user.uid,
        nombre: user.displayName || 'Profesor',
        email: user.email,
        password: '1234',
        subscription: UserSubscriptionType.SCHOOL,
        idAdmin: '', // Se asignará después por un admin
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      console.log('✅ Registro creado en schoolTeachers');
      console.log('🎉 PASO 1 COMPLETADO - Recarga la página para ver si se resuelve el problema');
      
      // Intentar crear materia y cuaderno si es posible
      try {
        console.log('🔄 Intentando crear materia y cuaderno de prueba...');
        
        const { addDoc } = await import('firebase/firestore');
        
        // Crear materia de prueba
        const subjectData = {
          nombre: 'Materia de Prueba',
          idProfesor: user.uid,
          idMateria: `materia_${user.uid}_${Date.now()}`,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        const subjectRef = await addDoc(collection(db, 'schoolSubjects'), subjectData);
        console.log('✅ Materia creada:', subjectRef.id);
        
        // Crear cuaderno de prueba
        const notebookData = {
          title: 'Cuaderno de Prueba',
          description: 'Cuaderno creado automáticamente para pruebas',
          idMateria: subjectData.idMateria,
          color: '#6147FF',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        const notebookRef = await addDoc(collection(db, 'schoolNotebooks'), notebookData);
        console.log('✅ Cuaderno creado:', notebookRef.id);
        
        console.log('🎉 PROBLEMA COMPLETAMENTE SOLUCIONADO - Recarga la página para ver los cambios');
        
      } catch (additionalError) {
        console.log('⚠️ No se pudieron crear materia y cuaderno:', additionalError);
        console.log('💡 El registro en schoolTeachers se creó correctamente');
        console.log('💡 Contacta al administrador para asignar materias y cuadernos');
      }
      
    } else {
      console.log('✅ Usuario ya existe en schoolTeachers');
      console.log('💡 El problema podría estar en la asignación de materias o cuadernos');
    }
    
  } catch (error) {
    console.error('❌ Error arreglando problema:', error);
    
    // Si todo falla, mostrar instrucciones manuales
    console.log('💡 SOLUCIÓN MANUAL:');
    console.log('1. Contacta al administrador del sistema');
    console.log('2. Pídele que ejecute la función de migración desde el panel de administración');
    console.log('3. O solicita que te asigne manualmente a una materia con cuadernos');
  }
};

/**
 * Función de prueba simple para verificar el estado del profesor
 */
export const testTeacherStatus = async () => {
  console.log('🔍 === VERIFICANDO ESTADO DEL PROFESOR ===');
  
  try {
    const { getAuth } = await import('firebase/auth');
    const { db } = await import('../services/firebase');
    const { collection, query, where, getDocs } = await import('firebase/firestore');
    
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      console.log('❌ No hay usuario autenticado');
      return;
    }
    
    console.log('👤 Usuario:', user.uid);
    console.log('📧 Email:', user.email);
    
    // Verificar si existe en schoolTeachers
    const teacherQuery = query(
      collection(db, 'schoolTeachers'),
      where('id', '==', user.uid)
    );
    const teacherSnapshot = await getDocs(teacherQuery);
    
    if (teacherSnapshot.empty) {
      console.log('❌ Usuario NO existe en schoolTeachers');
      console.log('💡 Ejecuta: window.fixTeacherNotebooksIssue()');
    } else {
      console.log('✅ Usuario SÍ existe en schoolTeachers');
      const teacherData = teacherSnapshot.docs[0].data();
      console.log('📋 Datos:', teacherData);
    }
    
  } catch (error) {
    console.error('❌ Error verificando estado:', error);
  }
};

/**
 * Función muy simple para verificar el estado del profesor sin acceder a Firestore
 */
export const checkTeacherStatusSimple = async () => {
  console.log('🔍 === VERIFICACIÓN SIMPLE DEL PROFESOR ===');
  
  try {
    const { getAuth } = await import('firebase/auth');
    
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      console.log('❌ No hay usuario autenticado');
      return;
    }
    
    console.log('👤 Usuario:', user.uid);
    console.log('📧 Email:', user.email);
    console.log('👤 Display Name:', user.displayName);
    
    // Verificar si el usuario tiene los datos básicos necesarios
    if (user.email && user.displayName) {
      console.log('✅ Usuario tiene datos básicos correctos');
      console.log('💡 El usuario debería estar funcionando correctamente');
      console.log('💡 Si no ves cuadernos, es porque:');
      console.log('   - No tienes materias asignadas');
      console.log('   - Las materias no tienen cuadernos');
      console.log('   - Necesitas que un administrador complete la configuración');
    } else {
      console.log('⚠️ Usuario falta datos básicos');
    }
    
    console.log('🎯 RECOMENDACIÓN: Recarga la página para ver si aparecen los cuadernos');
    
  } catch (error) {
    console.error('❌ Error en verificación simple:', error);
  }
};

/**
 * Verificar cuadernos escolares específicamente
 */
export const checkTeacherNotebooks = async () => {
  console.log('🔍 === VERIFICACIÓN DE CUADERNOS ESCOLARES ===');
  
  try {
    const { getAuth } = await import('firebase/auth');
    const { getFirestore, collection, query, where, getDocs } = await import('firebase/firestore');
    
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;
    
    if (!user) {
      console.log('❌ No hay usuario autenticado');
      return;
    }
    
    console.log('👤 Usuario:', user.uid);
    console.log('📧 Email:', user.email);
    
    // 1. Verificar si el profesor existe en schoolTeachers
    console.log('\n📋 1. Verificando registro en schoolTeachers...');
    try {
      const teacherQuery = query(
        collection(db, 'schoolTeachers'),
        where('id', '==', user.uid)
      );
      const teacherSnapshot = await getDocs(teacherQuery);
      
      if (teacherSnapshot.empty) {
        console.log('❌ No se encontró registro en schoolTeachers');
        console.log('💡 Esto puede explicar por qué no ves cuadernos');
      } else {
        console.log('✅ Registro encontrado en schoolTeachers');
        const teacherData = teacherSnapshot.docs[0].data();
        console.log('📋 Datos del profesor:', teacherData);
      }
    } catch (error) {
      console.log('⚠️ Error al verificar schoolTeachers:', error);
    }
    
    // 2. Verificar materias asignadas al profesor
    console.log('\n📚 2. Verificando materias asignadas...');
    try {
      const subjectQuery = query(
        collection(db, 'schoolSubjects'),
        where('idProfesor', '==', user.uid)
      );
      const subjectSnapshot = await getDocs(subjectQuery);
      
      if (subjectSnapshot.empty) {
        console.log('❌ No se encontraron materias asignadas');
        console.log('💡 Este es el problema: no tienes materias asignadas');
      } else {
        console.log(`✅ Se encontraron ${subjectSnapshot.size} materias asignadas:`);
        subjectSnapshot.forEach(doc => {
          const data = doc.data();
          console.log(`   - ${data.nombre} (ID: ${doc.id})`);
        });
      }
    } catch (error) {
      console.log('⚠️ Error al verificar materias:', error);
    }
    
    // 3. Verificar cuadernos escolares
    console.log('\n📖 3. Verificando cuadernos escolares...');
    try {
      const notebookQuery = query(collection(db, 'schoolNotebooks'));
      const notebookSnapshot = await getDocs(notebookQuery);
      
      if (notebookSnapshot.empty) {
        console.log('❌ No hay cuadernos escolares en el sistema');
      } else {
        console.log(`✅ Hay ${notebookSnapshot.size} cuadernos escolares en el sistema:`);
        notebookSnapshot.forEach(doc => {
          const data = doc.data();
          console.log(`   - ${data.title} (Materia: ${data.idMateria})`);
        });
      }
    } catch (error) {
      console.log('⚠️ Error al verificar cuadernos:', error);
    }
    
    // 4. Verificar cuadernos específicos del profesor
    console.log('\n🎯 4. Verificando cuadernos específicos del profesor...');
    try {
      // Primero obtener las materias del profesor
      const subjectQuery = query(
        collection(db, 'schoolSubjects'),
        where('idProfesor', '==', user.uid)
      );
      const subjectSnapshot = await getDocs(subjectQuery);
      
      if (!subjectSnapshot.empty) {
        const subjectIds = subjectSnapshot.docs.map(doc => doc.id);
        console.log('📚 IDs de materias del profesor:', subjectIds);
        
        // Buscar cuadernos de esas materias
        for (const subjectId of subjectIds) {
          const notebooksQuery = query(
            collection(db, 'schoolNotebooks'),
            where('idMateria', '==', subjectId)
          );
          const notebooksSnapshot = await getDocs(notebooksQuery);
          
          if (notebooksSnapshot.empty) {
            console.log(`❌ No hay cuadernos para la materia ${subjectId}`);
          } else {
            console.log(`📚 Cuadernos para materia ${subjectId}:`);
            notebooksSnapshot.docs.forEach((notebook: any) => {
              console.log(`   - ${notebook.id}: ${notebook.data().title}`);
            });
          }
        }
      } else {
        console.log('❌ No hay materias asignadas, por eso no hay cuadernos');
      }
    } catch (error) {
      console.log('⚠️ Error al verificar cuadernos específicos:', error);
    }
    
    console.log('\n🎯 RESUMEN:');
    console.log('💡 Si no ves cuadernos, es porque:');
    console.log('   1. No tienes materias asignadas, O');
    console.log('   2. Tus materias no tienen cuadernos creados');
    console.log('💡 Contacta al administrador para completar la configuración');
    
  } catch (error) {
    console.error('❌ Error en verificación de cuadernos:', error);
  }
};

/**
 * Verificar el estado de autenticación y tipo de usuario
 */
export const checkCurrentUserStatus = async () => {
  console.log('🔍 === VERIFICACIÓN DE USUARIO ACTUAL ===');
  
  try {
    const { getAuth } = await import('firebase/auth');
    const { getFirestore, doc, getDoc } = await import('firebase/firestore');
    
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;
    
    if (!user) {
      console.log('❌ No hay usuario autenticado');
      console.log('💡 Necesitas iniciar sesión');
      return;
    }
    
    console.log('👤 Usuario:', user.uid);
    console.log('📧 Email:', user.email);
    console.log('👤 Display Name:', user.displayName);
    console.log('🔐 Email verificado:', user.emailVerified);
    
    // Verificar perfil de usuario
    console.log('\n📋 Verificando perfil de usuario...');
    try {
      const userDoc = doc(db, 'users', user.uid);
      const userSnapshot = await getDoc(userDoc);
      
      if (userSnapshot.exists()) {
        const userData = userSnapshot.data();
        console.log('✅ Perfil de usuario encontrado');
        console.log('📋 Datos del perfil:', userData);
        
        // Verificar tipo de suscripción
        if (userData.subscription) {
          console.log('💳 Tipo de suscripción:', userData.subscription);
          
          if (userData.subscription === 'school') {
            console.log('✅ Usuario escolar confirmado');
            
            if (userData.schoolRole) {
              console.log('👨‍🏫 Rol escolar:', userData.schoolRole);
              
              if (userData.schoolRole === 'teacher') {
                console.log('✅ Es un profesor');
                console.log('💡 Debería poder ver cuadernos escolares');
              } else {
                console.log('⚠️ No es profesor, es:', userData.schoolRole);
              }
            } else {
              console.log('⚠️ No tiene rol escolar definido');
            }
          } else {
            console.log('⚠️ No es usuario escolar, es:', userData.subscription);
          }
        } else {
          console.log('⚠️ No tiene tipo de suscripción definido');
        }
        
      } else {
        console.log('❌ No se encontró perfil de usuario');
        console.log('💡 El usuario no está registrado en la base de datos');
      }
      
    } catch (error) {
      console.log('⚠️ Error al verificar perfil:', error);
    }
    
    console.log('\n🎯 RECOMENDACIONES:');
    console.log('1. Si no eres profesor, inicia sesión con la cuenta correcta');
    console.log('2. Si eres profesor pero no ves cuadernos, contacta al administrador');
    console.log('3. Si tienes problemas de permisos, puede ser un problema de configuración');
    
  } catch (error) {
    console.error('❌ Error en verificación:', error);
  }
};

/**
 * Función para super admin: diagnosticar y limpiar cuentas duplicadas por email
 */
export const superAdminDiagnoseAndCleanAccounts = async (targetEmail: string) => {
  console.log('🔍 === DIAGNÓSTICO Y LIMPIEZA DE CUENTAS (SUPER ADMIN) ===');
  
  try {
    const { getAuth } = await import('firebase/auth');
    const { getFirestore, collection, query, where, getDocs, deleteDoc, doc } = await import('firebase/firestore');
    
    const auth = getAuth();
    const db = getFirestore();
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      console.log('❌ No hay usuario autenticado');
      return;
    }
    
    console.log('👤 Super Admin actual:', currentUser.uid);
    console.log('📧 Email objetivo:', targetEmail);
    
    // Verificar que el usuario actual es super admin
    console.log('\n🔐 Verificando permisos de super admin...');
    try {
      const adminDoc = doc(db, 'users', currentUser.uid);
      const adminSnapshot = await getDoc(adminDoc);
      
      if (!adminSnapshot.exists()) {
        console.log('❌ No se encontró perfil de usuario');
        return;
      }
      
      const adminData = adminSnapshot.data();
      if ((adminData.subscription || '').toLowerCase() !== 'super_admin') {
        console.log('❌ No tienes permisos de super admin');
        console.log('💡 Tu suscripción es:', adminData.subscription);
        return;
      }
      
      console.log('✅ Permisos de super admin confirmados');
      
    } catch (error) {
      console.log('⚠️ Error al verificar permisos:', error);
      return;
    }
    
    // Buscar todas las cuentas con el email objetivo
    console.log('\n🔍 Buscando cuentas con el email objetivo...');
    try {
      const usersQuery = query(
        collection(db, 'users'),
        where('email', '==', targetEmail)
      );
      const usersSnapshot = await getDocs(usersQuery);
      
      if (usersSnapshot.empty) {
        console.log('❌ No se encontraron cuentas con este email');
        return;
      }
      
      console.log(`⚠️ Se encontraron ${usersSnapshot.size} cuentas con el email ${targetEmail}:`);
      
      const accounts: any[] = [];
      usersSnapshot.forEach(doc => {
        const data = doc.data();
        accounts.push({
          id: doc.id,
          ...data
        });
      });
      
      // Mostrar todas las cuentas
      accounts.forEach((account, index) => {
        console.log(`\n📋 Cuenta ${index + 1}:`);
        console.log(`   ID: ${account.id}`);
        console.log(`   Email: ${account.email}`);
        console.log(`   Nombre: ${account.nombre || account.displayName || 'N/A'}`);
        console.log(`   Suscripción: ${account.subscription || 'N/A'}`);
        console.log(`   Rol escolar: ${account.schoolRole || 'N/A'}`);
        
        // Manejar createdAt de forma segura
        let createdAtStr = 'N/A';
        if (account.createdAt) {
          try {
            if (typeof account.createdAt.toDate === 'function') {
              createdAtStr = account.createdAt.toDate().toString();
            } else if (account.createdAt instanceof Date) {
              createdAtStr = account.createdAt.toString();
            } else {
              createdAtStr = account.createdAt.toString();
            }
          } catch (error) {
            createdAtStr = 'Error al parsear fecha';
          }
        }
        console.log(`   Creado: ${createdAtStr}`);
      });
      
      // Analizar tipos de cuenta
      const freeAccounts: any[] = accounts.filter(a => 
        (a.subscription || '').toLowerCase() === 'free'
      );
      const schoolAccounts: any[] = accounts.filter(a => 
        (a.subscription || '').toLowerCase() === 'school'
      );
      const teacherAccounts: any[] = accounts.filter(a => 
        (a.schoolRole || '').toLowerCase() === 'teacher'
      );
      
      console.log('\n📊 RESUMEN:');
      console.log(`   Cuentas totales: ${accounts.length}`);
      console.log(`   Cuentas free: ${freeAccounts.length}`);
      console.log(`   Cuentas school: ${schoolAccounts.length}`);
      console.log(`   Cuentas teacher: ${teacherAccounts.length}`);
      
      // Identificar la cuenta correcta
      const correctAccount = accounts.find(a => 
        (a.subscription || '').toLowerCase() === 'school' && 
        (a.schoolRole || '').toLowerCase() === 'teacher'
      );
      
      if (correctAccount) {
        console.log('\n✅ CUENTA CORRECTA ENCONTRADA:');
        console.log(`   ID: ${correctAccount.id}`);
        console.log(`   Email: ${correctAccount.email}`);
        console.log(`   Nombre: ${correctAccount.nombre}`);
        console.log(`   Suscripción: ${correctAccount.subscription}`);
        console.log(`   Rol: ${correctAccount.schoolRole}`);
      } else {
        console.log('\n❌ No se encontró una cuenta correcta de profesor');
        console.log('💡 Necesitas crear una cuenta con subscription: "school" y schoolRole: "teacher"');
      }
      
      // Limpiar cuentas free duplicadas si hay más de una
      if (freeAccounts.length > 1) {
        console.log('\n🧹 LIMPIEZA DE CUENTAS FREE DUPLICADAS');
        console.log(`⚠️ Se encontraron ${freeAccounts.length} cuentas free`);
        
        // Ordenar por fecha de creación (más antigua primero)
        freeAccounts.sort((a, b) => {
          const getDate = (account: any) => {
            if (!account.createdAt) return new Date(0);
            try {
              if (typeof account.createdAt.toDate === 'function') {
                return account.createdAt.toDate();
              } else if (account.createdAt instanceof Date) {
                return account.createdAt;
              } else {
                return new Date(account.createdAt);
              }
            } catch (error) {
              return new Date(0);
            }
          };
          
          const dateA = getDate(a);
          const dateB = getDate(b);
          return dateA.getTime() - dateB.getTime();
        });
        
        console.log('\n📋 Cuentas free ordenadas por fecha de creación:');
        freeAccounts.forEach((account, index) => {
          let createdAtStr = 'N/A';
          if (account.createdAt) {
            try {
              if (typeof account.createdAt.toDate === 'function') {
                createdAtStr = account.createdAt.toDate().toString();
              } else if (account.createdAt instanceof Date) {
                createdAtStr = account.createdAt.toString();
              } else {
                createdAtStr = account.createdAt.toString();
              }
            } catch (error) {
              createdAtStr = 'Error al parsear fecha';
            }
          }
          console.log(`${index + 1}. ID: ${account.id} - Creado: ${createdAtStr}`);
        });
        
        // Mantener la más antigua, eliminar las demás
        const accountToKeep = freeAccounts[0];
        const accountsToDelete = freeAccounts.slice(1);
        
        console.log('\n💾 Manteniendo cuenta:', accountToKeep.id);
        console.log('🗑️ Eliminando cuentas:', accountsToDelete.map(a => a.id));
        
        // Confirmar antes de eliminar
        const confirmDelete = confirm(
          `¿Eliminar ${accountsToDelete.length} cuentas free duplicadas?\n\n` +
          `Mantendremos: ${accountToKeep.id}\n` +
          `Eliminaremos: ${accountsToDelete.map(a => a.id).join(', ')}`
        );
        
        if (confirmDelete) {
          console.log('\n🗑️ Eliminando cuentas duplicadas...');
          let deletedCount = 0;
          
          for (const account of accountsToDelete) {
            try {
              await deleteDoc(doc(db, 'users', account.id));
              console.log(`✅ Eliminada cuenta: ${account.id}`);
              deletedCount++;
            } catch (error) {
              console.log(`❌ Error al eliminar ${account.id}:`, error);
            }
          }
          
          console.log(`\n🎉 Limpieza completada: ${deletedCount} cuentas eliminadas`);
        } else {
          console.log('❌ Operación cancelada por el usuario');
        }
      } else if (freeAccounts.length === 1) {
        console.log('\n✅ Solo hay una cuenta free, no hay duplicados');
      } else {
        console.log('\n✅ No hay cuentas free');
      }
      
      console.log('\n🎯 RECOMENDACIONES FINALES:');
      if (correctAccount) {
        console.log('✅ El usuario tiene una cuenta correcta de profesor');
        console.log('💡 Debería poder acceder a los cuadernos escolares');
      } else {
        console.log('❌ El usuario no tiene cuenta correcta de profesor');
        console.log('💡 Necesitas crear una cuenta con subscription: "school" y schoolRole: "teacher"');
      }
      
    } catch (error) {
      console.log('⚠️ Error al buscar cuentas:', error);
    }
    
  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
  }
};

/**
 * Función para super admin: limpiar cuentas duplicadas con el mismo ID
 */
export const superAdminCleanDuplicateIDs = async (targetEmail: string) => {
  console.log('🧹 === LIMPIEZA DE CUENTAS DUPLICADAS CON MISMO ID ===');
  
  try {
    const { getAuth } = await import('firebase/auth');
    const { getFirestore, collection, query, where, getDocs, deleteDoc, doc } = await import('firebase/firestore');
    
    const auth = getAuth();
    const db = getFirestore();
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      console.log('❌ No hay usuario autenticado');
      return;
    }
    
    console.log('👤 Super Admin actual:', currentUser.uid);
    console.log('📧 Email objetivo:', targetEmail);
    
    // Verificar permisos de super admin
    console.log('\n🔐 Verificando permisos de super admin...');
    try {
      const adminDoc = doc(db, 'users', currentUser.uid);
      const adminSnapshot = await getDoc(adminDoc);
      
      if (!adminSnapshot.exists()) {
        console.log('❌ No se encontró perfil de usuario');
        return;
      }
      
      const adminData = adminSnapshot.data();
      if ((adminData.subscription || '').toLowerCase() !== 'super_admin') {
        console.log('❌ No tienes permisos de super admin');
        console.log('💡 Tu suscripción es:', adminData.subscription);
        return;
      }
      
      console.log('✅ Permisos de super admin confirmados');
      
    } catch (error) {
      console.log('⚠️ Error al verificar permisos:', error);
      return;
    }
    
    // Buscar todas las cuentas con el email objetivo
    console.log('\n🔍 Buscando cuentas con el email objetivo...');
    try {
      const usersQuery = query(
        collection(db, 'users'),
        where('email', '==', targetEmail)
      );
      const usersSnapshot = await getDocs(usersQuery);
      
      if (usersSnapshot.empty) {
        console.log('❌ No se encontraron cuentas con este email');
        return;
      }
      
      console.log(`⚠️ Se encontraron ${usersSnapshot.size} cuentas con el email ${targetEmail}`);
      
      // Agrupar por ID para identificar duplicados
      const accountsByID: { [key: string]: any[] } = {};
      
      usersSnapshot.forEach(doc => {
        const data = doc.data();
        const id = data.id || doc.id;
        
        if (!accountsByID[id]) {
          accountsByID[id] = [];
        }
        
        accountsByID[id].push({
          docId: doc.id, // ID del documento en Firestore
          data: data
        });
      });
      
      console.log('\n📋 Cuentas agrupadas por ID:');
      Object.keys(accountsByID).forEach(id => {
        const accounts = accountsByID[id];
        console.log(`\n   ID: ${id} - ${accounts.length} documentos`);
        accounts.forEach((account, index) => {
          console.log(`     ${index + 1}. Doc ID: ${account.docId} - Email: ${account.data.email} - Suscripción: ${account.data.subscription}`);
        });
      });
      
      // Identificar cuentas con múltiples documentos
      const duplicateIDs = Object.keys(accountsByID).filter(id => accountsByID[id].length > 1);
      
      if (duplicateIDs.length === 0) {
        console.log('\n✅ No hay cuentas con múltiples documentos');
        return;
      }
      
      console.log(`\n⚠️ Se encontraron ${duplicateIDs.length} IDs con múltiples documentos:`);
      duplicateIDs.forEach(id => {
        console.log(`   - ${id}: ${accountsByID[id].length} documentos`);
      });
      
      // Para cada ID duplicado, mantener solo el primer documento
      for (const duplicateID of duplicateIDs) {
        const accounts = accountsByID[duplicateID];
        const accountToKeep = accounts[0];
        const accountsToDelete = accounts.slice(1);
        
        console.log(`\n🧹 Limpiando duplicados para ID: ${duplicateID}`);
        console.log(`   💾 Manteniendo: ${accountToKeep.docId}`);
        console.log(`   🗑️ Eliminando: ${accountsToDelete.length} documentos`);
        
        // Confirmar antes de eliminar
        const confirmDelete = confirm(
          `¿Eliminar ${accountsToDelete.length} documentos duplicados para el ID ${duplicateID}?\n\n` +
          `Mantendremos: ${accountToKeep.docId}\n` +
          `Eliminaremos: ${accountsToDelete.map(a => a.docId).join(', ')}`
        );
        
        if (confirmDelete) {
          console.log('\n🗑️ Eliminando documentos duplicados...');
          let deletedCount = 0;
          
          for (const account of accountsToDelete) {
            try {
              await deleteDoc(doc(db, 'users', account.docId));
              console.log(`✅ Eliminado documento: ${account.docId}`);
              deletedCount++;
            } catch (error) {
              console.log(`❌ Error al eliminar ${account.docId}:`, error);
            }
          }
          
          console.log(`🎉 Limpieza completada para ${duplicateID}: ${deletedCount} documentos eliminados`);
        } else {
          console.log('❌ Operación cancelada por el usuario');
        }
      }
      
      console.log('\n🎯 LIMPIEZA COMPLETADA');
      console.log('💡 Ahora deberías tener solo un documento por ID');
      console.log('💡 El profesor puede intentar acceder a los cuadernos escolares');
      
    } catch (error) {
      console.log('⚠️ Error al limpiar cuentas:', error);
    }
    
  } catch (error) {
    console.error('❌ Error en limpieza:', error);
  }
};

// Función alternativa para arreglar el problema sin acceder a schoolStudents
export const fixStudentNotebooksAlternative = async () => {
  try {
    console.log('🔧 Iniciando arreglo alternativo de cuadernos del estudiante...');
    
    const user = auth.currentUser;
    if (!user) {
      console.log('❌ No hay usuario autenticado');
      return;
    }

    console.log('👤 Usuario actual:', user.email);
    console.log('🆔 User ID:', user.uid);

    // 1. Verificar que el usuario en 'users' tenga schoolRole correcto
    const userQuery = query(
      collection(db, 'users'),
      where('id', '==', user.uid)
    );
    const userSnapshot = await getDocs(userQuery);
    
    if (userSnapshot.empty) {
      console.log('❌ No se encontró el usuario en la colección users');
      return;
    }

    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();
    console.log('👤 Usuario encontrado:', userData.nombre);
    console.log('🎓 schoolRole actual:', userData.schoolRole);

    // 2. Actualizar schoolRole si no es 'student'
    if (userData.schoolRole !== 'student') {
      console.log('🔧 Actualizando schoolRole a student...');
      await updateDoc(userDoc.ref, {
        schoolRole: 'student',
        subscription: 'school'
      });
      console.log('✅ schoolRole actualizado');
    }

    // 3. Buscar materias donde el estudiante esté asignado
    const subjectsQuery = query(
      collection(db, 'schoolSubjects'),
      where('idEstudiante', '==', user.uid)
    );
    const subjectsSnapshot = await getDocs(subjectsQuery);
    
    if (subjectsSnapshot.empty) {
      console.log('❌ No se encontraron materias asignadas al estudiante');
      console.log('💡 Necesitas que un administrador te asigne a una materia');
      return;
    }

    const subjectDoc = subjectsSnapshot.docs[0];
    const subjectData = subjectDoc.data();
    console.log('🏫 Materia encontrada:', subjectData.nombre || subjectDoc.id);

    // 4. Buscar cuadernos de esa materia
    const notebooksQuery = query(
      collection(db, 'schoolNotebooks'),
      where('idMateria', '==', subjectDoc.id)
    );
    const notebooksSnapshot = await getDocs(notebooksQuery);
    
    console.log('📚 Cuadernos encontrados:', notebooksSnapshot.size);
    const notebooks = notebooksSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    notebooks.forEach((notebook: any) => {
      console.log('   -', notebook.id, ':', notebook.title);
    });

    if (notebooks.length === 0) {
      console.log('❌ No se encontraron cuadernos para la materia');
      console.log('💡 Necesitas que un profesor cree cuadernos para esta materia');
      return;
    }

    // 5. Crear o actualizar el documento del estudiante en schoolStudents
    const studentData = {
      id: user.uid,
      nombre: userData.nombre || userData.displayName || userData.username,
      email: user.email,
      password: '1234',
      subscription: 'school',
      idCuadernos: notebooks.map(n => n.id),
      idNotebook: notebooks[0].id, // Usar el primer cuaderno como principal
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log('🔧 Creando/actualizando documento del estudiante...');
    await setDoc(doc(db, 'schoolStudents', user.uid), studentData, { merge: true });
    console.log('✅ Documento del estudiante actualizado');

    console.log('✅ Arreglo alternativo completado');
    console.log('💡 Recarga la página para ver los cambios');

  } catch (error) {
    console.error('❌ Error en arreglo alternativo:', error);
  }
};

// Función para que el superadmin arregle el problema de cuadernos de un estudiante específico
export const superAdminFixStudentNotebooks = async (studentEmail: string) => {
  try {
    console.log('🔧 SuperAdmin: Iniciando arreglo de cuadernos para estudiante:', studentEmail);
    
    // 1. Buscar el estudiante por email en schoolStudents
    const studentQuery = query(
      collection(db, 'schoolStudents'),
      where('email', '==', studentEmail)
    );
    const studentSnapshot = await getDocs(studentQuery);
    
    if (studentSnapshot.empty) {
      console.log('❌ No se encontró el estudiante en schoolStudents con email:', studentEmail);
      return;
    }

    const studentDoc = studentSnapshot.docs[0];
    const studentData = studentDoc.data();
    console.log('👨‍🎓 Estudiante encontrado:', studentData.nombre);
    console.log('🆔 Student ID:', studentData.id);
    console.log('📚 idCuadernos:', studentData.idCuadernos);

    if (!studentData.idCuadernos || studentData.idCuadernos.length === 0) {
      console.log('❌ El estudiante no tiene cuadernos asignados');
      return;
    }

    // 2. Verificar que los cuadernos existen
    const notebooksQuery = query(
      collection(db, 'schoolNotebooks'),
      where('__name__', 'in', studentData.idCuadernos)
    );
    const notebooksSnapshot = await getDocs(notebooksQuery);
    
    console.log('📚 Cuadernos encontrados:', notebooksSnapshot.size);
    notebooksSnapshot.docs.forEach(doc => {
      console.log('   -', doc.id, ':', doc.data().title);
    });

    // 3. Actualizar el campo idNotebook si está vacío
    if (!studentData.idNotebook && studentData.idCuadernos.length > 0) {
      console.log('🔧 Actualizando idNotebook con el primer cuaderno...');
      await updateDoc(studentDoc.ref, {
        idNotebook: studentData.idCuadernos[0]
      });
      console.log('✅ idNotebook actualizado');
    }

    // 4. Verificar que el usuario en 'users' tenga schoolRole correcto
    const userQuery = query(
      collection(db, 'users'),
      where('id', '==', studentData.id)
    );
    const userSnapshot = await getDocs(userQuery);
    
    if (!userSnapshot.empty) {
      const userDoc = userSnapshot.docs[0];
      const userData = userDoc.data();
      
      if (userData.schoolRole !== 'student') {
        console.log('🔧 Actualizando schoolRole en users...');
        await updateDoc(userDoc.ref, {
          schoolRole: 'student',
          subscription: 'school'
        });
        console.log('✅ schoolRole actualizado');
      }
    } else {
      console.log('⚠️ No se encontró el usuario en la colección users');
    }

    console.log('✅ Arreglo de cuadernos del estudiante completado');
    console.log('💡 El estudiante puede recargar la página para ver los cambios');

  } catch (error) {
    console.error('❌ Error arreglando cuadernos del estudiante:', error);
  }
};

// Función simple que solo actualiza el perfil del usuario sin acceder a colecciones restringidas
export const fixStudentProfileSimple = async () => {
  try {
    console.log('🔧 Iniciando arreglo simple del perfil del estudiante...');
    
    const user = auth.currentUser;
    if (!user) {
      console.log('❌ No hay usuario autenticado');
      return;
    }

    console.log('👤 Usuario actual:', user.email);
    console.log('🆔 User ID:', user.uid);

    // Solo actualizar el perfil en 'users' que sí tiene permisos
    const userQuery = query(
      collection(db, 'users'),
      where('id', '==', user.uid)
    );
    const userSnapshot = await getDocs(userQuery);
    
    if (userSnapshot.empty) {
      console.log('❌ No se encontró el usuario en la colección users');
      return;
    }

    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();
    console.log('👤 Usuario encontrado:', userData.nombre);
    console.log('🎓 schoolRole actual:', userData.schoolRole);

    // Actualizar schoolRole si no es 'student'
    if (userData.schoolRole !== 'student') {
      console.log('🔧 Actualizando schoolRole a student...');
      await updateDoc(userDoc.ref, {
        schoolRole: 'student',
        subscription: 'school'
      });
      console.log('✅ schoolRole actualizado');
    } else {
      console.log('✅ schoolRole ya está correcto');
    }

    console.log('✅ Arreglo simple completado');
    console.log('💡 Ahora el sistema debería reconocerte como estudiante');
    console.log('💡 Si aún no ves cuadernos, contacta al administrador');

  } catch (error) {
    console.error('❌ Error en arreglo simple:', error);
  }
};

// Hacer las funciones disponibles globalmente
if (typeof window !== 'undefined') {
  (window as any).quickFix = quickFix;
  (window as any).fixSchoolUserProfileHierarchy = fixSchoolUserProfileHierarchy;
  (window as any).diagnoseSchoolHierarchy = diagnoseSchoolHierarchy;
  (window as any).diagnoseSchoolNotebookDetailPermissions = diagnoseSchoolNotebookDetailPermissions;
  (window as any).forceUpdateUserProfile = forceUpdateUserProfile;
  (window as any).checkSchoolConcepts = checkSchoolConcepts;
  (window as any).createTestSchoolConcept = createTestSchoolConcept;
  (window as any).migrateConceptsToSchoolConcepts = migrateConceptsToSchoolConcepts;
  (window as any).diagnoseSchoolNotebookDetailAccess = diagnoseSchoolNotebookDetailAccess;
  (window as any).createTestSchoolConceptManual = createTestSchoolConceptManual;
  (window as any).fixUserSubscription = fixUserSubscription;
  (window as any).fixTeacherNotebooksIssue = fixTeacherNotebooksIssue;
  (window as any).testTeacherStatus = testTeacherStatus;
  (window as any).checkTeacherStatusSimple = checkTeacherStatusSimple;
  (window as any).checkTeacherNotebooks = checkTeacherNotebooks;
  (window as any).checkCurrentUserStatus = checkCurrentUserStatus;
  (window as any).superAdminDiagnoseAndCleanAccounts = superAdminDiagnoseAndCleanAccounts;
  (window as any).superAdminCleanDuplicateIDs = superAdminCleanDuplicateIDs;
  (window as any).fixStudentNotebooksAlternative = fixStudentNotebooksAlternative;
  (window as any).superAdminFixStudentNotebooks = superAdminFixStudentNotebooks;
  (window as any).fixStudentProfileSimple = fixStudentProfileSimple;
  console.log('🔧 Función quickFix() disponible en la consola');
  console.log('🔧 Función fixSchoolUserProfileHierarchy() disponible en la consola para corregir el perfil escolar');
  console.log('🔧 Función diagnoseSchoolHierarchy() disponible en la consola para diagnosticar jerarquía');
  console.log('🔧 Función diagnoseSchoolNotebookDetailPermissions() disponible en la consola para diagnosticar permisos específicos');
  console.log('🔧 Función forceUpdateUserProfile() disponible en la consola para forzar actualización de perfil');
  console.log('🔧 Función checkSchoolConcepts() disponible en la consola para verificar conceptos escolares');
  console.log('🔧 Función createTestSchoolConcept() disponible en la consola para crear un concepto escolar de prueba');
  console.log('🔧 Función migrateConceptsToSchoolConcepts() disponible en la consola para migrar conceptos existentes');
  console.log('🔧 Función diagnoseSchoolNotebookDetailAccess() disponible en la consola para diagnosticar acceso a SchoolNotebookDetail');
  console.log('🔧 Función createTestSchoolConceptManual() disponible en la consola para crear un concepto escolar manual de prueba');
  console.log('🔧 Función fixUserSubscription() disponible en la consola para diagnosticar y arreglar el tipo de suscripción');
  console.log('🔧 Función fixTeacherNotebooksIssue() disponible en la consola');
  console.log('🔧 Función testTeacherStatus() disponible en la consola para verificar estado del profesor');
  console.log('🔧 Función checkTeacherStatusSimple() disponible en la consola para verificación simple');
  console.log('🔧 Función checkTeacherNotebooks() disponible en la consola para verificar cuadernos escolares específicamente');
  console.log('🔧 Función checkCurrentUserStatus() disponible en la consola para verificar el usuario actual');
  console.log('🔧 Función superAdminDiagnoseAndCleanAccounts() disponible en la consola para diagnosticar y limpiar cuentas duplicadas');
  console.log('🔧 Función superAdminCleanDuplicateIDs() disponible en la consola para limpiar cuentas duplicadas con el mismo ID');
  console.log('🔧 Función fixStudentNotebooksAlternative() disponible en la consola para arreglar el problema de carga de cuadernos del estudiante');
  console.log('�� Función superAdminFixStudentNotebooks() disponible en la consola para arreglar el problema de cuadernos del estudiante');
  console.log('🔧 Función fixStudentProfileSimple() disponible en la consola para arreglar el perfil del estudiante');
  console.log('💡 Ejecuta: window.quickFix() para solucionar problemas de autenticación');
} 