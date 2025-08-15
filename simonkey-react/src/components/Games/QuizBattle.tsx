import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFistRaised, faArrowLeft, faClock, faHeart, faBolt, faShield } from '@fortawesome/free-solid-svg-icons';
import { useGamePoints } from '../../hooks/useGamePoints';
import { useStudyService } from '../../hooks/useStudyService';
import { useUserType } from '../../hooks/useUserType';
import { getEffectiveUserId } from '../../utils/getEffectiveUserId';
import HeaderWithHamburger from '../HeaderWithHamburger';
import '../../styles/QuizBattle.css';

interface Concept {
  id: string;
  term: string;
  definition: string;
}

interface Question {
  id: string;
  definition: string;
  correctAnswer: string;
  options: string[];
}

interface Power {
  type: 'critical' | 'shield' | 'heal';
  icon: any;
  name: string;
  active: boolean;
}

interface Character {
  id: string;
  emoji: string;
  name: string;
  description: string;
  powerName: string;
  powerDescription: string;
  powerCondition: string;
}

// Character definitions
const CHARACTERS: Character[] = [
  {
    id: 'warrior',
    emoji: '👽',
    name: 'Alienígena',
    description: 'Ser extraterrestre con tecnología avanzada',
    powerName: 'Rayo Energético',
    powerDescription: 'Duplica tu daño de ataque por 3 turnos consecutivos',
    powerCondition: 'Se activa automáticamente después de 3 respuestas correctas seguidas'
  },
  {
    id: 'wizard',
    emoji: '🧙‍♂️',
    name: 'Mago',
    description: 'Maestro de las artes arcanas',
    powerName: 'Escudo Mágico',
    powerDescription: 'Te vuelve inmune a todo daño por 2 turnos completos',
    powerCondition: 'Se activa automáticamente cuando recibes 25+ puntos de daño'
  },
  {
    id: 'ninja',
    emoji: '🥷',
    name: 'Ninja',
    description: 'Sigiloso y letal en combate',
    powerName: 'Ataque Crítico',
    powerDescription: 'Tu próximo ataque hace 3 veces más daño (una sola vez)',
    powerCondition: 'Se activa automáticamente cuando tu HP baja de 20 puntos'
  },
  {
    id: 'robot',
    emoji: '🤖',
    name: 'Cyborg',
    description: 'Inteligencia artificial avanzada',
    powerName: 'Regeneración',
    powerDescription: 'Restaura 30 puntos de vida al instante (SOLO UNA VEZ por partida)',
    powerCondition: 'Se activa automáticamente cuando tu HP llega a 15 o menos (uso único)'
  },
  {
    id: 'dragon',
    emoji: '🐉',
    name: 'Dragón',
    description: 'Criatura legendaria de poder inmenso',
    powerName: 'Aliento de Fuego',
    powerDescription: 'Quema al enemigo causando 10 de daño instantáneo',
    powerCondition: 'Se activa automáticamente al inicio de cada ronda (una vez por ronda)'
  }
];

interface QuizBattleProps {
  notebookId: string;
  notebookTitle: string;
  onBack: () => void;
}

const QuizBattle: React.FC<QuizBattleProps> = ({ notebookId, notebookTitle, onBack }) => {
  // Game state
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [playerHP, setPlayerHP] = useState(60); // Reduced HP for shorter battles
  const [enemyHP, setEnemyHP] = useState(60);
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(10);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState<'correct' | 'wrong' | null>(null);
  const [enemyThinking, setEnemyThinking] = useState(false);
  const [playerPower, setPlayerPower] = useState<Power | null>(null);
  const [enemyShield, setEnemyShield] = useState(false);
  const [playerShield, setPlayerShield] = useState(false);
  const [pointsAwarded, setPointsAwarded] = useState(false);
  const [noReviewedConcepts, setNoReviewedConcepts] = useState(false);
  const [showRoundVictory, setShowRoundVictory] = useState(false);
  const [defeatedRound, setDefeatedRound] = useState(0);
  const [showCharacterSelection, setShowCharacterSelection] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [characterPowerActive, setCharacterPowerActive] = useState(false);
  const [powerDuration, setPowerDuration] = useState(0);
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);
  const [dragonPowerUsedThisRound, setDragonPowerUsedThisRound] = useState(false);
  const [dragonPowerUsesRemaining, setDragonPowerUsesRemaining] = useState(3);
  const [robotPowerUsed, setRobotPowerUsed] = useState(false);
  const [showPowerNotification, setShowPowerNotification] = useState(false);
  const [powerNotificationText, setPowerNotificationText] = useState('');
  const [powerUsesRemaining, setPowerUsesRemaining] = useState(0);
  const [showLightningEffect, setShowLightningEffect] = useState(false);
  const [showShieldEffect, setShowShieldEffect] = useState(false);
  const [showHealEffect, setShowHealEffect] = useState(false);
  const [showFireEffect, setShowFireEffect] = useState(false);
  const [showCriticalEffect, setShowCriticalEffect] = useState(false);
  const [isPowerEffectActive, setIsPowerEffectActive] = useState(false);
  
  // Power condition progress tracking
  const getPowerProgress = (): { current: number; max: number; label: string } => {
    if (!selectedCharacter) return { current: 0, max: 1, label: '' };
    
    switch (selectedCharacter.id) {
      case 'warrior':
        return {
          current: consecutiveCorrect,
          max: 3,
          label: `Respuestas correctas: ${consecutiveCorrect}/3`
        };
      case 'wizard':
        return {
          current: characterPowerActive ? powerDuration : 0,
          max: 2,
          label: characterPowerActive ? `Escudo activo: ${powerDuration} turnos` : 'Esperando daño crítico (25+ HP)'
        };
      case 'ninja':
        const hpProgress = Math.max(0, Math.min(20, playerHP));
        return {
          current: 20 - hpProgress,
          max: 20,
          label: playerHP >= 20 ? `HP: ${playerHP}/60` : characterPowerActive ? 'Crítico listo!' : `HP crítico: ${playerHP}`
        };
      case 'robot':
        return {
          current: 0,
          max: 0, // Hide progress bar
          label: robotPowerUsed ? 'Regeneración ya utilizada (1/1)' : 'Disponible cuando tu HP<15 (0/1)'
        };
      case 'dragon':
        return {
          current: 3 - dragonPowerUsesRemaining,
          max: 3,
          label: `Disparos usados: ${3 - dragonPowerUsesRemaining}/3${dragonPowerUsesRemaining > 0 ? ' - Listo para disparar' : ' - Sin disparos'}`
        };
      default:
        return { current: 0, max: 1, label: '' };
    }
  };
  const { addPoints } = useGamePoints(notebookId);
  const { isSchoolStudent } = useUserType();
  const studyService = useStudyService(isSchoolStudent ? 'school' : 'premium');
  
  // Animation states
  const [playerAttacking, setPlayerAttacking] = useState(false);
  const [enemyAttacking, setEnemyAttacking] = useState(false);
  const [playerHit, setPlayerHit] = useState(false);
  const [enemyHit, setEnemyHit] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Enemy configurations for each round
  const enemies = [
    { name: 'Estudiante Novato', accuracy: 0.6, thinkTime: 3000, avatar: '🧑‍🎓' },
    { name: 'Profesor Experto', accuracy: 0.75, thinkTime: 2000, avatar: '👨‍🏫' },
    { name: 'Maestro Sabio', accuracy: 0.9, thinkTime: 1000, avatar: '🧙‍♂️' }
  ];

  useEffect(() => {
    loadConcepts();
  }, [notebookId]);

  // Timer effect - runs for both player and enemy turns but pauses during power effects
  useEffect(() => {
    if (gameStarted && !gameOver && timeLeft > 0 && !selectedAnswer && !isPowerEffectActive) {
      timerRef.current = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
    } else if (timeLeft === 0 && !selectedAnswer && !isPowerEffectActive) {
      // Time's up
      if (isPlayerTurn) {
        // Player timeout - automatic wrong answer
        handleAnswer(-1);
      } else {
        // Enemy timeout - they miss their turn
        nextTurn(false);
      }
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timeLeft, gameStarted, gameOver, isPlayerTurn, selectedAnswer, isPowerEffectActive]);

  // Robot regeneration effect - triggers automatically when HP <= 15
  useEffect(() => {
    if (selectedCharacter?.id === 'robot' && playerHP <= 15 && !robotPowerUsed && gameStarted && !gameOver && !isPowerEffectActive) {
      setRobotPowerUsed(true);
      setPlayerHP(prev => Math.min(60, prev + 30));
      showPowerActivation(`${selectedCharacter.emoji} ¡Regeneración activada! +30 HP`);
      // Show heal effect and pause timer
      setIsPowerEffectActive(true);
      setShowHealEffect(true);
      setTimeout(() => {
        setShowHealEffect(false);
        setIsPowerEffectActive(false);
      }, 2000);
    }
  }, [playerHP, selectedCharacter, robotPowerUsed, gameStarted, gameOver, isPowerEffectActive]);

  const loadConcepts = async () => {
    if (!auth.currentUser) return;

    setLoading(true);
    try {
      // Obtener el ID efectivo del usuario
      const effectiveUserData = await getEffectiveUserId();
      const userId = effectiveUserData ? effectiveUserData.id : auth.currentUser.uid;
      
      // Obtener TODOS los conceptos del cuaderno primero
      let allConcepts: any[] = await studyService.getAllConceptsFromNotebook(userId, notebookId);
      console.log('⚔️ Total de conceptos en el cuaderno:', allConcepts.length);
      
      // Obtener datos de aprendizaje para filtrar solo conceptos repasados
      const learningData = await studyService.getLearningDataForNotebook(userId, notebookId);
      console.log('📚 Datos de aprendizaje encontrados:', learningData.length);
      
      // Crear un Set con los IDs de conceptos que tienen datos de aprendizaje (han sido repasados)
      const reviewedConceptIds = new Set(learningData.map(data => data.conceptId));
      
      // Filtrar solo los conceptos que han sido repasados
      const reviewedConcepts = allConcepts.filter(concept => 
        reviewedConceptIds.has(concept.id)
      );
      
      console.log('🎯 Conceptos repasados disponibles para el juego:', reviewedConcepts.length);
      
      if (reviewedConcepts.length < 4) {
        console.log('⚠️ No hay suficientes conceptos repasados para el juego (mínimo 4)');
        setNoReviewedConcepts(true);
        setLoading(false);
        return;
      }
      
      // Convertir al formato que espera el juego
      const conceptsList: Concept[] = reviewedConcepts.map(concept => ({
        id: concept.id,
        term: concept.término || '',
        definition: concept.definición || ''
      }));

      console.log('🎯 Total de conceptos repasados para el juego:', conceptsList.length);
      setConcepts(conceptsList);
      setLoading(false);
    } catch (error) {
      console.error('Error loading concepts:', error);
      setLoading(false);
    }
  };

  const generateQuestion = (): Question => {
    const concept = concepts[Math.floor(Math.random() * concepts.length)];
    const otherConcepts = concepts.filter(c => c.id !== concept.id);
    const wrongAnswers = otherConcepts
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(c => c.term);
    
    const options = [concept.term, ...wrongAnswers].sort(() => Math.random() - 0.5);
    
    return {
      id: Math.random().toString(),
      definition: concept.definition,
      correctAnswer: concept.term,
      options
    };
  };

  const startGame = () => {
    setShowCharacterSelection(true);
  };

  const selectCharacter = (character: Character) => {
    setSelectedCharacter(character);
    setShowCharacterSelection(false);
    setGameStarted(true);
    setPlayerHP(60);
    setEnemyHP(60);
    setRound(1);
    setScore(0);
    setCombo(0);
    setIsPlayerTurn(true);
    setEnemyThinking(false);
    setPointsAwarded(false);
    setCharacterPowerActive(false);
    setPowerDuration(0);
    setConsecutiveCorrect(0);
    setDragonPowerUsedThisRound(false);
    setDragonPowerUsesRemaining(3);
    setRobotPowerUsed(false);
    setGameOver(false);
    
    // If dragon is selected, activate fire breath at the very start
    if (character.id === 'dragon') {
      setTimeout(() => {
        setDragonPowerUsedThisRound(true);
        setDragonPowerUsesRemaining(prev => prev - 1);
        showPowerActivation(`${character.emoji} ¡Aliento de Fuego! -10 HP al enemigo`);
        
        // Show fire effect and pause timer
        setIsPowerEffectActive(true);
        setShowFireEffect(true);
        
        // Apply damage immediately
        setEnemyHP(prev => Math.max(0, prev - 10));
        
        setTimeout(() => {
          setShowFireEffect(false);
          setIsPowerEffectActive(false);
          
          // Check if enemy died from dragon fire
          if (60 - 10 <= 0) {
            if (1 < 3) {
              setDefeatedRound(1);
              setShowRoundVictory(true);
              setTimeout(() => {
                setShowRoundVictory(false);
                nextRound();
              }, 3000);
            } else {
              endGame(true);
            }
            return;
          }
          
          // Continue with normal first turn
          setTimeout(() => nextTurn(true), 500);
        }, 2000);
      }, 500);
    } else {
      setTimeout(() => nextTurn(true), 500); // Start with player turn for other characters
    }
  };

  const nextTurn = (forPlayer: boolean = isPlayerTurn) => {
    console.log('Next turn - forPlayer:', forPlayer); // Debug
    
    const question = generateQuestion();
    setCurrentQuestion(question);
    setTimeLeft(10);
    setSelectedAnswer(null);
    setShowResult(null);
    
    // If it's enemy turn, trigger enemy answer
    if (!forPlayer && gameStarted && !gameOver) {
      console.log('Setting up enemy turn...'); // Debug
      setEnemyThinking(true);
      const enemy = enemies[round - 1];
      setTimeout(() => {
        console.log('Calling enemyAnswer...'); // Debug
        enemyAnswer();
      }, enemy.thinkTime);
    }
  };

  // Show power notification
  const showPowerActivation = (message: string) => {
    setPowerNotificationText(message);
    setShowPowerNotification(true);
    setTimeout(() => {
      setShowPowerNotification(false);
    }, 3000);
  };

  // Check and activate character powers
  const checkCharacterPowers = () => {
    if (!selectedCharacter) return;

    switch (selectedCharacter.id) {
      case 'warrior':
        // Furia de Combate: Al responder 3 preguntas correctas seguidas
        if (consecutiveCorrect >= 3 && !characterPowerActive) {
          setCharacterPowerActive(true);
          setPowerDuration(3);
          setPowerUsesRemaining(3);
          showPowerActivation(`${selectedCharacter.emoji} ¡${selectedCharacter.name} activa Rayo Energético! Daño x2 por 3 turnos`);
        }
        break;
      
      case 'ninja':
        // Ataque Crítico: Al tener menos de 20 HP
        if (playerHP < 20 && !characterPowerActive) {
          setCharacterPowerActive(true);
          setPowerDuration(1);
          setPowerUsesRemaining(1);
          showPowerActivation(`${selectedCharacter.emoji} ¡${selectedCharacter.name} activa Ataque Crítico! Siguiente ataque x3`);
        }
        break;
      
      case 'robot':
        // Regeneración: Al llegar a 15 HP o menos
        if (playerHP <= 15 && !characterPowerActive) {
          setPlayerHP(prev => Math.min(60, prev + 30));
          showPowerActivation(`${selectedCharacter.emoji} ¡${selectedCharacter.name} se regenera! +30 HP`);
        }
        break;
    }
  };

  const calculateDamage = (isCorrect: boolean, comboCount: number): number => {
    if (!isCorrect) return 0;
    
    const baseDamage = 15;
    const comboDamage = Math.min(comboCount * 2, 10); // Max 10 combo damage
    let totalDamage = baseDamage + comboDamage;
    
    // Check for critical hit power
    if (playerPower?.type === 'critical' && isPlayerTurn) {
      setPlayerPower(null);
      totalDamage = totalDamage * 2;
    }
    
    // Apply character power modifiers
    if (selectedCharacter && characterPowerActive && isPlayerTurn) {
      switch (selectedCharacter.id) {
        case 'warrior':
          // Alien: Double damage with lightning ray effect
          totalDamage = totalDamage * 2;
          showPowerActivation(`${selectedCharacter.emoji} ¡Rayo Energético activa! Daño x2`);
          // Show lightning effect and pause timer
          setIsPowerEffectActive(true);
          setShowLightningEffect(true);
          setTimeout(() => {
            setShowLightningEffect(false);
            setIsPowerEffectActive(false);
          }, 2000);
          break;
        case 'ninja':
          // Ninja: Triple damage for critical attack
          totalDamage = totalDamage * 3;
          showPowerActivation(`${selectedCharacter.emoji} ¡Ataque Crítico! Daño x3`);
          // Show critical strike effect and pause timer
          setIsPowerEffectActive(true);
          setShowCriticalEffect(true);
          setTimeout(() => {
            setShowCriticalEffect(false);
            setIsPowerEffectActive(false);
          }, 2000);
          setCharacterPowerActive(false);
          setPowerDuration(0);
          setPowerUsesRemaining(0);
          break;
      }
      
      // Decrease power duration for warrior
      if (selectedCharacter.id === 'warrior') {
        const newDuration = powerDuration - 1;
        const newUses = powerUsesRemaining - 1;
        setPowerDuration(newDuration);
        setPowerUsesRemaining(newUses);
        
        if (newDuration <= 0) {
          setCharacterPowerActive(false);
          showPowerActivation(`${selectedCharacter.emoji} Furia de Combate se desvanece`);
        }
      }
    }
    
    return totalDamage;
  };

  const handleAnswer = (answerIndex: number) => {
    if (!currentQuestion || selectedAnswer !== null) return;
    
    setSelectedAnswer(answerIndex);
    const isCorrect = answerIndex >= 0 && currentQuestion.options[answerIndex] === currentQuestion.correctAnswer;
    
    if (isPlayerTurn) {
      if (isCorrect) {
        const newCombo = combo + 1;
        setCombo(newCombo);
        setConsecutiveCorrect(consecutiveCorrect + 1);
        
        // Check for character power activation before calculating damage
        checkCharacterPowers();
        
        const damage = calculateDamage(true, combo);
        
        // Check for shield
        if (!enemyShield) {
          setPlayerAttacking(true);
          setTimeout(() => {
            setEnemyHit(true);
            setEnemyHP(prev => Math.max(0, prev - damage));
          }, 300);
          setTimeout(() => {
            setPlayerAttacking(false);
            setEnemyHit(false);
          }, 600);
        } else {
          setEnemyShield(false);
        }
        
        setScore(score + 5 + combo);
        
        // Check for power activation (every 3 correct answers)
        if (newCombo % 3 === 0) {
          activateRandomPower();
        }
      } else {
        setCombo(0);
        setConsecutiveCorrect(0);
      }
    }
    
    setShowResult(isCorrect ? 'correct' : 'wrong');
    
    setTimeout(() => {
      // Check if someone died
      if (isPlayerTurn && isCorrect && !enemyShield) {
        const damage = calculateDamage(true, combo);
        if (enemyHP - damage <= 0) {
          // Round won - show victory message first
          if (round < 3) {
            setDefeatedRound(round);
            setShowRoundVictory(true);
            // Continue to next round after 3 seconds
            setTimeout(() => {
              setShowRoundVictory(false);
              nextRound();
            }, 3000);
          } else {
            endGame(true);
          }
          return;
        }
      }
      
      // Switch turns and continue
      if (isPlayerTurn) {
        setIsPlayerTurn(false);
        setTimeout(() => nextTurn(false), 500); // Pass false for enemy turn
      }
    }, 1500);
  };

  const enemyAnswer = () => {
    if (!currentQuestion || gameOver || selectedAnswer !== null) return;
    
    console.log('Enemy answering...'); // Debug
    
    const enemy = enemies[round - 1];
    const shouldAnswerCorrect = Math.random() < enemy.accuracy;
    
    let answerIndex: number;
    if (shouldAnswerCorrect) {
      answerIndex = currentQuestion.options.findIndex(opt => opt === currentQuestion.correctAnswer);
    } else {
      // Pick a wrong answer
      const wrongIndices = currentQuestion.options
        .map((_, idx) => idx)
        .filter(idx => currentQuestion.options[idx] !== currentQuestion.correctAnswer);
      answerIndex = wrongIndices[Math.floor(Math.random() * wrongIndices.length)];
    }
    
    setEnemyThinking(false);
    setSelectedAnswer(answerIndex);
    
    let playerDied = false;
    let damageToPlayer = 0;
    
    if (shouldAnswerCorrect) {
      damageToPlayer = 15 + Math.floor(Math.random() * 5); // Enemy damage varies
      
      // Dragon power no longer applies burn damage over time
      
      // Check for Wizard's shield activation and protection
      if (selectedCharacter?.id === 'wizard' && damageToPlayer >= 25) {
        if (!characterPowerActive) {
          // Activate shield when taking critical damage
          setCharacterPowerActive(true);
          setPowerDuration(2);
          setPowerUsesRemaining(2);
          showPowerActivation(`${selectedCharacter.emoji} ¡Escudo Mágico activado! Inmunidad por 2 turnos`);
        }
        
        if (characterPowerActive) {
          showPowerActivation(`${selectedCharacter.emoji} ¡Escudo Mágico te protege!`);
          // Show shield effect and pause timer
          setIsPowerEffectActive(true);
          setShowShieldEffect(true);
          setTimeout(() => {
            setShowShieldEffect(false);
            setIsPowerEffectActive(false);
          }, 2000);
          
          const newDuration = powerDuration - 1;
          setPowerDuration(newDuration);
          setPowerUsesRemaining(newDuration);
          
          if (newDuration <= 0) {
            setCharacterPowerActive(false);
            showPowerActivation(`${selectedCharacter.emoji} Escudo Mágico se desvanece`);
          }
          return; // No damage taken
        }
      }
      
      if (!playerShield) {
        setEnemyAttacking(true);
        setTimeout(() => {
          setPlayerHit(true);
          setPlayerHP(prev => {
            const newHP = Math.max(0, prev - damageToPlayer);
            if (newHP <= 0) {
              playerDied = true;
            }
            return newHP;
          });
        }, 300);
        setTimeout(() => {
          setEnemyAttacking(false);
          setPlayerHit(false);
        }, 600);
      } else {
        setPlayerShield(false);
      }
    }
    
    setShowResult(shouldAnswerCorrect ? 'correct' : 'wrong');
    
    // Always switch back to player turn after enemy answers
    setTimeout(async () => {
      if (playerDied) {
        await endGame(false);
      } else if (!gameOver) {
        // Robot regeneration is now handled by useEffect
        
        setIsPlayerTurn(true);
        setTimeout(() => nextTurn(true), 500); // Pass true for player turn
      }
    }, 2000);
  };

  const activateRandomPower = () => {
    const powers: Power[] = [
      { type: 'critical', icon: faBolt, name: 'Golpe Crítico', active: true },
      { type: 'shield', icon: faShield, name: 'Escudo', active: true },
      { type: 'heal', icon: faHeart, name: 'Curación', active: true }
    ];
    
    const power = powers[Math.floor(Math.random() * powers.length)];
    
    if (power.type === 'heal') {
      setPlayerHP(prev => Math.min(60, prev + 15));
    } else if (power.type === 'shield') {
      setPlayerShield(true);
    } else {
      setPlayerPower(power);
    }
  };

  const nextRound = () => {
    const newRound = round + 1;
    setRound(newRound);
    setEnemyHP(60);
    setPlayerHP(60); // Full heal between rounds
    setIsPlayerTurn(true);
    setEnemyThinking(false);
    setSelectedAnswer(null);
    setShowResult(null);
    
    // Reset character powers for new round but keep the selected character
    setCharacterPowerActive(false);
    setPowerDuration(0);
    setConsecutiveCorrect(0);
    setDragonPowerUsedThisRound(false); // Reset dragon power for new round
    
    // If dragon, activate fire breath at the start of new round (if has remaining uses)
    if (selectedCharacter?.id === 'dragon' && dragonPowerUsesRemaining > 0) {
      setTimeout(() => {
        setDragonPowerUsedThisRound(true);
        setDragonPowerUsesRemaining(prev => prev - 1);
        showPowerActivation(`${selectedCharacter.emoji} ¡Aliento de Fuego! -10 HP al enemigo`);
        
        // Show fire effect and pause timer
        setIsPowerEffectActive(true);
        setShowFireEffect(true);
        
        // Apply damage immediately
        setEnemyHP(prev => Math.max(0, prev - 10));
        
        setTimeout(() => {
          setShowFireEffect(false);
          setIsPowerEffectActive(false);
          
          // Check if enemy died from dragon fire
          if (60 - 10 <= 0) {
            if (newRound < 3) {
              setDefeatedRound(newRound);
              setShowRoundVictory(true);
              setTimeout(() => {
                setShowRoundVictory(false);
                nextRound();
              }, 3000);
            } else {
              endGame(true);
            }
            return;
          }
          
          // Continue with normal first turn of new round
          setTimeout(() => nextTurn(true), 500);
        }, 2000);
      }, 1000);
    } else {
      setTimeout(() => nextTurn(true), 1000); // Player starts new round for other characters
    }
  };

  const endGame = async (won: boolean) => {
    setGameOver(true);
    let finalScore = score;
    if (won) {
      finalScore = score + 50; // Victory bonus
      setScore(finalScore);
    }
    if (won && !pointsAwarded) {
      await awardGamePoints(finalScore);
    }
  };

  const awardGamePoints = async (finalScore: number) => {
    if (!pointsAwarded) {
      setPointsAwarded(true);
      
      // Determinar bonus basado en el rendimiento
      let bonusType: 'perfect' | 'speed' | 'streak' | undefined;
      
      if (playerHP === 60) {
        bonusType = 'perfect'; // Victoria sin recibir daño
      } else if (round === 3) {
        bonusType = 'streak'; // Completó todas las rondas
      }
      
      const gameId = notebookId ? `quiz_${notebookId}` : 'quiz';
      const result = await addPoints(gameId, 'Quiz Battle', finalScore, bonusType);
      
      if (result?.newAchievements && result.newAchievements.length > 0) {
        console.log('¡Nuevos logros desbloqueados!', result.newAchievements);
      }
    }
  };

  if (loading) {
    return (
      <>
        <HeaderWithHamburger 
          title="Quiz Battle"
          subtitle={notebookTitle}
        />
        <div className="quiz-battle-container with-header-sidebar">
          <div className="loading-container">
            <div className="loading-circle"></div>
            <p className="loading-text">Cargando</p>
          </div>
        </div>
      </>
    );
  }

  if (noReviewedConcepts) {
    return (
      <>
        <HeaderWithHamburger 
          title="Quiz Battle"
          subtitle={notebookTitle}
        />
        <div className="quiz-battle-container with-header-sidebar">
          <div className="no-concepts-message">
            <button className="back-button" onClick={onBack}>
              <FontAwesomeIcon icon={faArrowLeft} />
            </button>
            <div className="empty-state">
              <i className="fas fa-graduation-cap"></i>
              <h2>¡Primero necesitas estudiar!</h2>
              <p>Para jugar, necesitas haber repasado al menos 4 conceptos en el estudio inteligente.</p>
              <p>Los juegos usan solo conceptos que ya has estudiado para reforzar tu aprendizaje.</p>
              <button className="primary-button" onClick={onBack}>
                Volver
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <HeaderWithHamburger 
        title="Quiz Battle"
        subtitle={`${notebookTitle} - Ronda ${round}/3`}
      />
      <div className="quiz-battle-container with-header-sidebar">
      <div className="battle-header">
        <button className="back-button" onClick={onBack}>
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        
        <div className="battle-info">
          <h2>Ronda {round}/3</h2>
          <p className="enemy-name">{enemies[round - 1].name}</p>
        </div>
        
        <div className="score-display">
          <span>Puntos: {score}</span>
        </div>
      </div>

      <div className="battle-arena">
        {/* Enemy Side */}
        <div className="fighter-section enemy-section">
          <div className={`fighter enemy ${enemyAttacking ? 'attacking' : ''} ${enemyHit ? 'hit' : ''}`}>
            <span className="fighter-avatar">{enemies[round - 1].avatar}</span>
            {enemyShield && <FontAwesomeIcon icon={faShield} className="shield-icon" />}
          </div>
          <div className="hp-bar">
            <div className="hp-fill enemy-hp" style={{ width: `${(enemyHP / 60) * 100}%` }}></div>
            <span className="hp-text">{enemyHP}/60</span>
          </div>
          {enemyThinking && <p className="thinking-text">Pensando...</p>}
        </div>

        {/* VS Indicator */}
        <div className="vs-indicator">
          <FontAwesomeIcon icon={faFistRaised} />
        </div>

        {/* Player Side */}
        <div className="fighter-section player-section">
          <div className={`fighter player ${playerAttacking ? 'attacking' : ''} ${playerHit ? 'hit' : ''} character-${selectedCharacter?.id || 'default'}`}>
            <span className="fighter-avatar">{selectedCharacter?.emoji || '🦸‍♂️'}</span>
            {playerShield && <FontAwesomeIcon icon={faShield} className="shield-icon" />}
            {characterPowerActive && (
              <div className={`character-power-effect power-effect-${selectedCharacter?.id}`}>
                ⚡
              </div>
            )}
          </div>
          <div className="hp-bar">
            <div className="hp-fill player-hp" style={{ width: `${(playerHP / 60) * 100}%` }}></div>
            <span className="hp-text">{playerHP}/60</span>
          </div>
          {combo > 0 && <p className="combo-text">Combo x{combo}</p>}
        </div>
      </div>

      {/* Question Section */}
      {currentQuestion && (
        <div className="question-section">
          <div className="timer-bar">
            <FontAwesomeIcon icon={faClock} />
            <span>{timeLeft}s</span>
            <div className="timer-fill" style={{ width: `${(timeLeft / 10) * 100}%` }}></div>
          </div>
          
          <h3 className="question-text">{currentQuestion.definition}</h3>
          
          <div className="options-grid">
            {currentQuestion.options.map((option, index) => (
              <button
                key={index}
                className={`option-button ${
                  selectedAnswer === index 
                    ? (showResult === 'correct' ? 'correct' : 'wrong') 
                    : (showResult === 'wrong' && option === currentQuestion.correctAnswer ? 'correct-answer' : '')
                } ${!isPlayerTurn || selectedAnswer !== null ? 'disabled' : ''}`}
                onClick={() => isPlayerTurn && handleAnswer(index)}
                disabled={!isPlayerTurn || selectedAnswer !== null}
              >
                {option}
              </button>
            ))}
          </div>

          {isPlayerTurn ? (
            <p className="turn-indicator player-turn">¡Tu Turno! Selecciona una respuesta</p>
          ) : (
            <p className="turn-indicator enemy-turn">Turno del oponente</p>
          )}
        </div>
      )}

      {/* Powers Display */}
      {playerPower && (
        <div className="power-indicator">
          <FontAwesomeIcon icon={playerPower.icon} />
          <span>{playerPower.name} Activo</span>
        </div>
      )}
      
      {/* Character Power Progress Tracker */}
      {selectedCharacter && gameStarted && !gameOver && (
        <div className="power-progress-tracker">
          <div className="power-tracker-header">
            <span className="power-tracker-emoji">{selectedCharacter.emoji}</span>
            <span className="power-tracker-name">{selectedCharacter.powerName}</span>
          </div>
          
          <div className="power-progress-container">
            <div className="power-progress-label">
              {getPowerProgress().label}
            </div>
            {getPowerProgress().max > 0 && (
              <>
                <div className="power-progress-bar">
                  <div 
                    className={`power-progress-fill ${selectedCharacter.id}-power`}
                    style={{ 
                      width: `${(getPowerProgress().current / getPowerProgress().max) * 100}%` 
                    }}
                  ></div>
                </div>
                <div className="power-progress-text">
                  {getPowerProgress().current}/{getPowerProgress().max}
                </div>
              </>
            )}
          </div>
          
          {characterPowerActive && (
            <div className="power-active-indicator">
              <span className="power-active-icon">⚡</span>
              <span className="power-active-text">¡PODER ACTIVO!</span>
              {powerUsesRemaining > 0 && (
                <span className="power-uses-text">({powerUsesRemaining} usos)</span>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Power Activation Notification */}
      {showPowerNotification && (
        <div className="power-notification">
          <div className="power-notification-content">
            {powerNotificationText}
          </div>
        </div>
      )}

      {/* Visual Power Effects */}
      {showLightningEffect && (
        <div className="lightning-effect">
          <div className="lightning-bolt lightning-bolt-1"></div>
          <div className="lightning-bolt lightning-bolt-2"></div>
          <div className="lightning-bolt lightning-bolt-3"></div>
        </div>
      )}

      {showShieldEffect && (
        <div className="shield-effect">
          <div className="shield-circle"></div>
        </div>
      )}

      {showHealEffect && (
        <div className="heal-effect">
          <div className="heal-plus">+</div>
          <div className="heal-sparkles">
            <span>✨</span>
            <span>✨</span>
            <span>✨</span>
          </div>
        </div>
      )}

      {showFireEffect && (
        <div className="fire-effect">
          <div className="fire-flame">🔥</div>
          <div className="fire-flame">🔥</div>
          <div className="fire-flame">🔥</div>
        </div>
      )}

      {showCriticalEffect && (
        <div className="critical-effect">
          <div className="critical-slash">⚡</div>
          <div className="critical-text">CRÍTICO</div>
        </div>
      )}

      {/* Game Start Modal */}
      {!gameStarted && !gameOver && !showCharacterSelection && (
        <div className="quiz-intro-overlay">
          <div className="quiz-intro-modal">
            <div className="intro-header">
              <FontAwesomeIcon icon={faFistRaised} className="intro-icon" />
              <h2>Quiz Battle</h2>
            </div>
            
            <div className="intro-content">
              <div className="intro-section">
                <h3>¿Cómo jugar?</h3>
                <ul>
                  <li><i className="fas fa-fist-raised"></i> Derrota a 3 oponentes respondiendo correctamente</li>
                  <li><i className="fas fa-bolt"></i> Cada respuesta correcta hace daño al enemigo</li>
                  <li><i className="fas fa-fire"></i> Los combos aumentan tu daño</li>
                  <li><i className="fas fa-star"></i> Cada personaje tiene un poder único</li>
                </ul>
              </div>
              
              <div className="intro-section">
                <h3>Sistema de batalla</h3>
                <div className="scoring-info">
                  <div className="score-item">
                    <span className="score-points">60 HP</span>
                    <span>Vida inicial</span>
                  </div>
                  <div className="score-item">
                    <span className="score-points">3</span>
                    <span>Rondas totales</span>
                  </div>
                  <div className="score-item">
                    <span className="score-points">10s</span>
                    <span>Por pregunta</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="intro-actions">
              <button className="action-button secondary" onClick={onBack}>
                <FontAwesomeIcon icon={faArrowLeft} />
                Cancelar
              </button>
              <button className="action-button primary" onClick={startGame}>
                <FontAwesomeIcon icon={faFistRaised} />
                ¡Elegir Personaje!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Character Selection Modal */}
      {showCharacterSelection && (
        <div className="character-selection-modal">
          <div className="character-selection-content">
            <h2>Elige tu Personaje</h2>
            <p className="selection-subtitle">Cada uno tiene un poder único</p>
            
            <div className="characters-grid">
              {CHARACTERS.map((character) => (
                <div
                  key={character.id}
                  className="character-card"
                  onClick={() => selectCharacter(character)}
                >
                  <div className="character-emoji">{character.emoji}</div>
                  <h3 className="character-name">{character.name}</h3>
                  <p className="character-description">{character.description}</p>
                  
                  <div className="character-power">
                    <div className="power-name">⚡ {character.powerName}</div>
                    <div className="power-description">{character.powerDescription}</div>
                    <div className="power-condition">
                      <span className="condition-label">Condición:</span>
                      {character.powerCondition}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Round Victory Modal */}
      {showRoundVictory && (
        <div className="round-victory-modal">
          <div className="round-victory-content">
            <div className="victory-enemy-icon">💀</div>
            <h2>¡Enemigo Derrotado!</h2>
            <p className="enemy-defeated-text">
              Has derrotado al {defeatedRound === 1 ? 'primer' : defeatedRound === 2 ? 'segundo' : 'tercer'} oponente
            </p>
            {defeatedRound < 3 && (
              <div className="next-enemy-warning">
                <div className="warning-icon">⚠️</div>
                <p className="warning-text">
                  ¡Cuidado con el siguiente! Es más inteligente y podrá derrotarte
                </p>
              </div>
            )}
            <div className="progress-indicator">
              {defeatedRound}/3 oponentes derrotados
            </div>
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {gameOver && (
        <div className="victory-modal">
          <div className="victory-backdrop"></div>
          <div className="victory-content">
            {/* Victory/Defeat Icon */}
            <div className="victory-icon">
              {playerHP > 0 ? '👑' : '💀'}
            </div>
            
            {/* Title */}
            <h1 className="victory-title">
              {playerHP > 0 ? '¡VICTORIA ÉPICA!' : '¡DERROTA!'}
            </h1>
            
            {/* Subtitle */}
            <p className="victory-subtitle">
              {playerHP > 0 
                ? '¡Has derrotado a todos los oponentes!' 
                : 'Mejor suerte la próxima vez'}
            </p>
            
            {/* Stats Grid */}
            <div className="victory-stats-grid">
              <div className="victory-stat">
                <div className="stat-number">{score}</div>
                <div className="stat-label">Puntuación Final</div>
              </div>
              <div className="victory-stat">
                <div className="stat-number">{playerHP > 0 ? 3 : round - 1}/3</div>
                <div className="stat-label">Rondas Completadas</div>
              </div>
              <div className="victory-stat">
                <div className="stat-number">{combo}</div>
                <div className="stat-label">Combo Máximo</div>
              </div>
            </div>
            
            
            {/* Action Button */}
            <button className="victory-back-button" onClick={onBack}>
              Volver a Juegos
            </button>
          </div>
        </div>
      )}
      </div>
    </>
  );
};

export default QuizBattle;