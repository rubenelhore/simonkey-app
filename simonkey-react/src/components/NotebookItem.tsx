// src/components/NotebookItem.tsx
import { useNavigate } from 'react-router-dom';
import { deleteNotebook } from '../services/notebookService';
import { useState } from 'react';

interface NotebookItemProps {
  id: string;
  title: string;
  color?: string; // Nuevo prop para el color
  onDelete: (id: string) => void;
  onEdit?: (id: string, newTitle: string) => void;
  onColorChange?: (id: string, newColor: string) => void; // Nueva función para actualizar el color
}

const NotebookItem: React.FC<NotebookItemProps> = ({ id, title, color, onDelete, onEdit, onColorChange }) => {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [editableTitle, setEditableTitle] = useState(title);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [notebookColor, setNotebookColor] = useState(color || '#6147FF'); // Color predeterminado

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("¿Estás seguro de que deseas eliminar este cuaderno?")) {
      await deleteNotebook(id);
      onDelete(id);
    }
  };

  const handleView = () => {
    navigate(`/notebooks/${id}`);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditableTitle(e.target.value);
  };

  const handleSave = () => {
    setIsEditing(false);
    if (onEdit) {
      onEdit(id, editableTitle);  // Este callback ahora actualizará Firestore
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSave();
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
    <div className="notebook-card">
      <div 
        className="notebook-card-content" 
        onClick={handleView}
        style={{ cursor: 'pointer' }}
      >
        {isEditing ? (
          <input 
            type="text"
            value={editableTitle}
            onChange={handleTitleChange}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            autoFocus
          />
        ) : (
          <h3 style={{ color: notebookColor }}>{editableTitle}</h3>
        )}
      </div>
      <div 
        className="notebook-card-actions"
        style={{ backgroundColor: notebookColor }} // Aplica el color directamente aquí
      >
        <button onClick={handleView} className="action-view" title="Ver cuaderno">
          <i className="fas fa-eye"></i>
        </button>
        <button onClick={handleColorClick} className="action-color" title="Cambiar color">
          <i className="fas fa-palette"></i>
        </button>
        <button onClick={handleEditClick} className="action-edit" title="Editar nombre">
          <i className="fas fa-pencil-alt"></i>
        </button>
        <button onClick={handleDelete} className="action-delete" title="Eliminar cuaderno">
          <i className="fas fa-trash"></i>
        </button>
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

export default NotebookItem;