import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { SchoolNotebook, SchoolStudent, SchoolSubject } from '../types/interfaces';
import { useAuth } from '../contexts/AuthContext';

export const useSchoolStudentData = () => {
  const [schoolNotebooks, setSchoolNotebooks] = useState<SchoolNotebook[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user, userProfile, effectiveUserId } = useAuth();

  useEffect(() => {
    if (!user || !effectiveUserId) {
      console.log('👤 No hay usuario autenticado, limpiando datos escolares');
      setSchoolNotebooks([]);
      setLoading(false);
      return;
    }

    const loadSchoolStudentData = async (): Promise<(() => void) | undefined> => {
      try {
        console.log('🔄 Cargando datos escolares para estudiante:', effectiveUserId);
        console.log('🔍 UID de Firebase:', user.uid);
        console.log('🔍 ID efectivo:', effectiveUserId);
        setLoading(true);

        // Obtener el usuario desde la colección unificada users
        const userDocRef = doc(db, 'users', effectiveUserId);
        const userSnapshot = await getDoc(userDocRef);
        
        if (!userSnapshot.exists()) {
          console.log('❌ No se encontró el usuario en la base de datos');
          setSchoolNotebooks([]);
          setLoading(false);
          return undefined;
        }

        const userData = userSnapshot.data();
        console.log('👤 Datos del usuario:', userData);

        // Verificar si es un estudiante escolar (normalizar a minúsculas para comparación)
        const normalizedSubscription = userData.subscription?.toLowerCase() || '';
        const normalizedRole = userData.schoolRole?.toLowerCase() || '';
        
        if (normalizedSubscription !== 'school' || normalizedRole !== 'student') {
          console.log('⚠️ Usuario no es un estudiante escolar');
          console.log('   - subscription:', userData.subscription, '(normalizado:', normalizedSubscription, ')');
          console.log('   - schoolRole:', userData.schoolRole, '(normalizado:', normalizedRole, ')');
          setSchoolNotebooks([]);
          setLoading(false);
          return undefined;
        }

        console.log('✅ Usuario confirmado como estudiante escolar');
        console.log('📚 idCuadernos del estudiante:', userData.idCuadernos);

        // Si el estudiante tiene cuadernos asignados
        if (userData.idCuadernos && userData.idCuadernos.length > 0) {
          // Obtener directamente los cuadernos usando los IDs del array idCuadernos
          const notebooksQuery = query(
            collection(db, 'schoolNotebooks'),
            where('__name__', 'in', userData.idCuadernos)
          );

          const unsubscribe = onSnapshot(
            notebooksQuery,
            (snapshot) => {
              const notebooksList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                color: doc.data().color || '#6147FF'
              })) as SchoolNotebook[];
              
              console.log('📚 Cuadernos escolares cargados:', notebooksList.length, 'cuadernos');
              notebooksList.forEach(notebook => {
                console.log('   -', notebook.id, ':', notebook.title);
              });
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
        }

        // Método alternativo: Buscar materias donde el estudiante esté asignado
        try {
          // Usar effectiveUserId en lugar de user.uid para estudiantes escolares
          const subjectsQuery = query(
            collection(db, 'schoolSubjects'),
            where('idEstudiante', '==', effectiveUserId)
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
          console.log('⚠️ No se pudo acceder a schoolSubjects');
        }

        // Método final: Usar idNotebook del perfil si existe
        if (userData.idNotebook) {
          console.log('📚 Intentando cargar cuaderno usando idNotebook:', userData.idNotebook);
          
          const notebookRef = doc(db, 'schoolNotebooks', userData.idNotebook);
          
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
                console.log('❌ No se encontró el cuaderno con idNotebook:', userData.idNotebook);
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
        }

        console.log('❌ No se encontraron cuadernos asignados al estudiante');
        console.log('💡 Contacta al administrador para que te asigne cuadernos');
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
  }, [user, effectiveUserId]);

  return { schoolNotebooks, loading, error };
};