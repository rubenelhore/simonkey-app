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
  setDoc,
  Timestamp,
  arrayUnion,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { Concept } from '../types/interfaces';
import { UnifiedNotebookService } from './unifiedNotebookService';
import { CacheManager } from '../utils/cacheManager';

interface ConceptDoc {
  id: string;
  cuadernoId: string;
  usuarioId: string;
  conceptos: Concept[];
  creadoEn: Date | Timestamp;
}

/**
 * Servicio unificado para manejar conceptos durante la migración
 * Este servicio abstrae las diferencias entre las colecciones conceptos y schoolConcepts
 */
export class UnifiedConceptService {
  
  /**
   * Obtiene todos los documentos de conceptos para un notebook
   */
  static async getConceptDocs(notebookId: string): Promise<ConceptDoc[]> {
    const conceptsCollection = await UnifiedNotebookService.getConceptsCollection(notebookId);
    
    // IMPORTANTE: Ambas colecciones usan 'cuadernoId'
    const q = query(
      collection(db, conceptsCollection),
      where('cuadernoId', '==', notebookId)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ConceptDoc[];
  }
  
  /**
   * Obtiene todos los conceptos de un notebook (aplanados)
   */
  static async getConcepts(notebookId: string): Promise<Concept[]> {
    const conceptDocs = await this.getConceptDocs(notebookId);
    return conceptDocs.flatMap(doc => doc.conceptos || []);
  }
  
  /**
   * Añade un concepto a un notebook
   */
  static async addConcept(notebookId: string, concept: Concept, userId: string): Promise<void> {
    const conceptsCollection = await UnifiedNotebookService.getConceptsCollection(notebookId);
    const conceptDocs = await this.getConceptDocs(notebookId);
    
    if (conceptDocs.length > 0) {
      // Si ya existe un documento, añadir el concepto al array
      const existingDoc = conceptDocs[0];
      const docRef = doc(db, conceptsCollection, existingDoc.id);
      await updateDoc(docRef, {
        conceptos: arrayUnion(concept)
      });
    } else {
      // Si no existe, crear un nuevo documento
      const newDocRef = doc(collection(db, conceptsCollection));
      await setDoc(newDocRef, {
        id: newDocRef.id,
        cuadernoId: notebookId,
        usuarioId: userId,
        conceptos: [concept],
        creadoEn: serverTimestamp()
      });
    }
    
    // Invalidar caché de materias cuando se agrega un concepto
    console.log('➕ Concepto agregado, invalidando cache de materias...');
    CacheManager.invalidateMateriasCache(userId);
  }
  
  /**
   * Añade múltiples conceptos a un notebook
   */
  static async addConcepts(notebookId: string, concepts: Concept[], userId: string): Promise<void> {
    const conceptsCollection = await UnifiedNotebookService.getConceptsCollection(notebookId);
    const conceptDocs = await this.getConceptDocs(notebookId);
    
    if (conceptDocs.length > 0) {
      // Si ya existe un documento, añadir los conceptos al array
      const existingDoc = conceptDocs[0];
      const docRef = doc(db, conceptsCollection, existingDoc.id);
      await updateDoc(docRef, {
        conceptos: arrayUnion(...concepts)
      });
    } else {
      // Si no existe, crear un nuevo documento
      const newDocRef = doc(collection(db, conceptsCollection));
      await setDoc(newDocRef, {
        id: newDocRef.id,
        cuadernoId: notebookId,
        usuarioId: userId,
        conceptos: concepts,
        creadoEn: serverTimestamp()
      });
    }
    
    // Invalidar caché de materias cuando se agregan conceptos
    console.log('➕ Conceptos agregados, invalidando cache de materias...');
    CacheManager.invalidateMateriasCache(userId);
  }
  
  /**
   * Actualiza un concepto específico
   */
  static async updateConcept(
    notebookId: string, 
    conceptId: string, 
    updates: Partial<Concept>
  ): Promise<void> {
    const conceptDocs = await this.getConceptDocs(notebookId);
    
    for (const conceptDoc of conceptDocs) {
      const conceptIndex = conceptDoc.conceptos.findIndex(c => c.id === conceptId);
      if (conceptIndex !== -1) {
        const updatedConcepts = [...conceptDoc.conceptos];
        updatedConcepts[conceptIndex] = { ...updatedConcepts[conceptIndex], ...updates };
        
        const conceptsCollection = await UnifiedNotebookService.getConceptsCollection(notebookId);
        const docRef = doc(db, conceptsCollection, conceptDoc.id);
        await updateDoc(docRef, {
          conceptos: updatedConcepts
        });
        
        // Invalidar caché de materias cuando se actualiza un concepto (podría cambiar dominio)
        console.log('✏️ Concepto actualizado, invalidando cache de materias...');
        const userId = conceptDoc.usuarioId;
        if (userId) {
          CacheManager.invalidateMateriasCache(userId);
        }
        
        break;
      }
    }
  }
  
  /**
   * Elimina un concepto específico
   */
  static async deleteConcept(notebookId: string, conceptId: string): Promise<void> {
    const conceptDocs = await this.getConceptDocs(notebookId);
    
    for (const conceptDoc of conceptDocs) {
      const filteredConcepts = conceptDoc.conceptos.filter(c => c.id !== conceptId);
      if (filteredConcepts.length !== conceptDoc.conceptos.length) {
        const conceptsCollection = await UnifiedNotebookService.getConceptsCollection(notebookId);
        const docRef = doc(db, conceptsCollection, conceptDoc.id);
        
        if (filteredConcepts.length === 0) {
          // Si no quedan conceptos, eliminar el documento
          await deleteDoc(docRef);
        } else {
          // Si quedan conceptos, actualizar el array
          await updateDoc(docRef, {
            conceptos: filteredConcepts
          });
        }
        
        // Invalidar caché de materias cuando se elimina un concepto
        console.log('🗑️ Concepto eliminado, invalidando cache de materias...');
        const userId = conceptDoc.usuarioId;
        if (userId) {
          CacheManager.invalidateMateriasCache(userId);
        }
        
        break;
      }
    }
  }
  
  /**
   * Cuenta el número total de conceptos en un notebook
   */
  static async getConceptCount(notebookId: string): Promise<number> {
    const conceptDocs = await this.getConceptDocs(notebookId);
    return conceptDocs.reduce((total, doc) => total + (doc.conceptos?.length || 0), 0);
  }
  
  /**
   * Busca un concepto específico por ID
   */
  static async findConcept(notebookId: string, conceptId: string): Promise<Concept | null> {
    const conceptDocs = await this.getConceptDocs(notebookId);
    
    for (const doc of conceptDocs) {
      const concept = doc.conceptos.find(c => c.id === conceptId);
      if (concept) {
        return concept;
      }
    }
    
    return null;
  }
}