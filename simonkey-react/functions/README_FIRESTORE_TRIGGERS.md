# 🔥 Cloud Functions - Triggers de Firestore

## 📋 Funciones Implementadas

### 1. 🗑️ `onUserDeletionCreated` - Eliminación Automática de Usuarios

**Trigger**: `onCreate` en `userDeletions/{userId}`

**Problema resuelto**: Eliminación automática de cuentas "fantasma" en Firebase Auth

**Flujo**:
1. Super admin elimina usuario desde frontend
2. Se crea documento en `userDeletions`
3. **🔥 AUTOMÁTICO**: Cloud Function detecta creación
4. **🔥 AUTOMÁTICO**: Llama `admin.auth().deleteUser(uid)`
5. **🔥 AUTOMÁTICO**: Actualiza estado del documento

**Estados del documento**:
- `pending` → `processing` → `completed`/`failed`

---

### 2. 👤 `onAuthUserCreated` - Creación Automática de Perfiles

**Trigger**: `onCreate` en Firebase Auth

**Problema resuelto**: Cuentas en Auth sin perfil en Firestore

**Lógica automática**:
- Detecta usuarios escolares por email
- Asigna suscripción y límites apropiados
- Crea estadísticas y actividades iniciales

**Tipos detectados**:
- `SCHOOL` + `TEACHER`: Límites ilimitados
- `SCHOOL` + `STUDENT`: Sin creación de notebooks
- `SUPER_ADMIN`: Acceso completo
- `FREE`: Límites estándar (3 notebooks, 10 conceptos)

---

### 3. ⚙️ `onUserProfileCreated` - Inicialización Completa

**Trigger**: `onCreate` en `users/{userId}`

**Problema resuelto**: Configuración manual e inconsistente de nuevos usuarios

**Datos creados automáticamente**:
```
users/{userId}/settings/preferences: {
  theme: 'system',
  language: 'es',
  notifications: {...}
}

users/{userId}/limits/current: {
  maxNotebooks: // Basado en subscription
  maxStudySessionsPerDay: // FREE: 5, otros: ilimitado
  canCreatePublicNotebooks: // Solo no-FREE
}

users/{userId}/progress/current: {
  level: 1,
  experience: 0,
  badges: [],
  streakRecord: 0
}
```

---

### 4. 📚 `onNotebookDeleted` - Limpieza Automática

**Trigger**: `onDelete` en `notebooks/{notebookId}`

**Problema resuelto**: Datos huérfanos al eliminar notebooks

**Limpieza automática**:
- Conceptos (`conceptos` con `cuadernoId`)
- Sesiones de estudio (`studySessions`)
- Estadísticas (`conceptStats`)
- Conceptos de repaso (`reviewConcepts`)
- Actualiza contador del usuario

---

## 🚀 Despliegue

### Compilar y Desplegar
```bash
cd simonkey-react/functions
npm run build
npm run deploy
```

### Solo Funciones Específicas
```bash
firebase deploy --only functions:onUserDeletionCreated
firebase deploy --only functions:onAuthUserCreated
firebase deploy --only functions:onUserProfileCreated
firebase deploy --only functions:onNotebookDeleted
```

### Verificar Despliegue
```bash
firebase functions:log
```

---

## 🔍 Monitoreo

### Logs con Emojis
- 🗑️ Eliminación de usuarios
- 👤 Creación de perfiles
- ⚙️ Inicialización
- 📚 Limpieza de notebooks

### Comandos de Monitoreo
```bash
# Ver logs en tiempo real
firebase functions:log --only onUserDeletionCreated

# Ver logs específicos
firebase functions:log --only onAuthUserCreated

# Ver todos los logs
firebase functions:log
```

---

## 🛠️ Configuración

### Dependencias
- `firebase-functions`: ^6.3.2
- `firebase-admin`: ^13.4.0

### Configuración TypeScript
```json
{
  "noUnusedLocals": false, // Permite variables no usadas
  "strict": true,
  "target": "es2017"
}
```

---

## 🔒 Seguridad

### Permisos Requeridos
- **Firebase Auth Admin**: Para eliminar usuarios
- **Firestore Admin**: Para escribir/leer colecciones
- **Cloud Functions**: Para ejecutar triggers

### Validaciones Implementadas
- ✅ Verificación de documentos existentes
- ✅ Manejo de errores sin bloquear operaciones
- ✅ Estados de procesamiento para auditoría
- ✅ Logging detallado para debugging

---

## 🧪 Testing

### Probar Eliminación de Usuarios
1. Crear usuario de prueba
2. Eliminarlo desde SuperAdmin panel
3. Verificar que se crea documento en `userDeletions`
4. Verificar que la función elimina cuenta de Auth
5. Verificar estado final: `completed`

### Probar Creación de Usuarios
1. Registrar nuevo usuario
2. Verificar que se crea perfil en Firestore
3. Verificar configuraciones iniciales
4. Verificar detección correcta de tipo

### Verificar Logs
```bash
firebase functions:log --only onUserDeletionCreated
```

---

## 🔧 Troubleshooting

### Error Común: "Function not found"
```bash
# Verificar despliegue
firebase functions:list

# Redesplegar función específica
firebase deploy --only functions:onUserDeletionCreated
```

### Error: "Permission denied"
- Verificar permisos de Cloud Functions
- Verificar configuración de Firebase Admin

### Error de Compilación
```bash
# Limpiar build
rm -rf lib
npm run build
```

---

## 🚀 Próximos Pasos

### Triggers Sugeridos para Implementar
1. **`onConceptCreated`**: Actualizar estadísticas automáticamente
2. **`onStudySessionCompleted`**: Calcular streaks y logros
3. **`onStorageUpload`**: Procesar imágenes/archivos subidos
4. **`onUserSubscriptionChanged`**: Ajustar límites dinámicamente

### Mejoras Pendientes
- [ ] Agregar retry logic para operaciones fallidas
- [ ] Implementar rate limiting para triggers masivos
- [ ] Agregar métricas y alertas
- [ ] Crear dashboard de monitoreo

---

## 📚 Recursos

- [Firebase Functions v2 Docs](https://firebase.google.com/docs/functions)
- [Firestore Triggers](https://firebase.google.com/docs/firestore/extend-with-functions-2nd-gen)
- [Auth Triggers](https://firebase.google.com/docs/functions/auth-events)

---

**Resultado**: Sistema completamente automatizado que maneja eliminación de usuarios, creación de perfiles, y limpieza de datos sin intervención manual.