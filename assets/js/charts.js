/* ==========================================================================
   AWS SAA Guide — 차트 엔진 (charts.js)

   assets/vendor/chart.umd.min.js (Chart.js 4.5.1, MIT) 를 감싸는 얇은 층입니다.
   Chart.js 자체는 CDN 이 아니라 저장소에 동봉되어 있습니다 — 오프라인에서도 열리고
   CSP 제약이 있는 환경에서도 동작해야 하기 때문입니다 (PLAN.md §1 기술 선택).

   이 파일이 책임지는 것은 네 가지입니다.

   1. 레지스트리
      콘텐츠 페이지는 플레이스홀더만 씁니다.

        <figure class="chart" data-chart="C-010">
          <figcaption>…</figcaption>
        </figure>

      실제 스펙은 차트 에이전트가 아래 REGISTRY 절에 등록합니다.

        AG.charts.register('C-010', function (ctx) {
          return { type: 'bar', data: {…}, options: {…} };
        });

      이 분리가 없으면 콘텐츠 에이전트와 차트 에이전트가 같은 HTML 파일을 다투게 됩니다.

   2. 테마 연동
      색을 직접 쓰지 않고 ctx.color(...) 로만 가져옵니다. 이 함수는 viz.css 의
      --dg-* 토큰을 실제 계산값으로 읽으므로, 다크모드 전환이 자동으로 따라옵니다.
      테마가 바뀌면 등록된 전 차트를 재생성합니다 (Chart.js 는 생성 시점의 색을
      내부에 복사해 두기 때문에 옵션만 바꿔서는 반영되지 않습니다).

   3. 접근성
      캔버스는 스크린 리더에 아무것도 전달하지 못합니다. 그래서 모든 차트는
      <figcaption> 이 필수이고, 표 대체본(.chart__table)을 함께 만듭니다.
      인쇄와 JS 비활성 환경에서도 정보가 살아 있어야 합니다.
      spec.a11yTable 가 있으면 그것을 쓰고, 없으면 data 에서 자동 생성합니다.

   4. 지연 생성
      IntersectionObserver 로 화면에 들어올 때 생성합니다. 한 페이지에 차트가
      여러 개일 때 초기 렌더를 막지 않기 위해서입니다.

   ⚠️ 주의 — 수치의 출처
      확인되지 않은 값으로 차트를 만들지 않습니다. 상대 비교만 가능하면 축에
      숫자 대신 등급을 쓰고 그 사실을 캡션에 밝힙니다 (docs/FACT_SOURCES.md).
   ========================================================================== */
(function (global) {
  'use strict';

  var doc = global.document;
  if (!doc) return;

  /* ROOT 계산 — app.js / quiz.js 와 동일한 규약.
     페이지 깊이에 상관없이 자원 경로가 맞아야 합니다. */
  var ROOT = (function () {
    if (global.AG && global.AG.__root) return global.AG.__root;
    var src = doc.currentScript && doc.currentScript.src;
    if (!src) {
      var ss = doc.getElementsByTagName('script');
      for (var i = ss.length - 1; i >= 0; i--) {
        if (ss[i].src && /assets\/js\/[^/]*\.js/.test(ss[i].src)) { src = ss[i].src; break; }
      }
    }
    var root = src ? src.replace(/assets\/js\/[^/]*$/, '') : './';
    global.AG = global.AG || {};
    global.AG.__root = root;
    return root;
  })();
  function url(rel) { return ROOT + rel; }

  var registry = Object.create(null);   // 'C-010' → specFn
  var live = [];                        // { id, figure, canvas, chart, specFn }
  var dataCache = Object.create(null);  // data/charts/*.json 캐시

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function reducedMotion() {
    return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /* ======================================================================
     색 — viz.css 의 --dg-* 토큰을 계산값으로 읽습니다
     ---------------------------------------------------------------------
     Chart.js 는 'var(--dg-accent)' 같은 문자열을 이해하지 못하므로
     getComputedStyle 로 실제 색 문자열을 뽑아 넘겨야 합니다.
     ====================================================================== */
  var TOKEN = {
    accent: '--dg-accent',
    ok: '--dg-ok',
    warn: '--dg-warn',
    danger: '--dg-danger',
    muted: '--dg-muted',
    stroke: '--dg-stroke',
    grid: '--dg-grid',
    text: '--dg-text',
    textMuted: '--dg-text-muted',
    fill: '--dg-fill',
    fillAlt: '--dg-fill-alt',
    accentSoft: '--dg-accent-soft',
    okSoft: '--dg-ok-soft',
    warnSoft: '--dg-warn-soft',
    dangerSoft: '--dg-danger-soft',
    mutedSoft: '--dg-muted-soft'
  };

  /* 계열 색 순서 — 인접한 두 계열이 색상환에서 멀도록 배치했습니다.
     범주형 색은 5개를 넘기면 구분이 무너지므로, 6개 이상이면 패턴을 병행하세요. */
  var SERIES = ['accent', 'ok', 'warn', 'danger', 'muted'];
  var SERIES_SOFT = ['accentSoft', 'okSoft', 'warnSoft', 'dangerSoft', 'mutedSoft'];

  function cssVar(name) {
    try {
      var v = global.getComputedStyle(doc.documentElement).getPropertyValue(name);
      return (v || '').trim();
    } catch (e) { return ''; }
  }

  /* 토큰이 비어 있을 때의 최후 폴백. viz.css 가 로드되지 않은 경우에만 쓰입니다. */
  var FALLBACK = {
    accent: '#1256a0', ok: '#1c6b3a', warn: '#8a5a06', danger: '#b3261e',
    muted: '#8b939e', stroke: '#4d5764', grid: '#c9d0d9',
    text: '#1b2027', textMuted: '#5c6673', fill: '#f4f6f9', fillAlt: '#e7ebf1',
    accentSoft: '#e4eef8', okSoft: '#e6f4ea', warnSoft: '#fdf3e0',
    dangerSoft: '#fbe9e8', mutedSoft: '#eef0f3'
  };

  function color(kind, i) {
    if (kind === 'series') return color(SERIES[(i || 0) % SERIES.length]);
    if (kind === 'seriesSoft') return color(SERIES_SOFT[(i || 0) % SERIES_SOFT.length]);
    var token = TOKEN[kind];
    if (!token) return kind;                       // 이미 색 문자열이면 그대로
    return cssVar(token) || FALLBACK[kind] || kind;
  }

  /* 반투명 버전 — 막대 채우기나 영역 차트에 씁니다.
     CSS color-mix 대신 직접 계산하는 이유: Chart.js 가 캔버스에 그리므로
     브라우저의 color-mix 지원 여부와 무관하게 동작해야 합니다. */
  function alpha(cssColor, a) {
    var c = String(cssColor).trim();
    var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
    if (m) {
      var h = m[1];
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      return 'rgba(' + parseInt(h.slice(0, 2), 16) + ',' +
             parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16) + ',' + a + ')';
    }
    m = /^rgba?\(([^)]+)\)$/i.exec(c);
    if (m) {
      var parts = m[1].split(/[,\s/]+/).filter(Boolean);
      return 'rgba(' + parts[0] + ',' + parts[1] + ',' + parts[2] + ',' + a + ')';
    }
    return c;
  }

  /* ======================================================================
     공통 옵션 — 모든 차트가 상속합니다
     ====================================================================== */
  function baseOptions() {
    var text = color('text');
    var muted = color('textMuted');
    var grid = color('grid');
    var fontFamily = cssVar('--font-sans') ||
      '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: reducedMotion() ? false : { duration: 420 },
      /* 캔버스는 스크린 리더에 안 읽히므로 표 대체본이 정본입니다.
         중복 낭독을 막기 위해 캔버스 자체는 aria-hidden 처리합니다. */
      plugins: {
        legend: {
          labels: {
            color: text,
            font: { family: fontFamily, size: 13 },
            boxWidth: 12, boxHeight: 12, usePointStyle: true, padding: 14
          }
        },
        tooltip: {
          backgroundColor: color('fillAlt'),
          titleColor: text,
          bodyColor: text,
          borderColor: color('stroke'),
          borderWidth: 1,
          titleFont: { family: fontFamily, size: 13, weight: '600' },
          bodyFont: { family: fontFamily, size: 13 },
          padding: 10,
          displayColors: true
        }
      },
      scales: {
        x: {
          ticks: { color: muted, font: { family: fontFamily, size: 12 } },
          grid: { color: grid, drawTicks: false },
          border: { color: color('stroke') }
        },
        y: {
          ticks: { color: muted, font: { family: fontFamily, size: 12 } },
          grid: { color: grid, drawTicks: false },
          border: { color: color('stroke') }
        }
      }
    };
  }

  /* 얕은 병합 — 등록부가 준 options 가 baseOptions 를 덮어씁니다.
     scales.x.ticks.color 같은 3단계 경로를 살리려면 깊은 병합이 필요합니다. */
  function merge(base, over) {
    if (!over) return base;
    var out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    Object.keys(over).forEach(function (k) {
      var a = out[k], b = over[k];
      if (b && typeof b === 'object' && !Array.isArray(b) &&
          a && typeof a === 'object' && !Array.isArray(a)) {
        out[k] = merge(a, b);
      } else {
        out[k] = b;
      }
    });
    return out;
  }

  /* ======================================================================
     표 대체본
     ---------------------------------------------------------------------
     차트를 "본" 사람과 "못 보는" 사람이 같은 정보를 얻어야 합니다.
     인쇄에서도 캔버스보다 표가 훨씬 유용합니다.
     ====================================================================== */
  function autoTable(spec) {
    if (spec.a11yTable) return spec.a11yTable;
    var d = spec.data || {};
    var labels = d.labels || [];
    var sets = d.datasets || [];
    if (!labels.length || !sets.length) return null;
    return {
      caption: spec.a11yCaption || null,
      head: ['항목'].concat(sets.map(function (s, i) { return s.label || ('계열 ' + (i + 1)); })),
      rows: labels.map(function (lb, r) {
        return [lb].concat(sets.map(function (s) {
          var v = (s.data || [])[r];
          if (v && typeof v === 'object') {
            /* scatter 등 {x,y} 형태 */
            return (v.x != null ? v.x : '') + ' / ' + (v.y != null ? v.y : '');
          }
          return v == null ? '—' : v;
        }));
      })
    };
  }

  function renderTable(figure, table) {
    if (!table) return;
    if (figure.querySelector('.chart__table')) return;
    var wrap = doc.createElement('details');
    wrap.className = 'chart__table';
    var h = '<summary>표로 보기</summary><div class="table-scroll"><table>';
    if (table.caption) h += '<caption>' + esc(table.caption) + '</caption>';
    h += '<thead><tr>';
    table.head.forEach(function (c, i) {
      h += '<th scope="col"' + (i === 0 ? '' : ' class="t-nowrap"') + '>' + esc(c) + '</th>';
    });
    h += '</tr></thead><tbody>';
    table.rows.forEach(function (row) {
      h += '<tr>';
      row.forEach(function (c, i) {
        h += i === 0 ? '<th scope="row">' + esc(c) + '</th>' : '<td>' + esc(c) + '</td>';
      });
      h += '</tr>';
    });
    h += '</tbody></table></div>';
    wrap.innerHTML = h;
    var cap = figure.querySelector(':scope > figcaption');
    figure.insertBefore(wrap, cap || null);
  }

  /* ======================================================================
     데이터 파일 로딩 — 10행을 넘는 데이터셋은 JSON 으로 분리합니다
     ====================================================================== */
  function loadData(name) {
    if (dataCache[name]) return dataCache[name];
    var p = fetch(url('data/charts/' + name + '.json'), { credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
    dataCache[name] = p;
    return p;
  }

  /* ======================================================================
     등록 · 생성
     ====================================================================== */
  var booted = false;

  function register(id, specFn) {
    if (!id || typeof specFn !== 'function') return;
    id = String(id).toUpperCase();
    registry[id] = specFn;
    /* 이미 마운트를 끝낸 뒤에 등록되는 경우(늦게 로드된 charts-*.js, 동적 삽입)를
       위해 해당 ID 의 플레이스홀더를 다시 훑는다. mount() 는 data-chart-init 로
       중복을 막지만, 앞서 "등록되지 않았습니다" 상자를 넣어 둔 figure 는
       그 상태로 굳어 있으므로 상자를 걷어내고 초기화 표시를 지운 뒤 재시도한다. */
    if (!booted) return;
    Array.prototype.forEach.call(
      doc.querySelectorAll('figure.chart[data-chart="' + id + '"]'),
      function (f) {
        var box = f.querySelector('.chart__missing');
        if (box) box.parentNode.removeChild(box);
        if (f.dataset.chartInit === '1' && !f.querySelector('canvas')) {
          delete f.dataset.chartInit;
        }
        mount(f);
      }
    );
  }
  function has(id) { return !!registry[String(id || '').toUpperCase()]; }

  function makeCtx(id, figure) {
    return {
      id: id,
      figure: figure,
      color: color,
      alpha: alpha,
      /* 계열 i 의 선/막대 테두리색과 채움색 한 쌍 */
      pair: function (i, fillAlpha) {
        var c = color('series', i);
        return { border: c, fill: alpha(c, fillAlpha == null ? 0.55 : fillAlpha) };
      },
      palette: function (n) {
        var out = [];
        for (var i = 0; i < n; i++) out.push(color('series', i));
        return out;
      },
      loadData: loadData,
      reducedMotion: reducedMotion(),
      fontFamily: cssVar('--font-sans') || 'sans-serif'
    };
  }

  function missing(figure, id, why) {
    if (figure.querySelector('.chart__missing')) return;
    var box = doc.createElement('div');
    box.className = 'chart__missing';
    box.innerHTML = '<p><strong>' + esc(id) + '</strong> 차트를 그리지 못했습니다.</p>' +
                    '<p>' + esc(why) + '</p>';
    var cap = figure.querySelector(':scope > figcaption');
    figure.insertBefore(box, cap || null);
  }

  function build(entry) {
    var Chart = global.Chart;
    if (!Chart) { missing(entry.figure, entry.id, 'Chart.js 가 로드되지 않았습니다.'); return; }

    var spec;
    try {
      spec = entry.specFn(makeCtx(entry.id, entry.figure));
    } catch (e) {
      missing(entry.figure, entry.id, '차트 정의에서 오류가 발생했습니다: ' + e.message);
      return;
    }
    if (!spec) return;

    /* 비동기 스펙(데이터 파일을 읽는 경우)도 허용합니다 */
    if (typeof spec.then === 'function') {
      spec.then(function (s) { if (s) instantiate(entry, s); })
          .catch(function (e) { missing(entry.figure, entry.id, '데이터를 읽지 못했습니다: ' + e.message); });
      return;
    }
    instantiate(entry, spec);
  }

  function instantiate(entry, spec) {
    var Chart = global.Chart;
    var host = entry.figure.querySelector('.chart__canvas');
    if (!host) {
      host = doc.createElement('div');
      host.className = 'chart__canvas';
      var cap = entry.figure.querySelector(':scope > figcaption');
      entry.figure.insertBefore(host, cap || null);
    }
    /* 높이는 스펙이 지정할 수 있게 합니다. 지정이 없으면 CSS 기본값. */
    if (spec.height) host.style.setProperty('--chart-h', spec.height + 'px');

    var canvas = host.querySelector('canvas');
    if (!canvas) {
      canvas = doc.createElement('canvas');
      /* 표 대체본이 정본이므로 캔버스는 보조 시각 요소로만 노출합니다 */
      canvas.setAttribute('role', 'presentation');
      canvas.setAttribute('aria-hidden', 'true');
      host.appendChild(canvas);
    }

    if (entry.chart) { try { entry.chart.destroy(); } catch (e) {} entry.chart = null; }

    try {
      entry.chart = new Chart(canvas, {
        type: spec.type,
        data: spec.data,
        options: merge(baseOptions(), spec.options)
      });
    } catch (e) {
      missing(entry.figure, entry.id, '차트를 생성하지 못했습니다: ' + e.message);
      return;
    }
    entry.spec = spec;
    renderTable(entry.figure, autoTable(spec));
  }

  /* ======================================================================
     마운트 — 화면에 들어올 때 생성
     ====================================================================== */
  function mount(figure) {
    if (!figure || figure.dataset.chartInit === '1') return false;
    var id = (figure.getAttribute('data-chart') || '').toUpperCase();
    if (!id) return false;
    figure.dataset.chartInit = '1';

    var specFn = registry[id];
    if (!specFn) {
      missing(figure, id, '이 차트가 아직 등록되지 않았습니다 (assets/js/charts-*.js).');
      return false;
    }
    var entry = { id: id, figure: figure, specFn: specFn, chart: null, spec: null };
    live.push(entry);

    if (global.IntersectionObserver) {
      var io = new global.IntersectionObserver(function (rows) {
        rows.forEach(function (row) {
          if (!row.isIntersecting) return;
          io.disconnect();
          build(entry);
        });
      }, { rootMargin: '160px 0px' });
      io.observe(figure);
    } else {
      build(entry);
    }
    return true;
  }

  function mountAll(root) {
    var scope = root || doc;
    var n = 0;
    Array.prototype.forEach.call(scope.querySelectorAll('figure.chart[data-chart]'), function (f) {
      if (mount(f)) n++;
    });
    return n;
  }

  /* ======================================================================
     테마 전환 시 재생성
     ---------------------------------------------------------------------
     Chart.js 는 생성 시점의 색 문자열을 내부 구조에 복사합니다. 옵션만
     갱신해도 이미 그려진 요소의 색은 바뀌지 않으므로 통째로 다시 만듭니다.
     ====================================================================== */
  function refreshAll() {
    live.forEach(function (entry) {
      if (!entry.chart) return;          // 아직 화면에 안 들어온 차트는 그대로 둔다
      build(entry);
    });
  }

  function watchTheme() {
    /* 1) 토글 버튼이 <html data-theme> 를 바꾸는 경우 */
    if (global.MutationObserver) {
      var mo = new global.MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          if (muts[i].attributeName === 'data-theme') { refreshAll(); return; }
        }
      });
      mo.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }
    /* 2) theme=auto 상태에서 OS 설정이 바뀌는 경우 */
    if (global.matchMedia) {
      var mq = global.matchMedia('(prefers-color-scheme: dark)');
      var onChange = function () { refreshAll(); };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  }

  /* ====================================================================== */
  var api = {
    register: register,
    registerChart: register,
    has: has,
    mount: mount,
    mountAll: mountAll,
    refreshAll: refreshAll,
    color: color,
    alpha: alpha,
    loadData: loadData,
    baseOptions: baseOptions,
    _registry: registry,
    _live: live
  };
  global.AG = global.AG || {};
  global.AG.charts = api;
  global.registerChart = register;

  function boot() {
    if (booted) return;
    booted = true;
    mountAll();
    watchTheme();
  }

  /* ⚠️ boot 를 **다음 틱으로 미룹니다.** 이 파일은 defer 로 로드되므로 실행 시점에
     readyState 는 이미 'interactive' 이고, 여기서 바로 boot() 를 부르면 아래
     REGISTRY 절이 아직 실행되기 전이라 전부 "등록되지 않았습니다" 로 표시됩니다.
     setTimeout 0 이면 (1) 이 파일의 REGISTRY 절과 (2) 뒤이어 로드되는
     charts-*.js 의 등록이 모두 끝난 뒤에 마운트됩니다.
     그 뒤에 오는 늦은 등록은 register() 가 직접 재마운트합니다. */
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else global.setTimeout(boot, 0);

  /* ==========================================================================
     ────────────────────────── REGISTRY ──────────────────────────
     차트 정의를 여기에 등록합니다. 규모가 커지면 charts-content.js /
     charts-dash.js 로 분리하고, 그 파일을 charts.js 뒤에 로드하세요.

     등록 함수는 { type, data, options?, height?, a11yTable?, a11yCaption? } 를
     반환하거나, 그 객체로 resolve 되는 Promise 를 반환합니다.

     색은 반드시 ctx 를 통해 가져옵니다. 하드코딩하면 다크모드에서 깨집니다.
       ctx.color('accent' | 'ok' | 'warn' | 'danger' | 'muted' | 'text' | 'grid' | …)
       ctx.color('series', i)   계열 i 의 색
       ctx.palette(n)           계열 n 개의 색 배열
       ctx.pair(i, 0.5)         { border, fill } 한 쌍
       ctx.alpha(색, 0.4)       투명도 적용

     ⚠️ 확인되지 않은 수치로 차트를 만들지 마세요 (docs/FACT_SOURCES.md).
     ========================================================================== */

  /* --------------------------------------------------------------------------
     C-001 — SAA-C03 도메인 가중치 (레퍼런스 구현)
     --------------------------------------------------------------------------
     출처: SAA-C03 공식 시험 가이드. 네 값의 합은 100 이어야 합니다.
     이 차트가 레퍼런스인 이유: 도넛 + 범례 + 표 대체본 + 툴팁 포맷터까지
     한 번에 보여주므로, 다른 차트를 만들 때 그대로 복제할 수 있습니다.
     -------------------------------------------------------------------------- */
  register('C-001', function (ctx) {
    var labels = [
      '보안 아키텍처 설계',
      '복원력 있는 아키텍처 설계',
      '고성능 아키텍처 설계',
      '비용 최적화 아키텍처 설계'
    ];
    var values = [30, 26, 24, 20];

    return {
      type: 'doughnut',
      height: 320,
      data: {
        labels: labels,
        datasets: [{
          label: '출제 비중',
          data: values,
          backgroundColor: ctx.palette(4).map(function (c) { return ctx.alpha(c, 0.75); }),
          borderColor: ctx.color('fill'),
          borderWidth: 2,
          hoverOffset: 6
        }]
      },
      options: {
        cutout: '54%',
        plugins: {
          legend: { position: 'right' },
          tooltip: {
            callbacks: {
              label: function (item) { return item.label + ' — ' + item.parsed + '%'; }
            }
          }
        },
        /* 도넛에는 축이 없습니다. baseOptions 의 scales 를 지웁니다. */
        scales: { x: { display: false }, y: { display: false } }
      },
      a11yCaption: 'SAA-C03 도메인별 출제 비중 (공식 시험 가이드 기준)',
      a11yTable: {
        caption: 'SAA-C03 도메인별 출제 비중',
        head: ['도메인', '공식 명칭', '비중'],
        rows: [
          ['보안 아키텍처 설계', 'Design Secure Architectures', '30%'],
          ['복원력 있는 아키텍처 설계', 'Design Resilient Architectures', '26%'],
          ['고성능 아키텍처 설계', 'Design High-Performing Architectures', '24%'],
          ['비용 최적화 아키텍처 설계', 'Design Cost-Optimized Architectures', '20%']
        ]
      }
    };
  });

})(typeof window !== 'undefined' ? window : this);
