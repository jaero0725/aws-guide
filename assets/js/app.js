/* ==========================================================================
   AWS SAA Guide — 사이트 셸 (app.js)
   --------------------------------------------------------------------------
   담당
     1. 상단바 주입 (브랜드 · 햄버거 · 검색 · 테마 · 글자크기)
     2. data/toc.json → 사이드바 렌더링 (실패 시 하드코딩 폴백 TOC)
     3. 본문 h2/h3 스캔 → 우측 "On this page" + 스크롤 스파이 + 제목 앵커
     4. 다크모드 · 글자크기 토글 (ag:settings)
     5. data/search-index.json 기반 클라이언트 전문 검색 ( / 키로 열기 )
     6. 이전/다음 pager 자동 생성
     7. 코드블록 복사 버튼 주입
     8. 다이어그램 플레이스홀더 → SVG fetch 주입 → AG.viz.mount
     9. 읽음 처리 (80% 스크롤 → ag:progress:read)

   file:// 로 열어도 죽지 않아야 합니다. 모든 fetch 는 실패를 흡수합니다.
   ========================================================================== */
(function (global) {
  'use strict';

  var doc = global.document;
  if (!doc) return;

  /* ======================================================================
     사이트 루트
     ====================================================================== */
  var ROOT = (function () {
    if (global.AG && global.AG.__root) return global.AG.__root;
    var src = doc.currentScript && doc.currentScript.src;
    if (!src) {
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
  function pr() { return (global.AG && global.AG.progress) || null; }
  function fetchJSON(p) {
    if (!global.fetch) return Promise.reject(new Error('fetch 미지원'));
    return global.fetch(p, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  function fetchText(p) {
    if (!global.fetch) return Promise.reject(new Error('fetch 미지원'));
    return global.fetch(p, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    });
  }

  /* ======================================================================
     폴백 TOC
     ---------------------------------------------------------------------
     data/toc.json 을 못 읽는 상황(file:// 로 열기 등)에서도 사이드바가
     보여야 합니다. 아래는 PLAN.md §1 구조를 압축 표기한 것입니다.
     형식: [섹션id, 섹션제목, [[페이지id, 제목, 번호레이블|null], …]]
     ====================================================================== */
  var FALLBACK_TOC = [
    ['home', '홈', [['index', 'AWS SAA Guide 홈', null]]],
    ['basics', '기본개념', [
      ['ch01', 'AWS 글로벌 인프라와 계정 기초', '1'],
      ['ch02', 'IAM과 자격 증명', '2'],
      ['ch03', 'VPC 네트워킹 기초', '3'],
      ['ch04', 'VPC 연결과 하이브리드', '4'],
      ['ch05', 'EC2와 컴퓨트', '5'],
      ['ch06', 'EBS와 블록 스토리지', '6'],
      ['ch07', '로드 밸런싱과 오토스케일링', '7'],
      ['ch08', 'S3와 오브젝트 스토리지', '8'],
      ['ch09', '파일 스토리지와 데이터 전송', '9'],
      ['ch10', 'RDS와 관계형 데이터베이스', '10'],
      ['ch11', 'NoSQL · 캐시 · 분석 DB', '11'],
      ['ch12', '서버리스와 애플리케이션 통합', '12'],
      ['ch13', '컨테이너', '13'],
      ['ch14', '엣지와 DNS', '14'],
      ['ch15', '데이터 분석 파이프라인', '15'],
      ['ch16', '보안 · 암호화 · 거버넌스', '16'],
      ['ch17', '모니터링 · 운영 · 계정 관리', '17'],
      ['ch18', '비용 최적화 · 마이그레이션 · DR', '18']
    ]],
    ['quiz', '문제 풀이', [
      ['index', '문제 풀이 허브', null],
      ['diagnostic', '진단 테스트 (40문항)', null],
      ['review', '오답 노트', null],
      ['result', '결과 리포트', null]
    ]],
    ['saa', 'SAA 시험 대비', [
      ['index', '시험 개요 · 8주 학습 플랜', null],
      ['domain-secure', '보안 아키텍처 설계 (30%)', null],
      ['domain-resilient', '복원력 있는 아키텍처 설계 (26%)', null],
      ['domain-performance', '고성능 아키텍처 설계 (24%)', null],
      ['domain-cost', '비용 최적화 아키텍처 설계 (20%)', null],
      ['keywords', '한정어 키워드 사전', null],
      ['traps', '함정 사전', null],
      ['flashcards', '플래시카드', null],
      ['cram', '벼락치기 요약', null],
      ['exam-tips', '시험 당일 전략', null]
    ]],
    ['labs', '실습 예제', [
      ['lab01', '3계층 VPC 직접 구성', '1'],
      ['lab02', 'ALB + ASG 웹 티어', '2'],
      ['lab03', 'S3 정적 사이트 + CloudFront', '3'],
      ['lab04', 'RDS Multi-AZ와 읽기 복제본', '4'],
      ['lab05', 'DynamoDB 테이블 설계', '5'],
      ['lab06', 'Lambda + API Gateway', '6'],
      ['lab07', 'SQS + Lambda 비동기 처리', '7'],
      ['lab08', 'EventBridge 이벤트 아키텍처', '8'],
      ['lab09', 'ECS Fargate 서비스 배포', '9'],
      ['lab10', 'VPC 엔드포인트로 S3 접근', '10'],
      ['lab11', 'KMS 고객 관리형 키 암호화', '11'],
      ['lab12', 'CloudWatch 알람 + SNS', '12']
    ]],
    ['cases', '아키텍처 케이스', [
      ['case01', 'EC2에 액세스 키를 심었다', '1'],
      ['case02', '읽기 부하로 DB가 죽었다', '2'],
      ['case03', 'S3 비용이 매달 늘어난다', '3'],
      ['case04', '퍼블릭 서브넷에 DB를 뒀다', '4'],
      ['case05', '단일 AZ 설계가 무너졌다', '5'],
      ['case06', '데이터 전송 요금 초과', '6'],
      ['case07', '스케일아웃이 못 따라갔다', '7'],
      ['case08', '리전 장애 DR 설계', '8'],
      ['case09', '온프레미스 파일 서버 이전', '9'],
      ['case10', '규정 준수 감사 대응', '10']
    ]],
    ['cheatsheet', '빠른참조', [
      ['services', '서비스 한 줄 정의', null],
      ['compare', '헷갈리는 쌍 비교', null],
      ['limits', '한도 · 기본값', null],
      ['decision-tree', '서비스 선택 결정 트리', null],
      ['security', '보안 · 암호화', null],
      ['network', '네트워크 연결', null],
      ['cost', '요금 · 비용 절감', null]
    ]]
  ];

  function fallbackToc() {
    return {
      __fallback: true,
      sections: FALLBACK_TOC.map(function (s) {
        return {
          id: s[0], title: s[1],
          pages: s[2].map(function (p) {
            return {
              id: p[0],
              title: p[1],
              num: p[2],
              path: (s[0] === 'home' ? 'index.html' : s[0] + '/' + p[0] + '.html'),
              exists: null   // 알 수 없음 → 링크는 살려 둡니다
            };
          })
        };
      })
    };
  }

  /* ======================================================================
     상단바
     ====================================================================== */
  var SVG = {
    menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
    sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/></svg>',
    moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z"/></svg>',
    auto: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17" /><path d="M12 3.5a8.5 8.5 0 010 17z" fill="currentColor" stroke="none"/></svg>',
    text: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M9 7v11M15 11h5M17.5 11v7"/></svg>'
  };

  function buildTopbar() {
    if (doc.querySelector('.topbar')) return doc.querySelector('.topbar');
    var bar = doc.createElement('header');
    bar.className = 'topbar';
    bar.innerHTML =
      '<button type="button" class="icon-btn topbar__menu" data-act="drawer" aria-expanded="false" ' +
        'aria-controls="sidebar-mount" aria-label="목차 열기">' + SVG.menu + '</button>' +
      '<a class="topbar__brand" href="' + url('index.html') + '">' +
        '<span class="topbar__brand-mark" aria-hidden="true">A</span>' +
        '<span>AWS SAA Guide</span></a>' +
      '<span class="topbar__ver" title="이 사이트가 대비하는 시험">SAA-C03</span>' +
      '<span class="topbar__spacer"></span>' +
      '<button type="button" class="search-trigger" data-act="search" hidden>' +
        SVG.search + '<span class="search-trigger__label">검색</span><kbd>/</kbd></button>' +
      '<div class="topbar__actions">' +
        '<button type="button" class="icon-btn" data-act="fontsize" aria-label="글자 크기 변경">' + SVG.text + '</button>' +
        '<button type="button" class="icon-btn" data-act="theme" aria-label="테마 변경">' + SVG.auto + '</button>' +
      '</div>';
    /* skip-link 뒤에 넣습니다. body.firstChild 앞에 넣으면 '본문 바로가기' 가
       자기가 건너뛰라고 만든 네비게이션 뒤로 밀립니다 (WCAG 2.4.1). */
    var skip = doc.querySelector('.skip-link');
    doc.body.insertBefore(bar, skip ? skip.nextSibling : doc.body.firstChild);
    return bar;
  }

  /* ======================================================================
     테마 · 글자 크기
     ====================================================================== */
  var THEMES = ['auto', 'light', 'dark'];
  var THEME_LABEL = { auto: '시스템 설정', light: '라이트', dark: '다크' };
  var SIZES = ['sm', 'md', 'lg'];
  var SIZE_LABEL = { sm: '작게', md: '보통', lg: '크게' };

  function applyTheme(theme) {
    var root = doc.documentElement;
    if (theme === 'auto') root.setAttribute('data-theme', 'auto');
    else root.setAttribute('data-theme', theme);
    var btn = doc.querySelector('[data-act="theme"]');
    if (btn) {
      btn.innerHTML = theme === 'dark' ? SVG.moon : (theme === 'light' ? SVG.sun : SVG.auto);
      btn.setAttribute('aria-label', '테마: ' + THEME_LABEL[theme] + ' (클릭하면 변경)');
      btn.title = '테마: ' + THEME_LABEL[theme];
    }
  }
  function applyFontSize(size) {
    doc.documentElement.setAttribute('data-font-size', size);
    var btn = doc.querySelector('[data-act="fontsize"]');
    if (btn) {
      btn.setAttribute('aria-label', '글자 크기: ' + SIZE_LABEL[size] + ' (클릭하면 변경)');
      btn.title = '글자 크기: ' + SIZE_LABEL[size];
    }
  }
  function initSettings() {
    var p = pr();
    var s = p ? p.settings() : { theme: 'auto', fontSize: 'md' };
    applyTheme(s.theme);
    applyFontSize(s.fontSize);
  }
  function cycleTheme() {
    var p = pr();
    var cur = p ? p.settings().theme : 'auto';
    var next = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length];
    if (p) p.setSetting('theme', next);
    applyTheme(next);
  }
  function cycleFontSize() {
    var p = pr();
    var cur = p ? p.settings().fontSize : 'md';
    var next = SIZES[(SIZES.indexOf(cur) + 1) % SIZES.length];
    if (p) p.setSetting('fontSize', next);
    applyFontSize(next);
  }

  /* ======================================================================
     사이드바
     ====================================================================== */
  var state = { toc: null, main: null, pageId: null, section: null, page: null, flat: [] };

  function renderSidebar(toc) {
    var mount = doc.getElementById('sidebar-mount');
    if (!mount) return;
    var p = pr();
    var readSet = Object.create(null);
    if (p) p.readList().forEach(function (id) { readSet[id] = 1; });

    var html = '<nav class="sidebar" aria-label="사이트 목차">';
    state.flat = [];

    (toc.sections || []).forEach(function (sec) {
      html += '<div class="sidebar__group">';
      html += '<span class="sidebar__title">' + esc(sec.title || sec.id) + '</span>';
      html += '<ul class="sidebar__list">';
      (sec.pages || []).forEach(function (pg) {
        var path = pg.path || (sec.id + '/' + pg.id + '.html');
        var pid = path.replace(/\.html$/, '');
        var isCurrent = (state.section === sec.id && state.page === pg.id) ||
                        (state.pageId && state.pageId === pid);
        var missing = pg.exists === false;
        state.flat.push({ path: path, title: pg.title, num: pg.num, section: sec.title, id: pid, exists: pg.exists });
        if (missing) {
          html += '<li><span class="sidebar__link sidebar__link--todo" title="아직 작성되지 않은 페이지입니다">' +
            (pg.num ? '<span class="sidebar__num">' + esc(pg.num) + '</span>' : '') +
            '<span>' + esc(pg.title) + '</span></span></li>';
        } else {
          html += '<li><a class="sidebar__link" href="' + esc(url(path)) + '"' +
            (isCurrent ? ' aria-current="page"' : '') + '>' +
            (pg.num ? '<span class="sidebar__num">' + esc(pg.num) + '</span>' : '') +
            '<span>' + esc(pg.title) + '</span>' +
            (readSet[pid] ? '<span class="sidebar__read" title="읽음" aria-label="읽음">✓</span>' : '') +
            '</a></li>';
        }
      });
      html += '</ul></div>';
    });

    if (toc.__fallback) {
      html += '<p class="sidebar__note">목차 데이터(<code>data/toc.json</code>)를 읽지 못해 ' +
        '기본 목차를 표시했습니다. 일부 페이지는 아직 없을 수 있습니다.</p>';
    }
    html += '</nav>';

    var overlay = '<button type="button" class="drawer-overlay" data-act="drawer-close" aria-label="목차 닫기" tabindex="-1"></button>';
    mount.innerHTML = html;
    if (!doc.querySelector('.drawer-overlay')) {
      doc.body.insertAdjacentHTML('beforeend', overlay);
    }
    doc.body.classList.add('has-sidebar');
  }

  function toggleDrawer(open) {
    var isOpen = doc.body.classList.contains('drawer-open');
    var next = (open == null) ? !isOpen : !!open;
    doc.body.classList.toggle('drawer-open', next);
    var btn = doc.querySelector('[data-act="drawer"]');
    if (btn) {
      btn.setAttribute('aria-expanded', String(next));
      btn.setAttribute('aria-label', next ? '목차 닫기' : '목차 열기');
    }
    if (next) {
      var first = doc.querySelector('.sidebar__link');
      if (first) first.focus();
    } else if (btn) btn.focus();
  }

  /* ======================================================================
     우측 목차 (On this page) + 스크롤 스파이 + 제목 앵커
     ====================================================================== */
  function slugify(text) {
    return String(text).toLowerCase()
      .replace(/[`'"“”‘’()[\]{}.,:;!?]/g, '')
      .replace(/[^a-z0-9가-힣\s-]/g, '')
      .trim().replace(/\s+/g, '-').slice(0, 60) || 'section';
  }

  function buildPageToc(main) {
    var heads = main.querySelectorAll('h2[id], h3[id], h2, h3');
    var list = [];
    var used = Object.create(null);
    Array.prototype.forEach.call(heads, function (h) {
      // 퀴즈 등 동적 삽입 영역의 제목은 목차에 넣지 않습니다.
      if (h.closest('.quiz, .quiz-embed, .flashcard-embed, .search-panel')) return;
      if (!h.id) {
        var base = slugify(h.textContent);
        var id = base, n = 2;
        while (doc.getElementById(id) || used[id]) { id = base + '-' + n++; }
        h.id = id;
      }
      used[h.id] = 1;
      list.push({ id: h.id, text: h.textContent.replace(/\s*#\s*$/, '').trim(), level: h.tagName === 'H2' ? 2 : 3, el: h });

      // 제목 앵커 링크
      if (!h.querySelector('.heading-anchor')) {
        var a = doc.createElement('a');
        a.className = 'heading-anchor';
        a.href = '#' + h.id;
        a.setAttribute('aria-label', h.textContent.trim() + ' 링크');
        a.textContent = '#';
        h.appendChild(a);
      }
    });

    /* has-toc 는 HTML 에 정적으로 박혀 있습니다(레이아웃 이동 방지).
       목차를 만들 수 없는 페이지에서는 여기서 걷어냅니다. */
    if (list.length < 2) { doc.body.classList.remove('has-toc'); return null; }

    var aside = doc.createElement('aside');
    aside.className = 'page-toc';
    aside.setAttribute('aria-label', '이 페이지의 목차');
    var html = '<p class="page-toc__title">On this page</p><ul>';
    list.forEach(function (it) {
      html += '<li data-level="' + it.level + '"><a href="#' + esc(it.id) + '">' + esc(it.text) + '</a></li>';
    });
    html += '</ul>';
    aside.innerHTML = html;
    (main.parentNode || doc.body).insertBefore(aside, main.nextSibling);
    doc.body.classList.add('has-toc');

    /* 스크롤 스파이 */
    var links = aside.querySelectorAll('a');
    var byId = Object.create(null);
    Array.prototype.forEach.call(links, function (a) {
      byId[a.getAttribute('href').slice(1)] = a;
    });
    if (global.IntersectionObserver) {
      var visible = Object.create(null);
      var io = new global.IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) visible[e.target.id] = e.boundingClientRect.top;
          else delete visible[e.target.id];
        });
        var best = null, bestTop = Infinity;
        for (var id in visible) {
          if (visible[id] < bestTop) { bestTop = visible[id]; best = id; }
        }
        if (!best) {
          // 화면에 제목이 없으면 마지막으로 지나친 것을 활성화
          for (var i = list.length - 1; i >= 0; i--) {
            if (list[i].el.getBoundingClientRect().top < 120) { best = list[i].id; break; }
          }
        }
        Array.prototype.forEach.call(links, function (a) { a.classList.remove('is-active'); });
        if (best && byId[best]) byId[best].classList.add('is-active');
      }, { rootMargin: '-80px 0px -60% 0px', threshold: [0, 1] });
      list.forEach(function (it) { io.observe(it.el); });
    }
    return aside;
  }

  /* ======================================================================
     이전 / 다음 pager
     ====================================================================== */
  function buildPager(main) {
    if (!state.flat.length || !state.pageId) return;
    var idx = -1;
    for (var i = 0; i < state.flat.length; i++) {
      if (state.flat[i].id === state.pageId) { idx = i; break; }
    }
    if (idx < 0) return;

    var existing = main.querySelector('.pager');
    if (existing && existing.querySelector('a')) return; // 저자가 직접 작성한 경우 존중

    function findNeighbour(dir) {
      for (var j = idx + dir; j >= 0 && j < state.flat.length; j += dir) {
        var e = state.flat[j];
        if (e.exists === false) continue;
        if (/^quiz\//.test(e.id) !== /^quiz\//.test(state.pageId) && /^quiz\//.test(e.id)) continue;
        return e;
      }
      return null;
    }
    var prev = findNeighbour(-1), next = findNeighbour(1);
    if (!prev && !next) return;

    var nav = existing || doc.createElement('nav');
    nav.className = 'pager';
    nav.setAttribute('aria-label', '이전/다음');
    var html = '';
    if (prev) {
      html += '<a href="' + esc(url(prev.path)) + '" rel="prev"><span class="pager__dir">← 이전</span>' +
        '<span class="pager__title">' + esc(prev.title) + '</span></a>';
    } else html += '<span></span>';
    if (next) {
      html += '<a class="pager__next" href="' + esc(url(next.path)) + '" rel="next"><span class="pager__dir">다음 →</span>' +
        '<span class="pager__title">' + esc(next.title) + '</span></a>';
    }
    nav.innerHTML = html;
    if (!existing) main.appendChild(nav);
  }

  /* ======================================================================
     코드 복사 버튼
     ====================================================================== */
  function addCopyButtons(root) {
    var figs = (root || doc).querySelectorAll('figure.code');
    Array.prototype.forEach.call(figs, function (fig) {
      if (fig.dataset.copyReady === '1') return;
      fig.dataset.copyReady = '1';
      var code = fig.querySelector('pre code') || fig.querySelector('pre');
      if (!code) return;
      var cap = fig.querySelector('figcaption');
      if (!cap) {
        cap = doc.createElement('figcaption');
        cap.innerHTML = '<span class="code__name">' + esc(codeLangOf(code) || 'code') + '</span>';
        fig.insertBefore(cap, fig.firstChild);
      } else if (!cap.querySelector('.code__name')) {
        var wrapSpan = doc.createElement('span');
        wrapSpan.className = 'code__name';
        while (cap.firstChild) wrapSpan.appendChild(cap.firstChild);
        cap.appendChild(wrapSpan);
      }
      var btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'code__copy';
      btn.textContent = '복사';
      btn.setAttribute('aria-label', '코드 복사');
      btn.addEventListener('click', function () {
        var text = code.textContent;
        var done = function () {
          btn.textContent = '복사됨';
          btn.dataset.state = 'done';
          global.setTimeout(function () { btn.textContent = '복사'; delete btn.dataset.state; }, 1600);
        };
        if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
          global.navigator.clipboard.writeText(text).then(done, fallbackCopy);
        } else fallbackCopy();
        function fallbackCopy() {
          try {
            var ta = doc.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', '');
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            doc.body.appendChild(ta);
            ta.select();
            doc.execCommand('copy');
            doc.body.removeChild(ta);
            done();
          } catch (e) {
            btn.textContent = '복사 실패';
            global.setTimeout(function () { btn.textContent = '복사'; }, 1600);
          }
        }
      });
      cap.appendChild(btn);
    });
  }
  function codeLangOf(el) {
    var m = /(?:^|\s)lang(?:uage)?-([\w+-]+)/.exec(el.className || '');
    return m ? m[1] : null;
  }

  /* ======================================================================
     다이어그램 플레이스홀더 주입
     ---------------------------------------------------------------------
     정적 인라인(tools/inline-diagrams.mjs)이 이미 되어 있으면 건너뜁니다.
     개발 중에는 여기서 fetch 해서 채웁니다.
     ID → 파일명 매핑: assets/diagrams/index.json
       { "generatedAt": "...", "diagrams": { "D-012": "D-012-offset-anatomy.svg" } }
     매핑이 없으면 널리 쓰이는 슬러그 후보 대신 "ID로 시작하는 파일" 을 찾지 못하므로
     디렉터리 추정 규칙(D-012.svg → 실패 시 안내)만 적용합니다.
     ====================================================================== */
  var diagramIndexPromise = null;
  function diagramIndex() {
    if (diagramIndexPromise) return diagramIndexPromise;
    diagramIndexPromise = fetchJSON(url('assets/diagrams/index.json')).then(function (j) {
      if (j && j.diagrams && typeof j.diagrams === 'object') return j.diagrams;
      if (j && typeof j === 'object') return j;   // 평평한 맵도 허용
      return {};
    }).catch(function () { return null; });
    return diagramIndexPromise;
  }

  function injectDiagrams(root) {
    var figs = (root || doc).querySelectorAll('figure.diagram[data-diagram]');
    if (!figs.length) return Promise.resolve(0);

    var pending = Array.prototype.filter.call(figs, function (f) {
      return !f.querySelector('svg') && f.dataset.dgTried !== '1';
    });
    // 이미 정적 인라인된 것은 바로 마운트
    Array.prototype.forEach.call(figs, function (f) {
      if (f.querySelector('svg') && global.AG && global.AG.viz) global.AG.viz.mount(f);
    });
    if (!pending.length) return Promise.resolve(0);

    return diagramIndex().then(function (map) {
      return Promise.all(pending.map(function (fig) {
        fig.dataset.dgTried = '1';
        var id = (fig.getAttribute('data-diagram') || '').toUpperCase();
        var file = map && map[id];
        var candidates = [];
        if (file) {
          candidates.push(file);
        } else if (!map) {
          // 매핑 파일이 아예 없을 때만 파일명을 추정합니다.
          // 매핑이 있는데 항목이 없다면 "아직 만들어지지 않은 다이어그램" 이므로
          // 불필요한 404 를 만들지 않고 바로 안내를 띄웁니다.
          candidates.push(id + '.svg');
        }
        if (!candidates.length) { showMissing(fig, id, false); return null; }
        return tryFiles(candidates, 0);

        function tryFiles(list, i) {
          if (i >= list.length) { showMissing(fig, id, !map); return null; }
          return fetchText(url('assets/diagrams/' + list[i]))
            .then(function (svgText) { placeSvg(fig, svgText, id); return id; })
            .catch(function () { return tryFiles(list, i + 1); });
        }
      })).then(function (r) { return r.filter(Boolean).length; });
    });
  }

  function placeSvg(fig, svgText, id) {
    // <?xml …?> / <!DOCTYPE …> 제거 후 <svg> 부터만 사용
    var start = svgText.indexOf('<svg');
    if (start < 0) return;
    var frag = doc.createElement('div');
    frag.innerHTML = svgText.slice(start);
    var svg = frag.querySelector('svg');
    if (!svg) return;
    svg.classList.add('ag-diagram');
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    namespaceIds(svg, id);

    var wrap = doc.createElement('div');
    wrap.className = 'dg-scroll';
    wrap.appendChild(svg);

    var cap = fig.querySelector(':scope > figcaption');
    if (cap) fig.insertBefore(wrap, cap);
    else fig.insertBefore(wrap, fig.firstChild);

    var miss = fig.querySelector('.diagram__missing');
    if (miss) miss.remove();

    if (global.AG && global.AG.viz) global.AG.viz.mount(fig);
  }

  /** 같은 페이지에 여러 SVG가 들어와도 id가 충돌하지 않게 접두어를 붙입니다. */
  var nsCounter = Object.create(null);
  function namespaceIds(svg, id) {
    nsCounter[id] = (nsCounter[id] || 0) + 1;
    var prefix = id.toLowerCase().replace(/[^a-z0-9-]/g, '') + '-' + nsCounter[id] + '-';
    var withId = svg.querySelectorAll('[id]');
    if (!withId.length) return;
    var map = Object.create(null);
    Array.prototype.forEach.call(withId, function (n) {
      var old = n.getAttribute('id');
      var neu = prefix + old;
      map[old] = neu;
      n.setAttribute('id', neu);
    });
    // 참조 갱신: href/xlink:href, aria-labelledby, url(#…) 속성
    var all = svg.querySelectorAll('*');
    var nodes = [svg].concat(Array.prototype.slice.call(all));
    nodes.forEach(function (n) {
      Array.prototype.forEach.call(n.attributes || [], function (attr) {
        var v = attr.value;
        if (!v) return;
        if (/^#/.test(v) && map[v.slice(1)]) { attr.value = '#' + map[v.slice(1)]; return; }
        if (/url\(#/.test(v)) {
          attr.value = v.replace(/url\(#([^)]+)\)/g, function (m, g) {
            return map[g] ? 'url(#' + map[g] + ')' : m;
          });
          return;
        }
        if (attr.name === 'aria-labelledby' || attr.name === 'aria-describedby') {
          attr.value = v.split(/\s+/).map(function (t) { return map[t] || t; }).join(' ');
        }
      });
    });
  }

  function showMissing(fig, id, noIndex) {
    if (fig.querySelector('.diagram__missing')) return;
    var div = doc.createElement('div');
    div.className = 'diagram__missing';
    div.innerHTML = '다이어그램 <code>' + esc(id) + '</code> 를 불러오지 못했습니다.' +
      (noIndex ? ' <br><small>개발 중에는 로컬 서버로 열어야 SVG를 읽을 수 있습니다 ' +
        '(<code>python3 -m http.server</code>). 배포 시에는 ' +
        '<code>tools/inline-diagrams.mjs</code> 가 정적으로 삽입합니다.</small>' : '');
    var cap = fig.querySelector(':scope > figcaption');
    if (cap) fig.insertBefore(div, cap); else fig.appendChild(div);
  }

  /* ======================================================================
     검색
     ====================================================================== */
  var searchState = { docs: null, loaded: false, panel: null };

  function ensureSearchIndex() {
    if (searchState.loaded) return Promise.resolve(searchState.docs);
    return fetchJSON(url('data/search-index.json')).then(function (j) {
      searchState.loaded = true;
      searchState.docs = Array.isArray(j) ? j : (Array.isArray(j && j.docs) ? j.docs : []);
      return searchState.docs;
    }).catch(function () {
      searchState.loaded = true;
      searchState.docs = null;
      return null;
    });
  }

  function buildSearchPanel() {
    if (searchState.panel) return searchState.panel;
    var d = doc.createElement('div');
    d.className = 'search-dialog';
    d.setAttribute('role', 'dialog');
    d.setAttribute('aria-modal', 'true');
    d.setAttribute('aria-label', '사이트 검색');
    d.innerHTML =
      '<div class="search-panel">' +
        '<div class="search-panel__head">' +
          '<label class="sr-only" for="kg-search-input">검색어</label>' +
          '<input type="search" id="kg-search-input" placeholder="설정명·개념·챕터 제목으로 검색" autocomplete="off" spellcheck="false">' +
          '<button type="button" class="btn btn--sm" data-act="search-close">닫기</button>' +
        '</div>' +
        '<ul class="search-results" role="listbox" aria-label="검색 결과"></ul>' +
        '<p class="search-panel__foot">↑↓ 이동 · Enter 열기 · Esc 닫기</p>' +
      '</div>';
    doc.body.appendChild(d);
    searchState.panel = d;

    var input = d.querySelector('input');
    var results = d.querySelector('.search-results');

    input.addEventListener('input', function () { runSearch(input.value, results); });
    input.addEventListener('keydown', function (e) {
      var links = results.querySelectorAll('a');
      if (e.key === 'ArrowDown' && links.length) { e.preventDefault(); links[0].focus(); }
      if (e.key === 'Enter' && links.length) { e.preventDefault(); links[0].click(); }
    });
    results.addEventListener('keydown', function (e) {
      var links = Array.prototype.slice.call(results.querySelectorAll('a'));
      var i = links.indexOf(doc.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); (links[i + 1] || links[0]).focus(); }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (i <= 0) input.focus(); else links[i - 1].focus();
      }
    });
    d.addEventListener('click', function (e) {
      if (e.target === d) closeSearch();
      var b = e.target.closest && e.target.closest('[data-act="search-close"]');
      if (b) closeSearch();
    });
    d.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); closeSearch(); }
    });
    return d;
  }

  function openSearch() {
    var d = buildSearchPanel();
    d.setAttribute('data-open', 'true');
    var input = d.querySelector('input');
    input.value = '';
    var results = d.querySelector('.search-results');
    results.innerHTML = '<li><p class="search-panel__foot">인덱스를 불러오는 중…</p></li>';
    input.focus();
    ensureSearchIndex().then(function (docs) {
      if (d.getAttribute('data-open') !== 'true') return;
      results.innerHTML = docs && docs.length
        ? '<li><p class="search-panel__foot">' + docs.length + '개 페이지를 검색합니다.</p></li>'
        : '<li><p class="search-panel__foot">검색 인덱스를 불러오지 못했습니다. ' +
          'file:// 로 열었다면 로컬 서버로 띄워 주세요.</p></li>';
    });
  }
  function closeSearch() {
    if (!searchState.panel) return;
    searchState.panel.removeAttribute('data-open');
    var t = doc.querySelector('[data-act="search"]');
    if (t) t.focus();
  }

  function runSearch(q, results) {
    q = (q || '').trim();
    if (q.length < 1) { results.innerHTML = ''; return; }
    var docs = searchState.docs || [];
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    var scored = [];
    docs.forEach(function (d) {
      var title = (d.title || '').toLowerCase();
      var heads = (d.headings || []).join(' ').toLowerCase();
      var text = (d.text || '').toLowerCase();
      var score = 0, allHit = true;
      terms.forEach(function (t) {
        var hit = 0;
        if (title.indexOf(t) >= 0) hit += 12;
        if (heads.indexOf(t) >= 0) hit += 5;
        var n = text.split(t).length - 1;
        if (n > 0) hit += Math.min(n, 6);
        if (hit === 0) allHit = false;
        score += hit;
      });
      if (allHit && score > 0) scored.push({ d: d, score: score });
    });
    scored.sort(function (a, b) { return b.score - a.score; });
    scored = scored.slice(0, 25);

    if (!scored.length) {
      results.innerHTML = '<li><p class="search-panel__foot">결과가 없습니다.</p></li>';
      return;
    }
    var first = terms[0];
    results.innerHTML = scored.map(function (s) {
      var d = s.d;
      return '<li><a href="' + esc(url(d.path)) + '">' +
        '<span class="search-results__title">' + esc(d.title || d.path) + '</span> ' +
        '<span class="search-results__path">' + esc(d.section || '') + ' · ' + esc(d.path) + '</span>' +
        '<span class="search-results__snippet">' + snippet(d.text || '', first) + '</span>' +
        '</a></li>';
    }).join('');
  }

  function snippet(text, term) {
    var lower = text.toLowerCase();
    var i = term ? lower.indexOf(term) : -1;
    var start = i < 0 ? 0 : Math.max(0, i - 45);
    var raw = text.slice(start, start + 150);
    var out = esc(raw);
    if (term) {
      var re = new RegExp('(' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      out = out.replace(re, '<mark>$1</mark>');
    }
    return (start > 0 ? '…' : '') + out + (text.length > start + 150 ? '…' : '');
  }

  /* ======================================================================
     읽음 처리
     ====================================================================== */
  /* ---------- 치트시트 표 필터 -----------------------------------------------
     <input class="cheat-filter" data-target="#t-broker"> 가 가리키는 표의
     tbody 행을 입력어로 걸러낸다. 시험 직전·장애 대응 중에 쓰는 기능이라
     즉시 반응해야 하므로 디바운스를 두지 않는다 (행 수가 최대 수백 개다).

     - 공백으로 나눈 토큰 전부를 포함하는 행만 남긴다 (AND)
     - 대소문자 무시. 설정명은 소문자·점 표기이므로 그대로 매칭된다
     - rowspan 이 걸린 그룹 헤더 행은 숨기지 않는다 (표가 깨진다)
     - 결과 수를 aria-live 로 안내한다 (스크린리더에서도 몇 건인지 알 수 있게)
  --------------------------------------------------------------------------- */
  function initCheatFilters(root) {
    var inputs = Array.prototype.slice.call(root.querySelectorAll('input.cheat-filter'));
    if (!inputs.length) return;

    inputs.forEach(function (input) {
      var sel = input.getAttribute('data-target');
      var table = sel ? root.querySelector(sel) : null;
      if (!table) return;

      var rows = Array.prototype.slice.call(table.querySelectorAll('tbody tr'));
      if (!rows.length) return;

      /* 검색 대상 텍스트를 미리 만들어 둔다 (입력마다 재계산하지 않는다) */
      var haystacks = rows.map(function (tr) {
        return (tr.textContent || '').toLowerCase().replace(/\s+/g, ' ');
      });
      /* rowspan 그룹 헤더는 숨기면 표 구조가 어긋나므로 항상 유지한다 */
      var keepAlways = rows.map(function (tr) {
        return !!tr.querySelector('[rowspan]');
      });

      var status = doc.createElement('p');
      status.className = 'cheat-filter__status';
      status.setAttribute('aria-live', 'polite');
      status.hidden = true;
      if (table.parentNode) table.parentNode.insertBefore(status, table.nextSibling);

      function apply() {
        var q = (input.value || '').trim().toLowerCase();
        var tokens = q ? q.split(/\s+/) : [];
        var shown = 0;

        for (var i = 0; i < rows.length; i++) {
          var hit = true;
          for (var t = 0; t < tokens.length; t++) {
            if (haystacks[i].indexOf(tokens[t]) === -1) { hit = false; break; }
          }
          if (hit) shown++;
          rows[i].hidden = keepAlways[i] ? false : !hit;
        }

        if (!tokens.length) {
          status.hidden = true;
          status.textContent = '';
        } else {
          status.hidden = false;
          status.textContent = shown
            ? shown + '개 항목이 일치합니다.'
            : '일치하는 항목이 없습니다. 검색어 일부만 입력해 보세요.';
        }
      }

      input.addEventListener('input', apply);
      /* Esc 로 초기화 — 장애 대응 중 손이 키보드에 있을 때 유용하다 */
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && input.value) {
          e.preventDefault();
          input.value = '';
          apply();
        }
      });
      apply();
    });
  }

  function initReadTracking() {
    var p = pr();
    if (!p || !state.pageId) return;
    if (p.isRead(state.pageId)) return;
    var done = false;
    var check = function () {
      if (done) return;
      var docH = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
      var seen = global.scrollY + global.innerHeight;
      // 문서가 화면보다 짧으면 즉시 읽음 처리
      if (docH <= global.innerHeight * 1.1 || seen / docH >= 0.8) {
        done = true;
        p.markRead(state.pageId);
        global.removeEventListener('scroll', check);
        var link = doc.querySelector('.sidebar__link[aria-current="page"]');
        if (link && !link.querySelector('.sidebar__read')) {
          var s = doc.createElement('span');
          s.className = 'sidebar__read';
          s.title = '읽음';
          s.setAttribute('aria-label', '읽음');
          s.textContent = '✓';
          link.appendChild(s);
        }
      }
    };
    global.addEventListener('scroll', check, { passive: true });
    global.setTimeout(check, 1200);
  }

  /* ======================================================================
     전역 이벤트
     ====================================================================== */
  function initGlobalEvents() {
    doc.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-act]');
      if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'theme') { e.preventDefault(); cycleTheme(); }
      else if (act === 'fontsize') { e.preventDefault(); cycleFontSize(); }
      else if (act === 'drawer') { e.preventDefault(); toggleDrawer(); }
      else if (act === 'drawer-close') { e.preventDefault(); toggleDrawer(false); }
      else if (act === 'search') { e.preventDefault(); openSearch(); }
      else if (act === 'reset-progress') {
        e.preventDefault();
        if (global.confirm('읽음 기록·퀴즈 통계·시험 이력·플래시카드 진도를 모두 삭제합니다. 계속할까요?')) {
          var p = pr();
          if (p) p.reset('all');
          global.location.reload();
        }
      }
    });

    doc.addEventListener('keydown', function (e) {
      var t = e.target, tag = t && t.tagName ? t.tagName.toUpperCase() : '';
      var inField = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || (t && t.isContentEditable);
      if (e.key === '/' && !inField && !e.metaKey && !e.ctrlKey) {
        var trigger = doc.querySelector('[data-act="search"]');
        if (trigger && !trigger.hidden) { e.preventDefault(); openSearch(); }
      }
      if (e.key === 'Escape' && doc.body.classList.contains('drawer-open')) toggleDrawer(false);
    });

    // 사이드바 링크 클릭 시 드로어 닫기 (모바일)
    var mount = doc.getElementById('sidebar-mount');
    if (mount) {
      mount.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('a')) toggleDrawer(false);
      });
    }
  }

  /* ======================================================================
     부트스트랩
     ====================================================================== */
  function boot() {
    state.main = doc.querySelector('main');
    var mount = doc.getElementById('sidebar-mount');
    state.section = mount ? mount.getAttribute('data-section') : null;
    state.page = mount ? mount.getAttribute('data-page') : null;
    state.pageId = state.main ? state.main.getAttribute('data-page-id') : null;
    if (!state.pageId && state.section && state.page) {
      state.pageId = state.section === 'home' ? 'index' : state.section + '/' + state.page;
    }

    buildTopbar();
    initSettings();
    initGlobalEvents();

    if (state.main) {
      addCopyButtons(state.main);
      buildPageToc(state.main);
      initCheatFilters(state.main);
    }

    // 검색 UI 는 바로 노출하고, 인덱스는 실제로 열 때 받습니다.
    // 부팅 때 받으면 모든 페이지가 인덱스 크기만큼의 비용을 뭅니다.
    var searchTrigger = doc.querySelector('[data-act="search"]');
    if (searchTrigger) searchTrigger.hidden = false;

    // 다이어그램 주입 (fetch 실패는 조용히 흡수)
    injectDiagrams(doc).catch(function () {});

    // 사이드바: toc.json → 실패 시 폴백
    fetchJSON(url('data/toc.json')).then(function (toc) {
      if (!toc || !Array.isArray(toc.sections)) throw new Error('형식 불일치');
      state.toc = toc;
      return toc;
    }).catch(function () {
      state.toc = fallbackToc();
      return state.toc;
    }).then(function (toc) {
      renderSidebar(toc);
      if (state.main) buildPager(state.main);
      initReadTracking();
    });
  }

  /* ---------- 공개 -------------------------------------------------------- */
  global.AG = global.AG || {};
  global.AG.app = {
    root: ROOT,
    url: url,
    state: state,
    injectDiagrams: injectDiagrams,
    addCopyButtons: addCopyButtons,
    openSearch: openSearch,
    applyTheme: applyTheme,
    cycleTheme: cycleTheme,
    fallbackToc: fallbackToc,
    slugify: slugify
  };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
