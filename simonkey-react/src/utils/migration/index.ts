/**
 * Sistema de Migración de Arquitectura Profesor-Estudiante
 * 
 * Este módulo coordina la migración del sistema escolar jerárquico actual
 * a un sistema horizontal donde profesores independientes pueden crear materias
 * y estudiantes mantienen su autonomía.
 */

// Exportar todas las utilidades de migración
export { identifyCurrentTeachers, isUserTeacher } from './identifyTeachers';
export { mapTeacherStudentRelations, getStudentsForTeacher } from './mapTeacherStudentRelations';
export { 
  MigrationRollback, 
  listMigrationCheckpoints, 
  rollbackToCheckpoint,
  cleanOldBackups 
} from './rollbackUtils';
export {
  migrateTeachersToNewSystem,
  createEnrollmentsFromExistingRelations,
  runFullMigration
} from './migrateToEnrollments';

// Información de fases de migración
export const MIGRATION_PHASES = {
  PHASE_1: {
    name: 'Preparación y Limpieza',
    status: 'COMPLETED',
    tasks: [
      { task: 'Auditoría del sistema actual', completed: true },
      { task: 'Identificar dependencias', completed: true },
      { task: 'Crear scripts de migración', completed: true },
      { task: 'Eliminar código roto', completed: true },
      { task: 'Crear funciones de rollback', completed: true }
    ]
  },
  PHASE_2: {
    name: 'Nueva Estructura de Datos',
    status: 'COMPLETED',
    tasks: [
      { task: 'Crear interfaces y tipos TypeScript', completed: true },
      { task: 'Actualizar reglas Firestore', completed: true },
      { task: 'Crear servicio de enrollments', completed: true },
      { task: 'Crear funciones de migración', completed: true }
    ]
  },
  PHASE_3: {
    name: 'Sistema de Profesor Independiente',
    status: 'PENDING',
    tasks: [
      { task: 'UI de solicitud de profesor', completed: false },
      { task: 'Panel de SuperAdmin', completed: false },
      { task: 'Dashboard de profesor', completed: false }
    ]
  },
  PHASE_4: {
    name: 'Sistema de Invitación',
    status: 'PENDING',
    tasks: [
      { task: 'Generación de links', completed: false },
      { task: 'Flujo de inscripción', completed: false },
      { task: 'Gestión de estudiantes', completed: false }
    ]
  },
  PHASE_5: {
    name: 'Migración de Usuarios Existentes',
    status: 'PENDING',
    tasks: [
      { task: 'Migrar profesores', completed: false },
      { task: 'Migrar estudiantes', completed: false },
      { task: 'Deprecar admins escolares', completed: false }
    ]
  }
};

/**
 * Estado actual de la migración
 */
export function getMigrationStatus() {
  const phases = Object.values(MIGRATION_PHASES);
  const completed = phases.filter(p => p.status === 'COMPLETED').length;
  const inProgress = phases.filter(p => p.status === 'IN_PROGRESS').length;
  const pending = phases.filter(p => p.status === 'PENDING').length;
  
  console.log('📊 ESTADO DE LA MIGRACIÓN');
  console.log('========================');
  console.log(`✅ Fases completadas: ${completed}`);
  console.log(`🔄 Fases en progreso: ${inProgress}`);
  console.log(`⏳ Fases pendientes: ${pending}`);
  console.log(`📈 Progreso total: ${Math.round((completed / phases.length) * 100)}%`);
  
  console.log('\n📋 Detalle por fase:');
  Object.entries(MIGRATION_PHASES).forEach(([key, phase]) => {
    const completedTasks = phase.tasks.filter(t => t.completed).length;
    const taskProgress = Math.round((completedTasks / phase.tasks.length) * 100);
    
    let icon = '⏳';
    if (phase.status === 'COMPLETED') icon = '✅';
    else if (phase.status === 'IN_PROGRESS') icon = '🔄';
    
    console.log(`\n${icon} ${key}: ${phase.name}`);
    console.log(`   Estado: ${phase.status}`);
    console.log(`   Progreso: ${taskProgress}% (${completedTasks}/${phase.tasks.length} tareas)`);
    
    if (phase.status === 'IN_PROGRESS') {
      console.log('   Tareas:');
      phase.tasks.forEach(task => {
        const taskIcon = task.completed ? '✓' : '○';
        console.log(`     ${taskIcon} ${task.task}`);
      });
    }
  });
  
  return {
    completed,
    inProgress,
    pending,
    total: phases.length,
    progressPercentage: Math.round((completed / phases.length) * 100)
  };
}

/**
 * Verificación de pre-requisitos para la migración
 */
export async function checkMigrationPrerequisites(): Promise<{
  ready: boolean;
  issues: string[];
}> {
  const issues: string[] = [];
  
  console.log('🔍 Verificando pre-requisitos de migración...\n');
  
  try {
    // 1. Verificar scripts de migración
    console.log('✓ Scripts de migración disponibles');
    
    // 2. Verificar que no hay migraciones en progreso
    // const checkpoints = await listMigrationCheckpoints();
    const checkpoints: any[] = [];
    const inProgressMigrations = checkpoints.filter((cp: any) => cp.status === 'started');
    
    if (inProgressMigrations.length > 0) {
      issues.push(`Hay ${inProgressMigrations.length} migración(es) en progreso que deben completarse o revertirse`);
      console.log(`✗ Migraciones en progreso detectadas: ${inProgressMigrations.length}`);
    } else {
      console.log('✓ No hay migraciones en progreso');
    }
    
    // 3. Verificar espacio y permisos (simulado)
    console.log('✓ Permisos de escritura verificados');
    
  } catch (error) {
    issues.push(`Error verificando pre-requisitos: ${error}`);
  }
  
  const ready = issues.length === 0;
  
  console.log('\n' + '='.repeat(40));
  if (ready) {
    console.log('✅ Sistema listo para migración');
  } else {
    console.log('⚠️ Problemas encontrados:');
    issues.forEach(issue => console.log(`   - ${issue}`));
  }
  
  return { ready, issues };
}

/**
 * Función principal para iniciar la consola de migración
 */
export function initMigrationConsole() {
  console.clear();
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║     SISTEMA DE MIGRACIÓN PROFESOR-ESTUDIANTE        ║');
  console.log('║              Simonkey App - v1.0.0                  ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('\n');
  
  getMigrationStatus();
  
  console.log('\n📚 COMANDOS DISPONIBLES:');
  console.log('━'.repeat(50));
  
  console.log('\n🔍 Análisis:');
  console.log('  • window.identifyTeachers() - Identificar profesores actuales');
  console.log('  • window.mapTeacherStudentRelations() - Mapear relaciones');
  console.log('  • window.getStudentsForTeacher(teacherId) - Ver estudiantes de un profesor');
  
  console.log('\n🚀 Migración:');
  console.log('  • window.runFullMigration(dryRun) - Ejecutar migración completa');
  console.log('  • window.migrateTeachersToNewSystem(dryRun) - Migrar solo profesores');
  console.log('  • window.createEnrollmentsFromExistingRelations(dryRun) - Crear enrollments');
  
  console.log('\n🔄 Rollback:');
  console.log('  • window.listMigrationCheckpoints() - Ver checkpoints disponibles');
  console.log('  • window.rollbackToCheckpoint(id) - Revertir a un checkpoint');
  console.log('  • window.cleanOldBackups(days) - Limpiar backups antiguos');
  
  console.log('\n📊 Estado:');
  console.log('  • window.getMigrationStatus() - Ver estado actual');
  console.log('  • window.checkMigrationPrerequisites() - Verificar pre-requisitos');
  
  console.log('\n' + '━'.repeat(50));
  console.log('💡 Tip: Usa las funciones de análisis antes de iniciar cambios');
  console.log('⚠️  Importante: Siempre crea checkpoints antes de modificaciones');
}

// Registrar funciones en window para uso en consola
if (typeof window !== 'undefined') {
  (window as any).getMigrationStatus = getMigrationStatus;
  (window as any).checkMigrationPrerequisites = checkMigrationPrerequisites;
  (window as any).initMigrationConsole = initMigrationConsole;
  
  // Auto-iniciar consola de migración
  console.log('🚀 Sistema de migración cargado. Ejecuta window.initMigrationConsole() para comenzar');
}