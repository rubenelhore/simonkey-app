// Script para crear el admin faltante
// Ejecutar en la consola del navegador cuando estés logueado como profesor

import { db,} from '../services/firebase';
import { doc, setDoc, serverTimestamp,} from 'firebase/firestore';

const createMissingAdmin = async () => {
  try {
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

    return true;
  } catch (error) {
    console.error('❌ Error creando admin:', error);
    return false;
  }
};

// Ejecutar la función
createMissingAdmin(); 