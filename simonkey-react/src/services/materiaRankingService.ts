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
   * Get ranking for a specific materia based on enrollments
   */
  static async getMateriaRanking(
    materiaId: string, 
    currentUserId: string, 
    teacherId?: string
  ): Promise<MateriaRanking[]> {
    try {
      console.log('📊 Getting materia ranking for:', { materiaId, currentUserId, teacherId });
      
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
      console.log('📊 Querying enrollments with:', { materiaId, effectiveTeacherId });
      
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
          
          // Parallel queries for user data and KPIs
          const [userDoc, kpisDoc] = await Promise.all([
            getDoc(doc(db, 'users', studentId)).catch(() => null),
            getDoc(doc(db, 'users', studentId, 'kpis', 'dashboard')).catch(() => null)
          ]);
          
          // Get student's name
          let studentName = 'Usuario';
          if (userDoc?.exists()) {
            const userData = userDoc.data();
            studentName = userData.displayName || userData.nombre || userData.email || 'Usuario';
          }
          
          // Get student's KPIs for this materia
          let score = 0;
          if (kpisDoc?.exists()) {
            const kpisData = kpisDoc.data();
            
            // Check if this materia exists in their KPIs
            if (kpisData.materias && kpisData.materias[materiaId]) {
              score = Math.ceil(kpisData.materias[materiaId].scoreMateria || 0);
              console.log(`✅ Got student score from materia: ${score}`);
            } else if (kpisData.global?.scoreGlobal) {
              // Fallback to global score if materia score not found
              score = Math.ceil(kpisData.global.scoreGlobal || 0);
              console.log(`✅ Got student global score: ${score}`);
            }
          }
          
          return {
            posicion: 0, // Will be set after sorting
            nombre: studentId === currentUserId ? 'Tú' : studentName,
            score: score,
            isCurrentUser: studentId === currentUserId
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
    teacherId?: string
  ): Promise<MateriaRanking[]> {
    const fullRanking = await this.getMateriaRanking(materiaId, currentUserId, teacherId);
    
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