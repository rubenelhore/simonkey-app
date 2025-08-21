import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  Timestamp,
  serverTimestamp,
  limit
} from 'firebase/firestore';
import { db } from './firebase';
import { Enrollment, EnrollmentStatus, InviteCode, TeacherProfile } from '../types/interfaces';

/**
 * Servicio para gestionar inscripciones de estudiantes en materias
 */
export class EnrollmentService {
  private readonly COLLECTION_NAME = 'enrollments';
  private readonly TEACHER_PROFILES_COLLECTION = 'teacherProfiles';
  private readonly INVITE_CODES_COLLECTION = 'inviteCodes';

  /**
   * Crear una nueva inscripción
   */
  async createEnrollment(
    studentId: string,
    teacherId: string,
    materiaId: string,
    additionalData?: Partial<Enrollment>
  ): Promise<string> {
    try {
      const enrollmentData: Omit<Enrollment, 'id'> = {
        studentId,
        teacherId,
        materiaId,
        enrolledAt: Timestamp.now(),
        status: EnrollmentStatus.ACTIVE,
        ...additionalData
      };

      const docRef = await addDoc(
        collection(db, this.COLLECTION_NAME),
        enrollmentData
      );

      // Marcar al usuario como inscrito permanentemente
      await this.markUserAsEnrolled(studentId);

      console.log(`✅ Inscripción creada: ${docRef.id}`);
      return docRef.id;
    } catch (error) {
      console.error('Error creando inscripción:', error);
      throw error;
    }
  }

  /**
   * Inscribir estudiante usando código de invitación
   */
  async enrollWithInviteCode(
    studentId: string,
    inviteCode: string,
    studentInfo?: { email?: string; name?: string }
  ): Promise<string> {
    try {
      // 1. Buscar el código de invitación
      const codeQuery = query(
        collection(db, this.INVITE_CODES_COLLECTION),
        where('code', '==', inviteCode),
        where('isActive', '==', true)
      );
      const codeSnapshot = await getDocs(codeQuery);

      if (codeSnapshot.empty) {
        throw new Error('Código de invitación inválido o expirado');
      }

      const codeDoc = codeSnapshot.docs[0];
      const codeData = codeDoc.data() as InviteCode;

      // 2. Verificar si el código no ha expirado
      if (codeData.expiresAt && codeData.expiresAt.toDate() < new Date()) {
        throw new Error('El código de invitación ha expirado');
      }

      // 3. Verificar límite de usos
      if (codeData.maxUses && codeData.currentUses >= codeData.maxUses) {
        throw new Error('El código de invitación ha alcanzado el límite de usos');
      }

      // 4. Verificar si el estudiante ya está inscrito
      const existingEnrollment = await this.getEnrollment(studentId, codeData.teacherId, codeData.materiaId);
      if (existingEnrollment) {
        throw new Error('Ya estás inscrito en esta materia');
      }

      // 5. Crear la inscripción (incluye marcar como inscrito)
      const enrollmentId = await this.createEnrollment(
        studentId,
        codeData.teacherId,
        codeData.materiaId,
        {
          studentEmail: studentInfo?.email,
          studentName: studentInfo?.name,
          materiaName: codeData.materiaName,
          inviteCode: inviteCode,
          metadata: {
            source: 'invite_link'
          }
        }
      );

      // 6. Actualizar el contador de usos del código
      await updateDoc(doc(db, this.INVITE_CODES_COLLECTION, codeDoc.id), {
        currentUses: codeData.currentUses + 1
      });

      console.log(`✅ Estudiante ${studentId} inscrito con código ${inviteCode}`);
      return enrollmentId;

    } catch (error) {
      console.error('Error inscribiendo con código:', error);
      throw error;
    }
  }

  /**
   * Obtener una inscripción específica
   */
  async getEnrollment(
    studentId: string,
    teacherId: string,
    materiaId: string
  ): Promise<Enrollment | null> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('studentId', '==', studentId),
        where('teacherId', '==', teacherId),
        where('materiaId', '==', materiaId)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data()
      } as Enrollment;

    } catch (error) {
      console.error('Error obteniendo inscripción:', error);
      throw error;
    }
  }

  /**
   * Verificar si un estudiante está inscrito en una materia específica
   */
  async isStudentEnrolled(
    studentId: string,
    materiaId: string
  ): Promise<boolean> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('studentId', '==', studentId),
        where('materiaId', '==', materiaId),
        where('status', '==', EnrollmentStatus.ACTIVE)
      );
      
      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch (error) {
      console.error('Error verificando inscripción:', error);
      return false;
    }
  }

  /**
   * Marcar al usuario como inscrito permanentemente
   */
  async markUserAsEnrolled(studentId: string): Promise<void> {
    try {
      const userRef = doc(db, 'users', studentId);
      await updateDoc(userRef, {
        isEnrolled: true,
        updatedAt: serverTimestamp()
      });
      
      console.log(`✅ Usuario ${studentId} marcado como inscrito permanentemente`);
    } catch (error) {
      console.error('Error marcando usuario como inscrito:', error);
      // No lanzar error para no interrumpir la inscripción
    }
  }

  /**
   * Obtener todas las inscripciones de un estudiante
   */
  async getStudentEnrollments(studentId: string): Promise<Enrollment[]> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('studentId', '==', studentId),
        where('status', '==', EnrollmentStatus.ACTIVE)
      );

      const snapshot = await getDocs(q);
      const enrollments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Enrollment));
      
      // Ordenar por fecha de inscripción (más recientes primero)
      enrollments.sort((a, b) => {
        const aDate = a.enrolledAt?.seconds || 0;
        const bDate = b.enrolledAt?.seconds || 0;
        return bDate - aDate;
      });
      
      return enrollments;

    } catch (error) {
      console.error('Error obteniendo inscripciones del estudiante:', error);
      throw error;
    }
  }

  /**
   * Obtener todos los estudiantes inscritos en una materia
   */
  async getMateriaEnrollments(teacherId: string, materiaId: string): Promise<Enrollment[]> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('teacherId', '==', teacherId),
        where('materiaId', '==', materiaId),
        where('status', '==', EnrollmentStatus.ACTIVE)
      );

      const snapshot = await getDocs(q);
      const enrollments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Enrollment));
      
      // Ordenar por fecha de inscripción (más recientes primero)
      enrollments.sort((a, b) => {
        const aDate = a.enrolledAt?.seconds || 0;
        const bDate = b.enrolledAt?.seconds || 0;
        return bDate - aDate;
      });
      
      return enrollments;

    } catch (error) {
      console.error('Error obteniendo estudiantes de la materia:', error);
      throw error;
    }
  }

  /**
   * Obtener todos los estudiantes de un profesor
   */
  async getTeacherStudents(teacherId: string): Promise<Enrollment[]> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('teacherId', '==', teacherId),
        where('status', '==', EnrollmentStatus.ACTIVE)
      );

      const snapshot = await getDocs(q);
      
      // Eliminar duplicados por studentId
      const uniqueStudents = new Map<string, Enrollment>();
      snapshot.docs.forEach(doc => {
        const enrollment = { id: doc.id, ...doc.data() } as Enrollment;
        if (!uniqueStudents.has(enrollment.studentId)) {
          uniqueStudents.set(enrollment.studentId, enrollment);
        }
      });

      const students = Array.from(uniqueStudents.values());
      
      // Ordenar por fecha de inscripción (más recientes primero)
      students.sort((a, b) => {
        const aDate = a.enrolledAt?.seconds || 0;
        const bDate = b.enrolledAt?.seconds || 0;
        return bDate - aDate;
      });
      
      return students;

    } catch (error) {
      console.error('Error obteniendo estudiantes del profesor:', error);
      throw error;
    }
  }

  /**
   * Actualizar el estado de una inscripción
   */
  async updateEnrollmentStatus(
    enrollmentId: string,
    status: EnrollmentStatus
  ): Promise<void> {
    try {
      const updates: Partial<Enrollment> = {
        status
      };

      if (status === EnrollmentStatus.COMPLETED) {
        updates.completedAt = Timestamp.now();
      }

      await updateDoc(
        doc(db, this.COLLECTION_NAME, enrollmentId),
        updates
      );

      console.log(`✅ Estado de inscripción ${enrollmentId} actualizado a ${status}`);
    } catch (error) {
      console.error('Error actualizando estado de inscripción:', error);
      throw error;
    }
  }

  /**
   * Actualizar último acceso del estudiante
   */
  async updateLastAccess(enrollmentId: string): Promise<void> {
    try {
      await updateDoc(
        doc(db, this.COLLECTION_NAME, enrollmentId),
        {
          lastAccessedAt: serverTimestamp()
        }
      );
    } catch (error) {
      console.error('Error actualizando último acceso:', error);
      // No lanzar error para no interrumpir el flujo
    }
  }

  /**
   * Eliminar una inscripción (soft delete - cambia estado a INACTIVE)
   */
  async removeEnrollment(enrollmentId: string): Promise<void> {
    try {
      await this.updateEnrollmentStatus(enrollmentId, EnrollmentStatus.INACTIVE);
      console.log(`✅ Inscripción ${enrollmentId} marcada como inactiva`);
    } catch (error) {
      console.error('Error eliminando inscripción:', error);
      throw error;
    }
  }

  /**
   * Eliminar permanentemente una inscripción (hard delete)
   */
  async deleteEnrollment(enrollmentId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, this.COLLECTION_NAME, enrollmentId));
      console.log(`✅ Inscripción ${enrollmentId} eliminada permanentemente`);
    } catch (error) {
      console.error('Error eliminando inscripción permanentemente:', error);
      throw error;
    }
  }

  /**
   * Verificar si un usuario es profesor activo
   */
  async isActiveTeacher(userId: string): Promise<boolean> {
    try {
      const teacherDoc = await getDoc(
        doc(db, this.TEACHER_PROFILES_COLLECTION, userId)
      );

      if (!teacherDoc.exists()) {
        return false;
      }

      const profile = teacherDoc.data() as TeacherProfile;
      return profile.isActive === true;

    } catch (error) {
      console.error('Error verificando si es profesor activo:', error);
      return false;
    }
  }

  /**
   * Obtener estadísticas de inscripciones para un profesor
   */
  async getTeacherEnrollmentStats(teacherId: string): Promise<{
    totalStudents: number;
    activeStudents: number;
    completedCourses: number;
    studentsByMateria: Map<string, number>;
  }> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('teacherId', '==', teacherId)
      );

      const snapshot = await getDocs(q);
      
      const stats = {
        totalStudents: 0,
        activeStudents: 0,
        completedCourses: 0,
        studentsByMateria: new Map<string, number>()
      };

      const uniqueStudents = new Set<string>();
      const activeStudents = new Set<string>();

      snapshot.docs.forEach(doc => {
        const enrollment = doc.data() as Enrollment;
        
        uniqueStudents.add(enrollment.studentId);
        
        if (enrollment.status === EnrollmentStatus.ACTIVE) {
          activeStudents.add(enrollment.studentId);
          
          const count = stats.studentsByMateria.get(enrollment.materiaId) || 0;
          stats.studentsByMateria.set(enrollment.materiaId, count + 1);
        } else if (enrollment.status === EnrollmentStatus.COMPLETED) {
          stats.completedCourses++;
        }
      });

      stats.totalStudents = uniqueStudents.size;
      stats.activeStudents = activeStudents.size;

      return stats;

    } catch (error) {
      console.error('Error obteniendo estadísticas de inscripciones:', error);
      throw error;
    }
  }
}

// Exportar instancia singleton
export const enrollmentService = new EnrollmentService();