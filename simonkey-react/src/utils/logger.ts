type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  isDevelopment: boolean;
  isLocalhost: boolean;
  logLevel: LogLevel;
  enableDebugFunctions: boolean;
}

class Logger {
  private config: LoggerConfig;
  private logLevels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor() {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const urlParams = new URLSearchParams(window.location.search);
    const debugMode = urlParams.get('debug') === 'true';
    
    this.config = {
      isDevelopment: import.meta.env.DEV,
      isLocalhost,
      // In production, only show warnings and errors unless debug=true in URL
      logLevel: import.meta.env.PROD && !debugMode ? 'warn' : 'debug',
      enableDebugFunctions: isLocalhost || debugMode,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return this.logLevels[level] >= this.logLevels[this.config.logLevel];
  }

  private formatMessage(prefix: string, message: string): void {
    console.log(`${prefix} ${message}`);
  }

  debug(message: string, data?: any): void {
    if (this.shouldLog('debug')) {
      if (data !== undefined) {
        console.log(`🔍 ${message}`, data);
      } else {
        console.log(`🔍 ${message}`);
      }
    }
  }

  info(message: string, data?: any): void {
    if (this.shouldLog('info')) {
      if (data !== undefined) {
        console.log(`ℹ️ ${message}`, data);
      } else {
        console.log(`ℹ️ ${message}`);
      }
    }
  }

  warn(message: string, data?: any): void {
    if (this.shouldLog('warn')) {
      if (data !== undefined) {
        console.warn(`⚠️ ${message}`, data);
      } else {
        console.warn(`⚠️ ${message}`);
      }
    }
  }

  error(message: string, error?: any): void {
    if (this.shouldLog('error')) {
      if (error !== undefined) {
        console.error(`❌ ${message}`, error);
      } else {
        console.error(`❌ ${message}`);
      }
    }
  }

  // Specific system loggers
  amplitude(message: string, data?: any): void {
    if (this.shouldLog('info')) {
      this.formatMessage('📊 Amplitude:', message);
    }
  }

  auth(message: string, data?: any): void {
    if (this.shouldLog('info')) {
      this.formatMessage('🔐 Auth:', message);
    }
  }

  // Only show debug functions when appropriate
  debugFunctions(message: string): void {
    if (this.config.enableDebugFunctions) {
      console.log(`🛠️ ${message}`);
    }
  }

  // Silent method for suppressing noisy logs
  silent(): boolean {
    return !this.config.enableDebugFunctions;
  }
}

export const logger = new Logger();