# Guía de Migración: simonkey-general → (default)

## 📋 Pasos para la migración

### 1. Hacer respaldo (IMPORTANTE)
```bash
node scripts/admin/backup-simonkey-general.cjs
```
Esto creará una copia de seguridad en la carpeta `backups/`

### 2. Ejecutar la migración
```bash
node scripts/admin/migrate-to-default-db.cjs
```
Este script:
- Copiará todos los datos de `simonkey-general` a `(default)`
- Mantendrá la estructura de colecciones y subcolecciones
- NO eliminará datos existentes en `(default)`

### 3. Actualizar el código del frontend

#### Opción A: Actualización manual
Edita el archivo `src/services/firebase.ts` línea 42:
```javascript
// Cambiar de:
export const db = getFirestore(app, 'simonkey-general');

// A:
export const db = getFirestore(app);
```

#### Opción B: Actualización automática
```bash
node scripts/admin/update-to-default-db.cjs
```

### 4. Actualizar Cloud Functions
Edita `functions/src/index.ts` y busca todas las instancias de:
```javascript
getFirestore('simonkey-general')
```
Y cámbialas a:
```javascript
getFirestore()
```

### 5. Verificar la migración
```bash
# Verificar que ahora usa (default)
node scripts/admin/check-current-database.cjs

# Probar conexión a (default)
node scripts/admin/test-default-connection.cjs
```

### 6. Desplegar cambios
```bash
# Frontend
npm run build
firebase deploy --only hosting

# Functions
cd functions
npm run build
firebase deploy --only functions
```

## ⚠️ Consideraciones importantes

1. **Reglas de seguridad**: Las reglas de Firestore son por base de datos. Necesitarás copiar las reglas de `simonkey-general` a `(default)`.

2. **URLs de autenticación**: Si tienes configurados dominios personalizados, verifica que funcionen con la base de datos default.

3. **Índices**: Los índices también son por base de datos. Revisa si necesitas recrearlos.

4. **Rollback**: Si algo sale mal, simplemente revierte el cambio en `firebase.ts` para volver a usar `simonkey-general`.

## 🔍 Verificación post-migración

1. Revisa que los usuarios puedan iniciar sesión
2. Verifica que se puedan crear/editar cuadernos
3. Prueba las funciones de estudio
4. Revisa los juegos y rankings
5. Verifica las funciones de administrador/profesor

## 📞 Soporte

Si encuentras algún problema durante la migración, revisa:
- Los logs en la consola del navegador
- Los logs de Cloud Functions
- Firebase Console para verificar los datos