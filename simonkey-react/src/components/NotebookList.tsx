// src/components/NotebookList.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import NotebookItem from './NotebookItem';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { createNotebook } from '../services/notebookService';
import '../styles/Notebooks.css';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

// Define la interfaz Notebook localmente en lugar de importarla
interface Notebook {
  id: string;
  title: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  conceptCount: number;
  isShared?: boolean;
  sharedBy?: string;
  color?: string;
  category?: string;
}

interface NotebookListProps {
  notebooks: Notebook[];
  onDeleteNotebook?: (id: string) => void;
  onEditNotebook?: (id: string, title: string) => void;
  showCreateButton?: boolean;
  onCreateNotebook?: () => void;
  isSchoolTeacher?: boolean;
  onColorChange?: (id: string, color: string) => void;
  onAddConcept?: (id: string) => void;
}

const NotebookList: React.FC<NotebookListProps> = ({ 
  notebooks, 
  onDeleteNotebook, 
  onEditNotebook, 
  showCreateButton = false, 
  onCreateNotebook,
  isSchoolTeacher = false,
  onColorChange,
  onAddConcept
}) => {
  console.log('🔍 DEBUG - NotebookList renderizando con:', {
    notebooksCount: notebooks?.length || 0,
    notebooks: notebooks
  });

  // Verificar si notebooks es null o undefined
  if (!notebooks) {
    console.log('🔍 DEBUG - Notebooks es null/undefined');
    return <div>Cargando cuadernos...</div>;
  }

  console.log('🔍 DEBUG - Notebooks no es null, continuando...');

  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newNotebookTitle, setNewNotebookTitle] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedNotebooks, setSelectedNotebooks] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const notebookListRef = useRef<HTMLDivElement>(null);

  console.log('🔍 DEBUG - Estados inicializados, continuando con lógica...');

  // Filtrar cuadernos basado en el término de búsqueda
  const filteredNotebooks = notebooks.filter(notebook =>
    notebook.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (notebook.category && notebook.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Agrupar cuadernos por categoría
  const groupedByCategory = (() => {
    console.log('🔍 DEBUG - Antes del agrupamiento - filteredNotebooks:', {
      count: filteredNotebooks.length,
      data: filteredNotebooks
    });
    
    const grouped: { [key: string]: Notebook[] } = {};
    
    console.log('🔍 DEBUG - Iniciando agrupamiento de cuadernos por categoría');
    console.log('🔍 DEBUG - Total de cuadernos a procesar:', filteredNotebooks.length);
    
    filteredNotebooks.forEach((notebook, index) => {
      console.log(`🔍 DEBUG - Procesando cuaderno ${index}:`, {
        id: notebook.id,
        title: notebook.title,
        category: notebook.category,
        hasCategory: !!(notebook.category && notebook.category.trim() !== ''),
        categoryTrimmed: notebook.category ? notebook.category.trim() : 'undefined'
      });
      
      if (notebook.category && notebook.category.trim() !== '') {
        const categoryKey = notebook.category.trim();
        if (!grouped[categoryKey]) {
          grouped[categoryKey] = [];
        }
        grouped[categoryKey].push(notebook);
        console.log(`✅ DEBUG - Cuaderno ${notebook.id} agregado a categoría "${categoryKey}"`);
      } else {
        console.log(`ℹ️ DEBUG - Cuaderno ${notebook.id} no tiene categoría válida`);
      }
    });
    
    console.log('🔍 DEBUG - Grouped by category:', grouped);
    console.log('🔍 DEBUG - Categories count:', Object.keys(grouped).length);
    console.log('🔍 DEBUG - Categories:', Object.keys(grouped));
    
    return grouped;
  })();

  // Cuadernos sin categoría
  const uncategorizedNotebooks = (() => {
    const uncategorized = filteredNotebooks.filter(notebook => 
      !notebook.category || notebook.category.trim() === ''
    );
    
    console.log('🔍 DEBUG - Uncategorized notebooks:', uncategorized.length);
    console.log('🔍 DEBUG - Uncategorized notebooks data:', uncategorized);
    
    return uncategorized;
  })();

  // Obtener cuadernos ya categorizados para mostrar
  const categorizedNotebooks = notebooks.filter(notebook => notebook.category && notebook.category !== '');

  // Debug: verificar que los cuadernos tengan categorías
  useEffect(() => {
    console.log('🔍 DEBUG - All notebooks:', notebooks);
    console.log('🔍 DEBUG - Filtered notebooks:', filteredNotebooks);
    console.log('🔍 DEBUG - Grouped by category:', groupedByCategory);
    console.log('🔍 DEBUG - Uncategorized notebooks:', uncategorizedNotebooks);
    console.log('🔍 DEBUG - Expanded categories:', Array.from(expandedCategories));
  }, [notebooks, filteredNotebooks, groupedByCategory, uncategorizedNotebooks, expandedCategories]);

  // Efecto para detectar clics fuera de los cuadernos y cerrar acciones
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Si no hay acciones abiertas, no hacer nada
      if (!openActionsId) return;
      
      // Si el clic fue dentro de la lista de cuadernos, no hacer nada
      if (notebookListRef.current && notebookListRef.current.contains(event.target as Node)) {
        return;
      }
      
      // Si el clic fue fuera, cerrar las acciones
      console.log('Clic fuera de cuadernos detectado, cerrando acciones');
      setOpenActionsId(null);
    };

    // Agregar el event listener
    document.addEventListener('mousedown', handleClickOutside);

    // Cleanup function
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openActionsId]);

  const handleCreateNotebook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newNotebookTitle.trim() || isSubmitting) return;
    
    // Limpiar mensaje de error anterior
    setErrorMessage('');
    
    try {
      setIsSubmitting(true);
      await createNotebook(user.uid, newNotebookTitle, '#6147FF');
      setNewNotebookTitle(''); // Clear the form
      setShowCreateModal(false); // Close modal
      onCreateNotebook?.(); // Refresh the notebook list
    } catch (error) {
      console.error("Error creating notebook:", error);
      
      // Mostrar el error al usuario de forma más amigable
      let errorMessage = 'Error al crear el cuaderno';
      
      if (error instanceof Error) {
        if (error.message.includes('Ya existe un cuaderno con ese nombre')) {
          errorMessage = 'Ya existe un cuaderno con ese nombre. Por favor, elige otro nombre.';
        } else if (error.message.includes('Usuario no encontrado')) {
          errorMessage = 'Error: Tu perfil de usuario no se encuentra. Por favor, cierra sesión y vuelve a iniciar sesión.';
        } else if (error.message.includes('Límite de cuadernos alcanzado')) {
          errorMessage = 'Has alcanzado el límite de cuadernos permitidos en tu plan actual.';
        } else if (error.message.includes('Límite semanal')) {
          errorMessage = 'Has alcanzado el límite semanal de cuadernos. Inténtalo de nuevo la próxima semana.';
        } else if (error.message.includes('Error interno')) {
          errorMessage = 'Error interno del sistema. Por favor, intenta de nuevo en unos momentos.';
        } else {
          errorMessage = `Error: ${error.message}`;
        }
      }
      
      setErrorMessage(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newCategoryName.trim()) {
      setErrorMessage('Por favor, ingresa un nombre para la categoría.');
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      console.log('🚀 DEBUG - Iniciando creación de categoría:', newCategoryName);
      console.log('🚀 DEBUG - Cuadernos seleccionados:', selectedNotebooks);
      console.log('🚀 DEBUG - Total de cuadernos disponibles:', uncategorizedNotebooks.length);

      // Asignar cuadernos seleccionados a la nueva categoría
      if (selectedNotebooks.length > 0) {
        console.log('📝 DEBUG - Asignando', selectedNotebooks.length, 'cuadernos a la categoría');
        
        for (const notebookId of selectedNotebooks) {
          try {
            console.log('📝 DEBUG - Procesando cuaderno:', notebookId);
            await updateNotebookCategory(notebookId, newCategoryName.trim());
          } catch (error) {
            console.error(`❌ Error asignando categoría al cuaderno ${notebookId}:`, error);
          }
        }
        
        console.log('✅ DEBUG - Todos los cuadernos procesados');
      } else {
        console.log('ℹ️ DEBUG - No hay cuadernos seleccionados para asignar');
      }
      
      // Mostrar mensaje de éxito
      const successMessage = selectedNotebooks.length > 0 
        ? `Categoría "${newCategoryName}" creada exitosamente y ${selectedNotebooks.length} cuaderno(s) asignado(s).`
        : `Categoría "${newCategoryName}" creada exitosamente.`;
      
      console.log('🎉 DEBUG - Mensaje de éxito:', successMessage);
      alert(successMessage);
      
      // Limpiar formulario
      setNewCategoryName('');
      setSelectedNotebooks([]);
      setShowCategoryModal(false);
      
      // Expandir automáticamente la nueva categoría
      console.log('🔍 DEBUG - Expandir categoría:', newCategoryName.trim());
      setExpandedCategories(prev => {
        const newSet = new Set<string>();
        newSet.add(newCategoryName.trim());
        console.log('🔍 DEBUG - Nuevas categorías expandidas:', Array.from(newSet));
        return newSet;
      });
      
      // Forzar actualización de la lista de cuadernos
      if (onCreateNotebook) {
        console.log('🔄 DEBUG - Llamando onCreateNotebook para forzar actualización');
        onCreateNotebook();
      }
      
    } catch (error) {
      console.error("❌ Error creating category:", error);
      setErrorMessage('Error al crear la categoría. Por favor, intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Función para actualizar la categoría de un cuaderno
  const updateNotebookCategory = async (notebookId: string, category: string) => {
    try {
      console.log('🔧 DEBUG - Actualizando categoría del cuaderno:', notebookId, 'a:', category);
      
      const notebookRef = doc(db, 'notebooks', notebookId);
      
      console.log('🔧 DEBUG - Referencia del documento:', notebookRef.path);
      
      await updateDoc(notebookRef, {
        category: category,
        updatedAt: serverTimestamp()
      });
      
      console.log('✅ DEBUG - Categoría actualizada exitosamente para cuaderno:', notebookId);
      
    } catch (error) {
      console.error('❌ Error updating notebook category:', error);
      throw error;
    }
  };

  // Función para manejar la selección de cuadernos
  const handleNotebookSelection = (notebookId: string) => {
    setSelectedNotebooks(prev => {
      if (prev.includes(notebookId)) {
        return prev.filter(id => id !== notebookId);
      } else {
        return [...prev, notebookId];
      }
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateNotebook(e as any);
    } else if (e.key === 'Escape') {
      setShowCreateModal(false);
      setNewNotebookTitle('');
      setErrorMessage(''); // Limpiar error al cerrar
    }
  };

  const handleCategoryKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateCategory(e as any);
    } else if (e.key === 'Escape') {
      setShowCategoryModal(false);
      setNewCategoryName('');
      setSelectedNotebooks([]);
      setErrorMessage('');
    }
  };

  const handleToggleActions = (notebookId: string) => {
    // Si se hace clic en el mismo cuaderno que ya está abierto, cerrarlo
    if (openActionsId === notebookId) {
      setOpenActionsId(null);
    } else {
      // Si se hace clic en un cuaderno diferente, abrir ese y cerrar el anterior
      setOpenActionsId(notebookId);
    }
  };

  // Función para limpiar error cuando cambia el texto
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewNotebookTitle(e.target.value);
    if (errorMessage) {
      setErrorMessage(''); // Limpiar error cuando el usuario empiece a escribir
    }
  };

  // Agregar/remover clase modal-open al body cuando el modal se abre/cierra
  useEffect(() => {
    if (showCreateModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }

    // Cleanup function para remover la clase cuando el componente se desmonte
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showCreateModal]);

  // Función para alternar la expansión de una categoría
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      
      // Si la categoría ya está expandida, la cerramos
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        // Si se está expandiendo una nueva categoría, cerramos todas las demás
        newSet.clear();
        newSet.add(category);
      }
      
      console.log('🔍 DEBUG - Toggling category:', category, 'New expanded categories:', Array.from(newSet));
      return newSet;
    });
  };

  return (
    <>
      {/* Botón de crear cuaderno, crear categoría, y buscador */}
      <div className="notebook-actions-container">
        <div 
          className="notebook-item create-notebook-card"
          onClick={() => setShowCreateModal(true)}
        >
          <div className="create-notebook-content">
            <div className="create-notebook-icon">+</div>
            <span className="create-notebook-text">Crear nuevo cuaderno</span>
          </div>
        </div>
        
        <div 
          className="notebook-item create-notebook-card"
          onClick={() => setShowCategoryModal(true)}
        >
          <div className="create-notebook-content">
            <div className="create-notebook-icon">📁</div>
            <span className="create-notebook-text">Crear categoría</span>
          </div>
        </div>
        
        <div className="search-container">
          <div className="search-input-wrapper">
            <i className="fas fa-search search-icon"></i>
            <input
              type="text"
              placeholder="Buscar cuadernos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
        </div>
      </div>

      {/* Módulos de categorías - SIEMPRE mostrar si hay categorías */}
      {(() => {
        const hasCategories = Object.keys(groupedByCategory).length > 0;
        console.log('🔍 DEBUG - Renderizando módulos de categorías:', {
          hasCategories,
          categoriesCount: Object.keys(groupedByCategory).length,
          categories: Object.keys(groupedByCategory),
          groupedData: groupedByCategory
        });
        return hasCategories;
      })() && (
        <div className="categories-section">
          <h3 className="categories-section-title">Categorías</h3>
          <div className="categories-grid">
            {Object.entries(groupedByCategory).map(([category, categoryNotebooks]) => {
              console.log('🔍 DEBUG - Rendering category:', category, 'with', categoryNotebooks.length, 'notebooks');
              return (
                <div key={category} className="category-module">
                  <div 
                    className="category-module-header"
                    onClick={() => toggleCategory(category)}
                  >
                    <div className="category-module-title">
                      <span className="category-name">{category}</span>
                      <span className="category-count">({categoryNotebooks.length} cuaderno{categoryNotebooks.length !== 1 ? 's' : ''})</span>
                    </div>
                    <div className={`category-expand-icon ${expandedCategories.has(category) ? 'expanded' : ''}`}>
                      <i className="fas fa-chevron-down"></i>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Categorías expandidas - debajo de todas las categorías */}
      {Object.keys(groupedByCategory).length > 0 && Array.from(expandedCategories).length > 0 && (
        <div className="expanded-categories-section">
          {Array.from(expandedCategories).map(category => {
            const categoryNotebooks = groupedByCategory[category] || [];
            return (
              <div key={category} className="expanded-category-container">
                <div className="expanded-category-header">
                  <h4 className="expanded-category-title">
                    {category} ({categoryNotebooks.length} cuaderno{categoryNotebooks.length !== 1 ? 's' : ''})
                  </h4>
                  <button 
                    className="close-expanded-category"
                    onClick={() => toggleCategory(category)}
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                <div className="expanded-category-notebooks">
                  <div className="expanded-notebooks-grid">
                    {categoryNotebooks.map(notebook => (
                      <NotebookItem
                        key={notebook.id}
                        id={notebook.id}
                        title={notebook.title}
                        color={notebook.color}
                        category={notebook.category}
                        onDelete={onDeleteNotebook}
                        onEdit={onEditNotebook ? (id: string, newTitle: string) => onEditNotebook(id, newTitle) : undefined}
                        onColorChange={onColorChange}
                        showActions={openActionsId === notebook.id}
                        onToggleActions={handleToggleActions}
                        isSchoolNotebook={isSchoolTeacher}
                        onAddConcept={onAddConcept}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Todos mis cuadernos - SIEMPRE mostrar todos los cuadernos */}
      {filteredNotebooks.length > 0 && (
        <div className="categories-section">
          <h3 className="categories-section-title">Todos mis cuadernos</h3>
          <div className="notebook-grid" ref={notebookListRef}>
            {filteredNotebooks.map(notebook => (
              <NotebookItem
                key={notebook.id}
                id={notebook.id}
                title={notebook.title}
                color={notebook.color}
                category={notebook.category}
                onDelete={onDeleteNotebook}
                onEdit={onEditNotebook ? (id: string, newTitle: string) => onEditNotebook(id, newTitle) : undefined}
                onColorChange={onColorChange}
                showActions={openActionsId === notebook.id}
                onToggleActions={handleToggleActions}
                isSchoolNotebook={isSchoolTeacher}
                onAddConcept={onAddConcept}
              />
            ))}
          </div>
        </div>
      )}

      {/* Modal para crear nuevo cuaderno */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content create-notebook-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Crear nuevo cuaderno</h3>
              <button 
                className="close-button" 
                onClick={() => {
                  setShowCreateModal(false);
                  setNewNotebookTitle('');
                  setErrorMessage(''); // Limpiar error al cerrar
                }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateNotebook} className="modal-body">
              <div className="form-group">
                <input
                  type="text"
                  value={newNotebookTitle}
                  onChange={handleTitleChange}
                  onKeyDown={handleKeyPress}
                  placeholder="Ingresa el nombre del cuaderno"
                  className="form-control"
                  autoFocus
                  required
                  disabled={isSubmitting}
                />
                {/* Mensaje de error con símbolo de cuidado */}
                {errorMessage && (
                  <div className="error-message">
                    <span className="error-icon">⚠️</span>
                    <span className="error-text">{errorMessage}</span>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewNotebookTitle('');
                    setErrorMessage(''); // Limpiar error al cancelar
                  }}
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="create-button"
                  disabled={isSubmitting || !newNotebookTitle.trim()}
                >
                  {isSubmitting ? 'Creando...' : 'Crear cuaderno'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para crear nueva categoría */}
      {showCategoryModal && (
        <div className="modal-overlay" onClick={() => setShowCategoryModal(false)}>
          <div className="modal-content create-category-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Crear nueva categoría</h3>
              <button 
                className="close-button" 
                onClick={() => {
                  setShowCategoryModal(false);
                  setNewCategoryName('');
                  setSelectedNotebooks([]);
                  setErrorMessage('');
                }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateCategory} className="modal-body">
              <div className="form-group">
                <label htmlFor="categoryName">Nombre de la categoría</label>
                <input
                  id="categoryName"
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={handleCategoryKeyPress}
                  placeholder="Ej: Quinto Semestre, Matemáticas, etc."
                  className="form-control"
                  autoFocus
                  required
                  disabled={isSubmitting}
                />
              </div>

              {uncategorizedNotebooks.length > 0 && (
                <div className="form-group">
                  <label>Asignar cuadernos a esta categoría (opcional)</label>
                  <div className="notebook-selection-list">
                    {uncategorizedNotebooks.map(notebook => (
                      <div 
                        key={notebook.id} 
                        className={`notebook-selection-item ${selectedNotebooks.includes(notebook.id) ? 'selected' : ''}`}
                        onClick={() => handleNotebookSelection(notebook.id)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedNotebooks.includes(notebook.id)}
                          onChange={() => handleNotebookSelection(notebook.id)}
                          disabled={isSubmitting}
                        />
                        <span className="notebook-title">{notebook.title}</span>
                      </div>
                    ))}
                  </div>
                  <p className="selection-help">
                    Selecciona los cuadernos que quieres asignar a esta categoría. 
                    Puedes crear la categoría sin asignar cuadernos.
                  </p>
                </div>
              )}

              {Object.keys(groupedByCategory).length > 0 && (
                <div className="form-group">
                  <label>Categorías existentes</label>
                  <div className="existing-categories">
                    {Object.entries(groupedByCategory).map(([category, categoryNotebooks]) => (
                      <div key={category} className="existing-category">
                        <strong>{category}</strong> ({categoryNotebooks.length} cuaderno{categoryNotebooks.length !== 1 ? 's' : ''})
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mensaje de error */}
              {errorMessage && (
                <div className="error-message">
                  <span className="error-icon">⚠️</span>
                  <span className="error-text">{errorMessage}</span>
                </div>
              )}

              <div className="modal-footer">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => {
                    setShowCategoryModal(false);
                    setNewCategoryName('');
                    setSelectedNotebooks([]);
                    setErrorMessage('');
                  }}
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="create-button"
                  disabled={isSubmitting || !newCategoryName.trim()}
                >
                  {isSubmitting ? 'Creando...' : 'Crear categoría'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default NotebookList;