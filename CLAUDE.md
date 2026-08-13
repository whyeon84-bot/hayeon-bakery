# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 사용자에게 설명하는 방식 (중요)

사용자는 개발자가 아니다. 설명할 때 전문 용어를 쓰지 말고, 비개발자가 바로 이해할 수 있는
쉬운 말로 풀어서 설명한다. 용어를 꼭 써야 하면 괄호로 뜻을 같이 적는다.
모든 답변은 한글로 한다.

## 개요

제빵사 원하연의 개인 포트폴리오 사이트. 빌드 도구, 패키지 매니저, 의존성이 없다.
`index.html` 하나에 HTML·CSS·JS가 모두 들어 있으며, 브라우저로 열면 그대로 동작한다.

## 확인 방법

빌드나 테스트 명령이 없다. 변경 후에는 `index.html`을 브라우저로 열어 눈으로 확인한다.

## 구조

`index.html` 안에서 세 덩어리로 나뉜다.

1. `<style>` — 전체 디자인. 색은 `:root`의 CSS 변수(`--cream`, `--crust`, `--butter` 등)로
   관리하므로 배색을 바꿀 때는 변수만 수정한다. 밝은 베이커리 톤 단일 테마이며 다크모드는 없다.
2. `<body>` — `header`(Hero) + `section#about|works|career|game|contact` + `footer`.
   섹션 등장 애니메이션은 `.reveal` 클래스와 IntersectionObserver가 담당한다.
3. `<script>` — 빵 테트리스. 즉시실행함수 하나로 캡슐화되어 외부에 노출되는 API가 없다.

## 빵 테트리스

`PIECES` 객체가 테트로미노 7종을 정의하며, 각 항목이 `emoji`(빵 종류) · `color`(타일 배경) ·
`cells`(모양 행렬)를 갖는다. 빵을 바꾸려면 이 객체만 수정하면 된다.

보드는 canvas가 아니라 `10 x 20 = 200`개의 `div.cell`이다. 셀 DOM은 최초 1회만 생성하고
이후에는 `render()`가 각 셀의 class/배경/textContent만 갱신한다. 셀을 추가·삭제하지 말 것.

상태는 클로저 안의 `grid`(2차원 배열, 값은 조각 key 또는 null), `cur`, `nextPiece`에 있다.
낙하는 requestAnimationFrame 루프에서 누적 시간이 `speed()`를 넘을 때 한 칸씩 진행한다.

## 주의

작업 폴더에 회사 내부 재무자료(`*.xlsx`)가 함께 들어 있다. `.gitignore`로 제외되어 있으며,
`git add -A`나 `git add -f`로 이를 커밋에 포함시키지 말 것.
