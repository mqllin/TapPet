'use strict';
(() => {
const ROWS = [
  [['Backquote',1,'`'],['Digit1',1,'1'],['Digit2',1,'2'],['Digit3',1,'3'],['Digit4',1,'4'],['Digit5',1,'5'],['Digit6',1,'6'],['Digit7',1,'7'],['Digit8',1,'8'],['Digit9',1,'9'],['Digit0',1,'0'],['Minus',1,'-'],['Equal',1,'='],['Backspace',2,'⌫']],
  [['Tab',1.5,'⇥'],['KeyQ',1,'Q'],['KeyW',1,'W'],['KeyE',1,'E'],['KeyR',1,'R'],['KeyT',1,'T'],['KeyY',1,'Y'],['KeyU',1,'U'],['KeyI',1,'I'],['KeyO',1,'O'],['KeyP',1,'P'],['BracketLeft',1,'['],['BracketRight',1,']'],['Backslash',1.5,'\\']],
  [['CapsLock',1.75,'⇪'],['KeyA',1,'A'],['KeyS',1,'S'],['KeyD',1,'D'],['KeyF',1,'F'],['KeyG',1,'G'],['KeyH',1,'H'],['KeyJ',1,'J'],['KeyK',1,'K'],['KeyL',1,'L'],['Semicolon',1,';'],['Quote',1,"'"],['Enter',2.25,'⏎']],
  [['ShiftLeft',2.25,'⇧'],['KeyZ',1,'Z'],['KeyX',1,'X'],['KeyC',1,'C'],['KeyV',1,'V'],['KeyB',1,'B'],['KeyN',1,'N'],['KeyM',1,'M'],['Comma',1,','],['Period',1,'.'],['Slash',1,'/'],['ShiftRight',2.75,'⇧']],
  [['ControlLeft',1.25,'⌃'],['AltLeft',1.25,'⌥'],['MetaLeft',1.25,'⌘'],['Space',7.5,'space'],['MetaRight',1.25,'⌘'],['AltRight',1.25,'⌥'],['ControlRight',1.25,'⌃']]
];
if (typeof module === 'object' && module.exports) module.exports = ROWS;
else window.petKeyboardRows = ROWS;
})();
