import { db } from '../services/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

export async function diagnoseSchoolStudentKPIs(studentId: string) {
  console.log('🔍 === DIAGNÓSTICO DE KPIs PARA ESTUDIANTE ESCOLAR ===');
  console.log('📌 ID del estudiante:', studentId);
  
  try {
    // 1. Verificar el documento del usuario
    const userDoc = await getDoc(doc(db, 'users', studentId));
    if (!userDoc.exists()) {
      console.error('❌ El usuario no existe en la base de datos');
      return;
    }
    
    const userData = userDoc.data();
    console.log('✅ Usuario encontrado:', {
      email: userData.email,
      nombre: userData.nombre,
      subscription: userData.subscription,
      schoolRole: userData.schoolRole,
      idCuadernos: userData.idCuadernos,
      subjectIds: userData.subjectIds
    });
    
    // 2. Verificar sesiones de estudio
    console.log('\n📚 Buscando sesiones de estudio...');
    const sessionsQuery = query(
      collection(db, 'studySessions'),
      where('userId', '==', studentId)
    );
    const sessionsSnap = await getDocs(sessionsQuery);
    console.log(`📊 Sesiones encontradas: ${sessionsSnap.size}`);
    
    const sessions: any[] = [];
    sessionsSnap.forEach(doc => {
      const data = doc.data();
      sessions.push({
        id: doc.id,
        notebookId: data.notebookId,
        mode: data.mode,
        startTime: data.startTime?.toDate ? data.startTime.toDate() : data.startTime,
        endTime: data.endTime?.toDate ? data.endTime.toDate() : data.endTime,
        validated: data.validated,
        metrics: data.metrics
      });
    });
    
    console.log('📋 Detalle de sesiones:', sessions);
    
    // Verificar notebookIds en las sesiones
    const notebookIdsInSessions = new Set<string>();
    sessions.forEach(session => {
      if (session.notebookId) {
        notebookIdsInSessions.add(session.notebookId);
      }
    });
    console.log('📚 Notebook IDs únicos en sesiones:', Array.from(notebookIdsInSessions));
    
    // Verificar si los notebookIds de las sesiones coinciden con los cuadernos asignados
    const assignedNotebooks = userData.idCuadernos || [];
    const sessionsWithMatchingNotebooks = sessions.filter(s => 
      assignedNotebooks.includes(s.notebookId)
    );
    console.log(`📊 Sesiones con cuadernos que coinciden: ${sessionsWithMatchingNotebooks.length}/${sessions.length}`);
    
    // 3. Verificar cuadernos del estudiante
    console.log('\n📚 Verificando cuadernos del estudiante...');
    const notebookIds = userData.idCuadernos || [];
    console.log('📌 IDs de cuadernos:', notebookIds);
    
    for (const notebookId of notebookIds) {
      const notebookDoc = await getDoc(doc(db, 'schoolNotebooks', notebookId));
      if (notebookDoc.exists()) {
        const data = notebookDoc.data();
        console.log(`✅ Cuaderno ${notebookId}:`, {
          title: data.title,
          idMateria: data.idMateria,
          subjectId: data.subjectId
        });
      } else {
        console.log(`❌ Cuaderno ${notebookId} no encontrado`);
      }
    }
    
    // 4. Verificar KPIs actuales
    console.log('\n📊 Verificando KPIs actuales...');
    const kpisDoc = await getDoc(doc(db, 'users', studentId, 'kpis', 'dashboard'));
    if (kpisDoc.exists()) {
      const kpisData = kpisDoc.data();
      console.log('✅ KPIs encontrados:', JSON.stringify(kpisData, null, 2));
    } else {
      console.log('❌ No hay KPIs generados');
    }
    
    // 5. Verificar resultados de quiz
    console.log('\n🎯 Verificando resultados de quiz...');
    const quizResultsQuery = query(
      collection(db, 'users', studentId, 'quizResults')
    );
    const quizResultsSnap = await getDocs(quizResultsQuery);
    console.log(`📊 Resultados de quiz encontrados: ${quizResultsSnap.size}`);
    
    // Mostrar detalles de quiz
    const quizDetails: any[] = [];
    quizResultsSnap.forEach(doc => {
      const data = doc.data();
      quizDetails.push({
        id: doc.id,
        notebookId: data.notebookId,
        score: data.score,
        finalScore: data.finalScore,
        correctAnswers: data.correctAnswers,
        totalQuestions: data.totalQuestions
      });
    });
    console.log('🎯 Detalle de resultados de quiz:', quizDetails);
    
    // 6. Verificar learning data
    console.log('\n🧠 Verificando datos de aprendizaje (SM-3)...');
    const learningDataQuery = query(
      collection(db, 'users', studentId, 'learningData')
    );
    const learningDataSnap = await getDocs(learningDataQuery);
    console.log(`📊 Datos de aprendizaje encontrados: ${learningDataSnap.size}`);
    
    // 7. Recomendaciones
    console.log('\n💡 RECOMENDACIONES:');
    if (sessionsSnap.size === 0) {
      console.log('⚠️ El estudiante no tiene sesiones de estudio. Debe completar al menos una sesión.');
    }
    if (quizResultsSnap.size === 0) {
      console.log('⚠️ El estudiante no tiene resultados de quiz. Los scores serán 0.');
    }
    if (!kpisDoc.exists() || Object.keys(kpisDoc.data()?.cuadernos || {}).length === 0) {
      console.log('⚠️ Los KPIs están vacíos o incompletos. Ejecutar kpiService.updateUserKPIs() con el ID correcto.');
    }
    
    console.log('\n🔧 Para actualizar KPIs manualmente:');
    console.log(`import { kpiService } from './src/services/kpiService';`);
    console.log(`await kpiService.updateUserKPIs('${studentId}');`);
    
  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
  }
}

// Hacer la función disponible globalmente para la consola
if (typeof window !== 'undefined') {
  (window as any).diagnoseSchoolStudentKPIs = diagnoseSchoolStudentKPIs;
}