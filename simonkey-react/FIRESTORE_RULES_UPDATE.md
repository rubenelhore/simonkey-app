# ACTUALIZACIÓN DE REGLAS DE FIRESTORE

## Problema
Los profesores no pueden acceder a la colección `schoolConcepts` para ver/crear conceptos en sus cuadernos.

## Solución
Agregar las siguientes reglas a tu archivo de reglas de Firestore en Firebase Console:

```javascript
// Reglas para conceptos escolares
match /schoolConcepts/{document} {
  // Permitir lectura a cualquier usuario autenticado temporalmente
  allow read: if request.auth != null;
  
  // Permitir escritura solo a usuarios autenticados
  allow write: if request.auth != null;
}
```

## Pasos para aplicar:

1. Ve a Firebase Console: https://console.firebase.google.com
2. Selecciona tu proyecto "simonkey-5c78f"
3. Ve a Firestore Database
4. **IMPORTANTE**: Asegúrate de que estés en la base de datos `simonkey-general`
5. Ve a la pestaña "Rules"
6. Agrega las reglas anteriores antes del cierre final `}`
7. Haz clic en "Publish"

## Reglas completas sugeridas (temporales para debugging):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permitir acceso total temporalmente para debugging
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**NOTA**: Estas son reglas permisivas para debugging. Una vez que todo funcione, deberías implementar reglas más restrictivas basadas en roles.