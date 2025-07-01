/**
 * Genera los comandos para ejecutar manualmente en Firebase Console
 */
export function generateFirebaseCommands() {
  const FIREBASE_UID = 'eLIAl0biR0fB01hKcgv1MH1CX2q1';
  const DOCUMENT_ID = 'school_1751333776472_ia0ly5vle';
  
  console.log('📋 === COMANDOS PARA FIREBASE CONSOLE ===');
  console.log('========================================');
  console.log('');
  console.log('⚠️ Debido a los permisos, necesitas ejecutar estos pasos manualmente en Firebase Console:');
  console.log('');
  console.log('1️⃣ VERIFICAR EL USUARIO:');
  console.log('   - Ve a: Firebase Console > Firestore Database');
  console.log('   - Colección: users');
  console.log(`   - Documento: ${DOCUMENT_ID}`);
  console.log('   - Verifica que tenga:');
  console.log('     • subscription: "school"');
  console.log('     • schoolRole: "teacher"');
  console.log(`     • googleAuthUid: "${FIREBASE_UID}"`);
  console.log('');
  console.log('2️⃣ BUSCAR MATERIAS MAL VINCULADAS:');
  console.log('   - Ve a la colección: schoolSubjects');
  console.log('   - Busca documentos donde:');
  console.log(`     • idProfesor == "${FIREBASE_UID}"`);
  console.log('');
  console.log('3️⃣ CORREGIR CADA MATERIA:');
  console.log('   Para cada materia encontrada:');
  console.log('   - Haz clic en el documento');
  console.log('   - Haz clic en "Edit document" (lápiz)');
  console.log(`   - Cambia idProfesor de: "${FIREBASE_UID}"`);
  console.log(`   - A: "${DOCUMENT_ID}"`);
  console.log('   - Guarda los cambios');
  console.log('');
  console.log('4️⃣ VERIFICAR CUADERNOS:');
  console.log('   - Ve a la colección: schoolNotebooks');
  console.log('   - Verifica que existan cuadernos con:');
  console.log('     • idMateria: [ID de las materias del paso 3]');
  console.log('');
  console.log('5️⃣ SI NO HAY MATERIAS:');
  console.log('   Si no encuentras materias en el paso 2:');
  console.log('   - El administrador debe crear materias');
  console.log('   - Asegúrate de que usen:');
  console.log(`     • idProfesor: "${DOCUMENT_ID}"`);
  console.log('     • NO uses el Firebase UID');
  console.log('');
  console.log('📝 QUERY PARA VERIFICAR EN FIRESTORE:');
  console.log('   Puedes usar esta query en la consola de Firestore:');
  console.log('   ```');
  console.log('   Collection: schoolSubjects');
  console.log('   Filter: idProfesor == "eLIAl0biR0fB01hKcgv1MH1CX2q1"');
  console.log('   ```');
  console.log('');
  console.log('✅ DESPUÉS DE CORREGIR:');
  console.log('   1. Cierra sesión en la aplicación');
  console.log('   2. Vuelve a iniciar sesión');
  console.log('   3. Los cuadernos deberían aparecer');
  console.log('');
  console.log('========================================');
}

// Función simplificada para copiar al portapapeles
export function copyTeacherFixInstructions() {
  const instructions = `
PROFESOR ID CORRECTO: school_1751333776472_ia0ly5vle
FIREBASE UID (INCORRECTO): eLIAl0biR0fB01hKcgv1MH1CX2q1

PASOS EN FIREBASE CONSOLE:
1. Ir a schoolSubjects
2. Buscar donde idProfesor = "eLIAl0biR0fB01hKcgv1MH1CX2q1"
3. Cambiar idProfesor a "school_1751333776472_ia0ly5vle"
4. Guardar cambios
`;
  
  console.log('📋 Instrucciones para copiar:');
  console.log(instructions);
  
  // Intentar copiar al portapapeles
  if (navigator.clipboard) {
    navigator.clipboard.writeText(instructions)
      .then(() => console.log('✅ Copiado al portapapeles'))
      .catch(() => console.log('❌ No se pudo copiar automáticamente'));
  }
}

// Hacer las funciones disponibles globalmente
if (typeof window !== 'undefined') {
  (window as any).generateFirebaseCommands = generateFirebaseCommands;
  (window as any).copyTeacherFixInstructions = copyTeacherFixInstructions;
}