import { db } from '../services/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc 
} from 'firebase/firestore';

export async function debugStudentRankings(institutionId: string, materiaId?: string) {
  console.log('🔍 === DEBUGGING STUDENT RANKINGS ===');
  console.log('Institution ID:', institutionId);
  console.log('Materia ID:', materiaId || 'GLOBAL');
  
  try {
    // 1. Get all students in the institution
    const studentsQuery = query(
      collection(db, 'users'),
      where('subscription', '==', 'school'),
      where('schoolRole', '==', 'student'),
      where('idInstitucion', '==', institutionId)
    );
    
    const studentsSnapshot = await getDocs(studentsQuery);
    console.log('\n📊 Total students in institution:', studentsSnapshot.size);
    
    const studentData = [];
    
    // 2. Check KPIs for each student
    for (const studentDoc of studentsSnapshot.docs) {
      const student = studentDoc.data();
      const studentId = studentDoc.id;
      
      console.log(`\n👤 Student: ${student.nombre || student.displayName} (${studentId})`);
      
      // Check if student has KPIs
      const kpisDoc = await getDoc(doc(db, 'users', studentId, 'kpis', 'dashboard'));
      
      if (kpisDoc.exists()) {
        const kpis = kpisDoc.data();
        console.log('✅ Has KPIs');
        
        // Check global score
        const globalScore = kpis.global?.scoreGlobal || 0;
        console.log(`  - Global Score: ${globalScore}`);
        
        // Check specific materia score if provided
        if (materiaId && kpis.materias?.[materiaId]) {
          const materiaScore = kpis.materias[materiaId].scoreMateria || 0;
          console.log(`  - Materia Score (${materiaId}): ${materiaScore}`);
          studentData.push({
            id: studentId,
            nombre: student.nombre || student.displayName,
            globalScore,
            materiaScore
          });
        } else if (materiaId) {
          console.log(`  - ❌ No score for materia ${materiaId}`);
          // Check if student has any notebooks for this materia
          const subjectDoc = await getDoc(doc(db, 'schoolSubjects', materiaId));
          if (subjectDoc.exists()) {
            console.log(`  - Materia exists: ${subjectDoc.data().nombre}`);
          }
        } else {
          studentData.push({
            id: studentId,
            nombre: student.nombre || student.displayName,
            globalScore,
            materiaScore: 0
          });
        }
        
        // List all materias the student has
        if (kpis.materias) {
          console.log('  - Materias with scores:');
          Object.entries(kpis.materias).forEach(([mId, mData]: [string, any]) => {
            console.log(`    * ${mId}: ${mData.scoreMateria || 0}`);
          });
        }
      } else {
        console.log('❌ No KPIs found');
      }
    }
    
    // 3. Show ranking
    console.log('\n🏆 === RANKING ===');
    
    // Sort by score
    if (materiaId) {
      studentData.sort((a, b) => b.materiaScore - a.materiaScore);
      console.log('Ranking by Materia Score:');
      studentData.forEach((student, index) => {
        console.log(`#${index + 1} ${student.nombre}: ${student.materiaScore} points`);
      });
    } else {
      studentData.sort((a, b) => b.globalScore - a.globalScore);
      console.log('Ranking by Global Score:');
      studentData.forEach((student, index) => {
        console.log(`#${index + 1} ${student.nombre}: ${student.globalScore} points`);
      });
    }
    
    return studentData;
    
  } catch (error) {
    console.error('❌ Error debugging rankings:', error);
    throw error;
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  (window as any).debugStudentRankings = debugStudentRankings;
}