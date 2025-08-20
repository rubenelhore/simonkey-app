import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  setDoc,
  query, 
  where,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { UserProfile, SchoolRole, Enrollment, EnrollmentStatus, TeacherProfile } from '../../types/interfaces';
import { MigrationRollback } from './rollbackUtils';
import { enrollmentService } from '../../services/enrollmentService';

interface MigrationReport {
  totalProcessed: number;
  successfulMigrations: number;
  failedMigrations: number;
  teachersConverted: number;
  enrollmentsCreated: number;
  errors: Array<{ userId: string; error: string }>;
  checkpointId?: string;
}

/**
 * Migrar profesores escolares existentes al nuevo sistema
 */
export async function migrateTeachersToNewSystem(dryRun: boolean = true): Promise<MigrationReport> {
  console.log(`🔄 ${dryRun ? 'SIMULACIÓN:' : 'EJECUTANDO:'} Migración de profesores al nuevo sistema...`);
  
  const rollback = dryRun ? null : new MigrationRollback('migrate_teachers');
  const report: MigrationReport = {
    totalProcessed: 0,
    successfulMigrations: 0,
    failedMigrations: 0,
    teachersConverted: 0,
    enrollmentsCreated: 0,
    errors: []
  };

  try {
    // Crear checkpoint inicial si no es dry run
    if (rollback) {
      await rollback.createCheckpoint('started');
      report.checkpointId = rollback.getCheckpointId();
    }

    // 1. Obtener todos los profesores escolares
    const usersRef = collection(db, 'users');
    const teacherQuery = query(usersRef, where('schoolRole', '==', SchoolRole.TEACHER));
    const teacherSnapshot = await getDocs(teacherQuery);

    console.log(`📚 Profesores encontrados: ${teacherSnapshot.size}`);
    report.totalProcessed = teacherSnapshot.size;

    // Procesar en lotes para evitar sobrecargar Firestore
    const BATCH_SIZE = 10;
    const teachers = teacherSnapshot.docs;
    
    for (let i = 0; i < teachers.length; i += BATCH_SIZE) {
      const batch = teachers.slice(i, Math.min(i + BATCH_SIZE, teachers.length));
      
      await Promise.all(batch.map(async (teacherDoc) => {
        try {
          const teacherData = teacherDoc.data() as UserProfile;
          const teacherId = teacherDoc.id;

          console.log(`\n👨‍🏫 Procesando profesor: ${teacherData.displayName || teacherData.nombre}`);

          // Hacer backup antes de modificar
          if (rollback) {
            await rollback.backupDocument('users', teacherId);
          }

          // 2. Actualizar UserProfile con isTeacher = true
          if (!dryRun) {
            await setDoc(doc(db, 'users', teacherId), {
              isTeacher: true,
              teacherApprovedAt: Timestamp.now()
            }, { merge: true });
          }
          console.log(`  ✓ Campo isTeacher agregado`);

          // 3. Crear TeacherProfile
          const teacherProfile: TeacherProfile = {
            userId: teacherId,
            isActive: true,
            institution: teacherData.schoolName,
            approvedAt: Timestamp.now(),
            approvedBy: 'migration_system',
            maxStudents: 100, // Límite generoso para profesores migrados
            currentStudents: 0,
            maxMaterias: 20,
            currentMaterias: 0,
            settings: {
              allowPublicEnrollment: false,
              requireApproval: false,
              sendNotifications: true,
              showInDirectory: false
            },
            stats: {
              totalStudentsAllTime: 0,
              totalMateriasCreated: 0,
              totalExamsCreated: 0,
              lastActiveAt: Timestamp.now()
            }
          };

          if (rollback) {
            await rollback.backupNewDocument('teacherProfiles', teacherId);
          }

          if (!dryRun) {
            await setDoc(doc(db, 'teacherProfiles', teacherId), teacherProfile);
          }
          console.log(`  ✓ TeacherProfile creado`);

          report.teachersConverted++;
          report.successfulMigrations++;

        } catch (error) {
          console.error(`  ✗ Error procesando profesor ${teacherDoc.id}:`, error);
          report.failedMigrations++;
          report.errors.push({
            userId: teacherDoc.id,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }));

      console.log(`\n📊 Lote ${Math.floor(i / BATCH_SIZE) + 1} completado`);
    }

    // Finalizar checkpoint si no es dry run
    if (rollback) {
      await rollback.createCheckpoint('completed');
    }

  } catch (error) {
    console.error('❌ Error en migración de profesores:', error);
    
    // Si hay error y no es dry run, hacer rollback
    if (rollback) {
      console.log('🔄 Iniciando rollback...');
      await rollback.rollback();
    }
    
    throw error;
  }

  // Generar reporte final
  console.log('\n' + '='.repeat(50));
  console.log(`📊 REPORTE DE MIGRACIÓN DE PROFESORES ${dryRun ? '(SIMULACIÓN)' : ''}`);
  console.log('='.repeat(50));
  console.log(`Total procesados: ${report.totalProcessed}`);
  console.log(`✅ Exitosos: ${report.successfulMigrations}`);
  console.log(`❌ Fallidos: ${report.failedMigrations}`);
  console.log(`👨‍🏫 Profesores convertidos: ${report.teachersConverted}`);
  
  if (report.errors.length > 0) {
    console.log('\n⚠️ Errores encontrados:');
    report.errors.forEach(err => {
      console.log(`  - ${err.userId}: ${err.error}`);
    });
  }

  if (report.checkpointId) {
    console.log(`\n💾 Checkpoint ID: ${report.checkpointId}`);
    console.log('   (Guarda este ID para poder hacer rollback si es necesario)');
  }

  return report;
}

/**
 * Crear enrollments basados en relaciones profesor-estudiante existentes
 */
export async function createEnrollmentsFromExistingRelations(
  dryRun: boolean = true
): Promise<MigrationReport> {
  console.log(`\n🔄 ${dryRun ? 'SIMULACIÓN:' : 'EJECUTANDO:'} Creación de enrollments desde relaciones existentes...`);
  
  const rollback = dryRun ? null : new MigrationRollback('create_enrollments');
  const report: MigrationReport = {
    totalProcessed: 0,
    successfulMigrations: 0,
    failedMigrations: 0,
    teachersConverted: 0,
    enrollmentsCreated: 0,
    errors: []
  };

  try {
    if (rollback) {
      await rollback.createCheckpoint('started');
      report.checkpointId = rollback.getCheckpointId();
    }

    // 1. Obtener todos los profesores con isTeacher = true
    const usersRef = collection(db, 'users');
    const teacherQuery = query(usersRef, where('isTeacher', '==', true));
    const teacherSnapshot = await getDocs(teacherQuery);

    console.log(`📚 Profesores con isTeacher=true: ${teacherSnapshot.size}`);

    for (const teacherDoc of teacherSnapshot.docs) {
      const teacherData = teacherDoc.data() as UserProfile;
      const teacherId = teacherDoc.id;

      console.log(`\n👨‍🏫 Procesando profesor: ${teacherData.displayName || teacherData.nombre}`);

      // 2. Buscar estudiantes relacionados
      // Opción A: Por misma escuela
      if (teacherData.idEscuela) {
        const studentQuery = query(
          usersRef,
          where('schoolRole', '==', SchoolRole.STUDENT),
          where('idEscuela', '==', teacherData.idEscuela)
        );
        const studentSnapshot = await getDocs(studentQuery);

        console.log(`  📚 Estudiantes en la misma escuela: ${studentSnapshot.size}`);

        // 3. Obtener materias del profesor
        const subjectsRef = collection(db, 'schoolSubjects');
        const subjectsQuery = query(subjectsRef, where('idProfesor', '==', teacherId));
        const subjectsSnapshot = await getDocs(subjectsQuery);

        if (subjectsSnapshot.empty) {
          console.log(`  ⚠️ No se encontraron materias para este profesor`);
          continue;
        }

        const materiaId = subjectsSnapshot.docs[0].id; // Usar la primera materia
        const materiaData = subjectsSnapshot.docs[0].data();
        console.log(`  📖 Usando materia: ${materiaData.nombre}`);

        // 4. Crear enrollments para cada estudiante
        for (const studentDoc of studentSnapshot.docs) {
          const studentData = studentDoc.data() as UserProfile;
          const studentId = studentDoc.id;

          try {
            // Verificar si ya existe enrollment
            const existingEnrollment = await enrollmentService.getEnrollment(
              studentId,
              teacherId,
              materiaId
            );

            if (existingEnrollment) {
              console.log(`    ⏭️ Enrollment ya existe para ${studentData.displayName}`);
              continue;
            }

            const enrollmentData: Omit<Enrollment, 'id'> = {
              studentId,
              studentEmail: studentData.email,
              studentName: studentData.displayName || studentData.nombre,
              teacherId,
              teacherEmail: teacherData.email,
              teacherName: teacherData.displayName || teacherData.nombre,
              materiaId,
              materiaName: materiaData.nombre,
              enrolledAt: Timestamp.now(),
              status: EnrollmentStatus.ACTIVE,
              metadata: {
                source: 'migration',
                schoolId: teacherData.idEscuela,
                schoolName: teacherData.schoolName
              }
            };

            if (!dryRun) {
              const enrollmentRef = doc(collection(db, 'enrollments'));
              
              if (rollback) {
                await rollback.backupNewDocument('enrollments', enrollmentRef.id);
              }
              
              await setDoc(enrollmentRef, enrollmentData);
            }

            console.log(`    ✓ Enrollment creado para ${studentData.displayName}`);
            report.enrollmentsCreated++;

          } catch (error) {
            console.error(`    ✗ Error creando enrollment para ${studentId}:`, error);
            report.errors.push({
              userId: studentId,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }

      // Opción B: Por idAdmin directo
      const adminStudentQuery = query(
        usersRef,
        where('schoolRole', '==', SchoolRole.STUDENT),
        where('idAdmin', '==', teacherId)
      );
      const adminStudentSnapshot = await getDocs(adminStudentQuery);

      if (adminStudentSnapshot.size > 0) {
        console.log(`  📚 Estudiantes con idAdmin directo: ${adminStudentSnapshot.size}`);
        // Procesar de manera similar...
      }

      report.totalProcessed++;
    }

    if (rollback) {
      await rollback.createCheckpoint('completed');
    }

    report.successfulMigrations = report.enrollmentsCreated;

  } catch (error) {
    console.error('❌ Error creando enrollments:', error);
    
    if (rollback) {
      console.log('🔄 Iniciando rollback...');
      await rollback.rollback();
    }
    
    throw error;
  }

  // Generar reporte final
  console.log('\n' + '='.repeat(50));
  console.log(`📊 REPORTE DE CREACIÓN DE ENROLLMENTS ${dryRun ? '(SIMULACIÓN)' : ''}`);
  console.log('='.repeat(50));
  console.log(`Total profesores procesados: ${report.totalProcessed}`);
  console.log(`✅ Enrollments creados: ${report.enrollmentsCreated}`);
  console.log(`❌ Errores: ${report.errors.length}`);
  
  if (report.errors.length > 0) {
    console.log('\n⚠️ Errores encontrados:');
    report.errors.slice(0, 10).forEach(err => {
      console.log(`  - ${err.userId}: ${err.error}`);
    });
    if (report.errors.length > 10) {
      console.log(`  ... y ${report.errors.length - 10} más`);
    }
  }

  if (report.checkpointId) {
    console.log(`\n💾 Checkpoint ID: ${report.checkpointId}`);
  }

  return report;
}

/**
 * Ejecutar migración completa
 */
export async function runFullMigration(dryRun: boolean = true): Promise<{
  teachers: MigrationReport;
  enrollments: MigrationReport;
}> {
  console.log('🚀 INICIANDO MIGRACIÓN COMPLETA AL NUEVO SISTEMA');
  console.log('='.repeat(50));
  
  if (dryRun) {
    console.log('⚠️ MODO SIMULACIÓN - No se realizarán cambios reales');
  } else {
    console.log('⚠️ MODO EJECUCIÓN - Se realizarán cambios en la base de datos');
    console.log('   Presiona Ctrl+C para cancelar en los próximos 5 segundos...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // Fase 1: Migrar profesores
  console.log('\n📍 FASE 1: Migración de Profesores');
  const teachersReport = await migrateTeachersToNewSystem(dryRun);

  // Fase 2: Crear enrollments
  console.log('\n📍 FASE 2: Creación de Enrollments');
  const enrollmentsReport = await createEnrollmentsFromExistingRelations(dryRun);

  // Resumen final
  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMEN FINAL DE MIGRACIÓN');
  console.log('='.repeat(50));
  console.log(`👨‍🏫 Profesores convertidos: ${teachersReport.teachersConverted}`);
  console.log(`📝 Enrollments creados: ${enrollmentsReport.enrollmentsCreated}`);
  console.log(`❌ Total errores: ${teachersReport.errors.length + enrollmentsReport.errors.length}`);

  if (!dryRun) {
    console.log('\n✅ Migración completada exitosamente');
    console.log('💾 Checkpoints guardados:');
    console.log(`   - Profesores: ${teachersReport.checkpointId}`);
    console.log(`   - Enrollments: ${enrollmentsReport.checkpointId}`);
  }

  return {
    teachers: teachersReport,
    enrollments: enrollmentsReport
  };
}

// Registrar funciones en window para uso en consola
if (typeof window !== 'undefined') {
  (window as any).migrateTeachersToNewSystem = migrateTeachersToNewSystem;
  (window as any).createEnrollmentsFromExistingRelations = createEnrollmentsFromExistingRelations;
  (window as any).runFullMigration = runFullMigration;
  
  console.log('💡 Funciones de migración de enrollments disponibles:');
  console.log('   - window.migrateTeachersToNewSystem(dryRun = true)');
  console.log('   - window.createEnrollmentsFromExistingRelations(dryRun = true)');
  console.log('   - window.runFullMigration(dryRun = true)');
  console.log('\n   Usa dryRun=false para ejecutar cambios reales');
}