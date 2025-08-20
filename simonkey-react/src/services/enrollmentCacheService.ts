import { collection, query, where, getDocs, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';

interface EnrollmentCache {
  studentEnrollments: Map<string, any[]>; // studentId -> enrollments[]
  teacherEnrollments: Map<string, any[]>; // teacherId -> enrollments[]
  lastUpdate: Map<string, number>; // userId -> timestamp
  listeners: Map<string, Unsubscribe>; // userId -> unsubscribe function
}

class EnrollmentCacheService {
  private static instance: EnrollmentCacheService;
  private cache: EnrollmentCache = {
    studentEnrollments: new Map(),
    teacherEnrollments: new Map(),
    lastUpdate: new Map(),
    listeners: new Map()
  };
  
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
  
  private constructor() {}
  
  static getInstance(): EnrollmentCacheService {
    if (!EnrollmentCacheService.instance) {
      EnrollmentCacheService.instance = new EnrollmentCacheService();
    }
    return EnrollmentCacheService.instance;
  }
  
  /**
   * Obtiene los enrollments de un estudiante con caché
   */
  async getStudentEnrollments(studentId: string, forceRefresh = false): Promise<any[]> {
    // Verificar si el caché es válido
    const lastUpdate = this.cache.lastUpdate.get(`student_${studentId}`);
    const cacheValid = lastUpdate && (Date.now() - lastUpdate) < this.CACHE_DURATION;
    
    if (!forceRefresh && cacheValid && this.cache.studentEnrollments.has(studentId)) {
      console.log(`[EnrollmentCache] Usando caché para estudiante ${studentId}`);
      return this.cache.studentEnrollments.get(studentId) || [];
    }
    
    // Buscar en Firestore
    console.log(`[EnrollmentCache] Cargando enrollments desde Firestore para estudiante ${studentId}`);
    const enrollmentsQuery = query(
      collection(db, 'enrollments'),
      where('studentId', '==', studentId),
      where('status', '==', 'active')
    );
    
    const snapshot = await getDocs(enrollmentsQuery);
    const enrollments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Actualizar caché
    this.cache.studentEnrollments.set(studentId, enrollments);
    this.cache.lastUpdate.set(`student_${studentId}`, Date.now());
    
    // Configurar listener si no existe
    this.setupStudentListener(studentId);
    
    return enrollments;
  }
  
  /**
   * Obtiene los enrollments de un profesor con caché
   */
  async getTeacherEnrollments(teacherId: string, forceRefresh = false): Promise<any[]> {
    // Verificar si el caché es válido
    const lastUpdate = this.cache.lastUpdate.get(`teacher_${teacherId}`);
    const cacheValid = lastUpdate && (Date.now() - lastUpdate) < this.CACHE_DURATION;
    
    if (!forceRefresh && cacheValid && this.cache.teacherEnrollments.has(teacherId)) {
      console.log(`[EnrollmentCache] Usando caché para profesor ${teacherId}`);
      return this.cache.teacherEnrollments.get(teacherId) || [];
    }
    
    // Buscar en Firestore
    console.log(`[EnrollmentCache] Cargando enrollments desde Firestore para profesor ${teacherId}`);
    const enrollmentsQuery = query(
      collection(db, 'enrollments'),
      where('teacherId', '==', teacherId),
      where('status', '==', 'active')
    );
    
    const snapshot = await getDocs(enrollmentsQuery);
    const enrollments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Actualizar caché
    this.cache.teacherEnrollments.set(teacherId, enrollments);
    this.cache.lastUpdate.set(`teacher_${teacherId}`, Date.now());
    
    // Configurar listener si no existe
    this.setupTeacherListener(teacherId);
    
    return enrollments;
  }
  
  /**
   * Configura un listener para actualizar el caché cuando cambien los enrollments del estudiante
   */
  private setupStudentListener(studentId: string): void {
    const listenerKey = `student_${studentId}`;
    
    // Si ya existe un listener, no crear otro
    if (this.cache.listeners.has(listenerKey)) {
      return;
    }
    
    const enrollmentsQuery = query(
      collection(db, 'enrollments'),
      where('studentId', '==', studentId),
      where('status', '==', 'active')
    );
    
    const unsubscribe = onSnapshot(enrollmentsQuery, (snapshot) => {
      console.log(`[EnrollmentCache] Actualizando caché para estudiante ${studentId}`);
      const enrollments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      this.cache.studentEnrollments.set(studentId, enrollments);
      this.cache.lastUpdate.set(listenerKey, Date.now());
    });
    
    this.cache.listeners.set(listenerKey, unsubscribe);
  }
  
  /**
   * Configura un listener para actualizar el caché cuando cambien los enrollments del profesor
   */
  private setupTeacherListener(teacherId: string): void {
    const listenerKey = `teacher_${teacherId}`;
    
    // Si ya existe un listener, no crear otro
    if (this.cache.listeners.has(listenerKey)) {
      return;
    }
    
    const enrollmentsQuery = query(
      collection(db, 'enrollments'),
      where('teacherId', '==', teacherId),
      where('status', '==', 'active')
    );
    
    const unsubscribe = onSnapshot(enrollmentsQuery, (snapshot) => {
      console.log(`[EnrollmentCache] Actualizando caché para profesor ${teacherId}`);
      const enrollments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      this.cache.teacherEnrollments.set(teacherId, enrollments);
      this.cache.lastUpdate.set(listenerKey, Date.now());
    });
    
    this.cache.listeners.set(listenerKey, unsubscribe);
  }
  
  /**
   * Invalida el caché para un usuario específico
   */
  invalidateCache(userId: string, role: 'student' | 'teacher' | 'both' = 'both'): void {
    if (role === 'student' || role === 'both') {
      this.cache.studentEnrollments.delete(userId);
      this.cache.lastUpdate.delete(`student_${userId}`);
    }
    
    if (role === 'teacher' || role === 'both') {
      this.cache.teacherEnrollments.delete(userId);
      this.cache.lastUpdate.delete(`teacher_${userId}`);
    }
  }
  
  /**
   * Limpia todos los listeners (útil para logout)
   */
  cleanup(): void {
    this.cache.listeners.forEach((unsubscribe) => unsubscribe());
    this.cache.listeners.clear();
    this.cache.studentEnrollments.clear();
    this.cache.teacherEnrollments.clear();
    this.cache.lastUpdate.clear();
  }
}

export const enrollmentCacheService = EnrollmentCacheService.getInstance();