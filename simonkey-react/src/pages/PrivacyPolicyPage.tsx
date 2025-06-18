import React from 'react';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import '../styles/LegalPages.css';

const PrivacyPolicyPage: React.FC = () => {
  return (
    <HeaderWithHamburger title="Política de Privacidad" subtitle="Cómo protegemos tu información personal">
      <div className="legal-page-container">
        <div className="legal-content">
          <div className="legal-header">
            <h1>Política de Privacidad</h1>
            <p className="last-updated">Última actualización: {new Date().toLocaleDateString('es-ES', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</p>
          </div>

          <section className="legal-section">
            <h2>1. Información General</h2>
            <p>
              En Simonkey, respetamos tu privacidad y estamos comprometidos a proteger tus datos personales. 
              Esta Política de Privacidad explica cómo recopilamos, usamos, almacenamos y protegemos tu información 
              cuando utilizas nuestra plataforma de aprendizaje.
            </p>
            <div className="info-box">
              <h4>📧 Contacto del Responsable de Datos</h4>
              <p>
                <strong>Responsable:</strong> Simonkey<br/>
                <strong>Email:</strong> privacy@simonkey.com<br/>
                <strong>Dirección:</strong> [Tu dirección]
              </p>
            </div>
          </section>

          <section className="legal-section">
            <h2>2. Información que Recopilamos</h2>
            
            <h3>2.1 Información que nos Proporcionas</h3>
            <ul>
              <li><strong>Datos de registro:</strong> nombre, apellidos, email, fecha de nacimiento</li>
              <li><strong>Datos de perfil:</strong> intereses de aprendizaje, tipo de aprendizaje preferido</li>
              <li><strong>Contenido educativo:</strong> cuadernos, conceptos, progreso de estudio</li>
              <li><strong>Configuraciones:</strong> preferencias de voz, idioma, tema de la aplicación</li>
            </ul>

            <h3>2.2 Información que Recopilamos Automáticamente</h3>
            <ul>
              <li><strong>Datos de uso:</strong> páginas visitadas, tiempo de estudio, frecuencia de uso</li>
              <li><strong>Datos técnicos:</strong> dirección IP, tipo de navegador, sistema operativo</li>
              <li><strong>Datos de rendimiento:</strong> estadísticas de quiz, progreso de aprendizaje</li>
              <li><strong>Datos de sesión:</strong> información de autenticación y sesión</li>
            </ul>

            <h3>2.3 Cookies y Tecnologías Similares</h3>
            <p>
              Utilizamos diferentes tipos de cookies según tus preferencias. Puedes gestionar estas 
              preferencias en cualquier momento a través de nuestro Centro de Preferencias de Cookies.
            </p>
            
            <div className="cookie-types">
              <div className="cookie-type">
                <h4>🔒 Cookies Esenciales</h4>
                <p>Necesarias para el funcionamiento básico de la plataforma (autenticación, seguridad).</p>
              </div>
              <div className="cookie-type">
                <h4>📊 Cookies de Análisis</h4>
                <p>Nos ayudan a entender cómo usas la plataforma para mejorar la experiencia.</p>
              </div>
              <div className="cookie-type">
                <h4>⚙️ Cookies de Preferencias</h4>
                <p>Recuerdan tus configuraciones personalizadas (tema, idioma, etc.).</p>
              </div>
            </div>
          </section>

          <section className="legal-section">
            <h2>3. Cómo Usamos tu Información</h2>
            <p>Utilizamos tu información personal para los siguientes propósitos legítimos:</p>
            
            <div className="usage-grid">
              <div className="usage-item">
                <h4>🎯 Personalización del Aprendizaje</h4>
                <p>Adaptar el contenido y método de estudio según tu tipo de aprendizaje preferido.</p>
                <span className="legal-basis">Base legal: Interés legítimo</span>
              </div>
              
              <div className="usage-item">
                <h4>📈 Seguimiento del Progreso</h4>
                <p>Registrar tu avance en los estudios y proporcionar estadísticas de aprendizaje.</p>
                <span className="legal-basis">Base legal: Ejecución del contrato</span>
              </div>
              
              <div className="usage-item">
                <h4>🔐 Seguridad y Autenticación</h4>
                <p>Verificar tu identidad y mantener la seguridad de tu cuenta.</p>
                <span className="legal-basis">Base legal: Interés legítimo</span>
              </div>
              
              <div className="usage-item">
                <h4>📧 Comunicaciones</h4>
                <p>Enviarte actualizaciones importantes sobre el servicio (solo con tu consentimiento para marketing).</p>
                <span className="legal-basis">Base legal: Consentimiento/Interés legítimo</span>
              </div>
              
              <div className="usage-item">
                <h4>🛠️ Mejora del Servicio</h4>
                <p>Analizar el uso de la plataforma para identificar errores y mejorar funcionalidades.</p>
                <span className="legal-basis">Base legal: Interés legítimo</span>
              </div>
              
              <div className="usage-item">
                <h4>⚖️ Cumplimiento Legal</h4>
                <p>Cumplir con obligaciones legales y responder a solicitudes de autoridades.</p>
                <span className="legal-basis">Base legal: Obligación legal</span>
              </div>
            </div>
          </section>

          <section className="legal-section">
            <h2>4. Compartir tu Información</h2>
            <p>No vendemos, alquilamos o compartimos tu información personal con terceros, excepto en las siguientes circunstancias:</p>
            
            <div className="sharing-list">
              <div className="sharing-item">
                <h4>🏢 Proveedores de Servicios</h4>
                <p>
                  Compartimos datos con proveedores que nos ayudan a operar la plataforma:
                </p>
                <ul>
                  <li><strong>Firebase (Google):</strong> Almacenamiento de datos y autenticación</li>
                  <li><strong>Servicios de IA:</strong> Para generar explicaciones de conceptos</li>
                  <li><strong>Servicios de voz:</strong> Para funcionalidades de texto a voz</li>
                </ul>
                <p>Todos nuestros proveedores están sujetos a estrictos acuerdos de procesamiento de datos.</p>
              </div>
              
              <div className="sharing-item">
                <h4>⚖️ Requisitos Legales</h4>
                <p>
                  Podemos divulgar información cuando sea requerido por ley o para:
                </p>
                <ul>
                  <li>Cumplir con procesos legales</li>
                  <li>Proteger nuestros derechos legales</li>
                  <li>Investigar fraude o actividades ilegales</li>
                  <li>Proteger la seguridad de usuarios</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="legal-section">
            <h2>5. Tus Derechos</h2>
            <p>Bajo el GDPR y otras leyes de protección de datos, tienes los siguientes derechos:</p>
            
            <div className="rights-grid">
              <div className="right-item">
                <h4>👀 Derecho de Acceso</h4>
                <p>Solicitar una copia de todos los datos personales que tenemos sobre ti.</p>
              </div>
              
              <div className="right-item">
                <h4>✏️ Derecho de Rectificación</h4>
                <p>Corregir cualquier información inexacta o incompleta.</p>
              </div>
              
              <div className="right-item">
                <h4>🗑️ Derecho de Supresión</h4>
                <p>Solicitar la eliminación de tus datos personales ("derecho al olvido").</p>
              </div>
              
              <div className="right-item">
                <h4>⏸️ Derecho de Limitación</h4>
                <p>Limitar el procesamiento de tus datos en ciertas circunstancias.</p>
              </div>
              
              <div className="right-item">
                <h4>📤 Derecho de Portabilidad</h4>
                <p>Recibir tus datos en un formato estructurado y legible por máquina.</p>
              </div>
              
              <div className="right-item">
                <h4>🚫 Derecho de Oposición</h4>
                <p>Oponerte al procesamiento de tus datos basado en intereses legítimos.</p>
              </div>
            </div>
            
            <div className="info-box">
              <h4>🛠️ Cómo Ejercer tus Derechos</h4>
              <p>
                Puedes ejercer estos derechos contactándonos en <strong>privacy@simonkey.com</strong> 
                o utilizando las herramientas de gestión de datos disponibles en tu perfil de usuario.
              </p>
              <p>
                <strong>Tiempo de respuesta:</strong> Responderemos a tu solicitud dentro de 30 días.
              </p>
            </div>
          </section>

          <section className="legal-section">
            <h2>6. Retención de Datos</h2>
            <p>Conservamos tu información personal durante los siguientes períodos:</p>
            
            <table className="retention-table">
              <thead>
                <tr>
                  <th>Tipo de Dato</th>
                  <th>Período de Retención</th>
                  <th>Razón</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Datos de cuenta activa</td>
                  <td>Mientras la cuenta esté activa</td>
                  <td>Proporcionar el servicio</td>
                </tr>
                <tr>
                  <td>Datos de cuenta inactiva</td>
                  <td>3 años de inactividad</td>
                  <td>Cumplimiento legal y recuperación de cuenta</td>
                </tr>
                <tr>
                  <td>Datos de facturación</td>
                  <td>7 años</td>
                  <td>Obligaciones fiscales y contables</td>
                </tr>
                <tr>
                  <td>Logs de seguridad</td>
                  <td>1 año</td>
                  <td>Seguridad y prevención de fraude</td>
                </tr>
                <tr>
                  <td>Datos analíticos agregados</td>
                  <td>Indefinidamente</td>
                  <td>Análisis de tendencias (anonimizados)</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="legal-section">
            <h2>7. Seguridad de los Datos</h2>
            <p>Implementamos múltiples medidas de seguridad para proteger tu información:</p>
            
            <div className="security-measures">
              <div className="security-item">
                <h4>🔐 Cifrado</h4>
                <p>Todos los datos se transmiten usando HTTPS/TLS y se almacenan cifrados.</p>
              </div>
              
              <div className="security-item">
                <h4>🔑 Control de Acceso</h4>
                <p>Acceso limitado a datos personales solo para personal autorizado.</p>
              </div>
              
              <div className="security-item">
                <h4>🛡️ Monitoreo</h4>
                <p>Monitoreo continuo de sistemas para detectar accesos no autorizados.</p>
              </div>
              
              <div className="security-item">
                <h4>🏢 Infraestructura Segura</h4>
                <p>Utilizamos Firebase de Google, que cumple con estándares SOC 2 e ISO 27001.</p>
              </div>
            </div>
          </section>

          <section className="legal-section">
            <h2>8. Transferencias Internacionales</h2>
            <p>
              Tus datos pueden ser transferidos y procesados en países fuera del Espacio Económico Europeo (EEE). 
              Cuando esto ocurra, nos aseguramos de que:
            </p>
            <ul>
              <li>El país de destino tenga un nivel adecuado de protección de datos</li>
              <li>Se implementen salvaguardias apropiadas (como Cláusulas Contractuales Tipo)</li>
              <li>Exista una base legal válida para la transferencia</li>
            </ul>
            
            <div className="warning-box">
              <h4>⚠️ Importante sobre Firebase</h4>
              <p>
                Utilizamos Firebase (Google) para almacenar datos, que puede procesar información en Estados Unidos. 
                Google participa en el Marco de Privacidad de Datos UE-EE.UU. y cumple con las salvaguardias requeridas.
              </p>
            </div>
          </section>

          <section className="legal-section">
            <h2>9. Menores de Edad</h2>
            <p>
              Nuestro servicio está disponible para usuarios de 13 años en adelante. Si descubrimos que hemos 
              recopilado información de un menor de 13 años sin consentimiento parental verificable, eliminaremos 
              esa información inmediatamente.
            </p>
            
            <h3>Protecciones Especiales para Menores (13-18 años)</h3>
            <ul>
              <li>Recopilación limitada de datos personales</li>
              <li>No se utilizan datos para marketing directo</li>
              <li>Los padres pueden solicitar acceso y eliminación de datos</li>
              <li>Configuraciones de privacidad más restrictivas por defecto</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>10. Cambios en esta Política</h2>
            <p>
              Podemos actualizar esta Política de Privacidad ocasionalmente. Cuando hagamos cambios significativos:
            </p>
            <ul>
              <li>Te notificaremos por email (si tienes una cuenta activa)</li>
              <li>Mostraremos un aviso prominente en la plataforma</li>
              <li>Para cambios sustanciales, solicitaremos tu consentimiento renovado</li>
            </ul>
            
            <p>
              <strong>Última actualización:</strong> {new Date().toLocaleDateString('es-ES')}<br/>
              <strong>Versión:</strong> 1.0
            </p>
          </section>

          <section className="legal-section">
            <h2>11. Contacto</h2>
            <p>Si tienes preguntas sobre esta Política de Privacidad o el tratamiento de tus datos personales:</p>
            
            <div className="contact-info">
              <div className="contact-method">
                <h4>📧 Email</h4>
                <p><strong>privacy@simonkey.com</strong></p>
                <p>Para consultas sobre privacidad y protección de datos</p>
              </div>
              
              <div className="contact-method">
                <h4>📮 Correo Postal</h4>
                <p>
                  <strong>Simonkey - Departamento de Privacidad</strong><br/>
                  [Tu dirección completa]<br/>
                  [Ciudad, Código Postal]<br/>
                  [País]
                </p>
              </div>
              
              <div className="contact-method">
                <h4>⚖️ Autoridad de Control</h4>
                <p>
                  Tienes derecho a presentar una queja ante la autoridad de protección de datos de tu país 
                  si consideras que hemos violado tus derechos de privacidad.
                </p>
                <p>
                  <strong>España:</strong> Agencia Española de Protección de Datos (AEPD)<br/>
                  <strong>Web:</strong> www.aepd.es
                </p>
              </div>
            </div>
          </section>

          <div className="legal-footer">
            <p>
              Esta Política de Privacidad es efectiva a partir del {new Date().toLocaleDateString('es-ES')} 
              y se aplica a todos los usuarios de Simonkey.
            </p>
          </div>
        </div>
      </div>
    </HeaderWithHamburger>
  );
};

export default PrivacyPolicyPage;