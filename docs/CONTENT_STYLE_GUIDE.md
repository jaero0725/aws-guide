# 콘텐츠 스타일 가이드 (모든 에이전트 필독)

> 이 문서는 AWS SAA Guide 사이트의 **모든 콘텐츠 생성 에이전트가 작업 시작 전 반드시 읽어야 하는 계약서**다.
> **여기에 어긋난 산출물은 검증 단계(Wave 3 / `tools/validate.mjs`)에서 반려된다.**
> 취향이 아니라 계약이다. 규칙이 틀렸다고 판단되면 임의로 어기지 말고 리포트에 적어 올린다.

**함께 읽어야 하는 문서**

| 문서 | 언제 |
|---|---|
| `PLAN.md` | 전체 구조·소유권·페이지 목록. 파일을 만들기 전에 |
| `docs/FACT_SOURCES.md` | **모든 수치·기본값을 쓰기 전에.** 이 환경은 AWS 문서 웹사이트가 차단되어 있다 |
| `docs/SERVICE_CURRENCY.md` | 바뀐 기본값·개명된 서비스 목록 |
| `docs/DIAGRAM_CATALOG.md` · `docs/CHART_CATALOG.md` | 플레이스홀더 ID를 쓰기 전에 |
| `docs/QUESTION_SCHEMA.md` | 문제 JSON을 만들기 전에 |

**작업 종료 전 반드시 실행**

```bash
npm run validate                 # 전체 검사 (오류 0이어야 한다)
node tools/validate.mjs --html --links   # 빠른 반복 검사
```

`tools/validate.mjs`의 출력 형식은 `path:line  [ERROR|WARN]  메시지`다.
**ERROR가 하나라도 있으면 종료 코드 1이고, `npm run build`가 실패한다.**
WARN은 빌드를 막지 않지만, `--strict`에서 일부가 ERROR로 승격되고 Wave 3 검증에서는 전부 리뷰 대상이다.

---

## §1 기술 기준과 사실 확인

### 1-1. 시험 기준 — 이 값만 쓴다

| 항목 | 값 |
|---|---|
| 시험 코드 | **SAA-C03** |
| 문항 수 | 65문항 (채점 50 + 비채점 15) |
| 시간 | 130분 |
| 합격 점수 | 720점 / 100–1000 스케일 |
| 채점 방식 | 보상형(compensatory) — 도메인별 과락 없음 |
| 오답 감점 | 없음 |
| 문항 유형 | **객관식(단일 정답) · 복수 응답 — 2가지뿐** |
| 유효 기간 | 3년 |
| 응시료 | USD 150 (**원화 하드코딩 금지**, "결제 시점 환율" 명시) |

**도메인 가중치** — 페이지의 분량과 강조는 이 비율을 따른다.

| # | 공식 명칭 (영문) | 사이트 한국어명 | 가중치 |
|:--:|---|---|:--:|
| 1 | Design Secure Architectures | 보안 아키텍처 설계 | **30%** |
| 2 | Design Resilient Architectures | 복원력 있는 아키텍처 설계 | **26%** |
| 3 | Design High-Performing Architectures | 고성능 아키텍처 설계 | **24%** |
| 4 | Design Cost-Optimized Architectures | 비용 최적화 아키텍처 설계 | **20%** |

영문 명칭은 문제 JSON의 `domain` 필드 값으로 **글자 하나 틀리지 않게** 써야 한다.
`tools/validate.mjs`의 `EXAM_DOMAINS.SAA` 배열과 정확히 일치하지 않으면 ERROR이고,
진단 모드의 도메인 집계와 학습 순서 생성이 통째로 고장 난다.

> ### SAA-C04는 존재하지 않는다
>
> "SAA-C04가 2024년에 나왔다"는 서술은 **거짓**이다. 검색 엔진과 AI 요약이 이 주장을
> 반복하지만 출처를 추적하면 AI 생성 콘텐츠 팜 한 곳으로 수렴한다. AWS 공식 문서 경로는
> 2026년 현재도 `solutions-architect-associate-03`이다.
> **이 사이트에 SAA-C04를 단 한 번도 언급하지 않는다.** 반박하기 위한 언급도 하지 않는다.
>
> 마찬가지로 **"SAA-C03에 순서 배열·연결형·사례 연구 유형이 나온다"고 쓰지 않는다.**
> 그 유형들은 AIF-C01 등 2024년 이후 신규 자격증에만 도입되었다.

### 1-2. 사실 확인 규칙

> **`docs/FACT_SOURCES.md`를 먼저 읽는다.** 이 환경은 `docs.aws.amazon.com` 등
> AWS 문서 웹사이트가 네트워크 정책으로 차단되어 있다. **재시도하지 말고**,
> `FACT_SOURCES.md` §2가 정의한 도달 가능한 1차 소스(botocore, CloudFormation 리소스 스펙,
> cfn-lint, awsdocs GitHub 원본, WebSearch)로 확인한다.

- **한도·기본값·동작은 반드시 확인한 값만 쓴다. 기억에 의존 금지.**
  AWS는 기본값을 조용히 바꾼다. "예전에 그랬다"는 기억은 근거가 아니다.
- **확인 불가능한 수치는 쓰지 않는다.** 빈칸으로 두고 리포트에 명시한다.
  **"약", "대략", "보통 ~정도"로 얼버무리지 말 것.** 얼버무린 수치는 학습자에게
  확인된 수치와 구분되지 않으므로, 없느니만 못하다.
- 요금(달러/GB, 시간당 요금 등)은 `FACT_SOURCES.md` §5에서 **전면 금지**다.
  비용은 **상대 비교**(더 싸다/비싸다, 순위)로만 서술한다.
- **인용(citation)과 검증(verification)은 분리한다.**
  - 페이지의 "공식 문서 출처" 절과 문제 JSON의 `refs`에는 **독자가 열 수 있는
    `docs.aws.amazon.com` / `aws.amazon.com` URL**을 쓴다.
  - 우리가 실제로 확인한 경로(botocore 모델, GitHub raw, npm 패키지)는 **`refs`에 쓰지 않는다.**
    그 경로는 `docs/FACT_SOURCES.md`에만 기록한다.
  - `tools/validate.mjs`는 `refs[].url`이 `docs.aws.amazon.com`, `aws.amazon.com`,
    `awscli.amazonaws.com` 중 하나를 포함하지 않으면 **ERROR**다.
  - **URL을 지어내지 않는다.** 열어 보지 못한 경로는 확인된 상위 경로로 대체한다.

### 1-3. 자주 틀리는 AWS 사실 — 이 표대로 쓴다

시중 한국어 SAA 자료 상당수가 2020~2022년 기준이라, 아래 항목에서 **그대로 오답**을 낸다.
바뀐 사실 자체를 가르치는 것이 이 사이트의 차별점이다.

| 사실 | 현행 (사이트 표준) | 함정 |
|---|---|---|
| **S3 일관성** | 모든 리전에서 **강력한 읽기 후 쓰기 일관성**(strong read-after-write consistency). PUT·덮어쓰기 PUT·DELETE·LIST 전부 (2020-12) | "S3는 최종 일관성"이라고 쓰면 `validate.mjs`가 **ERROR**. 변경 사실을 설명하는 문맥(`이전에는`, `2020년까지는`)만 허용 |
| **S3 신규 버킷 기본값** | 퍼블릭 액세스 차단 **ON**, ACL **비활성**(`ObjectOwnership=BucketOwnerEnforced`), 신규 객체 **SSE-S3 자동 암호화** | **버전 관리(Versioning)는 여전히 기본 비활성화**다. "기본값이 다 켜졌다"고 뭉뚱그리면 틀린다. ACL로 접근 제어를 설명하는 서술은 이제 기본 구성이 아니다 |
| **Multi-AZ vs 읽기 전용 복제본** | Multi-AZ = **동기 복제 · 고가용성**, 대기 인스턴스는 읽기를 받지 않음 / 읽기 전용 복제본 = **비동기 복제 · 읽기 확장**, 별도 읽기 엔드포인트 | "Multi-AZ 대기 인스턴스에서 읽기가 가능하다"는 **표준 Multi-AZ 인스턴스 배포에서는 틀리다**. Multi-AZ **DB 클러스터** 배포(읽기 가능 대기 2개)는 별개 아키텍처이므로 반드시 구분해 쓴다. 시험이 가장 집요하게 노리는 쌍이다 |
| **SG vs NACL (상태 저장 여부)** | 보안 그룹 = **인스턴스 수준 · 상태 저장(stateful)** · 모든 규칙 평가 / 네트워크 ACL = **서브넷 수준 · 상태 비저장(stateless)** · 낮은 번호부터 순서대로 평가 | 상태 비저장인 NACL은 **반환 트래픽을 규칙으로 명시 허용**해야 한다. 아웃바운드만 열고 "왜 응답이 안 오지"가 전형적인 시나리오다 |
| **보안 그룹에는 거부 규칙이 없다** | 보안 그룹은 **허용(allow) 규칙만** 지원한다. 거부는 NACL에서만 가능 | "보안 그룹으로 특정 IP를 차단한다"는 선택지는 **항상 오답**이다. 차단은 NACL 또는 상위 계층(WAF)의 일이다 |
| **NAT 게이트웨이 AZ 이중화** | NAT 게이트웨이는 **지정한 서브넷의 AZ 안에서만** 동작한다. 고가용성이 필요하면 **AZ마다 하나씩 만들고 각 AZ의 프라이빗 라우팅 테이블이 자기 AZ의 NAT를 가리키게** 한다 | "관리형이니까 알아서 다중 AZ"가 아니다. 단일 NAT + 다중 AZ 프라이빗 서브넷은 **AZ 장애 시 전면 중단 + AZ 간 데이터 전송 요금** 두 가지를 동시에 유발한다. 또한 **NAT 게이트웨이에는 보안 그룹을 연결할 수 없다** (NAT 인스턴스는 가능) |
| **IAM 정책 평가 순서** | ① 기본은 **암묵적 거부** → ② **어떤 정책에서든 명시적 Deny가 있으면 즉시 거부** → ③ 명시적 Allow가 있으면 허용. 우선순위: **명시적 Deny > 명시적 Allow > 암묵적 Deny** | 결합 규칙을 혼동하는 것이 함정이다. 자격 증명 기반 + 리소스 기반(동일 계정) = **합집합**, 자격 증명 기반 + 권한 경계 / SCP / 세션 정책 = **교집합**. **SCP는 권한을 부여하지 않는다** — 상한(guardrail)만 정하며 **멤버 계정의 루트 사용자에게도 적용**된다 |
| **CloudFormation은 범위 안, CDK는 범위 밖** | CloudFormation은 시험 범위이므로 정식으로 가르친다. **AWS CDK는 AWS가 명시한 out-of-scope**다 | 학습자가 가장 많이 혼동하는 지점이다. CDK를 "IaC 대안"으로 나란히 소개하면 시험 범위 밖 서비스를 학습 대상처럼 서술하는 것이 되어 반려된다. 언급이 불가피하면 **"시험 범위 아님"을 문장 안에 명시**한다 |

**개명된 서비스** — 옛 이름을 새 이름 병기 없이 단독으로 쓰면 `validate.mjs`가 **WARN**한다.

| 옛 이름 | 현재 이름 |
|---|---|
| AWS SSO / AWS Single Sign-On | **AWS IAM Identity Center** |
| Amazon Elasticsearch Service | **Amazon OpenSearch Service** |
| AWS Server Migration Service (SMS) | **AWS Application Migration Service (MGN)** |

**EC2-Classic**은 2022년 8월 종료되었다. 사용 가능한 것처럼 서술하면 **ERROR**다.
(종료 사실을 설명하는 문맥은 허용된다.)

### 1-4. 출처 정책

- **허용(allowlist):** `docs.aws.amazon.com`, `aws.amazon.com` 공식 페이지·블로그·What's New,
  AWS 백서, AWS Well-Architected 문서, `awscli.amazonaws.com`.
  즉 **AWS가 배포하는 1차 소스**만이다.
- **금지(denylist) — 시험 덤프 사이트:**
  `examtopics`, `validexamdumps`, `pass4success`, `skillcertpro`,
  `itexams`, `examcollection`, `certlibrary`, `briefmenow`
  - **참조 자체를 금지한다.** 문제 복제는 물론, "출제 경향 파악" 목적의 열람도 금지다.
    저작권 및 자격증 NDA 위반이다.
  - 모든 문항은 **공식 도메인 블루프린트와 과제 진술만 보고 새로 창작**한다.
  - `tools/validate.mjs`는 HTML 본문과 `refs` URL 양쪽에서 이 8개 문자열을
    **대소문자 무시 부분 일치**로 찾아 **ERROR**를 낸다.
    "examtopics를 참조하지 마세요" 같은 **경고 문장조차 ERROR가 된다.** 이름 자체를 쓰지 않는다.
  - WebSearch를 쓸 때는 `blocked_domains`에 이 8개를 넣는다.

### 1-5. 시험 범위 밖 서비스

AWS가 명시적으로 out-of-scope로 지정한 영역이다. **학습자의 시간을 아끼는 것도 콘텐츠다.**

- 개발자 도구 전체: CodeBuild, CodeDeploy, CodePipeline, CodeCommit, CodeArtifact,
  CodeGuru, CodeStar, Cloud9, CloudShell, **AWS CDK**, Fault Injection Simulator
- 비즈니스 앱: Chime, Connect, WorkDocs, WorkMail, WorkSpaces, AppStream 2.0
- 기타: SWF, CloudSearch, Managed Service for Apache Flink, GameLift, IoT 제품군, Mainframe Modernization

범위 밖 서비스를 **학습 대상처럼 서술하지 않는다.** 언급이 필요하면
`<aside class="note note--warn" data-label="시험 범위 아님">` 안에 인지 수준으로만 담는다.
시험 범위 밖이지만 학습자가 접하게 되는 신규 서비스(Aurora DSQL, S3 Tables, S3 Vectors 등)도 같은 취급이다.

---

## §2 한국어 서술 규칙

### 2-1. 용어 병기

- **한국어 본문.** 기술 용어는 첫 등장 시 한국어 뒤 괄호로 원어를 병기한다.
  - `가용 영역(Availability Zone, AZ)`
  - `상태 저장(stateful)`, `수명 주기 정책(lifecycle policy)`, `봉투 암호화(envelope encryption)`
  - 약어가 본문에서 계속 쓰일 때는 위처럼 **원어와 약어를 함께** 넣는다. 이후에는 `AZ`만 쓴다.
- **AWS 서비스 정식 명칭은 번역하지 않는다.**
  - `Amazon S3`, `AWS Lambda`, `Amazon EC2`, `Amazon RDS`, `AWS KMS`
  - `아마존 S3`, `S3 버킷 서비스`, `람다` 같은 표기는 금지다.
- **Amazon / AWS 접두사 규칙**
  - **첫 등장 시 정식 명칭**을 쓴다: `Amazon Elastic Compute Cloud(EC2)`가 필요한 경우도 있지만,
    널리 통용되는 서비스는 `Amazon EC2`, `Amazon S3`처럼 접두사 + 통용 약칭으로 충분하다.
  - **이후에는 약칭을 허용한다**: `EC2`, `S3`, `Lambda`, `RDS`.
  - 접두사를 바꿔 쓰지 않는다. `AWS S3`(X) → `Amazon S3`(O),
    `Amazon Lambda`(X) → `AWS Lambda`(O). 서비스마다 접두사가 정해져 있다.
  - 섹션 제목·표 헤더·`<figcaption>`에서는 **정식 명칭**을 쓴다. 검색 인덱스가 이 텍스트를 읽는다.
- 설정 키·CLI 옵션·API 파라미터·정책 요소는 **번역하지 않고 `<code>`로 감싼다**:
  `<code>ObjectOwnership</code>`, `<code>--query</code>`, `<code>Effect</code>`, `<code>MultiAZ</code>`.

### 2-2. Well-Architected 기둥 명칭

| 영문 | 사이트 표준 한국어 |
|---|---|
| Operational Excellence | 운영 우수성 |
| Security | 보안 |
| **Reliability** | **안정성** |
| Performance Efficiency | 성능 효율성 |
| Cost Optimization | 비용 최적화 |
| Sustainability | 지속 가능성 |

AWS 한국어 문서가 Reliability를 "안정성"과 "신뢰성"으로 혼용한다.
**사이트 표준은 "안정성"으로 통일**하고, 페이지마다 첫 등장 시 다음처럼 병기한다.

```
안정성(Reliability, 신뢰성으로도 번역됨)
```

이후에는 "안정성"만 쓴다. 같은 페이지에서 "신뢰성"으로 되돌아가지 않는다.

### 2-3. 톤

**동료 엔지니어에게 설명하듯** 쓴다. 존댓말(`~합니다` 체). 과장·감탄·마케팅 어휘 금지.

```
[bad]  놀랍게도 Amazon S3는 사실상 무한한 확장성을 자랑하는 최고의 스토리지입니다!
[good] Amazon S3는 객체 단위로 저장하며 버킷당 저장 용량과 객체 수에 상한이 없습니다.
       단일 객체의 최대 크기는 50 TB입니다(2025년 12월에 5 TB에서 상향되었습니다).
```

```
[bad]  IAM 역할은 정말 강력하고 필수적인 기능이니 꼭 익혀 두세요!!
[good] EC2 인스턴스에서 다른 AWS 서비스를 호출할 때는 액세스 키 대신 IAM 역할을 씁니다.
       역할은 임시 자격 증명을 인스턴스 메타데이터로 전달하므로 유출된 키를 회수할 필요가 없습니다.
```

- **한 문단은 3~5문장.** 길어지면 목록·표·다이어그램·차트로 분해한다.
  분해하지 않은 긴 문단은 Wave 3 검증에서 지적 대상이다.
- "쉽게 말해", "즉", "다시 말해" 같은 재진술은 개념이 실제로 어려울 때만 쓴다.
- 시험 관련 서술에서 **단정을 피해야 하는 것**과 **단정해야 하는 것**을 구분한다.
  - 단정한다: 도메인 가중치, 문항 수, 시간, 합격 점수 — 공식 발표된 값이다.
  - 단정하지 않는다: 실제 출제 빈도, 특정 서비스가 "몇 문제 나온다", 은퇴 예정일.
  - **"정답률 72%면 합격"처럼 쓰지 않는다.** 720은 스케일 점수이며 원점수 백분율과
    1:1 대응하지 않는다. 백분율을 보여줄 때는 반드시 이 사실을 함께 적는다.

---

## §3 HTML 규칙

### 3-1. 페이지 골격 — 모든 콘텐츠 페이지 동일

아래는 `basics/ch04.html`(루트 기준 1단계 깊이)의 정본이다. **그대로 복사해서 값만 바꾼다.**

```html
<!doctype html>
<html lang="ko" data-theme="auto">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>4장 · VPC 연결과 하이브리드 — AWS SAA Guide</title>
  <meta name="description" content="VPC 피어링, Transit Gateway, VPC 엔드포인트와 PrivateLink, Site-to-Site VPN, Direct Connect의 선택 기준을 정리합니다.">
  <link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">

  <link rel="stylesheet" href="../assets/css/tokens.css">
  <link rel="stylesheet" href="../assets/css/main.css">
  <link rel="stylesheet" href="../assets/css/code.css">
  <link rel="stylesheet" href="../assets/css/viz.css">
  <link rel="stylesheet" href="../assets/css/chart.css">

  <script src="../assets/js/boot.js"></script>
</head>
<body class="has-sidebar has-toc">
  <a class="skip-link" href="#main">본문 바로가기</a>
  <div id="sidebar-mount" data-section="basics" data-page="ch04"></div>

  <main id="main" class="page" data-page-id="basics/ch04">
    <nav class="breadcrumb" aria-label="경로">
      <ol>
        <li><a href="../index.html">홈</a></li>
        <li><a href="../index.html#basics">기본개념</a></li>
        <li><span aria-current="page">4장</span></li>
      </ol>
    </nav>

    <header class="page__header">
      <p class="page__eyebrow">기본개념 · 4장</p>
      <h1>VPC 연결과 하이브리드</h1>
      <p class="page__lead">한 문단 요약. 이 페이지가 무엇을 해결해 주는지 적습니다.</p>
    </header>

    <section class="objectives" aria-labelledby="objectives">
      <h2 id="objectives">학습 목표</h2>
      <ul>
        <li>VPC 피어링과 Transit Gateway의 적용 조건을 구분할 수 있습니다.</li>
      </ul>
    </section>

    <!-- 본문 섹션들 -->

    <nav class="pager" aria-label="이전/다음"></nav>
  </main>

  <script src="../assets/js/progress.js" defer></script>
  <script src="../assets/js/highlight.js" defer></script>
  <script src="../assets/js/viz.js" defer></script>
  <script src="../assets/vendor/chart.umd.min.js" defer></script>
  <script src="../assets/js/charts.js" defer></script>
  <script src="../assets/js/app.js" defer></script>
  <script src="../assets/js/quiz.js" defer></script>
</body>
</html>
```

> 정본은 Wave 0이 만든 **`index.html`과 `quiz/index.html`**이다. 위 골격과 어긋나는 부분이
> 발견되면 실제 파일 쪽이 옳다. 새 페이지를 만들 때는 `quiz/index.html`의 `<head>`와
> 스크립트 블록을 그대로 복사한 뒤 경로 깊이·`data-*` 값만 바꾸는 것이 가장 안전하다.

**골격의 각 요소가 왜 그 자리에 있는가 — 순서를 바꾸면 깨진다**

| 요소 | 규칙 | 이유 |
|---|---|---|
| `<html lang="ko" data-theme="auto">` | 고정 | `lang`이 없으면 `validate.mjs` **WARN**. `data-theme="auto"`는 OS 설정을 따르겠다는 초기값이고, `boot.js`가 저장된 설정이 있을 때만 `light`/`dark`로 덮어쓴다 |
| `<title>` | `{페이지 제목} — AWS SAA Guide` | `tools/build-index.mjs`가 접미사를 잘라 TOC 제목으로 쓴다. 형식이 다르면 검색 결과 제목이 지저분해진다 |
| `<meta name="description">` | 필수 | 검색 인덱스의 스니펫 원본 |
| 스타일시트 5개 | **tokens → main → code → viz → chart 순서 고정** | `tokens.css`가 모든 `--c-*` 변수를 정의한다. `chart.css`는 `main.css`의 `.table-scroll`을, `charts.js`는 `viz.css`의 `--dg-*`를 읽는다. 순서가 어긋나면 다크모드와 차트 색이 깨진다 |
| `boot.js` | **`<head>` 안, `defer` 없이** | 첫 페인트 전에 저장된 테마·글자 크기를 `<html>` 속성에 반영한다. `defer`를 붙이면 잘못된 색으로 한 번 그려졌다가 바뀌는 깜빡임이 생긴다 |
| `<body class="has-sidebar has-toc">` | 정적으로 명시 | 좌측 사이드바와 우측 목차의 폭을 미리 예약해 레이아웃 이동(CLS)을 막는다. `app.js`도 같은 클래스를 붙이지만, 정적으로 없으면 렌더 후에 본문이 밀린다. h2/h3이 2개 미만인 페이지에서는 `app.js`가 `has-toc`를 런타임에 걷어낸다 |
| `.skip-link` | `<body>`의 첫 요소 | 키보드 사용자의 본문 바로가기. `app.js`가 상단바를 이 뒤에 주입한다 |
| `#sidebar-mount` | `data-section` + `data-page` | `app.js`가 `data/toc.json`을 읽어 사이드바를 렌더링한다. **사이드바 HTML을 직접 쓰지 않는다** |
| `<main id="main" class="page" data-page-id="...">` | `data-page-id`는 `{section}/{page}` (확장자 없음) | 진도 저장(`ag:progress:read`)·이전/다음 pager·사이드바 현재 페이지 표시가 전부 이 값으로 동작한다. 루트 `index.html`만 `data-page-id="index"` |
| `.pager` | **빈 `<nav>`로 둔다** | `app.js`가 TOC 순서로 이전/다음을 채운다. 안에 `<a>`가 하나라도 있으면 자동 생성을 건너뛰므로, 직접 쓰려면 양쪽 다 써야 한다 |
| 스크립트 7개 | **progress → highlight → viz → vendor/chart.umd.min.js → charts → app → quiz 순서 고정**, 전부 `defer` | `defer`는 문서 순서대로 실행된다. `charts.js`는 전역 `Chart`(벤더 번들)를 읽으므로 **`chart.umd.min.js`가 반드시 먼저**여야 하고, `app.js`는 다이어그램을 주입하며 `AG.viz.mount`를 부르므로 `viz.js`가 먼저여야 하며, `quiz.js`는 `AG.progress`·`AG.highlight`를 쓴다. 홈(`index.html`)만 마지막이 `quiz.js` 대신 `home.js`다 |

**페이지 종류별 차이**

- 퀴즈가 없는 페이지에서도 `quiz.js`를 넣어 둔다. `.quiz-embed`가 없으면 아무 일도 하지 않는다.
- 차트도 다이어그램도 없는 페이지에서도 **스타일시트 5개와 스크립트 7개를 전부 넣는다.**
  생략하면, 나중에 시각화·차트 에이전트가 플레이스홀더를 채울 때 콘텐츠 에이전트 소유 파일의
  `<head>`를 고쳐야 하는 상황이 생긴다. 소유권 경계를 지키는 것이 몇 KB보다 중요하다.
- 홈(`index.html`)은 마지막 스크립트가 `home.js`이고 `quiz.js`를 넣지 않는다. Wave 0 소유다.
- `saa/cram.html`처럼 폭이 넓은 표 위주 페이지는 `<main id="main" class="page page--wide" …>`를 쓴다.

### 3-2. 절대 금지

| 금지 | 검증기 |
|---|---|
| 외부 CDN·폰트·스크립트·이미지·iframe·`@import`·CSS `url(//…)` | **ERROR** |
| 인라인 `<style>` 블록 | **ERROR** |
| 인라인 `<script>` 블록 (`src` 없는 `<script>`) | **ERROR** |
| `style=` 속성 | **WARN** — 그러나 **이 계약에서는 금지다.** 필요한 스타일이 없으면 임의로 만들지 말고 리포트에 올린다 |
| `<img>`에 `alt` 없음 | **ERROR** |
| 덤프 사이트 이름 문자열 | **ERROR** |

모든 자원은 **상대 경로**다. 절대 경로(`/assets/…`)는 `file://`로 열 때 깨지므로 쓰지 않는다.

### 3-3. 상대 경로 깊이

이 저장소의 콘텐츠 디렉터리는 **전부 루트 기준 1단계**다.

| 파일 위치 | 자산 경로 | 다른 섹션 링크 |
|---|---|---|
| `index.html` (루트) | `assets/css/main.css` | `basics/ch08.html` |
| `basics/ch08.html` | `../assets/css/main.css` | `../cases/case03.html` |
| `saa/keywords.html` | `../assets/css/main.css` | `../basics/ch02.html` |
| `quiz/result.html` | `../assets/css/main.css` | `../saa/domain-secure.html` |
| `labs/lab03.html` · `cases/case03.html` · `cheatsheet/cost.html` | `../assets/…` | `../basics/ch14.html` |

2단계 이상 깊은 디렉터리는 만들지 않는다. `validate.mjs --links`가 링크 대상 파일과
`#앵커`의 실존 여부를 모두 검사한다. 대상 파일이 없으면 **ERROR**,
`data/toc.json`에 등록된 예정 경로면 WARN(`--strict`에서 ERROR), 앵커가 없으면 WARN이다.

### 3-4. 시맨틱 태그와 id

- 구조는 `<section>`, `<figure>` + `<figcaption>`, `<aside>`, `<table>` + `<caption>` + `<th scope>`로 표현한다.
- **모든 `<h2>`·`<h3>`에 `id`를 붙인다.** id는 **영문 kebab-case**다.
  - `id="security-group-vs-nacl"`, `id="iam-policy-evaluation"`, `id="exam-points"`
  - 한글 id를 쓰지 않는다. URL 프래그먼트로 공유될 때 인코딩되어 읽을 수 없게 된다.
  - 누락 시 `validate.mjs` **WARN**이다. `app.js`가 런타임에 생성해 주지만,
    **런타임 생성 id로는 다른 페이지에서 앵커 링크를 걸 수 없다.** 명시가 계약이다.
- 페이지에 `<h1>`은 하나뿐이며 `.page__header` 안에 있다.
- 챕터 페이지의 표준 섹션 id (교차 링크가 이 이름을 전제로 걸린다):

  | 섹션 | 권장 id |
  |---|---|
  | 학습 목표 | `objectives` |
  | 흔한 오해 | `common-misconceptions` |
  | 시험 포인트 정리 | `exam-points` |
  | 확인 문제 | `check-quiz` |
  | 이어서 볼 곳 | `see-also` |
  | 공식 문서 출처 | `references` |

### 3-5. 컴포넌트 클래스 — `assets/css/main.css` · `assets/css/chart.css` 실물 기준

**여기 없는 클래스는 존재하지 않는다.** 새 클래스를 발명하지 않는다. CSS 파일은
Wave 0 소유이므로 콘텐츠 에이전트가 수정할 수 없다. 필요한 컴포넌트가 없으면 리포트에 올린다.

#### 페이지 뼈대

| 클래스 | 마크업 | 용도 |
|---|---|---|
| `.skip-link` | `<a class="skip-link" href="#main">본문 바로가기</a>` | 본문 바로가기. 골격 고정 |
| `.page` | `<main id="main" class="page" data-page-id="…">` | 본문 컨테이너 |
| `.page--wide` | `<main class="page page--wide">` | 넓은 표 위주 페이지(`cram`, `cheatsheet/*`)에서 폭 제한 해제 |
| `.breadcrumb` | `<nav class="breadcrumb" aria-label="경로"><ol><li>…` | 경로. `li + li` 사이 구분자는 CSS가 넣는다 |
| `.page__header` | `<header class="page__header">` | 제목 블록 |
| `.page__eyebrow` | `<p class="page__eyebrow">기본개념 · 4장</p>` | 제목 위 라벨 |
| `.page__lead` | `<p class="page__lead">…</p>` | 한 문단 요약 |
| `.page__meta` | `<p class="page__meta">…</p>` | 부가 메타(읽는 시간, 관련 도메인 등) |
| `.pager` | `<nav class="pager" aria-label="이전/다음"></nav>` | **비워 둔다.** `app.js`가 채운다 |
| `.sr-only` | `<span class="sr-only">…</span>` | 화면에는 숨기고 스크린 리더에만 읽히는 텍스트 |
| `<kbd>` (클래스 없음) | `<kbd>Enter</kbd>로 제출합니다` | 키보드 키. `main.css`가 스타일을 준다 |
| `<abbr title="…">` (클래스 없음) | `<abbr title="Availability Zone">AZ</abbr>` | 약어. 점선 밑줄이 붙는다. 첫 등장 병기(§2-1)를 대체하지는 않는다 |

#### 학습 목표

```html
<section class="objectives" aria-labelledby="objectives">
  <h2 id="objectives">학습 목표</h2>
  <ul>
    <li>보안 그룹과 네트워크 ACL의 적용 계층과 상태 저장 여부를 구분할 수 있습니다.</li>
    <li>프라이빗 서브넷의 아웃바운드 경로를 NAT 게이트웨이로 설계할 수 있습니다.</li>
  </ul>
</section>
```

4~6개, 전부 **"~할 수 있습니다"** 형태로 쓴다.

#### 노트 계열 `.note`

`data-label` 속성이 있으면 그 값이 상자 상단의 라벨로 렌더링된다. 없으면 라벨 줄이 사라진다.

| 클래스 | 언제 | 예 |
|---|---|---|
| `.note` (또는 `.note note--info`) | 보충 정보 | `<aside class="note" data-label="참고">` |
| `.note note--warn` | 주의·자주 하는 실수 | `<aside class="note note--warn" data-label="주의">` |
| `.note note--danger` | 사고로 이어지는 함정 | `<aside class="note note--danger" data-label="함정">` |
| `.note note--version` | 기본값·이름이 바뀐 사실 | `<aside class="note note--version" data-label="변경 이력">` |
| `.note note--exam` | **시험 포인트** | 아래 규약 참조 |
| `.note note--ok` | 권장 구성·정답 패턴 | `<aside class="note note--ok" data-label="권장">` |

**`.note--exam`의 `data-label` 규약** — 반드시 어느 도메인인지 밝힌다.

```html
<aside class="note note--exam" data-label="시험 포인트 · 보안 아키텍처 설계">
  <p>보안 그룹은 <strong>허용 규칙만</strong> 지원합니다. "보안 그룹으로 특정 IP를
  차단한다"는 선택지가 보이면 그 자리에서 소거합니다. 거부는
  <a href="ch03.html#network-acl">네트워크 ACL</a>의 일입니다.</p>
</aside>
```

`data-label`의 형식은 `시험 포인트 · {도메인 한국어명}`이며, 도메인 한국어명은 §1-1의 4개
(보안 아키텍처 설계 / 복원력 있는 아키텍처 설계 / 고성능 아키텍처 설계 / 비용 최적화 아키텍처 설계)
중 하나다. 도메인이 둘 이상이면 `·`가 아니라 `,`로 잇는다: `시험 포인트 · 보안 아키텍처 설계, 비용 최적화 아키텍처 설계`.

시험 범위 밖 서비스를 언급할 때는 `<aside class="note note--warn" data-label="시험 범위 아님">`을 쓴다.

#### 배지 `.badge`

| 클래스 | 용도 |
|---|---|
| `.badge` | 중립 배지 (도메인명, 태그) |
| `.badge badge--saa` | **SAA 시험에 직접 출제되는 항목** 표시 |
| `.badge badge--study` | **학습용 · 실제 시험에는 출제되지 않음** 표시. `matching`/`ordering` 문항 안내에 필수 |
| `.badge badge--easy` / `--medium` / `--hard` | 난이도 |

```html
<h3 id="policy-evaluation">정책 평가 로직 <span class="badge badge--saa">SAA 빈출</span></h3>
```

```html
<p><span class="badge badge--study">학습용 유형</span> 아래 연결형 문항은 암기 확인용이며
실제 SAA-C03 시험에는 출제되지 않습니다.</p>
```

#### 표

**모든 표는 `.table-scroll`로 감싼다. 예외 없다.** 360px에서 표가 페이지 전체를
가로 스크롤시키는 것을 막는 유일한 장치다.

```html
<div class="table-scroll">
  <table class="config-table">
    <caption>보안 그룹과 네트워크 ACL 비교</caption>
    <thead>
      <tr>
        <th scope="col">항목</th>
        <th scope="col">보안 그룹</th>
        <th scope="col">네트워크 ACL</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th scope="row">적용 계층</th>
        <td>인스턴스(ENI)</td>
        <td>서브넷</td>
      </tr>
      <tr>
        <th scope="row">상태</th>
        <td><span class="mark-ok">상태 저장</span></td>
        <td><span class="mark-no">상태 비저장</span></td>
      </tr>
    </tbody>
  </table>
</div>
```

| 클래스 | 용도 |
|---|---|
| `.table-scroll` | **모든 표의 필수 래퍼.** 가로 스크롤을 표 안쪽에 가둔다 |
| `.config-table` | 설정·한도·비교 표. **2번째 열이 자동으로 고정폭 글꼴 + 줄바꿈 없음**이 된다 |
| `.config-table config-table--plain` | 2번째 열이 값이 아니라 산문일 때 위 서식을 끈다 |
| `.t-center` | 셀 가운데 정렬 |
| `.t-nowrap` | 셀 줄바꿈 금지 |
| `.mark-ok` / `.mark-no` | 가능/불가 표시. **색만으로 전달하지 말고 텍스트를 함께 넣는다** (§5) |

`<caption>`은 모든 표에 넣는다. `<th>`에는 `scope="col"` 또는 `scope="row"`가 없으면 **WARN**이다.

#### 코드 블록 `figure.code`

```html
<figure class="code">
  <figcaption><span class="code__name">describe-security-groups.sh</span> — 규칙 확인</figcaption>
  <pre><code class="lang-bash">aws ec2 describe-security-groups \
  --group-ids sg-0123456789abcdef0 \
  --query 'SecurityGroups[0].IpPermissions'</code></pre>
</figure>
```

- `<figcaption>`은 필수다. 파일명이 있으면 `.code__name`으로 감싼다.
- 복사 버튼(`.code__copy`)은 `app.js`가 주입한다. **직접 쓰지 않는다.**
- `<pre>`와 `<code>` 사이, `<code>` 시작 직후에 줄바꿈을 넣지 않는다. 첫 줄이 빈 줄로 렌더링된다.

**허용하는 `lang-*` 값 — 이 8개만 쓴다**

| 값 | 용도 | 하이라이팅 |
|---|---|---|
| `lang-bash` | **AWS CLI 예제 전부**, 셸 스크립트 | 지원 |
| `lang-yaml` | **CloudFormation 템플릿 전부** | 지원 |
| `lang-json` | **IAM 정책·버킷 정책·키 정책·신뢰 정책 전부**, API 응답 | 지원 |
| `lang-python` | boto3 예제 | 지원 |
| `lang-javascript` | Lambda(Node.js) 예제 | 지원 |
| `lang-sql` | Athena·Redshift 쿼리 | 지원 |
| `lang-text` | 출력 로그, 트리 구조, 의사 코드 | **규칙 없음 — 원문 그대로 렌더링** |
| `lang-hcl` | Terraform | **규칙 없음 — 원문 그대로 렌더링.** Terraform은 시험 범위 밖이므로 **사용을 자제한다** |

`assets/js/highlight.js`의 `LANGS` 테이블에 `text`와 `hcl` 규칙은 없다. 오류가 나지는 않고
평문으로 그려질 뿐이다. 나머지 6개는 실제로 토큰화된다.
엔진에는 `java`, `properties`, `xml` 규칙도 남아 있지만 **이 사이트에서는 쓰지 않는다.**

AWS CLI 예제 작성 규칙:
- 프로파일·리전을 하드코딩하지 않는다. 필요하면 `--region ap-northeast-2`처럼 자리만 보여주고
  값이 예시임을 캡션에 밝힌다.
- 계정 ID는 `123456789012`, 리소스 ID는 `sg-0123456789abcdef0` 형태의 명백한 예시값을 쓴다.
- 실제 액세스 키 형태의 문자열(`AKIA…`)을 예시로도 쓰지 않는다.

#### Before / After 비교 `.diff`

```html
<div class="diff">
  <div class="diff__before">
    <p>EC2 인스턴스에 액세스 키를 환경 변수로 심어 배포합니다.</p>
    <figure class="code"><pre><code class="lang-bash">export AWS_ACCESS_KEY_ID=…</code></pre></figure>
  </div>
  <div class="diff__after">
    <p>인스턴스 프로파일로 IAM 역할을 연결하고 SDK의 기본 자격 증명 체인에 맡깁니다.</p>
    <figure class="code"><pre><code class="lang-bash">aws ec2 associate-iam-instance-profile \
  --instance-id i-0123456789abcdef0 \
  --iam-instance-profile Name=AppServerRole</code></pre></figure>
  </div>
</div>
```

`✕ Before` / `✓ After` 라벨은 CSS가 넣는다. 직접 쓰지 않는다. 360px에서는 세로로 쌓인다.

#### 카드 목록 `.card-grid`

"이어서 볼 곳" 절과 허브 페이지의 링크 묶음에 쓴다.

```html
<ul class="card-grid">
  <li>
    <a class="card" href="../cases/case04.html">
      <span class="card__title">케이스 4 · 퍼블릭 서브넷에 데이터베이스를 뒀다</span>
      <span class="card__desc">서브넷 설계와 보안 그룹만으로는 막히지 않는 구성을 뜯어봅니다.</span>
      <span class="card__meta">아키텍처 케이스</span>
    </a>
  </li>
</ul>
```

`.card`는 `<a>`에 붙일 때만 호버 효과가 살아난다. 카드 안에 별도의 `<a>`를 중첩하지 않는다.

#### 인라인 퀴즈 `.quiz-embed`

```html
<section aria-labelledby="check-quiz">
  <h2 id="check-quiz">확인 문제</h2>
  <div class="quiz-embed" data-set="basics-ch04" data-count="10"></div>
</section>
```

| 속성 | 기본값 | 의미 |
|---|---|---|
| `data-set` | — | `data/questions/{setId}.json`의 `setId`. 필수 |
| `data-count` | 전부 | 출제할 문항 수 |
| `data-mode` | `study` | `study`(즉시 채점) / `exam`(일괄 채점) |
| `data-title` | 세트 제목 | 위젯 헤더 문구 |
| `data-shuffle` | `true` | `"false"`면 문항 순서 고정 |
| `data-shuffle-choices` | `true` | `"false"`면 선택지 순서 고정 |

`.quiz__*`, `.qm__*`, `.qo__*`, `.result__*`, `.bar-chart*`, `.plan*`, `.wrong-list*`, `.fc__*`는
전부 `quiz.js` / `flashcard.js`가 런타임에 생성하는 내부 클래스다. **HTML에 직접 쓰지 않는다.**

#### 다이어그램 플레이스홀더 `figure.diagram`

**콘텐츠 에이전트는 플레이스홀더만 쓴다. SVG는 시각화 에이전트(V1–V3)가 만든다.**

```html
<figure class="diagram" data-diagram="D-030">
  <figcaption>퍼블릭 서브넷과 프라이빗 서브넷의 아웃바운드 경로 — 인터넷 게이트웨이와 NAT 게이트웨이</figcaption>
</figure>
```

- `data-diagram`은 **`D-###` 형식**이어야 한다. 어기면 **ERROR**.
- ID는 `docs/DIAGRAM_CATALOG.md`에 등록된 것만 쓴다. 카탈로그에 없으면 **ERROR**.
  (카탈로그 파일이 아직 없으면 이 검사는 건너뛰지만, 카탈로그가 생기는 순간 전수 검사된다.)
- `<figcaption>`이 없으면 **WARN**. 캡션은 검색 인덱스에 들어가는 유일한 설명이므로 필수로 쓴다.
- **`<svg>`를 직접 넣지 않는다.** `tools/inline-diagrams.mjs`가 Wave 4에서 정적 치환한다.
- 참조한 ID의 SVG가 아직 없으면 WARN이고, `--strict`에서 ERROR로 승격된다.

#### 차트 플레이스홀더 `figure.chart`

**콘텐츠 에이전트는 플레이스홀더만 쓴다. 차트 스펙은 차트 에이전트(G1–G2)가 등록한다.**

```html
<figure class="chart" data-chart="C-010">
  <figcaption>S3 스토리지 클래스별 상대 저장 비용 — 값은 등급이며 절대 요금이 아닙니다.</figcaption>
</figure>
```

- `data-chart`는 **`C-###` 형식**이어야 한다. 어기면 **ERROR**.
- **`<canvas>`를 직접 쓰지 않는다.** 쓰면 **ERROR**다. `charts.js`가 `.chart__canvas > canvas`를 만든다.
- **표 대체본 `.chart__table`도 직접 쓰지 않는다.** `charts.js`가 스펙의 `a11yTable` 또는
  데이터에서 자동 생성한다. 콘텐츠 쪽 책임은 `<figcaption>`뿐이다.
- `<figcaption>`이 없으면 **WARN**. 캔버스는 스크린 리더에 아무것도 전달하지 못하므로
  캡션이 정보의 정본이다.
- **해당 ID가 `assets/js/charts*.js`에 등록되어 있지 않으면 WARN이고, `--strict` 배포 빌드에서
  ERROR로 승격된다.** 다이어그램의 미존재 SVG와 같은 유예다.
  콘텐츠 에이전트가 차트 에이전트보다 먼저 플레이스홀더를 넣는 것이 정상 순서이므로,
  그 시점에 빌드를 깨지 않는다. 다만 **유예일 뿐 면제가 아니다** — 배포 전까지 등록되지 않으면
  페이지에 "등록되지 않았습니다" 상자가 그대로 노출된다.
  `docs/CHART_CATALOG.md`에 등록된 ID만 쓰고, 차트 에이전트와 순서가 어긋나면 리포트에 올린다.
- `.chart__missing`은 등록 실패 시 `charts.js`가 그리는 안내 상자다. 직접 쓰지 않는다.
- **★ 차트를 쓰는 페이지는 스크립트 4개를 모두 로드해야 한다** — `assets/vendor/chart.umd.min.js`,
  `assets/js/charts.js`, `assets/js/charts-content.js`, `assets/js/charts-dash.js`.
  순서도 이대로여야 한다(`charts.js`가 전역 `Chart`를 읽고, 등록부는 그 뒤에 온다).
  하나라도 빠지면 등록부와 참조가 양쪽 다 멀쩡해도 페이지에는 "등록되지 않았습니다" 상자만 뜬다.
  다른 검사가 전부 통과하므로 브라우저로 열기 전에는 드러나지 않는다 —
  **`basics/ch14.html`·`ch15.html`이 실제로 이 상태로 통과했다.**
  이후 `validate.mjs --charts`가 기계적으로 잡는다. `basics/ch01.html`의 스크립트 목록을 그대로 복사하라.

#### 버튼·폼 (허브 페이지 전용)

`.btn`, `.btn--primary`, `.btn--ghost`, `.btn--danger`, `.btn--sm`, `.btn--block`,
`.field`, `.toolbar`, `.kpi-grid`, `.kpi`, `.dash__note`, `.cheat-filter__status`.

챕터·케이스·실습 페이지에서는 쓸 일이 없다. 퀴즈 허브·홈·치트시트 필터에서만 쓴다.

#### 런타임 전용 — HTML에 직접 쓰지 않는 클래스

`.topbar*`, `.icon-btn`, `.search-trigger*`, `.search-dialog`, `.search-panel*`, `.search-results*`,
`.sidebar*`, `.drawer-overlay`, `.page-toc*`, `.heading-anchor`, `.code__copy`,
`.diagram__missing`, `.chart__canvas`, `.chart__table`, `.chart__missing`,
`.quiz__*`, `.qm*`, `.qo*`, `.result__*`, `.bar-chart*`, `.plan*`, `.wrong-list*`, `.fc*`,
`.dg-*`(viz.css), `.ag-diagram`, `.has-sidebar`, `.drawer-open`.

이들을 HTML에 직접 쓰면 런타임 생성물과 충돌해 중복 렌더링되거나 이벤트가 두 번 붙는다.

---

## §4 교차 링크 규칙

콘텐츠는 서로 연결되어야 가치가 생긴다.
**모든 페이지는 최소 3개의 내부 링크를 포함한다.** 상단 breadcrumb과 자동 생성 pager는 세지 않는다.

### 4-1. 방향 매트릭스

| 방향 | 어디에 | 예 |
|---|---|---|
| **챕터 → 케이스** | 개념 설명 직후, 실패 사례를 예고 | `이 구성을 잘못 두면 어떤 일이 벌어지는지는 <a href="../cases/case04.html">케이스 4 · 퍼블릭 서브넷에 데이터베이스를 뒀다</a>에서 다룹니다.` |
| **챕터 → 치트시트** | 표가 길어질 때, 전체 목록 대신 | `전체 비교표는 <a href="../cheatsheet/compare.html#sg-vs-nacl">헷갈리는 쌍 비교</a>에 있습니다.` |
| **케이스 → 챕터** | "요구사항·제약" 절 뒤 배경 지식 | `배경 개념은 <a href="../basics/ch03.html#security-group">3장 VPC 네트워킹 기초</a>를 참고합니다.` |
| **시험 도메인 → 챕터** | `saa/domain-*.html`의 과제 진술별 매핑표 | `1.1 AWS 리소스에 대한 보안 액세스 설계 → <a href="../basics/ch02.html">2장 IAM과 자격 증명</a>` |
| **챕터 → 실습** | 개념을 손으로 확인시킬 때 | `직접 만들어 보려면 <a href="../labs/lab01.html">실습 1 · 3계층 VPC 직접 구성</a>을 따라 합니다.` |
| **챕터 → 챕터** | 선행/후행 개념 | `KMS 키 정책은 <a href="ch16.html#kms-key-policy">16장</a>에서 자세히 다룹니다.` |
| **모든 페이지 → 도메인 페이지** | "시험 포인트 정리" 절 안 | `이 주제는 <a href="../saa/domain-secure.html">보안 아키텍처 설계(30%)</a>에 속합니다.` |

챕터 페이지는 **"이어서 볼 곳"(`id="see-also"`) 절**에 `.card-grid`로 3개 이상을 모아 둔다.
본문 안의 문맥 링크는 그와 별개로 자연스럽게 넣는다.

### 4-2. 존재하지 않을 경로로 링크하지 않는다

- 링크 대상은 `PLAN.md` §1의 파일 목록과 `tools/build-index.mjs`의 `SECTIONS` 선언에
  **실제로 존재하는 경로**여야 한다. `basics/ch19.html`, `cheatsheet/iam.html` 같은
  "있으면 좋겠는" 경로를 만들어 내지 않는다.
- 아직 다른 에이전트가 만들지 않은 페이지로 링크하는 것은 **허용된다.**
  `data/toc.json`에 등록된 경로면 `validate.mjs`가 WARN으로 처리한다.
  단 `--strict`(Wave 3/4)에서는 ERROR로 승격되므로, Wave 4 시점에 전부 채워져야 한다.
- **앵커(`#id`)까지 검증된다.** 대상 페이지에 그 id가 없으면 WARN이다.
  다른 에이전트 소유 페이지의 앵커를 걸 때는 §3-4의 표준 섹션 id만 쓴다.
  그 밖의 앵커는 대상 파일이 완성된 뒤 Wave 3에서 확인한다.
- 외부 링크는 §1-4 allowlist 호스트만 허용된다. 새 창으로 열지 않는다(`target` 사용 안 함).

---

## §5 접근성

- **색상만으로 정보를 전달하지 않는다.** 아이콘이나 텍스트를 병기한다.
  ```html
  <!-- bad  --> <td class="mark-ok">●</td>
  <!-- good --> <td><span class="mark-ok">지원</span></td>
  <!-- good --> <td><span class="mark-no">✕ 불가</span></td>
  ```
- **본문 대비비 4.5:1 이상.** `tokens.css`의 색만 쓰면 자동으로 만족한다.
  임의 색을 `style=`로 넣는 순간 이 보장이 깨진다. 그래서 §3-2에서 금지한다.
- **포커스 링을 제거하지 않는다.** `outline: none`을 쓰지 않는다.
  키보드 사용자가 자기 위치를 잃는다.
- **표 헤더에 `scope`를 붙인다.** `scope="col"` / `scope="row"`. 누락 시 WARN이다.
- **퀴즈는 키보드만으로 완주할 수 있어야 한다.** 라디오/체크박스 기반이며
  숫자 키 1~5로 선택, Enter로 제출, 순서 배열은 ▲▼ 버튼으로 이동한다.
  채점 결과는 `aria-live`로 안내된다. 이 동작은 `quiz.js`가 보장하므로
  **콘텐츠 쪽에서 퀴즈 UI를 흉내 내지 않는다.**
- **차트에는 표 대체본이 필수다.**
  `<canvas>`는 스크린 리더에 아무것도 전달하지 못하고, 흑백 인쇄에서 뭉개지며,
  JS가 꺼지면 아무것도 남지 않는다. `charts.js`가 `.chart__table`을 자동 생성하지만,
  **자동 생성이 의미를 담지 못하는 차트는 차트 에이전트가 `a11yTable`을 직접 준다.**
  콘텐츠 에이전트는 `<figcaption>`에 **차트가 말하려는 결론을 문장으로** 적는다.
  캡션이 "S3 비용 비교"처럼 제목만 반복하면 대체본 역할을 하지 못한다.
- **다이어그램**은 SVG에 `role="img"` + `<title>` + `<desc>` + `aria-labelledby`가 필수다
  (시각화 에이전트 책임, 누락 시 ERROR). 콘텐츠 쪽은 `<figcaption>`을 채운다.
- **최소 지원 폭 360px.** 확인 항목:
  - 표는 전부 `.table-scroll` 안에 있는가
  - 코드 블록의 한 줄이 지나치게 길지 않은가 (긴 CLI는 `\`로 줄바꿈)
  - `.diff`는 세로로 쌓이므로 좌우 대응이 문장으로도 읽히는가
  - **본문(`<body>`)이 가로로 스크롤되지 않는가** — 가로 스크롤은 표·코드·다이어그램
    **자기 컨테이너 안에서만** 발생해야 한다
- 이미지에는 `alt`가 필수다(누락 시 ERROR). 단 이 사이트는 비트맵 이미지를 쓰지 않는다.
  장식용이라면 `alt=""`.

---

## §6 금지 사항

### 사실 관련

- **구식 사실을 현행으로 서술** — §1-3 표의 8개 항목. S3 최종 일관성, EC2-Classic 사용 가능,
  ACL 기반 S3 접근 제어를 기본 구성처럼 쓰는 것 등. **검증기가 ERROR로 잡는다.**
- **확인하지 못한 수치를 쓰는 것.** "약", "대략", "일반적으로 N 정도"로 얼버무리는 것 포함.
  요금(달러 단위)은 전면 금지다.
- **비공개 시험 정보를 단정** — 실제 출제 빈도, 특정 서비스의 문항 수,
  SAA-C03 은퇴 예정일(미발표), "정답률 72%면 합격".
- **SAA-C04를 언급하는 것.** 부정하기 위한 언급도 하지 않는다.
- **SAA-C03에 없는 문항 유형이 출제된다고 쓰는 것.** `matching`/`ordering`은
  기본개념 확인문제 전용이며 `.badge--study`를 반드시 붙인다.
  `exam:"SAA"` 세트에 섞이면 **ERROR**다.

### 저작권·NDA

- **덤프 문제 복제.** 문항의 구조·시나리오·선택지 배열을 베끼는 것도 복제다.
- **덤프 사이트 이름을 문서에 쓰는 것** (§1-4의 8개). 문자열 자체가 **ERROR**다.

### 기술

- **외부 CDN·폰트·스크립트·이미지 참조** — **ERROR**. 오프라인에서 열려야 한다.
- **인라인 `<style>` / `<script>`** — **ERROR**.
- **`style=` 속성** — 검증기는 WARN이지만 **이 계약에서는 금지**다.
- **`<canvas>`나 `.chart__table`을 직접 작성** — `charts.js`의 생성 경로와 충돌한다.
- **`<svg>`를 `figure.diagram` 안에 직접 작성** — 시각화 에이전트 소유 영역이다.

### 협업

- **다른 에이전트 소유 파일 수정** — `PLAN.md` §5의 소유권 표를 따른다.
  콘텐츠 에이전트는 `assets/**`, `tools/**`, `docs/**`를 **읽기만** 한다.
- **`data/toc.json` · `data/search-index.json` 직접 수정** — `tools/build-index.mjs`가
  생성한다. Wave 4 전용이다. 손으로 고치면 다음 빌드에 덮어써진다.
- **`assets/diagrams/index.json` 직접 수정** — 같은 이유로 금지.
- **사이드바 HTML 하드코딩** — `#sidebar-mount`만 두고 비운다.
- **상단바·우측 목차·복사 버튼·이전/다음 링크를 직접 작성** — 전부 `app.js`가 주입한다.

### 표기

- **이모지 사용 금지.** 본문·표·`<figcaption>`·`data-label`·**섹션 헤더 전부**다.
  - `PLAN.md`와 `docs/FACT_SOURCES.md`에 ✅ ⚠️ 🚫 같은 기호가 쓰여 있지만,
    **그것은 계획 문서의 가독성을 위한 것이고 사이트 페이지에는 넣지 않는다.**
  - 가능/불가 표시는 `.mark-ok` / `.mark-no` + **텍스트**로 한다.
  - `.diff`의 `✕ Before` / `✓ After`는 CSS가 넣는 것이므로 예외다.
- **시험 범위 밖 서비스를 학습 대상처럼 서술** — §1-5. 언급이 필요하면
  `data-label="시험 범위 아님"` 노트 안에서만.
- 느낌표, 물결표(`~`) 강조, 여러 개의 물음표를 쓰지 않는다.

---

## 부록 · 검증기 대조표

`tools/validate.mjs`가 **실제로 강제하는 것**과 **이 문서가 계약으로만 요구하는 것**을 구분한다.
계약으로만 요구하는 항목은 자동으로 잡히지 않으므로 **Wave 3 검증 에이전트가 사람 눈으로 본다.**

| 규칙 | 검증기 | 비고 |
|---|:--:|---|
| 외부 CDN·폰트·스크립트·이미지·iframe·`@import`·`url(//…)` | **ERROR** | |
| 덤프 사이트 이름 8종 (HTML 본문 · `refs` URL) | **ERROR** | 부분 문자열 일치. 경고 문장에 써도 걸린다 |
| 인라인 `<style>` / `src` 없는 `<script>` | **ERROR** | |
| `<img>` `alt` 누락 | **ERROR** | |
| S3를 최종 일관성으로 서술 | **ERROR** | 변경을 설명하는 문맥은 통과 |
| EC2-Classic을 사용 가능한 것처럼 서술 | **ERROR** | 〃 |
| 링크 대상 파일 없음 | **ERROR** | `data/toc.json` 등록 경로는 WARN → `--strict`에서 ERROR |
| `data-diagram` / `data-chart` 형식 오류 | **ERROR** | `D-###` / `C-###` |
| 카탈로그에 없는 다이어그램 ID | **ERROR** | 카탈로그 파일이 있을 때만 |
| 등록되지 않은 차트 ID 참조 | WARN | `--strict`에서 ERROR. 다이어그램의 미존재 SVG와 같은 유예 |
| `figure.chart` 안의 `<canvas>` | **ERROR** | |
| `style=` 속성 | WARN | **계약상 금지** |
| `<h2>`/`<h3>` `id` 누락 | WARN | **계약상 필수** — 런타임 생성 id로는 앵커 링크를 걸 수 없다 |
| `<th scope>` 누락 | WARN | **계약상 필수** |
| `<html lang="ko">` 누락 | WARN | **계약상 필수** |
| `tokens.css` / `main.css` 미로드 | WARN | `code.css`·`viz.css`·`chart.css`는 **검사하지 않는다** — 계약으로만 강제 |
| `figure.diagram` / `figure.chart`의 `<figcaption>` 누락 | WARN | **계약상 필수** |
| 개명된 서비스의 옛 이름 단독 사용 | WARN | AWS SSO · Elasticsearch Service · SMS |
| 같은 페이지/외부 페이지 앵커 없음 | WARN | |
| 참조한 다이어그램 SVG 없음 / 고아 SVG | WARN | `--strict`에서 ERROR |
| 미치환 다이어그램 플레이스홀더 | — | `--deploy`에서만 ERROR (Wave 4) |
| `.table-scroll` 래퍼 | **검사 안 함** | 계약상 **모든 표 필수** |
| 페이지당 내부 링크 3개 이상 | **검사 안 함** | 계약. Wave 3이 센다 |
| SAA-C04 언급 0건 | **검사 안 함** | 계약. Wave 3이 전수 검사 |
| 이모지 0건 | **검사 안 함** | 계약. Wave 3이 전수 검사 |
| 확인 안 된 수치 · 요금 서술 | **검사 안 함** | 계약. Wave 3 C1이 1차 소스와 대조 |
| 시험 범위 밖 서비스를 학습 대상처럼 서술 | **검사 안 함** | 계약. Wave 3 C1 |
| 문단 3~5문장 · 톤 | **검사 안 함** | 계약. Wave 3 C4 |
| `refs[].url`이 AWS 공식 호스트 | **ERROR** | 문제 JSON 한정 |
| `exam:"SAA"` 세트의 `matching`/`ordering` | **ERROR** | 문제 JSON 한정 |
| 문항별 `domain`이 공식 4개 문자열과 일치 | **ERROR** | 혼합 세트(모의고사·진단) 한정 |

> **알려진 검증기 결함 — 지금은 무시한다.**
> `tools/validate.mjs`는 10문항 이상인 세트에 `matching`/`ordering`이 하나도 없으면
> `"실제 시험에 출제됩니다"`라는 문구로 **WARN**을 낸다. 이 문구는 sibling 프로젝트에서
> 넘어온 잔재이며 **SAA-C03에는 해당하지 않는다.** 같은 파일이 `exam:"SAA"` 세트에
> 이 두 유형이 들어가면 ERROR를 내므로 서로 모순된다.
> **SAA 세트에서 이 WARN이 나오는 것은 정상이다. 이 경고를 없애려고 `matching`/`ordering`을
> 넣지 않는다.** 검증기 수정은 Wave 0 소유이므로 발견 사항으로만 리포트에 올린다.
