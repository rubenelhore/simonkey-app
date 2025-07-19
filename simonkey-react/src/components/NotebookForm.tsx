import { useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { createNotebook } from '../services/notebookService';
import { useLocation } from 'react-router-dom';

interface NotebookFormProps {
  onNotebookCreated: () => void;
  onCancel: () => void;
}

const NotebookForm: React.FC<NotebookFormProps> = ({ onNotebookCreated, onCancel }) => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim() || isSubmitting) return;
    
    setError(null); // Clear any previous errors
    
    try {
      setIsSubmitting(true);
      // Extraer materiaId de la URL si existe
      const match = location.pathname.match(/\/materias\/([^/]+)/);
      const materiaId = match ? match[1] : undefined;
      await createNotebook(user.uid, title, undefined, undefined, materiaId);
      setTitle(''); // Clear the form
      onNotebookCreated(); // Refresh the notebook list
    } catch (error: any) {
      console.error("Error creating notebook:", error);
      
      // Mostrar el mensaje de error específico
      if (error?.message) {
        setError(error.message);
      } else if (typeof error === 'string') {
        setError(error);
      } else {
        setError('Error al crear el cuaderno. Por favor, intenta de nuevo.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="notebook-form">
      {error && (
        <div style={{
          backgroundColor: '#fee',
          color: '#c33',
          padding: '10px',
          borderRadius: '5px',
          marginBottom: '10px',
          fontSize: '14px',
          fontFamily: "'Poppins', sans-serif",
          border: '1px solid #fcc'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      <input
        type="text"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setError(null); // Clear error when user starts typing
        }}
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