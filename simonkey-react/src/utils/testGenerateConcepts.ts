import { generateConceptsFromFile } from '../services/firebaseFunctions';

/**
 * Función de prueba para verificar si generateConceptsFromFile funciona con usuarios escolares
 * Para usar en la consola del navegador: window.testGenerateConceptsForTeacher()
 */
export async function testGenerateConceptsForTeacher() {
  console.log('🧪 === TEST: Generate Concepts for School Teacher ===');
  
  try {
    // Crear un archivo de prueba simple
    const testContent = btoa(`
      Pregunta: ¿Cuál es la capital de Francia?
      Respuesta: París es la capital de Francia.
      
      Pregunta: ¿Cuántos continentes hay?
      Respuesta: Hay 7 continentes en el mundo.
    `);
    
    console.log('📄 Enviando archivo de prueba...');
    
    const result = await generateConceptsFromFile({
      fileContent: testContent,
      notebookId: 'test-notebook-id',
      fileName: 'test.txt',
      isSchoolNotebook: true,
      fileType: 'text'
    });
    
    console.log('✅ Resultado:', result);
    console.log('🎉 La función está funcionando correctamente para profesores escolares!');
    
    return result;
  } catch (error: any) {
    console.error('❌ Error en la prueba:', error);
    console.error('💡 Detalles del error:', {
      message: error.message,
      code: error.code,
      details: error.details
    });
    
    if (error.message?.includes('Usuario no encontrado')) {
      console.log('⚠️ El error "Usuario no encontrado" indica que las funciones aún no están actualizadas');
      console.log('💡 Espera unos minutos y vuelve a intentar');
    }
    
    throw error;
  }
}

// Hacer la función disponible globalmente
if (typeof window !== 'undefined') {
  (window as any).testGenerateConceptsForTeacher = testGenerateConceptsForTeacher;
}