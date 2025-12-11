import React, { useState, useEffect } from 'react';
import { FiChevronLeft, FiChevronRight, FiPlus, FiCalendar } from 'react-icons/fi';
import { calendarService } from '../services/calendarService';
import { LoadingSpinner } from './LoadingSpinner';
import '../css/Calendar.css';

function Calendar({ onEventClick, onDateClick }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    loadEvents();
  }, [currentDate]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const monthEvents = await calendarService.getEvents(startOfMonth, endOfMonth);
      setEvents(monthEvents);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek };
  };

  const getEventsForDate = (date) => {
    return events.filter(event => {
      const eventDate = new Date(event.startDate);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const today = () => {
    setCurrentDate(new Date());
  };

  const handleDateClick = (date) => {
    setSelectedDate(date);
    if (onDateClick) {
      onDateClick(date);
    }
  };

  const { daysInMonth, startingDayOfWeek } = getDaysInMonth();
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Generate calendar grid
  const calendarDays = [];
  
  // Empty cells for days before month starts
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(<div key={`empty-${i}`} className="calendar-day empty" />);
  }

  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dayEvents = getEventsForDate(date);
    const isToday = date.toDateString() === new Date().toDateString();
    const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();

    calendarDays.push(
      <div
        key={day}
        className={`calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${dayEvents.length > 0 ? 'has-events' : ''}`}
        onClick={() => handleDateClick(date)}
      >
        <div className="day-number">{day}</div>
        {dayEvents.length > 0 && (
          <div className="day-events">
            {dayEvents.slice(0, 2).map((event, index) => (
              <div
                key={index}
                className={`event-dot ${event.type}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onEventClick) onEventClick(event);
                }}
                title={event.title}
              />
            ))}
            {dayEvents.length > 2 && (
              <span className="more-events">+{dayEvents.length - 2}</span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="calendar-widget">
      <div className="calendar-header">
        <button onClick={previousMonth} className="btn-nav" aria-label="Previous month">
          <FiChevronLeft />
        </button>
        <h3>{monthName}</h3>
        <button onClick={nextMonth} className="btn-nav" aria-label="Next month">
          <FiChevronRight />
        </button>
        <button onClick={today} className="btn btn-secondary btn-small">
          Today
        </button>
      </div>

      {loading ? (
        <div className="calendar-loading">
          <LoadingSpinner />
        </div>
      ) : (
        <>
          <div className="calendar-weekdays">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>
          <div className="calendar-grid">
            {calendarDays}
          </div>
        </>
      )}

      <div className="calendar-legend">
        <div className="legend-item">
          <span className="legend-dot interview"></span>
          Interview
        </div>
        <div className="legend-item">
          <span className="legend-dot visa_appointment"></span>
          Visa Appointment
        </div>
        <div className="legend-item">
          <span className="legend-dot meeting"></span>
          Meeting
        </div>
        <div className="legend-item">
          <span className="legend-dot follow_up"></span>
          Follow-up
        </div>
      </div>
    </div>
  );
}

export default Calendar;
import React, { useState, useEffect } from 'react';