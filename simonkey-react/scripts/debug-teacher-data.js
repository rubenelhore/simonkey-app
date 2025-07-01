import { initializeApp } from 'firebase/app';
import { 
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  collection, 
  doc, 
  getDoc,
  getDocs,
  query,
  where
} from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC26QZw7297E_YOoF5OqR2Ck6x_bw5_Hic",
  authDomain: "simonkey.ai",
  projectId: "simonkey-5c78f",
  storageBucket: "simonkey-5c78f.firebasestorage.app",
  messagingSenderId: "235501879490",
  appId: "1:235501879490:web:05fea6dae9c63b2a827b5b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with the correct database name
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentSingleTabManager({})
  }),
  databaseId: 'simonkey-general'
});

// Teacher document ID to debug
const TEACHER_DOC_ID = 'school_1751333776472_ia0ly5vle';

/**
 * Debug teacher data in Firestore
 */
async function debugTeacherData() {
  console.log('🔍 Starting Firestore debugging for teacher:', TEACHER_DOC_ID);
  console.log('=' .repeat(60));
  
  try {
    // 1. Check if the teacher document exists in users collection
    console.log('\n📋 Checking teacher document in users collection...');
    const teacherDoc = await getDoc(doc(db, 'users', TEACHER_DOC_ID));
    
    if (teacherDoc.exists()) {
      const teacherData = teacherDoc.data();
      console.log('✅ Teacher document found:');
      console.log('  - ID:', teacherDoc.id);
      console.log('  - Name:', teacherData.nombre || teacherData.displayName);
      console.log('  - Email:', teacherData.email);
      console.log('  - Subscription:', teacherData.subscription);
      console.log('  - School Role:', teacherData.schoolRole);
      console.log('  - School ID:', teacherData.schoolId);
      console.log('  - Is Active:', teacherData.isActive);
    } else {
      console.log('❌ Teacher document NOT found in users collection!');
      return;
    }

    // 2. Check schoolSubjects collection
    console.log('\n📚 Checking schoolSubjects collection...');
    const subjectsRef = collection(db, 'schoolSubjects');
    
    // Get all documents in schoolSubjects
    const allSubjectsSnapshot = await getDocs(subjectsRef);
    console.log(`  Total documents in schoolSubjects: ${allSubjectsSnapshot.size}`);
    
    // Check for documents where idProfesor matches
    const teacherSubjectsQuery = query(subjectsRef, where('idProfesor', '==', TEACHER_DOC_ID));
    const teacherSubjectsSnapshot = await getDocs(teacherSubjectsQuery);
    
    console.log(`  Documents where idProfesor = ${TEACHER_DOC_ID}: ${teacherSubjectsSnapshot.size}`);
    
    if (teacherSubjectsSnapshot.size > 0) {
      console.log('  Found subjects for this teacher:');
      teacherSubjectsSnapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`    - Subject ID: ${doc.id}`);
        console.log(`      Name: ${data.nombre}`);
        console.log(`      School ID: ${data.idColegio}`);
        console.log(`      Created At: ${data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt}`);
      });
    } else {
      console.log('  ⚠️ No subjects found for this teacher!');
      
      // Let's check if there are ANY subjects with idProfesor field
      console.log('\n  Checking all subjects with idProfesor field...');
      let subjectsWithTeacher = 0;
      allSubjectsSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.idProfesor) {
          subjectsWithTeacher++;
          if (subjectsWithTeacher <= 5) { // Show first 5 examples
            console.log(`    Example - Subject: ${data.nombre}, Teacher ID: ${data.idProfesor}`);
          }
        }
      });
      console.log(`  Total subjects with idProfesor field: ${subjectsWithTeacher}`);
    }

    // 3. Check schoolNotebooks collection
    console.log('\n📓 Checking schoolNotebooks collection...');
    const notebooksRef = collection(db, 'schoolNotebooks');
    
    // Get all documents in schoolNotebooks
    const allNotebooksSnapshot = await getDocs(notebooksRef);
    console.log(`  Total documents in schoolNotebooks: ${allNotebooksSnapshot.size}`);
    
    // Check for notebooks where idProfesor matches
    const teacherNotebooksQuery = query(notebooksRef, where('idProfesor', '==', TEACHER_DOC_ID));
    const teacherNotebooksSnapshot = await getDocs(teacherNotebooksQuery);
    
    console.log(`  Documents where idProfesor = ${TEACHER_DOC_ID}: ${teacherNotebooksSnapshot.size}`);
    
    if (teacherNotebooksSnapshot.size > 0) {
      console.log('  Found notebooks for this teacher:');
      teacherNotebooksSnapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`    - Notebook ID: ${doc.id}`);
        console.log(`      Title: ${data.titulo}`);
        console.log(`      Subject ID: ${data.idAsignatura}`);
        console.log(`      Created At: ${data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt}`);
      });
    } else {
      console.log('  ⚠️ No notebooks found for this teacher!');
      
      // Let's check if there are ANY notebooks with idProfesor field
      console.log('\n  Checking all notebooks with idProfesor field...');
      let notebooksWithTeacher = 0;
      allNotebooksSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.idProfesor) {
          notebooksWithTeacher++;
          if (notebooksWithTeacher <= 5) { // Show first 5 examples
            console.log(`    Example - Notebook: ${data.titulo}, Teacher ID: ${data.idProfesor}`);
          }
        }
      });
      console.log(`  Total notebooks with idProfesor field: ${notebooksWithTeacher}`);
    }

    // 4. Additional checks - Let's see if the teacher ID format is consistent
    console.log('\n🔎 Additional analysis...');
    
    // Check if there are subjects/notebooks with similar teacher ID patterns
    const teacherIdPrefix = TEACHER_DOC_ID.split('_')[0] + '_' + TEACHER_DOC_ID.split('_')[1];
    console.log(`  Looking for teacher IDs starting with: ${teacherIdPrefix}`);
    
    let similarTeacherIds = new Set();
    
    allSubjectsSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.idProfesor && data.idProfesor.startsWith(teacherIdPrefix)) {
        similarTeacherIds.add(data.idProfesor);
      }
    });
    
    if (similarTeacherIds.size > 0) {
      console.log(`  Found ${similarTeacherIds.size} unique teacher IDs with similar pattern:`);
      Array.from(similarTeacherIds).forEach(id => {
        console.log(`    - ${id}`);
      });
    }

    // 5. Check the school document to see if it has teacher references
    const teacherData = (await getDoc(doc(db, 'users', TEACHER_DOC_ID))).data();
    if (teacherData.schoolId) {
      console.log('\n🏫 Checking school document...');
      const schoolDoc = await getDoc(doc(db, 'schools', teacherData.schoolId));
      
      if (schoolDoc.exists()) {
        const schoolData = schoolDoc.data();
        console.log('  School found:', schoolData.nombre);
        
        // Check if school has a teachers array or similar
        if (schoolData.teachers) {
          console.log(`  Teachers array length: ${schoolData.teachers.length}`);
          const isTeacherInArray = schoolData.teachers.includes(TEACHER_DOC_ID);
          console.log(`  Is our teacher in the array? ${isTeacherInArray ? 'YES' : 'NO'}`);
        } else {
          console.log('  No teachers array found in school document');
        }
      }
    }

    console.log('\n' + '=' .repeat(60));
    console.log('🎯 Debugging complete!');
    
  } catch (error) {
    console.error('❌ Error during debugging:', error);
    console.error('Error details:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
  }
}

// Run the debugging
console.log('🚀 Starting Firestore Teacher Data Debugger...\n');
debugTeacherData()
  .then(() => {
    console.log('\n✨ Debugging session finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });