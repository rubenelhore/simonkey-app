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
    console.log('🔍 UnifiedConceptService.getConceptDocs - notebookId:', notebookId);
    try {
      // First try to get concepts from the subcollection within the notebook
      const conceptsRef = collection(db, 'notebooks', notebookId, 'concepts');
      console.log('📚 Intentando obtener conceptos de notebooks subcollection...');
      const querySnapshot = await getDocs(conceptsRef);
      
      if (querySnapshot.size > 0) {
        return querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ConceptDoc[];
      }
      
      // If no concepts in subcollection, try the old way for backward compatibility
      console.log('📚 No hay conceptos en subcollection, intentando colección legacy...');
      const conceptsCollection = await UnifiedNotebookService.getConceptsCollection(notebookId);
      console.log('📚 Colección legacy detectada:', conceptsCollection);
      
      // IMPORTANTE: Ambas colecciones usan 'cuadernoId'
      const q = query(
        collection(db, conceptsCollection),
        where('cuadernoId', '==', notebookId)
      );
      
      console.log('🔍 Ejecutando query en colección legacy...');
      const legacySnapshot = await getDocs(q);
      return legacySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ConceptDoc[];
    } catch (error: any) {
      console.error(`❌ Error getting concept docs for notebook ${notebookId}:`, error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      if (error.code === 'permission-denied') {
        console.error('🔒 PERMISSION DENIED - Usuario no tiene permisos para leer conceptos');
      }
      return [];
    }
  }
  
  /**
   * Obtiene todos los conceptos de un notebook (aplanados)
   */
  static async getConcepts(notebookId: string): Promise<Concept[]> {
    try {
      // First try to get concepts from the subcollection within the notebooks collection
      const conceptsRef = collection(db, 'notebooks', notebookId, 'concepts');
      const querySnapshot = await getDocs(conceptsRef);
      
      if (querySnapshot.size > 0) {
        // If concepts are stored as individual documents in the subcollection
        const concepts: Concept[] = [];
        querySnapshot.docs.forEach(doc => {
          const data = doc.data();
          // Check if it's a single concept or an array of concepts
          if (data.conceptos && Array.isArray(data.conceptos)) {
            concepts.push(...data.conceptos);
          } else if (data.titulo || data.definicion) {
            // Single concept document
            concepts.push({
              id: doc.id,
              ...data
            } as Concept);
          }
        });
        console.log(`📚 Found ${concepts.length} concepts in notebooks/${notebookId}/concepts subcollection`);
        return concepts;
      }
      
      // Try schoolNotebooks subcollection for backward compatibility
      try {
        const schoolConceptsRef = collection(db, 'schoolNotebooks', notebookId, 'concepts');
        const schoolSnapshot = await getDocs(schoolConceptsRef);
        
        if (schoolSnapshot.size > 0) {
          const concepts: Concept[] = [];
          schoolSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.conceptos && Array.isArray(data.conceptos)) {
              concepts.push(...data.conceptos);
            } else if (data.titulo || data.definicion) {
              concepts.push({
                id: doc.id,
                ...data
              } as Concept);
            }
          });
          console.log(`📚 Found ${concepts.length} concepts in schoolNotebooks/${notebookId}/concepts subcollection`);
          return concepts;
        }
      } catch (error) {
        console.log('No schoolNotebooks subcollection found, trying legacy collections...');
      }
      
      // Fall back to old method for backward compatibility
      const conceptDocs = await this.getConceptDocs(notebookId);
      const legacyConcepts = conceptDocs.flatMap(doc => doc.conceptos || []);
      if (legacyConcepts.length > 0) {
        console.log(`📚 Found ${legacyConcepts.length} concepts in legacy collection for notebook ${notebookId}`);
      }
      return legacyConcepts;
    } catch (error) {
      console.error(`Error getting concepts for notebook ${notebookId}:`, error);
      return [];
    }
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
      
      // Añadir todos los conceptos de una vez
      await updateDoc(docRef, {
        conceptos: arrayUnion(...concepts)
      });
    } else {
      // Si no existe, crear un nuevo documento con todos los conceptos
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
    console.log(`➕ ${concepts.length} conceptos agregados, invalidando cache de materias...`);
    CacheManager.invalidateMateriasCache(userId);
  }
  
  /**
   * Actualiza un concepto específico
   */
  static async updateConcept(notebookId: string, conceptIndex: number, updates: Partial<Concept>): Promise<void> {
    const conceptDocs = await this.getConceptDocs(notebookId);
    
    if (conceptDocs.length === 0) {
      throw new Error('No concept document found');
    }
    
    const conceptDoc = conceptDocs[0];
    const conceptsCollection = await UnifiedNotebookService.getConceptsCollection(notebookId);
    const docRef = doc(db, conceptsCollection, conceptDoc.id);
    
    // Actualizar el concepto en el índice especificado
    const updatedConceptos = [...conceptDoc.conceptos];
    updatedConceptos[conceptIndex] = {
      ...updatedConceptos[conceptIndex],
      ...updates
    };
    
    await updateDoc(docRef, {
      conceptos: updatedConceptos
    });
  }
  
  /**
   * Elimina un concepto específico
   */
  static async deleteConcept(notebookId: string, conceptIndex: number): Promise<void> {
    const conceptDocs = await this.getConceptDocs(notebookId);
    
    if (conceptDocs.length === 0) {
      throw new Error('No concept document found');
    }
    
    const conceptDoc = conceptDocs[0];
    const conceptsCollection = await UnifiedNotebookService.getConceptsCollection(notebookId);
    const docRef = doc(db, conceptsCollection, conceptDoc.id);
    
    // Eliminar el concepto del array
    const updatedConceptos = conceptDoc.conceptos.filter((_, index) => index !== conceptIndex);
    
    await updateDoc(docRef, {
      conceptos: updatedConceptos
    });
  }
  
  /**
   * Obtiene un concepto específico por índice
   */
  static async getConcept(notebookId: string, conceptIndex: number): Promise<Concept | null> {
    const concepts = await this.getConcepts(notebookId);
    return concepts[conceptIndex] || null;
  }
  
  /**
   * Cuenta el número total de conceptos en un notebook
   */
  static async countConcepts(notebookId: string): Promise<number> {
    const concepts = await this.getConcepts(notebookId);
    return concepts.length;
  }
  
  /**
   * Alias for countConcepts for backward compatibility
   */
  static async getConceptCount(notebookId: string): Promise<number> {
    return this.countConcepts(notebookId);
  }
  
  /**
   * Migra conceptos de la colección antigua a la nueva estructura de subcolección
   */
  static async migrateConcepts(notebookId: string): Promise<boolean> {
    try {
      // Get concepts from old collection
      const conceptsCollection = await UnifiedNotebookService.getConceptsCollection(notebookId);
      const q = query(
        collection(db, conceptsCollection),
        where('cuadernoId', '==', notebookId)
      );
      const oldConceptsSnapshot = await getDocs(q);
      
      if (oldConceptsSnapshot.empty) {
        return false;
      }
      
      // Get all concepts from old format
      const allConcepts: Concept[] = [];
      oldConceptsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.conceptos && Array.isArray(data.conceptos)) {
          allConcepts.push(...data.conceptos);
        }
      });
      
      if (allConcepts.length === 0) {
        return false;
      }
      
      // Add concepts to new subcollection
      const newConceptsRef = collection(db, 'notebooks', notebookId, 'concepts');
      
      // Create a single document with all concepts (maintaining old structure)
      await addDoc(newConceptsRef, {
        cuadernoId: notebookId,
        conceptos: allConcepts,
        creadoEn: serverTimestamp(),
        migrated: true
      });
      
      console.log(`✅ Migrated ${allConcepts.length} concepts for notebook ${notebookId}`);
      return true;
    } catch (error) {
      console.error(`Error migrating concepts for notebook ${notebookId}:`, error);
      return false;
    }
  }
}