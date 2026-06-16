# Task Time Tracker - Web UI Guide

## Overview

The Task Time Tracker Web UI provides an intuitive interface for managing your time entries without needing to interact with Bob or the MCP server directly. It features a modern, responsive design with multiple tabs for different capabilities.

## Features

### 📊 Dashboard
- **Summary Cards**: View total hours, entries, active projects, and weekly hours at a glance
- **Recent Entries**: Quick view of your latest time entries
- **Project Breakdown**: See hours distribution across all projects
- **Real-time Statistics**: Automatically calculated metrics

### 📝 Time Entries
- **Complete List**: View all your time entries in a sortable table
- **Filtering**: Filter by date range and project
- **Quick Actions**: Edit or delete entries directly from the table
- **Search**: Find specific entries quickly

### ➕ Manual Entry
- **Easy Form**: Add time entries with a simple, intuitive form
- **Auto-Classification**: Click "Auto-Classify" to automatically determine project and task type based on meeting title
- **Duration Calculator**: Enter start and end times to automatically calculate duration
- **Project Suggestions**: Autocomplete for existing projects
- **Validation**: Built-in validation ensures data quality

### 📂 Import
- **CSV/Excel Import**: Upload your existing time tracking data
  - Supports multiple date and time formats
  - Auto-detects column headers
  - Handles your exact Excel format
- **Calendar Import (ICS)**: Import meetings from Outlook, Google Calendar, or Apple Calendar
  - Automatic classification of meetings
  - Duration calculation
  - Organizer and attendee information preserved
- **Import Instructions**: Built-in help for each import method

### 📈 Reports
- **Date Range Reports**: Generate reports for any time period
- **Multiple Views**:
  - Summary statistics
  - Hours by project
  - Daily breakdown
  - Task type distribution
- **Export**: Download reports as CSV

## Getting Started

### Local Development

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start the Web Server**
   ```bash
   npm run web
   ```
   
   Or with auto-reload:
   ```bash
   npm run web:dev
   ```

3. **Access the UI**
   Open your browser to: `http://localhost:3000`

### Using the Web UI

#### Adding Your First Entry

1. Click the **"Manual Entry"** tab
2. Fill in the form:
   - **Date**: Select the date (defaults to today)
   - **Start Time**: When you started
   - **End Time**: When you finished (optional - can use duration instead)
   - **Duration**: Hours spent (auto-calculated if you enter start/end times)
   - **Title**: Meeting or task name
   - **Project**: Client or project name
   - **Task Type**: Meeting, Development, Planning, etc.
   - **Description**: Additional notes
3. Click **"Auto-Classify"** to let the system suggest project and task type
4. Click **"Save Entry"**

#### Importing Your Excel Data

1. Click the **"Import"** tab
2. Under **"Import from CSV/Excel"**:
   - Click **"Choose CSV/Excel file"**
   - Select your Excel file (exported as CSV)
   - Click **"Import CSV"**
3. The system will:
   - Auto-detect your columns
   - Parse dates, times, and durations
   - Create entries for all rows
   - Show success message with count

#### Viewing Reports

1. Click the **"Reports"** tab
2. Select date range:
   - **Start Date**: Beginning of period
   - **End Date**: End of period
3. Click **"Generate Report"**
4. View:
   - Total hours and entries
   - Breakdown by project
   - Daily activity
   - Task type distribution

#### Exporting Data

- Click the **"Export CSV"** button in the header
- Your browser will download a CSV file with all entries
- File name includes current date: `time-entries-2026-06-16.csv`

## UI Components

### Navigation
- **Tab-based navigation**: Switch between Dashboard, Entries, Manual Entry, Import, and Reports
- **Sticky header**: Always visible with quick actions
- **Responsive design**: Works on desktop, tablet, and mobile

### Forms
- **Smart validation**: Required fields marked with *
- **Auto-complete**: Project names suggest from existing entries
- **Date pickers**: Easy date selection
- **Time pickers**: Standard time input
- **Duration calculator**: Automatic calculation from start/end times

### Tables
- **Sortable columns**: Click headers to sort
- **Inline actions**: Edit and delete buttons on each row
- **Responsive**: Scrolls horizontally on small screens
- **Hover effects**: Visual feedback on interaction

### Modals
- **Edit dialog**: Modify entries without leaving the page
- **Confirmation dialogs**: Prevent accidental deletions
- **Keyboard shortcuts**: ESC to close

### Notifications
- **Toast messages**: Non-intrusive success/error notifications
- **Auto-dismiss**: Disappear after 3 seconds
- **Color-coded**: Green for success, red for errors, blue for info

## API Endpoints

The web UI communicates with these backend endpoints:

### Entries
- `GET /api/entries` - List all entries (with optional filters)
- `GET /api/entries/:id` - Get single entry
- `POST /api/entries` - Create new entry
- `PUT /api/entries/:id` - Update entry
- `DELETE /api/entries/:id` - Delete entry

### Summary & Reports
- `GET /api/summary` - Get statistics (with optional date range)
- `GET /api/export/csv` - Export entries as CSV

### Import
- `POST /api/import/csv` - Import CSV/Excel file
- `POST /api/import/ics` - Import ICS calendar file

### Utilities
- `GET /api/projects` - List all unique projects
- `POST /api/classify` - Classify a meeting title
- `GET /health` - Health check endpoint

## Deployment

### OpenShift Deployment

1. **Build the Docker Image**
   ```bash
   docker build -f Dockerfile.web -t timetracker-web:latest .
   ```

2. **Push to Registry**
   ```bash
   docker tag timetracker-web:latest your-registry/timetracker-web:latest
   docker push your-registry/timetracker-web:latest
   ```

3. **Deploy to OpenShift**
   ```bash
   oc apply -f openshift/web-deployment.yaml
   oc apply -f openshift/web-service.yaml
   oc apply -f openshift/web-route.yaml
   ```

4. **Access the Application**
   ```bash
   oc get route timetracker-web
   ```
   Open the URL shown in your browser.

### Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)

### Persistent Storage

The web application uses the same persistent volumes as the MCP server:
- `/app/data` - Time entries JSON storage
- `/app/logs` - Application logs
- `/app/uploads` - Temporary upload directory

## Customization

### Styling

Edit `web/public/styles.css` to customize:
- Colors (CSS variables at top of file)
- Layout and spacing
- Component styles
- Responsive breakpoints

### Branding

Update in `web/public/index.html`:
- Page title
- Header text
- Favicon (add to `web/public/`)

### Features

Modify `web/server.js` to:
- Add new API endpoints
- Change validation rules
- Add authentication
- Integrate with other systems

Modify `web/public/app.js` to:
- Add new UI features
- Change behavior
- Add charts/visualizations
- Customize workflows

## Troubleshooting

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000
# Kill the process or use a different port
PORT=3001 npm run web
```

### Import Not Working
- Check file format (CSV with headers)
- Verify date format matches expected patterns
- Check browser console for errors
- Ensure file size is reasonable (<10MB)

### Data Not Showing
- Check that `data/time-entries.json` exists
- Verify file permissions
- Check browser console for API errors
- Refresh the page

### Classification Not Working
- Ensure `config/tracking-rules.json` is loaded
- Check that patterns match your meeting titles
- Add custom patterns for your projects
- Verify confidence threshold settings

## Best Practices

1. **Regular Backups**: Export CSV regularly as backup
2. **Consistent Naming**: Use consistent project names for better reporting
3. **Detailed Descriptions**: Add notes for future reference
4. **Review Before Import**: Check imported data in Entries tab
5. **Use Auto-Classification**: Let the system learn your patterns
6. **Set Date Ranges**: Use filters to focus on relevant time periods

## Security Notes

- No authentication is built-in (add if deploying publicly)
- File uploads are temporary and cleaned up
- Data stored in local JSON file
- HTTPS recommended for production (handled by OpenShift route)
- CORS enabled for development (restrict in production)

## Performance

- Handles thousands of entries efficiently
- Client-side filtering and sorting
- Lazy loading for large datasets
- Optimized API responses
- Minimal dependencies

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Future Enhancements

Potential features to add:
- User authentication and multi-user support
- Real-time sync with Teams calendar
- Advanced charts and visualizations
- Bulk edit operations
- Custom report templates
- Email notifications
- Mobile app
- Offline support with service workers
- Integration with other time tracking tools

## Support

For issues or questions:
1. Check this guide
2. Review browser console for errors
3. Check server logs in `logs/` directory
4. Verify configuration in `config/` directory
5. Test with sample data first