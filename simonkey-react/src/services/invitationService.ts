import { 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  deleteDoc,
  serverTimestamp,
  Timestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from './firebase';
import { InviteCode, Enrollment, EnrollmentStatus } from '../types/interfaces';

/**
 * Genera un código único de 6-8 caracteres alfanuméricos
 */
function generateUniqueCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Verifica si un código ya existe
 */
async function isCodeUnique(code: string): Promise<boolean> {
  const q = query(collection(db, 'inviteCodes'), where('code', '==', code));
  const snapshot = await getDocs(q);
  return snapshot.empty;
}

/**
 * Crea un código de invitación para una materia
 */
export async function createInviteCode(
  teacherId: string,
  materiaId: string,
  materiaName: string,
  options?: {
    expiresInDays?: number;
    maxUses?: number;
    description?: string;
    welcomeMessage?: string;
  }
): Promise<InviteCode> {
  console.log('🔵 createInviteCode iniciado', { teacherId, materiaId, materiaName });
  
  let code = generateUniqueCode();
  let attempts = 0;
  
  // Intentar generar un código único (máximo 10 intentos)
  while (!(await isCodeUnique(code)) && attempts < 10) {
    code = generateUniqueCode();
    attempts++;
  }
  
  if (attempts >= 10) {
    throw new Error('No se pudo generar un código único. Por favor, intenta de nuevo.');
  }

  console.log('✅ Código único generado:', code);

  const inviteData: Omit<InviteCode, 'id'> = {
    code,
    teacherId,
    materiaId,
    materiaName,
    createdAt: serverTimestamp() as Timestamp,
    currentUses: 0,
    isActive: true
  };

  // Agregar fecha de expiración si se especifica
  if (options?.expiresInDays) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + options.expiresInDays);
    inviteData.expiresAt = Timestamp.fromDate(expirationDate);
  }

  // Agregar límite de usos si se especifica
  if (options?.maxUses) {
    inviteData.maxUses = options.maxUses;
  }

  // Agregar metadata si se proporciona
  if (options?.description || options?.welcomeMessage) {
    inviteData.metadata = {
      description: options.description,
      welcomeMessage: options.welcomeMessage
    };
  }

  console.log('📝 Datos a guardar:', inviteData);

  try {
    const docRef = await addDoc(collection(db, 'inviteCodes'), inviteData);
    console.log('✅ Documento creado con ID:', docRef.id);
    
    return {
      id: docRef.id,
      ...inviteData
    } as InviteCode;
  } catch (error) {
    console.error('❌ Error al crear documento en Firestore:', error);
    throw error;
  }
}

/**
 * Obtiene todos los códigos de invitación de un profesor
 */
export async function getTeacherInviteCodes(teacherId: string): Promise<InviteCode[]> {
  const q = query(
    collection(db, 'inviteCodes'),
    where('teacherId', '==', teacherId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as InviteCode));
}

/**
 * Obtiene los códigos de invitación de una materia específica
 */
export async function getMateriaInviteCodes(materiaId: string): Promise<InviteCode[]> {
  const q = query(
    collection(db, 'inviteCodes'),
    where('materiaId', '==', materiaId),
    where('isActive', '==', true),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as InviteCode));
}

/**
 * Valida un código de invitación
 */
export async function validateInviteCode(code: string): Promise<{
  isValid: boolean;
  inviteCode?: InviteCode;
  error?: string;
}> {
  const q = query(
    collection(db, 'inviteCodes'),
    where('code', '==', code.toUpperCase()),
    where('isActive', '==', true),
    limit(1)
  );
  
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    return { isValid: false, error: 'Código de invitación no válido o inactivo' };
  }
  
  const inviteDoc = snapshot.docs[0];
  const inviteCode = {
    id: inviteDoc.id,
    ...inviteDoc.data()
  } as InviteCode;
  
  // Verificar si el código ha expirado
  if (inviteCode.expiresAt) {
    const now = new Date();
    const expirationDate = inviteCode.expiresAt.toDate();
    if (now > expirationDate) {
      return { isValid: false, error: 'El código de invitación ha expirado' };
    }
  }
  
  // Verificar si se ha alcanzado el límite de usos
  if (inviteCode.maxUses && inviteCode.currentUses >= inviteCode.maxUses) {
    return { isValid: false, error: 'El código de invitación ha alcanzado el límite de usos' };
  }
  
  return { isValid: true, inviteCode };
}

/**
 * Usa un código de invitación para inscribir a un estudiante
 */
export async function useInviteCode(
  code: string,
  studentId: string,
  studentEmail?: string,
  studentName?: string
): Promise<{
  success: boolean;
  enrollment?: Enrollment;
  error?: string;
}> {
  // Validar el código
  const validation = await validateInviteCode(code);
  
  if (!validation.isValid || !validation.inviteCode) {
    return { success: false, error: validation.error };
  }
  
  const inviteCode = validation.inviteCode;
  
  // Verificar si el estudiante ya está inscrito en esta materia
  const existingEnrollmentQuery = query(
    collection(db, 'enrollments'),
    where('studentId', '==', studentId),
    where('materiaId', '==', inviteCode.materiaId),
    where('status', '==', 'active')
  );
  
  const existingEnrollment = await getDocs(existingEnrollmentQuery);
  
  if (!existingEnrollment.empty) {
    return { success: false, error: 'Ya estás inscrito en esta materia' };
  }
  
  // Crear la inscripción
  const enrollmentData: Omit<Enrollment, 'id'> = {
    studentId,
    studentEmail,
    studentName,
    teacherId: inviteCode.teacherId,
    materiaId: inviteCode.materiaId,
    materiaName: inviteCode.materiaName,
    enrolledAt: serverTimestamp() as Timestamp,
    status: EnrollmentStatus.ACTIVE,
    inviteCode: inviteCode.code,
    metadata: {
      source: 'invite_link'
    }
  };
  
  const enrollmentRef = await addDoc(collection(db, 'enrollments'), enrollmentData);
  
  // Incrementar el contador de usos del código
  await updateDoc(doc(db, 'inviteCodes', inviteCode.id), {
    currentUses: inviteCode.currentUses + 1
  });
  
  return {
    success: true,
    enrollment: {
      id: enrollmentRef.id,
      ...enrollmentData
    } as Enrollment
  };
}

/**
 * Desactiva un código de invitación
 */
export async function deactivateInviteCode(codeId: string): Promise<void> {
  await updateDoc(doc(db, 'inviteCodes', codeId), {
    isActive: false
  });
}

/**
 * Elimina un código de invitación
 */
export async function deleteInviteCode(codeId: string): Promise<void> {
  await deleteDoc(doc(db, 'inviteCodes', codeId));
}

/**
 * Genera el enlace de invitación completo
 */
export function generateInviteLink(code: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/join/${code}`;
}

/**
 * Copia el enlace de invitación al portapapeles
 */
export async function copyInviteLink(code: string): Promise<boolean> {
  try {
    const link = generateInviteLink(code);
    await navigator.clipboard.writeText(link);
    return true;
  } catch (error) {
    console.error('Error copiando el enlace:', error);
    return false;
  }
}