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
  SchoolNotebook,
  SchoolStudent,
  SchoolTutor
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
  notebook: SchoolNotebook | null;
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
    notebook: null,
    student: null,
    tutor: null
  });
  
  const [availableOptions, setAvailableOptions] = useState<{
    institutions: SchoolInstitution[];
    admins: SchoolAdmin[];
    teachers: SchoolTeacher[];
    subjects: SchoolSubject[];
    notebooks: SchoolNotebook[];
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

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Cargar todas las instituciones
      const institutionsSnapshot = await getDocs(collection(db, 'schoolInstitutions'));
      const institutions = institutionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SchoolInstitution[];

      // Cargar todos los administradores
      const adminsSnapshot = await getDocs(collection(db, 'schoolAdmins'));
      const admins = adminsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SchoolAdmin[];

      // Cargar todos los profesores
      const teachersSnapshot = await getDocs(collection(db, 'schoolTeachers'));
      const teachers = teachersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SchoolTeacher[];

      // Cargar todas las materias
      const subjectsSnapshot = await getDocs(collection(db, 'schoolSubjects'));
      const subjects = subjectsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SchoolSubject[];

      // Cargar todos los cuadernos
      const notebooksSnapshot = await getDocs(collection(db, 'schoolNotebooks'));
      const notebooks = notebooksSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SchoolNotebook[];

      // Cargar todos los estudiantes
      const studentsSnapshot = await getDocs(collection(db, 'schoolStudents'));
      const students = studentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SchoolStudent[];

      // Cargar todos los tutores
      const tutorsSnapshot = await getDocs(collection(db, 'schoolTutors'));
      const tutors = tutorsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SchoolTutor[];

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

    } catch (error) {
      console.error('Error cargando datos iniciales:', error);
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

      // Filtrar estudiantes por cuaderno seleccionado
      if (selection.notebook) {
        filteredStudents = availableOptions.students.filter(student => 
          student.idCuadernos && student.idCuadernos.includes(selection.notebook!.id)
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
          newSelection.notebook = null;
          newSelection.student = null;
          newSelection.tutor = null;
          break;
        case 'admin':
          newSelection.teacher = null;
          newSelection.subject = null;
          newSelection.notebook = null;
          newSelection.student = null;
          newSelection.tutor = null;
          break;
        case 'teacher':
          newSelection.subject = null;
          newSelection.notebook = null;
          newSelection.student = null;
          newSelection.tutor = null;
          break;
        case 'subject':
          newSelection.notebook = null;
          newSelection.student = null;
          newSelection.tutor = null;
          break;
        case 'notebook':
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
      case 'notebook':
        return `${entity.title} (${entity.id})`;
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
            
            if (selection.notebook) {
              tree.push({
                level: 5,
                type: 'notebook',
                name: getEntityDisplayName(selection.notebook, 'notebook'),
                icon: '📖',
                color: '#4facfe'
              });
              
              if (selection.student) {
                tree.push({
                  level: 6,
                  type: 'student',
                  name: getEntityDisplayName(selection.student, 'student'),
                  icon: '👨‍🎓',
                  color: '#43e97b'
                });
                
                if (selection.tutor) {
                  tree.push({
                    level: 7,
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
    }
    
    return tree;
  };

  const clearAllSelections = () => {
    setSelection({
      institution: null,
      admin: null,
      teacher: null,
      subject: null,
      notebook: null,
      student: null,
      tutor: null
    });
  };

  if (loading) {
    return (
      <div className="school-linking-verification">
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Cargando datos de vinculación...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="school-linking-verification">
      <div className="verification-header">
        <h2>🔗 Verificación de Vinculación Escolar</h2>
        <p className="verification-description">
          Visualiza las conexiones jerárquicas entre las diferentes entidades del sistema escolar.
          Selecciona elementos en orden para construir el árbol de vinculación.
        </p>
      </div>

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

            {/* Cuaderno */}
            <div className="selection-item">
              <label className="selection-label">
                📖 Cuaderno ({availableOptions.notebooks.length})
              </label>
              <select
                value={selection.notebook?.id || ''}
                onChange={(e) => {
                  const selected = availableOptions.notebooks.find(notebook => notebook.id === e.target.value);
                  handleSelectionChange('notebook', selected || null);
                }}
                className="selection-select"
                disabled={!selection.subject}
              >
                <option value="">
                  {selection.subject ? 'Seleccionar cuaderno...' : 'Primero selecciona una materia'}
                </option>
                {availableOptions.notebooks.map(notebook => (
                  <option key={notebook.id} value={notebook.id}>
                    {notebook.title} ({notebook.id})
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
                disabled={!selection.notebook}
              >
                <option value="">
                  {selection.notebook ? 'Seleccionar alumno...' : 'Primero selecciona un cuaderno'}
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
            <button 
              className="refresh-button"
              onClick={loadInitialData}
            >
              🔄 Actualizar Datos
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

        {/* Información de estadísticas */}
        <div className="statistics-panel">
          <h3>📊 Estadísticas del Sistema</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-icon">🏫</span>
              <span className="stat-label">Instituciones</span>
              <span className="stat-value">{entityCounts.institutions}</span>
            </div>
            <div className="stat-item">
              <span className="stat-icon">👨‍💼</span>
              <span className="stat-label">Administradores</span>
              <span className="stat-value">{entityCounts.admins}</span>
            </div>
            <div className="stat-item">
              <span className="stat-icon">👨‍🏫</span>
              <span className="stat-label">Profesores</span>
              <span className="stat-value">{entityCounts.teachers}</span>
            </div>
            <div className="stat-item">
              <span className="stat-icon">📚</span>
              <span className="stat-label">Materias</span>
              <span className="stat-value">{entityCounts.subjects}</span>
            </div>
            <div className="stat-item">
              <span className="stat-icon">📖</span>
              <span className="stat-label">Cuadernos</span>
              <span className="stat-value">{entityCounts.notebooks}</span>
            </div>
            <div className="stat-item">
              <span className="stat-icon">👨‍🎓</span>
              <span className="stat-label">Alumnos</span>
              <span className="stat-value">{entityCounts.students}</span>
            </div>
            <div className="stat-item">
              <span className="stat-icon">👨‍👩‍👧‍👦</span>
              <span className="stat-label">Tutores</span>
              <span className="stat-value">{entityCounts.tutors}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchoolLinkingVerification; 