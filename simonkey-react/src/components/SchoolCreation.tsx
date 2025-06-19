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
  serverTimestamp 
} from 'firebase/firestore';
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

  // Campos requeridos por categoría
  const getRequiredFields = (category: SchoolCategory): string[] => {
    switch (category) {
      case SchoolCategory.INSTITUCIONES:
        return ['nombre'];
      case SchoolCategory.ADMINS:
        return ['nombre', 'email'];
      case SchoolCategory.PROFESORES:
        return ['nombre', 'email'];
      case SchoolCategory.SALONES:
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
        case SchoolCategory.SALONES:
          collectionName = 'schoolClassrooms';
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
      const data = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      }));

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

      let collectionName = '';
      let entityData: any = {
        createdAt: serverTimestamp()
      };

      switch (creationData.categoria) {
        case SchoolCategory.INSTITUCIONES:
          collectionName = 'schoolInstitutions';
          entityData.nombre = creationData.informacionBasica.nombre;
          break;
        case SchoolCategory.ADMINS:
          collectionName = 'schoolAdmins';
          entityData = {
            ...entityData,
            nombre: creationData.informacionBasica.nombre,
            email: creationData.informacionBasica.email,
            password: '1234',
            subscription: UserSubscriptionType.SCHOOL,
            idInstitucion: '' // Se vinculará después
          };
          break;
        case SchoolCategory.PROFESORES:
          collectionName = 'schoolTeachers';
          entityData = {
            ...entityData,
            nombre: creationData.informacionBasica.nombre,
            email: creationData.informacionBasica.email,
            password: '1234',
            subscription: UserSubscriptionType.SCHOOL,
            idAdmin: '' // Se vinculará después
          };
          break;
        case SchoolCategory.SALONES:
          collectionName = 'schoolClassrooms';
          entityData = {
            ...entityData,
            nombre: creationData.informacionBasica.nombre,
            idProfesor: '' // Se vinculará después
          };
          break;
        case SchoolCategory.CUADERNOS:
          collectionName = 'schoolNotebooks';
          entityData = {
            ...entityData,
            title: creationData.informacionBasica.titulo,
            color: 'default',
            idSalon: '' // Se vinculará después
          };
          break;
        case SchoolCategory.ALUMNOS:
          collectionName = 'schoolStudents';
          entityData = {
            ...entityData,
            nombre: creationData.informacionBasica.nombre,
            email: creationData.informacionBasica.email,
            password: '1234',
            subscription: UserSubscriptionType.SCHOOL,
            idCuadernos: [] // Se vinculará después
          };
          break;
        case SchoolCategory.TUTORES:
          collectionName = 'schoolTutors';
          entityData = {
            ...entityData,
            nombre: creationData.informacionBasica.nombre,
            email: creationData.informacionBasica.email,
            password: '1234',
            subscription: UserSubscriptionType.SCHOOL,
            schoolRole: SchoolRole.TUTOR,
            idAlumnos: [] // Se vinculará después
          };
          break;
        default:
          throw new Error('Categoría no válida');
      }

      await addDoc(collection(db, collectionName), entityData);
      
      alert('Entidad creada exitosamente');
      
      // Limpiar formulario
      const requiredFields = getRequiredFields(creationData.categoria);
      const basicInfo: { [key: string]: string } = {};
      requiredFields.forEach(field => {
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

      let collectionName = '';
      switch (creationData.categoria) {
        case SchoolCategory.INSTITUCIONES:
          collectionName = 'schoolInstitutions';
          break;
        case SchoolCategory.ADMINS:
          collectionName = 'schoolAdmins';
          break;
        case SchoolCategory.PROFESORES:
          collectionName = 'schoolTeachers';
          break;
        case SchoolCategory.SALONES:
          collectionName = 'schoolClassrooms';
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
          throw new Error('Categoría no válida');
      }

      await deleteDoc(doc(db, collectionName, creationData.selectedEntity));
      
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
      [SchoolCategory.SALONES]: 'Salones',
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
            <option value={SchoolCategory.SALONES}>Salón</option>
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