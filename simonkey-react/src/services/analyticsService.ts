import { db } from './firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  getDoc,
  doc,
  Timestamp,
  orderBy,
  limit,
  startAt,
  endAt
} from 'firebase/firestore';

export interface AnalyticsData {
  executive: ExecutiveDashboard;
  userAnalytics: UserAnalyticsDashboard;
  academicPerformance: AcademicPerformanceDashboard;
  teacherAnalytics: TeacherAnalyticsDashboard;
  institutionOverview: InstitutionOverviewDashboard;
  contentAnalytics: ContentAnalyticsDashboard;
  technicalMonitoring: TechnicalMonitoringDashboard;
}

export interface ExecutiveDashboard {
  totalUsers: number;
  activeUsers: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  usersBySubscription: {
    free: number;
    pro: number;
    school: number;
    university: number;
    super_admin: number;
  };
  growth: {
    usersLastMonth: number;
    usersThisMonth: number;
    growthRate: number;
  };
  revenue: {
    mrr: number;
    projectedMrr: number;
    conversionRate: number;
  };
  engagement: {
    dauMauRatio: number;
    avgSessionsPerUser: number;
    avgSessionDuration: number;
  };
  platformHealth: {
    score: number;
    activeStreaks: number;
    contentCreationRate: number;
  };
}

export interface UserAnalyticsDashboard {
  demographics: {
    byAge: { [key: string]: number };
    bySubscription: { [key: string]: number };
    byRole: { [key: string]: number };
  };
  behavior: {
    avgStudyTime: number;
    peakHours: { hour: number; count: number }[];
    weekdayActivity: { [key: string]: number };
  };
  retention: {
    day1: number;
    day7: number;
    day30: number;
    churnRate: number;
  };
  engagement: {
    activeStreaks: number;
    avgStreakLength: number;
    longestStreak: number;
    studySessionsPerUser: number;
  };
}

export interface AcademicPerformanceDashboard {
  globalMetrics: {
    avgGlobalScore: number;
    avgPercentile: number;
    conceptsMastered: number;
    conceptsInProgress: number;
  };
  learningProgress: {
    avgMasteryRate: number;
    avgLearningVelocity: number;
    retentionRate: number;
    forgettingCurve: { day: number; retention: number }[];
  };
  assessments: {
    totalQuizzes: number;
    avgQuizScore: number;
    quizPassRate: number;
    totalExams: number;
    avgExamScore: number;
    examCompletionRate: number;
  };
  rankings: {
    topPerformers: { userId: string; name: string; score: number }[];
    avgPositionChange: number;
    competitionParticipation: number;
  };
}

export interface TeacherAnalyticsDashboard {
  overview: {
    totalTeachers: number;
    activeTeachers: number;
    avgStudentsPerTeacher: number;
    avgSubjectsPerTeacher: number;
  };
  effectiveness: {
    avgStudentImprovement: number;
    avgEngagementRate: number;
    contentCreationRate: number;
    examCreationRate: number;
  };
  topTeachers: {
    byStudentProgress: { teacherId: string; name: string; improvement: number }[];
    byEngagement: { teacherId: string; name: string; engagement: number }[];
    byContent: { teacherId: string; name: string; contentCount: number }[];
  };
  subjectMetrics: {
    [subjectId: string]: {
      name: string;
      teachers: number;
      students: number;
      avgScore: number;
      studyTime: number;
    };
  };
}

export interface InstitutionOverviewDashboard {
  summary: {
    totalInstitutions: number;
    totalSchoolUsers: number;
    avgUsersPerInstitution: number;
    adoptionRate: number;
  };
  institutions: {
    id: string;
    name: string;
    userCount: number;
    teacherCount: number;
    studentCount: number;
    avgPerformance: number;
    engagementRate: number;
  }[];
  rankings: {
    bySize: { institutionId: string; name: string; users: number }[];
    byPerformance: { institutionId: string; name: string; score: number }[];
    byEngagement: { institutionId: string; name: string; engagement: number }[];
  };
}

export interface ContentAnalyticsDashboard {
  overview: {
    totalNotebooks: number;
    totalConcepts: number;
    totalMaterials: number;
    avgConceptsPerNotebook: number;
  };
  creation: {
    notebooksCreatedToday: number;
    notebooksCreatedWeek: number;
    notebooksCreatedMonth: number;
    conceptsCreatedToday: number;
    conceptsCreatedWeek: number;
    conceptsCreatedMonth: number;
  };
  usage: {
    activeNotebooks: number;
    frozenNotebooks: number;
    sharedNotebooks: number;
    materialsUploadedGB: number;
  };
  quality: {
    avgConceptMastery: number;
    mostStudiedNotebooks: { id: string; title: string; studySessions: number }[];
    mostEffectiveContent: { id: string; title: string; masteryRate: number }[];
  };
}

export interface TechnicalMonitoringDashboard {
  system: {
    totalErrors: number;
    errorsLast24h: number;
    errorsByType: { [type: string]: number };
    uptime: number;
  };
  authentication: {
    totalLogins: number;
    failedLogins: number;
    passwordResets: number;
    activeTemporaryCredentials: number;
  };
  storage: {
    totalStorageGB: number;
    storageByType: { [type: string]: number };
    avgFileSize: number;
    largestFiles: { name: string; size: number; type: string }[];
  };
  performance: {
    avgResponseTime: number;
    slowestQueries: { query: string; time: number }[];
    apiCallsByService: { [service: string]: number };
    batchOperations: number;
  };
}

class AnalyticsService {
  private static instance: AnalyticsService;

  private constructor() {}

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  async getExecutiveDashboard(): Promise<ExecutiveDashboard> {
    try {
      // Get total users
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const totalUsers = usersSnapshot.size;

      // Count users by subscription
      const usersBySubscription = {
        free: 0,
        pro: 0,
        school: 0,
        university: 0,
        super_admin: 0
      };

      usersSnapshot.forEach(doc => {
        const subscription = doc.data().subscription || 'free';
        if (subscription in usersBySubscription) {
          usersBySubscription[subscription as keyof typeof usersBySubscription]++;
        }
      });

      // Calculate active users (based on recent activities)
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const dailyActiveQuery = query(
        collection(db, 'userActivities'),
        where('timestamp', '>=', Timestamp.fromDate(oneDayAgo))
      );
      const dailyActiveSnapshot = await getDocs(dailyActiveQuery);
      const dailyActiveUsers = new Set(dailyActiveSnapshot.docs.map(doc => doc.data().userId)).size;

      const weeklyActiveQuery = query(
        collection(db, 'userActivities'),
        where('timestamp', '>=', Timestamp.fromDate(oneWeekAgo))
      );
      const weeklyActiveSnapshot = await getDocs(weeklyActiveQuery);
      const weeklyActiveUsers = new Set(weeklyActiveSnapshot.docs.map(doc => doc.data().userId)).size;

      const monthlyActiveQuery = query(
        collection(db, 'userActivities'),
        where('timestamp', '>=', Timestamp.fromDate(oneMonthAgo))
      );
      const monthlyActiveSnapshot = await getDocs(monthlyActiveQuery);
      const monthlyActiveUsers = new Set(monthlyActiveSnapshot.docs.map(doc => doc.data().userId)).size;

      // Calculate growth
      const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      const usersLastMonth = usersSnapshot.docs.filter(doc => {
        const createdAt = doc.data().createdAt?.toDate();
        return createdAt && createdAt >= twoMonthsAgo && createdAt < oneMonthAgo;
      }).length;

      const usersThisMonth = usersSnapshot.docs.filter(doc => {
        const createdAt = doc.data().createdAt?.toDate();
        return createdAt && createdAt >= oneMonthAgo;
      }).length;

      const growthRate = usersLastMonth > 0 ? ((usersThisMonth - usersLastMonth) / usersLastMonth) * 100 : 0;

      // Calculate revenue metrics
      const proUsers = usersBySubscription.pro;
      const schoolUsers = usersBySubscription.school;
      const universityUsers = usersBySubscription.university;
      
      // Assumed pricing (adjust based on actual pricing)
      const proPrice = 9.99;
      const schoolPrice = 4.99;
      const universityPrice = 6.99;
      
      const mrr = (proUsers * proPrice) + (schoolUsers * schoolPrice) + (universityUsers * universityPrice);
      const projectedMrr = mrr * 1.1; // 10% growth projection
      const conversionRate = totalUsers > 0 ? ((proUsers + schoolUsers + universityUsers) / totalUsers) * 100 : 0;

      // Calculate engagement metrics
      const dauMauRatio = monthlyActiveUsers > 0 ? dailyActiveUsers / monthlyActiveUsers : 0;

      // Get study sessions for engagement metrics
      const studySessionsSnapshot = await getDocs(collection(db, 'studySessions'));
      const avgSessionsPerUser = totalUsers > 0 ? studySessionsSnapshot.size / totalUsers : 0;
      
      let totalDuration = 0;
      studySessionsSnapshot.forEach(doc => {
        const duration = doc.data().timeSpent || 0;
        totalDuration += duration;
      });
      const avgSessionDuration = studySessionsSnapshot.size > 0 ? totalDuration / studySessionsSnapshot.size : 0;

      // Calculate platform health
      const streaksSnapshot = await getDocs(collection(db, 'userStreaks'));
      const activeStreaks = streaksSnapshot.docs.filter(doc => doc.data().isActive).length;

      const notebooksSnapshot = await getDocs(collection(db, 'notebooks'));
      const recentNotebooks = notebooksSnapshot.docs.filter(doc => {
        const createdAt = doc.data().createdAt?.toDate();
        return createdAt && createdAt >= oneWeekAgo;
      }).length;
      const contentCreationRate = recentNotebooks / 7; // per day

      const platformHealthScore = Math.min(100, 
        (dauMauRatio * 100 * 0.3) + 
        (conversionRate * 0.3) + 
        (activeStreaks / totalUsers * 100 * 0.2) +
        (contentCreationRate * 10 * 0.2)
      );

      return {
        totalUsers,
        activeUsers: {
          daily: dailyActiveUsers,
          weekly: weeklyActiveUsers,
          monthly: monthlyActiveUsers
        },
        usersBySubscription,
        growth: {
          usersLastMonth,
          usersThisMonth,
          growthRate
        },
        revenue: {
          mrr,
          projectedMrr,
          conversionRate
        },
        engagement: {
          dauMauRatio,
          avgSessionsPerUser,
          avgSessionDuration: avgSessionDuration / 60 // Convert to minutes
        },
        platformHealth: {
          score: platformHealthScore,
          activeStreaks,
          contentCreationRate
        }
      };
    } catch (error) {
      console.error('Error fetching executive dashboard:', error);
      throw error;
    }
  }

  async getUserAnalytics(): Promise<UserAnalyticsDashboard> {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      
      // Demographics
      const demographics = {
        byAge: {} as { [key: string]: number },
        bySubscription: {} as { [key: string]: number },
        byRole: {} as { [key: string]: number }
      };

      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        
        // Count by subscription
        const subscription = userData.subscription || 'free';
        demographics.bySubscription[subscription] = (demographics.bySubscription[subscription] || 0) + 1;
        
        // Count by role
        const role = userData.schoolRole || 'individual';
        demographics.byRole[role] = (demographics.byRole[role] || 0) + 1;
        
        // Calculate age groups if birthdate exists
        if (userData.birthdate) {
          const birthDate = new Date(userData.birthdate);
          const age = new Date().getFullYear() - birthDate.getFullYear();
          let ageGroup = '';
          if (age < 13) ageGroup = '<13';
          else if (age < 18) ageGroup = '13-17';
          else if (age < 25) ageGroup = '18-24';
          else if (age < 35) ageGroup = '25-34';
          else if (age < 45) ageGroup = '35-44';
          else if (age < 55) ageGroup = '45-54';
          else ageGroup = '55+';
          
          demographics.byAge[ageGroup] = (demographics.byAge[ageGroup] || 0) + 1;
        }
      });

      // Behavior patterns
      const studySessionsSnapshot = await getDocs(collection(db, 'studySessions'));
      const activitiesSnapshot = await getDocs(collection(db, 'userActivities'));
      
      let totalStudyTime = 0;
      const hourActivity: { [hour: number]: number } = {};
      const weekdayActivity: { [day: string]: number } = {
        domingo: 0,
        lunes: 0,
        martes: 0,
        miercoles: 0,
        jueves: 0,
        viernes: 0,
        sabado: 0
      };
      
      studySessionsSnapshot.forEach(doc => {
        const sessionData = doc.data();
        totalStudyTime += sessionData.timeSpent || 0;
        
        if (sessionData.startTime) {
          const date = sessionData.startTime.toDate();
          const hour = date.getHours();
          hourActivity[hour] = (hourActivity[hour] || 0) + 1;
          
          const dayNames = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
          const dayName = dayNames[date.getDay()];
          weekdayActivity[dayName]++;
        }
      });
      
      const avgStudyTime = usersSnapshot.size > 0 ? totalStudyTime / usersSnapshot.size / 60 : 0; // in minutes
      
      const peakHours = Object.entries(hourActivity)
        .map(([hour, count]) => ({ hour: parseInt(hour), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Retention metrics (simplified calculation)
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const newUsersLastMonth = usersSnapshot.docs.filter(doc => {
        const createdAt = doc.data().createdAt?.toDate();
        return createdAt && createdAt >= thirtyDaysAgo;
      });

      let retainedDay1 = 0;
      let retainedDay7 = 0;
      let retainedDay30 = 0;
      
      for (const userDoc of newUsersLastMonth) {
        const userId = userDoc.id;
        const createdAt = userDoc.data().createdAt?.toDate();
        if (!createdAt) continue;
        
        // Check for activities after day 1, 7, and 30
        const day1 = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
        const day7 = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
        const day30 = new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);
        
        const userActivities = activitiesSnapshot.docs.filter(doc => doc.data().userId === userId);
        
        if (userActivities.some(doc => {
          const timestamp = doc.data().timestamp?.toDate();
          return timestamp && timestamp >= day1;
        })) retainedDay1++;
        
        if (userActivities.some(doc => {
          const timestamp = doc.data().timestamp?.toDate();
          return timestamp && timestamp >= day7;
        })) retainedDay7++;
        
        if (userActivities.some(doc => {
          const timestamp = doc.data().timestamp?.toDate();
          return timestamp && timestamp >= day30;
        })) retainedDay30++;
      }
      
      const totalNewUsers = newUsersLastMonth.length;
      const retention = {
        day1: totalNewUsers > 0 ? (retainedDay1 / totalNewUsers) * 100 : 0,
        day7: totalNewUsers > 0 ? (retainedDay7 / totalNewUsers) * 100 : 0,
        day30: totalNewUsers > 0 ? (retainedDay30 / totalNewUsers) * 100 : 0,
        churnRate: totalNewUsers > 0 ? ((totalNewUsers - retainedDay30) / totalNewUsers) * 100 : 0
      };

      // Engagement metrics
      const streaksSnapshot = await getDocs(collection(db, 'userStreaks'));
      const activeStreaks = streaksSnapshot.docs.filter(doc => doc.data().isActive).length;
      
      let totalStreakLength = 0;
      let longestStreak = 0;
      
      streaksSnapshot.forEach(doc => {
        const streakData = doc.data();
        const currentStreak = streakData.currentStreak || 0;
        totalStreakLength += currentStreak;
        if (currentStreak > longestStreak) {
          longestStreak = currentStreak;
        }
      });
      
      const avgStreakLength = streaksSnapshot.size > 0 ? totalStreakLength / streaksSnapshot.size : 0;
      const studySessionsPerUser = usersSnapshot.size > 0 ? studySessionsSnapshot.size / usersSnapshot.size : 0;

      return {
        demographics,
        behavior: {
          avgStudyTime,
          peakHours,
          weekdayActivity
        },
        retention,
        engagement: {
          activeStreaks,
          avgStreakLength,
          longestStreak,
          studySessionsPerUser
        }
      };
    } catch (error) {
      console.error('Error fetching user analytics:', error);
      throw error;
    }
  }

  async getAcademicPerformance(): Promise<AcademicPerformanceDashboard> {
    try {
      // Get global metrics from user KPIs
      const userKPIsSnapshot = await getDocs(collection(db, 'userKPIs'));
      
      let totalGlobalScore = 0;
      let totalPercentile = 0;
      let totalConceptsMastered = 0;
      let totalConceptsInProgress = 0;
      let userCount = 0;
      
      userKPIsSnapshot.forEach(doc => {
        const kpiData = doc.data();
        if (kpiData.global) {
          totalGlobalScore += kpiData.global.scoreGlobal || 0;
          totalPercentile += kpiData.global.percentilPromedioGlobal || 0;
          userCount++;
        }
        
        // Count concepts from cuadernos
        if (kpiData.cuadernos) {
          Object.values(kpiData.cuadernos).forEach((cuaderno: any) => {
            totalConceptsMastered += cuaderno.conceptosDominados || 0;
            totalConceptsInProgress += cuaderno.conceptosNoDominados || 0;
          });
        }
      });
      
      const avgGlobalScore = userCount > 0 ? totalGlobalScore / userCount : 0;
      const avgPercentile = userCount > 0 ? totalPercentile / userCount : 0;

      // Learning progress metrics
      const learningDataSnapshot = await getDocs(collection(db, 'learningData'));
      
      let totalEaseFactor = 0;
      let totalInterval = 0;
      let learningDataCount = 0;
      let retainedConcepts = 0;
      
      learningDataSnapshot.forEach(doc => {
        const data = doc.data();
        totalEaseFactor += data.easeFactor || 2.5;
        totalInterval += data.interval || 1;
        learningDataCount++;
        
        // Consider concept retained if interval > 7 days
        if (data.interval > 7) {
          retainedConcepts++;
        }
      });
      
      const avgMasteryRate = totalConceptsMastered > 0 
        ? (totalConceptsMastered / (totalConceptsMastered + totalConceptsInProgress)) * 100 
        : 0;
      const avgLearningVelocity = learningDataCount > 0 ? totalInterval / learningDataCount : 0;
      const retentionRate = learningDataCount > 0 ? (retainedConcepts / learningDataCount) * 100 : 0;
      
      // Simple forgetting curve (mock data for demonstration)
      const forgettingCurve = [
        { day: 1, retention: 100 },
        { day: 2, retention: 85 },
        { day: 7, retention: 70 },
        { day: 14, retention: 60 },
        { day: 30, retention: 50 },
        { day: 60, retention: 40 }
      ];

      // Assessment metrics
      const examAttemptsSnapshot = await getDocs(collection(db, 'examAttempts'));
      const schoolExamsSnapshot = await getDocs(collection(db, 'schoolExams'));
      
      const totalExams = schoolExamsSnapshot.size;
      let totalExamScore = 0;
      let completedExams = 0;
      
      examAttemptsSnapshot.forEach(doc => {
        const attemptData = doc.data();
        if (attemptData.status === 'completed') {
          completedExams++;
          totalExamScore += attemptData.score || 0;
        }
      });
      
      const avgExamScore = completedExams > 0 ? totalExamScore / completedExams : 0;
      const examCompletionRate = examAttemptsSnapshot.size > 0 
        ? (completedExams / examAttemptsSnapshot.size) * 100 
        : 0;

      // Quiz metrics (aggregate from user subcollections)
      let totalQuizzes = 0;
      let totalQuizScore = 0;
      let passedQuizzes = 0;
      
      // This would need to iterate through each user's quizResults subcollection
      // For now, using estimated values
      const quizStatsSnapshot = await getDocs(collection(db, 'quizStats'));
      
      quizStatsSnapshot.forEach(doc => {
        const stats = doc.data();
        totalQuizzes += stats.totalQuizzes || 0;
        totalQuizScore += (stats.avgScore || 0) * (stats.totalQuizzes || 0);
        passedQuizzes += stats.passedQuizzes || 0;
      });
      
      const avgQuizScore = totalQuizzes > 0 ? totalQuizScore / totalQuizzes : 0;
      const quizPassRate = totalQuizzes > 0 ? (passedQuizzes / totalQuizzes) * 100 : 0;

      // Rankings
      const topPerformers: { userId: string; name: string; score: number }[] = [];
      const usersSnapshot = await getDocs(collection(db, 'users'));
      
      const userScores: { userId: string; name: string; score: number }[] = [];
      
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const kpiDoc = await getDoc(doc(db, 'userKPIs', userDoc.id));
        
        if (kpiDoc.exists()) {
          const kpiData = kpiDoc.data();
          userScores.push({
            userId: userDoc.id,
            name: userData.displayName || userData.nombre || 'Unknown',
            score: kpiData.global?.scoreGlobal || 0
          });
        }
      }
      
      userScores.sort((a, b) => b.score - a.score);
      const top10Performers = userScores.slice(0, 10);
      
      // Position changes
      const positionHistorySnapshot = await getDocs(collection(db, 'positionHistory'));
      let totalPositionChanges = 0;
      let positionChangeCount = 0;
      
      positionHistorySnapshot.forEach(doc => {
        const history = doc.data();
        if (history.previousPosition && history.currentPosition) {
          totalPositionChanges += Math.abs(history.currentPosition - history.previousPosition);
          positionChangeCount++;
        }
      });
      
      const avgPositionChange = positionChangeCount > 0 ? totalPositionChanges / positionChangeCount : 0;
      const competitionParticipation = (userScores.filter(u => u.score > 0).length / usersSnapshot.size) * 100;

      return {
        globalMetrics: {
          avgGlobalScore,
          avgPercentile,
          conceptsMastered: totalConceptsMastered,
          conceptsInProgress: totalConceptsInProgress
        },
        learningProgress: {
          avgMasteryRate,
          avgLearningVelocity,
          retentionRate,
          forgettingCurve
        },
        assessments: {
          totalQuizzes,
          avgQuizScore,
          quizPassRate,
          totalExams,
          avgExamScore,
          examCompletionRate
        },
        rankings: {
          topPerformers: top10Performers,
          avgPositionChange,
          competitionParticipation
        }
      };
    } catch (error) {
      console.error('Error fetching academic performance:', error);
      throw error;
    }
  }

  async getTeacherAnalytics(): Promise<TeacherAnalyticsDashboard> {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const teachers = usersSnapshot.docs.filter(doc => doc.data().schoolRole === 'teacher');
      const totalTeachers = teachers.length;
      
      // Get active teachers (those with recent activity)
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      let activeTeachers = 0;
      let totalStudentsCount = 0;
      let totalSubjectsCount = 0;
      
      for (const teacherDoc of teachers) {
        const teacherId = teacherDoc.id;
        
        // Check for recent activity
        const activitiesQuery = query(
          collection(db, 'userActivities'),
          where('userId', '==', teacherId),
          where('timestamp', '>=', Timestamp.fromDate(oneWeekAgo))
        );
        const activitiesSnapshot = await getDocs(activitiesQuery);
        
        if (activitiesSnapshot.size > 0) {
          activeTeachers++;
        }
        
        // Count students and subjects
        const teacherData = teacherDoc.data();
        if (teacherData.idAlumnos) {
          totalStudentsCount += teacherData.idAlumnos.length;
        }
        if (teacherData.idMaterias) {
          totalSubjectsCount += teacherData.idMaterias.length;
        }
      }
      
      const avgStudentsPerTeacher = totalTeachers > 0 ? totalStudentsCount / totalTeachers : 0;
      const avgSubjectsPerTeacher = totalTeachers > 0 ? totalSubjectsCount / totalTeachers : 0;

      // Teacher effectiveness metrics
      const teacherMetricsSnapshot = await getDocs(collection(db, 'teacherMetrics'));
      
      let totalImprovement = 0;
      let totalEngagement = 0;
      let metricsCount = 0;
      
      const topByProgress: { teacherId: string; name: string; improvement: number }[] = [];
      const topByEngagement: { teacherId: string; name: string; engagement: number }[] = [];
      
      teacherMetricsSnapshot.forEach(doc => {
        const metrics = doc.data();
        const improvement = metrics.global?.estudioPromedio || 0;
        const engagement = metrics.global?.tiempoEfectivo || 0;
        
        totalImprovement += improvement;
        totalEngagement += engagement;
        metricsCount++;
        
        // Find teacher name
        const teacher = teachers.find(t => t.id === doc.id);
        const teacherName = teacher?.data().displayName || teacher?.data().nombre || 'Unknown';
        
        topByProgress.push({
          teacherId: doc.id,
          name: teacherName,
          improvement
        });
        
        topByEngagement.push({
          teacherId: doc.id,
          name: teacherName,
          engagement
        });
      });
      
      const avgStudentImprovement = metricsCount > 0 ? totalImprovement / metricsCount : 0;
      const avgEngagementRate = metricsCount > 0 ? totalEngagement / metricsCount : 0;
      
      // Sort and get top 5
      topByProgress.sort((a, b) => b.improvement - a.improvement);
      topByEngagement.sort((a, b) => b.engagement - a.engagement);
      
      // Content creation metrics
      const schoolNotebooksSnapshot = await getDocs(collection(db, 'schoolNotebooks'));
      const schoolExamsSnapshot = await getDocs(collection(db, 'schoolExams'));
      
      const contentByTeacher: { [teacherId: string]: number } = {};
      
      schoolNotebooksSnapshot.forEach(doc => {
        const notebookData = doc.data();
        const profesorId = notebookData.idProfesor;
        if (profesorId) {
          contentByTeacher[profesorId] = (contentByTeacher[profesorId] || 0) + 1;
        }
      });
      
      const topByContent = Object.entries(contentByTeacher)
        .map(([teacherId, count]) => {
          const teacher = teachers.find(t => t.id === teacherId);
          return {
            teacherId,
            name: teacher?.data().displayName || teacher?.data().nombre || 'Unknown',
            contentCount: count
          };
        })
        .sort((a, b) => b.contentCount - a.contentCount)
        .slice(0, 5);
      
      const contentCreationRate = totalTeachers > 0 ? schoolNotebooksSnapshot.size / totalTeachers : 0;
      const examCreationRate = totalTeachers > 0 ? schoolExamsSnapshot.size / totalTeachers : 0;

      // Subject metrics
      const subjectMetrics: { [subjectId: string]: any } = {};
      const schoolSubjectsSnapshot = await getDocs(collection(db, 'schoolSubjects'));
      
      for (const subjectDoc of schoolSubjectsSnapshot.docs) {
        const subjectData = subjectDoc.data();
        const subjectId = subjectDoc.id;
        
        // Count teachers and students for this subject
        const teachersWithSubject = teachers.filter(t => {
          const data = t.data();
          return data.idMaterias && data.idMaterias.includes(subjectId);
        });
        
        let studentCount = 0;
        let totalScore = 0;
        let totalStudyTime = 0;
        
        // Get metrics for this subject
        const subjectNotebooks = schoolNotebooksSnapshot.docs.filter(
          doc => doc.data().idMateria === subjectId
        );
        
        for (const notebook of subjectNotebooks) {
          const notebookId = notebook.id;
          
          // Get study sessions for this notebook
          const sessionsQuery = query(
            collection(db, 'studySessions'),
            where('notebookId', '==', notebookId)
          );
          const sessionsSnapshot = await getDocs(sessionsQuery);
          
          sessionsSnapshot.forEach(doc => {
            const sessionData = doc.data();
            totalStudyTime += sessionData.timeSpent || 0;
          });
        }
        
        subjectMetrics[subjectId] = {
          name: subjectData.nombre || 'Unknown Subject',
          teachers: teachersWithSubject.length,
          students: studentCount,
          avgScore: totalScore,
          studyTime: totalStudyTime / 60 // Convert to minutes
        };
      }

      return {
        overview: {
          totalTeachers,
          activeTeachers,
          avgStudentsPerTeacher,
          avgSubjectsPerTeacher
        },
        effectiveness: {
          avgStudentImprovement,
          avgEngagementRate,
          contentCreationRate,
          examCreationRate
        },
        topTeachers: {
          byStudentProgress: topByProgress.slice(0, 5),
          byEngagement: topByEngagement.slice(0, 5),
          byContent: topByContent
        },
        subjectMetrics
      };
    } catch (error) {
      console.error('Error fetching teacher analytics:', error);
      throw error;
    }
  }

  async getInstitutionOverview(): Promise<InstitutionOverviewDashboard> {
    try {
      const institutionsSnapshot = await getDocs(collection(db, 'schoolInstitutions'));
      const usersSnapshot = await getDocs(collection(db, 'users'));
      
      const totalInstitutions = institutionsSnapshot.size;
      const schoolUsers = usersSnapshot.docs.filter(doc => doc.data().subscription === 'school');
      const totalSchoolUsers = schoolUsers.length;
      
      const institutions: any[] = [];
      const bySize: any[] = [];
      const byPerformance: any[] = [];
      const byEngagement: any[] = [];
      
      for (const instDoc of institutionsSnapshot.docs) {
        const instData = instDoc.data();
        const institutionId = instDoc.id;
        
        // Count users in this institution
        const institutionUsers = schoolUsers.filter(
          user => user.data().idInstitucion === institutionId
        );
        
        const teacherCount = institutionUsers.filter(
          user => user.data().schoolRole === 'teacher'
        ).length;
        
        const studentCount = institutionUsers.filter(
          user => user.data().schoolRole === 'student'
        ).length;
        
        // Calculate average performance
        let totalScore = 0;
        let scoreCount = 0;
        
        for (const user of institutionUsers) {
          const kpiDoc = await getDoc(doc(db, 'userKPIs', user.id));
          if (kpiDoc.exists()) {
            const kpiData = kpiDoc.data();
            if (kpiData.global?.scoreGlobal) {
              totalScore += kpiData.global.scoreGlobal;
              scoreCount++;
            }
          }
        }
        
        const avgPerformance = scoreCount > 0 ? totalScore / scoreCount : 0;
        
        // Calculate engagement rate (users with recent activity)
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        let activeUsers = 0;
        
        for (const user of institutionUsers) {
          const activitiesQuery = query(
            collection(db, 'userActivities'),
            where('userId', '==', user.id),
            where('timestamp', '>=', Timestamp.fromDate(oneWeekAgo)),
            limit(1)
          );
          const activitiesSnapshot = await getDocs(activitiesQuery);
          
          if (activitiesSnapshot.size > 0) {
            activeUsers++;
          }
        }
        
        const engagementRate = institutionUsers.length > 0 
          ? (activeUsers / institutionUsers.length) * 100 
          : 0;
        
        const institutionInfo = {
          id: institutionId,
          name: instData.name || 'Unknown Institution',
          userCount: institutionUsers.length,
          teacherCount,
          studentCount,
          avgPerformance,
          engagementRate
        };
        
        institutions.push(institutionInfo);
        
        bySize.push({
          institutionId,
          name: instData.name || 'Unknown Institution',
          users: institutionUsers.length
        });
        
        byPerformance.push({
          institutionId,
          name: instData.name || 'Unknown Institution',
          score: avgPerformance
        });
        
        byEngagement.push({
          institutionId,
          name: instData.name || 'Unknown Institution',
          engagement: engagementRate
        });
      }
      
      // Sort rankings
      bySize.sort((a, b) => b.users - a.users);
      byPerformance.sort((a, b) => b.score - a.score);
      byEngagement.sort((a, b) => b.engagement - a.engagement);
      
      const avgUsersPerInstitution = totalInstitutions > 0 
        ? totalSchoolUsers / totalInstitutions 
        : 0;
      
      // Calculate adoption rate (active school users / total school users)
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      let activeSchoolUsers = 0;
      
      for (const user of schoolUsers) {
        const activitiesQuery = query(
          collection(db, 'userActivities'),
          where('userId', '==', user.id),
          where('timestamp', '>=', Timestamp.fromDate(oneWeekAgo)),
          limit(1)
        );
        const activitiesSnapshot = await getDocs(activitiesQuery);
        
        if (activitiesSnapshot.size > 0) {
          activeSchoolUsers++;
        }
      }
      
      const adoptionRate = totalSchoolUsers > 0 
        ? (activeSchoolUsers / totalSchoolUsers) * 100 
        : 0;

      return {
        summary: {
          totalInstitutions,
          totalSchoolUsers,
          avgUsersPerInstitution,
          adoptionRate
        },
        institutions: institutions.slice(0, 10), // Top 10 institutions
        rankings: {
          bySize: bySize.slice(0, 5),
          byPerformance: byPerformance.slice(0, 5),
          byEngagement: byEngagement.slice(0, 5)
        }
      };
    } catch (error) {
      console.error('Error fetching institution overview:', error);
      throw error;
    }
  }

  async getContentAnalytics(): Promise<ContentAnalyticsDashboard> {
    try {
      const notebooksSnapshot = await getDocs(collection(db, 'notebooks'));
      const schoolNotebooksSnapshot = await getDocs(collection(db, 'schoolNotebooks'));
      const conceptsSnapshot = await getDocs(collection(db, 'conceptos'));
      const schoolConceptsSnapshot = await getDocs(collection(db, 'schoolConcepts'));
      const materialsSnapshot = await getDocs(collection(db, 'materials'));
      
      const totalNotebooks = notebooksSnapshot.size + schoolNotebooksSnapshot.size;
      const totalConcepts = conceptsSnapshot.size + schoolConceptsSnapshot.size;
      const totalMaterials = materialsSnapshot.size;
      const avgConceptsPerNotebook = totalNotebooks > 0 ? totalConcepts / totalNotebooks : 0;
      
      // Creation metrics
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      let notebooksCreatedToday = 0;
      let notebooksCreatedWeek = 0;
      let notebooksCreatedMonth = 0;
      
      [...notebooksSnapshot.docs, ...schoolNotebooksSnapshot.docs].forEach(doc => {
        const createdAt = doc.data().createdAt?.toDate();
        if (createdAt) {
          if (createdAt >= today) notebooksCreatedToday++;
          if (createdAt >= weekAgo) notebooksCreatedWeek++;
          if (createdAt >= monthAgo) notebooksCreatedMonth++;
        }
      });
      
      let conceptsCreatedToday = 0;
      let conceptsCreatedWeek = 0;
      let conceptsCreatedMonth = 0;
      
      [...conceptsSnapshot.docs, ...schoolConceptsSnapshot.docs].forEach(doc => {
        const createdAt = doc.data().fechaCreacion?.toDate();
        if (createdAt) {
          if (createdAt >= today) conceptsCreatedToday++;
          if (createdAt >= weekAgo) conceptsCreatedWeek++;
          if (createdAt >= monthAgo) conceptsCreatedMonth++;
        }
      });
      
      // Usage metrics
      let activeNotebooks = 0;
      let frozenNotebooks = 0;
      let sharedNotebooks = 0;
      
      notebooksSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.isFrozen) {
          frozenNotebooks++;
        } else {
          activeNotebooks++;
        }
        if (data.shareId) {
          sharedNotebooks++;
        }
      });
      
      // Calculate total storage
      let totalStorageBytes = 0;
      materialsSnapshot.forEach(doc => {
        const size = doc.data().size || 0;
        totalStorageBytes += size;
      });
      const materialsUploadedGB = totalStorageBytes / (1024 * 1024 * 1024);
      
      // Quality metrics
      const studySessionsSnapshot = await getDocs(collection(db, 'studySessions'));
      const notebookStudySessions: { [notebookId: string]: number } = {};
      
      studySessionsSnapshot.forEach(doc => {
        const notebookId = doc.data().notebookId;
        if (notebookId) {
          notebookStudySessions[notebookId] = (notebookStudySessions[notebookId] || 0) + 1;
        }
      });
      
      // Get most studied notebooks
      const mostStudied = Object.entries(notebookStudySessions)
        .map(([notebookId, sessions]) => {
          const notebook = notebooksSnapshot.docs.find(doc => doc.id === notebookId);
          const schoolNotebook = schoolNotebooksSnapshot.docs.find(doc => doc.id === notebookId);
          const notebookData = notebook?.data() || schoolNotebook?.data();
          
          return {
            id: notebookId,
            title: notebookData?.title || 'Unknown Notebook',
            studySessions: sessions
          };
        })
        .sort((a, b) => b.studySessions - a.studySessions)
        .slice(0, 10);
      
      // Calculate average concept mastery
      const learningDataSnapshot = await getDocs(collection(db, 'learningData'));
      let totalMastery = 0;
      let masteryCount = 0;
      
      learningDataSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.quality) {
          totalMastery += data.quality;
          masteryCount++;
        }
      });
      
      const avgConceptMastery = masteryCount > 0 ? (totalMastery / masteryCount) * 20 : 0; // Convert to percentage
      
      // Most effective content (simplified - based on mastery rate)
      const notebookMasteryRates: { [notebookId: string]: { mastered: number; total: number } } = {};
      
      [...conceptsSnapshot.docs, ...schoolConceptsSnapshot.docs].forEach(doc => {
        const conceptData = doc.data();
        const notebookId = conceptData.cuadernoId || conceptData.notebookId;
        
        if (notebookId) {
          if (!notebookMasteryRates[notebookId]) {
            notebookMasteryRates[notebookId] = { mastered: 0, total: 0 };
          }
          
          notebookMasteryRates[notebookId].total++;
          if (conceptData.dominado || conceptData.mastered) {
            notebookMasteryRates[notebookId].mastered++;
          }
        }
      });
      
      const mostEffective = Object.entries(notebookMasteryRates)
        .map(([notebookId, rates]) => {
          const notebook = notebooksSnapshot.docs.find(doc => doc.id === notebookId);
          const schoolNotebook = schoolNotebooksSnapshot.docs.find(doc => doc.id === notebookId);
          const notebookData = notebook?.data() || schoolNotebook?.data();
          
          return {
            id: notebookId,
            title: notebookData?.title || 'Unknown Notebook',
            masteryRate: rates.total > 0 ? (rates.mastered / rates.total) * 100 : 0
          };
        })
        .sort((a, b) => b.masteryRate - a.masteryRate)
        .slice(0, 10);

      return {
        overview: {
          totalNotebooks,
          totalConcepts,
          totalMaterials,
          avgConceptsPerNotebook
        },
        creation: {
          notebooksCreatedToday,
          notebooksCreatedWeek,
          notebooksCreatedMonth,
          conceptsCreatedToday,
          conceptsCreatedWeek,
          conceptsCreatedMonth
        },
        usage: {
          activeNotebooks,
          frozenNotebooks,
          sharedNotebooks,
          materialsUploadedGB
        },
        quality: {
          avgConceptMastery,
          mostStudiedNotebooks: mostStudied,
          mostEffectiveContent: mostEffective
        }
      };
    } catch (error) {
      console.error('Error fetching content analytics:', error);
      throw error;
    }
  }

  async getTechnicalMonitoring(): Promise<TechnicalMonitoringDashboard> {
    try {
      // System metrics
      const systemLogsSnapshot = await getDocs(collection(db, 'systemLogs'));
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      let totalErrors = 0;
      let errorsLast24h = 0;
      const errorsByType: { [type: string]: number } = {};
      
      systemLogsSnapshot.forEach(doc => {
        const logData = doc.data();
        if (logData.level === 'error') {
          totalErrors++;
          
          const timestamp = logData.timestamp?.toDate();
          if (timestamp && timestamp >= yesterday) {
            errorsLast24h++;
          }
          
          const errorType = logData.type || 'unknown';
          errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;
        }
      });
      
      // Calculate uptime (simplified - based on no critical errors)
      const criticalErrors = errorsByType['critical'] || 0;
      const uptime = criticalErrors === 0 ? 100 : Math.max(0, 100 - (criticalErrors * 10));
      
      // Authentication metrics
      const userActivitiesSnapshot = await getDocs(collection(db, 'userActivities'));
      const passwordResetsSnapshot = await getDocs(collection(db, 'passwordResets'));
      const temporaryCredentialsSnapshot = await getDocs(collection(db, 'temporaryCredentials'));
      
      let totalLogins = 0;
      let failedLogins = 0;
      
      userActivitiesSnapshot.forEach(doc => {
        const activity = doc.data();
        if (activity.type === 'login') {
          totalLogins++;
        } else if (activity.type === 'failed_login') {
          failedLogins++;
        }
      });
      
      const passwordResets = passwordResetsSnapshot.size;
      const activeTemporaryCredentials = temporaryCredentialsSnapshot.docs.filter(
        doc => {
          const expiry = doc.data().expiresAt?.toDate();
          return expiry && expiry > now;
        }
      ).length;
      
      // Storage metrics
      const materialsSnapshot = await getDocs(collection(db, 'materials'));
      
      let totalStorageBytes = 0;
      const storageByType: { [type: string]: number } = {};
      const files: { name: string; size: number; type: string }[] = [];
      
      materialsSnapshot.forEach(doc => {
        const material = doc.data();
        const size = material.size || 0;
        const type = material.type || 'unknown';
        
        totalStorageBytes += size;
        storageByType[type] = (storageByType[type] || 0) + size;
        
        files.push({
          name: material.name || 'Unknown',
          size: size,
          type: type
        });
      });
      
      const totalStorageGB = totalStorageBytes / (1024 * 1024 * 1024);
      const avgFileSize = materialsSnapshot.size > 0 ? totalStorageBytes / materialsSnapshot.size : 0;
      
      // Convert storage by type to GB
      Object.keys(storageByType).forEach(type => {
        storageByType[type] = storageByType[type] / (1024 * 1024 * 1024);
      });
      
      // Get largest files
      files.sort((a, b) => b.size - a.size);
      const largestFiles = files.slice(0, 10).map(file => ({
        ...file,
        size: file.size / (1024 * 1024) // Convert to MB for display
      }));
      
      // Performance metrics (mock data for demonstration)
      const avgResponseTime = 150; // milliseconds
      
      const slowestQueries = [
        { query: 'getUserKPIs', time: 450 },
        { query: 'getInstitutionRankings', time: 380 },
        { query: 'calculateDomainProgress', time: 320 },
        { query: 'getTeacherMetrics', time: 280 },
        { query: 'aggregateStudySessions', time: 250 }
      ];
      
      const apiCallsByService: { [service: string]: number } = {
        'kpiService': 15420,
        'notebookService': 12350,
        'conceptService': 10200,
        'userService': 8950,
        'examService': 6730,
        'rankingService': 5420,
        'gamePointsService': 4210
      };
      
      // Count batch operations
      const userActivityBatchSnapshot = await getDocs(collection(db, 'userActivityBatch'));
      const batchOperations = userActivityBatchSnapshot.size;

      return {
        system: {
          totalErrors,
          errorsLast24h,
          errorsByType,
          uptime
        },
        authentication: {
          totalLogins,
          failedLogins,
          passwordResets,
          activeTemporaryCredentials
        },
        storage: {
          totalStorageGB,
          storageByType,
          avgFileSize,
          largestFiles
        },
        performance: {
          avgResponseTime,
          slowestQueries,
          apiCallsByService,
          batchOperations
        }
      };
    } catch (error) {
      console.error('Error fetching technical monitoring:', error);
      throw error;
    }
  }

  async getAllAnalytics(): Promise<Partial<AnalyticsData>> {
    try {
      const [
        executive,
        userAnalytics,
        academicPerformance,
        teacherAnalytics,
        institutionOverview,
        contentAnalytics,
        technicalMonitoring
      ] = await Promise.all([
        this.getExecutiveDashboard(),
        this.getUserAnalytics(),
        this.getAcademicPerformance(),
        this.getTeacherAnalytics(),
        this.getInstitutionOverview(),
        this.getContentAnalytics(),
        this.getTechnicalMonitoring()
      ]);

      return {
        executive,
        userAnalytics,
        academicPerformance,
        teacherAnalytics,
        institutionOverview,
        contentAnalytics,
        technicalMonitoring
      };
    } catch (error) {
      console.error('Error fetching all analytics:', error);
      throw error;
    }
  }
}

export const analyticsService = AnalyticsService.getInstance();