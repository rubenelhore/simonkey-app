import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';

/**
 * Función para probar la llamada a Firebase Functions
 */
export const testFirebaseFunction = async () => {
  console.log('🔧 === PROBANDO FIREBASE FUNCTIONS ===');
  
  try {
    const app = getApp();
    const functions = getFunctions(app, 'us-central1');
    
    // Intentar llamar a la función con datos mínimos
    const generateConceptsFromFile = httpsCallable(functions, 'generateConceptsFromFile');
    
    console.log('📡 Intentando llamar a generateConceptsFromFile...');
    
    // Datos de prueba mínimos
    const testData = {
      fileContent: 'Test content',
      notebookId: 'test-notebook',
      fileName: 'test.txt',
      isSchoolNotebook: false,
      fileType: 'text'
    };
    
    console.log('📦 Datos de prueba:', testData);
    
    try {
      const result = await generateConceptsFromFile(testData);
      console.log('✅ Respuesta exitosa:', result);
    } catch (error: any) {
      console.error('❌ Error al llamar la función:', error);
      console.error('  - Código:', error.code);
      console.error('  - Mensaje:', error.message);
      console.error('  - Detalles:', error.details);
      
      if (error.code === 'functions/not-found') {
        console.log('⚠️ La función no se encuentra en la URL esperada');
        console.log('💡 Posibles causas:');
        console.log('  1. La función está en v2 pero se está llamando como v1');
        console.log('  2. La región es incorrecta');
        console.log('  3. El nombre de la función es incorrecto');
      }
    }
    
  } catch (error) {
    console.error('❌ Error general:', error);
  }
};

// Función alternativa para probar con fetch directo
export const testFunctionDirectly = async () => {
  console.log('🔧 === PROBANDO FUNCIÓN DIRECTAMENTE ===');
  
  try {
    // URL para funciones v2
    const v2Url = 'https://generateconceptsfromfile-xktrwmtqea-uc.a.run.app';
    
    console.log('📡 Probando URL v2:', v2Url);
    
    const response = await fetch(v2Url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          fileContent: 'Test',
          notebookId: 'test',
          fileName: 'test.txt',
          isSchoolNotebook: false,
          fileType: 'text'
        }
      })
    });
    
    console.log('📊 Respuesta HTTP:', response.status, response.statusText);
    
    if (!response.ok) {
      const text = await response.text();
      console.log('❌ Respuesta de error:', text);
    } else {
      const data = await response.json();
      console.log('✅ Respuesta exitosa:', data);
    }
    
  } catch (error) {
    console.error('❌ Error en fetch directo:', error);
  }
};

// Hacer las funciones disponibles globalmente
if (typeof window !== 'undefined') {
  (window as any).testFirebaseFunction = testFirebaseFunction;
  (window as any).testFunctionDirectly = testFunctionDirectly;
  console.log('🔧 Funciones testFirebaseFunction() y testFunctionDirectly() disponibles en la consola');
}