import { initializeApp } from 'firebase/app';
import { 
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  collection, 
  doc, 
  setDoc, 
  getDoc,
  serverTimestamp 
} from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC26QZw7297E_YOoF5OqR2Ck6x_bw5_Hic",
  authDomain: "simonkey-5c78f.firebaseapp.com",
  projectId: "simonkey-5c78f",
  storageBucket: "simonkey-5c78f.firebasestorage.app",
  messagingSenderId: "235501879490",
  appId: "1:235501879490:web:05fea6dae9c63b2a827b5b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with the correct database name
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentSingleTabManager({})
  }),
  databaseId: 'simonkey-general'  // Specify the correct database name
});

// User subscription types
const UserSubscriptionType = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  FREE: 'FREE',
  PRO: 'PRO',
  SCHOOL: 'SCHOOL'
};

// School roles
const SchoolRole = {
  ADMIN: 'ADMIN',
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
  TUTOR: 'TUTOR'
};

/**
 * Initialize the Firebase database with necessary collections and initial data
 */
async function initializeFirebaseDB() {
  console.log('🚀 Inicializando base de datos de Firebase...');
  
  try {
    // 1. Create super admin user
    console.log('👑 Creando usuario super admin...');
    const superAdminId = 'dTjO1PRNgRgvmOYItXhHseqpOY72'; // Your Google Auth UID
    const superAdminData = {
      id: superAdminId,
      email: 'ruben.elhore@gmail.com',
      username: 'ruben.elhore',
      nombre: 'Ruben Elhore',
      displayName: 'Ruben Elhore',
      birthdate: '1990-01-01', // Update with your actual birthdate
      createdAt: serverTimestamp(),
      subscription: UserSubscriptionType.SUPER_ADMIN,
      notebookCount: 0,
      maxNotebooks: -1, // Unlimited
      maxConceptsPerNotebook: -1, // Unlimited
      notebooksCreatedThisWeek: 0,
      conceptsCreatedThisWeek: 0,
      weekStartDate: serverTimestamp(),
      emailVerified: true,
      isActive: true,
      lastLogin: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(doc(db, 'users', superAdminId), superAdminData);
    console.log('✅ Usuario super admin creado exitosamente');

    // 2. Create system settings collection
    console.log('⚙️ Creando configuración del sistema...');
    const systemSettings = {
      appVersion: '1.0.0',
      maintenanceMode: false,
      registrationEnabled: true,
      emailVerificationRequired: true,
      maxLoginAttempts: 5,
      sessionTimeout: 3600, // 1 hour in seconds
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(doc(db, 'systemSettings', 'app'), systemSettings);
    console.log('✅ Configuración del sistema creada');

    // 3. Create subscription limits collection
    console.log('📊 Creando límites de suscripción...');
    const subscriptionLimits = {
      [UserSubscriptionType.SUPER_ADMIN]: {
        maxNotebooks: -1,
        maxConceptsPerNotebook: -1,
        canDeleteAndRecreate: true,
        permissions: {
          canViewAllData: true,
          canEditAllData: true,
          canUseStudySection: true,
          canManageUsers: true,
        }
      },
      [UserSubscriptionType.FREE]: {
        maxNotebooks: 4,
        maxConceptsPerNotebook: 100,
        canDeleteAndRecreate: false,
        permissions: {
          canViewAllData: false,
          canEditAllData: false,
          canUseStudySection: true,
          canManageUsers: false,
        }
      },
      [UserSubscriptionType.PRO]: {
        maxNotebooks: -1,
        maxConceptsPerNotebook: 100,
        maxNotebooksPerWeek: 10,
        maxConceptsPerWeek: 100,
        canDeleteAndRecreate: true,
        permissions: {
          canViewAllData: false,
          canEditAllData: false,
          canUseStudySection: true,
          canManageUsers: false,
        }
      },
      [UserSubscriptionType.SCHOOL]: {
        maxNotebooks: -1,
        maxConceptsPerNotebook: -1,
        canDeleteAndRecreate: true,
        permissions: {
          canViewAllData: false,
          canEditAllData: false,
          canUseStudySection: true,
          canManageUsers: false,
        }
      }
    };

    await setDoc(doc(db, 'subscriptionLimits', 'default'), subscriptionLimits);
    console.log('✅ Límites de suscripción creados');

    // 4. Create school role permissions
    console.log('🎓 Creando permisos de roles escolares...');
    const schoolRolePermissions = {
      [SchoolRole.ADMIN]: {
        canViewAllData: true,
        canEditAllData: false,
        canUseStudySection: true,
        canManageUsers: false,
      },
      [SchoolRole.TEACHER]: {
        canViewAllData: false,
        canEditAllData: true,
        canUseStudySection: true,
        canManageUsers: false,
      },
      [SchoolRole.STUDENT]: {
        canViewAllData: false,
        canEditAllData: false,
        canUseStudySection: true,
        canManageUsers: false,
      },
      [SchoolRole.TUTOR]: {
        canViewAllData: false,
        canEditAllData: false,
        canUseStudySection: true,
        canManageUsers: false,
      }
    };

    await setDoc(doc(db, 'schoolRolePermissions', 'default'), schoolRolePermissions);
    console.log('✅ Permisos de roles escolares creados');

    // 5. Create initial collections structure
    console.log('📁 Creando estructura de colecciones...');
    const collections = [
      'notebooks',
      'conceptos', 
      'studySessions',
      'userActivities',
      'reviewConcepts',
      'conceptStats',
      'schoolStudents',
      'schoolTeachers',
      'schools',
      'userDeletions',
      'systemLogs'
    ];

    for (const collectionName of collections) {
      // Create a placeholder document to ensure collection exists
      const placeholderDoc = {
        _placeholder: true,
        createdAt: serverTimestamp(),
        description: `Placeholder document for ${collectionName} collection`
      };
      
      await setDoc(doc(db, collectionName, '_placeholder'), placeholderDoc);
      console.log(`✅ Colección ${collectionName} inicializada`);
    }

    // 6. Create Firestore security rules placeholder
    console.log('🔒 Creando reglas de seguridad...');
    const securityRules = {
      version: '1.0.0',
      rules: {
        users: {
          read: 'request.auth != null && (request.auth.uid == resource.data.id || resource.data.subscription == "SUPER_ADMIN")',
          write: 'request.auth != null && request.auth.uid == resource.data.id'
        },
        notebooks: {
          read: 'request.auth != null && resource.data.userId == request.auth.uid',
          write: 'request.auth != null && resource.data.userId == request.auth.uid'
        },
        conceptos: {
          read: 'request.auth != null && resource.data.userId == request.auth.uid',
          write: 'request.auth != null && resource.data.userId == request.auth.uid'
        }
      },
      createdAt: serverTimestamp()
    };

    await setDoc(doc(db, 'securityRules', 'firestore'), securityRules);
    console.log('✅ Reglas de seguridad creadas');

    console.log('🎉 ¡Base de datos inicializada exitosamente!');
    console.log('📋 Resumen:');
    console.log('  - Usuario super admin creado');
    console.log('  - Configuración del sistema establecida');
    console.log('  - Límites de suscripción configurados');
    console.log('  - Permisos de roles escolares definidos');
    console.log('  - Estructura de colecciones creada');
    console.log('  - Reglas de seguridad establecidas');

  } catch (error) {
    console.error('❌ Error inicializando la base de datos:', error);
    throw error;
  }
}

/**
 * Verify the database initialization
 */
async function verifyDatabase() {
  console.log('🔍 Verificando inicialización de la base de datos...');
  
  try {
    // Check super admin user
    const superAdminDoc = await getDoc(doc(db, 'users', 'dTjO1PRNgRgvmOYItXhHseqpOY72'));
    if (superAdminDoc.exists()) {
      console.log('✅ Usuario super admin verificado');
    } else {
      console.log('❌ Usuario super admin no encontrado');
    }

    // Check system settings
    const systemSettingsDoc = await getDoc(doc(db, 'systemSettings', 'app'));
    if (systemSettingsDoc.exists()) {
      console.log('✅ Configuración del sistema verificada');
    } else {
      console.log('❌ Configuración del sistema no encontrada');
    }

    // Check subscription limits
    const subscriptionLimitsDoc = await getDoc(doc(db, 'subscriptionLimits', 'default'));
    if (subscriptionLimitsDoc.exists()) {
      console.log('✅ Límites de suscripción verificados');
    } else {
      console.log('❌ Límites de suscripción no encontrados');
    }

    console.log('🎯 Verificación completada');

  } catch (error) {
    console.error('❌ Error verificando la base de datos:', error);
  }
}

// Run the initialization
initializeFirebaseDB()
  .then(() => verifyDatabase())
  .then(() => {
    console.log('✨ Proceso completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error en el proceso:', error);
    process.exit(1);
  }); 