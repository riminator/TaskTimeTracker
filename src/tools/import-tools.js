import storageConnector from '../connectors/storage.js';
import classificationEngine from '../rules/classification.js';
import timeAllocationEngine from '../rules/time-allocation.js';
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
 * Import from Excel/CSV time tracker
 */
export const importExcelTimeTracker = {
  name: 'import_excel_timetracker',
  description: 'Import existing time entries from Excel/CSV file',
  inputSchema: {
    type: 'object',
    properties: {
      csvContent: {
        type: 'string',
        description: 'CSV content (paste from Excel or CSV file)'
      },
      columnMapping: {
        type: 'object',
        description: 'Map CSV columns to fields',
        properties: {
          dateColumn: { type: 'string', description: 'Column name for date' },
          projectColumn: { type: 'string', description: 'Column name for project/client' },
          titleColumn: { type: 'string', description: 'Column name for meeting/project title' },
          startTimeColumn: { type: 'string', description: 'Column name for start time' },
          endTimeColumn: { type: 'string', description: 'Column name for end time' },
          durationColumn: { type: 'string', description: 'Column name for duration' },
          notesColumn: { type: 'string', description: 'Column name for notes' },
          attendeesColumn: { type: 'string', description: 'Column name for attendees (optional)' }
        }
      },
      skipRows: {
        type: 'number',
        description: 'Number of header rows to skip',
        default: 1
      },
      dryRun: {
        type: 'boolean',
        description: 'Preview without importing',
        default: true
      }
    },
    required: ['csvContent']
  },
  execute: async (args) => {
    const schema = Joi.object({
      csvContent: Joi.string().required(),
      columnMapping: Joi.object({
        dateColumn: Joi.string().optional(),
        projectColumn: Joi.string().optional(),
        titleColumn: Joi.string().optional(),
        startTimeColumn: Joi.string().optional(),
        endTimeColumn: Joi.string().optional(),
        durationColumn: Joi.string().optional(),
        notesColumn: Joi.string().optional(),
        attendeesColumn: Joi.string().optional()
      }).optional(),
      skipRows: Joi.number().default(1),
      dryRun: Joi.boolean().default(true)
    });

    const validated = validateInput(schema, args);

    logger.info('Executing import_excel_timetracker', { dryRun: validated.dryRun });

    // Parse CSV
    const rows = parseCSV(validated.csvContent);
    
    if (rows.length === 0) {
      return {
        success: false,
        error: 'No data found in CSV'
      };
    }

    // Get headers
    const headers = rows[0];
    const dataRows = rows.slice(validated.skipRows);

    // Auto-detect columns if not provided
    const mapping = validated.columnMapping || autoDetectColumns(headers);

    logger.info('Column mapping', mapping);

    // Parse entries
    const entries = [];
    const errors = [];

    for (let i = 0; i < dataRows.length; i++) {
      try {
        const row = dataRows[i];
        const entry = parseExcelRow(row, headers, mapping);
        
        if (entry) {
          entries.push(entry);
        }
      } catch (error) {
        errors.push({
          row: i + validated.skipRows + 1,
          error: error.message
        });
      }
    }

    // Preview or import
    if (validated.dryRun) {
      return {
        success: true,
        dryRun: true,
        preview: {
          totalRows: dataRows.length,
          validEntries: entries.length,
          errors: errors.length,
          sampleEntries: entries.slice(0, 5),
          detectedMapping: mapping
        },
        errors: errors.slice(0, 10),
        message: 'Preview complete. Set dryRun: false to import.'
      };
    }

    // Import entries
    await storageConnector.initialize();
    const imported = [];
    const importErrors = [];

    for (const entry of entries) {
      try {
        const created = await storageConnector.createEntry(entry);
        imported.push(created);
      } catch (error) {
        importErrors.push({
          entry,
          error: error.message
        });
      }
    }

    logger.audit('excel_import_completed', {
      total: entries.length,
      imported: imported.length,
      failed: importErrors.length
    });

    return {
      success: true,
      dryRun: false,
      summary: {
        totalRows: dataRows.length,
        imported: imported.length,
        failed: importErrors.length
      },
      imported,
      errors: importErrors
    };
  }
};

/**
 * Import from OLM file (Outlook for Mac)
 */
export const importOLMFile = {
  name: 'import_olm_file',
  description: 'Import calendar from Outlook OLM file',
  inputSchema: {
    type: 'object',
    properties: {
      olmContent: {
        type: 'string',
        description: 'OLM file content (extracted calendar data)'
      },
      startDate: {
        type: 'string',
        description: 'Only import meetings after this date (YYYY-MM-DD)'
      },
      endDate: {
        type: 'string',
        description: 'Only import meetings before this date (YYYY-MM-DD)'
      },
      autoClassify: {
        type: 'boolean',
        description: 'Automatically classify meetings',
        default: true
      },
      autoCreate: {
        type: 'boolean',
        description: 'Auto-create high confidence entries',
        default: false
      },
      minConfidence: {
        type: 'number',
        description: 'Minimum confidence for auto-create',
        default: 0.8
      }
    },
    required: ['olmContent']
  },
  execute: async (args) => {
    const schema = Joi.object({
      olmContent: Joi.string().required(),
      startDate: Joi.string().optional(),
      endDate: Joi.string().optional(),
      autoClassify: Joi.boolean().default(true),
      autoCreate: Joi.boolean().default(false),
      minConfidence: Joi.number().min(0).max(1).default(0.8)
    });

    const validated = validateInput(schema, args);

    logger.info('Executing import_olm_file');

    // OLM files are actually ZIP archives containing XML
    // For now, we'll handle extracted calendar data
    // User needs to extract the OLM and provide calendar XML/ICS
    
    return {
      success: false,
      error: 'OLM import requires extraction first',
      instructions: [
        '1. OLM files are ZIP archives',
        '2. Extract the OLM file (rename to .zip and unzip)',
        '3. Find the calendar data (usually in .ics format)',
        '4. Use import_calendar_file tool with the .ics content',
        '',
        'Alternative: Use Outlook to export calendar as .ics:',
        '- Open Outlook',
        '- File → Export',
        '- Choose Calendar',
        '- Save as .ics format',
        '- Then use import_calendar_file tool'
      ].join('\n')
    };
  }
};

/**
 * Import from ICS with better OLM support
 */
export const importCalendarICS = {
  name: 'import_calendar_ics',
  description: 'Import calendar from ICS file (works with Outlook exports)',
  inputSchema: {
    type: 'object',
    properties: {
      icsContent: {
        type: 'string',
        description: 'Content of the .ics calendar file'
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
        description: 'Auto-create high confidence entries',
        default: false
      },
      minConfidence: {
        type: 'number',
        description: 'Minimum confidence for auto-create',
        default: 0.8
      }
    },
    required: ['icsContent']
  },
  execute: async (args) => {
    const schema = Joi.object({
      icsContent: Joi.string().required(),
      startDate: Joi.string().optional(),
      endDate: Joi.string().optional(),
      autoCreate: Joi.boolean().default(false),
      minConfidence: Joi.number().min(0).max(1).default(0.8)
    });

    const validated = validateInput(schema, args);

    logger.info('Executing import_calendar_ics');

    // Parse ICS file
    const meetings = parseICSFile(validated.icsContent);

    // Filter by date range
    let filteredMeetings = meetings;
    if (validated.startDate) {
      filteredMeetings = filteredMeetings.filter(m => 
        m.startTime >= validated.startDate
      );
    }
    if (validated.endDate) {
      filteredMeetings = filteredMeetings.filter(m => 
        m.startTime <= validated.endDate
      );
    }

    // Initialize engines
    await classificationEngine.initialize();
    await timeAllocationEngine.initialize();

    // Classify meetings
    const classified = classificationEngine.classifyMeetings(filteredMeetings);

    // Process time allocations
    const processed = timeAllocationEngine.processAllMeetings(classified.included);

    // Generate suggestions
    const suggestions = processed.meetings.map(m => 
      timeAllocationEngine.generateTimeEntry(m)
    );

    // Auto-create if requested
    let created = [];
    if (validated.autoCreate) {
      await storageConnector.initialize();
      
      const highConfidence = suggestions.filter(s => 
        s.confidence >= validated.minConfidence
      );

      for (const suggestion of highConfidence) {
        const entry = await storageConnector.createEntry({
          projectCode: suggestion.projectCode || suggestion.issueKey,
          taskType: 'meeting',
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
 * Helper: Parse CSV content
 */
function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  return lines.map(line => {
    // Simple CSV parser (handles quoted fields)
    const fields = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim());
    
    return fields;
  });
}

/**
 * Helper: Auto-detect column names
 */
function autoDetectColumns(headers) {
  const mapping = {};
  
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].toLowerCase();
    
    if (header.includes('date') && !header.includes('start') && !header.includes('end')) {
      mapping.dateColumn = headers[i];
    } else if (header.includes('project') || header.includes('client')) {
      mapping.projectColumn = headers[i];
    } else if (header.includes('title') || header.includes('meeting')) {
      mapping.titleColumn = headers[i];
    } else if (header.includes('start') && header.includes('time')) {
      mapping.startTimeColumn = headers[i];
    } else if (header.includes('end') && header.includes('time')) {
      mapping.endTimeColumn = headers[i];
    } else if (header.includes('duration')) {
      mapping.durationColumn = headers[i];
    } else if (header.includes('notes') || header.includes('description')) {
      mapping.notesColumn = headers[i];
    } else if (header.includes('attend') || header.includes('employee')) {
      mapping.attendeesColumn = headers[i];
    }
  }
  
  return mapping;
}

/**
 * Helper: Parse Excel row
 */
function parseExcelRow(row, headers, mapping) {
  const getColumn = (columnName) => {
    if (!columnName) return null;
    const index = headers.indexOf(columnName);
    return index >= 0 ? row[index] : null;
  };

  const date = getColumn(mapping.dateColumn);
  const project = getColumn(mapping.projectColumn);
  const title = getColumn(mapping.titleColumn);
  const startTime = getColumn(mapping.startTimeColumn);
  const endTime = getColumn(mapping.endTimeColumn);
  const duration = getColumn(mapping.durationColumn);
  const notes = getColumn(mapping.notesColumn);
  const attendees = getColumn(mapping.attendeesColumn);

  if (!date) {
    return null; // Skip rows without date
  }

  // Parse duration (from Duration column or calculate from Start/End times)
  let durationMinutes;
  if (duration) {
    durationMinutes = parseDuration(duration);
  } else if (startTime && endTime) {
    durationMinutes = calculateDurationFromTimes(startTime, endTime);
  } else {
    return null; // Skip if no duration info
  }

  // Parse date
  const parsedDate = parseDate(date);

  // Build start time (use actual start time if available)
  let fullStartTime;
  if (startTime) {
    fullStartTime = `${parsedDate}T${normalizeTime(startTime)}`;
  } else {
    fullStartTime = `${parsedDate}T12:00:00Z`;
  }

  return {
    projectCode: project || 'GENERAL',
    taskType: 'imported',
    durationMinutes,
    date: parsedDate,
    startTime: fullStartTime,
    description: notes || title || 'Imported from Excel',
    meetingId: `excel_${Date.now()}_${Math.random()}`,
    meetingTitle: title || notes || 'Excel Import',
    billable: false, // Will be determined by classification rules
    confidence: 1.0,
    attendees: attendees || null
  };
}

/**
 * Helper: Parse duration from various formats
 */
function parseDuration(duration) {
  const str = String(duration).trim();
  
  // Format: "2.5" (hours as decimal)
  if (/^\d+\.?\d*$/.test(str)) {
    return Math.round(parseFloat(str) * 60);
  }
  
  // Format: "2:30" (hours:minutes)
  if (/^\d+:\d+$/.test(str)) {
    const [hours, minutes] = str.split(':').map(Number);
    return hours * 60 + minutes;
  }
  
  // Format: "2h 30m" or "2h" or "30m"
  const hourMatch = str.match(/(\d+)h/);
  const minMatch = str.match(/(\d+)m/);
  const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
  const minutes = minMatch ? parseInt(minMatch[1]) : 0;
  
  return hours * 60 + minutes;
}

/**
 * Helper: Parse date from various formats
 */
function parseDate(date) {
  const str = String(date).trim();
  
  // Try ISO format first
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  
  // Try MM/DD/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const [month, day, year] = str.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Try DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const parts = str.split('/');
    // Assume MM/DD/YYYY for US format
    return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
  }
  
  // Fallback: try to parse as Date
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  
  throw new Error(`Unable to parse date: ${str}`);
}

/**
 * Helper: Calculate duration from start and end times
 */
function calculateDurationFromTimes(startTime, endTime) {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  
  let minutes = (end.hours * 60 + end.minutes) - (start.hours * 60 + start.minutes);
  
  // Handle overnight meetings (rare but possible)
  if (minutes < 0) {
    minutes += 24 * 60;
  }
  
  return minutes;
}

/**
 * Helper: Parse time string to hours and minutes
 */
function parseTime(timeStr) {
  const str = String(timeStr).trim();
  
  // Format: "14:30" or "2:30 PM"
  let hours, minutes;
  
  if (str.includes('PM') || str.includes('AM')) {
    // 12-hour format
    const isPM = str.includes('PM');
    const timePart = str.replace(/[AP]M/i, '').trim();
    const [h, m] = timePart.split(':').map(Number);
    
    hours = h;
    if (isPM && hours !== 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;
    minutes = m || 0;
  } else {
    // 24-hour format
    const [h, m] = str.split(':').map(Number);
    hours = h;
    minutes = m || 0;
  }
  
  return { hours, minutes };
}

/**
 * Helper: Normalize time to HH:MM:SS format
 */
function normalizeTime(timeStr) {
  const { hours, minutes } = parseTime(timeStr);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00Z`;
}

/**
 * Helper: Parse ICS file
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

function extractICSField(content, fieldName) {
  const regex = new RegExp(`${fieldName}[^:]*:(.+)`, 'i');
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}

function parseICSDate(dateStr) {
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

function extractEmail(organizerStr) {
  const match = organizerStr.match(/mailto:([^\s]+)/i);
  return match ? match[1] : organizerStr;
}

// Export all import tools
export const importTools = [
  importExcelTimeTracker,
  importOLMFile,
  importCalendarICS
];

// Made with Bob
