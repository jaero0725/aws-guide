/*!
 * boot.js — 첫 페인트 전에 저장된 테마·글자 크기를 반영합니다.
 *
 * <head> 안에서 defer 없이 불러야 합니다. 그래야 렌더를 차단하고 body 파싱 전에 실행됩니다.
 * app.js 는 defer 라서 파싱이 끝난 뒤에 실행되고, 그 사이 한 번 잘못된 색으로 그려집니다
 * (OS 는 다크인데 저장된 설정이 라이트면 다크로 한 번 깜빡인 뒤 라이트로 바뀝니다).
 *
 * 여기서는 DOM 을 만지지 않고 <html> 의 속성만 세팅합니다. 이 속성이 곧
 * tokens.css 의 :root[data-theme="..."] · main.css 의 [data-font-size] 를 켭니다.
 * 값의 정본은 progress.js 이며, 이 파일은 같은 키를 읽기만 합니다.
 */
(function () {
  'use strict';
  var root = document.documentElement;

  /* JS 가 살아 있다는 표시 — main.css 가 html:not(.js) 로 상단바 자리 예약을 되돌립니다.
     localStorage 가 막혀도 app.js 는 상단바를 주입하므로, 이 줄은 try 밖에 있어야 합니다. */
  root.className = root.className ? root.className + ' js' : 'js';

  try {
    var raw = window.localStorage.getItem('ag:settings');
    var s = raw ? JSON.parse(raw) : null;
    if (!s || typeof s !== 'object') s = {};

    /* auto 는 CSS 의 prefers-color-scheme 에 맡깁니다 — 속성을 건드리지 않습니다. */
    if (s.theme === 'light' || s.theme === 'dark') root.setAttribute('data-theme', s.theme);

    root.setAttribute('data-font-size', (s.fontSize === 'sm' || s.fontSize === 'lg') ? s.fontSize : 'md');
  } catch (e) {
    /* localStorage 차단(사생활 보호 모드 등) — 기본값 그대로 둡니다. */
  }
})();
