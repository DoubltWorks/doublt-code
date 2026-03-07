#!/usr/bin/env bash
##############################################################################
# run-mobile-fix-phases.sh
#
# doublt-code 모바일 앱 종합 검토 및 수정 — 자동 실행 스크립트
# 로드맵 문서: mobile-roadmap.md
#
# 사용법:
#   ./scripts/run-mobile-fix-phases.sh          # 전체 실행
#   ./scripts/run-mobile-fix-phases.sh 2A       # Phase 2A부터 실행
#   ./scripts/run-mobile-fix-phases.sh 2A 2C    # Phase 2A ~ 2C 범위 실행
##############################################################################
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$PROJECT_DIR/logs/mobile-fix"
ROADMAP="mobile-roadmap.md"

mkdir -p "$LOG_DIR"

# ── Phase 정의 (순서대로) ──────────────────────────────────────────────────
PHASE_IDS=(1A 2A 2B 2C 3A 3B 3C 3D 4A 4B)
TOTAL_PHASES=${#PHASE_IDS[@]}

# ── 범위 파싱 ──────────────────────────────────────────────────────────────
START_PHASE="${1:-}"
END_PHASE="${2:-}"

index_of() {
  local target="$1"
  for i in "${!PHASE_IDS[@]}"; do
    if [[ "${PHASE_IDS[$i]}" == "$target" ]]; then
      echo "$i"
      return
    fi
  done
  echo "-1"
}

if [[ -n "$START_PHASE" ]]; then
  START_IDX=$(index_of "$START_PHASE")
  if [[ "$START_IDX" == "-1" ]]; then
    echo "ERROR: Unknown phase '$START_PHASE'. Valid phases: ${PHASE_IDS[*]}"
    exit 1
  fi
else
  START_IDX=0
fi

if [[ -n "$END_PHASE" ]]; then
  END_IDX=$(index_of "$END_PHASE")
  if [[ "$END_IDX" == "-1" ]]; then
    echo "ERROR: Unknown phase '$END_PHASE'. Valid phases: ${PHASE_IDS[*]}"
    exit 1
  fi
else
  END_IDX=$((TOTAL_PHASES - 1))
fi

# ── 공통 프롬프트 프리앰블 ─────────────────────────────────────────────────
read -r -d '' PREAMBLE << 'PREAMBLE_EOF' || true
[컨텍스트 유지 규칙 — 반드시 준수]
1) .omc/HANDOFF.md 읽기 → 이전 Phase 결과 확인 (없으면 새로 생성)
2) .omc/MEMORY.md 읽기 → 프로젝트 컨벤션/제약사항 확인 (없으면 새로 생성)

[실행 순서]
3) /oh-my-claudecode:ralplan 실행 → 설계 컨센서스 (Planner→Architect→Critic 합의)
4) /oh-my-claudecode:ralph 실행 → 합의된 설계 기반 구현 시작
5) feature 브랜치 생성 (feature/mobile-fix-{PHASE_ID})
6) 구현 (기획서 + 로드맵 스펙 기준, 추정 금지)
7) 보안 점검 (입력 검증, 시크릿 관리)
8) 테스트 작성 + 실행 (단위 + 통합, 기존 314개 테스트 포함 전체 `pnpm test` 실행)
9) 타입 체크 (`pnpm run build`) / 린트 통과 확인
10) .omc/HANDOFF.md 업데이트 (완료 내용 + 다음 Phase 참고사항)
11) .omc/MEMORY.md 업데이트 (새 결정사항, 교훈 등)
12) 커밋 → main 머지 → feature 브랜치 삭제

[품질 규칙]
- 테스트 커버리지: 주요 로직 100% (해피패스 + 엣지케이스 + 에러케이스)
- 기존 테스트 깨뜨리지 않기 — 전체 `pnpm test` 통과 필수
- TypeScript strict 타입 체크 통과 필수
- 사용자 입력 검증/새니타이징, 시크릿 하드코딩 금지
- 기존 프로젝트 패턴/유틸/컴포넌트 최대한 재사용 (YAGNI)
- 로드맵에 없는 기능 임의 추가 금지

[참조 문서]
- 로드맵: mobile-roadmap.md
- 프로젝트 구조: CLAUDE.md
- 아키텍처 스펙: .omc/plans/doublt-code-implementation.md
PREAMBLE_EOF

# ── Phase 프롬프트 정의 ───────────────────────────────────────────────────

read -r -d '' PROMPT_1A << 'EOF' || true
# Phase 1A: 크리티컬 버그 수정 (Issue 1-1, 1-2)

## 이 Phase의 목표
모바일 앱의 두 가지 P0 크리티컬 버그를 수정한다.

## Issue 1-1: 터미널 ANSI 이스케이프 코드 제거
- **문제**: `packages/mobile/src/screens/TerminalScreen.tsx:108`에서 raw ANSI 코드가
  `<Text>`로 그대로 표시되어 터미널 출력이 읽을 수 없음
- **수정**:
  1. 새 파일 `packages/mobile/src/utils/stripAnsi.ts` 생성
  2. `/\x1b\[[0-9;]*[a-zA-Z]/g` regex로 ANSI 이스케이프 시퀀스 strip
  3. strip-ansi 패키지 대신 자체 구현 (의존성 최소화)
  4. `TerminalScreen.tsx`에서 터미널 출력 렌더링 전에 stripAnsi() 적용
- **대상 파일**: `packages/mobile/src/screens/TerminalScreen.tsx`, 새 파일 `packages/mobile/src/utils/stripAnsi.ts`
- **서버 변경**: 불필요

## Issue 1-2: ChatScreen multiline + onSubmitEditing 충돌
- **문제**: `packages/mobile/src/screens/ChatScreen.tsx:206-207`에서
  `multiline` + `returnKeyType="send"` + `onSubmitEditing` 조합.
  iOS에서 multiline TextInput은 onSubmitEditing이 발생하지 않아 전송 버튼만 작동
- **수정**:
  1. `multiline` 유지
  2. `returnKeyType="send"` 제거
  3. `blurOnSubmit={false}` 추가
  4. 전용 Send 버튼에 의존
- **대상 파일**: `packages/mobile/src/screens/ChatScreen.tsx`
- **서버 변경**: 불필요

## 테스트 요구사항
- stripAnsi 유틸리티 함수 단위 테스트 (다양한 ANSI 코드 패턴)
- ChatScreen 전송 동작 테스트 (Send 버튼 동작 확인)
- 기존 314개 테스트 전체 통과 확인
EOF

read -r -d '' PROMPT_2A << 'EOF' || true
# Phase 2A: 서버 연동 수정 — 스트리밍/비용/태스크 (Issue 2-1, 2-2, 2-3)

## 이 Phase의 목표
DoubltClient와 useDoublt의 서버 연동 누락 3건을 수정한다.

## Issue 2-1: chat:stream 이벤트 처리 추가
- **문제**: `DoubltClient.ts:182-188`에서 `chatStream` emit하지만
  `useDoublt.ts`에서 미수신. 스트리밍 응답의 점진적 표시 불가
- **수정**:
  1. `useDoublt.ts`에 chatStream 리스너 추가
  2. 기존 메시지의 content를 delta로 누적 업데이트
  3. done=true 시 partial 플래그 해제
  4. Web의 구현 패턴 참조 (`packages/web/src/hooks/` 참고)
- **대상 파일**: `packages/mobile/src/hooks/useDoublt.ts`

## Issue 2-2: 비용 추적 초기 동기화
- **문제**: `useDoublt.ts:451-457`에서 cost:update 증분만 누적.
  연결/재연결 시 초기값 없음
- **수정**:
  1. 인증 성공 후 `requestUsage()` 호출 추가
  2. `DoubltClient.ts` auth:result 핸들러에서 호출
  3. Web의 `packages/web/src/hooks/useCostTracker.ts:53-67` 패턴 참조
- **대상 파일**: `packages/mobile/src/services/DoubltClient.ts`, `packages/mobile/src/hooks/useDoublt.ts`

## Issue 2-3: 연결 시 Task 목록 로드
- **문제**: auth 성공 시 `listSessions()`/`listWorkspaces()`만 호출, `listTasks()` 미호출
- **수정**: `DoubltClient.ts:161-162` 인증 성공 블록에 `this.listTasks()` 추가
- **대상 파일**: `packages/mobile/src/services/DoubltClient.ts`

## 공통
- **서버 변경**: 불필요 (usage:request, task:list 이미 서버에 구현)
- **의존성**: Phase 1A 완료 후 실행

## 테스트 요구사항
- chatStream 리스너가 delta를 올바르게 누적하는지 단위 테스트
- 인증 성공 후 requestUsage/listTasks 호출 확인 테스트
- 기존 314개 테스트 전체 통과 확인
EOF

read -r -d '' PROMPT_2B << 'EOF' || true
# Phase 2B: 서버 연동 수정 — 필터링/동적처리/GitStatus/Scrollback (Issue 2-4, 2-5, 2-6, 2-7)

## 이 Phase의 목표
UI 상태 관리와 서버 데이터 연동 누락 4건을 수정한다.

## Issue 2-4: pendingApprovals 세션별 필터링
- **문제**: `ChatScreen.tsx:160`에서 모든 세션의 pendingApprovals 표시
- **수정**:
  1. useDoublt에서 `activePendingApprovals` 계산 속성 추가
  2. `pendingApprovals.filter(t => t.sessionId === activeSessionId)`
- **대상 파일**: `packages/mobile/src/hooks/useDoublt.ts`, `packages/mobile/src/index.tsx`

## Issue 2-5: ActivityTimeline hasMore 동적 처리
- **문제**: `index.tsx:281`에서 `hasMore={false}` 하드코딩
- **수정**:
  1. useDoublt 상태에 `timelineHasMore` 추가
  2. timeline:result 응답에서 entries 개수로 판단
- **대상 파일**: `packages/mobile/src/hooks/useDoublt.ts`, `packages/mobile/src/index.tsx`

## Issue 2-6: GitStatusBadge null 하드코딩 수정
- **문제**: `SessionListScreen.tsx:95`에서 `<GitStatusBadge gitStatus={null} />` 하드코딩
- **수정**: SessionItem에 gitStatus prop 전달, `gitStatus?.get(session.id) ?? null` 사용
- **대상 파일**: `packages/mobile/src/screens/SessionListScreen.tsx`

## Issue 2-7: TerminalScreen 진입 시 scrollback 요청
- **문제**: TerminalScreen 진입 시 기존 터미널 히스토리를 요청하지 않음
- **수정**:
  1. DoubltClient에 `requestScrollback(sessionId)` 메서드 추가
  2. TerminalScreen 또는 selectSession(terminal) 시 호출
- **대상 파일**: `packages/mobile/src/services/DoubltClient.ts`, `packages/mobile/src/index.tsx`

## 공통
- **서버 변경**: 불필요 (terminal:scrollback:request 이미 서버에 구현)
- **의존성**: Phase 2A 완료 후 실행

## 테스트 요구사항
- activePendingApprovals 필터링 로직 단위 테스트
- timelineHasMore 동적 판단 로직 테스트
- requestScrollback 호출 확인 테스트
- 기존 테스트 전체 통과 확인
EOF

read -r -d '' PROMPT_2C << 'EOF' || true
# Phase 2C: 서버 연동 수정 — 에러 이벤트 표시 (Issue 2-8)

## 이 Phase의 목표
서버 에러 이벤트를 사용자에게 시각적으로 표시한다.

## Issue 2-8: 에러 이벤트 사용자 표시
- **문제**: serverError 이벤트가 emit되지만 UI에 표시되지 않음
- **수정**:
  1. 새 파일 `packages/mobile/src/components/ErrorBanner.tsx` 생성
     - 화면 상단에 빨간색 배너로 에러 메시지 표시
     - 3초 후 자동 해제 (setTimeout)
     - 닫기 버튼 포함
  2. `useDoublt.ts`에 `lastError` 상태 추가
  3. serverError 리스너에서 `lastError` 설정
  4. `index.tsx` App 최상단에 ErrorBanner 렌더링
- **대상 파일**: `packages/mobile/src/hooks/useDoublt.ts`, `packages/mobile/src/index.tsx`, 새 파일 `packages/mobile/src/components/ErrorBanner.tsx`
- **서버 변경**: 불필요
- **의존성**: Phase 2B 완료 후 실행

## 테스트 요구사항
- ErrorBanner 컴포넌트 렌더링/자동해제 테스트
- serverError → lastError 상태 반영 테스트
- 기존 테스트 전체 통과 확인
EOF

read -r -d '' PROMPT_3A << 'EOF' || true
# Phase 3A: UI/UX 개선 — SafeAreaView 적용 (Issue 3-1)

## 이 Phase의 목표
모든 16개 화면에서 하드코딩된 `paddingTop: 60`을 제거하고
`useSafeAreaInsets()`를 적용한다.

## Issue 3-1: SafeAreaView 적용
- **문제**: 모든 화면에서 `paddingTop: 60` 하드코딩 — 다양한 디바이스에서 깨짐
- **수정**:
  1. 각 Screen 컴포넌트에서 `useSafeAreaInsets()` import
     (`react-native-safe-area-context` — 이미 설치됨)
  2. `paddingTop: 60` → `paddingTop: insets.top`
  3. 필요시 `paddingBottom: insets.bottom` 추가
  4. `index.tsx`에서 `SafeAreaProvider`가 이미 래핑되어 있는지 확인
- **대상 파일**: 모든 16개 Screen 컴포넌트:
  - `packages/mobile/src/screens/PairScreen.tsx`
  - `packages/mobile/src/screens/WorkspaceListScreen.tsx`
  - `packages/mobile/src/screens/SessionListScreen.tsx`
  - `packages/mobile/src/screens/ChatScreen.tsx`
  - `packages/mobile/src/screens/TerminalScreen.tsx`
  - `packages/mobile/src/screens/NotificationScreen.tsx`
  - `packages/mobile/src/screens/ApprovalQueueScreen.tsx`
  - `packages/mobile/src/screens/ApprovalPolicyScreen.tsx`
  - `packages/mobile/src/screens/TaskQueueScreen.tsx`
  - `packages/mobile/src/screens/DigestScreen.tsx`
  - `packages/mobile/src/screens/ActivityTimelineScreen.tsx`
  - `packages/mobile/src/screens/GitStatusScreen.tsx`
  - `packages/mobile/src/screens/UsageDashboardScreen.tsx`
  - `packages/mobile/src/screens/SearchScreen.tsx`
  - `packages/mobile/src/screens/TemplateScreen.tsx`
  - `packages/mobile/src/screens/MacroScreen.tsx`
- **서버 변경**: 불필요
- **의존성**: Phase 2C 완료 후 실행

## 테스트 요구사항
- 각 Screen에서 paddingTop: 60이 제거되었는지 정적 분석
- SafeAreaProvider 래핑 확인
- 기존 테스트 전체 통과 확인
EOF

read -r -d '' PROMPT_3B << 'EOF' || true
# Phase 3B: UI/UX 개선 — 아이콘 라이브러리 적용 (Issue 3-2)

## 이 Phase의 목표
텍스트 문자열로 표시되는 아이콘들을 실제 아이콘 컴포넌트로 교체한다.

## Issue 3-2: 아이콘 라이브러리 적용
- **문제**: "search", "bell", "mic", "<" 등이 텍스트 문자열로 표시
- **수정**:
  1. `@expo/vector-icons`의 `Ionicons` 사용 (Expo에 기본 포함, 별도 설치 불필요)
  2. 모든 화면에서 텍스트 아이콘 → `<Ionicons name="..." size={...} color="..." />` 교체
  3. 아이콘 매핑 예시:
     - "search" → `<Ionicons name="search" />`
     - "bell" → `<Ionicons name="notifications" />`
     - "mic" → `<Ionicons name="mic" />`
     - "<" (뒤로가기) → `<Ionicons name="chevron-back" />`
     - "+" → `<Ionicons name="add" />`
     - "X" (닫기) → `<Ionicons name="close" />`
  4. 각 아이콘의 size와 color는 기존 텍스트 스타일에 맞춤
- **대상 파일**: 모든 16개 Screen + 컴포넌트 파일에서 텍스트 아이콘 검색 후 교체
- **서버 변경**: 불필요
- **의존성**: Phase 3A 완료 후 실행 (SafeAreaView 적용 이후)

## 테스트 요구사항
- 텍스트 아이콘("<", "search" 등)이 코드에 남아있지 않은지 grep 확인
- Ionicons import가 올바른지 확인
- 기존 테스트 전체 통과 확인
EOF

read -r -d '' PROMPT_3C << 'EOF' || true
# Phase 3C: UI/UX 개선 — ConnectionBanner + 키보드 + Pull-to-refresh (Issue 3-3, 3-4, 3-5)

## 이 Phase의 목표
재연결 상태 배너, 키보드 스크롤 해제, Pull-to-refresh를 추가한다.

## Issue 3-3: 재연결 상태 배너
- **문제**: 재연결 중 상태를 알리는 UI 없음 (연결 dot만 존재)
- **수정**:
  1. 새 파일 `packages/mobile/src/components/ConnectionBanner.tsx` 생성
  2. connectionState별 배너:
     - `reconnecting`: 노란색 배너 "재연결 중..."
     - `disconnected`: 빨간색 배너 "연결 끊김"
     - `connected`: 배너 숨김
  3. `index.tsx` App 최상단에 ConnectionBanner 렌더링 (ErrorBanner 아래)
- **대상 파일**: 새 파일 `packages/mobile/src/components/ConnectionBanner.tsx`, `packages/mobile/src/index.tsx`

## Issue 3-4: 키보드 스크롤 시 해제
- **문제**: ChatScreen에서 메시지 스크롤 시 키보드 미해제
- **수정**: FlatList에 `keyboardDismissMode="on-drag"` 추가
- **대상 파일**: `packages/mobile/src/screens/ChatScreen.tsx`

## Issue 3-5: Pull-to-refresh 추가
- **문제**: 리스트 화면에 당겨서 새로고침 없음
- **수정**:
  1. `onRefresh` 콜백 — 해당 데이터 리로드 함수 호출
  2. `refreshing` state 관리
  3. 적용 대상:
     - WorkspaceListScreen: `listWorkspaces()` 호출
     - SessionListScreen: `listSessions()` 호출
     - ApprovalQueueScreen: pending approvals 리로드
     - TaskQueueScreen: `listTasks()` 호출
- **대상 파일**: 4개 리스트 Screen 파일

## 공통
- **서버 변경**: 불필요
- **의존성**: Phase 3B 완료 후 실행

## 테스트 요구사항
- ConnectionBanner 상태별 렌더링 테스트
- Pull-to-refresh 콜백 호출 확인 테스트
- 기존 테스트 전체 통과 확인
EOF

read -r -d '' PROMPT_3D << 'EOF' || true
# Phase 3D: UI/UX 개선 — 빈 콜백 + QuickAction + 매크로 영속화 (Issue 3-6, 3-7, 3-8)

## 이 Phase의 목표
빈 콜백 수정, 기본 퀵 액션 추가, 매크로 AsyncStorage 영속화.

## Issue 3-6: 빈 콜백 수정 (3개)
- **문제**:
  - ApprovalPolicyScreen `onSetActive={() => {}}` — 빈 콜백
  - TemplateScreen `onDeleteTemplate={() => {}}` — 빈 콜백
  - GitStatusScreen `onViewDiff={() => {}}` — 빈 콜백
- **수정**:
  1. `onSetActive`: `doublt.setApprovalPreset` 또는 `client.setPolicy` 연결
  2. `onViewDiff`: `doublt.requestGitDiff` 연결 (서버에 git:diff:request 이미 구현)
  3. `onDeleteTemplate`: template:delete가 프로토콜에 없으므로 버튼을 "Coming soon" disabled 상태로 변경
- **대상 파일**: `packages/mobile/src/index.tsx`

## Issue 3-7: QuickActionBar 기본 액션 추가
- **문제**: `ChatScreen.tsx:181`에서 `actions={[]}` 빈 배열
- **수정**: 기본 퀵 액션 배열 정의:
  - "Handoff" — 핸드오프 요청
  - "Approve All" — 전체 승인
  - "Terminal" — 터미널 화면 전환
- **대상 파일**: `packages/mobile/src/screens/ChatScreen.tsx`

## Issue 3-8: 매크로 AsyncStorage 영속화
- **문제**: macros가 로컬 상태만 사용, 앱 재시작 시 소실
- **수정**:
  1. OfflineStore에 macros 캐시 키 추가
  2. useDoublt에서 초기화 시 OfflineStore에서 macros 로드
  3. macros 변경 시 OfflineStore에 저장
- **대상 파일**: `packages/mobile/src/hooks/useDoublt.ts`, `packages/mobile/src/services/OfflineStore.ts`

## 공통
- **서버 변경**: 불필요 (template:delete는 Phase 5로 이동 — 향후 로드맵)
- **의존성**: Phase 3C 완료 후 실행

## 테스트 요구사항
- 각 빈 콜백이 실제 함수에 연결되었는지 확인 테스트
- QuickActionBar actions 배열이 비어있지 않은지 확인
- 매크로 로드/저장 라운드트립 테스트
- 기존 테스트 전체 통과 확인
EOF

read -r -d '' PROMPT_4A << 'EOF' || true
# Phase 4A: 메모리/안정성 수정 — 리스너 누수 + useEffect + debounce (Issue 4-1, 4-2, 4-3)

## 이 Phase의 목표
메모리 누수와 불필요한 재생성을 수정한다.

## Issue 4-1: BackgroundTaskService AppState 리스너 누수
- **문제**: `BackgroundTaskService.ts:52`에서 addEventListener 반환값 미저장,
  destroy()에서 미해제
- **수정**:
  1. NotificationService 패턴(`ts:41,53-55`) 참조
  2. subscription 변수 저장: `this.appStateSubscription = AppState.addEventListener(...)`
  3. destroy()에서 `this.appStateSubscription.remove()` 호출
- **대상 파일**: `packages/mobile/src/services/BackgroundTaskService.ts`

## Issue 4-2: VoiceInputButton useEffect 의존성 수정
- **문제**: `VoiceInputButton.tsx:36`에서 `[onVoiceResult]` 의존성으로
  매 렌더마다 VoiceService 재생성
- **수정**:
  1. `onVoiceResult`를 useRef로 감싸기: `const callbackRef = useRef(onVoiceResult)`
  2. useEffect 내에서 `callbackRef.current` 사용
  3. useEffect 의존성에서 `onVoiceResult` 제거
- **대상 파일**: `packages/mobile/src/components/VoiceInputButton.tsx`

## Issue 4-3: debounce 타이머 cleanup
- **문제**: useDoublt의 debounce 함수에서 컴포넌트 언마운트 시 타이머 미해제
- **수정**:
  1. useRef로 debounce 타이머 ID 저장
  2. cleanup 함수(useEffect return)에서 clearTimeout 호출
  3. 모든 debounce 사용처에 일괄 적용
- **대상 파일**: `packages/mobile/src/hooks/useDoublt.ts`

## 공통
- **서버 변경**: 불필요
- **의존성**: Phase 3D 완료 후 실행

## 테스트 요구사항
- BackgroundTaskService destroy() 호출 시 리스너 해제 확인
- VoiceInputButton 재렌더링 시 VoiceService 미재생성 확인
- debounce cleanup 동작 테스트
- 기존 테스트 전체 통과 확인
EOF

read -r -d '' PROMPT_4B << 'EOF' || true
# Phase 4B: 메모리/안정성 수정 — JSON 로깅 + 터미널 최적화 + Background keepAlive (Issue 4-4, 4-5, 4-6)

## 이 Phase의 목표
디버깅 개선, 렌더링 최적화, 백그라운드 연결 유지를 구현한다.

## Issue 4-4: JSON 파싱 에러 로깅
- **문제**: `DoubltClient.ts:121-123`에서 JSON 파싱 에러를 완전히 무시
- **수정**: catch 블록에 `console.warn('[DoubltClient] JSON parse error:', e, rawData)` 추가
- **대상 파일**: `packages/mobile/src/services/DoubltClient.ts`

## Issue 4-5: 터미널 출력 렌더링 최적화
- **문제**: 매 청크마다 50KB 문자열 생성 + 전체 리렌더
- **수정**:
  1. 터미널 출력 업데이트에 throttle 추가 (100ms)
  2. useDoublt에서 terminalOutput 상태 업데이트를 throttle
  3. React.memo로 TerminalScreen 래핑 (불필요한 리렌더 방지)
- **대상 파일**: `packages/mobile/src/hooks/useDoublt.ts`, `packages/mobile/src/screens/TerminalScreen.tsx`

## Issue 4-6: BackgroundTaskService keepAlive 최소 구현
- **문제**: `onBackgrounded()`의 interval이 아무것도 하지 않음
- **수정**:
  1. interval 콜백에서 `client.isConnected`가 false면 재연결 시도 트리거
  2. `onForegrounded()` 포그라운드 복귀 시:
     - 기존: sessions/workspaces 재동기화
     - 추가: tasks, approvals, usage도 재동기화
- **대상 파일**: `packages/mobile/src/services/BackgroundTaskService.ts`

## 공통
- **서버 변경**: 불필요
- **의존성**: Phase 4A 완료 후 실행 (마지막 Phase)

## 테스트 요구사항
- JSON 파싱 에러 시 console.warn 호출 확인
- 터미널 출력 throttle 동작 확인 (100ms 이내 중복 업데이트 방지)
- BackgroundTaskService keepAlive 재연결 로직 테스트
- 기존 테스트 전체 통과 확인
- 📋 최종 확인: `pnpm test` 전체 통과, `pnpm run build` 타입 체크 통과
EOF

# ── Phase 실행 함수 ────────────────────────────────────────────────────────

run_phase() {
  local phase_id="$1"
  local phase_idx="$2"
  local total="$3"
  local phase_prompt_var="PROMPT_${phase_id}"
  local phase_prompt="${!phase_prompt_var}"
  local log_file="$LOG_DIR/phase-${phase_id}.log"
  local timestamp
  timestamp=$(date '+%Y-%m-%d %H:%M:%S')

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  [$((phase_idx + 1))/$total] Phase $phase_id 시작 — $timestamp"
  echo "  로그: $log_file"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  local full_prompt
  full_prompt=$(cat <<PROMPT_END
${PREAMBLE}

${phase_prompt}

[Phase 실행 지시]
위 스펙을 기반으로 구현을 진행하라.

1. 먼저 .omc/HANDOFF.md와 .omc/MEMORY.md를 읽어 이전 Phase 결과를 확인하라.
2. /oh-my-claudecode:ralplan 으로 설계 컨센서스를 진행하라 (Planner→Architect→Critic 합의).
3. /oh-my-claudecode:ralph 로 합의된 설계 기반 구현을 실행하라.
4. feature 브랜치 생성: feature/mobile-fix-${phase_id}
5. 구현 완료 후 테스트 작성 및 실행 (pnpm test 전체 통과 필수).
6. 타입 체크 통과 확인 (pnpm run build).
7. .omc/HANDOFF.md 업데이트 (완료 내용 + 다음 Phase 참고사항).
8. .omc/MEMORY.md 업데이트 (새 결정사항, 교훈 등).
9. 커밋 → main 머지 → feature/mobile-fix-${phase_id} 브랜치 삭제.
PROMPT_END
)

  cd "$PROJECT_DIR"

  if claude -p "$full_prompt" \
    --dangerously-skip-permissions \
    --verbose \
    2>&1 | tee "$log_file"; then
    echo ""
    echo "✅ Phase $phase_id 완료 ($timestamp)"
    echo ""
  else
    local exit_code=$?
    echo ""
    echo "❌ Phase $phase_id 실패 (exit code: $exit_code)"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  재실행 가이드:"
    echo "  ./scripts/run-mobile-fix-phases.sh $phase_id"
    echo ""
    echo "  로그 확인:"
    echo "  cat $log_file"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit "$exit_code"
  fi
}

# ── 메인 실행 ──────────────────────────────────────────────────────────────

echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║  doublt-code 모바일 앱 종합 수정 — 자동 실행                    ║"
echo "║  로드맵: $ROADMAP                                    ║"
echo "║  Phase 범위: ${PHASE_IDS[$START_IDX]} ~ ${PHASE_IDS[$END_IDX]} ($((END_IDX - START_IDX + 1))/${TOTAL_PHASES} phases)           ║"
echo "║  로그 디렉토리: $LOG_DIR              ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

EXECUTED=0
for i in $(seq "$START_IDX" "$END_IDX"); do
  run_phase "${PHASE_IDS[$i]}" "$EXECUTED" "$((END_IDX - START_IDX + 1))"
  EXECUTED=$((EXECUTED + 1))
done

echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║  🎉 모든 Phase 완료! ($EXECUTED/$((END_IDX - START_IDX + 1)))                                    ║"
echo "║                                                                   ║"
echo "║  최종 확인 사항:                                                  ║"
echo "║  1. pnpm test — 전체 테스트 통과 확인                            ║"
echo "║  2. pnpm run build — 타입 체크 통과 확인                         ║"
echo "║  3. cd packages/mobile && npx expo start — 앱 실행 확인          ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
