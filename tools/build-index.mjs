#!/usr/bin/env node
/* ==========================================================================
   AWS SAA Guide — 인덱스 생성기 (의존성 0, Node 18+ 내장 모듈만)
   --------------------------------------------------------------------------
   생성물
     data/toc.json                 전체 목차 (사이드바가 소비)
     data/search-index.json        클라이언트 전문 검색 인덱스
     assets/diagrams/index.json    다이어그램 ID → 파일명 매핑

   사용
     node tools/build-index.mjs [--quiet] [--max-text=3000]

   섹션 순서와 제목은 아래 SECTIONS 에 선언합니다. PLAN.md §1 구조와 일치시킵니다.
   아직 만들어지지 않은 페이지도 목차에 넣고 "exists": false 로 표시합니다
   (사이드바가 비활성 항목으로 렌더링하고, validate.mjs 는 예정 경로로 인식합니다).
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const argv = process.argv.slice(2);
const QUIET = argv.includes('--quiet');
const maxTextArg = argv.find((a) => a.startsWith('--max-text='));
let MAX_TEXT = maxTextArg ? parseInt(maxTextArg.split('=')[1], 10) : 6000;
/* 검색 인덱스는 app.js 가 검색을 "열 때" 만 받습니다(부팅 시 아님).
   1.5MB 상한 때문에 66페이지 중 60페이지가 6000자에서 잘려 나가
   'group.instance.id' 같은 롱테일 용어가 검색되지 않았습니다. */
const SIZE_LIMIT = 4 * 1024 * 1024;

const log = (...a) => { if (!QUIET) console.log(...a); };
const read = (p) => fs.readFileSync(p, 'utf8');
const exists = (p) => fs.existsSync(p);

/* ==========================================================================
   사이트 구조 선언 (PLAN.md §1)
   ========================================================================== */
const SECTIONS = [
  { id: 'home', title: '홈', pages: [
    { id: 'index', path: 'index.html', title: 'AWS SAA Guide 홈' }
  ]},
  { id: 'basics', title: '기본개념', pages: [
    { id: 'ch01', num: '1', title: 'Kafka 개요와 이벤트 스트리밍' },
    { id: 'ch02', num: '2', title: '아키텍처와 핵심 개념' },
    { id: 'ch03', num: '3', title: 'KRaft와 클러스터 메타데이터' },
    { id: 'ch04', num: '4', title: 'Producer 심화' },
    { id: 'ch05', num: '5', title: 'Consumer 심화' },
    { id: 'ch06', num: '6', title: '전달 보장과 트랜잭션' },
    { id: 'ch07', num: '7', title: '스토리지·리텐션·컴팩션' },
    { id: 'ch08', num: '8', title: '스키마와 직렬화' },
    { id: 'ch09', num: '9', title: 'Kafka Connect' },
    { id: 'ch10', num: '10', title: 'Kafka Streams와 ksqlDB' },
    { id: 'ch11', num: '11', title: '운영 기초' },
    { id: 'appendix-legacy', num: '부록', title: '버전 표기와 레거시' }
  ]},
  { id: 'quiz', title: '문제 풀이', pages: [
    { id: 'index', title: '문제 풀이 허브' },
    { id: 'diagnostic', title: '진단 테스트 (30문항)' },
    { id: 'review', title: '오답 노트' },
    { id: 'result', title: '결과 리포트' }
  ]},
  { id: 'ccdak', title: 'CCDAK', pages: [
    { id: 'index', title: '개요 · 4주 학습 플랜' },
    { id: 'domain-app-development', title: 'Application Development' },
    { id: 'domain-fundamentals', title: 'Fundamentals' },
    { id: 'domain-connect', title: 'Kafka Connect' },
    { id: 'domain-observability', title: 'Application Observability' },
    { id: 'domain-streams', title: 'Kafka Streams' },
    { id: 'domain-testing', title: 'Application Testing' },
    { id: 'flashcards', title: '플래시카드' },
    { id: 'traps', title: '함정 사전' },
    { id: 'cram', title: '벼락치기 요약' },
    { id: 'exam-tips', title: '시험 당일 전략' }
  ]},
  { id: 'ccaak', title: 'CCAAK', pages: [
    { id: 'index', title: '개요 · 학습 플랜' },
    /* 섹션 이름은 Confluent 블루프린트 확정값이며 validate.mjs 의
       EXAM_DOMAINS.CCAAK 와 문자 단위로 일치해야 한다. 가중치는 공식 확인이
       불가해 표기하지 않는다 (docs/FACT_SOURCES.md §7). */
    { id: 'domain-fundamentals',    title: 'Kafka Fundamentals' },
    { id: 'domain-security',        title: 'Kafka Security' },
    { id: 'domain-connect',         title: 'Kafka Connect' },
    { id: 'domain-deployment',      title: 'Deployment Architecture' },
    { id: 'domain-cluster-config',  title: 'Cluster Configuration' },
    { id: 'domain-observability',   title: 'Observability' },
    { id: 'domain-troubleshooting', title: 'Troubleshooting' },
    { id: 'exam-tips', title: '시험 당일 전략' }
  ]},
  { id: 'practice', title: '실무 예제', pages: [
    { id: 'ex01', num: '1', title: '로컬 KRaft 클러스터 구축' },
    { id: 'ex02', num: '2', title: 'Spring Boot Producer/Consumer' },
    { id: 'ex03', num: '3', title: '안전한 Producer 설정' },
    { id: 'ex04', num: '4', title: '컨슈머 오프셋 전략' },
    { id: 'ex05', num: '5', title: 'Exactly-Once 파이프라인' },
    { id: 'ex06', num: '6', title: 'DLQ + 재시도 패턴' },
    { id: 'ex07', num: '7', title: 'Avro 스키마 진화' },
    { id: 'ex08', num: '8', title: 'Connect CDC 파이프라인' },
    { id: 'ex09', num: '9', title: 'Streams 실시간 집계' },
    { id: 'ex10', num: '10', title: '컨슈머 Lag 모니터링' },
    { id: 'ex11', num: '11', title: 'MirrorMaker 2 복제' },
    { id: 'ex12', num: '12', title: 'Python / Node 클라이언트' }
  ]},
  { id: 'cases', title: '실수 케이스', pages: [
    { id: 'case01', num: '1', title: '배포 후 며칠치 데이터가 사라졌다' },
    { id: 'case02', num: '2', title: '컨슈머가 무한 리밸런스 루프에 빠졌다' },
    { id: 'case03', num: '3', title: '브로커 장애 후 메시지가 유실됐다' },
    { id: 'case04', num: '4', title: '같은 주문의 상태가 뒤바뀌어 저장됐다' },
    { id: 'case05', num: '5', title: '파티션을 1000개로 늘렸더니 더 느려졌다' },
    { id: 'case06', num: '6', title: 'RF=3인데 브로커 1대 죽자 유실됐다' },
    { id: 'case07', num: '7', title: '재처리했더니 결제가 두 번 됐다' },
    { id: 'case08', num: '8', title: '상태 토픽 데이터가 조용히 사라졌다' },
    { id: 'case09', num: '9', title: '스키마 배포 후 전체 컨슈머가 죽었다' },
    { id: 'case10', num: '10', title: '큰 메시지가 무한 재시도로 쌓였다' }
  ]},
  { id: 'cheatsheet', title: '빠른참조', pages: [
    { id: 'cli', title: 'CLI 명령' },
    { id: 'config', title: '설정값' },
    { id: 'metrics', title: 'JMX 메트릭' },
    { id: 'troubleshooting', title: '트러블슈팅 결정 트리' },
    { id: 'security', title: '보안 설정' },
    { id: 'streams', title: 'Streams DSL' },
    { id: 'connect', title: 'Connect REST · SMT' }
  ]}
];

/* ==========================================================================
   HTML 파싱 (경량 — 정규식 기반)
   ========================================================================== */
function stripTags(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePage(file) {
  const html = read(file);
  const titleM = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = titleM ? stripTags(titleM[1]).replace(/\s*—\s*AWS SAA Guide\s*$/, '') : null;
  const descM = /<meta[^>]+name\s*=\s*["']description["'][^>]+content\s*=\s*["']([^"']*)["']/i.exec(html);
  const h1M = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);

  const headings = [];
  for (const m of html.matchAll(/<(h2|h3)\b([^>]*)>([\s\S]*?)<\/\1>/gi)) {
    const idm = /\bid\s*=\s*["']([^"']+)["']/i.exec(m[2]);
    const text = stripTags(m[3]).replace(/\s*#\s*$/, '').trim();
    if (text) headings.push({ level: m[1] === 'h2' ? 2 : 3, id: idm ? idm[1] : null, text });
  }

  /* 본문 텍스트 — <main> 안쪽만 */
  const mainM = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html);
  let body = mainM ? mainM[1] : html;
  // 다이어그램의 title/desc 는 검색되어야 하므로 미리 뽑아 둡니다.
  const dgText = [];
  for (const m of body.matchAll(/<(title|desc)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const t = stripTags(m[2]);
    if (t) dgText.push(t);
  }
  // figcaption 도 포함 (플레이스홀더만 있는 경우의 유일한 설명)
  for (const m of body.matchAll(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/gi)) {
    const t = stripTags(m[1]);
    if (t) dgText.push(t);
  }

  let text = stripTags(body);
  if (dgText.length) text += ' ' + dgText.join(' ');

  return {
    title: title || (h1M ? stripTags(h1M[1]) : null),
    description: descM ? descM[1] : null,
    headings,
    text
  };
}

/* ==========================================================================
   1. data/toc.json
   ========================================================================== */
function buildToc() {
  const sections = SECTIONS.map((sec) => ({
    id: sec.id,
    title: sec.title,
    pages: sec.pages.map((pg) => {
      const p = pg.path || `${sec.id}/${pg.id}.html`;
      const abs = path.join(ROOT, p);
      const ex = exists(abs);
      let title = pg.title;
      if (ex) {
        try {
          const parsed = parsePage(abs);
          if (parsed.title) title = parsed.title.replace(/^\d+장\s*·\s*/, '');
        } catch { /* 유지 */ }
      }
      return {
        id: pg.id,
        path: p,
        title: pg.title,      // 목차 표시는 선언값을 우선 (일관성)
        pageTitle: ex ? title : null,
        num: pg.num || null,
        exists: ex
      };
    })
  }));

  const total = sections.reduce((n, s) => n + s.pages.length, 0);
  const built = sections.reduce((n, s) => n + s.pages.filter((p) => p.exists).length, 0);

  const toc = {
    generatedAt: new Date().toISOString().slice(0, 10),
    kafkaVersion: '4.3',
    total,
    built,
    sections
  };
  const out = path.join(ROOT, 'data', 'toc.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(toc, null, 2) + '\n', 'utf8');
  log(`data/toc.json          ${built}/${total} 페이지 존재`);
  return toc;
}

/* ==========================================================================
   2. data/search-index.json
   ========================================================================== */
function buildSearchIndex(toc) {
  const docs = [];
  for (const sec of toc.sections) {
    for (const pg of sec.pages) {
      if (!pg.exists) continue;
      const abs = path.join(ROOT, pg.path);
      let parsed;
      try { parsed = parsePage(abs); } catch { continue; }
      docs.push({
        path: pg.path,
        title: parsed.title || pg.title,
        section: sec.title,
        description: parsed.description || null,
        headings: parsed.headings.map((h) => h.text),
        anchors: parsed.headings.filter((h) => h.id).map((h) => ({ id: h.id, text: h.text })),
        text: parsed.text
      });
    }
  }

  function serialize(list) {
    return JSON.stringify({
      generatedAt: new Date().toISOString().slice(0, 10),
      count: list.length,
      docs: list
    }) + '\n';
  }

  let payload = serialize(docs);
  if (Buffer.byteLength(payload, 'utf8') > SIZE_LIMIT) {
    log(`  ! 인덱스가 ${(Buffer.byteLength(payload, 'utf8') / 1024 / 1024).toFixed(2)}MB 로 1.5MB 를 넘었습니다.`);
    log(`  ! 본문 텍스트를 페이지당 ${MAX_TEXT}자로 절삭합니다.`);
    for (const d of docs) if (d.text.length > MAX_TEXT) d.text = d.text.slice(0, MAX_TEXT);
    payload = serialize(docs);
    if (Buffer.byteLength(payload, 'utf8') > SIZE_LIMIT) {
      MAX_TEXT = Math.max(800, Math.floor(MAX_TEXT / 2));
      log(`  ! 여전히 초과 — ${MAX_TEXT}자로 재절삭합니다.`);
      for (const d of docs) if (d.text.length > MAX_TEXT) d.text = d.text.slice(0, MAX_TEXT);
      payload = serialize(docs);
    }
  }

  const out = path.join(ROOT, 'data', 'search-index.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, payload, 'utf8');
  log(`data/search-index.json ${docs.length}개 문서 · ${(Buffer.byteLength(payload, 'utf8') / 1024).toFixed(0)}KB`);
  return docs;
}

/* ==========================================================================
   3. assets/diagrams/index.json
   ========================================================================== */
function buildDiagramIndex() {
  const dir = path.join(ROOT, 'assets', 'diagrams');
  fs.mkdirSync(dir, { recursive: true });
  const files = fs.readdirSync(dir).filter((n) => n.toLowerCase().endsWith('.svg')).sort();
  const diagrams = {};
  const meta = {};
  for (const name of files) {
    const m = /^(D-\d{3})-(.+)\.svg$/.exec(name);
    if (!m) { log(`  ! 파일명 규칙 위반: ${name} (건너뜀)`); continue; }
    const id = m[1];
    if (diagrams[id]) { log(`  ! ID 중복: ${id} (${diagrams[id]} 유지, ${name} 무시)`); continue; }
    diagrams[id] = name;
    const svg = read(path.join(dir, name));
    const t = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(svg);
    const d = /<desc\b[^>]*>([\s\S]*?)<\/desc>/i.exec(svg);
    meta[id] = {
      file: name,
      slug: m[2],
      title: t ? stripTags(t[1]) : null,
      desc: d ? stripTags(d[1]) : null,
      interactive: /data-dg\s*=/.test(svg),
      bytes: Buffer.byteLength(svg, 'utf8')
    };
  }
  const out = path.join(dir, 'index.json');
  fs.writeFileSync(out, JSON.stringify({
    generatedAt: new Date().toISOString().slice(0, 10),
    count: Object.keys(diagrams).length,
    diagrams,
    meta
  }, null, 2) + '\n', 'utf8');
  log(`assets/diagrams/index.json  ${Object.keys(diagrams).length}개 다이어그램`);
  return diagrams;
}

/* ==========================================================================
   실행
   ========================================================================== */
log('AWS SAA Guide — 인덱스 생성');
const toc = buildToc();
buildDiagramIndex();
buildSearchIndex(toc);
log('완료');
