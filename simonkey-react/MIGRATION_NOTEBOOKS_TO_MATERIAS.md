# Migración de Notebooks a Materias

## Resumen

Este documento describe el sistema de migración implementado para transformar la estructura de la aplicación de notebooks-first a materias-first.

## Cambios Arquitectónicos

### Antes
- Los notebooks eran entidades de nivel superior
- Ruta principal: `/notebooks`
- Los notebooks podían tener categorías pero no estaban agrupados en contenedores

### Después
- Las materias son ahora entidades de nivel superior
- Ruta principal: `/materias`
- Los notebooks están anidados dentro de materias
- Estructura: Materias → Notebooks → Conceptos

## Sistema de Migración

### Componentes Principales

1. **`migrateNotebooksToMaterias.ts`**
   - Funciones principales de migración
   - `migrateUserNotebooksToDefaultMateria()`: Migra notebooks de un usuario específico
   - `migrateAllNotebooksToMaterias()`: Migración masiva (admin)
   - `checkUserMigrationStatus()`: Verifica si un usuario necesita migración

2. **`useAutoMigration.ts`**
   - Hook que ejecuta migración automática al iniciar sesión
   - Solo se ejecuta una vez por sesión
   - Muestra notificaciones del progreso

3. **`MigrationTool.tsx`**
   - Componente UI para migración manual
   - Útil para testing y debugging

4. **`runMigration.ts`**
   - Script de desarrollo para ejecutar migración manualmente
   - Disponible en consola: `window.runNotebookMigration()`

## Cómo Funciona

1. Cuando un usuario accede a `/materias`:
   - El hook `useAutoMigration` verifica si tiene notebooks sin `materiaId`
   - Si encuentra notebooks sin materia, crea automáticamente una materia "General"
   - Asigna todos los notebooks huérfanos a esta materia
   - Muestra una notificación temporal del resultado

2. La migración es no destructiva:
   - No elimina ni modifica datos existentes (excepto añadir `materiaId`)
   - Los notebooks mantienen todas sus propiedades originales
   - Se puede ejecutar múltiples veces sin efectos adversos

## Uso en Desarrollo

### Migración Manual (Consola)
```javascript
// En la consola del navegador
window.runNotebookMigration()
```

### Verificar Estado de Migración
```javascript
// Importar en tu componente
import { checkUserMigrationStatus } from './utils/migrateNotebooksToMaterias';

// Usar en componente
const status = await checkUserMigrationStatus(userId);
console.log('Necesita migración:', status.needsMigration);
console.log('Notebooks sin materia:', status.notebooksWithoutMateria);
```

## Estructura de Datos

### Notebook con materiaId
```typescript
{
  id: string;
  title: string;
  userId: string;
  materiaId: string; // Nueva propiedad
  color?: string;
  category?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Materia
```typescript
{
  id: string;
  title: string;
  userId: string;
  color: string;
  category?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  description?: string;
}
```

## Consideraciones

1. **Performance**: La migración se ejecuta en lotes para usuarios con muchos notebooks
2. **Seguridad**: Solo migra notebooks del usuario autenticado
3. **UX**: Notificaciones no intrusivas que desaparecen automáticamente
4. **Compatibilidad**: Rutas legacy `/notebooks` redirigen a `/materias`

## Troubleshooting

### Notebooks no aparecen después de migración
1. Verificar que la migración se completó sin errores
2. Recargar la página
3. Verificar en Firebase Console que los notebooks tienen `materiaId`

### Error durante migración
1. Verificar permisos de Firebase
2. Revisar logs en consola del navegador
3. Ejecutar migración manual con `window.runNotebookMigration()`

### Usuario ve notificación cada vez que entra
- La migración usa `sessionStorage` para evitar múltiples ejecuciones
- Si persiste, limpiar sessionStorage del navegador