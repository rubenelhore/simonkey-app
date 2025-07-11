import { useState, useEffect } from 'react';
import { auth } from '../services/firebase';
import { gamePointsService } from '../services/gamePointsService';

interface GamePoints {
  totalPoints: number;
  weeklyPoints: number;
  monthlyPoints: number;
  gameScores: {
    memory: number;
    puzzle: number;
    race: number;
    quiz: number;
  };
  achievements: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    unlockedAt: Date;
  }>;
}

export const useGamePoints = () => {
  const [points, setPoints] = useState<GamePoints | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPoints = async () => {
    if (!auth.currentUser) {
      setError('Usuario no autenticado');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const userPoints = await gamePointsService.getUserPoints(auth.currentUser.uid);
      
      setPoints({
        totalPoints: userPoints.totalPoints,
        weeklyPoints: userPoints.weeklyPoints,
        monthlyPoints: userPoints.monthlyPoints,
        gameScores: userPoints.gameScores,
        achievements: userPoints.achievements
      });
      setError(null);
    } catch (err) {
      console.error('Error cargando puntos:', err);
      setError('Error al cargar los puntos');
    } finally {
      setLoading(false);
    }
  };

  const addPoints = async (
    gameId: string, 
    gameName: string, 
    basePoints: number,
    bonusType?: 'perfect' | 'speed' | 'streak' | 'first_try'
  ) => {
    if (!auth.currentUser) {
      setError('Usuario no autenticado');
      return null;
    }

    try {
      const result = await gamePointsService.addGamePoints(
        auth.currentUser.uid, 
        gameId, 
        gameName, 
        basePoints,
        bonusType
      );
      
      // Recargar puntos después de agregar
      await loadPoints();
      
      return result;
    } catch (err) {
      console.error('Error agregando puntos:', err);
      setError('Error al agregar puntos');
      return null;
    }
  };

  const getLeaderboard = async (type: 'total' | 'weekly' | 'monthly' = 'total') => {
    try {
      return await gamePointsService.getLeaderboard(type);
    } catch (err) {
      console.error('Error obteniendo leaderboard:', err);
      return [];
    }
  };

  useEffect(() => {
    loadPoints();
  }, []);

  return {
    points,
    loading,
    error,
    addPoints,
    getLeaderboard,
    refresh: loadPoints
  };
};