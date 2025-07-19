import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  updateDoc,
  Timestamp,
  addDoc
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { SchoolExam, ExamAttempt, ConceptSelection, ExamAnswer } from '../types/exam.types';
import { UnifiedConceptService } from './unifiedConceptService';
import { Concept } from '../types/interfaces';

export class ExamService {
  /**
   * Obtiene todos los exámenes activos para un estudiante
   */
  static async getActiveExamsForStudent(studentId: string, materiaId: string): Promise<SchoolExam[]> {
    try {
      console.log('🔍 [ExamService] Buscando exámenes para estudiante:', {
        studentId,
        materiaId
      });
      
      // First get the student's school ID
      const studentDoc = await getDoc(doc(db, 'users', studentId));
      if (!studentDoc.exists()) {
        console.error('❌ Estudiante no encontrado');
        return [];
      }
      
      const studentData = studentDoc.data();
      const studentSchoolId = studentData.idEscuela || studentData.schoolData?.idEscuela;
      
      console.log('🏫 Escuela del estudiante:', {
        idEscuela: studentSchoolId,
        studentData: {
          hasIdEscuela: !!studentData.idEscuela,
          hasSchoolData: !!studentData.schoolData
        }
      });
      
      if (!studentSchoolId) {
        console.error('❌ Estudiante sin escuela asignada');
        return [];
      }
      
      // Query exams for the student's school and subject
      console.log('📋 Consultando exámenes con filtros:', {
        collection: 'schoolExams',
        idMateria: materiaId,
        idEscuela: studentSchoolId,
        isActive: true
      });
      
      const examsQuery = query(
        collection(db, 'schoolExams'),
        where('idMateria', '==', materiaId),
        where('idEscuela', '==', studentSchoolId),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(examsQuery);
      console.log(`📊 Resultados de la consulta: ${snapshot.size} documentos encontrados`);
      
      const exams: SchoolExam[] = [];
      
      for (const doc of snapshot.docs) {
        const examData = doc.data() as SchoolExam;
        console.log('📄 Examen encontrado:', {
          id: doc.id,
          title: examData.title,
          isActive: examData.isActive,
          idMateria: examData.idMateria,
          idEscuela: examData.idEscuela,
          idProfesor: examData.idProfesor
        });
        exams.push({
          ...examData,
          id: doc.id
        });
      }
      
      console.log(`📝 Total exámenes activos para estudiante:`, exams.length);
      
      return exams;
    } catch (error: any) {
      console.error('❌ Error obteniendo exámenes activos:', error);
      if (error.code === 'failed-precondition') {
        console.error('🔧 Se requiere un índice compuesto en Firestore para esta consulta.');
        console.error('🔧 Campos del índice: idMateria (Ascending), idEscuela (Ascending), isActive (Ascending), createdAt (Descending)');
      }
      return [];
    }
  }

  /**
   * Obtiene o crea un intento de examen para un estudiante
   */
  static async getOrCreateExamAttempt(examId: string, studentId: string): Promise<ExamAttempt | null> {
    try {
      // Buscar intento existente
      const attemptsQuery = query(
        collection(db, 'examAttempts'),
        where('examId', '==', examId),
        where('studentId', '==', studentId)
      );
      
      const snapshot = await getDocs(attemptsQuery);
      
      if (snapshot.docs.length > 0) {
        // Ya existe un intento
        const attemptDoc = snapshot.docs[0];
        return {
          ...attemptDoc.data(),
          id: attemptDoc.id
        } as ExamAttempt;
      }
      
      // Crear nuevo intento
      const exam = await this.getExamById(examId);
      if (!exam) throw new Error('Examen no encontrado');
      
      // Obtener todos los conceptos de los cuadernos del examen
      const allConcepts = await this.getConceptsFromNotebooks(exam.notebookIds);
      
      // Seleccionar conceptos aleatorios
      const selectedConcepts = this.selectRandomConcepts(
        allConcepts,
        exam.percentageQuestions
      );
      
      const newAttempt: Omit<ExamAttempt, 'id'> = {
        examId,
        studentId,
        assignedConcepts: selectedConcepts,
        startedAt: serverTimestamp() as Timestamp,
        currentQuestionIndex: 0,
        answers: [],
        score: 0,
        timeRemaining: selectedConcepts.length * exam.timePerConcept,
        status: 'not_started',
        tabSwitches: 0
      };
      
      const docRef = await addDoc(collection(db, 'examAttempts'), newAttempt);
      
      return {
        ...newAttempt,
        id: docRef.id
      } as ExamAttempt;
    } catch (error) {
      console.error('Error creando intento de examen:', error);
      return null;
    }
  }

  /**
   * Obtiene un examen por ID
   */
  static async getExamById(examId: string): Promise<SchoolExam | null> {
    try {
      const examDoc = await getDoc(doc(db, 'schoolExams', examId));
      
      if (examDoc.exists()) {
        return {
          ...examDoc.data(),
          id: examDoc.id
        } as SchoolExam;
      }
      
      return null;
    } catch (error) {
      console.error('Error obteniendo examen:', error);
      return null;
    }
  }

  /**
   * Obtiene todos los conceptos de los cuadernos especificados
   */
  private static async getConceptsFromNotebooks(notebookIds: string[]): Promise<ConceptSelection[]> {
    const allConcepts: ConceptSelection[] = [];
    let order = 0;
    
    for (const notebookId of notebookIds) {
      const conceptDocs = await UnifiedConceptService.getConceptDocs(notebookId);
      
      for (const conceptDoc of conceptDocs) {
        for (const concept of conceptDoc.conceptos) {
          allConcepts.push({
            conceptId: concept.id,
            notebookId: notebookId,
            término: concept.término,
            definición: concept.definición,
            order: order++
          });
        }
      }
    }
    
    return allConcepts;
  }

  /**
   * Selecciona conceptos aleatorios basándose en el porcentaje
   */
  private static selectRandomConcepts(
    allConcepts: ConceptSelection[], 
    percentage: number
  ): ConceptSelection[] {
    const count = Math.round(allConcepts.length * (percentage / 100));
    
    // Mezclar array usando Fisher-Yates
    const shuffled = [...allConcepts];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    // Tomar los primeros 'count' elementos y reasignar el orden
    return shuffled.slice(0, count).map((concept, index) => ({
      ...concept,
      order: index
    }));
  }

  /**
   * Inicia un intento de examen
   */
  static async startExamAttempt(attemptId: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'examAttempts', attemptId), {
        status: 'in_progress',
        startedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error iniciando intento:', error);
      throw error;
    }
  }

  /**
   * Guarda una respuesta
   */
  static async saveAnswer(
    attemptId: string, 
    answer: ExamAnswer,
    currentQuestionIndex: number,
    timeRemaining: number
  ): Promise<void> {
    try {
      const attemptRef = doc(db, 'examAttempts', attemptId);
      const attemptDoc = await getDoc(attemptRef);
      
      if (!attemptDoc.exists()) {
        throw new Error('Intento no encontrado');
      }
      
      const attemptData = attemptDoc.data() as ExamAttempt;
      const updatedAnswers = [...attemptData.answers];
      
      // Actualizar o agregar respuesta
      const existingIndex = updatedAnswers.findIndex(a => a.conceptId === answer.conceptId);
      if (existingIndex >= 0) {
        updatedAnswers[existingIndex] = answer;
      } else {
        updatedAnswers.push(answer);
      }
      
      await updateDoc(attemptRef, {
        answers: updatedAnswers,
        currentQuestionIndex,
        timeRemaining
      });
    } catch (error) {
      console.error('Error guardando respuesta:', error);
      throw error;
    }
  }

  /**
   * Incrementa el contador de cambios de pestaña
   */
  static async incrementTabSwitch(attemptId: string): Promise<void> {
    try {
      const attemptRef = doc(db, 'examAttempts', attemptId);
      const attemptDoc = await getDoc(attemptRef);
      
      if (attemptDoc.exists()) {
        const currentCount = attemptDoc.data().tabSwitches || 0;
        await updateDoc(attemptRef, {
          tabSwitches: currentCount + 1
        });
      }
    } catch (error) {
      console.error('Error incrementando cambio de pestaña:', error);
    }
  }

  /**
   * Finaliza un intento de examen
   */
  static async completeExamAttempt(attemptId: string): Promise<number> {
    try {
      const attemptRef = doc(db, 'examAttempts', attemptId);
      const attemptDoc = await getDoc(attemptRef);
      
      if (!attemptDoc.exists()) {
        throw new Error('Intento no encontrado');
      }
      
      const attemptData = attemptDoc.data() as ExamAttempt;
      
      // Calcular puntuación
      const score = this.calculateScore(attemptData);
      
      await updateDoc(attemptRef, {
        status: 'completed',
        completedAt: serverTimestamp(),
        score
      });
      
      return score;
    } catch (error) {
      console.error('Error completando intento:', error);
      throw error;
    }
  }

  /**
   * Calcula la puntuación del examen
   */
  private static calculateScore(attempt: ExamAttempt): number {
    const correctAnswers = attempt.answers.filter(a => a.isCorrect).length;
    const timeUsed = attempt.answers.reduce((sum, a) => sum + a.timeSpent, 0);
    const totalTimeAllowed = attempt.assignedConcepts.length * 60; // Asumiendo 60 segundos por concepto
    const timeRemaining = Math.max(0, totalTimeAllowed - timeUsed);
    
    // Score = tiempo restante × respuestas correctas
    return Math.round(timeRemaining * correctAnswers);
  }

  /**
   * Obtiene los resultados de un examen para el profesor
   */
  static async getExamResults(examId: string): Promise<ExamAttempt[]> {
    try {
      const attemptsQuery = query(
        collection(db, 'examAttempts'),
        where('examId', '==', examId),
        where('status', '==', 'completed')
      );
      
      const snapshot = await getDocs(attemptsQuery);
      const attempts: ExamAttempt[] = [];
      
      for (const doc of snapshot.docs) {
        attempts.push({
          ...doc.data(),
          id: doc.id
        } as ExamAttempt);
      }
      
      return attempts;
    } catch (error) {
      console.error('Error obteniendo resultados:', error);
      return [];
    }
  }

  /**
   * Obtiene estadísticas del examen
   */
  static async getExamStatistics(examId: string) {
    const attempts = await this.getExamResults(examId);
    
    if (attempts.length === 0) {
      return {
        totalAttempts: 0,
        completedAttempts: 0,
        averageScore: 0,
        passRate: 0,
        difficultConcepts: []
      };
    }
    
    const totalScore = attempts.reduce((sum, a) => sum + a.score, 0);
    const averageScore = totalScore / attempts.length;
    
    // Analizar conceptos más difíciles
    const conceptErrors = new Map<string, { errors: number, total: number, término: string }>();
    
    for (const attempt of attempts) {
      for (const concept of attempt.assignedConcepts) {
        const answer = attempt.answers.find(a => a.conceptId === concept.conceptId);
        
        if (!conceptErrors.has(concept.conceptId)) {
          conceptErrors.set(concept.conceptId, {
            errors: 0,
            total: 0,
            término: concept.término
          });
        }
        
        const stats = conceptErrors.get(concept.conceptId)!;
        stats.total++;
        
        if (answer && !answer.isCorrect) {
          stats.errors++;
        }
      }
    }
    
    // Ordenar por tasa de error
    const difficultConcepts = Array.from(conceptErrors.entries())
      .map(([id, stats]) => ({
        conceptId: id,
        término: stats.término,
        errorRate: (stats.errors / stats.total) * 100
      }))
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, 10); // Top 10 más difíciles
    
    return {
      totalAttempts: attempts.length,
      completedAttempts: attempts.filter(a => a.status === 'completed').length,
      averageScore,
      passRate: attempts.filter(a => a.score > 0).length / attempts.length * 100,
      difficultConcepts
    };
  }
}