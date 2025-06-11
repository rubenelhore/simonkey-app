// src/components/Dashboard/QuickActions.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';

// Define an interface for your notebook type
interface Notebook {
  id: string;
  title: string; // Changed from 'any' for better type safety
  color: string; // Changed from 'any' for better type safety
}

// Then use it when initializing state
const [recentNotebooks, setRecentNotebooks] = useState<Notebook[]>([]);

const QuickActions = () => {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRecentNotebooks = async () => {
      if (!auth.currentUser) return;
      
      try {
        setLoading(true);
        
        // Consultar cuadernos recientes del usuario
        const notebooksQuery = query(
          collection(db, 'notebooks'),
          where('userId', '==', auth.currentUser.uid),
          orderBy('updatedAt', 'desc'),
          limit(3)
        );
        
        const notebooksSnapshot = await getDocs(notebooksQuery);
        
        const notebooks = notebooksSnapshot.docs.map(doc => ({
          id: doc.id,
          title: doc.data().title,
          color: doc.data().color || '#6147FF'
        }));
        
        setRecentNotebooks(notebooks);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching recent notebooks:", error);
        setLoading(false);
      }
    };
    
    fetchRecentNotebooks();
  }, []);

  const handleCreateNotebook = () => {
    navigate('/notebooks', { state: { showCreateModal: true } });
  };

  const handleContinueStudying = (notebookId: string) => {
    navigate(`/notebooks/${notebookId}`);
  };

  const handleGoToStudyMode = () => {
    // En una implementación real, llevaría al modo de estudio del último cuaderno
    if (recentNotebooks.length > 0) {
      navigate(`/notebooks/${recentNotebooks[0].id}`);
    } else {
      navigate('/notebooks');
    }
  };

  return (
    <div className="quick-actions-card">
      <h3>Acciones rápidas</h3>
      
      <div className="action-buttons">
        <button 
          className="action-button create-notebook"
          onClick={handleCreateNotebook}
        >
          <i className="fas fa-plus"></i>
          <span>Crear cuaderno</span>
        </button>
        
        <button 
          className="action-button study-mode"
          onClick={handleGoToStudyMode}
          disabled={recentNotebooks.length === 0}
        >
          <i className="fas fa-graduation-cap"></i>
          <span>Modo estudio</span>
        </button>
      </div>
      
      <div className="continue-studying">
        <h4>Continuar estudiando</h4>
        
        {loading ? (
          <div className="loading-notebooks">
            <div className="card-loading-spinner"></div>
          </div>
        ) : recentNotebooks.length === 0 ? (
          <div className="empty-notebooks">
            <p>No tienes cuadernos recientes</p>
          </div>
        ) : (
          <div className="recent-notebooks">
            {recentNotebooks.map(notebook => (
              <div 
                key={notebook.id}
                className="recent-notebook"
                onClick={() => handleContinueStudying(notebook.id)}
                style={{ borderLeftColor: notebook.color }}
              >
                <div className="notebook-icon" style={{ backgroundColor: notebook.color }}>
                  <i className="fas fa-book"></i>
                </div>
                <div className="notebook-title">
                  {notebook.title}
                </div>
                <div className="notebook-arrow">
                  <i className="fas fa-chevron-right"></i>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuickActions;