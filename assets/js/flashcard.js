/* ==========================================================================
   AWS SAA Guide — 플래시카드 (flashcard.js)
   --------------------------------------------------------------------------
   ★ B4 에이전트 필독 — 이 엔진이 소비하는 JSON 형식 ★

   덱 목록:  data/flashcards/index.json
   ```json
   {
     "generatedAt": "2026-07-28",
     "decks": [
       { "deckId": "ccdak-producer-defaults",
         "file": "ccdak-producer-defaults.json",
         "title": "Producer 설정 기본값",
         "exam": "CCDAK", "chapter": "ch04", "count": 24 }
     ]
   }
   ```

   덱 파일:  data/flashcards/{deckId}.json
   ```json
   {
     "deckId": "ccdak-producer-defaults",
     "title": "Producer 설정 기본값",
     "exam": "CCDAK",
     "kafkaVersion": "4.3",
     "cards": [
       { "id": "fc-prod-001",
         "deck": "ccdak-producer-defaults",
         "front": "`acks` 의 기본값은?",
         "back": "`all` — Kafka 3.0부터 기본값이 `1` 에서 바뀌었습니다.",
         "tags": ["acks", "durability"],
         "chapter": "ch04" }
     ]
   }
   ```
   · id      전역 유일 (`fc-` 접두어 권장). 진도 저장 키가 됩니다.
   · deck    소속 deckId (없으면 파일의 deckId 를 자동 주입)
   · front   앞면. 설정명·개념. `백틱`으로 코드 표기 가능
   · back    뒷면. 기본값·정의. `백틱`, **굵게** 사용 가능
   · tags    2~5개
   · chapter 'ch01'~'ch11' — 복습 링크 생성에 사용

   간격 반복
     "알았음" 3회 연속 → 졸업(graduated). "몰랐음"이면 streak 와 졸업이 리셋됩니다.
     진도는 ag:progress:cards 에 저장됩니다 (progress.js 담당).

   키보드
     Space / Enter  뒤집기      1  몰랐음      2  알았음      → / N  다음      ← 이전
   ========================================================================== */
(function (global) {
  'use strict';

  var doc = global.document;

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

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function md(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function pr() { return (global.AG && global.AG.progress) || null; }
  function fetchJSON(p) {
    if (!global.fetch) return Promise.reject(new Error('fetch 미지원'));
    return global.fetch(p, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' — ' + p);
      return r.json();
    });
  }

  /* ---------- 로딩 -------------------------------------------------------- */
  var cache = { index: null, decks: Object.create(null) };

  function loadIndex() {
    if (cache.index) return Promise.resolve(cache.index);
    return fetchJSON(url('data/flashcards/index.json')).then(function (m) {
      cache.index = (m && Array.isArray(m.decks)) ? m : { decks: [] };
      return cache.index;
    }).catch(function () {
      cache.index = { decks: [], __missing: true };
      return cache.index;
    });
  }

  function loadDeck(deckId) {
    if (cache.decks[deckId]) return Promise.resolve(cache.decks[deckId]);
    return fetchJSON(url('data/flashcards/' + deckId + '.json')).then(function (d) {
      d = d || {};
      d.deckId = d.deckId || deckId;
      d.cards = Array.isArray(d.cards) ? d.cards : [];
      d.cards.forEach(function (c) { if (!c.deck) c.deck = d.deckId; });
      cache.decks[deckId] = d;
      return d;
    });
  }

  function loadDecks(ids) {
    return Promise.all((ids || []).map(function (id) {
      return loadDeck(id).catch(function (e) {
        if (global.console) console.warn('[flashcard] 덱 로드 실패: ' + id, e.message);
        return null;
      });
    })).then(function (l) { return l.filter(Boolean); });
  }

  /* ======================================================================
     엔진
     ====================================================================== */
  function Deck(el, cfg) {
    this.el = el;
    this.o = Object.assign({
      cards: [],
      decks: [],           // [{deckId,title,count}]
      deckId: 'all',
      shuffle: true,
      hideGraduated: false,
      title: '플래시카드'
    }, cfg || {});
    this.queue = [];
    this.i = 0;
    this.flipped = false;
    this._keys = null;
    this.session = { seen: 0, known: 0, unknown: 0 };
    this.build();
    this.wire();      // 위임 리스너를 컨테이너에 단 한 번만 등록
    this.render();
    this.bindKeys();
  }

  Deck.prototype.build = function () {
    var p = pr();
    var list = this.o.cards.filter(function (c) { return c && c.id; });
    if (this.o.deckId && this.o.deckId !== 'all') {
      list = list.filter(function (c) { return c.deck === this.o.deckId; }, this);
    }
    if (this.o.hideGraduated && p) {
      list = list.filter(function (c) { return !p.getCardStat(c.id).graduated; });
    }
    this.queue = this.o.shuffle ? shuffle(list) : list;
    if (this.i >= this.queue.length) this.i = 0;
  };

  Deck.prototype.destroy = function () {
    if (this._keys) doc.removeEventListener('keydown', this._keys);
  };

  Deck.prototype.current = function () { return this.queue[this.i] || null; };

  Deck.prototype.flip = function () {
    if (!this.current()) return;
    this.flipped = !this.flipped;
    this.render();
    this.announce(this.flipped ? '뒷면을 표시했습니다.' : '앞면으로 돌아갔습니다.');
  };

  Deck.prototype.mark = function (known) {
    var c = this.current();
    if (!c) return;
    var p = pr();
    var stat = p ? p.recordCard(c.id, known) : null;
    this.session.seen++;
    if (known) this.session.known++; else this.session.unknown++;
    var msg = known
      ? '알았음으로 기록했습니다.' + (stat && stat.graduated ? ' 3회 연속 정답으로 졸업했습니다.' :
          (stat ? ' 연속 ' + stat.streak + '회.' : ''))
      : '몰랐음으로 기록했습니다. 연속 기록이 초기화됩니다.';
    this.next(msg);
  };

  Deck.prototype.next = function (msg) {
    if (this.i < this.queue.length - 1) {
      this.i++;
      this.flipped = false;
      this.render();
      if (msg) this.announce(msg + ' 다음 카드입니다.');
    } else {
      this.i = this.queue.length; // 종료 화면
      this.render();
      if (msg) this.announce(msg + ' 덱을 모두 돌았습니다.');
    }
  };

  Deck.prototype.prev = function () {
    if (this.i === 0) return;
    this.i--;
    this.flipped = false;
    this.render();
  };

  Deck.prototype.announce = function (t) {
    var live = this.el.querySelector('.fc__live');
    if (live) live.textContent = t;
  };

  Deck.prototype.render = function () {
    var p = pr();
    var html = '';
    var total = this.queue.length;

    /* 툴바 */
    html += '<div class="toolbar">';
    if (this.o.decks.length > 1) {
      html += '<div class="field"><label for="fc-deck">덱</label><select id="fc-deck" data-act="deck">';
      html += '<option value="all"' + (this.o.deckId === 'all' ? ' selected' : '') + '>전체</option>';
      this.o.decks.forEach(function (d) {
        html += '<option value="' + esc(d.deckId) + '"' + (this.o.deckId === d.deckId ? ' selected' : '') + '>' +
          esc(d.title || d.deckId) + (d.count ? ' (' + d.count + ')' : '') + '</option>';
      }, this);
      html += '</select></div>';
    }
    html += '<div class="field"><label for="fc-hide">졸업 카드</label>' +
      '<label class="dg-controls__row"><input type="checkbox" id="fc-hide" data-act="hide"' +
      (this.o.hideGraduated ? ' checked' : '') + '> <span>제외</span></label></div>';
    html += '<button type="button" class="btn btn--sm" data-act="shuffle">셔플</button>';
    html += '</div>';

    if (!total) {
      html += '<div class="quiz__empty"><strong>표시할 카드가 없습니다.</strong>' +
        '<p>' + (this.o.hideGraduated
          ? '이 덱의 카드를 모두 졸업했습니다. “졸업 카드 제외”를 끄면 다시 볼 수 있습니다.'
          : '덱 데이터가 아직 없습니다. Wave 2 B4 에이전트가 <code>data/flashcards/</code> 를 생성하면 표시됩니다.') +
        '</p></div>';
      html += '<p class="fc__live sr-only" role="status" aria-live="polite"></p>';
      this.el.innerHTML = html;
      this.wire();
      return;
    }

    if (this.i >= total) {
      /* 완주 화면 */
      var pct = this.session.seen ? Math.round((this.session.known / this.session.seen) * 100) : 0;
      html += '<div class="result__score">';
      html += '<span class="result__pct" data-band="' + (pct >= 80 ? 'high' : pct >= 60 ? 'mid' : 'low') + '">' + pct + '%</span>';
      html += '<span class="result__frac">알았음 ' + this.session.known + ' / ' + this.session.seen + '</span>';
      html += '<span class="result__stat">몰랐음<b>' + this.session.unknown + '</b></span>';
      html += '</div>';
      var gradCount = 0;
      if (p) this.queue.forEach(function (c) { if (p.getCardStat(c.id).graduated) gradCount++; });
      html += '<p>이 덱에서 졸업한 카드: <b>' + gradCount + ' / ' + total + '</b> ' +
        '(“알았음” 3회 연속이면 졸업입니다.)</p>';
      html += '<div class="fc__actions">';
      html += '<button type="button" class="btn btn--primary" data-act="again">다시 돌기</button>';
      if (this.session.unknown > 0) {
        html += '<button type="button" class="btn" data-act="onlyUnknown">몰랐던 카드만</button>';
      }
      html += '</div>';
      html += '<p class="fc__live sr-only" role="status" aria-live="polite"></p>';
      this.el.innerHTML = html;
      this.wire();
      return;
    }

    var c = this.current();
    var stat = p ? p.getCardStat(c.id) : { streak: 0, graduated: false, seen: 0 };

    html += '<div class="fc">';
    html += '<button type="button" class="fc__card" data-act="flip" aria-pressed="' + this.flipped + '"' +
      ' aria-label="카드 뒤집기. 현재 ' + (this.flipped ? '뒷면' : '앞면') + '">';
    html += '<span class="fc__side">';
    if (!this.flipped) {
      html += '<span class="fc__label">앞면 · ' + (this.i + 1) + ' / ' + total + '</span>';
      html += '<span class="fc__front">' + md(c.front) + '</span>';
      html += '<span class="fc__tags">클릭하거나 Space 로 뒤집기</span>';
    } else {
      html += '<span class="fc__label">뒷면</span>';
      html += '<span class="fc__back">' + md(c.back) + '</span>';
      if (Array.isArray(c.tags) && c.tags.length) {
        html += '<span class="fc__tags">' + c.tags.map(esc).join(' · ') + '</span>';
      }
    }
    html += '</span></button>';

    html += '<div class="fc__actions">';
    if (!this.flipped) {
      html += '<button type="button" class="btn btn--primary" data-act="flip">뒤집기 <kbd>Space</kbd></button>';
    } else {
      html += '<button type="button" class="btn btn--danger" data-act="unknown">몰랐음 <kbd>1</kbd></button>';
      html += '<button type="button" class="btn btn--primary" data-act="known">알았음 <kbd>2</kbd></button>';
    }
    html += '<span class="quiz__actions-spacer"></span>';
    if (this.i > 0) html += '<button type="button" class="btn btn--sm" data-act="prev">← 이전</button>';
    html += '<button type="button" class="btn btn--sm" data-act="skip">다음 →</button>';
    html += '</div>';

    html += '<div class="fc__stats">';
    html += '<span>연속 정답 <span class="fc__streak" aria-label="연속 ' + stat.streak + '회">';
    for (var k = 0; k < 3; k++) {
      html += '<span class="fc__pip" data-on="' + (k < stat.streak) + '"></span>';
    }
    html += '</span></span>';
    if (stat.graduated) html += '<span class="fc__graduated">✓ 졸업</span>';
    html += '<span>이번 세션 ' + this.session.known + '알 / ' + this.session.unknown + '몰</span>';
    if (c.chapter) {
      html += '<span><a href="' + url('basics/' + esc(c.chapter) + '.html') + '">' + esc(c.chapter) + ' 본문</a></span>';
    }
    html += '</div>';
    html += '<p class="fc__live sr-only" role="status" aria-live="polite"></p>';
    html += '</div>';

    this.el.innerHTML = html;
    this.wire();
  };

  /**
   * 컨테이너에 위임 등록. render() 는 innerHTML 만 교체하므로 한 번만 등록하면 됩니다.
   * (렌더마다 등록하면 리스너가 누적되어 한 번의 클릭이 여러 번 처리됩니다.)
   */
  Deck.prototype.wire = function () {
    if (this._wired) return;
    this._wired = true;
    var self = this;
    this.el.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!b || b.tagName === 'SELECT' || b.tagName === 'INPUT') return;
      var act = b.getAttribute('data-act');
      e.preventDefault();
      if (act === 'flip') self.flip();
      else if (act === 'known') self.mark(true);
      else if (act === 'unknown') self.mark(false);
      else if (act === 'skip') { self.flipped = false; self.next(); }
      else if (act === 'prev') self.prev();
      else if (act === 'shuffle') { self.queue = shuffle(self.queue); self.i = 0; self.flipped = false; self.render(); self.announce('카드를 섞었습니다.'); }
      else if (act === 'again') { self.i = 0; self.flipped = false; self.session = { seen: 0, known: 0, unknown: 0 }; self.build(); self.render(); }
      else if (act === 'onlyUnknown') {
        var p = pr();
        if (p) self.queue = self.queue.filter(function (c) { return p.getCardStat(c.id).streak === 0; });
        self.i = 0; self.flipped = false;
        self.session = { seen: 0, known: 0, unknown: 0 };
        self.render();
      }
    });

    this.el.addEventListener('change', function (e) {
      var t = e.target;
      var act = t.getAttribute && t.getAttribute('data-act');
      if (act === 'deck') { self.o.deckId = t.value; self.i = 0; self.flipped = false; self.build(); self.render(); }
      else if (act === 'hide') { self.o.hideGraduated = t.checked; self.i = 0; self.flipped = false; self.build(); self.render(); }
    });
  };

  Deck.prototype.bindKeys = function () {
    var self = this;
    this._keys = function (e) {
      if (!self.el || !self.el.isConnected) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target, tag = t && t.tagName ? t.tagName.toUpperCase() : '';
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || (t && t.isContentEditable)) return;
      if (self.i >= self.queue.length) return;
      if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') { e.preventDefault(); self.flip(); }
      else if (e.key === '1') { e.preventDefault(); if (self.flipped) self.mark(false); else self.flip(); }
      else if (e.key === '2') { e.preventDefault(); if (self.flipped) self.mark(true); else self.flip(); }
      else if (e.key === 'ArrowRight' || e.key === 'n' || e.key === 'N') { e.preventDefault(); self.flipped = false; self.next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); self.prev(); }
    };
    doc.addEventListener('keydown', this._keys);
  };

  /* ======================================================================
     마운트
     ====================================================================== */
  /**
   * @param {Element} el
   * @param {object} cfg  { decks:[deckId], deckId, shuffle, hideGraduated, title }
   */
  function mount(el, cfg) {
    if (!el) return Promise.resolve(null);
    cfg = cfg || {};
    el.innerHTML = '<div class="quiz__status">카드를 불러오는 중입니다…</div>';

    return loadIndex().then(function (idx) {
      var wanted = cfg.decks && cfg.decks.length
        ? cfg.decks
        : (idx.decks || []).filter(function (d) {
            return !cfg.exam || d.exam === cfg.exam;
          }).map(function (d) { return d.deckId; });

      if (!wanted.length) {
        el.innerHTML = '<div class="quiz__empty"><strong>플래시카드 덱이 아직 없습니다.</strong>' +
          '<p>Wave 2 B4 에이전트가 <code>data/flashcards/index.json</code> 과 덱 파일을 생성하면 ' +
          '이 화면에 자동으로 나타납니다.</p></div>';
        return null;
      }

      return loadDecks(wanted).then(function (decks) {
        var cards = [];
        decks.forEach(function (d) { cards = cards.concat(d.cards); });
        if (!cards.length) {
          el.innerHTML = '<div class="quiz__empty"><strong>카드를 불러오지 못했습니다.</strong>' +
            '<p>덱 파일이 비어 있거나 형식이 맞지 않습니다.</p></div>';
          return null;
        }
        return new Deck(el, {
          cards: cards,
          decks: decks.map(function (d) {
            return { deckId: d.deckId, title: d.title || d.deckId, count: d.cards.length };
          }),
          deckId: cfg.deckId || 'all',
          shuffle: cfg.shuffle !== false,
          hideGraduated: !!cfg.hideGraduated,
          title: cfg.title || '플래시카드'
        });
      });
    }).catch(function (e) {
      if (global.console) console.error('[flashcard] 마운트 실패', e);
      el.innerHTML = '<div class="quiz__empty"><strong>카드를 불러오지 못했습니다.</strong>' +
        '<p>file:// 로 열면 JSON 로드가 차단됩니다. <code>python3 -m http.server</code> 로 열어 보세요.</p></div>';
      return null;
    });
  }

  function autoMount(root) {
    var scope = root || doc;
    if (!scope || !scope.querySelectorAll) return;
    Array.prototype.forEach.call(scope.querySelectorAll('.flashcard-embed'), function (el) {
      if (el.dataset.fcMounted === '1') return;
      el.dataset.fcMounted = '1';
      var decksAttr = el.getAttribute('data-decks');
      mount(el, {
        decks: decksAttr ? decksAttr.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : null,
        exam: el.getAttribute('data-exam') || null,
        deckId: el.getAttribute('data-deck') || 'all',
        shuffle: el.getAttribute('data-shuffle') !== 'false',
        hideGraduated: el.getAttribute('data-hide-graduated') === 'true'
      });
    });
  }

  global.AG = global.AG || {};
  global.AG.flashcard = {
    mount: mount,
    autoMount: autoMount,
    Deck: Deck,
    loadIndex: loadIndex,
    loadDeck: loadDeck,
    loadDecks: loadDecks,
    root: ROOT
  };

  if (doc) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { autoMount(); });
    else autoMount();
  }
})(typeof window !== 'undefined' ? window : globalThis);
