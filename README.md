# DB Browser — Local Connector Architecture

This repository contains a hybrid cloud-local database client. While the core web application UI is hosted centrally (e.g., on Vercel), ordinary web pages cannot directly access databases bound to `localhost` or private networks due to standard browser security sandboxing. 

This solution uses a lightweight **Chrome/Edge Extension** paired with an OS-level **Native Messaging Host** to safely bridge the gap, enabling developers to browse, preview, and run queries against their local PostgreSQL instances straight from the web app interface.

---

## 🏗️ System Architecture & Data Flow

When a user interacts with a database marked as **Local**, the data flows through the following secure pipeline:

```text
[ Web UI Component ] (Sidebar / TableWorkspace)
       │
       ▼ (window.postMessage)
[ Extension Content Script ] (Runs in page context)
       │
       ▼ (chrome.runtime.sendMessage)
[ Extension Background Worker ] (MV3 Service Worker)
       │
       ▼ (Standard I/O Pipe: 4-byte little-endian length prefix + JSON)
[ Native Messaging Host ] (Local Node.js process)
       │
       ▼ (pg Connection Pool)
[ Local PostgreSQL Database ] (localhost:5432)
Frontend Client (src/services/extensionBridge.js): Intercepts database calls when a local configuration is active and emits standard window events.

Content Script (extension/content.js): Bridges the web page world and the isolated extension API world.

Background Worker (extension/background.js): Acts as a protocol translator, matching unique request IDs to their respective tabs and piping requests to the operating system.

Native Host (native-host/native-host.js): A headless Node.js utility executed on-demand by the browser that manages secure PostgreSQL connection pools and speaks back over standard stdin/stdout pipelines.

📁 Repository Structure
Plaintext
├── db-browser-frontend/       # React + Vite Web Application
│   ├── src/
│   │   ├── components/
│   │   │   ├── ConnectionManager.jsx  # Manages and tests connection entries
│   │   │   ├── Sidebar.jsx            # Renders local schema tree & handles metadata searches
│   │   │   └── TableWorkspace.jsx     # Handles data grid preview, editor queries & metrics
│   │   └── services/
│   │       ├── api.js                 # Axios instance for cloud-hosted routing
│   │       └── extensionBridge.js     # PostMessage handler communicating with the extension
├── extension/                 # Browser Extension Source (Manifest V3)
│   ├── manifest.json          # Permissions (nativeMessaging) and page matching scopes
│   ├── background.js          # Persistent orchestration worker & port mapper
│   └── content.js             # Window event interceptor injected into authorized origins
└── native-host/               # Native Messaging Host
    ├── native-host.js         # Entry node script managing pooling and query execution
    ├── install.ps1            # Automated Windows Registry installation script
    └── com.dbbrowser.nativehost.json # Registry manifest telling Chrome where the binary lives
🛠️ Step-by-Step Setup Guide
Follow these steps in order to configure your local machine for development or testing:

Prerequisites
Node.js (LTS version recommended)

PostgreSQL running locally (e.g., on port 5432)

Google Chrome or Microsoft Edge browser

Step 1: Install & Register the Native Host
The browser needs to know that an authorized local script is available to handle I/O requests.

Open PowerShell as a normal user.

Navigate to the native-host directory:

PowerShell
cd native-host
Execute the automated installation script:

PowerShell
.\install.ps1
What this script does behind the scenes:

Verifies your Node.js runtime availability.

Copies the runner utilities into your local application state ($env:LOCALAPPDATA\DBBrowserNativeHost).

Automatically pulls the pg database library dependencies into the deployment target folder.

Generates a structural runtime .bat file wrapper.

Configures a user-scoped registry entry at HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.dbbrowser.nativehost pointing directly to the configuration manifest.

Step 2: Load the Browser Extension
Open your browser and navigate to the extensions control page:

Chrome: chrome://extensions/

Edge: edge://extensions/

Toggle Developer mode on (typically a switch in the top-right corner).

Click the Load unpacked button in the top-left corner.

Select the extension folder located inside this repository directory.

Note: You will now see the extension DB Browser Local Connector active in your extension list.

Step 3: Run the React Web Application
Open a terminal window and enter the frontend package workspace:

Bash
cd db-browser-frontend
Install client-side dependencies:

Bash
npm install
Boot your local Vite development engine:

Bash
npm run dev
Open the printed localhost URL in your browser (typically http://localhost:5173/).

🔌 How to Use the Local Connection Feature
Open the DB Browser web app interface in your browser.

Click on + Add Connection.

Provide a configuration profile:

Label: e.g., Local Dev DB

Host: localhost or 127.0.0.1

Port: 5432

Database Username: Your local Postgres user role

Database Password: Your local user password

Database Name: The target database you want to mount

Check the box labeled "This database is on my own machine (uses the browser extension)".

Click Test Connection to verify end-to-end viability through the native host layer.

Click Save Connection to record your profile to local device metadata state.

You can now click your newly mounted database inside the workspace panel. The sidebar will populate structural nodes dynamically by inspecting your local information_schema tables, and you can use the interactive data visualizer grids or run complex statements within the SQL tab directly against your machine!

🔒 Security Parameters
Plaintext Protections: No database credentials or structural system access passwords are ever transmitted or written out onto cloud networks. Everything is isolated locally via standard browser loopbacks (localStorage metadata parameters on your own device).

On-Demand Lifecycle: The native helper agent doesn't sit idle consuming system resources or background threads. The operating system spins it up on-demand strictly when Chrome requests database interaction and terminates it as soon as connection streams close.

Origin Limitations: The extension script limits frame injection visibility to explicit app locations matching http://localhost:5173/* and target deployment application links. External third-party web contexts can never read from or trigger access commands through the local worker pipeline.