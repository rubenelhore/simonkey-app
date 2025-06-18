import React from 'react';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import '../styles/LegalPages.css';

const TermsPage: React.FC = () => {
  return (
    <HeaderWithHamburger title="Términos de Servicio" subtitle="Condiciones de uso de la plataforma">
      <div className="legal-page-container">
        <div className="legal-content">
          <div className="legal-header">
            <h1>Términos de Servicio</h1>
            <p className="last-updated">Última actualización: {new Date().toLocaleDateString('es-ES', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</p>
          </div>

          <section className="legal-section">
            <h2>1. Aceptación de los Términos</h2>
            <p>
              Al acceder y utilizar Simonkey ("el Servicio"), usted acepta estar sujeto a estos 
              Términos de Servicio ("Términos"). Si no está de acuerdo con alguno de estos términos, 
              no debe utilizar nuestro servicio.
            </p>
            <div className="info-box">
              <h4>📋 Importante</h4>
              <p>
                Estos términos constituyen un acuerdo legal entre usted y Simonkey. 
                Léalos cuidadosamente antes de utilizar nuestros servicios.
              </p>
            </div>
          </section>

          <section className="legal-section">
            <h2>2. Descripción del Servicio</h2>
            <p>
              Simonkey es una plataforma educativa que utiliza inteligencia artificial para proporcionar:
            </p>
            <ul>
              <li>Creación y gestión de cuadernos de estudio digitales</li>
              <li>Sistemas de repaso espaciado adaptativos</li>
              <li>Herramientas de quiz y evaluación</li>
              <li>Análisis de progreso personalizado</li>
              <li>Funcionalidades de texto a voz</li>
              <li>Explicaciones generadas por IA</li>
            </ul>
            
            <h3>2.1 Disponibilidad del Servicio</h3>
            <p>
              Nos esforzamos por mantener el servicio disponible 24/7, pero no garantizamos 
              un tiempo de actividad del 100%. Podemos realizar mantenimiento programado 
              con aviso previo cuando sea posible.
            </p>
          </section>

          <section className="legal-section">
            <h2>3. Registro y Cuentas de Usuario</h2>
            
            <h3>3.1 Requisitos de Edad</h3>
            <ul>
              <li>Debes tener al menos 13 años para crear una cuenta</li>
              <li>Los usuarios menores de 18 años deben tener el consentimiento de sus padres o tutores</li>
              <li>Nos reservamos el derecho de solicitar verificación de edad</li>
            </ul>

            <h3>3.2 Responsabilidades del Usuario</h3>
            <div className="usage-grid">
              <div className="usage-item">
                <h4>✅ Información Veraz</h4>
                <p>Proporcionar información precisa y actualizada durante el registro</p>
              </div>
              
              <div className="usage-item">
                <h4>🔐 Seguridad de la Cuenta</h4>
                <p>Mantener la confidencialidad de sus credenciales de acceso</p>
              </div>
              
              <div className="usage-item">
                <h4>🚫 Uso Responsable</h4>
                <p>No utilizar el servicio para actividades ilegales o no autorizadas</p>
              </div>
              
              <div className="usage-item">
                <h4>📢 Notificación de Incidentes</h4>
                <p>Informar inmediatamente cualquier uso no autorizado de su cuenta</p>
              </div>
            </div>
          </section>

          <section className="legal-section">
            <h2>4. Uso Aceptable</h2>
            
            <h3>4.1 Conductas Permitidas</h3>
            <ul>
              <li>Utilizar el servicio para fines educativos personales</li>
              <li>Crear y compartir contenido educativo original</li>
              <li>Colaborar de manera constructiva con otros usuarios</li>
              <li>Reportar problemas técnicos o de seguridad</li>
            </ul>

            <h3>4.2 Conductas Prohibidas</h3>
            <div className="warning-box">
              <h4>⚠️ Actividades Prohibidas</h4>
              <p>El siguiente comportamiento resultará en la suspensión o cancelación de su cuenta:</p>
              <ul>
                <li>Publicar contenido ilegal, ofensivo, difamatorio o que incite al odio</li>
                <li>Violar derechos de propiedad intelectual de terceros</li>
                <li>Intentar acceder sin autorización a sistemas o datos</li>
                <li>Distribuir malware, virus o código malicioso</li>
                <li>Utilizar el servicio para spam o comunicaciones comerciales no solicitadas</li>
                <li>Crear múltiples cuentas para evadir limitaciones</li>
                <li>Realizar ingeniería inversa o intentar extraer código fuente</li>
              </ul>
            </div>
          </section>

          <section className="legal-section">
            <h2>5. Contenido del Usuario</h2>
            
            <h3>5.1 Propiedad del Contenido</h3>
            <p>
              Usted mantiene la propiedad de todo el contenido que crea y sube a la plataforma, 
              incluyendo cuadernos, conceptos, notas y otros materiales educativos.
            </p>

            <h3>5.2 Licencia Otorgada a Simonkey</h3>
            <p>
              Al subir contenido, nos otorga una licencia mundial, no exclusiva, libre de regalías 
              para procesar, almacenar y mejorar el contenido con el fin de proporcionar el servicio.
            </p>

            <h3>5.3 Contenido Compartido</h3>
            <p>
              Cuando comparte cuadernos públicamente:
            </p>
            <ul>
              <li>Otorga a otros usuarios el derecho de ver y estudiar el contenido</li>
              <li>Mantiene la responsabilidad sobre la exactitud y legalidad del contenido</li>
              <li>Puede revocar el acceso público en cualquier momento</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>6. Privacidad y Protección de Datos</h2>
            <p>
              Su privacidad es importante para nosotros. El tratamiento de sus datos personales 
              se rige por nuestra <a href="/privacy-policy">Política de Privacidad</a>, que forma 
              parte integral de estos términos.
            </p>
            
            <div className="cookie-types">
              <div className="cookie-type">
                <h4>🔒 Datos Esenciales</h4>
                <p>Recopilamos solo los datos necesarios para proporcionar el servicio</p>
              </div>
              <div className="cookie-type">
                <h4>🛡️ Seguridad</h4>
                <p>Implementamos medidas robustas de seguridad para proteger sus datos</p>
              </div>
              <div className="cookie-type">
                <h4>⚖️ Cumplimiento</h4>
                <p>Cumplimos con GDPR y otras regulaciones de protección de datos</p>
              </div>
            </div>
          </section>

          <section className="legal-section">
            <h2>7. Planes de Suscripción y Pagos</h2>
            
            <h3>7.1 Tipos de Cuenta</h3>
            <table className="retention-table">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Características</th>
                  <th>Limitaciones</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Gratuito</td>
                  <td>Funcionalidades básicas, cuadernos limitados</td>
                  <td>Máximo 3 cuadernos, 50 conceptos por cuaderno</td>
                </tr>
                <tr>
                  <td>Pro</td>
                  <td>Acceso completo, análisis avanzado</td>
                  <td>Cuadernos y conceptos ilimitados</td>
                </tr>
                <tr>
                  <td>Educativo</td>
                  <td>Funciones colaborativas para instituciones</td>
                  <td>Gestión de múltiples estudiantes</td>
                </tr>
              </tbody>
            </table>

            <h3>7.2 Política de Facturación</h3>
            <ul>
              <li>Los pagos se procesan de forma segura a través de proveedores certificados</li>
              <li>Las suscripciones se renuevan automáticamente salvo cancelación</li>
              <li>Los precios pueden cambiar con 30 días de aviso previo</li>
              <li>No se ofrecen reembolsos parciales por períodos no utilizados</li>
            </ul>

            <h3>7.3 Cancelación</h3>
            <p>
              Puede cancelar su suscripción en cualquier momento desde su perfil. 
              La cancelación será efectiva al final del período de facturación actual.
            </p>
          </section>

          <section className="legal-section">
            <h2>8. Propiedad Intelectual</h2>
            
            <h3>8.1 Derechos de Simonkey</h3>
            <p>
              Simonkey posee todos los derechos sobre:
            </p>
            <ul>
              <li>El software y código de la plataforma</li>
              <li>El diseño de la interfaz de usuario</li>
              <li>Algoritmos de aprendizaje espaciado</li>
              <li>Marca registrada y logotipos</li>
            </ul>

            <h3>8.2 Respeto a la Propiedad Intelectual</h3>
            <p>
              Respetamos los derechos de propiedad intelectual de terceros y esperamos 
              que nuestros usuarios hagan lo mismo. Si considera que su contenido ha sido 
              utilizado sin autorización, contáctenos en legal@simonkey.com.
            </p>
          </section>

          <section className="legal-section">
            <h2>9. Limitación de Responsabilidad</h2>
            
            <div className="warning-box">
              <h4>⚠️ Limitaciones Importantes</h4>
              <p>
                <strong>EL SERVICIO SE PROPORCIONA "TAL COMO ESTÁ" SIN GARANTÍAS DE NINGÚN TIPO.</strong>
              </p>
              <p>Simonkey no será responsable por:</p>
              <ul>
                <li>Pérdida de datos o contenido del usuario</li>
                <li>Interrupciones del servicio o tiempo de inactividad</li>
                <li>Daños indirectos, especiales o consecuenciales</li>
                <li>Pérdidas de beneficios o oportunidades comerciales</li>
                <li>Inexactitudes en el contenido generado por IA</li>
              </ul>
            </div>

            <h3>9.1 Límite de Responsabilidad</h3>
            <p>
              En ningún caso la responsabilidad total de Simonkey excederá el monto 
              pagado por el usuario en los 12 meses anteriores al evento que dio lugar al reclamo.
            </p>
          </section>

          <section className="legal-section">
            <h2>10. Suspensión y Terminación</h2>
            
            <h3>10.1 Suspensión por Violación</h3>
            <p>
              Nos reservamos el derecho de suspender o terminar su cuenta si:
            </p>
            <ul>
              <li>Viola estos términos de servicio</li>
              <li>Realiza actividades fraudulentas o ilegales</li>
              <li>No paga las tarifas de suscripción</li>
              <li>Abusa del servicio de soporte técnico</li>
            </ul>

            <h3>10.2 Terminación por el Usuario</h3>
            <p>
              Puede terminar su cuenta en cualquier momento desde la configuración de su perfil. 
              Tras la terminación:
            </p>
            <ul>
              <li>Su acceso al servicio cesará inmediatamente</li>
              <li>Sus datos se eliminarán según nuestra política de retención</li>
              <li>Los cuadernos compartidos públicamente pueden mantenerse anónimos</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>11. Modificaciones a los Términos</h2>
            <p>
              Nos reservamos el derecho de modificar estos términos en cualquier momento. 
              Cuando hagamos cambios:
            </p>
            <ul>
              <li>Publicaremos los términos actualizados en la plataforma</li>
              <li>Le notificaremos por email si tiene una cuenta activa</li>
              <li>Los cambios entrarán en vigor 30 días después de la notificación</li>
              <li>Su uso continuado del servicio constituye aceptación de los nuevos términos</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>12. Resolución de Disputas</h2>
            
            <h3>12.1 Ley Aplicable</h3>
            <p>
              Estos términos se rigen por las leyes de España, sin consideración a sus 
              principios de conflicto de leyes.
            </p>

            <h3>12.2 Jurisdicción</h3>
            <p>
              Cualquier disputa relacionada con estos términos será resuelta por los 
              tribunales competentes de [Ciudad, España].
            </p>

            <h3>12.3 Resolución Amistosa</h3>
            <p>
              Antes de iniciar cualquier procedimiento legal, las partes intentarán 
              resolver la disputa de buena fe mediante negociación directa.
            </p>
          </section>

          <section className="legal-section">
            <h2>13. Disposiciones Generales</h2>
            
            <h3>13.1 Integralidad del Acuerdo</h3>
            <p>
              Estos términos, junto con nuestra Política de Privacidad, constituyen 
              el acuerdo completo entre usted y Simonkey.
            </p>

            <h3>13.2 Divisibilidad</h3>
            <p>
              Si cualquier disposición de estos términos se considera inválida o 
              inaplicable, las disposiciones restantes permanecerán en pleno vigor y efecto.
            </p>

            <h3>13.3 Renuncia</h3>
            <p>
              La falta de ejercicio de cualquier derecho no constituirá una renuncia 
              a ese derecho o a cualquier otro derecho.
            </p>
          </section>

          <section className="legal-section">
            <h2>14. Contacto</h2>
            <p>
              Si tiene preguntas sobre estos Términos de Servicio o necesita soporte:
            </p>
            
            <div className="contact-info">
              <div className="contact-method">
                <h4>📧 Soporte General</h4>
                <p><strong>support@simonkey.com</strong></p>
                <p>Para consultas técnicas y soporte general</p>
              </div>
              
              <div className="contact-method">
                <h4>⚖️ Asuntos Legales</h4>
                <p><strong>legal@simonkey.com</strong></p>
                <p>Para consultas sobre términos, derechos de autor y aspectos legales</p>
              </div>
              
              <div className="contact-method">
                <h4>🏢 Contacto Corporativo</h4>
                <p>
                  <strong>Simonkey</strong><br/>
                  [Dirección de la empresa]<br/>
                  [Ciudad, Código Postal]<br/>
                  [País]<br/>
                  <strong>Teléfono:</strong> [+XX XXX XXX XXX]
                </p>
              </div>
            </div>
          </section>

          <div className="legal-footer">
            <p>
              Estos Términos de Servicio son efectivos a partir del {new Date().toLocaleDateString('es-ES')} 
              y se aplican a todos los usuarios de Simonkey.
            </p>
            <p>
              <strong>Versión:</strong> 1.0 | <strong>Idioma:</strong> Español
            </p>
          </div>
        </div>
      </div>
    </HeaderWithHamburger>
  );
};

export default TermsPage;