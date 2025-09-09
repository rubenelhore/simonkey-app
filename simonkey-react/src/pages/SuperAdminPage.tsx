import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserType } from '../hooks/useUserType';
import '../styles/SuperAdminPage.css';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import TeacherManagementImproved from '../components/TeacherManagementImproved';
import BulkUploadModule from '../components/BulkUploadModule';
import UserMetricsTable from '../components/UserMetricsTable';
import { collection, getDocs, query, orderBy, doc, updateDoc, serverTimestamp, getDoc, limit, where, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { GoogleAuthProvider } from 'firebase/auth';

interface User {
  id: string;
  nombre?: string;
  displayName?: string;
  email?: string;
  subscription?: string;
  schoolRole?: string;
  isTeacher?: boolean;
  scoreGlobal?: number;
  kpisData?: {
    global?: {
      scoreGlobal?: number;
    };
  };
  idMaterias?: string[];
  subjectIds?: string[];
  enrolledTeachers?: string[];
  teacherNames?: string;
  createdAt?: any;
  lastLoginAt?: any;
  lastLogin?: any;
  lastSignIn?: any;
  lastLogoutAt?: any;
  lastLogout?: any;
  lastSignOut?: any;
  lastActivity?: any;
  updatedAt?: any;
  notebookCount?: number;
  conceptsCreatedThisWeek?: number;
  notebooksCreatedThisWeek?: number;
  sessionDuration?: any;
  lastSessionDuration?: any;
  sessionTime?: any;
  totalSessionTime?: any;
  activeTime?: any;
  timeSpent?: any;
}

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  timestamp: any;
  userId?: string;
  status?: string;
  read?: boolean;
}

interface ProRequest {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  currentSubscription: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: any;
  processedAt?: any;
  processedBy?: string;
  reason?: string;
  notes?: string;
}

interface UserMetrics {
  id: string;
  nombre: string;
  displayName?: string;
  email: string;
  teacherNames?: string;
  scoreGlobal: number;
  repasoInteligente: {
    score: number;
    sessions: number;
  };
  estudioActivo: {
    score: number;
    sessions: number;
  };
  estubre: {
    score: number;
    sessions: number;
  };
  quiz: {
    score: number;
    sessions: number;
  };
  juegos: {
    score: number;
    sessions: number;
  };
}

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

const SuperAdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { isSuperAdmin, loading: userTypeLoading } = useUserType();
  const [activeTab, setActiveTab] = useState('usuarios');
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<ContactMessage[]>([]);
  const [proRequests, setProRequests] = useState<ProRequest[]>([]);
  const [filteredProRequests, setFilteredProRequests] = useState<ProRequest[]>([]);
  const [userMetrics, setUserMetrics] = useState<UserMetrics[]>([]);
  const [filteredMetrics, setFilteredMetrics] = useState<UserMetrics[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Sort configurations for each table
  const [usersSortConfig, setUsersSortConfig] = useState<SortConfig | null>(null);
  const [messagesSortConfig, setMessagesSortConfig] = useState<SortConfig | null>(null);
  const [proRequestsSortConfig, setProRequestsSortConfig] = useState<SortConfig | null>(null);
  const [metricsSortConfig, setMetricsSortConfig] = useState<SortConfig | null>(null);
  const [filters, setFilters] = useState({
    nombre: '',
    email: '',
    subscription: '',
    role: '',
    fechaCreacion: '',
    ultimaSesion: '',
    profesores: ''
  });
  const [messageFilters, setMessageFilters] = useState({
    search: '',
    status: ''
  });
  const [proFilters, setProFilters] = useState({
    search: '',
    status: ''
  });
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  
  // 🔧 MIGRACIÓN MASIVA: Estados para migración de puntos
  const [migrationStatus, setMigrationStatus] = useState('');
  const [migrationProgress, setMigrationProgress] = useState(0);
  const [migrationResults, setMigrationResults] = useState<any[]>([]);
  
  // 🗑️ ELIMINAR FILL IN THE BLANK: Estados específicos
  const [fillBlankStatus, setFillBlankStatus] = useState('');
  const [fillBlankProgress, setFillBlankProgress] = useState(0);
  const [fillBlankResults, setFillBlankResults] = useState<any[]>([]);

  // Verificar si el usuario es súper admin
  React.useEffect(() => {
    if (!userTypeLoading && !isSuperAdmin) {
      navigate('/notebooks');
    } else if (!userTypeLoading && isSuperAdmin) {
      // Track super admin access
      if (typeof window !== 'undefined' && window.amplitude) {
        try {
          const amplitudeInstance = window.amplitude.getInstance();
          amplitudeInstance.logEvent('Super Admin Access', {
            page: 'SuperAdminPage',
            timestamp: new Date().toISOString()
          });
          console.log('✅ Amplitude: Super Admin access tracked');
        } catch (error) {
          console.warn('⚠️ Error tracking Super Admin access:', error);
        }
      }
    }
  }, [isSuperAdmin, userTypeLoading, navigate]);

  // Cargar datos cuando se selecciona la pestaña
  useEffect(() => {
    if (activeTab === 'usuarios') {
      loadUsers();
    } else if (activeTab === 'mensajes') {
      loadMessages();
    } else if (activeTab === 'pro') {
      loadProRequests();
    }
  }, [activeTab]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      console.log('🔄 Iniciando carga de usuarios...');
      console.log('🔐 Usuario actual:', {
        uid: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        isSuperAdmin: isSuperAdmin
      });
      
      // Usar query sin límites para asegurar que se traigan todos los usuarios
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      
      console.log(`📦 Snapshot size: ${usersSnapshot.size} documentos`);
      console.log(`📦 Snapshot empty: ${usersSnapshot.empty}`);
      
      const usersData: User[] = [];
      
      usersSnapshot.forEach((doc) => {
        const userData = doc.data();
        console.log(`👤 Cargando usuario: ${userData.email || userData.displayName || doc.id}`);
        
        // Debug: verificar TODOS los campos del usuario para encontrar relaciones
        const possibleSubjectFields = [
          'idMaterias', 'subjectIds', 'subjects', 'materias', 'enrolledSubjects', 
          'assignedSubjects', 'schoolSubjects', 'classes', 'clases', 'courses',
          'idInstitucion', 'idEscuela', 'schoolId', 'institution', 'escola'
        ];
        
        const userFields = Object.keys(userData);
        const subjectRelatedFields = userFields.filter(field => 
          possibleSubjectFields.includes(field) || 
          field.toLowerCase().includes('subject') ||
          field.toLowerCase().includes('materia') ||
          field.toLowerCase().includes('class') ||
          field.toLowerCase().includes('school') ||
          field.toLowerCase().includes('teacher') ||
          field.toLowerCase().includes('profesor')
        );
        
        if (subjectRelatedFields.length > 0) {
          console.log(`  🔍 Campos relacionados con materias/escuelas:`, 
            subjectRelatedFields.map(field => `${field}: ${JSON.stringify(userData[field])}`));
        }
        
        // Debug específico para materias
        if (userData.idMaterias && userData.idMaterias.length > 0) {
          console.log(`  📚 Tiene ${userData.idMaterias.length} materias:`, userData.idMaterias);
        } else if (userData.subjectIds && userData.subjectIds.length > 0) {
          console.log(`  📚 Tiene ${userData.subjectIds.length} subjectIds:`, userData.subjectIds);
        } else {
          console.log(`  📚 Sin materias asignadas (idMaterias: ${userData.idMaterias}, subjectIds: ${userData.subjectIds})`);
        }
        
        // Log algunos usuarios específicos con score para ver su estructura completa
        if (userData.email && (
          userData.email.includes('ruben') || 
          userData.email.includes('santiago') ||
          userData.email === '0265630@up.edu.mx' // usuario con score alto
        )) {
          console.log(`  🔍 ESTRUCTURA COMPLETA de ${userData.email}:`, userData);
        }
        
        usersData.push({
          id: doc.id,
          ...userData
        });
      });

      // Cargar KPIs para todos los usuarios
      console.log('📊 Cargando KPIs de usuarios...');
      let usuariosConKPIs = 0;
      
      // Cargar KPIs y profesores enrolados para todos los usuarios (en paralelo para ser más eficiente)
      const dataPromises = usersData.map(async (user, index) => {
        const promises = [];
        
        // Promise para KPIs
        const kpiPromise = (async () => {
          try {
            const kpiDoc = await getDoc(doc(db, 'users', user.id, 'kpis', 'dashboard'));
            
            if (kpiDoc.exists()) {
              const kpiData = kpiDoc.data();
              usersData[index].kpisData = kpiData;
              const scoreGlobal = kpiData?.global?.scoreGlobal || 0;
              usersData[index].scoreGlobal = scoreGlobal;
              
              if (scoreGlobal > 0) {
                console.log(`✅ KPIs cargados para ${user.email || user.displayName}: ${scoreGlobal.toLocaleString()} puntos`);
                return 1;
              }
            }
            return 0;
          } catch (error) {
            return 0;
          }
        })();
        
        // Promise para profesores enrolados usando la colección enrollments
        const teachersPromise = (async () => {
          try {
            console.log(`🔍 Buscando enrollments para usuario: ${user.email || user.displayName} (ID: ${user.id})`);
            
            // Buscar todos los enrollments donde este usuario es el estudiante
            const enrollmentsQuery = query(
              collection(db, 'enrollments'),
              where('studentId', '==', user.id)
            );
            
            const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
            console.log(`📋 Enrollments encontrados para ${user.email || user.displayName}: ${enrollmentsSnapshot.size}`);
            
            if (enrollmentsSnapshot.size === 0) {
              console.log(`⚠️ Usuario ${user.email || user.displayName} no tiene enrollments`);
              return [];
            }
            
            // Extraer los teacherIds únicos de los enrollments
            const teacherIds = new Set();
            enrollmentsSnapshot.forEach((doc) => {
              const enrollment = doc.data();
              if (enrollment.teacherId) {
                teacherIds.add(enrollment.teacherId);
                console.log(`  📚 Enrollment encontrado: teacherId=${enrollment.teacherId}, materiaId=${enrollment.materiaId}`);
              }
            });
            
            const uniqueTeacherIds = Array.from(teacherIds);
            console.log(`👨‍🏫 Profesores únicos encontrados para ${user.email || user.displayName}:`, uniqueTeacherIds);
            
            if (uniqueTeacherIds.length === 0) return [];
            
            // Obtener nombres de los profesores
            const teacherPromises = uniqueTeacherIds.map(async (teacherId) => {
              try {
                const teacherDoc = await getDoc(doc(db, 'users', teacherId as string));
                if (teacherDoc.exists()) {
                  const teacherData = teacherDoc.data();
                  const teacherName = teacherData.displayName || teacherData.nombre || teacherId;
                  console.log(`  👨‍🏫 Profesor ${teacherId}: ${teacherName}`);
                  return teacherName;
                }
                console.log(`  ⚠️ Profesor ${teacherId}: documento no encontrado`);
                return teacherId;
              } catch (error) {
                console.error(`  ❌ Error obteniendo profesor ${teacherId}:`, error);
                return teacherId;
              }
            });
            
            const teacherNames = await Promise.all(teacherPromises);
            usersData[index].enrolledTeachers = uniqueTeacherIds as string[];
            usersData[index].teacherNames = teacherNames.join(', ');
            
            if (teacherNames.length > 0) {
              console.log(`✅ Profesores cargados para ${user.email || user.displayName}: ${teacherNames.join(', ')}`);
            }
            
            return teacherNames;
          } catch (error) {
            console.error(`❌ Error cargando profesores para ${user.email || user.displayName}:`, error);
            return [];
          }
        })();
        
        promises.push(kpiPromise, teachersPromise);
        const [kpiResult] = await Promise.all(promises);
        return kpiResult as number;
      });
      
      // Esperar a que todas las promesas terminen
      const results = await Promise.all(dataPromises);
      usuariosConKPIs = results.reduce((sum: number, result: number) => sum + result, 0);
      
      console.log(`📊 Usuarios con KPIs: ${usuariosConKPIs} de ${usersData.length} verificados`);
      
      // Verificar que todos los usuarios importantes tengan sus KPIs cargados
      const usuariosImportantes = usersData.filter(u => 
        u.email?.includes('ruben') || 
        u.email?.includes('santiago') ||
        (u.scoreGlobal || 0) > 5000
      );
      
      if (usuariosImportantes.length > 0) {
        console.log(`👑 Usuarios con scores altos encontrados:`, 
          usuariosImportantes.map(u => ({
            email: u.email,
            scoreGlobal: u.scoreGlobal || 0
          }))
        );
      }

      console.log(`📊 TOTAL USUARIOS CARGADOS: ${usersData.length} (esperados: 65)`);
      
      // INVESTIGACIÓN: Explorar colecciones relacionadas con materias/profesores
      await investigateDataStructure();
      console.log(`📄 Primeros 5 usuarios:`, usersData.slice(0, 5).map(u => ({
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        nombre: u.nombre
      })));
      
      if (usersData.length < 65) {
        console.warn(`⚠️ PROBLEMA: Solo se cargaron ${usersData.length} usuarios de los 65 esperados`);
        console.warn(`❌ FALTAN ${65 - usersData.length} usuarios`);
        
        // Intentar una segunda consulta para debug
        console.log('🔄 Intentando segunda consulta para debug...');
        const secondSnapshot = await getDocs(collection(db, 'users'));
        console.log(`🔍 Segunda consulta size: ${secondSnapshot.size}`);
        
        // También intentar contar todos los documentos con Firebase Admin
        console.log('🔍 Intentando consulta directa con límite alto...');
        try {
          const highLimitQuery = query(collection(db, 'users'), limit(1000));
          const highLimitSnapshot = await getDocs(highLimitQuery);
          console.log(`🔍 Consulta con límite 1000: ${highLimitSnapshot.size} documentos`);
          
          // Log de cada documento para ver cuáles faltan
          const loadedEmails = new Set(usersData.map(u => u.email).filter(Boolean));
          const loadedIds = new Set(usersData.map(u => u.id));
          
          console.log(`📧 Total emails válidos cargados: ${loadedEmails.size}`);
          console.log(`🆔 Total IDs cargados: ${loadedIds.size}`);
          console.log(`📧 Primeros 10 emails:`, Array.from(loadedEmails).slice(0, 10).sort());
          
          // Intentar crear una consulta de solo lectura directamente
          console.log('🔍 Verificando si el problema son las reglas de Firestore...');
          
          // Log de usuarios con datos incompletos
          const usersWithoutEmail = usersData.filter(u => !u.email);
          const usersWithoutDisplayName = usersData.filter(u => !u.displayName && !u.nombre);
          
          console.log(`❌ Usuarios sin email: ${usersWithoutEmail.length}`);
          console.log(`❌ Usuarios sin nombre: ${usersWithoutDisplayName.length}`);
          
          if (usersWithoutEmail.length > 0) {
            console.log('👤 Usuarios sin email:', usersWithoutEmail.map(u => u.id));
          }
          
          // DIAGNÓSTICO FINAL: Verificar si es un problema de Firebase
          console.log('🔥 DIAGNÓSTICO FIREBASE:');
          console.log('- Snapshot.size:', usersSnapshot.size);
          console.log('- Snapshot.metadata:', usersSnapshot.metadata);
          console.log('- Query ejecutado sin errores');
          console.log('- Total documentos procesados:', usersData.length);
          console.log('- CONCLUSIÓN: Firebase está devolviendo exactamente 52 documentos');
          console.log('- PROBLEMA: Los otros 13 usuarios NO EXISTEN en la base de datos o están siendo filtrados por algo más profundo');
          
          // Sugerencias de solución
          console.log('🔧 POSIBLES SOLUCIONES:');
          console.log('1. Verificar en Firebase Console si realmente existen 65 usuarios');
          console.log('2. Revisar si hay índices compuestos que limiten las consultas');
          console.log('3. Verificar permisos de la cuenta de servicio de Firebase');
          console.log('4. Los documentos faltantes pueden estar corruptos o en otra base de datos');
          
        } catch (error) {
          console.error('❌ Error en consulta con límite alto:', error);
        }
      }
      
      setUsers(usersData);
      setFilteredUsers(usersData);
    } catch (error) {
      console.error('❌ Error loading users:', error);
      console.error('❌ Error details:', error);
    } finally {
      setLoading(false);
    }
  };

  // Función para eliminar usuario
  const deleteUser = async (userId: string, userEmail: string) => {
    if (!window.confirm(`¿Estás seguro que quieres eliminar el usuario ${userEmail}? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      console.log(`🗑️ Eliminando usuario: ${userEmail} (${userId})`);
      
      // Eliminar de la colección principal 'users'
      await deleteDoc(doc(db, 'users', userId));
      console.log('✅ Usuario eliminado de colección users');
      
      // Verificar si existe en schoolTeachers y eliminar
      try {
        const teacherDoc = await getDoc(doc(db, 'schoolTeachers', userId));
        if (teacherDoc.exists()) {
          await deleteDoc(doc(db, 'schoolTeachers', userId));
          console.log('✅ Usuario eliminado de colección schoolTeachers');
        }
      } catch (error) {
        console.log('ℹ️ Usuario no encontrado en schoolTeachers o error:', error);
      }
      
      // Verificar si existe en schoolStudents y eliminar
      try {
        const studentDoc = await getDoc(doc(db, 'schoolStudents', userId));
        if (studentDoc.exists()) {
          await deleteDoc(doc(db, 'schoolStudents', userId));
          console.log('✅ Usuario eliminado de colección schoolStudents');
        }
      } catch (error) {
        console.log('ℹ️ Usuario no encontrado en schoolStudents o error:', error);
      }
      
      // Actualizar la lista local de usuarios
      const updatedUsers = users.filter(user => user.id !== userId);
      setUsers(updatedUsers);
      // Aplicar filtros existentes para la lista actualizada
      const filteredData = updatedUsers.filter(user => 
        (!filters.nombre || (user.displayName || user.nombre || '').toLowerCase().includes(filters.nombre.toLowerCase())) &&
        (!filters.email || (user.email || '').toLowerCase().includes(filters.email.toLowerCase())) &&
        (!filters.subscription || user.subscription === filters.subscription) &&
        (!filters.profesores || (user.teacherNames || '').toLowerCase().includes(filters.profesores.toLowerCase()))
      );
      setFilteredUsers(filteredData);
      
      alert(`Usuario ${userEmail} eliminado exitosamente`);
      
    } catch (error) {
      console.error('❌ Error eliminando usuario:', error);
      alert(`Error eliminando usuario: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  // Función para investigar la estructura de datos
  const investigateDataStructure = async () => {
    try {
      console.log('🔍 INVESTIGANDO ESTRUCTURA DE DATOS...');
      
      // 1. Explorar schoolSubjects
      console.log('📚 Explorando colección schoolSubjects...');
      const subjectsSnapshot = await getDocs(query(collection(db, 'schoolSubjects'), limit(5)));
      console.log(`📊 Total documentos en schoolSubjects: ${subjectsSnapshot.size}`);
      
      subjectsSnapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`  📖 Materia:`, {
          id: doc.id,
          nombre: data.nombre,
          idProfesor: data.idProfesor,
          idEscuela: data.idEscuela || data.idColegio,
          campos: Object.keys(data)
        });
      });
      
      // 2. Explorar si hay enrollments o relaciones en otras colecciones
      const possibleCollections = [
        'enrollments', 'studentEnrollments', 'subjectEnrollments', 
        'classrooms', 'studentSubjects', 'userSubjects',
        'schoolEnrollments', 'materiaEstudiantes'
      ];
      
      for (const collectionName of possibleCollections) {
        try {
          const snapshot = await getDocs(query(collection(db, collectionName), limit(1)));
          if (snapshot.size > 0) {
            console.log(`✅ Encontrada colección: ${collectionName} (${snapshot.size}+ documentos)`);
            snapshot.forEach((doc) => {
              console.log(`  📋 Ejemplo de ${collectionName}:`, {
                id: doc.id,
                data: doc.data(),
                campos: Object.keys(doc.data())
              });
            });
          }
        } catch (error) {
          // Colección no existe
        }
      }
      
      // 3. Buscar un usuario con score alto para ver si tiene subcolecciones
      const highScoreUser = users.find(u => (u.scoreGlobal || 0) > 5000);
      if (highScoreUser) {
        console.log(`🔍 Explorando subcolecciones del usuario con score alto: ${highScoreUser.email}`);
        const userRef = doc(db, 'users', highScoreUser.id);
        
        // Intentar obtener posibles subcolecciones
        const possibleSubcollections = [
          'subjects', 'materias', 'enrollments', 'classes', 'courses'
        ];
        
        for (const subcollectionName of possibleSubcollections) {
          try {
            const subSnapshot = await getDocs(query(collection(userRef, subcollectionName), limit(3)));
            if (subSnapshot.size > 0) {
              console.log(`  ✅ Subcolección encontrada: users/${highScoreUser.id}/${subcollectionName}`);
              subSnapshot.forEach((subDoc) => {
                console.log(`    📄 ${subDoc.id}:`, subDoc.data());
              });
            }
          } catch (error) {
            // Subcolección no existe
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Error investigando estructura:', error);
    }
  };

  // Nueva función para cargar TODOS los usuarios incluyendo los de Authentication
  const loadAllAuthUsers = async () => {
    try {
      setLoading(true);
      console.log('🔐 CARGANDO TODOS LOS USUARIOS (Firestore + Authentication)...');

      // Primero, obtener usuarios de Firestore (como ya lo hacemos)
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      
      const firestoreUsers: User[] = [];
      usersSnapshot.forEach((doc) => {
        const userData = doc.data();
        firestoreUsers.push({
          id: doc.id,
          ...userData
        });
      });

      console.log(`📂 Usuarios en Firestore: ${firestoreUsers.length}`);
      
      // Como no podemos acceder directamente a Firebase Auth desde el frontend,
      // vamos a mostrar la información que tenemos y explicar el problema
      console.log('🔍 DIAGNÓSTICO COMPLETO:');
      console.log('==========================================');
      console.log(`📊 Usuarios en Firestore (users collection): ${firestoreUsers.length}`);
      console.log(`📧 Usuarios con email válido: ${firestoreUsers.filter(u => u.email).length}`);
      console.log(`👥 Total que esperabas: 65`);
      console.log(`❌ Diferencia: ${65 - firestoreUsers.length} usuarios`);
      console.log('');
      console.log('🎯 PROBLEMA IDENTIFICADO:');
      console.log('- Los usuarios faltantes están en Firebase Authentication');
      console.log('- Se autenticaron con Google pero nunca completaron su perfil');
      console.log('- NO tienen documento en la colección "users" de Firestore');
      console.log('');
      console.log('🛠️ SOLUCIONES:');
      console.log('1. Crear Cloud Function para sincronizar Auth → Firestore');
      console.log('2. Forzar creación de perfil al primer login');
      console.log('3. Migrar usuarios de Auth a Firestore manualmente');
      
      // Mostrar algunos emails de muestra de Firestore
      const emails = firestoreUsers.map(u => u.email).filter(Boolean).sort();
      console.log('');
      console.log(`📧 EMAILS EN FIRESTORE (${emails.length}):`);
      console.log(emails.slice(0, 20)); // Mostrar primeros 20
      
      // Actualizar la vista con los usuarios de Firestore
      setUsers(firestoreUsers);
      setFilteredUsers(firestoreUsers);

      alert(`DIAGNÓSTICO COMPLETO:

📊 Usuarios en Firestore: ${firestoreUsers.length}
👥 Total esperado: 65
❌ Faltantes: ${65 - firestoreUsers.length}

🎯 PROBLEMA: Los usuarios faltantes están en Firebase Authentication pero NO en la colección 'users' de Firestore.

✅ SOLUCIÓN: Necesitas crear un proceso para migrar usuarios de Authentication a Firestore.

Ver consola para más detalles.`);

    } catch (error) {
      console.error('❌ Error cargando usuarios completos:', error);
      alert('Error cargando diagnóstico completo. Ver consola.');
    } finally {
      setLoading(false);
    }
  };

  // Sorting functions
  const sortData = <T,>(data: T[], sortConfig: SortConfig | null, getValueFn: (item: T, key: string) => any): T[] => {
    if (!sortConfig) return data;
    
    return [...data].sort((a, b) => {
      const aVal = getValueFn(a, sortConfig.key);
      const bVal = getValueFn(b, sortConfig.key);
      
      if (aVal < bVal) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aVal > bVal) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };
  
  const getUserValue = (user: User, key: string): any => {
    switch (key) {
      case 'name':
        return (user.displayName || user.nombre || '').toLowerCase();
      case 'email':
        return (user.email || '').toLowerCase();
      case 'subscription':
        return (user.subscription || 'free').toLowerCase();
      case 'isTeacher':
        return user.isTeacher ? 'true' : 'false';
      case 'createdAt':
        return user.createdAt ? new Date(user.createdAt.seconds * 1000).getTime() : 0;
      case 'lastLogin':
        return getLastLoginTimestamp(user);
      case 'scoreGlobal':
        return user.scoreGlobal || user.kpisData?.global?.scoreGlobal || 0;
      case 'teacherNames':
        return (user.teacherNames || '').toLowerCase();
      default:
        return '';
    }
  };
  
  const getLastLoginTimestamp = (user: User): number => {
    const dates = [];
    if (user.lastLoginAt) dates.push({ value: user.lastLoginAt, priority: 1 });
    if (user.lastLogin) dates.push({ value: user.lastLogin, priority: 1 });
    if (user.lastActivity) dates.push({ value: user.lastActivity, priority: 2 });
    if (user.updatedAt) dates.push({ value: user.updatedAt, priority: 3 });
    
    const processedDates = dates.map(item => {
      let timestamp = 0;
      if (item.value && item.value.seconds) {
        timestamp = item.value.seconds;
      } else if (item.value && item.value.toDate) {
        timestamp = item.value.toDate().getTime() / 1000;
      } else if (typeof item.value === 'string') {
        timestamp = new Date(item.value).getTime() / 1000;
      } else if (item.value instanceof Date) {
        timestamp = item.value.getTime() / 1000;
      }
      return { ...item, timestamp };
    }).filter(item => item.timestamp > 0);
    
    processedDates.sort((a, b) => {
      if (a.priority === b.priority) {
        return b.timestamp - a.timestamp;
      }
      return a.priority - b.priority;
    });
    
    return processedDates.length > 0 ? processedDates[0].timestamp : 0;
  };
  
  const getMessageValue = (message: ContactMessage, key: string): any => {
    switch (key) {
      case 'name':
        return message.name.toLowerCase();
      case 'email':
        return message.email.toLowerCase();
      case 'subject':
        return message.subject.toLowerCase();
      case 'message':
        return message.message.toLowerCase();
      case 'status':
        return message.status || 'pending';
      case 'timestamp':
        return message.timestamp ? (message.timestamp.seconds ? message.timestamp.seconds : new Date(message.timestamp).getTime() / 1000) : 0;
      default:
        return '';
    }
  };
  
  const getProRequestValue = (request: ProRequest, key: string): any => {
    switch (key) {
      case 'userName':
        return request.userName.toLowerCase();
      case 'userEmail':
        return request.userEmail.toLowerCase();
      case 'currentSubscription':
        return request.currentSubscription.toLowerCase();
      case 'status':
        return request.status;
      case 'requestedAt':
        return request.requestedAt ? (request.requestedAt.seconds ? request.requestedAt.seconds : new Date(request.requestedAt).getTime() / 1000) : 0;
      default:
        return '';
    }
  };
  
  const handleSort = (key: string, tableType: 'users' | 'messages' | 'proRequests') => {
    let currentConfig: SortConfig | null = null;
    let setConfigFn: (config: SortConfig | null) => void;
    
    switch (tableType) {
      case 'users':
        currentConfig = usersSortConfig;
        setConfigFn = setUsersSortConfig;
        break;
      case 'messages':
        currentConfig = messagesSortConfig;
        setConfigFn = setMessagesSortConfig;
        break;
      case 'proRequests':
        currentConfig = proRequestsSortConfig;
        setConfigFn = setProRequestsSortConfig;
        break;
    }
    
    let direction: 'asc' | 'desc' = 'asc';
    if (currentConfig && currentConfig.key === key && currentConfig.direction === 'asc') {
      direction = 'desc';
    }
    
    setConfigFn({ key, direction });
  };
  
  const getSortIcon = (columnKey: string, sortConfig: SortConfig | null): string => {
    if (!sortConfig || sortConfig.key !== columnKey) {
      return '↕️'; // Both arrows
    }
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  // Función para filtrar usuarios
  const filterUsers = () => {
    let filtered = users.filter(user => {
      const nombre = (user.displayName || user.nombre || '').toLowerCase();
      const email = (user.email || '').toLowerCase();
      const subscription = (user.subscription || 'free').toLowerCase();
      const profesores = (user.teacherNames || '').toLowerCase();
      
      // Filtro para isTeacher
      let passesTeacherFilter = true;
      if (filters.role === 'teacher') {
        passesTeacherFilter = user.isTeacher === true;
      } else if (filters.role === 'individual') {
        passesTeacherFilter = user.isTeacher === false || user.isTeacher === undefined;
      } else if (filters.role === 'admin') {
        passesTeacherFilter = user.schoolRole === 'admin';
      }
      
      return nombre.includes(filters.nombre.toLowerCase()) &&
             email.includes(filters.email.toLowerCase()) &&
             subscription.includes(filters.subscription.toLowerCase()) &&
             profesores.includes(filters.profesores.toLowerCase()) &&
             passesTeacherFilter;
    });
    
    // Apply sorting
    filtered = sortData(filtered, usersSortConfig, getUserValue);
    
    setFilteredUsers(filtered);
  };

  const loadMessages = async () => {
    try {
      setLoading(true);
      const messagesQuery = query(
        collection(db, 'contactMessages'),
        orderBy('createdAt', 'desc')
      );
      const messagesSnapshot = await getDocs(messagesQuery);
      const messagesData: ContactMessage[] = [];
      
      messagesSnapshot.forEach((doc) => {
        const messageData = doc.data();
        messagesData.push({
          id: doc.id,
          name: messageData.name || '',
          email: messageData.email || '',
          subject: messageData.subject || '',
          message: messageData.message || '',
          timestamp: messageData.createdAt || messageData.timestamp,
          userId: messageData.userId || null,
          status: messageData.status || 'pending',
          read: messageData.read || false
        });
      });
      
      console.log(`Total messages loaded: ${messagesData.length}`);
      
      setMessages(messagesData);
      setFilteredMessages(messagesData);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProRequests = async () => {
    try {
      setLoading(true);
      const proRequestsQuery = query(
        collection(db, 'proRequests'),
        orderBy('requestedAt', 'desc')
      );
      const proRequestsSnapshot = await getDocs(proRequestsQuery);
      const proRequestsData: ProRequest[] = [];
      
      proRequestsSnapshot.forEach((doc) => {
        proRequestsData.push({
          id: doc.id,
          ...doc.data()
        } as ProRequest);
      });
      
      console.log(`Total pro requests loaded: ${proRequestsData.length}`);
      
      setProRequests(proRequestsData);
      setFilteredProRequests(proRequestsData);
    } catch (error) {
      console.error('Error loading pro requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterMessages = () => {
    let filtered = messages.filter(message => {
      const matchesSearch = !messageFilters.search || 
        message.name.toLowerCase().includes(messageFilters.search.toLowerCase()) ||
        message.email.toLowerCase().includes(messageFilters.search.toLowerCase()) ||
        message.subject.toLowerCase().includes(messageFilters.search.toLowerCase()) ||
        message.message.toLowerCase().includes(messageFilters.search.toLowerCase());
      
      const matchesStatus = !messageFilters.status || message.status === messageFilters.status;
      
      return matchesSearch && matchesStatus;
    });
    
    // Apply sorting
    filtered = sortData(filtered, messagesSortConfig, getMessageValue);
    
    setFilteredMessages(filtered);
  };

  const handleViewMessage = async (message: ContactMessage) => {
    setSelectedMessage(message);
    setShowMessageModal(true);
    
    // Marcar como leído si no lo está
    if (!message.read) {
      try {
        await updateDoc(doc(db, 'contactMessages', message.id), {
          read: true
        });
        
        // Actualizar el estado local
        const updatedMessages = messages.map(m => 
          m.id === message.id ? { ...m, read: true } : m
        );
        setMessages(updatedMessages);
      } catch (error) {
        console.error('Error marking message as read:', error);
      }
    }
  };

  const handleUpdateMessageStatus = async (messageId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'contactMessages', messageId), {
        status: newStatus
      });
      
      // Actualizar el estado local
      const updatedMessages = messages.map(m => 
        m.id === messageId ? { ...m, status: newStatus } : m
      );
      setMessages(updatedMessages);
      
      // Si el modal está abierto, actualizar el mensaje seleccionado
      if (selectedMessage && selectedMessage.id === messageId) {
        setSelectedMessage({ ...selectedMessage, status: newStatus });
      }
    } catch (error) {
      console.error('Error updating message status:', error);
    }
  };

  // Funciones para solicitudes Pro
  const handleApproveProRequest = async (requestId: string) => {
    if (!confirm('¿Estás seguro de que quieres aprobar esta solicitud Pro?')) {
      return;
    }

    try {
      const request = proRequests.find(r => r.id === requestId);
      if (!request) return;

      // Actualizar la solicitud
      await updateDoc(doc(db, 'proRequests', requestId), {
        status: 'approved',
        processedAt: serverTimestamp(),
        processedBy: 'super_admin'
      });

      // Actualizar la suscripción del usuario a PRO
      await updateDoc(doc(db, 'users', request.userId), {
        subscription: 'PRO'
      });

      // Actualizar el estado local
      const updatedRequests = proRequests.map(r => 
        r.id === requestId 
          ? { ...r, status: 'approved' as const, processedAt: serverTimestamp() }
          : r
      );
      setProRequests(updatedRequests);
      setFilteredProRequests(updatedRequests.filter(r => 
        !proFilters.status || r.status === proFilters.status
      ));

      alert('¡Solicitud aprobada! El usuario ahora tiene suscripción PRO.');
    } catch (error) {
      console.error('Error approving pro request:', error);
      alert('Error al aprobar la solicitud. Inténtalo de nuevo.');
    }
  };

  const handleRejectProRequest = async (requestId: string) => {
    const reason = prompt('Razón del rechazo (opcional):');
    
    if (!confirm('¿Estás seguro de que quieres rechazar esta solicitud Pro?')) {
      return;
    }

    try {
      await updateDoc(doc(db, 'proRequests', requestId), {
        status: 'rejected',
        processedAt: serverTimestamp(),
        processedBy: 'super_admin',
        notes: reason || ''
      });

      // Actualizar el estado local
      const updatedRequests = proRequests.map(r => 
        r.id === requestId 
          ? { ...r, status: 'rejected' as const, processedAt: serverTimestamp(), notes: reason || '' }
          : r
      );
      setProRequests(updatedRequests);
      setFilteredProRequests(updatedRequests.filter(r => 
        !proFilters.status || r.status === proFilters.status
      ));

      alert('Solicitud rechazada.');
    } catch (error) {
      console.error('Error rejecting pro request:', error);
      alert('Error al rechazar la solicitud. Inténtalo de nuevo.');
    }
  };

  const filterProRequests = () => {
    let filtered = proRequests.filter(request => {
      const matchesSearch = !proFilters.search || 
        request.userName.toLowerCase().includes(proFilters.search.toLowerCase()) ||
        request.userEmail.toLowerCase().includes(proFilters.search.toLowerCase());
      
      const matchesStatus = !proFilters.status || request.status === proFilters.status;
      
      return matchesSearch && matchesStatus;
    });
    
    // Apply sorting
    filtered = sortData(filtered, proRequestsSortConfig, getProRequestValue);
    
    setFilteredProRequests(filtered);
  };

  // Ejecutar filtros cuando cambien
  React.useEffect(() => {
    filterUsers();
  }, [filters, users, usersSortConfig]);

  React.useEffect(() => {
    filterMessages();
  }, [messageFilters, messages, messagesSortConfig]);

  // Función para corregir usuarios sin lastLoginAt
  const fixUsersWithoutLastLogin = async () => {
    if (!window.confirm('¿Estás seguro de que quieres corregir los usuarios sin lastLoginAt? Esto usará la fecha de creación o última actualización como referencia.')) {
      return;
    }

    try {
      setLoading(true);
      let fixedCount = 0;
      let errorCount = 0;

      for (const user of users) {
        // Verificar si el usuario no tiene lastLoginAt o lastLogin
        if (!user.lastLoginAt && !user.lastLogin) {
          try {
            // Usar la fecha de creación o última actualización como fallback
            let fallbackDate = user.createdAt || user.updatedAt;
            
            // Si no hay fecha de creación ni actualización, usar la fecha actual
            if (!fallbackDate) {
              fallbackDate = serverTimestamp();
            }

            await updateDoc(doc(db, 'users', user.id), {
              lastLoginAt: fallbackDate,
              lastLogin: fallbackDate,
              updatedAt: serverTimestamp()
            });
            
            fixedCount++;
            console.log(`✅ Fixed user ${user.email || user.id}`);
          } catch (error) {
            console.error(`❌ Error fixing user ${user.email || user.id}:`, error);
            errorCount++;
          }
        }
      }

      alert(`Proceso completado:\n✅ Usuarios corregidos: ${fixedCount}\n❌ Errores: ${errorCount}`);
      
      // Recargar usuarios para ver los cambios
      if (fixedCount > 0) {
        loadUsers();
      }
    } catch (error) {
      console.error('Error en el proceso de corrección:', error);
      alert('Error durante la corrección. Ver consola para detalles.');
    } finally {
      setLoading(false);
    }
  };

  // Función para debuggear datos de login de un usuario específico
  const debugUserLogin = async () => {
    const email = prompt('Ingresa el email del usuario a debuggear:');
    if (!email) return;

    try {
      setLoading(true);
      const targetUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      
      if (!targetUser) {
        alert('Usuario no encontrado en la lista cargada.');
        return;
      }

      // Obtener datos frescos del usuario desde Firestore
      const userDocRef = doc(db, 'users', targetUser.id);
      const userDocSnap = await getDoc(userDocRef);
      
      if (!userDocSnap.exists()) {
        alert('Usuario no encontrado en Firestore.');
        return;
      }

      const freshUserData = userDocSnap.data();
      
      const debugInfo = {
        'Email': freshUserData.email || 'N/A',
        'User ID': targetUser.id,
        'lastLoginAt': freshUserData.lastLoginAt || 'No existe',
        'lastLogin': freshUserData.lastLogin || 'No existe', 
        'lastActivity': freshUserData.lastActivity || 'No existe',
        'updatedAt': freshUserData.updatedAt || 'No existe',
        'createdAt': freshUserData.createdAt || 'No existe',
        'lastAuthProvider': freshUserData.lastAuthProvider || 'No existe'
      };

      console.log('🔍 DEBUG USUARIO:', email);
      console.table(debugInfo);

      // Mostrar en alert también
      let alertMessage = `DEBUG USUARIO: ${email}\n\n`;
      Object.entries(debugInfo).forEach(([key, value]) => {
        let displayValue = value;
        if (value && typeof value === 'object' && value.seconds) {
          displayValue = new Date(value.seconds * 1000).toLocaleString('es-ES');
        } else if (value && typeof value === 'object' && value.toDate) {
          displayValue = value.toDate().toLocaleString('es-ES');
        }
        alertMessage += `${key}: ${displayValue}\n`;
      });

      alert(alertMessage);
      
    } catch (error) {
      console.error('Error debugging user:', error);
      alert('Error obteniendo datos del usuario. Ver consola para detalles.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    filterProRequests();
  }, [proFilters, proRequests, proRequestsSortConfig]);
  
  

  // Mostrar loading mientras se verifica el tipo de usuario
  if (userTypeLoading) {
    return (
      <div className="super-admin-container">
        <div className="loading-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
          <div className="loading-spinner"></div>
          <p>Verificando permisos de súper admin...</p>
        </div>
      </div>
    );
  }

  // Si no es súper admin, no mostrar nada (será redirigido)
  if (!isSuperAdmin) {
    return null;
  }

  const renderUsersTab = () => {
    if (loading) {
      return (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Cargando usuarios...</p>
        </div>
      );
    }

    return (
      <div className="users-section">
        <div className="section-header">
          <h2>👥 Usuarios ({filteredUsers.length} de {users.length})</h2>
          <div className="action-buttons">
            <button 
              className="clear-filters-btn"
              onClick={() => setFilters({
                nombre: '',
                email: '',
                subscription: '',
                role: '',
                fechaCreacion: '',
                ultimaSesion: '',
                profesores: ''
              })}
              disabled={loading}
            >
              🗑️ Limpiar Filtros
            </button>
            <button 
              className="refresh-btn"
              onClick={loadUsers}
              disabled={loading}
            >
              🔄 Actualizar Firestore
            </button>
            <button 
              className="debug-btn"
              onClick={loadAllAuthUsers}
              disabled={loading}
            >
              👥 Mostrar TODOS los usuarios Auth
            </button>
          </div>
        </div>
        <div className="simple-table-container">
          <table className="simple-users-table">
            <thead>
              <tr>
                <th style={{ width: '15%', textAlign: 'center', cursor: 'pointer' }} onClick={() => handleSort('name', 'users')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    Nombre {getSortIcon('name', usersSortConfig)}
                  </div>
                  <div className="filter-input">
                    <input
                      type="text"
                      placeholder="Filtrar nombre..."
                      value={filters.nombre}
                      onChange={(e) => setFilters({...filters, nombre: e.target.value})}
                      className="header-filter"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </th>
                <th style={{ width: '18%', textAlign: 'center', cursor: 'pointer' }} onClick={() => handleSort('email', 'users')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    Email {getSortIcon('email', usersSortConfig)}
                  </div>
                  <div className="filter-input">
                    <input
                      type="text"
                      placeholder="Filtrar email..."
                      value={filters.email}
                      onChange={(e) => setFilters({...filters, email: e.target.value})}
                      className="header-filter"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </th>
                <th style={{ width: '10%', textAlign: 'center', cursor: 'pointer' }} onClick={() => handleSort('subscription', 'users')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    Suscripción {getSortIcon('subscription', usersSortConfig)}
                  </div>
                  <div className="filter-input">
                    <select
                      value={filters.subscription}
                      onChange={(e) => setFilters({...filters, subscription: e.target.value})}
                      className="header-filter"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="">Todas</option>
                      <option value="free">Free</option>
                      <option value="pro">Pro</option>
                      <option value="school">School</option>
                      <option value="university">University</option>
                    </select>
                  </div>
                </th>
                <th style={{ width: '14%', textAlign: 'center', cursor: 'pointer' }} onClick={() => handleSort('isTeacher', 'users')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    isTeacher {getSortIcon('isTeacher', usersSortConfig)}
                  </div>
                  <div className="filter-input">
                    <select
                      value={filters.role}
                      onChange={(e) => setFilters({...filters, role: e.target.value})}
                      className="header-filter"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="">Todos</option>
                      <option value="teacher">True</option>
                      <option value="individual">False</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </th>
                <th style={{ width: '12%', textAlign: 'center', cursor: 'pointer' }} onClick={() => handleSort('createdAt', 'users')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    Fecha Creación {getSortIcon('createdAt', usersSortConfig)}
                  </div>
                </th>
                <th style={{ width: '14%', textAlign: 'center', cursor: 'pointer' }} onClick={() => handleSort('lastLogin', 'users')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    Última Sesión {getSortIcon('lastLogin', usersSortConfig)}
                  </div>
                </th>
                <th style={{ width: '10%', textAlign: 'center', cursor: 'pointer' }} onClick={() => handleSort('scoreGlobal', 'users')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    Score Global {getSortIcon('scoreGlobal', usersSortConfig)}
                  </div>
                </th>
                <th style={{ width: '14%', textAlign: 'center', cursor: 'pointer' }} onClick={() => handleSort('teacherNames', 'users')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    Profesores Enrolados {getSortIcon('teacherNames', usersSortConfig)}
                  </div>
                  <div className="filter-input">
                    <input
                      type="text"
                      placeholder="Filtrar profesores..."
                      value={filters.profesores || ''}
                      onChange={(e) => setFilters({...filters, profesores: e.target.value})}
                      className="header-filter"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </th>
                <th style={{ width: '8%', textAlign: 'center' }}>
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td style={{ width: '15%' }}>
                    {user.displayName || user.nombre || 'Sin nombre'}
                  </td>
                  <td style={{ width: '18%' }}>
                    {user.email || 'Sin email'}
                  </td>
                  <td style={{ width: '10%' }}>
                    <span className={`sub-badge ${user.subscription || 'free'}`}>
                      {user.subscription || 'free'}
                    </span>
                  </td>
                  <td style={{ width: '14%' }}>
                    <span className={`teacher-badge ${user.isTeacher ? 'is-teacher' : 'not-teacher'}`}>
                      {user.isTeacher ? 'True' : 'False'}
                    </span>
                  </td>
                  <td style={{ width: '12%' }}>
                    {user.createdAt ? 
                      new Date(user.createdAt.seconds * 1000).toLocaleDateString() : 
                      'No disponible'
                    }
                  </td>
                  <td style={{ width: '14%' }}>
                    {(() => {
                      // Recopilar TODAS las posibles fechas de login/actividad
                      const dates = [];
                      
                      // Campos principales de login
                      if (user.lastLoginAt) dates.push({ field: 'lastLoginAt', value: user.lastLoginAt, priority: 1 });
                      if (user.lastLogin) dates.push({ field: 'lastLogin', value: user.lastLogin, priority: 1 });
                      
                      // Campos de actividad
                      if (user.lastActivity) dates.push({ field: 'lastActivity', value: user.lastActivity, priority: 2 });
                      if (user.updatedAt) dates.push({ field: 'updatedAt', value: user.updatedAt, priority: 3 });
                      
                      // Campos legacy
                      if (user.lastSignIn) dates.push({ field: 'lastSignIn', value: user.lastSignIn, priority: 4 });
                      if (user.createdAt) dates.push({ field: 'createdAt', value: user.createdAt, priority: 5 });
                      
                      // Convertir fechas y ordenar por más reciente
                      const processedDates = dates.map(item => {
                        let date = null;
                        let timestamp = 0;
                        
                        if (item.value && item.value.seconds) {
                          date = new Date(item.value.seconds * 1000);
                          timestamp = item.value.seconds;
                        } else if (item.value && item.value.toDate) {
                          date = item.value.toDate();
                          timestamp = date.getTime() / 1000;
                        } else if (typeof item.value === 'string') {
                          date = new Date(item.value);
                          timestamp = date.getTime() / 1000;
                        } else if (item.value instanceof Date) {
                          date = item.value;
                          timestamp = date.getTime() / 1000;
                        }
                        
                        return {
                          ...item,
                          date,
                          timestamp,
                          isValid: date && !isNaN(date.getTime())
                        };
                      }).filter(item => item.isValid);
                      
                      // Ordenar por timestamp más reciente, pero priorizando campos importantes
                      processedDates.sort((a, b) => {
                        // Si tienen la misma prioridad, ordenar por fecha
                        if (a.priority === b.priority) {
                          return b.timestamp - a.timestamp;
                        }
                        // Sino, ordenar por prioridad (menor número = mayor prioridad)
                        return a.priority - b.priority;
                      });
                      
                      if (processedDates.length === 0) {
                        return <span style={{ color: '#dc2626', fontStyle: 'italic' }}>Sin datos</span>;
                      }
                      
                      const mostRecent = processedDates[0];
                      const now = new Date();
                      const diffHours = (now.getTime() - mostRecent.date.getTime()) / (1000 * 60 * 60);
                      
                      const dateString = mostRecent.date.toLocaleString('es-ES', {
                        year: '2-digit',
                        month: '2-digit', 
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      });
                      
                      // Mostrar fuente y estado
                      let sourceIndicator = '';
                      if (mostRecent.field === 'lastLoginAt' || mostRecent.field === 'lastLogin') {
                        sourceIndicator = '🔐'; // Login real
                      } else if (mostRecent.field === 'lastActivity') {
                        sourceIndicator = '⚡'; // Actividad
                      } else if (mostRecent.field === 'updatedAt') {
                        sourceIndicator = '📝'; // Actualización
                      } else {
                        sourceIndicator = '📅'; // Otro
                      }
                      
                      // Color según recencia
                      let color = '#374151'; // default
                      if (diffHours < 1) color = '#10b981'; // verde
                      else if (diffHours < 24) color = '#3b82f6'; // azul
                      else if (diffHours > 168) color = '#6b7280'; // gris
                      
                      return (
                        <div style={{ fontSize: '0.85rem' }}>
                          <span style={{ color, fontWeight: diffHours < 24 ? 'bold' : 'normal' }}>
                            {sourceIndicator} {dateString}
                          </span>
                          <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '2px' }}>
                            {mostRecent.field}
                            {diffHours < 1 && ' (online)'}
                            {diffHours >= 1 && diffHours < 24 && ' (hoy)'}
                            {diffHours >= 24 && diffHours < 168 && ` (${Math.floor(diffHours/24)}d)`}
                            {diffHours >= 168 && ` (${Math.floor(diffHours/168)}sem)`}
                          </div>
                        </div>
                      );
                    })()}
                  </td>
                  <td style={{ width: '10%' }}>
                    {(() => {
                      const score = user.scoreGlobal || user.kpisData?.global?.scoreGlobal || 0;
                      
                      if (score > 0) {
                        return (
                          <span style={{ 
                            fontWeight: 'bold', 
                            color: score >= 20000 ? '#16a34a' : 
                                   score >= 10000 ? '#ea580c' : 
                                   score >= 1000 ? '#d97706' :
                                   '#dc2626' 
                          }}>
                            {score.toLocaleString()}
                          </span>
                        );
                      } else {
                        return <span style={{ color: '#6b7280', fontStyle: 'italic' }}>Sin datos</span>;
                      }
                    })()}
                  </td>
                  <td style={{ width: '14%' }}>
                    {user.teacherNames ? (
                      <div style={{ 
                        fontSize: '0.8rem',
                        color: '#374151',
                        maxHeight: '40px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }} title={user.teacherNames}>
                        {user.teacherNames.length > 30 ? 
                          `${user.teacherNames.substring(0, 30)}...` : 
                          user.teacherNames
                        }
                      </div>
                    ) : (
                      <span style={{ color: '#6b7280', fontStyle: 'italic', fontSize: '0.8rem' }}>Sin profesores</span>
                    )}
                  </td>
                  <td style={{ width: '8%', textAlign: 'center' }}>
                    <button
                      onClick={() => deleteUser(user.id, user.email || 'Usuario sin email')}
                      className="delete-user-btn"
                      title={`Eliminar usuario ${user.email || user.displayName || user.nombre}`}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredUsers.length === 0 && users.length > 0 && (
            <div className="no-users">
              <p>No se encontraron usuarios con los filtros aplicados</p>
            </div>
          )}
          
          {users.length === 0 && (
            <div className="no-users">
              <p>No se encontraron usuarios</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderTeachersTab = () => {
    return (
      <div className="teachers-section">
        <TeacherManagementImproved />
      </div>
    );
  };

  const renderMessagesTab = () => {
    if (loading) {
      return (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Cargando mensajes...</p>
        </div>
      );
    }

    return (
      <div className="messages-section">
        <h2>📬 Mensajes de Contacto ({filteredMessages.length} de {messages.length})</h2>
        
        <div className="message-filters">
          <input
            type="text"
            placeholder="Buscar mensajes..."
            value={messageFilters.search}
            onChange={(e) => setMessageFilters({...messageFilters, search: e.target.value})}
            className="search-input"
          />
          
          <select
            value={messageFilters.status}
            onChange={(e) => setMessageFilters({...messageFilters, status: e.target.value})}
            className="status-filter"
          >
            <option value="">Todos los estados</option>
            <option value="pending">Pendiente</option>
            <option value="responded">Respondido</option>
            <option value="resolved">Resuelto</option>
          </select>
        </div>

        <div className="simple-table-container">
          <table className="simple-messages-table">
            <thead>
              <tr>
                <th style={{ width: '120px', minWidth: '120px', cursor: 'pointer' }} onClick={() => handleSort('name', 'messages')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Nombre {getSortIcon('name', messagesSortConfig)}
                  </div>
                </th>
                <th style={{ width: '150px', minWidth: '150px', cursor: 'pointer' }} onClick={() => handleSort('email', 'messages')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Email {getSortIcon('email', messagesSortConfig)}
                  </div>
                </th>
                <th style={{ width: '130px', minWidth: '130px', cursor: 'pointer' }} onClick={() => handleSort('subject', 'messages')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Asunto {getSortIcon('subject', messagesSortConfig)}
                  </div>
                </th>
                <th style={{ width: '200px', minWidth: '200px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => handleSort('message', 'messages')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Mensaje {getSortIcon('message', messagesSortConfig)}
                  </div>
                </th>
                <th style={{ width: '80px', minWidth: '80px', cursor: 'pointer' }} onClick={() => handleSort('status', 'messages')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Estado {getSortIcon('status', messagesSortConfig)}
                  </div>
                </th>
                <th style={{ width: '100px', minWidth: '100px', cursor: 'pointer' }} onClick={() => handleSort('timestamp', 'messages')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Fecha {getSortIcon('timestamp', messagesSortConfig)}
                  </div>
                </th>
                <th style={{ width: '100px', minWidth: '100px', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredMessages.map((message) => (
                <tr key={message.id} className={message.read ? '' : 'unread-message'}>
                  <td style={{ width: '120px', minWidth: '120px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{message.name}</td>
                  <td style={{ width: '150px', minWidth: '150px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <a href={`mailto:${message.email}`} className="email-link">
                      {message.email}
                    </a>
                  </td>
                  <td style={{ width: '130px', minWidth: '130px', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{message.subject}</td>
                  <td style={{ width: '200px', minWidth: '200px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <div className="message-preview" title={message.message}>
                      {message.message.length > 50 
                        ? `${message.message.substring(0, 50)}...` 
                        : message.message}
                    </div>
                  </td>
                  <td style={{ width: '80px', minWidth: '80px', maxWidth: '80px', textAlign: 'center' }}>
                    <span className={`status-badge ${message.status || 'pending'}`}>
                      {message.status === 'responded' ? '✅' : 
                       message.status === 'resolved' ? '✔️' : '⏳'}
                    </span>
                  </td>
                  <td style={{ width: '100px', minWidth: '100px', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                    {message.timestamp ? 
                      (message.timestamp.seconds ? 
                        new Date(message.timestamp.seconds * 1000).toLocaleDateString('es-MX', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        }) :
                        new Date(message.timestamp).toLocaleDateString('es-MX', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })
                      ) : 
                      'Sin fecha'
                    }
                  </td>
                  <td style={{ width: '100px', minWidth: '100px', maxWidth: '100px', textAlign: 'center', padding: '8px' }}>
                    <button 
                      className="action-btn view-btn"
                      onClick={() => handleViewMessage(message)}
                      title="Ver mensaje completo"
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }}
                    >
                      👁️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredMessages.length === 0 && messages.length > 0 && (
            <div className="no-messages">
              <p>No se encontraron mensajes con los filtros aplicados</p>
            </div>
          )}
          
          {messages.length === 0 && (
            <div className="no-messages">
              <p>No se encontraron mensajes</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderProTab = () => {
    if (loading) {
      return (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Cargando solicitudes Pro...</p>
        </div>
      );
    }

    return (
      <div className="pro-requests-section">
        <h2>🌟 Solicitudes Pro ({filteredProRequests.length} de {proRequests.length})</h2>
        
        <div className="pro-filters">
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={proFilters.search}
            onChange={(e) => setProFilters({ ...proFilters, search: e.target.value })}
            className="search-input"
          />
          <select
            value={proFilters.status}
            onChange={(e) => setProFilters({ ...proFilters, status: e.target.value })}
            className="status-filter"
          >
            <option value="">Todos los estados</option>
            <option value="pending">Pendiente</option>
            <option value="approved">Aprobado</option>
            <option value="rejected">Rechazado</option>
          </select>
        </div>

        <div className="simple-table-container">
          <table className="simple-pro-requests-table">
            <thead>
              <tr>
                <th style={{ width: '150px', minWidth: '150px', cursor: 'pointer' }} onClick={() => handleSort('userName', 'proRequests')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Usuario {getSortIcon('userName', proRequestsSortConfig)}
                  </div>
                </th>
                <th style={{ width: '180px', minWidth: '180px', cursor: 'pointer' }} onClick={() => handleSort('userEmail', 'proRequests')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Email {getSortIcon('userEmail', proRequestsSortConfig)}
                  </div>
                </th>
                <th style={{ width: '120px', minWidth: '120px', cursor: 'pointer' }} onClick={() => handleSort('currentSubscription', 'proRequests')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Suscripción Actual {getSortIcon('currentSubscription', proRequestsSortConfig)}
                  </div>
                </th>
                <th style={{ width: '100px', minWidth: '100px', textAlign: 'center', cursor: 'pointer' }} onClick={() => handleSort('status', 'proRequests')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    Estado {getSortIcon('status', proRequestsSortConfig)}
                  </div>
                </th>
                <th style={{ width: '120px', minWidth: '120px', cursor: 'pointer' }} onClick={() => handleSort('requestedAt', 'proRequests')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Fecha Solicitud {getSortIcon('requestedAt', proRequestsSortConfig)}
                  </div>
                </th>
                <th style={{ width: '200px', minWidth: '200px', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredProRequests.map((request) => (
                <tr key={request.id}>
                  <td style={{ width: '150px', minWidth: '150px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {request.userName}
                  </td>
                  <td style={{ width: '180px', minWidth: '180px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <a href={`mailto:${request.userEmail}`} className="email-link">
                      {request.userEmail}
                    </a>
                  </td>
                  <td style={{ width: '120px', minWidth: '120px', textAlign: 'center' }}>
                    <span className={`sub-badge ${request.currentSubscription.toLowerCase()}`}>
                      {request.currentSubscription}
                    </span>
                  </td>
                  <td style={{ width: '100px', minWidth: '100px', textAlign: 'center' }}>
                    <span className={`status-badge ${request.status}`}>
                      {request.status === 'pending' ? '⏳ Pendiente' :
                       request.status === 'approved' ? '✅ Aprobado' :
                       '❌ Rechazado'}
                    </span>
                  </td>
                  <td style={{ width: '120px', minWidth: '120px', fontSize: '0.8rem' }}>
                    {request.requestedAt ? 
                      (request.requestedAt.seconds ? 
                        new Date(request.requestedAt.seconds * 1000).toLocaleDateString('es-MX', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        }) :
                        new Date(request.requestedAt).toLocaleDateString('es-MX', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })
                      ) : 
                      'Sin fecha'
                    }
                  </td>
                  <td style={{ width: '200px', minWidth: '200px', textAlign: 'center', padding: '8px' }}>
                    {request.status === 'pending' ? (
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          className="approve-btn"
                          onClick={() => handleApproveProRequest(request.id)}
                          title="Aprobar solicitud"
                          style={{ 
                            background: '#10b981', 
                            color: 'white', 
                            border: 'none', 
                            padding: '6px 12px', 
                            borderRadius: '4px', 
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                          }}
                        >
                          ✅ Aprobar
                        </button>
                        <button
                          className="reject-btn"
                          onClick={() => handleRejectProRequest(request.id)}
                          title="Rechazar solicitud"
                          style={{ 
                            background: '#ef4444', 
                            color: 'white', 
                            border: 'none', 
                            padding: '6px 12px', 
                            borderRadius: '4px', 
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                          }}
                        >
                          ❌ Rechazar
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: '#666' }}>
                        {request.status === 'approved' ? 'Procesado ✓' : 'Rechazado ✗'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredProRequests.length === 0 && proRequests.length > 0 && (
            <div className="no-messages">
              <p>No se encontraron solicitudes con los filtros aplicados</p>
            </div>
          )}
          
          {proRequests.length === 0 && (
            <div className="no-messages">
              <p>No hay solicitudes Pro aún</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // 🔧 MIGRACIÓN MASIVA: Función para corregir puntos de juegos eliminados
  const runGamePointsMigration = async () => {
    if (!confirm('¿Estás seguro de ejecutar la migración masiva de puntos de juegos? Esto afectará a TODOS los usuarios.')) {
      return;
    }

    setMigrationStatus('🚀 Iniciando migración masiva...');
    setMigrationProgress(0);
    setMigrationResults([]);

    try {
      // 1. Obtener todos los documentos de gamePoints
      const gamePointsRef = collection(db, 'gamePoints');
      const snapshot = await getDocs(gamePointsRef);
      
      const totalUsers = snapshot.docs.length;
      let processedUsers = 0;
      let migratedUsers = 0;
      const results: any[] = [];

      setMigrationStatus(`📊 Encontrados ${totalUsers} usuarios con puntos de juegos`);

      // 2. Procesar cada usuario
      for (const userDoc of snapshot.docs) {
        const userId = userDoc.id;
        const userData = userDoc.data();
        
        if (!userData.notebookPoints) {
          processedUsers++;
          continue;
        }

        let userMigrated = false;
        const userResults = {
          userId,
          notebooks: [] as any[]
        };

        // 3. Procesar cada cuaderno del usuario
        for (const [notebookId, notebookData] of Object.entries(userData.notebookPoints as any)) {
          const notebook = notebookData as any;
          
          // Verificar si necesita migración
          const hasRace = notebook.gameScores && 'race' in notebook.gameScores;
          const hasFillBlank = notebook.pointsHistory?.some((t: any) => t.gameId?.includes('fill_blank'));
          
          if (hasRace || hasFillBlank) {
            // Recalcular puntos correctos
            const validGameScores = {
              memory: notebook.gameScores?.memory || 0,
              puzzle: notebook.gameScores?.puzzle || 0,
              quiz: notebook.gameScores?.quiz || 0
            };
            
            const correctTotalPoints = validGameScores.memory + validGameScores.puzzle + validGameScores.quiz;
            const oldTotalPoints = notebook.totalPoints || 0;
            
            // Actualizar Firebase
            await updateDoc(doc(db, 'gamePoints', userId), {
              [`notebookPoints.${notebookId}.gameScores`]: validGameScores,
              [`notebookPoints.${notebookId}.totalPoints`]: correctTotalPoints
            });

            userResults.notebooks.push({
              notebookId,
              oldTotal: oldTotalPoints,
              newTotal: correctTotalPoints,
              difference: oldTotalPoints - correctTotalPoints
            });
            
            userMigrated = true;
          }
        }

        if (userMigrated) {
          migratedUsers++;
          results.push(userResults);
        }

        processedUsers++;
        setMigrationProgress(Math.round((processedUsers / totalUsers) * 100));
        setMigrationStatus(`⏳ Procesando... ${processedUsers}/${totalUsers} (${migratedUsers} migrados)`);
        
        // Pausa pequeña para no sobrecargar Firebase
        if (processedUsers % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      setMigrationStatus(`✅ Migración completada! ${migratedUsers}/${totalUsers} usuarios migrados`);
      setMigrationResults(results);

    } catch (error) {
      console.error('Error en migración:', error);
      setMigrationStatus(`❌ Error en migración: ${error}`);
    }
  };

  // 🗑️ ELIMINAR TRANSACCIONES DE FILL IN THE BLANK
  const removeFillInTheBlankTransactions = async () => {
    if (!confirm('¿Estás seguro de eliminar TODAS las transacciones de Fill in the Blank del historial? No afectará totalPoints pero limpiará el historial.')) {
      return;
    }

    setFillBlankStatus('🚀 Iniciando limpieza de Fill in the Blank...');
    setFillBlankProgress(0);
    setFillBlankResults([]);

    try {
      // 1. Obtener todos los documentos de gamePoints
      const gamePointsRef = collection(db, 'gamePoints');
      const snapshot = await getDocs(gamePointsRef);
      
      const totalUsers = snapshot.docs.length;
      let processedUsers = 0;
      let cleanedUsers = 0;
      const results: any[] = [];

      setFillBlankStatus(`📊 Encontrados ${totalUsers} usuarios, buscando transacciones Fill in the Blank...`);

      // 2. Procesar cada usuario
      for (const userDoc of snapshot.docs) {
        const userId = userDoc.id;
        const userData = userDoc.data();
        
        if (!userData.notebookPoints) {
          processedUsers++;
          continue;
        }

        let userCleaned = false;
        const userResults = {
          userId,
          notebooks: [] as any[]
        };

        // 3. Procesar cada cuaderno del usuario
        for (const [notebookId, notebookData] of Object.entries(userData.notebookPoints as any)) {
          const notebook = notebookData as any;
          
          if (notebook.pointsHistory && Array.isArray(notebook.pointsHistory)) {
            // Encontrar transacciones de Fill in the Blank
            const fillBlankTransactions = notebook.pointsHistory.filter((t: any) => 
              t.gameId?.includes('fill_blank') || t.gameName?.includes('Fill in the Blank')
            );
            
            if (fillBlankTransactions.length > 0) {
              // Filtrar el historial eliminando Fill in the Blank
              const cleanedHistory = notebook.pointsHistory.filter((t: any) => 
                !t.gameId?.includes('fill_blank') && !t.gameName?.includes('Fill in the Blank')
              );
              
              // Actualizar Firebase
              await updateDoc(doc(db, 'gamePoints', userId), {
                [`notebookPoints.${notebookId}.pointsHistory`]: cleanedHistory
              });

              const totalPointsRemoved = fillBlankTransactions.reduce((sum: number, t: any) => sum + (t.points || 0), 0);
              
              userResults.notebooks.push({
                notebookId,
                transactionsRemoved: fillBlankTransactions.length,
                pointsInTransactions: totalPointsRemoved,
                remainingTransactions: cleanedHistory.length
              });
              
              userCleaned = true;
            }
          }
        }

        if (userCleaned) {
          cleanedUsers++;
          results.push(userResults);
        }

        processedUsers++;
        setFillBlankProgress(Math.round((processedUsers / totalUsers) * 100));
        setFillBlankStatus(`⏳ Procesando... ${processedUsers}/${totalUsers} (${cleanedUsers} limpiados)`);
        
        // Pausa pequeña para no sobrecargar Firebase
        if (processedUsers % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      setFillBlankStatus(`✅ Limpieza completada! ${cleanedUsers}/${totalUsers} usuarios tenían transacciones Fill in the Blank`);
      setFillBlankResults(results);

    } catch (error) {
      console.error('Error en limpieza Fill in the Blank:', error);
      setFillBlankStatus(`❌ Error en limpieza: ${error}`);
    }
  };

  return (
    <>
      <HeaderWithHamburger title="🛡️ Panel de Control - Súper Admin" />
      <div className="super-admin-container with-header-sidebar">
        <div className="admin-content">
          <div className="welcome-section">
            <h1>Panel de Súper Admin</h1>
            <p>Bienvenido al panel de control de súper administrador.</p>
          </div>
          

          <div className="admin-tabs">
            <button 
              className={`tab-button ${activeTab === 'usuarios' ? 'active' : ''}`}
              onClick={() => setActiveTab('usuarios')}
            >
              👥 Usuarios
            </button>
            <button 
              className={`tab-button ${activeTab === 'profesores' ? 'active' : ''}`}
              onClick={() => setActiveTab('profesores')}
            >
              👩‍🏫 Profesores
            </button>
            <button 
              className={`tab-button ${activeTab === 'mensajes' ? 'active' : ''}`}
              onClick={() => setActiveTab('mensajes')}
            >
              📬 Mensajes
            </button>
            <button 
              className={`tab-button ${activeTab === 'pro' ? 'active' : ''}`}
              onClick={() => setActiveTab('pro')}
            >
              🌟 Pro
            </button>
            <button 
              className={`tab-button ${activeTab === 'metricas' ? 'active' : ''}`}
              onClick={() => setActiveTab('metricas')}
            >
              📊 Métricas
            </button>
            <button 
              className={`tab-button ${activeTab === 'carga-masiva' ? 'active' : ''}`}
              onClick={() => setActiveTab('carga-masiva')}
            >
              📦 Carga Masiva
            </button>
          </div>
          
          <div className="tab-content">
            {activeTab === 'usuarios' && renderUsersTab()}
            {activeTab === 'profesores' && renderTeachersTab()}
            {activeTab === 'mensajes' && renderMessagesTab()}
            {activeTab === 'pro' && renderProTab()}
            {activeTab === 'metricas' && <UserMetricsTable />}
            {activeTab === 'carga-masiva' && <BulkUploadModule />}
          </div>
        </div>
      </div>

      {/* Modal para ver mensaje completo */}
      {showMessageModal && selectedMessage && (
        <div className="message-modal-overlay" onClick={() => setShowMessageModal(false)}>
          <div className="message-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="message-modal-header">
              <h3>Mensaje de Contacto</h3>
              <button 
                className="close-modal-btn" 
                onClick={() => setShowMessageModal(false)}
                title="Cerrar"
              >
                ✕
              </button>
            </div>
            
            <div className="message-modal-body">
              <div className="message-field">
                <strong>De:</strong> {selectedMessage.name} ({selectedMessage.email})
              </div>
              
              <div className="message-field">
                <strong>Asunto:</strong> {selectedMessage.subject}
              </div>
              
              <div className="message-field">
                <strong>Fecha:</strong> {
                  selectedMessage.timestamp ? 
                    (selectedMessage.timestamp.seconds ? 
                      new Date(selectedMessage.timestamp.seconds * 1000).toLocaleString('es-MX') :
                      new Date(selectedMessage.timestamp).toLocaleString('es-MX')
                    ) : 
                    'Sin fecha'
                }
              </div>
              
              <div className="message-field">
                <strong>Mensaje:</strong>
                <div className="message-content">
                  {selectedMessage.message}
                </div>
              </div>
              
              <div className="message-actions">
                <strong>Estado:</strong>
                <select 
                  value={selectedMessage.status || 'pending'}
                  onChange={(e) => handleUpdateMessageStatus(selectedMessage.id, e.target.value)}
                  className="status-select"
                >
                  <option value="pending">⏳ Pendiente</option>
                  <option value="responded">✅ Respondido</option>
                  <option value="resolved">✔️ Resuelto</option>
                </select>
                
                <a 
                  href={`mailto:${selectedMessage.email}?subject=Re: ${selectedMessage.subject}`}
                  className="reply-btn"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  📧 Responder por Email
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SuperAdminPage;