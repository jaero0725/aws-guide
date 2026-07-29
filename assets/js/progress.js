/* ==========================================================================
   AWS SAA Guide — 진도 · 설정 저장 (progress.js)
   --------------------------------------------------------------------------
   localStorage 접근은 **전부 이 모듈을 통해서만** 합니다.
   다른 스크립트에서 localStorage 를 직접 읽고 쓰지 마세요.

   키
     ag:schema            → { v: 1 }              스키마 버전
     ag:progress:read     → string[]              읽은 page-id
     ag:progress:quiz     → { [qid]: { attempts, correct, streak, lastAt } }
     ag:progress:exams    → [{ examId, setId, mode, score, total, byDomain,
                               durationSec, at }]
     ag:progress:diagnostic → { at, byDomain:{[d]:{correct,total,pct}}, plan:[…] }
     ag:progress:cards    → { [cardId]: { seen, known, streak, graduated, lastAt } }
     ag:settings          → { theme:'auto'|'light'|'dark', fontSize:'sm'|'md'|'lg' }
     ag:quiz:session      → 진행 중인 시험 임시 상태 (새로고침 복구용)
     ag:quiz:lastResult   → 마지막 채점 결과 (quiz/result.html 이 읽음)

   저장 실패(사생활 보호 모드 · 용량 초과)에도 사이트는 동작해야 하므로
   모든 접근을 try/catch 로 감싸고 메모리 폴백을 씁니다.
   ========================================================================== */
(function (global) {
  'use strict';

  var SCHEMA_VERSION = 1;
  var PREFIX = 'ag:';

  var K = {
    schema: 'ag:schema',
    read: 'ag:progress:read',
    quiz: 'ag:progress:quiz',
    exams: 'ag:progress:exams',
    diagnostic: 'ag:progress:diagnostic',
    cards: 'ag:progress:cards',
    settings: 'ag:settings',
    session: 'ag:quiz:session',
    lastResult: 'ag:quiz:lastResult'
  };

  var GRADUATE_STREAK = 3; // 3회 연속 정답 → 졸업

  /* ---------- 저장소 추상화 ---------------------------------------------- */
  var memory = Object.create(null);
  var storageOk = (function () {
    try {
      var t = '__ag_probe__';
      global.localStorage.setItem(t, '1');
      global.localStorage.removeItem(t);
      return true;
    } catch (e) { return false; }
  })();

  function rawGet(key) {
    if (storageOk) {
      try { return global.localStorage.getItem(key); } catch (e) { /* fallthrough */ }
    }
    return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
  }
  function rawSet(key, val) {
    memory[key] = val;
    if (storageOk) {
      try { global.localStorage.setItem(key, val); return true; } catch (e) { return false; }
    }
    return false;
  }
  function rawDel(key) {
    delete memory[key];
    if (storageOk) { try { global.localStorage.removeItem(key); } catch (e) {} }
  }

  function readJSON(key, fallback) {
    var raw = rawGet(key);
    if (raw == null) return clone(fallback);
    try {
      var v = JSON.parse(raw);
      if (v == null) return clone(fallback);
      // 타입 정합성 검사 — 어긋나면 안전하게 폴백
      if (Array.isArray(fallback) !== Array.isArray(v)) return clone(fallback);
      if (typeof fallback === 'object' && typeof v !== 'object') return clone(fallback);
      return v;
    } catch (e) {
      return clone(fallback);
    }
  }
  function writeJSON(key, value) {
    try { return rawSet(key, JSON.stringify(value)); } catch (e) { return false; }
  }
  function clone(v) {
    if (v == null) return v;
    try { return JSON.parse(JSON.stringify(v)); } catch (e) { return v; }
  }

  /* ---------- 스키마 버전 확인 ------------------------------------------- */
  (function ensureSchema() {
    var meta = readJSON(K.schema, null);
    if (!meta || meta.v !== SCHEMA_VERSION) {
      if (meta && typeof meta.v === 'number' && meta.v !== SCHEMA_VERSION) {
        // 버전 불일치 → 진도 데이터를 안전하게 초기화 (설정은 유지)
        [K.read, K.quiz, K.exams, K.diagnostic, K.cards, K.session, K.lastResult]
          .forEach(rawDel);
        if (global.console) {
          console.info('[progress] 저장 스키마 버전이 달라 진도 데이터를 초기화했습니다.');
        }
      }
      writeJSON(K.schema, { v: SCHEMA_VERSION });
    }
  })();

  /* ---------- 변경 알림 -------------------------------------------------- */
  var listeners = [];
  function subscribe(fn) {
    if (typeof fn !== 'function') return function () {};
    listeners.push(fn);
    return function () {
      var i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }
  function emit(kind, detail) {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](kind, detail); } catch (e) {}
    }
  }

  var nowISO = function () { return new Date().toISOString(); };

  /* ======================================================================
     읽은 페이지
     ====================================================================== */
  function readList() {
    var arr = readJSON(K.read, []);
    return Array.isArray(arr) ? arr.filter(function (x) { return typeof x === 'string'; }) : [];
  }
  function isRead(pageId) { return readList().indexOf(pageId) >= 0; }
  function markRead(pageId) {
    if (!pageId) return false;
    var arr = readList();
    if (arr.indexOf(pageId) >= 0) return false;
    arr.push(pageId);
    writeJSON(K.read, arr);
    emit('read', pageId);
    return true;
  }
  function unmarkRead(pageId) {
    var arr = readList();
    var i = arr.indexOf(pageId);
    if (i < 0) return false;
    arr.splice(i, 1);
    writeJSON(K.read, arr);
    emit('read', pageId);
    return true;
  }

  /* ======================================================================
     퀴즈 문항 통계
     ====================================================================== */
  function quizStats() {
    var o = readJSON(K.quiz, {});
    return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {};
  }
  function getQuizStat(qid) {
    var s = quizStats()[qid];
    if (!s || typeof s !== 'object') return { attempts: 0, correct: 0, streak: 0, lastAt: null };
    return {
      attempts: +s.attempts || 0,
      correct: +s.correct || 0,
      streak: +s.streak || 0,
      lastAt: s.lastAt || null
    };
  }
  /** 채점 결과 1건 기록. streak 는 연속 정답 수(오답 시 0으로 리셋). */
  function recordAnswer(qid, correct) {
    if (!qid) return null;
    var all = quizStats();
    var s = all[qid] || { attempts: 0, correct: 0, streak: 0, lastAt: null };
    s.attempts = (+s.attempts || 0) + 1;
    if (correct) {
      s.correct = (+s.correct || 0) + 1;
      s.streak = (+s.streak || 0) + 1;
    } else {
      s.streak = 0;
    }
    s.lastAt = nowISO();
    all[qid] = s;
    writeJSON(K.quiz, all);
    emit('quiz', { id: qid, correct: !!correct, stat: s });
    return s;
  }
  function isGraduated(qid) { return getQuizStat(qid).streak >= GRADUATE_STREAK; }
  /** 오답 노트 대상: 한 번이라도 틀렸고 아직 졸업(3연속 정답)하지 못한 문항 */
  function wrongQuestionIds() {
    var all = quizStats();
    var out = [];
    for (var id in all) {
      if (!Object.prototype.hasOwnProperty.call(all, id)) continue;
      var s = all[id];
      var attempts = +s.attempts || 0;
      var correct = +s.correct || 0;
      var streak = +s.streak || 0;
      if (attempts > correct && streak < GRADUATE_STREAK) out.push(id);
    }
    return out;
  }
  /** 도메인별 숙련도 집계. idToDomain: (qid) => domain|null */
  function masteryByDomain(idToDomain) {
    var all = quizStats();
    var acc = {};
    for (var id in all) {
      if (!Object.prototype.hasOwnProperty.call(all, id)) continue;
      var d = typeof idToDomain === 'function' ? idToDomain(id) : null;
      if (!d) continue;
      if (!acc[d]) acc[d] = { attempts: 0, correct: 0, questions: 0 };
      acc[d].attempts += +all[id].attempts || 0;
      acc[d].correct += +all[id].correct || 0;
      acc[d].questions += 1;
    }
    for (var k in acc) {
      if (!Object.prototype.hasOwnProperty.call(acc, k)) continue;
      acc[k].pct = acc[k].attempts ? Math.round((acc[k].correct / acc[k].attempts) * 100) : 0;
    }
    return acc;
  }

  /* ======================================================================
     모의고사 이력
     ====================================================================== */
  function exams() {
    var a = readJSON(K.exams, []);
    return Array.isArray(a) ? a : [];
  }
  function recordExam(rec) {
    if (!rec || typeof rec !== 'object') return null;
    var list = exams();
    var entry = {
      examId: rec.examId || null,
      setId: rec.setId || null,
      mode: rec.mode || 'exam',
      score: +rec.score || 0,
      total: +rec.total || 0,
      byDomain: rec.byDomain && typeof rec.byDomain === 'object' ? rec.byDomain : {},
      durationSec: +rec.durationSec || 0,
      at: rec.at || nowISO()
    };
    list.push(entry);
    if (list.length > 100) list = list.slice(list.length - 100);
    writeJSON(K.exams, list);
    emit('exams', entry);
    return entry;
  }

  /* ======================================================================
     진단 결과
     ====================================================================== */
  function diagnostic() { return readJSON(K.diagnostic, null); }
  function setDiagnostic(obj) {
    if (!obj) { rawDel(K.diagnostic); emit('diagnostic', null); return null; }
    var rec = clone(obj);
    rec.at = rec.at || nowISO();
    writeJSON(K.diagnostic, rec);
    emit('diagnostic', rec);
    return rec;
  }

  /* ======================================================================
     플래시카드
     ====================================================================== */
  function cardStats() {
    var o = readJSON(K.cards, {});
    return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {};
  }
  function getCardStat(cardId) {
    var s = cardStats()[cardId];
    if (!s || typeof s !== 'object') {
      return { seen: 0, known: 0, streak: 0, graduated: false, lastAt: null };
    }
    return {
      seen: +s.seen || 0,
      known: +s.known || 0,
      streak: +s.streak || 0,
      graduated: !!s.graduated,
      lastAt: s.lastAt || null
    };
  }
  /** known=true(알았음) 3회 연속이면 졸업. 몰랐음이면 streak·graduated 리셋. */
  function recordCard(cardId, known) {
    if (!cardId) return null;
    var all = cardStats();
    var s = all[cardId] || { seen: 0, known: 0, streak: 0, graduated: false, lastAt: null };
    s.seen = (+s.seen || 0) + 1;
    if (known) {
      s.known = (+s.known || 0) + 1;
      s.streak = (+s.streak || 0) + 1;
      if (s.streak >= GRADUATE_STREAK) s.graduated = true;
    } else {
      s.streak = 0;
      s.graduated = false;
    }
    s.lastAt = nowISO();
    all[cardId] = s;
    writeJSON(K.cards, all);
    emit('cards', { id: cardId, known: !!known, stat: s });
    return s;
  }

  /* ======================================================================
     설정
     ====================================================================== */
  var DEFAULT_SETTINGS = { theme: 'auto', fontSize: 'md' };
  function settings() {
    var s = readJSON(K.settings, DEFAULT_SETTINGS);
    if (['auto', 'light', 'dark'].indexOf(s.theme) < 0) s.theme = 'auto';
    if (['sm', 'md', 'lg'].indexOf(s.fontSize) < 0) s.fontSize = 'md';
    return s;
  }
  function setSetting(key, value) {
    var s = settings();
    s[key] = value;
    writeJSON(K.settings, s);
    emit('settings', s);
    return s;
  }

  /* ======================================================================
     진행 중 시험 세션 (새로고침 복구)
     ====================================================================== */
  function saveSession(obj) { return writeJSON(K.session, obj); }
  function loadSession() { return readJSON(K.session, null); }
  function clearSession() { rawDel(K.session); }

  /* 마지막 채점 결과 (quiz/result.html) */
  function setLastResult(obj) { return writeJSON(K.lastResult, obj); }
  function lastResult() { return readJSON(K.lastResult, null); }
  function clearLastResult() { rawDel(K.lastResult); }

  /* ======================================================================
     초기화
     ====================================================================== */
  /**
   * @param {'all'|'progress'|'quiz'|'cards'|'settings'} [scope='all']
   */
  function reset(scope) {
    scope = scope || 'all';
    var keys;
    if (scope === 'settings') keys = [K.settings];
    else if (scope === 'quiz') keys = [K.quiz, K.exams, K.diagnostic, K.session, K.lastResult];
    else if (scope === 'cards') keys = [K.cards];
    else if (scope === 'progress') keys = [K.read];
    else keys = Object.keys(K).map(function (k) { return K[k]; });
    keys.forEach(rawDel);
    writeJSON(K.schema, { v: SCHEMA_VERSION });
    emit('reset', scope);
    return true;
  }

  /** 디버그 · 백업용 전체 덤프 */
  function exportAll() {
    var out = {};
    for (var name in K) {
      if (!Object.prototype.hasOwnProperty.call(K, name)) continue;
      var raw = rawGet(K[name]);
      if (raw != null) {
        try { out[K[name]] = JSON.parse(raw); } catch (e) { out[K[name]] = raw; }
      }
    }
    return out;
  }

  /* ---------- 공개 -------------------------------------------------------- */
  global.AG = global.AG || {};
  global.AG.progress = {
    KEYS: K,
    PREFIX: PREFIX,
    SCHEMA_VERSION: SCHEMA_VERSION,
    GRADUATE_STREAK: GRADUATE_STREAK,
    available: storageOk,

    subscribe: subscribe,

    readList: readList, isRead: isRead, markRead: markRead, unmarkRead: unmarkRead,

    quizStats: quizStats, getQuizStat: getQuizStat, recordAnswer: recordAnswer,
    isGraduated: isGraduated, wrongQuestionIds: wrongQuestionIds,
    masteryByDomain: masteryByDomain,

    exams: exams, recordExam: recordExam,

    diagnostic: diagnostic, setDiagnostic: setDiagnostic,

    cardStats: cardStats, getCardStat: getCardStat, recordCard: recordCard,

    settings: settings, setSetting: setSetting,

    saveSession: saveSession, loadSession: loadSession, clearSession: clearSession,
    setLastResult: setLastResult, lastResult: lastResult, clearLastResult: clearLastResult,

    reset: reset, exportAll: exportAll
  };
})(typeof window !== 'undefined' ? window : globalThis);
