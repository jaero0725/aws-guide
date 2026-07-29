/* ==========================================================================
   AWS SAA Guide — 대시보드·결과 차트 등록부 (charts-dash.js)

   소유: 차트 에이전트 G2
   범위: C-100 ~ C-119 (홈 대시보드, 퀴즈 결과 리포트)

   콘텐츠 차트와 달리 이 차트들의 데이터는 **localStorage 진도**에서 옵니다.
   AG.progress 의 공개 API 로만 읽으세요 (localStorage 직접 접근 금지).

     AG.progress.quizStats()            { [qid]: { attempts, correct, streak, lastAt } }
     AG.progress.masteryByDomain(map)   { [domain]: { attempts, correct, questions, pct } }
     AG.progress.exams()                [{ examId, setId, mode, score, total, byDomain, at }]
     AG.progress.diagnostic()           { at, byDomain, plan }
     AG.progress.readList()             string[]
     AG.progress.cardStats()            { [cardId]: { seen, known, streak, graduated } }

   ⚠️ 데이터가 없는 상태를 반드시 처리하세요.
   처음 방문한 사용자는 진도가 0입니다. 빈 차트를 그리지 말고 null 을 반환해
   플레이스홀더가 조용히 비어 있게 하거나, "아직 데이터가 없습니다" 안내를 넣으세요.

   ⚠️ 정답률로 합격 점수를 추정하지 마세요.
   720점은 100~1000 스케일 점수라 정답률과 1:1로 대응하지 않습니다.
   차트 축·범례·캡션 어디에도 "720점 환산" 같은 표기를 두지 않습니다.

   색·접근성 규칙은 charts-content.js 와 같습니다 (docs/CHART_CATALOG.md §2).
   ========================================================================== */
(function (global) {
  'use strict';

  var AG = global.AG;
  if (!AG || !AG.charts) return;      // charts.js 가 먼저 로드되지 않았다면 조용히 종료
  var register = AG.charts.register;

  /* ────────────────────────── 여기부터 등록 ──────────────────────────
     G2 가 docs/CHART_CATALOG.md §4 의 C-100 ~ C-119 를 구현합니다.
     ------------------------------------------------------------------ */

  void register;   // 등록이 하나도 없는 동안 린트 잡음을 막기 위한 참조

})(typeof window !== 'undefined' ? window : this);
