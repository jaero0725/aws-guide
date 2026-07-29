# AWS SAA Guide — 전체 구축 계획

> 최종 산출물: **빌드 없이 브라우저에서 바로 열리는 정적 HTML 학습 사이트**
> (AWS 기본개념 18장 + 실습 예제 + 아키텍처 케이스 + 치트시트 + SAA 시험 대비 + 인터랙티브 문제풀이 + 데이터 시각화)
>
> 배포: **Vercel** (정적, `outputDirectory: "."`). 진입점은 루트 `index.html`.

---

## 최우선 목표: AWS Certified Solutions Architect – Associate 합격

이 프로젝트의 **1순위 목표는 SAA-C03 합격**이다. 나머지는 이 목표에 종속된다.
자원 배분·품질 기준·검증 강도를 모두 여기에 맞춘다.

동시에 2순위 목표가 있다: **AWS 전반 지식 습득**. 시험만 통과하고 실무에서 못 쓰는
사이트는 만들지 않는다. 기본개념 18장이 이 목표를 담당한다.

| 우선순위 | 대상 | 배분 원칙 |
|:--:|---|---|
| **1** | **SAA 시험 대비** | 문항 78%, 도메인 페이지, 한정어 키워드 사전, 진단·플래시카드·벼락치기 |
| **2** | 기본개념 18장 | SAA 도메인이 요구하는 깊이 + 실무 맥락. ch02·ch03·ch08·ch10·ch16 최우선 |
| 3 | 실습 예제 · 아키텍처 케이스 | 시나리오 문항의 배경 지식 제공 |
| 4 | 치트시트 | 시험 직전 복습용 |

---

## 0. 기준 정보 (2026-07-29 조사 결과)

계획의 전제가 되는 사실 확인 내용. **모든 콘텐츠는 이 기준을 따른다.**

### 시험 기준

| 항목 | 값 | 확인 |
|---|---|:--:|
| 시험 코드 | **SAA-C03** | ✅ |
| SAA-C04 존재 여부 | **존재하지 않는다** (아래 경고 참조) | ✅ |
| 문항 수 | **65문항** = 채점 50 + 비채점 15 | ✅ |
| 시간 | **130분** | ✅ |
| 합격 점수 | **720점** / 100–1000 스케일 | ✅ |
| 채점 방식 | **보상형(compensatory)** — 도메인별 과락 없음, 총점만 본다 | ✅ |
| 응시료 | **USD 150** (원화는 결제 시점 환율) | ✅ |
| 유효 기간 | **3년** | ✅ |
| 응시 방식 | Pearson VUE 시험장 또는 온라인 프록터링 | ✅ |
| 언어 | 한국어 포함 12개 | ✅ |
| 문항 유형 | **객관식(단일 정답) · 복수 응답** — **2가지뿐** | ✅ |
| 오답 감점 | **없음** — 반드시 찍는다 | ✅ |
| 권장 경험 | AWS 설계 실무 **1년 이상**. 선행 자격증 요구 없음 | ✅ |
| SAA-C03 시작일 | 2022-08-30 | ✅ |
| 은퇴 예정일 | **미발표** | ✅ |

> ⚠️ **"SAA-C04가 2024년에 나왔다"는 서술은 거짓이다.**
> 검색 엔진과 AI 요약이 이 주장을 반복하지만, 출처를 추적하면 AI 생성 콘텐츠 팜 한 곳으로 수렴한다.
> AWS 공식 문서 경로는 2026년 현재도 `solutions-architect-associate-03` 이며,
> 2026년 월별 신규 자격증 발표 어디에도 SAA 개정이 없다.
> **이 사이트에 SAA-C04를 언급하지 않는다.**

> ⚠️ **문항 유형 주의.** AWS는 2024년부터 신규 자격증(AIF-C01, MLA-C01 등)에
> 순서 배열·연결형·사례 연구 유형을 도입했다. **그러나 SAA-C03에는 도입되지 않았다.**
> 사이트에 "시험에 연결형이 나온다"고 쓰지 않는다. 자세한 취급은 §3-2 참조.

### 도메인 가중치 — 자원 배분의 근거

| # | 도메인 (공식 명칭) | 가중치 | 과제 진술 | 담당 챕터 |
|:--:|---|:--:|:--:|---|
| 1 | **Design Secure Architectures** (보안 아키텍처 설계) | **30%** | 3개 | ch02, ch03, ch16 |
| 2 | **Design Resilient Architectures** (복원력 있는 아키텍처 설계) | **26%** | 2개 | ch07, ch10, ch12, ch18 |
| 3 | **Design High-Performing Architectures** (고성능 아키텍처 설계) | **24%** | 5개 | ch05, ch08, ch11, ch14, ch15 |
| 4 | **Design Cost-Optimized Architectures** (비용 최적화 아키텍처 설계) | **20%** | 4개 | ch05, ch08, ch18 |

**도메인 1이 30%로 가장 크고 과제 진술은 3개뿐이다.**
→ IAM · 암호화(KMS) · VPC 수준 접근 제어가 **문항 밀도가 가장 높은 주제**다. 여기에 가장 많은 자원을 넣는다.

**도메인 2는 과제 진술이 2개인데 26%다.** → 각 진술이 매우 촘촘하게 출제된다.
(2.1 확장 가능·느슨한 결합 / 2.2 고가용성·내결함성)

### 과제 진술 전체 (14개)

| 도메인 | 과제 진술 |
|---|---|
| 1 (30%) | 1.1 AWS 리소스에 대한 보안 액세스 설계 · 1.2 보안 워크로드·애플리케이션 설계 · 1.3 적절한 데이터 보안 제어 결정 |
| 2 (26%) | 2.1 확장 가능하고 느슨하게 결합된 아키텍처 설계 · 2.2 고가용성·내결함성 아키텍처 설계 |
| 3 (24%) | 3.1 고성능·확장 가능 스토리지 · 3.2 고성능·탄력적 컴퓨팅 · 3.3 고성능 데이터베이스 · 3.4 고성능·확장 가능 네트워크 · 3.5 고성능 데이터 수집·변환 |
| 4 (20%) | 4.1 비용 최적화 스토리지 · 4.2 비용 최적화 컴퓨팅 · 4.3 비용 최적화 데이터베이스 · 4.4 비용 최적화 네트워크 |

### Well-Architected Framework 6개 기둥

| # | 영문 | 한국어 (사이트 표준) |
|:--:|---|---|
| 1 | Operational Excellence | 운영 우수성 |
| 2 | Security | 보안 |
| 3 | Reliability | **안정성** (Reliability, 신뢰성으로도 번역됨) |
| 4 | Performance Efficiency | 성능 효율성 |
| 5 | Cost Optimization | 비용 최적화 |
| 6 | Sustainability | 지속 가능성 |

> AWS 한국어 문서가 Reliability를 "안정성"과 "신뢰성"으로 혼용한다.
> **사이트 표준은 "안정성"**이며, 첫 등장 시 `안정성(Reliability, 신뢰성으로도 번역됨)`로 병기한다.
> SAA 4개 도메인은 기둥 2~5에 대응한다. 운영 우수성·지속 가능성은 개념 이해용으로만 다룬다.

### 콘텐츠 출처 정책

- ✅ 허용 근거: `docs.aws.amazon.com`, `aws.amazon.com` 공식 페이지·블로그, AWS 백서,
  botocore/CloudFormation 스펙 등 **AWS가 배포하는 기계 판독 가능 1차 소스**
- ❌ **금지: 시험 덤프 사이트** (examtopics, validexamdumps, pass4success, skillcertpro,
  itexams, examcollection, certlibrary, briefmenow 등) — **참조 자체를 금지**한다.
  저작권 및 자격증 NDA 위반. 모든 문제는 **공식 문서 기반으로 새로 창작**한다.
  "출제 경향 파악"에도 참조하지 않는다. 도메인 블루프린트와 과제 진술만 참고한다.
- ⚠️ **이 환경에서는 AWS 문서 웹사이트가 네트워크 정책으로 차단되어 있다.**
  사실 확인 경로는 **`docs/FACT_SOURCES.md`** 에 정리한다. 모든 에이전트의 필독 문서다.
  **차단되었다고 해서 사실 확인을 생략하지 않는다. 확인 못 한 수치는 쓰지 않는다.**

### 최신성 정책 — 이 사이트의 차별점

시중 한국어 SAA 자료 상당수가 2020~2022년 기준이라 **기본 동작이 바뀐 항목에서 그대로 오답**을 낸다.
아래는 반드시 현행 기준으로 서술하고, 바뀐 사실 자체를 가르친다. (`tools/validate.mjs`가 강제한다)

| 항목 | 현행 | 시점 |
|---|---|---|
| S3 일관성 | **강력한 읽기 후 쓰기 일관성** | 2020-12 |
| S3 신규 버킷 | 퍼블릭 액세스 차단 **ON**, ACL **비활성**, 객체 소유권 = 버킷 소유자 | 2023-04 |
| S3 기본 암호화 | 모든 신규 객체 **SSE-S3 자동 적용** | 2023-01 |
| EC2 메타데이터 | 계정 수준 **IMDSv2 기본값** 설정 가능, 신규 인스턴스 타입은 IMDSv2 전용 | 2024 |
| EC2-Classic | **종료됨** | 2022-08 |
| AWS SSO | **AWS IAM Identity Center** 로 개명 | 2022 |
| Amazon Elasticsearch Service | **Amazon OpenSearch Service** 로 개명 | 2021 |
| SysOps Administrator – Associate | **CloudOps Engineer – Associate (SOA-C03)** 로 개명 | 2025-09 |

> 시험 범위 밖이지만 학습자가 접하게 되는 신규 서비스(Aurora DSQL, S3 Tables, S3 Vectors 등)는
> **"시험 범위 아님"을 명시**하고 인지 수준으로만 다룬다.

### 시험 범위 밖 서비스 — 가르치지 않는다

AWS가 명시적으로 out-of-scope로 지정한 영역. **학습자의 시간을 아끼는 것도 콘텐츠다.**

- **개발자 도구 전체**: CodeBuild, CodeDeploy, CodePipeline, CodeCommit, CodeArtifact,
  CodeGuru, CodeStar, Cloud9, CloudShell, **AWS CDK**, Fault Injection Simulator
- **비즈니스 앱**: Chime, Connect, WorkDocs, WorkMail, WorkSpaces, AppStream 2.0
- **기타**: SWF, CloudSearch, Managed Service for Apache Flink, GameLift, IoT 제품군, Mainframe Modernization

> ⚠️ **CloudFormation은 범위 안, CDK는 범위 밖**이다. 학습자가 가장 많이 혼동하는 지점이므로
> ch17과 시험 팁 페이지에서 명시적으로 다룬다.

---

## 1. 사이트 구조

```
aws-guide/
├── index.html                     # 홈 (학습 경로 · 진도 대시보드 · 차트)
├── assets/
│   ├── css/
│   │   ├── tokens.css             # 디자인 토큰 (색/타이포/간격/다크모드)
│   │   ├── main.css               # 레이아웃 · 컴포넌트
│   │   ├── viz.css                # 다이어그램 토큰 (--dg-*) · 인터랙티브 컨트롤
│   │   ├── chart.css              # ★ 차트 프레임 · 범례 · 반응형
│   │   └── code.css               # 코드 하이라이팅 테마
│   ├── js/
│   │   ├── boot.js                # 첫 페인트 전 테마 적용
│   │   ├── app.js                 # 사이드바 · 검색 · 다크모드 · 목차 · 다이어그램 주입
│   │   ├── quiz.js                # 문제풀이 엔진
│   │   ├── progress.js            # localStorage 진도/오답노트
│   │   ├── viz.js                 # 인터랙티브 SVG 다이어그램 프리미티브
│   │   ├── charts.js              # ★ Chart.js 래퍼 (테마 연동 · 레지스트리)
│   │   ├── flashcard.js           # 플래시카드 (간격 반복)
│   │   ├── highlight.js           # 경량 신택스 하이라이터
│   │   └── home.js                # 홈 대시보드
│   ├── vendor/                    # ★ 로컬 벤더링 (CDN 금지 · 오프라인 동작)
│   │   ├── chart.umd.min.js       #   Chart.js 4.5.1 (MIT)
│   │   └── panzoom.min.js         #   @panzoom/panzoom 4.6.2 (MIT)
│   └── diagrams/                  # 다이어그램 SVG (시각화 에이전트 소유)
│       └── D-001-*.svg ~ D-2xx-*.svg
│
├── basics/          ch01.html ~ ch18.html         # AWS 기본개념 18장
├── labs/            lab01.html ~ lab12.html       # 실습 예제
├── cases/           case01.html ~ case10.html     # 아키텍처 케이스 스터디
├── cheatsheet/      services.html, compare.html, limits.html,
│                    decision-tree.html, security.html,
│                    network.html, cost.html
├── saa/             index.html                    # 시험 개요 · 도메인 · 8주 플랜
│                    domain-secure.html            #   30%
│                    domain-resilient.html         #   26%
│                    domain-performance.html       #   24%
│                    domain-cost.html              #   20%
│                    keywords.html                 # ★ 한정어 키워드 사전
│                    traps.html                    # ★ 함정 사전 (헷갈리는 쌍)
│                    flashcards.html               # ★ 암기 카드
│                    cram.html                     # ★ 벼락치기 단일 페이지
│                    exam-tips.html                # 시험 당일 전략
├── quiz/            index.html                    # 문제풀이 허브
│                    diagnostic.html               # ★ 40문항 취약점 진단
│                    review.html                   # 오답노트
│                    result.html                   # 결과 리포트 (차트)
│
├── data/
│   ├── toc.json                   # 전체 목차 (자동 생성)
│   ├── search-index.json          # 검색 인덱스 (자동 생성)
│   ├── charts/                    # ★ 차트 데이터셋 JSON
│   ├── questions/
│   │   ├── manifest.json
│   │   ├── saa-{domain}.json      # 도메인별 연습
│   │   ├── saa-mock-{1..4}.json   # 모의고사
│   │   ├── saa-diagnostic.json    # 진단
│   │   └── basics-ch{NN}.json     # 챕터별 확인문제
│   └── flashcards/
│
├── tools/
│   ├── build-index.mjs            # 검색 인덱스 · TOC 생성
│   ├── inline-diagrams.mjs        # 플레이스홀더 → SVG 정적 치환 (배포 필수)
│   └── validate.mjs               # 링크/스키마/다이어그램/차트/최신성 검증
│
└── docs/
    ├── CONTENT_STYLE_GUIDE.md     # 모든 에이전트 공통 규칙 (계약서)
    ├── FACT_SOURCES.md            # ★ 사실 확인 경로 (AWS 문서 차단 대응)
    ├── SERVICE_CURRENCY.md        # 최신성 정책 · 바뀐 기본값 목록
    ├── DIAGRAM_CATALOG.md         # 다이어그램 카탈로그 + 작성 규칙
    ├── CHART_CATALOG.md           # ★ 차트 카탈로그 + Chart.js 사용 규약
    ├── QUESTION_SCHEMA.md         # 문제 JSON 스키마
    ├── SAA_TOPIC_CHECKLIST.md     # 필수 출제 토픽 + 태그 규약
    ├── WAVE0_CONTRACT.md          # Wave 0 이 만든 기반의 실제 API·클래스·규약
    └── agent-prompts/             # 멀티에이전트 프롬프트
```

### 기술 선택과 근거

| 결정 | 선택 | 근거 |
|---|---|---|
| 프레임워크 | **없음 (Vanilla HTML/CSS/JS)** | 빌드 없이 `file://`로도 열림. 에이전트 병렬 작업 시 의존성 충돌 0 |
| 외부 CDN | **전면 금지** | 오프라인 학습 가능 + CSP 호환 + 수명. 라이브러리는 `assets/vendor/`에 동봉 |
| 차트 | **Chart.js 4.5.1 (로컬 벤더링)** | 요구사항이 "라이브러리를 쓴 화려한 시각화". CDN 없이 만족시키는 유일한 방법 |
| 다이어그램 | **직접 작성 인라인 SVG** | 아키텍처 다이어그램은 차트 라이브러리로 못 그린다. 다크모드에서 토큰으로 자동 대응 |
| 콘텐츠 저장 | HTML(본문) + **JSON(문제·차트 데이터)** | 데이터 분리해야 엔진이 데이터 주도로 동작하고 에이전트가 충돌 없이 병렬 생성 |
| 상태 저장 | `localStorage` (`ag:` 접두사) | 서버 없음. 진도·오답·시험 기록 |
| 배포 | **Vercel** (`outputDirectory: "."`) | 사용자가 직접 배포. 루트 `index.html`이 진입점 |

### 시각화 이원화 — 왜 두 갈래인가

요구사항 3번("모든 내용은 시각화 도식화를 제대로")을 만족시키려면 **성격이 다른 두 종류**가 필요하다.
하나의 도구로 둘 다 하려 하면 양쪽 다 나빠진다.

| | 다이어그램 (SVG) | 차트 (Chart.js) |
|---|---|---|
| 대상 | **구조·흐름·관계** | **수치 비교·분포·추이** |
| 예 | VPC 서브넷 구조, IAM 정책 평가 순서, DR 전략 전환 흐름, ALB 라우팅 경로 | 스토리지 클래스 비용, EBS 볼륨 IOPS 비교, DR 전략 RTO/RPO 산점도, 도메인 가중치, 진도 대시보드 |
| 산출물 | `assets/diagrams/D-###-*.svg` | `assets/js/charts.js` 레지스트리 + `data/charts/*.json` |
| 소유 | 시각화 에이전트 (V) | 차트 에이전트 (G) |
| HTML 훅 | `<figure class="diagram" data-diagram="D-030">` | `<figure class="chart" data-chart="C-012">` |

두 훅 모두 **콘텐츠 에이전트는 플레이스홀더만 쓴다.** 실제 산출물은 다른 에이전트가 만든다.
이것이 Wave 1의 다중 병렬 실행을 충돌 없이 가능하게 하는 근거다.

---

## 2. 콘텐츠 설계

### 2-1. 기본개념 18장

전반적 AWS 지식(요구사항 2번)과 시험 도메인을 동시에 만족시키는 커리큘럼이다.

| 장 | 제목 | 핵심 내용 | 주 도메인 |
|:--:|---|---|:--:|
| 1 | AWS 글로벌 인프라와 계정 기초 | 리전·AZ·로컬 존·엣지 로케이션, 책임 공유 모델, Well-Architected 6기둥, 요금 모델 개요, 지원 플랜 | 전 도메인 |
| 2 | IAM과 자격 증명 | 사용자·그룹·역할·정책 문서 구조, **정책 평가 로직**, STS, IAM Identity Center, 권한 경계, SCP, 리소스 기반 정책 | **1 (30%)** |
| 3 | VPC 네트워킹 기초 | CIDR 설계, 서브넷, 라우팅 테이블, IGW·NAT, **SG vs NACL**, VPC Flow Logs, DHCP 옵션 | **1 (30%)** |
| 4 | VPC 연결과 하이브리드 | Peering, Transit Gateway, **VPC 엔드포인트·PrivateLink**, Site-to-Site VPN, Direct Connect, Outposts | 1, 3 |
| 5 | EC2와 컴퓨트 | 인스턴스 패밀리, **구매 옵션 5종**, AMI, 배치 그룹, 사용자 데이터, **IMDSv2**, 전용 호스트·인스턴스 | 3, 4 |
| 6 | EBS·인스턴스 스토어 | 볼륨 타입별 성능 한계, 스냅샷·AMI 관계, 암호화, 멀티 어태치, 인스턴스 스토어의 휘발성 | 3, 4 |
| 7 | 로드 밸런싱과 오토스케일링 | **ALB·NLB·GWLB 선택 기준**, 타깃 그룹, 헬스체크, 고정 세션, ASG 스케일링 정책, 수명주기 훅, 워밍업 | **2 (26%)** |
| 8 | S3와 오브젝트 스토리지 | **일관성 모델**, 스토리지 클래스 전체, 수명주기, 버저닝, 복제(CRR/SRR), 암호화 4종, 버킷 정책 vs ACL, 프리사인 URL, Object Lock, 정적 호스팅 | 1, 3, 4 |
| 9 | 파일 스토리지와 데이터 전송 | EFS, FSx 4종, Storage Gateway 3종, DataSync, Transfer Family, Snow Family | 3, 4 |
| 10 | RDS와 관계형 데이터베이스 | 엔진, **Multi-AZ vs 읽기 전용 복제본**, Aurora(복제본·글로벌·Serverless v2), 백업·PITR, RDS Proxy, 암호화 | **2 (26%)**, 3 |
| 11 | NoSQL·캐시·분석 DB | DynamoDB(용량 모드·**LSI vs GSI**·스트림·DAX·글로벌 테이블·TTL), ElastiCache(Redis vs Memcached), Redshift, DocumentDB·Neptune·Keyspaces·Timestream | 3, 4 |
| 12 | 서버리스와 애플리케이션 통합 | Lambda(한도·동시성·VPC), API Gateway, Step Functions, EventBridge, **SQS 표준 vs FIFO**, SNS, AppSync, Amazon MQ | **2 (26%)** |
| 13 | 컨테이너 | ECS(EC2 vs Fargate), EKS, ECR, 태스크 역할 vs 실행 역할, 서비스 오토스케일링 | 2, 3 |
| 14 | 엣지와 DNS | CloudFront(오리진·캐시·서명 URL·OAC), **Route 53 라우팅 정책 전체**, 상태 확인, Global Accelerator, WAF·Shield 연계 | 1, 3 |
| 15 | 데이터 분석 파이프라인 | Kinesis 제품군, MSK, Glue, Athena, EMR, Lake Formation, OpenSearch, QuickSight, **배치 vs 스트리밍 선택** | 3 |
| 16 | 보안·암호화·거버넌스 | KMS(키 종류·정책·교체), CloudHSM, ACM, **Secrets Manager vs Parameter Store**, GuardDuty·Inspector·Macie·Security Hub, Cognito, Directory Service, Network Firewall | **1 (30%)** |
| 17 | 모니터링·운영·계정 관리 | CloudWatch(지표·로그·알람·구독 필터), CloudTrail, Config, Systems Manager, Organizations, Control Tower, Trusted Advisor, **CloudFormation(CDK는 범위 밖)** | 1, 2 |
| 18 | 비용 최적화·마이그레이션·재해 복구 | Cost Explorer·Budgets·CUR, Savings Plans vs RI 전략, **데이터 전송 요금**, **DR 4전략과 RTO/RPO**, 6R 마이그레이션, DMS·MGN | **4 (20%)**, 2 |

**챕터 페이지 공통 구조**
1. 학습 목표 (4~6개, "~할 수 있습니다" 형태)
2. 본문 (개념 → 다이어그램/차트 → 설정·코드 → 동작 원리)
3. 관련 서비스·설정 표
4. 흔한 오해 (정확히 3개)
5. 시험 포인트 정리 (암기표 + 함정 열)
6. 확인 문제 10문항 (인라인 퀴즈 위젯)
7. 이어서 볼 곳 (내부 교차 링크 3개 이상)
8. 공식 문서 출처

### 2-2. 실습 예제 (12개)

동작하는 구성으로 배운다. 콘솔 클릭 나열이 아니라 **CLI/CloudFormation 기준**으로 쓴다.

| # | 주제 | 핵심 |
|:--:|---|---|
| 1 | 3계층 VPC 직접 구성 | 퍼블릭/프라이빗 서브넷, NAT, 라우팅 |
| 2 | ALB + ASG 웹 티어 | 헬스체크, 다중 AZ, 스케일링 정책 |
| 3 | S3 정적 사이트 + CloudFront + OAC | 버킷 비공개 유지, 캐시 무효화 |
| 4 | RDS Multi-AZ 와 읽기 전용 복제본 | 장애 조치 관찰, 엔드포인트 차이 |
| 5 | DynamoDB 설계 실습 | 파티션 키 설계, GSI, 온디맨드 vs 프로비저닝 |
| 6 | Lambda + API Gateway REST API | 권한, 동시성, 콜드 스타트 |
| 7 | SQS + Lambda 비동기 처리 | DLQ, 가시성 타임아웃, 배치 |
| 8 | EventBridge 이벤트 기반 아키텍처 | 규칙, 대상, 스키마 |
| 9 | ECS Fargate 서비스 배포 | 태스크 정의, 역할 분리, 서비스 오토스케일링 |
| 10 | VPC 엔드포인트로 S3 비공개 접근 | 게이트웨이 vs 인터페이스 엔드포인트 |
| 11 | KMS 고객 관리형 키로 암호화 | 키 정책, 봉투 암호화, 교체 |
| 12 | CloudWatch 알람 + SNS 알림 파이프라인 | 지표 필터, 복합 알람 |

**공통 구조**: 시나리오 → 아키텍처 다이어그램 → 구성(CLI/CFN) → 검증 방법 → 비용 고려 → 프로덕션 고려사항 → 정리(삭제) → 자주 하는 실수

### 2-3. 아키텍처 케이스 스터디 (10개)

시험 시나리오 문항과 같은 형태의 **설계 판단** 훈련. 실수 케이스와 설계 케이스를 섞는다.

| # | 케이스 | 핵심 판단 |
|:--:|---|---|
| 1 | EC2에 액세스 키를 심어 배포했다 | IAM 역할로 전환. 자격 증명 유출 사고의 전형 |
| 2 | 읽기 부하로 DB가 죽었다 | 읽기 전용 복제본 vs Multi-AZ vs ElastiCache 판단 |
| 3 | S3 비용이 매달 늘어난다 | 스토리지 클래스·수명주기·불완전 멀티파트 업로드 |
| 4 | 퍼블릭 서브넷에 DB를 뒀다 | 서브넷 설계, SG·NACL, 프라이빗 연결 |
| 5 | 단일 AZ 설계가 장애로 전면 중단됐다 | 다중 AZ, ASG, 상태 비저장 설계 |
| 6 | 데이터 전송 요금이 예산을 넘겼다 | NAT 게이트웨이·리전 간·CloudFront 요금 구조 |
| 7 | 트래픽 급증에 스케일아웃이 못 따라갔다 | 스케일링 정책, 워밍업, 예약 스케일링, SQS 완충 |
| 8 | 리전 장애에 대비한 DR을 설계하라 | 백업·복원 / 파일럿 라이트 / 웜 스탠바이 / 액티브-액티브 |
| 9 | 온프레미스 파일 서버를 클라우드로 | Storage Gateway vs FSx vs DataSync 판단 |
| 10 | 규정 준수 감사에 대응하라 | CloudTrail, Config, Object Lock, KMS, 데이터 레지던시 |

**공통 구조**: 상황 → 요구사항·제약 → 후보 설계안 비교 → 선택과 근거 → 다이어그램 → 비용·운영 영향 → 예방/설계 체크리스트 → 관련 시험 포인트

### 2-4. 치트시트 (7종)

| 파일 | 내용 |
|---|---|
| `services.html` | 시험 범위 서비스 전체 — 한 줄 정의 + 언제 고르는가. **범위 밖 목록 포함** |
| `compare.html` | 헷갈리는 쌍 비교표 — Multi-AZ vs 읽기 복제본, SG vs NACL, ALB vs NLB, LSI vs GSI, Secrets Manager vs Parameter Store, 게이트웨이 vs 인터페이스 엔드포인트 … |
| `limits.html` | 반드시 외울 한도·기본값 — Lambda 15분, SQS 메시지 256KB, S3 객체 5TB 등 (**확인된 값만**) |
| `decision-tree.html` | 요구사항 → 서비스 선택 의사결정 트리 (플로우차트 SVG) |
| `security.html` | IAM 정책 패턴, KMS, 암호화 옵션 매트릭스 |
| `network.html` | VPC 연결 옵션 매트릭스, 라우팅, DNS |
| `cost.html` | 요금 모델 요약, 데이터 전송 요금 지도, 비용 절감 레버 |

### 2-5. 시험 대비 (`saa/`)

- `index.html` — 시험 개요(§0 표), 도메인 가중치 **도넛 차트**, **8주 학습 플랜**, 도메인↔챕터 매핑표
- `domain-*.html` (4개) — 도메인별 과제 진술 해설 + 출제 포인트 + 함정 + 도메인 미니 퀴즈
- **`keywords.html`** — **한정어 키워드 사전**. 이 사이트의 핵심 산출물 중 하나(§2-6)
- `traps.html` — 헷갈리는 개념 쌍 비교표 + 오답 유도 패턴 분석
- `flashcards.html` — 서비스↔용도, 한도↔값 암기 카드 (간격 반복, 3회 연속 정답 시 졸업)
- `cram.html` — 시험 D-1용 단일 페이지 전체 요약. 인쇄 가능
- `exam-tips.html` — 시험 당일 전략, 시간 배분(65문항/130분 = 2분), 찍기 전략, 소거법

### 2-6. 한정어 키워드 사전 — 합격률을 실제로 올리는 장치

SAA 문항의 정의적 특성: **정답과 오답을 고르는 게 아니라, 여러 개의 맞는 답 중
한정어에 가장 부합하는 것을 고른다.** 서비스를 따로따로 공부한 사람이 떨어지는 이유다.

| 한정어 | 신호 | 선호되는 선택지 |
|---|---|---|
| MOST cost-effective | 비용이 결정 기준 | 스팟, S3 Glacier·IA, Savings Plans·RI, 서버리스, 라이트사이징 |
| LEAST operational overhead | 관리형 선호 | Lambda, Fargate, Aurora Serverless, DynamoDB, S3 |
| MOST highly available | 장애 견딤 | 다중 AZ, AZ 간 ASG, ELB, RDS Multi-AZ |
| MOST resilient / DR | RTO·RPO | 리전 간 복제, 파일럿 라이트·웜 스탠바이, 백업 |
| MOST secure | 최소 권한 | IAM 역할(액세스 키 아님), KMS, 프라이빗 서브넷, VPC 엔드포인트 |
| LOWEST latency | 속도 | CloudFront, ElastiCache, Global Accelerator, 배치 그룹, 읽기 복제본 |
| MOST scalable / decoupled | 탄력성 | SQS, SNS, EventBridge, ASG, Lambda |
| without changing application code | 리팩터링 배제 | ALB, ElastiCache, EFS, RDS Proxy |
| real-time / near-real-time | 스트리밍 | Kinesis Data Streams, MSK (Glue·배치 아님) |
| must not traverse the internet | 비공개 경로 | VPC 엔드포인트, PrivateLink, Direct Connect |
| compliance / audit | 거버넌스 | CloudTrail, Config, KMS CMK, Object Lock, 리전 고정 |
| existing infrastructure | 통합, 대체 아님 | Direct Connect, Storage Gateway, DataSync, Outposts |
| minimal downtime migration | 전환 전략 | DMS, MGN, 블루/그린 |

**오답 유도 패턴** (별도 절로 상세히 다룬다)
- 맞는 서비스, 틀린 티어 (Glacier Deep Archive가 답인데 S3 Standard)
- 과잉 설계 (비용 한정어인데 비싼 정답)
- EC2에 IAM 사용자 + 액세스 키 → 거의 항상 오답. 정답은 **IAM 역할**
- "운영 부담 최소"인데 EC2 자체 관리
- **Multi-AZ vs 읽기 전용 복제본 혼동** — 가용성 vs 읽기 확장. 시험이 집요하게 노린다
- 명시된 제약을 위반하는 선택지 → 가장 빠른 소거 대상

---

## 3. 문제풀이 엔진 설계

### 3-1. 문제은행 규모 (목표)

| 세트 | 문항 수 | 비중 |
|---|---:|---:|
| 기본개념 챕터별 확인문제 | 18장 × 10 = **180** | 22% |
| **SAA 도메인별 연습** | **340** (가중치 비례) | 41% |
| **SAA 모의고사 4세트** | 65 × 4 = **260** | 32% |
| **SAA 진단 테스트** | **40** | 5% |
| **합계** | **약 820문항** | |

**도메인별 연습 340문항 배분 (가중치 비례)**

| 도메인 | 가중치 | 문항 |
|---|:--:|---:|
| Design Secure Architectures | 30% | **102** |
| Design Resilient Architectures | 26% | **88** |
| Design High-Performing Architectures | 24% | **82** |
| Design Cost-Optimized Architectures | 20% | **68** |

> 모의고사 4세트는 도메인 연습과 **중복되지 않는 별도 문항**이며, 4세트끼리도 중복되지 않는다.
> 각 세트는 실제 시험과 같이 **65문항**이고 도메인 비율도 30/26/24/20을 따른다.
> (실제 시험의 15문항은 비채점이지만, 응시자는 구분할 수 없으므로 연습에서는 65문항 전부 채점한다.
>  이 사실을 결과 페이지에 명시한다.)

### 진단 테스트 (40문항)

4개 도메인 × 10문항. 결과에 따라 **개인별 학습 순서를 자동 생성**한다.
- 도메인 정답률 60% 미달 → "집중 학습" → 해당 챕터 + 도메인 연습 전량
- 60~80% → "보강" → 함정 사전 + 도메인 연습 절반
- 80% 이상 → "유지" → 모의고사에서만 점검

우선순위 = `가중치 × (100 − 정답률) / 100` 내림차순. 가중치가 큰 도메인(보안 30%)이 약하면 최상단.

### 3-2. 문항 유형 정책 — SAA-C03은 2가지뿐

| `type` | 대응 시험 유형 | 채점 | 사용처 |
|---|---|---|---|
| `single` | 객관식 (단일 정답) | 정답 1개 일치 | **전 세트** |
| `multiple` | 복수 응답 | 전부 일치 (부분 점수 없음) | **전 세트** |
| `matching` | — (시험에 없음) | 모든 쌍 일치 | 기본개념 확인문제 **학습용만** |
| `ordering` | — (시험에 없음) | 순서 완전 일치 | 기본개념 확인문제 **학습용만** |

**유형 배분**

| 세트 | single | multiple | matching | ordering |
|---|---:|---:|---:|---:|
| SAA 도메인 연습 · 모의고사 · 진단 | **75%** | **25%** | 0 | 0 |
| 기본개념 챕터 확인문제 | 60% | 20% | 12% | 8% |

> `matching`/`ordering`은 **암기 효율이 높아 학습에는 유용하지만 SAA-C03 시험에는 나오지 않는다.**
> 기본개념 확인문제에서만 쓰고, 화면에 `학습용 유형 · 실제 시험에는 출제되지 않습니다` 배지를 붙인다.
> `tools/validate.mjs`가 `exam: "SAA"` 세트에 이 두 유형이 들어가면 오류를 낸다.

**복수 응답 규칙**: 실제 시험은 5개 이상 선택지 중 2개 이상 정답. 문제문에 `(2개 선택)`처럼 개수를 명시한다.

### 3-3. 퀴즈 UI 기능

| 모드 | 동작 |
|---|---|
| 학습 모드 | 문항 제출 즉시 정답·해설·오답 노트 표시 |
| **시험 모드** | **65문항 / 130분 타이머** / 표시(flag) / 마지막에 일괄 채점 |
| 도메인 연습 | 특정 도메인만 필터링, 문항 수 선택 |
| 오답 노트 | 틀린 문항만 재출제, 3회 연속 정답 시 졸업 |
| 랜덤 챌린지 | 전체 은행에서 N문항 무작위 |
| **진단 모드** | 40문항 → 도메인별 취약점 분석 → 개인별 학습 순서 생성 |
| **약점 집중** | 정답률 80% 미달 도메인에서만 출제 (가중치 큰 도메인 우선) |
| **플래시카드** | 서비스↔용도, 한도↔값. 간격 반복 |

**결과 리포트**: 총점(720점 환산 안내 포함) / **도메인별 정답률 레이더 차트(Chart.js)** /
취약 도메인 → 챕터 링크 / 오답 목록 / 소요 시간 / **응시 이력 추이 라인 차트**

> 720점은 **스케일 점수**이며 원점수 백분율과 직접 대응하지 않는다.
> 결과 페이지는 백분율을 보여주되 "합격선 720은 스케일 점수라 백분율과 1:1 대응하지 않는다"를 명시한다.
> **"정답률 72%면 합격"이라고 쓰지 않는다.**

**진도 저장 (localStorage)**
```
ag:progress:read       → 읽은 페이지 집합
ag:progress:quiz       → { questionId: { attempts, correct, streak, lastAt } }
ag:progress:exams      → 모의고사 응시 이력
ag:progress:diagnostic → 진단 결과 + 학습 계획
ag:progress:cards      → 플래시카드 진도
ag:settings            → theme, fontSize
```

---

## 4. 데이터 시각화 설계 (요구사항 3번)

### 4-1. 차트 (Chart.js)

`assets/js/charts.js`가 Chart.js를 감싸고, **레지스트리 + 테마 연동**을 담당한다.

```html
<!-- 콘텐츠 에이전트가 쓰는 것은 이것뿐 -->
<figure class="chart" data-chart="C-012">
  <figcaption>S3 스토리지 클래스별 GB당 월 저장 비용과 최소 저장 기간</figcaption>
</figure>
```

```js
// 차트 에이전트가 만드는 것 — assets/js/charts.js 안의 등록부
AG.charts.register('C-012', function (ctx) {
  return { type: 'bar', data: { … }, options: { … } };
});
```

**규약**
- 색은 `ctx.color('accent' | 'ok' | 'warn' | 'danger' | 'muted' | 'series', i)` 로만 가져온다.
  → `viz.css`의 `--dg-*` 토큰을 읽으므로 **다크모드가 자동으로 따라온다**
- 테마 변경 시 `charts.js`가 전 차트를 재렌더한다
- `prefers-reduced-motion` 이면 애니메이션을 끈다
- 모든 차트는 `<figcaption>`이 필수이고, **표 대체본(`.chart__table`)을 함께 제공**한다
  → 스크린 리더·인쇄·JS 비활성 환경에서도 정보가 살아 있어야 한다
- 데이터가 10행을 넘으면 `data/charts/*.json`으로 분리한다

**주요 차트 (초기 카탈로그)**

| ID | 차트 | 유형 | 위치 |
|---|---|---|---|
| C-001 | SAA 도메인 가중치 | doughnut | `saa/index.html` |
| C-002 | 8주 학습 플랜 | 수평 바(간트) | `saa/index.html` |
| C-010 | S3 스토리지 클래스 비용 비교 | bar | ch08 |
| C-011 | S3 스토리지 클래스 최소 저장 기간·검색 시간 | grouped bar | ch08 |
| C-020 | EBS 볼륨 타입 최대 IOPS·처리량 | grouped bar | ch06 |
| C-030 | EC2 구매 옵션 상대 비용·유연성 | scatter | ch05 |
| C-040 | **DR 4전략 RTO/RPO 산점도** | scatter | ch18 |
| C-041 | DR 전략 비용 대 복구 시간 | line | ch18 |
| C-050 | 데이터 전송 요금 지도 | bar | ch18, cheatsheet/cost |
| C-060 | ALB·NLB·GWLB 특성 비교 | radar | ch07 |
| C-070 | DynamoDB 온디맨드 vs 프로비저닝 손익분기 | line | ch11 |
| C-080 | 캐시 계층별 지연시간 | 로그 스케일 bar | ch14 |
| C-100 | 내 도메인별 숙련도 | **radar** | 홈, `quiz/result.html` |
| C-101 | 학습 진도 | doughnut | 홈 |
| C-102 | 모의고사 점수 추이 | line | `quiz/result.html` |

> 차트는 **수치가 확인된 것만** 만든다. `docs/FACT_SOURCES.md`에서 검증하지 못한 값으로는
> 차트를 만들지 않는다. 상대적 비교만 가능하면 축에 숫자 대신 순위/등급을 쓰고 그 사실을 캡션에 밝힌다.

### 4-2. 다이어그램 (SVG)

kafka-guide와 동일한 분리 구조를 그대로 쓴다.

- 콘텐츠 에이전트: **플레이스홀더만** → `<figure class="diagram" data-diagram="D-030"><figcaption>…</figcaption></figure>`
- 시각화 에이전트: **독립 SVG 파일만** → `assets/diagrams/D-030-*.svg`
- Wave 4: `tools/inline-diagrams.mjs`로 **정적 치환**

**절대 규칙** (위반 시 검증 단계에서 CRITICAL)
- `viewBox`만 사용. `width`/`height` 하드코딩 금지. **폭 720 고정**
- 색 하드코딩 금지 — `--dg-*` 토큰 또는 `currentColor`만
- `role="img"` + `<title>` + `<desc>` + `aria-labelledby` 4종 필수
- 최소 글자 13px 상당. `font-family` 지정 금지
- SVG 안에 `<script>`·`<image>`·base64 금지
- 인라인 후 `id`가 전부 접두사로 바뀌므로 **인터랙티브 훅은 `data-dg` 속성으로만**

목표 약 90개. 상세 카탈로그는 `docs/DIAGRAM_CATALOG.md`.

---

## 5. 멀티에이전트 실행 계획

### 원칙
1. **파일 소유권 배타 할당** — 한 파일은 한 에이전트만 쓴다. 공유 파일은 스크립트로 자동 생성하거나 단독 에이전트가 처리.
2. **Wave 0 완료 전 Wave 1 착수 금지** — 공통 shell/CSS/JS/스키마가 먼저 고정돼야 스타일이 갈라지지 않는다.
3. **모든 에이전트는 공통 프리앰블의 필독 문서를 먼저 읽는다.**
4. **검증은 별도 Wave** — 생성 에이전트가 자기 결과를 검증하지 않는다 (적대적 검증).
5. **확인 못 한 수치는 쓰지 않는다.** 추정치를 "약", "대략"으로 얼버무리지 않는다.

### Wave 구성

```
Wave 0 · 기반 구축                  [단독, 순차]        1 agent
  └─ 툴링 상수 · charts.js · chart.css · 레퍼런스 페이지(ch01) · 레퍼런스 문제세트
     · 레퍼런스 다이어그램/차트 · index.html · quiz/* · 계약 문서

Wave 1 · 본문 + 시각화              [병렬]             14 agents
  콘텐츠 (9)
  ├─ A1  ch01–ch04  (인프라·IAM·VPC)          ← ★ 도메인1 30% 핵심
  ├─ A2  ch05–ch07  (EC2·EBS·ELB/ASG)         ← ★ 도메인2·3 핵심
  ├─ A3  ch08–ch09  (S3·파일 스토리지)         ← ★ 도메인3·4 핵심
  ├─ A4  ch10–ch11  (RDS·NoSQL)               ← ★ 도메인2·3 핵심
  ├─ A5  ch12–ch13  (서버리스·컨테이너)         ← ★ 도메인2 핵심
  ├─ A6  ch14–ch15  (엣지·DNS·분석)
  ├─ A7  ch16–ch18  (보안·운영·비용/DR)         ← ★ 도메인1·4 핵심
  ├─ A8  labs/ 12개 + cases/ 10개
  └─ A9  cheatsheet/ 7종 + saa/ 9페이지        ← ★ 키워드 사전 최우선
  시각화 (3)  ※ assets/diagrams/ 만 소유
  ├─ V1  ch01–ch07 다이어그램
  ├─ V2  ch08–ch13 다이어그램
  └─ V3  ch14–ch18 + cases + cheatsheet 다이어그램
  차트 (2)  ※ charts.js 등록부 + data/charts/ 만 소유
  ├─ G1  콘텐츠 차트 (C-010 ~ C-089)
  └─ G2  대시보드·결과 차트 (C-001 ~ C-002, C-100 ~ C-102)

Wave 2 · 문제은행                   [병렬 5 → 순차 1]   6 agents
  ├─ B1  기본개념 확인문제 180
  ├─ B2  도메인 연습 — Secure 102 + Cost 68     ← ★ 최대 가중치
  ├─ B3  도메인 연습 — Resilient 88 + Performing 82
  ├─ B4  모의고사 1·2 (130문항)
  ├─ B5  모의고사 3·4 (130문항) + 진단 40 + 플래시카드
  └─ B6  매니페스트 · 중복 감사 · 커버리지 감사    [B1–B5 완료 후 단독]

Wave 3 · 검증 (적대적, 읽기 전용)    [병렬]             5 agents
  ├─ C1  기술 정확도 검증 (AWS 1차 소스 대조 · 최신성 감사)
  ├─ C2  문제 정답·해설 전수 검증
  ├─ C3  링크·스키마·다이어그램·차트·빌드 검증
  ├─ C4  UI/UX·접근성·반응형·다크모드 검증
  └─ C5  시각화 검증 (다이어그램 정확성·차트 수치 근거)

Wave 4 · 통합                       [단독, 순차]        1 agent
  └─ 다이어그램 정적 인라인 · 검색 인덱스 · TOC · 홈 대시보드 · 스모크 테스트 · README
```

**총 27 에이전트 / 5 Wave.**

### 충돌 방지 파일 소유권 표

| 에이전트 | 배타 소유 경로 |
|---|---|
| Wave0 | `assets/css/**`, `assets/js/**`, `tools/**`, `basics/ch01.html`(레퍼런스), `quiz/**`, `index.html`(골격), `data/questions/basics-ch01.json`, `docs/**` |
| A1 | `basics/ch02.html`–`ch04.html` |
| A2 | `basics/ch05.html`–`ch07.html` |
| A3 | `basics/ch08.html`–`ch09.html` |
| A4 | `basics/ch10.html`–`ch11.html` |
| A5 | `basics/ch12.html`–`ch13.html` |
| A6 | `basics/ch14.html`–`ch15.html` |
| A7 | `basics/ch16.html`–`ch18.html` |
| A8 | `labs/**`, `cases/**` |
| A9 | `cheatsheet/**`, `saa/**` |
| V1 | `assets/diagrams/D-0[0-6]*.svg` |
| V2 | `assets/diagrams/D-0[7-9]*, D-1[0-2]*.svg` |
| V3 | `assets/diagrams/D-1[3-9]*, D-2*.svg` |
| G1 | `assets/js/charts-content.js`, `data/charts/c-0*.json` |
| G2 | `assets/js/charts-dash.js`, `data/charts/c-1*.json` |
| B1 | `data/questions/basics-ch*.json` |
| B2 | `data/questions/saa-secure.json`, `saa-cost.json` |
| B3 | `data/questions/saa-resilient.json`, `saa-performance.json` |
| B4 | `data/questions/saa-mock-1.json`, `saa-mock-2.json` |
| B5 | `data/questions/saa-mock-3.json`, `saa-mock-4.json`, `saa-diagnostic.json`, `data/flashcards/*.json` |
| B6 | `data/questions/manifest.json`, `data/flashcards/index.json` |
| C1–C5 | **읽기 전용** — 발견 사항을 리포트로만 반환 |
| Wave4 | `data/toc.json`, `data/search-index.json`, `assets/diagrams/index.json`, 다이어그램 인라인 치환, `README.md` |

> **시각화 에이전트(V1–V3)와 차트 에이전트(G1–G2)는 HTML을 절대 수정하지 않는다.**
> 반대로 **콘텐츠 에이전트(A1–A9)는 SVG나 차트 등록 코드를 만들지 않는다.** 플레이스홀더만 넣는다.
> 이 두 규칙이 Wave 1의 14개 에이전트를 충돌 없이 병렬 실행시키는 근거다.

---

## 6. 품질 기준 (Definition of Done)

### 기반
- [ ] 모든 페이지가 외부 네트워크 없이 렌더링된다 (CDN 참조 0건)
- [ ] 깨진 내부 링크 0건 (`tools/validate.mjs` 통과)
- [ ] 다크모드 / 모바일(360px) / 데스크톱에서 레이아웃 깨짐 없음
- [ ] 키보드만으로 퀴즈 응시 가능, 표에 `scope` 속성, 이미지 대체텍스트 존재
- [ ] `npm run build` 가 오류 0으로 통과한다

### 콘텐츠
- [ ] 기본개념 18장이 전부 존재하고 공통 구조를 따른다
- [ ] 확인되지 않은 수치·시험 정보를 단정적으로 서술하지 않는다
- [ ] **SAA-C04 언급 0건**
- [ ] 최신성 정책 표(§0)의 8개 항목이 전부 현행 기준으로 서술된다
- [ ] 시험 범위 밖 서비스를 학습 대상처럼 다루지 않는다 (CDK·CodePipeline 등)
- [ ] Reliability를 "안정성"으로 통일하고 첫 등장 시 병기한다
- [ ] 각 페이지에 내부 교차 링크 3개 이상, 표 1개 이상, 공식 문서 출처 절 존재

### 문제
- [ ] 모든 문제 JSON이 스키마를 통과하고, `id` 중복 0건
- [ ] 모든 문제에 `explanation` + 전 오답 `distractorNotes` + 공식 문서 `refs` 존재
- [ ] 덤프 출처 문제 복제 0건
- [ ] **`exam:"SAA"` 세트에 `matching`/`ordering` 0건**
- [ ] 도메인 연습이 가중치(30/26/24/20)대로 배분되었다
- [ ] 모의고사 4세트가 서로 중복 없이 각 65문항이고 도메인 비율을 따른다
- [ ] 진단 테스트 40문항이 4개 도메인 × 10문항이고, 결과가 학습 순서를 생성한다
- [ ] "정답률 72% = 합격" 같은 스케일 점수 오해를 유발하는 서술 0건

### 시각화
- [ ] 카탈로그의 모든 다이어그램이 존재하고, 참조 플레이스홀더도 전부 존재한다 (양방향 일치)
- [ ] `tools/inline-diagrams.mjs` 실행 후 미치환 플레이스홀더 0건
- [ ] SVG에 하드코딩된 색 0건 — 전부 `--dg-*` 토큰
- [ ] 모든 SVG에 `role="img"` + `<title>` + `<desc>` 존재
- [ ] 360px에서 다이어그램 텍스트가 읽힌다
- [ ] **모든 차트가 다크모드에서 정상 렌더된다** (테마 전환 시 재렌더 확인)
- [ ] **모든 차트에 표 대체본이 있다** (스크린 리더·인쇄 대응)
- [ ] 차트 수치가 전부 `docs/FACT_SOURCES.md`에서 확인된 값이다

---

## 7. 리스크와 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| **AWS 문서 웹사이트 차단** | 사실 확인 불가 | `docs/FACT_SOURCES.md`가 도달 가능한 1차 소스(botocore, CFN 스펙, awsdocs 저장소, WebSearch)를 정의. 확인 못 하면 안 쓴다 |
| SAA-C04 오정보 오염 | 사이트 신뢰도 붕괴 | §0에 경고 명문화. 검증 Wave가 전수 검사. 시험 코드는 편집 가능한 단일 상수로 관리 |
| AWS 기본값 변경 | 오학습 | `SERVICE_CURRENCY.md` + `validate.mjs` 자동 검사 (S3 일관성, EC2-Classic, 개명 서비스) |
| 확인 불가 수치를 추정으로 채움 | 오학습 | "쓰지 말 것" 목록 운영. 빈칸으로 두고 리포트에 명시 |
| 에이전트 간 톤·스타일 편차 | 일관성 저하 | Wave 0에서 레퍼런스 페이지(ch01) 완성 → 전 에이전트가 복제 기준으로 삼음 |
| 문제 정답 오류 | 오학습 | Wave 3 C2가 생성 에이전트와 분리되어 전수 검증 |
| 파일 충돌 | 작업 유실 | 배타 소유권 표 강제. 공유 파일은 Wave 4 단독 처리 |
| 컨텍스트 초과로 에이전트 중단 | 산출물 유실 | 에이전트당 페이지 2~3개로 제한. 파일 하나 완성 후 다음으로 |
| 자격증 NDA/저작권 | 법적 리스크 | 덤프 참조 전면 금지, 전 문항 자체 창작. 검증 Wave가 복제 흔적 검사 |
| 차트 라이브러리가 다크모드에서 깨짐 | 시각 품질 | `charts.js`가 CSS 변수를 읽고 테마 전환 시 재렌더. Wave 3 C5가 양쪽 테마 확인 |
| 원화 응시료 하드코딩 | 오정보 | USD만 표기하고 "결제 시점 환율" 명시. AWS는 매년 4월 현지 통화 가격을 갱신한다 |

---

## 8. 출처

- [AWS Certified Solutions Architect – Associate (공식)](https://aws.amazon.com/ko/certification/certified-solutions-architect-associate/)
- [SAA-C03 시험 가이드 (공식 문서)](https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-associate-03/solutions-architect-associate-03.html)
- [SAA-C03 시험 가이드 한국어](https://docs.aws.amazon.com/ko_kr/aws-certification/latest/userguide/solutions-architect-associate-03.html)
- [도메인 1 — Design Secure Architectures](https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-associate-03/solutions-architect-associate-03-domain1.html)
- [시험 범위 내 서비스](https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-associate-03/saa-03-in-scope-services.html)
- [시험 범위 밖 서비스](https://docs.aws.amazon.com/aws-certification/latest/examguides/saa-03-out-of-scope-services.html)
- [SAA-C03 등록 개시 발표 (2022)](https://aws.amazon.com/blogs/training-and-certification/updated-aws-certified-solutions-architect-associate-registration-now-open/)
- [재인증 정책 (3년)](https://aws.amazon.com/certification/policies/recertification/)
- [출시 예정 자격증](https://aws.amazon.com/certification/coming-soon/)
- [AWS Certification 신규 문항 유형](https://aws.amazon.com/blogs/training-and-certification/aws-certification-new-exam-question-types)
- [Well-Architected Framework (한국어)](https://docs.aws.amazon.com/ko_kr/wellarchitected/latest/framework/welcome.html)
- [지속 가능성 기둥 추가 발표](https://aws.amazon.com/ko/blogs/korea/sustainability-pillar-well-architected-framework/)
- [S3 기본 암호화 FAQ](https://docs.aws.amazon.com/AmazonS3/latest/userguide/default-encryption-faq.html)
- [S3 신규 버킷 보안 기본값 변경 (2023-04)](https://aws.amazon.com/about-aws/whats-new/2023/04/amazon-s3-security-best-practices-buckets-default)
- [IMDSv2 기본값 설정 (2024-03)](https://aws.amazon.com/about-aws/whats-new/2024/03/set-imdsv2-default-new-instance-launches)
- [운영 자격증 개명 발표 (SOA-C03)](https://aws.amazon.com/blogs/training-and-certification/exam-update-and-new-name-for-operations-certification)
- [Chart.js](https://www.chartjs.org/) — MIT, `assets/vendor/`에 동봉
- [@panzoom/panzoom](https://github.com/timmywil/panzoom) — MIT, `assets/vendor/`에 동봉
