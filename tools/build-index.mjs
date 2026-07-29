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
    { id: 'ch01', num: '1',  title: 'AWS 글로벌 인프라와 계정 기초' },
    { id: 'ch02', num: '2',  title: 'IAM과 자격 증명' },
    { id: 'ch03', num: '3',  title: 'VPC 네트워킹 기초' },
    { id: 'ch04', num: '4',  title: 'VPC 연결과 하이브리드' },
    { id: 'ch05', num: '5',  title: 'EC2와 컴퓨트' },
    { id: 'ch06', num: '6',  title: 'EBS와 블록 스토리지' },
    { id: 'ch07', num: '7',  title: '로드 밸런싱과 오토스케일링' },
    { id: 'ch08', num: '8',  title: 'S3와 오브젝트 스토리지' },
    { id: 'ch09', num: '9',  title: '파일 스토리지와 데이터 전송' },
    { id: 'ch10', num: '10', title: 'RDS와 관계형 데이터베이스' },
    { id: 'ch11', num: '11', title: 'NoSQL · 캐시 · 분석 DB' },
    { id: 'ch12', num: '12', title: '서버리스와 애플리케이션 통합' },
    { id: 'ch13', num: '13', title: '컨테이너' },
    { id: 'ch14', num: '14', title: '엣지와 DNS' },
    { id: 'ch15', num: '15', title: '데이터 분석 파이프라인' },
    { id: 'ch16', num: '16', title: '보안 · 암호화 · 거버넌스' },
    { id: 'ch17', num: '17', title: '모니터링 · 운영 · 계정 관리' },
    { id: 'ch18', num: '18', title: '비용 최적화 · 마이그레이션 · DR' }
  ]},
  { id: 'quiz', title: '문제 풀이', pages: [
    { id: 'index',      title: '문제 풀이 허브' },
    { id: 'diagnostic', title: '진단 테스트 (40문항)' },
    { id: 'review',     title: '오답 노트' },
    { id: 'result',     title: '결과 리포트' }
  ]},
  { id: 'saa', title: 'SAA 시험 대비', pages: [
    { id: 'index', title: '시험 개요 · 8주 학습 플랜' },
    /* 도메인 페이지 제목은 SAA-C03 시험 가이드의 공식 명칭이며
       validate.mjs 의 EXAM_DOMAINS.SAA 와 의미가 일치해야 한다. */
    { id: 'domain-secure',      title: '보안 아키텍처 설계 (30%)' },
    { id: 'domain-resilient',   title: '복원력 있는 아키텍처 설계 (26%)' },
    { id: 'domain-performance', title: '고성능 아키텍처 설계 (24%)' },
    { id: 'domain-cost',        title: '비용 최적화 아키텍처 설계 (20%)' },
    { id: 'keywords',   title: '한정어 키워드 사전' },
    { id: 'traps',      title: '함정 사전' },
    { id: 'flashcards', title: '플래시카드' },
    { id: 'cram',       title: '벼락치기 요약' },
    { id: 'exam-tips',  title: '시험 당일 전략' }
  ]},
  { id: 'labs', title: '실습 예제', pages: [
    { id: 'lab01', num: '1',  title: '3계층 VPC 직접 구성' },
    { id: 'lab02', num: '2',  title: 'ALB + ASG 웹 티어' },
    { id: 'lab03', num: '3',  title: 'S3 정적 사이트 + CloudFront + OAC' },
    { id: 'lab04', num: '4',  title: 'RDS Multi-AZ와 읽기 전용 복제본' },
    { id: 'lab05', num: '5',  title: 'DynamoDB 테이블 설계' },
    { id: 'lab06', num: '6',  title: 'Lambda + API Gateway REST API' },
    { id: 'lab07', num: '7',  title: 'SQS + Lambda 비동기 처리' },
    { id: 'lab08', num: '8',  title: 'EventBridge 이벤트 기반 아키텍처' },
    { id: 'lab09', num: '9',  title: 'ECS Fargate 서비스 배포' },
    { id: 'lab10', num: '10', title: 'VPC 엔드포인트로 S3 비공개 접근' },
    { id: 'lab11', num: '11', title: 'KMS 고객 관리형 키 암호화' },
    { id: 'lab12', num: '12', title: 'CloudWatch 알람 + SNS 알림' }
  ]},
  { id: 'cases', title: '아키텍처 케이스', pages: [
    { id: 'case01', num: '1',  title: 'EC2에 액세스 키를 심어 배포했다' },
    { id: 'case02', num: '2',  title: '읽기 부하로 데이터베이스가 죽었다' },
    { id: 'case03', num: '3',  title: 'S3 비용이 매달 늘어난다' },
    { id: 'case04', num: '4',  title: '퍼블릭 서브넷에 데이터베이스를 뒀다' },
    { id: 'case05', num: '5',  title: '단일 AZ 설계가 장애로 전면 중단됐다' },
    { id: 'case06', num: '6',  title: '데이터 전송 요금이 예산을 넘겼다' },
    { id: 'case07', num: '7',  title: '트래픽 급증에 스케일아웃이 못 따라갔다' },
    { id: 'case08', num: '8',  title: '리전 장애에 대비한 DR을 설계하라' },
    { id: 'case09', num: '9',  title: '온프레미스 파일 서버를 클라우드로' },
    { id: 'case10', num: '10', title: '규정 준수 감사에 대응하라' }
  ]},
  { id: 'cheatsheet', title: '빠른참조', pages: [
    { id: 'services',      title: '서비스 한 줄 정의' },
    { id: 'compare',       title: '헷갈리는 쌍 비교' },
    { id: 'limits',        title: '한도 · 기본값' },
    { id: 'decision-tree', title: '서비스 선택 결정 트리' },
    { id: 'security',      title: '보안 · 암호화' },
    { id: 'network',       title: '네트워크 연결' },
    { id: 'cost',          title: '요금 · 비용 절감' }
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
    examCode: 'SAA-C03',
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
