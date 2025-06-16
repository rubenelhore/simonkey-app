import React from 'react';
import { useUserType } from '../hooks/useUserType';
import { UserSubscriptionType } from '../types/interfaces';

export const UserLimitsInfo: React.FC = () => {
  const { 
    userProfile, 
    subscriptionLimits, 
    maxNotebooks, 
    maxConceptsPerNotebook,
    maxNotebooksPerWeek,
    maxConceptsPerWeek,
    isFreeUser,
    isProUser,
    isSchoolUser,
    isSuperAdmin
  } = useUserType();

  if (!userProfile || !subscriptionLimits) {
    return null;
  }

  const getLimitsDescription = () => {
    if (isSuperAdmin) {
      return {
        title: 'Súper Admin',
        description: 'Acceso completo a todas las funcionalidades sin límites',
        limits: [
          { label: 'Cuadernos', value: 'Sin límite' },
          { label: 'Conceptos por cuaderno', value: 'Sin límite' },
          { label: 'Permisos', value: 'Completos' }
        ]
      };
    }

    if (isFreeUser) {
      return {
        title: 'Plan Gratis',
        description: 'Acceso básico con límites para probar la plataforma',
        limits: [
          { label: 'Cuadernos', value: `${userProfile.notebookCount || 0}/${maxNotebooks}` },
          { label: 'Conceptos por cuaderno', value: `${maxConceptsPerNotebook}` },
          { label: 'Recrear cuadernos', value: 'No permitido' }
        ]
      };
    }

    if (isProUser) {
      return {
        title: 'Plan Pro',
        description: 'Acceso completo con límites semanales',
        limits: [
          { label: 'Cuadernos totales', value: 'Sin límite' },
          { label: 'Cuadernos por semana', value: `${userProfile.notebooksCreatedThisWeek || 0}/${maxNotebooksPerWeek}` },
          { label: 'Conceptos por cuaderno', value: `${maxConceptsPerNotebook}` },
          { label: 'Conceptos por semana', value: `${userProfile.conceptsCreatedThisWeek || 0}/${maxConceptsPerWeek}` }
        ]
      };
    }

    if (isSchoolUser) {
      return {
        title: 'Plan Escolar',
        description: 'Acceso completo para instituciones educativas',
        limits: [
          { label: 'Cuadernos', value: 'Sin límite' },
          { label: 'Conceptos por cuaderno', value: 'Sin límite' },
          { label: 'Rol', value: userProfile.schoolRole || 'Estudiante' }
        ]
      };
    }

    return {
      title: 'Plan Desconocido',
      description: 'Tipo de suscripción no reconocido',
      limits: []
    };
  };

  const limitsInfo = getLimitsDescription();

  return (
    <div className="user-limits-info">
      <div className="limits-header">
        <h3>{limitsInfo.title}</h3>
        <p className="limits-description">{limitsInfo.description}</p>
      </div>
      
      <div className="limits-grid">
        {limitsInfo.limits.map((limit, index) => (
          <div key={index} className="limit-item">
            <span className="limit-label">{limit.label}</span>
            <span className="limit-value">{limit.value}</span>
          </div>
        ))}
      </div>

      {isFreeUser && (
        <div className="upgrade-notice">
          <p>¿Necesitas más recursos? Considera actualizar a Pro</p>
          <button className="upgrade-button">
            Ver planes
          </button>
        </div>
      )}
    </div>
  );
};

export default UserLimitsInfo; 