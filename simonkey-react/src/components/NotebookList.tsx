// src/components/NotebookList.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import NotebookItem from './NotebookItem';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { createNotebook } from '../services/notebookService';

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
}

interface NotebookListProps {
  notebooks: Notebook[];
  onDeleteNotebook?: (id: string) => void;
  onEditNotebook?: (id: string, title: string) => void;
  showCreateButton?: boolean;
  onCreateNotebook?: () => void;
  isSchoolTeacher?: boolean;
  onColorChange?: (id: string, color: string) => void;
}

const NotebookList: React.FC<NotebookListProps> = ({ 
  notebooks, 
  onDeleteNotebook, 
  onEditNotebook, 
  showCreateButton = false, 
  onCreateNotebook,
  isSchoolTeacher = false,
  onColorChange
}) => {
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newNotebookTitle, setNewNotebookTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null); // Nuevo estado para controlar qué acciones están abiertas
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState<string>(''); // Nuevo estado para mensajes de error

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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateNotebook(e as any);
    } else if (e.key === 'Escape') {
      setShowCreateModal(false);
      setNewNotebookTitle('');
      setErrorMessage(''); // Limpiar error al cerrar
    }
  };

  const handleToggleActions = (notebookId: string) => {
    setOpenActionsId(openActionsId === notebookId ? null : notebookId);
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

  return (
    <>
      {/* Botón de crear cuaderno debajo del título */}
      {showCreateButton && (
        <div 
          className="create-notebook-card"
          onClick={() => setShowCreateModal(true)}
          style={{
            marginBottom: '2rem',
            marginTop: '1rem'
          }}
        >
          <div className="create-notebook-content">
            <div className="create-notebook-icon">+</div>
            <span className="create-notebook-text">Crear nuevo cuaderno</span>
          </div>
        </div>
      )}

      <div className="notebook-grid">
        {/* Lista de cuadernos existentes */}
        {notebooks.map(notebook => (
          <NotebookItem
            key={notebook.id}
            id={notebook.id}
            title={notebook.title}
            color={notebook.color}
            onDelete={onDeleteNotebook}
            onEdit={onEditNotebook ? (id: string, newTitle: string) => onEditNotebook(id, newTitle) : undefined}
            onColorChange={onColorChange}
            showActions={openActionsId === notebook.id}
            onToggleActions={handleToggleActions}
            isSchoolNotebook={isSchoolTeacher}
          />
        ))}
      </div>

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
    </>
  );
};

export default NotebookList;