import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { UserProfile, SchoolRole } from '../../types/interfaces';

interface StudentRelation {
  studentId: string;
  studentEmail: string;
  studentName: string;
  teacherId: string;
  teacherEmail: string;
  teacherName: string;
  schoolId?: string;
  schoolName?: string;
  materiaIds?: string[];
  notebookIds?: string[];
}

interface TeacherWithStudents {
  teacherId: string;
  teacherEmail: string;
  teacherName: string;
  schoolId?: string;
  schoolName?: string;
  students: Array<{
    id: string;
    email: string;
    name: string;
    materiaIds?: string[];
    notebookIds?: string[];
  }>;
  totalStudents: number;
}

/**
 * Mapea todas las relaciones profesor-estudiante existentes
 */
export async function mapTeacherStudentRelations(): Promise<{
  relations: StudentRelation[];
  byTeacher: TeacherWithStudents[];
}> {
  console.log('🔗 Iniciando mapeo de relaciones profesor-estudiante...');
  
  try {
    const relations: StudentRelation[] = [];
    const teacherMap = new Map<string, TeacherWithStudents>();
    
    // 1. Obtener todos los profesores
    const usersRef = collection(db, 'users');
    const teacherQuery = query(usersRef, where('schoolRole', '==', SchoolRole.TEACHER));
    const teacherSnapshot = await getDocs(teacherQuery);
    
    console.log(`📚 Profesores encontrados: ${teacherSnapshot.size}`);
    
    // 2. Para cada profesor, buscar sus estudiantes
    for (const teacherDoc of teacherSnapshot.docs) {
      const teacherData = teacherDoc.data() as UserProfile;
      
      const teacherInfo: TeacherWithStudents = {
        teacherId: teacherDoc.id,
        teacherEmail: teacherData.email,
        teacherName: teacherData.displayName || teacherData.nombre,
        schoolId: teacherData.idEscuela,
        schoolName: teacherData.schoolName,
        students: [],
        totalStudents: 0
      };
      
      // Buscar estudiantes de la misma escuela
      if (teacherData.idEscuela) {
        const studentQuery = query(
          usersRef,
          where('schoolRole', '==', SchoolRole.STUDENT),
          where('idEscuela', '==', teacherData.idEscuela)
        );
        const studentSnapshot = await getDocs(studentQuery);
        
        for (const studentDoc of studentSnapshot.docs) {
          const studentData = studentDoc.data() as UserProfile;
          
          // Crear relación
          const relation: StudentRelation = {
            studentId: studentDoc.id,
            studentEmail: studentData.email,
            studentName: studentData.displayName || studentData.nombre,
            teacherId: teacherDoc.id,
            teacherEmail: teacherData.email,
            teacherName: teacherData.displayName || teacherData.nombre,
            schoolId: teacherData.idEscuela,
            schoolName: teacherData.schoolName,
            materiaIds: studentData.subjectIds,
            notebookIds: studentData.idCuadernos
          };
          
          relations.push(relation);
          
          // Agregar al mapa del profesor
          teacherInfo.students.push({
            id: studentDoc.id,
            email: studentData.email,
            name: studentData.displayName || studentData.nombre,
            materiaIds: studentData.subjectIds,
            notebookIds: studentData.idCuadernos
          });
        }
        
        teacherInfo.totalStudents = teacherInfo.students.length;
      }
      
      // También buscar por relación directa con idAdmin
      const adminStudentQuery = query(
        usersRef,
        where('schoolRole', '==', SchoolRole.STUDENT),
        where('idAdmin', '==', teacherDoc.id)
      );
      const adminStudentSnapshot = await getDocs(adminStudentQuery);
      
      for (const studentDoc of adminStudentSnapshot.docs) {
        const studentData = studentDoc.data() as UserProfile;
        
        // Verificar si no está ya incluido
        if (!teacherInfo.students.find(s => s.id === studentDoc.id)) {
          const relation: StudentRelation = {
            studentId: studentDoc.id,
            studentEmail: studentData.email,
            studentName: studentData.displayName || studentData.nombre,
            teacherId: teacherDoc.id,
            teacherEmail: teacherData.email,
            teacherName: teacherData.displayName || teacherData.nombre,
            schoolId: studentData.idEscuela,
            schoolName: studentData.schoolName,
            materiaIds: studentData.subjectIds,
            notebookIds: studentData.idCuadernos
          };
          
          relations.push(relation);
          
          teacherInfo.students.push({
            id: studentDoc.id,
            email: studentData.email,
            name: studentData.displayName || studentData.nombre,
            materiaIds: studentData.subjectIds,
            notebookIds: studentData.idCuadernos
          });
          
          teacherInfo.totalStudents = teacherInfo.students.length;
        }
      }
      
      teacherMap.set(teacherDoc.id, teacherInfo);
    }
    
    // Convertir mapa a array
    const byTeacher = Array.from(teacherMap.values());
    
    // Generar reporte
    console.log(`\n📊 REPORTE DE RELACIONES PROFESOR-ESTUDIANTE`);
    console.log(`==============================================`);
    console.log(`Total de relaciones encontradas: ${relations.length}`);
    console.log(`Total de profesores con estudiantes: ${byTeacher.filter(t => t.totalStudents > 0).length}`);
    
    console.log(`\n👨‍🏫 Detalle por profesor:`);
    byTeacher.forEach((teacher, index) => {
      console.log(`\n${index + 1}. ${teacher.teacherName} (${teacher.teacherEmail})`);
      console.log(`   - ID: ${teacher.teacherId}`);
      console.log(`   - Escuela: ${teacher.schoolName || 'No especificada'}`);
      console.log(`   - Total estudiantes: ${teacher.totalStudents}`);
      
      if (teacher.students.length > 0 && teacher.students.length <= 5) {
        console.log(`   - Estudiantes:`);
        teacher.students.forEach(student => {
          console.log(`     • ${student.name} (${student.email})`);
        });
      } else if (teacher.students.length > 5) {
        console.log(`   - Primeros 5 estudiantes:`);
        teacher.students.slice(0, 5).forEach(student => {
          console.log(`     • ${student.name} (${student.email})`);
        });
        console.log(`     ... y ${teacher.students.length - 5} más`);
      }
    });
    
    // Identificar estudiantes sin profesor
    const allStudentsQuery = query(usersRef, where('schoolRole', '==', SchoolRole.STUDENT));
    const allStudentsSnapshot = await getDocs(allStudentsQuery);
    const mappedStudentIds = new Set(relations.map(r => r.studentId));
    const orphanStudents: UserProfile[] = [];
    
    allStudentsSnapshot.forEach(doc => {
      if (!mappedStudentIds.has(doc.id)) {
        orphanStudents.push({ id: doc.id, ...doc.data() } as UserProfile);
      }
    });
    
    if (orphanStudents.length > 0) {
      console.log(`\n⚠️ Estudiantes sin profesor asignado: ${orphanStudents.length}`);
      orphanStudents.slice(0, 10).forEach(student => {
        console.log(`   - ${student.displayName || student.nombre} (${student.email})`);
      });
      if (orphanStudents.length > 10) {
        console.log(`   ... y ${orphanStudents.length - 10} más`);
      }
    }
    
    // Guardar reporte en localStorage
    if (typeof window !== 'undefined') {
      const report = {
        timestamp: new Date().toISOString(),
        totalRelations: relations.length,
        totalTeachers: byTeacher.length,
        teachersWithStudents: byTeacher.filter(t => t.totalStudents > 0).length,
        orphanStudents: orphanStudents.length,
        relations: relations.slice(0, 100), // Guardar solo las primeras 100 para no sobrecargar
        byTeacher: byTeacher
      };
      
      localStorage.setItem('migration_teacher_student_relations', JSON.stringify(report));
      console.log('\n✅ Reporte guardado en localStorage con key: migration_teacher_student_relations');
    }
    
    return { relations, byTeacher };
    
  } catch (error) {
    console.error('❌ Error mapeando relaciones:', error);
    throw error;
  }
}

/**
 * Función para obtener estudiantes de un profesor específico
 */
export async function getStudentsForTeacher(teacherId: string): Promise<UserProfile[]> {
  try {
    const students: UserProfile[] = [];
    const usersRef = collection(db, 'users');
    
    // Obtener datos del profesor
    const teacherDoc = await getDoc(doc(db, 'users', teacherId));
    if (!teacherDoc.exists()) {
      throw new Error(`Profesor ${teacherId} no encontrado`);
    }
    
    const teacherData = teacherDoc.data() as UserProfile;
    
    // Buscar por escuela
    if (teacherData.idEscuela) {
      const schoolQuery = query(
        usersRef,
        where('schoolRole', '==', SchoolRole.STUDENT),
        where('idEscuela', '==', teacherData.idEscuela)
      );
      const snapshot = await getDocs(schoolQuery);
      snapshot.forEach(doc => {
        students.push({ id: doc.id, ...doc.data() } as UserProfile);
      });
    }
    
    // Buscar por idAdmin
    const adminQuery = query(
      usersRef,
      where('schoolRole', '==', SchoolRole.STUDENT),
      where('idAdmin', '==', teacherId)
    );
    const adminSnapshot = await getDocs(adminQuery);
    adminSnapshot.forEach(doc => {
      const student = { id: doc.id, ...doc.data() } as UserProfile;
      if (!students.find(s => s.id === student.id)) {
        students.push(student);
      }
    });
    
    return students;
    
  } catch (error) {
    console.error(`Error obteniendo estudiantes del profesor ${teacherId}:`, error);
    throw error;
  }
}

/**
 * Función para ejecutar desde la consola del navegador
 */
if (typeof window !== 'undefined') {
  (window as any).mapTeacherStudentRelations = mapTeacherStudentRelations;
  (window as any).getStudentsForTeacher = getStudentsForTeacher;
  console.log('💡 Funciones disponibles:');
  console.log('   - window.mapTeacherStudentRelations()');
  console.log('   - window.getStudentsForTeacher(teacherId)');
}