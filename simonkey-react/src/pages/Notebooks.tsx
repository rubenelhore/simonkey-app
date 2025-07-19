// src/pages/Notebooks.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useNavigate, useParams } from 'react-router-dom';
import { useNotebooks } from '../hooks/useNotebooks';
import NotebookList from '../components/NotebookList';
import { auth, db } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import '../styles/Notebooks.css';
import StreakTracker from '../components/StreakTracker';
import { updateNotebook, updateNotebookColor } from '../services/notebookService';
import { useUserType } from '../hooks/useUserType';
import UserTypeBadge from '../components/UserTypeBadge';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import { useAuth } from '../contexts/AuthContext';
import { useSchoolStudentData } from '../hooks/useSchoolStudentData';
import CategoryDropdown from '../components/CategoryDropdown';
import { UnifiedNotebookService } from '../services/unifiedNotebookService';
import { getDomainProgressForNotebook } from '../utils/domainProgress';
import { debugCompareDomainProgress } from '../utils/debugDomainProgress';

const Notebooks: React.FC = () => {
  const { materiaId } = useParams<{ materiaId: string }>();
  const { user, userProfile, loading: authLoading } = useAuth();
  const { notebooks, loading: notebooksLoading, error: notebooksError } = useNotebooks();
  const { schoolNotebooks, loading: schoolNotebooksLoading } = useSchoolStudentData();
  const [adminNotebooks, setAdminNotebooks] = useState<any[]>([]);
  const [adminNotebooksLoading, setAdminNotebooksLoading] = useState(false);
  const [isCreatingNotebook, setIsCreatingNotebook] = useState(false);
  const [newNotebookName, setNewNotebookName] = useState('');
  const [newNotebookDescription, setNewNotebookDescription] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [, setUserEmail] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [materiaData, setMateriaData] = useState<any>(null);
  const navigate = useNavigate();
  const { isSchoolUser, isSchoolTeacher, isSchoolStudent, isSchoolAdmin, isSuperAdmin, subscription } = useUserType();

  const isFreeUser = subscription === 'free';

  // Debug log para verificar el estado de isSuperAdmin
  console.log('Notebooks - isSuperAdmin:', isSuperAdmin);

  // Función temporal para verificar y actualizar usuario como súper admin
  const checkAndUpdateSuperAdmin = async () => {
    const currentUser = auth.currentUser;
    if (currentUser && currentUser.email === 'ruben.elhore@gmail.com') {
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          console.log('Current user data:', userData);
          if (userData.subscription !== 'super_admin') {
            console.log('Updating user to super admin...');
            await updateDoc(doc(db, 'users', currentUser.uid), {
              subscription: 'super_admin',
              updatedAt: serverTimestamp()
            });
            console.log('User updated to super admin');
            // Recargar la página para aplicar cambios
            window.location.reload();
          }
        }
      } catch (error) {
        console.error('Error updating user:', error);
      }
    }
  };

  // Función de prueba para navegar directamente
  const testNavigation = () => {
    console.log('Testing direct navigation to /super-admin');
    window.location.href = '/super-admin';
  };

  // Estados para el componente de personalización
  const [isPersonalizationOpen, setIsPersonalizationOpen] = useState(false);
  const [userData, setUserData] = useState({
    nombre: '',
    apellidos: '',
    tipoAprendizaje: 'Visual', // Valor por defecto
    intereses: ['tecnología']
  });
  const [isLoadingAction, setIsLoadingAction] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const personalizationRef = useRef<HTMLDivElement>(null);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [notebooksDomainProgress, setNotebooksDomainProgress] = useState<Map<string, any>>(new Map());

  // Cargar datos de la materia
  useEffect(() => {
    const loadMateriaData = async () => {
      if (!materiaId) return;
      
      try {
        // Si es admin escolar, buscar en schoolSubjects
        if (isSchoolAdmin) {
          const materiaDoc = await getDoc(doc(db, 'schoolSubjects', materiaId));
          if (materiaDoc.exists()) {
            const data = materiaDoc.data();
            setMateriaData({ 
              id: materiaDoc.id, 
              title: data.nombre,
              color: data.color || '#6147FF',
              ...data 
            });
          }
        } else {
          // Para usuarios regulares, buscar en materias
          const materiaDoc = await getDoc(doc(db, 'materias', materiaId));
          if (materiaDoc.exists()) {
            setMateriaData({ id: materiaDoc.id, ...materiaDoc.data() });
          }
        }
      } catch (error) {
        console.error('Error loading materia:', error);
      }
    };
    
    loadMateriaData();
  }, [materiaId, isSchoolAdmin]);

  // Cargar notebooks para admin escolar
  useEffect(() => {
    const loadAdminNotebooks = async () => {
      if (!isSchoolAdmin || !materiaId) return;
      
      setAdminNotebooksLoading(true);
      try {
        // Usar el servicio unificado para obtener notebooks del profesor/materia
        const notebooksData = await UnifiedNotebookService.getTeacherNotebooks([materiaId]);
        
        // Contar conceptos para cada notebook
        for (const notebook of notebooksData) {
          try {
            const conceptsCollection = await UnifiedNotebookService.getConceptsCollection(notebook.id);
            const conceptsSnapshot = await getDocs(
              query(collection(db, conceptsCollection), where('cuadernoId', '==', notebook.id))
            );
            notebook.conceptCount = conceptsSnapshot.docs.reduce((total, doc) => {
              const data = doc.data();
              return total + (data.conceptos?.length || 0);
            }, 0);
          } catch (error) {
            console.error(`Error counting concepts for notebook ${notebook.id}:`, error);
            notebook.conceptCount = 0;
          }
        }
        
        setAdminNotebooks(notebooksData);
      } catch (error) {
        console.error('Error loading admin notebooks:', error);
      } finally {
        setAdminNotebooksLoading(false);
      }
    };
    
    loadAdminNotebooks();
  }, [isSchoolAdmin, materiaId]);

  useEffect(() => {
    if (user) {
      setUserEmail(user.email);
    }
  }, [user]);

  // Cargar datos del usuario cuando se monta el componente
  useEffect(() => {
    const loadUserData = async () => {
      if (user?.uid) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            
            // Buscar el nombre en múltiples campos para mayor compatibilidad
            const userName = data.nombre || data.displayName || data.username || user.displayName || '';
            
            setUserData({
              nombre: userName,
              apellidos: data.apellidos || '',
              tipoAprendizaje: data.tipoAprendizaje || 'Visual',
              intereses: data.intereses && data.intereses.length > 0 ? data.intereses : ['']
            });
          } else {
            // Si no existe el documento, usar el displayName de Firebase Auth
            setUserData({
              nombre: user.displayName || '',
              apellidos: '',
              tipoAprendizaje: 'Visual',
              intereses: ['']
            });
          }
        } catch (error) {
          console.error("Error loading user data:", error);
          // En caso de error, usar el displayName de Firebase Auth
          setUserData({
            nombre: user.displayName || '',
            apellidos: '',
            tipoAprendizaje: 'Visual',
            intereses: ['']
          });
        }
      }
    };
    
    loadUserData();
  }, [user]);

  // Determine which notebooks to use based on user type
  let effectiveNotebooks = [];
  let isLoading = false;
  
  if (isSchoolAdmin) {
    // Para admin escolar, usar los notebooks cargados específicamente
    effectiveNotebooks = adminNotebooks.map(notebook => ({
      ...notebook,
      userId: notebook.userId || '',
      conceptCount: notebook.conceptCount || 0
    }));
    isLoading = adminNotebooksLoading;
  } else if (isSchoolStudent) {
    // Para estudiantes escolares
    effectiveNotebooks = (schoolNotebooks || []).map(notebook => ({
      ...notebook,
      userId: notebook.userId || user?.uid || '',
      conceptCount: notebook.conceptCount || 0
    }));
    isLoading = schoolNotebooksLoading;
  } else {
    // Para usuarios regulares
    effectiveNotebooks = notebooks || [];
    isLoading = notebooksLoading;
  }
    
  // Si estamos dentro de una materia, filtrar solo los notebooks de esa materia
  if (materiaId && !isSchoolAdmin) {
    effectiveNotebooks = effectiveNotebooks.filter(notebook => {
      // Para estudiantes escolares, el campo es 'idMateria', para usuarios regulares es 'materiaId'
      const notebookMateriaId = isSchoolStudent ? notebook.idMateria : notebook.materiaId;
      return notebookMateriaId === materiaId;
    });
  }

  // Ahora sí, calcula el domainProgress para todos los cuadernos
  useEffect(() => {
    const calculateAllDomainProgress = async () => {
      if (!effectiveNotebooks || effectiveNotebooks.length === 0) return;
      const progressMap = new Map();
      for (const notebook of effectiveNotebooks) {
        try {
          const progress = await getDomainProgressForNotebook(notebook.id);
          progressMap.set(notebook.id, progress);
        } catch (error) {
          console.error(`Error calculating progress for notebook ${notebook.id}:`, error);
        }
      }
      setNotebooksDomainProgress(progressMap);
    };
    calculateAllDomainProgress();
  }, [notebooks?.length, schoolNotebooks?.length, adminNotebooks?.length, user?.uid, materiaId]);
  
  // Función temporal de debug
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).debugNotebookProgress = async (notebookId: string) => {
        console.log('🔍 Running domain progress debug...');
        await debugCompareDomainProgress(notebookId);
      };
      console.log('💡 Debug function available: window.debugNotebookProgress(notebookId)');
    }
  }, []);

  const handleCreate = async () => {
    console.log("Notebook created successfully");
    // Forzar actualización de categorías
    setRefreshTrigger(prev => prev + 1);
  };

  const handleDelete = (id: string) => {
    console.log(`Notebook with id ${id} deleted successfully`);
    // Forzar actualización de categorías
    setRefreshTrigger(prev => prev + 1);
  };

  const handleEdit = async (id: string, newTitle: string) => {
    console.log('handleEdit llamado con:', { id, newTitle, userId: user?.uid });
    if (!user?.uid) return;
    
    try {
      console.log('Llamando a updateNotebook...');
      await updateNotebook(id, newTitle, user.uid);
      console.log("Título actualizado en Firestore");
      // Forzar actualización de categorías
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error("Error actualizando el título:", error);
      console.error("Tipo de error:", typeof error);
      console.error("Mensaje de error:", error instanceof Error ? error.message : 'Error desconocido');
      
      // Si es un error de nombre duplicado, solo lanzar la excepción
      if (error instanceof Error && error.message.includes('Ya existe una materia con ese nombre')) {
        console.log('Error de nombre duplicado detectado, lanzando excepción');
        // No mostrar alert, el error se muestra visualmente en el input
        throw error;
      } else {
        console.log('Error no es de nombre duplicado, mostrando alert genérico');
        throw error;
      }
    }
  };

  const handleColorChange = async (id: string, newColor: string) => {
    try {
      await updateNotebookColor(id, newColor);
    } catch (error) {
      console.error("Error updating notebook color:", error);
    }
  };

  const handleAddConcept = (notebookId: string) => {
    // Navegar a la página de detalles del cuaderno con parámetro para abrir modal automáticamente
    if (materiaId) {
      navigate(`/materias/${materiaId}/notebooks/${notebookId}?openModal=true`);
    } else {
      navigate(`/notebooks/${notebookId}?openModal=true`);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    // Añadir un pequeño delay antes de navegar
    setTimeout(() => {
      navigate('/');
    }, 100);
  };

  const toggleMenu = () => {
    setMenuOpen(prevState => !prevState);
    // Prevenir scroll cuando el menú está abierto
    if (!menuOpen) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('menu-open');
    } else {
      document.body.style.overflow = 'auto';
      document.body.classList.remove('menu-open');
    }
  };

  // Modificar el handler de personalización para navegar a ProfilePage
  const handleOpenPersonalization = () => {
    navigate('/profile');
  };

  const handleClosePersonalization = () => {
    setIsPersonalizationOpen(false);
  };

  // Efecto para cerrar el modal al hacer clic fuera de él
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (personalizationRef.current && !personalizationRef.current.contains(event.target as Node)) {
        setIsPersonalizationOpen(false);
      }
    }
    
    if (isPersonalizationOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPersonalizationOpen]);

  // Efecto para limpiar el estado del body cuando el componente se desmonte
  useEffect(() => {
    return () => {
      document.body.style.overflow = 'auto';
      document.body.classList.remove('menu-open');
    };
  }, []);

  // Efecto para cerrar el menú con la tecla Escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menuOpen) {
        toggleMenu();
      }
    };

    if (menuOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen]);

  // Manejar cambios en los campos de personalización
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setUserData(prevData => ({
      ...prevData,
      [name]: value
    }));
  };

  // Manejar cambios en los intereses
  const handleInterestChange = (index: number, value: string) => {
    const updatedInterests = [...userData.intereses];
    updatedInterests[index] = value;
    setUserData(prevData => ({
      ...prevData,
      intereses: updatedInterests
    }));
  };

  // Añadir un nuevo interés
  const addInterest = () => {
    if (userData.intereses.length < 12) {
      setUserData(prevData => ({
        ...prevData,
        intereses: [...prevData.intereses, '']
      }));
    }
  };

  // Eliminar un interés
  const removeInterest = (index: number) => {
    const updatedInterests = userData.intereses.filter((_, i) => i !== index);
    setUserData(prevData => ({
      ...prevData,
      intereses: updatedInterests.length ? updatedInterests : ['']
    }));
  };

  // Guardar datos de personalización
  const handleSavePersonalization = async () => {
    if (!user?.uid) return;
    
    setIsLoadingAction(true);
    
    try {
      // Filtrar intereses vacíos
      const filteredInterests = userData.intereses.filter(interest => interest.trim() !== '');
      
      // Crear objeto con datos del usuario
      const userDataToSave = {
        ...userData,
        intereses: filteredInterests,
        updatedAt: new Date()
      };
      
      // Guardar en Firestore
      await setDoc(doc(db, 'users', user.uid), userDataToSave, { merge: true });
      
      setSuccessMessage('¡Datos guardados correctamente!');
      setIsLoadingAction(false);
      
      // Opcional: cerrar modal después de un tiempo
      setTimeout(() => {
        setIsPersonalizationOpen(false);
        setSuccessMessage('');
      }, 2000);
    } catch (error) {
      console.error("Error saving user data:", error);
      setIsLoadingAction(false);
    }
  };

  const handleOpenUpgradeModal = () => {
    setIsUpgradeModalOpen(true);
    setMenuOpen(false);
  };

  const handleCloseUpgradeModal = () => {
    setIsUpgradeModalOpen(false);
  };

  const handleCategorySelect = (category: string | null) => {
    setSelectedCategory(category);
  };

  const handleCreateCategory = () => {
    setShowCategoryModal(true);
  };

  const handleClearSelectedCategory = () => {
    setSelectedCategory(null);
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Cargando materias...</p>
      </div>
    );
  }

  if (!isSchoolStudent && notebooksError) {
    console.error('Error loading notebooks:', notebooksError);
    return (
      <div className="error-container">
        <h2>Error al cargar las materias</h2>
        <p>{notebooksError.message}</p>
      </div>
    );
  }

  return (
    <>
      <HeaderWithHamburger
        title=""
        subtitle={materiaData ? `Cuadernos de ${materiaData.title}` : `Espacio Personal de ${userData.nombre || 'Simón'}`}
        showBackButton={!!materiaId}
        onBackClick={() => navigate('/materias')}
        themeColor={materiaData?.color}
      />
      {/* Overlay y menú lateral ya están dentro del header */}
      <main className="notebooks-main notebooks-main-no-sidebar">
        {isSchoolAdmin && (
          <div className="admin-info-message" style={{
            background: '#f0ebff',
            border: '1px solid #6147FF',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem',
            color: '#4a5568'
          }}>
            <i className="fas fa-info-circle" style={{ marginRight: '0.5rem', color: '#6147FF' }}></i>
            <span>Como administrador, tienes acceso de solo lectura a los cuadernos y conceptos.</span>
          </div>
        )}
        <div className="notebooks-list-section notebooks-list-section-full">
          <NotebookList 
            notebooks={effectiveNotebooks.map(notebook => ({
              id: notebook.id,
              title: notebook.title,
              color: notebook.color,
              category: notebook.category,
              userId: notebook.userId || user?.uid || '',
              createdAt: notebook.createdAt instanceof Date ? 
                notebook.createdAt : 
                (notebook.createdAt && typeof notebook.createdAt.toDate === 'function' ? 
                  notebook.createdAt.toDate() : 
                  new Date()),
              updatedAt: notebook.updatedAt instanceof Date ? 
                notebook.updatedAt : 
                (notebook.updatedAt && typeof notebook.updatedAt.toDate === 'function' ? 
                  notebook.updatedAt.toDate() : 
                  new Date()),
              conceptCount: notebook.conceptCount || 0,
              domainProgress: notebooksDomainProgress.get(notebook.id),
              isStudent: isSchoolStudent,
              isFrozen: notebook.isFrozen,
              frozenScore: notebook.frozenScore,
              frozenAt: notebook.frozenAt
            }))} 
            onDeleteNotebook={(isSchoolStudent || isSchoolAdmin) ? undefined : handleDelete} 
            onEditNotebook={(isSchoolStudent || isSchoolAdmin) ? undefined : handleEdit}
            onColorChange={(isSchoolStudent || isSchoolAdmin) ? undefined : handleColorChange}
            onCreateNotebook={(isSchoolStudent || isSchoolAdmin) ? undefined : handleCreate}
            onAddConcept={(isSchoolStudent || isSchoolAdmin) ? undefined : handleAddConcept}
            showCreateButton={!isSchoolStudent && !isSchoolAdmin}
            isSchoolTeacher={false} // School students and admins should navigate to regular routes, not school routes
            selectedCategory={selectedCategory}
            showCategoryModal={showCategoryModal}
            onCloseCategoryModal={() => setShowCategoryModal(false)}
            onClearSelectedCategory={handleClearSelectedCategory}
            onRefreshCategories={() => setRefreshTrigger(prev => prev + 1)}
            materiaColor={materiaData?.color}
          />
        </div>
      </main>
      {/* Modal de personalización */}
      {isPersonalizationOpen && (
        <div className="modal-overlay">
          <div className="modal-content personalization-modal" ref={personalizationRef}>
            <div className="modal-header">
              <h2>Personalización</h2>
              <button className="close-button" onClick={handleClosePersonalization}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="nombre">Nombre</label>
                <input
                  type="text"
                  id="nombre"
                  name="nombre"
                  value={userData.nombre}
                  onChange={handleInputChange}
                  placeholder="Tu nombre"
                  className="form-control"
                />
              </div>
              <div className="form-group">
                <label htmlFor="apellidos">Apellido(s)</label>
                <input
                  type="text"
                  id="apellidos"
                  name="apellidos"
                  value={userData.apellidos}
                  onChange={handleInputChange}
                  placeholder="Tus apellidos"
                  className="form-control"
                />
              </div>
              <div className="form-group">
                <label htmlFor="tipoAprendizaje">Tipo de aprendizaje predilecto</label>
                <select
                  id="tipoAprendizaje"
                  name="tipoAprendizaje"
                  value={userData.tipoAprendizaje}
                  onChange={handleInputChange}
                  className="form-control"
                >
                  <option value="Visual">Visual</option>
                  <option value="Auditivo">Auditivo</option>
                  <option value="Kinestésico">Kinestésico</option>
                </select>
              </div>
              <div className="form-group">
                <label>Intereses (máximo 12)</label>
                {userData.intereses.map((interes, index) => (
                  <div key={index} className="interest-input-group">
                    <input
                      type="text"
                      value={interes}
                      onChange={(e) => handleInterestChange(index, e.target.value)}
                      placeholder="Ej: cocina, deportes, tecnología"
                      className="form-control interest-input"
                    />
                    <button
                      type="button"
                      onClick={() => removeInterest(index)}
                      className="remove-interest-btn"
                      disabled={userData.intereses.length === 1}
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                ))}
                {userData.intereses.length < 12 && (
                  <button
                    type="button"
                    onClick={addInterest}
                    className="add-interest-btn"
                  >
                    <i className="fas fa-plus"></i> Añadir interés
                  </button>
                )}
              </div>
              {successMessage && (
                <div className="success-message">
                  {successMessage}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="save-button"
                onClick={handleSavePersonalization}
                disabled={isLoadingAction}
              >
                {isLoadingAction ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
      {isUpgradeModalOpen && (
        <div className="modal-overlay">
          <div className="upgrade-modal-content">
            <div className="modal-header">
              <h2>🚀 Upgrade a Pro</h2>
              <button className="close-button" onClick={handleCloseUpgradeModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="upgrade-motivational-section">
                <h3>💡 Invierte en tu futuro y desarrollo</h3>
                <p className="motivational-text">
                  Al hacer el upgrade a Pro, no solo estás desbloqueando funcionalidades avanzadas, 
                  sino que estás invirtiendo en tu crecimiento personal y profesional. 
                  Cada concepto que aprendas, cada herramienta que utilices, 
                  te acerca un paso más a tus metas y objetivos.
                </p>
                <p className="motivational-text">
                  <strong>¡Tu desarrollo es nuestra prioridad!</strong> 
                  Descubre todo el potencial que Simonkey Pro tiene para ofrecerte.
                </p>
              </div>
              
              <div className="upgrade-support-section">
                <h4>📧 ¿Necesitas ayuda para decidir?</h4>
                <p>Nuestro equipo de soporte está aquí para ayudarte:</p>
                <div className="support-contact">
                  <i className="fas fa-envelope"></i>
                  <span>soporte@simonkey.com</span>
                </div>
                <p className="support-note">
                  Te responderemos en menos de 24 horas con toda la información que necesites.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      <footer className="notebooks-footer">
        <p>&copy; {new Date().getFullYear()} Simonkey - Todos los derechos reservados</p>
      </footer>
    </>
  );
};

export default Notebooks;