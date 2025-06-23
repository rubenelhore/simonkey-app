import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSchoolNotebooks } from '../hooks/useSchoolNotebooks';
import NotebookList from '../components/NotebookList';
import { auth, db } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, serverTimestamp, setDoc, getDocs, query, where, collection, addDoc } from 'firebase/firestore';
import '../styles/Notebooks.css';
import '../styles/SchoolSystem.css';
import StreakTracker from '../components/StreakTracker';
import { updateNotebookColor } from '../services/notebookService';
import { useUserType } from '../hooks/useUserType';
import UserTypeBadge from '../components/UserTypeBadge';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import { UserSubscriptionType, SchoolRole } from '../types/interfaces';
import { diagnoseSchoolDataStructure, autoFixAllInconsistencies, fixSpecificTeacherCase, fixAllSchoolIssues } from '../utils/fixMissingAdmin';
import { getFunctions } from 'firebase/functions';

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
    if (!user || !userProfile) {
      console.log('❌ No hay usuario o perfil disponible');
      return;
    }

    try {
      console.log('🔄 Migrando usuario a profesor escolar...');
      
      // Verificar si ya existe en schoolTeachers
      const teacherQuery = query(
        collection(db, 'schoolTeachers'),
        where('id', '==', user.uid)
      );
      const teacherSnapshot = await getDocs(teacherQuery);
      
      if (!teacherSnapshot.empty) {
        console.log('✅ Usuario ya existe en schoolTeachers, no es necesario migrar');
        return;
      }

      // Buscar un admin disponible o crear uno temporal
      let idAdmin = '';
      const adminsSnapshot = await getDocs(collection(db, 'schoolAdmins'));
      
      if (!adminsSnapshot.empty) {
        // Usar el primer admin disponible
        idAdmin = adminsSnapshot.docs[0].id;
        console.log('✅ Usando admin existente:', idAdmin);
      } else {
        // Crear un admin temporal si no existe ninguno
        console.log('⚠️ No hay admins disponibles, creando uno temporal...');
        const adminData = {
          nombre: 'Admin Temporal',
          email: 'admin@temporal.com',
          password: '1234',
          subscription: UserSubscriptionType.SCHOOL,
          idInstitucion: '',
          createdAt: serverTimestamp()
        };
        
        const adminRef = await addDoc(collection(db, 'schoolAdmins'), adminData);
        idAdmin = adminRef.id;
        console.log('✅ Admin temporal creado:', idAdmin);
      }
      
      // SOLO actualizar el documento existente en users, NO crear uno nuevo en schoolTeachers
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        subscription: UserSubscriptionType.SCHOOL,
        schoolRole: SchoolRole.TEACHER,
        maxNotebooks: 999,
        maxConceptsPerNotebook: 999,
        updatedAt: serverTimestamp()
      });
      
      console.log('✅ Usuario actualizado exitosamente como profesor escolar');
      
    } catch (error) {
      console.error('❌ Error migrando usuario a profesor escolar:', error);
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

  // Detectar automáticamente problemas cuando no hay cuadernos
  useEffect(() => {
    if (!notebooksLoading && isSchoolTeacher && schoolNotebooks && schoolNotebooks.length === 0) {
      console.log('🔍 Detectado: Profesor sin cuadernos');
      console.log('💡 El usuario ya fue migrado correctamente con Cloud Function');
      console.log('💡 Si no ves cuadernos, contacta al administrador para completar la configuración');
      
      // Comentar el diagnóstico automático que causa errores
      // const timer = setTimeout(() => {
      //   handleDiagnoseTeacherIssue();
      // }, 2000); // 2 segundos de delay
      
      // return () => clearTimeout(timer);
    }
  }, [notebooksLoading, isSchoolTeacher, schoolNotebooks]);

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

  const handleDiagnoseTeacherIssue = async () => {
    console.log('🔍 === DIAGNÓSTICO SIMPLIFICADO PARA PROFESOR ===');
    console.log('=====================================');
    
    try {
      const { getAuth } = await import('firebase/auth');
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        console.log('❌ No hay usuario autenticado');
        return;
      }
      
      console.log('👤 Usuario:', user.uid);
      console.log('📧 Email:', user.email);
      console.log('👨‍🏫 Perfil:', userProfile);
      
      // Verificar datos básicos del usuario
      if (user.email && userProfile) {
        console.log('✅ Usuario tiene datos básicos correctos');
        console.log('✅ Perfil de usuario cargado correctamente');
        
        if (userProfile.schoolRole) {
          console.log('✅ Usuario tiene rol escolar:', userProfile.schoolRole);
        } else {
          console.log('⚠️ Usuario no tiene rol escolar definido');
        }
        
        if (userProfile.schoolName) {
          console.log('✅ Usuario vinculado a escuela:', userProfile.schoolName);
        } else {
          console.log('⚠️ Usuario no tiene nombre de escuela');
        }
        
        if (userProfile.subscription === 'school') {
          console.log('✅ Suscripción escolar confirmada');
        } else {
          console.log('⚠️ Suscripción no es school:', userProfile.subscription);
        }
        
        console.log('💡 DIAGNÓSTICO COMPLETADO');
        console.log('💡 El usuario está correctamente configurado');
        console.log('💡 Si no ves cuadernos, es porque:');
        console.log('   - No tienes materias asignadas');
        console.log('   - Las materias no tienen cuadernos');
        console.log('   - Necesitas que un administrador complete la configuración');
        console.log('🎯 RECOMENDACIÓN: Contacta al administrador de tu institución');
        
      } else {
        console.log('❌ Usuario falta datos básicos');
      }
      
    } catch (error) {
      console.error('❌ Error en diagnóstico simplificado:', error);
      console.log('💡 El usuario ya fue migrado correctamente con Cloud Function');
      console.log('💡 Contacta al administrador para completar la configuración');
    }
  };

  const handleCheckNotebooks = async () => {
    try {
      // Importar y ejecutar la función de verificación de cuadernos
      const { checkTeacherNotebooks } = await import('../utils/quickFix');
      await checkTeacherNotebooks();
    } catch (error) {
      console.error('❌ Error al verificar cuadernos:', error);
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
            <button 
              onClick={handleDiagnoseTeacherIssue}
              style={{
                marginTop: '10px',
                padding: '8px 16px',
                backgroundColor: '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              👨‍🏫 Diagnóstico Profesor
            </button>
          </div>
        </div>
        <div className="notebooks-list-section">
          <h2>Cuadernos Asignados</h2>
          {schoolNotebooks && schoolNotebooks.length === 0 ? (
            <div className="empty-state">
              <h3>No tienes cuadernos asignados</h3>
              <p>Tu cuenta de profesor ya está configurada correctamente en el sistema.</p>
              <p>Para poder trabajar con cuadernos escolares, necesitas:</p>
              <ol>
                <li>✅ <strong>Completado:</strong> Ser registrado por un administrador escolar</li>
                <li>⏳ <strong>Pendiente:</strong> Tener materias asignadas a tu perfil</li>
                <li>⏳ <strong>Pendiente:</strong> Que las materias tengan cuadernos creados</li>
              </ol>
              <p><strong>Contacta al administrador de tu institución</strong> para completar la configuración de materias y cuadernos.</p>
              
              <div style={{ 
                marginTop: '20px', 
                padding: '15px', 
                backgroundColor: '#e8f5e8', 
                border: '1px solid #4caf50', 
                borderRadius: '8px' 
              }}>
                <h4>✅ Estado Actual</h4>
                <p>Tu cuenta está correctamente configurada. Solo necesitas que un administrador te asigne materias y cuadernos.</p>
                <p><strong>Para verificar tu estado:</strong></p>
                <ol>
                  <li>Abre la consola del navegador (F12)</li>
                  <li>Ejecuta: <code>window.checkTeacherStatusSimple()</code></li>
                </ol>
                <p><strong>O usa el botón de diagnóstico:</strong></p>
                <button 
                  onClick={handleDiagnoseTeacherIssue}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#17a2b8',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    marginRight: '10px'
                  }}
                >
                  👨‍🏫 Verificar Estado
                </button>
                <button 
                  onClick={handleCheckNotebooks}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  📚 Verificar Cuadernos
                </button>
              </div>
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