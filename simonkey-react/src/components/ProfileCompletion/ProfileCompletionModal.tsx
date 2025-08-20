import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faQuestionCircle, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import './ProfileCompletionModal.css';

interface ProfileCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (data: ProfileData) => void;
}

interface ProfileData {
  birthDate?: string;
  gender?: string;
  learningStyle?: string[];
}

const ProfileCompletionModal: React.FC<ProfileCompletionModalProps> = ({
  isOpen,
  onClose,
  onComplete
}) => {
  const [formData, setFormData] = useState<ProfileData>({
    birthDate: '',
    gender: '',
    learningStyle: []
  });
  
  const [isLoading, setIsLoading] = useState(false);

  const learningStyleDescriptions: { [key: string]: string } = {
    'Visual': 'Aprendes mejor con imágenes, diagramas, colores y mapas mentales',
    'Auditivo': 'Aprendes mejor escuchando explicaciones, música y discusiones',
    'Kinestésico': 'Aprendes mejor haciendo, tocando y con movimiento físico',
    'Lectoescritura': 'Aprendes mejor leyendo textos y tomando notas escritas',
    'Lógico': 'Aprendes mejor con razonamiento, patrones y relaciones causa-efecto',
    'Social': 'Aprendes mejor en grupos, colaborando y compartiendo ideas'
  };

  const handleSubmit = async () => {
    // Validación
    if (!formData.birthDate) {
      alert('Por favor, ingresa tu fecha de nacimiento');
      return;
    }
    
    if (!formData.gender) {
      alert('Por favor, selecciona tu género');
      return;
    }
    
    if (!formData.learningStyle || formData.learningStyle.length === 0) {
      alert('Por favor, selecciona al menos un estilo de aprendizaje');
      return;
    }
    
    setIsLoading(true);
    try {
      if (auth.currentUser) {
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        await updateDoc(userDocRef, {
          ...formData,
          profileCompleted: true,
          updatedAt: new Date()
        });
        
        onComplete(formData);
        onClose();
      }
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    if (auth.currentUser) {
      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      updateDoc(userDocRef, {
        profileCompleted: false,
        profileSkipped: true
      });
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header-content">
          <h2>Queremos conocerte</h2>
          <p>Entre más nos conozcamos mejor puedo ayudarte</p>
        </div>
        
        <div className="fields-row">
          <div className="field half">
            <label>Fecha de nacimiento</label>
            <input
              type="date"
              min="1900-01-01"
              max={new Date().toISOString().split('T')[0]}
              value={formData.birthDate}
              onChange={(e) => setFormData({...formData, birthDate: e.target.value})}
            />
          </div>

          <div className="field half">
            <label>Género</label>
            <select
              value={formData.gender}
              onChange={(e) => setFormData({...formData, gender: e.target.value})}
            >
              <option value="">-</option>
              <option value="M">Masculino</option>
              <option value="F">Femenino</option>
              <option value="O">Otro</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label>
            Estilo de aprendizaje (máximo 3)
            <span className="info-tooltip">
              <FontAwesomeIcon icon={faQuestionCircle} />
              <span className="tooltip-text">
                Estos estilos serán tomados en cuenta para personalizar tus ejercicios y prácticas
              </span>
            </span>
          </label>
          <div className="learning-styles">
            {['Visual', 'Auditivo', 'Kinestésico', 'Lectoescritura', 'Lógico', 'Social'].map(style => (
              <label key={style} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={Array.isArray(formData.learningStyle) ? formData.learningStyle.includes(style) : false}
                  onChange={(e) => {
                    const styles = Array.isArray(formData.learningStyle) ? formData.learningStyle : [];
                    if (e.target.checked && styles.length < 3) {
                      setFormData({...formData, learningStyle: [...styles, style]});
                    } else if (!e.target.checked) {
                      setFormData({...formData, learningStyle: styles.filter(s => s !== style)});
                    }
                  }}
                  disabled={!Array.isArray(formData.learningStyle) ? false : !formData.learningStyle.includes(style) && formData.learningStyle.length >= 3}
                />
                <span>{style}</span>
                <span className="style-info-icon">
                  <FontAwesomeIcon icon={faInfoCircle} />
                  <span className="style-tooltip">{learningStyleDescriptions[style]}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="buttons">
          <button className="skip" onClick={handleSkip}>
            Saltar
          </button>
          <button 
            className="save" 
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? '...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileCompletionModal;