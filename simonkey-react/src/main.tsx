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

// Importar función para crear perfiles de usuario faltantes
import './utils/createMissingUserProfile';

// Importar función de depuración de perfil de usuario
import './utils/debugUserProfile';

// Importar función de prueba de Firebase Functions
import './utils/testFirebaseFunction';

// Importar función de verificación de token
import './utils/testAuthToken';

// Importar función de copia a base de datos default
import './utils/copyUserToDefaultDb';

// Importar función de prueba de KPIs
import './utils/testKpiService';

// Importar función de depuración y corrección de cuadernos
import './scripts/debugAndFixNotebooks';

// Importar función de debug del servicio KPI
import './utils/debugKpiService';

// Importar función de verificación de datos de juegos
import './utils/verifyGameData';

// Importar función de test KPI con logs
import './utils/testKpiWithLogs';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);