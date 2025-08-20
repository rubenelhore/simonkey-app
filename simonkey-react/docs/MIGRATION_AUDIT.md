# Auditoría del Sistema Escolar Actual

## 1. Estructura de Roles Actual

### Enum SchoolRole (src/types/interfaces.ts:317-322)
```typescript
export enum SchoolRole {
  ADMIN = 'admin',
  TEACHER = 'teacher',
  STUDENT = 'student',
  TUTOR = 'tutor'
}
```

### UserProfile - Campos Escolares (src/types/interfaces.ts:340-352)
```typescript
// Campos específicos para usuarios escolares
schoolRole?: SchoolRole;
schoolName?: string;
idNotebook?: string; // ID del cuaderno asignado al estudiante
schoolData?: {
  idEscuela?: string;
  nombreEscuela?: string;
};
// Campos para estudiantes escolares
subjectIds?: string[];
idCuadernos?: string[];
idInstitucion?: string;
idEscuela?: string;
idAdmin?: string;
```

## 2. Archivos con Dependencias del Sistema Escolar

### Componentes Principales (78 archivos con schoolRole)
- **Admin Panel**: `PasswordStatusPanel.tsx`
- **Páginas de Profesores**: 
  - `TeacherExamsPage.tsx`
  - `TeacherHomePage.tsx`
  - `SchoolTeacherAnalyticsPage.tsx`
  - `SchoolTeacherMateriaNotebooksPage.tsx`
  - `SchoolTeacherMateriasPage.tsx`
  - `SchoolTeacherNotebooksPage.tsx`
- **Páginas de Estudiantes**:
  - `StudentExamsPage.tsx`
  - `SchoolStudentMateriaPage.tsx`
- **Páginas de Admin**:
  - `SchoolAdminPage.tsx`
  - `SchoolAdminPasswordsPage.tsx`
- **Guards y Verificación**:
  - `SchoolUserGuard.tsx`
  - `SchoolLinkingVerification.tsx`
  - `SchoolCreation.tsx`

### Servicios Críticos
- `userService.ts` - Gestión de usuarios escolares
- `teacherKpiService.ts` - KPIs de profesores
- `kpiService.ts` - Métricas generales
- `analyticsService.ts` - Analytics del sistema
- `examService.ts` - Sistema de exámenes
- `rankingService.ts` - Rankings escolares

### Hooks del Sistema
- `useSchoolStudentData.ts`
- `useSchoolNotebooks.ts`
- `useUserType.ts`

### Utilidades de Migración y Mantenimiento (>50 archivos)
- Scripts de migración existentes
- Utilidades de debug
- Scripts de fix y actualización

## 3. Colecciones de Firestore Identificadas

### Colecciones Principales
- `users` - Usuarios con campos escolares
- `schoolStudents` - Estudiantes escolares (posible duplicación)
- `schoolTeachers` - Profesores escolares
- `schoolAdmins` - Administradores escolares
- `schools` - Instituciones educativas
- `subjects` - Materias escolares
- `exams` - Exámenes creados por profesores
- `examResults` - Resultados de exámenes
- `teacherKPIs` - Métricas de profesores
- `studentKPIs` - Métricas de estudiantes

## 4. Funcionalidades Dependientes del Sistema Escolar

### Para Profesores
1. Creación y gestión de materias
2. Asignación de cuadernos a estudiantes
3. Creación de exámenes
4. Analytics de clase
5. Seguimiento de progreso de estudiantes

### Para Estudiantes
1. Acceso a materias asignadas
2. Tomar exámenes
3. Ver calificaciones
4. Compararse con compañeros

### Para Administradores
1. Gestión de profesores y estudiantes
2. Generación de contraseñas
3. Analytics institucionales
4. Gestión de suscripciones escolares

## 5. Puntos Críticos de Migración

### Datos a Preservar
- Relaciones profesor-estudiante existentes
- Materias y cuadernos creados
- Historial de exámenes y calificaciones
- Métricas y analytics acumulados
- Progreso de estudio de estudiantes

### Riesgos Identificados
1. **Duplicación de datos**: Múltiples colecciones para el mismo tipo de usuario
2. **Dependencias complejas**: Muchos componentes dependen de schoolRole
3. **Sistema de autenticación**: Contraseñas generadas por admins vs Google Auth
4. **Analytics**: Fuertemente acoplado al modelo escolar actual
5. **Exámenes**: Sistema completo basado en jerarquía escolar

## 6. Estrategia de Migración Recomendada

### Fase Inmediata (Quick Wins)
1. ✅ Eliminar componente roto `PasswordStatusPanel-EmailJS.tsx`
2. ✅ Crear colección `enrollments` para futuro uso
3. ✅ Agregar campo `isTeacher` a UserProfile

### Próximos Pasos
1. Crear scripts de identificación de usuarios
2. Mapear relaciones existentes
3. Preparar sistema de rollback
4. Implementar nuevas estructuras sin afectar las existentes