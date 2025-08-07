import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where,
  onSnapshot
} from 'firebase/firestore';
import { Notebook, SchoolSubject } from '../types/interfaces';

interface UseSchoolStudentDataReturn {
  schoolNotebooks: Notebook[];
  schoolSubjects: SchoolSubject[];
  loading: boolean;
  error: Error | null;
}

export const useSchoolStudentData = (): UseSchoolStudentDataReturn => {
  const { user, userProfile } = useAuth();
  const [schoolNotebooks, setSchoolNotebooks] = useState<Notebook[]>([]);
  const [schoolSubjects, setSchoolSubjects] = useState<SchoolSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Logs comentados para reducir ruido
    // console.log('🔄 useSchoolStudentData - useEffect ejecutado');
    // console.log('👤 useSchoolStudentData - user:', user);
    // console.log('👤 useSchoolStudentData - userProfile:', userProfile);
    
    if (!user || !userProfile) {
      // console.log('❌ useSchoolStudentData - No hay usuario autenticado o perfil no cargado');
      setLoading(false);
      return;
    }

    const loadSchoolStudentData = async () => {
      try {
        setLoading(true);
        // console.log('🚀 === INICIANDO CARGA DE DATOS DEL ESTUDIANTE ===');
        // console.log('👤 Usuario ID:', userProfile.id || user.uid);
        // console.log('👤 Perfil del usuario:', userProfile);

        // Verificar que sea un estudiante escolar
        if (userProfile.subscription !== 'school' || userProfile.schoolRole !== 'student') {
          // console.log('⚠️ El usuario no es un estudiante escolar');
          setSchoolNotebooks([]);
          setSchoolSubjects([]);
          setLoading(false);
          return;
        }

        // console.log('✅ Usuario confirmado como estudiante escolar');
        // console.log('📚 subjectIds del estudiante:', userProfile.subjectIds);
        // console.log('📚 idCuadernos del estudiante:', userProfile.idCuadernos);

        // 1. Cargar las materias asignadas usando subjectIds
        if (userProfile.subjectIds && userProfile.subjectIds.length > 0) {
          // console.log('🎯 Cargando materias desde subjectIds:', userProfile.subjectIds);
          
          // Cargar cada materia individualmente por ID
          const subjectPromises = userProfile.subjectIds.map(async (subjectId: string) => {
            const subjectDoc = await getDoc(doc(db, 'schoolSubjects', subjectId));
            if (subjectDoc.exists()) {
              return {
                id: subjectDoc.id,
                ...subjectDoc.data()
              } as SchoolSubject;
            }
            return null;
          });
          
          const subjectsResults = await Promise.all(subjectPromises);
          const subjectsList = subjectsResults.filter(subject => subject !== null) as SchoolSubject[];
          
          // console.log('🏫 Materias cargadas:', subjectsList.length);
          // subjectsList.forEach(subject => {
          //   console.log('   -', subject.id, ':', subject.nombre);
          // });
          
          setSchoolSubjects(subjectsList);
        } else {
          // console.log('⚠️ El estudiante no tiene materias asignadas (subjectIds vacío)');
          setSchoolSubjects([]);
        }

        // 2. Cargar TODOS los cuadernos de las materias asignadas al estudiante
        // Cambio importante: Ya no solo cargamos idCuadernos, sino todos los cuadernos de las materias
        if (userProfile.subjectIds && userProfile.subjectIds.length > 0) {
          console.log('📖 Cargando cuadernos de las materias asignadas:', userProfile.subjectIds);
          
          // Cargar todos los cuadernos que pertenecen a las materias del estudiante
          const notebooksQuery = query(
            collection(db, 'schoolNotebooks'),
            where('idMateria', 'in', userProfile.subjectIds)
          );
          
          const notebooksSnapshot = await getDocs(notebooksQuery);
          const notebooksList: Notebook[] = [];
          
          // Procesar cada notebook y contar sus conceptos
          for (const doc of notebooksSnapshot.docs) {
            const data = doc.data();
            
            // Contar conceptos del notebook
            let conceptCount = 0;
            try {
              const conceptsSnapshot = await getDocs(
                query(collection(db, 'schoolConcepts'), where('cuadernoId', '==', doc.id))
              );
              conceptCount = conceptsSnapshot.size;
              console.log(`📊 Notebook ${doc.id} tiene ${conceptCount} conceptos`);
            } catch (error) {
              console.error(`Error contando conceptos para notebook ${doc.id}:`, error);
              conceptCount = data.conceptCount || 0; // Usar el valor existente si hay error
            }
            
            notebooksList.push({
              id: doc.id,
              ...data,
              title: data.title || data.titulo || 'Sin título',
              color: data.color || '#6147FF',
              type: 'school' as const,
              conceptCount: conceptCount // Asegurar que siempre tenga conceptCount
            } as Notebook);
          }
          
          console.log('📚 Cuadernos escolares cargados:', notebooksList.length);
          notebooksList.forEach(notebook => {
            console.log('   -', notebook.id, ':', notebook.title);
          });
          
          setSchoolNotebooks(notebooksList);
          setLoading(false);
          
          // También cargar los cuadernos específicos en idCuadernos si existen y no están ya incluidos
          if (userProfile.idCuadernos && userProfile.idCuadernos.length > 0) {
            console.log('📖 También verificando cuadernos específicos en idCuadernos:', userProfile.idCuadernos);
            
            const additionalNotebooks = userProfile.idCuadernos.filter(
              notebookId => !notebooksList.find(nb => nb.id === notebookId)
            );
            
            if (additionalNotebooks.length > 0) {
              const additionalPromises = additionalNotebooks.map(async (notebookId: string) => {
                const notebookDoc = await getDoc(doc(db, 'schoolNotebooks', notebookId));
                if (notebookDoc.exists()) {
                  const data = notebookDoc.data();
                  
                  // Contar conceptos del notebook
                  let conceptCount = 0;
                  try {
                    const conceptsSnapshot = await getDocs(
                      query(collection(db, 'schoolConcepts'), where('cuadernoId', '==', notebookId))
                    );
                    conceptCount = conceptsSnapshot.size;
                  } catch (error) {
                    console.error(`Error contando conceptos para notebook ${notebookId}:`, error);
                    conceptCount = data.conceptCount || 0;
                  }
                  
                  return {
                    id: notebookDoc.id,
                    ...data,
                    title: data.title || data.titulo || 'Sin título',
                    color: data.color || '#6147FF',
                    type: 'school' as const,
                    conceptCount: conceptCount
                  } as Notebook;
                }
                return null;
              });
              
              const additionalResults = await Promise.all(additionalPromises);
              const validAdditional = additionalResults.filter((nb): nb is Notebook => nb !== null);
              
              if (validAdditional.length > 0) {
                console.log('📚 Cuadernos adicionales encontrados:', validAdditional.length);
                setSchoolNotebooks([...notebooksList, ...validAdditional]);
              }
            }
          }
        } else {
          console.log('⚠️ El estudiante no tiene materias asignadas');
          setSchoolNotebooks([]);
          setLoading(false);
        }

      } catch (err) {
        // console.error("❌ Error loading school student data:", err);
        setError(err as Error);
        setLoading(false);
      }
    };

    loadSchoolStudentData();
  }, [user, userProfile]);

  return { schoolNotebooks, schoolSubjects, loading, error };
};