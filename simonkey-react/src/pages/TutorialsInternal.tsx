import React, { useState } from 'react';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import { Play, Clock, X } from 'lucide-react';
import '../styles/Tutorials.css';

interface Tutorial {
  id: string;
  title: string;
  description: string;
  youtubeId: string;
  duration: string;
  category: string;
}

const TutorialsInternal: React.FC = () => {
  const [selectedVideo, setSelectedVideo] = useState<Tutorial | null>(null);

  // Videos organizados por categorías
  const tutorialsByCategory = {
    '🚀 Primeros Pasos': [
      {
        id: '1',
        title: 'Como crear una cuenta en Simonkey',
        description: 'Paso a paso para registrarte y empezar',
        youtubeId: '2_gO37mDvG8',
        duration: '0:30',
        category: '🚀 Primeros Pasos'
      },
      {
        id: '2',
        title: 'Como crear mi primer materia y subir contenido',
        description: 'Guía completa para crear materias y agregar conceptos',
        youtubeId: 'm4uK3pX5jxs',
        duration: '1:41',
        category: '🚀 Primeros Pasos'
      },
      {
        id: '3',
        title: 'Como compartir una materia de Simonkey con alumnos',
        description: 'Aprende a invitar estudiantes y gestionar el acceso a tus materias',
        youtubeId: '4dyb5rrmjYY',
        duration: '0:50',
        category: '🚀 Primeros Pasos'
      },
      {
        id: '4',
        title: 'Cómo convertir tu cuenta a una de profesor',
        description: 'Aprende paso a paso a convertir una cuenta normal a una de profesor',
        youtubeId: 'mLqgvGbTXo8',
        duration: '2:00',
        category: '🚀 Primeros Pasos'
      }
    ],
    '🎵 ¡Ahora un poco de buena música! 🎶✨': [
      {
        id: '5',
        title: 'Rick Astley - Never Gonna Give You Up',
        description: 'Un clásico que nunca pasa de moda 🎶',
        youtubeId: 'dQw4w9WgXcQ',
        duration: '3:33',
        category: '🎵 ¡Ahora un poco de buena música! 🎶✨'
      },
      {
        id: '6',
        title: 'American Authors - Best Day Of My Life',
        description: 'Para empezar el día con energía y positividad ✨',
        youtubeId: 'Y66j_BUCBMY',
        duration: '3:40',
        category: '🎵 ¡Ahora un poco de buena música! 🎶✨'
      },
      {
        id: '7',
        title: 'Imagine Dragons - Bones',
        description: 'Para cuando necesites energía y motivación 🔥',
        youtubeId: 'TO-_3tck2tg',
        duration: '2:45',
        category: '🎵 ¡Ahora un poco de buena música! 🎶✨'
      }
    ]
  };

  return (
    <div className="internal-page-container">
      <HeaderWithHamburger 
        title={
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-book-open" aria-hidden="true" style={{ marginRight: '10px' }}>
              <path d="M12 7v14"></path>
              <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"></path>
            </svg>
            Tutoriales
          </span>
        }
      />
      
      <div className="tutorials-main-container" style={{ paddingTop: '100px' }}>

        {/* Modal de video */}
        {selectedVideo && (
          <div className="video-modal-overlay" onClick={() => setSelectedVideo(null)}>
            <div className="video-modal" onClick={(e) => e.stopPropagation()}>
              <button className="close-modal" onClick={() => setSelectedVideo(null)}>
                <X size={24} />
              </button>
              <div className="modal-video-wrapper">
                <iframe
                  src={`https://www.youtube.com/embed/${selectedVideo.youtubeId}?autoplay=1`}
                  title={selectedVideo.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <div className="modal-video-info">
                <h3>{selectedVideo.title}</h3>
                <p>{selectedVideo.description}</p>
              </div>
            </div>
          </div>
        )}

        {/* Secciones de tutoriales */}
        <div className="tutorials-sections">
          {Object.entries(tutorialsByCategory).map(([category, videos]) => (
            <div key={category} className="tutorial-section">
              <h2 className="section-title">{category}</h2>
              <div className="videos-grid">
                {videos.map(video => (
                  <div 
                    key={video.id} 
                    className="video-card"
                    onClick={() => setSelectedVideo(video)}
                  >
                    <div className="video-thumbnail">
                      <div className="play-overlay">
                        <Play size={40} />
                      </div>
                      <div className="video-duration">
                        <Clock size={12} />
                        <span>{video.duration}</span>
                      </div>
                      {/* Thumbnail placeholder */}
                      <img 
                        src={`https://img.youtube.com/vi/${video.youtubeId}/maxresdefault.jpg`}
                        alt={video.title}
                        onError={(e) => {
                          e.currentTarget.src = `https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`;
                        }}
                      />
                    </div>
                    <div className="video-info">
                      <h3>{video.title}</h3>
                      <p>{video.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TutorialsInternal;