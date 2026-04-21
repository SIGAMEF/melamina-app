// === STATE.JS v8 ===
const STATE = {
  thick: 18, planchaW: 2150, planchaH: 2440,
  modules: [],
  activeModuleId: null,
  // Piezas excluidas del despiece (por etiqueta única)
  // Formato: Set de strings "moduleId:pieceType" ej "3:lateral-izq"
  excludedPieces: new Set(),
  selectedItem: null,
  pieces: [], planchasNeeded: 0, areaTotal: 0,
};
let _idCounter = 1;
function nextId() { return _idCounter++; }
function cmToMm(cm) { return Math.round(cm * 10); }
function getActiveModule() {
  if (!STATE.modules.length) return null;
  return STATE.modules.find(m => m.id === STATE.activeModuleId) || STATE.modules[0];
}
function createModule(overrides) {
  return Object.assign({
    id: nextId(), type:'mueble-alto', mount:'libre',
    ancho:90, alto:200, prof:45,
    conFondo:true, conRail:false, numRails:1, conPatas:false,
    divisions:[], shelves:[],
    offsetX:0, offsetY:0,
    // exploded: si true, cada cara es seleccionable/eliminable individualmente
    exploded: false,
    // excludedFaces: Set de strings de caras excluidas dentro de este módulo
    excludedFaces: new Set(),
  }, overrides||{});
}
