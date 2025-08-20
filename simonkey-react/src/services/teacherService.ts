import { 
  collection, 
  doc, 
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query, 
  where,
  orderBy,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { TeacherProfile, UserProfile, InviteCode } from '../types/interfaces';

/**
 * Servicio para gestionar profesores independientes
 */
export class TeacherService {
  private readonly TEACHER_PROFILES_COLLECTION = 'teacherProfiles';
  private readonly USERS_COLLECTION = 'users';
  private readonly INVITE_CODES_COLLECTION = 'inviteCodes';

  /**
   * Solicitar convertirse en profesor
   */
  async requestTeacherStatus(
    userId: string,
    additionalInfo?: {
      bio?: string;
      specialties?: string[];
      institution?: string;
    }
  ): Promise<void> {
    try {
      // Verificar si ya existe una solicitud
      const existingProfile = await this.getTeacherProfile(userId);
      if (existingProfile) {
        if (existingProfile.isActive) {
          throw new Error('Ya eres un profesor activo');
        }
        throw new Error('Ya tienes una solicitud pendiente');
      }

      // Crear perfil de profesor inactivo (pendiente de aprobación)
      const teacherProfile: TeacherProfile = {
        userId,
        isActive: false,
        bio: additionalInfo?.bio,
        specialties: additionalInfo?.specialties,
        institution: additionalInfo?.institution,
        maxStudents: 30, // Límite inicial para plan gratuito
        currentStudents: 0,
        maxMaterias: 5, // Límite inicial para plan gratuito
        currentMaterias: 0,
        settings: {
          allowPublicEnrollment: false,
          requireApproval: false,
          sendNotifications: true,
          showInDirectory: false
        },
        stats: {
          totalStudentsAllTime: 0,
          totalMateriasCreated: 0,
          totalExamsCreated: 0,
          lastActiveAt: Timestamp.now()
        }
      };

      await setDoc(
        doc(db, this.TEACHER_PROFILES_COLLECTION, userId),
        teacherProfile
      );

      // Actualizar UserProfile con la fecha de solicitud
      await updateDoc(doc(db, this.USERS_COLLECTION, userId), {
        teacherRequestedAt: serverTimestamp()
      });

      console.log(`✅ Solicitud de profesor creada para usuario ${userId}`);
    } catch (error) {
      console.error('Error solicitando estado de profesor:', error);
      throw error;
    }
  }

  /**
   * Aprobar solicitud de profesor (solo SuperAdmin)
   */
  async approveTeacherRequest(
    teacherId: string,
    approvedBy: string,
    customLimits?: {
      maxStudents?: number;
      maxMaterias?: number;
    }
  ): Promise<void> {
    try {
      const profile = await this.getTeacherProfile(teacherId);
      if (!profile) {
        throw new Error('No se encontró la solicitud de profesor');
      }

      if (profile.isActive) {
        throw new Error('El profesor ya está activo');
      }

      // Actualizar perfil de profesor
      await updateDoc(
        doc(db, this.TEACHER_PROFILES_COLLECTION, teacherId),
        {
          isActive: true,
          approvedAt: serverTimestamp(),
          approvedBy,
          verifiedTeacher: true,
          maxStudents: customLimits?.maxStudents || 30,
          maxMaterias: customLimits?.maxMaterias || 5
        }
      );

      // Actualizar UserProfile
      await updateDoc(doc(db, this.USERS_COLLECTION, teacherId), {
        isTeacher: true,
        teacherApprovedAt: serverTimestamp()
      });

      console.log(`✅ Profesor ${teacherId} aprobado por ${approvedBy}`);
    } catch (error) {
      console.error('Error aprobando profesor:', error);
      throw error;
    }
  }

  /**
   * Rechazar solicitud de profesor
   */
  async rejectTeacherRequest(teacherId: string, reason?: string): Promise<void> {
    try {
      const profile = await this.getTeacherProfile(teacherId);
      if (!profile) {
        throw new Error('No se encontró la solicitud de profesor');
      }

      // Eliminar perfil de profesor
      await updateDoc(
        doc(db, this.TEACHER_PROFILES_COLLECTION, teacherId),
        {
          isActive: false,
          rejectedAt: serverTimestamp(),
          rejectionReason: reason
        }
      );

      console.log(`❌ Solicitud de profesor ${teacherId} rechazada`);
    } catch (error) {
      console.error('Error rechazando solicitud:', error);
      throw error;
    }
  }

  /**
   * Obtener perfil de profesor
   */
  async getTeacherProfile(userId: string): Promise<TeacherProfile | null> {
    try {
      const docRef = doc(db, this.TEACHER_PROFILES_COLLECTION, userId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return docSnap.data() as TeacherProfile;
      }
      return null;
    } catch (error) {
      console.error('Error obteniendo perfil de profesor:', error);
      throw error;
    }
  }

  /**
   * Obtener solicitudes pendientes de profesor
   */
  async getPendingTeacherRequests(): Promise<Array<TeacherProfile & { id: string }>> {
    try {
      const q = query(
        collection(db, this.TEACHER_PROFILES_COLLECTION),
        where('isActive', '==', false)
      );

      const snapshot = await getDocs(q);
      const requests: Array<TeacherProfile & { id: string }> = [];

      for (const docSnapshot of snapshot.docs) {
        const profile = docSnapshot.data() as TeacherProfile;
        
        // Filtrar las rechazadas manualmente
        if ((profile as any).rejectedAt) {
          continue;
        }
        
        // Obtener información adicional del usuario
        const userDoc = await getDoc(
          doc(db, this.USERS_COLLECTION, profile.userId)
        );
        
        if (userDoc.exists()) {
          const userData = userDoc.data() as UserProfile;
          requests.push({
            id: docSnapshot.id,
            ...profile,
            // Agregar info del usuario que puede ser útil
            bio: profile.bio || `${userData.displayName || userData.nombre} - ${userData.email}`
          });
        }
      }

      return requests;
    } catch (error) {
      console.error('Error obteniendo solicitudes pendientes:', error);
      throw error;
    }
  }

  /**
   * Obtener todos los profesores activos
   */
  async getActiveTeachers(): Promise<Array<TeacherProfile & { id: string }>> {
    try {
      const q = query(
        collection(db, this.TEACHER_PROFILES_COLLECTION),
        where('isActive', '==', true)
      );

      const snapshot = await getDocs(q);
      const teachers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data() as TeacherProfile
      }));
      
      // Ordenar por fecha de aprobación (más recientes primero)
      teachers.sort((a, b) => {
        const aDate = a.approvedAt?.seconds || 0;
        const bDate = b.approvedAt?.seconds || 0;
        return bDate - aDate;
      });
      
      return teachers;
    } catch (error) {
      console.error('Error obteniendo profesores activos:', error);
      throw error;
    }
  }

  /**
   * Verificar si un usuario es profesor activo
   */
  async isActiveTeacher(userId: string): Promise<boolean> {
    try {
      const profile = await this.getTeacherProfile(userId);
      return profile?.isActive === true;
    } catch (error) {
      console.error('Error verificando estado de profesor:', error);
      return false;
    }
  }

  /**
   * Actualizar configuración del profesor
   */
  async updateTeacherSettings(
    userId: string,
    settings: Partial<TeacherProfile['settings']>
  ): Promise<void> {
    try {
      const profile = await this.getTeacherProfile(userId);
      if (!profile) {
        throw new Error('Perfil de profesor no encontrado');
      }

      if (!profile.isActive) {
        throw new Error('El profesor no está activo');
      }

      await updateDoc(
        doc(db, this.TEACHER_PROFILES_COLLECTION, userId),
        {
          settings: {
            ...profile.settings,
            ...settings
          }
        }
      );

      console.log(`✅ Configuración actualizada para profesor ${userId}`);
    } catch (error) {
      console.error('Error actualizando configuración:', error);
      throw error;
    }
  }

  /**
   * Actualizar estadísticas del profesor
   */
  async updateTeacherStats(
    userId: string,
    stats: Partial<TeacherProfile['stats']>
  ): Promise<void> {
    try {
      await updateDoc(
        doc(db, this.TEACHER_PROFILES_COLLECTION, userId),
        {
          'stats.lastActiveAt': serverTimestamp(),
          ...(stats ? Object.entries(stats).reduce((acc, [key, value]) => ({
            ...acc,
            [`stats.${key}`]: value
          }), {}) : {})
        }
      );
    } catch (error) {
      console.error('Error actualizando estadísticas:', error);
      // No lanzar error para no interrumpir el flujo
    }
  }

  /**
   * Generar código de invitación único
   */
  private generateInviteCode(prefix?: string): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = prefix ? `${prefix}-` : '';
    
    for (let i = 0; i < 8; i++) {
      if (i === 4) code += '-';
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return code;
  }

  /**
   * Crear código de invitación para una materia
   */
  async createInviteCode(
    teacherId: string,
    materiaId: string,
    materiaName: string,
    options?: {
      expiresInDays?: number;
      maxUses?: number;
      description?: string;
      welcomeMessage?: string;
    }
  ): Promise<string> {
    try {
      // Verificar que es profesor activo
      if (!(await this.isActiveTeacher(teacherId))) {
        throw new Error('Solo profesores activos pueden crear códigos de invitación');
      }

      const code = this.generateInviteCode();
      
      const inviteData: InviteCode = {
        id: '',
        code,
        teacherId,
        materiaId,
        materiaName,
        createdAt: Timestamp.now(),
        currentUses: 0,
        isActive: true,
        metadata: {
          description: options?.description,
          welcomeMessage: options?.welcomeMessage
        }
      };

      if (options?.expiresInDays) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + options.expiresInDays);
        inviteData.expiresAt = Timestamp.fromDate(expiresAt);
      }

      if (options?.maxUses) {
        inviteData.maxUses = options.maxUses;
      }

      const docRef = doc(collection(db, this.INVITE_CODES_COLLECTION));
      inviteData.id = docRef.id;
      
      await setDoc(docRef, inviteData);

      console.log(`✅ Código de invitación creado: ${code}`);
      return code;
    } catch (error) {
      console.error('Error creando código de invitación:', error);
      throw error;
    }
  }

  /**
   * Obtener códigos de invitación de un profesor
   */
  async getTeacherInviteCodes(teacherId: string): Promise<InviteCode[]> {
    try {
      const q = query(
        collection(db, this.INVITE_CODES_COLLECTION),
        where('teacherId', '==', teacherId),
        where('isActive', '==', true)
      );

      const snapshot = await getDocs(q);
      const codes = snapshot.docs.map(doc => ({
        ...doc.data() as InviteCode,
        id: doc.id
      }));
      
      // Ordenar por fecha de creación (más recientes primero)
      codes.sort((a, b) => {
        const aDate = a.createdAt?.seconds || 0;
        const bDate = b.createdAt?.seconds || 0;
        return bDate - aDate;
      });
      
      return codes;
    } catch (error) {
      console.error('Error obteniendo códigos de invitación:', error);
      throw error;
    }
  }

  /**
   * Desactivar código de invitación
   */
  async deactivateInviteCode(codeId: string, teacherId: string): Promise<void> {
    try {
      const codeDoc = await getDoc(doc(db, this.INVITE_CODES_COLLECTION, codeId));
      
      if (!codeDoc.exists()) {
        throw new Error('Código no encontrado');
      }

      const codeData = codeDoc.data() as InviteCode;
      
      if (codeData.teacherId !== teacherId) {
        throw new Error('No tienes permiso para desactivar este código');
      }

      await updateDoc(
        doc(db, this.INVITE_CODES_COLLECTION, codeId),
        { isActive: false }
      );

      console.log(`✅ Código ${codeData.code} desactivado`);
    } catch (error) {
      console.error('Error desactivando código:', error);
      throw error;
    }
  }

  /**
   * Actualizar límites del profesor (para planes pagos)
   */
  async updateTeacherLimits(
    userId: string,
    limits: {
      maxStudents?: number;
      maxMaterias?: number;
    }
  ): Promise<void> {
    try {
      await updateDoc(
        doc(db, this.TEACHER_PROFILES_COLLECTION, userId),
        limits
      );

      console.log(`✅ Límites actualizados para profesor ${userId}`);
    } catch (error) {
      console.error('Error actualizando límites:', error);
      throw error;
    }
  }
}

// Exportar instancia singleton
export const teacherService = new TeacherService();