# Teams Time Tracker MCP Server

An MCP (Model Context Protocol) server that automatically tracks time from Microsoft Teams meetings with intelligent classification and local storage.

## Features

- 📅 **Automatic Meeting Sync**: Fetch meetings from Microsoft Graph API
- 🤖 **Smart Classification**: AI-powered project/task mapping from meeting titles and metadata
- ⏱️ **Time Allocation**: Intelligent duration adjustments, rounding, and overlap resolution
- ✅ **Approval Workflow**: Review suggestions before creating time entries
- 📊 **Confidence Scoring**: Know which classifications need manual review
- 💾 **Local Storage**: All data stored locally in JSON format
- 📈 **Summary Reports**: View time breakdowns by project, date, and billability
- 📤 **CSV Export**: Export your time entries for use in other systems
- 🔒 **Audit Logging**: Complete audit trail of all time tracking actions

## Architecture

```
┌─────────────────┐
│   Bob (MCP      │
│   Client)       │
└────────┬────────┘
         │
         │ MCP Protocol (stdio)
         │
┌────────▼────────────────────────────────────────┐
│  Teams Time Tracker MCP Server                  │
│                                                  │
│  ┌──────────────┐  ┌──────────────┐            │
│  │   Tools      │  │  Resources   │            │
│  │              │  │              │            │
│  │ • List       │  │ • Rules      │            │
│  │ • Classify   │  │ • Mappings   │            │
│  │ • Suggest    │  │ • Docs       │            │
│  │ • Create     │  │              │            │
│  │ • Export     │  │              │            │
│  └──────────────┘  └──────────────┘            │
│                                                  │
│  ┌──────────────────────────────────────────┐  │
│  │  Classification & Time Allocation Engine │  │
│  └──────────────────────────────────────────┘  │
└────────┬─────────────────────────┬──────────────┘
         │                         │
         │                         │
┌────────▼────────┐       ┌────────▼────────┐
│ Microsoft Graph │       │  Local Storage  │
│ (Teams/Calendar)│       │  (JSON files)   │
└─────────────────┘       └─────────────────┘
```

## Installation

### Prerequisites

- Node.js 18+ (for ES modules support)
- Microsoft 365 account with Teams access
- Azure AD app registration (for Microsoft Graph API)

### Setup

1. **Clone and install dependencies**:
```bash
git clone <repository-url>
cd TaskTimeTracker
npm install
```

2. **Configure Azure AD App**:
   - Go to [Azure Portal](https://portal.azure.com)
   - Register a new application
   - Add API permissions:
     - `Calendars.Read`
     - `OnlineMeetings.Read`
     - `User.Read`
   - Create a client secret
   - Note your Tenant ID, Client ID, and Client Secret

3. **Create environment file**:
```bash
cp .env.example .env
```

4. **Edit `.env` with your credentials**:
```env
# Microsoft Graph API
MICROSOFT_TENANT_ID=your-tenant-id
MICROSOFT_CLIENT_ID=your-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret

# User Configuration
DEFAULT_USER_EMAIL=your-email@company.com

# Time Tracking Rules
DEFAULT_PROJECT_CODE=GENERAL
ROUNDING_MINUTES=15
MIN_MEETING_DURATION_MINUTES=5

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=./logs
```

5. **Customize classification rules** (optional):
   - Edit `config/tracking-rules.json`
   - Add your project patterns, organizer mappings, etc.

## Usage

### Running the Server

```bash
npm start
```

The server runs as an MCP server using stdio transport, designed to be used with MCP clients like Claude Desktop or other MCP-compatible tools.

### Available Tools

#### 1. `list_recent_meetings`
Fetch calendar meetings for a date range.

```json
{
  "userEmail": "user@company.com",
  "startDate": "2026-06-16T00:00:00Z",
  "endDate": "2026-06-16T23:59:59Z"
}
```

#### 2. `suggest_time_entries`
Analyze meetings and generate time tracking suggestions.

```json
{
  "userEmail": "user@company.com",
  "startDate": "2026-06-16T00:00:00Z",
  "endDate": "2026-06-16T23:59:59Z",
  "minConfidence": 0.5
}
```

#### 3. `create_time_entries`
Create time entries in local storage (with approval).

```json
{
  "entries": [
    {
      "projectCode": "PROJ",
      "durationMinutes": 60,
      "description": "Meeting: Sprint Planning",
      "startTime": "2026-06-16T14:00:00Z",
      "billable": false
    }
  ],
  "dryRun": true
}
```

#### 4. `sync_meetings_to_tracker`
End-to-end sync (fetch → classify → create).

```json
{
  "userEmail": "user@company.com",
  "startDate": "2026-06-16T00:00:00Z",
  "endDate": "2026-06-16T23:59:59Z",
  "dryRun": true
}
```

#### 5. `get_time_summary`
Get summary statistics of logged time.

```json
{
  "startDate": "2026-06-16",
  "endDate": "2026-06-22"
}
```

#### 6. `get_time_entries`
Retrieve all logged time entries with filters.

```json
{
  "startDate": "2026-06-16",
  "projectCode": "PROJ",
  "billable": true
}
```

#### 7. `export_time_entries`
Export time entries to CSV format.

```json
{
  "startDate": "2026-06-01",
  "endDate": "2026-06-30"
}
```

### Available Resources

- `policy://time-tracking-rules` - View classification rules
- `mapping://project-codes` - See project mappings
- `docs://usage-guide` - User guide
- `docs://api-reference` - API documentation

### Available Prompts

- `review-daily-timesheet` - Review and approve daily entries
- `weekly-summary` - Generate weekly meeting summary

## Workflow Example

### Daily Time Tracking with Bob

1. **Bob asks**: "Review my meetings for today and suggest time entries"

2. **Bob uses** `list_recent_meetings` to fetch today's meetings

3. **Bob uses** `suggest_time_entries` to classify and generate suggestions

4. **Bob presents** suggestions grouped by project with confidence scores

5. **You review** and approve the suggestions

6. **Bob uses** `create_time_entries` with `dryRun: false` to create entries

7. **Later, you can** use `get_time_summary` to see your weekly totals

8. **Export** with `export_time_entries` to import into other systems

### Using Prompts

```
Bob, use the review-daily-timesheet prompt for today
```

This automatically guides Bob through the entire workflow.

## Classification Rules

### Automatic Project Detection

The system uses multiple strategies to map meetings to projects:

1. **Title Patterns**: Regex matching on meeting titles
   - `"Project FALCON Sprint Planning"` → `FALCON`
   - `"Sprint Planning"` → `SCRUM`
   - `"1:1 with Manager"` → `ADMIN`

2. **Organizer Mapping**: Map specific organizers to projects
   - `manager@company.com` → `ADMIN`

3. **Channel Mapping**: Teams channel to project mapping
   - `"Project Falcon"` channel → `FALCON`

4. **Keyword Detection**: Billable/non-billable patterns
   - `"Client"`, `"Customer"` → billable
   - `"Internal"`, `"Team"` → non-billable

### Exclusion Rules

Meetings are automatically excluded if:
- Cancelled
- User declined
- Title contains: "Lunch", "Break", "OOO", "Personal"
- Category is "Personal" or "Holiday"

### Time Allocation

- **Rounding**: 15-minute intervals (configurable)
- **Min duration**: 5 minutes
- **Max duration**: 480 minutes (8 hours)
- **Overlap handling**: Split proportionally between overlapping meetings
- **Attendance adjustment**: Use actual join/leave times when available

### Confidence Levels

- **High (≥0.8)**: Strong pattern match, safe to auto-approve
- **Medium (≥0.5)**: Good match, review recommended
- **Low (≥0.3)**: Weak match, manual review required
- **Very Low (<0.3)**: Default fallback, needs attention

## Data Storage

All time entries are stored locally in `data/time-entries.json`:

```json
{
  "entries": [
    {
      "id": "entry_1234567890_abc123",
      "projectCode": "PROJ",
      "taskType": "meeting",
      "durationMinutes": 60,
      "date": "2026-06-16",
      "startTime": "2026-06-16T14:00:00Z",
      "description": "Meeting: Sprint Planning",
      "meetingId": "meeting-id",
      "meetingTitle": "Sprint Planning",
      "billable": false,
      "confidence": 0.85,
      "createdAt": "2026-06-16T14:30:00Z",
      "status": "logged"
    }
  ]
}
```

### Backup Your Data

The `data/` directory contains all your time tracking data. Back it up regularly:

```bash
cp data/time-entries.json data/time-entries.backup.json
```

## Customization

### Adding Project Patterns

Edit `config/tracking-rules.json`:

```json
{
  "classification": {
    "projectMapping": {
      "patterns": [
        {
          "pattern": "Project (\\w+)",
          "projectCodeGroup": 1,
          "taskType": "project-work"
        }
      ]
    }
  }
}
```

### Adding Organizer Mappings

```json
{
  "organizerMapping": {
    "manager@company.com": {
      "defaultProject": "ADMIN",
      "defaultTaskType": "management"
    }
  }
}
```

## Security & Privacy

### Data Handling
- All data stored locally in `data/` directory
- No external services except Microsoft Graph
- Audit logs record actions, not content
- Credentials stored in environment variables only

### Permissions Required
- **Microsoft Graph**: Read calendar and meeting data
- No write access to calendars or meetings

### Approval Workflow
- `dryRun: true` by default for all write operations
- Explicit approval required before creating time entries
- All actions logged to audit trail

## Troubleshooting

### No meetings found
- Verify date range format (ISO 8601)
- Check user email is correct
- Ensure Microsoft Graph permissions are granted

### Low confidence scores
- Add more patterns to `tracking-rules.json`
- Use organizer mapping for common meeting organizers
- Consider manual project assignment for edge cases

### Attendance data unavailable
- Requires meeting organizer permissions
- Needs tenant admin consent for attendance reports
- Falls back to scheduled duration if unavailable

## Logs

Logs are written to the `logs/` directory:
- `combined.log` - All logs
- `error.log` - Errors only
- `audit.log` - Audit trail of all actions

## Development

### Project Structure

```
TaskTimeTracker/
├── config/
│   ├── server-config.json       # Server configuration
│   └── tracking-rules.json      # Classification rules
├── src/
│   ├── auth/
│   │   └── graph-client.js      # Microsoft Graph authentication
│   ├── connectors/
│   │   ├── teams.js             # Teams meeting connector
│   │   └── storage.js           # Local JSON storage
│   ├── rules/
│   │   ├── classification.js    # Meeting classification engine
│   │   └── time-allocation.js   # Time allocation engine
│   ├── tools/
│   │   └── meeting-tools.js     # MCP tool definitions
│   ├── resources/
│   │   └── documentation.js     # MCP resource definitions
│   ├── utils/
│   │   └── logger.js            # Winston logger
│   └── server.js                # Main MCP server
├── data/                        # Time entries (created at runtime)
├── logs/                        # Log files (created at runtime)
├── .env                         # Environment variables
├── package.json                 # Dependencies
└── README.md                    # This file
```

### Running in Development

```bash
npm run dev
```

This uses Node's `--watch` flag to auto-restart on file changes.

## License

MIT

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request