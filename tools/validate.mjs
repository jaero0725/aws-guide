#!/usr/bin/env node
/* ==========================================================================
   AWS SAA Guide — 검증기 (의존성 0, Node 18+ 내장 모듈만)
   --------------------------------------------------------------------------
   사용:
     node tools/validate.mjs [--links] [--questions] [--html] [--diagrams] [--all]
                             [--strict] [--deploy] [--quiet]

     --links      HTML 내부 링크 대상 파일·앵커(#id) 존재 확인
     --questions  data/questions/*.json 스키마 검증 (single/multiple/matching/ordering)
     --html       CDN 참조·인라인 style/script·img alt·AWS 최신성·h2/h3 id 검사
     --charts     차트 플레이스홀더 ↔ charts*.js 등록 양방향 일치 검사
     --diagrams   HTML↔SVG 양방향 일치, 하드코딩 색, 접근성 속성, viewBox
     --all        위 전부
     --strict     "아직 생성되지 않은 예정 경로" 경고를 오류로 승격 (Wave 3/4용)
     --deploy     미치환 다이어그램 플레이스홀더를 오류로 취급 (Wave 4 배포 전)
     --quiet      경고를 출력하지 않음

   종료 코드: 오류가 하나라도 있으면 1
   출력 형식: path:line  [ERROR|WARN]  메시지
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/* ---------- 인자 ---------------------------------------------------------- */
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const ALL = has('--all') || argv.filter((a) => a.startsWith('--')).length === 0;
const FLAGS = {
  links: ALL || has('--links'),
  questions: ALL || has('--questions'),
  html: ALL || has('--html'),
  diagrams: ALL || has('--diagrams'),
  charts: ALL || has('--charts'),
  strict: has('--strict'),
  deploy: has('--deploy'),
  quiet: has('--quiet')
};

/* ---------- 리포트 -------------------------------------------------------- */
const problems = [];
function report(level, file, line, msg) {
  problems.push({ level, file, line, msg });
}
const err = (file, line, msg) => report('ERROR', file, line, msg);
const warn = (file, line, msg) => report('WARN', file, line, msg);
/** planned = 계획에 있는 경로이지만 아직 파일이 없음 */
const planned = (file, line, msg) =>
  report(FLAGS.strict ? 'ERROR' : 'WARN', file, line, msg);

/* ---------- 파일 시스템 유틸 ---------------------------------------------- */
const SKIP_DIRS = new Set(['.git', 'node_modules', '.github', 'docs']);
function walk(dir, filter, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name.startsWith('.') && e.name !== '.github') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(p, filter, out);
    } else if (filter(p)) out.push(p);
  }
  return out;
}
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const read = (p) => fs.readFileSync(p, 'utf8');
const exists = (p) => fs.existsSync(p);

function lineAt(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

/* ---------- 계획된 경로 (data/toc.json) ---------------------------------- */
function loadPlannedPaths() {
  const set = new Set();
  const p = path.join(ROOT, 'data', 'toc.json');
  if (!exists(p)) return set;
  try {
    const toc = JSON.parse(read(p));
    for (const sec of toc.sections || []) {
      for (const pg of sec.pages || []) {
        if (pg.path) set.add(pg.path);
      }
    }
  } catch { /* 무시 */ }
  return set;
}
const PLANNED = loadPlannedPaths();

/* ---------- 다이어그램 카탈로그 ID ---------------------------------------- */
function loadCatalogIds() {
  const set = new Set();
  const p = path.join(ROOT, 'docs', 'DIAGRAM_CATALOG.md');
  if (!exists(p)) return set;
  const text = read(p);
  // 명시 ID
  for (const m of text.matchAll(/\bD-(\d{3})\b/g)) set.add('D-' + m[1]);
  // 범위 표기: "D-110 ~ D-119"
  for (const m of text.matchAll(/\bD-(\d{3})\s*~\s*D-(\d{3})\b/g)) {
    const a = parseInt(m[1], 10), b = parseInt(m[2], 10);
    for (let i = a; i <= b; i++) set.add('D-' + String(i).padStart(3, '0'));
  }
  return set;
}
const CATALOG_IDS = loadCatalogIds();

/* ==========================================================================
   1. HTML 품질 (--html)
   ========================================================================== */
const CDN_PATTERNS = [
  { re: /<link[^>]+href\s*=\s*["'](https?:)?\/\//gi, what: '외부 스타일시트/리소스 link' },
  { re: /<script[^>]+src\s*=\s*["'](https?:)?\/\//gi, what: '외부 스크립트' },
  { re: /<img[^>]+src\s*=\s*["'](https?:)?\/\//gi, what: '외부 이미지' },
  { re: /<iframe[^>]+src\s*=\s*["'](https?:)?\/\//gi, what: '외부 iframe' },
  { re: /<source[^>]+src(?:set)?\s*=\s*["'](https?:)?\/\//gi, what: '외부 미디어' },
  { re: /@import\s+(?:url\()?["']?(https?:)?\/\//gi, what: '외부 @import' },
  { re: /url\(\s*["']?(https?:)?\/\/(?!\/)/gi, what: 'CSS url() 외부 참조' }
];

const DUMP_HOSTS = [
  'examtopics', 'validexamdumps', 'pass4success', 'skillcertpro',
  'itexams', 'examcollection', 'certlibrary', 'briefmenow'
];

function checkHtmlQuality(file, text) {
  const f = rel(file);
  const isLegacyAppendix = /basics\/appendix-legacy\.html$/.test(f);

  /* CDN 참조 — 치명 */
  for (const { re, what } of CDN_PATTERNS) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      err(f, lineAt(text, m.index), `외부 리소스 참조 금지 (${what}): ${m[0].slice(0, 80).trim()}`);
    }
  }

  /* 덤프 사이트 참조 — 치명 */
  for (const host of DUMP_HOSTS) {
    const re = new RegExp(host, 'gi');
    for (const m of text.matchAll(re)) {
      err(f, lineAt(text, m.index), `시험 덤프 사이트 참조 금지: "${host}"`);
    }
  }

  /* 인라인 style / script */
  for (const m of text.matchAll(/<style\b[^>]*>/gi)) {
    err(f, lineAt(text, m.index), '인라인 <style> 금지 — assets/css 로 옮기세요');
  }
  for (const m of text.matchAll(/<script\b([^>]*)>/gi)) {
    if (!/\bsrc\s*=/i.test(m[1])) {
      err(f, lineAt(text, m.index), '인라인 <script> 금지 — assets/js 로 옮기세요');
    }
  }
  // style 속성 (다이어그램 폭 지정 등 최소한만 허용 → 경고)
  for (const m of text.matchAll(/\sstyle\s*=\s*["'][^"']*["']/gi)) {
    const idx = m.index;
    // quiz.js 가 만드는 바차트는 런타임 산출물이라 HTML 에는 없어야 정상
    warn(f, lineAt(text, idx), `인라인 style 속성 사용: ${m[0].trim().slice(0, 60)}`);
  }

  /* img alt */
  for (const m of text.matchAll(/<img\b([^>]*)>/gi)) {
    if (!/\balt\s*=/i.test(m[1])) {
      err(f, lineAt(text, m.index), '<img> 에 alt 속성이 없습니다');
    }
  }

  /* ── AWS 최신성 정책 (docs/SERVICE_CURRENCY.md) ────────────────────────
     AWS 는 서비스 이름과 기본 동작이 자주 바뀐다. 시중 한국어 자료 상당수가
     2020~2022년 기준이라, 옛 사실을 "현행"으로 서술하면 그대로 오답이 된다.
     여기서는 **틀린 사실을 현행처럼 쓴 경우만** 잡는다.
     "예전에는 X였지만 지금은 Y다" 처럼 변경 사실을 가르치는 문맥은 허용한다. */
  const OUTDATED_CTX = /이전|과거|예전|였|였습니다|했었|바뀌|변경|더 이상|deprecated|종료|폐기|지원하지 않|은퇴|retired|현재는|지금은|개명|이름이/;

  /* 인라인된 SVG 다이어그램 내부는 이 검사에서 제외한다.
     "구 아키텍처 vs 신 아키텍처"를 나란히 보여주는 비교 다이어그램은 좌측 패널에서
     옛 동작을 그리는 것이 정당한데, 패널 헤더와 설명 <text> 가 서로 다른 줄에 있어
     문맥 윈도우로는 역사적 맥락임을 판별할 수 없다.
     → 다이어그램은 --diagrams 패스에서 별도로 검증하므로 여기서는 건너뛴다. */
  const proseOnly = text.replace(/<svg\b[\s\S]*?<\/svg>/gi, (mm) => ' '.repeat(mm.length));

  if (!isLegacyAppendix) {
    /* (1) S3 최종 일관성 — 2020-12 부터 모든 리전에서 강력한 읽기 후 쓰기 일관성.
           시중 자료가 가장 많이 틀리는 항목이라 ERROR 로 둔다. */
    for (const m of proseOnly.matchAll(/(?:S3|에스쓰리)[^.。\n]{0,60}?(최종 일관성|결과적 일관성|eventual(?:ly)? consistent|eventual consistency)/gi)) {
      const ctx = proseOnly.slice(Math.max(0, m.index - 160), m.index + 220);
      if (OUTDATED_CTX.test(ctx)) continue;
      err(f, lineAt(text, m.index),
        'S3 를 최종 일관성으로 서술했습니다 — 2020년 12월부터 강력한 읽기 후 쓰기 일관성(strong read-after-write consistency)입니다');
    }

    /* (2) EC2-Classic — 2022-08 완전 종료 */
    for (const m of proseOnly.matchAll(/EC2[-\s]?Classic/gi)) {
      const ctx = proseOnly.slice(Math.max(0, m.index - 180), m.index + 180);
      if (OUTDATED_CTX.test(ctx)) continue;
      err(f, lineAt(text, m.index),
        'EC2-Classic 을 사용 가능한 것처럼 서술했습니다 — 2022년 8월 종료되었습니다 (종료 사실을 설명하는 문맥만 허용)');
    }

    /* (3) 개명된 서비스의 옛 이름 — 새 이름 병기 없이 단독 사용하면 경고 */
    const RENAMED = [
      { re: /AWS\s+Single\s+Sign-?On|\bAWS\s+SSO\b/gi, now: 'AWS IAM Identity Center', hint: /IAM\s+Identity\s+Center/i },
      { re: /Amazon\s+Elasticsearch\s+Service/gi,      now: 'Amazon OpenSearch Service', hint: /OpenSearch/i },
      { re: /AWS\s+Server\s+Migration\s+Service|\bAWS\s+SMS\b/gi, now: 'AWS Application Migration Service (MGN)', hint: /Application\s+Migration|MGN/i }
    ];
    for (const { re, now, hint } of RENAMED) {
      re.lastIndex = 0;
      for (const m of proseOnly.matchAll(re)) {
        const ctx = proseOnly.slice(Math.max(0, m.index - 200), m.index + 200);
        if (hint.test(ctx) || OUTDATED_CTX.test(ctx)) continue;
        warn(f, lineAt(text, m.index),
          `"${m[0].trim()}" 은 옛 이름입니다 — 현재 이름은 ${now} 입니다 (병기하거나 새 이름을 쓰세요)`);
      }
    }
  }

  /* h2/h3 id */
  for (const m of text.matchAll(/<(h2|h3)\b([^>]*)>/gi)) {
    if (!/\bid\s*=/i.test(m[2])) {
      warn(f, lineAt(text, m.index), `<${m[1]}> 에 id 가 없습니다 (목차 앵커용) — app.js 가 런타임에 생성하지만 명시를 권장합니다`);
    }
  }

  /* table th scope */
  for (const m of text.matchAll(/<th\b([^>]*)>/gi)) {
    if (!/\bscope\s*=/i.test(m[1])) {
      warn(f, lineAt(text, m.index), '<th> 에 scope 속성이 없습니다');
    }
  }

  /* lang 속성 */
  if (!/<html[^>]+lang\s*=\s*["']ko["']/i.test(text)) {
    warn(f, 1, '<html lang="ko"> 가 아닙니다');
  }

  /* 필수 스타일시트 */
  if (/<main\b/i.test(text)) {
    for (const css of ['tokens.css', 'main.css']) {
      if (!text.includes(css)) warn(f, 1, `assets/css/${css} 를 로드하지 않습니다`);
    }
  }
}

/* ==========================================================================
   2. 링크 (--links)
   ========================================================================== */
const anchorCache = new Map();
function anchorsOf(file) {
  if (anchorCache.has(file)) return anchorCache.get(file);
  const set = new Set();
  if (exists(file)) {
    const t = read(file);
    for (const m of t.matchAll(/\sid\s*=\s*["']([^"']+)["']/g)) set.add(m[1]);
    for (const m of t.matchAll(/<a[^>]+name\s*=\s*["']([^"']+)["']/g)) set.add(m[1]);
  }
  anchorCache.set(file, set);
  return set;
}

function checkLinks(file, text) {
  const f = rel(file);
  const dir = path.dirname(file);

  const attrRe = /<(?:a|link|script|img|source|iframe)\b[^>]*?(?:href|src)\s*=\s*["']([^"']+)["'][^>]*>/gi;
  for (const m of text.matchAll(attrRe)) {
    const raw = m[1].trim();
    const line = lineAt(text, m.index);
    if (!raw) continue;
    if (/^(?:https?:|mailto:|tel:|data:|javascript:|\/\/)/i.test(raw)) continue;

    // href="page.html?mode=exam#anchor" → 쿼리스트링과 프래그먼트를 분리
    const hashAt = raw.indexOf('#');
    const frag = hashAt >= 0 ? raw.slice(hashAt + 1) : '';
    let target = hashAt >= 0 ? raw.slice(0, hashAt) : raw;
    const qAt = target.indexOf('?');
    if (qAt >= 0) target = target.slice(0, qAt);

    /* 같은 페이지 앵커 */
    if (target === '') {
      if (!frag) continue;
      const ids = anchorsOf(file);
      // app.js 가 h2/h3 에 런타임 id 를 붙이므로 미존재는 경고
      if (!ids.has(frag)) warn(f, line, `같은 페이지 앵커 #${frag} 를 찾을 수 없습니다`);
      continue;
    }

    const abs = path.resolve(dir, decodeURIComponent(target));
    const targetRel = rel(abs);

    if (!exists(abs)) {
      if (PLANNED.has(targetRel)) {
        planned(f, line, `아직 생성되지 않은 예정 경로: ${target} (data/toc.json 에 등록됨)`);
      } else {
        err(f, line, `링크 대상 파일이 없습니다: ${target}`);
      }
      continue;
    }

    if (frag && /\.html?$/i.test(abs)) {
      const ids = anchorsOf(abs);
      if (!ids.has(frag)) warn(f, line, `${target} 에 앵커 #${frag} 가 없습니다`);
    }
  }
}

/* ==========================================================================
   3. 다이어그램 (--diagrams)
   ========================================================================== */
function checkDiagrams(htmlFiles) {
  const dgDir = path.join(ROOT, 'assets', 'diagrams');
  const svgFiles = exists(dgDir)
    ? fs.readdirSync(dgDir).filter((n) => n.toLowerCase().endsWith('.svg'))
    : [];

  /* ID → 파일명 */
  const svgById = new Map();
  for (const name of svgFiles) {
    const m = /^(D-\d{3})-(.+)\.svg$/.exec(name);
    if (!m) {
      err('assets/diagrams/' + name, 1,
        '파일명 규칙 위반 — {ID}-{slug}.svg 형식이어야 합니다 (예: D-012-offset-anatomy.svg)');
      continue;
    }
    const id = m[1];
    if (svgById.has(id)) {
      err('assets/diagrams/' + name, 1, `다이어그램 ID 중복: ${id} (이미 ${svgById.get(id)} 가 있습니다)`);
      continue;
    }
    svgById.set(id, name);
    if (CATALOG_IDS.size && !CATALOG_IDS.has(id)) {
      err('assets/diagrams/' + name, 1, `DIAGRAM_CATALOG.md 에 없는 ID: ${id}`);
    }
  }

  /* HTML 의 플레이스홀더 수집 */
  const referenced = new Map(); // id → [{file,line,inlined}]
  for (const file of htmlFiles) {
    const text = read(file);
    const f = rel(file);
    for (const m of text.matchAll(/<figure\b[^>]*class\s*=\s*["'][^"']*\bdiagram\b[^"']*["'][^>]*>/gi)) {
      const tag = m[0];
      const idm = /data-diagram\s*=\s*["']([^"']+)["']/i.exec(tag);
      const line = lineAt(text, m.index);
      if (!idm) {
        err(f, line, 'figure.diagram 에 data-diagram 속성이 없습니다');
        continue;
      }
      const id = idm[1].toUpperCase();
      // figure 닫힘까지 잘라서 인라인 여부 확인
      const after = text.slice(m.index, m.index + 200000);
      const close = after.search(/<\/figure>/i);
      const body = close >= 0 ? after.slice(0, close) : after;
      const inlined = /<svg\b/i.test(body);

      if (!/^D-\d{3}$/.test(id)) {
        err(f, line, `data-diagram 형식 오류: "${idm[1]}" — D-### 형식이어야 합니다`);
      } else if (CATALOG_IDS.size && !CATALOG_IDS.has(id)) {
        err(f, line, `DIAGRAM_CATALOG.md 에 없는 다이어그램 ID: ${id}`);
      }
      if (!referenced.has(id)) referenced.set(id, []);
      referenced.get(id).push({ file: f, line, inlined });

      if (!/<figcaption\b/i.test(body)) {
        warn(f, line, `${id} 플레이스홀더에 <figcaption> 이 없습니다`);
      }
      if (!inlined && FLAGS.deploy) {
        err(f, line, `${id} 플레이스홀더가 인라인되지 않았습니다 — tools/inline-diagrams.mjs 를 실행하세요`);
      }
    }
  }

  /* 양방향 일치 */
  for (const [id, uses] of referenced) {
    if (!svgById.has(id)) {
      const u = uses[0];
      planned(u.file, u.line, `참조된 다이어그램 SVG 가 없습니다: assets/diagrams/${id}-*.svg`);
    }
  }
  for (const [id, name] of svgById) {
    if (!referenced.has(id)) {
      planned('assets/diagrams/' + name, 1,
        `이 SVG 를 참조하는 HTML 플레이스홀더가 없습니다 (고아 파일) — <figure class="diagram" data-diagram="${id}">`);
    }
  }

  /* SVG 내부 규칙 */
  for (const name of svgFiles) {
    const p = path.join(dgDir, name);
    const f = 'assets/diagrams/' + name;
    const text = read(p);

    /* 하드코딩 색 — 치명
       주의: SVG 내부 참조(url(#d030-arrow), href="#d047-lane")는 색이 아니다.
       `#d030` 같은 조각 ID는 4자 hex 패턴과 겹쳐서 이전 구현이 오탐을 냈다.
       그래서 hex 색은 "색을 받는 자리"에서만 찾는다. */
    const COLOR_PROPS = 'fill|stroke|stop-color|color|flood-color|lighting-color';
    const NAMED = 'black|white|red|blue|green|yellow|orange|purple|gray|grey|silver'
                + '|navy|teal|lime|aqua|fuchsia|maroon|olive';
    const colorRes = [
      /* 속성값으로 직접 지정한 hex: fill="#3b82f6" / stroke:'#fff' */
      new RegExp(`\\b(?:${COLOR_PROPS})\\s*[:=]\\s*["']?\\s*#[0-9a-fA-F]{3,8}\\b`, 'gi'),
      /* style="…: #hex" / <style> 안의 선언 */
      new RegExp(`(?:${COLOR_PROPS})\\s*:\\s*#[0-9a-fA-F]{3,8}\\b`, 'gi'),
      /* 명명 색 */
      new RegExp(`\\b(?:${COLOR_PROPS})\\s*[:=]\\s*["']?\\s*(?:${NAMED})\\b`, 'gi'),
      /* 함수형 색 */
      /\brgba?\s*\(/gi,
      /\bhsla?\s*\(/gi
    ];
    for (const re of colorRes) {
      for (const m of text.matchAll(re)) {
        err(f, lineAt(text, m.index),
          `하드코딩 색 금지: "${m[0]}" — viz.css 의 --dg-* 토큰이나 currentColor 를 쓰세요`);
      }
    }

    /* 접근성 */
    if (!/\brole\s*=\s*["']img["']/i.test(text)) err(f, 1, 'SVG 에 role="img" 가 없습니다');
    if (!/<title\b/i.test(text)) err(f, 1, 'SVG 에 <title> 이 없습니다');
    if (!/<desc\b/i.test(text)) err(f, 1, 'SVG 에 <desc> 이 없습니다');
    if (!/\baria-labelledby\s*=/i.test(text) && !/\baria-label\s*=/i.test(text)) {
      err(f, 1, 'SVG 에 aria-labelledby(또는 aria-label) 가 없습니다');
    }

    /* 크기 */
    const svgTag = /<svg\b[^>]*>/i.exec(text);
    if (!svgTag) { err(f, 1, '<svg> 루트 요소를 찾을 수 없습니다'); continue; }
    if (!/\bviewBox\s*=/i.test(svgTag[0])) err(f, 1, '<svg> 에 viewBox 가 없습니다');
    if (/\swidth\s*=\s*["'][^"']*["']/i.test(svgTag[0]))
      err(f, 1, '<svg> 에 width 하드코딩 금지 (반응형) — viewBox 만 쓰세요');
    if (/\sheight\s*=\s*["'][^"']*["']/i.test(svgTag[0]))
      err(f, 1, '<svg> 에 height 하드코딩 금지 (반응형) — viewBox 만 쓰세요');
    if (!/\bclass\s*=\s*["'][^"']*\bag-diagram\b/i.test(svgTag[0]))
      warn(f, 1, '<svg> 에 class="ag-diagram" 이 없습니다');

    const vb = /\bviewBox\s*=\s*["']\s*0\s+0\s+([\d.]+)\s+([\d.]+)/i.exec(svgTag[0]);
    if (vb && Math.abs(parseFloat(vb[1]) - 720) > 0.5) {
      warn(f, 1, `viewBox 폭이 ${vb[1]} 입니다 — 카탈로그 규칙은 720 기준입니다`);
    }

    /* font-family 지정 금지 (CSS 상속) */
    for (const m of text.matchAll(/font-family\s*[:=]/gi)) {
      warn(f, lineAt(text, m.index), 'SVG 안에서 font-family 지정 금지 — CSS 가 상속시킵니다');
    }

    /* 글자 크기: 유틸리티 클래스 사용 권장 */
    for (const m of text.matchAll(/font-size\s*=\s*["']([\d.]+)/gi)) {
      const px = parseFloat(m[1]);
      if (px < 13) {
        err(f, lineAt(text, m.index), `font-size ${px} 는 최소 13 미만입니다 (360px 에서 읽히지 않음)`);
      } else {
        warn(f, lineAt(text, m.index), 'font-size 직접 지정 대신 .dg-fs-sm/.dg-fs-md/.dg-fs-lg 클래스를 쓰세요');
      }
    }

    /* 인라인 script / 외부 이미지 */
    if (/<script\b/i.test(text)) err(f, 1, 'SVG 안에 <script> 금지 — 로직은 assets/js/viz.js 에 registerViz 로 등록하세요');
    if (/<image\b/i.test(text)) err(f, 1, 'SVG 안에 <image> (비트맵 삽입) 금지');
    if (/base64/i.test(text)) err(f, 1, 'SVG 안에 base64 데이터 금지');
    if (/<style\b/i.test(text)) warn(f, 1, 'SVG 안의 <style> 은 인라인 시 페이지 전역에 누출됩니다 — viz.css 토큰/클래스를 쓰세요');

    /* 임의 stroke-width */
    for (const m of text.matchAll(/stroke-width\s*=\s*["']([\d.]+)["']/gi)) {
      const w = parseFloat(m[1]);
      if (![0.75, 1.5, 2.5].includes(w)) {
        warn(f, lineAt(text, m.index),
          `stroke-width="${m[1]}" — --dg-sw-hair(0.75) / --dg-sw-1(1.5) / --dg-sw-2(2.5) 만 사용하세요`);
      }
    }

    /* 크기 상한 */
    const kb = Buffer.byteLength(text, 'utf8') / 1024;
    if (kb > 20) warn(f, 1, `SVG 크기 ${kb.toFixed(1)}KB — 개당 20KB 이하 권장`);
  }

  /* assets/diagrams/index.json 정합성 */
  const idxPath = path.join(dgDir, 'index.json');
  if (exists(idxPath)) {
    let idx;
    try { idx = JSON.parse(read(idxPath)); } catch (e) {
      err('assets/diagrams/index.json', 1, 'JSON 파싱 실패: ' + e.message);
      idx = null;
    }
    if (idx) {
      const map = idx.diagrams && typeof idx.diagrams === 'object' ? idx.diagrams : idx;
      for (const [id, file] of Object.entries(map)) {
        if (typeof file !== 'string') continue;
        if (!exists(path.join(dgDir, file))) {
          err('assets/diagrams/index.json', 1, `${id} → ${file} 파일이 없습니다`);
        }
      }
      for (const id of svgById.keys()) {
        if (!map[id]) warn('assets/diagrams/index.json', 1, `${id} 매핑이 빠졌습니다 — tools/build-index.mjs 를 실행하세요`);
      }
    }
  } else if (svgById.size) {
    warn('assets/diagrams/index.json', 1, 'index.json 이 없습니다 — tools/build-index.mjs 로 생성하세요');
  }

  return { svgById, referenced };
}

/* ==========================================================================
   4. 문제 JSON (--questions)
   ========================================================================== */
/* refs 는 **독자가 열 수 있는 공식 문서 URL** 이어야 한다.
   이 환경에서 우리가 사실을 확인한 경로(botocore, CloudFormation 스펙, GitHub 원본)는
   학습자에게 부적절하므로 refs 에 쓰지 않는다. 확인 경로와 인용 경로를 분리한다.
   자세한 근거는 docs/FACT_SOURCES.md §6. */
const REF_HOSTS = [
  'docs.aws.amazon.com',
  'aws.amazon.com',
  'aws.amazon.com/blogs',
  'aws.amazon.com/architecture',
  'awscli.amazonaws.com'
];
const EXAMS = new Set(['SAA', 'BASICS']);

/* 혼합 세트(모의고사·진단)의 문항별 domain 검사용 공식 도메인 목록.
   진단 모드의 도메인 집계와 학습 순서 생성이 이 문자열과 정확히 일치해야 동작한다.
   SAA-C03 시험 가이드의 공식 도메인 명칭이며 오타는 곧 기능 고장이다. */
const EXAM_DOMAINS = {
  SAA: [
    'Design Secure Architectures',
    'Design Resilient Architectures',
    'Design High-Performing Architectures',
    'Design Cost-Optimized Architectures'
  ]
};

/* SAA-C03 의 실제 문항 유형은 객관식(single)과 복수 응답(multiple) 두 가지뿐이다.
   matching/ordering 은 암기 효율이 좋아 기본개념 확인문제에서 학습용으로만 쓴다.
   시험 세트에 섞이면 "시험에 이런 유형이 나온다"는 잘못된 기대를 만들므로 막는다.
   (PLAN.md §3-2) */
const EXAM_ONLY_TYPES = new Set(['single', 'multiple']);
const DIFFS = new Set(['easy', 'medium', 'hard']);
const TYPES = new Set(['single', 'multiple', 'matching', 'ordering']);
const CHOICE_IDS = new Set(['A', 'B', 'C', 'D', 'E']);

function sentenceCount(s) {
  return String(s).split(/(?<=[.!?。])\s+|(?<=니다\.)\s*|(?<=습니다\.)\s*/)
    .map((x) => x.trim()).filter(Boolean).length;
}

function checkQuestions() {
  const qDir = path.join(ROOT, 'data', 'questions');
  if (!exists(qDir)) {
    warn('data/questions', 1, '디렉터리가 없습니다 (Wave 2 에서 생성됩니다)');
    return;
  }
  const files = fs.readdirSync(qDir)
    .filter((n) => n.endsWith('.json') && n !== 'manifest.json')
    .sort();
  if (!files.length) {
    warn('data/questions', 1, '문제 파일이 없습니다 (Wave 2 에서 생성됩니다)');
    return;
  }

  const globalIds = new Map();   // id → file
  const perSetStats = [];

  for (const name of files) {
    const f = 'data/questions/' + name;
    const p = path.join(qDir, name);
    let set;
    try { set = JSON.parse(read(p)); } catch (e) {
      err(f, 1, 'JSON 파싱 실패: ' + e.message);
      continue;
    }
    const setId = name.replace(/\.json$/, '');

    /* 세트 레벨 */
    for (const k of ['setId', 'title', 'exam', 'domain', 'examCode']) {
      if (!set[k]) err(f, 1, `세트 필수 필드 누락: ${k}`);
    }
    if (set.setId && set.setId !== setId) {
      err(f, 1, `setId("${set.setId}") 가 파일명("${setId}") 과 다릅니다`);
    }
    if (set.exam && !EXAMS.has(set.exam)) err(f, 1, `exam 값이 잘못되었습니다: ${set.exam}`);
    if (!Array.isArray(set.questions) || !set.questions.length) {
      err(f, 1, 'questions 배열이 비어 있습니다');
      continue;
    }

    /* 혼합 세트: 모의고사·진단 테스트는 한 세트 안에 여러 도메인의 문항이 섞인다.
       세트 domain 은 "Mixed" 같은 대표값이고, 도메인별 집계는 문항별 domain 으로 한다. */
    const mixedSet = set.mock === true || set.diagnostic === true ||
                     /^(mixed|혼합)$/i.test(String(set.domain || '').trim()) ||
                     /(?:-mock-\d+|-diagnostic)$/.test(setId);
    if (mixedSet && !set.mock && !set.diagnostic && !/^(mixed|혼합)$/i.test(String(set.domain || '').trim())) {
      warn(f, 1, `혼합 세트로 판단했습니다(setId 규칙). 명시적으로 mock:true 또는 diagnostic:true 를 넣어 주세요`);
    }

    const stats = {
      file: f, setId, exam: set.exam, domain: set.domain, mixed: mixedSet,
      total: set.questions.length,
      diff: { easy: 0, medium: 0, hard: 0 },
      type: { single: 0, multiple: 0, matching: 0, ordering: 0 },
      answerLetters: {}
    };

    set.questions.forEach((q, i) => {
      const at = `${f} [questions[${i}] id=${q && q.id ? q.id : '?'}]`;
      const E = (m) => err(at, 1, m);
      const W = (m) => warn(at, 1, m);
      if (!q || typeof q !== 'object') { E('문항이 객체가 아닙니다'); return; }

      /* 공통 필수 */
      if (!q.id) E('id 누락');
      else if (globalIds.has(q.id)) E(`id 중복: "${q.id}" (이미 ${globalIds.get(q.id)} 에 있습니다)`);
      else globalIds.set(q.id, f);

      if (!q.exam) E('exam 누락');
      else if (!EXAMS.has(q.exam)) E(`exam 값 오류: ${q.exam}`);
      else if (set.exam && q.exam !== set.exam) E(`exam("${q.exam}") 이 세트("${set.exam}") 와 다릅니다`);

      if (!q.domain) E('domain 누락');
      else if (mixedSet) {
        /* 혼합 세트(모의고사·진단): 문항별 domain 이 서로 다른 것이 정상이다.
           대신 시험의 공식 도메인 목록에 있는 값인지 검사한다.
           진단 모드의 도메인별 집계와 결과 리포트가 이 문자열에 의존한다. */
        const known = EXAM_DOMAINS[q.exam];
        if (known && !known.includes(q.domain)) {
          E(`domain("${q.domain}") 이 ${q.exam} 공식 도메인 목록에 없습니다 — ${known.join(' / ')}`);
        }
      }
      else if (set.domain && q.domain !== set.domain) E(`domain("${q.domain}") 이 세트("${set.domain}") 와 다릅니다`);

      if (!q.chapter) E('chapter 누락 — 결과 리포트의 복습 링크가 이 값에 의존합니다');
      else if (!/^ch(?:0[1-9]|1[0-8])$/.test(q.chapter)) {
        E(`chapter 형식 오류: "${q.chapter}" — ch01~ch18`);
      }

      if (!DIFFS.has(q.difficulty)) E(`difficulty 값 오류: ${q.difficulty}`);
      else stats.diff[q.difficulty]++;

      if (!TYPES.has(q.type)) { E(`type 값 오류: ${q.type}`); return; }

      /* SAA-C03 은 객관식·복수 응답 두 유형뿐이다. 시험 세트에 학습용 유형이 섞이면
         "시험에 연결형이 나온다"는 잘못된 기대를 만든다. (PLAN.md §3-2) */
      if (q.exam === 'SAA' && !EXAM_ONLY_TYPES.has(q.type)) {
        E(`type="${q.type}" 는 SAA-C03 시험에 없는 유형입니다 — exam:"SAA" 세트는 single/multiple 만 허용합니다 (학습용 유형은 basics-* 세트에만)`);
      }
      stats.type[q.type]++;

      if (!q.question || typeof q.question !== 'string') E('question 누락');
      else if (q.question.length > 260) W(`question 이 ${q.question.length}자입니다 (200자 이내 권장)`);

      if (q.code != null) {
        if (typeof q.code !== 'object' || !q.code.body) E('code 는 { lang, body } 형태여야 합니다');
        else if (!q.code.lang) W('code.lang 이 없습니다');
      }

      if (!q.explanation || typeof q.explanation !== 'string') E('explanation 누락');
      else {
        const n = sentenceCount(q.explanation);
        if (n < 3) W(`explanation 이 ${n}문장입니다 (3~6문장 규칙)`);
        if (n > 7) W(`explanation 이 ${n}문장입니다 (3~6문장 규칙)`);
        if (q.question && q.explanation.includes(q.question.slice(0, 25))) {
          W('explanation 이 question 을 그대로 반복합니다');
        }
      }

      if (!Array.isArray(q.refs) || !q.refs.length) E('refs 가 최소 1개 필요합니다');
      else {
        q.refs.forEach((r, ri) => {
          if (!r || !r.url) { E(`refs[${ri}].url 누락`); return; }
          const ok = REF_HOSTS.some((h) => r.url.includes(h));
          if (!ok) E(`refs[${ri}] 는 공식 문서 URL 이어야 합니다: ${r.url}`);
          for (const bad of DUMP_HOSTS) {
            if (r.url.toLowerCase().includes(bad)) E(`refs[${ri}] 덤프 사이트 참조 금지: ${r.url}`);
          }
          if (!r.title) W(`refs[${ri}].title 누락`);
        });
      }

      if (!Array.isArray(q.tags) || q.tags.length < 2) E('tags 는 2~5개 필요합니다');
      else {
        if (q.tags.length > 5) W(`tags 가 ${q.tags.length}개입니다 (2~5개)`);
        q.tags.forEach((t) => {
          if (typeof t !== 'string' || !t) E('tags 항목이 비어 있습니다');
        });
      }

      const notes = (q.distractorNotes && typeof q.distractorNotes === 'object') ? q.distractorNotes : null;
      if (!notes) E('distractorNotes 누락');

      /* ---- 유형별 ---- */
      if (q.type === 'single' || q.type === 'multiple') {
        if (q.pairs) E(`type=${q.type} 에 pairs 가 있습니다 (matching 전용)`);
        if (q.items) E(`type=${q.type} 에 items 가 있습니다 (ordering 전용)`);
        if (!Array.isArray(q.choices)) { E('choices 누락'); return; }
        const n = q.choices.length;
        if (q.type === 'single' && n !== 4) E(`single 은 choices 가 정확히 4개여야 합니다 (현재 ${n})`);
        if (q.type === 'multiple' && (n < 4 || n > 5)) E(`multiple 은 choices 가 4~5개여야 합니다 (현재 ${n})`);

        const ids = new Set();
        q.choices.forEach((c, ci) => {
          if (!c || !c.id) { E(`choices[${ci}].id 누락`); return; }
          if (!CHOICE_IDS.has(c.id)) E(`choices[${ci}].id 는 A~E 여야 합니다: ${c.id}`);
          if (ids.has(c.id)) E(`choices id 중복: ${c.id}`);
          ids.add(c.id);
          if (!c.text) E(`choices[${ci}].text 누락`);
        });

        if (!Array.isArray(q.answer) || !q.answer.length) E('answer 누락');
        else {
          if (q.type === 'single' && q.answer.length !== 1) E(`single 은 answer 가 1개여야 합니다 (현재 ${q.answer.length})`);
          if (q.type === 'multiple' && q.answer.length < 2) E('multiple 은 answer 가 2개 이상이어야 합니다');
          q.answer.forEach((a) => { if (!ids.has(a)) E(`answer "${a}" 가 choices 에 없습니다`); });
          if (new Set(q.answer).size !== q.answer.length) E('answer 에 중복이 있습니다');
        }

        if (q.type === 'multiple' && q.question && !/\(\s*\d+\s*개\s*선택\s*\)/.test(q.question)) {
          W('multiple 문항은 문제문에 "(2개 선택)" 처럼 개수를 명시해야 합니다');
        }

        /* 모든 오답에 distractorNotes */
        if (notes && Array.isArray(q.answer)) {
          q.choices.forEach((c) => {
            if (!c || !c.id) return;
            if (q.answer.includes(c.id)) return;
            if (!notes[c.id]) E(`오답 선택지 ${c.id} 의 distractorNotes 가 없습니다`);
          });
          Object.keys(notes).forEach((k) => {
            if (!ids.has(k)) W(`distractorNotes 키 "${k}" 가 choices 에 없습니다`);
          });
        }

        /* 선택지 길이 편차 */
        const lens = q.choices.map((c) => (c && c.text ? c.text.length : 0));
        if (Array.isArray(q.answer) && q.answer.length === 1 && lens.length >= 4) {
          const ansIdx = q.choices.findIndex((c) => c && c.id === q.answer[0]);
          if (ansIdx >= 0) {
            const others = lens.filter((_, k) => k !== ansIdx);
            const maxOther = Math.max(...others);
            if (lens[ansIdx] > maxOther * 1.9 && lens[ansIdx] - maxOther > 25) {
              W('정답 선택지가 다른 선택지보다 지나치게 깁니다 (패턴으로 맞힐 수 있음)');
            }
          }
        }
        if (Array.isArray(q.answer) && q.answer.length === 1) {
          stats.answerLetters[q.answer[0]] = (stats.answerLetters[q.answer[0]] || 0) + 1;
        }

      } else if (q.type === 'matching') {
        if (q.choices) E('matching 에 choices 가 있습니다 (single/multiple 전용)');
        if (q.items) E('matching 에 items 가 있습니다 (ordering 전용)');
        if (q.answer) W('matching 은 answer 필드를 쓰지 않습니다 (pairs[].right 가 정답)');
        if (!Array.isArray(q.pairs)) { E('pairs 누락'); return; }
        if (q.pairs.length < 3 || q.pairs.length > 6) {
          E(`pairs 는 3~6개여야 합니다 (현재 ${q.pairs.length})`);
        }
        const pIds = new Set(), rights = new Set();
        q.pairs.forEach((pr, pi) => {
          if (!pr || typeof pr !== 'object') { E(`pairs[${pi}] 가 객체가 아닙니다`); return; }
          if (!pr.id) E(`pairs[${pi}].id 누락`);
          else if (pIds.has(pr.id)) E(`pairs id 중복: ${pr.id}`);
          else pIds.add(pr.id);
          if (!pr.left) E(`pairs[${pi}].left 누락`);
          if (pr.right == null || pr.right === '') E(`pairs[${pi}].right 누락`);
          else if (rights.has(String(pr.right))) {
            E(`pairs[${pi}].right 값 중복: "${pr.right}" — 두 left 가 같은 right 를 가질 수 없습니다`);
          } else rights.add(String(pr.right));
        });
        if (q.extraRights != null) {
          if (!Array.isArray(q.extraRights)) E('extraRights 는 배열이어야 합니다');
          else {
            q.extraRights.forEach((v, vi) => {
              if (v == null || v === '') { E(`extraRights[${vi}] 가 비어 있습니다`); return; }
              if (rights.has(String(v))) {
                E(`extraRights[${vi}] "${v}" 가 정답 right 와 겹칩니다 — 미끼는 정답과 달라야 합니다`);
              }
            });
            if (new Set(q.extraRights.map(String)).size !== q.extraRights.length) {
              W('extraRights 에 중복이 있습니다');
            }
          }
        } else {
          W('extraRights 가 없습니다 — 1:1 대응으로 답을 역추론할 수 있으므로 1~3개 넣는 것을 권장합니다');
        }
        if (notes) {
          Object.keys(notes).forEach((k) => {
            if (!pIds.has(k)) W(`distractorNotes 키 "${k}" 가 pairs id 에 없습니다`);
          });
          if (!Object.keys(notes).length) W('matching 의 distractorNotes 가 비어 있습니다 — 혼동하기 쉬운 쌍은 설명하세요');
        }

      } else if (q.type === 'ordering') {
        if (q.choices) E('ordering 에 choices 가 있습니다');
        if (q.pairs) E('ordering 에 pairs 가 있습니다');
        if (!Array.isArray(q.items)) { E('items 누락'); return; }
        if (q.items.length < 4 || q.items.length > 6) {
          E(`items 는 4~6개여야 합니다 (현재 ${q.items.length})`);
        }
        const iIds = new Set();
        q.items.forEach((it, ii) => {
          if (!it || typeof it !== 'object') { E(`items[${ii}] 가 객체가 아닙니다`); return; }
          if (!it.id) E(`items[${ii}].id 누락`);
          else if (iIds.has(it.id)) E(`items id 중복: ${it.id}`);
          else iIds.add(it.id);
          if (!it.text) E(`items[${ii}].text 누락`);
        });
        if (!Array.isArray(q.answer)) E('answer 누락 (정답 순서의 item id 배열)');
        else {
          if (q.answer.length !== q.items.length) {
            E(`answer 개수(${q.answer.length}) 가 items 개수(${q.items.length}) 와 다릅니다`);
          }
          if (new Set(q.answer).size !== q.answer.length) E('answer 에 중복 id 가 있습니다');
          q.answer.forEach((a) => { if (!iIds.has(a)) E(`answer "${a}" 가 items 에 없습니다`); });
          const asIs = q.items.map((it) => it && it.id).join('|');
          if (asIs === q.answer.join('|')) {
            W('items 배열이 정답 순서 그대로입니다 — 데이터 유출을 피해 섞어서 저장하세요');
          }
        }
        if (notes) {
          Object.keys(notes).forEach((k) => {
            if (!iIds.has(k)) W(`distractorNotes 키 "${k}" 가 items id 에 없습니다`);
          });
        }
      }
    });

    perSetStats.push(stats);
  }

  /* 세트 통계 경고 */
  for (const s of perSetStats) {
    const t = s.total;
    if (t >= 10) {
      const want = { easy: 0.3, medium: 0.5, hard: 0.2 };
      for (const k of ['easy', 'medium', 'hard']) {
        const got = s.diff[k] / t;
        if (Math.abs(got - want[k]) > 0.2) {
          warn(s.file, 1, `difficulty 비율 편중: ${k} ${(got * 100).toFixed(0)}% (목표 ${want[k] * 100}%, 3:5:2)`);
        }
      }
      const singles = Object.values(s.answerLetters).reduce((a, b) => a + b, 0);
      if (singles >= 8) {
        for (const L of ['A', 'B', 'C', 'D']) {
          const c = s.answerLetters[L] || 0;
          const p = c / singles;
          if (p < 0.1 || p > 0.45) {
            warn(s.file, 1, `single 정답 분포 편중: ${L} ${(p * 100).toFixed(0)}% (${c}/${singles}) — 20~30% 권장`);
          }
        }
      }
      if (s.type.matching === 0) warn(s.file, 1, 'matching 유형 문항이 없습니다 — 실제 시험에 출제됩니다');
      if (s.type.ordering === 0) warn(s.file, 1, 'ordering(list order) 유형 문항이 없습니다 — 실제 시험에 출제됩니다');
    }
  }

  /* manifest 정합성 */
  const manPath = path.join(qDir, 'manifest.json');
  if (exists(manPath)) {
    let man;
    try { man = JSON.parse(read(manPath)); } catch (e) {
      err('data/questions/manifest.json', 1, 'JSON 파싱 실패: ' + e.message);
    }
    if (man) {
      const listed = new Set();
      (man.sets || []).forEach((s, i) => {
        if (!s.setId) { err('data/questions/manifest.json', 1, `sets[${i}].setId 누락`); return; }
        listed.add(s.setId);
        const fp = path.join(qDir, s.file || (s.setId + '.json'));
        if (!exists(fp)) err('data/questions/manifest.json', 1, `sets[${i}] 파일이 없습니다: ${s.file || s.setId}`);
        else {
          const real = perSetStats.find((x) => x.setId === s.setId);
          if (real && s.count != null && s.count !== real.total) {
            err('data/questions/manifest.json', 1,
              `sets[${i}] count(${s.count}) 가 실제 문항 수(${real.total}) 와 다릅니다`);
          }
        }
      });
      for (const s of perSetStats) {
        if (!listed.has(s.setId)) {
          planned('data/questions/manifest.json', 1, `${s.setId} 가 manifest 에 없습니다 (B6 이 생성)`);
        }
      }
    }
  } else if (perSetStats.length) {
    planned('data/questions/manifest.json', 1, 'manifest.json 이 없습니다 — 퀴즈 허브가 세트 목록을 찾지 못합니다 (Wave 2 B6)');
  }
}

/* ==========================================================================
   5. 차트 (--charts)
   --------------------------------------------------------------------------
   다이어그램과 같은 분리 구조를 쓴다. 콘텐츠는 플레이스홀더만 두고,
   실제 스펙은 assets/js/charts*.js 의 register('C-###', …) 가 제공한다.
   양쪽이 어긋나면 페이지에 "등록되지 않았습니다" 상자가 그대로 배포된다.
   ========================================================================== */
function checkCharts(htmlFiles) {
  /* (a) 등록된 ID 수집 — charts.js 및 charts-*.js */
  const jsDir = path.join(ROOT, 'assets', 'js');
  const registered = new Map();          // 'C-001' → 파일명
  if (fs.existsSync(jsDir)) {
    for (const name of fs.readdirSync(jsDir).sort()) {
      if (!/^charts.*\.js$/.test(name)) continue;
      const text = read(path.join(jsDir, name));
      /* 주석 안의 사용 예시(register('C-010', …))를 실제 등록으로 오인하지 않도록
         블록·행 주석을 공백으로 치환한 뒤 스캔한다. 길이를 보존해야 lineAt 이 맞는다. */
      const code = text
        .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
        .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
      for (const m of code.matchAll(/\bregister(?:Chart)?\s*\(\s*['"](C-\d{3})['"]/g)) {
        const id = m[1].toUpperCase();
        if (registered.has(id)) {
          err('assets/js/' + name, lineAt(text, m.index),
            `차트 ID 중복: ${id} (이미 ${registered.get(id)} 에 있습니다)`);
        } else {
          registered.set(id, 'assets/js/' + name);
        }
      }
    }
  }

  /* (b) HTML 플레이스홀더 */
  const referenced = new Set();
  const figRe = /<figure\b[^>]*class\s*=\s*["'][^"']*\bchart\b[^"']*["'][^>]*>/gi;
  for (const file of htmlFiles) {
    const f = rel(file);
    const text = read(file);
    for (const m of text.matchAll(figRe)) {
      const line = lineAt(text, m.index);
      const close = text.indexOf('</figure>', m.index);
      const body = close < 0 ? '' : text.slice(m.index, close);

      const idm = /data-chart\s*=\s*["']([^"']+)["']/i.exec(m[0]);
      if (!idm) { err(f, line, 'figure.chart 에 data-chart 속성이 없습니다'); continue; }
      const raw = idm[1].trim().toUpperCase();
      if (!/^C-\d{3}$/.test(raw)) {
        err(f, line, `data-chart 형식 오류: "${idm[1]}" — C-### 형식이어야 합니다`);
        continue;
      }
      referenced.add(raw);

      if (!/<figcaption/i.test(body)) {
        warn(f, line, `${raw} 차트에 <figcaption> 이 없습니다 — 캔버스는 스크린 리더에 읽히지 않으므로 캡션이 정보의 정본입니다`);
      }
      if (!registered.has(raw)) {
        err(f, line, `${raw} 가 assets/js/charts*.js 에 등록되지 않았습니다 — 페이지에 "등록되지 않았습니다" 상자가 그대로 노출됩니다`);
      }
      /* 캔버스를 직접 쓰면 charts.js 의 생성 경로와 충돌한다 */
      if (/<canvas\b/i.test(body)) {
        err(f, line, `${raw} 플레이스홀더에 <canvas> 를 직접 쓰지 마세요 — charts.js 가 생성합니다`);
      }
    }
  }

  /* (c) 고아 등록 — 아무 페이지도 참조하지 않는 차트 */
  for (const [id, where] of registered) {
    if (!referenced.has(id)) {
      planned(where, 1,
        `${id} 등록만 있고 이 차트를 참조하는 HTML 플레이스홀더가 없습니다 — <figure class="chart" data-chart="${id}">`);
    }
  }
}

/* ==========================================================================
   실행
   ========================================================================== */
const htmlFiles = walk(ROOT, (p) => /\.html?$/i.test(p)).sort();

if (FLAGS.html || FLAGS.links) {
  for (const file of htmlFiles) {
    const text = read(file);
    if (FLAGS.html) checkHtmlQuality(file, text);
    if (FLAGS.links) checkLinks(file, text);
  }
}
if (FLAGS.diagrams) checkDiagrams(htmlFiles);
if (FLAGS.charts) checkCharts(htmlFiles);
if (FLAGS.questions) checkQuestions();

/* ---------- 출력 ---------------------------------------------------------- */
const errors = problems.filter((p) => p.level === 'ERROR');
const warns = problems.filter((p) => p.level === 'WARN');

problems.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1));
for (const p of problems) {
  if (p.level === 'WARN' && FLAGS.quiet) continue;
  const tag = p.level === 'ERROR' ? 'ERROR' : 'WARN ';
  console.log(`${p.file}:${p.line}  ${tag}  ${p.msg}`);
}

const parts = [];
if (FLAGS.links) parts.push('links');
if (FLAGS.questions) parts.push('questions');
if (FLAGS.html) parts.push('html');
if (FLAGS.diagrams) parts.push('diagrams');
if (FLAGS.charts) parts.push('charts');

console.log('');
console.log(`검사 대상: ${parts.join(', ')} · HTML ${htmlFiles.length}개`);
console.log(`결과: 오류 ${errors.length}건, 경고 ${warns.length}건` +
  (FLAGS.strict ? ' (--strict)' : '') + (FLAGS.deploy ? ' (--deploy)' : ''));
if (!FLAGS.strict && warns.length) {
  console.log('힌트: 아직 생성되지 않은 예정 경로는 경고로 처리됩니다. --strict 로 오류 승격.');
}
process.exit(errors.length ? 1 : 0);
