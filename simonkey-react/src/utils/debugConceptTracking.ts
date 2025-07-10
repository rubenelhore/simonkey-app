import { db } from '../services/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  orderBy,
  limit
} from 'firebase/firestore';

export const debugConceptTracking = async (userId: string, notebookId?: string) => {
  try {
    console.log('[DebugConceptTracking] === ANALIZANDO TRACKING DE CONCEPTOS ===');
    console.log('[DebugConceptTracking] Usuario:', userId);
    if (notebookId) console.log('[DebugConceptTracking] Cuaderno:', notebookId);
    
    // 1. Buscar todas las sesiones de estudio del usuario
    let sessionsQuery = query(
      collection(db, 'studySessions'),
      where('userId', '==', userId)
    );
    
    if (notebookId) {
      sessionsQuery = query(
        collection(db, 'studySessions'),
        where('userId', '==', userId),
        where('notebookId', '==', notebookId)
      );
    }
    
    const sessionsSnap = await getDocs(sessionsQuery);
    console.log(`\n[DebugConceptTracking] Total de sesiones encontradas: ${sessionsSnap.size}`);
    
    let totalConceptsDominados = 0;
    let totalConceptsNoDominados = 0;
    let totalConceptsEstudiados = 0;
    let sessionsWithMetrics = 0;
    let sessionsWithoutMetrics = 0;
    
    // Analizar cada sesión
    sessionsSnap.forEach(doc => {
      const session = doc.data();
      console.log(`\n[DebugConceptTracking] Sesión ${doc.id}:`);
      console.log(`  - Fecha: ${session.startTime?.toDate ? session.startTime.toDate().toLocaleString() : 'Sin fecha'}`);
      console.log(`  - Modo: ${session.mode || 'No especificado'}`);
      console.log(`  - Cuaderno: ${session.notebookId || 'No especificado'}`);
      
      if (session.metrics) {
        sessionsWithMetrics++;
        console.log('  📊 Métricas encontradas:');
        console.log(`    - conceptsDominados: ${session.metrics.conceptsDominados || 0}`);
        console.log(`    - conceptosNoDominados: ${session.metrics.conceptosNoDominados || 0}`);
        console.log(`    - conceptsStudied: ${session.metrics.conceptsStudied || 0}`);
        console.log(`    - correctAnswers: ${session.metrics.correctAnswers || 0}`);
        console.log(`    - incorrectAnswers: ${session.metrics.incorrectAnswers || 0}`);
        
        totalConceptsDominados += session.metrics.conceptsDominados || 0;
        totalConceptsNoDominados += session.metrics.conceptosNoDominados || 0;
        totalConceptsEstudiados += session.metrics.conceptsStudied || 0;
      } else {
        sessionsWithoutMetrics++;
        console.log('  ❌ Sin métricas');
      }
      
      // Verificar si hay conceptos en el campo principal
      if (session.concepts) {
        console.log(`  📚 Conceptos en sesión: ${Array.isArray(session.concepts) ? session.concepts.length : 0}`);
      }
      
      // Verificar resultados de validación
      if (session.validationResults) {
        console.log('  ✅ Resultados de validación encontrados');
        if (Array.isArray(session.validationResults)) {
          const correct = session.validationResults.filter((r: any) => r.isCorrect).length;
          const incorrect = session.validationResults.length - correct;
          console.log(`    - Correctas: ${correct}`);
          console.log(`    - Incorrectas: ${incorrect}`);
        }
      }
    });
    
    // 2. Buscar actividades relacionadas
    console.log('\n[DebugConceptTracking] === BUSCANDO ACTIVIDADES ===');
    const activitiesQuery = query(
      collection(db, 'activities'),
      where('userId', '==', userId),
      where('type', 'in', ['study_session', 'validation_completed', 'concept_validated'])
    );
    
    const activitiesSnap = await getDocs(activitiesQuery);
    console.log(`[DebugConceptTracking] Actividades encontradas: ${activitiesSnap.size}`);
    
    const activityTypes: { [key: string]: number } = {};
    activitiesSnap.forEach(doc => {
      const activity = doc.data();
      activityTypes[activity.type] = (activityTypes[activity.type] || 0) + 1;
      
      if (activity.type === 'validation_completed' && activity.details) {
        console.log(`\n[DebugConceptTracking] Validación completada:`);
        console.log(`  - Correctas: ${activity.details.correctAnswers || 0}`);
        console.log(`  - Incorrectas: ${activity.details.incorrectAnswers || 0}`);
        console.log(`  - Total conceptos: ${activity.details.totalConcepts || 0}`);
      }
    });
    
    console.log('\n[DebugConceptTracking] Tipos de actividades:');
    Object.entries(activityTypes).forEach(([type, count]) => {
      console.log(`  - ${type}: ${count}`);
    });
    
    // 3. Verificar los KPIs actuales
    console.log('\n[DebugConceptTracking] === VERIFICANDO KPIs ===');
    const kpisDoc = await getDocs(query(collection(db, 'users', userId, 'kpis')));
    
    if (!kpisDoc.empty) {
      const kpis = kpisDoc.docs[0].data();
      
      if (notebookId && kpis.cuadernos?.[notebookId]) {
        const cuadernoKpis = kpis.cuadernos[notebookId];
        console.log(`[DebugConceptTracking] KPIs del cuaderno ${notebookId}:`);
        console.log(`  - conceptosDominados: ${cuadernoKpis.conceptosDominados || 0}`);
        console.log(`  - conceptosNoDominados: ${cuadernoKpis.conceptosNoDominados || 0}`);
        console.log(`  - porcentajeDominioConceptos: ${cuadernoKpis.porcentajeDominioConceptos || 0}%`);
      }
      
      console.log('\n[DebugConceptTracking] KPIs de todos los cuadernos:');
      if (kpis.cuadernos) {
        Object.entries(kpis.cuadernos).forEach(([id, data]: [string, any]) => {
          console.log(`  ${id}: Dom=${data.conceptosDominados || 0}, NoDom=${data.conceptosNoDominados || 0}`);
        });
      }
    } else {
      console.log('[DebugConceptTracking] ❌ No se encontraron KPIs');
    }
    
    // Resumen final
    console.log('\n[DebugConceptTracking] === RESUMEN FINAL ===');
    console.log(`Total de sesiones: ${sessionsSnap.size}`);
    console.log(`  - Con métricas: ${sessionsWithMetrics}`);
    console.log(`  - Sin métricas: ${sessionsWithoutMetrics}`);
    console.log(`\nConceptos totales (suma de todas las sesiones):`);
    console.log(`  - Dominados: ${totalConceptsDominados}`);
    console.log(`  - No dominados: ${totalConceptsNoDominados}`);
    console.log(`  - Estudiados: ${totalConceptsEstudiados}`);
    
    if (sessionsWithoutMetrics > 0) {
      console.log('\n⚠️ PROBLEMA DETECTADO:');
      console.log(`${sessionsWithoutMetrics} sesiones no tienen métricas de conceptos.`);
      console.log('Esto explica por qué los contadores están bajos.');
    }
    
    console.log('\n=====================================');
    
    return {
      totalSessions: sessionsSnap.size,
      sessionsWithMetrics,
      sessionsWithoutMetrics,
      totalConceptsDominados,
      totalConceptsNoDominados,
      totalConceptsEstudiados
    };
    
  } catch (error) {
    console.error('[DebugConceptTracking] Error:', error);
    throw error;
  }
};

// Función para verificar una sesión específica
export const debugSpecificSession = async (sessionId: string) => {
  try {
    console.log('[DebugSpecificSession] Analizando sesión:', sessionId);
    
    // Buscar en todas las colecciones posibles
    const collections = ['studySessions', 'activities', 'validations'];
    
    for (const collName of collections) {
      try {
        const docs = await getDocs(query(collection(db, collName)));
        
        docs.forEach(doc => {
          if (doc.id === sessionId || (doc.data().sessionId === sessionId)) {
            console.log(`\n[DebugSpecificSession] Encontrado en ${collName}:`);
            console.log(doc.data());
          }
        });
      } catch (e) {
        console.log(`[DebugSpecificSession] Colección ${collName} no existe o error`);
      }
    }
    
  } catch (error) {
    console.error('[DebugSpecificSession] Error:', error);
  }
};

// Exponer las funciones para poder usarlas desde la consola
(window as any).debugConceptTracking = debugConceptTracking;
(window as any).debugSpecificSession = debugSpecificSession;