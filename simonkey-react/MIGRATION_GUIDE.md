# Guía de Migración: Consolidación de Colecciones Escolares

Esta guía detalla los pasos para migrar de múltiples colecciones escolares (schoolStudents, schoolTeachers, schoolAdmins, schoolTutors) a una única colección `users`.

## 📋 Resumen de Cambios

### Antes:
- `schoolStudents` - Almacenaba estudiantes
- `schoolTeachers` - Almacenaba profesores  
- `schoolAdmins` - Almacenaba administradores
- `schoolTutors` - Almacenaba tutores

### Después:
- `users` - Almacena todos los usuarios con campo `schoolRole` para diferenciar

## 🚀 Pasos de Migración

### 1. Crear Índices en Firestore

Ejecuta el siguiente comando para crear los índices necesarios:

```bash
firebase deploy --only firestore:indexes
```

O manualmente en la consola de Firebase:

1. Ve a Firestore Database → Indexes
2. Crea los siguientes índices compuestos para la colección `users`:

   - `subscription (ASC)` + `schoolRole (ASC)`
   - `subscription (ASC)` + `schoolRole (ASC)` + `idInstitucion (ASC)`
   - `subscription (ASC)` + `schoolRole (ASC)` + `idAdmin (ASC)`
   - `subscription (ASC)` + `schoolRole (ASC)` + `createdAt (DESC)`

### 2. Actualizar Reglas de Firestore

1. Haz backup de tu archivo `firestore.rules` actual
2. Reemplaza el contenido con `firestore.rules.new`
3. Despliega las nuevas reglas:

```bash
firebase deploy --only firestore:rules
```

### 3. Ejecutar la Migración

#### Opción A: Desde el Panel de Super Admin

1. Inicia sesión como Super Admin
2. Ve a la sección "Herramientas de Sincronización"
3. Busca "Migración de Colecciones Escolares"
4. Ejecuta primero un **Dry Run** para ver qué se migrará
5. Revisa los resultados
6. Si todo se ve bien, ejecuta la **Migración Real**

#### Opción B: Desde la Consola del Navegador

1. Abre la consola de desarrollador (F12)
2. Ejecuta:

```javascript
// Dry run primero
await window.migrateSchoolCollections(true);

// Si todo está bien, ejecutar migración real
await window.migrateSchoolCollections(false);
```

### 4. Verificar la Migración

Después de la migración, verifica:

1. **En Firestore Console:**
   - Los usuarios migrados están en la colección `users`
   - Tienen el campo `schoolRole` correcto
   - Mantienen sus relaciones (idCuadernos, idAdmin, etc.)

2. **En la Aplicación:**
   - Los usuarios pueden iniciar sesión normalmente
   - Los estudiantes ven sus cuadernos asignados
   - Los profesores pueden gestionar sus materias
   - Los permisos funcionan correctamente

### 5. Actualizar el Código (Ya completado)

Los siguientes archivos han sido actualizados:

- ✅ `userService.ts` - checkUserExistsByEmail ahora busca solo en users
- ✅ `useSchoolStudentData.ts` - Lee datos desde users
- ✅ `SchoolCreation.tsx` - Crea usuarios en la colección unificada
- ✅ Reglas de Firestore actualizadas

## 🔄 Rollback (Si es necesario)

Si necesitas revertir:

1. Restaura el backup de `firestore.rules`
2. Las colecciones originales school* siguen intactas
3. Revertir los cambios de código al commit anterior

## ⚠️ Consideraciones Importantes

1. **Backup**: Siempre haz backup antes de migrar
2. **Índices**: Los índices pueden tardar unos minutos en crearse
3. **Permisos**: Verifica que los usuarios mantengan sus permisos correctos
4. **IDs**: Los IDs de usuario se mantienen iguales durante la migración

## 📊 Estructura de Datos Migrados

### Usuario Estudiante:
```javascript
{
  id: "student_123",
  email: "estudiante@school.com",
  nombre: "Juan Pérez",
  subscription: "school",
  schoolRole: "student",
  idCuadernos: ["notebook1", "notebook2"],
  // ... otros campos
}
```

### Usuario Profesor:
```javascript
{
  id: "teacher_456",
  email: "profesor@school.com", 
  nombre: "María García",
  subscription: "school",
  schoolRole: "teacher",
  idAdmin: "admin_789",
  // ... otros campos
}
```

## 🛠️ Soporte

Si encuentras problemas durante la migración:

1. Revisa los logs en la consola
2. Verifica que los índices estén creados
3. Confirma que las reglas de Firestore estén actualizadas
4. Contacta al equipo de desarrollo si persisten los problemas