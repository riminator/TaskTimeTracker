import graphClient from '../auth/graph-client.js';
import logger from '../utils/logger.js';

/**
 * Teams meeting connector - handles fetching and normalizing meeting data
 */
class TeamsConnector {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize the connector
   */
  async initialize() {
    try {
      await graphClient.initialize();
      this.initialized = true;
      logger.info('Teams connector initialized');
    } catch (error) {
      logger.error('Failed to initialize Teams connector', { error: error.message });
      throw error;
    }
  }

  /**
   * Normalize a Graph API calendar event to internal meeting format
   */
  normalizeMeeting(event, userEmail) {
    const startTime = new Date(event.start.dateTime + 'Z');
    const endTime = new Date(event.end.dateTime + 'Z');
    const durationMinutes = Math.round((endTime - startTime) / 60000);

    // Determine if user accepted the meeting
    const userResponse = event.responseStatus?.response || 'none';
    const userAccepted = userResponse === 'accepted' || userResponse === 'organizer';

    return {
      meetingId: event.id,
      title: event.subject || 'Untitled Meeting',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      durationMinutes,
      organizer: {
        email: event.organizer?.emailAddress?.address,
        name: event.organizer?.emailAddress?.name
      },
      attendees: (event.attendees || []).map(a => ({
        email: a.emailAddress?.address,
        name: a.emailAddress?.name,
        type: a.type,
        response: a.status?.response
      })),
      isOnlineMeeting: event.isOnlineMeeting || false,
      isCancelled: event.isCancelled || false,
      categories: event.categories || [],
      userResponse,
      userAccepted,
      onlineMeetingUrl: event.onlineMeeting?.joinUrl,
      // Placeholder for attendance data (requires separate API call)
      attendance: null
    };
  }

  /**
   * Get meetings for a user within a date range
   */
  async getMeetings(userEmail, startDate, endDate, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const {
        includeCancelled = false,
        includeDeclined = false,
        onlineOnly = false
      } = options;

      logger.info('Fetching meetings', { 
        userEmail, 
        startDate: startDate.toISOString(), 
        endDate: endDate.toISOString(),
        options
      });

      const events = await graphClient.getCalendarEvents(userEmail, startDate, endDate);
      
      // Normalize and filter meetings
      let meetings = events.map(event => this.normalizeMeeting(event, userEmail));

      // Apply filters
      if (!includeCancelled) {
        meetings = meetings.filter(m => !m.isCancelled);
      }

      if (!includeDeclined) {
        meetings = meetings.filter(m => m.userAccepted);
      }

      if (onlineOnly) {
        meetings = meetings.filter(m => m.isOnlineMeeting);
      }

      logger.info('Meetings retrieved and normalized', { 
        userEmail,
        totalCount: events.length,
        filteredCount: meetings.length
      });

      return meetings;
    } catch (error) {
      logger.error('Failed to get meetings', { 
        userEmail, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get detailed attendance information for a meeting
   */
  async getMeetingAttendance(userEmail, meetingId) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      logger.info('Fetching meeting attendance', { userEmail, meetingId });

      const details = await graphClient.getOnlineMeetingDetails(userEmail, meetingId);
      
      if (!details.attendanceReports || details.attendanceReports.length === 0) {
        logger.warn('No attendance reports available', { meetingId });
        return null;
      }

      // Get the most recent attendance report
      const report = details.attendanceReports[0];
      
      // Find user's attendance record
      const userAttendance = report.attendanceRecords?.find(
        record => record.emailAddress?.toLowerCase() === userEmail.toLowerCase()
      );

      if (!userAttendance) {
        logger.warn('User attendance record not found', { userEmail, meetingId });
        return null;
      }

      const joinedAt = new Date(userAttendance.joinDateTime);
      const leftAt = new Date(userAttendance.leaveDateTime);
      const attendanceMinutes = Math.round((leftAt - joinedAt) / 60000);

      return {
        joinedAt: joinedAt.toISOString(),
        leftAt: leftAt.toISOString(),
        attendanceMinutes,
        totalParticipants: report.attendanceRecords?.length || 0
      };
    } catch (error) {
      logger.error('Failed to get meeting attendance', { 
        userEmail, 
        meetingId, 
        error: error.message 
      });
      // Don't throw - attendance data is optional
      return null;
    }
  }

  /**
   * Enrich meetings with attendance data
   */
  async enrichMeetingsWithAttendance(userEmail, meetings) {
    try {
      const enrichedMeetings = [];

      for (const meeting of meetings) {
        if (meeting.isOnlineMeeting && !meeting.isCancelled) {
          const attendance = await this.getMeetingAttendance(userEmail, meeting.meetingId);
          enrichedMeetings.push({
            ...meeting,
            attendance
          });
        } else {
          enrichedMeetings.push(meeting);
        }
      }

      return enrichedMeetings;
    } catch (error) {
      logger.error('Failed to enrich meetings with attendance', { 
        userEmail, 
        error: error.message 
      });
      // Return original meetings if enrichment fails
      return meetings;
    }
  }

  /**
   * Get meetings for today
   */
  async getTodaysMeetings(userEmail, options = {}) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    return this.getMeetings(userEmail, startOfDay, endOfDay, options);
  }

  /**
   * Get meetings for current week
   */
  async getWeeksMeetings(userEmail, options = {}) {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return this.getMeetings(userEmail, startOfWeek, endOfWeek, options);
  }

  /**
   * Detect overlapping meetings
   */
  detectOverlaps(meetings) {
    const overlaps = [];
    const sorted = [...meetings].sort((a, b) => 
      new Date(a.startTime) - new Date(b.startTime)
    );

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      
      const currentEnd = new Date(current.endTime);
      const nextStart = new Date(next.startTime);

      if (currentEnd > nextStart) {
        overlaps.push({
          meeting1: current,
          meeting2: next,
          overlapMinutes: Math.round((currentEnd - nextStart) / 60000)
        });
      }
    }

    if (overlaps.length > 0) {
      logger.warn('Detected overlapping meetings', { count: overlaps.length });
    }

    return overlaps;
  }
}

// Singleton instance
const teamsConnector = new TeamsConnector();

export default teamsConnector;

// Made with Bob
