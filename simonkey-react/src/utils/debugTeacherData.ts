import { db } from '../services/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

export async function debugTeacherData(teacherId: string) {
  console.log('🔍 === DEBUGGING TEACHER DATA ===');
  console.log('Teacher ID:', teacherId);
  
  try {
    // 1. Get teacher data
    const teacherDoc = await getDoc(doc(db, 'users', teacherId));
    if (!teacherDoc.exists()) {
      console.error('❌ Teacher not found');
      return;
    }
    
    const teacherData = teacherDoc.data();
    console.log('\n📋 Teacher Data:');
    console.log('- Name:', teacherData.nombre);
    console.log('- Email:', teacherData.email);
    console.log('- Subscription:', teacherData.subscription);
    console.log('- School Role:', teacherData.schoolRole);
    console.log('- idAdmin:', teacherData.idAdmin);
    console.log('- idInstitucion:', teacherData.idInstitucion);
    
    // 2. Check admin data if exists
    if (teacherData.idAdmin) {
      console.log('\n🏫 Checking Admin Data...');
      // Check in users collection first
      const adminDoc = await getDoc(doc(db, 'users', teacherData.idAdmin));
      if (adminDoc.exists()) {
        const adminData = adminDoc.data();
        console.log('✅ Admin found in users collection:');
        console.log('- Admin Name:', adminData.nombre);
        console.log('- Admin Email:', adminData.email);
        console.log('- idInstitucion:', adminData.idInstitucion);
        console.log('- School Role:', adminData.schoolRole);
        console.log('- Subscription:', adminData.subscription);
      } else {
        // Try schoolAdmins collection as fallback
        const schoolAdminDoc = await getDoc(doc(db, 'schoolAdmins', teacherData.idAdmin));
        if (schoolAdminDoc.exists()) {
          const adminData = schoolAdminDoc.data();
          console.log('✅ Admin found in schoolAdmins collection:');
          console.log('- Admin Name:', adminData.nombre);
          console.log('- Admin Email:', adminData.email);
          console.log('- idInstitucion:', adminData.idInstitucion);
        } else {
          console.error('❌ Admin document not found in either collection:', teacherData.idAdmin);
        }
      }
    }
    
    // 3. Check teacher's subjects
    console.log('\n📚 Checking Teacher Subjects...');
    const subjectsQuery = query(
      collection(db, 'schoolSubjects'),
      where('idProfesor', '==', teacherId)
    );
    const subjectsSnap = await getDocs(subjectsQuery);
    console.log('Total subjects:', subjectsSnap.size);
    
    subjectsSnap.forEach(doc => {
      const subject = doc.data();
      console.log(`- ${subject.nombre || subject.name} (${doc.id})`);
    });
    
    // 4. Check for institution in different ways
    console.log('\n🔍 Looking for institution ID...');
    
    // Try to find institution through students
    const studentsQuery = query(
      collection(db, 'users'),
      where('subscription', '==', 'school'),
      where('schoolRole', '==', 'student')
    );
    const studentsSnap = await getDocs(studentsQuery);
    
    let foundInstitution = null;
    for (const studentDoc of studentsSnap.docs) {
      const studentData = studentDoc.data();
      if (studentData.idInstitucion) {
        foundInstitution = studentData.idInstitucion;
        console.log('Found institution from student:', foundInstitution);
        break;
      }
    }
    
    // Check if any school institutions exist
    console.log('\n🏫 Checking school institutions...');
    const institutionsSnap = await getDocs(collection(db, 'schoolInstitutions'));
    console.log('Total institutions:', institutionsSnap.size);
    institutionsSnap.forEach(doc => {
      const inst = doc.data();
      console.log(`- ${inst.nombre} (${doc.id})`);
    });
    
  } catch (error) {
    console.error('❌ Error debugging teacher data:', error);
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  (window as any).debugTeacherData = debugTeacherData;
}