import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, getDocs, doc, updateDoc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Notebook } from '../types/interfaces';
import { useAuth } from '../contexts/AuthContext';

export const useNotebooks = () => {
  const [notebooks, setNotebooks] = useState<Notebook[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user, effectiveUserId } = useAuth();

  useEffect(() => {
    if (!user || !effectiveUserId) {
      console.log('👤 No hay usuario autenticado, limpiando cuadernos');
      setNotebooks([]);
      setLoading(false);
      return;
    }

    console.log('🔄 Cargando cuadernos para usuario:', effectiveUserId);
    console.log('🔍 UID de Firebase:', user.uid);
    console.log('🔍 ID efectivo:', effectiveUserId);
    setLoading(true);
    
    const notebooksQuery = query(
      collection(db, 'notebooks'),
      where('userId', '==', effectiveUserId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      notebooksQuery,
      (snapshot) => {
        const notebooksList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          color: doc.data().color || '#6147FF' // Valor por defecto si no existe color
        })) as Notebook[];
        
        console.log('📚 Cuadernos cargados:', notebooksList.length, 'cuadernos');
        console.log('🔍 DEBUG - Datos completos de cuadernos:', notebooksList);
        console.log('🔍 DEBUG - Cuadernos con categoría:', notebooksList.filter(n => n.category && n.category.trim() !== ''));
        console.log('🔍 DEBUG - Cuadernos sin categoría:', notebooksList.filter(n => !n.category || n.category.trim() === ''));
        
        // Log detallado de cada cuaderno con categoría
        notebooksList.forEach((notebook, index) => {
          if (notebook.category && notebook.category.trim() !== '') {
            console.log(`🔍 DEBUG - Cuaderno ${index} (${notebook.id}): categoría = "${notebook.category}"`);
          } else {
            console.log(`🔍 DEBUG - Cuaderno ${index} (${notebook.id}): sin categoría`);
          }
        });
        
        setNotebooks(notebooksList);
        setLoading(false);
      },
      (err) => {
        console.error("❌ Error fetching notebooks:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, effectiveUserId]);

  return { notebooks, loading, error };
};