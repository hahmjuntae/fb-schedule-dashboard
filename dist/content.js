(function() {
  "use strict";
  const KOREAN_WEEKDAY_PATTERN = /([월화수목금토일])\s*(\d{1,2})\.(\d{1,2})/;
  const KOREAN_TIME_RANGE_PATTERN = /(오전|오후)\s*(\d{1,2}):(\d{2})\s*[-~]\s*(오전|오후)\s*(\d{1,2}):(\d{2})/;
  const PROJECT_TITLE_PATTERN = /\[[^\]]+\]/;
  const normalizeText = (value) => value.replace(/\s+/g, " ").trim();
  const toPadded = (value) => String(value).padStart(2, "0");
  const parseKoreanMeridiemTime = (meridiem, hourValue, minuteValue) => {
    let hour = Number(hourValue);
    const minute = Number(minuteValue);
    if (meridiem === "오전") {
      if (hour === 12) hour = 0;
    } else if (hour !== 12) {
      hour += 12;
    }
    return `${toPadded(hour)}:${toPadded(minute)}`;
  };
  const parseKoreanTimeRange = (text) => {
    const match = normalizeText(text).match(KOREAN_TIME_RANGE_PATTERN);
    if (!match) return null;
    const [, startMeridiem, startHour, startMinute, endMeridiem, endHour, endMinute] = match;
    return `${parseKoreanMeridiemTime(startMeridiem, startHour, startMinute)}~${parseKoreanMeridiemTime(endMeridiem, endHour, endMinute)}`;
  };
  const parseWeekDateLabel = (text) => {
    const match = normalizeText(text).match(KOREAN_WEEKDAY_PATTERN);
    if (!match) return null;
    const [, weekday, month, day] = match;
    return `${toPadded(Number(month))}.${toPadded(Number(day))} (${weekday})`;
  };
  const getElementLines = (element) => {
    return (element.innerText || element.textContent || "").split("\n").map(normalizeText).filter(Boolean);
  };
  const getWeekEventParts = (element) => {
    const lines = getElementLines(element);
    if (lines.length === 0) return null;
    const joinedText = lines.join(" ");
    const timeMatch = joinedText.match(KOREAN_TIME_RANGE_PATTERN);
    if (!timeMatch) return null;
    const timeRange = parseKoreanTimeRange(timeMatch[0]);
    const title = normalizeText(joinedText.slice((timeMatch.index ?? 0) + timeMatch[0].length));
    if (!timeRange || !PROJECT_TITLE_PATTERN.test(title)) return null;
    return { timeRange, title };
  };
  const getVisibleRect = (element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return rect;
  };
  const hasChildWeekEvent = (element) => {
    return Array.from(element.children).some((child) => getWeekEventParts(child));
  };
  const getWeekDayHeaders = () => {
    const seen = /* @__PURE__ */ new Set();
    const headerElements = Array.from(document.querySelectorAll('th, [role="columnheader"]'));
    return headerElements.map((element) => {
      const date = parseWeekDateLabel(element.innerText || element.textContent || "");
      const rect = getVisibleRect(element);
      if (!date || !rect) return null;
      return { date, rect };
    }).filter((header) => Boolean(header)).filter((header) => {
      if (seen.has(header.date)) return false;
      seen.add(header.date);
      return true;
    }).sort((a, b) => a.rect.left - b.rect.left);
  };
  const findDateForEvent = (eventRect, headers) => {
    const centerX = eventRect.left + eventRect.width / 2;
    const containingHeader = headers.find(({ rect }) => centerX >= rect.left && centerX <= rect.right);
    if (containingHeader) return containingHeader.date;
    const nearestHeader = headers.reduce((nearest, header) => {
      const headerCenterX = header.rect.left + header.rect.width / 2;
      const distance = Math.abs(centerX - headerCenterX);
      if (!nearest || distance < nearest.distance) {
        return { date: header.date, distance };
      }
      return nearest;
    }, null);
    return nearestHeader?.date ?? null;
  };
  const findCurrentMemberName = () => {
    const documents = [document];
    try {
      if (window.top?.document && window.top.document !== document) {
        documents.push(window.top.document);
      }
    } catch {
    }
    for (const doc of documents) {
      const text = doc.body?.innerText ?? "";
      const topUserMatch = text.match(/-FE-([가-힣]{2,5})\([^)]+\)/);
      if (topUserMatch?.[1]) return topUserMatch[1];
      const calendarMatch = text.match(/개인캘린더\.([가-힣]{2,5})/);
      if (calendarMatch?.[1]) return calendarMatch[1];
    }
    return "내 일정";
  };
  const hasMyScheduleOnlyFilter = () => {
    const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
    const myScheduleCheckbox = checkboxes.some((checkbox) => {
      const containerText = normalizeText(checkbox.closest("label, div, li, dd, td")?.textContent ?? "");
      return containerText.replace(/\s/g, "").includes("내일정만보기");
    });
    if (myScheduleCheckbox) return true;
    return normalizeText(document.body?.innerText ?? "").replace(/\s/g, "").includes("내일정만보기");
  };
  const parseWeeklyScheduleTable = () => {
    const items = [];
    const table = document.querySelector("#weekCalendar");
    if (!table) return items;
    const rows = table.querySelectorAll("tbody tr");
    if (rows.length < 4) return items;
    const headerRow = rows[0];
    const headerThs = headerRow.querySelectorAll("th");
    const dates = [];
    headerThs.forEach((th, i) => {
      if (i === 0) return;
      dates.push(th.textContent?.trim() ?? "");
    });
    for (let rowIdx = 3; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx];
      const th = row.querySelector("th");
      if (!th) continue;
      if (th.classList.contains("minus")) continue;
      const memberName = th.textContent?.trim() ?? "";
      if (!memberName) continue;
      const tds = row.querySelectorAll("td");
      tds.forEach((td, cellIndex) => {
        const date = dates[cellIndex];
        if (!date) return;
        const scheduleBlocks = td.querySelectorAll(".sc_div");
        scheduleBlocks.forEach((block) => {
          const timeEl = block.querySelector(".ti");
          const titleEl = block.querySelector(".wo");
          const timeRange = timeEl?.textContent?.trim() ?? "";
          const title = titleEl?.textContent?.trim() ?? "";
          if (timeRange && title) {
            items.push({
              date,
              timeRange,
              title,
              assignees: [memberName]
            });
          }
        });
      });
    }
    return items;
  };
  const parseMyWeeklyScheduleView = () => {
    if (!hasMyScheduleOnlyFilter()) return [];
    const headers = getWeekDayHeaders();
    if (headers.length < 5) return [];
    const memberName = findCurrentMemberName();
    const seen = /* @__PURE__ */ new Set();
    return Array.from(document.querySelectorAll("div, a")).map((element) => {
      const eventParts = getWeekEventParts(element);
      const rect = getVisibleRect(element);
      if (!eventParts || !rect || hasChildWeekEvent(element)) return null;
      const date = findDateForEvent(rect, headers);
      if (!date) return null;
      const key = `${date}|${eventParts.timeRange}|${eventParts.title}`;
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        date,
        timeRange: eventParts.timeRange,
        title: eventParts.title,
        assignees: [memberName]
      };
    }).filter((item) => Boolean(item));
  };
  const parseCurrentScheduleView = () => {
    const personalWeeklyItems = parseWeeklyScheduleTable();
    if (personalWeeklyItems.length > 0) return personalWeeklyItems;
    return parseMyWeeklyScheduleView();
  };
  const isWeeklyPersonalView = () => {
    return !!document.querySelector("#weekCalendar");
  };
  const isSupportedScheduleView = () => {
    return isWeeklyPersonalView() || parseMyWeeklyScheduleView().length > 0;
  };
  const DAILY_REGULAR_HOURS = 8;
  const WEEKLY_REGULAR_HOURS$1 = 40;
  const DAILY_WINDOW_HOURS = 9;
  const PROJECT_PATTERN = /\[(.*?)\]/;
  const LEADING_TAGS_PATTERN = /^(\[[^\]]+\]\s*)+/;
  const parseHour = (value) => {
    const [hour, minute] = value.split(":").map(Number);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
    return hour + minute / 60;
  };
  const parseTimeRange = (timeRange) => {
    const [start, end] = timeRange.split("~").map((s) => s.trim());
    const startTime = start ? parseHour(start) : null;
    const endTime = end ? parseHour(end) : null;
    if (startTime === null || endTime === null) return null;
    return { startTime, endTime };
  };
  const parseDateOrder = (date) => {
    const matched = date.match(/(\d{2})\.(\d{2})/);
    if (!matched) return Number.MAX_SAFE_INTEGER;
    return Number(matched[1]) * 100 + Number(matched[2]);
  };
  const getDateLabel = (date) => {
    const match = date.match(/\((.)\)/);
    return match ? `${date.slice(0, 5)}(${match[1]})` : date.slice(0, 5);
  };
  const extractProjectName = (title) => {
    return title.match(PROJECT_PATTERN)?.[1] ?? "기타";
  };
  const cleanTaskName = (title) => {
    return title.replace(LEADING_TAGS_PATTERN, "").trim().replace(/\s+/g, " ");
  };
  const createProjectRecord = () => ({
    합계: { T: 0, OT: 0, tasks: [], tTasks: [], otTasks: [] }
  });
  const ensureProject = (record, name) => {
    if (!record[name]) {
      record[name] = { T: 0, OT: 0, tasks: [], tTasks: [], otTasks: [] };
    }
    return record[name];
  };
  const ensureDaySummary = (days, date) => {
    const existing = days.get(date);
    if (existing) return existing;
    const next = { date, label: getDateLabel(date), T: 0, OT: 0 };
    days.set(date, next);
    return next;
  };
  const ensureDailyProjectBreakdown = (days, date) => {
    const existing = days.get(date);
    if (existing) return existing;
    const next = { date, label: getDateLabel(date), OT: 0, projects: {}, otProjects: {} };
    days.set(date, next);
    return next;
  };
  const buildProjectShares = (record) => {
    return Object.entries(record).filter(([name]) => name !== "합계").map(([name, s]) => ({ name, value: s.T + s.OT, T: s.T, OT: s.OT })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "ko"));
  };
  const buildScheduleAnalytics = (items) => {
    const schedulesByMember = /* @__PURE__ */ new Map();
    items.forEach((item) => {
      item.assignees.forEach((assignee) => {
        const name = assignee?.trim();
        if (!name) return;
        const list = schedulesByMember.get(name) ?? [];
        list.push(item);
        schedulesByMember.set(name, list);
      });
    });
    const memberRecord = {};
    const memberInsights = {};
    schedulesByMember.forEach((memberSchedules, member) => {
      const sorted = [...memberSchedules].sort((a, b) => {
        const dateDiff = parseDateOrder(a.date) - parseDateOrder(b.date);
        if (dateDiff !== 0) return dateDiff;
        const ap = parseTimeRange(a.timeRange);
        const bp = parseTimeRange(b.timeRange);
        return (ap?.startTime ?? 0) - (bp?.startTime ?? 0);
      });
      const projectRecord = createProjectRecord();
      const days = /* @__PURE__ */ new Map();
      const dayProjects = /* @__PURE__ */ new Map();
      const dailyRegularUsed = /* @__PURE__ */ new Map();
      const dailyFirstStart = /* @__PURE__ */ new Map();
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
        const weeklyRemaining = Math.max(0, WEEKLY_REGULAR_HOURS$1 - weeklyRegularUsed);
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
        projectRecord["합계"].T += T;
        projectRecord["합계"].OT += OT;
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
        projects: buildProjectShares(projectRecord)
      };
    });
    return { memberRecord, memberInsights };
  };
  const WEEKLY_REGULAR_HOURS = 40;
  const MM_PER_40_HOURS = 0.24;
  const toMM = (hours) => hours / WEEKLY_REGULAR_HOURS * MM_PER_40_HOURS;
  const formatMM = (hours) => toMM(hours).toFixed(2);
  const PROJECT_COLORS = {
    청호: "#0a72ef",
    뉴발: "#f59e0b",
    FE: "#4d4d4d",
    휴가: "#94a3b8",
    뉴발란스: "#de1d8d",
    본부: "#14b8a6",
    kglobal: "#22c55e",
    순수본: "#6366f1",
    릴라켓: "#8b5cf6",
    세주모션: "#06b6d4",
    랑: "#ff5b4f",
    기타: "#9ca3af"
  };
  const FALLBACK_COLORS = [
    "#0a72ef",
    "#f59e0b",
    "#4d4d4d",
    "#94a3b8",
    "#de1d8d",
    "#14b8a6",
    "#22c55e",
    "#6366f1",
    "#8b5cf6",
    "#06b6d4",
    "#ff5b4f",
    "#9ca3af"
  ];
  let colorIndex = 0;
  const getProjectColor = (name) => {
    if (PROJECT_COLORS[name]) return PROJECT_COLORS[name];
    const color = FALLBACK_COLORS[colorIndex % FALLBACK_COLORS.length];
    PROJECT_COLORS[name] = color;
    colorIndex++;
    return color;
  };
  const formatHours$1 = (hours) => hours.toFixed(1).replace(/\.0$/, "");
  const renderBarChart = (dailyProjects, allProjects) => {
    if (!dailyProjects.length) return '<div class="fsd-empty">데이터 없음</div>';
    const maxHours = Math.max(
      ...dailyProjects.map((d) => {
        const t = Object.values(d.projects).reduce((s, v) => s + v, 0);
        return t + d.OT;
      }),
      8
    );
    const W = 420;
    const H = 200;
    const PAD = { top: 8, right: 12, bottom: 28, left: 28 };
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const barW = Math.min(44, plotW / dailyProjects.length - 10);
    const gap = (plotW - barW * dailyProjects.length) / (dailyProjects.length + 1);
    let bars = "";
    let grid = "";
    const steps = maxHours <= 10 ? 2 : 4;
    for (let h = 0; h <= maxHours; h += steps) {
      const yy = PAD.top + plotH - h / maxHours * plotH;
      grid += `<line x1="${PAD.left}" y1="${yy}" x2="${W - PAD.right}" y2="${yy}" stroke="#ebebeb" stroke-width="1"/>`;
      grid += `<text x="${PAD.left - 6}" y="${yy + 4}" text-anchor="end" fill="#808080" font-size="11" font-family="var(--fsd-font, sans-serif)">${h}</text>`;
    }
    dailyProjects.forEach((day, i) => {
      const x = PAD.left + gap + i * (barW + gap);
      let y = PAD.top + plotH;
      allProjects.forEach((proj) => {
        const hours = day.projects[proj] ?? 0;
        if (hours <= 0) return;
        const h = hours / maxHours * plotH;
        y -= h;
        bars += `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${getProjectColor(proj)}"><title>${proj} T: ${formatHours$1(hours)}h</title></rect>`;
      });
      allProjects.forEach((proj) => {
        const hours = day.otProjects[proj] ?? 0;
        if (hours <= 0) return;
        const h = hours / maxHours * plotH;
        y -= h;
        bars += `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${getProjectColor(proj)}" opacity="0.28"><title>${proj} OT: ${formatHours$1(hours)}h</title></rect>`;
      });
      bars += `<text x="${x + barW / 2}" y="${H - 6}" text-anchor="middle" fill="#666" font-size="11" font-family="var(--fsd-font, sans-serif)">${day.label}</text>`;
    });
    if (maxHours >= 8) {
      const y8 = PAD.top + plotH - 8 / maxHours * plotH;
      grid += `<line x1="${PAD.left}" y1="${y8}" x2="${W - PAD.right}" y2="${y8}" stroke="#808080" stroke-width="0.5" opacity="0.35"/>`;
    }
    return `<svg viewBox="0 0 ${W} ${H}" class="fsd-bar-chart">${grid}${bars}</svg>`;
  };
  const renderDonutChart = (projects) => {
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
    let paths = "";
    projects.forEach((p) => {
      const ratio = p.value / total;
      if (ratio <= 0) return;
      const endAngle = startAngle + ratio * Math.PI * 2;
      const largeArc = ratio > 0.5 ? 1 : 0;
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
        paths += `<path d="M${ax1},${ay1} A${R},${R} 0 ${largeArc},1 ${ax2},${ay2} L${ax3},${ay3} A${r},${r} 0 ${largeArc},0 ${ax4},${ay4} Z" fill="${getProjectColor(p.name)}"><title>${p.name}: ${formatHours$1(p.value)}h (${(ratio * 100).toFixed(0)}%)</title></path>`;
      }
      startAngle = endAngle;
    });
    const centerText = `<text x="${cx}" y="${cy - 4}" text-anchor="middle" fill="#171717" font-size="24" font-weight="600" font-family="var(--fsd-font, sans-serif)">${formatHours$1(total)}</text>
    <text x="${cx}" y="${cy + 14}" text-anchor="middle" fill="#808080" font-size="11" font-weight="500" font-family="var(--fsd-font, sans-serif)">시간</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" class="fsd-donut-chart">${paths}${centerText}</svg>`;
  };
  const DASHBOARD_ID = "fsd-dashboard";
  const WEEKLY_TOTAL_WARNING_HOURS = 40;
  const formatDisplayName = (name) => name.replace(/\s*\(FE\)\s*/g, "").trim();
  const formatHours = (hours) => hours.toFixed(1).replace(/\.0$/, "");
  const collectAllProjects = (memberRecord) => {
    const set = /* @__PURE__ */ new Set();
    Object.values(memberRecord).forEach((projects) => {
      Object.keys(projects).forEach((p) => {
        if (p !== "합계") set.add(p);
      });
    });
    return [...set].sort((a, b) => a.localeCompare(b, "ko"));
  };
  const renderSummaryTable = (memberRecord, allProjects, notice) => {
    const headerCells = allProjects.map((p) => `<th style="color:${getProjectColor(p)}">${p}</th>`).join("");
    const rows = Object.entries(memberRecord).map(([name, projects]) => {
      const total = projects["합계"];
      const displayName = formatDisplayName(name);
      const totalTClass = total.T < WEEKLY_TOTAL_WARNING_HOURS ? "fsd-total-t-warning" : "";
      const totalCellClass = total.T < WEEKLY_TOTAL_WARNING_HOURS ? "fsd-total-cell fsd-total-cell-warning" : "fsd-total-cell";
      const totalWarning = total.T < WEEKLY_TOTAL_WARNING_HOURS ? '<div class="fsd-total-warning">* 주간 T 확인 필요</div>' : "";
      const cells = allProjects.map((p) => {
        const s = projects[p];
        if (!s || s.T === 0 && s.OT === 0) return '<td class="fsd-cell-empty">-</td>';
        return `<td>${formatHours(s.T)} / ${formatHours(s.OT)}</td>`;
      }).join("");
      return `<tr>
        <td class="fsd-name-cell"><div class="fsd-name-main">${displayName}</div></td>
        <td><button class="fsd-detail-btn" data-member="${name}">상세보기</button></td>
        <td class="${totalCellClass}"><span class="${totalTClass}">${formatHours(total.T)}</span> / ${formatHours(total.OT)}${totalWarning}</td>
        <td>${formatMM(total.T + total.OT)}</td>
        ${cells}
      </tr>`;
    }).join("");
    return `
    <div class="fsd-section">
      <div class="fsd-section-header">
        <h3 class="fsd-section-title">요약</h3>
        ${notice ? `<div class="fsd-view-notice">${notice}</div>` : ""}
      </div>
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
  const renderMemberDetail = (name, projects, insight, allProjects) => {
    const total = projects["합계"];
    const displayName = formatDisplayName(name);
    const tBadgeClass = total.T < WEEKLY_TOTAL_WARNING_HOURS ? "fsd-badge fsd-badge-warning" : "fsd-badge";
    const otBadge = total.OT > 0 ? `<span class="fsd-badge fsd-badge-ot">OT: ${formatHours(total.OT)}h</span>` : "";
    const legend = insight.projects.map((p) => `<span class="fsd-legend-item"><span class="fsd-legend-dot" style="background:${getProjectColor(p.name)}"></span>${p.name}</span>`).join("");
    const barChart = renderBarChart(insight.dailyProjects, allProjects);
    const donutChart = renderDonutChart(insight.projects);
    const summaryItems = insight.projects.map((p) => {
      const mm = toMM(p.T + p.OT).toFixed(2);
      return `<div class="fsd-summary-item">
        <div class="fsd-summary-proj" style="color:${getProjectColor(p.name)}">[${p.name}]</div>
        <div>T: ${formatHours(p.T)} (${mm})</div>
        ${p.OT > 0 ? `<div>OT: ${formatHours(p.OT)} (${toMM(p.OT).toFixed(2)})</div>` : ""}
      </div>`;
    }).join("");
    const taskDetails = Object.entries(projects).filter(([pName]) => pName !== "합계").map(([pName, pData]) => {
      const tTaskList = pData.tTasks.length ? pData.tTasks.map((t) => `<li>${t}</li>`).join("") : '<li class="fsd-no-task">없음</li>';
      const otTaskList = pData.otTasks.length ? pData.otTasks.map((t) => `<li>${t}</li>`).join("") : "";
      const tCopyText = `[${pName}]
${pData.tTasks.map((t) => `- ${t}`).join("\n")}`;
      const otCopyText = `[${pName}]
${pData.otTasks.map((t) => `- ${t}`).join("\n")}`;
      const gridClass = otTaskList ? "fsd-task-card-grid fsd-task-card-grid-split" : "fsd-task-card-grid";
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
          </div>` : ""}
        </div>
      </div>`;
    }).join("");
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
  const renderDashboard = (analytics, options = {}) => {
    document.getElementById(DASHBOARD_ID)?.remove();
    const { memberRecord, memberInsights } = analytics;
    const allProjects = collectAllProjects(memberRecord);
    const summaryTable = renderSummaryTable(memberRecord, allProjects, options.notice);
    const detailPanels = Object.entries(memberRecord).map(([name, projects]) => {
      const insight = memberInsights[name];
      if (!insight) return "";
      return renderMemberDetail(name, projects, insight, allProjects);
    }).join("");
    const container = document.createElement("div");
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
  const bindEvents = (container, analytics) => {
    container.querySelector(".fsd-close-btn")?.addEventListener("click", () => {
      container.remove();
    });
    container.querySelector(".fsd-overlay")?.addEventListener("click", (e) => {
      if (e.target.classList.contains("fsd-overlay")) {
        container.remove();
      }
    });
    const escHandler = (e) => {
      if (e.key === "Escape") {
        container.remove();
        document.removeEventListener("keydown", escHandler);
      }
    };
    document.addEventListener("keydown", escHandler);
    container.querySelectorAll(".fsd-detail-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const member = btn.dataset.member;
        container.querySelectorAll(".fsd-detail-panel").forEach((p) => {
          p.style.display = "none";
        });
        const panel = container.querySelector(`.fsd-detail-panel[data-member="${member}"]`);
        if (panel) {
          panel.style.display = "block";
          panel.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });
    container.querySelectorAll(".fsd-close-detail").forEach((btn) => {
      btn.addEventListener("click", () => {
        const panel = btn.closest(".fsd-detail-panel");
        if (panel) panel.style.display = "none";
      });
    });
    container.querySelectorAll(".fsd-copy-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const text = decodeURIComponent(btn.dataset.copy ?? "");
        navigator.clipboard.writeText(text).then(() => {
          const original = btn.textContent;
          btn.textContent = "Copied";
          setTimeout(() => {
            btn.textContent = original;
          }, 1500);
        });
      });
    });
    container.querySelectorAll(".fsd-copy-summary-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const member = btn.dataset.member;
        if (!member) return;
        const projects = analytics.memberRecord[member];
        if (!projects) return;
        const lines = [];
        Object.entries(projects).forEach(([pName, pData]) => {
          if (pName === "합계") return;
          if (pData.T === 0 && pData.OT === 0) return;
          lines.push(`[${pName}]`);
          pData.tasks.forEach((t) => lines.push(`- ${t}`));
          lines.push("");
        });
        navigator.clipboard.writeText(lines.join("\n")).then(() => {
          const original = btn.textContent;
          btn.textContent = "Copied";
          setTimeout(() => {
            btn.textContent = original;
          }, 1500);
        });
      });
    });
  };
  const removeDashboard = () => {
    document.getElementById(DASHBOARD_ID)?.remove();
  };
  const cssText = `
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@1.3.9/dist/web/static/pretendard.css');
/* ===== FSD: FB Schedule Dashboard — Flat Dashboard System ===== */
/* Pretendard Font (fallback to system) */
:root {
  --fsd-font: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Segoe UI', sans-serif;

  /* Vercel Colors */
  --fsd-black: #171717;
  --fsd-white: #ffffff;
  --fsd-gray-50: #fafafa;
  --fsd-gray-100: #ebebeb;
  --fsd-gray-200: #e0e0e0;
  --fsd-gray-400: #808080;
  --fsd-gray-500: #666666;
  --fsd-gray-600: #4d4d4d;
  --fsd-gray-900: #171717;

  /* Functional Accents */
  --fsd-blue: #0a72ef;
  --fsd-pink: #de1d8d;
  --fsd-red: #ff5b4f;
  --fsd-link: #0072f5;
  --fsd-focus: hsla(212, 100%, 48%, 1);

  /* Shadows */
  --fsd-shadow-border: rgba(0, 0, 0, 0.08) 0px 0px 0px 1px;
  --fsd-shadow-card: rgba(0,0,0,0.08) 0px 0px 0px 1px, rgba(0,0,0,0.04) 0px 2px 2px, rgba(0,0,0,0.04) 0px 8px 8px -8px, #fafafa 0px 0px 0px 1px inset;
  --fsd-shadow-elevated: rgba(0,0,0,0.08) 0px 0px 0px 1px, rgba(0,0,0,0.06) 0px 4px 12px, rgba(0,0,0,0.04) 0px 16px 32px -8px;

  /* Radius */
  --fsd-radius-sm: 6px;
  --fsd-radius-md: 8px;
  --fsd-radius-lg: 8px;
  --fsd-radius-pill: 9999px;
}
/* ===== Overlay ===== */
#fsd-dashboard .fsd-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: hsla(0, 0%, 98%, 0.8);
  backdrop-filter: blur(4px);
  z-index: 999999;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--fsd-font);
  font-feature-settings: "liga";
  -webkit-font-smoothing: antialiased;
}
/* ===== Modal ===== */
#fsd-dashboard .fsd-modal {
  background: var(--fsd-white);
  color: var(--fsd-black);
  border-radius: var(--fsd-radius-lg);
  width: 95vw;
  max-width: 1400px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: var(--fsd-shadow-elevated);
}
#fsd-dashboard .fsd-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  box-shadow: var(--fsd-shadow-border);
}
#fsd-dashboard .fsd-modal-header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0;
  color: var(--fsd-gray-900);
}
#fsd-dashboard .fsd-modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}
/* ===== Close Button ===== */
#fsd-dashboard .fsd-close-btn,
#fsd-dashboard .fsd-close-detail {
  background: none;
  border: none;
  color: var(--fsd-gray-400);
  font-size: 16px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--fsd-radius-sm);
  transition: color 0.15s, background 0.15s;
}
#fsd-dashboard .fsd-close-btn:hover,
#fsd-dashboard .fsd-close-detail:hover {
  color: var(--fsd-black);
  background: var(--fsd-gray-50);
}
/* ===== Section ===== */
#fsd-dashboard .fsd-section-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin: 0 0 16px;
}
#fsd-dashboard .fsd-section-title {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0;
  margin: 0;
  color: var(--fsd-gray-900);
  font-family: var(--fsd-font);
}
#fsd-dashboard .fsd-view-notice {
  position: absolute;
  top: 0;
  right: 0;
  display: block;
  width: max-content;
  color: var(--fsd-red);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
  text-align: right;
  white-space: nowrap !important;
}
/* ===== Summary Table ===== */
#fsd-dashboard .fsd-table-wrap {
  overflow-x: auto;
  margin-bottom: 24px;
  border-radius: var(--fsd-radius-md);
  box-shadow: var(--fsd-shadow-card);
}
#fsd-dashboard .fsd-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  white-space: nowrap;
}
#fsd-dashboard .fsd-table th {
  background: var(--fsd-gray-50);
  color: var(--fsd-gray-600);
  padding: 10px 14px;
  text-align: center;
  font-weight: 500;
  font-size: 12px;
  letter-spacing: 0;
  position: sticky;
  top: 0;
  border-bottom: 1px solid var(--fsd-gray-100);
}
#fsd-dashboard .fsd-table td {
  padding: 10px 14px;
  text-align: center;
  border-bottom: 1px solid var(--fsd-gray-100);
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}
#fsd-dashboard .fsd-table tbody tr {
  transition: background 0.1s;
}
#fsd-dashboard .fsd-table tbody tr:hover {
  background: var(--fsd-gray-50);
}
#fsd-dashboard .fsd-name-cell {
  font-weight: 600;
  color: var(--fsd-gray-900);
  text-align: center;
  letter-spacing: 0;
  white-space: nowrap;
}
#fsd-dashboard .fsd-name-main {
  white-space: nowrap;
}
#fsd-dashboard .fsd-total-warning {
  margin-top: 3px;
  color: var(--fsd-red);
  font-size: 10px;
  font-weight: 500;
  line-height: 1.25;
  white-space: nowrap;
}
#fsd-dashboard .fsd-cell-empty {
  color: var(--fsd-gray-200);
}
#fsd-dashboard .fsd-total-cell {
  font-weight: 600;
  color: var(--fsd-gray-900);
}
#fsd-dashboard .fsd-total-t-warning {
  color: var(--fsd-red) !important;
}
#fsd-dashboard .fsd-total-cell-warning .fsd-total-t-warning {
  color: var(--fsd-red) !important;
}
/* ===== Project Header Colors ===== */
#fsd-dashboard .fsd-table th[data-project] {
  font-weight: 600;
}
/* ===== Detail Button (Pill Badge) ===== */
#fsd-dashboard .fsd-detail-btn {
  background: var(--fsd-gray-900);
  color: var(--fsd-white);
  border: none;
  padding: 4px 12px;
  border-radius: var(--fsd-radius-pill);
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
  font-family: var(--fsd-font);
  transition: background 0.15s, transform 0.1s;
}
#fsd-dashboard .fsd-detail-btn:hover {
  background: var(--fsd-gray-600);
  transform: translateY(-1px);
}
/* ===== Detail Panel ===== */
#fsd-dashboard .fsd-detail-panel {
  display: none;
  background: var(--fsd-white);
  border-radius: var(--fsd-radius-lg);
  margin-top: 20px;
  padding: 24px;
  box-shadow: var(--fsd-shadow-card);
}
#fsd-dashboard .fsd-detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  box-shadow: inset 0 -1px 0 var(--fsd-gray-100);
}
#fsd-dashboard .fsd-detail-header h3 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  letter-spacing: 0;
  color: var(--fsd-gray-900);
  margin-right: auto;
}
#fsd-dashboard .fsd-badge-group {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  margin-right: 10px;
}
#fsd-dashboard .fsd-badge {
  background: var(--fsd-gray-900);
  color: var(--fsd-white);
  padding: 4px 14px;
  border-radius: var(--fsd-radius-pill);
  font-size: 12px;
  font-weight: 500;
  font-family: var(--fsd-font);
}
#fsd-dashboard .fsd-badge-warning {
  background: var(--fsd-red);
  color: var(--fsd-white);
}
#fsd-dashboard .fsd-badge-ot {
  background: var(--fsd-red);
  color: var(--fsd-white);
}
/* ===== Charts Area ===== */
#fsd-dashboard .fsd-charts-area {
  display: grid;
  grid-template-columns: 1fr 1fr 260px;
  gap: 16px;
  margin-bottom: 24px;
}
#fsd-dashboard .fsd-chart-section {
  background: var(--fsd-white);
  border-radius: var(--fsd-radius-md);
  padding: 16px;
  box-shadow: var(--fsd-shadow-border);
}
#fsd-dashboard .fsd-chart-section h4 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--fsd-gray-500);
  text-align: center;
  font-family: var(--fsd-font);
  letter-spacing: 0;
}
#fsd-dashboard .fsd-bar-chart,
#fsd-dashboard .fsd-donut-chart {
  width: 100%;
  height: auto;
}
/* ===== Legend ===== */
#fsd-dashboard .fsd-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 12px;
}
#fsd-dashboard .fsd-legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--fsd-gray-500);
  font-weight: 500;
}
#fsd-dashboard .fsd-legend-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  display: inline-block;
}
/* ===== Summary Sidebar ===== */
#fsd-dashboard .fsd-summary-sidebar {
  background: var(--fsd-white);
  border-radius: var(--fsd-radius-md);
  padding: 16px;
  box-shadow: var(--fsd-shadow-border);
}
#fsd-dashboard .fsd-summary-sidebar h4 {
  margin: 0 0 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--fsd-gray-500);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: var(--fsd-font);
  letter-spacing: 0;
}
#fsd-dashboard .fsd-summary-item {
  margin-bottom: 10px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--fsd-gray-600);
}
#fsd-dashboard .fsd-summary-proj {
  font-weight: 600;
  font-size: 13px;
  letter-spacing: 0;
}
/* ===== Task Details ===== */
#fsd-dashboard .fsd-task-details {
  margin-top: 8px;
}
#fsd-dashboard .fsd-task-details > h4 {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 16px;
  color: var(--fsd-gray-900);
  letter-spacing: 0;
}
#fsd-dashboard .fsd-task-group {
  margin-bottom: 16px;
}
#fsd-dashboard .fsd-task-group h5 {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0;
}
#fsd-dashboard .fsd-project-badge {
  display: inline-flex;
  align-items: center;
  color: var(--fsd-project-color);
  background: color-mix(in srgb, var(--fsd-project-color) 12%, var(--fsd-white));
  padding: 2px 10px;
  border-radius: var(--fsd-radius-pill);
  font-size: 12px;
  font-weight: 600;
}
#fsd-dashboard .fsd-task-card-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
}
#fsd-dashboard .fsd-task-card-grid-split {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
#fsd-dashboard .fsd-task-card {
  background: var(--fsd-gray-50);
  border-radius: var(--fsd-radius-md);
  padding: 14px;
  margin-bottom: 8px;
  box-shadow: var(--fsd-shadow-border);
}
#fsd-dashboard .fsd-task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
#fsd-dashboard .fsd-task-type {
  color: var(--fsd-gray-900);
  font-weight: 600;
  font-size: 14px;
  font-family: var(--fsd-font);
}
#fsd-dashboard .fsd-ot-type {
  color: var(--fsd-red);
}
#fsd-dashboard .fsd-task-card ul {
  margin: 0;
  padding-left: 0;
  font-size: 13px;
  color: var(--fsd-gray-600);
  list-style: none;
  line-height: 1.7;
}
#fsd-dashboard .fsd-task-card ul li::before {
  content: '- ';
  color: var(--fsd-gray-400);
}
#fsd-dashboard .fsd-no-task {
  color: var(--fsd-gray-400);
}
/* ===== Copy Button ===== */
#fsd-dashboard .fsd-copy-btn,
#fsd-dashboard .fsd-copy-summary-btn {
  background: var(--fsd-white);
  color: var(--fsd-gray-600);
  border: none;
  padding: 3px 10px;
  border-radius: var(--fsd-radius-sm);
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
  font-family: var(--fsd-font);
  box-shadow: var(--fsd-shadow-border);
  transition: background 0.15s, color 0.15s;
}
#fsd-dashboard .fsd-copy-btn:hover,
#fsd-dashboard .fsd-copy-summary-btn:hover {
  background: var(--fsd-gray-50);
  color: var(--fsd-black);
}
/* ===== Empty State ===== */
#fsd-dashboard .fsd-empty {
  text-align: center;
  color: var(--fsd-gray-400);
  padding: 24px;
  font-size: 13px;
}
/* ===== FAB (Floating Action Button) ===== */
#fsd-fab {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 999998;
  background: var(--fsd-black, #171717);
  color: var(--fsd-white, #ffffff);
  border: none;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  font-size: 18px;
  cursor: pointer;
  box-shadow: rgba(0,0,0,0.08) 0px 0px 0px 1px, rgba(0,0,0,0.12) 0px 4px 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  transition: transform 0.2s, box-shadow 0.2s;
  font-family: var(--fsd-font);
}
#fsd-fab:hover {
  transform: scale(1.08);
  box-shadow: rgba(0,0,0,0.08) 0px 0px 0px 1px, rgba(0,0,0,0.16) 0px 8px 24px;
}
/* ===== SVG Chart Styling ===== */
#fsd-dashboard .fsd-bar-chart text {
  font-family: var(--fsd-font);
}
#fsd-dashboard .fsd-donut-chart path {
  transition: opacity 0.15s;
  cursor: pointer;
}
#fsd-dashboard .fsd-donut-chart path:hover {
  opacity: 0.8;
}
/* ===== Scrollbar ===== */
#fsd-dashboard .fsd-modal-body::-webkit-scrollbar {
  width: 6px;
}
#fsd-dashboard .fsd-modal-body::-webkit-scrollbar-track {
  background: transparent;
}
#fsd-dashboard .fsd-modal-body::-webkit-scrollbar-thumb {
  background: var(--fsd-gray-200);
  border-radius: 3px;
}
#fsd-dashboard .fsd-modal-body::-webkit-scrollbar-thumb:hover {
  background: var(--fsd-gray-400);
}
/* ===== Week Info Bar ===== */
#fsd-dashboard .fsd-week-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding: 12px 16px;
  background: var(--fsd-gray-50);
  border-radius: var(--fsd-radius-md);
  box-shadow: var(--fsd-shadow-border);
  font-size: 13px;
  color: var(--fsd-gray-600);
}
#fsd-dashboard .fsd-week-info strong {
  color: var(--fsd-gray-900);
  font-weight: 600;
}
#fsd-dashboard .fsd-week-badge {
  background: var(--fsd-gray-900);
  color: var(--fsd-white);
  padding: 2px 10px;
  border-radius: var(--fsd-radius-pill);
  font-size: 11px;
  font-weight: 500;
  font-family: var(--fsd-font);
}
`;
  const FAB_ID = "fsd-fab";
  const STYLES_ID = "fsd-styles";
  const OPEN_EVENT = "fsd:open-dashboard";
  const OPEN_MESSAGE = "fsd:open-dashboard";
  const openDashboard = () => {
    const isPersonalWeekly = isWeeklyPersonalView();
    const items = parseCurrentScheduleView();
    if (items.length === 0) {
      alert("일정 데이터를 찾을 수 없습니다.\n개인별 주간 뷰 또는 주 탭에서 내일정만보기를 선택해주세요.");
      return false;
    }
    const analytics = buildScheduleAnalytics(items);
    renderDashboard(analytics, {
      notice: isPersonalWeekly ? "* 공동 일정 포함 확인은 주 탭 + 내일정만보기에서 진행해주세요." : void 0
    });
    return true;
  };
  const createFab = () => {
    if (document.getElementById(FAB_ID)) return;
    const fab = document.createElement("button");
    fab.id = FAB_ID;
    fab.textContent = "📊";
    fab.title = "FE Schedule Dashboard";
    fab.addEventListener("click", () => {
      openDashboard();
    });
    document.body.appendChild(fab);
  };
  const removeFab = () => {
    document.getElementById(FAB_ID)?.remove();
  };
  const injectStyles = () => {
    if (document.getElementById(STYLES_ID)) return;
    const style = document.createElement("style");
    style.id = STYLES_ID;
    style.textContent = cssText;
    document.head.appendChild(style);
  };
  const init = () => {
    if (window.__FSD_CONTENT_INITIALIZED__) return;
    window.__FSD_CONTENT_INITIALIZED__ = true;
    injectStyles();
    window.addEventListener(OPEN_EVENT, () => {
      openDashboard();
    });
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type !== OPEN_MESSAGE) return false;
      sendResponse({ opened: openDashboard() });
      return false;
    });
    if (isSupportedScheduleView()) {
      createFab();
    }
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
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
