import { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { collection, query, where, onSnapshot, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { SchoolNotebook, SchoolStudent } from '../types/interfaces';

export const useSchoolStudentData = () => {
  const [studentNotebooks, setStudentNotebooks] = useState<SchoolNotebook[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [studentInfo, setStudentInfo] = useState<SchoolStudent | null>(null);
  const [user] = useAuthState(auth);

  useEffect(() => {
    if (!user) {
      console.log('👤 No hay usuario autenticado, limpiando datos del estudiante');
      setStudentNotebooks([]);
      setStudentInfo(null);
      setLoading(false);
      return;
    }

    const loadStudentNotebooks = async (): Promise<(() => void) | undefined> => {
      try {
        console.log('🔄 Cargando cuadernos para estudiante:', user.uid);
        setLoading(true);

        // 1. Obtener información del estudiante
        const studentQuery = query(
          collection(db, 'schoolStudents'),
          where('id', '==', user.uid)
        );
        const studentSnapshot = await getDocs(studentQuery);
        
        if (studentSnapshot.empty) {
          console.log('❌ No se encontró información del estudiante');
          setStudentNotebooks([]);
          setStudentInfo(null);
          setLoading(false);
          return undefined;
        }

        const studentData = studentSnapshot.docs[0].data() as SchoolStudent;
        setStudentInfo(studentData);
        console.log('👨‍🎓 Datos del estudiante encontrados:', studentData.nombre);
        console.log('📚 Cuadernos asignados:', studentData.idCuadernos);

        // 2. Si el estudiante tiene cuadernos asignados
        if (studentData.idCuadernos && studentData.idCuadernos.length > 0) {
          // Usar onSnapshot para actualizaciones en tiempo real
          const notebooksQuery = query(
            collection(db, 'schoolNotebooks'),
            where('__name__', 'in', studentData.idCuadernos), // __name__ es el ID del documento
            orderBy('createdAt', 'desc')
          );

          const unsubscribe = onSnapshot(
            notebooksQuery,
            (snapshot) => {
              const notebooksList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                color: doc.data().color || '#6147FF'
              })) as SchoolNotebook[];
              
              console.log('📚 Cuadernos heredados cargados:', notebooksList.length, 'cuadernos');
              setStudentNotebooks(notebooksList);
              setLoading(false);
            },
            (err) => {
              console.error("❌ Error fetching student notebooks:", err);
              setError(err);
              setLoading(false);
            }
          );

          return unsubscribe;
        } else {
          console.log('📚 El estudiante no tiene cuadernos asignados');
          setStudentNotebooks([]);
          setLoading(false);
          return undefined;
        }

      } catch (err) {
        console.error("❌ Error loading student notebooks:", err);
        setError(err as Error);
        setLoading(false);
        return undefined;
      }
    };

    let unsubscribeFunction: (() => void) | undefined;
    
    loadStudentNotebooks().then((unsubscribe) => {
      unsubscribeFunction = unsubscribe;
    });
    
    // Limpiar suscripción si existe
    return () => {
      if (unsubscribeFunction) {
        unsubscribeFunction();
      }
    };
  }, [user]);

  return { 
    studentNotebooks, 
    loading, 
    error, 
    studentInfo,
    // Información útil para el estudiante
    hasNotebooks: studentNotebooks && studentNotebooks.length > 0,
    notebookCount: studentNotebooks?.length || 0
  };
}; 