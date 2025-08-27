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
      
      // Get KPIs for all enrolled students
      const rankings: MateriaRanking[] = [];
      
      for (const studentId of studentIds) {
        try {
          console.log(`📊 Getting data for student: ${studentId}`);
          
          // Get student's name
          let studentName = 'Usuario';
          try {
            const userDoc = await getDoc(doc(db, 'users', studentId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              studentName = userData.displayName || userData.nombre || userData.email || 'Usuario';
              console.log(`✅ Got student name: ${studentName}`);
            }
          } catch (userError) {
            console.log(`⚠️ Could not read user document for ${studentId}:`, userError);
          }
          
          // Get student's KPIs for this materia
          let score = 0;
          try {
            // KPIs are stored in users/{userId}/kpis/dashboard
            const kpisDoc = await getDoc(doc(db, 'users', studentId, 'kpis', 'dashboard'));
            if (kpisDoc.exists()) {
              const kpisData = kpisDoc.data();
              console.log(`📊 KPIs data for ${studentName}:`, {
                hasMaterias: !!kpisData.materias,
                materiaIds: kpisData.materias ? Object.keys(kpisData.materias) : [],
                targetMateriaId: materiaId,
                materiaData: kpisData.materias?.[materiaId]
              });
              
              // Check if this materia exists in their KPIs
              if (kpisData.materias && kpisData.materias[materiaId]) {
                score = Math.ceil(kpisData.materias[materiaId].scoreMateria || 0);
                console.log(`✅ Got student score from materia: ${score}`);
              } else if (kpisData.global?.scoreGlobal) {
                // Fallback to global score if materia score not found
                console.log(`⚠️ No score for materia ${materiaId}, using global score`);
                score = Math.ceil(kpisData.global.scoreGlobal || 0);
                console.log(`✅ Got student global score: ${score}`);
              }
            } else {
              console.log(`⚠️ No KPIs document found for ${studentId} at path: users/${studentId}/kpis/dashboard`);
            }
          } catch (kpiError) {
            console.log(`⚠️ Could not read KPIs for ${studentId}:`, kpiError);
          }
          
          rankings.push({
            posicion: 0, // Will be set after sorting
            nombre: studentId === currentUserId ? 'Tú' : studentName,
            score: score,
            isCurrentUser: studentId === currentUserId
          });
          
        } catch (error) {
          console.warn(`Could not get data for student ${studentId}:`, error);
        }
      }
      
      // Sort by score (descending)
      rankings.sort((a, b) => b.score - a.score);
      
      // Assign positions
      rankings.forEach((ranking, index) => {
        ranking.posicion = index + 1;
      });
      
      console.log(`📊 Ranking calculated with ${rankings.length} students`);
      
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