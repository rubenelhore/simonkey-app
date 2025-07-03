import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { SchoolNotebook, SchoolStudent, SchoolSubject } from '../types/interfaces';
import { useAuth } from '../contexts/AuthContext';

export const useSchoolStudentData = () => {
  const [schoolNotebooks, setSchoolNotebooks] = useState<SchoolNotebook[] | null>(null);
  const [schoolSubjects, setSchoolSubjects] = useState<SchoolSubject[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user, userProfile, effectiveUserId } = useAuth();

  useEffect(() => {
    console.log('🎓 useSchoolStudentData - Hook iniciado');
    console.log('🎓 user:', user?.uid);
    console.log('🎓 effectiveUserId:', effectiveUserId);
    
    if (!user || !effectiveUserId) {
      console.log('👤 No hay usuario autenticado, limpiando datos escolares');
      setSchoolNotebooks([]);
      setSchoolSubjects([]);
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
              
              // IMPORTANTE: También buscar las materias de estos notebooks
              console.log('🔍 Buscando materias de los notebooks asignados...');
              const materiaIds = new Set<string>();
              
              notebooksList.forEach(notebook => {
                if (notebook.idMateria) {
                  materiaIds.add(notebook.idMateria);
                  console.log('   - Notebook', notebook.id, 'pertenece a materia:', notebook.idMateria);
                }
              });
              
              console.log('📚 IDs de materias encontradas:', Array.from(materiaIds));
              
              if (materiaIds.size > 0) {
                const materiasQuery = query(
                  collection(db, 'schoolSubjects'),
                  where('__name__', 'in', Array.from(materiaIds))
                );
                
                getDocs(materiasQuery).then(materiasSnapshot => {
                  const subjectsList = materiasSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                  })) as SchoolSubject[];
                  
                  console.log('🏫 Materias cargadas desde notebooks directos:', subjectsList.length);
                  subjectsList.forEach(subject => {
                    console.log('   -', subject.id, ':', subject.nombre);
                  });
                  
                  setSchoolSubjects(subjectsList);
                }).catch(error => {
                  console.error('❌ Error cargando materias:', error);
                });
              } else {
                console.log('⚠️ Los notebooks no tienen idMateria asignado');
              }
              
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
        console.log('🔄 Iniciando búsqueda de materias...');
        try {
          console.log('🔍 Buscando materias asignadas al estudiante por idEstudiante...');
          
          // Primero, cargar TODAS las materias del estudiante
          const subjectsQuery = query(
            collection(db, 'schoolSubjects'),
            where('idEstudiante', '==', effectiveUserId)
          );
          
          const unsubscribeSubjects = onSnapshot(
            subjectsQuery,
            async (subjectsSnapshot) => {
              if (!subjectsSnapshot.empty) {
                // Cargar todas las materias
                const subjectsList = subjectsSnapshot.docs.map(doc => ({
                  id: doc.id,
                  ...doc.data()
                })) as SchoolSubject[];
                
                console.log('🏫 Materias encontradas:', subjectsList.length);
                subjectsList.forEach(subject => {
                  console.log('   -', subject.id, ':', subject.nombre, '- data completa:', subject);
                });
                
                console.log('🎓 Actualizando estado de schoolSubjects con:', subjectsList);
                setSchoolSubjects(subjectsList);
                
                // Cargar todos los notebooks de todas las materias
                const allNotebooks: SchoolNotebook[] = [];
                const subjectIds = subjectsList.map(s => s.id);
                
                if (subjectIds.length > 0) {
                  const notebooksQuery = query(
                    collection(db, 'schoolNotebooks'),
                    where('idMateria', 'in', subjectIds)
                  );
                  
                  const notebooksSnapshot = await getDocs(notebooksQuery);
                  notebooksSnapshot.docs.forEach(doc => {
                    allNotebooks.push({
                      id: doc.id,
                      ...doc.data(),
                      color: doc.data().color || '#6147FF'
                    } as SchoolNotebook);
                  });
                  
                  console.log('📚 Cuadernos escolares cargados desde materias:', allNotebooks.length);
                  setSchoolNotebooks(allNotebooks);
                }
                
                setLoading(false);
              } else {
                // Si no hay materias asignadas por este método, continuar con otros métodos
                console.log('⚠️ No se encontraron materias asignadas al estudiante');
              }
            },
            (err) => {
              console.error("❌ Error fetching school subjects:", err);
              setError(err);
              setLoading(false);
            }
          );

          // Si encontramos materias, retornar el unsubscribe
          const subjectsCheck = await getDocs(subjectsQuery);
          if (!subjectsCheck.empty) {
            return unsubscribeSubjects;
          }
        } catch (error) {
          console.log('⚠️ No se pudo acceder a schoolSubjects:', error);
        }

        // Método alternativo 2: Si tiene notebooks asignados, buscar las materias de esos notebooks
        if (userData.idCuadernos && userData.idCuadernos.length > 0 && !schoolSubjects?.length) {
          console.log('🔍 Buscando materias a través de notebooks asignados...');
          
          try {
            // Obtener los notebooks asignados
            const notebooksQuery = query(
              collection(db, 'schoolNotebooks'),
              where('__name__', 'in', userData.idCuadernos)
            );
            
            const notebooksSnapshot = await getDocs(notebooksQuery);
            const materiaIds = new Set<string>();
            const notebooksList: SchoolNotebook[] = [];
            
            notebooksSnapshot.docs.forEach(doc => {
              const data = doc.data();
              if (data.idMateria) {
                materiaIds.add(data.idMateria);
              }
              notebooksList.push({
                id: doc.id,
                ...data,
                color: data.color || '#6147FF'
              } as SchoolNotebook);
            });
            
            console.log('📚 IDs de materias encontradas desde notebooks:', Array.from(materiaIds));
            
            // Cargar las materias encontradas
            if (materiaIds.size > 0) {
              const materiasQuery = query(
                collection(db, 'schoolSubjects'),
                where('__name__', 'in', Array.from(materiaIds))
              );
              
              const materiasSnapshot = await getDocs(materiasQuery);
              const subjectsList = materiasSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              })) as SchoolSubject[];
              
              console.log('🏫 Materias cargadas a través de notebooks:', subjectsList.length);
              subjectsList.forEach(subject => {
                console.log('   -', subject.id, ':', subject.nombre);
              });
              
              setSchoolSubjects(subjectsList);
              setSchoolNotebooks(notebooksList);
              
              // Crear listener para cambios en las materias
              const unsubscribeMaterias = onSnapshot(
                materiasQuery,
                (snapshot) => {
                  const updatedSubjects = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                  })) as SchoolSubject[];
                  setSchoolSubjects(updatedSubjects);
                },
                (err) => {
                  console.error("❌ Error en listener de materias:", err);
                }
              );
              
              setLoading(false);
              return unsubscribeMaterias;
            }
          } catch (error) {
            console.error('❌ Error buscando materias desde notebooks:', error);
          }
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

  console.log('🎓 useSchoolStudentData - Retornando:', {
    schoolNotebooks: schoolNotebooks?.length || 0,
    schoolSubjects: schoolSubjects?.length || 0,
    loading,
    error
  });
  
  return { schoolNotebooks, schoolSubjects, loading, error };
};