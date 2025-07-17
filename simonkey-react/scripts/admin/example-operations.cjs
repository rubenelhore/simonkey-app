// Ejemplo de operaciones con Firebase Admin SDK
const { db, auth } = require('./setup.cjs');

// Ejemplos de operaciones comunes
async function ejemplosFirestore() {
  console.log('=== Ejemplos de Firestore ===\n');
  
  try {
    // 1. Leer todos los documentos de una colección
    console.log('1. Leyendo usuarios...');
    const usersSnapshot = await db.collection('users').limit(5).get();
    console.log(`   Encontrados ${usersSnapshot.size} usuarios`);
    
    // 2. Buscar un documento específico
    console.log('\n2. Buscando un documento específico...');
    const docRef = db.collection('users').doc('USER_ID_AQUI');
    const doc = await docRef.get();
    if (doc.exists) {
      console.log('   Documento encontrado:', doc.data());
    } else {
      console.log('   Documento no encontrado');
    }
    
    // 3. Actualizar un documento
    console.log('\n3. Ejemplo de actualización (comentado por seguridad)');
    // await db.collection('users').doc('USER_ID').update({
    //   lastModified: admin.firestore.FieldValue.serverTimestamp()
    // });
    
    // 4. Query con filtros
    console.log('\n4. Query con filtros...');
    const activeUsers = await db.collection('users')
      .where('isActive', '==', true)
      .limit(5)
      .get();
    console.log(`   Usuarios activos: ${activeUsers.size}`);
    
  } catch (error) {
    console.error('Error en operaciones de Firestore:', error);
  }
}

async function ejemplosAuth() {
  console.log('\n=== Ejemplos de Auth ===\n');
  
  try {
    // 1. Listar usuarios
    console.log('1. Listando primeros 5 usuarios...');
    const listUsersResult = await auth.listUsers(5);
    console.log(`   Total de usuarios: ${listUsersResult.users.length}`);
    listUsersResult.users.forEach(user => {
      console.log(`   - ${user.email} (${user.uid})`);
    });
    
    // 2. Buscar usuario por email
    console.log('\n2. Buscar usuario por email (ejemplo)');
    // const user = await auth.getUserByEmail('usuario@ejemplo.com');
    // console.log('   Usuario encontrado:', user.uid);
    
    // 3. Crear custom claims (comentado por seguridad)
    console.log('\n3. Ejemplo de custom claims (comentado)');
    // await auth.setCustomUserClaims(uid, { role: 'admin' });
    
  } catch (error) {
    console.error('Error en operaciones de Auth:', error);
  }
}

// Script para ejecutar operaciones específicas
async function ejecutarOperacion(operacion) {
  switch(operacion) {
    case 'test':
      console.log('Probando conexión...');
      try {
        const test = await db.collection('users').limit(1).get();
        console.log('✅ Conexión exitosa');
        console.log(`✅ Se pudo acceder a la colección 'users'`);
      } catch (error) {
        console.error('❌ Error al acceder a Firestore:', error.message);
        console.log('\nPosibles causas:');
        console.log('1. El proyecto ID en serviceAccountKey.json no coincide');
        console.log('2. La cuenta de servicio no tiene permisos suficientes');
        console.log('3. Firestore no está habilitado en el proyecto');
        console.log('\nIntentando listar colecciones disponibles...');
        try {
          const collections = await db.listCollections();
          console.log('Colecciones encontradas:', collections.map(col => col.id));
        } catch (listError) {
          console.error('❌ No se pueden listar las colecciones:', listError.message);
        }
      }
      break;
      
    case 'contar-usuarios':
      const users = await db.collection('users').get();
      console.log(`Total de usuarios: ${users.size}`);
      break;
      
    case 'contar-cuadernos':
      const notebooks = await db.collection('cuadernos').get();
      const schoolNotebooks = await db.collection('schoolNotebooks').get();
      console.log(`Cuadernos regulares: ${notebooks.size}`);
      console.log(`Cuadernos escolares: ${schoolNotebooks.size}`);
      break;
      
    default:
      console.log('Operación no reconocida');
      console.log('Operaciones disponibles: test, contar-usuarios, contar-cuadernos');
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  const operacion = process.argv[2];
  
  if (operacion) {
    ejecutarOperacion(operacion).then(() => process.exit(0));
  } else {
    // Ejecutar ejemplos
    (async () => {
      await ejemplosFirestore();
      await ejemplosAuth();
      process.exit(0);
    })();
  }
}

module.exports = {
  ejemplosFirestore,
  ejemplosAuth,
  ejecutarOperacion
};