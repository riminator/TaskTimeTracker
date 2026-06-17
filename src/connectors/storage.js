import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Local storage connector - stores time entries in JSON files
 */
class StorageConnector {
  constructor() {
    this.dataDir = path.join(__dirname, '../../data');
    this.entriesFile = path.join(this.dataDir, 'time-entries.json');
    this.initialized = false;
  }

  /**
   * Initialize the storage
   */
  async initialize() {
    try {
      // Create data directory if it doesn't exist
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true, mode: 0o777 });
      }

      // Create entries file if it doesn't exist
      if (!fs.existsSync(this.entriesFile)) {
        fs.writeFileSync(this.entriesFile, JSON.stringify({ entries: [] }, null, 2), { mode: 0o666 });
      }

      this.initialized = true;
      logger.info('Storage connector initialized', { dataDir: this.dataDir });
      return true;
    } catch (error) {
      logger.error('Failed to initialize storage connector', { error: error.message, stack: error.stack });
      // Don't throw - allow app to start even if storage init fails
      console.error('Storage initialization failed:', error);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Ensure storage is initialized
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('Storage connector not initialized. Call initialize() first.');
    }
  }

  /**
   * Read all entries from storage
   */
  readEntries() {
    this.ensureInitialized();
    const data = fs.readFileSync(this.entriesFile, 'utf8');
    return JSON.parse(data).entries;
  }

  /**
   * Write entries to storage
   */
  writeEntries(entries) {
    this.ensureInitialized();
    fs.writeFileSync(this.entriesFile, JSON.stringify({ entries }, null, 2));
  }

  /**
   * Create a new time entry
   */
  async createEntry(entry) {
    try {
      this.ensureInitialized();

      const entries = this.readEntries();
      
      const newEntry = {
        id: this.generateId(),
        projectCode: entry.projectCode || 'GENERAL',
        taskType: entry.taskType || 'meeting',
        durationMinutes: entry.durationMinutes,
        date: entry.date || new Date().toISOString().split('T')[0],
        startTime: entry.startTime,
        description: entry.description,
        meetingId: entry.meetingId,
        meetingTitle: entry.meetingTitle,
        billable: entry.billable || false,
        confidence: entry.confidence || 0,
        createdAt: new Date().toISOString(),
        status: 'logged'
      };

      entries.push(newEntry);
      this.writeEntries(entries);

      logger.audit('time_entry_created', {
        id: newEntry.id,
        projectCode: newEntry.projectCode,
        durationMinutes: newEntry.durationMinutes
      });

      return newEntry;
    } catch (error) {
      logger.error('Failed to create time entry', { error: error.message });
      throw error;
    }
  }

  /**
   * Get all entries
   */
  async getAllEntries(filters = {}) {
    try {
      this.ensureInitialized();

      let entries = this.readEntries();

      // Apply filters
      if (filters.startDate) {
        entries = entries.filter(e => e.date >= filters.startDate);
      }
      if (filters.endDate) {
        entries = entries.filter(e => e.date <= filters.endDate);
      }
      if (filters.projectCode) {
        entries = entries.filter(e => e.projectCode === filters.projectCode);
      }
      if (filters.billable !== undefined) {
        entries = entries.filter(e => e.billable === filters.billable);
      }

      return entries;
    } catch (error) {
      logger.error('Failed to get entries', { error: error.message });
      throw error;
    }
  }

  /**
   * Get entry by ID
   */
  async getEntry(id) {
    try {
      this.ensureInitialized();

      const entries = this.readEntries();
      const entry = entries.find(e => e.id === id);

      if (!entry) {
        throw new Error(`Entry not found: ${id}`);
      }

      return entry;
    } catch (error) {
      logger.error('Failed to get entry', { id, error: error.message });
      throw error;
    }
  }

  /**
   * Update an entry
   */
  async updateEntry(id, updates) {
    try {
      this.ensureInitialized();

      const entries = this.readEntries();
      const index = entries.findIndex(e => e.id === id);

      if (index === -1) {
        throw new Error(`Entry not found: ${id}`);
      }

      entries[index] = {
        ...entries[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      this.writeEntries(entries);

      logger.audit('time_entry_updated', {
        id,
        updates: Object.keys(updates)
      });

      return entries[index];
    } catch (error) {
      logger.error('Failed to update entry', { id, error: error.message });
      throw error;
    }
  }

  /**
   * Delete an entry
   */
  async deleteEntry(id) {
    try {
      this.ensureInitialized();

      const entries = this.readEntries();
      const filtered = entries.filter(e => e.id !== id);

      if (filtered.length === entries.length) {
        throw new Error(`Entry not found: ${id}`);
      }

      this.writeEntries(filtered);

      logger.audit('time_entry_deleted', { id });

      return { success: true, id };
    } catch (error) {
      logger.error('Failed to delete entry', { id, error: error.message });
      throw error;
    }
  }

  /**
   * Batch create entries
   */
  async batchCreateEntries(entries) {
    try {
      this.ensureInitialized();

      const results = [];
      const errors = [];

      for (const entry of entries) {
        try {
          const created = await this.createEntry(entry);
          results.push({
            success: true,
            entry: created
          });
        } catch (error) {
          errors.push({
            success: false,
            entry,
            error: error.message
          });
        }
      }

      logger.info('Batch entry creation completed', {
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
      logger.error('Failed to batch create entries', { error: error.message });
      throw error;
    }
  }

  /**
   * Get summary statistics
   */
  async getSummary(filters = {}) {
    try {
      this.ensureInitialized();

      const entries = await this.getAllEntries(filters);

      const summary = {
        totalEntries: entries.length,
        totalMinutes: entries.reduce((sum, e) => sum + e.durationMinutes, 0),
        billableMinutes: entries.filter(e => e.billable).reduce((sum, e) => sum + e.durationMinutes, 0),
        nonBillableMinutes: entries.filter(e => !e.billable).reduce((sum, e) => sum + e.durationMinutes, 0),
        byProject: {},
        byDate: {}
      };

      // Group by project
      entries.forEach(entry => {
        if (!summary.byProject[entry.projectCode]) {
          summary.byProject[entry.projectCode] = {
            count: 0,
            minutes: 0,
            billableMinutes: 0
          };
        }
        summary.byProject[entry.projectCode].count++;
        summary.byProject[entry.projectCode].minutes += entry.durationMinutes;
        if (entry.billable) {
          summary.byProject[entry.projectCode].billableMinutes += entry.durationMinutes;
        }
      });

      // Group by date
      entries.forEach(entry => {
        if (!summary.byDate[entry.date]) {
          summary.byDate[entry.date] = {
            count: 0,
            minutes: 0
          };
        }
        summary.byDate[entry.date].count++;
        summary.byDate[entry.date].minutes += entry.durationMinutes;
      });

      return summary;
    } catch (error) {
      logger.error('Failed to get summary', { error: error.message });
      throw error;
    }
  }

  /**
   * Export entries to CSV
   */
  async exportToCSV(filters = {}) {
    try {
      this.ensureInitialized();

      const entries = await this.getAllEntries(filters);

      const headers = [
        'ID',
        'Date',
        'Project Code',
        'Task Type',
        'Duration (minutes)',
        'Duration (hours)',
        'Billable',
        'Meeting Title',
        'Description',
        'Confidence',
        'Created At'
      ];

      const rows = entries.map(e => [
        e.id,
        e.date,
        e.projectCode,
        e.taskType,
        e.durationMinutes,
        (e.durationMinutes / 60).toFixed(2),
        e.billable ? 'Yes' : 'No',
        e.meetingTitle || '',
        e.description || '',
        e.confidence.toFixed(2),
        e.createdAt
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      return csv;
    } catch (error) {
      logger.error('Failed to export to CSV', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Format duration for display
   */
  formatDuration(minutes) {
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
}

// Singleton instance
const storageConnector = new StorageConnector();

export default storageConnector;

// Made with Bob
