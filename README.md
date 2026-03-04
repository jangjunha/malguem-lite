소규모 그룹용 P2P 실시간 음성 채팅 + 저지연 게임 화면공유 애플리케이션

---

## 개발 환경 세팅

```sh
nix develop       # devShell 진입 (bun, node, pre-commit 포함)
bun install       # 의존성 설치
git config core.hooksPath .githooks  # git 훅 활성화
```

---

## 기능 요구사항

**핵심 기능**

- 음성 채팅 (실시간, 저지연)
- 게임 화면공유 (저지연, 60fps 목표)
- 화면공유 수신 (송출 없이 시청만도 가능)

**규모**

- 최대 5명
- Full Mesh P2P (SFU 불필요)

**플랫폼**

- 웹 (주)
- Tauri 데스크탑 앱 (추후)
- iOS (음성 + 화면 수신만, 추후)

---

## 기술 스택

**프론트엔드**

- Vite + React + TypeScript
- Bun 패키지 매니저

**WebRTC**

- 순수 WebRTC API (simple-peer 미사용)
- STUN만 사용 (TURN은 고려하지 않음)
- getDisplayMedia() 기반 화면공유

**백엔드 / 인프라**

- Supabase Realtime Broadcast → 시그널링
- Supabase Presence → 접속자 관리
- Supabase PostgreSQL → 추후 채팅/데이터 저장
- Supabase Auth → 추후 인증

---

## 성능 목표

- 음성 지연: 150ms 이하
- 화면공유 지연: 150ms 이하 (같은 국가 기준)
- 화면공유 인코딩: 8Mbps, 60fps, H.264 우선

---

## 현재 진행 상태

- 프로젝트 구조 설계 완료
- Supabase 기반 시그널링 클라이언트 코드 작성 완료
- PeerConnection, MeshNetwork 코드 작성 완료
- 테스트 UI 미작성

---

## 보류 / 추후 과제

- Supabase DB 스키마 + RLS 설계
- 채팅 기능
- Tauri 패키징
- iOS 대응
- 네트워크 상태에 따른 동적 비트레이트 조절
- Rust 네이티브 캡처 (성능 최적화, 선택사항)

---

## 하지 않을 것

- TURN 서버
