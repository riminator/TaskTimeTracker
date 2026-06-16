# Task Time Tracker

A comprehensive time tracking solution with Microsoft Teams integration, automatic classification, and OpenShift deployment support.

## 🚀 Quick Start

### Web UI (Recommended)
```bash
npm install
npm run web
# Access at http://localhost:3000
```

### Deploy to OpenShift
```bash
oc login --server=https://your-cluster:6443
./scripts/deploy-to-openshift.sh
```

## 📁 Project Structure

```
TaskTimeTracker/
├── config/          # Configuration files
├── src/             # MCP server & core logic
├── web/             # Web application
├── openshift/       # Kubernetes manifests
├── scripts/         # Deployment scripts
├── docs/            # Documentation
└── data/            # Local storage
```

## 📚 Documentation

- **[Setup Guide](docs/SETUP.md)** - Installation and configuration
- **[Web UI Guide](docs/WEB_UI_GUIDE.md)** - Using the web interface
- **[Import Guide](docs/IMPORT_GUIDE.md)** - Import existing data
- **[OpenShift Deployment](docs/OPENSHIFT_QUICK_DEPLOY.md)** - Deploy to cluster

## ✨ Features

- 📊 **Dashboard** - Summary statistics and recent entries
- 📝 **Time Entries** - Full table view with filters
- ➕ **Manual Entry** - Easy form with auto-classification
- 📂 **Import** - CSV, Excel, and ICS calendar support
- 📈 **Reports** - Date-range reports with breakdowns
- 🔄 **Auto-Classification** - Smart project detection
- 🌐 **OpenShift Ready** - Enterprise deployment

## 🛠️ Commands

```bash
# Web UI
npm run web              # Start web server
npm run web:dev          # Start with auto-reload

# MCP Server (for Bob)
npm start                # Start MCP server
npm run dev              # Start with watch mode

# Deployment
./scripts/deploy-to-openshift.sh    # Deploy to OpenShift
./scripts/start-service.sh          # Start as PM2 service
./scripts/stop-service.sh           # Stop PM2 service
```

## 📖 Usage

### Web Interface
1. Start server: `npm run web`
2. Open browser: `http://localhost:3000`
3. Use tabs: Dashboard, Entries, Manual Entry, Import, Reports

### OpenShift Deployment
1. Login: `oc login --server=https://your-cluster:6443`
2. Deploy: `./scripts/deploy-to-openshift.sh`
3. Access: `https://timetracker-web-yourproject.apps.cluster.com`

## 🔧 Configuration

Edit `config/tracking-rules.json` to customize:
- Project mappings
- Classification patterns
- Time allocation rules
- Billability settings

## 📊 Data Storage

- **Local**: `data/time-entries.json`
- **OpenShift**: Persistent volumes
- **Export**: CSV format

## 🔐 Security

- HTTPS/TLS encryption (OpenShift)
- Non-root container
- Resource limits
- Health checks

## 📝 License

MIT