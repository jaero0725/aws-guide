/*!
 * home.js — 홈 진도 대시보드
 * localStorage 진도(progress.js) + data/toc.json + data/questions/manifest.json 만 읽습니다.
 * 네트워크 전송·외부 의존성 없음. 기록이 없으면 "시작 안내" 상태로 렌더합니다.
 */
(function (global) {
  'use strict';

  var doc = global.document;
  if (!doc) return;

  /* SAA-C03 도메인 가중치 — 공식 시험 가이드 확정값 (PLAN.md §0) */
  var SAA_WEIGHT = {
    'Design Secure Architectures': 30,
    'Design Resilient Architectures': 26,
    'Design High-Performing Architectures': 24,
    'Design Cost-Optimized Architectures': 20
  };
  var SAA_ORDER = Object.keys(SAA_WEIGHT);
  var DOMAIN_KO = {
    'Design Secure Architectures': '보안 아키텍처 설계',
    'Design Resilient Architectures': '복원력 있는 아키텍처 설계',
    'Design High-Performing Architectures': '고성능 아키텍처 설계',
    'Design Cost-Optimized Architectures': '비용 최적화 아키텍처 설계'
  };
  var DOMAIN_PAGE = {
    'Design Secure Architectures': 'saa/domain-secure.html',
    'Design Resilient Architectures': 'saa/domain-resilient.html',
    'Design High-Performing Architectures': 'saa/domain-performance.html',
    'Design Cost-Optimized Architectures': 'saa/domain-cost.html'
  };
  var SECTION_KO = {
    basics: '기본개념', labs: '실습 예제', cases: '아키텍처 케이스',
    cheatsheet: '빠른참조', saa: 'SAA 시험 대비', quiz: '문제풀이'
  };
  /* 학습 권장 순서 — 다음 페이지 추천이 이 순서를 따릅니다 */
  var SECTION_ORDER = ['basics', 'labs', 'cases', 'saa', 'cheatsheet'];

  var FLASHCARD_TOTAL = 232;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function band(p) { return p >= 80 ? 'high' : p >= 60 ? 'mid' : 'low'; }
  function ratio(n, d) { return d > 0 ? Math.round((n / d) * 100) : 0; }

  function fetchJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' → HTTP ' + r.status);
      return r.json();
    });
  }

  /* ---------- 집계 ------------------------------------------------------- */

  /** toc.json + 읽음 목록 → 섹션별 진도와 아직 읽지 않은 첫 페이지 */
  function readingProgress(toc, readSet) {
    var rows = [], total = 0, read = 0, firstUnread = null;
    var bySection = {};
    (toc.sections || []).forEach(function (s) { bySection[s.id] = s; });

    SECTION_ORDER.forEach(function (sid) {
      var s = bySection[sid];
      if (!s) return;
      var pages = (s.pages || []).filter(function (p) { return p.exists !== false; });
      if (!pages.length) return;
      var n = 0;
      pages.forEach(function (p) {
        if (readSet[sid + '/' + p.id]) n += 1;
        else if (!firstUnread) firstUnread = { path: p.path, title: p.title };
      });
      total += pages.length;
      read += n;
      rows.push({ title: SECTION_KO[sid] || s.title, total: pages.length, read: n });
    });
    return { sections: rows, total: total, read: read, firstUnread: firstUnread };
  }

  /**
   * 문항 id → SAA 도메인.
   * 도메인 연습 세트(mock·diagnostic 아님)의 setId 접두사로만 판정합니다.
   * 모의고사·진단 문항은 세트가 혼합 구성이라 여기서 null 이 되고,
   * 대신 시험 이력의 byDomain(문항별 도메인 집계)으로 더합니다.
   */
  function makeDomainResolver(manifest) {
    var prefixes = (manifest.sets || [])
      .filter(function (s) {
        return s.exam === 'SAA' && !s.mock && !s.diagnostic && SAA_WEIGHT[s.domain];
      })
      .map(function (s) { return { p: s.setId + '-', d: s.domain }; })
      .sort(function (a, b) { return b.p.length - a.p.length; });

    return function (id) {
      for (var i = 0; i < prefixes.length; i += 1) {
        if (id.indexOf(prefixes[i].p) === 0) return prefixes[i].d;
      }
      return null;
    };
  }

  /** 혼합 세트(모의고사·진단) 응시 기록인지 */
  function isMixedExam(e) {
    return /mock|diagnostic/.test(String(e.setId || '') + ' ' + String(e.mode || ''));
  }

  /**
   * 도메인별 {correct, attempts}.
   * 접두사로 판정되는 도메인 연습문제 + 혼합 세트 응시의 byDomain 을 합칩니다.
   * 혼합 세트 문항은 접두사 판정에서 제외되므로 이중 집계되지 않습니다.
   */
  function domainTotals(P, manifest, exams) {
    var acc = {};
    function bucket(d) {
      if (!acc[d]) acc[d] = { correct: 0, attempts: 0 };
      return acc[d];
    }
    var m = P.masteryByDomain(makeDomainResolver(manifest));
    Object.keys(m).forEach(function (d) {
      var b = bucket(d);
      b.correct += m[d].correct;
      b.attempts += m[d].attempts;
    });
    exams.filter(isMixedExam).forEach(function (e) {
      var bd = e.byDomain || {};
      Object.keys(bd).forEach(function (d) {
        if (!SAA_WEIGHT[d]) return;
        var b = bucket(d);
        b.correct += +bd[d].correct || 0;
        b.attempts += +bd[d].total || 0;
      });
    });
    Object.keys(acc).forEach(function (d) {
      acc[d].pct = ratio(acc[d].correct, acc[d].attempts);
    });
    return acc;
  }

  /* ---------- 렌더 조각 -------------------------------------------------- */

  function kpi(label, value, sub, href) {
    var inner =
      '<span class="kpi__label">' + esc(label) + '</span>' +
      '<b class="kpi__value">' + value + '</b>' +
      '<span class="kpi__sub">' + esc(sub) + '</span>';
    return '<li class="kpi">' + (href
      ? '<a class="kpi__body kpi__link" href="' + esc(href) + '">' + inner + '</a>'
      : '<span class="kpi__body">' + inner + '</span>') + '</li>';
  }

  function barChart(rows, label) {
    if (!rows.length) return '';
    var lis = rows.map(function (r) {
      var w = Math.max(0, Math.min(100, r.pct));
      var name = r.href
        ? '<a href="' + esc(r.href) + '">' + esc(r.name) + '</a>'
        : esc(r.name);
      return '<li>' +
        '<span class="bar-chart__label"><span class="bar-chart__name">' + name + '</span>' +
        '<span class="bar-chart__val">' + esc(r.valueText) + '</span></span>' +
        '<span class="bar-chart__track">' +
        '<span class="bar-chart__fill" data-band="' + band(r.pct) + '" style="width:' + w + '%"></span>' +
        '</span>' +
        (r.meta ? '<span class="bar-chart__meta">' + esc(r.meta) + '</span>' : '') +
        '</li>';
    }).join('');
    return '<ul class="bar-chart" role="list" aria-label="' + esc(label) + '">' + lis + '</ul>';
  }

  /* ---------- 렌더 ------------------------------------------------------- */

  function render(mount, toc, manifest, P) {
    var readSet = {};
    P.readList().forEach(function (id) { readSet[id] = true; });

    var rp = readingProgress(toc, readSet);

    var stats = P.quizStats();
    var attemptedIds = Object.keys(stats);
    var attempts = 0, correct = 0;
    attemptedIds.forEach(function (id) {
      attempts += +stats[id].attempts || 0;
      correct += +stats[id].correct || 0;
    });
    var qTotal = +manifest.totalQuestions || 0;
    var wrong = P.wrongQuestionIds().length;

    var exams = P.exams().filter(function (e) {
      return e && typeof e.score === 'number' && +e.total > 0;
    }).map(function (e) {
      var c = { };
      for (var k in e) if (Object.prototype.hasOwnProperty.call(e, k)) c[k] = e[k];
      c.pct = ratio(e.score, e.total);
      return c;
    });
    var mocks = exams.filter(isMixedExam);
    var bestMock = mocks.reduce(function (a, e) { return (!a || e.pct > a.pct) ? e : a; }, null);

    var totals = domainTotals(P, manifest, exams);

    var cards = P.cardStats();
    var graduated = Object.keys(cards).filter(function (k) {
      return cards[k] && cards[k].graduated;
    }).length;

    var diag = P.diagnostic();
    var diagTaken = !!(diag && diag.at);

    var fresh = !rp.read && !attemptedIds.length && !diagTaken;
    var html = '<h2 id="dashboard">내 진도</h2>';

    /* --- KPI --- */
    /* 기록이 없어도 KPI 격자는 항상 그립니다. index.html 의 골격과 같은 구조라
       교체 시점에 레이아웃이 움직이지 않고, 0/61 · 0/852 자체가 정보가 됩니다. */
    html += '<ul class="kpi-grid" role="list">' +
      kpi('읽은 페이지', rp.read + '<small>/' + rp.total + '</small>',
        ratio(rp.read, rp.total) + '% 완료') +
      kpi('푼 문항', attemptedIds.length + '<small>/' + qTotal + '</small>',
        '누적 ' + attempts + '회 시도', 'quiz/index.html') +
      kpi('정답률', ratio(correct, attempts) + '<small>%</small>',
        correct + ' / ' + attempts + '회 정답') +
      kpi('오답 노트', wrong + '<small>문항</small>',
        wrong ? '복습 대기 중' : '비어 있음', 'quiz/review.html') +
      kpi('모의고사 최고', bestMock ? bestMock.pct + '<small>%</small>' : '<small>미응시</small>',
        mocks.length ? mocks.length + '회 응시' : '4세트 · 각 60문항', 'quiz/index.html') +
      kpi('플래시카드 졸업', graduated + '<small>/' + FLASHCARD_TOTAL + '</small>',
        ratio(graduated, FLASHCARD_TOTAL) + '% 암기', 'saa/flashcards.html') +
      '</ul>';

    /* --- 첫 방문: 여기서 끝냅니다 (아직 그릴 통계가 없습니다) --- */
    if (fresh) {
      html += '<aside class="note note--info" data-label="아직 기록이 없습니다">' +
        '<p>진단 테스트를 먼저 풀면 SAA 4개 도메인 중 약한 곳이 드러나고, ' +
        '이 자리에 도메인별 정답률 · 다음에 할 일 · 응시 이력이 채워집니다. ' +
        '기록은 이 브라우저의 <code>localStorage</code>에만 남고 서버로 전송되지 않습니다.</p>' +
        '<p><a class="btn btn--primary" href="quiz/diagnostic.html">진단 테스트 30문항 시작</a></p>' +
        '</aside>';
      mount.innerHTML = html;
      mount.removeAttribute('aria-busy');
      return;
    }

    /* --- SAA 도메인 숙련도 --- */
    var domainRows = SAA_ORDER.map(function (d) {
      var t = totals[d];
      return {
        domain: d,
        weight: SAA_WEIGHT[d],
        name: DOMAIN_KO[d] + ' · 출제 ' + SAA_WEIGHT[d] + '%',
        href: DOMAIN_PAGE[d],
        pct: t ? t.pct : 0,
        attempts: t ? t.attempts : 0,
        valueText: t && t.attempts ? t.pct + '%' : '—',
        meta: t && t.attempts
          ? t.correct + '/' + t.attempts + '회 정답'
          : '아직 풀지 않았습니다'
      };
    });

    html += '<h3>SAA 도메인 숙련도</h3>' +
      '<p class="dash__note">이름 옆 숫자는 실제 시험 출제 비중입니다. ' +
      '<strong>비중이 큰 도메인의 낮은 점수부터</strong> 메꾸는 것이 점수 대비 효율이 가장 좋습니다. ' +
      '도메인 연습문제와 <strong>시험 모드로 응시한</strong> 모의고사·진단 결과를 함께 집계합니다. 학습 모드로 푼 모의고사 문항은 위 KPI 에는 잡히지만 도메인별로는 나뉘지 않습니다.</p>' +
      barChart(domainRows, 'SAA 도메인별 정답률');

    /* --- 다음에 할 일 --- */
    /* 손실 = 출제 비중 × 부족분. 아직 안 푼 도메인은 추천 대상에서 제외합니다. */
    var weak = domainRows.filter(function (r) { return r.attempts >= 5 && r.pct < 80; })
      .sort(function (a, b) {
        return ((100 - b.pct) * b.weight) - ((100 - a.pct) * a.weight);
      })[0];
    var untouched = domainRows.filter(function (r) { return !r.attempts; })
      .sort(function (a, b) { return b.weight - a.weight; })[0];

    var todo = [];
    if (!diagTaken) {
      todo.push('<li><a href="quiz/diagnostic.html">진단 테스트 30문항</a> — ' +
        '아직 응시하지 않았습니다. 도메인 우선순위가 여기서 정해집니다.</li>');
    }
    if (weak) {
      todo.push('<li><a href="' + esc(weak.href) + '">' + esc(DOMAIN_KO[weak.domain]) +
        '</a> 정답률 ' + weak.pct + '% · 출제 비중 ' + weak.weight + '% — ' +
        '지금 점수를 가장 많이 깎고 있는 구간입니다.</li>');
    }
    if (untouched) {
      todo.push('<li><a href="' + esc(untouched.href) + '">' + esc(DOMAIN_KO[untouched.domain]) +
        '</a> — 아직 한 문항도 풀지 않았습니다 (출제 비중 ' + untouched.weight + '%).</li>');
    }
    if (wrong > 0) {
      todo.push('<li><a href="quiz/review.html">오답 노트 ' + wrong + '문항</a> — ' +
        '연속으로 맞히면 자동으로 빠집니다.</li>');
    }
    if (rp.firstUnread) {
      todo.push('<li><a href="' + esc(rp.firstUnread.path) + '">' + esc(rp.firstUnread.title) +
        '</a> — 아직 읽지 않은 첫 페이지입니다.</li>');
    }
    if (!mocks.length) {
      todo.push('<li><a href="quiz/index.html">모의고사 1세트(60문항)</a> — ' +
        '도메인 연습을 한 바퀴 돌린 뒤 실전 비중으로 점검하세요.</li>');
    }
    if (todo.length) {
      html += '<h3>다음에 할 일</h3><ol class="plan">' + todo.slice(0, 4).join('') + '</ol>';
    }

    /* --- 섹션 진도 --- */
    html += '<h3>섹션 진도</h3>' +
      barChart(rp.sections.map(function (s) {
        return { name: s.title, pct: ratio(s.read, s.total), valueText: s.read + '/' + s.total };
      }), '섹션별 읽은 페이지');

    /* --- 응시 이력 --- */
    if (exams.length) {
      var rows = exams.slice(-6).reverse().map(function (e) {
        var when = '—';
        if (e.at) { try { when = new Date(e.at).toLocaleString('ko-KR'); } catch (x) {} }
        var name = e.mode === 'diagnostic' ? '진단 테스트' : (e.setId || e.examId || '모의고사');
        return '<tr><th scope="row">' + esc(name) + '</th>' +
          '<td>' + e.pct + '%</td>' +
          '<td>' + e.score + '/' + e.total + '</td>' +
          '<td>' + esc(when) + '</td></tr>';
      }).join('');
      html += '<h3>응시 이력</h3>' +
        '<div class="table-scroll"><table><caption>최근 ' + Math.min(6, exams.length) +
        '회 (전체 ' + exams.length + '회)</caption>' +
        '<thead><tr><th scope="col">세트</th><th scope="col">점수</th>' +
        '<th scope="col">정답</th><th scope="col">응시 시각</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>' +
        '<p class="dash__note">합격선 720점은 100–1000 스케일 점수이므로 정답률과 1:1로 대응하지 않습니다. ' +
        '여기 점수는 이 사이트 자체 기준의 참고값입니다.</p>';
    }

    mount.innerHTML = html;
    mount.removeAttribute('aria-busy');
  }

  /* ---------- 부팅 ------------------------------------------------------- */

  function boot() {
    var mount = doc.getElementById('home-dashboard');
    if (!mount) return;
    var P = global.AG && global.AG.progress;

    /* progress.js 의 available 은 boolean 입니다 (함수가 아님) */
    if (!P || P.available === false) {
      mount.innerHTML =
        '<h2 id="dashboard">내 진도</h2>' +
        '<aside class="note note--warn" data-label="진도를 저장할 수 없습니다">' +
        '<p>이 브라우저에서 <code>localStorage</code>를 쓸 수 없어(사생활 보호 모드 등) ' +
        '읽음 기록과 퀴즈 통계를 남기지 못합니다. 학습 자료와 문제 풀이 자체는 정상 동작합니다.</p>' +
        '</aside>';
      mount.removeAttribute('aria-busy');
      return;
    }

    Promise.all([
      fetchJSON('data/toc.json'),
      fetchJSON('data/questions/manifest.json')
    ]).then(function (r) {
      var draw = function () { render(mount, r[0], r[1], P); };
      draw();
      /* 진도 초기화 등으로 값이 바뀌면 다시 그립니다 */
      P.subscribe(draw);
    }).catch(function (err) {
      mount.innerHTML =
        '<h2 id="dashboard">내 진도</h2>' +
        '<aside class="note note--warn" data-label="대시보드를 불러오지 못했습니다">' +
        '<p><code>data/toc.json</code> 또는 <code>data/questions/manifest.json</code>을 읽지 못했습니다. ' +
        '<code>file://</code>로 직접 열면 브라우저가 로컬 fetch를 막습니다 — ' +
        '<code>npm run serve</code> 로 띄운 뒤 <code>http://localhost:8000</code>에서 열어 주세요.</p>' +
        '<p><small>' + esc(err && err.message) + '</small></p>' +
        '</aside>';
      mount.removeAttribute('aria-busy');
    });
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
