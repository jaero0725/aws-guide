# AWS 사실 검증 프로토콜 (FACT_SOURCES)

> 이 문서는 `aws-guide` 프로젝트에서 **AWS SAA-C03 학습 콘텐츠를 작성하는 모든 에이전트가 사실을 확인하는 방법**을 규정한다.
> 최종 검증일: **2026-07-29**
> 검증에 사용한 아티팩트: `botocore 1.43.58` (2026-07-28 빌드), `cfn-lint 1.53.3` (스키마 날짜 2026-07-28), `@aws-cdk/aws-service-spec 0.1.199`, `@aws-sdk/client-s3 3.1097.0`

---

## §1 차단된 호스트

이 환경의 egress 프록시는 **AWS 문서 호스트를 네트워크 정책 수준에서 차단**한다. CONNECT 단계에서 403이 반환된다.

| 호스트 | 상태 |
|---|---|
| `docs.aws.amazon.com` | ❌ 403 (CONNECT 거부) |
| `aws.amazon.com` | ❌ 403 (CONNECT 거부) |
| `d1.awsstatic.com` | ❌ 403 (CONNECT 거부) |
| `api.github.com` | ❌ 403 |

### 🚫 재시도 금지

**위 호스트는 재시도해도 절대 열리지 않는다.** `curl`, `WebFetch`, `wget`, 파이썬 `requests` 무엇을 써도 동일하다.
프록시 우회, TLS 검증 비활성화(`-k`, `verify=False`), `HTTPS_PROXY` 해제는 **금지**한다. 시간 낭비이자 정책 위반이다.

프록시 상태를 진단해야 한다면 아래 명령만 사용한다:

```bash
curl -sS "$HTTPS_PROXY/__agentproxy/status"
# 도구별 대처법은 /root/.ccr/README.md 참조
```

### ⚠️ 차단은 사실 확인을 건너뛸 핑계가 아니다

> **"docs.aws.amazon.com이 막혀서 확인할 수 없었습니다"는 허용되지 않는 답변이다.**

AWS 공식 문서 웹사이트는 **AWS가 배포하는 기계 판독 가능 모델과 소스 마크다운으로부터 생성된다**. 우리는 그 **생성 원본**에 직접 접근할 수 있다 (§2). 즉 웹사이트가 막힌 것은 *하위 산출물*이 막힌 것이고, 우리는 *상위 원본*을 읽는다.

숫자·기본값·목록을 확인하지 못했다면 → **추측해서 쓰지 말고 §5 "쓰지 말 것" 목록에 추가하고 해당 서술을 생략한다.**

---

## §2 열려 있는 소스 (권위 순)

### 🥇 1순위 — `botocore` (PyPI) : AWS API 모델 그 자체

```bash
cd "$SCRATCH" && pip download botocore --no-deps -d ./bc
unzip -q ./bc/botocore-*.whl -d ./bcx
ls ./bcx/botocore/data          # 430개 서비스 디렉터리
# 서비스 모델은 gzip 압축되어 있다
python3 -c "import gzip,json; d=json.load(gzip.open('bcx/botocore/data/s3/2006-03-01/service-2.json.gz')); print(d['metadata'])"
```

**왜 최고 권위인가 — 재프레이밍 논거:**

`service-2.json`은 AWS가 각 서비스 API를 정의하는 **정본(canonical) 모델**이다. AWS는 이 모델 하나로부터 (a) 모든 언어의 SDK, (b) AWS CLI, (c) **docs.aws.amazon.com의 API 레퍼런스 페이지**를 자동 생성한다. 각 operation·shape·member에 붙은 `documentation` 필드는 AWS 테크니컬 라이터가 직접 작성한 HTML이며, 웹사이트에 렌더링되는 문장과 **같은 문자열**이다.

> 이것은 우회책(workaround)이 아니다. **웹사이트가 이 파일로부터 생성되므로, 이 파일이 웹사이트보다 상위 권위다.**

**현행성:** 매우 높음. 검증 시점 기준 최신 버전 `1.43.58`의 데이터 파일 타임스탬프가 **하루 전(2026-07-28)** 이었다. botocore는 AWS API 변경에 맞춰 거의 매일 릴리스된다.

**커버리지:** `botocore/data` 아래 **430개 서비스**. SAA 출제 범위 서비스는 전부 포함된다.

**구체적 추출 예시 — S3 스토리지 클래스 전체 목록:**

```bash
python3 -c "
import gzip,json
d=json.load(gzip.open('bcx/botocore/data/s3/2006-03-01/service-2.json.gz'))
print(d['shapes']['StorageClass']['enum'])"
# → ['STANDARD','REDUCED_REDUNDANCY','STANDARD_IA','ONEZONE_IA','INTELLIGENT_TIERING',
#    'GLACIER','DEEP_ARCHIVE','OUTPOSTS','GLACIER_IR','SNOW','EXPRESS_ONEZONE',
#    'FSX_OPENZFS','FSX_ONTAP']
```

**편의 헬퍼** (재작성 권장, 스크래치패드에 저장해 쓰면 편하다):

```python
import gzip, json, os, re
BASE='bcx/botocore/data'
def load(svc):
    v=sorted(os.listdir(f'{BASE}/{svc}'))[-1]
    return json.load(gzip.open(f'{BASE}/{svc}/{v}/service-2.json.gz'))
def strip(h):  # documentation은 HTML이다
    return re.sub(r'\s+',' ',re.sub(r'<[^>]+>','',h or '')).strip()
```

#### ⚠️ botocore 사용 시 반드시 지킬 3가지 함정

1. **shape의 `min`/`max`는 서비스 쿼터가 아니다 — 와이어 프로토콜 제약이다.**
   실제 확인된 사례: `lambda` 모델의 `Timeout` shape는 `max: 5400`, `MemorySize` shape는 `max: 32768`이다.
   그러나 **같은 모델의 `documentation` 문자열은 "The maximum allowed value is 900 seconds"라고 명시**하며, 실제 Lambda 쿼터는 900초 / 10,240 MB다.
   → **숫자는 `min`/`max`가 아니라 `documentation` 본문에서 읽어라.** shape 경계는 참고용일 뿐이다.

2. **`serviceFullName`은 API 모델의 역사적 명칭이지 현재 브랜드명이 아니다.**
   확인된 사례: `ecs` → `"Amazon EC2 Container Service"` (현재 정식명은 Elastic Container Service), `sso-admin` → `"AWS Single Sign-On Admin"` (현재는 IAM Identity Center).
   → 서비스 **정식 명칭**은 `serviceFullName`을 1차 근거로 삼되, **§7의 개명 목록과 반드시 교차 확인**한다.

3. **`documentation`은 HTML이다.** `<p>`, `<code>`, `<a href>`가 섞여 있으므로 태그를 제거한 뒤 읽는다.

---

### 🥈 2순위 — `@aws-cdk/aws-service-spec` (npm) : CloudFormation 리소스 속성 문서

```bash
npm pack @aws-cdk/aws-service-spec && tar xzf aws-cdk-aws-service-spec-*.tgz
python3 -c "
import gzip,json
d=json.load(gzip.open('package/db.json.gz'))
for e in d['schema']['resource']['entities']:
    if e['cloudFormationType']=='AWS::EC2::Volume':
        print(e['properties']['Iops']['documentation'])"
```

**구조:** `package/db.json.gz` 안에 `schema.resource.entities` 배열 (**1,722개 CloudFormation 리소스 타입**). 각 엔트리에 `cloudFormationType`, `documentation`, `properties`(속성별 `documentation` + 타입), `attributes`, `primaryIdentifier`가 있다.

**왜 권위 있는가:** CloudFormation 리소스 스키마는 AWS가 게시하는 리소스 프로바이더 정의이며, CloudFormation 사용자 가이드의 속성 설명 페이지가 여기서 생성된다. **속성 설명이 botocore보다 서술적이고, 기본값(default)과 유효 범위가 마크다운 목록으로 잘 정리**되어 있어 "기본 동작·유효 범위" 확인에 특히 유용하다.

**실제 유용성 확인 — EBS `VolumeType` 속성 문서에서 그대로 추출:**
- 볼륨 타입 분류: General Purpose SSD `gp2`|`gp3` / Provisioned IOPS SSD `io1`|`io2` / Throughput Optimized HDD `st1` / Cold HDD `sc1` / Magnetic `standard`
- `st1`, `sc1`은 부트 볼륨으로 사용 불가
- **Default: `gp2`**
- 크기 범위: gp2 `1–16,384` GiB / gp3 `1–65,536` GiB / io1 `4–16,384` GiB / io2 `4–65,536` GiB / st1·sc1 `125–16,384` GiB / standard `1–1024` GiB

#### ⚠️ CFN 스펙은 botocore보다 뒤처질 수 있다 (실제 확인된 충돌)

gp3 최대 처리량에 대해:
- `@aws-cdk/aws-service-spec` (CFN): **"maximum of 1,000 MiB/s"** ← 오래됨
- `botocore` (EC2 API): **"Valid Range: 125 - 2000 MiB/s"** ← 정확
- WebSearch 교차 확인: 2025-09 업데이트로 **2,000 MiB/s**가 맞음

→ **두 소스가 충돌하면 `botocore`를 채택**하고, WebSearch로 교차 확인한다.

---

### 🥉 3순위 — `cfn-lint` (PyPI) : 리전별 서비스/리소스 가용성

```bash
pip download cfn-lint --no-deps -d ./cl && unzip -q ./cl/cfn_lint-*.whl -d ./clx
cat ./clx/cfnlint/data/schemas/version.json     # {"schema_date": "2026-07-28T14:54:37Z"}
ls ./clx/cfnlint/data/schemas/providers/         # 46개 리전 JSON
```

**고유 가치:** `providers/<region>.json`은 **해당 리전에서 실제로 사용 가능한 CloudFormation 리소스 타입 맵**이다. 리전별 서비스 가용성을 이보다 기계적으로 확인할 방법이 없다.

**실제 확인 예시:**

```bash
python3 -c "
import json
for r in ['us-east-1','ap-northeast-2','eu-west-1']:
    d=json.load(open(f'clx/cfnlint/data/schemas/providers/{r}.json'))
    print(r, len(d), 'AWS::S3Express::DirectoryBucket' in d)"
# us-east-1      1692 True
# ap-northeast-2 1424 False   ← 서울 리전은 S3 Express One Zone 미지원(검증 시점)
# eu-west-1      1523 True
```

기타 유용 파일: `cfnlint/data/AdditionalSpecs/LmbdRuntimeLifecycle.json` (Lambda 런타임 지원 종료 일정), `StatefulResources.json`, `Policies.json`.

---

### 4순위 — `awsdocs/*` GitHub 레포 (raw.githubusercontent.com) : 아카이브된 공식 사용자 가이드

```bash
curl -s "https://raw.githubusercontent.com/awsdocs/amazon-s3-userguide/main/doc_source/storage-class-intro.md"
```

**존재 확인된 레포 (검증 완료):**

| 레포 | 기본 브랜치 | 상태 |
|---|---|---|
| `awsdocs/amazon-s3-userguide` | `main` | 아카이브됨 |
| `awsdocs/amazon-ec2-user-guide` | `master` | 아카이브됨 |
| `awsdocs/amazon-ec2-user-guide-windows` | `master` | 아카이브됨 |
| `awsdocs/amazon-vpc-user-guide` | `master` | 아카이브됨 |
| `awsdocs/amazon-rds-user-guide` | `main` | 아카이브됨 |
| `awsdocs/amazon-dynamodb-developer-guide` | `main`/`master` | 아카이브됨 |
| `awsdocs/iam-user-guide` | `main` | 아카이브됨 |
| `awsdocs/aws-lambda-developer-guide` | `main` | 아카이브됨 |
| `awsdocs/aws-well-architected-framework` | — | ❌ **존재하지 않음** (404) |

파일 경로 규칙: `<repo>/<branch>/doc_source/<페이지슬러그>.md`. 슬러그는 docs.aws.amazon.com URL의 마지막 경로와 같다 (예: `.../userguide/storage-class-intro.html` → `doc_source/storage-class-intro.md`).
`api.github.com`이 막혀 있으므로 **파일 목록을 나열할 수 없다.** 슬러그를 추측해 `curl -o /dev/null -w "%{http_code}"`로 200/404를 확인하는 방식으로 탐색한다.

#### ⚠️⚠️ 치명적 주의 — 이 레포들은 2023년 6월에 아카이브되었다

모든 레포 README에 다음 문구가 있다:

> **"This repository is archived and the content on this branch is out of date."**
> "This repository will be archived and marked read-only next month (June 2023)."

**따라서 사용 규칙:**

- ✅ **써도 되는 것:** 변하지 않는 개념·정의·비교표 — 예: S3 일관성 모델, SG vs NACL 상태 저장 여부, IAM 정책 평가 순서, Multi-AZ 동기/비동기 구분.
- ❌ **쓰면 안 되는 것:** 인스턴스 타입 목록, 리전 목록, 최신 쿼터 숫자, 2023년 이후 변경된 기본값, 신규 서비스/기능.
- 🔁 아카이브 가이드에서 **숫자**를 가져올 때는 반드시 botocore 또는 WebSearch로 교차 확인한다.

---

### 5순위 — `@aws-sdk/client-*` (npm, SDK v3) : 보조 확인용

```bash
npm pack @aws-sdk/client-s3 && tar xzf aws-sdk-client-s3-*.tgz
grep -c "docs.aws.amazon.com" package/dist-types/models/models_0.d.ts   # → 505
```

**결과:** 문서 문자열을 **가지고 있다** (`dist-types/models/*.d.ts`에 JSDoc 형태). 다만 이것은 **botocore와 동일한 모델에서 생성된 파생물**이며, JSDoc 주석이라 기계 추출이 botocore JSON보다 번거롭다.

→ **botocore가 있으면 굳이 쓸 이유가 없다.** botocore에 없는 신규 서비스를 확인할 때만 보조로 사용한다.

---

### 6순위 — `WebSearch` 도구 : 날짜·발표·쿼터 교차 확인

`WebSearch`는 차단된 AWS 페이지의 **스니펫/요약을 반환**한다. 기계 판독 소스에 없는 정보 — **기능 출시일, 개명 날짜, 서비스 쿼터 페이지 수치, 시험 정보** — 확인에 필수적이다.

```
WebSearch(query="...", blocked_domains=["examtopics.com","validexamdumps.com",
  "pass4success.com","skillcertpro.com","itexams.com","examcollection.com",
  "certlibrary.com","briefmenow.org"])
```

> **🚫 절대 금지:** examtopics, validexamdumps, pass4success, skillcertpro, itexams, examcollection, certlibrary, briefmenow 및 모든 **시험 덤프(exam dump)** 사이트. 열람·인용·재현 전부 금지다. WebSearch 호출 시 위 `blocked_domains`를 **항상** 붙인다.

**규칙:** WebSearch 결과 중 `docs.aws.amazon.com` / `aws.amazon.com` 출처의 스니펫만 1차 근거로 인정한다. 서드파티 블로그는 단독 근거로 쓰지 않고, 공식 스니펫과 일치할 때만 보조로 쓴다.

---

### 참고: 확인해 본 결과 쓸 수 없었던 소스

- `awsdocs/aws-well-architected-framework` — 레포 자체가 없음(404). Well-Architected 6개 기둥은 WebSearch로만 확인 가능.
- AWS 요금/리전 JSON 엔드포인트 (`pricing.us-east-1.amazonaws.com`, `aws.amazon.com/.../region_list.json` 등) — `aws.amazon.com` / AWS 도메인 차단 대상이라 접근 불가. **요금 수치는 확인 불가** (§5 참조).
- `api.github.com` — 403. 레포 파일 목록 나열 불가.

---

## §3 어떤 사실을 어디서 확인하는가

| 사실 범주 | 1순위 소스 | 정확한 경로 / 명령 |
|---|---|---|
| **서비스 정식 명칭** | botocore `metadata` | `data/<svc>/<ver>/service-2.json.gz` → `metadata.serviceFullName` <br>⚠️ §7 개명 목록과 교차 확인 필수 |
| **API 엔드포인트 접두사 / serviceId** | botocore `metadata` | `metadata.endpointPrefix`, `metadata.serviceId` |
| **기본 동작 · 기본값** | aws-service-spec → botocore | `db.json.gz` → `entities[].properties[].documentation` ("Default: ...") <br>botocore operation/member `documentation` |
| **한도 · 쿼터 (숫자)** | botocore `documentation` **본문** | `strip(shape['documentation'])` <br>🚫 shape의 `min`/`max`를 쿼터로 쓰지 말 것 |
| **열거형 전체 목록** (스토리지 클래스, 볼륨 타입, 프로토콜 등) | botocore `shapes[].enum` | `d['shapes']['StorageClass']['enum']` |
| **S3 스토리지 클래스 최소 기간·최소 크기** | awsdocs (아카이브) + WebSearch | `amazon-s3-userguide/main/doc_source/storage-class-intro.md` 비교표 |
| **EBS 볼륨 타입 성능** | botocore `ec2` | `CreateVolumeRequest`의 `Iops`/`Throughput`/`VolumeType`/`Size` member documentation |
| **인스턴스 패밀리 / 인스턴스 타입** | botocore `ec2` | `shapes['InstanceType']['enum']` (전체 타입 목록) |
| **리전 목록 · 파티션** | botocore `endpoints.json` | `data/endpoints.json` → `partitions[].regions` (설명 포함) |
| **리전별 서비스 가용성** | cfn-lint | `cfnlint/data/schemas/providers/<region>.json` 키 존재 여부 |
| **AZ 개념 · VPC 네트워킹 개념** | awsdocs `amazon-vpc-user-guide` | `master/doc_source/VPC_Security.md` 등 |
| **IAM 정책 평가 로직** | awsdocs `iam-user-guide` | `main/doc_source/reference_policies_evaluation-logic.md` |
| **CloudFormation 속성·기본값** | aws-service-spec | `db.json.gz` → `schema.resource.entities` |
| **Lambda 런타임 지원 종료** | cfn-lint | `cfnlint/data/AdditionalSpecs/LmbdRuntimeLifecycle.json` |
| **요금 모델 (정성적)** | botocore/awsdocs documentation | "per-GB retrieval fees apply" 같은 서술만 인용 |
| **요금 (구체적 금액)** | ❌ **확인 불가** | §5 참조. **절대 금액을 쓰지 말 것** |
| **기능 출시일 · 개명 날짜** | WebSearch | 공식 What's New 페이지 스니펫 |
| **시험 정보 (SAA-C03)** | WebSearch | `docs.aws.amazon.com/aws-certification/...` 스니펫 |

---

## §4 사전 검증된 사실

아래는 **실제로 위 소스를 조회해 확인한** 사실이다. 각 항목의 출처를 그대로 신뢰하고 사용해도 된다.
표기: ✅확인됨 / ⚠️미확인

### 4.1 S3 일관성 모델

**✅확인됨 — S3는 모든 리전에서 강력한 읽기 후 쓰기 일관성(strong read-after-write consistency)을 제공한다.**

> "Amazon S3 provides strong read-after-write consistency for PUT and DELETE requests of objects in your Amazon S3 bucket **in all AWS Regions**. This behavior applies to both writes of new objects as well as PUT requests that overwrite existing objects and DELETE requests."
> — `awsdocs/amazon-s3-userguide/main/doc_source/Welcome.md`

- ✅ 신규 객체 PUT, 기존 객체 덮어쓰기 PUT, DELETE 모두 강력한 일관성
- ✅ S3 Select, ACL, 객체 태그, 객체 메타데이터(HEAD) 읽기도 강력한 일관성
- ✅ 단일 키에 대한 업데이트는 **원자적(atomic)** — 동시 GET은 이전 데이터 또는 새 데이터를 반환하며, **부분/손상 데이터는 절대 반환하지 않는다**
- ✅ LIST도 강력한 일관성: "A process writes a new object to Amazon S3 and immediately lists keys within its bucket. The new object appears in the list."
- ✅ 적용 시점: **2020년 12월** (re:Invent 2020 발표). 그 이전에는 신규 객체 PUT만 read-after-write이고 덮어쓰기/삭제는 최종적 일관성이었다.

> 💡 한국어 자료 다수가 아직 "S3는 최종적 일관성(eventual consistency)"이라고 서술한다. **명백한 오류다.**

### 4.2 S3 신규 버킷 기본값

**✅확인됨 — 퍼블릭 액세스 차단 ON**

> "you can create a new bucket with Block Public Access enabled, then separately call the DeletePublicAccessBlock API"
> "If you try to create a bucket with a public ACL, the request will fail."
> — botocore `s3` `CreateBucket` operation documentation

**✅확인됨 — ACL 비활성화 (객체 소유권 = BucketOwnerEnforced)**

> "**By default, `ObjectOwnership` is set to `BucketOwnerEnforced` and ACLs are disabled.** We recommend keeping ACLs disabled, except in uncommon use cases where you must control access for each object individually."
> — botocore `s3` `ObjectOwnership` shape documentation

- `ObjectOwnership` 열거값: `BucketOwnerPreferred`, `ObjectWriter`, `BucketOwnerEnforced` (기본값)
- ✅ `BucketOwnerEnforced` = ACL이 완전히 비활성화되고, 버킷 소유자가 모든 객체를 자동으로 소유
- ✅ 적용 시점: **2023년 4월** (전 리전 2023-04-27 완료). 출처: WebSearch / AWS What's New (2022-12 사전 공지)

**✅확인됨 — SSE-S3 기본 암호화 (AES-256)**

- ✅ 모든 신규 객체 업로드가 **SSE-S3(Amazon S3 관리형 키, AES-256)로 자동 암호화**된다
- ✅ 추가 비용 없음, 성능 영향 없음
- ✅ 적용 시점: **2023년 1월 5일**
- 출처: WebSearch — AWS What's New "Amazon S3 now automatically encrypts all new objects", `docs.aws.amazon.com/AmazonS3/latest/userguide/default-encryption-faq.html`

**⚠️ 주의:** 버킷 **버전 관리(Versioning)는 기본 비활성화**이며 이는 변경된 적이 없다.

### 4.3 S3 스토리지 클래스 전체 목록

**✅확인됨 — API 열거값 (botocore `s3` `StorageClass` shape enum), 13개:**

`STANDARD`, `REDUCED_REDUNDANCY`, `STANDARD_IA`, `ONEZONE_IA`, `INTELLIGENT_TIERING`, `GLACIER`, `DEEP_ARCHIVE`, `OUTPOSTS`, `GLACIER_IR`, `SNOW`, `EXPRESS_ONEZONE`, `FSX_OPENZFS`, `FSX_ONTAP`

> API 값 ↔ 표시 이름 매핑: `GLACIER` = S3 Glacier Flexible Retrieval, `GLACIER_IR` = S3 Glacier Instant Retrieval, `DEEP_ARCHIVE` = S3 Glacier Deep Archive, `EXPRESS_ONEZONE` = S3 Express One Zone.
> SAA 시험 대상은 주로 앞의 7개 + Express One Zone이다.

**✅확인됨 — 최소 저장 기간 · 최소 청구 객체 크기 · 내구성/가용성**
출처: `awsdocs/amazon-s3-userguide/main/doc_source/storage-class-intro.md` 비교표

| 스토리지 클래스 | 내구성 | 가용성 | AZ 수 | **최소 저장 기간** | **최소 청구 크기** |
|---|---|---|---|---|---|
| S3 Standard | 99.999999999% | 99.99% | ≥ 3 | 없음 | 없음 |
| S3 Standard-IA | 99.999999999% | 99.9% | ≥ 3 | **30일** | **128 KB** |
| S3 One Zone-IA | 99.999999999% | 99.5% | **1** | **30일** | **128 KB** |
| S3 Glacier Instant Retrieval | 99.999999999% | 99.9% | ≥ 3 | **90일** | **128 KB** |
| S3 Glacier Flexible Retrieval | 99.999999999% | 99.99% (복원 후) | ≥ 3 | **90일** | **40 KB** |
| S3 Glacier Deep Archive | 99.999999999% | 99.99% (복원 후) | ≥ 3 | **180일** | **40 KB** |
| S3 Intelligent-Tiering | 99.999999999% | 99.9% | ≥ 3 | 없음 | 없음(단 128 KB 미만은 모니터링/자동 계층화 대상 아님) |

**✅확인됨 — 수명 주기 전환 제약** (`lifecycle-transition-general-considerations.md`)
- Standard-IA / One Zone-IA로 전환하려면 **최소 30일 S3에 저장**되어 있어야 한다
- 버전 관리 버킷의 비현재 버전도 **최소 30일 비현재 상태**여야 전환 가능
- **128 KB 미만 객체는 전환되지 않는다** (Standard/Standard-IA → Intelligent-Tiering 또는 Glacier IR, Standard → Standard-IA/One Zone-IA)
- Standard-IA / One Zone-IA는 **30일 최소 저장 요금**이 부과된다

**✅확인됨 — Glacier 검색 시간**
- S3 Glacier Flexible Retrieval: 신속(Expedited) **1–5분**, 대량(Bulk) 무료 **5–12시간**
- S3 Glacier Deep Archive: 기본 검색 시간 **12시간**
- 두 클래스 모두 복원 요청은 계정당 **초당 최대 1,000 트랜잭션**
- Intelligent-Tiering: Archive Access 티어 **90일** 미접근 시 자동 이동, Deep Archive Access 티어 **180일** 미접근 시 자동 이동

> ⚠️ 위 표는 2023년 아카이브 가이드 출처다. 스토리지 클래스 최소 기간/최소 크기는 2018년 이후 변경된 적이 없어 신뢰할 만하나, **가용성 SLA 수치를 시험 문제에 쓸 때는 한 번 더 교차 확인**을 권한다.

### 4.4 EBS 볼륨 타입

**✅확인됨 — 출처: botocore `ec2` `CreateVolumeRequest` member documentation (2026-07-28 빌드)**

| 볼륨 타입 | 분류 | 크기 범위 | IOPS | 처리량 |
|---|---|---|---|---|
| `gp3` | General Purpose SSD | 1–65,536 GiB | **3,000 (기본) – 80,000** | **125 (기본) – 2,000 MiB/s** |
| `gp2` | General Purpose SSD | 1–16,384 GiB | (Iops 파라미터 미지원, 크기 비례) | — |
| `io1` | Provisioned IOPS SSD | 4–16,384 GiB | **100 – 64,000** | — |
| `io2` | Provisioned IOPS SSD | 4–65,536 GiB | **100 – 256,000** | — |
| `st1` | Throughput Optimized HDD | 125–16,384 GiB | — | — |
| `sc1` | Cold HDD | 125–16,384 GiB | — | — |
| `standard` | Magnetic (구세대) | 1–1,024 GiB | — | — |

원문:
> "Valid ranges: gp3: `3,000` (*default*) `- 80,000` IOPS / io1: `100 - 64,000` IOPS / io2: `100 - 256,000` IOPS"
> "**Instances built on the Nitro System can support up to 256,000 IOPS. Other instances can support up to 32,000 IOPS.**"
> "The throughput to provision for the volume, in MiB/s. Supported for gp3 volumes only. **Valid Range: 125 - 2000 MiB/s**"
> "Throughput Optimized HDD (`st1`) and Cold HDD (`sc1`) volumes **can't be used as boot volumes**."
> "**Default: `gp2`**" (VolumeType 미지정 시)

**🔥 중요 — 2025년 9월 변경:** gp3의 상한이 크게 올랐다. **최대 크기 16 TiB → 64 TiB, 최대 IOPS 16,000 → 80,000, 최대 처리량 1,000 → 2,000 MiB/s.**
거의 모든 한국어 SAA 자료가 아직 **"gp3 = 최대 16,000 IOPS / 1,000 MiB/s"** 로 적혀 있다. §7 참조.
(교차 확인: WebSearch — AWS What's New "Amazon EBS increases the maximum size and provisioned performance of General Purpose (gp3) volumes", 2025-09)

**⚠️미확인:** gp2의 최대 IOPS(일반적으로 16,000으로 알려짐)와 크기당 IOPS 비율(3 IOPS/GiB), st1/sc1의 기준 처리량 수치는 API 모델에 없다. **확인 전까지 쓰지 말 것.**

### 4.5 RDS Multi-AZ vs 읽기 전용 복제본

**✅확인됨 — Multi-AZ = 동기식 복제**

> "...**synchronous** standby replica in a different Availability Zone."
> "...**synchronously** replicated across Availability Zones to a standby replica to provide data redundancy and minimize latency spikes during system backups."
> — `awsdocs/amazon-rds-user-guide/main/doc_source/Concepts.MultiAZSingleStandby.md`

**✅확인됨 — 읽기 전용 복제본 = 비동기식 복제**

> "...**asynchronously** to the read replica."
> "...uses the **asynchronous** replication method for the DB engine to update the read replica whenever there is a change to the primary DB instance."
> — `awsdocs/amazon-rds-user-guide/main/doc_source/USER_ReadRepl.md`

**✅확인됨 — Multi-AZ 배포 시 AZ 지정 불가**

> "You can't set the AvailabilityZone parameter if the DB instance is a Multi-AZ deployment. This setting **doesn't apply to Amazon Aurora** because the DB instance Availability Zones (AZs) are managed by the DB cluster."
> — botocore `rds` `CreateDBInstanceMessage.MultiAZ`

**✅확인됨 — 읽기 전용 복제본 특성** (botocore `rds` `CreateDBInstanceReadReplica`)
- 지원 엔진: **Db2, MariaDB, MySQL, Oracle, PostgreSQL, SQL Server**
- **Aurora는 이 작업을 지원하지 않는다** ("Amazon Aurora doesn't support this operation") — Aurora는 `CreateDBInstance`로 클러스터에 인스턴스를 추가한다
- **RDS는 읽기 전용 복제본을 백업 비활성화 상태로 생성**한다
- 소스 DB 인스턴스/클러스터는 **백업 보존이 활성화**되어 있어야 한다
- 나머지 속성(DB 보안 그룹, 파라미터 그룹)은 소스에서 상속

**정리 (시험 포인트):**

| | Multi-AZ | 읽기 전용 복제본 |
|---|---|---|
| 복제 방식 | **동기(synchronous)** | **비동기(asynchronous)** |
| 목적 | **고가용성 / 재해 복구** | **읽기 성능 확장** |
| 엔드포인트 | 동일 엔드포인트 유지 (장애 조치 시 DNS가 대기 인스턴스로 전환) | **별도의 읽기 엔드포인트** |
| 읽기 처리 | 대기 인스턴스는 읽기 트래픽을 받지 않음 | 읽기 트래픽 처리 |
| 리전 | 동일 리전의 다른 AZ | 동일 리전 또는 **교차 리전 가능** |

> ⚠️ "Multi-AZ 대기 인스턴스에서 읽기가 가능하다"는 서술은 **표준 Multi-AZ 인스턴스 배포에서는 틀리다.** (Multi-AZ **DB 클러스터** 배포는 읽기 가능한 대기 인스턴스 2개를 갖는 별개 아키텍처다 — 혼동 주의)

### 4.6 DynamoDB 용량 모드 · LSI vs GSI

**✅확인됨 — 용량 모드** (botocore `dynamodb` `CreateTableInput.BillingMode`)

> "`PAY_PER_REQUEST` - We recommend using PAY_PER_REQUEST for most DynamoDB workloads. PAY_PER_REQUEST sets the billing mode to **On-demand capacity mode**."
> "`PROVISIONED` - We recommend using PROVISIONED for **steady workloads with predictable growth** where capacity requirements can be reliably forecasted. PROVISIONED sets the billing mode to **Provisioned capacity mode**."
> "This setting **can be changed later**."

**✅확인됨 — LSI vs GSI** (botocore `dynamodb` `CreateTableInput`)

| | LSI (로컬 보조 인덱스) | GSI (글로벌 보조 인덱스) |
|---|---|---|
| **최대 개수** | **5개** | **20개** |
| 파티션 키 | **테이블과 동일해야 함** ("The key schema must begin with the same partition key as the table") | 테이블과 다를 수 있음 |
| 크기 제약 | **파티션 키 값당 10 GB 제한** | 제한 없음 |
| 프로비저닝 | 테이블 용량 공유 | **자체 `ProvisionedThroughput`** (읽기/쓰기 용량 별도) |

원문:
> LSI: "One or more local secondary indexes (**the maximum is 5**) to be created on the table. Each index is scoped to a given partition key value. **There is a 10 GB size limit per partition key value**; otherwise, the size of a local secondary index is unconstrained."
> GSI: "One or more global secondary indexes (**the maximum is 20**) to be created on the table."

**✅확인됨 — 프로젝션 타입:** `KEYS_ONLY`, `INCLUDE`, `ALL`
- `NonKeyAttributes`의 총합은 **모든 보조 인덱스 통틀어 100개를 초과할 수 없다** (`INCLUDE`인 경우에만 적용)
- 같은 속성을 두 인덱스에 프로젝션하면 **2개로 계산**된다

**⚠️미확인:** "LSI는 테이블 생성 시에만 만들 수 있고 이후 추가/삭제 불가", "GSI는 언제든 추가/삭제 가능"은 널리 알려진 사실이나 위 API 모델 문서에서 **직접 인용할 문장을 찾지 못했다.** 사용하려면 별도 확인 필요.

### 4.7 Lambda 한도

**✅확인됨 — 실행 시간**

> "The amount of time (in seconds) that Lambda allows a function to run before stopping it. **The default is 3 seconds. The maximum allowed value is 900 seconds.**"
> — botocore `lambda` `CreateFunctionRequest.Timeout`

- ✅ 기본 **3초**, 최대 **900초 (15분)**
- 🔴 **함정:** 같은 모델의 `Timeout` shape는 `max: 5400`이다. **이것은 서비스 쿼터가 아니다.** documentation 본문의 900초가 정답이다. (WebSearch 교차 확인 완료 — `docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html`)

**✅확인됨 — 메모리**

> "The amount of memory available to the function at runtime. **Increasing the function memory also increases its CPU allocation.** The **default value is 128 MB.** The value can be any multiple of 1 MB."
> — botocore `lambda` `CreateFunctionRequest.MemorySize`

- ✅ 기본 **128 MB**, 최소 **128 MB**, 최대 **10,240 MB (10 GB)**, **1 MB 단위** 증가
- ✅ **메모리를 늘리면 CPU 할당도 함께 증가** (시험 단골)
- 🔴 **함정:** `MemorySize` shape의 `max: 32768`은 쿼터가 아니다. 실제 상한은 10,240 MB. (WebSearch 교차 확인 완료)

**✅확인됨 — 임시 스토리지(`/tmp`):** `EphemeralStorageSize` shape `min: 512`, `max: 10240` → **512 MB – 10,240 MB** (shape 경계와 실제 쿼터가 일치하는 경우)

**✅확인됨 — 페이로드 크기: 동기 호출 6 MB**
출처: WebSearch — `docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html`

**⚠️미확인:** 비동기 호출 페이로드 상한(일반적으로 256 KB로 알려짐), 배포 패키지 크기 상한(zip 50 MB / 압축 해제 250 MB로 알려짐)은 이번에 직접 확인하지 못했다. **쓰기 전 확인 필요.**

### 4.8 SQS 표준 vs FIFO

**✅확인됨 — 큐 타입** (botocore `sqs` `CreateQueue`)

> "**If you don't specify the `FifoQueue` attribute, Amazon SQS creates a standard queue.** You can't change the queue type after you create it and **you can't convert an existing standard queue into a FIFO queue.**"

- ✅ 기본은 **표준 큐**
- ✅ 큐 타입은 생성 후 **변경 불가** — FIFO가 필요하면 새로 만들어야 한다
- ✅ 큐 삭제 후 **같은 이름으로 재생성하려면 최소 60초 대기**

**✅확인됨 — 공통 큐 속성** (botocore `sqs` `CreateQueueRequest.Attributes`)

| 속성 | 범위 | 기본값 |
|---|---|---|
| `DelaySeconds` (지연 큐) | 0 – 900초 (15분) | **0** |
| `MaximumMessageSize` | 1,024 B (1 KiB) – 1,048,576 B (**1 MiB**) | **1 MiB** |
| `MessageRetentionPeriod` | 60초 (1분) – 1,209,600초 (**14일**) | **345,600초 (4일)** |
| `VisibilityTimeout` | 0초 – **12시간** | **30초** |

> 가시성 제한 시간 원문: "**The default visibility timeout for a message is 30 seconds. The minimum is 0 seconds. The maximum is 12 hours.**" — `ChangeMessageVisibility` operation documentation

**✅확인됨 — 순서 보장 / MessageGroupId** (botocore `sqs` `SendMessageRequest.MessageGroupId`)

> "In FIFO queues, `MessageGroupId` organizes messages into distinct groups. **Messages within the same message group are always processed one at a time, in strict order**, ensuring that no two messages from the same group are processed simultaneously."
> "Messages that belong to the same message group are processed in a FIFO manner (**however, messages in different message groups might be processed out of order**)."
> "**If you do not provide a `MessageGroupId` when sending a message to a FIFO queue, the action fails.**"

**✅확인됨 — 처리량** (출처: WebSearch — `docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/high-throughput-fifo.html`)
- FIFO 기본: **배치 없이 초당 300개**, **배치 사용 시 초당 3,000개** (배치는 최대 10개 메시지 / 256 KB)
- FIFO 고처리량 모드: 훨씬 높음 (배치 없이 초당 수만 건 규모). **정확한 수치는 리전마다 다르므로 §5 참조 — 구체적 숫자를 쓰지 말 것**
- 표준 큐: **거의 무제한(nearly unlimited) 처리량** — 정성적으로만 서술할 것

**정리 (시험 포인트):**

| | 표준 큐 | FIFO 큐 |
|---|---|---|
| 처리량 | 거의 무제한 | 300/초 (배치 시 3,000/초), 고처리량 모드로 확장 가능 |
| 순서 | **최선 노력(best-effort)** — 순서 보장 없음 | **메시지 그룹 내 엄격한 순서 보장** |
| 중복 | **최소 1회 전달** — 중복 발생 가능 | **정확히 1회 처리** — 중복 제거 |

> ⚠️ 표준 큐의 "at-least-once delivery / 중복 가능" 과 FIFO의 "exactly-once processing"은 정설이나, 이번에 API 모델에서 직접 인용 문장을 확보하지 못했다. 인용이 필요하면 재확인할 것.

### 4.9 ELB 3종

**✅확인됨 — 로드 밸런서 타입** (botocore `elbv2` `LoadBalancerTypeEnum`)

```
enum: ["application", "network", "gateway"]
```

**✅확인됨 — 지원 프로토콜** (botocore `elbv2` `ProtocolEnum`)

```
enum: ["HTTP", "HTTPS", "TCP", "TLS", "UDP", "TCP_UDP", "GENEVE", "QUIC", "TCP_QUIC"]
```

| 로드 밸런서 | API 값 | 계층 | 프로토콜 |
|---|---|---|---|
| **ALB** (Application Load Balancer) | `application` | **L7 (애플리케이션)** | HTTP, HTTPS |
| **NLB** (Network Load Balancer) | `network` | **L4 (전송)** | TCP, TLS, UDP, TCP_UDP, QUIC, TCP_QUIC |
| **GWLB** (Gateway Load Balancer) | `gateway` | **L3/L4 (게이트웨이)** | **GENEVE** (포트 6081) |

> ✅ `GENEVE`가 열거형에 존재하는 것이 GWLB의 결정적 식별자다. GWLB는 서드파티 가상 어플라이언스(방화벽·IDS/IPS) 배포에 쓰인다.
> ⚠️ CLB(Classic Load Balancer)는 별개의 구세대 API(`elb`, ELBv1)이며 `elbv2` 열거형에 없다. 현재 SAA 출제 비중은 낮다.

### 4.10 Route 53 라우팅 정책

**✅확인됨 — `ResourceRecordSet` shape의 멤버로 확인한 전체 목록** (botocore `route53`)

멤버 목록: `Name`, `Type`, `SetIdentifier`, `Weight`, `Region`, `GeoLocation`, `Failover`, `MultiValueAnswer`, `TTL`, `ResourceRecords`, `AliasTarget`, `HealthCheckId`, `TrafficPolicyInstanceId`, `CidrRoutingConfig`, `GeoProximityLocation`

| 라우팅 정책 | 식별 멤버 | 설명 (API 문서 발췌) |
|---|---|---|
| **단순(Simple)** | (없음) | 기본. `SetIdentifier` 불필요 |
| **가중치 기반(Weighted)** | `Weight` | "a value that determines the proportion of DNS queries that Route 53 responds to using the current resource record set" |
| **지연 시간 기반(Latency)** | `Region` | "The Amazon EC2 Region where you created the resource that this resource record set refers to" |
| **장애 조치(Failover)** | `Failover` | "you specify `PRIMARY` ... for the other resource record set, you specify `SECONDARY`" + `HealthCheckId` 필요 |
| **지리 위치(Geolocation)** | `GeoLocation` | "control how Route 53 responds to DNS queries based on the **geographic origin of the query**" (ContinentCode 등) |
| **지리 근접(Geoproximity)** | `GeoProximityLocation` | "based on the geographic origin of the query **and your resources**" (bias 조정 가능) |
| **다중값 응답(Multivalue answer)** | `MultiValueAnswer` | "route traffic **approximately randomly** to multiple resources ... create one multivalue answer record for each resource" |
| **IP 기반(IP-based)** | `CidrRoutingConfig` | CIDR 컬렉션 기반 라우팅 |

> ✅ **총 8가지**. 한국어 자료 상당수가 Geoproximity와 IP 기반을 누락해 "6가지" 또는 "7가지"로 서술한다.
> ✅ **단순 라우팅을 제외한 모든 정책은 `SetIdentifier`가 필수**다: "Resource record sets that have a routing policy other than simple: An identifier that differentiates among multiple resource record sets that have the same combination of name and type ... the value of `SetIdentifier` must be unique for each [record]."

### 4.11 VPC — 보안 그룹 vs 네트워크 ACL

**✅확인됨 — 출처: `awsdocs/amazon-vpc-user-guide/master/doc_source/VPC_Security.md` 공식 비교표 (원문 그대로)**

| 보안 그룹 (Security Group) | 네트워크 ACL (Network ACL) |
|---|---|
| **인스턴스 수준**에서 동작 | **서브넷 수준**에서 동작 |
| 인스턴스에 연결된 경우에만 적용 | **연결된 서브넷의 모든 인스턴스에 적용** (보안 그룹 규칙이 너무 관대할 때 추가 방어 계층 제공) |
| **허용(allow) 규칙만 지원** | **허용(allow) 및 거부(deny) 규칙 모두 지원** |
| 트래픽 허용 여부 결정 시 **모든 규칙을 평가** | **가장 낮은 번호 규칙부터 순서대로 평가** |
| **상태 저장(Stateful):** 규칙과 무관하게 반환 트래픽이 허용됨 | **상태 비저장(Stateless):** 반환 트래픽을 규칙으로 명시적으로 허용해야 함 |

**✅확인됨 — 기본 보안 그룹** (botocore `ec2` `CreateSecurityGroup`)

> "You have a default security group for use in your VPC. **If you don't specify a security group when you launch an instance, the instance is launched into the appropriate default security group.** A default security group includes a default rule that **grants instances unrestricted network access to each other**."

**✅확인됨 — NAT Gateway** (botocore `ec2` `CreateNatGateway`)

> "This action creates a **network interface in the specified subnet with a private IP address** from the IP address range of the subnet. You can create either a **public NAT gateway** or a **private NAT gateway**."
> - **퍼블릭 NAT 게이트웨이:** "internet-bound traffic from a private subnet can be routed to the NAT gateway, so that instances in a private subnet can connect to the internet"
> - **프라이빗 NAT 게이트웨이:** "private communication is routed across VPCs and on-premises networks through a **transit gateway or virtual private gateway**"
> - 퍼블릭 NAT 게이트웨이에 EIP 할당 시 "the network border group of the EIPs **must match** the network border group of the Availability Zone (AZ) that the public NAT gateway is in"

**NAT Gateway vs NAT Instance:**

| | NAT Gateway | NAT Instance |
|---|---|---|
| 관리 주체 | **AWS 완전 관리형** | **사용자가 직접 관리하는 EC2 인스턴스** |
| 가용성 | AZ 내에서 AWS가 관리 (다중 AZ는 AZ별로 생성) | 사용자가 직접 HA 구성 필요 |
| 보안 그룹 | **연결 불가** (NAT 게이트웨이는 SG를 갖지 않음) | 연결 가능 |
| 배스천 호스트 용도 | 불가 | 가능 |
| 포트 포워딩 | 불가 | 가능 |

> ⚠️ 위 NAT Gateway vs NAT Instance 비교표 중 **"NAT Gateway는 보안 그룹을 연결할 수 없다"** 및 대역폭 수치(일반적으로 최대 45/100 Gbps로 알려짐)는 이번에 공식 소스에서 직접 인용 문장을 확보하지 못했다. 대역폭 숫자는 **쓰지 말 것** (§5).

### 4.12 IAM 정책 평가 순서

**✅확인됨 — 출처: `awsdocs/iam-user-guide/main/doc_source/reference_policies_evaluation-logic.md` (원문 인용)**

> - "**By default, all requests are implicitly denied** with the exception of the AWS account root user, which has full access."
> - "**An explicit allow** in an identity-based or resource-based policy **overrides this default.**"
> - "If a permissions boundary, Organizations SCP, or session policy is present, **it might override the allow with an implicit deny.**"
> - "**An explicit deny in any policy overrides any allows.**"

**✅확인됨 — 평가 순서 (원문 단계별)**

1. **거부 평가(Deny evaluation)** — "By default, all requests are denied. This is called an **implicit deny**. The AWS enforcement code evaluates all policies within the account that apply to the request. These include AWS Organizations SCPs, resource-based policies, identity-based policies, IAM permissions boundaries, and session policies. In all those policies, the enforcement code looks for a `Deny` statement... **If the enforcement code finds even one explicit deny that applies, the code returns a final decision of Deny.**"
2. **Organizations SCP** — "If the enforcement code does not find any applicable `Allow` statements in the SCPs, **the request is explicitly denied**, even if the denial is implicit."
3. (이후 리소스 기반 정책 → 자격 증명 기반 정책 → 권한 경계 → 세션 정책 순으로 평가)

**따라서 우선순위: 명시적 거부(explicit Deny) > 명시적 허용(explicit Allow) > 암묵적 거부(implicit Deny, 기본값)**

**✅확인됨 — 정책 유형별 결합 규칙**

| 조합 | 결과 |
|---|---|
| 자격 증명 기반 + 리소스 기반 (동일 계정) | **합집합(union)** — "If an action is allowed by an identity-based policy, a resource-based policy, **or both**, then AWS allows the action." |
| 자격 증명 기반 + **권한 경계** | **교집합(intersection)** — "the resulting permissions are the **intersection** of the two categories" |
| 자격 증명 기반 + **SCP** | **교집합(intersection)** — "the resulting permissions are the **intersection** of the user's policies and the SCP. This means that an action must be allowed by **both**" |
| 자격 증명 기반 + **세션 정책** | **교집합** — "the resulting session's permissions are the **intersection** of the IAM entity's identity-based policy and the session policies" |
| 권한 경계 + SCP + 자격 증명 기반 모두 존재 | **셋 다 허용해야 함** — "then the boundary, the SCP, and the identity-based policy **must all allow** the action" |

**✅확인됨 — SCP 동작**

> "Organizations SCPs specify the **maximum permissions** for an organization or organizational unit (OU). The SCP maximum applies to principals in member accounts, **including each AWS account root user**."

- ✅ SCP는 **권한을 부여하지 않는다** — 최대 권한의 **상한(guardrail)** 만 설정한다
- ✅ SCP는 **멤버 계정의 루트 사용자에게도 적용**된다 (시험 단골)
- ✅ "Remember, an explicit deny in any of these policies overrides the allow."

### 4.13 리전 / 파티션

**✅확인됨 — 출처: botocore `data/endpoints.json` (2026-07-28)**

| 파티션 | 이름 | 리전 수 |
|---|---|---|
| `aws` | AWS Standard | **34** |
| `aws-cn` | AWS China | 2 |
| `aws-us-gov` | AWS GovCloud (US) | 2 |
| `aws-iso` | AWS ISO (US) | 2 |
| `aws-iso-b` | AWS ISOB (US) | 2 |
| `aws-iso-e` | AWS ISOE (Europe) | 1 |
| `aws-iso-f` | AWS ISOF | 2 |
| `aws-eusc` | AWS EUSC (European Sovereign Cloud) | 1 |

- ✅ 서울 리전 코드: **`ap-northeast-2`** — "Asia Pacific (Seoul)"
- ✅ 리전 코드 ↔ 표시 이름 전체 매핑은 `endpoints.json`의 `partitions[].regions[].description`에서 조회
- ⚠️ **주의:** `endpoints.json`의 리전 수는 "SDK가 엔드포인트를 아는 리전"이며, AWS가 마케팅상 발표하는 "리전 개수"와 정확히 일치하지 않을 수 있다. **"AWS는 총 N개 리전을 운영한다" 같은 문장은 쓰지 말 것.**

**✅확인됨 — S3 버킷 네임스페이스** (botocore `s3` `CreateBucket`)

> "General purpose buckets exist in a **global namespace**, which means that each bucket name must be **unique across all AWS accounts in all the AWS Regions within a partition**."
> "AWS currently has four partitions: `aws` (Standard Regions), `aws-cn` (China Regions), `aws-us-gov` (GovCloud (US)), and `aws-eusc` (European Sovereign Cloud)."

> ⚠️ 위 인용문은 "four partitions"라고 하지만 `endpoints.json`에는 ISO 계열을 포함해 **8개 파티션**이 있다. 문서 문구는 상용 파티션만 센 것이다. **"파티션은 4개"라고 단정하지 말 것.**

### 4.14 시험 정보 (SAA-C03)

**✅확인됨 — 출처: WebSearch (`docs.aws.amazon.com/aws-certification/latest/solutions-architect-associate-03/`)**

- ✅ 문항 수: **65문항** (채점 대상 50 + 채점 제외 15)
- ✅ 시험 시간: **130분**
- ✅ 합격 점수: **720점** (100–1,000 척도 점수)
- ✅ 채점 방식: **보상 채점 모델(compensatory scoring)** — 도메인별 합격선 없이 전체 점수만 통과하면 된다
- ✅ 도메인 배점:

| 도메인 | 비중 |
|---|---|
| 1. 보안 아키텍처 설계 (Design Secure Architectures) | **30%** |
| 2. 복원력 있는 아키텍처 설계 (Design Resilient Architectures) | **26%** |
| 3. 고성능 아키텍처 설계 (Design High-Performing Architectures) | **24%** |
| 4. 비용 최적화 아키텍처 설계 (Design Cost-Optimized Architectures) | **20%** |

⚠️미확인: 응시료, 재응시 대기 기간, 자격 유효 기간(일반적으로 3년으로 알려짐)은 확인하지 않았다.

---

### 4.15 검증 요약

| 항목 | 상태 |
|---|---|
| S3 강력한 읽기 후 쓰기 일관성 | ✅확인됨 |
| S3 신규 버킷 기본값 3종 (BPA / ACL 비활성 / SSE-S3) | ✅확인됨 |
| S3 스토리지 클래스 목록 + 최소 기간·크기 | ✅확인됨 |
| EBS 볼륨 타입 IOPS·처리량·크기 | ✅확인됨 (gp2 최대 IOPS만 ⚠️) |
| RDS Multi-AZ vs 읽기 전용 복제본 | ✅확인됨 |
| DynamoDB 용량 모드 / LSI vs GSI | ✅확인됨 (LSI 생성 시점 제약만 ⚠️) |
| Lambda 실행 시간·메모리·페이로드 | ✅확인됨 (비동기 페이로드·패키지 크기 ⚠️) |
| SQS 표준 vs FIFO | ✅확인됨 (고처리량 정확 수치 ⚠️) |
| ELB 3종 계층·프로토콜 | ✅확인됨 |
| Route 53 라우팅 정책 8종 | ✅확인됨 |
| VPC SG vs NACL | ✅확인됨 |
| NAT Gateway vs NAT Instance | ✅부분 확인 (대역폭 수치 ⚠️) |
| IAM 정책 평가 순서 · SCP | ✅확인됨 |
| 리전·파티션 | ✅확인됨 |
| SAA-C03 시험 정보 | ✅확인됨 (응시료·유효기간 ⚠️) |

---

## §5 "쓰지 말 것" 목록 — 검증하지 못한 사실

아래 항목은 이번 검증에서 **권위 있는 1차 소스로 확인하지 못했다.**
**추측하지 말고, 해당 서술을 생략하거나, 별도로 검증한 뒤에 추가한다.**

### 🚫 요금 관련 — 전면 금지

- **모든 구체적 금액** (GB당 USD, 시간당 USD, 요청 100만 건당 USD 등)
  → AWS 요금 API와 요금 페이지가 전부 차단되어 있다. **금액은 어떤 것도 확인 불가.**
  → 요금은 리전·시점에 따라 변하므로 애초에 학습 콘텐츠에 하드코딩할 값이 아니다.
  → ✅ 허용되는 서술: "S3 Standard-IA는 GB당 저장 비용이 S3 Standard보다 저렴하지만 검색 요금(retrieval fee)이 부과된다" (정성적·API 문서에서 확인 가능)
  → ❌ 금지되는 서술: "S3 Standard는 GB당 월 $0.023이다"
- 무료 티어(Free Tier) 한도 수치
- 예약 인스턴스 / Savings Plans 할인율 (일반적으로 최대 72% 등으로 알려진 수치 포함)
- 스팟 인스턴스 할인율

### 🚫 확인 못 한 숫자

| 항목 | 비고 |
|---|---|
| gp2 최대 IOPS, GiB당 IOPS 비율 | API 모델에 없음. gp2는 `Iops` 파라미터를 받지 않는다 |
| st1 / sc1 기준 처리량·버스트 처리량 | API 모델에 없음 |
| EBS 볼륨 최대 IOPS 중 인스턴스 측 제한 상세 | Nitro 256,000 / 그 외 32,000만 확인됨 |
| Lambda 비동기 호출 페이로드 상한 | 동기 6 MB만 확인됨 |
| Lambda 배포 패키지 크기 상한 (zip / 압축 해제) | 미확인 |
| Lambda 기본 동시 실행 한도 | 미확인 |
| SQS FIFO 고처리량 모드 정확한 초당 메시지 수 | 리전별로 다름. "표준 300/초, 배치 3,000/초"만 확정 |
| SQS 인플라이트 메시지 상한 | API 문서에 "There is a limit"라고만 나옴 |
| NAT Gateway 대역폭 상한 | 미확인 |
| VPC당 서브넷 수, 계정당 VPC 수 등 VPC 쿼터 | 미확인 (API 문서가 "Amazon VPC Limits" 페이지로 링크만 함) |
| 계정당 S3 버킷 수 상한 | 미확인 |
| CloudFront 엣지 로케이션 개수 | 미확인 (수시로 변함 — 애초에 쓰지 말 것) |
| AWS 총 리전/AZ 개수 | `endpoints.json`은 SDK가 아는 리전만 센다. 마케팅 수치와 다를 수 있음 |
| ~~SAA-C03 응시료, 자격 유효 기간, 재응시 정책~~ | **별도 검증 완료 — `PLAN.md` §0 참조** (아래 참고) |

> **참고 — 시험 정보는 이 문서의 검증 범위 밖이다.**
> 응시료·문항 수·시간·합격 점수·유효 기간 등 시험 운영 정보는 AWS **서비스** API 모델에
> 존재하지 않으므로 여기서는 확인할 수 없다. 이 값들은 별도 조사로 AWS 공식 자격증 페이지와
> 시험 가이드를 근거로 확인했고 **`PLAN.md` §0 "시험 기준" 표가 정본**이다.
> 콘텐츠 에이전트는 시험 정보를 `PLAN.md` §0 에서 가져오고, 이 문서에서 "미확인"이라는
> 이유로 생략하지 않는다.
>
> 단 **원화 응시료는 여전히 쓰지 않는다.** AWS가 매년 4월 현지 통화 가격을 갱신하므로
> `USD 150` 만 표기하고 "원화는 결제 시점 환율에 따라 다름"을 병기한다.
| Aurora 복제본 최대 개수, Aurora 스토리지 최대 크기 | 미확인 |
| EFS / FSx 성능 모드별 처리량 수치 | 미확인 |
| Well-Architected Framework 6개 기둥 이름 | `awsdocs` 레포 없음. WebSearch로 별도 확인 필요 |

### 🚫 확인 못 한 서술

- "LSI는 테이블 생성 시에만 생성 가능하고 이후 추가·삭제 불가" / "GSI는 언제든 추가·삭제 가능" (§4.6)
- SQS 표준 큐 "최소 1회 전달(at-least-once)" / FIFO "정확히 1회 처리(exactly-once)" 직접 인용문 (§4.8)
- "NAT Gateway에는 보안 그룹을 연결할 수 없다" (§4.11)
- S3 스토리지 클래스 가용성 SLA 수치 (2023년 아카이브 출처 — 교차 확인 권장)

---

## §6 refs URL 정책

### 원칙: **인용(citation)과 검증(verification)은 분리한다**

| | 검증 (verification) | 인용 (citation) |
|---|---|---|
| **대상** | 콘텐츠 작성자(=에이전트) | 콘텐츠 독자(=학습자) |
| **소스** | botocore / cfn-lint / aws-service-spec / awsdocs raw / WebSearch | **`docs.aws.amazon.com` URL** |
| **이유** | 우리는 웹사이트에 접근할 수 없지만 생성 원본에는 접근할 수 있다 | 독자는 프록시 뒤에 있지 않다. 공식 문서를 열 수 있고, 열어야 한다 |

### ✅ 해야 할 것

문제·해설의 `refs` 필드에는 **`https://docs.aws.amazon.com/...` 정규 URL만** 쓴다.

`refs`의 각 항목은 **문자열이 아니라 `{ title, url }` 객체**다.
`tools/validate.mjs`가 `refs[i].url` 누락을 오류로, `refs[i].title` 누락을 경고로 잡는다.
정식 스키마는 `docs/QUESTION_SCHEMA.md`가 정본이며, 여기 예시는 그것과 일치해야 한다.

```json
{
  "refs": [
    { "title": "Amazon S3 — 스토리지 클래스 사용",
      "url": "https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html" },
    { "title": "Amazon EBS — 볼륨 유형",
      "url": "https://docs.aws.amazon.com/ebs/latest/userguide/ebs-volume-types.html" }
  ]
}
```

`title`은 독자가 링크를 열기 전에 무엇인지 알 수 있어야 하므로 문서 제목을 그대로 쓴다.
`refs`는 최소 1개가 필요하며, 허용 호스트는 `docs.aws.amazon.com` · `aws.amazon.com` ·
`awscli.amazonaws.com` 이다 (`validate.mjs`의 `REF_HOSTS`).

### ❌ 하지 말 것

`refs`에 아래를 쓰지 않는다:

- ❌ `https://raw.githubusercontent.com/awsdocs/...` — 아카이브된 레포다. 독자에게 **오래된 내용**을 안내하게 된다
- ❌ `botocore/data/s3/2006-03-01/service-2.json.gz` — 독자가 열 수 없는 로컬 파일 경로
- ❌ `npm:@aws-cdk/aws-service-spec` 같은 패키지 참조
- ❌ 서드파티 블로그·요약 사이트
- ❌ **모든 시험 덤프 사이트** (§2 금지 목록)

### URL 구성 방법

`awsdocs` 레포에서 검증했다면, 파일 경로가 그대로 공식 URL로 매핑된다:

```
awsdocs/amazon-s3-userguide/main/doc_source/storage-class-intro.md
  → https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html
```

각 레포 README가 대응하는 공식 문서 베이스 URL을 명시한다 (검증 완료):

| 레포 | 공식 베이스 URL |
|---|---|
| `amazon-s3-userguide` | `https://docs.aws.amazon.com/AmazonS3/latest/userguide` |
| `amazon-ec2-user-guide` | `https://docs.aws.amazon.com/AWSEC2/latest/UserGuide` |
| `amazon-dynamodb-developer-guide` | `https://docs.aws.amazon.com/amazondynamodb/latest/developerguide` |
| `amazon-vpc-user-guide` | `https://docs.aws.amazon.com/vpc/latest/userguide` |
| `amazon-rds-user-guide` | `https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide` |
| `iam-user-guide` | `https://docs.aws.amazon.com/IAM/latest/UserGuide` |
| `aws-lambda-developer-guide` | `https://docs.aws.amazon.com/lambda/latest/dg` |

botocore로 검증했다면 해당 서비스의 **API 레퍼런스** URL을 인용한다:

```
https://docs.aws.amazon.com/AWSEC2/latest/APIReference/API_CreateVolume.html
https://docs.aws.amazon.com/AmazonS3/latest/API/API_CreateBucket.html
```

또한 `documentation` 문자열 안에 이미 `<a href="https://docs.aws.amazon.com/...">` 링크가 들어 있는 경우가 많다. **그 URL을 그대로 인용하는 것이 가장 안전하다** (AWS가 직접 적어둔 것이므로).

```python
import re
re.findall(r'https://docs\.aws\.amazon\.com/[^"\s<]+', doc_html)
```

### ⚠️ URL을 지어내지 말 것

URL을 검증할 수 없으므로(`docs.aws.amazon.com` 차단), **추측한 슬러그로 URL을 만들지 않는다.**
쓸 수 있는 URL은 다음 셋 중 하나에서 온 것이어야 한다:
1. `awsdocs` 레포에서 200으로 존재를 확인한 파일 경로를 매핑한 것
2. `documentation` 문자열 안에 AWS가 직접 박아둔 링크
3. WebSearch 결과에 실제로 나타난 `docs.aws.amazon.com` URL

---

## §7 오래된 정보 주의 목록

2022년 이후 AWS의 기본값·명칭·수치가 바뀌었으나 **한국어 학습 자료 대부분이 아직 갱신되지 않은** 항목이다.
콘텐츠 작성 시 아래를 **적극적으로 교정**하고, 기존 문항을 검토할 때 아래에 해당하면 수정한다.

| # | 항목 | ❌ 오래된 서술 | ✅ 현재 사실 | 변경 시점 | 검증 |
|---|---|---|---|---|---|
| 1 | **S3 일관성** | "S3는 최종적 일관성(eventual consistency)", "신규 객체만 read-after-write" | **모든 리전에서 모든 객체 작업이 강력한 일관성** | 2020-12 | ✅ awsdocs S3 가이드 |
| 2 | **S3 신규 버킷 퍼블릭 액세스** | "기본적으로 퍼블릭 액세스 차단이 꺼져 있다" | **기본 ON** | **2023-04** (전 리전 2023-04-27) | ✅ botocore + WebSearch |
| 3 | **S3 ACL** | "버킷 ACL로 권한을 관리한다" | **기본적으로 ACL 비활성화** (`ObjectOwnership=BucketOwnerEnforced`). 버킷 정책 사용 권장 | **2023-04** | ✅ botocore |
| 4 | **S3 기본 암호화** | "기본적으로 암호화되지 않는다", "SSE-S3를 직접 활성화해야 한다" | **모든 신규 객체가 SSE-S3(AES-256)로 자동 암호화** | **2023-01-05** | ✅ WebSearch |
| 5 | **EBS gp3 성능** 🔥 | "gp3 최대 16,000 IOPS / 1,000 MiB/s / 16 TiB" | **최대 80,000 IOPS / 2,000 MiB/s / 64 TiB** (기준값 3,000 IOPS / 125 MiB/s는 동일) | **2025-09** | ✅ botocore + WebSearch |
| 6 | **EBS io2 성능** | "io2 최대 64,000 IOPS" | **최대 256,000 IOPS** (io2 Block Express), 최대 64 TiB | — | ✅ botocore |
| 7 | **IMDSv2** | "인스턴스 메타데이터는 IMDSv1로 접근" | **계정 수준에서 IMDSv2를 신규 시작 기본값으로 설정 가능**(2024-03). **2024년 중반 이후 출시된 신규 인스턴스 타입은 IMDSv2 전용** | **2024-03 ~** | ✅ WebSearch |
| 8 | **AWS SSO** | "AWS Single Sign-On (AWS SSO)" | **AWS IAM Identity Center** | **2022-07-26** | ✅ WebSearch. ⚠️ botocore `sso-admin`의 `serviceFullName`은 아직 "AWS Single Sign-On Admin" — API 모델은 갱신되지 않았다 |
| 9 | **Elasticsearch Service** | "Amazon Elasticsearch Service" | **Amazon OpenSearch Service** | **2021-09-08** | ✅ botocore (`opensearch` → "Amazon OpenSearch Service"; 구 `es` → "Amazon Elasticsearch Service"가 별도로 남아 있음) + WebSearch |
| 10 | **EC2-Classic** | "EC2-Classic과 VPC 중 선택" | **완전히 폐지됨.** 모든 EC2는 VPC에서 실행된다 | 마이그레이션 기한 **2022-08-15**, 완료 **2023-08** | ✅ WebSearch |
| 11 | **Aurora Serverless v1** | "Aurora Serverless(v1)는 0으로 스케일 다운된다" | **지원 종료.** 2025-01-08부터 신규 생성 불가, **2025-03-31 EOL**. Aurora Serverless **v2**로 대체 | **2025-03-31** | ✅ WebSearch |
| 12 | **ECS 정식 명칭** | (혼동) | **Amazon Elastic Container Service** | — | ⚠️ botocore `ecs`의 `serviceFullName`은 아직 옛 이름 **"Amazon EC2 Container Service"**. **API 모델을 그대로 믿지 말 것** |
| 13 | **S3 Glacier 클래스 명칭** | "S3 Glacier", "S3 Glacier Deep Archive" 2종 | **3종:** Glacier **Instant Retrieval** / Glacier **Flexible Retrieval**(구 "S3 Glacier") / Glacier **Deep Archive** | 2021-11 | ✅ botocore enum + awsdocs |
| 14 | **DynamoDB 용량 모드 명칭** | "온디맨드 / 프로비저닝됨" 권장 기준 없음 | AWS가 **"대부분의 워크로드에 PAY_PER_REQUEST(온디맨드) 권장"** 으로 문서를 갱신함 | — | ✅ botocore |
| 15 | **Route 53 라우팅 정책 개수** | "6가지" 또는 "7가지" | **8가지** (지리 근접, IP 기반 포함) | — | ✅ botocore |
| 16 | **S3 스토리지 클래스 개수** | "6가지" | API enum 기준 **13개 값** (Express One Zone, FSx 연동 클래스 등 포함) | — | ✅ botocore enum |

### 검토 체크리스트

기존 문항이나 설명을 볼 때 아래 문자열이 보이면 **즉시 §7 대조**:

```
"최종적 일관성" / "eventual consistency"   → #1
"퍼블릭 액세스 차단을 활성화해야"           → #2
"버킷 ACL을 설정"                          → #3
"기본 암호화를 켜야"                        → #4
"16,000 IOPS" / "gp3" 와 함께 등장하는 수치 → #5
"IMDSv1"                                   → #7
"AWS SSO" / "Single Sign-On"               → #8
"Elasticsearch Service"                    → #9
"EC2-Classic"                              → #10
"Aurora Serverless" (v 표기 없음)           → #11
"S3 Glacier" (단독, 하위 구분 없이)          → #13
```

---

## 부록: 작업 절차 요약

```bash
SCRATCH=/tmp/claude-0/-home-user/.../scratchpad   # 세션 스크래치패드
cd "$SCRATCH"

# 1) botocore (1순위)
pip download botocore --no-deps -d ./bc && unzip -q ./bc/botocore-*.whl -d ./bcx

# 2) CloudFormation 속성 문서
npm pack @aws-cdk/aws-service-spec && tar xzf aws-cdk-aws-service-spec-*.tgz

# 3) 리전별 가용성
pip download cfn-lint --no-deps -d ./cl && unzip -q ./cl/cfn_lint-*.whl -d ./clx

# 4) 개념·비교표 (아카이브 주의)
curl -s "https://raw.githubusercontent.com/awsdocs/<repo>/<branch>/doc_source/<slug>.md"

# 5) 날짜·쿼터 교차 확인
# WebSearch(query=..., blocked_domains=[덤프 사이트 8종])
```

**작성 규칙 3줄 요약:**

1. **검증하지 않은 숫자는 절대 쓰지 않는다.** 확인 못 했으면 그 문장을 통째로 뺀다.
2. **검증은 botocore/npm/raw.githubusercontent로, 인용은 `docs.aws.amazon.com` URL로.**
3. **시험 덤프 사이트는 열람조차 금지.**
