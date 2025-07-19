import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { UnifiedConceptService } from '../services/unifiedConceptService';

export async function debugCompareDomainProgress(notebookId: string) {
  console.log(`\n🔍 DEBUG: Comparing domain progress calculations for notebook ${notebookId}`);
  
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.log('❌ No current user');
    return;
  }
  
  // Method 1: NotebookDetail approach (subcollection)
  console.log('\n📊 Method 1: NotebookDetail approach (subcollection)');
  const concepts = await UnifiedConceptService.getConcepts(notebookId);
  const conceptIds = concepts.map(c => c.id);
  console.log(`Found ${conceptIds.length} concepts`);
  
  const learningMapMethod1 = new Map<string, number>();
  
  for (const conceptId of conceptIds) {
    try {
      const learningDataRef = doc(db, 'users', currentUser.uid, 'learningData', conceptId);
      const learningDataSnap = await getDoc(learningDataRef);
      
      if (learningDataSnap.exists()) {
        const data = learningDataSnap.data();
        learningMapMethod1.set(conceptId, data.repetitions || 0);
        console.log(`  Concept ${conceptId}: ${data.repetitions || 0} repetitions`);
      } else {
        learningMapMethod1.set(conceptId, 0);
        console.log(`  Concept ${conceptId}: No data (0 repetitions)`);
      }
    } catch (error) {
      console.error(`  Error loading concept ${conceptId}:`, error);
    }
  }
  
  // Calculate totals for method 1
  let dominated1 = 0, learning1 = 0, notStarted1 = 0;
  conceptIds.forEach(conceptId => {
    const reps = learningMapMethod1.get(conceptId) || 0;
    if (reps >= 2) dominated1++;
    else if (reps === 1) learning1++;
    else notStarted1++;
  });
  
  console.log(`\nMethod 1 Results:`);
  console.log(`  Total: ${conceptIds.length}`);
  console.log(`  Dominated (>=2): ${dominated1} (${Math.round((dominated1/conceptIds.length)*100)}%)`);
  console.log(`  Learning (=1): ${learning1} (${Math.round((learning1/conceptIds.length)*100)}%)`);
  console.log(`  Not Started (=0): ${notStarted1} (${Math.round((notStarted1/conceptIds.length)*100)}%)`);
  
  // Method 2: Main collection approach
  console.log('\n📊 Method 2: Main collection approach');
  const learningMapMethod2 = new Map<string, number>();
  
  try {
    const learningDataRef = collection(db, 'learningData');
    const q = query(
      learningDataRef,
      where('userId', '==', currentUser.uid),
      where('notebookId', '==', notebookId)
    );
    
    const snapshot = await getDocs(q);
    console.log(`Found ${snapshot.size} learning data documents`);
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      learningMapMethod2.set(data.conceptId, data.repetitions || 0);
      console.log(`  Concept ${data.conceptId}: ${data.repetitions || 0} repetitions`);
    });
  } catch (error) {
    console.error('Error with main collection:', error);
  }
  
  // Calculate totals for method 2
  let dominated2 = 0, learning2 = 0, notStarted2 = 0;
  conceptIds.forEach(conceptId => {
    const reps = learningMapMethod2.get(conceptId) || 0;
    if (reps >= 2) dominated2++;
    else if (reps === 1) learning2++;
    else notStarted2++;
  });
  
  console.log(`\nMethod 2 Results:`);
  console.log(`  Total: ${conceptIds.length}`);
  console.log(`  Dominated (>=2): ${dominated2} (${Math.round((dominated2/conceptIds.length)*100)}%)`);
  console.log(`  Learning (=1): ${learning2} (${Math.round((learning2/conceptIds.length)*100)}%)`);
  console.log(`  Not Started (=0): ${notStarted2} (${Math.round((notStarted2/conceptIds.length)*100)}%)`);
  
  console.log('\n📊 Comparison:');
  console.log(`  Dominated: Method1=${dominated1}, Method2=${dominated2}, Diff=${Math.abs(dominated1-dominated2)}`);
  console.log(`  Learning: Method1=${learning1}, Method2=${learning2}, Diff=${Math.abs(learning1-learning2)}`);
  console.log(`  Not Started: Method1=${notStarted1}, Method2=${notStarted2}, Diff=${Math.abs(notStarted1-notStarted2)}`);
  
  // Check for missing concepts in method 2
  const missingInMethod2 = conceptIds.filter(id => !learningMapMethod2.has(id));
  if (missingInMethod2.length > 0) {
    console.log(`\n⚠️ ${missingInMethod2.length} concepts missing in main collection:`);
    missingInMethod2.forEach(id => {
      console.log(`  - ${id}: ${learningMapMethod1.get(id) || 0} repetitions in subcollection`);
    });
  }
  
  return {
    method1: { total: conceptIds.length, dominated: dominated1, learning: learning1, notStarted: notStarted1 },
    method2: { total: conceptIds.length, dominated: dominated2, learning: learning2, notStarted: notStarted2 }
  };
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).debugCompareDomainProgress = debugCompareDomainProgress;
}