import { UnifiedConceptService } from '../services/unifiedConceptService';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../services/firebase';

export async function getDomainProgressForNotebook(notebookId: string) {
  // Get concepts using UnifiedConceptService
  const concepts = await UnifiedConceptService.getConcepts(notebookId);
  const total = concepts.length;
  
  if (total === 0) {
    return { total: 0, dominated: 0, learning: 0, notStarted: 0 };
  }
  
  // Get current user
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return { total, dominated: 0, learning: 0, notStarted: total };
  }
  
  try {
    // Get all concept IDs from the notebook
    const conceptIds = concepts.map(c => c.id);
    const learningDataMap = new Map<string, number>();
    
    // Procesar los conceptos en lotes más pequeños para no saturar
    const BATCH_SIZE = 10;
    for (let i = 0; i < conceptIds.length; i += BATCH_SIZE) {
      const batch = conceptIds.slice(i, Math.min(i + BATCH_SIZE, conceptIds.length));
      
      const batchPromises = batch.map(async (conceptId) => {
        try {
          const learningDataRef = doc(db, 'users', currentUser.uid, 'learningData', conceptId);
          const learningDataSnap = await getDoc(learningDataRef);
          
          if (learningDataSnap.exists()) {
            const data = learningDataSnap.data();
            return { conceptId, repetitions: data.repetitions || 0 };
          } else {
            return { conceptId, repetitions: 0 };
          }
        } catch (error) {
          // Silenciar warnings para no saturar la consola
          return { conceptId, repetitions: 0 };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(({ conceptId, repetitions }) => {
        learningDataMap.set(conceptId, repetitions);
      });
    }
    
    // Calculate progress based on repetitions
    let dominated = 0;
    let learning = 0;
    let notStarted = 0;
    
    conceptIds.forEach(conceptId => {
      const repetitions = learningDataMap.get(conceptId) || 0;
      if (repetitions >= 2) {
        dominated++;
      } else if (repetitions === 1) {
        learning++;
      } else {
        notStarted++;
      }
    });
    
    // Solo log si hay progreso significativo
    if (dominated > 0 || learning > 0) {
      const dominatedPercentage = total > 0 ? Math.round((dominated/total)*100) : 0;
      console.log(`📊 Progress for notebook ${notebookId}: ${dominated}/${total} (${dominatedPercentage}%)`);
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