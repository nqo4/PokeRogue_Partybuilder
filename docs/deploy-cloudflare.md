# Cloudflare Pages 배포 안내

이 사이트는 빌드 결과(`dist/`)가 정적 파일뿐이라 Cloudflare Pages 무료 플랜에서 그대로 돌아갑니다.
무료 플랜은 정적 파일 요청과 전송량에 월 한도가 없어서, 이용자가 늘어도 사이트가 멈추지 않습니다.

## 저장소에 이미 준비된 것

| 파일 | 역할 |
|---|---|
| `public/_headers` | 캐시 규칙. 빌드할 때 `dist/_headers`로 복사되고 Cloudflare가 읽습니다 |
| `.node-version` | 빌드 서버의 Node 버전 (22) |
| `vite.config.ts` 의 `base: "./"` | 어느 주소에 올려도 경로가 깨지지 않음 |

캐시 규칙:

- `assets/*` (해시가 붙은 JS·CSS): 1년 캐시
- `images/*` (스프라이트): 하루 캐시, 이후 최대 7일은 옛 그림을 먼저 보여주고 뒤에서 새로 받음
- `data/*` (도감 데이터): 1시간 캐시, 이후 최대 하루는 같은 방식
- `index.html`: 매번 새로 확인. 그래서 배포하면 바로 반영됩니다

빌드 결과는 파일 약 5,160개, 19MB입니다. 무료 플랜 한도(사이트당 2만 개, 파일당 25MiB) 안에 들어옵니다.

## 직접 해야 하는 일 (약 10분)

1. https://dash.cloudflare.com 에서 계정을 만듭니다 (무료, 결제수단 불필요).
2. 왼쪽 메뉴 **Workers & Pages** → **Create** → **Pages** 탭 → **Connect to Git**.
3. GitHub 계정을 연결하고 `nqo4/PokeRogue_Partybuilder` 저장소만 접근을 허용합니다.
4. 빌드 설정을 이렇게 넣습니다.

   | 항목 | 값 |
   |---|---|
   | Production branch | `main` |
   | Framework preset | `Vite` (또는 None) |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | 환경 변수 | 없음 |

5. **Save and Deploy**. 2~3분 뒤 `https://<프로젝트이름>.pages.dev` 주소가 생깁니다.
6. 그 주소에서 확인합니다.
   - 세이브 파일을 넣으면 보유 현황·파티 추천이 나오는지
   - 도감 이미지와 이로치 이미지가 보이는지
   - 브라우저 개발자 도구 → Network에서 `images/…png` 응답에 `cache-control: public, max-age=86400…`이 붙는지

이후에는 `main`에 푸시할 때마다 자동으로 배포됩니다 (무료 플랜 월 500회).

## 선택 사항

- **방문자 통계**: 프로젝트 → **Metrics** → Web Analytics 켜기. 쿠키 없이 방문 수를 봅니다.
- **나만의 주소**: 도메인을 사면(.com 연 1만5천 원 안팎) 프로젝트 → **Custom domains**에서 연결합니다.
  주소를 정해 두면 나중에 다른 곳으로 옮겨도 이용자가 쓰는 주소는 그대로입니다.
- **Vercel 정리**: 새 주소가 잘 돌아가는 걸 확인한 뒤 Vercel 프로젝트를 지우거나, 한동안 같이 둬도 됩니다.
  같이 두면 두 곳 모두 푸시마다 배포됩니다.

## 문제가 생기면

- 빌드 실패에 `tsc` 오류가 보이면: 로컬에서 `npm run build`가 통과하는지 먼저 확인합니다.
- 그림이 바뀌었는데 옛 그림이 보이면: 캐시 때문이며 최대 하루 안에 바뀝니다. 급하면 Cloudflare 프로젝트에서 다시 배포하거나 강력 새로고침(Ctrl+F5)을 합니다.
