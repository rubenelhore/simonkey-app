import { db } from '../services/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

export const debugConceptCounting = async (userId: string) => {
  try {
    console.log('[DebugConceptCounting] === ANALIZANDO LÓGICA DE CONTEO DE CONCEPTOS ===');
    console.log('[DebugConceptCounting] Usuario:', userId);
    
    // Obtener las sesiones más recientes
    const sessionsQuery = query(
      collection(db, 'studySessions'),
      where('userId', '==', userId),
      orderBy('startTime', 'desc'),
      limit(10)
    );
    
    const sessionsSnap = await getDocs(sessionsQuery);
    console.log(`[DebugConceptCounting] Analizando ${sessionsSnap.size} sesiones recientes`);
    
    // Analizar cada sesión
    sessionsSnap.forEach(doc => {
      const session = doc.data();
      console.log(`\n[DebugConceptCounting] ===== SESIÓN ${doc.id} =====`);
      console.log(`  Fecha: ${session.startTime?.toDate ? session.startTime.toDate().toLocaleString() : 'Sin fecha'}`);
      console.log(`  Modo: ${session.mode || 'No especificado'}`);
      console.log(`  Cuaderno: ${session.notebookId || 'No especificado'}`);
      console.log(`  Completada: ${session.endTime ? 'Sí' : 'No'}`);
      
      // Verificar si tiene conceptos
      if (session.concepts) {
        console.log(`  📚 Conceptos en sesión: ${Array.isArray(session.concepts) ? session.concepts.length : 0}`);
        if (Array.isArray(session.concepts) && session.concepts.length > 0) {
          console.log(`  📚 Primeros conceptos:`, session.concepts.slice(0, 3).map((c: any) => c.término || c.id));
        }
      }
      
      // Verificar métricas
      if (session.metrics) {
        console.log(`  📊 Métricas:`);
        console.log(`    - conceptsDominados: ${session.metrics.conceptsDominados || 0}`);
        console.log(`    - conceptosNoDominados: ${session.metrics.conceptosNoDominados || 0}`);
        console.log(`    - conceptsStudied: ${session.metrics.conceptsStudied || 0}`);
        console.log(`    - conceptsReviewed: ${session.metrics.conceptsReviewed || 0}`);
        console.log(`    - mastered: ${session.metrics.mastered || 0}`);
        console.log(`    - reviewing: ${session.metrics.reviewing || 0}`);
        console.log(`    - timeSpent: ${session.metrics.timeSpent || 0} minutos`);
        console.log(`    - sessionDuration: ${session.metrics.sessionDuration || 0} segundos`);
        
        // Verificar si hay detalles de conceptos
        if (session.metrics.conceptsDetails && Array.isArray(session.metrics.conceptsDetails)) {
          console.log(`    - conceptsDetails: ${session.metrics.conceptsDetails.length} entradas`);
          if (session.metrics.conceptsDetails.length > 0) {
            console.log(`    - Ejemplo de detail:`, session.metrics.conceptsDetails[0]);
          }
        }
      } else {
        console.log(`  ❌ Sin métricas`);
      }
      
      // Verificar resultados de validación
      if (session.validationResults) {
        console.log(`  ✅ Resultados de validación:`);
        if (Array.isArray(session.validationResults)) {
          const correct = session.validationResults.filter((r: any) => r.isCorrect).length;
          const incorrect = session.validationResults.length - correct;
          console.log(`    - Total respuestas: ${session.validationResults.length}`);
          console.log(`    - Correctas: ${correct}`);
          console.log(`    - Incorrectas: ${incorrect}`);
        }
      }
      
      // Verificar si está validada
      if (session.validated !== undefined) {
        console.log(`  🔍 Validada: ${session.validated ? 'Sí' : 'No'}`);
      }
    });
    
    console.log('\n[DebugConceptCounting] === POSIBLES PROBLEMAS DETECTADOS ===');
    
    let sessionsWithoutConcepts = 0;
    let sessionsWithoutMetrics = 0;
    let sessionsWithZeroConcepts = 0;
    let sessionsWithValidation = 0;
    
    sessionsSnap.forEach(doc => {
      const session = doc.data();
      
      if (!session.concepts || (Array.isArray(session.concepts) && session.concepts.length === 0)) {
        sessionsWithoutConcepts++;
      }
      
      if (!session.metrics) {
        sessionsWithoutMetrics++;
      }
      
      if (session.metrics && (session.metrics.conceptsDominados === 0 && session.metrics.conceptosNoDominados === 0)) {
        sessionsWithZeroConcepts++;
      }
      
      if (session.validationResults && Array.isArray(session.validationResults)) {
        sessionsWithValidation++;
      }
    });
    
    console.log(`⚠️ Sesiones sin conceptos: ${sessionsWithoutConcepts}/${sessionsSnap.size}`);
    console.log(`⚠️ Sesiones sin métricas: ${sessionsWithoutMetrics}/${sessionsSnap.size}`);
    console.log(`⚠️ Sesiones con 0 conceptos dom/no-dom: ${sessionsWithZeroConcepts}/${sessionsSnap.size}`);
    console.log(`✅ Sesiones con validación: ${sessionsWithValidation}/${sessionsSnap.size}`);
    
    // Posibles causas
    console.log('\n[DebugConceptCounting] === POSIBLES CAUSAS ===');
    
    if (sessionsWithoutConcepts > 0) {
      console.log('❌ Algunas sesiones no tienen conceptos asociados');
      console.log('   - Verificar que allConcepts se esté cargando correctamente');
      console.log('   - Verificar que los conceptos se estén asociando a la sesión');
    }
    
    if (sessionsWithZeroConcepts > 0) {
      console.log('❌ Algunas sesiones tienen conceptos pero 0 dominados/no dominados');
      console.log('   - Verificar que masteredConceptIds se esté llenando correctamente');
      console.log('   - Verificar que la lógica de conteo esté funcionando');
    }
    
    if (sessionsWithValidation < sessionsSnap.size) {
      console.log('⚠️ Algunas sesiones no tienen resultados de validación');
      console.log('   - Esto puede indicar sesiones sin completar o sin Mini Quiz');
    }
    
    console.log('\n[DebugConceptCounting] === RECOMENDACIONES ===');
    console.log('1. Verificar que allConcepts tenga datos cuando se completa la sesión');
    console.log('2. Verificar que masteredConceptIds se esté llenando durante el estudio');
    console.log('3. Verificar que la lógica de conteo en completeStudySession funcione');
    console.log('4. Considerar agregar más logging a la función completeStudySession');
    
    console.log('\n=====================================');
    
    return {
      totalSessions: sessionsSnap.size,
      sessionsWithoutConcepts,
      sessionsWithoutMetrics,
      sessionsWithZeroConcepts,
      sessionsWithValidation
    };
    
  } catch (error) {
    console.error('[DebugConceptCounting] Error:', error);
    throw error;
  }
};

// Exponer la función para poder usarla desde la consola
if (typeof window !== 'undefined') {
  (window as any).debugConceptCounting = debugConceptCounting;
}