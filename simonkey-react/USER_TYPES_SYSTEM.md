# Sistema de Tipos de Usuario - Simonkey

## Descripción General

El sistema de tipos de usuario en Simonkey permite gestionar diferentes niveles de acceso y límites de uso según el tipo de suscripción del usuario. Cada tipo tiene permisos y restricciones específicas.

## Tipos de Usuario

### 1. Súper Admin 👑
- **Email específico**: `ruben.elhore@gmail.com`
- **Límites**: Sin límites
- **Permisos**:
  - Ver toda la información de Firebase
  - Editar toda la información de Firebase
  - Acceso completo a todas las funcionalidades
  - Gestionar usuarios

### 2. Gratis 🆓
- **Límites**:
  - Máximo 4 cuadernos
  - Máximo 100 conceptos por cuaderno
  - No puede recrear cuadernos eliminados
- **Permisos**:
  - Acceso a la sección de estudio
  - Funcionalidades básicas

### 3. Pro ⭐
- **Límites**:
  - Cuadernos totales: Sin límite
  - Máximo 10 cuadernos por semana
  - Máximo 100 conceptos por cuaderno
  - Máximo 100 conceptos por semana
  - Puede recrear cuadernos eliminados
- **Permisos**:
  - Acceso a la sección de estudio
  - Funcionalidades avanzadas

### 4. Escolar 🏫
- **Límites**: Sin límites
- **Permisos**: Dependen del rol

#### Roles Escolares:
- **Administrador**: Permisos de visualización
- **Profesor**: Permisos de edición
- **Alumno**: Permisos de visualización y uso de estudio

## Implementación Técnica

### Archivos Principales

1. **`src/types/interfaces.ts`**
   - Definición de enums y interfaces
   - `UserSubscriptionType`
   - `SchoolRole`
   - `UserProfile`
   - `SubscriptionLimits`

2. **`src/services/userService.ts`**
   - Lógica de negocio para tipos de usuario
   - Verificación de límites
   - Gestión de contadores
   - Funciones de migración

3. **`src/hooks/useUserType.ts`**
   - Hook personalizado para acceder a información del usuario
   - Verificaciones de permisos
   - Estado del usuario

4. **`src/components/UserTypeBadge.tsx`**
   - Componente visual para mostrar el tipo de usuario
   - Badges con colores y iconos

5. **`src/components/UserLimitsInfo.tsx`**
   - Componente para mostrar límites y uso actual

### Estructura de Datos en Firestore

```typescript
interface UserProfile {
  id: string;
  email: string;
  username: string;
  nombre: string;
  displayName: string;
  birthdate: string;
  createdAt: Timestamp;
  subscription: UserSubscriptionType;
  notebookCount: number;
  
  // Campos específicos para usuarios escolares
  schoolRole?: SchoolRole;
  schoolId?: string;
  schoolName?: string;
  
  // Límites específicos por tipo de suscripción
  maxNotebooks?: number;
  maxConceptsPerNotebook?: number;
  notebooksCreatedThisWeek?: number;
  conceptsCreatedThisWeek?: number;
  weekStartDate?: any;
}
```

## Uso del Sistema

### Verificación de Límites

```typescript
import { useUserType } from '../hooks/useUserType';

const MyComponent = () => {
  const { checkCanCreateNotebook, checkCanAddConcepts } = useUserType();
  
  const handleCreateNotebook = async () => {
    const canCreate = await checkCanCreateNotebook();
    if (!canCreate.canCreate) {
      alert(canCreate.reason);
      return;
    }
    // Proceder con la creación
  };
};
```

### Mostrar Información del Usuario

```typescript
import { useUserType } from '../hooks/useUserType';
import UserTypeBadge from '../components/UserTypeBadge';

const ProfileComponent = () => {
  const { userProfile, isSuperAdmin, isFreeUser } = useUserType();
  
  return (
    <div>
      {userProfile && (
        <UserTypeBadge 
          subscription={userProfile.subscription}
          schoolRole={userProfile.schoolRole}
        />
      )}
    </div>
  );
};
```

## Migración de Usuarios Existentes

Para migrar usuarios existentes al nuevo sistema:

1. **Ejecutar desde la consola del navegador**:
   ```javascript
   // Solo como super admin
   runUserMigration();
   ```

2. **O importar y ejecutar**:
   ```typescript
   import { runMigration } from '../utils/migrateUsers';
   await runMigration();
   ```

## Reglas de Negocio

### Usuarios Gratis
- No pueden recrear cuadernos eliminados
- Límite estricto de 4 cuadernos totales
- Contador no se resetea al eliminar cuadernos

### Usuarios Pro
- Límites semanales que se resetean cada semana
- Pueden recrear cuadernos eliminados
- Contadores se actualizan automáticamente

### Usuarios Escolares
- Sin límites de uso
- Permisos basados en rol
- Ideal para instituciones educativas

## Seguridad

- Solo el super admin puede ejecutar migraciones
- Verificaciones de límites en cada operación
- Contadores automáticos para usuarios Pro
- Validaciones en el frontend y backend

## Futuras Mejoras

1. **Panel de Administración**
   - Interfaz para gestionar tipos de usuario
   - Estadísticas de uso por tipo

2. **Sistema de Pagos**
   - Integración con pasarelas de pago
   - Actualización automática de tipos

3. **Analytics**
   - Métricas de uso por tipo de usuario
   - Reportes de conversión

4. **Notificaciones**
   - Alertas cuando se acercan a los límites
   - Sugerencias de actualización

## Troubleshooting

### Problemas Comunes

1. **Usuario no tiene tipo asignado**
   - Ejecutar migración de usuarios
   - Verificar que el email esté correcto

2. **Límites no se aplican**
   - Verificar que se esté usando `useUserType`
   - Comprobar que los contadores se actualicen

3. **Errores de permisos**
   - Verificar el rol escolar
   - Comprobar la configuración de permisos

### Logs de Debug

```typescript
// Habilitar logs detallados
console.log('User Profile:', userProfile);
console.log('Subscription Limits:', subscriptionLimits);
console.log('Can Create Notebook:', await checkCanCreateNotebook());
``` 