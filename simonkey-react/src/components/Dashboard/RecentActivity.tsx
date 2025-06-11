// src/components/Dashboard/RecentActivity.tsx
import React from 'react';
// Importar la interfaz Activity desde Dashboard
import { Activity } from '../Dashboard/Dashboard';

interface RecentActivityProps {
  activities: Activity[]; 
}

const RecentActivity = ({ activities }: RecentActivityProps) => {
  // Función para formatear fecha/hora
  const formatTimestamp = (timestamp: { toDate: () => any; }) => {
    if (!timestamp) return '';
    
    const date = timestamp instanceof Date ? timestamp : timestamp.toDate();
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 60) {
      return `hace ${diffMins} ${diffMins === 1 ? 'minuto' : 'minutos'}`;
    } else if (diffHours < 24) {
      return `hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
    } else if (diffDays < 7) {
      return `hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
    } else {
      return date.toLocaleDateString('es-ES', { 
        day: 'numeric', 
        month: 'short'
      });
    }
  };
  
  // Función para obtener ícono según tipo de actividad
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'notebook_created':
        return <i className="fas fa-plus-circle"></i>;
      case 'notebook_shared':
        return <i className="fas fa-share-alt"></i>;
      case 'concept_added':
        return <i className="fas fa-file-alt"></i>;
      case 'concept_studied':
        return <i className="fas fa-brain"></i>;
      case 'concept_mastered':
        return <i className="fas fa-check-circle"></i>;
      default:
        return <i className="fas fa-history"></i>;
    }
  };
  
  // Función para obtener texto según tipo de actividad
  const getActivityText = (activity: Activity) => {
    switch (activity.type) {
      case 'notebook_created':
        return `Creaste un nuevo cuaderno "${activity.title}"`;
      case 'notebook_shared':
        return `Compartiste el cuaderno "${activity.title}"`;
      case 'concept_added':
        return `Añadiste el concepto "${activity.title}"`;
      case 'concept_studied':
        return `Estudiaste el concepto "${activity.title}"`;
      case 'concept_mastered':
        return `¡Dominaste el concepto "${activity.title}"!`;
      default:
        return `Actividad con "${activity.title}"`;
    }
  };
  
  // Función para obtener color según tipo de actividad
  const getActivityColor = (type: string) => {
    switch (type) {
      case 'notebook_created':
        return '#4CAF50';
      case 'notebook_shared':
        return '#2196F3';
      case 'concept_added':
        return '#FF9800';
      case 'concept_studied':
        return '#9C27B0';
      case 'concept_mastered':
        return '#F44336';
      default:
        return '#607D8B';
    }
  };
  
  return (
    <div className="recent-activity">
      <div className="activity-header">
        <h3>Actividad Reciente</h3>
        <button className="see-all-button">Ver todo</button>
      </div>
      
      {activities.length === 0 ? (
        <div className="empty-activity">
          <i className="fas fa-history empty-icon"></i>
          <p>Aún no tienes actividad reciente</p>
          <p className="empty-subtext">¡Crea un cuaderno para comenzar!</p>
        </div>
      ) : (
        <div className="activity-list">
          {activities.map((activity) => (
            <div className="activity-item" key={activity.id}>
              <div 
                className="activity-icon" 
                style={{ backgroundColor: getActivityColor(activity.type) }}
              >
                {getActivityIcon(activity.type)}
              </div>
              <div className="activity-content">
                <div className="activity-text">
                  {getActivityText(activity)}
                </div>
                <div className="activity-time">
                  {formatTimestamp(activity.timestamp)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecentActivity;