// API Base URL
const API_BASE = '';

// State
let currentEntries = [];
let currentProjects = [];
let editingEntryId = null;
let selectedEntries = new Set();
let appPassword = localStorage.getItem('appPassword') || '';

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initializeTabs();
    initializeEventListeners();
    loadDashboard();
    loadProjects();
});

// Tab Navigation
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            
            // Update active states
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            button.classList.add('active');
            document.getElementById(tabName).classList.add('active');
            
            // Load tab-specific data
            if (tabName === 'entries') loadEntries();
            if (tabName === 'dashboard') loadDashboard();
        });
    });
}

// Event Listeners
function initializeEventListeners() {
    // Header actions
    document.getElementById('refreshBtn').addEventListener('click', () => {
        loadDashboard();
        loadEntries();
        showToast('Data refreshed', 'success');
    });
    
    document.getElementById('exportBtn').addEventListener('click', exportCSV);
    
    // Manual entry form
    document.getElementById('manualEntryForm').addEventListener('submit', handleManualEntry);
    document.getElementById('classifyBtn').addEventListener('click', classifyMeeting);
    
    // Calculate duration from times
    document.getElementById('entryStartTime').addEventListener('change', calculateDuration);
    document.getElementById('entryEndTime').addEventListener('change', calculateDuration);
    
    // Import forms
    document.getElementById('csvImportForm').addEventListener('submit', handleCSVImport);
    document.getElementById('icsImportForm').addEventListener('submit', handleICSImport);
    
    // File input labels
    document.getElementById('csvFile').addEventListener('change', updateFileLabel);
    document.getElementById('icsFile').addEventListener('change', updateFileLabel);
    
    // Filters
    document.getElementById('applyFilters').addEventListener('click', applyFilters);
    document.getElementById('clearFilters').addEventListener('click', clearFilters);
    
    // Bulk delete
    document.getElementById('selectAllEntries').addEventListener('change', toggleSelectAll);
    document.getElementById('bulkDeleteBtn').addEventListener('click', bulkDeleteEntries);
    
    // Reports
    document.getElementById('generateReport').addEventListener('click', generateReport);
    
    // Edit modal
    document.getElementById('editEntryForm').addEventListener('submit', handleEditEntry);
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });
    
    // Close modal on outside click
    document.getElementById('editModal').addEventListener('click', (e) => {
        if (e.target.id === 'editModal') closeModal();
    });
}

// Dashboard Functions
async function loadDashboard() {
    try {
        const entries = await fetchAPI('/api/entries');
        currentEntries = entries;
        
        // Calculate statistics
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        
        const monthEntries = entries.filter(e => new Date(e.date) >= startOfMonth);
        const weekEntries = entries.filter(e => new Date(e.date) >= startOfWeek);
        
        const totalHours = monthEntries.reduce((sum, e) => sum + (e.durationMinutes / 60), 0);
        const weekHours = weekEntries.reduce((sum, e) => sum + (e.durationMinutes / 60), 0);
        const projects = [...new Set(entries.map(e => e.projectCode))];
        
        // Update summary cards
        document.getElementById('totalHours').textContent = totalHours.toFixed(1);
        document.getElementById('totalEntries').textContent = entries.length;
        document.getElementById('activeProjects').textContent = projects.length;
        document.getElementById('weekHours').textContent = weekHours.toFixed(1);
        
        // Load recent entries
        loadRecentEntries(entries.slice(0, 10));
        
        // Load project breakdown
        loadProjectBreakdown(entries);
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showToast('Failed to load dashboard', 'error');
    }
}

function loadRecentEntries(entries) {
    const container = document.getElementById('recentEntriesList');
    
    if (entries.length === 0) {
        container.innerHTML = '<div class="text-center text-muted">No entries yet</div>';
        return;
    }
    
    container.innerHTML = entries.map(entry => `
        <div class="entry-item">
            <div class="entry-info">
                <div class="entry-title">${escapeHtml(entry.meetingTitle || 'Untitled')}</div>
                <div class="entry-meta">
                    ${entry.projectCode} • ${formatDate(entry.date)} • ${entry.taskType}
                </div>
            </div>
            <div class="entry-duration">${formatDuration(entry.durationMinutes)}</div>
        </div>
    `).join('');
}

function loadProjectBreakdown(entries) {
    const container = document.getElementById('projectBreakdown');
    
    // Group by project
    const projectHours = {};
    entries.forEach(entry => {
        const project = entry.projectCode || 'Unknown';
        if (!projectHours[project]) projectHours[project] = 0;
        projectHours[project] += entry.durationMinutes / 60;
    });
    
    // Sort by hours
    const sorted = Object.entries(projectHours)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    if (sorted.length === 0) {
        container.innerHTML = '<div class="text-center text-muted">No data yet</div>';
        return;
    }
    
    container.innerHTML = sorted.map(([project, hours]) => `
        <div class="breakdown-item">
            <div class="project-name">${escapeHtml(project)}</div>
            <div class="project-hours">${hours.toFixed(1)}h</div>
        </div>
    `).join('');
}

// Entries Functions
async function loadEntries() {
    try {
        const entries = await fetchAPI('/api/entries');
        currentEntries = entries;
        displayEntries(entries);
    } catch (error) {
        console.error('Error loading entries:', error);
        showToast('Failed to load entries', 'error');
    }
}

function displayEntries(entries) {
    const tbody = document.getElementById('entriesTableBody');
    
    if (entries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No entries found</td></tr>';
        return;
    }
    
    tbody.innerHTML = entries.map(entry => `
        <tr>
            <td><input type="checkbox" class="entry-checkbox" data-id="${entry.id}" onchange="toggleEntrySelection('${entry.id}')"></td>
            <td>${formatDate(entry.date)}</td>
            <td>${escapeHtml(entry.projectCode)}</td>
            <td>${escapeHtml(entry.meetingTitle || 'Untitled')}</td>
            <td>${formatDuration(entry.durationMinutes)}</td>
            <td>${escapeHtml(entry.taskType)}</td>
            <td class="table-actions">
                <button class="action-btn" onclick="editEntry('${entry.id}')" title="Edit">✏️</button>
                <button class="action-btn" onclick="deleteEntry('${entry.id}')" title="Delete">🗑️</button>
            </td>
        </tr>
    `).join('');
}

async function applyFilters() {
    const startDate = document.getElementById('filterStartDate').value;
    const endDate = document.getElementById('filterEndDate').value;
    const project = document.getElementById('filterProject').value;
    
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (project) params.append('projectCode', project);
    
    try {
        const entries = await fetchAPI(`/api/entries?${params}`);
        displayEntries(entries);
    } catch (error) {
        console.error('Error applying filters:', error);
        showToast('Failed to apply filters', 'error');
    }
}

function clearFilters() {
    document.getElementById('filterStartDate').value = '';
    document.getElementById('filterEndDate').value = '';
    document.getElementById('filterProject').value = '';
    loadEntries();
}

function toggleEntrySelection(entryId) {
    if (selectedEntries.has(entryId)) {
        selectedEntries.delete(entryId);
    } else {
        selectedEntries.add(entryId);
    }
    updateBulkDeleteButton();
}

function toggleSelectAll(e) {
    const checkboxes = document.querySelectorAll('.entry-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = e.target.checked;
        const entryId = cb.dataset.id;
        if (e.target.checked) {
            selectedEntries.add(entryId);
        } else {
            selectedEntries.delete(entryId);
        }
    });
    updateBulkDeleteButton();
}

function updateBulkDeleteButton() {
    const btn = document.getElementById('bulkDeleteBtn');
    const count = document.getElementById('selectedCount');
    
    if (selectedEntries.size > 0) {
        btn.style.display = 'inline-block';
        count.textContent = selectedEntries.size;
    } else {
        btn.style.display = 'none';
    }
}

async function bulkDeleteEntries() {
    if (selectedEntries.size === 0) return;
    
    const confirmed = confirm(`Are you sure you want to delete ${selectedEntries.size} entries? This cannot be undone.`);
    if (!confirmed) return;
    
    try {
        const response = await fetchAPI('/api/entries/bulk-delete', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ ids: Array.from(selectedEntries) })
        });
        
        showToast(`Successfully deleted ${response.deletedCount} entries`, 'success');
        selectedEntries.clear();
        document.getElementById('selectAllEntries').checked = false;
        updateBulkDeleteButton();
        loadEntries();
        loadDashboard();
    } catch (error) {
        console.error('Error bulk deleting entries:', error);
        showToast('Failed to delete entries', 'error');
    }
}

// Manual Entry Functions
async function handleManualEntry(e) {
    e.preventDefault();
    
    const formData = {
        date: document.getElementById('entryDate').value,
        startTime: `${document.getElementById('entryDate').value}T${document.getElementById('entryStartTime').value}:00Z`,
        durationMinutes: parseFloat(document.getElementById('entryDuration').value) * 60,
        meetingTitle: document.getElementById('entryTitle').value,
        projectCode: document.getElementById('entryProject').value,
        taskType: document.getElementById('entryTaskType').value,
        billable: document.getElementById('entryBillable').value === 'true',
        description: document.getElementById('entryDescription').value,
        organizer: document.getElementById('entryOrganizer').value,
        attendees: document.getElementById('entryAttendees').value.split(',').map(a => a.trim()).filter(a => a)
    };
    
    // Add end time if provided
    const endTime = document.getElementById('entryEndTime').value;
    if (endTime) {
        formData.endTime = `${document.getElementById('entryDate').value}T${endTime}:00Z`;
    }
    
    try {
        await fetchAPI('/api/entries', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(formData)
        });
        
        showToast('Entry created successfully', 'success');
        document.getElementById('manualEntryForm').reset();
        loadDashboard();
    } catch (error) {
        console.error('Error creating entry:', error);
        showToast('Failed to create entry', 'error');
    }
}

async function classifyMeeting() {
    const title = document.getElementById('entryTitle').value;
    const organizer = document.getElementById('entryOrganizer').value;
    const attendees = document.getElementById('entryAttendees').value.split(',').map(a => a.trim()).filter(a => a);
    
    if (!title) {
        showToast('Please enter a meeting title first', 'error');
        return;
    }
    
    try {
        const classification = await fetchAPI('/api/classify', {
            method: 'POST',
            body: JSON.stringify({ title, organizer, attendees })
        });
        
        document.getElementById('entryProject').value = classification.projectCode;
        document.getElementById('entryTaskType').value = classification.taskType;
        document.getElementById('entryBillable').value = classification.billable.toString();
        
        showToast(`Classified with ${(classification.confidence * 100).toFixed(0)}% confidence`, 'success');
    } catch (error) {
        console.error('Error classifying meeting:', error);
        showToast('Failed to classify meeting', 'error');
    }
}

function calculateDuration() {
    const startTime = document.getElementById('entryStartTime').value;
    const endTime = document.getElementById('entryEndTime').value;
    
    if (startTime && endTime) {
        const start = new Date(`2000-01-01T${startTime}`);
        const end = new Date(`2000-01-01T${endTime}`);
        const hours = (end - start) / (1000 * 60 * 60);
        
        if (hours > 0) {
            document.getElementById('entryDuration').value = hours.toFixed(2);
        }
    }
}

// Import Functions
async function handleCSVImport(e) {
    e.preventDefault();
    
    const fileInput = document.getElementById('csvFile');
    const file = fileInput.files[0];
    
    if (!file) {
        showToast('Please select a file', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const result = await fetch(`${API_BASE}/api/import/csv`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: formData
        }).then(async r => {
            if (r.status === 401) {
                localStorage.removeItem('appPassword');
                appPassword = '';
            }
            const data = await r.json();
            if (!r.ok) {
                throw new Error(data.error || 'Import failed');
            }
            return data;
        });
        
        const resultDiv = document.getElementById('csvImportResult');
        resultDiv.className = 'import-result success';
        resultDiv.textContent = `Successfully imported ${result.count} entries`;
        
        showToast(`Imported ${result.count} entries`, 'success');
        document.getElementById('csvImportForm').reset();
        loadDashboard();
    } catch (error) {
        console.error('Error importing CSV:', error);
        const resultDiv = document.getElementById('csvImportResult');
        resultDiv.className = 'import-result error';
        resultDiv.textContent = `Import failed: ${error.message}`;
        showToast('Import failed', 'error');
    }
}

async function handleICSImport(e) {
    e.preventDefault();
    
    const fileInput = document.getElementById('icsFile');
    const file = fileInput.files[0];
    
    if (!file) {
        showToast('Please select a file', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const result = await fetch(`${API_BASE}/api/import/ics`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: formData
        }).then(async r => {
            if (r.status === 401) {
                localStorage.removeItem('appPassword');
                appPassword = '';
            }
            const data = await r.json();
            if (!r.ok) {
                throw new Error(data.error || 'Import failed');
            }
            return data;
        });
        
        const resultDiv = document.getElementById('icsImportResult');
        resultDiv.className = 'import-result success';
        resultDiv.textContent = `Successfully imported ${result.count} calendar events`;
        
        showToast(`Imported ${result.count} events`, 'success');
        document.getElementById('icsImportForm').reset();
        loadDashboard();
    } catch (error) {
        console.error('Error importing ICS:', error);
        const resultDiv = document.getElementById('icsImportResult');
        resultDiv.className = 'import-result error';
        resultDiv.textContent = `Import failed: ${error.message}`;
        showToast('Import failed', 'error');
    }
}

function updateFileLabel(e) {
    const input = e.target;
    const label = input.nextElementSibling;
    const textSpan = label.querySelector('.file-text');
    
    if (input.files.length > 0) {
        textSpan.textContent = input.files[0].name;
    } else {
        textSpan.textContent = input.id === 'csvFile' ? 'Choose CSV/Excel file' : 'Choose ICS file';
    }
}

// Edit/Delete Functions
async function editEntry(id) {
    try {
        const entry = await fetchAPI(`/api/entries/${id}`);
        editingEntryId = id;
        
        // Populate form
        document.getElementById('editEntryId').value = entry.id;
        document.getElementById('editDate').value = entry.date;
        document.getElementById('editDuration').value = (entry.durationMinutes / 60).toFixed(2);
        document.getElementById('editTitle').value = entry.meetingTitle || '';
        document.getElementById('editProject').value = entry.projectCode;
        document.getElementById('editTaskType').value = entry.taskType;
        document.getElementById('editDescription').value = entry.description || '';
        
        // Show modal
        document.getElementById('editModal').classList.add('active');
    } catch (error) {
        console.error('Error loading entry:', error);
        showToast('Failed to load entry', 'error');
    }
}

async function handleEditEntry(e) {
    e.preventDefault();
    
    const id = document.getElementById('editEntryId').value;
    const updates = {
        date: document.getElementById('editDate').value,
        durationMinutes: parseFloat(document.getElementById('editDuration').value) * 60,
        meetingTitle: document.getElementById('editTitle').value,
        projectCode: document.getElementById('editProject').value,
        taskType: document.getElementById('editTaskType').value,
        description: document.getElementById('editDescription').value
    };
    
    try {
        await fetchAPI(`/api/entries/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(updates)
        });
        
        showToast('Entry updated successfully', 'success');
        closeModal();
        loadDashboard();
        loadEntries();
    } catch (error) {
        console.error('Error updating entry:', error);
        showToast('Failed to update entry', 'error');
    }
}

async function deleteEntry(id) {
    if (!confirm('Are you sure you want to delete this entry?')) {
        return;
    }
    
    try {
        await fetchAPI(`/api/entries/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        showToast('Entry deleted successfully', 'success');
        loadDashboard();
        loadEntries();
    } catch (error) {
        console.error('Error deleting entry:', error);
        showToast('Failed to delete entry', 'error');
    }
}

function closeModal() {
    document.getElementById('editModal').classList.remove('active');
    editingEntryId = null;
}

// Reports Functions
async function generateReport() {
    const startDate = document.getElementById('reportStartDate').value;
    const endDate = document.getElementById('reportEndDate').value;
    
    if (!startDate || !endDate) {
        showToast('Please select both start and end dates', 'error');
        return;
    }
    
    try {
        const params = new URLSearchParams({ startDate, endDate });
        const summary = await fetchAPI(`/api/summary?${params}`);
        
        displayReportSummary(summary);
        displayReportByProject(summary.byProject);
        displayReportByDay(summary.byDay);
        displayReportByType(summary.byType);
    } catch (error) {
        console.error('Error generating report:', error);
        showToast('Failed to generate report', 'error');
    }
}

function displayReportSummary(summary) {
    const container = document.getElementById('reportSummary');
    container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
            <div>
                <strong>Total Hours:</strong> ${summary.totalHours.toFixed(1)}
            </div>
            <div>
                <strong>Total Entries:</strong> ${summary.totalEntries}
            </div>
            <div>
                <strong>Billable Hours:</strong> ${summary.billableHours.toFixed(1)}
            </div>
            <div>
                <strong>Projects:</strong> ${summary.projectCount}
            </div>
        </div>
    `;
}

function displayReportByProject(data) {
    const container = document.getElementById('reportByProject');
    
    if (!data || data.length === 0) {
        container.innerHTML = '<p class="text-muted">No data</p>';
        return;
    }
    
    container.innerHTML = `
        <table class="report-table">
            <thead>
                <tr>
                    <th>Project</th>
                    <th>Hours</th>
                    <th>Entries</th>
                    <th>Percentage</th>
                </tr>
            </thead>
            <tbody>
                ${data.map(item => `
                    <tr>
                        <td>${escapeHtml(item.project)}</td>
                        <td>${item.hours.toFixed(1)}</td>
                        <td>${item.count}</td>
                        <td>${item.percentage.toFixed(1)}%</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function displayReportByDay(data) {
    const container = document.getElementById('reportByDay');
    
    if (!data || data.length === 0) {
        container.innerHTML = '<p class="text-muted">No data</p>';
        return;
    }
    
    container.innerHTML = `
        <table class="report-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Hours</th>
                    <th>Entries</th>
                </tr>
            </thead>
            <tbody>
                ${data.map(item => `
                    <tr>
                        <td>${formatDate(item.date)}</td>
                        <td>${item.hours.toFixed(1)}</td>
                        <td>${item.count}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function displayReportByType(data) {
    const container = document.getElementById('reportByType');
    
    if (!data || data.length === 0) {
        container.innerHTML = '<p class="text-muted">No data</p>';
        return;
    }
    
    container.innerHTML = `
        <table class="report-table">
            <thead>
                <tr>
                    <th>Task Type</th>
                    <th>Hours</th>
                    <th>Entries</th>
                    <th>Percentage</th>
                </tr>
            </thead>
            <tbody>
                ${data.map(item => `
                    <tr>
                        <td>${escapeHtml(item.type)}</td>
                        <td>${item.hours.toFixed(1)}</td>
                        <td>${item.count}</td>
                        <td>${item.percentage.toFixed(1)}%</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// Export Functions
async function exportCSV() {
    try {
        const response = await fetch(`${API_BASE}/api/export/csv`);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `time-entries-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        showToast('CSV exported successfully', 'success');
    } catch (error) {
        console.error('Error exporting CSV:', error);
        showToast('Failed to export CSV', 'error');
    }
}

// Projects Functions
async function loadProjects() {
    try {
        const projects = await fetchAPI('/api/projects');
        currentProjects = projects;
        
        // Update project filter dropdown
        const filterSelect = document.getElementById('filterProject');
        filterSelect.innerHTML = '<option value="">All Projects</option>' +
            projects.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');
        
        // Update project datalist
        const datalist = document.getElementById('projectsList');
        datalist.innerHTML = projects.map(p => `<option value="${escapeHtml(p)}">`).join('');
    } catch (error) {
        console.error('Error loading projects:', error);
    }
}

// Utility Functions
function getAppPassword() {
    if (!appPassword) {
        const entered = window.prompt('Enter password to modify time entries:', 'password');
        if (!entered) {
            throw new Error('Password required');
        }
        appPassword = entered;
        localStorage.setItem('appPassword', appPassword);
    }
    return appPassword;
}

function getAuthHeaders() {
    return {
        'x-app-password': getAppPassword()
    };
}

async function fetchAPI(url, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    const mergedHeaders = {
        ...defaultOptions.headers,
        ...(options.headers || {})
    };

    const response = await fetch(`${API_BASE}${url}`, {
        ...defaultOptions,
        ...options,
        headers: mergedHeaders
    });
    
    if (!response.ok) {
        if (response.status === 401) {
            localStorage.removeItem('appPassword');
            appPassword = '';
        }
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || 'Request failed');
    }
    
    return response.json();
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️'
    };
    
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${escapeHtml(message)}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

function formatDuration(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Set default dates
const today = new Date().toISOString().split('T')[0];
document.getElementById('entryDate').value = today;

const firstOfMonth = new Date();
firstOfMonth.setDate(1);
document.getElementById('reportStartDate').value = firstOfMonth.toISOString().split('T')[0];
document.getElementById('reportEndDate').value = today;

// Made with Bob
