# Sistema de Réplicas Automáticas para Usuarios Escolares

## Resumen

Se ha implementado un sistema automático que crea réplicas de usuarios en las colecciones `schoolTeachers` y `schoolStudents` cuando se etiqueta a un usuario como profesor o estudiante respectivamente.

## Funcionalidades Implementadas

### 1. Creación Automática de Réplicas

#### Cuando se actualiza el rol escolar (`updateUserSchoolRole`):
- **Profesor**: Se crea automáticamente una réplica en `schoolTeachers`
- **Estudiante**: Se crea automáticamente una réplica en `schoolStudents`
- **Cambio de rol**: Se limpia la réplica anterior antes de crear la nueva

#### Cuando se actualiza la suscripción (`updateUserSubscription`):
- **Cambio a SCHOOL**: Si ya tiene un rol asignado, se crea la réplica correspondiente
- **Cambio de SCHOOL a otro tipo**: Se limpian las réplicas automáticamente

#### Cuando se elimina un usuario (`deleteUser`):
- Se limpian automáticamente todas las réplicas antes de eliminar el usuario

### 2. Funciones de Creación de Réplicas

#### `createTeacherReplica(userId, userData)`
- Verifica si ya existe en `schoolTeachers`
- Si existe, actualiza los datos
- Si no existe, crea un nuevo registro con:
  - ID del usuario
  - Nombre, email, password por defecto "1234"
  - Subscription: SCHOOL
  - Campos específicos para profesores

#### `createStudentReplica(userId, userData)`
- Verifica si ya existe en `schoolStudents`
- Si existe, actualiza los datos
- Si no existe, crea un nuevo registro con:
  - ID del usuario
  - Nombre, email, password por defecto "1234"
  - Subscription: SCHOOL
  - Campos específicos para estudiantes

### 3. Función de Limpieza

#### `cleanupUserReplicas(userId)`
- Elimina el usuario de `schoolTeachers` si existe
- Elimina el usuario de `schoolStudents` si existe
- Se ejecuta automáticamente al cambiar roles o eliminar usuarios

### 4. Migración de Usuarios Existentes

#### `migrateAllExistingSchoolUsers()`
- Busca usuarios con `schoolRole: 'teacher'` que no están en `schoolTeachers`
- Busca usuarios con `schoolRole: 'student'` que no están en `schoolStudents`
- Crea las réplicas faltantes automáticamente

### 5. Verificación y Diagnóstico

#### `checkUserSyncStatus(userId)`
- Verifica si un usuario existe en las tres colecciones
- Muestra el estado de sincronización
- Útil para diagnosticar problemas

#### `runCompleteReplicaTest()`
- Crea un usuario de prueba
- Verifica que las réplicas se crean correctamente
- Limpia los datos de prueba
- Confirma que el sistema funciona

## Archivos Modificados

### 1. `simonkey-react/src/pages/SuperAdminPage.tsx`
- **Funciones modificadas**:
  - `updateUserSubscription()`: Agregada lógica de réplicas
  - `updateUserSchoolRole()`: Agregada lógica de réplicas
  - `deleteUser()`: Agregada limpieza de réplicas

- **Funciones nuevas**:
  - `createTeacherReplica()`: Crea réplica de profesor
  - `createStudentReplica()`: Crea réplica de estudiante
  - `cleanupUserReplicas()`: Limpia réplicas
  - `handleMigrateAllExistingSchoolUsers()`: Migra usuarios existentes
  - `handleCheckUserSyncStatus()`: Verifica estado de usuario
  - `handleTestReplicaSystem()`: Prueba el sistema

- **Botones nuevos en la interfaz**:
  - "Migrar Todos los Usuarios Escolares"
  - "Verificar Estado de Usuario"
  - "Probar Sistema de Réplicas"

### 2. `simonkey-react/src/utils/migrateExistingSchoolUsers.ts` (NUEVO)
- `migrateExistingTeachers()`: Migra profesores existentes
- `migrateExistingStudents()`: Migra estudiantes existentes
- `migrateAllExistingSchoolUsers()`: Migra todos los usuarios
- `checkUserSyncStatus()`: Verifica estado de sincronización

### 3. `simonkey-react/src/utils/testReplicaSystem.ts` (NUEVO)
- `createTestUserForReplica()`: Crea usuario de prueba
- `verifyReplicaCreation()`: Verifica réplicas
- `cleanupTestData()`: Limpia datos de prueba
- `runCompleteReplicaTest()`: Prueba completa del sistema

## Flujo de Funcionamiento

### 1. Usuario Nuevo
1. Se crea usuario en `users` con `subscription: SCHOOL` y `schoolRole: TEACHER/STUDENT`
2. Automáticamente se crea réplica en `schoolTeachers` o `schoolStudents`

### 2. Cambio de Rol
1. Se actualiza `schoolRole` en `users`
2. Se limpia réplica anterior (si existe)
3. Se crea nueva réplica en colección correspondiente

### 3. Cambio de Suscripción
1. **A SCHOOL**: Si tiene rol, se crea réplica
2. **De SCHOOL a otro**: Se limpian réplicas

### 4. Eliminación de Usuario
1. Se limpian todas las réplicas
2. Se elimina el usuario

## Beneficios

1. **Consistencia**: Garantiza que todos los usuarios escolares tengan réplicas
2. **Automatización**: No requiere intervención manual
3. **Integridad**: Mantiene sincronización entre colecciones
4. **Diagnóstico**: Herramientas para verificar el estado
5. **Migración**: Facilita la migración de usuarios existentes

## Uso

### Para Usuarios Existentes
1. Ir a SuperAdminPage → Tab "Sincronización Escolar"
2. Hacer clic en "Migrar Todos los Usuarios Escolares"
3. Verificar resultados

### Para Verificar Estado
1. Ir a SuperAdminPage → Tab "Sincronización Escolar"
2. Hacer clic en "Verificar Estado de Usuario"
3. Ingresar ID del usuario

### Para Probar el Sistema
1. Ir a SuperAdminPage → Tab "Sincronización Escolar"
2. Hacer clic en "Probar Sistema de Réplicas"
3. Revisar resultados

## Notas Importantes

- Las réplicas se crean con password por defecto "1234"
- Los campos `idAdmin`, `idTeacher`, `idNotebook` se dejan vacíos para vinculación posterior
- El sistema es idempotente: no crea duplicados si ya existen
- Se mantienen logs detallados en la consola para debugging
- Las funciones de limpieza no lanzan errores para no interrumpir procesos principales 