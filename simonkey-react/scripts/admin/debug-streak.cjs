const admin = require('firebase-admin');
const path = require('path');

// Cargar credenciales
const serviceAccount = require(path.join(__dirname, '../../serviceAccountKey.json'));

// Inicializar Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const { getFirestore } = require('firebase-admin/firestore');
const db = getFirestore();

async function debugUserStreak(userEmail) {
  console.log(`\n=== Debug de Racha para ${userEmail} ===\n`);
  
  try {
    // 1. Buscar el usuario
    const usersSnapshot = await db.collection('users')
      .where('email', '==', userEmail)
      .limit(1)
      .get();
    
    if (usersSnapshot.empty) {
      console.log('❌ Usuario no encontrado');
      return;
    }
    
    const userDoc = usersSnapshot.docs[0];
    const userId = userDoc.id;
    const userData = userDoc.data();
    
    console.log('👤 Usuario encontrado:');
    console.log(`   ID: ${userId}`);
    console.log(`   Email: ${userData.email}`);
    console.log(`   Racha: ${userData.streak || 0} días`);
    console.log(`   Última fecha de estudio: ${userData.lastStudyDate?.toDate() || 'Nunca'}`);
    
    // 2. Obtener fechas importantes
    const today = new Date();
    const startOfWeek = new Date(today);
    const currentDay = today.getDay();
    const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
    startOfWeek.setDate(today.getDate() - daysFromMonday);
    startOfWeek.setHours(0, 0, 0, 0);
    
    console.log(`\n📅 Información de fechas:`);
    console.log(`   Hoy: ${today.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
    console.log(`   Inicio de semana (Lunes): ${startOfWeek.toLocaleDateString('es-ES')}`);
    
    // 3. Verificar actividades de esta semana
    console.log('\n📊 Actividades de esta semana:');
    
    // Mapeo de días
    const dayMapping = {
      1: 'Lunes',
      2: 'Martes',
      3: 'Miércoles',
      4: 'Jueves',
      5: 'Viernes',
      6: 'Sábado',
      0: 'Domingo'
    };
    
    const studyDays = new Set();
    
    // Buscar sesiones de estudio
    const studySessions = await db.collection('studySessions')
      .where('userId', '==', userId)
      .where('startTime', '>=', startOfWeek)
      .get();
    
    console.log(`\n   📚 Sesiones de estudio: ${studySessions.size}`);
    studySessions.forEach(doc => {
      const data = doc.data();
      const date = data.startTime.toDate();
      const dayOfWeek = date.getDay();
      const duration = data.metrics?.sessionDuration || 0;
      studyDays.add(dayOfWeek);
      console.log(`      - ${dayMapping[dayOfWeek]}: ${duration}s de estudio`);
    });
    
    // Buscar sesiones de juegos
    const gameSessions = await db.collection('gameSessions')
      .where('userId', '==', userId)
      .where('timestamp', '>=', startOfWeek)
      .get();
    
    console.log(`\n   🎮 Sesiones de juego: ${gameSessions.size}`);
    gameSessions.forEach(doc => {
      const data = doc.data();
      const date = data.timestamp.toDate();
      const dayOfWeek = date.getDay();
      studyDays.add(dayOfWeek);
      console.log(`      - ${dayMapping[dayOfWeek]}: ${data.gameType || 'Juego'} (${data.duration || 0}s)`);
    });
    
    // Buscar quizzes
    const quizResults = await db.collection(`users/${userId}/quizResults`)
      .where('timestamp', '>=', startOfWeek)
      .get();
    
    console.log(`\n   📝 Quizzes completados: ${quizResults.size}`);
    quizResults.forEach(doc => {
      const data = doc.data();
      const date = data.timestamp.toDate();
      const dayOfWeek = date.getDay();
      studyDays.add(dayOfWeek);
      console.log(`      - ${dayMapping[dayOfWeek]}: Quiz completado`);
    });
    
    // Buscar mini quizzes
    const miniQuizResults = await db.collection(`users/${userId}/miniQuizResults`)
      .where('timestamp', '>=', startOfWeek)
      .get();
    
    console.log(`\n   🎯 Mini quizzes: ${miniQuizResults.size}`);
    miniQuizResults.forEach(doc => {
      const data = doc.data();
      const date = data.timestamp.toDate();
      const dayOfWeek = date.getDay();
      studyDays.add(dayOfWeek);
      console.log(`      - ${dayMapping[dayOfWeek]}: Mini quiz completado`);
    });
    
    // 4. Resumen de días con actividad
    console.log('\n🔥 Días con actividad esta semana:');
    const weekDaysOrder = [1, 2, 3, 4, 5, 6, 0]; // L-D
    weekDaysOrder.forEach(day => {
      const hasActivity = studyDays.has(day);
      console.log(`   ${dayMapping[day]}: ${hasActivity ? '🔥 SÍ' : '❌ NO'}`);
    });
    
    console.log(`\n📊 Total de días con actividad: ${studyDays.size}`);
    console.log(`🔥 Racha actual guardada: ${userData.streak || 0} días`);
    
    // 5. Verificar si hay inconsistencias
    if (studyDays.size > 0 && (!userData.streak || userData.streak === 0)) {
      console.log('\n⚠️  INCONSISTENCIA: Hay actividad pero la racha muestra 0');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Ejecutar con el email del usuario
const userEmail = process.argv[2] || 'ruben.elhore@gmail.com';
debugUserStreak(userEmail).then(() => {
  console.log('\n✅ Debug completado');
  process.exit(0);
}).catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});