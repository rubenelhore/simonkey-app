import { db } from '../services/firebase';
import { 
  collection, 
  getDocs, 
  addDoc,
  deleteDoc,
  serverTimestamp 
} from 'firebase/firestore';

/**
 * Script de prueba para crear datos de ejemplo en las colecciones escolares
 * Solo ejecutar si no hay datos existentes
 */
export const createTestSchoolData = async () => {
  try {
    console.log('🏫 Creando datos de prueba para el sistema escolar...');

    // 1. Crear institución de prueba
    const institutionData = {
      nombre: 'Universidad de Prueba',
      createdAt: serverTimestamp()
    };
    
    const institutionRef = await addDoc(collection(db, 'schoolInstitutions'), institutionData);
    console.log('✅ Institución creada:', institutionRef.id);

    // 2. Crear administrador de prueba
    const adminData = {
      nombre: 'Admin de Prueba',
      email: 'admin@test.edu',
      password: '1234',
      subscription: 'SCHOOL',
      idInstitucion: institutionRef.id,
      createdAt: serverTimestamp()
    };
    
    const adminRef = await addDoc(collection(db, 'schoolAdmins'), adminData);
    console.log('✅ Administrador creado:', adminRef.id);

    // 3. Crear profesor de prueba
    const teacherData = {
      nombre: 'Profesor de Prueba',
      email: 'profesor@test.edu',
      password: '1234',
      subscription: 'SCHOOL',
      idAdmin: adminRef.id,
      createdAt: serverTimestamp()
    };
    
    const teacherRef = await addDoc(collection(db, 'schoolTeachers'), teacherData);
    console.log('✅ Profesor creado:', teacherRef.id);

    // 4. Crear materia de prueba
    const subjectData = {
      nombre: 'Matemáticas Avanzadas',
      idProfesor: teacherRef.id,
      createdAt: serverTimestamp()
    };
    
    const subjectRef = await addDoc(collection(db, 'schoolSubjects'), subjectData);
    console.log('✅ Materia creada:', subjectRef.id);

    // 5. Crear cuaderno de prueba
    const notebookData = {
      title: 'Cuaderno de Álgebra',
      color: '#667eea',
      idMateria: subjectRef.id,
      createdAt: serverTimestamp()
    };
    
    const notebookRef = await addDoc(collection(db, 'schoolNotebooks'), notebookData);
    console.log('✅ Cuaderno creado:', notebookRef.id);

    // 6. Crear estudiante de prueba
    const studentData = {
      nombre: 'Estudiante de Prueba',
      email: 'estudiante@test.edu',
      password: '1234',
      subscription: 'SCHOOL',
      idCuadernos: [notebookRef.id],
      createdAt: serverTimestamp()
    };
    
    const studentRef = await addDoc(collection(db, 'schoolStudents'), studentData);
    console.log('✅ Estudiante creado:', studentRef.id);

    // 7. Crear tutor de prueba
    const tutorData = {
      nombre: 'Tutor de Prueba',
      email: 'tutor@test.edu',
      password: '1234',
      subscription: 'SCHOOL',
      schoolRole: 'TUTOR',
      idAlumnos: [studentRef.id],
      createdAt: serverTimestamp()
    };
    
    const tutorRef = await addDoc(collection(db, 'schoolTutors'), tutorData);
    console.log('✅ Tutor creado:', tutorRef.id);

    console.log('🎉 Todos los datos de prueba creados exitosamente!');
    console.log('📋 Resumen de IDs creados:');
    console.log('   - Institución:', institutionRef.id);
    console.log('   - Administrador:', adminRef.id);
    console.log('   - Profesor:', teacherRef.id);
    console.log('   - Materia:', subjectRef.id);
    console.log('   - Cuaderno:', notebookRef.id);
    console.log('   - Estudiante:', studentRef.id);
    console.log('   - Tutor:', tutorRef.id);

    return {
      institutionId: institutionRef.id,
      adminId: adminRef.id,
      teacherId: teacherRef.id,
      subjectId: subjectRef.id,
      notebookId: notebookRef.id,
      studentId: studentRef.id,
      tutorId: tutorRef.id
    };

  } catch (error) {
    console.error('❌ Error creando datos de prueba:', error);
    throw error;
  }
};

/**
 * Verificar si existen datos en las colecciones escolares
 */
export const checkSchoolCollections = async () => {
  try {
    console.log('🔍 Verificando colecciones escolares...');

    const collections = [
      'schoolInstitutions',
      'schoolAdmins', 
      'schoolTeachers',
      'schoolSubjects',
      'schoolNotebooks',
      'schoolStudents',
      'schoolTutors'
    ];

    const results: { [key: string]: number } = {};

    for (const collectionName of collections) {
      const snapshot = await getDocs(collection(db, collectionName));
      results[collectionName] = snapshot.size;
      console.log(`   - ${collectionName}: ${snapshot.size} documentos`);
    }

    const totalDocuments = Object.values(results).reduce((sum, count) => sum + count, 0);
    console.log(`📊 Total de documentos: ${totalDocuments}`);

    return results;

  } catch (error) {
    console.error('❌ Error verificando colecciones:', error);
    throw error;
  }
};

/**
 * Limpiar datos de prueba (usar con precaución)
 */
export const clearTestData = async () => {
  if (!window.confirm('¿Estás seguro de que quieres eliminar TODOS los datos de prueba? Esta acción no se puede deshacer.')) {
    return;
  }

  try {
    console.log('🗑️ Eliminando datos de prueba...');

    const collections = [
      'schoolInstitutions',
      'schoolAdmins', 
      'schoolTeachers',
      'schoolSubjects',
      'schoolNotebooks',
      'schoolStudents',
      'schoolTutors'
    ];

    for (const collectionName of collections) {
      const snapshot = await getDocs(collection(db, collectionName));
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      console.log(`✅ ${collectionName} limpiada`);
    }

    console.log('🎉 Todos los datos de prueba eliminados');

  } catch (error) {
    console.error('❌ Error eliminando datos de prueba:', error);
    throw error;
  }
}; 