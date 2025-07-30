import { db } from '../services/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

/**
 * Script de debug para verificar por qué las métricas del profesor están en 0
 */
export async function debugTeacherKpis() {
  console.log('🔍 [DEBUG] Iniciando debug de KPIs del profesor...');
  
  try {
    // Obtener algunos estudiantes de ejemplo
    const studentsQuery = query(
      collection(db, 'users'),
      where('subscription', '==', 'school'),
      where('schoolRole', '==', 'student')
    );
    const studentsSnap = await getDocs(studentsQuery);
    
    console.log(`📊 [DEBUG] Estudiantes encontrados: ${studentsSnap.size}`);
    
    // Verificar los primeros 3 estudiantes
    let count = 0;
    for (const studentDoc of studentsSnap.docs) {
      if (count >= 3) break;
      count++;
      
      const studentData = studentDoc.data();
      const studentId = studentDoc.id;
      
      console.log(`\n👤 [DEBUG] Estudiante ${count}: ${studentId}`);
      console.log(`  - Nombre: ${studentData.displayName || studentData.email}`);
      console.log(`  - idCuadernos:`, studentData.idCuadernos);
      console.log(`  - idInstitucion: ${studentData.idInstitucion}`);
      console.log(`  - idEscuela: ${studentData.idEscuela}`);
      
      // Verificar si tiene KPIs
      const kpisDoc = await getDoc(doc(db, 'users', studentId, 'kpis', 'dashboard'));
      console.log(`  - Tiene KPIs dashboard: ${kpisDoc.exists()}`);
      
      if (kpisDoc.exists()) {
        const kpisData = kpisDoc.data();
        console.log(`  - KPIs global:`, {
          tiempoEstudioTotal: kpisData.global?.tiempoEstudioTotal,
          totalCuadernos: kpisData.global?.totalCuadernos,
          totalConceptos: kpisData.global?.totalConceptos
        });
        
        // Verificar cuadernos específicos
        if (kpisData.cuadernos && typeof kpisData.cuadernos === 'object') {
          const cuadernosKpis = Object.keys(kpisData.cuadernos);
          console.log(`  - Cuadernos con KPIs: ${cuadernosKpis.length}`);
          
          cuadernosKpis.slice(0, 2).forEach(cuadernoId => {
            const cuadernoKpi = kpisData.cuadernos[cuadernoId];
            console.log(`    - Cuaderno ${cuadernoId}:`, {
              scoreCuaderno: cuadernoKpi.scoreCuaderno,
              conceptosDominados: cuadernoKpi.conceptosDominados,
              tiempoEstudioLocal: cuadernoKpi.tiempoEstudioLocal,
              estudiosInteligentesLocal: cuadernoKpi.estudiosInteligentesLocal
            });
          });
        } else {
          console.log(`  - ❌ No tiene cuadernos en KPIs o no es un objeto`);
        }
      }
      
      // Verificar si tiene sesiones de estudio
      const sessionsQuery = query(
        collection(db, 'studySessions'),
        where('userId', '==', studentId)
      );
      const sessionsSnap = await getDocs(sessionsQuery);
      console.log(`  - Sesiones de estudio: ${sessionsSnap.size}`);
      
      // Verificar si tiene datos de aprendizaje
      const learningQuery = query(
        collection(db, 'users', studentId, 'learningData')
      );
      const learningSnap = await getDocs(learningQuery);
      console.log(`  - Datos de aprendizaje: ${learningSnap.size}`);
    }
    
    // Verificar también cuadernos específicos
    console.log('\n📚 [DEBUG] Verificando cuadernos...');
    const notebooksQuery = query(collection(db, 'schoolNotebooks'));
    const notebooksSnap = await getDocs(notebooksQuery);
    
    console.log(`📊 [DEBUG] Total cuadernos escolares: ${notebooksSnap.size}`);
    
    // Mostrar algunos cuadernos de ejemplo
    let notebookCount = 0;
    notebooksSnap.forEach(doc => {
      if (notebookCount < 3) {
        const data = doc.data();
        console.log(`  - Cuaderno ${doc.id}: ${data.title} (Materia: ${data.idMateria})`);
        notebookCount++;
      }
    });
    
  } catch (error) {
    console.error('❌ [DEBUG] Error en debug:', error);
  }
}

// Auto-ejecutar si está en modo debug
if (typeof window !== 'undefined' && window.location?.search?.includes('debug=teacher-kpis')) {
  console.log('🚀 Auto-ejecutando debug de KPIs del profesor...');
  debugTeacherKpis();
}