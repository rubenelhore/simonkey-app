import { UnifiedConceptService } from '../services/unifiedConceptService';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../services/firebase';

export async function getDomainProgressForNotebook(notebookId: string, userId?: string) {
  // Get concepts using UnifiedConceptService
  const concepts = await UnifiedConceptService.getConcepts(notebookId);
  const total = concepts.length;
  
  if (total === 0) {
    return { total: 0, dominated: 0, learning: 0, notStarted: 0 };
  }
  
  // Use provided userId or current user
  let targetUserId = userId;
  if (!targetUserId) {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return { total, dominated: 0, learning: 0, notStarted: total };
    }
    targetUserId = currentUser.uid;
  }
  
  try {
    // Get all concept IDs from the notebook
    const conceptIds = concepts.map(c => c.id);
    const learningDataMap = new Map<string, any>();
    
    // Procesar los conceptos en lotes más pequeños para no saturar
    const BATCH_SIZE = 10;
    for (let i = 0; i < conceptIds.length; i += BATCH_SIZE) {
      const batch = conceptIds.slice(i, Math.min(i + BATCH_SIZE, conceptIds.length));
      
      const batchPromises = batch.map(async (conceptId) => {
        try {
          const learningDataRef = doc(db, 'users', targetUserId, 'learningData', conceptId);
          const learningDataSnap = await getDoc(learningDataRef);
          
          if (learningDataSnap.exists()) {
            const data = learningDataSnap.data();
            return { 
              conceptId, 
              repetitions: data.repetitions || 0,
              interval: data.interval || 1,
              easeFactor: data.easeFactor || 2.5,
              hasLearningData: true,
              lastModule: data.lastModule || null
            };
          } else {
            return { 
              conceptId, 
              repetitions: 0, 
              interval: 1, 
              easeFactor: 2.5, 
              hasLearningData: false,
              lastModule: null
            };
          }
        } catch (error) {
          // Silenciar warnings para no saturar la consola
          return { 
            conceptId, 
            repetitions: 0, 
            interval: 1, 
            easeFactor: 2.5, 
            hasLearningData: false,
            lastModule: null
          };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach((result) => {
        learningDataMap.set(result.conceptId, result);
        // Log detailed SM-3 data for debugging
        if (result.hasLearningData) {
          console.log(`🔍 SM-3 Data for ${result.conceptId}: reps=${result.repetitions}, interval=${result.interval?.toFixed(2)}, ease=${result.easeFactor?.toFixed(2)}, module=${result.lastModule}`);
        }
      });
    }
    
    // Calculate progress based on SM-3 data (más sofisticado)
    let dominated = 0;
    let learning = 0;
    let notStarted = 0;
    
    conceptIds.forEach(conceptId => {
      const data = learningDataMap.get(conceptId) || { repetitions: 0, interval: 1, hasLearningData: false, easeFactor: 2.5 };
      
      if (!data.hasLearningData) {
        // No ha sido estudiado nunca
        notStarted++;
      } else if (data.repetitions >= 2 || data.interval >= 7 || (data.repetitions >= 1 && data.easeFactor > 2.6)) {
        // Criterio mejorado para dominado:
        // - 2+ repeticiones exitosas, O
        // - Intervalo largo (>=7 días), O  
        // - Al menos 1 repetición con ease factor alto (>2.6)
        // Esto captura conceptos dominados con SM-3 en cualquier modo
        dominated++;
      } else if (data.repetitions >= 1 || data.interval > 1 || (data.repetitions === 0 && data.interval >= 0.25)) {
        // En proceso de aprendizaje:
        // - 1+ repeticiones, O
        // - Intervalo > inicial (1 día), O
        // - Ha sido estudiado al menos una vez (interval >= 6 horas para Study Path Mode)
        // Esto incluye conceptos estudiados que necesitan refuerzo
        learning++;
      } else {
        // Muy poco progreso o datos inconsistentes
        notStarted++;
      }
    });
    
    // Solo log si hay progreso significativo
    if (dominated > 0 || learning > 0) {
      const dominatedPercentage = total > 0 ? Math.round((dominated/total)*100) : 0;
      const learningPercentage = total > 0 ? Math.round((learning/total)*100) : 0;
      console.log(`📊 SM-3 Progress for notebook ${notebookId}: ${dominated}/${total} dominados (${dominatedPercentage}%), ${learning} aprendiendo (${learningPercentage}%)`);
      
      // Log adicional de conceptos con datos SM-3
      const withData = Array.from(learningDataMap.values()).filter(d => d.hasLearningData);
      console.log(`🧠 Conceptos con datos SM-3: ${withData.length}/${total}`);
      if (withData.length > 0) {
        const avgInterval = withData.reduce((sum, d) => sum + d.interval, 0) / withData.length;
        const avgEaseFactor = withData.reduce((sum, d) => sum + d.easeFactor, 0) / withData.length;
        const avgReps = withData.reduce((sum, d) => sum + d.repetitions, 0) / withData.length;
        console.log(`📈 Promedios SM-3: ${avgInterval.toFixed(1)} días intervalo, ${avgEaseFactor.toFixed(2)} ease factor, ${avgReps.toFixed(1)} repeticiones`);
        
        // Log de distribución por estado
        const dominatedConcepts = withData.filter(d => 
          d.repetitions >= 2 || d.interval >= 7 || (d.repetitions >= 1 && d.easeFactor > 2.6)
        );
        const learningConcepts = withData.filter(d => 
          (d.repetitions >= 1 || d.interval > 1 || (d.repetitions === 0 && d.interval >= 0.25)) &&
          !(d.repetitions >= 2 || d.interval >= 7 || (d.repetitions >= 1 && d.easeFactor > 2.6))
        );
        console.log(`🎯 Desglose detallado: ${dominatedConcepts.length} dominados, ${learningConcepts.length} aprendiendo`);
      }
    }
    
    return { total, dominated, learning, notStarted };
  } catch (error) {
    console.error('Error fetching learning data:', error);
    return { total, dominated: 0, learning: 0, notStarted: total };
  }
}

export async function getDomainProgressForMateria(materiaId: string) {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return { total: 0, dominated: 0, learning: 0, notStarted: 0 };
  }

  try {
    // Primero verificar si el usuario está inscrito en esta materia
    const enrollmentQuery = query(
      collection(db, 'enrollments'),
      where('studentId', '==', currentUser.uid),
      where('materiaId', '==', materiaId),
      where('status', '==', 'active')
    );
    const enrollmentSnapshot = await getDocs(enrollmentQuery);
    
    let notebooksQuery;
    
    if (!enrollmentSnapshot.empty) {
      // Si está inscrito, buscar notebooks del profesor
      const teacherId = enrollmentSnapshot.docs[0].data().teacherId;
      notebooksQuery = query(
        collection(db, 'notebooks'),
        where('materiaId', '==', materiaId),
        where('userId', '==', teacherId)
      );
    } else {
      // Si no está inscrito, buscar sus propios notebooks
      notebooksQuery = query(
        collection(db, 'notebooks'),
        where('materiaId', '==', materiaId),
        where('userId', '==', currentUser.uid)
      );
    }
    
    const notebooksSnapshot = await getDocs(notebooksQuery);
    
    // Si no hay notebooks, retornar sin procesar
    if (notebooksSnapshot.empty) {
      return { total: 0, dominated: 0, learning: 0, notStarted: 0 };
    }
    
    // Limitar el número de notebooks procesados en paralelo para materias con muchos notebooks
    const MAX_PARALLEL_NOTEBOOKS = 5;
    const notebookDocs = notebooksSnapshot.docs;
    
    let totalDominated = 0;
    let totalLearning = 0;
    let totalNotStarted = 0;
    let totalConcepts = 0;
    
    // Procesar notebooks en lotes si hay muchos
    if (notebookDocs.length > MAX_PARALLEL_NOTEBOOKS) {
      for (let i = 0; i < notebookDocs.length; i += MAX_PARALLEL_NOTEBOOKS) {
        const batch = notebookDocs.slice(i, Math.min(i + MAX_PARALLEL_NOTEBOOKS, notebookDocs.length));
        const batchProgress = await Promise.all(
          batch.map(doc => getDomainProgressForNotebook(doc.id))
        );
        
        batchProgress.forEach(progress => {
          totalDominated += progress.dominated;
          totalLearning += progress.learning;
          totalNotStarted += progress.notStarted;
          totalConcepts += progress.total;
        });
      }
    } else {
      // Procesar todos en paralelo si son pocos
      const allProgress = await Promise.all(
        notebookDocs.map(doc => getDomainProgressForNotebook(doc.id))
      );
      
      allProgress.forEach(progress => {
        totalDominated += progress.dominated;
        totalLearning += progress.learning;
        totalNotStarted += progress.notStarted;
        totalConcepts += progress.total;
      });
    }
    
    const dominatedPercentage = totalConcepts > 0 ? Math.round((totalDominated/totalConcepts)*100) : 0;
    console.log(`📚 Domain progress for materia ${materiaId}: Total: ${totalConcepts}, Dominated: ${totalDominated} (${dominatedPercentage}%), Learning: ${totalLearning}, Not Started: ${totalNotStarted}`);
    
    return { 
      total: totalConcepts, 
      dominated: totalDominated, 
      learning: totalLearning, 
      notStarted: totalNotStarted 
    };
  } catch (error) {
    console.error('Error fetching materia domain progress:', error);
    return { total: 0, dominated: 0, learning: 0, notStarted: 0 };
  }
} 