# 기술·특성 효과 태그 정리

기술·특성 정보 창(검색, 포켓몬 상세 등)에 보이는 효과 목록이 **어디서 나오는지** 정리한 문서입니다.

- 모든 값은 공식 포켓로그 코드([pagefaultgames/pokerogue](https://github.com/pagefaultgames/pokerogue), 게임 1.12.2.8)를 직접 실행해서 뽑습니다.
- 추출 코드: [`scripts/official-export/dex.test.ts`](../scripts/official-export/dex.test.ts)
- 결과: `public/data/dex.json`의 `moveInfo`(기술), `abilityTags`(특성), `tagNames`(태그 이름), `procNames`(효과 이름)
- 개수는 지금 데이터 기준이며, 게임이 업데이트되면 달라질 수 있습니다.

## 1. 기술 기본 정보

| 항목 | 근거 |
|---|---|
| 타입, 분류(물리/특수/변화), 위력, 명중률, PP | 기술 정의(`new AttackMove(...)`, `new StatusMove(...)`)의 값 그대로 |
| 우선도 | 기술 정의의 우선도 값 (예: 속이기 +3, 신속 +2, 전광석화 +1, 방어 +4, 트릭룸 −7) |
| 기술머신 등급 (노말/슈퍼/하이퍼) | 상점 기술머신 등급표 `tmPoolTiers` (기술머신이 있는 기술 322개) |
| 기술머신 그림 | 아이템 그림 `tm_{타입}` |

## 2. 추가 효과 (확률과 함께 표시)

기술 속성에서 뽑습니다. 확률은 기술의 추가 효과 확률(`move.chance`)이고, 확률이 없으면 항상 발동입니다.

| 효과 | 근거 | 기술 수 |
|---|---|---|
| 사용자 능력치 변화 (공격·방어·특공·특방·스피드·명중·회피) | `StatStageChangeAttr` (자신 대상) | 2~28 |
| 사용자 공/방/특공/특방/스피드 전부 | `StatStageChangeAttr`가 능력치 5개 이상 | 5 |
| 상대 능력치 변화 | `StatStageChangeAttr` (상대 대상) | 2~27 |
| 중독·맹독·잠듦·얼음·마비·화상 부여 | `StatusEffectAttr` | 3~25 |
| 중독/마비/잠듦, 화상/마비/얼음 중 하나 | `MultiStatusEffectAttr` | 각 1 |
| 혼란 부여 | `ConfuseAttr` | 18 |
| 풀죽음 | `FlinchAttr` | 33 |

모으기 기술의 첫 턴 효과(예: 메테오빔의 특공 상승)도 포함합니다.

## 3. 기술 태그

### 대상·연속 공격
| 태그 | 근거 | 기술 수 |
|---|---|---|
| 대상: 무작위 적 | 대상 `RANDOM_NEAR_ENEMY` | 5 |
| 대상: 모든 적 | 대상 `ALL_NEAR_ENEMIES`, `ALL_ENEMIES` | 60 |
| 대상: 전체 필드 | 대상 `ALL_NEAR_OTHERS`, `ALL_OTHERS` | 20 |
| 2회 / 3회 / 10회 / 2~5회 공격 | `MultiHitAttr` 횟수 종류 | 11 / 4 / 1 / 15 |
| 2~3턴 동안 반복 | 역린류 `FRENZY` 상태 | 4 |

### 급소·반동·회복
| 태그 | 근거 | 기술 수 |
|---|---|---|
| 급소율 높음 / 급소 확정 | `HighCritAttr` / `CritOnlyAttr` | 25 / 6 |
| 사용자 급소율 +2 | `CRIT_BOOST` 상태 (기충전) | 1 |
| 사용자 공격 최대 | `CutHpStatStageBoostAttr` 6단계 이상 (배북) | 1 |
| HP 33% / 50% 소모 | `CutHpStatStageBoostAttr` 비율, 저주는 `CurseAttr` | 1 / 3 |
| 반동 HP 50% | `HalfSacrificialAttr`, HP 기준 `RecoilAttr` | 3 |
| 반동 피해의 50% / 33% / 25% | `RecoilAttr` 비율 | 2 / 6 / 4 |
| 30% 확률 2배 피해 | `DoublePowerChanceAttr` | 1 |
| 가한 피해의 100% / 75% / 50% 회복 | `HitHealAttr` 비율 | 1 / 2 / 10 |
| 상대 공격력만큼 회복 | `HitHealAttr` 능력치 기준 (힘흡수) | 1 |
| 상태 이상 / 수면 / 얼음 / 화상 회복 | `HealStatusEffectAttr` 대상 상태 | 6 / 1 / 45 / 1 |

### 교체·필드
| 태그 | 근거 | 기술 수 |
|---|---|---|
| 사용자 교체 / 상대 교체 | `ForceSwitchOutAttr`, 막말내뱉기 `PartingShotAttr` | 8 / 4 |
| 사용자 교체 불가 | `TRAPPED` 자신 대상, 물고버티기 `JawLockAttr` | 1 |
| 상대 교체 불가 | `TRAPPED` 상대 대상, `JawLockAttr`, 문어굳히기 `OCTOLOCK` | 8 |
| 상대를 가두고 피해 | `TrapAttr` | 10 |
| 장애물 제거 | `RemoveArenaTrapAttr` | 4 |
| 비 오는 날씨에서 항상 명중 | `ThunderAccuracyAttr`, `StormAccuracyAttr` | 5 |

### 기술 표시(플래그)
| 태그 | 근거 | 기술 수 |
|---|---|---|
| 접촉 기술 | `MAKES_CONTACT` | 271 |
| 소리 기반 기술 | `SOUND_BASED` | 33 |
| 대타출동 무시 | `IGNORE_SUBSTITUTE` 또는 소리 기술 (게임 규칙) | 72 |
| 특성 무시 | `IGNORE_ABILITIES` | 3 |
| 방어/지키기 무시 | `IGNORE_PROTECT` (자기 자신 대상 기술 제외) | 24 |
| 풀/방진 특성 무효 | `POWDER_MOVE` | 8 |
| 반사 불가 | 상대를 노리는 변화기 중 `REFLECTABLE` 없음 | 42 |
| 재지정 불가 | `BypassRedirectAttr` | 4 |
| 풀 타입에 씨뿌리기 불가 | `LeechSeedAttr` | 2 |
| 습기 특성에 방해됨 | 실패 조건 `failIfDampCondition` | 4 |

### 특성의 영향을 받는 기술
| 태그 | 근거 (게임 코드의 특성 조건) | 기술 수 |
|---|---|---|
| 우격다짐의 영향을 받음 | 우격다짐: 추가 효과 확률 1% 이상 (`move.chance >= 1`) | 206 |
| 테크니션으로 강화 | 테크니션: 위력 60 이하 (위력이 바뀌는 기술 제외) | 149 |
| 하늘의은총으로 확률 2배 | 하늘의은총: 추가 효과 확률 1~99% | 145 |
| 스킬링크로 최대 횟수 | 스킬링크: 2~5회 기술, 매 타 명중 판정 기술 | 18 |
| 짓궂은마음으로 우선도 +1 | 짓궂은마음: 변화기 | 266 |
| 질풍날개로 우선도 +1 (HP 가득) | 질풍날개: HP가 가득일 때 비행 기술 | 28 |
| 힐링시프트 특성 발동 | `HEALING_MOVE` (힐링시프트: 우선도 +3) | 37 |
| 춤꾼 / 바람타기 특성 발동 | `DANCE_MOVE` / `WIND_MOVE` | 12 / 19 |
| 예리함 / 철주먹 / 메가런처 / 옹골찬턱으로 강화 | `SLICING` / `PUNCHING` / `PULSE` / `BITING` | 32 / 25 / 7 / 10 |
| 이판사판으로 강화 | `RECKLESS_MOVE` | 16 |
| 방탄 특성에 무효 | `BALLBOMB_MOVE` | 26 |

### 다른 기술로 쓸 수 없는 기술
게임 코드의 목록(`invalid-moves.ts`)을 그대로 씁니다.

| 태그 | 목록 | 기술 수 |
|---|---|---|
| 손가락흔들기로 나오지 않음 | `invalidMetronomeMoves` | 42 |
| 조수로 나오지 않음 | `invalidAssistMoves` | 45 |
| 잠꼬대로 나오지 않음 | `invalidSleepTalkMoves` | 31 |
| 흉내쟁이로 따라 할 수 없음 | `invalidCopycatMoves` | 37 |
| 따라하기로 따라 할 수 없음 | `invalidMirrorMoveMoves` | 67 |
| 스케치 불가 | `invalidSketchMoves` | 1 |
| 앵콜 불가 | `invalidEncoreMoves` | 13 |
| 지시 불가 | `invalidInstructMoves` | 52 |
| 회복봉인에 막힘 | `healBlockedMoves` | 36 |
| 특성으로 타입이 바뀌지 않음 | `noAbilityTypeOverrideMoves` | 8 |

### 포켓로그 전용·구현 상태
| 태그 | 근거 | 기술 수 |
|---|---|---|
| 일격 기술 | `OneHitKOAttr` | 4 |
| 보스전에서 수정됨 | `OneHitKOAttr` (보스에게는 통하지 않음) | 4 |
| 보스에게 효과 없음 | 실패 조건 `failOnBossCondition` | 3 |
| 부분 구현됨 / 미구현 | 기술 이름 뒤 `(P)` / `(N)` 표시 | 9 / 14 |

## 4. 특성 태그

| 태그 | 근거 | 특성 수 |
|---|---|---|
| 전기·불꽃·땅·물 면역 | `TypeImmunityAbAttr` 대상 타입, 부유류 `UngroundedAbAttr` | 3 / 2 / 3 / 3 |
| 위협 면역 | `IntimidateImmunityAbAttr` | 4 |
| 특성 무시 (틀깨기류) | `MoveAbilityBypassAbAttr` | 4 |
| 비·모래·햇빛 생성 | 등장 시 날씨 변경 `PostSummonWeatherChangeAbAttr`, 맞으면 날씨 변경 `PostDefendWeatherChangeAbAttr` | 2 / 2 / 3 |
| 비·모래·눈·햇빛 시너지 | 날씨 조건 `getWeatherCondition(...)`, 날씨 회복·피해 막기, 날씨를 부르는 특성 | 6 / 4 / 5 / 9 |
| 더블배틀코롱 특성 | `DoubleBattleChanceAbAttr` (발광·개미지옥·노가드·사령탑) | 4 |
| 우격다짐의 영향을 받음 | 우격다짐 공격 뒤 꺼지는 조건 `sheerForceHitDisableAbCondition`, 위기회피·도망태세 `PostDamageForceSwitchAbAttr` | 6 |
| 무효화 불가 | 특성 표시 `unsuppressable` (위액·화학변화가스로 못 지움) | 18 |
| 교체 불가 | 특성 표시 `unreplaceable` (스킬스왑·고민씨 등으로 못 바꿈) | 23 |
| 복사 불가 | 특성 표시 `uncopiable` (트레이스·역할로 못 베낌) | 36 |
| 틀깨기류에 무시됨 | 특성 표시 `ignorable` | 85 |
| 쓰러져도 발동 | 특성 표시 `bypassFaint` | 36 |
| 부분 구현됨 / 미구현 | 특성 표시 `partial` / `unimplemented` | 1 / 3 |

## 5. 넣지 않은 것

| 항목 | 이유 |
|---|---|
| 무시 불가 (예전: 절대안깸·메탈프로텍트·매직가드·프리즘아머·스펙터가드·리밋실드) | 예전 도감 사이트가 손으로 고른 목록이라 게임 코드에 같은 기준이 없음. 정확한 기준인 "틀깨기류에 무시됨"으로 대신함 |
| 보이지않는주먹 (접촉 기술이 방어 무시) | 모든 접촉 기술에 해당해 "접촉 기술" 태그와 겹침 |
| 집단구타 연속 공격 횟수 | 파티 포켓몬 수만큼 때리는 방식이라 고정 횟수로 표시할 수 없음 |
| 스텔라 사용자 공/특공, 데미지, 우선도 효과 | 해당 기술이 없거나 다른 항목으로 표시됨 (0개) |

## 6. 예전 데이터(PokeRogue-Dex)와 달라진 점

- **반사 불가**: 45개 → 42개. 경혈찌르기·아로마테라피·치료방울·봉인은 상대를 노리지 않는 기술이라 빠졌고, 잠꼬대가 들어감
- **얼음 회복**: 16개 → 45개. 게임 코드에서 사용자의 얼음을 녹이는 기술이 더 많음
- **혼연일체·초상투영**: 게임처럼 폼 구분 없이 같은 이름으로 표시
- 그 밖의 기술 기본 정보(타입·분류·위력·명중·PP·우선도)와 습득 기술 목록은 예전 데이터와 완전히 같음

## 7. 다시 만드는 방법

게임이 업데이트되면 아래 순서로 다시 뽑습니다. 준비 단계는 [`scripts/export-official.mjs`](../scripts/export-official.mjs) 맨 위에 있습니다.

```
npm run export:official   # dex.json, official.json
npm run build:sprites     # 포켓몬·트레이너·바이옴 그림
```

태그 번호 0~74는 앱 코드(`src/lib/dex.ts`의 `TAG`)가 쓰므로 바꾸지 않고, 새 태그는 75번부터 뒤에 붙입니다.
