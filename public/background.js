const DASHBOARD_OPEN_EVENT = 'fsd:open-dashboard';
const DASHBOARD_OPEN_MESSAGE = 'fsd:open-dashboard';
const FORBIZ_GW_PREFIX = 'https://gw.forbiz.co.kr/';
const KOREAN_TIME_RANGE_PATTERN = /(오전|오후)\s*\d{1,2}:\d{2}\s*[-~]\s*(오전|오후)\s*\d{1,2}:\d{2}/;

const getContentScriptFile = () => {
  const manifest = chrome.runtime.getManifest();
  return manifest.content_scripts?.flatMap((script) => script.js ?? [])[0] ?? 'content.js';
};

const isForbizGwUrl = (url) => typeof url === 'string' && url.startsWith(FORBIZ_GW_PREFIX);

const getForbizFrameIds = async (tabId, tabUrl) => {
  try {
    const frames = await chrome.webNavigation.getAllFrames({ tabId });
    const frameIds = frames
      .filter((frame) => isForbizGwUrl(frame.url))
      .map((frame) => frame.frameId);

    if (frameIds.length > 0) return frameIds;
  } catch (error) {
    console.warn('[FSD] Failed to read frames; falling back to the main frame.', error);
  }

  return isForbizGwUrl(tabUrl) ? [0] : [];
};

const executeInFrame = (tabId, frameId, details) => {
  return chrome.scripting.executeScript({
    target: { tabId, frameIds: [frameId] },
    ...details,
  });
};

const showPageAlert = async (tabId, message) => {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (text) => alert(text),
      args: [message],
    });
  } catch (error) {
    console.warn('[FSD] Failed to show page alert.', error);
  }
};

const injectContentScript = async (tabId, frameId) => {
  try {
    await executeInFrame(tabId, frameId, { files: [getContentScriptFile()] });
    console.info(`[FSD] Content script injected into frame ${frameId}.`);
    return true;
  } catch (error) {
    console.warn(`[FSD] Failed to inject content script into frame ${frameId}.`, error);
    return false;
  }
};

const hasScheduleSource = async (tabId, frameId) => {
  try {
    const [result] = await executeInFrame(tabId, frameId, {
      func: (timeRangePatternSource) => {
        if (document.querySelector('#weekCalendar')) return true;

        const timeRangePattern = new RegExp(timeRangePatternSource);
        return Array.from(document.querySelectorAll('div, a')).some((element) => {
          const text = (element.innerText || element.textContent || '')
            .split('\n')
            .map((line) => line.replace(/\s+/g, ' ').trim())
            .filter(Boolean)
            .join(' ');

          if (!timeRangePattern.test(text)) return false;
          const title = text.replace(timeRangePattern, '').trim();
          return /\[[^\]]+\]/.test(title);
        });
      },
      args: [KOREAN_TIME_RANGE_PATTERN.source],
    });
    console.info(`[FSD] Frame ${frameId} schedule source check.`, result?.result);
    return result?.result === true;
  } catch (error) {
    console.warn(`[FSD] Failed to inspect frame ${frameId}.`, error);
    return false;
  }
};

const openDashboardInFrame = async (tabId, frameId) => {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: DASHBOARD_OPEN_MESSAGE }, { frameId });
    console.info(`[FSD] Frame ${frameId} open response.`, response);
    return response?.opened === true;
  } catch (error) {
    console.warn(`[FSD] Failed to open dashboard via message in frame ${frameId}; falling back to DOM event.`, error);
  }

  try {
    await executeInFrame(tabId, frameId, {
      func: (eventName) => window.dispatchEvent(new CustomEvent(eventName)),
      args: [DASHBOARD_OPEN_EVENT],
    });
    return true;
  } catch (error) {
    console.warn(`[FSD] Failed to open dashboard in frame ${frameId}.`, error);
    return false;
  }
};

const openDashboard = async (tab) => {
  const tabId = tab.id;
  if (typeof tabId !== 'number') return;

  console.info('[FSD] Extension action clicked.', {
    tabId,
    tabUrl: tab.url,
    tabTitle: tab.title,
  });

  if (!isForbizGwUrl(tab.url)) {
    await showPageAlert(tabId, 'GW 일정 페이지(https://gw.forbiz.co.kr/)에서 실행해주세요.');
    return;
  }

  const frameIds = await getForbizFrameIds(tabId, tab.url);
  console.info('[FSD] Candidate frames.', frameIds);
  if (frameIds.length === 0) {
    await showPageAlert(tabId, '실행 가능한 GW 프레임을 찾을 수 없습니다.');
    return;
  }

  await Promise.all(frameIds.map((frameId) => injectContentScript(tabId, frameId)));

  const scheduleFrameIds = [];
  for (const frameId of frameIds) {
    if (await hasScheduleSource(tabId, frameId)) {
      scheduleFrameIds.push(frameId);
    }
  }
  console.info('[FSD] Schedule frames.', scheduleFrameIds);

  if (scheduleFrameIds.length === 0) {
    await showPageAlert(tabId, '일정 데이터를 찾을 수 없습니다.\n개인별 주간 뷰 또는 주 탭에서 내일정만보기를 선택해주세요.');
    return;
  }

  const openedResults = await Promise.all(scheduleFrameIds.map((frameId) => openDashboardInFrame(tabId, frameId)));
  if (!openedResults.some(Boolean)) {
    await showPageAlert(tabId, '대시보드를 열 수 없습니다.\n확장 프로그램을 새로고침한 뒤 다시 실행해주세요.');
  }
};

chrome.action.onClicked.addListener((tab) => {
  void openDashboard(tab);
});
