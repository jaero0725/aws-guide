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

   ────────────────────────────────────────────────────────────────────────
   이 파일의 수치 출처 표기 규약 — 등록 함수마다 주석 첫 줄에 셋 중 하나를 적습니다.
     [확인 수치] docs/FACT_SOURCES.md §N 에서 검증된 값. 그대로 축에 올립니다.
     [상대 등급] 금액·절대값을 확인할 수 없어 순서 척도로 바꾼 것. 축에 숫자 단위를
                 쓰지 않고, 등급의 정의를 a11yTable 에 반드시 적습니다.
     [범주]      과금 여부처럼 값이 아니라 분류인 것.
   ========================================================================== */
(function (global) {
  'use strict';

  var AG = global.AG;
  if (!AG || !AG.charts) return;      // charts.js 가 먼저 로드되지 않았다면 조용히 종료
  var register = AG.charts.register;

  /* ======================================================================
     공용 헬퍼
     ====================================================================== */

  /** 천 단위 구분 — 축 눈금과 툴팁이 같은 표기를 쓰게 합니다. */
  function n(v) {
    return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /** 분 단위를 사람이 읽는 문자열로 (C-012 검색 시간 축). */
  function minText(m) {
    if (m < 60) return m + '분';
    var h = m / 60;
    return (h % 1 === 0 ? h : h.toFixed(1)) + '시간';
  }

  /** 초 단위를 사람이 읽는 문자열로 (C-091 시간 속성). */
  function secText(s) {
    if (s < 60) return s + '초';
    if (s < 3600) return Math.round(s / 60) + '분';
    if (s < 86400) return Math.round(s / 3600) + '시간';
    return Math.round(s / 86400) + '일';
  }

  /** 바이트를 사람이 읽는 문자열로 (C-091 크기 속성). */
  function byteText(b) {
    if (b < 1024) return n(b) + ' B';
    if (b < 1048576) return Math.round(b / 1024) + ' KiB';
    return Math.round(b / 1048576) + ' MiB';
  }

  /**
   * 등급 축의 눈금 라벨.
   * 등급 차트에서 축에 맨숫자를 두면 "3"이 무슨 뜻인지 알 수 없습니다
   * (docs/CHART_CATALOG.md §3-2). 눈금 자체를 말로 바꿔 둡니다.
   */
  function scaleTicks(words) {
    return function (v) {
      return words[v] != null ? words[v] : '';
    };
  }

  /** 계열 i 의 색과 반투명 채움 — 막대 한 벌을 만들 때 반복되는 형태입니다. */
  function bar(ctx, i, label, data, extra) {
    var c = ctx.pair(i, 0.55);
    var d = {
      label: label,
      data: data,
      backgroundColor: c.fill,
      borderColor: c.border,
      borderWidth: 1.5
    };
    if (extra) Object.keys(extra).forEach(function (k) { d[k] = extra[k]; });
    return d;
  }

  /** 상대 등급 차트가 캡션·표에 공통으로 다는 단서. */
  var REL_NOTE = '이 차트의 값은 상대 비교(순서 척도)이며, 실제 금액은 리전·시점에 따라 다릅니다.';

  /* ==========================================================================
     ─────────────────── C-010 ~ C-012 · S3 · 오브젝트 스토리지 (ch08) ───────────────────
     ========================================================================== */

  /* --------------------------------------------------------------------------
     C-010 — S3 스토리지 클래스의 상대 저장 비용 등급
     --------------------------------------------------------------------------
     [상대 등급] 금액은 이 환경에서 확인이 구조적으로 불가능합니다
     (docs/FACT_SOURCES.md §1 · §5 "요금 관련 — 전면 금지").
     그래서 축에 통화 기호를 쓰지 않고 1~5 등급만 올립니다.

     ch08 캡션이 증명해야 한다고 적어 둔 결론은 "저장 비용이 내려가는 만큼
     검색 비용과 제약이 올라간다"는 교환 관계입니다. 그래서 한 계열이 아니라
     두 계열(저장 / 검색·제약)을 마주 보게 그립니다.

     등급의 근거는 클래스 이름이 아니라 확인된 사실입니다 — 최소 저장 기간
     30·90·180일과 접근 방식(밀리초 / 복원 필요)이 FACT_SOURCES.md §4.3 에
     확인되어 있고, 표에 그 근거를 함께 싣습니다.

     ⚠️ S3 Intelligent-Tiering 은 막대에서 뺐습니다. 접근 패턴에 따라 티어가
        자동으로 옮겨 다녀서 고정 등급을 매기면 거짓이 됩니다. 표에는 남깁니다.
     -------------------------------------------------------------------------- */
  register('C-010', function (ctx) {
    var rows = [
      { label: 'S3 Standard',        store: 5, get: 1, keep: '없음',  access: '밀리초',           az: '3개 이상' },
      { label: 'S3 Standard-IA',     store: 4, get: 2, keep: '30일',  access: '밀리초',           az: '3개 이상' },
      { label: 'S3 One Zone-IA',     store: 3, get: 2, keep: '30일',  access: '밀리초',           az: '1개' },
      { label: 'Glacier Instant Retrieval', store: 3, get: 3, keep: '90일',  access: '밀리초',    az: '3개 이상' },
      { label: 'Glacier Flexible Retrieval', store: 2, get: 4, keep: '90일', access: '복원 필요 (분~시간)', az: '3개 이상' },
      { label: 'Glacier Deep Archive', store: 1, get: 5, keep: '180일', access: '복원 필요 (시간)', az: '3개 이상' }
    ];
    var words = ['', '가장 낮음', '낮음', '보통', '높음', '가장 높음'];

    return {
      type: 'bar',
      height: 380,
      data: {
        labels: rows.map(function (r) { return r.label; }),
        datasets: [
          bar(ctx, 0, '저장 비용 등급', rows.map(function (r) { return r.store; })),
          bar(ctx, 3, '검색 비용 · 제약 등급', rows.map(function (r) { return r.get; }))
        ]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true, max: 5,
            ticks: { stepSize: 1, callback: scaleTicks(words) },
            title: { display: true, text: '상대 등급', color: ctx.color('textMuted') }
          },
          x: { ticks: { autoSkip: false, maxRotation: 42, minRotation: 0 }, grid: { display: false } }
        },
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: function (item) {
                return item.dataset.label + ' — ' + words[item.parsed.y] +
                  ' (' + item.parsed.y + '/5 등급 · 금액 아님)';
              }
            }
          }
        }
      },
      a11yCaption: 'S3 스토리지 클래스의 저장 비용과 검색 비용·제약을 1~5 상대 등급으로 비교한 그래프입니다. ' + REL_NOTE,
      a11yTable: {
        caption: 'S3 스토리지 클래스의 상대 비용 등급 — 등급은 순서 척도이며 금액이 아닙니다 ' +
                 '(등급의 근거인 최소 저장 기간·접근 방식·가용 영역 수는 FACT_SOURCES.md §4.3 확인 값)',
        head: ['스토리지 클래스', '저장 비용 등급', '검색 비용 · 제약 등급', '최소 저장 기간 (확인 값)', '접근 방식', '가용 영역 수'],
        rows: rows.map(function (r) {
          return [r.label, r.store + ' (' + words[r.store] + ')', r.get + ' (' + words[r.get] + ')',
                  r.keep, r.access, r.az];
        }).concat([
          ['S3 Intelligent-Tiering', '고정 등급 없음', '고정 등급 없음', '없음', '밀리초 (아카이브 티어 제외)', '3개 이상'],
          ['등급의 정의', '1 = 가장 낮음 · 5 = 가장 높음', '1 = 가장 낮음 · 5 = 가장 높음', '—', '—', '—'],
          ['읽는 법', REL_NOTE, '두 계열이 서로 반대 방향으로 움직이는 것이 이 그림의 결론입니다', '—', '—', '—']
        ])
      }
    };
  });

  /* --------------------------------------------------------------------------
     C-011 — S3 스토리지 클래스: 최소 저장 기간과 최소 청구 크기
     --------------------------------------------------------------------------
     [확인 수치] docs/FACT_SOURCES.md §4.3 (awsdocs storage-class-intro.md 비교표).
     단위가 서로 다르므로(일 / KB) y축을 둘로 나눕니다. 금액은 어디에도 쓰지 않습니다.
     -------------------------------------------------------------------------- */
  register('C-011', function (ctx) {
    var rows = [
      { label: 'S3 Standard',                  days: 0,   sizeK: 0,   az: '3개 이상' },
      { label: 'S3 Standard-IA',               days: 30,  sizeK: 128, az: '3개 이상' },
      { label: 'S3 One Zone-IA',               days: 30,  sizeK: 128, az: '1개' },
      { label: 'Glacier Instant Retrieval',    days: 90,  sizeK: 128, az: '3개 이상' },
      { label: 'Glacier Flexible Retrieval',   days: 90,  sizeK: 40,  az: '3개 이상' },
      { label: 'Glacier Deep Archive',         days: 180, sizeK: 40,  az: '3개 이상' }
    ];

    return {
      type: 'bar',
      height: 380,
      data: {
        labels: rows.map(function (r) { return r.label; }),
        datasets: [
          bar(ctx, 0, '최소 저장 기간 (일)', rows.map(function (r) { return r.days; }), { yAxisID: 'y' }),
          bar(ctx, 1, '최소 청구 크기 (KB)', rows.map(function (r) { return r.sizeK; }), { yAxisID: 'y1' })
        ]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: '일', color: ctx.color('textMuted') },
            ticks: { stepSize: 30 }
          },
          y1: {
            beginAtZero: true, position: 'right',
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'KB', color: ctx.color('textMuted') }
          },
          x: { ticks: { autoSkip: false, maxRotation: 42 }, grid: { display: false } }
        },
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: function (item) {
                var unit = item.datasetIndex === 0 ? '일' : 'KB';
                return item.dataset.label + ' — ' +
                  (item.parsed.y === 0 ? '없음' : n(item.parsed.y) + unit);
              }
            }
          }
        }
      },
      a11yCaption: 'S3 스토리지 클래스별 최소 저장 기간(30·90·180일)과 최소 청구 객체 크기(128 KB·40 KB)',
      a11yTable: {
        caption: 'S3 스토리지 클래스별 최소 저장 기간과 최소 청구 크기 (docs/FACT_SOURCES.md §4.3 확인 값)',
        head: ['스토리지 클래스', '최소 저장 기간', '최소 청구 크기', '가용 영역 수'],
        rows: rows.map(function (r) {
          return [r.label, r.days === 0 ? '없음' : r.days + '일',
                  r.sizeK === 0 ? '없음' : r.sizeK + ' KB', r.az];
        }).concat([
          ['읽는 법', '수명 주기 규칙의 전환 시점은 이 기간보다 짧게 잡을 수 없습니다',
           '이 크기보다 작은 객체도 이 크기로 청구됩니다 — 작은 객체를 대량으로 옮기면 손해입니다',
           'One Zone-IA 만 단일 가용 영역입니다']
        ])
      }
    };
  });

  /* --------------------------------------------------------------------------
     C-012 — Glacier 검색 옵션별 소요 시간
     --------------------------------------------------------------------------
     [확인 수치] docs/FACT_SOURCES.md §4.3
       Glacier Flexible Retrieval 신속(Expedited) 1–5분 · 대량(Bulk) 5–12시간
       Glacier Deep Archive 기본 검색 12시간
     범위이므로 [min, max] 부동 막대로 그립니다. 분 단위로 환산하면 1 ~ 720 이라
     선형 축에서는 신속 검색 막대가 사라집니다. 그래서 로그 축을 씁니다.
     Deep Archive 는 범위가 아니라 단일 값이므로 폭이 0 입니다 —
     minBarLength 로 표식만 남기고, 단일 값이라는 사실을 표에 적습니다.
     -------------------------------------------------------------------------- */
  register('C-012', function (ctx) {
    var rows = [
      { label: 'Glacier Flexible — 신속 (Expedited)', span: [1, 5],
        text: '1 ~ 5분', note: '가장 빠른 복원 옵션입니다. 급히 꺼내야 하는 소수의 객체에 씁니다' },
      { label: 'Glacier Flexible — 대량 (Bulk)', span: [300, 720],
        text: '5 ~ 12시간', note: '대량 복원의 무료 옵션입니다. 시간이 걸리는 대신 검색 요금이 붙지 않습니다' },
      { label: 'Glacier Deep Archive — 기본', span: [720, 720],
        text: '12시간 (단일 값)', note: '가장 저렴한 보관 대신 가장 긴 복원 시간입니다. RTO 가 12시간보다 짧으면 후보에서 빠집니다' }
    ];
    var borders = ctx.palette(3);

    return {
      type: 'bar',
      height: 300,
      data: {
        labels: rows.map(function (r) { return r.label; }),
        datasets: [{
          label: '검색 소요 시간',
          data: rows.map(function (r) { return r.span.slice(); }),
          backgroundColor: borders.map(function (c) { return ctx.alpha(c, 0.55); }),
          borderColor: borders,
          borderWidth: 1.5,
          borderSkipped: false,
          minBarLength: 6,
          barPercentage: 0.7
        }]
      },
      options: {
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (item) { return rows[item.dataIndex].text; }
            }
          }
        },
        scales: {
          x: {
            type: 'logarithmic', min: 1, max: 1440,
            title: { display: true, text: '소요 시간 (로그 눈금)', color: ctx.color('textMuted') },
            ticks: {
              callback: function (v) {
                return ({ 1: '1분', 5: '5분', 10: '10분', 60: '1시간', 100: '', 300: '5시간', 600: '10시간', 720: '12시간', 1000: '', 1440: '24시간' })[v];
              }
            }
          },
          y: { grid: { display: false }, ticks: { autoSkip: false } }
        }
      },
      a11yCaption: 'Glacier 검색 옵션별 소요 시간 — 신속 1~5분, 대량 5~12시간, Deep Archive 12시간',
      a11yTable: {
        caption: 'Glacier 검색 옵션별 소요 시간 (docs/FACT_SOURCES.md §4.3 확인 값 · 가로축은 로그 눈금)',
        head: ['클래스 · 검색 옵션', '소요 시간', '설계에 주는 함의'],
        rows: rows.map(function (r) { return [r.label, r.text, r.note]; }).concat([
          ['복원 요청 처리량', '계정당 초당 최대 1,000 트랜잭션', '두 클래스 모두 같은 상한을 공유합니다'],
          ['Glacier Instant Retrieval', '복원 없이 밀리초 접근', '"드물게 읽지만 읽을 때는 즉시"에 해당하면 이 클래스입니다 — 이 그림의 세 옵션과 무관합니다']
        ])
      }
    };
  });

  /* ==========================================================================
     ─────────────────── C-020 ~ C-022 · EBS · 블록 스토리지 (ch06) ───────────────────
     ========================================================================== */

  /* --------------------------------------------------------------------------
     C-020 — EBS 볼륨 타입별 최대 IOPS
     --------------------------------------------------------------------------
     [확인 수치] docs/FACT_SOURCES.md §4.4 (botocore ec2 CreateVolumeRequest)
       gp3 80,000 / io1 64,000 / io2 256,000
     ⚠️ gp2 는 넣지 않습니다. gp2 는 Iops 파라미터를 받지 않아 API 모델에 최대 IOPS 가
        없고, FACT_SOURCES.md §5 의 "확인 못 한 숫자"에 올라 있습니다. ch06 캡션도
        그 사실을 적어 두었습니다. st1·sc1 도 같은 이유로 제외합니다.
     ⚠️ 카탈로그는 로그 축을 적어 두었지만 선형 축으로 그립니다. 값의 폭이 4배뿐이라
        로그 축은 "io2 가 압도적으로 높다"는 캡션의 결론을 오히려 눌러 버립니다.
     -------------------------------------------------------------------------- */
  register('C-020', function (ctx) {
    var rows = [
      { label: 'io2', kind: 'Provisioned IOPS SSD', iops: 256000,
        note: 'Nitro 시스템 기반 인스턴스에서 256,000 IOPS 까지. 그 외 인스턴스는 32,000 이 상한입니다' },
      { label: 'gp3', kind: 'General Purpose SSD', iops: 80000,
        note: '2025년 9월 상향된 값입니다. 기준값 3,000 IOPS 는 크기와 무관하게 제공됩니다' },
      { label: 'io1', kind: 'Provisioned IOPS SSD', iops: 64000,
        note: '현행 기준으로 gp3 보다 낮습니다. 신규 설계에서 io1 을 고를 이유는 거의 없습니다' }
    ];
    var borders = ctx.palette(3);

    return {
      type: 'bar',
      height: 320,
      data: {
        labels: rows.map(function (r) { return r.label; }),
        datasets: [{
          label: '프로비저닝 가능한 최대 IOPS',
          data: rows.map(function (r) { return r.iops; }),
          backgroundColor: borders.map(function (c) { return ctx.alpha(c, 0.55); }),
          borderColor: borders,
          borderWidth: 1.5,
          maxBarThickness: 96
        }]
      },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (item) { return n(item.parsed.y) + ' IOPS'; }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: '최대 IOPS', color: ctx.color('textMuted') },
            ticks: { callback: function (v) { return n(v); } }
          },
          x: { grid: { display: false } }
        }
      },
      a11yCaption: 'EBS 볼륨 타입별 프로비저닝 가능한 최대 IOPS — io2 256,000, gp3 80,000, io1 64,000. gp2 는 확인된 값이 없어 제외했습니다',
      a11yTable: {
        caption: 'EBS 볼륨 타입별 최대 IOPS (docs/FACT_SOURCES.md §4.4 확인 값)',
        head: ['볼륨 타입', '분류', '최대 IOPS', '비고'],
        rows: rows.map(function (r) { return [r.label, r.kind, n(r.iops), r.note]; }).concat([
          ['gp2', 'General Purpose SSD', '이 그림에 넣지 않았습니다',
           'gp2 는 Iops 파라미터를 받지 않아 AWS API 모델에 최대 IOPS 가 없습니다. 널리 유통되는 숫자가 있지만 1차 소스로 확인하지 못해 축에 올리지 않습니다'],
          ['st1 · sc1 (HDD)', 'Throughput Optimized · Cold HDD', '해당 없음',
           'HDD 계열의 지배적 지표는 IOPS 가 아니라 처리량입니다. 기준·버스트 처리량 수치도 API 모델에 없습니다'],
          ['인스턴스 측 제한', '—', 'Nitro 256,000 / 그 외 32,000',
           '볼륨이 감당해도 인스턴스가 못 받으면 그 수치는 나오지 않습니다']
        ])
      }
    };
  });

  /* --------------------------------------------------------------------------
     C-021 — gp3 상한: 구 자료의 값 대 현행 값 (이 사이트의 대표 교정 차트)
     --------------------------------------------------------------------------
     [확인 수치] docs/FACT_SOURCES.md §4.4 · §7 #5 · ch06 "gp3 상한 변경" 표
       최대 크기 16 TiB → 64 TiB · 최대 IOPS 16,000 → 80,000 · 최대 처리량 1,000 → 2,000 MiB/s
       기준값 3,000 IOPS / 125 MiB/s 는 변경 없음 (2025-09)
     세 항목의 단위와 자릿수가 전부 달라(16 ~ 80,000) 로그 축을 씁니다.
     "기준값만 그대로"가 캡션의 결론이므로 기준값 계열을 함께 그립니다.
     최대 크기에는 기준값 개념이 없으므로 그 자리는 비웁니다(null).
     -------------------------------------------------------------------------- */
  register('C-021', function (ctx) {
    var labels = ['최대 IOPS', '최대 처리량 (MiB/s)', '최대 크기 (TiB)'];
    var old  = [16000, 1000, 16];
    var now  = [80000, 2000, 64];
    var base = [3000, 125, null];
    var units = ['IOPS', 'MiB/s', 'TiB'];

    return {
      type: 'bar',
      height: 360,
      data: {
        labels: labels,
        datasets: [
          bar(ctx, 4, '구 자료의 값 (시중 자료 다수)', old),
          bar(ctx, 0, '현행 값 (2025-09 상향)', now),
          bar(ctx, 1, '기준값 — 변경 없음', base)
        ]
      },
      options: {
        scales: {
          y: {
            type: 'logarithmic', min: 10, max: 200000,
            title: { display: true, text: '값 (로그 눈금)', color: ctx.color('textMuted') },
            ticks: { callback: function (v) { return n(v); } }
          },
          x: { grid: { display: false } }
        },
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: function (item) {
                if (item.parsed.y == null) return item.dataset.label + ' — 해당 없음';
                return item.dataset.label + ' — ' + n(item.parsed.y) + ' ' + units[item.dataIndex];
              }
            }
          }
        }
      },
      a11yCaption: 'gp3 상한의 변경 전후 — 최대 IOPS 16,000에서 80,000, 최대 처리량 1,000에서 2,000 MiB/s, 최대 크기 16에서 64 TiB로 올랐고 기준값 3,000 IOPS · 125 MiB/s 는 그대로입니다',
      a11yTable: {
        caption: 'gp3 상한의 변경 전후 비교 — 2025년 9월 상향 (docs/FACT_SOURCES.md §4.4 · §7 확인 값 · 세로축은 로그 눈금)',
        head: ['항목', '이전 값 (시중 자료 다수)', '현행 값', '기준값 (변경 없음)'],
        rows: [
          ['최대 IOPS', '16,000', '80,000', '3,000 IOPS'],
          ['최대 처리량', '1,000 MiB/s', '2,000 MiB/s', '125 MiB/s'],
          ['최대 크기', '16 TiB', '64 TiB (65,536 GiB)', '기준값 개념 없음'],
          ['이 차이가 중요한 이유',
           '"gp3 는 최대 16,000 IOPS" 로 외우면 "gp3 로는 부족하니 io1 으로" 라는 결론에 이릅니다',
           '현행 기준으로 gp3 의 최대 IOPS(80,000)는 io1(64,000)보다 높습니다',
           '바뀐 것은 상한뿐입니다. 기준값은 크기와 무관하게 그대로 제공됩니다']
        ]
      }
    };
  });

  /* --------------------------------------------------------------------------
     C-022 — EBS 볼륨 타입별 크기 범위
     --------------------------------------------------------------------------
     [확인 수치] docs/FACT_SOURCES.md §4.4 (botocore ec2 CreateVolumeRequest)
       gp2 1–16,384 / gp3 1–65,536 / io1 4–16,384 / io2 4–65,536 / st1·sc1 125–16,384 GiB
     범위이므로 [min, max] 부동 막대. 1 ~ 65,536 이라 로그 축을 씁니다.
     (크기 범위는 gp2 도 API 모델에 있으므로 넣습니다. 제외한 것은 gp2 의 IOPS 뿐입니다.)
     -------------------------------------------------------------------------- */
  register('C-022', function (ctx) {
    var rows = [
      { label: 'gp3',  span: [1, 65536],  kind: 'General Purpose SSD',    boot: '가능' },
      { label: 'io2',  span: [4, 65536],  kind: 'Provisioned IOPS SSD',   boot: '가능' },
      { label: 'gp2',  span: [1, 16384],  kind: 'General Purpose SSD',    boot: '가능' },
      { label: 'io1',  span: [4, 16384],  kind: 'Provisioned IOPS SSD',   boot: '가능' },
      { label: 'st1',  span: [125, 16384], kind: 'Throughput Optimized HDD', boot: '불가' },
      { label: 'sc1',  span: [125, 16384], kind: 'Cold HDD',              boot: '불가' }
    ];
    /* 계열 색은 5개가 한계이므로(§2-3) 색으로 6개를 구분시키지 않습니다.
       SSD/HDD 두 묶음으로만 나누고, 개별 타입은 축 라벨과 정렬 순서로 읽습니다. */
    var ssd = ctx.pair(0, 0.55);
    var hdd = ctx.pair(2, 0.55);

    return {
      type: 'bar',
      height: 360,
      data: {
        labels: rows.map(function (r) { return r.label; }),
        datasets: [{
          label: '크기 범위 (GiB) — 파랑 계열 SSD · 주황 계열 HDD',
          data: rows.map(function (r) { return r.span.slice(); }),
          backgroundColor: rows.map(function (r) { return /HDD/.test(r.kind) ? hdd.fill : ssd.fill; }),
          borderColor: rows.map(function (r) { return /HDD/.test(r.kind) ? hdd.border : ssd.border; }),
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
                var s = rows[item.dataIndex].span;
                return n(s[0]) + ' – ' + n(s[1]) + ' GiB';
              }
            }
          }
        },
        scales: {
          x: {
            type: 'logarithmic', min: 1, max: 100000,
            title: { display: true, text: '볼륨 크기 (GiB · 로그 눈금)', color: ctx.color('textMuted') },
            ticks: {
              callback: function (v) {
                return ({ 1: '1', 4: '4', 10: '10', 100: '100', 125: '125', 1000: '1,000',
                          10000: '10,000', 16384: '16,384 (16 TiB)', 65536: '65,536 (64 TiB)' })[v];
              }
            }
          },
          y: { grid: { display: false }, ticks: { autoSkip: false } }
        }
      },
      a11yCaption: 'EBS 볼륨 타입별 크기 범위 — gp3와 io2만 65,536 GiB(64 TiB)까지 올라가고, HDD 두 타입은 125 GiB부터 시작합니다',
      a11yTable: {
        caption: 'EBS 볼륨 타입별 크기 범위 (docs/FACT_SOURCES.md §4.4 확인 값 · 가로축은 로그 눈금)',
        head: ['볼륨 타입', '분류', '크기 범위', '부팅 볼륨'],
        rows: rows.map(function (r) {
          return [r.label, r.kind, n(r.span[0]) + ' – ' + n(r.span[1]) + ' GiB', r.boot];
        }).concat([
          ['standard', '마그네틱 (구세대)', '1 – 1,024 GiB', '가능하지만 새로 쓰지 않습니다'],
          ['읽는 법', '64 TiB 가 필요하면 후보는 gp3 와 io2 둘뿐입니다',
           'HDD 두 타입은 125 GiB 미만을 만들 수 없습니다', 'st1 과 sc1 은 부팅 볼륨으로 쓸 수 없습니다']
        ])
      }
    };
  });

  /* ==========================================================================
     ─────────────────── C-030 · EC2 · 컴퓨팅 (ch05) ───────────────────
     ========================================================================== */

  /* --------------------------------------------------------------------------
     C-030 — EC2 구매 옵션의 상대 비용 대 유연성
     --------------------------------------------------------------------------
     [상대 등급] 금액은 확인 불가입니다 (FACT_SOURCES.md §5 — 요금 전면 금지.
     할인율도 마찬가지입니다). 두 축 모두 1~5 등급이며 눈금 라벨은 말입니다.

     등급은 ch05 "구매 옵션 5종 — 무엇을 약정하는가" 표의 확인된 서술
     (무엇을 약정하는가 · 중단 가능성)에서 파생한 순서일 뿐, 측정값이 아닙니다.
     이 사실을 a11yTable 첫 줄에 적습니다.
     -------------------------------------------------------------------------- */
  register('C-030', function (ctx) {
    var pts = [
      { label: '온디맨드', x: 4, y: 5, style: 'circle',
        commit: '없음 — 실행한 만큼만 지불', stop: '없음',
        why: '아무것도 약정하지 않는 대신 단가가 가장 높은 축입니다. 예측이 안 되는 초기 단계의 기본값' },
      { label: 'Savings Plans', x: 2, y: 3, style: 'rect',
        commit: '시간당 사용 금액을 1년 또는 3년', stop: '없음',
        why: '금액만 약정하므로 인스턴스 구성을 바꿀 여지가 남습니다 — 예약 인스턴스보다 유연합니다' },
      { label: '예약 인스턴스 (RI)', x: 2, y: 2, style: 'triangle',
        commit: '인스턴스 구성(타입·리전 등)을 1년 또는 3년', stop: '없음',
        why: '구성을 고정하는 대신 특정 가용 영역의 용량 확보가 가능합니다' },
      { label: '스팟 인스턴스', x: 1, y: 1, style: 'rectRot',
        commit: '없음 — 대신 AWS 가 용량을 회수할 수 있음', stop: '있음 — 2분 전 통지 후 중단',
        why: '단가는 가장 낮지만 중단을 감수해야 하므로 워크로드가 제한됩니다' },
      { label: '전용 호스트 · 전용 인스턴스', x: 5, y: 2, style: 'star',
        commit: '물리 서버 단위 또는 단일 테넌트 하드웨어', stop: '없음',
        why: '비용 절감 수단이 아니라 라이선스·규정 준수 수단입니다. 그래서 오른쪽 위가 아니라 오른쪽 아래에 있습니다' }
    ];
    var costWords = ['', '가장 저렴', '저렴', '보통', '비쌈', '가장 비쌈'];
    var flexWords = ['', '제약 가장 큼', '제약 큼', '보통', '자유로움', '제약 없음'];
    var colors = ctx.palette(5);

    return {
      type: 'scatter',
      height: 380,
      data: {
        datasets: pts.map(function (p, i) {
          return {
            label: p.label,
            data: [{ x: p.x, y: p.y }],
            backgroundColor: ctx.alpha(colors[i], 0.7),
            borderColor: colors[i],
            borderWidth: 2,
            pointStyle: p.style,      // 색만으로 구분하지 않습니다 (접근성 계약)
            pointRadius: 11,
            pointHoverRadius: 14
          };
        })
      },
      options: {
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: function (item) {
                var p = pts[item.datasetIndex];
                return p.label + ' — 비용 ' + costWords[p.x] + ' · 유연성 ' + flexWords[p.y];
              }
            }
          }
        },
        scales: {
          x: {
            min: 0, max: 6,
            title: { display: true, text: '상대 비용 등급 (금액 아님) →', color: ctx.color('textMuted') },
            ticks: { stepSize: 1, autoSkip: false, callback: scaleTicks(costWords) },
            grid: { color: ctx.color('grid') }
          },
          y: {
            min: 0, max: 6,
            title: { display: true, text: '유연성 등급 →', color: ctx.color('textMuted') },
            ticks: { stepSize: 1, autoSkip: false, callback: scaleTicks(flexWords) }
          }
        }
      },
      a11yCaption: 'EC2 구매 옵션 다섯 가지를 상대 비용 등급과 유연성 등급 두 축 위에 놓은 그래프입니다. ' + REL_NOTE,
      a11yTable: {
        caption: 'EC2 구매 옵션의 상대 위치 — 두 축 모두 1~5 순서 척도이며 금액도 할인율도 아닙니다 ' +
                 '(등급은 ch05 "무엇을 약정하는가" 표에서 파생한 순서이고 측정값이 아닙니다)',
        head: ['구매 옵션', '비용 등급 (1 저렴 → 5 비쌈)', '유연성 등급 (1 제약 큼 → 5 제약 없음)', '무엇을 약정하는가', '중단 가능성', '이 위치인 이유'],
        rows: pts.map(function (p) {
          return [p.label, p.x + ' (' + costWords[p.x] + ')', p.y + ' (' + flexWords[p.y] + ')',
                  p.commit, p.stop, p.why];
        }).concat([
          ['읽는 법', REL_NOTE, '왼쪽으로 갈수록 싸고, 아래로 갈수록 포기하는 것이 많습니다',
           '약정을 늘릴수록 왼쪽으로 가고 아래로 내려갑니다', '—',
           '전용 호스트만 이 흐름에서 벗어납니다 — 비용이 아니라 격리 요구에서 선택되기 때문입니다']
        ])
      }
    };
  });

  /* ==========================================================================
     ─────────────────── C-040 · C-041 · 재해 복구 (ch18) ───────────────────
     ========================================================================== */

  /* --------------------------------------------------------------------------
     C-040 — DR 4전략의 RTO / RPO 위치
     --------------------------------------------------------------------------
     [상대 등급 · 순서 척도] 전략별 RTO·RPO 의 절대값은 요구사항에 따라 정해지는
     것이지 AWS 가 고정해 둔 수치가 아닙니다. 그래서 축 눈금은 "분 / 시간 / 일"
     같은 구간이고, 특정 전략의 RTO 를 숫자로 단정하지 않습니다 (ch18 캡션과 동일).
     구간의 순서는 ch18 "DR 4전략의 구성과 교환 관계" 표의 서술
     (가장 깁니다 / 백업·복원보다 짧습니다 / 파일럿 라이트보다 짧습니다 / 가장 짧습니다)에서 옵니다.
     -------------------------------------------------------------------------- */
  register('C-040', function (ctx) {
    var pts = [
      { label: '백업 및 복원', x: 4, y: 3, style: 'circle',
        live: '백업만 다른 리전에 보관합니다. 인프라는 없습니다', cost: '가장 낮음' },
      { label: '파일럿 라이트', x: 3, y: 2, style: 'rect',
        live: '데이터 복제는 계속되고 데이터베이스 같은 핵심 코어만 최소 규모로 켜 둡니다', cost: '낮음' },
      { label: '웜 스탠바이', x: 2, y: 2, style: 'triangle',
        live: '전체 스택이 축소된 규모로 항상 떠 있습니다. 트래픽만 받지 않습니다', cost: '높음' },
      { label: '다중 사이트 액티브-액티브', x: 1, y: 1, style: 'rectRot',
        live: '양쪽이 모두 운영 트래픽을 처리합니다', cost: '가장 높음' }
    ];
    var band = ['', '실시간 (초)', '분', '시간', '시간 ~ 일'];
    var colors = ctx.palette(4);

    return {
      type: 'scatter',
      height: 380,
      data: {
        datasets: pts.map(function (p, i) {
          return {
            label: p.label,
            data: [{ x: p.x, y: p.y }],
            backgroundColor: ctx.alpha(colors[i], 0.7),
            borderColor: colors[i],
            borderWidth: 2,
            pointStyle: p.style,
            pointRadius: 11,
            pointHoverRadius: 14
          };
        })
      },
      options: {
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: function (item) {
                var p = pts[item.datasetIndex];
                return p.label + ' — RTO ' + band[p.x] + ' 구간 · RPO ' + band[p.y] + ' 구간';
              }
            }
          }
        },
        scales: {
          x: {
            min: 0, max: 5,
            title: { display: true, text: 'RTO — 복구까지 걸리는 시간 구간 (왼쪽일수록 빠름)', color: ctx.color('textMuted') },
            ticks: { stepSize: 1, autoSkip: false, callback: scaleTicks(band) }
          },
          y: {
            min: 0, max: 5,
            title: { display: true, text: 'RPO — 손실 구간 (아래일수록 적음)', color: ctx.color('textMuted') },
            ticks: { stepSize: 1, autoSkip: false, callback: scaleTicks(band) }
          }
        }
      },
      a11yCaption: 'DR 네 전략을 RTO 축과 RPO 축 위에 배치한 그래프입니다. 축의 눈금은 실시간·분·시간·일 같은 구간이며 특정 전략의 RTO 를 숫자로 단정하지 않습니다.',
      a11yTable: {
        caption: 'DR 4전략의 RTO · RPO 구간 — 눈금은 시간 구간(순서 척도)이며 특정 전략의 RTO·RPO 를 숫자로 단정하지 않습니다 (ch18 "DR 4전략의 구성과 교환 관계" 표 기준)',
        head: ['전략', 'RTO 구간', 'RPO 구간', '평소에 무엇이 켜져 있는가', '상시 비용 (상대)'],
        rows: pts.map(function (p) {
          return [p.label, band[p.x] + ' 구간', band[p.y] + ' 구간', p.live, p.cost];
        }).concat([
          ['읽는 법', '왼쪽 아래로 갈수록 빠른 복구와 적은 손실입니다',
           '같은 구간에 두 전략이 있으면 그 축으로는 갈리지 않는다는 뜻입니다',
           '요구값(RTO·RPO)을 먼저 정하고 그 구간에 닿는 가장 왼쪽 아래 전략을 고릅니다',
           '상시 비용은 상대 순서이며 금액이 아닙니다']
        ])
      }
    };
  });

  /* --------------------------------------------------------------------------
     C-041 — DR 전략별 상시 가동 범위와 복구 시간
     --------------------------------------------------------------------------
     [상대 등급] 비용 축에 금액을 쓰지 않습니다 (FACT_SOURCES.md §5).
     "상시 가동 범위가 넓어질수록 복구 시간이 짧아진다"는 ch18 캡션의 결론을
     두 선이 서로 엇갈리는 모양으로 보입니다. 등급은 ch18 표의 서술 순서입니다.
     -------------------------------------------------------------------------- */
  register('C-041', function (ctx) {
    var rows = [
      { label: '백업 및 복원',   live: 1, rto: 4,
        what: '백업만 다른 리전에 보관합니다. 인프라는 없습니다', cost: '가장 낮음' },
      { label: '파일럿 라이트',  live: 2, rto: 3,
        what: '데이터 복제 + 핵심 코어(데이터베이스 등)만 최소 규모로 상시 가동', cost: '낮음' },
      { label: '웜 스탠바이',    live: 3, rto: 2,
        what: '전체 스택이 축소된 규모로 상시 가동. 트래픽만 받지 않습니다', cost: '높음' },
      { label: '다중 사이트 액티브-액티브', live: 4, rto: 1,
        what: '양쪽이 모두 운영 트래픽을 처리합니다', cost: '가장 높음' }
    ];
    var words = ['', '가장 낮음 · 가장 짧음', '낮음 · 짧음', '높음 · 긺', '가장 높음 · 가장 긺'];

    var a = ctx.pair(0, 0.18);
    var b = ctx.pair(3, 0.18);

    return {
      type: 'line',
      height: 340,
      data: {
        labels: rows.map(function (r) { return r.label; }),
        datasets: [
          {
            label: '상시 가동 범위 등급 (= 상시 비용 등급)',
            data: rows.map(function (r) { return r.live; }),
            borderColor: a.border, backgroundColor: a.fill,
            borderWidth: 2, tension: 0.2, fill: false,
            pointStyle: 'circle', pointRadius: 6, pointHoverRadius: 9,
            pointBackgroundColor: a.border, pointBorderColor: ctx.color('fill')
          },
          {
            label: '복구 시간(RTO) 등급',
            data: rows.map(function (r) { return r.rto; }),
            borderColor: b.border, backgroundColor: b.fill,
            borderWidth: 2, tension: 0.2, fill: false,
            borderDash: [6, 4],       // 색만으로 구분하지 않습니다
            pointStyle: 'rectRot', pointRadius: 7, pointHoverRadius: 10,
            pointBackgroundColor: b.border, pointBorderColor: ctx.color('fill')
          }
        ]
      },
      options: {
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: function (item) {
                return item.dataset.label + ' — ' + item.parsed.y + '등급 (' + words[item.parsed.y] + ')';
              }
            }
          }
        },
        scales: {
          y: {
            min: 0, max: 5,
            title: { display: true, text: '상대 등급 (금액 아님)', color: ctx.color('textMuted') },
            ticks: {
              stepSize: 1, autoSkip: false,
              callback: function (v) { return (v >= 1 && v <= 4) ? v + '등급' : ''; }
            }
          },
          x: { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 20 } }
        }
      },
      a11yCaption: 'DR 전략별 상시 가동 범위와 복구 시간의 관계 — 상시 가동 범위가 넓어질수록 복구 시간이 짧아집니다. 두 축 모두 상대 등급이며 금액이 아닙니다.',
      a11yTable: {
        caption: 'DR 전략별 상시 가동 범위와 복구 시간 — 값은 1~4 순서 척도이며 금액이 아닙니다 (ch18 "DR 4전략의 구성과 교환 관계" 표 기준)',
        head: ['전략', '상시 가동 범위 등급', '복구 시간(RTO) 등급', '평소에 무엇이 켜져 있는가', '상시 비용 (상대)'],
        rows: rows.map(function (r) {
          return [r.label, r.live + ' / 4', r.rto + ' / 4', r.what, r.cost];
        }).concat([
          ['등급의 정의', '1 = 켜 두는 것이 가장 적음 → 4 = 가장 많음', '1 = 복구가 가장 빠름 → 4 = 가장 오래 걸림',
           '두 선이 서로 엇갈리는 것이 이 그림의 결론입니다 — 한쪽을 얻으면 다른 쪽을 냅니다',
           REL_NOTE]
        ])
      }
    };
  });

  /* ==========================================================================
     ─────────────────── C-050 · 비용 · 데이터 전송 (ch18) ───────────────────
     ========================================================================== */

  /* --------------------------------------------------------------------------
     C-050 — 데이터 전송의 과금 범주 지도
     --------------------------------------------------------------------------
     [범주] 금액이 아니라 분류입니다. 축의 값은 1·2·3 이 아니라
     "무료·최저 / 리전 내 과금 / 리전 간·인터넷 아웃" 이라는 세 범주입니다.
     방향과 범주는 ch18 "데이터 전송 방향별 과금 여부와 설계 함의" 표에서 옵니다.

     ⚠️ CloudFront 경유는 막대에 넣지 않았습니다. 카탈로그 §4-2 는 후보로 적어
        두었지만, ch18 본문 표에 CloudFront 행이 없고 "CloudFront 를 거치면
        어느 범주인가"를 이 환경에서 1차 소스로 확인할 수 없기 때문입니다.
        대신 설계 행동으로서의 역할만 표에 남깁니다.
     -------------------------------------------------------------------------- */
  register('C-050', function (ctx) {
    var CAT = ['', '무료 · 최저', '리전 내 과금', '리전 간 · 인터넷 아웃'];
    var rows = [
      { label: '인터넷 → AWS (수신)', cat: 1, bill: '대체로 무료',
        why: '데이터를 올리는 것은 대체로 비용 요인이 아닙니다. 마이그레이션 방향이 유리한 이유입니다' },
      { label: '같은 가용 영역 · 프라이빗 IP', cat: 1, bill: '가장 저렴한 경로',
        why: '퍼블릭 IP 나 인터넷 경유로 우회하지 않도록 프라이빗 주소로 통신하게 합니다' },
      { label: '같은 리전 · 가용 영역 간', cat: 2, bill: '과금',
        why: '다중 가용 영역은 가용성을 사면서 전송 비용을 함께 부릅니다. 대량 트래픽이 불필요하게 AZ 를 넘지 않게 배치합니다' },
      { label: 'NAT 게이트웨이 경유', cat: 2, bill: '시간 요금 + 처리 데이터 요금',
        why: '목적지가 어디든 통과한 모든 기가바이트에 처리 요금이 붙습니다. 지나지 않게 만드는 것(VPC 엔드포인트)이 유일한 절감입니다' },
      { label: '리전 간', cat: 3, bill: '과금',
        why: '교차 리전 복제, 리전 간 백업, 다중 리전 DR 은 언제나 전송 비용을 동반합니다' },
      { label: 'AWS → 인터넷 (송신)', cat: 3, bill: '과금',
        why: '가장 큰 전송 비용 항목입니다. 송신량 자체를 줄이거나 CloudFront 로 캐시해 오리진 송신을 줄입니다' }
    ];
    /* 범주 셋을 색으로 구분하되, 축 눈금 라벨이 같은 정보를 말로 전달합니다. */
    var byCat = { 1: ctx.color('ok'), 2: ctx.color('warn'), 3: ctx.color('danger') };

    return {
      type: 'bar',
      height: 360,
      data: {
        labels: rows.map(function (r) { return r.label; }),
        datasets: [{
          label: '과금 범주',
          data: rows.map(function (r) { return r.cat; }),
          backgroundColor: rows.map(function (r) { return ctx.alpha(byCat[r.cat], 0.55); }),
          borderColor: rows.map(function (r) { return byCat[r.cat]; }),
          borderWidth: 1.5,
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
                return CAT[item.parsed.x] + ' — ' + rows[item.dataIndex].bill;
              }
            }
          }
        },
        scales: {
          x: {
            min: 0, max: 3.4,
            title: { display: true, text: '과금 범주 (금액이 아닙니다)', color: ctx.color('textMuted') },
            ticks: { stepSize: 1, callback: scaleTicks(CAT) }
          },
          y: { grid: { display: false }, ticks: { autoSkip: false } }
        }
      },
      a11yCaption: '데이터 전송 방향별 과금 범주 — 인바운드와 같은 가용 영역 내 프라이빗 통신이 가장 낮고, 가용 영역 간·NAT 경유가 그다음, 리전 간과 인터넷 송신이 가장 높습니다. 축의 값은 범주이며 금액이 아닙니다.',
      a11yTable: {
        caption: '데이터 전송 방향별 과금 범주 — 값이 아니라 분류입니다 (ch18 "데이터 전송 방향별 과금 여부와 설계 함의" 표 기준 · 금액은 싣지 않습니다)',
        head: ['방향', '과금 범주', '과금 여부', '설계에 주는 함의'],
        rows: rows.map(function (r) { return [r.label, CAT[r.cat], r.bill, r.why]; }).concat([
          ['CloudFront 경유', '이 그림에 넣지 않았습니다', '—',
           'CloudFront 는 범주를 하나 차지하는 방향이 아니라, 인터넷 송신을 줄이는 설계 행동입니다. 오리진 송신량을 줄이는 쪽으로 작동합니다'],
          ['확인 순서', '—', '—',
           '(1) 인터넷으로 나가는가 → CloudFront 캐싱 (2) AZ·리전을 넘는가 → 배치 수정 (3) NAT 를 지나는가 → VPC 엔드포인트'],
          ['주의', '—', '—',
           '"업로드 비용을 줄인다"는 선택지는 대체로 무의미합니다. 수신은 대체로 무료입니다']
        ])
      }
    };
  });

  /* ==========================================================================
     ─────────────────── C-060 · 로드 밸런싱 (ch07) ───────────────────
     ========================================================================== */

  /* --------------------------------------------------------------------------
     C-060 — ALB · NLB · GWLB 특성 프로파일
     --------------------------------------------------------------------------
     [확인 수치 + 특성 등급화] docs/FACT_SOURCES.md §4.9 (botocore elbv2
     LoadBalancerTypeEnum · ProtocolEnum) 와 ch07 "로드 밸런서 3종의 계층 ·
     프로토콜 · 특성 비교" 표에서 확인된 사실을 1~3 등급으로 바꾼 것입니다.
     radar 는 축마다 단위가 다르면 성립하지 않으므로 공통 등급이 필요합니다.
     등급의 기준은 a11yTable 에 그대로 적습니다 (ch07 캡션이 그렇게 약속했습니다).
     -------------------------------------------------------------------------- */
  register('C-060', function (ctx) {
    var axes = [
      { label: '동작 계층', rule: 'L3 게이트웨이 = 1 · L4 전송 = 2 · L7 애플리케이션 = 3' },
      { label: '지원 프로토콜 폭', rule: 'API 열거값 1종 = 1 · 2종 = 2 · 6종 = 3' },
      { label: '고정 IP (EIP)', rule: '지정 불가 = 1 · 지정 가능 = 3' },
      { label: '라우팅 판단의 정교함', rule: '흐름 유지만 = 1 · 소스 IP = 2 · 호스트/경로/헤더/쿼리/메서드 = 3' },
      { label: '어플라이언스 삽입 (GENEVE)', rule: '해당 없음 = 1 · 전용 = 3' }
    ];
    var lbs = [
      { name: 'ALB (application)', v: [3, 2, 1, 3, 1],
        proto: 'HTTP, HTTPS (2종)', layer: 'L7 (애플리케이션)',
        eip: '지정 불가', route: '호스트 헤더 · URL 경로 · HTTP 헤더 · 쿼리 문자열 · 메서드 · 소스 IP',
        use: 'HTTP 마이크로서비스 라우팅, 인증 연동, 리디렉션' },
      { name: 'NLB (network)', v: [2, 3, 3, 2, 1],
        proto: 'TCP, TLS, UDP, TCP_UDP, QUIC, TCP_QUIC (6종)', layer: 'L4 (전송)',
        eip: '서브넷당 1개 지정 가능', route: '소스 IP (그리고 dual-stack NLB 의 리스너 규칙)',
        use: '초고성능 TCP·UDP, 고정 IP 요구, 게임 · IoT · VoIP' },
      { name: 'GWLB (gateway)', v: [1, 1, 1, 1, 3],
        proto: 'GENEVE (포트 6081, 1종)', layer: 'L3 게이트웨이 + L4 로드 밸런서',
        eip: '지정 불가', route: '어플라이언스로의 흐름 유지',
        use: '서드파티 방화벽 · IDS/IPS 어플라이언스 삽입' }
    ];
    var colors = ctx.palette(3);
    var grid = ctx.color('grid');

    return {
      type: 'radar',
      height: 400,
      data: {
        labels: axes.map(function (a) { return a.label; }),
        datasets: lbs.map(function (lb, i) {
          return {
            label: lb.name,
            data: lb.v,
            backgroundColor: ctx.alpha(colors[i], 0.16),
            borderColor: colors[i],
            borderWidth: 2,
            borderDash: i === 1 ? [6, 4] : (i === 2 ? [2, 3] : []),   // 색만으로 구분하지 않습니다
            pointStyle: ['circle', 'rect', 'triangle'][i],
            pointBackgroundColor: colors[i],
            pointBorderColor: ctx.color('fill'),
            pointRadius: 5,
            pointHoverRadius: 8
          };
        })
      },
      options: {
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: function (item) {
                return item.dataset.label + ' — ' + axes[item.dataIndex].label + ' ' + item.parsed.r + '등급 (3 등급 만점)';
              }
            }
          }
        },
        scales: {
          x: { display: false },
          y: { display: false },
          r: {
            min: 0, max: 3,
            ticks: {
              stepSize: 1,
              color: ctx.color('textMuted'),
              backdropColor: ctx.alpha(ctx.color('fill'), 0.85),
              font: { family: ctx.fontFamily, size: 11 },
              callback: function (v) { return v === 0 ? '' : String(v); }
            },
            grid: { color: grid },
            angleLines: { color: grid },
            pointLabels: { color: ctx.color('text'), font: { family: ctx.fontFamily, size: 12 } }
          }
        }
      },
      a11yCaption: 'ALB · NLB · GWLB 의 특성 프로파일을 다섯 축에서 1~3 등급으로 비교한 그래프입니다. 축의 값은 절대 수치가 아니라 확인된 특성을 등급화한 것입니다.',
      a11yTable: {
        caption: '로드 밸런서 3종의 특성 등급 — 등급은 확인된 사실(docs/FACT_SOURCES.md §4.9 · ch07 비교표)을 1~3 순서 척도로 바꾼 것입니다',
        head: ['축', '등급 기준', 'ALB (application)', 'NLB (network)', 'GWLB (gateway)'],
        rows: axes.map(function (a, i) {
          return [a.label, a.rule,
                  lbs[0].v[i] + '등급', lbs[1].v[i] + '등급', lbs[2].v[i] + '등급'];
        }).concat([
          ['동작 계층 (원문)', '—', lbs[0].layer, lbs[1].layer, lbs[2].layer],
          ['지원 프로토콜 (원문)', 'botocore elbv2 ProtocolEnum', lbs[0].proto, lbs[1].proto, lbs[2].proto],
          ['고정 IP', '—', lbs[0].eip, lbs[1].eip, lbs[2].eip],
          ['라우팅 판단 근거', '—', lbs[0].route, lbs[1].route, lbs[2].route],
          ['교차 영역 로드 밸런싱 기본값', 'FACT_SOURCES.md §4.16', '켜짐 — 끌 수 없습니다', '꺼짐 — 변경 가능', '꺼짐 — 변경 가능'],
          ['대표 용도', '—', lbs[0].use, lbs[1].use, lbs[2].use]
        ])
      }
    };
  });

  /* ==========================================================================
     ─────────────────── C-070 · C-071 · 데이터베이스 (ch11) ───────────────────
     ========================================================================== */

  /* --------------------------------------------------------------------------
     C-070 — DynamoDB 온디맨드 대 프로비저닝의 상대 비용 곡선
     --------------------------------------------------------------------------
     [상대 등급] y 축에 금액을 쓰지 않습니다 (FACT_SOURCES.md §5).
     이 그림에서 의미가 있는 것은 **교차점이 존재한다**는 사실 하나뿐입니다.
     교차점의 위치(사용량 얼마에서 뒤집히는가)는 단가에 달려 있고 단가는
     확인할 수 없으므로, 축 눈금에 숫자를 두지 않고 "낮음 / 높음"만 씁니다.
     -------------------------------------------------------------------------- */
  register('C-070', function (ctx) {
    var N = 21, MAX = 10;
    var onDemand = [], provisioned = [];
    /* 온디맨드는 원점을 지나는 직선(쓴 만큼), 프로비저닝은 확보한 용량만큼의
       기저에서 시작하는 완만한 직선. 두 직선의 기울기 차이가 교차를 만듭니다.
       계수는 모양을 만들기 위한 것이며 어떤 요금과도 대응하지 않습니다. */
    var BASE = 2.5, SLOPE = 0.45;
    for (var i = 0; i < N; i++) {
      var x = (i / (N - 1)) * MAX;
      onDemand.push({ x: x, y: x });
      provisioned.push({ x: x, y: BASE + SLOPE * x });
    }
    var cx = BASE / (1 - SLOPE);        // 교차점 — 두 직선이 만나는 지점

    var a = ctx.pair(0, 0.14);
    var b = ctx.pair(1, 0.14);

    return {
      type: 'line',
      height: 340,
      data: {
        datasets: [
          {
            label: '온디맨드 (PAY_PER_REQUEST) — 쓴 만큼',
            data: onDemand,
            borderColor: a.border, backgroundColor: a.fill,
            borderWidth: 2, tension: 0, fill: false, pointRadius: 0
          },
          {
            label: '프로비저닝 (PROVISIONED) — 확보한 용량 기준',
            data: provisioned,
            borderColor: b.border, backgroundColor: b.fill,
            borderWidth: 2, tension: 0, fill: false, pointRadius: 0,
            borderDash: [7, 5]        // 색만으로 구분하지 않습니다
          },
          {
            type: 'scatter',
            label: '교차점 — 유리한 쪽이 뒤집히는 지점',
            data: [{ x: cx, y: cx }],
            backgroundColor: ctx.alpha(ctx.color('danger'), 0.85),
            borderColor: ctx.color('danger'),
            borderWidth: 2,
            pointStyle: 'crossRot',
            pointRadius: 11,
            pointHoverRadius: 14
          }
        ]
      },
      options: {
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: function (item) {
                if (item.datasetIndex === 2) return '교차점 — 이 지점보다 사용량이 많으면 프로비저닝이 유리해집니다';
                return item.dataset.label;
              }
            }
          }
        },
        scales: {
          x: {
            type: 'linear', min: 0, max: MAX,
            title: { display: true, text: '워크로드 사용량 (상대) →', color: ctx.color('textMuted') },
            ticks: {
              stepSize: 5,
              callback: function (v) { return v === 0 ? '낮음' : (v === MAX ? '높음' : ''); }
            }
          },
          y: {
            min: 0, max: 11,
            title: { display: true, text: '상대 비용 (금액 아님) →', color: ctx.color('textMuted') },
            ticks: {
              stepSize: 5.5,
              callback: function (v) { return v === 11 ? '높음' : ''; }
            }
          }
        }
      },
      a11yCaption: 'DynamoDB 두 용량 모드의 상대 비용 곡선입니다. 의미가 있는 것은 교차점이 존재한다는 사실뿐이며 축의 값은 상대 등급입니다. ' + REL_NOTE,
      a11yTable: {
        caption: 'DynamoDB 용량 모드의 상대 비용 관계 — 축에 금액을 두지 않습니다. 이 그림이 주장하는 것은 교차점의 존재뿐입니다',
        head: ['용량 모드', 'API 값', '비용이 늘어나는 방식', '유리한 구간', 'AWS 의 권장 기준'],
        rows: [
          ['온디맨드 용량 모드', 'PAY_PER_REQUEST', '요청 수에 비례합니다. 쓰지 않으면 그만큼 줄어듭니다',
           '사용량이 낮거나 불규칙한 구간 — 그림의 교차점 왼쪽',
           'API 문서가 "대부분의 DynamoDB 워크로드에 권장"한다고 명시합니다'],
          ['프로비저닝된 용량 모드', 'PROVISIONED', '확보한 용량에 비례합니다. 놀아도 확보한 만큼은 듭니다',
           '사용량이 높고 안정적인 구간 — 그림의 교차점 오른쪽',
           '"용량 요구를 신뢰성 있게 예측할 수 있는, 예측 가능한 성장세의 안정적인 워크로드"'],
          ['교차점', '—', '두 직선이 만나는 지점',
           '이 지점의 실제 위치는 단가에 달려 있고 단가는 이 사이트가 확인할 수 없습니다',
           '패턴을 모르면 온디맨드로 시작하고, 안정되면 프로비저닝으로 바꿉니다. BillingMode 는 나중에 변경할 수 있습니다'],
          ['읽는 법', '—', REL_NOTE,
           '곡선의 기울기와 높이는 모양을 만들기 위한 값이며 어떤 요금과도 대응하지 않습니다',
           '프로비저닝 모드에는 Auto Scaling 을 붙일 수 있지만 지표를 보고 반응하므로 급증에는 늦습니다']
        ]
      }
    };
  });

  /* --------------------------------------------------------------------------
     C-071 — LSI 대 GSI 개수 상한
     --------------------------------------------------------------------------
     [확인 수치] docs/FACT_SOURCES.md §4.6 (botocore dynamodb CreateTableInput)
       LSI "the maximum is 5" · GSI "the maximum is 20"
     ch11 캡션이 "개수보다 중요한 제약"으로 지목한 생성 시점과 10 GB 제한을
     a11yTable 에 함께 싣습니다.
     -------------------------------------------------------------------------- */
  register('C-071', function (ctx) {
    var rows = [
      { label: 'LSI (로컬 보조 인덱스)', max: 5 },
      { label: 'GSI (글로벌 보조 인덱스)', max: 20 }
    ];
    var borders = ctx.palette(2);

    return {
      type: 'bar',
      height: 300,
      data: {
        labels: rows.map(function (r) { return r.label; }),
        datasets: [{
          label: '테이블당 최대 개수',
          data: rows.map(function (r) { return r.max; }),
          backgroundColor: borders.map(function (c) { return ctx.alpha(c, 0.55); }),
          borderColor: borders,
          borderWidth: 1.5,
          maxBarThickness: 96
        }]
      },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: function (item) { return '테이블당 최대 ' + item.parsed.y + '개'; } }
          }
        },
        scales: {
          y: {
            beginAtZero: true, max: 22,
            ticks: { stepSize: 5 },
            title: { display: true, text: '테이블당 최대 개수', color: ctx.color('textMuted') }
          },
          x: { grid: { display: false } }
        }
      },
      a11yCaption: 'DynamoDB 테이블당 보조 인덱스 개수 상한 — 로컬 보조 인덱스 5개, 글로벌 보조 인덱스 20개',
      a11yTable: {
        caption: 'DynamoDB 보조 인덱스의 개수 상한과 그보다 중요한 제약 (docs/FACT_SOURCES.md §4.6 확인 값)',
        head: ['항목', 'LSI (로컬 보조 인덱스)', 'GSI (글로벌 보조 인덱스)'],
        rows: [
          ['테이블당 최대 개수', '5개', '20개 (기본 할당량)'],
          ['생성 시점', '테이블 생성 시에만. 이후 추가·삭제 불가 — UpdateTable 에 LSI 파라미터가 아예 없습니다', '언제든 추가·삭제 가능'],
          ['크기 제약', '파티션 키 값당 인덱싱된 항목 총합 10 GB 이하', '제한 없음'],
          ['파티션 키', '테이블과 동일해야 합니다', '테이블과 달라도 됩니다'],
          ['읽기 일관성', '강력한 일관성 요청 가능', '최종 일관성만 — 강력한 일관성을 요청하면 오류'],
          ['용량', '테이블 용량을 함께 씁니다', '자체 ProvisionedThroughput 을 갖습니다'],
          ['시험에서의 결론', '개수 5는 거의 묻지 않습니다. 묻는 것은 "이미 운영 중인 테이블"이라는 조건입니다', '운영 중인 테이블에 새 조회 패턴이 필요하면 답은 항상 GSI 입니다']
        ]
      }
    };
  });

  /* ==========================================================================
     ─────────────────── C-080 · 엣지 · 네트워크 (ch14) ───────────────────
     ========================================================================== */

  /* --------------------------------------------------------------------------
     C-080 — 캐시 계층별 상대 지연
     --------------------------------------------------------------------------
     [상대 등급] ⚠️ 지연 시간의 절대값은 docs/FACT_SOURCES.md 에 없습니다.
     자릿수(마이크로초·밀리초 등)를 단정하지 않고 **순서만** 표현합니다.
     순서는 ch14 본문의 요청 경로(뷰어 → 엣지 로케이션 → 리전 엣지 캐시 → 오리진)에서 옵니다.
     -------------------------------------------------------------------------- */
  register('C-080', function (ctx) {
    var rows = [
      { label: '뷰어 캐시 (브라우저)', rank: 1,
        who: '사용자 기기에 남아 있는 캐시', why: '네트워크를 아예 타지 않습니다. Cache-Control 로만 다룰 수 있고 무효화가 닿지 않습니다' },
      { label: 'CloudFront 엣지 로케이션', rank: 2,
        who: '사용자와 가장 가까운 CloudFront 지점', why: '여기서 적중하면 오리진까지 가지 않습니다. 캐시 키를 줄이는 것이 적중률을 올리는 방법입니다' },
      { label: '리전 엣지 캐시', rank: 3,
        who: '엣지 로케이션과 오리진 사이의 더 큰 캐시 계층', why: '엣지에서 빗나가도 여기서 적중하면 오리진 부하를 덜어 줍니다' },
      { label: '오리진 (S3 · ALB · 사용자 서버)', rank: 4,
        who: '원본이 있는 곳', why: '여기까지 오면 오리진 처리 시간과 오리진까지의 왕복이 그대로 응답 시간에 더해집니다' }
    ];
    var words = ['', '가장 가까움', '가까움', '멂', '가장 멂'];
    var borders = ctx.palette(4);

    return {
      type: 'bar',
      height: 320,
      data: {
        labels: rows.map(function (r) { return r.label; }),
        datasets: [{
          label: '상대 거리 · 지연 순서',
          data: rows.map(function (r) { return r.rank; }),
          backgroundColor: borders.map(function (c) { return ctx.alpha(c, 0.55); }),
          borderColor: borders,
          borderWidth: 1.5,
          barPercentage: 0.7
        }]
      },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (item) {
                return item.parsed.y + '순위 — ' + words[item.parsed.y] + ' (절대 시간이 아닙니다)';
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true, max: 4.4,
            ticks: { stepSize: 1, callback: scaleTicks(words) },
            title: { display: true, text: '상대 순서 (절대 시간 아님)', color: ctx.color('textMuted') }
          },
          x: { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 24 } }
        }
      },
      a11yCaption: '응답이 돌아오는 계층별 상대 거리 순서 — 뷰어 캐시가 가장 가깝고 엣지 로케이션 · 리전 엣지 캐시 · 오리진 순으로 멀어집니다. 값은 순서이며 절대 시간이 아닙니다.',
      a11yTable: {
        caption: '응답이 돌아오는 계층의 상대 순서 — 순서 척도입니다. ⚠️ 지연 시간의 절대값은 이 사이트가 1차 소스로 확인하지 못했으므로 자릿수를 단정하지 않습니다',
        head: ['계층', '상대 순서', '무엇인가', '설계에 주는 함의'],
        rows: rows.map(function (r) {
          return [r.label, r.rank + '순위 (' + words[r.rank] + ')', r.who, r.why];
        }).concat([
          ['순서의 정의', '1 = 가장 가까움 → 4 = 가장 멂', '요청이 지나가는 경로의 순서입니다',
           '"엣지 로케이션을 늘린다", "TTL 을 0으로 한다" 같은 선택지는 방향이 반대입니다']
        ])
      }
    };
  });

  /* ==========================================================================
     ─────────────────── C-090 ~ C-092 · 서버리스 · 통합 (ch12) ───────────────────
     ========================================================================== */

  /* --------------------------------------------------------------------------
     C-090 — Lambda 한도: 기본값 대 최대값
     --------------------------------------------------------------------------
     [확인 수치] docs/FACT_SOURCES.md §4.7
       실행 시간 3초 → 900초 · 메모리 128 MB → 10,240 MB · /tmp 512 MB → 10,240 MB
     🔴 shape 의 max (Timeout 5400 · MemorySize 32768) 는 서비스 쿼터가 아닙니다.
        문서 본문의 900 / 10,240 을 씁니다 (§4.7 함정 항목).
     기본값과 최대값이 자릿수 단위로 떨어져 있는 것이 캡션의 요지이므로 로그 축입니다.
     -------------------------------------------------------------------------- */
  register('C-090', function (ctx) {
    var rows = [
      { label: '실행 시간 (초)', unit: '초', def: 3, max: 900, api: 'Timeout',
        why: '15분을 넘는 작업은 Lambda 가 답이 아닙니다. 분할하거나 컨테이너 · 배치로 옮깁니다' },
      { label: '메모리 (MB)', unit: 'MB', def: 128, max: 10240, api: 'MemorySize',
        why: '메모리를 늘리면 CPU 할당도 함께 증가합니다. 느린 함수의 첫 번째 조정 대상입니다' },
      { label: '임시 스토리지 /tmp (MB)', unit: 'MB', def: 512, max: 10240, api: 'EphemeralStorageSize',
        why: '큰 파일을 다뤄야 하면 늘립니다. 실행 환경이 사라지면 내용도 사라집니다' }
    ];

    return {
      type: 'bar',
      height: 340,
      data: {
        labels: rows.map(function (r) { return r.label; }),
        datasets: [
          bar(ctx, 4, '기본값', rows.map(function (r) { return r.def; })),
          bar(ctx, 0, '최대값', rows.map(function (r) { return r.max; }))
        ]
      },
      options: {
        scales: {
          y: {
            type: 'logarithmic', min: 1, max: 20000,
            title: { display: true, text: '값 (로그 눈금 · 단위 혼재)', color: ctx.color('textMuted') },
            ticks: { callback: function (v) { return n(v); } }
          },
          x: { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 16 } }
        },
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: function (item) {
                return item.dataset.label + ' — ' + n(item.parsed.y) + ' ' + rows[item.dataIndex].unit;
              }
            }
          }
        }
      },
      a11yCaption: 'AWS Lambda 의 기본값과 최대값 대비 — 실행 시간 3초에서 900초, 메모리 128 MB에서 10,240 MB, 임시 스토리지 512 MB에서 10,240 MB',
      a11yTable: {
        caption: 'AWS Lambda 의 기본값과 한도 (docs/FACT_SOURCES.md §4.7 확인 값 · 세로축은 로그 눈금이고 단위는 항목마다 다릅니다)',
        head: ['항목', 'API 파라미터', '기본값', '최대값', '설계에 주는 함의'],
        rows: rows.map(function (r) {
          return [r.label.replace(/ \(.*\)$/, ''), r.api, n(r.def) + ' ' + r.unit, n(r.max) + ' ' + r.unit, r.why];
        }).concat([
          ['동기 호출 페이로드', '—', '—', '6 MB', '큰 데이터는 Amazon S3 에 두고 참조만 전달합니다'],
          ['이 그림에 넣지 않은 것', '—', '—', '—',
           '비동기 호출 페이로드 상한과 배포 패키지 크기 상한은 1차 소스로 확인하지 못해 싣지 않습니다'],
          ['주의', '—', '—', '—',
           'API 모델의 shape 경계(Timeout 5400 · MemorySize 32768)는 서비스 쿼터가 아닙니다. 문서 본문의 900초 · 10,240 MB 가 실제 한도입니다']
        ])
      }
    };
  });

  /* --------------------------------------------------------------------------
     C-091 — SQS 큐 속성의 범위와 기본값
     --------------------------------------------------------------------------
     [확인 수치] docs/FACT_SOURCES.md §4.8 + botocore sqs CreateQueueRequest.Attributes
       지연 0–900초(기본 0) · 롱 폴링 0–20초(기본 0) · 가시성 0–43,200초(기본 30)
       보존 60–1,209,600초(기본 345,600) · 메시지 크기 1,024–1,048,576 B(기본 1 MiB)
     데이터는 data/charts/c-091-sqs-attributes.json 으로 분리했습니다 (카탈로그 §4-2).
     ⚠️ 로그 눈금에서는 0 을 그릴 수 없습니다. 최솟값이 0 인 두 속성의 막대는 1 에서
        시작하며, 실제 최솟값 0 은 툴팁과 표에 그대로 적습니다.
     -------------------------------------------------------------------------- */
  register('C-091', function (ctx) {
    return ctx.loadData('c-091-sqs-attributes').then(function (d) {
      var rows = d.rows;
      var span = rows.map(function (r) { return [Math.max(r.min, 1), r.max]; });
      var c = ctx.pair(0, 0.5);
      var mark = ctx.color('danger');

      function valText(r, v) {
        return r.unit === '바이트' ? byteText(v) : secText(v);
      }

      return {
        type: 'bar',
        height: 360,
        data: {
          labels: rows.map(function (r) { return r.label; }),
          datasets: [
            {
              label: '유효 범위',
              data: span,
              backgroundColor: c.fill,
              borderColor: c.border,
              borderWidth: 1.5,
              borderSkipped: false,
              barPercentage: 0.62
            },
            {
              type: 'scatter',
              label: '기본값',
              data: rows.map(function (r) {
                return { x: Math.max(r['default'], 1), y: r.label };
              }),
              backgroundColor: ctx.alpha(mark, 0.9),
              borderColor: mark,
              borderWidth: 2,
              pointStyle: 'rectRot',
              pointRadius: 9,
              pointHoverRadius: 12
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
                  if (item.datasetIndex === 1) return '기본값 — ' + r.defaultText;
                  return '유효 범위 — ' + r.minText + ' ~ ' + r.maxText;
                }
              }
            }
          },
          scales: {
            x: {
              type: 'logarithmic', min: 1, max: 2000000,
              title: {
                display: true,
                text: '값 (로그 눈금 · 시간 속성은 초, 크기 속성은 바이트)',
                color: ctx.color('textMuted')
              },
              ticks: {
                callback: function (v) {
                  return ({ 1: '1', 10: '10', 100: '100', 1000: '1천',
                            10000: '1만', 100000: '10만', 1000000: '100만' })[v];
                }
              }
            },
            y: { grid: { display: false }, ticks: { autoSkip: false } }
          }
        },
        a11yCaption: 'Amazon SQS 큐 속성의 유효 범위와 기본값 — 기본값이 범위 안에서 어디에 있는지가 요지입니다',
        a11yTable: {
          caption: 'Amazon SQS 큐 속성의 유효 범위와 기본값 (' + d.source +
                   ' 확인 값 · 가로축은 로그 눈금이라 0 을 표시할 수 없어 막대는 1 에서 시작합니다)',
          head: ['속성 (API 이름)', '최솟값', '최댓값', '기본값', '기본값 그대로 두면'],
          rows: rows.map(function (r) {
            return [r.label + ' (' + r.attr + ')', r.minText, r.maxText, r.defaultText, r.note];
          }).concat([
            ['읽는 법', '—', '—', '—',
             '기본값이 범위의 왼쪽 끝에 붙어 있는 속성(지연 · 롱 폴링)과 오른쪽 끝에 붙어 있는 속성(최대 메시지 크기)을 구분해서 봅니다'],
            ['확인용 단위 환산', '—', '—', '—',
             '900초 = 15분 · 43,200초 = 12시간 · 345,600초 = 4일 · 1,209,600초 = 14일 · 1,048,576 B = 1 MiB']
          ])
        }
      };
    });
  });

  /* --------------------------------------------------------------------------
     C-092 — SQS FIFO 처리량: 배치 유무
     --------------------------------------------------------------------------
     [확인 수치] docs/FACT_SOURCES.md §4.8 — FIFO 기본 배치 없이 초당 300개,
     배치 사용 시 초당 3,000개 (배치는 최대 10개 메시지 / 256 KB).
     ⚠️ 표준 큐는 막대로 그리지 않습니다. 공식 문서가 "거의 무제한"이라고만
        서술하고 수치를 주지 않기 때문입니다 (ch12 캡션과 동일).
     ⚠️ 고처리량 모드의 정확한 초당 메시지 수도 §5 미확인 항목이라 축에 올리지 않습니다.
     -------------------------------------------------------------------------- */
  register('C-092', function (ctx) {
    var rows = [
      { label: 'FIFO — 배치 없음', v: 300, note: '메시지를 하나씩 보내고 받을 때의 기본 처리량입니다' },
      { label: 'FIFO — 배치 사용', v: 3000, note: '배치는 최대 10개 메시지 또는 256 KB 입니다. 열 배 차이가 여기서 납니다' }
    ];
    var borders = ctx.palette(2);

    return {
      type: 'bar',
      height: 300,
      data: {
        labels: rows.map(function (r) { return r.label; }),
        datasets: [{
          label: '초당 메시지 수',
          data: rows.map(function (r) { return r.v; }),
          backgroundColor: borders.map(function (c) { return ctx.alpha(c, 0.55); }),
          borderColor: borders,
          borderWidth: 1.5,
          maxBarThickness: 96
        }]
      },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: function (item) { return '초당 ' + n(item.parsed.y) + '개'; } }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: '초당 메시지 수', color: ctx.color('textMuted') },
            ticks: { callback: function (v) { return n(v); } }
          },
          x: { grid: { display: false } }
        }
      },
      a11yCaption: 'FIFO 큐의 처리량은 배치 사용 여부로 열 배 차이가 납니다 — 배치 없이 초당 300개, 배치를 쓰면 초당 3,000개. 표준 큐는 수치가 없어 이 그림에 넣지 않았습니다.',
      a11yTable: {
        caption: 'SQS FIFO 큐의 처리량 (docs/FACT_SOURCES.md §4.8 확인 값) — 표준 큐는 수치가 없으므로 막대로 그리지 않습니다',
        head: ['구분', '처리량', '비고'],
        rows: rows.map(function (r) { return [r.label, '초당 ' + n(r.v) + '개', r.note]; }).concat([
          ['FIFO — 고처리량 모드', '이 그림에 넣지 않았습니다',
           '훨씬 높지만 정확한 수치가 리전마다 달라 1차 소스로 확정하지 못했습니다. 숫자를 축에 올리지 않습니다'],
          ['표준 큐', '거의 무제한 (nearly unlimited)',
           '공식 문서가 정성적으로만 서술합니다. 수치가 없으므로 막대로 비교하지 않습니다 — 없는 값을 그려 넣는 것보다 비워 두는 편이 정확합니다'],
          ['판단', '—',
           '요구 처리량이 초당 3,000개를 넘고 순서 보장이 꼭 필요하면 고처리량 모드를, 순서가 필요 없으면 표준 큐를 검토합니다']
        ])
      }
    };
  });

})(typeof window !== 'undefined' ? window : this);
