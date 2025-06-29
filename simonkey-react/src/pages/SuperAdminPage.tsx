import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserType } from '../hooks/useUserType';
import { db, auth, app } from '../services/firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  addDoc,
  serverTimestamp,
  onSnapshot,
  query,
  getDoc,
  setDoc,
  where,
  limit,
  getFirestore
} from 'firebase/firestore';
import { UserSubscriptionType, SchoolRole } from '../types/interfaces';
import { deleteAllUserData, deleteUserCompletely } from '../services/userService';
import { deleteUserWithConfirmation, syncSchoolUsers, migrateUsers } from '../services/firebaseFunctions';
import SchoolLinking from '../components/SchoolLinking';
import SchoolCreation from '../components/SchoolCreation';
import SchoolLinkingVerification from '../components/SchoolLinkingVerification';
import DuplicateAccountsDiagnostic from '../components/DuplicateAccountsDiagnostic';
import SchoolStudentDiagnostic from '../components/SchoolStudentDiagnostic';
import { createTestSchoolData, checkSchoolCollections } from '../utils/testSchoolCollections';
import { cleanDuplicateSchoolTeachers, checkCollectionsStatus } from '../utils/cleanDuplicateUsers';
import { fixRubenelhoreDuplicate, checkRubenelhoreStatus } from '../utils/fixDuplicateUser';
import { migrateAllExistingSchoolUsers, checkUserSyncStatus } from '../utils/migrateExistingSchoolUsers';
import { runCompleteReplicaTest } from '../utils/testReplicaSystem';
// Importar funciones de adminUtils para que estén disponibles globalmente
import '../utils/adminUtils';
import '../styles/SuperAdminPage.css';

interface User {
  id: string;
  email: string;
  nombre: string;
  apellidos: string;
  subscription: UserSubscriptionType;
  schoolRole?: SchoolRole;
  createdAt: any;
  username?: string;
  displayName?: string;
  birthdate?: string;
  notebookCount?: number;
  maxNotebooks?: number;
}

const SuperAdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { isSuperAdmin, userProfile, loading: userTypeLoading } = useUserType();
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResults, setSyncResults] = useState<any>(null);
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);
  const [schools, setSchools] = useState<any[]>([]);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  console.log('SuperAdminPage - Component loaded - FULL VERSION');
  console.log('SuperAdminPage - isSuperAdmin:', isSuperAdmin);
  console.log('SuperAdminPage - userTypeLoading:', userTypeLoading);
  console.log('SuperAdminPage - userProfile:', userProfile);

  // Verificar si el usuario es súper admin
  useEffect(() => {
    console.log('SuperAdminPage - useEffect check - isSuperAdmin:', isSuperAdmin, 'userTypeLoading:', userTypeLoading);
    
    // Solo redirigir si ya terminó de cargar y NO es súper admin
    if (!userTypeLoading && !isSuperAdmin) {
      console.log('SuperAdminPage - Redirecting to /notebooks - not super admin');
      navigate('/notebooks');
    }
  }, [isSuperAdmin, userTypeLoading, navigate]);

  // Listener en tiempo real para usuarios
  useEffect(() => {
    if (!isSuperAdmin) return;

    console.log('🔍 SuperAdminPage - Configurando listener en tiempo real para usuarios');
    setLoading(true);

    // Listener para la colección 'users' (principal)
    const usersUnsubscribe = onSnapshot(
      collection(db, 'users'),
      (usersSnapshot) => {
        const usersData = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as User[];
        
        console.log('SuperAdminPage - Users from "users" collection (realtime):', usersData.length);
        console.log('SuperAdminPage - Users from "users" collection details (realtime):', usersData.map(u => ({
          id: u.id,
          email: u.email,
          nombre: u.nombre,
          displayName: u.displayName,
          username: u.username,
          apellidos: u.apellidos,
          subscription: u.subscription,
          birthdate: u.birthdate,
          notebookCount: u.notebookCount,
          maxNotebooks: u.maxNotebooks
        })));

        // Marcar que el listener está activo
        setIsRealtimeActive(true);

        // Intentar cargar usuarios de la colección 'usuarios' (español) si existe
        const loadUsuariosCollection = async () => {
          try {
            const usuariosSnapshot = await getDocs(collection(db, 'usuarios'));
            const usuariosData = usuariosSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as User[];
            
            console.log('SuperAdminPage - Users from "usuarios" collection:', usuariosData.length);
            console.log('SuperAdminPage - Users from "usuarios" collection details:', usuariosData.map(u => ({
              id: u.id,
              email: u.email,
              nombre: u.nombre,
              displayName: u.displayName,
              username: u.username,
              apellidos: u.apellidos,
              subscription: u.subscription,
              birthdate: u.birthdate,
              notebookCount: u.notebookCount,
              maxNotebooks: u.maxNotebooks
            })));

            // Combinar usuarios de ambas colecciones (evitando duplicados)
            const allUsers = [...usersData];
            usuariosData.forEach(usuario => {
              const exists = allUsers.find(u => u.id === usuario.id);
              if (!exists) {
                allUsers.push(usuario);
              }
            });

            setUsers(allUsers);
            console.log('SuperAdminPage - Total combined users (realtime):', allUsers.length);
          } catch (error) {
            console.log('SuperAdminPage - No "usuarios" collection found, using only "users"');
            setUsers(usersData);
          } finally {
            setLoading(false);
          }
        };

        loadUsuariosCollection();
      },
      (error) => {
        console.error('Error en listener de usuarios:', error);
        setIsRealtimeActive(false);
        setLoading(false);
      }
    );

    // Cleanup function
    return () => {
      console.log('🔍 SuperAdminPage - Limpiando listener de usuarios');
      usersUnsubscribe();
    };
  }, [isSuperAdmin]);

  // Función para mostrar notificaciones
  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };

  // Función para recargar datos manualmente (mantener para compatibilidad)
  const loadData = async () => {
    console.log('SuperAdminPage - loadData called (manual refresh)');
    setLoading(true);
    try {
      // Cargar usuarios de la colección 'users' (principal)
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as User[];
      
      console.log('SuperAdminPage - Users from "users" collection:', usersData.length);
      console.log('SuperAdminPage - Users from "users" collection details:', usersData.map(u => ({
        id: u.id,
        email: u.email,
        nombre: u.nombre,
        displayName: u.displayName,
        username: u.username,
        apellidos: u.apellidos,
        subscription: u.subscription,
        birthdate: u.birthdate,
        notebookCount: u.notebookCount,
        maxNotebooks: u.maxNotebooks
      })));

      // Cargar usuarios de la colección 'usuarios' (español) si existe
      try {
        const usuariosSnapshot = await getDocs(collection(db, 'usuarios'));
        const usuariosData = usuariosSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as User[];
        
        console.log('SuperAdminPage - Users from "usuarios" collection:', usuariosData.length);
        console.log('SuperAdminPage - Users from "usuarios" collection details:', usuariosData.map(u => ({
          id: u.id,
          email: u.email,
          nombre: u.nombre,
          displayName: u.displayName,
          username: u.username,
          apellidos: u.apellidos,
          subscription: u.subscription,
          birthdate: u.birthdate,
          notebookCount: u.notebookCount,
          maxNotebooks: u.maxNotebooks
        })));

        // Combinar usuarios de ambas colecciones (evitando duplicados)
        const allUsers = [...usersData];
        usuariosData.forEach(usuario => {
          const exists = allUsers.find(u => u.id === usuario.id);
          if (!exists) {
            allUsers.push(usuario);
          }
        });

        setUsers(allUsers);
        console.log('SuperAdminPage - Total combined users:', allUsers.length);
      } catch (error) {
        console.log('SuperAdminPage - No "usuarios" collection found, using only "users"');
        setUsers(usersData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Gestión de usuarios
  const updateUserSubscription = async (userId: string, subscription: UserSubscriptionType) => {
    try {
      console.log(`🔄 Actualizando suscripción del usuario ${userId} a ${subscription}`);
      
      // Obtener los datos actuales del usuario
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) {
        throw new Error('Usuario no encontrado');
      }
      
      const userData = userDoc.data();
      const previousSubscription = userData.subscription;
      
      // Si se cambia de SCHOOL a otro tipo, limpiar réplicas
      if (previousSubscription === UserSubscriptionType.SCHOOL && subscription !== UserSubscriptionType.SCHOOL) {
        console.log(`🔄 Cambiando de SCHOOL a ${subscription}, limpiando réplicas...`);
        await cleanupUserReplicas(userId);
      }
      
      // Actualizar la suscripción en la colección users
      await updateDoc(doc(db, 'users', userId), {
        subscription,
        updatedAt: serverTimestamp()
      });
      
      // Si se cambia a SCHOOL, verificar si ya tiene un rol asignado y crear réplica
      if (subscription === UserSubscriptionType.SCHOOL && userData.schoolRole) {
        console.log(`🏫 Usuario cambiado a SCHOOL con rol ${userData.schoolRole}, creando réplica...`);
        
        if (userData.schoolRole === SchoolRole.TEACHER) {
          await createTeacherReplica(userId, userData);
        } else if (userData.schoolRole === SchoolRole.STUDENT) {
          await createStudentReplica(userId, userData);
        }
        
        console.log(`✅ Suscripción actualizada a ${subscription} y réplica creada`);
        showNotification(`Suscripción actualizada a ${subscription} y réplica creada`, 'success');
      } else {
        console.log(`✅ Suscripción actualizada exitosamente - El listener en tiempo real actualizará la interfaz automáticamente`);
        showNotification(`Suscripción actualizada a ${subscription}`, 'success');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      showNotification('Error al actualizar la suscripción del usuario', 'error');
    }
  };

  const updateUserSchoolRole = async (userId: string, schoolRole: SchoolRole) => {
    try {
      console.log(`🔄 Actualizando rol escolar del usuario ${userId} a ${schoolRole}`);
      
      // Obtener los datos actuales del usuario
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) {
        throw new Error('Usuario no encontrado');
      }
      
      const userData = userDoc.data();
      const previousRole = userData.schoolRole;
      
      // Limpiar réplicas anteriores si el rol cambió
      if (previousRole && previousRole !== schoolRole) {
        console.log(`🔄 Rol cambiando de ${previousRole} a ${schoolRole}, limpiando réplicas anteriores...`);
        await cleanupUserReplicas(userId);
      }
      
      // Actualizar el rol en la colección users
      await updateDoc(doc(db, 'users', userId), {
        schoolRole,
        updatedAt: serverTimestamp()
      });
      
      // Crear réplica automática en schoolTeachers o schoolStudents según el rol
      if (schoolRole === SchoolRole.TEACHER) {
        await createTeacherReplica(userId, userData);
      } else if (schoolRole === SchoolRole.STUDENT) {
        await createStudentReplica(userId, userData);
      }
      
      console.log(`✅ Rol escolar actualizado exitosamente - El listener en tiempo real actualizará la interfaz automáticamente`);
      showNotification(`Rol escolar actualizado a ${schoolRole} y réplica creada`, 'success');
    } catch (error) {
      console.error('Error updating user school role:', error);
      showNotification('Error al actualizar el rol escolar del usuario', 'error');
    }
  };

  // Función para crear réplica de profesor
  const createTeacherReplica = async (userId: string, userData: any) => {
    try {
      console.log(`👨‍🏫 Creando réplica de profesor para ${userData.nombre || userData.displayName}`);
      
      // Verificar si ya existe en schoolTeachers
      const teacherQuery = query(collection(db, 'schoolTeachers'), where('id', '==', userId));
      const teacherSnapshot = await getDocs(teacherQuery);
      
      if (!teacherSnapshot.empty) {
        console.log('✅ Usuario ya existe en schoolTeachers, actualizando...');
        await updateDoc(doc(db, 'schoolTeachers', userId), {
          nombre: userData.nombre || userData.displayName || userData.username || 'Profesor',
          email: userData.email,
          password: '1234', // Password por defecto
          subscription: UserSubscriptionType.SCHOOL,
          updatedAt: serverTimestamp()
        });
        return;
      }
      
      // Crear nuevo registro en schoolTeachers
      await setDoc(doc(db, 'schoolTeachers', userId), {
        id: userId,
        nombre: userData.nombre || userData.displayName || userData.username || 'Profesor',
        email: userData.email,
        password: '1234', // Password por defecto
        subscription: UserSubscriptionType.SCHOOL,
        idAdmin: '', // Se vinculará después
        createdAt: userData.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      console.log('✅ Réplica de profesor creada exitosamente');
    } catch (error) {
      console.error('Error creando réplica de profesor:', error);
      throw error;
    }
  };

  // Función para crear réplica de estudiante
  const createStudentReplica = async (userId: string, userData: any) => {
    try {
      console.log(`👨‍🎓 Creando réplica de estudiante para ${userData.nombre || userData.displayName}`);
      
      // Verificar si ya existe en schoolStudents
      const studentQuery = query(collection(db, 'schoolStudents'), where('id', '==', userId));
      const studentSnapshot = await getDocs(studentQuery);
      
      if (!studentSnapshot.empty) {
        console.log('✅ Usuario ya existe en schoolStudents, actualizando...');
        await updateDoc(doc(db, 'schoolStudents', userId), {
          nombre: userData.nombre || userData.displayName || userData.username || 'Estudiante',
          email: userData.email,
          password: '1234', // Password por defecto
          subscription: UserSubscriptionType.SCHOOL,
          updatedAt: serverTimestamp()
        });
        return;
      }
      
      // Crear nuevo registro en schoolStudents
      await setDoc(doc(db, 'schoolStudents', userId), {
        id: userId,
        nombre: userData.nombre || userData.displayName || userData.username || 'Estudiante',
        email: userData.email,
        password: '1234', // Password por defecto
        subscription: UserSubscriptionType.SCHOOL,
        idAdmin: '', // Se vinculará después
        idTeacher: '', // Se vinculará después
        idNotebook: '', // Se vinculará después
        createdAt: userData.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      console.log('✅ Réplica de estudiante creada exitosamente');
    } catch (error) {
      console.error('Error creando réplica de estudiante:', error);
      throw error;
    }
  };

  // Función para limpiar réplicas cuando se elimina un usuario
  const cleanupUserReplicas = async (userId: string) => {
    try {
      console.log(`🧹 Limpiando réplicas del usuario ${userId}`);
      
      // Verificar si existe en schoolTeachers y eliminarlo
      const teacherQuery = query(collection(db, 'schoolTeachers'), where('id', '==', userId));
      const teacherSnapshot = await getDocs(teacherQuery);
      
      if (!teacherSnapshot.empty) {
        console.log('🗑️ Eliminando réplica de schoolTeachers...');
        await deleteDoc(doc(db, 'schoolTeachers', userId));
        console.log('✅ Réplica de schoolTeachers eliminada');
      }
      
      // Verificar si existe en schoolStudents y eliminarlo
      const studentQuery = query(collection(db, 'schoolStudents'), where('id', '==', userId));
      const studentSnapshot = await getDocs(studentQuery);
      
      if (!studentSnapshot.empty) {
        console.log('🗑️ Eliminando réplica de schoolStudents...');
        await deleteDoc(doc(db, 'schoolStudents', userId));
        console.log('✅ Réplica de schoolStudents eliminada');
      }
      
      console.log('✅ Limpieza de réplicas completada');
    } catch (error) {
      console.error('Error limpiando réplicas del usuario:', error);
      // No lanzar error para no interrumpir el proceso de eliminación
    }
  };

  const deleteUser = async (userId: string, userName: string) => {
    try {
      console.log('🗑️ SuperAdmin eliminando usuario con Firebase Function:', userId);
      
      // Limpiar réplicas antes de eliminar el usuario
      await cleanupUserReplicas(userId);
      
      // Usar la nueva función con Firebase Functions
      await deleteUserWithConfirmation(
        userId,
        userName,
        // onProgress callback
        (message) => {
          console.log('📊 Progreso de eliminación:', message);
          // Aquí podrías mostrar un toast o notificación
        },
        // onSuccess callback
        (result) => {
          console.log('✅ Usuario eliminado exitosamente:', result);
          alert(`✅ Usuario "${userName}" eliminado exitosamente!\n\n${result.message}`);
          loadData(); // Recargar la lista de usuarios
        },
        // onError callback
        (error) => {
          console.error('❌ Error eliminando usuario:', error);
          alert(`❌ Error eliminando usuario: ${error}`);
        }
      );
      
    } catch (error) {
      console.error('Error en deleteUser:', error);
      alert('Error al eliminar el usuario. Por favor, intenta de nuevo.');
    }
  };

  // Funciones de sincronización de usuarios escolares
  const handleSyncAllSchoolUsers = async () => {
    if (!window.confirm('¿Estás seguro de que quieres sincronizar TODOS los usuarios escolares? Esto creará usuarios reales en Firebase Auth para todos los schoolTeachers y schoolStudents.')) {
      return;
    }
    
    setSyncLoading(true);
    try {
      console.log('🚀 Iniciando sincronización completa...');
      const results = await syncSchoolUsers('all');
      const data = results.data as any;
      setSyncResults(data.results);
      
      console.log('🎉 Sincronización completada:', data);
      alert(`Sincronización completada: ${data.results.teachers.success + data.results.students.success} exitosos, ${data.results.teachers.errors.length + data.results.students.errors.length} errores`);
      loadData();
    } catch (error: any) {
      console.error('❌ Error en sincronización:', error);
      alert(`Error en sincronización: ${error.message}`);
    } finally {
      setSyncLoading(false);
    }
  };

  const handleSyncTeachers = async () => {
    if (!window.confirm('¿Estás seguro de que quieres sincronizar TODOS los profesores escolares?')) {
      return;
    }
    
    setSyncLoading(true);
    try {
      const results = await syncSchoolUsers('teachers');
      const data = results.data as any;
      setSyncResults({ teachers: data.results.teachers, students: { success: 0, errors: [] } });
      alert(`Sincronización de profesores completada: ${data.results.teachers.success} exitosos, ${data.results.teachers.errors.length} errores`);
      loadData();
    } catch (error: any) {
      console.error('❌ Error en sincronización de profesores:', error);
      alert(`Error en sincronización: ${error.message}`);
    } finally {
      setSyncLoading(false);
    }
  };

  const handleSyncStudents = async () => {
    if (!window.confirm('¿Estás seguro de que quieres sincronizar TODOS los estudiantes escolares?')) {
      return;
    }
    
    setSyncLoading(true);
    try {
      const results = await syncSchoolUsers('students');
      const data = results.data as any;
      setSyncResults({ teachers: { success: 0, errors: [] }, students: data.results.students });
      alert(`Sincronización de estudiantes completada: ${data.results.students.success} exitosos, ${data.results.students.errors.length} errores`);
      loadData();
    } catch (error: any) {
      console.error('❌ Error en sincronización de estudiantes:', error);
      alert(`Error en sincronización: ${error.message}`);
    } finally {
      setSyncLoading(false);
    }
  };

  const handleMigrateExistingTeachers = async () => {
    if (!window.confirm('¿Estás seguro de que quieres migrar los profesores existentes?')) {
      return;
    }
    
    setSyncLoading(true);
    try {
      const result = await migrateUsers();
      const data = result.data as any;
      alert(`Migración completada: ${data.updatedCount} usuarios actualizados, ${data.errorCount} errores`);
      loadData();
    } catch (error: any) {
      console.error('❌ Error en migración:', error);
      alert(`Error en migración: ${error.message}`);
    } finally {
      setSyncLoading(false);
    }
  };

  const handleCheckTeacherStatus = async () => {
    const teacherId = prompt('Ingresa el ID del profesor a verificar:');
    if (!teacherId) return;
    
    try {
      const results = await syncSchoolUsers();
      const data = results.data as any;
      const teacherResult = data.results.teachers;
      
      if (teacherResult.success > 0) {
        alert(`✅ Profesor encontrado y sincronizado correctamente`);
      } else if (teacherResult.errors.length > 0) {
        alert(`❌ Error con el profesor: ${teacherResult.errors[0].error}`);
      } else {
        alert(`ℹ️ Profesor no encontrado en la base de datos`);
      }
    } catch (error: any) {
      console.error('❌ Error verificando profesor:', error);
      alert(`Error verificando profesor: ${error.message}`);
    }
  };

  // Funciones para datos de prueba
  const handleCreateTestData = async () => {
    if (!window.confirm('¿Estás seguro de que quieres crear datos de prueba? Esto agregará entidades de ejemplo al sistema escolar.')) {
      return;
    }
    
    try {
      const result = await createTestSchoolData();
      alert(`✅ Datos de prueba creados exitosamente!\n\nIDs creados:\n- Institución: ${result.institutionId}\n- Administrador: ${result.adminId}\n- Profesor: ${result.teacherId}\n- Materia: ${result.subjectId}\n- Cuaderno: ${result.notebookId}\n- Estudiante: ${result.studentId}\n- Tutor: ${result.tutorId}`);
    } catch (error: any) {
      console.error('❌ Error creando datos de prueba:', error);
      alert(`Error creando datos de prueba: ${error.message}`);
    }
  };

  const handleCheckCollections = async () => {
    try {
      const results = await checkSchoolCollections();
      const summary = Object.entries(results)
        .map(([collection, count]) => `${collection}: ${count}`)
        .join('\n');
      alert(`📊 Estado de las colecciones escolares:\n\n${summary}`);
    } catch (error: any) {
      console.error('❌ Error verificando colecciones:', error);
      alert(`Error verificando colecciones: ${error.message}`);
    }
  };

  const handleCleanDuplicateTeachers = async () => {
    try {
      setSyncLoading(true);
      const results = await cleanDuplicateSchoolTeachers();
      const message = `🧹 Limpieza completada:\n\n✅ Documentos eliminados: ${results.removed}\n❌ Errores: ${results.errors.length}`;
      
      if (results.errors.length > 0) {
        const errorDetails = results.errors.map(e => `- ${e.id}: ${e.error}`).join('\n');
        alert(`${message}\n\nDetalles de errores:\n${errorDetails}`);
      } else {
        alert(message);
      }
      
      showNotification(`Limpieza completada: ${results.removed} documentos eliminados`, 'success');
    } catch (error: any) {
      console.error('❌ Error limpiando documentos duplicados:', error);
      alert(`Error limpiando documentos duplicados: ${error.message}`);
      showNotification('Error en la limpieza', 'error');
    } finally {
      setSyncLoading(false);
    }
  };

  const handleCheckCollectionsStatus = async () => {
    try {
      await checkCollectionsStatus();
      alert('✅ Verificación completada. Revisa la consola para ver los detalles.');
    } catch (error: any) {
      console.error('❌ Error verificando estado de colecciones:', error);
      alert(`Error verificando estado: ${error.message}`);
    }
  };

  const handleFixRubenelhoreDuplicate = async () => {
    try {
      setSyncLoading(true);
      const result = await fixRubenelhoreDuplicate();
      
      if (result.success) {
        alert(`✅ ${result.message}`);
        showNotification('Corrección completada exitosamente', 'success');
      } else {
        alert(`❌ ${result.message}`);
        showNotification('Error en la corrección', 'error');
      }
    } catch (error: any) {
      console.error('❌ Error corrigiendo duplicado de rubenelhore:', error);
      alert(`Error: ${error.message}`);
      showNotification('Error en la corrección', 'error');
    } finally {
      setSyncLoading(false);
    }
  };

  const handleCheckRubenelhoreStatus = async () => {
    try {
      await checkRubenelhoreStatus();
      alert('✅ Verificación completada. Revisa la consola para ver los detalles.');
    } catch (error: any) {
      console.error('❌ Error verificando estado de Rubenelhore:', error);
      alert(`Error verificando estado: ${error.message}`);
    }
  };

  // Nuevas funciones para migración automática de réplicas
  const handleMigrateAllExistingSchoolUsers = async () => {
    if (!window.confirm('¿Estás seguro de que quieres migrar TODOS los usuarios escolares existentes? Esto creará réplicas en schoolTeachers y schoolStudents para usuarios que ya tienen roles pero no tienen réplicas.')) {
      return;
    }
    
    setSyncLoading(true);
    try {
      console.log('🚀 Iniciando migración completa de usuarios escolares existentes...');
      const results = await migrateAllExistingSchoolUsers();
      
      const totalSuccess = results.teachers.success + results.students.success;
      const totalErrors = results.teachers.errors.length + results.students.errors.length;
      
      console.log('🎉 Migración completada:', results);
      alert(`Migración completada:\n\n👨‍🏫 Profesores: ${results.teachers.success} exitosos, ${results.teachers.errors.length} errores\n👨‍🎓 Estudiantes: ${results.students.success} exitosos, ${results.students.errors.length} errores\n\nTotal: ${totalSuccess} exitosos, ${totalErrors} errores`);
      loadData();
    } catch (error: any) {
      console.error('❌ Error en migración:', error);
      alert(`Error en migración: ${error.message}`);
    } finally {
      setSyncLoading(false);
    }
  };

  const handleCheckUserSyncStatus = async () => {
    const userId = prompt('Ingresa el ID del usuario a verificar:');
    if (!userId) return;
    
    try {
      const status = await checkUserSyncStatus(userId);
      
      let message = `📊 Estado de sincronización para usuario ${userId}:\n\n`;
      message += `👤 Existe en users: ${status.existsInUsers ? '✅ Sí' : '❌ No'}\n`;
      message += `👨‍🏫 Existe en schoolTeachers: ${status.existsInTeachers ? '✅ Sí' : '❌ No'}\n`;
      message += `👨‍🎓 Existe en schoolStudents: ${status.existsInStudents ? '✅ Sí' : '❌ No'}\n\n`;
      
      if (status.userData) {
        message += `📋 Datos del usuario:\n`;
        message += `- Email: ${status.userData.email}\n`;
        message += `- Nombre: ${status.userData.nombre || status.userData.displayName}\n`;
        message += `- Subscription: ${status.userData.subscription}\n`;
        message += `- SchoolRole: ${status.userData.schoolRole || 'No asignado'}\n`;
      }
      
      alert(message);
    } catch (error: any) {
      console.error('❌ Error verificando estado de usuario:', error);
      alert(`Error verificando estado: ${error.message}`);
    }
  };

  // Función para probar el sistema de réplicas
  const handleTestReplicaSystem = async () => {
    if (!window.confirm('¿Estás seguro de que quieres ejecutar una prueba completa del sistema de réplicas? Esto creará un usuario de prueba temporal.')) {
      return;
    }
    
    setSyncLoading(true);
    try {
      console.log('🧪 Iniciando prueba del sistema de réplicas...');
      const result = await runCompleteReplicaTest();
      
      if (result.success) {
        alert(`🎉 ${result.message}\n\nEl sistema de réplicas está funcionando correctamente.`);
      } else {
        alert(`❌ ${result.message}\n\nHay un problema con el sistema de réplicas.`);
      }
      
      loadData();
    } catch (error: any) {
      console.error('❌ Error en prueba del sistema de réplicas:', error);
      alert(`Error en prueba: ${error.message}`);
    } finally {
      setSyncLoading(false);
    }
  };

  // Función de diagnóstico para verificar acceso a la base de datos
  const diagnosticarBaseDatos = async () => {
    console.log('🔍 DIAGNÓSTICO DE BASE DE DATOS');
    console.log('==============================');
    
    try {
      // 1. Verificar configuración de Firestore
      console.log('1. Configuración de Firestore:');
      console.log('- db:', db);
      console.log('- app:', db.app);
      
      // 2. Verificar acceso a la colección users
      console.log('\n2. Verificando acceso a colección users...');
      const usersQuery = query(collection(db, 'users'), limit(1));
      const usersSnapshot = await getDocs(usersQuery);
      console.log('✅ Acceso a users OK:', usersSnapshot.size, 'documentos');
      
      // 3. Verificar acceso a schoolTeachers
      console.log('\n3. Verificando acceso a schoolTeachers...');
      const teachersQuery = query(collection(db, 'schoolTeachers'), limit(1));
      const teachersSnapshot = await getDocs(teachersQuery);
      console.log('✅ Acceso a schoolTeachers OK:', teachersSnapshot.size, 'documentos');
      
      // 4. Verificar acceso a schoolStudents
      console.log('\n4. Verificando acceso a schoolStudents...');
      const studentsQuery = query(collection(db, 'schoolStudents'), limit(1));
      const studentsSnapshot = await getDocs(studentsQuery);
      console.log('✅ Acceso a schoolStudents OK:', studentsSnapshot.size, 'documentos');
      
      // 5. Verificar permisos de escritura
      console.log('\n5. Verificando permisos de escritura...');
      const testDocRef = doc(collection(db, 'testPermissions'));
      await setDoc(testDocRef, {
        test: true,
        timestamp: serverTimestamp()
      });
      console.log('✅ Permisos de escritura OK');
      
      // Limpiar documento de prueba
      await deleteDoc(testDocRef);
      console.log('✅ Documento de prueba eliminado');
      
    } catch (error) {
      console.log('❌ Error en diagnóstico:', error);
      
      // 6. Probar con base de datos por defecto
      console.log('\n6. Probando con base de datos por defecto...');
      try {
        const defaultDb = getFirestore(app); // Sin especificar base de datos
        console.log('- defaultDb:', defaultDb);
        
        const testDocRefDefault = doc(collection(defaultDb, 'testPermissions'));
        await setDoc(testDocRefDefault, {
          test: true,
          timestamp: serverTimestamp()
        });
        console.log('✅ Escritura en base de datos por defecto OK');
        
        await deleteDoc(testDocRefDefault);
        console.log('✅ Documento de prueba eliminado de base por defecto');
        
      } catch (defaultError) {
        console.log('❌ Error con base de datos por defecto:', defaultError);
      }
    }
  };

  // Exponer función de diagnóstico en window
  useEffect(() => {
    (window as any).diagnosticarBaseDatos = diagnosticarBaseDatos;
    return () => {
      delete (window as any).diagnosticarBaseDatos;
    };
  }, []);

  // Mostrar loading mientras se verifica el tipo de usuario
  if (userTypeLoading) {
    return (
      <div className="super-admin-container">
        <div className="loading-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
          <div className="spinner"></div>
          <p>Verificando permisos de súper admin...</p>
        </div>
      </div>
    );
  }

  // Si no es súper admin, no mostrar nada (será redirigido)
  if (!isSuperAdmin) {
    console.log('SuperAdminPage - Not super admin, returning null');
    return null;
  }

  console.log('SuperAdminPage - Rendering full component');

  return (
    <div className="super-admin-container">
      <header className="super-admin-header">
        <div className="header-content">
          <h1>🛡️ Panel de Control - Súper Admin</h1>
          <button className="back-button" onClick={() => navigate('/notebooks')} title="Volver">
            <i className="fas fa-arrow-left"></i>
          </button>
        </div>
      </header>

      <div className="super-admin-content">
        <nav className="admin-tabs">
          <button 
            className={`tab-button ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <i className="fas fa-users"></i> Usuarios
          </button>
          <button 
            className={`tab-button ${activeTab === 'schoolLinking' ? 'active' : ''}`}
            onClick={() => setActiveTab('schoolLinking')}
          >
            <i className="fas fa-link"></i> Vinculación Escolar
          </button>
          <button 
            className={`tab-button ${activeTab === 'schoolCreation' ? 'active' : ''}`}
            onClick={() => setActiveTab('schoolCreation')}
          >
            <i className="fas fa-plus-circle"></i> Creación Escolar
          </button>
          <button 
            className={`tab-button ${activeTab === 'schoolSync' ? 'active' : ''}`}
            onClick={() => setActiveTab('schoolSync')}
          >
            <i className="fas fa-sync-alt"></i>
            Sync Escolar
          </button>
          <button 
            className={`tab-button ${activeTab === 'schoolVerification' ? 'active' : ''}`}
            onClick={() => setActiveTab('schoolVerification')}
          >
            <i className="fas fa-search"></i>
            Verificación de Vinculación
          </button>
          <button 
            className={`tab-button ${activeTab === 'duplicateAccounts' ? 'active' : ''}`}
            onClick={() => setActiveTab('duplicateAccounts')}
          >
            <i className="fas fa-search"></i>
            Diagnóstico de Cuentas Duplicadas
          </button>
          <button 
            className={`tab-button ${activeTab === 'schoolStudent' ? 'active' : ''}`}
            onClick={() => setActiveTab('schoolStudent')}
          >
            <i className="fas fa-user-graduate"></i>
            Diagnóstico de Estudiantes
          </button>
        </nav>

        <div className="tab-content">
          {loading && (
            <div className="loading-overlay">
              <div className="spinner"></div>
              <p>Cargando datos...</p>
            </div>
          )}

          {/* Tab de Usuarios */}
          {activeTab === 'users' && (
            <div className="users-tab">
              <div className="tab-header">
                <h2>Gestión de Usuarios ({users.length})</h2>
                <div className="header-actions">
                  {isRealtimeActive && (
                    <div className="realtime-indicator" title="Actualización en tiempo real activa">
                      <i className="fas fa-broadcast-tower"></i>
                      <span>Tiempo real</span>
                    </div>
                  )}
                  <button className="refresh-button" onClick={loadData} title="Actualizar datos manualmente">
                    <i className="fas fa-sync-alt"></i>
                  </button>
                </div>
              </div>
              
              {loading ? (
                <div className="loading-message">
                  <div className="spinner"></div>
                  <p>Cargando usuarios...</p>
                </div>
              ) : (
                <div className="users-grid">
                  {users.map(user => (
                    <div key={user.id} className="user-card">
                      <div className="user-info">
                        <div className="user-header">
                          <h3>
                            {user.nombre || user.displayName || user.username || 'Sin nombre'}
                            {user.apellidos && ` ${user.apellidos}`}
                          </h3>
                          <span className={`badge ${user.subscription}`}>
                            {user.subscription === UserSubscriptionType.SUPER_ADMIN && '👑 Súper Admin'}
                            {user.subscription === UserSubscriptionType.FREE && '🆓 Gratis'}
                            {user.subscription === UserSubscriptionType.PRO && '⭐ Pro'}
                            {user.subscription === UserSubscriptionType.SCHOOL && `🏫 Escolar - ${user.schoolRole || 'Sin rol'}`}
                          </span>
                        </div>
                        
                        <div className="user-details">
                          <div className="detail-row">
                            <span className="detail-label">📧 Email:</span>
                            <span className="detail-value">{user.email || 'No disponible'}</span>
                          </div>
                          
                          <div className="detail-row">
                            <span className="detail-label">🆔 ID:</span>
                            <span className="detail-value user-id">{user.id}</span>
                          </div>

                          {/* Mostrar username si existe */}
                          {user.username && (
                            <div className="detail-row">
                              <span className="detail-label">👤 Username:</span>
                              <span className="detail-value">{user.username}</span>
                            </div>
                          )}

                          {/* Mostrar displayName si es diferente del nombre */}
                          {user.displayName && user.displayName !== user.nombre && (
                            <div className="detail-row">
                              <span className="detail-label">📝 Display Name:</span>
                              <span className="detail-value">{user.displayName}</span>
                            </div>
                          )}
                          
                          {/* Mostrar fecha de nacimiento si existe */}
                          {user.birthdate && (
                            <div className="detail-row">
                              <span className="detail-label">🎂 Fecha nacimiento:</span>
                              <span className="detail-value">{user.birthdate}</span>
                            </div>
                          )}
                          
                          {user.createdAt && (
                            <div className="detail-row">
                              <span className="detail-label">📅 Creado:</span>
                              <span className="detail-value">
                                {user.createdAt.toDate ? 
                                  user.createdAt.toDate().toLocaleDateString('es-ES', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  }) : 
                                  'Fecha no disponible'
                                }
                              </span>
                            </div>
                          )}

                          {/* Mostrar estadísticas si existen */}
                          {user.notebookCount !== undefined && (
                            <div className="detail-row">
                              <span className="detail-label">📚 Cuadernos:</span>
                              <span className="detail-value">{user.notebookCount}</span>
                            </div>
                          )}

                          {user.maxNotebooks !== undefined && (
                            <div className="detail-row">
                              <span className="detail-label">📊 Límite cuadernos:</span>
                              <span className="detail-value">{user.maxNotebooks === -1 ? '∞' : user.maxNotebooks}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="user-actions">
                        <div className="action-group">
                          <label className="action-label">Tipo de suscripción:</label>
                          <select 
                            value={user.subscription}
                            onChange={(e) => updateUserSubscription(user.id, e.target.value as UserSubscriptionType)}
                            className="subscription-select"
                          >
                            <option value={UserSubscriptionType.FREE}>🆓 Gratis</option>
                            <option value={UserSubscriptionType.PRO}>⭐ Pro</option>
                            <option value={UserSubscriptionType.SCHOOL}>🏫 Escolar</option>
                            <option value={UserSubscriptionType.SUPER_ADMIN}>👑 Súper Admin</option>
                          </select>
                        </div>
                        
                        {user.subscription === UserSubscriptionType.SCHOOL && (
                          <div className="action-group">
                            <label className="action-label">Rol escolar:</label>
                            <select 
                              value={user.schoolRole || ''}
                              onChange={(e) => updateUserSchoolRole(user.id, e.target.value as SchoolRole)}
                              className="role-select"
                            >
                              <option value={SchoolRole.ADMIN}>👨‍💼 Administrador</option>
                              <option value={SchoolRole.TEACHER}>👨‍🏫 Profesor</option>
                              <option value={SchoolRole.STUDENT}>👨‍🎓 Alumno</option>
                              <option value={SchoolRole.TUTOR}>👨‍👩‍👧‍👦 Tutor</option>
                            </select>
                          </div>
                        )}
                        
                        <div className="action-buttons">
                          <button 
                            className="delete-button"
                            onClick={() => deleteUser(user.id, user.nombre || '')}
                            title="Eliminar usuario"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab de Vinculación Escolar */}
          {activeTab === 'schoolLinking' && (
            <SchoolLinking onRefresh={loadData} />
          )}

          {/* Tab de Creación Escolar */}
          {activeTab === 'schoolCreation' && (
            <SchoolCreation onRefresh={loadData} />
          )}

          {/* Tab de Sincronización Escolar */}
          {activeTab === 'schoolSync' && (
            <div className="school-sync-tab">
              <div className="tab-header">
                <h2>🔄 Sincronización de Usuarios Escolares</h2>
                <p className="tab-description">
                  Sincroniza los usuarios de las colecciones schoolTeachers y schoolStudents 
                  para crear usuarios reales en Firebase Auth que puedan hacer login.
                </p>
              </div>

              {syncLoading && (
                <div className="loading-overlay">
                  <div className="spinner"></div>
                  <p>Sincronizando usuarios escolares...</p>
                </div>
              )}

              <div className="sync-actions">
                <div className="sync-card">
                  <div className="sync-card-header">
                    <h3>🚀 Sincronización Completa</h3>
                    <p>Sincroniza TODOS los profesores y estudiantes escolares</p>
                  </div>
                  <button 
                    className="sync-button sync-all"
                    onClick={handleSyncAllSchoolUsers}
                    disabled={syncLoading}
                  >
                    <i className="fas fa-sync-alt"></i>
                    Sincronizar Todo
                  </button>
                </div>

                <div className="sync-card">
                  <div className="sync-card-header">
                    <h3>👨‍🏫 Solo Profesores</h3>
                    <p>Sincroniza únicamente los schoolTeachers</p>
                  </div>
                  <button 
                    className="sync-button sync-teachers"
                    onClick={handleSyncTeachers}
                    disabled={syncLoading}
                  >
                    <i className="fas fa-chalkboard-teacher"></i>
                    Sincronizar Profesores
                  </button>
                </div>

                <div className="sync-card">
                  <div className="sync-card-header">
                    <h3>👨‍🎓 Solo Estudiantes</h3>
                    <p>Sincroniza únicamente los schoolStudents</p>
                  </div>
                  <button 
                    className="sync-button sync-students"
                    onClick={handleSyncStudents}
                    disabled={syncLoading}
                  >
                    <i className="fas fa-user-graduate"></i>
                    Sincronizar Estudiantes
                  </button>
                </div>

                <div className="sync-card">
                  <div className="sync-card-header">
                    <h3>🔄 Migrar Profesores Existentes</h3>
                    <p>Migra usuarios con schoolRole: 'teacher' a schoolTeachers</p>
                  </div>
                  <button 
                    className="sync-button sync-migrate"
                    onClick={handleMigrateExistingTeachers}
                    disabled={syncLoading}
                  >
                    <i className="fas fa-sync-alt"></i>
                    Migrar Profesores
                  </button>
                </div>

                <div className="sync-card">
                  <div className="sync-card-header">
                    <h3>🔍 Verificar Estado de Profesor</h3>
                    <p>Verifica si un usuario existe en schoolTeachers</p>
                  </div>
                  <button 
                    className="sync-button sync-check"
                    onClick={handleCheckTeacherStatus}
                    disabled={syncLoading}
                  >
                    <i className="fas fa-search"></i>
                    Verificar Estado
                  </button>
                </div>

                <div className="sync-card">
                  <div className="sync-card-header">
                    <h3>🧹 Limpiar Documentos Duplicados</h3>
                    <p>Elimina documentos duplicados en schoolTeachers</p>
                  </div>
                  <button 
                    className="sync-button sync-clean"
                    onClick={handleCleanDuplicateTeachers}
                    disabled={syncLoading}
                  >
                    <i className="fas fa-broom"></i>
                    Limpiar Duplicados
                  </button>
                </div>

                <div className="sync-card">
                  <div className="sync-card-header">
                    <h3>📊 Verificar Estado de Colecciones</h3>
                    <p>Muestra el estado de users y schoolTeachers</p>
                  </div>
                  <button 
                    className="sync-button sync-status"
                    onClick={handleCheckCollectionsStatus}
                    disabled={syncLoading}
                  >
                    <i className="fas fa-chart-bar"></i>
                    Verificar Estado
                  </button>
                </div>

                <div className="sync-card">
                  <div className="sync-card-header">
                    <h3>🔧 Corregir Duplicado Rubenelhore</h3>
                    <p>Elimina el documento duplicado específico de rubenelhore23@gmail.com</p>
                  </div>
                  <button 
                    className="sync-button sync-fix"
                    onClick={handleFixRubenelhoreDuplicate}
                    disabled={syncLoading}
                  >
                    <i className="fas fa-wrench"></i>
                    Corregir Duplicado
                  </button>
                </div>

                <div className="sync-card">
                  <div className="sync-card-header">
                    <h3>🔍 Verificar Estado Rubenelhore</h3>
                    <p>Muestra el estado específico de rubenelhore23@gmail.com</p>
                  </div>
                  <button 
                    className="sync-button sync-check-specific"
                    onClick={handleCheckRubenelhoreStatus}
                    disabled={syncLoading}
                  >
                    <i className="fas fa-search"></i>
                    Verificar Rubenelhore
                  </button>
                </div>

                <div className="sync-card">
                  <div className="sync-card-header">
                    <h3>🔄 Migración Automática de Réplicas</h3>
                    <p>Migra usuarios existentes con roles pero sin réplicas en schoolTeachers/schoolStudents</p>
                  </div>
                  <button 
                    className="sync-button sync-migrate-all"
                    onClick={handleMigrateAllExistingSchoolUsers}
                    disabled={syncLoading}
                  >
                    <i className="fas fa-sync-alt"></i>
                    Migrar Todos los Usuarios Escolares
                  </button>
                </div>

                <div className="sync-card">
                  <div className="sync-card-header">
                    <h3>🔍 Verificar Estado de Usuario</h3>
                    <p>Verifica el estado de sincronización de un usuario específico</p>
                  </div>
                  <button 
                    className="sync-button sync-check-user"
                    onClick={handleCheckUserSyncStatus}
                    disabled={syncLoading}
                  >
                    <i className="fas fa-user-check"></i>
                    Verificar Estado de Usuario
                  </button>
                </div>

                <div className="sync-card">
                  <div className="sync-card-header">
                    <h3>🧪 Probar Sistema de Réplicas</h3>
                    <p>Ejecuta una prueba completa del sistema automático de réplicas</p>
                  </div>
                  <button 
                    className="sync-button sync-test-replica"
                    onClick={handleTestReplicaSystem}
                    disabled={syncLoading}
                  >
                    <i className="fas fa-vial"></i>
                    Probar Sistema de Réplicas
                  </button>
                </div>
              </div>

              {syncResults && (
                <div className="sync-results">
                  <h3>📊 Resultados de Sincronización</h3>
                  
                  {syncResults.teachers && (
                    <div className="result-section">
                      <h4>👨‍🏫 Profesores</h4>
                      <div className="result-stats">
                        <div className="stat-item success">
                          <span className="stat-number">{syncResults.teachers.success}</span>
                          <span className="stat-label">Exitosos</span>
                        </div>
                        <div className="stat-item error">
                          <span className="stat-number">{syncResults.teachers.errors.length}</span>
                          <span className="stat-label">Errores</span>
                        </div>
                      </div>
                      
                      {syncResults.teachers.errors.length > 0 && (
                        <div className="error-details">
                          <h5>Errores en Profesores:</h5>
                          {syncResults.teachers.errors.map((error: any, index: number) => (
                            <div key={index} className="error-item">
                              <strong>{error.email}:</strong> {error.error}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {syncResults.students && (
                    <div className="result-section">
                      <h4>👨‍🎓 Estudiantes</h4>
                      <div className="result-stats">
                        <div className="stat-item success">
                          <span className="stat-number">{syncResults.students.success}</span>
                          <span className="stat-label">Exitosos</span>
                        </div>
                        <div className="stat-item error">
                          <span className="stat-number">{syncResults.students.errors.length}</span>
                          <span className="stat-label">Errores</span>
                        </div>
                      </div>
                      
                      {syncResults.students.errors.length > 0 && (
                        <div className="error-details">
                          <h5>Errores en Estudiantes:</h5>
                          {syncResults.students.errors.map((error: any, index: number) => (
                            <div key={index} className="error-item">
                              <strong>{error.email}:</strong> {error.error}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="sync-info">
                <h3>ℹ️ Información Importante</h3>
                <ul>
                  <li>La sincronización crea usuarios reales en Firebase Auth con contraseña "1234"</li>
                  <li>Los usuarios sincronizados podrán hacer login en el sistema</li>
                  <li>Se mantienen los datos originales en las colecciones escolares</li>
                  <li>Los usuarios ya existentes solo se actualizarán en la colección users</li>
                  <li>Es recomendable hacer backup antes de ejecutar la sincronización masiva</li>
                </ul>
              </div>
            </div>
          )}

          {/* Tab de Verificación de Vinculación */}
          {activeTab === 'schoolVerification' && (
            <div className="school-verification-tab">
              <div className="tab-header">
                <h2>🔗 Verificación de Vinculación Escolar</h2>
                <div className="header-actions">
                  <button 
                    className="test-button"
                    onClick={handleCheckCollections}
                    title="Verificar estado de colecciones"
                  >
                    <i className="fas fa-database"></i>
                    Verificar Colecciones
                  </button>
                  <button 
                    className="test-button"
                    onClick={handleCreateTestData}
                    title="Crear datos de prueba"
                  >
                    <i className="fas fa-plus"></i>
                    Crear Datos de Prueba
                  </button>
                </div>
              </div>
              <SchoolLinkingVerification />
            </div>
          )}

          {/* Tab de Diagnóstico de Cuentas Duplicadas */}
          {activeTab === 'duplicateAccounts' && (
            <div className="duplicate-accounts-tab">
              <div className="tab-header">
                <h2>🔍 Diagnóstico de Cuentas Duplicadas</h2>
                <p className="tab-description">
                  Detecta y limpia cuentas duplicadas que se crean cuando un usuario intenta 
                  iniciar sesión con Google Auth usando un email que ya existe en el sistema.
                </p>
              </div>
              <DuplicateAccountsDiagnostic />
            </div>
          )}

          {/* Tab de Diagnóstico de Estudiantes */}
          {activeTab === 'schoolStudent' && (
            <div className="school-student-tab">
              <div className="tab-header">
                <h2>🔍 Diagnóstico de Estudiantes</h2>
                <p className="tab-description">
                  Detecta y gestiona problemas específicos relacionados con los estudiantes.
                </p>
              </div>
              <SchoolStudentDiagnostic />
            </div>
          )}
        </div>
      </div>

      {/* Notificación */}
      {notification && (
        <div className={`notification notification-${notification.type}`}>
          <div className="notification-content">
            <i className={`fas ${notification.type === 'success' ? 'fa-check-circle' : notification.type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}`}></i>
            <span>{notification.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminPage; 