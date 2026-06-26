import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs/promises';
import storageConnector from '../src/connectors/storage.js';
import classificationEngine from '../src/rules/classification.js';
import timeAllocationEngine from '../src/rules/time-allocation.js';
import logger from '../src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: 'uploads/' });

// Initialize storage before starting the server
const storageReady = await storageConnector.initialize();
if (!storageReady) {
  logger.error('Storage initialization failed — check DATABASE_URL and PGSSL env vars');
  process.exit(1);
}

const appPassword = process.env.APP_PASSWORD || 'password';

const requireWriteAuth = (req, res, next) => {
  const providedPassword = req.headers['x-app-password'];
  if (providedPassword !== appPassword) {
    return res.status(401).json({ error: 'Unauthorized: invalid password' });
  }
  next();
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes

// Get all time entries with optional filters
app.get('/api/entries', async (req, res) => {
  try {
    const { startDate, endDate, projectCode } = req.query;
    const filters = {};
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (projectCode) filters.projectCode = projectCode;

    const entries = await storageConnector.getAllEntries(filters);
    res.json(entries);
  } catch (error) {
    logger.error('Error fetching entries:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single entry
app.get('/api/entries/:id', async (req, res) => {
  try {
    const entry = await storageConnector.getEntry(req.params.id);
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    res.json(entry);
  } catch (error) {
    logger.error('Error fetching entry:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new entry
app.post('/api/entries', requireWriteAuth, async (req, res) => {
  try {
    const entry = req.body;
    
    // Classify if needed
    if (!entry.projectCode && entry.meetingTitle) {
      const classification = classificationEngine.classifyMeeting({
        title: entry.meetingTitle,
        organizer: entry.organizer,
        attendees: entry.attendees || []
      });
      entry.projectCode = classification.projectCode;
      entry.taskType = classification.taskType;
      entry.billable = classification.billable;
      entry.confidence = classification.confidence;
    }
    
    const created = await storageConnector.createEntry(entry);
    res.status(201).json(created);
  } catch (error) {
    logger.error('Error creating entry:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update entry
app.put('/api/entries/:id', requireWriteAuth, async (req, res) => {
  try {
    const updated = await storageConnector.updateEntry(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    logger.error('Error updating entry:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete entry
app.delete('/api/entries/:id', requireWriteAuth, async (req, res) => {
  try {
    await storageConnector.deleteEntry(req.params.id);
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting entry:', error);
    res.status(500).json({ error: error.message });
  }
});

// Bulk delete entries
app.post('/api/entries/bulk-delete', requireWriteAuth, async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No entry IDs provided' });
    }
    
    let deletedCount = 0;
    for (const id of ids) {
      try {
        await storageConnector.deleteEntry(id);
        deletedCount++;
      } catch (error) {
        logger.warn(`Failed to delete entry ${id}:`, error);
      }
    }
    
    res.json({
      success: true,
      deletedCount,
      totalRequested: ids.length
    });
  } catch (error) {
    logger.error('Error bulk deleting entries:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get summary statistics
app.get('/api/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filters = {};
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    
    const summary = await storageConnector.getSummary(filters);
    
    // Format for frontend
    const formatted = {
      totalEntries: summary.totalEntries,
      totalHours: summary.totalMinutes / 60,
      billableHours: summary.billableMinutes / 60,
      nonBillableHours: summary.nonBillableMinutes / 60,
      projectCount: Object.keys(summary.byProject).length,
      byProject: Object.entries(summary.byProject).map(([project, data]) => ({
        project,
        hours: data.minutes / 60,
        count: data.count,
        percentage: (data.minutes / summary.totalMinutes) * 100
      })).sort((a, b) => b.hours - a.hours),
      byDay: Object.entries(summary.byDate).map(([date, data]) => ({
        date,
        hours: data.minutes / 60,
        count: data.count
      })).sort((a, b) => a.date.localeCompare(b.date)),
      byType: {}
    };
    
    // Group by task type
    const entries = await storageConnector.getAllEntries(filters);
    const byType = {};
    entries.forEach(entry => {
      if (!byType[entry.taskType]) {
        byType[entry.taskType] = { count: 0, minutes: 0 };
      }
      byType[entry.taskType].count++;
      byType[entry.taskType].minutes += entry.durationMinutes;
    });
    
    formatted.byType = Object.entries(byType).map(([type, data]) => ({
      type,
      hours: data.minutes / 60,
      count: data.count,
      percentage: (data.minutes / summary.totalMinutes) * 100
    })).sort((a, b) => b.hours - a.hours);
    
    res.json(formatted);
  } catch (error) {
    logger.error('Error fetching summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export to CSV
app.get('/api/export/csv', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filters = {};
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const csv = await storageConnector.exportToCSV(filters);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=time-entries.csv');
    res.send(csv);
  } catch (error) {
    logger.error('Error exporting CSV:', error);
    res.status(500).json({ error: error.message });
  }
});

// Import from CSV/Excel
app.post('/api/import/csv', requireWriteAuth, upload.single('file'), async (req, res) => {
  try {
    const fileContent = await fs.readFile(req.file.path, 'utf-8');
    await fs.unlink(req.file.path); // Clean up uploaded file
    
    // Parse CSV with support for quoted commas/newlines and UTF-8 BOM
    const normalizedContent = fileContent.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
    const rows = [];
    let currentRow = [];
    let currentValue = '';
    let inQuotes = false;

    for (let i = 0; i < normalizedContent.length; i++) {
      const char = normalizedContent[i];
      const nextChar = normalizedContent[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentValue += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        currentRow.push(currentValue.trim());
        currentValue = '';
      } else if (char === '\n' && !inQuotes) {
        currentRow.push(currentValue.trim());
        if (currentRow.some(value => value !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentValue = '';
      } else {
        currentValue += char;
      }
    }

    if (currentValue.length > 0 || currentRow.length > 0) {
      currentRow.push(currentValue.trim());
      if (currentRow.some(value => value !== '')) {
        rows.push(currentRow);
      }
    }

    if (rows.length === 0) {
      return res.status(400).json({ error: 'CSV file is empty or could not be parsed' });
    }

    const headers = rows[0].map(h => h.trim().replace(/^"|"$/g, '').replace(/^\uFEFF/, ''));

    const parseDate = (value) => {
      if (!value) return new Date().toISOString().split('T')[0];

      const trimmed = value.trim();
      const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
      if (slashMatch) {
        let [, month, day, year] = slashMatch;
        if (year.length === 2) {
          year = `20${year}`;
        }
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }

      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }

      return new Date().toISOString().split('T')[0];
    };

    const to24HourTime = (value) => {
      if (!value) return null;

      const trimmed = value.trim();
      const match = trimmed.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
      if (!match) return null;

      let [, hours, minutes, meridiem] = match;
      let hour = parseInt(hours, 10);

      if (meridiem) {
        const upper = meridiem.toUpperCase();
        if (upper === 'PM' && hour !== 12) hour += 12;
        if (upper === 'AM' && hour === 12) hour = 0;
      }

      return `${String(hour).padStart(2, '0')}:${minutes}:00`;
    };

    const entries = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];

      if (row.length < 3) continue;

      const entry = {};
      headers.forEach((header, index) => {
        entry[header] = (row[index] || '').trim();
      });

      const parsedDate = parseDate(entry.Date || entry.date);
      const startClock = to24HourTime(entry['Start Time'] || entry.startTime);
      const endClock = to24HourTime(entry['End Time'] || entry.endTime);

      const normalized = {
        date: parsedDate,
        projectCode: entry['Project / Client Name'] || entry['Project/Client Name'] || entry.projectCode || 'Unknown',
        meetingTitle: entry['Meeting/Project Title'] || entry['Meeting / Project Title'] || entry.title || entry.meetingTitle,
        startTime: startClock ? `${parsedDate}T${startClock}Z` : null,
        endTime: endClock ? `${parsedDate}T${endClock}Z` : null,
        durationMinutes: entry['Duration (hrs)'] ? parseFloat(entry['Duration (hrs)']) * 60 :
                        (entry.durationMinutes ? parseFloat(entry.durationMinutes) : 60),
        description: entry.Notes || entry.description || '',
        attendees: entry['Employee(s) Attended Name(s)'] || entry.attendees || '',
        taskType: 'imported',
        billable: false,
        confidence: 1
      };

      if (!normalized.meetingTitle || Number.isNaN(normalized.durationMinutes)) {
        continue;
      }

      entries.push(normalized);
    }
    
    const created = await storageConnector.batchCreateEntries(entries);
    res.json({
      success: true,
      count: created.summary.successful,
      entries: created.results.map(result => result.entry),
      errors: created.errors,
      summary: created.summary
    });
  } catch (error) {
    logger.error('Error importing CSV:', error);
    res.status(500).json({ error: error.message });
  }
});

// Import from ICS calendar file
app.post('/api/import/ics', requireWriteAuth, upload.single('file'), async (req, res) => {
  try {
    const fileContent = await fs.readFile(req.file.path, 'utf-8');
    await fs.unlink(req.file.path);
    
    // Simple ICS parser
    const events = [];
    const eventBlocks = fileContent.split('BEGIN:VEVENT');
    
    for (let i = 1; i < eventBlocks.length; i++) {
      const block = eventBlocks[i];
      const event = {};
      
      const summaryMatch = block.match(/SUMMARY:(.*)/);
      const startMatch = block.match(/DTSTART[^:]*:(.*)/);
      const endMatch = block.match(/DTEND[^:]*:(.*)/);
      const descMatch = block.match(/DESCRIPTION:(.*)/);
      const organizerMatch = block.match(/ORGANIZER[^:]*:mailto:(.*)/);
      
      if (summaryMatch) event.title = summaryMatch[1].trim();
      if (startMatch) event.start = startMatch[1].trim();
      if (endMatch) event.end = endMatch[1].trim();
      if (descMatch) event.description = descMatch[1].trim();
      if (organizerMatch) event.organizer = organizerMatch[1].trim();
      
      if (event.title && event.start) {
        // Classify the meeting
        const classification = classificationEngine.classifyMeeting({
          title: event.title,
          organizer: event.organizer || '',
          attendees: []
        });
        
        // Calculate duration
        const startDate = new Date(event.start.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6'));
        const endDate = new Date(event.end.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6'));
        const durationMinutes = (endDate - startDate) / (1000 * 60);
        
        events.push({
          date: startDate.toISOString().split('T')[0],
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
          durationMinutes,
          meetingTitle: event.title,
          description: event.description || '',
          organizer: event.organizer || '',
          projectCode: classification.projectCode,
          taskType: classification.taskType,
          billable: classification.billable,
          confidence: classification.confidence
        });
      }
    }
    
    const created = await storageConnector.batchCreateEntries(events);
    res.json({ 
      success: true, 
      count: created.length,
      entries: created 
    });
  } catch (error) {
    logger.error('Error importing ICS:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get available projects
app.get('/api/projects', async (req, res) => {
  try {
    const entries = await storageConnector.getAllEntries();
    const projects = [...new Set(entries.map(e => e.projectCode))].sort();
    res.json(projects);
  } catch (error) {
    logger.error('Error fetching projects:', error);
    res.status(500).json({ error: error.message });
  }
});

// Classify a meeting title
app.post('/api/classify', (req, res) => {
  try {
    const { title, organizer, attendees } = req.body;
    const classification = classificationEngine.classifyMeeting({
      title,
      organizer: organizer || '',
      attendees: attendees || []
    });
    res.json(classification);
  } catch (error) {
    logger.error('Error classifying meeting:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Serve index.html for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  logger.info(`Task Time Tracker Web UI running on port ${PORT}`);
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

// Keep the process alive
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Made with Bob
