import React, { useState } from 'react';
import { X } from 'lucide-react';
import { teacherService } from '../services/teacherService';
import { auth } from '../services/firebase';
import '../styles/TeacherRequestModal.css';

interface TeacherRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const TeacherRequestModal: React.FC<TeacherRequestModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    bio: '',
    specialties: '',
    institution: '',
    acceptTerms: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.acceptTerms) {
      setError('Debes aceptar los términos y condiciones');
      return;
    }

    if (!auth.currentUser) {
      setError('Debes iniciar sesión para continuar');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const specialtiesArray = formData.specialties
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      await teacherService.requestTeacherStatus(
        auth.currentUser.uid,
        {
          bio: formData.bio,
          specialties: specialtiesArray,
          institution: formData.institution
        }
      );

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar la solicitud');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content teacher-request-modal">
        <div className="modal-header">
          <h2>🎓 Solicita Cuenta de Profesor</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          <div className="info-section">
            <h3>Beneficios de ser Profesor en Simonkey</h3>
            <ul className="benefits-list">
              <li>✅ Crea hasta 5 materias (ampliable con plan Pro)</li>
              <li>✅ Invita hasta 30 estudiantes gratuitamente</li>
              <li>✅ Crea exámenes y evalúa el progreso</li>
              <li>✅ Accede a analytics detallados de tu clase</li>
              <li>✅ Genera códigos de invitación personalizados</li>
            </ul>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="bio">Cuéntanos sobre ti *</label>
              <textarea
                id="bio"
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                placeholder="Ej: Soy profesor de matemáticas con 5 años de experiencia..."
                rows={3}
                required
                maxLength={500}
              />
              <small>{formData.bio.length}/500 caracteres</small>
            </div>

            <div className="form-group">
              <label htmlFor="specialties">Especialidades (separadas por comas)</label>
              <input
                type="text"
                id="specialties"
                name="specialties"
                value={formData.specialties}
                onChange={handleInputChange}
                placeholder="Ej: Matemáticas, Física, Química"
              />
            </div>

            <div className="form-group">
              <label htmlFor="institution">Institución (opcional)</label>
              <input
                type="text"
                id="institution"
                name="institution"
                value={formData.institution}
                onChange={handleInputChange}
                placeholder="Ej: Universidad Nacional, Colegio San José"
              />
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  name="acceptTerms"
                  checked={formData.acceptTerms}
                  onChange={handleInputChange}
                />
                <span>
                  Acepto los términos y condiciones y me comprometo a usar
                  la plataforma de manera responsable y educativa
                </span>
              </label>
            </div>

            {error && (
              <div className="error-message">
                ⚠️ {error}
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={isLoading || !formData.acceptTerms}
              >
                {isLoading ? 'Enviando...' : 'Enviar Solicitud'}
              </button>
            </div>
          </form>

          <div className="info-note">
            <p>
              <strong>Nota:</strong> Tu solicitud será revisada por nuestro equipo
              en un plazo de 24-48 horas. Te notificaremos por email cuando sea aprobada.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherRequestModal;