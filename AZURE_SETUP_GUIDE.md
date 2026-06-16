# Azure AD App Registration - Detailed Step-by-Step Guide

This guide walks you through registering an app in Azure AD to access Microsoft Teams/Calendar data. **This is completely free.**

## Prerequisites

- A Microsoft account (work, school, or personal)
- Access to Microsoft 365 (Teams/Outlook)
- 10-15 minutes

## Step 1: Access Azure Portal

1. Open your web browser
2. Go to **https://portal.azure.com**
3. Sign in with your Microsoft account
   - Use the same account that has access to Teams/Outlook
   - If you have multiple accounts, choose the one with your meetings

**What you'll see:**
- Azure Portal home page with various services
- Don't worry if it looks complex - we only need one section

## Step 2: Navigate to Azure Active Directory

### Option A: Using Search (Easiest)
1. At the top of the page, you'll see a search bar
2. Type: **Azure Active Directory**
3. Click on **Azure Active Directory** in the results

### Option B: Using Menu
1. Click the hamburger menu (☰) on the top left
2. Scroll down and click **Azure Active Directory**

**What you'll see:**
- Azure Active Directory Overview page
- Left sidebar with many options

## Step 3: Go to App Registrations

1. In the left sidebar, look for **Manage** section
2. Click on **App registrations**
   - It's usually near the top of the Manage section
   - Icon looks like a grid of squares

**What you'll see:**
- List of registered applications (might be empty if this is your first)
- A button at the top that says **+ New registration**

## Step 4: Create New App Registration

1. Click the **+ New registration** button at the top
2. You'll see a form with several fields

### Fill in the form:

**Name:**
```
Teams Time Tracker
```
- This is just a friendly name for you to identify the app
- You can name it anything you want

**Supported account types:**
- Select: **Accounts in this organizational directory only (Single tenant)**
- This is the most secure option
- If you have a personal account, select: **Accounts in any organizational directory and personal Microsoft accounts**

**Redirect URI:**
- Leave this **BLANK** (empty)
- We don't need it for this type of app
- Click **Register** button at the bottom

**What happens next:**
- Azure creates your app (takes 2-3 seconds)
- You'll be redirected to the app's Overview page

## Step 5: Note Your Application IDs

You're now on the app's **Overview** page. You'll see important information:

### Copy These Values:

**Application (client) ID:**
- Looks like: `12345678-1234-1234-1234-123456789abc`
- This is a UUID/GUID format
- **Copy this** - you'll need it for your `.env` file
- Save it in a text file temporarily

**Directory (tenant) ID:**
- Also looks like: `87654321-4321-4321-4321-cba987654321`
- Also a UUID/GUID format
- **Copy this** - you'll need it for your `.env` file
- Save it in a text file temporarily

**Where to find them:**
- They're in the **Essentials** section at the top
- Clearly labeled
- You can click the copy icon next to each value

## Step 6: Create a Client Secret

A client secret is like a password for your app.

1. In the left sidebar, under **Manage**, click **Certificates & secrets**
2. You'll see two tabs: "Certificates" and "Client secrets"
3. Make sure you're on the **Client secrets** tab
4. Click **+ New client secret** button

### Fill in the form:

**Description:**
```
MCP Server Secret
```
- This helps you remember what this secret is for
- Useful if you create multiple secrets later

**Expires:**
- Choose an expiration period
- Options: 3 months, 6 months, 12 months, 24 months, or Custom
- **Recommendation**: Choose **24 months** (2 years)
- You'll need to create a new secret when it expires

5. Click **Add** button

### IMPORTANT: Copy the Secret NOW

**What you'll see:**
- A new row appears with your secret
- Two columns: "Value" and "Secret ID"
- The **Value** column shows your secret (looks like: `abc123~DEF456.ghi789_JKL012`)

**⚠️ CRITICAL:**
- **Copy the Value immediately** - you'll never see it again!
- Click the copy icon next to the Value
- Paste it into your text file
- Once you leave this page, the Value will be hidden forever
- If you lose it, you'll need to create a new secret

## Step 7: Configure API Permissions

Now we tell Azure what data your app needs to access.

1. In the left sidebar, under **Manage**, click **API permissions**
2. You'll see a list of permissions (might have one default permission)
3. Click **+ Add a permission** button

### Choose Microsoft Graph:

1. A panel opens on the right: "Request API permissions"
2. Click on **Microsoft Graph** (the big blue icon)
3. You'll see two options:
   - **Delegated permissions** (user acts on behalf of themselves)
   - **Application permissions** (app acts independently)
4. Click **Application permissions**

### Add Required Permissions:

Now you'll see a searchable list of permissions.

**Permission 1: Calendars.Read**
1. In the search box, type: `Calendars`
2. Expand the **Calendars** section (click the arrow)
3. Check the box next to **Calendars.Read**
   - Description: "Read calendars in all mailboxes"

**Permission 2: OnlineMeetings.Read.All**
1. In the search box, type: `OnlineMeetings`
2. Expand the **OnlineMeetings** section
3. Check the box next to **OnlineMeetings.Read.All**
   - Description: "Read online meeting details"

**Permission 3: User.Read.All**
1. In the search box, type: `User`
2. Expand the **User** section
3. Check the box next to **User.Read.All**
   - Description: "Read all users' full profiles"

4. Click **Add permissions** button at the bottom

**What you'll see:**
- You're back at the API permissions page
- Three new permissions listed
- Each shows "Not granted for [Your Organization]" in red

## Step 8: Grant Admin Consent

This is the final and most important step!

**What you'll see:**
- Your three permissions listed
- A column called "Status" showing "Not granted"
- A button at the top: **⚡ Grant admin consent for [Your Organization]**

**To grant consent:**

1. Click the **⚡ Grant admin consent for [Your Organization]** button
2. A popup appears asking: "Grant admin consent for the requested permissions?"
3. Click **Yes**

**What happens:**
- Azure processes the consent (takes 2-3 seconds)
- The Status column changes from "Not granted" to "Granted for [Your Organization]" with a green checkmark
- All three permissions should now show green checkmarks

**⚠️ Important Notes:**

- **If you're using a work/school account**: You might need your IT admin to grant consent
  - If you see an error like "Need admin approval", contact your IT department
  - Show them this guide and explain you need read-only access to your calendar
  
- **If you're using a personal account**: You can grant consent yourself
  - No admin needed

- **If the button is grayed out**: You don't have admin rights
  - Ask your IT admin for help
  - Or use a personal Microsoft account instead

## Step 9: Verify Everything

Let's make sure everything is set up correctly.

### Checklist:

- [ ] App is registered (you have an Application ID)
- [ ] You have a Directory (tenant) ID
- [ ] You created a client secret and **saved the value**
- [ ] You added three permissions:
  - [ ] Calendars.Read
  - [ ] OnlineMeetings.Read.All
  - [ ] User.Read.All
- [ ] All permissions show "Granted" with green checkmarks

### Your Saved Information Should Look Like:

```
Application (client) ID: 12345678-1234-1234-1234-123456789abc
Directory (tenant) ID: 87654321-4321-4321-4321-cba987654321
Client Secret Value: abc123~DEF456.ghi789_JKL012
```

## Step 10: Add to Your .env File

Now use these values in your project:

1. Open your project folder
2. Open the `.env` file (or create it from `.env.example`)
3. Add your values:

```env
MICROSOFT_TENANT_ID=87654321-4321-4321-4321-cba987654321
MICROSOFT_CLIENT_ID=12345678-1234-1234-1234-123456789abc
MICROSOFT_CLIENT_SECRET=abc123~DEF456.ghi789_JKL012
DEFAULT_USER_EMAIL=your-email@company.com
```

**Replace:**
- `MICROSOFT_TENANT_ID` with your Directory (tenant) ID
- `MICROSOFT_CLIENT_ID` with your Application (client) ID
- `MICROSOFT_CLIENT_SECRET` with your Client Secret Value
- `DEFAULT_USER_EMAIL` with your Microsoft 365 email

## Troubleshooting

### "I can't find Azure Active Directory"
- Make sure you're signed into portal.azure.com
- Use the search bar at the top
- Type "Azure Active Directory" and press Enter

### "I don't see the Grant admin consent button"
- You might not have admin rights
- Options:
  1. Ask your IT admin to grant consent
  2. Use a personal Microsoft account instead
  3. Ask your admin to make you an admin for this app only

### "I forgot to copy the client secret"
- Don't worry! You can create a new one
- Go back to Certificates & secrets
- Click + New client secret
- Copy the new value immediately

### "Permissions show 'Not granted'"
- Click the "Grant admin consent" button
- If it's grayed out, you need admin help
- Contact your IT department

### "I get an authentication error when testing"
- Double-check all three values in .env
- Make sure there are no extra spaces
- Make sure you copied the full secret value
- Verify permissions are granted (green checkmarks)

### "Need admin approval" error
- Your organization requires admin approval
- Send this guide to your IT admin
- Explain you need read-only calendar access
- They can grant consent in the Azure portal

## Security Best Practices

1. **Keep your client secret safe**
   - Never commit it to Git
   - Never share it publicly
   - Store it only in your .env file

2. **Rotate secrets regularly**
   - Create a new secret before the old one expires
   - Update your .env file
   - Delete the old secret

3. **Use least privilege**
   - We only requested read permissions
   - No write access to your calendar
   - No access to emails or other data

4. **Monitor usage**
   - Check Azure AD sign-in logs occasionally
   - Look for unexpected access

## What's Next?

Now that Azure AD is set up:

1. Make sure your `.env` file has all the values
2. Run `npm install` to install dependencies
3. Run `npm start` to start the server
4. Test with: "Bob, list my meetings for today"

## Cost Reminder

**Everything you just did is FREE:**
- ✅ App registration: FREE
- ✅ Client secrets: FREE
- ✅ API permissions: FREE
- ✅ Microsoft Graph API calls: FREE (within reasonable limits)

You will NOT be charged for this setup or usage.

## Need Help?

If you get stuck:
1. Check the Troubleshooting section above
2. Review the Azure AD documentation: https://docs.microsoft.com/en-us/azure/active-directory/
3. Check Microsoft Graph documentation: https://docs.microsoft.com/en-us/graph/

## Summary

You've successfully:
- ✅ Created an Azure AD app registration
- ✅ Generated credentials (Client ID, Tenant ID, Secret)
- ✅ Configured API permissions
- ✅ Granted admin consent
- ✅ Set up your .env file

Your MCP server can now access your Teams meetings and calendar data!