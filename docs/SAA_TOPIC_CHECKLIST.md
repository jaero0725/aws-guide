# SAA-C03 필수 출제 토픽 체크리스트

> 이 문서의 목적은 **커버리지 강제**다.
> 아래 토픽은 SAA-C03에서 반복적으로 다뤄지는 판단 지점이며,
> **본문(Wave 1)과 문항(Wave 2) 양쪽에서 모두 다뤄져야 한다.** Wave 3이 감사한다.
>
> 각 토픽에는 **태그 슬러그**가 붙어 있다. 문제 JSON의 `tags` 배열에 이 슬러그를 넣으면
> 커버리지를 기계적으로 추적할 수 있다.

---

## 왜 이 목록이 필요한가

SAA는 서비스를 하나씩 아는 시험이 아니라 **여러 개의 맞는 답 중 하나를 고르는 시험**이다.
그래서 "S3를 설명했다"는 커버리지가 아니다. **"S3 Standard-IA와 One Zone-IA 중
무엇을 언제 고르는가"를 판단하게 만들었는가**가 커버리지다.

아래 항목은 전부 그 **판단 지점** 단위로 쪼개 놓았다.
본문에서 이 판단을 다루지 않았다면 그 챕터는 미완성이고,
문항에서 이 판단을 묻지 않았다면 그 도메인 세트는 미완성이다.

---

## 사용 규약

| 대상 | 해야 할 일 |
|---|---|
| **Wave 1 콘텐츠 에이전트** | 담당 챕터의 토픽을 본문에서 다룬다. 특히 "판단 기준"을 명시적으로 서술한다 |
| **Wave 2 문항 에이전트** | 담당 도메인의 토픽마다 최소 1문항. `tags`에 슬러그를 넣는다 |
| **Wave 3 감사 에이전트** | 본문 커버리지와 태그 커버리지를 양방향으로 검사. 누락은 CRITICAL |

태그 슬러그는 소문자 케밥 케이스이며 **AWS 식별자는 원문 그대로** 쓴다
(`gp3`, `sse-kms`, `multi-az` 처럼).

---

## 도메인 1 · 보안 아키텍처 설계 (30%)

가중치가 가장 크고 과제 진술이 3개뿐이다. **출제 범위가 좁고 깊다.**
여기서 실점하면 합격이 어렵다.

| # | 판단 지점 | 태그 슬러그 | 챕터 |
|:--:|---|---|:--:|
| 1 | **EC2에서 AWS API를 호출해야 한다 — 액세스 키인가 IAM 역할인가.** 거의 항상 역할이며, 이 패턴이 오답 유도로 가장 많이 쓰인다 | `iam-role-vs-access-key` | ch02 |
| 2 | IAM 정책 평가 순위 — **명시적 거부 > 명시적 허용 > 암묵적 거부** | `iam-policy-evaluation` | ch02 |
| 3 | 자격 증명 기반 정책 vs 리소스 기반 정책. 교차 계정 접근에서 둘 다 필요한 경우 | `identity-vs-resource-policy` | ch02 |
| 4 | 역할 위임(AssumeRole)과 신뢰 정책. 교차 계정·교차 서비스 | `sts-assume-role` | ch02 |
| 5 | SCP는 **권한을 부여하지 않고 상한만 정한다.** 멤버 계정 루트에도 적용된다 | `scp-guardrail` | ch02 |
| 6 | 권한 경계(permissions boundary)와 SCP의 차이 | `permissions-boundary` | ch02 |
| 7 | 온프레미스·외부 IdP 사용자에게 AWS 접근을 준다 — Identity Center인가 Cognito인가 Directory Service인가 | `federation-choice` | ch02, ch16 |
| 8 | **보안 그룹은 상태 저장, 네트워크 ACL은 상태 비저장.** SG에는 거부 규칙이 없다 | `sg-vs-nacl` | ch03 |
| 9 | 프라이빗 서브넷의 인스턴스가 인터넷에 나가야 한다 — NAT 게이트웨이. **AZ마다 두어야 이중화된다** | `nat-gateway` | ch03 |
| 10 | **AWS 서비스에 인터넷을 거치지 않고 접근한다** — 게이트웨이 엔드포인트(S3·DynamoDB) vs 인터페이스 엔드포인트(PrivateLink) | `vpc-endpoint-choice` | ch04 |
| 11 | 저장 데이터 암호화 — SSE-S3 / SSE-KMS / DSSE-KMS / SSE-C 선택 기준. **키 관리 주체와 감사 요구가 기준** | `s3-encryption-choice` | ch08, ch16 |
| 12 | KMS **봉투 암호화**와 데이터 키. 고객 관리형 키를 언제 쓰는가 | `kms-envelope` | ch16 |
| 13 | **Secrets Manager vs Parameter Store** — 자동 교체가 필요한가 | `secrets-vs-parameter-store` | ch16 |
| 14 | 전송 중 암호화 — ACM 인증서를 어디에 붙이는가 (ALB / CloudFront / API Gateway) | `tls-termination` | ch14, ch16 |
| 15 | 위협 탐지 서비스 선택 — GuardDuty(위협) / Inspector(취약점) / Macie(민감 데이터) / Security Hub(집계) | `security-service-choice` | ch16 |
| 16 | 웹 계층 보호 — WAF(L7 규칙) vs Shield(DDoS). 어디에 연결하는가 | `waf-vs-shield` | ch14, ch16 |
| 17 | S3 신규 버킷의 **현행 기본값** — 퍼블릭 액세스 차단 ON, ACL 비활성, SSE-S3 자동 적용 | `s3-secure-defaults` | ch08 |
| 18 | 감사 추적 — CloudTrail(누가 무엇을 호출했나) vs Config(리소스 구성이 규정에 맞나) | `cloudtrail-vs-config` | ch17 |

---

## 도메인 2 · 복원력 있는 아키텍처 설계 (26%)

과제 진술이 2개뿐인데 26%다. **각 진술이 매우 촘촘하게 출제된다.**

| # | 판단 지점 | 태그 슬러그 | 챕터 |
|:--:|---|---|:--:|
| 19 | **RDS Multi-AZ는 가용성, 읽기 전용 복제본은 읽기 확장.** 시험이 가장 집요하게 노리는 혼동 | `multi-az-vs-read-replica` | ch10 |
| 20 | Multi-AZ 배포는 동기 복제·자동 장애 조치·**대기 인스턴스로 읽기 불가** | `rds-multi-az` | ch10 |
| 21 | Aurora의 복제 구조와 Aurora 글로벌 데이터베이스 | `aurora-replication` | ch10 |
| 22 | **느슨한 결합** — 동기 호출을 SQS/SNS/EventBridge로 끊는 판단 | `decoupling` | ch12 |
| 23 | **SQS 표준 vs FIFO** — 순서 보장과 중복 제거가 필요한가, 처리량이 필요한가 | `sqs-standard-vs-fifo` | ch12 |
| 24 | SQS 가시성 타임아웃과 DLQ. 처리 실패 메시지를 어떻게 격리하는가 | `sqs-visibility-dlq` | ch12 |
| 25 | **SNS 팬아웃** vs EventBridge 라우팅 — 이벤트 필터링·스키마가 필요한가 | `sns-vs-eventbridge` | ch12 |
| 26 | 트래픽 급증을 **큐로 완충**한다 (스케일아웃이 못 따라가는 경우) | `queue-buffering` | ch12 |
| 27 | ASG 다중 AZ 배치와 ELB 헬스체크 연동. **상태 비저장 설계**가 전제 | `asg-multi-az` | ch07 |
| 28 | ASG 스케일링 정책 — 대상 추적 / 단순 / 단계별 / 예약 | `asg-scaling-policy` | ch07 |
| 29 | ELB 헬스체크가 실패한 대상을 빼는 방식, 연결 드레이닝 | `elb-health-check` | ch07 |
| 30 | **DR 4전략과 RTO/RPO** — 백업·복원 / 파일럿 라이트 / 웜 스탠바이 / 다중 사이트 액티브-액티브 | `dr-strategies` | ch18 |
| 31 | RTO·RPO 요구가 주어졌을 때 전략을 고르는 판단. **비용과 복구 시간의 교환** | `rto-rpo-tradeoff` | ch18 |
| 32 | S3 교차 리전 복제(CRR) vs 동일 리전 복제(SRR)의 용도 | `s3-replication` | ch08, ch18 |
| 33 | 백업 중앙화 — AWS Backup의 역할 | `aws-backup` | ch18 |
| 34 | 단일 장애점 제거 — NAT 게이트웨이·인스턴스·엔드포인트의 AZ 이중화 | `single-point-of-failure` | ch03, ch07 |
| 35 | Route 53 **장애 조치 라우팅**과 상태 확인으로 리전 장애에 대응 | `route53-failover` | ch14 |
| 36 | Lambda 동시성·재시도·DLQ. 서버리스의 내결함성 | `lambda-resilience` | ch12 |

---

## 도메인 3 · 고성능 아키텍처 설계 (24%)

과제 진술이 5개로 가장 많다. **넓고 얕게 출제된다.**

| # | 판단 지점 | 태그 슬러그 | 챕터 |
|:--:|---|---|:--:|
| 37 | **EBS 볼륨 타입 선택** — gp3 / io2 / st1 / sc1. **gp3 상한은 2025-09에 상향되었다** | `ebs-volume-choice` | ch06 |
| 38 | EBS vs 인스턴스 스토어 — **인스턴스 스토어는 중지 시 소실** | `ebs-vs-instance-store` | ch06 |
| 39 | 공유 파일 시스템이 필요하다 — **EFS(Linux, 다중 AZ) vs FSx(Windows·Lustre)** | `efs-vs-fsx` | ch09 |
| 40 | S3 성능 — 접두사 분산, 멀티파트 업로드, Transfer Acceleration | `s3-performance` | ch08 |
| 41 | **읽기 지연을 줄인다** — ElastiCache(Redis vs Memcached) vs DAX vs 읽기 전용 복제본 | `caching-choice` | ch11 |
| 42 | **CloudFront로 정적·동적 콘텐츠 가속.** 오리진 보호(OAC) | `cloudfront` | ch14 |
| 43 | **Global Accelerator vs CloudFront** — TCP/UDP 고정 IP인가 HTTP 캐싱인가 | `global-accelerator-vs-cloudfront` | ch14 |
| 44 | **Route 53 라우팅 정책 8종**과 각각의 용도. 지연 시간 vs 지리적 위치 vs 지리 근접 | `route53-routing-policy` | ch14 |
| 45 | **DynamoDB 파티션 키 설계**와 핫 파티션 | `dynamodb-partition-key` | ch11 |
| 46 | **LSI vs GSI** — 생성 시점 제약, 키 범위, 일관성 | `lsi-vs-gsi` | ch11 |
| 47 | DynamoDB 용량 모드 — 온디맨드 vs 프로비저닝(+오토스케일링) | `dynamodb-capacity-mode` | ch11 |
| 48 | 컴퓨팅 확장 — 수직(인스턴스 타입) vs 수평(ASG). **탄력성이 필요하면 수평** | `scaling-direction` | ch05, ch07 |
| 49 | 배치 그룹 — 클러스터(저지연) / 분산(장애 격리) / 파티션 | `placement-group` | ch05 |
| 50 | **실시간 스트리밍 수집** — Kinesis Data Streams vs Firehose vs MSK. "실시간"이면 배치 도구가 아니다 | `streaming-ingestion` | ch15 |
| 51 | 서버리스 분석 — Athena(S3 위 SQL) vs Redshift(데이터 웨어하우스) vs EMR | `analytics-choice` | ch15 |
| 52 | ETL — Glue의 역할, 데이터 카탈로그 | `glue-etl` | ch15 |
| 53 | 컨테이너 실행 모델 — **ECS on EC2 vs Fargate vs EKS**. 운영 부담이 기준 | `container-choice` | ch13 |
| 54 | ALB vs NLB vs GWLB — **계층과 프로토콜이 기준**. 고정 IP가 필요하면 NLB | `alb-vs-nlb-vs-gwlb` | ch07 |

---

## 도메인 4 · 비용 최적화 아키텍처 설계 (20%)

| # | 판단 지점 | 태그 슬러그 | 챕터 |
|:--:|---|---|:--:|
| 55 | **EC2 구매 옵션 선택** — 온디맨드 / 예약 인스턴스 / Savings Plans / 스팟 / 전용. 워크로드 특성이 기준 | `ec2-purchase-options` | ch05 |
| 56 | **중단 가능한 워크로드는 스팟.** 상시 기저 부하는 Savings Plans | `spot-vs-savings-plans` | ch05, ch18 |
| 57 | **S3 스토리지 클래스 선택** — 접근 빈도와 검색 시간 요구가 기준. **최소 저장 기간에 주의** | `s3-storage-class` | ch08 |
| 58 | S3 Intelligent-Tiering을 언제 쓰는가 — **접근 패턴을 모를 때** | `s3-intelligent-tiering` | ch08 |
| 59 | S3 수명 주기 규칙으로 전환·만료. 불완전 멀티파트 업로드 정리 | `s3-lifecycle` | ch08 |
| 60 | One Zone-IA의 교환 조건 — **단일 AZ라 AZ 장애에 취약** | `s3-one-zone-ia` | ch08 |
| 61 | **데이터 전송 요금의 방향성** — 수신은 대체로 무료, 송신·AZ 간·리전 간은 과금 | `data-transfer-cost` | ch18 |
| 62 | NAT 게이트웨이 비용을 VPC 엔드포인트로 줄이는 판단 | `nat-cost-optimization` | ch04, ch18 |
| 63 | CloudFront로 오리진 송신 비용을 줄이는 판단 | `cloudfront-cost` | ch14, ch18 |
| 64 | 비용 가시성 — Cost Explorer / Budgets / Cost and Usage Report의 역할 구분 | `cost-visibility` | ch18 |
| 65 | 라이트사이징 — Compute Optimizer, Trusted Advisor | `rightsizing` | ch18 |
| 66 | 서버리스가 비용을 줄이는 경우와 늘리는 경우. **일정한 고부하는 오히려 비쌀 수 있다** | `serverless-cost` | ch12, ch18 |
| 67 | 데이터베이스 비용 — Aurora Serverless v2를 언제 쓰는가 | `aurora-serverless` | ch10, ch18 |
| 68 | 마이그레이션 6R 전략과 각각의 비용·노력 | `migration-6r` | ch18 |
| 69 | 대용량 오프라인 전송 — Snow Family vs DataSync vs Direct Connect. **대역폭과 기간이 기준** | `bulk-transfer-choice` | ch09, ch18 |

---

## 시험 기술(techniques) — 도메인에 속하지 않지만 반드시 다룬다

이것들은 `saa/keywords.html` · `saa/exam-tips.html` · `saa/traps.html`이 담당한다.

| # | 항목 | 태그 슬러그 | 위치 |
|:--:|---|---|---|
| 70 | **한정어 키워드 사전** — MOST cost-effective / LEAST operational overhead 등이 가리키는 답 | `qualifier-keywords` | `saa/keywords.html` |
| 71 | 소거법 — 명시된 제약을 위반하는 선택지를 먼저 버린다 | `elimination-technique` | `saa/exam-tips.html` |
| 72 | 마지막 문장(한정어)을 먼저 읽는 독해 순서 | `read-qualifier-first` | `saa/exam-tips.html` |
| 73 | 시간 배분 — 65문항 / 130분 = 문항당 2분. 표시하고 넘어가기 | `time-management` | `saa/exam-tips.html` |
| 74 | **오답 감점이 없으므로 반드시 찍는다** | `no-penalty-guessing` | `saa/exam-tips.html` |
| 75 | 720점은 스케일 점수 — **정답률과 1:1 대응하지 않는다** | `scaled-score` | `saa/index.html` |
| 76 | 비채점 15문항의 존재 — 낯선 문항에 흔들리지 않는다 | `unscored-items` | `saa/index.html` |
| 77 | 시험 범위 밖 서비스 — **CloudFormation은 안, CDK는 밖** | `out-of-scope-services` | ch01, `saa/exam-tips.html` |

---

## 최신성 감사 항목 — 별도로 강제한다

시중 자료가 틀린 채로 유통되는 항목이다. **본문에 현행 값이 있어야 하고,
가능하면 "예전에는 X였다"는 사실 자체를 가르쳐야 한다.**
`tools/validate.mjs`가 일부를 자동 검사한다.

| # | 항목 | 태그 슬러그 | 자동 검사 |
|:--:|---|---|:--:|
| 78 | S3는 **강력한 읽기 후 쓰기 일관성**이다 (2020-12 이후). 최종 일관성 아님 | `s3-strong-consistency` | ✅ ERROR |
| 79 | EC2-Classic은 **종료되었다** (2022-08) | `ec2-classic-retired` | ✅ ERROR |
| 80 | AWS SSO → **IAM Identity Center**, Elasticsearch Service → **OpenSearch Service** | `renamed-services` | ✅ WARN |
| 81 | S3 신규 버킷 기본값 (퍼블릭 차단·ACL 비활성·SSE-S3) | `s3-secure-defaults` | ❌ 수동 |
| 82 | **EBS gp3 상한 상향** (2025-09): 64 TiB · 80,000 IOPS · 2,000 MiB/s | `gp3-limits-2025` | ❌ 수동 |
| 83 | **Route 53 라우팅 정책은 8종** — 지리 근접·IP 기반이 흔히 누락된다 | `route53-eight-policies` | ❌ 수동 |
| 84 | IMDSv2 기본값 정책 (2024) | `imdsv2-default` | ❌ 수동 |
| 85 | **S3 단일 객체 최대 크기는 50 TB** (2025-12 상향, 구 5 TB) | `s3-object-size-50tb` | ❌ 수동 |
| 86 | **ALB 교차 영역 로드 밸런싱은 끌 수 없다.** NLB·GWLB만 기본 꺼짐 | `cross-zone-defaults` | ❌ 수동 |

---

## 커버리지 감사 방법 (Wave 3)

```bash
# 1. 태그 커버리지 — 모든 슬러그가 문제은행에 최소 1회 등장하는가
node -e "
const fs=require('fs');const dir='data/questions';
const tags=new Set();
for(const f of fs.readdirSync(dir)){
  if(f==='manifest.json'||!f.endsWith('.json'))continue;
  for(const q of JSON.parse(fs.readFileSync(dir+'/'+f,'utf8')).questions||[])
    (q.tags||[]).forEach(t=>tags.add(t));
}
const need=process.argv.slice(1);
const missing=need.filter(t=>!tags.has(t));
console.log(missing.length?'누락 '+missing.length+'건:\n'+missing.join('\n'):'전 토픽 커버됨');
" $(grep -oP '(?<=\| `)[a-z0-9-]+(?=` \|)' docs/SAA_TOPIC_CHECKLIST.md | sort -u)
```

본문 커버리지는 기계 검사가 어렵다. **Wave 3 C1이 챕터별로 읽고 판정한다.**
"서비스를 설명했다"가 아니라 **"판단 기준을 서술했다"** 를 기준으로 본다.

---

## 누락 시 처리

| 상황 | 심각도 | 조치 |
|---|:--:|---|
| 본문에 판단 기준이 없다 | **CRITICAL** | 담당 콘텐츠 에이전트가 보강 |
| 문항이 0개다 | **CRITICAL** | 담당 문항 에이전트가 출제 |
| 태그 슬러그 오타 | MAJOR | 문항 에이전트가 정정 |
| 최신성 항목이 구식으로 서술됨 | **CRITICAL** | 즉시 정정. 오학습을 직접 유발한다 |
