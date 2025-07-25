import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import './ContactPage.css';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import Footer from '../components/Footer';
import HelpWhatsAppButton from '../components/HelpWhatsAppButton';

const whatsappNumber = '+525580125707';
const whatsappLink = `https://wa.me/${whatsappNumber.replace('+', '')}?text=%C2%A1Hola!%20necesito%20apoyo%20con%20Simonkey`;

const ContactPage: React.FC = () => {
  const { user, userProfile } = useAuth();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  // Actualizar nombre y email cuando el usuario esté autenticado
  useEffect(() => {
    if (user && userProfile) {
      setFormData(prev => ({
        ...prev,
        name: userProfile.nombre || userProfile.displayName || '',
        email: user.email || ''
      }));
    }
  }, [user, userProfile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Guardar mensaje en Firestore
      await addDoc(collection(db, 'contactMessages'), {
        name: formData.name,
        email: formData.email,
        subject: formData.subject,
        message: formData.message,
        createdAt: serverTimestamp(),
        read: false, // Para marcar como no leído
        status: 'pending', // pending, responded, archived
        userId: user?.uid || null // Guardar el ID del usuario si está autenticado
      });

      setSubmitMessage('¡Gracias por contactarnos! Te responderemos en menos de 24 horas.');
      setFormData({
        name: '',
        email: '',
        subject: '',
        message: ''
      });
      
      // Limpiar mensaje después de 5 segundos
      setTimeout(() => setSubmitMessage(''), 5000);
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      setSubmitMessage('Hubo un error al enviar tu mensaje. Por favor intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const contactMethods = [
    {
      icon: '📧',
      title: 'Email',
      info: 'ruben@simonkey.ai',
      description: 'Respuesta en 24 horas'
    },
    {
      icon: '📱',
      title: 'WhatsApp',
      info: (
        <a href={whatsappLink} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '0.5em' }}>
          ¡Contáctanos! <i className="fas fa-external-link-alt" style={{ fontSize: '1em' }}></i>
        </a>
      ),
      description: 'Soporte rápido'
    }
  ];

  return (
    <>
      <HeaderWithHamburger title="Centro de ayuda" />
      {/* Eliminar el div contact-page y dejar el contenido directo */}
      <div className="contact-hero">
        <div className="container">
          <h1 className="contact-title">Contáctanos</h1>
          <p className="contact-subtitle">
            Estamos aquí para ayudarte, contáctanos y compártenos tus sugerencias o comentarios
          </p>
        </div>
      </div>
      <div className="container">
        <div className="contact-content">
            <div className="contact-form-section">
              <form onSubmit={handleSubmit} className="contact-form">
                <div className="form-group">
                  <label htmlFor="name">Nombre completo</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="Juan Pérez"
                    disabled={!!user}
                    style={user ? { backgroundColor: '#f5f5f5', cursor: 'not-allowed' } : {}}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">Correo electrónico</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="juan@ejemplo.com"
                    disabled={!!user}
                    style={user ? { backgroundColor: '#f5f5f5', cursor: 'not-allowed' } : {}}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="subject">Asunto</label>
                  <select
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Selecciona un asunto</option>
                    <option value="soporte">Soporte técnico</option>
                    <option value="ventas">Información de precios</option>
                    <option value="feedback">Sugerencias</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="message">Mensaje</label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={6}
                    placeholder="Cuéntanos cómo podemos ayudarte..."
                  />
                </div>

                {submitMessage && (
                  <div className="submit-message success">
                    {submitMessage}
                  </div>
                )}

                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Enviando...' : 'Enviar mensaje'}
                </button>
              </form>
            </div>

            <div className="contact-info-section">
              <div className="contact-methods">
                {contactMethods.map((method, index) => (
                  <div key={index} className="contact-method">
                    <div className="method-icon">{method.icon}</div>
                    <div className="method-info">
                      <h3>{method.title}</h3>
                      <p className="method-detail">{method.info}</p>
                      <p className="method-description">{method.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="office-info">
                <h3>Horario de atención</h3>
                <p>Lunes a Viernes: 9:00 - 18:00 (CST)</p>
              </div>

            </div>
          </div>
        </div>
    </>
  );
};

export default ContactPage;