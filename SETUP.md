# Setup Guide - Teams Time Tracker MCP Server

This guide walks you through setting up the Teams Time Tracker MCP server from scratch.

## Prerequisites Checklist

- [ ] Node.js 18 or higher installed
- [ ] Microsoft 365 account with Teams access
- [ ] Jira account with admin or time tracking permissions
- [ ] Azure Portal access (for app registration)
- [ ] Atlassian account access (for API token)

## Step 1: Azure AD App Registration

### 1.1 Create App Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **New registration**
4. Fill in:
   - **Name**: `Teams Time Tracker MCP`
   - **Supported account types**: `Accounts in this organizational directory only`
   - **Redirect URI**: Leave blank (not needed for daemon apps)
5. Click **Register**

### 1.2 Note Your IDs

After registration, note these values:
- **Application (client) ID**: Found on the Overview page
- **Directory (tenant) ID**: Found on the Overview page

### 1.3 Create Client Secret

1. Go to **Certificates & secrets**
2. Click **New client secret**
3. Add description: `MCP Server Secret`
4. Set expiration: Choose appropriate duration
5. Click **Add**
6. **IMPORTANT**: Copy the secret value immediately (you won't see it again)

### 1.4 Configure API Permissions

1. Go to **API permissions**
2. Click **Add a permission**
3. Select **Microsoft Graph**
4. Select **Application permissions** (not Delegated)
5. Add these permissions:
   - `Calendars.Read`
   - `OnlineMeetings.Read`
   - `User.Read.All`
6. Click **Add permissions**
7. Click **Grant admin consent** (requires admin role)
8. Confirm the consent

### 1.5 Verify Permissions

Ensure all permissions show "Granted for [Your Organization]" in green.

## Step 2: Jira API Token

### 2.1 Create API Token

1. Go to [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click **Create API token**
3. Label: `Teams Time Tracker MCP`
4. Click **Create**
5. Copy the token (you won't see it again)

### 2.2 Note Your Jira Details

You'll need:
- **Jira Host**: `https://your-company.atlassian.net`
- **Email**: Your Jira account email
- **API Token**: The token you just created

### 2.3 Verify Permissions

Ensure your Jira account has:
- Permission to log work on issues
- Access to the projects you want to track time for

## Step 3: Install the Server

### 3.1 Clone or Download

```bash
# If using git
git clone <repository-url>
cd TaskTimeTracker

# Or download and extract the ZIP
```

### 3.2 Install Dependencies

```bash
npm install
```

This will install:
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `@azure/identity` - Azure authentication
- `@microsoft/microsoft-graph-client` - Microsoft Graph API
- `axios` - HTTP client for Jira
- `winston` - Logging
- `joi` - Input validation
- `dotenv` - Environment variables

### 3.3 Create Environment File

```bash
cp .env.example .env
```

### 3.4 Configure Environment Variables

Edit `.env` with your credentials:

```env
# Microsoft Graph API Configuration
MICROSOFT_TENANT_ID=your-tenant-id-from-step-1.2
MICROSOFT_CLIENT_ID=your-client-id-from-step-1.2
MICROSOFT_CLIENT_SECRET=your-client-secret-from-step-1.3

# User Configuration
DEFAULT_USER_EMAIL=your-email@company.com

# Jira Configuration
JIRA_HOST=https://your-company.atlassian.net
JIRA_EMAIL=your-jira-email@company.com
JIRA_API_TOKEN=your-jira-token-from-step-2.1

# Time Tracking Rules (optional, has defaults)
DEFAULT_PROJECT_CODE=GENERAL
ROUNDING_MINUTES=15
MIN_MEETING_DURATION_MINUTES=5

# Logging (optional, has defaults)
LOG_LEVEL=info
LOG_FILE_PATH=./logs
```

## Step 4: Customize Classification Rules (Optional)

### 4.1 Edit Tracking Rules

Open `config/tracking-rules.json` and customize:

#### Add Your Project Patterns

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
          "projectCode": "YOUR-JIRA-KEY",
          "taskType": "meeting"
        }
      ]
    }
  }
}
```

#### Add Organizer Mappings

```json
{
  "organizerMapping": {
    "your-manager@company.com": {
      "defaultProject": "ADMIN",
      "defaultTaskType": "management"
    }
  }
}
```

#### Add Exclusion Patterns

```json
{
  "exclusions": {
    "titlePatterns": [
      "Lunch",
      "Break",
      "Your Custom Pattern"
    ]
  }
}
```

## Step 5: Test the Server

### 5.1 Test Microsoft Graph Connection

Create a test script `test-graph.js`:

```javascript
import graphClient from './src/auth/graph-client.js';
import dotenv from 'dotenv';

dotenv.config();

async function test() {
  try {
    await graphClient.initialize();
    const result = await graphClient.testConnection(process.env.DEFAULT_USER_EMAIL);
    console.log('Graph API test:', result);
  } catch (error) {
    console.error('Graph API test failed:', error.message);
  }
}

test();
```

Run it:
```bash
node test-graph.js
```

Expected output:
```
Graph API test: { success: true, user: { displayName: 'Your Name', ... } }
```

### 5.2 Test Jira Connection

Create a test script `test-jira.js`:

```javascript
import trackerConnector from './src/connectors/tracker.js';

async function test() {
  try {
    await trackerConnector.initialize();
    const projects = await trackerConnector.getProjects();
    console.log('Jira projects:', projects);
  } catch (error) {
    console.error('Jira test failed:', error.message);
  }
}

test();
```

Run it:
```bash
node test-jira.js
```

Expected output:
```
Jira projects: [ { key: 'PROJ', name: 'Project Name', id: '10001' }, ... ]
```

### 5.3 Start the Server

```bash
npm start
```

Expected output:
```
2026-06-16 11:00:00 [info]: Teams Time Tracker MCP Server initialized
2026-06-16 11:00:00 [info]: Registering tools
2026-06-16 11:00:00 [info]: Registered tool { name: 'list_recent_meetings' }
...
2026-06-16 11:00:00 [info]: Teams Time Tracker MCP Server started successfully
2026-06-16 11:00:00 [info]: Server is ready to accept requests via stdio
```

## Step 6: Configure MCP Client

### 6.1 Claude Desktop Configuration

If using Claude Desktop, add to your MCP settings:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "teams-timetracker": {
      "command": "node",
      "args": ["/absolute/path/to/TaskTimeTracker/src/server.js"],
      "env": {
        "MICROSOFT_TENANT_ID": "your-tenant-id",
        "MICROSOFT_CLIENT_ID": "your-client-id",
        "MICROSOFT_CLIENT_SECRET": "your-client-secret",
        "DEFAULT_USER_EMAIL": "your-email@company.com",
        "JIRA_HOST": "https://your-company.atlassian.net",
        "JIRA_EMAIL": "your-jira-email@company.com",
        "JIRA_API_TOKEN": "your-jira-token"
      }
    }
  }
}
```

**Note**: Use absolute paths, not relative paths or `~`.

### 6.2 Restart Claude Desktop

Restart Claude Desktop to load the new MCP server configuration.

### 6.3 Verify Connection

In Claude Desktop, you should see the Teams Time Tracker tools available.

## Step 7: First Use

### 7.1 Test with a Simple Query

Ask Claude:
```
List my meetings for today using the Teams Time Tracker
```

Claude should use the `list_recent_meetings` tool.

### 7.2 Try the Daily Review Prompt

Ask Claude:
```
Use the review-daily-timesheet prompt for today
```

This will guide you through the full workflow.

### 7.3 Always Start with Dry Run

When creating time entries, always use `dryRun: true` first:
```
Create time entries with dryRun: true
```

Review the output, then approve:
```
Looks good, create them with dryRun: false
```

## Troubleshooting

### Issue: "Missing required Microsoft Graph credentials"

**Solution**: 
- Verify `.env` file exists and has correct values
- Check `MICROSOFT_TENANT_ID`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`
- Ensure no extra spaces or quotes in `.env` values

### Issue: "Failed to initialize Microsoft Graph client"

**Solution**:
- Verify Azure AD app permissions are granted
- Check client secret hasn't expired
- Ensure tenant ID and client ID are correct

### Issue: "Graph API connection test failed"

**Solution**:
- Verify user email is correct
- Check API permissions include `User.Read.All`
- Ensure admin consent was granted

### Issue: "Jira connection test failed"

**Solution**:
- Verify Jira host URL (include `https://`)
- Check API token is valid
- Ensure email matches Jira account

### Issue: "No meetings found"

**Solution**:
- Verify date range is correct (ISO 8601 format)
- Check user has meetings in that range
- Ensure calendar permissions are granted

### Issue: "Attendance reports not available"

**Solution**:
- This is normal - attendance requires special permissions
- Server falls back to scheduled duration
- Not critical for basic functionality

### Issue: "Low confidence classifications"

**Solution**:
- Add more patterns to `config/tracking-rules.json`
- Use organizer mapping for common organizers
- Manually specify project codes when needed

## Security Best Practices

1. **Never commit `.env` file** - It contains secrets
2. **Rotate secrets regularly** - Especially client secrets and API tokens
3. **Use least privilege** - Only grant necessary permissions
4. **Monitor audit logs** - Check `logs/audit.log` regularly
5. **Review suggestions** - Always review before creating entries
6. **Use dry run** - Test with `dryRun: true` first

## Next Steps

1. Customize `config/tracking-rules.json` for your organization
2. Add your common meeting patterns
3. Set up organizer mappings for your team
4. Configure billability rules
5. Test with a week of meetings
6. Refine rules based on results
7. Set up regular sync schedule

## Getting Help

- Check logs in `logs/` directory
- Review documentation resources via MCP
- Read the main README.md
- Check GitHub issues

## Maintenance

### Regular Tasks

- **Weekly**: Review audit logs
- **Monthly**: Check for expired secrets
- **Quarterly**: Review and update classification rules
- **As needed**: Update dependencies with `npm update`

### Updating the Server

```bash
git pull  # or download new version
npm install  # update dependencies
npm start  # restart server
```

### Backup Configuration

Regularly backup:
- `.env` file (securely)
- `config/tracking-rules.json`
- `logs/audit.log`

## Success Criteria

You've successfully set up the server when:

- [x] Server starts without errors
- [x] Graph API connection test passes
- [x] Jira connection test passes
- [x] Can list meetings
- [x] Can generate suggestions
- [x] Can create time entries (dry run)
- [x] Classifications match your projects
- [x] Audit logs are being written

Congratulations! You're ready to automate your time tracking.