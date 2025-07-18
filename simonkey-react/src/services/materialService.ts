import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  where, 
  serverTimestamp,
  updateDoc 
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { db, auth, storage } from './firebase';
import { Material } from '../types/interfaces';
import { uploadMaterialToStorage } from './firebaseFunctions';

/**
 * Convierte un archivo a base64
 */
const fileToBase64 = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Extraer solo la parte base64
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

export class MaterialService {
  /**
   * Guarda la referencia del material en Firestore (sin subir a Storage por ahora)
   * Esto evita problemas de CORS hasta que se resuelvan
   */
  static async uploadMaterial(
    file: File, 
    notebookId: string
  ): Promise<Material> {
    if (!auth.currentUser) {
      throw new Error('Usuario no autenticado');
    }

    const userId = auth.currentUser.uid;

    try {
      // Crear documento en Firestore con la información del material
      const materialId = doc(collection(db, 'materials')).id;
      
      // Por ahora, usar un placeholder URL hasta que se resuelva CORS
      // En el futuro, esto se actualizará con la URL real de Storage
      const placeholderUrl = `placeholder://${userId}/${notebookId}/${file.name}`;
      
      const material: Material = {
        id: materialId,
        name: file.name,
        type: file.type,
        size: file.size,
        url: placeholderUrl,
        uploadedAt: serverTimestamp() as any,
        notebookId: notebookId,
        userId: userId
      };

      // Guardar en Firestore
      await setDoc(doc(db, 'materials', materialId), {
        ...material,
        // Guardar metadata adicional para futura migración
        pending: true,
        originalFileName: file.name
      });

      console.log('✅ Material registrado en Firestore:', materialId);
      
      // Intentar subir directamente a Storage (evitando Cloud Function por ahora)
      try {
        const timestamp = Date.now();
        const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const storagePath = `materials/${userId}/${notebookId}/${materialId}_${timestamp}_${safeFileName}`;
        const storageRef = ref(storage, storagePath);
        
        console.log('📤 Subiendo archivo a Storage...', storagePath);
        
        // Subir el archivo
        const snapshot = await uploadBytes(storageRef, file, {
          contentType: file.type,
          customMetadata: {
            materialId,
            notebookId,
            userId,
            uploadedAt: new Date().toISOString()
          }
        });
        
        // Obtener la URL de descarga
        const downloadURL = await getDownloadURL(snapshot.ref);
        console.log('✅ Archivo subido exitosamente:', downloadURL);
        
        // Actualizar el documento en Firestore con la URL real
        await updateDoc(doc(db, 'materials', materialId), {
          url: downloadURL,
          pending: false,
          storagePath
        });
        
        // Actualizar el material local con la URL real
        material.url = downloadURL;
        
      } catch (storageError) {
        console.error('⚠️ Error subiendo a Storage:', storageError);
        
        // Fallback: intentar con Cloud Function si falla el método directo
        uploadMaterialToStorage({
          materialId,
          fileName: file.name,
          fileContent: await fileToBase64(file),
          fileType: file.type,
          notebookId,
          userId
        }).then(result => {
          console.log('✅ Material subido via Cloud Function:', result);
          if ((result.data as any)?.url) {
            updateDoc(doc(db, 'materials', materialId), {
              url: (result.data as any).url,
              pending: false
            }).catch(err => console.error('Error actualizando URL:', err));
          }
        }).catch(err => {
          console.error('⚠️ Error con Cloud Function (no crítico):', err);
        });
      }

      return material;
    } catch (error) {
      console.error('Error registrando material:', error);
      throw error;
    }
  }

  /**
   * Obtiene todos los materiales de un notebook
   */
  static async getNotebookMaterials(notebookId: string): Promise<Material[]> {
    try {
      const q = query(
        collection(db, 'materials'), 
        where('notebookId', '==', notebookId)
      );
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as Material));
    } catch (error) {
      console.error('Error obteniendo materiales:', error);
      throw error;
    }
  }

  /**
   * Obtiene un material específico
   */
  static async getMaterial(materialId: string): Promise<Material | null> {
    try {
      const docSnap = await getDoc(doc(db, 'materials', materialId));
      
      if (docSnap.exists()) {
        return {
          ...docSnap.data(),
          id: docSnap.id
        } as Material;
      }
      
      return null;
    } catch (error) {
      console.error('Error obteniendo material:', error);
      throw error;
    }
  }

  /**
   * Elimina un material
   */
  static async deleteMaterial(materialId: string): Promise<void> {
    try {
      // Obtener el material para saber su ruta en Storage
      const materialDoc = await getDoc(doc(db, 'materials', materialId));
      
      if (materialDoc.exists()) {
        const materialData = materialDoc.data() as Material & { storagePath?: string };
        
        // Intentar eliminar de Storage si existe la ruta
        if (materialData.storagePath) {
          try {
            const storageRef = ref(storage, materialData.storagePath);
            await deleteObject(storageRef);
            console.log('✅ Archivo eliminado de Storage');
          } catch (storageError) {
            console.error('⚠️ Error eliminando de Storage:', storageError);
            // Continuar con la eliminación de Firestore aunque falle Storage
          }
        }
      }
      
      // Eliminar de Firestore
      await deleteDoc(doc(db, 'materials', materialId));
      console.log('✅ Material eliminado de Firestore:', materialId);
    } catch (error) {
      console.error('Error eliminando material:', error);
      throw error;
    }
  }

  /**
   * Sube múltiples materiales
   */
  static async uploadMultipleMaterials(
    files: File[], 
    notebookId: string
  ): Promise<Material[]> {
    const uploadPromises = files.map(file => 
      this.uploadMaterial(file, notebookId)
    );
    
    return Promise.all(uploadPromises);
  }
}