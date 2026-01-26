const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const hiddenInput = document.getElementById("hiddenInput");
const uiContainer = document.getElementById("ui-container");
const whiteboardBtn = document.getElementById("whiteboardBtn");
const textModeToggle = document.getElementById("textModeToggle");

let isDrawingMode = false;
let isWhiteboardMode = false;
let isSentenceMode = false;
let isEraserMode = false;
let drawing = false;
let pendingText = null;
let mx = 0, my = 0;
let config = { lineLife: 2.5, textLife: 3.0 };

// Sentence Mode Cursor
let textCursor = { x: 50, y: 100 };
const lineHeight = 50;

const allTexts = [];
const allLines = [];
const particles = [];
let currentLine = null;

let lastSparkleTime = 0;
const SPARKLE_INTERVAL = 30; // ms

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.onresize = resize;
resize();

// Settings & Styles
const panel = document.getElementById("settingsPanel");
const panelColorPicker = document.getElementById("panelColorPicker");
const panelOpacitySlider = document.getElementById("panelOpacitySlider");
const opacityVal = document.getElementById("opacityVal");
const lineLifeSlider = document.getElementById("lineLifeSlider");
const textLifeSlider = document.getElementById("textLifeSlider");
const lineLifeVal = document.getElementById("lineLifeVal");
const textLifeVal = document.getElementById("textLifeVal");

let panelColorHex = "#141414";
let panelOpacity = 0.85;

function updatePanelStyle() {
  let r = 20, g = 20, b = 20;
  if (panelColorHex.length === 7) {
    r = parseInt(panelColorHex.slice(1, 3), 16);
    g = parseInt(panelColorHex.slice(3, 5), 16);
    b = parseInt(panelColorHex.slice(5, 7), 16);
  }
  panel.style.background = `rgba(${r}, ${g}, ${b}, ${panelOpacity})`;
  panel.style.borderColor = `rgba(255, 255, 255, 0.1)`;
  if (isWhiteboardMode) {
    canvas.style.backgroundColor = panelColorHex;
  }
}

function saveSettings() {
  const settings = {
    panelColorHex,
    panelOpacity,
    lineLife: config.lineLife,
    textLife: config.textLife
  };
  localStorage.setItem("appSettings", JSON.stringify(settings));
}

function loadSettings() {
  const saved = localStorage.getItem("appSettings");
  if (saved) {
    try {
      const s = JSON.parse(saved);
      if (s.panelColorHex) panelColorHex = s.panelColorHex;
      if (s.panelOpacity) panelOpacity = parseFloat(s.panelOpacity) || 0.85;
      if (s.lineLife) config.lineLife = parseFloat(s.lineLife) || 2.5;
      if (s.textLife) config.textLife = parseFloat(s.textLife) || 3.0;
    } catch (e) { }
  }
}

// Effects
function spawnSparkle(x, y, overrideCount) {
  const count = overrideCount || 40;
  for (let i = 0; i < count; i++) {
    const hue = Math.floor(Math.random() * 360);
    particles.push({
      x: x, y: y,
      vx: (Math.random() - 0.5) * 10,
      vy: (Math.random() - 0.5) * 10,
      life: 1.0,
      color: `hsl(${hue}, 100%, 75%)`
    });
  }
}

function spawnFloatingText(text, x, y) {
  if (!text) return;
  const el = document.createElement("div");
  el.classList.add("floating-text");
  el.innerText = text;
  let currentHue = Math.floor(Math.random() * 360);
  el.style.color = `hsl(${currentHue}, 100%, 75%)`;
  el.style.left = x + "px";
  el.style.top = (y - 20) + "px";
  document.body.appendChild(el);

  const createdAt = Date.now();
  let floatY = 0;

  function animate() {
    if (!el.parentNode) return;
    const lifeMs = parseFloat(config.textLife) * 1000;
    const safeLifeMs = isNaN(lifeMs) ? 3000 : lifeMs;
    const progress = (Date.now() - createdAt) / safeLifeMs;

    if (!isWhiteboardMode && progress >= 1) {
      el.remove(); return;
    }

    let opacity = 1;
    if (!isWhiteboardMode && progress > 0.7) opacity = 1 - (progress - 0.7) / 0.3;

    if (!isWhiteboardMode && !isSentenceMode) {
      floatY -= 0.5;
    }

    el.style.opacity = opacity;
    el.style.transform = `translateY(${floatY}px)`;
    currentHue = (currentHue + 3) % 360;
    el.style.color = `hsla(${currentHue}, 100%, 75%, ${opacity})`;
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}

// Loop
function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const now = Date.now();

  for (let i = allLines.length - 1; i >= 0; i--) {
    const l = allLines[i];
    const progress = (now - l.createdAt) / (parseFloat(config.lineLife) * 1000 || 2500);
    let alpha = 1;
    if (!isWhiteboardMode) {
      if (progress >= 1) { allLines.splice(i, 1); continue; }
      if (progress > 0.7) alpha = 1 - (progress - 0.7) / 0.3;
    }
    ctx.strokeStyle = `hsla(${l.hue}, 100%, 60%, ${alpha})`;
    ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.beginPath();
    l.points.forEach((p, idx) => idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();
  }

  if (currentLine) {
    ctx.strokeStyle = `hsl(${currentLine.hue}, 100%, 60%)`;
    ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.beginPath();
    currentLine.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();
  }

  ctx.font = "bold 40px sans-serif"; ctx.textAlign = "center";
  for (let i = allTexts.length - 1; i >= 0; i--) {
    const t = allTexts[i];
    const progress = (now - t.createdAt) / (parseFloat(config.textLife) * 1000 || 3000);
    let a = 1;
    if (!isWhiteboardMode) {
      if (progress >= 1) { allTexts.splice(i, 1); continue; }
      if (progress > 0.7) a = 1 - (progress - 0.7) / 0.3;
    }
    t.hue = (t.hue + 2) % 360;
    ctx.fillStyle = `hsla(${t.hue}, 100%, 60%, ${a})`;
    const offsetY = isWhiteboardMode ? 0 : (progress * 100);
    ctx.fillText(t.text, t.x, t.y - offsetY);
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.life -= 0.03;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.x += p.vx; p.y += p.vy;
    ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.beginPath();
    ctx.arc(p.x, p.y, 0.25 + Math.random() * 2, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1.0;
  }
  requestAnimationFrame(loop);
}
loop();

function eraseAt(x, y) {
  const radius = 30;
  for (let i = allTexts.length - 1; i >= 0; i--) {
    const t = allTexts[i];
    if (Math.hypot(t.x - x, t.y - y) < radius) allTexts.splice(i, 1);
  }
  document.querySelectorAll(".floating-text").forEach(el => {
    const r = el.getBoundingClientRect();
    if (Math.hypot((r.left + r.width / 2) - x, (r.top + r.height / 2) - y) < radius) el.remove();
  });
  for (let i = allLines.length - 1; i >= 0; i--) {
    const l = allLines[i];
    let newStrokes = [], currentPoints = [];
    l.points.forEach(p => {
      if (Math.hypot(p.x - x, p.y - y) < radius) {
        if (currentPoints.length > 0) { newStrokes.push({ ...l, points: currentPoints }); currentPoints = []; }
      } else { currentPoints.push(p); }
    });
    if (currentPoints.length > 0) newStrokes.push({ ...l, points: currentPoints });
    if (newStrokes.length !== 1 || newStrokes[0].points.length !== l.points.length) allLines.splice(i, 1, ...newStrokes);
  }
}

// Init
window.addEventListener("DOMContentLoaded", () => {
  loadSettings();
  updatePanelStyle();

  panelColorPicker.value = panelColorHex;
  panelOpacitySlider.value = panelOpacity;
  opacityVal.innerText = panelOpacity;
  lineLifeSlider.value = config.lineLife;
  lineLifeVal.innerText = config.lineLife + "s";
  textLifeSlider.value = config.textLife;
  textLifeVal.innerText = config.textLife + "s";

  document.getElementById("clearBtn").onclick = (e) => {
    e.preventDefault(); e.stopPropagation();
    allLines.length = 0; allTexts.length = 0; particles.length = 0;
    document.querySelectorAll(".floating-text").forEach(el => el.remove());
  };

  const penBtn = document.getElementById("penBtn");
  const eraserBtn = document.getElementById("eraserBtn");
  const msgMenuBtn = document.getElementById("msgMenuBtn");

  penBtn.onclick = (e) => {
    e.stopPropagation(); isEraserMode = false;
    pendingText = null; // Clear stamp when picking pen
    penBtn.classList.add("active");
    eraserBtn.classList.remove("active");
    msgMenuBtn.classList.remove("active");
    document.querySelectorAll(".msg-item").forEach(i => i.classList.remove("selected"));
  };

  eraserBtn.onclick = (e) => {
    e.stopPropagation(); isEraserMode = true;
    pendingText = null; // Clear stamp when picking eraser
    eraserBtn.classList.add("active");
    penBtn.classList.remove("active");
    msgMenuBtn.classList.remove("active");
    document.querySelectorAll(".msg-item").forEach(i => i.classList.remove("selected"));
  };

  const minimizeBtn = document.getElementById("minimizeBtn");
  minimizeBtn.onclick = (e) => {
    e.stopPropagation(); panel.classList.toggle("minimized");
    minimizeBtn.innerText = panel.classList.contains("minimized") ? "＋" : "－";
  };

  if (whiteboardBtn) {
    whiteboardBtn.onclick = () => {
      isWhiteboardMode = !isWhiteboardMode;
      const lifeSettings = document.getElementById("lifeSettingsArea");
      whiteboardBtn.classList.toggle("active", isWhiteboardMode);
      if (isWhiteboardMode) {
        whiteboardBtn.innerText = "Whiteboard End";
        canvas.classList.add("whiteboard-active");
        canvas.style.backgroundColor = panelColorHex; canvas.style.opacity = 1;
        if (lifeSettings) lifeSettings.style.display = "none";
        isSentenceMode = true; textModeToggle.checked = true;
      } else {
        whiteboardBtn.innerText = "Whiteboard Start";
        canvas.classList.remove("whiteboard-active");
        canvas.style.backgroundColor = "transparent"; canvas.style.opacity = "";
        if (lifeSettings) lifeSettings.style.display = "block";
      }
    };
  }

  textModeToggle.onchange = (e) => { isSentenceMode = e.target.checked; };

  window.addEventListener("keydown", (e) => {
    if (isSentenceMode && e.key === "Enter") { textCursor.y += lineHeight; textCursor.x = 50; }
  });

  lineLifeSlider.oninput = (e) => { config.lineLife = e.target.value; lineLifeVal.innerText = e.target.value + "s"; saveSettings(); };
  textLifeSlider.oninput = (e) => { config.textLife = e.target.value; textLifeVal.innerText = e.target.value + "s"; saveSettings(); };
  panelColorPicker.oninput = (e) => { panelColorHex = e.target.value; updatePanelStyle(); saveSettings(); };
  panelOpacitySlider.oninput = (e) => { panelOpacity = parseFloat(e.target.value); opacityVal.innerText = panelOpacity; updatePanelStyle(); saveSettings(); };

  if (window.electronAPI) {
    window.electronAPI.onModeChange((mode) => {
      isDrawingMode = mode === "drawing";
      uiContainer.classList.toggle("hidden", !isDrawingMode);
      document.body.classList.toggle("drawing-mode", isDrawingMode);
      if (isDrawingMode) setTimeout(() => hiddenInput.focus(), 100);
    });
    window.electronAPI.onSpawnSpark((pos) => {
      if (isDrawingMode) return;
      const now = Date.now();
      if (now - lastSparkleTime > SPARKLE_INTERVAL) { spawnSparkle(pos.x, pos.y); lastSparkleTime = now; }
      mx = pos.x; my = pos.y;
    });
  }

  // Message Logic
  let messages = ["了解です", "ありがとうございます", "確認お願いします"];
  const savedMsg = localStorage.getItem("appMessages");
  if (savedMsg) { try { messages = JSON.parse(savedMsg); } catch (e) { } }

  function renderMessages() {
    const listContainer = document.getElementById("msgItemsContainer");
    const editContainer = document.getElementById("msgEditContainer");
    listContainer.innerHTML = ""; editContainer.innerHTML = "";
    messages.forEach((text) => {
      const item = document.createElement("div"); item.className = "msg-item";
      if (pendingText === text) item.classList.add("selected");
      item.innerText = text;
      item.onmousedown = (e) => {
        e.preventDefault(); e.stopPropagation();
        if (pendingText === text) {
          pendingText = null;
          item.classList.remove("selected");
          msgMenuBtn.classList.remove("active");
          // Re-activate Pen if everything else is off? 
          // For now just clear.
        } else {
          document.querySelectorAll(".msg-item").forEach(i => i.classList.remove("selected"));
          pendingText = text;
          item.classList.add("selected");
          msgMenuBtn.classList.add("active");
          // Selecting a stamp overrides current tool visuals
          penBtn.classList.remove("active");
          eraserBtn.classList.remove("active");
          isEraserMode = false;
        }
        document.getElementById("msgListArea").classList.remove("msg-list-show"); hiddenInput.focus();
      };
      listContainer.appendChild(item);
      const input = document.createElement("input"); input.type = "text"; input.className = "msg-input"; input.value = text;
      editContainer.appendChild(input);
    });
    const saveBtn = document.createElement("button"); saveBtn.innerText = "Save Changes";
    saveBtn.style.cssText = "background: #28a745; margin-top: 10px;";
    saveBtn.onclick = () => {
      messages = Array.from(editContainer.querySelectorAll(".msg-input")).map(i => i.value).filter(v => v.trim() !== "");
      localStorage.setItem("appMessages", JSON.stringify(messages));
      document.getElementById("msgEditContainer").style.display = "none";
      document.getElementById("msgItemsContainer").style.display = "block";
      document.getElementById("editMsgBtn").innerText = "Edit List";
      renderMessages();
    };
    editContainer.appendChild(saveBtn);
  }
  renderMessages();

  document.getElementById("editMsgBtn").onclick = (e) => {
    e.stopPropagation();
    if (document.getElementById("msgEditContainer").style.display === "block") {
      document.getElementById("msgEditContainer").style.display = "none"; document.getElementById("msgItemsContainer").style.display = "block";
      document.getElementById("editMsgBtn").innerText = "Edit List";
    } else {
      document.getElementById("msgEditContainer").style.display = "block"; document.getElementById("msgItemsContainer").style.display = "none";
      document.getElementById("editMsgBtn").innerText = "Back";
    }
  };

  document.getElementById("msgMenuBtn").onclick = (e) => {
    e.stopPropagation(); const area = document.getElementById("msgListArea"); area.classList.toggle("msg-list-show");
    if (!area.classList.contains("msg-list-show")) {
      document.getElementById("msgEditContainer").style.display = "none"; document.getElementById("msgItemsContainer").style.display = "block";
      document.getElementById("editMsgBtn").innerText = "Edit List";
    }
  };
  document.getElementById("optionToggle").onclick = () => document.getElementById("optionContent").classList.toggle("option-content-show");
});

window.addEventListener("mousemove", (e) => {
  mx = e.clientX; my = e.clientY;
  if (isDrawingMode) { hiddenInput.style.left = mx + "px"; hiddenInput.style.top = my + "px"; }
  if (drawing) {
    if (isEraserMode) eraseAt(mx, my);
    else if (currentLine) currentLine.points.push({ x: mx, y: my });
  }
});

let isComposing = false;

hiddenInput.addEventListener("compositionstart", () => {
  isComposing = true;
});

hiddenInput.addEventListener("compositionend", (e) => {
  isComposing = false;
  if (!isDrawingMode) return;

  // Use e.data or fall back to input value (some IME setups vary)
  const val = e.data || hiddenInput.value;
  if (val) {
    processNewText(val);
  }
  hiddenInput.value = "";
});

hiddenInput.addEventListener("input", (e) => {
  if (!isDrawingMode) return;

  // Only process if NOT currently composing Japanese
  // e.isComposing is standard; checking our flag too for safety
  if (e.isComposing || isComposing) return;

  const val = hiddenInput.value;
  if (val) {
    processNewText(val);
    hiddenInput.value = "";
  }
});

function processNewText(val) {
  let spawnX = mx, spawnY = my;
  if (isSentenceMode) {
    spawnX = textCursor.x; spawnY = textCursor.y;
    allTexts.push({ text: val, x: spawnX, y: spawnY, hue: Math.floor(Math.random() * 360), createdAt: Date.now() });
    textCursor.x += (val.length * 25);
    if (textCursor.x > window.innerWidth - 50) { textCursor.x = 50; textCursor.y += lineHeight; }
  } else { spawnFloatingText(val, spawnX, spawnY); }
}

window.addEventListener("mousedown", (e) => {
  if (!isDrawingMode || e.target.closest(".panel")) return;
  if (isSentenceMode) { textCursor.x = e.clientX; textCursor.y = e.clientY; }
  spawnSparkle(e.clientX, e.clientY);
  if (isEraserMode) { drawing = true; eraseAt(e.clientX, e.clientY); return; }
  if (pendingText) { processNewText(pendingText); }
  else {
    drawing = true;
    currentLine = { points: [{ x: e.clientX, y: e.clientY }], hue: Math.floor(Math.random() * 360), createdAt: Date.now() };
  }
  hiddenInput.focus();
});

window.addEventListener("mouseup", () => {
  if (drawing) {
    if (currentLine) { currentLine.createdAt = Date.now(); allLines.push(currentLine); currentLine = null; }
    drawing = false;
  }
});
