const slotDefinitions = [
  { id: "start-slot", poolKey: "startWords" },
  { id: "end-slot", poolKey: "endWords" },
];

const state = {
  config: null,
  isFileMode: window.location.protocol === "file:",
  loadingConfig: false,
  spinning: false,
  confettiActive: false,
  confettiPieces: [],
  confettiRaf: null,
};

const slotElements = slotDefinitions.map((definition) => ({
  ...definition,
  element: document.getElementById(definition.id),
}));

const spinButton = document.getElementById("spin-button");
const statusText = document.getElementById("status-text");
const configFileInput = document.getElementById("config-file-input");
const comboText = document.getElementById("combo-text");
const shoutText = document.getElementById("shout-text");
const specialMessage = document.getElementById("special-message");
const canvas = document.getElementById("confetti-canvas");
const context = canvas.getContext("2d");
const defaultButtonLabel = "ルーレット開始";
const selectConfigButtonLabel = "JSONを選んで開始";
const spinningButtonLabel = "回転中...";
const loadingButtonLabel = "設定を読み込み中";
const errorButtonLabel = "設定エラー";
const bundledConfigFetchTimeout = 2500;

function resizeCanvas() {
  canvas.width = window.innerWidth * window.devicePixelRatio;
  canvas.height = window.innerHeight * window.devicePixelRatio;
  context.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
}

function pickWord(pool) {
  if (!Array.isArray(pool) || pool.length === 0) {
    throw new Error("単語の候補が足りない");
  }

  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}

function pickRollingWord(pool, fallback) {
  const index = Math.floor(Math.random() * pool.length);
  return pool[index] ?? fallback;
}

async function loadConfig() {
  if (state.isFileMode) {
    statusText.textContent =
      "この開き方では自動読込しない。`roulette-config.json` を選ぶと準備完了";
    updateSpinButton();
    return;
  }

  state.loadingConfig = true;
  updateSpinButton();

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), bundledConfigFetchTimeout);

  try {
    const response = await fetch("./roulette-config.json", {
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const config = await response.json();
    applyConfig(config, "同梱の設定を読み込んだ。ボタンで回せる");
  } catch (error) {
    console.warn(error);
    statusText.textContent = "設定の読み込みに失敗した。ページを再読み込みしてほしい";
    state.config = null;
    updateSpinButton();
  } finally {
    state.loadingConfig = false;
    updateSpinButton();
    window.clearTimeout(timeoutId);
  }
}

function validateConfig(config) {
  if (!Array.isArray(config.startWords) || config.startWords.length === 0) {
    throw new Error("startWords がありません");
  }

  if (!Array.isArray(config.endWords) || config.endWords.length === 0) {
    throw new Error("endWords がありません");
  }

  if (config.specialCombinations && !Array.isArray(config.specialCombinations)) {
    throw new Error("specialCombinations は配列で指定してください");
  }
}

function parseConfigText(rawText) {
  const normalizedText = rawText.replace(/^\uFEFF/, "").trim();
  return JSON.parse(normalizedText);
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };

    reader.onerror = () => {
      reject(new Error("ファイルの読み込みに失敗した"));
    };

    reader.readAsText(file, "utf-8");
  });
}

function applyConfig(config, statusMessage) {
  validateConfig(config);
  state.config = config;
  applyIdlePreview();
  statusText.textContent = statusMessage;
  updateSpinButton();
}

function applyIdlePreview() {
  slotElements.forEach(({ element, poolKey }) => {
    const pool = state.config[poolKey];
    element.textContent = pool[0];
  });
}

function updateStatus(message) {
  statusText.textContent = message;
}

function clearCelebration() {
  document.body.classList.remove("is-celebrating");
  shoutText.classList.remove("is-special", "is-bursting");
  comboText.textContent = "組み合わせ待機中";
  specialMessage.textContent = "";
  stopConfetti();
}

function updateSpinButton() {
  if (state.spinning) {
    spinButton.disabled = true;
    spinButton.textContent = spinningButtonLabel;
    return;
  }

  if (state.isFileMode) {
    spinButton.disabled = false;
    spinButton.textContent = state.config ? defaultButtonLabel : selectConfigButtonLabel;
    return;
  }

  if (state.loadingConfig) {
    spinButton.disabled = true;
    spinButton.textContent = loadingButtonLabel;
    return;
  }

  if (!state.config) {
    spinButton.disabled = true;
    spinButton.textContent = errorButtonLabel;
    return;
  }

  spinButton.disabled = false;
  spinButton.textContent = defaultButtonLabel;
}

function openConfigPicker() {
  try {
    if (typeof configFileInput.showPicker === "function") {
      configFileInput.showPicker();
      return true;
    }
  } catch (error) {
    console.warn(error);
  }

  try {
    configFileInput.click();
    return true;
  } catch (error) {
    console.warn(error);
  }

  configFileInput.focus();
  return false;
}

function findSpecialMatch(result) {
  const combinations = state.config.specialCombinations ?? [];

  return combinations.find((combination) => {
    return combination.startWord === result.startWord && combination.endWord === result.endWord;
  });
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

async function animateSlot(slotElement, pool, targetWord, offsetIndex) {
  slotElement.classList.remove("is-locked");
  slotElement.classList.add("is-spinning");

  const totalSteps = 18 + offsetIndex * 5;

  for (let step = 0; step < totalSteps; step += 1) {
    const progress = step / (totalSteps - 1);
    const interval = 48 + progress * progress * 220;
    const isLastFrame = step === totalSteps - 1;
    slotElement.textContent = isLastFrame ? targetWord : pickRollingWord(pool, targetWord);
    await wait(interval);
  }

  slotElement.classList.remove("is-spinning");
  slotElement.classList.add("is-locked");
}

function buildResult(selectedStart, selectedEnd) {
  return {
    startWord: selectedStart,
    endWord: selectedEnd,
  };
}

function startConfetti(palette) {
  resizeCanvas();
  stopConfetti();
  state.confettiActive = true;

  const colors = palette?.length ? palette : ["#ff5d8f", "#5ef2ff", "#d8ff62", "#ffffff"];
  state.confettiPieces = Array.from({ length: 150 }, (_, index) => ({
    x: Math.random() * window.innerWidth,
    y: -24 - Math.random() * window.innerHeight * 0.45,
    size: 6 + Math.random() * 10,
    rotation: Math.random() * Math.PI,
    velocityX: -2 + Math.random() * 4,
    velocityY: 2 + Math.random() * 4 + index * 0.01,
    spin: -0.12 + Math.random() * 0.24,
    color: colors[index % colors.length],
  }));

  const frame = () => {
    if (!state.confettiActive) {
      return;
    }

    context.clearRect(0, 0, window.innerWidth, window.innerHeight);

    state.confettiPieces.forEach((piece) => {
      piece.x += piece.velocityX;
      piece.y += piece.velocityY;
      piece.rotation += piece.spin;
      piece.velocityY += 0.025;

      context.save();
      context.translate(piece.x, piece.y);
      context.rotate(piece.rotation);
      context.fillStyle = piece.color;
      context.fillRect(-piece.size / 2, -piece.size / 3, piece.size, piece.size * 0.66);
      context.restore();

      if (piece.y > window.innerHeight + 24) {
        piece.y = -24;
        piece.x = Math.random() * window.innerWidth;
        piece.velocityY = 2 + Math.random() * 4;
      }
    });

    state.confettiRaf = window.requestAnimationFrame(frame);
  };

  frame();

  window.setTimeout(() => {
    stopConfetti();
  }, 4200);
}

function stopConfetti() {
  state.confettiActive = false;
  if (state.confettiRaf) {
    window.cancelAnimationFrame(state.confettiRaf);
    state.confettiRaf = null;
  }
  context.clearRect(0, 0, window.innerWidth, window.innerHeight);
}

function restartShoutBurst() {
  shoutText.classList.remove("is-bursting");
  void shoutText.offsetWidth;
  shoutText.classList.add("is-bursting");
}

async function handleConfigFileSelection(event) {
  if (!state.isFileMode) {
    return;
  }

  const [file] = event.target.files ?? [];

  if (!file) {
    return;
  }

  try {
    const rawText = await readFileAsText(file);
    const parsed = parseConfigText(rawText);
    applyConfig(parsed, `${file.name} を読み込んだ。ボタンで回せる`);
  } catch (error) {
    console.error(error);
    statusText.textContent = "JSONの読み込みに失敗した。形式を見直してほしい";
    updateSpinButton();
  } finally {
    configFileInput.value = "";
  }
}

async function runRoulette() {
  if (state.spinning) {
    return;
  }

  if (!state.config) {
    if (!state.isFileMode) {
      updateStatus("設定の自動読み込みに失敗した。ページを再読み込みしてほしい");
      return;
    }

    updateStatus("JSON設定を選ぶ");
    configFileInput.value = "";
    const pickerOpened = openConfigPicker();

    if (!pickerOpened) {
      updateStatus("上のJSON入力欄から `roulette-config.json` を選ぶ");
    }

    return;
  }

  state.spinning = true;
  updateSpinButton();
  clearCelebration();
  updateStatus("回転中... だんだん減速していく");

  const selectedStart = pickWord(state.config.startWords);
  const selectedEnd = pickWord(state.config.endWords);
  const targetBySlotId = {
    "start-slot": selectedStart,
    "end-slot": selectedEnd,
  };

  await Promise.all(
    slotElements.map(({ element, poolKey, id }, index) => {
      return animateSlot(element, state.config[poolKey], targetBySlotId[id], index);
    })
  );

  const result = buildResult(selectedStart, selectedEnd);
  const matchedSpecial = findSpecialMatch(result);

  comboText.textContent = `${selectedStart}${selectedEnd}`;
  restartShoutBurst();

  if (matchedSpecial) {
    document.body.classList.add("is-celebrating");
    shoutText.classList.add("is-special");
    specialMessage.textContent = matchedSpecial.message ?? "スペシャル演出！";
    startConfetti(matchedSpecial.palette);
    updateStatus("スペシャル組み合わせ！ 紙吹雪を発射");
  } else {
    updateStatus("結果が決まった。もう一回回せる");
  }

  state.spinning = false;
  updateSpinButton();
}

spinButton.addEventListener("click", runRoulette);
configFileInput.addEventListener("change", handleConfigFileSelection);
window.addEventListener("resize", resizeCanvas);

document.body.classList.toggle("is-file-mode", state.isFileMode);
resizeCanvas();
updateSpinButton();
loadConfig();
