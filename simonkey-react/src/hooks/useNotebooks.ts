import { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db, auth } from '../services/firebase';

// Define la interfaz localmente en vez de importarla
interface Notebook {
  id: string;
  title: string;
  userId: string;
  createdAt: Date | any;
  color?: string;
}

export const useNotebooks = () => {
  const [notebooks, setNotebooks] = useState<Notebook[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [user] = useAuthState(auth);

  useEffect(() => {
    if (!user) {
      setNotebooks([]);
      setLoading(false);
      return;
    }

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
        
        setNotebooks(notebooksList);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching notebooks:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  return { notebooks, loading, error };
};