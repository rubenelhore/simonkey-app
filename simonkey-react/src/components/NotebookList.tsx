// src/components/NotebookList.tsx
import React from 'react';
import NotebookItem from './NotebookItem';

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
}

const NotebookList: React.FC<NotebookListProps> = ({ notebooks, onDelete, onEdit, onColorChange }) => {
  return (
    <div className="notebook-grid">
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
    </div>
  );
};

export default NotebookList;