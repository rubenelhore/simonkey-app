import { db } from '../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { kpiService } from '../services/kpiService';

/**
 * Script to recalculate KPIs for all school students
 * This will update scores to use the new fractional study intensity values
 */
export async function recalculateAllSchoolStudentKPIs() {
  try {
    console.log('Starting KPI recalculation for all school students...');
    
    // Get all school students
    const studentsQuery = query(
      collection(db, 'users'),
      where('subscription', '==', 'school'),
      where('schoolRole', '==', 'student')
    );
    
    const studentsSnapshot = await getDocs(studentsQuery);
    console.log(`Found ${studentsSnapshot.size} school students`);
    
    let processed = 0;
    let errors = 0;
    
    // Process each student
    for (const studentDoc of studentsSnapshot.docs) {
      try {
        const studentId = studentDoc.id;
        const studentData = studentDoc.data();
        console.log(`Processing student ${processed + 1}/${studentsSnapshot.size}: ${studentData.displayName || studentId}`);
        
        // Update KPIs for this student
        await kpiService.updateUserKPIs(studentId);
        
        processed++;
        console.log(`✅ Updated KPIs for ${studentData.displayName || studentId}`);
        
        // Add a small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        errors++;
        console.error(`❌ Error updating student ${studentDoc.id}:`, error);
      }
    }
    
    console.log(`\nRecalculation complete!`);
    console.log(`✅ Successfully processed: ${processed} students`);
    console.log(`❌ Errors: ${errors}`);
    
  } catch (error) {
    console.error('Fatal error during recalculation:', error);
  }
}

// To run this script:
// 1. Import it in your app temporarily
// 2. Call recalculateAllSchoolStudentKPIs() from the console
// 3. Remove the import when done