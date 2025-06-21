// SCRIPT PARA CREAR EL ADMIN FALTANTE
// Copia y pega este código en la consola del navegador cuando estés logueado como profesor

const createMissingAdmin = async () => {
  try {
    console.log('🔧 Creando admin faltante...');
    
    // Importar Firebase (asumiendo que ya está disponible en la página)
    const { db } = await import('./src/services/firebase.js');
    const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
    
    const adminId = '2RMQYiXdOfAz3Bc96dBv';
    
    await setDoc(doc(db, 'schoolAdmins', adminId), {
      id: adminId,
      nombre: 'Admin Escolar',
      email: 'admin@escuela.edu.mx',
      password: '1234',
      idInstitucion: 'institucion_default',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    console.log('✅ Admin creado exitosamente!');
    console.log('🔄 Ahora puedes usar el botón "Crear Salones y Cuadernos"');
    return true;
  } catch (error) {
    console.error('❌ Error creando admin:', error);
    return false;
  }
};

// Ejecutar la función
createMissingAdmin(); 