import React from 'react';
import './JoinSimonkeyBanner.css';

const JoinSimonkeyBannerInline: React.FC = () => {
  return (
    <div className="join-simonkey-container">
      <div className="join-simonkey-content">
        <div className="join-simonkey-inner">
          <div className="join-simonkey-header">
            <span className="header-text">Únete a Simonkey</span>
            <span className="header-arrow">→</span>
            <span className="header-highlight">cambia tu futuro</span>
          </div>
          <div className="join-simonkey-features">
            <div className="feature-item">Estudia a tu ritmo</div>
            <span className="feature-separator">|</span>
            <div className="feature-item">Convierte el repaso en hábito</div>
            <span className="feature-separator">|</span>
            <div className="feature-item">Desbloquea tu potencial</div>
            <span className="feature-separator">|</span>
            <div className="feature-item">Aprende y disfruta el proceso</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JoinSimonkeyBannerInline;