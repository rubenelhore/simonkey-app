import React, { useState } from 'react';
import './FAQPage.css';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const FAQPage: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const faqs: FAQItem[] = [
    {
      category: 'general',
      question: '¿Qué es Simonkey?',
      answer: 'Simonkey es una plataforma de aprendizaje impulsada por inteligencia artificial que se adapta a tu ritmo y estilo de estudio. Te ayuda a organizar tus materiales, crear resúmenes inteligentes y practicar con ejercicios personalizados.'
    },
    {
      category: 'general',
      question: '¿Cómo funciona la IA de Simonkey?',
      answer: 'Nuestra IA analiza tus materiales de estudio, identifica conceptos clave y genera contenido personalizado. Aprende de tu progreso y adapta las sesiones de estudio para maximizar tu aprendizaje.'
    },
    {
      category: 'precios',
      question: '¿Cuánto cuesta Simonkey?',
      answer: 'Ofrecemos un plan gratuito con funciones básicas y planes premium desde $9.99/mes. Los estudiantes tienen descuentos especiales del 50% con correo educativo válido.'
    },
    {
      category: 'precios',
      question: '¿Hay periodo de prueba gratuito?',
      answer: 'Sí, ofrecemos 14 días de prueba gratuita del plan premium sin necesidad de tarjeta de crédito. Puedes cancelar en cualquier momento.'
    },
    {
      category: 'funciones',
      question: '¿Puedo subir mis propios documentos?',
      answer: 'Por supuesto. Puedes subir PDFs, presentaciones, imágenes y documentos de texto. Simonkey extraerá automáticamente la información relevante y creará materiales de estudio.'
    },
    {
      category: 'funciones',
      question: '¿Puedo compartir mis cuadernos con compañeros?',
      answer: 'Sí, puedes compartir tus cuadernos con otros usuarios mediante un enlace. También puedes colaborar en tiempo real y ver el progreso de tu grupo de estudio.'
    },
    {
      category: 'funciones',
      question: '¿Funciona offline?',
      answer: 'La aplicación móvil permite descargar contenido para estudiar sin conexión. La sincronización se realiza automáticamente cuando vuelves a tener internet.'
    },
    {
      category: 'soporte',
      question: '¿Cómo puedo contactar con soporte?',
      answer: 'Puedes contactarnos a través del chat en la aplicación, por email a soporte@simonkey.com o mediante el formulario de contacto. Respondemos en menos de 24 horas.'
    },
    {
      category: 'soporte',
      question: '¿En qué idiomas está disponible?',
      answer: 'Actualmente Simonkey está disponible en español e inglés. Estamos trabajando para agregar portugués, francés y alemán próximamente.'
    },
    {
      category: 'seguridad',
      question: '¿Mis datos están seguros?',
      answer: 'Absolutamente. Usamos encriptación de extremo a extremo y cumplimos con GDPR. Tus datos nunca se comparten con terceros y puedes eliminar tu cuenta en cualquier momento.'
    }
  ];

  const categories = [
    { id: 'all', name: 'Todas las preguntas' },
    { id: 'general', name: 'General' },
    { id: 'precios', name: 'Precios' },
    { id: 'funciones', name: 'Funciones' },
    { id: 'soporte', name: 'Soporte' },
    { id: 'seguridad', name: 'Seguridad' }
  ];

  const filteredFAQs = selectedCategory === 'all' 
    ? faqs 
    : faqs.filter(faq => faq.category === selectedCategory);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="faq-page">
      <div className="faq-hero">
        <div className="container">
          <h1 className="faq-title">Preguntas Frecuentes</h1>
          <p className="faq-subtitle">
            Encuentra respuestas a las preguntas más comunes sobre Simonkey
          </p>
        </div>
      </div>

      <div className="container">
        <div className="faq-categories">
          {categories.map(cat => (
            <button
              key={cat.id}
              className={`category-btn ${selectedCategory === cat.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="faq-list">
          {filteredFAQs.map((faq, index) => (
            <div key={index} className="faq-item">
              <button
                className={`faq-question ${openIndex === index ? 'open' : ''}`}
                onClick={() => toggleFAQ(index)}
              >
                <span>{faq.question}</span>
                <span className="faq-icon">{openIndex === index ? '−' : '+'}</span>
              </button>
              {openIndex === index && (
                <div className="faq-answer">
                  <p>{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="faq-contact">
          <h2>¿No encontraste lo que buscabas?</h2>
          <p>Nuestro equipo está aquí para ayudarte</p>
          <a href="/contact" className="btn btn-primary">Contáctanos</a>
        </div>
      </div>
    </div>
  );
};

export default FAQPage;