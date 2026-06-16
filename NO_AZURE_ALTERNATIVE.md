# Alternative: Manual Time Tracker (No Azure AD Required)

If you don't have access to Azure AD, you can still use this system as a **manual time tracker** without any Microsoft integration.

## What Changes

### ❌ What You Lose:
- Automatic Teams meeting sync
- Real-time calendar integration
- Attendance data

### ✅ What You Keep:
- Smart classification (you tell it the meeting title)
- Time allocation rules (rounding, overlap detection)
- Local storage (all data saved locally)
- Summary reports
- CSV export
- All the intelligence, just manual input

## How It Works

Instead of fetching meetings from Teams, you manually tell Bob about your meetings:

```
You: "I had a meeting called 'Project Falcon Sprint Planning' 
      from 2pm to 3pm today"

Bob: Uses classification rules to determine:
     - Project: FALCON
     - Task Type: planning
     - Duration: 60 minutes (rounded to nearest 15)
     - Billable: No (internal meeting)
     - Confidence: High (0.85)
     
     Creates time entry in local storage
```

## Quick Setup (No Azure Needed)

### 1. Simplify Your .env File

Create `.env` with just:

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

### 2. Install Dependencies

```bash
npm install
```

### 3. Create a Simple Manual Entry Tool

I'll create a new tool that lets you manually add meetings without Teams integration.

## New Manual Tools

### `add_manual_meeting`
Tell Bob about a meeting manually:

```json
{
  "title": "Project Falcon Sprint Planning",
  "startTime": "2026-06-16T14:00:00Z",
  "endTime": "2026-06-16T15:00:00Z",
  "organizer": "manager@company.com",
  "attendees": ["you@company.com", "teammate@company.com"]
}
```

Bob will:
1. Classify it using the same rules
2. Apply time allocation
3. Suggest a time entry
4. Save it locally

### `add_quick_entry`
Even simpler - just the basics:

```json
{
  "title": "Sprint Planning",
  "durationMinutes": 60,
  "date": "2026-06-16"
}
```

### `import_calendar_file`
Export your Outlook calendar to .ICS file, then:

```json
{
  "filePath": "/path/to/calendar.ics",
  "startDate": "2026-06-16",
  "endDate": "2026-06-22"
}
```

Bob parses the file and creates entries.

## Usage Examples

### Daily Workflow

**Morning:**
```
You: "Bob, I'm going to tell you about my meetings from yesterday"

Bob: "Ready to log your meetings!"

You: "I had a client call from 10am to 11am"

Bob: Classifies as:
     - Project: CLIENT (detected "client" keyword)
     - Billable: Yes
     - Duration: 60 minutes
     
     "Should I log this entry?"

You: "Yes"

Bob: "Entry logged! Total time today: 1 hour"
```

**End of Day:**
```
You: "Bob, show me my time summary for today"

Bob: Shows breakdown by project, billable vs non-billable

You: "Export to CSV"

Bob: Generates CSV file you can import into your company's system
```

### Weekly Review

```
You: "Bob, show me my time for this week"

Bob: 
     Total: 32 hours
     By Project:
     - FALCON: 12 hours (8 billable)
     - ADMIN: 8 hours (0 billable)
     - CLIENT: 12 hours (12 billable)
     
     Meetings: 24
     Average per day: 6.4 hours

You: "Export this week to CSV"

Bob: Creates CSV with all entries
```

## Advantages of Manual Entry

1. **No IT approval needed** - Works immediately
2. **No external dependencies** - Just local files
3. **Privacy** - No data sent anywhere
4. **Flexibility** - Log meetings from any source
5. **Still intelligent** - Same classification rules apply

## Disadvantages

1. **Manual work** - You have to tell Bob about each meeting
2. **No real-time sync** - Can't automatically track
3. **Relies on memory** - Need to remember your meetings

## Hybrid Approach

You can also use a **hybrid approach**:

1. **Export calendar weekly** from Outlook to .ICS
2. **Import the file** into the tracker
3. **Review and approve** the classified entries
4. **Manual adjustments** for anything missed

This gives you semi-automation without Azure AD access.

## Alternative: Ask Your IT Department

If you want the full automated experience, you can:

1. Show your IT admin the **AZURE_SETUP_GUIDE.md**
2. Explain you need **read-only** access to your own calendar
3. Ask them to:
   - Register the app for you, OR
   - Give you permission to register apps, OR
   - Set up a service account you can use

Many IT departments will approve this since:
- It's read-only access
- Only to your own calendar
- No data leaves your organization
- Helps with time tracking compliance

## Which Approach Should You Use?

### Use Manual Entry If:
- ✅ You don't have Azure AD access
- ✅ You want to start immediately
- ✅ You don't mind logging meetings manually
- ✅ You want maximum privacy

### Ask IT for Azure Access If:
- ✅ You want full automation
- ✅ You have many meetings per day
- ✅ Your IT is generally supportive
- ✅ You want attendance tracking

### Use Calendar Export If:
- ✅ You want semi-automation
- ✅ You can export your calendar weekly
- ✅ You don't need real-time sync
- ✅ You want a middle ground

## Next Steps

Let me know which approach you prefer:

1. **Manual entry** - I'll create the manual tools
2. **Calendar import** - I'll create the .ICS parser
3. **Ask IT** - I'll create a document for your IT department
4. **Hybrid** - I'll set up all options

Which would you like me to implement?