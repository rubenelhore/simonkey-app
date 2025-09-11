import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  increment,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  Timestamp,
  arrayUnion,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';

interface NotebookGamePoints {
  notebookId: string;
  totalPoints: number;
  weeklyPoints: number;
  monthlyPoints: number;
  lastWeekReset: Date;
  lastMonthReset: Date;
  gameScores: {
    memory: number;
    puzzle: number;
    quiz: number;
    fillBlank: number;
  };
  pointsHistory: PointTransaction[];
  achievements: Achievement[];
}

interface GamePointsData {
  userId: string;
  notebookPoints: { [notebookId: string]: NotebookGamePoints };
}

interface PointTransaction {
  id: string;
  timestamp: Date;
  gameId: string;
  gameName: string;
  points: number;
  description: string;
  bonusType?: 'perfect' | 'speed' | 'streak' | 'first_try';
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  unlockedAt: Date;
  points: number;
  icon: string;
}

class GamePointsService {
  private readonly ACHIEVEMENTS = {
    FIRST_GAME: { name: 'Primer Juego', description: 'Completa tu primer juego', points: 50, icon: '🎮' },
    PERFECT_SCORE: { name: 'Puntuación Perfecta', description: 'Obtén una puntuación perfecta', points: 100, icon: '⭐' },
    SPEED_DEMON: { name: 'Velocidad Extrema', description: 'Completa un juego en menos de 30 segundos', points: 75, icon: '⚡' },
    WEEK_STREAK: { name: 'Racha Semanal', description: 'Juega todos los días durante una semana', points: 200, icon: '🔥' },
    POINTS_1000: { name: 'Coleccionista', description: 'Acumula 1000 puntos', points: 150, icon: '💎' },
    ALL_GAMES: { name: 'Explorador', description: 'Juega todos los tipos de juegos', points: 100, icon: '🌟' }
  };

  /**
   * Obtiene o crea los datos de puntos para un cuaderno específico
   */
  async getNotebookPoints(userId: string, notebookId: string): Promise<NotebookGamePoints> {
    try {
      const pointsDocRef = doc(db, 'gamePoints', userId);
      const pointsDoc = await getDoc(pointsDocRef);
      
      if (!pointsDoc.exists()) {
        // Si no existe el documento, retornar datos vacíos sin intentar crear
        // (puede ser un profesor consultando datos de estudiantes)
        console.log('No game points document found, returning empty data');
        const notebookData: NotebookGamePoints = {
          notebookId,
          totalPoints: 0,
          weeklyPoints: 0,
          monthlyPoints: 0,
          lastWeekReset: new Date(),
          lastMonthReset: new Date(),
          gameScores: {
            memory: 0,
            puzzle: 0,
            quiz: 0,
            fillBlank: 0
          },
          pointsHistory: [],
          achievements: []
        };
        return notebookData;
      }
      
      const userData = pointsDoc.data() as GamePointsData;
      
      // Verificar si existe información para este cuaderno
      if (!userData.notebookPoints || !userData.notebookPoints[notebookId]) {
        // Si no hay datos para este cuaderno, retornar vacío sin crear
        const notebookData: NotebookGamePoints = {
          notebookId,
          totalPoints: 0,
          weeklyPoints: 0,
          monthlyPoints: 0,
          lastWeekReset: new Date(),
          lastMonthReset: new Date(),
          gameScores: {
            memory: 0,
            puzzle: 0,
            quiz: 0,
            fillBlank: 0
          },
          pointsHistory: [],
          achievements: []
        };
        
        return notebookData;
      }
      
      const notebookData = userData.notebookPoints[notebookId] as any;
      
      // Convertir timestamps
      const notebookPoints: NotebookGamePoints = {
        ...notebookData,
        // Asegurar que gameScores existe con valores por defecto
        gameScores: {
          memory: notebookData.gameScores?.memory || 0,
          puzzle: notebookData.gameScores?.puzzle || 0,
          quiz: notebookData.gameScores?.quiz || 0,
          fillBlank: notebookData.gameScores?.fillBlank || 0
        },
        lastWeekReset: notebookData.lastWeekReset instanceof Date 
          ? notebookData.lastWeekReset 
          : notebookData.lastWeekReset.toDate(),
        lastMonthReset: notebookData.lastMonthReset instanceof Date 
          ? notebookData.lastMonthReset 
          : notebookData.lastMonthReset.toDate(),
        pointsHistory: (notebookData.pointsHistory || []).map((t: any) => ({
          ...t,
          timestamp: t.timestamp instanceof Date 
            ? t.timestamp 
            : t.timestamp.toDate()
        })),
        achievements: (notebookData.achievements || []).map((a: any) => ({
          ...a,
          unlockedAt: a.unlockedAt instanceof Date 
            ? a.unlockedAt 
            : a.unlockedAt.toDate()
        }))
      };
      
      // Migrar puntos existentes desde el historial si gameScores estaba vacío
      if (!notebookData.gameScores && notebookPoints.pointsHistory.length > 0) {
        const migratedScores = {
          memory: 0,
          puzzle: 0,
          quiz: 0,
          fillBlank: 0
        };
        
        // Calcular puntos por tipo de juego desde el historial
        notebookPoints.pointsHistory.forEach(transaction => {
          const gameType = transaction.gameId.split('_')[0];
          
          // También verificar por nombre de juego para compatibilidad
          let mappedType = gameType;
          if (transaction.gameName === 'Puzzle de Definiciones' || transaction.gameName === 'Puzzle Game') {
            mappedType = 'puzzle';
          } else if (transaction.gameName === 'Memorama' || transaction.gameName === 'Memory Game') {
            mappedType = 'memory';
          } else if (transaction.gameName === 'Quiz Battle') {
            mappedType = 'quiz';
          } else if (transaction.gameName === 'Fill in the Blank' || gameType === 'fill') {
            mappedType = 'fillBlank';
          }
          // Nota: Carrera de Conceptos removido - ya no se cuenta
          
          if (mappedType in migratedScores) {
            migratedScores[mappedType as keyof typeof migratedScores] += transaction.points;
          }
        });
        
        notebookPoints.gameScores = migratedScores;
        
        // Intentar actualizar en Firebase (puede fallar si es un profesor consultando)
        try {
          const pointsDocRef = doc(db, 'gamePoints', userId);
          await updateDoc(pointsDocRef, {
            [`notebookPoints.${notebookId}.gameScores`]: migratedScores
          });
          console.log(`[GamePointsService] Migrated game scores for notebook ${notebookId}:`, migratedScores);
        } catch (error) {
          console.log('Could not update game scores - read-only access');
        }
      }
      
      // Resetear puntos semanales/mensuales si es necesario
      const now = new Date();
      const weeksSinceReset = Math.floor((now.getTime() - notebookPoints.lastWeekReset.getTime()) / (7 * 24 * 60 * 60 * 1000));
      const monthsSinceReset = Math.floor((now.getTime() - notebookPoints.lastMonthReset.getTime()) / (30 * 24 * 60 * 60 * 1000));
      
      if (weeksSinceReset > 0 || monthsSinceReset > 0) {
        try {
          await this.resetPeriodPoints(userId, notebookId, weeksSinceReset > 0, monthsSinceReset > 0);
          return this.getNotebookPoints(userId, notebookId);
        } catch (error) {
          console.log('Could not reset period points - read-only access');
        }
      }
      
      return notebookPoints;
    } catch (error) {
      console.error('Error obteniendo puntos:', error);
      // Si es error de permisos, devolver datos vacíos en lugar de lanzar error
      if (error instanceof Error && error.message.includes('permission')) {
        console.log('Permission error detected - returning empty notebook data for read-only access');
        return {
          notebookId,
          totalPoints: 0,
          weeklyPoints: 0,
          monthlyPoints: 0,
          lastWeekReset: new Date(),
          lastMonthReset: new Date(),
          gameScores: {
            memory: 0,
            puzzle: 0,
            quiz: 0,
            fillBlank: 0
          },
          pointsHistory: [],
          achievements: []
        };
      }
      throw error;
    }
  }

  /**
   * Agrega puntos por completar un juego
   */
  async addGamePoints(
    userId: string, 
    notebookId: string,
    gameId: string, 
    gameName: string, 
    basePoints: number,
    bonusType?: 'perfect' | 'speed' | 'streak' | 'first_try'
  ): Promise<{ totalPoints: number; newAchievements: Achievement[] }> {
    try {
      console.log(`[GamePointsService] addGamePoints llamado con:`, { userId, notebookId, gameId, gameName, basePoints, bonusType });
      const notebookPoints = await this.getNotebookPoints(userId, notebookId);
      
      // Calcular puntos con bonus
      let finalPoints = basePoints;
      let description = `${gameName} completado`;
      
      if (bonusType) {
        switch (bonusType) {
          case 'perfect':
            finalPoints = Math.round(basePoints * 1.5);
            description += ' - ¡Puntuación perfecta!';
            break;
          case 'speed':
            finalPoints = Math.round(basePoints * 1.3);
            description += ' - ¡Bonus de velocidad!';
            break;
          case 'streak':
            finalPoints = Math.round(basePoints * 1.2);
            description += ' - ¡Bonus de racha!';
            break;
          case 'first_try':
            finalPoints = Math.round(basePoints * 1.1);
            description += ' - ¡Al primer intento!';
            break;
        }
      }
      
      const transaction: PointTransaction = {
        id: this.generateId(),
        timestamp: new Date(),
        gameId,
        gameName,
        points: finalPoints,
        description,
        ...(bonusType && { bonusType })
      };
      
      // Actualizar puntos del juego específico
      const gameScores = { ...notebookPoints.gameScores };
      // Extraer el tipo de juego del gameId (ej: 'memory' de 'memory_abc123')
      const gameType = gameId.split('_')[0];
      
      console.log(`[GamePointsService] Saving points - gameId: ${gameId}, gameType: ${gameType}, points: ${finalPoints}`);
      console.log(`[GamePointsService] Current gameScores before update:`, gameScores);
      
      if (gameType in gameScores) {
        gameScores[gameType as keyof typeof gameScores] += finalPoints;
        console.log(`[GamePointsService] Updated gameScores after adding ${finalPoints} to ${gameType}:`, gameScores);
      } else {
        console.warn(`[GamePointsService] Game type '${gameType}' not found in gameScores:`, gameScores);
      }
      
      // Verificar logros
      const newAchievements = await this.checkAchievements(userId, notebookId, notebookPoints, finalPoints, gameId);
      
      // Actualizar documento (crear si no existe)
      const pointsDocRef = doc(db, 'gamePoints', userId);
      
      try {
        await updateDoc(pointsDocRef, {
          [`notebookPoints.${notebookId}.totalPoints`]: increment(finalPoints),
          [`notebookPoints.${notebookId}.weeklyPoints`]: increment(finalPoints),
          [`notebookPoints.${notebookId}.monthlyPoints`]: increment(finalPoints),
          [`notebookPoints.${notebookId}.gameScores`]: gameScores,
          [`notebookPoints.${notebookId}.pointsHistory`]: arrayUnion({
            ...transaction,
            timestamp: Timestamp.fromDate(transaction.timestamp)
          }),
          ...(newAchievements.length > 0 && {
            [`notebookPoints.${notebookId}.achievements`]: arrayUnion(...newAchievements.map(a => ({
              ...a,
              unlockedAt: Timestamp.fromDate(a.unlockedAt)
            })))
          })
        });
      } catch (error: any) {
        // Si el documento no existe, crearlo
        if (error.code === 'not-found') {
          console.log(`[GamePointsService] Creating new document for user ${userId}`);
          
          // Calcular puntos totales incluyendo achievements
          const achievementPoints = newAchievements.reduce((sum, achievement) => sum + achievement.points, 0);
          const totalPointsWithAchievements = finalPoints + achievementPoints;
          
          const newNotebookData: NotebookGamePoints = {
            notebookId,
            totalPoints: totalPointsWithAchievements,
            weeklyPoints: totalPointsWithAchievements,
            monthlyPoints: totalPointsWithAchievements,
            lastWeekReset: new Date(),
            lastMonthReset: new Date(),
            gameScores,
            pointsHistory: [transaction],
            achievements: newAchievements
          };
          
          const userData: GamePointsData = {
            userId,
            notebookPoints: {
              [notebookId]: {
                ...newNotebookData,
                lastWeekReset: Timestamp.fromDate(newNotebookData.lastWeekReset),
                lastMonthReset: Timestamp.fromDate(newNotebookData.lastMonthReset),
                pointsHistory: newNotebookData.pointsHistory.map(t => ({
                  ...t,
                  timestamp: Timestamp.fromDate(t.timestamp)
                })),
                achievements: newNotebookData.achievements.map(a => ({
                  ...a,
                  unlockedAt: Timestamp.fromDate(a.unlockedAt)
                }))
              } as any
            }
          };
          
          await setDoc(pointsDocRef, userData);
          console.log(`[GamePointsService] New document created for user ${userId}`);
        } else {
          throw error;
        }
      }
      
      console.log(`[GamePointsService] Puntos actualizados correctamente para cuaderno ${notebookId}`);
      
      // Limpiar historial si es muy largo
      if (notebookPoints.pointsHistory.length > 100) {
        await this.cleanupHistory(userId, notebookId);
      }
      
      // Crear sesión de juego para que cuente en la racha
      try {
        const gameSessionRef = doc(collection(db, 'gameSessions'));
        const sessionTimestamp = new Date();
        await setDoc(gameSessionRef, {
          userId,
          notebookId,
          gameId,
          gameName,
          timestamp: Timestamp.fromDate(sessionTimestamp),
          duration: 60, // Duración estimada en segundos
          points: finalPoints,
          completed: true,
          ...(bonusType && { bonusType })
        });
        console.log('[GamePointsService] Sesión de juego creada para racha con timestamp:', sessionTimestamp.toISOString());
        
        // Disparar evento para actualizar la racha inmediatamente
        window.dispatchEvent(new CustomEvent('gameCompleted', { 
          detail: { 
            userId, 
            gameName, 
            points: finalPoints,
            timestamp: sessionTimestamp
          } 
        }));
      } catch (sessionError) {
        console.error('[GamePointsService] Error creando sesión de juego:', sessionError);
        // No lanzar error, continuar aunque falle la sesión
      }
      
      const achievementPoints = newAchievements.reduce((sum, achievement) => sum + achievement.points, 0);
      return {
        totalPoints: notebookPoints.totalPoints + finalPoints + achievementPoints,
        newAchievements
      };
    } catch (error) {
      console.error('Error agregando puntos:', error);
      throw error;
    }
  }

  /**
   * Verifica y desbloquea logros
   */
  private async checkAchievements(
    userId: string, 
    notebookId: string,
    notebookPoints: NotebookGamePoints, 
    newPoints: number,
    gameId: string
  ): Promise<Achievement[]> {
    const newAchievements: Achievement[] = [];
    const unlockedIds = new Set(notebookPoints.achievements.map(a => a.id));
    
    // Primer juego
    if (!unlockedIds.has('FIRST_GAME') && notebookPoints.pointsHistory.length === 0) {
      newAchievements.push({
        id: 'FIRST_GAME',
        ...this.ACHIEVEMENTS.FIRST_GAME,
        unlockedAt: new Date()
      });
    }
    
    // 1000 puntos
    if (!unlockedIds.has('POINTS_1000') && notebookPoints.totalPoints + newPoints >= 1000) {
      newAchievements.push({
        id: 'POINTS_1000',
        ...this.ACHIEVEMENTS.POINTS_1000,
        unlockedAt: new Date()
      });
    }
    
    // Todos los juegos
    const gamesPlayed = new Set(notebookPoints.pointsHistory.map(t => t.gameId));
    gamesPlayed.add(gameId);
    if (!unlockedIds.has('ALL_GAMES') && gamesPlayed.size >= 4) {
      newAchievements.push({
        id: 'ALL_GAMES',
        ...this.ACHIEVEMENTS.ALL_GAMES,
        unlockedAt: new Date()
      });
    }
    
    // Agregar puntos por logros (solo si el documento ya existe)
    if (newAchievements.length > 0) {
      try {
        const pointsDocRef = doc(db, 'gamePoints', userId);
        const pointsDoc = await getDoc(pointsDocRef);
        
        if (pointsDoc.exists()) {
          for (const achievement of newAchievements) {
            await updateDoc(pointsDocRef, {
              [`notebookPoints.${notebookId}.totalPoints`]: increment(achievement.points),
              [`notebookPoints.${notebookId}.weeklyPoints`]: increment(achievement.points),
              [`notebookPoints.${notebookId}.monthlyPoints`]: increment(achievement.points)
            });
          }
        }
        // Si el documento no existe, los puntos de logros se agregarán cuando se cree el documento
      } catch (error) {
        console.log('[GamePointsService] Could not update achievement points - document may not exist yet');
      }
    }
    
    return newAchievements;
  }

  /**
   * Obtiene el ranking de puntos
   */
  async getLeaderboard(type: 'total' | 'weekly' | 'monthly' = 'total', limitCount: number = 10) {
    try {
      const pointsField = type === 'total' ? 'totalPoints' : 
                         type === 'weekly' ? 'weeklyPoints' : 'monthlyPoints';
      
      const q = query(
        collection(db, 'gamePoints'),
        orderBy(pointsField, 'desc'),
        limit(limitCount)
      );
      
      const snapshot = await getDocs(q);
      const leaderboard = snapshot.docs.map((doc, index) => ({
        rank: index + 1,
        userId: doc.id,
        points: doc.data()[pointsField] || 0,
        ...doc.data()
      }));
      
      return leaderboard;
    } catch (error) {
      console.error('Error obteniendo leaderboard:', error);
      return [];
    }
  }

  /**
   * Resetea puntos semanales/mensuales
   */
  private async resetPeriodPoints(userId: string, notebookId: string, resetWeekly: boolean, resetMonthly: boolean) {
    const updates: any = {};
    
    if (resetWeekly) {
      updates[`notebookPoints.${notebookId}.weeklyPoints`] = 0;
      updates[`notebookPoints.${notebookId}.lastWeekReset`] = Timestamp.fromDate(new Date());
    }
    
    if (resetMonthly) {
      updates[`notebookPoints.${notebookId}.monthlyPoints`] = 0;
      updates[`notebookPoints.${notebookId}.lastMonthReset`] = Timestamp.fromDate(new Date());
    }
    
    await updateDoc(doc(db, 'gamePoints', userId), updates);
  }

  /**
   * Limpia el historial manteniendo solo las últimas transacciones
   */
  private async cleanupHistory(userId: string, notebookId: string) {
    try {
      const pointsDocRef = doc(db, 'gamePoints', userId);
      const pointsDoc = await getDoc(pointsDocRef);
      const data = pointsDoc.data() as GamePointsData;
      const notebookData = data.notebookPoints[notebookId];
      
      // Mantener solo las últimas 100 transacciones
      const sortedHistory = notebookData.pointsHistory
        .sort((a: any, b: any) => b.timestamp.toMillis() - a.timestamp.toMillis())
        .slice(0, 100);
      
      await updateDoc(pointsDocRef, {
        [`notebookPoints.${notebookId}.pointsHistory`]: sortedHistory
      });
    } catch (error) {
      console.error('Error limpiando historial:', error);
    }
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * MIGRACIÓN AUTOMÁTICA: Limpia puntos de juegos eliminados para TODOS los usuarios
   */
  private async cleanupEliminatedGamePoints(userId: string, notebookId: string, notebookPoints: NotebookGamePoints): Promise<void> {
    try {
      // Solo migrar si hay gameScores con juegos eliminados
      const hasRace = notebookPoints.gameScores && 'race' in notebookPoints.gameScores;
      const hasFillBlank = notebookPoints.pointsHistory.some(t => t.gameId.includes('fill_blank'));
      
      if (!hasRace && !hasFillBlank) {
        return; // No necesita migración
      }
      
      console.log(`🔄 [AUTO MIGRATION] Limpiando juegos eliminados para usuario ${userId}, cuaderno ${notebookId}`);
      
      // Recalcular puntos totales basado SOLO en juegos válidos (memory, puzzle, quiz, fillBlank)
      const validGameScores = {
        memory: notebookPoints.gameScores?.memory || 0,
        puzzle: notebookPoints.gameScores?.puzzle || 0,
        quiz: notebookPoints.gameScores?.quiz || 0,
        fillBlank: notebookPoints.gameScores?.fillBlank || 0
      };
      
      const correctTotalPoints = validGameScores.memory + validGameScores.puzzle + validGameScores.quiz + validGameScores.fillBlank;
      
      console.log(`📊 [AUTO MIGRATION] Recalculando puntos:`, {
        memory: validGameScores.memory,
        puzzle: validGameScores.puzzle,
        quiz: validGameScores.quiz,
        oldTotal: notebookPoints.totalPoints,
        newTotal: correctTotalPoints,
        difference: notebookPoints.totalPoints - correctTotalPoints
      });
      
      // Actualizar Firebase automáticamente
      const pointsDocRef = doc(db, 'gamePoints', userId);
      await updateDoc(pointsDocRef, {
        [`notebookPoints.${notebookId}.gameScores`]: validGameScores,
        [`notebookPoints.${notebookId}.totalPoints`]: correctTotalPoints
      });
      
      console.log(`✅ [AUTO MIGRATION] Puntos corregidos automáticamente para cuaderno ${notebookId}`);
      
    } catch (error) {
      console.error(`❌ [AUTO MIGRATION] Error limpiando puntos eliminados:`, error);
      // No lanzar error - continuar aunque falle la migración
    }
  }

  /**
   * Obtiene puntos específicos de un tipo de juego
   */
  async getGameSpecificPoints(userId: string, notebookId: string, gameName: string): Promise<number> {
    try {
      const notebookPoints = await this.getNotebookPoints(userId, notebookId);
      
      // Filtrar transacciones por nombre de juego y sumar puntos
      const gameSpecificPoints = notebookPoints.pointsHistory
        .filter(transaction => transaction.gameName === gameName)
        .reduce((total, transaction) => total + transaction.points, 0);
      
      return gameSpecificPoints;
    } catch (error) {
      console.error(`Error obteniendo puntos específicos de ${gameName}:`, error);
      // Siempre devolver 0 en caso de error (incluyendo permisos)
      return 0;
    }
  }

  /**
   * Debug function to check game points history and force migration
   */
  async debugGamePoints(userId: string, notebookId: string): Promise<void> {
    try {
      const notebookPoints = await this.getNotebookPoints(userId, notebookId);
      
      console.log('📊 [DEBUG] Total points:', notebookPoints.totalPoints);
      console.log('📊 [DEBUG] Current gameScores:', notebookPoints.gameScores);
      console.log('📊 [DEBUG] Points history length:', notebookPoints.pointsHistory.length);
      
      // Mostrar historial detallado
      console.log('📊 [DEBUG] Points history:');
      notebookPoints.pointsHistory.forEach((transaction, index) => {
        console.log(`  ${index + 1}. ${transaction.gameName} (${transaction.gameId}): ${transaction.points} pts - ${transaction.timestamp}`);
      });
      
      // Calcular puntos por juego desde historial
      const calculatedScores = {
        memory: 0,
        puzzle: 0,
        quiz: 0,
        fillBlank: 0
      };
      
      notebookPoints.pointsHistory.forEach(transaction => {
        const gameType = transaction.gameId.split('_')[0];
        
        // También verificar por nombre de juego para compatibilidad
        let mappedType = gameType;
        if (transaction.gameName === 'Puzzle de Definiciones' || transaction.gameName === 'Puzzle Game') {
          mappedType = 'puzzle';
        } else if (transaction.gameName === 'Memorama' || transaction.gameName === 'Memory Game') {
          mappedType = 'memory';
        } else if (transaction.gameName === 'Quiz Battle') {
          mappedType = 'quiz';
        } else if (transaction.gameName === 'Fill in the Blank' || gameType === 'fill') {
          mappedType = 'fillBlank';
        }
        // Nota: Carrera de Conceptos removido - ya no se cuenta
        
        if (mappedType in calculatedScores) {
          calculatedScores[mappedType as keyof typeof calculatedScores] += transaction.points;
        }
      });
      
      console.log('📊 [DEBUG] Calculated scores from history:', calculatedScores);
      
      // Calcular totalPoints correcto basado solo en juegos válidos
      const correctTotalPoints = calculatedScores.memory + calculatedScores.puzzle + calculatedScores.quiz;
      console.log('🔧 [DEBUG] Recalculando totalPoints:');
      console.log('  - Memory:', calculatedScores.memory);
      console.log('  - Puzzle:', calculatedScores.puzzle);
      console.log('  - Quiz:', calculatedScores.quiz);
      console.log('  - Total correcto:', correctTotalPoints);
      console.log('  - Total actual:', notebookPoints.totalPoints);
      console.log('  - Diferencia:', notebookPoints.totalPoints - correctTotalPoints);
      
      // Forzar migración completa: gameScores Y totalPoints
      const pointsDocRef = doc(db, 'gamePoints', userId);
      await updateDoc(pointsDocRef, {
        [`notebookPoints.${notebookId}.gameScores`]: calculatedScores,
        [`notebookPoints.${notebookId}.totalPoints`]: correctTotalPoints
      });
      
      console.log('✅ [DEBUG] Game scores AND totalPoints updated!');
      
    } catch (error) {
      console.error('❌ [DEBUG] Error:', error);
    }
  }
}

export const gamePointsService = new GamePointsService();

// Make debug function available globally
(window as any).debugGamePoints = (userId: string, notebookId: string) => {
  return gamePointsService.debugGamePoints(userId, notebookId);
};

// Función auxiliar para agregar puntos desde los juegos
export async function addPoints(
  gameId: string,
  gameName: string,
  basePoints: number,
  bonusType?: 'perfect' | 'speed' | 'streak' | 'first_try'
): Promise<{ success: boolean; totalPoints?: number; newAchievements?: Achievement[] }> {
  try {
    const { auth } = await import('./firebase');
    if (!auth.currentUser) {
      throw new Error('Usuario no autenticado');
    }

    // Extraer notebookId del gameId (formato: gameType_notebookId)
    const gameIdParts = gameId.split('_');
    if (gameIdParts.length < 2) {
      throw new Error('Formato de gameId inválido');
    }

    const notebookId = gameIdParts.slice(1).join('_');
    const result = await gamePointsService.addGamePoints(
      auth.currentUser.uid,
      notebookId,
      gameId,
      gameName,
      basePoints,
      bonusType
    );

    return {
      success: true,
      totalPoints: result.totalPoints,
      newAchievements: result.newAchievements
    };
  } catch (error) {
    console.error('Error al agregar puntos:', error);
    return { success: false };
  }
}