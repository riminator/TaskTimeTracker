import { ClientSecretCredential } from '@azure/identity';
import { Client } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

/**
 * Microsoft Graph API client with authentication
 */
class GraphClient {
  constructor() {
    this.client = null;
    this.credential = null;
    this.initialized = false;
  }

  /**
   * Initialize the Graph client with credentials
   */
  async initialize() {
    try {
      const tenantId = process.env.MICROSOFT_TENANT_ID;
      const clientId = process.env.MICROSOFT_CLIENT_ID;
      const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

      if (!tenantId || !clientId || !clientSecret) {
        throw new Error('Missing required Microsoft Graph credentials in environment variables');
      }

      // Create credential
      this.credential = new ClientSecretCredential(
        tenantId,
        clientId,
        clientSecret
      );

      // Create authentication provider
      const authProvider = new TokenCredentialAuthenticationProvider(
        this.credential,
        {
          scopes: ['https://graph.microsoft.com/.default']
        }
      );

      // Initialize Graph client
      this.client = Client.initWithMiddleware({
        authProvider
      });

      this.initialized = true;
      logger.info('Microsoft Graph client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Microsoft Graph client', { error: error.message });
      throw error;
    }
  }

  /**
   * Get the Graph client instance
   */
  getClient() {
    if (!this.initialized || !this.client) {
      throw new Error('Graph client not initialized. Call initialize() first.');
    }
    return this.client;
  }

  /**
   * Test the connection by fetching user profile
   */
  async testConnection(userEmail) {
    try {
      const client = this.getClient();
      const user = await client
        .api(`/users/${userEmail}`)
        .select('displayName,mail,id')
        .get();
      
      logger.info('Graph API connection test successful', { user: user.displayName });
      return { success: true, user };
    } catch (error) {
      logger.error('Graph API connection test failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get calendar events for a user
   */
  async getCalendarEvents(userEmail, startDate, endDate) {
    try {
      const client = this.getClient();
      
      const events = await client
        .api(`/users/${userEmail}/calendar/calendarView`)
        .query({
          startDateTime: startDate.toISOString(),
          endDateTime: endDate.toISOString(),
          $select: 'subject,start,end,organizer,attendees,isOnlineMeeting,onlineMeeting,isCancelled,responseStatus,categories',
          $orderby: 'start/dateTime',
          $top: 1000
        })
        .get();

      logger.info('Retrieved calendar events', { 
        userEmail, 
        count: events.value.length,
        dateRange: `${startDate.toISOString()} to ${endDate.toISOString()}`
      });

      return events.value;
    } catch (error) {
      logger.error('Failed to retrieve calendar events', { 
        userEmail, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get online meeting details including attendance (if available)
   */
  async getOnlineMeetingDetails(userEmail, meetingId) {
    try {
      const client = this.getClient();
      
      // Note: Attendance reports require specific permissions and meeting settings
      const meeting = await client
        .api(`/users/${userEmail}/onlineMeetings/${meetingId}`)
        .get();

      // Try to get attendance report if available
      let attendanceReports = null;
      try {
        attendanceReports = await client
          .api(`/users/${userEmail}/onlineMeetings/${meetingId}/attendanceReports`)
          .get();
      } catch (attendanceError) {
        logger.warn('Attendance reports not available for meeting', { 
          meetingId,
          reason: attendanceError.message 
        });
      }

      return {
        meeting,
        attendanceReports: attendanceReports?.value || null
      };
    } catch (error) {
      logger.error('Failed to retrieve online meeting details', { 
        meetingId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get user's presence information
   */
  async getUserPresence(userEmail) {
    try {
      const client = this.getClient();
      
      const presence = await client
        .api(`/users/${userEmail}/presence`)
        .get();

      return presence;
    } catch (error) {
      logger.error('Failed to retrieve user presence', { 
        userEmail, 
        error: error.message 
      });
      throw error;
    }
  }
}

// Singleton instance
const graphClient = new GraphClient();

export default graphClient;

// Made with Bob
