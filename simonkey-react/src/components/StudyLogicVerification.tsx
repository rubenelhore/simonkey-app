import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { UserSubscriptionType, SchoolRole } from '../types/interfaces';
import '../styles/StudyLogicVerification.css';

interface User {
  id: string;
  email: string;
  nombre: string;
  displayName?: string;
  subscription: UserSubscriptionType;
}

interface SchoolUser {
  id: string;
  email: string;
  nombre: string;
  apellidos: string;
  role: 'admin' | 'teacher' | 'student';
  schoolId?: string;
  schoolName?: string;
}

interface Subject {
  id: string;
  nombre: string;
  idProfesor?: string;
}

interface Notebook {
  id: string;
  name?: string;
  title?: string;
  color: string;
  idMateria?: string;
  userId?: string;
}

interface Concept {
  id: string;
  termino: string;
  definicion: string;
  learningData?: {
    nextReviewDate?: any;
    lastReviewDate?: any;
    interval?: number;
    repetitions?: number;
    easeFactor?: number;
  };
}

const StudyLogicVerification: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [accountType, setAccountType] = useState<'pro' | 'free' | 'school' | ''>('');
  
  // Para cuentas escolares
  const [schoolAdmins, setSchoolAdmins] = useState<SchoolUser[]>([]);
  const [schoolTeachers, setSchoolTeachers] = useState<SchoolUser[]>([]);
  const [schoolStudents, setSchoolStudents] = useState<SchoolUser[]>([]);
  const [selectedAdmin, setSelectedAdmin] = useState<string>('');
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  
  // Para cuentas free/pro
  const [regularUsers, setRegularUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  
  // Datos comunes
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [selectedNotebook, setSelectedNotebook] = useState<string>('');
  const [concepts, setConcepts] = useState<Concept[]>([]);

  // Cargar usuarios según el tipo de cuenta
  useEffect(() => {
    if (!accountType) return;
    
    const loadUsers = async () => {
      setLoading(true);
      try {
        if (accountType === 'school') {
          // Cargar usuarios escolares desde la colección 'users'
          console.log('Loading school users from users collection...');
          
          // Cargar admins
          console.log('Searching for admins with subscription:', UserSubscriptionType.SCHOOL, 'and role:', SchoolRole.ADMIN);
          const adminsQuery = query(
            collection(db, 'users'),
            where('subscription', '==', UserSubscriptionType.SCHOOL),
            where('schoolRole', '==', SchoolRole.ADMIN)
          );
          const adminsSnap = await getDocs(adminsQuery);
          const adminsData = adminsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            role: 'admin'
          } as SchoolUser)).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
          console.log('Loaded admins:', adminsData.length);
          setSchoolAdmins(adminsData);

          // Cargar teachers
          console.log('Searching for teachers with subscription:', UserSubscriptionType.SCHOOL, 'and role:', SchoolRole.TEACHER);
          const teachersQuery = query(
            collection(db, 'users'),
            where('subscription', '==', UserSubscriptionType.SCHOOL),
            where('schoolRole', '==', SchoolRole.TEACHER)
          );
          const teachersSnap = await getDocs(teachersQuery);
          const teachersData = teachersSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            role: 'teacher'
          } as SchoolUser)).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
          console.log('Loaded teachers:', teachersData.length);
          setSchoolTeachers(teachersData);

          // Cargar students
          console.log('Searching for students with subscription:', UserSubscriptionType.SCHOOL, 'and role:', SchoolRole.STUDENT);
          const studentsQuery = query(
            collection(db, 'users'),
            where('subscription', '==', UserSubscriptionType.SCHOOL),
            where('schoolRole', '==', SchoolRole.STUDENT)
          );
          const studentsSnap = await getDocs(studentsQuery);
          const studentsData = studentsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            role: 'student'
          } as SchoolUser)).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
          console.log('Loaded students:', studentsData.length);
          setSchoolStudents(studentsData);
        } else {
          // Cargar usuarios regulares (free/pro)
          console.log('Loading regular users for type:', accountType);
          
          if (accountType === 'pro') {
            // Para Pro, incluir también SUPER_ADMIN
            const proQuery = query(
              collection(db, 'users'),
              where('subscription', '==', 'pro')
            );
            const proSnap = await getDocs(proQuery);
            
            const superAdminQuery = query(
              collection(db, 'users'),
              where('subscription', '==', UserSubscriptionType.SUPER_ADMIN)
            );
            const superAdminSnap = await getDocs(superAdminQuery);
            
            // Combinar resultados únicos
            const allUsers = new Map();
            proSnap.docs.forEach(doc => {
              allUsers.set(doc.id, { id: doc.id, ...doc.data() });
            });
            superAdminSnap.docs.forEach(doc => {
              allUsers.set(doc.id, { id: doc.id, ...doc.data() });
            });
            
            const usersData = Array.from(allUsers.values())
              .sort((a, b) => 
                ((a.nombre || a.displayName || a.email || '').localeCompare(
                  b.nombre || b.displayName || b.email || ''
                ))
              );
            console.log('Loaded Pro + SuperAdmin users:', usersData.length);
            setRegularUsers(usersData);
          } else {
            // Para Free, solo usuarios free
            const usersQuery = query(
              collection(db, 'users'),
              where('subscription', '==', accountType)
            );
            const usersSnap = await getDocs(usersQuery);
            const usersData = usersSnap.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            } as User)).sort((a, b) => 
              ((a.nombre || a.displayName || a.email || '').localeCompare(
                b.nombre || b.displayName || b.email || ''
              ))
            );
            console.log('Loaded users:', usersData.length);
            setRegularUsers(usersData);
          }
        }
      } catch (error) {
        console.error('Error loading users:', error);
        console.error('Error details:', {
          accountType,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [accountType]);

  // Cargar materias según la selección
  useEffect(() => {
    const loadSubjects = async () => {
      if (accountType === 'school' && selectedStudent) {
        setLoading(true);
        try {
          // Para estudiantes escolares, cargar materias asignadas
          const studentDoc = await getDoc(doc(db, 'schoolStudents', selectedStudent));
          const studentData = studentDoc.data();
          
          if (studentData?.subjectIds && studentData.subjectIds.length > 0) {
            const subjectsData: Subject[] = [];
            for (const subjectId of studentData.subjectIds) {
              const subjectDoc = await getDoc(doc(db, 'schoolSubjects', subjectId));
              if (subjectDoc.exists()) {
                subjectsData.push({
                  id: subjectDoc.id,
                  ...subjectDoc.data()
                } as Subject);
              }
            }
            setSubjects(subjectsData);
          }
        } catch (error) {
          console.error('Error loading subjects:', error);
        } finally {
          setLoading(false);
        }
      } else if ((accountType === 'free' || accountType === 'pro') && selectedUser) {
        // Para usuarios free/pro, no hay materias - cargar cuadernos directamente
        setSubjects([]); // No hay materias para usuarios free/pro
        // No llamar loadNotebooks aquí, se llamará en el siguiente useEffect
      }
    };

    loadSubjects();
  }, [selectedStudent, selectedUser, accountType]);

  // Cargar cuadernos
  const loadNotebooks = async () => {
    console.log('Loading notebooks for:', { accountType, selectedUser, selectedSubject });
    setLoading(true);
    try {
      let notebooksData: Notebook[] = [];
      
      if (accountType === 'school' && selectedSubject) {
        // Cargar cuadernos escolares de la materia seleccionada
        console.log('Loading school notebooks for subject:', selectedSubject);
        const notebooksQuery = query(
          collection(db, 'schoolNotebooks'),
          where('idMateria', '==', selectedSubject),
          orderBy('name')
        );
        const notebooksSnap = await getDocs(notebooksQuery);
        notebooksData = notebooksSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Notebook));
      } else if ((accountType === 'free' || accountType === 'pro') && selectedUser) {
        // Cargar cuadernos del usuario seleccionado
        console.log('Loading user notebooks for user:', selectedUser);
        
        // Primero, intentar sin ningún filtro para ver si hay notebooks
        const allNotebooksSnap = await getDocs(collection(db, 'notebooks'));
        console.log('Total notebooks in collection:', allNotebooksSnap.size);
        
        // Ahora filtrar por userId
        const notebooksQuery = query(
          collection(db, 'notebooks'),
          where('userId', '==', selectedUser)
        );
        const notebooksSnap = await getDocs(notebooksQuery);
        console.log('Found notebooks for user:', notebooksSnap.size);
        
        notebooksData = notebooksSnap.docs.map(doc => {
          const data = doc.data();
          console.log('Notebook data:', { id: doc.id, userId: data.userId, name: data.name || data.title, selectedUser });
          return {
            id: doc.id,
            ...data,
            name: data.name || data.title || 'Sin nombre' // Manejar tanto 'name' como 'title'
          } as Notebook;
        });
      }
      
      console.log('Loaded notebooks:', notebooksData.length);
      setNotebooks(notebooksData);
    } catch (error) {
      console.error('Error loading notebooks:', error);
      // Si el error es por orderBy, intentar sin él
      if (error instanceof Error && error.message.includes('orderBy')) {
        console.log('Retrying without orderBy...');
        try {
          let notebooksData: Notebook[] = [];
          
          if ((accountType === 'free' || accountType === 'pro') && selectedUser) {
            const notebooksQuery = query(
              collection(db, 'notebooks'),
              where('userId', '==', selectedUser)
            );
            const notebooksSnap = await getDocs(notebooksQuery);
            notebooksData = notebooksSnap.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            } as Notebook)).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          }
          
          setNotebooks(notebooksData);
        } catch (retryError) {
          console.error('Error on retry:', retryError);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSubject || ((accountType === 'free' || accountType === 'pro') && selectedUser)) {
      loadNotebooks();
    }
  }, [selectedSubject, selectedUser, accountType]);

  // Cargar conceptos del cuaderno seleccionado
  useEffect(() => {
    const loadConcepts = async () => {
      if (!selectedNotebook) return;
      
      console.log('Loading concepts for notebook:', selectedNotebook);
      setLoading(true);
      try {
        const notebookDoc = await getDoc(doc(
          db, 
          accountType === 'school' ? 'schoolNotebooks' : 'notebooks',
          selectedNotebook
        ));
        
        if (notebookDoc.exists()) {
          const notebookData = notebookDoc.data();
          console.log('Notebook data:', notebookData);
          
          // Verificar si los conceptos están en un array o necesitamos buscarlos de otra forma
          const conceptIds = notebookData.concepts || notebookData.conceptIds || [];
          console.log('Concept IDs from notebook:', conceptIds);
          
          // Si no hay conceptos en el notebook, buscar en la colección de conceptos
          if (conceptIds.length === 0) {
            console.log('No concept IDs in notebook, searching concepts by cuadernoId...');
            
            // Buscar conceptos que pertenezcan a este notebook
            const conceptsQuery = query(
              collection(db, accountType === 'school' ? 'schoolConcepts' : 'conceptos'),
              where('cuadernoId', '==', selectedNotebook)
            );
            const conceptsSnap = await getDocs(conceptsQuery);
            console.log('Found concept documents by cuadernoId:', conceptsSnap.size);
            console.log('Selected user/student ID:', selectedUser || selectedStudent);
            
            const conceptsData: Concept[] = [];
            for (const conceptDoc of conceptsSnap.docs) {
              const docData = conceptDoc.data();
              console.log('Concept document data:', { docId: conceptDoc.id, conceptos: docData.conceptos });
              
              // Each document contains an array of concepts
              if (docData.conceptos && Array.isArray(docData.conceptos)) {
                for (const concept of docData.conceptos) {
                  console.log('Individual concept:', { id: concept.id, termino: concept.término });
                  
                  // Buscar learningData para el concepto
                  let learningData = null;
                  const conceptId = concept.id || conceptDoc.id;
                  
                  if (selectedUser || selectedStudent) {
                    const userId = selectedUser || selectedStudent;
                    // Tanto para usuarios escolares como regulares, los datos están en users/{userId}/learningData/{conceptId}
                    try {
                      const learningDoc = await getDoc(
                        doc(db, 'users', userId, 'learningData', conceptId)
                      );
                      if (learningDoc.exists()) {
                        learningData = learningDoc.data();
                        console.log('Learning data found for concept:', conceptId, learningData);
                      } else {
                        console.log('No learning data found for concept:', conceptId);
                      }
                    } catch (error) {
                      console.error('Error fetching learning data:', error);
                    }
                  }
                  
                  conceptsData.push({
                    id: concept.id || conceptDoc.id,
                    termino: concept.termino || concept.término || 'Sin término',
                    definicion: concept.definicion || concept.definición || 'Sin definición',
                    learningData: learningData || undefined
                  });
                }
              }
            }
            
            // Ordenar por fecha de próximo estudio
            conceptsData.sort((a, b) => {
              const dateA = a.learningData?.nextReviewDate?.toDate?.() || new Date(0);
              const dateB = b.learningData?.nextReviewDate?.toDate?.() || new Date(0);
              return dateA.getTime() - dateB.getTime();
            });
            
            setConcepts(conceptsData);
          } else {
            // Código original para cuando hay IDs en el notebook
            const conceptsData: Concept[] = [];
            for (const conceptId of conceptIds) {
              const conceptDoc = await getDoc(doc(
                db,
                accountType === 'school' ? 'schoolConcepts' : 'conceptos',
                conceptId
              ));
              
              if (conceptDoc.exists()) {
                const conceptData = conceptDoc.data();
                
                let learningData = null;
                if (accountType === 'school' && selectedStudent) {
                  const learningDoc = await getDoc(
                    doc(db, 'users', selectedStudent, 'learningData', conceptId)
                  );
                  if (learningDoc.exists()) {
                    learningData = learningDoc.data();
                  }
                } else if (accountType !== 'school' && selectedUser) {
                  learningData = conceptData.learningData?.[selectedUser];
                }
                
                conceptsData.push({
                  id: conceptDoc.id,
                  termino: conceptData.termino || conceptData.término || 'Sin término',
                  definicion: conceptData.definicion || conceptData.definición || 'Sin definición',
                  learningData: learningData
                });
              }
            }
            
            conceptsData.sort((a, b) => {
              const dateA = a.learningData?.nextReviewDate?.toDate?.() || new Date(0);
              const dateB = b.learningData?.nextReviewDate?.toDate?.() || new Date(0);
              return dateA.getTime() - dateB.getTime();
            });
            
            setConcepts(conceptsData);
          }
        } else {
          console.log('Notebook document does not exist!');
        }
      } catch (error) {
        console.error('Error loading concepts:', error);
      } finally {
        setLoading(false);
      }
    };

    loadConcepts();
  }, [selectedNotebook, selectedStudent, selectedUser, accountType]);

  const formatDate = (dateValue: any): string => {
    if (!dateValue) return 'Sin fecha';
    
    try {
      let date: Date;
      if (dateValue.toDate) {
        date = dateValue.toDate();
      } else if (dateValue instanceof Date) {
        date = dateValue;
      } else {
        return 'Fecha inválida';
      }
      
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      return 'Error en fecha';
    }
  };

  const getStudyStatus = (learningData: any): string => {
    if (!learningData || !learningData.nextReviewDate) {
      return 'nuevo';
    }
    
    const nextReview = learningData.nextReviewDate.toDate?.() || learningData.nextReviewDate;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    nextReview.setHours(0, 0, 0, 0);
    
    if (nextReview <= today) {
      return 'pendiente';
    } else {
      return 'programado';
    }
  };

  return (
    <div className="study-logic-verification">
      {/* Selector de tipo de cuenta */}
      <div className="verification-section">
        <h3>Tipo de Cuenta</h3>
        <div className="account-type-selector">
          <button
            className={`type-button ${accountType === 'pro' ? 'active' : ''}`}
            onClick={() => {
              setAccountType('pro');
              // Reset selections
              setSelectedUser('');
              setSelectedAdmin('');
              setSelectedTeacher('');
              setSelectedStudent('');
              setSelectedSubject('');
              setSelectedNotebook('');
              setConcepts([]);
            }}
          >
            <i className="fas fa-crown"></i> Pro
          </button>
          <button
            className={`type-button ${accountType === 'free' ? 'active' : ''}`}
            onClick={() => {
              setAccountType('free');
              // Reset selections
              setSelectedUser('');
              setSelectedAdmin('');
              setSelectedTeacher('');
              setSelectedStudent('');
              setSelectedSubject('');
              setSelectedNotebook('');
              setConcepts([]);
            }}
          >
            <i className="fas fa-user"></i> Free
          </button>
          <button
            className={`type-button ${accountType === 'school' ? 'active' : ''}`}
            onClick={() => {
              setAccountType('school');
              // Reset selections
              setSelectedUser('');
              setSelectedAdmin('');
              setSelectedTeacher('');
              setSelectedStudent('');
              setSelectedSubject('');
              setSelectedNotebook('');
              setConcepts([]);
            }}
          >
            <i className="fas fa-school"></i> Escolar
          </button>
        </div>
      </div>

      {/* Selectores condicionales según tipo de cuenta */}
      {accountType === 'school' && (
        <div className="verification-section">
          <h3>Usuarios Escolares</h3>
          <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
            Admins: {schoolAdmins.length} | Profesores: {schoolTeachers.length} | Estudiantes: {schoolStudents.length}
          </p>
          <div className="school-selectors">
            <div className="selector-group">
              <label>Administrador</label>
              <select
                value={selectedAdmin}
                onChange={(e) => setSelectedAdmin(e.target.value)}
                className="form-select"
              >
                <option value="">Seleccionar admin...</option>
                {schoolAdmins.map(admin => (
                  <option key={admin.id} value={admin.id}>
                    {admin.nombre || admin.email || 'Sin nombre'} {admin.apellidos || ''} - {admin.schoolName || 'Sin escuela'}
                  </option>
                ))}
              </select>
            </div>

            <div className="selector-group">
              <label>Profesor</label>
              <select
                value={selectedTeacher}
                onChange={(e) => setSelectedTeacher(e.target.value)}
                className="form-select"
              >
                <option value="">Seleccionar profesor...</option>
                {schoolTeachers.map(teacher => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.nombre || teacher.email || 'Sin nombre'} {teacher.apellidos || ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="selector-group">
              <label>Estudiante *</label>
              <select
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                className="form-select"
                required
              >
                <option value="">Seleccionar estudiante...</option>
                {schoolStudents.map(student => (
                  <option key={student.id} value={student.id}>
                    {student.nombre || student.email || 'Sin nombre'} {student.apellidos || ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {(accountType === 'free' || accountType === 'pro') && (
        <div className="verification-section">
          <h3>Usuario</h3>
          <div className="selector-group">
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="form-select"
            >
              <option value="">Seleccionar usuario...</option>
              {regularUsers.map(user => (
                <option key={user.id} value={user.id}>
                  {user.nombre || user.displayName || user.email} - {user.email} {user.subscription === UserSubscriptionType.SUPER_ADMIN ? '(Super Admin)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Selector de materia (solo para escolares) */}
      {accountType === 'school' && selectedStudent && subjects.length > 0 && (
        <div className="verification-section">
          <h3>Materia</h3>
          <div className="selector-group">
            <select
              value={selectedSubject}
              onChange={(e) => {
                setSelectedSubject(e.target.value);
                setSelectedNotebook('');
                setConcepts([]);
              }}
              className="form-select"
            >
              <option value="">Seleccionar materia...</option>
              {subjects.map(subject => (
                <option key={subject.id} value={subject.id}>
                  {subject.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Selector de cuaderno */}
      {((accountType === 'school' && selectedSubject) || 
        ((accountType === 'free' || accountType === 'pro') && selectedUser)) && (
        <div className="verification-section">
          <h3>Cuaderno</h3>
          {notebooks.length > 0 ? (
            <div className="selector-group">
              <select
                value={selectedNotebook}
                onChange={(e) => setSelectedNotebook(e.target.value)}
                className="form-select"
              >
                <option value="">Seleccionar cuaderno...</option>
                {notebooks.map(notebook => (
                  <option key={notebook.id} value={notebook.id}>
                    {notebook.name || notebook.title || 'Sin nombre'}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p style={{ color: '#666', fontStyle: 'italic' }}>
              {loading ? 'Cargando cuadernos...' : 'No se encontraron cuadernos para este usuario'}
            </p>
          )}
        </div>
      )}

      {/* Lista de conceptos con fechas de estudio */}
      {selectedNotebook && (
        <div className="verification-section">
          <h3>Conceptos y Fechas de Estudio</h3>
          {concepts.length > 0 ? (
            <>
              <div className="concepts-table">
                <table>
                  <thead>
                    <tr>
                      <th>Concepto</th>
                      <th>ID</th>
                      <th>Próximo Estudio</th>
                      <th>Estado</th>
                      <th>Intervalo</th>
                      <th>Repeticiones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {concepts.map(concept => {
                      const status = getStudyStatus(concept.learningData);
                      return (
                        <tr key={concept.id} className={`status-${status}`}>
                          <td className="concept-name">{concept.termino}</td>
                          <td className="concept-id">{concept.id}</td>
                          <td className="next-study-date">
                            {formatDate(concept.learningData?.nextReviewDate)}
                          </td>
                          <td className="study-status">
                            <span className={`status-badge ${status}`}>
                              {status === 'nuevo' ? 'Nuevo' : 
                               status === 'pendiente' ? 'Pendiente' : 
                               'Programado'}
                            </span>
                          </td>
                          <td className="interval">
                            {concept.learningData?.interval || 0} días
                          </td>
                          <td className="repetitions">
                            {concept.learningData?.repetitions || 0}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              <div className="concepts-summary">
                <p>Total de conceptos: <strong>{concepts.length}</strong></p>
                <p>Pendientes hoy: <strong>
                  {concepts.filter(c => getStudyStatus(c.learningData) === 'pendiente').length}
                </strong></p>
                <p>Nuevos: <strong>
                  {concepts.filter(c => getStudyStatus(c.learningData) === 'nuevo').length}
                </strong></p>
              </div>
            </>
          ) : (
            <p style={{ color: '#666', fontStyle: 'italic', textAlign: 'center', padding: '2rem' }}>
              {loading ? 'Cargando conceptos...' : 'No se encontraron conceptos en este cuaderno'}
            </p>
          )}
        </div>
      )}

      {loading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Cargando datos...</p>
        </div>
      )}
    </div>
  );
};

export default StudyLogicVerification;