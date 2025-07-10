import { db } from '../services/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

export const debugStudySessionCompletion = async (userId: string) => {
  try {
    console.log('[DebugStudySessionCompletion] === ANALIZANDO PROBLEMAS EN COMPLETAR SESIONES ===');
    console.log('[DebugStudySessionCompletion] Usuario:', userId);
    
    // Obtener las sesiones más recientes
    const sessionsQuery = query(
      collection(db, 'studySessions'),
      where('userId', '==', userId),
      orderBy('startTime', 'desc'),
      limit(5)
    );
    
    const sessionsSnap = await getDocs(sessionsQuery);
    console.log(`[DebugStudySessionCompletion] Analizando ${sessionsSnap.size} sesiones recientes`);
    
    // Analizar cada sesión en detalle
    sessionsSnap.forEach(doc => {
      const session = doc.data();
      console.log(`\n[DebugStudySessionCompletion] ===== SESIÓN ${doc.id} =====`);
      console.log(`  Fecha: ${session.startTime?.toDate ? session.startTime.toDate().toLocaleString() : 'Sin fecha'}`);
      console.log(`  Modo: ${session.mode || 'No especificado'}`);
      console.log(`  Cuaderno: ${session.notebookId || 'No especificado'}`);
      console.log(`  Completada: ${session.endTime ? 'Sí' : 'No'}`);
      
      // Análisis del problema de conceptos
      console.log(`\n  🔍 ANÁLISIS DEL PROBLEMA:`);
      
      // 1. Verificar si hay conceptos
      if (session.concepts) {
        if (Array.isArray(session.concepts)) {
          console.log(`  ✅ Conceptos encontrados: ${session.concepts.length}`);
          if (session.concepts.length > 0) {
            console.log(`  📚 Primer concepto:`, session.concepts[0].término || session.concepts[0].id);
          }
        } else {
          console.log(`  ❌ Conceptos no es array:`, typeof session.concepts);
        }
      } else {
        console.log(`  ❌ No hay conceptos en la sesión`);
      }
      
      // 2. Verificar métricas
      if (session.metrics) {
        console.log(`  📊 Métricas de conceptos:`);
        console.log(`    - conceptsDominados: ${session.metrics.conceptsDominados} (${typeof session.metrics.conceptsDominados})`);
        console.log(`    - conceptosNoDominados: ${session.metrics.conceptosNoDominados} (${typeof session.metrics.conceptosNoDominados})`);
        console.log(`    - conceptsStudied: ${session.metrics.conceptsStudied} (${typeof session.metrics.conceptsStudied})`);
        console.log(`    - conceptsReviewed: ${session.metrics.conceptsReviewed} (${typeof session.metrics.conceptsReviewed})`);
        console.log(`    - mastered: ${session.metrics.mastered} (${typeof session.metrics.mastered})`);
        console.log(`    - reviewing: ${session.metrics.reviewing} (${typeof session.metrics.reviewing})`);
        
        // Verificar si hay detalles de conceptos
        if (session.metrics.conceptsDetails) {
          console.log(`    - conceptsDetails: ${session.metrics.conceptsDetails.length} entradas`);
          if (session.metrics.conceptsDetails.length > 0) {
            console.log(`    - Primer detail:`, session.metrics.conceptsDetails[0]);
          }
        } else {
          console.log(`    - ❌ No hay conceptsDetails`);
        }
      } else {
        console.log(`  ❌ No hay métricas`);
      }
      
      // 3. Verificar validación
      if (session.validationResults) {
        console.log(`  ✅ Resultados de validación:`);
        if (Array.isArray(session.validationResults)) {
          const correct = session.validationResults.filter((r: any) => r.isCorrect).length;
          const incorrect = session.validationResults.length - correct;
          console.log(`    - Total respuestas: ${session.validationResults.length}`);
          console.log(`    - Correctas: ${correct}`);
          console.log(`    - Incorrectas: ${incorrect}`);
        }
      } else {
        console.log(`  ❌ No hay resultados de validación`);
      }
      
      // 4. Diagnóstico del problema
      console.log(`\n  💡 DIAGNÓSTICO:`);
      
      const hasConcepts = session.concepts && Array.isArray(session.concepts) && session.concepts.length > 0;
      const hasMetrics = session.metrics;
      const hasZeroConcepts = session.metrics && session.metrics.conceptsDominados === 0 && session.metrics.conceptosNoDominados === 0;
      const hasValidation = session.validationResults && Array.isArray(session.validationResults);
      
      if (!hasConcepts) {
        console.log(`  ❌ PROBLEMA: No hay conceptos en la sesión`);
        console.log(`     - Esto significa que allConcepts estaba vacío cuando se completó`);
        console.log(`     - Verificar que los conceptos se carguen correctamente`);
      }
      
      if (hasMetrics && hasZeroConcepts) {
        console.log(`  ❌ PROBLEMA: Conceptos dominados/no dominados = 0`);
        console.log(`     - Esto significa que masteredConceptIds estaba vacío`);
        console.log(`     - Verificar que las respuestas se registren correctamente`);
      }
      
      if (!hasValidation) {
        console.log(`  ⚠️ ADVERTENCIA: No hay resultados de validación`);
        console.log(`     - Esto puede indicar que la sesión no se completó correctamente`);
      }
      
      if (hasConcepts && hasMetrics && !hasZeroConcepts) {
        console.log(`  ✅ NORMAL: Esta sesión parece estar bien`);
      }
    });
    
    console.log('\n[DebugStudySessionCompletion] === RESUMEN DE PROBLEMAS ===');
    
    let problemSessions = 0;
    let normalSessions = 0;
    
    sessionsSnap.forEach(doc => {
      const session = doc.data();
      const hasConcepts = session.concepts && Array.isArray(session.concepts) && session.concepts.length > 0;
      const hasZeroConcepts = session.metrics && session.metrics.conceptsDominados === 0 && session.metrics.conceptosNoDominados === 0;
      
      if (!hasConcepts || hasZeroConcepts) {
        problemSessions++;
      } else {
        normalSessions++;
      }
    });
    
    console.log(`📊 Sesiones con problemas: ${problemSessions}/${sessionsSnap.size}`);
    console.log(`📊 Sesiones normales: ${normalSessions}/${sessionsSnap.size}`);
    
    if (problemSessions > 0) {
      console.log('\n💡 PASOS PARA SOLUCIONAR:');
      console.log('1. Verificar que allConcepts se cargue correctamente en las páginas de estudio');
      console.log('2. Verificar que masteredConceptIds se actualice cuando el usuario responde');
      console.log('3. Agregar logging a la función completeStudySession local');
      console.log('4. Verificar que la lógica de conteo funcione correctamente');
    }
    
    console.log('\n=====================================');
    
    return {
      totalSessions: sessionsSnap.size,
      problemSessions,
      normalSessions
    };
    
  } catch (error) {
    console.error('[DebugStudySessionCompletion] Error:', error);
    throw error;
  }
};

// Exponer la función para poder usarla desde la consola
if (typeof window !== 'undefined') {
  (window as any).debugStudySessionCompletion = debugStudySessionCompletion;
}