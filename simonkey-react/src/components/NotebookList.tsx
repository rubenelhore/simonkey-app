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
  onEditNotebook?: (id: string, title: string, description: string) => void;
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

  const handleCreateNotebook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newNotebookTitle.trim() || isSubmitting) return;
    
    try {
      setIsSubmitting(true);
      await createNotebook(user.uid, newNotebookTitle);
      setNewNotebookTitle(''); // Clear the form
      setShowCreateModal(false); // Close modal
      onCreateNotebook?.(); // Refresh the notebook list
    } catch (error) {
      console.error("Error creating notebook:", error);
      
      // Mostrar el error al usuario de forma más amigable
      let errorMessage = 'Error al crear el cuaderno';
      
      if (error instanceof Error) {
        if (error.message.includes('Usuario no encontrado')) {
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
      
      alert(errorMessage);
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
    }
  };

  const handleToggleActions = (notebookId: string) => {
    setOpenActionsId(openActionsId === notebookId ? null : notebookId);
  };

  return (
    <>
      <div className="notebook-grid">
        {/* Lista de cuadernos existentes */}
        {notebooks.map(notebook => (
          <NotebookItem
            key={notebook.id}
            id={notebook.id}
            title={notebook.title}
            color={notebook.color}
            onDelete={onDeleteNotebook || (() => {})}
            onEdit={onEditNotebook ? (id: string, newTitle: string) => onEditNotebook(id, newTitle, '') : undefined}
            onColorChange={onColorChange}
            showActions={openActionsId === notebook.id}
            onToggleActions={handleToggleActions}
          />
        ))}
        
        {/* Tarjeta para crear nuevo cuaderno */}
        {showCreateButton && (
          <div 
            className="notebook-item create-notebook-card"
            onClick={() => setShowCreateModal(true)}
          >
            <div className="create-notebook-content">
              <div className="create-notebook-icon">+</div>
              <span className="create-notebook-text">Crear nuevo cuaderno</span>
            </div>
          </div>
        )}
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
                  onChange={(e) => setNewNotebookTitle(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Ingresa el nombre del cuaderno"
                  className="form-control"
                  autoFocus
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewNotebookTitle('');
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
                  {isSubmitting ? 'Creando...' : 'Crear'}
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