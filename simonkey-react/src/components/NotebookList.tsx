// src/components/NotebookList.tsx
import React, { useState } from 'react';
import NotebookItem from './NotebookItem';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../services/firebase';
import { createNotebook } from '../services/notebookService';

// Define la interfaz Notebook localmente en lugar de importarla
interface Notebook {
  id: string;
  title: string;
  userId: string;
  createdAt: Date | any;
  color?: string;
}

interface NotebookListProps {
  notebooks: Notebook[];
  onDelete: (id: string) => void;
  onEdit?: (id: string, newTitle: string) => void;
  onColorChange?: (id: string, newColor: string) => void;
  onCreate?: () => void; // Callback to refresh the notebook list
}

const NotebookList: React.FC<NotebookListProps> = ({ notebooks, onDelete, onEdit, onColorChange, onCreate }) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newNotebookTitle, setNewNotebookTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [user] = useAuthState(auth);

  const handleCreateNotebook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newNotebookTitle.trim() || isSubmitting) return;
    
    try {
      setIsSubmitting(true);
      await createNotebook(user.uid, newNotebookTitle);
      setNewNotebookTitle(''); // Clear the form
      setShowCreateModal(false); // Close modal
      onCreate?.(); // Refresh the notebook list
    } catch (error) {
      console.error("Error creating notebook:", error);
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
            onDelete={onDelete}
            onEdit={onEdit}
            onColorChange={onColorChange}
          />
        ))}
        
        {/* Tarjeta para crear nuevo cuaderno */}
        <div 
          className="notebook-item create-notebook-card"
          onClick={() => setShowCreateModal(true)}
        >
          <div className="create-notebook-content">
            <div className="create-notebook-icon">+</div>
            <span className="create-notebook-text">Nuevo cuaderno</span>
          </div>
        </div>
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