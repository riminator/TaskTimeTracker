# Task Time Tracker - Project Overview

**Date:** June 17, 2026
**Purpose:** Refreshed project capabilities overview

---

## What It Does

Task Time Tracker is a time tracking solution that combines:
- **Automated meeting-based capture** from Microsoft Teams and calendar sources
- **Manual time entry** with smart classification
- **Import of historical data** from CSV/Excel and ICS calendar files
- **Reporting and export** through a lightweight web application

The system helps convert meetings and work activities into structured time entries with project codes, task types, billability, and confidence scoring.

---

## Key Features

### 1. Automated Meeting and Calendar Processing
- Connects to Microsoft Teams via Microsoft Graph API
- Retrieves calendar meetings for automated suggestion workflows
- Supports calendar import from ICS files, including Outlook exports
- Captures meeting details such as title, organizer, attendees, and duration
- Can use attendance-aware processing where available in the MCP workflow

### 2. Smart Classification Engine
- Analyzes meeting titles, organizers, attendees, and channel patterns
- Automatically assigns **project codes**
- Determines **task types** such as project-work, ceremony, standup, one-on-one, and management
- Identifies **billable vs. non-billable** time using configurable rules
- Applies configurable confidence thresholds for review and approval workflows
- Excludes non-work events such as lunch, breaks, OOO, personal, and holiday items

**Current rule examples from configuration:**
```text
"Project FALCON ..."           → project code extracted from title
"Sprint Planning/Review/Retro" → SCRUM / ceremony
"Daily Standup"                → SCRUM / standup
"1:1" or "One on One"          → ADMIN / one-on-one
manager@company.com            → ADMIN / management
```

### 3. Web Application
- Modern responsive web UI served locally or in OpenShift
- Dashboard with total hours, billable/non-billable split, project breakdown, and daily trends
- Full time entry management: create, edit, delete, and bulk delete
- Manual entry workflow with auto-classification
- Filtering by date range and project
- CSV export for downstream reporting

### 4. Import and Migration Support
- Import from CSV/Excel-style exports
- Import from ICS calendar files
- Bulk creation of historical entries
- Auto-detection of common CSV column formats
- Handles multiple source formats for migration from existing trackers
- Includes guidance for Outlook for Mac OLM extraction via ICS export workflow

### 5. MCP Server and Documentation Resources
- MCP server exposes tools for meeting sync, manual entry, and import workflows
- Documentation resources are available for usage guidance, API reference, and tracking rules
- Supports dry-run style review flows before creating entries in downstream systems

### 6. Flexible Deployment
- **Web UI mode:** Simple local usage with `npm run web`
- **MCP server mode:** Tool-driven workflows with `npm start`
- **Hybrid mode:** Manual entry + imports without requiring full Teams automation
- **Enterprise mode:** OpenShift deployment with route/service/deployment manifests

---

## Current Technical Stack

- **Backend:** Node.js, Express.js
- **Frontend:** Vanilla JavaScript, HTML, CSS
- **APIs:** REST endpoints for entries, summary, import, export, and classification support
- **Automation Layer:** MCP server with tools, resources, and prompts
- **Storage:** Local JSON-based storage connector
- **Integrations:** Microsoft Graph API, Jira connector, file-based imports
- **Deployment:** Docker/OpenShift/Kubernetes-ready manifests

---

## Current Functional Scope

### Web API capabilities
- `GET /api/entries` - list entries with filters
- `POST /api/entries` - create entries with optional auto-classification
- `PUT /api/entries/:id` - update entries
- `DELETE /api/entries/:id` - delete entries
- `POST /api/entries/bulk-delete` - bulk delete selected entries
- `GET /api/summary` - dashboard/reporting summary
- `GET /api/export/csv` - export entries
- `POST /api/import/csv` - import CSV/Excel-style data
- `POST /api/import/ics` - import calendar events from ICS
- `GET /health` - health check

### MCP/manual/import capabilities
- Manual meeting entry with classification and optional auto-create
- Quick entry workflow for fast logging
- CSV import with preview/dry-run support
- ICS import support for Outlook calendar exports
- Documentation resources for usage guide and API reference

---

## Configuration

Classification and allocation behavior are customizable via `config/tracking-rules.json`:

- **Pattern matching:** Extract project codes from titles
- **Organizer mapping:** Default project/task assignment by organizer
- **Channel mapping:** Map channels or teams to project codes
- **Billability rules:** Billable and non-billable keyword patterns
- **Exclusions:** Ignore lunch, break, OOO, personal, and holiday events
- **Time allocation:** 15-minute rounding, minimum/maximum duration, overlap handling
- **Confidence thresholds:** High, medium, and low confidence review levels

---

## Current Status

**Implemented and usable**
- Functional web UI for day-to-day entry management
- Dashboard and reporting endpoints available
- CSV export and CSV/ICS import workflows available
- Manual entry and quick entry workflows implemented
- Bulk delete support added in the web API
- MCP server includes tools, prompts, and documentation resources
- OpenShift deployment manifests included
- Jira connector exists for downstream worklog integration

**Important note**
- Teams/Graph automation and Jira integration are part of the architecture, while local/manual/import-driven workflows already provide immediate usable value even without full enterprise integration enabled.

---

## Business Use Cases

1. **Billable Hours Tracking**
   Separate client-facing work from internal work using configurable rules.

2. **Project Time Allocation**
   Understand where time is being spent across projects, ceremonies, admin work, and meetings.

3. **Historical Data Migration**
   Bring in existing spreadsheet or calendar-based records without re-entering data manually.

4. **Operational Reporting**
   Generate summaries by date range, project, and task type for management review.

5. **Process Standardization**
   Apply consistent classification and time allocation rules across entries.

---

## Deployment Options

### Option 1: Local Web UI
```bash
npm install
npm run web
# Access at http://localhost:3000
```

### Option 2: MCP Server
```bash
npm install
npm start
```

### Option 3: OpenShift Deployment
```bash
oc login --server=https://your-cluster:6443
./scripts/deploy-to-openshift.sh
```

---

## Documentation

- **README.md** - Quick start and commands
- **docs/SETUP.md** - Detailed installation
- **docs/WEB_UI_GUIDE.md** - Web UI usage and API overview
- **docs/IMPORT_GUIDE.md** - Import instructions
- **docs/OPENSHIFT_QUICK_DEPLOY.md** - OpenShift deployment guide

---

## Demo / Current UI

Access the running web UI at: `http://localhost:3000`

**Current tabs and workflows:**
- 📊 **Dashboard** - Summary statistics and project breakdown
- 📝 **Time Entries** - Full table view with edit/delete actions
- ➕ **Manual Entry** - Add entries with auto-classification support
- 📂 **Import** - Upload CSV/Excel-style or ICS files
- 📈 **Reports** - Generate date-range summaries and exports

---

## Recommended Next Steps

1. Review the current web UI with recent API enhancements
2. Validate classification rules against current meeting naming patterns
3. Test CSV and ICS imports with representative historical data
4. Decide whether to prioritize:
   - broader Teams automation,
   - Jira worklog integration,
   - or production deployment in OpenShift
5. Finalize any manager-facing reporting fields needed for adoption