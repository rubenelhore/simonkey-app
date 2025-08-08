// src/pages/ExamTestPage.tsx
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import { Concept } from '../types/interfaces';
import '../styles/ExamTestPage.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faGear, 
  faPlay, 
  faQuestionCircle, 
  faPenToSquare, 
  faArrowsLeftRight, 
  faCheckCircle,
  faSpinner,
  faClock,
  faBookOpen,
  faSliders
} from '@fortawesome/free-solid-svg-icons';

// Tipos de pregunta disponibles
export enum QuestionType {
  MULTIPLE_CHOICE = 'multiple_choice',
  FILL_BLANKS = 'fill_blanks',
  MATCH_COLUMNS = 'match_columns'
}

// Niveles de dificultad
export enum DifficultyLevel {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard'
}

interface ExamConfig {
  questionCount: number;
  difficulty: DifficultyLevel;
  questionTypes: QuestionType[];
  timeLimit?: number; // en minutos
}

interface ExamQuestion {
  id: string;
  type: QuestionType;
  concept: Concept;
  question: string;
  options?: string[]; // para opción múltiple
  correctAnswer: string;
  blanks?: string[]; // para rellenar espacios
  columns?: {
    left: string[];
    right: string[];
    matches: { [key: string]: string };
  }; // para relacionar columnas
}

const ExamTestPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { notebookId, notebookTitle } = location.state || {};
  
  // Estados para configuración
  const [showConfig, setShowConfig] = useState(true);
  const [examConfig, setExamConfig] = useState<ExamConfig>({
    questionCount: 10,
    difficulty: DifficultyLevel.MEDIUM,
    questionTypes: [QuestionType.MULTIPLE_CHOICE],
    timeLimit: 30
  });
  
  // Estados para el examen
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [examQuestions, setExamQuestions] = useState<ExamQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<{ [key: string]: any }>({});
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [examStarted, setExamStarted] = useState(false);
  const [examCompleted, setExamCompleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState<number>(0);

  // Cargar conceptos del cuaderno
  useEffect(() => {
    const loadConcepts = async () => {
      if (!notebookId) return;
      
      try {
        const conceptsQuery = query(
          collection(db, 'concepts'),
          where('notebookId', '==', notebookId)
        );
        
        const conceptsSnapshot = await getDocs(conceptsQuery);
        const conceptsData = conceptsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Concept[];
        
        setConcepts(conceptsData);
      } catch (error) {
        console.error('Error loading concepts:', error);
      }
    };

    loadConcepts();
  }, [notebookId]);

  // Generar preguntas basadas en configuración
  const generateExamQuestions = async () => {
    setLoading(true);
    
    try {
      if (concepts.length < examConfig.questionCount) {
        alert(`No hay suficientes conceptos. Disponibles: ${concepts.length}, Solicitados: ${examConfig.questionCount}`);
        setLoading(false);
        return;
      }

      // Seleccionar conceptos aleatorios
      const selectedConcepts = concepts
        .sort(() => 0.5 - Math.random())
        .slice(0, examConfig.questionCount);

      const questions: ExamQuestion[] = [];

      for (let i = 0; i < selectedConcepts.length; i++) {
        const concept = selectedConcepts[i];
        const questionType = examConfig.questionTypes[
          Math.floor(Math.random() * examConfig.questionTypes.length)
        ];

        const question = await generateQuestionByType(concept, questionType, i);
        questions.push(question);
      }

      setExamQuestions(questions);
      setTimeLeft((examConfig.timeLimit || 30) * 60); // Convertir a segundos
      setShowConfig(false);
      setExamStarted(true);
    } catch (error) {
      console.error('Error generating questions:', error);
      alert('Error al generar las preguntas del examen');
    }
    
    setLoading(false);
  };

  // Generar pregunta según el tipo
  const generateQuestionByType = async (
    concept: Concept, 
    type: QuestionType, 
    index: number
  ): Promise<ExamQuestion> => {
    const baseQuestion: Partial<ExamQuestion> = {
      id: `q_${index}`,
      type,
      concept,
    };

    switch (type) {
      case QuestionType.MULTIPLE_CHOICE:
        return generateMultipleChoiceQuestion(baseQuestion as ExamQuestion);
      
      case QuestionType.FILL_BLANKS:
        return generateFillBlanksQuestion(baseQuestion as ExamQuestion);
      
      case QuestionType.MATCH_COLUMNS:
        return generateMatchColumnsQuestion(baseQuestion as ExamQuestion);
      
      default:
        return generateMultipleChoiceQuestion(baseQuestion as ExamQuestion);
    }
  };

  // Generar pregunta de opción múltiple
  const generateMultipleChoiceQuestion = (baseQuestion: ExamQuestion): ExamQuestion => {
    const concept = baseQuestion.concept;
    
    // Crear opciones incorrectas usando otros conceptos
    const incorrectOptions = concepts
      .filter(c => c.id !== concept.id)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3)
      .map(c => c.definition);

    const options = [concept.definition, ...incorrectOptions].sort(() => 0.5 - Math.random());
    
    return {
      ...baseQuestion,
      question: `¿Cuál es la definición de "${concept.term}"?`,
      options,
      correctAnswer: concept.definition
    };
  };

  // Generar pregunta de rellenar espacios
  const generateFillBlanksQuestion = (baseQuestion: ExamQuestion): ExamQuestion => {
    const concept = baseQuestion.concept;
    const definition = concept.definition;
    
    // Seleccionar palabras clave para reemplazar con espacios
    const words = definition.split(' ');
    const importantWords = words.filter(word => word.length > 3);
    const wordToBlank = importantWords[Math.floor(Math.random() * importantWords.length)];
    
    const questionText = definition.replace(new RegExp(`\\b${wordToBlank}\\b`, 'gi'), '______');
    
    return {
      ...baseQuestion,
      question: `Completa la siguiente definición de "${concept.term}": ${questionText}`,
      correctAnswer: wordToBlank.toLowerCase(),
      blanks: [wordToBlank]
    };
  };

  // Generar pregunta de relacionar columnas
  const generateMatchColumnsQuestion = (baseQuestion: ExamQuestion): ExamQuestion => {
    const concept = baseQuestion.concept;
    
    // Obtener otros conceptos para crear las columnas
    const otherConcepts = concepts
      .filter(c => c.id !== concept.id)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3);

    const allConcepts = [concept, ...otherConcepts];
    const leftColumn = allConcepts.map(c => c.term).sort(() => 0.5 - Math.random());
    const rightColumn = allConcepts.map(c => c.definition).sort(() => 0.5 - Math.random());
    
    const matches: { [key: string]: string } = {};
    allConcepts.forEach(c => {
      matches[c.term] = c.definition;
    });
    
    return {
      ...baseQuestion,
      question: 'Relaciona cada término con su definición correcta:',
      columns: {
        left: leftColumn,
        right: rightColumn,
        matches
      },
      correctAnswer: JSON.stringify(matches)
    };
  };

  // Timer del examen
  useEffect(() => {
    if (examStarted && !examCompleted && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            completeExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [examStarted, examCompleted, timeLeft]);

  // Completar examen
  const completeExam = () => {
    setExamCompleted(true);
    calculateScore();
  };

  // Calcular puntuación
  const calculateScore = () => {
    let correctAnswers = 0;
    
    examQuestions.forEach(question => {
      const userAnswer = userAnswers[question.id];
      
      if (question.type === QuestionType.MULTIPLE_CHOICE) {
        if (userAnswer === question.correctAnswer) correctAnswers++;
      } else if (question.type === QuestionType.FILL_BLANKS) {
        if (userAnswer?.toLowerCase() === question.correctAnswer.toLowerCase()) correctAnswers++;
      } else if (question.type === QuestionType.MATCH_COLUMNS) {
        const correctMatches = JSON.parse(question.correctAnswer);
        const userMatches = userAnswer || {};
        
        let matchScore = 0;
        Object.keys(correctMatches).forEach(term => {
          if (userMatches[term] === correctMatches[term]) matchScore++;
        });
        
        if (matchScore === Object.keys(correctMatches).length) correctAnswers++;
      }
    });
    
    setScore(Math.round((correctAnswers / examQuestions.length) * 100));
  };

  // Formatear tiempo
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Renderizar configuración del examen
  const renderExamConfig = () => (
    <div className="exam-config-container">
      <div className="exam-config-card">
        <div className="config-header">
          <FontAwesomeIcon icon={faGear} />
          <h2>Configurar Prueba de Examen</h2>
          <p>Personaliza tu examen según tus necesidades</p>
        </div>

        <div className="config-form">
          {/* Cantidad de preguntas */}
          <div className="config-group">
            <label>
              <FontAwesomeIcon icon={faQuestionCircle} />
              Cantidad de preguntas
            </label>
            <div className="number-input">
              <button 
                onClick={() => setExamConfig(prev => ({ 
                  ...prev, 
                  questionCount: Math.max(1, prev.questionCount - 1) 
                }))}
              >
                -
              </button>
              <span>{examConfig.questionCount}</span>
              <button 
                onClick={() => setExamConfig(prev => ({ 
                  ...prev, 
                  questionCount: Math.min(concepts.length, prev.questionCount + 1) 
                }))}
              >
                +
              </button>
            </div>
            <small>Máximo disponible: {concepts.length} preguntas</small>
          </div>

          {/* Dificultad */}
          <div className="config-group">
            <label>
              <FontAwesomeIcon icon={faSliders} />
              Nivel de dificultad
            </label>
            <div className="difficulty-options">
              {Object.values(DifficultyLevel).map(level => (
                <button
                  key={level}
                  className={`difficulty-btn ${examConfig.difficulty === level ? 'active' : ''}`}
                  onClick={() => setExamConfig(prev => ({ ...prev, difficulty: level }))}
                >
                  {level === 'easy' ? 'Fácil' : level === 'medium' ? 'Medio' : 'Difícil'}
                </button>
              ))}
            </div>
          </div>

          {/* Tipos de pregunta */}
          <div className="config-group">
            <label>
              <FontAwesomeIcon icon={faPenToSquare} />
              Tipos de pregunta
            </label>
            <div className="question-types">
              {Object.values(QuestionType).map(type => {
                const isSelected = examConfig.questionTypes.includes(type);
                return (
                  <button
                    key={type}
                    className={`question-type-btn ${isSelected ? 'active' : ''}`}
                    onClick={() => {
                      setExamConfig(prev => ({
                        ...prev,
                        questionTypes: isSelected
                          ? prev.questionTypes.filter(t => t !== type)
                          : [...prev.questionTypes, type]
                      }));
                    }}
                  >
                    <FontAwesomeIcon 
                      icon={
                        type === QuestionType.MULTIPLE_CHOICE ? faQuestionCircle :
                        type === QuestionType.FILL_BLANKS ? faPenToSquare :
                        faArrowsLeftRight
                      } 
                    />
                    {type === 'multiple_choice' ? 'Opción Múltiple' :
                     type === 'fill_blanks' ? 'Rellenar Espacios' :
                     'Relacionar Columnas'}
                  </button>
                );
              })}
            </div>
            {examConfig.questionTypes.length === 0 && (
              <small className="error">Selecciona al menos un tipo de pregunta</small>
            )}
          </div>

          {/* Límite de tiempo */}
          <div className="config-group">
            <label>
              <FontAwesomeIcon icon={faClock} />
              Límite de tiempo (minutos)
            </label>
            <div className="number-input">
              <button 
                onClick={() => setExamConfig(prev => ({ 
                  ...prev, 
                  timeLimit: Math.max(5, (prev.timeLimit || 30) - 5) 
                }))}
              >
                -
              </button>
              <span>{examConfig.timeLimit}</span>
              <button 
                onClick={() => setExamConfig(prev => ({ 
                  ...prev, 
                  timeLimit: Math.min(120, (prev.timeLimit || 30) + 5) 
                }))}
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="config-actions">
          <button
            className="start-exam-btn"
            onClick={generateExamQuestions}
            disabled={loading || examConfig.questionTypes.length === 0 || concepts.length === 0}
          >
            {loading ? (
              <>
                <FontAwesomeIcon icon={faSpinner} spin />
                Generando...
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faPlay} />
                Iniciar Examen
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  // Renderizar pregunta actual
  const renderCurrentQuestion = () => {
    if (!examQuestions[currentQuestionIndex]) return null;
    
    const question = examQuestions[currentQuestionIndex];
    
    return (
      <div className="question-container">
        <div className="question-header">
          <div className="question-progress">
            <span>{currentQuestionIndex + 1} de {examQuestions.length}</span>
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${((currentQuestionIndex + 1) / examQuestions.length) * 100}%` }}
              />
            </div>
          </div>
          <div className="time-remaining">
            <FontAwesomeIcon icon={faClock} />
            {formatTime(timeLeft)}
          </div>
        </div>

        <div className="question-content">
          <h3>{question.question}</h3>
          
          {question.type === QuestionType.MULTIPLE_CHOICE && (
            <div className="multiple-choice-options">
              {question.options?.map((option, index) => (
                <button
                  key={index}
                  className={`option-btn ${userAnswers[question.id] === option ? 'selected' : ''}`}
                  onClick={() => setUserAnswers(prev => ({ ...prev, [question.id]: option }))}
                >
                  {String.fromCharCode(65 + index)}. {option}
                </button>
              ))}
            </div>
          )}

          {question.type === QuestionType.FILL_BLANKS && (
            <div className="fill-blanks-input">
              <input
                type="text"
                placeholder="Escribe tu respuesta..."
                value={userAnswers[question.id] || ''}
                onChange={(e) => setUserAnswers(prev => ({ ...prev, [question.id]: e.target.value }))}
              />
            </div>
          )}

          {question.type === QuestionType.MATCH_COLUMNS && question.columns && (
            <div className="match-columns-container">
              <div className="columns">
                <div className="column">
                  <h4>Términos</h4>
                  {question.columns.left.map(term => (
                    <div key={term} className="column-item">{term}</div>
                  ))}
                </div>
                <div className="column">
                  <h4>Definiciones</h4>
                  {question.columns.right.map(definition => (
                    <button
                      key={definition}
                      className={`definition-btn ${
                        Object.values(userAnswers[question.id] || {}).includes(definition) 
                          ? 'selected' : ''
                      }`}
                      onClick={() => {
                        // Implementar lógica de matching aquí
                        console.log('Match logic needed');
                      }}
                    >
                      {definition}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="question-navigation">
          <button
            onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
            disabled={currentQuestionIndex === 0}
          >
            Anterior
          </button>
          
          {currentQuestionIndex === examQuestions.length - 1 ? (
            <button
              className="complete-btn"
              onClick={completeExam}
            >
              <FontAwesomeIcon icon={faCheckCircle} />
              Completar Examen
            </button>
          ) : (
            <button
              onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
            >
              Siguiente
            </button>
          )}
        </div>
      </div>
    );
  };

  // Renderizar resultados
  const renderResults = () => (
    <div className="exam-results-container">
      <div className="results-card">
        <div className="results-header">
          <FontAwesomeIcon icon={faCheckCircle} />
          <h2>¡Examen Completado!</h2>
          <div className="score-display">
            <span className="score-number">{score}%</span>
            <span className="score-label">Puntuación Final</span>
          </div>
        </div>

        <div className="results-stats">
          <div className="stat">
            <span className="stat-value">{examQuestions.length}</span>
            <span className="stat-label">Preguntas</span>
          </div>
          <div className="stat">
            <span className="stat-value">{Math.round((score / 100) * examQuestions.length)}</span>
            <span className="stat-label">Correctas</span>
          </div>
          <div className="stat">
            <span className="stat-value">{formatTime((examConfig.timeLimit! * 60) - timeLeft)}</span>
            <span className="stat-label">Tiempo Usado</span>
          </div>
        </div>

        <div className="results-actions">
          <button
            onClick={() => {
              setShowConfig(true);
              setExamStarted(false);
              setExamCompleted(false);
              setCurrentQuestionIndex(0);
              setUserAnswers({});
              setExamQuestions([]);
            }}
          >
            Nuevo Examen
          </button>
          <button
            onClick={() => navigate('/study')}
          >
            Volver al Estudio
          </button>
        </div>
      </div>
    </div>
  );

  if (!notebookId) {
    return (
      <div className="exam-test-container">
        <HeaderWithHamburger title="Prueba de Examen" subtitle="" />
        <div className="error-container">
          <p>No se ha seleccionado un cuaderno válido</p>
          <button onClick={() => navigate('/study')}>Volver</button>
        </div>
      </div>
    );
  }

  return (
    <div className="exam-test-container">
      <HeaderWithHamburger 
        title="Prueba de Examen" 
        subtitle={notebookTitle || ''} 
        showBackButton={!examStarted || examCompleted}
        onBackClick={() => navigate('/study')}
      />
      
      <main className="exam-test-main">
        {showConfig && renderExamConfig()}
        {examStarted && !examCompleted && renderCurrentQuestion()}
        {examCompleted && renderResults()}
      </main>
    </div>
  );
};

export default ExamTestPage;