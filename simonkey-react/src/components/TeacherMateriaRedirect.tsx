import React, { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

const TeacherMateriaRedirect: React.FC = () => {
  const { materiaId } = useParams<{ materiaId: string }>();
  const [materiaName, setMateriaName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMateriaName = async () => {
      if (!materiaId) {
        setLoading(false);
        return;
      }

      try {
        // Buscar la materia en schoolSubjects
        const materiaDoc = await getDoc(doc(db, 'schoolSubjects', materiaId));
        if (materiaDoc.exists()) {
          const data = materiaDoc.data();
          setMateriaName(data.nombre);
        }
      } catch (error) {
        console.error('Error fetching materia:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMateriaName();
  }, [materiaId]);

  if (loading) {
    return <div>Redirigiendo...</div>;
  }

  if (!materiaName) {
    return <Navigate to="/materias" replace />;
  }

  // Redirigir a la nueva ruta
  const encodedName = encodeURIComponent(materiaName);
  return <Navigate to={`/materias/${encodedName}/notebooks`} replace />;
};

export default TeacherMateriaRedirect;