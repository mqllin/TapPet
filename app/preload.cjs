'use strict';

const {contextBridge, ipcRenderer} = require('electron');

function subscribe(channel, listener) {
  const forward = (_event, value) => listener(value);
  ipcRenderer.on(channel, forward);
  return () => ipcRenderer.removeListener(channel, forward);
}

contextBridge.exposeInMainWorld('desktopPet', {
  getState: () => ipcRenderer.invoke('settings:get'),
  copyQqGroup: () => ipcRenderer.invoke('settings:copy-qq-group'),
  openWebsite: () => ipcRenderer.invoke('settings:website'),
  updateSettings: patch => ipcRenderer.invoke('settings:update', patch),
  requestPermission: () => ipcRenderer.invoke('settings:permission'),
  onState: listener => subscribe('settings:state', listener),
  onInputStatus: listener => subscribe('settings:input-status', listener),
  getDeskModels: () => ipcRenderer.invoke('overlay:desk-models'),
  getOverlayOptions: () => ipcRenderer.invoke('overlay:get-options'),
  onOverlayOptions: listener => subscribe('overlay:options', listener),
  onDesktopInput: listener => subscribe('overlay:input', listener),
  onTypingStats: listener => subscribe('overlay:typing-stats', listener),
  recoverOverlay: () => ipcRenderer.send('overlay:recover'),
  overlayReady: () => ipcRenderer.send('overlay:ready'),
  publishOverlayRegions: regions => ipcRenderer.send('overlay:regions', regions),
  beginOverlayGesture: kind => ipcRenderer.send('overlay:begin-gesture', kind),
  endOverlayGesture: commit => ipcRenderer.send('overlay:end-gesture', commit),
  openOverlayMenu: () => ipcRenderer.send('overlay:menu'),
  stepOverlaySize: delta => ipcRenderer.send('overlay:step-size', delta),
  finishOverlayResize: () => ipcRenderer.send('overlay:finish-resize'),
  onOverlayCancel: listener => subscribe('overlay:cancel-gesture', listener),
  onPetHover: listener => subscribe('overlay:pet-hover', listener),
  onOverlayResize: listener => subscribe('overlay:resize-mode', listener),
  reportProblem: message => ipcRenderer.send('overlay:problem', message),
});
