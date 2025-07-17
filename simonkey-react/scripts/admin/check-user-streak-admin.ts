import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Inicializar Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, 'simonkey-react-firebase-adminsdk.json'), 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://simonkey-react-default-rtdb.firebaseio.com"
});

const db = admin.firestore();
const userId = 'dTjO1PRNgRgvmOYItXhHseqpOY72';

async function checkUserStreak() {
  console.log('=== Verificando datos de racha para usuario:', userId, '===\n');

  // 1. Verificar datos de racha actuales
  console.log('1. DATOS DE RACHA ACTUAL:');
  const streakRef = db.collection('users').doc(userId).collection('stats').doc('studyStreak');
  const streakDoc = await streakRef.get();
  
  if (streakDoc.exists) {
    const streakData = streakDoc.data()!;
    console.log('- Racha consecutiva:', streakData.currentStreak);
    console.log('- Última fecha de estudio:', streakData.lastStudyDate?.toDate());
    console.log('- Historial de estudio:', streakData.studyHistory?.map((ts: any) => ts.toDate()));
  } else {
    console.log('- No hay datos de racha');
  }

  // 2. Verificar sesiones de esta semana
  console.log('\n2. SESIONES DE ESTA SEMANA:');
  
  const today = new Date();
  const startOfWeek = new Date(today);
  const currentDay = today.getDay();
  const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
  startOfWeek.setDate(today.getDate() - daysFromMonday);
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  console.log('- Inicio de semana:', startOfWeek.toISOString());
  console.log('- Fin de semana:', endOfWeek.toISOString());
  console.log('- Hoy:', today.toISOString());

  // Verificar sesiones de estudio
  console.log('\n3. SESIONES DE ESTUDIO:');
  const studySessionsSnap = await db.collection('studySessions')
    .where('userId', '==', userId)
    .where('startTime', '>=', startOfWeek)
    .where('startTime', '<', endOfWeek)
    .get();

  console.log('- Total sesiones encontradas:', studySessionsSnap.size);
  
  studySessionsSnap.forEach(doc => {
    const session = doc.data();
    const date = session.startTime?.toDate();
    const duration = session.metrics?.sessionDuration || 0;
    console.log(`  * ${date?.toLocaleDateString()} ${date?.toLocaleTimeString()} - Duración: ${duration}s - ID: ${doc.id}`);
  });

  // Verificar quizzes
  console.log('\n4. QUIZZES:');
  const quizResultsSnap = await db.collection('users').doc(userId).collection('quizResults')
    .where('timestamp', '>=', startOfWeek)
    .where('timestamp', '<', endOfWeek)
    .get();

  console.log('- Total quizzes encontrados:', quizResultsSnap.size);
  
  quizResultsSnap.forEach(doc => {
    const quiz = doc.data();
    const date = quiz.timestamp?.toDate();
    console.log(`  * ${date?.toLocaleDateString()} ${date?.toLocaleTimeString()} - Puntaje: ${quiz.score} - ID: ${doc.id}`);
  });

  // Verificar mini quizzes
  console.log('\n5. MINI QUIZZES:');
  const miniQuizResultsSnap = await db.collection('users').doc(userId).collection('miniQuizResults')
    .where('timestamp', '>=', startOfWeek)
    .where('timestamp', '<', endOfWeek)
    .get();

  console.log('- Total mini quizzes encontrados:', miniQuizResultsSnap.size);
  
  miniQuizResultsSnap.forEach(doc => {
    const quiz = doc.data();
    const date = quiz.timestamp?.toDate();
    console.log(`  * ${date?.toLocaleDateString()} ${date?.toLocaleTimeString()} - ID: ${doc.id}`);
  });

  // Verificar sesiones de juego
  console.log('\n6. SESIONES DE JUEGO:');
  const gameSessionsSnap = await db.collection('gameSessions')
    .where('userId', '==', userId)
    .where('timestamp', '>=', startOfWeek)
    .where('timestamp', '<', endOfWeek)
    .get();

  console.log('- Total sesiones de juego encontradas:', gameSessionsSnap.size);
  
  gameSessionsSnap.forEach(doc => {
    const session = doc.data();
    const date = session.timestamp?.toDate();
    const duration = session.duration || 0;
    console.log(`  * ${date?.toLocaleDateString()} ${date?.toLocaleTimeString()} - Duración: ${duration}s - Juego: ${session.gameType} - ID: ${doc.id}`);
  });

  // Mapear días de la semana
  console.log('\n7. RESUMEN DE DÍAS CON ACTIVIDAD:');
  const dayMapping: { [key: number]: string } = {
    1: 'Lunes',
    2: 'Martes',
    3: 'Miércoles',
    4: 'Jueves',
    5: 'Viernes',
    6: 'Sábado',
    0: 'Domingo'
  };

  const weekActivity: { [key: string]: boolean } = {
    'Lunes': false,
    'Martes': false,
    'Miércoles': false,
    'Jueves': false,
    'Viernes': false,
    'Sábado': false,
    'Domingo': false
  };

  // Procesar todas las actividades
  const allActivities: { date: Date, type: string }[] = [];

  studySessionsSnap.forEach(doc => {
    const session = doc.data();
    if (session.startTime && session.metrics?.sessionDuration > 0) {
      allActivities.push({ date: session.startTime.toDate(), type: 'estudio' });
    }
  });

  quizResultsSnap.forEach(doc => {
    const quiz = doc.data();
    if (quiz.timestamp) {
      allActivities.push({ date: quiz.timestamp.toDate(), type: 'quiz' });
    }
  });

  miniQuizResultsSnap.forEach(doc => {
    const quiz = doc.data();
    if (quiz.timestamp) {
      allActivities.push({ date: quiz.timestamp.toDate(), type: 'mini-quiz' });
    }
  });

  gameSessionsSnap.forEach(doc => {
    const session = doc.data();
    if (session.timestamp && (session.duration > 0 || session.completed)) {
      allActivities.push({ date: session.timestamp.toDate(), type: 'juego' });
    }
  });

  // Marcar días con actividad
  allActivities.forEach(activity => {
    const dayName = dayMapping[activity.date.getDay()];
    if (dayName) {
      weekActivity[dayName] = true;
    }
  });

  console.log('\nDías de la semana actual:');
  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    const dayName = dayMapping[date.getDay()];
    const hasActivity = weekActivity[dayName];
    console.log(`- ${dayName} (${date.toLocaleDateString()}): ${hasActivity ? '✅ SÍ' : '❌ NO'}`);
  }

  console.log('\n=== FIN DE VERIFICACIÓN ===');
  process.exit(0);
}

checkUserStreak().catch(console.error);