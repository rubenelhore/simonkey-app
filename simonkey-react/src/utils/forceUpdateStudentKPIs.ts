import { db } from '../services/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { kpiService } from '../services/kpiService';

/**
 * Fuerza la actualización de KPIs de todos los estudiantes de una institución
 */
export async function forceUpdateStudentKPIs(teacherUserProfile: any) {
  console.log('🔄 [ForceUpdateStudentKPIs] Iniciando actualización masiva de KPIs...');
  console.log('👨‍🏫 [ForceUpdateStudentKPIs] Profesor:', teacherUserProfile);
  
  try {
    // Buscar el ID de la institución
    let institutionId = teacherUserProfile.idEscuela || teacherUserProfile.idInstitucion;
    
    if (!institutionId && teacherUserProfile.idAdmin) {
      console.log('🔍 [ForceUpdateStudentKPIs] Obteniendo institución del admin:', teacherUserProfile.idAdmin);
      
      // Intentar buscar en varias colecciones
      let adminDoc = await getDoc(doc(db, 'users', teacherUserProfile.idAdmin));
      
      if (!adminDoc.exists()) {
        console.log('📍 [ForceUpdateStudentKPIs] Admin no encontrado en users, buscando en schoolAdmins...');
        adminDoc = await getDoc(doc(db, 'schoolAdmins', teacherUserProfile.idAdmin));
      }
      
      if (adminDoc.exists()) {
        const adminData = adminDoc.data();
        institutionId = adminData.idEscuela || adminData.idInstitucion;
        console.log('🏫 [ForceUpdateStudentKPIs] Institución obtenida del admin:', institutionId);
      }
    }
    
    if (!institutionId) {
      console.error('❌ [ForceUpdateStudentKPIs] No se pudo encontrar ID de institución');
      return;
    }
    
    console.log('🏫 [ForceUpdateStudentKPIs] ID institución:', institutionId);
    
    // Buscar estudiantes de la institución
    let studentsQuery = query(
      collection(db, 'users'),
      where('subscription', '==', 'school'),
      where('schoolRole', '==', 'student'),
      where('idEscuela', '==', institutionId)
    );
    
    let studentsSnap = await getDocs(studentsQuery);
    console.log(`👥 [ForceUpdateStudentKPIs] Estudiantes encontrados con idEscuela: ${studentsSnap.size}`);
    
    // Si no encuentra con idEscuela, intentar con idInstitucion
    if (studentsSnap.size === 0) {
      console.log('🔄 [ForceUpdateStudentKPIs] Intentando con idInstitucion...');
      studentsQuery = query(
        collection(db, 'users'),
        where('subscription', '==', 'school'),
        where('schoolRole', '==', 'student'),
        where('idInstitucion', '==', institutionId)
      );
      studentsSnap = await getDocs(studentsQuery);
      console.log(`👥 [ForceUpdateStudentKPIs] Estudiantes encontrados con idInstitucion: ${studentsSnap.size}`);
    }
    
    if (studentsSnap.size === 0) {
      console.warn('⚠️ [ForceUpdateStudentKPIs] No se encontraron estudiantes');
      return;
    }
    
    // Actualizar KPIs de cada estudiante
    const updatePromises: Promise<void>[] = [];
    const students: any[] = [];
    
    studentsSnap.forEach(studentDoc => {
      const studentData = studentDoc.data();
      students.push({
        id: studentDoc.id,
        name: studentData.displayName || studentData.email,
        idCuadernos: studentData.idCuadernos || []
      });
      
      // Agregar promesa de actualización
      updatePromises.push(
        kpiService.updateUserKPIs(studentDoc.id).catch(error => {
          console.error(`❌ [ForceUpdateStudentKPIs] Error actualizando KPIs para ${studentDoc.id}:`, error);
        })
      );
    });
    
    console.log('📊 [ForceUpdateStudentKPIs] Estudiantes a actualizar:', students);
    console.log(`🚀 [ForceUpdateStudentKPIs] Iniciando actualización de ${updatePromises.length} estudiantes...`);
    
    // Ejecutar todas las actualizaciones en paralelo
    await Promise.allSettled(updatePromises);
    
    console.log('✅ [ForceUpdateStudentKPIs] Actualización masiva completada');
    
    // Log final de resumen
    console.log(`📈 [ForceUpdateStudentKPIs] Resumen:
      - Institución: ${institutionId}
      - Estudiantes procesados: ${students.length}
      - Estudiantes: ${students.map(s => s.name).join(', ')}`);
    
    return {
      institutionId,
      studentsProcessed: students.length,
      students: students
    };
    
  } catch (error) {
    console.error('❌ [ForceUpdateStudentKPIs] Error en actualización masiva:', error);
    throw error;
  }
}

/**
 * Función auxiliar para actualizar KPIs de un estudiante específico
 */
export async function updateSingleStudentKPIs(studentId: string) {
  console.log(`🔄 [UpdateSingleStudentKPIs] Actualizando KPIs para: ${studentId}`);
  
  try {
    await kpiService.updateUserKPIs(studentId);
    console.log(`✅ [UpdateSingleStudentKPIs] KPIs actualizados para: ${studentId}`);
  } catch (error) {
    console.error(`❌ [UpdateSingleStudentKPIs] Error actualizando KPIs para ${studentId}:`, error);
    throw error;
  }
}

// Auto-ejecutar si está en modo debug
if (typeof window !== 'undefined' && window.location?.search?.includes('debug=force-student-kpis')) {
  console.log('🚀 Auto-ejecutando actualización de KPIs de estudiantes...');
  // Esta función requiere el profile del profesor, así que no se puede auto-ejecutar
  // Se debe llamar manualmente desde la página de analytics
}