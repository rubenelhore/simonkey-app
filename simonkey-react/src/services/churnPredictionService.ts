import { db } from './firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  Timestamp,
  orderBy,
  limit
} from 'firebase/firestore';

export interface StudentMetrics {
  userId: string;
  email?: string;
  displayName?: string;

  // Métricas de actividad
  lastLoginDate: Date;
  daysSinceLastLogin: number;
  totalSessions: number;
  avgSessionDuration: number;
  weeklyStudyTime: number;
  studyStreak: number;

  // Métricas académicas
  totalPoints: number;
  conceptsMastered: number;
  conceptsPending: number;
  avgQuizScore: number;
  examsPassed: number;
  examsFailed: number;
  completionRate: number;

  // Métricas de engagement
  gamesPlayed: number;
  notebooksAccessed: number;
  voiceSessionsCompleted: number;
  studyPathProgress: number;

  // Métricas sociales (si aplica)
  hasTeacher: boolean;
  classParticipation: number;
  peerInteractions: number;

  // Predicciones
  churnRisk: 'low' | 'medium' | 'high';
  churnProbability: number;
  satisfactionScore: number;
  recommendationLikelihood: number;
}

export interface ChurnPrediction {
  userId: string;
  predictedChurn: boolean;
  churnProbability: number;
  riskFactors: string[];
  recommendations: string[];
  predictedDate: Date;
}

class ChurnPredictionService {
  private readonly INACTIVITY_THRESHOLD_DAYS = 7;
  private readonly LOW_ENGAGEMENT_THRESHOLD = 0.3;
  private readonly MIN_STUDY_TIME_HOURS = 1;

  // Recolectar métricas del estudiante
  async collectStudentMetrics(userId: string): Promise<StudentMetrics | null> {
    try {
      // Obtener datos del usuario
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) return null;

      const userData = userDoc.data();

      // Obtener KPIs
      const kpiDoc = await getDoc(doc(db, 'kpis', userId));
      const kpiData = kpiDoc.exists() ? kpiDoc.data() : {};

      // Obtener sesiones de estudio recientes
      const sessionsQuery = query(
        collection(db, 'studySessions'),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(30)
      );
      const sessionsDocs = await getDocs(sessionsQuery);

      // Calcular métricas de sesiones
      let totalSessionDuration = 0;
      let sessionCount = 0;
      let lastSessionDate: Date | null = null;

      sessionsDocs.forEach(doc => {
        const data = doc.data();
        totalSessionDuration += data.duration || 0;
        sessionCount++;
        if (!lastSessionDate && data.timestamp) {
          lastSessionDate = data.timestamp.toDate();
        }
      });

      // Obtener resultados de exámenes
      const examsQuery = query(
        collection(db, 'examResults'),
        where('studentId', '==', userId)
      );
      const examsDocs = await getDocs(examsQuery);

      let examsPassed = 0;
      let examsFailed = 0;
      let totalExamScore = 0;

      examsDocs.forEach(doc => {
        const data = doc.data();
        const score = data.score || 0;
        totalExamScore += score;
        if (score >= 60) {
          examsPassed++;
        } else {
          examsFailed++;
        }
      });

      // Obtener progreso en conceptos
      const conceptsQuery = query(
        collection(db, 'userConcepts'),
        where('userId', '==', userId)
      );
      const conceptsDocs = await getDocs(conceptsQuery);

      let conceptsMastered = 0;
      let conceptsPending = 0;

      conceptsDocs.forEach(doc => {
        const data = doc.data();
        if (data.mastery >= 0.8) {
          conceptsMastered++;
        } else {
          conceptsPending++;
        }
      });

      // Calcular métricas
      const now = new Date();
      const lastLogin = userData.lastLogin ? userData.lastLogin.toDate() : new Date();
      const daysSinceLastLogin = Math.floor((now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24));

      const metrics: StudentMetrics = {
        userId,
        email: userData.email,
        displayName: userData.displayName,

        // Actividad
        lastLoginDate: lastLogin,
        daysSinceLastLogin,
        totalSessions: sessionCount,
        avgSessionDuration: sessionCount > 0 ? totalSessionDuration / sessionCount : 0,
        weeklyStudyTime: kpiData.weeklyStudyTime || 0,
        studyStreak: userData.studyStreak || 0,

        // Académicas
        totalPoints: userData.totalPoints || 0,
        conceptsMastered,
        conceptsPending,
        avgQuizScore: kpiData.avgQuizScore || 0,
        examsPassed,
        examsFailed,
        completionRate: conceptsMastered / (conceptsMastered + conceptsPending) || 0,

        // Engagement
        gamesPlayed: kpiData.gamesPlayed || 0,
        notebooksAccessed: kpiData.notebooksAccessed || 0,
        voiceSessionsCompleted: kpiData.voiceSessionsCompleted || 0,
        studyPathProgress: kpiData.studyPathProgress || 0,

        // Social
        hasTeacher: userData.teacherId ? true : false,
        classParticipation: kpiData.classParticipation || 0,
        peerInteractions: kpiData.peerInteractions || 0,

        // Inicializar predicciones (se calcularán después)
        churnRisk: 'low',
        churnProbability: 0,
        satisfactionScore: 0,
        recommendationLikelihood: 0
      };

      return metrics;

    } catch (error) {
      console.error('Error collecting student metrics:', error);
      return null;
    }
  }

  // Calcular probabilidad de churn usando modelo simple de reglas
  // En producción, aquí implementarías KNN o SVM con una librería como TensorFlow.js
  calculateChurnProbability(metrics: StudentMetrics): number {
    let riskScore = 0;
    let maxScore = 0;

    // Factor 1: Inactividad (peso: 30%)
    maxScore += 30;
    if (metrics.daysSinceLastLogin > 14) {
      riskScore += 30;
    } else if (metrics.daysSinceLastLogin > 7) {
      riskScore += 20;
    } else if (metrics.daysSinceLastLogin > 3) {
      riskScore += 10;
    }

    // Factor 2: Tiempo de estudio semanal (peso: 25%)
    maxScore += 25;
    if (metrics.weeklyStudyTime < 60) { // menos de 1 hora
      riskScore += 25;
    } else if (metrics.weeklyStudyTime < 180) { // menos de 3 horas
      riskScore += 15;
    } else if (metrics.weeklyStudyTime < 300) { // menos de 5 horas
      riskScore += 5;
    }

    // Factor 3: Racha de estudio (peso: 15%)
    maxScore += 15;
    if (metrics.studyStreak === 0) {
      riskScore += 15;
    } else if (metrics.studyStreak < 3) {
      riskScore += 10;
    } else if (metrics.studyStreak < 7) {
      riskScore += 5;
    }

    // Factor 4: Progreso académico (peso: 20%)
    maxScore += 20;
    if (metrics.completionRate < 0.2) {
      riskScore += 20;
    } else if (metrics.completionRate < 0.4) {
      riskScore += 15;
    } else if (metrics.completionRate < 0.6) {
      riskScore += 10;
    }

    // Factor 5: Engagement con features (peso: 10%)
    maxScore += 10;
    const engagementScore = (
      (metrics.gamesPlayed > 0 ? 1 : 0) +
      (metrics.notebooksAccessed > 0 ? 1 : 0) +
      (metrics.voiceSessionsCompleted > 0 ? 1 : 0)
    ) / 3;

    if (engagementScore < 0.33) {
      riskScore += 10;
    } else if (engagementScore < 0.66) {
      riskScore += 5;
    }

    return (riskScore / maxScore) * 100;
  }

  // Identificar factores de riesgo específicos
  identifyRiskFactors(metrics: StudentMetrics): string[] {
    const riskFactors: string[] = [];

    if (metrics.daysSinceLastLogin > 7) {
      riskFactors.push(`Inactivo por ${metrics.daysSinceLastLogin} días`);
    }

    if (metrics.weeklyStudyTime < 60) {
      riskFactors.push('Muy poco tiempo de estudio semanal');
    }

    if (metrics.studyStreak === 0) {
      riskFactors.push('Sin racha de estudio activa');
    }

    if (metrics.completionRate < 0.3) {
      riskFactors.push('Bajo progreso en conceptos');
    }

    if (metrics.avgQuizScore < 50) {
      riskFactors.push('Bajo rendimiento en evaluaciones');
    }

    if (!metrics.hasTeacher) {
      riskFactors.push('Sin profesor asignado');
    }

    if (metrics.gamesPlayed === 0) {
      riskFactors.push('No ha explorado los juegos educativos');
    }

    return riskFactors;
  }

  // Generar recomendaciones personalizadas
  generateRecommendations(metrics: StudentMetrics, riskFactors: string[]): string[] {
    const recommendations: string[] = [];

    if (metrics.daysSinceLastLogin > 7) {
      recommendations.push('Enviar recordatorio personalizado para retomar el estudio');
    }

    if (metrics.weeklyStudyTime < 60) {
      recommendations.push('Sugerir sesiones de estudio más cortas pero frecuentes');
    }

    if (metrics.studyStreak === 0) {
      recommendations.push('Ofrecer incentivos para iniciar nueva racha de estudio');
    }

    if (metrics.completionRate < 0.3) {
      recommendations.push('Revisar dificultad del contenido y ofrecer apoyo adicional');
    }

    if (!metrics.hasTeacher) {
      recommendations.push('Conectar con un profesor para apoyo personalizado');
    }

    if (metrics.gamesPlayed === 0) {
      recommendations.push('Introducir los juegos educativos como alternativa de aprendizaje');
    }

    if (metrics.avgQuizScore < 50) {
      recommendations.push('Ofrecer sesiones de repaso y práctica adicional');
    }

    return recommendations;
  }

  // Predecir churn para un estudiante
  async predictStudentChurn(userId: string): Promise<ChurnPrediction | null> {
    try {
      const metrics = await this.collectStudentMetrics(userId);
      if (!metrics) return null;

      const churnProbability = this.calculateChurnProbability(metrics);
      const riskFactors = this.identifyRiskFactors(metrics);
      const recommendations = this.generateRecommendations(metrics, riskFactors);

      // Clasificar riesgo
      let churnRisk: 'low' | 'medium' | 'high';
      if (churnProbability < 30) {
        churnRisk = 'low';
      } else if (churnProbability < 60) {
        churnRisk = 'medium';
      } else {
        churnRisk = 'high';
      }

      // Actualizar métricas con predicciones
      metrics.churnRisk = churnRisk;
      metrics.churnProbability = churnProbability;
      metrics.satisfactionScore = 100 - churnProbability;
      metrics.recommendationLikelihood = metrics.satisfactionScore > 70 ? 80 : 30;

      const prediction: ChurnPrediction = {
        userId,
        predictedChurn: churnProbability > 60,
        churnProbability,
        riskFactors,
        recommendations,
        predictedDate: new Date()
      };

      // Guardar predicción en Firestore
      await setDoc(doc(db, 'churnPredictions', userId), {
        ...prediction,
        metrics,
        timestamp: Timestamp.now()
      });

      return prediction;

    } catch (error) {
      console.error('Error predicting student churn:', error);
      return null;
    }
  }

  // Analizar churn para todos los estudiantes de una institución
  async analyzeInstitutionChurn(institutionId: string): Promise<{
    totalStudents: number;
    atRiskStudents: number;
    churnRate: number;
    predictions: ChurnPrediction[];
  }> {
    try {
      // Obtener todos los estudiantes de la institución
      const studentsQuery = query(
        collection(db, 'users'),
        where('institution', '==', institutionId),
        where('accountType', '==', 'student')
      );

      const studentsDocs = await getDocs(studentsQuery);
      const predictions: ChurnPrediction[] = [];
      let atRiskCount = 0;

      // Analizar cada estudiante
      for (const studentDoc of studentsDocs.docs) {
        const prediction = await this.predictStudentChurn(studentDoc.id);
        if (prediction) {
          predictions.push(prediction);
          if (prediction.predictedChurn) {
            atRiskCount++;
          }
        }
      }

      return {
        totalStudents: studentsDocs.size,
        atRiskStudents: atRiskCount,
        churnRate: (atRiskCount / studentsDocs.size) * 100,
        predictions
      };

    } catch (error) {
      console.error('Error analyzing institution churn:', error);
      return {
        totalStudents: 0,
        atRiskStudents: 0,
        churnRate: 0,
        predictions: []
      };
    }
  }

  // Obtener estudiantes en riesgo para intervención
  async getAtRiskStudents(limitCount: number = 20): Promise<StudentMetrics[]> {
    try {
      const predictionsQuery = query(
        collection(db, 'churnPredictions'),
        where('predictedChurn', '==', true),
        orderBy('churnProbability', 'desc'),
        limit(limitCount)
      );

      const predictionsDocs = await getDocs(predictionsQuery);
      const students: StudentMetrics[] = [];

      predictionsDocs.forEach(doc => {
        const data = doc.data();
        if (data.metrics) {
          students.push(data.metrics);
        }
      });

      return students;

    } catch (error) {
      console.error('Error getting at-risk students:', error);
      return [];
    }
  }
}

export const churnPredictionService = new ChurnPredictionService();