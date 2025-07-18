import React, { useState, useEffect } from 'react';
import { 
  SchoolCategory, 
  SchoolLinkingData,
  SchoolInstitution,
  SchoolAdmin,
  SchoolTeacher,
  Notebook,
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
  where,
  getDoc
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
  const [selectedLinkables, setSelectedLinkables] = useState<string[]>([]);

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
          
        case SchoolCategory.ADMINS_II:
          // También cargar admins para la nueva categoría
          const adminsQuery2 = query(
            collection(db, 'users'),
            where('subscription', '==', UserSubscriptionType.SCHOOL),
            where('schoolRole', '==', SchoolRole.ADMIN)
          );
          const adminsSnapshot2 = await getDocs(adminsQuery2);
          
          const adminsQueryUppercase2 = query(
            collection(db, 'users'),
            where('subscription', '==', 'SCHOOL'),
            where('schoolRole', '==', 'ADMIN')
          );
          const adminsSnapshotUppercase2 = await getDocs(adminsQueryUppercase2);
          
          const allAdmins2 = new Map();
          adminsSnapshot2.docs.forEach(doc => {
            allAdmins2.set(doc.id, { id: doc.id, ...doc.data() });
          });
          adminsSnapshotUppercase2.docs.forEach(doc => {
            allAdmins2.set(doc.id, { id: doc.id, ...doc.data() });
          });
          
          data = Array.from(allAdmins2.values());
          break;
          
        // Removido PROFESORES y MATERIAS - ahora se gestionan desde /materias
          
          
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
          
        case SchoolCategory.ADMINS_II:
          // Vincular con Alumnos (sin materias asignadas)
          const studentsQuery2 = query(
            collection(db, 'users'),
            where('subscription', '==', UserSubscriptionType.SCHOOL),
            where('schoolRole', '==', SchoolRole.STUDENT)
          );
          const studentsSnapshot2 = await getDocs(studentsQuery2);
          
          const studentsQueryUppercase2 = query(
            collection(db, 'users'),
            where('subscription', '==', 'SCHOOL'),
            where('schoolRole', '==', 'STUDENT')
          );
          const studentsSnapshotUppercase2 = await getDocs(studentsQueryUppercase2);
          
          const allStudents2 = new Map();
          studentsSnapshot2.docs.forEach(doc => {
            allStudents2.set(doc.id, { id: doc.id, ...doc.data() });
          });
          studentsSnapshotUppercase2.docs.forEach(doc => {
            allStudents2.set(doc.id, { id: doc.id, ...doc.data() });
          });
          
          data = Array.from(allStudents2.values());
          break;
          
        // Removido PROFESORES y MATERIAS - ahora se gestionan desde /materias
          
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
    setSelectedLinkables([]);

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
    setSelectedLinkables([]);
  };

  // Manejar cambio de checkbox para selección múltiple
  const handleLinkableCheckboxChange = (linkableId: string) => {
    setSelectedLinkables(prev => {
      if (prev.includes(linkableId)) {
        return prev.filter(id => id !== linkableId);
      } else {
        return [...prev, linkableId];
      }
    });
  };

  // Manejar seleccionar/deseleccionar todos
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLinkables(linkableEntities.map(e => e.id));
    } else {
      setSelectedLinkables([]);
    }
  };

  // Función removida - las materias ahora se gestionan desde /materias

  // Ejecutar vinculación
  const executeLink = async () => {
    if (!linkingData.categoria || !linkingData.especifico || selectedLinkables.length === 0) {
      alert('Por favor completa todos los campos y selecciona al menos un elemento para vincular.');
      return;
    }

    try {
      setLoading(true);
      let successCount = 0;
      let errorCount = 0;
      
      // Procesar cada entidad seleccionada
      for (const linkableId of selectedLinkables) {
        try {
          switch (linkingData.categoria) {
            case SchoolCategory.INSTITUCIONES:
              // Vincular institución con admins
              await updateDoc(doc(db, 'users', linkableId), {
                idInstitucion: linkingData.especifico,
                updatedAt: serverTimestamp()
              });
              break;
              
            case SchoolCategory.ADMINS:
              // Vincular admin con profesores
              await updateDoc(doc(db, 'users', linkableId), {
                idAdmin: linkingData.especifico,
                updatedAt: serverTimestamp()
              });
              break;
              
            case SchoolCategory.ADMINS_II:
              // Vincular admin con alumnos (establecer idAdmin e idInstitucion)
              const adminId = linkingData.especifico;
              
              // Obtener datos del admin para obtener la institución
              const adminDoc = await getDoc(doc(db, 'users', adminId));
              if (!adminDoc.exists()) {
                throw new Error('Admin no encontrado');
              }
              
              const adminData = adminDoc.data();
              const institutionId = adminData.idInstitucion || '';
              
              // Actualizar el alumno con el admin y la institución
              await updateDoc(doc(db, 'users', linkableId), {
                idAdmin: adminId,
                idInstitucion: institutionId,
                updatedAt: serverTimestamp()
              });
              break;
              
            case SchoolCategory.ALUMNOS:
              // Vincular alumno con tutor (agregar alumno al array idAlumnos del tutor)
              const tutorRef = doc(db, 'users', linkableId);
              const tutorDoc = await getDoc(tutorRef);
              
              if (tutorDoc.exists()) {
                const tutorData = tutorDoc.data();
                const currentAlumnos = tutorData.idAlumnos || [];
                
                if (!currentAlumnos.includes(linkingData.especifico)) {
                  currentAlumnos.push(linkingData.especifico);
                  
                  await updateDoc(tutorRef, {
                    idAlumnos: currentAlumnos,
                    updatedAt: serverTimestamp()
                  });
                }
              }
              break;
            
            default:
              throw new Error('Categoría no válida para vinculación');
          }
          
          successCount++;
        } catch (error) {
          console.error(`Error vinculando entidad ${linkableId}:`, error);
          errorCount++;
        }
      }
      
      // Mostrar mensaje de resultado
      let message = '';
      if (successCount > 0 && errorCount === 0) {
        message = `✅ Se vincularon exitosamente ${successCount} elemento(s).`;
      } else if (successCount > 0 && errorCount > 0) {
        message = `⚠️ Se vincularon ${successCount} elemento(s) exitosamente, pero ${errorCount} fallaron.`;
      } else {
        message = `❌ Error al vincular los elementos. Por favor, intenta de nuevo.`;
      }
      
      alert(message);
      
      // Limpiar formulario si todo fue exitoso
      if (successCount > 0) {
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
        setSelectedLinkables([]);
        onRefresh();
      }
    } catch (error) {
      console.error('Error ejecutando vinculación:', error);
      alert('Error al realizar la vinculación. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryDisplayName = (category: SchoolCategory) => {
    const names: { [key: string]: string } = {
      [SchoolCategory.INSTITUCIONES]: 'Instituciones',
      [SchoolCategory.ADMINS]: 'Administradores',
      [SchoolCategory.ADMINS_II]: 'Administradores II',
      [SchoolCategory.PROFESORES]: 'Profesores',
      [SchoolCategory.MATERIAS]: 'Materias',
      [SchoolCategory.ALUMNOS]: 'Alumnos',
      [SchoolCategory.TUTORES]: 'Tutores'
    };
    return names[category] || '';
  };

  const getLinkableCategoryName = (category: SchoolCategory) => {
    const names: { [key: string]: string } = {
      [SchoolCategory.INSTITUCIONES]: 'Administrador',
      [SchoolCategory.ADMINS]: 'Profesor',
      [SchoolCategory.ADMINS_II]: 'Alumno',
      [SchoolCategory.PROFESORES]: 'Materia',
      [SchoolCategory.MATERIAS]: 'Alumno',
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
            <option value={SchoolCategory.INSTITUCIONES}>Admin</option>
            <option value={SchoolCategory.ADMINS}>Profesor</option>
            <option value={SchoolCategory.ADMINS_II}>Alumno</option>
            <option value={SchoolCategory.ALUMNOS}>Tutor</option>
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
            <div className="linkable-list-container" style={{
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              maxHeight: '300px',
              overflowY: 'auto',
              backgroundColor: '#f9f9f9',
              padding: '12px'
            }}>
              {!linkableEntities.length ? (
                <p style={{ textAlign: 'center', color: '#666', margin: '20px 0' }}>
                  <i className="fas fa-spinner fa-spin"></i> Cargando...
                </p>
              ) : (
                <>
                  {/* Seleccionar todos */}
                  <label className="linkable-checkbox-item" style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px',
                    marginBottom: '8px',
                    backgroundColor: '#e3f2fd',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    border: '1px solid #1976d2'
                  }}>
                    <input
                      type="checkbox"
                      checked={selectedLinkables.length === linkableEntities.length && linkableEntities.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      style={{ marginRight: '10px' }}
                    />
                    <strong>Seleccionar todos ({linkableEntities.length})</strong>
                  </label>
                  
                  {/* Lista de entidades */}
                  {linkableEntities.map(entity => (
                    <label key={entity.id} className="linkable-checkbox-item" style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '10px',
                      marginBottom: '6px',
                      backgroundColor: 'white',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                      <input
                        type="checkbox"
                        checked={selectedLinkables.includes(entity.id)}
                        onChange={() => handleLinkableCheckboxChange(entity.id)}
                        style={{ marginRight: '10px' }}
                      />
                      <span style={{ flex: 1 }}>
                        {entity.nombre || entity.titulo || entity.title || 'Sin nombre'}
                      </span>
                      <span style={{ fontSize: '0.85em', color: '#666' }}>
                        {entity.email || entity.id}
                      </span>
                    </label>
                  ))}
                </>
              )}
            </div>
            {selectedLinkables.length > 0 && (
              <p style={{ 
                marginTop: '8px', 
                fontSize: '0.9em', 
                color: '#1976d2',
                fontWeight: 500
              }}>
                <i className="fas fa-check-circle"></i> {selectedLinkables.length} elemento(s) seleccionado(s)
              </p>
            )}
          </div>
        )}

        {/* Botón de Vincular */}
        {selectedLinkables.length > 0 && (
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
        {linkingData.categoria && linkingData.especifico && selectedLinkables.length > 0 && (
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
                <strong>Elementos a vincular:</strong> {selectedLinkables.length} {getLinkableCategoryName(linkingData.categoria)}(s) seleccionado(s)
              </div>
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>Procesando...</p>
        </div>
      )}
    </div>
  );
};

export default SchoolLinking;