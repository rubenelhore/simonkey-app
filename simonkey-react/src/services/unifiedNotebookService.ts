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
    // Primero intentar en notebooks regulares (más común para usuarios free)
    try {
      const regularDoc = await getDoc(doc(db, 'notebooks', notebookId));
      if (regularDoc.exists()) {
        const data = regularDoc.data();
        return {
          id: regularDoc.id,
          type: data.type || 'personal', // Si no tiene type, asumimos que es personal
          ...data
        } as Notebook;
      }
    } catch (error) {
      console.log('Error accediendo a notebooks regulares:', error);
    }
    
    // Si no existe en notebooks regulares, intentar en schoolNotebooks
    // Solo si el usuario tiene permisos para acceder a esa colección
    try {
      const schoolDoc = await getDoc(doc(db, 'schoolNotebooks', notebookId));
      if (schoolDoc.exists()) {
        const data = schoolDoc.data();
        return {
          id: schoolDoc.id,
          type: 'school',
          ...data
        } as Notebook;
      }
    } catch (error) {
      // Es normal que usuarios free no puedan acceder a schoolNotebooks
      console.log('No se pudo acceder a schoolNotebooks (esto es normal para usuarios free)');
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
   * Obtiene notebooks para un profesor basados en sus materias
   */
  static async getTeacherNotebooks(materiaIds: string[], teacherId?: string): Promise<Notebook[]> {
    console.log('🔍 UnifiedNotebookService.getTeacherNotebooks - Iniciando');
    console.log('  - materiaIds:', materiaIds);
    console.log('  - teacherId:', teacherId);
    
    if (!materiaIds || materiaIds.length === 0) {
      console.log('  ❌ No hay materiaIds, retornando array vacío');
      return [];
    }
    
    const notebooks: Notebook[] = [];
    
    // Hacer un query simple por materiaId
    console.log('  📖 Ejecutando query para obtener notebooks de las materias');
    
    const simpleQuery = query(
      collection(db, 'notebooks'),
      where('materiaId', 'in', materiaIds)
    );
    
    try {
      const notebooksSnapshot = await getDocs(simpleQuery);
      console.log('  📊 Documentos encontrados con query por materiaId:', notebooksSnapshot.size);
      
      notebooksSnapshot.forEach(doc => {
        const data = doc.data();
        
        // Si se proporciona teacherId, filtrar por él
        if (teacherId) {
          console.log(`  🔍 Revisando notebook con filtro por teacherId: ${doc.id}`);
          console.log(`     - title: ${data.title}`);
          console.log(`     - materiaId: ${data.materiaId}`);
          console.log(`     - userId del notebook: ${data.userId}`);
          console.log(`     - teacherId buscado: ${teacherId}`);
          console.log(`     - ¿Coinciden?: ${data.userId === teacherId}`);
          
          if (data.userId === teacherId) {
            console.log(`  ✅ Notebook del profesor encontrado: ${doc.id}`);
            notebooks.push({
              id: doc.id,
              ...data
            } as Notebook);
          } else {
            console.log(`  ❌ Este notebook no es del profesor actual`);
          }
        } else {
          // Sin teacherId, incluir todos los notebooks de la materia
          console.log(`  📓 Notebook encontrado: ${doc.id}`);
          console.log(`     - title: ${data.title}`);
          console.log(`     - materiaId: ${data.materiaId}`);
          console.log(`     - userId: ${data.userId}`);
          notebooks.push({
            id: doc.id,
            ...data
          } as Notebook);
        }
      });
      
      if (teacherId) {
        console.log(`  ✅ Total notebooks del profesor ${teacherId}:`, notebooks.length);
      } else {
        console.log(`  ✅ Total notebooks de las materias:`, notebooks.length);
      }
    } catch (error) {
      console.error('  ❌ Error ejecutando query:', error);
    }
    
    // Ordenar manualmente si tenemos notebooks
    if (notebooks.length > 0) {
      notebooks.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
    }
    
    console.log('  ✅ Total notebooks retornados:', notebooks.length);
    return notebooks;
  }
  
  /**
   * Obtiene notebooks asignados a un estudiante
   */
  static async getStudentNotebooks(notebookIds: string[]): Promise<Notebook[]> {
    if (!notebookIds || notebookIds.length === 0) return [];
    
    const notebooks: Notebook[] = [];
    
    // Buscar en notebooks por IDs específicos
    const notebooksQuery = query(
      collection(db, 'notebooks'),
      where(documentId(), 'in', notebookIds)
    );
    
    const notebooksSnapshot = await getDocs(notebooksQuery);
    notebooksSnapshot.forEach(doc => {
      const data = doc.data();
      notebooks.push({
        id: doc.id,
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
      console.error(`No se encontró el notebook con ID: ${notebookId}`);
      throw new Error('No se pudo encontrar el cuaderno. Por favor, verifica que el cuaderno existe y que tienes permisos para acceder a él.');
    }
    
    return notebook.type === 'school' ? 'schoolConcepts' : 'conceptos';
  }
  
  /**
   * Obtiene notebooks regulares para un profesor (no escolares)
   */
  static async getRegularTeacherNotebooks(materiaIds: string[], userId: string): Promise<Notebook[]> {
    if (!materiaIds || materiaIds.length === 0) {
      return [];
    }
    
    const notebooks: Notebook[] = [];
    
    // Buscar en notebooks regulares por materia y usuario
    const notebooksQuery = query(
      collection(db, 'notebooks'),
      where('materiaId', 'in', materiaIds),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const notebooksSnapshot = await getDocs(notebooksQuery);
    
    notebooksSnapshot.forEach(doc => {
      const data = doc.data();
      notebooks.push({
        id: doc.id,
        type: 'personal',
        ...data
      } as Notebook);
    });
    
    return notebooks;
  }

  /**
   * Helper para determinar si un usuario es escolar
   */
  static isSchoolUser(userProfile: any): boolean {
    return userProfile?.subscription === 'school' || 
           userProfile?.schoolRole !== undefined;
  }
}