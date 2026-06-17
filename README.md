# Task Time Tracker

A comprehensive time tracking solution with Microsoft Teams integration, automatic classification, PostgreSQL-backed persistence, and OpenShift/Railway deployment support.

## 🚀 Quick Start

### Web UI (Recommended)
```bash
npm install
npm run web
# Access at http://localhost:3000
```

### Railway Deployment with Persistent Data
1. Add a PostgreSQL service in Railway
2. Set `DATABASE_URL` from Railway Postgres
3. Set `PGSSL=true`
4. Deploy the app
5. Access the public Railway URL

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
└── docs/            # Documentation
```

## 📚 Documentation

- **[Setup Guide](docs/SETUP.md)** - Installation and configuration
- **[Web UI Guide](docs/WEB_UI_GUIDE.md)** - Using the web interface
- **[Import Guide](docs/IMPORT_GUIDE.md)** - Import existing data
- **[OpenShift Deployment](docs/OPENSHIFT_QUICK_DEPLOY.md)** - Deploy to cluster
- **`.env.example`** - Required environment variables for Railway/Postgres

## ✨ Features

- 📊 **Dashboard** - Summary statistics and recent entries
- 📝 **Time Entries** - Full table view with filters
- ➕ **Manual Entry** - Easy form with auto-classification
- 📂 **Import** - CSV, Excel, and ICS calendar support
- 📈 **Reports** - Date-range reports with breakdowns
- 🔄 **Auto-Classification** - Smart project detection
- 🌐 **OpenShift Ready** - Enterprise deployment
- 🐘 **Postgres Persistence** - Data survives refreshes, restarts, and redeploys

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

### Railway Deployment
1. Create a Railway project
2. Add a PostgreSQL database
3. Set app variables:
   - `DATABASE_URL`
   - `PGSSL=true`
   - `PORT=3000`
   - `NODE_ENV=production`
4. Deploy the application
5. Access the generated public Railway URL

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

- **Production**: PostgreSQL via `DATABASE_URL`
- **Railway**: Use Railway Postgres for persistent storage
- **OpenShift**: Can use persistent volumes or external Postgres
- **Export**: CSV format

## 🔐 Security

- HTTPS/TLS encryption (OpenShift)
- Non-root container
- Resource limits
- Health checks

## 📝 License

MIT