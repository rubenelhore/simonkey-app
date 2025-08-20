import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { UserProfile, SchoolRole } from '../../types/interfaces';

interface TeacherInfo {
  id: string;
  email: string;
  displayName: string;
  schoolName?: string;
  idEscuela?: string;
  studentCount?: number;
  materiaCount?: number;
}

/**
 * Identifica todos los profesores actuales en el sistema
 * Busca usuarios con schoolRole = 'teacher'
 */
export async function identifyCurrentTeachers(): Promise<TeacherInfo[]> {
  console.log('🔍 Iniciando identificación de profesores actuales...');
  
  try {
    // Buscar usuarios con rol de profesor
    const usersRef = collection(db, 'users');
    const teacherQuery = query(usersRef, where('schoolRole', '==', SchoolRole.TEACHER));
    const teacherSnapshot = await getDocs(teacherQuery);
    
    const teachers: TeacherInfo[] = [];
    
    for (const doc of teacherSnapshot.docs) {
      const userData = doc.data() as UserProfile;
      
      const teacherInfo: TeacherInfo = {
        id: doc.id,
        email: userData.email,
        displayName: userData.displayName || userData.nombre,
        schoolName: userData.schoolName,
        idEscuela: userData.idEscuela,
      };
      
      // Contar estudiantes asociados (si tienen el mismo idEscuela)
      if (userData.idEscuela) {
        const studentQuery = query(
          usersRef, 
          where('schoolRole', '==', SchoolRole.STUDENT),
          where('idEscuela', '==', userData.idEscuela)
        );
        const studentSnapshot = await getDocs(studentQuery);
        teacherInfo.studentCount = studentSnapshot.size;
      }
      
      // Contar materias del profesor
      try {
        const materiasRef = collection(db, 'subjects');
        const materiasQuery = query(materiasRef, where('teacherId', '==', doc.id));
        const materiasSnapshot = await getDocs(materiasQuery);
        teacherInfo.materiaCount = materiasSnapshot.size;
      } catch (error) {
        console.log(`No se pudieron obtener materias para ${doc.id}`);
        teacherInfo.materiaCount = 0;
      }
      
      teachers.push(teacherInfo);
    }
    
    // Generar reporte
    console.log(`\n📊 REPORTE DE PROFESORES IDENTIFICADOS`);
    console.log(`========================================`);
    console.log(`Total de profesores encontrados: ${teachers.length}`);
    console.log(`\nDetalle por profesor:`);
    
    teachers.forEach((teacher, index) => {
      console.log(`\n${index + 1}. ${teacher.displayName}`);
      console.log(`   - ID: ${teacher.id}`);
      console.log(`   - Email: ${teacher.email}`);
      console.log(`   - Escuela: ${teacher.schoolName || 'No especificada'}`);
      console.log(`   - ID Escuela: ${teacher.idEscuela || 'No especificado'}`);
      console.log(`   - Estudiantes asociados: ${teacher.studentCount || 0}`);
      console.log(`   - Materias creadas: ${teacher.materiaCount || 0}`);
    });
    
    // Guardar reporte en localStorage para referencia
    if (typeof window !== 'undefined') {
      localStorage.setItem('migration_teachers', JSON.stringify({
        timestamp: new Date().toISOString(),
        count: teachers.length,
        teachers: teachers
      }));
      console.log('\n✅ Reporte guardado en localStorage con key: migration_teachers');
    }
    
    return teachers;
    
  } catch (error) {
    console.error('❌ Error identificando profesores:', error);
    throw error;
  }
}

/**
 * Función auxiliar para verificar si un usuario es profesor
 */
export async function isUserTeacher(userId: string): Promise<boolean> {
  try {
    const usersRef = collection(db, 'users');
    const userQuery = query(usersRef, where('__name__', '==', userId));
    const userSnapshot = await getDocs(userQuery);
    
    if (!userSnapshot.empty) {
      const userData = userSnapshot.docs[0].data() as UserProfile;
      return userData.schoolRole === SchoolRole.TEACHER;
    }
    
    return false;
  } catch (error) {
    console.error(`Error verificando si ${userId} es profesor:`, error);
    return false;
  }
}

/**
 * Función para ejecutar desde la consola del navegador
 */
if (typeof window !== 'undefined') {
  (window as any).identifyTeachers = identifyCurrentTeachers;
  console.log('💡 Función disponible: window.identifyTeachers()');
}