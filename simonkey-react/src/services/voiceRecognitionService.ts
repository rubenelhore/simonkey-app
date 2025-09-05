// Removed Gemini AI integration - using optimized fallback comparison

export interface VoiceRecognitionResult {
  transcript: string;
  confidence: number;
}

export interface ComparisonResult {
  isCorrect: boolean;
  score: number; // 0-100
  feedback: string;
}

class VoiceRecognitionService {
  private recognition: any = null;
  private isListening = false;

  constructor() {
    if ('webkitSpeechRecognition' in window) {
      this.recognition = new (window as any).webkitSpeechRecognition();
    } else if ('SpeechRecognition' in window) {
      this.recognition = new (window as any).SpeechRecognition();
    }

    if (this.recognition) {
      this.setupRecognition();
    }
  }

  private setupRecognition() {
    if (!this.recognition) return;

    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'es-ES'; // Español
    this.recognition.maxAlternatives = 1;
  }

  isSupported(): boolean {
    return this.recognition !== null;
  }

  startListening(): Promise<VoiceRecognitionResult> {
    return new Promise((resolve, reject) => {
      if (!this.recognition) {
        reject(new Error('Speech recognition no soportado en este navegador'));
        return;
      }

      if (this.isListening) {
        reject(new Error('Ya se está escuchando'));
        return;
      }

      this.isListening = true;

      this.recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        const confidence = event.results[0][0].confidence;
        
        this.isListening = false;
        resolve({
          transcript,
          confidence: confidence || 0.8 // Fallback si no hay confidence
        });
      };

      this.recognition.onerror = (event: any) => {
        this.isListening = false;
        let errorMessage = 'Error en el reconocimiento de voz';
        
        switch (event.error) {
          case 'no-speech':
            errorMessage = 'No se detectó habla';
            break;
          case 'audio-capture':
            errorMessage = 'No se pudo acceder al micrófono';
            break;
          case 'not-allowed':
            errorMessage = 'Permiso de micrófono denegado';
            break;
          case 'network':
            errorMessage = 'Error de conexión';
            break;
          default:
            errorMessage = `Error: ${event.error}`;
        }
        
        reject(new Error(errorMessage));
      };

      this.recognition.onend = () => {
        this.isListening = false;
      };

      try {
        this.recognition.start();
      } catch (error) {
        this.isListening = false;
        reject(error);
      }
    });
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  getIsListening(): boolean {
    return this.isListening;
  }

  async compareWithDefinition(
    concept: string,
    correctDefinition: string,
    userResponse: string
  ): Promise<ComparisonResult> {
    // Using optimized comparison algorithm (no external API calls)
    return this.optimizedComparison(userResponse, correctDefinition);
  }

  // Método de comparación optimizado (anteriormente fallback)
  private optimizedComparison(userResponse: string, correctDefinition: string): ComparisonResult {
    const lowerUser = userResponse.toLowerCase();
    const lowerDefinition = correctDefinition.toLowerCase();
    
    // Extraer palabras clave de la definición (palabras de más de 3 caracteres)
    const definitionWords = lowerDefinition.split(' ')
      .filter(word => word.length > 3)
      .filter(word => !['para', 'como', 'donde', 'cuando', 'esto', 'esta', 'este', 'entre'].includes(word));
    
    // Encontrar palabras que coinciden
    const matchedWords = definitionWords.filter(word => lowerUser.includes(word));
    const matchPercent = definitionWords.length > 0 ? 
      (matchedWords.length / definitionWords.length) * 100 : 0;
    
    // Calcular score basado en coincidencias
    let score = Math.round(matchPercent);
    
    // Bonus por longitud de respuesta similar
    const lengthRatio = Math.min(userResponse.length / correctDefinition.length, 1);
    if (lengthRatio > 0.3) {
      score += 10;
    }
    
    // Limitar score entre 0 y 100
    score = Math.max(0, Math.min(100, score));
    
    const isCorrect = score >= 25;
    
    let feedback = '';
    if (score >= 80) {
      feedback = '¡Excelente! Tu respuesta contiene la mayoría de elementos clave.';
    } else if (score >= 60) {
      feedback = 'Buena respuesta. Contiene elementos importantes de la definición.';
    } else if (score >= 30) {
      feedback = 'Tu respuesta tiene algunos elementos correctos, pero le faltan conceptos clave.';
    } else {
      feedback = 'Tu respuesta no coincide con la definición esperada. Intenta incluir más conceptos clave.';
    }
    
    return {
      isCorrect,
      score,
      feedback
    };
  }

  // Método para obtener permisos de micrófono
  async requestMicrophonePermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Cerrar el stream inmediatamente, solo necesitamos el permiso
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Error al solicitar permisos de micrófono:', error);
      return false;
    }
  }

  // Método para verificar si el micrófono está disponible
  async checkMicrophoneAvailability(): Promise<boolean> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.some(device => device.kind === 'audioinput');
    } catch (error) {
      console.error('Error verificando disponibilidad del micrófono:', error);
      return false;
    }
  }
}

// Crear una instancia global del servicio
export const voiceRecognitionService = new VoiceRecognitionService();

export default VoiceRecognitionService;