# SkoolClass Desktop (Electron 쉘) — Implementation Plan

> 2026-07-11 시작. 채널톡 데스크톱 프로그램처럼 SkoolClass 웹앱을 감싸는 윈도우 데스크톱 앱.

## 목표

교직원용 SkoolClass 콘솔(https://skoolclass.vercel.app)을 바탕화면 프로그램으로 제공:

- 바탕화면/작업표시줄 아이콘으로 실행되는 독립 창
- **X를 눌러도 종료되지 않고 트레이 상주** (채널톡 방식) — 창이 닫혀 있어도 뱃지·알림 유지
- **작업표시줄 안읽음 뱃지** — 웹앱의 통합 안읽음 카운트(학부모챗+승인요청+비회원문의+팀챗)를 오버레이 아이콘으로 표시
- 부팅 시 자동 실행 (트레이로 조용히 시작)
- 네이티브 윈도우 알림
- GitHub Releases 자동 업데이트 (electron-updater)

## 아키텍처 결정

| 결정 | 선택 | 이유 |
|---|---|---|
| 콘텐츠 | **운영 URL 로드** (번들 아님) | 웹 배포(git push→Vercel) = 앱 업데이트. 쉘은 트레이/뱃지만 담당하므로 거의 안 바뀜 |
| 코드 서명 | **안 함** | 내부(로즈몬트 선생님) 전용. 최초 설치 시 SmartScreen "추가 정보→실행" 1회 안내로 갈음 |
| 배포 | **GitHub Releases (이 리포, public)** | electron-updater가 익명으로 업데이트 체크 가능. 쉘 소스엔 시크릿 없음 (웹앱 소스는 별도 private 리포) |
| 설치본 | NSIS 원클릭, per-user | 관리자 권한 없이 설치 가능 |
| 뱃지 전달 | preload 브릿지 `window.skoolDesktop.setBadge(n)` | 웹앱(AppLayout)이 이미 계산하는 카운트를 한 줄로 전달. Windows는 Badging API 미지원이라 setOverlayIcon 사용 |

## 웹앱(skoolclass-pro) 측 변경

- `AppLayout.tsx` 뱃지 effect에 `window.skoolDesktop?.setBadge(count)` 한 줄 추가 (Electron에서만 존재, 브라우저/PWA에서는 no-op → 기존 setAppBadge 경로 유지)

## 주의사항 (함정)

- **구글 OAuth**: 구글이 Electron UA를 차단(disallowed_useragent)할 수 있음 → UA에서 `Electron/x.y`, `SkoolClass/x.y` 토큰 제거로 우회. 직원 기본 로그인은 이메일/비번이라 영향 최소
- **팝업/외부 링크**: 소셜 로그인 팝업(구글/카카오/네이버/수파베이스)은 앱 안에서 허용, 그 외 외부 링크는 기본 브라우저로
- **오프라인**: 로드 실패 시 offline.html 표시 + 자동 재시도
- **알림**: `app.setAppUserModelId`가 electron-builder appId(`kr.rosemont.skoolclass`)와 일치해야 윈도우 토스트 정상 동작
- **업데이트 파일**: 릴리즈에 `SkoolClass-Setup-x.y.z.exe` + `latest.yml` + `.blockmap` 3종 모두 업로드해야 자동 업데이트 동작

## 체크리스트

- [x] 스캐폴딩: package.json / src/main.js / src/preload.js / src/offline.html
- [x] 아이콘: icon.ico(멀티사이즈), tray.png, 오버레이 뱃지 1~9·9+
- [x] npm install + `npm start` 스모크 테스트 (타이틀·SPA 라우팅 확인. 주의: VSCode 계열 터미널에서 실행 시 `ELECTRON_RUN_AS_NODE` 제거 필요)
- [x] skoolclass-pro AppLayout 브릿지 추가 + 타입체크 (웹 배포는 별도)
- [x] GitHub 리포 생성(RosemontAcademy/SkoolClass-App, public) + 푸시
- [x] electron-builder 설치본 빌드
- [x] v1.0.0 릴리즈 업로드 (exe + latest.yml + blockmap)
- [ ] 실제 PC 설치 테스트: 로그인 유지 / 뱃지 / 트레이 / 알림 / 자동 업데이트(1.0.1 올려서 확인)
  - 확인 항목: 첫 실행 시 구글 로그인 창이 뜨는 현상 재현 여부 (dev 스모크 테스트에서 1회 관찰)
- [ ] 선생님 설치 안내문 (SmartScreen 스크린샷 포함)

## 릴리즈 절차 (쉘 업데이트 시)

1. `package.json` version 올리기 (예: 1.0.1)
2. `npm run dist` → `dist/` 에 설치본 생성
3. `gh release create v1.0.1 dist/SkoolClass-Setup-1.0.1.exe dist/latest.yml "dist/SkoolClass-Setup-1.0.1.exe.blockmap" --title v1.0.1`
4. 설치된 앱들이 6시간 주기(또는 트레이 메뉴 '업데이트 확인')로 자동 감지·설치
