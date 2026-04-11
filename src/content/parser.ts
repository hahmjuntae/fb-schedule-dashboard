import type { NormalizedScheduleItem } from '@/types/schedule.types';

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
 * 파싱 가능한 개인별 주간 뷰인지 판별
 */
export const isWeeklyPersonalView = (): boolean => {
  return !!document.querySelector('#weekCalendar');
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
