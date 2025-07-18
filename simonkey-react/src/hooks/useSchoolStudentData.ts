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

        // 2. Cargar los cuadernos asignados
        if (userProfile.idCuadernos && userProfile.idCuadernos.length > 0) {
          // console.log('📖 Cargando cuadernos desde idCuadernos:', userProfile.idCuadernos);
          
          // Cargar cada cuaderno individualmente por ID
          const notebookPromises = userProfile.idCuadernos.map(async (notebookId: string) => {
            const notebookDoc = await getDoc(doc(db, 'schoolNotebooks', notebookId));
            if (notebookDoc.exists()) {
              return {
                id: notebookDoc.id,
                ...notebookDoc.data(),
                color: notebookDoc.data().color || '#6147FF',
                type: 'school' as const
              } as Notebook;
            }
            return null;
          });
          
          const notebooksResults = await Promise.all(notebookPromises);
          const notebooksList = notebooksResults.filter((notebook): notebook is Notebook => notebook !== null);
          
          // console.log('📚 Cuadernos escolares cargados:', notebooksList.length);
          // notebooksList.forEach(notebook => {
          //   console.log('   -', notebook.id, ':', notebook.title);
          // });
          
          setSchoolNotebooks(notebooksList);
          setLoading(false);
        } else {
          // console.log('⚠️ El estudiante no tiene cuadernos asignados (idCuadernos vacío)');
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