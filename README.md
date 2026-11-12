# 포켓로그 파티 빌더

포켓로그(PokéRogue) 세이브 파일(.prsv)을 올리면 보유 포켓몬을 분석해서 스타팅 파티를 추천하는 웹 서비스입니다.
세이브는 브라우저 안에서만 복호화하고, 서버로 보내지 않습니다.

## 현재 상태 (프로토타입)

- [x] 세이브 복호화·파싱 (특성/패시브/알기술 해금, 이로치 럭, 개체치, 성격, 코스트 감소, 클래식 클리어 횟수)
- [x] 보유 스타터 현황 화면 (클래식 미클리어 필터, 세대·타입(진화·폼 포함)·이름 필터, 정렬, 진화 계열 상세)
- [x] 클래식 미클리어 포켓몬 파티 추천 (역할 판정, 특성·패시브 반영 약점 분석, 보완 후보)
- [x] 포켓몬 도감(모든 형태, 못 잡은 형태 표시), 진화 조건, 트레이너 도감, 바이옴 안내, 지도 경로 추천
- [ ] 원하는 포켓몬 고정, 챌린지(단일 세대/타입, 새출발)
- [ ] 무한모드

## 개발

```bash
npm install
npm run build:dex   # PokeRogue-Dex 를 vendor/ 에 받아 public/data/dex.json 생성
npm run export:official   # (선택) 공식 저장소에서 진화·바이옴·트레이너 데이터 추출. 준비 단계는 scripts/export-official.mjs 맨 위 참고
npm run dev
npm test            # testdata/*.prsv 또는 SAVE_PATH 가 있으면 실제 세이브 테스트도 실행
```

세이브 파일은 개인 데이터이므로 `testdata/` 에 두며 git 에 올리지 않습니다 (`.gitignore`).

## 구조

| 경로 | 내용 |
|---|---|
| `scripts/build-dex.mjs` | Dex 데이터 → 정규화 JSON 변환 |
| `src/lib/save.ts` | 세이브 복호화, 원본 구조 타입 |
| `src/lib/rules.ts` | 공식 클라이언트와 대조한 게임 규칙 (DexAttr, 코스트 감소, 성격 등) |
| `src/lib/dex.ts` | 도감 데이터 타입·조회 |
| `src/lib/starters.ts` | 세이브 + 도감 → 보유 스타터 모델 |
| `src/lib/classic/` | 클래식 추천: 후보 평가(역할), 파티 분석(상성), 빔 탐색 |
| `src/config/*.json` | 추천 규칙·특성 효과 설정 (패치 시 이 파일만 수정) |
| `scripts/export-official.mjs`, `scripts/official-export/` | 공식 저장소 안에서 실행하는 추출 스크립트 → `public/data/official.json` |
| `src/lib/official.ts`, `src/lib/route.ts` | 공식 데이터 타입·조회, 지도 경로 추천 |
| `scripts/try-recommend.ts` | 개발용: 실제 세이브로 추천 결과 콘솔 출력 (`npx vite-node scripts/try-recommend.ts`) |

## 출처와 라이선스

- 포켓몬 데이터: [Sandstormer/PokeRogue-Dex](https://github.com/Sandstormer/PokeRogue-Dex) (AGPL-3.0)
- 게임 규칙 확인: [pagefaultgames/pokerogue](https://github.com/pagefaultgames/pokerogue) (AGPL-3.0)

위 저장소의 데이터를 가공해 사용하므로 이 프로젝트도 AGPL-3.0 을 따릅니다.
팬이 만든 비공식 도구이며 포켓로그 개발팀과 관련이 없습니다. 포켓몬 관련 명칭의 권리는 Nintendo · Creatures · GAME FREAK 에 있습니다.
