import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Time allocation engine - handles duration adjustments, rounding, and overlap resolution
 */
class TimeAllocationEngine {
  constructor() {
    this.rules = null;
    this.initialized = false;
  }

  /**
   * Load time allocation rules from config
   */
  async initialize() {
    try {
      const configPath = path.join(__dirname, '../../config/tracking-rules.json');
      const configData = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configData);
      this.rules = config.timeAllocation;
      this.initialized = true;
      logger.info('Time allocation engine initialized');
    } catch (error) {
      logger.error('Failed to initialize time allocation engine', { error: error.message });
      throw error;
    }
  }

  /**
   * Ensure engine is initialized
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('Time allocation engine not initialized. Call initialize() first.');
    }
  }

  /**
   * Round duration to nearest interval
   */
  roundDuration(minutes) {
    this.ensureInitialized();

    const { roundingMinutes } = this.rules;
    
    if (roundingMinutes <= 0) {
      return minutes;
    }

    return Math.round(minutes / roundingMinutes) * roundingMinutes;
  }

  /**
   * Apply min/max duration constraints
   */
  applyDurationConstraints(minutes) {
    this.ensureInitialized();

    const { minDurationMinutes, maxDurationMinutes } = this.rules;

    if (minutes < minDurationMinutes) {
      logger.warn('Duration below minimum', { 
        original: minutes, 
        adjusted: minDurationMinutes 
      });
      return minDurationMinutes;
    }

    if (minutes > maxDurationMinutes) {
      logger.warn('Duration above maximum', { 
        original: minutes, 
        adjusted: maxDurationMinutes 
      });
      return maxDurationMinutes;
    }

    return minutes;
  }

  /**
   * Adjust duration based on attendance data
   */
  adjustForAttendance(meeting) {
    this.ensureInitialized();

    if (!meeting.attendance) {
      return meeting.durationMinutes;
    }

    const { 
      lateJoinThresholdMinutes, 
      earlyLeaveThresholdMinutes 
    } = this.rules;

    const scheduledDuration = meeting.durationMinutes;
    const actualDuration = meeting.attendance.attendanceMinutes;

    // If user joined late or left early beyond threshold, use actual attendance
    const startTime = new Date(meeting.startTime);
    const joinTime = new Date(meeting.attendance.joinedAt);
    const lateMinutes = Math.round((joinTime - startTime) / 60000);

    const endTime = new Date(meeting.endTime);
    const leaveTime = new Date(meeting.attendance.leftAt);
    const earlyMinutes = Math.round((endTime - leaveTime) / 60000);

    if (lateMinutes > lateJoinThresholdMinutes || earlyMinutes > earlyLeaveThresholdMinutes) {
      logger.info('Adjusting duration based on attendance', {
        meetingId: meeting.meetingId,
        scheduled: scheduledDuration,
        actual: actualDuration,
        lateMinutes,
        earlyMinutes
      });
      return actualDuration;
    }

    return scheduledDuration;
  }

  /**
   * Process a single meeting's duration
   */
  processDuration(meeting) {
    this.ensureInitialized();

    // Start with scheduled or actual duration
    let duration = this.adjustForAttendance(meeting);

    // Apply constraints
    duration = this.applyDurationConstraints(duration);

    // Round
    const roundedDuration = this.roundDuration(duration);

    return {
      originalMinutes: meeting.durationMinutes,
      adjustedMinutes: duration,
      roundedMinutes: roundedDuration,
      wasAdjusted: duration !== meeting.durationMinutes,
      wasRounded: roundedDuration !== duration
    };
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
      for (let j = i + 1; j < sorted.length; j++) {
        const meeting1 = sorted[i];
        const meeting2 = sorted[j];
        
        const end1 = new Date(meeting1.endTime);
        const start2 = new Date(meeting2.startTime);
        const end2 = new Date(meeting2.endTime);

        // Check if meetings overlap
        if (end1 > start2) {
          const overlapStart = start2;
          const overlapEnd = end1 < end2 ? end1 : end2;
          const overlapMinutes = Math.round((overlapEnd - overlapStart) / 60000);

          if (overlapMinutes > 0) {
            overlaps.push({
              meeting1,
              meeting2,
              overlapMinutes,
              overlapStart: overlapStart.toISOString(),
              overlapEnd: overlapEnd.toISOString()
            });
          }
        }
      }
    }

    return overlaps;
  }

  /**
   * Resolve overlapping meetings by splitting time proportionally
   */
  resolveOverlaps(meetings) {
    this.ensureInitialized();

    const { overlapHandling } = this.rules;

    if (overlapHandling === 'none') {
      return meetings;
    }

    const overlaps = this.detectOverlaps(meetings);

    if (overlaps.length === 0) {
      return meetings;
    }

    logger.info('Resolving overlapping meetings', { count: overlaps.length });

    // Create a map of adjusted durations
    const adjustments = new Map();
    meetings.forEach(m => {
      adjustments.set(m.meetingId, m.durationMinutes);
    });

    for (const overlap of overlaps) {
      const { meeting1, meeting2, overlapMinutes } = overlap;

      if (overlapHandling === 'split-proportional') {
        // Split overlap time proportionally based on original durations
        const total = meeting1.durationMinutes + meeting2.durationMinutes;
        const ratio1 = meeting1.durationMinutes / total;
        const ratio2 = meeting2.durationMinutes / total;

        const reduction1 = Math.round(overlapMinutes * ratio1);
        const reduction2 = Math.round(overlapMinutes * ratio2);

        adjustments.set(
          meeting1.meetingId, 
          adjustments.get(meeting1.meetingId) - reduction1
        );
        adjustments.set(
          meeting2.meetingId, 
          adjustments.get(meeting2.meetingId) - reduction2
        );

        logger.info('Split overlap proportionally', {
          meeting1: meeting1.title,
          meeting2: meeting2.title,
          overlapMinutes,
          reduction1,
          reduction2
        });
      } else if (overlapHandling === 'prefer-first') {
        // Reduce second meeting only
        adjustments.set(
          meeting2.meetingId,
          adjustments.get(meeting2.meetingId) - overlapMinutes
        );
      }
    }

    // Apply adjustments
    return meetings.map(meeting => ({
      ...meeting,
      adjustedDurationMinutes: Math.max(0, adjustments.get(meeting.meetingId)),
      hadOverlap: adjustments.get(meeting.meetingId) !== meeting.durationMinutes
    }));
  }

  /**
   * Process all meetings with duration adjustments and overlap resolution
   */
  processAllMeetings(meetings) {
    this.ensureInitialized();

    // First, adjust individual meeting durations
    const withDurations = meetings.map(meeting => {
      const duration = this.processDuration(meeting);
      return {
        ...meeting,
        ...duration
      };
    });

    // Then resolve overlaps
    const resolved = this.resolveOverlaps(withDurations);

    // Calculate summary
    const summary = {
      totalMeetings: meetings.length,
      totalOriginalMinutes: meetings.reduce((sum, m) => sum + m.durationMinutes, 0),
      totalAdjustedMinutes: resolved.reduce((sum, m) => sum + (m.adjustedDurationMinutes || m.roundedMinutes), 0),
      meetingsWithOverlaps: resolved.filter(m => m.hadOverlap).length,
      meetingsAdjusted: resolved.filter(m => m.wasAdjusted).length,
      meetingsRounded: resolved.filter(m => m.wasRounded).length
    };

    logger.info('Time allocation processing complete', summary);

    return {
      meetings: resolved,
      summary
    };
  }

  /**
   * Generate time entry from processed meeting
   */
  generateTimeEntry(meeting, issueKey = null) {
    this.ensureInitialized();

    const duration = meeting.adjustedDurationMinutes || meeting.roundedMinutes || meeting.durationMinutes;

    // Build comment with meeting details
    const comment = this.buildTimeEntryComment(meeting);

    return {
      issueKey: issueKey || meeting.classification?.projectCode,
      durationMinutes: duration,
      started: meeting.startTime,
      comment,
      meetingId: meeting.meetingId,
      meetingTitle: meeting.title,
      billable: meeting.classification?.billable || false,
      confidence: meeting.classification?.confidence || 0
    };
  }

  /**
   * Build descriptive comment for time entry
   */
  buildTimeEntryComment(meeting) {
    const parts = [
      `Meeting: ${meeting.title}`,
      `Duration: ${meeting.durationMinutes} minutes`
    ];

    if (meeting.organizer?.name) {
      parts.push(`Organizer: ${meeting.organizer.name}`);
    }

    if (meeting.wasAdjusted) {
      parts.push(`(Adjusted from ${meeting.originalMinutes} minutes)`);
    }

    if (meeting.hadOverlap) {
      parts.push('(Overlap resolved)');
    }

    if (meeting.attendance) {
      parts.push(`Attendance: ${meeting.attendance.attendanceMinutes} minutes`);
    }

    return parts.join(' | ');
  }
}

// Singleton instance
const timeAllocationEngine = new TimeAllocationEngine();

export default timeAllocationEngine;

// Made with Bob
