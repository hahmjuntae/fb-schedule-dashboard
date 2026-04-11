export interface NormalizedScheduleItem {
  date: string;
  timeRange: string;
  title: string;
  assignees: string[];
}

export interface ProjectSummary {
  T: number;
  OT: number;
  tasks: string[];
  tTasks: string[];
  otTasks: string[];
}

export type ProjectRecord = Record<string, ProjectSummary>;
export type MemberRecord = Record<string, ProjectRecord>;

export interface DaySummary {
  date: string;
  label: string;
  T: number;
  OT: number;
}

export interface DailyProjectBreakdown {
  date: string;
  label: string;
  OT: number;
  projects: Record<string, number>;
  otProjects: Record<string, number>;
}

export interface ProjectShare {
  name: string;
  value: number;
  T: number;
  OT: number;
}

export interface MemberInsight {
  daily: DaySummary[];
  dailyProjects: DailyProjectBreakdown[];
  projects: ProjectShare[];
}

export interface ScheduleAnalytics {
  memberRecord: MemberRecord;
  memberInsights: Record<string, MemberInsight>;
}
