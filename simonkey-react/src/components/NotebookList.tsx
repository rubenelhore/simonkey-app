// src/components/NotebookList.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import NotebookItem from './NotebookItem';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { createNotebook } from '../services/notebookService';
import '../styles/Notebooks.css';
import { doc, updateDoc, serverTimestamp, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
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
  selectedCategory?: string | null;
  showCategoryModal?: boolean;
  onCloseCategoryModal?: () => void;
  onClearSelectedCategory?: () => void;
  onRefreshCategories?: () => void;
}

const NotebookList: React.FC<NotebookListProps> = ({ 
  notebooks, 
  onDeleteNotebook, 
  onEditNotebook, 
  showCreateButton = false, 
  onCreateNotebook,
  isSchoolTeacher = false,
  onColorChange,
  onAddConcept,
  selectedCategory,
  showCategoryModal = false,
  onCloseCategoryModal,
  onClearSelectedCategory,
  onRefreshCategories
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
  const [showDeleteCategoryModal, setShowDeleteCategoryModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string>('');
  const notebookListRef = useRef<HTMLDivElement>(null);
  const [showAddNotebookModal, setShowAddNotebookModal] = useState(false);
  const [categoryToAddNotebook, setCategoryToAddNotebook] = useState<string | null>(null);
  const [selectedNotebooksToAdd, setSelectedNotebooksToAdd] = useState<string[]>([]);

  console.log('🔍 DEBUG - Estados inicializados, continuando con lógica...');

  // Filtrar cuadernos basado en el término de búsqueda
  const filteredNotebooks = notebooks.filter(notebook =>
    notebook.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (notebook.category && notebook.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Filtrar cuadernos por categoría seleccionada
  const notebooksBySelectedCategory = selectedCategory 
    ? filteredNotebooks.filter(notebook => notebook.category === selectedCategory)
    : filteredNotebooks;

  // Agrupar cuadernos por categoría para mostrar en el modal de crear categoría
  const groupedByCategory = filteredNotebooks.reduce((acc, notebook) => {
    // Solo agrupar cuadernos que tienen categoría
    if (notebook.category && notebook.category.trim() !== '') {
      const category = notebook.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(notebook);
    }
    return acc;
  }, {} as Record<string, Notebook[]>);

  // Cuadernos sin categoría (para el modal de crear categoría)
  const uncategorizedNotebooks = filteredNotebooks.filter(notebook => 
    !notebook.category || notebook.category.trim() === ''
  );

  // Obtener cuadernos ya categorizados para mostrar
  const categorizedNotebooks = notebooks.filter(notebook => notebook.category && notebook.category !== '');

  // Debug: verificar que los cuadernos tengan categorías
  useEffect(() => {
    console.log('🔍 DEBUG - All notebooks:', notebooks);
    console.log('🔍 DEBUG - Filtered notebooks:', filteredNotebooks);
    console.log('🔍 DEBUG - Grouped by category:', groupedByCategory);
    console.log('🔍 DEBUG - Uncategorized notebooks:', uncategorizedNotebooks);
    console.log('🔍 DEBUG - Selected category:', selectedCategory);
    console.log('🔍 DEBUG - Notebooks by selected category:', notebooksBySelectedCategory);
  }, [notebooks, filteredNotebooks, groupedByCategory, uncategorizedNotebooks, selectedCategory, notebooksBySelectedCategory]);

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
    
    if (!newNotebookTitle.trim()) {
      setErrorMessage('Por favor, ingresa un título para el cuaderno.');
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage('');

    if (!user) {
      setErrorMessage('Debes estar autenticado para crear un cuaderno.');
      setIsSubmitting(false);
      return;
    }

    try {
      const notebook = await createNotebook(user.uid, newNotebookTitle.trim());
      console.log('✅ Notebook created:', notebook);
      
      setNewNotebookTitle('');
      setShowCreateModal(false);
      
      if (onCreateNotebook) {
        onCreateNotebook();
      }
    } catch (error) {
      console.error("❌ Error creating notebook:", error);
      setErrorMessage('Error al crear el cuaderno. Por favor, intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Función para verificar si una categoría ya existe
  const checkCategoryExists = async (categoryName: string): Promise<boolean> => {
    try {
      if (!user) return false;
      
      console.log('🔍 DEBUG - Verificando si existe categoría:', categoryName);
      
      // Verificar en la colección de categorías
      const categoryRef = doc(db, 'categories', `${user.uid}_${categoryName}`);
      const categoryDoc = await getDoc(categoryRef);
      
      if (categoryDoc.exists()) {
        console.log('✅ DEBUG - Categoría encontrada en colección de categorías');
        return true;
      }
      
      // Verificar en los cuadernos existentes
      const notebooksWithCategory = notebooks.filter(notebook => 
        notebook.category && notebook.category.trim().toLowerCase() === categoryName.trim().toLowerCase()
      );
      
      if (notebooksWithCategory.length > 0) {
        console.log('✅ DEBUG - Categoría encontrada en cuadernos existentes');
        return true;
      }
      
      console.log('❌ DEBUG - Categoría no encontrada, se puede crear');
      return false;
      
    } catch (error) {
      console.error('❌ Error checking category existence:', error);
      return false; // En caso de error, permitir crear la categoría
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
      
      // Verificar si la categoría ya existe
      const categoryExists = await checkCategoryExists(newCategoryName.trim());
      if (categoryExists) {
        setErrorMessage(`Ya existe una categoría con el nombre "${newCategoryName.trim()}". Por favor, elige otro nombre.`);
        setIsSubmitting(false);
        return;
      }
      
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
      
      // Guardar la categoría en la colección de categorías (siempre)
      await saveCategoryToCollection(newCategoryName.trim());
      
      // Mostrar mensaje de éxito
      const successMessage = selectedNotebooks.length > 0 
        ? `Categoría "${newCategoryName}" creada exitosamente y ${selectedNotebooks.length} cuaderno(s) asignado(s).`
        : `Categoría "${newCategoryName}" creada exitosamente.`;
      
      console.log('🎉 DEBUG - Mensaje de éxito:', successMessage);
      alert(successMessage);
      
      // Limpiar formulario
      setNewCategoryName('');
      setSelectedNotebooks([]);
      handleCloseCategoryModal();
      
      // Forzar actualización de la lista de cuadernos
      if (onCreateNotebook) {
        console.log('🔄 DEBUG - Llamando onCreateNotebook para forzar actualización');
        onCreateNotebook();
      }
      
      // Forzar actualización de categorías
      if (onRefreshCategories) {
        console.log('🔄 DEBUG - Llamando onRefreshCategories para actualizar categorías');
        onRefreshCategories();
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

  // Función para guardar una categoría en la colección de categorías
  const saveCategoryToCollection = async (categoryName: string) => {
    try {
      if (!user) return;
      
      console.log('🔧 DEBUG - Guardando categoría en colección:', categoryName);
      
      // Crear un documento con el nombre de la categoría como ID
      const categoryRef = doc(db, 'categories', `${user.uid}_${categoryName}`);
      
      await setDoc(categoryRef, {
        userId: user.uid,
        name: categoryName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      console.log('✅ DEBUG - Categoría guardada exitosamente en colección');
      
    } catch (error) {
      console.error('❌ Error saving category to collection:', error);
      // No lanzar error aquí para no interrumpir el flujo principal
    }
  };

  // Función para eliminar una categoría de la colección de categorías
  const deleteCategoryFromCollection = async (categoryName: string) => {
    try {
      if (!user) return;
      
      console.log('🔧 DEBUG - Eliminando categoría de colección:', categoryName);
      
      const categoryRef = doc(db, 'categories', `${user.uid}_${categoryName}`);
      
      await deleteDoc(categoryRef);
      
      console.log('✅ DEBUG - Categoría eliminada exitosamente de colección');
      
    } catch (error) {
      console.error('❌ Error deleting category from collection:', error);
      // No lanzar error aquí para no interrumpir el flujo principal
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
      handleCloseCategoryModal();
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

  // Función para cerrar el modal de categoría
  const handleCloseCategoryModal = () => {
    if (onCloseCategoryModal) {
      onCloseCategoryModal();
    }
  };

  const handleDeleteCategory = async (category: string) => {
    // Mostrar modal de confirmación
    setCategoryToDelete(category);
    setShowDeleteCategoryModal(true);
  };

  const confirmDeleteCategory = async () => {
    const category = categoryToDelete;
    
    try {
      setIsSubmitting(true);
      
      // Eliminar la categoría de todos los cuadernos que la tienen
      const notebooksToUpdate = notebooksBySelectedCategory;
      
      for (const notebook of notebooksToUpdate) {
        try {
          await updateNotebookCategory(notebook.id, '');
          console.log(`✅ Categoría eliminada del cuaderno: ${notebook.title}`);
        } catch (error) {
          console.error(`❌ Error eliminando categoría del cuaderno ${notebook.title}:`, error);
        }
      }
      
      // Mostrar mensaje de éxito
      alert(`Categoría "${category}" eliminada exitosamente de ${notebooksToUpdate.length} cuaderno(s).`);
      
      // Eliminar la categoría de la colección de categorías
      await deleteCategoryFromCollection(category);
      
      // Cerrar modal
      setShowDeleteCategoryModal(false);
      setCategoryToDelete('');
      
      // Limpiar la categoría seleccionada para que desaparezca de la interfaz
      if (onClearSelectedCategory) {
        onClearSelectedCategory();
      }
      
      // Forzar actualización de la lista de cuadernos
      if (onCreateNotebook) {
        console.log('🔄 DEBUG - Llamando onCreateNotebook para forzar actualización');
        onCreateNotebook();
      }
      
      // Forzar actualización de categorías
      if (onRefreshCategories) {
        console.log('🔄 DEBUG - Llamando onRefreshCategories para actualizar categorías');
        onRefreshCategories();
      }
      
    } catch (error) {
      console.error("❌ Error eliminando categoría:", error);
      alert('Error al eliminar la categoría. Por favor, intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelDeleteCategory = () => {
    setShowDeleteCategoryModal(false);
    setCategoryToDelete('');
  };

  const handleOpenAddNotebookModal = (category: string) => {
    setCategoryToAddNotebook(category);
    setShowAddNotebookModal(true);
  };

  const handleCloseAddNotebookModal = () => {
    setShowAddNotebookModal(false);
    setCategoryToAddNotebook(null);
  };

  const handleToggleNotebookToAdd = (notebookId: string) => {
    setSelectedNotebooksToAdd(prev => {
      if (prev.includes(notebookId)) {
        return prev.filter(id => id !== notebookId);
      } else {
        return [...prev, notebookId];
      }
    });
  };

  const handleAddNotebooksToCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedNotebooksToAdd.length === 0) {
      setErrorMessage('Por favor, selecciona al menos un cuaderno.');
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      if (!categoryToAddNotebook) return;
      console.log('🚀 DEBUG - Cuadernos seleccionados para agregar:', selectedNotebooksToAdd);
      
      for (const notebookId of selectedNotebooksToAdd) {
        await updateNotebookCategory(notebookId, categoryToAddNotebook);
      }
      
      // Mostrar mensaje de éxito
      const successMessage = selectedNotebooksToAdd.length > 0 
        ? `Categoría "${categoryToAddNotebook}" actualizada exitosamente y ${selectedNotebooksToAdd.length} cuaderno(s) asignado(s).`
        : `Categoría "${categoryToAddNotebook}" actualizada exitosamente.`;
      
      console.log('🎉 DEBUG - Mensaje de éxito:', successMessage);
      alert(successMessage);
      
      // Limpiar formulario
      setSelectedNotebooksToAdd([]);
      handleCloseAddNotebookModal();
      
      // Forzar actualización de la lista de cuadernos
      if (onCreateNotebook) {
        console.log('🔄 DEBUG - Llamando onCreateNotebook para forzar actualización');
        onCreateNotebook();
      }
      
      // Forzar actualización de categorías
      if (onRefreshCategories) {
        console.log('🔄 DEBUG - Llamando onRefreshCategories para actualizar categorías');
        onRefreshCategories();
      }
      
    } catch (error) {
      console.error("❌ Error actualizando categoría:", error);
      setErrorMessage('Error al actualizar la categoría. Por favor, intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Botón de crear cuaderno y buscador */}
      <div className="notebook-actions-container">
        <div 
          className="notebook-item create-notebook-card"
          onClick={() => setShowCreateModal(true)}
        >
          <div className="create-notebook-content">
            <div className="create-notebook-icon">+</div>
            <span className="create-notebook-text">Crear nueva materia</span>
          </div>
        </div>
        
        <div className="search-container">
          <div className="search-input-wrapper">
            <i className="fas fa-search search-icon"></i>
            <input
              type="text"
              placeholder="Buscar materia..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
        </div>
      </div>

      {/* Subsección de categoría seleccionada o todos los cuadernos */}
      {notebooksBySelectedCategory.length > 0 && (
        <div className="categories-section">
          {selectedCategory && (
            <div className="category-header-with-actions">
              <h3 className="categories-section-title">
                {selectedCategory} ({notebooksBySelectedCategory.length} cuaderno{notebooksBySelectedCategory.length !== 1 ? 's' : ''})
              </h3>
              <button 
                className="add-notebook-to-category-button"
                onClick={() => handleOpenAddNotebookModal(selectedCategory)}
                title="Agregar cuaderno a esta categoría"
              >
                <i className="fas fa-plus"></i>
              </button>
              <button 
                className="delete-category-button"
                onClick={() => handleDeleteCategory(selectedCategory)}
                title="Eliminar categoría"
              >
                <i className="fas fa-trash"></i>
              </button>
            </div>
          )}
          <div className="notebook-grid" ref={notebookListRef}>
            {notebooksBySelectedCategory.map(notebook => (
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

      {/* Mostrar mensaje si no hay cuadernos en la categoría seleccionada */}
      {selectedCategory && notebooksBySelectedCategory.length === 0 && (
        <div className="categories-section">
          <div className="category-header-with-actions">
            <h3 className="categories-section-title">{selectedCategory}</h3>
            <button 
              className="add-notebook-to-category-button"
              onClick={() => handleOpenAddNotebookModal(selectedCategory)}
              title="Agregar cuaderno a esta categoría"
            >
              <i className="fas fa-plus"></i>
            </button>
            <button 
              className="delete-category-button"
              onClick={() => handleDeleteCategory(selectedCategory)}
              title="Eliminar categoría"
            >
              <i className="fas fa-trash"></i>
            </button>
          </div>
          <div className="empty-category-message">
            <p>No hay cuadernos asignados a la categoría "{selectedCategory}"</p>
            <p className="empty-category-hint">
              Usa el botón <strong>+</strong> en la parte superior derecha para asignar cuadernos
            </p>
          </div>
        </div>
      )}

      {/* Modal para crear nuevo cuaderno */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content create-notebook-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Crear nueva materia</h3>
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
                <label htmlFor="notebookTitle">Nombre del cuaderno</label>
                <input
                  id="notebookTitle"
                  type="text"
                  value={newNotebookTitle}
                  onChange={handleTitleChange}
                  onKeyDown={handleKeyPress}
                  placeholder="Ej: Matemáticas, Historia, etc."
                  className="form-control"
                  autoFocus
                  required
                  disabled={isSubmitting}
                />
              </div>
              
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
                  {isSubmitting ? 'Creando...' : 'Crear materia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para crear nueva categoría */}
      {showCategoryModal && (
        <div className="modal-overlay" onClick={handleCloseCategoryModal}>
          <div className="modal-content create-category-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Crear nueva categoría</h3>
              <button 
                className="close-button" 
                onClick={() => {
                  handleCloseCategoryModal();
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
                    handleCloseCategoryModal();
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

      {/* Modal de confirmación para eliminar categoría */}
      {showDeleteCategoryModal && (
        <div className="modal-overlay" onClick={cancelDeleteCategory}>
          <div className="modal-content confirm-delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirmar eliminación</h3>
              <button 
                className="close-button" 
                onClick={cancelDeleteCategory}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>¿Estás seguro de que quieres eliminar la categoría "{categoryToDelete}"?</p>
              <p>Esta acción eliminará la categoría de {notebooksBySelectedCategory.length} cuaderno(s) pero NO eliminará los cuadernos en sí.</p>
              <p>Los cuadernos quedarán sin categoría.</p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="cancel-button"
                onClick={cancelDeleteCategory}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="delete-button"
                onClick={confirmDeleteCategory}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para agregar cuadernos a la categoría */}
      {showAddNotebookModal && categoryToAddNotebook && (
        <div className="modal-overlay" onClick={handleCloseAddNotebookModal}>
          <div className="modal-content create-notebook-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Agregar cuadernos a "{categoryToAddNotebook}"</h3>
              <button className="close-button" onClick={handleCloseAddNotebookModal}>×</button>
            </div>
            <form onSubmit={e => handleAddNotebooksToCategory(e)} className="modal-body">
              <div className="form-group">
                <label>Selecciona los cuadernos sin categoría:</label>
                <div className="notebook-selection-list">
                  {uncategorizedNotebooks.length === 0 ? (
                    <div className="empty-category-message">
                      <p>No hay cuadernos sin categoría.</p>
                    </div>
                  ) : (
                    uncategorizedNotebooks.map(notebook => (
                      <div key={notebook.id} className={`notebook-selection-item ${selectedNotebooksToAdd.includes(notebook.id) ? 'selected' : ''}`}
                        onClick={() => handleToggleNotebookToAdd(notebook.id)}>
                        <input
                          type="checkbox"
                          checked={selectedNotebooksToAdd.includes(notebook.id)}
                          onChange={() => handleToggleNotebookToAdd(notebook.id)}
                        />
                        <span className="notebook-title">{notebook.title}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="cancel-button" onClick={handleCloseAddNotebookModal}>Cancelar</button>
                <button type="submit" className="create-button" disabled={selectedNotebooksToAdd.length === 0}>Agregar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default NotebookList;