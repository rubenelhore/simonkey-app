import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc, 
  getDoc,
  limit
} from 'firebase/firestore';
import { db } from './firebase';
import { studyStreakService } from './studyStreakService';
import { gamePointsService } from './gamePointsService';
import { getDomainProgressForNotebook } from '../utils/domainProgress';

export interface NotebookPoints {
  puntosRepasoInteligente: number;
  puntosEstudioActivo: number;
  puntosEstudioLibre: number;
  puntosQuiz: number;
  puntosJuegos: number;
  score: number;
  porcentajeDominio: number;
}

export class PointsCalculationService {
  /**
   * Calculate points for a notebook using direct Firebase queries
   * This is the same logic as ClassAnalyticsPage.calculateNotebookPoints
   */
  static async calculateNotebookPoints(notebookId: string, userId: string): Promise<NotebookPoints> {
    console.log(`[PointsCalculationService] calculateNotebookPoints called for ${notebookId}, userId: ${userId}`);
    try {
      // Use the same queries as StudyModePage - query studySessions collection directly
      const [
        smartStudySessions,
        voiceRecognitionSessions, 
        freeStudySessions,
        quizStatsDoc,
        notebookPoints,
        userStreak,
        domainProgress
      ] = await Promise.all([
        // Smart study sessions - query studySessions collection with mode filter
        getDocs(query(
          collection(db, 'studySessions'),
          where('userId', '==', userId),
          where('notebookId', '==', notebookId),
          where('mode', '==', 'smart'),
          where('validated', '==', true),
          limit(100)
        )),
        // Voice recognition sessions - query studySessions collection with mode filter  
        getDocs(query(
          collection(db, 'studySessions'),
          where('userId', '==', userId),
          where('notebookId', '==', notebookId),
          where('mode', '==', 'voice_recognition'),
          where('validated', '==', true),
          limit(100)
        )),
        // Free study sessions - query studySessions collection with mode filter
        getDocs(query(
          collection(db, 'studySessions'),
          where('userId', '==', userId),
          where('notebookId', '==', notebookId),
          where('mode', '==', 'free'),
          limit(100)
        )),
        // Quiz stats
        getDoc(doc(db, 'users', userId, 'quizStats', notebookId)),
        // Game points
        gamePointsService.getNotebookPoints(userId, notebookId).catch(() => ({ totalPoints: 0 })),
        // User streak
        studyStreakService.getUserStreak(userId).catch(() => ({ currentStreak: 0 })),
        // Domain progress data (concepts dominated and total)
        getDomainProgressForNotebook(notebookId)
      ]);

      console.log(`[PointsCalculationService] DEBUG: Smart study sessions found: ${smartStudySessions.size}`);
      console.log(`[PointsCalculationService] DEBUG: Voice recognition sessions found: ${voiceRecognitionSessions.size}`);
      console.log(`[PointsCalculationService] DEBUG: Free study sessions found: ${freeStudySessions.size}`);

      // Calculate smart study points based on intensity (same as StudyModePage)
      let smartStudyPoints = 0;
      smartStudySessions.forEach((doc) => {
        const sessionData = doc.data();
        const intensity = sessionData.intensity || 'warm_up';
        console.log(`[PointsCalculationService] DEBUG: Smart study session intensity: ${intensity}`, sessionData);
        
        switch(intensity) {
          case 'warm_up':
            smartStudyPoints += 0.5;
            break;
          case 'progress':
            smartStudyPoints += 1.0;
            break;
          case 'rocket':
            smartStudyPoints += 2.0;
            break;
          default:
            smartStudyPoints += 0.5;
        }
      });

      // Calculate voice recognition points (same as StudyModePage)
      let voiceRecognitionPoints = 0;
      voiceRecognitionSessions.forEach((doc) => {
        const sessionData = doc.data();
        const sessionScore = sessionData.sessionScore || sessionData.finalSessionScore || 0;
        console.log(`[PointsCalculationService] DEBUG: Voice session data:`, {
          docId: doc.id,
          sessionScore: sessionData.sessionScore,
          finalSessionScore: sessionData.finalSessionScore,
          calculatedScore: sessionScore,
          notebookId: sessionData.notebookId
        });
        voiceRecognitionPoints += sessionScore;
      });

      // Calculate free study points (0.05 por sesión = 50 puntos finales)
      const freeStudyCount = freeStudySessions.size;
      const freeStudyPoints = freeStudyCount * 0.05;

      // Get quiz points (usar totalScore si existe, sino maxScore por compatibilidad)
      const quizPoints = quizStatsDoc.exists() ? 
        (quizStatsDoc.data().totalScore !== undefined ? quizStatsDoc.data().totalScore : (quizStatsDoc.data().maxScore || 0)) : 0;

      // Get game points
      const gamePointsValue = notebookPoints.totalPoints || 0;

      // Calculate streak bonus (same as StudyModePage)
      const streakBonus = studyStreakService.getStreakBonus(userStreak.currentStreak);

      // Calculate individual points
      const puntosRepasoInteligente = Math.round(smartStudyPoints * 1000);
      const puntosEstudioActivo = Math.round(voiceRecognitionPoints * 1000);
      const puntosEstudioLibre = Math.round(freeStudyPoints * 1000);
      const puntosQuiz = quizPoints;
      const puntosJuegos = gamePointsValue;

      // Calculate domain percentage (same as MateriaItem)
      const porcentajeDominio = domainProgress.total > 0 
        ? Math.round((domainProgress.dominated / domainProgress.total) * 100)
        : 0;

      // Calculate score general as sum of all points + streak bonus
      const scoreGeneral = puntosRepasoInteligente + puntosEstudioActivo + puntosEstudioLibre + puntosQuiz + puntosJuegos + streakBonus;

      const result = {
        puntosRepasoInteligente,
        puntosEstudioActivo,
        puntosEstudioLibre,
        puntosQuiz,
        puntosJuegos,
        score: scoreGeneral, // Override the score with calculated value
        porcentajeDominio: porcentajeDominio // Override with calculated domain percentage
      };
      
      console.log(`[PointsCalculationService] DEBUG: Calculated points for ${notebookId}:`, {
        smartStudyPoints: smartStudyPoints,
        voiceRecognitionPoints: voiceRecognitionPoints,
        freeStudyPoints: freeStudyPoints,
        streakBonus: streakBonus,
        currentStreak: userStreak.currentStreak,
        scoreGeneral: scoreGeneral,
        porcentajeDominio: porcentajeDominio,
        domainProgress: domainProgress,
        result: result
      });
      
      return result;

    } catch (error) {
      console.error(`[PointsCalculationService] Error calculating points for notebook ${notebookId}:`, error);
      return {
        puntosRepasoInteligente: 0,
        puntosEstudioActivo: 0,
        puntosEstudioLibre: 0,
        puntosQuiz: 0,
        puntosJuegos: 0,
        score: 0,
        porcentajeDominio: 0
      };
    }
  }

  /**
   * Calculate the total score for a student across all notebooks in a materia
   */
  static async calculateMateriaScore(materiaId: string, studentId: string): Promise<number> {
    try {
      console.log(`[PointsCalculationService] Calculating materia score for student ${studentId} in materia ${materiaId}`);
      
      // Get all notebooks for this materia
      const notebooksQuery = query(
        collection(db, 'notebooks'),
        where('materiaId', '==', materiaId)
      );
      
      const notebooksSnapshot = await getDocs(notebooksQuery);
      
      if (notebooksSnapshot.empty) {
        console.log(`[PointsCalculationService] No notebooks found for materia ${materiaId}`);
        return 0;
      }
      
      let totalScore = 0;
      
      // Calculate points for each notebook and sum them up
      const notebookPromises = notebooksSnapshot.docs.map(async (notebookDoc) => {
        const notebookId = notebookDoc.id;
        const points = await this.calculateNotebookPoints(notebookId, studentId);
        console.log(`[PointsCalculationService] Notebook ${notebookId} score: ${points.score}`);
        return points.score;
      });
      
      const notebookScores = await Promise.all(notebookPromises);
      totalScore = notebookScores.reduce((sum, score) => sum + score, 0);
      
      console.log(`[PointsCalculationService] Total materia score for student ${studentId}: ${totalScore}`);
      return totalScore;
      
    } catch (error) {
      console.error(`[PointsCalculationService] Error calculating materia score:`, error);
      return 0;
    }
  }
}