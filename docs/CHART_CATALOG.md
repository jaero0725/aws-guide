# 차트 카탈로그 (G1–G2 차트 에이전트 계약서)

> 차트는 **Chart.js 4.5.1**(`assets/vendor/chart.umd.min.js`, MIT, 로컬 동봉)을
> `assets/js/charts.js`가 감싼 레지스트리 위에서 동작한다. CDN은 쓰지 않는다.
>
> **함께 읽는 문서**: `PLAN.md` §4-1 · `docs/CONTENT_STYLE_GUIDE.md` §3-5 · **`docs/FACT_SOURCES.md` §4·§5**
> **강제 주체**: `tools/validate.mjs`의 `checkCharts()`
> **레퍼런스 구현**: `assets/js/charts.js` 하단 REGISTRY 절의 **C-001**

---

## 1. 차트와 다이어그램의 분업

요구사항 3번("모든 내용을 제대로 시각화")을 하나의 도구로 처리하려 하면 양쪽 다 나빠진다.
성격이 다른 두 종류를 나눈다.

| | **다이어그램 (SVG)** | **차트 (Chart.js)** |
|---|---|---|
| 대상 | **구조 · 흐름 · 관계 · 순서** | **수치 비교 · 분포 · 범위 · 추이** |
| 답하는 질문 | "무엇이 무엇에 연결되어 있고, 요청이 어디를 거치는가" | "어느 쪽이 얼마나 큰가, 어떻게 변하는가" |
| 예 | VPC 서브넷 구조, IAM 정책 평가 순서, DR 전환 흐름 | 볼륨 타입별 최대 IOPS, 도메인 가중치, 점수 추이 |
| 산출물 | `assets/diagrams/D-###-*.svg` | `assets/js/charts-*.js` + `data/charts/*.json` |
| 소유 | V1–V3 | **G1–G2** |
| HTML 훅 | `<figure class="diagram" data-diagram="D-030">` | `<figure class="chart" data-chart="C-011">` |
| 카탈로그 | `docs/DIAGRAM_CATALOG.md` | **이 문서** |

### 1-1. 판별 규칙 — 이 순서로 묻는다

1. **축에 올릴 수 있는 값이 있는가?**
   없으면 다이어그램이다. "SG는 상태 저장, NACL은 상태 비저장"에는 축이 없다.
2. **그 값이 `docs/FACT_SOURCES.md`에서 확인되었는가?**
   확인되지 않았다면 → 등급·범주(순서 척도)로 바꿀 수 있는지 본다.
   등급으로도 의미가 서지 않으면 **차트를 만들지 않는다.** 표나 문장으로 쓴다.
3. **독자가 알아야 하는 것이 "값" 자체인가, "경로"인가?**
   경로면 다이어그램이다. 값의 크기 차이가 결론이면 차트다.
4. **항목이 3개 미만인가?**
   막대 2개짜리 차트는 표보다 정보가 적다. 문장이나 표로 쓴다.

경계 사례의 판정 예:

| 주제 | 판정 | 이유 |
|---|---|---|
| S3 스토리지 클래스 **수명주기 전환 순서** | 다이어그램 (D-072) | 시간에 따른 상태 전이 = 흐름 |
| S3 스토리지 클래스 **최소 저장 기간 30/90/180일** | 차트 (C-011) | 확인된 수치의 크기 비교 |
| DR 4전략의 **구성 차이** | 다이어그램 (D-173 · D-174) | 무엇이 켜져 있는가 = 구조 |
| DR 4전략의 **RTO/RPO 위치** | 차트 (C-040) | 두 축 위의 상대 위치 |
| ALB vs NLB **선택 기준** | 다이어그램 (D-060) | 계층·프로토콜의 대응 관계 |
| ALB · NLB · GWLB **특성 프로파일** | 차트 (C-060, radar) | 여러 축의 동시 비교 |

---

## 2. 사용 규약

### 2-1. 콘텐츠 에이전트가 쓰는 것 — 플레이스홀더만

```html
<figure class="chart" data-chart="C-011">
  <figcaption>S3 스토리지 클래스별 최소 저장 기간과 최소 청구 크기 — 30일·90일·180일의
  계단이 수명 주기 규칙의 최소 간격을 결정합니다.</figcaption>
</figure>
```

- `data-chart`는 **`C-###` 형식**이어야 한다. 어기면 **ERROR**.
- **`<canvas>`를 직접 쓰면 ERROR.** `charts.js`가 `.chart__canvas > canvas`를 만든다.
- **`.chart__table`(표 대체본)도 직접 쓰지 않는다.** `charts.js`가 생성한다.
- `<figcaption>`이 없으면 WARN이고, **계약상 필수**다. 캔버스는 스크린 리더에 아무것도
  전달하지 못하므로 캡션이 정보의 정본이다. 제목 반복("S3 비용 비교")이 아니라
  **차트가 말하려는 결론을 문장으로** 적는다.

### 2-2. 차트 에이전트가 쓰는 것 — 등록 함수만

```js
AG.charts.register('C-011', function (ctx) {
  return { type: 'bar', data: { … }, options: { … }, height: 320, a11yTable: { … } };
});
```

**반환 객체의 스펙**

| 키 | 필수 | 내용 |
|---|:--:|---|
| `type` | ✅ | Chart.js 차트 유형 (`bar` · `line` · `doughnut` · `radar` · `scatter` …) |
| `data` | ✅ | `{ labels, datasets }`. Chart.js 원형 그대로 |
| `options` | | `baseOptions()`에 **깊은 병합**된다. 준 값이 이긴다 |
| `height` | | 캔버스 높이(px). `.chart__canvas`의 `--chart-h`를 덮어쓴다. 기본 340px(모바일 280/240) |
| `a11yTable` | ⚠️ **사실상 필수** | `{ caption, head: [...], rows: [[...]] }`. §2-5 참조 |
| `a11yCaption` | | 자동 생성 표의 `<caption>`. `a11yTable`을 주면 그 안의 `caption`이 쓰인다 |

**Promise 반환도 허용된다.** 데이터 파일을 읽을 때 쓴다.

```js
AG.charts.register('C-091', function (ctx) {
  return ctx.loadData('c-091-sqs-attributes').then(function (d) {
    return { type: 'bar', data: { labels: d.labels, datasets: d.datasets }, … };
  });
});
```

### 2-3. 색 — 하드코딩 금지

**`ctx`를 통하지 않은 색 문자열은 다크모드에서 반드시 깨진다.**
Chart.js는 생성 시점의 색을 캔버스에 굽는다. `charts.js`는 테마가 바뀌면
`getComputedStyle`로 `--dg-*` 토큰을 다시 읽어 **전 차트를 재생성**하는데,
등록부가 `'#1256a0'`을 박아 두면 재생성해도 그 색 그대로다.

| API | 반환 | 용도 |
|---|---|---|
| `ctx.color(kind)` | 색 문자열 | `accent` · `ok` · `warn` · `danger` · `muted` · `stroke` · `grid` · `text` · `textMuted` · `fill` · `fillAlt` · `accentSoft` · `okSoft` · `warnSoft` · `dangerSoft` · `mutedSoft` |
| `ctx.color('series', i)` | 색 문자열 | 계열 i의 색 (accent → ok → warn → danger → muted 순환) |
| `ctx.palette(n)` | 색 배열 | 계열 n개 |
| `ctx.pair(i, a)` | `{ border, fill }` | 계열 i의 선/테두리 색과 반투명 채움 한 쌍 (`a` 기본 0.55) |
| `ctx.alpha(색, a)` | `rgba(...)` | 투명도 적용 |
| `ctx.loadData(name)` | `Promise` | `data/charts/{name}.json` |
| `ctx.reducedMotion` | boolean | 애니메이션 분기 (공통 옵션이 이미 처리한다) |
| `ctx.fontFamily` | 문자열 | `--font-sans` 계산값 |

> **계열 색은 5개가 한계다.** 6개 이상을 색만으로 구분시키지 않는다.
> 항목을 묶거나, 축을 바꾸거나, 정렬 순서로 의미를 전달한다.
> 색만으로 정보를 전달하지 않는 것은 접근성 계약이다(`CONTENT_STYLE_GUIDE.md` §5).

### 2-4. 데이터를 언제 JSON으로 분리하는가

- **10행을 넘으면** `data/charts/*.json`으로 분리한다 (`PLAN.md` §4-1).
- 파일명은 소문자 ID로 시작한다: `data/charts/c-091-sqs-attributes.json`.
- 소유 경계: **G1 → `data/charts/c-0*.json`**, **G2 → `data/charts/c-1*.json`**.
- JSON에는 **수치와 라벨만** 넣는다. 색은 넣지 않는다. 색은 런타임에 `ctx`가 결정한다.

### 2-5. `a11yTable`은 사실상 필수다

`charts.js`는 `a11yTable`이 없으면 `data.labels` × `datasets`로 표를 자동 생성한다.
자동 생성이 통하는 경우는 **라벨이 그대로 행 제목이 되고 값에 단위 혼동이 없는 단순 막대**뿐이다.
아래에 해당하면 **직접 작성한다.**

- `scatter`처럼 값이 `{x, y}`인 차트 (자동 생성은 `"3 / 4"`처럼 무의미하게 나온다)
- 등급·순서 척도를 쓰는 차트 (숫자 3이 무슨 뜻인지 표에 적어야 한다)
- 축마다 단위가 다른 차트 (일 / KB, IOPS / MiB/s)
- 범위를 막대로 그린 차트 (`[min, max]` 형식)
- `doughnut`·`radar`처럼 축 라벨이 값의 의미를 담지 못하는 차트

**이 규칙이 존재하는 이유**는 셋이다.

1. `<canvas>`는 스크린 리더에 아무것도 전달하지 못한다. `charts.js`는 캔버스에
   `role="presentation"` + `aria-hidden="true"`를 붙이므로, **표가 유일한 정보 경로**다.
2. **인쇄.** `chart.css`는 인쇄 시 `.chart__table`을 펼치고 `<summary>`를 감춘다.
   `saa/cram.html`은 인쇄를 전제한 페이지다.
3. JS가 꺼지거나 Chart.js 생성이 실패하면 캔버스에는 아무것도 남지 않는다.

### 2-6. 완성 예시 — C-011 (C-001과 같은 형식)

```js
/* --------------------------------------------------------------------------
   C-011 — S3 스토리지 클래스: 최소 저장 기간과 최소 청구 크기
   --------------------------------------------------------------------------
   출처: docs/FACT_SOURCES.md §4.3 (awsdocs storage-class-intro.md 비교표)
   단위가 서로 다르므로 y축을 둘로 나눈다. 금액은 어디에도 쓰지 않는다.
   -------------------------------------------------------------------------- */
AG.charts.register('C-011', function (ctx) {
  var labels = ['S3 Standard', 'Standard-IA', 'One Zone-IA',
                'Glacier Instant Retrieval', 'Glacier Flexible Retrieval', 'Glacier Deep Archive'];
  var days  = [0, 30, 30, 90, 90, 180];       // 최소 저장 기간(일)
  var sizeK = [0, 128, 128, 128, 40, 40];     // 최소 청구 크기(KB)

  var a = ctx.pair(0, 0.55);   // 계열 0 — 기간
  var b = ctx.pair(1, 0.55);   // 계열 1 — 크기

  return {
    type: 'bar',
    height: 360,
    data: {
      labels: labels,
      datasets: [
        { label: '최소 저장 기간 (일)', data: days,
          backgroundColor: a.fill, borderColor: a.border, borderWidth: 1.5, yAxisID: 'y' },
        { label: '최소 청구 크기 (KB)', data: sizeK,
          backgroundColor: b.fill, borderColor: b.border, borderWidth: 1.5, yAxisID: 'y1' }
      ]
    },
    options: {
      scales: {
        y:  { beginAtZero: true, title: { display: true, text: '일', color: ctx.color('textMuted') } },
        y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false },
              title: { display: true, text: 'KB', color: ctx.color('textMuted') } },
        x:  { ticks: { autoSkip: false, maxRotation: 40 } }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function (item) {
              var unit = item.datasetIndex === 0 ? '일' : 'KB';
              return item.dataset.label + ' — ' + (item.parsed.y === 0 ? '없음' : item.parsed.y + unit);
            }
          }
        }
      }
    },
    a11yCaption: 'S3 스토리지 클래스별 최소 저장 기간과 최소 청구 크기',
    a11yTable: {
      caption: 'S3 스토리지 클래스별 최소 저장 기간과 최소 청구 크기 (FACT_SOURCES.md §4.3)',
      head: ['스토리지 클래스', '최소 저장 기간', '최소 청구 크기', '가용 영역 수'],
      rows: [
        ['S3 Standard', '없음', '없음', '3개 이상'],
        ['S3 Standard-IA', '30일', '128 KB', '3개 이상'],
        ['S3 One Zone-IA', '30일', '128 KB', '1개'],
        ['S3 Glacier Instant Retrieval', '90일', '128 KB', '3개 이상'],
        ['S3 Glacier Flexible Retrieval', '90일', '40 KB', '3개 이상'],
        ['S3 Glacier Deep Archive', '180일', '40 KB', '3개 이상']
      ]
    }
  };
});
```

이 예시가 지키는 것: **색은 전부 `ctx`에서** · **금액 없음** · **단위가 다르면 축 분리** ·
**`a11yTable`을 직접 작성**(단위가 섞이므로 자동 생성이 의미를 잃는다) · **출처를 주석에 명시**.

### 2-7. 등록 파일과 로딩 — ⚠️ 착수 전 확인할 통합 결함

`PLAN.md` §5의 소유권 표는 G1에 `assets/js/charts-content.js`,
G2에 `assets/js/charts-dash.js`를 배타 할당한다. **이 배분을 따른다.**
`charts.js`(Wave 0 소유)를 두 에이전트가 함께 고치면 충돌하기 때문이다.

그런데 **현재 어떤 HTML도 이 두 파일을 로드하지 않는다.**
페이지 골격의 스크립트 목록은 `… → vendor/chart.umd.min.js → charts.js → app.js → quiz.js`이고,
`CONTENT_STYLE_GUIDE.md` §3-1이 이 순서를 고정한다.

- `validate.mjs`의 `checkCharts()`는 `assets/js/charts*.js` **파일을 스캔**하므로
  `charts-content.js`에만 등록해도 **검증은 통과한다.**
- 그러나 브라우저는 그 파일을 내려받지 않으므로 **실제 페이지에는
  "이 차트가 아직 등록되지 않았습니다" 상자가 뜬다.**
- 즉 **검증 통과 ≠ 브라우저 동작**이다. 이 결함은 자동으로 잡히지 않는다.

**해소 방법은 둘 중 하나이며, 어느 쪽이든 Wave 0 또는 Wave 4의 단독 작업이다.**

1. `charts.js`가 부팅 시 `charts-content.js` · `charts-dash.js`를 **동적으로 주입**한다.
   `register()`가 이미 늦은 등록을 처리한다 — 등록 시점에 해당 ID의 `figure`를 다시 훑고,
   먼저 그려 둔 `.chart__missing` 상자를 걷어낸 뒤 재마운트한다. 그래서 이 방법이 안전하다.
2. 페이지 골격의 스크립트 목록에 두 파일을 추가한다.
   콘텐츠 HTML 전부를 고쳐야 하므로 **Wave 4에서 일괄 처리**해야 한다.

**G1·G2는 이 결정을 기다리지 않는다.** 자기 파일에 등록을 완성하고,
리포트 첫 줄에 "로더 미구현 — 통합 필요"를 적는다.

### 2-8. 그 밖의 강제 규칙

| 규칙 | 심각도 | 비고 |
|---|:--:|---|
| `data-chart` 형식 오류 (`C-###` 아님) | **ERROR** | |
| `figure.chart` 안에 `<canvas>` 직접 작성 | **ERROR** | `charts.js` 생성 경로와 충돌 |
| **차트 ID 중복 등록** | **ERROR** | 두 파일에 같은 ID가 있으면 걸린다. **C-001은 이미 `charts.js`에 등록되어 있다 — 다시 등록하지 않는다** |
| 등록되지 않은 ID를 참조 | WARN → `--strict`에서 **ERROR** | Wave 1의 순서 역전을 허용하기 위한 유예 |
| 아무 페이지도 참조하지 않는 등록 (고아) | WARN → `--strict`에서 **ERROR** | 플레이스홀더가 없으면 **리포트에 올린다. HTML을 고치지 않는다** |
| `<figcaption>` 누락 | WARN | 계약상 필수 |
| 애니메이션 | — | `baseOptions()`가 `prefers-reduced-motion`을 이미 처리한다. 등록부에서 다시 켜지 않는다 |
| 테마 전환 | — | `charts.js`가 `data-theme` 변경과 OS 설정 변경을 감시해 재생성한다. 등록부는 관여하지 않는다 |

작업 종료 전 반드시 실행한다.

```bash
node tools/validate.mjs --charts
node tools/validate.mjs --charts --strict
```

---

## 3. ⚠️ 요금 금액 금지 — 이 절이 이 문서에서 가장 중요하다

### 3-1. 금액은 구조적으로 확인이 불가능하다

이 환경은 **AWS 요금 API와 요금 페이지가 전부 네트워크 차단**되어 있다
(`FACT_SOURCES.md` §1 · §5). `pricing.us-east-1.amazonaws.com`도 `aws.amazon.com`도 열리지 않는다.
재시도해도 열리지 않는다. **따라서 어떤 절대 금액도 검증할 수 없다.**

게다가 요금은 리전과 시점에 따라 바뀐다. 애초에 학습 콘텐츠에 하드코딩할 값이 아니다.

> **금액이 축에 오는 차트는 만들지 않는다.**
> GB당 USD, 시간당 USD, 요청 100만 건당 USD, 무료 티어 한도, 할인율(RI·Savings Plans·스팟)
> 전부 해당한다.

### 3-2. 대신 이렇게 그린다

| 원래 그리고 싶던 것 | 대체 방법 |
|---|---|
| S3 클래스별 GB당 월 요금 | **상대 등급** 막대 (저렴 → 비쌈, 1~5 등급) — **C-010** |
| EC2 구매 옵션별 시간당 요금 | **상대 등급 산점도** (비용 등급 × 유연성 등급) — **C-030** |
| 데이터 전송 요금표 | **범주** 막대 (무료 / 과금 / 리전 간) — **C-050** |
| DR 전략별 월 비용 | **상대 등급** (상시 가동 구성의 크기) — **C-041** |
| DynamoDB 용량 모드 비용 비교 | **상대 곡선** — 교차점의 존재만 의미를 갖는다 — **C-070** |

**등급 차트의 필수 조건 3가지**

1. 축 눈금에 통화 기호를 쓰지 않는다. 눈금 라벨은 `저렴 / 보통 / 비쌈` 같은 말이거나 등급 숫자다.
2. `<figcaption>`에 **"상대 비교이며 실제 금액은 리전·시점에 따라 다릅니다"**를 반드시 적는다.
   이 문장은 콘텐츠 에이전트의 책임이지만, 차트 에이전트도 `a11yCaption`에 같은 취지를 넣는다.
3. `a11yTable`에 **등급의 정의**를 적는다. "1 = 가장 저렴"이 표에 없으면 숫자 3은 아무 뜻도 없다.

### 3-3. 반대로 — 성능 수치는 확인된 값을 쓴다

`FACT_SOURCES.md` §4는 botocore(= AWS API 모델 정본)에서 뽑은 수치를 이미 검증해 두었다.
**이런 값은 반드시 차트로 만든다.** 시중 한국어 자료가 틀린 값을 싣고 있을수록 가치가 크다.

| 수치 | 출처 |
|---|---|
| S3 클래스별 최소 저장 기간(30·90·180일) · 최소 청구 크기(128·40 KB) · AZ 수 | §4.3 |
| Glacier 검색 시간 (신속 1–5분 · 대량 5–12시간 · Deep Archive 12시간) | §4.3 |
| EBS 볼륨 타입별 IOPS·처리량·크기 범위 | §4.4 |
| DynamoDB LSI 5개 / GSI 20개 / 파티션 키 값당 10GB | §4.6 |
| Lambda 타임아웃 3→900초 · 메모리 128→10,240MB · `/tmp` 512→10,240MB | §4.7 |
| SQS 지연 0–900초 · 메시지 1KiB–1MiB · 보존 60초–14일 · 가시성 0–12시간 | §4.8 |
| SQS FIFO 300/초 (배치 3,000/초) | §4.8 |
| SAA-C03 도메인 가중치 30/26/24/20 | §4.14 |

**특히 `gp3`가 이 사이트의 대표 사례다.**

> 2025년 9월부터 `gp3`의 상한은 **최대 80,000 IOPS · 2,000 MiB/s · 64 TiB**다.
> 구 자료의 **16,000 IOPS · 1,000 MiB/s · 16 TiB**가 아니다 (`FACT_SOURCES.md` §4.4 · §7 #5).
> 거의 모든 한국어 SAA 자료가 아직 옛 값을 싣고 있다.
> **C-021은 이 변경 자체를 그리는 차트다.** 옛 값과 현행 값을 나란히 놓아
> "당신이 외운 숫자가 틀렸다"를 한 화면에서 보여 준다. 이런 차트가 이 사이트의 차별점이다.

### 3-4. 검증되지 않은 값으로는 차트를 만들지 않는다

`FACT_SOURCES.md` §5의 "쓰지 말 것" 목록에 있는 값은 **등급으로 바꿔도 쓰지 않는다.**
등급으로 바꾸려면 순서라도 알아야 하는데, 그 순서 자체가 확인되지 않았기 때문이다.

대표적으로 **gp2의 최대 IOPS와 GiB당 IOPS 비율은 확인되지 않았다.**
그래서 C-020의 막대에 **gp2는 넣지 않는다.** 빈칸으로 두고 캡션에 그 사실을 밝히는 것이,
"약 16,000"으로 채워 넣는 것보다 낫다. 얼버무린 수치는 확인된 수치와 구분되지 않으므로
없느니만 못하다(`CONTENT_STYLE_GUIDE.md` §1-2).

Lambda 비동기 페이로드 상한, 배포 패키지 크기, NAT Gateway 대역폭, VPC 쿼터,
CloudFront 엣지 로케이션 개수, Aurora 복제본 최대 개수, EFS/FSx 처리량 수치도 같다.
**이 항목들로는 차트를 만들지 않는다.**

---

## 4. 카탈로그

`데이터 출처` 열의 값은 셋 중 하나다.

- `FACT_SOURCES.md §N` — 검증된 수치. 그대로 축에 올린다.
- `상대 등급 — 수치 없음` / `범주 — 수치 없음` — 축에 숫자를 올리지 않는다. §3-2 규칙 적용.
- `localStorage 진도` — 사용자 데이터. 값이 없을 때의 빈 상태를 반드시 처리한다.

### 4-1. 시험 · 학습 플랜 (C-001 ~ C-009) — G2

| ID | 차트 | 유형 | 배치 | 데이터 출처 | 비고 |
|---|---|---|---|---|---|
| C-001 | SAA-C03 도메인 가중치 | doughnut | **`index.html`, `basics/ch01.html`(사용 중)**, `saa/index.html`, `saa/domain-*.html` | `FACT_SOURCES.md §4.14` · `PLAN.md §0` | **이미 `charts.js`에 등록됨(레퍼런스 구현).** 다시 등록하면 ID 중복 ERROR |
| C-002 | 8주 학습 플랜 | 수평 바 (간트) | `saa/index.html` | `PLAN.md §2-5` — 일정 계획값 | 주차 범위를 `[시작, 끝]` 부동 막대로. 측정값이 아님을 캡션에 |
| C-003 | 시험 시간 예산 | 누적 수평 바 | `saa/exam-tips.html` | `PLAN.md §0` (65문항 · 130분) + **권장 배분** | 1차 풀이 / 표시 문항 재검토 / 최종 점검. **배분은 권장안이며 공식 값이 아님을 캡션에 명시** |
| C-004 | 채점 문항 구성 (채점 50 + 비채점 15) | doughnut | `saa/index.html` | `PLAN.md §0` | 응시자는 둘을 구분할 수 없다는 사실을 `a11yTable`에 |
| C-005 | 문제은행 구성 (180 / 340 / 260 / 40) | doughnut | `quiz/index.html` | `PLAN.md §3-1` | 이 사이트의 산출물 규모. 시험 사실이 아님 |

*006–009 예약*

### 4-2. 콘텐츠 차트 (C-010 ~ C-099) — G1

> **ID 대역은 주제 블록으로 고정되어 있다.** `PLAN.md` §4-1이 C-010(S3) · C-020(EBS) ·
> C-030(EC2) · C-040(DR) · C-050(비용) · C-060(ELB) · C-070(DynamoDB) · C-080(캐시)을
> 이미 배정했고, 그 ID로 참조가 나갈 수 있으므로 **번호를 재배치하지 않는다.**
> 그래서 대역 순서는 챕터 번호 순이 아니라 주제 순이다.

| 대역 | 주제 | 챕터 |
|---|---|---|
| 010–019 | S3 · 오브젝트 스토리지 | ch08 |
| 020–029 | EBS · 블록 스토리지 | ch06 |
| 030–039 | EC2 · 컴퓨팅 | ch05 |
| 040–049 | 재해 복구 · 복원력 | ch18 |
| 050–059 | 비용 · 데이터 전송 | ch18, `cheatsheet/cost.html` |
| 060–069 | 로드 밸런싱 · 오토스케일링 | ch07 |
| 070–079 | 데이터베이스 | ch10 · ch11 |
| 080–089 | 엣지 · 네트워크 | ch14 · ch03 · ch04 |
| 090–099 | 서버리스 · 통합 · 분석 | ch12 · ch15 |

| ID | 차트 | 유형 | 배치 | 데이터 출처 | 비고 |
|---|---|---|---|---|---|
| C-010 | S3 스토리지 클래스 **상대** 저장 비용 등급 | bar | `basics/ch08.html`, `cheatsheet/cost.html` | **상대 등급 — 수치 없음** | 눈금 라벨 `저렴 → 비쌈`. 통화 기호 금지. 등급 정의를 `a11yTable`에 |
| C-011 | 최소 저장 기간 · 최소 청구 크기 | 그룹 bar (축 2개) | `basics/ch08.html` | `FACT_SOURCES.md §4.3` | 30·90·180일 / 128·40 KB. **§2-6 완성 예시** |
| C-012 | Glacier 검색 옵션별 소요 시간 | 수평 부동 bar (로그) | `basics/ch08.html` | `FACT_SOURCES.md §4.3` | 신속 1–5분 · 대량 5–12시간 · Deep Archive 12시간. 범위이므로 `[min,max]` |
| C-013 | 클래스별 설계 가용성과 AZ 수 | 그룹 bar | `basics/ch08.html` | `FACT_SOURCES.md §4.3` (⚠️ 2023 아카이브 출처) | 99.99 / 99.9 / 99.5. **"설계 목표치"임을 캡션에 명시.** One Zone-IA의 AZ 1개가 결론 |
| C-020 | EBS 볼륨 타입 최대 IOPS | bar (로그) | `basics/ch06.html` | `FACT_SOURCES.md §4.4` | gp3 80,000 · io1 64,000 · io2 256,000. **gp2는 §5 미확인이라 제외** |
| C-021 | **gp3 상한 — 구 자료 대 현행** | 그룹 bar | `basics/ch06.html` | `FACT_SOURCES.md §4.4` · `§7 #5` | 16,000→80,000 IOPS / 1,000→2,000 MiB/s / 16→64 TiB (2025-09). 이 사이트의 대표 교정 차트 |
| C-022 | 볼륨 타입별 크기 범위 | 수평 부동 bar (로그) | `basics/ch06.html` | `FACT_SOURCES.md §4.4` | gp2 1–16,384 / gp3 1–65,536 / io1 4–16,384 / io2 4–65,536 / st1·sc1 125–16,384 GiB |
| C-030 | EC2 구매 옵션 **상대** 비용 대 유연성 | scatter | `basics/ch05.html` | **상대 등급 — 수치 없음** | 두 축 모두 1~5 등급. `a11yTable`에 각 점의 좌표와 의미를 문장으로 |
| C-040 | **DR 4전략 RTO/RPO 위치** | scatter | `basics/ch18.html`, `cases/case08.html` | **순서 척도 — 수치 없음** | 눈금 라벨은 `분 / 시간 / 일` 구간. 특정 전략의 RTO를 숫자로 단정하지 않는다 |
| C-041 | DR 전략별 상시 가동 범위와 복구 시간 | line | `basics/ch18.html` | **상대 등급 — 수치 없음** | 비용 축에 금액 금지. 상시 가동 구성 요소의 많고 적음으로 표현 |
| C-050 | 데이터 전송 **과금 범주** 지도 | 범주형 bar | `basics/ch18.html`, `cheatsheet/cost.html` | **범주 — 수치 없음** | 무료 / 과금 / 리전 간 3범주. 방향별(인바운드 · AZ 내 · AZ 간 · 리전 간 · 인터넷 아웃 · NAT 경유 · CloudFront) |
| C-060 | ALB · NLB · GWLB 특성 비교 | radar | `basics/ch07.html` | `FACT_SOURCES.md §4.9` + **특성 등급화** | 계층 · 프로토콜 폭 · 고정 IP · 대상 유형 · 어플라이언스 삽입. 등급화 기준을 `a11yTable`에 명시 |
| C-070 | DynamoDB 온디맨드 vs 프로비저닝 **상대** 비용 곡선 | line | `basics/ch11.html` | **상대 등급 — 수치 없음** | 의미 있는 것은 **교차점의 존재**뿐. y축에 금액 금지 |
| C-071 | LSI vs GSI 개수 상한 | bar | `basics/ch11.html` | `FACT_SOURCES.md §4.6` | 5개 vs 20개. 파티션 키 값당 10GB 제약은 `a11yTable`에 |
| C-080 | 캐시 계층별 **상대** 지연 | 순서 척도 bar | `basics/ch14.html` | **상대 등급 — 수치 없음** | ⚠️ 지연 시간 절대값은 `FACT_SOURCES.md`에 없다. **자릿수(마이크로초 등)를 단정하지 않는다.** 순서만 표현 |
| C-090 | Lambda 한도 — 기본값 대 최대값 | 그룹 bar (로그) | `basics/ch12.html` | `FACT_SOURCES.md §4.7` | 타임아웃 3→900초 · 메모리 128→10,240MB · `/tmp` 512→10,240MB. shape의 `max`가 아니라 문서 본문 값 |
| C-091 | SQS 큐 속성의 범위와 기본값 | 수평 부동 bar (로그) | `basics/ch12.html` | `FACT_SOURCES.md §4.8` | 지연 0–900초(기본 0) · 메시지 1KiB–1MiB(기본 1MiB) · 보존 60초–14일(기본 4일) · 가시성 0–12시간(기본 30초). 행이 많으므로 `data/charts/c-091-*.json` 분리 |
| C-092 | FIFO 처리량 — 배치 유무 | bar | `basics/ch12.html` | `FACT_SOURCES.md §4.8` | 300/초 vs 3,000/초. **표준 큐는 수치가 없으므로 막대로 그리지 않고** "거의 무제한"을 `a11yTable`과 캡션으로 |

*013 이후 각 대역의 남은 번호는 예약. ch03·ch04·ch09·ch13·ch15·ch16·ch17에는
검증된 비교 수치가 없어 차트를 배정하지 않았다. 이 챕터들은 다이어그램과 표로 처리한다.
새 차트가 필요하면 §5-3 절차를 따른다.*

### 4-3. 대시보드 · 결과 (C-100 ~ C-119) — G2

모두 `localStorage` 기반이므로 **데이터가 없는 첫 방문 상태를 반드시 처리한다.**
빈 배열을 Chart.js에 넘기면 축만 있는 빈 격자가 그려진다.
데이터가 없으면 스펙 함수에서 `null`을 반환하고(=아무것도 그리지 않는다),
안내는 페이지가 담당하게 둔다.

| ID | 차트 | 유형 | 배치 | 데이터 출처 | 비고 |
|---|---|---|---|---|---|
| C-100 | 내 도메인별 숙련도 | radar | `index.html`, `quiz/result.html` | `localStorage 진도` (`ag:progress:quiz`) | 4개 도메인 정답률. 축 0–100 고정 |
| C-101 | 학습 진도 | doughnut | `index.html` | `localStorage 진도` (`ag:progress:read`) + `data/toc.json` 총 페이지 수 | 읽음 / 남음 |
| C-102 | 모의고사 점수 추이 | line | `quiz/result.html` | `localStorage 진도` (`ag:progress:exams`) | x는 응시 회차. **"720점 = 정답률 72%"로 읽히지 않도록** 축을 백분율로 두고 캡션에 스케일 점수 주의를 적는다 |
| C-103 | 약점 우선순위 | 수평 bar | `quiz/result.html` | `localStorage 진도` + `PLAN.md §3-1` 우선순위 공식 | `가중치 × (100 − 정답률) / 100` 내림차순. 막대 순서가 학습 순서다 |
| C-104 | 진단 결과 — 도메인별 정답률과 처방 구간 | 수평 누적 bar | `quiz/result.html` | `localStorage 진도` (`ag:progress:diagnostic`) | 60% 미만 집중 학습 / 60–80% 보강 / 80% 이상 유지 경계선 표시 |
| C-105 | 오답 노트 졸업 현황 | 누적 bar | `quiz/review.html` | `localStorage 진도` (연속 정답 `streak`) | 0회 / 1회 / 2회 / 졸업(3회) |
| C-106 | 플래시카드 간격 반복 진도 | bar | `saa/flashcards.html` | `localStorage 진도` (`ag:progress:cards`) | 단계별 카드 수 |
| C-107 | 챕터별 학습 완료 상태 | 수평 bar | `index.html` | `localStorage 진도` (`ag:progress:read`) | 18개 챕터. 항목이 많으므로 높이를 넉넉히(`height: 460`) |
| C-108 | 최근 14일 학습량 | bar | `index.html` | `localStorage 진도` (일자별 파생 집계) | 기록이 없는 날은 0으로 채워 날짜 축을 끊지 않는다 |

*109–119 예약*

### 4-4. 총계

| 구분 | 개수 |
|---|---:|
| 시험 · 학습 플랜 (C-001 ~ C-009) | 5 |
| 콘텐츠 (C-010 ~ C-099) | 18 |
| 대시보드 · 결과 (C-100 ~ C-119) | 9 |
| **합계** | **32** |

| 데이터 성격 | 개수 |
|---|---:|
| `FACT_SOURCES.md`에서 검증된 수치 | 11 |
| 상대 등급 · 범주 (숫자를 축에 올리지 않음) | 7 |
| `PLAN.md`의 계획값 (시험 사실 + 사이트 설계) | 5 |
| `localStorage` 사용자 데이터 | 9 |

---

## 5. 배분

### 5-1. 에이전트

| 에이전트 | 담당 | 배타 소유 경로 | 개수 |
|---|---|---|---:|
| **G1** | 콘텐츠 차트 (C-010 ~ C-099) | `assets/js/charts-content.js`, `data/charts/c-0*.json` | 18 |
| **G2** | 시험·플랜 + 대시보드·결과 (C-001 ~ C-009, C-100 ~ C-119) | `assets/js/charts-dash.js`, `data/charts/c-1*.json` | 13 |

- **G1**은 수치의 정확성이 전부다. 모든 값이 `FACT_SOURCES.md`의 어느 절에서 왔는지
  **등록 함수 주석에 절 번호를 남긴다.** Wave 3 C5가 그 주석을 근거로 대조한다.
- **G2**는 `localStorage` 스키마(`PLAN.md` §3-3)와 `progress.js`의 실제 API를 먼저 확인한다.
  대시보드 차트는 값이 없을 때가 기본 상태다.
- **C-001은 이미 `charts.js`에 등록되어 있다.** G2는 이 ID를 다시 등록하지 않는다(ID 중복 ERROR).

### 5-2. 소유권 규칙

1. **차트 에이전트는 HTML을 절대 수정하지 않는다.**
   플레이스홀더가 없어 등록이 고아가 되면 **리포트에 올린다.** 직접 넣지 않는다.
2. `assets/js/charts.js` · `assets/css/chart.css` · `assets/css/viz.css`는 **Wave 0 소유**다.
   공통 옵션이나 토큰이 부족하면 만들지 말고 리포트에 올린다.
3. `data/charts/` 아래에서도 대역(`c-0*` / `c-1*`)을 넘지 않는다.
4. 색을 하드코딩하지 않는다. 위반은 검증기가 잡지 못하고 **다크모드에서만 드러난다.**
   Wave 3 C5가 양쪽 테마를 눈으로 확인한다.
5. **이 카탈로그에 없는 ID를 등록하지 않는다.** 다이어그램과 달리 차트 ID는
   `charts*.js`의 실제 등록이 정본이므로 카탈로그가 뒤처지면 아무도 못 찾는다.

### 5-3. 차트를 추가하고 싶을 때

1. `docs/FACT_SOURCES.md`에서 수치를 **먼저** 확인한다. 없으면 §3-2의 등급 표현이 가능한지 본다.
   둘 다 안 되면 **차트를 만들지 않는다.**
2. §1-1의 판별 규칙을 통과하는지 본다. 구조·흐름이면 `DIAGRAM_CATALOG.md`로 간다.
3. §4의 해당 대역 표에 **행을 먼저 추가**하고 `데이터 출처` 열을 채운다.
4. 그다음 등록 코드를 쓴다.
5. 콘텐츠 페이지에 플레이스홀더가 필요하면 **직접 넣지 말고 리포트에 올린다.**
