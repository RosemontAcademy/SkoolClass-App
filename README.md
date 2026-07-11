# SkoolClass Desktop

로즈몬트 교직원용 SkoolClass 콘솔의 윈도우 데스크톱 앱입니다.
웹앱(https://skoolclass.vercel.app)을 감싸는 얇은 Electron 쉘로, 트레이 상주·작업표시줄 안읽음 뱃지·부팅 시 자동 실행·자동 업데이트를 제공합니다.

## 설치 (선생님용)

1. [Releases](https://github.com/RosemontAcademy/SkoolClass-App/releases/latest)에서 `SkoolClass-Setup-x.y.z.exe` 다운로드
2. 실행 — 파란색 "Windows의 PC 보호" 창이 뜨면 **추가 정보 → 실행**을 눌러주세요 (내부 배포용이라 서명이 없어 뜨는 정상 안내입니다. 최초 1회만)
3. 설치가 끝나면 자동 실행되고 바탕화면에 SkoolClass 아이콘이 생깁니다

### 사용 팁

- 창을 **X로 닫아도 종료되지 않고** 우측 하단 트레이에 남아 안읽음 뱃지와 알림을 계속 받습니다
- 완전히 종료하려면 트레이 아이콘 우클릭 → **종료**
- 트레이 아이콘 우클릭 → **시작 시 자동 실행**을 켜면 부팅할 때 조용히 시작됩니다
- 새 버전은 자동으로 받아 다음 실행 때 적용됩니다 (수동 확인: 트레이 → 업데이트 확인)

## 개발

```bash
npm install
npm start          # 개발 실행
npm run icons      # assets/ico/*.png → assets/icon.ico 재생성
npm run dist       # 설치본 빌드 (dist/)
```

### 릴리즈

```bash
# 1. package.json version 올리기 (예: 1.0.1)
# 2. 빌드
npm run dist
# 3. GitHub 릴리즈 (exe + latest.yml + blockmap 3종 필수 — 자동 업데이트가 읽음)
gh release create v1.0.1 "dist/SkoolClass-Setup-1.0.1.exe" "dist/SkoolClass-Setup-1.0.1.exe.blockmap" dist/latest.yml --title v1.0.1
```

웹앱 기능 변경은 이 리포와 무관합니다 — skoolclass 리포에서 웹 배포하면 앱에 즉시 반영됩니다.
이 쉘 자체(트레이/뱃지/업데이트 로직)를 바꿀 때만 릴리즈를 올리면 됩니다.
