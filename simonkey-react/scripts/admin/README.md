# Firebase Admin SDK Scripts

Este directorio contiene scripts para operaciones administrativas en Firebase usando el Admin SDK.

## Configuración

### 1. Obtener credenciales de servicio

1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Selecciona tu proyecto
3. Ve a **Configuración del proyecto** (ícono de engranaje)
4. Selecciona la pestaña **Cuentas de servicio**
5. Haz clic en **Generar nueva clave privada**
6. Guarda el archivo como `serviceAccountKey.json` en la raíz del proyecto

**IMPORTANTE**: Este archivo contiene credenciales sensibles. NUNCA lo subas a git.

### 2. Verificar .gitignore

Asegúrate de que el archivo está en .gitignore:
```
serviceAccountKey.json
```

## Uso

### Test de conexión
```bash
node scripts/admin/example-operations.js test
```

### Operaciones disponibles
```bash
# Contar usuarios
node scripts/admin/example-operations.js contar-usuarios

# Contar cuadernos
node scripts/admin/example-operations.js contar-cuadernos
```

### Crear tus propios scripts

```javascript
const { db, auth } = require('./setup');

async function miOperacion() {
  // Tu código aquí
  const usuarios = await db.collection('users').get();
  console.log(`Total: ${usuarios.size}`);
}

miOperacion();
```

## Seguridad

- **NUNCA** subas el archivo `serviceAccountKey.json` a git
- **NUNCA** compartas las credenciales de servicio
- Usa estas herramientas solo en tu máquina local o en un servidor seguro
- Ten cuidado con las operaciones de escritura/eliminación

## Alternativas de autenticación

### Usando variables de entorno
```bash
export FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"..."}'
```

### Usando Google Cloud (si estás en GCP)
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json"
```