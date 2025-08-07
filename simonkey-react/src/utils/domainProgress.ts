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
    
    // Load learning data from the user's subcollection in parallel for better performance
    const learningDataPromises = conceptIds.map(async (conceptId) => {
      try {
        const learningDataRef = doc(db, 'users', currentUser.uid, 'learningData', conceptId);
        const learningDataSnap = await getDoc(learningDataRef);
        
        if (learningDataSnap.exists()) {
          const data = learningDataSnap.data();
          return { conceptId, repetitions: data.repetitions || 0 };
        } else {
          // If no data exists, it's a new concept (0 repetitions)
          return { conceptId, repetitions: 0 };
        }
      } catch (error) {
        console.warn(`Error loading learning data for concept ${conceptId}:`, error);
        return { conceptId, repetitions: 0 };
      }
    });
    
    // Wait for all promises to resolve
    const results = await Promise.all(learningDataPromises);
    
    // Populate the map with results
    results.forEach(({ conceptId, repetitions }) => {
      learningDataMap.set(conceptId, repetitions);
    });
    
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
    
    const dominatedPercentage = total > 0 ? Math.round((dominated/total)*100) : 0;
    console.log(`📊 Domain progress for notebook ${notebookId}: Total: ${total}, Dominated: ${dominated} (${dominatedPercentage}%), Learning: ${learning}, Not Started: ${notStarted}`);
    
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
    // Get all notebooks for this materia
    const notebooksQuery = query(
      collection(db, 'notebooks'),
      where('materiaId', '==', materiaId),
      where('userId', '==', currentUser.uid)
    );
    const notebooksSnapshot = await getDocs(notebooksQuery);
    
    // Accumulate progress from all notebooks
    let totalDominated = 0;
    let totalLearning = 0;
    let totalNotStarted = 0;
    let totalConcepts = 0;
    
    // Get progress for each notebook in parallel
    const progressPromises = notebooksSnapshot.docs.map(async (notebookDoc) => {
      const progress = await getDomainProgressForNotebook(notebookDoc.id);
      return progress;
    });
    
    const allProgress = await Promise.all(progressPromises);
    
    // Sum up all progress
    allProgress.forEach(progress => {
      totalDominated += progress.dominated;
      totalLearning += progress.learning;
      totalNotStarted += progress.notStarted;
      totalConcepts += progress.total;
    });
    
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