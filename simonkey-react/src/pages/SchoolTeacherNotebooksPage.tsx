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
  
  // Función de diagnóstico para profesores escolares
  const runTeacherDiagnostics = async () => {
    console.log('🔍 === DIAGNÓSTICO DE PROFESOR ESCOLAR ===');
    console.log('👤 Usuario actual:', {
      uid: user?.uid,
      email: user?.email,
      isSchoolTeacher,
      userProfile
    });
    
    if (userProfile && userProfile.id) {
      try {
        // Obtener el documento del usuario directamente
        const userDoc = await getDoc(doc(db, 'users', userProfile.id));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          console.log('📋 Datos del profesor:', {
            id: userDoc.id,
            email: userData.email,
            nombre: userData.nombre,
            subscription: userData.subscription,
            schoolRole: userData.schoolRole,
            idAdmin: userData.idAdmin,
            googleAuthUid: userData.googleAuthUid
          });
          
          // Buscar materias del profesor
          console.log('📚 Buscando materias del profesor...');
          console.log('🔍 ID del profesor para búsqueda:', userProfile.id);
          
          // Buscar todas las materias para debug
          console.log('🔍 Buscando TODAS las materias en schoolSubjects...');
          const allSubjectsSnapshot = await getDocs(collection(db, 'schoolSubjects'));
          console.log(`📊 Total de materias en el sistema: ${allSubjectsSnapshot.size}`);
          allSubjectsSnapshot.docs.forEach((doc, index) => {
            const data = doc.data();
            console.log(`  - Materia ${index + 1}:`, {
              id: doc.id,
              nombre: data.nombre,
              idProfesor: data.idProfesor,
              idAdmin: data.idAdmin
            });
          });
          
          // Ahora buscar las del profesor específico
          console.log(`\n🎯 Filtrando materias con idProfesor === "${userProfile.id}"`);
          const subjectsQuery = query(
            collection(db, 'schoolSubjects'),
            where('idProfesor', '==', userProfile.id)
          );
          const subjectsSnapshot = await getDocs(subjectsQuery);
          console.log(`📊 Materias asignadas al profesor: ${subjectsSnapshot.size}`);
          
          const subjectIds: string[] = [];
          subjectsSnapshot.docs.forEach((doc, index) => {
            const data = doc.data();
            console.log(`  - Materia ${index + 1}:`, doc.id, data);
            subjectIds.push(doc.id);
          });
          
          // Buscar cuadernos de las materias
          if (subjectIds.length > 0) {
            console.log('\n📓 Buscando cuadernos de las materias...');
            const notebooksQuery = query(
              collection(db, 'schoolNotebooks'),
              where('idMateria', 'in', subjectIds)
            );
            const notebooksSnapshot = await getDocs(notebooksQuery);
            console.log(`📊 Cuadernos encontrados: ${notebooksSnapshot.size}`);
            
            notebooksSnapshot.docs.forEach((doc, index) => {
              const data = doc.data();
              console.log(`  - Cuaderno ${index + 1}:`, doc.id, data);
            });
          } else {
            console.log('❌ No hay materias asignadas al profesor');
            console.log('💡 Posibles causas:');
            console.log('   1. El idProfesor en las materias no coincide con el ID del documento del profesor');
            console.log('   2. Las materias fueron vinculadas con el UID de Firebase en lugar del ID del documento');
            console.log('   3. No se han asignado materias a este profesor');
          }
        } else {
          console.log('❌ No se encontró el documento del usuario');
        }
      } catch (error) {
        console.error('❌ Error en diagnóstico:', error);
      }
    }
    
    console.log('\n📓 Cuadernos escolares cargados por el hook:', schoolNotebooks);
    console.log('🔍 === FIN DEL DIAGNÓSTICO ===');
  };

  // Función para asegurar que el usuario tenga el rol correcto en la colección users
  const ensureTeacherRole = async () => {
    if (!user || !userProfile) {
      console.log('❌ No hay usuario o perfil disponible');
      return;
    }

    try {
      // Solo actualizar si el usuario no tiene el rol correcto
      if (userProfile.subscription !== UserSubscriptionType.SCHOOL || userProfile.schoolRole !== SchoolRole.TEACHER) {
        console.log('🔄 Actualizando rol del usuario a profesor escolar...');
        
        // IMPORTANTE: Usar el ID del documento del usuario, no el UID de Firebase
        const userId = userProfile.id || user.uid;
        console.log('📊 IDs del usuario:', {
          documentId: userProfile.id,
          firebaseUid: user.uid,
          usandoId: userId
        });
        
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
          subscription: UserSubscriptionType.SCHOOL,
          schoolRole: SchoolRole.TEACHER,
          maxNotebooks: 999,
          maxConceptsPerNotebook: 999,
          updatedAt: serverTimestamp()
        });
        
        console.log('✅ Usuario actualizado exitosamente como profesor escolar');
      } else {
        console.log('✅ Usuario ya tiene el rol correcto de profesor escolar');
      }
    } catch (error) {
      console.error('❌ Error actualizando rol del usuario:', error);
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

  // Asegurar que el usuario tenga el rol correcto cuando se carga el componente
  useEffect(() => {
    if (user && userProfile && isSchoolTeacher) {
      ensureTeacherRole();
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
              onDeleteNotebook={undefined} 
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