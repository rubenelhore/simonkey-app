import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Teacher document ID to debug
const TEACHER_DOC_ID = 'school_1751333776472_ia0ly5vle';

// Initialize Firebase Admin
const app = initializeApp({
  projectId: 'simonkey-5c78f',
  credential: cert({
    // You'll need to add your service account credentials here
    // or use environment variables
    projectId: process.env.FIREBASE_PROJECT_ID || 'simonkey-5c78f',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  })
});

// Get Firestore instance with correct database
const db = getFirestore(app);
db.settings({ databaseId: 'simonkey-general' });

/**
 * Debug teacher data using Admin SDK
 */
async function debugTeacherDataAdmin() {
  console.log('🔍 Starting Admin SDK debugging for teacher:', TEACHER_DOC_ID);
  console.log('=' .repeat(60));
  
  try {
    // 1. Check if the teacher document exists in users collection
    console.log('\n📋 Checking teacher document in users collection...');
    const teacherDoc = await db.collection('users').doc(TEACHER_DOC_ID).get();
    
    if (teacherDoc.exists) {
      const teacherData = teacherDoc.data();
      console.log('✅ Teacher document found:');
      console.log('  - ID:', teacherDoc.id);
      console.log('  - Name:', teacherData.nombre || teacherData.displayName);
      console.log('  - Email:', teacherData.email);
      console.log('  - Subscription:', teacherData.subscription);
      console.log('  - School Role:', teacherData.schoolRole);
      console.log('  - School ID:', teacherData.schoolId);
      console.log('  - Is Active:', teacherData.isActive);
      console.log('  - Google Auth UID:', teacherData.googleAuthUid);
    } else {
      console.log('❌ Teacher document NOT found in users collection!');
      return;
    }

    // 2. Check schoolSubjects collection
    console.log('\n📚 Checking schoolSubjects collection...');
    
    // Get all documents in schoolSubjects
    const allSubjectsSnapshot = await db.collection('schoolSubjects').get();
    console.log(`  Total documents in schoolSubjects: ${allSubjectsSnapshot.size}`);
    
    // Check for documents where idProfesor matches
    const teacherSubjects = [];
    allSubjectsSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.idProfesor === TEACHER_DOC_ID) {
        teacherSubjects.push({ id: doc.id, ...data });
      }
    });
    
    console.log(`  Documents where idProfesor = ${TEACHER_DOC_ID}: ${teacherSubjects.length}`);
    
    if (teacherSubjects.length > 0) {
      console.log('  Found subjects for this teacher:');
      teacherSubjects.forEach((subject) => {
        console.log(`    - Subject ID: ${subject.id}`);
        console.log(`      Name: ${subject.nombre}`);
        console.log(`      School ID: ${subject.idColegio}`);
        console.log(`      Created At: ${subject.createdAt?.toDate ? subject.createdAt.toDate() : subject.createdAt}`);
      });
    } else {
      console.log('  ⚠️ No subjects found for this teacher!');
      
      // Let's check if there are ANY subjects with idProfesor field
      console.log('\n  Checking all subjects with idProfesor field...');
      let subjectsWithTeacher = 0;
      const teacherIdExamples = new Set();
      
      allSubjectsSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.idProfesor) {
          subjectsWithTeacher++;
          teacherIdExamples.add(data.idProfesor);
        }
      });
      
      console.log(`  Total subjects with idProfesor field: ${subjectsWithTeacher}`);
      console.log('  Unique teacher IDs found:');
      Array.from(teacherIdExamples).slice(0, 10).forEach(id => {
        console.log(`    - ${id}`);
      });
    }

    // 3. Check schoolNotebooks collection
    console.log('\n📓 Checking schoolNotebooks collection...');
    
    // Get all documents in schoolNotebooks
    const allNotebooksSnapshot = await db.collection('schoolNotebooks').get();
    console.log(`  Total documents in schoolNotebooks: ${allNotebooksSnapshot.size}`);
    
    // Check for notebooks where idProfesor matches
    const teacherNotebooks = [];
    allNotebooksSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.idProfesor === TEACHER_DOC_ID) {
        teacherNotebooks.push({ id: doc.id, ...data });
      }
    });
    
    console.log(`  Documents where idProfesor = ${TEACHER_DOC_ID}: ${teacherNotebooks.length}`);
    
    if (teacherNotebooks.length > 0) {
      console.log('  Found notebooks for this teacher:');
      teacherNotebooks.forEach((notebook) => {
        console.log(`    - Notebook ID: ${notebook.id}`);
        console.log(`      Title: ${notebook.titulo}`);
        console.log(`      Subject ID: ${notebook.idAsignatura}`);
        console.log(`      Created At: ${notebook.createdAt?.toDate ? notebook.createdAt.toDate() : notebook.createdAt}`);
      });
    } else {
      console.log('  ⚠️ No notebooks found for this teacher!');
      
      // Check if notebooks are linked through subjects
      if (teacherSubjects.length > 0) {
        console.log('\n  Checking notebooks linked to teacher\'s subjects...');
        const subjectIds = teacherSubjects.map(s => s.id);
        let notebooksForSubjects = 0;
        
        allNotebooksSnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.idMateria && subjectIds.includes(data.idMateria)) {
            notebooksForSubjects++;
            console.log(`    - Notebook "${data.titulo}" linked to subject ${data.idMateria}`);
          }
        });
        
        console.log(`  Total notebooks linked to teacher's subjects: ${notebooksForSubjects}`);
      }
    }

    // 4. Check for Firebase Auth UID mismatches
    const teacherData = teacherDoc.data();
    if (teacherData.googleAuthUid) {
      console.log('\n🔐 Checking Firebase Auth UID...');
      console.log(`  Document ID: ${TEACHER_DOC_ID}`);
      console.log(`  Google Auth UID: ${teacherData.googleAuthUid}`);
      console.log(`  Match: ${TEACHER_DOC_ID === teacherData.googleAuthUid ? 'NO ❌' : 'Different IDs (expected)'}`);
      
      // Check if there are subjects/notebooks using the Firebase UID instead
      console.log('\n  Checking if subjects use Firebase UID instead of document ID...');
      let subjectsWithFirebaseUID = 0;
      allSubjectsSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.idProfesor === teacherData.googleAuthUid) {
          subjectsWithFirebaseUID++;
        }
      });
      
      if (subjectsWithFirebaseUID > 0) {
        console.log(`  ⚠️ Found ${subjectsWithFirebaseUID} subjects using Firebase UID instead of document ID!`);
        console.log('  This is likely the issue - subjects should use document ID, not Firebase UID');
      }
    }

    // 5. Summary and recommendations
    console.log('\n' + '=' .repeat(60));
    console.log('📊 SUMMARY:');
    console.log(`  - Teacher document exists: ✅`);
    console.log(`  - Subjects assigned: ${teacherSubjects.length > 0 ? '✅' : '❌'}`);
    console.log(`  - Notebooks assigned: ${teacherNotebooks.length > 0 ? '✅' : '❌'}`);
    
    if (teacherSubjects.length === 0) {
      console.log('\n🎯 ISSUE IDENTIFIED: No subjects assigned to teacher');
      console.log('   SOLUTION: Admin needs to assign subjects to this teacher');
      console.log(`   Teacher ID to use: ${TEACHER_DOC_ID}`);
    }
    
    console.log('\n✨ Debugging complete!');
    
  } catch (error) {
    console.error('❌ Error during debugging:', error);
    console.error('Error details:', error.message);
  }
}

// Run the debugging
console.log('🚀 Starting Firestore Teacher Data Debugger (Admin SDK)...\n');
debugTeacherDataAdmin()
  .then(() => {
    console.log('\n✨ Debugging session finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });