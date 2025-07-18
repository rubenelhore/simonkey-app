# Cloud Function para Congelación/Descongelación Programada

Esta Cloud Function procesa automáticamente las congelaciones y descongelaciones programadas de cuadernos.

## Características

- Se ejecuta automáticamente cada 15 minutos
- Procesa tanto notebooks regulares como schoolNotebooks
- Calcula el score promedio al congelar
- Registra todas las operaciones en logs
- Incluye endpoint manual para pruebas

## Configuración

### 1. Instalar dependencias

```bash
cd functions
npm install
```

### 2. Configurar zona horaria (opcional)

La función está configurada para usar `America/Mexico_City`. Si necesitas cambiarla, edita la línea 22 en `scheduledFreezeUnfreeze.ts`:

```typescript
.timeZone('America/Mexico_City') // Cambiar a tu zona horaria
```

### 3. Configurar token de autenticación (para endpoint manual)

```bash
firebase functions:config:set admin.token="tu-token-secreto-aqui"
```

### 4. Desplegar las funciones

```bash
# Desplegar todas las funciones
firebase deploy --only functions

# O desplegar solo las funciones de congelación
firebase deploy --only functions:processScheduledFreezeUnfreeze,functions:processScheduledFreezeUnfreezeManual
```

## Uso

### Procesamiento Automático

La función `processScheduledFreezeUnfreeze` se ejecuta automáticamente cada 15 minutos y:

1. Busca notebooks con `scheduledFreezeAt <= ahora` y `isFrozen != true`
2. Congela estos notebooks y calcula su score promedio
3. Busca notebooks con `scheduledUnfreezeAt <= ahora` y `isFrozen == true`
4. Descongela estos notebooks
5. Registra todas las operaciones en la colección `systemLogs`

### Procesamiento Manual (para pruebas)

Puedes ejecutar la función manualmente usando el endpoint HTTP:

```bash
curl -X GET \
  https://[tu-region]-[tu-proyecto].cloudfunctions.net/processScheduledFreezeUnfreezeManual \
  -H "Authorization: Bearer tu-token-secreto-aqui"
```

## Monitoreo

### Logs de Firebase

Puedes ver los logs en la consola de Firebase:
```bash
firebase functions:log --only processScheduledFreezeUnfreeze
```

### Colección systemLogs

Todas las ejecuciones se registran en Firestore en la colección `systemLogs` con:
- `type`: 'scheduled_freeze_unfreeze'
- `timestamp`: Fecha y hora de ejecución
- `updatedCount`: Número de cuadernos procesados
- `status`: 'success' o 'error'
- `error`: Mensaje de error (si aplica)

## Consideraciones

### Rendimiento
- La función tiene un timeout de 5 minutos
- Usa 512MB de memoria
- Procesa en batch para mejor rendimiento

### Frecuencia
- Configurada para ejecutarse cada 15 minutos
- Puedes cambiar la frecuencia modificando la línea:
  ```typescript
  .schedule('every 15 minutes')
  ```
  
  Ejemplos:
  - `'every 5 minutes'` - Cada 5 minutos
  - `'every 30 minutes'` - Cada 30 minutos
  - `'every 1 hours'` - Cada hora
  - `'0 */4 * * *'` - Cada 4 horas (formato cron)

### Costos
- Cloud Scheduler: ~$0.09 USD/mes por job
- Cloud Functions: Depende del uso, pero con ejecución cada 15 minutos:
  - ~2,880 invocaciones/mes
  - Primeras 2 millones son gratis
  - Después: ~$0.0000025 USD por invocación

## Solución de Problemas

### La función no se ejecuta
1. Verifica que Cloud Scheduler esté habilitado en tu proyecto
2. Revisa los logs de errores
3. Asegúrate de que las funciones estén desplegadas correctamente

### Error de permisos
1. Verifica que la cuenta de servicio tenga permisos de Firestore
2. Asegúrate de que Firebase Admin esté inicializado correctamente

### Notebooks no se congelan/descongelan
1. Verifica que los campos `scheduledFreezeAt` o `scheduledUnfreezeAt` estén configurados correctamente
2. Asegúrate de que las fechas sean pasadas (menores o iguales a la hora actual)
3. Revisa los logs para ver si hay errores específicos