# Configuración de Entorno de Desarrollo (simonkey-dev)

## 📋 Pasos para configurar simonkey-dev

### 1. Crear el proyecto en Firebase Console
1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Crea un nuevo proyecto llamado `simonkey-dev`
3. Habilita los servicios necesarios:
   - Authentication (con Google provider)
   - Firestore Database
   - Storage
   - Functions
   - Hosting

### 2. Descargar credenciales de servicio
1. Ve a Configuración del proyecto > Cuentas de servicio
2. Genera nueva clave privada
3. Guárdala como `serviceAccountKey-dev.json` en la raíz del proyecto

### 3. Obtener configuración del proyecto
En Firebase Console > Configuración del proyecto > General > Tu aplicación web:
```javascript
const firebaseConfig = {
  apiKey: "...",
  authDomain: "simonkey-dev.firebaseapp.com",
  projectId: "simonkey-dev",
  storageBucket: "simonkey-dev.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
```

### 4. Configurar Firebase CLI para múltiples proyectos
```bash
# Agregar el proyecto de desarrollo
firebase use --add

# Selecciona simonkey-dev y dale un alias como "dev"
# Selecciona simonkey-5c78f y dale un alias como "prod"
```

### 5. Estructura de archivos de configuración

```
simonkey-react/
├── .env.development       # Variables para desarrollo
├── .env.production        # Variables para producción
├── serviceAccountKey.json # Credenciales de producción
├── serviceAccountKey-dev.json # Credenciales de desarrollo
├── firebase.json          # Configuración general
└── .firebaserc           # Aliases de proyectos
```

### 6. Scripts de package.json
```json
{
  "scripts": {
    "dev": "vite",
    "dev:prod-data": "VITE_USE_PROD_DB=true vite",
    "build:dev": "VITE_ENV=development vite build",
    "build:prod": "VITE_ENV=production vite build",
    "deploy:dev": "firebase use dev && firebase deploy",
    "deploy:prod": "firebase use prod && firebase deploy",
    "admin:dev": "FIREBASE_ENV=dev node scripts/admin/setup.cjs",
    "admin:prod": "FIREBASE_ENV=prod node scripts/admin/setup.cjs"
  }
}
```

## 🔄 Workflow de desarrollo

1. **Desarrollo local con datos de dev**:
   ```bash
   npm run dev
   ```

2. **Desarrollo local con datos de producción** (cuidado!):
   ```bash
   npm run dev:prod-data
   ```

3. **Desplegar a desarrollo**:
   ```bash
   npm run build:dev
   firebase use dev
   firebase deploy
   ```

4. **Desplegar a producción**:
   ```bash
   npm run build:prod
   firebase use prod
   firebase deploy
   ```

## 🔐 Seguridad

- NUNCA subas las credenciales a git
- Agrega a .gitignore:
  ```
  serviceAccountKey*.json
  .env*
  ```

- Usa diferentes cuentas de servicio para dev y prod
- Configura reglas de Firestore más permisivas en dev si necesitas