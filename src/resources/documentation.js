import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Documentation resources for MCP clients
 */

export const trackingRulesResource = {
  uri: 'policy://time-tracking-rules',
  name: 'Time Tracking Rules',
  description: 'Classification rules, exclusion patterns, and billability policies',
  mimeType: 'application/json',
  read: async () => {
    const configPath = path.join(__dirname, '../../config/tracking-rules.json');
    const content = fs.readFileSync(configPath, 'utf8');
    return content;
  }
};

export const projectMappingResource = {
  uri: 'mapping://project-codes',
  name: 'Project Code Mappings',
  description: 'Mapping rules for meeting titles, organizers, and channels to project codes',
  mimeType: 'application/json',
  read: async () => {
    const configPath = path.join(__dirname, '../../config/tracking-rules.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    return JSON.stringify({
      projectMapping: config.classification.projectMapping,
      description: 'Rules for mapping meetings to project codes and task types'
    }, null, 2);
  }
};

export const usageGuideResource = {
  uri: 'docs://usage-guide',
  name: 'Usage Guide',
  description: 'How to use the Teams time tracker MCP server',
  mimeType: 'text/markdown',
  read: async () => {
    return `# Teams Time Tracker - Usage Guide

## Overview
This MCP server syncs Microsoft Teams meetings to Jira time tracking.

## Workflow

### 1. List Recent Meetings
\`\`\`
Tool: list_recent_meetings
Parameters:
  - userEmail: your-email@company.com
  - startDate: 2026-06-16T00:00:00Z
  - endDate: 2026-06-16T23:59:59Z
\`\`\`

### 2. Get Suggestions
\`\`\`
Tool: suggest_time_entries
Parameters:
  - userEmail: your-email@company.com
  - startDate: 2026-06-16T00:00:00Z
  - endDate: 2026-06-16T23:59:59Z
  - minConfidence: 0.5
\`\`\`

This will:
- Fetch your meetings
- Classify them by project/task
- Apply time allocation rules
- Generate suggested time entries

### 3. Review and Approve
Review the suggestions. Check:
- Project code mappings
- Duration adjustments
- Billability classification
- Confidence scores

### 4. Create Entries
\`\`\`
Tool: create_time_entries
Parameters:
  - entries: [array of approved entries]
  - dryRun: false
\`\`\`

**Important**: Always use dryRun: true first to validate!

### 5. One-Step Sync
\`\`\`
Tool: sync_meetings_to_tracker
Parameters:
  - userEmail: your-email@company.com
  - startDate: 2026-06-16T00:00:00Z
  - endDate: 2026-06-16T23:59:59Z
  - dryRun: true
  - minConfidence: 0.5
\`\`\`

## Classification Rules

### Automatic Project Detection
- **Title patterns**: "Project FALCON Sprint Planning" → FALCON
- **Organizer mapping**: manager@company.com → ADMIN
- **Keywords**: "Client", "Customer" → billable

### Exclusions
Meetings are excluded if:
- Cancelled
- User declined
- Title contains: "Lunch", "Break", "OOO", "Personal"
- Category is "Personal" or "Holiday"

### Time Allocation
- **Rounding**: 15-minute intervals (configurable)
- **Min duration**: 5 minutes
- **Max duration**: 480 minutes (8 hours)
- **Overlap handling**: Split proportionally

## Confidence Levels
- **High (≥0.8)**: Strong pattern match, safe to auto-approve
- **Medium (≥0.5)**: Good match, review recommended
- **Low (≥0.3)**: Weak match, manual review required
- **Very Low (<0.3)**: Default fallback, needs attention

## Best Practices

1. **Start with dry runs**: Always test with dryRun: true
2. **Review low confidence**: Manually verify entries below 0.5
3. **Check overlaps**: System detects and resolves overlapping meetings
4. **Verify billability**: Review billable classifications before submitting
5. **Use date ranges**: Process one day or week at a time
6. **Monitor audit logs**: Check logs/audit.log for all actions

## Customization

Edit \`config/tracking-rules.json\` to customize:
- Project mapping patterns
- Exclusion rules
- Billability patterns
- Time allocation settings
- Confidence thresholds

## Troubleshooting

### No meetings found
- Check date range format (ISO 8601)
- Verify user email
- Ensure Microsoft Graph permissions

### Low confidence scores
- Add more patterns to tracking-rules.json
- Use organizer mapping
- Consider manual project assignment

### Attendance data unavailable
- Requires meeting organizer permissions
- Needs tenant admin consent
- Falls back to scheduled duration

## Resources

- \`policy://time-tracking-rules\`: View current rules
- \`mapping://project-codes\`: See project mappings
- \`docs://api-reference\`: API documentation
`;
  }
};

export const apiReferenceResource = {
  uri: 'docs://api-reference',
  name: 'API Reference',
  description: 'Complete API documentation for all tools',
  mimeType: 'text/markdown',
  read: async () => {
    return `# Teams Time Tracker - API Reference

## Tools

### list_recent_meetings
Retrieve calendar meetings for a user within a date range.

**Parameters:**
- \`userEmail\` (string, required): User's email address
- \`startDate\` (string, required): ISO 8601 start date
- \`endDate\` (string, required): ISO 8601 end date
- \`includeCancelled\` (boolean, optional): Include cancelled meetings
- \`includeDeclined\` (boolean, optional): Include declined meetings
- \`onlineOnly\` (boolean, optional): Only online meetings

**Returns:**
\`\`\`json
{
  "success": true,
  "count": 5,
  "meetings": [...]
}
\`\`\`

### get_meeting_attendance
Get detailed attendance information for an online meeting.

**Parameters:**
- \`userEmail\` (string, required): User's email address
- \`meetingId\` (string, required): Meeting ID

**Returns:**
\`\`\`json
{
  "success": true,
  "attendance": {
    "joinedAt": "2026-06-16T14:03:00Z",
    "leftAt": "2026-06-16T14:57:00Z",
    "attendanceMinutes": 54,
    "totalParticipants": 8
  }
}
\`\`\`

### suggest_time_entries
Analyze meetings and generate time tracking suggestions.

**Parameters:**
- \`userEmail\` (string, required): User's email address
- \`startDate\` (string, required): ISO 8601 start date
- \`endDate\` (string, required): ISO 8601 end date
- \`includeAttendance\` (boolean, optional): Enrich with attendance data
- \`minConfidence\` (number, optional): Minimum confidence (0-1)

**Returns:**
\`\`\`json
{
  "success": true,
  "summary": {
    "totalMeetings": 10,
    "includedMeetings": 8,
    "excludedMeetings": 2,
    "suggestedEntries": 8,
    "totalMinutes": 360
  },
  "suggestions": [...],
  "byProject": [...],
  "excluded": [...]
}
\`\`\`

### create_time_entries
Create time tracking entries in Jira.

**Parameters:**
- \`entries\` (array, required): Array of time entry objects
- \`dryRun\` (boolean, optional): Validate without creating

**Entry Object:**
\`\`\`json
{
  "issueKey": "PROJ-123",
  "durationMinutes": 60,
  "comment": "Meeting: Sprint Planning",
  "started": "2026-06-16T14:00:00Z"
}
\`\`\`

**Returns:**
\`\`\`json
{
  "success": true,
  "dryRun": false,
  "summary": {
    "total": 5,
    "successful": 5,
    "failed": 0
  },
  "results": [...],
  "errors": []
}
\`\`\`

### sync_meetings_to_tracker
End-to-end sync: fetch, classify, and create entries.

**Parameters:**
- \`userEmail\` (string, required): User's email address
- \`startDate\` (string, required): ISO 8601 start date
- \`endDate\` (string, required): ISO 8601 end date
- \`dryRun\` (boolean, optional): Generate suggestions only
- \`minConfidence\` (number, optional): Minimum confidence (0-1)

**Returns:**
\`\`\`json
{
  "success": true,
  "dryRun": true,
  "suggestions": {...},
  "entries": [...]
}
\`\`\`

### get_available_projects
List all accessible Jira projects.

**Parameters:** None

**Returns:**
\`\`\`json
{
  "success": true,
  "count": 15,
  "projects": [
    {
      "key": "PROJ",
      "name": "Project Name",
      "id": "10001"
    }
  ]
}
\`\`\`

## Resources

### policy://time-tracking-rules
Complete classification and allocation rules (JSON)

### mapping://project-codes
Project code mapping configuration (JSON)

### docs://usage-guide
User guide and best practices (Markdown)

### docs://api-reference
This API reference (Markdown)

## Error Handling

All tools return structured error responses:
\`\`\`json
{
  "success": false,
  "error": "Error message",
  "details": {...}
}
\`\`\`

## Authentication

Requires environment variables:
- \`MICROSOFT_TENANT_ID\`
- \`MICROSOFT_CLIENT_ID\`
- \`MICROSOFT_CLIENT_SECRET\`
- \`JIRA_HOST\`
- \`JIRA_EMAIL\`
- \`JIRA_API_TOKEN\`
`;
  }
};

// Export all resources
export const documentationResources = [
  trackingRulesResource,
  projectMappingResource,
  usageGuideResource,
  apiReferenceResource
];

// Made with Bob
