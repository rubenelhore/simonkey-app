import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUserType } from '../hooks/useUserType';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import HeaderWithHamburger from '../components/HeaderWithHamburger';
import StreakTracker from '../components/StreakTracker';
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
    navigate(`/school/teacher/materias/${materiaId}/notebooks`);
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
          <StreakTracker />
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
      </main>
      <footer className="materias-footer">
        <p>&copy; {new Date().getFullYear()} Simonkey - Sistema Escolar</p>
      </footer>
    </>
  );
};

export default SchoolTeacherMateriasPage;