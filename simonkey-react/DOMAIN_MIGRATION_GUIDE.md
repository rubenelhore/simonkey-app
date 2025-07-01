# Guía de Migración de Dominio - simonkey.ai

## Problema
Error de autenticación al cambiar de dominio:
```
FirebaseError: Firebase: Error (auth/unauthorized-domain)
The current domain is not authorized for OAuth operations
```

## Solución

### 1. Configuración en Firebase Console

**PASO CRÍTICO**: Debes agregar tu nuevo dominio a Firebase Console:

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto: `simonkey-5c78f`
3. Ve a **Authentication** → **Settings** → **Authorized domains**
4. Haz clic en **Add domain**
5. Agrega: `simonkey.ai`
6. Guarda los cambios

**⚠️ IMPORTANTE**: Los cambios pueden tardar hasta 5 minutos en propagarse.

### 2. Cambios Realizados en el Código

✅ **Configuración centralizada creada**: `src/firebase/config.ts`
✅ **authDomain actualizado**: De `simonkey-5c78f.firebaseapp.com` a `simonkey.ai`
✅ **Configuración automática por entorno**: Desarrollo vs Producción

### 3. Archivos Modificados

- `src/firebase/config.ts` - Nueva configuración centralizada
- `src/services/firebase.ts` - Usa configuración centralizada
- `src/utils/fixUserProfile.ts` - authDomain actualizado
- `scripts/init-firebase-db.js` - authDomain actualizado

### 4. Verificación

Ejecuta el script de verificación:
```bash
cd simonkey-react
node scripts/check-domain-config.js
```

### 5. Configuración por Entorno

El sistema ahora usa siempre el dominio personalizado `simonkey.ai` para evitar conflictos de inicialización.

### 6. Enlaces Útiles

- [Firebase Console - Authorized Domains](https://console.firebase.google.com/project/simonkey-5c78f/authentication/settings)
- [Documentación Firebase Auth](https://firebase.google.com/docs/auth/web/google-signin#configure_oauth_20_client_id)

### 7. Troubleshooting

Si el error persiste después de 5 minutos:

1. **Verifica el dominio en Firebase Console**
2. **Limpia el caché del navegador**
3. **Verifica que no haya errores de DNS**
4. **Comprueba que el dominio esté correctamente vinculado**

### 8. Próximos Pasos

1. ✅ Agregar `simonkey.ai` a Firebase Console
2. ✅ Esperar 5 minutos para propagación
3. ✅ Probar autenticación en el nuevo dominio
4. ✅ Verificar que todas las funcionalidades funcionen

---

**Estado**: ✅ Configuración de código completada
**Pendiente**: ⏳ Configuración en Firebase Console 