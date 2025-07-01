# Instrucciones para Depurar Problemas de Profesores

## Problema Identificado

El profesor no puede ver sus cuadernos asignados debido a un problema de mapeo de IDs. Las materias están vinculadas usando el Firebase UID en lugar del Document ID del profesor.

- **Firebase UID**: `eLIAl0biR0fB01hKcgv1MH1CX2q1`
- **Document ID**: `school_1751333776472_ia0ly5vle`

## Solución Rápida

### Opción 1: Corrección Automática (Recomendada)

1. Abre la aplicación en el navegador
2. Inicia sesión con la cuenta del profesor
3. Abre la consola del navegador (F12)
4. Ejecuta el siguiente comando:

```javascript
fixTeacherSubjectsMapping()
```

5. Espera a que termine la corrección
6. Recarga la página

### Opción 2: Diagnóstico Detallado

Para ver un diagnóstico completo del problema:

```javascript
debugTeacherIssue()
```

Para un chequeo rápido del estado:

```javascript
checkTeacherStatusSimple()
```

### Opción 3: Corrección Manual en Firebase Console

1. Ve a Firebase Console > Firestore Database
2. Busca en la colección `schoolSubjects`
3. Encuentra las materias donde `idProfesor` = `eLIAl0biR0fB01hKcgv1MH1CX2q1`
4. Edita cada documento y cambia `idProfesor` a `school_1751333776472_ia0ly5vle`

## Verificación

Después de aplicar la corrección:

1. Recarga la página
2. Los cuadernos deberían aparecer si:
   - Las materias tienen el `idProfesor` correcto
   - Las materias tienen cuadernos asignados (campo `idMateria`)

## Si el Problema Persiste

Si después de la corrección no aparecen cuadernos:

1. **No hay materias asignadas**: El administrador debe asignar materias al profesor
2. **No hay cuadernos en las materias**: El administrador debe crear cuadernos para las materias
3. **Problemas de permisos**: Verifica que las reglas de Firestore estén actualizadas

## Estructura de Datos Correcta

```javascript
// users/school_1751333776472_ia0ly5vle
{
  email: "ruben_elhore@hotmail.com",
  subscription: "school",
  schoolRole: "teacher",
  googleAuthUid: "eLIAl0biR0fB01hKcgv1MH1CX2q1"
}

// schoolSubjects/[ID_MATERIA]
{
  nombre: "Matemáticas",
  idProfesor: "school_1751333776472_ia0ly5vle", // ✅ Document ID
  idColegio: "ID_DEL_COLEGIO"
}

// schoolNotebooks/[ID_CUADERNO]
{
  titulo: "Álgebra Básica",
  idMateria: "ID_DE_LA_MATERIA",
  // idProfesor es opcional si está vinculado por materia
}
```