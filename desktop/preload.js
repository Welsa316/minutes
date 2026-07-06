const { contextBridge, ipcRenderer } = require('electron');

// Only the URL-prompt page uses this; the Minutes web app ignores it.
contextBridge.exposeInMainWorld('minutes', {
  getUrl: () => ipcRenderer.invoke('minutes:get-url'),
  setUrl: (url) => ipcRenderer.send('minutes:set-url', url),
});
