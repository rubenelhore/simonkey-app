import { db } from '../services/firebase';
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs 
} from 'firebase/firestore';
import { teacherKpiService } from '../services/teacherKpiService';

export async function debugTeacherMetrics(teacherEmail: string) {
  console.log(`\n🔍 Debugging teacher metrics for: ${teacherEmail}`);
  console.log('='.repeat(60));

  try {
    // 1. Find teacher by email
    const usersQuery = query(
      collection(db, 'users'),
      where('email', '==', teacherEmail)
    );
    const userSnap = await getDocs(usersQuery);
    
    if (userSnap.empty) {
      console.error('❌ Teacher not found with email:', teacherEmail);
      return;
    }

    const teacherDoc = userSnap.docs[0];
    const teacherId = teacherDoc.id;
    const teacherData = teacherDoc.data();
    
    console.log('\n📋 Teacher Info:');
    console.log('- ID:', teacherId);
    console.log('- Name:', teacherData.firstName, teacherData.lastName);
    console.log('- Role:', teacherData.schoolRole);
    console.log('- Institution ID (direct):', teacherData.idInstitucion || 'None');
    console.log('- Admin ID:', teacherData.idAdmin || 'None');

    // 2. Check institution ID
    let institutionId = teacherData.idInstitucion;
    
    if (!institutionId && teacherData.idAdmin) {
      console.log('\n🔍 Checking admin for institution ID...');
      const adminDoc = await getDoc(doc(db, 'users', teacherData.idAdmin));
      
      if (adminDoc.exists()) {
        const adminData = adminDoc.data();
        institutionId = adminData.idInstitucion;
        console.log('✅ Institution ID from admin:', institutionId);
      } else {
        console.log('❌ Admin document not found');
      }
    }

    if (!institutionId) {
      console.error('\n❌ CRITICAL: No institution ID found (neither direct nor through admin)');
      console.log('This prevents metrics from being generated.');
      return;
    }

    // 3. Check existing metrics
    console.log('\n📊 Checking existing metrics...');
    const existingMetrics = await teacherKpiService.getTeacherMetrics(teacherId);
    
    if (existingMetrics) {
      console.log('✅ Metrics exist in database');
      console.log('- Last updated:', existingMetrics.global.ultimaActualizacion.toDate());
      console.log('- Total subjects:', existingMetrics.global.totalMaterias);
      console.log('- Total notebooks:', existingMetrics.global.totalCuadernos);
      console.log('- Total students:', existingMetrics.global.totalAlumnos);
    } else {
      console.log('❌ No metrics found in database');
    }

    // 4. Check subjects
    console.log('\n📚 Checking teacher subjects...');
    const subjectsQuery = query(
      collection(db, 'schoolSubjects'),
      where('idProfesor', '==', teacherId)
    );
    const subjectsSnap = await getDocs(subjectsQuery);
    
    console.log(`Found ${subjectsSnap.size} subjects`);
    
    if (subjectsSnap.empty) {
      console.error('❌ CRITICAL: No subjects assigned to teacher');
      console.log('Teacher needs subjects with idProfesor =', teacherId);
      return;
    }

    const subjectIds: string[] = [];
    subjectsSnap.forEach(doc => {
      const data = doc.data();
      subjectIds.push(doc.id);
      console.log(`- ${data.nombre || data.name} (ID: ${doc.id})`);
    });

    // 5. Check notebooks
    console.log('\n📓 Checking notebooks for each subject...');
    let totalNotebooks = 0;
    const allNotebookIds: string[] = [];
    
    for (const subjectId of subjectIds) {
      const notebooksQuery = query(
        collection(db, 'schoolNotebooks'),
        where('idMateria', '==', subjectId)
      );
      const notebooksSnap = await getDocs(notebooksQuery);
      
      console.log(`\nSubject ${subjectId}: ${notebooksSnap.size} notebooks`);
      
      notebooksSnap.forEach(doc => {
        const data = doc.data();
        allNotebookIds.push(doc.id);
        console.log(`  - ${data.title} (ID: ${doc.id})`);
      });
      
      totalNotebooks += notebooksSnap.size;
    }

    if (totalNotebooks === 0) {
      console.error('\n❌ CRITICAL: No notebooks found for any subject');
      console.log('Subjects need notebooks with idMateria matching subject IDs');
      return;
    }

    // 6. Check students
    console.log('\n👥 Checking students with teacher notebooks...');
    const studentsQuery = query(
      collection(db, 'users'),
      where('subscription', '==', 'school'),
      where('schoolRole', '==', 'student'),
      where('idInstitucion', '==', institutionId)
    );
    
    const studentsSnap = await getDocs(studentsQuery);
    console.log(`Total students in institution: ${studentsSnap.size}`);

    let studentsWithNotebooks = 0;
    const studentDetails: any[] = [];

    studentsSnap.forEach(studentDoc => {
      const studentData = studentDoc.data();
      const studentNotebooks = studentData.idCuadernos || [];
      
      // Check if student has any of the teacher's notebooks
      const hasTeacherNotebook = studentNotebooks.some((notebookId: string) => 
        allNotebookIds.includes(notebookId)
      );
      
      if (hasTeacherNotebook) {
        studentsWithNotebooks++;
        const matchingNotebooks = studentNotebooks.filter((id: string) => 
          allNotebookIds.includes(id)
        );
        
        studentDetails.push({
          id: studentDoc.id,
          name: `${studentData.firstName} ${studentData.lastName}`,
          email: studentData.email,
          notebooks: matchingNotebooks
        });
      }
    });

    console.log(`\nStudents with teacher notebooks: ${studentsWithNotebooks}`);
    
    if (studentsWithNotebooks === 0) {
      console.error('❌ CRITICAL: No students have any of the teacher\'s notebooks');
      console.log('Students need to have notebook IDs in their idCuadernos array');
      console.log('\nTeacher notebook IDs:', allNotebookIds);
      return;
    }

    // Show sample of students
    console.log('\nSample students (first 5):');
    studentDetails.slice(0, 5).forEach(student => {
      console.log(`- ${student.name} (${student.email})`);
      console.log(`  Notebooks: ${student.notebooks.join(', ')}`);
    });

    // 7. Check student KPIs
    console.log('\n📈 Checking student KPIs...');
    let studentsWithKpis = 0;
    
    for (const student of studentDetails.slice(0, 3)) { // Check first 3 students
      const kpisDoc = await getDoc(doc(db, 'users', student.id, 'kpis', 'dashboard'));
      
      if (kpisDoc.exists()) {
        const kpisData = kpisDoc.data();
        const hasNotebookData = student.notebooks.some((notebookId: string) => 
          kpisData.cuadernos?.[notebookId]
        );
        
        if (hasNotebookData) {
          studentsWithKpis++;
          console.log(`✅ ${student.name} has KPI data`);
        } else {
          console.log(`⚠️  ${student.name} has KPIs but no data for teacher notebooks`);
        }
      } else {
        console.log(`❌ ${student.name} has no KPI document`);
      }
    }

    if (studentsWithKpis === 0) {
      console.warn('\n⚠️  WARNING: No students have KPI data for teacher notebooks');
      console.log('Metrics will be generated but all values will be 0');
    }

    // 8. Summary and recommendations
    console.log('\n📋 SUMMARY');
    console.log('='.repeat(60));
    console.log('✅ Teacher found:', teacherId);
    console.log(institutionId ? '✅' : '❌', 'Institution ID:', institutionId || 'Missing');
    console.log(subjectIds.length > 0 ? '✅' : '❌', 'Subjects:', subjectIds.length);
    console.log(totalNotebooks > 0 ? '✅' : '❌', 'Notebooks:', totalNotebooks);
    console.log(studentsWithNotebooks > 0 ? '✅' : '❌', 'Students with notebooks:', studentsWithNotebooks);
    console.log(existingMetrics ? '✅' : '❌', 'Metrics in database:', existingMetrics ? 'Yes' : 'No');

    if (!existingMetrics) {
      console.log('\n🔧 RECOMMENDATION: Run updateTeacherMetrics to generate metrics');
      console.log(`teacherKpiService.updateTeacherMetrics('${teacherId}')`);
    }

  } catch (error) {
    console.error('\n❌ Error during debug:', error);
  }
}

// Export for console usage
if (typeof window !== 'undefined') {
  (window as any).debugTeacherMetrics = debugTeacherMetrics;
}