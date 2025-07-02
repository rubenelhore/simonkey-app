import React, { useState, useEffect } from 'react';
import { 
  SchoolCategory, 
  SchoolCreationData,
  UserSubscriptionType,
  SchoolRole
} from '../types/interfaces';
import { db } from '../services/firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  addDoc,
  deleteDoc,
  serverTimestamp,
  setDoc,
  query,
  where,
  onSnapshot 
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import '../styles/SchoolComponents.css';

interface SchoolCreationProps {
  onRefresh: () => void;
}

const SchoolCreation: React.FC<SchoolCreationProps> = ({ onRefresh }) => {
  const [creationData, setCreationData] = useState<SchoolCreationData>({
    categoria: '',
    informacionBasica: {},
    selectedEntity: ''
  });

  const [entities, setEntities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Listener en tiempo real para administradores
  useEffect(() => {
    if (creationData.categoria === SchoolCategory.ADMINS) {
      console.log('🔊 Configurando listener en tiempo real para admins');
      
      // Query para administradores con valores en minúsculas
      const adminsQuery = query(
        collection(db, 'users'),
        where('subscription', '==', UserSubscriptionType.SCHOOL),
        where('schoolRole', '==', SchoolRole.ADMIN)
      );
      
      // Query para administradores con valores en mayúsculas (por compatibilidad)
      const adminsQueryUppercase = query(
        collection(db, 'users'),
        where('subscription', '==', 'SCHOOL'),
        where('schoolRole', '==', 'ADMIN')
      );
      
      const allAdmins = new Map();
      
      // Listener para minúsculas
      const unsubscribe1 = onSnapshot(adminsQuery, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            const data = { id: change.doc.id, ...change.doc.data() };
            allAdmins.set(change.doc.id, data);
            console.log('➕ Admin agregado/modificado (minúsculas):', data);
          } else if (change.type === 'removed') {
            allAdmins.delete(change.doc.id);
            console.log('➖ Admin eliminado (minúsculas):', change.doc.id);
          }
        });
        
        // Actualizar la lista
        setEntities(Array.from(allAdmins.values()));
      });
      
      // Listener para mayúsculas
      const unsubscribe2 = onSnapshot(adminsQueryUppercase, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            const data = { id: change.doc.id, ...change.doc.data() };
            allAdmins.set(change.doc.id, data);
            console.log('➕ Admin agregado/modificado (MAYÚSCULAS):', data);
          } else if (change.type === 'removed') {
            allAdmins.delete(change.doc.id);
            console.log('➖ Admin eliminado (MAYÚSCULAS):', change.doc.id);
          }
        });
        
        // Actualizar la lista
        setEntities(Array.from(allAdmins.values()));
      });
      
      // Cargar datos iniciales
      loadEntities(SchoolCategory.ADMINS);
      
      // Cleanup
      return () => {
        console.log('🔇 Desconectando listeners de admins');
        unsubscribe1();
        unsubscribe2();
      };
    }
  }, [creationData.categoria]);

  // Campos requeridos por categoría
  const getRequiredFields = (category: SchoolCategory): string[] => {
    switch (category) {
      case SchoolCategory.INSTITUCIONES:
        return ['nombre'];
      case SchoolCategory.ADMINS:
        return ['nombre', 'email'];
      case SchoolCategory.PROFESORES:
        return ['nombre', 'email'];
      case SchoolCategory.MATERIAS:
        return ['nombre'];
      case SchoolCategory.CUADERNOS:
        return ['titulo'];
      case SchoolCategory.ALUMNOS:
        return ['nombre', 'email'];
      case SchoolCategory.TUTORES:
        return ['nombre', 'email'];
      default:
        return [];
    }
  };

  // Cargar entidades de la categoría seleccionada
  const loadEntities = async (category: SchoolCategory) => {
    setLoading(true);
    try {
      let data: any[] = [];
      
      switch (category) {
        case SchoolCategory.INSTITUCIONES:
          // Las instituciones siguen en su colección separada
          const institutionsSnapshot = await getDocs(collection(db, 'schoolInstitutions'));
          data = institutionsSnapshot.docs.map((doc: any) => ({
            id: doc.id,
            ...doc.data()
          }));
          break;
          
        case SchoolCategory.ADMINS:
          // Cargar usuarios con subscription SCHOOL y schoolRole ADMIN
          console.log('🔍 Buscando admins con:', {
            subscription: UserSubscriptionType.SCHOOL,
            schoolRole: SchoolRole.ADMIN
          });
          
          // Buscar con valores en minúsculas (correcto)
          const adminsQuery = query(
            collection(db, 'users'),
            where('subscription', '==', UserSubscriptionType.SCHOOL),
            where('schoolRole', '==', SchoolRole.ADMIN)
          );
          const adminsSnapshot = await getDocs(adminsQuery);
          console.log('📊 Admins encontrados (minúsculas):', adminsSnapshot.size);
          
          // También buscar con valores en mayúsculas (por si la función no se actualizó)
          const adminsQueryUppercase = query(
            collection(db, 'users'),
            where('subscription', '==', 'SCHOOL'),
            where('schoolRole', '==', 'ADMIN')
          );
          const adminsSnapshotUppercase = await getDocs(adminsQueryUppercase);
          console.log('📊 Admins encontrados (MAYÚSCULAS):', adminsSnapshotUppercase.size);
          
          // Combinar resultados
          const allAdmins = new Map();
          adminsSnapshot.docs.forEach(doc => {
            const userData = doc.data();
            console.log('📋 Admin (minúsculas):', doc.id, userData);
            allAdmins.set(doc.id, { id: doc.id, ...userData });
          });
          adminsSnapshotUppercase.docs.forEach(doc => {
            const userData = doc.data();
            console.log('📋 Admin (MAYÚSCULAS):', doc.id, userData);
            allAdmins.set(doc.id, { id: doc.id, ...userData });
          });
          
          data = Array.from(allAdmins.values());
          console.log('👥 Total de admins (combinado):', data.length);
          console.log('👥 Datos de admins:', data);
          
          // Verificar si hay usuarios school sin el campo schoolRole
          const schoolUsersQuery = query(
            collection(db, 'users'),
            where('subscription', '==', UserSubscriptionType.SCHOOL)
          );
          const schoolUsersSnapshot = await getDocs(schoolUsersQuery);
          console.log('🏫 Total usuarios school:', schoolUsersSnapshot.size);
          schoolUsersSnapshot.docs.forEach(doc => {
            const userData = doc.data();
            if (!userData.schoolRole) {
              console.warn('⚠️ Usuario school sin schoolRole:', doc.id, userData);
            }
          });
          break;
          
        case SchoolCategory.PROFESORES:
          // Cargar usuarios con subscription SCHOOL y schoolRole TEACHER
          const teachersQuery = query(
            collection(db, 'users'),
            where('subscription', '==', UserSubscriptionType.SCHOOL),
            where('schoolRole', '==', SchoolRole.TEACHER)
          );
          const teachersSnapshot = await getDocs(teachersQuery);
          
          // También buscar con valores en mayúsculas
          const teachersQueryUppercase = query(
            collection(db, 'users'),
            where('subscription', '==', 'SCHOOL'),
            where('schoolRole', '==', 'TEACHER')
          );
          const teachersSnapshotUppercase = await getDocs(teachersQueryUppercase);
          
          // Combinar resultados
          const allTeachers = new Map();
          teachersSnapshot.docs.forEach(doc => {
            allTeachers.set(doc.id, { id: doc.id, ...doc.data() });
          });
          teachersSnapshotUppercase.docs.forEach(doc => {
            allTeachers.set(doc.id, { id: doc.id, ...doc.data() });
          });
          
          data = Array.from(allTeachers.values());
          break;
          
        case SchoolCategory.MATERIAS:
          // Las materias siguen en su colección separada
          const subjectsSnapshot = await getDocs(collection(db, 'schoolSubjects'));
          data = subjectsSnapshot.docs.map((doc: any) => ({
            id: doc.id,
            ...doc.data()
          }));
          break;
          
        case SchoolCategory.CUADERNOS:
          // Los cuadernos siguen en su colección separada
          const notebooksSnapshot = await getDocs(collection(db, 'schoolNotebooks'));
          data = notebooksSnapshot.docs.map((doc: any) => ({
            id: doc.id,
            ...doc.data()
          }));
          break;
          
        case SchoolCategory.ALUMNOS:
          // Cargar usuarios con subscription SCHOOL y schoolRole STUDENT
          const studentsQuery = query(
            collection(db, 'users'),
            where('subscription', '==', UserSubscriptionType.SCHOOL),
            where('schoolRole', '==', SchoolRole.STUDENT)
          );
          const studentsSnapshot = await getDocs(studentsQuery);
          
          // También buscar con valores en mayúsculas
          const studentsQueryUppercase = query(
            collection(db, 'users'),
            where('subscription', '==', 'SCHOOL'),
            where('schoolRole', '==', 'STUDENT')
          );
          const studentsSnapshotUppercase = await getDocs(studentsQueryUppercase);
          
          // Combinar resultados
          const allStudents = new Map();
          studentsSnapshot.docs.forEach(doc => {
            allStudents.set(doc.id, { id: doc.id, ...doc.data() });
          });
          studentsSnapshotUppercase.docs.forEach(doc => {
            allStudents.set(doc.id, { id: doc.id, ...doc.data() });
          });
          
          data = Array.from(allStudents.values());
          break;
          
        case SchoolCategory.TUTORES:
          // Cargar usuarios con subscription SCHOOL y schoolRole TUTOR
          const tutorsQuery = query(
            collection(db, 'users'),
            where('subscription', '==', UserSubscriptionType.SCHOOL),
            where('schoolRole', '==', SchoolRole.TUTOR)
          );
          const tutorsSnapshot = await getDocs(tutorsQuery);
          
          // También buscar con valores en mayúsculas
          const tutorsQueryUppercase = query(
            collection(db, 'users'),
            where('subscription', '==', 'SCHOOL'),
            where('schoolRole', '==', 'TUTOR')
          );
          const tutorsSnapshotUppercase = await getDocs(tutorsQueryUppercase);
          
          // Combinar resultados
          const allTutors = new Map();
          tutorsSnapshot.docs.forEach(doc => {
            allTutors.set(doc.id, { id: doc.id, ...doc.data() });
          });
          tutorsSnapshotUppercase.docs.forEach(doc => {
            allTutors.set(doc.id, { id: doc.id, ...doc.data() });
          });
          
          data = Array.from(allTutors.values());
          break;
          
        default:
          return;
      }

      setEntities(data);
    } catch (error) {
      console.error('Error loading entities:', error);
      setEntities([]);
    } finally {
      setLoading(false);
    }
  };

  // Manejar cambio de categoría
  const handleCategoryChange = (category: SchoolCategory) => {
    const requiredFields = getRequiredFields(category);
    const basicInfo: { [key: string]: string } = {};
    
    requiredFields.forEach(field => {
      basicInfo[field] = '';
    });

    setCreationData({
      categoria: category,
      informacionBasica: basicInfo,
      selectedEntity: ''
    });

    loadEntities(category);
  };

  // Manejar cambio en información básica
  const handleBasicInfoChange = (field: string, value: string) => {
    setCreationData(prev => ({
      ...prev,
      informacionBasica: {
        ...prev.informacionBasica,
        [field]: value
      }
    }));
  };

  // Crear nueva entidad
  const createEntity = async () => {
    if (!creationData.categoria) {
      alert('Por favor selecciona una categoría.');
      return;
    }

    const requiredFields = getRequiredFields(creationData.categoria);
    const missingFields = requiredFields.filter(field => 
      !creationData.informacionBasica[field]?.trim()
    );

    if (missingFields.length > 0) {
      alert(`Por favor completa todos los campos requeridos: ${missingFields.join(', ')}`);
      return;
    }

    try {
      setLoading(true);
      console.log('🚀 Creando entidad:', creationData.categoria);
      console.log('📝 Datos:', creationData.informacionBasica);

      switch (creationData.categoria) {
        case SchoolCategory.INSTITUCIONES:
          // Las instituciones siguen en su colección separada
          await addDoc(collection(db, 'schoolInstitutions'), {
            nombre: creationData.informacionBasica.nombre,
            createdAt: serverTimestamp()
          });
          break;
          
        case SchoolCategory.ADMINS:
          // Crear usuario en colección users con etiquetas apropiadas
          const functions = getFunctions();
          const createSchoolUser = httpsCallable(functions, 'createSchoolUser');
          
          console.log('📤 Enviando datos para crear admin:', {
            email: creationData.informacionBasica.email,
            nombre: creationData.informacionBasica.nombre,
            role: 'admin'
          });
          
          const result = await createSchoolUser({
            userData: {
              email: creationData.informacionBasica.email,
              nombre: creationData.informacionBasica.nombre,
              role: 'admin',
              password: '1234',
              additionalData: {
                idInstitucion: '' // Se vinculará después
              }
            }
          });
          console.log('✅ Resultado de creación:', result);
          
          // Esperar un momento para asegurar la propagación en Firebase
          await new Promise(resolve => setTimeout(resolve, 500));
          break;
          
        case SchoolCategory.PROFESORES:
          // Crear usuario en colección users con etiquetas apropiadas
          const functionsTeacher = getFunctions();
          const createTeacher = httpsCallable(functionsTeacher, 'createSchoolUser');
          
          await createTeacher({
            userData: {
              email: creationData.informacionBasica.email,
              nombre: creationData.informacionBasica.nombre,
              role: 'teacher',
              password: '1234',
              additionalData: {
                idAdmin: '' // Se vinculará después
              }
            }
          });
          break;
          
        case SchoolCategory.MATERIAS:
          // Las materias siguen en su colección separada
          await addDoc(collection(db, 'schoolSubjects'), {
            nombre: creationData.informacionBasica.nombre,
            idProfesor: '', // Se vinculará después
            createdAt: serverTimestamp()
          });
          break;
          
        case SchoolCategory.CUADERNOS:
          // Los cuadernos siguen en su colección separada
          await addDoc(collection(db, 'schoolNotebooks'), {
            title: creationData.informacionBasica.titulo,
            color: '#6147FF', // Color azul/morado por defecto
            idMateria: '', // Se vinculará después
            createdAt: serverTimestamp()
          });
          break;
          
        case SchoolCategory.ALUMNOS:
          // Crear usuario en colección users con etiquetas apropiadas
          const functionsStudent = getFunctions();
          const createStudent = httpsCallable(functionsStudent, 'createSchoolUser');
          
          await createStudent({
            userData: {
              email: creationData.informacionBasica.email,
              nombre: creationData.informacionBasica.nombre,
              role: 'student',
              password: '1234',
              additionalData: {
                idCuadernos: [] // Se vinculará después
              }
            }
          });
          break;
          
        case SchoolCategory.TUTORES:
          // Crear usuario en colección users con etiquetas apropiadas
          const functionsTutor = getFunctions();
          const createTutor = httpsCallable(functionsTutor, 'createSchoolUser');
          
          await createTutor({
            userData: {
              email: creationData.informacionBasica.email,
              nombre: creationData.informacionBasica.nombre,
              role: 'tutor',
              password: '1234',
              additionalData: {
                idAlumnos: [] // Se vinculará después
              }
            }
          });
          break;
          
        default:
          throw new Error('Categoría no válida');
      }
      
      alert('Entidad creada exitosamente');
      
      // Limpiar formulario
      const newRequiredFields = getRequiredFields(creationData.categoria);
      const basicInfo: { [key: string]: string } = {};
      newRequiredFields.forEach(field => {
        basicInfo[field] = '';
      });

      setCreationData(prev => ({
        ...prev,
        informacionBasica: basicInfo,
        selectedEntity: ''
      }));

      // Recargar entidades
      await loadEntities(creationData.categoria);
      onRefresh();
    } catch (error) {
      console.error('Error creating entity:', error);
      alert('Error al crear la entidad. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Eliminar entidad seleccionada
  const deleteEntity = async () => {
    if (!creationData.selectedEntity) {
      alert('Por favor selecciona una entidad para eliminar.');
      return;
    }

    if (!window.confirm('¿Estás seguro de que quieres eliminar esta entidad? Esta acción es irreversible.')) {
      return;
    }

    try {
      setLoading(true);

      switch (creationData.categoria) {
        case SchoolCategory.INSTITUCIONES:
          // Las instituciones siguen en su colección separada
          await deleteDoc(doc(db, 'schoolInstitutions', creationData.selectedEntity));
          break;
          
        case SchoolCategory.ADMINS:
        case SchoolCategory.PROFESORES:
        case SchoolCategory.ALUMNOS:
        case SchoolCategory.TUTORES:
          // Eliminar usuario de la colección users
          // Nota: Esto solo elimina el documento de Firestore, no la cuenta de Auth
          await deleteDoc(doc(db, 'users', creationData.selectedEntity));
          break;
          
        case SchoolCategory.MATERIAS:
          // Las materias siguen en su colección separada
          await deleteDoc(doc(db, 'schoolSubjects', creationData.selectedEntity));
          break;
          
        case SchoolCategory.CUADERNOS:
          // Los cuadernos siguen en su colección separada
          await deleteDoc(doc(db, 'schoolNotebooks', creationData.selectedEntity));
          break;
          
        default:
          throw new Error('Categoría no válida');
      }
      
      alert('Entidad eliminada exitosamente');
      
      setCreationData(prev => ({
        ...prev,
        selectedEntity: ''
      }));

      // Recargar entidades
      await loadEntities(creationData.categoria);
      onRefresh();
    } catch (error) {
      console.error('Error deleting entity:', error);
      alert('Error al eliminar la entidad. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryDisplayName = (category: SchoolCategory) => {
    const names = {
      [SchoolCategory.INSTITUCIONES]: 'Instituciones',
      [SchoolCategory.ADMINS]: 'Administradores',
      [SchoolCategory.PROFESORES]: 'Profesores',
      [SchoolCategory.MATERIAS]: 'Materias',
      [SchoolCategory.CUADERNOS]: 'Cuadernos',
      [SchoolCategory.ALUMNOS]: 'Alumnos',
      [SchoolCategory.TUTORES]: 'Tutores'
    };
    return names[category] || '';
  };

  const getFieldDisplayName = (field: string) => {
    const names: { [key: string]: string } = {
      'nombre': 'Nombre',
      'email': 'Email',
      'titulo': 'Título'
    };
    return names[field] || field;
  };

  return (
    <div className="school-creation-container">
      <div className="creation-header">
        <h2>Creación Escolar</h2>
        <p>Crea nuevas entidades del sistema escolar</p>
      </div>

      <div className="creation-content">
        {/* Sección 1: Categoría */}
        <div className="creation-section">
          <div className="section-header">
            <h3><i className="fas fa-tags"></i> Categoría</h3>
          </div>
          <select
            value={creationData.categoria}
            onChange={(e) => handleCategoryChange(e.target.value as SchoolCategory)}
            className="form-select"
          >
            <option value="">Selecciona una categoría</option>
            <option value={SchoolCategory.INSTITUCIONES}>Institución</option>
            <option value={SchoolCategory.ADMINS}>Admin</option>
            <option value={SchoolCategory.PROFESORES}>Profesor</option>
            <option value={SchoolCategory.MATERIAS}>Materia</option>
            <option value={SchoolCategory.CUADERNOS}>Cuaderno</option>
            <option value={SchoolCategory.ALUMNOS}>Alumno</option>
            <option value={SchoolCategory.TUTORES}>Tutor</option>
          </select>
        </div>

        {/* Sección 2: Información Básica */}
        {creationData.categoria && (
          <div className="creation-section">
            <div className="section-header">
              <h3><i className="fas fa-edit"></i> Información Básica</h3>
            </div>
            <div className="basic-info-form">
              {getRequiredFields(creationData.categoria).map(field => (
                <div key={field} className="form-group">
                  <label className="form-label">
                    {getFieldDisplayName(field)}
                  </label>
                  <input
                    type={field === 'email' ? 'email' : 'text'}
                    value={creationData.informacionBasica[field] || ''}
                    onChange={(e) => handleBasicInfoChange(field, e.target.value)}
                    className="form-input"
                    placeholder={`Ingresa ${getFieldDisplayName(field).toLowerCase()}`}
                  />
                </div>
              ))}
              <button
                onClick={createEntity}
                disabled={loading}
                className="create-button"
              >
                {loading ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i> Creando...
                  </>
                ) : (
                  <>
                    <i className="fas fa-plus"></i> Crear
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Sección 3: Lista Completa */}
        {creationData.categoria && (
          <div className="creation-section">
            <div className="section-header">
              <h3><i className="fas fa-list"></i> Lista de {getCategoryDisplayName(creationData.categoria)}</h3>
              <span className="entity-count">({entities.length})</span>
            </div>
            <div className="entities-list">
              {entities.length === 0 ? (
                <div className="empty-state">
                  <i className="fas fa-inbox"></i>
                  <p>No hay {getCategoryDisplayName(creationData.categoria).toLowerCase()} creados aún</p>
                </div>
              ) : (
                <div className="entities-grid">
                  {entities.map(entity => (
                    <div 
                      key={entity.id} 
                      className={`entity-card ${creationData.selectedEntity === entity.id ? 'selected' : ''}`}
                      onClick={() => setCreationData(prev => ({
                        ...prev,
                        selectedEntity: entity.id
                      }))}
                    >
                      <div className="entity-info">
                        <h4>{entity.nombre || entity.title || 'Sin nombre'}</h4>
                        <p className="entity-id">ID: {entity.id}</p>
                        {entity.email && (
                          <p className="entity-email">📧 {entity.email}</p>
                        )}
                      </div>
                      {creationData.selectedEntity === entity.id && (
                        <div className="selection-indicator">
                          <i className="fas fa-check-circle"></i>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {creationData.selectedEntity && (
                <div className="entity-actions">
                  <button
                    onClick={deleteEntity}
                    disabled={loading}
                    className="delete-button"
                  >
                    {loading ? (
                      <>
                        <i className="fas fa-spinner fa-spin"></i> Eliminando...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-trash"></i> Eliminar Seleccionado
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Procesando...</p>
        </div>
      )}
    </div>
  );
};

export default SchoolCreation;