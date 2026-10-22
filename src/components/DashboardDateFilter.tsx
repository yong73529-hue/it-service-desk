"use client";

import { useState } from "react";

type Range = "today" | "week" | "month" | "custom";

export function DashboardDateFilter({
  initialRange,
  initialFrom,
  initialTo,
}: {
  initialRange: Range;
  initialFrom?: string;
  initialTo?: string;
}) {
  const [range, setRange] = useState<Range>(initialRange);

  return (
    <form
      className="flex w-full flex-col gap-3 xl:w-auto xl:items-end"
      aria-label="看板统计时间范围"
    >
      <div className="w-full xl:w-40">
        <label className="label" htmlFor="dashboard-range">
          统计周期
        </label>
        <select
          className="input"
          id="dashboard-range"
          name="range"
          value={range}
          onChange={(event) => setRange(event.target.value as Range)}
        >
          <option value="today">今天</option>
          <option value="week">本周</option>
          <option value="month">本月</option>
          <option value="custom">自定义日期</option>
        </select>
      </div>

      {range === "custom" && (
        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] xl:w-auto">
          <div>
            <label className="label" htmlFor="dashboard-from">
              开始日期
            </label>
            <input
              className="input"
              id="dashboard-from"
              type="date"
              name="from"
              defaultValue={initialFrom}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="dashboard-to">
              结束日期
            </label>
            <input
              className="input"
              id="dashboard-to"
              type="date"
              name="to"
              defaultValue={initialTo}
              required
            />
          </div>
          <button className="btn btn-primary self-end" type="submit">
            应用
          </button>
        </div>
      )}

      {range !== "custom" && (
        <button className="btn btn-primary w-full xl:w-auto" type="submit">
          应用
        </button>
      )}
    </form>
  );
}
