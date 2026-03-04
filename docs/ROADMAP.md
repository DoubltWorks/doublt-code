# doublt-code 구현 로드맵

> **버전**: v1.0
> **작성일**: 2026-03-04
> **기반 문서**: `IMPLEMENTATION_PLAN.md` (v1), `.omc/plans/doublt-code-implementation.md` (v2)
> **현재 상태**: Phase 1-4 구현 완료, Phase 5 테스트 & 문서 완료. 314개 유닛 테스트 통과.

---

## 개요

v1(기능 스펙)과 v2(아키텍처 분석)를 교차 검증한 결과, 총 **16건**의 미구현 또는 개선이 필요한 항목이 확인되었다.
이를 **5개 Phase**로 그룹화하여 의존성 순서대로 실행한다.

```
Phase 1 (Foundation) ──┬──> Phase 2 (Persistence) ──> Phase 4 (Mobile Offline)
                       │
                       └──> Phase 3 (Integration)
                                                    ╲
Phase 1-4 완료 ────────────────────────────────────────> Phase 5 (QA/Docs)
```

### Phase 요약

| Phase | 이름 | 작업 수 | 의존성 | 핵심 파일 |
|-------|------|---------|--------|----------|
| 1 | 기반 수정 (Foundation) | 6건 | 없음 | TerminalSyncManager, useDoublt, GitManager, TunnelManager, wire.ts |
| 2 | 영속화 완성 (Persistence) | 2건 | Phase 1 | JsonStore, DigestManager, PtyManager |
| 3 | 기능 통합 (Integration) | 3건 | Phase 1 | ClaudeSessionRunner, ApprovalPolicyManager, CLI index.ts |
| 4 | 모바일 오프라인 (Mobile) | 1건 | Phase 2 | OfflineStore, SyncQueue, DoubltClient |
| 5 | 테스트 & 문서 (QA/Docs) | 4건 | Phase 1-4 | PtyManager.test.ts, ROADMAP, IMPLEMENTATION_PLAN |

---

## Phase 1: 기반 수정 (Foundation)

### 목표
기존 스캐폴딩 코드의 치명적 갭을 해소하여 실제 동작하는 터미널 브릿지 기반을 확보한다. PTY 파이핑, CLI raw mode, Git 실행, 터널 안정화 등 핵심 인프라를 연결한다.

### 범위
- TerminalSyncManager ↔ PtyManager 양방향 파이핑 연결
- CLI raw mode를 PTY passthrough로 전환
- GitManager에서 실제 git 명령 실행 연결
- TunnelManager cloudflare/ngrok 프로세스 안정성 강화
- useDoublt 훅에서 실제 서버 데이터 바인딩 완성
- wire.ts 프로토콜에 scrollback 동기화 메시지 추가

### 작업 상세

#### 1-1. TerminalSyncManager PTY 파이핑 연결
- **현황**: 이벤트만 중계, 실제 PTY stdout/stdin 파이핑 없음 (v2 치명적 갭 #1)
- **수정 내용**:
  - `handleOutput(sessionId, data)` → PtyManager.onData 콜백에서 직접 호출되도록 연결
  - `handleInput(sessionId, data)` → PtyManager.write()로 전달
  - scrollback 버퍼 1000줄 보관, 세션 attach 시 buffered output 전송
- **수정 파일**: `packages/server/src/terminal/TerminalSyncManager.ts`
- **예상 크기**: ~50줄 수정

#### 1-2. CLI raw mode PTY passthrough
- **현황**: stdin → inputBuffer → chat 메시지 전송 (채팅 모드)
- **수정 내용**:
  - stdin → WebSocket → 서버 PTY stdin으로 직접 전달 (true terminal passthrough)
  - Ctrl-b 프리픽스 모드만 가로채기 유지
  - process.stdout에 PTY 출력 직접 쓰기
- **수정 파일**: `packages/cli/src/index.ts`
- **예상 크기**: ~80줄 수정

#### 1-3. GitManager 실제 git 명령 실행
- **현황**: 타입/이벤트 정의만 있고, child_process.exec 호출 미구현 (v1 Unit 5)
- **수정 내용**:
  - `getStatus()`: `git status --porcelain` + `git branch -v` 실행
  - `getLog()`: `git log --format` 실행
  - `getDiff()`: `git diff`, `git diff --staged` 실행
  - chokidar로 `.git/HEAD` 변경 감지 → 자동 상태 업데이트
  - 세션별 cwd 기반 git 상태 추적
- **수정 파일**: `packages/server/src/git/GitManager.ts`
- **참조 스펙**: `IMPLEMENTATION_PLAN.md` Unit 5 (Git Status Integration)
- **예상 크기**: ~120줄 수정/추가

#### 1-4. TunnelManager 안정성 강화
- **현황**: 기본 spawn 로직만 있고, 재연결/에러 복구 부족
- **수정 내용**:
  - 프로세스 크래시 시 자동 재시작 (최대 3회, 지수 백오프)
  - URL 파싱 타임아웃 처리 강화
  - ngrok 폴백 지원 (`cloudflare` 실패 시 `ngrok` 시도)
  - 정상 종료(graceful shutdown) 로직 추가
- **수정 파일**: `packages/server/src/tunnel/TunnelManager.ts`
- **예상 크기**: ~60줄 추가

#### 1-5. useDoublt 실제 서버 데이터 바인딩
- **현황**: 상태 정의는 있지만 서버 메시지 수신 시 상태 업데이트 로직 미흡
- **수정 내용**:
  - 서버 메시지 타입별 상태 업데이트 핸들러 완성 (git:status:result, cost:update 등)
  - approvalQueue, gitStatus, costEstimate 등 실제 데이터 연동
  - 연결 상태(connected/reconnecting/offline) 정확한 추적
- **수정 파일**: `packages/mobile/src/hooks/useDoublt.ts`
- **예상 크기**: ~100줄 수정/추가

#### 1-6. wire.ts scrollback 동기화 메시지 추가
- **현황**: terminal:output만 있고, scrollback bulk 전송 메시지 없음
- **수정 내용**:
  - `terminal:scrollback:request` (ClientMessage) — 세션 attach 시 클라이언트가 요청
  - `terminal:scrollback:result` (ServerMessage) — 버퍼링된 출력 일괄 전송
  - scrollback 메시지에 totalLines, offset 필드 추가
- **수정 파일**: `packages/shared/src/protocol/wire.ts`
- **예상 크기**: ~30줄 추가

### 수락 기준
- [x] `doublt start` 실행 시 실제 셸이 열리고 `ls`, `pwd` 등 커맨드 실행 가능
- [x] CLI 터미널 출력이 WebSocket을 통해 모바일에 실시간 표시
- [x] GitManager가 실제 `git status` 결과를 반환
- [x] TunnelManager 크래시 후 자동 재시작 동작
- [x] useDoublt에서 서버 이벤트 수신 시 상태가 정확히 업데이트
- [x] 세션 attach 시 scrollback 버퍼가 클라이언트에 전송됨
- [x] `pnpm build` 성공, 기존 227개 테스트 통과 유지

> **완료일**: 2026-03-04

### 검증 방법
```bash
pnpm build
pnpm test
# 수동: doublt start → 셸 명령어 실행 → 모바일 확인
```

---

## Phase 2: 영속화 완성 (Persistence)

### 목표
서버 재시작 시 상태가 소멸되는 문제를 해결한다. JsonStore를 각 매니저에 연동하고, DigestManager의 이벤트 로깅을 실제 연결하며, PtyManager scrollback을 디스크에 저장한다.

### 범위
- JsonStore ↔ 각 매니저 save/load 연동
- DigestManager 실제 이벤트 로깅 연결
- PtyManager scrollback 디스크 저장

### 이전 Phase 연동
- Phase 1에서 TerminalSyncManager에 추가된 scrollback 버퍼를 JsonStore에 저장
- Phase 1에서 GitManager가 생성하는 이벤트를 DigestManager에 로깅

### 작업 상세

#### 2-1. JsonStore ↔ 매니저 save/load 연동
- **현황**: JsonStore 클래스 존재하지만 매니저들이 호출하지 않음 (v2 치명적 갭 #5)
- **수정 내용**:
  - SessionManager, WorkspaceManager, TaskQueueManager, ApprovalPolicyManager에 `save()`/`load()` 메서드 추가
  - 상태 변경 시 debounced 자동 저장 (JsonStore의 1초 디바운스 활용)
  - 서버 시작 시 `DoubltServer.init()`에서 JsonStore.load() → 각 매니저에 상태 복원
  - 데이터 파일: `~/.doublt/data/{sessions,workspaces,tasks,policies,digest}.json`
  - JSON 파일 손상 시 `.bak` 백업에서 자동 복구
- **수정 파일**:
  - `packages/server/src/storage/JsonStore.ts` (매니저 연동 헬퍼 추가)
  - `packages/server/src/session/SessionManager.ts`
  - `packages/server/src/workspace/WorkspaceManager.ts`
  - `packages/server/src/taskqueue/TaskQueueManager.ts`
  - `packages/server/src/approval/ApprovalPolicyManager.ts`
  - `packages/server/src/index.ts` (init 시퀀스)
- **참조 스펙**: v2 Phase 4 (JSON 파일 영속화)
- **예상 크기**: 각 매니저 ~30줄 추가, JsonStore ~40줄 추가

#### 2-2. DigestManager 실제 이벤트 로깅 + PtyManager scrollback 저장
- **현황**: DigestManager가 이벤트 수신 구조만 있고 실제 매니저 이벤트와 미연결
- **수정 내용**:
  - DoubltServer에서 모든 매니저 이벤트를 DigestManager.logEvent()에 라우팅
    - SessionManager: session:created, session:archived
    - TerminalSyncManager: command:complete
    - HandoffManager: handoff:created
    - GitManager: git:new_commit (Phase 1에서 추가됨)
  - PtyManager scrollback 버퍼를 JsonStore에 저장 (세션별 마지막 500줄)
  - DigestManager 인메모리 이벤트도 JsonStore에 영속화
- **수정 파일**:
  - `packages/server/src/digest/DigestManager.ts`
  - `packages/server/src/terminal/PtyManager.ts`
  - `packages/server/src/index.ts`
- **예상 크기**: ~80줄 수정/추가

### 수락 기준
- [x] 서버 재시작 후 세션/워크스페이스/태스크 목록이 복원됨
- [x] `~/.doublt/data/` 디렉토리에 JSON 파일들이 생성됨
- [x] JSON 파일 손상 시 백업에서 자동 복구
- [x] DigestManager가 모든 매니저 이벤트를 실제로 로깅
- [x] 터미널 scrollback이 서버 재시작 후에도 유지됨
- [x] `pnpm build` 성공, 기존 테스트 통과 유지

> **완료일**: 2026-03-04

### 검증 방법
```bash
pnpm build && pnpm test
# 수동: doublt start → 세션 생성 → 서버 재시작 → 세션 목록 확인
# 수동: ~/.doublt/data/ 디렉토리 내용 확인
```

---

## Phase 3: 기능 통합 (Integration)

### 목표
claude CLI 자동 실행, full_auto 승인 프리셋, CLI 키바인딩 확장 등 핵심 기능을 통합하여 "자면서 코딩" 시나리오를 완성한다.

### 범위
- ClaudeSessionRunner ↔ PtyManager 연동
- ApprovalPolicyManager full_auto 프리셋 추가
- CLI 키바인딩 확장 (Ctrl-b a: 승인 토글, Ctrl-b t: 태스크 큐)

### 이전 Phase 연동
- Phase 1의 PtyManager PTY 파이핑이 동작해야 ClaudeSessionRunner가 claude를 PTY 안에서 실행 가능
- Phase 1의 TerminalSyncManager scrollback으로 claude 출력 모니터링

### 작업 상세

#### 3-1. ClaudeSessionRunner ↔ PtyManager 연동
- **현황**: ClaudeSessionRunner 클래스 존재, PtyManager 참조는 있으나 실제 실행 로직 미완성
- **수정 내용**:
  - `startClaude(sessionId, prompt?)`: PtyManager를 통해 PTY 안에서 `claude --dangerously-skip-permissions` 실행
  - claude 프로세스 상태 추적: idle/running/crashed/stopped/budget_paused
  - 크래시 감지 + 지수 백오프 재시작 (1s, 2s, 4s, 8s, 최대 5회)
  - 5회 초과 실패: 세션 → 'error' 상태, 모바일 알림
  - 무한 루프 방지: 태스크 실행 시간 상한 (기본 4시간)
  - 비용 안전장치: CostTracker 연동, 일일 예산 초과 시 자동 모드 일시 중지
- **수정 파일**: `packages/server/src/claude/ClaudeSessionRunner.ts`
- **참조 스펙**: v2 Phase 2 (claude CLI 실행 + 24/7 자동 모드)
- **예상 크기**: ~100줄 수정/추가

#### 3-2. ApprovalPolicyManager full_auto 프리셋
- **현황**: conservative/moderate/permissive 3종 프리셋만 존재 (v2 치명적 갭 #4)
- **수정 내용**:
  - `full_auto` 프리셋 추가: 모든 도구 자동 승인 (--dangerously-skip-permissions와 매핑)
  - 시간 기반 정책: `schedulePolicy(policyId, cronExpression)` — "22:00-08:00 자동 모드" 지원
  - 세션별 정책 오버라이드: `setSessionPolicy(sessionId, policyId)`
  - UI 상태 표시용 `isFullAuto(sessionId)` 메서드
- **수정 파일**:
  - `packages/server/src/approval/ApprovalPolicyManager.ts`
  - `packages/shared/src/types/approval.ts` (full_auto 프리셋 타입)
- **예상 크기**: ~60줄 추가

#### 3-3. CLI 키바인딩 확장
- **현황**: Ctrl-b + c/n/p/w/m/h/d 바인딩 존재
- **수정 내용**:
  - `Ctrl-b a`: 승인 정책 토글 (conservative ↔ full_auto)
  - `Ctrl-b t`: 태스크 큐 표시/관리 (간단한 TUI 리스트)
  - `Ctrl-b g`: Git 상태 표시
  - `Ctrl-b $`: 비용 요약 표시
  - 키바인딩 도움말(Ctrl-b ?) 업데이트
- **수정 파일**: `packages/cli/src/index.ts`
- **예상 크기**: ~80줄 추가

### 수락 기준
- [x] 세션에서 `claude --dangerously-skip-permissions` 자동 실행 가능
- [x] claude 크래시 시 자동 재시작 (지수 백오프, 최대 5회)
- [x] full_auto 프리셋 적용/해제 가능
- [x] 일일 예산 초과 시 자동 모드 일시 중지
- [x] Ctrl-b a/t/g/$ 키바인딩 동작
- [x] `pnpm build` 성공, 기존 테스트 통과 유지

> **완료일**: 2026-03-04

### 검증 방법
```bash
pnpm build && pnpm test
# 수동: doublt start → Ctrl-b a → full_auto 토글 확인
# 수동: 세션에서 claude 자동 실행 확인
```

---

## Phase 4: 모바일 오프라인 (Mobile Offline)

### 목표
모바일 앱이 오프라인 상태에서도 마지막 동기화된 데이터를 표시하고, 재연결 시 오프라인 중 누적된 액션을 자동 동기화한다.

### 범위
- OfflineStore 활성화 (AsyncStorage 기반 로컬 캐시)
- SyncQueue 활성화 (오프라인 액션 큐잉 + 재연결 시 플러시)
- DoubltClient 오프라인/재연결 로직 강화

### 이전 Phase 연동
- Phase 2의 JsonStore 영속화가 완료되어야 서버 측 상태가 안정적이므로, 모바일 캐시와 서버 상태의 동기화가 의미 있음
- Phase 1의 useDoublt 데이터 바인딩이 완성되어야 캐시할 데이터가 존재

### 작업 상세

#### 4-1. OfflineStore + SyncQueue 활성화 및 DoubltClient 연동
- **현황**: OfflineStore.ts, SyncQueue.ts 파일 존재하지만 DoubltClient에서 호출하지 않음
- **수정 내용**:
  - **OfflineStore 활성화**:
    - AsyncStorage 기반 메시지 캐시 (세션별 최근 200개)
    - 세션/워크스페이스 메타데이터 캐시
    - 알림 영속 저장
    - 캐시 만료 관리 (7일)
  - **SyncQueue 활성화**:
    - 오프라인 전송 큐 (chat:send, tool:approve 등)
    - 재연결 시 자동 플러시
    - 재시도 로직 (최대 3회, 지수 백오프)
    - 충돌 해결: server-wins 전략
  - **DoubltClient 연동**:
    - 연결 끊김 감지 → SyncQueue에 액션 큐잉
    - 재연결 시 SyncQueue 플러시 → 서버 상태와 동기화
    - useDoublt 마운트 시 OfflineStore에서 캐시 로드
    - 상태 변경 시 OfflineStore에 캐시 저장
- **수정 파일**:
  - `packages/mobile/src/services/OfflineStore.ts`
  - `packages/mobile/src/services/SyncQueue.ts`
  - `packages/mobile/src/services/DoubltClient.ts`
  - `packages/mobile/src/hooks/useDoublt.ts`
  - `packages/mobile/src/services/NotificationService.ts` (알림 영속 저장)
- **참조 스펙**: v1 Unit 6 (Offline Cache & Sync Queue), v2 Phase 4-2
- **예상 크기**: ~150줄 수정/추가

### 수락 기준
- [x] 모바일 앱이 오프라인 상태에서 마지막 동기화된 데이터 표시
- [x] 재연결 시 오프라인 중 누적된 액션이 서버에 전송됨
- [x] server-wins 충돌 해결 전략이 동작
- [x] 캐시 7일 만료 동작
- [x] `pnpm build` 성공, 기존 테스트 통과 유지

> **완료일**: 2026-03-04

### 검증 방법
```bash
pnpm build && pnpm test
# 수동: 모바일 앱 연결 → 서버 중지 → 앱에서 캐시 데이터 확인 → 서버 재시작 → 동기화 확인
```

---

## Phase 5: 테스트 & 문서 (QA/Docs)

### 목표
Phase 1-4에서 추가/수정된 코드에 대한 테스트를 보강하고, 문서를 최신화한다.

### 범위
- PtyManager 유닛 테스트 추가
- ClaudeSessionRunner 유닛 테스트 추가
- JsonStore 라운드트립 테스트 보강
- IMPLEMENTATION_PLAN.md 최신화 (완료 항목 체크)

### 이전 Phase 연동
- Phase 1-4의 모든 구현이 완료되어야 테스트 대상이 확정됨

### 작업 상세

#### 5-1. PtyManager 유닛 테스트
- **현황**: PtyManager.test.ts 파일 없음
- **수정 내용**:
  - 모킹된 node-pty로 스폰/종료/리사이즈 검증
  - TerminalSyncManager 연동 테스트: PTY 출력 → handleOutput 파이핑 확인
  - 에러 케이스: PTY 비정상 종료 시 세션 상태 업데이트
  - scrollback 버퍼 크기 제한 검증
- **생성 파일**: `packages/server/src/__tests__/pty-manager.test.ts`
- **예상 크기**: ~150줄

#### 5-2. ClaudeSessionRunner 유닛 테스트 보강
- **현황**: `claude-runner.test.ts` 존재하지만 PTY 연동 미반영
- **수정 내용**:
  - PTY 기반 claude 시작/종료 검증
  - 크래시 N회 후 중단 테스트
  - 예산 초과 일시정지 테스트
  - 태스크 실행 시간 상한 테스트
- **수정 파일**: `packages/server/src/__tests__/claude-runner.test.ts`
- **예상 크기**: ~80줄 추가

#### 5-3. JsonStore 라운드트립 테스트 보강
- **현황**: `json-store.test.ts` 존재하지만 매니저 연동 미반영
- **수정 내용**:
  - 각 매니저의 save → 서버 재시작 시뮬레이션 → load 라운드트립 검증
  - JSON 파일 손상 → 백업 복구 시나리오
  - debounce 동작 검증 (빠른 연속 저장 시 1회만 디스크 I/O)
- **수정 파일**: `packages/server/src/__tests__/json-store.test.ts`
- **예상 크기**: ~60줄 추가

#### 5-4. 문서 최신화
- **수정 내용**:
  - `IMPLEMENTATION_PLAN.md`에 Phase 1-4 완료 항목 체크
  - `.omc/plans/doublt-code-implementation.md` 상태 업데이트
  - 본 `ROADMAP.md`에 완료 일자 기록
- **수정 파일**: `IMPLEMENTATION_PLAN.md`, `.omc/plans/doublt-code-implementation.md`, `docs/ROADMAP.md`
- **예상 크기**: ~30줄 수정

### 수락 기준
- [x] `pnpm test` 통과 (기존 227개 + 신규 87개 = 314개 테스트)
- [x] PtyManager 테스트 커버리지: 스폰, 종료, 리사이즈, 에러, scrollback (30 tests)
- [x] ClaudeSessionRunner 테스트 커버리지: 시작, 크래시, 재시작, 예산, 시간제한 (24 tests)
- [x] JsonStore 라운드트립 테스트: save/load, 손상 복구, debounce (28 tests)
- [x] IMPLEMENTATION_PLAN.md가 현재 상태를 정확히 반영

> **완료일**: 2026-03-04

### 검증 방법
```bash
pnpm build && pnpm test
# 테스트 커버리지 확인
pnpm test -- --coverage
```

---

## 부록: 전체 수정 파일 목록

| Phase | 신규 파일 | 수정 파일 | 총 작업 파일 |
|-------|----------|----------|-------------|
| Phase 1 | 0 | 6 | 6 |
| Phase 2 | 0 | 8 | 8 |
| Phase 3 | 0 | 4 | 4 |
| Phase 4 | 0 | 5 | 5 |
| Phase 5 | 1 | 4 | 5 |
| **합계** | **1** | **27** | **28** |

## 부록: 아키텍처 컨벤션 (모든 Phase 공통)

- 모든 Manager는 `EventEmitter` 확장
- Wire 메시지는 `wire.ts`의 ClientMessage/ServerMessage 유니온에 추가
- 서버 매니저는 `packages/server/src/{feature}/` 디렉토리
- ID 생성: `crypto.randomUUID().slice(0, 8)`
- 공유 파일 수정 시 기존 코드 END에 추가 (유니온, 임포트, case)
- 모바일 테마: bg `#0f172a`, card `#1e293b`, text `#f8fafc`, accent `#3b82f6`
