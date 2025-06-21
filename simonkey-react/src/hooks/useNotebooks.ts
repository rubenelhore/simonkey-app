import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, getDocs, doc, updateDoc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Notebook } from '../types/interfaces';
import { useAuth } from '../contexts/AuthContext';

export const useNotebooks = () => {
  const [notebooks, setNotebooks] = useState<Notebook[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      console.log('👤 No hay usuario autenticado, limpiando cuadernos');
      setNotebooks([]);
      setLoading(false);
      return;
    }

    console.log('🔄 Cargando cuadernos para usuario:', user.uid);
    setLoading(true);
    
    const notebooksQuery = query(
      collection(db, 'notebooks'),
      where('userId', '==', user.uid),
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
  }, [user]);

  return { notebooks, loading, error };
};