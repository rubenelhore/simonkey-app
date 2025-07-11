import { db } from '../services/firebase';
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';

export const fixMissingConceptsInSessions = async (userId: string) => {
  try {
    console.log('[FixMissingConcepts] === REPARANDO CONCEPTOS FALTANTES EN SESIONES ===');
    console.log('[FixMissingConcepts] Usuario:', userId);
    
    // Obtener todas las sesiones del usuario
    const sessionsQuery = query(
      collection(db, 'studySessions'),
      where('userId', '==', userId)
    );
    
    const sessionsSnap = await getDocs(sessionsQuery);
    console.log(`[FixMissingConcepts] Total sesiones encontradas: ${sessionsSnap.size}`);
    
    let sessionsWithoutConcepts = 0;
    let sessionsFixed = 0;
    let sessionsWithErrors = 0;
    
    // Procesar cada sesión
    for (const sessionDoc of sessionsSnap.docs) {
      const sessionData = sessionDoc.data();
      const sessionId = sessionDoc.id;
      
      console.log(`\n[FixMissingConcepts] Procesando sesión ${sessionId}:`);
      console.log(`  - Fecha: ${sessionData.startTime?.toDate ? sessionData.startTime.toDate().toLocaleString() : 'Sin fecha'}`);
      console.log(`  - Cuaderno: ${sessionData.notebookId || 'No especificado'}`);
      
      // Verificar si la sesión tiene conceptos
      const hasConcepts = sessionData.concepts && Array.isArray(sessionData.concepts) && sessionData.concepts.length > 0;
      
      if (!hasConcepts) {
        sessionsWithoutConcepts++;
        console.log(`  ❌ Sesión sin conceptos`);
        
        // Intentar obtener los conceptos del cuaderno
        if (sessionData.notebookId) {
          try {
            console.log(`  🔍 Buscando conceptos en cuaderno ${sessionData.notebookId}...`);
            
            const notebookDoc = await getDoc(doc(db, 'notebooks', sessionData.notebookId));
            if (notebookDoc.exists()) {
              const notebookData = notebookDoc.data();
              const concepts = notebookData.concepts || [];
              
              console.log(`  📚 Encontrados ${concepts.length} conceptos en el cuaderno`);
              
              if (concepts.length > 0) {
                // Actualizar la sesión con los conceptos del cuaderno
                await updateDoc(doc(db, 'studySessions', sessionId), {
                  concepts: concepts
                });
                
                console.log(`  ✅ Sesión actualizada con ${concepts.length} conceptos`);
                sessionsFixed++;
              } else {
                console.log(`  ⚠️ El cuaderno no tiene conceptos`);
              }
            } else {
              console.log(`  ❌ No se pudo encontrar el cuaderno`);
            }
          } catch (error) {
            console.error(`  ❌ Error al procesar sesión ${sessionId}:`, error);
            sessionsWithErrors++;
          }
        } else {
          console.log(`  ❌ Sesión sin notebookId`);
        }
      } else {
        console.log(`  ✅ Sesión ya tiene conceptos (${sessionData.concepts.length})`);
      }
    }
    
    // Resumen final
    console.log('\n[FixMissingConcepts] === RESUMEN ===');
    console.log(`📊 Total sesiones procesadas: ${sessionsSnap.size}`);
    console.log(`❌ Sesiones sin conceptos: ${sessionsWithoutConcepts}`);
    console.log(`✅ Sesiones reparadas: ${sessionsFixed}`);
    console.log(`⚠️ Sesiones con errores: ${sessionsWithErrors}`);
    
    if (sessionsFixed > 0) {
      console.log('\n💡 IMPORTANTE: Ejecuta testUpdateKPIs para recalcular los KPIs con los conceptos reparados');
    }
    
    console.log('\n=====================================');
    
    return {
      totalSessions: sessionsSnap.size,
      sessionsWithoutConcepts,
      sessionsFixed,
      sessionsWithErrors
    };
    
  } catch (error) {
    console.error('[FixMissingConcepts] Error:', error);
    throw error;
  }
};

// Función para verificar si las sesiones tienen conceptos válidos
export const validateSessionConcepts = async (userId: string) => {
  try {
    console.log('[ValidateSessionConcepts] === VALIDANDO CONCEPTOS EN SESIONES ===');
    console.log('[ValidateSessionConcepts] Usuario:', userId);
    
    const sessionsQuery = query(
      collection(db, 'studySessions'),
      where('userId', '==', userId)
    );
    
    const sessionsSnap = await getDocs(sessionsQuery);
    console.log(`[ValidateSessionConcepts] Total sesiones: ${sessionsSnap.size}`);
    
    let valid = 0;
    let invalid = 0;
    let withMetrics = 0;
    let withoutMetrics = 0;
    
    sessionsSnap.forEach(doc => {
      const session = doc.data();
      const hasConcepts = session.concepts && Array.isArray(session.concepts) && session.concepts.length > 0;
      const hasMetrics = session.metrics && (session.metrics.conceptsDominados > 0 || session.metrics.conceptosNoDominados > 0);
      
      if (hasConcepts) {
        valid++;
      } else {
        invalid++;
      }
      
      if (hasMetrics) {
        withMetrics++;
      } else {
        withoutMetrics++;
      }
    });
    
    console.log(`✅ Sesiones con conceptos válidos: ${valid}`);
    console.log(`❌ Sesiones sin conceptos: ${invalid}`);
    console.log(`📊 Sesiones con métricas de conceptos: ${withMetrics}`);
    console.log(`📊 Sesiones sin métricas de conceptos: ${withoutMetrics}`);
    
    const isValid = invalid === 0 && withMetrics === sessionsSnap.size;
    console.log(`\n🎯 ESTADO GENERAL: ${isValid ? 'VÁLIDO' : 'NECESITA REPARACIÓN'}`);
    
    return {
      totalSessions: sessionsSnap.size,
      valid,
      invalid,
      withMetrics,
      withoutMetrics,
      isValid
    };
    
  } catch (error) {
    console.error('[ValidateSessionConcepts] Error:', error);
    throw error;
  }
};

// Exponer las funciones para poder usarlas desde la consola
if (typeof window !== 'undefined') {
  (window as any).fixMissingConceptsInSessions = fixMissingConceptsInSessions;
  (window as any).validateSessionConcepts = validateSessionConcepts;
}