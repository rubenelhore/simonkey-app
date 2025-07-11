import React from 'react';
import './AboutPage.css';
import Header from '../components/Header';
import Footer from '../components/Footer';

const AboutPage: React.FC = () => {
  const teamMembers = [
    {
      name: "Rubén Martínez Elhore",
      role: "CEO & Co-fundador",
      bio: "Mtro. en Ciencia de Datos, apasionado por democratizar la educación. En general un buen estudiante en su vida académica.",
      image: "/img/team-placeholder-1.jpg"
    },
    {
      name: "Santiago Arceo",
      role: "Director de Producto & Co-fundador",
      bio: "Ingeniero Industrial, apasionado por el desarrollo de productos tecnológicos. En general un mal estudiante en su vida académica.",
      image: "/img/team-placeholder-2.jpg"
    }
  ];

  const values = [
    {
      icon: "🎯",
      title: "Personalización",
      description: "Creemos que cada estudiante es único y merece una experiencia de aprendizaje adaptada a sus necesidades."
    },
    {
      icon: "🚀",
      title: "Innovación",
      description: "Utilizamos la tecnología más avanzada para crear soluciones educativas que realmente marquen la diferencia."
    },
    {
      icon: "🤝",
      title: "Accesibilidad",
      description: "La educación de calidad debe estar al alcance de todos, sin importar su ubicación o recursos."
    }
  ];

  return (
    <>
      <Header />
      <div className="about-page">
        <div className="about-hero">
          <div className="container">
            <h1 className="about-title">Nuestra Misión</h1>
            <p className="about-subtitle">
              Replantear los paradigmas de la educación actual en México y Latinoamérica
            </p>
          </div>
        </div>

        <div className="container">
          <section className="about-story">
            <div className="story-content">
              <h2>Nuestra Historia</h2>
              <p>
                Simonkey nació a inicios de 2025 de la frustración de ver a estudiantes brillantes luchar con métodos de estudio obsoletos. 
                Como educadores y tecnólogos, sabíamos que la inteligencia artificial podía revolucionar la forma en que aprendemos.
              </p>
              <p>
                Comenzamos con una simple pregunta: ¿Y si cada estudiante pudiera tener un tutor personal disponible 24/7 que 
                se adaptara perfectamente a su estilo de aprendizaje? Esa pregunta se convirtió en Simonkey.
              </p>
              <p>
                Hoy, miles de estudiantes usan Simonkey para mejorar sus calificaciones, reducir el estrés del estudio y 
                redescubrir el placer de aprender. Pero esto es solo el comienzo.
              </p>
            </div>
            <div className="story-stats">
              <div className="stat">
                <h3>Millones+ potenciales</h3>
                <p>Estudiantes activos</p>
              </div>
              <div className="stat">
                <h3>Muchísimas+ potenciales</h3>
                <p>Sesiones de estudio</p>
              </div>
              <div className="stat">
                <h3>+95% potencial</h3>
                <p>Mejoran sus notas</p>
              </div>
            </div>
          </section>

          <section className="about-values">
            <h2>Nuestros Valores</h2>
            <div className="values-grid">
              {values.map((value, index) => (
                <div key={index} className="value-card">
                  <div className="value-icon">{value.icon}</div>
                  <h3>{value.title}</h3>
                  <p>{value.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="about-team">
            <h2>Conoce al Equipo</h2>
            <div className="team-grid">
              {teamMembers.map((member, index) => (
                <div key={index} className="team-member">
                  <div className="member-avatar">
                    <div className="avatar-placeholder">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </div>
                  </div>
                  <h3>{member.name}</h3>
                  <p className="member-role">{member.role}</p>
                  <p className="member-bio">{member.bio}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="about-cta">
            <h2>Únete a la Revolución Educativa</h2>
            <p>Descubre cómo Simonkey puede transformar tu forma de aprender</p>
            <a href="/signup" className="btn btn-primary">Comenzar Gratis</a>
          </section>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default AboutPage;