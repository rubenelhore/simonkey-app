import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, getDocs, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { SchoolNotebook, SchoolStudent, SchoolSubject } from '../types/interfaces';
import { useAuth } from '../contexts/AuthContext';

export const useSchoolStudentData = () => {
  const [schoolNotebooks, setSchoolNotebooks] = useState<SchoolNotebook[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user, userProfile } = useAuth();

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

        // Método 1: Intentar obtener datos desde schoolStudents (requiere permisos de admin)
        try {
          const studentQuery = query(
            collection(db, 'schoolStudents'),
            where('id', '==', user.uid)
          );
          const studentSnapshot = await getDocs(studentQuery);
          
          if (!studentSnapshot.empty) {
            const studentData = studentSnapshot.docs[0].data() as SchoolStudent;
            console.log('👨‍🎓 Datos del estudiante encontrados en schoolStudents:', studentData.nombre);
            console.log('📚 idCuadernos del estudiante:', studentData.idCuadernos);

            if (studentData.idCuadernos && studentData.idCuadernos.length > 0) {
              // Obtener directamente los cuadernos usando los IDs del array idCuadernos
              const notebooksQuery = query(
                collection(db, 'schoolNotebooks'),
                where('__name__', 'in', studentData.idCuadernos)
              );

              const unsubscribe = onSnapshot(
                notebooksQuery,
                (snapshot) => {
                  const notebooksList = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    color: doc.data().color || '#6147FF'
                  })) as SchoolNotebook[];
                  
                  console.log('📚 Cuadernos escolares cargados desde schoolStudents:', notebooksList.length, 'cuadernos');
                  notebooksList.forEach(notebook => {
                    console.log('   -', notebook.id, ':', notebook.title);
                  });
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
            }
          }
        } catch (error) {
          console.log('⚠️ No se pudo acceder a schoolStudents (permisos insuficientes), intentando método alternativo...');
        }

        // Método 2: Buscar materias donde el estudiante esté asignado
        try {
          const subjectsQuery = query(
            collection(db, 'schoolSubjects'),
            where('idEstudiante', '==', user.uid)
          );
          const subjectsSnapshot = await getDocs(subjectsQuery);
          
          if (!subjectsSnapshot.empty) {
            const subjectDoc = subjectsSnapshot.docs[0];
            const subjectData = subjectDoc.data();
            console.log('🏫 Materia encontrada:', subjectData.nombre || subjectDoc.id);

            // Buscar cuadernos de esa materia
            const notebooksQuery = query(
              collection(db, 'schoolNotebooks'),
              where('idMateria', '==', subjectDoc.id)
            );

            const unsubscribe = onSnapshot(
              notebooksQuery,
              (snapshot) => {
                const notebooksList = snapshot.docs.map(doc => ({
                  id: doc.id,
                  ...doc.data(),
                  color: doc.data().color || '#6147FF'
                })) as SchoolNotebook[];
                
                console.log('📚 Cuadernos escolares cargados desde materias:', notebooksList.length, 'cuadernos');
                notebooksList.forEach(notebook => {
                  console.log('   -', notebook.id, ':', notebook.title);
                });
                setSchoolNotebooks(notebooksList);
                setLoading(false);
              },
              (err) => {
                console.error("❌ Error fetching school notebooks from subjects:", err);
                setError(err);
                setLoading(false);
              }
            );

            return unsubscribe;
          }
        } catch (error) {
          console.log('⚠️ No se pudo acceder a schoolSubjects, verificando perfil de usuario...');
        }

        // Método 3: Usar el perfil del usuario que ya está disponible en el contexto
        if (userProfile) {
          console.log('👤 Perfil de usuario disponible en contexto:', userProfile.nombre);
          console.log('🎓 schoolRole:', userProfile.schoolRole);
          console.log('📚 idNotebook:', userProfile.idNotebook);
          
          if (userProfile.schoolRole === 'student') {
            console.log('✅ Usuario confirmado como estudiante');
            
            // Método 4: Intentar obtener cuadernos usando el campo idNotebook del usuario
            if (userProfile.idNotebook) {
              console.log('📚 Intentando cargar cuaderno usando idNotebook:', userProfile.idNotebook);
              
              const notebookRef = doc(db, 'schoolNotebooks', userProfile.idNotebook);
              
              const unsubscribe = onSnapshot(
                notebookRef,
                (snapshot) => {
                  if (snapshot.exists()) {
                    const notebookData = snapshot.data();
                    const notebook = {
                      id: snapshot.id,
                      ...notebookData,
                      color: notebookData.color || '#6147FF'
                    } as SchoolNotebook;
                    
                    console.log('📚 Cuaderno cargado usando idNotebook:', notebook.title);
                    setSchoolNotebooks([notebook]);
                    setLoading(false);
                  } else {
                    console.log('❌ No se encontró el cuaderno con idNotebook:', userProfile.idNotebook);
                    setSchoolNotebooks([]);
                    setLoading(false);
                  }
                },
                (err) => {
                  console.error("❌ Error fetching notebook by idNotebook:", err);
                  setError(err);
                  setLoading(false);
                }
              );
              
              return unsubscribe;
            } else {
              console.log('⚠️ Usuario no tiene idNotebook asignado');
              console.log('💡 Contacta al administrador para que te asigne cuadernos');
            }
          } else {
            console.log('⚠️ Usuario no tiene schoolRole: student');
            console.log('💡 Ejecuta: window.fixStudentProfileSimple() para arreglar el perfil');
          }
        } else {
          console.log('⚠️ No se pudo verificar el perfil de usuario');
        }

        console.log('❌ No se encontraron cuadernos asignados al estudiante');
        setSchoolNotebooks([]);
        setLoading(false);
        return undefined;

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
  }, [user, userProfile]);

  return { schoolNotebooks, loading, error };
}; 