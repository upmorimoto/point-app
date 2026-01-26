const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const hiddenInput = document.getElementById("hiddenInput");
const uiContainer = document.getElementById("ui-container");

let isDrawingMode = false;
let drawing = false;
let pendingText = null;
let mx = 0,
  my = 0;
let config = { lineLife: 2.5, textLife: 3.0 };

const allTexts = [],
  allLines = [],
  particles = [];
let currentLine = null;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.onresize = resize;
resize();

function createSparks(x, y) {
  const hue = Math.floor(Math.random() * 360);
  for (let i = 0; i < 15; i++) {
    particles.push({
      x,
      y,
      sx: (Math.random() - 0.5) * 10,
      sy: (Math.random() - 0.5) * 10,
      life: 100,
      color: `hsl(${hue}, 100%, 70%)`,
    });
  }
}

function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const now = Date.now();

  allLines.forEach((l, idx) => {
    const a = 1 - (now - l.createdAt) / (config.lineLife * 1000);
    if (a <= 0) {
      allLines.splice(idx, 1);
      return;
    }
    ctx.strokeStyle = `hsla(${l.hue}, 100%, 60%, ${a})`;
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    l.points.forEach((p, i) =>
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
    );
    ctx.stroke();
  });

  if (currentLine) {
    ctx.strokeStyle = `hsl(${currentLine.hue}, 100%, 60%)`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    currentLine.points.forEach((p, i) =>
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
    );
    ctx.stroke();
  }

  ctx.font = "bold 40px sans-serif";
  ctx.textAlign = "center";
  allTexts.forEach((t, idx) => {
    const a = 1 - (now - t.createdAt) / (config.textLife * 1000);
    if (a <= 0) {
      allTexts.splice(idx, 1);
      return;
    }
    ctx.fillStyle = `hsla(${t.hue}, 100%, 60%, ${a})`;
    ctx.fillText(t.text, t.x, t.y - (1 - a) * 60);
  });

  particles.forEach((p, idx) => {
    p.x += p.sx;
    p.y += p.sy;
    p.life -= 2;
    if (p.life <= 0) {
      particles.splice(idx, 1);
      return;
    }
    ctx.globalAlpha = p.life / 100;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });
  requestAnimationFrame(loop);
}
loop();

// マウス位置を入力欄に反映（IMEをマウスの先に呼ぶ）
window.addEventListener("mousemove", (e) => {
  mx = e.clientX;
  my = e.clientY;
  if (isDrawingMode) {
    hiddenInput.style.left = mx + "px";
    hiddenInput.style.top = my + "px";
  }
  if (drawing) currentLine.points.push({ x: mx, y: my });
});

// 入力イベント
hiddenInput.addEventListener("input", (e) => {
  if (e.isComposing || !isDrawingMode) return;
  if (hiddenInput.value) {
    allTexts.push({
      text: hiddenInput.value,
      x: mx,
      y: my,
      hue: Math.floor(Math.random() * 360),
      createdAt: Date.now(),
    });
    hiddenInput.value = "";
  }
});
hiddenInput.addEventListener("compositionend", (e) => {
  if (e.data) {
    allTexts.push({
      text: e.data,
      x: mx,
      y: my,
      hue: Math.floor(Math.random() * 360),
      createdAt: Date.now(),
    });
    hiddenInput.value = "";
  }
});

// クリック
window.addEventListener("mousedown", (e) => {
  if (!isDrawingMode || e.target.closest(".panel")) return;
  createSparks(e.clientX, e.clientY);
  if (pendingText) {
    allTexts.push({
      text: pendingText,
      x: e.clientX,
      y: e.clientY,
      hue: Math.floor(Math.random() * 360),
      createdAt: Date.now(),
    });
    pendingText = null;
  } else {
    drawing = true;
    currentLine = {
      points: [{ x: e.clientX, y: e.clientY }],
      hue: Math.floor(Math.random() * 360),
      createdAt: Date.now(),
    };
  }
  // クリックのたびに強制フォーカス
  hiddenInput.focus();
});

window.addEventListener("mouseup", () => {
  if (drawing) {
    allLines.push(currentLine);
    currentLine = null;
    drawing = false;
  }
});

// 初期化とUI設定
window.addEventListener("DOMContentLoaded", () => {
  if (window.electronAPI) {
    window.electronAPI.onModeChange((mode) => {
      isDrawingMode = mode === "drawing";
      uiContainer.classList.toggle("hidden", !isDrawingMode);
      document.body.classList.toggle("drawing-mode", isDrawingMode);
      if (isDrawingMode) {
        setTimeout(() => {
          hiddenInput.focus();
        }, 100);
      }
    });
    window.electronAPI.onSpawnSpark((pos) => createSparks(pos.x, pos.y));
  }

  document.getElementById("clearBtn").onclick = () => {
    allLines.length = 0;
    allTexts.length = 0;
  };
  document.getElementById("msgMenuBtn").onclick = (e) => {
    e.stopPropagation();
    document.getElementById("msgListArea").classList.toggle("msg-list-show");
  };
  document.querySelectorAll(".msg-item").forEach((item) => {
    item.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      pendingText = item.innerText;
      document.getElementById("msgListArea").classList.remove("msg-list-show");
      hiddenInput.focus();
    };
  });
  document.getElementById("optionToggle").onclick = () =>
    document
      .getElementById("optionContent")
      .classList.toggle("option-content-show");
  document.getElementById("lineLifeSlider").oninput = (e) => {
    config.lineLife = e.target.value;
    document.getElementById("lineLifeVal").innerText = e.target.value + "s";
  };
  document.getElementById("textLifeSlider").oninput = (e) => {
    config.textLife = e.target.value;
    document.getElementById("textLifeVal").innerText = e.target.value + "s";
  };
});
