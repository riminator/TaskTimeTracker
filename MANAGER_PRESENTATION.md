# Task Time Tracker

**Date:** June 17, 2026
**Purpose:** Updated overview of current capabilities and near-term roadmap

---

## Executive Summary

Task Time Tracker is a lightweight time tracking application designed to make time capture easier, more consistent, and more reportable.

It currently supports:
- **Manual time entry**
- **CSV-based historical import**
- **ICS calendar import**
- **Automatic classification of work entries**
- **Dashboard and reporting views**
- **Persistent PostgreSQL storage**
- **Simple password protection for write actions**

The current version is focused on delivering a practical, usable workflow for entering, importing, reviewing, and exporting time data through a web interface.

---

## What the Solution Does Today

The application converts work activity into structured time entries with:
- project code
- task type
- duration
- billable/non-billable flag
- notes and meeting title
- reporting-ready records stored in PostgreSQL

This gives users a single place to:
- log time manually
- import existing spreadsheet data
- import calendar events from ICS files
- review and edit entries
- generate summaries and exports

---

## Current Business Value

### 1. Better Time Visibility
Managers can see where time is being spent across:
- projects
- internal work
- ceremonies
- administrative tasks
- imported historical records

### 2. More Consistent Classification
The rules engine applies standardized logic to assign:
- project codes
- task types
- billability

This reduces inconsistency from manual naming and improves reporting quality.

### 3. Easier Historical Migration
Existing time records can be brought in from CSV exports and calendar files instead of being re-entered manually.

### 4. Persistent Data Storage
The application now uses **PostgreSQL** instead of local file storage, which means data persists across:
- page refreshes
- application restarts
- redeployments
- hosted environments such as Fly.io

### 5. Basic Protection for Data Changes
A simple shared-password mechanism now protects write operations so not everyone can modify time entries.

---

## Current Capabilities

### Web Application
The web UI provides:
- Dashboard view
- Time entry table
- Manual entry form
- Import workflows
- Reporting views
- CSV export

### Time Entry Management
Users can:
- create entries
- edit entries
- delete entries
- bulk delete selected entries
- filter by date range and project

### Import Support
The application supports:
- **CSV import** for spreadsheet-based time logs
- **ICS import** for calendar event imports
- parsing of common date/time formats
- bulk creation of imported entries

### Classification Engine
The rules engine can:
- analyze titles, organizers, and attendees
- assign project codes
- assign task types
- determine billable vs non-billable status
- apply confidence scoring
- exclude non-work patterns such as lunch, break, OOO, personal, and holiday events

### Reporting
Users can generate:
- total hours
- total entries
- billable vs non-billable hours
- project breakdowns
- daily breakdowns
- task type summaries
- CSV exports for downstream reporting

### Persistence Layer
The application now uses **PostgreSQL-backed persistence**:
- centralized storage
- better reliability for hosted deployments
- no dependency on local JSON files
- automatic table creation and indexing during startup

### Simple Password Authentication
The current implementation includes **basic write protection**:
- read-only views remain accessible
- modifying actions require a shared password
- protected actions include:
  - create
  - edit
  - delete
  - bulk delete
  - CSV import
  - ICS import

This is intentionally simple and suitable for lightweight controlled usage, not full enterprise identity management.

---

## Current Technical Stack

- **Frontend:** HTML, CSS, Vanilla JavaScript
- **Backend:** Node.js, Express.js
- **Database:** PostgreSQL
- **Classification:** Config-driven rules engine
- **Deployment options:** Local, Fly.io, OpenShift
- **Import formats:** CSV and ICS

---

## Current API Scope

### Available endpoints
- `GET /api/entries`
- `GET /api/entries/:id`
- `POST /api/entries`
- `PUT /api/entries/:id`
- `DELETE /api/entries/:id`
- `POST /api/entries/bulk-delete`
- `GET /api/summary`
- `GET /api/export/csv`
- `POST /api/import/csv`
- `POST /api/import/ics`
- `GET /api/projects`
- `POST /api/classify`
- `GET /health`

---

## Configuration and Rules

Behavior is configurable through `config/tracking-rules.json`.

Current configurable areas include:
- project mapping
- organizer mapping
- channel mapping
- billability rules
- exclusion rules
- confidence thresholds
- time allocation and rounding behavior

Example rule outcomes:
```text
"Project FALCON ..."           → project code extracted from title
"Sprint Planning/Review/Retro" → SCRUM / ceremony
"Daily Standup"                → SCRUM / standup
"1:1" or "One on One"          → ADMIN / one-on-one
manager@company.com            → ADMIN / management
```

---

## Deployment Options

### Option 1: Local Web UI
```bash
npm install
npm run web
```

### Option 2: Fly.io Deployment
Supports hosted deployment with:
- external PostgreSQL (your own server via `DATABASE_URL`)
- environment-based configuration via `flyctl secrets`
- public HTTPS access, always-on (no sleep)

### Option 3: OpenShift Deployment
Supports enterprise-style deployment using included manifests.

---

## Security Position Today

Current security is intentionally lightweight:
- shared password required for modifying data
- read-only access remains open
- suitable for controlled internal usage
- not yet a replacement for full user authentication or role-based access control

This gives immediate protection against casual unauthorized edits while keeping the app simple to use.

---

## Current Status

### Implemented and usable now
- Web UI for daily use
- PostgreSQL-backed persistence
- Manual entry workflow
- CSV import
- ICS import
- Dashboard and reports
- CSV export
- Bulk delete
- Simple password protection for write actions

### Not positioned as current production capability
The following should be treated as **future plans**, not current delivered functionality:
- direct Microsoft Teams event pulling
- direct Outlook event pulling
- broader calendar sync automation
- deeper enterprise identity integration
- downstream worklog integrations

---

## Future Plans

Potential next-phase enhancements:
1. **Teams event puller**
   - direct retrieval of meeting/event data from Teams-related sources
   - reduced manual import effort

2. **Outlook event puller**
   - direct Outlook/calendar retrieval instead of relying on ICS export/import
   - smoother recurring workflow for users

3. **Stronger authentication**
   - named users
   - role-based permissions
   - enterprise sign-in integration

4. **Expanded integrations**
   - downstream worklog systems
   - richer reporting destinations
   - broader workflow automation

5. **Manager-facing reporting enhancements**
   - more polished summaries
   - custom report views
   - adoption-focused dashboards

---

## Recommended Talking Points for Management

- The application is already usable for structured time capture and reporting.
- PostgreSQL persistence resolves the earlier issue of data disappearing after refresh or redeploy.
- Simple password protection now prevents unrestricted editing while keeping the workflow lightweight.
- The current release is strongest for manual entry, CSV import, ICS import, and reporting.
- Direct Teams and Outlook event pulling should be presented as future roadmap items rather than current delivered features.

---

## Demo Summary

Current user-facing workflow:
- 📊 **Dashboard** - summary metrics and project breakdown
- 📝 **Time Entries** - review, edit, delete, and bulk delete
- ➕ **Manual Entry** - create entries with classification support
- 📂 **Import** - upload CSV or ICS files
- 📈 **Reports** - generate summaries and export data

---

## Recommended Next Steps

1. Validate the current workflow with real user data
2. Finalize manager-facing reporting expectations
3. Decide whether the next priority is:
   - stronger authentication
   - Teams/Outlook direct pull capability
   - broader deployment hardening
4. Prepare a production-readiness pass if wider rollout is planned