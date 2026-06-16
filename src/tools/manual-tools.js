import classificationEngine from '../rules/classification.js';
import timeAllocationEngine from '../rules/time-allocation.js';
import storageConnector from '../connectors/storage.js';
import logger from '../utils/logger.js';
import Joi from 'joi';
import fs from 'fs';

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
 * Manually add a single meeting
 */
export const addManualMeeting = {
  name: 'add_manual_meeting',
  description: 'Manually add a meeting and classify it for time tracking',
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Meeting title (e.g., "Project FALCON Sprint Planning")'
      },
      startTime: {
        type: 'string',
        description: 'Start time in ISO 8601 format (e.g., "2026-06-16T14:00:00Z")'
      },
      endTime: {
        type: 'string',
        description: 'End time in ISO 8601 format (e.g., "2026-06-16T15:00:00Z")'
      },
      organizer: {
        type: 'string',
        description: 'Organizer email (optional, helps with classification)'
      },
      attendees: {
        type: 'array',
        description: 'List of attendee emails (optional)',
        items: { type: 'string' }
      },
      autoCreate: {
        type: 'boolean',
        description: 'Automatically create time entry if confidence is high',
        default: false
      }
    },
    required: ['title', 'startTime', 'endTime']
  },
  execute: async (args) => {
    const schema = Joi.object({
      title: Joi.string().required(),
      startTime: Joi.string().isoDate().required(),
      endTime: Joi.string().isoDate().required(),
      organizer: Joi.string().email().optional(),
      attendees: Joi.array().items(Joi.string().email()).optional(),
      autoCreate: Joi.boolean().default(false)
    });

    const validated = validateInput(schema, args);

    logger.info('Executing add_manual_meeting', { title: validated.title });

    // Initialize engines
    await classificationEngine.initialize();
    await timeAllocationEngine.initialize();

    // Create meeting object
    const startTime = new Date(validated.startTime);
    const endTime = new Date(validated.endTime);
    const durationMinutes = Math.round((endTime - startTime) / 60000);

    const meeting = {
      meetingId: `manual_${Date.now()}`,
      title: validated.title,
      startTime: validated.startTime,
      endTime: validated.endTime,
      durationMinutes,
      organizer: validated.organizer ? { email: validated.organizer } : null,
      attendees: (validated.attendees || []).map(email => ({ email })),
      isOnlineMeeting: false,
      isCancelled: false,
      userAccepted: true,
      categories: []
    };

    // Classify the meeting
    const classification = classificationEngine.classifyMeeting(meeting);
    
    if (classification.excluded) {
      return {
        success: true,
        excluded: true,
        reason: classification.reason,
        meeting
      };
    }

    // Apply time allocation
    const duration = timeAllocationEngine.processDuration({
      ...meeting,
      classification
    });

    // Generate time entry suggestion
    const suggestion = timeAllocationEngine.generateTimeEntry({
      ...meeting,
      classification,
      ...duration
    });

    // Auto-create if requested and confidence is high
    if (validated.autoCreate && classification.confidence >= 0.8) {
      await storageConnector.initialize();
      const entry = await storageConnector.createEntry({
        projectCode: suggestion.projectCode || classification.projectCode,
        taskType: classification.taskType,
        durationMinutes: suggestion.durationMinutes,
        date: validated.startTime.split('T')[0],
        startTime: validated.startTime,
        description: suggestion.comment,
        meetingId: meeting.meetingId,
        meetingTitle: meeting.title,
        billable: classification.billable,
        confidence: classification.confidence
      });

      return {
        success: true,
        autoCreated: true,
        entry,
        classification,
        duration
      };
    }

    return {
      success: true,
      autoCreated: false,
      suggestion,
      classification,
      duration,
      message: validated.autoCreate 
        ? 'Confidence too low for auto-create. Please review and approve.'
        : 'Review the suggestion and use create_time_entries to save it.'
    };
  }
};

/**
 * Quick entry - just the basics
 */
export const addQuickEntry = {
  name: 'add_quick_entry',
  description: 'Quickly add a time entry with minimal information',
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Meeting or task title'
      },
      durationMinutes: {
        type: 'number',
        description: 'Duration in minutes'
      },
      date: {
        type: 'string',
        description: 'Date in YYYY-MM-DD format (defaults to today)'
      },
      projectCode: {
        type: 'string',
        description: 'Project code (optional, will be classified if not provided)'
      }
    },
    required: ['title', 'durationMinutes']
  },
  execute: async (args) => {
    const schema = Joi.object({
      title: Joi.string().required(),
      durationMinutes: Joi.number().positive().required(),
      date: Joi.string().optional(),
      projectCode: Joi.string().optional()
    });

    const validated = validateInput(schema, args);

    logger.info('Executing add_quick_entry', { title: validated.title });

    const date = validated.date || new Date().toISOString().split('T')[0];
    
    // If project code provided, skip classification
    if (validated.projectCode) {
      await storageConnector.initialize();
      const entry = await storageConnector.createEntry({
        projectCode: validated.projectCode,
        taskType: 'manual-entry',
        durationMinutes: validated.durationMinutes,
        date,
        startTime: `${date}T12:00:00Z`,
        description: validated.title,
        meetingId: `quick_${Date.now()}`,
        meetingTitle: validated.title,
        billable: false,
        confidence: 1.0
      });

      return {
        success: true,
        entry
      };
    }

    // Otherwise, classify it
    await classificationEngine.initialize();
    
    const meeting = {
      title: validated.title,
      durationMinutes: validated.durationMinutes
    };

    const classification = classificationEngine.classifyMeeting(meeting);

    await storageConnector.initialize();
    const entry = await storageConnector.createEntry({
      projectCode: classification.projectCode,
      taskType: classification.taskType,
      durationMinutes: validated.durationMinutes,
      date,
      startTime: `${date}T12:00:00Z`,
      description: validated.title,
      meetingId: `quick_${Date.now()}`,
      meetingTitle: validated.title,
      billable: classification.billable,
      confidence: classification.confidence
    });

    return {
      success: true,
      entry,
      classification
    };
  }
};

/**
 * Import calendar file (.ics format)
 */
export const importCalendarFile = {
  name: 'import_calendar_file',
  description: 'Import meetings from an Outlook calendar .ics file',
  inputSchema: {
    type: 'object',
    properties: {
      fileContent: {
        type: 'string',
        description: 'Content of the .ics file'
      },
      startDate: {
        type: 'string',
        description: 'Only import meetings after this date (YYYY-MM-DD)'
      },
      endDate: {
        type: 'string',
        description: 'Only import meetings before this date (YYYY-MM-DD)'
      },
      autoCreate: {
        type: 'boolean',
        description: 'Automatically create entries for high-confidence classifications',
        default: false
      },
      minConfidence: {
        type: 'number',
        description: 'Minimum confidence for auto-create (0-1)',
        default: 0.8
      }
    },
    required: ['fileContent']
  },
  execute: async (args) => {
    const schema = Joi.object({
      fileContent: Joi.string().required(),
      startDate: Joi.string().optional(),
      endDate: Joi.string().optional(),
      autoCreate: Joi.boolean().default(false),
      minConfidence: Joi.number().min(0).max(1).default(0.8)
    });

    const validated = validateInput(schema, args);

    logger.info('Executing import_calendar_file');

    // Parse ICS file
    const meetings = parseICSFile(validated.fileContent);

    // Filter by date range
    let filteredMeetings = meetings;
    if (validated.startDate) {
      filteredMeetings = filteredMeetings.filter(m => m.startTime >= validated.startDate);
    }
    if (validated.endDate) {
      filteredMeetings = filteredMeetings.filter(m => m.startTime <= validated.endDate);
    }

    // Initialize engines
    await classificationEngine.initialize();
    await timeAllocationEngine.initialize();

    // Classify all meetings
    const classified = classificationEngine.classifyMeetings(filteredMeetings);

    // Process time allocations
    const processed = timeAllocationEngine.processAllMeetings(classified.included);

    // Generate suggestions
    const suggestions = processed.meetings.map(m => 
      timeAllocationEngine.generateTimeEntry(m)
    );

    // Auto-create high confidence entries if requested
    let created = [];
    if (validated.autoCreate) {
      await storageConnector.initialize();
      
      const highConfidence = suggestions.filter(s => 
        s.confidence >= validated.minConfidence
      );

      for (const suggestion of highConfidence) {
        const entry = await storageConnector.createEntry({
          projectCode: suggestion.issueKey || suggestion.projectCode,
          taskType: suggestion.taskType || 'meeting',
          durationMinutes: suggestion.durationMinutes,
          date: suggestion.started.split('T')[0],
          startTime: suggestion.started,
          description: suggestion.comment,
          meetingId: suggestion.meetingId,
          meetingTitle: suggestion.meetingTitle,
          billable: suggestion.billable,
          confidence: suggestion.confidence
        });
        created.push(entry);
      }
    }

    return {
      success: true,
      summary: {
        totalParsed: meetings.length,
        afterFiltering: filteredMeetings.length,
        classified: classified.included.length,
        excluded: classified.excluded.length,
        autoCreated: created.length,
        needingReview: suggestions.length - created.length
      },
      suggestions: suggestions.filter(s => s.confidence < validated.minConfidence),
      created,
      excluded: classified.excluded.map(m => ({
        title: m.title,
        reason: m.classification.reason
      }))
    };
  }
};

/**
 * Parse ICS file content
 */
function parseICSFile(content) {
  const meetings = [];
  const events = content.split('BEGIN:VEVENT');

  for (let i = 1; i < events.length; i++) {
    const event = events[i];
    
    const title = extractICSField(event, 'SUMMARY');
    const startTime = extractICSField(event, 'DTSTART');
    const endTime = extractICSField(event, 'DTEND');
    const organizer = extractICSField(event, 'ORGANIZER');
    const status = extractICSField(event, 'STATUS');

    if (title && startTime && endTime) {
      const start = parseICSDate(startTime);
      const end = parseICSDate(endTime);
      const durationMinutes = Math.round((end - start) / 60000);

      meetings.push({
        meetingId: `ics_${Date.now()}_${i}`,
        title: title.replace(/\\n/g, ' ').replace(/\\,/g, ','),
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        durationMinutes,
        organizer: organizer ? { email: extractEmail(organizer) } : null,
        attendees: [],
        isOnlineMeeting: false,
        isCancelled: status === 'CANCELLED',
        userAccepted: true,
        categories: []
      });
    }
  }

  return meetings;
}

/**
 * Extract field from ICS content
 */
function extractICSField(content, fieldName) {
  const regex = new RegExp(`${fieldName}[^:]*:(.+)`, 'i');
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Parse ICS date format
 */
function parseICSDate(dateStr) {
  // Handle both formats: 20260616T140000Z and 20260616T140000
  const cleaned = dateStr.replace(/[:-]/g, '');
  
  if (cleaned.includes('T')) {
    const [datePart, timePart] = cleaned.split('T');
    const year = datePart.substring(0, 4);
    const month = datePart.substring(4, 6);
    const day = datePart.substring(6, 8);
    const hour = timePart.substring(0, 2);
    const minute = timePart.substring(2, 4);
    const second = timePart.substring(4, 6);
    
    return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
  }
  
  return new Date(dateStr);
}

/**
 * Extract email from ORGANIZER field
 */
function extractEmail(organizerStr) {
  const match = organizerStr.match(/mailto:([^\s]+)/i);
  return match ? match[1] : organizerStr;
}

/**
 * Batch add multiple meetings
 */
export const batchAddMeetings = {
  name: 'batch_add_meetings',
  description: 'Add multiple meetings at once',
  inputSchema: {
    type: 'object',
    properties: {
      meetings: {
        type: 'array',
        description: 'Array of meeting objects',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            startTime: { type: 'string' },
            endTime: { type: 'string' },
            organizer: { type: 'string' }
          },
          required: ['title', 'startTime', 'endTime']
        }
      },
      autoCreate: {
        type: 'boolean',
        description: 'Auto-create high confidence entries',
        default: false
      }
    },
    required: ['meetings']
  },
  execute: async (args) => {
    const schema = Joi.object({
      meetings: Joi.array().items(
        Joi.object({
          title: Joi.string().required(),
          startTime: Joi.string().isoDate().required(),
          endTime: Joi.string().isoDate().required(),
          organizer: Joi.string().email().optional()
        })
      ).required(),
      autoCreate: Joi.boolean().default(false)
    });

    const validated = validateInput(schema, args);

    logger.info('Executing batch_add_meetings', { count: validated.meetings.length });

    const results = [];
    
    for (const meeting of validated.meetings) {
      const result = await addManualMeeting.execute({
        ...meeting,
        autoCreate: validated.autoCreate
      });
      results.push(result);
    }

    const summary = {
      total: results.length,
      autoCreated: results.filter(r => r.autoCreated).length,
      excluded: results.filter(r => r.excluded).length,
      needingReview: results.filter(r => !r.autoCreated && !r.excluded).length
    };

    return {
      success: true,
      summary,
      results
    };
  }
};

// Export all manual tools
export const manualTools = [
  addManualMeeting,
  addQuickEntry,
  importCalendarFile,
  batchAddMeetings
];

// Made with Bob
