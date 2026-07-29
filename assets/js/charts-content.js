/* ==========================================================================
   AWS SAA Guide — 콘텐츠 차트 등록부 (charts-content.js)

   소유: 차트 에이전트 G1
   범위: C-010 ~ C-099 (본문 챕터·케이스·치트시트에 들어가는 차트)

   이 파일은 charts.js 뒤에 로드됩니다. charts.js 가 마운트를 다음 틱으로
   미루기 때문에, 여기서 동기적으로 register() 를 호출하면 제때 잡힙니다.
   그보다 늦게 등록해도 register() 가 해당 플레이스홀더를 다시 마운트합니다.

   ⚠️ 반드시 지킬 것 (docs/CHART_CATALOG.md §2)
   - 색을 하드코딩하지 마세요. ctx.color(...) / ctx.palette(n) / ctx.pair(i) 만 씁니다.
     하드코딩하면 다크모드에서 보이지 않게 됩니다.
   - a11yTable 을 제공하세요. 캔버스는 스크린 리더에 아무것도 전달하지 못합니다.
     생략하면 charts.js 가 data 에서 자동 생성하지만, 단위·출처가 빠집니다.
   - ★ 요금 금액을 축에 올리지 마세요. 이 환경에서 확인이 구조적으로 불가능합니다.
     비용 비교는 상대 등급(저렴 → 비쌈)이나 범주로 그리고, 캡션에 그 사실을 밝힙니다.
   - 확인하지 못한 수치로 차트를 만들지 마세요 (docs/FACT_SOURCES.md).

   등록 형식:
     AG.charts.register('C-010', function (ctx) {
       return {
         type: 'bar',
         height: 320,
         data: { labels: [...], datasets: [{ label: '...', data: [...],
                 backgroundColor: ctx.palette(4) }] },
         options: { ... },
         a11yCaption: '...',
         a11yTable: { caption: '...', head: [...], rows: [[...]] }
       };
     });

   레퍼런스 구현은 assets/js/charts.js 하단의 C-001 을 보세요.
   ========================================================================== */
(function (global) {
  'use strict';

  var AG = global.AG;
  if (!AG || !AG.charts) return;      // charts.js 가 먼저 로드되지 않았다면 조용히 종료
  var register = AG.charts.register;

  /* ────────────────────────── 여기부터 등록 ──────────────────────────
     G1 이 docs/CHART_CATALOG.md §4 의 C-010 ~ C-099 를 구현합니다.
     아직 비어 있으므로, 본문의 차트 플레이스홀더는 "등록되지 않았습니다"
     상자로 표시됩니다. 이는 Wave 1 이전의 정상 상태입니다.
     ------------------------------------------------------------------ */

  void register;   // 등록이 하나도 없는 동안 린트 잡음을 막기 위한 참조

})(typeof window !== 'undefined' ? window : this);
