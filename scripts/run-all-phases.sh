#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# run-all-phases.sh — doublt-code 로드맵 Phase 자동 실행 스크립트
#
# 각 Phase를 claude CLI `/ralph`로 자동 실행한다.
# 사용법:
#   ./scripts/run-all-phases.sh              # Phase 1~5 전체 실행
#   ./scripts/run-all-phases.sh --start 2    # Phase 2부터 실행
#   ./scripts/run-all-phases.sh --start 1 --end 3  # Phase 1~3만 실행
#   ./scripts/run-all-phases.sh --help       # 도움말
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$PROJECT_DIR/logs"

START_PHASE=1
END_PHASE=5

# --- 색상 코드 ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# --- 함수 ---

usage() {
  cat <<'USAGE'
doublt-code 로드맵 Phase 자동 실행 스크립트

사용법:
  ./scripts/run-all-phases.sh [옵션]

옵션:
  --start N    시작 Phase 번호 (기본: 1)
  --end N      종료 Phase 번호 (기본: 5)
  --help       이 도움말 표시

예시:
  ./scripts/run-all-phases.sh                    # Phase 1~5 전체 실행
  ./scripts/run-all-phases.sh --start 2          # Phase 2~5 실행
  ./scripts/run-all-phases.sh --start 1 --end 3  # Phase 1~3만 실행
  ./scripts/run-all-phases.sh --start 3 --end 3  # Phase 3만 실행

각 Phase는 claude --dangerously-skip-permissions 로 실행됩니다.
로그는 logs/phase-{N}-{timestamp}.log 에 저장됩니다.

Phase 구성:
  Phase 1: 기반 수정 (Foundation) — 6건
  Phase 2: 영속화 완성 (Persistence) — 2건
  Phase 3: 기능 통합 (Integration) — 3건
  Phase 4: 모바일 오프라인 (Mobile) — 1건
  Phase 5: 테스트 & 문서 (QA/Docs) — 4건
USAGE
}

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

log_phase() {
  echo -e "\n${CYAN}========================================${NC}"
  echo -e "${CYAN}  Phase $1: $2${NC}"
  echo -e "${CYAN}========================================${NC}\n"
}

check_prerequisites() {
  if ! command -v claude &>/dev/null; then
    log_error "claude CLI가 PATH에 없습니다. 먼저 설치하세요."
    exit 1
  fi
  if ! command -v pnpm &>/dev/null; then
    log_error "pnpm이 PATH에 없습니다. 먼저 설치하세요."
    exit 1
  fi
  if [ ! -f "$PROJECT_DIR/package.json" ]; then
    log_error "프로젝트 루트를 찾을 수 없습니다: $PROJECT_DIR/package.json"
    exit 1
  fi
  if [ ! -f "$PROJECT_DIR/docs/ROADMAP.md" ]; then
    log_error "로드맵 문서가 없습니다: docs/ROADMAP.md"
    exit 1
  fi
}

run_phase() {
  local phase_num=$1
  local phase_name=$2
  local timestamp
  timestamp=$(date +%Y%m%d-%H%M%S)
  local log_file="$LOG_DIR/phase-${phase_num}-${timestamp}.log"

  log_phase "$phase_num" "$phase_name"
  log_info "로그 파일: $log_file"

  local prompt
  prompt=$(get_phase_prompt "$phase_num")

  log_info "claude 실행 중... (Phase $phase_num)"

  if claude --dangerously-skip-permissions -p "$prompt" 2>&1 | tee "$log_file"; then
    log_success "Phase $phase_num 완료!"
    return 0
  else
    local exit_code=$?
    log_error "Phase $phase_num 실패! (exit code: $exit_code)"
    log_error "로그 확인: $log_file"
    return $exit_code
  fi
}

get_phase_prompt() {
  local phase_num=$1

  case $phase_num in
    1)
      cat <<'PROMPT'
/ralph 다음 작업을 수행해:

## 참조 문서
- docs/ROADMAP.md Phase 1 섹션
- IMPLEMENTATION_PLAN.md (v1 스펙 참조)
- .omc/plans/doublt-code-implementation.md (v2 아키텍처 참조)

## 작업 내용: Phase 1 — 기반 수정 (Foundation)

6건의 작업:

### 1-1. TerminalSyncManager PTY 파이핑 연결
- TerminalSyncManager.handleOutput()를 PtyManager.onData 콜백에서 직접 호출되도록 연결
- TerminalSyncManager.handleInput()이 PtyManager.write()로 전달하도록 수정
- scrollback 버퍼 1000줄 보관, 세션 attach 시 buffered output 전송
- 수정 파일: packages/server/src/terminal/TerminalSyncManager.ts

### 1-2. CLI raw mode PTY passthrough
- stdin을 WebSocket을 통해 서버 PTY stdin으로 직접 전달 (true terminal passthrough)
- Ctrl-b 프리픽스 모드만 가로채기 유지
- process.stdout에 PTY 출력 직접 쓰기
- 수정 파일: packages/cli/src/index.ts

### 1-3. GitManager 실제 git 명령 실행
- getStatus(): git status --porcelain + git branch -v 실행
- getLog(): git log --format 실행
- getDiff(): git diff, git diff --staged 실행
- chokidar로 .git/HEAD 변경 감지 -> 자동 상태 업데이트
- 수정 파일: packages/server/src/git/GitManager.ts

### 1-4. TunnelManager 안정성 강화
- 프로세스 크래시 시 자동 재시작 (최대 3회, 지수 백오프)
- URL 파싱 타임아웃 처리 강화
- ngrok 폴백 지원
- 정상 종료(graceful shutdown) 로직 추가
- 수정 파일: packages/server/src/tunnel/TunnelManager.ts

### 1-5. useDoublt 실제 서버 데이터 바인딩
- 서버 메시지 타입별 상태 업데이트 핸들러 완성
- approvalQueue, gitStatus, costEstimate 등 실제 데이터 연동
- 연결 상태 정확한 추적
- 수정 파일: packages/mobile/src/hooks/useDoublt.ts

### 1-6. wire.ts scrollback 동기화 메시지 추가
- terminal:scrollback:request (ClientMessage) 추가
- terminal:scrollback:result (ServerMessage) 추가
- scrollback 메시지에 totalLines, offset 필드 추가
- 수정 파일: packages/shared/src/protocol/wire.ts

## 실행 순서
1. /ralplan 으로 구현 계획 컨센서스 도출
2. 계획대로 구현
3. pnpm build && pnpm test 검증
4. git add && git commit (Phase 1 완료 메시지)

## 수락 기준
- doublt start 실행 시 실제 셸이 열리고 명령어 실행 가능
- CLI 터미널 출력이 WebSocket을 통해 모바일에 실시간 표시
- GitManager가 실제 git status 결과를 반환
- TunnelManager 크래시 후 자동 재시작 동작
- useDoublt에서 서버 이벤트 수신 시 상태가 정확히 업데이트
- 세션 attach 시 scrollback 버퍼가 클라이언트에 전송됨
- pnpm build 성공, 기존 227개 테스트 통과 유지
PROMPT
      ;;
    2)
      cat <<'PROMPT'
/ralph 다음 작업을 수행해:

## 참조 문서
- docs/ROADMAP.md Phase 2 섹션
- IMPLEMENTATION_PLAN.md (v1 스펙 참조)
- .omc/plans/doublt-code-implementation.md (v2 Phase 4 참조)

## 이전 Phase 연동
- Phase 1에서 TerminalSyncManager에 추가된 scrollback 버퍼를 JsonStore에 저장
- Phase 1에서 GitManager가 생성하는 이벤트를 DigestManager에 로깅

## 작업 내용: Phase 2 — 영속화 완성 (Persistence)

2건의 작업:

### 2-1. JsonStore <-> 매니저 save/load 연동
- SessionManager, WorkspaceManager, TaskQueueManager, ApprovalPolicyManager에 save()/load() 메서드 추가
- 상태 변경 시 debounced 자동 저장 (JsonStore의 1초 디바운스 활용)
- 서버 시작 시 DoubltServer.init()에서 JsonStore.load() -> 각 매니저에 상태 복원
- 데이터 파일: ~/.doublt/data/{sessions,workspaces,tasks,policies,digest}.json
- JSON 파일 손상 시 .bak 백업에서 자동 복구
- 수정 파일: JsonStore.ts, SessionManager.ts, WorkspaceManager.ts, TaskQueueManager.ts, ApprovalPolicyManager.ts, server/index.ts

### 2-2. DigestManager 실제 이벤트 로깅 + PtyManager scrollback 저장
- DoubltServer에서 모든 매니저 이벤트를 DigestManager.logEvent()에 라우팅
  - SessionManager: session:created, session:archived
  - TerminalSyncManager: command:complete
  - HandoffManager: handoff:created
  - GitManager: git:new_commit
- PtyManager scrollback 버퍼를 JsonStore에 저장 (세션별 마지막 500줄)
- DigestManager 인메모리 이벤트도 JsonStore에 영속화
- 수정 파일: DigestManager.ts, PtyManager.ts, server/index.ts

## 실행 순서
1. /ralplan 으로 구현 계획 컨센서스 도출
2. 계획대로 구현
3. pnpm build && pnpm test 검증
4. git add && git commit (Phase 2 완료 메시지)

## 수락 기준
- 서버 재시작 후 세션/워크스페이스/태스크 목록이 복원됨
- ~/.doublt/data/ 디렉토리에 JSON 파일들이 생성됨
- JSON 파일 손상 시 백업에서 자동 복구
- DigestManager가 모든 매니저 이벤트를 실제로 로깅
- 터미널 scrollback이 서버 재시작 후에도 유지됨
- pnpm build 성공, 기존 테스트 통과 유지
PROMPT
      ;;
    3)
      cat <<'PROMPT'
/ralph 다음 작업을 수행해:

## 참조 문서
- docs/ROADMAP.md Phase 3 섹션
- IMPLEMENTATION_PLAN.md (v1 Unit 1: Approval Policy, v2 Phase 2 참조)
- .omc/plans/doublt-code-implementation.md (v2 Phase 2: claude CLI 실행)

## 이전 Phase 연동
- Phase 1의 PtyManager PTY 파이핑이 동작해야 ClaudeSessionRunner가 claude를 PTY 안에서 실행 가능
- Phase 1의 TerminalSyncManager scrollback으로 claude 출력 모니터링

## 작업 내용: Phase 3 — 기능 통합 (Integration)

3건의 작업:

### 3-1. ClaudeSessionRunner <-> PtyManager 연동
- startClaude(sessionId, prompt?): PtyManager를 통해 PTY 안에서 claude --dangerously-skip-permissions 실행
- claude 프로세스 상태 추적: idle/running/crashed/stopped/budget_paused
- 크래시 감지 + 지수 백오프 재시작 (1s, 2s, 4s, 8s, 최대 5회)
- 5회 초과 실패: 세션 -> error 상태, 모바일 알림
- 무한 루프 방지: 태스크 실행 시간 상한 (기본 4시간)
- 비용 안전장치: CostTracker 연동, 일일 예산 초과 시 자동 모드 일시 중지
- 수정 파일: packages/server/src/claude/ClaudeSessionRunner.ts

### 3-2. ApprovalPolicyManager full_auto 프리셋
- full_auto 프리셋 추가: 모든 도구 자동 승인
- 시간 기반 정책: schedulePolicy(policyId, cronExpression) 지원
- 세션별 정책 오버라이드: setSessionPolicy(sessionId, policyId)
- UI 상태 표시용 isFullAuto(sessionId) 메서드
- 수정 파일: packages/server/src/approval/ApprovalPolicyManager.ts, packages/shared/src/types/approval.ts

### 3-3. CLI 키바인딩 확장
- Ctrl-b a: 승인 정책 토글 (conservative <-> full_auto)
- Ctrl-b t: 태스크 큐 표시/관리
- Ctrl-b g: Git 상태 표시
- Ctrl-b $: 비용 요약 표시
- 키바인딩 도움말(Ctrl-b ?) 업데이트
- 수정 파일: packages/cli/src/index.ts

## 실행 순서
1. /ralplan 으로 구현 계획 컨센서스 도출
2. 계획대로 구현
3. pnpm build && pnpm test 검증
4. git add && git commit (Phase 3 완료 메시지)

## 수락 기준
- 세션에서 claude --dangerously-skip-permissions 자동 실행 가능
- claude 크래시 시 자동 재시작 (지수 백오프, 최대 5회)
- full_auto 프리셋 적용/해제 가능
- 일일 예산 초과 시 자동 모드 일시 중지
- Ctrl-b a/t/g/$ 키바인딩 동작
- pnpm build 성공, 기존 테스트 통과 유지
PROMPT
      ;;
    4)
      cat <<'PROMPT'
/ralph 다음 작업을 수행해:

## 참조 문서
- docs/ROADMAP.md Phase 4 섹션
- IMPLEMENTATION_PLAN.md (v1 Unit 6: Offline Cache & Sync Queue)
- .omc/plans/doublt-code-implementation.md (v2 Phase 4-2: 모바일 오프라인)

## 이전 Phase 연동
- Phase 2의 JsonStore 영속화가 완료되어 서버 측 상태가 안정적
- Phase 1의 useDoublt 데이터 바인딩이 완성되어 캐시할 데이터가 존재

## 작업 내용: Phase 4 — 모바일 오프라인 (Mobile Offline)

1건의 작업:

### 4-1. OfflineStore + SyncQueue 활성화 및 DoubltClient 연동
- OfflineStore 활성화:
  - AsyncStorage 기반 메시지 캐시 (세션별 최근 200개)
  - 세션/워크스페이스 메타데이터 캐시
  - 알림 영속 저장
  - 캐시 만료 관리 (7일)
- SyncQueue 활성화:
  - 오프라인 전송 큐 (chat:send, tool:approve 등)
  - 재연결 시 자동 플러시
  - 재시도 로직 (최대 3회, 지수 백오프)
  - 충돌 해결: server-wins 전략
- DoubltClient 연동:
  - 연결 끊김 감지 -> SyncQueue에 액션 큐잉
  - 재연결 시 SyncQueue 플러시 -> 서버 상태와 동기화
  - useDoublt 마운트 시 OfflineStore에서 캐시 로드
  - 상태 변경 시 OfflineStore에 캐시 저장
- 수정 파일: OfflineStore.ts, SyncQueue.ts, DoubltClient.ts, useDoublt.ts, NotificationService.ts

## 실행 순서
1. /ralplan 으로 구현 계획 컨센서스 도출
2. 계획대로 구현
3. pnpm build && pnpm test 검증
4. git add && git commit (Phase 4 완료 메시지)

## 수락 기준
- 모바일 앱이 오프라인 상태에서 마지막 동기화된 데이터 표시
- 재연결 시 오프라인 중 누적된 액션이 서버에 전송됨
- server-wins 충돌 해결 전략이 동작
- 캐시 7일 만료 동작
- pnpm build 성공, 기존 테스트 통과 유지
PROMPT
      ;;
    5)
      cat <<'PROMPT'
/ralph 다음 작업을 수행해:

## 참조 문서
- docs/ROADMAP.md Phase 5 섹션
- IMPLEMENTATION_PLAN.md (v1 전체)
- .omc/plans/doublt-code-implementation.md (v2 전체)

## 이전 Phase 연동
- Phase 1-4의 모든 구현이 완료된 상태에서 테스트 보강 및 문서 최신화

## 작업 내용: Phase 5 — 테스트 & 문서 (QA/Docs)

4건의 작업:

### 5-1. PtyManager 유닛 테스트
- 모킹된 node-pty로 스폰/종료/리사이즈 검증
- TerminalSyncManager 연동 테스트: PTY 출력 -> handleOutput 파이핑 확인
- 에러 케이스: PTY 비정상 종료 시 세션 상태 업데이트
- scrollback 버퍼 크기 제한 검증
- 생성 파일: packages/server/src/__tests__/pty-manager.test.ts

### 5-2. ClaudeSessionRunner 유닛 테스트 보강
- PTY 기반 claude 시작/종료 검증
- 크래시 N회 후 중단 테스트
- 예산 초과 일시정지 테스트
- 태스크 실행 시간 상한 테스트
- 수정 파일: packages/server/src/__tests__/claude-runner.test.ts

### 5-3. JsonStore 라운드트립 테스트 보강
- 각 매니저의 save -> load 라운드트립 검증
- JSON 파일 손상 -> 백업 복구 시나리오
- debounce 동작 검증
- 수정 파일: packages/server/src/__tests__/json-store.test.ts

### 5-4. 문서 최신화
- IMPLEMENTATION_PLAN.md에 Phase 1-4 완료 항목 체크
- .omc/plans/doublt-code-implementation.md 상태 업데이트
- docs/ROADMAP.md에 완료 일자 기록
- 수정 파일: IMPLEMENTATION_PLAN.md, .omc/plans/doublt-code-implementation.md, docs/ROADMAP.md

## 실행 순서
1. /ralplan 으로 구현 계획 컨센서스 도출
2. 계획대로 구현
3. pnpm build && pnpm test 검증 (전체 테스트 통과 확인)
4. git add && git commit (Phase 5 완료 메시지)

## 수락 기준
- pnpm test 통과 (기존 227개 + 신규 테스트)
- PtyManager 테스트 커버리지: 스폰, 종료, 리사이즈, 에러, scrollback
- ClaudeSessionRunner 테스트 커버리지: 시작, 크래시, 재시작, 예산, 시간제한
- JsonStore 라운드트립 테스트: save/load, 손상 복구, debounce
- IMPLEMENTATION_PLAN.md가 현재 상태를 정확히 반영
PROMPT
      ;;
    *)
      log_error "알 수 없는 Phase: $phase_num"
      return 1
      ;;
  esac
}

# --- 인자 파싱 ---

while [[ $# -gt 0 ]]; do
  case $1 in
    --start)
      START_PHASE="$2"
      shift 2
      ;;
    --end)
      END_PHASE="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      log_error "알 수 없는 옵션: $1"
      usage
      exit 1
      ;;
  esac
done

# --- 유효성 검사 ---

if [[ "$START_PHASE" -lt 1 || "$START_PHASE" -gt 5 ]]; then
  log_error "--start 값은 1~5 사이여야 합니다: $START_PHASE"
  exit 1
fi

if [[ "$END_PHASE" -lt 1 || "$END_PHASE" -gt 5 ]]; then
  log_error "--end 값은 1~5 사이여야 합니다: $END_PHASE"
  exit 1
fi

if [[ "$START_PHASE" -gt "$END_PHASE" ]]; then
  log_error "--start($START_PHASE)가 --end($END_PHASE)보다 큽니다"
  exit 1
fi

# --- 메인 ---

PHASE_NAMES=(
  ""
  "기반 수정 (Foundation)"
  "영속화 완성 (Persistence)"
  "기능 통합 (Integration)"
  "모바일 오프라인 (Mobile)"
  "테스트 & 문서 (QA/Docs)"
)

main() {
  log_info "doublt-code 로드맵 자동 실행"
  log_info "Phase $START_PHASE ~ $END_PHASE 실행 예정"
  log_info "프로젝트: $PROJECT_DIR"
  echo ""

  check_prerequisites
  mkdir -p "$LOG_DIR"

  cd "$PROJECT_DIR"

  local failed_phase=0

  for phase in $(seq "$START_PHASE" "$END_PHASE"); do
    if ! run_phase "$phase" "${PHASE_NAMES[$phase]}"; then
      failed_phase=$phase
      break
    fi
    echo ""
  done

  echo ""
  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}  실행 결과 요약${NC}"
  echo -e "${CYAN}========================================${NC}"

  if [[ $failed_phase -eq 0 ]]; then
    log_success "Phase $START_PHASE ~ $END_PHASE 전체 완료!"
    echo ""
    log_info "로그 파일 위치: $LOG_DIR/"
  else
    log_error "Phase $failed_phase 에서 실패!"
    echo ""
    log_info "재실행 가이드:"
    echo -e "  ${YELLOW}./scripts/run-all-phases.sh --start $failed_phase --end $END_PHASE${NC}"
    echo ""
    log_info "로그 확인:"
    echo -e "  ${YELLOW}ls -la $LOG_DIR/phase-${failed_phase}-*.log${NC}"
    exit 1
  fi
}

main
