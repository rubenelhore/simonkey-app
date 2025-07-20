import { auth, db } from '../services/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

export const debugExams = async (materiaId?: string) => {
  console.log('🔍 === DIAGNÓSTICO DE EXÁMENES ===');
  
  try {
    const user = auth.currentUser;
    if (!user) {
      console.log('❌ No hay usuario autenticado');
      return;
    }

    console.log('👤 Usuario:', user.email);
    console.log('🆔 UID:', user.uid);

    // 1. Verificar el perfil del usuario
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists()) {
      console.log('❌ No se encontró el perfil del usuario');
      return;
    }

    const userData = userDoc.data();
    console.log('\n📋 Datos del usuario:');
    console.log('   - Subscription:', userData.subscription);
    console.log('   - School Role:', userData.schoolRole);
    console.log('   - ID Escuela:', userData.idEscuela || 'NO ASIGNADA ⚠️');
    console.log('   - ID Institución:', userData.idInstitucion || 'NO ASIGNADA');
    console.log('   - ID Admin:', userData.idAdmin || 'NO ASIGNADO');

    // 2. Si es estudiante escolar, verificar su escuela
    if (userData.subscription === 'school' && userData.schoolRole === 'student') {
      if (!userData.idEscuela) {
        console.log('❌ El estudiante no tiene una escuela asignada (idEscuela)');
        console.log('💡 Un administrador debe asignar el campo idEscuela al estudiante');
        return;
      }
      console.log('✅ Estudiante de la escuela:', userData.idEscuela);
    }

    // 3. Buscar TODOS los exámenes en la base de datos
    console.log('\n📚 BUSCANDO TODOS LOS EXÁMENES:');
    const allExamsQuery = query(collection(db, 'schoolExams'));
    const allExamsSnapshot = await getDocs(allExamsQuery);
    
    console.log(`📊 Total de exámenes en la base de datos: ${allExamsSnapshot.size}`);
    
    allExamsSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`\n📝 Examen ${index + 1}:`, {
        id: doc.id,
        title: data.title,
        idMateria: data.idMateria,
        idEscuela: data.idEscuela,
        idProfesor: data.idProfesor,
        isActive: data.isActive,
        createdAt: data.createdAt?.toDate?.() || data.createdAt
      });
    });

    // 4. Si se especificó una materia, buscar exámenes de esa materia
    if (materiaId) {
      console.log(`\n🎯 BUSCANDO EXÁMENES DE LA MATERIA ${materiaId}:`);
      
      // Buscar exámenes activos de la materia
      const materiaExamsQuery = query(
        collection(db, 'schoolExams'),
        where('idMateria', '==', materiaId),
        where('isActive', '==', true)
      );
      
      try {
        const materiaExamsSnapshot = await getDocs(materiaExamsQuery);
        console.log(`📊 Exámenes activos en la materia: ${materiaExamsSnapshot.size}`);
        
        materiaExamsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          console.log('   - Examen:', {
            id: doc.id,
            title: data.title,
            idEscuela: data.idEscuela
          });
        });
      } catch (error: any) {
        if (error?.code === 'failed-precondition') {
          console.log('❌ Error: Se requiere un índice compuesto en Firestore');
          console.log('💡 Crea un índice con los campos:');
          console.log('   - idMateria (Ascending)');
          console.log('   - isActive (Ascending)');
        } else {
          console.error('❌ Error buscando exámenes:', error);
        }
      }
    }

    // 5. Para estudiantes, verificar con el ExamService
    if (userData.subscription === 'school' && userData.schoolRole === 'student' && userData.idEscuela && materiaId) {
      console.log('\n🔍 VERIFICANDO CON ExamService:');
      try {
        const { ExamService } = await import('../services/examService');
        const activeExams = await ExamService.getActiveExamsForStudent(user.uid, materiaId);
        console.log(`✅ Exámenes activos para el estudiante en esta materia: ${activeExams.length}`);
        
        activeExams.forEach(exam => {
          console.log('   - Examen:', {
            id: exam.id,
            title: exam.title,
            idMateria: exam.idMateria,
            idEscuela: exam.idEscuela
          });
        });
      } catch (error) {
        console.error('❌ Error con ExamService:', error);
      }
    }

    console.log('\n✅ Diagnóstico completado');

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
  }
};

// Registrar función globalmente
if (typeof window !== 'undefined') {
  (window as any).debugExams = debugExams;
  console.log('🔧 Función debugExams(materiaId?) disponible en la consola');
}