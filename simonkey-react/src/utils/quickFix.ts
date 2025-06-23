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
  console.log('💡 Ejecuta: window.quickFix() para solucionar problemas de autenticación');
} 