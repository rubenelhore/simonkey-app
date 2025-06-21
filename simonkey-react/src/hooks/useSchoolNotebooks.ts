import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { SchoolNotebook, SchoolTeacher, SchoolClassroom, SchoolAdmin } from '../types/interfaces';
import { useAuth } from '../contexts/AuthContext';

export const useSchoolNotebooks = () => {
  const [schoolNotebooks, setSchoolNotebooks] = useState<SchoolNotebook[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user, userProfile } = useAuth();

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

        // 1. Obtener el idAdmin del profesor desde la colección schoolTeachers
        const teacherQuery = query(
          collection(db, 'schoolTeachers'),
          where('id', '==', user.uid)
        );
        const teacherSnapshot = await getDocs(teacherQuery);
        console.log('🔍 teacherSnapshot.size:', teacherSnapshot.size);
        
        if (teacherSnapshot.empty) {
          console.log('❌ No se encontró información del profesor en schoolTeachers para UID:', user.uid);
          setSchoolNotebooks([]);
          setLoading(false);
          return undefined;
        }

        const teacherData = teacherSnapshot.docs[0].data() as SchoolTeacher;
        console.log('👨‍🏫 Datos del profesor:', teacherData);
        
        if (!teacherData.idAdmin) {
          console.log('❌ Profesor no tiene idAdmin asignado');
          setSchoolNotebooks([]);
          setLoading(false);
          return undefined;
        }

        console.log('🔗 Profesor vinculado al admin:', teacherData.idAdmin);

        // 2. Obtener el idInstitucion del admin
        const adminQuery = query(
          collection(db, 'schoolAdmins'),
          where('id', '==', teacherData.idAdmin)
        );
        const adminSnapshot = await getDocs(adminQuery);
        console.log('🔍 adminSnapshot.size:', adminSnapshot.size);
        
        if (adminSnapshot.empty) {
          console.log('❌ No se encontró información del admin para idAdmin:', teacherData.idAdmin);
          setSchoolNotebooks([]);
          setLoading(false);
          return undefined;
        }

        const adminData = adminSnapshot.docs[0].data() as SchoolAdmin;
        console.log('👨‍💼 Datos del admin:', adminData);
        
        if (!adminData.idInstitucion) {
          console.log('❌ Admin no tiene idInstitucion asignado');
          setSchoolNotebooks([]);
          setLoading(false);
          return undefined;
        }

        console.log('🏫 Admin vinculado a la institución:', adminData.idInstitucion);

        // 3. Obtener los salones asignados al profesor
        const classroomQuery = query(
          collection(db, 'schoolClassrooms'),
          where('idProfesor', '==', user.uid)
        );
        const classroomSnapshot = await getDocs(classroomQuery);
        console.log('🔍 classroomSnapshot.size:', classroomSnapshot.size);
        classroomSnapshot.forEach(doc => {
          console.log('🔍 classroomDoc:', doc.id, doc.data());
        });
        
        if (classroomSnapshot.empty) {
          console.log('❌ No se encontraron salones asignados al profesor');
          setSchoolNotebooks([]);
          setLoading(false);
          return undefined;
        }

        const classroomIds = classroomSnapshot.docs.map(doc => doc.id);
        console.log('🏫 Salones encontrados:', classroomIds);

        // 4. Obtener los cuadernos de esos salones
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
  }, [user, userProfile]);

  return { schoolNotebooks, loading, error };
}; 