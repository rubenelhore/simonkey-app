// src/services/notebookService.ts
import { db } from './firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, serverTimestamp, updateDoc } from 'firebase/firestore';
import { canCreateNotebook, incrementNotebookCount } from './userService';

interface Notebook {
  id?: string;
  title: string;
  userId: string;
  createdAt: Date;
}

// Create a new notebook
export const createNotebook = async (userId: string, title: string) => {
  // Verificar si el usuario puede crear un nuevo cuaderno
  const canCreate = await canCreateNotebook(userId);
  if (!canCreate.canCreate) {
    throw new Error(canCreate.reason || 'No se puede crear el cuaderno');
  }

  const notebookData = {
    title,
    userId,
    createdAt: serverTimestamp(), // Usar serverTimestamp para mejor consistencia
  };
  
  const docRef = await addDoc(collection(db, 'notebooks'), notebookData);
  
  // Incrementar el contador de cuadernos del usuario
  await incrementNotebookCount(userId);
  
  return { id: docRef.id, ...notebookData };
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
export const updateNotebook = async (id: string, newTitle: string) => {
  const notebookRef = doc(db, "notebooks", id);
  await updateDoc(notebookRef, { title: newTitle });
};

// Update notebook color
export const updateNotebookColor = async (id: string, newColor: string) => {
  try {
    const notebookRef = doc(db, 'notebooks', id);
    await updateDoc(notebookRef, {
      color: newColor
    });
    return true;
  } catch (error) {
    console.error('Error al actualizar el color:', error);
    throw error;
  }
};