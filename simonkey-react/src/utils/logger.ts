type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  isDevelopment: boolean;
  logLevel: LogLevel;
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
    this.config = {
      isDevelopment: import.meta.env.DEV,
      logLevel: (import.meta.env.VITE_LOG_LEVEL as LogLevel) || 'info',
    };
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.config.isDevelopment) return level === 'error';
    return this.logLevels[level] >= this.logLevels[this.config.logLevel];
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  debug(message: string, data?: any): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message), data || '');
    }
  }

  info(message: string, data?: any): void {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message), data || '');
    }
  }

  warn(message: string, data?: any): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message), data || '');
    }
  }

  error(message: string, error?: any): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message), error || '');
    }
  }
}

export const logger = new Logger();