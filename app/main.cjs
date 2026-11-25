'use strict';

const {
  app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, clipboard,
  screen, shell, systemPreferences, powerMonitor,
} = require('electron');
const path = require('node:path');
const {readFile} = require('node:fs/promises');
const {LocalStore} = require('./local-store.cjs');
const { TypingStats } = require('./typing-stats.cjs');
const { DesktopInput } = require('./platform/input.cjs');
const { OverlayInteraction, overlayBounds } = require('./platform/overlay-interaction.cjs');

const appId = 'local.typingdesktop.pet.open';
const appTitle = '超有爱桌宠社区版';
// Pin the profile before setting the localized window title.
if (!app.commandLine.hasSwitch('user-data-dir')) {
  app.setPath('userData', path.join(app.getPath('appData'), 'typing-desktop-pet-open'));
}
app.setName(appTitle);
const assetsDirectory = path.join(__dirname, 'assets');
const appIcon = path.join(assetsDirectory, 'app-icon.png');
const mac = process.platform === 'darwin';
const preload = path.join(__dirname, 'preload.cjs');
if (process.platform === 'win32') app.setAppUserModelId(appId);
let store;
let overlay;
let interaction;
let settings;
let tray;
let leaving = false;
let sleeping = false;
let overlayReady = false;
let startupWindow;
let startupFinished = false;

function finishStartup() {
  if (startupFinished) return;
  startupFinished = true;
  if (startupWindow && !startupWindow.isDestroyed()) startupWindow.destroy();

}

function showStartup() {
  if (startupFinished) return;
  const work = screen.getPrimaryDisplay().workArea;
  const width = 246, height = 84;
  const card = new BrowserWindow({width, height, x: work.x + work.width - width - 16,
    y: work.y + work.height - height - 16, title: appTitle + ' · 正在启动', show: false,
    frame: false, transparent: true, backgroundColor: '#00000000', resizable: false,
    skipTaskbar: true, focusable: false, alwaysOnTop: true, hasShadow: false,
    webPreferences: {sandbox: true, contextIsolation: true, nodeIntegration: false}});
  startupWindow = card;
  secureWindow(card);
  card.setIgnoreMouseEvents(true);
  card.once('ready-to-show', () => { if (!startupFinished) card.showInactive(); });
  card.loadFile(path.join(__dirname, 'startup', 'index.html')).catch(error => {
    if (!startupFinished) console.warn('Could not display loading card:', error.message);
  });
}
let recoveryTimer;
let lastRecovery = -Infinity;
let recoveryDelay = 200;
let inputStatus = 'paused';
let typingStats;
let typingStatsTimer;
let lastStatsMessage;

function post(window, channel, value) {
  if (window && !window.isDestroyed() && !window.webContents.isDestroyed() && !window.webContents.isCrashed()) {
    window.webContents.send(channel, value);
  }
}

const desktopInput = new DesktopInput(value => {
  if (overlayReady) post(overlay, 'overlay:input', value);
}, () => typingStats.record());

function publishTypingStats() {
  const {showTypingStats, showTypingSpeed, showTypingTotal, privacyMode} = store.state.settings;
  const showSpeed = showTypingStats && showTypingSpeed;
  const showTotal = showTypingStats && showTypingTotal;
  typingStats.setTracking(inputStatus === 'active' && !privacyMode && (showSpeed || showTotal));
  if (!overlayReady) return;
  const stats = {...typingStats.snapshot(), showSpeed, showTotal};
  const message = JSON.stringify(stats);
  if (message === lastStatsMessage) return;
  lastStatsMessage = message;
  post(overlay, 'overlay:typing-stats', stats);
}

function saveTypingStats() {
  try {
    typingStats?.flush(daily => store.saveTypingDaily(daily));
  } catch (error) {
    console.warn('Could not save daily typing count:', error.message);
  }
}

function settingsState() {
  return {settings: store.state.settings, inputStatus, warning: store.warning};
}

function overlayOptions() {
  const {sleepSeconds, leftHanded, privacyMode} = store.state.settings;
  return {sleepSeconds, leftHanded, privacyMode};
}

function syncHook() {
  desktopInput.setPrivacyMode(store.state.settings.privacyMode);
  const enabled = store.state.settings.inputEnabled && store.state.settings.visible && overlayReady && !sleeping;
  if (!enabled) {
    desktopInput.stop();
    inputStatus = 'paused';
  } else if (mac && !systemPreferences.isTrustedAccessibilityClient(false)) {
    desktopInput.stop();
    inputStatus = 'permission';
  } else {
    try {
      desktopInput.start();
      inputStatus = 'active';
    } catch (error) {
      console.warn('Global input is unavailable:', error.message);
      inputStatus = mac ? 'permission' : 'error';
    }
  }
  publishTypingStats();
  post(settings, 'settings:input-status', inputStatus);
}

function secureWindow(window) {
  window.setMenu(null);
  window.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
}

function placeOverlay() {
  if (!overlay || overlay.isDestroyed()) return;
  interaction.place(overlayBounds(screen, store.state.settings));
}

function showOverlayPreference() {
  if (!overlayReady || !overlay || overlay.isDestroyed()) return;
  if (store.state.settings.visible) {
    if (!overlay.isVisible()) overlay.showInactive();
    if (!sleeping) interaction.start();
  } else {
    interaction.stop();
    if (overlay.isVisible()) overlay.hide();
  }
}

function recoverOverlay() {
  if (leaving || recoveryTimer || !overlay || overlay.isDestroyed()) return;
  const now = performance.now();
  recoveryDelay = now - lastRecovery > 30000 ? 200 : Math.min(recoveryDelay * 2, 10000);
  lastRecovery = now;
  recoveryTimer = setTimeout(() => {
    recoveryTimer = undefined;
    if (leaving || !overlay || overlay.isDestroyed()) return;
    overlayReady = false;
    interaction.stop();
    interaction.setRegions([]);
    syncHook();
    overlay.loadFile(path.join(__dirname, 'overlay', 'index.html')).catch(error => {
      if (!leaving && error.code !== 'ERR_ABORTED') recoverOverlay();
    });
  }, recoveryDelay);
}

function createOverlay() {
  overlay = new BrowserWindow({
    ...overlayBounds(screen, store.state.settings),
    title: appTitle,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    skipTaskbar: true,
    focusable: false,
    alwaysOnTop: store.state.settings.alwaysOnTop,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    webPreferences: {preload, sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: true},
  });
  secureWindow(overlay);
  overlay.setIgnoreMouseEvents(true, {forward: true});
  interaction = new OverlayInteraction(overlay, screen, {
    send: (channel, value) => post(overlay, channel, value),
    input: sample => {
      if (store.state.settings.inputEnabled) post(overlay, 'overlay:input', sample);
    },
    save: (patch, options) => {
      try {
        mutate(() => store.patchSettings(patch), options);
      } catch (error) {
        placeOverlay();
        console.warn('Could not save pet position or size:', error.message);
      }
    },
  });
  interaction.setPinned(store.state.settings.alwaysOnTop);
  if (mac) overlay.setVisibleOnAllWorkspaces(true);
  overlay.on('closed', () => {
    interaction.stop();
    interaction = undefined;
    overlay = undefined;
    overlayReady = false;
    if (!leaving) syncHook();
  });
  overlay.webContents.on('render-process-gone', () => {
    if (leaving) return;
    overlayReady = false;
    interaction.stop();
    syncHook();
    recoverOverlay();
    refreshTray();
  });
  overlay.loadFile(path.join(__dirname, 'overlay', 'index.html')).catch(error => console.error(error));
}

function presentSettings() {
  if (!settings || settings.isDestroyed()) return;
  if (settings.isMinimized()) settings.restore();
  settings.show();
  settings.focus();
  if (mac && app.dock && !app.dock.isVisible()) {
    void app.dock.show().then(() => {
      if (settings && !settings.isDestroyed()) settings.focus();
      else app.dock.hide();
    });
  }
}

function showSettings() {
  if (settings && !settings.isDestroyed()) return presentSettings();
  settings = new BrowserWindow({
    title: appTitle + ' · 设置',
    width: 680,
    height: 720,
    minWidth: 470,
    minHeight: 540,
    show: false,
    skipTaskbar: false,
    autoHideMenuBar: true,
    backgroundColor: '#f8f7f3',
    icon: appIcon,
    webPreferences: {preload, sandbox: true, contextIsolation: true, nodeIntegration: false},
  });
  if (process.platform === 'win32') {
    const executable = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
    const devArgument = app.isPackaged ? '' : ' "' + app.getAppPath() + '"';
    settings.setAppDetails({
      appId, appIconPath: app.isPackaged ? executable : path.join(__dirname, '..', 'build', 'icon.ico'),
      relaunchCommand: '"' + executable + '"' + devArgument + ' --settings',
      relaunchDisplayName: appTitle + ' · 设置',
    });
  }
  secureWindow(settings);
  settings.once('ready-to-show', presentSettings);
  settings.on('focus', syncHook);
  settings.on('closed', () => {
    settings = undefined;
    if (mac) app.dock?.hide();
  });
  settings.loadFile(path.join(__dirname, 'settings', 'index.html')).catch(error => console.error(error));
}

function setEditing(enabled) {
  interaction?.setEditing(enabled);
  refreshTray();
}

function buildPetMenu() {
  const {visible, inputEnabled, privacyMode} = store.state.settings;
  return Menu.buildFromTemplate([
    {label: '桌宠设置…', click: showSettings},
    {type: 'separator'},
    {label: interaction?.editing ? '完成编辑' : '编辑位置与大小…', enabled: visible && overlayReady && !sleeping,
      click: () => setEditing(!interaction?.editing)},
    {label: '显示桌宠', type: 'checkbox', checked: visible, click: () => mutate(() => store.patchSettings({visible: !store.state.settings.visible}))},
    {label: '桌宠置顶', type: 'checkbox', checked: store.state.settings.alwaysOnTop,
      click: () => mutate(() => store.patchSettings({alwaysOnTop: !store.state.settings.alwaysOnTop}))},
    {label: '键鼠联动', type: 'checkbox', checked: inputEnabled, click: () => mutate(() => store.patchSettings({inputEnabled: !store.state.settings.inputEnabled}))},
    {label: '隐私模式', type: 'checkbox', checked: privacyMode, click: () => mutate(() => store.patchSettings({privacyMode: !store.state.settings.privacyMode}))},
    {type: 'separator'},
    {label: '退出' + appTitle, click: () => app.quit()},
  ]);
}

function refreshTray() {
  if (tray && !tray.isDestroyed()) tray.setContextMenu(buildPetMenu());
}

function mutate(change, {alreadyPlaced = false} = {}) {
  const previous = store.state;
  const result = change();
  const {settings: after} = store.state;
  const before = previous.settings;
  if (!alreadyPlaced && (before.size !== after.size || before.corner !== after.corner ||
      before.position?.x !== after.position?.x || before.position?.y !== after.position?.y)) {
    placeOverlay();
  }
  if (before.alwaysOnTop !== after.alwaysOnTop) interaction.setPinned(after.alwaysOnTop);
  if (before.visible !== after.visible) showOverlayPreference();
  if (before.visible !== after.visible || before.inputEnabled !== after.inputEnabled) syncHook();
  if (!before.inputEnabled && after.inputEnabled) interaction?.refreshPointer();
  if (before.privacyMode !== after.privacyMode) desktopInput.setPrivacyMode(after.privacyMode);
  publishTypingStats();
  if (before.sleepSeconds !== after.sleepSeconds || before.leftHanded !== after.leftHanded ||
      before.privacyMode !== after.privacyMode) {
    post(overlay, 'overlay:options', overlayOptions());
  }
  refreshTray();
  const state = settingsState();
  post(settings, 'settings:state', state);
  return {state, result};
}

function registerIpc() {
  const guard = (window, handler) => (event, ...args) => {
    if (!window() || window().webContents !== event.sender || event.senderFrame !== event.sender.mainFrame) {
      return; // Discard messages in flight from a replaced renderer.
    }
    return handler(...args);
  };
  const settingsHandler = (name, handler) => ipcMain.handle(name, guard(() => settings, handler));
  settingsHandler('settings:get', settingsState);
  settingsHandler('settings:copy-qq-group', () => clipboard.writeText('302953758'));
  settingsHandler('settings:website', () => shell.openExternal('https://pet.dycya.com/'));
  settingsHandler('settings:update', patch => mutate(() => store.patchSettings(patch)));
  settingsHandler('settings:permission', () => {
    if (mac && !systemPreferences.isTrustedAccessibilityClient(true)) {
      void shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
    }
    syncHook();
    return inputStatus;
  });
  ipcMain.handle('overlay:desk-models', guard(() => overlay, () => Promise.all(
    ['keyboard.glb', 'mouse.glb'].map(file => readFile(path.join(assetsDirectory, file)))
  )));
  ipcMain.handle('overlay:get-options', guard(() => overlay, overlayOptions));
  ipcMain.on('overlay:recover', guard(() => overlay, recoverOverlay));
  ipcMain.on('overlay:ready', guard(() => overlay, () => {
    overlayReady = true;
    lastStatsMessage = undefined;
    showOverlayPreference();
    finishStartup();
    syncHook();
    refreshTray();
  }));
  ipcMain.on('overlay:problem', guard(() => overlay, message => {
    console.warn('Desktop scene:', String(message).slice(0, 400));
  }));
  ipcMain.on('overlay:regions', guard(() => overlay, regions => interaction.setRegions(regions)));
  ipcMain.on('overlay:begin-gesture', guard(() => overlay, kind => interaction.begin(kind)));
  ipcMain.on('overlay:end-gesture', guard(() => overlay, commit => interaction.end(commit === true)));
  ipcMain.on('overlay:step-size', guard(() => overlay, delta => interaction.stepSize(delta)));
  ipcMain.on('overlay:finish-resize', guard(() => overlay, () => setEditing(false)));
  ipcMain.on('overlay:menu', guard(() => overlay, () => {
    const owner = interaction;
    if (!owner?.timer || owner.menuOpen || owner.gesture) return;
    owner.setMenuOpen(true);
    buildPetMenu().popup({window: overlay, callback: () => owner.setMenuOpen(false)});
  }));
}

if (!app.requestSingleInstanceLock()) {
  finishStartup();
  app.quit();
} else {
  app.on('second-instance', showSettings);
  app.on('window-all-closed', () => {});
  app.on('before-quit', () => {
    leaving = true;
    finishStartup();
    clearTimeout(recoveryTimer);
    interaction?.stop();
    desktopInput.stop();
    clearInterval(typingStatsTimer);
    saveTypingStats();
    tray?.destroy();
  });

  app.whenReady().then(() => {
    showStartup();
    if (mac && app.dock) {
      app.dock.setIcon(appIcon);
      app.dock.hide();
      app.on('activate', () => { if (settings) presentSettings(); });
    }
    Menu.setApplicationMenu(null);
    const dir = app.getPath('userData');
    store = new LocalStore(dir);
    typingStats = new TypingStats(store.state.typingDaily);
    typingStatsTimer = setInterval(() => {
      publishTypingStats();
      saveTypingStats();
    }, 1000);
    registerIpc();
    createOverlay();
    const icon = nativeImage.createFromPath(path.join(assetsDirectory, mac ? 'trayTemplate.png' : 'tray.png'));
    if (mac) icon.setTemplateImage(true);
    tray = new Tray(icon);
    tray.setToolTip(appTitle);
    refreshTray();
    if (!mac) tray.on('double-click', showSettings);
    for (const event of ['display-added', 'display-removed', 'display-metrics-changed']) screen.on(event, () => {
      placeOverlay();
    });
    for (const event of ['suspend', 'lock-screen']) powerMonitor.on(event, () => {
      sleeping = true;
      interaction?.stop();
      syncHook();
      refreshTray();
    });
    for (const event of ['resume', 'unlock-screen']) powerMonitor.on(event, () => {
      sleeping = false;
      showOverlayPreference();
      syncHook();
      refreshTray();
    });
    if (process.argv.includes('--settings')) showSettings();
  }).catch(error => {
    console.error(error);
    app.quit();
  });
}
