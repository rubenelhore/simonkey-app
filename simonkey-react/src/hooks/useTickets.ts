import { useState, useEffect } from 'react';
import { auth } from '../services/firebase';
import { ticketService } from '../services/ticketService';

interface TicketData {
  availableTickets: number;
  ticketsUsedToday: number;
  lastRefreshDate: Date;
  timeUntilNextRefresh: { hours: number; minutes: number };
}

export const useTickets = (notebookId?: string) => {
  const [tickets, setTickets] = useState<TicketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTickets = async () => {
    if (!auth.currentUser) {
      setError('Usuario no autenticado');
      setLoading(false);
      return;
    }

    if (!notebookId) {
      setError('No se especificó un cuaderno');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const notebookTickets = await ticketService.getNotebookTickets(auth.currentUser.uid, notebookId);
      
      setTickets({
        availableTickets: notebookTickets.availableTickets,
        ticketsUsedToday: notebookTickets.ticketsUsedToday,
        lastRefreshDate: notebookTickets.lastRefreshDate,
        timeUntilNextRefresh: ticketService.getTimeUntilNextRefresh()
      });
      setError(null);
    } catch (err) {
      console.error('Error cargando tickets:', err);
      setError('Error al cargar los tickets');
    } finally {
      setLoading(false);
    }
  };

  const consumeTicket = async (gameId: string, gameName: string): Promise<boolean> => {
    if (!auth.currentUser) {
      setError('Usuario no autenticado');
      return false;
    }

    if (!notebookId) {
      setError('No se especificó un cuaderno');
      return false;
    }

    try {
      const success = await ticketService.consumeTicket(auth.currentUser.uid, notebookId, gameId, gameName);
      if (success) {
        // Recargar tickets después de consumir
        await loadTickets();
      }
      return success;
    } catch (err) {
      console.error('Error consumiendo ticket:', err);
      setError('Error al consumir el ticket');
      return false;
    }
  };

  const awardTickets = async (amount: number, reason: string) => {
    if (!auth.currentUser) {
      setError('Usuario no autenticado');
      return;
    }

    if (!notebookId) {
      setError('No se especificó un cuaderno');
      return;
    }

    try {
      await ticketService.awardTickets(auth.currentUser.uid, notebookId, amount, reason);
      await loadTickets();
    } catch (err) {
      console.error('Error otorgando tickets:', err);
      setError('Error al otorgar tickets');
    }
  };

  useEffect(() => {
    if (notebookId) {
      loadTickets();
    }
  }, [notebookId]);

  // Actualizar el tiempo hasta el próximo refresh cada minuto
  useEffect(() => {
    const interval = setInterval(() => {
      if (tickets) {
        setTickets({
          ...tickets,
          timeUntilNextRefresh: ticketService.getTimeUntilNextRefresh()
        });
      }
    }, 60000); // Cada minuto

    return () => clearInterval(interval);
  }, [tickets]);

  return {
    tickets,
    loading,
    error,
    consumeTicket,
    awardTickets,
    refresh: loadTickets
  };
};