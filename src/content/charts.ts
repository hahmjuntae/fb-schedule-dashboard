import type { DailyProjectBreakdown, ProjectShare } from '@/types/schedule.types';
import { getProjectColor } from '@/utils/colors';

const formatHours = (hours: number): string => hours.toFixed(1).replace(/\.0$/, '');

/** SVG 바 차트 — 요일별 프로젝트 T/OT 스택 */
export const renderBarChart = (
  dailyProjects: DailyProjectBreakdown[],
  allProjects: string[],
): string => {
  if (!dailyProjects.length) return '<div class="fsd-empty">데이터 없음</div>';

  const maxHours = Math.max(
    ...dailyProjects.map((d) => {
      const t = Object.values(d.projects).reduce((s, v) => s + v, 0);
      return t + d.OT;
    }),
    8,
  );

  const W = 420;
  const H = 200;
  const PAD = { top: 8, right: 12, bottom: 28, left: 28 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const barW = Math.min(44, plotW / dailyProjects.length - 10);
  const gap = (plotW - barW * dailyProjects.length) / (dailyProjects.length + 1);

  let bars = '';

  // Y-axis grid lines (subtle)
  let grid = '';
  const steps = maxHours <= 10 ? 2 : 4;
  for (let h = 0; h <= maxHours; h += steps) {
    const yy = PAD.top + plotH - (h / maxHours) * plotH;
    grid += `<line x1="${PAD.left}" y1="${yy}" x2="${W - PAD.right}" y2="${yy}" stroke="#ebebeb" stroke-width="1"/>`;
    grid += `<text x="${PAD.left - 6}" y="${yy + 4}" text-anchor="end" fill="#808080" font-size="11" font-family="var(--fsd-font, sans-serif)">${h}</text>`;
  }

  dailyProjects.forEach((day, i) => {
    const x = PAD.left + gap + i * (barW + gap);
    let y = PAD.top + plotH;

    // T bars stacked by project
    allProjects.forEach((proj) => {
      const hours = day.projects[proj] ?? 0;
      if (hours <= 0) return;
      const h = (hours / maxHours) * plotH;
      y -= h;
      bars += `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${getProjectColor(proj)}"><title>${proj} T: ${formatHours(hours)}h</title></rect>`;
    });

    // OT bars use the same project color at lower opacity.
    allProjects.forEach((proj) => {
      const hours = day.otProjects[proj] ?? 0;
      if (hours <= 0) return;
      const h = (hours / maxHours) * plotH;
      y -= h;
      bars += `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${getProjectColor(proj)}" opacity="0.28"><title>${proj} OT: ${formatHours(hours)}h</title></rect>`;
    });

    // Date label
    bars += `<text x="${x + barW / 2}" y="${H - 6}" text-anchor="middle" fill="#666" font-size="11" font-family="var(--fsd-font, sans-serif)">${day.label}</text>`;
  });

  // 8h reference line
  if (maxHours >= 8) {
    const y8 = PAD.top + plotH - (8 / maxHours) * plotH;
    grid += `<line x1="${PAD.left}" y1="${y8}" x2="${W - PAD.right}" y2="${y8}" stroke="#808080" stroke-width="0.5" opacity="0.35"/>`;
  }

  return `<svg viewBox="0 0 ${W} ${H}" class="fsd-bar-chart">${grid}${bars}</svg>`;
};

/** SVG 도넛 차트 — 프로젝트 비율 */
export const renderDonutChart = (projects: ProjectShare[]): string => {
  if (!projects.length) return '<div class="fsd-empty">데이터 없음</div>';

  const total = projects.reduce((s, p) => s + p.value, 0);
  if (total === 0) return '<div class="fsd-empty">데이터 없음</div>';

  const W = 420;
  const H = 200;
  const cx = W / 2;
  const cy = 100;
  const R = 74;
  const r = 50;
  let startAngle = -Math.PI / 2;
  let paths = '';

  projects.forEach((p) => {
    const ratio = p.value / total;
    if (ratio <= 0) return;
    const endAngle = startAngle + ratio * Math.PI * 2;
    const largeArc = ratio > 0.5 ? 1 : 0;

    // Small gap between segments
    const gapAngle = 0.01;
    const adjustedStart = startAngle + gapAngle;
    const adjustedEnd = endAngle - gapAngle;

    if (adjustedEnd > adjustedStart) {
      const ax1 = cx + R * Math.cos(adjustedStart);
      const ay1 = cy + R * Math.sin(adjustedStart);
      const ax2 = cx + R * Math.cos(adjustedEnd);
      const ay2 = cy + R * Math.sin(adjustedEnd);
      const ax3 = cx + r * Math.cos(adjustedEnd);
      const ay3 = cy + r * Math.sin(adjustedEnd);
      const ax4 = cx + r * Math.cos(adjustedStart);
      const ay4 = cy + r * Math.sin(adjustedStart);

      paths += `<path d="M${ax1},${ay1} A${R},${R} 0 ${largeArc},1 ${ax2},${ay2} L${ax3},${ay3} A${r},${r} 0 ${largeArc},0 ${ax4},${ay4} Z" fill="${getProjectColor(p.name)}"><title>${p.name}: ${formatHours(p.value)}h (${(ratio * 100).toFixed(0)}%)</title></path>`;
    }

    startAngle = endAngle;
  });

  // Center text
  const centerText = `<text x="${cx}" y="${cy - 4}" text-anchor="middle" fill="#171717" font-size="24" font-weight="600" font-family="var(--fsd-font, sans-serif)">${formatHours(total)}</text>
    <text x="${cx}" y="${cy + 14}" text-anchor="middle" fill="#808080" font-size="11" font-weight="500" font-family="var(--fsd-font, sans-serif)">시간</text>`;

  return `<svg viewBox="0 0 ${W} ${H}" class="fsd-donut-chart">${paths}${centerText}</svg>`;
};
