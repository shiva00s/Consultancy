import { sanitizeText } from '../utils/sanitize';
import { notificationService } from './notificationService';
import useAuthStore from '../store/useAuthStore';

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
      // create a persisted notification for this scheduled event
      try {
        const currentUser = useAuthStore.getState().user;
        await notificationService.createNotification({
          title: `📅 ${sanitizedData.title}`,
          message: sanitizedData.description || `Scheduled ${sanitizedData.type}`,
          type: 'reminder',
          priority: 'normal',
          link: sanitizedData.candidateId ? `/candidate/${sanitizedData.candidateId}` : null,
          actor: { id: currentUser?.id, name: currentUser?.name || currentUser?.username },
          target: { type: 'calendar_event', id: result?.event?.id || null },
          meta: { candidateId: sanitizedData.candidateId, startDate: sanitizedData.startDate, eventType: sanitizedData.type },
        });
      } catch (e) {}

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

      try {
        const currentUser = useAuthStore.getState().user;
        await notificationService.createNotification({
          title: `✏️ Calendar event updated`,
          message: `Event updated: ${updates.title || eventId}`,
          type: 'info',
          priority: 'normal',
          link: updates.candidateId ? `/candidate/${updates.candidateId}` : null,
          actor: { id: currentUser?.id, name: currentUser?.name || currentUser?.username },
          target: { type: 'calendar_event', id: eventId },
          meta: { updates },
        });
      } catch (e) {}

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

      try {
        const currentUser = useAuthStore.getState().user;
        await notificationService.createNotification({
          title: `🗑️ Calendar event deleted`,
          message: `Event ${eventId} was deleted`,
          type: 'warning',
          priority: 'high',
          actor: { id: currentUser?.id, name: currentUser?.name || currentUser?.username },
          target: { type: 'calendar_event', id: eventId },
          meta: {},
        });
      } catch (e) {}

      return result;
    } catch (error) {
      console.error('Error deleting event:', error);
      throw error;
    }
  }

  /**
   * Start periodic monitor to fetch upcoming reminders from main and create notifications.
   * This complements the app-wide reminder check so critical schedules (interview, payment, travel, medical, visa, passport)
   * surface as notifications and are not missed.
   */
  startReminderMonitor(pollIntervalMs = 60000) {
    // do not start multiple intervals
    if (this._reminderInterval) return;
    this._reminderInterval = setInterval(async () => {
      try {
        const reminders = await this.getUpcomingReminders();
        if (Array.isArray(reminders) && reminders.length > 0) {
          for (const r of reminders) {
            try {
              await notificationService.createNotification({
                title: `Reminder: ${r.title}`,
                message: r.message || '',
                type: 'reminder',
                priority: r.priority || 'high',
                link: r.link || null,
                target: { type: r.targetType || 'reminder', id: r.id || null },
                meta: { candidateId: r.candidateId, remindAt: r.remindAt },
              });
            } catch (e) {}
          }
        }
      } catch (e) {
        console.error('Reminder monitor failed:', e);
      }
    }, pollIntervalMs);
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