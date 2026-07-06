const { execSync } = require('node:child_process');
const path = require('node:path');

// electron-builder with `identity: null` skips signing, which leaves the app
// bundle's seal invalid — its resources (app.asar, icons) are packed in AFTER
// Electron's own linker signature, so macOS (especially Apple Silicon) reports
// the app as "damaged". Re-seal the whole bundle with an ad-hoc signature so it
// runs. (Still "unidentified developer" on first open — that needs a paid cert —
// but no longer "damaged".)
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' });
  console.log(`  • ad-hoc signed ${appName}.app`);
};
