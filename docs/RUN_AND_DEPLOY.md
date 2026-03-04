# doublt-code 실행 & 배포 가이드

## 목차

1. [사전 요구사항](#사전-요구사항)
2. [로컬 개발 환경 실행](#로컬-개발-환경-실행)
3. [doubltmux (CLI) 사용법](#doubltmux-cli-사용법)
4. [모바일 앱 실행](#모바일-앱-실행)
5. [프로덕션 빌드](#프로덕션-빌드)
6. [서버 배포](#서버-배포)
7. [모바일 앱 배포](#모바일-앱-배포)
8. [환경 변수](#환경-변수)
9. [아키텍처 개요](#아키텍처-개요)
10. [트러블슈팅](#트러블슈팅)

---

## 사전 요구사항

| 도구 | 최소 버전 | 용도 |
|------|----------|------|
| Node.js | 20.0.0+ | 런타임 |
| pnpm | 9.0+ | 패키지 매니저 |
| TypeScript | 5.5+ | 컴파일러 (workspace 설치됨) |
| Expo CLI | ~52.0 | 모바일 앱 빌드 |
| iOS Simulator / Android Emulator | - | 모바일 개발용 (선택) |

```bash
# Node.js 버전 확인
node -v   # v20.x.x 이상

# pnpm 설치 (없을 경우)
npm install -g pnpm

# Expo CLI 설치 (모바일 개발 시)
npm install -g expo-cli
```

---

## 로컬 개발 환경 실행

### 1단계: 의존성 설치

```bash
git clone <repo-url> doublt-code
cd doublt-code
pnpm install
```

### 2단계: 전체 빌드

shared 패키지를 먼저 빌드해야 server, cli가 참조할 수 있습니다.

```bash
# shared → server → cli 순서로 빌드
pnpm -C packages/shared build
pnpm -C packages/server build
pnpm -C packages/cli build
```

### 3단계: 서버 + CLI 개발 모드 실행

**터미널 1 — 서버 (dev 모드, 파일 변경 시 자동 재시작)**
```bash
pnpm run dev:server
```

**터미널 2 — CLI (dev 모드)**
```bash
pnpm run dev:cli
```

또는 빌드 후 한 번에 실행:
```bash
# doublt start는 서버 + CLI를 동시에 기동합니다
pnpm -C packages/cli start -- start
```

### 4단계: 테스트 실행

```bash
pnpm test                           # 전체 테스트
pnpm test:watch                     # 변경 감지 모드
pnpm test:coverage                  # 커버리지 포함
pnpm -C packages/shared test        # shared만
pnpm -C packages/server test        # server만
```

---

## doubltmux (CLI) 사용법

### 기본 명령어

```bash
# 서버 시작 + 기본 워크스페이스/세션 생성
doublt start

# 포트 지정
doublt start --port 9900

# 워크스페이스 이름 지정
doublt start --name my-project

# 실행 중인 서버에 연결
doublt connect ws://192.168.1.100:9800 --token <server-token>

# 모바일 페어링 안내
doublt pair
```

### 키바인딩 (tmux 호환, Ctrl-b 프리픽스)

| 키 | 동작 |
|----|------|
| `Ctrl-b c` | 새 세션 생성 |
| `Ctrl-b W` | 새 워크스페이스 생성 |
| `Ctrl-b n` | 다음 패인 |
| `Ctrl-b p` | 이전 패인 |
| `Ctrl-b 0-9` | 번호로 패인 이동 |
| `Ctrl-b w` | 세션 목록 |
| `Ctrl-b S` | 워크스페이스 목록 |
| `Ctrl-b m` | 모바일 페어링 코드 표시 |
| `Ctrl-b h` | 현재 세션 핸드오프 |
| `Ctrl-b a` | 승인 정책 표시 |
| `Ctrl-b t` | 태스크 큐 표시 |
| `Ctrl-b x` | 현재 패인 닫기 |
| `Ctrl-b d` | 디태치 (서버는 계속 실행) |
| `Ctrl-b ?` | 도움말 |
| `Ctrl-c` | 서버 종료 + 프로세스 종료 |

---

## 모바일 앱 실행

### 개발 모드

```bash
cd packages/mobile

# Metro bundler 시작 (QR 코드 표시)
pnpm start

# iOS 시뮬레이터
pnpm ios

# Android 에뮬레이터
pnpm android
```

### 모바일-PC 페어링 흐름

1. PC에서 `doublt start` 실행
2. 모바일 앱에서 **PairScreen** 진입
3. PC 터미널에 표시된 페어링 코드 또는 QR 코드 사용
4. 페어링 URL 형식: `doublt://pair?host=<ip>&port=<port>&code=<6자리>`
5. 페어링 성공 시 토큰 발급 → 자동 WebSocket 연결

### 모바일 앱 화면 구성

| 화면 | 설명 |
|------|------|
| PairScreen | PC와 페어링 |
| WorkspaceListScreen | 워크스페이스 목록 |
| SessionListScreen | 세션 목록 |
| ChatScreen | 세션 대화 |
| TerminalScreen | 터미널 출력 동기화 |
| ApprovalQueueScreen | 도구 사용 승인/거부 |
| ApprovalPolicyScreen | 승인 정책 관리 |
| TaskQueueScreen | 태스크 큐 관리 |
| DigestScreen | 활동 요약 |
| ActivityTimelineScreen | 활동 타임라인 |
| UsageDashboardScreen | 비용/사용량 대시보드 |
| SearchScreen | 전체 검색 |
| TemplateScreen | 세션 템플릿 |
| MacroScreen | 커맨드 매크로 |

---

## 프로덕션 빌드

### 서버 + CLI 빌드

```bash
# 전체 빌드 (shared → server → cli)
pnpm run build

# 개별 빌드
pnpm -C packages/shared build    # → packages/shared/dist/
pnpm -C packages/server build    # → packages/server/dist/
pnpm -C packages/cli build       # → packages/cli/dist/
```

빌드 출력:
- TypeScript → ES2022 JavaScript (Node16 모듈)
- 소스맵 포함 (`sourceMap: true`)
- 타입 선언 파일 포함 (`declaration: true`)

### 모바일 앱 빌드

```bash
cd packages/mobile

# Expo EAS Build 사용 (권장)
npx eas-cli build --platform ios
npx eas-cli build --platform android

# 로컬 프리빌드 (네이티브 프로젝트 생성)
npx expo prebuild

# iOS 릴리스 빌드
npx expo run:ios --configuration Release

# Android 릴리스 빌드
npx expo run:android --variant release
```

---

## 서버 배포

### Option A: 직접 배포 (VPS / EC2)

```bash
# 1. 프로덕션 빌드
pnpm run build

# 2. node_modules 설치 (프로덕션만)
pnpm install --prod

# 3. 서버 실행
node packages/server/dist/index.js
# 또는
DOUBLT_PORT=9800 node packages/server/dist/index.js
```

**systemd 서비스 파일 예시** (`/etc/systemd/system/doublt.service`):
```ini
[Unit]
Description=doublt-code server
After=network.target

[Service]
Type=simple
User=doublt
WorkingDirectory=/opt/doublt-code
ExecStart=/usr/bin/node packages/server/dist/index.js
Restart=on-failure
RestartSec=5
Environment=DOUBLT_PORT=9800
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable doublt
sudo systemctl start doublt
sudo systemctl status doublt
```

### Option B: Docker 배포

**Dockerfile** 예시:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY packages/shared/ packages/shared/
COPY packages/server/ packages/server/
RUN pnpm -C packages/shared build && pnpm -C packages/server build

FROM node:20-alpine
WORKDIR /app
RUN npm install -g pnpm

COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/shared/package.json packages/shared/
COPY --from=builder /app/packages/shared/dist/ packages/shared/dist/
COPY --from=builder /app/packages/server/package.json packages/server/
COPY --from=builder /app/packages/server/dist/ packages/server/dist/
RUN pnpm install --prod --frozen-lockfile

EXPOSE 9800
CMD ["node", "packages/server/dist/index.js"]
```

```bash
# 빌드 및 실행
docker build -t doublt-code .
docker run -d -p 9800:9800 --name doublt doublt-code
```

### Option C: fly.io 배포

```bash
# fly.io CLI 설치 후
fly launch --name doublt-code --region nrt
fly deploy
```

### 리버스 프록시 (Nginx + TLS)

WebSocket을 지원하는 Nginx 설정:

```nginx
server {
    listen 443 ssl http2;
    server_name doublt.example.com;

    ssl_certificate     /etc/letsencrypt/live/doublt.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/doublt.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:9800;
        proxy_http_version 1.1;

        # WebSocket 지원
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket 타임아웃 (heartbeat 간격보다 길게)
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }
}
```

---

## 모바일 앱 배포

### Expo EAS Build (권장)

```bash
cd packages/mobile

# EAS 프로젝트 설정
npx eas-cli init

# 프로파일 설정 (eas.json)
cat > eas.json << 'EOF'
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "ios": { "appleId": "your@email.com" },
      "android": { "track": "internal" }
    }
  }
}
EOF

# 빌드
npx eas-cli build --platform ios --profile production
npx eas-cli build --platform android --profile production

# 스토어 제출
npx eas-cli submit --platform ios
npx eas-cli submit --platform android
```

### OTA 업데이트 (Expo Updates)

```bash
# JavaScript 번들만 업데이트 (네이티브 변경 없을 때)
npx eas-cli update --branch production --message "Bug fix"
```

---

## 환경 변수

### 서버

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `DOUBLT_PORT` | `9800` | WebSocket 서버 포트 |
| `NODE_ENV` | `development` | 실행 환경 |

### CLI

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `DOUBLT_TOKEN` | - | 서버 인증 토큰 (`doublt connect` 시 사용) |

### 포트 구성

| 서비스 | 포트 | 프로토콜 |
|--------|------|----------|
| doublt server | 9800 | WebSocket (ws://) |
| doublt server (TLS) | 443 | WebSocket Secure (wss://) |
| Metro bundler (Expo) | 8081 | HTTP |

---

## 아키텍처 개요

```
┌─────────────────────────────────────────────────┐
│              doublt-code server (:9800)           │
│                                                   │
│  SessionManager ← WorkspaceManager               │
│  ConnectionManager (WebSocket, heartbeat 15s)     │
│  HandoffManager (HANDOFF.md 자동 생성)             │
│  AuthManager (토큰 + 페어링)                       │
│  ApprovalPolicyManager (승인 정책)                 │
│  TaskQueueManager (우선순위 큐)                     │
│  DigestManager (활동 로그, 10K 상한)               │
│  CostTracker (토큰 비용 추적)                      │
│  SearchManager (전문 검색 + 템플릿)                │
│  GitManager (git status 폴링)                     │
│  TerminalSyncManager (터미널 I/O)                 │
│  NotificationManager (푸시/인앱)                   │
└───────┬─────────────────────┬─────────────────────┘
        │ WebSocket            │ WebSocket
   ┌────┴─────┐          ┌────┴──────┐
   │  CLI/PC  │          │  Mobile   │
   │ doubltmux│          │ Expo app  │
   └──────────┘          └───────────┘
   동시 연결 — 모드 전환 없음
```

### 핵심 설계 원칙

- **No mode switching**: PC와 모바일이 동일 세션에 동시 연결
- **Heartbeat liveness**: 15초 ping, 30초 pong 타임아웃으로 좀비 연결 방지
- **Auto handoff**: 컨텍스트 사용량 85% 도달 시 자동 HANDOFF.md 생성 + 세션 전환
- **cmux-style sessions**: tmux 패인처럼 Ctrl-b 프리픽스로 다중 세션 관리

---

## 트러블슈팅

### 빌드 오류: `Cannot find module '@doublt/shared'`

shared 패키지를 먼저 빌드해야 합니다:
```bash
pnpm -C packages/shared build
```

### WebSocket 연결 실패

1. 서버가 실행 중인지 확인: `curl http://localhost:9800`
2. 방화벽에서 포트 9800이 열려 있는지 확인
3. 모바일에서 연결 시 PC의 로컬 IP 사용 (`192.168.x.x`, `localhost` 아님)

### 모바일 페어링 실패

1. PC와 모바일이 같은 네트워크에 있는지 확인
2. 페어링 코드는 5분 후 만료됨 — 새 코드 발급 필요 (`Ctrl-b m`)
3. VPN이 활성화되어 있으면 비활성화 후 재시도

### 세션 핸드오프가 동작하지 않음

- `contextUsage`가 0.85 이상이어야 자동 핸드오프 트리거
- 수동 핸드오프: `Ctrl-b h` 또는 모바일에서 핸드오프 버튼

### 테스트 실행 오류

```bash
# vitest가 설치되어 있는지 확인
pnpm ls vitest

# 설치 안 되어 있으면
pnpm add -D vitest @vitest/coverage-v8 -w
pnpm install
```

### 메모리 사용량이 높을 때

- DigestManager가 최대 10,000 이벤트를 저장 — 30초마다 7일 이상 오래된 이벤트 자동 정리
- SearchManager 인덱스가 커질 수 있음 — 서버 재시작으로 초기화

---

## 빠른 시작 요약

```bash
# 1. 클론 및 설치
git clone <repo> && cd doublt-code && pnpm install

# 2. 빌드
pnpm run build

# 3. 서버 + CLI 시작
doublt start

# 4. 모바일 앱 시작 (별도 터미널)
cd packages/mobile && pnpm start

# 5. 모바일에서 페어링 코드 입력 → 연결 완료!
```
