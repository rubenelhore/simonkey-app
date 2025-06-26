import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../services/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';

const DaysWithIntelligentStudy: React.FC = () => {
  const [user] = useAuthState(auth);
  const [daysWithIntelligentStudy, setDaysWithIntelligentStudy] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Función para calcular días con estudio inteligente
  const calculateDaysWithIntelligentStudy = async (userId: string): Promise<number> => {
    try {
      // Buscar actividades de estudio inteligente validado en los últimos 365 días
      const activitiesQuery = query(
        collection(db, 'userActivities'),
        where('userId', '==', userId),
        where('type', '==', 'smart_study_validated'),
        orderBy('timestamp', 'desc')
      );
      
      const activitiesSnapshot = await getDocs(activitiesQuery);
      
      // Contar días únicos con estudio inteligente validado
      const uniqueDays = new Set<string>();
      const today = new Date();
      
      activitiesSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.timestamp) {
          const activityDate = data.timestamp.toDate();
          const daysDiff = Math.floor((today.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24));
          
          // Solo contar actividades de los últimos 365 días
          if (daysDiff <= 365) {
            const dateKey = activityDate.toISOString().split('T')[0];
            uniqueDays.add(dateKey);
          }
        }
      });
      
      return uniqueDays.size;
    } catch (error) {
      console.error('Error calculando días con estudio inteligente:', error);
      return 0;
    }
  };

  const fetchDaysWithIntelligentStudy = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const days = await calculateDaysWithIntelligentStudy(user.uid);
      setDaysWithIntelligentStudy(days);
    } catch (error) {
      console.error("Error al calcular días con estudio inteligente:", error);
      setDaysWithIntelligentStudy(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDaysWithIntelligentStudy();
  }, [user]);

  if (loading) {
    return (
      <div className="days-intelligent-study-loading">
        Cargando...
      </div>
    );
  }

  return (
    <div className="days-intelligent-study-tracker">
      <h2># de Estudios inteligentes</h2>
      <div className="days-intelligent-study-counter">
        <span className="days-intelligent-study-icon">🧠</span>
        <span className="days-intelligent-study-days">
          {daysWithIntelligentStudy} {daysWithIntelligentStudy === 1 ? 'estudio' : 'estudios'}
        </span>
      </div>
      <div className="days-intelligent-study-subtitle">
        Sesiones validadas con Mini Quiz (últimos 365 días)
      </div>
    </div>
  );
};

export default DaysWithIntelligentStudy; 