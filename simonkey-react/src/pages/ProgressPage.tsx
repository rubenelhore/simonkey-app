// src/pages/ProgressPage.tsx
import React from 'react';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import '../styles/ProgressPage.css';

const ProgressPage: React.FC = () => {
  return (
    <>
      <HeaderWithHamburger title="Progreso" />
      <div className="progress-layout">
        <div className="progress-modules-row">
          <div className="progress-module-col">
            <div className="progress-module">Módulo 1</div>
            <div className="progress-side-module">Módulo Lateral</div>
          </div>
          <div className="progress-modules-right">
            <div className="progress-modules-right-row">
              <div className="progress-module">Módulo 2</div>
              <div className="progress-module">Módulo 3</div>
              <div className="progress-module">Módulo 4</div>
            </div>
            <div className="progress-bottom-module">Módulo Inferior</div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProgressPage;