import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { SchoolExam, ConceptSelection } from '../types/exam.types';
import { db, auth } from '../services/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { UnifiedNotebookService } from '../services/unifiedNotebookService';
import { UnifiedConceptService } from '../services/unifiedConceptService';
import '../styles/CreateExamModal.css';

interface CreateExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  materiaId?: string;
  notebooks?: Array<{
    id: string;
    title: string;
    conceptCount: number;
  }>;
  materias?: Array<{
    id: string;
    nombre: string;
    color?: string;
  }>;
  onExamCreated: () => void;
}

const CreateExamModal: React.FC<CreateExamModalProps> = ({
  isOpen,
  onClose,
  materiaId,
  notebooks = [],
  materias = [],
  onExamCreated
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedMateriaId, setSelectedMateriaId] = useState(materiaId || '');
  const [notebooksForSelectedMateria, setNotebooksForSelectedMateria] = useState<Array<{
    id: string;
    title: string;
    conceptCount: number;
  }>>([]);
  const [examData, setExamData] = useState({
    title: '',
    description: '',
    selectedNotebooks: [] as string[],
    percentageQuestions: 50,
    timePerConcept: 60,
    totalConcepts: 0,
    questionsPerStudent: 0
  });
  const [loading, setLoading] = useState(false);

  // Inicializar materia seleccionada
  useEffect(() => {
    if (materiaId) {
      setSelectedMateriaId(materiaId);
    } else if (materias && materias.length > 0 && !selectedMateriaId) {
      setSelectedMateriaId(materias[0].id);
    }
  }, [materiaId, materias, selectedMateriaId]);

  // Cargar notebooks cuando se selecciona una materia
  useEffect(() => {
    const loadNotebooksForMateria = async () => {
      if (!selectedMateriaId) return;

      try {
        console.log('📚 Cargando notebooks para materia:', selectedMateriaId);
        
        // Si ya tenemos notebooks (modo legacy), usarlos
        if (notebooks && notebooks.length > 0) {
          setNotebooksForSelectedMateria(notebooks);
          return;
        }

        // Cargar notebooks de la materia usando UnifiedNotebookService
        // Para profesores regulares, usar notebooks regulares
        const teacherNotebooks = await UnifiedNotebookService.getRegularTeacherNotebooks([selectedMateriaId], auth.currentUser?.uid || '');
        
        const notebooksData = [];
        for (const notebook of teacherNotebooks) {
          const conceptCount = await UnifiedConceptService.getConceptCount(notebook.id);
          notebooksData.push({
            id: notebook.id,
            title: notebook.title,
            conceptCount: conceptCount
          });
        }
        
        console.log('📚 Notebooks cargados:', notebooksData);
        setNotebooksForSelectedMateria(notebooksData);
      } catch (error) {
        console.error('❌ Error cargando notebooks:', error);
        setNotebooksForSelectedMateria([]);
      }
    };

    loadNotebooksForMateria();
  }, [selectedMateriaId]);

  // Calcular total de conceptos cuando cambian los cuadernos seleccionados
  useEffect(() => {
    const calculateTotalConcepts = () => {
      // Usar los notebooks de la materia seleccionada
      const notebooksToUse = notebooksForSelectedMateria;
      
      // Verificar que notebooks existe y es un array
      if (!notebooksToUse || !Array.isArray(notebooksToUse)) {
        console.log('⚠️ Notebooks no disponible o no es array:', notebooksToUse);
        return;
      }

      const total = notebooksToUse
        .filter(nb => examData.selectedNotebooks.includes(nb.id))
        .reduce((sum, nb) => sum + (nb.conceptCount || 0), 0);
      
      setExamData(prev => ({
        ...prev,
        totalConcepts: total,
        questionsPerStudent: Math.round(total * (prev.percentageQuestions / 100))
      }));
    };

    calculateTotalConcepts();
  }, [examData.selectedNotebooks, examData.percentageQuestions, notebooksForSelectedMateria]);

  const handleNotebookToggle = (notebookId: string) => {
    setExamData(prev => ({
      ...prev,
      selectedNotebooks: prev.selectedNotebooks.includes(notebookId)
        ? prev.selectedNotebooks.filter(id => id !== notebookId)
        : [...prev.selectedNotebooks, notebookId]
    }));
  };

  const handlePercentageChange = (percentage: number) => {
    setExamData(prev => ({
      ...prev,
      percentageQuestions: percentage,
      questionsPerStudent: Math.round(prev.totalConcepts * (percentage / 100))
    }));
  };

  const handleTimeChange = (time: number) => {
    setExamData(prev => ({
      ...prev,
      timePerConcept: time
    }));
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes === 0) {
      return `${seconds} segundos`;
    } else if (remainingSeconds === 0) {
      return `${minutes} minuto${minutes > 1 ? 's' : ''}`;
    } else {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1:
        const hasTitleAndMateria = examData.title.trim() !== '' && selectedMateriaId !== '';
        return hasTitleAndMateria;
      case 2:
        return examData.selectedNotebooks.length > 0;
      case 3:
        return true;
      default:
        return false;
    }
  };

  const handleCreateExam = async () => {
    if (!auth.currentUser) return;

    setLoading(true);
    try {
      // Obtener información del usuario y escuela
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      
      if (!userDoc.exists()) {
        throw new Error('No se pudo encontrar el usuario');
      }
      
      const userData = userDoc.data();
      console.log('📚 Datos del usuario profesor:', userData);
      
      // Para profesores escolares, obtener el idEscuela
      let idEscuela = userData.schoolData?.idEscuela || userData.idEscuela;
      
      // Si no tiene idEscuela pero tiene idAdmin, obtener el idInstitucion del admin
      if (!idEscuela && userData.idAdmin) {
        console.log('🔍 Buscando idEscuela desde el admin:', userData.idAdmin);
        const adminDoc = await getDoc(doc(db, 'users', userData.idAdmin));
        
        if (adminDoc.exists()) {
          const adminData = adminDoc.data();
          idEscuela = adminData.idInstitucion || adminData.schoolData?.idEscuela;
          console.log('🏫 ID Escuela obtenido del admin:', idEscuela);
        }
      }
      
      console.log('🏫 ID Escuela final:', idEscuela);

      if (!idEscuela) {
        console.error('Error: No se encontró idEscuela en profesor ni en admin:', userData);
        throw new Error('No se pudo identificar la escuela del profesor');
      }

      const newExam: Omit<SchoolExam, 'id'> = {
        title: examData.title,
        description: examData.description,
        idMateria: selectedMateriaId,
        idProfesor: auth.currentUser.uid,
        idEscuela: idEscuela,
        notebookIds: examData.selectedNotebooks,
        percentageQuestions: examData.percentageQuestions,
        timePerConcept: examData.timePerConcept,
        totalConcepts: examData.totalConcepts,
        questionsPerStudent: examData.questionsPerStudent,
        createdAt: serverTimestamp() as any,
        isActive: true,
        settings: {
          shuffleQuestions: true,
          showResultsImmediately: false,
          preventTabSwitch: true,
          allowPause: false
        }
      };

      console.log('📝 Creando examen con los siguientes datos:', {
        title: newExam.title,
        idMateria: newExam.idMateria,
        idProfesor: newExam.idProfesor,
        idEscuela: newExam.idEscuela,
        notebookIds: newExam.notebookIds,
        isActive: newExam.isActive
      });

      const docRef = await addDoc(collection(db, 'schoolExams'), newExam);
      console.log('✅ Examen creado exitosamente con ID:', docRef.id);
      
      // Verificar que el documento se creó correctamente
      const verifyDoc = await getDoc(doc(db, 'schoolExams', docRef.id));
      if (!verifyDoc.exists()) {
        console.error('⚠️ El examen se creó pero no se puede verificar');
      } else {
        console.log('✅ Examen verificado exitosamente');
      }
      
      onExamCreated();
      
      // Preguntar si quiere ver el dashboard del examen
      if (window.confirm('¿Deseas ver el dashboard del examen creado?')) {
        // Usar navigate en lugar de window.location.href para mejor manejo del routing
        setTimeout(() => {
          window.location.href = `/exam/${docRef.id}/dashboard`;
        }, 500); // Pequeño delay para asegurar que el documento esté completamente sincronizado
      }
      
      onClose();
    } catch (error) {
      console.error('Error creando examen:', error);
      alert('Error al crear el examen. Por favor intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="modal-overlay" onClick={onClose}>
      <div className="create-exam-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Crear Nuevo Examen</h2>
          <button className="close-button" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${(currentStep / 3) * 100}%` }}></div>
        </div>

        <div className="modal-content">
          {/* Paso 1: Información básica */}
          {currentStep === 1 && (
            <div className="exam-creation-step">
              <h3>Información del examen</h3>
              <div className="form-group">
                <label>Título del examen *</label>
                <input
                  type="text"
                  placeholder="Ej: Examen parcial de conceptos"
                  value={examData.title}
                  onChange={(e) => setExamData(prev => ({ ...prev, title: e.target.value }))}
                  className="form-input"
                />
              </div>
              {/* Selector de materia (solo si hay múltiples materias) */}
              {materias && materias.length > 0 && (
                <div className="form-group">
                  <label>Materia *</label>
                  <select
                    value={selectedMateriaId}
                    onChange={(e) => setSelectedMateriaId(e.target.value)}
                    className="form-select"
                  >
                    <option value="">Selecciona una materia</option>
                    {materias.map(materia => (
                      <option key={materia.id} value={materia.id}>
                        {materia.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <div className="form-group">
                <label>Descripción (opcional)</label>
                <textarea
                  placeholder="Instrucciones o información adicional..."
                  value={examData.description}
                  onChange={(e) => setExamData(prev => ({ ...prev, description: e.target.value }))}
                  className="form-textarea"
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Paso 2: Selección de cuadernos */}
          {currentStep === 2 && (
            <div className="notebook-selection">
              <h3>Selecciona los cuadernos</h3>
              <p className="step-description">
                Los conceptos del examen se tomarán de estos cuadernos
              </p>
              {notebooksForSelectedMateria.length === 0 ? (
                <div className="no-notebooks-message">
                  <i className="fas fa-book" style={{ fontSize: '2rem', color: '#9ca3af', marginBottom: '1rem' }}></i>
                  <p>No hay cuadernos disponibles para esta materia.</p>
                  {!selectedMateriaId && (
                    <p>Selecciona una materia para ver los cuadernos disponibles.</p>
                  )}
                </div>
              ) : (
                <div className="notebooks-grid">
                  {notebooksForSelectedMateria.map(notebook => (
                  <div
                    key={notebook.id}
                    className={`notebook-checkbox-card ${
                      examData.selectedNotebooks.includes(notebook.id) ? 'selected' : ''
                    }`}
                    onClick={() => handleNotebookToggle(notebook.id)}
                  >
                    <div className="checkbox-wrapper">
                      <input
                        type="checkbox"
                        checked={examData.selectedNotebooks.includes(notebook.id)}
                        onChange={() => {}}
                      />
                    </div>
                    <div className="notebook-info">
                      <h4>{notebook.title}</h4>
                      <span className="concept-count">
                        <i className="fas fa-lightbulb"></i>
                        {notebook.conceptCount} conceptos
                      </span>
                    </div>
                  </div>
                  ))}
                </div>
              )}
              {examData.selectedNotebooks.length > 0 && (
                <div className="total-concepts-info">
                  <i className="fas fa-info-circle"></i>
                  Total de conceptos disponibles: <strong>{examData.totalConcepts}</strong>
                </div>
              )}
            </div>
          )}

          {/* Paso 3: Configuración */}
          {currentStep === 3 && (
            <div className="exam-configuration">
              <h3>Configuración del examen</h3>
              
              <div className="config-section">
                <label>Porcentaje de preguntas</label>
                <div className="percentage-selector">
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="10"
                    value={examData.percentageQuestions}
                    onChange={(e) => handlePercentageChange(Number(e.target.value))}
                    className="percentage-slider"
                  />
                  <span className="percentage-value">{examData.percentageQuestions}%</span>
                </div>
                <p className="config-help">
                  Cada estudiante recibirá una selección aleatoria diferente
                </p>
              </div>

              <div className="questions-preview">
                <div className="preview-card">
                  <i className="fas fa-question-circle"></i>
                  <div className="preview-content">
                    <h4>{examData.questionsPerStudent}</h4>
                    <p>preguntas por alumno</p>
                  </div>
                </div>
              </div>

              <div className="config-section">
                <label>Tiempo por concepto</label>
                <select
                  value={examData.timePerConcept}
                  onChange={(e) => handleTimeChange(Number(e.target.value))}
                  className="time-selector"
                >
                  <option value="30">30 segundos</option>
                  <option value="45">45 segundos</option>
                  <option value="60">1 minuto</option>
                  <option value="90">1 minuto 30 segundos</option>
                  <option value="120">2 minutos</option>
                </select>
              </div>

              <div className="total-time-preview">
                <i className="fas fa-clock"></i>
                <span>
                  Tiempo total del examen: <strong>
                    {formatTime(examData.questionsPerStudent * examData.timePerConcept)}
                  </strong>
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {currentStep > 1 && (
            <button
              className="btn-secondary"
              onClick={() => setCurrentStep(prev => prev - 1)}
              disabled={loading}
            >
              Anterior
            </button>
          )}
          
          {currentStep < 3 ? (
            <button
              className="btn-primary"
              onClick={() => setCurrentStep(prev => prev + 1)}
              disabled={!canProceed()}
            >
              Siguiente
            </button>
          ) : (
            <button
              className="btn-primary"
              onClick={handleCreateExam}
              disabled={loading || !canProceed()}
            >
              {loading ? 'Creando...' : 'Crear Examen'}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default CreateExamModal;