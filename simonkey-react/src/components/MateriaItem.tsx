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
  teacherName?: string;
  studentCount?: number;
  isAdminView?: boolean;
  exams?: any[];
  isSchoolStudent?: boolean;
  domainProgress?: {
    total: number;
    dominated: number;
    learning: number;
    notStarted: number;
  };
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
  onToggleActions,
  teacherName,
  studentCount,
  isAdminView = false,
  exams = [],
  isSchoolStudent = false,
  domainProgress
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
    // Si hay error, no hacer nada
    if (hasError) {
      return;
    }
    
    // Si es vista de admin, no hacer nada (no navegar)
    if (isAdminView) {
      return;
    }
    
    // Al hacer click en la card, entrar directamente a la materia
    onView(id);
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevenir que se active handleCardClick
    
    // Si hay error, no permitir abrir el menú
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
    <div className="materia-card-wrapper">
      <div className="materia-card">
        <div 
          className="materia-card-content" 
          onClick={handleCardClick}
          style={{ 
            '--materia-color': materiaColor,
            cursor: isAdminView ? 'default' : 'pointer'
          } as React.CSSProperties}
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
            {/* Botón de menú de 3 puntos */}
            <button 
              className="materia-menu-button"
              onClick={handleMenuClick}
              title="Opciones"
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                background: 'rgba(255, 255, 255, 0.9)',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.2s ease',
                zIndex: 2
              }}
            >
              <i 
                className="fas fa-ellipsis-v" 
                style={{ 
                  fontSize: '14px', 
                  color: '#666',
                  transform: 'rotate(0deg)'
                }}
              ></i>
            </button>

            <h3 style={{ paddingRight: '40px' }}>{editableTitle}</h3>
            {isAdminView ? (
              <div className="materia-admin-info">
                <span className="materia-teacher">
                  Profesor: {teacherName || 'Sin asignar'}
                </span>
                <span className="materia-students">
                  {studentCount || 0} estudiante{studentCount !== 1 ? 's' : ''}
                </span>
              </div>
            ) : (
              <div className="materia-info-container">
                <span className="materia-info">
                  {notebookCount} cuaderno{notebookCount !== 1 ? 's' : ''}
                </span>
                {domainProgress && domainProgress.total > 0 && (() => {
                  const percentage = Math.round((domainProgress.dominated / domainProgress.total) * 100);
                  let badgeColor = '#FF6B35'; // Naranja (0-30%)
                  if (percentage > 30 && percentage <= 70) {
                    badgeColor = '#FFD700'; // Amarillo (31-70%)
                  } else if (percentage > 70) {
                    badgeColor = '#10B981'; // Verde (71-100%)
                  }
                  
                  return (
                    <span 
                      className="materia-exams-badge" 
                      title={`${percentage}% dominio`}
                      style={{ 
                        backgroundColor: badgeColor,
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        marginLeft: '8px',
                        cursor: 'help'
                      }}>
                      {percentage}%
                    </span>
                  );
                })()}
                {isSchoolStudent && exams.length > 0 && (
                  <span className="materia-exams-badge" style={{ 
                    backgroundColor: materiaColor,
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    marginLeft: '8px'
                  }}>
                    <i className="fas fa-file-alt" style={{ marginRight: '4px' }}></i>
                    {exams.length} examen{exams.length !== 1 ? 'es' : ''}
                  </span>
                )}
              </div>
            )}
          </>
        )}
        </div>
      </div>
      {showActions && (
        <div 
          className="materia-dropdown-menu"
          style={{
            position: 'absolute',
            top: '40px',
            right: '8px',
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            border: '1px solid #e0e0e0',
            minWidth: '180px',
            zIndex: 10,
            overflow: 'hidden'
          }}
        >
          {!isAdminView && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleView(e);
              }}
              className="dropdown-menu-item" 
              title="Ver cuadernos"
              disabled={hasError}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: 'none',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: hasError ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                color: hasError ? '#ccc' : '#333',
                transition: 'background-color 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (!hasError) {
                  e.currentTarget.style.backgroundColor = '#f5f5f5';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <i className="fas fa-eye" style={{ width: '16px', textAlign: 'center' }}></i>
              <span>Ver cuadernos</span>
            </button>
          )}
          {onEdit && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleEditClick(e);
              }}
              className="dropdown-menu-item" 
              title="Editar nombre"
              disabled={hasError}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: 'none',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: hasError ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                color: hasError ? '#ccc' : '#333',
                transition: 'background-color 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (!hasError) {
                  e.currentTarget.style.backgroundColor = '#f5f5f5';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <i className="fas fa-pencil-alt" style={{ width: '16px', textAlign: 'center' }}></i>
              <span>Editar nombre</span>
            </button>
          )}
          {onColorChange && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleColorClick(e);
              }}
              className="dropdown-menu-item" 
              title="Cambiar color"
              disabled={hasError}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: 'none',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: hasError ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                color: hasError ? '#ccc' : '#333',
                transition: 'background-color 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (!hasError) {
                  e.currentTarget.style.backgroundColor = '#f5f5f5';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <i className="fas fa-palette" style={{ width: '16px', textAlign: 'center' }}></i>
              <span>Cambiar color</span>
            </button>
          )}
          {onDelete && (
            <>
              <div style={{ height: '1px', background: '#e0e0e0', margin: '4px 0' }}></div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(e);
                }}
                className="dropdown-menu-item" 
                title="Eliminar materia"
                disabled={hasError}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: 'none',
                  background: 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: hasError ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  color: hasError ? '#ccc' : '#dc3545',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (!hasError) {
                    e.currentTarget.style.backgroundColor = '#fef2f2';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <i className="fas fa-trash" style={{ width: '16px', textAlign: 'center' }}></i>
                <span>Eliminar materia</span>
              </button>
            </>
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

export default MateriaItem;