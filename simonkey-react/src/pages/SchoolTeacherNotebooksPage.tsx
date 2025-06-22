import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSchoolNotebooks } from '../hooks/useSchoolNotebooks';
import NotebookList from '../components/NotebookList';
import { auth, db } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, serverTimestamp, setDoc, getDocs, query, where, collection } from 'firebase/firestore';
import '../styles/Notebooks.css';
import '../styles/SchoolSystem.css';
import StreakTracker from '../components/StreakTracker';
import { updateNotebookColor } from '../services/notebookService';
import { useUserType } from '../hooks/useUserType';
import UserTypeBadge from '../components/UserTypeBadge';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import { UserSubscriptionType, SchoolRole } from '../types/interfaces';
import { diagnoseSchoolDataStructure, autoFixAllInconsistencies, fixSpecificTeacherCase, fixAllSchoolIssues } from '../utils/fixMissingAdmin';

const SchoolTeacherNotebooksPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, userProfile, loading: authLoading } = useAuth();
  const { schoolNotebooks, loading: notebooksLoading, error: notebooksError } = useSchoolNotebooks();
  const [isCreatingNotebook, setIsCreatingNotebook] = useState(false);
  const [newNotebookName, setNewNotebookName] = useState('');
  const [newNotebookDescription, setNewNotebookDescription] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [, setUserEmail] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { isSchoolTeacher } = useUserType();

  // Deep log: teacher role and notebooks
  console.log('🔍 SchoolTeacherNotebooksPage - userProfile:', userProfile);
  console.log('🔍 SchoolTeacherNotebooksPage - isSchoolTeacher:', isSchoolTeacher);
  console.log('🔍 SchoolTeacherNotebooksPage - schoolNotebooks:', schoolNotebooks);
  console.log('🔍 SchoolTeacherNotebooksPage - loading:', notebooksLoading, 'error:', notebooksError);

  // Función temporal para migrar usuario a schoolTeachers si no existe
  const migrateUserToSchoolTeachers = async () => {
    if (!user?.uid || !userProfile) return;
    
    try {
      console.log('🔄 Verificando si usuario existe en schoolTeachers...');
      
      // Verificar si ya existe en schoolTeachers
      const teacherQuery = query(
        collection(db, 'schoolTeachers'),
        where('id', '==', user.uid)
      );
      const teacherSnapshot = await getDocs(teacherQuery);
      
      if (!teacherSnapshot.empty) {
        console.log('✅ Usuario ya existe en schoolTeachers');
        return;
      }
      
      console.log('🔄 Usuario no existe en schoolTeachers, creando registro...');
      
      // Buscar un admin disponible para vincular
      const adminQuery = query(
        collection(db, 'schoolAdmins'),
        where('idInstitucion', '!=', '') // Buscar admins que tengan institución asignada
      );
      const adminSnapshot = await getDocs(adminQuery);
      
      let idAdmin = '';
      if (!adminSnapshot.empty) {
        // Usar el primer admin disponible
        const firstAdmin = adminSnapshot.docs[0];
        idAdmin = firstAdmin.id;
        console.log('🔗 Vinculando profesor al admin:', idAdmin);
      } else {
        console.log('⚠️ No hay admins disponibles, el profesor quedará sin vincular');
      }
      
      // Crear registro en schoolTeachers
      await setDoc(doc(db, 'schoolTeachers', user.uid), {
        id: user.uid,
        nombre: userProfile.nombre || userProfile.displayName || userProfile.username || 'Profesor',
        email: userProfile.email,
        password: '1234', // Password por defecto
        subscription: UserSubscriptionType.SCHOOL,
        idAdmin: idAdmin, // Vincular al admin encontrado o dejar vacío
        createdAt: userProfile.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      console.log('✅ Usuario migrado exitosamente a schoolTeachers');
      
    } catch (error) {
      console.error('❌ Error migrando usuario a schoolTeachers:', error);
    }
  };

  // Verificar autorización
  useEffect(() => {
    // SOLO redirigir si loading es false
    if (!notebooksLoading && !isSchoolTeacher) {
      console.log('❌ Usuario no autorizado como profesor escolar, redirigiendo a /');
      navigate('/');
      return;
    }
  }, [isSchoolTeacher, notebooksLoading, navigate]);

  // Migrar usuario a schoolTeachers cuando se carga el componente
  useEffect(() => {
    if (user && userProfile && isSchoolTeacher) {
      migrateUserToSchoolTeachers();
    }
  }, [user, userProfile, isSchoolTeacher]);

  // Estados para personalización del usuario
  const [isPersonalizationOpen, setIsPersonalizationOpen] = useState(false);
  const [userData, setUserData] = useState({
    nombre: '',
    apellidos: '',
    tipoAprendizaje: 'Visual',
    intereses: ['educación']
  });
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const personalizationRef = useRef<HTMLDivElement>(null);

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
            
            const userName = data.nombre || data.displayName || data.username || user.displayName || '';
            
            setUserData({
              nombre: userName,
              apellidos: data.apellidos || '',
              tipoAprendizaje: data.tipoAprendizaje || 'Visual',
              intereses: data.intereses && data.intereses.length > 0 ? data.intereses : ['educación']
            });
          } else {
            setUserData({
              nombre: user.displayName || '',
              apellidos: '',
              tipoAprendizaje: 'Visual',
              intereses: ['educación']
            });
          }
        } catch (error) {
          console.error("Error loading user data:", error);
          setUserData({
            nombre: user.displayName || '',
            apellidos: '',
            tipoAprendizaje: 'Visual',
            intereses: ['educación']
          });
        }
      }
    };
    
    loadUserData();
  }, [user]);

  // Los profesores NO pueden crear cuadernos
  const handleCreate = async () => {
    console.log("Los profesores no pueden crear cuadernos escolares");
    alert("Los profesores no pueden crear cuadernos. Solo pueden editar los cuadernos asignados por el administrador.");
  };

  // Los profesores NO pueden eliminar cuadernos
  const handleDelete = (id: string) => {
    console.log(`Intento de eliminar cuaderno ${id} - NO PERMITIDO para profesores`);
    alert("Los profesores no pueden eliminar cuadernos escolares. Solo pueden añadir conceptos y cambiar colores.");
  };

  // Los profesores SÍ pueden editar el título del cuaderno
  const handleEdit = async (id: string, newTitle: string) => {
    try {
      // Actualizar en la colección schoolNotebooks en lugar de notebooks
      const notebookRef = doc(db, "schoolNotebooks", id);
      await updateDoc(notebookRef, { 
        title: newTitle,
        updatedAt: serverTimestamp()
      });
      console.log("Título del cuaderno escolar actualizado");
    } catch (error) {
      console.error("Error actualizando el título del cuaderno escolar:", error);
      alert("Error al actualizar el título del cuaderno");
    }
  };

  // Los profesores SÍ pueden cambiar el color del cuaderno
  const handleColorChange = async (id: string, newColor: string) => {
    try {
      // Actualizar en la colección schoolNotebooks
      const notebookRef = doc(db, 'schoolNotebooks', id);
      await updateDoc(notebookRef, {
        color: newColor,
        updatedAt: serverTimestamp()
      });
      console.log("Color del cuaderno escolar actualizado");
    } catch (error) {
      console.error("Error updating school notebook color:", error);
      alert("Error al actualizar el color del cuaderno");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setTimeout(() => {
      navigate('/');
    }, 100);
  };

  const toggleMenu = () => {
    setMenuOpen(prevState => !prevState);
    if (!menuOpen) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('menu-open');
    } else {
      document.body.style.overflow = 'auto';
      document.body.classList.remove('menu-open');
    }
  };

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

  // Función para ejecutar diagnóstico
  const handleDiagnoseData = async () => {
    if (user) {
      console.log('🔍 Ejecutando diagnóstico de datos escolares...');
      await diagnoseSchoolDataStructure(user.uid);
    }
  };

  // Función para corrección automática
  const handleAutoFix = async () => {
    if (user) {
      console.log('🔧 Ejecutando corrección automática...');
      await autoFixAllInconsistencies(user.uid);
      // Recargar la página después de la corrección
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  };

  // Función para corrección específica del caso
  const handleSpecificFix = async () => {
    console.log('🔧 Ejecutando corrección específica...');
    await fixSpecificTeacherCase();
    // Recargar la página después de la corrección
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  };

  // Función para corrección completa
  const handleCompleteFix = async () => {
    if (user) {
      console.log('🔧 Ejecutando corrección completa...');
      await fixAllSchoolIssues(user.uid);
      // Recargar la página después de la corrección
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    }
  };

  if (notebooksLoading) {
    console.log('⏳ SchoolTeacherNotebooksPage - loading...');
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Cargando tus cuadernos escolares...</p>
      </div>
    );
  }

  if (notebooksError) {
    console.error('❌ SchoolTeacherNotebooksPage - error:', notebooksError);
    return (
      <div className="error-container">
        <p>Ocurrió un error al cargar los cuadernos escolares. Por favor, intenta de nuevo.</p>
      </div>
    );
  }

  return (
    <>
      <HeaderWithHamburger
        title="Área del Profesor"
        subtitle={`Cuadernos Escolares - ${userData.nombre || 'Profesor'}`}
      />
      <main className="notebooks-main">
        <div className="left-column">
          <StreakTracker />
          <div className="teacher-info-card">
            <h3>👨‍🏫 Panel del Profesor</h3>
            <p>• Puedes añadir conceptos a los cuadernos</p>
            <p>• Puedes cambiar el título y color</p>
            <p>• No puedes crear o eliminar cuadernos</p>
            <button 
              onClick={handleDiagnoseData}
              style={{
                marginTop: '10px',
                padding: '8px 16px',
                backgroundColor: '#6147FF',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                marginRight: '8px'
              }}
            >
              🔍 Diagnosticar Datos
            </button>
            <button 
              onClick={handleAutoFix}
              style={{
                marginTop: '10px',
                padding: '8px 16px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                marginRight: '8px'
              }}
            >
              🔧 Corregir Automáticamente
            </button>
            <button 
              onClick={handleSpecificFix}
              style={{
                marginTop: '10px',
                padding: '8px 16px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                marginRight: '8px'
              }}
            >
              🔧 Corregir Caso Específico
            </button>
            <button 
              onClick={handleCompleteFix}
              style={{
                marginTop: '10px',
                padding: '8px 16px',
                backgroundColor: '#ffc107',
                color: 'black',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              🔧 Corrección Completa
            </button>
          </div>
        </div>
        <div className="notebooks-list-section">
          <h2>Cuadernos Asignados</h2>
          {schoolNotebooks && schoolNotebooks.length === 0 ? (
            <div className="empty-state">
              <h3>No tienes cuadernos asignados</h3>
              <p>Para poder trabajar con cuadernos escolares, necesitas:</p>
              <ol>
                <li>Ser registrado por un administrador escolar</li>
                <li>Tener materias asignadas a tu perfil</li>
                <li>Que las materias tengan cuadernos creados</li>
              </ol>
              <p>Contacta al administrador de tu institución para completar la configuración.</p>
            </div>
          ) : (
            <NotebookList 
              notebooks={(schoolNotebooks || []).map((notebook: any) => ({
                id: notebook.id,
                title: notebook.title,
                color: notebook.color,
                userId: notebook.userId,
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
                conceptCount: notebook.conceptCount || 0
              }))} 
              onDeleteNotebook={handleDelete} 
              onEditNotebook={handleEdit}
              onColorChange={handleColorChange}
              onCreateNotebook={handleCreate}
              isSchoolTeacher={true}
            />
          )}
        </div>
      </main>
      <footer className="notebooks-footer">
        <p>&copy; {new Date().getFullYear()} Simonkey - Sistema Escolar</p>
      </footer>
    </>
  );
};

export default SchoolTeacherNotebooksPage; 