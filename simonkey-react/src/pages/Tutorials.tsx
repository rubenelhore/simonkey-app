import React, { useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
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

const Tutorials: React.FC = () => {
  const [selectedVideo, setSelectedVideo] = useState<Tutorial | null>(null);

  // Videos organizados por categorías
  const tutorialsByCategory = {
    'Primeros Pasos': [
      {
        id: '1',
        title: 'Bienvenido a Simonkey',
        description: 'Introducción a la plataforma',
        youtubeId: 'dQw4w9WgXcQ',
        duration: '3:45',
        category: 'Primeros Pasos'
      },
      {
        id: '2',
        title: 'Configurar tu perfil',
        description: 'Personaliza tu experiencia',
        youtubeId: 'dQw4w9WgXcQ',
        duration: '5:30',
        category: 'Primeros Pasos'
      },
      {
        id: '3',
        title: 'Navegación básica',
        description: 'Conoce la interfaz',
        youtubeId: 'dQw4w9WgXcQ',
        duration: '4:15',
        category: 'Primeros Pasos'
      }
    ],
    'Cuadernos y Conceptos': [
      {
        id: '4',
        title: 'Crear un cuaderno',
        description: 'Tu primer cuaderno de estudio',
        youtubeId: 'dQw4w9WgXcQ',
        duration: '6:20',
        category: 'Cuadernos y Conceptos'
      },
      {
        id: '5',
        title: 'Agregar conceptos',
        description: 'Organiza tu conocimiento',
        youtubeId: 'dQw4w9WgXcQ',
        duration: '7:45',
        category: 'Cuadernos y Conceptos'
      },
      {
        id: '6',
        title: 'Editar y organizar',
        description: 'Gestiona tus cuadernos',
        youtubeId: 'dQw4w9WgXcQ',
        duration: '5:10',
        category: 'Cuadernos y Conceptos'
      }
    ]
  };

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      
      <div className="tutorials-main-container">
        <div className="tutorials-header">
          <h1>Tutoriales</h1>
          <p>Aprende a usar todas las funciones de Simonkey</p>
        </div>

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

      <Footer />
    </div>
  );
};

export default Tutorials;