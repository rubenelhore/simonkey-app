# Configuración de Reglas de Firebase Storage

## Problema
Los profesores no pueden subir archivos a Firebase Storage debido a permisos insuficientes.

## Solución
He creado un archivo `storage.rules` con las reglas necesarias para permitir que los profesores suban materiales.

## Pasos para aplicar las reglas:

### Opción 1: Usando Firebase CLI (Recomendado)

1. Instala Firebase CLI si no lo tienes:
   ```bash
   npm install -g firebase-tools
   ```

2. Inicia sesión en Firebase:
   ```bash
   firebase login
   ```

3. Inicializa Firebase en tu proyecto (si no lo has hecho):
   ```bash
   firebase init storage
   ```

4. Despliega las reglas:
   ```bash
   firebase deploy --only storage:rules
   ```

### Opción 2: Manualmente en la Consola de Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Selecciona tu proyecto
3. Ve a "Storage" en el menú lateral
4. Haz clic en la pestaña "Rules"
5. Copia y pega el contenido del archivo `storage.rules`
6. Haz clic en "Publish"

## Explicación de las reglas

Las reglas permiten:

1. **Lectura**: Todos los usuarios autenticados pueden leer archivos
2. **Escritura**: Permitida para:
   - El propietario del archivo (userId coincide)
   - Profesores escolares (schoolRole == 'teacher')
   - Administradores escolares (schoolRole == 'admin')

## Verificación

Para verificar que las reglas funcionan:

1. Intenta subir un archivo como profesor
2. Deberías ver en la consola que el archivo se sube directamente sin errores
3. No deberías ver el error "storage/unauthorized"

## Consideraciones de seguridad

- Las reglas verifican tanto custom claims como datos en Firestore
- Solo usuarios autenticados pueden acceder a los archivos
- La escritura está restringida a roles específicos
- Hay una regla general que deniega escritura a rutas no especificadas

## Optimización adicional

Si los custom claims no están configurados, las reglas también verifican el rol directamente en Firestore. Para mejor rendimiento, considera implementar custom claims en tus Cloud Functions de autenticación.