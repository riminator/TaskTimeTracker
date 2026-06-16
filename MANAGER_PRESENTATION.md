# Task Time Tracker - Project Overview

**Date:** June 16, 2026  
**Purpose:** Project capabilities overview

---

## What It Does

Task Time Tracker is an automated time tracking system that captures work activities from Microsoft Teams meetings and manual entries, then intelligently classifies them into project codes and task types.

---

## Key Features

### 1. Automatic Meeting Sync
- Connects to Microsoft Teams via Graph API
- Automatically retrieves calendar meetings
- Captures meeting details (title, duration, attendees)
- Tracks actual attendance time

### 2. Smart Classification
- Analyzes meeting titles and patterns
- Automatically assigns project codes
- Determines task types (meeting, planning, development, etc.)
- Identifies billable vs. non-billable time
- Provides confidence scores (typically 85%+ accuracy)

**Example:**
```
"Project FALCON Sprint Planning" → FALCON, Planning, 60 min, Non-billable (0.92 confidence)
"Client Review Meeting" → CLIENT, Meeting, 90 min, Billable (0.88 confidence)
```

### 3. Web Interface
- Modern, responsive web UI
- Dashboard with statistics
- View/edit/delete time entries
- Manual entry form with auto-classification
- Generate reports by date range
- Export to CSV

### 4. Data Import
- Import from CSV/Excel files
- Import from ICS calendar files (Outlook, Google Calendar)
- Bulk import for historical data
- Handles multiple date/time formats

### 5. Flexible Deployment
- **Hybrid Mode:** Works without Azure AD (manual entry + calendar import)
- **Full Mode:** Automatic Teams sync (requires Azure AD)
- **Local:** Run on laptop (`npm run web`)
- **Enterprise:** Deploy to OpenShift cluster

---

## Technical Stack

- **Backend:** Node.js, Express.js
- **Frontend:** Vanilla JavaScript, modern CSS
- **Storage:** JSON files (can migrate to database)
- **Integration:** Microsoft Graph API
- **Deployment:** Docker containers, OpenShift/Kubernetes

---

## Configuration

Classification rules are customizable via `config/tracking-rules.json`:

- **Pattern matching:** Extract project codes from meeting titles
- **Organizer mapping:** Auto-classify by meeting organizer
- **Billability rules:** Define billable vs. non-billable patterns
- **Exclusions:** Filter out lunch, breaks, personal time
- **Time allocation:** Rounding, minimum duration, overlap handling

---

## Current Status

**Production Ready**
- Fully functional web UI
- Automatic classification working
- Import/export capabilities complete
- OpenShift deployment manifests included
- Documentation complete

---

## Use Cases

1. **Billable Hours Tracking:** Automatically track client vs. internal time
2. **Project Time Allocation:** See real-time hours across projects
3. **Compliance & Audit:** Maintain detailed records with timestamps
4. **Historical Data Migration:** Import existing Excel time tracking data

---

## Deployment Options

### Option 1: Quick Start (5 minutes)
```bash
npm install
npm run web
# Access at http://localhost:3000
```

### Option 2: OpenShift (Production)
```bash
oc login --server=https://your-cluster:6443
./scripts/deploy-to-openshift.sh
# Access at https://timetracker-web-yourproject.apps.cluster.com
```

---

## Documentation

- **README.md** - Quick start guide
- **docs/SETUP.md** - Detailed installation
- **docs/WEB_UI_GUIDE.md** - User interface guide
- **docs/IMPORT_GUIDE.md** - Data import instructions
- **docs/OPENSHIFT_QUICK_DEPLOY.md** - Deployment guide

---

## Screenshots/Demo

Access the running web UI at: `http://localhost:3000`

**Tabs:**
- 📊 Dashboard - Summary statistics
- 📝 Time Entries - Full table view
- ➕ Manual Entry - Add entries with auto-classification
- 📂 Import - Upload CSV/Excel/ICS files
- 📈 Reports - Generate date-range reports

---

## Next Steps

1. Review the web UI (currently running)
2. Test classification with sample meeting titles
3. Try importing a sample CSV file
4. Review configuration in `config/tracking-rules.json`
5. Decide on deployment approach (local vs. OpenShift)