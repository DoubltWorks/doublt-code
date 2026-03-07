# doublt-code 모바일 앱 종합 검토 및 수정 계획

## Context

Web GUI에서 구현된 기능과 버그 수정이 대부분 완료된 상황에서, 모바일 앱(packages/mobile)의 모든 화면과 기능이 서버와 올바르게 연동되는지 종합 검토하였다. 3개의 병렬 에이전트(Explore)로 모바일 앱 16개 화면, 서버 메시지 핸들러 전체, 공유 프로토콜 타입을 분석하고, Planner/Architect/Critic 3명의 합의를 통해 최종 수정 계획을 도출하였다.

**발견된 총 이슈: 37개** (원래 30개 + Critic이 발견한 7개 추가)

---

## 수정 계획 (5 Phase, 우선순위순)

---

### Phase 1: 크리티컬 버그 수정 (P0) — 2개

#### 1-1. 터미널 ANSI 이스케이프 코드 제거
- **문제**: `TerminalScreen.tsx:108`에서 raw ANSI 코드가 `<Text>`로 그대로 표시되어 터미널 출력이 읽을 수 없음
- **수정**: ANSI 이스케이프 시퀀스를 strip하는 유틸리티 함수 추가
- **파일**: `packages/mobile/src/screens/TerminalScreen.tsx`, 새 파일 `packages/mobile/src/utils/stripAnsi.ts`
- **방법**: `/\x1b\[[0-9;]*[a-zA-Z]/g` regex로 strip (strip-ansi 패키지 대신 자체 구현 — 의존성 최소화)
- **서버 변경**: 불필요
- **작업량**: S

#### 1-2. ChatScreen multiline + onSubmitEditing 충돌
- **문제**: `ChatScreen.tsx:206-207`에서 `multiline` + `returnKeyType="send"` + `onSubmitEditing` 조합. iOS에서 multiline TextInput은 onSubmitEditing이 발생하지 않아 전송 버튼만 작동
- **수정**: `multiline` 유지하되 `returnKeyType` 제거, 전용 Send 버튼에 의존. `blurOnSubmit={false}` 추가
- **파일**: `packages/mobile/src/screens/ChatScreen.tsx`
- **서버 변경**: 불필요
- **작업량**: S

---

### Phase 2: 서버 연동 수정 (P1) — 8개

#### 2-1. chat:stream 이벤트 처리 추가
- **문제**: `DoubltClient.ts:182-188`에서 `chatStream` emit하지만 `useDoublt.ts`에서 미수신. 스트리밍 응답의 점진적 표시 불가
- **수정**: useDoublt에 chatStream 리스너 추가 — 기존 메시지의 content를 delta로 누적 업데이트, done=true 시 partial 플래그 해제
- **파일**: `packages/mobile/src/hooks/useDoublt.ts`
- **참고**: Web의 구현 패턴 참조
- **서버 변경**: 불필요
- **작업량**: M

#### 2-2. 비용 추적 초기 동기화
- **문제**: `useDoublt.ts:451-457`에서 cost:update 증분만 누적. 연결/재연결 시 초기값 없음
- **수정**: 인증 성공 후 `requestUsage()` 호출 추가 (DoubltClient.ts auth:result 핸들러에서). Web의 `useCostTracker.ts:53-67` 패턴 참조
- **파일**: `packages/mobile/src/services/DoubltClient.ts`, `packages/mobile/src/hooks/useDoublt.ts`
- **서버 변경**: 불필요 (usage:request 이미 서버에 구현)
- **작업량**: S

#### 2-3. 연결 시 Task 목록 로드
- **문제**: auth 성공 시 `listSessions()`/`listWorkspaces()`만 호출, `listTasks()` 미호출
- **수정**: `DoubltClient.ts:161-162` 인증 성공 블록에 `this.listTasks()` 추가
- **파일**: `packages/mobile/src/services/DoubltClient.ts`
- **서버 변경**: 불필요
- **작업량**: S

#### 2-4. pendingApprovals 세션별 필터링
- **문제**: `ChatScreen.tsx:160`에서 모든 세션의 pendingApprovals 표시
- **수정**: useDoublt에서 `activePendingApprovals` 계산 속성 추가 — `pendingApprovals.filter(t => t.sessionId === activeSessionId)`
- **파일**: `packages/mobile/src/hooks/useDoublt.ts`, `packages/mobile/src/index.tsx`
- **서버 변경**: 불필요
- **작업량**: S

#### 2-5. ActivityTimeline hasMore 동적 처리
- **문제**: `index.tsx:281`에서 `hasMore={false}` 하드코딩
- **수정**: useDoublt 상태에 `timelineHasMore` 추가, timeline:result 응답에서 entries 개수로 판단
- **파일**: `packages/mobile/src/hooks/useDoublt.ts`, `packages/mobile/src/index.tsx`
- **서버 변경**: 불필요
- **작업량**: S

#### 2-6. GitStatusBadge null 하드코딩 수정
- **문제**: `SessionListScreen.tsx:95`에서 `<GitStatusBadge gitStatus={null} />` 하드코딩
- **수정**: SessionItem에 gitStatus prop 전달, `gitStatus?.get(session.id) ?? null` 사용
- **파일**: `packages/mobile/src/screens/SessionListScreen.tsx`
- **서버 변경**: 불필요
- **작업량**: S

#### 2-7. TerminalScreen 진입 시 scrollback 요청
- **문제**: TerminalScreen 진입 시 기존 터미널 히스토리를 요청하지 않음
- **수정**: TerminalScreen 또는 selectSession(terminal) 시 `requestScrollback` 호출 추가. DoubltClient에 `requestScrollback(sessionId)` 메서드 추가
- **파일**: `packages/mobile/src/services/DoubltClient.ts`, `packages/mobile/src/index.tsx`
- **서버 변경**: 불필요 (terminal:scrollback:request 이미 서버에 구현)
- **작업량**: S

#### 2-8. 에러 이벤트 사용자 표시
- **문제**: serverError 이벤트가 emit되지만 UI에 표시되지 않음
- **수정**: useDoublt에 `lastError` 상태 추가, serverError 리스너에서 설정. App에 간단한 에러 배너 컴포넌트 추가 (3초 자동 해제)
- **파일**: `packages/mobile/src/hooks/useDoublt.ts`, `packages/mobile/src/index.tsx`, 새 파일 `packages/mobile/src/components/ErrorBanner.tsx`
- **서버 변경**: 불필요
- **작업량**: M

---

### Phase 3: UI/UX 개선 (P1-P2) — 8개

#### 3-1. SafeAreaView 적용
- **문제**: 모든 화면에서 `paddingTop: 60` 하드코딩 — 다양한 디바이스에서 깨짐
- **수정**: `useSafeAreaInsets()` 사용 (react-native-safe-area-context 이미 설치됨)
- **파일**: 모든 16개 Screen 컴포넌트
- **서버 변경**: 불필요
- **작업량**: M

#### 3-2. 아이콘 라이브러리 적용
- **문제**: "search", "bell", "mic", "<" 등이 텍스트 문자열로 표시
- **수정**: `@expo/vector-icons` (Ionicons) 사용 — Expo에 기본 포함, 설치 불필요
- **파일**: 모든 화면의 아이콘 텍스트 -> `<Ionicons name="..." />` 교체
- **서버 변경**: 불필요
- **작업량**: M

#### 3-3. 재연결 상태 배너
- **문제**: 재연결 중 상태를 알리는 UI 없음 (연결 dot만 존재)
- **수정**: App 최상단에 connectionState별 배너 컴포넌트 추가 (reconnecting: 노란색, disconnected: 빨간색)
- **파일**: `packages/mobile/src/index.tsx`, 새 파일 `packages/mobile/src/components/ConnectionBanner.tsx`
- **서버 변경**: 불필요
- **작업량**: S

#### 3-4. 키보드 스크롤 시 해제
- **문제**: ChatScreen에서 메시지 스크롤 시 키보드 미해제
- **수정**: FlatList에 `keyboardDismissMode="on-drag"` 추가
- **파일**: `packages/mobile/src/screens/ChatScreen.tsx`
- **서버 변경**: 불필요
- **작업량**: S

#### 3-5. Pull-to-refresh 추가
- **문제**: 리스트 화면에 당겨서 새로고침 없음
- **수정**: WorkspaceListScreen, SessionListScreen, ApprovalQueueScreen, TaskQueueScreen FlatList에 `onRefresh`/`refreshing` props 추가
- **파일**: 4개 리스트 Screen 파일
- **서버 변경**: 불필요
- **작업량**: S

#### 3-6. 빈 콜백 수정 (3개)
- **문제**: ApprovalPolicyScreen `onSetActive={() => {}}`, TemplateScreen `onDeleteTemplate={() => {}}`, GitStatusScreen `onViewDiff={() => {}}`
- **수정**:
  - `onSetActive`: `doublt.setApprovalPreset` 또는 `client.setPolicy` 연결
  - `onViewDiff`: `doublt.requestGitDiff` 연결 (서버에 git:diff:request 이미 구현)
  - `onDeleteTemplate`: template:delete가 프로토콜에 없으므로, 버튼을 숨기거나 "Coming soon" 표시
- **파일**: `packages/mobile/src/index.tsx`
- **서버 변경**: template:delete는 서버 프로토콜 추가 필요 (Phase 5로 이동)
- **작업량**: S

#### 3-7. QuickActionBar 기본 액션 추가
- **문제**: `ChatScreen.tsx:181`에서 `actions={[]}` 빈 배열
- **수정**: 기본 퀵 액션 추가 (Handoff, Approve All, Terminal 등)
- **파일**: `packages/mobile/src/screens/ChatScreen.tsx`
- **서버 변경**: 불필요
- **작업량**: S

#### 3-8. 매크로 AsyncStorage 영속화
- **문제**: macros가 로컬 상태만 사용, 앱 재시작 시 소실
- **수정**: OfflineStore에 macros 캐시 추가, useDoublt에서 로드/저장
- **파일**: `packages/mobile/src/hooks/useDoublt.ts`, `packages/mobile/src/services/OfflineStore.ts`
- **서버 변경**: 불필요
- **작업량**: S

---

### Phase 4: 메모리/안정성 수정 (P1-P2) — 6개

#### 4-1. BackgroundTaskService AppState 리스너 누수
- **문제**: `BackgroundTaskService.ts:52`에서 addEventListener 반환값 미저장, destroy()에서 미해제
- **수정**: NotificationService 패턴(ts:41,53-55) 참조하여 subscription 저장 및 destroy에서 remove
- **파일**: `packages/mobile/src/services/BackgroundTaskService.ts`
- **서버 변경**: 불필요
- **작업량**: S

#### 4-2. VoiceInputButton useEffect 의존성 수정
- **문제**: `VoiceInputButton.tsx:36`에서 `[onVoiceResult]` 의존성으로 VoiceService 재생성
- **수정**: `onVoiceResult`를 useRef로 감싸거나, useEffect 의존성에서 제거
- **파일**: `packages/mobile/src/components/VoiceInputButton.tsx`
- **서버 변경**: 불필요
- **작업량**: S

#### 4-3. debounce 타이머 cleanup
- **문제**: useDoublt의 debounce 함수에서 컴포넌트 언마운트 시 타이머 미해제
- **수정**: cleanup 함수에서 각 debounce 타이머를 cancel
- **파일**: `packages/mobile/src/hooks/useDoublt.ts`
- **서버 변경**: 불필요
- **작업량**: S

#### 4-4. JSON 파싱 에러 로깅
- **문제**: `DoubltClient.ts:121-123`에서 JSON 파싱 에러를 완전히 무시
- **수정**: console.warn으로 에러 로깅 (개발 디버깅용)
- **파일**: `packages/mobile/src/services/DoubltClient.ts`
- **서버 변경**: 불필요
- **작업량**: S

#### 4-5. 터미널 출력 렌더링 최적화
- **문제**: 매 청크마다 50KB 문자열 생성 + 전체 리렌더
- **수정**: 터미널 출력 업데이트에 throttle 추가 (100ms). React.memo로 TerminalScreen 래핑
- **파일**: `packages/mobile/src/hooks/useDoublt.ts`, `packages/mobile/src/screens/TerminalScreen.tsx`
- **서버 변경**: 불필요
- **작업량**: S

#### 4-6. BackgroundTaskService keepAlive 최소 구현
- **문제**: `onBackgrounded()`의 interval이 아무것도 하지 않음
- **수정**: interval에서 `client.isConnected`가 false면 재연결 시도 트리거. 포그라운드 복귀 시 전체 상태 재동기화 (이미 `onForegrounded`에 sessions/workspaces는 있지만 tasks/approvals/usage 추가)
- **파일**: `packages/mobile/src/services/BackgroundTaskService.ts`
- **서버 변경**: 불필요
- **작업량**: S

---

### Phase 5: 미구현 기능 (P3 — 향후 로드맵) — 13개

이 항목들은 현재 MVP에서 스킵하고 향후 버전에서 구현.

| # | 기능 | 설명 | 의존성 |
|---|------|------|--------|
| 5-1 | QR 코드 스캐너 | expo-camera barcode scan | PairScreen |
| 5-2 | 음성 입력 | @react-native-voice/voice 연동 | VoiceService |
| 5-3 | 로컬 푸시 알림 | expo-notifications 통합 | NotificationService |
| 5-4 | React Navigation | 제스처 네비, 딥링크, 트랜지션 | 전체 네비게이션 |
| 5-5 | 상태 관리 리팩토링 | Zustand로 분리 | useDoublt |
| 5-6 | WebView 터미널 | xterm.js in WebView | TerminalScreen |
| 5-7 | template:delete 프로토콜 | 서버+shared 프로토콜 추가 | wire.ts, server |
| 5-8 | 원격 푸시 알림 | Expo Push API 서버 통합 | 서버 변경 필요 |
| 5-9 | 햅틱 피드백 | 승인 버튼에 진동 피드백 | expo-haptics |
| 5-10 | 에러 바운더리 | React Error Boundary 컴포넌트 | App 전체 |
| 5-11 | 다크/라이트 테마 | 시스템 테마 연동 | 전체 스타일 |
| 5-12 | 딥링크 | doublt:// URL scheme 처리 | React Navigation 필요 |
| 5-13 | decideAllApprovals 일괄 메시지 | 서버에 batch approval API 추가 | 서버 변경 필요 |

---

## 수정 대상 파일 요약

| 파일 | Phase | 이슈 수 |
|------|-------|---------|
| `packages/mobile/src/hooks/useDoublt.ts` | 2,3,4 | 8 |
| `packages/mobile/src/index.tsx` | 2,3 | 5 |
| `packages/mobile/src/services/DoubltClient.ts` | 2,4 | 3 |
| `packages/mobile/src/screens/ChatScreen.tsx` | 1,3 | 4 |
| `packages/mobile/src/screens/TerminalScreen.tsx` | 1,4 | 2 |
| `packages/mobile/src/screens/SessionListScreen.tsx` | 2 | 1 |
| `packages/mobile/src/services/BackgroundTaskService.ts` | 4 | 2 |
| `packages/mobile/src/components/VoiceInputButton.tsx` | 4 | 1 |
| 모든 16개 Screen | 3 | SafeAreaView, 아이콘 |
| 새 파일 3개 | 1,2,3 | stripAnsi, ErrorBanner, ConnectionBanner |

## 서버 변경 필요 항목

Phase 1-4에서는 **서버 변경 불필요**. 모든 필요한 서버 API가 이미 구현되어 있음.
Phase 5의 template:delete, 원격 푸시, batch approval만 서버 변경 필요.

## 검증 방법

1. **빌드 확인**: `cd packages/mobile && npx expo start` — 에러 없이 시작
2. **TypeScript**: `pnpm run build` — 타입 에러 없음
3. **기능 테스트**: 서버 실행 후 각 화면 진입/동작 확인
   - PairScreen -> 연결 -> WorkspaceList -> SessionList -> Chat -> 메시지 전송
   - Terminal -> ANSI 코드 없이 출력 표시
   - 승인 큐 -> 해당 세션 항목만 표시
   - 비용 대시보드 -> 연결 즉시 데이터 표시
4. **기존 테스트**: `pnpm test` — 314개 테스트 통과

## 실행 순서

```
Phase 1 (P0, ~1h) -> Phase 2 (P1, ~3h) -> Phase 3 (P1-P2, ~3h) -> Phase 4 (P1-P2, ~2h)
```

Phase 1-2는 순차, Phase 3-4는 병렬 가능.
