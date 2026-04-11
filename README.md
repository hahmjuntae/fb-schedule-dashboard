# FB Schedule Dashboard

Forbiz GW 개인별 주간 일정표를 읽어 FE 챕터 멤버별 T/OT/MM 요약과 상세 일정 목록을 보여주는 Chrome 확장프로그램입니다.

## 주요 기능

- GW 개인별 주간 뷰의 일정표를 파싱해 멤버별 T/OT 합계를 계산합니다.
- 요약 테이블에서 프로젝트별 T/OT, 주간 합계, MM을 한 번에 확인할 수 있습니다.
- T 시간이 40h 미만인 멤버는 요약 테이블과 상세 패널에서 빨간 경고로 표시합니다.
- OT가 있는 멤버는 상세 패널 상단에 OT 배지를 별도로 표시합니다.
- 멤버 상세 화면에서 요일별 stacked bar chart, 전체 프로젝트 비율 donut chart, 프로젝트별 상세 작업 목록을 확인할 수 있습니다.
- 상세 일정의 T/OT 작업 목록을 `Copy` 버튼으로 바로 복사할 수 있습니다.

## 설치 방법

### 방법 1. Release ZIP으로 설치

가장 간단한 설치 방법입니다.

1. GitHub Releases에서 최신 `fb-schedule-dashboard-v0.1.0.zip` 파일을 다운로드합니다.
2. 원하는 위치에 ZIP 파일을 압축 해제합니다.
3. Chrome에서 `chrome://extensions`를 엽니다.
4. 우측 상단의 `개발자 모드`를 켭니다.
5. `압축해제된 확장 프로그램을 로드합니다`를 누릅니다.
6. 압축 해제한 폴더를 선택합니다.
7. `https://gw.forbiz.co.kr/`의 개인별 주간 일정 화면에서 확장프로그램 아이콘을 클릭합니다.

### 방법 2. 소스에서 빌드해서 설치

개발하거나 직접 수정해서 사용할 때 적합합니다.

```bash
git clone https://github.com/hahmjuntae/fb-schedule-dashboard.git
cd fb-schedule-dashboard
npm ci
npm run build
```

이후 Chrome에서 다음 순서로 설치합니다.

1. Chrome에서 `chrome://extensions`를 엽니다.
2. 우측 상단의 `개발자 모드`를 켭니다.
3. `압축해제된 확장 프로그램을 로드합니다`를 누릅니다.
4. 프로젝트 root 폴더인 `fb-schedule-dashboard`를 선택합니다.
5. `https://gw.forbiz.co.kr/`의 개인별 주간 일정 화면에서 확장프로그램 아이콘을 클릭합니다.

## 사용 방법

1. GW에서 개인별 주간 일정표가 있는 화면으로 이동합니다.
2. 확장프로그램 아이콘을 누르거나 화면 우측 하단의 대시보드 버튼을 누릅니다.
3. 요약 테이블에서 멤버별 주간 T/OT/MM을 확인합니다.
4. `상세보기`를 눌러 프로젝트별 일정 상세와 차트를 확인합니다.
5. 필요한 작업 목록은 `Copy` 버튼으로 복사합니다.

## 개발 명령어

```bash
npm ci
npm run build
npm run dev
npx tsc --noEmit
```

## 릴리즈 패키징

릴리즈 ZIP은 `dist` 폴더 내용을 기준으로 만듭니다. ZIP 내부 최상단에 `manifest.json`, `content.js`, `background.js`, `icons/`가 있어야 Chrome에서 바로 로드할 수 있습니다.

```bash
npm run build
cd dist
zip -r ../release/fb-schedule-dashboard-v0.1.0.zip .
```

## 권한

- `activeTab`: 현재 활성 GW 탭에서 대시보드를 실행합니다.
- `scripting`: 확장 아이콘 클릭 시 콘텐츠 스크립트를 필요한 프레임에 주입합니다.
- `webNavigation`: GW 페이지 안의 프레임 중 일정표가 있는 프레임을 찾습니다.
- `host_permissions: https://gw.forbiz.co.kr/*`: GW 일정 화면에서만 동작합니다.
