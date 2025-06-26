import React from 'react';
import { useActivityTracker } from '../hooks/useActivityTracker';

const ActivityTrackerExample: React.FC = () => {
  const { recordActivity } = useActivityTracker();

  const handleNotebookClick = () => {
    recordActivity('notebook_opened', { notebookId: 'example-123' });
    // Lógica normal del componente...
  };

  const handleStudyClick = () => {
    recordActivity('study_session_started', { mode: 'flashcards' });
    // Lógica normal del componente...
  };

  const handleQuizClick = () => {
    recordActivity('quiz_started', { difficulty: 'medium' });
    // Lógica normal del componente...
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', margin: '10px' }}>
      <h3>Ejemplo de Registro de Actividad</h3>
      <p>Estos botones registran actividad específica que resetea el timer de inactividad:</p>
      
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button 
          onClick={handleNotebookClick}
          style={{ padding: '10px 15px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px' }}
        >
          📓 Abrir Cuaderno
        </button>
        
        <button 
          onClick={handleStudyClick}
          style={{ padding: '10px 15px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '5px' }}
        >
          📚 Iniciar Estudio
        </button>
        
        <button 
          onClick={handleQuizClick}
          style={{ padding: '10px 15px', backgroundColor: '#FF9800', color: 'white', border: 'none', borderRadius: '5px' }}
        >
          🧠 Iniciar Quiz
        </button>
      </div>
      
      <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
        💡 Cada click registra actividad específica y resetea el timer de inactividad.
      </p>
    </div>
  );
};

export default ActivityTrackerExample; 