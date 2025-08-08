import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUserType } from '../hooks/useUserType';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import MateriaItem from '../components/MateriaItem';
import '../styles/Materias.css';
import '../styles/SchoolSystem.css';

interface SchoolSubject {
  id: string;
  nombre: string;
  descripcion?: string;
  color?: string;
  idProfesor: string;
  idAdmin: string;
  notebookCount?: number;
  createdAt?: any;
}

const SchoolTeacherMateriasPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, userProfile, loading: authLoading } = useAuth();
  const { isSchoolAdmin } = useUserType();
  const [materias, setMaterias] = useState<SchoolSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);

  // Log para depuración
  console.log('🎯 SchoolTeacherMateriasPage - Estado inicial:');
  console.log('  - user:', user);
  console.log('  - userProfile:', userProfile);
  console.log('  - authLoading:', authLoading);
  console.log('  - isSchoolAdmin:', isSchoolAdmin);

  useEffect(() => {
    const loadMaterias = async () => {
      if (!user || !userProfile) return;
      
      setLoading(true);
      try {
        // Usar el ID del documento del profesor
        const teacherId = userProfile.id || user.uid;
        console.log('📚 Cargando materias para:', isSchoolAdmin ? 'admin' : 'profesor', teacherId);

        // Query para obtener las materias
        // Si es admin, mostrar todas las materias de la escuela
        let materiasQuery;
        if (isSchoolAdmin && userProfile.schoolData?.idEscuela) {
          materiasQuery = query(
            collection(db, 'schoolSubjects'),
            where('idEscuela', '==', userProfile.schoolData.idEscuela)
          );
        } else {
          // Si es profesor, solo las materias asignadas
          materiasQuery = query(
            collection(db, 'schoolSubjects'),
            where('idProfesor', '==', teacherId)
          );
        }
        
        const snapshot = await getDocs(materiasQuery);
        const materiasData: SchoolSubject[] = [];
        
        // Para cada materia, contar los cuadernos
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          
          // Contar notebooks de cada materia
          const notebooksQuery = query(
            collection(db, 'schoolNotebooks'),
            where('idMateria', '==', docSnap.id)
          );
          const notebooksSnapshot = await getDocs(notebooksQuery);
          
          materiasData.push({
            id: docSnap.id,
            nombre: data.nombre,
            descripcion: data.descripcion,
            color: data.color || '#6147FF',
            idProfesor: data.idProfesor,
            idAdmin: data.idAdmin,
            notebookCount: notebooksSnapshot.size,
            createdAt: data.createdAt
          });
        }
        
        // Ordenar por fecha de creación
        materiasData.sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime;
        });
        
        setMaterias(materiasData);
        console.log('✅ Materias cargadas:', materiasData.length);
      } catch (err) {
        console.error('Error loading materias:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadMaterias();
  }, [user, userProfile, isSchoolAdmin]);

  const handleViewMateria = (materiaId: string) => {
    // Encontrar la materia por ID para obtener su nombre
    const materia = materias.find(m => m.id === materiaId);
    if (materia) {
      // Navegar directamente a la ruta de notebooks con el nombre de la materia
      const encodedName = encodeURIComponent(materia.nombre);
      navigate(`/materias/${encodedName}/notebooks`);
    }
  };

  const handleToggleActions = (materiaId: string) => {
    if (openActionsId === materiaId) {
      setOpenActionsId(null);
    } else {
      setOpenActionsId(materiaId);
    }
  };

  // Los profesores no pueden cambiar el color de las materias
  // Esta funcionalidad está reservada para administradores

  // Funciones para herramientas del profesor
  const handleExportData = (format: 'csv' | 'pdf') => {
    try {
      if (materias.length === 0) {
        alert('No hay datos para exportar');
        return;
      }

      if (format === 'csv') {
        // Preparar datos para CSV
        const csvData = materias.map(materia => ({
          'Materia': materia.nombre,
          'Descripción': materia.descripcion || '',
          'Cuadernos': materia.notebookCount || 0,
          'Color': materia.color,
          'Fecha de Creación': materia.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'
        }));

        // Convertir a CSV
        const headers = Object.keys(csvData[0]).join(',');
        const csv = csvData.map(row => Object.values(row).join(',')).join('\n');
        const csvContent = headers + '\n' + csv;

        // Descargar archivo
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `mis_materias_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        
        console.log('✅ Datos exportados a CSV');
      } else {
        // Para PDF, mostrar mensaje de funcionalidad futura
        alert('Exportar a PDF - Funcionalidad en desarrollo');
      }
    } catch (error) {
      console.error('Error exportando datos:', error);
      alert('Error al exportar los datos');
    }
  };

  const handleOpenGuide = () => {
    // Abrir guía del profesor en nueva ventana
    const guideContent = `
      📚 GUÍA DEL PROFESOR - SIMONKEY
      
      🎯 ¿Cómo usar la plataforma?
      
      1. MATERIAS
         • Explora las materias asignadas por tu administrador
         • Cada materia puede contener múltiples cuadernos
      
      2. CUADERNOS
         • Crea cuadernos para organizar contenido por temas
         • Añade conceptos y descripciones detalladas
         • Personaliza colores para mejor organización
      
      3. EXÁMENES
         • Crea exámenes basados en tus cuadernos
         • Programa fechas de inicio y fin
         • Monitorea el progreso de tus estudiantes
      
      4. ANALÍTICA
         • Revisa el progreso de tus estudiantes
         • Identifica áreas que necesitan refuerzo
         • Exporta reportes de rendimiento
      
      💡 CONSEJOS:
      • Organiza el contenido de forma lógica y progresiva
      • Usa colores consistentes para cada tema
      • Revisa regularmente el progreso estudiantil
      • Mantén actualizada la información de contacto
      
      🆘 ¿Necesitas ayuda?
      • Usa el botón "Ayuda" para contactar soporte
      • Consulta la documentación online
      • Participa en las capacitaciones disponibles
    `;

    // Crear ventana modal personalizada para mostrar la guía
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.8); display: flex; align-items: center;
      justify-content: center; z-index: 10000;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
      background: white; padding: 2rem; border-radius: 12px;
      max-width: 600px; max-height: 80vh; overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    `;
    
    content.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h2 style="margin: 0; color: #6147FF;">📚 Guía del Profesor</h2>
        <button onclick="this.closest('[style*=fixed]').remove()" 
                style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">×</button>
      </div>
      <pre style="white-space: pre-wrap; font-family: system-ui; line-height: 1.5; color: #374151;">${guideContent}</pre>
      <div style="margin-top: 1.5rem; text-align: center;">
        <button onclick="window.open('/contact', '_blank')" 
                style="background: #6147FF; color: white; border: none; padding: 0.75rem 1.5rem; 
                       border-radius: 6px; cursor: pointer; font-weight: 500;">
          🆘 Contactar Soporte
        </button>
      </div>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    console.log('📖 Guía del profesor abierta');
  };

  // Filtrar materias basado en el término de búsqueda
  const filteredMaterias = materias.filter(materia =>
    materia.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (materia.descripcion && materia.descripcion.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading || authLoading) {
    console.log('🔄 SchoolTeacherMateriasPage - Mostrando loading spinner');
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Cargando materias...</p>
      </div>
    );
  }

  console.log('🎨 SchoolTeacherMateriasPage - Renderizando componente principal');
  console.log('  - materias:', materias);
  console.log('  - filteredMaterias:', filteredMaterias);

  return (
    <>
      <HeaderWithHamburger
        title="Área del Profesor"
        subtitle={`Materias Asignadas - ${userProfile?.nombre || 'Profesor'}`}
      />
      <main className="materias-main">
        <div className="left-column">
          <div className="teacher-info-card">
            <h3>👨‍🏫 Panel del Profesor</h3>
            <p>• Explora tus materias asignadas</p>
            <p>• Crea y elimina cuadernos</p>
            <p>• Añade conceptos a los cuadernos</p>
            <p>• Modifica títulos y colores de cuadernos</p>
          </div>
        </div>
        <div className="materias-list-section">
          <div className="materia-list-controls">
            <div className="materia-list-header">
              <div className="search-container">
                <i className="fas fa-search search-icon"></i>
                <input
                  type="text"
                  placeholder="Buscar materia..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
            </div>
          </div>

          {filteredMaterias.length === 0 ? (
            <div className="empty-state">
              <h3>No tienes materias asignadas</h3>
              <p>Tu cuenta de profesor está configurada correctamente.</p>
              <p>Contacta al administrador de tu institución para que te asigne materias.</p>
            </div>
          ) : (
            <div className="materia-grid">
              {filteredMaterias.map(materia => (
                <MateriaItem
                  key={materia.id}
                  id={materia.id}
                  title={materia.nombre}
                  color={materia.color}
                  notebookCount={materia.notebookCount || 0}
                  onView={handleViewMateria}
                  onColorChange={undefined}
                  showActions={openActionsId === materia.id}
                  onToggleActions={handleToggleActions}
                />
              ))}
            </div>
          )}
        </div>

        {/* Módulo de Herramientas del Profesor */}
        <div className="teacher-tools-module">
          <div className="tools-header">
            <h3>🛠️ Herramientas del Profesor</h3>
            <p>Recursos y utilidades para gestionar tus materias</p>
          </div>
          
          <div className="tools-grid">
            {/* Exportar Datos */}
            <div className="tool-card export-card">
              <div className="tool-icon">
                <i className="fas fa-download"></i>
              </div>
              <div className="tool-content">
                <h4>Exportar Datos</h4>
                <p>Descarga información de tus materias y cuadernos</p>
                <div className="tool-actions">
                  <button 
                    className="tool-btn primary"
                    onClick={() => handleExportData('csv')}
                    title="Exportar a CSV"
                  >
                    <i className="fas fa-file-csv"></i>
                    CSV
                  </button>
                  <button 
                    className="tool-btn secondary"
                    onClick={() => handleExportData('pdf')}
                    title="Exportar a PDF"
                  >
                    <i className="fas fa-file-pdf"></i>
                    PDF
                  </button>
                </div>
              </div>
            </div>

            {/* Configuraciones */}
            <div className="tool-card settings-card">
              <div className="tool-icon">
                <i className="fas fa-cog"></i>
              </div>
              <div className="tool-content">
                <h4>Configuraciones</h4>
                <p>Personaliza tu experiencia de enseñanza</p>
                <div className="tool-actions">
                  <button 
                    className="tool-btn primary"
                    onClick={() => navigate('/settings/voice')}
                    title="Configurar voz"
                  >
                    <i className="fas fa-volume-up"></i>
                    Voz
                  </button>
                  <button 
                    className="tool-btn secondary"
                    onClick={() => navigate('/profile')}
                    title="Editar perfil"
                  >
                    <i className="fas fa-user-edit"></i>
                    Perfil
                  </button>
                </div>
              </div>
            </div>

            {/* Recursos de Apoyo */}
            <div className="tool-card resources-card">
              <div className="tool-icon">
                <i className="fas fa-book-open"></i>
              </div>
              <div className="tool-content">
                <h4>Recursos</h4>
                <p>Guías y materiales de apoyo para profesores</p>
                <div className="tool-actions">
                  <button 
                    className="tool-btn primary"
                    onClick={() => handleOpenGuide()}
                    title="Guía del profesor"
                  >
                    <i className="fas fa-graduation-cap"></i>
                    Guía
                  </button>
                  <button 
                    className="tool-btn secondary"
                    onClick={() => navigate('/contact')}
                    title="Contactar soporte"
                  >
                    <i className="fas fa-question-circle"></i>
                    Ayuda
                  </button>
                </div>
              </div>
            </div>

            {/* Estadísticas Rápidas */}
            <div className="tool-card stats-card">
              <div className="tool-icon">
                <i className="fas fa-chart-bar"></i>
              </div>
              <div className="tool-content">
                <h4>Vista Rápida</h4>
                <p>Resumen de tu actividad docente</p>
                <div className="stats-summary">
                  <div className="stat-item">
                    <span className="stat-number">{materias.length}</span>
                    <span className="stat-label">Materias</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-number">
                      {materias.reduce((total, materia) => total + (materia.notebookCount || 0), 0)}
                    </span>
                    <span className="stat-label">Cuadernos</span>
                  </div>
                </div>
                <button 
                  className="tool-btn full-width"
                  onClick={() => navigate('/school/teacher/analytics')}
                  title="Ver analítica completa"
                >
                  <i className="fas fa-analytics"></i>
                  Ver Analítica
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
};

export default SchoolTeacherMateriasPage;