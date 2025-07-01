import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  getDoc,
  writeBatch,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../services/firebase';

interface MigrationResult {
  success: boolean;
  migratedCount: number;
  errors: string[];
  details: {
    students: number;
    teachers: number;
    admins: number;
    tutors: number;
  };
}

export async function migrateSchoolCollectionsToUsers(dryRun: boolean = true): Promise<MigrationResult> {
  console.log(`🚀 Starting school collections migration ${dryRun ? '(DRY RUN)' : '(LIVE)'}`);
  
  const result: MigrationResult = {
    success: true,
    migratedCount: 0,
    errors: [],
    details: {
      students: 0,
      teachers: 0,
      admins: 0,
      tutors: 0
    }
  };

  try {
    // Migrate schoolStudents
    console.log('\n📚 Migrating schoolStudents...');
    const studentsResult = await migrateSchoolStudents(dryRun);
    result.details.students = studentsResult.count;
    result.errors.push(...studentsResult.errors);

    // Migrate schoolTeachers
    console.log('\n👨‍🏫 Migrating schoolTeachers...');
    const teachersResult = await migrateSchoolTeachers(dryRun);
    result.details.teachers = teachersResult.count;
    result.errors.push(...teachersResult.errors);

    // Migrate schoolAdmins
    console.log('\n🏛️ Migrating schoolAdmins...');
    const adminsResult = await migrateSchoolAdmins(dryRun);
    result.details.admins = adminsResult.count;
    result.errors.push(...adminsResult.errors);

    // Migrate schoolTutors
    console.log('\n👥 Migrating schoolTutors...');
    const tutorsResult = await migrateSchoolTutors(dryRun);
    result.details.tutors = tutorsResult.count;
    result.errors.push(...tutorsResult.errors);

    // Calculate total
    result.migratedCount = 
      result.details.students + 
      result.details.teachers + 
      result.details.admins + 
      result.details.tutors;

    result.success = result.errors.length === 0;

    // Summary
    console.log('\n📊 Migration Summary:');
    console.log(`✅ Total migrated: ${result.migratedCount}`);
    console.log(`  - Students: ${result.details.students}`);
    console.log(`  - Teachers: ${result.details.teachers}`);
    console.log(`  - Admins: ${result.details.admins}`);
    console.log(`  - Tutors: ${result.details.tutors}`);
    
    if (result.errors.length > 0) {
      console.log(`\n❌ Errors (${result.errors.length}):`);
      result.errors.forEach(error => console.log(`  - ${error}`));
    }

    if (dryRun) {
      console.log('\n⚠️  This was a DRY RUN. No data was actually modified.');
      console.log('Run with dryRun=false to perform the actual migration.');
    }

  } catch (error) {
    console.error('❌ Critical error during migration:', error);
    result.success = false;
    result.errors.push(`Critical error: ${error instanceof Error ? error.message : String(error)}`);
  }

  return result;
}

async function migrateSchoolStudents(dryRun: boolean): Promise<{ count: number; errors: string[] }> {
  const errors: string[] = [];
  let count = 0;

  try {
    const studentsSnapshot = await getDocs(collection(db, 'schoolStudents'));
    const batch = writeBatch(db);
    let batchCount = 0;

    for (const studentDoc of studentsSnapshot.docs) {
      try {
        const studentData = studentDoc.data();
        const userId = studentDoc.id;

        // Check if user already exists
        const userRef = doc(db, 'users', userId);
        const existingUser = await getDoc(userRef);

        const userData = {
          id: userId,
          email: studentData.email,
          username: studentData.nombre,
          nombre: studentData.nombre,
          displayName: studentData.nombre,
          subscription: 'school',
          schoolRole: 'student',
          
          // Student-specific fields
          idCuadernos: studentData.idCuadernos || [],
          
          // Timestamps
          createdAt: studentData.createdAt || Timestamp.now(),
          updatedAt: Timestamp.now(),
          
          // Migration metadata
          migratedFrom: 'schoolStudents',
          migrationDate: Timestamp.now()
        };

        if (existingUser.exists()) {
          // Merge with existing data
          const existingData = existingUser.data();
          const mergedData = {
            ...existingData,
            ...userData,
            // Preserve certain fields from existing user
            googleAuthUid: existingData.googleAuthUid,
            googleAuthEmail: existingData.googleAuthEmail,
            photoURL: existingData.photoURL,
            // Merge arrays
            idCuadernos: [...new Set([...(existingData.idCuadernos || []), ...(userData.idCuadernos || [])])]
          };
          
          if (!dryRun) {
            batch.update(userRef, mergedData);
          }
          console.log(`  📝 Updating existing user: ${userId} (${studentData.nombre})`);
        } else {
          // Create new user
          if (!dryRun) {
            batch.set(userRef, userData);
          }
          console.log(`  ✨ Creating new user: ${userId} (${studentData.nombre})`);
        }

        count++;
        batchCount++;

        // Commit batch every 400 operations (Firestore limit is 500)
        if (batchCount >= 400) {
          if (!dryRun) {
            await batch.commit();
          }
          batchCount = 0;
        }

      } catch (error) {
        const errorMsg = `Failed to migrate student ${studentDoc.id}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`  ❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    // Commit remaining operations
    if (batchCount > 0 && !dryRun) {
      await batch.commit();
    }

  } catch (error) {
    const errorMsg = `Failed to read schoolStudents collection: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`❌ ${errorMsg}`);
    errors.push(errorMsg);
  }

  return { count, errors };
}

async function migrateSchoolTeachers(dryRun: boolean): Promise<{ count: number; errors: string[] }> {
  const errors: string[] = [];
  let count = 0;

  try {
    const teachersSnapshot = await getDocs(collection(db, 'schoolTeachers'));
    const batch = writeBatch(db);
    let batchCount = 0;

    for (const teacherDoc of teachersSnapshot.docs) {
      try {
        const teacherData = teacherDoc.data();
        const userId = teacherDoc.id;

        const userRef = doc(db, 'users', userId);
        const existingUser = await getDoc(userRef);

        const userData = {
          id: userId,
          email: teacherData.email,
          username: teacherData.nombre,
          nombre: teacherData.nombre,
          displayName: teacherData.nombre,
          subscription: 'school',
          schoolRole: 'teacher',
          
          // Teacher-specific fields
          idAdmin: teacherData.idAdmin,
          
          // Timestamps
          createdAt: teacherData.createdAt || Timestamp.now(),
          updatedAt: Timestamp.now(),
          
          // Migration metadata
          migratedFrom: 'schoolTeachers',
          migrationDate: Timestamp.now()
        };

        if (existingUser.exists()) {
          const existingData = existingUser.data();
          const mergedData = {
            ...existingData,
            ...userData,
            googleAuthUid: existingData.googleAuthUid,
            googleAuthEmail: existingData.googleAuthEmail,
            photoURL: existingData.photoURL
          };
          
          if (!dryRun) {
            batch.update(userRef, mergedData);
          }
          console.log(`  📝 Updating existing user: ${userId} (${teacherData.nombre})`);
        } else {
          if (!dryRun) {
            batch.set(userRef, userData);
          }
          console.log(`  ✨ Creating new user: ${userId} (${teacherData.nombre})`);
        }

        count++;
        batchCount++;

        if (batchCount >= 400) {
          if (!dryRun) {
            await batch.commit();
          }
          batchCount = 0;
        }

      } catch (error) {
        const errorMsg = `Failed to migrate teacher ${teacherDoc.id}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`  ❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    if (batchCount > 0 && !dryRun) {
      await batch.commit();
    }

  } catch (error) {
    const errorMsg = `Failed to read schoolTeachers collection: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`❌ ${errorMsg}`);
    errors.push(errorMsg);
  }

  return { count, errors };
}

async function migrateSchoolAdmins(dryRun: boolean): Promise<{ count: number; errors: string[] }> {
  const errors: string[] = [];
  let count = 0;

  try {
    const adminsSnapshot = await getDocs(collection(db, 'schoolAdmins'));
    const batch = writeBatch(db);
    let batchCount = 0;

    for (const adminDoc of adminsSnapshot.docs) {
      try {
        const adminData = adminDoc.data();
        const userId = adminDoc.id;

        const userRef = doc(db, 'users', userId);
        const existingUser = await getDoc(userRef);

        const userData = {
          id: userId,
          email: adminData.email,
          username: adminData.nombre,
          nombre: adminData.nombre,
          displayName: adminData.nombre,
          subscription: 'school',
          schoolRole: 'admin',
          
          // Admin-specific fields
          idInstitucion: adminData.idInstitucion,
          
          // Timestamps
          createdAt: adminData.createdAt || Timestamp.now(),
          updatedAt: Timestamp.now(),
          
          // Migration metadata
          migratedFrom: 'schoolAdmins',
          migrationDate: Timestamp.now()
        };

        if (existingUser.exists()) {
          const existingData = existingUser.data();
          const mergedData = {
            ...existingData,
            ...userData,
            googleAuthUid: existingData.googleAuthUid,
            googleAuthEmail: existingData.googleAuthEmail,
            photoURL: existingData.photoURL
          };
          
          if (!dryRun) {
            batch.update(userRef, mergedData);
          }
          console.log(`  📝 Updating existing user: ${userId} (${adminData.nombre})`);
        } else {
          if (!dryRun) {
            batch.set(userRef, userData);
          }
          console.log(`  ✨ Creating new user: ${userId} (${adminData.nombre})`);
        }

        count++;
        batchCount++;

        if (batchCount >= 400) {
          if (!dryRun) {
            await batch.commit();
          }
          batchCount = 0;
        }

      } catch (error) {
        const errorMsg = `Failed to migrate admin ${adminDoc.id}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`  ❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    if (batchCount > 0 && !dryRun) {
      await batch.commit();
    }

  } catch (error) {
    const errorMsg = `Failed to read schoolAdmins collection: ${error.message}`;
    console.error(`❌ ${errorMsg}`);
    errors.push(errorMsg);
  }

  return { count, errors };
}

async function migrateSchoolTutors(dryRun: boolean): Promise<{ count: number; errors: string[] }> {
  const errors: string[] = [];
  let count = 0;

  try {
    const tutorsSnapshot = await getDocs(collection(db, 'schoolTutors'));
    const batch = writeBatch(db);
    let batchCount = 0;

    for (const tutorDoc of tutorsSnapshot.docs) {
      try {
        const tutorData = tutorDoc.data();
        const userId = tutorDoc.id;

        const userRef = doc(db, 'users', userId);
        const existingUser = await getDoc(userRef);

        const userData = {
          id: userId,
          email: tutorData.email,
          username: tutorData.nombre,
          nombre: tutorData.nombre,
          displayName: tutorData.nombre,
          subscription: 'school',
          schoolRole: 'tutor',
          
          // Tutor-specific fields
          idAlumnos: tutorData.idAlumnos || [],
          
          // Timestamps
          createdAt: tutorData.createdAt || Timestamp.now(),
          updatedAt: Timestamp.now(),
          
          // Migration metadata
          migratedFrom: 'schoolTutors',
          migrationDate: Timestamp.now()
        };

        if (existingUser.exists()) {
          const existingData = existingUser.data();
          const mergedData = {
            ...existingData,
            ...userData,
            googleAuthUid: existingData.googleAuthUid,
            googleAuthEmail: existingData.googleAuthEmail,
            photoURL: existingData.photoURL,
            idAlumnos: [...new Set([...(existingData.idAlumnos || []), ...(userData.idAlumnos || [])])]
          };
          
          if (!dryRun) {
            batch.update(userRef, mergedData);
          }
          console.log(`  📝 Updating existing user: ${userId} (${tutorData.nombre})`);
        } else {
          if (!dryRun) {
            batch.set(userRef, userData);
          }
          console.log(`  ✨ Creating new user: ${userId} (${tutorData.nombre})`);
        }

        count++;
        batchCount++;

        if (batchCount >= 400) {
          if (!dryRun) {
            await batch.commit();
          }
          batchCount = 0;
        }

      } catch (error) {
        const errorMsg = `Failed to migrate tutor ${tutorDoc.id}: ${error.message}`;
        console.error(`  ❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    if (batchCount > 0 && !dryRun) {
      await batch.commit();
    }

  } catch (error) {
    const errorMsg = `Failed to read schoolTutors collection: ${error.message}`;
    console.error(`❌ ${errorMsg}`);
    errors.push(errorMsg);
  }

  return { count, errors };
}

// Helper function to run migration from console
(window as any).migrateSchoolCollections = async (dryRun: boolean = true) => {
  return await migrateSchoolCollectionsToUsers(dryRun);
};