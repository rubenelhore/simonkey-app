import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Notebook, SchoolTeacher, SchoolSubject, SchoolAdmin } from '../types/interfaces';
import { useAuth } from '../contexts/AuthContext';

export const useSchoolNotebooks = () => {
  const { user, userProfile } = useAuth();
  const [schoolNotebooks, setSchoolNotebooks] = useState<Notebook[]>([]);
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
        console.log('🔍 useSchoolNotebooks - user:', {
          uid: user.uid,
          email: user.email
        });
        
        // Verificar que el usuario es profesor
        if (!userProfile || userProfile.schoolRole !== 'teacher') {
          console.log('❌ Usuario no es profesor escolar');
          console.log('   - schoolRole:', userProfile?.schoolRole);
          console.log('   - subscription:', userProfile?.subscription);
          setSchoolNotebooks([]);
          setLoading(false);
          return undefined;
        }

        console.log('✅ Usuario confirmado como profesor escolar');

        // Obtener directamente las materias asignadas al profesor
        // IMPORTANTE: Usar el ID del documento del profesor, no el UID de Firebase
        const teacherId = userProfile.id || user.uid;
        console.log('🔍 Buscando materias para profesor con ID:', teacherId);
        console.log('📊 Detalles del profesor:', {
          documentId: userProfile.id,
          firebaseUid: user.uid,
          email: userProfile.email,
          nombre: userProfile.nombre
        });
        
        console.log('🔍 Intentando query en schoolSubjects...');
        const subjectQuery = query(
          collection(db, 'schoolSubjects'),
          where('idProfesor', '==', teacherId)
        );
        
        let subjectSnapshot;
        try {
          subjectSnapshot = await getDocs(subjectQuery);
          console.log('✅ Query exitosa en schoolSubjects');
          console.log('🔍 subjectSnapshot.size:', subjectSnapshot.size);
        } catch (queryError) {
          console.error('❌ Error específico en query de schoolSubjects:', queryError);
          throw queryError;
        }
        
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
              color: doc.data().color || '#6147FF',
              type: 'school' as const
            })) as Notebook[];
            
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
        unsubscribe.then(unsub => {
          if (unsub) {
            try {
              unsub();
            } catch (error) {
              // Silenciar errores durante cleanup (esperado durante logout)
              console.warn('⚠️ Error durante unsubscribe de school notebooks (esperado durante logout):', error);
            }
          }
        }).catch(error => {
          // Silenciar errores de promise durante cleanup
          console.warn('⚠️ Error en promise unsubscribe (esperado durante logout):', error);
        });
      }
    };
  }, [user, userProfile]);

  return { schoolNotebooks, loading, error };
}; 