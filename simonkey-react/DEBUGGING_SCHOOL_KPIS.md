# Debugging School Student KPIs

## El Problema
Los KPIs de estudiantes escolares aparecen vacíos (cuadernos: {}, materias: {}) a pesar de tener sesiones de estudio registradas.

## Función de Diagnóstico
He creado una función de diagnóstico que puedes ejecutar en la consola del navegador para investigar el problema. Esta función verifica:

1. La existencia del usuario
2. Sus sesiones de estudio
3. Sus cuadernos asignados
4. Los KPIs actuales
5. Resultados de quiz
6. Datos de aprendizaje

## Cómo Usar la Función de Diagnóstico

1. Abre la aplicación en el navegador
2. Abre la consola del navegador (F12 → Console)
3. Ejecuta el siguiente comando con el ID del estudiante escolar:

```javascript
// Ejemplo con el ID que vimos en los logs
await diagnoseSchoolStudentKPIs('school_0161875_up_edu_mx')
```

## Qué Buscar en los Resultados

La función mostrará:
- ✅ Usuario encontrado: Verifica que el usuario existe y tiene idCuadernos
- 📚 Sesiones de estudio: Cuántas sesiones ha completado
- 📚 Cuadernos: Si los cuadernos asignados existen en schoolNotebooks
- 📊 KPIs actuales: Si hay KPIs generados y su contenido
- 🎯 Resultados de quiz: Si hay resultados de quiz registrados

## Soluciones Potenciales

### Si las sesiones existen pero los KPIs están vacíos:
Ejecuta manualmente la actualización de KPIs:

```javascript
// En la consola del navegador
import { kpiService } from './src/services/kpiService';
await kpiService.updateUserKPIs('school_0161875_up_edu_mx');
```

### Si los cuadernos no se encuentran:
Verifica que los IDs en `idCuadernos` del usuario correspondan a documentos existentes en la colección `schoolNotebooks`.

### Si no hay resultados de quiz:
Los scores serán 0. El estudiante debe completar al menos un quiz para tener scores en los KPIs.

## Estructura Esperada de los Datos

Para un estudiante escolar con datos completos:
- Usuario en `users/school_xxx` con `idCuadernos` array
- Cuadernos en `schoolNotebooks/{id}`
- Sesiones en `studySessions` con `userId: school_xxx`
- Resultados de quiz en `users/school_xxx/quizResults`
- KPIs en `users/school_xxx/kpis/dashboard`

## Próximos Pasos

1. Ejecuta la función de diagnóstico con el ID del estudiante problemático
2. Comparte los resultados completos
3. Basándome en lo que muestre, podremos identificar exactamente dónde está el problema

## Notas Importantes

- Los IDs de estudiantes escolares tienen el formato: `school_email_sin_simbolos`
- Los cuadernos escolares están en `schoolNotebooks`, no en `notebooks`
- Las materias escolares están en `schoolSubjects`, no en `subjects`