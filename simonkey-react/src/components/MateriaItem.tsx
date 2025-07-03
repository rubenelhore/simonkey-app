// src/components/MateriaItem.tsx
import { useState, useEffect } from 'react';

interface MateriaItemProps {
  id: string;
  title: string;
  color?: string;
  category?: string;
  notebookCount: number;
  onDelete?: (id: string) => void;
  onEdit?: (id: string, newTitle: string) => void;
  onColorChange?: (id: string, newColor: string) => void;
  onView: (id: string) => void;
  showActions: boolean;
  onToggleActions: (materiaId: string) => void;
}

const MateriaItem: React.FC<MateriaItemProps> = ({ 
  id, 
  title, 
  color, 
  category, 
  notebookCount,
  onDelete, 
  onEdit, 
  onColorChange, 
  onView,
  showActions, 
  onToggleActions 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editableTitle, setEditableTitle] = useState(title);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [materiaColor, setMateriaColor] = useState(color || '#6147FF');
  const [hasError, setHasError] = useState(false);
  const [isButtonClick, setIsButtonClick] = useState(false);

  useEffect(() => {
    setEditableTitle(title);
  }, [title]);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("¿Estás seguro de que deseas eliminar esta materia?")) {
      if (onDelete) {
        onDelete(id);
      }
    }
  };

  const handleView = (e: React.MouseEvent) => {
    e.stopPropagation();
    onView(id);
  };

  const handleCardClick = () => {
    if (hasError) {
      return;
    }
    onToggleActions(id);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditableTitle(title);
    setIsEditing(true);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setEditableTitle(newValue);
    setHasError(false);
  };

  const handleSave = async () => {
    if (isButtonClick) {
      return;
    }
    
    if (hasError) {
      return;
    }
    
    if (onEdit) {
      try {
        await onEdit(id, editableTitle);
        setIsEditing(false);
        setHasError(false);
      } catch (error) {
        setHasError(true);
        
        if (error instanceof Error && error.message.includes("Ya existe una materia con ese nombre")) {
          alert(error.message);
        }
      }
    } else {
      setIsEditing(false);
    }
  };

  const handleValidateAndSave = async () => {
    setIsButtonClick(true);
    
    if (hasError) {
      setIsButtonClick(false);
      return;
    }
    
    if (onEdit) {
      try {
        await onEdit(id, editableTitle);
        setIsEditing(false);
        setHasError(false);
      } catch (error) {
        setHasError(true);
        
        if (error instanceof Error && error.message.includes('Ya existe una materia con ese nombre')) {
          // Error ya se muestra en handleSave
        } else {
          alert('Error al guardar el nombre de la materia.');
        }
      }
    } else {
      setIsEditing(false);
    }
    
    setTimeout(() => {
      setIsButtonClick(false);
    }, 100);
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
    setMateriaColor(newColor);
    setShowColorPicker(false);
    if (onColorChange) {
      onColorChange(id, newColor);
    }
  };

  return (
    <div className="materia-card">
      <div 
        className="materia-card-content" 
        onClick={handleCardClick}
        style={{ '--materia-color': materiaColor } as React.CSSProperties}
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
                background: hasError ? 'rgba(255, 107, 107, 0.3)' : materiaColor,
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
          <>
            <h3>{editableTitle}</h3>
            <span className="materia-info">
              {notebookCount} cuaderno{notebookCount !== 1 ? 's' : ''}
            </span>
          </>
        )}
      </div>
      <div 
        className="materia-card-actions"
        style={{ 
          backgroundColor: materiaColor,
          transform: showActions ? 'translateY(0)' : 'translateY(100%)'
        }}
      >
          <button 
            onClick={handleView} 
            className="action-view" 
            title="Ver cuadernos"
            disabled={hasError}
            style={{ 
              backgroundColor: materiaColor,
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
                backgroundColor: materiaColor,
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
                backgroundColor: materiaColor,
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
              title="Eliminar materia"
              disabled={hasError}
              style={{ 
                backgroundColor: materiaColor,
                opacity: hasError ? 0.5 : 1, 
                cursor: hasError ? 'not-allowed' : 'pointer' 
              }}
            >
              <i className="fas fa-trash"></i>
            </button>
          )}
        </div>
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

export default MateriaItem;