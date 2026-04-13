import type { NormalizedScheduleItem } from '@/types/schedule.types';

const KOREAN_WEEKDAY_GLOBAL_PATTERN = /([월화수목금토일])\s*(\d{1,2})\.(\d{1,2})/g;
const KOREAN_TIME_RANGE_PATTERN = /(오전|오후)\s*(\d{1,2}):(\d{2})\s*[-~]\s*(오전|오후)\s*(\d{1,2}):(\d{2})/;
const KOREAN_TIME_RANGE_GLOBAL_PATTERN = /(오전|오후)\s*(\d{1,2}):(\d{2})\s*[-~]\s*(오전|오후)\s*(\d{1,2}):(\d{2})/g;
const H24_TIME_RANGE_PATTERN = /(\d{1,2}):(\d{2})\s*[-~]\s*(\d{1,2}):(\d{2})/;
const H24_TIME_RANGE_GLOBAL_PATTERN = /(\d{1,2}):(\d{2})\s*[-~]\s*(\d{1,2}):(\d{2})/g;
const PROJECT_TITLE_PATTERN = /\[[^\]]+\]/;

const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim();

const toPadded = (value: number): string => String(value).padStart(2, '0');

const parseKoreanMeridiemTime = (meridiem: string, hourValue: string, minuteValue: string): string => {
  let hour = Number(hourValue);
  const minute = Number(minuteValue);

  if (meridiem === '오전') {
    if (hour === 12) hour = 0;
  } else if (hour !== 12) {
    hour += 12;
  }

  return `${toPadded(hour)}:${toPadded(minute)}`;
};

const parseTimeRange = (text: string): string | null => {
  const normalized = normalizeText(text);

  // 오전/오후 형식 우선 시도
  const koreanMatch = normalized.match(KOREAN_TIME_RANGE_PATTERN);
  if (koreanMatch) {
    const [, startMeridiem, startHour, startMinute, endMeridiem, endHour, endMinute] = koreanMatch;
    return `${parseKoreanMeridiemTime(startMeridiem, startHour, startMinute)}~${parseKoreanMeridiemTime(endMeridiem, endHour, endMinute)}`;
  }

  // 24시간제 형식 (08:30 - 12:30)
  const h24Match = normalized.match(H24_TIME_RANGE_PATTERN);
  if (h24Match) {
    const [, startHour, startMinute, endHour, endMinute] = h24Match;
    return `${toPadded(Number(startHour))}:${startMinute}~${toPadded(Number(endHour))}:${endMinute}`;
  }

  return null;
};

const parseWeekDateMatch = (match: RegExpMatchArray): string => {
  const [, weekday, month, day] = match;
  return `${toPadded(Number(month))}.${toPadded(Number(day))} (${weekday})`;
};

const getElementLines = (element: HTMLElement): string[] => {
  return (element.innerText || element.textContent || '')
    .split('\n')
    .map(normalizeText)
    .filter(Boolean);
};

const matchTimeRange = (text: string): RegExpMatchArray | null => {
  return text.match(KOREAN_TIME_RANGE_PATTERN) ?? text.match(H24_TIME_RANGE_PATTERN);
};

const matchAllTimeRanges = (text: string): RegExpMatchArray[] => {
  const koreanMatches = Array.from(text.matchAll(KOREAN_TIME_RANGE_GLOBAL_PATTERN));
  if (koreanMatches.length > 0) return koreanMatches;
  return Array.from(text.matchAll(H24_TIME_RANGE_GLOBAL_PATTERN));
};

const getWeekEventParts = (element: HTMLElement) => {
  const lines = getElementLines(element);
  if (lines.length === 0) return null;

  const joinedText = lines.join(' ');
  const timeMatch = matchTimeRange(joinedText);
  if (!timeMatch) return null;

  const timeRange = parseTimeRange(timeMatch[0]);
  const afterTime = joinedText.slice((timeMatch.index ?? 0) + timeMatch[0].length);
  const title = normalizeText(afterTime.split(H24_TIME_RANGE_PATTERN)[0]?.split(KOREAN_TIME_RANGE_PATTERN)[0] ?? '').trim();
  if (!timeRange || !PROJECT_TITLE_PATTERN.test(title)) return null;

  return { timeRange, title };
};

const getAllWeekEventParts = (element: HTMLElement) => {
  const text = getElementLines(element).join(' ');
  if (!text) return [];

  const matches = matchAllTimeRanges(text);
  return matches
    .map((match, index) => {
      const nextMatch = matches[index + 1];
      const titleStart = (match.index ?? 0) + match[0].length;
      const titleEnd = nextMatch?.index ?? text.length;
      const title = normalizeText(text.slice(titleStart, titleEnd));
      const timeRange = parseTimeRange(match[0]);

      if (!timeRange || !PROJECT_TITLE_PATTERN.test(title)) return null;
      return { timeRange, title };
    })
    .filter((eventParts): eventParts is { timeRange: string; title: string } => Boolean(eventParts));
};

const getVisibleRect = (element: Element): DOMRect | null => {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return rect;
};

const hasChildWeekEvent = (element: HTMLElement): boolean => {
  return Array.from(element.children).some((child) => getWeekEventParts(child as HTMLElement));
};

const getWeekDayHeaders = () => {
  const headers: Array<{ date: string; rect: DOMRect }> = [];
  const headerElements = Array.from(document.querySelectorAll<HTMLElement>('th, td, [role="columnheader"]'));

  headerElements.forEach((element) => {
    const text = element.innerText || element.textContent || '';
    const dateMatches = Array.from(text.matchAll(KOREAN_WEEKDAY_GLOBAL_PATTERN));
    if (dateMatches.length === 0) return;

    if (dateMatches.length === 1) {
      const rect = getVisibleRect(element);
      if (!rect) return;
      headers.push({ date: parseWeekDateMatch(dateMatches[0]), rect });
      return;
    }

    const rect = getVisibleRect(element);
    if (!rect) return;

    const columnWidth = rect.width / dateMatches.length;
    dateMatches.forEach((match, index) => {
      const left = rect.left + columnWidth * index;
      headers.push({
        date: parseWeekDateMatch(match),
        rect: {
          ...rect,
          left,
          right: left + columnWidth,
          width: columnWidth,
          x: left,
        } as DOMRect,
      });
    });
  });

  const byDate = new Map<string, { date: string; rect: DOMRect }>();
  headers.forEach((header) => {
    const existing = byDate.get(header.date);
    if (!existing || header.rect.width < existing.rect.width) {
      byDate.set(header.date, header);
    }
  });

  return [...byDate.values()].sort((a, b) => a.rect.left - b.rect.left);
};

const findDateForEvent = (eventRect: DOMRect, headers: Array<{ date: string; rect: DOMRect }>): string | null => {
  const centerX = eventRect.left + eventRect.width / 2;
  const containingHeader = headers.find(({ rect }) => centerX >= rect.left && centerX <= rect.right);
  if (containingHeader) return containingHeader.date;

  const nearestHeader = headers.reduce<{ date: string; distance: number } | null>((nearest, header) => {
    const headerCenterX = header.rect.left + header.rect.width / 2;
    const distance = Math.abs(centerX - headerCenterX);
    if (!nearest || distance < nearest.distance) {
      return { date: header.date, distance };
    }
    return nearest;
  }, null);

  return nearestHeader?.date ?? null;
};

const findCurrentMemberName = (): string => {
  const documents: Document[] = [document];
  try {
    if (window.top?.document && window.top.document !== document) {
      documents.push(window.top.document);
    }
  } catch {
    // Cross-frame access is best-effort only.
  }

  for (const doc of documents) {
    const text = doc.body?.innerText ?? '';
    const topUserMatch = text.match(/-FE-([가-힣]{2,5})\([^)]+\)/);
    if (topUserMatch?.[1]) return topUserMatch[1];

    const calendarMatch = text.match(/개인캘린더\.([가-힣]{2,5})/);
    if (calendarMatch?.[1]) return calendarMatch[1];
  }

  return '내 일정';
};

/**
 * GW 개인별 주간 뷰의 #weekCalendar 테이블을 파싱하여 NormalizedScheduleItem[] 반환
 *
 * DOM 구조:
 *   #weekCalendar > tbody
 *     row[0]: 날짜 헤더 — th[0]="사원", th[1]="04.06 (월)", ...
 *     row[1]: 그룹 헤더 — th.minus="[기술부문] FE챕터", td[colspan=7]
 *     row[2]: 내부 레이아웃 row (th × 9명, td × 64) — 스킵
 *     row[3~N]: 데이터 rows — th=사원명, td × 7(요일별)
 *
 * 각 td 내부:
 *   div.sc_div { span.ti="09:30~10:00", span.wo="[프로젝트] 일정명" }
 */
export const parseWeeklyScheduleTable = (): NormalizedScheduleItem[] => {
  const items: NormalizedScheduleItem[] = [];

  const table = document.querySelector('#weekCalendar') as HTMLTableElement | null;
  if (!table) return items;

  const rows = table.querySelectorAll('tbody tr');
  if (rows.length < 4) return items;

  // row[0]에서 날짜 헤더 추출
  const headerRow = rows[0];
  const headerThs = headerRow.querySelectorAll('th');
  const dates: string[] = [];
  headerThs.forEach((th, i) => {
    if (i === 0) return; // "사원" 컬럼 스킵
    dates.push(th.textContent?.trim() ?? '');
  });

  // row[3~]부터 데이터 rows 처리
  for (let rowIdx = 3; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    const th = row.querySelector('th');
    if (!th) continue;

    // 그룹 헤더 row 스킵 (minus 클래스)
    if (th.classList.contains('minus')) continue;

    const memberName = th.textContent?.trim() ?? '';
    if (!memberName) continue;

    const tds = row.querySelectorAll('td');
    tds.forEach((td, cellIndex) => {
      const date = dates[cellIndex];
      if (!date) return;

      // 일정 블록 파싱: div.sc_div 내 span.ti(시간) + span.wo(일정명)
      const scheduleBlocks = td.querySelectorAll('.sc_div');
      scheduleBlocks.forEach((block) => {
        const timeEl = block.querySelector('.ti');
        const titleEl = block.querySelector('.wo');

        const timeRange = timeEl?.textContent?.trim() ?? '';
        const title = titleEl?.textContent?.trim() ?? '';

        if (timeRange && title) {
          items.push({
            date,
            timeRange,
            title,
            assignees: [memberName],
          });
        }
      });
    });
  }

  return items;
};

/**
 * GW "주" 뷰에서 "내 일정만 보기"로 필터링된 화면의 일정 블록을 파싱한다.
 *
 * 이 뷰에서는 다른 사람이 등록했지만 내가 대상자인 일정도 함께 내려오므로,
 * 화면에 보이는 모든 시간 일정 블록을 현재 사용자의 일정으로 취급한다.
 */
export const parseMyWeeklyScheduleView = (): NormalizedScheduleItem[] => {
  const headers = getWeekDayHeaders();
  if (headers.length < 5) {
    console.info('[FSD] Weekly parser skipped: insufficient day headers.', { headerCount: headers.length });
    return [];
  }

  const memberName = findCurrentMemberName();
  const seen = new Set<string>();
  const candidates = Array.from(document.querySelectorAll<HTMLElement>('div, a, li, span, td'));
  let matchedElementCount = 0;
  let withoutDateCount = 0;

  const items = candidates
    .flatMap((element) => {
      const eventPartsList = getAllWeekEventParts(element);
      const rect = getVisibleRect(element);
      if (eventPartsList.length === 0 || !rect || hasChildWeekEvent(element)) return [];
      matchedElementCount += 1;

      const date = findDateForEvent(rect, headers);
      if (!date) {
        withoutDateCount += eventPartsList.length;
        return [];
      }

      return eventPartsList
        .map((eventParts) => {
          const key = `${date}|${eventParts.timeRange}|${eventParts.title}`;
          if (seen.has(key)) return null;
          seen.add(key);

          return {
            date,
            timeRange: eventParts.timeRange,
            title: eventParts.title,
            assignees: [memberName],
          };
        })
        .filter((item): item is NormalizedScheduleItem => Boolean(item));
    })
    .filter((item): item is NormalizedScheduleItem => Boolean(item));

  console.info('[FSD] Weekly parser result.', {
    headerCount: headers.length,
    candidateCount: candidates.length,
    matchedElementCount,
    withoutDateCount,
    itemCount: items.length,
    memberName,
    sample: items.slice(0, 5),
  });

  return items;
};

export const parseCurrentScheduleView = (): NormalizedScheduleItem[] => {
  const personalWeeklyItems = parseWeeklyScheduleTable();
  if (personalWeeklyItems.length > 0) {
    console.info('[FSD] Personal weekly parser result.', {
      itemCount: personalWeeklyItems.length,
      sample: personalWeeklyItems.slice(0, 5),
    });
    return personalWeeklyItems;
  }

  return parseMyWeeklyScheduleView();
};

/**
 * 파싱 가능한 개인별 주간 뷰인지 판별
 */
export const isWeeklyPersonalView = (): boolean => {
  return !!document.querySelector('#weekCalendar');
};

export const isSupportedScheduleView = (): boolean => {
  return isWeeklyPersonalView() || parseMyWeeklyScheduleView().length > 0;
};

/**
 * 현재 주간 날짜 범위 텍스트 추출
 */
export const getWeekRangeText = (): string => {
  // 개인별 주간 뷰의 날짜 표시 영역
  const el = document.querySelector('.share_cal .date_txt') ??
             document.querySelector('.sch_date_area') ??
             document.querySelector('.date_area');
  return el?.textContent?.trim() ?? '';
};
