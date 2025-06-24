import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Importar Firebase primero para asegurar que se inicializa correctamente
import './services/firebase';

import './firebase/config.ts';
import './hooks/useUser.ts';

// Importar script de solución rápida
import './utils/quickFix';

// Importar función de corrección de cuadernos escolares
import './utils/fixMissingAdmin';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);