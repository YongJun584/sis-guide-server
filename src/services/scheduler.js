"use strict";

// 하루 시간표를 자동으로 짜는 단순한 그리디 스케줄러입니다.
// 이미 정해진 일정(fixedBlocks - 예: 통학, 학원)을 먼저 배치하고, 남는 빈
// 시간에 할 일(tasks)을 우선순위(중요도 + 마감 임박도) 순서로 하나씩 채워
// 넣습니다(First-Fit 그리디 빈패킹). 여러 조합을 다 시도해보는 완전탐색은
// 아니라서 이론상 최적해는 아니지만, 학생이 손으로 짜는 것보다 빠르고
// "무엇을 먼저 해야 하는지" 순서를 자동으로 정해준다는 데 의미가 있습니다.

const PRIORITY_WEIGHT = { high: 3, medium: 2, low: 1 };

// "HH:MM" -> 자정부터의 분(minute)
function toMinutes(hhmm) {
  if (typeof hhmm !== "string") return null;
  const match = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

// 분(minute) -> "HH:MM"
function toTimeString(minutes) {
  const clamped = Math.max(0, Math.min(24 * 60, Math.round(minutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// 구간들을 시간순 정렬 + 겹치는 구간 병합합니다.
function mergeIntervals(intervals) {
  const sorted = intervals.slice().sort((a, b) => a.start - b.start);
  const merged = [];
  for (const cur of sorted) {
    const last = merged[merged.length - 1];
    if (last && cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      merged.push({ start: cur.start, end: cur.end });
    }
  }
  return merged;
}

// [dayStart, dayEnd] 구간에서 occupied(고정 일정)를 뺀 빈 구간들을 구합니다.
function freeIntervals(dayStart, dayEnd, occupied) {
  const merged = mergeIntervals(occupied);
  const free = [];
  let cursor = dayStart;
  for (const block of merged) {
    if (block.start > cursor) free.push({ start: cursor, end: Math.min(block.start, dayEnd) });
    cursor = Math.max(cursor, block.end);
    if (cursor >= dayEnd) break;
  }
  if (cursor < dayEnd) free.push({ start: cursor, end: dayEnd });
  return free.filter((f) => f.end > f.start);
}

function taskSortKey(task) {
  const weight = PRIORITY_WEIGHT[task.priority] ?? PRIORITY_WEIGHT.medium;
  const dueTime = task.dueDate ? new Date(task.dueDate).getTime() : null;
  const dueRank = Number.isFinite(dueTime) ? dueTime : Infinity;
  return { weight, dueRank };
}

// fixedBlocks: [{ label, start, end }]  (start/end는 분 단위)
// tasks: [{ id, text, durationMinutes, priority, dueDate }]
function generateSchedule({ dayStartMinutes, dayEndMinutes, fixedBlocks = [], tasks = [] }) {
  if (!Number.isFinite(dayStartMinutes) || !Number.isFinite(dayEndMinutes) || dayEndMinutes <= dayStartMinutes) {
    throw new Error("dayEnd는 dayStart보다 늦어야 합니다.");
  }

  let free = freeIntervals(
    dayStartMinutes,
    dayEndMinutes,
    fixedBlocks.map((b) => ({ start: b.start, end: b.end }))
  );

  // 중요도 높은 것 먼저, 같으면 마감이 임박한 것 먼저(그리디 우선순위 큐와 동일한 효과).
  const orderedTasks = tasks.slice().sort((a, b) => {
    const ka = taskSortKey(a);
    const kb = taskSortKey(b);
    if (ka.weight !== kb.weight) return kb.weight - ka.weight;
    return ka.dueRank - kb.dueRank;
  });

  const taskBlocks = [];
  const unscheduled = [];

  for (const task of orderedTasks) {
    const duration = Math.max(5, Number(task.durationMinutes) || 30);
    // First-Fit: 이 할 일이 들어갈 수 있는 첫 번째 빈 구간을 찾습니다.
    const slotIndex = free.findIndex((f) => f.end - f.start >= duration);
    if (slotIndex === -1) {
      unscheduled.push(task);
      continue;
    }
    const slot = free[slotIndex];
    const start = slot.start;
    const end = start + duration;
    taskBlocks.push({ taskId: task.id, text: task.text, priority: task.priority ?? "medium", start, end });

    if (end >= slot.end) {
      free.splice(slotIndex, 1);
    } else {
      free[slotIndex] = { start: end, end: slot.end };
    }
  }

  const blocks = [
    ...fixedBlocks.map((b) => ({ type: "fixed", label: b.label, start: b.start, end: b.end })),
    ...taskBlocks.map((b) => ({
      type: "task",
      taskId: b.taskId,
      label: b.text,
      priority: b.priority,
      start: b.start,
      end: b.end,
    })),
  ].sort((a, b) => a.start - b.start);

  return {
    blocks: blocks.map((b) => ({ ...b, start: toTimeString(b.start), end: toTimeString(b.end) })),
    unscheduled: unscheduled.map((t) => ({
      taskId: t.id,
      text: t.text,
      priority: t.priority ?? "medium",
      durationMinutes: t.durationMinutes,
    })),
  };
}

module.exports = { generateSchedule, toMinutes, toTimeString };
