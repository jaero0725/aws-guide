/* ==========================================================================
   AWS SAA Guide — 인터랙티브 다이어그램 프리미티브 (viz.js)
   --------------------------------------------------------------------------
   ★ V1–V3 시각화 에이전트 필독 ★

   왜 SVG 파일 안에 <script> 를 넣지 않는가
     · 인라인 삽입되면 같은 스크립트가 여러 번 실행될 수 있습니다.
     · Artifact/CSP 환경에서 인라인 스크립트가 차단됩니다.
     · CONTENT_STYLE_GUIDE 가 인라인 <script> 를 금지합니다.
   → 그래서 **로직은 이 파일에 id별로 등록**하고, SVG 는 마크업과 data-* 훅만 갖습니다.

   ┌───────────────────────────────────────────────────────────────────────┐
   │ 규약 1. SVG 안의 조작 대상은 id 가 아니라 data-dg 로 표시합니다.       │
   │   <rect data-dg="hw-marker" class="dg-node" …/>                       │
   │   inline-diagrams.mjs 가 id 에 접두어를 붙이므로 id 셀렉터는 깨집니다.│
   │                                                                       │
   │ 규약 2. 로직은 viz.js 하단 REGISTRY 섹션에 등록합니다.                │
   │   AG.viz.register('D-034', function (ctx) { … });                     │
   │                                                                       │
   │ 규약 3. JS 없이도 초기 상태가 의미를 전달해야 합니다                  │
   │   (progressive enhancement). SVG 만 봐도 다이어그램이 성립할 것.      │
   │                                                                       │
   │ 규약 4. 컨트롤은 ctx.bindControls 로만 만듭니다. 실제 <button>/<input>│
   │   이 생성되므로 키보드 조작이 보장됩니다. div+click 금지.             │
   └───────────────────────────────────────────────────────────────────────┘

   initFn(ctx) 의 ctx:
     ctx.id           'D-012'
     ctx.svg          <svg class="ag-diagram">           (DOM)
     ctx.figure       <figure class="diagram">           (DOM)
     ctx.q(name)      svg.querySelector('[data-dg="name"]')
     ctx.qa(name)     Array<Element>  (같은 data-dg 값 전부)
     ctx.qs(sel)      svg.querySelector(sel)   — 임의 CSS 셀렉터
     ctx.qsa(sel)     Array<Element>
     ctx.setState(target, state)     target: 이름 문자열 | 셀렉터 | Element | Element[]
     ctx.text(name, str)            <text data-dg="name"> 의 내용 교체
     ctx.attr(name, obj)            속성 일괄 설정
     ctx.move(name, x, y)           transform: translate(x,y)
     ctx.bindControls(spec)         → controls API (아래)
     ctx.animateAlong(pathName, opts)
     ctx.announce(text)             aria-live 안내
     ctx.readout(items)             .dg-readout 갱신  [{label, value}]
     ctx.reducedMotion              boolean
   ========================================================================== */
(function (global) {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var registry = Object.create(null);   // id → initFn
  var mounted = new (global.WeakSet || Set)();

  /* ---------- 유틸 -------------------------------------------------------- */
  function reducedMotion() {
    try {
      return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }
  function toArray(x) { return Array.prototype.slice.call(x || []); }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function cssEscape(v) { return String(v).replace(/["\\]/g, '\\$&'); }

  /* ======================================================================
     공개 프리미티브 — setNodeState
     ---------------------------------------------------------------------
     노드에 data-state 를 부여합니다. 스타일링은 viz.css 가 담당합니다.
     state 어휘: on | off | active | done | error | pending | hidden | null(제거)
     ====================================================================== */
  function setNodeState(svg, selector, state) {
    if (!svg) return [];
    var nodes;
    if (typeof selector === 'string') {
      nodes = /^[\w-]+$/.test(selector)
        ? toArray(svg.querySelectorAll('[data-dg="' + cssEscape(selector) + '"]'))
        : toArray(svg.querySelectorAll(selector));
    } else if (selector && selector.nodeType === 1) {
      nodes = [selector];
    } else if (selector && selector.length != null) {
      nodes = toArray(selector);
    } else {
      nodes = [];
    }
    nodes.forEach(function (n) {
      if (state == null || state === false || state === '') n.removeAttribute('data-state');
      else n.setAttribute('data-state', String(state));
    });
    return nodes;
  }

  /* ======================================================================
     공개 프리미티브 — animateAlong
     ---------------------------------------------------------------------
     경로(path)를 따라 요소를 이동시킵니다.
     prefers-reduced-motion 이면 즉시 끝 지점으로 이동하고 onDone 을 호출합니다.

       ctx.animateAlong('flow-path', {
         el: 'packet',        // data-dg 이름 | 셀렉터 | Element
         duration: 700,       // ms
         from: 0, to: 1,      // 경로 비율
         onDone: fn
       })
     반환: { cancel() }
     ====================================================================== */
  function animateAlong(svg, pathSelector, opts) {
    opts = opts || {};
    var path = resolveOne(svg, pathSelector);
    var el = resolveOne(svg, opts.el);
    var noop = { cancel: function () {} };
    if (!path || !el || typeof path.getTotalLength !== 'function') return noop;

    var total;
    try { total = path.getTotalLength(); } catch (e) { return noop; }
    if (!total) return noop;

    var from = typeof opts.from === 'number' ? clamp(opts.from, 0, 1) : 0;
    var to = typeof opts.to === 'number' ? clamp(opts.to, 0, 1) : 1;
    var dur = Math.max(0, typeof opts.duration === 'number' ? opts.duration : 600);

    function place(t) {
      var p;
      try { p = path.getPointAtLength(total * t); } catch (e) { return; }
      el.setAttribute('transform', 'translate(' + p.x.toFixed(2) + ',' + p.y.toFixed(2) + ')');
    }

    if (dur === 0 || reducedMotion()) {
      place(to);
      if (typeof opts.onDone === 'function') opts.onDone();
      return noop;
    }

    var start = null, raf = 0, cancelled = false;
    function step(ts) {
      if (cancelled) return;
      if (start === null) start = ts;
      var k = clamp((ts - start) / dur, 0, 1);
      // easeInOutQuad
      var e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      place(from + (to - from) * e);
      if (k < 1) raf = global.requestAnimationFrame(step);
      else if (typeof opts.onDone === 'function') opts.onDone();
    }
    place(from);
    raf = global.requestAnimationFrame(step);
    return {
      cancel: function () { cancelled = true; if (raf) global.cancelAnimationFrame(raf); }
    };
  }

  function resolveOne(svg, sel) {
    if (!sel) return null;
    if (sel.nodeType === 1) return sel;
    if (typeof sel !== 'string') return null;
    if (/^[\w-]+$/.test(sel)) {
      return svg.querySelector('[data-dg="' + cssEscape(sel) + '"]') || svg.querySelector(sel);
    }
    return svg.querySelector(sel);
  }

  /* ======================================================================
     공개 프리미티브 — announce (aria-live)
     ====================================================================== */
  function liveRegion(container) {
    if (!container) return null;
    var live = container.querySelector('.dg-live');
    if (!live) {
      live = global.document.createElement('p');
      live.className = 'dg-live';
      live.setAttribute('role', 'status');
      live.setAttribute('aria-live', 'polite');
      container.appendChild(live);
    }
    return live;
  }
  function announce(container, text) {
    var live = liveRegion(container);
    if (live) live.textContent = text == null ? '' : String(text);
    return live;
  }

  /* ======================================================================
     공개 프리미티브 — bindControls
     ---------------------------------------------------------------------
     실제 <button>/<input>/<select> 만 생성합니다 (키보드 접근 보장).

       var api = bindControls(figure, {
         onChange: function (values, api, meta) { … },
         items: [
           { type:'range',  name:'consumer', label:'컨슈머 진행',
             min:0, max:12, step:1, value:5, format:function(v){return v+' 번';} },
           { type:'select', name:'strategy', label:'할당 전략',
             options:[{value:'range',label:'Range'},…], value:'range' },
           { type:'toggle', name:'compact', label:'컴팩션 켜기', value:false },
           { type:'button', name:'send',    label:'메시지 1건 전송' },
           { type:'reset',  label:'초기화' }
         ]
       });

     api.values()          현재 값 객체
     api.get(name) / api.set(name, v [, silent])
     api.reset()
     api.el                .dg-controls 요소
     api.announce(text)
     api.readout(items)
     ====================================================================== */
  function bindControls(container, spec) {
    spec = spec || {};
    var doc = global.document;
    var items = spec.items || [];
    var values = Object.create(null);
    var defaults = Object.create(null);
    var inputs = Object.create(null);
    var valueLabels = Object.create(null);

    var wrap = doc.createElement('div');
    wrap.className = 'dg-controls';

    var api = {
      el: wrap,
      values: function () {
        var out = {};
        for (var k in values) if (Object.prototype.hasOwnProperty.call(values, k)) out[k] = values[k];
        return out;
      },
      get: function (name) { return values[name]; },
      set: function (name, v, silent) {
        if (!(name in inputs)) { values[name] = v; return api; }
        var input = inputs[name];
        if (input.type === 'checkbox') input.checked = !!v;
        else input.value = String(v);
        syncFrom(name, silent !== false ? true : false);
        return api;
      },
      reset: function () {
        for (var k in defaults) {
          if (!Object.prototype.hasOwnProperty.call(defaults, k)) continue;
          if (inputs[k]) {
            if (inputs[k].type === 'checkbox') inputs[k].checked = !!defaults[k];
            else inputs[k].value = String(defaults[k]);
          }
          values[k] = defaults[k];
          updateLabel(k);
        }
        fire({ name: '__reset__', type: 'reset' });
        return api;
      },
      announce: function (t) { return announce(container, t); },
      readout: function (list) { return renderReadout(container, list); }
    };

    function coerce(item, raw) {
      if (item.type === 'range' || item.type === 'number') {
        var n = parseFloat(raw);
        return isNaN(n) ? (item.value || 0) : n;
      }
      if (item.type === 'toggle') return !!raw;
      return raw;
    }
    function updateLabel(name) {
      var lab = valueLabels[name];
      if (!lab) return;
      var item = lab.__item;
      var v = values[name];
      lab.textContent = typeof item.format === 'function' ? item.format(v) : String(v);
    }
    function syncFrom(name, silent) {
      var item = inputs[name].__item;
      var raw = inputs[name].type === 'checkbox' ? inputs[name].checked : inputs[name].value;
      values[name] = coerce(item, raw);
      updateLabel(name);
      if (!silent) fire({ name: name, type: item.type });
    }
    function fire(meta) {
      if (typeof spec.onChange === 'function') {
        try { spec.onChange(api.values(), api, meta || {}); } catch (e) {
          if (global.console) console.error('[viz] onChange 실패', e);
        }
      }
    }

    items.forEach(function (item, idx) {
      var name = item.name || ('c' + idx);
      var group = doc.createElement('div');
      group.className = 'dg-controls__group';

      if (item.type === 'button' || item.type === 'reset') {
        var btn = doc.createElement('button');
        btn.type = 'button';
        btn.className = 'dg-btn' + (item.variant === 'primary' ? ' dg-btn--primary' : '');
        btn.textContent = item.label || (item.type === 'reset' ? '초기화' : name);
        if (item.title) btn.title = item.title;
        btn.addEventListener('click', function () {
          if (item.type === 'reset') { api.reset(); return; }
          if (typeof item.onClick === 'function') {
            try { item.onClick(api.values(), api); } catch (e) {
              if (global.console) console.error('[viz] onClick 실패', e);
            }
          }
          fire({ name: name, type: 'button' });
        });
        group.appendChild(btn);
        inputs[name] = btn;
        btn.__item = item;
        wrap.appendChild(group);
        return;
      }

      if (item.type === 'toggle') {
        var lw = doc.createElement('label');
        lw.className = 'dg-controls__row';
        var cb = doc.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!item.value;
        var span = doc.createElement('span');
        span.className = 'dg-controls__label';
        span.textContent = item.label || name;
        lw.appendChild(cb);
        lw.appendChild(span);
        group.appendChild(lw);
        inputs[name] = cb; cb.__item = item;
        defaults[name] = !!item.value;
        values[name] = !!item.value;
        cb.addEventListener('change', function () { syncFrom(name, false); });
        wrap.appendChild(group);
        return;
      }

      if (item.type === 'select') {
        var sid = 'dgc-' + Math.random().toString(36).slice(2, 8);
        var slab = doc.createElement('label');
        slab.className = 'dg-controls__label';
        slab.textContent = item.label || name;
        slab.setAttribute('for', sid);
        var sel = doc.createElement('select');
        sel.id = sid;
        sel.className = 'dg-select';
        (item.options || []).forEach(function (o) {
          var opt = doc.createElement('option');
          var val = (o && typeof o === 'object') ? o.value : o;
          opt.value = String(val);
          opt.textContent = (o && typeof o === 'object') ? (o.label || String(val)) : String(val);
          sel.appendChild(opt);
        });
        if (item.value != null) sel.value = String(item.value);
        group.appendChild(slab);
        group.appendChild(sel);
        inputs[name] = sel; sel.__item = item;
        defaults[name] = sel.value;
        values[name] = sel.value;
        sel.addEventListener('change', function () { syncFrom(name, false); });
        wrap.appendChild(group);
        return;
      }

      // range / number
      var rid = 'dgc-' + Math.random().toString(36).slice(2, 8);
      var rlab = doc.createElement('label');
      rlab.className = 'dg-controls__label';
      rlab.textContent = item.label || name;
      rlab.setAttribute('for', rid);

      var row = doc.createElement('div');
      row.className = 'dg-controls__row';
      var input = doc.createElement('input');
      input.type = item.type === 'number' ? 'number' : 'range';
      input.id = rid;
      input.className = item.type === 'number' ? '' : 'dg-slider';
      if (item.min != null) input.min = String(item.min);
      if (item.max != null) input.max = String(item.max);
      if (item.step != null) input.step = String(item.step);
      input.value = String(item.value != null ? item.value : (item.min != null ? item.min : 0));
      if (item.ariaLabel) input.setAttribute('aria-label', item.ariaLabel);

      var vlab = doc.createElement('output');
      vlab.className = 'dg-slider__value';
      vlab.setAttribute('for', rid);
      vlab.__item = item;

      row.appendChild(input);
      row.appendChild(vlab);
      group.appendChild(rlab);
      group.appendChild(row);

      inputs[name] = input; input.__item = item;
      valueLabels[name] = vlab;
      defaults[name] = coerce(item, input.value);
      values[name] = defaults[name];
      updateLabel(name);

      input.addEventListener('input', function () { syncFrom(name, false); });
      wrap.appendChild(group);
    });

    if (container) {
      // .dg-controls 는 figcaption 앞에 넣습니다 (캡션이 항상 마지막).
      var cap = container.querySelector(':scope > figcaption');
      if (cap) container.insertBefore(wrap, cap);
      else container.appendChild(wrap);
      liveRegion(container);
      if (cap && container.querySelector('.dg-live')) {
        container.insertBefore(container.querySelector('.dg-live'), cap);
      }
    }
    return api;
  }

  function renderReadout(container, list) {
    if (!container) return null;
    var doc = global.document;
    var el = container.querySelector('.dg-readout');
    if (!el) {
      el = doc.createElement('div');
      el.className = 'dg-readout';
      var ctrls = container.querySelector('.dg-controls');
      if (ctrls && ctrls.parentNode === container) container.insertBefore(el, ctrls);
      else {
        var cap = container.querySelector(':scope > figcaption');
        if (cap) container.insertBefore(el, cap); else container.appendChild(el);
      }
    }
    el.innerHTML = (list || []).map(function (it) {
      return '<span>' + esc(it.label) + ' <b>' + esc(it.value) + '</b></span>';
    }).join('');
    return el;
  }

  /* ======================================================================
     등록 · 마운트
     ====================================================================== */
  /**
   * 인터랙티브 다이어그램 초기화 함수 등록.
   * @param {string} id      다이어그램 ID ('D-012')
   * @param {(ctx:object)=>void} initFn
   */
  function register(id, initFn) {
    if (!id || typeof initFn !== 'function') return false;
    registry[String(id).toUpperCase()] = initFn;
    return true;
  }
  function has(id) { return !!registry[String(id || '').toUpperCase()]; }

  function makeCtx(figure, svg, id) {
    var ctx = {
      id: id,
      figure: figure,
      svg: svg,
      reducedMotion: reducedMotion(),
      q: function (name) { return svg.querySelector('[data-dg="' + cssEscape(name) + '"]'); },
      qa: function (name) { return toArray(svg.querySelectorAll('[data-dg="' + cssEscape(name) + '"]')); },
      qs: function (sel) { return svg.querySelector(sel); },
      qsa: function (sel) { return toArray(svg.querySelectorAll(sel)); },
      setState: function (target, state) { return setNodeState(svg, target, state); },
      text: function (name, value) {
        var n = ctx.q(name);
        if (n) n.textContent = value == null ? '' : String(value);
        return n;
      },
      attr: function (name, obj) {
        var nodes = ctx.qa(name);
        nodes.forEach(function (n) {
          for (var k in obj) {
            if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
            if (obj[k] == null) n.removeAttribute(k);
            else n.setAttribute(k, String(obj[k]));
          }
        });
        return nodes;
      },
      move: function (name, x, y) {
        return ctx.attr(name, { transform: 'translate(' + x + ',' + (y || 0) + ')' });
      },
      animateAlong: function (pathSel, opts) { return animateAlong(svg, pathSel, opts); },
      bindControls: function (spec) { return bindControls(figure, spec); },
      announce: function (text) { return announce(figure, text); },
      readout: function (list) { return renderReadout(figure, list); },
      svgEl: function (tag, attrs) {
        var n = global.document.createElementNS(SVG_NS, tag);
        for (var k in (attrs || {})) {
          if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, String(attrs[k]));
        }
        return n;
      }
    };
    return ctx;
  }

  /**
   * figure 안의 인라인 SVG 에 대해 등록된 초기화 함수를 실행합니다.
   * app.js 가 SVG 를 fetch 주입한 직후, 그리고 정적 인라인된 페이지의 DOMContentLoaded 에
   * 호출됩니다. 같은 figure 를 두 번 초기화하지 않습니다.
   */
  function mount(figure) {
    if (!figure || figure.dataset.vizInit === '1') return false;
    var id = (figure.getAttribute('data-diagram') || '').toUpperCase();
    var svg = figure.querySelector('svg');
    if (!svg) return false;
    svg.classList.add('ag-diagram');
    figure.dataset.vizInit = '1';
    var fn = registry[id];
    if (!fn) return false;
    try {
      fn(makeCtx(figure, svg, id));
      return true;
    } catch (e) {
      if (global.console) console.error('[viz] ' + id + ' 초기화 실패', e);
      return false;
    }
  }

  function mountAll(root) {
    var scope = root || global.document;
    if (!scope || !scope.querySelectorAll) return 0;
    var figs = toArray(scope.querySelectorAll('figure.diagram[data-diagram]'));
    var n = 0;
    figs.forEach(function (f) { if (f.querySelector('svg') && mount(f)) n++; });
    return n;
  }

  /* ---------- 공개 -------------------------------------------------------- */
  var api = {
    register: register,
    registerViz: register,   // 명세상의 이름 (별칭)
    has: has,
    mount: mount,
    mountAll: mountAll,
    setNodeState: setNodeState,
    animateAlong: animateAlong,
    bindControls: bindControls,
    announce: announce,
    reducedMotion: reducedMotion,
    SVG_NS: SVG_NS,
    _registry: registry
  };
  global.AG = global.AG || {};
  global.AG.viz = api;
  // 전역 단축 — 명세의 registerViz(id, initFn) 형태를 그대로 지원
  global.registerViz = register;

  /* ==========================================================================
     ────────────────────────── REGISTRY ──────────────────────────
     인터랙티브 다이어그램 로직을 여기에 등록합니다.

     SVG 파일 안에는 <script> 를 넣지 않습니다 (인라인 시 이중 실행·CSP 위반).
     로직은 전부 여기에 두고, SVG 는 data-dg 속성으로 훅만 제공합니다.
     id 셀렉터는 인라인 시 전부 접두사가 붙어 깨지므로 절대 쓰지 마세요.

     등록 예:
       register('D-030', function (ctx) {
         var ctrl = ctx.bindControls({
           items: [{ type: 'range', name: 'az', label: 'AZ 수', min: 1, max: 3, value: 2 }],
           onChange: apply
         });
         function apply(v) {
           ctx.setState('az-2', v.az >= 2 ? 'on' : 'off');
           ctx.announce('가용 영역 ' + v.az + '개 구성입니다.');
         }
         apply(ctrl.values());
       });

     인터랙티브 다이어그램은 docs/DIAGRAM_CATALOG.md 에서 🖱 로 표시합니다.
     시각화 에이전트(V1–V3)가 담당 ID 의 구현을 이 아래에 추가합니다.
     ========================================================================== */

})(typeof window !== 'undefined' ? window : globalThis);
