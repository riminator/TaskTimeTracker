import axios from 'axios';
import logger from '../utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Time tracker connector - handles writing time entries to Jira
 */
class TrackerConnector {
  constructor() {
    this.jiraHost = process.env.JIRA_HOST;
    this.jiraEmail = process.env.JIRA_EMAIL;
    this.jiraApiToken = process.env.JIRA_API_TOKEN;
    this.initialized = false;
  }

  /**
   * Initialize the connector
   */
  async initialize() {
    try {
      if (!this.jiraHost || !this.jiraEmail || !this.jiraApiToken) {
        throw new Error('Missing required Jira credentials in environment variables');
      }

      // Test connection
      await this.testConnection();
      
      this.initialized = true;
      logger.info('Tracker connector initialized', { jiraHost: this.jiraHost });
    } catch (error) {
      logger.error('Failed to initialize tracker connector', { error: error.message });
      throw error;
    }
  }

  /**
   * Get Jira API client
   */
  getClient() {
    return axios.create({
      baseURL: `${this.jiraHost}/rest/api/3`,
      auth: {
        username: this.jiraEmail,
        password: this.jiraApiToken
      },
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Test Jira connection
   */
  async testConnection() {
    try {
      const client = this.getClient();
      const response = await client.get('/myself');
      logger.info('Jira connection test successful', { 
        user: response.data.displayName 
      });
      return { success: true, user: response.data };
    } catch (error) {
      logger.error('Jira connection test failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Search for Jira issues by project or JQL
   */
  async searchIssues(jql, maxResults = 50) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const client = this.getClient();
      const response = await client.post('/search', {
        jql,
        maxResults,
        fields: ['summary', 'status', 'assignee', 'project']
      });

      logger.info('Jira issues searched', { 
        jql, 
        count: response.data.issues.length 
      });

      return response.data.issues;
    } catch (error) {
      logger.error('Failed to search Jira issues', { 
        jql, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get issue details
   */
  async getIssue(issueKey) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const client = this.getClient();
      const response = await client.get(`/issue/${issueKey}`);

      return response.data;
    } catch (error) {
      logger.error('Failed to get Jira issue', { 
        issueKey, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Create a worklog entry for an issue
   */
  async createWorklog(issueKey, timeSpentSeconds, comment, started) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const client = this.getClient();
      
      const worklogData = {
        timeSpentSeconds,
        comment,
        started: started || new Date().toISOString()
      };

      const response = await client.post(
        `/issue/${issueKey}/worklog`,
        worklogData
      );

      logger.audit('worklog_created', {
        issueKey,
        timeSpentSeconds,
        worklogId: response.data.id
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to create worklog', { 
        issueKey, 
        timeSpentSeconds,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get worklogs for an issue
   */
  async getWorklogs(issueKey) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const client = this.getClient();
      const response = await client.get(`/issue/${issueKey}/worklog`);

      return response.data.worklogs;
    } catch (error) {
      logger.error('Failed to get worklogs', { 
        issueKey, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Update a worklog entry
   */
  async updateWorklog(issueKey, worklogId, timeSpentSeconds, comment) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const client = this.getClient();
      
      const worklogData = {
        timeSpentSeconds,
        comment
      };

      const response = await client.put(
        `/issue/${issueKey}/worklog/${worklogId}`,
        worklogData
      );

      logger.audit('worklog_updated', {
        issueKey,
        worklogId,
        timeSpentSeconds
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to update worklog', { 
        issueKey, 
        worklogId,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Delete a worklog entry
   */
  async deleteWorklog(issueKey, worklogId) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const client = this.getClient();
      await client.delete(`/issue/${issueKey}/worklog/${worklogId}`);

      logger.audit('worklog_deleted', {
        issueKey,
        worklogId
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to delete worklog', { 
        issueKey, 
        worklogId,
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get projects accessible to the user
   */
  async getProjects() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const client = this.getClient();
      const response = await client.get('/project/search');

      return response.data.values.map(project => ({
        key: project.key,
        name: project.name,
        id: project.id
      }));
    } catch (error) {
      logger.error('Failed to get projects', { error: error.message });
      throw error;
    }
  }

  /**
   * Format time duration for Jira (e.g., "2h 30m")
   */
  formatJiraTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0 && mins > 0) {
      return `${hours}h ${mins}m`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${mins}m`;
    }
  }

  /**
   * Convert minutes to seconds for Jira API
   */
  minutesToSeconds(minutes) {
    return minutes * 60;
  }

  /**
   * Batch create worklogs for multiple time entries
   */
  async batchCreateWorklogs(entries) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const results = [];
      const errors = [];

      for (const entry of entries) {
        try {
          const worklog = await this.createWorklog(
            entry.issueKey,
            this.minutesToSeconds(entry.durationMinutes),
            entry.comment,
            entry.started
          );
          results.push({
            success: true,
            entry,
            worklog
          });
        } catch (error) {
          errors.push({
            success: false,
            entry,
            error: error.message
          });
        }
      }

      logger.info('Batch worklog creation completed', {
        total: entries.length,
        successful: results.length,
        failed: errors.length
      });

      return {
        results,
        errors,
        summary: {
          total: entries.length,
          successful: results.length,
          failed: errors.length
        }
      };
    } catch (error) {
      logger.error('Failed to batch create worklogs', { error: error.message });
      throw error;
    }
  }
}

// Singleton instance
const trackerConnector = new TrackerConnector();

export default trackerConnector;

// Made with Bob
