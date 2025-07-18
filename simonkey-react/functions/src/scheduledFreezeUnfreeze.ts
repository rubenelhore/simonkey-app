import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

// La inicialización de admin se hace en index.ts
// Por lo tanto, solo accedemos a firestore cuando sea necesario

/**
 * Cloud Function que se ejecuta cada 15 minutos para procesar
 * congelaciones y descongelaciones programadas
 */
export const processScheduledFreezeUnfreeze = onSchedule(
  {
    schedule: 'every 15 minutes',
    timeZone: 'America/Mexico_City',
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 300
  },
  async (event) => {
    console.log('🕐 Iniciando procesamiento de congelaciones/descongelaciones programadas');
    
    const db = admin.firestore();
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
        const frozenScore = await calculateAverageScore(doc.id, db);
        
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
        const frozenScore = await calculateAverageScore(doc.id, db);
        
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
async function calculateAverageScore(notebookId: string, db: admin.firestore.Firestore): Promise<number> {
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
export const processScheduledFreezeUnfreezeManual = onRequest(
  {
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 300
  },
  async (req, res) => {
    // Verificar autenticación básica (ajusta según tus necesidades)
    const authToken = req.headers.authorization;
    // TODO: Actualizar a usar variables de entorno en lugar de functions.config()
    if (authToken !== `Bearer ${process.env.ADMIN_TOKEN || 'your-secret-token'}`) {
      res.status(401).send('Unauthorized');
      return;
    }
    
    try {
      // Ejecutar la misma lógica del procesamiento programado
      console.log('🕐 Procesamiento manual iniciado');
      
      const db = admin.firestore();
      const now = admin.firestore.Timestamp.now();
      const batch = db.batch();
      let updateCount = 0;
      
      // Procesar congelaciones
      const notebooksToFreeze = await db.collection('notebooks')
        .where('scheduledFreezeAt', '<=', now)
        .where('isFrozen', '!=', true)
        .get();
      
      for (const doc of notebooksToFreeze.docs) {
        batch.update(doc.ref, {
          isFrozen: true,
          frozenAt: now,
          scheduledFreezeAt: admin.firestore.FieldValue.delete()
        });
        updateCount++;
      }
      
      // Procesar descongelaciones
      const notebooksToUnfreeze = await db.collection('notebooks')
        .where('scheduledUnfreezeAt', '<=', now)
        .where('isFrozen', '==', true)
        .get();
      
      for (const doc of notebooksToUnfreeze.docs) {
        batch.update(doc.ref, {
          isFrozen: false,
          frozenAt: admin.firestore.FieldValue.delete(),
          scheduledUnfreezeAt: admin.firestore.FieldValue.delete()
        });
        updateCount++;
      }
      
      if (updateCount > 0) {
        await batch.commit();
      }
      
      res.status(200).json({
        success: true,
        message: `Procesamiento completado. ${updateCount} cuadernos actualizados.`
      });
    } catch (error) {
      console.error('Error en procesamiento manual:', error);
      res.status(500).send('Error procesando congelaciones/descongelaciones');
    }
  });