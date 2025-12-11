import { sanitizeText } from '../utils/sanitize';

class CalendarService {
  /**
   * Create appointment/event
   */
  async createEvent(eventData) {
    try {
      const sanitizedData = {
        title: sanitizeText(eventData.title),
        description: sanitizeText(eventData.description || ''),
        startDate: eventData.startDate,
        endDate: eventData.endDate,
        type: eventData.type, // interview, visa_appointment, meeting, follow_up
        candidateId: eventData.candidateId,
        location: sanitizeText(eventData.location || ''),
        attendees: eventData.attendees || [],
        reminderMinutes: eventData.reminderMinutes || 60,
      };

      const result = await window.electronAPI.createCalendarEvent(sanitizedData);
      return result;
    } catch (error) {
      console.error('Error creating event:', error);
      throw error;
    }
  }

  /**
   * Get events for date range
   */
  async getEvents(startDate, endDate) {
    try {
      const result = await window.electronAPI.getCalendarEvents({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      return result.success ? result.events : [];
    } catch (error) {
      console.error('Error fetching events:', error);
      return [];
    }
  }

  /**
   * Update event
   */
  async updateEvent(eventId, updates) {
    try {
      const result = await window.electronAPI.updateCalendarEvent({
        eventId,
        updates,
      });

      return result;
    } catch (error) {
      console.error('Error updating event:', error);
      throw error;
    }
  }

  /**
   * Delete event
   */
  async deleteEvent(eventId) {
    try {
      const result = await window.electronAPI.deleteCalendarEvent({ eventId });
      return result;
    } catch (error) {
      console.error('Error deleting event:', error);
      throw error;
    }
  }

  /**
   * Get upcoming reminders
   */
  async getUpcomingReminders() {
    try {
      const result = await window.electronAPI.getUpcomingReminders();
      return result.success ? result.reminders : [];
    } catch (error) {
      console.error('Error fetching reminders:', error);
      return [];
    }
  }

  /**
   * Schedule interview
   */
  async scheduleInterview(candidateId, interviewData) {
    return this.createEvent({
      ...interviewData,
      type: 'interview',
      candidateId,
      title: `Interview: ${interviewData.candidateName}`,
    });
  }

  /**
   * Schedule visa appointment
   */
  async scheduleVisaAppointment(candidateId, appointmentData) {
    return this.createEvent({
      ...appointmentData,
      type: 'visa_appointment',
      candidateId,
      title: `Visa Appointment: ${appointmentData.candidateName}`,
    });
  }
}

export const calendarService = new CalendarService();
// Phone number: E.164 format
// Optional, can be empty string