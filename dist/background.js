const DASHBOARD_OPEN_EVENT = 'fsd:open-dashboard';
const SCHEDULE_TABLE_SELECTOR = '#weekCalendar';
const FORBIZ_GW_PREFIX = 'https://gw.forbiz.co.kr/';

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
    return true;
  } catch (error) {
    console.warn(`[FSD] Failed to inject content script into frame ${frameId}.`, error);
    return false;
  }
};

const hasScheduleTable = async (tabId, frameId) => {
  try {
    const [result] = await executeInFrame(tabId, frameId, {
      func: (selector) => Boolean(document.querySelector(selector)),
      args: [SCHEDULE_TABLE_SELECTOR],
    });
    return result?.result === true;
  } catch (error) {
    console.warn(`[FSD] Failed to inspect frame ${frameId}.`, error);
    return false;
  }
};

const openDashboardInFrame = async (tabId, frameId) => {
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

  if (!isForbizGwUrl(tab.url)) {
    await showPageAlert(tabId, 'GW 일정 페이지(https://gw.forbiz.co.kr/)에서 실행해주세요.');
    return;
  }

  const frameIds = await getForbizFrameIds(tabId, tab.url);
  if (frameIds.length === 0) {
    await showPageAlert(tabId, '실행 가능한 GW 프레임을 찾을 수 없습니다.');
    return;
  }

  await Promise.all(frameIds.map((frameId) => injectContentScript(tabId, frameId)));

  const scheduleFrameIds = [];
  for (const frameId of frameIds) {
    if (await hasScheduleTable(tabId, frameId)) {
      scheduleFrameIds.push(frameId);
    }
  }

  if (scheduleFrameIds.length === 0) {
    await showPageAlert(tabId, '일정 데이터를 찾을 수 없습니다.\n개인별 주간 뷰로 전환해주세요.');
    return;
  }

  await Promise.all(scheduleFrameIds.map((frameId) => openDashboardInFrame(tabId, frameId)));
};

chrome.action.onClicked.addListener((tab) => {
  void openDashboard(tab);
});
