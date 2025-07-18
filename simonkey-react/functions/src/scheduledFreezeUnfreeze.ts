import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Inicializar admin si no está inicializado
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Cloud Function que se ejecuta cada 15 minutos para procesar
 * congelaciones y descongelaciones programadas
 */
export const processScheduledFreezeUnfreeze = functions
  .runWith({
    timeoutSeconds: 300, // 5 minutos de timeout
    memory: '512MB'
  })
  .pubsub
  .schedule('every 15 minutes')
  .timeZone('America/Mexico_City') // Ajusta según tu zona horaria
  .onRun(async (context) => {
    console.log('🕐 Iniciando procesamiento de congelaciones/descongelaciones programadas');
    
    const now = admin.firestore.Timestamp.now();
    const batch = db.batch();
    let updateCount = 0;
    
    try {
      // 1. Procesar congelaciones programadas
      console.log('❄️ Buscando cuadernos para congelar...');
      
      // Buscar en notebooks regulares
      const notebooksToFreeze = await db.collection('notebooks')
        .where('scheduledFreezeAt', '<=', now)
        .where('isFrozen', '!=', true)
        .get();
      
      // Buscar en schoolNotebooks (mientras exista)
      const schoolNotebooksToFreeze = await db.collection('schoolNotebooks')
        .where('scheduledFreezeAt', '<=', now)
        .where('isFrozen', '!=', true)
        .get();
      
      // Procesar notebooks regulares
      for (const doc of notebooksToFreeze.docs) {
        const notebookData = doc.data();
        console.log(`❄️ Congelando notebook: ${doc.id} - ${notebookData.title}`);
        
        // Calcular score promedio de estudiantes
        const frozenScore = await calculateAverageScore(doc.id);
        
        batch.update(doc.ref, {
          isFrozen: true,
          frozenAt: now,
          frozenScore: frozenScore,
          scheduledFreezeAt: admin.firestore.FieldValue.delete(),
          updatedAt: now
        });
        
        updateCount++;
      }
      
      // Procesar schoolNotebooks
      for (const doc of schoolNotebooksToFreeze.docs) {
        const notebookData = doc.data();
        console.log(`❄️ Congelando school notebook: ${doc.id} - ${notebookData.title}`);
        
        // Calcular score promedio de estudiantes
        const frozenScore = await calculateAverageScore(doc.id);
        
        batch.update(doc.ref, {
          isFrozen: true,
          frozenAt: now,
          frozenScore: frozenScore,
          scheduledFreezeAt: admin.firestore.FieldValue.delete(),
          updatedAt: now
        });
        
        updateCount++;
      }
      
      // 2. Procesar descongelaciones programadas
      console.log('☀️ Buscando cuadernos para descongelar...');
      
      // Buscar en notebooks regulares
      const notebooksToUnfreeze = await db.collection('notebooks')
        .where('scheduledUnfreezeAt', '<=', now)
        .where('isFrozen', '==', true)
        .get();
      
      // Buscar en schoolNotebooks
      const schoolNotebooksToUnfreeze = await db.collection('schoolNotebooks')
        .where('scheduledUnfreezeAt', '<=', now)
        .where('isFrozen', '==', true)
        .get();
      
      // Procesar notebooks regulares
      for (const doc of notebooksToUnfreeze.docs) {
        const notebookData = doc.data();
        console.log(`☀️ Descongelando notebook: ${doc.id} - ${notebookData.title}`);
        
        batch.update(doc.ref, {
          isFrozen: false,
          frozenAt: admin.firestore.FieldValue.delete(),
          frozenScore: admin.firestore.FieldValue.delete(),
          scheduledUnfreezeAt: admin.firestore.FieldValue.delete(),
          updatedAt: now
        });
        
        updateCount++;
      }
      
      // Procesar schoolNotebooks
      for (const doc of schoolNotebooksToUnfreeze.docs) {
        const notebookData = doc.data();
        console.log(`☀️ Descongelando school notebook: ${doc.id} - ${notebookData.title}`);
        
        batch.update(doc.ref, {
          isFrozen: false,
          frozenAt: admin.firestore.FieldValue.delete(),
          frozenScore: admin.firestore.FieldValue.delete(),
          scheduledUnfreezeAt: admin.firestore.FieldValue.delete(),
          updatedAt: now
        });
        
        updateCount++;
      }
      
      // 3. Ejecutar batch si hay actualizaciones
      if (updateCount > 0) {
        await batch.commit();
        console.log(`✅ Procesamiento completado: ${updateCount} cuadernos actualizados`);
        
        // Registrar en logs
        await db.collection('systemLogs').add({
          type: 'scheduled_freeze_unfreeze',
          timestamp: now,
          updatedCount: updateCount,
          status: 'success'
        });
      } else {
        console.log('ℹ️ No hay cuadernos para procesar');
      }
      
    } catch (error) {
      console.error('❌ Error procesando congelaciones/descongelaciones:', error);
      
      // Registrar error en logs
      await db.collection('systemLogs').add({
        type: 'scheduled_freeze_unfreeze',
        timestamp: now,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw error;
    }
  });

/**
 * Calcula el score promedio de todos los estudiantes para un cuaderno
 */
async function calculateAverageScore(notebookId: string): Promise<number> {
  try {
    const learningDataSnapshot = await db.collection('learningData')
      .where('cuadernoId', '==', notebookId)
      .get();
    
    if (learningDataSnapshot.empty) {
      return 0;
    }
    
    const studentScores = new Map<string, number>();
    
    learningDataSnapshot.forEach((doc) => {
      const data = doc.data();
      const score = data.efactor || 2.5; // Factor SM-3 por defecto
      const userId = data.usuarioId;
      
      if (!studentScores.has(userId)) {
        studentScores.set(userId, 0);
      }
      studentScores.set(userId, studentScores.get(userId)! + score);
    });
    
    // Calcular promedio
    let totalScore = 0;
    studentScores.forEach(score => totalScore += score);
    
    return studentScores.size > 0 ? totalScore / studentScores.size : 0;
    
  } catch (error) {
    console.error(`Error calculando score para notebook ${notebookId}:`, error);
    return 0;
  }
}

/**
 * Cloud Function manual para procesar inmediatamente (útil para pruebas)
 */
export const processScheduledFreezeUnfreezeManual = functions
  .runWith({
    timeoutSeconds: 300,
    memory: '512MB'
  })
  .https
  .onRequest(async (req, res) => {
    // Verificar autenticación básica (ajusta según tus necesidades)
    const authToken = req.headers.authorization;
    if (authToken !== `Bearer ${functions.config().admin?.token}`) {
      res.status(401).send('Unauthorized');
      return;
    }
    
    try {
      // Ejecutar la misma lógica
      await processScheduledFreezeUnfreeze.run(null as any);
      res.status(200).send('Procesamiento completado exitosamente');
    } catch (error) {
      console.error('Error en procesamiento manual:', error);
      res.status(500).send('Error procesando congelaciones/descongelaciones');
    }
  });