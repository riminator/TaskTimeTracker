# Setup Guide - Teams Time Tracker MCP Server

This guide walks you through setting up the Teams Time Tracker MCP server. **Choose your setup path based on your access level.**

## Choose Your Setup Path

### Path 1: Full Automation (Requires Azure AD)
- ✅ Automatic Teams meeting sync
- ✅ Real-time calendar integration
- ✅ Attendance tracking
- ❌ Requires Azure AD app registration
- ❌ May need IT admin approval

**→ Follow: [Azure AD Setup](#azure-ad-setup-full-automation)**

### Path 2: Hybrid Mode (No Azure AD Required) ⭐ RECOMMENDED
- ✅ Manual meeting entry or calendar file import
- ✅ Same smart classification
- ✅ All reporting features
- ✅ No IT approval needed
- ✅ Works immediately

**→ Follow: [Hybrid Setup](#hybrid-setup-no-azure-ad)**

### Path 3: OpenShift Deployment
- ✅ Deploy to enterprise cluster
- ✅ Persistent storage
- ✅ Scalable
- ✅ Works with or without Azure AD

**→ Follow: [OPENSHIFT_DEPLOYMENT.md](OPENSHIFT_DEPLOYMENT.md)**

---

## Hybrid Setup (No Azure AD)

This is the **easiest and fastest** way to get started. No Azure AD, no IT approval needed.

### Prerequisites

- Node.js 18+ installed
- 10 minutes

### Step 1: Install

```bash
# Clone or download the project
cd TaskTimeTracker

# Install dependencies
npm install
```

### Step 2: Configure (Minimal)

Create `.env` file:

```bash
cp .env.example .env
```

Edit `.env` - you only need these:

```env
# No Microsoft credentials needed!

# Time Tracking Rules
DEFAULT_PROJECT_CODE=GENERAL
ROUNDING_MINUTES=15
MIN_MEETING_DURATION_MINUTES=5

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=./logs
```

### Step 3: Customize Rules (Optional)

Edit `config/tracking-rules.json` to add your project patterns:

```json
{
  "classification": {
    "projectMapping": {
      "patterns": [
        {
          "pattern": "Project (\\w+)",
          "projectCodeGroup": 1,
          "taskType": "project-work"
        },
        {
          "pattern": "YOUR-PROJECT-NAME",
          "projectCode": "YOUR-CODE",
          "taskType": "meeting"
        }
      ]
    }
  }
}
```

### Step 4: Start the Server

```bash
npm start
```

Expected output:
```
Teams Time Tracker MCP Server initialized
Registering tools
Registered tool: add_manual_meeting
Registered tool: add_quick_entry
Registered tool: import_calendar_file
...
Server is ready to accept requests via stdio
```

### Step 5: Use It!

#### Option A: Manual Entry

```
You: "Bob, I had a meeting called 'Project FALCON Sprint Planning' 
      from 2pm to 3pm today"

Bob: [classifies the meeting]
     Project: FALCON
     Task Type: planning
     Duration: 60 minutes
     Billable: No
     Confidence: High (0.85)
     
     Should I create this time entry?

You: "Yes"

Bob: Entry created! Total time today: 1 hour
```

#### Option B: Quick Entry

```
You: "Bob, log 30 minutes for Daily Standup"

Bob: [classifies]
     Project: SCRUM
     Entry created!
```

#### Option C: Import Calendar File

1. Export your Outlook calendar to .ics file:
   - Open Outlook
   - File → Save Calendar
   - Choose date range
   - Save as .ics

2. Tell Bob:
```
You: "Bob, import my calendar file"
[paste file content or provide path]

Bob: Parsed 23 meetings
     Classified 18 with high confidence
     5 need review
     
     Ready to create the high confidence ones?

You: "Yes, and show me the ones that need review"

Bob: [creates 18 entries]
     [shows 5 for manual review]
```

### Step 6: View Your Time

```
You: "Bob, show me my time summary for this week"

Bob: Total: 32 hours
     By Project:
     - FALCON: 12 hours (8 billable)
     - ADMIN: 8 hours (0 billable)
     - CLIENT: 12 hours (12 billable)
     
     Meetings: 24
     Average per day: 6.4 hours

You: "Export to CSV"

Bob: [generates CSV file]
     Ready to import into your time tracking system!
```

### Available Tools (Hybrid Mode)

**Manual Entry:**
- `add_manual_meeting` - Add one meeting with full details
- `add_quick_entry` - Quick entry with just title and duration
- `import_calendar_file` - Import .ics calendar file
- `batch_add_meetings` - Add multiple meetings at once

**Viewing & Reporting:**
- `get_time_summary` - Summary statistics
- `get_time_entries` - List all entries with filters
- `export_time_entries` - Export to CSV

**Management:**
- `create_time_entries` - Batch create from suggestions
- `sync_meetings_to_tracker` - End-to-end workflow

### That's It!

You're ready to track time without any Azure AD setup. All your data is stored locally in `data/time-entries.json`.

---

## Azure AD Setup (Full Automation)

If you want automatic Teams meeting sync, follow these steps.

### Prerequisites

- Microsoft 365 account with Teams access
- Azure Portal access (or IT admin help)
- 15-20 minutes

### Step 1: Azure AD App Registration

**Detailed guide:** See [AZURE_SETUP_GUIDE.md](AZURE_SETUP_GUIDE.md) for step-by-step instructions with screenshots.

**Quick version:**

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to Azure Active Directory → App registrations
3. Click "New registration"
4. Name: `Teams Time Tracker`
5. Click "Register"
6. Note your **Application (client) ID** and **Directory (tenant) ID**
7. Go to "Certificates & secrets"
8. Create new client secret
9. **Copy the secret value immediately** (you won't see it again!)
10. Go to "API permissions"
11. Add these permissions:
    - `Calendars.Read`
    - `OnlineMeetings.Read.All`
    - `User.Read.All`
12. Click "Grant admin consent"

### Step 2: Install

```bash
cd TaskTimeTracker
npm install
```

### Step 3: Configure

Create `.env` file:

```bash
cp .env.example .env
```

Edit `.env` with your Azure AD credentials:

```env
# Microsoft Graph API Configuration
MICROSOFT_TENANT_ID=your-tenant-id-from-step-6
MICROSOFT_CLIENT_ID=your-client-id-from-step-6
MICROSOFT_CLIENT_SECRET=your-client-secret-from-step-9

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

### Step 4: Test Connection

```bash
npm start
```

Look for:
```
Microsoft Graph client initialized successfully
Teams Time Tracker MCP Server started successfully
```

### Step 5: Use It!

```
You: "Bob, list my meetings for today"

Bob: [fetches from Teams]
     Found 5 meetings:
     1. Daily Standup (9:00-9:15)
     2. Project FALCON Sprint Planning (10:00-11:00)
     ...

You: "Classify them and suggest time entries"

Bob: [classifies all meetings]
     Suggested 5 entries:
     - SCRUM: 15 min (Daily Standup)
     - FALCON: 60 min (Sprint Planning)
     ...
     
     3 high confidence, 2 need review

You: "Create the high confidence ones"

Bob: Created 3 entries. Total: 2.5 hours
```

### Available Tools (Full Mode)

**Automatic Sync:**
- `list_recent_meetings` - Fetch from Teams
- `get_meeting_attendance` - Get attendance details
- `suggest_time_entries` - Auto-classify meetings
- `sync_meetings_to_tracker` - One-step sync

**Plus all Hybrid Mode tools:**
- Manual entry tools (for meetings not in Teams)
- Viewing and reporting tools
- Export tools

---

## Troubleshooting

### "I don't have Azure AD access"

→ Use **Hybrid Mode** instead. Works great without Azure AD!

### "Need admin approval" error

Your IT department needs to approve the app. Options:
1. Ask IT to grant consent (show them AZURE_SETUP_GUIDE.md)
2. Use Hybrid Mode instead
3. Use a personal Microsoft account

### "No meetings found"

**Hybrid Mode:** You need to manually add meetings or import calendar file

**Full Mode:** 
- Check date range format (ISO 8601)
- Verify user email is correct
- Ensure Azure AD permissions are granted

### "Low confidence classifications"

Add more patterns to `config/tracking-rules.json`:

```json
{
  "patterns": [
    {
      "pattern": "Your Meeting Pattern",
      "projectCode": "YOUR-CODE",
      "taskType": "meeting"
    }
  ]
}
```

### "Can't write to data directory"

```bash
# Create data directory
mkdir -p data logs

# Check permissions
ls -la data/
```

---

## Next Steps

### 1. Customize Classification Rules

Edit `config/tracking-rules.json`:
- Add your project patterns
- Map organizers to projects
- Define billability rules

### 2. Set Up Regular Workflow

**Daily:**
```
Morning: Review yesterday's meetings
Afternoon: Log any ad-hoc time
Evening: Export to your company's system
```

**Weekly:**
```
Monday: Import last week's calendar
Review and approve all entries
Export to CSV
Submit to time tracking system
```

### 3. Backup Your Data

```bash
# Backup time entries
cp data/time-entries.json backups/entries-$(date +%Y%m%d).json

# Backup logs
cp -r logs/ backups/logs-$(date +%Y%m%d)/
```

### 4. Deploy to OpenShift (Optional)

See [OPENSHIFT_DEPLOYMENT.md](OPENSHIFT_DEPLOYMENT.md) for enterprise deployment.

---

## Comparison: Hybrid vs Full Mode

| Feature | Hybrid Mode | Full Mode |
|---------|-------------|-----------|
| **Setup Time** | 5 minutes | 15-20 minutes |
| **Azure AD Required** | ❌ No | ✅ Yes |
| **IT Approval** | ❌ Not needed | ⚠️ May be needed |
| **Automatic Sync** | ❌ Manual entry | ✅ Automatic |
| **Calendar Import** | ✅ .ics files | ✅ Real-time |
| **Classification** | ✅ Same rules | ✅ Same rules |
| **Attendance Data** | ❌ No | ✅ Yes |
| **Reporting** | ✅ Full | ✅ Full |
| **CSV Export** | ✅ Yes | ✅ Yes |
| **Cost** | 💰 Free | 💰 Free |
| **Privacy** | 🔒 100% local | 🔒 Microsoft Graph |

**Recommendation:** Start with Hybrid Mode. Upgrade to Full Mode later if you get Azure AD access.

---

## Support

### Documentation
- [README.md](README.md) - Overview and features
- [AZURE_SETUP_GUIDE.md](AZURE_SETUP_GUIDE.md) - Detailed Azure AD setup
- [NO_AZURE_ALTERNATIVE.md](NO_AZURE_ALTERNATIVE.md) - Hybrid mode details
- [OPENSHIFT_DEPLOYMENT.md](OPENSHIFT_DEPLOYMENT.md) - Enterprise deployment

### Common Issues
- Check logs in `logs/` directory
- Review `logs/error.log` for errors
- Check `logs/audit.log` for actions

### Getting Help
1. Check troubleshooting section above
2. Review the documentation
3. Check your configuration files
4. Verify all dependencies are installed

---

## Success Checklist

- [ ] Node.js 18+ installed
- [ ] Dependencies installed (`npm install`)
- [ ] `.env` file configured
- [ ] Server starts without errors
- [ ] Can add/import meetings
- [ ] Classifications work correctly
- [ ] Time entries are created
- [ ] Can view summaries
- [ ] Can export to CSV
- [ ] Data is backed up

Congratulations! You're ready to automate your time tracking. 🎉