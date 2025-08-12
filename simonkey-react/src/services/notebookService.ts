// src/services/notebookService.ts
import { db } from './firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, serverTimestamp, updateDoc, setDoc, Timestamp, getDoc } from 'firebase/firestore';
import { canCreateNotebook, incrementNotebookCount } from './userService';

interface Notebook {
  id?: string;
  title: string;
  userId: string;
  createdAt: Date;
  color?: string;
  category?: string;
  materiaId?: string;
}

// Create a new notebook
export const createNotebook = async (userId: string, title: string, color: string = '#6147FF', category?: string, materiaId?: string | undefined) => {
  // Verificar si el usuario puede crear un nuevo cuaderno
  const canCreate = await canCreateNotebook(userId);
  
  if (!canCreate.canCreate) {
    throw new Error(canCreate.reason || 'No se puede crear el cuaderno');
  }

  // Verificar si ya existe un cuaderno con el mismo nombre
  const existingNotebooks = await getNotebooks(userId);
  const normalizedTitle = title.trim().toLowerCase();
  const existingNotebook = existingNotebooks.find(notebook => 
    notebook.title.trim().toLowerCase() === normalizedTitle
  );

  if (existingNotebook) {
    console.log('🚫 Notebook already exists:', { existingNotebook, normalizedTitle });
    throw new Error('Ya existe un cuaderno con ese nombre. Por favor, elige otro nombre.');
  }

  const notebookData: any = {
    title,
    userId,
    color,
    category: category || '', // Incluir categoría (vacía si no se proporciona)
    createdAt: serverTimestamp(), // Usar serverTimestamp para mejor consistencia
  };
  
  // Si se proporciona materiaId, incluirlo
  if (materiaId) {
    notebookData.materiaId = materiaId;
  }
  
  const docRef = await addDoc(collection(db, 'notebooks'), notebookData);
  
  // Incrementar el contador de cuadernos del usuario
  await incrementNotebookCount(userId);
  
  // Inicializar límites de estudio para el nuevo cuaderno
  await initializeStudyLimitsForNotebook(userId, docRef.id);
  
  return { id: docRef.id, ...notebookData };
};

/**
 * Inicializar límites de estudio para un nuevo cuaderno
 * Esto permite estudio libre y quiz inmediato en cuadernos recientemente creados
 */
const initializeStudyLimitsForNotebook = async (userId: string, notebookId: string) => {
  try {
    // Crear documento de límites específico del cuaderno para quiz
    const notebookLimitsRef = doc(db, 'users', userId, 'notebookLimits', notebookId);
    
    const limitsData = {
      userId,
      notebookId,
      lastQuizDate: null, // Permitir quiz inmediato
      quizCountThisWeek: 0,
      weekStartDate: new Date(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    await setDoc(notebookLimitsRef, limitsData);
  } catch (error) {
    // No lanzar error para no interrumpir la creación del cuaderno
  }
};

// Fetch all notebooks for a user
export const getNotebooks = async (userId: string) => {
  const q = query(collection(db, 'notebooks'), where('userId', '==', userId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notebook));
};

// Delete a notebook
export const deleteNotebook = async (notebookId: string) => {
  await deleteDoc(doc(db, 'notebooks', notebookId));
};

// Update a notebook
export const updateNotebook = async (id: string, newTitle: string, userId: string) => {
  console.log('updateNotebook llamado con:', { id, newTitle, userId });
  
  // Verificar si ya existe un cuaderno con el mismo nombre (excluyendo el actual)
  const existingNotebooks = await getNotebooks(userId);
  console.log('Notebooks existentes:', existingNotebooks.map(n => ({ id: n.id, title: n.title })));
  
  const normalizedTitle = newTitle.trim().toLowerCase();
  console.log('Título normalizado:', normalizedTitle);
  
  const existingNotebook = existingNotebooks.find(notebook => 
    notebook.id !== id && notebook.title.trim().toLowerCase() === normalizedTitle
  );

  console.log('Notebook duplicado encontrado:', existingNotebook);

  if (existingNotebook) {
    console.log('Lanzando error de nombre duplicado');
    throw new Error('Ya existe un cuaderno con ese nombre. Por favor, elige otro nombre.');
  }

  console.log('No hay duplicados, actualizando en Firestore...');
  
  // Primero intentar en schoolNotebooks (para usuarios escolares)
  try {
    const schoolNotebookRef = doc(db, "schoolNotebooks", id);
    const schoolNotebookDoc = await getDoc(schoolNotebookRef);
    
    if (schoolNotebookDoc.exists()) {
      console.log('Es un schoolNotebook, actualizando en schoolNotebooks...');
      await updateDoc(schoolNotebookRef, { title: newTitle });
      console.log('SchoolNotebook actualizado exitosamente');
      return;
    }
  } catch (error) {
    console.log('No es un schoolNotebook o error al buscar:', error);
  }
  
  // Si no es schoolNotebook, intentar en notebooks regular
  try {
    const notebookRef = doc(db, "notebooks", id);
    const notebookDoc = await getDoc(notebookRef);
    
    if (notebookDoc.exists()) {
      console.log('Es un notebook regular, actualizando en notebooks...');
      await updateDoc(notebookRef, { title: newTitle });
      console.log('Notebook actualizado exitosamente');
      return;
    }
  } catch (error) {
    console.log('Error al buscar notebook regular:', error);
  }
  
  // Si no se encuentra en ninguna colección, lanzar error
  throw new Error(`No se encontró el cuaderno con ID: ${id} en ninguna colección`);
};

// Update notebook color
export const updateNotebookColor = async (id: string, newColor: string) => {
  try {
    // Primero intentar en schoolNotebooks
    try {
      const schoolNotebookRef = doc(db, 'schoolNotebooks', id);
      const schoolNotebookDoc = await getDoc(schoolNotebookRef);
      
      if (schoolNotebookDoc.exists()) {
        await updateDoc(schoolNotebookRef, { color: newColor });
        return true;
      }
    } catch (error) {
      console.log('No es un schoolNotebook:', error);
    }
    
    // Si no es schoolNotebook, intentar en notebooks regular
    const notebookRef = doc(db, 'notebooks', id);
    const notebookDoc = await getDoc(notebookRef);
    
    if (notebookDoc.exists()) {
      await updateDoc(notebookRef, { color: newColor });
      return true;
    }
    
    throw new Error(`No se encontró el cuaderno con ID: ${id} en ninguna colección`);
  } catch (error) {
    console.error('Error al actualizar el color:', error);
    throw error;
  }
};