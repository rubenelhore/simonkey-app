// src/components/NotebookItem.tsx
import { useNavigate } from 'react-router-dom';
import { deleteNotebook } from '../services/notebookService';
import { useState, useEffect } from 'react';

interface NotebookItemProps {
  id: string;
  title: string;
  color?: string; // Nuevo prop para el color
  onDelete?: (id: string) => void; // Made optional for school students
  onEdit?: (id: string, newTitle: string) => void;
  onColorChange?: (id: string, newColor: string) => void; // Nueva función para actualizar el color
  showActions: boolean; // Nuevo prop para controlar si las acciones están visibles
  onToggleActions: (notebookId: string) => void; // Nueva función para alternar las acciones
  isSchoolNotebook?: boolean; // Nuevo prop
  onAddConcept?: (id: string) => void; // Nueva función para agregar conceptos
}

const NotebookItem: React.FC<NotebookItemProps> = ({ id, title, color, onDelete, onEdit, onColorChange, showActions, onToggleActions, isSchoolNotebook, onAddConcept }) => {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [editableTitle, setEditableTitle] = useState(title);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [notebookColor, setNotebookColor] = useState(color || '#6147FF'); // Color predeterminado
  const [hasError, setHasError] = useState(false); // Estado para manejar errores
  const [isButtonClick, setIsButtonClick] = useState(false); // Estado para prevenir onBlur cuando se hace clic en botón

  useEffect(() => {
    setEditableTitle(title);
  }, [title]);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("¿Estás seguro de que deseas eliminar este cuaderno?")) {
      await deleteNotebook(id);
      if (onDelete) {
        onDelete(id);
      }
    }
  };

  const handleView = () => {
    if (isSchoolNotebook) {
      navigate(`/school/notebooks/${id}`);
    } else {
      navigate(`/notebooks/${id}`);
    }
  };

  const handleCardClick = () => {
    // Si hay error, no permitir abrir las acciones
    if (hasError) {
      return;
    }
    onToggleActions(id);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('Editando cuaderno:', title, 'editableTitle:', editableTitle);
    setEditableTitle(title);
    setIsEditing(true);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    console.log('Cambiando título a:', newValue);
    setEditableTitle(newValue);
    setHasError(false); // Resetear error cuando el usuario cambia el texto
  };

  const handleSave = async () => {
    console.log('=== INICIO handleSave ===');
    
    // Si se hizo clic en el botón, no ejecutar handleSave
    if (isButtonClick) {
      console.log('Clic en botón detectado, saltando handleSave');
      return;
    }
    
    // Si hay error, no permitir guardar
    if (hasError) {
      console.log('Error activo, no permitiendo guardar');
      return;
    }
    
    if (onEdit) {
      try {
        console.log('Llamando a onEdit desde handleSave...');
        await onEdit(id, editableTitle);
        console.log('onEdit completado exitosamente desde handleSave');
        setIsEditing(false);
        setHasError(false);
      } catch (error) {
        console.log('=== ERROR CAPTURADO EN handleSave ===');
        // Si hay error, mostrar error visual y no cerrar edición
        console.error("Error al guardar desde handleSave:", error);
        console.error("Tipo de error:", typeof error);
        console.error("Mensaje de error:", error instanceof Error ? error.message : 'Error desconocido');
        setHasError(true);
        
        // Mostrar alert solo si es un error de nombre duplicado
        if (error instanceof Error && error.message.includes("Ya existe un cuaderno con ese nombre")) {
          console.log("Mostrando alert de nombre duplicado desde handleSave");
          alert(error.message);
        } else {
          console.log('Mensaje de error no coincide:', error instanceof Error ? error.message : 'No es Error');
        }
        
        // NO cerrar el modo de edición
      }
    } else {
      setIsEditing(false);
    }
    console.log('=== FIN handleSave ===');
  };

  const handleValidateAndSave = async () => {
    console.log('=== INICIO handleValidateAndSave ===');
    
    // Marcar que se hizo clic en el botón
    setIsButtonClick(true);
    
    // Si hay error, no permitir guardar
    if (hasError) {
      console.log('Error activo, no permitiendo guardar desde handleValidateAndSave');
      setIsButtonClick(false); // Resetear el flag
      return;
    }
    
    console.log('Intentando guardar con valor:', editableTitle);
    console.log('ID del cuaderno:', id);
    if (onEdit) {
      try {
        console.log('Llamando a onEdit...');
        await onEdit(id, editableTitle);
        console.log('onEdit completado exitosamente');
        setIsEditing(false);
        setHasError(false);
      } catch (error) {
        console.log('=== ERROR CAPTURADO EN NOTEBOOKITEM ===');
        // Si hay error, mostrar error visual y no cerrar edición
        console.error("Error al guardar:", error);
        console.error("Tipo de error:", typeof error);
        console.error("Mensaje de error:", error instanceof Error ? error.message : 'Error desconocido');
        setHasError(true);
        
        // Mostrar alert si es un error de nombre duplicado
        if (error instanceof Error && error.message.includes('Ya existe un cuaderno con ese nombre')) {
          console.log('Error de nombre duplicado detectado en handleValidateAndSave');
          // No mostrar alert aquí, ya se muestra en handleSave
        } else {
          console.log('Error no es de nombre duplicado, mostrando alert genérico');
          alert('Error al guardar el nombre del cuaderno.');
        }
        
        // NO cerrar el modo de edición
      }
    } else {
      console.log('No hay función onEdit disponible');
      setIsEditing(false);
    }
    
    // Resetear el flag después de un pequeño delay
    setTimeout(() => {
      setIsButtonClick(false);
    }, 100);
    
    console.log('=== FIN handleValidateAndSave ===');
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      await handleSave();
    }
  };

  const handleColorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowColorPicker(!showColorPicker);
  };

  const handleColorChange = (newColor: string) => {
    setNotebookColor(newColor);
    setShowColorPicker(false);
    if (onColorChange) {
      onColorChange(id, newColor);
    }
  };

  return (
    <div 
      className="notebook-card"
    >
      <div 
        className="notebook-card-content" 
        onClick={handleCardClick}
        style={{ '--notebook-color': notebookColor } as React.CSSProperties}
      >
        {isEditing ? (
          <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
            <div style={{ flex: 1 }}>
              <input 
                type="text"
                value={editableTitle}
                onChange={handleTitleChange}
                onKeyDown={handleKeyDown}
                onBlur={handleSave}
                autoFocus
                style={{ 
                  width: '100%',
                  padding: '8px 12px',
                  border: hasError ? '2px solid #ff6b6b' : '2px solid #e0e0e0',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  background: '#ffffff',
                  color: hasError ? '#ff6b6b' : '#333333',
                  outline: 'none',
                  boxSizing: 'border-box',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                }}
              />
            </div>
            <button 
              onClick={handleValidateAndSave}
              disabled={hasError}
              style={{
                background: hasError ? 'rgba(255, 107, 107, 0.3)' : notebookColor,
                border: 'none',
                color: 'white',
                cursor: hasError ? 'not-allowed' : 'pointer',
                marginLeft: '16px',
                fontSize: '1.2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '38px',
                width: '38px',
                borderRadius: '50%',
                boxShadow: hasError ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.15)',
                transition: 'background 0.2s, box-shadow 0.2s',
                opacity: hasError ? 0.5 : 1
              }}
            >
              <i className="fas fa-arrow-right"></i>
            </button>
          </div>
        ) : (
          <h3>{editableTitle}</h3>
        )}
      </div>
      {showActions && (
        <div 
          className="notebook-card-actions"
          style={{ backgroundColor: notebookColor }}
        >
          {onAddConcept && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onAddConcept(id);
              }}
              className="action-add-concept" 
              title="Agregar concepto"
              disabled={hasError}
              style={{ 
                backgroundColor: notebookColor,
                opacity: hasError ? 0.5 : 1, 
                cursor: hasError ? 'not-allowed' : 'pointer' 
              }}
            >
              <i className="fas fa-plus"></i>
            </button>
          )}
          <button 
            onClick={handleView} 
            className="action-view" 
            title="Ver cuaderno"
            disabled={hasError}
            style={{ 
              backgroundColor: notebookColor,
              opacity: hasError ? 0.5 : 1, 
              cursor: hasError ? 'not-allowed' : 'pointer' 
            }}
          >
            <i className="fas fa-eye"></i>
          </button>
          {onColorChange && (
            <button 
              onClick={handleColorClick} 
              className="action-color" 
              title="Cambiar color"
              disabled={hasError}
              style={{ 
                backgroundColor: notebookColor,
                opacity: hasError ? 0.5 : 1, 
                cursor: hasError ? 'not-allowed' : 'pointer' 
              }}
            >
              <i className="fas fa-palette"></i>
            </button>
          )}
          {onEdit && (
            <button 
              onClick={handleEditClick} 
              className="action-edit" 
              title="Editar nombre"
              disabled={hasError}
              style={{ 
                backgroundColor: notebookColor,
                opacity: hasError ? 0.5 : 1, 
                cursor: hasError ? 'not-allowed' : 'pointer' 
              }}
            >
              <i className="fas fa-pencil-alt"></i>
            </button>
          )}
          {onDelete && (
            <button 
              onClick={handleDelete} 
              className="action-delete" 
              title="Eliminar cuaderno"
              disabled={hasError}
              style={{ 
                backgroundColor: notebookColor,
                opacity: hasError ? 0.5 : 1, 
                cursor: hasError ? 'not-allowed' : 'pointer' 
              }}
            >
              <i className="fas fa-trash"></i>
            </button>
          )}
        </div>
      )}
      {showColorPicker && (
        <div className="color-picker-container">
          <div className="color-picker">
            {['#6147FF', '#FF6B6B', '#4CAF50', '#FFD700', '#FF8C00', '#9C27B0'].map(color => (
              <button
                key={color}
                className="color-option"
                style={{ backgroundColor: color }}
                onClick={() => handleColorChange(color)}
                title={`Seleccionar color ${color}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotebookItem;