const { contextBridge, ipcRenderer } = require('electron');

// The URL-prompt page uses get/setUrl. `oauth: true` signals to the web app
// that this shell can host Google's sign-in popup (older shells can't, so they
// omit the flag and the web app hides the Google button on desktop).
contextBridge.exposeInMainWorld('minutes', {
  oauth: true,
  getUrl: () => ipcRenderer.invoke('minutes:get-url'),
  setUrl: (url) => ipcRenderer.send('minutes:set-url', url),
});
