import { useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { createNotebook } from '../services/notebookService';

interface NotebookFormProps {
  onNotebookCreated: () => void;
  onCancel: () => void;
}

const NotebookForm: React.FC<NotebookFormProps> = ({ onNotebookCreated, onCancel }) => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim() || isSubmitting) return;
    
    try {
      setIsSubmitting(true);
      await createNotebook(user.uid, title);
      setTitle(''); // Clear the form
      onNotebookCreated(); // Refresh the notebook list
    } catch (error) {
      console.error("Error creating notebook:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="notebook-form">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Ingresa el nombre"
        required
        style={{ fontFamily: "'Poppins', sans-serif" }}
        disabled={isSubmitting}
      />
      <button 
        type="submit" 
        style={{ fontFamily: "'Poppins', sans-serif" }}
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Creando...' : 'Crear Cuaderno'}
      </button>
    </form>
  );
};

export default NotebookForm;