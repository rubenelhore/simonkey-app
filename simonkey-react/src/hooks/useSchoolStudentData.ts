import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { SchoolNotebook, SchoolStudent, SchoolSubject } from '../types/interfaces';
import { useAuth } from '../contexts/AuthContext';

export const useSchoolStudentData = () => {
  const [schoolNotebooks, setSchoolNotebooks] = useState<SchoolNotebook[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      console.log('👤 No hay usuario autenticado, limpiando datos escolares');
      setSchoolNotebooks([]);
      setLoading(false);
      return;
    }

    const loadSchoolStudentData = async (): Promise<(() => void) | undefined> => {
      try {
        console.log('🔄 Cargando datos escolares para estudiante:', user.uid);
        setLoading(true);

        // 1. Obtener información del estudiante desde la colección users con schoolRole
        const studentQuery = query(
          collection(db, 'users'),
          where('id', '==', user.uid),
          where('schoolRole', '==', 'student')
        );
        const studentSnapshot = await getDocs(studentQuery);
        
        if (studentSnapshot.empty) {
          console.log('❌ No se encontró información del estudiante');
          setSchoolNotebooks([]);
          setLoading(false);
          return undefined;
        }

        const studentData = studentSnapshot.docs[0].data() as SchoolStudent;
        console.log('👨‍🎓 Datos del estudiante encontrados:', studentData.nombre);

        // 2. Obtener la materia del estudiante
        const classroomQuery = query(
          collection(db, 'schoolSubjects'),
          where('idEstudiante', '==', user.uid)
        );
        const classroomSnapshot = await getDocs(classroomQuery);
        
        if (classroomSnapshot.empty) {
          console.log('❌ No se encontró materia asignada al estudiante');
          setSchoolNotebooks([]);
          setLoading(false);
          return undefined;
        }

        const classroomId = classroomSnapshot.docs[0].id;
        console.log('🏫 Materia encontrada:', classroomId);

        // 3. Obtener los cuadernos de la materia
        const notebooksQuery = query(
          collection(db, 'schoolNotebooks'),
          where('idMateria', '==', classroomId),
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
            console.error("❌ Error fetching school student data:", err);
            setError(err);
            setLoading(false);
          }
        );

        return unsubscribe;

      } catch (err) {
        console.error("❌ Error loading school student data:", err);
        setError(err as Error);
        setLoading(false);
        return undefined;
      }
    };

    let unsubscribeFunction: (() => void) | undefined;
    
    loadSchoolStudentData().then((unsubscribe) => {
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