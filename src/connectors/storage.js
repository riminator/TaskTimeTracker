import { Pool } from 'pg';
import logger from '../utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Postgres storage connector - stores time entries in PostgreSQL
 */
class StorageConnector {
  constructor() {
    this.databaseUrl = process.env.DATABASE_URL;
    this.pool = null;
    this.initialized = false;
  }

  /**
   * Initialize the storage
   */
  async initialize() {
    try {
      if (!this.databaseUrl) {
        throw new Error('DATABASE_URL is required for Postgres storage');
      }

      const sslEnabled = process.env.PGSSL === 'true'
        || this.databaseUrl.includes('railway.app')
        || this.databaseUrl.includes('neon.tech')
        || this.databaseUrl.includes('render.com')
        || this.databaseUrl.includes('sslmode=require');

      this.pool = new Pool({
        connectionString: this.databaseUrl,
        ssl: sslEnabled ? { rejectUnauthorized: false } : false
      });

      await this.pool.query('SELECT 1');

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS time_entries (
          id TEXT PRIMARY KEY,
          project_code TEXT NOT NULL DEFAULT 'GENERAL',
          task_type TEXT NOT NULL DEFAULT 'meeting',
          duration_minutes NUMERIC NOT NULL,
          entry_date DATE NOT NULL,
          start_time TIMESTAMPTZ,
          end_time TIMESTAMPTZ,
          description TEXT,
          meeting_id TEXT,
          meeting_title TEXT,
          billable BOOLEAN NOT NULL DEFAULT FALSE,
          confidence NUMERIC NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'logged',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ,
          organizer TEXT,
          attendees TEXT
        )
      `);

      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_time_entries_entry_date
        ON time_entries (entry_date)
      `);

      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_time_entries_project_code
        ON time_entries (project_code)
      `);

      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_time_entries_billable
        ON time_entries (billable)
      `);

      this.initialized = true;
      logger.info('Postgres storage connector initialized');
      return true;
    } catch (error) {
      const safeUrl = this.databaseUrl
        ? this.databaseUrl.replace(/:\/\/[^@]+@/, '://***:***@')
        : 'not set';
      console.error('Failed to initialize Postgres storage connector');
      console.error('DATABASE_URL (redacted):', safeUrl);
      console.error('Error:', error.message);
      logger.error('Failed to initialize Postgres storage connector', {
        error: error.message,
        stack: error.stack
      });
      this.initialized = false;
      return false;
    }
  }

  /**
   * Ensure storage is initialized
   */
  ensureInitialized() {
    if (!this.initialized || !this.pool) {
      throw new Error('Storage connector not initialized. Call initialize() first.');
    }
  }

  /**
   * Normalize DB row to API shape
   */
  mapRow(row) {
    return {
      id: row.id,
      projectCode: row.project_code,
      taskType: row.task_type,
      durationMinutes: Number(row.duration_minutes),
      date: row.entry_date instanceof Date
        ? `${row.entry_date.getFullYear()}-${String(row.entry_date.getMonth() + 1).padStart(2, '0')}-${String(row.entry_date.getDate()).padStart(2, '0')}`
        : row.entry_date,
      startTime: row.start_time ? new Date(row.start_time).toISOString() : null,
      endTime: row.end_time ? new Date(row.end_time).toISOString() : null,
      description: row.description,
      meetingId: row.meeting_id,
      meetingTitle: row.meeting_title,
      billable: row.billable,
      confidence: Number(row.confidence),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
      status: row.status,
      organizer: row.organizer,
      attendees: row.attendees
    };
  }

  /**
   * Create a new time entry
   */
  async createEntry(entry) {
    try {
      this.ensureInitialized();

      const newEntry = {
        id: this.generateId(),
        projectCode: entry.projectCode || 'GENERAL',
        taskType: entry.taskType || 'meeting',
        durationMinutes: Number(entry.durationMinutes),
        date: entry.date || new Date().toISOString().split('T')[0],
        startTime: entry.startTime || null,
        endTime: entry.endTime || null,
        description: entry.description || null,
        meetingId: entry.meetingId || null,
        meetingTitle: entry.meetingTitle || null,
        billable: Boolean(entry.billable),
        confidence: Number(entry.confidence || 0),
        status: entry.status || 'logged',
        organizer: entry.organizer || null,
        attendees: Array.isArray(entry.attendees)
          ? entry.attendees.join(', ')
          : (entry.attendees || null)
      };

      const result = await this.pool.query(
        `
          INSERT INTO time_entries (
            id, project_code, task_type, duration_minutes, entry_date,
            start_time, end_time, description, meeting_id, meeting_title,
            billable, confidence, status, organizer, attendees
          )
          VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15
          )
          RETURNING *
        `,
        [
          newEntry.id,
          newEntry.projectCode,
          newEntry.taskType,
          newEntry.durationMinutes,
          newEntry.date,
          newEntry.startTime,
          newEntry.endTime,
          newEntry.description,
          newEntry.meetingId,
          newEntry.meetingTitle,
          newEntry.billable,
          newEntry.confidence,
          newEntry.status,
          newEntry.organizer,
          newEntry.attendees
        ]
      );

      logger.audit('time_entry_created', {
        id: newEntry.id,
        projectCode: newEntry.projectCode,
        durationMinutes: newEntry.durationMinutes
      });

      return this.mapRow(result.rows[0]);
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

      const conditions = [];
      const values = [];

      if (filters.startDate) {
        values.push(filters.startDate);
        conditions.push(`entry_date >= $${values.length}`);
      }
      if (filters.endDate) {
        values.push(filters.endDate);
        conditions.push(`entry_date <= $${values.length}`);
      }
      if (filters.projectCode) {
        values.push(filters.projectCode);
        conditions.push(`project_code = $${values.length}`);
      }
      if (filters.billable !== undefined) {
        values.push(filters.billable);
        conditions.push(`billable = $${values.length}`);
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const result = await this.pool.query(
        `
          SELECT *
          FROM time_entries
          ${whereClause}
          ORDER BY entry_date DESC, created_at DESC
        `,
        values
      );

      return result.rows.map(row => this.mapRow(row));
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

      const result = await this.pool.query(
        'SELECT * FROM time_entries WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        throw new Error(`Entry not found: ${id}`);
      }

      return this.mapRow(result.rows[0]);
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

      const existing = await this.getEntry(id);

      const merged = {
        ...existing,
        ...updates
      };

      const attendees = Array.isArray(merged.attendees)
        ? merged.attendees.join(', ')
        : (merged.attendees || null);

      const result = await this.pool.query(
        `
          UPDATE time_entries
          SET
            project_code = $2,
            task_type = $3,
            duration_minutes = $4,
            entry_date = $5,
            start_time = $6,
            end_time = $7,
            description = $8,
            meeting_id = $9,
            meeting_title = $10,
            billable = $11,
            confidence = $12,
            status = $13,
            organizer = $14,
            attendees = $15,
            updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `,
        [
          id,
          merged.projectCode || 'GENERAL',
          merged.taskType || 'meeting',
          Number(merged.durationMinutes),
          merged.date,
          merged.startTime || null,
          merged.endTime || null,
          merged.description || null,
          merged.meetingId || null,
          merged.meetingTitle || null,
          Boolean(merged.billable),
          Number(merged.confidence || 0),
          merged.status || 'logged',
          merged.organizer || null,
          attendees
        ]
      );

      logger.audit('time_entry_updated', {
        id,
        updates: Object.keys(updates)
      });

      return this.mapRow(result.rows[0]);
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

      const result = await this.pool.query(
        'DELETE FROM time_entries WHERE id = $1 RETURNING id',
        [id]
      );

      if (result.rows.length === 0) {
        throw new Error(`Entry not found: ${id}`);
      }

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
        totalMinutes: entries.reduce((sum, e) => sum + Number(e.durationMinutes), 0),
        billableMinutes: entries.filter(e => e.billable).reduce((sum, e) => sum + Number(e.durationMinutes), 0),
        nonBillableMinutes: entries.filter(e => !e.billable).reduce((sum, e) => sum + Number(e.durationMinutes), 0),
        byProject: {},
        byDate: {}
      };

      entries.forEach(entry => {
        if (!summary.byProject[entry.projectCode]) {
          summary.byProject[entry.projectCode] = {
            count: 0,
            minutes: 0,
            billableMinutes: 0
          };
        }
        summary.byProject[entry.projectCode].count++;
        summary.byProject[entry.projectCode].minutes += Number(entry.durationMinutes);
        if (entry.billable) {
          summary.byProject[entry.projectCode].billableMinutes += Number(entry.durationMinutes);
        }
      });

      entries.forEach(entry => {
        if (!summary.byDate[entry.date]) {
          summary.byDate[entry.date] = {
            count: 0,
            minutes: 0
          };
        }
        summary.byDate[entry.date].count++;
        summary.byDate[entry.date].minutes += Number(entry.durationMinutes);
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
        (Number(e.durationMinutes) / 60).toFixed(2),
        e.billable ? 'Yes' : 'No',
        e.meetingTitle || '',
        e.description || '',
        Number(e.confidence).toFixed(2),
        e.createdAt
      ]);

      return [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      ].join('\n');
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
    const totalMinutes = Number(minutes);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

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
