import { parseCurrentScheduleView, isSupportedScheduleView, isWeeklyPersonalView } from './parser';
import { buildScheduleAnalytics } from '@/utils/schedule';
import { renderDashboard, removeDashboard } from './dashboard';
import cssText from '@/styles/dashboard.css?inline';

const FAB_ID = 'fsd-fab';
const STYLES_ID = 'fsd-styles';
const OPEN_EVENT = 'fsd:open-dashboard';
const OPEN_MESSAGE = 'fsd:open-dashboard';

declare global {
  interface Window {
    __FSD_CONTENT_INITIALIZED__?: boolean;
  }
}

const openDashboard = (): boolean => {
  const isPersonalWeekly = isWeeklyPersonalView();
  const items = parseCurrentScheduleView();
  console.info('[FSD] Open dashboard requested.', {
    isPersonalWeekly,
    itemCount: items.length,
    url: location.href,
    sample: items.slice(0, 5),
  });
  if (items.length === 0) {
    console.warn('[FSD] No schedule data found for current view.', {
      isPersonalWeekly,
      bodyTextSample: document.body?.innerText?.slice(0, 500),
    });
    alert('일정 데이터를 찾을 수 없습니다.\n개인별 주간 뷰 또는 주 탭에서 내일정만보기를 선택해주세요.');
    return false;
  }

  const analytics = buildScheduleAnalytics(items);
  renderDashboard(analytics, {
    notice: isPersonalWeekly
      ? '* 공동 일정 포함 확인은 주 탭 + 내일정만보기에서 진행해주세요.'
      : undefined,
  });
  return true;
};

const createFab = (): void => {
  if (document.getElementById(FAB_ID)) return;

  const fab = document.createElement('button');
  fab.id = FAB_ID;
  fab.textContent = '📊';
  fab.title = 'FE Schedule Dashboard';

  fab.addEventListener('click', () => {
    openDashboard();
  });

  document.body.appendChild(fab);
};

const removeFab = (): void => {
  document.getElementById(FAB_ID)?.remove();
};

/** CSS 주입 */
const injectStyles = (): void => {
  if (document.getElementById(STYLES_ID)) return;
  const style = document.createElement('style');
  style.id = STYLES_ID;
  style.textContent = cssText;
  document.head.appendChild(style);
};

/** 지원 가능한 일정 뷰 감지 후 FAB 표시 */
const init = (): void => {
  if (window.__FSD_CONTENT_INITIALIZED__) return;
  window.__FSD_CONTENT_INITIALIZED__ = true;

  injectStyles();
  window.addEventListener(OPEN_EVENT, () => {
    openDashboard();
  });
  chrome.runtime.onMessage.addListener((message: { type?: string }, _sender, sendResponse) => {
    if (message?.type !== OPEN_MESSAGE) return false;
    sendResponse({ opened: openDashboard() });
    return false;
  });

  // 현재 페이지가 지원 가능한 일정 뷰인지 확인
  if (isSupportedScheduleView()) {
    createFab();
  }

  // DOM 변화 감시 (SPA 탐색 대응)
  const observer = new MutationObserver(() => {
    if (isSupportedScheduleView()) {
      createFab();
    } else {
      removeFab();
      removeDashboard();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
};

// content script가 all_frames: true이므로 iframe 안에서도 실행됨
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
