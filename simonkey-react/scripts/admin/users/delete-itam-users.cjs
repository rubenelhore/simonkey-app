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
const { getAuth } = require('firebase-admin/auth');
const db = getFirestore();
const auth = getAuth();

async function deleteItamUsers() {
  console.log('=== Eliminación de usuarios @itam.com ===\n');
  
  try {
    // 1. Buscar usuarios con email @itam.com
    console.log('1. Buscando usuarios con email @itam.com...');
    const usersSnapshot = await db.collection('users').get();
    
    const itamUsers = [];
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.email && data.email.endsWith('@itam.com')) {
        itamUsers.push({
          id: doc.id,
          email: data.email,
          nombre: data.nombre || data.displayName || 'Sin nombre'
        });
      }
    });
    
    console.log(`\n📊 Encontrados ${itamUsers.length} usuarios @itam.com:\n`);
    itamUsers.forEach(user => {
      console.log(`   - ${user.email} (${user.id})`);
    });
    
    if (itamUsers.length === 0) {
      console.log('\n✅ No hay usuarios @itam.com para eliminar');
      return;
    }
    
    // 2. Confirmar antes de proceder
    console.log('\n⚠️  ADVERTENCIA: Se eliminarán los siguientes datos:');
    console.log('   - Perfil de usuario en Firestore');
    console.log('   - Cuenta de autenticación en Firebase Auth');
    console.log('   - Todas las subcolecciones del usuario');
    console.log('   - NO se eliminarán notebooks/conceptos (quedarán huérfanos)');
    
    console.log('\n🔄 Procediendo con la eliminación en 5 segundos...');
    console.log('   (Ctrl+C para cancelar)\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 3. Eliminar cada usuario
    for (const user of itamUsers) {
      console.log(`\n📌 Eliminando usuario: ${user.email}`);
      
      try {
        // Eliminar subcolecciones primero
        const subcollections = [
          'kpis', 'learningData', 'miniQuizResults', 'notebookLimits',
          'quizResults', 'quizStats', 'stats', 'geminiUsage', 'settings',
          'progress', 'limits'
        ];
        
        console.log('   - Eliminando subcolecciones...');
        for (const subcol of subcollections) {
          const subcolRef = db.collection(`users/${user.id}/${subcol}`);
          const subcolSnapshot = await subcolRef.get();
          
          if (!subcolSnapshot.empty) {
            const batch = db.batch();
            subcolSnapshot.forEach(doc => {
              batch.delete(doc.ref);
            });
            await batch.commit();
            console.log(`     ✓ ${subcol}: ${subcolSnapshot.size} documentos eliminados`);
          }
        }
        
        // Eliminar documento principal del usuario
        console.log('   - Eliminando perfil de Firestore...');
        await db.collection('users').doc(user.id).delete();
        console.log('     ✓ Perfil eliminado');
        
        // Eliminar de Firebase Auth
        console.log('   - Eliminando de Firebase Auth...');
        try {
          await auth.deleteUser(user.id);
          console.log('     ✓ Cuenta de Auth eliminada');
        } catch (authError) {
          if (authError.code === 'auth/user-not-found') {
            console.log('     ℹ️  Usuario no existe en Auth (posiblemente ya eliminado)');
          } else {
            console.log('     ⚠️  Error eliminando de Auth:', authError.message);
          }
        }
        
        console.log(`   ✅ Usuario ${user.email} eliminado completamente`);
        
      } catch (error) {
        console.error(`   ❌ Error eliminando ${user.email}:`, error.message);
      }
    }
    
    // 4. Resumen final
    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMEN DE ELIMINACIÓN');
    console.log('='.repeat(50));
    console.log(`✅ Proceso completado`);
    console.log(`📌 Usuarios procesados: ${itamUsers.length}`);
    
    // 5. Verificar notebooks huérfanos
    console.log('\n🔍 Verificando notebooks huérfanos...');
    let orphanedNotebooks = 0;
    
    for (const user of itamUsers) {
      const notebooks = await db.collection('notebooks')
        .where('userId', '==', user.id)
        .get();
      
      if (!notebooks.empty) {
        orphanedNotebooks += notebooks.size;
        console.log(`   - ${notebooks.size} notebooks huérfanos de ${user.email}`);
      }
    }
    
    if (orphanedNotebooks > 0) {
      console.log(`\n⚠️  Quedaron ${orphanedNotebooks} notebooks huérfanos`);
      console.log('   Puedes eliminarlos manualmente si es necesario');
    }
    
  } catch (error) {
    console.error('\n❌ Error fatal:', error);
    throw error;
  }
}

// Ejecutar
deleteItamUsers().then(() => {
  console.log('\n✅ Script completado exitosamente');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Error en el script:', err);
  process.exit(1);
});