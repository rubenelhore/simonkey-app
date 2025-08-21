import { 
  collection, 
  getDocs, 
  query, 
  where,
  Timestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from './firebase';

export interface TeacherAnalyticsData {
  overview: {
    totalStudents: number;
    activeStudents: number;
    totalMaterias: number;
    totalExams: number;
    avgEngagement: number;
  };
  studentProgress: {
    avgScore: number;
    completionRate: number;
    improvementRate: number;
  };
  examMetrics: {
    totalAttempts: number;
    avgScore: number;
    completionRate: number;
  };
  recentActivity: {
    lastWeekActive: number;
    lastMonthActive: number;
  };
}

export class TeacherAnalyticsService {
  /**
   * Get analytics for a specific teacher using the new enrollment system
   */
  static async getTeacherAnalytics(teacherId: string): Promise<TeacherAnalyticsData> {
    try {
      console.log('📊 Fetching teacher analytics for:', teacherId);
      
      // Get teacher's enrollments
      const enrollmentsQuery = query(
        collection(db, 'enrollments'),
        where('teacherId', '==', teacherId),
        where('status', '==', 'active')
      );
      const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
      
      const studentIds = new Set<string>();
      const materiaIds = new Set<string>();
      
      enrollmentsSnapshot.forEach(doc => {
        const enrollment = doc.data();
        studentIds.add(enrollment.studentId);
        materiaIds.add(enrollment.materiaId);
      });
      
      console.log(`📊 Found ${studentIds.size} students and ${materiaIds.size} materias`);
      
      // Get teacher's exams
      const examsQuery = query(
        collection(db, 'exams'),
        where('idProfesor', '==', teacherId)
      );
      const examsSnapshot = await getDocs(examsQuery);
      const examIds = examsSnapshot.docs.map(doc => doc.id);
      
      // Get exam attempts for teacher's exams
      let totalAttempts = 0;
      let completedAttempts = 0;
      let totalScore = 0;
      let scoreCount = 0;
      
      if (examIds.length > 0) {
        // Process in batches of 10 due to Firestore limitations
        for (let i = 0; i < examIds.length; i += 10) {
          const batch = examIds.slice(i, i + 10);
          const attemptsQuery = query(
            collection(db, 'examAttempts'),
            where('examId', 'in', batch)
          );
          const attemptsSnapshot = await getDocs(attemptsQuery);
          
          attemptsSnapshot.forEach(doc => {
            const attempt = doc.data();
            totalAttempts++;
            
            if (attempt.status === 'completed') {
              completedAttempts++;
              if (attempt.score) {
                totalScore += attempt.score;
                scoreCount++;
              }
            }
          });
        }
      }
      
      // Calculate activity metrics
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      let lastWeekActive = 0;
      let lastMonthActive = 0;
      
      // Check student activity
      for (const studentId of Array.from(studentIds)) {
        try {
          const activitiesQuery = query(
            collection(db, 'userActivities'),
            where('userId', '==', studentId),
            where('timestamp', '>=', Timestamp.fromDate(oneMonthAgo)),
            limit(1)
          );
          const activitiesSnapshot = await getDocs(activitiesQuery);
          
          if (activitiesSnapshot.size > 0) {
            lastMonthActive++;
            const activityData = activitiesSnapshot.docs[0].data();
            const activityDate = activityData.timestamp?.toDate();
            
            if (activityDate && activityDate >= oneWeekAgo) {
              lastWeekActive++;
            }
          }
        } catch (error) {
          console.warn(`Could not fetch activity for student ${studentId}:`, error);
        }
      }
      
      // Calculate metrics
      const avgExamScore = scoreCount > 0 ? totalScore / scoreCount : 0;
      const examCompletionRate = totalAttempts > 0 ? (completedAttempts / totalAttempts) * 100 : 0;
      const activeStudentsRate = studentIds.size > 0 ? (lastWeekActive / studentIds.size) * 100 : 0;
      
      return {
        overview: {
          totalStudents: studentIds.size,
          activeStudents: lastWeekActive,
          totalMaterias: materiaIds.size,
          totalExams: examsSnapshot.size,
          avgEngagement: activeStudentsRate
        },
        studentProgress: {
          avgScore: avgExamScore,
          completionRate: examCompletionRate,
          improvementRate: 0 // Placeholder - would need historical data
        },
        examMetrics: {
          totalAttempts,
          avgScore: avgExamScore,
          completionRate: examCompletionRate
        },
        recentActivity: {
          lastWeekActive,
          lastMonthActive
        }
      };
    } catch (error) {
      console.error('Error fetching teacher analytics:', error);
      
      // Return empty data structure on error
      return {
        overview: {
          totalStudents: 0,
          activeStudents: 0,
          totalMaterias: 0,
          totalExams: 0,
          avgEngagement: 0
        },
        studentProgress: {
          avgScore: 0,
          completionRate: 0,
          improvementRate: 0
        },
        examMetrics: {
          totalAttempts: 0,
          avgScore: 0,
          completionRate: 0
        },
        recentActivity: {
          lastWeekActive: 0,
          lastMonthActive: 0
        }
      };
    }
  }
  
  /**
   * Get analytics for all teacher's materias
   */
  static async getMateriasAnalytics(teacherId: string) {
    try {
      // Get teacher's materias
      const materiasQuery = query(
        collection(db, 'materias'),
        where('userId', '==', teacherId)
      );
      const materiasSnapshot = await getDocs(materiasQuery);
      
      const materiasAnalytics = [];
      
      for (const materiaDoc of materiasSnapshot.docs) {
        const materiaData = materiaDoc.data();
        
        // Get enrollments for this materia
        const enrollmentsQuery = query(
          collection(db, 'enrollments'),
          where('materiaId', '==', materiaDoc.id),
          where('teacherId', '==', teacherId),
          where('status', '==', 'active')
        );
        const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
        
        // Get exams for this materia
        const examsQuery = query(
          collection(db, 'exams'),
          where('idMateria', '==', materiaDoc.id),
          where('idProfesor', '==', teacherId)
        );
        const examsSnapshot = await getDocs(examsQuery);
        
        materiasAnalytics.push({
          id: materiaDoc.id,
          name: materiaData.title || materiaData.nombre || 'Sin nombre',
          studentCount: enrollmentsSnapshot.size,
          examCount: examsSnapshot.size,
          isActive: enrollmentsSnapshot.size > 0
        });
      }
      
      return materiasAnalytics;
    } catch (error) {
      console.error('Error fetching materias analytics:', error);
      return [];
    }
  }
}