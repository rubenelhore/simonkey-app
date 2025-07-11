import { db } from '../services/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs 
} from 'firebase/firestore';
import { teacherKpiService } from '../services/teacherKpiService';

export async function fixTeacherMetrics(teacherEmail: string) {
  console.log(`\n🔧 Fixing teacher metrics for: ${teacherEmail}`);
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
      return null;
    }

    const teacherDoc = userSnap.docs[0];
    const teacherId = teacherDoc.id;
    const teacherData = teacherDoc.data();
    
    console.log('\n📋 Teacher found:');
    console.log('- ID:', teacherId);
    console.log('- Name:', teacherData.firstName, teacherData.lastName);
    console.log('- Email:', teacherData.email);

    // 2. Check current metrics
    console.log('\n📊 Checking current metrics...');
    let metrics = await teacherKpiService.getTeacherMetrics(teacherId);
    
    if (metrics) {
      console.log('✅ Metrics already exist');
      console.log('- Last updated:', metrics.global.ultimaActualizacion.toDate());
      console.log('- Total subjects:', metrics.global.totalMaterias);
      console.log('- Total notebooks:', metrics.global.totalCuadernos);
      console.log('- Total students:', metrics.global.totalAlumnos);
      
      const hoursSinceUpdate = (Date.now() - metrics.global.ultimaActualizacion.toMillis()) / (1000 * 60 * 60);
      
      if (hoursSinceUpdate < 1) {
        console.log('\n✅ Metrics are up to date (less than 1 hour old)');
        return metrics;
      } else {
        console.log(`\n⚠️  Metrics are ${Math.round(hoursSinceUpdate)} hours old, updating...`);
      }
    } else {
      console.log('❌ No metrics found, generating new ones...');
    }

    // 3. Update metrics
    console.log('\n🔄 Updating teacher metrics...');
    await teacherKpiService.updateTeacherMetrics(teacherId);
    
    // 4. Verify metrics were created
    console.log('\n✅ Verifying metrics...');
    metrics = await teacherKpiService.getTeacherMetrics(teacherId);
    
    if (metrics) {
      console.log('✅ Metrics successfully generated/updated!');
      console.log('\n📊 New metrics summary:');
      console.log('- Total subjects:', metrics.global.totalMaterias);
      console.log('- Total notebooks:', metrics.global.totalCuadernos);
      console.log('- Total students:', metrics.global.totalAlumnos);
      console.log('- Average score:', metrics.global.scorePromedio);
      console.log('- Concept mastery:', metrics.global.porcentajeDominioConceptos + '%');
      console.log('- Active time per student:', metrics.global.tiempoActivo, 'minutes');
      console.log('- Average study sessions:', metrics.global.estudioPromedio);
      
      if (metrics.global.totalMaterias === 0) {
        console.warn('\n⚠️  WARNING: No subjects found for teacher');
        console.log('Make sure subjects have idProfesor =', teacherId);
      }
      
      if (metrics.global.totalCuadernos === 0) {
        console.warn('\n⚠️  WARNING: No notebooks found for teacher subjects');
        console.log('Make sure notebooks have idMateria matching subject IDs');
      }
      
      if (metrics.global.totalAlumnos === 0) {
        console.warn('\n⚠️  WARNING: No students found with teacher notebooks');
        console.log('Make sure students have notebook IDs in their idCuadernos array');
      }
      
      return metrics;
    } else {
      console.error('❌ Failed to generate metrics');
      console.log('Run debugTeacherMetrics() for detailed diagnostics');
      return null;
    }

  } catch (error) {
    console.error('\n❌ Error fixing teacher metrics:', error);
    throw error;
  }
}

// Convenience function to fix metrics for the specific teacher
export async function fixCurrentTeacherMetrics() {
  return await fixTeacherMetrics('0161875@up.edu.mx');
}

// Export for console usage
if (typeof window !== 'undefined') {
  (window as any).fixTeacherMetrics = fixTeacherMetrics;
  (window as any).fixCurrentTeacherMetrics = fixCurrentTeacherMetrics;
}