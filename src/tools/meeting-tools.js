import teamsConnector from '../connectors/teams.js';
import classificationEngine from '../rules/classification.js';
import timeAllocationEngine from '../rules/time-allocation.js';
import trackerConnector from '../connectors/tracker.js';
import logger from '../utils/logger.js';
import Joi from 'joi';

/**
 * Validate input parameters using Joi
 */
const validateInput = (schema, data) => {
  const { error, value } = schema.validate(data);
  if (error) {
    throw new Error(`Validation error: ${error.details[0].message}`);
  }
  return value;
};

/**
 * List recent meetings for a user
 */
export const listRecentMeetings = {
  name: 'list_recent_meetings',
  description: 'Retrieve calendar meetings for a user within a specified date range',
  inputSchema: {
    type: 'object',
    properties: {
      userEmail: {
        type: 'string',
        description: 'Email address of the user'
      },
      startDate: {
        type: 'string',
        description: 'Start date in ISO 8601 format (e.g., 2026-06-16T00:00:00Z)'
      },
      endDate: {
        type: 'string',
        description: 'End date in ISO 8601 format (e.g., 2026-06-16T23:59:59Z)'
      },
      includeCancelled: {
        type: 'boolean',
        description: 'Include cancelled meetings',
        default: false
      },
      includeDeclined: {
        type: 'boolean',
        description: 'Include meetings the user declined',
        default: false
      },
      onlineOnly: {
        type: 'boolean',
        description: 'Only include online meetings',
        default: false
      }
    },
    required: ['userEmail', 'startDate', 'endDate']
  },
  execute: async (args) => {
    const schema = Joi.object({
      userEmail: Joi.string().email().required(),
      startDate: Joi.string().isoDate().required(),
      endDate: Joi.string().isoDate().required(),
      includeCancelled: Joi.boolean().default(false),
      includeDeclined: Joi.boolean().default(false),
      onlineOnly: Joi.boolean().default(false)
    });

    const validated = validateInput(schema, args);

    logger.info('Executing list_recent_meetings', { userEmail: validated.userEmail });

    const meetings = await teamsConnector.getMeetings(
      validated.userEmail,
      new Date(validated.startDate),
      new Date(validated.endDate),
      {
        includeCancelled: validated.includeCancelled,
        includeDeclined: validated.includeDeclined,
        onlineOnly: validated.onlineOnly
      }
    );

    return {
      success: true,
      count: meetings.length,
      meetings
    };
  }
};

/**
 * Get detailed meeting attendance information
 */
export const getMeetingAttendance = {
  name: 'get_meeting_attendance',
  description: 'Retrieve attendance details for a specific online meeting',
  inputSchema: {
    type: 'object',
    properties: {
      userEmail: {
        type: 'string',
        description: 'Email address of the user'
      },
      meetingId: {
        type: 'string',
        description: 'ID of the meeting'
      }
    },
    required: ['userEmail', 'meetingId']
  },
  execute: async (args) => {
    const schema = Joi.object({
      userEmail: Joi.string().email().required(),
      meetingId: Joi.string().required()
    });

    const validated = validateInput(schema, args);

    logger.info('Executing get_meeting_attendance', { 
      userEmail: validated.userEmail,
      meetingId: validated.meetingId
    });

    const attendance = await teamsConnector.getMeetingAttendance(
      validated.userEmail,
      validated.meetingId
    );

    return {
      success: true,
      attendance
    };
  }
};

/**
 * Classify meetings and suggest time entries
 */
export const suggestTimeEntries = {
  name: 'suggest_time_entries',
  description: 'Analyze meetings and generate suggested time tracking entries with project/task classification',
  inputSchema: {
    type: 'object',
    properties: {
      userEmail: {
        type: 'string',
        description: 'Email address of the user'
      },
      startDate: {
        type: 'string',
        description: 'Start date in ISO 8601 format'
      },
      endDate: {
        type: 'string',
        description: 'End date in ISO 8601 format'
      },
      includeAttendance: {
        type: 'boolean',
        description: 'Enrich with attendance data (slower)',
        default: false
      },
      minConfidence: {
        type: 'number',
        description: 'Minimum confidence threshold (0-1)',
        default: 0.3
      }
    },
    required: ['userEmail', 'startDate', 'endDate']
  },
  execute: async (args) => {
    const schema = Joi.object({
      userEmail: Joi.string().email().required(),
      startDate: Joi.string().isoDate().required(),
      endDate: Joi.string().isoDate().required(),
      includeAttendance: Joi.boolean().default(false),
      minConfidence: Joi.number().min(0).max(1).default(0.3)
    });

    const validated = validateInput(schema, args);

    logger.info('Executing suggest_time_entries', { userEmail: validated.userEmail });

    // Initialize engines
    await classificationEngine.initialize();
    await timeAllocationEngine.initialize();

    // Get meetings
    let meetings = await teamsConnector.getMeetings(
      validated.userEmail,
      new Date(validated.startDate),
      new Date(validated.endDate),
      { includeCancelled: false, includeDeclined: false }
    );

    // Optionally enrich with attendance
    if (validated.includeAttendance) {
      meetings = await teamsConnector.enrichMeetingsWithAttendance(
        validated.userEmail,
        meetings
      );
    }

    // Classify meetings
    const classified = classificationEngine.classifyMeetings(meetings);

    // Process time allocations
    const processed = timeAllocationEngine.processAllMeetings(classified.included);

    // Generate time entries
    const suggestions = processed.meetings
      .filter(m => m.classification.confidence >= validated.minConfidence)
      .map(m => timeAllocationEngine.generateTimeEntry(m));

    // Group by project
    const byProject = classificationEngine.groupByProject(processed.meetings);

    return {
      success: true,
      summary: {
        totalMeetings: meetings.length,
        includedMeetings: classified.included.length,
        excludedMeetings: classified.excluded.length,
        suggestedEntries: suggestions.length,
        totalMinutes: processed.summary.totalAdjustedMinutes
      },
      suggestions,
      byProject,
      excluded: classified.excluded.map(m => ({
        title: m.title,
        reason: m.classification.reason
      }))
    };
  }
};

/**
 * Create time tracking entries
 */
export const createTimeEntries = {
  name: 'create_time_entries',
  description: 'Create time tracking entries in Jira from approved suggestions',
  inputSchema: {
    type: 'object',
    properties: {
      entries: {
        type: 'array',
        description: 'Array of time entry objects to create',
        items: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'Jira issue key (e.g., PROJ-123)'
            },
            durationMinutes: {
              type: 'number',
              description: 'Duration in minutes'
            },
            comment: {
              type: 'string',
              description: 'Work log comment'
            },
            started: {
              type: 'string',
              description: 'Start time in ISO 8601 format'
            }
          },
          required: ['issueKey', 'durationMinutes', 'comment']
        }
      },
      dryRun: {
        type: 'boolean',
        description: 'If true, validate but do not create entries',
        default: true
      }
    },
    required: ['entries']
  },
  execute: async (args) => {
    const schema = Joi.object({
      entries: Joi.array().items(
        Joi.object({
          issueKey: Joi.string().required(),
          durationMinutes: Joi.number().positive().required(),
          comment: Joi.string().required(),
          started: Joi.string().isoDate().optional()
        })
      ).required(),
      dryRun: Joi.boolean().default(true)
    });

    const validated = validateInput(schema, args);

    logger.info('Executing create_time_entries', { 
      count: validated.entries.length,
      dryRun: validated.dryRun
    });

    if (validated.dryRun) {
      logger.info('Dry run mode - no entries will be created');
      return {
        success: true,
        dryRun: true,
        message: 'Dry run completed - no entries created',
        entries: validated.entries
      };
    }

    // Initialize tracker
    await trackerConnector.initialize();

    // Create entries
    const result = await trackerConnector.batchCreateWorklogs(validated.entries);

    logger.audit('time_entries_created', {
      total: result.summary.total,
      successful: result.summary.successful,
      failed: result.summary.failed
    });

    return {
      success: true,
      dryRun: false,
      ...result
    };
  }
};

/**
 * Sync meetings to time tracker
 */
export const syncMeetingsToTracker = {
  name: 'sync_meetings_to_tracker',
  description: 'End-to-end sync: fetch meetings, classify, and create time entries',
  inputSchema: {
    type: 'object',
    properties: {
      userEmail: {
        type: 'string',
        description: 'Email address of the user'
      },
      startDate: {
        type: 'string',
        description: 'Start date in ISO 8601 format'
      },
      endDate: {
        type: 'string',
        description: 'End date in ISO 8601 format'
      },
      dryRun: {
        type: 'boolean',
        description: 'If true, generate suggestions but do not create entries',
        default: true
      },
      minConfidence: {
        type: 'number',
        description: 'Minimum confidence threshold (0-1)',
        default: 0.5
      }
    },
    required: ['userEmail', 'startDate', 'endDate']
  },
  execute: async (args) => {
    const schema = Joi.object({
      userEmail: Joi.string().email().required(),
      startDate: Joi.string().isoDate().required(),
      endDate: Joi.string().isoDate().required(),
      dryRun: Joi.boolean().default(true),
      minConfidence: Joi.number().min(0).max(1).default(0.5)
    });

    const validated = validateInput(schema, args);

    logger.info('Executing sync_meetings_to_tracker', { 
      userEmail: validated.userEmail,
      dryRun: validated.dryRun
    });

    // Get suggestions
    const suggestions = await suggestTimeEntries.execute({
      userEmail: validated.userEmail,
      startDate: validated.startDate,
      endDate: validated.endDate,
      includeAttendance: false,
      minConfidence: validated.minConfidence
    });

    if (!suggestions.success) {
      return suggestions;
    }

    // Create entries if not dry run
    if (!validated.dryRun && suggestions.suggestions.length > 0) {
      const createResult = await createTimeEntries.execute({
        entries: suggestions.suggestions,
        dryRun: false
      });

      return {
        success: true,
        dryRun: false,
        suggestions: suggestions.summary,
        created: createResult.summary
      };
    }

    return {
      success: true,
      dryRun: true,
      suggestions: suggestions.summary,
      entries: suggestions.suggestions
    };
  }
};

/**
 * Get available Jira projects
 */
export const getAvailableProjects = {
  name: 'get_available_projects',
  description: 'List all Jira projects accessible to the user',
  inputSchema: {
    type: 'object',
    properties: {}
  },
  execute: async (args) => {
    logger.info('Executing get_available_projects');

    await trackerConnector.initialize();
    const projects = await trackerConnector.getProjects();

    return {
      success: true,
      count: projects.length,
      projects
    };
  }
};

// Export all tools
export const meetingTools = [
  listRecentMeetings,
  getMeetingAttendance,
  suggestTimeEntries,
  createTimeEntries,
  syncMeetingsToTracker,
  getAvailableProjects
];

// Made with Bob
