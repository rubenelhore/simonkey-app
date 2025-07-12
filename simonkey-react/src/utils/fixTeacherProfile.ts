import { auth, db } from '../services/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

export async function diagnoseTeacherProfile() {
  try {
    if (!auth.currentUser) {
      console.error('❌ No hay usuario autenticado');
      return;
    }

    const uid = auth.currentUser.uid;
    console.log('🔍 Diagnosticando perfil del profesor...');
    console.log('📌 UID de Firebase:', uid);
    console.log('📧 Email:', auth.currentUser.email);

    // Verificar si existe el documento del usuario
    const userDoc = await getDoc(doc(db, 'users', uid));
    
    if (!userDoc.exists()) {
      console.error('❌ NO EXISTE el documento del usuario en Firestore');
      console.log('💡 Necesitas ejecutar: window.createTeacherProfile()');
      return false;
    }

    const userData = userDoc.data();
    console.log('✅ Documento del usuario encontrado:', userData);
    
    // Verificar campos críticos
    const criticalFields = ['id', 'userType', 'schoolRole', 'idInstitucion'];
    const missingFields = criticalFields.filter(field => !userData[field]);
    
    if (missingFields.length > 0) {
      console.warn('⚠️ Campos faltantes:', missingFields);
    }

    console.log('📊 Resumen del perfil:');
    console.log('   - ID del documento:', userData.id);
    console.log('   - Tipo de usuario:', userData.userType);
    console.log('   - Rol escolar:', userData.schoolRole);
    console.log('   - ID Institución:', userData.idInstitucion);
    console.log('   - ID Admin:', userData.idAdmin);

    return userData;
  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
    return null;
  }
}

export async function createTeacherProfile() {
  try {
    if (!auth.currentUser) {
      console.error('❌ No hay usuario autenticado');
      return;
    }

    const uid = auth.currentUser.uid;
    const email = auth.currentUser.email;
    
    console.log('🔨 Creando perfil de profesor...');
    console.log('📌 UID:', uid);
    console.log('📧 Email:', email);

    // Verificar si ya existe
    const existingDoc = await getDoc(doc(db, 'users', uid));
    if (existingDoc.exists()) {
      console.warn('⚠️ El documento ya existe. Usa window.updateTeacherProfile() para actualizar');
      return;
    }

    // Pedir información necesaria
    const nombre = prompt('Nombre del profesor:') || 'Profesor';
    const apellidos = prompt('Apellidos del profesor:') || '';
    const idInstitucion = prompt('ID de la institución (deja vacío si no lo sabes):') || '';
    const idAdmin = prompt('ID del administrador (deja vacío si no lo sabes):') || '';

    // Crear el perfil básico
    const teacherProfile = {
      id: uid, // El ID del documento es el mismo que el UID
      uid: uid,
      email: email,
      nombre: nombre,
      apellidos: apellidos,
      displayName: `${nombre} ${apellidos}`.trim(),
      userType: 'school',
      schoolRole: 'teacher',
      subscription: 'school',
      idInstitucion: idInstitucion,
      idAdmin: idAdmin,
      isEmailVerified: true,
      hasCompletedOnboarding: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Crear el documento
    await setDoc(doc(db, 'users', uid), teacherProfile);
    console.log('✅ Perfil de profesor creado exitosamente');
    console.log('📋 Datos guardados:', teacherProfile);
    
    console.log('\n💡 Próximos pasos:');
    console.log('1. Contacta al administrador para que te asigne materias');
    console.log('2. O ejecuta window.assignTeacherToInstitution() si conoces el ID de la institución');
    
    return teacherProfile;
  } catch (error) {
    console.error('❌ Error creando perfil:', error);
    return null;
  }
}

export async function updateTeacherProfile() {
  try {
    if (!auth.currentUser) {
      console.error('❌ No hay usuario autenticado');
      return;
    }

    const uid = auth.currentUser.uid;
    
    // Verificar que existe
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) {
      console.error('❌ No existe el documento. Ejecuta primero: window.createTeacherProfile()');
      return;
    }

    const currentData = userDoc.data();
    console.log('📋 Datos actuales:', currentData);

    // Pedir actualizaciones
    const updates: any = {};
    
    if (!currentData.idInstitucion) {
      const idInstitucion = prompt('ID de la institución:');
      if (idInstitucion) updates.idInstitucion = idInstitucion;
    }

    if (!currentData.idAdmin) {
      const idAdmin = prompt('ID del administrador:');
      if (idAdmin) updates.idAdmin = idAdmin;
    }

    if (!currentData.id || currentData.id !== uid) {
      updates.id = uid;
    }

    if (!currentData.userType || currentData.userType !== 'school') {
      updates.userType = 'school';
    }

    if (!currentData.schoolRole || currentData.schoolRole !== 'teacher') {
      updates.schoolRole = 'teacher';
    }

    if (!currentData.subscription || currentData.subscription !== 'school') {
      updates.subscription = 'school';
    }

    updates.updatedAt = new Date();

    // Actualizar
    await updateDoc(doc(db, 'users', uid), updates);
    console.log('✅ Perfil actualizado exitosamente');
    console.log('📋 Campos actualizados:', updates);

    return true;
  } catch (error) {
    console.error('❌ Error actualizando perfil:', error);
    return false;
  }
}

export async function assignTeacherToInstitution() {
  try {
    if (!auth.currentUser) {
      console.error('❌ No hay usuario autenticado');
      return;
    }

    const uid = auth.currentUser.uid;
    const idInstitucion = prompt('ID de la institución (ejemplo: escuela_demo_123):');
    
    if (!idInstitucion) {
      console.error('❌ ID de institución requerido');
      return;
    }

    // Verificar que la institución existe
    const institutionDoc = await getDoc(doc(db, 'institutions', idInstitucion));
    if (!institutionDoc.exists()) {
      console.error('❌ La institución no existe:', idInstitucion);
      return;
    }

    const institutionData = institutionDoc.data();
    console.log('✅ Institución encontrada:', institutionData.name);

    // Actualizar el perfil del profesor
    await updateDoc(doc(db, 'users', uid), {
      idInstitucion: idInstitucion,
      idAdmin: institutionData.adminId || '',
      updatedAt: new Date()
    });

    console.log('✅ Profesor asignado a la institución exitosamente');
    console.log('💡 Ahora el administrador debe asignarte materias');

    return true;
  } catch (error) {
    console.error('❌ Error asignando institución:', error);
    return false;
  }
}

// Exponer funciones globalmente
if (typeof window !== 'undefined') {
  (window as any).diagnoseTeacherProfile = diagnoseTeacherProfile;
  (window as any).createTeacherProfile = createTeacherProfile;
  (window as any).updateTeacherProfile = updateTeacherProfile;
  (window as any).assignTeacherToInstitution = assignTeacherToInstitution;
}

console.log('🔧 Funciones de reparación de perfil de profesor disponibles:');
console.log('   - window.diagnoseTeacherProfile() - Diagnostica el estado del perfil');
console.log('   - window.createTeacherProfile() - Crea un nuevo perfil de profesor');
console.log('   - window.updateTeacherProfile() - Actualiza campos faltantes');
console.log('   - window.assignTeacherToInstitution() - Asigna el profesor a una institución');