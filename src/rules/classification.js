import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Meeting classification engine - applies rules to determine project/task mapping
 */
class ClassificationEngine {
  constructor() {
    this.rules = null;
    this.initialized = false;
  }

  /**
   * Load classification rules from config
   */
  async initialize() {
    try {
      const configPath = path.join(__dirname, '../../config/tracking-rules.json');
      const configData = fs.readFileSync(configPath, 'utf8');
      this.rules = JSON.parse(configData);
      this.initialized = true;
      logger.info('Classification engine initialized');
    } catch (error) {
      logger.error('Failed to initialize classification engine', { error: error.message });
      throw error;
    }
  }

  /**
   * Ensure engine is initialized
   */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('Classification engine not initialized. Call initialize() first.');
    }
  }

  /**
   * Check if meeting should be excluded from tracking
   */
  shouldExclude(meeting) {
    this.ensureInitialized();

    const { exclusions } = this.rules.classification;

    // Check if cancelled
    if (meeting.isCancelled) {
      return { excluded: true, reason: 'Meeting is cancelled' };
    }

    // Check if user declined
    if (!meeting.userAccepted) {
      return { excluded: true, reason: 'User declined meeting' };
    }

    // Check title patterns
    const title = meeting.title.toLowerCase();
    for (const pattern of exclusions.titlePatterns) {
      if (title.includes(pattern.toLowerCase())) {
        return { excluded: true, reason: `Title matches exclusion pattern: ${pattern}` };
      }
    }

    // Check categories
    for (const category of meeting.categories) {
      if (exclusions.categories.includes(category)) {
        return { excluded: true, reason: `Category matches exclusion: ${category}` };
      }
    }

    return { excluded: false };
  }

  /**
   * Extract project code from meeting title using patterns
   */
  extractProjectFromTitle(title) {
    this.ensureInitialized();

    const { patterns } = this.rules.classification.projectMapping;

    for (const pattern of patterns) {
      const regex = new RegExp(pattern.pattern, 'i');
      const match = title.match(regex);

      if (match) {
        if (pattern.projectCodeGroup && match[pattern.projectCodeGroup]) {
          return {
            projectCode: match[pattern.projectCodeGroup].toUpperCase(),
            taskType: pattern.taskType,
            confidence: 0.9,
            source: 'title-pattern'
          };
        } else if (pattern.projectCode) {
          return {
            projectCode: pattern.projectCode,
            taskType: pattern.taskType,
            confidence: 0.85,
            source: 'title-pattern'
          };
        }
      }
    }

    return null;
  }

  /**
   * Get project mapping from organizer
   */
  getProjectFromOrganizer(organizerEmail) {
    this.ensureInitialized();

    const { organizerMapping } = this.rules.classification.projectMapping;

    if (organizerMapping[organizerEmail]) {
      const mapping = organizerMapping[organizerEmail];
      return {
        projectCode: mapping.defaultProject,
        taskType: mapping.defaultTaskType,
        confidence: 0.6,
        source: 'organizer-mapping'
      };
    }

    return null;
  }

  /**
   * Determine if meeting is billable
   */
  determineBillability(meeting, classification) {
    this.ensureInitialized();

    const { billableRules } = this.rules.classification;
    const title = meeting.title.toLowerCase();

    // Check billable patterns
    for (const pattern of billableRules.billablePatterns) {
      if (title.includes(pattern.toLowerCase())) {
        return {
          billable: true,
          confidence: 0.8,
          reason: `Title matches billable pattern: ${pattern}`
        };
      }
    }

    // Check non-billable patterns
    for (const pattern of billableRules.nonBillablePatterns) {
      if (title.includes(pattern.toLowerCase())) {
        return {
          billable: false,
          confidence: 0.8,
          reason: `Title matches non-billable pattern: ${pattern}`
        };
      }
    }

    // Default
    return {
      billable: billableRules.defaultBillable,
      confidence: 0.3,
      reason: 'Default billability rule'
    };
  }

  /**
   * Calculate overall confidence score
   */
  calculateConfidence(classifications) {
    this.ensureInitialized();

    const { weights } = this.rules.confidence;
    let totalScore = 0;
    let totalWeight = 0;

    if (classifications.titleMatch) {
      totalScore += classifications.titleMatch.confidence * weights.titleMatch;
      totalWeight += weights.titleMatch;
    }

    if (classifications.organizerMatch) {
      totalScore += classifications.organizerMatch.confidence * weights.organizerMatch;
      totalWeight += weights.organizerMatch;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  /**
   * Classify a single meeting
   */
  classifyMeeting(meeting) {
    this.ensureInitialized();

    // Check exclusions first
    const exclusion = this.shouldExclude(meeting);
    if (exclusion.excluded) {
      return {
        excluded: true,
        reason: exclusion.reason,
        projectCode: null,
        taskType: null,
        billable: false,
        confidence: 0
      };
    }

    // Try to extract project from title
    const titleMatch = this.extractProjectFromTitle(meeting.title);
    
    // Try to get project from organizer
    const organizerMatch = meeting.organizer?.email 
      ? this.getProjectFromOrganizer(meeting.organizer.email)
      : null;

    // Use the classification with highest confidence
    let classification = titleMatch || organizerMatch;

    if (!classification) {
      // Fallback to default
      classification = {
        projectCode: process.env.DEFAULT_PROJECT_CODE || 'GENERAL',
        taskType: 'meeting',
        confidence: 0.2,
        source: 'default'
      };
    }

    // Determine billability
    const billability = this.determineBillability(meeting, classification);

    // Calculate overall confidence
    const overallConfidence = this.calculateConfidence({
      titleMatch,
      organizerMatch
    });

    return {
      excluded: false,
      projectCode: classification.projectCode,
      taskType: classification.taskType,
      billable: billability.billable,
      confidence: Math.max(classification.confidence, overallConfidence),
      source: classification.source,
      billabilityReason: billability.reason
    };
  }

  /**
   * Classify multiple meetings
   */
  classifyMeetings(meetings) {
    this.ensureInitialized();

    const classified = meetings.map(meeting => ({
      ...meeting,
      classification: this.classifyMeeting(meeting)
    }));

    // Filter out excluded meetings
    const included = classified.filter(m => !m.classification.excluded);
    const excluded = classified.filter(m => m.classification.excluded);

    logger.info('Meetings classified', {
      total: meetings.length,
      included: included.length,
      excluded: excluded.length
    });

    return {
      included,
      excluded,
      summary: {
        total: meetings.length,
        included: included.length,
        excluded: excluded.length
      }
    };
  }

  /**
   * Get confidence level label
   */
  getConfidenceLevel(confidence) {
    this.ensureInitialized();

    const { thresholds } = this.rules.confidence;

    if (confidence >= thresholds.high) {
      return 'high';
    } else if (confidence >= thresholds.medium) {
      return 'medium';
    } else if (confidence >= thresholds.low) {
      return 'low';
    } else {
      return 'very-low';
    }
  }

  /**
   * Group meetings by project
   */
  groupByProject(classifiedMeetings) {
    const grouped = {};

    for (const meeting of classifiedMeetings) {
      const projectCode = meeting.classification.projectCode;
      
      if (!grouped[projectCode]) {
        grouped[projectCode] = {
          projectCode,
          meetings: [],
          totalMinutes: 0,
          billableMinutes: 0
        };
      }

      grouped[projectCode].meetings.push(meeting);
      grouped[projectCode].totalMinutes += meeting.durationMinutes;
      
      if (meeting.classification.billable) {
        grouped[projectCode].billableMinutes += meeting.durationMinutes;
      }
    }

    return Object.values(grouped);
  }
}

// Singleton instance
const classificationEngine = new ClassificationEngine();

export default classificationEngine;

// Made with Bob
