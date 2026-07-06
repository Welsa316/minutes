# Minutes — Desktop app

A thin native shell around the Minutes web app. It opens your deployed
Minutes site (your Railway URL) in its own window — same login, same data,
no browser chrome. Same idea as the Notion desktop app.

## Getting installers

**Easiest — GitHub Actions build both `.dmg` and `.exe`:**

- Push a tag to build a release with both attached:
  ```
  git tag v0.1.0 && git push origin v0.1.0
  ```
  The installers appear under the repo's **Releases**.
- Or run it ad-hoc: repo → **Actions → Build desktop apps → Run workflow**.
  The `.dmg` / `.exe` download from the run's **Artifacts**.

**Build the Mac `.dmg` locally:**

```
cd desktop
npm install
npm run dist:mac      # → desktop/dist/Minutes-<version>.dmg
```

(`npm run dist:win` builds the Windows installer, but a Windows `.exe` is
best built on Windows or via the Actions workflow above.)

## First launch

The app asks for your Minutes server URL (your Railway address) once and
remembers it. Change it anytime from **File → Set Server URL…**. To ship it
pre-pointed at your server instead, set `DEFAULT_URL` in `config.js`.

## Opening an unsigned build

These builds aren't code-signed (that needs a paid Apple/Microsoft
developer cert), so the OS will warn on first open:

- **macOS**: if you see "Minutes is damaged / can't be opened", clear the
  download quarantine flag once:
  ```
  xattr -cr /Applications/Minutes.app
  ```
  then open it. (Or right-click the app → Open → Open.)
- **Windows**: SmartScreen → **More info → Run anyway**.

## Dev

```
cd desktop
npm install
npm start
```
