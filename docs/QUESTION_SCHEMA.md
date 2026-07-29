# 문제은행 JSON 스키마 (QUESTION_SCHEMA)

> `data/questions/*.json` 의 **계약서**다. 문제를 만드는 모든 에이전트(B1–B5)와
> 검증하는 에이전트(C2·C3)가 이 문서를 동일하게 읽어야 한다.

## 0. 권위 관계 — 이 문서보다 검증기가 우선한다

| | 역할 |
|---|---|
| **`tools/validate.mjs` 의 `checkQuestions()`** | **최종 권위.** 실제로 통과/실패를 결정한다 |
| 이 문서 | 그 규칙을 사람이 읽을 수 있게 옮긴 것 + 검증기가 잡지 못하는 품질 기준 |
| `PLAN.md` §3 | 규모·유형 정책의 근거 |
| `docs/FACT_SOURCES.md` | 사실 확인 경로와 `refs` URL 정책 |

문서와 검증기가 어긋나면 **검증기가 맞다.** 다만 §12에 검증기 자체의 알려진 문제 2건을 적어 두었다.

실행:

```bash
node tools/validate.mjs --questions          # 문제 JSON만
node tools/validate.mjs --all --strict       # Wave 3 기준
```

출력 형식은 `path:line  [ERROR|WARN]  메시지` 이며, **ERROR 가 1건이라도 있으면 종료 코드 1**이다.
WARN 은 빌드를 막지 않지만 Wave 3 검증 에이전트가 전수 확인한다.

---

## 1. 파일 구조

```
data/questions/
├── manifest.json          # 세트 목록 (Wave 2 B6 가 생성 — 검증 대상에서 제외됨)
├── basics-ch01.json … basics-ch18.json   # 기본개념 챕터 확인문제 (각 10문항)
├── saa-secure.json        # 도메인 연습 102
├── saa-resilient.json     #             88
├── saa-performance.json   #             82
├── saa-cost.json          #             68
├── saa-mock-1.json … saa-mock-4.json     # 모의고사 (각 65문항, 혼합 세트)
└── saa-diagnostic.json    # 진단 테스트 40문항 (혼합 세트)
```

검증기는 `data/questions/` 의 `*.json` 중 **`manifest.json` 을 제외한 전부**를 세트로 읽는다.
따라서 이 디렉터리에 임시 파일·백업본을 두면 안 된다. 전부 스키마 검사를 받는다.

### 1-1. 세트 레벨 필드

```json
{
  "setId": "saa-secure",
  "title": "도메인 1 — 보안 아키텍처 설계 연습문제",
  "exam": "SAA",
  "domain": "Design Secure Architectures",
  "examCode": "SAA-C03",
  "questions": [ /* … */ ]
}
```

| 필드 | 타입 | 필수 | 규칙 |
|---|---|:--:|---|
| `setId` | string | **필수** | **파일명(확장자 제외)과 문자 단위로 같아야 한다.** 다르면 `setId("x") 가 파일명("y") 과 다릅니다` |
| `title` | string | **필수** | 화면(퀴즈 허브 · 인라인 위젯 제목)에 그대로 노출된다 |
| `exam` | `"SAA"` \| `"BASICS"` | **필수** | 다른 값이면 `exam 값이 잘못되었습니다: …` |
| `domain` | string | **필수** | 단일 도메인 세트는 §2-3 의 공식 문자열 4개 중 하나. 혼합 세트는 `"Mixed"` |
| `examCode` | string | **필수** | 값은 `"SAA-C03"`. (검증기는 존재만 확인하고 값은 보지 않지만, 시험 코드는 사이트 전체에서 `SAA-C03` 하나뿐이다. **`SAA-C04` 는 존재하지 않는다** — `PLAN.md` §0) |
| `mock` | boolean | 선택 | 모의고사 세트에 `true`. **혼합 세트 판정에 쓰인다** |
| `diagnostic` | boolean | 선택 | 진단 세트에 `true`. 동상 |
| `questions` | array | **필수** | 비어 있으면 `questions 배열이 비어 있습니다` 후 그 파일은 검사 중단 |

> 다섯 필수 필드는 **truthy 검사**다. 빈 문자열·`null` 도 누락으로 잡힌다 (`세트 필수 필드 누락: {키}`).

### 1-2. 혼합 세트(mixed set) 판정 규칙 — 검증기가 쓰는 정확한 식

모의고사와 진단 테스트는 **한 세트 안에 4개 도메인 문항이 섞인다.** 이 경우 문항별 `domain`
검사 방식이 달라지므로, 검증기는 다음 네 조건 중 **하나라도** 참이면 혼합 세트로 본다.

```js
const mixedSet = set.mock === true || set.diagnostic === true ||
                 /^(mixed|혼합)$/i.test(String(set.domain || '').trim()) ||
                 /(?:-mock-\d+|-diagnostic)$/.test(setId);
```

1. `set.mock === true`
2. `set.diagnostic === true`
3. `set.domain` 이 `Mixed` 또는 `혼합` (대소문자 무시, 앞뒤 공백 제거 후 완전 일치)
4. `setId` 가 `-mock-{숫자}` 또는 `-diagnostic` 으로 **끝남**

**네 번째 조건만으로 판정되면 경고가 뜬다:**

```
혼합 세트로 판단했습니다(setId 규칙). 명시적으로 mock:true 또는 diagnostic:true 를 넣어 주세요
```

→ 따라서 모의고사·진단 세트는 **반드시 `mock: true` 또는 `diagnostic: true` 를 명시**하고,
`domain` 은 `"Mixed"` 로 둔다. 파일명 규칙에 의존하지 않는다.

| | 단일 도메인 세트 | 혼합 세트 |
|---|---|---|
| 예 | `saa-secure`, `basics-ch08` | `saa-mock-1`, `saa-diagnostic` |
| 세트 `domain` | 공식 도메인 문자열 / 챕터 주제 | `"Mixed"` |
| 문항 `domain` 검사 | **세트 `domain` 과 완전히 같아야 함** | **공식 도메인 4개 목록 안에 있으면 됨** (문항마다 달라도 정상) |

혼합 세트의 문항별 도메인 검사는 `q.exam === "SAA"` 일 때만 동작한다
(검증기의 `EXAM_DOMAINS` 에 `BASICS` 키가 없다). BASICS 는 혼합 세트를 만들지 않는다.

---

## 2. 문항 객체 — 공통 필드

```json
{
  "id": "saa-secure-001",
  "exam": "SAA",
  "domain": "Design Secure Architectures",
  "chapter": "ch02",
  "difficulty": "medium",
  "type": "single",
  "question": "…",
  "code": null,
  "choices": [ /* … */ ],
  "answer": ["B"],
  "explanation": "…",
  "distractorNotes": { "A": "…", "C": "…", "D": "…" },
  "refs": [{ "url": "https://docs.aws.amazon.com/…", "title": "…" }],
  "tags": ["iam", "iam-role", "ec2"]
}
```

### 2-1. `id` — 전역 고유

| 항목 | 내용 |
|---|---|
| 타입 | string, **필수** |
| 검증기 | 존재 + **모든 파일을 통틀어 중복 금지**. 중복 시 `id 중복: "x" (이미 data/questions/y.json 에 있습니다)` |
| 형식 | `{exam소문자}-{domain-slug}-{3자리}` — **검증기는 형식을 검사하지 않는다. 사람이 지킨다.** |

| 세트 | slug | id 예 |
|---|---|---|
| `saa-secure` | `secure` | `saa-secure-001` … `saa-secure-102` |
| `saa-resilient` | `resilient` | `saa-resilient-001` |
| `saa-performance` | `performance` | `saa-performance-001` |
| `saa-cost` | `cost` | `saa-cost-001` |
| `saa-mock-1` | `mock1` | `saa-mock1-001` … `saa-mock1-065` |
| `saa-diagnostic` | `diag` | `saa-diag-001` … `saa-diag-040` |
| `basics-ch08` | `ch08` | `basics-ch08-001` … `basics-ch08-010` |

번호는 **세트 안에서 1부터 3자리 zero-pad**. 중간 문항을 지워도 번호를 당기지 않는다
(오답 노트가 `localStorage` 에 id 로 진도를 저장하므로, id 재사용은 남의 기록을 덮어쓴다).

### 2-2. `exam`

- `"SAA"` 또는 `"BASICS"`. 필수.
- **세트의 `exam` 과 같아야 한다.** 다르면 `exam("X") 이 세트("Y") 와 다릅니다`.
- 이 값이 `type` 허용 범위를 결정한다 (§3).

### 2-3. `domain` — 오타는 곧 기능 고장

`exam: "SAA"` 문항의 `domain` 은 **다음 4개 문자열 중 하나여야 하며, 한 글자도 달라선 안 된다.**

```
Design Secure Architectures
Design Resilient Architectures
Design High-Performing Architectures
Design Cost-Optimized Architectures
```

- 하이픈 위치(`High-Performing`, `Cost-Optimized`), 복수형 `Architectures`, 대문자 위치까지 그대로.
- 한국어 번역명을 넣지 않는다. 화면에 보이는 한국어 라벨은 `assets/js/quiz.js` 의
  `SAA_DOMAINS[].label` 이 담당한다.

**왜 오타가 기능 고장인가.** `quiz.js` 의 `SAA_DOMAINS[].name` 이 이 문자열과 **정확히 일치할 때만**
동작하는 기능이 세 개 있다.

1. `buildDiagnostic()` — 진단 결과의 도메인별 정답률·`tier`(집중/보강/유지)·우선도 계산.
   일치하지 않는 도메인은 `result.byDomain` 에는 남지만 **학습 계획(plan)에서 조용히 사라진다.**
   오류도, 빈 줄도 나지 않는다. 그냥 없어진다.
2. `weakness` 모드 — 약점 도메인 선정과 문항 필터(`q.domain === d.name`).
3. 결과 리포트의 도메인 → 챕터·도메인 페이지 링크(`SAA_DOMAINS[].chapters`, `.page`).

`exam: "BASICS"` 문항의 `domain` 은 공식 도메인이 아니라 **챕터 주제**를 쓴다
(`PLAN.md` §2-1 의 챕터 제목 그대로). 예: `"IAM과 자격 증명"`, `"S3와 오브젝트 스토리지"`.
검증기는 BASICS 에 화이트리스트를 적용하지 않지만, **세트 `domain` 과 문항 `domain` 은 같아야 한다.**

### 2-4. `chapter` — 복습 링크의 유일한 근거

| 항목 | 내용 |
|---|---|
| 타입 | string, **필수** |
| 형식 | `/^ch(0[1-9]\|1[0-8])$/` → `ch01` ~ `ch18`. `ch1`·`ch019`·`CH02` 전부 오류 |
| 누락 시 | `chapter 누락 — 결과 리포트의 복습 링크가 이 값에 의존합니다` |
| 형식 오류 시 | `chapter 형식 오류: "x" — ch01~ch18` |

`quiz.js` 는 결과 화면의 틀린 문항마다 `basics/{chapter}.html` 로 가는
"복습하기" 링크를 만들고, `result.byChapter` 로 챕터별 정답률을 집계한다.
**SAA 문항에도 반드시 챕터를 붙인다.** 도메인↔챕터 매핑은 `PLAN.md` §0 표를 따른다.

| 도메인 | 주 챕터 |
|---|---|
| Design Secure Architectures | ch02, ch03, ch16 (+ ch01, ch04) |
| Design Resilient Architectures | ch07, ch10, ch12, ch18 (+ ch13) |
| Design High-Performing Architectures | ch05, ch08, ch11, ch14, ch15 (+ ch06, ch09) |
| Design Cost-Optimized Architectures | ch05, ch08, ch18 (+ ch06, ch09) |

### 2-5. `difficulty`

- `"easy"` / `"medium"` / `"hard"` 셋 중 하나. 필수. 다른 값이면 `difficulty 값 오류: …`.
- **세트당 목표 비율 3 : 5 : 2** (easy 30% / medium 50% / hard 20%).
- 문항 10개 이상인 세트에서 어떤 등급이든 목표에서 **20%p 넘게 벗어나면 경고**:
  `difficulty 비율 편중: easy 55% (목표 30%, 3:5:2)`
- 10문항짜리 basics 세트 기준: **easy 3 / medium 5 / hard 2** 를 그대로 맞추면 안전하다.

### 2-6. `question`

- string, 필수. 누락 시 `question 누락`.
- **260자를 넘으면 경고** (`question 이 N자입니다 (200자 이내 권장)`). 목표는 200자 이내.
- 백틱(`` `gp3` ``)과 `**강조**` 마크업을 쓸 수 있다. `quiz.js` 의 `md()` 가
  **HTML 이스케이프 후** `<code>` / `<strong>` 으로 바꾼다. 그 밖의 마크다운은 지원하지 않는다.
- `multiple` 은 **개수 명시가 필수**다 (§3-2).

### 2-7. `code` — 선택

```json
"code": { "lang": "json", "body": "{ \"Effect\": \"Deny\", … }", "caption": "버킷 정책 일부" }
```

- 없으면 `null` 또는 필드 자체를 생략한다.
- `null` 이 아니면 **객체여야 하고 `body` 가 있어야 한다.** 아니면 `code 는 { lang, body } 형태여야 합니다`.
- `lang` 없으면 경고 `code.lang 이 없습니다`.
- `caption` 은 검증기가 보지 않지만 `quiz.js` 가 `<figcaption>` 에 쓴다
  (없으면 `lang` 값이 대신 들어간다). IAM 정책·CLI 출력 문항에는 넣어 주는 편이 좋다.
- `body` 는 이스케이프되어 `<pre><code class="lang-…">` 로 렌더된다. 하이라이터가 클래스를 읽는다.

### 2-8. `explanation` — 3~6문장, 문제문 반복 금지

| 규칙 | 검증기 |
|---|---|
| 필수 · string | `explanation 누락` (ERROR) |
| 3문장 미만 | `explanation 이 N문장입니다 (3~6문장 규칙)` (WARN) |
| **7문장 초과** | 같은 메시지 (WARN). 즉 7문장은 통과하지만 **규칙은 3~6문장**이다 |
| 문제문 반복 | `question` 의 **앞 25자**를 그대로 포함하면 `explanation 이 question 을 그대로 반복합니다` (WARN) |

문장 수는 `[.!?。]` 뒤 공백, 또는 `니다.` / `습니다.` 뒤에서 잘라 센다.
→ **해설을 "~합니다." 체로 쓰고 문장 사이를 한 칸 띄우면** 의도대로 세어진다.
한 문장을 쉼표로 길게 이어 붙이면 1문장으로 세어져 하한 경고가 뜬다.

내용 기준은 §9-5: **원리로 설명한다.** "B가 정답이다"가 아니라 "왜 이 요구사항이 그 서비스를 부르는가".

### 2-9. `distractorNotes` — 모든 오답 선택지에 필수

```json
"distractorNotes": {
  "A": "액세스 키를 교체해도 디스크에 장기 자격 증명이 남습니다. 유출 경로 자체는 그대로입니다.",
  "C": "Secrets Manager 는 비밀을 안전하게 보관하지만, 보관되는 대상이 여전히 장기 액세스 키입니다.",
  "D": "버킷 정책의 소스 IP 조건은 자격 증명을 대체하지 못하며, 퍼블릭 IP 는 재시작 시 바뀝니다."
}
```

- 객체가 아니면 `distractorNotes 누락` (ERROR).
- **`single`/`multiple`: 정답이 아닌 모든 선택지에 키가 있어야 한다.**
  없으면 `오답 선택지 C 의 distractorNotes 가 없습니다` (ERROR).
- 정답 선택지에도 키를 넣을 수 있으나, 화면에는 **표시되지 않는다**
  (`renderFeedback()` 이 정답 키를 건너뛴다). 정답 설명은 `explanation` 에 쓴다.
- 선택지에 없는 키가 있으면 경고 `distractorNotes 키 "X" 가 choices 에 없습니다`.
- `matching` 은 `pairs[].id`, `ordering` 은 `items[].id` 를 키로 쓴다 (§3-3, §3-4).

> ⚠️ **본문에서 선택지를 "A", "B" 같은 글자로 지칭하지 말 것.**
> `quiz.js` 의 `prepare()` 가 **선택지를 매번 섞고 화면 글자(A~E)를 다시 부여**한다.
> 데이터의 `id` 와 화면의 글자는 일치하지 않는다. 해설에서는 선택지 **내용**을 인용한다.
> (오답 노트 항목의 머리글자는 엔진이 `letterOf` 로 알아서 붙인다.)

### 2-10. `refs` — 최소 1개, 공식 문서 URL만

```json
"refs": [
  { "url": "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html", "title": "IAM 역할" }
]
```

- **배열이고 최소 1개.** 아니면 `refs 가 최소 1개 필요합니다` (ERROR).
- 각 원소는 **객체**이며 `url` 이 필수다 (`refs[0].url 누락`).
  → `FACT_SOURCES.md` §6 의 예시는 문자열 배열로 그려져 있으나, **검증기는 `{url, title}` 객체를 요구한다.**
- `url` 은 다음 호스트 문자열 중 **하나를 포함**해야 한다. 아니면
  `refs[0] 는 공식 문서 URL 이어야 합니다: …` (ERROR).

  | 허용 |
  |---|
  | `docs.aws.amazon.com` |
  | `aws.amazon.com` |
  | `aws.amazon.com/blogs` |
  | `aws.amazon.com/architecture` |
  | `awscli.amazonaws.com` |

  → 실무적으로는 **`docs.aws.amazon.com` 정규 URL을 기본으로 쓴다.**
- 덤프 사이트 문자열이 URL에 들어가면 `refs[0] 덤프 사이트 참조 금지: …` (ERROR). 목록은 §11.
- `title` 이 없으면 경고 `refs[0].title 누락`. 학습자가 보는 링크 텍스트이므로 **항상 넣는다.**
- **URL을 지어내지 않는다.** `FACT_SOURCES.md` §6 "URL 구성 방법"이 정한 세 경로
  (awsdocs 레포 파일 경로 매핑 / API 문서 안에 AWS가 직접 박아둔 링크 / WebSearch 결과에 실제로 나타난 URL)
  중 하나에서 온 것만 쓴다.

### 2-11. `tags` — 2~5개

- 배열이고 **2개 이상**이어야 한다. 아니면 `tags 는 2~5개 필요합니다` (ERROR).
- 6개 이상이면 경고 `tags 가 N개입니다 (2~5개)`.
- 빈 문자열·비문자열 원소가 있으면 `tags 항목이 비어 있습니다` (ERROR).
- 표기 규약: **영문 소문자 + 하이픈**. 서비스명 1개 + 개념 1~4개.
  예: `["s3", "storage-class", "lifecycle"]`, `["rds", "multi-az", "read-replica"]`.
  전체 태그 사전은 `docs/SAA_TOPIC_CHECKLIST.md` 를 따른다.
- 해설 하단에 그대로 노출되므로 내부 약어를 쓰지 않는다.

---

## 3. ⚠️ 문항 유형 정책 — 이 문서에서 가장 중요한 절

**SAA-C03 의 문항 형식은 두 가지뿐이다.**

| 실제 시험 형식 | `type` | 채점 |
|---|---|---|
| 객관식 (multiple choice, 단일 정답) | `single` | 정답 1개 일치 |
| 복수 응답 (multiple response, 2개 이상 정답) | `multiple` | **전부 일치. 부분 점수 없음** |

`matching`(연결형)과 `ordering`(순서 배열)은 **엔진이 지원하고 암기에 효과적이지만,
SAA-C03 시험에는 출제되지 않는다.**

### 3-0. 세 줄 요약

1. **`exam: "SAA"` 세트는 `single` 과 `multiple` 만 쓸 수 있다.** 검증기가 **ERROR** 를 낸다.

   ```
   type="matching" 는 SAA-C03 시험에 없는 유형입니다 — exam:"SAA" 세트는 single/multiple 만 허용합니다 (학습용 유형은 basics-* 세트에만)
   ```

2. **`matching` / `ordering` 은 학습용 전용이며 `basics-ch*.json` 세트에만 넣는다.**
   화면에는 `quiz.js` 가 자동으로 배지를 붙인다 —
   `학습용 유형` (툴팁: *SAA-C03 실제 시험에는 이 유형이 출제되지 않습니다*).

3. **사이트 어디에도 "시험에 연결형·순서 배열이 나온다"고 쓰지 않는다.**
   AWS가 2024년부터 신규 자격증(AIF-C01, MLA-C01 등)에 도입한 유형이지만
   **SAA-C03에는 도입되지 않았다** (`PLAN.md` §0). 해설·힌트·챕터 본문 어디에도 이 오해를 만들지 않는다.

> 검증기의 `type` 자체는 네 값 모두 허용한다(`type 값 오류: …` 는 오탈자용).
> SAA 제한은 `q.exam === 'SAA'` 인 문항에만 걸린다. 즉 **`exam` 값이 방어선**이다.
> basics 세트의 문항에 `exam: "SAA"` 를 잘못 넣으면 그 순간 학습용 유형이 전부 ERROR 가 된다.

### 3-1. `single`

```json
{
  "type": "single",
  "choices": [
    { "id": "A", "text": "…" },
    { "id": "B", "text": "…" },
    { "id": "C", "text": "…" },
    { "id": "D", "text": "…" }
  ],
  "answer": ["B"]
}
```

| 규칙 | 메시지 |
|---|---|
| `choices` 는 **정확히 4개** | `single 은 choices 가 정확히 4개여야 합니다 (현재 5)` |
| `choices[].id` 는 `A`~`E` | `choices[0].id 는 A~E 여야 합니다: 1` |
| `id` 중복 금지 | `choices id 중복: B` |
| `choices[].text` 필수 | `choices[0].text 누락` |
| `answer` 는 **배열**, 길이 1 | `single 은 answer 가 1개여야 합니다 (현재 2)` |
| `answer` 원소는 `choices` 의 id | `answer "E" 가 choices 에 없습니다` |
| `pairs` / `items` 필드 금지 | `type=single 에 pairs 가 있습니다 (matching 전용)` |

- `answer` 는 정답이 하나여도 **반드시 배열**이다 (`"answer": ["B"]`).
- `id` 는 데이터상의 고정 식별자일 뿐 **화면 순서와 무관**하다 (§2-9 경고 참조).
- 정답 선택지가 다른 선택지보다 **1.9배 넘게 길고 차이가 25자 초과**면 경고:
  `정답 선택지가 다른 선택지보다 지나치게 깁니다 (패턴으로 맞힐 수 있음)`.

### 3-2. `multiple`

```json
{
  "type": "multiple",
  "question": "… 어떻게 해야 합니까? (2개 선택)",
  "choices": [ /* 4~5개 */ ],
  "answer": ["A", "B"]
}
```

| 규칙 | 메시지 |
|---|---|
| `choices` 4~5개 | `multiple 은 choices 가 4~5개여야 합니다 (현재 6)` |
| `answer` **2개 이상** | `multiple 은 answer 가 2개 이상이어야 합니다` |
| `answer` 중복 금지 | `answer 에 중복이 있습니다` |
| 문제문에 개수 명시 | (WARN) `multiple 문항은 문제문에 "(2개 선택)" 처럼 개수를 명시해야 합니다` |

개수 표기는 정규식 `\(\s*\d+\s*개\s*선택\s*\)` 로 검사한다.
→ `(2개 선택)`, `( 2 개 선택 )` 통과. **`(2개를 선택하세요)`, `(두 개 선택)` 은 불통과.**
문장 맨 끝에 `(2개 선택)` 형태로 붙인다.

- 채점은 **완전 일치**다. 부분 점수가 없으므로 정답 개수를 3개 이상으로 올리면 정답률이 급락한다.
  실제 시험 감각에 맞춰 **정답 2개 / 선택지 5개**를 기본형으로 삼는다.
- 키보드 단축키가 1~5 이므로 선택지는 5개를 넘지 않는다 (검증기도 5개까지만 허용).

### 3-3. `matching` — basics 세트 전용

```json
{
  "type": "matching",
  "pairs": [
    { "id": "p1", "left": "…", "right": "S3 Standard-IA" },
    { "id": "p2", "left": "…", "right": "S3 One Zone-IA" },
    { "id": "p3", "left": "…", "right": "S3 Glacier Deep Archive" }
  ],
  "extraRights": ["S3 Standard", "S3 Glacier Flexible Retrieval"],
  "distractorNotes": { "p1": "…", "p2": "…", "p3": "…" }
}
```

| 규칙 | 메시지 |
|---|---|
| `choices` 금지 | `matching 에 choices 가 있습니다 (single/multiple 전용)` |
| `items` 금지 | `matching 에 items 가 있습니다 (ordering 전용)` |
| **`answer` 를 쓰지 않는다** | (WARN) `matching 은 answer 필드를 쓰지 않습니다 (pairs[].right 가 정답)` |
| `pairs` 는 배열 | `pairs 누락` |
| `pairs` **3~6개** | `pairs 는 3~6개여야 합니다 (현재 7)` |
| `pairs[].id` 필수·중복 금지 | `pairs[0].id 누락` / `pairs id 중복: p2` |
| `pairs[].left` 필수 | `pairs[0].left 누락` |
| `pairs[].right` 필수 | `pairs[0].right 누락` |
| **`right` 값 중복 금지** | `pairs[1].right 값 중복: "S3 Standard-IA" — 두 left 가 같은 right 를 가질 수 없습니다` |
| `extraRights` 는 배열 | `extraRights 는 배열이어야 합니다` |
| `extraRights` 원소 비어 있음 금지 | `extraRights[0] 가 비어 있습니다` |
| **`extraRights` 는 정답 `right` 와 겹치면 안 됨** | `extraRights[0] "S3 Standard-IA" 가 정답 right 와 겹칩니다 — 미끼는 정답과 달라야 합니다` |
| `extraRights` 내부 중복 | (WARN) `extraRights 에 중복이 있습니다` |
| `extraRights` 없음 | (WARN) `extraRights 가 없습니다 — 1:1 대응으로 답을 역추론할 수 있으므로 1~3개 넣는 것을 권장합니다` |
| `distractorNotes` 키 | (WARN) `distractorNotes 키 "x" 가 pairs id 에 없습니다` / 비어 있으면 `matching 의 distractorNotes 가 비어 있습니다 — 혼동하기 쉬운 쌍은 설명하세요` |

**동작 방식.** 엔진은 `pairs[].right` 전부 + `extraRights` 를 합쳐 **중복 제거 후 섞어서**
하나의 `<select>` 목록으로 만든다. 학습자는 `left` 마다 값을 고른다.
채점은 **모든 쌍이 정답이고 빈칸이 하나도 없을 때만** 정답이다. 값 비교는 문자열로 한다.

- `left` 에 요구사항·시나리오를, `right` 에 짧은 고유명사(서비스·클래스·옵션명)를 둔다.
  반대로 두면 `<select>` 안에 긴 문장이 들어가 모바일에서 읽히지 않는다.
- **`extraRights` 는 1~3개 넣는다.** 없으면 마지막 항목을 소거법으로 공짜로 맞힌다.
- `left` / `right` 모두 백틱·`**강조**` 마크업을 쓸 수 있다 (`right` 는 `<select>` 안이라 텍스트로만 보인다 —
  **`right` 에는 마크업을 쓰지 않는다**).

### 3-4. `ordering` — basics 세트 전용

```json
{
  "type": "ordering",
  "items": [
    { "id": "i1", "text": "…" },
    { "id": "i5", "text": "…" },
    { "id": "i3", "text": "…" },
    { "id": "i2", "text": "…" },
    { "id": "i4", "text": "…" }
  ],
  "answer": ["i5", "i1", "i2", "i3", "i4"],
  "distractorNotes": { "i2": "…", "i4": "…" }
}
```

| 규칙 | 메시지 |
|---|---|
| `choices` 금지 | `ordering 에 choices 가 있습니다` |
| `pairs` 금지 | `ordering 에 pairs 가 있습니다` |
| `items` 는 배열 | `items 누락` |
| `items` **4~6개** | `items 는 4~6개여야 합니다 (현재 3)` |
| `items[].id` 필수·중복 금지 | `items[0].id 누락` / `items id 중복: i2` |
| `items[].text` 필수 | `items[0].text 누락` |
| `answer` 는 배열 | `answer 누락 (정답 순서의 item id 배열)` |
| 개수 일치 | `answer 개수(4) 가 items 개수(5) 와 다릅니다` |
| `answer` 중복 금지 | `answer 에 중복 id 가 있습니다` |
| 미존재 id 금지 | `answer "i9" 가 items 에 없습니다` |
| **`items` 를 정답 순서로 저장 금지** | (WARN) `items 배열이 정답 순서 그대로입니다 — 데이터 유출을 피해 섞어서 저장하세요` |
| `distractorNotes` 키 | (WARN) `distractorNotes 키 "x" 가 items id 에 없습니다` |

> ⚠️ **`items` 배열을 정답 순서로 저장하지 말 것.**
> `data/questions/*.json` 은 브라우저가 그대로 내려받는 **공개 파일**이다.
> 정답 순서로 저장해 두면 파일만 열어도 답이 보인다. 엔진이 화면에서 섞기는 하지만
> 그것은 표시 계층의 편의일 뿐 보안이 아니다. **저장 시점에 섞어서 넣는다.**
> (엔진은 우연히 섞인 결과가 정답 순서와 같아지면 한 칸 회전시켜 힌트를 줄인다.)

- 채점은 **순서 완전 일치**다. 한 칸만 어긋나도 오답이다. 그래서 4~5단계가 적당하다.
- 조작은 각 행의 ▲▼ 버튼이다. 드래그 앤 드롭은 쓰지 않는다(키보드 접근성).
- `distractorNotes` 는 **자주 뒤바뀌는 단계**에만 붙인다. 전 항목에 붙일 필요는 없다.

---

## 4. 유형 배분 목표

| 세트 | `single` | `multiple` | `matching` | `ordering` |
|---|---:|---:|---:|---:|
| **SAA 도메인 연습 · 모의고사 · 진단** | **75%** | **25%** | **0** | **0** |
| **기본개념 챕터 확인문제 (`basics-ch*`)** | 60% | 20% | 12% | 8% |

환산 예시:

| 세트 | 총 | single | multiple | matching | ordering |
|---|---:|---:|---:|---:|---:|
| `saa-secure` | 102 | 77 | 25 | 0 | 0 |
| `saa-resilient` | 88 | 66 | 22 | 0 | 0 |
| `saa-performance` | 82 | 62 | 20 | 0 | 0 |
| `saa-cost` | 68 | 51 | 17 | 0 | 0 |
| `saa-mock-{1..4}` | 65 | 49 | 16 | 0 | 0 |
| `saa-diagnostic` | 40 | 30 | 10 | 0 | 0 |
| `basics-ch{NN}` | 10 | 6 | 2 | 1 | 1 |

- basics 세트 10문항 기준 **single 6 / multiple 2 / matching 1 / ordering 1** 이 정확한 배분이다.
- 검증기는 이 비율을 검사하지 않는다. **B6(매니페스트·감사 에이전트)와 Wave 3 C2가 확인한다.**
- 단, `single` 문항의 **정답 글자 분포**는 검증기가 본다 (§9-4).

---

## 5. 완전한 예시 — `single`

`data/questions/saa-secure.json` 의 한 문항.

```json
{
  "id": "saa-secure-001",
  "exam": "SAA",
  "domain": "Design Secure Architectures",
  "chapter": "ch02",
  "difficulty": "medium",
  "type": "single",
  "question": "한 기업이 EC2 인스턴스에서 실행되는 주문 처리 애플리케이션을 운영합니다. 이 애플리케이션은 Amazon S3 버킷의 객체를 읽어야 하며, 현재는 IAM 사용자의 장기 액세스 키를 인스턴스의 설정 파일에 저장해 사용합니다. 자격 증명 유출 위험을 없애면서 요구사항을 충족하는 가장 안전한(MOST secure) 방법은 무엇입니까?",
  "code": null,
  "choices": [
    { "id": "A", "text": "IAM 사용자의 액세스 키를 90일마다 교체하고 설정 파일의 읽기 권한을 소유자로 제한한다." },
    { "id": "B", "text": "필요한 S3 읽기 권한만 가진 IAM 역할을 만들어 인스턴스 프로필로 연결하고 설정 파일의 키를 삭제한다." },
    { "id": "C", "text": "액세스 키를 AWS Secrets Manager에 저장하고 애플리케이션이 시작할 때 조회하도록 변경한다." },
    { "id": "D", "text": "버킷 정책에서 인스턴스의 퍼블릭 IP 주소를 허용 소스로 지정하고 애플리케이션의 자격 증명을 제거한다." }
  ],
  "answer": ["B"],
  "explanation": "EC2에서 실행되는 코드에 권한을 주는 표준 방법은 IAM 역할을 인스턴스 프로필로 연결하는 것입니다. 역할을 연결하면 인스턴스 메타데이터 서비스가 자동으로 교체되는 임시 자격 증명을 발급하므로, 디스크에 남아 유출될 수 있는 장기 자격 증명 자체가 사라집니다. 장기 액세스 키는 교체 주기를 짧게 잡거나 보관 위치를 옮겨도 '유출될 수 있는 비밀이 존재한다'는 근본 문제가 그대로 남습니다. 한정어가 MOST secure이므로, 위험을 줄이는 선택지가 아니라 위험의 원인을 제거하는 선택지를 고릅니다.",
  "distractorNotes": {
    "A": "교체 주기를 줄이면 노출 창이 좁아질 뿐 디스크에 장기 자격 증명이 남는다는 사실은 바뀌지 않습니다. 파일 권한 제한도 인스턴스가 침해되면 무력화됩니다.",
    "C": "Secrets Manager는 비밀을 안전하게 보관하고 교체해 주지만, 보관 대상이 여전히 장기 액세스 키입니다. 또한 Secrets Manager를 호출할 자격 증명이 다시 필요해져 문제가 한 단계 뒤로 밀릴 뿐입니다.",
    "D": "소스 IP 조건은 인증이 아니라 추가 제약입니다. 요청에는 여전히 서명할 자격 증명이 필요하고, 퍼블릭 IP는 인스턴스를 중지·시작하면 바뀌므로 운영도 깨집니다."
  },
  "refs": [
    { "url": "https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/iam-roles-for-amazon-ec2.html", "title": "Amazon EC2에 대한 IAM 역할" },
    { "url": "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html", "title": "IAM 역할" }
  ],
  "tags": ["iam", "iam-role", "ec2", "s3"]
}
```

체크: 선택지 4개 · id A~D · `answer` 1개 · 오답 3개 전부 `distractorNotes` ·
해설 4문장 · 정답 선택지 길이가 튀지 않음 · `refs` 2개 전부 `docs.aws.amazon.com` · `tags` 4개.

---

## 6. 완전한 예시 — `multiple`

```json
{
  "id": "saa-resilient-014",
  "exam": "SAA",
  "domain": "Design Resilient Architectures",
  "chapter": "ch10",
  "difficulty": "medium",
  "type": "multiple",
  "question": "한 소매 기업이 단일 AZ의 Amazon RDS for MySQL 인스턴스에서 주문 데이터베이스를 운영합니다. 보고서 조회가 늘면서 읽기 지연이 커졌고, AZ 장애가 나면 수동으로 복구해야 합니다. 애플리케이션 코드 변경을 최소화하면서 읽기 처리량을 늘리고 AZ 장애 시 자동 장애 조치를 제공하려면 어떤 조치를 취해야 합니까? (2개 선택)",
  "choices": [
    { "id": "A", "text": "Multi-AZ 배포를 활성화해 다른 AZ의 동기식 대기 인스턴스로 자동 장애 조치되게 한다." },
    { "id": "B", "text": "읽기 전용 복제본을 생성하고 보고서 조회를 복제본 엔드포인트로 보낸다." },
    { "id": "C", "text": "Multi-AZ 대기 인스턴스로 보고서 조회를 보내 읽기 부하를 분산한다." },
    { "id": "D", "text": "읽기 전용 복제본을 다른 AZ에 만들어 기본 인스턴스 장애 시 자동 승격되게 한다." },
    { "id": "E", "text": "인스턴스 클래스를 더 큰 것으로 변경하고 스토리지 볼륨 크기를 두 배로 늘린다." }
  ],
  "answer": ["A", "B"],
  "explanation": "RDS에서 가용성과 읽기 확장은 서로 다른 기능이 담당하며, 시험은 이 둘의 혼동을 집요하게 노립니다. Multi-AZ는 다른 AZ의 대기 인스턴스로 동기 복제해 자동 장애 조치를 제공하고, 엔드포인트가 그대로 유지되므로 애플리케이션 코드를 바꿀 필요가 없습니다. 읽기 전용 복제본은 비동기 복제로 별도의 읽기 엔드포인트를 제공해 보고서 같은 읽기 부하를 기본 인스턴스에서 떼어 냅니다. 두 요구사항이 함께 제시되면 두 기능을 함께 적용하는 것이 정답입니다.",
  "distractorNotes": {
    "C": "표준 Multi-AZ 인스턴스 배포의 대기 인스턴스는 읽기 트래픽을 받지 않습니다. 대기 인스턴스는 장애 조치 대상일 뿐이며, 읽기 가능한 대기 인스턴스를 갖는 Multi-AZ DB 클러스터는 별개의 아키텍처입니다.",
    "D": "읽기 전용 복제본은 비동기 복제이며 자동 장애 조치 대상이 아닙니다. 기본 인스턴스가 실패해도 복제본이 스스로 승격되지 않으므로 가용성 요구사항을 충족하지 못합니다.",
    "E": "수직 확장은 읽기 부하를 일시적으로 완화할 수 있지만 AZ 장애에는 아무 도움이 되지 않습니다. 스토리지 크기를 늘리는 것도 읽기 동시성 문제의 해법이 아닙니다."
  },
  "refs": [
    { "url": "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZSingleStandby.html", "title": "Multi-AZ DB 인스턴스 배포" },
    { "url": "https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_ReadRepl.html", "title": "읽기 전용 복제본 작업" }
  ],
  "tags": ["rds", "multi-az", "read-replica", "high-availability"]
}
```

체크: 선택지 5개 · `answer` 2개 · 문제문에 `(2개 선택)` · 오답 3개 전부 `distractorNotes` ·
"두 개가 모두 기술적으로 동작하지만 요구사항 두 개가 각각 하나씩을 부른다"는 구조.

---

## 7. 완전한 예시 — `matching` (basics 전용)

`data/questions/basics-ch08.json` — 세트 `exam: "BASICS"`, `domain: "S3와 오브젝트 스토리지"`.

```json
{
  "id": "basics-ch08-007",
  "exam": "BASICS",
  "domain": "S3와 오브젝트 스토리지",
  "chapter": "ch08",
  "difficulty": "medium",
  "type": "matching",
  "question": "각 요구사항에 가장 적합한 S3 스토리지 클래스를 연결하세요. 목록에는 정답이 아닌 미끼 값이 섞여 있습니다.",
  "pairs": [
    { "id": "p1", "left": "월 1~2회만 읽지만 읽을 때는 즉시 필요하고, 3개 이상 AZ에 저장되어야 하는 로그. 최소 저장 기간 30일을 감수할 수 있다", "right": "S3 Standard-IA" },
    { "id": "p2", "left": "원본이 다른 곳에 있어 유실되어도 다시 만들 수 있는 변환본. 저장 비용을 더 낮추기 위해 단일 AZ 저장을 허용한다", "right": "S3 One Zone-IA" },
    { "id": "p3", "left": "분기에 한 번 조회하지만 조회 시에는 밀리초 단위 접근이 필요한 아카이브. 최소 저장 기간 90일", "right": "S3 Glacier Instant Retrieval" },
    { "id": "p4", "left": "법규상 7년 보관해야 하고 실제 조회는 거의 없으며, 필요할 때 기본 12시간을 기다릴 수 있는 데이터. 최소 저장 기간 180일", "right": "S3 Glacier Deep Archive" },
    { "id": "p5", "left": "접근 패턴을 예측할 수 없어 수명 주기 규칙을 정하기 어렵고, 계층 이동을 자동으로 맡기고 싶은 데이터", "right": "S3 Intelligent-Tiering" }
  ],
  "extraRights": ["S3 Standard", "S3 Glacier Flexible Retrieval"],
  "explanation": "스토리지 클래스 선택은 접근 빈도, 검색 시간 요구, 내구성 대비 AZ 수, 최소 저장 기간의 네 축으로 결정됩니다. 즉시 접근이 필요하면 Standard-IA와 Glacier Instant Retrieval이 후보이고, 둘의 차이는 최소 저장 기간 30일과 90일 그리고 접근 빈도입니다. 재생성 가능한 데이터만 단일 AZ에 두는 One Zone-IA를 고르고, 그렇지 않은 데이터에 이 클래스를 쓰면 AZ 장애가 곧 데이터 손실이 됩니다. 미끼로 넣은 Glacier Flexible Retrieval도 최소 저장 기간이 90일이지만 밀리초 접근을 제공하지 않아 즉시 조회 요구사항과 맞지 않습니다.",
  "distractorNotes": {
    "p1": "즉시 접근이 필요하다는 조건 때문에 Glacier 계열이 아니고, 최소 저장 기간 30일을 감수한다는 조건 때문에 Standard도 아닙니다.",
    "p2": "저렴한 저장 비용만 보고 One Zone-IA를 고르면 안 됩니다. 이 클래스의 전제는 '유실되어도 다시 만들 수 있다'입니다.",
    "p3": "Glacier Instant Retrieval과 Glacier Flexible Retrieval은 최소 저장 기간이 둘 다 90일입니다. 갈라지는 지점은 밀리초 즉시 검색 여부입니다.",
    "p4": "기본 검색 시간 12시간과 최소 저장 기간 180일은 Deep Archive의 결정적 표지입니다.",
    "p5": "접근 패턴을 모른다는 서술이 나오면 Intelligent-Tiering을 먼저 의심합니다. 수명 주기 규칙은 패턴을 알 때 쓰는 도구입니다."
  },
  "refs": [
    { "url": "https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html", "title": "S3 스토리지 클래스 이해" },
    { "url": "https://docs.aws.amazon.com/AmazonS3/latest/userguide/lifecycle-transition-general-considerations.html", "title": "수명 주기 전환 시 고려사항" }
  ],
  "tags": ["s3", "storage-class", "lifecycle"]
}
```

체크: `answer` 필드 없음 · `pairs` 5개 · `right` 값 전부 서로 다름 ·
`extraRights` 2개가 정답 `right` 와 겹치지 않음 · `distractorNotes` 키가 전부 `pairs[].id`.

---

## 8. 완전한 예시 — `ordering` (basics 전용)

`data/questions/basics-ch02.json` — 세트 `exam: "BASICS"`, `domain: "IAM과 자격 증명"`.

```json
{
  "id": "basics-ch02-009",
  "exam": "BASICS",
  "domain": "IAM과 자격 증명",
  "chapter": "ch02",
  "difficulty": "hard",
  "type": "ordering",
  "question": "AWS가 API 요청의 허용 여부를 판정할 때 거치는 정책 평가 단계를 순서대로 배열하세요.",
  "items": [
    { "id": "i3", "text": "리소스 기반 정책과 자격 증명 기반 정책에서 명시적 `Allow` 를 찾는다" },
    { "id": "i1", "text": "적용되는 모든 정책에서 명시적 `Deny` 를 찾는다. 하나라도 있으면 즉시 최종 거부로 끝난다" },
    { "id": "i4", "text": "권한 경계와 세션 정책이 있으면 교집합으로 권한을 다시 좁힌다" },
    { "id": "i5", "text": "모든 요청은 암묵적 거부(implicit deny) 상태에서 시작한다" },
    { "id": "i2", "text": "Organizations SCP가 적용되면 SCP가 그 작업을 허용하는지 확인한다" }
  ],
  "answer": ["i5", "i1", "i2", "i3", "i4"],
  "explanation": "정책 평가는 '기본은 거부'에서 출발합니다. 그다음 적용 가능한 모든 정책을 훑어 명시적 거부를 먼저 찾고, 하나라도 발견되면 나머지를 보지 않고 거부로 확정합니다. 거부가 없으면 SCP 같은 상한선이 그 작업을 허용 범위에 두는지 확인하고, 이어서 리소스 기반·자격 증명 기반 정책에서 명시적 허용을 찾습니다. 마지막으로 권한 경계와 세션 정책은 권한을 넓히지 않고 교집합으로 좁히기만 합니다. 정리하면 우선순위는 명시적 거부 > 명시적 허용 > 암묵적 거부입니다.",
  "distractorNotes": {
    "i2": "SCP는 권한을 부여하지 않고 상한만 정합니다. 그래서 허용을 찾는 단계보다 앞에서 범위를 잘라 냅니다. 멤버 계정의 루트 사용자에게도 적용됩니다.",
    "i4": "권한 경계와 세션 정책을 '추가 권한 부여'로 착각해 앞쪽에 놓는 실수가 많습니다. 둘 다 교집합이므로 언제나 마지막에 좁히는 역할입니다.",
    "i5": "암묵적 거부는 별도의 검사 단계가 아니라 평가의 출발 상태입니다. 어떤 정책도 허용하지 않으면 이 상태가 그대로 최종 결과가 됩니다."
  },
  "refs": [
    { "url": "https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html", "title": "정책 평가 로직" }
  ],
  "tags": ["iam", "policy-evaluation", "scp"]
}
```

체크: `items` 5개이며 **저장 순서가 정답 순서와 다름** · `answer` 가 `items` 와 같은 개수 ·
`distractorNotes` 키가 전부 `items[].id` · 헷갈리는 단계에만 노트를 붙임.

---

## 9. 출제 품질 기준

검증기가 잡지 못하는 것이 대부분이다. **Wave 3 C2가 전수 검증한다.**

1. **정답이 공식 문서로 확정 가능해야 한다.**
   해설의 핵심 주장 하나하나가 `refs` 의 문서에서 확인되어야 한다.
   "일반적으로 그렇게 알려져 있다"는 근거가 아니다. 확인 못 한 수치·서술은
   `docs/FACT_SOURCES.md` §5 "쓰지 말 것" 목록에 있는지 먼저 확인한다.

2. **오답 선택지는 진짜로 혼동될 만한 것이어야 한다. 더미 남발 금지.**
   "해당 리전을 삭제한다" 같은 채우기용 선택지는 문항 하나를 3지선다로 만든다.
   좋은 오답은 **같은 문제를 다른 방식으로 풀려는 시도**다 — 맞는 서비스인데 틀린 티어,
   요구사항 하나만 충족하는 안, 예전 기준으로는 정답이었던 안, 과잉 설계.
   `docs/SAA_TOPIC_CHECKLIST.md` 와 `saa/traps.html` 의 혼동 쌍을 오답 소재로 쓴다.

3. **선택지 길이가 비슷해야 한다.**
   정답만 길면 내용을 몰라도 패턴으로 맞힌다. **검증기가 잡는다** —
   정답이 나머지 최댓값의 1.9배를 넘고 차이가 25자를 넘으면
   `정답 선택지가 다른 선택지보다 지나치게 깁니다 (패턴으로 맞힐 수 있음)` 경고가 뜬다.
   경고가 뜨지 않더라도 **네 선택지의 길이 편차를 눈으로 확인**한다.

4. **정답 글자 분포는 A/B/C/D 각 20~30%.**
   검증기는 `single` 문항이 8개 이상인 세트에서 각 글자의 비율이
   **10% 미만 또는 45% 초과**면 경고한다:
   `single 정답 분포 편중: C 47% (24/51) — 20~30% 권장`.
   `answer` 는 데이터상의 `id` 이며 화면 글자는 매번 섞이지만, **데이터가 한쪽으로 쏠려 있으면
   문항을 기계적으로 찍어낸 흔적**이므로 이 경고를 무시하지 않는다.

5. **해설은 원리로 설명한다.**
   "B가 정답입니다"가 아니라 "이 요구사항은 왜 그 서비스를 부르는가"를 쓴다.
   같은 상황에서 조건이 바뀌면 답이 어떻게 달라지는지 한 문장 넣으면 좋다.
   문제문을 그대로 옮겨 적지 않는다 (검증기가 앞 25자 반복을 잡는다).

6. **SAA 특유의 요구사항 — 시나리오 기반 + 한정어 명시.**
   `exam: "SAA"` 문항은
   - **시나리오여야 한다.** "S3 Standard-IA의 최소 저장 기간은?" 같은 단순 암기는 SAA 문항이 아니다.
     (그런 문항은 `basics-ch*` 확인문제나 플래시카드로 보낸다.)
     회사·워크로드·제약이 있는 상황을 2~4문장으로 제시한다.
   - **한정어를 명시해야 한다.** `가장 비용 효율적인(MOST cost-effective)`,
     `운영 부담이 가장 적은(LEAST operational overhead)`, `가장 안전한(MOST secure)`,
     `가장 가용성이 높은(MOST highly available)`, `지연 시간이 가장 낮은(LOWEST latency)` 등.
     영문 한정어를 괄호로 병기하면 학습자가 실제 시험의 영문 표기에 익숙해진다.
     한정어 목록은 `saa/keywords.html` (한정어 키워드 사전)을 따른다.

7. **여러 선택지가 기술적으로 동작하되, 한정어가 하나를 고르게 만들어야 한다.**
   이것이 SAA 문항의 정의적 특성이다. 나머지 셋이 "틀린 답"인 문항은 SAA 문항이 아니라 퀴즈다.
   좋은 SAA 문항은 **"넷 다 요구사항은 충족하는데, MOST cost-effective 는 하나뿐"** 이다.
   그 대신 문제문에 **한정어를 반드시 넣어야** 정답이 유일해진다.
   한정어 없이 "가장 좋은 방법은?"이라고 쓰면 그 문항은 정답이 둘이 된다.

8. **명시된 제약을 위반하는 선택지를 하나쯤 둔다.**
   "인터넷을 경유해서는 안 된다"는 조건에 인터넷 게이트웨이를 쓰는 안처럼,
   **소거법 훈련**이 되는 오답이다. 다만 이런 오답이 넷 중 둘 이상이면 문항이 쉬워진다.

9. **최신성.** `PLAN.md` §0 최신성 표의 8개 항목을 현행 기준으로 쓴다.
   S3 최종 일관성, EC2-Classic, AWS SSO 옛 이름 등은 `--html` 패스가 본문에서 잡지만
   **문제 JSON은 그 검사를 받지 않는다.** 사람이 지켜야 한다.

10. **중복 금지.** 같은 사실을 묻는 문항을 세트 간에 복제하지 않는다.
    특히 모의고사 4세트는 서로, 그리고 도메인 연습과도 중복되지 않아야 한다 (`PLAN.md` §3-1).

---

## 10. 출제 각도 배분

한 세트 안에서 아래 비율을 목표로 한다. 한 각도로 쏠리면 학습 효과가 급감한다.

| 각도 | 비중 | 무엇을 묻는가 | 예 |
|---|---:|---|---|
| **개념** | **25%** | 동작 원리·모델·용어의 정확한 이해 | 동기 복제와 비동기 복제의 결과 차이, 상태 저장/비저장 |
| **서비스 선택** | **35%** | 요구사항 → 어떤 서비스인가 (**가장 큰 몫**) | 큐냐 스트림이냐, ALB냐 NLB냐, EFS냐 FSx냐 |
| **시나리오 설계** | **25%** | 여러 구성요소를 조합한 아키텍처 판단 | 3계층 구성 + DR 요구 + 비용 제약을 동시에 만족시키기 |
| **수치·한도** | **10%** | 반드시 외워야 하는 확정 수치 | Lambda 최대 900초, SQS 가시성 제한 시간 최대 12시간, LSI 5개·GSI 20개 |
| **정책·설정 읽기** | **5%** | 주어진 JSON/설정을 읽고 결과 판정 (`code` 필드 사용) | IAM 정책 문서를 주고 요청이 허용되는지 판정 |

- **수치·한도 문항은 `docs/FACT_SOURCES.md` §4에서 ✅확인됨인 값만 쓴다.**
  §5 "쓰지 말 것" 목록의 값(요금 전부, gp2 최대 IOPS, NAT Gateway 대역폭, Aurora 복제본 개수 등)으로
  문항을 만들지 않는다.
- **정책·설정 읽기 문항은 `code` 필드를 쓴다.** 문제문에 JSON을 붙여 넣지 않는다
  (`question` 260자 제한에 걸리고 코드 하이라이팅도 안 된다).

---

## 11. 금지

### 11-1. 덤프 사이트 — 참조 자체를 금지한다

아래 이름이 `refs[].url` 에 나타나면 **ERROR** 다
(`refs[0] 덤프 사이트 참조 금지: …`). HTML 본문에 나타나도 ERROR 다.

```
examtopics · validexamdumps · pass4success · skillcertpro
itexams · examcollection · certlibrary · briefmenow
```

- **복제 금지는 물론, "출제 경향 파악" 목적의 열람도 금지**한다.
  저작권 침해이자 AWS 자격증 NDA 위반이다.
- 모든 문항은 **공식 문서와 시험 가이드의 도메인·과제 진술만 보고 새로 창작**한다.
- WebSearch 를 쓸 때는 위 8개를 `blocked_domains` 로 넘긴다 (`FACT_SOURCES.md` §2).

### 11-2. 확인 못 한 수치로 문제를 만들지 않는다

- 확인 경로는 `docs/FACT_SOURCES.md` 다. **AWS 문서 웹사이트가 차단되어 있다는 사실은
  사실 확인을 건너뛸 핑계가 아니다.**
- "약", "대략", "일반적으로 알려진" 으로 얼버무리지 않는다. 확인 못 했으면 **그 문항을 만들지 않는다.**
- **금액은 어떤 것도 쓰지 않는다.** 비용은 정성적으로만 비교한다
  ("Standard-IA는 GB당 저장 비용이 더 낮지만 검색 요금이 부과된다" — 허용 /
   "GB당 월 0.023 USD" — 금지).
- 할인율(RI·Savings Plans·스팟), 무료 티어 한도, 엣지 로케이션 개수, 리전 총개수도 금지다.

### 11-3. 스케일 점수 오해를 유발하지 않는다

- 합격선 **720점은 100~1000 스케일 점수**이며 원점수 백분율과 1:1 대응하지 않는다.
- **"정답률 72%면 합격"** 류의 서술을 해설·태그·세트 제목 어디에도 쓰지 않는다.
- 모의고사 결과에 대해 "이 점수면 합격입니다" 라고 단정하지 않는다.
  결과 페이지는 백분율을 보여주되 대응 관계가 없음을 명시한다 (`PLAN.md` §3-3).
- 채점은 보상형(compensatory)이라 **도메인별 과락이 없다.** "보안에서 60% 미만이면 떨어진다" 도 거짓이다.
  진단 결과의 60%/80% 기준은 **우리 사이트의 학습 계획 임계값**일 뿐 시험 합격 기준이 아니다.

### 11-4. 기타

- **`SAA-C04` 를 언급하지 않는다.** 존재하지 않는 시험이다 (`PLAN.md` §0).
- 시험 범위 밖 서비스(CDK, CodePipeline, WorkSpaces, GameLift 등)를 정답으로 하는 문항을 만들지 않는다.
  **CloudFormation은 범위 안, CDK는 범위 밖**이다. 오답 선택지로 쓰는 것은 가능하지만
  그 경우 `distractorNotes` 에 범위 밖임을 밝힌다.
- `matching`/`ordering` 이 실제 시험에 나온다고 암시하지 않는다 (§3).

---

## 12. 엔진이 데이터를 소비하는 방식 — 알아 두어야 할 동작

`assets/js/quiz.js` 가 데이터를 다루는 방식 중, 데이터 작성에 영향을 주는 것들.

| 동작 | 데이터 작성에 미치는 영향 |
|---|---|
| `prepare()` 가 **선택지를 매번 섞고 A~E 글자를 다시 부여** | 해설·오답 노트에서 선택지를 글자로 지칭하면 안 된다 (§2-9) |
| `prepare()` 가 `pairs[].right` + `extraRights` 를 합쳐 중복 제거 후 섞음 | `right` 는 짧고 서로 명확히 다른 값이어야 한다 |
| `ordering` 은 섞은 결과가 정답과 같으면 한 칸 회전 | 그래도 `items` 는 저장 시점에 섞어 둔다 (§3-4) |
| `grade()` — `multiple` 은 집합 완전 일치, `ordering` 은 순서 완전 일치, `matching` 은 전 쌍 일치 + 빈칸 없음 | 부분 점수가 없다. 정답 개수를 늘리면 정답률이 급락한다 |
| `q.chapter` → 결과 화면의 `basics/{chapter}.html` 복습 링크 + `byChapter` 집계 | 챕터를 잘못 넣으면 엉뚱한 본문으로 보낸다 |
| `q.domain` → `byDomain` 집계 → `buildDiagnostic()` 의 학습 순서 | 문자열이 틀리면 그 도메인이 학습 계획에서 **조용히 사라진다** (§2-3) |
| `q.difficulty` → 난이도 배지 (쉬움/보통/어려움) | — |
| `q.type` 이 `matching`/`ordering` 이면 **`학습용 유형` 배지** 자동 표시 | 데이터에 배지 관련 필드를 넣을 필요 없다 |
| `q.exam` 이 `BASICS` 가 아니면 시험 코드 배지 표시 | — |
| `md()` 가 백틱과 `**…**` 만 변환 (이스케이프 후) | 다른 마크다운·HTML 은 그대로 문자로 보인다 |
| `refs[].title` 이 링크 텍스트, 없으면 URL 노출 | `title` 을 항상 넣는다 |
| `tags` 는 해설 하단에 그대로 노출 | 내부 약어 금지 |
| 키보드 1~5 로 선택지 토글 | 선택지는 최대 5개 |
| 진도는 `ag:progress:quiz` 에 **문항 id 로** 저장 | id 를 재사용하면 남의 기록을 덮어쓴다 (§2-1) |

### 12-1. 검증기의 알려진 문제 2건 — 이 경고는 무시한다

`checkQuestions()` 의 세트 통계 구간(문항 10개 이상인 모든 세트)에 다음 두 줄이 있다.

```js
if (s.type.matching === 0) warn(s.file, 1, 'matching 유형 문항이 없습니다 — 실제 시험에 출제됩니다');
if (s.type.ordering === 0) warn(s.file, 1, 'ordering(list order) 유형 문항이 없습니다 — 실제 시험에 출제됩니다');
```

- **메시지 내용이 사실과 다르다.** SAA-C03에는 이 두 유형이 출제되지 않는다 (§3).
  이 문구는 다른 시험을 전제로 작성된 잔여물이다.
- **`exam: "SAA"` 세트에서는 이 경고가 반드시 뜬다.** SAA 세트의 `matching`/`ordering` 은
  같은 검증기가 ERROR 로 막는 값이므로, 0이 되는 것이 정상이자 유일한 정답이다.
- 따라서 **SAA 세트에서 이 두 경고는 기대되는 출력이며 수정 대상이 아니다.**
  경고를 없애려고 SAA 세트에 학습용 유형을 넣으면 ERROR 로 빌드가 깨진다.
- `basics-ch*` 세트(10문항)에서는 배분표(§4)대로 각 1문항씩 넣으므로 경고가 뜨지 않는다.
- 검증기 소유자는 Wave 0 이며 이 파일은 문제 에이전트의 소유가 아니다. **직접 고치지 않는다.**

---

## 13. 제출 전 체크리스트

```bash
node tools/validate.mjs --questions
```

- [ ] `setId` = 파일명, `title`·`exam`·`domain`·`examCode` 전부 채움
- [ ] 모의고사·진단 세트에 `mock: true` / `diagnostic: true` 명시, `domain: "Mixed"`
- [ ] `id` 가 `{exam소문자}-{slug}-{3자리}` 이고 **전체 파일을 통틀어 중복 없음**
- [ ] SAA 문항의 `domain` 이 공식 문자열 4개와 **문자 단위로 일치**
- [ ] 모든 문항에 `chapter` (`ch01`~`ch18`)
- [ ] `difficulty` 3:5:2
- [ ] **`exam:"SAA"` 세트에 `matching`/`ordering` 0건**
- [ ] `single` = 선택지 4개 / `multiple` = 4~5개 + `(N개 선택)` 표기 + 정답 2개 이상
- [ ] `matching` = `pairs` 3~6, `right` 중복 없음, `extraRights` 1~3개
- [ ] `ordering` = `items` 4~6, **저장 순서 ≠ 정답 순서**
- [ ] 모든 오답 선택지에 `distractorNotes`
- [ ] `explanation` 3~6문장, 문제문 반복 없음, 원리 설명
- [ ] `refs` 최소 1개, 전부 `{url, title}` 객체이며 공식 문서 호스트
- [ ] `tags` 2~5개
- [ ] SAA 문항은 시나리오 + 한정어(MOST/LEAST) 명시
- [ ] 확인 못 한 수치·금액 0건, 덤프 사이트 참조 0건, `SAA-C04` 0건
- [ ] 남은 WARN 이 §12-1 의 2건(matching/ordering 없음)뿐인지 확인
