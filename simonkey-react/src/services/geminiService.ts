/**
 * ⚠️ DEPRECADO: Este servicio ha sido migrado a Cloud Functions para mayor seguridad
 * 
 * Las llamadas directas a Gemini desde el frontend han sido reemplazadas por
 * Cloud Functions seguras que protegen las claves API y controlan el uso.
 * 
 * En su lugar, usa las funciones de /services/firebaseFunctions.ts:
 * - generateConcepts() - Para generar conceptos desde archivos
 * - explainConcept() - Para explicar conceptos
 * - generateContent() - Para generación general de contenido
 * 
 * Migración completada: ✅
 * Fecha de deprecación: [Fecha actual]
 * 
 * Beneficios de la migración:
 * ✅ Claves API protegidas en el servidor
 * ✅ Control de uso y límites por usuario
 * ✅ Autenticación y autorización
 * ✅ Mejor manejo de errores
 * ✅ Logging para auditoría
 * ✅ Cumplimiento de mejores prácticas de seguridad
 */

// Este archivo ya no debe ser usado
console.warn(
  '⚠️ geminiService.ts está deprecado. Usa las funciones de firebaseFunctions.ts en su lugar.'
);

export default null;