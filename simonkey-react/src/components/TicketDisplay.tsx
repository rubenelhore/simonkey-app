import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTicket, faClock } from '@fortawesome/free-solid-svg-icons';
import '../styles/TicketDisplay.css';

interface TicketDisplayProps {
  availableTickets: number;
  ticketsUsedToday: number;
  timeUntilNextRefresh: { hours: number; minutes: number };
  loading?: boolean;
}

const TicketDisplay: React.FC<TicketDisplayProps> = ({
  availableTickets,
  ticketsUsedToday,
  timeUntilNextRefresh,
  loading = false
}) => {
  const renderTickets = () => {
    const tickets = [];
    const totalTickets = 3; // Máximo de tickets diarios
    
    for (let i = 0; i < totalTickets; i++) {
      const isAvailable = i < availableTickets;
      tickets.push(
        <div 
          key={i} 
          className={`ticket-icon ${isAvailable ? 'available' : 'used'}`}
        >
          <FontAwesomeIcon icon={faTicket} />
        </div>
      );
    }
    
    return tickets;
  };

  if (loading) {
    return (
      <div className="ticket-display loading">
        <div className="ticket-skeleton"></div>
      </div>
    );
  }

  return (
    <div className="ticket-display">
      <div className="ticket-header">
        <h3>Tickets de este cuaderno</h3>
        <div className="ticket-count">
          <span className="count-number">{availableTickets}</span>
          <span className="count-total">/3 diarios</span>
        </div>
      </div>
      
      <div className="ticket-visual">
        {renderTickets()}
      </div>
      
      <div className="ticket-info">
        {availableTickets === 0 ? (
          <div className="no-tickets-message">
            <FontAwesomeIcon icon={faClock} className="clock-icon" />
            <p>Sin tickets disponibles</p>
            <p className="refresh-time">
              Nuevos tickets en: {timeUntilNextRefresh.hours}h {timeUntilNextRefresh.minutes}m
            </p>
          </div>
        ) : (
          <div className="tickets-available-message">
            <p>Cada juego cuesta 1 ticket</p>
            {ticketsUsedToday > 0 && (
              <p className="tickets-used">Has usado {ticketsUsedToday} ticket{ticketsUsedToday > 1 ? 's' : ''} hoy</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TicketDisplay;