import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  arrayUnion,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';

interface TicketTransaction {
  id: string;
  timestamp: Date;
  type: 'earned' | 'spent' | 'daily_refresh';
  amount: number;
  gameId?: string;
  gameName?: string;
  description: string;
}

interface UserTickets {
  userId: string;
  availableTickets: number;
  lastRefreshDate: Date;
  ticketsUsedToday: number;
  totalTicketsEarned: number;
  totalTicketsSpent: number;
  ticketHistory: TicketTransaction[];
}

class TicketService {
  private readonly DAILY_TICKETS = 3;
  private readonly MAX_HISTORY_LENGTH = 50;

  /**
   * Obtiene o crea los datos de tickets para un usuario
   */
  async getUserTickets(userId: string): Promise<UserTickets> {
    try {
      const ticketDocRef = doc(db, 'userTickets', userId);
      const ticketDoc = await getDoc(ticketDocRef);
      
      if (!ticketDoc.exists()) {
        // Crear documento inicial con tickets
        const initialData: UserTickets = {
          userId,
          availableTickets: this.DAILY_TICKETS,
          lastRefreshDate: new Date(),
          ticketsUsedToday: 0,
          totalTicketsEarned: this.DAILY_TICKETS,
          totalTicketsSpent: 0,
          ticketHistory: [{
            id: this.generateId(),
            timestamp: new Date(),
            type: 'daily_refresh',
            amount: this.DAILY_TICKETS,
            description: 'Tickets diarios iniciales'
          }]
        };
        
        await setDoc(ticketDocRef, {
          ...initialData,
          lastRefreshDate: Timestamp.fromDate(initialData.lastRefreshDate),
          ticketHistory: initialData.ticketHistory.map(t => ({
            ...t,
            timestamp: Timestamp.fromDate(t.timestamp)
          }))
        });
        
        return initialData;
      }
      
      const data = ticketDoc.data();
      
      // Verificar si necesita refresh diario
      const userTickets: UserTickets = {
        ...data,
        lastRefreshDate: data.lastRefreshDate.toDate(),
        ticketHistory: data.ticketHistory.map((t: any) => ({
          ...t,
          timestamp: t.timestamp.toDate()
        }))
      } as UserTickets;
      
      // Comprobar si ha pasado un día desde el último refresh
      if (this.needsDailyRefresh(userTickets.lastRefreshDate)) {
        return await this.refreshDailyTickets(userId);
      }
      
      return userTickets;
    } catch (error) {
      console.error('Error obteniendo tickets:', error);
      throw error;
    }
  }

  /**
   * Consume un ticket para jugar
   */
  async consumeTicket(userId: string, gameId: string, gameName: string): Promise<boolean> {
    try {
      const userTickets = await this.getUserTickets(userId);
      
      if (userTickets.availableTickets <= 0) {
        return false; // No hay tickets disponibles
      }
      
      const transaction: TicketTransaction = {
        id: this.generateId(),
        timestamp: new Date(),
        type: 'spent',
        amount: -1,
        gameId,
        gameName,
        description: `Ticket usado en ${gameName}`
      };
      
      // Actualizar documento
      const ticketDocRef = doc(db, 'userTickets', userId);
      await updateDoc(ticketDocRef, {
        availableTickets: userTickets.availableTickets - 1,
        ticketsUsedToday: userTickets.ticketsUsedToday + 1,
        totalTicketsSpent: userTickets.totalTicketsSpent + 1,
        ticketHistory: arrayUnion({
          ...transaction,
          timestamp: Timestamp.fromDate(transaction.timestamp)
        })
      });
      
      // Limpiar historial si es muy largo
      if (userTickets.ticketHistory.length > this.MAX_HISTORY_LENGTH) {
        await this.cleanupHistory(userId);
      }
      
      return true;
    } catch (error) {
      console.error('Error consumiendo ticket:', error);
      return false;
    }
  }

  /**
   * Otorga tickets extra (por logros, bonificaciones, etc.)
   */
  async awardTickets(userId: string, amount: number, reason: string): Promise<void> {
    try {
      const userTickets = await this.getUserTickets(userId);
      
      const transaction: TicketTransaction = {
        id: this.generateId(),
        timestamp: new Date(),
        type: 'earned',
        amount: amount,
        description: reason
      };
      
      const ticketDocRef = doc(db, 'userTickets', userId);
      await updateDoc(ticketDocRef, {
        availableTickets: userTickets.availableTickets + amount,
        totalTicketsEarned: userTickets.totalTicketsEarned + amount,
        ticketHistory: arrayUnion({
          ...transaction,
          timestamp: Timestamp.fromDate(transaction.timestamp)
        })
      });
    } catch (error) {
      console.error('Error otorgando tickets:', error);
      throw error;
    }
  }

  /**
   * Verifica si necesita refresh diario
   */
  private needsDailyRefresh(lastRefreshDate: Date): boolean {
    const now = new Date();
    const lastRefresh = new Date(lastRefreshDate);
    
    // Establecer ambas fechas a medianoche para comparar solo días
    now.setHours(0, 0, 0, 0);
    lastRefresh.setHours(0, 0, 0, 0);
    
    return now > lastRefresh;
  }

  /**
   * Actualiza los tickets diarios
   */
  private async refreshDailyTickets(userId: string): Promise<UserTickets> {
    try {
      const transaction: TicketTransaction = {
        id: this.generateId(),
        timestamp: new Date(),
        type: 'daily_refresh',
        amount: this.DAILY_TICKETS,
        description: 'Tickets diarios'
      };
      
      const ticketDocRef = doc(db, 'userTickets', userId);
      const ticketDoc = await getDoc(ticketDocRef);
      const currentData = ticketDoc.data() as any;
      
      // Resetear a 3 tickets (no acumulativo)
      await updateDoc(ticketDocRef, {
        availableTickets: this.DAILY_TICKETS,
        lastRefreshDate: Timestamp.fromDate(new Date()),
        ticketsUsedToday: 0,
        totalTicketsEarned: currentData.totalTicketsEarned + this.DAILY_TICKETS,
        ticketHistory: arrayUnion({
          ...transaction,
          timestamp: Timestamp.fromDate(transaction.timestamp)
        })
      });
      
      return this.getUserTickets(userId);
    } catch (error) {
      console.error('Error actualizando tickets diarios:', error);
      throw error;
    }
  }

  /**
   * Limpia el historial manteniendo solo las últimas transacciones
   */
  private async cleanupHistory(userId: string): Promise<void> {
    try {
      const ticketDocRef = doc(db, 'userTickets', userId);
      const ticketDoc = await getDoc(ticketDocRef);
      const data = ticketDoc.data() as any;
      
      // Mantener solo las últimas 50 transacciones
      const sortedHistory = data.ticketHistory
        .sort((a: any, b: any) => b.timestamp.toMillis() - a.timestamp.toMillis())
        .slice(0, this.MAX_HISTORY_LENGTH);
      
      await updateDoc(ticketDocRef, {
        ticketHistory: sortedHistory
      });
    } catch (error) {
      console.error('Error limpiando historial:', error);
    }
  }

  /**
   * Calcula el tiempo hasta el próximo refresh
   */
  getTimeUntilNextRefresh(): { hours: number; minutes: number } {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const diff = tomorrow.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return { hours, minutes };
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const ticketService = new TicketService();