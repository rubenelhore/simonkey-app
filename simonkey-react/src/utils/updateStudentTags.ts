import { collection, getDocs, query, where, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * Actualiza todos los estudiantes existentes para agregar las etiquetas
 * subjectIds e institutionId basándose en sus cuadernos asignados
 */
export const updateExistingStudentTags = async () => {
  try {
    console.log('🚀 Iniciando actualización de etiquetas de estudiantes...');
    
    // Obtener todos los estudiantes
    const studentsQuery = query(
      collection(db, 'users'),
      where('subscription', '==', 'school'),
      where('schoolRole', '==', 'student')
    );
    
    const studentsSnapshot = await getDocs(studentsQuery);
    console.log(`📊 Encontrados ${studentsSnapshot.size} estudiantes para actualizar`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Procesar cada estudiante
    for (const studentDoc of studentsSnapshot.docs) {
      try {
        const studentData = studentDoc.data();
        const studentId = studentDoc.id;
        const idCuadernos = studentData.idCuadernos || [];
        
        // Si no tiene cuadernos, saltar
        if (idCuadernos.length === 0) {
          console.log(`⏭️ Estudiante ${studentData.nombre} no tiene cuadernos asignados`);
          continue;
        }
        
        const subjectIds = new Set<string>();
        let institutionId = studentData.institutionId || '';
        
        // Por cada cuaderno, obtener la materia y la institución
        for (const notebookId of idCuadernos) {
          try {
            const notebookDoc = await getDoc(doc(db, 'schoolNotebooks', notebookId));
            
            if (!notebookDoc.exists()) {
              console.warn(`⚠️ Cuaderno ${notebookId} no encontrado`);
              continue;
            }
            
            const notebookData = notebookDoc.data();
            const materiaId = notebookData.idMateria;
            
            if (!materiaId) {
              console.warn(`⚠️ Cuaderno ${notebookId} no tiene materia asignada`);
              continue;
            }
            
            // Agregar materia al set
            subjectIds.add(materiaId);
            
            // Si no tenemos institutionId aún, intentar obtenerlo
            if (!institutionId) {
              const materiaDoc = await getDoc(doc(db, 'schoolSubjects', materiaId));
              
              if (materiaDoc.exists()) {
                const materiaData = materiaDoc.data();
                const profesorId = materiaData.idProfesor;
                
                if (profesorId) {
                  const profesorDoc = await getDoc(doc(db, 'users', profesorId));
                  
                  if (profesorDoc.exists()) {
                    const profesorData = profesorDoc.data();
                    const adminId = profesorData.idAdmin;
                    
                    if (adminId) {
                      const adminDoc = await getDoc(doc(db, 'users', adminId));
                      
                      if (adminDoc.exists()) {
                        const adminData = adminDoc.data();
                        institutionId = adminData.idInstitucion || '';
                      }
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.error(`❌ Error procesando cuaderno ${notebookId}:`, error);
          }
        }
        
        // Actualizar el estudiante con las nuevas etiquetas
        const updateData: any = {
          subjectIds: Array.from(subjectIds)
        };
        
        if (institutionId) {
          updateData.institutionId = institutionId;
        }
        
        await updateDoc(doc(db, 'users', studentId), updateData);
        
        console.log(`✅ Estudiante ${studentData.nombre} actualizado:`, {
          subjectIds: Array.from(subjectIds),
          institutionId
        });
        
        successCount++;
      } catch (error) {
        console.error(`❌ Error actualizando estudiante ${studentDoc.id}:`, error);
        errorCount++;
      }
    }
    
    console.log(`
📊 Actualización completada:
   ✅ Éxito: ${successCount} estudiantes
   ❌ Errores: ${errorCount} estudiantes
   📚 Total procesado: ${studentsSnapshot.size} estudiantes
    `);
    
    return {
      success: successCount,
      errors: errorCount,
      total: studentsSnapshot.size
    };
  } catch (error) {
    console.error('❌ Error en la actualización masiva:', error);
    throw error;
  }
};

/**
 * Función para verificar las etiquetas de un estudiante específico
 */
export const verifyStudentTags = async (studentId: string) => {
  try {
    const studentDoc = await getDoc(doc(db, 'users', studentId));
    
    if (!studentDoc.exists()) {
      console.error('❌ Estudiante no encontrado');
      return null;
    }
    
    const studentData = studentDoc.data();
    console.log('📋 Datos del estudiante:', {
      nombre: studentData.nombre,
      idCuadernos: studentData.idCuadernos,
      subjectIds: studentData.subjectIds,
      institutionId: studentData.institutionId
    });
    
    return studentData;
  } catch (error) {
    console.error('❌ Error verificando estudiante:', error);
    throw error;
  }
};