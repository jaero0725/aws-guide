/* ==========================================================================
   AWS SAA Guide — 대시보드·결과 차트 등록부 (charts-dash.js)

   소유: 차트 에이전트 G2
   범위: C-002 ~ C-005 (시험·학습 플랜) · C-100 ~ C-119 (홈 대시보드, 퀴즈 결과 리포트)
   ※ C-001 은 charts.js 하단에 이미 등록되어 있습니다 (레퍼런스 구현). 여기서 다시 등록하지 않습니다.

   콘텐츠 차트와 달리 C-1xx 의 데이터는 **localStorage 진도**에서 옵니다.
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

  /* ======================================================================
     공용 헬퍼
     ====================================================================== */

  /** 진도 API. progress.js 가 없으면 null (차트는 조용히 비워 둡니다). */
  function P() {
    return (global.AG && global.AG.progress) ? global.AG.progress : null;
  }

  /** charts.js 가 계산해 둔 사이트 루트. 페이지 깊이와 무관하게 자원 경로가 맞아야 합니다. */
  function root() {
    return (global.AG && global.AG.__root) ? global.AG.__root : './';
  }

  /** 실패해도 차트가 "생성 실패" 상자를 띄우지 않도록 null 로 흡수합니다. */
  function fetchJSON(rel) {
    return fetch(root() + rel, { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  function pct(n, d) { return d > 0 ? Math.round((n / d) * 100) : 0; }

  /* SAA-C03 도메인 — 가중치는 공식 시험 가이드 확정값 (PLAN.md §0 · FACT_SOURCES.md §4.14).
     quiz.js 의 SAA_DOMAINS · home.js 의 SAA_WEIGHT 와 같은 키를 씁니다. */
  var SAA = [
    { name: 'Design Secure Architectures', ko: '보안 아키텍처 설계', weight: 30 },
    { name: 'Design Resilient Architectures', ko: '복원력 있는 아키텍처 설계', weight: 26 },
    { name: 'Design High-Performing Architectures', ko: '고성능 아키텍처 설계', weight: 24 },
    { name: 'Design Cost-Optimized Architectures', ko: '비용 최적화 아키텍처 설계', weight: 20 }
  ];
  var SAA_BY_NAME = {};
  SAA.forEach(function (d) { SAA_BY_NAME[d.name] = d; });

  var TIER = {
    focus: { label: '집중 학습', kind: 'danger' },
    reinforce: { label: '보강', kind: 'warn' },
    maintain: { label: '유지', kind: 'ok' }
  };
  function tierOf(p) { return p < 60 ? 'focus' : (p < 80 ? 'reinforce' : 'maintain'); }

  /**
   * 문항 id → SAA 도메인.
   * 도메인 연습 세트(mock·diagnostic 아님)의 setId 접두사로만 판정합니다.
   * 모의고사·진단 문항은 세트가 혼합 구성이라 여기서 null 이 되고,
   * 대신 시험 이력의 byDomain 으로 더합니다 (home.js 와 같은 규약 — 이중 집계 방지).
   */
  function makeDomainResolver(manifest) {
    var prefixes = ((manifest && manifest.sets) || [])
      .filter(function (s) {
        return s.exam === 'SAA' && !s.mock && !s.diagnostic && SAA_BY_NAME[s.domain];
      })
      .map(function (s) { return { p: s.setId + '-', d: s.domain }; })
      .sort(function (a, b) { return b.p.length - a.p.length; });

    return function (id) {
      for (var i = 0; i < prefixes.length; i++) {
        if (String(id).indexOf(prefixes[i].p) === 0) return prefixes[i].d;
      }
      return null;
    };
  }

  function isMixedExam(e) {
    return /mock|diagnostic/.test(String(e.setId || '') + ' ' + String(e.mode || ''));
  }

  /** 도메인별 { correct, attempts, pct } — 도메인 연습 + 혼합 세트 응시 이력의 합계 */
  function domainTotals(p, manifest) {
    var acc = {};
    function bucket(d) {
      if (!acc[d]) acc[d] = { correct: 0, attempts: 0 };
      return acc[d];
    }
    var m = p.masteryByDomain(makeDomainResolver(manifest));
    Object.keys(m).forEach(function (d) {
      if (!SAA_BY_NAME[d]) return;
      var b = bucket(d);
      b.correct += m[d].correct;
      b.attempts += m[d].attempts;
    });
    p.exams().filter(isMixedExam).forEach(function (e) {
      var bd = e.byDomain || {};
      Object.keys(bd).forEach(function (d) {
        if (!SAA_BY_NAME[d]) return;
        var b = bucket(d);
        b.correct += +bd[d].correct || 0;
        b.attempts += +bd[d].total || 0;
      });
    });
    Object.keys(acc).forEach(function (d) { acc[d].pct = pct(acc[d].correct, acc[d].attempts); });
    return acc;
  }

  /** 읽음 목록 조회용 집합. app.js 의 pageId 규약(`섹션/페이지`, 홈은 `index`)을 모두 받습니다. */
  function readSetOf(p) {
    var set = Object.create(null);
    p.readList().forEach(function (id) { set[id] = true; });
    return set;
  }
  function isPageRead(set, sectionId, pageId) {
    return !!(set[sectionId + '/' + pageId] || (sectionId === 'home' && set[pageId]));
  }

  function ymd(d) {
    return d.getFullYear() + '-' +
      ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function mmdd(key) { return key.slice(5).replace('-', '/'); }

  /* ==========================================================================
     ─────────────────── C-002 ~ C-005 · 시험 · 학습 플랜 ───────────────────
     ========================================================================== */

  /* --------------------------------------------------------------------------
     C-002 — 8주 학습 플랜
     --------------------------------------------------------------------------
     출처: PLAN.md §2-5 + saa/index.html 의 "8주 학습 플랜" 표 (계획값).
     ⚠️ 측정값이 아니라 이 사이트가 제안하는 일정입니다. 공식 권장 일정이 아닙니다.
     주차 구간을 [시작, 끝] 부동 막대로 그립니다. x 는 "경과 주차"이므로
     2~3주차 구간은 [1, 3] 입니다(1주 끝 → 3주 끝).
     -------------------------------------------------------------------------- */
  register('C-002', function (ctx) {
    var rows = [
      { label: '1주차 · 진단과 기반', span: [0, 1], kind: 'muted',
        domain: '전 도메인', what: '진단 테스트 40문항 · 1장 · 2장 · 한정어 키워드 사전' },
      { label: '2–3주차 · 보안 (30%)', span: [1, 3], kind: 'series0',
        domain: '보안 아키텍처 설계', what: '3장 · 4장 · 16장 · 17장 · 보안 도메인 연습 전량' },
      { label: '4–5주차 · 복원력 (26%)', span: [3, 5], kind: 'series1',
        domain: '복원력 있는 아키텍처 설계', what: '5장~7장 · 10장~12장 · 복원력 도메인 연습 전량' },
      { label: '6–7주차 · 고성능 (24%)', span: [5, 7], kind: 'series2',
        domain: '고성능 아키텍처 설계', what: '8장 · 9장 · 13장 · 14장 · 15장 · 고성능 도메인 연습 전량' },
      { label: '7주차 · 비용 최적화 (20%)', span: [6, 7], kind: 'series3',
        domain: '비용 최적화 아키텍처 설계', what: '18장 · 비용 도메인 연습 전량' },
      { label: '8주차 · 실전 전환', span: [7, 8], kind: 'muted',
        domain: '전 도메인', what: '모의고사 4세트 · 오답 노트 졸업 · 벼락치기 요약 (새 지식 금지)' }
    ];

    function colorOf(kind) {
      var m = /^series(\d)$/.exec(kind);
      return m ? ctx.color('series', +m[1]) : ctx.color(kind);
    }
    var borders = rows.map(function (r) { return colorOf(r.kind); });
    var fills = borders.map(function (c) { return ctx.alpha(c, 0.55); });

    return {
      type: 'bar',
      height: 340,
      data: {
        labels: rows.map(function (r) { return r.label; }),
        datasets: [{
          label: '학습 구간',
          data: rows.map(function (r) { return r.span.slice(); }),
          backgroundColor: fills,
          borderColor: borders,
          borderWidth: 1.5,
          borderSkipped: false,
          barPercentage: 0.72
        }]
      },
      options: {
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (item) {
                var v = item.raw;
                var from = v[0] + 1, to = v[1];
                return (from === to ? from + '주차' : from + '주차 ~ ' + to + '주차') +
                  ' (' + (v[1] - v[0]) + '주)';
              }
            }
          }
        },
        scales: {
          x: {
            min: 0, max: 8,
            title: { display: true, text: '경과 주차 (0 = 시작 · 8 = 종료)', color: ctx.color('textMuted') },
            ticks: { stepSize: 1, autoSkip: false }
          },
          y: { grid: { display: false }, ticks: { autoSkip: false } }
        }
      },
      a11yCaption: '8주 학습 플랜의 주차별 구간 — 이 사이트가 제안하는 계획값이며 공식 권장 일정이 아닙니다',
      a11yTable: {
        caption: '8주 학습 플랜 구간 (PLAN.md §2-5 계획값 · 측정값 아님)',
        head: ['구간', '주차', '주 도메인', '핵심 활동'],
        rows: rows.map(function (r) {
          var from = r.span[0] + 1, to = r.span[1];
          return [
            r.label.split(' · ')[1] || r.label,
            from === to ? from + '주차' : from + '–' + to + '주차',
            r.domain,
            r.what
          ];
        })
      }
    };
  });

  /* --------------------------------------------------------------------------
     C-003 — 시험 시간 예산
     --------------------------------------------------------------------------
     출처: PLAN.md §0 (SAA-C03 65문항 · 130분 — 시험 사실) +
           saa/exam-tips.html 의 3패스 전략 표 (100분 / 20분 / 10분 — 권장 배분).
     ⚠️ 130분은 공식 값이지만 100/20/10 배분은 이 사이트의 권장안입니다.
     -------------------------------------------------------------------------- */
  register('C-003', function (ctx) {
    var seg = [
      { label: '1차 풀이', min: 100, what: '65문항을 처음부터 끝까지 한 번. 2분 안에 결론이 안 나면 표시하고 넘어갑니다' },
      { label: '표시 문항 재검토', min: 20, what: '표시해 둔 문항만 다시 봅니다' },
      { label: '최종 점검', min: 10, what: '빈칸 확인 · 복수 응답 문항의 선택 개수 확인' }
    ];
    var total = 130;   // SAA-C03 시험 시간 (공식 값)

    var cum = 0;
    var rows = seg.map(function (s) {
      var from = cum; cum += s.min;
      return [s.label, s.min + '분', from + '분 → ' + cum + '분', s.what];
    });

    return {
      type: 'bar',
      height: 240,
      data: {
        labels: ['130분'],
        datasets: seg.map(function (s, i) {
          var c = ctx.pair(i, 0.62);
          return {
            label: s.label + ' ' + s.min + '분',
            data: [s.min],
            backgroundColor: c.fill,
            borderColor: c.border,
            borderWidth: 1.5,
            borderSkipped: false,
            maxBarThickness: 64
          };
        })
      },
      options: {
        indexAxis: 'y',
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: function (item) { return item.dataset.label.replace(/ \d+분$/, '') + ' — ' + item.parsed.x + '분'; }
            }
          }
        },
        scales: {
          x: {
            stacked: true, min: 0, max: total,
            title: { display: true, text: '경과 시간 (분)', color: ctx.color('textMuted') },
            ticks: { stepSize: 10 }
          },
          y: { stacked: true, grid: { display: false } }
        }
      },
      a11yCaption: 'SAA-C03 130분의 권장 시간 배분 — 130분은 공식 시험 시간이고 100/20/10 배분은 이 사이트의 권장안입니다',
      a11yTable: {
        caption: '시험 시간 130분의 권장 배분 (총 시간 130분은 공식 값 · 구간 배분은 권장안)',
        head: ['구간', '배정 시간', '누적 경과', '무엇을 하는가'],
        rows: rows.concat([['합계', total + '분', '130분', 'SAA-C03 시험 시간 130분 · 65문항 (공식 값)']])
      }
    };
  });

  /* --------------------------------------------------------------------------
     C-004 — 채점 문항 구성 (채점 50 + 비채점 15)
     --------------------------------------------------------------------------
     출처: PLAN.md §0 · data/questions/manifest.json 의 weightNote.
     ⚠️ 응시자는 두 종류를 구분할 수 없습니다. 이 사실이 차트의 결론이므로
        a11yTable 에 문장으로 남깁니다.
     -------------------------------------------------------------------------- */
  register('C-004', function (ctx) {
    var labels = ['채점 문항 50', '비채점 문항 15'];
    var values = [50, 15];
    var base = ctx.palette(2);

    return {
      type: 'doughnut',
      height: 300,
      data: {
        labels: labels,
        datasets: [{
          label: '문항 수',
          data: values,
          backgroundColor: base.map(function (c) { return ctx.alpha(c, 0.75); }),
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
              label: function (item) {
                return item.label + ' — ' + item.parsed + '문항 (' + pct(item.parsed, 65) + '%)';
              }
            }
          }
        },
        /* 도넛에는 축이 없습니다. baseOptions 의 scales 를 끕니다. */
        scales: { x: { display: false }, y: { display: false } }
      },
      a11yCaption: '실제 시험 65문항 중 50문항만 채점되며 응시자는 어느 쪽인지 구분할 수 없습니다',
      a11yTable: {
        caption: 'SAA-C03 65문항의 구성 (PLAN.md §0)',
        head: ['구분', '문항 수', '비중', '응시자가 구분할 수 있는가'],
        rows: [
          ['채점 문항', '50문항', pct(50, 65) + '%', '구분할 수 없습니다'],
          ['비채점 문항 (사전 테스트)', '15문항', pct(15, 65) + '%', '구분할 수 없습니다'],
          ['합계', '65문항', '100%', '두 종류가 섞여 제시되므로, 낯선 문항에 시간을 쏟는 것은 어느 쪽이든 손해입니다']
        ]
      }
    };
  });

  /* --------------------------------------------------------------------------
     C-005 — 문제은행 구성
     --------------------------------------------------------------------------
     출처: PLAN.md §3-1 (이 사이트의 산출물 규모 목표).
     ⚠️ 시험 사실이 아니라 사이트 설계값입니다.
     -------------------------------------------------------------------------- */
  register('C-005', function (ctx) {
    var rows = [
      ['기본개념 챕터별 확인문제', 180, '18장 × 10문항'],
      ['SAA 도메인별 연습', 340, '가중치 비례 배분 (102 / 88 / 82 / 68)'],
      ['SAA 모의고사 4세트', 260, '65문항 × 4세트 · 도메인 비율 30/26/24/20'],
      ['SAA 진단 테스트', 40, '도메인 × 10문항 — 학습 순서를 정하는 용도']
    ];
    var total = rows.reduce(function (a, r) { return a + r[1]; }, 0);
    var base = ctx.palette(4);

    return {
      type: 'doughnut',
      height: 320,
      data: {
        labels: rows.map(function (r) { return r[0] + ' ' + r[1]; }),
        datasets: [{
          label: '문항 수',
          data: rows.map(function (r) { return r[1]; }),
          backgroundColor: base.map(function (c) { return ctx.alpha(c, 0.75); }),
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
              label: function (item) {
                return item.parsed + '문항 (' + pct(item.parsed, total) + '%)';
              }
            }
          }
        },
        scales: { x: { display: false }, y: { display: false } }
      },
      a11yCaption: '이 사이트 문제은행의 구성 — 시험 사실이 아니라 사이트의 산출물 설계값입니다',
      a11yTable: {
        caption: '문제은행 구성 (PLAN.md §3-1 — 이 사이트의 목표 규모)',
        head: ['세트', '문항 수', '비중', '구성'],
        rows: rows.map(function (r) {
          return [r[0], r[1] + '문항', pct(r[1], total) + '%', r[2]];
        }).concat([['합계', total + '문항', '100%', '실제 시험 문항이 아니라 이 사이트가 만드는 연습 문항입니다']])
      }
    };
  });

  /* ==========================================================================
     ─────────────────── C-100 ~ C-108 · 대시보드 · 결과 ───────────────────
     여기부터는 전부 localStorage 진도가 원본입니다.
     데이터가 없으면 null 을 반환해 조용히 비워 둡니다 (빈 격자를 그리지 않습니다).
     ========================================================================== */

  /* --------------------------------------------------------------------------
     C-100 — 내 도메인별 숙련도 (radar)
     --------------------------------------------------------------------------
     출처: localStorage 진도.
       1순위 AG.progress.diagnostic().byDomain  (진단 테스트 결과)
       2순위 masteryByDomain(도메인 연습 세트 접두사) + 혼합 세트 응시 이력의 byDomain
     ⚠️ 축은 정답률(%)입니다. 100~1000 스케일 점수(합격 720)와 1:1로 대응하지 않으므로
        어디에도 환산 표기를 두지 않습니다.
     -------------------------------------------------------------------------- */
  register('C-100', function (ctx) {
    var p = P();
    if (!p) return null;

    function build(byDomain, sourceLabel) {
      var any = SAA.some(function (d) {
        var v = byDomain[d.name];
        return v && (+v.total || +v.attempts) > 0;
      });
      if (!any) return null;

      var values = SAA.map(function (d) {
        var v = byDomain[d.name];
        if (!v) return 0;
        var att = +v.total || +v.attempts || 0;
        return att ? pct(+v.correct || 0, att) : 0;
      });
      var c = ctx.pair(0, 0.22);
      var grid = ctx.color('grid');

      return {
        type: 'radar',
        height: 360,
        data: {
          labels: SAA.map(function (d) { return d.ko + ' (' + d.weight + '%)'; }),
          datasets: [{
            label: '정답률 (%) — ' + sourceLabel,
            data: values,
            backgroundColor: c.fill,
            borderColor: c.border,
            borderWidth: 2,
            pointBackgroundColor: c.border,
            pointBorderColor: ctx.color('fill'),
            pointRadius: 4,
            pointHoverRadius: 6
          }]
        },
        options: {
          plugins: {
            legend: { position: 'bottom' },
            tooltip: {
              callbacks: {
                label: function (item) {
                  var d = SAA[item.dataIndex];
                  var v = byDomain[d.name] || {};
                  var att = +v.total || +v.attempts || 0;
                  return d.ko + ' — ' + item.parsed.r + '% (' + (+v.correct || 0) + '/' + att + ')';
                }
              }
            }
          },
          scales: {
            x: { display: false },
            y: { display: false },
            r: {
              min: 0, max: 100,
              ticks: {
                stepSize: 20,
                color: ctx.color('textMuted'),
                backdropColor: ctx.alpha(ctx.color('fill'), 0.85),
                font: { family: ctx.fontFamily, size: 11 },
                callback: function (v) { return v + '%'; }
              },
              grid: { color: grid },
              angleLines: { color: grid },
              pointLabels: { color: ctx.color('text'), font: { family: ctx.fontFamily, size: 12 } }
            }
          }
        },
        a11yCaption: '도메인별 정답률(%) — 실제 시험의 100~1000 스케일 점수와는 다른 척도입니다',
        a11yTable: {
          caption: '내 도메인별 정답률 (' + sourceLabel + ' · localStorage 진도)',
          head: ['도메인', '출제 비중', '정답률', '정답 / 시도', '처방'],
          rows: SAA.map(function (d, i) {
            var v = byDomain[d.name] || {};
            var att = +v.total || +v.attempts || 0;
            var t = v.tier || tierOf(values[i]);
            return [
              d.ko, d.weight + '%',
              att ? values[i] + '%' : '기록 없음',
              att ? (+v.correct || 0) + ' / ' + att : '—',
              att ? TIER[t].label : '아직 풀지 않았습니다'
            ];
          }).concat([[
            '척도 안내', '—', '—', '—',
            '이 표의 정답률은 백분율이며 합격 기준 720점(100~1000 스케일)과 1:1로 대응하지 않습니다'
          ]])
        }
      };
    }

    var diag = p.diagnostic();
    if (diag && diag.byDomain) {
      var fromDiag = build(diag.byDomain, '진단 테스트');
      if (fromDiag) return fromDiag;
    }

    /* 진단 기록이 없으면 누적 풀이에서 집계합니다. 세트 접두사 판정에 manifest 가 필요합니다. */
    return fetchJSON('data/questions/manifest.json').then(function (manifest) {
      return build(domainTotals(p, manifest || { sets: [] }), '누적 문제 풀이');
    });
  });

  /* --------------------------------------------------------------------------
     C-101 — 학습 진도 (doughnut)
     --------------------------------------------------------------------------
     출처: AG.progress.readList() + data/toc.json 의 전체 페이지 수.
     분모는 toc.json 이 정의하는 커리큘럼 전체 페이지 수입니다(빌드 여부와 무관하게 고정).
     -------------------------------------------------------------------------- */
  register('C-101', function (ctx) {
    var p = P();
    if (!p) return null;

    return fetchJSON('data/toc.json').then(function (toc) {
      if (!toc || !toc.sections) return null;

      var set = readSetOf(p);
      var total = 0, read = 0;
      var bySection = [];
      toc.sections.forEach(function (s) {
        var n = 0;
        (s.pages || []).forEach(function (pg) {
          total += 1;
          if (isPageRead(set, s.id, pg.id)) { read += 1; n += 1; }
        });
        bySection.push([s.title || s.id, n + ' / ' + (s.pages || []).length,
          pct(n, (s.pages || []).length) + '%']);
      });
      if (!total || !read) return null;      // 첫 방문(진도 0) — 조용히 비워 둡니다

      var left = total - read;
      var okC = ctx.color('ok');
      var mutedC = ctx.color('muted');

      return {
        type: 'doughnut',
        height: 300,
        data: {
          labels: ['읽음 ' + read + '페이지', '남음 ' + left + '페이지'],
          datasets: [{
            label: '페이지 수',
            data: [read, left],
            backgroundColor: [ctx.alpha(okC, 0.78), ctx.alpha(mutedC, 0.3)],
            borderColor: ctx.color('fill'),
            borderWidth: 2,
            hoverOffset: 6
          }]
        },
        options: {
          cutout: '58%',
          plugins: {
            legend: { position: 'right' },
            tooltip: {
              callbacks: {
                label: function (item) {
                  return item.parsed + '페이지 (' + pct(item.parsed, total) + '%)';
                }
              }
            }
          },
          scales: { x: { display: false }, y: { display: false } }
        },
        a11yCaption: '전체 ' + total + '페이지 중 ' + read + '페이지를 읽었습니다 (' + pct(read, total) + '%)',
        a11yTable: {
          caption: '학습 진도 — 읽은 페이지 (localStorage 진도 + data/toc.json)',
          head: ['구분', '페이지 수', '비율'],
          rows: [
            ['읽음', read + '페이지', pct(read, total) + '%'],
            ['남음', left + '페이지', pct(left, total) + '%'],
            ['전체', total + '페이지', '100%']
          ].concat(bySection.map(function (r) { return ['· ' + r[0], r[1], r[2]]; }))
        }
      };
    });
  });

  /* --------------------------------------------------------------------------
     C-102 — 모의고사 점수 추이 (line)
     --------------------------------------------------------------------------
     출처: AG.progress.exams() 중 mode === 'exam' 만, 응시 시각 순.
     ⚠️ y 축은 정답률(%)입니다. 실제 시험의 합격 기준 720점은 100~1000 스케일 점수라
        정답률과 1:1로 대응하지 않으므로 환산선·환산 표기를 두지 않습니다.
     -------------------------------------------------------------------------- */
  register('C-102', function (ctx) {
    var p = P();
    if (!p) return null;

    var list = p.exams()
      .filter(function (e) { return e.mode === 'exam' && (+e.total || 0) > 0; })
      .sort(function (a, b) { return String(a.at) < String(b.at) ? -1 : 1; });
    if (!list.length) return null;           // 아직 모의고사를 보지 않았습니다

    var c = ctx.pair(0, 0.18);
    var values = list.map(function (e) { return pct(+e.score || 0, +e.total || 0); });

    function dateText(at) {
      var d = new Date(at);
      return isNaN(d.getTime()) ? '—' : ymd(d);
    }
    function durText(sec) {
      sec = +sec || 0;
      if (!sec) return '—';
      var m = Math.round(sec / 60);
      return m >= 60 ? Math.floor(m / 60) + '시간 ' + (m % 60) + '분' : m + '분';
    }

    return {
      type: 'line',
      height: 320,
      data: {
        labels: list.map(function (e, i) { return (i + 1) + '회차'; }),
        datasets: [{
          label: '정답률 (%)',
          data: values,
          borderColor: c.border,
          backgroundColor: c.fill,
          borderWidth: 2,
          fill: true,
          tension: 0.25,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: c.border,
          pointBorderColor: ctx.color('fill')
        }]
      },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (item) {
                var e = list[item.dataIndex];
                return item.parsed.y + '% (' + (+e.score || 0) + ' / ' + (+e.total || 0) + '문항)';
              },
              afterLabel: function (item) { return dateText(list[item.dataIndex].at); }
            }
          }
        },
        scales: {
          y: {
            min: 0, max: 100,
            title: { display: true, text: '정답률 (%)', color: ctx.color('textMuted') },
            ticks: { stepSize: 20, callback: function (v) { return v + '%'; } }
          },
          x: {
            title: { display: true, text: '응시 회차', color: ctx.color('textMuted') },
            grid: { display: false }
          }
        }
      },
      a11yCaption: '모의고사 회차별 정답률(%) 추이 — 정답률은 실제 시험의 100~1000 스케일 점수와 다른 척도입니다',
      a11yTable: {
        caption: '모의고사 점수 추이 (localStorage 진도 · mode = exam)',
        head: ['회차', '응시일', '정답 / 문항', '정답률', '소요 시간'],
        rows: list.map(function (e, i) {
          return [
            (i + 1) + '회차', dateText(e.at),
            (+e.score || 0) + ' / ' + (+e.total || 0), values[i] + '%', durText(e.durationSec)
          ];
        }).concat([[
          '척도 안내', '—', '—', '—',
          '이 표의 정답률은 백분율입니다. 합격 기준 720점은 100~1000 스케일 점수라 정답률과 1:1로 대응하지 않습니다'
        ]])
      }
    };
  });

  /* --------------------------------------------------------------------------
     C-103 — 약점 우선순위 (수평 bar)
     --------------------------------------------------------------------------
     출처: localStorage 진도(진단 결과 또는 누적 풀이) + PLAN.md §3-1 우선순위 공식.
       우선도 = 도메인 가중치 × (100 − 정답률) / 100
     막대의 위에서 아래 순서가 곧 학습 순서입니다.
     -------------------------------------------------------------------------- */
  register('C-103', function (ctx) {
    var p = P();
    if (!p) return null;

    function build(byDomain, sourceLabel) {
      var rows = [];
      SAA.forEach(function (d) {
        var v = byDomain[d.name];
        var att = v ? (+v.total || +v.attempts || 0) : 0;
        if (!att) return;
        var acc = pct(+v.correct || 0, att);
        rows.push({
          ko: d.ko, weight: d.weight, pctv: acc, correct: +v.correct || 0, total: att,
          tier: v.tier || tierOf(acc),
          priority: Math.round(d.weight * (100 - acc) / 100 * 10) / 10
        });
      });
      if (!rows.length) return null;
      rows.sort(function (a, b) {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return b.weight - a.weight;
      });

      var borders = rows.map(function (r) { return ctx.color(TIER[r.tier].kind); });
      var fills = borders.map(function (c) { return ctx.alpha(c, 0.55); });

      return {
        type: 'bar',
        height: 300,
        data: {
          labels: rows.map(function (r) { return r.ko + ' · ' + TIER[r.tier].label; }),
          datasets: [{
            label: '우선도 = 가중치 × 부족분',
            data: rows.map(function (r) { return r.priority; }),
            backgroundColor: fills,
            borderColor: borders,
            borderWidth: 1.5,
            borderSkipped: false,
            barPercentage: 0.7
          }]
        },
        options: {
          indexAxis: 'y',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function (item) {
                  var r = rows[item.dataIndex];
                  return '우선도 ' + r.priority + ' — 가중치 ' + r.weight +
                    '% × 부족분 ' + (100 - r.pctv) + '%';
                }
              }
            }
          },
          scales: {
            x: {
              beginAtZero: true,
              title: { display: true, text: '우선도 (가중치 × 부족분 / 100)', color: ctx.color('textMuted') }
            },
            y: { grid: { display: false }, ticks: { autoSkip: false } }
          }
        },
        a11yCaption: '가중치가 크고 정답률이 낮은 도메인일수록 위에 옵니다. 막대 순서가 곧 학습 순서입니다',
        a11yTable: {
          caption: '약점 우선순위 (' + sourceLabel + ' · 우선도 = 가중치 × (100 − 정답률) / 100)',
          head: ['학습 순서', '도메인', '출제 비중', '정답률', '정답 / 시도', '우선도', '처방'],
          rows: rows.map(function (r, i) {
            return [
              (i + 1) + '순위', r.ko, r.weight + '%', r.pctv + '%',
              r.correct + ' / ' + r.total, String(r.priority), TIER[r.tier].label
            ];
          })
        }
      };
    }

    var diag = p.diagnostic();
    if (diag && diag.byDomain) {
      var fromDiag = build(diag.byDomain, '진단 테스트');
      if (fromDiag) return fromDiag;
    }
    return fetchJSON('data/questions/manifest.json').then(function (manifest) {
      return build(domainTotals(p, manifest || { sets: [] }), '누적 문제 풀이');
    });
  });

  /* --------------------------------------------------------------------------
     C-104 — 진단 결과: 도메인별 정답률과 처방 구간 (수평 누적 bar)
     --------------------------------------------------------------------------
     출처: AG.progress.diagnostic().byDomain
     처방 경계는 60% / 80% 입니다 (saa/index.html "진단 결과에 따른 조정" 표와 같은 기준).
     x 눈금이 20% 간격이므로 60·80 위치에 격자선이 놓입니다.
     -------------------------------------------------------------------------- */
  register('C-104', function (ctx) {
    var p = P();
    if (!p) return null;
    var diag = p.diagnostic();
    if (!diag || !diag.byDomain) return null;

    var rows = [];
    SAA.forEach(function (d) {
      var v = diag.byDomain[d.name];
      if (!v || !(+v.total)) return;
      var acc = v.pct != null ? +v.pct : pct(+v.correct || 0, +v.total);
      rows.push({
        ko: d.ko, weight: d.weight, pctv: acc,
        correct: +v.correct || 0, total: +v.total, tier: v.tier || tierOf(acc)
      });
    });
    if (!rows.length) return null;
    rows.sort(function (a, b) { return a.pctv - b.pctv; });

    var borders = rows.map(function (r) { return ctx.color(TIER[r.tier].kind); });
    var fills = borders.map(function (c) { return ctx.alpha(c, 0.6); });
    var rest = ctx.alpha(ctx.color('muted'), 0.18);

    return {
      type: 'bar',
      height: 300,
      data: {
        labels: rows.map(function (r) { return r.ko + ' · ' + TIER[r.tier].label; }),
        datasets: [
          {
            label: '정답률',
            data: rows.map(function (r) { return r.pctv; }),
            backgroundColor: fills,
            borderColor: borders,
            borderWidth: 1.5,
            borderSkipped: false
          },
          {
            label: '남은 구간',
            data: rows.map(function (r) { return 100 - r.pctv; }),
            backgroundColor: rest,
            borderColor: ctx.color('stroke'),
            borderWidth: 1,
            borderSkipped: false
          }
        ]
      },
      options: {
        indexAxis: 'y',
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: function (item) {
                var r = rows[item.dataIndex];
                if (item.datasetIndex === 1) return '남은 구간 ' + (100 - r.pctv) + '%';
                return '정답률 ' + r.pctv + '% (' + r.correct + '/' + r.total + ') · ' + TIER[r.tier].label;
              }
            }
          }
        },
        scales: {
          x: {
            stacked: true, min: 0, max: 100,
            title: { display: true, text: '정답률 (%) — 60% 미만 집중 학습 · 60~80% 보강 · 80% 이상 유지', color: ctx.color('textMuted') },
            ticks: { stepSize: 20, callback: function (v) { return v + '%'; } }
          },
          y: { stacked: true, grid: { display: false }, ticks: { autoSkip: false } }
        }
      },
      a11yCaption: '진단 테스트의 도메인별 정답률과 처방 구간 — 60%와 80%가 처방이 바뀌는 경계입니다',
      a11yTable: {
        caption: '진단 결과 — 도메인별 정답률과 처방 (localStorage 진도)',
        head: ['도메인', '출제 비중', '정답률', '정답 / 문항', '처방 구간', '처방'],
        rows: rows.map(function (r) {
          return [
            r.ko, r.weight + '%', r.pctv + '%', r.correct + ' / ' + r.total,
            r.tier === 'focus' ? '60% 미만' : (r.tier === 'reinforce' ? '60~80%' : '80% 이상'),
            TIER[r.tier].label
          ];
        }).concat([[
          '처방 기준', '—', '—', '—', '—',
          '60% 미만 = 해당 챕터 전체 + 도메인 연습 전량 / 60~80% = 함정 사전 + 연습 절반 / 80% 이상 = 모의고사에서만 점검'
        ]])
      }
    };
  });

  /* --------------------------------------------------------------------------
     C-105 — 오답 노트 졸업 현황 (누적 bar)
     --------------------------------------------------------------------------
     출처: AG.progress.quizStats() 의 streak (연속 정답 수).
     대상은 "한 번이라도 틀린 문항"(attempts > correct)이며,
     3회 연속 정답이면 졸업입니다 (progress.js GRADUATE_STREAK = 3).
     -------------------------------------------------------------------------- */
  register('C-105', function (ctx) {
    var p = P();
    if (!p) return null;
    var G = p.GRADUATE_STREAK || 3;

    var stats = p.quizStats();
    var buckets = [0, 0, 0, 0];   // 연속 0회 / 1회 / 2회 / 졸업
    var totalWrong = 0;
    Object.keys(stats).forEach(function (id) {
      var s = stats[id] || {};
      var attempts = +s.attempts || 0, correct = +s.correct || 0, streak = +s.streak || 0;
      if (attempts <= correct) return;             // 한 번도 틀린 적 없는 문항은 오답 노트가 아닙니다
      totalWrong += 1;
      buckets[Math.min(streak, G)] += 1;
    });
    if (!totalWrong) return null;                  // 오답 노트가 비어 있습니다

    var names = ['연속 0회', '연속 1회', '연속 2회', '졸업 (' + G + '회 연속)'];
    var kinds = ['danger', 'warn', 'accent', 'ok'];

    return {
      type: 'bar',
      height: 260,
      data: {
        labels: ['오답 노트 ' + totalWrong + '문항'],
        datasets: names.map(function (n, i) {
          var c = ctx.color(kinds[i]);
          return {
            label: n,
            data: [buckets[i]],
            backgroundColor: ctx.alpha(c, 0.62),
            borderColor: c,
            borderWidth: 1.5,
            borderSkipped: false,
            maxBarThickness: 64
          };
        })
      },
      options: {
        indexAxis: 'y',
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: function (item) {
                return item.dataset.label + ' — ' + item.parsed.x + '문항 (' +
                  pct(item.parsed.x, totalWrong) + '%)';
              }
            }
          }
        },
        scales: {
          x: {
            stacked: true, beginAtZero: true,
            title: { display: true, text: '문항 수', color: ctx.color('textMuted') },
            ticks: { precision: 0 }
          },
          y: { stacked: true, grid: { display: false } }
        }
      },
      a11yCaption: '오답 노트 문항의 연속 정답 단계 — ' + G + '회 연속 정답이면 졸업합니다',
      a11yTable: {
        caption: '오답 노트 졸업 현황 (localStorage 진도 · 연속 정답 ' + G + '회 = 졸업)',
        head: ['단계', '문항 수', '비중', '의미'],
        rows: [
          [names[0], buckets[0] + '문항', pct(buckets[0], totalWrong) + '%', '가장 최근 시도에서 틀렸습니다 — 먼저 봅니다'],
          [names[1], buckets[1] + '문항', pct(buckets[1], totalWrong) + '%', '한 번 맞혔습니다'],
          [names[2], buckets[2] + '문항', pct(buckets[2], totalWrong) + '%', '한 번 더 맞히면 졸업합니다'],
          [names[3], buckets[3] + '문항', pct(buckets[3], totalWrong) + '%', '오답 노트에서 빠집니다'],
          ['합계', totalWrong + '문항', '100%', '한 번이라도 틀린 적이 있는 문항만 셉니다']
        ]
      }
    };
  });

  /* --------------------------------------------------------------------------
     C-106 — 플래시카드 간격 반복 진도 (bar)
     --------------------------------------------------------------------------
     출처: AG.progress.cardStats() 의 streak · graduated.
     "알았음"이 3회 연속이면 졸업이고, "몰랐음"이면 단계가 0으로 돌아갑니다.
     -------------------------------------------------------------------------- */
  register('C-106', function (ctx) {
    var p = P();
    if (!p) return null;
    var G = p.GRADUATE_STREAK || 3;

    var stats = p.cardStats();
    var ids = Object.keys(stats);
    if (!ids.length) return null;                  // 아직 카드를 넘기지 않았습니다

    var buckets = [0, 0, 0, 0];
    var seenTotal = 0;
    ids.forEach(function (id) {
      var s = stats[id] || {};
      if (!(+s.seen)) return;
      seenTotal += 1;
      buckets[s.graduated ? G : Math.min(+s.streak || 0, G - 1)] += 1;
    });
    if (!seenTotal) return null;

    var names = ['0단계', '1단계', '2단계', '졸업 (' + G + '회 연속)'];
    var kinds = ['danger', 'warn', 'accent', 'ok'];
    var borders = kinds.map(function (k) { return ctx.color(k); });

    return {
      type: 'bar',
      height: 300,
      data: {
        labels: names,
        datasets: [{
          label: '카드 수',
          data: buckets,
          backgroundColor: borders.map(function (c) { return ctx.alpha(c, 0.6); }),
          borderColor: borders,
          borderWidth: 1.5
        }]
      },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (item) {
                return item.parsed.y + '장 (' + pct(item.parsed.y, seenTotal) + '%)';
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: '카드 수', color: ctx.color('textMuted') },
            ticks: { precision: 0 }
          },
          x: { grid: { display: false } }
        }
      },
      a11yCaption: '넘겨 본 플래시카드 ' + seenTotal + '장의 단계별 분포 — "알았음" ' + G + '회 연속이면 졸업합니다',
      a11yTable: {
        caption: '플래시카드 간격 반복 진도 (localStorage 진도)',
        head: ['단계', '카드 수', '비중', '의미'],
        rows: [
          [names[0], buckets[0] + '장', pct(buckets[0], seenTotal) + '%', '가장 최근에 "몰랐음"을 눌렀습니다'],
          [names[1], buckets[1] + '장', pct(buckets[1], seenTotal) + '%', '연속 1회 알았음'],
          [names[2], buckets[2] + '장', pct(buckets[2], seenTotal) + '%', '한 번 더 맞히면 졸업합니다'],
          [names[3], buckets[3] + '장', pct(buckets[3], seenTotal) + '%', '복습 대상에서 빠집니다'],
          ['합계', seenTotal + '장', '100%', '한 번이라도 넘겨 본 카드만 셉니다']
        ]
      }
    };
  });

  /* --------------------------------------------------------------------------
     C-107 — 챕터별 학습 완료 상태 (수평 bar)
     --------------------------------------------------------------------------
     출처: AG.progress.readList() + data/toc.json 의 basics 섹션.
     읽음/안 읽음의 두 상태뿐이므로 누적 막대로 상태 띠를 그립니다.
     색만으로 구분하지 않도록 범례와 y축 라벨(장 번호·제목)을 함께 둡니다.
     -------------------------------------------------------------------------- */
  register('C-107', function (ctx) {
    var p = P();
    if (!p) return null;

    return fetchJSON('data/toc.json').then(function (toc) {
      if (!toc || !toc.sections) return null;
      var sec = null;
      toc.sections.forEach(function (s) { if (s.id === 'basics') sec = s; });
      if (!sec || !(sec.pages || []).length) return null;

      var set = readSetOf(p);
      var pages = sec.pages.map(function (pg) {
        return {
          id: pg.id,
          label: (pg.num ? pg.num + '장 · ' : '') + (pg.title || pg.id),
          read: isPageRead(set, sec.id, pg.id)
        };
      });
      var readN = pages.filter(function (x) { return x.read; }).length;
      if (!readN) return null;                    // 첫 방문 — 조용히 비워 둡니다

      var okC = ctx.color('ok');
      var mutedC = ctx.color('muted');

      return {
        type: 'bar',
        height: 460,
        data: {
          labels: pages.map(function (x) { return x.label; }),
          datasets: [
            {
              label: '읽음',
              data: pages.map(function (x) { return x.read ? 1 : 0; }),
              backgroundColor: ctx.alpha(okC, 0.7),
              borderColor: okC, borderWidth: 1.5, borderSkipped: false
            },
            {
              label: '아직 읽지 않음',
              data: pages.map(function (x) { return x.read ? 0 : 1; }),
              backgroundColor: ctx.alpha(mutedC, 0.16),
              borderColor: ctx.color('stroke'), borderWidth: 1, borderSkipped: false
            }
          ]
        },
        options: {
          indexAxis: 'y',
          plugins: {
            legend: { position: 'bottom' },
            tooltip: {
              callbacks: {
                label: function (item) {
                  return pages[item.dataIndex].read ? '읽음' : '아직 읽지 않음';
                }
              }
            }
          },
          scales: {
            x: { stacked: true, min: 0, max: 1, ticks: { display: false }, grid: { display: false } },
            y: { stacked: true, grid: { display: false }, ticks: { autoSkip: false, font: { size: 11 } } }
          }
        },
        a11yCaption: '기본개념 ' + pages.length + '개 챕터 중 ' + readN + '개를 읽었습니다',
        a11yTable: {
          caption: '챕터별 학습 완료 상태 (localStorage 진도 + data/toc.json)',
          head: ['챕터', '상태'],
          rows: pages.map(function (x) { return [x.label, x.read ? '읽음' : '아직 읽지 않음']; })
            .concat([['합계', readN + ' / ' + pages.length + '개 챕터 읽음']])
        }
      };
    });
  });

  /* --------------------------------------------------------------------------
     C-108 — 최근 14일 학습 활동 (bar)
     --------------------------------------------------------------------------
     출처: AG.progress.quizStats() 의 lastAt · cardStats() 의 lastAt (일자별 파생 집계).
     ⚠️ 진도 스키마는 항목마다 **마지막 시각 하나만** 보관합니다. 따라서 같은 문항을
        여러 날 풀었다면 마지막 날에만 잡힙니다. "그날 마지막으로 다룬 항목 수"입니다.
     기록이 없는 날도 0으로 채워 날짜 축을 끊지 않습니다.
     -------------------------------------------------------------------------- */
  register('C-108', function (ctx) {
    var p = P();
    if (!p) return null;

    var DAYS = 14;
    var keys = [], qz = {}, cd = {};
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    for (var i = DAYS - 1; i >= 0; i--) {
      var d = new Date(today.getTime() - i * 86400000);
      var k = ymd(d);
      keys.push(k); qz[k] = 0; cd[k] = 0;
    }

    function tally(stats, into) {
      var n = 0;
      Object.keys(stats).forEach(function (id) {
        var at = stats[id] && stats[id].lastAt;
        if (!at) return;
        var t = new Date(at);
        if (isNaN(t.getTime())) return;
        var k = ymd(t);
        if (into[k] == null) return;             // 14일 창 밖
        into[k] += 1; n += 1;
      });
      return n;
    }
    var nq = tally(p.quizStats(), qz);
    var nc = tally(p.cardStats(), cd);
    if (!nq && !nc) return null;                 // 최근 14일 기록 없음

    var a = ctx.pair(0, 0.62);
    var b = ctx.pair(1, 0.62);

    return {
      type: 'bar',
      height: 300,
      data: {
        labels: keys.map(mmdd),
        datasets: [
          {
            label: '문항',
            data: keys.map(function (k) { return qz[k]; }),
            backgroundColor: a.fill, borderColor: a.border, borderWidth: 1.5
          },
          {
            label: '플래시카드',
            data: keys.map(function (k) { return cd[k]; }),
            backgroundColor: b.fill, borderColor: b.border, borderWidth: 1.5
          }
        ]
      },
      options: {
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              title: function (items) { return keys[items[0].dataIndex]; },
              label: function (item) {
                return item.dataset.label + ' ' + item.parsed.y +
                  (item.datasetIndex === 0 ? '문항' : '장');
              }
            }
          }
        },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { autoSkip: false, maxRotation: 60 } },
          y: {
            stacked: true, beginAtZero: true,
            title: { display: true, text: '그날 마지막으로 다룬 항목 수', color: ctx.color('textMuted') },
            ticks: { precision: 0 }
          }
        }
      },
      a11yCaption: '최근 14일의 학습 활동 — 항목마다 마지막 시각만 저장되므로 "그날 마지막으로 다룬 항목 수"입니다',
      a11yTable: {
        caption: '최근 14일 학습 활동 (localStorage 진도의 lastAt 파생 집계)',
        head: ['날짜', '문항', '플래시카드', '합계'],
        rows: keys.map(function (k) {
          return [k, qz[k] + '문항', cd[k] + '장', (qz[k] + cd[k]) + '건'];
        }).concat([
          ['합계', nq + '문항', nc + '장', (nq + nc) + '건'],
          ['집계 방식', '—', '—',
            '진도 스키마는 항목마다 마지막 시각 하나만 보관합니다. 같은 항목을 여러 날 다뤘다면 마지막 날에만 집계됩니다']
        ])
      }
    };
  });

})(typeof window !== 'undefined' ? window : this);
