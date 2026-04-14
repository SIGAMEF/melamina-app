// === WIZARD.JS ===

let currentStep = 1;
const totalSteps = 4;

function selectShape(btn) {
  document.querySelectorAll('.shape-card').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  STATE.type = btn.dataset.type;
}

function selectMount(btn) {
  document.querySelectorAll('[data-mount]').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  STATE.mount = btn.dataset.mount;
  const info = document.getElementById('anclaje-info');
  if (STATE.mount === 'anclaje') {
    info.style.display = 'block';
    STATE.conFondo = false;
    STATE.conRail = true;
  } else {
    info.style.display = 'none';
    STATE.conFondo = true;
    STATE.conRail = false;
  }
}

function selectThick(btn) {
  document.querySelectorAll('[data-thick]').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  STATE.thick = parseInt(btn.dataset.thick);
}

function selectPlancha(btn) {
  document.querySelectorAll('.plancha-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  STATE.planchaW = parseInt(btn.dataset.pw);
  STATE.planchaH = parseInt(btn.dataset.ph);
}

function updatePreview() {
  const a = parseFloat(document.getElementById('dim-ancho').value) || 90;
  const h = parseFloat(document.getElementById('dim-alto').value) || 200;
  const p = parseFloat(document.getElementById('dim-prof').value) || 45;
  STATE.ancho = a;
  STATE.alto = h;
  STATE.prof = p;
  drawPreview(a, h, p);
}

function drawPreview(a, h, p) {
  const canvas = document.getElementById('preview-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const pad = 28;
  const iso = 0.45;
  const scale = Math.min((W - pad*2 - 30) / a, (H - pad*2 - 30) / h);
  const fw = a * scale;
  const fh = h * scale;
  const fd = p * scale * iso;

  const ox = (W - fw - fd) / 2;
  const oy = (H - fh - fd) / 2 + fd;

  ctx.strokeStyle = '#d4a843';
  ctx.lineWidth = 1.5;
  ctx.fillStyle = 'rgba(212,168,67,0.07)';

  // Front face
  ctx.beginPath();
  ctx.rect(ox, oy, fw, -fh);
  ctx.fill();
  ctx.stroke();

  // Top face
  ctx.beginPath();
  ctx.moveTo(ox, oy - fh);
  ctx.lineTo(ox + fd, oy - fh - fd * 0.5);
  ctx.lineTo(ox + fw + fd, oy - fh - fd * 0.5);
  ctx.lineTo(ox + fw, oy - fh);
  ctx.closePath();
  ctx.fillStyle = 'rgba(212,168,67,0.12)';
  ctx.fill();
  ctx.stroke();

  // Right face
  ctx.beginPath();
  ctx.moveTo(ox + fw, oy);
  ctx.lineTo(ox + fw + fd, oy - fd * 0.5);
  ctx.lineTo(ox + fw + fd, oy - fh - fd * 0.5);
  ctx.lineTo(ox + fw, oy - fh);
  ctx.closePath();
  ctx.fillStyle = 'rgba(212,168,67,0.09)';
  ctx.fill();
  ctx.stroke();

  // Labels
  ctx.fillStyle = '#9a9a96';
  ctx.font = '10px Space Grotesk, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${a} cm`, ox + fw/2, oy + 16);
  ctx.save();
  ctx.translate(ox - 12, oy - fh/2);
  ctx.rotate(-Math.PI/2);
  ctx.fillText(`${h} cm`, 0, 0);
  ctx.restore();
  ctx.fillText(`${p}`, ox + fw + fd/2 + 14, oy - fd/4 - fh/2 - 4);
}

function wizardNext() {
  if (currentStep === 1 && !document.querySelector('.shape-card.selected')) {
    document.querySelector('.shape-card').click();
  }

  if (currentStep < totalSteps) {
    goToStep(currentStep + 1);
  } else {
    finishWizard();
  }
}

function wizardBack() {
  if (currentStep > 1) goToStep(currentStep - 1);
}

function goToStep(step) {
  document.querySelector(`.wizard-step[data-step="${currentStep}"]`).classList.remove('active');
  document.querySelector(`.wizard-step[data-step="${step}"]`).classList.add('active');
  currentStep = step;

  document.getElementById('btn-back').style.visibility = step > 1 ? 'visible' : 'hidden';
  document.getElementById('btn-next').textContent = step === totalSteps ? 'Empezar a diseñar →' : 'Siguiente →';

  // Update dots
  document.querySelectorAll('.dot').forEach((d, i) => {
    d.classList.toggle('active', i === step - 1);
  });

  if (step === 3) {
    setTimeout(() => updatePreview(), 50);
  }
}

function finishWizard() {
  // Transfer wizard values to state
  STATE.ancho = parseFloat(document.getElementById('dim-ancho').value) || 90;
  STATE.alto = parseFloat(document.getElementById('dim-alto').value) || 200;
  STATE.prof = parseFloat(document.getElementById('dim-prof').value) || 45;

  // Hide wizard, show app
  document.getElementById('wizard').style.display = 'none';
  const app = document.getElementById('app');
  app.classList.remove('app-hidden');
  app.classList.add('app-visible');

  // Initialize app
  initApp();
}

function nuevoMueble() {
  // Reset state
  STATE.divisions = [];
  STATE.shelves = [];
  _idCounter = 1;

  document.getElementById('wizard').style.display = 'flex';
  const app = document.getElementById('app');
  app.classList.add('app-hidden');
  app.classList.remove('app-visible');
  currentStep = 1;
  goToStep(1);
}
