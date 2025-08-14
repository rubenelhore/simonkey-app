/**
 * Script de pruebas para validar las reglas de Firestore
 * Ejecutar con: node test-firestore-rules.js
 */

const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const fs = require('fs');
const path = require('path');

// Configuración del proyecto
const PROJECT_ID = 'simonkey-test';
const RULES_FILE = './firestore.rules.optimized';

// Datos de prueba
const testUsers = {
  superAdmin: {
    uid: 'super-admin-123',
    email: 'ruben.elhore@gmail.com',
    data: {
      subscription: 'super_admin',
      notebookCount: 10
    }
  },
  freeUser: {
    uid: 'free-user-123',
    email: 'free@test.com',
    data: {
      subscription: 'free',
      notebookCount: 2
    }
  },
  proUser: {
    uid: 'pro-user-123',
    email: 'pro@test.com',
    data: {
      subscription: 'pro',
      notebookCount: 5,
      notebooksCreatedThisWeek: 3
    }
  },
  schoolTeacher: {
    uid: 'teacher-123',
    email: 'teacher@school.com',
    data: {
      subscription: 'school',
      schoolRole: 'teacher',
      idInstitucion: 'school-001'
    }
  },
  schoolStudent: {
    uid: 'student-123',
    email: 'student@school.com',
    data: {
      subscription: 'school',
      schoolRole: 'student',
      idInstitucion: 'school-001',
      idCuadernos: ['notebook-school-001']
    }
  },
  schoolAdmin: {
    uid: 'school-admin-123',
    email: 'admin@school.com',
    data: {
      subscription: 'school',
      schoolRole: 'admin',
      idInstitucion: 'school-001'
    }
  }
};

// Tests organizados por colección
const tests = {
  users: [
    {
      name: 'Usuario puede leer su propio perfil',
      test: async (testEnv) => {
        const db = testEnv.authenticatedContext(testUsers.freeUser.uid).firestore();
        await assertSucceeds(db.collection('users').doc(testUsers.freeUser.uid).get());
      }
    },
    {
      name: 'Usuario no puede leer perfil de otro usuario',
      test: async (testEnv) => {
        const db = testEnv.authenticatedContext(testUsers.freeUser.uid).firestore();
        await assertFails(db.collection('users').doc(testUsers.proUser.uid).get());
      }
    },
    {
      name: 'Super admin puede leer cualquier perfil',
      test: async (testEnv) => {
        const db = testEnv.authenticatedContext(testUsers.superAdmin.uid).firestore();
        await assertSucceeds(db.collection('users').doc(testUsers.freeUser.uid).get());
      }
    },
    {
      name: 'Usuario puede crear su propio perfil',
      test: async (testEnv) => {
        const db = testEnv.authenticatedContext('new-user-123').firestore();
        await assertSucceeds(
          db.collection('users').doc('new-user-123').set({
            email: 'new@test.com',
            username: 'newuser',
            nombre: 'New User',
            displayName: 'New User',
            birthdate: '2000-01-01',
            subscription: 'free',
            notebookCount: 0
          })
        );
      }
    },
    {
      name: 'Usuario no puede cambiar su suscripción',
      test: async (testEnv) => {
        const db = testEnv.authenticatedContext(testUsers.freeUser.uid).firestore();
        await assertFails(
          db.collection('users').doc(testUsers.freeUser.uid).update({
            subscription: 'pro'
          })
        );
      }
    }
  ],
  
  notebooks: [
    {
      name: 'Usuario FREE puede crear notebook si tiene menos de 4',
      test: async (testEnv) => {
        const db = testEnv.authenticatedContext(testUsers.freeUser.uid).firestore();
        await assertSucceeds(
          db.collection('notebooks').add({
            title: 'Mi Cuaderno',
            color: '#FF0000',
            type: 'personal',
            userId: testUsers.freeUser.uid,
            conceptCount: 0
          })
        );
      }
    },
    {
      name: 'Profesor puede crear notebook escolar',
      test: async (testEnv) => {
        const db = testEnv.authenticatedContext(testUsers.schoolTeacher.uid).firestore();
        await assertSucceeds(
          db.collection('notebooks').add({
            title: 'Matemáticas',
            color: '#0000FF',
            type: 'school',
            idMateria: 'mat-001',
            idProfesor: testUsers.schoolTeacher.uid,
            idEscuela: 'school-001'
          })
        );
      }
    },
    {
      name: 'Estudiante no puede crear notebook escolar',
      test: async (testEnv) => {
        const db = testEnv.authenticatedContext(testUsers.schoolStudent.uid).firestore();
        await assertFails(
          db.collection('notebooks').add({
            title: 'Intento de Notebook',
            color: '#00FF00',
            type: 'school',
            idMateria: 'mat-002',
            idProfesor: testUsers.schoolStudent.uid
          })
        );
      }
    },
    {
      name: 'Usuario no puede cambiar tipo de notebook',
      test: async (testEnv) => {
        const db = testEnv.authenticatedContext(testUsers.freeUser.uid).firestore();
        await assertFails(
          db.collection('notebooks').doc('notebook-001').update({
            type: 'school'
          })
        );
      }
    }
  ],
  
  studySessions: [
    {
      name: 'Usuario puede crear sesión de estudio',
      test: async (testEnv) => {
        const db = testEnv.authenticatedContext(testUsers.freeUser.uid).firestore();
        await assertSucceeds(
          db.collection('studySessions').add({
            userId: testUsers.freeUser.uid,
            notebookId: 'notebook-001',
            startTime: new Date(),
            mode: 'smart',
            completed: false
          })
        );
      }
    },
    {
      name: 'Sesiones de estudio son inmutables después de completarse',
      test: async (testEnv) => {
        const db = testEnv.authenticatedContext(testUsers.freeUser.uid).firestore();
        // Intentar actualizar una sesión ya completada
        await assertFails(
          db.collection('studySessions').doc('session-completed').update({
            score: 100
          })
        );
      }
    },
    {
      name: 'Profesor puede ver sesiones de sus estudiantes',
      test: async (testEnv) => {
        const db = testEnv.authenticatedContext(testUsers.schoolTeacher.uid).firestore();
        await assertSucceeds(
          db.collection('studySessions')
            .where('userId', '==', testUsers.schoolStudent.uid)
            .get()
        );
      }
    }
  ],
  
  schoolExams: [
    {
      name: 'Profesor puede crear examen',
      test: async (testEnv) => {
        const db = testEnv.authenticatedContext(testUsers.schoolTeacher.uid).firestore();
        await assertSucceeds(
          db.collection('schoolExams').add({
            title: 'Examen Parcial',
            idMateria: 'mat-001',
            idProfesor: testUsers.schoolTeacher.uid,
            idEscuela: 'school-001',
            questions: [],
            duration: 60,
            isActive: true
          })
        );
      }
    },
    {
      name: 'Estudiante no puede crear examen',
      test: async (testEnv) => {
        const db = testEnv.authenticatedContext(testUsers.schoolStudent.uid).firestore();
        await assertFails(
          db.collection('schoolExams').add({
            title: 'Examen Falso',
            idMateria: 'mat-001',
            idProfesor: testUsers.schoolStudent.uid,
            idEscuela: 'school-001',
            questions: [],
            duration: 60
          })
        );
      }
    },
    {
      name: 'Admin escolar puede eliminar examen',
      test: async (testEnv) => {
        const db = testEnv.authenticatedContext(testUsers.schoolAdmin.uid).firestore();
        await assertSucceeds(
          db.collection('schoolExams').doc('exam-001').delete()
        );
      }
    }
  ],
  
  examAttempts: [
    {
      name: 'Estudiante puede crear intento de examen activo',
      test: async (testEnv) => {
        const db = testEnv.authenticatedContext(testUsers.schoolStudent.uid).firestore();
        await assertSucceeds(
          db.collection('examAttempts').add({
            examId: 'exam-active',
            studentId: testUsers.schoolStudent.uid,
            startTime: new Date(),
            completed: false
          })
        );
      }
    },
    {
      name: 'Estudiante no puede crear intento para examen de otro',
      test: async (testEnv) => {
        const db = testEnv.authenticatedContext(testUsers.schoolStudent.uid).firestore();
        await assertFails(
          db.collection('examAttempts').add({
            examId: 'exam-001',
            studentId: 'otro-estudiante',
            startTime: new Date()
          })
        );
      }
    }
  ]
};

// Función principal de pruebas
async function runTests() {
  console.log('🚀 Iniciando pruebas de reglas de Firestore...\n');
  
  // Leer reglas desde archivo
  const rules = fs.readFileSync(path.resolve(__dirname, RULES_FILE), 'utf8');
  
  // Inicializar entorno de pruebas
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host: 'localhost',
      port: 8080
    }
  });
  
  // Configurar datos iniciales
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    
    // Crear usuarios
    for (const [key, user] of Object.entries(testUsers)) {
      await db.collection('users').doc(user.uid).set(user.data);
    }
    
    // Crear algunos documentos de prueba
    await db.collection('notebooks').doc('notebook-001').set({
      type: 'personal',
      userId: testUsers.freeUser.uid,
      title: 'Notebook Existente'
    });
    
    await db.collection('notebooks').doc('notebook-school-001').set({
      type: 'school',
      idEscuela: 'school-001',
      idProfesor: testUsers.schoolTeacher.uid
    });
    
    await db.collection('studySessions').doc('session-completed').set({
      userId: testUsers.freeUser.uid,
      completed: true
    });
    
    await db.collection('schoolExams').doc('exam-active').set({
      isActive: true,
      idEscuela: 'school-001'
    });
    
    await db.collection('schoolExams').doc('exam-001').set({
      idEscuela: 'school-001',
      idProfesor: testUsers.schoolTeacher.uid
    });
  });
  
  // Ejecutar pruebas
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  
  for (const [collection, collectionTests] of Object.entries(tests)) {
    console.log(`\n📁 Colección: ${collection}`);
    console.log('─'.repeat(50));
    
    for (const test of collectionTests) {
      totalTests++;
      try {
        await test.test(testEnv);
        console.log(`✅ ${test.name}`);
        passedTests++;
      } catch (error) {
        console.log(`❌ ${test.name}`);
        console.log(`   Error: ${error.message}`);
        failedTests++;
      }
    }
  }
  
  // Limpiar
  await testEnv.cleanup();
  
  // Resumen
  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMEN DE PRUEBAS');
  console.log('='.repeat(50));
  console.log(`Total de pruebas: ${totalTests}`);
  console.log(`✅ Exitosas: ${passedTests}`);
  console.log(`❌ Fallidas: ${failedTests}`);
  console.log(`📈 Porcentaje de éxito: ${((passedTests/totalTests)*100).toFixed(2)}%`);
  
  if (failedTests === 0) {
    console.log('\n🎉 ¡Todas las pruebas pasaron exitosamente!');
  } else {
    console.log('\n⚠️  Algunas pruebas fallaron. Revisa las reglas.');
    process.exit(1);
  }
}

// Ejecutar pruebas
runTests().catch(console.error);