import { recordUserActivity } from '../services/activityService';
import { trackActivity } from '../hooks/useActivityTracker';
import { diagnoseAuthIssues, fixOrphanUser } from './authDebug';
import { auth, db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';

/**
 * Prueba el sistema de inactividad
 */
export const testInactivitySystem = async () => {
  console.log('🧪 === PRUEBA DEL SISTEMA DE INACTIVIDAD ===');
  
  // Verificar si el usuario está autenticado
  const user = (window as any).firebase?.auth?.currentUser;
  if (!user) {
    console.log('❌ No hay usuario autenticado. Por favor, inicia sesión primero.');
    return;
  }

  console.log('✅ Usuario autenticado:', user.email);
  
  // Verificar el hook de inactividad
  const inactivityHook = (window as any).__inactivityHook;
  if (inactivityHook) {
    console.log('✅ Hook de inactividad encontrado');
    console.log('⏱️ Tiempo restante:', inactivityHook.getTimeRemaining(), 'segundos');
    console.log('🔄 Funciones disponibles:', Object.keys(inactivityHook));
  } else {
    console.log('⚠️ Hook de inactividad no encontrado');
  }

  // Verificar el componente de advertencia
  const warningComponent = document.querySelector('.inactivity-warning-modal');
  if (warningComponent) {
    console.log('✅ Componente de advertencia visible');
  } else {
    console.log('ℹ️ Componente de advertencia no visible (normal si no hay inactividad)');
  }

  // Registrar actividad de prueba
  try {
    await recordUserActivity(user.uid, window.location.pathname, 'test_activity');
    console.log('✅ Actividad registrada correctamente');
  } catch (error) {
    console.error('❌ Error al registrar actividad:', error);
  }

  console.log('📋 === INSTRUCCIONES DE PRUEBA ===');
  console.log('1. No interactúes con la plataforma por 2 minutos');
  console.log('2. Deberías ver la advertencia después de 1 minuto');
  console.log('3. El contador debería mostrar 60 segundos y contar hacia atrás');
  console.log('4. Después de 3 minutos totales, deberías ser desconectado');
  console.log('5. Solo clicks en botones/enlaces y teclas importantes resetean el timer');
  console.log('=====================================');
};

/**
 * Simula actividad de usuario para pruebas
 */
export const simulateUserActivity = async (userId?: string) => {
  const targetUserId = userId || (window as any).firebase?.auth?.currentUser?.uid;
  
  if (!targetUserId) {
    console.log('❌ No se pudo determinar el userId');
    return;
  }

  console.log('🔄 Simulando actividad de usuario...');
  
  try {
    await recordUserActivity(targetUserId, window.location.pathname, 'simulated_activity');
    console.log('✅ Actividad simulada registrada');
    
    // Resetear el timer si está disponible
    const inactivityHook = (window as any).__inactivityHook;
    if (inactivityHook?.resetTimer) {
      inactivityHook.resetTimer();
      console.log('✅ Timer reseteado');
    }
  } catch (error) {
    console.error('❌ Error al simular actividad:', error);
  }
};

// Función para probar el registro manual de actividad
export const testManualActivity = (action: string = 'test_click') => {
  console.log(`🧪 Probando registro manual de actividad: ${action}`);
  trackActivity(action, { test: true, timestamp: new Date().toISOString() });
};

// Función para probar el logout automático
export const testAutoLogout = () => {
  console.log('🧪 === PRUEBA DE LOGOUT AUTOMÁTICO ===');
  
  const inactivityHook = (window as any).__inactivityHook;
  if (!inactivityHook) {
    console.log('❌ Hook de inactividad no encontrado');
    return;
  }

  console.log('🚪 Ejecutando logout automático de prueba...');
  
  // Simular que el countdown llegó a 0
  if (inactivityHook.handleAutoLogout) {
    inactivityHook.handleAutoLogout();
  } else {
    console.log('⚠️ Función handleAutoLogout no disponible');
    console.log('🔄 Funciones disponibles:', Object.keys(inactivityHook));
  }
};

// Función para exponer el hook de inactividad para debugging
export const exposeInactivityHook = (hook: any) => {
  (window as any).__inactivityHook = hook;
  console.log('🔧 Hook de inactividad expuesto para debugging');
  
  // Agregar funciones de prueba al objeto window
  (window as any).testManualActivity = testManualActivity;
  (window as any).trackActivity = trackActivity;
  (window as any).testAutoLogout = testAutoLogout;
  (window as any).diagnoseAuthIssues = diagnoseAuthIssues;
  (window as any).fixOrphanUser = fixOrphanUser;
  
  // Agregar función para verificar estado de inicialización
  (window as any).checkTimerInitialization = () => {
    if (hook.getTimerInitializationStatus) {
      const isInitialized = hook.getTimerInitializationStatus();
      console.log('🔧 Estado de inicialización del timer:', isInitialized);
      return isInitialized;
    } else {
      console.log('❌ Función getTimerInitializationStatus no disponible');
      return false;
    }
  };
};

/**
 * Limpia datos de actividad de prueba
 */
export const cleanTestActivityData = async () => {
  console.log('🧹 Limpiando datos de actividad de prueba...');
  
  try {
    // Esta función requeriría permisos de administrador
    // Por ahora solo muestra un mensaje informativo
    console.log('⚠️ La limpieza de datos requiere permisos de administrador');
    console.log('💡 Para limpiar datos de prueba, usa el panel de super admin');
    
  } catch (error) {
    console.error('❌ Error limpiando datos de prueba:', error);
  }
};

export const diagnoseGracePeriod = () => {
  console.log('🛡️ === DIAGNÓSTICO DEL PERÍODO DE GRACIA ===');
  
  const inactivityHook = (window as any).__inactivityHook;
  if (!inactivityHook) {
    console.log('❌ Hook de inactividad no encontrado');
    return;
  }

  console.log('📊 Estado del período de gracia:');
  console.log('   - Is In Grace Period:', inactivityHook.getGracePeriodStatus());
  console.log('   - Is Timer Initialized:', inactivityHook.getTimerInitializationStatus());
  console.log('   - Is Fully Logged In:', inactivityHook.getLoginStatus());
  console.log('   - Time Remaining:', inactivityHook.getTimeRemaining());
  console.log('   - Last Activity:', inactivityHook.lastActivity);

  // Verificar si el período de gracia está activo
  const isInGracePeriod = inactivityHook.getGracePeriodStatus();
  
  if (isInGracePeriod) {
    console.log('\n⏰ PERÍODO DE GRACIA ACTIVO:');
    console.log('   - El usuario tiene 10 segundos de gracia inicial');
    console.log('   - Durante este tiempo no se mostrarán advertencias');
    console.log('   - Después de 10 segundos comenzará el timer principal');
  } else {
    console.log('\n✅ PERÍODO DE GRACIA COMPLETADO:');
    console.log('   - El período de gracia inicial ya terminó');
    console.log('   - El timer principal está activo');
    console.log('   - Las actividades resetean el timer principal (sin gracia)');
  }

  console.log('\n💡 Comportamiento esperado:');
  console.log('   1. Al iniciar: 10 segundos de gracia inicial');
  console.log('   2. Después de gracia: Timer principal de 3 minutos');
  console.log('   3. Actividades: Solo resetean el timer principal');
  console.log('   4. Advertencia: Se muestra 1 minuto antes del logout');

  console.log('\n🛠️ Comandos disponibles:');
  console.log('   window.diagnoseInfiniteLoop() - Diagnóstico completo');
  console.log('   window.stopInfiniteLoop() - Detener bucle infinito');
  console.log('=====================================');
};

export const verifyInactivitySystem = async () => {
  console.log('🔍 === VERIFICACIÓN DEL SISTEMA DE INACTIVIDAD ===');
  
  const currentUser = auth.currentUser;
  const pathname = window.location.pathname;
  
  console.log('📋 Estado actual:');
  console.log('  - Usuario autenticado:', currentUser ? 'SÍ' : 'NO');
  console.log('  - Email verificado:', currentUser?.emailVerified ? 'SÍ' : 'NO');
  console.log('  - Pathname:', pathname);
  console.log('  - Es página pública:', ['/', '/login', '/signup', '/pricing', '/privacy-policy', '/terms', '/verify-email'].includes(pathname));
  
  // Verificar hook de inactividad
  const inactivityHook = (window as any).__inactivityHook;
  if (inactivityHook) {
    const isInGracePeriod = inactivityHook.getGracePeriodStatus();
    const timeRemaining = inactivityHook.getTimeRemaining();
    const isFullyLoggedIn = inactivityHook.getLoginStatus();
    const isTimerInitialized = inactivityHook.getTimerInitializationStatus ? inactivityHook.getTimerInitializationStatus() : false;
    
    console.log('⏰ Estado del hook:');
    console.log('  - Completamente logueado:', isFullyLoggedIn);
    console.log('  - Timer inicializado:', isTimerInitialized);
    console.log('  - En período de gracia:', isInGracePeriod);
    console.log('  - Tiempo restante:', timeRemaining);
    console.log('  - Funciones disponibles:', Object.keys(inactivityHook));
    
    if (!isFullyLoggedIn) {
      console.log('⏸️ Sistema en espera - Usuario no completamente logueado');
    } else if (!isTimerInitialized) {
      console.log('⏸️ Sistema en espera - Timer no inicializado');
    } else if (isInGracePeriod) {
      console.log('🛡️ Sistema funcionando correctamente - Usuario en período de gracia');
    } else if (timeRemaining > 0) {
      console.log('⚠️ Sistema funcionando correctamente - Advertencia activa');
    } else {
      console.log('✅ Sistema funcionando correctamente - Timer activo');
    }
  } else {
    console.log('❌ Hook de inactividad no encontrado');
  }
  
  // Verificar que no hay errores de permisos
  console.log('🔒 Verificando permisos...');
  try {
    const userDocRef = doc(db, 'users', currentUser?.uid || '');
    const userDoc = await getDoc(userDocRef);
    console.log('✅ Permisos de lectura OK');
    
    if (userDoc.exists()) {
      console.log('✅ Documento de usuario encontrado');
    } else {
      console.log('⚠️ Documento de usuario no encontrado - puede ser normal para usuarios nuevos');
    }
  } catch (error) {
    console.log('❌ Error de permisos:', error);
  }
  
  console.log('=====================================');
};

export const diagnoseTimerState = async () => {
  console.log('🔍 === DIAGNÓSTICO DETALLADO DEL TIMER ===');
  
  const inactivityHook = (window as any).__inactivityHook;
  if (!inactivityHook) {
    console.log('❌ Hook de inactividad no encontrado');
    return;
  }

  const timeRemaining = inactivityHook.getTimeRemaining();
  const isInGracePeriod = inactivityHook.getGracePeriodStatus();
  const isFullyLoggedIn = inactivityHook.getLoginStatus();
  const isTimerInitialized = inactivityHook.getTimerInitializationStatus ? inactivityHook.getTimerInitializationStatus() : false;
  
  console.log('📊 Estado actual del timer:');
  console.log('  - Tiempo restante:', timeRemaining, 'segundos');
  console.log('  - En período de gracia:', isInGracePeriod);
  console.log('  - Completamente logueado:', isFullyLoggedIn);
  console.log('  - Timer inicializado:', isTimerInitialized);
  
  // Verificar si debería mostrar la notificación
  if (timeRemaining > 0) {
    console.log('✅ La notificación debería estar visible');
    console.log(`⏰ Tiempo restante: ${timeRemaining} segundos`);
    
    // Verificar si el componente está renderizado
    const warningComponent = document.querySelector('.inactivity-warning-modal');
    if (warningComponent) {
      console.log('✅ Componente de notificación encontrado en el DOM');
    } else {
      console.log('❌ Componente de notificación NO encontrado en el DOM');
    }
  } else {
    console.log('ℹ️ No hay tiempo restante - no debería mostrar notificación');
  }
  
  // Verificar timers activos
  console.log('⏰ Verificando timers activos...');
  if (inactivityHook.resetTimer) {
    console.log('✅ Función resetTimer disponible');
  }
  if (inactivityHook.handleAutoLogout) {
    console.log('✅ Función handleAutoLogout disponible');
  }
  
  console.log('=====================================');
};

export const testTimerBehavior = async () => {
  console.log('🧪 === PRUEBA COMPLETA DEL COMPORTAMIENTO DEL TIMER ===');
  
  const inactivityHook = (window as any).__inactivityHook;
  if (!inactivityHook) {
    console.log('❌ Hook de inactividad no encontrado');
    return;
  }

  console.log('📋 Simulando comportamiento del timer...');
  
  // Verificar estado inicial
  const initialState = {
    timeRemaining: inactivityHook.getTimeRemaining(),
    isInGracePeriod: inactivityHook.getGracePeriodStatus(),
    isFullyLoggedIn: inactivityHook.getLoginStatus(),
    isTimerInitialized: inactivityHook.getTimerInitializationStatus ? inactivityHook.getTimerInitializationStatus() : false
  };
  
  console.log('📊 Estado inicial:', initialState);
  
  // Simular reset del timer
  console.log('🔄 Reseteando timer...');
  if (inactivityHook.resetTimer) {
    inactivityHook.resetTimer();
    
    // Esperar un momento y verificar cambios
    setTimeout(() => {
      const newState = {
        timeRemaining: inactivityHook.getTimeRemaining(),
        isInGracePeriod: inactivityHook.getGracePeriodStatus(),
        isFullyLoggedIn: inactivityHook.getLoginStatus(),
        isTimerInitialized: inactivityHook.getTimerInitializationStatus ? inactivityHook.getTimerInitializationStatus() : false
      };
      
      console.log('📊 Estado después del reset:', newState);
      
      if (newState.isInGracePeriod) {
        console.log('✅ Período de gracia iniciado correctamente');
        console.log('⏰ Esperando 10 segundos para que termine el período de gracia...');
        
        // Verificar después del período de gracia
        setTimeout(() => {
          const graceEndState = {
            timeRemaining: inactivityHook.getTimeRemaining(),
            isInGracePeriod: inactivityHook.getGracePeriodStatus(),
            isFullyLoggedIn: inactivityHook.getLoginStatus(),
            isTimerInitialized: inactivityHook.getTimerInitializationStatus ? inactivityHook.getTimerInitializationStatus() : false
          };
          
          console.log('📊 Estado después del período de gracia:', graceEndState);
          
          if (!graceEndState.isInGracePeriod) {
            console.log('✅ Período de gracia terminado correctamente');
            console.log('⏰ Timer principal iniciado');
            console.log('💡 La notificación aparecerá en 2 minutos (1 minuto antes del logout)');
          } else {
            console.log('❌ Período de gracia no terminó correctamente');
          }
        }, 11000); // 11 segundos para asegurar que termine
      } else {
        console.log('❌ Período de gracia no se inició correctamente');
      }
    }, 1000);
  } else {
    console.log('❌ Función resetTimer no disponible');
  }
  
  console.log('=====================================');
};

export const monitorGracePeriod = async () => {
  console.log('🔍 === MONITOREO DEL PERÍODO DE GRACIA ===');
  
  const inactivityHook = (window as any).__inactivityHook;
  if (!inactivityHook) {
    console.log('❌ Hook de inactividad no encontrado');
    return;
  }

  console.log('⏰ Iniciando monitoreo del período de gracia...');
  
  // Monitorear cada segundo durante 15 segundos
  let monitorCount = 0;
  const maxMonitors = 15;
  
  const monitorInterval = setInterval(() => {
    monitorCount++;
    const timeRemaining = inactivityHook.getTimeRemaining();
    const isInGracePeriod = inactivityHook.getGracePeriodStatus();
    const isFullyLoggedIn = inactivityHook.getLoginStatus();
    const isTimerInitialized = inactivityHook.getTimerInitializationStatus ? inactivityHook.getTimerInitializationStatus() : false;
    
    console.log(`⏰ [${monitorCount}s] Estado:`, {
      timeRemaining,
      isInGracePeriod,
      isFullyLoggedIn,
      isTimerInitialized
    });
    
    // Si el período de gracia terminó, detener el monitoreo
    if (!isInGracePeriod && monitorCount > 10) {
      console.log('✅ Período de gracia terminado correctamente');
      clearInterval(monitorInterval);
      return;
    }
    
    // Si llegamos al máximo de monitoreo
    if (monitorCount >= maxMonitors) {
      console.log('❌ Período de gracia no terminó después de 15 segundos');
      console.log('🔧 Posibles problemas:');
      console.log('   - El setTimeout del período de gracia no se ejecutó');
      console.log('   - El componente se desmontó antes de completar');
      console.log('   - Hay un error en la lógica del timer');
      clearInterval(monitorInterval);
    }
  }, 1000);
  
  console.log('=====================================');
};

export const createTestTimer = async () => {
  console.log('🧪 === CREANDO TIMER DE PRUEBA SIMPLIFICADO ===');
  
  const inactivityHook = (window as any).__inactivityHook;
  if (!inactivityHook) {
    console.log('❌ Hook de inactividad no encontrado');
    return;
  }

  console.log('⏰ Creando timer de prueba de 30 segundos...');
  
  // Simular un timer simple
  let testTimeRemaining = 30;
  let testGracePeriod = true;
  
  console.log('🛡️ Iniciando período de gracia de prueba (5 segundos)...');
  
  // Período de gracia de 5 segundos
  setTimeout(() => {
    testGracePeriod = false;
    console.log('✅ Período de gracia terminado, iniciando countdown...');
    
    // Countdown de 25 segundos
    const countdownInterval = setInterval(() => {
      testTimeRemaining--;
      console.log(`⏰ Test timer: ${testTimeRemaining} segundos restantes`);
      
      if (testTimeRemaining <= 0) {
        console.log('🕐 Test timer completado');
        clearInterval(countdownInterval);
      }
    }, 1000);
    
  }, 5000);
  
  // Monitorear el estado del test timer
  const monitorInterval = setInterval(() => {
    console.log('📊 Estado del test timer:', {
      testTimeRemaining,
      testGracePeriod,
      realTimeRemaining: inactivityHook.getTimeRemaining(),
      realGracePeriod: inactivityHook.getGracePeriodStatus()
    });
    
    if (testTimeRemaining <= 0) {
      clearInterval(monitorInterval);
    }
  }, 1000);
  
  console.log('=====================================');
};

export const simulateProtectedPage = async () => {
  console.log('🧪 === SIMULANDO PÁGINA PROTEGIDA ===');
  
  const inactivityHook = (window as any).__inactivityHook;
  if (!inactivityHook) {
    console.log('❌ Hook de inactividad no encontrado');
    return;
  }

  console.log('📋 Estado actual:');
  console.log('  - Pathname:', window.location.pathname);
  console.log('  - Es página pública:', ['/', '/login', '/signup', '/pricing', '/privacy-policy', '/terms', '/verify-email'].includes(window.location.pathname));
  
  // Simular estar en una página protegida
  const originalPathname = window.location.pathname;
  const protectedPages = ['/notebooks', '/profile', '/study', '/quiz', '/progress'];
  
  console.log('🔄 Simulando navegación a página protegida...');
  
  // Cambiar temporalmente la URL para simular estar en una página protegida
  const testPage = protectedPages[0];
  const originalPushState = window.history.pushState;
  const originalReplaceState = window.history.replaceState;
  
  // Interceptar pushState y replaceState para simular la navegación
  window.history.pushState = function(data, title, url) {
    console.log('🔄 Simulando pushState:', url);
    return originalPushState.call(this, data, title, url);
  };
  
  window.history.replaceState = function(data, title, url) {
    console.log('🔄 Simulando replaceState:', url);
    return originalReplaceState.call(this, data, title, url);
  };
  
  // Simular estar en /notebooks
  window.history.replaceState(null, '', '/notebooks');
  
  console.log('✅ Simulando estar en página protegida: /notebooks');
  console.log('💡 Ahora ejecuta: window.testTimerBehavior()');
  console.log('💡 O navega manualmente a /notebooks para probar el timer real');
  
  // Restaurar funciones originales después de 30 segundos
  setTimeout(() => {
    window.history.pushState = originalPushState;
    window.history.replaceState = originalReplaceState;
    console.log('🔄 Funciones de navegación restauradas');
  }, 30000);
  
  console.log('=====================================');
};

export const stopInfiniteLoop = async () => {
  console.log('🛑 === DETENIENDO BUCLE INFINITO ===');
  
  const inactivityHook = (window as any).__inactivityHook;
  if (!inactivityHook) {
    console.log('❌ Hook de inactividad no encontrado');
    return;
  }

  console.log('🧹 Limpiando estado del timer...');
  
  // Limpiar estado del timer
  if (inactivityHook.clearState) {
    inactivityHook.clearState();
  }
  
  // Limpiar event listeners manualmente
  const events = ['click', 'submit', 'change', 'focus', 'scroll', 'touchstart', 'keydown'];
  events.forEach(event => {
    document.removeEventListener(event, () => {}, true);
    console.log(`🧹 Event listener removido: ${event}`);
  });
  
  // Pausar el timer
  if (inactivityHook.pauseTimer) {
    inactivityHook.pauseTimer();
  }
  
  console.log('✅ Bucle infinito detenido');
  console.log('💡 Para reactivar el timer, navega a una página protegida');
  console.log('=====================================');
};

export const diagnoseInfiniteLoop = () => {
  console.log('🔍 === DIAGNÓSTICO DE BUCLE INFINITO ===');
  
  const inactivityHook = (window as any).__inactivityHook;
  if (!inactivityHook) {
    console.log('❌ Hook de inactividad no encontrado');
    return;
  }

  console.log('📊 Estado actual del timer:');
  console.log('   - Enabled:', inactivityHook.enabled);
  console.log('   - Is Fully Logged In:', inactivityHook.getLoginStatus());
  console.log('   - Is Timer Initialized:', inactivityHook.getTimerInitializationStatus());
  console.log('   - Is In Grace Period:', inactivityHook.getGracePeriodStatus());
  console.log('   - Time Remaining:', inactivityHook.getTimeRemaining());
  console.log('   - Last Activity:', inactivityHook.lastActivity);

  // Verificar event listeners activos
  console.log('\n🔍 Verificando event listeners...');
  const events = ['click', 'submit', 'change', 'focus', 'scroll', 'touchstart', 'keydown'];
  events.forEach(event => {
    // No podemos verificar directamente si hay listeners, pero podemos intentar removerlos
    console.log(`   - ${event}: listeners activos (no verificable directamente)`);
  });

  // Verificar si estamos en una página que debería tener el timer habilitado
  const currentPath = window.location.pathname;
  const protectedPaths = ['/dashboard', '/profile', '/settings', '/study', '/notebooks'];
  const isProtectedPage = protectedPaths.some(path => currentPath.startsWith(path));
  
  console.log('\n📍 Información de la página:');
  console.log('   - Current Path:', currentPath);
  console.log('   - Is Protected Page:', isProtectedPage);
  console.log('   - Should Timer Be Enabled:', isProtectedPage);

  // Recomendaciones
  console.log('\n💡 Recomendaciones:');
  if (!inactivityHook.getLoginStatus()) {
    console.log('   ❌ Usuario no completamente logueado - Navega a una página protegida');
  }
  if (!inactivityHook.getTimerInitializationStatus()) {
    console.log('   ❌ Timer no inicializado - Espera o navega a página protegida');
  }
  if (!isProtectedPage) {
    console.log('   ❌ No estás en página protegida - El timer está deshabilitado por diseño');
  }
  if (inactivityHook.getGracePeriodStatus()) {
    console.log('   ⏰ En período de gracia - Espera 10 segundos');
  }

  console.log('\n🛠️ Comandos disponibles:');
  console.log('   window.stopInfiniteLoop() - Detener bucle infinito');
  console.log('   window.simulateProtectedPage() - Simular página protegida');
  console.log('=====================================');
};

export const diagnoseTimerAfterGracePeriod = () => {
  console.log('⏰ === DIAGNÓSTICO DEL TIMER DESPUÉS DEL PERÍODO DE GRACIA ===');
  
  const inactivityHook = (window as any).__inactivityHook;
  if (!inactivityHook) {
    console.log('❌ Hook de inactividad no encontrado');
    return;
  }

  console.log('📊 Estado actual del timer:');
  console.log('   - Enabled:', inactivityHook.enabled);
  console.log('   - Is Fully Logged In:', inactivityHook.getLoginStatus());
  console.log('   - Is Timer Initialized:', inactivityHook.getTimerInitializationStatus());
  console.log('   - Is In Grace Period:', inactivityHook.getGracePeriodStatus());
  console.log('   - Time Remaining:', inactivityHook.getTimeRemaining());
  console.log('   - Last Activity:', inactivityHook.lastActivity);

  // Verificar si el período de gracia ya terminó
  const isInGracePeriod = inactivityHook.getGracePeriodStatus();
  const isTimerInitialized = inactivityHook.getTimerInitializationStatus();
  
  if (isInGracePeriod) {
    console.log('\n🛡️ PERÍODO DE GRACIA ACTIVO:');
    console.log('   - El usuario aún está en el período de gracia inicial');
    console.log('   - El timer principal no se ha iniciado');
    console.log('   - Espera 10 segundos para que termine');
  } else if (isTimerInitialized) {
    console.log('\n✅ PERÍODO DE GRACIA COMPLETADO:');
    console.log('   - El período de gracia inicial ya terminó');
    console.log('   - El timer principal debería estar activo');
    console.log('   - Las actividades resetean el timer principal');
    
    // Verificar si hay timers activos
    console.log('\n🔍 Verificando timers activos:');
    console.log('   - timeoutRef.current:', inactivityHook.timeoutRef?.current ? 'Activo' : 'Inactivo');
    console.log('   - warningTimeoutRef.current:', inactivityHook.warningTimeoutRef?.current ? 'Activo' : 'Inactivo');
    console.log('   - gracePeriodRef.current:', inactivityHook.gracePeriodRef?.current ? 'Activo' : 'Inactivo');
  } else {
    console.log('\n❌ TIMER NO INICIALIZADO:');
    console.log('   - El timer no se ha inicializado correctamente');
    console.log('   - Esto puede indicar un problema en la configuración');
  }

  console.log('\n💡 Comportamiento esperado después del período de gracia:');
  console.log('   1. Timer principal de 3 minutos activo');
  console.log('   2. Advertencia a los 2 minutos (1 minuto restante)');
  console.log('   3. Logout automático a los 3 minutos');
  console.log('   4. Actividades resetean el timer principal');

  console.log('\n🛠️ Comandos disponibles:');
  console.log('   window.diagnoseGracePeriod() - Diagnóstico del período de gracia');
  console.log('   window.diagnoseInfiniteLoop() - Diagnóstico completo');
  console.log('   window.stopInfiniteLoop() - Detener bucle infinito');
  console.log('=====================================');
};

export const clearAllEventListeners = () => {
  console.log('🧹 === LIMPIANDO TODOS LOS EVENT LISTENERS ===');
  
  const inactivityHook = (window as any).__inactivityHook;
  if (!inactivityHook) {
    console.log('❌ Hook de inactividad no encontrado');
    return;
  }

  console.log('🛑 Deteniendo todos los timers...');
  
  // Limpiar estado del timer
  if (inactivityHook.clearState) {
    inactivityHook.clearState();
  }
  
  // Limpiar event listeners manualmente
  const events = ['click', 'submit', 'change', 'focus', 'scroll', 'touchstart', 'keydown'];
  events.forEach(event => {
    // Remover todos los event listeners posibles
    document.removeEventListener(event, () => {}, true);
    document.removeEventListener(event, () => {}, false);
    console.log(`🧹 Event listener removido: ${event}`);
  });
  
  // Pausar el timer
  if (inactivityHook.pauseTimer) {
    inactivityHook.pauseTimer();
  }
  
  // Limpiar timers específicos
  if (inactivityHook.timeoutRef?.current) {
    clearTimeout(inactivityHook.timeoutRef.current);
    inactivityHook.timeoutRef.current = null;
    console.log('🧹 Timer principal limpiado');
  }
  
  if (inactivityHook.warningTimeoutRef?.current) {
    clearTimeout(inactivityHook.warningTimeoutRef.current);
    inactivityHook.warningTimeoutRef.current = null;
    console.log('🧹 Timer de advertencia limpiado');
  }
  
  if (inactivityHook.gracePeriodRef?.current) {
    clearTimeout(inactivityHook.gracePeriodRef.current);
    inactivityHook.gracePeriodRef.current = null;
    console.log('🧹 Timer de período de gracia limpiado');
  }
  
  console.log('✅ Todos los event listeners y timers limpiados');
  console.log('💡 Para reactivar el timer, navega a una página protegida');
  console.log('=====================================');
}; 