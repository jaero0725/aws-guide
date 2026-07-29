#!/usr/bin/env node
/* ==========================================================================
   AWS SAA Guide — 다이어그램 정적 인라인 (배포 필수 스텝)
   --------------------------------------------------------------------------
   HTML 의 플레이스홀더

     <figure class="diagram" data-diagram="D-012">
       <figcaption>…</figcaption>
     </figure>

   를 실제 SVG 로 치환합니다.

     <figure class="diagram" data-diagram="D-012" data-dg-inlined="1">
       <div class="dg-scroll"><svg class="ag-diagram" …>…</svg></div>
       <figcaption>…</figcaption>
     </figure>

   왜 정적 치환이 필요한가
     · file:// 로 열면 fetch 가 차단되어 런타임 주입이 실패합니다.
     · 인라인이어야 CSS 변수(다크모드 --dg-*)가 SVG 내부까지 닿습니다.
   app.js 의 런타임 fetch 는 개발 중 폴백일 뿐입니다.

   멱등성
     이미 인라인된 figure 는 SVG 를 **교체**합니다. 두 번 실행해도 SVG 가
     중복되지 않습니다 (.dg-scroll 래퍼와 직속 <svg> 를 모두 제거한 뒤 삽입).

   id 충돌
     인라인된 SVG 의 모든 id 에 `{id소문자}-{페이지내순번}-` 접두어를 붙이고
     href="#…" / url(#…) / aria-labelledby / aria-describedby 참조를 함께 갱신합니다.
     같은 페이지에 같은 다이어그램이 두 번 들어와도 충돌하지 않습니다.

   사용
     node tools/inline-diagrams.mjs            치환 수행
     node tools/inline-diagrams.mjs --check    치환하지 않고 누락만 보고 (CI)
     node tools/inline-diagrams.mjs --revert   인라인된 SVG 를 제거해 플레이스홀더로 되돌림
     node tools/inline-diagrams.mjs --quiet
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DG_DIR = path.join(ROOT, 'assets', 'diagrams');

const argv = process.argv.slice(2);
const CHECK = argv.includes('--check');
const REVERT = argv.includes('--revert');
const QUIET = argv.includes('--quiet');
const log = (...a) => { if (!QUIET) console.log(...a); };

const SKIP_DIRS = new Set(['.git', 'node_modules', 'docs', '.github']);
function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(p, out); }
    else if (/\.html?$/i.test(e.name)) out.push(p);
  }
  return out;
}
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

/* ==========================================================================
   SVG 로딩 · 정규화
   ========================================================================== */
function loadSvgMap() {
  const map = new Map();
  if (!fs.existsSync(DG_DIR)) return map;
  for (const name of fs.readdirSync(DG_DIR)) {
    if (!name.toLowerCase().endsWith('.svg')) continue;
    const m = /^(D-\d{3})-(.+)\.svg$/.exec(name);
    if (!m) continue;
    if (map.has(m[1])) continue;
    map.set(m[1], { file: name, path: path.join(DG_DIR, name) });
  }
  return map;
}

/** <?xml?> / DOCTYPE / 주석 앞부분을 떼고 <svg> 부터 반환 */
function svgBody(text) {
  const i = text.indexOf('<svg');
  if (i < 0) return null;
  const j = text.lastIndexOf('</svg>');
  if (j < 0) return null;
  return text.slice(i, j + 6);
}

/** 루트 <svg> 태그의 속성을 정리: width/height 제거, class 에 ag-diagram 보장 */
function normalizeRootTag(svg) {
  return svg.replace(/^<svg\b([^>]*)>/i, (all, attrs) => {
    let a = attrs
      .replace(/\s(?:width|height)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (/\bclass\s*=\s*"([^"]*)"/i.test(a)) {
      a = a.replace(/\bclass\s*=\s*"([^"]*)"/i, (m2, cls) =>
        /\bag-diagram\b/.test(cls) ? m2 : `class="${cls} ag-diagram"`.replace(/\s+/g, ' '));
    } else if (/\bclass\s*=\s*'([^']*)'/i.test(a)) {
      a = a.replace(/\bclass\s*=\s*'([^']*)'/i, (m2, cls) =>
        /\bag-diagram\b/.test(cls) ? m2 : `class='${cls} ag-diagram'`);
    } else {
      a = 'class="ag-diagram" ' + a;
    }
    return `<svg ${a.trim()}>`;
  });
}

/** SVG 안의 모든 id 와 그 참조에 접두어를 붙입니다. */
function namespaceIds(svg, prefix) {
  const ids = new Set();
  for (const m of svg.matchAll(/\sid\s*=\s*"([^"]+)"/g)) ids.add(m[1]);
  for (const m of svg.matchAll(/\sid\s*=\s*'([^']+)'/g)) ids.add(m[1]);
  if (!ids.size) return svg;

  let out = svg;
  // 1) id 정의
  out = out.replace(/(\sid\s*=\s*")([^"]+)(")/g, (m, a, id, c) =>
    ids.has(id) ? a + prefix + id + c : m);
  out = out.replace(/(\sid\s*=\s*')([^']+)(')/g, (m, a, id, c) =>
    ids.has(id) ? a + prefix + id + c : m);
  // 2) href="#id" / xlink:href="#id"
  out = out.replace(/((?:xlink:)?href\s*=\s*["'])#([^"']+)(["'])/g, (m, a, id, c) =>
    ids.has(id) ? a + '#' + prefix + id + c : m);
  // 3) url(#id)
  out = out.replace(/url\(\s*#([^)\s]+)\s*\)/g, (m, id) =>
    ids.has(id) ? `url(#${prefix}${id})` : m);
  // 4) aria-labelledby / aria-describedby (공백 구분 다중 토큰)
  out = out.replace(/(aria-(?:labelledby|describedby)\s*=\s*")([^"]*)(")/g, (m, a, v, c) =>
    a + v.split(/\s+/).map((t) => (ids.has(t) ? prefix + t : t)).join(' ') + c);
  out = out.replace(/(aria-(?:labelledby|describedby)\s*=\s*')([^']*)(')/g, (m, a, v, c) =>
    a + v.split(/\s+/).map((t) => (ids.has(t) ? prefix + t : t)).join(' ') + c);
  // 5) begin="id.click" 같은 SMIL 참조
  out = out.replace(/(begin\s*=\s*["'])([^."']+)(\.)/g, (m, a, id, d) =>
    ids.has(id) ? a + prefix + id + d : m);
  return out;
}

function indentSvg(svg, indent) {
  return svg.split('\n').map((l, i) => (i === 0 ? indent + l : (l.trim() ? indent + l : l))).join('\n');
}

/* ==========================================================================
   figure 블록 찾기
   ========================================================================== */
/**
 * @returns {Array<{start:number,end:number,openEnd:number,tag:string,id:string,body:string,indent:string}>}
 */
function findFigures(html) {
  const out = [];
  const openRe = /<figure\b[^>]*class\s*=\s*(["'])[^"']*\bdiagram\b[^"']*\1[^>]*>/gi;
  for (const m of html.matchAll(openRe)) {
    const start = m.index;
    const openEnd = start + m[0].length;
    // 중첩 figure 를 고려해 균형 맞춰 닫는 태그 찾기
    let depth = 1, i = openEnd;
    const tokRe = /<\/?figure\b[^>]*>/gi;
    tokRe.lastIndex = openEnd;
    let end = -1, tok;
    while ((tok = tokRe.exec(html))) {
      if (/^<\//.test(tok[0])) { depth--; if (depth === 0) { end = tok.index + tok[0].length; break; } }
      else depth++;
    }
    if (end < 0) continue;
    const idm = /data-diagram\s*=\s*["']([^"']+)["']/i.exec(m[0]);
    // 들여쓰기 추정
    let ls = html.lastIndexOf('\n', start);
    const indent = html.slice(ls + 1, start).match(/^[ \t]*/)[0];
    out.push({
      start, end, openEnd,
      tag: m[0],
      id: idm ? idm[1].toUpperCase() : null,
      body: html.slice(openEnd, end - '</figure>'.length),
      indent
    });
  }
  return out;
}

/** figure 본문에서 기존 인라인 SVG(및 .dg-scroll 래퍼, 안내 박스)를 제거 */
function stripInlined(body) {
  let out = body;
  // .dg-scroll 래퍼 통째로
  out = out.replace(/[ \t]*<div\b[^>]*class\s*=\s*["'][^"']*\bdg-scroll\b[^"']*["'][^>]*>[\s\S]*?<\/div>[ \t]*\n?/gi, '');
  // 직속 <svg>…</svg>
  out = out.replace(/[ \t]*<svg\b[\s\S]*?<\/svg>[ \t]*\n?/gi, '');
  // app.js 가 남긴 안내 박스
  out = out.replace(/[ \t]*<div\b[^>]*class\s*=\s*["'][^"']*\bdiagram__missing\b[^"']*["'][^>]*>[\s\S]*?<\/div>[ \t]*\n?/gi, '');
  // viz.js 가 만든 컨트롤 (정적 파일에 저장되면 안 됨)
  out = out.replace(/[ \t]*<div\b[^>]*class\s*=\s*["'][^"']*\bdg-controls\b[^"']*["'][^>]*>[\s\S]*?<\/div>[ \t]*\n?/gi, '');
  out = out.replace(/[ \t]*<p\b[^>]*class\s*=\s*["'][^"']*\bdg-live\b[^"']*["'][^>]*>[\s\S]*?<\/p>[ \t]*\n?/gi, '');
  out = out.replace(/[ \t]*<div\b[^>]*class\s*=\s*["'][^"']*\bdg-readout\b[^"']*["'][^>]*>[\s\S]*?<\/div>[ \t]*\n?/gi, '');
  return out;
}

/** 여는 태그에 data-dg-inlined 표시를 붙이거나 제거 */
function markTag(tag, on) {
  let t = tag.replace(/\s+data-dg-inlined\s*=\s*["'][^"']*["']/gi, '');
  if (!on) return t;
  return t.replace(/>$/, ' data-dg-inlined="1">');
}

/* ==========================================================================
   실행
   ========================================================================== */
const svgMap = loadSvgMap();
const htmlFiles = walk(ROOT).sort();

let replaced = 0, missing = 0, unchanged = 0, filesChanged = 0, reverted = 0;
const missingList = [];

for (const file of htmlFiles) {
  const original = fs.readFileSync(file, 'utf8');
  const figures = findFigures(original);
  if (!figures.length) continue;

  const perIdCount = new Map();
  let out = original;

  // 뒤에서부터 치환 (앞쪽 인덱스가 밀리지 않게)
  for (let k = figures.length - 1; k >= 0; k--) {
    const fig = figures[k];
    if (!fig.id) continue;

    // 이 다이어그램이 페이지 내 몇 번째인지 (앞에서부터 센 순번)
    let seq = 1;
    for (let j = 0; j < k; j++) if (figures[j].id === fig.id) seq++;

    const hadInline = /<svg\b/i.test(fig.body);
    let newBody = stripInlined(fig.body);
    let newTag = markTag(fig.tag, false);

    // figure 본문의 끝 공백을 정규화합니다. 이걸 하지 않으면 실행마다 빈 줄이 하나씩
    // 늘어나 결과가 바이트 단위로 달라집니다(멱등성 위반).
    newBody = newBody.replace(/\s+$/, '') + '\n' + fig.indent;

    if (REVERT) {
      if (hadInline) reverted++;
      const rebuilt = newTag + newBody + '</figure>';
      out = out.slice(0, fig.start) + rebuilt + out.slice(fig.end);
      continue;
    }

    const entry = svgMap.get(fig.id);
    if (!entry) {
      missing++;
      missingList.push(`${rel(file)}  ${fig.id}  → assets/diagrams/${fig.id}-*.svg 없음`);
      if (!CHECK) {
        const rebuilt = newTag + newBody + '</figure>';
        out = out.slice(0, fig.start) + rebuilt + out.slice(fig.end);
      }
      continue;
    }

    if (CHECK) {
      if (hadInline) unchanged++; else { missing++; missingList.push(`${rel(file)}  ${fig.id}  → 아직 인라인되지 않음`); }
      continue;
    }

    const raw = fs.readFileSync(entry.path, 'utf8');
    let svg = svgBody(raw);
    if (!svg) {
      missing++;
      missingList.push(`${rel(file)}  ${fig.id}  → ${entry.file} 에서 <svg> 를 찾지 못했습니다`);
      continue;
    }
    svg = normalizeRootTag(svg);
    const prefix = fig.id.toLowerCase().replace(/[^a-z0-9-]/g, '') + '-' + seq + '-';
    svg = namespaceIds(svg, prefix);

    const inner = fig.indent + '  ';
    const wrapped = '\n' + inner + '<div class="dg-scroll">\n' +
      indentSvg(svg, inner + '  ') + '\n' + inner + '</div>\n';

    // figcaption 앞에 삽입 (결과가 항상 같은 바이트가 되도록 공백을 정규화)
    const capIdx = newBody.search(/<figcaption\b/i);
    let merged;
    if (capIdx >= 0) {
      const before = newBody.slice(0, capIdx).replace(/\s+$/, '');
      const after = newBody.slice(capIdx).replace(/^\s+/, '').replace(/\s+$/, '');
      merged = before + wrapped + inner + after + '\n' + fig.indent;
    } else {
      merged = wrapped + newBody.replace(/^\s+/, '').replace(/\s+$/, '') + '\n' + fig.indent;
    }

    newTag = markTag(fig.tag, true);
    const rebuilt = newTag + merged + '</figure>';
    out = out.slice(0, fig.start) + rebuilt + out.slice(fig.end);
    replaced++;
  }

  if (!CHECK && out !== original) {
    fs.writeFileSync(file, out, 'utf8');
    filesChanged++;
  }
}

/* ---------- 결과 ---------------------------------------------------------- */
log('AWS SAA Guide — 다이어그램 인라인' + (CHECK ? ' (--check)' : REVERT ? ' (--revert)' : ''));
log(`SVG 파일 ${svgMap.size}개 · HTML ${htmlFiles.length}개`);
if (REVERT) {
  log(`되돌림: ${reverted}건 · 수정 파일 ${filesChanged}개`);
} else if (CHECK) {
  log(`인라인 완료: ${unchanged}건 · 미치환/누락: ${missing}건`);
} else {
  log(`치환: ${replaced}건 · 수정 파일 ${filesChanged}개 · SVG 없음: ${missing}건`);
}
if (missingList.length) {
  log('');
  log('처리하지 못한 항목:');
  for (const m of missingList) log('  ' + m);
}
if (CHECK && missing > 0) {
  log('');
  log('배포 전에 `node tools/inline-diagrams.mjs` 를 실행하세요.');
  process.exit(1);
}
process.exit(0);
