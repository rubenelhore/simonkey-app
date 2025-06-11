import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/NotebookDetail.css';
import '../styles/ToolsMenu.css';

interface ToolsMenuProps {
  notebookId?: string;
  showHeader?: boolean;
  activeToolOnly?: 'explain' | 'visual' | 'audio';
}

const ToolsMenu: React.FC<ToolsMenuProps> = ({ notebookId, showHeader = true, activeToolOnly }) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <aside className="tools-menu-section">
      {showHeader && (
        <h2 style={{ color: 'var(--notebook-color)' }}>Herramientas de Aprendizaje</h2>
      )}
      
      {!activeToolOnly && (
        <button 
          onClick={toggleMenu} 
          className={`tools-toggle-button ${isOpen ? 'active' : ''}`}
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          {isOpen ? 'Cerrar' : 'Ver herramientas'} 
          <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'}`}></i>
        </button>
      )}

      {(isOpen || activeToolOnly) && (
        <div className="tools-container">
          <div className="category-items">
            {/* Explicar concepto - siempre mostrar si activeToolOnly es 'explain' o no está definido */}
            {(!activeToolOnly || activeToolOnly === 'explain') && (
              <Link to={notebookId ? `/tools/explain/simple/${notebookId}` : '#'} className="tool-link">
                Explicar Concepto
              </Link>
            )}
            
            {/* Visuales - solo mostrar si activeToolOnly no está definido o es 'visual' */}
            {(!activeToolOnly || activeToolOnly === 'visual') && (
              <Link to={notebookId ? `/tools/visual/concept-map/${notebookId}` : '#'} className="tool-link">
                Visuales
              </Link>
            )}
            
            {/* Auditivos - solo mostrar si activeToolOnly no está definido o es 'audio' */}
            {(!activeToolOnly || activeToolOnly === 'audio') && (
              <Link to={notebookId ? `/tools/audio/podcast/${notebookId}` : '#'} className="tool-link">
                Auditivos
              </Link>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};

export default ToolsMenu;