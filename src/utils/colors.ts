/** 프로젝트별 고정 색상 팔레트 — data marks only */
const PROJECT_COLORS: Record<string, string> = {
  청호: '#0a72ef',
  뉴발: '#f59e0b',
  FE: '#4d4d4d',
  휴가: '#94a3b8',
  뉴발란스: '#de1d8d',
  본부: '#14b8a6',
  kglobal: '#22c55e',
  순수본: '#6366f1',
  릴라켓: '#8b5cf6',
  세주모션: '#06b6d4',
  랑: '#ff5b4f',
  기타: '#9ca3af',
};

const FALLBACK_COLORS = [
  '#0a72ef',
  '#f59e0b',
  '#4d4d4d',
  '#94a3b8',
  '#de1d8d',
  '#14b8a6',
  '#22c55e',
  '#6366f1',
  '#8b5cf6',
  '#06b6d4',
  '#ff5b4f',
  '#9ca3af',
];

let colorIndex = 0;

export const getProjectColor = (name: string): string => {
  if (PROJECT_COLORS[name]) return PROJECT_COLORS[name];
  const color = FALLBACK_COLORS[colorIndex % FALLBACK_COLORS.length];
  PROJECT_COLORS[name] = color;
  colorIndex++;
  return color;
};
