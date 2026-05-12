(function initFinchiAi(global) {
  const DEFAULT_SETTINGS = {
    voiceEnabled: false,
    voiceRate: 1,
    speakOnHint: true,
    speakOnWrong: true,
    speakOnCelebrate: true,
    speakOnSummary: false
  };

  const CHARACTER_META = {
    idle: { icon: '🐷', label: 'FINCHI đang quan sát', tone: 'tone-ai-idle' },
    thinking: { icon: '🤔', label: 'FINCHI đang suy nghĩ', tone: 'tone-ai-thinking' },
    hint: { icon: '💡', label: 'FINCHI đang gợi ý', tone: 'tone-ai-hint' },
    wrong_soft: { icon: '🌱', label: 'FINCHI đang nhắc nhẹ', tone: 'tone-ai-wrong' },
    encourage: { icon: '🛟', label: 'FINCHI đang hỗ trợ', tone: 'tone-ai-encourage' },
    celebrate: { icon: '🎉', label: 'FINCHI đang chúc mừng', tone: 'tone-ai-celebrate' },
    parent_summary: { icon: '📘', label: 'Tóm tắt cho phụ huynh', tone: 'tone-ai-parent' }
  };

  const FORBIDDEN_PATTERNS = [
    /kiếm tiền nhanh/gi,
    /vay nợ/gi,
    /đầu tư ngoài đời/gi,
    /thu thập dữ liệu nhạy cảm/gi
  ];
  const SPEECH_CACHE_TTL_MS = 15000;
  let lastSpokenMessage = {
    text: '',
    at: 0
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value || 0)));
  }

  function limitList(list, maxSize) {
    return Array.isArray(list) ? list.slice(-maxSize) : [];
  }

  function stripSpeechText(text) {
    return String(text || '')
      .replace(/[🥉🥈🥇👑💎🐷🤔💡🌱🛟🎉📘]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function applySafety(message) {
    let safeMessage = String(message || '').replace(/\s+/g, ' ').trim();
    if (!safeMessage) {
      safeMessage = 'FINCHI luôn hỗ trợ con trong phạm vi bài học đang làm nhé.';
    }
    FORBIDDEN_PATTERNS.forEach(pattern => {
      safeMessage = safeMessage.replace(pattern, 'học tài chính an toàn');
    });
    if (safeMessage.length > 220) {
      safeMessage = `${safeMessage.slice(0, 217).trim()}...`;
    }
    return safeMessage;
  }

  function createDefaultPlayerState() {
    return {
      settings: { ...DEFAULT_SETTINGS },
      studentAge: 8,
      questionAttempts: {},
      hintUsage: {},
      repeatedMistakesBySkill: {},
      correctStreak: 0,
      eventHistory: [],
      interventionHistory: [],
      lastLearningState: null,
      lastParentSummary: null
    };
  }

  function normalizePlayerState(rawState) {
    const next = rawState && typeof rawState === 'object'
      ? rawState
      : createDefaultPlayerState();
    if (!next.settings || typeof next.settings !== 'object') next.settings = { ...DEFAULT_SETTINGS };
    next.settings = {
      ...DEFAULT_SETTINGS,
      ...next.settings,
      voiceEnabled: Boolean(next.settings.voiceEnabled),
      speakOnHint: next.settings.speakOnHint !== false,
      speakOnWrong: next.settings.speakOnWrong !== false,
      speakOnCelebrate: next.settings.speakOnCelebrate !== false,
      speakOnSummary: Boolean(next.settings.speakOnSummary),
      voiceRate: clamp(next.settings.voiceRate || 1, 0.85, 1.15)
    };
    next.studentAge = Number(next.studentAge || 8);
    if (!next.questionAttempts || typeof next.questionAttempts !== 'object') next.questionAttempts = {};
    if (!next.hintUsage || typeof next.hintUsage !== 'object') next.hintUsage = {};
    if (!next.repeatedMistakesBySkill || typeof next.repeatedMistakesBySkill !== 'object') next.repeatedMistakesBySkill = {};
    next.correctStreak = Number(next.correctStreak || 0);
    next.eventHistory = limitList(next.eventHistory, 120);
    next.interventionHistory = limitList(next.interventionHistory, 40);
    if (!next.lastLearningState || typeof next.lastLearningState !== 'object') next.lastLearningState = null;
    if (!next.lastParentSummary || typeof next.lastParentSummary !== 'object') next.lastParentSummary = null;
    return next;
  }

  function createRuntimeState() {
    return {
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

  function getCharacterMeta(stateName) {
    return CHARACTER_META[stateName] || CHARACTER_META.idle;
  }

  function buildQuestionKey(level, question) {
    if (!level || !question) return '';
    return `${level.id}:${question.id}`;
  }

  function startQuestionTracking(runtime, level, question) {
    const questionKey = buildQuestionKey(level, question);
    if (!questionKey) return false;
    if (runtime.questionKey === questionKey) return false;
    runtime.questionKey = questionKey;
    runtime.questionStartedAt = Date.now();
    runtime.idleTriggered = false;
    return true;
  }

  function getTimeOnQuestion(runtime) {
    if (!runtime?.questionStartedAt) return 0;
    return Math.max(0, Math.round((Date.now() - runtime.questionStartedAt) / 1000));
  }

  function noteHintUsage(aiState, questionId) {
    aiState.hintUsage[questionId] = Number(aiState.hintUsage[questionId] || 0) + 1;
    return aiState.hintUsage[questionId];
  }

  function appendEvent(aiState, entry) {
    aiState.eventHistory.push({
      ...entry,
      createdAt: new Date().toISOString()
    });
    aiState.eventHistory = limitList(aiState.eventHistory, 120);
  }

  function appendIntervention(aiState, response) {
    aiState.interventionHistory.push({
      ...response,
      createdAt: response.createdAt || new Date().toISOString()
    });
    aiState.interventionHistory = limitList(aiState.interventionHistory, 40);
  }

  function updateRepeatedMistake(aiState, skillTag, isCorrect) {
    const key = skillTag || 'Tư duy tài chính';
    const current = Number(aiState.repeatedMistakesBySkill[key] || 0);
    if (isCorrect) {
      aiState.repeatedMistakesBySkill[key] = Math.max(0, current - 1);
    } else {
      aiState.repeatedMistakesBySkill[key] = current + 1;
    }
    return Number(aiState.repeatedMistakesBySkill[key] || 0);
  }

  function buildLearningState(aiState, runtime, payload) {
    const skillTag = payload.skillTag || 'Tư duy tài chính';
    const attemptCount = Number(payload.attemptCount || aiState.questionAttempts[payload.questionId] || 0);
    const hintUsed = Number(payload.hintUsed ?? (aiState.hintUsage[payload.questionId] || 0));
    const timeOnQuestion = Number(payload.timeOnQuestion || getTimeOnQuestion(runtime));
    const mistakeCountSkill = Number(payload.mistakeCountSkill || aiState.repeatedMistakesBySkill[skillTag] || 0);
    const emotionSignal = payload.emotionSignal
      || (payload.isCorrect ? 'confident' : (attemptCount >= 2 || timeOnQuestion > 30 ? 'struggling' : 'thinking'));
    const learningState = {
      role: payload.role || 'student',
      studentId: payload.studentId || '',
      parentId: payload.parentId || '',
      age: Number(payload.age || aiState.studentAge || 8),
      currentPage: payload.currentPage || '',
      currentLesson: payload.currentLesson || '',
      currentMission: payload.currentMission || '',
      currentLevelId: Number(payload.currentLevelId || 0),
      questionId: payload.questionId || '',
      questionPrompt: payload.questionPrompt || '',
      selectedAnswer: payload.selectedAnswer || '',
      isCorrect: payload.isCorrect === true,
      attemptCount,
      hintUsed,
      timeOnQuestion,
      skillTag,
      correctStreak: Number(payload.correctStreak || aiState.correctStreak || 0),
      mistakeCountSkill,
      mistakePattern: Array.isArray(payload.mistakePattern) ? payload.mistakePattern : [],
      emotionSignal,
      weakSkill: payload.weakSkill || '',
      weakLevel: payload.weakLevel || '',
      childProgressStatus: payload.childProgressStatus || (mistakeCountSkill >= 3 ? 'needs_support' : 'on_track'),
      todayStudySeconds: Number(payload.todayStudySeconds || 0),
      todayQuestions: Number(payload.todayQuestions || 0),
      todayCorrect: Number(payload.todayCorrect || 0),
      completedLevelsCount: Number(payload.completedLevelsCount || 0),
      playerName: payload.playerName || '',
      parentName: payload.parentName || ''
    };
    aiState.lastLearningState = learningState;
    return learningState;
  }

  function recordStudentSubmission(aiState, runtime, payload) {
    const questionId = payload.questionId || '';
    const nextAttempt = Number(aiState.questionAttempts[questionId] || 0) + 1;
    aiState.questionAttempts[questionId] = nextAttempt;
    aiState.correctStreak = payload.isCorrect ? Number(aiState.correctStreak || 0) + 1 : 0;
    const mistakeCountSkill = updateRepeatedMistake(aiState, payload.skillTag, payload.isCorrect);
    appendEvent(aiState, {
      role: 'student',
      eventType: payload.isCorrect ? 'student_answer_correct' : 'student_answer_wrong',
      questionId,
      skillTag: payload.skillTag || '',
      attemptCount: nextAttempt,
      mistakeCountSkill
    });
    return buildLearningState(aiState, runtime, {
      ...payload,
      attemptCount: nextAttempt,
      correctStreak: aiState.correctStreak,
      mistakeCountSkill
    });
  }

  function recordPassiveEvent(aiState, runtime, eventType, payload) {
    appendEvent(aiState, {
      role: payload.role || 'student',
      eventType,
      questionId: payload.questionId || '',
      skillTag: payload.skillTag || ''
    });
    return buildLearningState(aiState, runtime, payload);
  }

  function resetMissionProgress(aiState, runtime, payload = {}) {
    const questionIds = Array.isArray(payload.questionIds) ? payload.questionIds : [];
    questionIds.forEach(questionId => {
      delete aiState.questionAttempts[questionId];
      delete aiState.hintUsage[questionId];
    });
    if (payload.skillTag) {
      aiState.repeatedMistakesBySkill[payload.skillTag] = 0;
    }
    aiState.correctStreak = 0;
    if (runtime) {
      runtime.questionKey = '';
      runtime.questionStartedAt = 0;
      runtime.idleTriggered = false;
    }
    appendEvent(aiState, {
      role: payload.role || 'student',
      eventType: payload.eventType || 'student_started_quiz_attempt',
      questionId: '',
      skillTag: payload.skillTag || ''
    });
    return aiState;
  }

  function decideTrigger(eventType, learningState) {
    if (eventType === 'student_requested_hint') return 'student_requested_hint';
    if (eventType === 'student_idle_too_long') return 'student_idle_too_long';
    if (eventType === 'student_completed_mission') return 'student_completed_mission';
    if (eventType === 'parent_opened_report') return 'parent_opened_report';
    if (eventType === 'parent_viewed_mistake_detail') return 'parent_viewed_mistake_detail';
    if (eventType === 'student_answer_correct' && learningState.correctStreak >= 3) return 'student_answer_correct';
    if (eventType === 'student_answer_wrong' && learningState.mistakeCountSkill >= 3) return 'student_repeated_mistake';
    if (eventType === 'student_answer_wrong') return 'student_answer_wrong';
    return '';
  }

  function buildParentSummary(context) {
    const weakSkill = context.weakSkill || 'kỹ năng cần rèn thêm';
    const weakLevel = context.weakLevel || 'một level đang cần chú ý';
    const progressStatus = context.childProgressStatus === 'needs_support'
      ? `Con đang cần hỗ trợ thêm ở ${weakSkill.toLowerCase()}.`
      : 'Con đang giữ nhịp học ổn định và tiếp tục tích lũy kỹ năng tốt.';
    const summaryMessage = `Hôm nay con học ${Math.max(1, Math.round(Number(context.todayStudySeconds || 0) / 60))} phút, làm đúng ${Number(context.todayCorrect || 0)}/${Number(context.todayQuestions || 0)} câu. ${progressStatus}`;
    const homeActivity = context.weakSkill
      ? `Tối nay, hãy cho con thử một tình huống ngắn về ${weakSkill.toLowerCase()} để con tự giải thích cách chọn đáp án.`
      : `Tối nay, hãy hỏi con kể lại một điều mới học được ở ${weakLevel.toLowerCase()} để củng cố trí nhớ.`;
    return {
      summaryMessage: applySafety(summaryMessage),
      homeActivity: applySafety(homeActivity),
      supportStatus: context.childProgressStatus || 'on_track',
      weakSkill: context.weakSkill || '',
      weakLevel: context.weakLevel || ''
    };
  }

  function buildFallbackIntervention(role, triggerEvent, context) {
    if (role === 'parent') {
      const summary = buildParentSummary(context);
      if (triggerEvent === 'parent_viewed_mistake_detail') {
        return {
          title: 'FINCHI giải thích lỗi thường gặp',
          message: context.weakSkill
            ? `Con đang hay nhầm ở kỹ năng ${context.weakSkill.toLowerCase()}. Hãy cho con giải thích thành lời trước khi chọn đáp án để luyện tư duy rõ hơn.`
            : 'Con chưa có lỗi lặp lại rõ rệt. Phụ huynh có thể tiếp tục giữ nhịp học đều để FINCHI quan sát thêm.',
          characterState: 'parent_summary',
          shouldSpeak: false,
          voiceType: 'parent-summary',
          nextAction: 'practice_at_home',
          safetyStatus: 'safe'
        };
      }
      return {
        title: 'FINCHI tóm tắt cho phụ huynh',
        message: summary.summaryMessage,
        characterState: 'parent_summary',
        shouldSpeak: false,
        voiceType: 'parent-summary',
        nextAction: 'review_dashboard',
        safetyStatus: 'safe',
        summary
      };
    }

    switch (triggerEvent) {
      case 'student_requested_hint':
        return {
          title: 'Gợi ý của FINCHI',
          message: `Con hãy đọc lại mục tiêu của câu này nhé. Hãy chọn đáp án nào gần với kỹ năng ${String(context.skillTag || 'bài học hiện tại').toLowerCase()} nhất.`,
          characterState: 'hint',
          shouldSpeak: true,
          voiceType: 'short-hint',
          nextAction: 'retry',
          safetyStatus: 'safe'
        };
      case 'student_idle_too_long':
        return {
          title: 'FINCHI nhắc nhẹ',
          message: 'Con đang phân vân đúng không? Nếu cần, hãy nhìn lại món nào cần dùng trước rồi chọn nhé.',
          characterState: 'thinking',
          shouldSpeak: true,
          voiceType: 'idle-nudge',
          nextAction: 'offer_hint',
          safetyStatus: 'safe'
        };
      case 'student_repeated_mistake':
        return {
          title: 'FINCHI đang hỗ trợ',
          message: `Con đang nhầm lặp lại ở kỹ năng ${String(context.skillTag || 'này').toLowerCase()}. Mình thử chậm lại một chút và so sánh từng lựa chọn với mục tiêu bài học nhé.`,
          characterState: 'encourage',
          shouldSpeak: true,
          voiceType: 'guided-support',
          nextAction: 'practice_easier',
          safetyStatus: 'safe'
        };
      case 'student_answer_correct':
        {
          const streak = Math.max(3, Number(context.correctStreak || 0));
        return {
          title: 'FINCHI chúc mừng',
          message: `Con đang làm rất tốt. Con đã đúng ${streak} câu liên tiếp rồi, mình tiếp tục giữ nhịp nhé!`,
          characterState: 'celebrate',
          shouldSpeak: true,
          voiceType: 'celebrate',
          nextAction: 'next_challenge',
          safetyStatus: 'safe'
        };
        }
      case 'student_completed_mission':
        return {
          title: 'FINCHI tổng kết level',
          message: `Con vừa hoàn thành một chặng học về ${String(context.currentLesson || 'tài chính cá nhân').toLowerCase()}. Hãy nhớ điều quan trọng nhất và mang nó sang level tiếp theo nhé.`,
          characterState: 'celebrate',
          shouldSpeak: true,
          voiceType: 'mission-complete',
          nextAction: 'continue',
          safetyStatus: 'safe'
        };
      case 'student_answer_wrong':
      default:
        return {
          title: 'FINCHI giải thích nhẹ',
          message: context.attemptCount >= 2
            ? 'Con thử nghĩ lại nhé. Hãy bỏ qua lựa chọn hấp dẫn nhất trước mắt và xem lựa chọn nào phù hợp mục tiêu hơn.'
            : 'Không sao đâu. Con thử đọc kỹ tình huống thêm một lần và nghĩ xem món nào thật sự cần trước nhé.',
          characterState: context.attemptCount >= 2 ? 'hint' : 'wrong_soft',
          shouldSpeak: true,
          voiceType: context.attemptCount >= 2 ? 'guided-support' : 'soft-correction',
          nextAction: 'retry',
          safetyStatus: 'safe'
        };
    }
  }

  function normalizeResponse(rawResponse, role) {
    const response = rawResponse && typeof rawResponse === 'object' ? rawResponse : {};
    const characterState = response.characterState || (role === 'parent' ? 'parent_summary' : 'idle');
    const meta = getCharacterMeta(characterState);
    return {
      title: applySafety(response.title || meta.label),
      message: applySafety(response.message || ''),
      characterState,
      shouldSpeak: Boolean(response.shouldSpeak),
      voiceType: response.voiceType || 'text',
      nextAction: response.nextAction || 'continue',
      safetyStatus: response.safetyStatus || 'safe',
      icon: meta.icon,
      tone: meta.tone,
      createdAt: response.createdAt || new Date().toISOString(),
      summary: response.summary || null
    };
  }

  function shouldSpeak(response, settings, role) {
    if (!response?.shouldSpeak || !settings?.voiceEnabled) return false;
    if (role === 'parent' && !settings.speakOnSummary) return false;
    if (response.characterState === 'hint' && !settings.speakOnHint) return false;
    if ((response.characterState === 'wrong_soft' || response.characterState === 'encourage') && !settings.speakOnWrong) return false;
    if (response.characterState === 'celebrate' && !settings.speakOnCelebrate) return false;
    return true;
  }

  function stopSpeaking() {
    if (!global.speechSynthesis) return;
    global.speechSynthesis.cancel();
  }

  function speakResponse(response, settings) {
    if (!global.speechSynthesis || !global.SpeechSynthesisUtterance) return false;
    const safeText = stripSpeechText(response?.message);
    if (!safeText) return false;
    if (lastSpokenMessage.text === safeText && Date.now() - lastSpokenMessage.at < SPEECH_CACHE_TTL_MS) {
      return false;
    }
    stopSpeaking();
    const utterance = new global.SpeechSynthesisUtterance(safeText);
    utterance.lang = 'vi-VN';
    utterance.rate = clamp(settings?.voiceRate || 1, 0.85, 1.15);
    global.speechSynthesis.speak(utterance);
    lastSpokenMessage = {
      text: safeText,
      at: Date.now()
    };
    return true;
  }

  global.FinchiAi = {
    createDefaultPlayerState,
    normalizePlayerState,
    createRuntimeState,
    getCharacterMeta,
    startQuestionTracking,
    getTimeOnQuestion,
    noteHintUsage,
    recordStudentSubmission,
    recordPassiveEvent,
    resetMissionProgress,
    decideTrigger,
    buildParentSummary,
    buildFallbackIntervention,
    normalizeResponse,
    shouldSpeak,
    speakResponse,
    stopSpeaking,
    appendIntervention
  };
})(window);
