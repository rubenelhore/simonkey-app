# Resumen de correcciones para IDs de usuarios escolares

## Problema identificado
Los datos de estudio (quiz, libre, inteligente) de estudiantes escolares se estaban guardando con IDs incorrectos (Firebase Auth UID) en lugar del ID del documento del usuario escolar (school_xxx).

## Correcciones aplicadas

### 1. useStudyService.ts
- Agregado import de `getEffectiveUserId`
- Creada función auxiliar `getEffectiveUserIdForService` que obtiene el ID correcto para usuarios escolares
- Actualizado en las siguientes funciones para usar el ID efectivo:
  - `createStudySession` - Crea sesiones de estudio
  - `updateConceptResponse` - Guarda learningData
  - `getReviewableConcepts` - Obtiene conceptos para repaso
  - `getLearningDataForNotebook` - Obtiene datos de aprendizaje
  - `checkFreeStudyLimit` - Verifica límites de estudio libre
  - `checkSmartStudyLimit` - Verifica límites de estudio inteligente
  - `updateFreeStudyUsage` - Actualiza uso de estudio libre
  - `updateSmartStudyUsage` - Actualiza uso de estudio inteligente
  - `updateUserStats` - Actualiza estadísticas del usuario

### 2. MiniQuiz.tsx
- Agregado import de `getEffectiveUserId`
- Actualizada la función de guardado para usar el ID efectivo al guardar miniQuizResults

### 3. QuizModePage.tsx
- Ya tenía implementado effectiveUserId pero se agregaron logs para debugging
- Se mantiene el uso consistente del effectiveUserId en todas las operaciones de guardado

### 4. StudyModePage.tsx
- Ya estaba usando effectiveUserId correctamente
- Pasa el ID correcto a StudyDashboard como prop

## Datos que ahora se guardan correctamente

1. **learningData** - Datos de aprendizaje de conceptos (en users/{schoolUserId}/learningData)
2. **studySessions** - Sesiones de estudio (con userId correcto en el documento)
3. **notebookLimits** - Límites de estudio por cuaderno (en users/{schoolUserId}/notebookLimits)
4. **stats** - Estadísticas de estudio (en users/{schoolUserId}/stats)
5. **quizResults** - Resultados de quiz (en users/{schoolUserId}/quizResults)
6. **quizStats** - Estadísticas de quiz (en users/{schoolUserId}/quizStats)
7. **miniQuizResults** - Resultados de mini quiz (en users/{schoolUserId}/miniQuizResults)

## Verificación
Para verificar que todo funciona correctamente:
1. Iniciar sesión con una cuenta de estudiante escolar
2. Realizar una sesión de estudio
3. Verificar en Firebase que los datos se guardan bajo el ID correcto (school_xxx) y no bajo el UID de Firebase Auth

## Nota importante
Esta corrección es crítica para mantener la integridad de los datos de los estudiantes escolares y asegurar que cada estudiante tenga su propio progreso independiente.