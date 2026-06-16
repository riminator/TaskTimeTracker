# Import Guide - Bringing Your Existing Data

This guide shows you how to import your existing time tracking data and Outlook calendar into the system.

## What You Can Import

1. **Excel/CSV Time Tracker** - Your existing time entries
2. **Outlook Calendar (OLM file)** - Your meeting history
3. **ICS Calendar Files** - Standard calendar format

---

## Import 1: Excel/CSV Time Tracker

### Step 1: Prepare Your Excel File

Your Excel file should have columns like:
- Date
- Project/Code
- Duration (hours or minutes)
- Description/Task
- Billable (optional)

**Example:**
```
Date       | Project | Duration | Description           | Billable
2026-06-10 | FALCON  | 2.5      | Sprint Planning       | No
2026-06-10 | ADMIN   | 0.5      | Team Standup          | No
2026-06-11 | CLIENT  | 3.0      | Customer Meeting      | Yes
```

### Step 2: Export to CSV

In Excel:
1. File → Save As
2. Choose "CSV (Comma delimited) (*.csv)"
3. Save the file

### Step 3: Copy CSV Content

Open the CSV file in a text editor and copy all content.

### Step 4: Import with Bob

```
You: "Bob, I want to import my Excel time tracker"

Bob: "Please provide the CSV content"

You: [paste CSV content]

Bob: "I'll preview the import first"
     
     Detected columns:
     - Date: "Date"
     - Project: "Project"
     - Duration: "Duration"
     - Description: "Description"
     - Billable: "Billable"
     
     Preview:
     - Total rows: 45
     - Valid entries: 43
     - Errors: 2
     
     Sample entries:
     1. 2026-06-10 | FALCON | 150 min | Sprint Planning
     2. 2026-06-10 | ADMIN | 30 min | Team Standup
     ...
     
     Ready to import?

You: "Yes, import them"

Bob: Imported 43 entries successfully!
     2 entries had errors (see details)
```

### Step 5: Manual Column Mapping (if needed)

If Bob can't auto-detect your columns:

```
You: "Bob, import my Excel with custom columns"

Provide column mapping:
{
  "csvContent": "[your CSV content]",
  "columnMapping": {
    "dateColumn": "Work Date",
    "projectColumn": "Project Code",
    "durationColumn": "Hours",
    "descriptionColumn": "Task Notes",
    "billableColumn": "Is Billable"
  },
  "dryRun": true
}
```

### Supported Duration Formats

Bob understands multiple duration formats:
- **Decimal hours**: `2.5` (2.5 hours = 150 minutes)
- **Hours:Minutes**: `2:30` (2 hours 30 minutes)
- **Text format**: `2h 30m` or `2h` or `30m`

### Supported Date Formats

- **ISO format**: `2026-06-10` (recommended)
- **US format**: `06/10/2026` or `6/10/2026`
- **Text dates**: `June 10, 2026`

---

## Import 2: Outlook Calendar (OLM File)

### Understanding OLM Files

OLM files are Outlook for Mac archive files. They're actually ZIP files containing your calendar data.

### Option A: Extract and Convert (Recommended)

**Step 1: Extract the OLM**

```bash
# Rename OLM to ZIP
mv calendar.olm calendar.zip

# Extract
unzip calendar.zip

# Find calendar files (usually .ics format)
find . -name "*.ics"
```

**Step 2: Use the ICS file**

Once you have the .ics file, use the ICS import tool (see below).

### Option B: Export from Outlook as ICS

**Easier method:**

1. Open Outlook for Mac
2. File → Export
3. Select "Calendar"
4. Choose date range
5. Save as `.ics` format
6. Use the ICS import tool

### Step 3: Import the ICS File

```
You: "Bob, import my Outlook calendar"

Bob: "Please provide the ICS file content"

You: [paste ICS content]

Bob: Parsing calendar file...
     
     Found 87 meetings
     Date range: 2026-06-01 to 2026-06-30
     
     Classifying meetings...
     - 65 classified with high confidence
     - 15 need review
     - 7 excluded (lunch, personal, etc.)
     
     High confidence examples:
     1. "Project FALCON Sprint" → FALCON (0.92)
     2. "Daily Standup" → SCRUM (0.88)
     3. "Client Review Meeting" → CLIENT (0.85)
     
     Should I create the 65 high confidence entries?

You: "Yes, and show me the 15 that need review"

Bob: Created 65 entries!
     
     Needs review:
     1. "Sync meeting" - unclear project
     2. "Quick chat" - no clear category
     ...
     
     For each, tell me the project code and I'll create them.
```

---

## Import 3: ICS Calendar Files

### What is ICS?

ICS (iCalendar) is a universal calendar format supported by:
- Outlook
- Google Calendar
- Apple Calendar
- Most calendar apps

### How to Get ICS Files

**From Outlook:**
- File → Export → Calendar → Save as .ics

**From Google Calendar:**
- Settings → Import & Export → Export

**From Apple Calendar:**
- File → Export → Export

### Import Process

```
You: "Bob, use the import_calendar_ics tool"

Parameters:
{
  "icsContent": "[paste ICS file content]",
  "startDate": "2026-06-01",
  "endDate": "2026-06-30",
  "autoCreate": false,
  "minConfidence": 0.8
}

Bob: Imported and classified 87 meetings
     
     Summary:
     - Total parsed: 87
     - After date filter: 87
     - Classified: 72
     - Excluded: 15
     - Auto-created: 0 (dryRun mode)
     - Needing review: 72
     
     Set autoCreate: true to create high confidence entries
```

---

## Complete Import Workflow

### Scenario: You have both Excel tracker and Outlook calendar

**Step 1: Import Excel (Historical Data)**

```
You: "Bob, import my Excel time tracker"
[paste CSV]

Bob: Imported 120 entries from Jan-May 2026
```

**Step 2: Import Outlook Calendar (Recent Meetings)**

```
You: "Bob, import my Outlook calendar for June"
[paste ICS content]

Bob: Classified 87 meetings
     Created 65 high confidence entries
     15 need review
```

**Step 3: Review Low Confidence**

```
You: "Show me the ones that need review"

Bob: 1. "Sync meeting" - confidence 0.45
     2. "Quick chat" - confidence 0.38
     ...

You: "The sync meeting is for Project FALCON"

Bob: Updated! Created entry for FALCON project
```

**Step 4: Check for Duplicates**

```
You: "Bob, show me my time entries for June 15"

Bob: June 15, 2026:
     1. Daily Standup - 15 min (from calendar)
     2. Sprint Planning - 60 min (from calendar)
     3. Sprint Planning - 60 min (from Excel)
     
     Looks like entry #2 and #3 are duplicates!

You: "Delete entry #3"

Bob: Deleted duplicate entry
```

**Step 5: Export Combined Data**

```
You: "Bob, export all my time entries to CSV"

Bob: Exported 205 entries
     Date range: Jan 1 - June 30, 2026
     Total time: 487 hours
     
     [CSV content ready to import into your company system]
```

---

## Tips for Clean Imports

### 1. Preview First

Always use `dryRun: true` first:
```json
{
  "csvContent": "...",
  "dryRun": true
}
```

This shows you what will be imported without actually importing.

### 2. Import in Batches

Don't import everything at once:
- Import one month at a time
- Review each batch
- Fix issues before continuing

### 3. Check for Duplicates

After importing:
```
You: "Bob, show me entries for [date]"
```

Look for duplicate meetings and delete them.

### 4. Verify Totals

```
You: "Bob, show me my time summary for June"

Bob: Total: 160 hours
     
     Does this match your expectations?
```

### 5. Backup Before Importing

```bash
# Backup existing data
cp data/time-entries.json data/backup-before-import.json
```

If something goes wrong, you can restore:
```bash
cp data/backup-before-import.json data/time-entries.json
```

---

## Common Issues

### Issue: "Unable to parse date"

**Problem:** Date format not recognized

**Solution:** Convert dates to ISO format (YYYY-MM-DD) in Excel before exporting

### Issue: "Duration is 0 minutes"

**Problem:** Duration format not recognized

**Solution:** Use one of these formats:
- `2.5` (decimal hours)
- `2:30` (hours:minutes)
- `2h 30m` (text format)

### Issue: "Too many entries with low confidence"

**Problem:** Meeting titles don't match your patterns

**Solution:** Add more patterns to `config/tracking-rules.json`:

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

### Issue: "Duplicate entries"

**Problem:** Imported same data twice

**Solution:** 
1. Export current data to CSV
2. Delete duplicates in Excel
3. Re-import clean data

Or use Bob to find and delete duplicates:
```
You: "Bob, show me all entries for June 15"
[review and delete duplicates]
```

---

## Advanced: Custom Import Scripts

If you have complex data, you can create custom import scripts:

```javascript
// custom-import.js
import storageConnector from './src/connectors/storage.js';

await storageConnector.initialize();

const entries = [
  {
    projectCode: 'FALCON',
    durationMinutes: 120,
    date: '2026-06-15',
    description: 'Sprint Planning',
    // ... other fields
  }
];

for (const entry of entries) {
  await storageConnector.createEntry(entry);
}

console.log('Import complete!');
```

Run it:
```bash
node custom-import.js
```

---

## Summary

### Import Tools Available

1. **`import_excel_timetracker`** - Import CSV/Excel files
2. **`import_olm_file`** - Instructions for OLM files
3. **`import_calendar_ics`** - Import ICS calendar files

### Workflow

1. **Prepare** your data (CSV or ICS format)
2. **Preview** with dryRun: true
3. **Import** the data
4. **Review** low confidence entries
5. **Check** for duplicates
6. **Verify** totals
7. **Export** combined data

### Best Practices

- ✅ Always preview first
- ✅ Import in batches
- ✅ Backup before importing
- ✅ Review low confidence entries
- ✅ Check for duplicates
- ✅ Verify totals match expectations

Now you can bring all your historical data into the system! 🎉