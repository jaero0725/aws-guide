/* ==========================================================================
   AWS SAA Guide — 경량 신택스 하이라이터
   --------------------------------------------------------------------------
   외부 라이브러리 금지이므로 자체 구현합니다. 목표는 "완벽한 파싱"이 아니라
   주석 / 문자열 / 키워드 / 숫자 / 속성명이 구분되어 읽히는 것입니다.

   안전성
     토큰을 잘라낼 때마다 그 조각만 HTML 이스케이프한 뒤 <span>으로 감쌉니다.
     이미 만들어진 HTML 문자열에 정규식을 다시 돌리지 않으므로 마크업이 깨지거나
     사용자 텍스트가 태그로 해석되는 일이 없습니다.

   성능
     언어별 규칙을 sticky(/y) 정규식으로 만들어 위치를 옮겨가며 1패스 스캔합니다.
     공백·식별자 런을 한 번에 소비하는 규칙을 앞에 두어 문자 단위 폴백을 줄였습니다.

   사용
     <pre><code class="lang-java">…</code></pre>
     AG.highlight.run(root)  — root 이하를 처리 (기본값 document)
     지원: java properties bash json yaml sql python javascript xml
           (별칭: js sh shell yml text plaintext none http)
   ========================================================================== */
(function (global) {
  'use strict';

  /* ---------- HTML 이스케이프 -------------------------------------------- */
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return ESC[c]; });
  }

  /* ---------- 규칙 헬퍼 -------------------------------------------------- */
  // cls: CSS 클래스 또는 null(그대로 출력) 또는 함수(매치→클래스)
  function r(src, cls) { return { re: new RegExp(src, 'y'), cls: cls }; }

  function words(list) {
    return '(?:' + list.join('|') + ')\\b';
  }

  var WS = r('[ \\t]+', null);
  var NL = r('\\r?\\n', null);

  /* ---------- 키워드 세트 ------------------------------------------------ */
  var JAVA_KW = ['abstract','assert','boolean','break','byte','case','catch','char','class',
    'const','continue','default','do','double','else','enum','extends','final','finally',
    'float','for','goto','if','implements','import','instanceof','int','interface','long',
    'native','new','package','private','protected','public','record','return','sealed','short',
    'static','strictfp','super','switch','synchronized','this','throw','throws','transient',
    'try','var','void','volatile','while','yield','permits','non-sealed'];
  var JAVA_LIT = ['true','false','null'];

  var JS_KW = ['async','await','break','case','catch','class','const','continue','debugger',
    'default','delete','do','else','export','extends','finally','for','function','get','if',
    'import','in','instanceof','let','new','of','return','set','static','super','switch',
    'this','throw','try','typeof','var','void','while','with','yield'];
  var JS_LIT = ['true','false','null','undefined','NaN','Infinity'];

  var PY_KW = ['and','as','assert','async','await','break','class','continue','def','del',
    'elif','else','except','finally','for','from','global','if','import','in','is','lambda',
    'nonlocal','not','or','pass','raise','return','try','while','with','yield','match','case'];
  var PY_LIT = ['True','False','None','self','cls'];

  var SQL_KW = ['ADD','ALL','ALTER','AND','ANY','AS','ASC','BETWEEN','BY','CASE','CAST',
    'COLUMN','CONSTRAINT','CREATE','CROSS','DELETE','DESC','DISTINCT','DROP','ELSE','EMIT',
    'END','EXISTS','FROM','FULL','GROUP','HAVING','IN','INDEX','INNER','INSERT','INTERVAL',
    'INTO','IS','JOIN','KEY','LEFT','LIKE','LIMIT','NOT','NULL','ON','OR','ORDER','OUTER',
    'PARTITION','PRIMARY','RIGHT','SELECT','SET','STREAM','TABLE','THEN','TUMBLING','UNION',
    'UPDATE','VALUES','VIEW','WHEN','WHERE','WINDOW','WITH','HOPPING','SESSION','CHANGES'];

  var SH_KW = ['if','then','elif','else','fi','for','while','until','do','done','case','esac',
    'function','in','return','break','continue','local','export','readonly','set','unset',
    'source','exit','shift','trap','declare','eval'];

  /* ---------- 언어 규칙 -------------------------------------------------- */
  var LANGS = {};

  LANGS.java = [
    WS, NL,
    r('/\\*[\\s\\S]*?(?:\\*/|$)', 'hl-com'),
    r('//[^\\n]*', 'hl-com'),
    r('"""[\\s\\S]*?(?:"""|$)', 'hl-str'),
    r('"(?:\\\\.|[^"\\\\\\n])*"?', 'hl-str'),
    r("'(?:\\\\.|[^'\\\\\\n])*'?", 'hl-str'),
    r('@[A-Za-z_][A-Za-z0-9_.]*', 'hl-ann'),
    r('\\b0[xX][0-9a-fA-F_]+[lLfFdD]?\\b', 'hl-num'),
    r('\\b\\d[\\d_]*(?:\\.[\\d_]+)?(?:[eE][+-]?\\d+)?[lLfFdD]?\\b', 'hl-num'),
    r(words(JAVA_LIT), 'hl-num'),
    r(words(JAVA_KW), 'hl-key'),
    r('[A-Z][A-Za-z0-9_]*', 'hl-type'),
    r('[a-z_$][A-Za-z0-9_$]*(?=\\s*\\()', 'hl-fn'),
    r('[A-Za-z_$][A-Za-z0-9_$]*', null),
    r('[{}()\\[\\];,.]+', null),
    r('[=+\\-*/%<>!&|^~?:]+', 'hl-punc')
  ];

  LANGS.javascript = [
    WS, NL,
    r('/\\*[\\s\\S]*?(?:\\*/|$)', 'hl-com'),
    r('//[^\\n]*', 'hl-com'),
    r('`(?:\\\\.|[^`\\\\])*`?', 'hl-str'),
    r('"(?:\\\\.|[^"\\\\\\n])*"?', 'hl-str'),
    r("'(?:\\\\.|[^'\\\\\\n])*'?", 'hl-str'),
    r('\\b0[xX][0-9a-fA-F_]+n?\\b', 'hl-num'),
    r('\\b\\d[\\d_]*(?:\\.[\\d_]+)?(?:[eE][+-]?\\d+)?n?\\b', 'hl-num'),
    r(words(JS_LIT), 'hl-num'),
    r(words(JS_KW), 'hl-key'),
    r('[A-Z][A-Za-z0-9_$]*', 'hl-type'),
    r('[A-Za-z_$][A-Za-z0-9_$]*(?=\\s*\\()', 'hl-fn'),
    r('[A-Za-z_$][A-Za-z0-9_$]*(?=\\s*:)', 'hl-prop'),
    r('[A-Za-z_$][A-Za-z0-9_$]*', null),
    r('[{}()\\[\\];,.]+', null),
    r('[=+\\-*/%<>!&|^~?:]+', 'hl-punc')
  ];

  LANGS.python = [
    WS, NL,
    r('#[^\\n]*', 'hl-com'),
    r('[rRbBfFuU]{0,2}"""[\\s\\S]*?(?:"""|$)', 'hl-str'),
    r("[rRbBfFuU]{0,2}'''[\\s\\S]*?(?:'''|$)", 'hl-str'),
    r('[rRbBfFuU]{0,2}"(?:\\\\.|[^"\\\\\\n])*"?', 'hl-str'),
    r("[rRbBfFuU]{0,2}'(?:\\\\.|[^'\\\\\\n])*'?", 'hl-str'),
    r('@[A-Za-z_][A-Za-z0-9_.]*', 'hl-ann'),
    r('\\b0[xXbBoO][0-9a-fA-F_]+\\b', 'hl-num'),
    r('\\b\\d[\\d_]*(?:\\.[\\d_]*)?(?:[eE][+-]?\\d+)?\\b', 'hl-num'),
    r(words(PY_LIT), 'hl-num'),
    r(words(PY_KW), 'hl-key'),
    r('[A-Z][A-Za-z0-9_]*', 'hl-type'),
    r('[A-Za-z_][A-Za-z0-9_]*(?=\\s*\\()', 'hl-fn'),
    r('[A-Za-z_][A-Za-z0-9_]*(?=\\s*=(?!=))', 'hl-prop'),
    r('[A-Za-z_][A-Za-z0-9_]*', null),
    r('[{}()\\[\\];,.]+', null),
    r('[=+\\-*/%<>!&|^~:]+', 'hl-punc')
  ];

  LANGS.properties = [
    NL,
    r('[ \\t]*[#!][^\\n]*', 'hl-com'),
    // 줄 시작의 키 (공백 허용) — 뒤에 = 또는 : 가 오는 경우만
    r('[ \\t]*(?=[^\\s=:#!])(?:[^\\s=:\\n]+)(?=[ \\t]*[=:])', 'hl-prop'),
    r('[ \\t]*[=:][ \\t]*', 'hl-punc'),
    r('\\b(?:true|false|null)\\b', 'hl-num'),
    r('\\b\\d+(?:\\.\\d+)?\\b', 'hl-num'),
    r('[^\\n]+', null)
  ];

  LANGS.bash = [
    WS, NL,
    r('#[^\\n]*', 'hl-com'),
    r('"(?:\\\\.|[^"\\\\])*"?', 'hl-str'),
    r("'[^'\\n]*'?", 'hl-str'),
    r('\\$\\{[^}\\n]*\\}?', 'hl-var'),
    r('\\$[A-Za-z_][A-Za-z0-9_]*', 'hl-var'),
    r('\\$[0-9@*#?!$]', 'hl-var'),
    r('(?:^|(?<=[\\s=]))--?[A-Za-z][A-Za-z0-9-]*', 'hl-flag'),
    r(words(SH_KW), 'hl-key'),
    r('\\b\\d+(?:\\.\\d+)?\\b', 'hl-num'),
    r('[A-Za-z_][A-Za-z0-9_]*(?==)', 'hl-prop'),
    r('[A-Za-z0-9_./~+-]+', null),
    r('[|&;<>()]+', 'hl-punc'),
    r('[=*?\\[\\]{}:,]+', null)
  ];

  LANGS.json = [
    WS, NL,
    r('//[^\\n]*', 'hl-com'),
    r('"(?:\\\\.|[^"\\\\])*"(?=[ \\t]*:)', 'hl-prop'),
    r('"(?:\\\\.|[^"\\\\])*"?', 'hl-str'),
    r('\\b(?:true|false|null)\\b', 'hl-num'),
    r('-?\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b', 'hl-num'),
    r('[{}\\[\\],]+', null),
    r(':', 'hl-punc'),
    r('[^\\s{}\\[\\],:"]+', null)
  ];

  LANGS.yaml = [
    NL,
    r('[ \\t]+', null),
    r('#[^\\n]*', 'hl-com'),
    r('---|\\.\\.\\.', 'hl-punc'),
    r('-(?=[ \\t])', 'hl-punc'),
    r('"(?:\\\\.|[^"\\\\\\n])*"?', 'hl-str'),
    r("'(?:''|[^'\\n])*'?", 'hl-str'),
    r('[&*][A-Za-z0-9_-]+', 'hl-ann'),
    r('![A-Za-z0-9_/!-]+', 'hl-ann'),
    r('[A-Za-z_][\\w.$-]*(?=[ \\t]*:(?:[ \\t]|$))', 'hl-prop'),
    r('"[^"\\n]*"(?=[ \\t]*:)', 'hl-prop'),
    r(':(?=[ \\t]|$)', 'hl-punc'),
    r('\\b(?:true|false|null|yes|no|on|off|~)\\b', 'hl-num'),
    r('\\b\\d+(?:\\.\\d+)?\\b', 'hl-num'),
    r('[|>][+-]?(?=[ \\t]*$)', 'hl-punc'),
    r('\\$\\{[^}\\n]*\\}?', 'hl-var'),
    r('[^\\s#:]+', null),
    r('[:#]', null)
  ];

  LANGS.sql = [
    WS, NL,
    r('--[^\\n]*', 'hl-com'),
    r('/\\*[\\s\\S]*?(?:\\*/|$)', 'hl-com'),
    r("'(?:''|[^'])*'?", 'hl-str'),
    r('"(?:[^"\\n])*"?', 'hl-str'),
    r('`[^`\\n]*`?', 'hl-str'),
    r('\\b\\d+(?:\\.\\d+)?\\b', 'hl-num'),
    { re: new RegExp('[A-Za-z_][A-Za-z0-9_$]*', 'y'), cls: function (m) {
        return SQL_KW.indexOf(m.toUpperCase()) >= 0 ? 'hl-key' : null;
      } },
    r('[(),;.]+', null),
    r('[=<>!+\\-*/%|]+', 'hl-punc')
  ];

  LANGS.xml = [
    NL,
    r('[ \\t]+', null),
    r('<!--[\\s\\S]*?(?:-->|$)', 'hl-com'),
    r('<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>|$)', 'hl-str'),
    r('<[!?][^>\\n]*>?', 'hl-ann'),
    r('</?[A-Za-z_][\\w.:-]*', 'hl-tag'),
    r('/?>', 'hl-tag'),
    r('[A-Za-z_][\\w.:-]*(?==)', 'hl-attr'),
    r('"(?:[^"]*)"?', 'hl-str'),
    r("'(?:[^']*)'?", 'hl-str'),
    r('=', 'hl-punc'),
    r('&[A-Za-z#][\\w]*;', 'hl-num'),
    r('[^<&\\s]+', null),
    r('[<&]', null)
  ];

  /* 별칭 */
  LANGS.js = LANGS.javascript;
  LANGS.ts = LANGS.javascript;
  LANGS.typescript = LANGS.javascript;
  LANGS.sh = LANGS.bash;
  LANGS.shell = LANGS.bash;
  LANGS.console = LANGS.bash;
  LANGS.yml = LANGS.yaml;
  LANGS.props = LANGS.properties;
  LANGS.ini = LANGS.properties;
  LANGS.conf = LANGS.properties;
  LANGS.avro = LANGS.json;
  LANGS.avsc = LANGS.json;
  LANGS.html = LANGS.xml;

  var PLAIN = { text: 1, plaintext: 1, none: 1, log: 1, output: 1, http: 1 };

  /* ---------- 토크나이저 ------------------------------------------------- */
  var MAX_LEN = 200000; // 방어적 상한. 넘으면 이스케이프만 하고 반환

  function tokenize(src, rules) {
    var out = [];
    var i = 0;
    var n = src.length;
    var guard = 0;
    while (i < n) {
      if (++guard > n * 4 + 1000) break; // 무한 루프 방어
      var hit = false;
      for (var k = 0; k < rules.length; k++) {
        var rule = rules[k];
        rule.re.lastIndex = i;
        var m = rule.re.exec(src);
        if (m && m[0].length > 0) {
          var cls = typeof rule.cls === 'function' ? rule.cls(m[0]) : rule.cls;
          out.push(cls ? '<span class="' + cls + '">' + esc(m[0]) + '</span>' : esc(m[0]));
          i += m[0].length;
          hit = true;
          break;
        }
      }
      if (!hit) { out.push(esc(src.charAt(i))); i++; }
    }
    return out.join('');
  }

  /* ---------- 공개 API -------------------------------------------------- */
  function langOf(el) {
    var cls = el.className || '';
    var m = /(?:^|\s)lang(?:uage)?-([A-Za-z0-9_+-]+)/.exec(cls);
    return m ? m[1].toLowerCase() : null;
  }

  function highlightElement(el) {
    if (!el || el.dataset.hlDone === '1') return;
    var lang = langOf(el);
    el.dataset.hlDone = '1';
    var src = el.textContent || '';
    if (!lang || PLAIN[lang] || src.length > MAX_LEN) {
      // 하이라이팅 대상이 아니면 손대지 않습니다 (textContent 유지).
      return;
    }
    var rules = LANGS[lang];
    if (!rules) return;
    try {
      el.innerHTML = tokenize(src, rules);
    } catch (e) {
      el.textContent = src; // 실패 시 원문 복원
      if (global.console) console.warn('[highlight] failed for lang=' + lang, e);
    }
  }

  function run(root) {
    var scope = root || global.document;
    if (!scope || !scope.querySelectorAll) return 0;
    var nodes = scope.querySelectorAll('code[class*="lang-"], code[class*="language-"]');
    for (var i = 0; i < nodes.length; i++) highlightElement(nodes[i]);
    return nodes.length;
  }

  var api = {
    run: run,
    element: highlightElement,
    languages: Object.keys(LANGS).sort(),
    escapeHtml: esc
  };

  global.AG = global.AG || {};
  global.AG.highlight = api;

  /* 자동 실행 */
  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', function () { run(); });
    } else {
      run();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
