# INSTRUCCIONES URGENTES PARA RESOLVER EL PROBLEMA DE PERMISOS

## El Problema
Las reglas de Firestore están bloqueando el acceso a las colecciones `schoolSubjects` y `schoolNotebooks`.

## Solución Inmediata

### 1. Verifica la base de datos correcta en Firebase Console

1. Ve a Firebase Console: https://console.firebase.google.com
2. Selecciona tu proyecto "simonkey-5c78f"
3. Ve a Firestore Database
4. **IMPORTANTE**: En la parte superior, asegúrate de que dice `simonkey-general` (no "default")
   - Si dice "(default)", haz clic en el dropdown y selecciona "simonkey-general"

### 2. Aplica estas reglas temporales

Ve a la pestaña "Rules" y reemplaza TODO el contenido con:

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

### 3. Publica las reglas

1. Haz clic en "Publish"
2. Espera a que diga "Rules published successfully"

### 4. Verifica en la aplicación

1. Recarga la página (Ctrl+R o Cmd+R)
2. Los cuadernos deberían aparecer ahora

## Si el problema persiste

Ejecuta en la consola del navegador:

```javascript
// 1. Verificar configuración
verifyFirebaseSetup()

// 2. Verificar usuario actual
debugCurrentUser()

// 3. Verificar estado del profesor
checkTeacherStatusSimple()
```

## Información del profesor actual

- Email: 0161875@up.edu.mx
- Document ID esperado: school_1751333776472_ia0ly5vle
- Firebase UID: eLIAl0biR0fB01hKcgv1MH1CX2q1

## IMPORTANTE

Las reglas actuales en tu archivo `firestore.rules` dicen que permiten lectura a cualquier usuario autenticado:

```javascript
match /schoolSubjects/{document} {
  allow read: if request.auth != null;
}
```

Pero el error persiste, lo que sugiere que:
1. Las reglas no están aplicadas a la base de datos correcta
2. O hay un problema de caché en Firebase

## Alternativa si nada funciona

Si después de aplicar las reglas simples el problema persiste:

1. Ve directamente a Firebase Console > Firestore Database
2. Navega a la colección `schoolSubjects`
3. Verifica manualmente si existen documentos donde `idProfesor` = `school_1751333776472_ia0ly5vle`
4. Si no existen, el problema es que no hay materias asignadas al profesor
5. Si existen pero no se pueden leer, el problema es de permisos

## Contacto

Si el problema persiste después de estos pasos, el problema puede estar en:
- La configuración del proyecto Firebase
- Un problema con la base de datos múltiple
- Las reglas están en una base de datos diferente

En ese caso, verifica en Firebase Console > Project Settings > General que el proyecto sea el correcto.