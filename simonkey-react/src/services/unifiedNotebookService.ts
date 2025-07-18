import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  deleteField,
  Timestamp,
  orderBy,
  documentId
} from 'firebase/firestore';
import { db } from './firebase';
import { Notebook } from '../types/interfaces';

/**
 * Servicio unificado para manejar notebooks durante la migración
 * Este servicio abstrae las diferencias entre las colecciones notebooks y schoolNotebooks
 */
export class UnifiedNotebookService {
  
  /**
   * Obtiene un notebook por ID, buscando primero en notebooks y luego en schoolNotebooks
   */
  static async getNotebook(notebookId: string): Promise<Notebook | null> {
    // Primero buscar en notebooks regulares
    const regularDoc = await getDoc(doc(db, 'notebooks', notebookId));
    if (regularDoc.exists()) {
      const data = regularDoc.data();
      return {
        id: regularDoc.id,
        type: data.type || 'personal', // Si no tiene type, asumimos que es personal
        ...data
      } as Notebook;
    }
    
    // Si no existe, buscar en schoolNotebooks
    const schoolDoc = await getDoc(doc(db, 'schoolNotebooks', notebookId));
    if (schoolDoc.exists()) {
      const data = schoolDoc.data();
      return {
        id: schoolDoc.id,
        type: 'school',
        ...data
      } as Notebook;
    }
    
    return null;
  }
  
  /**
   * Obtiene notebooks para un usuario específico
   */
  static async getUserNotebooks(userId: string): Promise<Notebook[]> {
    const notebooks: Notebook[] = [];
    
    // Obtener notebooks personales
    const personalQuery = query(
      collection(db, 'notebooks'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const personalSnapshot = await getDocs(personalQuery);
    personalSnapshot.forEach(doc => {
      const data = doc.data();
      notebooks.push({
        id: doc.id,
        type: data.type || 'personal',
        ...data
      } as Notebook);
    });
    
    return notebooks;
  }
  
  /**
   * Obtiene notebooks escolares para un profesor
   */
  static async getTeacherNotebooks(materiaIds: string[]): Promise<Notebook[]> {
    if (!materiaIds || materiaIds.length === 0) return [];
    
    const notebooks: Notebook[] = [];
    
    // Buscar en schoolNotebooks
    const schoolQuery = query(
      collection(db, 'schoolNotebooks'),
      where('idMateria', 'in', materiaIds),
      orderBy('createdAt', 'desc')
    );
    
    const schoolSnapshot = await getDocs(schoolQuery);
    schoolSnapshot.forEach(doc => {
      const data = doc.data();
      notebooks.push({
        id: doc.id,
        type: 'school',
        ...data
      } as Notebook);
    });
    
    return notebooks;
  }
  
  /**
   * Obtiene notebooks asignados a un estudiante
   */
  static async getStudentNotebooks(notebookIds: string[]): Promise<Notebook[]> {
    if (!notebookIds || notebookIds.length === 0) return [];
    
    const notebooks: Notebook[] = [];
    
    // Buscar en schoolNotebooks por IDs específicos
    const schoolQuery = query(
      collection(db, 'schoolNotebooks'),
      where(documentId(), 'in', notebookIds)
    );
    
    const schoolSnapshot = await getDocs(schoolQuery);
    schoolSnapshot.forEach(doc => {
      const data = doc.data();
      notebooks.push({
        id: doc.id,
        type: 'school',
        ...data
      } as Notebook);
    });
    
    return notebooks;
  }
  
  /**
   * Crea un nuevo notebook (determina automáticamente la colección)
   */
  static async createNotebook(notebookData: Partial<Notebook>): Promise<string> {
    const timestamp = Timestamp.now();
    const data = {
      ...notebookData,
      createdAt: timestamp,
      updatedAt: timestamp,
      conceptCount: 0
    };
    
    // Si es un notebook escolar, usar schoolNotebooks
    if (notebookData.type === 'school' || notebookData.idMateria) {
      const docRef = await addDoc(collection(db, 'schoolNotebooks'), {
        ...data,
        type: 'school'
      });
      return docRef.id;
    }
    
    // Si no, usar notebooks regulares
    const docRef = await addDoc(collection(db, 'notebooks'), {
      ...data,
      type: 'personal'
    });
    return docRef.id;
  }
  
  /**
   * Actualiza un notebook (busca en ambas colecciones)
   */
  static async updateNotebook(notebookId: string, updates: Partial<Notebook>): Promise<void> {
    // Preparar las actualizaciones
    const updatesWithTimestamp: any = {
      ...updates,
      updatedAt: Timestamp.now()
    };
    
    // Convertir undefined a deleteField() para campos que se deben eliminar
    Object.keys(updatesWithTimestamp).forEach(key => {
      if (updatesWithTimestamp[key] === undefined) {
        updatesWithTimestamp[key] = deleteField();
      }
    });
    
    // Primero intentar en notebooks regulares
    const regularRef = doc(db, 'notebooks', notebookId);
    const regularDoc = await getDoc(regularRef);
    
    if (regularDoc.exists()) {
      await updateDoc(regularRef, updatesWithTimestamp);
      return;
    }
    
    // Si no existe, intentar en schoolNotebooks
    const schoolRef = doc(db, 'schoolNotebooks', notebookId);
    const schoolDoc = await getDoc(schoolRef);
    
    if (schoolDoc.exists()) {
      await updateDoc(schoolRef, updatesWithTimestamp);
      return;
    }
    
    throw new Error('Notebook not found');
  }
  
  /**
   * Elimina un notebook (busca en ambas colecciones)
   */
  static async deleteNotebook(notebookId: string): Promise<void> {
    // Primero intentar en notebooks regulares
    const regularRef = doc(db, 'notebooks', notebookId);
    const regularDoc = await getDoc(regularRef);
    
    if (regularDoc.exists()) {
      await deleteDoc(regularRef);
      return;
    }
    
    // Si no existe, intentar en schoolNotebooks
    const schoolRef = doc(db, 'schoolNotebooks', notebookId);
    const schoolDoc = await getDoc(schoolRef);
    
    if (schoolDoc.exists()) {
      await deleteDoc(schoolRef);
      return;
    }
    
    throw new Error('Notebook not found');
  }
  
  /**
   * Determina qué colección de conceptos usar basándose en el notebook
   */
  static async getConceptsCollection(notebookId: string): Promise<string> {
    const notebook = await this.getNotebook(notebookId);
    if (!notebook) {
      throw new Error('Notebook not found');
    }
    
    return notebook.type === 'school' ? 'schoolConcepts' : 'conceptos';
  }
  
  /**
   * Helper para determinar si un usuario es escolar
   */
  static isSchoolUser(userProfile: any): boolean {
    return userProfile?.subscription === 'school' || 
           userProfile?.schoolRole !== undefined;
  }
}