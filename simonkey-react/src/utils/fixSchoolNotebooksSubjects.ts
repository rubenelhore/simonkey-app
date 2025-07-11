import { db } from '../services/firebase';
import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';

interface InstitutionSubject {
  id: string;
  nombre?: string;
  name?: string;
  institutionId: string;
  [key: string]: any;
}

export async function analyzeSchoolNotebooksSubjects(studentId: string) {
  console.log('🔍 === ANALIZANDO CUADERNOS Y MATERIAS ESCOLARES ===');
  console.log('📌 ID del estudiante:', studentId);
  
  try {
    // 1. Obtener el usuario
    const userDoc = await getDoc(doc(db, 'users', studentId));
    if (!userDoc.exists()) {
      console.error('❌ Usuario no encontrado');
      return;
    }
    
    const userData = userDoc.data();
    console.log('\n📚 Datos del usuario:');
    console.log('- idCuadernos:', userData.idCuadernos);
    console.log('- subjectIds:', userData.subjectIds);
    console.log('- idInstitucion:', userData.idInstitucion);
    
    // 2. Analizar materias del usuario
    const subjectIds = userData.subjectIds || [];
    console.log('\n📚 Analizando materias del estudiante...');
    
    const subjectsMap = new Map<string, any>();
    for (const subjectId of subjectIds) {
      const subjectDoc = await getDoc(doc(db, 'schoolSubjects', subjectId));
      if (subjectDoc.exists()) {
        const subjectData = subjectDoc.data();
        subjectsMap.set(subjectId, subjectData);
        console.log(`✅ Materia ${subjectId}: ${subjectData.nombre || subjectData.name}`);
      } else {
        console.log(`❌ Materia ${subjectId} no encontrada`);
      }
    }
    
    // 3. Analizar cuadernos del usuario
    console.log('\n📚 Analizando cuadernos del estudiante...');
    const notebookIds = userData.idCuadernos || [];
    
    interface NotebookIssue {
      id: string;
      title: string;
      data: any;
    }
    
    const notebooksWithIssues: NotebookIssue[] = [];
    for (const notebookId of notebookIds) {
      const notebookDoc = await getDoc(doc(db, 'schoolNotebooks', notebookId));
      if (notebookDoc.exists()) {
        const notebookData = notebookDoc.data();
        console.log(`\n📓 Cuaderno: ${notebookData.title}`);
        console.log(`   - ID: ${notebookId}`);
        console.log(`   - idMateria: ${notebookData.idMateria || 'NO TIENE ❌'}`);
        console.log(`   - subjectId (legacy): ${notebookData.subjectId || 'N/A'}`);
        console.log(`   - institutionId: ${notebookData.institutionId}`);
        
        if (!notebookData.idMateria && !notebookData.subjectId) {
          notebooksWithIssues.push({
            id: notebookId,
            title: notebookData.title,
            data: notebookData
          });
        }
      }
    }
    
    // 4. Verificar si la institución tiene materias definidas
    if (userData.idInstitucion) {
      console.log('\n🏫 Verificando materias de la institución...');
      const institutionDoc = await getDoc(doc(db, 'schoolInstitutions', userData.idInstitucion));
      if (institutionDoc.exists()) {
        const institutionData = institutionDoc.data();
        console.log('Institución:', institutionData.nombre);
        
        // Buscar todas las materias de la institución
        const subjectsQuery = collection(db, 'schoolSubjects');
        const subjectsSnap = await getDocs(subjectsQuery);
        
        const institutionSubjects: InstitutionSubject[] = [];
        subjectsSnap.forEach(doc => {
          const data = doc.data();
          if (data.institutionId === userData.idInstitucion) {
            institutionSubjects.push({
              id: doc.id,
              ...data
            } as InstitutionSubject);
          }
        });
        
        console.log(`\nMaterias de la institución (${institutionSubjects.length}):`);
        institutionSubjects.forEach(subject => {
          console.log(`- ${subject.id}: ${subject.nombre || subject.name}`);
        });
      }
    }
    
    // 5. Sugerencias
    console.log('\n💡 ANÁLISIS Y RECOMENDACIONES:');
    
    if (notebooksWithIssues.length > 0) {
      console.log(`\n⚠️ Hay ${notebooksWithIssues.length} cuadernos sin subjectId asignado:`);
      notebooksWithIssues.forEach(nb => {
        console.log(`- ${nb.title} (${nb.id})`);
      });
      
      console.log('\n🔧 SOLUCIÓN:');
      console.log('Los cuadernos escolares deben tener un subjectId asignado para generar KPIs por materia.');
      console.log('Esto normalmente se asigna cuando el profesor crea el cuaderno.');
      
      // Intentar hacer match por nombre
      console.log('\n🔍 Intentando hacer match automático por nombre...');
      notebooksWithIssues.forEach(notebook => {
        const title = notebook.title.toLowerCase();
        
        // Buscar materia que coincida por nombre
        let matchedSubject: { id: string; data: InstitutionSubject } | null = null;
        subjectsMap.forEach((subjectData, subjectId) => {
          const subjectName = (subjectData.nombre || subjectData.name || '').toLowerCase();
          if (title.includes(subjectName) || subjectName.includes(title)) {
            matchedSubject = { id: subjectId, data: subjectData };
          }
        });
        
        if (matchedSubject !== null) {
          const subject = matchedSubject as { id: string; data: InstitutionSubject };
          console.log(`\n✅ Posible match para "${notebook.title}":`);
          console.log(`   Materia: ${subject.data.nombre || subject.data.name} (${subject.id})`);
          console.log(`   Para asignar, ejecuta:`);
          console.log(`   await assignSubjectToNotebook('${notebook.id}', '${subject.id}')`);
        } else {
          console.log(`\n❌ No se encontró match automático para "${notebook.title}"`);
        }
      });
    } else if (notebookIds.length === 0) {
      console.log('❌ El estudiante no tiene cuadernos asignados');
    } else {
      console.log('✅ Todos los cuadernos tienen subjectId asignado correctamente');
    }
    
    if (subjectIds.length === 0) {
      console.log('\n⚠️ El estudiante no tiene materias asignadas (subjectIds vacío)');
    }
    
  } catch (error) {
    console.error('❌ Error analizando cuadernos y materias:', error);
  }
}

// Función para asignar una materia a un cuaderno
export async function assignSubjectToNotebook(notebookId: string, subjectId: string) {
  try {
    console.log(`\n🔧 Asignando materia ${subjectId} al cuaderno ${notebookId}...`);
    
    // Verificar que el cuaderno existe
    const notebookDoc = await getDoc(doc(db, 'schoolNotebooks', notebookId));
    if (!notebookDoc.exists()) {
      console.error('❌ El cuaderno no existe');
      return false;
    }
    
    // Verificar que la materia existe
    const subjectDoc = await getDoc(doc(db, 'schoolSubjects', subjectId));
    if (!subjectDoc.exists()) {
      console.error('❌ La materia no existe');
      return false;
    }
    
    // Actualizar el cuaderno
    await updateDoc(doc(db, 'schoolNotebooks', notebookId), {
      subjectId: subjectId
    });
    
    console.log('✅ Materia asignada exitosamente');
    console.log(`   Cuaderno: ${notebookDoc.data().title}`);
    console.log(`   Materia: ${subjectDoc.data().nombre || subjectDoc.data().name}`);
    
    return true;
  } catch (error) {
    console.error('❌ Error asignando materia:', error);
    return false;
  }
}

// Hacer las funciones disponibles globalmente
if (typeof window !== 'undefined') {
  (window as any).analyzeSchoolNotebooksSubjects = analyzeSchoolNotebooksSubjects;
  (window as any).assignSubjectToNotebook = assignSubjectToNotebook;
}