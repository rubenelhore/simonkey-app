import { rankingService } from '../services/rankingService';
import { kpiService } from '../services/kpiService';
import { db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function testRankingSystem(studentId: string) {
  console.log('🏆 === PROBANDO SISTEMA DE RANKINGS ===');
  console.log('📌 ID del estudiante:', studentId);
  
  try {
    // 1. Obtener datos del estudiante
    console.log('\n📊 Obteniendo datos del estudiante...');
    const studentDoc = await getDoc(doc(db, 'users', studentId));
    if (!studentDoc.exists()) {
      console.error('❌ Estudiante no encontrado');
      return;
    }
    
    const studentData = studentDoc.data();
    const institutionId = studentData.idInstitucion;
    
    if (!institutionId) {
      console.error('❌ El estudiante no tiene institución asignada');
      return;
    }
    
    // 2. Obtener KPIs del estudiante
    const kpisDoc = await getDoc(doc(db, 'users', studentId, 'kpis', 'dashboard'));
    if (!kpisDoc.exists()) {
      console.error('❌ El estudiante no tiene KPIs');
      return;
    }
    
    const kpis = kpisDoc.data();
    
    // 3. Mostrar rankings por cuaderno
    console.log('\n🏆 Rankings por Cuaderno:');
    if (kpis.cuadernos) {
      for (const [notebookId, notebookKpi] of Object.entries(kpis.cuadernos as Record<string, any>)) {
        const ranking = await rankingService.getNotebookRanking(institutionId, notebookId);
        if (ranking) {
          const position = rankingService.getStudentPosition(ranking, studentId);
          console.log(`📚 Cuaderno ${notebookKpi.nombreCuaderno || notebookId}:`);
          console.log(`   - Posición: #${position || 'N/A'} de ${ranking.totalStudents}`);
          console.log(`   - Score: ${notebookKpi.scoreCuaderno}`);
        }
      }
    }
    
    // 4. Mostrar rankings por materia
    console.log('\n🏆 Rankings por Materia:');
    if (kpis.materias) {
      for (const [subjectId, subjectKpi] of Object.entries(kpis.materias as Record<string, any>)) {
        const ranking = await rankingService.getSubjectRanking(institutionId, subjectId);
        if (ranking) {
          const position = rankingService.getStudentPosition(ranking, studentId);
          console.log(`📚 Materia ${subjectKpi.nombreMateria || subjectId}:`);
          console.log(`   - Posición: #${position || 'N/A'} de ${ranking.totalStudents}`);
          console.log(`   - Score Total: ${subjectKpi.scoreMateria}`);
        }
      }
    }
    
    // 5. Actualizar KPIs con rankings reales
    console.log('\n⏳ Actualizando KPIs con rankings reales...');
    await kpiService.updateUserKPIs(studentId);
    
    console.log('\n✅ Sistema de rankings probado exitosamente');
    
  } catch (error) {
    console.error('❌ Error probando sistema de rankings:', error);
  }
}

export async function testNotebookRanking(notebookId: string) {
  console.log('🏆 === PROBANDO RANKING DE CUADERNO ===');
  console.log('📌 ID del cuaderno:', notebookId);
  
  try {
    // Primero necesitamos obtener el institutionId del cuaderno
    const notebookDoc = await getDoc(doc(db, 'schoolNotebooks', notebookId));
    if (!notebookDoc.exists()) {
      console.error('❌ Cuaderno no encontrado');
      return;
    }
    
    const notebookData = notebookDoc.data();
    const institutionId = notebookData.idEscuela || notebookData.institutionId;
    
    if (!institutionId) {
      console.error('❌ El cuaderno no tiene institución asignada');
      return;
    }
    
    const ranking = await rankingService.getNotebookRanking(institutionId, notebookId);
    
    if (!ranking) {
      console.error('❌ No se encontró ranking para este cuaderno');
      return;
    }
    
    console.log(`\n📊 Estudiantes con scores: ${ranking.students.length}`);
    console.log(`Total de estudiantes: ${ranking.totalStudents}`);
    
    console.log('\n🏆 Tabla de Posiciones:');
    ranking.students.forEach(student => {
      console.log(`#${student.position} - ${student.name}: Score ${student.score}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Hacer disponibles globalmente
if (typeof window !== 'undefined') {
  (window as any).testRankingSystem = testRankingSystem;
  (window as any).testNotebookRanking = testNotebookRanking;
}