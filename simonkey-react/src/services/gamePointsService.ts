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
  arrayUnion
} from 'firebase/firestore';
import { db } from './firebase';

interface GamePointsData {
  userId: string;
  totalPoints: number;
  weeklyPoints: number;
  monthlyPoints: number;
  lastWeekReset: Date;
  lastMonthReset: Date;
  gameScores: {
    memory: number;
    puzzle: number;
    race: number;
    quiz: number;
  };
  pointsHistory: PointTransaction[];
  achievements: Achievement[];
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
   * Obtiene o crea los datos de puntos para un usuario
   */
  async getUserPoints(userId: string): Promise<GamePointsData> {
    try {
      const pointsDocRef = doc(db, 'gamePoints', userId);
      const pointsDoc = await getDoc(pointsDocRef);
      
      if (!pointsDoc.exists()) {
        // Crear documento inicial
        const initialData: GamePointsData = {
          userId,
          totalPoints: 0,
          weeklyPoints: 0,
          monthlyPoints: 0,
          lastWeekReset: new Date(),
          lastMonthReset: new Date(),
          gameScores: {
            memory: 0,
            puzzle: 0,
            race: 0,
            quiz: 0
          },
          pointsHistory: [],
          achievements: []
        };
        
        await setDoc(pointsDocRef, {
          ...initialData,
          lastWeekReset: Timestamp.fromDate(initialData.lastWeekReset),
          lastMonthReset: Timestamp.fromDate(initialData.lastMonthReset),
          pointsHistory: [],
          achievements: []
        });
        
        return initialData;
      }
      
      const data = pointsDoc.data();
      
      // Verificar si necesita reset semanal o mensual
      const userPoints: GamePointsData = {
        ...data,
        lastWeekReset: data.lastWeekReset.toDate(),
        lastMonthReset: data.lastMonthReset.toDate(),
        pointsHistory: (data.pointsHistory || []).map((t: any) => ({
          ...t,
          timestamp: t.timestamp.toDate()
        })),
        achievements: (data.achievements || []).map((a: any) => ({
          ...a,
          unlockedAt: a.unlockedAt.toDate()
        }))
      } as GamePointsData;
      
      // Resetear puntos semanales/mensuales si es necesario
      const now = new Date();
      const weeksSinceReset = Math.floor((now.getTime() - userPoints.lastWeekReset.getTime()) / (7 * 24 * 60 * 60 * 1000));
      const monthsSinceReset = Math.floor((now.getTime() - userPoints.lastMonthReset.getTime()) / (30 * 24 * 60 * 60 * 1000));
      
      if (weeksSinceReset > 0 || monthsSinceReset > 0) {
        await this.resetPeriodPoints(userId, weeksSinceReset > 0, monthsSinceReset > 0);
        return this.getUserPoints(userId);
      }
      
      return userPoints;
    } catch (error) {
      console.error('Error obteniendo puntos:', error);
      throw error;
    }
  }

  /**
   * Agrega puntos por completar un juego
   */
  async addGamePoints(
    userId: string, 
    gameId: string, 
    gameName: string, 
    basePoints: number,
    bonusType?: 'perfect' | 'speed' | 'streak' | 'first_try'
  ): Promise<{ totalPoints: number; newAchievements: Achievement[] }> {
    try {
      const userPoints = await this.getUserPoints(userId);
      
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
        bonusType
      };
      
      // Actualizar puntos del juego específico
      const gameScores = { ...userPoints.gameScores };
      if (gameId in gameScores) {
        gameScores[gameId as keyof typeof gameScores] += finalPoints;
      }
      
      // Verificar logros
      const newAchievements = await this.checkAchievements(userId, userPoints, finalPoints, gameId);
      
      // Actualizar documento
      const pointsDocRef = doc(db, 'gamePoints', userId);
      await updateDoc(pointsDocRef, {
        totalPoints: increment(finalPoints),
        weeklyPoints: increment(finalPoints),
        monthlyPoints: increment(finalPoints),
        gameScores,
        pointsHistory: arrayUnion({
          ...transaction,
          timestamp: Timestamp.fromDate(transaction.timestamp)
        }),
        ...(newAchievements.length > 0 && {
          achievements: arrayUnion(...newAchievements.map(a => ({
            ...a,
            unlockedAt: Timestamp.fromDate(a.unlockedAt)
          })))
        })
      });
      
      // Limpiar historial si es muy largo
      if (userPoints.pointsHistory.length > 100) {
        await this.cleanupHistory(userId);
      }
      
      return {
        totalPoints: userPoints.totalPoints + finalPoints,
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
    userPoints: GamePointsData, 
    newPoints: number,
    gameId: string
  ): Promise<Achievement[]> {
    const newAchievements: Achievement[] = [];
    const unlockedIds = new Set(userPoints.achievements.map(a => a.id));
    
    // Primer juego
    if (!unlockedIds.has('FIRST_GAME') && userPoints.pointsHistory.length === 0) {
      newAchievements.push({
        id: 'FIRST_GAME',
        ...this.ACHIEVEMENTS.FIRST_GAME,
        unlockedAt: new Date()
      });
    }
    
    // 1000 puntos
    if (!unlockedIds.has('POINTS_1000') && userPoints.totalPoints + newPoints >= 1000) {
      newAchievements.push({
        id: 'POINTS_1000',
        ...this.ACHIEVEMENTS.POINTS_1000,
        unlockedAt: new Date()
      });
    }
    
    // Todos los juegos
    const gamesPlayed = new Set(userPoints.pointsHistory.map(t => t.gameId));
    gamesPlayed.add(gameId);
    if (!unlockedIds.has('ALL_GAMES') && gamesPlayed.size >= 4) {
      newAchievements.push({
        id: 'ALL_GAMES',
        ...this.ACHIEVEMENTS.ALL_GAMES,
        unlockedAt: new Date()
      });
    }
    
    // Agregar puntos por logros
    for (const achievement of newAchievements) {
      await updateDoc(doc(db, 'gamePoints', userId), {
        totalPoints: increment(achievement.points),
        weeklyPoints: increment(achievement.points),
        monthlyPoints: increment(achievement.points)
      });
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
  private async resetPeriodPoints(userId: string, resetWeekly: boolean, resetMonthly: boolean) {
    const updates: any = {};
    
    if (resetWeekly) {
      updates.weeklyPoints = 0;
      updates.lastWeekReset = Timestamp.fromDate(new Date());
    }
    
    if (resetMonthly) {
      updates.monthlyPoints = 0;
      updates.lastMonthReset = Timestamp.fromDate(new Date());
    }
    
    await updateDoc(doc(db, 'gamePoints', userId), updates);
  }

  /**
   * Limpia el historial manteniendo solo las últimas transacciones
   */
  private async cleanupHistory(userId: string) {
    try {
      const pointsDocRef = doc(db, 'gamePoints', userId);
      const pointsDoc = await getDoc(pointsDocRef);
      const data = pointsDoc.data() as any;
      
      // Mantener solo las últimas 100 transacciones
      const sortedHistory = data.pointsHistory
        .sort((a: any, b: any) => b.timestamp.toMillis() - a.timestamp.toMillis())
        .slice(0, 100);
      
      await updateDoc(pointsDocRef, {
        pointsHistory: sortedHistory
      });
    } catch (error) {
      console.error('Error limpiando historial:', error);
    }
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const gamePointsService = new GamePointsService();