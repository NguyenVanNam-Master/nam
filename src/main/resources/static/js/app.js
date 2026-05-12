const STORAGE_KEY = 'finchi-player-v2';
const SESSION_KEY = 'finchi-session-v1';
const SPLASH_MIN_DURATION = 1800;
const APP_NAME = 'FINCHI EDU';
const APP_SUBTITLE = 'Nền tảng học tài chính cá nhân qua trò chơi dành cho học sinh tiểu học';
const APP_TITLE = `${APP_NAME}: ${APP_SUBTITLE}`;
let aiModule = window.FinchiAi || null;
const AI_IDLE_MS = 30000;
const PERFORMANCE_WARN_MS = 1000;
const STATIC_DATA_TTL_MS = 1000 * 60 * 60 * 12;
const API_CACHE_TTL_MS = 15000;
const AI_RESPONSE_CACHE_TTL_MS = 1000 * 60 * 2;
const EVENT_BATCH_FLUSH_MS = 280;
const FETCH_CACHE_NAMESPACE = 'finchi-fetch-cache-v3';

const app = document.getElementById('app');
const toast = document.getElementById('toast');
const bootSplash = document.getElementById('boot-splash');
const bootStatus = document.getElementById('boot-status');
const bootProgressFill = document.getElementById('boot-progress-fill');
const bootProgressLabel = document.getElementById('boot-progress-label');

const splashState = {
  startedAt: performance.now(),
  progress: 0,
  timer: null
};

const memoryCache = new Map();
const aiResponseCache = new Map();
const requestMetrics = {
  history: [],
  slow: []
};
const eventBatchState = {
  items: [],
  timer: null,
  flushing: null
};
let aiModuleLoadingPromise = null;

const LEVEL_SCENES = [
  { path: '/images/backgrounds/island-1.jpg', title: 'Đảo Vách Xanh', tone: 'tone-forest', icon: '🌄' },
  { path: '/images/backgrounds/island-2.jpg', title: 'Rừng Ánh Sáng', tone: 'tone-jungle', icon: '🌳' },
  { path: '/images/backgrounds/island-3.webp', title: 'Thung Lũng Gió', tone: 'tone-sky', icon: '☁️' },
  { path: '/images/backgrounds/island-4.jpg', title: 'Đảo Thành Cổ', tone: 'tone-castle', icon: '🏰' },
  { path: '/images/backgrounds/island-5.webp', title: 'Làng Nấm Mơ', tone: 'tone-dream', icon: '🍄' },
  { path: '/images/backgrounds/island-6.jpg', title: 'Nông Trại Kỳ Diệu', tone: 'tone-farm', icon: '🌾' },
  { path: '/images/backgrounds/island-7.jpg', title: 'Rừng Mục Tiêu', tone: 'tone-jungle', icon: '🎯' },
  { path: '/images/backgrounds/island-8.jpg', title: 'Xưởng Giá Trị', tone: 'tone-forest', icon: '🛠️' },
  { path: '/images/backgrounds/island-9.avif', title: 'Đảo Chia Sẻ', tone: 'tone-dream', icon: '💖' },
  { path: '/images/backgrounds/island-10.webp', title: 'Lâu Đài Tương Lai', tone: 'tone-castle', icon: '🚀' }
];

const QUESTION_ART = {
  idea: '/images/question-icons/brain-bulb.jpg',
  thinking: '/images/question-icons/thinking-boy.webp'
};

const LEVEL_BADGES = {
  1: { id: 'badge-level-1', levelId: 1, icon: '🥉', name: 'Tân binh tiết kiệm', tone: 'tone-bronze' },
  3: { id: 'badge-level-3', levelId: 3, icon: '🥈', name: 'Nhà phân loại tiền', tone: 'tone-silver' },
  5: { id: 'badge-level-5', levelId: 5, icon: '🥇', name: 'Nhà mua sắm thông minh', tone: 'tone-gold' },
  8: { id: 'badge-level-8', levelId: 8, icon: '👑', name: 'Chuyên gia đầu tư nhí', tone: 'tone-purple' },
  10: { id: 'badge-level-10', levelId: 10, icon: '💎', name: 'Vua Finchi', tone: 'tone-diamond' }
};

const LEVEL_SKILL_MAP = {
  1: 'Hiểu giá trị đồng tiền',
  2: 'Nhận diện và phân loại tiền',
  3: 'Phân biệt cần và muốn',
  4: 'Lập ngân sách',
  5: 'Mua sắm thông minh',
  6: 'An toàn tài chính số',
  7: 'Tiết kiệm có mục tiêu',
  8: 'Đầu tư và tạo giá trị',
  9: 'Chia sẻ có trách nhiệm',
  10: 'Tư duy tài chính dài hạn'
};

const MYSTERY_BOX_THEMES = [
  { name: 'Hộp Heo Vàng', icon: '🐷', message: 'Finchi lì xì để bé thêm hứng khởi học hôm nay.' },
  { name: 'Hộp Kho Báu', icon: '🪙', message: 'Một phong bao may mắn vừa bật mở từ kho báu Finchi.' },
  { name: 'Hộp Siêu Tiết Kiệm', icon: '💰', message: 'Phần thưởng nhỏ cho thói quen đăng nhập đều đặn của bé.' },
  { name: 'Hộp Cầu Vồng', icon: '🌈', message: 'Finchi gửi một phong bao khích lệ để bé tiếp tục cố gắng.' }
];

const MYSTERY_BOX_REWARD_PATTERN = [
  1000, 2000, 3000, 5000, 10000, 2000, 4000, 6000, 3000, 8000,
  1000, 5000, 7000, 2000, 9000, 4000, 3000, 10000, 2000, 6000,
  5000, 1000, 7000, 3000, 8000, 4000, 9000, 5000, 6000, 10000
];

const CERTIFICATE_ART_PLACEHOLDER = '/images/certificates/finchi-certificate-template.png';

function scheduleBackgroundTask(task, timeout = 240) {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(() => task(), { timeout: 1200 });
    return;
  }
  window.setTimeout(task, timeout);
}

function applyAiModule(nextModule) {
  if (!nextModule) return;
  aiModule = nextModule;
  if (state.player?.aiAgent) {
    ensureAiPlayerState();
  }
  if (state.aiRuntime) {
    const nextRuntime = aiModule?.createRuntimeState ? aiModule.createRuntimeState() : {};
    state.aiRuntime = { ...nextRuntime, ...state.aiRuntime };
  }
}

function ensureAiModuleLoaded(priority = 'idle') {
  if (aiModule) return Promise.resolve(aiModule);
  if (aiModuleLoadingPromise) return aiModuleLoadingPromise;

  const loadScript = () => new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-finchi-ai-module="true"]');
    if (existing) {
      existing.addEventListener('load', () => {
        applyAiModule(window.FinchiAi || null);
        resolve(aiModule);
      }, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = '/js/ai-agent.js';
    script.async = true;
    script.dataset.finchiAiModule = 'true';
    script.onload = () => {
      applyAiModule(window.FinchiAi || null);
      resolve(aiModule);
    };
    script.onerror = () => reject(new Error('Không tải được mô-đun AI.'));
    document.body.appendChild(script);
  });

  aiModuleLoadingPromise = priority === 'high'
    ? loadScript()
    : new Promise((resolve, reject) => {
      scheduleBackgroundTask(() => {
        loadScript().then(resolve).catch(reject);
      }, 80);
    });

  return aiModuleLoadingPromise.catch(error => {
    aiModuleLoadingPromise = null;
    throw error;
  });
}

function warmAiFeatures(screen = state.screen) {
  if (!['quiz', 'result', 'parent', 'profile', 'aiReview', 'map', 'lesson'].includes(screen)) return;
  ensureAiModuleLoaded('idle').catch(() => {});
}

function buildCacheKey(scope, key) {
  return `${FETCH_CACHE_NAMESPACE}:${scope}:${key}`;
}

function readCachedValue(scope, key, ttlMs, persistent = false) {
  const cacheKey = buildCacheKey(scope, key);
  const inMemory = memoryCache.get(cacheKey);
  if (inMemory && Date.now() - inMemory.ts < ttlMs) {
    return inMemory.value;
  }
  if (!persistent) return undefined;
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (!parsed || Date.now() - Number(parsed.ts || 0) >= ttlMs) {
      localStorage.removeItem(cacheKey);
      return undefined;
    }
    memoryCache.set(cacheKey, parsed);
    return parsed.value;
  } catch {
    return undefined;
  }
}

function writeCachedValue(scope, key, value, persistent = false) {
  const cacheKey = buildCacheKey(scope, key);
  const payload = { ts: Date.now(), value };
  memoryCache.set(cacheKey, payload);
  if (!persistent) return;
  try {
    localStorage.setItem(cacheKey, JSON.stringify(payload));
  } catch {
    // ignore quota errors
  }
}

function buildRequestLabel(url, options = {}, meta = {}) {
  if (meta.label) return meta.label;
  try {
    const resolved = new URL(url, window.location.origin);
    const method = String(options.method || 'GET').toUpperCase();
    return `${method} ${resolved.pathname}`;
  } catch {
    return String(url);
  }
}

function recordRequestMetric(label, durationMs, options = {}, status = 0) {
  const entry = {
    label,
    method: String(options.method || 'GET').toUpperCase(),
    status,
    durationMs: Math.round(durationMs),
    capturedAt: new Date().toISOString()
  };
  requestMetrics.history.push(entry);
  if (requestMetrics.history.length > 120) requestMetrics.history.shift();
  if (entry.durationMs >= PERFORMANCE_WARN_MS) {
    requestMetrics.slow.push(entry);
    if (requestMetrics.slow.length > 30) requestMetrics.slow.shift();
    console.warn(`[FINCHI perf] slow request ${entry.durationMs}ms`, entry.label, entry.status || 'network-error');
  }
}

async function timedFetch(url, options = {}, meta = {}) {
  const startedAt = performance.now();
  const label = buildRequestLabel(url, options, meta);
  try {
    const response = await fetch(url, options);
    recordRequestMetric(label, performance.now() - startedAt, options, response.status);
    return response;
  } catch (error) {
    recordRequestMetric(label, performance.now() - startedAt, options, 0);
    throw error;
  }
}

function buildAiResponseCacheKey(role, triggerEvent, context = {}) {
  return [
    role,
    triggerEvent,
    context.currentLevelId || 0,
    context.questionId || '',
    context.skillTag || '',
    context.weakSkill || '',
    context.selectedAnswer || '',
    context.isCorrect ? '1' : '0',
    context.attemptCount || 0,
    context.hintUsed || 0
  ].join('|');
}

function readCachedAiResponse(cacheKey) {
  const item = aiResponseCache.get(cacheKey);
  if (!item) return null;
  if (Date.now() - item.ts >= AI_RESPONSE_CACHE_TTL_MS) {
    aiResponseCache.delete(cacheKey);
    return null;
  }
  return item.value;
}

function writeCachedAiResponse(cacheKey, value) {
  aiResponseCache.set(cacheKey, { ts: Date.now(), value });
}

function encodeBatchEvent(payload) {
  return new URLSearchParams(payload).toString();
}

function scheduleAiEventFlush(immediate = false) {
  clearTimeout(eventBatchState.timer);
  if (immediate) {
    flushAiEventBatch().catch(() => {});
    return;
  }
  eventBatchState.timer = setTimeout(() => {
    flushAiEventBatch().catch(() => {});
  }, EVENT_BATCH_FLUSH_MS);
}

async function flushAiEventBatch() {
  if (eventBatchState.flushing) return eventBatchState.flushing;
  if (!eventBatchState.items.length) return null;
  const lines = eventBatchState.items.splice(0, eventBatchState.items.length);
  eventBatchState.flushing = postForm('/api/events/batch', {
    events: lines.map(encodeBatchEvent).join('\n')
  }).catch(() => {
    eventBatchState.items = [...lines, ...eventBatchState.items].slice(-80);
    return null;
  }).finally(() => {
    eventBatchState.flushing = null;
  });
  return eventBatchState.flushing;
}

function flushAiEventBatchSync() {
  if (!eventBatchState.items.length || typeof navigator.sendBeacon !== 'function') return;
  const body = new URLSearchParams({
    events: eventBatchState.items.map(encodeBatchEvent).join('\n')
  }).toString();
  const blob = new Blob([body], { type: 'application/x-www-form-urlencoded;charset=UTF-8' });
  navigator.sendBeacon('/api/events/batch', blob);
  eventBatchState.items = [];
}

function applyMediaPerformanceHints(root = document) {
  root.querySelectorAll('img').forEach(img => {
    if (!img.getAttribute('loading')) img.setAttribute('loading', 'lazy');
    if (!img.getAttribute('decoding')) img.setAttribute('decoding', 'async');
  });
  root.querySelectorAll('video').forEach(video => {
    if (!video.getAttribute('preload')) video.setAttribute('preload', 'metadata');
    video.setAttribute('playsinline', '');
  });
}

function setBootProgress(progress, label) {
  if (!bootSplash) return;
  const safeProgress = Math.max(0, Math.min(100, Math.round(progress)));
  splashState.progress = safeProgress;
  if (bootProgressFill) bootProgressFill.style.width = `${safeProgress}%`;
  if (bootProgressLabel) bootProgressLabel.textContent = `${safeProgress}%`;
  bootSplash.style.setProperty('--boot-progress', `${safeProgress}%`);
  if (bootStatus && label) bootStatus.textContent = label;
}

function runBootProgressSequence() {
  if (!bootSplash) return;
  const checkpoints = [
    { progress: 12, label: 'Đang mở cánh cửa tới Finchi...' },
    { progress: 26, label: 'Đang đánh thức Heo Finchi...' },
    { progress: 42, label: 'Đang dựng bản đồ 10 đảo...' },
    { progress: 58, label: 'Đang trang trí những hòn đảo thử thách...' },
    { progress: 74, label: 'Đang chuẩn bị nhiệm vụ hôm nay...' },
    { progress: 88, label: 'Finchi đang kiểm tra chiếc ví nhiệm vụ...' },
    { progress: 95, label: 'Vũ trụ Finchi gần sẵn sàng rồi!' }
  ];
  let index = 0;
  setBootProgress(0, checkpoints[0].label);
  splashState.timer = window.setInterval(() => {
    if (index >= checkpoints.length) {
      clearInterval(splashState.timer);
      return;
    }
    const checkpoint = checkpoints[index];
    if (splashState.progress < checkpoint.progress) {
      setBootProgress(checkpoint.progress, checkpoint.label);
    }
    index += 1;
    if (index >= checkpoints.length) clearInterval(splashState.timer);
  }, 900);
}


async function finishBootSplash() {
  if (!bootSplash) return;
  if (splashState.timer) {
    clearInterval(splashState.timer);
    splashState.timer = null;
  }
  setBootProgress(100, `Sẵn sàng cất cánh tới ${APP_NAME}!`);
  const remaining = Math.max(0, SPLASH_MIN_DURATION - (performance.now() - splashState.startedAt));
  if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
  requestAnimationFrame(() => bootSplash.classList.add('hide'));
  setTimeout(() => bootSplash.remove(), 760);
}

function setDocumentTitle(screenLabel = '') {
  document.title = screenLabel ? `${APP_TITLE} | ${screenLabel}` : APP_TITLE;
}

const state = {
  config: null,
  levels: [],
  shopItems: [],
  tournaments: null,
  player: null,
  screen: 'loading',
  selectedAvatar: 'ava-1',
  currentLevelId: null,
  currentQuestionIndex: 0,
  selectedAnswer: null,
  dragAssignments: {},
  selectedDragItemId: null,
  selectedMoneyBoardItemId: null,
  leaderboardTab: 'daily',
  tournamentTab: 'weekly',
  levelScore: 0,
  knowledgeRewards: [],
  justReachedMilestone: null,
  lastAwardedBadge: null,
  lastQuestionSummary: '',
  levelPassed: false,
  navHistory: [],
  levelSceneAssignments: [],
  account: null,
  clans: [],
  clansLoaded: false,
  clansLoading: false,
  pendingMysteryBox: null,
  currentStudySession: null,
  lastMissionAttempt: null,
  serverLeaderboards: { daily: [], weekly: [], monthly: [], tournament: [] },
  learningMemory: {
    items: [],
    loading: false,
    lastLoadedAt: 0
  },
  adminReview: {
    items: [],
    loading: false,
    selectedId: '',
    detail: null,
    lastLoadedAt: 0
  },
  remoteSaveTimer: null,
  aiRuntime: aiModule?.createRuntimeState ? aiModule.createRuntimeState() : {
    activeResponse: null,
    parentSummary: null,
    parentSummaryLoading: false,
    parentDetailResponse: null,
    idleTimer: null,
    questionKey: '',
    questionStartedAt: 0,
    idleTriggered: false,
    lastParentFetchAt: 0,
    lastParentOpenAt: 0
  },
  liveRefresh: {
    timer: null,
    context: '',
    intervalMs: 12000,
    lastTick: 0
  },
  lastLevelCompletionReward: 0,
  quizPathMotion: { fromIndex: 0, toIndex: 0, animate: false },
  moneyBoard: {
    bank: [],
    sourceMoney: 0,
    categories: {
      'Tiêu dùng': [],
      'Tiết kiệm': [],
      'Mục tiêu': [],
      'Chia sẻ': []
    }
  }
};

const avatars = [
  { id: 'ava-1', name: 'Finchi Heo Hồng', image: '/images/avatars/avatar-1.svg' },
  { id: 'ava-2', name: 'Finchi Heo Xanh Lá', image: '/images/avatars/avatar-2.svg' },
  { id: 'ava-3', name: 'Finchi Heo Cam', image: '/images/avatars/avatar-3.svg' },
  { id: 'ava-4', name: 'Finchi Heo Xanh Dương', image: '/images/avatars/avatar-4.svg' },
  { id: 'ava-5', name: 'Finchi Heo Bảy Sắc', image: '/images/avatars/avatar-5.svg' },
  { id: 'ava-6', name: 'Finchi Heo Tím', image: '/images/avatars/avatar-6.svg' },
  { id: 'ava-7', name: 'Finchi Heo Vàng', image: '/images/avatars/avatar-7.svg' },
  { id: 'ava-8', name: 'Finchi Heo Titan', image: '/images/avatars/avatar-8.svg' },
  { id: 'ava-9', name: 'Finchi Heo Vàng Gold', image: '/images/avatars/avatar-9.svg' }
];

const levelStickers = ['🌴', '💸', '🧠', '🐷', '🎒', '🛰️', '🔥', '🛠️', '💖', '🚀'];
const panelStickers = ['✨', '🌈', '🪙', '⭐'];
const categoryStickers = {
  'Tiêu dùng': '🛒',
  'Tiết kiệm': '🐷',
  'Mục tiêu': '🎯',
  'Chia sẻ': '💝'
};

const leaderboardLabels = { daily: 'Ngày', weekly: 'Tuần', monthly: 'Tháng' };
const fallbackLeaderboardSeeds = {
  daily: [
    { name: 'FinchiStar08', avatarId: 'ava-2', score: 165 },
    { name: 'MiuTietKiem', avatarId: 'ava-4', score: 152 },
    { name: 'BinThongThai', avatarId: 'ava-1', score: 144 },
    { name: 'HeoDatNho', avatarId: 'ava-3', score: 132 },
    { name: 'MocCauVong', avatarId: 'ava-4', score: 127 },
    { name: 'GauHamHoc', avatarId: 'ava-2', score: 118 },
    { name: 'NhaQuanGia', avatarId: 'ava-1', score: 109 },
    { name: 'BongTietKiem', avatarId: 'ava-3', score: 98 },
    { name: 'SaoNhoFinchi', avatarId: 'ava-4', score: 91 }
  ],
  weekly: [
    { name: 'DaoTreXanh', avatarId: 'ava-3', score: 520 },
    { name: 'CaptainMiu', avatarId: 'ava-1', score: 488 },
    { name: 'RainbowPiggy', avatarId: 'ava-4', score: 456 },
    { name: 'NganHaBacSi', avatarId: 'ava-2', score: 431 },
    { name: 'TietKiemGia', avatarId: 'ava-1', score: 402 },
    { name: 'SieuNhiVu', avatarId: 'ava-4', score: 378 },
    { name: 'MayXanh', avatarId: 'ava-2', score: 345 },
    { name: 'CoBeThongThai', avatarId: 'ava-3', score: 320 },
    { name: 'BeBamMap', avatarId: 'ava-1', score: 300 }
  ],
  monthly: [
    { name: 'HanhTinhTietKiem', avatarId: 'ava-2', score: 1420 },
    { name: 'StickerGalaxy', avatarId: 'ava-4', score: 1360 },
    { name: 'ThuThach10Dao', avatarId: 'ava-1', score: 1285 },
    { name: 'FinchiRanger', avatarId: 'ava-3', score: 1205 },
    { name: 'BanDoSao', avatarId: 'ava-2', score: 1128 },
    { name: 'TiaNangLuong', avatarId: 'ava-1', score: 1050 },
    { name: 'NangTienVang', avatarId: 'ava-4', score: 980 },
    { name: 'SieuTietKiem', avatarId: 'ava-3', score: 945 },
    { name: 'MinhChauNho', avatarId: 'ava-2', score: 900 }
  ]
};

const MONEY_DENOMINATIONS = [
  { value: 500000, label: '500.000đ', image: '/images/money/500k.png' },
  { value: 200000, label: '200.000đ', image: '/images/money/200k.png' },
  { value: 100000, label: '100.000đ', image: '/images/money/100k.png' },
  { value: 50000, label: '50.000đ', image: '/images/money/50k.png' },
  { value: 20000, label: '20.000đ', image: '/images/money/20k.png' },
  { value: 10000, label: '10.000đ', image: '/images/money/10k.png' },
  { value: 5000, label: '5.000đ', image: '/images/money/5k.png' },
  { value: 2000, label: '2.000đ', image: '/images/money/2k.png' },
  { value: 1000, label: '1.000đ', image: '/images/money/1k.png' }
];

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function weekKey(date = new Date()) {
  const first = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date - first) / 86400000) + 1;
  const week = Math.ceil(dayOfYear / 7);
  return `${date.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function createAnalyticsBucket(label = '') {
  return {
    label,
    attempts: 0,
    correct: 0,
    wrong: 0,
    studySeconds: 0,
    completions: 0,
    lastUpdatedAt: ''
  };
}

function createDailyAnalytics(date = todayKey()) {
  return {
    date,
    studySeconds: 0,
    questions: 0,
    correct: 0,
    byLevel: {},
    bySkill: {},
    completedLevels: []
  };
}

function createDefaultCheckinState() {
  return {
    lastClaimDate: '',
    totalClaims: 0,
    streak: 0,
    history: []
  };
}

function createDefaultPlayer() {
  const today = todayKey();
  const currentWeek = weekKey();
  const currentMonth = monthKey();
  return {
    name: '',
    avatarId: state.selectedAvatar,
    totalMoney: 0,
    unlockedLevels: [1],
    completedLevels: [],
    dailyVideoCount: 0,
    dailyTaskCount: 0,
    savingStreak: 0,
    savingMilestonesClaimed: [],
    ownedRewardItems: [],
    watchedLessonScoreClaimed: [],
    watchedIntro: false,
    finchiScore: 0,
    scoreBuckets: {
      dayKey: today,
      weekKey: currentWeek,
      monthKey: currentMonth,
      daily: 0,
      weekly: 0,
      monthly: 0,
      tournamentWeekly: 0
    },
    rankHistory: [],
    seasonRewards: [],
    lastMonthlyBoardScoreMonth: '',
    unlockRuleVersion: 2,
    lastPlayDate: today,
    earnedBadgeIds: [],
    dailyCheckin: createDefaultCheckinState(),
    analytics: {
      totalStudySeconds: 0,
      totalQuestions: 0,
      totalCorrect: 0,
      daily: {}
    },
    dreamJournal: [],
    clan: null,
    parentAccess: {
      linked: false,
      parentName: ''
    },
    aiAgent: aiModule?.createDefaultPlayerState ? aiModule.createDefaultPlayerState() : {
      settings: {
        voiceEnabled: false,
        voiceRate: 1,
        speakOnHint: true,
        speakOnWrong: true,
        speakOnCelebrate: true,
        speakOnSummary: false
      },
      studentAge: 8,
      questionAttempts: {},
      hintUsage: {},
      repeatedMistakesBySkill: {},
      correctStreak: 0,
      eventHistory: [],
      interventionHistory: [],
      lastLearningState: null,
      lastParentSummary: null
    },
    aiCorrection: {
      feedbackHistory: [],
      approvedQuestionIds: [],
      learningMemory: []
    },
    certificate: {
      unlockedAt: '',
      printedAt: ''
    }
  };
}

function getSkillForLevel(levelId) {
  return LEVEL_SKILL_MAP[levelId] || 'Tư duy tài chính';
}

function ensureTodayAnalyticsBucket() {
  if (!state.player.analytics || typeof state.player.analytics !== 'object') {
    state.player.analytics = { totalStudySeconds: 0, totalQuestions: 0, totalCorrect: 0, daily: {} };
  }
  if (!state.player.analytics.daily || typeof state.player.analytics.daily !== 'object') {
    state.player.analytics.daily = {};
  }
  const today = todayKey();
  if (!state.player.analytics.daily[today]) {
    state.player.analytics.daily[today] = createDailyAnalytics(today);
  }
  const keys = Object.keys(state.player.analytics.daily).sort();
  if (keys.length > 45) {
    keys.slice(0, keys.length - 45).forEach(key => delete state.player.analytics.daily[key]);
  }
  return state.player.analytics.daily[today];
}

function ensureStatBucket(collection, key, label) {
  if (!collection[key]) collection[key] = createAnalyticsBucket(label);
  if (!collection[key].label && label) collection[key].label = label;
  return collection[key];
}

function recordStudyDuration(seconds, levelId = state.currentStudySession?.levelId || state.currentLevelId) {
  const safeSeconds = Math.max(0, Math.round(Number(seconds || 0)));
  if (!safeSeconds || !state.player) return;
  const todayStats = ensureTodayAnalyticsBucket();
  todayStats.studySeconds += safeSeconds;
  state.player.analytics.totalStudySeconds = Number(state.player.analytics.totalStudySeconds || 0) + safeSeconds;
  if (!levelId) return;
  const levelStats = ensureStatBucket(todayStats.byLevel, String(levelId), `Level ${levelId}`);
  levelStats.studySeconds += safeSeconds;
  levelStats.lastUpdatedAt = new Date().toISOString();
  const skill = getSkillForLevel(levelId);
  const skillStats = ensureStatBucket(todayStats.bySkill, skill, skill);
  skillStats.studySeconds += safeSeconds;
  skillStats.lastUpdatedAt = new Date().toISOString();
}

function shouldTrackStudyScreen(screen = state.screen) {
  return ['intro', 'lesson', 'quiz', 'result', 'monthly', 'map'].includes(screen);
}

function startStudySession(screen = state.screen) {
  if (!shouldTrackStudyScreen(screen)) {
    state.currentStudySession = null;
    return;
  }
  state.currentStudySession = {
    screen,
    levelId: state.currentLevelId || null,
    startedAt: Date.now()
  };
}

function flushStudySession() {
  const session = state.currentStudySession;
  if (!session?.startedAt) return;
  const seconds = Math.max(0, Math.round((Date.now() - session.startedAt) / 1000));
  recordStudyDuration(seconds, session.levelId);
  state.currentStudySession = null;
  savePlayerLocal();
}

function recordQuestionAnalytics(question, level, isCorrect) {
  if (!state.player || !question || !level) return;
  const todayStats = ensureTodayAnalyticsBucket();
  todayStats.questions += 1;
  if (isCorrect) todayStats.correct += 1;
  state.player.analytics.totalQuestions = Number(state.player.analytics.totalQuestions || 0) + 1;
  if (isCorrect) state.player.analytics.totalCorrect = Number(state.player.analytics.totalCorrect || 0) + 1;

  const levelKey = String(level.id);
  const levelStats = ensureStatBucket(todayStats.byLevel, levelKey, level.title || `Level ${level.id}`);
  levelStats.attempts += 1;
  if (isCorrect) levelStats.correct += 1;
  else levelStats.wrong += 1;
  levelStats.lastUpdatedAt = new Date().toISOString();

  const skill = getSkillForLevel(level.id);
  const skillStats = ensureStatBucket(todayStats.bySkill, skill, skill);
  skillStats.attempts += 1;
  if (isCorrect) skillStats.correct += 1;
  else skillStats.wrong += 1;
  skillStats.lastUpdatedAt = new Date().toISOString();
}

function recordLevelCompletionAnalytics(levelId, passedLevel) {
  if (!state.player || !levelId) return;
  const todayStats = ensureTodayAnalyticsBucket();
  if (passedLevel && !todayStats.completedLevels.includes(levelId)) {
    todayStats.completedLevels.push(levelId);
  }
  const level = state.levels.find(item => item.id === levelId);
  const levelStats = ensureStatBucket(todayStats.byLevel, String(levelId), level?.title || `Level ${levelId}`);
  if (passedLevel) levelStats.completions += 1;
  levelStats.lastUpdatedAt = new Date().toISOString();
}

function formatStudyDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds || 0)));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours && minutes) return `${hours} giờ ${minutes} phút`;
  if (hours) return `${hours} giờ`;
  return `${Math.max(1, minutes)} phút`;
}

function getTodayStudyStats() {
  const todayStats = ensureTodayAnalyticsBucket();
  return {
    studySeconds: Number(todayStats.studySeconds || 0),
    questions: Number(todayStats.questions || 0),
    correct: Number(todayStats.correct || 0),
    completedLevels: todayStats.completedLevels || []
  };
}

function getWeakestLevelInsight() {
  const dailyStats = state.player?.analytics?.daily || {};
  const aggregate = {};
  Object.values(dailyStats).forEach(day => {
    Object.entries(day.byLevel || {}).forEach(([key, value]) => {
      if (!aggregate[key]) aggregate[key] = { label: value.label || `Level ${key}`, attempts: 0, correct: 0 };
      aggregate[key].attempts += Number(value.attempts || 0);
      aggregate[key].correct += Number(value.correct || 0);
    });
  });
  return Object.entries(aggregate)
    .filter(([, value]) => value.attempts > 0)
    .map(([key, value]) => ({ id: key, title: value.label, accuracy: value.correct / value.attempts, attempts: value.attempts, correct: value.correct }))
    .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts)[0] || null;
}

function getWeakestSkillInsight() {
  const dailyStats = state.player?.analytics?.daily || {};
  const aggregate = {};
  Object.values(dailyStats).forEach(day => {
    Object.entries(day.bySkill || {}).forEach(([key, value]) => {
      if (!aggregate[key]) aggregate[key] = { label: value.label || key, attempts: 0, correct: 0 };
      aggregate[key].attempts += Number(value.attempts || 0);
      aggregate[key].correct += Number(value.correct || 0);
    });
  });
  return Object.entries(aggregate)
    .filter(([, value]) => value.attempts > 0)
    .map(([key, value]) => ({ id: key, title: value.label, accuracy: value.correct / value.attempts, attempts: value.attempts, correct: value.correct }))
    .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts)[0] || null;
}

function ensureAiPlayerState() {
  if (!state.player.aiAgent || typeof state.player.aiAgent !== 'object') {
    state.player.aiAgent = aiModule?.createDefaultPlayerState ? aiModule.createDefaultPlayerState() : createDefaultPlayer().aiAgent;
  }
  if (aiModule?.normalizePlayerState) {
    state.player.aiAgent = aiModule.normalizePlayerState(state.player.aiAgent);
  }
  return state.player.aiAgent;
}

function resetAiRuntimeState() {
  clearAiIdleWatch();
  state.aiRuntime = aiModule?.createRuntimeState ? aiModule.createRuntimeState() : {
    activeResponse: null,
    parentSummary: null,
    parentSummaryLoading: false,
    parentDetailResponse: null,
    idleTimer: null,
    questionKey: '',
    questionStartedAt: 0,
    idleTriggered: false,
    lastParentFetchAt: 0,
    lastParentOpenAt: 0
  };
}

function clearAiIdleWatch() {
  if (state.aiRuntime?.idleTimer) {
    clearTimeout(state.aiRuntime.idleTimer);
    state.aiRuntime.idleTimer = null;
  }
}

function buildSupportStatus() {
  return getWeakestSkillInsight() ? 'needs_support' : 'on_track';
}

function getCurrentQuestion() {
  const level = getCurrentLevel();
  return level?.questions?.[state.currentQuestionIndex] || null;
}

function getAiQuestionAttempt(questionId) {
  return Number(ensureAiPlayerState().questionAttempts?.[questionId] || 0);
}

function getAiHintUsage(questionId) {
  return Number(ensureAiPlayerState().hintUsage?.[questionId] || 0);
}

function getAiMistakeCount(skillTag) {
  return Number(ensureAiPlayerState().repeatedMistakesBySkill?.[skillTag] || 0);
}

function resetAiMissionProgress(level, options = {}) {
  const aiState = ensureAiPlayerState();
  const questionIds = Array.isArray(level?.questions) ? level.questions.map(question => question.id) : [];
  const skillTag = getSkillForLevel(level?.id || state.currentLevelId || 0);
  aiModule?.resetMissionProgress?.(aiState, state.aiRuntime, {
    role: 'student',
    eventType: options.eventType || 'student_started_quiz_attempt',
    questionIds,
    skillTag
  });
  clearAiIdleWatch();
  state.aiRuntime.activeResponse = aiModule?.normalizeResponse?.({
    title: 'FINCHI đang sẵn sàng',
    message: options.message || 'Mình bắt đầu lượt làm bài mới nhé. FINCHI sẽ theo dõi đúng theo câu con đang làm bây giờ.',
    characterState: 'thinking',
    shouldSpeak: false,
    voiceType: 'thinking',
    nextAction: 'continue',
    safetyStatus: 'safe'
  }, 'student') || null;
}

function getSelectedAnswerLabel(question) {
  if (!question) return '';
  if (question.type === 'drag_classify') {
    const correctCount = question.dragItems?.filter(item => state.dragAssignments[item.id] === item.target).length || 0;
    return `Đã phân loại ${correctCount}/${question.dragItems?.length || 0} món`;
  }
  if (state.selectedAnswer === null || state.selectedAnswer === undefined) return '';
  return question.options?.[state.selectedAnswer] || '';
}

function buildAiSupportContext(level, question, extra = {}) {
  const todayStats = getTodayStudyStats();
  const weakestSkill = getWeakestSkillInsight();
  const weakestLevel = getWeakestLevelInsight();
  const aiState = ensureAiPlayerState();
  const skillTag = getSkillForLevel(level?.id || extra.currentLevelId);
  return {
    role: extra.role || (state.account?.role === 'parent' ? 'parent' : 'student'),
    studentId: state.account?.username || '',
    parentId: state.account?.role === 'parent' ? state.account.username : '',
    parentName: state.account?.parentName || state.player.parentAccess?.parentName || '',
    playerName: state.player.name || state.account?.username || 'Người chơi Finchi',
    age: Number(aiState.studentAge || 8),
    currentPage: state.screen,
    currentLesson: level?.title || extra.currentLesson || '',
    currentMission: question?.id || extra.currentMission || '',
    currentLevelId: Number(level?.id || extra.currentLevelId || 0),
    questionId: question?.id || extra.questionId || '',
    questionPrompt: question?.prompt || extra.questionPrompt || '',
    selectedAnswer: extra.selectedAnswer ?? getSelectedAnswerLabel(question),
    isCorrect: extra.isCorrect === true,
    attemptCount: Number(extra.attemptCount || getAiQuestionAttempt(question?.id)),
    hintUsed: Number(extra.hintUsed ?? getAiHintUsage(question?.id)),
    timeOnQuestion: Number(extra.timeOnQuestion || (aiModule?.getTimeOnQuestion ? aiModule.getTimeOnQuestion(state.aiRuntime) : 0)),
    skillTag,
    correctStreak: Number(extra.correctStreak || aiState.correctStreak || 0),
    mistakeCountSkill: Number(extra.mistakeCountSkill || getAiMistakeCount(skillTag)),
    mistakePattern: extra.mistakePattern || (weakestSkill ? [weakestSkill.title] : []),
    emotionSignal: extra.emotionSignal || '',
    weakSkill: weakestSkill?.title || '',
    weakLevel: weakestLevel?.title || '',
    childProgressStatus: extra.childProgressStatus || buildSupportStatus(),
    todayStudySeconds: Number(todayStats.studySeconds || 0),
    todayQuestions: Number(todayStats.questions || 0),
    todayCorrect: Number(todayStats.correct || 0),
    completedLevelsCount: Number(state.player.completedLevels?.length || 0)
  };
}

function serializeAiPayload(eventType, context) {
  return {
    username: state.account?.username || '',
    eventType,
    role: context.role || 'student',
    studentId: context.studentId || '',
    parentId: context.parentId || '',
    parentName: context.parentName || '',
    playerName: context.playerName || '',
    age: String(context.age || 8),
    currentPage: context.currentPage || '',
    currentLesson: context.currentLesson || '',
    currentMission: context.currentMission || '',
    currentLevelId: String(context.currentLevelId || 0),
    questionId: context.questionId || '',
    questionPrompt: context.questionPrompt || '',
    selectedAnswer: context.selectedAnswer || '',
    isCorrect: String(Boolean(context.isCorrect)),
    attemptCount: String(context.attemptCount || 0),
    hintUsed: String(context.hintUsed || 0),
    timeOnQuestion: String(context.timeOnQuestion || 0),
    skillTag: context.skillTag || '',
    correctStreak: String(context.correctStreak || 0),
    mistakeCountSkill: String(context.mistakeCountSkill || 0),
    mistakePattern: Array.isArray(context.mistakePattern) ? context.mistakePattern.join('|') : '',
    emotionSignal: context.emotionSignal || '',
    weakSkill: context.weakSkill || '',
    weakLevel: context.weakLevel || '',
    childProgressStatus: context.childProgressStatus || '',
    todayStudySeconds: String(context.todayStudySeconds || 0),
    todayQuestions: String(context.todayQuestions || 0),
    todayCorrect: String(context.todayCorrect || 0),
    completedLevelsCount: String(context.completedLevelsCount || 0)
  };
}

async function postAiEvent(path, eventType, context) {
  if (!state.account?.username) return null;
  const payload = serializeAiPayload(eventType, context);
  eventBatchState.items.push(payload);
  scheduleAiEventFlush(eventBatchState.items.length >= 6);
  return { ok: true, queued: true };
}

function storeAiResponse(role, response, options = {}) {
  const normalized = aiModule?.normalizeResponse
    ? aiModule.normalizeResponse(response, role)
    : {
      title: response.title || 'AI FINCHI',
      message: response.message || '',
      characterState: response.characterState || 'idle',
      shouldSpeak: Boolean(response.shouldSpeak),
      voiceType: response.voiceType || 'text',
      nextAction: response.nextAction || 'continue',
      safetyStatus: response.safetyStatus || 'safe',
      icon: '🐷',
      tone: ''
    };
  if (role === 'parent' && normalized.summary) {
    state.aiRuntime.parentSummary = normalized.summary;
    ensureAiPlayerState().lastParentSummary = normalized.summary;
  }
  state.aiRuntime.activeResponse = normalized;
  if (role === 'parent') {
    state.aiRuntime.parentDetailResponse = normalized;
  }
  const aiState = ensureAiPlayerState();
  aiModule?.appendIntervention?.(aiState, normalized);
  if (options.shouldPersist === true) savePlayer();
  else savePlayerLocal();
  if (options.shouldSpeak !== false) maybeSpeakAiResponse(role, normalized);
  return normalized;
}

function maybeSpeakAiResponse(role, response) {
  const aiState = ensureAiPlayerState();
  if (!aiModule?.shouldSpeak?.(response, aiState.settings, role)) return false;
  return aiModule.speakResponse(response, aiState.settings);
}

async function fetchAiIntervention(role, triggerEvent, context) {
  ensureAiModuleLoaded('idle').catch(() => {});
  const fallback = aiModule?.buildFallbackIntervention
    ? aiModule.buildFallbackIntervention(role, triggerEvent, context)
    : { title: 'AI FINCHI', message: 'FINCHI đang đồng hành cùng con.', characterState: 'idle', shouldSpeak: false };
  const cacheKey = buildAiResponseCacheKey(role, triggerEvent, context);
  const cachedResponse = readCachedAiResponse(cacheKey);
  if (!state.account?.username) {
    return storeAiResponse(role, cachedResponse || fallback, { shouldPersist: false });
  }
  if (cachedResponse) {
    storeAiResponse(role, cachedResponse, { shouldPersist: false });
  }
  try {
    const response = await postForm('/api/ai/intervention', {
      ...serializeAiPayload(triggerEvent, context),
      triggerEvent
    });
    writeCachedAiResponse(cacheKey, response);
    return storeAiResponse(role, response, { shouldPersist: false });
  } catch {
    return storeAiResponse(role, cachedResponse || fallback, { shouldPersist: false });
  }
}

function syncAiQuestionWatch(level, question) {
  if (!level || !question || state.account?.role === 'parent') return;
  ensureAiPlayerState();
  const changed = aiModule?.startQuestionTracking?.(state.aiRuntime, level, question);
  if (changed) {
    state.aiRuntime.activeResponse = aiModule?.normalizeResponse?.({
      title: 'FINCHI đang suy nghĩ',
      message: `FINCHI đang theo dõi nhiệm vụ ${state.currentQuestionIndex + 1}. Nếu cần, con có thể xin gợi ý bất cứ lúc nào.`,
      characterState: 'thinking',
      shouldSpeak: false,
      voiceType: 'thinking',
      nextAction: 'continue',
      safetyStatus: 'safe'
    }, 'student') || state.aiRuntime.activeResponse;
    const context = buildAiSupportContext(level, question, {
      emotionSignal: 'thinking'
    });
    postAiEvent('/api/events/student', 'student_viewed_question', context);
  }
  clearAiIdleWatch();
  state.aiRuntime.idleTimer = setTimeout(async () => {
    const currentLevel = getCurrentLevel();
    const currentQuestion = getCurrentQuestion();
    if (!currentLevel || !currentQuestion) return;
    if (currentLevel.id !== level.id || currentQuestion.id !== question.id || state.screen !== 'quiz' || state.aiRuntime.idleTriggered) return;
    state.aiRuntime.idleTriggered = true;
    const aiState = ensureAiPlayerState();
    const context = aiModule?.recordPassiveEvent
      ? aiModule.recordPassiveEvent(aiState, state.aiRuntime, 'student_idle_too_long', buildAiSupportContext(level, question, {
        emotionSignal: 'struggling'
      }))
      : buildAiSupportContext(level, question, { emotionSignal: 'struggling' });
    await postAiEvent('/api/events/student', 'student_idle_too_long', context);
    const trigger = aiModule?.decideTrigger ? aiModule.decideTrigger('student_idle_too_long', context) : 'student_idle_too_long';
    if (trigger) {
      await fetchAiIntervention('student', trigger, context);
      if (state.screen === 'quiz') renderQuiz();
    }
  }, AI_IDLE_MS);
}

async function handleManualAiHint(level, question) {
  if (!level || !question) return;
  ensureAiModuleLoaded('high').catch(() => {});
  const aiState = ensureAiPlayerState();
  const hintUsed = aiModule?.noteHintUsage ? aiModule.noteHintUsage(aiState, question.id) : (aiState.hintUsage[question.id] = Number(aiState.hintUsage[question.id] || 0) + 1);
  const context = aiModule?.recordPassiveEvent
    ? aiModule.recordPassiveEvent(aiState, state.aiRuntime, 'student_requested_hint', buildAiSupportContext(level, question, {
      hintUsed,
      emotionSignal: 'thinking'
    }))
    : buildAiSupportContext(level, question, { hintUsed, emotionSignal: 'thinking' });
  postAiEvent('/api/events/student', 'student_requested_hint', context);
  storeAiResponse('student', readCachedAiResponse(buildAiResponseCacheKey('student', 'student_requested_hint', context))
    || (aiModule?.buildFallbackIntervention ? aiModule.buildFallbackIntervention('student', 'student_requested_hint', context) : {
      title: 'FINCHI gợi ý nhanh',
      message: 'Con thử đọc lại tình huống và chọn món cần thiết trước nhé.',
      characterState: 'hint',
      shouldSpeak: false
    }), { shouldPersist: false });
  if (state.screen === 'quiz') renderQuiz();
  fetchAiIntervention('student', 'student_requested_hint', context).then(() => {
    if (state.screen === 'quiz') renderQuiz();
  }).catch(() => {});
}

async function handleStudentAnswerAi(level, question, answerPayload) {
  ensureAiModuleLoaded('high').catch(() => {});
  const aiState = ensureAiPlayerState();
  const eventType = answerPayload.isCorrect ? 'student_answer_correct' : 'student_answer_wrong';
  const learningState = aiModule?.recordStudentSubmission
    ? aiModule.recordStudentSubmission(aiState, state.aiRuntime, buildAiSupportContext(level, question, answerPayload))
    : buildAiSupportContext(level, question, answerPayload);
  postAiEvent('/api/events/student', 'student_answer_submitted', learningState);
  postAiEvent('/api/events/student', eventType, learningState);
  const trigger = aiModule?.decideTrigger ? aiModule.decideTrigger(eventType, learningState) : eventType;
  if (trigger) {
    const optimistic = readCachedAiResponse(buildAiResponseCacheKey('student', trigger, learningState))
      || (aiModule?.buildFallbackIntervention ? aiModule.buildFallbackIntervention('student', trigger, learningState) : null);
    if (optimistic) {
      storeAiResponse('student', optimistic, { shouldPersist: false, shouldSpeak: false });
    }
    fetchAiIntervention('student', trigger, learningState).catch(() => {});
  }
}

async function handleLevelCompletionAi(level) {
  ensureAiModuleLoaded('idle').catch(() => {});
  const question = level?.questions?.[Math.max(0, state.currentQuestionIndex - 1)] || null;
  const aiState = ensureAiPlayerState();
  const context = aiModule?.recordPassiveEvent
    ? aiModule.recordPassiveEvent(aiState, state.aiRuntime, 'student_completed_mission', buildAiSupportContext(level, question, {
      emotionSignal: state.levelPassed ? 'confident' : 'thinking'
    }))
    : buildAiSupportContext(level, question, { emotionSignal: state.levelPassed ? 'confident' : 'thinking' });
  postAiEvent('/api/events/student', 'student_completed_mission', context);
  if (state.levelPassed) {
    const optimistic = readCachedAiResponse(buildAiResponseCacheKey('student', 'student_completed_mission', context))
      || (aiModule?.buildFallbackIntervention ? aiModule.buildFallbackIntervention('student', 'student_completed_mission', context) : null);
    if (optimistic) {
      storeAiResponse('student', optimistic, { shouldPersist: false, shouldSpeak: false });
    }
    fetchAiIntervention('student', 'student_completed_mission', context).catch(() => {});
  }
}

async function ensureParentAiSummary(force = false) {
  if (!state.account?.username || state.account.role !== 'parent') return null;
  if (state.aiRuntime.parentSummaryLoading) return state.aiRuntime.parentSummary;
  if (!force && state.aiRuntime.parentSummary && Date.now() - Number(state.aiRuntime.lastParentFetchAt || 0) < 15000) {
    return state.aiRuntime.parentSummary;
  }

  const context = buildAiSupportContext(null, null, {
    role: 'parent'
  });
  if (force || Date.now() - Number(state.aiRuntime.lastParentOpenAt || 0) > 5000) {
    state.aiRuntime.lastParentOpenAt = Date.now();
    postAiEvent('/api/events/parent', 'parent_opened_report', context);
  }

  state.aiRuntime.parentSummaryLoading = true;
  try {
    const payload = await fetchJson(`/api/parent/${encodeURIComponent(state.account.username)}/context-summary`, {
      ttlMs: API_CACHE_TTL_MS,
      cacheKey: `parent-summary:${state.account.username}`,
      force
    });
    const summary = payload.summary || aiModule?.buildParentSummary?.(context) || null;
    state.aiRuntime.parentSummary = summary;
    state.aiRuntime.lastParentFetchAt = Date.now();
    ensureAiPlayerState().lastParentSummary = summary;
    if (force || !state.aiRuntime.activeResponse) {
      const summaryResponse = {
        title: 'FINCHI tóm tắt cho phụ huynh',
        message: payload.message || summary?.summaryMessage || 'FINCHI đã cập nhật tiến độ học tập mới nhất của con.',
        characterState: 'parent_summary',
        shouldSpeak: false,
        voiceType: 'parent-summary',
        nextAction: 'review_dashboard',
        safetyStatus: 'safe',
        summary
      };
      storeAiResponse('parent', summaryResponse, { shouldPersist: false, shouldSpeak: false });
    }
    return summary;
  } catch {
    const summary = aiModule?.buildParentSummary?.(context) || null;
    state.aiRuntime.parentSummary = summary;
    state.aiRuntime.lastParentFetchAt = Date.now();
    ensureAiPlayerState().lastParentSummary = summary;
    return summary;
  } finally {
    state.aiRuntime.parentSummaryLoading = false;
  }
}

async function requestParentMistakeExplanation() {
  const context = buildAiSupportContext(null, null, {
    role: 'parent'
  });
  postAiEvent('/api/events/parent', 'parent_viewed_mistake_detail', context);
  const optimistic = readCachedAiResponse(buildAiResponseCacheKey('parent', 'parent_viewed_mistake_detail', context))
    || (aiModule?.buildFallbackIntervention ? aiModule.buildFallbackIntervention('parent', 'parent_viewed_mistake_detail', context) : null);
  if (optimistic) {
    storeAiResponse('parent', optimistic, { shouldPersist: false, shouldSpeak: false });
  }
  await fetchAiIntervention('parent', 'parent_viewed_mistake_detail', context);
  if (state.screen === 'parent') renderParentDashboard();
}

function renderAiSidebarCard(isParentSession = false) {
  const aiState = ensureAiPlayerState();
  const activeResponse = state.aiRuntime.activeResponse;
  const fallbackCharacter = isParentSession ? 'parent_summary' : 'idle';
  const meta = aiModule?.getCharacterMeta?.(activeResponse?.characterState || fallbackCharacter) || {
    icon: '🐷',
    label: 'AI học tập FINCHI',
    tone: ''
  };
  const message = activeResponse?.message
    || (isParentSession
      ? 'FINCHI sẽ tự động tóm tắt tiến độ của con và gợi ý cách đồng hành tại nhà.'
      : 'Khi con trả lời sai, dừng quá lâu hoặc cần gợi ý, FINCHI sẽ chủ động hỗ trợ ngay trong bài học.');
  const question = getCurrentQuestion();
  const showHintButton = state.screen === 'quiz' && !isParentSession && Boolean(question);
  return `
    <div class="wallet-card ai-sidebar-card ${meta.tone}">
      <div class="ai-sidebar-head">
        <div class="ai-sidebar-orb">${meta.icon}</div>
        <div>
          <strong>AI học tập FINCHI</strong>
          <div class="subtitle">${escapeHtml(meta.label)}</div>
        </div>
      </div>
      <p class="ai-sidebar-message">${escapeHtml(message)}</p>
      <div class="ai-setting-grid">
        <label class="ai-setting-toggle"><input type="checkbox" data-ai-setting="voiceEnabled" ${aiState.settings.voiceEnabled ? 'checked' : ''}> Bật giọng nói</label>
        <label class="ai-setting-toggle"><input type="checkbox" data-ai-setting="speakOnHint" ${aiState.settings.speakOnHint ? 'checked' : ''}> Phát khi gợi ý</label>
        <label class="ai-setting-toggle"><input type="checkbox" data-ai-setting="speakOnWrong" ${aiState.settings.speakOnWrong ? 'checked' : ''}> Phát khi trả lời sai</label>
        <label class="ai-setting-toggle"><input type="checkbox" data-ai-setting="speakOnCelebrate" ${aiState.settings.speakOnCelebrate ? 'checked' : ''}> Phát khi chúc mừng</label>
        ${isParentSession ? `<label class="ai-setting-toggle"><input type="checkbox" data-ai-setting="speakOnSummary" ${aiState.settings.speakOnSummary ? 'checked' : ''}> Phát khi báo cáo phụ huynh</label>` : ''}
      </div>
      <label class="ai-speed-row">
        <span>Tốc độ đọc</span>
        <select data-ai-setting-select="voiceRate">
          <option value="0.9" ${String(aiState.settings.voiceRate) === '0.9' ? 'selected' : ''}>Chậm</option>
          <option value="1" ${String(aiState.settings.voiceRate) === '1' ? 'selected' : ''}>Vừa</option>
          <option value="1.1" ${String(aiState.settings.voiceRate) === '1.1' ? 'selected' : ''}>Nhanh</option>
        </select>
      </label>
      <div class="inline-actions" style="margin-top:12px;">
        ${showHintButton ? '<button class="btn-secondary" type="button" data-ai-action="manual-hint-global">Gợi ý AI</button>' : ''}
        <button class="btn-ghost" type="button" data-ai-action="repeat-last">Nhắc lại</button>
      </div>
    </div>
  `;
}

function renderAiMissionCard(level, question) {
  const activeResponse = state.aiRuntime.activeResponse;
  const meta = aiModule?.getCharacterMeta?.(activeResponse?.characterState || 'thinking') || {
    icon: '🐷',
    label: 'FINCHI đang đồng hành',
    tone: ''
  };
  const message = activeResponse?.message || 'Nếu con cần trợ giúp, hãy bấm nút gợi ý để FINCHI dẫn dắt từng bước nhé.';
  return `
    <div class="ai-mission-card ${meta.tone}">
      <div class="ai-mission-icon">${meta.icon}</div>
      <div class="ai-mission-copy">
        <div class="ai-mission-head">
          <strong>${escapeHtml(meta.label)}</strong>
          <span class="meta-pill">${escapeHtml(getSkillForLevel(level.id))}</span>
        </div>
        <p class="section-subtitle" style="margin:8px 0 0;">${escapeHtml(message)}</p>
        <div class="inline-actions" style="margin-top:12px;">
          <button class="btn-secondary" type="button" data-ai-action="manual-hint">Gợi ý của FINCHI</button>
          <button class="btn-ghost" type="button" data-ai-action="repeat-last">Nghe lại lời nhắc</button>
        </div>
      </div>
    </div>
  `;
}

function renderParentAiSummaryCard() {
  const summary = state.aiRuntime.parentSummary || ensureAiPlayerState().lastParentSummary;
  const activeResponse = state.aiRuntime.parentDetailResponse || state.aiRuntime.activeResponse;
  const meta = aiModule?.getCharacterMeta?.(activeResponse?.characterState || 'parent_summary') || {
    icon: '📘',
    label: 'Tóm tắt cho phụ huynh',
    tone: ''
  };
  const summaryMessage = summary?.summaryMessage || 'FINCHI đang chuẩn bị tóm tắt mới nhất cho phụ huynh.';
  const homeActivity = summary?.homeActivity || 'Khi con học thêm vài câu nữa, FINCHI sẽ gợi ý hoạt động ở nhà phù hợp hơn.';
  return `
    <section class="card ai-parent-summary ${meta.tone}">
      <div class="ai-parent-head">
        <div class="ai-sidebar-orb">${meta.icon}</div>
        <div>
          <strong>AI Agent cho phụ huynh</strong>
          <div class="subtitle">${escapeHtml(meta.label)}</div>
        </div>
      </div>
      <p class="section-subtitle" style="margin-top:12px;">${escapeHtml(summaryMessage)}</p>
      <div class="badge-cloud">
        <span class="badge-chip tone-blue">${summary?.weakLevel ? `📘 ${escapeHtml(summary.weakLevel)}` : '📘 Chưa có level yếu nổi bật'}</span>
        <span class="badge-chip tone-gold">${summary?.weakSkill ? `🧠 ${escapeHtml(summary.weakSkill)}` : '🧠 Chưa có kỹ năng yếu rõ rệt'}</span>
      </div>
      <div class="ai-parent-homework">
        <strong>Gợi ý hoạt động ở nhà</strong>
        <p class="subtitle">${escapeHtml(homeActivity)}</p>
      </div>
      ${activeResponse?.message && activeResponse?.message !== summaryMessage ? `<div class="ai-parent-detail">${escapeHtml(activeResponse.message)}</div>` : ''}
      <div class="inline-actions" style="margin-top:14px;">
        <button class="btn-secondary" type="button" id="refresh-parent-ai">Làm mới tóm tắt AI</button>
        <button class="btn-ghost" type="button" id="parent-ai-explain">Giải thích lỗi thường gặp</button>
        <button class="btn-ghost" type="button" id="parent-report-ai">Phụ huynh báo AI chấm sai</button>
      </div>
    </section>
  `;
}

function attachAiSidebarControls() {
  const aiState = ensureAiPlayerState();
  document.querySelectorAll('[data-ai-setting]').forEach(input => {
    input.addEventListener('change', () => {
      aiState.settings[input.dataset.aiSetting] = input.checked;
      if (!input.checked && input.dataset.aiSetting === 'voiceEnabled') {
        aiModule?.stopSpeaking?.();
      }
      if (input.checked && input.dataset.aiSetting === 'voiceEnabled') {
        maybeSpeakAiResponse(state.account?.role === 'parent' ? 'parent' : 'student', {
          message: 'FINCHI đã bật giọng nói và sẽ hỗ trợ con đúng lúc nhé.',
          characterState: 'idle',
          shouldSpeak: true
        });
      }
      savePlayer();
      showToast(input.checked ? 'Đã bật cài đặt AI.' : 'Đã tắt cài đặt AI.');
    });
  });
  document.querySelector('[data-ai-setting-select="voiceRate"]')?.addEventListener('change', event => {
    aiState.settings.voiceRate = Number(event.target.value || 1);
    savePlayer();
    showToast('Đã cập nhật tốc độ đọc của FINCHI.');
  });
  document.querySelectorAll('[data-ai-action="repeat-last"]').forEach(button => {
    button.addEventListener('click', () => {
      const activeResponse = state.aiRuntime.activeResponse;
      if (!activeResponse?.message) {
        showToast('FINCHI chưa có lời nhắc mới để đọc lại.');
        return;
      }
      const spoken = maybeSpeakAiResponse(state.account?.role === 'parent' ? 'parent' : 'student', {
        ...activeResponse,
        shouldSpeak: true
      });
      if (!spoken) showToast('Hãy bật giọng nói của FINCHI để nghe lại lời nhắc.');
    });
  });
  document.querySelector('[data-ai-action="manual-hint-global"]')?.addEventListener('click', async () => {
    const level = getCurrentLevel();
    const question = getCurrentQuestion();
    await handleManualAiHint(level, question);
  });
}

function attachAiMissionActions(level, question) {
  document.querySelector('[data-ai-action="manual-hint"]')?.addEventListener('click', async () => {
    await handleManualAiHint(level, question);
  });
}

function formatCorrectionStatusLabel(status = '') {
  const labels = {
    pending_review: 'Chờ kiểm chứng',
    auto_verified_correct: 'Tự xác minh bé đúng',
    auto_verified_incorrect: 'Tự xác minh AI đúng',
    needs_human_review: 'Cần người duyệt',
    approved_as_correct: 'Đã duyệt bé đúng',
    rejected: 'Đã từ chối',
    rubric_update_suggested: 'Đề xuất cập nhật rubric',
    rubric_updated: 'Rubric đã cập nhật'
  };
  return labels[status] || status || 'Chờ xử lý';
}

function formatVerificationResultLabel(result = '') {
  const labels = {
    user_correct: 'Bé đúng',
    user_incorrect: 'AI đúng',
    partially_correct: 'Bé có phần hợp lý',
    uncertain: 'Chưa đủ chắc chắn'
  };
  return labels[result] || result || 'Chưa kiểm chứng';
}

function buildCorrectionReasonPresets(level, question) {
  const skill = getSkillForLevel(level?.id || state.currentLevelId);
  const presets = [
    `Con chọn theo mục tiêu của mình trong kỹ năng ${skill.toLowerCase()}.`,
    'Con ưu tiên điều cần trước điều muốn.',
    'Con muốn tiết kiệm cho mục tiêu lớn hơn nên chưa mua ngay.',
    'Con nghĩ lựa chọn này vẫn hợp lý nếu nhìn theo hoàn cảnh của con.'
  ];
  if (question?.type === 'drag_classify') {
    return [
      'Con phân loại theo giá trị của từng tờ tiền.',
      'Con so sánh mệnh giá trước khi kéo thả.',
      'Con nghĩ nhóm này hợp lý vì các tờ tiền có cùng mức giá trị.'
    ];
  }
  if (String(skill).toLowerCase().includes('an toàn')) {
    return [
      'Con chọn để giữ an toàn và không chia sẻ thông tin quan trọng.',
      'Con nghĩ lựa chọn này giúp tránh rủi ro trên mạng hơn.'
    ];
  }
  return presets;
}

function getLastAttemptQuestionKey() {
  const attempt = state.lastMissionAttempt;
  return attempt ? `${attempt.levelId}:${attempt.questionId}` : '';
}

function canSubmitCorrectionForLastAttempt() {
  const attempt = state.lastMissionAttempt;
  if (!attempt) return false;
  if (attempt.aiOriginalDecision !== 'incorrect') return false;
  if (attempt.corrected) return false;
  return true;
}

function renderCorrectionActionCard(question, level, isCorrect) {
  if (isCorrect || !canSubmitCorrectionForLastAttempt()) return '';
  return `
    <div class="knowledge-card correction-card">
      <strong>FINCHI có thể đã hiểu chưa đủ ý của con</strong>
      <p class="section-subtitle" style="margin-top:8px;">Nếu con thấy lựa chọn của mình vẫn hợp lý, con có thể phản hồi để FINCHI kiểm chứng lại bằng rubric, rule và hàng chờ duyệt an toàn.</p>
      <div class="inline-actions">
        <button class="btn-secondary" type="button" data-correction-action="child-disagrees">Con nghĩ mình đúng</button>
        <button class="btn-ghost" type="button" data-correction-action="child-explains">Giải thích lựa chọn của con</button>
      </div>
    </div>
  `;
}

function attachCorrectionActionCard(question, level) {
  document.querySelector('[data-correction-action="child-disagrees"]')?.addEventListener('click', () => {
    openCorrectionFeedbackModal({ feedbackType: 'child_disagrees', level, question, source: 'student', title: 'Con nghĩ mình đúng' });
  });
  document.querySelector('[data-correction-action="child-explains"]')?.addEventListener('click', () => {
    openCorrectionFeedbackModal({ feedbackType: 'child_disagrees', level, question, source: 'student', title: 'Giải thích lựa chọn của con' });
  });
}

function patchCorrectionAnalytics(level) {
  const todayStats = ensureTodayAnalyticsBucket();
  todayStats.correct += 1;
  const levelKey = String(level.id);
  const levelStats = ensureStatBucket(todayStats.byLevel, levelKey, level.title || `Level ${level.id}`);
  levelStats.correct += 1;
  levelStats.wrong = Math.max(0, Number(levelStats.wrong || 0) - 1);
  levelStats.lastUpdatedAt = new Date().toISOString();
  const skill = getSkillForLevel(level.id);
  const skillStats = ensureStatBucket(todayStats.bySkill, skill, skill);
  skillStats.correct += 1;
  skillStats.wrong = Math.max(0, Number(skillStats.wrong || 0) - 1);
  skillStats.lastUpdatedAt = new Date().toISOString();
  state.player.analytics.totalCorrect = Number(state.player.analytics.totalCorrect || 0) + 1;
}

function applyApprovedCorrection(payload, level, question) {
  const attempt = state.lastMissionAttempt;
  if (!attempt || attempt.corrected) return;
  if (attempt.questionId !== question.id || attempt.levelId !== level.id) return;
  attempt.corrected = true;
  const rewardDelta = Number(payload?.rewardDelta ?? attempt.rewardIfCorrect ?? 0);
  state.levelScore += 1;
  patchCorrectionAnalytics(level);
  if (rewardDelta > 0) state.player.totalMoney += rewardDelta;
  awardScore(15, `Correction được duyệt cho ${question.id}`);
  const questionKey = `${level.id}:${question.id}`;
  if (!state.player.aiCorrection.approvedQuestionIds.includes(questionKey)) {
    state.player.aiCorrection.approvedQuestionIds.push(questionKey);
  }
  showToast(rewardDelta > 0 ? `FINCHI đã ghi nhận lại cho con và cộng thêm ${formatMoney(rewardDelta)}.` : 'FINCHI đã ghi nhận lại lựa chọn của con.');
}

function addLearningMemoryEntry(entry) {
  if (!entry?.id) return;
  state.learningMemory.items = [entry, ...(state.learningMemory.items || []).filter(item => item.id !== entry.id)].slice(0, 18);
  state.player.aiCorrection.learningMemory = [entry, ...(state.player.aiCorrection.learningMemory || []).filter(item => item.id !== entry.id)].slice(0, 18);
}

function addCorrectionFeedbackHistory(entry) {
  if (!entry?.id) return;
  state.player.aiCorrection.feedbackHistory = [
    entry,
    ...(state.player.aiCorrection.feedbackHistory || []).filter(item => item.id !== entry.id)
  ].slice(0, 24);
}

function buildCorrectionContext(level, question, feedbackType, explanation) {
  const attempt = state.lastMissionAttempt;
  const aiResponse = state.aiRuntime.activeResponse;
  return {
    lessonId: String(level?.id || attempt?.levelId || state.currentLevelId || ''),
    missionId: question?.id || attempt?.questionId || '',
    questionId: question?.id || attempt?.questionId || '',
    studentAnswer: attempt?.studentAnswer || getSelectedAnswerLabel(question) || '',
    studentExplanation: explanation,
    aiOriginalFeedback: aiResponse?.message || attempt?.aiOriginalFeedback || '',
    aiOriginalDecision: attempt?.aiOriginalDecision || 'incorrect',
    feedbackType,
    currentLesson: level?.title || attempt?.levelTitle || '',
    questionPrompt: question?.prompt || attempt?.questionPrompt || '',
    skillTag: getSkillForLevel(level?.id || attempt?.levelId || state.currentLevelId || 0)
  };
}

function openCorrectionFeedbackModal({ feedbackType, level, question, source, title }) {
  const presets = buildCorrectionReasonPresets(level, question);
  const overlay = document.createElement('div');
  overlay.className = 'correction-overlay';
  overlay.innerHTML = `
    <div class="correction-modal">
      <div class="correction-head">
        <div>
          <span class="badge">AI Correction</span>
          <h2 class="section-title" style="margin:10px 0 0; font-size:1.7rem;">${escapeHtml(title || 'FINCHI muốn nghe thêm từ con')}</h2>
          <p class="section-subtitle" style="margin-top:8px;">FINCHI sẽ chưa khẳng định ngay con đúng. Hệ thống sẽ kiểm chứng lại bằng rule, rubric và hàng chờ duyệt an toàn.</p>
        </div>
        <button class="btn-ghost" type="button" data-close-correction>Đóng</button>
      </div>
      <div class="knowledge-card">
        <strong>${escapeHtml(question?.prompt || state.lastMissionAttempt?.questionPrompt || 'Giải thích lựa chọn của con')}</strong>
        <p class="subtitle" style="margin-top:8px;">Bé có thể tự gõ hoặc bấm chọn một lý do gần nhất với suy nghĩ của mình.</p>
      </div>
      <div class="badge-cloud correction-presets">
        ${presets.map(reason => `<button class="badge-chip tone-blue" type="button" data-correction-preset="${escapeHtml(reason)}">${escapeHtml(reason)}</button>`).join('')}
      </div>
      <div class="form-group">
        <label class="label" for="correctionExplanation">Lý do của con</label>
        <textarea id="correctionExplanation" class="input textarea-input" rows="5" placeholder="Ví dụ: Con muốn để dành tiền cho mục tiêu lớn hơn nên chưa mua ngay..."></textarea>
      </div>
      <div class="inline-actions" style="margin-top:18px;">
        <button class="btn-primary" type="button" data-submit-correction>Gửi để FINCHI kiểm chứng</button>
      </div>
    </div>
  `;
  overlay.querySelector('[data-close-correction]')?.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', event => {
    if (event.target === overlay) overlay.remove();
  });
  overlay.querySelectorAll('[data-correction-preset]').forEach(button => {
    button.addEventListener('click', () => {
      const textarea = overlay.querySelector('#correctionExplanation');
      textarea.value = button.dataset.correctionPreset || '';
      textarea.focus();
    });
  });
  overlay.querySelector('[data-submit-correction]')?.addEventListener('click', async () => {
    const explanation = overlay.querySelector('#correctionExplanation')?.value.trim() || '';
    if (explanation.length < 8) {
      showToast('Hãy giải thích rõ hơn một chút để FINCHI có thể kiểm chứng lại nhé.');
      return;
    }
    await submitCorrectionFeedback({
      feedbackType,
      explanation,
      level,
      question,
      source
    });
    overlay.remove();
  });
  document.body.appendChild(overlay);
}

async function submitCorrectionFeedback({ feedbackType, explanation, level, question, source }) {
  if (!state.account?.username) {
    showToast('Cần đăng nhập để gửi phản hồi cho FINCHI.');
    return;
  }
  const context = buildCorrectionContext(level, question, feedbackType, explanation);
  if (!context.questionId) {
    showToast('FINCHI chưa có đủ ngữ cảnh câu hỏi để kiểm chứng lại.');
    return;
  }
  let payload;
  try {
    payload = await postForm('/api/ai/correction-feedback', {
      username: state.account.username,
      parentId: source === 'parent' ? (state.account.parentName || state.account.username) : '',
      lessonId: context.lessonId,
      missionId: context.missionId,
      questionId: context.questionId,
      studentAnswer: context.studentAnswer,
      studentExplanation: context.studentExplanation,
      aiOriginalFeedback: context.aiOriginalFeedback,
      aiOriginalDecision: context.aiOriginalDecision,
      feedbackType: context.feedbackType,
      currentLesson: context.currentLesson,
      questionPrompt: context.questionPrompt,
      skillTag: context.skillTag
    });
  } catch (error) {
    showToast(error.message);
    return;
  }

  addCorrectionFeedbackHistory({
    id: payload.feedbackId,
    status: payload.status,
    feedbackType,
    explanation,
    questionId: context.questionId,
    questionPrompt: context.questionPrompt,
    createdAt: new Date().toISOString()
  });
  if (payload.learningMemoryEntry) addLearningMemoryEntry(payload.learningMemoryEntry);

  const correctionResponse = {
    title: payload.responseTitle || 'FINCHI đang kiểm chứng lại',
    message: payload.responseMessage || 'Cảm ơn con đã giải thích. FINCHI sẽ xem lại lựa chọn này nhé.',
    characterState: payload.characterState || 'parent_summary',
    shouldSpeak: Boolean(payload.shouldSpeak),
    voiceType: payload.voiceType || 'correction',
    nextAction: 'continue',
    safetyStatus: 'safe'
  };
  storeAiResponse(source === 'parent' ? 'parent' : 'student', correctionResponse, { shouldPersist: false });

  if (payload.verification?.shouldUpdateAttempt && level && question) {
    const rewardDelta = Number(payload.rewardDelta ?? state.lastMissionAttempt?.rewardIfCorrect ?? 0);
    applyApprovedCorrection(payload, level, question);
    if (state.screen === 'quiz' || state.screen === 'result') {
      renderAnswerResult(question, level, true, rewardDelta, 'FINCHI đã ghi nhận rằng lựa chọn của con hợp lý sau khi kiểm chứng lại.');
    }
  } else if (payload.status === 'needs_human_review') {
    showToast('FINCHI đã đưa trường hợp này vào hàng chờ duyệt để xem kỹ hơn.');
  } else {
    showToast(formatCorrectionStatusLabel(payload.status));
  }

  savePlayer();
  if (state.screen === 'profile') renderProfile();
  if (state.screen === 'parent') renderParentDashboard();
  if (state.screen === 'aiReview') {
    await ensureAdminCorrectionQueue(true);
    renderAiReviewDashboard();
  }
}

async function ensureLearningMemoryLoaded(force = false) {
  if (!state.account?.username || state.learningMemory.loading) return state.learningMemory.items;
  if (!force && state.learningMemory.items.length && Date.now() - state.learningMemory.lastLoadedAt < 15000) {
    return state.learningMemory.items;
  }
  state.learningMemory.loading = true;
  try {
    const payload = await fetchJson(`/api/student/${encodeURIComponent(state.account.username)}/learning-memory`, {
      ttlMs: API_CACHE_TTL_MS,
      cacheKey: `learning-memory:${state.account.username}`,
      force
    });
    state.learningMemory.items = Array.isArray(payload.items) ? payload.items : [];
    state.learningMemory.lastLoadedAt = Date.now();
    state.player.aiCorrection.learningMemory = [...state.learningMemory.items];
  } catch {
    state.learningMemory.items = [...(state.player.aiCorrection.learningMemory || [])];
    state.learningMemory.lastLoadedAt = Date.now();
  } finally {
    state.learningMemory.loading = false;
  }
  return state.learningMemory.items;
}

function renderLearningMemoryCards(limit = 4) {
  const items = (state.learningMemory.items.length ? state.learningMemory.items : state.player.aiCorrection.learningMemory || []).slice(0, limit);
  if (!items.length) return '<div class="empty-state">FINCHI chưa có ghi nhớ học tập nào đã được kiểm chứng cho bé.</div>';
  return `<div class="history-list">${items.map(item => `
    <div class="history-item">
      <div class="history-icon">🧠</div>
      <div>
        <strong>${escapeHtml(item.skillTag || item.memoryType || 'Ghi nhớ học tập')}</strong>
        <div class="subtitle">${escapeHtml(item.content || '')}</div>
      </div>
      <small>${escapeHtml(item.confidence ? `${Math.round(item.confidence * 100)}%` : formatHistoryTime(item.createdAt))}</small>
    </div>
  `).join('')}</div>`;
}

async function ensureAdminCorrectionQueue(force = false) {
  if (state.adminReview.loading) return state.adminReview.items;
  if (!force && state.adminReview.items.length && Date.now() - state.adminReview.lastLoadedAt < 15000) {
    return state.adminReview.items;
  }
  state.adminReview.loading = true;
  try {
    const payload = await fetchJson('/api/admin/correction-feedback', {
      ttlMs: API_CACHE_TTL_MS,
      cacheKey: 'admin-correction-queue',
      force
    });
    state.adminReview.items = Array.isArray(payload.items) ? payload.items : [];
    state.adminReview.lastLoadedAt = Date.now();
    if (!state.adminReview.selectedId && state.adminReview.items[0]?.id) {
      state.adminReview.selectedId = state.adminReview.items[0].id;
    }
  } catch {
    state.adminReview.items = [];
    state.adminReview.lastLoadedAt = Date.now();
  } finally {
    state.adminReview.loading = false;
  }
  return state.adminReview.items;
}

async function ensureAdminCorrectionDetail(id, force = false) {
  if (!id) return null;
  if (!force && state.adminReview.detail?.id === id) return state.adminReview.detail;
  try {
    const payload = await fetchJson(`/api/admin/correction-feedback/${encodeURIComponent(id)}`, {
      ttlMs: API_CACHE_TTL_MS,
      cacheKey: `admin-correction-detail:${id}`,
      force
    });
    state.adminReview.detail = payload.item || null;
    state.adminReview.selectedId = id;
  } catch {
    state.adminReview.detail = null;
  }
  return state.adminReview.detail;
}

async function runAdminCorrectionAction(action, id, patchId = '') {
  if (!id) return;
  try {
    if (action === 'apply-patch') {
      await postForm(`/api/admin/rubric-patches/${encodeURIComponent(patchId)}/apply`, { feedbackId: id });
      showToast('Đã áp dụng rubric patch.');
    } else {
      await postForm(`/api/admin/correction-feedback/${encodeURIComponent(id)}/${action}`, {});
      showToast(action === 'approve' ? 'Đã duyệt bé đúng.' : 'Đã từ chối phản hồi này.');
    }
    await ensureLearningMemoryLoaded(true);
    await ensureAdminCorrectionQueue(true);
    await ensureAdminCorrectionDetail(id, true);
    renderAiReviewDashboard();
  } catch (error) {
    showToast(error.message);
  }
}

function renderAiReviewDashboard() {
  if (state.account?.role !== 'parent') {
    return shell(`
      <div class="social-panel">
        <div class="card main-panel">
          <span class="badge">AI Review</span>
          <h1 class="section-title">Màn này chỉ mở cho phiên phụ huynh/admin</h1>
          <p class="section-subtitle">Hãy đăng nhập tab phụ huynh để xem hàng chờ correction feedback và duyệt các trường hợp AI chấm chưa chính xác.</p>
        </div>
      </div>
    `);
  }

  const items = state.adminReview.items || [];
  const detail = state.adminReview.detail;
  shell(`
    <div class="social-panel">
      <div class="panel-toolbar">
        <div>
          <span class="badge">AI Correction Review</span>
          <h1 class="section-title">Hàng chờ duyệt phản hồi khi AI chấm chưa chính xác</h1>
          <p class="section-subtitle">MVP này cho phép phụ huynh/admin xem feedback, kết quả verifier, learning memory và rubric patch trước khi chấp nhận ghi nhớ lâu dài.</p>
        </div>
        <div class="inline-actions">
          <button class="btn-secondary" id="refresh-ai-review">Làm mới queue</button>
        </div>
      </div>
      <div class="profile-grid">
        <section class="card">
          <h2 class="section-title" style="font-size:1.55rem;">Danh sách feedback</h2>
          ${items.length ? `<div class="history-list">${items.map(item => `
            <button class="history-item correction-row ${state.adminReview.selectedId === item.id ? 'is-active' : ''}" type="button" data-review-id="${item.id}">
              <div class="history-icon">${item.status === 'needs_human_review' ? '🟠' : item.status === 'auto_verified_correct' ? '🟢' : '🔵'}</div>
              <div>
                <strong>${escapeHtml(item.studentId || 'Học sinh')}</strong>
                <div class="subtitle">${escapeHtml(item.questionPrompt || item.questionId || 'Feedback AI')}</div>
                <div class="subtitle">${escapeHtml(formatCorrectionStatusLabel(item.status))} · ${escapeHtml(formatVerificationResultLabel(item.verificationResult))}</div>
              </div>
              <small>${escapeHtml(formatHistoryTime(item.createdAt))}</small>
            </button>
          `).join('')}</div>` : '<div class="empty-state">Chưa có correction feedback nào được gửi lên.</div>'}
        </section>
        <section class="card">
          <h2 class="section-title" style="font-size:1.55rem;">Chi tiết review</h2>
          ${detail ? `
            <div class="history-list">
              <div class="history-item"><div class="history-icon">❓</div><div><strong>Câu hỏi</strong><div class="subtitle">${escapeHtml(detail.questionPrompt || detail.questionId || '')}</div></div><small>${escapeHtml(detail.lessonId || '')}</small></div>
              <div class="history-item"><div class="history-icon">🧒</div><div><strong>Đáp án và lời giải của bé</strong><div class="subtitle">${escapeHtml(detail.studentAnswer || '')} · ${escapeHtml(detail.studentExplanation || '')}</div></div><small>${escapeHtml(detail.feedbackType || '')}</small></div>
              <div class="history-item"><div class="history-icon">🤖</div><div><strong>Phản hồi AI ban đầu</strong><div class="subtitle">${escapeHtml(detail.aiOriginalFeedback || '')}</div></div><small>${escapeHtml(detail.aiOriginalDecision || '')}</small></div>
              <div class="history-item"><div class="history-icon">🧪</div><div><strong>Verifier</strong><div class="subtitle">${escapeHtml(detail.verificationReason || 'Chưa có lý do kiểm chứng.')}</div></div><small>${escapeHtml(`${formatVerificationResultLabel(detail.verificationResult)} · ${Math.round(Number(detail.confidenceScore || 0) * 100)}%`)}</small></div>
              ${detail.rubricPatch ? `<div class="history-item"><div class="history-icon">🧩</div><div><strong>Rubric patch</strong><div class="subtitle">${escapeHtml(detail.rubricPatch.reason || '')}</div></div><small>${escapeHtml(detail.rubricPatch.status || 'draft')}</small></div>` : ''}
            </div>
            <div class="inline-actions" style="margin-top:16px;">
              <button class="btn-primary" id="approve-correction">Approve as correct</button>
              <button class="btn-secondary" id="reject-correction">Reject</button>
              ${detail.rubricPatch?.id ? '<button class="btn-ghost" id="apply-rubric-patch">Apply rubric patch</button>' : ''}
            </div>
          ` : '<div class="empty-state">Chọn một feedback bên trái để xem chi tiết.</div>'}
        </section>
      </div>
    </div>
  `);

  document.getElementById('refresh-ai-review')?.addEventListener('click', async () => {
    await ensureAdminCorrectionQueue(true);
    if (state.adminReview.selectedId) await ensureAdminCorrectionDetail(state.adminReview.selectedId, true);
    renderAiReviewDashboard();
  });
  document.querySelectorAll('[data-review-id]').forEach(button => {
    button.addEventListener('click', async () => {
      state.adminReview.selectedId = button.dataset.reviewId;
      await ensureAdminCorrectionDetail(button.dataset.reviewId, true);
      renderAiReviewDashboard();
    });
  });
  document.getElementById('approve-correction')?.addEventListener('click', async () => {
    await runAdminCorrectionAction('approve', detail.id);
  });
  document.getElementById('reject-correction')?.addEventListener('click', async () => {
    await runAdminCorrectionAction('reject', detail.id);
  });
  document.getElementById('apply-rubric-patch')?.addEventListener('click', async () => {
    await runAdminCorrectionAction('apply-patch', detail.id, detail.rubricPatch.id);
  });

  if (!items.length && !state.adminReview.loading && !state.adminReview.lastLoadedAt) {
    ensureAdminCorrectionQueue(true).then(async () => {
      if (state.adminReview.selectedId) await ensureAdminCorrectionDetail(state.adminReview.selectedId, true);
      if (state.screen === 'aiReview') renderAiReviewDashboard();
    }).catch(() => {});
  } else if (state.adminReview.selectedId && !detail) {
    ensureAdminCorrectionDetail(state.adminReview.selectedId, true).then(() => {
      if (state.screen === 'aiReview') renderAiReviewDashboard();
    }).catch(() => {});
  }
}

function buildDailyMysteryBox(dayNumber) {
  const safeDay = Math.max(1, Math.min(30, Number(dayNumber || 1)));
  const theme = MYSTERY_BOX_THEMES[(safeDay - 1) % MYSTERY_BOX_THEMES.length];
  const amount = MYSTERY_BOX_REWARD_PATTERN[safeDay - 1] || 1000;
  return {
    day: safeDay,
    claimedAt: todayKey(),
    name: theme.name,
    icon: theme.icon,
    message: theme.message,
    amount
  };
}

function maybeClaimDailyMysteryBox() {
  if (!state.account?.username || state.account.role === 'parent') return null;
  if (!state.player.dailyCheckin) state.player.dailyCheckin = createDefaultCheckinState();
  if (state.player.dailyCheckin.lastClaimDate === todayKey()) return null;
  if (Number(state.player.dailyCheckin.totalClaims || 0) >= 30) return null;

  const lastClaimDate = state.player.dailyCheckin.lastClaimDate;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = todayKey(yesterday);
  state.player.dailyCheckin.streak = lastClaimDate === yesterdayKey ? Number(state.player.dailyCheckin.streak || 0) + 1 : 1;

  const nextDay = Number(state.player.dailyCheckin.totalClaims || 0) + 1;
  const box = buildDailyMysteryBox(nextDay);
  state.player.dailyCheckin.lastClaimDate = todayKey();
  state.player.dailyCheckin.totalClaims = nextDay;
  state.player.dailyCheckin.history = [box, ...(state.player.dailyCheckin.history || [])].slice(0, 30);
  state.player.totalMoney += box.amount;
  state.pendingMysteryBox = box;
  awardScore(5, `Điểm danh Mystery Box ngày ${nextDay}`);
  savePlayer();
  return box;
}

function showPendingMysteryBoxIfNeeded() {
  const box = state.pendingMysteryBox;
  if (!box || !document.body) return;
  state.pendingMysteryBox = null;
  const overlay = document.createElement('div');
  overlay.className = 'mystery-box-overlay';
  overlay.innerHTML = `
    <div class="mystery-box-modal">
      <div class="mystery-box-icon">${box.icon}</div>
      <strong>${escapeHtml(box.name)}</strong>
      <p>${escapeHtml(box.message)}</p>
      <div class="mystery-box-amount">+${formatMoney(box.amount)}</div>
      <small>Điểm danh ngày ${box.day}/30</small>
      <div class="inline-actions" style="justify-content:center; margin-top:16px;">
        <button class="btn-primary" type="button">Mở phong bao</button>
      </div>
    </div>
  `;
  overlay.querySelector('button')?.addEventListener('click', () => {
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 250);
  });
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));
}

function getMysteryBoxProgressLabel() {
  const total = Number(state.player?.dailyCheckin?.totalClaims || 0);
  if (total >= 30) return 'Đã nhận đủ 30 hộp Mystery Box.';
  return `Đã điểm danh ${total}/30 ngày nhận quà.`;
}

function getLatestMysteryBox() {
  return state.player?.dailyCheckin?.history?.[0] || null;
}

function slugifyClanName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

function normalizePlayer() {
  const today = todayKey();
  const currentWeek = weekKey();
  const currentMonth = monthKey();
  if (!state.player) {
    state.player = createDefaultPlayer();
  }

  if (state.player.lastPlayDate !== today) {
    state.player.dailyVideoCount = 0;
    state.player.dailyTaskCount = 0;
    state.player.lastPlayDate = today;
  }

  if (!Array.isArray(state.player.unlockedLevels) || state.player.unlockedLevels.length === 0) state.player.unlockedLevels = [1];
  if (!Array.isArray(state.player.completedLevels)) state.player.completedLevels = [];
  if (state.player.unlockRuleVersion !== 2) {
    const recalculated = new Set([1]);
    state.player.completedLevels.forEach(levelId => {
      recalculated.add(levelId);
      if (levelId < state.levels.length) recalculated.add(levelId + 1);
    });
    state.player.unlockedLevels = [...recalculated].sort((a, b) => a - b);
    state.player.unlockRuleVersion = 2;
  }
  if (!Array.isArray(state.player.savingMilestonesClaimed)) state.player.savingMilestonesClaimed = [];
  if (!Array.isArray(state.player.ownedRewardItems)) state.player.ownedRewardItems = [];
  if (!Array.isArray(state.player.watchedLessonScoreClaimed)) state.player.watchedLessonScoreClaimed = [];
  if (!Array.isArray(state.player.rankHistory)) state.player.rankHistory = [];
  if (!Array.isArray(state.player.seasonRewards)) state.player.seasonRewards = [];
  if (!Array.isArray(state.player.earnedBadgeIds)) state.player.earnedBadgeIds = [];
  if (!Array.isArray(state.player.dreamJournal)) state.player.dreamJournal = [];
  if (!state.player.dailyCheckin || typeof state.player.dailyCheckin !== 'object') state.player.dailyCheckin = createDefaultCheckinState();
  if (!Array.isArray(state.player.dailyCheckin.history)) state.player.dailyCheckin.history = [];
  if (!state.player.parentAccess || typeof state.player.parentAccess !== 'object') state.player.parentAccess = { linked: false, parentName: '' };
  ensureAiPlayerState();
  if (!state.player.aiCorrection || typeof state.player.aiCorrection !== 'object') {
    state.player.aiCorrection = { feedbackHistory: [], approvedQuestionIds: [], learningMemory: [] };
  }
  if (!Array.isArray(state.player.aiCorrection.feedbackHistory)) state.player.aiCorrection.feedbackHistory = [];
  if (!Array.isArray(state.player.aiCorrection.approvedQuestionIds)) state.player.aiCorrection.approvedQuestionIds = [];
  if (!Array.isArray(state.player.aiCorrection.learningMemory)) state.player.aiCorrection.learningMemory = [];
  if (!state.player.certificate || typeof state.player.certificate !== 'object') state.player.certificate = { unlockedAt: '', printedAt: '' };
  if (!state.player.analytics || typeof state.player.analytics !== 'object') {
    state.player.analytics = { totalStudySeconds: 0, totalQuestions: 0, totalCorrect: 0, daily: {} };
  }
  if (!state.player.analytics.daily || typeof state.player.analytics.daily !== 'object') state.player.analytics.daily = {};

  if (!state.player.scoreBuckets) {
    state.player.scoreBuckets = {
      dayKey: today,
      weekKey: currentWeek,
      monthKey: currentMonth,
      daily: 0,
      weekly: 0,
      monthly: 0,
      tournamentWeekly: 0
    };
  }

  if (state.player.scoreBuckets.dayKey !== today) {
    state.player.scoreBuckets.dayKey = today;
    state.player.scoreBuckets.daily = 0;
    state.player.watchedLessonScoreClaimed = [];
  }
  if (state.player.scoreBuckets.weekKey !== currentWeek) {
    state.player.scoreBuckets.weekKey = currentWeek;
    state.player.scoreBuckets.weekly = 0;
    state.player.scoreBuckets.tournamentWeekly = 0;
  }
  if (state.player.scoreBuckets.monthKey !== currentMonth) {
    state.player.scoreBuckets.monthKey = currentMonth;
    state.player.scoreBuckets.monthly = 0;
    state.player.lastMonthlyBoardScoreMonth = '';
  }

  state.player.finchiScore = Number(state.player.finchiScore || 0);
  state.player.dailyTaskCount = Number(state.player.dailyTaskCount || 0);
  state.player.dailyVideoCount = Number(state.player.dailyVideoCount || 0);
  state.player.totalMoney = Number(state.player.totalMoney || 0);
  state.player.savingStreak = Number(state.player.savingStreak || 0);
  state.player.dailyCheckin.totalClaims = Number(state.player.dailyCheckin.totalClaims || 0);
  state.player.dailyCheckin.streak = Number(state.player.dailyCheckin.streak || 0);
  ensureTodayAnalyticsBucket();

  Object.values(LEVEL_BADGES).forEach(badge => {
    if (state.player.completedLevels.includes(badge.levelId) && !state.player.earnedBadgeIds.includes(badge.id)) {
      state.player.earnedBadgeIds.push(badge.id);
    }
  });
}

function loadPlayer() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state.player = raw ? JSON.parse(raw) : null;
  } catch {
    state.player = null;
  }
  normalizePlayer();
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    state.account = raw ? JSON.parse(raw) : null;
  } catch {
    state.account = null;
  }
}

function saveSession() {
  if (state.account) localStorage.setItem(SESSION_KEY, JSON.stringify(state.account));
  else localStorage.removeItem(SESSION_KEY);
}

async function postForm(url, data) {
  const body = new URLSearchParams(data).toString();
  const response = await timedFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body
  }, { label: `POST ${url}` });
  const payload = await response.json().catch(() => ({ ok: false, message: 'Máy chủ trả về dữ liệu không hợp lệ.' }));
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.message || 'Yêu cầu chưa thành công.');
  }
  return payload;
}

async function loadRemotePlayer(username) {
  const payload = await fetchJson(`/api/player/load?username=${encodeURIComponent(username)}`, {
    ttlMs: API_CACHE_TTL_MS,
    cacheKey: `player-load:${username}`,
    force: true
  });
  state.account = { ...(state.account || {}), username: payload.username };
  saveSession();
  state.player = payload.player || null;
  normalizePlayer();
  resetAiRuntimeState();
  if (!state.player.name && payload.nickname) state.player.name = payload.nickname;
  if (payload.avatarId && !state.player.avatarId) state.player.avatarId = payload.avatarId;
  state.player.parentAccess.parentName = payload.parentName || state.player.parentAccess.parentName || '';
  state.player.parentAccess.linked = Boolean(payload.parentLinked || state.player.parentAccess.linked);
  savePlayerLocal();
  return payload;
}

function savePlayerLocal() {
  if (!state.player) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.player));
}

function savePlayer() {
  savePlayerLocal();
  scheduleRemoteSave();
}

async function savePlayerNow() {
  flushStudySession();
  savePlayerLocal();
  if (!state.account?.username) return;
  const todayStats = getTodayStudyStats();
  const weakestSkill = getWeakestSkillInsight();
  const weakestLevel = getWeakestLevelInsight();
  const aiState = ensureAiPlayerState();
  const payload = {
    username: state.account.username,
    playerJson: JSON.stringify(state.player),
    nickname: state.player.name || state.account.username,
    avatarId: state.player.avatarId || avatars[0].id,
    dailyScore: String(state.player.scoreBuckets?.daily || 0),
    weeklyScore: String(state.player.scoreBuckets?.weekly || 0),
    monthlyScore: String(state.player.scoreBuckets?.monthly || 0),
    tournamentWeekly: String(state.player.scoreBuckets?.tournamentWeekly || 0),
    totalScore: String(state.player.finchiScore || 0),
    completedLevelsCount: String(state.player.completedLevels?.length || 0),
    savingStreak: String(state.player.savingStreak || 0),
    clanId: state.player.clan?.id || '',
    clanName: state.player.clan?.name || '',
    clanFocus: state.player.clan?.focus || '',
    clanDescription: state.player.clan?.description || '',
    todayStudySeconds: String(todayStats.studySeconds || 0),
    todayQuestions: String(todayStats.questions || 0),
    todayCorrect: String(todayStats.correct || 0),
    weakSkill: weakestSkill?.title || '',
    weakLevel: weakestLevel?.title || '',
    childProgressStatus: buildSupportStatus(),
    aiVoiceEnabled: String(Boolean(aiState.settings.voiceEnabled)),
    aiCorrectStreak: String(aiState.correctStreak || 0),
    aiInterventionCount: String(aiState.interventionHistory?.length || 0)
  };
  await postForm('/api/player/save', payload);
  refreshRankings(true).then(() => {
    if (state.screen === 'leaderboard') renderLeaderboard();
    if (state.screen === 'tournament') renderTournament();
  }).catch(() => {});
  if (state.screen === 'leaderboard') renderLeaderboard();
  if (state.screen === 'tournament') renderTournament();
  if (state.screen === 'clans') {
    refreshClans(true).then(() => renderClans()).catch(() => {});
  }
  startStudySession();
}

function scheduleRemoteSave() {
  if (!state.account?.username) return;
  clearTimeout(state.remoteSaveTimer);
  state.remoteSaveTimer = setTimeout(() => {
    savePlayerNow().catch(() => {});
  }, 350);
}

async function refreshRankings(force = false) {
  const modes = ['daily', 'weekly', 'monthly', 'tournament'];
  const results = await Promise.all(modes.map(async mode => {
    try {
      const payload = await fetchJson(`/api/leaderboard?mode=${mode}`, {
        ttlMs: API_CACHE_TTL_MS,
        cacheKey: `leaderboard:${mode}`,
        force
      });
      return [mode, payload.entries || []];
    } catch {
      return [mode, []];
    }
  }));
  state.serverLeaderboards = Object.fromEntries(results);
}

function logoutAccount() {
  flushStudySession();
  aiModule?.stopSpeaking?.();
  state.account = null;
  saveSession();
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem('finchi-watched-levels');
  state.player = null;
  normalizePlayer();
  resetAiRuntimeState();
  state.navHistory = [];
  state.screen = 'welcome';
  state.pendingMysteryBox = null;
  render();
  showToast('Đã đăng xuất khỏi tài khoản Finchi.');
}
async function fetchJson(path, options = {}) {
  const ttlMs = Number(options.ttlMs || 0);
  const persistent = Boolean(options.persistent);
  const cacheKey = options.cacheKey || path;
  if (!options.force && ttlMs > 0) {
    const cached = readCachedValue(persistent ? 'json-persistent' : 'json-memory', cacheKey, ttlMs, persistent);
    if (cached !== undefined) return cached;
  }
  const response = await timedFetch(path, {}, { label: `GET ${path}` });
  if (!response.ok) throw new Error(`Không tải được ${path}`);
  const payload = await response.json();
  if (ttlMs > 0) {
    writeCachedValue(persistent ? 'json-persistent' : 'json-memory', cacheKey, payload, persistent);
  }
  return payload;
}

async function init() {
  runBootProgressSequence();
  try {
    [state.config, state.levels, state.shopItems, state.tournaments] = await Promise.all([
      fetchJson('/data/game-config.json', { ttlMs: STATIC_DATA_TTL_MS, cacheKey: 'game-config', persistent: true }),
      fetchJson('/data/levels.json', { ttlMs: STATIC_DATA_TTL_MS, cacheKey: 'levels', persistent: true }),
      fetchJson('/data/shop.json', { ttlMs: STATIC_DATA_TTL_MS, cacheKey: 'shop', persistent: true }),
      fetchJson('/data/tournaments.json', { ttlMs: STATIC_DATA_TTL_MS, cacheKey: 'tournaments', persistent: true })
    ]);
    setBootProgress(92, 'Đang hoàn thiện những chi tiết cuối cùng...');
    loadSession();
    loadPlayer();
    if (state.account?.username) {
      try {
        await loadRemotePlayer(state.account.username);
      } catch {
        state.account = null;
        saveSession();
      }
    }
    assignLevelScenes();
    resetMoneyBoard();
    maybeClaimDailyMysteryBox();
    state.screen = state.account?.username
      ? (state.account.role === 'parent'
        ? 'parent'
        : (state.player.name ? (state.player.watchedIntro ? 'map' : 'intro') : 'character'))
      : 'welcome';
    render();
    refreshRankings(true).then(() => {
      if (['leaderboard', 'tournament', 'profile', 'map', 'parent'].includes(state.screen)) render();
    }).catch(() => {});
    scheduleBackgroundTask(() => ensureAiModuleLoaded('idle').catch(() => {}), 50);
    startStudySession();
    showPendingMysteryBoxIfNeeded();
    await finishBootSplash();
  } catch (error) {
    app.innerHTML = `<div class="screen"><div class="card main-panel"><h1>Không tải được Finchi</h1><p>${error.message}</p></div></div>`;
    setBootProgress(100, 'Finchi chưa thể khởi động trọn vẹn.');
    await finishBootSplash();
  }
}


function getNavigationSnapshot() {
  return {
    screen: state.screen,
    currentLevelId: state.currentLevelId,
    currentQuestionIndex: state.currentQuestionIndex,
    leaderboardTab: state.leaderboardTab,
    tournamentTab: state.tournamentTab
  };
}

function goTo(screen, extra = {}) {
  const { _skipHistory = false, ...payload } = extra;
  flushStudySession();
  clearAiIdleWatch();
  if (!_skipHistory && state.screen && state.screen !== screen) {
    state.navHistory.push(getNavigationSnapshot());
    if (state.navHistory.length > 12) state.navHistory.shift();
  }
  state.screen = screen;
  if (screen !== 'quiz') {
    state.selectedAnswer = null;
    state.selectedDragItemId = null;
    if (screen !== 'result') state.lastQuestionSummary = '';
  }
  Object.assign(state, payload);
  render();
  startStudySession(screen);
  showPendingMysteryBoxIfNeeded();
}

function goBack() {
  const previous = state.navHistory.pop();
  flushStudySession();
  clearAiIdleWatch();
  if (!previous) {
    goTo('welcome', { _skipHistory: true });
    return;
  }
  state.screen = previous.screen;
  state.currentLevelId = previous.currentLevelId;
  state.currentQuestionIndex = previous.currentQuestionIndex;
  state.leaderboardTab = previous.leaderboardTab || 'daily';
  state.tournamentTab = previous.tournamentTab || 'weekly';
  state.selectedAnswer = null;
  state.selectedDragItemId = null;
  render();
  startStudySession(state.screen);
}

function assignLevelScenes() {
  state.levelSceneAssignments = state.levels.map((level, index) => LEVEL_SCENES[index % LEVEL_SCENES.length]);
}

function getLevelScene(levelId = 1) {
  return state.levelSceneAssignments[levelId - 1] || LEVEL_SCENES[(levelId - 1) % LEVEL_SCENES.length];
}

function getQuestionVisual(question, level) {
  const scene = getLevelScene(level?.id || 1);
  const prompt = (question?.prompt || '').toLowerCase();
  let emoji = '❓';
  let themeClass = 'theme-think';
  let label = 'Khám phá';
  if (question?.type === 'drag_classify' || prompt.includes('phân loại') || prompt.includes('ghép')) {
    emoji = '🧩';
    themeClass = 'theme-sort';
    label = 'Kéo thả';
  } else if (prompt.includes('tiền') || prompt.includes('đồng') || prompt.includes('mệnh giá')) {
    emoji = '💵';
    themeClass = 'theme-money';
    label = 'Tiền Việt';
  } else if (prompt.includes('tiết kiệm') || prompt.includes('heo đất')) {
    emoji = '🐷';
    themeClass = 'theme-save';
    label = 'Tiết kiệm';
  } else if (prompt.includes('cần') || prompt.includes('muốn')) {
    emoji = '🛍️';
    themeClass = 'theme-choice';
    label = 'Chọn lọc';
  } else if (prompt.includes('mục tiêu') || prompt.includes('ước mơ')) {
    emoji = '🎯';
    themeClass = 'theme-goal';
    label = 'Mục tiêu';
  } else if (prompt.includes('an toàn') || prompt.includes('mật khẩu') || prompt.includes('otp') || prompt.includes('link')) {
    emoji = '🛡️';
    themeClass = 'theme-safe';
    label = 'An toàn';
  } else if (prompt.includes('chia sẻ') || prompt.includes('giúp')) {
    emoji = '💖';
    themeClass = 'theme-share';
    label = 'Sẻ chia';
  }
  const illustration = question?.type === 'drag_classify' || prompt.includes('phân loại') || prompt.includes('ghép') ? QUESTION_ART.idea : QUESTION_ART.thinking;
  return { scene, emoji, illustration, themeClass, label };
}

function getCurrentLevel() {
  return state.levels.find(level => level.id === state.currentLevelId);
}

function getLevelUnlockRequirement(level) {
  if (!level) return 9;
  const totalQuestions = Array.isArray(level.questions) ? level.questions.length : 10;
  return Math.min(level.unlockRequirement || 9, totalQuestions);
}

function getCurrentQuestion() {
  const level = getCurrentLevel();
  return level ? level.questions[state.currentQuestionIndex] : null;
}

function getQuizTrailStops(level) {
  const total = Math.max(1, level?.questions?.length || 1);
  const xPattern = [18, 78, 28, 72, 22, 80, 32, 68, 24, 76, 30, 70];
  const topOffset = 54;
  const verticalGap = total > 1 ? 82 : 0;
  return Array.from({ length: total }, (_, index) => ({
    index,
    x: xPattern[index % xPattern.length],
    y: topOffset + index * verticalGap,
    side: xPattern[index % xPattern.length] < 50 ? 'left' : 'right'
  }));
}

function buildQuizTrailPath(stops) {
  if (!stops.length) return '';
  let d = `M ${stops[0].x} ${stops[0].y}`;
  for (let i = 1; i < stops.length; i += 1) {
    const prev = stops[i - 1];
    const curr = stops[i];
    const midY = (prev.y + curr.y) / 2;
    d += ` C ${prev.x} ${midY}, ${curr.x} ${midY}, ${curr.x} ${curr.y}`;
  }
  return d;
}

function getQuizRunnerPosition(stops, index = 0) {
  const safeIndex = Math.max(0, Math.min(index, Math.max(0, stops.length - 1)));
  const stop = stops[safeIndex] || { x: 18, y: 54, side: 'left' };
  const sideShift = stop.side === 'left' ? -6 : 6;
  return {
    x: Math.max(10, Math.min(90, stop.x + sideShift)),
    y: Math.max(34, stop.y - 8)
  };
}

function animateQuizRunnerIfNeeded() {
  const runner = document.querySelector('.quiz-finchi-runner');
  if (!runner) return;
  const fromX = runner.dataset.fromX;
  const fromY = runner.dataset.fromY;
  const toX = runner.dataset.toX;
  const toY = runner.dataset.toY;
  const shouldAnimate = runner.dataset.animate === 'true';
  if (!toX || !toY) return;
  if (shouldAnimate && fromX && fromY) {
    runner.style.left = `${fromX}%`;
    runner.style.top = `${fromY}px`;
    runner.classList.add('is-travelling');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        runner.style.left = `${toX}%`;
        runner.style.top = `${toY}px`;
      });
    });
    const clearTravel = () => runner.classList.remove('is-travelling');
    runner.addEventListener('transitionend', clearTravel, { once: true });
  } else {
    runner.style.left = `${toX}%`;
    runner.style.top = `${toY}px`;
  }
  state.quizPathMotion = { fromIndex: state.currentQuestionIndex, toIndex: state.currentQuestionIndex, animate: false };
}

function renderQuizJourney(level, currentIndex) {
  const stops = getQuizTrailStops(level);
  const pathD = buildQuizTrailPath(stops);
  const total = level?.questions?.length || 0;
  const current = Math.min(currentIndex, Math.max(0, total - 1));
  const currentProgress = total > 1 ? (stops[current]?.y || 54) : 54;
  const motion = state.quizPathMotion || { fromIndex: current, toIndex: current, animate: false };
  const fromPos = getQuizRunnerPosition(stops, motion.fromIndex ?? current);
  const toPos = getQuizRunnerPosition(stops, motion.toIndex ?? current);
  const stopHtml = (level.questions || []).map((item, index) => {
    const stop = stops[index];
    const status = index < currentIndex ? 'done' : (index === currentIndex ? 'current' : 'upcoming');
    const visual = getQuestionVisual(item, level);
    const shortTitle = item.prompt.length > 34 ? `${item.prompt.slice(0, 31)}...` : item.prompt;
    return `
      <button class="quiz-trail-stop ${status} ${stop.side} ${visual.themeClass}" style="left:${stop.x}%; top:${stop.y}px;" type="button" disabled>
        <span class="quiz-trail-badge">${index + 1}</span>
        <span class="quiz-trail-icon" aria-hidden="true">${status === 'done' ? '⭐' : visual.emoji}</span>
        <span class="quiz-trail-text">
          <strong>Trạm ${index + 1}</strong>
          <small>${escapeHtml(shortTitle)}</small>
        </span>
        <span class="quiz-trail-tag">${escapeHtml(visual.label)}</span>
      </button>
    `;
  }).join('');
  return `
    <section class="quiz-journey-section">
      <div class="quiz-journey-head">
        <div>
          <span class="badge">Hành trình mini của level ${level.id}</span>
          <h2 class="quiz-journey-title">Con đường nhiệm vụ quanh đảo ${escapeHtml(getLevelScene(level.id).title)}</h2>
        </div>
        <div class="quiz-journey-summary">
          <span>Đang ở trạm <strong>${current + 1}/${total}</strong></span>
          <span>${currentIndex} trạm đã hoàn thành</span>
        </div>
      </div>
      <div class="quiz-journey-board" style="--quiz-road-height:${Math.max(260, (stops[stops.length - 1]?.y || 54) + 64)}px; --quiz-road-progress:${currentProgress}px; --quiz-road-progress-x:${stops[current]?.x || 18}%;">
        <svg class="quiz-journey-svg" viewBox="0 0 100 ${Math.max(180, (stops[stops.length - 1]?.y || 54) + 54)}" preserveAspectRatio="none" aria-hidden="true">
          <path class="quiz-journey-shadow" d="${pathD}" />
          <path class="quiz-journey-main" d="${pathD}" />
          <path class="quiz-journey-progress-line" d="${pathD}" pathLength="100" style="--trail-progress:${total > 1 ? ((current) / (total - 1)) * 100 : 100};" />
        </svg>
        <div class="quiz-finchi-runner" data-animate="${motion.animate ? 'true' : 'false'}" data-from-x="${fromPos.x}" data-from-y="${fromPos.y}" data-to-x="${toPos.x}" data-to-y="${toPos.y}" style="left:${fromPos.x}%; top:${fromPos.y}px;">
          <div class="quiz-finchi-dust"></div>
          <img src="/images/avatars/avatar-1.svg" alt="Finchi đang tiến lên">
          <span>Finchi tiến tới trạm ${current + 1}</span>
        </div>
        ${stopHtml}
      </div>
    </section>
  `;
}

function getMilestoneMessage(streak) {
  return state.config.milestoneMessages[String(streak)] || 'Finchi rất tự hào về bạn!';
}

function getMilestoneHint() {
  const nextMilestone = state.config.milestones.find(mark => mark > state.player.savingStreak);
  if (!nextMilestone) return 'Bạn đã chạm đủ các mốc demo. Quá tuyệt!';
  return `Còn ${nextMilestone - state.player.savingStreak} bước nữa để tới mốc ${nextMilestone}.`;
}

function awardLevelBadgeIfNeeded(levelId) {
  const badge = LEVEL_BADGES[levelId];
  if (!badge) return null;
  if (state.player.earnedBadgeIds.includes(badge.id)) return null;
  state.player.earnedBadgeIds.push(badge.id);
  state.lastAwardedBadge = badge;
  awardScore(25, `Nhận badge ${badge.name}`);
  return badge;
}

function createMoneyBankFromBalance(totalMoney) {
  let remaining = Math.max(0, Number(totalMoney || 0));
  const notes = [];
  MONEY_DENOMINATIONS.forEach(denom => {
    const count = Math.floor(remaining / denom.value);
    remaining -= count * denom.value;
    for (let i = 1; i <= count; i += 1) {
      notes.push({
        id: `bank-${denom.value}-${i}` ,
        label: denom.label,
        image: denom.image,
        value: denom.value
      });
    }
  });
  return notes;
}

function getMoneyBoardAllItems() {
  return [
    ...state.moneyBoard.bank,
    ...Object.values(state.moneyBoard.categories).flat()
  ];
}

function getMoneyBoardTotalForCategory(name) {
  return (state.moneyBoard.categories[name] || []).reduce((sum, item) => sum + Number(item.value || 0), 0);
}

function getMoneyBoardSnapshots() {
  const allItems = getMoneyBoardAllItems();
  return MONEY_DENOMINATIONS.map(denom => {
    const count = allItems.filter(item => Number(item.value) === denom.value).length;
    return { ...denom, count, total: count * denom.value };
  }).filter(item => item.count > 0);
}

function ensureMoneyBoardInSync() {
  if (state.moneyBoard.sourceMoney !== Number(state.player.totalMoney || 0)) {
    resetMoneyBoard();
  }
}

function render() {
  const screenTitles = {
    welcome: 'Chào mừng',
    character: 'Chọn nhân vật',
    intro: 'Luật chơi',
    map: 'Bản đồ level',
    lesson: 'Video bài học',
    quiz: 'Nhiệm vụ',
    result: 'Kết quả',
    shop: 'Cửa hàng',
    monthly: 'Sổ chi tiêu',
    leaderboard: 'Bảng xếp hạng',
    tournament: 'Giải đấu',
    profile: 'Hồ sơ người chơi',
    parent: 'Dashboard phụ huynh',
    aiReview: 'Duyệt phản hồi AI',
    clans: 'Clan lớp học',
    dreamJournal: 'Nhật ký ước mơ',
    certificate: 'Chứng chỉ hoàn thành'
  };
  setDocumentTitle(screenTitles[state.screen] || '');
  switch (state.screen) {
    case 'welcome':
      renderWelcome();
      break;
    case 'character':
      renderCharacterSelect();
      break;
    case 'intro':
      renderIntro();
      break;
    case 'map':
      renderMap();
      break;
    case 'lesson':
      renderLesson();
      break;
    case 'quiz':
      renderQuiz();
      break;
    case 'result':
      renderResult();
      break;
    case 'shop':
      renderShop();
      break;
    case 'monthly':
      renderMonthlyBoard();
      break;
    case 'leaderboard':
      renderLeaderboard();
      break;
    case 'tournament':
      renderTournament();
      break;
    case 'profile':
      renderProfile();
      break;
    case 'parent':
      renderParentDashboard();
      break;
    case 'aiReview':
      renderAiReviewDashboard();
      break;
    case 'clans':
      renderClans();
      break;
    case 'dreamJournal':
      renderDreamJournal();
      break;
    case 'certificate':
      renderCertificate();
      break;
    default:
      renderWelcome();
  }
  applyMediaPerformanceHints(app);
  warmAiFeatures(state.screen);
  syncLiveRefreshForScreen();
}

function shell(content) {
  const avatar = avatars.find(item => item.id === state.player.avatarId) || avatars[0];
  const latestMysteryBox = getLatestMysteryBox();
  const isParentSession = state.account?.role === 'parent';
  const aiSidebar = renderAiSidebarCard(isParentSession);
  const fireNodes = state.config.milestones.map(mark => {
    const active = state.player.savingStreak >= mark;
    const celebrate = state.justReachedMilestone === mark;
    return `
      <div class="fire-node ${active ? 'active' : ''} ${celebrate ? 'celebrate' : ''}">
        <div class="flame">🔥</div>
        <span>Mốc ${mark}</span>
      </div>
    `;
  }).join('');

  app.innerHTML = `
    <div class="screen">
      <div class="card topbar">
        <div class="logo-wrap">
          <img src="/images/logo-finchi-game.png" alt="${APP_NAME}" class="brand-logo">
          <div>
            <h1 class="logo-wordmark">${APP_NAME}</h1>
            <p class="subtitle">${APP_SUBTITLE}</p>
          </div>
        </div>
        <div class="info-chip">${state.player.name ? `Nhân vật: <strong>${escapeHtml(state.player.name)}</strong>` : 'Hãy chọn nhân vật đầu tiên của bạn'}</div>
        <div class="info-chip">${state.account?.username ? `${isParentSession ? 'Phụ huynh' : 'Tài khoản'}: <strong>${escapeHtml(isParentSession ? (state.account.parentName || state.account.username) : state.account.username)}</strong>` : 'Chưa đăng nhập'}</div>
        <div class="top-actions">
          <button class="btn-secondary" data-action="go-home">${isParentSession ? 'Dashboard phụ huynh' : 'Trang chủ'}</button>
          <button class="btn-secondary" data-action="go-back" ${state.navHistory.length ? '' : 'disabled'}>⬅ Quay lại</button>
          <button class="btn-secondary" data-action="open-shop">Shop quà học tập</button>
          <button class="btn-secondary" data-action="open-monthly">Sổ chi tiêu tiết kiệm</button>
          <button class="btn-secondary" data-action="open-leaderboard">Bảng xếp hạng</button>
          <button class="btn-secondary" data-action="open-tournament">Giải đấu</button>
          <button class="btn-secondary" data-action="open-clans">Clan / lớp học</button>
          <button class="btn-secondary" data-action="open-journal">Nhật ký ước mơ</button>
          ${isParentSession ? '<button class="btn-secondary" data-action="open-parent">Dashboard phụ huynh</button>' : ''}
          ${isParentSession ? '<button class="btn-secondary" data-action="open-ai-review">AI Review</button>' : ''}
          <button class="btn-secondary" data-action="open-profile">Hồ sơ người chơi</button>
          <button class="btn-ghost" data-action="logout">Đăng xuất</button>
        </div>
      </div>

      <div class="layout-grid">
        <aside class="card sidebar">
          <div class="profile-card">
            <div class="logo-wrap" style="align-items:flex-start;">
              <img src="${avatar.image}" alt="${avatar.name}" style="width:68px;height:68px;">
              <div>
                <strong>${escapeHtml(state.player.name || 'Người chơi mới')}</strong>
                <p class="subtitle">${avatar.name}</p>
              </div>
            </div>
            <div class="inline-actions" style="margin-top:12px;">
              <button class="btn-secondary" data-action="open-profile">Xem hồ sơ thành tích</button>
            </div>
          </div>
          <div class="wallet-card">
            <p class="subtitle">Ví tiền Finchi</p>
            <div class="wallet-total">${formatMoney(state.player.totalMoney)}</div>
            <p class="subtitle">Tiền thưởng mô phỏng dành cho học tập</p>
          </div>
          <div class="limit-card">
            <strong>Nhịp học hôm nay</strong>
            <ul class="helper-list">
              <li>Video bài học: <strong>Không giới hạn</strong></li>
              <li>Mở khóa level: <strong>đúng 9/10 câu</strong></li>
            </ul>
          </div>
          <div class="streak-card">
            <strong>Chuỗi tiết kiệm</strong>
            <div class="wallet-total" style="font-size:1.6rem;">🔥 ${state.player.savingStreak}</div>
            <div class="fire-track">${fireNodes}</div>
            <div class="fire-meter">${getMilestoneHint()}</div>
          </div>
          <div class="wallet-card">
            <strong>Finchi Score</strong>
            <div class="wallet-total" style="font-size:1.7rem;">⭐ ${Number(state.player.finchiScore || 0)}</div>
            <p class="subtitle">Điểm dùng cho bảng xếp hạng ngày, tuần và tháng.</p>
            <div class="helper-list" style="margin-top:10px;">
              <div>Ngày: <strong>${state.player.scoreBuckets.daily}</strong></div>
              <div>Tuần: <strong>${state.player.scoreBuckets.weekly}</strong></div>
              <div>Tháng: <strong>${state.player.scoreBuckets.monthly}</strong></div>
            </div>
          </div>
          <div class="wallet-card">
            <strong>Mystery Box 30 ngày</strong>
            <div class="wallet-total" style="font-size:1.55rem;">📦 ${Number(state.player.dailyCheckin?.totalClaims || 0)}/30</div>
            <p class="subtitle">${escapeHtml(getMysteryBoxProgressLabel())}</p>
            <div class="helper-list" style="margin-top:10px;">
              <div>Streak đăng nhập: <strong>${Number(state.player.dailyCheckin?.streak || 0)} ngày</strong></div>
              <div>Hộp gần nhất: <strong>${latestMysteryBox ? `${latestMysteryBox.icon} ${escapeHtml(latestMysteryBox.name)}` : 'Chưa mở hộp nào'}</strong></div>
            </div>
          </div>
          <div class="wallet-card">
            <strong>Badge hiện có</strong>
            ${getPlayerBadges().length ? `<div class="badge-cloud">${getPlayerBadges().slice(0, 4).map(badge => `<span class="badge-chip ${badge.tone || ''}">${badge.icon} ${escapeHtml(badge.name)}</span>`).join('')}</div>` : '<p class="subtitle">Hoàn thành thêm level để mở badge đầu tiên nhé!</p>'}
          </div>
          <div class="wallet-card">
            <strong>Vật phẩm đã đổi</strong>
            ${state.player.ownedRewardItems.length ? `<div class="money-bank">${state.player.ownedRewardItems.map(id => {
              const item = state.shopItems.find(shop => shop.id === id);
              return `<span class="money-chip">${item ? escapeHtml(item.name) : escapeHtml(id)}</span>`;
            }).join('')}</div>` : '<p class="subtitle">Chưa có vật phẩm nào. Hãy hoàn thành level để tích tiền nhé!</p>'}
          </div>
          ${aiSidebar}
        </aside>
        <main class="card main-panel">${content}</main>
      </div>
    </div>
  `;

  attachCommonActions();
  attachAiSidebarControls();
  applyMediaPerformanceHints(app);
}

function renderWelcome() {
  app.innerHTML = `
    <div class="screen hero">
      <section class="card hero-copy">
        <div class="badge">🐷 ${APP_NAME} khởi động hành trình tài chính</div>
        <h1>Đăng nhập để tiếp tục chuyến phiêu lưu 10 đảo.</h1>
        <p>
          Chào mừng đến với vũ trụ Finchi! 🚀 Bé có thể tạo tài khoản để lưu tiến độ học tập, còn phụ huynh có thể tạo tài khoản liên kết để theo dõi thời gian học, số câu đúng, kỹ năng còn yếu và mục tiêu của con.
        </p>
        <div class="auth-switch-row">
          <button class="tab-btn active" id="show-login">Đăng nhập</button>
          <button class="tab-btn" id="show-signup">Tạo tài khoản</button>
          <button class="tab-btn" id="show-parent">Phụ huynh</button>
        </div>
        <div class="card auth-panel" id="auth-panel"></div>
      </section>
      <section class="hero-art">
        <div class="card mascot-card fun-card">
          <img src="/images/logo-finchi-game.png" alt="Finchi" class="welcome-logo-hero">
          <div>
            <h2 class="section-title" style="margin:0;">Finchi</h2>
            <p class="section-subtitle" style="margin-top:4px;">Người chơi sẽ đăng nhập trước, sau đó mới chọn nhân vật, nickname và bắt đầu hành trình 10 đảo thử thách.</p>
            <div class="sticker-row">
              <span class="sticker-mini">🔐</span>
              <span class="sticker-mini">🏝️</span>
              <span class="sticker-mini">💸</span>
              <span class="sticker-mini">🚀</span>
            </div>
          </div>
        </div>
        <div class="friends-row">
          ${avatars.map(avatar => `<div class="friend-chip"><img src="${avatar.image}" alt="${avatar.name}"><span>${avatar.name}</span></div>`).join('')}
        </div>
        <div class="stat-grid">
          <div class="card stat-card"><strong>10</strong><span>đảo thử thách tài chính</span></div>
          <div class="card stat-card"><strong>Lưu</strong><span>tiến độ trên máy chủ</span></div>
          <div class="card stat-card"><strong>Top</strong><span>xếp hạng theo nickname</span></div>
        </div>
      </section>
    </div>
  `;

  const authPanel = document.getElementById('auth-panel');
  const loginTab = document.getElementById('show-login');
  const signupTab = document.getElementById('show-signup');
  const parentTab = document.getElementById('show-parent');

  const renderAuthForm = (mode, parentMode = 'login') => {
    const isLogin = mode === 'login';
    const isParent = mode === 'parent';
    const isParentLogin = parentMode === 'login';
    loginTab.classList.toggle('active', isLogin);
    signupTab.classList.toggle('active', !isLogin);
    parentTab.classList.toggle('active', isParent);
    signupTab.classList.toggle('active', mode === 'signup');

    if (isParent) {
      authPanel.innerHTML = `
        <div class="form-group">
          <label class="label" for="parentUsername">Tên tài khoản học sinh</label>
          <input id="parentUsername" class="input" maxlength="24" placeholder="Ví dụ: beLan01 hoặc FinchiStar08">
        </div>
        ${isParentLogin ? '' : `
          <div class="form-group">
            <label class="label" for="parentDisplayName">Tên phụ huynh</label>
            <input id="parentDisplayName" class="input" maxlength="32" placeholder="Ví dụ: Mẹ của Bin">
          </div>
        `}
        <div class="form-group">
          <label class="label" for="parentPassword">Mật khẩu phụ huynh</label>
          <input id="parentPassword" class="input" type="password" maxlength="32" placeholder="Tối thiểu 4 ký tự">
        </div>
        <p class="section-subtitle" style="margin:0 0 8px;">${isParentLogin ? 'Phụ huynh đăng nhập để xem dashboard theo dõi tiến độ, câu đúng, kỹ năng còn yếu và mục tiêu của con.' : 'Tạo tài khoản phụ huynh liên kết với tài khoản học sinh hiện có để theo dõi hành trình học tập.'}</p>
        <div class="inline-actions">
          <button class="btn-primary" id="auth-submit">${isParentLogin ? 'Vào dashboard phụ huynh' : 'Tạo tài khoản phụ huynh'}</button>
          <button class="btn-secondary" id="toggle-parent-mode">${isParentLogin ? 'Tạo tài khoản phụ huynh' : 'Đã có tài khoản phụ huynh'}</button>
        </div>
      `;
      document.getElementById('toggle-parent-mode').onclick = () => renderAuthForm('parent', isParentLogin ? 'signup' : 'login');
    } else {
      authPanel.innerHTML = `
        <div class="form-group">
          <label class="label" for="accountUsername">Tên tài khoản</label>
          <input id="accountUsername" class="input" maxlength="24" placeholder="Ví dụ: beLan01 hoặc FinchiStar08">
        </div>
        <div class="form-group">
          <label class="label" for="accountPassword">Mật khẩu</label>
          <input id="accountPassword" class="input" type="password" maxlength="32" placeholder="Tối thiểu 4 ký tự">
        </div>
        <p class="section-subtitle" style="margin:0 0 8px;">${isLogin ? 'Đăng nhập để tiếp tục tiến độ, bảng xếp hạng, Mystery Box và nhật ký ước mơ của bé.' : 'Tạo tài khoản đơn giản, sau đó bé sẽ sang bước chọn nhân vật và nickname.'}</p>
        <div class="inline-actions">
          <button class="btn-primary" id="auth-submit">${isLogin ? 'Đăng nhập' : 'Tạo tài khoản'}</button>
        </div>
      `;
    }

    document.getElementById('auth-submit').onclick = async () => {
      try {
        if (isParent) {
          const username = document.getElementById('parentUsername').value.trim();
          const password = document.getElementById('parentPassword').value.trim();
          const parentName = document.getElementById('parentDisplayName')?.value.trim() || '';
          if (!username || !password || (!isParentLogin && !parentName)) {
            showToast('Hãy nhập đủ thông tin tài khoản phụ huynh.');
            return;
          }
          if (!isParentLogin) {
            await postForm('/api/auth/parent-signup', { username, parentName, password });
          }
          const payload = await postForm('/api/auth/parent-login', { username, password });
          state.account = { username: payload.username, role: 'parent', parentName: payload.parentName || parentName || 'Phụ huynh' };
          saveSession();
          state.player = payload.player || null;
          normalizePlayer();
          resetAiRuntimeState();
          if (!state.player.name && payload.nickname) state.player.name = payload.nickname;
          if (payload.avatarId) state.player.avatarId = payload.avatarId;
          state.player.parentAccess.linked = true;
          state.player.parentAccess.parentName = payload.parentName || parentName || state.player.parentAccess.parentName;
          savePlayerLocal();
          await refreshRankings();
          resetMoneyBoard();
          goTo('parent');
          showToast(isParentLogin ? 'Đã vào dashboard phụ huynh.' : 'Tạo tài khoản phụ huynh thành công.');
          return;
        }

        const username = document.getElementById('accountUsername').value.trim();
        const password = document.getElementById('accountPassword').value.trim();
        if (!username || !password) {
          showToast('Hãy nhập đủ tài khoản và mật khẩu.');
          return;
        }

        if (isLogin) {
          const payload = await postForm('/api/auth/login', { username, password });
          state.account = { username: payload.username, role: 'child' };
          saveSession();
          state.player = payload.player || null;
          normalizePlayer();
          resetAiRuntimeState();
          if (!state.player.name && payload.nickname) state.player.name = payload.nickname;
          if (payload.avatarId) state.player.avatarId = payload.avatarId;
          state.player.parentAccess.parentName = payload.parentName || state.player.parentAccess.parentName;
          state.player.parentAccess.linked = Boolean(payload.parentLinked || state.player.parentAccess.linked);
          savePlayerLocal();
          maybeClaimDailyMysteryBox();
          await refreshRankings();
          resetMoneyBoard();
          goTo(state.player.name ? (state.player.watchedIntro ? 'map' : 'intro') : 'character');
          showToast('Đăng nhập thành công!');
        } else {
          await postForm('/api/auth/signup', { username, password });
          state.account = { username, role: 'child' };
          saveSession();
          state.player = null;
          normalizePlayer();
          resetAiRuntimeState();
          state.player.name = '';
          state.player.avatarId = avatars[0].id;
          maybeClaimDailyMysteryBox();
          await savePlayerNow();
          await refreshRankings();
          goTo('character');
          showToast('Tạo tài khoản thành công! Bây giờ hãy chọn nhân vật nhé.');
        }
      } catch (error) {
        showToast(error.message);
      }
    };
  };

  loginTab.onclick = () => renderAuthForm('login');
  signupTab.onclick = () => renderAuthForm('signup');
  parentTab.onclick = () => renderAuthForm('parent', 'login');
  renderAuthForm('login');
}

function renderCharacterSelect() {
  const cards = avatars.map(avatar => `
    <button class="avatar-card ${state.selectedAvatar === avatar.id ? 'active' : ''}" data-avatar="${avatar.id}">
      <img src="${avatar.image}" alt="${avatar.name}">
      <strong>${avatar.name}</strong>
    </button>
  `).join('');

  app.innerHTML = `
    <div class="screen">
      <div class="card main-panel">
        <span class="badge">Bước 2</span>
        <h1 class="section-title">Chọn nhân vật và nickname hiển thị</h1>
        <p class="section-subtitle">Tài khoản <strong>${escapeHtml(state.account?.username || '')}</strong> đã sẵn sàng. Bây giờ hãy chọn nhân vật và nickname sẽ xuất hiện trong game, bảng xếp hạng và giải đấu.</p>
        <div class="avatar-grid">${cards}</div>
        <div class="form-group">
          <label class="label" for="playerName">Tên nhân vật</label>
          <input id="playerName" class="input" maxlength="24" placeholder="Ví dụ: Bé Lan, Bin, Miu..." value="${escapeHtml(state.player.name || '')}">
        </div>
        <div class="inline-actions">
          <button class="btn-primary" id="save-player">Tiếp tục tới video luật chơi</button>
          <button class="btn-secondary" id="back-home">Quay lại</button>
        </div>
      </div>
    </div>
  `;

  document.querySelectorAll('[data-avatar]').forEach(button => {
    button.onclick = () => {
      state.selectedAvatar = button.dataset.avatar;
      renderCharacterSelect();
    };
  });

  document.getElementById('save-player').onclick = () => {
    const nameInput = document.getElementById('playerName');
    const name = nameInput.value.trim();
    if (!name) {
      showToast('Hãy nhập tên nhân vật trước nhé.');
      nameInput.focus();
      return;
    }
    state.player.name = name;
    state.player.avatarId = state.selectedAvatar;
    state.player.watchedIntro = false;
    savePlayerNow().then(() => {
      goTo('intro');
    }).catch(() => {
      savePlayerLocal();
      goTo('intro');
    });
  };

  document.getElementById('back-home').onclick = () => goTo('welcome');
}

function renderIntro() {
  app.innerHTML = `
    <div class="screen">
      <div class="card video-panel">
        <span class="badge">Video bắt buộc xem</span>
        <h1 class="section-title">Giới thiệu game và luật chơi Finchi</h1>
        <p class="section-subtitle">
        </p>
        <div class="video-frame">
          <video id="introVideo" controls playsinline></video>
          <div id="introFallback" class="video-fallback">
            <strong>Chưa có file video intro</strong>
            <p>Phần này đang chờ video dạy luật chơi của bạn. Bản demo sẽ yêu cầu đọc nội dung tóm tắt trong vài giây trước khi cho phép vào game.</p>
            <div class="knowledge-card">
              <strong>Intro sẽ giới thiệu:</strong>
              <ul class="helper-list">
                <li>Cách chọn nhân vật và nhập tên</li>
                <li>Cách vào level và xem video bài học</li>
                <li>Cách làm 10 nhiệm vụ để nhận tiền thưởng và thẻ kiến thức</li>
                <li>Cách dùng tiền đổi quà học tập, chuỗi tiết kiệm và học theo nhịp riêng của bé</li>
              </ul>
            </div>
            <p class="video-status" id="introFallbackStatus">Đang chuẩn bị nội dung demo…</p>
          </div>
        </div>
        <div class="inline-actions">
          <button class="btn-primary" id="finish-intro" disabled>Mình đã xem xong video luật chơi</button>
        </div>
      </div>
    </div>
  `;

  setupVideoGate({
    videoElementId: 'introVideo',
    fallbackId: 'introFallback',
    buttonId: 'finish-intro',
    source: state.config.introVideoUrl,
    fallbackSeconds: state.config.introFallbackDurationSeconds,
    fallbackStatusId: 'introFallbackStatus',
    onFinish: () => {
      state.player.watchedIntro = true;
      savePlayer();
      goTo('map');
    }
  });
}

function renderMap() {
  const completedCount = state.player.completedLevels.length;
  const stops = state.levels.map((level, index) => {
    const unlocked = state.player.unlockedLevels.includes(level.id);
    const completed = state.player.completedLevels.includes(level.id);
    const side = index % 2 === 0 ? 'left' : 'right';
    const sticker = levelStickers[index % levelStickers.length];
    const colorClass = `color-${(index % 5) + 1}`;
    return `
      <article class="journey-stop ${side} ${completed ? 'completed' : ''} ${unlocked ? 'unlocked' : 'locked'}">
        <div class="journey-card ${colorClass}">
          <span class="corner-sticker">${sticker}</span>
          <div class="journey-card-top">
            <span class="journey-status ${completed ? 'done' : unlocked ? 'ready' : 'hold'}">${completed ? 'Đã xong' : unlocked ? 'Có thể học' : 'Đang khóa'}</span>
            <span class="journey-reward">${formatMoney(level.rewardAmount)}</span>
          </div>
          <div class="journey-scene" style="--journey-scene:url('${getLevelScene(level.id).path}')"><span>${getLevelScene(level.id).icon}</span><small>${escapeHtml(getLevelScene(level.id).title)}</small></div>
          <h3>${escapeHtml(level.title)}</h3>
          <p class="subtitle">${escapeHtml(level.description)}</p>
          <div class="journey-meta">
            <span class="meta-pill">${level.questions.length} nhiệm vụ</span>
            <span class="meta-pill">🎬 Video trước bài học</span>
          </div>
          <button class="btn-primary level-btn" ${unlocked ? '' : 'disabled'} data-level-start="${level.id}">${completed ? 'Học lại level' : 'Khám phá đảo'}</button>
        </div>
        <div class="journey-node-wrap">
          <div class="journey-node ${completed ? 'done' : unlocked ? 'ready' : 'locked'}">${level.id}</div>
        </div>
      </article>
    `;
  }).join('');

  shell(`
    <div class="map-hero">
      <div>
        <span class="badge">Bản đồ 10 đảo thử thách</span>
        <h1 class="section-title">Hành trình tài chính của ${escapeHtml(state.player.name || 'bé')}</h1>
        <p class="section-subtitle">Mỗi level là một hòn đảo màu sắc với sticker riêng. Bé có thể xem lại video bài học bất cứ lúc nào, giải 10 nhiệm vụ và đạt ít nhất 9/10 câu đúng để mở đường sang đảo kế tiếp.</p>
      </div>
      <div class="map-summary">
        <div class="map-summary-card map-card-a">
          <span class="summary-sticker">🏝️</span>
          <strong>${completedCount}/10</strong>
          <span>Đảo đã hoàn thành</span>
        </div>
        <div class="map-summary-card map-card-b">
          <span class="summary-sticker">🎬</span>
          <strong>∞</strong>
          <span>Video bài học không giới hạn</span>
        </div>
        <div class="map-summary-card map-card-c">
          <span class="summary-sticker">🗝️</span>
          <strong>9/10</strong>
          <span>Đúng tối thiểu để mở đảo tiếp theo</span>
        </div>
      </div>
    </div>
    <div class="journey-map">${stops}</div>
  `);

  document.querySelectorAll('[data-level-start]').forEach(button => {
    button.onclick = () => {
      state.currentLevelId = Number(button.dataset.levelStart);
      state.dragAssignments = {};
      state.selectedDragItemId = null;
      goTo('lesson');
    };
  });
}

function renderLesson() {
  const level = getCurrentLevel();
  if (!level) return goTo('map');
  const lessonContext = buildAiSupportContext(level, null, {
    currentMission: 'lesson_video',
    emotionSignal: 'thinking'
  });
  postAiEvent('/api/events/student', 'student_started_lesson', lessonContext);

  shell(`
    <div class="video-panel">
      <span class="badge">Level ${level.id}</span>
      <h1 class="section-title">${escapeHtml(level.title)}</h1>
      <p class="section-subtitle">${escapeHtml(level.description)}</p>
      <div class="level-scene-banner" style="--scene:url('${getLevelScene(level.id).path}')"><div class="level-scene-overlay"><span>${getLevelScene(level.id).icon} ${escapeHtml(getLevelScene(level.id).title)}</span><strong>Khám phá hòn đảo riêng của level này</strong></div></div>
      <div class="lesson-meta">
        <span class="meta-pill">Video bài học: Không giới hạn</span>
        <span class="meta-pill">Thưởng cuối level: ${formatMoney(level.rewardAmount)}</span>
        <span class="meta-pill">Mở khóa đảo tiếp: đúng ${getLevelUnlockRequirement(level)}/${level.questions.length} câu</span>
      </div>
      <div class="video-frame">
        <video id="lessonVideo" controls playsinline></video>
        <div id="lessonFallback" class="video-fallback">
          <strong>Chưa có video cho level này</strong>
          <p>Bạn sẽ gửi video dạy học sau. Bây giờ hệ thống đã tạo sẵn vị trí phát video và chế độ fallback để test toàn bộ flow.</p>
          <div class="knowledge-card">
            <strong>Placeholder hiện tại:</strong>
            <p>${escapeHtml(level.description)}</p>
          </div>
          <p class="video-status" id="lessonFallbackStatus">Đang mô phỏng xem video bài học…</p>
        </div>
      </div>
      <div class="inline-actions">
        <button class="btn-primary" id="start-quiz" disabled>Bắt đầu ${level.questions.length} nhiệm vụ</button>
        <button class="btn-secondary" id="back-map">Quay lại bản đồ</button>
      </div>
    </div>
  `);

  document.getElementById('back-map').onclick = async () => {
    await postAiEvent('/api/events/student', 'student_left_lesson', buildAiSupportContext(level, null, {
      currentMission: 'lesson_video',
      emotionSignal: 'thinking'
    }));
    goTo('map', { justReachedMilestone: null });
  };

  if (!hasWatchedLevel(level.id)) {
    savePlayer();
    markWatchedLevel(level.id);
  }

  setupVideoGate({
    videoElementId: 'lessonVideo',
    fallbackId: 'lessonFallback',
    buttonId: 'start-quiz',
    source: level.lessonVideoUrl,
    subtitle: level.subtitleUrl,
    fallbackSeconds: 6,
    fallbackStatusId: 'lessonFallbackStatus',
    onFinish: async () => {
      if (!state.player.watchedLessonScoreClaimed.includes(level.id)) {
        state.player.watchedLessonScoreClaimed.push(level.id);
        awardScore(10, `Xem xong video bài học level ${level.id}`);
      }
      await postAiEvent('/api/events/student', 'student_finished_lesson_video', buildAiSupportContext(level, null, {
        currentMission: 'lesson_video',
        emotionSignal: 'confident'
      }));
      savePlayer();
      state.currentQuestionIndex = 0;
      state.levelPassed = false;
      state.selectedAnswer = null;
      state.dragAssignments = {};
      state.selectedDragItemId = null;
      state.levelScore = 0;
      state.knowledgeRewards = [];
      state.lastQuestionSummary = '';
      state.quizPathMotion = { fromIndex: 0, toIndex: 0, animate: false };
      resetAiMissionProgress(level, {
        eventType: 'student_started_quiz_attempt',
        message: `Mình bắt đầu thử thách của level ${level.id} nhé. FINCHI sẽ theo dõi theo từng câu mới của con.`
      });
      goTo('quiz');
    }
  });
}

function renderQuiz() {
  const level = getCurrentLevel();
  if (!level) return goTo('map');
  const question = level.questions[state.currentQuestionIndex];
  if (!question) return goTo('result');

  if (question.type === 'drag_classify') {
    renderDragQuiz(level, question);
    return;
  }

  renderChoiceQuiz(level, question);
}

function renderChoiceQuiz(level, question) {
  const progress = ((state.currentQuestionIndex) / level.questions.length) * 100;
  const options = question.options.map((option, index) => `
    <button class="option-btn ${state.selectedAnswer === index ? 'selected' : ''}" data-option="${index}">${String.fromCharCode(65 + index)}. ${escapeHtml(option)}</button>
  `).join('');
  const visual = getQuestionVisual(question, level);
  const journey = renderQuizJourney(level, state.currentQuestionIndex);
  const aiMissionCard = renderAiMissionCard(level, question);

  shell(`
    <div class="quiz-panel">
      ${journey}
      <div class="quiz-task-shell">
        <div class="quiz-task-header">
          <div class="quiz-task-copy">
            <span class="badge">Level ${level.id} · Nhiệm vụ ${state.currentQuestionIndex + 1}/${level.questions.length}</span>
            <h1 class="section-title">${escapeHtml(level.title)}</h1>
            <div class="quiz-meta">
              <span class="meta-pill">Cần đúng ${getLevelUnlockRequirement(level)}/${level.questions.length} câu để mở khóa level tiếp theo</span>
              <span class="meta-pill">Thưởng câu này: ${formatMoney(question.reward)}</span>
            </div>
          </div>
          <div class="quiz-task-art">
            <div class="quiz-art-card" style="--quiz-card-bg:url('${visual.scene.path}');">
              <img src="${visual.illustration}" alt="${escapeHtml(question.prompt)}">
              <span>${visual.emoji}</span>
            </div>
          </div>
        </div>
        <div class="quiz-progress"><span style="width:${progress}%"></span></div>
        ${aiMissionCard}
        <div class="quiz-question-card">
          <h2>${escapeHtml(question.prompt)}</h2>
          <div class="option-list">${options}</div>
        </div>
        <div class="inline-actions">
          <button class="btn-primary" id="submit-answer">Xác nhận đáp án</button>
          <button class="btn-secondary" id="back-map">Tạm dừng và quay lại bản đồ</button>
        </div>
        <div id="answer-feedback"></div>
      </div>
    </div>
  `);

  animateQuizRunnerIfNeeded();
  syncAiQuestionWatch(level, question);

  document.querySelectorAll('[data-option]').forEach(button => {
    button.onclick = () => {
      state.selectedAnswer = Number(button.dataset.option);
      renderChoiceQuiz(level, question);
    };
  });

  document.getElementById('back-map').onclick = async () => {
    const context = buildAiSupportContext(level, question, {
      emotionSignal: 'thinking'
    });
    await postAiEvent('/api/events/student', 'student_quit_mission', context);
    goTo('map');
  };
  document.getElementById('submit-answer').onclick = () => submitAnswer(question, level);
  attachAiMissionActions(level, question);
}

function renderDragQuiz(level, question) {
  const progress = ((state.currentQuestionIndex) / level.questions.length) * 100;
  const bankItems = question.dragItems.filter(item => !state.dragAssignments[item.id]);
  const zones = question.dropZones.map(zone => {
    const items = question.dragItems.filter(item => state.dragAssignments[item.id] === zone);
    return `
      <div class="drop-zone" data-drop-zone="${escapeHtml(zone)}">
        <div class="drop-zone-head">
          <strong>${escapeHtml(zone)}</strong>
          <span>${items.length} món</span>
        </div>
        <div class="drop-zone-body">
          ${items.length ? items.map(item => renderDragItem(item, true)).join('') : '<span class="subtitle">Kéo hoặc chạm để thả vào đây</span>'}
        </div>
      </div>
    `;
  }).join('');
  const visual = getQuestionVisual(question, level);
  const journey = renderQuizJourney(level, state.currentQuestionIndex);
  const aiMissionCard = renderAiMissionCard(level, question);

  shell(`
    <div class="quiz-panel">
      ${journey}
      <div class="quiz-task-shell">
        <div class="quiz-task-header">
          <div class="quiz-task-copy">
            <span class="badge">Level ${level.id} · Nhiệm vụ ${state.currentQuestionIndex + 1}/${level.questions.length}</span>
            <h1 class="section-title">${escapeHtml(level.title)}</h1>
            <div class="quiz-meta">
              <span class="meta-pill">Cần đúng ${getLevelUnlockRequirement(level)}/${level.questions.length} câu để mở khóa level tiếp theo</span>
              <span class="meta-pill">Thưởng câu này: ${formatMoney(question.reward)}</span>
              <span class="meta-pill">Dạng câu: kéo thả phân loại</span>
            </div>
          </div>
          <div class="quiz-task-art">
            <div class="quiz-art-card" style="--quiz-card-bg:url('${visual.scene.path}');">
              <img src="${visual.illustration}" alt="${escapeHtml(question.prompt)}">
              <span>${visual.emoji}</span>
            </div>
          </div>
        </div>
        <div class="quiz-progress"><span style="width:${progress}%"></span></div>
        ${aiMissionCard}
        <div class="quiz-question-card">
          <h2>${escapeHtml(question.prompt)}</h2>
          <p class="section-subtitle" style="margin-top:8px;">${escapeHtml(question.instructions || 'Kéo thả hoặc chạm để phân loại.')}</p>
          <div class="drag-board">
            <div class="drag-bank-panel">
              <strong>Kho tiền cần phân loại</strong>
              <div class="drag-bank">
                ${bankItems.map(item => renderDragItem(item, false, state.selectedDragItemId === item.id)).join('') || '<span class="subtitle">Con đã phân loại hết các tờ tiền rồi.</span>'}
              </div>
            </div>
            <div class="drop-zone-grid">${zones}</div>
          </div>
        </div>
        <div class="inline-actions">
          <button class="btn-primary" id="submit-answer">Kiểm tra phân loại</button>
          <button class="btn-secondary" id="reset-drag">Làm lại câu này</button>
          <button class="btn-secondary" id="back-map">Tạm dừng và quay lại bản đồ</button>
        </div>
        <div id="answer-feedback"></div>
      </div>
    </div>
  `);

  animateQuizRunnerIfNeeded();
  syncAiQuestionWatch(level, question);

  bindDragQuestionEvents(question);
  document.getElementById('back-map').onclick = async () => {
    const context = buildAiSupportContext(level, question, {
      emotionSignal: 'thinking'
    });
    await postAiEvent('/api/events/student', 'student_quit_mission', context);
    goTo('map');
  };
  document.getElementById('reset-drag').onclick = () => {
    state.dragAssignments = {};
    state.selectedDragItemId = null;
    renderDragQuiz(level, question);
  };
  document.getElementById('submit-answer').onclick = () => submitAnswer(question, level);
  attachAiMissionActions(level, question);
}

function renderDragItem(item, assigned = false, selected = false) {
  const hasImage = Boolean(item.image);
  return `
    <button class="drag-chip ${hasImage ? 'note-chip' : ''} ${selected ? 'selected' : ''} ${assigned ? 'assigned' : ''}" draggable="true" data-drag-item="${item.id}" ${assigned ? 'data-assigned="true"' : ''}>
      ${hasImage ? `<img src="${item.image}" alt="${escapeHtml(item.label)}">` : ''}
      <span>${escapeHtml(item.label)}</span>
    </button>
  `;
}

function bindDragQuestionEvents(question) {
  const chips = document.querySelectorAll('[data-drag-item]');
  const zones = document.querySelectorAll('[data-drop-zone]');

  chips.forEach(chip => {
    chip.addEventListener('dragstart', event => {
      event.dataTransfer.setData('text/plain', chip.dataset.dragItem);
    });
    chip.addEventListener('click', () => {
      const itemId = chip.dataset.dragItem;
      if (chip.dataset.assigned === 'true') {
        delete state.dragAssignments[itemId];
        state.selectedDragItemId = null;
        renderQuiz();
        return;
      }
      state.selectedDragItemId = state.selectedDragItemId === itemId ? null : itemId;
      renderQuiz();
    });
  });

  zones.forEach(zone => {
    zone.addEventListener('dragover', event => {
      event.preventDefault();
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', event => {
      event.preventDefault();
      zone.classList.remove('drag-over');
      const itemId = event.dataTransfer.getData('text/plain');
      assignDragItem(itemId, zone.dataset.dropZone, question);
    });
    zone.addEventListener('click', () => {
      if (state.selectedDragItemId) {
        assignDragItem(state.selectedDragItemId, zone.dataset.dropZone, question);
      }
    });
  });
}

function assignDragItem(itemId, zoneName, question) {
  if (!question.dragItems.find(item => item.id === itemId)) return;
  state.dragAssignments[itemId] = zoneName;
  state.selectedDragItemId = null;
  renderQuiz();
}

async function submitAnswer(question, level) {
  let isCorrect = false;
  let earnedReward = 0;
  let summary = '';
  const timeOnQuestion = aiModule?.getTimeOnQuestion ? aiModule.getTimeOnQuestion(state.aiRuntime) : 0;

  if (question.type === 'drag_classify') {
    const missing = question.dragItems.some(item => !state.dragAssignments[item.id]);
    if (missing) {
      showToast('Hãy phân loại hết các tờ tiền trước nhé.');
      return;
    }
    const correctCount = question.dragItems.filter(item => state.dragAssignments[item.id] === item.target).length;
    const total = question.dragItems.length;
    isCorrect = correctCount === total;
    earnedReward = Math.round((question.reward || 0) * (correctCount / total));
    summary = `Con đã phân loại đúng ${correctCount}/${total} tờ tiền.`;
  } else {
    if (state.selectedAnswer === null) {
      showToast('Hãy chọn một đáp án trước nhé.');
      return;
    }
    isCorrect = state.selectedAnswer === question.correctAnswer;
    earnedReward = isCorrect ? question.reward : 0;
    summary = isCorrect ? 'Con đã chọn đúng đáp án.' : `Đáp án đúng là: ${escapeHtml(question.options[question.correctAnswer])}.`;
  }

  state.player.dailyTaskCount += 1;
  awardScore(10, `Hoàn thành nhiệm vụ ${question.id}`);
  const replayMode = state.player.completedLevels.includes(level.id);
  const rewardIfCorrect = question.type === 'drag_classify'
    ? Math.max(Number(question.reward || 0), earnedReward)
    : (replayMode ? Math.max(100, Math.round(Number(question.reward || 0) * 0.2)) : Number(question.reward || 0));
  if (replayMode && earnedReward > 0) {
    earnedReward = Math.max(100, Math.round(earnedReward * 0.2));
  }
  if (earnedReward > 0) {
    state.player.totalMoney += earnedReward;
  }
  if (isCorrect) {
    state.levelScore += 1;
    awardScore(15, `Trả lời đúng ${question.id}`);
  }
  recordQuestionAnalytics(question, level, isCorrect);
  handleStudentAnswerAi(level, question, {
    isCorrect,
    selectedAnswer: getSelectedAnswerLabel(question),
    timeOnQuestion,
    emotionSignal: isCorrect ? 'confident' : (timeOnQuestion > 30 ? 'struggling' : 'thinking')
  }).catch(() => {});
  state.lastMissionAttempt = {
    levelId: level.id,
    levelTitle: level.title,
    questionId: question.id,
    questionPrompt: question.prompt,
    questionType: question.type,
    studentAnswer: getSelectedAnswerLabel(question),
    aiOriginalDecision: isCorrect ? 'correct' : 'incorrect',
    aiOriginalFeedback: state.aiRuntime.activeResponse?.message || '',
    rewardIfCorrect,
    corrected: isCorrect
  };
  state.knowledgeRewards.push(question.knowledgeReward);
  state.lastQuestionSummary = summary;
  savePlayer();
  resetMoneyBoard();
  renderAnswerResult(question, level, isCorrect, earnedReward, summary);
}

function renderAnswerResult(question, level, isCorrect, earnedReward, summary) {
  const correctionCard = renderCorrectionActionCard(question, level, isCorrect);
  shell(`
    <div class="quiz-panel">
      <span class="badge">Kết quả nhiệm vụ ${state.currentQuestionIndex + 1}</span>
      <h1 class="section-title">${isCorrect ? 'Chính xác rồi!' : 'Mình cùng xem lại nhé!'}</h1>
      <p class="section-subtitle">${summary}</p>
      <div class="knowledge-card">
        <strong>Thẻ kiến thức mới</strong>
        <p>${escapeHtml(question.knowledgeReward)}</p>
      </div>
      ${correctionCard}
      <div class="result-stats">
        <div class="result-stat"><strong>${isCorrect ? '+1' : '0'}</strong><p class="subtitle">Điểm nhiệm vụ</p></div>
        <div class="result-stat"><strong>${formatMoney(earnedReward)}</strong><p class="subtitle">Tiền nhận được</p></div>
        <div class="result-stat"><strong>${state.levelScore}/${level.questions.length}</strong><p class="subtitle">Số câu đúng hiện tại</p></div>
        <div class="result-stat"><strong>${getLevelUnlockRequirement(level)}/${level.questions.length}</strong><p class="subtitle">Mốc mở khóa đảo tiếp theo</p></div>
      </div>
      <div class="inline-actions">
        <button class="btn-primary" id="next-question">${state.currentQuestionIndex + 1 >= level.questions.length ? 'Xem tổng kết level' : 'Sang nhiệm vụ tiếp theo'}</button>
      </div>
    </div>
  `);

  attachCommonActions();
  attachCorrectionActionCard(question, level);
  showToast(earnedReward > 0 ? `+${formatMoney(earnedReward)} vào ví tiền` : 'Không sao, mình vừa học thêm một điều mới.');

  document.getElementById('next-question').onclick = () => {
    state.selectedAnswer = null;
    state.dragAssignments = {};
    state.selectedDragItemId = null;
    const nextIndex = state.currentQuestionIndex + 1;
    if (nextIndex >= level.questions.length) {
      state.currentQuestionIndex = nextIndex;
      completeLevel(level);
      return;
    }
    state.quizPathMotion = { fromIndex: state.currentQuestionIndex, toIndex: nextIndex, animate: true };
    state.currentQuestionIndex = nextIndex;
    goTo('quiz');
  };
}

async function completeLevel(level) {
  const totalQuestions = level.questions.length;
  const unlockRequirement = getLevelUnlockRequirement(level);
  const passedLevel = state.levelScore >= unlockRequirement;
  state.levelPassed = passedLevel;
  state.lastAwardedBadge = null;

  if (passedLevel) {
    const firstClear = !state.player.completedLevels.includes(level.id);
    state.lastLevelCompletionReward = firstClear ? level.rewardAmount : 0;
    if (firstClear) state.player.completedLevels.push(level.id);
    if (!state.player.unlockedLevels.includes(level.id + 1) && level.id < state.levels.length) state.player.unlockedLevels.push(level.id + 1);
    if (firstClear) state.player.totalMoney += level.rewardAmount;
    state.player.savingStreak += 1;
    if (firstClear) awardScore(50, `Hoàn thành level ${level.id}`);
    if (firstClear) {
      const unlockedBadge = awardLevelBadgeIfNeeded(level.id);
      if (unlockedBadge) {
        showToast(`Bé vừa nhận badge ${unlockedBadge.icon} ${unlockedBadge.name}!`);
      }
    }
    if (firstClear && level.id === 10 && !state.player.certificate.unlockedAt) {
      state.player.certificate.unlockedAt = new Date().toISOString();
    }

    const milestoneReached = state.config.milestones.find(mark => mark === state.player.savingStreak && !state.player.savingMilestonesClaimed.includes(mark));
    state.justReachedMilestone = milestoneReached || null;
    if (milestoneReached) {
      state.player.savingMilestonesClaimed.push(milestoneReached);
      awardScore(20, `Chạm mốc chuỗi ${milestoneReached}`);
      burstConfetti();
      burstMilestoneFlare(milestoneReached, getMilestoneMessage(milestoneReached));
      showToast(getMilestoneMessage(milestoneReached));
    } else {
      showToast(firstClear ? `Đạt ${state.levelScore}/${totalQuestions} câu đúng! Bạn đã mở khóa level tiếp theo và nhận ${formatMoney(level.rewardAmount)}.` : `Đạt ${state.levelScore}/${totalQuestions} câu đúng! Level tiếp theo vẫn đã được mở khóa, đây là lượt luyện tập lại của bạn.`);
    }
  } else {
    state.lastLevelCompletionReward = 0;
    state.justReachedMilestone = null;
    showToast(`Con đạt ${state.levelScore}/${totalQuestions} câu đúng. Hãy thử lại để chạm mốc ${unlockRequirement}/${totalQuestions} nhé!`);
  }

  recordLevelCompletionAnalytics(level.id, passedLevel);
  handleLevelCompletionAi(level).catch(() => {});
  savePlayer();
  resetMoneyBoard();
  goTo('result');
}

function renderResult() {
  const level = getCurrentLevel();
  if (!level) return goTo('map');
  const uniqueKnowledge = [...new Set(state.knowledgeRewards)];
  const milestoneBox = state.justReachedMilestone ? `
    <div class="milestone-banner">
      <div class="milestone-icon">🔥</div>
      <div>
        <strong>Chúc mừng! Con đã chạm mốc ${state.justReachedMilestone}</strong>
        <p>${escapeHtml(getMilestoneMessage(state.justReachedMilestone))}</p>
      </div>
    </div>
  ` : '';
  const badgeBox = state.lastAwardedBadge ? `
    <div class="milestone-banner badge-award-banner">
      <div class="milestone-icon">${state.lastAwardedBadge.icon}</div>
      <div>
        <strong>Badge mới đã mở khóa: ${escapeHtml(state.lastAwardedBadge.name)}</strong>
        <p>Bé vừa vượt qua cột mốc level ${state.lastAwardedBadge.levelId} và được trao huy hiệu thành tích mới.</p>
      </div>
    </div>
  ` : '';

  const unlockRequirement = getLevelUnlockRequirement(level);
  const passedLevel = state.levelPassed;
  shell(`
    <div class="result-panel ${passedLevel ? 'passed' : 'needs-retry'}">
      <span class="badge">Tổng kết level ${level.id}</span>
      <h1 class="section-title">${escapeHtml(level.title)}</h1>
      <p class="section-subtitle">${passedLevel ? `Con đã hoàn thành ${level.questions.length} nhiệm vụ và đạt điều kiện mở khóa.` : `Con đã hoàn thành ${level.questions.length} nhiệm vụ. Cần đúng từ ${unlockRequirement}/${level.questions.length} câu để mở khóa level tiếp theo.`}</p>
      ${milestoneBox}
      ${badgeBox}
      <div class="result-stats">
        <div class="result-stat"><strong>${state.levelScore}/${level.questions.length}</strong><p class="subtitle">Số câu trả lời đúng</p></div>
        <div class="result-stat"><strong>${unlockRequirement}/${level.questions.length}</strong><p class="subtitle">Điều kiện mở khóa</p></div>
        <div class="result-stat"><strong>${passedLevel ? formatMoney(state.lastLevelCompletionReward || 0) : formatMoney(0)}</strong><p class="subtitle">Thưởng hoàn thành level</p></div>
        <div class="result-stat"><strong>🔥 ${state.player.savingStreak}</strong><p class="subtitle">Chuỗi tiết kiệm hiện tại</p></div>
      </div>
      <div class="knowledge-card ${passedLevel ? '' : 'warning-card'}">
        <strong>${passedLevel ? 'Những điều vừa học' : 'Gợi ý để mở khóa level tiếp theo'}</strong>
        ${passedLevel ? `<ul class="helper-list">${uniqueKnowledge.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : `<p>Hãy chơi lại level này và cố gắng đạt ít nhất <strong>${unlockRequirement}/${level.questions.length}</strong> câu đúng. Khi đạt mốc này, Finchi sẽ tự mở khóa đảo tiếp theo cho con.</p>`}
      </div>
      <div class="inline-actions">
        <button class="btn-primary" id="back-map">Quay lại bản đồ</button>
        <button class="btn-secondary" id="retry-level">${passedLevel ? 'Học lại level này' : 'Thử lại level này'}</button>
        <button class="btn-secondary" id="open-shop-result">Mở shop quà học tập</button>
        ${passedLevel && level.id === 10 ? '<button class="btn-secondary" id="open-certificate">Xuất certificate PDF</button>' : ''}
      </div>
    </div>
  `);

  document.getElementById('back-map').onclick = () => goTo('map', { justReachedMilestone: null });
  document.getElementById('retry-level').onclick = () => {
    state.currentQuestionIndex = 0;
    state.levelPassed = false;
    state.selectedAnswer = null;
    state.dragAssignments = {};
    state.selectedDragItemId = null;
    state.levelScore = 0;
    state.knowledgeRewards = [];
    state.lastQuestionSummary = '';
    resetAiMissionProgress(level, {
      eventType: 'student_restarted_level',
      message: `Con đang làm lại level ${level.id}. FINCHI sẽ bỏ qua nhắc nhở cũ và theo dõi lại từ câu đầu tiên.`
    });
    goTo('lesson', { justReachedMilestone: null });
  };
  document.getElementById('open-shop-result').onclick = () => goTo('shop', { justReachedMilestone: null });
  document.getElementById('open-certificate')?.addEventListener('click', () => goTo('certificate'));
}

function renderShop() {
  const items = state.shopItems.map(item => {
    const owned = state.player.ownedRewardItems.includes(item.id);
    const canBuy = state.player.totalMoney >= item.price && !owned;
    return `
      <div class="shop-item ${owned ? 'owned' : ''}">
        <div class="shop-collection">${escapeHtml(item.collection || item.category)}</div>
        <span class="shop-sticker">${panelStickers[(state.shopItems.findIndex(shop => shop.id === item.id)) % panelStickers.length]}</span>
        <img src="${item.image}" alt="${escapeHtml(item.name)}">
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <p class="subtitle">${escapeHtml(item.description || item.category)}</p>
        </div>
        <div class="shop-tags">
          <span class="shop-tag">${escapeHtml(item.category)}</span>
          <span class="shop-tag">${escapeHtml(item.favoriteCharacterTag)}</span>
        </div>
        <div class="shop-footer">
          <div class="shop-price">${formatMoney(item.price)}</div>
          <button class="btn-primary shop-btn" ${canBuy ? '' : 'disabled'} data-buy="${item.id}">${owned ? 'Đã đổi' : 'Đổi quà'}</button>
        </div>
      </div>
    `;
  }).join('');

  shell(`
    <div class="shop-panel">
      <span class="badge">Khu quà học tập</span>
      <h1 class="section-title">Đổi tiền thưởng lấy quà học tập</h1>
      <p class="section-subtitle">Cửa hàng Thần kỳ đã được làm mới với thêm nhiều quà học tập hơn và giá được cân bằng lại để bé cần tiết kiệm bền bỉ hơn trước khi đổi món đồ mình thích.</p>
      <div class="shop-meta">
        <span class="meta-pill">Ví hiện có: ${formatMoney(state.player.totalMoney)}</span>
        <span class="meta-pill">Đã đổi: ${state.player.ownedRewardItems.length} vật phẩm</span>
        <span class="meta-pill">Chủ đề: quà học tập mô phỏng</span>
      </div>
      <div class="shop-grid">${items}</div>
    </div>
  `);

  document.querySelectorAll('[data-buy]').forEach(button => {
    button.onclick = () => buyItem(button.dataset.buy);
  });
}

function buyItem(itemId) {
  const item = state.shopItems.find(shopItem => shopItem.id === itemId);
  if (!item) return;
  if (state.player.ownedRewardItems.includes(itemId)) return;
  if (state.player.totalMoney < item.price) {
    showToast('Ví tiền hiện tại chưa đủ để đổi vật phẩm này.');
    return;
  }

  state.player.totalMoney -= item.price;
  state.player.ownedRewardItems.push(itemId);
  savePlayer();
  resetMoneyBoard();
  showToast(`Đã đổi thành công: ${item.name}`);
  renderShop();
}

function renderMonthlyBoard() {
  ensureMoneyBoardInSync();
  const totalMoney = Number(state.player.totalMoney || 0);
  const snapshots = getMoneyBoardSnapshots();
  const categoriesMarkup = Object.entries(state.moneyBoard.categories).map(([name, values], index) => `
    <div class="category-box category-color-${(index % 4) + 1}" data-money-zone="${escapeHtml(name)}">
      <div class="category-box-head">
        <div>
          <strong>${escapeHtml(name)}</strong>
          <div class="zone-total">Hiện đã xếp: ${formatMoney(getMoneyBoardTotalForCategory(name))}</div>
        </div>
        <span class="category-sticker">${categoryStickers[name] || '✨'}</span>
      </div>
      <div class="money-bank note-bank">${values.length ? values.map(item => renderMoneyBoardItem(item, true)).join('') : '<span class="subtitle">Kéo tiền vào nhóm này</span>'}</div>
    </div>
  `).join('');

  const snapshotMarkup = snapshots.length ? snapshots.map(item => `
    <div class="money-snapshot-card">
      <img src="${item.image}" alt="${escapeHtml(item.label)}">
      <strong>${escapeHtml(item.label)}</strong>
      <span>Con đang có: ${item.count} tờ</span>
      <small>Tổng mệnh giá: ${formatMoney(item.total)}</small>
    </div>
  `).join('') : '<span class="subtitle">Ví của bé chưa có tờ tiền nào. Hãy hoàn thành thêm thử thách nhé!</span>';

  shell(`
    <div class="monthly-panel">
      <span class="badge">Sổ chi tiêu tiết kiệm</span>
      <h1 class="section-title">Sổ chi tiêu tiết kiệm</h1>
      <p class="section-subtitle">Tada! 🎉 Chào mừng bạn đến với Kho Tiền Bí Mật! Wow, nhìn kìa, bạn đang sở hữu hẳn <strong>${formatMoney(totalMoney)}</strong> từ những thử thách vừa qua. Thật đáng tự hào!</p>
      <div class="knowledge-card monthly-story-card">
        <p>Bây giờ là lúc thể hiện tài năng của một “quản gia” siêu đỉnh. Hãy tự tay kéo thả những tờ tiền này vào đúng các ô trong <strong>Sổ Chi Tiêu Thần Kỳ</strong> nhé, hãy lập kế hoạch chi tiêu thông minh cho ước mơ của mình nhé.</p>
        <p>💡 <strong>Lời khuyên siêu cấp từ Finchi:</strong> Đừng tiêu hết ngay một lúc nhé! Mỗi ngày “nhét ống heo” một tờ tiền, hũ Tiết Kiệm của bạn sẽ sớm béo mầm cho xem. Cùng thử nào!</p>
      </div>
      <div class="monthly-meta">
        <span class="meta-pill">Kho tiền: ${state.moneyBoard.bank.length} tờ chưa xếp</span>
        <span class="meta-pill">Tổng tiền hiện có: ${formatMoney(totalMoney)}</span>
        <span class="meta-pill">Nhóm hiện có: ${Object.keys(state.moneyBoard.categories).length}</span>
      </div>
      <div class="knowledge-card">
        <strong>Các mệnh giá bé đang sở hữu</strong>
        <div class="money-snapshot-grid">${snapshotMarkup}</div>
      </div>
      <div class="knowledge-card">
        <strong>Kho tiền</strong>
        <div class="money-bank note-bank">${state.moneyBoard.bank.length ? state.moneyBoard.bank.map(item => renderMoneyBoardItem(item, false, state.selectedMoneyBoardItemId === item.id)).join('') : '<span class="subtitle">Kho tiền đã được xếp hết rồi.</span>'}</div>
      </div>
      <div class="category-grid monthly-zones">${categoriesMarkup}</div>
      <div class="inline-actions">
        <button class="btn-secondary" id="monthly-reset">Làm mới sổ chi tiêu</button>
        <button class="btn-primary" id="monthly-submit" ${state.moneyBoard.bank.length || !totalMoney ? 'disabled' : ''}>Nộp sổ chi tiêu</button>
      </div>
    </div>
  `);

  bindMoneyBoardEvents();
  document.getElementById('monthly-reset').onclick = resetMoneyBoard;
  document.getElementById('monthly-submit').onclick = submitMonthlyBoard;
}

function renderMoneyBoardItem(item, assigned = false, selected = false) {
  return `
    <button class="money-note ${assigned ? 'assigned' : ''} ${selected ? 'selected' : ''}" draggable="true" data-money-item="${item.id}" ${assigned ? 'data-money-assigned="true"' : ''}>
      <img src="${item.image}" alt="${escapeHtml(item.label)}">
      <span>${escapeHtml(item.label)}</span>
      <small>Giá trị tờ tiền: ${formatMoney(item.value || 0)}</small>
    </button>
  `;
}

function bindMoneyBoardEvents() {
  document.querySelectorAll('[data-money-item]').forEach(button => {
    button.addEventListener('dragstart', event => {
      event.dataTransfer.setData('text/plain', button.dataset.moneyItem);
    });
    button.addEventListener('click', () => {
      const itemId = button.dataset.moneyItem;
      if (button.dataset.moneyAssigned === 'true') {
        moveMoneyBoardItem(itemId, null);
        return;
      }
      state.selectedMoneyBoardItemId = state.selectedMoneyBoardItemId === itemId ? null : itemId;
      renderMonthlyBoard();
    });
  });

  document.querySelectorAll('[data-money-zone]').forEach(zone => {
    zone.addEventListener('dragover', event => {
      event.preventDefault();
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', event => {
      event.preventDefault();
      zone.classList.remove('drag-over');
      moveMoneyBoardItem(event.dataTransfer.getData('text/plain'), zone.dataset.moneyZone);
    });
    zone.addEventListener('click', () => {
      if (state.selectedMoneyBoardItemId) moveMoneyBoardItem(state.selectedMoneyBoardItemId, zone.dataset.moneyZone);
    });
  });
}

function moveMoneyBoardItem(itemId, targetZone) {
  let item = null;
  state.moneyBoard.bank = state.moneyBoard.bank.filter(note => {
    if (note.id === itemId) { item = note; return false; }
    return true;
  });
  Object.keys(state.moneyBoard.categories).forEach(name => {
    state.moneyBoard.categories[name] = state.moneyBoard.categories[name].filter(note => {
      if (note.id === itemId) { item = note; return false; }
      return true;
    });
  });
  if (!item) return;
  if (targetZone && state.moneyBoard.categories[targetZone]) {
    state.moneyBoard.categories[targetZone].push(item);
  } else {
    state.moneyBoard.bank.push(item);
  }
  state.selectedMoneyBoardItemId = null;
  renderMonthlyBoard();
}

function resetMoneyBoard() {
  state.selectedMoneyBoardItemId = null;
  state.moneyBoard.sourceMoney = Number(state.player.totalMoney || 0);
  state.moneyBoard.bank = createMoneyBankFromBalance(state.player.totalMoney);
  Object.keys(state.moneyBoard.categories).forEach(name => {
    state.moneyBoard.categories[name] = [];
  });
  if (state.screen === 'monthly') renderMonthlyBoard();
}

function setupVideoGate({ videoElementId, fallbackId, buttonId, source, subtitle, fallbackSeconds, fallbackStatusId, onFinish }) {
  const video = document.getElementById(videoElementId);
  const fallback = document.getElementById(fallbackId);
  const button = document.getElementById(buttonId);
  const status = fallbackStatusId ? document.getElementById(fallbackStatusId) : null;
  let completed = false;

  button.onclick = () => {
    if (completed) onFinish();
  };

  function unlock() {
    completed = true;
    button.disabled = false;
  }

  if (!source) {
    runFallbackTimer();
    return;
  }

  video.src = source;
  if (subtitle) {
    Array.from(video.querySelectorAll('track')).forEach(track => track.remove());
    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.label = 'Tiếng Việt';
    track.srclang = 'vi';
    track.src = subtitle;
    track.default = true;
    video.appendChild(track);
  }
  video.addEventListener('loadeddata', () => {
    fallback.style.display = 'none';
    video.classList.add('lesson-video-ready');
    try {
      const tracks = video.textTracks;
      if (tracks && tracks[0]) tracks[0].mode = 'showing';
    } catch (error) {}
  });

  video.addEventListener('ended', () => {
    unlock();
    showToast('Đã xem xong video.');
  });

  video.addEventListener('error', () => {
    video.style.display = 'none';
    fallback.style.display = 'grid';
    runFallbackTimer();
  }, { once: true });

  function runFallbackTimer() {
    video.style.display = 'none';
    fallback.style.display = 'grid';
    let remaining = fallbackSeconds;
    if (status) status.textContent = `Vui lòng đọc nội dung demo trong ${remaining} giây…`;
    const timer = setInterval(() => {
      remaining -= 1;
      if (status) status.textContent = remaining > 0 ? `Vui lòng đọc nội dung demo trong ${remaining} giây…` : 'Bạn có thể tiếp tục.';
      if (remaining <= 0) {
        clearInterval(timer);
        unlock();
      }
    }, 1000);
  }
}

function hasWatchedLevel(levelId) {
  const watched = JSON.parse(sessionStorage.getItem('finchi-watched-levels') || '[]');
  return watched.includes(levelId);
}

function markWatchedLevel(levelId) {
  const watched = JSON.parse(sessionStorage.getItem('finchi-watched-levels') || '[]');
  if (!watched.includes(levelId)) {
    watched.push(levelId);
    sessionStorage.setItem('finchi-watched-levels', JSON.stringify(watched));
  }
}

function burstConfetti() {
  const wrapper = document.createElement('div');
  wrapper.className = 'confetti';
  for (let i = 0; i < 28; i += 1) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = ['#ffd870', '#5dbb8c', '#7eb6ff', '#ff8b8b'][i % 4];
    piece.style.animationDelay = `${Math.random() * 0.25}s`;
    wrapper.appendChild(piece);
  }
  document.body.appendChild(wrapper);
  setTimeout(() => wrapper.remove(), 2200);
}

function burstMilestoneFlare(mark, message) {
  const overlay = document.createElement('div');
  overlay.className = 'milestone-overlay';
  overlay.innerHTML = `
    <div class="milestone-popup">
      <div class="milestone-popup-fire">🔥</div>
      <strong>Chạm mốc ${mark}</strong>
      <p>${escapeHtml(message)}</p>
      <div class="milestone-stars">✨ ⭐ ✨</div>
    </div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => overlay.classList.add('show'), 20);
  setTimeout(() => {
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 300);
  }, 2100);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2400);
}

function attachCommonActions() {
  document.querySelector('[data-action="go-home"]')?.addEventListener('click', () => goTo(state.account?.role === 'parent' ? 'parent' : 'map'));
  document.querySelector('[data-action="go-back"]')?.addEventListener('click', () => goBack());
  document.querySelector('[data-action="open-shop"]')?.addEventListener('click', () => goTo('shop'));
  document.querySelector('[data-action="open-monthly"]')?.addEventListener('click', () => goTo('monthly'));
  document.querySelector('[data-action="open-leaderboard"]')?.addEventListener('click', () => goTo('leaderboard'));
  document.querySelector('[data-action="open-tournament"]')?.addEventListener('click', () => goTo('tournament'));
  document.querySelector('[data-action="open-clans"]')?.addEventListener('click', async () => {
    await refreshClans().catch(() => {});
    goTo('clans');
  });
  document.querySelector('[data-action="open-journal"]')?.addEventListener('click', () => goTo('dreamJournal'));
  document.querySelector('[data-action="open-parent"]')?.addEventListener('click', () => goTo('parent'));
  document.querySelector('[data-action="open-ai-review"]')?.addEventListener('click', () => goTo('aiReview'));
  document.querySelector('[data-action="open-profile"]')?.addEventListener('click', () => goTo('profile'));
  document.querySelector('[data-action="refresh-live"]')?.addEventListener('click', () => manualLiveRefresh(true));
  document.querySelector('[data-action="logout"]')?.addEventListener('click', logoutAccount);
}

function awardScore(points, reason = '') {
  const value = Number(points || 0);
  if (!value) return;
  const activeTournament = getActiveTournament();
  state.player.finchiScore = Number(state.player.finchiScore || 0) + value;
  state.player.scoreBuckets.daily += value;
  state.player.scoreBuckets.weekly += value;
  state.player.scoreBuckets.monthly += value;
  if (activeTournament && (!state.currentLevelId || activeTournament.eligibleLevels.includes(state.currentLevelId) || reason.includes('Sổ chi tiêu'))) {
    state.player.scoreBuckets.tournamentWeekly += value;
  }
}

function getLiveRefreshLabel() {
  const lastTick = state.liveRefresh?.lastTick || 0;
  if (!lastTick) return 'Tự cập nhật mỗi 12 giây';
  const diff = Math.max(0, Math.round((Date.now() - lastTick) / 1000));
  return diff < 2 ? 'Vừa cập nhật xong' : `Cập nhật ${diff} giây trước`;
}

async function manualLiveRefresh(showMessage = false) {
  await refreshRankings();
  state.liveRefresh.lastTick = Date.now();
  if (state.screen === 'leaderboard') renderLeaderboard();
  if (state.screen === 'tournament') renderTournament();
  if (state.screen === 'profile') renderProfile();
  if (state.screen === 'parent') renderParentDashboard();
  if (showMessage) showToast('Đã cập nhật bảng xếp hạng và giải đấu mới nhất.');
}

function stopLiveRefresh() {
  if (state.liveRefresh?.timer) {
    clearInterval(state.liveRefresh.timer);
    state.liveRefresh.timer = null;
  }
  state.liveRefresh.context = '';
}

function startLiveRefresh(context) {
  if (state.liveRefresh.context === context && state.liveRefresh.timer) return;
  stopLiveRefresh();
  state.liveRefresh.context = context;
  state.liveRefresh.lastTick = Date.now();
  state.liveRefresh.timer = setInterval(async () => {
    try {
      await refreshRankings();
      state.liveRefresh.lastTick = Date.now();
      if (state.screen === context) {
        if (context === 'leaderboard') renderLeaderboard();
        else if (context === 'tournament') renderTournament();
        else if (context === 'profile') renderProfile();
        else if (context === 'parent') renderParentDashboard();
      }
    } catch {
      // ignore transient refresh errors
    }
  }, state.liveRefresh.intervalMs);
}

function syncLiveRefreshForScreen() {
  stopLiveRefresh();
}

function recordRankSnapshot(mode, entries) {
  if (!state.player) return;
  const currentName = state.player.name || state.account?.username || 'Người chơi Finchi';
  const current = entries.find(entry => entry.name === currentName || entry.isCurrent);
  if (!current) return;
  const lastSameMode = [...(state.player.rankHistory || [])].reverse().find(item => item.mode === mode);
  if (lastSameMode && Number(lastSameMode.rank) === Number(current.rank) && Number(lastSameMode.score) === Number(current.score)) {
    return;
  }
  const snapshot = {
    mode,
    rank: Number(current.rank || 0),
    score: Number(current.score || 0),
    capturedAt: new Date().toISOString(),
    label: leaderboardLabels[mode] || 'Sự kiện'
  };
  state.player.rankHistory.push(snapshot);
  if (state.player.rankHistory.length > 36) {
    state.player.rankHistory = state.player.rankHistory.slice(-36);
  }
  savePlayer();
}

function getBestRank(mode) {
  const items = (state.player.rankHistory || []).filter(item => item.mode === mode);
  if (!items.length) return null;
  return items.reduce((best, item) => (!best || item.rank < best.rank ? item : best), null);
}

function formatHistoryTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'vừa xong';
  return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

function getRecentProfileMoments() {
  const history = [...(state.player.rankHistory || [])].reverse().slice(0, 8);
  if (!history.length) {
    return [{ title: 'Hành trình vừa bắt đầu', detail: 'Hoàn thành level đầu tiên để lưu mốc thành tích đầu tiên của bé nhé!', icon: '🌱', time: 'Ngay bây giờ' }];
  }
  return history.map(item => ({
    title: `${item.label}: hạng #${item.rank}`,
    detail: `Finchi Score lúc ghi nhận: ${item.score}`,
    icon: item.mode === 'monthly' ? '👑' : item.mode === 'weekly' ? '🏆' : item.mode === 'daily' ? '⭐' : '🎯',
    time: formatHistoryTime(item.capturedAt)
  }));
}

function getAiInterventionMoments(limit = 6) {
  const aiState = ensureAiPlayerState();
  const history = [...(aiState.interventionHistory || [])].reverse().slice(0, limit);
  if (!history.length) {
    return [{
      title: 'AI Agent đang chờ ngữ cảnh đầu tiên',
      detail: 'Khi bé làm quiz, đứng lâu hoặc cần gợi ý, FINCHI sẽ lưu lại các lần hỗ trợ ở đây.',
      icon: '🐷',
      time: 'Sắp có dữ liệu'
    }];
  }
  return history.map(item => {
    const meta = aiModule?.getCharacterMeta?.(item.characterState || 'idle') || { icon: '🐷', label: 'AI học tập FINCHI' };
    return {
      title: item.title || meta.label,
      detail: item.message || 'FINCHI vừa hỗ trợ trong bài học.',
      icon: meta.icon,
      time: formatHistoryTime(item.createdAt)
    };
  });
}

function renderProfile() {
  const bestDaily = getBestRank('daily');
  const bestWeekly = getBestRank('weekly');
  const bestMonthly = getBestRank('monthly');
  const badges = getPlayerBadges();
  const recentMoments = getRecentProfileMoments();
  const aiMoments = getAiInterventionMoments(6);
  const avatar = avatars.find(item => item.id === state.player.avatarId) || avatars[0];
  const todayStats = getTodayStudyStats();
  const weakestLevel = getWeakestLevelInsight();
  const weakestSkill = getWeakestSkillInsight();
  const latestMysteryBox = getLatestMysteryBox();
  shell(`
    <div class="profile-panel">
      <div class="panel-toolbar">
        <div>
          <span class="badge">Hồ sơ người chơi</span>
          <h1 class="section-title">Theo dõi hành trình và lịch sử thành tích của bé</h1>
          <p class="section-subtitle">Màn này lưu lại những mốc nổi bật: thứ hạng tốt nhất, badge đã mở, điểm danh Mystery Box, tiến độ học hôm nay và các lần bé vươn lên trên bảng xếp hạng.</p>
        </div>
        <div class="live-refresh-box compact">
          <strong>Phụ huynh có thể xem gì?</strong>
          <span>Thời gian học hôm nay, số câu đúng, level yếu và kỹ năng còn cần rèn thêm đều đã được lưu tại đây.</span>
        </div>
      </div>
      <div class="profile-hero-card ${getLevelScene(Math.max(1, state.player.completedLevels.slice(-1)[0] || 1)).tone}">
        <div class="profile-hero-copy">
          <div class="logo-wrap" style="align-items:flex-start; gap: 16px;">
            <img src="${avatar.image}" alt="${avatar.name}" style="width:88px;height:88px;">
            <div>
              <h2 style="margin:0; font-size:2rem;">${escapeHtml(state.player.name || state.account?.username || 'Người chơi Finchi')}</h2>
              <p class="section-subtitle" style="margin:8px 0 0;">Tài khoản: <strong>${escapeHtml(state.account?.username || 'demo')}</strong> · Nhân vật: ${escapeHtml(avatar.name)}</p>
              <div class="badge-cloud" style="margin-top:10px;">${badges.map(badge => `<span class="badge-chip ${badge.tone || ''}">${badge.icon} ${escapeHtml(badge.name)}</span>`).join('') || '<span class="badge-chip">🌟 Chưa có badge</span>'}</div>
            </div>
          </div>
        </div>
        <div class="profile-hero-stats">
          <div class="mini-stat"><strong>${state.player.completedLevels.length}</strong><span>Level đã hoàn thành</span></div>
          <div class="mini-stat"><strong>${state.player.savingStreak}</strong><span>Chuỗi tiết kiệm</span></div>
          <div class="mini-stat"><strong>${formatMoney(state.player.totalMoney)}</strong><span>Ví tiền hiện có</span></div>
          <div class="mini-stat"><strong>⭐ ${state.player.finchiScore}</strong><span>Finchi Score tổng</span></div>
          <div class="mini-stat"><strong>${formatStudyDuration(todayStats.studySeconds)}</strong><span>Học hôm nay</span></div>
          <div class="mini-stat"><strong>${todayStats.correct}/${todayStats.questions || 0}</strong><span>Câu đúng hôm nay</span></div>
        </div>
      </div>

      <div class="profile-grid">
        <section class="card">
          <h2 class="section-title" style="font-size:1.55rem;">Hạng tốt nhất từng đạt</h2>
          <div class="profile-rank-grid">
            <div class="rank-card-mini"><span>Ngày</span><strong>${bestDaily ? '#' + bestDaily.rank : '—'}</strong><small>${bestDaily ? bestDaily.score + ' điểm' : 'Chưa có dữ liệu'}</small></div>
            <div class="rank-card-mini"><span>Tuần</span><strong>${bestWeekly ? '#' + bestWeekly.rank : '—'}</strong><small>${bestWeekly ? bestWeekly.score + ' điểm' : 'Chưa có dữ liệu'}</small></div>
            <div class="rank-card-mini"><span>Tháng</span><strong>${bestMonthly ? '#' + bestMonthly.rank : '—'}</strong><small>${bestMonthly ? bestMonthly.score + ' điểm' : 'Chưa có dữ liệu'}</small></div>
            <div class="rank-card-mini"><span>Giải tuần</span><strong>${(state.serverLeaderboards.tournament || []).find(item => item.name === (state.player.name || state.account?.username))?.rank ? '#' + (state.serverLeaderboards.tournament || []).find(item => item.name === (state.player.name || state.account?.username)).rank : '—'}</strong><small>${state.player.scoreBuckets.tournamentWeekly} điểm sự kiện</small></div>
          </div>
        </section>
        <section class="card">
          <h2 class="section-title" style="font-size:1.55rem;">Bộ sưu tập thành tích</h2>
          <div class="history-list">${recentMoments.map(item => `
            <div class="history-item">
              <div class="history-icon">${item.icon}</div>
              <div>
                <strong>${escapeHtml(item.title)}</strong>
                <div class="subtitle">${escapeHtml(item.detail)}</div>
              </div>
              <small>${escapeHtml(item.time)}</small>
            </div>`).join('')}</div>
        </section>
      </div>

      <div class="profile-grid">
        <section class="card">
          <h2 class="section-title" style="font-size:1.55rem;">Phân tích học tập hôm nay</h2>
          <div class="profile-rank-grid">
            <div class="rank-card-mini"><span>Thời gian học</span><strong>${formatStudyDuration(todayStats.studySeconds)}</strong><small>${todayStats.completedLevels.length} level hoàn thành trong ngày</small></div>
            <div class="rank-card-mini"><span>Số câu đúng</span><strong>${todayStats.correct}</strong><small>Trên ${todayStats.questions || 0} câu đã làm</small></div>
            <div class="rank-card-mini"><span>Level cần chú ý</span><strong>${weakestLevel ? escapeHtml(weakestLevel.title) : 'Ổn định'}</strong><small>${weakestLevel ? `${Math.round(weakestLevel.accuracy * 100)}% chính xác` : 'Chưa có dữ liệu đủ để đánh giá'}</small></div>
            <div class="rank-card-mini"><span>Kỹ năng cần rèn</span><strong>${weakestSkill ? escapeHtml(weakestSkill.title) : 'Đều tay'}</strong><small>${weakestSkill ? `Con đang yếu ở kỹ năng ${escapeHtml(weakestSkill.title).toLowerCase()}.` : 'Hiện chưa thấy kỹ năng nào yếu rõ rệt.'}</small></div>
          </div>
        </section>
        <section class="card">
          <h2 class="section-title" style="font-size:1.55rem;">Mystery Box & phụ huynh</h2>
          <div class="history-list">
            <div class="history-item">
              <div class="history-icon">${latestMysteryBox ? latestMysteryBox.icon : '📦'}</div>
              <div>
                <strong>${latestMysteryBox ? escapeHtml(latestMysteryBox.name) : 'Mystery Box 30 ngày'}</strong>
                <div class="subtitle">${latestMysteryBox ? `Hộp gần nhất tặng ${formatMoney(latestMysteryBox.amount)}.` : 'Đăng nhập mỗi ngày để nhận một phong bao khích lệ từ 1.000đ tới 10.000đ.'}</div>
              </div>
              <small>${Number(state.player.dailyCheckin?.totalClaims || 0)}/30</small>
            </div>
            <div class="history-item">
              <div class="history-icon">👨‍👩‍👧</div>
              <div>
                <strong>${state.player.parentAccess?.linked ? `Đã liên kết với ${escapeHtml(state.player.parentAccess.parentName || 'phụ huynh')}` : 'Chưa có tài khoản phụ huynh'}</strong>
                <div class="subtitle">${state.player.parentAccess?.linked ? 'Phụ huynh có thể đăng nhập từ trang mở đầu để xem dashboard theo dõi tiến độ của bé.' : 'Ở trang mở đầu, phụ huynh có thể chọn tab "Phụ huynh" để tạo tài khoản liên kết.'}</div>
              </div>
              <small>${state.player.parentAccess?.linked ? 'Đã bật' : 'Chưa bật'}</small>
            </div>
          </div>
        </section>
      </div>

      <div class="profile-grid">
        <section class="card">
          <h2 class="section-title" style="font-size:1.55rem;">Nhật ký AI Coach</h2>
          <div class="history-list">${aiMoments.map(item => `
            <div class="history-item">
              <div class="history-icon">${item.icon}</div>
              <div>
                <strong>${escapeHtml(item.title)}</strong>
                <div class="subtitle">${escapeHtml(item.detail)}</div>
              </div>
              <small>${escapeHtml(item.time)}</small>
            </div>
          `).join('')}</div>
        </section>
        <section class="card">
          <h2 class="section-title" style="font-size:1.55rem;">AI đang theo dõi gì?</h2>
          <div class="history-list">
            <div class="history-item">
              <div class="history-icon">📍</div>
              <div>
                <strong>Ngữ cảnh bài học</strong>
                <div class="subtitle">FINCHI theo dõi level hiện tại, câu hỏi đang làm, kỹ năng của level và thời gian bé dừng trên từng câu.</div>
              </div>
              <small>Realtime</small>
            </div>
            <div class="history-item">
              <div class="history-icon">🧠</div>
              <div>
                <strong>Thói quen sai lặp</strong>
                <div class="subtitle">Nếu bé sai nhiều lần ở cùng một kỹ năng, AI sẽ đổi từ nhắc nhẹ sang hỗ trợ rõ hơn và gợi ý luyện dễ hơn.</div>
              </div>
              <small>An toàn</small>
            </div>
            <div class="history-item">
              <div class="history-icon">👨‍👩‍👧</div>
              <div>
                <strong>Báo cáo phụ huynh</strong>
                <div class="subtitle">Mỗi lần phụ huynh mở dashboard, AI sẽ tóm tắt ngắn gọn: hôm nay học bao lâu, đúng bao nhiêu câu, level nào và kỹ năng nào cần chú ý.</div>
              </div>
              <small>Summary</small>
            </div>
          </div>
        </section>
      </div>

      <div class="profile-grid">
        <section class="card">
          <h2 class="section-title" style="font-size:1.55rem;">Learning Memory đã kiểm chứng</h2>
          <p class="section-subtitle">Đây là các điều FINCHI chỉ ghi nhớ lâu dài sau khi phản hồi của bé đã được kiểm chứng hoặc duyệt.</p>
          ${renderLearningMemoryCards(5)}
        </section>
      </div>

      <div class="profile-grid">
        <section class="card">
          <h2 class="section-title" style="font-size:1.55rem;">Lịch sử chinh phục đảo</h2>
          <div class="history-list">${state.player.completedLevels.length ? state.player.completedLevels.slice().reverse().map(levelId => {
            const level = state.levels.find(item => item.id === levelId);
            const scene = getLevelScene(levelId);
            return `<div class="history-item"><div class="history-icon">${scene.icon}</div><div><strong>Level ${levelId} · ${escapeHtml(level?.title || 'Đảo thử thách')}</strong><div class="subtitle">${escapeHtml(scene.title)} · Đã hoàn thành</div></div><small>${escapeHtml(scene.title)}</small></div>`;
          }).join('') : '<p class="section-subtitle">Bé chưa hoàn thành level nào. Hãy bắt đầu từ Đảo 1 nhé!</p>'}</div>
        </section>
        <section class="card">
          <h2 class="section-title" style="font-size:1.55rem;">Phần thưởng mùa giải & vật phẩm</h2>
          <div class="badge-cloud">${badges.map(badge => `<span class="badge-chip ${badge.tone || ''}">${badge.icon} ${escapeHtml(badge.name)}</span>`).join('') || '<span class="badge-chip">🌱 Hãy mở badge đầu tiên</span>'}</div>
          <div class="money-bank" style="margin-top:14px;">${state.player.ownedRewardItems.length ? state.player.ownedRewardItems.map(id => {
            const item = state.shopItems.find(shop => shop.id === id);
            return `<span class="money-chip">${item ? escapeHtml(item.name) : escapeHtml(id)}</span>`;
          }).join('') : '<span class="money-chip">Chưa có vật phẩm đổi thưởng</span>'}</div>
        </section>
      </div>
    </div>
  `);

  if (!state.learningMemory.items.length && !state.learningMemory.loading && !state.learningMemory.lastLoadedAt) {
    ensureLearningMemoryLoaded().then(() => {
      if (state.screen === 'profile') renderProfile();
    }).catch(() => {});
  }
}

function getActiveTournament() {
  return state.tournaments?.weekly || null;
}

function getPlayerBadges() {
  const badges = [];
  Object.values(LEVEL_BADGES).forEach(badge => {
    if (state.player.earnedBadgeIds.includes(badge.id)) badges.push(badge);
  });
  if (state.player.savingStreak >= 5) badges.push({ icon: '🐷', name: 'Nhà tiết kiệm nhí', tone: 'tone-pink' });
  if (state.player.scoreBuckets.weekly >= 180) badges.push({ icon: '📚', name: 'Người học đều nhất', tone: 'tone-green' });
  if (state.player.scoreBuckets.monthly >= 360) badges.push({ icon: '⭐', name: 'Siêu sao kiến thức tài chính', tone: 'tone-blue' });
  if (state.player.totalMoney >= 80000) badges.push({ icon: '🪙', name: 'Bậc thầy phân loại tiền', tone: 'tone-gold' });
  return badges;
}

function getLeaderboardEntries(mode = 'daily') {
  const scoreMap = { daily: state.player.scoreBuckets.daily, weekly: state.player.scoreBuckets.weekly, monthly: state.player.scoreBuckets.monthly };
  const currentName = state.player.name || state.account?.username || 'Người chơi Finchi';
  const remoteEntries = (state.serverLeaderboards?.[mode] || []).map(item => ({ ...item, isCurrent: item.name === currentName }));
  const source = remoteEntries.length
    ? remoteEntries
    : [
        ...fallbackLeaderboardSeeds[mode].map(item => ({ ...item, badges: [] })),
        {
          name: currentName,
          avatarId: state.player.avatarId || avatars[0].id,
          score: Number(scoreMap[mode] || 0),
          isCurrent: true,
          badges: getPlayerBadges().slice(0, 2)
        }
      ].sort((a, b) => b.score - a.score).map((entry, index) => ({ ...entry, rank: index + 1 }));

  const withCurrent = source.some(entry => entry.name === currentName)
    ? source.map((entry, index) => ({ ...entry, rank: entry.rank || index + 1, isCurrent: entry.name === currentName }))
    : [{ name: currentName, avatarId: state.player.avatarId || avatars[0].id, score: Number(scoreMap[mode] || 0), isCurrent: true, rank: source.length + 1 }, ...source]
      .sort((a, b) => b.score - a.score)
      .map((entry, index) => ({ ...entry, rank: index + 1, isCurrent: entry.name === currentName }));
  return withCurrent;
}

function renderLeaderboard() {
  const mode = state.leaderboardTab || 'daily';
  const entries = getLeaderboardEntries(mode);
  recordRankSnapshot(mode, entries);
  const currentEntry = entries.find(entry => entry.isCurrent) || entries[entries.length - 1];
  const podium = entries.slice(0, 3);
  const tabs = ['daily', 'weekly', 'monthly'].map(tab => `
    <button class="tab-btn ${mode === tab ? 'active' : ''}" data-rank-tab="${tab}">${leaderboardLabels[tab]}</button>
  `).join('');
  const list = entries.slice(0, 10).map(entry => {
    const avatar = avatars.find(item => item.id === entry.avatarId) || avatars[0];
    return `
      <div class="leaderboard-row ${entry.isCurrent ? 'is-current' : ''}">
        <div class="leaderboard-rank">#${entry.rank}</div>
        <div class="leaderboard-player">
          <img src="${avatar.image}" alt="${escapeHtml(entry.name)}">
          <div>
            <strong>${escapeHtml(entry.name)}</strong>
            <div class="subtitle">${entry.isCurrent ? 'Hạng của bạn' : 'Người chơi Finchi'}</div>
          </div>
        </div>
        <div class="leaderboard-score">⭐ ${entry.score}</div>
      </div>
    `;
  }).join('');
  shell(`
    <div class="leaderboard-panel">
      <div class="leaderboard-head">
        <div>
          <span class="badge">Bảng xếp hạng Finchi</span>
          <h1 class="section-title">Theo dõi thành tích học tập của bé</h1>
          <p class="section-subtitle">Điểm Finchi Score dựa trên việc học đều, trả lời đúng và hoàn thành thử thách. Bảng xếp hạng giúp bé thấy mình tiến bộ từng ngày.</p>
        </div>
        <div class="leaderboard-tabs">${tabs}</div>
      </div>
      <div class="rank-highlight">
        <div class="rank-highlight-main">
          <strong>Hạng của bạn</strong>
          <div class="rank-number">#${currentEntry.rank}</div>
          <p class="subtitle">${leaderboardLabels[mode]} này bé có <strong>${currentEntry.score}</strong> điểm Finchi Score.</p>
          <div class="inline-actions" style="margin-top:10px;"><button class="btn-secondary" data-action="open-profile">Xem hồ sơ của bé</button></div>
          <div class="badge-cloud">${getPlayerBadges().map(badge => `<span class="badge-chip ${badge.tone || ''}">${badge.icon} ${escapeHtml(badge.name)}</span>`).join('') || '<span class="subtitle">Chưa có badge</span>'}</div>
        </div>
        <div class="rank-highlight-side">
          <strong>Top 3 ${leaderboardLabels[mode].toLowerCase()}</strong>
          <div class="podium">${podium.map((entry, index) => {
            const avatar = avatars.find(item => item.id === entry.avatarId) || avatars[0];
            const medal = ['🥈', '🥇', '🥉'][index] || '🏅';
            return `<div class="podium-card podium-${index + 1}"><span class="podium-medal">${medal}</span><img src="${avatar.image}" alt="${escapeHtml(entry.name)}"><strong>${escapeHtml(entry.name)}</strong><small>⭐ ${entry.score}</small></div>`;
          }).join('')}</div>
        </div>
      </div>
      <div class="leaderboard-list">${list}</div>
    </div>
  `);
  document.querySelectorAll('[data-rank-tab]').forEach(button => {
    button.onclick = () => {
      state.leaderboardTab = button.dataset.rankTab;
      renderLeaderboard();
    };
  });
}

function getTournamentTasksProgress() {
  const tournament = getActiveTournament();
  if (!tournament) return [];
  return tournament.tasks.map(task => {
    let current = 0;
    if (task.type === 'complete_level') {
      current = state.player.completedLevels.includes(task.levelId) ? 1 : 0;
    } else if (task.type === 'score_weekly') {
      current = state.player.scoreBuckets.weekly;
    } else if (task.type === 'streak') {
      current = state.player.savingStreak;
    }
    return { ...task, current, done: current >= task.target };
  });
}

function renderTournament() {
  const weekly = state.tournaments?.weekly;
  const monthly = state.tournaments?.monthly;
  const weeklyTasks = getTournamentTasksProgress();
  const tournamentRemote = (state.serverLeaderboards?.tournament || []).map(entry => ({ ...entry, isCurrent: entry.name === (state.player.name || state.account?.username || 'Người chơi Finchi') }));
  const eventBoard = (tournamentRemote.length ? tournamentRemote : getLeaderboardEntries('weekly').map(entry => ({ ...entry, score: entry.isCurrent ? state.player.scoreBuckets.tournamentWeekly : Math.max(80, entry.score - 120) }))).sort((a, b) => b.score - a.score).map((entry, index) => ({ ...entry, rank: index + 1 }));
  recordRankSnapshot('tournament', eventBoard);
  const eventRows = eventBoard.slice(0, 8).map(entry => {
    const avatar = avatars.find(item => item.id === entry.avatarId) || avatars[0];
    return `<div class="leaderboard-row ${entry.isCurrent ? 'is-current' : ''}"><div class="leaderboard-rank">#${entry.rank}</div><div class="leaderboard-player"><img src="${avatar.image}" alt="${escapeHtml(entry.name)}"><div><strong>${escapeHtml(entry.name)}</strong><div class="subtitle">${entry.isCurrent ? 'Điểm sự kiện của bạn' : weekly.theme}</div></div></div><div class="leaderboard-score">🏆 ${entry.score}</div></div>`;
  }).join('');
  shell(`
    <div class="tournament-panel">
      <div class="tournament-hero">
        <div class="tournament-copy">
          <span class="badge">Giải đấu Finchi</span>
          <h1 class="section-title">Mini-tournament & mùa giải giáo dục</h1>
          <p class="section-subtitle">Các giải đấu giúp bé có động lực học đều, rèn tư duy tài chính và được vinh danh bằng badge, sticker và phần thưởng trong game.</p>
          <div class="tournament-pill-row">
            <span class="meta-pill">Giải tuần: ${escapeHtml(weekly.title)}</span>
            <span class="meta-pill">${escapeHtml(weekly.endsInLabel)}</span>
            <span class="meta-pill">Điểm sự kiện của bạn: ${state.player.scoreBuckets.tournamentWeekly}</span>
            <span class="meta-pill">${getLiveRefreshLabel()}</span>
          </div>
          <div class="inline-actions" style="margin-top:12px;">
            <button class="btn-secondary" data-action="refresh-live">Làm mới bảng giải đấu</button>
            <button class="btn-secondary" data-action="open-profile">Xem hồ sơ thành tích</button>
          </div>
        </div>
        <div class="tournament-card-primary">
          <strong>${escapeHtml(weekly.theme)}</strong>
          <p>${escapeHtml(weekly.description)}</p>
          <div class="badge-cloud"><span class="badge-chip tone-gold">🏅 ${escapeHtml(weekly.reward)}</span></div>
        </div>
      </div>
      <div class="tournament-layout">
        <section class="card tournament-task-card">
          <h2 class="section-title" style="font-size:1.6rem;">Nhiệm vụ sự kiện tuần</h2>
          <div class="tournament-task-list">
            ${weeklyTasks.map(task => `<div class="tournament-task ${task.done ? 'done' : ''}"><div><strong>${escapeHtml(task.label)}</strong><div class="subtitle">Tiến độ: ${task.current}/${task.target}</div></div><span class="task-points">+${task.points}</span></div>`).join('')}
          </div>
        </section>
        <section class="card tournament-leaderboard-card">
          <h2 class="section-title" style="font-size:1.6rem;">Bảng xếp hạng sự kiện</h2>
          <div class="leaderboard-list compact">${eventRows}</div>
        </section>
      </div>
      <div class="season-grid">
        <div class="card season-card">
          <span class="season-icon">📅</span>
          <strong>${escapeHtml(monthly.title)}</strong>
          <p class="subtitle">${escapeHtml(monthly.description)}</p>
          <div class="meta-pill">${escapeHtml(monthly.reward)}</div>
        </div>
        <div class="card season-card">
          <span class="season-icon">🎖️</span>
          <strong>Danh hiệu phụ</strong>
          <div class="badge-cloud">
            <span class="badge-chip tone-green">📚 Người học đều nhất</span>
            <span class="badge-chip tone-pink">🐷 Nhà tiết kiệm nhí</span>
            <span class="badge-chip tone-blue">💝 Người chia sẻ tích cực</span>
          </div>
        </div>
      </div>
    </div>
  `);
}

async function refreshClans(force = false) {
  state.clansLoading = true;
  try {
    const payload = await fetchJson('/api/clans', {
      ttlMs: API_CACHE_TTL_MS,
      cacheKey: 'clans',
      force
    });
    state.clans = Array.isArray(payload.clans) ? payload.clans : [];
    state.clansLoaded = true;
  } catch (error) {
    state.clansLoaded = true;
    throw error;
  } finally {
    state.clansLoading = false;
  }
  return state.clans;
}

function renderClans() {
  if (!state.clansLoaded && !state.clansLoading) {
    refreshClans().then(() => renderClans()).catch(() => renderClans());
  }
  const currentClanId = state.player.clan?.id || '';
  const currentClan = state.clans.find(item => item.id === currentClanId) || state.player.clan || null;
  const availableClans = state.clans.filter(item => item.id !== currentClanId);
  shell(`
    <div class="social-panel">
      <div class="panel-toolbar">
        <div>
          <span class="badge">Clan / lớp học</span>
          <h1 class="section-title">Tham gia nhóm bạn cùng sở thích học tài chính</h1>
          <p class="section-subtitle">Mỗi bạn có thể tự lập clan, mời bạn bè cùng tham gia hoặc gia nhập một lớp học có chủ đề mình thích.</p>
        </div>
        <div class="live-refresh-box compact">
          <strong>Tổng clan hiện có</strong>
          <span>${state.clansLoading ? 'Đang tải dữ liệu clan...' : `${state.clans.length} clan đang hoạt động`}</span>
        </div>
      </div>

      <div class="profile-grid">
        <section class="card">
          <h2 class="section-title" style="font-size:1.55rem;">Clan của bé</h2>
          ${currentClan ? `
            <div class="clan-card current">
              <div class="clan-card-head">
                <div>
                  <strong>${escapeHtml(currentClan.name || 'Clan của bé')}</strong>
                  <div class="subtitle">${escapeHtml(currentClan.focus || 'Nhóm học chung')}</div>
                </div>
                <span class="meta-pill">${currentClan.memberCount || currentClan.members?.length || 1} thành viên</span>
              </div>
              <p class="section-subtitle">${escapeHtml(currentClan.description || 'Clan này đang cùng nhau học đều mỗi ngày và chia sẻ mục tiêu tài chính.')}</p>
              <div class="badge-cloud">${(currentClan.members || []).map(member => {
                const avatar = avatars.find(item => item.id === member.avatarId) || avatars[0];
                return `<span class="badge-chip tone-blue"><img src="${avatar.image}" alt="${escapeHtml(member.name)}" class="inline-avatar"> ${escapeHtml(member.name)}</span>`;
              }).join('') || `<span class="badge-chip tone-blue">${escapeHtml(state.player.name || 'Bạn')} đang là thành viên đầu tiên</span>`}</div>
              <div class="inline-actions" style="margin-top:16px;">
                <button class="btn-secondary" id="refresh-clans">Làm mới clan</button>
                <button class="btn-ghost" id="leave-clan">Rời clan</button>
              </div>
            </div>
          ` : `
            <div class="empty-state">Bé chưa tham gia clan nào. Có thể tạo nhóm riêng hoặc gia nhập một clan có sẵn phía dưới.</div>
          `}
        </section>

        <section class="card">
          <h2 class="section-title" style="font-size:1.55rem;">Tạo clan mới</h2>
          <div class="form-group">
            <label class="label" for="clanName">Tên clan / lớp học</label>
            <input id="clanName" class="input" maxlength="32" placeholder="Ví dụ: Heo Tiết Kiệm, Lớp 5A Finchi">
          </div>
          <div class="form-group">
            <label class="label" for="clanFocus">Chủ đề yêu thích</label>
            <input id="clanFocus" class="input" maxlength="40" placeholder="Ví dụ: Tiết kiệm, mua sắm thông minh, đầu tư nhí">
          </div>
          <div class="form-group">
            <label class="label" for="clanDescription">Mô tả ngắn</label>
            <textarea id="clanDescription" class="input textarea-input" rows="4" placeholder="Nhóm này cùng nhau học tài chính, thi đua điểm danh và chinh phục badge..."></textarea>
          </div>
          <div class="inline-actions">
            <button class="btn-primary" id="create-clan" ${currentClan ? 'disabled' : ''}>Tạo clan</button>
          </div>
        </section>
      </div>

      <section class="card">
        <h2 class="section-title" style="font-size:1.55rem;">Khám phá clan đang mở</h2>
        ${availableClans.length ? `<div class="clan-grid">${availableClans.map(clan => `
          <article class="clan-card">
            <div class="clan-card-head">
              <div>
                <strong>${escapeHtml(clan.name)}</strong>
                <div class="subtitle">${escapeHtml(clan.focus || 'Nhóm học chung')}</div>
              </div>
              <span class="meta-pill">${clan.memberCount || 1} thành viên</span>
            </div>
            <p class="section-subtitle">${escapeHtml(clan.description || 'Clan này đang cùng nhau học tài chính và tích lũy thành tích.')}</p>
            <div class="badge-cloud">${(clan.members || []).slice(0, 4).map(member => {
              const avatar = avatars.find(item => item.id === member.avatarId) || avatars[0];
              return `<span class="badge-chip"><img src="${avatar.image}" alt="${escapeHtml(member.name)}" class="inline-avatar"> ${escapeHtml(member.name)}</span>`;
            }).join('')}</div>
            <div class="inline-actions" style="margin-top:14px;">
              <button class="btn-secondary" data-join-clan="${escapeHtml(clan.id)}" ${currentClan ? 'disabled' : ''}>Tham gia clan này</button>
            </div>
          </article>
        `).join('')}</div>` : '<div class="empty-state">Hiện chưa có clan nào khác. Bé có thể là người đầu tiên tạo nhóm mới.</div>'}
      </section>
    </div>
  `);

  document.getElementById('refresh-clans')?.addEventListener('click', async () => {
    await refreshClans().catch(error => showToast(error.message));
    renderClans();
  });

  document.getElementById('create-clan')?.addEventListener('click', async () => {
    const name = document.getElementById('clanName').value.trim();
    const focus = document.getElementById('clanFocus').value.trim();
    const description = document.getElementById('clanDescription').value.trim();
    const id = slugifyClanName(name);
    if (!name || !focus) {
      showToast('Hãy nhập tên clan và chủ đề yêu thích.');
      return;
    }
    if (!id) {
      showToast('Tên clan chưa hợp lệ.');
      return;
    }
    if (state.clans.some(clan => clan.id === id)) {
      showToast('Tên clan này đã tồn tại. Hãy chọn tên khác.');
      return;
    }
    state.player.clan = {
      id,
      name,
      focus,
      description,
      joinedAt: new Date().toISOString()
    };
    renderClans();
    savePlayer();
    refreshClans(true).then(() => renderClans()).catch(() => {});
    showToast(`Đã tạo clan ${name}.`);
  });

  document.getElementById('leave-clan')?.addEventListener('click', async () => {
    state.player.clan = null;
    renderClans();
    savePlayer();
    refreshClans(true).then(() => renderClans()).catch(() => {});
    showToast('Đã rời clan hiện tại.');
  });

  document.querySelectorAll('[data-join-clan]').forEach(button => {
    button.addEventListener('click', async () => {
      const clan = state.clans.find(item => item.id === button.dataset.joinClan);
      if (!clan) return;
      state.player.clan = {
        id: clan.id,
        name: clan.name,
        focus: clan.focus || '',
        description: clan.description || '',
        joinedAt: new Date().toISOString()
      };
      renderClans();
      savePlayer();
      refreshClans(true).then(() => renderClans()).catch(() => {});
      showToast(`Đã tham gia clan ${clan.name}.`);
    });
  });
}

function renderDreamJournal() {
  const dreams = [...(state.player.dreamJournal || [])].reverse();
  shell(`
    <div class="social-panel">
      <div class="panel-toolbar">
        <div>
          <span class="badge">Nhật ký ước mơ</span>
          <h1 class="section-title">Bé ghi lại mục tiêu và ước mơ của mình</h1>
          <p class="section-subtitle">Đây là nơi bé đặt mục tiêu bản thân, ghi lại điều mình muốn tiết kiệm để đạt được và đánh dấu khi đã hoàn thành.</p>
        </div>
      </div>

      <div class="profile-grid">
        <section class="card">
          <h2 class="section-title" style="font-size:1.55rem;">Tạo mục tiêu mới</h2>
          <div class="form-group">
            <label class="label" for="dreamTitle">Tên mục tiêu</label>
            <input id="dreamTitle" class="input" maxlength="48" placeholder="Ví dụ: Mua bộ truyện yêu thích">
          </div>
          <div class="form-group">
            <label class="label" for="dreamDate">Ngày mong muốn hoàn thành</label>
            <input id="dreamDate" class="input" type="date">
          </div>
          <div class="form-group">
            <label class="label" for="dreamNote">Ghi chú ước mơ</label>
            <textarea id="dreamNote" class="input textarea-input" rows="4" placeholder="Con muốn tiết kiệm bao nhiêu? Vì sao mục tiêu này quan trọng với con?"></textarea>
          </div>
          <div class="inline-actions">
            <button class="btn-primary" id="save-dream">Lưu mục tiêu</button>
          </div>
        </section>

        <section class="card">
          <h2 class="section-title" style="font-size:1.55rem;">Danh sách mục tiêu</h2>
          ${dreams.length ? `<div class="dream-list">${dreams.map(dream => `
            <article class="dream-card ${dream.done ? 'done' : ''}">
              <div class="clan-card-head">
                <div>
                  <strong>${escapeHtml(dream.title)}</strong>
                  <div class="subtitle">${dream.targetDate ? `Mốc hoàn thành: ${escapeHtml(dream.targetDate)}` : 'Chưa đặt ngày hoàn thành'}</div>
                </div>
                <span class="meta-pill">${dream.done ? 'Đã hoàn thành' : 'Đang theo đuổi'}</span>
              </div>
              <p class="section-subtitle">${escapeHtml(dream.note || 'Bé chưa ghi chú thêm cho mục tiêu này.')}</p>
              <div class="inline-actions">
                <button class="btn-secondary" data-dream-toggle="${dream.id}">${dream.done ? 'Mở lại mục tiêu' : 'Đánh dấu đã đạt'}</button>
                <button class="btn-ghost" data-dream-delete="${dream.id}">Xóa</button>
              </div>
            </article>
          `).join('')}</div>` : '<div class="empty-state">Chưa có mục tiêu nào. Bé hãy ghi ước mơ đầu tiên để Finchi đồng hành nhé!</div>'}
        </section>
      </div>
    </div>
  `);

  document.getElementById('save-dream')?.addEventListener('click', () => {
    const title = document.getElementById('dreamTitle').value.trim();
    const targetDate = document.getElementById('dreamDate').value.trim();
    const note = document.getElementById('dreamNote').value.trim();
    if (!title) {
      showToast('Hãy nhập tên mục tiêu trước nhé.');
      return;
    }
    state.player.dreamJournal.push({
      id: `dream-${Date.now()}`,
      title,
      targetDate,
      note,
      done: false,
      createdAt: new Date().toISOString()
    });
    savePlayer();
    renderDreamJournal();
    showToast('Đã lưu mục tiêu mới vào nhật ký ước mơ.');
  });

  document.querySelectorAll('[data-dream-toggle]').forEach(button => {
    button.addEventListener('click', () => {
      const dream = state.player.dreamJournal.find(item => item.id === button.dataset.dreamToggle);
      if (!dream) return;
      dream.done = !dream.done;
      dream.updatedAt = new Date().toISOString();
      savePlayer();
      renderDreamJournal();
    });
  });

  document.querySelectorAll('[data-dream-delete]').forEach(button => {
    button.addEventListener('click', () => {
      state.player.dreamJournal = state.player.dreamJournal.filter(item => item.id !== button.dataset.dreamDelete);
      savePlayer();
      renderDreamJournal();
      showToast('Đã xóa mục tiêu khỏi nhật ký.');
    });
  });
}

function renderParentDashboard() {
  const todayStats = getTodayStudyStats();
  const weakestLevel = getWeakestLevelInsight();
  const weakestSkill = getWeakestSkillInsight();
  const aiMoments = getAiInterventionMoments(5);
  const completedCount = state.player.completedLevels.length;
  const dreamPreview = [...(state.player.dreamJournal || [])].reverse().slice(0, 3);
  const avatar = avatars.find(item => item.id === state.player.avatarId) || avatars[0];

  shell(`
    <div class="parent-panel">
      <div class="panel-toolbar">
        <div>
          <span class="badge">Dashboard phụ huynh</span>
          <h1 class="section-title">Theo dõi tiến độ học tài chính của con</h1>
          <p class="section-subtitle">Bảng này tổng hợp đúng theo dữ liệu người chơi đã lưu lại: thời gian học, số câu đúng, level cần chú ý, kỹ năng còn yếu và các mục tiêu con đang theo đuổi.</p>
        </div>
        <div class="live-refresh-box">
          <strong>Phụ huynh đang xem</strong>
          <span>${escapeHtml(state.account?.parentName || 'Phụ huynh')} · tài khoản của bé ${escapeHtml(state.player.name || state.account?.username || 'Người chơi Finchi')}</span>
        </div>
      </div>

      <div class="profile-hero-card ${getLevelScene(Math.max(1, state.player.completedLevels.slice(-1)[0] || 1)).tone}">
        <div class="profile-hero-copy">
          <div class="logo-wrap" style="align-items:flex-start; gap: 16px;">
            <img src="${avatar.image}" alt="${avatar.name}" style="width:88px;height:88px;">
            <div>
              <h2 style="margin:0; font-size:2rem;">${escapeHtml(state.player.name || state.account?.username || 'Người chơi Finchi')}</h2>
              <p class="section-subtitle" style="margin:8px 0 0;">Tài khoản học sinh: <strong>${escapeHtml(state.account?.username || 'demo')}</strong> · Nhân vật: ${escapeHtml(avatar.name)}</p>
              <div class="badge-cloud" style="margin-top:10px;">${getPlayerBadges().slice(0, 6).map(badge => `<span class="badge-chip ${badge.tone || ''}">${badge.icon} ${escapeHtml(badge.name)}</span>`).join('') || '<span class="badge-chip">Chưa có badge nào</span>'}</div>
            </div>
          </div>
        </div>
        <div class="profile-hero-stats">
          <div class="mini-stat"><strong>${formatStudyDuration(todayStats.studySeconds)}</strong><span>Hôm nay học bao lâu</span></div>
          <div class="mini-stat"><strong>${todayStats.correct}</strong><span>Đúng bao nhiêu câu hôm nay</span></div>
          <div class="mini-stat"><strong>${completedCount}/10</strong><span>Level đã hoàn thành</span></div>
          <div class="mini-stat"><strong>⭐ ${state.player.finchiScore}</strong><span>Finchi Score tổng</span></div>
        </div>
      </div>

      <div class="profile-grid">
        ${renderParentAiSummaryCard()}
        <section class="card ai-parent-summary">
          <div class="ai-parent-head">
            <div class="ai-sidebar-orb">🧾</div>
            <div>
              <strong>Lịch sử AI hỗ trợ gần đây</strong>
              <div class="subtitle">Những lần FINCHI vừa can thiệp trong hành trình học của con.</div>
            </div>
          </div>
          <div class="history-list" style="margin-top:16px;">${aiMoments.map(item => `
            <div class="history-item">
              <div class="history-icon">${item.icon}</div>
              <div>
                <strong>${escapeHtml(item.title)}</strong>
                <div class="subtitle">${escapeHtml(item.detail)}</div>
              </div>
              <small>${escapeHtml(item.time)}</small>
            </div>
          `).join('')}</div>
        </section>
      </div>

      <div class="profile-grid">
        <section class="card">
          <h2 class="section-title" style="font-size:1.55rem;">Điểm cần chú ý</h2>
          <div class="history-list">
            <div class="history-item">
              <div class="history-icon">📘</div>
              <div>
                <strong>${weakestLevel ? escapeHtml(weakestLevel.title) : 'Chưa có level yếu nổi bật'}</strong>
                <div class="subtitle">${weakestLevel ? `Đây là level có độ chính xác thấp nhất hiện tại: ${Math.round(weakestLevel.accuracy * 100)}% (${weakestLevel.correct}/${weakestLevel.attempts} câu).` : 'Con mới bắt đầu nên chưa có đủ dữ liệu để kết luận level yếu.'}</div>
              </div>
              <small>${weakestLevel ? 'Level yếu' : 'Đang theo dõi'}</small>
            </div>
            <div class="history-item">
              <div class="history-icon">🧠</div>
              <div>
                <strong>${weakestSkill ? escapeHtml(weakestSkill.title) : 'Chưa có kỹ năng yếu rõ rệt'}</strong>
                <div class="subtitle">${weakestSkill ? `Con đang yếu ở kỹ năng ${escapeHtml(weakestSkill.title).toLowerCase()}. Hãy cho con luyện thêm các câu hỏi cùng nhóm này.` : 'Hiện chưa có kỹ năng nào yếu rõ rệt; Finchi sẽ tiếp tục cập nhật khi bé học thêm.'}</div>
              </div>
              <small>${weakestSkill ? 'Kỹ năng yếu' : 'Ổn định'}</small>
            </div>
          </div>
        </section>
        <section class="card">
          <h2 class="section-title" style="font-size:1.55rem;">Báo cáo nhanh cho phụ huynh</h2>
          <div class="profile-rank-grid">
            <div class="rank-card-mini"><span>Số câu đã làm</span><strong>${todayStats.questions}</strong><small>Trong ngày hôm nay</small></div>
            <div class="rank-card-mini"><span>Chuỗi đăng nhập</span><strong>${Number(state.player.dailyCheckin?.streak || 0)} ngày</strong><small>${Number(state.player.dailyCheckin?.totalClaims || 0)}/30 Mystery Box</small></div>
            <div class="rank-card-mini"><span>Ước mơ đang theo đuổi</span><strong>${(state.player.dreamJournal || []).filter(item => !item.done).length}</strong><small>Mục tiêu còn đang mở</small></div>
            <div class="rank-card-mini"><span>Clan / lớp học</span><strong>${escapeHtml(state.player.clan?.name || 'Chưa tham gia')}</strong><small>${escapeHtml(state.player.clan?.focus || 'Có thể vào màn Clan để tham gia')}</small></div>
          </div>
        </section>
      </div>

      <div class="profile-grid">
        <section class="card">
          <h2 class="section-title" style="font-size:1.55rem;">Nhật ký ước mơ của con</h2>
          ${dreamPreview.length ? `<div class="dream-list">${dreamPreview.map(dream => `
            <article class="dream-card ${dream.done ? 'done' : ''}">
              <strong>${escapeHtml(dream.title)}</strong>
              <div class="subtitle">${dream.targetDate ? `Mốc: ${escapeHtml(dream.targetDate)}` : 'Chưa đặt mốc hoàn thành'}</div>
              <p class="section-subtitle">${escapeHtml(dream.note || 'Con chưa ghi thêm ghi chú cho mục tiêu này.')}</p>
            </article>
          `).join('')}</div>` : '<div class="empty-state">Con chưa ghi mục tiêu nào trong nhật ký ước mơ.</div>'}
        </section>
        <section class="card">
          <h2 class="section-title" style="font-size:1.55rem;">Certificate hoàn thành</h2>
          <p class="section-subtitle">${state.player.completedLevels.includes(10) ? 'Con đã hoàn thành level 10. Có thể xuất giấy chứng nhận PDF từ nút bên dưới.' : 'Certificate sẽ được mở khi con vượt qua level 10.'}</p>
          <div class="inline-actions">
            <button class="btn-secondary" data-action="open-journal">Mở nhật ký ước mơ</button>
            <button class="btn-secondary" data-action="open-clans">Mở clan / lớp học</button>
            ${state.player.completedLevels.includes(10) ? '<button class="btn-primary" id="parent-open-certificate">Xuất certificate PDF</button>' : ''}
          </div>
        </section>
      </div>

      <div class="profile-grid">
        <section class="card">
          <h2 class="section-title" style="font-size:1.55rem;">Learning Memory của con</h2>
          <p class="section-subtitle">Những suy luận hợp lý đã được FINCHI xác minh sẽ được giữ lại ở đây để lần sau AI hiểu bé tốt hơn.</p>
          ${renderLearningMemoryCards(4)}
        </section>
      </div>
    </div>
  `);

  document.getElementById('parent-open-certificate')?.addEventListener('click', () => goTo('certificate'));
  document.getElementById('refresh-parent-ai')?.addEventListener('click', async () => {
    await ensureParentAiSummary(true);
    renderParentDashboard();
  });
  document.getElementById('parent-ai-explain')?.addEventListener('click', async () => {
    await requestParentMistakeExplanation();
  });
  document.getElementById('parent-report-ai')?.addEventListener('click', () => {
    const level = state.lastMissionAttempt ? state.levels.find(item => item.id === state.lastMissionAttempt.levelId) : null;
    const question = level?.questions?.find(item => item.id === state.lastMissionAttempt?.questionId) || null;
    openCorrectionFeedbackModal({
      feedbackType: 'parent_reports_error',
      level,
      question,
      source: 'parent',
      title: 'Phụ huynh báo AI chấm sai'
    });
  });
  if (!state.aiRuntime.parentSummary && !state.aiRuntime.parentSummaryLoading) {
    ensureParentAiSummary().then(summary => {
      if (summary && state.screen === 'parent') renderParentDashboard();
    }).catch(() => {});
  }
  if (!state.learningMemory.items.length && !state.learningMemory.loading && !state.learningMemory.lastLoadedAt) {
    ensureLearningMemoryLoaded().then(() => {
      if (state.screen === 'parent') renderParentDashboard();
    }).catch(() => {});
  }
}

function buildCertificateHtml() {
  const playerName = escapeHtml(state.player.name || state.account?.username || 'Học sinh Finchi');
  const issueDate = new Date(state.player.certificate?.unlockedAt || Date.now()).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const templateUrl = `${window.location.origin}${CERTIFICATE_ART_PLACEHOLDER}`;
  return `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <title>Certificate - ${playerName}</title>
      <style>
        @page { size: landscape; margin: 0; }
        body { margin: 0; font-family: Georgia, "Times New Roman", serif; background: #f4efe4; }
        .sheet {
          width: 1123px;
          height: 872px;
          margin: 0 auto;
          position: relative;
          box-sizing: border-box;
        }
        .sheet img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: fill;
        }
        .name-mask {
          position: absolute;
          left: 72px;
          top: 272px;
          width: 520px;
          height: 96px;
          background: rgba(255,255,255,0.95);
        }
        .player-name {
          position: absolute;
          left: 82px;
          top: 258px;
          width: 510px;
          color: #8c208a;
          font-size: 66px;
          line-height: 1;
          font-family: Georgia, "Times New Roman", serif;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .player-note {
          position: absolute;
          left: 82px;
          top: 370px;
          width: 530px;
          color: #505b7d;
          font-size: 18px;
          line-height: 1.4;
          background: rgba(255,255,255,0.9);
          padding: 4px 6px;
        }
        .issue-date {
          position: absolute;
          left: 84px;
          top: 444px;
          color: #ffffff;
          font-weight: 700;
          font-size: 23px;
          background: rgba(140, 32, 138, 0.98);
          padding: 6px 14px;
        }
        .completion-stamp {
          position: absolute;
          right: 92px;
          top: 84px;
          color: #1d4ca1;
          font-size: 18px;
          font-weight: 700;
          background: rgba(255,255,255,0.9);
          padding: 6px 12px;
          border-radius: 999px;
        }
      </style>
    </head>
    <body>
      <div class="sheet">
        <img src="${templateUrl}" alt="Finchi certificate template">
        <div class="completion-stamp">Hoàn thành 10/10 level</div>
        <div class="name-mask"></div>
        <div class="player-name">${playerName}</div>
        <div class="player-note">Bé đã hoàn thành toàn bộ hành trình FINCHI EDU và được trao danh hiệu <strong>Đại Sứ Tài Chính Nhí</strong>.</div>
        <div class="issue-date">Ngày cấp: ${issueDate}</div>
      </div>
      <script>
        window.onload = () => setTimeout(() => window.print(), 300);
      </script>
    </body>
    </html>
  `;
}

function exportCertificatePdf() {
  const popup = window.open('', '_blank', 'width=1200,height=860');
  if (!popup) {
    showToast('Trình duyệt đã chặn cửa sổ xuất PDF.');
    return;
  }
  state.player.certificate.printedAt = new Date().toISOString();
  savePlayer();
  popup.document.open();
  popup.document.write(buildCertificateHtml());
  popup.document.close();
}

function renderCertificate() {
  if (!state.player.completedLevels.includes(10)) {
    shell(`
      <div class="social-panel">
        <div class="card">
          <span class="badge">Certificate hoàn thành</span>
          <h1 class="section-title">Chứng chỉ sẽ mở ở level 10</h1>
          <p class="section-subtitle">Bé cần hoàn thành level 10 để mở khóa giấy chứng nhận PDF.</p>
        </div>
      </div>
    `);
    return;
  }
  const issueDate = new Date(state.player.certificate?.unlockedAt || Date.now()).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const previewName = escapeHtml(state.player.name || state.account?.username || 'Học sinh Finchi');
  shell(`
    <div class="social-panel">
      <div class="panel-toolbar">
        <div>
          <span class="badge">Certificate hoàn thành</span>
          <h1 class="section-title">Xuất giấy chứng nhận PDF cho bé</h1>
          <p class="section-subtitle">Mẫu certificate hiện đã dùng đúng ảnh bạn cung cấp. Tên người chơi và ngày cấp sẽ được chèn động khi xuất PDF.</p>
        </div>
      </div>
      <div class="card certificate-preview">
        <div class="certificate-template">
          <img src="${CERTIFICATE_ART_PLACEHOLDER}" alt="Mẫu certificate" class="certificate-template-img">
          <div class="certificate-completion-badge">Hoàn thành 10/10 level</div>
          <div class="certificate-name-mask"></div>
          <div class="certificate-name-overlay">${previewName}</div>
          <div class="certificate-note-overlay">Bé đã hoàn thành toàn bộ hành trình FINCHI EDU và được trao danh hiệu <strong>Đại Sứ Tài Chính Nhí</strong>.</div>
          <div class="certificate-date-overlay">Ngày cấp: ${escapeHtml(issueDate)}</div>
        </div>
        <div class="certificate-copy" style="margin-top:18px;">
          <div class="badge">FINCHI EDU CERTIFICATE</div>
          <h2>Giấy chứng nhận hoàn thành</h2>
          <strong>${previewName}</strong>
          <p>Đã hoàn thành hành trình 10 level tài chính cá nhân cơ bản và nhận danh hiệu <strong>Vua Finchi</strong>.</p>
          <small>Ngày mở khóa: ${escapeHtml(issueDate)}</small>
        </div>
        <div class="inline-actions" style="margin-top:16px;">
          <button class="btn-primary" id="export-certificate-pdf">Xuất certificate PDF</button>
          <button class="btn-secondary" data-action="open-profile">Quay về hồ sơ</button>
        </div>
      </div>
    </div>
  `);

  document.getElementById('export-certificate-pdf')?.addEventListener('click', exportCertificatePdf);
}

function submitMonthlyBoard() {
  if (state.moneyBoard.bank.length) {
    showToast('Hãy xếp hết các tờ tiền vào sổ chi tiêu trước nhé.');
    return;
  }
  const currentMonth = monthKey();
  if (state.player.lastMonthlyBoardScoreMonth === currentMonth) {
    showToast('Tháng này bé đã nhận điểm từ Sổ chi tiêu rồi.');
    return;
  }
  state.player.lastMonthlyBoardScoreMonth = currentMonth;
  awardScore(20, 'Sổ chi tiêu hoàn chỉnh');
  savePlayer();
  showToast('Tuyệt lắm! Bé nhận thêm 20 Finchi Score từ Sổ chi tiêu.');
  renderMonthlyBoard();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

window.addEventListener('beforeunload', () => {
  flushStudySession();
  savePlayerLocal();
  flushAiEventBatchSync();
});

init();
