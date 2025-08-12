/**
 * Generador de contraseñas seguras para estudiantes
 */

// Palabras base en español para facilitar recordación
const WORD_LISTS = {
  nouns: [
    'Sol', 'Luna', 'Libro', 'Mundo', 'Cielo', 
    'Mar', 'Flor', 'Arbol', 'Nube', 'Estrella',
    'Playa', 'Monte', 'Valle', 'Rio', 'Bosque',
    'Perro', 'Gato', 'Pajaro', 'Pez', 'Leon'
  ],
  adjectives: [
    'Azul', 'Verde', 'Rojo', 'Feliz', 'Grande',
    'Nuevo', 'Alto', 'Dulce', 'Fuerte', 'Rapido'
  ]
};

// Símbolos seguros que no causan problemas en formularios
const SAFE_SYMBOLS = ['!', '@', '#', '$', '*', '+'];

/**
 * Genera una contraseña segura y memorable
 * Formato: [Palabra][Números][Símbolo]
 * Ejemplo: Sol2024! o Luna8745@
 */
export const generateSecurePassword = (): string => {
  // Seleccionar palabra aleatoria
  const word = WORD_LISTS.nouns[Math.floor(Math.random() * WORD_LISTS.nouns.length)];
  
  // Generar número de 4 dígitos
  const numbers = Math.floor(Math.random() * 9000) + 1000;
  
  // Seleccionar símbolo aleatorio
  const symbol = SAFE_SYMBOLS[Math.floor(Math.random() * SAFE_SYMBOLS.length)];
  
  return `${word}${numbers}${symbol}`;
};

/**
 * Genera una contraseña más compleja para administradores
 * Formato: [Adjetivo][Sustantivo][Números][Símbolo]
 * Ejemplo: FelizMundo2024@
 */
export const generateAdminPassword = (): string => {
  const adjective = WORD_LISTS.adjectives[Math.floor(Math.random() * WORD_LISTS.adjectives.length)];
  const noun = WORD_LISTS.nouns[Math.floor(Math.random() * WORD_LISTS.nouns.length)];
  const numbers = Math.floor(Math.random() * 9000) + 1000;
  const symbol = SAFE_SYMBOLS[Math.floor(Math.random() * SAFE_SYMBOLS.length)];
  
  return `${adjective}${noun}${numbers}${symbol}`;
};

/**
 * Valida si una contraseña cumple con los requisitos mínimos
 */
export const validatePassword = (password: string): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('La contraseña debe tener al menos 8 caracteres');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('La contraseña debe contener al menos una mayúscula');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('La contraseña debe contener al menos un número');
  }
  
  if (!/[!@#$*+]/.test(password)) {
    errors.push('La contraseña debe contener al menos un símbolo (!@#$*+)');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Genera un código de recuperación de 6 dígitos
 */
export const generateRecoveryCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};