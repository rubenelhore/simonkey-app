# Mejoras en el Manejo de Errores del Frontend

## 🎯 Objetivo
Mejorar el manejo de errores en el frontend para aprovechar el nuevo sistema de logging estructurado del backend, eliminando los `alert()` genéricos y proporcionando una mejor experiencia de usuario.

## 🔄 Cambios Recomendados

### 1. Reemplazar `alert()` con Componentes de UI Modernos

#### ❌ Antes (Problemático):
```typescript
try {
  const result = await deleteUserData({ userId, deletedBy });
  alert('Usuario eliminado exitosamente');
} catch (error) {
  console.error('Error:', error);
  alert('Error eliminando usuario. Inténtalo de nuevo.');
}
```

#### ✅ Después (Mejorado):
```typescript
import { toast } from 'react-hot-toast'; // o tu librería de notificaciones preferida

try {
  const result = await deleteUserData({ userId, deletedBy });
  
  // Usar la información estructurada del backend
  toast.success(result.message || 'Usuario eliminado exitosamente', {
    duration: 4000,
    icon: '🗑️'
  });
  
  // Log estructurado para debugging
  console.info('Eliminación exitosa:', {
    requestId: result.requestId,
    deletedItems: result.deletedItems,
    timestamp: new Date().toISOString()
  });
  
} catch (error: any) {
  // Extraer información estructurada del error
  const errorDetails = error?.details || {};
  const userMessage = error?.message || 'Error inesperado. Inténtalo de nuevo.';
  const requestId = errorDetails?.requestId;
  
  // Mostrar error user-friendly
  toast.error(userMessage, {
    duration: 6000,
    icon: '❌'
  });
  
  // Log estructurado para soporte técnico
  console.error('Error en eliminación de usuario:', {
    message: userMessage,
    requestId: requestId,
    errorCode: error?.code,
    timestamp: new Date().toISOString(),
    userId: userId,
    stackTrace: error?.stack
  });
  
  // Opcional: Reportar error crítico para casos extremos
  if (error?.code === 'internal') {
    console.warn('🚨 Error interno detectado - Request ID:', requestId);
    // Aquí podrías enviar el requestId a un sistema de soporte
  }
}
```

### 2. Crear un Hook Personalizado para Manejo de Errores

```typescript
// hooks/useErrorHandler.ts
import { toast } from 'react-hot-toast';
import { useCallback } from 'react';

interface ErrorDetails {
  requestId?: string;
  timestamp?: string;
  context?: string;
}

export const useErrorHandler = () => {
  const handleError = useCallback((error: any, context?: string) => {
    const errorDetails: ErrorDetails = error?.details || {};
    const userMessage = error?.message || 'Ocurrió un error inesperado.';
    const requestId = errorDetails?.requestId;
    
    // Mostrar al usuario
    toast.error(userMessage, {
      duration: 6000,
      icon: '❌',
      id: requestId // Evita duplicados
    });
    
    // Log para debugging/soporte
    console.error(`Error en ${context || 'operación'}:`, {
      message: userMessage,
      requestId: requestId,
      errorCode: error?.code,
      timestamp: new Date().toISOString(),
      context: context,
      originalError: error
    });
    
    return {
      requestId,
      userMessage,
      isInternal: error?.code === 'internal'
    };
  }, []);
  
  const handleSuccess = useCallback((result: any, message?: string, context?: string) => {
    const successMessage = message || result?.message || 'Operación completada exitosamente';
    
    toast.success(successMessage, {
      duration: 4000,
      icon: '✅'
    });
    
    console.info(`Éxito en ${context || 'operación'}:`, {
      message: successMessage,
      requestId: result?.requestId,
      timestamp: new Date().toISOString(),
      context: context,
      result: result
    });
    
    return result;
  }, []);
  
  return { handleError, handleSuccess };
};
```

### 3. Implementar en Componentes

```typescript
// components/UserDataManagement.tsx
import { useErrorHandler } from '../hooks/useErrorHandler';

export const UserDataManagement = () => {
  const { handleError, handleSuccess } = useErrorHandler();
  const [isDeleting, setIsDeleting] = useState(false);
  
  const handleDeleteUser = async (userId: string) => {
    setIsDeleting(true);
    
    try {
      const result = await deleteUserData({ 
        userId, 
        deletedBy: currentUser.uid 
      });
      
      handleSuccess(result, undefined, 'eliminación de usuario');
      
      // Actualizar UI con información detallada
      setDeletedStats(result.deletedItems);
      
    } catch (error) {
      const errorInfo = handleError(error, 'eliminación de usuario');
      
      // Manejo específico para errores internos
      if (errorInfo.isInternal) {
        // Opcional: Mostrar formulario de reporte de bug con requestId
        setShowBugReportModal({
          visible: true,
          requestId: errorInfo.requestId,
          context: 'eliminación de usuario'
        });
      }
      
    } finally {
      setIsDeleting(false);
    }
  };
  
  return (
    <div>
      <button 
        onClick={() => handleDeleteUser(selectedUserId)}
        disabled={isDeleting}
        className="btn-danger"
      >
        {isDeleting ? 'Eliminando...' : 'Eliminar Usuario'}
      </button>
      
      {/* Componente de reporte de bugs para errores críticos */}
      <BugReportModal 
        isOpen={showBugReportModal.visible}
        requestId={showBugReportModal.requestId}
        context={showBugReportModal.context}
        onClose={() => setShowBugReportModal({ visible: false })}
      />
    </div>
  );
};
```

### 4. Componente de Reporte de Bugs para Errores Críticos

```typescript
// components/BugReportModal.tsx
interface BugReportModalProps {
  isOpen: boolean;
  requestId?: string;
  context?: string;
  onClose: () => void;
}

export const BugReportModal: React.FC<BugReportModalProps> = ({
  isOpen, requestId, context, onClose
}) => {
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Enviar reporte con requestId para trazabilidad
      await submitBugReport({
        requestId,
        context,
        description,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        url: window.location.href
      });
      
      toast.success('Reporte enviado. Nuestro equipo investigará el problema.');
      onClose();
      
    } catch (error) {
      toast.error('Error enviando reporte. Por favor, contacta al soporte.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>🐛 Reportar Problema</h3>
        <p>
          Ocurrió un error interno. Tu información ayudará a nuestro equipo a solucionarlo.
        </p>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>ID de Rastreo:</label>
            <input 
              type="text" 
              value={requestId || 'No disponible'} 
              readOnly 
              className="form-control"
            />
            <small>Este ID ayuda a nuestro equipo a encontrar el problema en los logs.</small>
          </div>
          
          <div className="form-group">
            <label>Describe qué estabas haciendo:</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ejemplo: Estaba intentando eliminar un usuario cuando apareció el error..."
              className="form-control"
              rows={4}
            />
          </div>
          
          <div className="form-actions">
            <button type="button" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </button>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Enviando...' : 'Enviar Reporte'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
```

### 5. Sistema de Notificaciones Mejorado

```typescript
// utils/notifications.ts
import { toast } from 'react-hot-toast';

export const showOperationProgress = (
  operationName: string,
  promise: Promise<any>
) => {
  return toast.promise(
    promise,
    {
      loading: `${operationName} en progreso...`,
      success: (result) => {
        const message = result?.message || `${operationName} completado exitosamente`;
        const details = result?.deletedItems ? 
          `\n${Object.values(result.deletedItems).reduce((a: any, b: any) => a + b, 0)} elementos procesados` : '';
        return message + details;
      },
      error: (error) => {
        const message = error?.message || `Error en ${operationName}`;
        const requestId = error?.details?.requestId;
        
        // Log para soporte técnico
        console.error(`Error en ${operationName}:`, {
          requestId,
          error: error,
          timestamp: new Date().toISOString()
        });
        
        return requestId ? 
          `${message}\nID de rastreo: ${requestId}` : 
          message;
      }
    },
    {
      style: {
        minWidth: '300px',
      },
      success: {
        duration: 4000,
        icon: '✅',
      },
      error: {
        duration: 8000,
        icon: '❌',
      },
    }
  );
};

// Uso:
const handleDeleteUser = async () => {
  await showOperationProgress(
    'Eliminación de usuario',
    deleteUserData({ userId, deletedBy })
  );
};
```

## 📊 Beneficios de estos Cambios

### Para Usuarios:
- ✅ **Notificaciones modernas**: Reemplazo de `alert()` con toast notifications
- ✅ **Mensajes claros**: Información específica sobre lo que pasó
- ✅ **Progreso visible**: Loading states y confirmaciones
- ✅ **Recuperación guiada**: Opciones claras cuando algo falla

### Para Desarrolladores:
- 🔍 **Debugging mejorado**: Request IDs para rastrear problemas específicos
- 📊 **Logs estructurados**: Información consistente en console
- 🛠️ **Reportes de bugs**: Sistema automático para errores críticos
- ⚡ **Desarrollo más rápido**: Menos tiempo investigando problemas

### Para Soporte Técnico:
- 🎯 **Identificación rápida**: Request IDs conectan frontend con backend logs
- 📈 **Métricas de errores**: Patrones de problemas del usuario
- 🚀 **Resolución más rápida**: Contexto completo de cada problema
- 📋 **Reportes automáticos**: Información estructurada de bugs

## 🔄 Plan de Migración

1. **Instalar dependencias de UI**:
   ```bash
   npm install react-hot-toast
   # o
   npm install react-toastify
   ```

2. **Crear hooks y utilities** (useErrorHandler, notifications)

3. **Refactorizar componentes críticos** (UserDataManagement, etc.)

4. **Reemplazar `alert()` y `console.error()` genéricos**

5. **Implementar sistema de reportes de bugs**

6. **Testing y validación** con usuarios beta

---

**Con estos cambios, el frontend y backend trabajarán en armonía para proporcionar una experiencia de usuario superior y un sistema de soporte técnico más eficiente.**