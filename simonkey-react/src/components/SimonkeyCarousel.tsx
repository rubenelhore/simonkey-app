import React, { useState, useEffect, useCallback } from 'react';
import './SimonkeyCarousel.css';

// Interfaces para las propiedades y elementos del carrusel
interface CarouselImage {
  id: number;
  src: string;
  alt: string;
  caption?: string;
}

interface SimonkeyCarouselProps {
  images: CarouselImage[];
  autoPlay?: boolean;
  autoPlayInterval?: number;
  showIndicators?: boolean;
  showArrows?: boolean;
  showCaption?: boolean;
  slidesToShow?: number;
}

const SimonkeyCarousel: React.FC<SimonkeyCarouselProps> = ({
  images,
  autoPlay = true,
  autoPlayInterval = 5000,
  showIndicators = true,
  showArrows = true,
  showCaption = true,
  slidesToShow = 3,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Número máximo de posiciones de desplazamiento
  const maxIndex = 2;

  // Función para navegar al siguiente slide
  const nextSlide = useCallback(() => {
    if (!isTransitioning) {
      setIsTransitioning(true);
      setCurrentIndex((prevIndex) => 
        prevIndex >= maxIndex ? 0 : prevIndex + 1
      );
      setTimeout(() => setIsTransitioning(false), 500);
    }
  }, [isTransitioning, maxIndex]);

  // Función para navegar al slide anterior
  const prevSlide = useCallback(() => {
    if (!isTransitioning) {
      setIsTransitioning(true);
      setCurrentIndex((prevIndex) => 
        prevIndex <= 0 ? maxIndex : prevIndex - 1
      );
      setTimeout(() => setIsTransitioning(false), 500);
    }
  }, [isTransitioning, maxIndex]);

  // Función para ir a un slide específico
  const goToSlide = (index: number) => {
    if (!isTransitioning && index !== currentIndex) {
      setIsTransitioning(true);
      setCurrentIndex(Math.min(index, maxIndex));
      setTimeout(() => setIsTransitioning(false), 500);
    }
  };

  // Efecto para auto-reproducción
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (autoPlay) {
      interval = setInterval(nextSlide, autoPlayInterval);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoPlay, autoPlayInterval, nextSlide]);

  // Manejo de eventos de teclado para accesibilidad
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        prevSlide();
      } else if (e.key === 'ArrowRight') {
        nextSlide();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [nextSlide, prevSlide]);

  return (
    <div className="simonkey-carousel-container">
      <div className="simonkey-carousel">
        <div className="simonkey-carousel-track-container">
          <div 
            className="simonkey-carousel-track" 
            style={{ 
              transform: `translateX(-${currentIndex * (100 / slidesToShow)}%)`,
              width: `${(images.length / slidesToShow) * 100}%`
            }}
          >
            {images.map((image) => (
              <div 
                key={image.id} 
                className="simonkey-carousel-slide"
                style={{ width: `${100 / images.length * slidesToShow}%` }}
              >
                <div className="simonkey-carousel-slide-inner">
                  <img src={image.src} alt={image.alt} className="simonkey-carousel-image" />
                  {showCaption && image.caption && (
                    <div className="simonkey-carousel-caption">
                      <p>{image.caption}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {showArrows && (
          <>
            <button 
              className="simonkey-carousel-control simonkey-carousel-prev" 
              onClick={prevSlide}
              aria-label="Slide anterior"
            >
              &lt;
            </button>
            <button 
              className="simonkey-carousel-control simonkey-carousel-next" 
              onClick={nextSlide}
              aria-label="Slide siguiente"
            >
              &gt;
            </button>
          </>
        )}
        
        {showIndicators && images.length > slidesToShow && (
          <div className="simonkey-carousel-indicators">
            {Array.from({ length: Math.min(images.length - slidesToShow + 1, 3) }, (_, i) => (
              <button
                key={i}
                className={`simonkey-carousel-indicator ${i === currentIndex ? 'active' : ''}`}
                onClick={() => goToSlide(i)}
                aria-label={`Ir al slide ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SimonkeyCarousel;