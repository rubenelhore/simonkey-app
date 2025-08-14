# Plan de Implementación de Reglas de Seguridad para Firestore - SimonKey

## 1. ESTRUCTURA DE COLECCIONES IDENTIFICADAS

### Colecciones Principales
```
├── users (colección principal de usuarios)
├── usuarios (legacy - compatibilidad)
├── notebooks (cuadernos personales y escolares)
├── conceptos (conceptos de estudio)
├── materias (materias personales)
├── studySessions (sesiones de estudio)
├── calendarEvents (eventos del calendario)
├── materials (archivos subidos)
├── userActivities (actividades del usuario)
├── reviewConcepts (conceptos en revisión)
├── conceptStats (estadísticas de conceptos)
├── learningData (datos de aprendizaje SM-3)
├── gameSessions (sesiones de juegos)
├── contactMessages (mensajes de contacto)
├── temporaryCredentials (credenciales temporales)
├── systemSettings (configuración del sistema)
├── systemLogs (logs del sistema)
```

### Colecciones Escolares
```
├── schoolInstitutions (instituciones educativas)
├── schoolAdmins (administradores escolares)
├── schoolTeachers (profesores)
├── schoolStudents (estudiantes)
├── schoolTutors (tutores)
├── schoolSubjects (materias escolares)
├── schoolNotebooks (cuadernos escolares)
├── schoolConcepts (conceptos escolares)
├── schoolExams (exámenes)
├── examAttempts (intentos de examen)
```

### Colecciones de Rankings y KPIs
```
├── userKPIs (indicadores clave de rendimiento)
├── userStreaks (rachas de estudio)
├── gamePoints (puntos de juegos)
├── notebookPoints (puntos por cuaderno)
├── quizStats (estadísticas de quiz)
├── positionHistory (historial de posiciones)
├── userActivityBatch (actividades en lote)
```

### Subcolecciones (dentro de users/{userId})
```
├── users/{userId}/
│   ├── notebookLimits (límites de cuadernos)
│   ├── learningData (datos de aprendizaje)
│   ├── migrationStatus (estado de migración)
│   ├── quizResults (resultados de quiz)
│   ├── miniQuizResults (resultados de mini quiz)
│   ├── limits (límites generales)
│   ├── quizStats (estadísticas de quiz)
│   ├── stats (estadísticas generales)
│   └── settings (configuraciones)
```

## 2. ROLES Y PERMISOS IDENTIFICADOS

### Tipos de Suscripción
1. **SUPER_ADMIN**
   - Email: ruben.elhore@gmail.com
   - Acceso total a todas las colecciones
   - Sin límites en recursos
   - Puede gestionar usuarios y sistema

2. **FREE**
   - Usuarios gratuitos por defecto
   - Máximo 4 cuadernos
   - Máximo 100 conceptos por cuaderno
   - No puede recrear cuadernos eliminados

3. **PRO**
   - Sin límite de cuadernos totales
   - Máximo 100 conceptos por cuaderno
   - Máximo 10 cuadernos por semana
   - Puede recrear cuadernos eliminados

4. **SCHOOL**
   - Usuarios escolares (admin, teacher, student, tutor)
   - Sin límites en cuadernos y conceptos
   - Acceso según rol escolar

5. **UNIVERSITY**
   - Usuarios universitarios
   - Sin límites en recursos
   - No usa sistema de estudio

### Roles Escolares
1. **admin**
   - Puede ver todos los datos de su institución
   - No puede editar contenido académico
   - Gestiona usuarios de su institución

2. **teacher**
   - Puede crear/editar materias y cuadernos
   - Puede crear exámenes
   - Ve datos de sus estudiantes

3. **student**
   - Acceso a cuadernos asignados
   - Puede estudiar y hacer exámenes
   - No puede crear/editar contenido

4. **tutor**
   - Ve progreso de estudiantes asignados
   - No puede editar contenido
   - Acceso de solo lectura

## 3. CAMPOS OBLIGATORIOS Y VALIDACIONES

### Colección `users`
```javascript
{
  id: string,           // UID de Firebase Auth
  email: string,        // Único, validado
  username: string,     // Único
  nombre: string,       // Requerido
  displayName: string,  // Requerido
  birthdate: string,    // Formato: YYYY-MM-DD
  subscription: enum,   // super_admin|free|pro|school|university
  notebookCount: number,// >= 0
  createdAt: timestamp, // Auto-generado
  
  // Campos opcionales según tipo
  schoolRole?: enum,    // admin|teacher|student|tutor
  idInstitucion?: string,
  idAdmin?: string,
  subjectIds?: array,
  idCuadernos?: array,
  requiresPasswordChange?: boolean,
  googleAuthUid?: string,
  linkedSchoolUserId?: string
}
```

### Colección `notebooks`
```javascript
{
  id: string,
  title: string,        // Requerido, max 100 chars
  color: string,        // Hex color
  type: enum,           // personal|school
  createdAt: timestamp,
  updatedAt: timestamp,
  conceptCount: number, // >= 0
  
  // Para notebooks personales
  userId?: string,      // Requerido si type=personal
  shareId?: string,     // Para compartir
  
  // Para notebooks escolares
  idMateria?: string,   // Requerido si type=school
  idEscuela?: string,
  idProfesor?: string,
  idAdmin?: string,
  
  // Sistema de congelación
  isFrozen?: boolean,
  frozenScore?: number,
  frozenAt?: timestamp,
  scheduledFreezeAt?: timestamp,
  scheduledUnfreezeAt?: timestamp
}
```

### Colección `conceptos`
```javascript
{
  id: string,
  término: string,      // Requerido, max 200 chars
  definición: string,   // Requerido, max 2000 chars
  fuente: string,       // Requerido
  cuadernoId: string,   // Requerido, referencia a notebook
  usuarioId: string,    // Requerido, owner
  index?: number,       // Orden en el cuaderno
  dominado?: boolean,   // Estado de dominio
  notasPersonales?: string,
  materialId?: string   // Referencia a material
}
```

### Colección `studySessions`
```javascript
{
  id: string,
  userId: string,       // Requerido
  notebookId: string,   // Requerido
  startTime: timestamp, // Requerido
  endTime: timestamp,   // Requerido al finalizar
  duration: number,     // Segundos
  mode: enum,          // smart|free|quiz
  conceptsReviewed: number,
  conceptsMastered: number,
  score?: number,
  completed: boolean
}
```

### Colección `schoolExams`
```javascript
{
  id: string,
  title: string,        // Requerido
  description?: string,
  idMateria: string,    // Requerido
  idProfesor: string,   // Requerido
  idEscuela: string,    // Requerido
  questions: array,     // Array de preguntas
  duration: number,     // Minutos
  startDate: timestamp,
  endDate: timestamp,
  isActive: boolean,
  createdAt: timestamp
}
```

### Colección `examAttempts`
```javascript
{
  id: string,
  examId: string,       // Requerido
  studentId: string,    // Requerido
  startTime: timestamp,
  endTime?: timestamp,
  answers: array,       // Respuestas del estudiante
  score?: number,       // Calculado al finalizar
  maxScore: number,
  completed: boolean,
  timeSpent?: number    // Segundos
}
```

## 4. PATRONES DE ACCESO IDENTIFICADOS

### Lectura (Read)
- **Usuarios**: Solo pueden leer su propio perfil
- **Notebooks personales**: Solo el propietario
- **Notebooks escolares**: Profesores, admins y estudiantes asignados
- **Conceptos**: Solo el propietario del cuaderno
- **Sesiones de estudio**: Solo el usuario que las creó
- **Exámenes**: Estudiantes de la materia
- **KPIs**: Solo el propio usuario

### Escritura (Create/Update)
- **Perfil de usuario**: Solo el propio usuario
- **Notebooks personales**: El propietario
- **Notebooks escolares**: Solo profesores
- **Conceptos**: Propietario del cuaderno
- **Sesiones de estudio**: Usuario autenticado
- **Exámenes**: Solo profesores
- **Intentos de examen**: Estudiantes autorizados

### Eliminación (Delete)
- **Usuarios**: Nunca permitido directamente
- **Notebooks**: Propietario o profesor (según tipo)
- **Conceptos**: Propietario del cuaderno
- **Sesiones**: No permitido (inmutables)
- **Exámenes**: Solo profesores

## 5. OPTIMIZACIONES NECESARIAS

### Performance
1. **Índices compuestos** para queries frecuentes:
   - `users`: (subscription, createdAt)
   - `studySessions`: (userId, startTime)
   - `notebooks`: (userId, type, createdAt)
   - `conceptos`: (cuadernoId, index)
   - `examAttempts`: (examId, studentId)

2. **Caching de permisos** usando funciones helper
3. **Minimizar lecturas** en reglas (usar exists() cuando sea posible)

### Seguridad
1. **Validación de tipos** en todos los campos
2. **Límites de tamaño** en strings y arrays
3. **Prevención de escalación de privilegios**
4. **Validación de referencias cruzadas**
5. **Rate limiting** para operaciones costosas

### Mantenibilidad
1. **Funciones reutilizables** para checks comunes
2. **Comentarios claros** en reglas complejas
3. **Versionado** de reglas
4. **Tests automatizados** con emulador

## 6. MIGRACIONES PENDIENTES

1. Unificar `usuarios` con `users`
2. Migrar `schoolNotebooks` a `notebooks` con type='school'
3. Migrar `schoolConcepts` a `conceptos`
4. Consolidar colecciones legacy

## 7. PLAN DE IMPLEMENTACIÓN

### Fase 1: Reglas Base (Inmediato)
- Implementar reglas para colecciones principales
- Asegurar autenticación básica
- Proteger datos sensibles

### Fase 2: Roles y Permisos (1 semana)
- Implementar sistema de roles completo
- Validar permisos escolares
- Testear con usuarios reales

### Fase 3: Validaciones (2 semanas)
- Agregar validación de campos
- Implementar límites por suscripción
- Validar referencias cruzadas

### Fase 4: Optimización (3 semanas)
- Crear índices necesarios
- Optimizar funciones helper
- Reducir lecturas en reglas

### Fase 5: Migración (1 mes)
- Migrar colecciones legacy
- Actualizar código de aplicación
- Eliminar reglas obsoletas

## 8. MÉTRICAS DE ÉXITO

- **0 brechas de seguridad** en auditoría
- **< 50ms** latencia promedio en reglas
- **100% cobertura** de colecciones
- **0 falsos negativos** en permisos válidos
- **100% tests pasando** en emulador