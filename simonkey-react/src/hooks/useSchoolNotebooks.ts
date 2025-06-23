import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { SchoolNotebook, SchoolTeacher, SchoolSubject, SchoolAdmin } from '../types/interfaces';
import { useAuth } from '../contexts/AuthContext';

export const useSchoolNotebooks = () => {
  const { user, userProfile } = useAuth();
  const [schoolNotebooks, setSchoolNotebooks] = useState<SchoolNotebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setSchoolNotebooks([]);
      setLoading(false);
      return;
    }

    const loadSchoolNotebooks = async (): Promise<(() => void) | undefined> => {
      try {
        console.log('🔄 Cargando cuadernos escolares para profesor:', user.uid);
        setLoading(true);
        
        // LOG: userProfile
        console.log('🔍 useSchoolNotebooks - userProfile:', userProfile);
        
        // Verificar que el usuario es profesor
        if (!userProfile || userProfile.schoolRole !== 'teacher') {
          console.log('❌ Usuario no es profesor escolar');
          setSchoolNotebooks([]);
          setLoading(false);
          return undefined;
        }

        console.log('✅ Usuario confirmado como profesor escolar');

        // Obtener directamente las materias asignadas al profesor
        console.log('🔍 Ejecutando query para schoolSubjects con idProfesor:', user.uid);
        const subjectQuery = query(
          collection(db, 'schoolSubjects'),
          where('idProfesor', '==', user.uid)
        );
        const subjectSnapshot = await getDocs(subjectQuery);
        console.log('🔍 subjectSnapshot.size:', subjectSnapshot.size);
        
        if (subjectSnapshot.empty) {
          console.log('❌ No se encontraron materias asignadas al profesor');
          console.log('💡 El profesor necesita tener materias asignadas por un administrador');
          setSchoolNotebooks([]);
          setLoading(false);
          return undefined;
        }

        const subjectIds = subjectSnapshot.docs.map(doc => doc.id);
        console.log('🏫 Materias encontradas (IDs de documento):', subjectIds);

        // Obtener los cuadernos de esas materias
        console.log('🔍 Ejecutando query para schoolNotebooks con idMateria:', subjectIds);
        const notebooksQuery = query(
          collection(db, 'schoolNotebooks'),
          where('idMateria', 'in', subjectIds)
        );

        // Usar onSnapshot para actualizaciones en tiempo real
        const unsubscribe = onSnapshot(
          notebooksQuery,
          (snapshot) => {
            const notebooksList = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
              color: doc.data().color || '#6147FF'
            })) as SchoolNotebook[];
            
            // Ordenar manualmente por createdAt descendente
            notebooksList.sort((a, b) => {
              const aTime = a.createdAt?.seconds || 0;
              const bTime = b.createdAt?.seconds || 0;
              return bTime - aTime;
            });
            
            console.log('📚 Cuadernos escolares cargados:', notebooksList.length, 'cuadernos');
            setSchoolNotebooks(notebooksList);
            setLoading(false);
          },
          (err) => {
            console.error("❌ Error fetching school notebooks:", err);
            setError(err);
            setLoading(false);
          }
        );

        return unsubscribe;

      } catch (error) {
        console.error('❌ Error cargando cuadernos escolares:', error);
        setError(error as Error);
        setLoading(false);
        return undefined;
      }
    };

    const unsubscribe = loadSchoolNotebooks();
    return () => {
      if (unsubscribe) {
        unsubscribe.then(unsub => unsub && unsub());
      }
    };
  }, [user, userProfile]);

  return { schoolNotebooks, loading, error };
}; 