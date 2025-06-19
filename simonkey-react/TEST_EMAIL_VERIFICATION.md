# Pruebas de Verificación de Email

## Instrucciones para Probar la Corrección

### 1. Prueba de Bypass (DEBE FALLAR)

**Objetivo**: Verificar que ya no es posible acceder a rutas protegidas sin verificar email.

**Pasos**:
1. Crear una cuenta nueva con email válido
2. **NO verificar** el email (no hacer clic en el enlace de verificación)
3. Intentar acceder directamente a: `http://localhost:5174/notebooks`
4. **Resultado esperado**: Debe redirigir automáticamente a `/verify-email`

### 2. Prueba de Acceso Normal (DEBE FUNCIONAR)

**Objetivo**: Verificar que usuarios verificados pueden acceder normalmente.

**Pasos**:
1. Crear una cuenta nueva con email válido
2. **Verificar** el email (hacer clic en el enlace de verificación)
3. Acceder a: `http://localhost:5174/notebooks`
4. **Resultado esperado**: Debe mostrar la página de notebooks normalmente

### 3. Prueba de Redirección Automática

**Objetivo**: Verificar que las redirecciones funcionan correctamente.

**Pasos**:
1. Con una cuenta no verificada, intentar acceder a cualquier ruta protegida:
   - `/profile`
   - `/study`
   - `/quiz`
   - `/progress`
   - `/settings/voice`
2. **Resultado esperado**: Todas deben redirigir a `/verify-email`

### 4. Prueba de Usuario No Autenticado

**Objetivo**: Verificar que usuarios no autenticados son redirigidos a login.

**Pasos**:
1. Cerrar sesión completamente
2. Intentar acceder a: `http://localhost:5174/notebooks`
3. **Resultado esperado**: Debe redirigir a `/login`

### 5. Prueba de Verificación en Tiempo Real

**Objetivo**: Verificar que la verificación se actualiza en tiempo real.

**Pasos**:
1. Con una cuenta no verificada, ir a `/verify-email`
2. Verificar el email en otra pestaña
3. Regresar a la pestaña de Simonkey
4. Hacer clic en "Ya verifiqué mi email"
5. **Resultado esperado**: Debe redirigir automáticamente a `/notebooks`

## Casos de Prueba Adicionales

### Caso 1: Navegación Manual
- Usuario no verificado intenta escribir manualmente `/profile` en la URL
- **Resultado**: Debe redirigir a `/verify-email`

### Caso 2: Navegación con Botones
- Usuario no verificado hace clic en botones de navegación
- **Resultado**: Debe redirigir a `/verify-email`

### Caso 3: Recarga de Página
- Usuario no verificado recarga la página en una ruta protegida
- **Resultado**: Debe redirigir a `/verify-email`

## Verificación en Consola

Durante las pruebas, verificar en la consola del navegador que aparecen estos logs:

```
🔐 Configurando listener de autenticación
🔄 Estado de autenticación cambió: Usuario logueado
👤 Usuario encontrado: [email]
🔍 Verificando estado de email para: [email]
📧 Estado de verificación: No verificado
🔒 Usuario no verificado, redirigiendo a verificación de email
```

## Comandos para Ejecutar

```bash
# Iniciar el servidor de desarrollo
cd simonkey-react
npm run dev

# En otra terminal, verificar que no hay errores de TypeScript
npm run build
```

## Criterios de Éxito

✅ **Bypass bloqueado**: No es posible acceder a rutas protegidas sin verificación
✅ **Redirecciones funcionan**: Usuarios no verificados van a `/verify-email`
✅ **Acceso normal**: Usuarios verificados pueden acceder normalmente
✅ **Sin errores**: No hay errores en consola o compilación
✅ **UX fluida**: Las redirecciones son suaves y claras

## Notas Importantes

- Asegúrate de que Firebase esté configurado correctamente
- Verifica que el email de verificación llegue a la bandeja de entrada
- Si usas Gmail, revisa también la carpeta de spam
- Los logs en consola ayudan a debuggear problemas 