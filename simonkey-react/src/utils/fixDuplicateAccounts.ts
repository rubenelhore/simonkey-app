import { auth, db } from '../services/firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  deleteDoc,
  query,
  where,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';

interface UserData {
  id: string;
  email?: string;
  createdAt?: any;
  [key: string]: any;
}

/**
 * Detecta y limpia cuentas duplicadas basadas en email
 */
export const detectAndCleanDuplicateAccounts = async (): Promise<{
  duplicatesFound: number;
  cleaned: number;
  errors: Array<{ email: string; error: string }>;
}> => {
  console.log('🔍 Iniciando detección de cuentas duplicadas...');
  
  const results = {
    duplicatesFound: 0,
    cleaned: 0,
    errors: [] as Array<{ email: string; error: string }>
  };

  try {
    // Obtener todos los usuarios de la colección users
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const users: UserData[] = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Agrupar por email
    const emailGroups: { [email: string]: UserData[] } = {};
    
    users.forEach(user => {
      if (user.email) {
        if (!emailGroups[user.email]) {
          emailGroups[user.email] = [];
        }
        emailGroups[user.email].push(user);
      }
    });

    // Encontrar emails con múltiples cuentas
    const duplicateEmails = Object.keys(emailGroups).filter(email => emailGroups[email].length > 1);
    
    console.log(`📧 Encontrados ${duplicateEmails.length} emails con cuentas duplicadas`);
    results.duplicatesFound = duplicateEmails.length;

    for (const email of duplicateEmails) {
      const accounts = emailGroups[email];
      console.log(`🔄 Procesando email: ${email} (${accounts.length} cuentas)`);
      
      try {
        // Ordenar cuentas por fecha de creación (más antigua primero)
        accounts.sort((a, b) => {
          const aCreated = a.createdAt?.toDate?.() || new Date(0);
          const bCreated = b.createdAt?.toDate?.() || new Date(0);
          return aCreated.getTime() - bCreated.getTime();
        });

        // Mantener la cuenta más antigua (primera en la lista)
        const keepAccount = accounts[0];
        const deleteAccounts = accounts.slice(1);

        console.log(`✅ Manteniendo cuenta: ${keepAccount.id} (más antigua)`);
        console.log(`🗑️ Eliminando ${deleteAccounts.length} cuentas duplicadas`);

        // Eliminar cuentas duplicadas
        for (const deleteAccount of deleteAccounts) {
          try {
            await deleteDoc(doc(db, 'users', deleteAccount.id));
            console.log(`✅ Eliminada cuenta duplicada: ${deleteAccount.id}`);
            results.cleaned++;
          } catch (deleteError) {
            console.error(`❌ Error eliminando cuenta ${deleteAccount.id}:`, deleteError);
            results.errors.push({
              email: email,
              error: `Error eliminando cuenta ${deleteAccount.id}: ${deleteError}`
            });
          }
        }

        // Actualizar la cuenta que se mantiene con información de Google Auth si es necesario
        if (keepAccount.googleAuthUid) {
          console.log(`✅ Cuenta ${keepAccount.id} ya tiene Google Auth vinculado`);
        } else {
          console.log(`ℹ️ Cuenta ${keepAccount.id} no tiene Google Auth vinculado`);
        }

      } catch (emailError) {
        console.error(`❌ Error procesando email ${email}:`, emailError);
        results.errors.push({
          email: email,
          error: `Error procesando email: ${emailError}`
        });
      }
    }

    console.log(`✅ Limpieza completada. ${results.cleaned} cuentas eliminadas, ${results.errors.length} errores`);
    
  } catch (error) {
    console.error('❌ Error durante la limpieza de cuentas duplicadas:', error);
    results.errors.push({
      email: 'general',
      error: `Error general: ${error}`
    });
  }

  return results;
};

/**
 * Verifica si el usuario actual tiene cuentas duplicadas
 */
export const checkCurrentUserDuplicates = async (): Promise<{
  hasDuplicates: boolean;
  duplicateCount: number;
  mainAccountId?: string;
}> => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      return { hasDuplicates: false, duplicateCount: 0 };
    }

    console.log(`🔍 Verificando duplicados para usuario actual: ${currentUser.email}`);

    // Buscar todas las cuentas con el mismo email
    const usersQuery = query(collection(db, 'users'), where('email', '==', currentUser.email));
    const usersSnapshot = await getDocs(usersQuery);
    
    const accounts: UserData[] = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    if (accounts.length <= 1) {
      return { hasDuplicates: false, duplicateCount: 0 };
    }

    console.log(`⚠️ Encontradas ${accounts.length} cuentas con el mismo email`);

    // Ordenar por fecha de creación
    accounts.sort((a, b) => {
      const aCreated = a.createdAt?.toDate?.() || new Date(0);
      const bCreated = b.createdAt?.toDate?.() || new Date(0);
      return aCreated.getTime() - bCreated.getTime();
    });

    const mainAccount = accounts[0];

    return {
      hasDuplicates: true,
      duplicateCount: accounts.length - 1,
      mainAccountId: mainAccount.id
    };

  } catch (error) {
    console.error('❌ Error verificando duplicados del usuario actual:', error);
    return { hasDuplicates: false, duplicateCount: 0 };
  }
};

/**
 * Limpia duplicados específicos del usuario actual
 */
export const cleanCurrentUserDuplicates = async (): Promise<{
  success: boolean;
  cleaned: number;
  error?: string;
}> => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      return { success: false, cleaned: 0, error: 'No hay usuario autenticado' };
    }

    console.log(`🧹 Limpiando duplicados para usuario actual: ${currentUser.email}`);

    // Buscar todas las cuentas con el mismo email
    const usersQuery = query(collection(db, 'users'), where('email', '==', currentUser.email));
    const usersSnapshot = await getDocs(usersQuery);
    
    const accounts: UserData[] = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    if (accounts.length <= 1) {
      return { success: true, cleaned: 0 };
    }

    // Ordenar por fecha de creación
    accounts.sort((a, b) => {
      const aCreated = a.createdAt?.toDate?.() || new Date(0);
      const bCreated = b.createdAt?.toDate?.() || new Date(0);
      return aCreated.getTime() - bCreated.getTime();
    });

    const keepAccount = accounts[0];
    const deleteAccounts = accounts.slice(1);

    console.log(`✅ Manteniendo cuenta: ${keepAccount.id}`);
    console.log(`🗑️ Eliminando ${deleteAccounts.length} cuentas duplicadas`);

    let cleaned = 0;

    for (const deleteAccount of deleteAccounts) {
      try {
        await deleteDoc(doc(db, 'users', deleteAccount.id));
        console.log(`✅ Eliminada cuenta duplicada: ${deleteAccount.id}`);
        cleaned++;
      } catch (deleteError) {
        console.error(`❌ Error eliminando cuenta ${deleteAccount.id}:`, deleteError);
      }
    }

    return { success: true, cleaned };

  } catch (error) {
    console.error('❌ Error limpiando duplicados del usuario actual:', error);
    return { success: false, cleaned: 0, error: `Error: ${error}` };
  }
};

/**
 * Diagnostica manualmente si existe un usuario con un email específico
 */
export const diagnoseUserByEmail = async (email: string): Promise<{
  found: boolean;
  locations: Array<{ collection: string; id: string; data: any }>;
  summary: string;
}> => {
  console.log(`🔍 === DIAGNÓSTICO MANUAL PARA EMAIL: ${email} ===`);
  
  const results = {
    found: false,
    locations: [] as Array<{ collection: string; id: string; data: any }>,
    summary: ''
  };

  try {
    // Buscar en colección users
    console.log('1. Buscando en colección users...');
    const usersQuery = query(collection(db, 'users'), where('email', '==', email));
    const usersSnapshot = await getDocs(usersQuery);
    console.log(`   Resultado: ${usersSnapshot.size} documentos encontrados`);
    
    if (!usersSnapshot.empty) {
      usersSnapshot.docs.forEach(doc => {
        const data = doc.data();
        results.locations.push({
          collection: 'users',
          id: doc.id,
          data: data
        });
        console.log(`   ✅ Encontrado en users - ID: ${doc.id}, Tipo: ${data.subscription || 'FREE'}`);
      });
      results.found = true;
    }

    // Ya no buscamos en las colecciones antiguas schoolTeachers y schoolStudents
    // Todos los usuarios escolares están ahora en la colección users con subscription: SCHOOL
    console.log('2. Usuarios escolares ahora están en colección users con subscription: SCHOOL');
    console.log('   (Las colecciones schoolTeachers y schoolStudents ya no se usan)');

    // Generar resumen
    if (results.found) {
      results.summary = `Usuario encontrado en ${results.locations.length} ubicación(es): ${results.locations.map(loc => `${loc.collection}(${loc.id})`).join(', ')}`;
    } else {
      results.summary = 'Usuario no encontrado en ninguna colección';
    }

    console.log(`📋 RESUMEN: ${results.summary}`);
    console.log('✅ === DIAGNÓSTICO COMPLETADO ===');
    
  } catch (error) {
    console.error('❌ Error durante el diagnóstico manual:', error);
    results.summary = `Error durante el diagnóstico: ${error}`;
  }

  return results;
};

/**
 * Limpia duplicados para un email específico
 */
export const cleanDuplicateAccountsForEmail = async (email: string): Promise<{
  success: boolean;
  message: string;
  cleaned: number;
}> => {
  try {
    console.log(`🧹 Limpiando duplicados para email: ${email}`);

    // Buscar todas las cuentas con el mismo email
    const usersQuery = query(collection(db, 'users'), where('email', '==', email));
    const usersSnapshot = await getDocs(usersQuery);
    
    const accounts: UserData[] = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    if (accounts.length <= 1) {
      return { 
        success: true, 
        message: 'No se encontraron cuentas duplicadas para este email',
        cleaned: 0 
      };
    }

    // Ordenar por fecha de creación
    accounts.sort((a, b) => {
      const aCreated = a.createdAt?.toDate?.() || new Date(0);
      const bCreated = b.createdAt?.toDate?.() || new Date(0);
      return aCreated.getTime() - bCreated.getTime();
    });

    const keepAccount = accounts[0];
    const deleteAccounts = accounts.slice(1);

    console.log(`✅ Manteniendo cuenta: ${keepAccount.id}`);
    console.log(`🗑️ Eliminando ${deleteAccounts.length} cuentas duplicadas`);

    let cleaned = 0;

    for (const deleteAccount of deleteAccounts) {
      try {
        await deleteDoc(doc(db, 'users', deleteAccount.id));
        console.log(`✅ Eliminada cuenta duplicada: ${deleteAccount.id}`);
        cleaned++;
      } catch (deleteError) {
        console.error(`❌ Error eliminando cuenta ${deleteAccount.id}:`, deleteError);
      }
    }

    return { 
      success: true, 
      message: `Se eliminaron ${cleaned} cuentas duplicadas. Se mantuvo la cuenta más antigua (${keepAccount.id})`,
      cleaned 
    };

  } catch (error) {
    console.error('❌ Error limpiando duplicados para email específico:', error);
    return { 
      success: false, 
      message: `Error: ${error}`,
      cleaned: 0 
    };
  }
};

/**
 * Limpia todas las cuentas duplicadas del sistema
 */
export const cleanAllDuplicateAccounts = async (): Promise<{
  success: boolean;
  message: string;
  cleaned: number;
}> => {
  try {
    console.log('🧹 Iniciando limpieza general de todas las cuentas duplicadas...');
    
    const result = await detectAndCleanDuplicateAccounts();
    
    if (result.errors.length > 0) {
      return {
        success: false,
        message: `Limpieza completada con errores. ${result.cleaned} cuentas eliminadas, ${result.errors.length} errores`,
        cleaned: result.cleaned
      };
    }
    
    return {
      success: true,
      message: `Limpieza completada exitosamente. ${result.cleaned} cuentas duplicadas eliminadas`,
      cleaned: result.cleaned
    };
    
  } catch (error) {
    console.error('❌ Error en limpieza general:', error);
    return {
      success: false,
      message: `Error durante la limpieza: ${error}`,
      cleaned: 0
    };
  }
}; 