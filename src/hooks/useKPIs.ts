import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAuth } from '@/contexts/AuthContext';
import type { DashboardKPIs } from '@/types/kpis';
import { kpiService } from '@/lib/kpis/kpiService';

export function useUserKPIs() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const kpiRef = doc(db, 'users', user.uid, 'kpis', 'dashboard');

    const unsubscribe = onSnapshot(
      kpiRef,
      (doc) => {
        if (doc.exists()) {
          setKpis(doc.data() as DashboardKPIs);
        } else {
          setKpis(null);
        }
        setLoading(false);
        setError(null);
      },
      (error) => {
        console.error('Error fetching KPIs:', error);
        setError(error.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  return { kpis, loading, error };
}

export function useNotebookKPIs(notebookId: string) {
  const { kpis } = useUserKPIs();
  
  if (!kpis || !notebookId) return null;
  
  return kpis.cuadernos[notebookId] || null;
}

export function useSubjectKPIs(subjectId: string) {
  const { kpis } = useUserKPIs();
  
  if (!kpis || !subjectId || !kpis.materias) return null;
  
  return kpis.materias[subjectId] || null;
}

export function useRankingTable(materiaId?: string, limit: number = 50) {
  const [rankings, setRankings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRankings = async () => {
      try {
        setLoading(true);
        const data = await kpiService.getGeneralRankingTable(materiaId, limit);
        setRankings(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching rankings:', err);
        setError('Error al cargar el ranking');
      } finally {
        setLoading(false);
      }
    };

    fetchRankings();
  }, [materiaId, limit]);

  return { rankings, loading, error };
}

// Hook para el histograma de tiempo de estudio
export function useStudyTimeHistogram() {
  const { kpis } = useUserKPIs();
  
  if (!kpis) return null;
  
  return kpis.histogramaSemanal;
}

// Hook para el histórico de posiciones
export function usePositionHistory(materiaId: string) {
  const { kpis } = useUserKPIs();
  
  if (!kpis || !materiaId || !kpis.historicosPosiciones) return null;
  
  return kpis.historicosPosiciones[materiaId] || [];
}