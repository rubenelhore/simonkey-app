import React from 'react';
import { useUserType } from '../hooks/useUserType';
import '../styles/UserLimitsInfo.css';

const UserLimitsInfo: React.FC = () => {
  const { userProfile, subscription } = useUserType();

  if (!userProfile) {
    return null;
  }

  const {
    notebookCount = 0,
    maxNotebooks = 'N/A'
  } = userProfile;
  
  const isFreeUser = subscription === 'free';
  const isProUser = subscription === 'pro';

  return (
    <div className="user-limits-info">
      <h4>Límites de tu cuenta</h4>
      <div className="limits-grid">
        <div className="limit-item">
          <span className="limit-label">Cuadernos creados:</span>
          <span className="limit-value">{notebookCount} / {maxNotebooks === -1 ? 'Ilimitados' : maxNotebooks}</span>
        </div>
        
        {isFreeUser && (
          <div className="limit-item">
            <p>Los usuarios gratuitos tienen límites en la creación de cuadernos.</p>
          </div>
        )}
        
        {isProUser && (
          <>
            {/* Si necesitas mostrar límites semanales, deberás obtenerlos de otra forma */}
          </>
        )}
      </div>
    </div>
  );
};

export default UserLimitsInfo; 