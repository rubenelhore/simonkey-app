import { db, doc, getDoc, updateDoc, collection, query, where, getDocs } from '../services/firebase';

export async function investigateStudentNotebooks() {
  const studentId = 'obdYcp6ui6aCVEiMYdohvE5EY7i1';
  const teacherId = 'bEK0qjvn3PepfHcmRBhHsQGseSA2';
  
  console.log('🔍 === INVESTIGANDO CUADERNOS DEL ESTUDIANTE ===');
  
  try {
    // 1. Obtener documento del estudiante
    console.log('📄 Obteniendo documento del estudiante:', studentId);
    const studentDoc = await getDoc(doc(db, 'users', studentId));
    
    if (!studentDoc.exists()) {
      console.error('❌ No se encontró el documento del estudiante');
      return;
    }
    
    const studentData = studentDoc.data();
    console.log('👤 Datos del estudiante:', {
      id: studentId,
      email: studentData.email,
      schoolRole: studentData.schoolRole,
      idCuadernos: studentData.idCuadernos,
      idEscuela: studentData.idEscuela
    });
    
    // 2. Verificar cada cuaderno asignado
    if (studentData.idCuadernos && studentData.idCuadernos.length > 0) {
      console.log('\n📚 Verificando cuadernos asignados:');
      for (const cuadernoId of studentData.idCuadernos) {
        const notebookDoc = await getDoc(doc(db, 'schoolNotebooks', cuadernoId));
        if (notebookDoc.exists()) {
          const notebookData = notebookDoc.data();
          console.log(`✅ Cuaderno ${cuadernoId} existe:`, {
            title: notebookData.title,
            idMateria: notebookData.idMateria,
            idProfesor: notebookData.idProfesor
          });
        } else {
          console.log(`❌ Cuaderno ${cuadernoId} NO EXISTE en la base de datos`);
        }
      }
    }
    
    // 3. Buscar cuadernos del profesor
    console.log('\n🔍 Buscando cuadernos creados por el profesor:', teacherId);
    const teacherNotebooksQuery = query(
      collection(db, 'schoolNotebooks'),
      where('idProfesor', '==', teacherId)
    );
    
    const teacherNotebooksSnap = await getDocs(teacherNotebooksQuery);
    const teacherNotebooks: any[] = [];
    
    teacherNotebooksSnap.forEach(doc => {
      const data = doc.data();
      teacherNotebooks.push({
        id: doc.id,
        title: data.title,
        idMateria: data.idMateria,
        conceptCount: data.concepts?.length || 0
      });
      console.log(`📓 Cuaderno del profesor:`, {
        id: doc.id,
        title: data.title,
        idMateria: data.idMateria
      });
    });
    
    // 4. Comparar y sugerir corrección
    console.log('\n📊 === ANÁLISIS ===');
    console.log('Cuadernos asignados al estudiante:', studentData.idCuadernos || []);
    console.log('Cuadernos del profesor:', teacherNotebooks.map(n => n.id));
    
    const validNotebookIds = teacherNotebooks.map(n => n.id);
    const currentIds = studentData.idCuadernos || [];
    const invalidIds = currentIds.filter((id: string) => !validNotebookIds.includes(id));
    const missingIds = validNotebookIds.filter((id: string) => !currentIds.includes(id));
    
    if (invalidIds.length > 0) {
      console.log('⚠️ IDs inválidos en el estudiante:', invalidIds);
    }
    
    if (missingIds.length > 0) {
      console.log('⚠️ IDs faltantes en el estudiante:', missingIds);
    }
    
    if (invalidIds.length > 0 || missingIds.length > 0) {
      console.log('\n✨ Se recomienda actualizar los cuadernos del estudiante');
      console.log('IDs correctos:', validNotebookIds);
      return {
        studentId,
        currentIds,
        validIds: validNotebookIds,
        invalidIds,
        missingIds,
        needsUpdate: true
      };
    } else {
      console.log('✅ Los cuadernos del estudiante están correctamente configurados');
      return {
        studentId,
        currentIds,
        validIds: validNotebookIds,
        needsUpdate: false
      };
    }
    
  } catch (error) {
    console.error('❌ Error investigando cuadernos:', error);
    return null;
  }
}

export async function fixStudentNotebooks() {
  console.log('🔧 === CORRIGIENDO CUADERNOS DEL ESTUDIANTE ===');
  
  const investigation = await investigateStudentNotebooks();
  
  if (!investigation) {
    console.error('❌ No se pudo investigar los cuadernos');
    return;
  }
  
  if (!investigation.needsUpdate) {
    console.log('✅ No se requieren cambios');
    return;
  }
  
  try {
    console.log('📝 Actualizando cuadernos del estudiante...');
    console.log('IDs a asignar:', investigation.validIds);
    
    await updateDoc(doc(db, 'users', investigation.studentId), {
      idCuadernos: investigation.validIds
    });
    
    console.log('✅ Cuadernos actualizados correctamente');
    console.log('El estudiante ahora tiene acceso a:', investigation.validIds.length, 'cuadernos');
    
    // Verificar la actualización
    const updatedDoc = await getDoc(doc(db, 'users', investigation.studentId));
    if (updatedDoc.exists()) {
      console.log('📋 Verificación - Cuadernos asignados:', updatedDoc.data().idCuadernos);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error actualizando cuadernos:', error);
    return false;
  }
}

// Hacer las funciones disponibles globalmente
if (typeof window !== 'undefined') {
  (window as any).investigateStudentNotebooks = investigateStudentNotebooks;
  (window as any).fixStudentNotebooks = fixStudentNotebooks;
  
  console.log('🔧 Funciones de reparación de cuadernos disponibles:');
  console.log('   - window.investigateStudentNotebooks() - Investiga el problema');
  console.log('   - window.fixStudentNotebooks() - Corrige los cuadernos del estudiante');
}