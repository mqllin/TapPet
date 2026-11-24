'use strict';

const {handForCode} = require('../keyboard-hands.js');
const {isCharacterPress} = require('../typing-stats.cjs');

const modifiers = {
  Ctrl: 'ControlLeft', CtrlRight: 'ControlRight',
  Alt: 'AltLeft', AltRight: 'AltRight',
  Shift: 'ShiftLeft', Meta: 'MetaLeft',
};

class DesktopInput {
  constructor(send, characterPressed) {
    this.send = send;
    this.characterPressed = characterPressed;
    this.running = false;
    this.keys = new Set();
    this.buttons = new Set();
    this.listeners = [];
    this.privacyMode = false;
    this.wheelTimer = undefined;
  }

  start() {
    if (this.running) return;
    const {uIOhook, UiohookKey} = require('uiohook-napi');
    const codes = new Map(Object.entries(UiohookKey).map(([name, code]) => [
      code, modifiers[name] ?? (/^[A-Z]$/.test(name) ? 'Key' + name : /^\d$/.test(name) ? 'Digit' + name : name),
    ]));
    const names = {1: 'left', 2: 'right', 3: 'middle'};
    const sendState = () => {
      const buttons = [...this.buttons];
      if (this.privacyMode) this.send({buttons});
      else this.send({keys: [...this.keys], buttons});
    };
    const change = (held, name, down) => {
      if (!name || held.has(name) === down) return;
      if (down) held.add(name);
      else held.delete(name);
      sendState();
    };
    const wheel = () => {
      if (this.wheelTimer) return;
      this.wheelTimer = setTimeout(() => {
        this.wheelTimer = undefined;
        this.send({move: true});
      }, 28);
    };
    this.listeners = [
      ['keydown', event => {
        const code = codes.get(event.keycode);
        if (!this.privacyMode && isCharacterPress(code, event)) this.characterPressed?.();
        if (!code) this.send({activity: true});
        else if (this.privacyMode) this.send({tap: handForCode(code)});
        else if (this.keys.has(code)) this.send({keyRepeat: code});
        else change(this.keys, code, true);
      }],
      ['keyup', ({keycode}) => {
        if (this.privacyMode || !codes.has(keycode)) this.send({activity: true});
        else change(this.keys, codes.get(keycode), false);
      }],
      ['mousedown', ({button}) => change(this.buttons, names[button], true)],
      ['mouseup', ({button}) => change(this.buttons, names[button], false)],
      ['wheel', wheel],
    ];
    this.hook = uIOhook;
    for (const [event, listener] of this.listeners) this.hook.on(event, listener);
    try {
      this.hook.start();
      this.running = true;
    } catch (error) {
      this.removeListeners();
      throw error;
    }
  }

  setPrivacyMode(enabled) {
    if (this.privacyMode === enabled) return;
    this.privacyMode = enabled;
    this.keys.clear();
    this.buttons.clear();
    this.send({reset: true});
  }

  removeListeners() {
    for (const [event, listener] of this.listeners) this.hook.removeListener(event, listener);
    this.listeners = [];
  }

  stop() {
    if (this.running) {
      this.removeListeners();
      this.running = false;
      try {
        this.hook.stop();
      } catch (error) {
        console.warn('Could not stop desktop input:', error.message);
      }
    }
    this.keys.clear();
    this.buttons.clear();
    clearTimeout(this.wheelTimer);
    this.wheelTimer = undefined;
    this.send({reset: true});
  }
}

module.exports = { DesktopInput };
