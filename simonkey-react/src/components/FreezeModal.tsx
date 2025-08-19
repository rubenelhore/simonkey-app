import React from 'react';
import '../styles/FreezeModal.css';

interface FreezeModalProps {
  isOpen: boolean;
  isFrozen: boolean;
  notebookTitle: string;
  onClose: () => void;
  onConfirm: () => void;
}

const FreezeModal: React.FC<FreezeModalProps> = ({ isOpen, isFrozen, notebookTitle, onClose, onConfirm }) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <div className="freeze-modal-overlay" onClick={onClose}>
      <div className="freeze-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="freeze-modal-header">
          <h3>
            <i className={`fas ${isFrozen ? 'fa-sun' : 'fa-snowflake'}`}></i>
            {isFrozen ? 'Descongelar' : 'Congelar'} cuaderno
          </h3>
          <button className="freeze-modal-close" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>
        
        <div className="freeze-modal-body">
          <p className="notebook-name">{notebookTitle}</p>
          
          <div className="freeze-confirmation">
            <p className="confirmation-message">
              {isFrozen 
                ? '¿Estás seguro de que deseas descongelar este cuaderno? Los estudiantes podrán acceder inmediatamente.'
                : '¿Estás seguro de que deseas congelar este cuaderno? Los estudiantes no podrán acceder hasta que lo descongeles.'}
            </p>
          </div>
        </div>
        
        <div className="freeze-modal-footer">
          <button className="btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-confirm" onClick={handleConfirm}>
            <i className={`fas ${isFrozen ? 'fa-sun' : 'fa-snowflake'}`}></i>
            {isFrozen ? 'Descongelar' : 'Congelar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FreezeModal;