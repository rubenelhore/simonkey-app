import { 
  collection, 
  getDocs, 
  query, 
  where,
  orderBy,
  limit,
  doc,
  getDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { PointsCalculationService } from './pointsCalculationService';

export interface MateriaRanking {
  posicion: number;
  nombre: string;
  score: number;
  isCurrentUser?: boolean;
}

// Cache for ranking results (5 minutes TTL)
const rankingCache = new Map<string, { data: MateriaRanking[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export class MateriaRankingService {
  /**
   * Clear ranking cache
   */
  static clearCache(): void {
    rankingCache.clear();
    console.log('📊 Ranking cache cleared');
  }

  /**
   * Get ranking for a specific materia based on enrollments
   */
  static async getMateriaRanking(
    materiaId: string, 
    currentUserId: string, 
    teacherId?: string,
    isTeacherView?: boolean
  ): Promise<MateriaRanking[]> {
    try {
      console.log('📊 [MateriaRankingService] Getting materia ranking for:', { materiaId, currentUserId, teacherId });
      
      // Check cache first
      const cacheKey = `${materiaId}-${teacherId || 'auto'}`;
      const cached = rankingCache.get(cacheKey);
      const now = Date.now();
      
      if (cached && (now - cached.timestamp) < CACHE_TTL) {
        console.log('📊 Using cached ranking data');
        // Update isCurrentUser flag for the current user
        const cachedRankings = cached.data.map(ranking => ({
          ...ranking,
          isCurrentUser: ranking.nombre === 'Tú' || ranking.isCurrentUser,
          nombre: ranking.isCurrentUser ? 'Tú' : ranking.nombre
        }));
        return cachedRankings;
      }
      
      // If no teacherId provided, try to get it from the materia
      let effectiveTeacherId = teacherId;
      if (!effectiveTeacherId) {
        console.log('📊 No teacherId provided, trying to get from materia document...');
        try {
          const materiaDoc = await getDoc(doc(db, 'materias', materiaId));
          if (materiaDoc.exists()) {
            effectiveTeacherId = materiaDoc.data().userId; // The creator is the teacher
            console.log('✅ Got teacherId from materia:', effectiveTeacherId);
          }
        } catch (error) {
          console.log('⚠️ Could not read materia document:', error);
        }
      }
      
      if (!effectiveTeacherId) {
        console.log('❌ No teacher ID found for materia');
        return [];
      }
      
      // Get all active enrollments for this materia
      console.log('📊 Querying enrollments with:', { 
        materiaId, 
        effectiveTeacherId,
        currentUserId,
        isTeacherView 
      });
      
      // Clean implementation without debugging
      
      // Get all active enrollments for this materia
      const enrollmentsQuery = query(
        collection(db, 'enrollments'),
        where('materiaId', '==', materiaId),
        where('teacherId', '==', effectiveTeacherId),
        where('status', '==', 'active')
      );
      
      let enrollmentsSnapshot;
      try {
        enrollmentsSnapshot = await getDocs(enrollmentsQuery);
        console.log(`📊 Found ${enrollmentsSnapshot.size} enrollments`);
      } catch (error) {
        console.log('❌ Error querying enrollments:', error);
        throw error;
      }
      
      const studentIds: string[] = [];
      enrollmentsSnapshot.forEach(doc => {
        const enrollment = doc.data();
        studentIds.push(enrollment.studentId);
      });
      
      // Always include current user if not already in the list
      if (!studentIds.includes(currentUserId)) {
        console.log(`📝 Adding current user ${currentUserId} to ranking (not in enrollments)`);
        studentIds.push(currentUserId);
      }
      
      if (studentIds.length === 0) {
        console.log('⚠️ No students enrolled in this materia');
        return [];
      }
      
      // Get KPIs for all enrolled students - OPTIMIZED with parallel queries
      const rankings: MateriaRanking[] = [];
      
      // Create parallel promises for all student data
      const studentPromises = studentIds.map(async (studentId) => {
        try {
          console.log(`📊 Getting data for student: ${studentId}`);
          
          // Get user data and calculate dynamic score
          const userDoc = await getDoc(doc(db, 'users', studentId)).catch(() => null);
          
          // Get student's name
          let studentName = 'Usuario';
          if (userDoc?.exists()) {
            const userData = userDoc.data();
            studentName = userData.displayName || userData.nombre || userData.email || 'Usuario';
          }
          
          // Calculate dynamic score using the same method as ClassAnalyticsPage
          console.log(`🔍 Calculating dynamic score for student ${studentId} (${studentName}) in materia ${materiaId}`);
          const score = await PointsCalculationService.calculateMateriaScore(materiaId, studentId);
          console.log(`✅ Calculated dynamic score for ${studentName}: ${score}`);
          
          const isCurrentUserFlag = studentId === currentUserId;
          console.log(`📌 Comparing IDs: studentId="${studentId}" vs currentUserId="${currentUserId}" => isCurrentUser=${isCurrentUserFlag}`);
          
          return {
            posicion: 0, // Will be set after sorting
            nombre: (isCurrentUserFlag && !isTeacherView) ? 'Tú' : studentName,
            score: score,
            isCurrentUser: isCurrentUserFlag
          };
          
        } catch (error) {
          console.warn(`Could not get data for student ${studentId}:`, error);
          // Return a default entry even if there's an error
          return {
            posicion: 0,
            nombre: studentId === currentUserId ? 'Tú' : 'Usuario',
            score: 0,
            isCurrentUser: studentId === currentUserId
          };
        }
      });
      
      // Wait for all student data to be fetched
      const studentRankings = await Promise.all(studentPromises);
      rankings.push(...studentRankings);
      
      // Sort by score (descending)
      rankings.sort((a, b) => b.score - a.score);
      
      // Assign positions
      rankings.forEach((ranking, index) => {
        ranking.posicion = index + 1;
      });
      
      console.log(`📊 Ranking calculated with ${rankings.length} students`);
      
      // Cache the results
      rankingCache.set(cacheKey, { data: rankings, timestamp: now });
      
      // Return all students
      return rankings;
      
    } catch (error) {
      console.error('❌ Error getting materia ranking:', error);
      return [];
    }
  }
  
  /**
   * Get simplified ranking for display (just top 5)
   */
  static async getTop5Ranking(
    materiaId: string,
    currentUserId: string,
    teacherId?: string,
    isTeacherView?: boolean
  ): Promise<MateriaRanking[]> {
    const fullRanking = await this.getMateriaRanking(materiaId, currentUserId, teacherId, isTeacherView);
    
    // If current user is not in top 5, add them at the end
    const top5 = fullRanking.slice(0, 5);
    const currentUserInTop5 = top5.some(r => r.isCurrentUser);
    
    if (!currentUserInTop5) {
      const currentUserRanking = fullRanking.find(r => r.isCurrentUser);
      if (currentUserRanking) {
        // Remove the 5th position and add current user
        if (top5.length === 5) {
          top5[4] = currentUserRanking;
        } else {
          top5.push(currentUserRanking);
        }
      }
    }
    
    return top5;
  }
}