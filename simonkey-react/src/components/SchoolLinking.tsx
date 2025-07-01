import React, { useState, useEffect } from 'react';
import { 
  SchoolCategory, 
  SchoolLinkingData,
  SchoolInstitution,
  SchoolAdmin,
  SchoolTeacher,
  SchoolNotebook,
  SchoolStudent,
  SchoolTutor,
  SchoolSubject,
  UserSubscriptionType,
  SchoolRole
} from '../types/interfaces';
import { db } from '../services/firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc,
  serverTimestamp,
  query,
  where 
} from 'firebase/firestore';
import '../styles/SchoolComponents.css';

interface SchoolLinkingProps {
  onRefresh: () => void;
}

const SchoolLinking: React.FC<SchoolLinkingProps> = ({ onRefresh }) => {
  const [linkingData, setLinkingData] = useState<SchoolLinkingData>({
    categoria: '',
    especifico: '',
    vincular: '',
    resumen: {
      categoria: '',
      especificoNombre: '',
      vincularNombre: ''
    }
  });

  const [entities, setEntities] = useState<{ [key: string]: any[] }>({});
  const [linkableEntities, setLinkableEntities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Cargar entidades según la categoría seleccionada
  const loadEntities = async (category: SchoolCategory) => {
    setLoading(true);
    try {
      let data: any[] = [];
      
      switch (category) {
        case SchoolCategory.INSTITUCIONES:
          // Las instituciones siguen en su colección separada
          const institutionsSnapshot = await getDocs(collection(db, 'schoolInstitutions'));
          data = institutionsSnapshot.docs.map(doc => ({
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
          
          // Combinar resultados únicos
          const allAdmins = new Map();
          adminsSnapshot.docs.forEach(doc => {
            allAdmins.set(doc.id, { id: doc.id, ...doc.data() });
          });
          adminsSnapshotUppercase.docs.forEach(doc => {
            allAdmins.set(doc.id, { id: doc.id, ...doc.data() });
          });
          
          data = Array.from(allAdmins.values());
          console.log('👥 Total de admins (combinado):', data.length);
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
          
          // Combinar resultados únicos
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
          data = subjectsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          break;
          
        case SchoolCategory.CUADERNOS:
          // Los cuadernos siguen en su colección separada
          const notebooksSnapshot = await getDocs(collection(db, 'schoolNotebooks'));
          data = notebooksSnapshot.docs.map(doc => ({
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
          
          // Combinar resultados únicos
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
          
          // Combinar resultados únicos
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

      setEntities(prev => ({
        ...prev,
        [category]: data
      }));
    } catch (error) {
      console.error('Error loading entities:', error);
    } finally {
      setLoading(false);
    }
  };

  // Cargar entidades vinculables según la categoría principal
  const loadLinkableEntities = async (category: SchoolCategory) => {
    setLoading(true);
    try {
      let data: any[] = [];
      
      // Definir qué categorías se pueden vincular con cada una
      switch (category) {
        case SchoolCategory.INSTITUCIONES:
          // Vincular con Admins
          const adminsQuery = query(
            collection(db, 'users'),
            where('subscription', '==', UserSubscriptionType.SCHOOL),
            where('schoolRole', '==', SchoolRole.ADMIN)
          );
          const adminsSnapshot = await getDocs(adminsQuery);
          
          // También buscar con valores en mayúsculas
          const adminsQueryUppercase = query(
            collection(db, 'users'),
            where('subscription', '==', 'SCHOOL'),
            where('schoolRole', '==', 'ADMIN')
          );
          const adminsSnapshotUppercase = await getDocs(adminsQueryUppercase);
          
          // Combinar resultados únicos
          const allAdmins = new Map();
          adminsSnapshot.docs.forEach(doc => {
            allAdmins.set(doc.id, { id: doc.id, ...doc.data() });
          });
          adminsSnapshotUppercase.docs.forEach(doc => {
            allAdmins.set(doc.id, { id: doc.id, ...doc.data() });
          });
          
          data = Array.from(allAdmins.values());
          break;
          
        case SchoolCategory.ADMINS:
          // Vincular con Teachers
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
          
          // Combinar resultados únicos
          const allTeachers = new Map();
          teachersSnapshot.docs.forEach(doc => {
            allTeachers.set(doc.id, { id: doc.id, ...doc.data() });
          });
          teachersSnapshotUppercase.docs.forEach(doc => {
            allTeachers.set(doc.id, { id: doc.id, ...doc.data() });
          });
          
          data = Array.from(allTeachers.values());
          break;
          
        case SchoolCategory.PROFESORES:
          // Vincular con Materias
          const subjectsSnapshot = await getDocs(collection(db, 'schoolSubjects'));
          data = subjectsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          break;
          
        case SchoolCategory.MATERIAS:
          // Vincular con Cuadernos
          const notebooksSnapshot = await getDocs(collection(db, 'schoolNotebooks'));
          data = notebooksSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          break;
          
        case SchoolCategory.CUADERNOS:
          // Vincular con Students
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
          
          // Combinar resultados únicos
          const allStudents = new Map();
          studentsSnapshot.docs.forEach(doc => {
            allStudents.set(doc.id, { id: doc.id, ...doc.data() });
          });
          studentsSnapshotUppercase.docs.forEach(doc => {
            allStudents.set(doc.id, { id: doc.id, ...doc.data() });
          });
          
          data = Array.from(allStudents.values());
          break;
          
        case SchoolCategory.ALUMNOS:
          // Vincular con Tutors
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
          
          // Combinar resultados únicos
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
          setLinkableEntities([]);
          return;
      }

      setLinkableEntities(data);
    } catch (error) {
      console.error('Error loading linkable entities:', error);
      setLinkableEntities([]);
    } finally {
      setLoading(false);
    }
  };

  // Manejar cambio de categoría
  const handleCategoryChange = (category: SchoolCategory) => {
    setLinkingData({
      categoria: category,
      especifico: '',
      vincular: '',
      resumen: {
        categoria: '',
        especificoNombre: '',
        vincularNombre: ''
      }
    });

    loadEntities(category);
    loadLinkableEntities(category);
  };

  // Manejar cambio de entidad específica
  const handleSpecificChange = (specificId: string) => {
    const specificEntity = entities[linkingData.categoria]?.find(e => e.id === specificId);
    
    setLinkingData(prev => ({
      ...prev,
      especifico: specificId,
      vincular: '',
      resumen: {
        ...prev.resumen,
        categoria: prev.categoria,
        especificoNombre: specificEntity?.nombre || specificEntity?.titulo || specificEntity?.title || ''
      }
    }));
  };

  // Manejar cambio de entidad a vincular
  const handleLinkableChange = (linkableId: string) => {
    const linkableEntity = linkableEntities.find(e => e.id === linkableId);
    
    setLinkingData(prev => ({
      ...prev,
      vincular: linkableId,
      resumen: {
        ...prev.resumen,
        vincularNombre: linkableEntity?.nombre || linkableEntity?.titulo || linkableEntity?.title || ''
      }
    }));
  };

  // Ejecutar vinculación
  const executeLink = async () => {
    if (!linkingData.categoria || !linkingData.especifico || !linkingData.vincular) {
      alert('Por favor completa todos los campos antes de vincular.');
      return;
    }

    try {
      setLoading(true);
      
      // Determinar la colección y el campo de vinculación
      let collectionName = '';
      let linkField = '';
      let isUserCollection = false;
      
      switch (linkingData.categoria) {
        case SchoolCategory.INSTITUCIONES:
          // Vincular institución con admin (en colección users)
          collectionName = 'users';
          linkField = 'idInstitucion';
          isUserCollection = true;
          break;
        case SchoolCategory.ADMINS:
          // Vincular admin con teacher (en colección users)
          collectionName = 'users';
          linkField = 'idAdmin';
          isUserCollection = true;
          break;
        case SchoolCategory.PROFESORES:
          // Vincular profesor con materia (en colección schoolSubjects)
          collectionName = 'schoolSubjects';
          linkField = 'idProfesor';
          console.log('📊 Vinculando profesor con materia:', {
            profesorId: linkingData.especifico,
            materiaId: linkingData.vincular,
            campo: linkField
          });
          break;
        case SchoolCategory.MATERIAS:
          // Vincular materia con cuaderno (en colección schoolNotebooks)
          collectionName = 'schoolNotebooks';
          linkField = 'idMateria';
          break;
        case SchoolCategory.CUADERNOS:
          // Vincular cuaderno con estudiante (en colección users)
          collectionName = 'users';
          linkField = 'idCuadernos';
          isUserCollection = true;
          break;
        case SchoolCategory.ALUMNOS:
          // Vincular alumno con tutor (en colección users)
          collectionName = 'users';
          linkField = 'idAlumnos';
          isUserCollection = true;
          break;
        default:
          throw new Error('Categoría no válida para vinculación');
      }

      // Actualizar la entidad con la vinculación
      if (linkField === 'idCuadernos' || linkField === 'idAlumnos') {
        // Para relaciones de muchos a muchos, agregar al array
        const entityRef = doc(db, collectionName, linkingData.vincular);
        const currentEntity = linkableEntities.find(e => e.id === linkingData.vincular);
        const currentArray = currentEntity[linkField] || [];
        
        if (!currentArray.includes(linkingData.especifico)) {
          currentArray.push(linkingData.especifico);
          await updateDoc(entityRef, {
            [linkField]: currentArray,
            updatedAt: serverTimestamp()
          });
        }
      } else {
        // Para relaciones uno a uno
        const entityRef = doc(db, collectionName, linkingData.vincular);
        await updateDoc(entityRef, {
          [linkField]: linkingData.especifico,
          updatedAt: serverTimestamp()
        });
      }

      alert('Vinculación realizada exitosamente');
      
      // Limpiar formulario
      setLinkingData({
        categoria: '',
        especifico: '',
        vincular: '',
        resumen: {
          categoria: '',
          especificoNombre: '',
          vincularNombre: ''
        }
      });
      
      onRefresh();
    } catch (error) {
      console.error('Error ejecutando vinculación:', error);
      alert('Error al realizar la vinculación. Por favor, intenta de nuevo.');
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

  const getLinkableCategoryName = (category: SchoolCategory) => {
    const names = {
      [SchoolCategory.INSTITUCIONES]: 'Administrador',
      [SchoolCategory.ADMINS]: 'Profesor',
      [SchoolCategory.PROFESORES]: 'Materia',
      [SchoolCategory.MATERIAS]: 'Cuaderno',
      [SchoolCategory.CUADERNOS]: 'Alumno',
      [SchoolCategory.ALUMNOS]: 'Tutor',
      [SchoolCategory.TUTORES]: 'Tutor'
    };
    return names[category] || '';
  };

  return (
    <div className="school-linking-container">
      <div className="linking-header">
        <h2>Vinculación Escolar</h2>
        <p>Vincula entidades del sistema escolar según las jerarquías establecidas</p>
      </div>

      <div className="linking-form">
        {/* Sección 1: Categoría */}
        <div className="form-section">
          <label className="form-label">
            <i className="fas fa-tags"></i> Categoría
          </label>
          <select
            value={linkingData.categoria}
            onChange={(e) => handleCategoryChange(e.target.value as SchoolCategory)}
            className="form-select"
          >
            <option value="">Selecciona una categoría</option>
            <option value={SchoolCategory.INSTITUCIONES}>Instituciones</option>
            <option value={SchoolCategory.ADMINS}>Administradores</option>
            <option value={SchoolCategory.PROFESORES}>Profesores</option>
            <option value={SchoolCategory.MATERIAS}>Materias</option>
            <option value={SchoolCategory.CUADERNOS}>Cuadernos</option>
            <option value={SchoolCategory.ALUMNOS}>Alumnos</option>
          </select>
        </div>

        {/* Sección 2: Específico */}
        {linkingData.categoria && (
          <div className="form-section">
            <label className="form-label">
              <i className="fas fa-user"></i> Específico
            </label>
            <select
              value={linkingData.especifico}
              onChange={(e) => handleSpecificChange(e.target.value)}
              className="form-select"
              disabled={!entities[linkingData.categoria]?.length}
            >
              <option value="">
                {entities[linkingData.categoria]?.length ? 
                  `Selecciona ${getCategoryDisplayName(linkingData.categoria).toLowerCase()}` : 
                  'Cargando...'
                }
              </option>
              {entities[linkingData.categoria]?.map(entity => (
                <option key={entity.id} value={entity.id}>
                  {entity.nombre || entity.titulo || entity.title || 'Sin nombre'} - {entity.id}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Sección 3: Vincular */}
        {linkingData.especifico && linkingData.categoria && (
          <div className="form-section">
            <label className="form-label">
              <i className="fas fa-link"></i> Vincular con {getLinkableCategoryName(linkingData.categoria)}
            </label>
            <select
              value={linkingData.vincular}
              onChange={(e) => handleLinkableChange(e.target.value)}
              className="form-select"
              disabled={!linkableEntities.length}
            >
              <option value="">
                {linkableEntities.length ? 
                  `Selecciona ${getLinkableCategoryName(linkingData.categoria).toLowerCase()}` : 
                  'Cargando...'
                }
              </option>
              {linkableEntities.map(entity => (
                <option key={entity.id} value={entity.id}>
                  {entity.nombre || entity.titulo || entity.title || 'Sin nombre'} - {entity.id}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Botón de Vincular */}
        {linkingData.vincular && (
          <div className="form-section">
            <button
              onClick={executeLink}
              disabled={loading}
              className="link-button"
            >
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i> Vinculando...
                </>
              ) : (
                <>
                  <i className="fas fa-link"></i> Vincular
                </>
              )}
            </button>
          </div>
        )}

        {/* Sección 4: Resumen */}
        {linkingData.resumen.categoria && linkingData.resumen.especificoNombre && linkingData.resumen.vincularNombre && linkingData.categoria && (
          <div className="form-section summary-section">
            <label className="form-label">
              <i className="fas fa-clipboard-list"></i> Resumen de la Operación
            </label>
            <div className="summary-content">
              <div className="summary-item">
                <strong>Categoría:</strong> {getCategoryDisplayName(linkingData.categoria)}
              </div>
              <div className="summary-item">
                <strong>Específico:</strong> {linkingData.resumen.especificoNombre}
              </div>
              <div className="summary-item">
                <strong>Vinculación:</strong> {getLinkableCategoryName(linkingData.categoria)}: {linkingData.resumen.vincularNombre}
              </div>
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

export default SchoolLinking;