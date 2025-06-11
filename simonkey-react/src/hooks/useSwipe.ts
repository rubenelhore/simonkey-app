// src/hooks/useSwipe.ts
import { useState, useEffect, useCallback } from 'react';
import { TouchEvent } from 'react';

// Create an interface for the options parameter
interface SwipeOptions {
  threshold?: number;
  timeout?: number;
  // Add any other options your hook might use
}

interface TouchPosition {
  x: number;
  y: number;
}

/**
 * Custom hook para detectar gestos de swipe en dispositivos táctiles
 * @param {SwipeOptions} options - Opciones de configuración
 * @returns {object} - Objeto con funciones de detección y estados de swipe
 */
export function useSwipe(options: SwipeOptions = {}) {
  const { threshold = 50, timeout = 300 } = options;
  
  const [touchStart, setTouchStart] = useState<TouchPosition | null>(null);
  const [touchEnd, setTouchEnd] = useState<TouchPosition | null>(null);
  const [touchStartTime, setTouchStartTime] = useState<number | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<string | null>(null);
  const [swiping, setSwiping] = useState(false);

  // Resetea el estado de swipe
  const resetSwipe = useCallback(() => {
    setTouchStart(null);
    setTouchEnd(null);
    setTouchStartTime(null);
    setSwipeDirection(null);
    setSwiping(false);
  }, []);

  // Detecta la dirección del swipe
  useEffect(() => {
    if (!touchStart || !touchEnd) return;
    
    const timeElapsed = Date.now() - touchStartTime!;
    
    // Si se excedió el tiempo, ignorar el swipe
    if (timeElapsed > timeout) {
      resetSwipe();
      return;
    }
    
    // Calcular distancias
    if (!touchStart || !touchEnd) return;

    const distanceX = touchEnd.x - touchStart.x;
    const distanceY = touchEnd.y - touchStart.y;
    const isHorizontal = Math.abs(distanceX) > Math.abs(distanceY);
    
    // Determinar dirección
    let direction = null;
    
    if (isHorizontal && Math.abs(distanceX) > threshold) {
      direction = distanceX > 0 ? 'right' : 'left';
    } else if (!isHorizontal && Math.abs(distanceY) > threshold) {
      direction = distanceY > 0 ? 'down' : 'up';
    }
    
    setSwipeDirection(direction);
    setSwiping(false);
  }, [touchStart, touchEnd, touchStartTime, threshold, timeout, resetSwipe]);

  // Handlers para eventos táctiles
  const onTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
    setTouchStartTime(Date.now());
    setSwiping(true);
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!touchStart) return;
    const touch = e.touches[0];
    setTouchEnd({ x: touch.clientX, y: touch.clientY });
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (!touchStart || !touchEnd) {
      resetSwipe();
      return;
    }
    
    // El efecto se encargará de determinar la dirección
  };

  // Props para agregar al elemento que recibirá los gestos
  const swipeHandlers = {
    onTouchStart,
    onTouchMove,
    onTouchEnd
  };

  return {
    swipeDirection,
    swiping,
    resetSwipe,
    swipeHandlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd
    }
  };
}