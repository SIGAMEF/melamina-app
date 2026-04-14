// === STATE.JS v5 ===
const STATE = {
  type: 'mueble-alto', mount: 'libre',
  thick: 18, planchaW: 2150, planchaH: 2440,
  ancho: 90, alto: 200, prof: 45,
  conFondo: true, conRail: false, numRails: 1, conPatas: false,
  divisions: [],  // [{id, pos, startFrac, endFrac}]  pos=cm desde izq
  shelves:   [],  // [{id, pos, startFrac, endFrac}]  pos=cm desde suelo
  selectedItem: null,
  pieces: [], planchasNeeded: 0, areaTotal: 0,
};
let _idCounter = 1;
function nextId() { return _idCounter++; }
function cmToMm(cm) { return Math.round(cm * 10); }
