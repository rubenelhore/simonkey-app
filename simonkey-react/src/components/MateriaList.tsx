// src/components/MateriaList.tsx
import React, { useState, useEffect, useRef } from 'react';
import MateriaItem from './MateriaItem';
import { useAuth } from '../contexts/AuthContext';
import { auth, db } from '../services/firebase';
import { doc, updateDoc, serverTimestamp, setDoc, deleteDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

interface Materia {
  id: string;
  title: string;
  color: string;
  category?: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  notebookCount?: number;
  conceptCount?: number;
  teacherName?: string;
  studentCount?: number;
  isEnrolled?: boolean;
  domainProgress?: {
    total: number;
    dominated: number;
    learning: number;
    notStarted: number;
  };
}

interface MateriaListProps {
  materias: Materia[];
  onDeleteMateria?: (id: string) => void;
  onEditMateria?: (id: string, title: string) => void;
  onUnenrollMateria?: (id: string) => void;
  showCreateButton?: boolean;
  onCreateMateria?: (title: string, color: string, category?: string) => void;
  onColorChange?: (id: string, color: string) => void;
  onViewMateria: (id: string) => void;
  onManageInvites?: (id: string, title: string) => void;
  selectedCategory?: string | null;
  showCreateModal?: boolean;
  setShowCreateModal?: (show: boolean) => void;
  showCategoryModal?: boolean;
  onCloseCategoryModal?: () => void;
  onClearSelectedCategory?: () => void;
  onRefreshCategories?: () => void;
  isAdminView?: boolean;
  examsByMateria?: Record<string, any[]>;
  isSchoolStudent?: boolean;
  isSchoolTeacher?: boolean;
  isTeacher?: boolean;
}

const MateriaList: React.FC<MateriaListProps> = ({ 
  materias, 
  onDeleteMateria, 
  onEditMateria,
  onUnenrollMateria, 
  showCreateButton = false, 
  onCreateMateria,
  onColorChange,
  onViewMateria,
  onManageInvites,
  selectedCategory,
  showCreateModal = false,
  setShowCreateModal,
  showCategoryModal = false,
  onCloseCategoryModal,
  onClearSelectedCategory,
  onRefreshCategories,
  isAdminView = false,
  examsByMateria = {},
  isSchoolStudent = false,
  isSchoolTeacher = false,
  isTeacher = false
}) => {
  const { user } = useAuth();
  const [newMateriaTitle, setNewMateriaTitle] = useState('');
  const [newMateriaColor, setNewMateriaColor] = useState('#6147FF');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedMaterias, setSelectedMaterias] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleteCategoryModal, setShowDeleteCategoryModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string>('');
  const materiaListRef = useRef<HTMLDivElement>(null);
  const [showAddMateriaModal, setShowAddMateriaModal] = useState(false);
  const [categoryToAddMateria, setCategoryToAddMateria] = useState<string | null>(null);
  const [selectedMateriasToAdd, setSelectedMateriasToAdd] = useState<string[]>([]);

  // Color presets para las materias - mismos colores que los cuadernos
  const colorPresets = [
    '#6147FF', '#FF6B6B', '#4CAF50', '#FFD700', '#FF8C00', '#9C27B0'
  ];

  // Filtrar materias basado en el término de búsqueda
  const filteredMaterias = materias.filter(materia =>
    materia.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (materia.category && materia.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Filtrar materias por categoría seleccionada
  const materiasBySelectedCategory = selectedCategory 
    ? filteredMaterias.filter(materia => materia.category === selectedCategory)
    : filteredMaterias;

  // Agrupar materias por categoría
  const groupedByCategory = filteredMaterias.reduce((acc, materia) => {
    if (materia.category && materia.category.trim() !== '') {
      const category = materia.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(materia);
    }
    return acc;
  }, {} as Record<string, Materia[]>);

  // Materias sin categoría
  const uncategorizedMaterias = filteredMaterias.filter(materia => 
    !materia.category || materia.category.trim() === ''
  );

  // Efecto para detectar clics fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!openActionsId) return;
      
      const target = event.target as HTMLElement;
      
      // Si el clic fue en un dropdown menu o sus hijos, no hacer nada
      if (target.closest('.materia-dropdown-menu')) {
        return;
      }
      
      // Si el clic fue en el botón de menú, no hacer nada (se maneja en handleToggleActions)
      if (target.closest('.materia-menu-button')) {
        return;
      }
      
      // Si el clic fue fuera, cerrar las acciones
      setOpenActionsId(null);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openActionsId]);

  // Efecto para bloquear el body cuando el modal está abierto
  useEffect(() => {
    if (showCreateModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }

    // Cleanup al desmontar el componente
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showCreateModal]);

  const handleCreateMateria = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMateriaTitle.trim()) {
      setErrorMessage('Por favor, ingresa un título para la materia.');
      return;
    }

    if (isSubmitting || !onCreateMateria) return;
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await onCreateMateria(newMateriaTitle.trim(), newMateriaColor, selectedCategory || undefined);
      
      setNewMateriaTitle('');
      setNewMateriaColor('#6147FF');
      if (setShowCreateModal) {
        setShowCreateModal(false);
      }
    } catch (error) {
      console.error("Error creating materia:", error);
      if (error instanceof Error && error.message.includes('Ya existe')) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Error al crear la materia. Por favor, intenta de nuevo.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActions = (materiaId: string) => {
    // Si se pasa string vacío, siempre cerrar (usado para forzar cierre)
    if (materiaId === '') {
      setOpenActionsId(null);
      return;
    }
    
    if (openActionsId === materiaId) {
      setOpenActionsId(null);
    } else {
      setOpenActionsId(materiaId);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateMateria(e as any);
    } else if (e.key === 'Escape') {
      if (setShowCreateModal) {
        setShowCreateModal(false);
      }
      setNewMateriaTitle('');
      setErrorMessage('');
    }
  };

  // Manejo de categorías
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
      // Verificar si la categoría ya existe
      const categoryExists = await checkCategoryExists(newCategoryName.trim());
      if (categoryExists) {
        setErrorMessage(`Ya existe una categoría con el nombre "${newCategoryName.trim()}".`);
        setIsSubmitting(false);
        return;
      }
      
      // Asignar materias seleccionadas a la nueva categoría
      if (selectedMaterias.length > 0) {
        for (const materiaId of selectedMaterias) {
          await updateMateriaCategory(materiaId, newCategoryName.trim());
        }
      }
      
      // Guardar la categoría en la colección
      await saveCategoryToCollection(newCategoryName.trim());
      
      // Limpiar formulario
      setNewCategoryName('');
      setSelectedMaterias([]);
      handleCloseCategoryModal();
      
      if (onRefreshCategories) {
        onRefreshCategories();
      }
    } catch (error) {
      console.error("Error creating category:", error);
      setErrorMessage('Error al crear la categoría.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const checkCategoryExists = async (categoryName: string): Promise<boolean> => {
    try {
      if (!user) return false;
      
      const categoryRef = doc(db, 'materia-categories', `${user.uid}_${categoryName}`);
      const categoryDoc = await getDoc(categoryRef);
      
      if (categoryDoc.exists()) {
        return true;
      }
      
      const materiasWithCategory = materias.filter(materia => 
        materia.category && materia.category.trim().toLowerCase() === categoryName.trim().toLowerCase()
      );
      
      return materiasWithCategory.length > 0;
    } catch (error) {
      console.error('Error checking category:', error);
      return false;
    }
  };

  const updateMateriaCategory = async (materiaId: string, category: string) => {
    try {
      const materiaRef = doc(db, 'materias', materiaId);
      await updateDoc(materiaRef, {
        category: category,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating materia category:', error);
      throw error;
    }
  };

  const saveCategoryToCollection = async (categoryName: string) => {
    try {
      if (!user) return;
      
      const categoryRef = doc(db, 'materia-categories', `${user.uid}_${categoryName}`);
      await setDoc(categoryRef, {
        userId: user.uid,
        name: categoryName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error saving category:', error);
    }
  };

  const handleCloseCategoryModal = () => {
    if (onCloseCategoryModal) {
      onCloseCategoryModal();
    }
  };

  const handleMateriaSelection = (materiaId: string) => {
    setSelectedMaterias(prev => {
      if (prev.includes(materiaId)) {
        return prev.filter(id => id !== materiaId);
      } else {
        return [...prev, materiaId];
      }
    });
  };

  const handleDeleteCategory = async (category: string) => {
    setCategoryToDelete(category);
    setShowDeleteCategoryModal(true);
  };

  const confirmDeleteCategory = async () => {
    const category = categoryToDelete;
    
    try {
      setIsSubmitting(true);
      
      // Eliminar la categoría de todas las materias
      const materiasToUpdate = materiasBySelectedCategory;
      
      for (const materia of materiasToUpdate) {
        try {
          await updateMateriaCategory(materia.id, '');
        } catch (error) {
          console.error(`Error removing category from materia ${materia.title}:`, error);
        }
      }
      
      // Eliminar la categoría de la colección
      if (user) {
        const categoryRef = doc(db, 'materia-categories', `${user.uid}_${category}`);
        await deleteDoc(categoryRef);
      }
      
      setShowDeleteCategoryModal(false);
      setCategoryToDelete('');
      
      if (onClearSelectedCategory) {
        onClearSelectedCategory();
      }
      
      if (onRefreshCategories) {
        onRefreshCategories();
      }
    } catch (error) {
      console.error("Error deleting category:", error);
      alert('Error al eliminar la categoría.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="materia-list-controls">
        <div className="materia-list-header">
          {showCreateButton && (
            <button 
              id="debug-create-materia-button"
              className="create-materia-button"
              onClick={() => {
                console.log('Botón crear materia clickeado', { setShowCreateModal });
                setShowCreateModal && setShowCreateModal(true);
              }}
            >
              <i className="fas fa-plus"></i>
              <span>Crear nueva materia</span>
            </button>
          )}
          <div className="search-container">
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
      <hr className="materias-divider" />

      {/* Materias por categoría seleccionada */}
      {materiasBySelectedCategory.length > 0 && (
        <div className="categories-section">
          {selectedCategory && (
            <div className="category-header-with-actions">
              <h3 className="categories-section-title">
                {selectedCategory} ({materiasBySelectedCategory.length} materia{materiasBySelectedCategory.length !== 1 ? 's' : ''})
              </h3>
              <button 
                className="delete-category-button"
                onClick={() => handleDeleteCategory(selectedCategory)}
                title="Eliminar categoría"
              >
                <i className="fas fa-trash"></i>
              </button>
            </div>
          )}
          <div className="materia-grid" ref={materiaListRef}>
            {materiasBySelectedCategory.map(materia => (
              <MateriaItem
                key={materia.id}
                id={materia.id}
                title={materia.title}
                color={materia.color}
                category={materia.category}
                notebookCount={materia.notebookCount || 0}
                conceptCount={materia.conceptCount}
                onDelete={onDeleteMateria}
                onEdit={onEditMateria}
                onColorChange={onColorChange}
                onView={onViewMateria}
                onManageInvites={onManageInvites}
                onUnenroll={onUnenrollMateria}
                showActions={openActionsId === materia.id}
                onToggleActions={handleToggleActions}
                teacherName={materia.teacherName}
                studentCount={materia.studentCount}
                isAdminView={isAdminView}
                exams={examsByMateria[materia.id] || []}
                isSchoolStudent={isSchoolStudent}
                isSchoolTeacher={isTeacher}
                isTeacher={isTeacher}
                isEnrolled={materia.isEnrolled}
                domainProgress={materia.domainProgress}
              />
            ))}
          </div>
        </div>
      )}

      {/* Mensaje si no hay materias en la categoría */}
      {selectedCategory && materiasBySelectedCategory.length === 0 && (
        <div className="categories-section">
          <div className="category-header-with-actions">
            <h3 className="categories-section-title">{selectedCategory}</h3>
            <button 
              className="delete-category-button"
              onClick={() => handleDeleteCategory(selectedCategory)}
              title="Eliminar categoría"
            >
              <i className="fas fa-trash"></i>
            </button>
          </div>
          <div className="empty-category-message">
            <p>No hay materias asignadas a la categoría "{selectedCategory}"</p>
          </div>
        </div>
      )}

      {/* Modal para crear nueva materia */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal && setShowCreateModal(false)}>
          <div className="modal-content create-materia-modal-new" onClick={(e) => e.stopPropagation()}>
            {/* Header simplificado */}
            <div className="modal-header-simple">
              <button 
                className="close-button-simple" 
                onClick={() => {
                  setShowCreateModal && setShowCreateModal(false);
                  setNewMateriaTitle('');
                  setErrorMessage('');
                }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            {/* Contenido principal */}
            <div className="modal-main-content">
              <div className="modal-icon">
                <i className="fas fa-book" style={{ color: '#6147FF', fontSize: '2.5rem' }}></i>
              </div>
              <h2 className="modal-title">Nueva Materia</h2>
              <p className="modal-subtitle">Crea una nueva materia para organizar tus estudios</p>
              
              <form onSubmit={handleCreateMateria} className="modal-form">
                <div className="input-group">
                  <input
                    id="materiaTitle"
                    type="text"
                    value={newMateriaTitle}
                    onChange={(e) => setNewMateriaTitle(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Nombre de la materia"
                    className="modal-input"
                    autoFocus
                    required
                    disabled={isSubmitting}
                  />
                </div>
                
                <div className="color-section">
                  <p className="color-label">Elige un color</p>
                  <div className="color-options">
                    {colorPresets.map(color => (
                      <button
                        key={color}
                        type="button"
                        className={`color-option ${newMateriaColor === color ? 'selected' : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={() => setNewMateriaColor(color)}
                      />
                    ))}
                  </div>
                </div>

                {errorMessage && (
                  <div className="error-message-new">
                    <span className="error-icon">⚠️</span>
                    <span className="error-text">{errorMessage}</span>
                  </div>
                )}
                
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={() => {
                      setShowCreateModal && setShowCreateModal(false);
                      setNewMateriaTitle('');
                      setErrorMessage('');
                    }}
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-create"
                    disabled={isSubmitting || !newMateriaTitle.trim()}
                  >
                    <i className="fas fa-plus"></i>
                    {isSubmitting ? 'Creando...' : 'Crear Materia'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal para crear categoría */}
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
                  setSelectedMaterias([]);
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
                  placeholder="Ej: Quinto Semestre, Ciencias, etc."
                  className="form-control"
                  autoFocus
                  required
                  disabled={isSubmitting}
                />
              </div>

              {uncategorizedMaterias.length > 0 && (
                <div className="form-group">
                  <label>Asignar materias a esta categoría (opcional)</label>
                  <div className="materia-selection-list">
                    {uncategorizedMaterias.map(materia => (
                      <div 
                        key={materia.id} 
                        className={`materia-selection-item ${selectedMaterias.includes(materia.id) ? 'selected' : ''}`}
                        onClick={() => handleMateriaSelection(materia.id)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedMaterias.includes(materia.id)}
                          onChange={() => handleMateriaSelection(materia.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div 
                          className="materia-color-indicator" 
                          style={{ backgroundColor: materia.color }}
                        />
                        <span>{materia.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                    setSelectedMaterias([]);
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
        <div className="modal-overlay" onClick={() => setShowDeleteCategoryModal(false)}>
          <div className="modal-content delete-category-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Eliminar categoría</h3>
            </div>
            <div className="modal-body">
              <p>¿Estás seguro de que quieres eliminar la categoría "{categoryToDelete}"?</p>
              <p className="warning-text">
                Esto eliminará la categoría de {materiasBySelectedCategory.length} materia{materiasBySelectedCategory.length !== 1 ? 's' : ''}.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="cancel-button"
                onClick={() => {
                  setShowDeleteCategoryModal(false);
                  setCategoryToDelete('');
                }}
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="delete-button"
                onClick={confirmDeleteCategory}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MateriaList;