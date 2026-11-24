'use strict';

(() => {
  const leftHand = new Set([
    'Escape', 'F1', 'F2', 'F3', 'F4', 'F5',
    'Backquote', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Tab',
    'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT',
    'CapsLock', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG',
    'ShiftLeft', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB',
    'ControlLeft', 'AltLeft', 'MetaLeft',
  ]);
  function handForCode(code) {
    return leftHand.has(code) ? 'Left' : 'Right';
  }

  if (typeof module === 'object' && module.exports) module.exports = {handForCode};
  else window.handForCode = handForCode;
})();
