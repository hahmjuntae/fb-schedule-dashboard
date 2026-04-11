import type { MemberRecord, MemberInsight, ScheduleAnalytics, ProjectSummary } from '@/types/schedule.types';
import { formatMM, toMM } from '@/utils/mm';
import { getProjectColor } from '@/utils/colors';
import { renderBarChart, renderDonutChart } from './charts';

const DASHBOARD_ID = 'fsd-dashboard';
const WEEKLY_TOTAL_WARNING_HOURS = 40;

const formatDisplayName = (name: string): string => name.replace(/\s*\(FE\)\s*/g, '').trim();
const formatHours = (hours: number): string => hours.toFixed(1).replace(/\.0$/, '');

/** 모든 프로젝트명 수집 (합계 제외) */
const collectAllProjects = (memberRecord: MemberRecord): string[] => {
  const set = new Set<string>();
  Object.values(memberRecord).forEach((projects) => {
    Object.keys(projects).forEach((p) => {
      if (p !== '합계') set.add(p);
    });
  });
  return [...set].sort((a, b) => a.localeCompare(b, 'ko'));
};

/** 요약 테이블 렌더링 */
const renderSummaryTable = (memberRecord: MemberRecord, allProjects: string[]): string => {
  const headerCells = allProjects
    .map((p) => `<th style="color:${getProjectColor(p)}">${p}</th>`)
    .join('');

  const rows = Object.entries(memberRecord)
    .map(([name, projects]) => {
      const total = projects['합계'];
      const displayName = formatDisplayName(name);
      const totalTClass = total.T < WEEKLY_TOTAL_WARNING_HOURS ? 'fsd-total-t-warning' : '';
      const totalCellClass = total.T < WEEKLY_TOTAL_WARNING_HOURS
        ? 'fsd-total-cell fsd-total-cell-warning'
        : 'fsd-total-cell';
      const totalWarning = total.T < WEEKLY_TOTAL_WARNING_HOURS
        ? '<div class="fsd-total-warning">* 주간 T 확인 필요</div>'
        : '';
      const cells = allProjects
        .map((p) => {
          const s = projects[p];
          if (!s || (s.T === 0 && s.OT === 0)) return '<td class="fsd-cell-empty">-</td>';
          return `<td>${formatHours(s.T)} / ${formatHours(s.OT)}</td>`;
        })
        .join('');

      return `<tr>
        <td class="fsd-name-cell"><div class="fsd-name-main">${displayName}</div></td>
        <td><button class="fsd-detail-btn" data-member="${name}">상세보기</button></td>
        <td class="${totalCellClass}"><span class="${totalTClass}">${formatHours(total.T)}</span> / ${formatHours(total.OT)}${totalWarning}</td>
        <td>${formatMM(total.T + total.OT)}</td>
        ${cells}
      </tr>`;
    })
    .join('');

  return `
    <div class="fsd-section">
      <h3 class="fsd-section-title">요약</h3>
      <div class="fsd-table-wrap">
        <table class="fsd-table">
          <thead>
            <tr>
              <th>이름</th>
              <th>일정</th>
              <th>합계 (T/OT)</th>
              <th>MM</th>
              ${headerCells}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
};

/** 개인 상세 패널 렌더링 */
const renderMemberDetail = (
  name: string,
  projects: Record<string, ProjectSummary>,
  insight: MemberInsight,
  allProjects: string[],
): string => {
  const total = projects['합계'];
  const displayName = formatDisplayName(name);
  const tBadgeClass = total.T < WEEKLY_TOTAL_WARNING_HOURS
    ? 'fsd-badge fsd-badge-warning'
    : 'fsd-badge';
  const otBadge = total.OT > 0
    ? `<span class="fsd-badge fsd-badge-ot">OT: ${formatHours(total.OT)}h</span>`
    : '';

  // 범례
  const legend = insight.projects
    .map((p) => `<span class="fsd-legend-item"><span class="fsd-legend-dot" style="background:${getProjectColor(p.name)}"></span>${p.name}</span>`)
    .join('');

  // 바 차트 + 도넛 차트
  const barChart = renderBarChart(insight.dailyProjects, allProjects);
  const donutChart = renderDonutChart(insight.projects);

  // 요약 사이드바
  const summaryItems = insight.projects
    .map((p) => {
      const mm = toMM(p.T + p.OT).toFixed(2);
      return `<div class="fsd-summary-item">
        <div class="fsd-summary-proj" style="color:${getProjectColor(p.name)}">[${p.name}]</div>
        <div>T: ${formatHours(p.T)} (${mm})</div>
        ${p.OT > 0 ? `<div>OT: ${formatHours(p.OT)} (${toMM(p.OT).toFixed(2)})</div>` : ''}
      </div>`;
    })
    .join('');

  // 태스크 상세 목록 (프로젝트별)
  const taskDetails = Object.entries(projects)
    .filter(([pName]) => pName !== '합계')
    .map(([pName, pData]) => {
      const tTaskList = pData.tTasks.length
        ? pData.tTasks.map((t) => `<li>${t}</li>`).join('')
        : '<li class="fsd-no-task">없음</li>';

      const otTaskList = pData.otTasks.length
        ? pData.otTasks.map((t) => `<li>${t}</li>`).join('')
        : '';

      const tCopyText = `[${pName}]\n${pData.tTasks.map((t) => `- ${t}`).join('\n')}`;
      const otCopyText = `[${pName}]\n${pData.otTasks.map((t) => `- ${t}`).join('\n')}`;
      const gridClass = otTaskList
        ? 'fsd-task-card-grid fsd-task-card-grid-split'
        : 'fsd-task-card-grid';

      return `<div class="fsd-task-group">
        <h5><span class="fsd-project-badge" style="--fsd-project-color:${getProjectColor(pName)}">${pName}</span></h5>
        <div class="${gridClass}">
          <div class="fsd-task-card">
            <div class="fsd-task-header">
              <span class="fsd-task-type">T</span>
              <button class="fsd-copy-btn" data-copy="${encodeURIComponent(tCopyText)}">Copy</button>
            </div>
            <ul>${tTaskList}</ul>
          </div>
          ${otTaskList ? `<div class="fsd-task-card fsd-task-ot">
            <div class="fsd-task-header">
              <span class="fsd-task-type fsd-ot-type">OT</span>
              <button class="fsd-copy-btn" data-copy="${encodeURIComponent(otCopyText)}">Copy</button>
            </div>
            <ul>${otTaskList}</ul>
          </div>` : ''}
        </div>
      </div>`;
    })
    .join('');

  return `
    <div class="fsd-detail-panel" data-member="${name}">
      <div class="fsd-detail-header">
        <h3>${displayName}</h3>
        <div class="fsd-badge-group">
          <span class="${tBadgeClass}">T: ${formatHours(total.T)}h</span>
          ${otBadge}
        </div>
        <button class="fsd-close-detail">✕</button>
      </div>
      <div class="fsd-detail-body">
        <div class="fsd-charts-area">
          <div class="fsd-chart-section">
            <h4>요일별 T/OT</h4>
            <div class="fsd-legend">${legend}</div>
            ${barChart}
          </div>
          <div class="fsd-chart-section">
            <h4>전체 T/OT 합</h4>
            <div class="fsd-legend">${legend}</div>
            ${donutChart}
          </div>
          <div class="fsd-summary-sidebar">
            <h4>요약 <button class="fsd-copy-summary-btn" data-member="${name}">Copy</button></h4>
            ${summaryItems}
          </div>
        </div>
        <div class="fsd-task-details">
          <h4>${displayName}의 T/OT 상세 일정</h4>
          ${taskDetails}
        </div>
      </div>
    </div>
  `;
};

/** 전체 대시보드 렌더링 */
export const renderDashboard = (analytics: ScheduleAnalytics): void => {
  // 기존 대시보드 제거
  document.getElementById(DASHBOARD_ID)?.remove();

  const { memberRecord, memberInsights } = analytics;
  const allProjects = collectAllProjects(memberRecord);

  const summaryTable = renderSummaryTable(memberRecord, allProjects);

  // 상세 패널 (초기에는 숨김)
  const detailPanels = Object.entries(memberRecord)
    .map(([name, projects]) => {
      const insight = memberInsights[name];
      if (!insight) return '';
      return renderMemberDetail(name, projects, insight, allProjects);
    })
    .join('');

  const container = document.createElement('div');
  container.id = DASHBOARD_ID;
  container.innerHTML = `
    <div class="fsd-overlay">
      <div class="fsd-modal">
        <div class="fsd-modal-header">
          <h2>FE Schedule Dashboard</h2>
          <button class="fsd-close-btn">✕</button>
        </div>
        <div class="fsd-modal-body">
          ${summaryTable}
          <div class="fsd-detail-container">${detailPanels}</div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);
  bindEvents(container, analytics);
};

/** 이벤트 바인딩 */
const bindEvents = (container: HTMLElement, analytics: ScheduleAnalytics): void => {
  // 닫기 버튼
  container.querySelector('.fsd-close-btn')?.addEventListener('click', () => {
    container.remove();
  });

  // 오버레이 클릭으로 닫기
  container.querySelector('.fsd-overlay')?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).classList.contains('fsd-overlay')) {
      container.remove();
    }
  });

  // ESC 키로 닫기
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      container.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  // 상세보기 버튼들
  container.querySelectorAll('.fsd-detail-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const member = (btn as HTMLElement).dataset.member;
      // 모든 패널 숨기기
      container.querySelectorAll('.fsd-detail-panel').forEach((p) => {
        (p as HTMLElement).style.display = 'none';
      });
      // 선택된 패널 보이기
      const panel = container.querySelector(`.fsd-detail-panel[data-member="${member}"]`) as HTMLElement;
      if (panel) {
        panel.style.display = 'block';
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // 상세 패널 닫기 버튼들
  container.querySelectorAll('.fsd-close-detail').forEach((btn) => {
    btn.addEventListener('click', () => {
      const panel = btn.closest('.fsd-detail-panel') as HTMLElement;
      if (panel) panel.style.display = 'none';
    });
  });

  // 복사 버튼들
  container.querySelectorAll('.fsd-copy-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const text = decodeURIComponent((btn as HTMLElement).dataset.copy ?? '');
      navigator.clipboard.writeText(text).then(() => {
        const original = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(() => { btn.textContent = original; }, 1500);
      });
    });
  });

  // 요약 복사 버튼
  container.querySelectorAll('.fsd-copy-summary-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const member = (btn as HTMLElement).dataset.member;
      if (!member) return;
      const projects = analytics.memberRecord[member];
      if (!projects) return;

      const lines: string[] = [];
      Object.entries(projects).forEach(([pName, pData]) => {
        if (pName === '합계') return;
        if (pData.T === 0 && pData.OT === 0) return;
        lines.push(`[${pName}]`);
        pData.tasks.forEach((t) => lines.push(`- ${t}`));
        lines.push('');
      });

      navigator.clipboard.writeText(lines.join('\n')).then(() => {
        const original = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(() => { btn.textContent = original; }, 1500);
      });
    });
  });
};

/** 대시보드 제거 */
export const removeDashboard = (): void => {
  document.getElementById(DASHBOARD_ID)?.remove();
};
