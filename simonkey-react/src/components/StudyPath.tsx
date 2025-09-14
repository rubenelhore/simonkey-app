import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Book, Edit3, Puzzle, Brain, CreditCard, Zap, Mic, HelpCircle } from 'lucide-react';
import './StudyPath.css';
import { Notebook } from '../types/interfaces';
import { PointsCalculationService } from '../services/pointsCalculationService';
import { auth } from '../services/firebase';
import { getEffectiveUserId } from '../utils/getEffectiveUserId';

interface StudyPathProgress {
  freeStudy: boolean;
  fillBlank: boolean;
  puzzle: boolean;
  smart: boolean;
  memory: boolean;
  battle: boolean;
  voice: boolean;
  quiz: boolean;
}

interface StudyPathProps {
  notebook: Notebook;
  onModuleClick: (moduleType: string) => void;
  onResetPath?: () => void;
  onModuleComplete?: (moduleType: string) => void;
  studyProgress: {
    freeStudy: boolean;
    fillBlank: boolean;
    puzzle: boolean;
    smart: boolean;
    memory: boolean;
    battle: boolean;
    voice: boolean;
    quiz: boolean;
  };
}

const StudyPath: React.FC<StudyPathProps> = ({ notebook, onModuleClick, onResetPath, onModuleComplete, studyProgress }) => {
  console.log('🎯 StudyPath component mounted with notebook:', notebook.id);
  console.log('🎯 DEPURACIÓN Mount - Detalles del notebook:', {
    id: notebook.id,
    title: notebook.title,
    timestamp: new Date().toLocaleTimeString(),
    props: { onModuleClick: !!onModuleClick, onResetPath: !!onResetPath, onModuleComplete: !!onModuleComplete }
  });
  
  const [simonPosition, setSimonPosition] = useState(0);
  const [completedModules, setCompletedModules] = useState<number>(0);
  const [pathProgress, setPathProgress] = useState<StudyPathProgress>({
    freeStudy: false,
    fillBlank: false,
    puzzle: false,
    smart: false,
    memory: false,
    battle: false,
    voice: false,
    quiz: false
  });
  
  console.log('🔄 StudyPath current state:', {
    notebook: notebook.id,
    simonPosition,
    completedModules,
    pathProgress
  });
  
  // Debug localStorage en el render
  console.log('🔍 LocalStorage debug:', {
    studyViewMode: localStorage.getItem('studyViewMode'),
    studyPath: localStorage.getItem(`studyPath_${notebook.id}`),
    pointsSnapshot: localStorage.getItem(`pointsSnapshot_${notebook.id}`)
  });

  const modules = [
    { id: 'free', name: 'Estudio Libre', icon: Book, type: 'free', key: 'freeStudy' as keyof StudyPathProgress },
    { id: 'fillblank', name: 'Fill in the Blank', icon: Edit3, type: 'fillblank', key: 'fillBlank' as keyof StudyPathProgress },
    { id: 'puzzle', name: 'Puzzle de Definiciones', icon: Puzzle, type: 'puzzle', key: 'puzzle' as keyof StudyPathProgress },
    { id: 'smart', name: 'Repaso Inteligente', icon: Brain, type: 'smart', key: 'smart' as keyof StudyPathProgress },
    { id: 'memory', name: 'Memorama', icon: CreditCard, type: 'memory', key: 'memory' as keyof StudyPathProgress },
    { id: 'battle', name: 'Quiz Battle', icon: Zap, type: 'battle', key: 'battle' as keyof StudyPathProgress },
    { id: 'voice', name: 'Estudio Activo', icon: Mic, type: 'voice', key: 'voice' as keyof StudyPathProgress },
    { id: 'quiz', name: 'Quiz', icon: HelpCircle, type: 'quiz', key: 'quiz' as keyof StudyPathProgress }
  ];

  // Cargar progreso cuando cambia el cuaderno
  useEffect(() => {
    console.log('🔄 StudyPath useEffect ejecutándose para notebook:', notebook.id);
    console.log('🔄 DEPURACIÓN useEffect - Razón del useEffect:', {
      notebookId: notebook.id,
      timestamp: new Date().toLocaleTimeString(),
      stackTrace: new Error().stack?.split('\n').slice(1, 3).map(line => line.trim())
    });

    // Cargar progreso específico del cuaderno
    const savedProgress = localStorage.getItem(`studyPath_${notebook.id}`);
    console.log('📂 Progreso guardado para este cuaderno:', savedProgress);
    console.log('📂 DEPURACIÓN localStorage - Todo el studyPath localStorage:', {
      allStudyPaths: Object.keys(localStorage).filter(key => key.startsWith('studyPath_')).map(key => ({
        key,
        value: localStorage.getItem(key)
      }))
    });

    if (savedProgress) {
      try {
        const parsed = JSON.parse(savedProgress);
        setPathProgress(parsed);
        console.log('✅ Progreso de ruta cargado para cuaderno:', notebook.id, parsed);
      } catch (error) {
        console.error('Error parsing saved path progress:', error);
        console.log('⚠️ [StudyPath] Error en parsing - manteniendo progreso actual sin resetear');
        // NO resetear - mantener el progreso actual en el estado
      }
    } else {
      console.log('ℹ️ No hay progreso guardado para este cuaderno');
      console.log('🔄 [StudyPath] Inicializando progreso basado en studyProgress prop');
      // Inicializar basándose en el progreso real del usuario
      initializeFromStudyProgress();
    }

    // 🎯 NUEVO SISTEMA: Verificar aumento de puntos para marcar progreso
    checkPointsIncrease();
  }, [notebook.id]);

  // Sincronizar progreso cuando cambia el studyProgress prop
  useEffect(() => {
    console.log('🔄 StudyPath studyProgress prop cambió:', studyProgress);

    // Solo actualizar si tenemos progreso real del prop y es diferente
    const hasRealProgress = Object.values(studyProgress).some(val => val === true);
    if (hasRealProgress) {
      console.log('📊 Actualizando progreso de ruta desde studyProgress prop');

      const updatedProgress: StudyPathProgress = {
        freeStudy: studyProgress.freeStudy || false,
        fillBlank: studyProgress.fillBlank || false,
        puzzle: studyProgress.puzzle || false,
        smart: studyProgress.smart || false,
        memory: studyProgress.memory || false,
        battle: studyProgress.battle || false,
        voice: studyProgress.voice || false,
        quiz: studyProgress.quiz || false
      };

      setPathProgress(updatedProgress);
      localStorage.setItem(`studyPath_${notebook.id}`, JSON.stringify(updatedProgress));
      console.log('💾 Progreso actualizado y sincronizado:', updatedProgress);
    }
  }, [studyProgress, notebook.id]);

  // Función para inicializar progreso basándose en el studyProgress prop
  const initializeFromStudyProgress = () => {
    console.log('🚀 [StudyPath] Inicializando progreso desde studyProgress prop:', studyProgress);

    // Mapear el studyProgress prop al formato de pathProgress
    const initialProgress: StudyPathProgress = {
      freeStudy: studyProgress.freeStudy || false,
      fillBlank: studyProgress.fillBlank || false,
      puzzle: studyProgress.puzzle || false,
      smart: studyProgress.smart || false,
      memory: studyProgress.memory || false,
      battle: studyProgress.battle || false,
      voice: studyProgress.voice || false,
      quiz: studyProgress.quiz || false
    };

    console.log('📊 [StudyPath] Progreso inicial calculado:', initialProgress);
    setPathProgress(initialProgress);

    // Guardar en localStorage para persistir
    localStorage.setItem(`studyPath_${notebook.id}`, JSON.stringify(initialProgress));
    console.log('💾 [StudyPath] Progreso inicial guardado en localStorage');
  };

  // 📸 Sistema de "foto de puntos" para detectar progreso automáticamente
  const checkPointsIncrease = async () => {
    try {
      console.log('📸 [StudyPath] Verificando aumento de puntos...');
      
      const pointsSnapshot = localStorage.getItem(`pointsSnapshot_${notebook.id}`);
      if (!pointsSnapshot) {
        console.log('📸 [StudyPath] No hay snapshot de puntos previo');
        return;
      }

      const snapshot = JSON.parse(pointsSnapshot);
      console.log('📸 [StudyPath] Snapshot encontrado:', snapshot);

      if (!auth.currentUser) {
        console.log('📸 [StudyPath] No hay usuario autenticado');
        return;
      }

      const effectiveUserData = await getEffectiveUserId();
      const userId = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;

      // Calcular puntos actuales
      const currentPoints = await PointsCalculationService.calculateNotebookPoints(notebook.id, userId);
      console.log('📸 [StudyPath] Puntos actuales:', currentPoints);
      console.log('📸 [StudyPath] Puntos anteriores:', snapshot.points);

      // Verificar si hubo aumento en el score total
      const pointsIncrease = currentPoints.score - snapshot.points.score;
      console.log('📸 [StudyPath] Diferencia de puntos:', pointsIncrease);

      if (pointsIncrease > 0) {
        console.log('✅ [StudyPath] ¡Hubo aumento de puntos! Marcando módulo como completado:', snapshot.moduleType);
        
        // Marcar el módulo como completado
        completeModule(snapshot.moduleType);
        
        // Limpiar el snapshot ya que se procesó
        localStorage.removeItem(`pointsSnapshot_${notebook.id}`);
        console.log('🧹 [StudyPath] Snapshot de puntos eliminado');
        
      } else {
        console.log('❌ [StudyPath] No hubo aumento de puntos suficiente');
      }

    } catch (error) {
      console.error('Error checking points increase:', error);
    }
  };

  // Actualizar progreso y posición de Simón
  useEffect(() => {
    const completed = modules.filter(m => pathProgress[m.key]).length;
    setCompletedModules(completed);
    setSimonPosition(Math.min(completed, modules.length - 1));
    
    console.log('📊 Estado actual del progreso de ruta:', {
      pathProgress,
      completedCount: completed,
      simonPosition: Math.min(completed, modules.length - 1),
      modulesWithProgress: modules.map(m => ({
        name: m.name,
        type: m.type,
        key: m.key,
        completed: pathProgress[m.key]
      }))
    });
    
    // Guardar progreso en localStorage
    console.log('💾 [StudyPath] GUARDANDO PROGRESO EN localStorage:', {
      key: `studyPath_${notebook.id}`,
      progreso: pathProgress,
      timestamp: new Date().toLocaleTimeString(),
      stackTrace: new Error().stack?.split('\n')[1]?.trim()
    });
    localStorage.setItem(`studyPath_${notebook.id}`, JSON.stringify(pathProgress));
    
    // Si todos los módulos están completados, lanzar confeti
    if (completed === modules.length && completed > 0) {
      launchConfetti();
    }
  }, [pathProgress, notebook.id]);

  const launchConfetti = () => {
    // Confeti desde los lados
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      
      // Confeti desde la izquierda
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: ['#6147FF', '#FFD700', '#10B981', '#FF9500', '#FF3B30']
      });
      
      // Confeti desde la derecha
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: ['#6147FF', '#FFD700', '#10B981', '#FF9500', '#FF3B30']
      });
    }, 250);

    // Confeti especial en el centro
    setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#6147FF', '#FFD700', '#10B981'],
        zIndex: 9999
      });
    }, 500);
  };

  const getModuleStatus = (index: number) => {
    const module = modules[index];
    const isCompleted = pathProgress[module.key];
    
    // Si está completado en la ruta, mostrar como completado
    if (isCompleted) return 'completed';
    
    // Solo está disponible si es el primer módulo O si el anterior está completado EN LA RUTA
    if (index === 0 || (index > 0 && pathProgress[modules[index - 1].key])) return 'available';
    
    return 'locked';
  };

  const handleModuleClick = async (index: number, type: string) => {
    const status = getModuleStatus(index);
    if (status === 'available' || status === 'completed') {
      console.log('📸 [StudyPath] Módulo clickeado:', type);
      
      // 📸 Tomar "foto" de puntos antes de navegar al módulo
      await takePointsSnapshot(type);
      
      onModuleClick(type);
    }
  };

  // 📸 Función para tomar snapshot de puntos antes de iniciar un módulo
  const takePointsSnapshot = async (moduleType: string) => {
    try {
      console.log('📸 [StudyPath] Tomando snapshot de puntos para módulo:', moduleType);
      
      if (!auth.currentUser) {
        console.log('📸 [StudyPath] No hay usuario autenticado para snapshot');
        return;
      }

      const effectiveUserData = await getEffectiveUserId();
      const userId = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;

      // Calcular puntos actuales
      const currentPoints = await PointsCalculationService.calculateNotebookPoints(notebook.id, userId);
      console.log('📸 [StudyPath] Puntos antes del módulo:', currentPoints);

      // Guardar snapshot en localStorage
      const snapshot = {
        moduleType,
        notebookId: notebook.id,
        points: currentPoints,
        timestamp: Date.now()
      };

      localStorage.setItem(`pointsSnapshot_${notebook.id}`, JSON.stringify(snapshot));
      console.log('📸 [StudyPath] Snapshot guardado:', snapshot);

    } catch (error) {
      console.error('Error taking points snapshot:', error);
    }
  };

  // Función para marcar un módulo como completado en la ruta
  const completeModule = (moduleType: string) => {
    console.log('🎯 completeModule llamado para tipo:', moduleType);
    const module = modules.find(m => m.type === moduleType);
    console.log('📋 Módulo encontrado:', module);
    
    if (module) {
      console.log('✅ Marcando módulo como completado, key:', module.key);
      setPathProgress(prev => {
        console.log('📊 [StudyPath] ACTUALIZANDO STATE - Progreso anterior:', prev);
        const newProgress = {
          ...prev,
          [module.key]: true
        };
        console.log('📊 [StudyPath] ACTUALIZANDO STATE - Nuevo progreso:', newProgress);
        console.log('📊 [StudyPath] Módulo marcado como completado:', module.key, '=', true);
        return newProgress;
      });
      
      // Notificar al componente padre si existe el callback
      if (onModuleComplete) {
        console.log('🔔 Notificando al componente padre');
        onModuleComplete(moduleType);
      } else {
        console.log('ℹ️ No hay callback onModuleComplete');
      }
    } else {
      console.error('❌ Módulo no encontrado para tipo:', moduleType);
    }
  };

  // Función expuesta eliminada - ahora usamos sistema de puntos

  return (
    <div className="study-path-container">
      <div className="path-header">
        <h2>Ruta de Aprendizaje</h2>
        <p>Completa los módulos en orden para que Simón llegue a su banana 🍌</p>
        <div className="progress-indicator">
          <span className="progress-text">{completedModules} de {modules.length} módulos completados</span>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${(completedModules / modules.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="study-path">
        <svg className="path-svg" viewBox="0 0 800 600">
          {/* Dibujar el camino */}
          <path 
            className="path-line"
            d="M 50 100 Q 150 100 250 150 T 450 150 Q 550 150 650 200 T 750 300 Q 750 400 650 450 T 450 450 Q 350 450 250 500 T 50 500"
            fill="none"
            stroke="#e0e0e0"
            strokeWidth="8"
            strokeDasharray="20 10"
          />
          
          {/* Línea de progreso */}
          <path 
            className="path-progress"
            d="M 50 100 Q 150 100 250 150 T 450 150 Q 550 150 650 200 T 750 300 Q 750 400 650 450 T 450 450 Q 350 450 250 500 T 50 500"
            fill="none"
            stroke="url(#gradient)"
            strokeWidth="8"
            strokeDasharray={`${(completedModules / modules.length) * 2000} 2000`}
          />
          
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#667eea" />
              <stop offset="100%" stopColor="#764ba2" />
            </linearGradient>
          </defs>
        </svg>

        {/* Módulos en el camino */}
        <div className="path-modules">
          {modules.map((module, index) => {
            const status = getModuleStatus(index);
            const position = getModulePosition(index);
            
            return (
              <div
                key={module.id}
                className={`path-module ${status}`}
                style={{
                  left: `${position.x}%`,
                  top: `${position.y}%`,
                }}
                onClick={() => handleModuleClick(index, module.type)}
              >
                <div className="module-node">
                  {status === 'completed' && <span className="checkmark">✓</span>}
                  {status === 'locked' && <span className="lock">🔒</span>}
                  {status === 'available' && <span className="sparkle">✨</span>}
                </div>
                <div className="module-content">
                  <div className="module-icon">
                    <module.icon size={24} color="white" />
                  </div>
                  <div className="module-name">{module.name}</div>
                </div>
                {index === modules.length - 1 && (
                  <div className={`banana-goal ${completedModules === modules.length ? 'completed' : ''}`}>🍌</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Simón el mono */}
        <div 
          className={`simon-monkey ${completedModules === modules.length ? 'completed' : ''}`}
          style={{
            left: `${getModulePosition(simonPosition).x}%`,
            top: `${getModulePosition(simonPosition).y - 10}%`,
          }}
        >
          <div className="simon-sprite">
            <img 
              src="/img/favicon.svg" 
              alt="Simón el mono" 
              className="simon-logo"
            />
          </div>
          <div className="simon-shadow"></div>
        </div>
      </div>

      {/* Mensaje motivacional */}
      <div className="motivational-message">
        {completedModules === 0 && (
          <p>¡Comienza tu aventura de aprendizaje! Haz clic en el primer módulo para empezar.</p>
        )}
        {completedModules > 0 && completedModules < modules.length && (
          <p>¡Excelente progreso! Sigue adelante para desbloquear el siguiente módulo.</p>
        )}
        {completedModules === modules.length && (
          <div className="victory-message">
            <p>🎉 ¡Increíble! ¡Has completado toda la ruta de aprendizaje!</p>
            <p>🐵 Simón ha llegado a su banana y está muy orgulloso de ti 🍌</p>
          </div>
        )}
      </div>
    </div>
  );

  function getModulePosition(index: number) {
    // Posiciones predefinidas para cada módulo en el camino
    const positions = [
      { x: 10, y: 15 },  // Estudio Libre
      { x: 25, y: 25 },  // Fill in the Blank
      { x: 45, y: 20 },  // Puzzle
      { x: 65, y: 30 },  // Repaso Inteligente
      { x: 80, y: 45 },  // Memorama
      { x: 65, y: 60 },  // Quiz Battle
      { x: 45, y: 70 },  // Estudio Activo
      { x: 25, y: 75 },  // Quiz (con banana)
    ];
    return positions[index] || { x: 50, y: 50 };
  }
};

export default StudyPath;