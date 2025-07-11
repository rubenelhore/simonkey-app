import { db } from '../services/firebase';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';

async function debugGameCounts(userId: string) {
  console.log(`\n🔍 Depurando conteo de juegos para usuario: ${userId}\n`);
  
  try {
    // 1. Verificar estructura de gamePoints
    console.log('1️⃣ Verificando documento gamePoints...');
    const gamePointsDoc = await getDoc(doc(db, 'gamePoints', userId));
    
    if (!gamePointsDoc.exists()) {
      console.log('❌ No existe documento gamePoints para este usuario');
      return;
    }
    
    const gamePointsData = gamePointsDoc.data();
    console.log('✅ Documento gamePoints encontrado');
    console.log('📊 Estructura completa:', JSON.stringify(gamePointsData, null, 2));
    
    // 2. Analizar datos por cuaderno
    const notebookPoints = gamePointsData.notebookPoints || {};
    console.log(`\n2️⃣ Analizando ${Object.keys(notebookPoints).length} cuadernos:`);
    
    for (const [notebookId, data] of Object.entries(notebookPoints)) {
      const notebookData = data as any;
      console.log(`\n📓 Cuaderno: ${notebookId}`);
      console.log(`   - Total de puntos: ${notebookData.totalPoints || 0}`);
      console.log(`   - Historial de puntos: ${(notebookData.pointsHistory || []).length} entradas`);
      
      // Mostrar últimas 3 entradas del historial
      if (notebookData.pointsHistory && notebookData.pointsHistory.length > 0) {
        console.log('   - Últimas entradas:');
        notebookData.pointsHistory.slice(-3).forEach((entry: any, index: number) => {
          console.log(`     ${index + 1}. ${entry.gameName} - ${entry.points} puntos - ${entry.gameId}`);
        });
      }
      
      // Verificar gameScores
      if (notebookData.gameScores) {
        console.log('   - Puntuaciones por juego:');
        console.log(`     • Memory: ${notebookData.gameScores.memory || 0}`);
        console.log(`     • Puzzle: ${notebookData.gameScores.puzzle || 0}`);
        console.log(`     • Race: ${notebookData.gameScores.race || 0}`);
        console.log(`     • Quiz: ${notebookData.gameScores.quiz || 0}`);
      }
    }
    
    // 3. Verificar cuadernos del usuario
    console.log('\n3️⃣ Verificando cuadernos asignados al usuario...');
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const idCuadernos = userData.idCuadernos || [];
      console.log(`✅ Usuario tiene ${idCuadernos.length} cuadernos asignados`);
      
      // Comparar con los cuadernos que tienen puntos
      const cuadernosConPuntos = Object.keys(notebookPoints);
      const cuadernosSinPuntos = idCuadernos.filter((id: string) => !cuadernosConPuntos.includes(id));
      
      if (cuadernosSinPuntos.length > 0) {
        console.log(`⚠️ ${cuadernosSinPuntos.length} cuadernos sin datos de juegos:`, cuadernosSinPuntos);
      }
    }
    
    // 4. Verificar formato de gameId en las últimas transacciones
    console.log('\n4️⃣ Verificando formato de gameId en transacciones recientes...');
    let totalTransacciones = 0;
    let transaccionesConNotebookId = 0;
    
    for (const [notebookId, data] of Object.entries(notebookPoints)) {
      const notebookData = data as any;
      const history = notebookData.pointsHistory || [];
      
      history.forEach((transaction: any) => {
        totalTransacciones++;
        // Verificar si el gameId incluye el notebookId
        if (transaction.gameId && transaction.gameId.includes('_')) {
          const [gameType, gameNotebookId] = transaction.gameId.split('_');
          if (gameNotebookId === notebookId) {
            transaccionesConNotebookId++;
          } else {
            console.log(`⚠️ gameId no coincide: ${transaction.gameId} en cuaderno ${notebookId}`);
          }
        } else {
          console.log(`❌ gameId sin formato correcto: ${transaction.gameId}`);
        }
      });
    }
    
    console.log(`\n📊 Resumen de transacciones:`);
    console.log(`   - Total: ${totalTransacciones}`);
    console.log(`   - Con formato correcto: ${transaccionesConNotebookId}`);
    console.log(`   - Sin formato correcto: ${totalTransacciones - transaccionesConNotebookId}`);
    
  } catch (error) {
    console.error('❌ Error durante la depuración:', error);
  }
}

// Función auxiliar para ejecutar desde la consola del navegador
(window as any).debugGameCounts = debugGameCounts;

console.log('🎮 Script de depuración cargado. Usa debugGameCounts("USER_ID") en la consola.');

export default debugGameCounts;