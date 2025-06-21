import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
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
          console.log('💡 El profesor necesita ser registrado por un administrador escolar');
          setSchoolNotebooks([]);
          setLoading(false);
          return undefined;
        }

        const teacherData = teacherSnapshot.docs[0].data() as SchoolTeacher;
        console.log('👨‍🏫 Datos del profesor:', teacherData);
        
        if (!teacherData.idAdmin) {
          console.log('⚠️ Profesor no tiene admin asignado - necesita ser vinculado por un administrador');
          setSchoolNotebooks([]);
          setLoading(false);
          return undefined;
        }

        console.log('🔗 Profesor vinculado al admin:', teacherData.idAdmin);

        // 2. Obtener el idInstitucion del admin
        console.log('🔍 Ejecutando query para schoolAdmins con idAdmin:', teacherData.idAdmin);
        
        // Primero intentar buscar por el campo 'id'
        let adminQuery = query(
          collection(db, 'schoolAdmins'),
          where('id', '==', teacherData.idAdmin)
        );
        let adminSnapshot = await getDocs(adminQuery);
        console.log('🔍 adminSnapshot.size (buscando por campo id):', adminSnapshot.size);
        
        // Si no se encuentra, intentar buscar por el ID del documento
        if (adminSnapshot.empty) {
          console.log('🔍 Intentando buscar por ID del documento...');
          try {
            const adminDocRef = doc(db, 'schoolAdmins', teacherData.idAdmin);
            const adminDoc = await getDoc(adminDocRef);
            
            if (adminDoc.exists()) {
              console.log('✅ Admin encontrado por ID del documento:', adminDoc.id);
              const adminData = adminDoc.data() as SchoolAdmin;
              
              if (!adminData.idInstitucion) {
                console.log('❌ Admin no tiene idInstitucion asignado');
                setSchoolNotebooks([]);
                setLoading(false);
                return undefined;
              }
              
              console.log('🏫 Admin vinculado a la institución:', adminData.idInstitucion);
              
              // Continuar con el resto del proceso...
              // 3. Obtener los salones asignados al profesor
              console.log('🔍 Ejecutando query para schoolClassrooms con idProfesor:', user.uid);
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
                console.log('🔍 Intentando buscar todos los classrooms disponibles...');
                
                try {
                  const allClassroomsQuery = query(collection(db, 'schoolClassrooms'));
                  const allClassroomsSnapshot = await getDocs(allClassroomsQuery);
                  console.log('🔍 Total de classrooms en la base de datos:', allClassroomsSnapshot.size);
                  allClassroomsSnapshot.forEach(doc => {
                    const data = doc.data();
                    console.log('   - Classroom ID:', doc.id, 'idProfesor:', data.idProfesor, 'Data:', data);
                  });
                } catch (classroomError) {
                  console.error('❌ Error buscando todos los classrooms:', classroomError);
                }
                
                setSchoolNotebooks([]);
                setLoading(false);
                return undefined;
              }

              const classroomIds = classroomSnapshot.docs.map(doc => doc.id);
              console.log('🏫 Salones encontrados (IDs de documento):', classroomIds);
              
              // También mostrar el campo idSalon de cada classroom
              const classroomSalonIds = classroomSnapshot.docs.map(doc => {
                const data = doc.data();
                console.log(`   - Classroom ${doc.id}: idSalon = ${data.idSalon}`);
                return data.idSalon;
              }).filter(id => id); // Filtrar valores undefined/null
              
              console.log('🏫 Salones encontrados (campo idSalon):', classroomSalonIds);

              // 4. Obtener los cuadernos de esos salones
              if (classroomSalonIds.length > 0) {
                console.log('🔍 Ejecutando query para schoolNotebooks con idSalon:', classroomSalonIds);
                const notebooksQuery = query(
                  collection(db, 'schoolNotebooks'),
                  where('idSalon', 'in', classroomSalonIds)
                  // orderBy('createdAt', 'desc') // Comentado temporalmente mientras se construye el índice
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
              } else {
                setSchoolNotebooks([]);
                setLoading(false);
                return undefined;
              }
            } else {
              console.log('❌ No se encontró información del admin para idAdmin:', teacherData.idAdmin);
              console.log('🔍 Intentando buscar todos los admins disponibles...');
              
              try {
                const allAdminsQuery = query(collection(db, 'schoolAdmins'));
                const allAdminsSnapshot = await getDocs(allAdminsQuery);
                console.log('🔍 Total de admins en la base de datos:', allAdminsSnapshot.size);
                allAdminsSnapshot.forEach(doc => {
                  console.log('   - Admin ID:', doc.id, 'Data:', doc.data());
                });
              } catch (adminError) {
                console.error('❌ Error buscando todos los admins:', adminError);
              }
              
              setSchoolNotebooks([]);
              setLoading(false);
              return undefined;
            }
          } catch (adminError) {
            console.error('❌ Error buscando todos los admins:', adminError);
            setSchoolNotebooks([]);
            setLoading(false);
            return undefined;
          }
        } else {
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
          console.log('🔍 Ejecutando query para schoolClassrooms con idProfesor:', user.uid);
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
            console.log('🔍 Intentando buscar todos los classrooms disponibles...');
            
            try {
              const allClassroomsQuery = query(collection(db, 'schoolClassrooms'));
              const allClassroomsSnapshot = await getDocs(allClassroomsQuery);
              console.log('🔍 Total de classrooms en la base de datos:', allClassroomsSnapshot.size);
              allClassroomsSnapshot.forEach(doc => {
                const data = doc.data();
                console.log('   - Classroom ID:', doc.id, 'idProfesor:', data.idProfesor, 'Data:', data);
              });
            } catch (classroomError) {
              console.error('❌ Error buscando todos los classrooms:', classroomError);
            }
            
            setSchoolNotebooks([]);
            setLoading(false);
            return undefined;
          }

          const classroomIds = classroomSnapshot.docs.map(doc => doc.id);
          console.log('🏫 Salones encontrados (IDs de documento):', classroomIds);
          
          // También mostrar el campo idSalon de cada classroom
          const classroomSalonIds = classroomSnapshot.docs.map(doc => {
            const data = doc.data();
            console.log(`   - Classroom ${doc.id}: idSalon = ${data.idSalon}`);
            return data.idSalon;
          }).filter(id => id); // Filtrar valores undefined/null
          
          console.log('🏫 Salones encontrados (campo idSalon):', classroomSalonIds);

          // 4. Obtener los cuadernos de esos salones
          if (classroomSalonIds.length > 0) {
            console.log('🔍 Ejecutando query para schoolNotebooks con idSalon:', classroomSalonIds);
            const notebooksQuery = query(
              collection(db, 'schoolNotebooks'),
              where('idSalon', 'in', classroomSalonIds)
              // orderBy('createdAt', 'desc') // Comentado temporalmente mientras se construye el índice
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
          } else {
            setSchoolNotebooks([]);
            setLoading(false);
            return undefined;
          }
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