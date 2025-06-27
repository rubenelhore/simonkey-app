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
  SchoolSubject
} from '../types/interfaces';
import { db } from '../services/firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc,
  serverTimestamp 
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
      let collectionName = '';
      switch (category) {
        case SchoolCategory.INSTITUCIONES:
          collectionName = 'schoolInstitutions';
          break;
        case SchoolCategory.ADMINS:
          collectionName = 'schoolAdmins';
          break;
        case SchoolCategory.PROFESORES:
          collectionName = 'schoolTeachers';
          break;
        case SchoolCategory.MATERIAS:
          collectionName = 'schoolSubjects';
          break;
        case SchoolCategory.CUADERNOS:
          collectionName = 'schoolNotebooks';
          break;
        case SchoolCategory.ALUMNOS:
          collectionName = 'schoolStudents';
          break;
        case SchoolCategory.TUTORES:
          collectionName = 'schoolTutors';
          break;
        default:
          return;
      }

      const snapshot = await getDocs(collection(db, collectionName));
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

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
      let linkableCategory = '';
      
      // Definir qué categorías se pueden vincular con cada una
      switch (category) {
        case SchoolCategory.INSTITUCIONES:
          linkableCategory = 'schoolAdmins';
          break;
        case SchoolCategory.ADMINS:
          linkableCategory = 'schoolTeachers';
          break;
        case SchoolCategory.PROFESORES:
          linkableCategory = 'schoolSubjects';
          break;
        case SchoolCategory.MATERIAS:
          linkableCategory = 'schoolNotebooks';
          break;
        case SchoolCategory.CUADERNOS:
          linkableCategory = 'schoolStudents';
          break;
        case SchoolCategory.ALUMNOS:
          linkableCategory = 'schoolTutors';
          break;
        default:
          setLinkableEntities([]);
          return;
      }

      const snapshot = await getDocs(collection(db, linkableCategory));
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

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
      
      switch (linkingData.categoria) {
        case SchoolCategory.INSTITUCIONES:
          collectionName = 'schoolAdmins';
          linkField = 'idInstitucion';
          break;
        case SchoolCategory.ADMINS:
          collectionName = 'schoolTeachers';
          linkField = 'idAdmin';
          break;
        case SchoolCategory.PROFESORES:
          collectionName = 'schoolSubjects';
          linkField = 'idProfesor';
          break;
        case SchoolCategory.MATERIAS:
          collectionName = 'schoolNotebooks';
          linkField = 'idMateria';
          break;
        case SchoolCategory.CUADERNOS:
          collectionName = 'schoolStudents';
          linkField = 'idCuadernos';
          break;
        case SchoolCategory.ALUMNOS:
          collectionName = 'schoolTutors';
          linkField = 'idAlumnos';
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