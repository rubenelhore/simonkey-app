/**
 * Script de desarrollo para ejecutar migración manualmente
 * 
 * Para usar este script:
 * 1. Importarlo en el componente donde lo necesites (ej: Materias.tsx)
 * 2. Añadir un botón de desarrollo que llame a runManualMigration()
 * 
 * Ejemplo:
 * import { runManualMigration } from './utils/runMigration';
 * 
 * {process.env.NODE_ENV === 'development' && (
 *   <button onClick={runManualMigration}>
 *     🔄 Ejecutar Migración Manual
 *   </button>
 * )}
 */

import { auth } from '../services/firebase';
import { 
  migrateUserNotebooksToDefaultMateria,
  checkUserMigrationStatus
} from './migrateNotebooksToMaterias';

export const runManualMigration = async () => {
  const user = auth.currentUser;
  
  if (!user) {
    console.error('❌ No hay usuario autenticado');
    alert('Debes estar autenticado para ejecutar la migración');
    return;
  }

  console.log('🚀 Iniciando migración manual para usuario:', user.uid);
  
  try {
    // Primero verificar el estado
    const status = await checkUserMigrationStatus(user.uid);
    console.log('📊 Estado actual:', status);
    
    if (!status.needsMigration) {
      alert('No hay notebooks que migrar. Todos tus notebooks ya están asignados a materias.');
      return;
    }
    
    // Confirmar migración
    const confirmMsg = `Se encontraron ${status.notebooksWithoutMateria} notebook(s) sin materia.\n\n` +
                      `¿Deseas migrarlos a una materia "General"?`;
    
    if (!window.confirm(confirmMsg)) {
      console.log('❌ Migración cancelada por el usuario');
      return;
    }
    
    // Ejecutar migración
    const result = await migrateUserNotebooksToDefaultMateria(user.uid);
    
    if (result.error) {
      console.error('❌ Error en migración:', result.error);
      alert(`Error durante la migración: ${result.error}`);
    } else {
      console.log('✅ Migración completada:', result);
      const message = `✅ Migración completada exitosamente!\n\n` +
                     `- Notebooks migrados: ${result.notebooksMigrated}\n` +
                     `- Materia creada: ${result.materiaCreated ? 'Sí' : 'No'}`;
      alert(message);
      
      // Recargar la página para ver los cambios
      if (window.confirm('¿Deseas recargar la página para ver los cambios?')) {
        window.location.reload();
      }
    }
    
  } catch (error) {
    console.error('❌ Error ejecutando migración:', error);
    alert('Error inesperado durante la migración. Revisa la consola para más detalles.');
  }
};

// Exponer función globalmente para desarrollo
if (process.env.NODE_ENV === 'development') {
  (window as any).runNotebookMigration = runManualMigration;
  console.log('💡 Función de migración disponible: window.runNotebookMigration()');
}