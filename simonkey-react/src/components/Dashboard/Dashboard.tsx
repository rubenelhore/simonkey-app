// src/components/Dashboard/Dashboard.jsx (continuación)
import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import './Dashboard.css';

// Componentes internos
import StatsSummary from './StatsSummary';
import RecentActivity from './RecentActivity';
import StudyStreak from './StudyStreak';
import QuickActions from './QuickActions';
import StudyReminder from './StudyReminder';

// Add this interface definition and export
export interface Activity {
  title: any;
  id: string;
  type: string;
  timestamp: any; // or use a more specific Firebase timestamp type
  // Add other properties you need
  notebookId?: string;
  notebookTitle?: string;
  conceptId?: string;
  conceptTitle?: string;
  // Any other fields your activities have
}

interface Stats {
  totalConcepts: number;
  totalNotebooks: number;
  studyTimeMinutes: number;
  masteredConcepts: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalConcepts: 0,
    totalNotebooks: 0,
    studyTimeMinutes: 0,
    masteredConcepts: 0
  });
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!auth.currentUser) return;
      
      try {
        setLoading(true);
        const userId = auth.currentUser.uid;
        
        // Obtener estadísticas
        const notebooksQuery = query(
          collection(db, 'notebooks'),
          where('userId', '==', userId)
        );
        const notebooksSnapshot = await getDocs(notebooksQuery);
        const notebooksCount = notebooksSnapshot.size;
        
        // Obtener conceptos
        const conceptsQuery = query(
          collection(db, 'conceptos'),
          where('usuarioId', '==', userId)
        );
        const conceptsSnapshot = await getDocs(conceptsQuery);
        
        // Contar conceptos
        let conceptsCount = 0;
        let masteredCount = 0;
        
        conceptsSnapshot.docs.forEach(doc => {
          const data = doc.data() as { conceptos?: any[] };
          if (data.conceptos && Array.isArray(data.conceptos)) {
            conceptsCount += data.conceptos.length;
            
            // Contar conceptos dominados (simulado por ahora)
            data.conceptos.forEach(concepto => {
              if (concepto.dominado) {
                masteredCount++;
              }
            });
          }
        });
        
        // Obtener tiempo de estudio (simulado por ahora)
        // En una implementación real, se obtendría de una colección de sesiones de estudio
        const studyTimeMinutes = Math.floor(Math.random() * 300) + 60; // Entre 60-360 minutos
        
        setStats({
          totalConcepts: conceptsCount,
          totalNotebooks: notebooksCount,
          studyTimeMinutes,
          masteredConcepts: masteredCount
        });
        
        // Obtener actividad reciente
        try {
          const activityQuery = query(
            collection(db, 'activity'),
            where('userId', '==', userId),
            orderBy('timestamp', 'desc'),
            limit(5)
          );
          
          const activitySnapshot = await getDocs(activityQuery);
          
          if (!activitySnapshot.empty) {
            const activityData = activitySnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as Activity[];
            setRecentActivity(activityData);
          } else {
            // No recent activities found
            setRecentActivity([]);
          }
        } catch (error) {
          console.error("Error loading dashboard data:", error);
          // Set example data or handle the error appropriately
          setRecentActivity([]);
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Error cargando datos del dashboard:", error);
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>Cargando estadísticas...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h2>Tu Resumen de Estudio</h2>
      </div>
      
      <div className="dashboard-grid">
        <div className="dashboard-main">
          <StatsSummary stats={stats} />
          <RecentActivity activities={recentActivity} />
        </div>
        
        <div className="dashboard-sidebar">
          <StudyStreak />
          <QuickActions />
          <StudyReminder />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;