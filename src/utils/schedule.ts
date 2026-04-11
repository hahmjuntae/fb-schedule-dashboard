import type {
  DaySummary,
  DailyProjectBreakdown,
  MemberInsight,
  MemberRecord,
  NormalizedScheduleItem,
  ProjectRecord,
  ProjectShare,
  ScheduleAnalytics,
} from '@/types/schedule.types';

const DAILY_REGULAR_HOURS = 8;
const WEEKLY_REGULAR_HOURS = 40;
const DAILY_WINDOW_HOURS = 9;

const PROJECT_PATTERN = /\[(.*?)\]/;
const LEADING_TAGS_PATTERN = /^(\[[^\]]+\]\s*)+/;

const parseHour = (value: string): number | null => {
  const [hour, minute] = value.split(':').map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return hour + minute / 60;
};

const parseTimeRange = (timeRange: string) => {
  const [start, end] = timeRange.split('~').map((s) => s.trim());
  const startTime = start ? parseHour(start) : null;
  const endTime = end ? parseHour(end) : null;
  if (startTime === null || endTime === null) return null;
  return { startTime, endTime };
};

const parseDateOrder = (date: string) => {
  const matched = date.match(/(\d{2})\.(\d{2})/);
  if (!matched) return Number.MAX_SAFE_INTEGER;
  return Number(matched[1]) * 100 + Number(matched[2]);
};

const getDateLabel = (date: string) => {
  const match = date.match(/\((.)\)/);
  return match ? `${date.slice(0, 5)}(${match[1]})` : date.slice(0, 5);
};

export const extractProjectName = (title: string) => {
  return title.match(PROJECT_PATTERN)?.[1] ?? '기타';
};

const cleanTaskName = (title: string) => {
  return title.replace(LEADING_TAGS_PATTERN, '').trim().replace(/\s+/g, ' ');
};

const createProjectRecord = (): ProjectRecord => ({
  합계: { T: 0, OT: 0, tasks: [], tTasks: [], otTasks: [] },
});

const ensureProject = (record: ProjectRecord, name: string) => {
  if (!record[name]) {
    record[name] = { T: 0, OT: 0, tasks: [], tTasks: [], otTasks: [] };
  }
  return record[name];
};

const ensureDaySummary = (days: Map<string, DaySummary>, date: string): DaySummary => {
  const existing = days.get(date);
  if (existing) return existing;
  const next: DaySummary = { date, label: getDateLabel(date), T: 0, OT: 0 };
  days.set(date, next);
  return next;
};

const ensureDailyProjectBreakdown = (
  days: Map<string, DailyProjectBreakdown>,
  date: string,
): DailyProjectBreakdown => {
  const existing = days.get(date);
  if (existing) return existing;
  const next: DailyProjectBreakdown = { date, label: getDateLabel(date), OT: 0, projects: {}, otProjects: {} };
  days.set(date, next);
  return next;
};

const buildProjectShares = (record: ProjectRecord): ProjectShare[] => {
  return Object.entries(record)
    .filter(([name]) => name !== '합계')
    .map(([name, s]) => ({ name, value: s.T + s.OT, T: s.T, OT: s.OT }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'ko'));
};

export const buildScheduleAnalytics = (items: NormalizedScheduleItem[]): ScheduleAnalytics => {
  const schedulesByMember = new Map<string, NormalizedScheduleItem[]>();

  items.forEach((item) => {
    item.assignees.forEach((assignee) => {
      const name = assignee?.trim();
      if (!name) return;
      const list = schedulesByMember.get(name) ?? [];
      list.push(item);
      schedulesByMember.set(name, list);
    });
  });

  const memberRecord: MemberRecord = {};
  const memberInsights: Record<string, MemberInsight> = {};

  schedulesByMember.forEach((memberSchedules, member) => {
    const sorted = [...memberSchedules].sort((a, b) => {
      const dateDiff = parseDateOrder(a.date) - parseDateOrder(b.date);
      if (dateDiff !== 0) return dateDiff;
      const ap = parseTimeRange(a.timeRange);
      const bp = parseTimeRange(b.timeRange);
      return (ap?.startTime ?? 0) - (bp?.startTime ?? 0);
    });

    const projectRecord = createProjectRecord();
    const days = new Map<string, DaySummary>();
    const dayProjects = new Map<string, DailyProjectBreakdown>();
    const dailyRegularUsed = new Map<string, number>();
    const dailyFirstStart = new Map<string, number>();
    let weeklyRegularUsed = 0;

    sorted.forEach((schedule) => {
      const parsed = parseTimeRange(schedule.timeRange);
      if (!parsed) return;

      const { startTime, endTime } = parsed;
      const duration = Math.max(0, endTime - startTime);
      const firstStart = dailyFirstStart.get(schedule.date) ?? startTime;
      dailyFirstStart.set(schedule.date, Math.min(firstStart, startTime));
      const dailyWindowEnd = (dailyFirstStart.get(schedule.date) ?? startTime) + DAILY_WINDOW_HOURS;

      const dailyUsed = dailyRegularUsed.get(schedule.date) ?? 0;
      const dailyRemaining = Math.max(0, DAILY_REGULAR_HOURS - dailyUsed);
      const weeklyRemaining = Math.max(0, WEEKLY_REGULAR_HOURS - weeklyRegularUsed);

      const T = Math.min(duration, dailyRemaining, weeklyRemaining);
      const OT = Math.max(0, duration - T);
      const taskName = cleanTaskName(schedule.title);
      const projectName = extractProjectName(schedule.title);
      const project = ensureProject(projectRecord, projectName);
      const daySummary = ensureDaySummary(days, schedule.date);
      const dayProject = ensureDailyProjectBreakdown(dayProjects, schedule.date);
      const overlapsOtWindow = endTime > dailyWindowEnd || OT > 0;

      project.T += T;
      project.OT += OT;
      projectRecord['합계'].T += T;
      projectRecord['합계'].OT += OT;
      daySummary.T += T;
      daySummary.OT += OT;
      dayProject.OT += OT;
      dayProject.projects[projectName] = (dayProject.projects[projectName] ?? 0) + T;
      dayProject.otProjects[projectName] = (dayProject.otProjects[projectName] ?? 0) + OT;
      dailyRegularUsed.set(schedule.date, dailyUsed + T);
      weeklyRegularUsed += T;

      if (taskName) {
        if (!project.tasks.includes(taskName)) project.tasks.push(taskName);
        if (T > 0 && !project.tTasks.includes(taskName)) project.tTasks.push(taskName);
        if (overlapsOtWindow && !project.otTasks.includes(taskName)) project.otTasks.push(taskName);
      }
    });

    memberRecord[member] = projectRecord;
    memberInsights[member] = {
      daily: [...days.values()].sort((a, b) => parseDateOrder(a.date) - parseDateOrder(b.date)),
      dailyProjects: [...dayProjects.values()].sort((a, b) => parseDateOrder(a.date) - parseDateOrder(b.date)),
      projects: buildProjectShares(projectRecord),
    };
  });

  return { memberRecord, memberInsights };
};
