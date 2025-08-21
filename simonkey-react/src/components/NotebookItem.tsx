// src/components/NotebookItem.tsx
import { useNavigate } from 'react-router-dom';
import { deleteNotebook } from '../services/notebookService';
import { useState, useEffect } from 'react';
import { decodeMateriaName, encodeNotebookName } from '../utils/urlUtils';
import { generateNotebookUrl } from '../utils/slugify';
import { CacheManager } from '../utils/cacheManager';
import { useAuth } from '../contexts/AuthContext';
import { useUserType } from '../hooks/useUserType';

interface NotebookItemProps {
  id: string;
  title: string;
  color?: string; // Nuevo prop para el color
  category?: string; // Nuevo prop para la categoría
  conceptCount?: number; // Nuevo prop para el conteo de conceptos
  onDelete?: (id: string) => void; // Made optional for school students
  onEdit?: (id: string, newTitle: string) => void;
  onColorChange?: (id: string, newColor: string) => void; // Nueva función para actualizar el color
  showActions: boolean; // Nuevo prop para controlar si las acciones están visibles
  onToggleActions: (notebookId: string) => void; // Nueva función para alternar las acciones
  isSchoolNotebook?: boolean; // Nuevo prop
  onAddConcept?: (id: string) => void; // Nueva función para agregar conceptos
  isFrozen?: boolean; // Nuevo prop para indicar si el cuaderno está congelado
  onFreeze?: (id: string) => void; // Nueva función para congelar/descongelar
  isTeacher?: boolean; // Para mostrar botón de congelar solo a profesores
  domainProgress?: { // Nuevo prop para el progreso de dominio
    total: number;
    dominated: number;
    learning: number;
    notStarted: number;
  };
  isStudent?: boolean; // Para mostrar el progreso solo a estudiantes
  isEnrolled?: boolean; // Para ocultar opciones en cuadernos de materias inscritas
}

const NotebookItem: React.FC<NotebookItemProps> = ({ id, title, color, category, conceptCount, onDelete, onEdit, onColorChange, showActions, onToggleActions, isSchoolNotebook, onAddConcept, isFrozen, onFreeze, isTeacher, domainProgress, isStudent, isEnrolled = false }) => {
  const { user } = useAuth();
  const { isSchoolAdmin } = useUserType();
  console.log('📝 NotebookItem recibió props:', {
    id,
    title,
    hasTitle: !!title,
    titleType: typeof title,
    titleLength: title?.length || 0
  });
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [editableTitle, setEditableTitle] = useState(title);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [notebookColor, setNotebookColor] = useState(color || '#6147FF'); // Color predeterminado
  const [hasError, setHasError] = useState(false); // Estado para manejar errores
  const [isButtonClick, setIsButtonClick] = useState(false); // Estado para prevenir onBlur cuando se hace clic en botón
  const [showFrozenTooltip, setShowFrozenTooltip] = useState(false); // Estado para mostrar tooltip de congelado
  
  // Mostrar automáticamente el tooltip cuando se congela
  useEffect(() => {
    if (isFrozen) {
      setShowFrozenTooltip(true);
      const timer = setTimeout(() => {
        setShowFrozenTooltip(false);
      }, 5000); // Mostrar por 5 segundos
      return () => clearTimeout(timer);
    }
  }, [isFrozen]);

  useEffect(() => {
    console.log('🔄 Actualizando editableTitle:', { oldTitle: editableTitle, newTitle: title });
    setEditableTitle(title);
  }, [title]);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("¿Estás seguro de que deseas eliminar este cuaderno?")) {
      // Si hay un callback personalizado, usarlo (para profesores/admin escolar)
      if (onDelete) {
        await onDelete(id);
      } else {
        // Si no, usar el servicio regular
        await deleteNotebook(id);
      }
      
      // Invalidar caché de materias en la página de inicio
      if (user?.uid) {
        console.log('🗑️ Cuaderno eliminado, invalidando cache de materias...');
        CacheManager.invalidateMateriasCache(user.uid);
      }
    }
  };

  const handleView = () => {
    console.log('🚨🚨🚨 HANDLE VIEW LLAMADO');
    console.log('Props:', { id, title, isTeacher, isSchoolAdmin, isFrozen, isSchoolNotebook });
    console.log('🔴 isSchoolNotebook valor:', isSchoolNotebook);
    
    // Si el cuaderno está congelado y no es profesor, no permitir abrir
    if (isFrozen && !isTeacher) {
      console.log('❌ Bloqueado: notebook congelado y no es profesor');
      return;
    }
    
    // Usar ID + slug para la navegación
    const notebookUrl = generateNotebookUrl(id, title);
    console.log('📍 URL generada:', notebookUrl);
    
    // Detectar si estamos en una ruta de materia para mantener el contexto
    const materiaMatch = window.location.pathname.match(/\/materias\/([^\/]+)/);
    
    // FORZAR que los profesores NUNCA vayan a school notebooks
    if (isSchoolNotebook && !isTeacher && !isSchoolAdmin) {
      // Solo estudiantes escolares van a school notebooks
      console.log('🏫 Navegando a notebook escolar:', `/school/notebooks/${notebookUrl}`);
      navigate(`/school/notebooks/${notebookUrl}`);
    } else if (materiaMatch) {
      // Si estamos en una ruta de materia, mantener el contexto de la materia
      const materiaNameWithId = materiaMatch[1];
      const targetUrl = `/materias/${materiaNameWithId}/notebooks/${notebookUrl}`;
      console.log('🎯 NAVEGANDO CON CONTEXTO DE MATERIA:', targetUrl);
      navigate(targetUrl);
    } else {
      // Si no hay contexto de materia, ir a notebooks regular
      const targetUrl = `/notebooks/${notebookUrl}`;
      console.log('🎯 NAVEGANDO SIN CONTEXTO DE MATERIA:', targetUrl);
      navigate(targetUrl);
    }
  };

  const handleCardClick = () => {
    console.log('🖱️ CARD CLICK DETECTADO');
    console.log('Estado:', { hasError, isFrozen, isTeacher });
    
    // Si hay error, no hacer nada
    if (hasError) {
      console.log('❌ Bloqueado: hay error');
      return;
    }
    
    // Si el cuaderno está congelado y no es profesor, no permitir abrir
    if (isFrozen && !isTeacher) {
      console.log('❌ Bloqueado: congelado y no es profesor');
      return;
    }
    
    // Al hacer click en la card, entrar directamente al cuaderno
    console.log('✅ Llamando handleView...');
    handleView();
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevenir que se active handleCardClick
    
    // Si hay error, no permitir abrir el menú
    if (hasError) {
      return;
    }
    
    // Si el cuaderno está congelado y no es profesor, no permitir abrir menú
    if (isFrozen && !isTeacher) {
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
  
  const handleFreezeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onFreeze) {
      onFreeze(id);
    }
  };

  return (
    <div className="materia-card-wrapper">
      <div className="materia-card">
        <div 
          className={`materia-card-content ${isFrozen ? 'frozen' : ''}`}
          onClick={handleCardClick}
          style={{ 
            '--materia-color': notebookColor,
            cursor: (isFrozen && !isTeacher) ? 'not-allowed' : 'pointer'
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
          <>
            {/* Botón de menú de 3 puntos - oculto para estudiantes y cuadernos de materias inscritas */}
            {!isStudent && !isEnrolled && (
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
            )}

            <h3 style={{ paddingRight: (isStudent || isEnrolled) ? '8px' : '40px' }}>{editableTitle}</h3>
            <div className="materia-info-container">
              <span className="materia-info">
                {conceptCount || 0} concepto{(conceptCount || 0) !== 1 ? 's' : ''}
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
            </div>
            {isFrozen && (
              <div className="frozen-indicator-subtle">
                <i className="fas fa-snowflake"></i>
                <span>Congelado</span>
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
          {!(isFrozen && !isTeacher) && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleView();
              }}
              className="dropdown-menu-item" 
              title="Ver cuaderno"
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
              <span>Ver cuaderno</span>
            </button>
          )}
          {onAddConcept && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onAddConcept(id);
              }}
              className="dropdown-menu-item" 
              title="Agregar concepto"
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
              <i className="fas fa-plus" style={{ width: '16px', textAlign: 'center' }}></i>
              <span>Agregar concepto</span>
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
          {isTeacher && onFreeze && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleFreezeClick(e);
              }}
              className="dropdown-menu-item" 
              title={isFrozen ? "Descongelar cuaderno" : "Congelar cuaderno"}
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
              <i className={`fas ${isFrozen ? 'fa-sun' : 'fa-snowflake'}`} style={{ width: '16px', textAlign: 'center' }}></i>
              <span>{isFrozen ? 'Descongelar' : 'Congelar'}</span>
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
                title="Eliminar cuaderno"
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
                <span>Eliminar cuaderno</span>
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

export default NotebookItem;