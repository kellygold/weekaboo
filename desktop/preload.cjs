const { contextBridge, ipcRenderer } = require('electron');
// Return a plain envelope: contextBridge does not preserve custom Error properties.
const invoke = (method, input) => ipcRenderer.invoke('weekaboo:operation', method, input);
const names = ['readTasks', 'writeTasks', 'readDocument', 'writeDocument', 'vaultGet', 'vaultPut', 'vaultRemove', 'request', 'pickFile', 'saveFile', 'authSetup', 'authAcquire', 'authForget', 'authCancel'];
contextBridge.exposeInMainWorld('weekabooNative', {
  ...Object.fromEntries(names.map(name => [name, input => invoke(name, input)])),
  onActivity(listener) {
    const receive = (_event, active) => listener(Boolean(active));
    ipcRenderer.on('weekaboo:activity', receive);
    return () => ipcRenderer.removeListener('weekaboo:activity', receive);
  },
});
