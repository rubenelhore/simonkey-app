import { useState, useEffect } from 'react';
import { auth } from '../services/firebase';
import { ticketService } from '../services/ticketService';

interface TicketData {
  availableTickets: number;
  ticketsUsedToday: number;
  lastRefreshDate: Date;
  timeUntilNextRefresh: { hours: number; minutes: number };
}

export const useTickets = () => {
  const [tickets, setTickets] = useState<TicketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTickets = async () => {
    if (!auth.currentUser) {
      setError('Usuario no autenticado');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const userTickets = await ticketService.getUserTickets(auth.currentUser.uid);
      
      setTickets({
        availableTickets: userTickets.availableTickets,
        ticketsUsedToday: userTickets.ticketsUsedToday,
        lastRefreshDate: userTickets.lastRefreshDate,
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

    try {
      const success = await ticketService.consumeTicket(auth.currentUser.uid, gameId, gameName);
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

    try {
      await ticketService.awardTickets(auth.currentUser.uid, amount, reason);
      await loadTickets();
    } catch (err) {
      console.error('Error otorgando tickets:', err);
      setError('Error al otorgar tickets');
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

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