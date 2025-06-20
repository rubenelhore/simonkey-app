import { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { collection, query, where, onSnapshot, orderBy, getDocs } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { SchoolNotebook, SchoolTeacher, SchoolClassroom } from '../types/interfaces';

export const useSchoolNotebooks = () => {
  const [schoolNotebooks, setSchoolNotebooks] = useState<SchoolNotebook[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [user] = useAuthState(auth);

  useEffect(() => {
    if (!user) {
      console.log('👤 No hay usuario autenticado, limpiando cuadernos escolares');
      setSchoolNotebooks([]);
      setLoading(false);
      return;
    }

    const loadSchoolNotebooks = async (): Promise<(() => void) | undefined> => {
      try {
        console.log('🔄 Cargando cuadernos escolares para profesor:', user.uid);
        setLoading(true);

        // 1. Obtener información del profesor
        const teacherQuery = query(
          collection(db, 'schoolTeachers'),
          where('id', '==', user.uid)
        );
        const teacherSnapshot = await getDocs(teacherQuery);
        
        if (teacherSnapshot.empty) {
          console.log('❌ No se encontró información del profesor');
          setSchoolNotebooks([]);
          setLoading(false);
          return undefined;
        }

        const teacherData = teacherSnapshot.docs[0].data() as SchoolTeacher;
        console.log('👨‍🏫 Datos del profesor encontrados:', teacherData.nombre);

        // 2. Obtener los salones asignados al profesor
        const classroomQuery = query(
          collection(db, 'schoolClassrooms'),
          where('idProfesor', '==', user.uid)
        );
        const classroomSnapshot = await getDocs(classroomQuery);
        
        if (classroomSnapshot.empty) {
          console.log('❌ No se encontraron salones asignados al profesor');
          setSchoolNotebooks([]);
          setLoading(false);
          return undefined;
        }

        const classroomIds = classroomSnapshot.docs.map(doc => doc.id);
        console.log('🏫 Salones encontrados:', classroomIds);

        // 3. Si hay salones, obtener los cuadernos de esos salones
        if (classroomIds.length > 0) {
          const notebooksQuery = query(
            collection(db, 'schoolNotebooks'),
            where('idSalon', 'in', classroomIds),
            orderBy('createdAt', 'desc')
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
        } else {
          setSchoolNotebooks([]);
          setLoading(false);
          return undefined;
        }

      } catch (err) {
        console.error("❌ Error loading school notebooks:", err);
        setError(err as Error);
        setLoading(false);
        return undefined;
      }
    };

    let unsubscribeFunction: (() => void) | undefined;
    
    loadSchoolNotebooks().then((unsubscribe) => {
      unsubscribeFunction = unsubscribe;
    });
    
    // Limpiar suscripción si existe
    return () => {
      if (unsubscribeFunction) {
        unsubscribeFunction();
      }
    };
  }, [user]);

  return { schoolNotebooks, loading, error };
}; 