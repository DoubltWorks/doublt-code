# doublt-code 전체 구현 계획

## 현재 상태 (구현 완료)

### packages/shared (타입 & 프로토콜)
- `types/session.ts` — Session, ConnectedClient, SessionCreateOptions, SessionListItem
- `types/message.ts` — ChatMessage, ToolUseMessage, SessionNotification
- `types/workspace.ts` — Workspace, WorkspaceCreateOptions, WorkspaceListItem
- `types/terminal.ts` — TerminalOutput, TerminalInput, TerminalResize, LongRunningCommand
- `protocol/wire.ts` — 16 ClientMessage + 17 ServerMessage 타입, encode/decode
- `utils/handoff.ts` — HandoffData, generateHandoffMd, parseHandoffMd

### packages/server (서버 매니저)
- `session/SessionManager.ts` — 세션 CRUD, 클라이언트 attach/detach, context usage 추적
- `workspace/WorkspaceManager.ts` — 워크스페이스 CRUD, 세션 그룹화
- `websocket/ConnectionManager.ts` — WebSocket 서버, 하트비트, 메시지 라우팅
- `api/AuthManager.ts` — 토큰 인증, 모바일 페어링 (6자 코드 + QR)
- `handoff/HandoffManager.ts` — 자동/수동 핸드오프, HANDOFF.md 생성
- `terminal/TerminalSyncManager.ts` — 터미널 I/O 동기화, 장기 실행 명령 추적
- `notification/NotificationManager.ts` — 인앱/푸시 알림, 오프라인 큐
- `index.ts` — DoubltServer 오케스트레이터 (모든 매니저 이벤트 연결)

### packages/cli (CLI)
- `index.ts` — Commander.js 진입점, Ctrl-b 키바인딩, 실시간 스트리밍
- `bridge/ServerBridge.ts` — WebSocket 클라이언트, 자동 재연결
- `cmux/PaneManager.ts` — tmux 스타일 멀티 세션 관리
- `cmux/SessionPane.ts` — 개별 세션 렌더링
- `commands/index.ts` — CLI 명령 정의

### packages/mobile (React Native Expo)
- `screens/PairScreen.tsx` — 서버 연결 + 페어링
- `screens/WorkspaceListScreen.tsx` — 워크스페이스 목록
- `screens/SessionListScreen.tsx` — 세션 목록 + context bar
- `screens/ChatScreen.tsx` — 채팅 UI + 도구 승인 + 스트리밍
- `screens/TerminalScreen.tsx` — 터미널 출력 뷰어
- `screens/NotificationScreen.tsx` — 알림 센터
- `services/DoubltClient.ts` — WebSocket 클라이언트
- `services/NotificationService.ts` — 알림 관리
- `services/BackgroundTaskService.ts` — 백그라운드 연결 유지
- `hooks/useDoublt.ts` — 전역 상태 관리 훅

---

## 우선순위 매트릭스

### 평가 기준
- **Impact (영향도)**: 사용자 경험과 24/7 바이브코딩에 미치는 영향 (1-5)
- **Effort (구현 난이도)**: 코드량 + 복잡도 (1-5, 높을수록 어려움)
- **Dependency (의존성)**: 다른 기능과의 의존 관계 (0=독립, 1=약간, 2=강함)
- **Priority Score**: Impact × 2 - Effort + (3 - Dependency) = 높을수록 우선

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        우선순위 매트릭스                                      │
├────┬────────────────────────┬────────┬────────┬──────┬───────┬─────────────┤
│ #  │ Feature                │ Impact │ Effort │ Dep  │ Score │ Priority    │
├────┼────────────────────────┼────────┼────────┼──────┼───────┼─────────────┤
│ P1 │ Approval Policy System │   5    │   3    │  0   │  10   │ ★★★ 최우선  │
│ P2 │ Task Queue System      │   5    │   3    │  0   │  10   │ ★★★ 최우선  │
│ P3 │ Cost & Usage Tracking  │   4    │   2    │  0   │   9   │ ★★★ 최우선  │
│ P4 │ Git Status Integration │   4    │   3    │  0   │   8   │ ★★☆ 높음   │
│ P5 │ Catch-up Digest        │   4    │   3    │  1   │   7   │ ★★☆ 높음   │
│ P6 │ Search & Templates     │   3    │   3    │  1   │   5   │ ★☆☆ 중간   │
│ P7 │ Voice & Quick Actions  │   3    │   3    │  0   │   6   │ ★☆☆ 중간   │
│ P8 │ Offline Cache          │   3    │   4    │  1   │   4   │ ★☆☆ 중간   │
└────┴────────────────────────┴────────┴────────┴──────┴───────┴─────────────┘
```

### Impact vs Effort 매트릭스 (시각화)

```
  Impact ↑
    5 │  [P1 Approval] [P2 TaskQ]
      │
    4 │  [P3 Cost]     [P4 Git] [P5 Digest]
      │
    3 │  [P7 Voice]    [P6 Search] [P8 Offline]
      │
    2 │
      │
    1 │
      └──────────────────────────────────────→ Effort
        1       2       3       4       5
```

### 권장 구현 순서

**Phase 1 — 핵심 (병렬 실행 가능)**
1. **Approval Policy System** — 24/7 바이브코딩의 핵심. AI가 밤새 돌 때 위험한 작업 자동 차단/승인
2. **Task Queue System** — 작업 대기열 없이는 24/7 의미 없음. 자러 가면서 할일 큐에 넣어야 함
3. **Cost & Usage Tracking** — 비용 모니터링 없이 24/7는 위험. 예산 알림 필수

**Phase 2 — 가시성 (Phase 1 이후 병렬)**
4. **Git Status Integration** — PC에서 커밋/푸시 상태를 모바일에서 확인
5. **Catch-up Digest** — 아침에 일어나서 "어젯밤 뭐 했지?" 요약

**Phase 3 — 편의 (Phase 2 이후 병렬)**
6. **Search & Templates** — 워크스페이스/세션 검색, 반복 작업 템플릿
7. **Voice Input & Quick Actions** — 모바일 편의 기능
8. **Offline Cache** — 오프라인 지원

---

## 작업 단위 상세

### Unit 1: Approval Policy System (승인 정책 + 자동 승인)

**새로 생성:**
- `packages/shared/src/types/approval.ts`
  - `ApprovalRule` — 도구별 자동 승인 규칙 (tool pattern, action: auto_approve | require_confirm | block)
  - `ApprovalPolicy` — 규칙 집합 + 활성 상태
  - `ApprovalQueueItem` — 대기 중인 승인 요청 (toolName, input, sessionId, createdAt)
  - `ApprovalDecision` — 승인/거부 결정 (approved, reason, decidedBy)

- `packages/server/src/approval/ApprovalPolicyManager.ts`
  - 정책 CRUD (create, update, delete, list, getActive)
  - 도구 실행 요청 시 정책 매칭 (evaluateToolUse → auto_approve | require_confirm | block)
  - 승인 큐 관리 (enqueue, dequeue, listPending, decide)
  - AI 일시정지 신호 (pauseSession, resumeSession)
  - 이벤트: 'approval:needed', 'approval:decided', 'policy:updated'

- `packages/mobile/src/screens/ApprovalQueueScreen.tsx`
  - 대기 중 승인 목록 (도구명, 입력 미리보기, 시간)
  - 개별/일괄 승인/거부 버튼
  - 위험도 표시 (file write=주황, shell exec=빨강, read=녹색)

- `packages/mobile/src/screens/ApprovalPolicyScreen.tsx`
  - 규칙 리스트 + 추가/편집/삭제
  - 프리셋 (Conservative: 읽기만 자동승인, Moderate: 읽기+빌드 자동승인, Permissive: 대부분 자동승인)

**수정:**
- `wire.ts` — policy:set, policy:get, policy:list, approval:queue:list, approval:decide 메시지 추가
- `server/index.ts` — ApprovalPolicyManager 생성 및 이벤트 연결
- `DoubltClient.ts` — setPolicy, listPolicies, listApprovalQueue, decideApproval 메서드
- `useDoublt.ts` — approvalQueue, activePolicy 상태 추가
- `mobile/index.tsx` — ApprovalQueueScreen, ApprovalPolicyScreen 네비게이션
- `cli/index.ts` — Ctrl-b a 키바인딩 (승인 정책 토글)

---

### Unit 2: Task Queue & Scheduling System (작업 큐 + 스케줄링)

**새로 생성:**
- `packages/shared/src/types/taskqueue.ts`
  - `Task` — id, title, description, priority (critical|high|normal|low), status (queued|running|completed|failed|cancelled), sessionId, createdAt, startedAt, completedAt, result
  - `TaskQueue` — id, workspaceId, tasks[], maxConcurrent
  - `ScheduledTask` — Task + cronExpression, nextRunAt, lastRunAt, enabled

- `packages/server/src/taskqueue/TaskQueueManager.ts`
  - 큐 관리 (createTask, updateTask, deleteTask, reorderTasks, listTasks)
  - 우선순위 실행 (dequeueNext, startTask, completeTask, failTask)
  - 스케줄링 (scheduleTask, unscheduleTask, checkSchedule — 1분 간격 체크)
  - 세션 연동 (작업 시작 시 해당 세션에 chat:send로 지시)
  - 이벤트: 'task:created', 'task:started', 'task:completed', 'task:failed'

- `packages/mobile/src/screens/TaskQueueScreen.tsx`
  - 작업 목록 (우선순위별 색상, 상태 아이콘, 진행률)
  - 드래그 재정렬 (또는 up/down 버튼)
  - 새 작업 추가 (제목, 설명, 우선순위)
  - 작업 상세 (결과, 로그, 연결된 세션)

**수정:**
- `wire.ts` — task:create, task:update, task:delete, task:reorder, task:list 메시지
- `handoff.ts` — HandoffData에 pendingTasks 필드 추가
- `server/index.ts` — TaskQueueManager 연결
- `DoubltClient.ts` — createTask, updateTask, deleteTask, listTasks 메서드
- `useDoublt.ts` — tasks, taskQueue 상태
- `mobile/index.tsx` — TaskQueueScreen 네비게이션
- `cli/index.ts` — Ctrl-b t 키바인딩

---

### Unit 3: Catch-up Digest & Activity Timeline (캐치업 다이제스트)

**새로 생성:**
- `packages/shared/src/types/digest.ts`
  - `ActivityEvent` — type (message|tool_use|error|handoff|command|commit), sessionId, timestamp, summary, data
  - `DigestSummary` — period (since→until), sessionsActive, messagesCount, toolUseCount, errorsCount, commandsRun, keyEvents[], summary
  - `TimelineEntry` — timestamp, type, title, detail, sessionId
  - `HistoryPage` — messages[], hasMore, nextCursor

- `packages/server/src/digest/DigestManager.ts`
  - 이벤트 로깅 (logEvent — 모든 중요 이벤트 저장, 인메모리 + 최대 10000건)
  - 다이제스트 생성 (generateDigest(since) → DigestSummary)
  - 타임라인 (getTimeline(sessionId, options) → TimelineEntry[])
  - 메시지 히스토리 (getHistory(sessionId, cursor, limit) → HistoryPage)
  - 이벤트: 'digest:generated'

- `packages/mobile/src/screens/DigestScreen.tsx`
  - "무엇이 바뀌었나요?" 카드 형식 요약
  - 세션별 활동 요약 (메시지 수, 도구 사용, 에러)
  - 핵심 이벤트 하이라이트

- `packages/mobile/src/screens/ActivityTimelineScreen.tsx`
  - 시간순 이벤트 타임라인 (수직 스크롤)
  - 이벤트 타입별 아이콘/색상
  - 세션 필터

**수정:**
- `wire.ts` — digest:request, digest:result, timeline:request, timeline:result, history:request, history:result
- `server/index.ts` — DigestManager 연결, 모든 매니저 이벤트를 DigestManager에 로깅
- `DoubltClient.ts` — requestDigest, requestTimeline, requestHistory 메서드
- `useDoublt.ts` — digest, timeline, lastSeenTimestamp 상태
- `mobile/index.tsx` — DigestScreen, ActivityTimelineScreen 네비게이션

---

### Unit 4: Voice Input & Quick Actions (음성입력 + 퀵액션)

**새로 생성:**
- `packages/shared/src/types/quickaction.ts`
  - `QuickAction` — id, label, icon, action (chat_send | terminal_command | trigger_handoff | approve_all), payload
  - `CommandMacro` — id, name, command, description, category, usageCount

- `packages/mobile/src/services/VoiceService.ts`
  - 음성 인식 시작/중지 (expo-speech 또는 @react-native-voice/voice 래퍼)
  - 텍스트 변환 결과 콜백
  - 녹음 상태 관리

- `packages/mobile/src/components/VoiceInputButton.tsx`
  - 마이크 아이콘 버튼 (탭 토글)
  - 녹음 중 애니메이션 (맥동 효과)
  - 인식된 텍스트 실시간 표시

- `packages/mobile/src/components/QuickActionBar.tsx`
  - 가로 스크롤 액션 바 (Run tests, Build, Commit, Approve all, Handoff)
  - 커스텀 매크로 버튼
  - 카테고리 분류

- `packages/mobile/src/screens/MacroScreen.tsx`
  - 매크로 목록 (이름, 명령어, 사용 횟수)
  - 매크로 추가/편집/삭제
  - 카테고리별 분류

**수정:**
- `ChatScreen.tsx` — 입력 영역에 VoiceInputButton, 키보드 위에 QuickActionBar 통합
- `TerminalScreen.tsx` — 입력 영역에 QuickActionBar 통합
- `useDoublt.ts` — macros 상태, saveMacro/deleteMacro 메서드
- `mobile/index.tsx` — MacroScreen 네비게이션
- `shared/index.ts` — QuickAction, CommandMacro 타입 export

---

### Unit 5: Git Status Integration (Git 통합)

**새로 생성:**
- `packages/shared/src/types/git.ts`
  - `GitStatus` — branch, ahead, behind, staged[], modified[], untracked[], hasConflicts
  - `GitCommit` — hash, shortHash, message, author, timestamp, filesChanged
  - `GitDiff` — filePath, additions, deletions, hunks[]
  - `GitHunk` — oldStart, oldLines, newStart, newLines, content

- `packages/server/src/git/GitManager.ts`
  - git status 감지 (child_process.exec로 git status --porcelain, git branch -v)
  - 커밋 히스토리 (git log --format)
  - diff 조회 (git diff, git diff --staged)
  - 파일 감시 (chokidar로 .git/HEAD 변경 감지 → 자동 상태 업데이트)
  - 세션별 cwd 기반 git 상태 추적
  - 이벤트: 'git:status_changed', 'git:new_commit'

- `packages/mobile/src/screens/GitStatusScreen.tsx`
  - 브랜치 정보 + ahead/behind 카운트
  - 변경된 파일 목록 (staged/modified/untracked 구분)
  - 최근 커밋 히스토리 (5-10개)
  - 간단 diff 뷰어 (additions 녹색, deletions 빨강)

- `packages/mobile/src/components/GitStatusBadge.tsx`
  - 세션 카드에 표시할 컴팩트 뱃지 (브랜치명 + 변경 파일 수)

**수정:**
- `wire.ts` — git:status:request, git:status:result, git:log:request, git:log:result, git:diff:request, git:diff:result
- `handoff.ts` — HandoffData에 gitContext (branch, recent commits) 추가
- `server/index.ts` — GitManager 연결
- `DoubltClient.ts` — requestGitStatus, requestGitLog, requestGitDiff 메서드
- `useDoublt.ts` — gitStatus, gitLog 상태
- `SessionListScreen.tsx` — 세션 카드에 GitStatusBadge 추가
- `mobile/index.tsx` — GitStatusScreen 네비게이션

---

### Unit 6: Offline Cache & Sync Queue (오프라인 캐시)

**새로 생성:**
- `packages/shared/src/types/offline.ts`
  - `CachedMessage` — ChatMessage + cachedAt
  - `PendingAction` — id, type, payload, createdAt, retryCount
  - `SyncState` — lastSyncedAt, pendingCount, cacheSize

- `packages/mobile/src/services/OfflineStore.ts`
  - AsyncStorage 기반 메시지 캐시 (세션별 최근 200개)
  - 알림 영속 저장
  - 세션/워크스페이스 메타데이터 캐시
  - 캐시 만료 관리 (7일)

- `packages/mobile/src/services/SyncQueue.ts`
  - 오프라인 전송 큐 (chat:send, tool:approve 등)
  - 재연결 시 자동 플러시
  - 재시도 로직 (최대 3회)
  - 충돌 없는 병합 (타임스탬프 기반)

**수정:**
- `DoubltClient.ts` — 연결 끊김 시 SyncQueue에 큐잉, 재연결 시 플러시
- `useDoublt.ts` — 마운트 시 캐시 로드, 상태 변경 시 캐시 저장
- `NotificationService.ts` — AsyncStorage에 알림 영속 저장
- `shared/index.ts` — offline 타입 export

---

### Unit 7: Cost & Usage Tracking (비용 추적)

**새로 생성:**
- `packages/shared/src/types/cost.ts`
  - `TokenUsage` — inputTokens, outputTokens, totalTokens, model, timestamp
  - `CostEstimate` — usage: TokenUsage, estimatedCostUsd, sessionId
  - `UsageSummary` — period, totalTokens, totalCostUsd, bySession[], byDay[], budgetLimit, budgetUsed
  - `BudgetAlert` — threshold (0-1), triggered, message

- `packages/server/src/cost/CostTracker.ts`
  - 세션별 토큰 사용량 추적 (recordUsage)
  - 비용 추정 (모델별 가격표: claude-3-opus, sonnet, haiku)
  - 일별/주별 집계 (getDailySummary, getWeeklySummary)
  - 예산 관리 (setBudget, checkBudget → 80%, 90%, 100% 알림)
  - 이벤트: 'cost:updated', 'budget:alert', 'budget:exceeded'

- `packages/mobile/src/screens/UsageDashboardScreen.tsx`
  - 총 비용 카드 (오늘, 이번 주, 이번 달)
  - 세션별 비용 분석 차트 (바 차트 형태)
  - 일별 트렌드 (최근 7일)
  - 예산 게이지 + 알림 설정

- `packages/mobile/src/components/CostBadge.tsx`
  - 채팅 화면 헤더에 표시할 비용 뱃지 ($0.42 형태)

**수정:**
- `wire.ts` — cost:update, usage:request, usage:result, budget:set, budget:alert 메시지
- `server/index.ts` — CostTracker 연결
- `DoubltClient.ts` — requestUsage, setBudget 메서드
- `useDoublt.ts` — costEstimate, usageSummary 상태
- `ChatScreen.tsx` — 헤더에 CostBadge 추가
- `mobile/index.tsx` — UsageDashboardScreen 네비게이션

---

### Unit 8: Search & Session Templates (검색 + 템플릿)

**새로 생성:**
- `packages/shared/src/types/search.ts`
  - `SearchQuery` — query, scope (all|workspace|session), filters (type, dateRange)
  - `SearchResult` — type (message|session|workspace), id, title, snippet, matchScore, timestamp, sessionId
  - `SessionTemplate` — id, name, description, category, prompts[], cwdPattern, tags[]

- `packages/server/src/search/SearchManager.ts`
  - 전문 검색 (search — 인메모리 인덱스, 메시지/세션 이름/워크스페이스 이름 대상)
  - 필터링 (타입별, 날짜별, 세션별)
  - 결과 정렬 (관련도, 시간순)
  - 템플릿 관리 (createTemplate, listTemplates, deleteTemplate, useTemplate)
  - 내장 템플릿 (Code Review, Bug Fix, Feature Development, Refactoring)
  - 이벤트: 'search:indexed'

- `packages/mobile/src/screens/SearchScreen.tsx`
  - 검색 입력 + 실시간 결과
  - 결과 타입별 아이콘 (메시지/세션/워크스페이스)
  - 스니펫 하이라이팅
  - 필터 토글 (날짜, 타입)

- `packages/mobile/src/screens/TemplateScreen.tsx`
  - 템플릿 카테고리 (코드 리뷰, 버그 픽스, 기능 개발, 리팩토링)
  - 템플릿 상세 (프롬프트 목록, 설명)
  - 커스텀 템플릿 생성

- `packages/mobile/src/components/SearchBar.tsx`
  - 재사용 가능한 검색 입력 컴포넌트

**수정:**
- `wire.ts` — search:query, search:result, template:list, template:create, template:use 메시지
- `server/index.ts` — SearchManager 연결
- `DoubltClient.ts` — search, listTemplates, createTemplate, useTemplate 메서드
- `useDoublt.ts` — searchResults, templates 상태
- `WorkspaceListScreen.tsx` — 상단에 SearchBar 추가
- `mobile/index.tsx` — SearchScreen, TemplateScreen 네비게이션

---

## E2E 검증 방법

TypeScript 컴파일 체크 (테스트 인프라 없음):
```bash
cd /home/user/doublt-code
npx tsc --noEmit -p packages/shared/tsconfig.json
npx tsc --noEmit -p packages/server/tsconfig.json
npx tsc --noEmit -p packages/cli/tsconfig.json
```

## 아키텍처 컨벤션

- 모든 Manager는 `EventEmitter` 확장
- 새 타입은 `packages/shared/src/types/` 에 별도 파일 생성
- Wire 메시지는 `wire.ts`의 ClientMessage/ServerMessage 유니온에 추가
- 서버 매니저는 `packages/server/src/{feature}/` 디렉토리
- 모바일 테마: bg `#0f172a`, card `#1e293b`, text `#f8fafc`, accent `#3b82f6`
- ID 생성: `crypto.randomUUID().slice(0, 8)` 또는 nanoid
- 공유 파일 수정 시 기존 코드 END에 추가 (유니온, 임포트, case)
