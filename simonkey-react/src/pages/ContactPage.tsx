import React, { useState } from 'react';
import './ContactPage.css';

const ContactPage: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulamos el envío del formulario
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitMessage('¡Gracias por contactarnos! Te responderemos en menos de 24 horas.');
      setFormData({
        name: '',
        email: '',
        subject: '',
        message: ''
      });
      
      // Limpiar mensaje después de 5 segundos
      setTimeout(() => setSubmitMessage(''), 5000);
    }, 1500);
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
      info: '+52 55 8012 5707',
      description: 'Soporte rápido'
    }
  ];

  return (
    <div className="contact-page">
      <div className="contact-hero">
        <div className="container">
          <h1 className="contact-title">Contáctanos</h1>
          <p className="contact-subtitle">
            Estamos aquí para ayudarte con cualquier pregunta o comentario
          </p>
        </div>
      </div>

      <div className="container">
        <div className="contact-content">
          <div className="contact-form-section">
            <h2>Envíanos un mensaje</h2>
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
            <h2>Otras formas de contactarnos</h2>
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
    </div>
  );
};

export default ContactPage;