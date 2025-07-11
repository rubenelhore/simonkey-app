import { db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';

async function verifyGameData(userId: string = 'dTjO1PRNgRgvmOYItXhHseqpOY72') {
  console.log('🔍 Verificando datos de juegos en Firebase...\n');
  
  try {
    // 1. Verificar documento gamePoints
    const gamePointsDoc = await getDoc(doc(db, 'gamePoints', userId));
    
    if (!gamePointsDoc.exists()) {
      console.log('❌ No existe documento gamePoints para el usuario');
      return;
    }
    
    console.log('✅ Documento gamePoints encontrado');
    const gameData = gamePointsDoc.data();
    console.log('📋 Estructura del documento:', gameData);
    console.log('📋 Estructura completa (JSON):', JSON.stringify(gameData, null, 2));
    
    // 2. Verificar estructura notebookPoints
    if (gameData.notebookPoints) {
      console.log('\n📓 Datos por cuaderno:');
      
      for (const [notebookId, data] of Object.entries(gameData.notebookPoints)) {
        console.log(`\n  Cuaderno: ${notebookId}`);
        const notebookData = data as any;
        
        if (notebookData.pointsHistory) {
          console.log(`    - Juegos jugados: ${notebookData.pointsHistory.length}`);
          console.log(`    - Total puntos: ${notebookData.totalPoints || 0}`);
          
          // Mostrar últimos 3 juegos
          const lastGames = notebookData.pointsHistory.slice(-3);
          console.log('    - Últimos juegos:');
          lastGames.forEach((game: any, index: number) => {
            console.log(`      ${index + 1}. ${game.reason} - ${game.points} puntos`);
          });
        } else {
          console.log('    - No hay historial de puntos');
        }
      }
    } else {
      console.log('❌ No existe el campo notebookPoints');
    }
    
    // 3. Verificar campos del usuario
    console.log('\n👤 Verificando datos del usuario...');
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      console.log(`  - Cuadernos asignados: ${userData.idCuadernos?.length || 0}`);
      console.log(`  - IDs: ${userData.idCuadernos?.join(', ') || 'Ninguno'}`);
      console.log(`  - Tipo suscripción: ${userData.subscription}`);
    }
    
  } catch (error) {
    console.error('❌ Error verificando datos:', error);
  }
}

// Hacer disponible en consola
(window as any).verifyGameData = verifyGameData;

console.log('🛠️ Función verifyGameData() disponible en la consola');

export { verifyGameData };