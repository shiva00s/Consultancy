Consultancy Application Suite
=============================

Overview
--------

This repository contains the Consultancy application: a cross-platform desktop client (Electron + Vite/React) and a mobile client (Expo/React Native). The workspace is structured to keep desktop and mobile code separate while sharing concepts and some utilities.

Directory layout
----------------

- consultancy-desktop/: Electron + Vite React desktop app
- consultancy-mobile/: Expo / React Native mobile app
- app/: shared app folders (legacy or other client code)

Quick links
-----------

- Desktop app: [consultancy-desktop](consultancy-desktop/README.md)
- Mobile app: [consultancy-mobile](consultancy-mobile/README.md)

Prerequisites
-------------

- Node.js 18+ (LTS recommended)
- npm (8+) or Yarn
- Git
- For mobile development: Expo CLI (`npm install -g expo-cli`) or use `npx expo` commands
- For packaging desktop: `electron`, `electron-builder` or `electron-packager` (see `consultancy-desktop/package.json` scripts)

Setup (local development)
-------------------------

1. Clone the repo and open the workspace root.
2. Install dependencies for each project:

- Desktop:

```bash
cd consultancy-desktop
npm install
```

- Mobile:

```bash
cd consultancy-mobile
npm install
```

Development
-----------

Desktop (Electron + Vite/React)

- Start the renderer dev server and Electron simultaneously (example scripts may vary):

```bash
cd consultancy-desktop
npm run dev
```

- Common issues:
  - If the packaged app shows a white/black screen, see the "Troubleshooting packaged Electron app" section below.
  - Use `app.isPackaged` checks in the main process to load `file://` assets in production and `http://localhost:...` during dev.

Mobile (Expo)

```bash
cd consultancy-mobile
npx expo start
```

Build & Package
---------------

Desktop

- Build renderer (Vite) and package with electron-builder:

```bash
cd consultancy-desktop
npm run build        # build the renderer (Vite)
npm run package      # package with electron-builder (script name may vary)
```

- Validate that the packaged installer includes the built `index.html` and asset files.

Mobile (Expo)

- Build for production using EAS or Expo build services per your Expo configuration.

Configuration & Environment
---------------------------

- Environment variables: check `consultancy-desktop` and `consultancy-mobile` for `.env` usage.
- Electron `preload.cjs` exposes `window.electronAPI` functions used by the renderer. Keep `contextIsolation: true` and `nodeIntegration: false` for security.

Key implementation notes and best-practices
-----------------------------------------

- In the Electron main process (e.g., `consultancy-desktop/electron.cjs`):
  - Create the BrowserWindow with `show: false` and `backgroundColor` set, and call `win.show()` on `ready-to-show` to avoid flashes.
  - Consider `app.disableHardwareAcceleration()` or `app.commandLine.appendSwitch('disable-gpu')` for machines with GPU-related black-screen issues.
  - Use `app.isPackaged` or `process.resourcesPath` to load production assets via `file://`.

- Preload and secure IPC:
  - Keep a small `preload.cjs` that exposes only permitted APIs via `contextBridge`.
  - Validate all file paths on the main side to avoid surprising OS dialogs.

Troubleshooting packaged Electron app (white/black screen)
---------------------------------------------------------

- Symptoms: app window shows white or black content after launching the packaged .exe.

- Checklist:
  - Confirm the built `index.html` and assets are present inside the packaged app (check `resources/app` or the `app.asar` contents).
  - In `electron.cjs`, ensure BrowserWindow loads the correct path when `app.isPackaged` is true. Example:

```js
const path = require('path');
const url = app.isPackaged
  ? `file://${path.join(process.resourcesPath, 'app', 'index.html')}`
  : 'http://localhost:5173';
win.loadURL(url);
```

  - Create the window with `show: false` and only `win.show()` on `'ready-to-show'`.
  - Temporarily enable logging and `win.webContents.openDevTools()` on non-packaged builds to inspect renderer console errors.
  - If the renderer crashed, capture logs via `win.webContents.on('crashed', ...)` and `process.on('uncaughtException', ...)` in main.
  - Disable hardware acceleration early in the main process for debugging:

```js
// main process, before app.whenReady()
// app.disableHardwareAcceleration();
```

File preview & document embedding guidance
-----------------------------------------

- The renderer should only attempt to embed file types that the app can render in an <embed> or <img> tag (images, PDFs). Do not embed binary formats such as `.docx` or `.xlsx` — instead show an icon and a "View" link that opens the file externally via `shell.openPath` or a safe electronAPI call.
- Use `data:` URIs for PDFs and images when necessary, but do not pass raw octet-streams that may cause the OS to show a Save dialog.

Security & Packaging notes
--------------------------

- Keep `contextIsolation: true` and avoid enabling `nodeIntegration` in renderer.
- If using `asar`, exclude (`asarUnpack`) native modules or files that must be accessed via the filesystem by native code.

Testing & Debugging
-------------------

- Run the renderer dev server alone to ensure the UI builds cleanly:

```bash
cd consultancy-desktop
npm run build
# inspect dist/index.html
```

- Run Electron in dev to validate the main-renderer integration:

```bash
cd consultancy-desktop
npm run dev
# or
electron .
```

- For logging when running the packaged .exe, enable file-based logs in the main process and write to `app.getPath('userData')`.

Contributing
------------

- Fork, add a feature branch, and submit PRs with descriptive titles and tests where applicable.
- Keep UI and business logic separated; add unit tests for utilities under `src/utils/`.

Next steps & Recommendations
----------------------------

- Run the packaged .exe on a clean Windows VM to confirm behavior and capture logs.
- Add CI pipeline steps to build desktop and mobile artifacts and run smoke tests.
- Consider adding a small splash window for faster feedback on startup and to mask early loading steps.

Files of interest
-----------------

- Desktop main process: [consultancy-desktop/electron.cjs](consultancy-desktop/electron.cjs)
- Desktop preload: [consultancy-desktop/preload.cjs](consultancy-desktop/preload.cjs)
- Desktop entry: [consultancy-desktop/index.html](consultancy-desktop/index.html)
- Candidate medical component (preview logic): [consultancy-desktop/src/components/candidate-detail/CandidateMedical.jsx](consultancy-desktop/src/components/candidate-detail/CandidateMedical.jsx)

License
-------

Add your license here (e.g., MIT). If you already have a LICENSE file, mention it here.

---

If you'd like, I can:

- Tailor this README to a specific subproject (`consultancy-desktop` or `consultancy-mobile`) and include exact `npm` scripts from `package.json`.
- Add CI sample workflow for GitHub Actions to build and package the desktop app.

Tell me which of the above you'd like next and I'll add it to the plan.