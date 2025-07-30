import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { 
  collection, 
  getDocs, 
  query, 
  where,
  orderBy 
} from 'firebase/firestore';
import { 
  SchoolInstitution,
  SchoolAdmin,
  SchoolTeacher,
  SchoolSubject,
  Notebook,
  SchoolStudent,
  SchoolTutor,
  UserSubscriptionType,
  SchoolRole
} from '../types/interfaces';
import '../styles/SchoolLinkingVerification.css';

interface SchoolLinkingVerificationProps {
  onRefresh?: () => void;
}

interface SelectionState {
  institution: SchoolInstitution | null;
  admin: SchoolAdmin | null;
  teacher: SchoolTeacher | null;
  subject: SchoolSubject | null;
  student: SchoolStudent | null;
  tutor: SchoolTutor | null;
}

interface EntityCounts {
  institutions: number;
  admins: number;
  teachers: number;
  subjects: number;
  notebooks: number;
  students: number;
  tutors: number;
}

const SchoolLinkingVerification: React.FC<SchoolLinkingVerificationProps> = ({ onRefresh }) => {
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState<SelectionState>({
    institution: null,
    admin: null,
    teacher: null,
    subject: null,
    student: null,
    tutor: null
  });
  
  const [availableOptions, setAvailableOptions] = useState<{
    institutions: SchoolInstitution[];
    admins: SchoolAdmin[];
    teachers: SchoolTeacher[];
    subjects: SchoolSubject[];
    notebooks: Notebook[];
    students: SchoolStudent[];
    tutors: SchoolTutor[];
  }>({
    institutions: [],
    admins: [],
    teachers: [],
    subjects: [],
    notebooks: [],
    students: [],
    tutors: []
  });

  const [entityCounts, setEntityCounts] = useState<EntityCounts>({
    institutions: 0,
    admins: 0,
    teachers: 0,
    subjects: 0,
    notebooks: 0,
    students: 0,
    tutors: 0
  });

  // Cargar datos iniciales
  useEffect(() => {
    loadInitialData();
  }, []);

  // Cargar opciones filtradas cuando cambia la selección
  useEffect(() => {
    loadFilteredOptions();
  }, [selection]);

  // Función helper para buscar usuarios escolares con ambas variaciones de case
  const loadSchoolUsersByRole = async (role: string) => {
    const roleLower = role.toLowerCase();
    const roleUpper = role.toUpperCase();
    
    // Buscar con minúsculas
    const queryLower = query(
      collection(db, 'users'),
      where('subscription', '==', 'school'),
      where('schoolRole', '==', roleLower)
    );
    const snapshotLower = await getDocs(queryLower);
    
    // Buscar con mayúsculas
    const queryUpper = query(
      collection(db, 'users'),
      where('subscription', '==', 'SCHOOL'),
      where('schoolRole', '==', roleUpper)
    );
    const snapshotUpper = await getDocs(queryUpper);
    
    // Combinar resultados
    const usersMap = new Map();
    snapshotLower.docs.forEach(doc => {
      usersMap.set(doc.id, { id: doc.id, ...doc.data() });
    });
    snapshotUpper.docs.forEach(doc => {
      usersMap.set(doc.id, { id: doc.id, ...doc.data() });
    });
    
    return Array.from(usersMap.values());
  };

  const loadInitialData = async () => {
    setLoading(true);
    try {
      console.log('🔍 Iniciando carga de datos de vinculación escolar...');
      
      // Primero, ejecutar diagnóstico
      await runDiagnostics();
      
      // Cargar todas las instituciones
      console.log('🏫 Cargando instituciones...');
      const institutionsSnapshot = await getDocs(collection(db, 'schoolInstitutions'));
      console.log(`📊 Instituciones encontradas: ${institutionsSnapshot.size}`);
      const institutions = institutionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SchoolInstitution[];
      console.log('🏫 Instituciones cargadas:', institutions);

      // Cargar todos los administradores
      console.log('👨‍💼 Cargando administradores...');
      const admins = await loadSchoolUsersByRole('admin') as SchoolAdmin[];
      console.log(`👨‍💼 Administradores encontrados: ${admins.length}`);

      // Cargar todos los profesores
      console.log('👨‍🏫 Cargando profesores...');
      const teachers = await loadSchoolUsersByRole('teacher') as SchoolTeacher[];
      console.log(`👨‍🏫 Profesores encontrados: ${teachers.length}`);

      // Cargar todas las materias
      console.log('📚 Cargando materias...');
      const subjectsSnapshot = await getDocs(collection(db, 'schoolSubjects'));
      console.log(`📊 Materias encontradas: ${subjectsSnapshot.size}`);
      const subjects = subjectsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SchoolSubject[];
      console.log('📚 Materias cargadas:', subjects);

      // Cargar todos los cuadernos
      console.log('📓 Cargando cuadernos...');
      const notebooksSnapshot = await getDocs(collection(db, 'schoolNotebooks'));
      console.log(`📊 Cuadernos encontrados: ${notebooksSnapshot.size}`);
      const notebooks = notebooksSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notebook[];
      console.log('📓 Cuadernos cargados:', notebooks);

      // Cargar todos los estudiantes
      console.log('👨‍🎓 Cargando estudiantes...');
      const students = await loadSchoolUsersByRole('student') as SchoolStudent[];
      console.log(`👨‍🎓 Estudiantes encontrados: ${students.length}`);

      // Cargar todos los tutores
      console.log('👨‍👩‍👧‍👦 Cargando tutores...');
      const tutors = await loadSchoolUsersByRole('tutor') as SchoolTutor[];
      console.log(`👨‍👩‍👧‍👦 Tutores encontrados: ${tutors.length}`);

      setAvailableOptions({
        institutions,
        admins,
        teachers,
        subjects,
        notebooks,
        students,
        tutors
      });

      setEntityCounts({
        institutions: institutions.length,
        admins: admins.length,
        teachers: teachers.length,
        subjects: subjects.length,
        notebooks: notebooks.length,
        students: students.length,
        tutors: tutors.length
      });

      console.log('✅ Datos cargados exitosamente');
      console.log('📊 Resumen de datos cargados:', {
        instituciones: institutions.length,
        admins: admins.length,
        profesores: teachers.length,
        materias: subjects.length,
        cuadernos: notebooks.length,
        estudiantes: students.length,
        tutores: tutors.length
      });
      
    } catch (error: any) {
      console.error('❌ Error cargando datos iniciales:', error);
      console.error('❌ Detalles del error:', {
        code: error.code,
        message: error.message,
        details: error
      });
      
      // Si es un error de permisos, mostrar más información
      if (error.code === 'permission-denied') {
        console.error('❌ Error de permisos. Verifica que el usuario tenga permisos de SuperAdmin');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadFilteredOptions = async () => {
    try {
      let filteredAdmins = availableOptions.admins;
      let filteredTeachers = availableOptions.teachers;
      let filteredSubjects = availableOptions.subjects;
      let filteredNotebooks = availableOptions.notebooks;
      let filteredStudents = availableOptions.students;
      let filteredTutors = availableOptions.tutors;

      // Filtrar administradores por institución seleccionada
      if (selection.institution) {
        filteredAdmins = availableOptions.admins.filter(admin => 
          admin.idInstitucion === selection.institution!.id
        );
      }

      // Filtrar profesores por administrador seleccionado
      if (selection.admin) {
        filteredTeachers = availableOptions.teachers.filter(teacher => 
          teacher.idAdmin === selection.admin!.id
        );
      }

      // Filtrar materias por profesor seleccionado
      if (selection.teacher) {
        filteredSubjects = availableOptions.subjects.filter(subject => 
          subject.idProfesor === selection.teacher!.id
        );
      }

      // Filtrar cuadernos por materia seleccionada
      if (selection.subject) {
        filteredNotebooks = availableOptions.notebooks.filter(notebook => 
          notebook.idMateria === selection.subject!.id
        );
      }

      // Filtrar estudiantes por materia seleccionada
      if (selection.subject) {
        filteredStudents = availableOptions.students.filter(student => 
          student.subjectIds && student.subjectIds.includes(selection.subject!.id)
        );
      }

      // Filtrar tutores por estudiantes seleccionados
      if (selection.student) {
        filteredTutors = availableOptions.tutors.filter(tutor => 
          tutor.idAlumnos && tutor.idAlumnos.includes(selection.student!.id)
        );
      }

      setAvailableOptions(prev => ({
        ...prev,
        admins: filteredAdmins,
        teachers: filteredTeachers,
        subjects: filteredSubjects,
        notebooks: filteredNotebooks,
        students: filteredStudents,
        tutors: filteredTutors
      }));

    } catch (error) {
      console.error('Error cargando opciones filtradas:', error);
    }
  };

  const handleSelectionChange = (entityType: keyof SelectionState, value: any) => {
    setSelection(prev => {
      const newSelection = { ...prev, [entityType]: value };
      
      // Limpiar selecciones dependientes cuando se cambia una selección padre
      switch (entityType) {
        case 'institution':
          newSelection.admin = null;
          newSelection.teacher = null;
          newSelection.subject = null;
          newSelection.student = null;
          newSelection.tutor = null;
          break;
        case 'admin':
          newSelection.teacher = null;
          newSelection.subject = null;
          newSelection.student = null;
          newSelection.tutor = null;
          break;
        case 'teacher':
          newSelection.subject = null;
          newSelection.student = null;
          newSelection.tutor = null;
          break;
        case 'subject':
          newSelection.student = null;
          newSelection.tutor = null;
          break;
        case 'student':
          newSelection.tutor = null;
          break;
      }
      
      return newSelection;
    });
  };

  const getEntityDisplayName = (entity: any, type: string): string => {
    if (!entity) return '';
    
    switch (type) {
      case 'institution':
        return `${entity.nombre} (${entity.id})`;
      case 'admin':
        return `${entity.nombre} (${entity.id})`;
      case 'teacher':
        return `${entity.nombre} (${entity.id})`;
      case 'subject':
        return `${entity.nombre} (${entity.id})`;
      case 'student':
        return `${entity.nombre} (${entity.id})`;
      case 'tutor':
        return `${entity.nombre} (${entity.id})`;
      default:
        return entity.nombre || entity.title || entity.id;
    }
  };

  const generateVisualTree = () => {
    const tree = [];
    
    if (selection.institution) {
      tree.push({
        level: 1,
        type: 'institution',
        name: getEntityDisplayName(selection.institution, 'institution'),
        icon: '🏫',
        color: '#667eea'
      });
      
      if (selection.admin) {
        tree.push({
          level: 2,
          type: 'admin',
          name: getEntityDisplayName(selection.admin, 'admin'),
          icon: '👨‍💼',
          color: '#764ba2'
        });
        
        if (selection.teacher) {
          tree.push({
            level: 3,
            type: 'teacher',
            name: getEntityDisplayName(selection.teacher, 'teacher'),
            icon: '👨‍🏫',
            color: '#f093fb'
          });
          
          if (selection.subject) {
            tree.push({
              level: 4,
              type: 'subject',
              name: getEntityDisplayName(selection.subject, 'subject'),
              icon: '📚',
              color: '#f5576c'
            });
            
            if (selection.student) {
              tree.push({
                level: 5,
                type: 'student',
                name: getEntityDisplayName(selection.student, 'student'),
                icon: '👨‍🎓',
                color: '#43e97b'
              });
              
              if (selection.tutor) {
                tree.push({
                  level: 6,
                  type: 'tutor',
                  name: getEntityDisplayName(selection.tutor, 'tutor'),
                  icon: '👨‍👩‍👧‍👦',
                  color: '#fa709a'
                });
              }
            }
          }
        }
      }
    }
    
    return tree;
  };

  const clearAllSelections = () => {
    setSelection({
      institution: null,
      admin: null,
      teacher: null,
      subject: null,
      student: null,
      tutor: null
    });
  };

  const runDiagnostics = async () => {
    console.log('🔍 === DIAGNÓSTICO DE COLECCIONES ESCOLARES ===');
    try {
      // Verificar usuario actual
      const { auth } = await import('../services/firebase');
      const currentUser = auth.currentUser;
      console.log('👤 Usuario actual:', currentUser?.uid, currentUser?.email);
      
      if (currentUser) {
        // Buscar en colección users
        try {
          const userDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', currentUser.uid)));
          console.log('📊 Usuario en colección users:', userDoc.empty ? 'NO ENCONTRADO' : userDoc.docs[0].data());
        } catch (err) {
          console.error('❌ Error buscando en users:', err);
        }
        
        // Buscar en colección usuarios
        try {
          const userDoc2 = await getDocs(query(collection(db, 'usuarios'), where('__name__', '==', currentUser.uid)));
          console.log('📊 Usuario en colección usuarios:', userDoc2.empty ? 'NO ENCONTRADO' : userDoc2.docs[0].data());
        } catch (err) {
          console.error('❌ Error buscando en usuarios:', err);
        }
      }
      
      // Verificar cada colección
      const collections = [
        'schoolInstitutions',
        'schoolSubjects', 
        'schoolNotebooks'
      ];
      
      for (const collName of collections) {
        try {
          const snapshot = await getDocs(collection(db, collName));
          console.log(`📊 ${collName}: ${snapshot.size} documentos`);
          snapshot.docs.forEach((doc, index) => {
            console.log(`  - Doc ${index + 1}:`, doc.id, doc.data());
          });
        } catch (err: any) {
          console.error(`❌ Error en ${collName}:`, err.message);
        }
      }
      
      // Verificar usuarios escolares
      console.log('👥 === USUARIOS ESCOLARES ===');
      
      // Buscar con minúsculas
      const usersQueryLower = query(
        collection(db, 'users'),
        where('subscription', '==', 'school')
      );
      const usersSnapshotLower = await getDocs(usersQueryLower);
      console.log(`📊 Usuarios escolares (school): ${usersSnapshotLower.size}`);
      
      // Buscar con mayúsculas
      const usersQueryUpper = query(
        collection(db, 'users'),
        where('subscription', '==', 'SCHOOL')
      );
      const usersSnapshotUpper = await getDocs(usersQueryUpper);
      console.log(`📊 Usuarios escolares (SCHOOL): ${usersSnapshotUpper.size}`);
      
      // Combinar resultados
      const allSchoolUsers = new Map();
      usersSnapshotLower.docs.forEach(doc => {
        allSchoolUsers.set(doc.id, { id: doc.id, ...doc.data() });
      });
      usersSnapshotUpper.docs.forEach(doc => {
        allSchoolUsers.set(doc.id, { id: doc.id, ...doc.data() });
      });
      
      console.log(`📊 Total usuarios escolares: ${allSchoolUsers.size}`);
      Array.from(allSchoolUsers.values()).forEach((user, index) => {
        console.log(`  - ${user.schoolRole || 'Sin rol'} ${index + 1}:`, user.id, {
          email: user.email,
          nombre: user.nombre || user.displayName,
          schoolRole: user.schoolRole,
          subscription: user.subscription
        });
      });
      
    } catch (error) {
      console.error('❌ Error en diagnóstico:', error);
    }
    console.log('🔍 === FIN DEL DIAGNÓSTICO ===');
  };

  if (loading) {
    return (
      <div className="school-linking-verification">
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>Cargando datos de vinculación...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="school-linking-verification">
      <div className="verification-content">
        {/* Selectores jerárquicos */}
        <div className="selection-panel">
          <h3>📋 Selectores Jerárquicos</h3>
          
          <div className="selection-grid">
            {/* Institución */}
            <div className="selection-item">
              <label className="selection-label">
                🏫 Institución ({entityCounts.institutions})
              </label>
              <select
                value={selection.institution?.id || ''}
                onChange={(e) => {
                  const selected = availableOptions.institutions.find(inst => inst.id === e.target.value);
                  handleSelectionChange('institution', selected || null);
                }}
                className="selection-select"
              >
                <option value="">Seleccionar institución...</option>
                {availableOptions.institutions.map(inst => (
                  <option key={inst.id} value={inst.id}>
                    {inst.nombre} ({inst.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Administrador */}
            <div className="selection-item">
              <label className="selection-label">
                👨‍💼 Administrador ({availableOptions.admins.length})
              </label>
              <select
                value={selection.admin?.id || ''}
                onChange={(e) => {
                  const selected = availableOptions.admins.find(admin => admin.id === e.target.value);
                  handleSelectionChange('admin', selected || null);
                }}
                className="selection-select"
                disabled={!selection.institution}
              >
                <option value="">
                  {selection.institution ? 'Seleccionar administrador...' : 'Primero selecciona una institución'}
                </option>
                {availableOptions.admins.map(admin => (
                  <option key={admin.id} value={admin.id}>
                    {admin.nombre} ({admin.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Profesor */}
            <div className="selection-item">
              <label className="selection-label">
                👨‍🏫 Profesor ({availableOptions.teachers.length})
              </label>
              <select
                value={selection.teacher?.id || ''}
                onChange={(e) => {
                  const selected = availableOptions.teachers.find(teacher => teacher.id === e.target.value);
                  handleSelectionChange('teacher', selected || null);
                }}
                className="selection-select"
                disabled={!selection.admin}
              >
                <option value="">
                  {selection.admin ? 'Seleccionar profesor...' : 'Primero selecciona un administrador'}
                </option>
                {availableOptions.teachers.map(teacher => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.nombre} ({teacher.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Materia */}
            <div className="selection-item">
              <label className="selection-label">
                📚 Materia ({availableOptions.subjects.length})
              </label>
              <select
                value={selection.subject?.id || ''}
                onChange={(e) => {
                  const selected = availableOptions.subjects.find(subject => subject.id === e.target.value);
                  handleSelectionChange('subject', selected || null);
                }}
                className="selection-select"
                disabled={!selection.teacher}
              >
                <option value="">
                  {selection.teacher ? 'Seleccionar materia...' : 'Primero selecciona un profesor'}
                </option>
                {availableOptions.subjects.map(subject => (
                  <option key={subject.id} value={subject.id}>
                    {subject.nombre} ({subject.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Alumno */}
            <div className="selection-item">
              <label className="selection-label">
                👨‍🎓 Alumno ({availableOptions.students.length})
              </label>
              <select
                value={selection.student?.id || ''}
                onChange={(e) => {
                  const selected = availableOptions.students.find(student => student.id === e.target.value);
                  handleSelectionChange('student', selected || null);
                }}
                className="selection-select"
                disabled={!selection.subject}
              >
                <option value="">
                  {selection.subject ? 'Seleccionar alumno...' : 'Primero selecciona una materia'}
                </option>
                {availableOptions.students.map(student => (
                  <option key={student.id} value={student.id}>
                    {student.nombre} ({student.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Tutor */}
            <div className="selection-item">
              <label className="selection-label">
                👨‍👩‍👧‍👦 Tutor ({availableOptions.tutors.length})
              </label>
              <select
                value={selection.tutor?.id || ''}
                onChange={(e) => {
                  const selected = availableOptions.tutors.find(tutor => tutor.id === e.target.value);
                  handleSelectionChange('tutor', selected || null);
                }}
                className="selection-select"
                disabled={!selection.student}
              >
                <option value="">
                  {selection.student ? 'Seleccionar tutor...' : 'Primero selecciona un alumno'}
                </option>
                {availableOptions.tutors.map(tutor => (
                  <option key={tutor.id} value={tutor.id}>
                    {tutor.nombre} ({tutor.id})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="selection-actions">
            <button 
              className="clear-button"
              onClick={clearAllSelections}
            >
              🗑️ Limpiar Selecciones
            </button>
          </div>
        </div>

        {/* Visualización del árbol */}
        <div className="tree-visualization">
          <h3>🌳 Árbol de Vinculación</h3>
          
          {generateVisualTree().length === 0 ? (
            <div className="empty-tree">
              <p>👆 Selecciona elementos en el panel superior para visualizar las conexiones</p>
            </div>
          ) : (
            <div className="tree-container">
              {generateVisualTree().map((node, index) => (
                <div 
                  key={index} 
                  className="tree-node"
                  style={{ 
                    marginLeft: `${(node.level - 1) * 40}px`,
                    borderLeftColor: node.color
                  }}
                >
                  <div className="node-content">
                    <span className="node-icon">{node.icon}</span>
                    <span className="node-name">{node.name}</span>
                  </div>
                  {index < generateVisualTree().length - 1 && (
                    <div className="node-connector" style={{ borderColor: node.color }}></div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SchoolLinkingVerification; 