/* ==========================================================================
   AWS SAA Guide — 퀴즈 엔진 (quiz.js)
   --------------------------------------------------------------------------
   docs/QUESTION_SCHEMA.md 의 4가지 문항 유형을 전부 지원합니다.

     single    라디오        정답 1개
     multiple  체크박스      전부 일치 (부분 점수 없음)
     matching  left별 <select>  모든 쌍 일치
     ordering  위/아래 <button> 순서 완전 일치

   접근성
     · 드래그 앤 드롭은 어디에도 필수 조작으로 쓰지 않습니다.
       matching 은 <select>, ordering 은 <button> 기반이라 키보드만으로 완주됩니다.
     · 채점 결과와 순서 변경은 aria-live="polite" 로 안내합니다.
     · 숫자키 1~5 선택 토글 / Enter 제출·다음 / F 플래그 (exam)

   진입점
     (a) 인라인 위젯  <div class="quiz-embed" data-set="basics-ch01" data-count="10">
     (b) 프로그램 호출 AG.quiz.mount(el, options)

   모드
     study · exam · domain · review · random · diagnostic · weakness
   ========================================================================== */
(function (global) {
  'use strict';

  var doc = global.document;

  /* ======================================================================
     사이트 루트 경로 해석
     (페이지 깊이가 달라도 data/questions/*.json 을 찾을 수 있어야 합니다)
     ====================================================================== */
  var ROOT = (function () {
    if (global.AG && global.AG.__root) return global.AG.__root;
    var src = doc && doc.currentScript && doc.currentScript.src;
    if (!src && doc) {
      var all = doc.getElementsByTagName('script');
      for (var i = all.length - 1; i >= 0; i--) {
        if (/\/assets\/js\/[\w.-]+\.js(?:[?#]|$)/.test(all[i].src || '')) { src = all[i].src; break; }
      }
    }
    var root = src ? src.replace(/assets\/js\/[^/]*$/, '') : './';
    global.AG = global.AG || {};
    global.AG.__root = root;
    return root;
  })();

  function url(rel) { return ROOT + rel; }

  /* ======================================================================
     상수
     ====================================================================== */
  var GRADUATE_STREAK = 3;

  /* CCDAK 도메인 가중치 (잠정치 — Wave 3 C1이 공식 Exam Guide로 확정) */
  var CCDAK_DOMAINS = [
    { name: 'Application Development',   weight: 28, chapters: ['ch04', 'ch05', 'ch06'], page: 'ccdak/domain-app-development.html' },
    { name: 'Fundamentals',              weight: 23, chapters: ['ch02', 'ch07', 'ch08'], page: 'ccdak/domain-fundamentals.html' },
    { name: 'Kafka Connect',             weight: 15, chapters: ['ch09'],                 page: 'ccdak/domain-connect.html' },
    { name: 'Application Observability', weight: 13, chapters: ['ch11', 'ch04'],         page: 'ccdak/domain-observability.html' },
    { name: 'Kafka Streams',             weight: 12, chapters: ['ch10'],                 page: 'ccdak/domain-streams.html' },
    { name: 'Application Testing',       weight: 8,  chapters: ['ch10'],                 page: 'ccdak/domain-testing.html' }
  ];
  function domainMeta(name) {
    for (var i = 0; i < CCDAK_DOMAINS.length; i++) {
      if (CCDAK_DOMAINS[i].name === name) return CCDAK_DOMAINS[i];
    }
    return { name: name, weight: null, chapters: [], page: null };
  }

  var TYPE_LABEL = {
    single: '단일 선택', multiple: '복수 선택',
    matching: '연결형', ordering: '순서 배열'
  };
  var DIFF_LABEL = { easy: '쉬움', medium: '보통', hard: '어려움' };

  /* ======================================================================
     유틸
     ====================================================================== */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /** 본문의 `백틱 코드`를 <code> 로 바꿉니다 (이스케이프 후 적용하므로 안전). */
  function md(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function sameSet(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    var x = a.slice().sort(), y = b.slice().sort();
    for (var i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
    return true;
  }
  function sameSeq(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }
  function fmtTime(sec) {
    sec = Math.max(0, Math.round(sec));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    var mm = (m < 10 ? '0' : '') + m, ss = (s < 10 ? '0' : '') + s;
    return h > 0 ? h + ':' + mm + ':' + ss : mm + ':' + ss;
  }
  function band(pct) { return pct >= 80 ? 'high' : (pct >= 60 ? 'mid' : 'low'); }
  function progressApi() { return (global.AG && global.AG.progress) || null; }
  function highlightIn(el) {
    if (global.AG && global.AG.highlight) { try { global.AG.highlight.run(el); } catch (e) {} }
  }

  /* ======================================================================
     데이터 로딩
     ====================================================================== */
  var cache = { manifest: null, sets: Object.create(null) };

  function fetchJSON(path) {
    if (!global.fetch) return Promise.reject(new Error('fetch 미지원'));
    return global.fetch(path, { credentials: 'same-origin' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status + ' — ' + path);
      return res.json();
    });
  }

  /**
   * manifest.json 은 Wave 2 B6 가 생성합니다. 그 전에도 사이트가 동작해야 하므로
   * 매니페스트가 없으면 아래 목록을 후보로 삼아 실제 존재하는 파일만 골라 씁니다.
   * (Wave 0 이 만든 basics-ch01 로 엔진 검증이 가능해야 합니다.)
   */
  var FALLBACK_SET_CANDIDATES = [
    'basics-ch01', 'basics-ch02', 'basics-ch03', 'basics-ch04', 'basics-ch05',
    'basics-ch06', 'basics-ch07', 'basics-ch08', 'basics-ch09', 'basics-ch10',
    'basics-ch11', 'basics-appendix-legacy',
    'ccdak-diagnostic',
    'ccdak-app-development', 'ccdak-fundamentals', 'ccdak-connect',
    'ccdak-observability', 'ccdak-streams', 'ccdak-testing',
    'ccdak-mock-1', 'ccdak-mock-2', 'ccdak-mock-3', 'ccdak-mock-4',
    'ccaak-fundamentals', 'ccaak-security', 'ccaak-connect',
    'ccaak-deployment', 'ccaak-cluster-config', 'ccaak-observability',
    'ccaak-troubleshooting', 'ccaak-mock-1'
  ];

  function discoverSets() {
    return Promise.all(FALLBACK_SET_CANDIDATES.map(function (id) {
      return loadSet(id).then(function (s) {
        return {
          setId: s.setId || id,
          file: id + '.json',
          exam: s.exam || null,
          domain: s.domain || null,
          title: s.title || id,
          count: s.questions.length,
          mock: /-mock-\d+$/.test(id)
        };
      }).catch(function () { return null; });
    })).then(function (list) { return list.filter(Boolean); });
  }

  function loadManifest() {
    if (cache.manifest) return Promise.resolve(cache.manifest);
    return fetchJSON(url('data/questions/manifest.json')).then(function (m) {
      cache.manifest = m || { sets: [], exams: {} };
      if (!Array.isArray(cache.manifest.sets)) cache.manifest.sets = [];
      return cache.manifest;
    }).catch(function () {
      // 매니페스트 없음 → 후보 목록에서 실제 존재하는 세트를 탐색
      return discoverSets().then(function (sets) {
        cache.manifest = { sets: sets, exams: {}, __discovered: true, __missing: !sets.length };
        return cache.manifest;
      });
    });
  }

  function loadSet(setId) {
    if (!setId) return Promise.reject(new Error('setId 없음'));
    if (cache.sets[setId]) return Promise.resolve(cache.sets[setId]);
    return fetchJSON(url('data/questions/' + setId + '.json')).then(function (s) {
      s = s || {};
      s.questions = Array.isArray(s.questions) ? s.questions : [];
      s.questions.forEach(function (q) {
        if (!q.__setId) q.__setId = s.setId || setId;
        if (!q.domain && s.domain) q.domain = s.domain;
        if (!q.exam && s.exam) q.exam = s.exam;
      });
      cache.sets[setId] = s;
      return s;
    });
  }

  function loadSets(ids) {
    return Promise.all((ids || []).map(function (id) {
      return loadSet(id).catch(function (e) {
        if (global.console) console.warn('[quiz] 세트 로드 실패: ' + id, e.message);
        return null;
      });
    })).then(function (list) { return list.filter(Boolean); });
  }

  /** 매니페스트에서 조건에 맞는 세트 id 목록 */
  function pickSetIds(manifest, filter) {
    filter = filter || {};
    return (manifest.sets || []).filter(function (s) {
      if (filter.exam && s.exam !== filter.exam) return false;
      if (filter.domain && s.domain !== filter.domain) return false;
      if (filter.mock === true && !s.mock) return false;
      if (filter.mock === false && s.mock) return false;
      if (filter.setId && s.setId !== filter.setId) return false;
      return true;
    }).map(function (s) { return s.setId; });
  }

  /** 전체 문항 → id → 문항 인덱스 (review / weakness 모드용) */
  function loadAllQuestions(manifest, filter) {
    var ids = pickSetIds(manifest, filter || {});
    return loadSets(ids).then(function (sets) {
      var out = [];
      sets.forEach(function (s) { out = out.concat(s.questions); });
      return out;
    });
  }

  /* ======================================================================
     문항 정규화 — 표시용 파생 데이터 생성
     ====================================================================== */
  function prepare(q, opts) {
    opts = opts || {};
    var p = {
      q: q,
      id: q.id,
      type: q.type || 'single',
      // single / multiple
      choices: null, letterOf: null,
      // matching
      pairs: null, options: null,
      // ordering
      order: null
    };

    if (p.type === 'single' || p.type === 'multiple') {
      var cs = Array.isArray(q.choices) ? q.choices.slice() : [];
      if (opts.shuffleChoices !== false) cs = shuffle(cs);
      var LETTERS = 'ABCDEFGH';
      p.letterOf = Object.create(null);
      p.choices = cs.map(function (c, i) {
        p.letterOf[c.id] = LETTERS.charAt(i);
        return { id: c.id, text: c.text, letter: LETTERS.charAt(i) };
      });
    } else if (p.type === 'matching') {
      p.pairs = (Array.isArray(q.pairs) ? q.pairs : []).map(function (pr) {
        return { id: pr.id, left: pr.left, right: pr.right };
      });
      var pool = p.pairs.map(function (pr) { return pr.right; })
        .concat(Array.isArray(q.extraRights) ? q.extraRights : []);
      // 중복 제거 후 셔플
      var seen = Object.create(null), uniq = [];
      pool.forEach(function (v) {
        var k = String(v);
        if (!seen[k]) { seen[k] = 1; uniq.push(v); }
      });
      p.options = shuffle(uniq);
    } else if (p.type === 'ordering') {
      var items = (Array.isArray(q.items) ? q.items : []).slice();
      var shuffled = shuffle(items);
      // 우연히 정답 순서 그대로 나오면 한 번 회전시켜 힌트를 줄입니다.
      var ans = Array.isArray(q.answer) ? q.answer : [];
      if (shuffled.length > 2 && sameSeq(shuffled.map(function (x) { return x.id; }), ans)) {
        shuffled.push(shuffled.shift());
      }
      p.order = shuffled;
    }
    return p;
  }

  /* ======================================================================
     채점
     ====================================================================== */
  /**
   * @returns {{correct:boolean, detail:object}}
   */
  function grade(p, response) {
    var q = p.q;
    var type = p.type;
    if (type === 'single' || type === 'multiple') {
      var picked = Array.isArray(response) ? response : [];
      return { correct: sameSet(picked, q.answer || []), detail: { picked: picked } };
    }
    if (type === 'matching') {
      var map = response && typeof response === 'object' ? response : {};
      var wrong = [];
      var answered = 0;
      (p.pairs || []).forEach(function (pr) {
        var got = map[pr.id];
        if (got != null && got !== '') answered++;
        if (String(got == null ? '' : got) !== String(pr.right)) wrong.push(pr.id);
      });
      return { correct: wrong.length === 0 && answered === (p.pairs || []).length,
               detail: { map: map, wrong: wrong } };
    }
    if (type === 'ordering') {
      var seq = Array.isArray(response) ? response : [];
      return { correct: sameSeq(seq, q.answer || []), detail: { seq: seq } };
    }
    return { correct: false, detail: {} };
  }

  function isAnswered(p, response) {
    if (p.type === 'single' || p.type === 'multiple') {
      return Array.isArray(response) && response.length > 0;
    }
    if (p.type === 'matching') {
      if (!response) return false;
      var n = 0;
      (p.pairs || []).forEach(function (pr) {
        if (response[pr.id] != null && response[pr.id] !== '') n++;
      });
      return n === (p.pairs || []).length;
    }
    if (p.type === 'ordering') return true; // 초기 순서 자체가 하나의 답
    return false;
  }

  /* ======================================================================
     엔진
     ====================================================================== */
  function Engine(container, options) {
    this.el = container;
    this.o = Object.assign({
      mode: 'study',
      title: '',
      questions: [],
      shuffleChoices: true,
      shuffleQuestions: true,
      count: 0,
      durationSec: null,
      showNav: false,
      resumeKey: null,
      onFinish: null,
      redirectToResult: false,
      diagnostic: false
    }, options || {});
    this.prepared = [];
    this.responses = [];
    this.graded = [];
    this.flags = [];
    this.index = 0;
    this.finished = false;
    this.startedAt = Date.now();
    this.deadline = null;
    this._timerId = null;
    this._keyHandler = null;
    this.init();
  }

  Engine.prototype.init = function () {
    var self = this;
    var qs = this.o.questions.slice();
    if (this.o.shuffleQuestions) qs = shuffle(qs);
    if (this.o.count > 0 && qs.length > this.o.count) qs = qs.slice(0, this.o.count);

    this.prepared = qs.map(function (q) {
      return prepare(q, { shuffleChoices: self.o.shuffleChoices });
    });
    this.responses = this.prepared.map(function (p) {
      return p.type === 'ordering' ? p.order.map(function (i) { return i.id; })
           : (p.type === 'matching' ? Object.create(null) : []);
    });
    this.graded = this.prepared.map(function () { return null; });
    this.flags = this.prepared.map(function () { return false; });

    if (this.o.durationSec) {
      this.deadline = Date.now() + this.o.durationSec * 1000;
    }

    // 진행 중 세션 복구 (exam 모드)
    if (this.o.resumeKey) this.tryResume();

    this.render();
    this.bindKeys();
    if (this.deadline) this.startTimer();
  };

  Engine.prototype.destroy = function () {
    if (this._timerId) global.clearInterval(this._timerId);
    if (this._keyHandler) doc.removeEventListener('keydown', this._keyHandler);
  };

  /* ---------- 세션 저장 / 복구 ------------------------------------------- */
  Engine.prototype.sessionState = function () {
    return {
      key: this.o.resumeKey,
      mode: this.o.mode,
      at: Date.now(),
      ids: this.prepared.map(function (p) { return p.id; }),
      responses: this.responses.map(function (r) {
        return (r && typeof r === 'object' && !Array.isArray(r)) ? Object.assign({}, r) : r;
      }),
      flags: this.flags.slice(),
      index: this.index,
      remainSec: this.deadline ? Math.max(0, Math.round((this.deadline - Date.now()) / 1000)) : null
    };
  };
  Engine.prototype.saveSession = function () {
    var pr = progressApi();
    if (!pr || !this.o.resumeKey || this.finished) return;
    try { pr.saveSession(this.sessionState()); } catch (e) {}
  };
  Engine.prototype.tryResume = function () {
    var pr = progressApi();
    if (!pr) return false;
    var s = pr.loadSession();
    if (!s || s.key !== this.o.resumeKey) return false;
    // 12시간 이상 지난 세션은 폐기
    if (Date.now() - (s.at || 0) > 12 * 3600 * 1000) { pr.clearSession(); return false; }
    var myIds = this.prepared.map(function (p) { return p.id; });
    if (!sameSeq(myIds, s.ids || [])) {
      // 문항 구성이 다르면 저장된 순서를 그대로 복원할 수 없으므로 폐기
      pr.clearSession();
      return false;
    }
    this.responses = (s.responses || []).map(function (r, i) {
      if (r == null) return Array.isArray(myIds) ? [] : [];
      return r;
    });
    // 타입에 맞게 보정
    var self = this;
    this.prepared.forEach(function (p, i) {
      var r = self.responses[i];
      if (p.type === 'matching' && (!r || Array.isArray(r))) self.responses[i] = Object.create(null);
      if ((p.type === 'single' || p.type === 'multiple') && !Array.isArray(r)) self.responses[i] = [];
      if (p.type === 'ordering' && !Array.isArray(r)) self.responses[i] = p.order.map(function (x) { return x.id; });
    });
    this.flags = (s.flags || []).slice();
    this.index = Math.min(+s.index || 0, this.prepared.length - 1);
    if (s.remainSec != null && this.o.durationSec) this.deadline = Date.now() + s.remainSec * 1000;
    this.resumed = true;
    return true;
  };

  /* ---------- 타이머 ----------------------------------------------------- */
  Engine.prototype.startTimer = function () {
    var self = this;
    if (this._timerId) global.clearInterval(this._timerId);
    this._timerId = global.setInterval(function () {
      if (self.finished) { global.clearInterval(self._timerId); return; }
      var remain = Math.max(0, (self.deadline - Date.now()) / 1000);
      var t = self.el.querySelector('.quiz__timer');
      if (t) {
        t.textContent = fmtTime(remain);
        t.setAttribute('data-warn', remain <= 300 ? 'true' : 'false');
      }
      if (remain <= 0) {
        global.clearInterval(self._timerId);
        self.finish(true);
      }
      if (Math.round(remain) % 10 === 0) self.saveSession();
    }, 1000);
  };

  /* ---------- 키보드 ----------------------------------------------------- */
  Engine.prototype.bindKeys = function () {
    var self = this;
    this._keyHandler = function (e) {
      if (self.finished) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // 퀴즈가 화면에 없으면 무시
      if (!self.el || !self.el.isConnected) return;
      var t = e.target;
      var tag = t && t.tagName ? t.tagName.toUpperCase() : '';
      var inField = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || (t && t.isContentEditable);
      var inQuiz = self.el.contains(t) || t === doc.body || t === doc.documentElement;
      if (!inQuiz) return;

      var p = self.prepared[self.index];
      if (!p) return;

      // 1~5 선택지 토글 (single/multiple 전용, 폼 요소 안에서는 값 입력이 우선)
      if (/^[1-9]$/.test(e.key) && (p.type === 'single' || p.type === 'multiple')) {
        if (inField && tag !== 'INPUT') return;
        var n = parseInt(e.key, 10) - 1;
        if (p.choices && p.choices[n]) {
          e.preventDefault();
          self.toggleChoice(p.choices[n].id);
          return;
        }
      }
      if ((e.key === 'f' || e.key === 'F') && self.o.mode === 'exam' && !inField) {
        e.preventDefault();
        self.toggleFlag();
        return;
      }
      /* 버튼·링크에 포커스가 있으면 Enter 는 그 요소의 네이티브 활성화입니다.
         가로채면 ▲▼(순서 이동)·"이 문항 다시"·"이전" 이 전부 죽고 즉시 채점됩니다. */
      var activatable = tag === 'BUTTON' ||
        (tag === 'A' && t.getAttribute && t.getAttribute('href')) ||
        (t.getAttribute && t.getAttribute('role') === 'button');
      if (e.key === 'Enter' && !activatable) {
        /* 라디오·체크박스는 값 입력이 아니라 선택이므로 제출을 허용합니다
           (화면 힌트가 "Enter 제출" 이라고 안내합니다). */
        var isChoiceInput = tag === 'INPUT' && /^(radio|checkbox)$/i.test(t.type || '');
        if (inField && !isChoiceInput) return;
        e.preventDefault();
        self.primaryAction();
        return;
      }
      if (e.key === 'Enter' && tag === 'SELECT') {
        // matching 에서 select 를 다 채웠으면 Enter 로 제출
        e.preventDefault();
        self.primaryAction();
        return;
      }
      if (!inField && (e.key === 'ArrowRight' || e.key === 'PageDown')) {
        if (self.o.mode === 'exam') { e.preventDefault(); self.go(self.index + 1); }
      }
      if (!inField && (e.key === 'ArrowLeft' || e.key === 'PageUp')) {
        if (self.o.mode === 'exam') { e.preventDefault(); self.go(self.index - 1); }
      }
    };
    doc.addEventListener('keydown', this._keyHandler);
  };

  /* ---------- 상태 변경 -------------------------------------------------- */
  Engine.prototype.toggleChoice = function (choiceId) {
    var p = this.prepared[this.index];
    if (!p || this.graded[this.index]) return;
    var cur = this.responses[this.index];
    if (!Array.isArray(cur)) cur = [];
    if (p.type === 'single') {
      cur = [choiceId];
    } else {
      var i = cur.indexOf(choiceId);
      if (i >= 0) cur.splice(i, 1); else cur.push(choiceId);
    }
    this.responses[this.index] = cur;
    this.render();
    this.saveSession();
  };

  Engine.prototype.setPair = function (pairId, value) {
    var cur = this.responses[this.index];
    if (!cur || Array.isArray(cur)) cur = Object.create(null);
    cur[pairId] = value;
    this.responses[this.index] = cur;
    this.updateActions();
    this.saveSession();
  };

  Engine.prototype.moveItem = function (itemId, dir) {
    var cur = this.responses[this.index];
    if (!Array.isArray(cur)) return;
    var i = cur.indexOf(itemId);
    var j = i + dir;
    if (i < 0 || j < 0 || j >= cur.length) return;
    var t = cur[i]; cur[i] = cur[j]; cur[j] = t;
    this.responses[this.index] = cur;
    this.render();
    this.saveSession();
    // 이동 후 같은 버튼에 포커스를 유지
    /* 마크업은 .qo__btn 자체에 data-act·data-item 을 답니다(qo__row 가 아님). */
    var sel = '.qo__btn[data-act="' + (dir < 0 ? 'up' : 'down') + '"][data-item="' + itemId + '"]';
    var btn = this.el.querySelector(sel);
    if (btn) { if (btn.disabled) { var alt = btn.parentNode.querySelector('.qo__btn:not(:disabled)'); if (alt) alt.focus(); } else btn.focus(); }
    var p = this.prepared[this.index];
    var item = (p.order || []).filter(function (x) { return x.id === itemId; })[0];
    // 스크린리더가 백틱·별표를 읽지 않도록 마크업 기호를 제거하고 길이를 줄입니다.
    this.announce(plain(item ? item.text : '항목', 40) + ' 을 ' + (j + 1) + '번째로 이동했습니다.');
  };

  /** 낭독용 평문화: `코드`/**강조** 기호 제거 + 길이 제한 */
  function plain(s, max) {
    var t = String(s == null ? '' : s).replace(/[`*_]/g, '').replace(/\s+/g, ' ').trim();
    if (max && t.length > max) t = t.slice(0, max) + '…';
    return t;
  }

  Engine.prototype.toggleFlag = function () {
    this.flags[this.index] = !this.flags[this.index];
    this.render();
    this.announce(this.flags[this.index] ? '이 문항을 표시했습니다.' : '표시를 해제했습니다.');
  };

  Engine.prototype.announce = function (text) {
    var live = this.el.querySelector('.quiz__live');
    if (live) live.textContent = text;
  };

  /* ---------- 주 동작 (Enter) -------------------------------------------- */
  Engine.prototype.primaryAction = function () {
    if (this.o.mode === 'exam') {
      if (this.index < this.prepared.length - 1) this.go(this.index + 1);
      else this.confirmFinish();
      return;
    }
    if (!this.graded[this.index]) {
      var p = this.prepared[this.index];
      if (!isAnswered(p, this.responses[this.index])) {
        this.announce('답을 선택한 뒤 제출하세요.');
        return;
      }
      this.submitCurrent();
    } else if (this.index < this.prepared.length - 1) {
      this.go(this.index + 1);
    } else {
      this.finish(false);
    }
  };

  Engine.prototype.submitCurrent = function () {
    var i = this.index;
    var p = this.prepared[i];
    var g = grade(p, this.responses[i]);
    this.graded[i] = g;
    var pr = progressApi();
    if (pr) pr.recordAnswer(p.id, g.correct);
    this.render();
    this.announce(g.correct ? '정답입니다.' : '오답입니다. 해설을 확인하세요.');
  };

  Engine.prototype.go = function (i) {
    if (i < 0 || i >= this.prepared.length) return;
    this.index = i;
    this.render();
    this.saveSession();
    var stem = this.el.querySelector('.quiz__stem');
    if (stem) { stem.setAttribute('tabindex', '-1'); stem.focus({ preventScroll: false }); }
  };

  Engine.prototype.confirmFinish = function () {
    var unanswered = 0, self = this;
    this.prepared.forEach(function (p, i) {
      if (!isAnswered(p, self.responses[i])) unanswered++;
    });
    var msg = unanswered > 0
      ? '아직 답하지 않은 문항이 ' + unanswered + '개 있습니다. 지금 제출하시겠습니까?'
      : '모든 문항에 답했습니다. 제출하시겠습니까?';
    if (global.confirm(msg)) this.finish(false);
  };

  /* ---------- 종료 · 채점 ------------------------------------------------ */
  Engine.prototype.finish = function (auto) {
    if (this.finished) return;
    this.finished = true;
    if (this._timerId) global.clearInterval(this._timerId);

    var pr = progressApi();
    var self = this;
    var byDomain = {}, byType = {}, byChapter = {};
    var score = 0;
    var detail = [];

    this.prepared.forEach(function (p, i) {
      var g = self.graded[i] || grade(p, self.responses[i]);
      self.graded[i] = g;
      if (self.o.mode === 'exam' && pr) pr.recordAnswer(p.id, g.correct);
      if (g.correct) score++;

      var q = p.q;
      var d = q.domain || '기타';
      var ty = p.type;
      var ch = q.chapter || null;
      (byDomain[d] = byDomain[d] || { correct: 0, total: 0 });
      byDomain[d].total++; if (g.correct) byDomain[d].correct++;
      (byType[ty] = byType[ty] || { correct: 0, total: 0 });
      byType[ty].total++; if (g.correct) byType[ty].correct++;
      if (ch) {
        (byChapter[ch] = byChapter[ch] || { correct: 0, total: 0 });
        byChapter[ch].total++; if (g.correct) byChapter[ch].correct++;
      }
      detail.push({
        id: q.id, type: ty, domain: d, chapter: ch, difficulty: q.difficulty || null,
        correct: g.correct,
        question: q.question,
        yourAnswer: describeResponse(p, self.responses[i]),
        correctAnswer: describeAnswer(p),
        explanation: q.explanation || '',
        refs: q.refs || []
      });
    });

    var durationSec = Math.round((Date.now() - this.startedAt) / 1000);
    var result = {
      mode: this.o.mode,
      title: this.o.title || '',
      setIds: this.o.setIds || [],
      exam: this.o.exam || null,
      at: new Date().toISOString(),
      durationSec: durationSec,
      autoSubmitted: !!auto,
      total: this.prepared.length,
      score: score,
      byDomain: byDomain,
      byType: byType,
      byChapter: byChapter,
      questions: detail
    };

    if (pr) {
      pr.clearSession();
      pr.setLastResult(result);
      if (this.o.mode === 'exam' || this.o.mode === 'diagnostic') {
        pr.recordExam({
          examId: this.o.exam || null, setId: (this.o.setIds || []).join(','),
          mode: this.o.mode, score: score, total: result.total,
          byDomain: byDomain, durationSec: durationSec
        });
      }
    }

    if (this.o.diagnostic) result.diagnostic = buildDiagnostic(result);

    this.result = result;
    this.renderSummary(result);
    if (typeof this.o.onFinish === 'function') {
      try { this.o.onFinish(result, this); } catch (e) { if (global.console) console.error(e); }
    }
    if (this.o.redirectToResult) {
      global.location.href = url('quiz/result.html');
    }
  };

  function describeResponse(p, resp) {
    if (p.type === 'single' || p.type === 'multiple') {
      var picked = Array.isArray(resp) ? resp : [];
      if (!picked.length) return '(무응답)';
      return picked.map(function (id) {
        var c = (p.choices || []).filter(function (x) { return x.id === id; })[0];
        return (c ? c.letter + '. ' + c.text : id);
      }).join(' / ');
    }
    if (p.type === 'matching') {
      var map = resp || {};
      return (p.pairs || []).map(function (pr) {
        return pr.left + ' → ' + (map[pr.id] || '(미선택)');
      }).join(' · ');
    }
    if (p.type === 'ordering') {
      var seq = Array.isArray(resp) ? resp : [];
      return seq.map(function (id, i) {
        var it = (p.order || []).filter(function (x) { return x.id === id; })[0];
        return (i + 1) + '. ' + (it ? it.text : id);
      }).join(' → ');
    }
    return '';
  }
  function describeAnswer(p) {
    var q = p.q;
    if (p.type === 'single' || p.type === 'multiple') {
      return (q.answer || []).map(function (id) {
        var c = (p.choices || []).filter(function (x) { return x.id === id; })[0];
        return (c ? c.letter + '. ' + c.text : id);
      }).join(' / ');
    }
    if (p.type === 'matching') {
      return (p.pairs || []).map(function (pr) { return pr.left + ' → ' + pr.right; }).join(' · ');
    }
    if (p.type === 'ordering') {
      var byId = {};
      (q.items || []).forEach(function (it) { byId[it.id] = it.text; });
      return (q.answer || []).map(function (id, i) { return (i + 1) + '. ' + (byId[id] || id); }).join(' → ');
    }
    return '';
  }

  /* ======================================================================
     렌더링
     ====================================================================== */
  Engine.prototype.render = function () {
    if (this.finished) return;
    var p = this.prepared[this.index];
    if (!p) { this.el.innerHTML = emptyBox('문항이 없습니다.'); return; }
    var q = p.q;
    var isStudy = this.o.mode !== 'exam';
    var g = this.graded[this.index];
    var resp = this.responses[this.index];

    var html = '';
    html += '<div class="quiz' + (g ? ' quiz--graded' : '') + '" data-mode="' + esc(this.o.mode) + '">';

    /* 상단 바 */
    html += '<div class="quiz__bar">';
    html += '<span class="quiz__bar-title">' + esc(this.o.title || TYPE_LABEL[p.type] || '문제') + '</span>';
    html += '<span class="quiz__bar-spacer"></span>';
    html += '<span class="quiz__count">' + (this.index + 1) + ' / ' + this.prepared.length + '</span>';
    if (this.deadline) {
      var remain = Math.max(0, (this.deadline - Date.now()) / 1000);
      html += '<span class="quiz__timer" role="timer" data-warn="' + (remain <= 300) + '">' + fmtTime(remain) + '</span>';
    }
    if (this.o.mode === 'exam') {
      html += '<button type="button" class="btn btn--sm" data-act="flag" aria-pressed="' +
        (this.flags[this.index] ? 'true' : 'false') + '">' +
        (this.flags[this.index] ? '★ 표시됨' : '☆ 표시') + '</button>';
    }
    html += '</div>';

    /* 진행 바 */
    var donePct = Math.round(((this.index + (g ? 1 : 0)) / this.prepared.length) * 100);
    html += '<div class="quiz__progress" role="presentation"><div class="quiz__progress-fill" style="width:' + donePct + '%"></div></div>';

    /* 본문 */
    html += '<div class="quiz__body">';
    html += '<div class="quiz__meta">';
    html += '<span class="badge">' + esc(TYPE_LABEL[p.type] || p.type) + '</span>';
    if (q.difficulty) html += '<span class="badge badge--' + esc(q.difficulty) + '">' + esc(DIFF_LABEL[q.difficulty] || q.difficulty) + '</span>';
    if (q.domain) html += '<span class="badge">' + esc(q.domain) + '</span>';
    if (q.exam && q.exam !== 'BASICS') html += '<span class="badge badge--' + (q.exam === 'CCDAK' ? 'ccdak' : 'ccaak') + '">' + esc(q.exam) + '</span>';
    html += '</div>';

    html += '<p class="quiz__stem">' + md(q.question) + '</p>';

    if (q.code && q.code.body) {
      html += '<figure class="code"><figcaption><span class="code__name">' +
        esc(q.code.caption || (q.code.lang || 'code')) + '</span></figcaption>' +
        '<pre><code class="lang-' + esc(q.code.lang || 'text') + '">' + esc(q.code.body) + '</code></pre></figure>';
    }

    /* 응답 UI */
    if (p.type === 'single' || p.type === 'multiple') {
      html += renderChoices(p, resp, g, q);
    } else if (p.type === 'matching') {
      html += renderMatching(p, resp, g);
    } else if (p.type === 'ordering') {
      html += renderOrdering(p, resp, g);
    }

    /* 피드백 */
    html += '<div class="quiz__feedback">';
    if (g && isStudy) html += renderFeedback(p, g, resp);
    html += '</div>';

    html += '<p class="quiz__live sr-only" role="status" aria-live="polite"></p>';
    html += '</div>'; /* /quiz__body */

    /* 액션 */
    html += '<div class="quiz__actions">';
    if (this.o.mode === 'exam') {
      html += '<button type="button" class="btn" data-act="prev"' + (this.index === 0 ? ' disabled' : '') + '>← 이전</button>';
      html += '<button type="button" class="btn" data-act="next"' + (this.index === this.prepared.length - 1 ? ' disabled' : '') + '>다음 →</button>';
      html += '<span class="quiz__actions-spacer"></span>';
      html += '<span class="quiz__hint">1~5 선택 · F 표시 · ←/→ 이동</span>';
      html += '<button type="button" class="btn btn--primary" data-act="finish">제출하고 채점</button>';
    } else if (!g) {
      html += '<button type="button" class="btn btn--primary" data-act="submit">제출</button>';
      if (this.index > 0) html += '<button type="button" class="btn" data-act="prev">← 이전</button>';
      html += '<span class="quiz__actions-spacer"></span>';
      html += '<span class="quiz__hint">' + (p.type === 'ordering' ? '▲▼ 버튼으로 순서 변경 · Enter 제출' : '1~5 선택 · Enter 제출') + '</span>';
    } else {
      if (this.index < this.prepared.length - 1) {
        html += '<button type="button" class="btn btn--primary" data-act="next">다음 문항 →</button>';
      } else {
        html += '<button type="button" class="btn btn--primary" data-act="finish">결과 보기</button>';
      }
      html += '<span class="quiz__actions-spacer"></span>';
      html += '<button type="button" class="btn btn--ghost btn--sm" data-act="retry">이 문항 다시</button>';
    }
    html += '</div>';

    /* 문항 네비게이터 (exam) */
    if (this.o.showNav) {
      html += '<div class="quiz__nav" role="group" aria-label="문항 이동">';
      for (var i = 0; i < this.prepared.length; i++) {
        html += '<button type="button" class="quiz__nav-btn" data-act="goto" data-i="' + i + '"' +
          ' data-answered="' + isAnswered(this.prepared[i], this.responses[i]) + '"' +
          ' data-flagged="' + !!this.flags[i] + '"' +
          (i === this.index ? ' aria-current="true"' : '') +
          ' aria-label="' + (i + 1) + '번 문항' + (this.flags[i] ? ' (표시됨)' : '') + '">' + (i + 1) + '</button>';
      }
      html += '</div>';
    }
    html += '</div>';

    this.el.innerHTML = html;
    highlightIn(this.el);
    this.wire();
    if (this.resumed) {
      this.resumed = false;
      this.announce('이전에 진행하던 응시를 이어서 표시했습니다.');
    }
  };

  function renderChoices(p, resp, g, q) {
    var picked = Array.isArray(resp) ? resp : [];
    var input = p.type === 'single' ? 'radio' : 'checkbox';
    var name = 'q-' + esc(p.id);
    var out = '<fieldset class="quiz__fieldset"><legend class="sr-only">' +
      (p.type === 'single' ? '하나를 선택하세요' : '해당하는 것을 모두 선택하세요') + '</legend>';
    out += '<ul class="quiz__choices">';
    p.choices.forEach(function (c, i) {
      var checked = picked.indexOf(c.id) >= 0;
      var verdict = '';
      var mark = '';
      if (g) {
        var inAns = (q.answer || []).indexOf(c.id) >= 0;
        if (checked && inAns) { verdict = 'correct'; mark = '✓'; }
        else if (checked && !inAns) { verdict = 'wrong'; mark = '✕'; }
        else if (!checked && inAns) { verdict = 'missed'; mark = '→'; }
      }
      out += '<li><label class="quiz__choice"' + (verdict ? ' data-verdict="' + verdict + '"' : '') + '>' +
        '<input type="' + input + '" name="' + name + '" value="' + esc(c.id) + '"' +
        (checked ? ' checked' : '') + (g ? ' disabled' : '') + '>' +
        '<span class="quiz__choice-key" aria-hidden="true">' + c.letter + '</span>' +
        '<span class="quiz__choice-text">' + md(c.text) + '</span>' +
        (mark ? '<span class="quiz__choice-mark" aria-hidden="true">' + mark + '</span>' : '') +
        '</label></li>';
    });
    out += '</ul></fieldset>';
    return out;
  }

  function renderMatching(p, resp, g) {
    var map = resp || {};
    var out = '<div class="qm" role="group" aria-label="왼쪽 항목에 대응하는 값을 각각 선택하세요">';
    p.pairs.forEach(function (pr, i) {
      var sid = 'qm-' + esc(p.id) + '-' + esc(pr.id);
      var got = map[pr.id] == null ? '' : String(map[pr.id]);
      var ok = g ? (got === String(pr.right)) : null;
      out += '<div class="qm__row"' + (g ? ' data-verdict="' + (ok ? 'correct' : 'wrong') + '"' : '') + '>';
      out += '<label class="qm__left" for="' + sid + '">' + md(pr.left) + '</label>';
      out += '<span class="qm__arrow" aria-hidden="true">→</span>';
      out += '<select class="qm__select" id="' + sid + '" data-pair="' + esc(pr.id) + '"' + (g ? ' disabled' : '') + '>';
      out += '<option value="">— 선택 —</option>';
      p.options.forEach(function (v) {
        out += '<option value="' + esc(v) + '"' + (got === String(v) ? ' selected' : '') + '>' + esc(v) + '</option>';
      });
      out += '</select>';
      if (g) {
        out += '<span class="qm__mark" aria-hidden="true">' + (ok ? '✓' : '✕') + '</span>';
        if (!ok) out += '<span class="qm__answer">정답: <b>' + esc(pr.right) + '</b></span>';
      }
      out += '</div>';
    });
    out += '</div>';
    if (!g) out += '<p class="quiz__hint">모든 항목을 선택해야 제출됩니다. 미끼 값이 섞여 있어 남는 값이 있을 수 있습니다.</p>';
    return out;
  }

  function renderOrdering(p, resp, g) {
    var seq = Array.isArray(resp) ? resp : p.order.map(function (x) { return x.id; });
    var byId = {};
    p.order.forEach(function (it) { byId[it.id] = it.text; });
    var out = '<div class="qo-wrap">';
    out += '<ol class="qo" role="list">';
    seq.forEach(function (id, i) {
      var verdict = '';
      if (g) {
        var ans = p.q.answer || [];
        verdict = ans[i] === id ? 'correct' : 'wrong';
      }
      out += '<li class="qo__row" data-item="' + esc(id) + '"' + (verdict ? ' data-verdict="' + verdict + '"' : '') + '>';
      out += '<span class="qo__pos" aria-hidden="true">' + (i + 1) + '</span>';
      out += '<span class="qo__text">' + md(byId[id] || id) + '</span>';
      if (!g) {
        out += '<span class="qo__ctrl">';
        out += '<button type="button" class="qo__btn" data-act="up" data-item="' + esc(id) + '"' +
          (i === 0 ? ' disabled' : '') + ' aria-label="' + esc(plain(byId[id] || id, 40)) + ' 위로 이동">▲</button>';
        out += '<button type="button" class="qo__btn" data-act="down" data-item="' + esc(id) + '"' +
          (i === seq.length - 1 ? ' disabled' : '') + ' aria-label="' + esc(plain(byId[id] || id, 40)) + ' 아래로 이동">▼</button>';
        out += '</span>';
      } else {
        out += '<span class="qo__mark" aria-hidden="true">' + (verdict === 'correct' ? '✓' : '✕') + '</span>';
      }
      out += '</li>';
    });
    out += '</ol>';
    if (g) {
      var ans = p.q.answer || [];
      out += '<div class="qo__compare">';
      out += '<div><h4>제출한 순서</h4><ol class="qo__mini">' +
        seq.map(function (id) { return '<li>' + md(byId[id] || id) + '</li>'; }).join('') + '</ol></div>';
      out += '<div><h4>정답 순서</h4><ol class="qo__mini qo__mini--ok">' +
        ans.map(function (id) { return '<li>' + md(byId[id] || id) + '</li>'; }).join('') + '</ol></div>';
      out += '</div>';
    } else {
      out += '<p class="quiz__hint">▲▼ 버튼으로 순서를 바꿉니다. 현재 표시된 순서가 그대로 제출됩니다.</p>';
    }
    out += '</div>';
    return out;
  }

  function renderFeedback(p, g, resp) {
    var q = p.q;
    var out = '';
    out += '<div class="quiz__verdict" data-ok="' + g.correct + '">' +
      (g.correct ? '✓ 정답입니다' : '✕ 오답입니다') + '</div>';
    out += '<div class="quiz__explain">';
    out += '<h4>해설</h4><p>' + md(q.explanation || '') + '</p>';

    var notes = q.distractorNotes || {};
    var keys = Object.keys(notes);
    if (keys.length) {
      // single/multiple 은 정답 선택지의 노트를 제외하고, 표시는 화면 문자로
      var shown = [];
      keys.forEach(function (k) {
        var label = k;
        if (p.type === 'single' || p.type === 'multiple') {
          if ((q.answer || []).indexOf(k) >= 0) return; // 정답 선택지 노트는 생략
          label = (p.letterOf && p.letterOf[k]) ? p.letterOf[k] : k;
        } else if (p.type === 'matching') {
          var pr = (p.pairs || []).filter(function (x) { return x.id === k; })[0];
          label = pr ? pr.left : k;
        } else if (p.type === 'ordering') {
          var it = (p.order || []).filter(function (x) { return x.id === k; })[0];
          label = it ? it.text : k;
        }
        shown.push('<li><b>' + esc(label) + '</b> ' + md(notes[k]) + '</li>');
      });
      if (shown.length) {
        out += '<h4>오답 노트</h4><ul class="quiz__distractors">' + shown.join('') + '</ul>';
      }
    }

    if (Array.isArray(q.refs) && q.refs.length) {
      out += '<h4>출처</h4><ul class="quiz__refs">';
      q.refs.forEach(function (r) {
        out += '<li><a href="' + esc(r.url) + '" target="_blank" rel="noopener noreferrer">' +
          esc(r.title || r.url) + '</a></li>';
      });
      out += '</ul>';
    }

    if (Array.isArray(q.tags) && q.tags.length) {
      out += '<p class="quiz__hint">태그: ' + q.tags.map(esc).join(', ') + '</p>';
    }
    out += '</div>';
    return out;
  }

  Engine.prototype.updateActions = function () {
    // matching select 변경 시 네비게이터/진행 상태만 갱신 (전체 재렌더 회피)
    var btn = this.el.querySelector('.quiz__nav-btn[data-i="' + this.index + '"]');
    if (btn) btn.setAttribute('data-answered', String(isAnswered(this.prepared[this.index], this.responses[this.index])));
  };

  /**
   * 이벤트는 컨테이너에 **단 한 번만** 위임 등록합니다.
   * render() 가 innerHTML 을 갈아치워도 컨테이너 자체는 유지되므로
   * 매 렌더마다 등록하면 리스너가 누적되어 한 번의 클릭이 여러 번 처리됩니다.
   */
  Engine.prototype.wire = function () {
    if (this._wired) return;
    this._wired = true;
    var self = this;
    var root = this.el;

    root.addEventListener('change', function (e) {
      var t = e.target;
      if (t.matches('input[type="radio"], input[type="checkbox"]')) {
        var p = self.prepared[self.index];
        if (!p || self.graded[self.index]) return;
        var cur = [];
        root.querySelectorAll('.quiz__choices input:checked').forEach(function (n) { cur.push(n.value); });
        self.responses[self.index] = cur;
        // 라디오/체크박스는 브라우저가 이미 반영했으므로 재렌더 없이 상태만 저장
        root.querySelectorAll('.quiz__choice').forEach(function (lab) {
          var inp = lab.querySelector('input');
          lab.classList.toggle('is-checked', !!(inp && inp.checked));
        });
        self.updateActions();
        self.saveSession();
      } else if (t.matches('.qm__select')) {
        self.setPair(t.getAttribute('data-pair'), t.value);
      }
    });

    root.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('button') : null;
      if (!b || !root.contains(b)) return;
      var act = b.getAttribute('data-act');
      if (!act) return;
      e.preventDefault();
      if (act === 'submit') self.submitCurrent();
      else if (act === 'next') self.o.mode === 'exam' ? self.go(self.index + 1)
             : (self.graded[self.index] ? self.go(self.index + 1) : self.submitCurrent());
      else if (act === 'prev') self.go(self.index - 1);
      else if (act === 'goto') self.go(parseInt(b.getAttribute('data-i'), 10));
      else if (act === 'flag') self.toggleFlag();
      else if (act === 'finish') {
        if (self.o.mode === 'exam') self.confirmFinish(); else self.finish(false);
      } else if (act === 'retry') {
        self.graded[self.index] = null;
        var p = self.prepared[self.index];
        self.responses[self.index] = p.type === 'ordering'
          ? shuffle(p.order).map(function (x) { return x.id; })
          : (p.type === 'matching' ? Object.create(null) : []);
        self.render();
      } else if (act === 'up') self.moveItem(b.getAttribute('data-item'), -1);
      else if (act === 'down') self.moveItem(b.getAttribute('data-item'), 1);
      else if (act === 'restart') self.restart();
    });
  };

  Engine.prototype.restart = function () {
    this.destroy();
    this.finished = false;
    this._wired = false;   // init() → render() → wire() 가 다시 등록할 수 있게
    var self = this;
    // 컨테이너를 새로 만들어 이전 위임 리스너를 확실히 떼어냅니다.
    var fresh = this.el.cloneNode(false);
    if (this.el.parentNode) this.el.parentNode.replaceChild(fresh, this.el);
    this.el = fresh;
    this.index = 0;
    this.startedAt = Date.now();
    this.deadline = this.o.durationSec ? Date.now() + this.o.durationSec * 1000 : null;
    this.init();
  };

  /* ---------- 종료 요약 (인라인) ----------------------------------------- */
  Engine.prototype.renderSummary = function (result) {
    var pct = result.total ? Math.round((result.score / result.total) * 100) : 0;
    var html = '<div class="quiz"><div class="quiz__bar"><span class="quiz__bar-title">' +
      esc(result.title || '채점 결과') + '</span><span class="quiz__bar-spacer"></span>' +
      '<span class="quiz__count">소요 ' + fmtTime(result.durationSec) + '</span></div>';
    html += '<div class="quiz__body">';
    if (result.autoSubmitted) {
      html += '<aside class="note note--warn" data-label="시간 종료"><p>제한 시간이 끝나 자동 제출되었습니다.</p></aside>';
    }
    html += '<div class="result__score">';
    html += '<span class="result__pct" data-band="' + band(pct) + '">' + pct + '%</span>';
    html += '<span class="result__frac">' + result.score + ' / ' + result.total + ' 문항</span>';
    html += '<span class="result__stat">소요 시간<b>' + fmtTime(result.durationSec) + '</b></span>';
    html += '</div>';

    html += renderBreakdown('도메인별 정답률', result.byDomain);
    html += renderBreakdown('유형별 정답률', result.byType, TYPE_LABEL);

    if (result.diagnostic) html += renderPlan(result.diagnostic);

    var wrong = result.questions.filter(function (d) { return !d.correct; });
    if (wrong.length) {
      html += '<h3 id="wrong-list">틀린 문항 ' + wrong.length + '개</h3>';
      html += '<ul class="wrong-list">';
      wrong.forEach(function (d) {
        html += '<li><details><summary>' + md(d.question) + '</summary><div class="wrong-list__body">';
        html += '<p><b>내 답</b> ' + esc(d.yourAnswer) + '</p>';
        html += '<p><b>정답</b> ' + esc(d.correctAnswer) + '</p>';
        html += '<p>' + md(d.explanation) + '</p>';
        if (d.chapter) {
          html += '<p><a href="' + url('basics/' + d.chapter + '.html') + '">' + esc(d.chapter) + ' 복습하기</a></p>';
        }
        html += '</div></details></li>';
      });
      html += '</ul>';
    } else {
      html += '<aside class="note note--ok" data-label="완주"><p>전 문항 정답입니다.</p></aside>';
    }
    html += '<p class="quiz__live sr-only" role="status" aria-live="polite">채점이 끝났습니다. ' +
      result.score + ' / ' + result.total + ', ' + pct + '퍼센트입니다.</p>';
    html += '</div>';
    html += '<div class="quiz__actions">';
    html += '<button type="button" class="btn btn--primary" data-act="restart">다시 풀기</button>';
    html += '<a class="btn" href="' + url('quiz/result.html') + '">상세 리포트</a>';
    html += '<span class="quiz__actions-spacer"></span>';
    html += '<a class="btn btn--ghost btn--sm" href="' + url('quiz/review.html') + '">오답 노트로</a>';
    html += '</div></div>';
    this.el.innerHTML = html;
    this.wire();
  };

  function renderBreakdown(title, byX, labelMap) {
    var keys = Object.keys(byX || {});
    if (!keys.length) return '';
    var out = '<h3>' + esc(title) + '</h3><ul class="bar-chart">';
    keys.sort();
    keys.forEach(function (k) {
      var v = byX[k];
      var pct = v.total ? Math.round((v.correct / v.total) * 100) : 0;
      var label = labelMap && labelMap[k] ? labelMap[k] : k;
      out += '<li><span class="bar-chart__label"><span class="bar-chart__name">' + esc(label) +
        '</span><span class="bar-chart__val">' + pct + '% (' + v.correct + '/' + v.total + ')</span></span>' +
        '<span class="bar-chart__track"><span class="bar-chart__fill" data-band="' + band(pct) +
        '" style="width:' + pct + '%"></span></span></li>';
    });
    out += '</ul>';
    return out;
  }

  /* ======================================================================
     ★ 진단 모드 — 도메인별 취약점 → 개인별 학습 순서
     ====================================================================== */
  var TIER = {
    focus:     { label: '집중 학습', desc: '해당 챕터 전체 + 도메인 연습 전량' },
    reinforce: { label: '보강',      desc: '함정 사전 + 도메인 연습 절반' },
    maintain:  { label: '유지',      desc: '모의고사에서만 점검' }
  };

  function buildDiagnostic(result) {
    var rows = [];
    CCDAK_DOMAINS.forEach(function (d) {
      var v = result.byDomain[d.name];
      if (!v || !v.total) return;
      var pct = Math.round((v.correct / v.total) * 100);
      var tier = pct < 60 ? 'focus' : (pct < 80 ? 'reinforce' : 'maintain');
      // 가중치 × 부족분 → 클수록 먼저 학습해야 이득이 큽니다.
      var priority = (d.weight || 10) * (100 - pct) / 100;
      rows.push({
        domain: d.name, weight: d.weight, correct: v.correct, total: v.total,
        pct: pct, tier: tier, priority: Math.round(priority * 10) / 10,
        chapters: d.chapters.slice(), page: d.page
      });
    });
    // 미출제 도메인도 결과에 남깁니다 (진단 세트가 불완전한 경우)
    rows.sort(function (a, b) {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return (b.weight || 0) - (a.weight || 0);
    });

    var diag = {
      at: result.at,
      score: result.score,
      total: result.total,
      byDomain: {},
      plan: rows
    };
    rows.forEach(function (r) {
      diag.byDomain[r.domain] = { correct: r.correct, total: r.total, pct: r.pct, tier: r.tier };
    });
    var pr = progressApi();
    if (pr) pr.setDiagnostic(diag);
    return diag;
  }

  function renderPlan(diag) {
    if (!diag || !diag.plan || !diag.plan.length) return '';
    var out = '<h3 id="study-plan">진단 결과 — 추천 학습 순서</h3>';
    out += '<p>가중치가 큰 도메인의 부족분을 먼저 메우는 순서입니다 ' +
      '(우선도 = 도메인 가중치 × 부족분).</p>';
    out += '<ol class="plan">';
    diag.plan.forEach(function (r) {
      out += '<li data-tier="' + r.tier + '">';
      out += '<div class="plan__head">';
      out += '<span class="plan__domain">' + esc(r.domain) + '</span>';
      out += '<span class="badge badge--' + (r.tier === 'focus' ? 'hard' : (r.tier === 'reinforce' ? 'medium' : 'easy')) + '">' +
        esc(TIER[r.tier].label) + '</span>';
      out += '<span class="bar-chart__val">' + r.pct + '% (' + r.correct + '/' + r.total + ')' +
        (r.weight ? ' · 가중치 ' + r.weight + '%' : '') + '</span>';
      out += '</div>';
      out += '<p class="card__desc">' + esc(TIER[r.tier].desc) + '</p>';
      out += '<ul class="plan__links">';
      r.chapters.forEach(function (ch) {
        out += '<li><a href="' + url('basics/' + ch + '.html') + '">' + esc(ch) + ' 본문</a></li>';
      });
      out += '<li><a href="' + url('quiz/index.html') + '?mode=domain&amp;domain=' +
        encodeURIComponent(r.domain) + '">' + esc(r.domain) + ' 연습문제</a></li>';
      if (r.tier !== 'maintain') {
        out += '<li><a href="' + url('ccdak/traps.html') + '">함정 사전</a></li>';
      }
      out += '</ul></li>';
    });
    out += '</ol>';
    return out;
  }

  /* ======================================================================
     모드별 문항 구성
     ====================================================================== */
  /**
   * @param {object} cfg  { mode, sets|setId, exam, domain, count, ... }
   * @returns {Promise<{questions:Array, title:string, setIds:Array, opts:object}>}
   */
  function buildSession(cfg) {
    cfg = cfg || {};
    var mode = cfg.mode || 'study';

    /* --- 명시적 세트 지정 (인라인 위젯의 기본 경로) ---
       매니페스트를 읽지 않습니다. 콘텐츠 페이지가 필요 없는 파일을 탐색해
       404 를 쏟아내지 않도록 하는 것이 중요합니다. */
    if (cfg.sets && cfg.sets.length) {
      return loadSets(cfg.sets).then(function (sets) {
        var qs = [];
        sets.forEach(function (s) { qs = qs.concat(s.questions); });
        return {
          questions: qs,
          title: cfg.title || (sets.length === 1 ? (sets[0].title || sets[0].setId) : '문제 풀이'),
          setIds: sets.length ? sets.map(function (s) { return s.setId; }) : cfg.sets.slice(),
          missing: sets.length ? null : cfg.sets.join(', '),
          manifest: null
        };
      });
    }

    /* --- diagnostic: 단일 세트이므로 매니페스트가 필요 없습니다 --- */
    if (mode === 'diagnostic') {
      return loadSet('ccdak-diagnostic').then(function (s) {
        return { questions: s.questions, title: s.title || 'CCDAK 진단 테스트', setIds: [s.setId] };
      }).catch(function () {
        return { questions: [], title: 'CCDAK 진단 테스트', setIds: ['ccdak-diagnostic'],
                 missing: 'ccdak-diagnostic.json' };
      });
    }

    return loadManifest().then(function (manifest) {
      var exam = cfg.exam || null;

      /* --- review (오답 노트) --- */
      if (mode === 'review') {
        var pr = progressApi();
        var wrongIds = pr ? pr.wrongQuestionIds() : [];
        if (!wrongIds.length) {
          return { questions: [], title: '오답 노트', setIds: [], manifest: manifest, emptyReason: 'no-wrong' };
        }
        return loadAllQuestions(manifest, {}).then(function (all) {
          var idx = {};
          all.forEach(function (q) { idx[q.id] = q; });
          var qs = wrongIds.map(function (id) { return idx[id]; }).filter(Boolean);
          return { questions: qs, title: '오답 노트 (' + qs.length + '문항)', setIds: [], manifest: manifest };
        });
      }

      /* --- weakness (약점 집중) --- */
      if (mode === 'weakness') {
        return loadAllQuestions(manifest, { exam: exam || 'CCDAK', mock: false }).then(function (all) {
          var pr = progressApi();
          var idToDomain = {};
          all.forEach(function (q) { idToDomain[q.id] = q.domain; });
          var mastery = pr ? pr.masteryByDomain(function (id) { return idToDomain[id] || null; }) : {};
          var diag = pr ? pr.diagnostic() : null;

          // 도메인 점수: 진단 결과가 있으면 우선, 없으면 누적 정답률
          var weakDomains = [];
          CCDAK_DOMAINS.forEach(function (d) {
            var pct = null;
            if (diag && diag.byDomain && diag.byDomain[d.name]) pct = diag.byDomain[d.name].pct;
            else if (mastery[d.name] && mastery[d.name].attempts > 0) pct = mastery[d.name].pct;
            if (pct === null || pct < 80) {
              weakDomains.push({ name: d.name, weight: d.weight, pct: pct === null ? 0 : pct });
            }
          });
          weakDomains.sort(function (a, b) {
            return (b.weight * (100 - b.pct)) - (a.weight * (100 - a.pct));
          });
          var names = weakDomains.map(function (x) { return x.name; });
          var qs = all.filter(function (q) { return names.indexOf(q.domain) >= 0; });
          // 가중치 큰 도메인이 앞에 오도록 정렬
          qs.sort(function (a, b) { return names.indexOf(a.domain) - names.indexOf(b.domain); });
          return {
            questions: qs,
            title: '약점 집중' + (names.length ? ' — ' + names.slice(0, 2).join(' · ') + (names.length > 2 ? ' 외' : '') : ''),
            setIds: [], manifest: manifest,
            emptyReason: qs.length ? null : 'no-weak',
            preserveOrder: true
          };
        });
      }

      /* --- domain / random / exam / study --- */
      var filter = {};
      if (exam) filter.exam = exam;
      if (mode === 'domain' && cfg.domain) filter.domain = cfg.domain;
      if (mode === 'exam') filter.mock = true;
      if (mode === 'domain' || mode === 'random') filter.mock = false;

      var ids = pickSetIds(manifest, filter);
      if (!ids.length) ids = pickSetIds(manifest, exam ? { exam: exam } : {});
      return loadSets(ids).then(function (sets) {
        var qs = [];
        sets.forEach(function (s) { qs = qs.concat(s.questions); });
        if (mode === 'domain' && cfg.domain) {
          qs = qs.filter(function (q) { return q.domain === cfg.domain; });
        }
        var title = cfg.title ||
          (mode === 'exam' ? ((exam || 'CCDAK') + ' 모의고사')
           : mode === 'domain' ? ('도메인 연습 — ' + (cfg.domain || '전체'))
           : mode === 'random' ? '랜덤 챌린지' : '문제 풀이');
        return { questions: qs, title: title, setIds: sets.map(function (s) { return s.setId; }), manifest: manifest };
      });
    });
  }

  /* ======================================================================
     마운트
     ====================================================================== */
  function emptyBox(msg, hint) {
    return '<div class="quiz"><div class="quiz__body"><div class="quiz__empty">' +
      '<strong>' + esc(msg) + '</strong>' + (hint ? '<p>' + hint + '</p>' : '') +
      '</div></div></div>';
  }

  var EMPTY_HINTS = {
    'no-wrong': '아직 틀린 문항이 없습니다. 챕터 확인 문제나 도메인 연습을 먼저 풀어 보세요.',
    'no-weak': '80% 미달 도메인이 없습니다. 모의고사로 실전 감각을 유지하세요.'
  };

  /**
   * 퀴즈를 컨테이너에 마운트합니다.
   * @param {Element} el
   * @param {object} cfg
   *   mode, sets|setId, exam, domain, count, durationSec, title,
   *   shuffleChoices, shuffleQuestions, showNav, resumeKey, onFinish,
   *   diagnostic (bool)
   * @returns {Promise<Engine|null>}
   */
  function mount(el, cfg) {
    if (!el) return Promise.resolve(null);
    cfg = Object.assign({}, cfg || {});
    if (cfg.setId && !cfg.sets) cfg.sets = [cfg.setId];
    el.innerHTML = '<div class="quiz"><div class="quiz__status">문제를 불러오는 중입니다…</div></div>';

    return buildSession(cfg).then(function (s) {
      if (!s.questions.length) {
        var hint = s.emptyReason ? EMPTY_HINTS[s.emptyReason] : null;
        if (!hint) {
          var f = s.missing || (cfg.sets ? cfg.sets.join(', ') + '.json' : 'manifest.json');
          hint = '문제은행 파일을 찾을 수 없습니다. Wave 2에서 <code>data/questions/' + esc(f) +
            '</code> 이 생성되면 자동으로 표시됩니다.';
        }
        el.innerHTML = emptyBox('아직 풀 수 있는 문항이 없습니다.', hint);
        return null;
      }
      var mode = cfg.mode || 'study';
      var engine = new Engine(el, {
        mode: mode,
        title: cfg.title || s.title,
        questions: s.questions,
        setIds: s.setIds,
        exam: cfg.exam || null,
        count: cfg.count || 0,
        shuffleChoices: cfg.shuffleChoices !== false,
        shuffleQuestions: s.preserveOrder ? false : (cfg.shuffleQuestions !== false),
        durationSec: cfg.durationSec || (mode === 'exam' ? 90 * 60 : null),
        showNav: cfg.showNav != null ? cfg.showNav : (mode === 'exam'),
        resumeKey: cfg.resumeKey || (mode === 'exam' ? 'exam:' + s.setIds.join(',') : null),
        diagnostic: cfg.diagnostic || mode === 'diagnostic',
        onFinish: cfg.onFinish || null,
        redirectToResult: !!cfg.redirectToResult
      });
      return engine;
    }).catch(function (e) {
      if (global.console) console.error('[quiz] 마운트 실패', e);
      el.innerHTML = emptyBox('문제를 불러오지 못했습니다.',
        'file:// 로 열면 브라우저가 JSON 로드를 차단합니다. 로컬 서버로 열어 보세요: ' +
        '<code>python3 -m http.server</code>');
      return null;
    });
  }

  /* ---------- 인라인 위젯 자동 마운트 ------------------------------------ */
  function autoMount(root) {
    var scope = root || doc;
    if (!scope || !scope.querySelectorAll) return;
    var nodes = scope.querySelectorAll('.quiz-embed');
    Array.prototype.forEach.call(nodes, function (el) {
      if (el.dataset.quizMounted === '1') return;
      el.dataset.quizMounted = '1';
      mount(el, {
        mode: el.getAttribute('data-mode') || 'study',
        setId: el.getAttribute('data-set') || null,
        count: parseInt(el.getAttribute('data-count'), 10) || 0,
        title: el.getAttribute('data-title') || null,
        shuffleQuestions: el.getAttribute('data-shuffle') !== 'false',
        shuffleChoices: el.getAttribute('data-shuffle-choices') !== 'false'
      });
    });
  }

  /* ======================================================================
     페이지 컨트롤러
     ---------------------------------------------------------------------
     인라인 <script> 가 금지되어 있으므로 quiz/*.html 의 동작도 여기서 처리합니다.
     <main data-quiz-page="hub|diagnostic|review|result"> 로 지정합니다.
     ====================================================================== */
  function query() {
    var out = {};
    try {
      var s = new global.URLSearchParams(global.location.search);
      s.forEach(function (v, k) { out[k] = v; });
    } catch (e) {}
    return out;
  }

  var MODE_LABEL = {
    study: '학습 모드 — 제출 즉시 정답과 해설',
    exam: '시험 모드 — 타이머 + 마지막 일괄 채점',
    domain: '도메인 연습 — 특정 도메인만',
    random: '랜덤 챌린지 — 전체 은행에서 무작위',
    review: '오답 노트 — 틀린 문항만 (3회 연속 정답 시 졸업)',
    weakness: '약점 집중 — 정답률 80% 미달 도메인',
    diagnostic: '진단 테스트 — 30문항 취약점 분석'
  };

  /* ---------- 허브 (quiz/index.html) ------------------------------------- */
  function pageHub(main) {
    var host = main.querySelector('[data-quiz-host]');
    var panel = main.querySelector('[data-quiz-panel]');
    if (!host) return;
    var q = query();

    loadManifest().then(function (manifest) {
      var sets = manifest.sets || [];
      var exams = [];
      sets.forEach(function (s) { if (s.exam && exams.indexOf(s.exam) < 0) exams.push(s.exam); });
      /* 도메인 연습은 단일 도메인 세트만 대상입니다.
         모의고사·진단은 domain:"Mixed" 인 혼합 세트이므로 목록에서 제외합니다
         (고르면 필터가 비어 전체 세트로 폴백해 "도메인 연습"이 아니게 됩니다). */
      var domains = [];
      sets.forEach(function (s) {
        if (s.mock || s.diagnostic) return;
        if (!s.domain || /^(mixed|혼합)$/i.test(s.domain)) return;
        if (domains.indexOf(s.domain) < 0) domains.push(s.domain);
      });

      if (panel) {
        var h = '';
        if (!sets.length) {
          h += '<div class="quiz__empty"><strong>문제은행이 아직 없습니다.</strong>' +
            '<p>Wave 2 에이전트가 <code>data/questions/</code> 를 생성하면 이 화면에서 모드를 골라 응시할 수 있습니다. ' +
            'file:// 로 열었다면 <code>python3 -m http.server</code> 로 로컬 서버를 띄워 주세요.</p></div>';
        } else {
          h += '<div class="toolbar">';
          h += '<div class="field"><label for="qh-mode">모드</label><select id="qh-mode">';
          ['study', 'exam', 'domain', 'random', 'review', 'weakness'].forEach(function (m) {
            h += '<option value="' + m + '"' + (q.mode === m ? ' selected' : '') + '>' + esc(MODE_LABEL[m]) + '</option>';
          });
          h += '</select></div>';

          h += '<div class="field"><label for="qh-exam">시험</label><select id="qh-exam">';
          h += '<option value="">전체</option>';
          exams.forEach(function (e) {
            h += '<option value="' + esc(e) + '"' + (q.exam === e ? ' selected' : '') + '>' + esc(e) + '</option>';
          });
          h += '</select></div>';

          h += '<div class="field"><label for="qh-domain">도메인 (도메인 연습)</label><select id="qh-domain">';
          h += '<option value="">전체</option>';
          domains.forEach(function (d) {
            h += '<option value="' + esc(d) + '"' + (q.domain === d ? ' selected' : '') + '>' + esc(d) + '</option>';
          });
          h += '</select></div>';

          h += '<div class="field"><label for="qh-set">세트 직접 선택</label><select id="qh-set">';
          h += '<option value="">(모드에 맡김)</option>';
          sets.forEach(function (s) {
            h += '<option value="' + esc(s.setId) + '"' + (q.set === s.setId ? ' selected' : '') + '>' +
              esc(s.title || s.setId) + ' · ' + (s.count || 0) + '문항</option>';
          });
          h += '</select></div>';

          h += '<div class="field"><label for="qh-count">문항 수</label><select id="qh-count">';
          [10, 20, 30, 60, 0].forEach(function (n) {
            h += '<option value="' + n + '"' + (String(q.count) === String(n) ? ' selected' : '') + '>' +
              (n === 0 ? '전체' : n + '문항') + '</option>';
          });
          h += '</select></div>';

          h += '<button type="button" class="btn btn--primary" data-act="start">시작</button>';
          h += '</div>';

          if (manifest.__discovered) {
            h += '<aside class="note" data-label="안내"><p><code>data/questions/manifest.json</code> 이 아직 없어 ' +
              '파일을 직접 탐색해 ' + sets.length + '개 세트를 찾았습니다. Wave 2 B6 가 매니페스트를 생성하면 ' +
              '도메인 가중치와 모의고사 구분이 정확해집니다.</p></aside>';
          }
          h += renderProgressSummary();
        }
        panel.innerHTML = h;
      }

      function start(cfg) {
        var engine = mount(host, cfg);
        host.scrollIntoView({ behavior: 'auto', block: 'start' });
        return engine;
      }

      if (panel) {
        panel.addEventListener('click', function (e) {
          var b = e.target.closest && e.target.closest('[data-act="start"]');
          if (!b) return;
          e.preventDefault();
          var mode = (panel.querySelector('#qh-mode') || {}).value || 'study';
          var exam = (panel.querySelector('#qh-exam') || {}).value || null;
          var domain = (panel.querySelector('#qh-domain') || {}).value || null;
          var setId = (panel.querySelector('#qh-set') || {}).value || null;
          var count = parseInt((panel.querySelector('#qh-count') || {}).value, 10) || 0;
          start({
            mode: mode, exam: exam || null, domain: domain || null,
            sets: setId ? [setId] : null,
            count: mode === 'exam' && !count ? 60 : count,
            durationSec: mode === 'exam' ? 90 * 60 : null
          });
        });
      }

      // 쿼리 파라미터로 바로 시작 (진단 결과의 학습 순서 링크가 이 경로를 씁니다)
      if (q.mode || q.set) {
        start({
          mode: q.mode || 'study',
          exam: q.exam || null,
          domain: q.domain || null,
          sets: q.set ? [q.set] : null,
          count: parseInt(q.count, 10) || (q.mode === 'exam' ? 60 : 0),
          durationSec: q.mode === 'exam' ? 90 * 60 : null
        });
      } else if (sets.length) {
        host.innerHTML = emptyBox('모드를 고르고 “시작”을 누르세요.',
          '학습 모드는 문항마다 즉시 채점하고, 시험 모드는 90분 타이머로 60문항을 일괄 채점합니다.');
      }
    });
  }

  function renderProgressSummary() {
    var p = progressApi();
    if (!p) return '';
    var stats = p.quizStats();
    var ids = Object.keys(stats);
    if (!ids.length) return '';
    var attempts = 0, correct = 0, graduated = 0;
    ids.forEach(function (id) {
      attempts += stats[id].attempts || 0;
      correct += stats[id].correct || 0;
      if ((stats[id].streak || 0) >= GRADUATE_STREAK) graduated++;
    });
    var wrong = p.wrongQuestionIds().length;
    var pct = attempts ? Math.round((correct / attempts) * 100) : 0;
    var out = '<div class="result__score">';
    out += '<span class="result__pct" data-band="' + band(pct) + '">' + pct + '%</span>';
    out += '<span class="result__frac">누적 ' + correct + ' / ' + attempts + ' 시도</span>';
    out += '<span class="result__stat">푼 문항<b>' + ids.length + '</b></span>';
    out += '<span class="result__stat">졸업<b>' + graduated + '</b></span>';
    out += '<span class="result__stat">복습 대기<b>' + wrong + '</b></span>';
    out += '</div>';
    var diag = p.diagnostic();
    if (diag && diag.plan && diag.plan.length) {
      out += '<p><a href="' + url('quiz/diagnostic.html') + '">진단 결과</a>가 저장되어 있습니다 (' +
        esc(String(diag.at).slice(0, 10)) + '). 약점 집중 모드가 이 결과를 우선 참조합니다.</p>';
    }
    return out;
  }

  /* ---------- 진단 (quiz/diagnostic.html) -------------------------------- */
  function pageDiagnostic(main) {
    var host = main.querySelector('[data-quiz-host]');
    var prev = main.querySelector('[data-diagnostic-previous]');
    if (!host) return;
    var p = progressApi();

    if (prev) {
      var diag = p ? p.diagnostic() : null;
      if (diag && diag.plan && diag.plan.length) {
        prev.innerHTML = '<h2 id="previous-result">지난 진단 결과 (' + esc(String(diag.at).slice(0, 10)) + ')</h2>' +
          '<p>총점 ' + diag.score + ' / ' + diag.total + '. 아래 순서대로 학습하면 가중치가 큰 약점을 먼저 메웁니다.</p>' +
          renderPlan(diag) +
          '<p><button type="button" class="btn btn--sm btn--danger" data-act="clear-diagnostic">진단 결과 삭제</button></p>';
        prev.addEventListener('click', function (e) {
          var b = e.target.closest && e.target.closest('[data-act="clear-diagnostic"]');
          if (!b) return;
          e.preventDefault();
          if (global.confirm('저장된 진단 결과를 삭제합니다. 계속할까요?')) {
            if (p) p.setDiagnostic(null);
            prev.innerHTML = '';
          }
        });
      }
    }

    mount(host, {
      mode: 'diagnostic',
      diagnostic: true,
      shuffleQuestions: false,   // 도메인 × 5문항 구성을 유지
      title: 'CCDAK 진단 테스트',
      exam: 'CCDAK',
      onFinish: function (result) {
        // 결과 요약은 Engine 이 이미 렌더링합니다. 학습 순서는 진단 블록에도 반영.
        if (prev && result.diagnostic) {
          prev.innerHTML = '<h2 id="previous-result">진단 결과가 저장되었습니다</h2>' +
            '<p>홈 대시보드와 “약점 집중” 모드가 이 결과를 참조합니다.</p>';
        }
      }
    });
  }

  /* ---------- 오답 노트 (quiz/review.html) ------------------------------- */
  function pageReview(main) {
    var host = main.querySelector('[data-quiz-host]');
    var summary = main.querySelector('[data-review-summary]');
    if (!host) return;
    var p = progressApi();

    if (summary && p) {
      var stats = p.quizStats();
      var ids = Object.keys(stats);
      var wrong = p.wrongQuestionIds();
      var graduated = ids.filter(function (id) { return (stats[id].streak || 0) >= GRADUATE_STREAK; });
      var h = '<div class="result__score">';
      h += '<span class="result__pct" data-band="' + (wrong.length ? 'low' : 'high') + '">' + wrong.length + '</span>';
      h += '<span class="result__frac">복습 대기 문항</span>';
      h += '<span class="result__stat">졸업<b>' + graduated.length + '</b></span>';
      h += '<span class="result__stat">푼 문항<b>' + ids.length + '</b></span>';
      h += '</div>';
      h += '<p>같은 문항을 <strong>3회 연속으로 맞히면 졸업</strong> 처리되어 이 목록에서 빠집니다. ' +
        '한 번이라도 틀리면 연속 기록이 0으로 돌아갑니다.</p>';
      if (ids.length) {
        h += '<p><button type="button" class="btn btn--sm btn--danger" data-act="reset-quiz">퀴즈 통계 초기화</button></p>';
      }
      summary.innerHTML = h;
      summary.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('[data-act="reset-quiz"]');
        if (!b) return;
        e.preventDefault();
        if (global.confirm('퀴즈 통계·시험 이력·진단 결과를 삭제합니다. 계속할까요?')) {
          p.reset('quiz');
          global.location.reload();
        }
      });
    }

    mount(host, { mode: 'review', title: '오답 노트', shuffleQuestions: true });
  }

  /* ---------- 결과 리포트 (quiz/result.html) ----------------------------- */
  function pageResult(main) {
    var host = main.querySelector('[data-quiz-host]');
    if (!host) return;
    var p = progressApi();
    var r = p ? p.lastResult() : null;

    if (!r) {
      host.innerHTML = emptyBox('표시할 채점 결과가 없습니다.',
        '<a href="' + url('quiz/index.html') + '">문제 풀이 허브</a>에서 한 세트를 완주하면 ' +
        '이 페이지에 상세 리포트가 남습니다.');
      return;
    }

    var pct = r.total ? Math.round((r.score / r.total) * 100) : 0;
    var h = '';
    h += '<div class="result__score">';
    h += '<span class="result__pct" data-band="' + band(pct) + '">' + pct + '%</span>';
    h += '<span class="result__frac">' + r.score + ' / ' + r.total + ' 문항</span>';
    h += '<span class="result__stat">소요 시간<b>' + fmtTime(r.durationSec) + '</b></span>';
    h += '<span class="result__stat">모드<b>' + esc(r.mode) + '</b></span>';
    h += '<span class="result__stat">응시 시각<b>' + esc(String(r.at).replace('T', ' ').slice(0, 16)) + '</b></span>';
    h += '</div>';
    if (r.title) h += '<p>' + esc(r.title) + (r.autoSubmitted ? ' · 시간 종료로 자동 제출됨' : '') + '</p>';

    h += renderBreakdown('도메인별 정답률', r.byDomain);
    h += renderBreakdown('유형별 정답률', r.byType, TYPE_LABEL);

    /* 취약 도메인 Top 3 → 챕터 링크 */
    var weak = Object.keys(r.byDomain || {}).map(function (d) {
      var v = r.byDomain[d];
      return { domain: d, pct: v.total ? Math.round((v.correct / v.total) * 100) : 0,
               correct: v.correct, total: v.total, meta: domainMeta(d) };
    }).filter(function (x) { return x.pct < 100; })
      .sort(function (a, b) {
        var wa = (a.meta.weight || 10) * (100 - a.pct);
        var wb = (b.meta.weight || 10) * (100 - b.pct);
        return wb - wa;
      }).slice(0, 3);

    if (weak.length) {
      h += '<h2 id="weak-domains">취약 도메인 Top ' + weak.length + '</h2>';
      h += '<p>가중치 × 부족분 순입니다. 위쪽을 먼저 학습하는 것이 점수 상승 폭이 큽니다.</p>';
      h += '<ol class="plan">';
      weak.forEach(function (w) {
        var tier = w.pct < 60 ? 'focus' : (w.pct < 80 ? 'reinforce' : 'maintain');
        h += '<li data-tier="' + tier + '"><div class="plan__head">' +
          '<span class="plan__domain">' + esc(w.domain) + '</span>' +
          '<span class="bar-chart__val">' + w.pct + '% (' + w.correct + '/' + w.total + ')' +
          (w.meta.weight ? ' · 가중치 ' + w.meta.weight + '%' : '') + '</span></div>';
        h += '<ul class="plan__links">';
        (w.meta.chapters || []).forEach(function (ch) {
          h += '<li><a href="' + url('basics/' + ch + '.html') + '">' + esc(ch) + ' 본문</a></li>';
        });
        h += '<li><a href="' + url('quiz/index.html') + '?mode=domain&amp;domain=' +
          encodeURIComponent(w.domain) + '">' + esc(w.domain) + ' 연습</a></li>';
        h += '</ul></li>';
      });
      h += '</ol>';
    }

    /* 챕터별 복습 추천 */
    var chapters = Object.keys(r.byChapter || {}).filter(function (ch) {
      var v = r.byChapter[ch];
      return v.total && v.correct < v.total;
    }).sort();
    if (chapters.length) {
      h += '<h2 id="review-chapters">복습할 챕터</h2><ul class="plan__links">';
      chapters.forEach(function (ch) {
        var v = r.byChapter[ch];
        h += '<li><a href="' + url('basics/' + ch + '.html') + '">' + esc(ch) +
          ' (' + v.correct + '/' + v.total + ')</a></li>';
      });
      h += '</ul>';
    }

    /* 오답 목록 */
    var wrongQs = (r.questions || []).filter(function (d) { return !d.correct; });
    h += '<h2 id="wrong-questions">오답 ' + wrongQs.length + '문항</h2>';
    if (!wrongQs.length) {
      h += '<aside class="note note--ok" data-label="완주"><p>전 문항 정답입니다.</p></aside>';
    } else {
      h += '<ul class="wrong-list">';
      wrongQs.forEach(function (d) {
        h += '<li><details><summary>' +
          '<span class="badge badge--' + esc(d.difficulty || 'medium') + '">' +
          esc(DIFF_LABEL[d.difficulty] || d.difficulty || '') + '</span> ' +
          '<span class="badge">' + esc(TYPE_LABEL[d.type] || d.type) + '</span> ' +
          md(d.question) + '</summary><div class="wrong-list__body">';
        h += '<p><b>내 답</b><br>' + esc(d.yourAnswer) + '</p>';
        h += '<p><b>정답</b><br>' + esc(d.correctAnswer) + '</p>';
        h += '<p>' + md(d.explanation) + '</p>';
        if (Array.isArray(d.refs) && d.refs.length) {
          h += '<ul class="quiz__refs">';
          d.refs.forEach(function (rf) {
            h += '<li><a href="' + esc(rf.url) + '" target="_blank" rel="noopener noreferrer">' +
              esc(rf.title || rf.url) + '</a></li>';
          });
          h += '</ul>';
        }
        if (d.chapter) h += '<p><a href="' + url('basics/' + d.chapter + '.html') + '">' + esc(d.chapter) + ' 복습</a></p>';
        h += '</div></details></li>';
      });
      h += '</ul>';
    }

    /* 응시 이력 */
    var hist = p ? p.exams() : [];
    if (hist.length) {
      h += '<h2 id="exam-history">응시 이력</h2><div class="table-scroll"><table>';
      h += '<caption>최근 응시 기록 (최신 20건)</caption><thead><tr>' +
        '<th scope="col">일시</th><th scope="col">모드</th><th scope="col">세트</th>' +
        '<th scope="col">점수</th><th scope="col">소요</th></tr></thead><tbody>';
      hist.slice(-20).reverse().forEach(function (e) {
        var ep = e.total ? Math.round((e.score / e.total) * 100) : 0;
        h += '<tr><td>' + esc(String(e.at).replace('T', ' ').slice(0, 16)) + '</td>' +
          '<td>' + esc(e.mode || '') + '</td><td>' + esc(e.setId || '') + '</td>' +
          '<td>' + e.score + ' / ' + e.total + ' (' + ep + '%)</td>' +
          '<td>' + fmtTime(e.durationSec) + '</td></tr>';
      });
      h += '</tbody></table></div>';
    }

    h += '<div class="toolbar">';
    h += '<a class="btn btn--primary" href="' + url('quiz/index.html') + '">다시 응시</a>';
    h += '<a class="btn" href="' + url('quiz/review.html') + '">오답 노트로</a>';
    h += '<button type="button" class="btn btn--ghost btn--sm" data-act="clear-result">이 결과 지우기</button>';
    h += '</div>';

    host.innerHTML = h;
    highlightIn(host);
    host.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-act="clear-result"]');
      if (!b) return;
      e.preventDefault();
      if (p) p.clearLastResult();
      global.location.reload();
    });
  }

  var PAGES = { hub: pageHub, diagnostic: pageDiagnostic, review: pageReview, result: pageResult };

  function initPage() {
    var main = doc.querySelector('main[data-quiz-page]');
    if (!main) return;
    var kind = main.getAttribute('data-quiz-page');
    var fn = PAGES[kind];
    if (fn) {
      try { fn(main); } catch (e) { if (global.console) console.error('[quiz] 페이지 초기화 실패', e); }
    }
  }

  /* ---------- 공개 -------------------------------------------------------- */
  global.AG = global.AG || {};
  global.AG.quiz = {
    initPage: initPage,
    MODE_LABEL: MODE_LABEL,
    mount: mount,
    autoMount: autoMount,
    Engine: Engine,
    loadManifest: loadManifest,
    loadSet: loadSet,
    loadSets: loadSets,
    loadAllQuestions: loadAllQuestions,
    pickSetIds: pickSetIds,
    discoverSets: discoverSets,
    buildSession: buildSession,
    buildDiagnostic: buildDiagnostic,
    renderPlan: renderPlan,
    renderBreakdown: renderBreakdown,
    prepare: prepare,
    grade: grade,
    describeAnswer: describeAnswer,
    describeResponse: describeResponse,
    CCDAK_DOMAINS: CCDAK_DOMAINS,
    TYPE_LABEL: TYPE_LABEL,
    DIFF_LABEL: DIFF_LABEL,
    TIER: TIER,
    GRADUATE_STREAK: GRADUATE_STREAK,
    fmtTime: fmtTime,
    band: band,
    root: ROOT,
    _md: md,
    _esc: esc
  };

  function boot() { autoMount(); initPage(); }
  if (doc) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
