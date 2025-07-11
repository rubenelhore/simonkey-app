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

interface NotebookTickets {
  notebookId: string;
  availableTickets: number;
  lastRefreshDate: Date;
  ticketsUsedToday: number;
  totalTicketsEarned: number;
  totalTicketsSpent: number;
  ticketHistory: TicketTransaction[];
}

interface UserTickets {
  userId: string;
  notebookTickets: { [notebookId: string]: NotebookTickets };
}

class TicketService {
  private readonly DAILY_TICKETS = 3;
  private readonly MAX_HISTORY_LENGTH = 50;

  /**
   * Obtiene o crea los datos de tickets para un cuaderno específico
   */
  async getNotebookTickets(userId: string, notebookId: string): Promise<NotebookTickets> {
    try {
      const ticketDocRef = doc(db, 'userTickets', userId);
      const ticketDoc = await getDoc(ticketDocRef);
      
      if (!ticketDoc.exists()) {
        // Crear documento inicial
        const initialData: UserTickets = {
          userId,
          notebookTickets: {}
        };
        await setDoc(ticketDocRef, initialData);
      }
      
      const userData = ticketDoc.exists() ? ticketDoc.data() as UserTickets : { userId, notebookTickets: {} };
      
      // Verificar si existe información para este cuaderno
      if (!userData.notebookTickets || !userData.notebookTickets[notebookId]) {
        // Crear datos iniciales para este cuaderno
        const notebookData: NotebookTickets = {
          notebookId,
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
        
        await updateDoc(ticketDocRef, {
          [`notebookTickets.${notebookId}`]: {
            ...notebookData,
            lastRefreshDate: Timestamp.fromDate(notebookData.lastRefreshDate),
            ticketHistory: notebookData.ticketHistory.map(t => ({
              ...t,
              timestamp: Timestamp.fromDate(t.timestamp)
            }))
          }
        });
        
        return notebookData;
      }
      
      const notebookData = userData.notebookTickets[notebookId] as any;
      
      // Convertir timestamps
      const notebookTickets: NotebookTickets = {
        ...notebookData,
        lastRefreshDate: notebookData.lastRefreshDate instanceof Date 
          ? notebookData.lastRefreshDate 
          : notebookData.lastRefreshDate.toDate(),
        ticketHistory: notebookData.ticketHistory.map((t: any) => ({
          ...t,
          timestamp: t.timestamp instanceof Date 
            ? t.timestamp 
            : t.timestamp.toDate()
        }))
      };
      
      // Comprobar si ha pasado un día desde el último refresh
      if (this.needsDailyRefresh(notebookTickets.lastRefreshDate)) {
        return await this.refreshDailyTickets(userId, notebookId);
      }
      
      return notebookTickets;
    } catch (error) {
      console.error('Error obteniendo tickets:', error);
      throw error;
    }
  }

  /**
   * Consume un ticket para jugar
   */
  async consumeTicket(userId: string, notebookId: string, gameId: string, gameName: string): Promise<boolean> {
    try {
      const notebookTickets = await this.getNotebookTickets(userId, notebookId);
      
      if (notebookTickets.availableTickets <= 0) {
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
        [`notebookTickets.${notebookId}.availableTickets`]: notebookTickets.availableTickets - 1,
        [`notebookTickets.${notebookId}.ticketsUsedToday`]: notebookTickets.ticketsUsedToday + 1,
        [`notebookTickets.${notebookId}.totalTicketsSpent`]: notebookTickets.totalTicketsSpent + 1,
        [`notebookTickets.${notebookId}.ticketHistory`]: arrayUnion({
          ...transaction,
          timestamp: Timestamp.fromDate(transaction.timestamp)
        })
      });
      
      // Limpiar historial si es muy largo
      if (notebookTickets.ticketHistory.length > this.MAX_HISTORY_LENGTH) {
        await this.cleanupHistory(userId, notebookId);
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
  async awardTickets(userId: string, notebookId: string, amount: number, reason: string): Promise<void> {
    try {
      const notebookTickets = await this.getNotebookTickets(userId, notebookId);
      
      const transaction: TicketTransaction = {
        id: this.generateId(),
        timestamp: new Date(),
        type: 'earned',
        amount: amount,
        description: reason
      };
      
      const ticketDocRef = doc(db, 'userTickets', userId);
      await updateDoc(ticketDocRef, {
        [`notebookTickets.${notebookId}.availableTickets`]: notebookTickets.availableTickets + amount,
        [`notebookTickets.${notebookId}.totalTicketsEarned`]: notebookTickets.totalTicketsEarned + amount,
        [`notebookTickets.${notebookId}.ticketHistory`]: arrayUnion({
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
  private async refreshDailyTickets(userId: string, notebookId: string): Promise<NotebookTickets> {
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
      const currentData = ticketDoc.data() as UserTickets;
      const currentNotebookData = currentData.notebookTickets[notebookId];
      
      // Resetear a 3 tickets (no acumulativo)
      await updateDoc(ticketDocRef, {
        [`notebookTickets.${notebookId}.availableTickets`]: this.DAILY_TICKETS,
        [`notebookTickets.${notebookId}.lastRefreshDate`]: Timestamp.fromDate(new Date()),
        [`notebookTickets.${notebookId}.ticketsUsedToday`]: 0,
        [`notebookTickets.${notebookId}.totalTicketsEarned`]: currentNotebookData.totalTicketsEarned + this.DAILY_TICKETS,
        [`notebookTickets.${notebookId}.ticketHistory`]: arrayUnion({
          ...transaction,
          timestamp: Timestamp.fromDate(transaction.timestamp)
        })
      });
      
      return this.getNotebookTickets(userId, notebookId);
    } catch (error) {
      console.error('Error actualizando tickets diarios:', error);
      throw error;
    }
  }

  /**
   * Limpia el historial manteniendo solo las últimas transacciones
   */
  private async cleanupHistory(userId: string, notebookId: string): Promise<void> {
    try {
      const ticketDocRef = doc(db, 'userTickets', userId);
      const ticketDoc = await getDoc(ticketDocRef);
      const data = ticketDoc.data() as UserTickets;
      const notebookData = data.notebookTickets[notebookId];
      
      // Mantener solo las últimas 50 transacciones
      const sortedHistory = notebookData.ticketHistory
        .sort((a: any, b: any) => b.timestamp.toMillis() - a.timestamp.toMillis())
        .slice(0, this.MAX_HISTORY_LENGTH);
      
      await updateDoc(ticketDocRef, {
        [`notebookTickets.${notebookId}.ticketHistory`]: sortedHistory
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