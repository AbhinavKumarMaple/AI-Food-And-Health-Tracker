import { describe, it, expect } from "vitest";
import {
  deriveCycles,
  cycleStats,
  predictNextOnset,
  buildPhaseResolver,
  lastDeviation,
  cycleRedFlags,
  addDays,
} from "./engine";
import type { CycleLog } from "@/lib/store/types";

let counter = 0;
function log(date: string, patch: Partial<CycleLog> = {}): CycleLog {
  return {
    id: `c${counter++}`,
    userId: "u",
    date,
    isPeriodStart: false,
    flow: null,
    clots: false,
    flooding: false,
    bbtCelsius: null,
    cervicalMucus: null,
    ovulationTest: null,
    intercourse: null,
    notes: null,
    source: "manual",
    createdAt: `${date}T00:00:00.000Z`,
    updatedAt: `${date}T00:00:00.000Z`,
    ...patch,
  };
}

/** Build period day-logs: a start + (periodLen-1) bleeding days at each onset. */
function buildLogs(starts: string[], periodLen = 4): CycleLog[] {
  const out: CycleLog[] = [];
  for (const s of starts) {
    out.push(log(s, { isPeriodStart: true, flow: "medium" }));
    for (let d = 1; d < periodLen; d++) out.push(log(addDays(s, d), { flow: "light" }));
  }
  return out;
}

describe("cycle engine", () => {
  it("derives cycle lengths and a regular personal stat", () => {
    const logs = buildLogs(["2026-01-01", "2026-01-29", "2026-02-26", "2026-03-26"]);
    const cycles = deriveCycles(logs);
    expect(cycles).toHaveLength(4);
    expect(cycles.slice(0, 3).map((c) => c.lengthDays)).toEqual([28, 28, 28]);
    expect(cycles[3].isOpen).toBe(true);
    expect(cycles[0].periodLengthDays).toBe(4);

    const stats = cycleStats(cycles);
    expect(stats.nCycles).toBe(3);
    expect(stats.medianLength).toBe(28);
    expect(stats.regularity).toBe("regular");
  });

  it("predicts the next onset from the last anchor", () => {
    const logs = buildLogs(["2026-01-01", "2026-01-29", "2026-02-26", "2026-03-26"]);
    const cycles = deriveCycles(logs);
    const stats = cycleStats(cycles);
    const pred = predictNextOnset(cycles, stats, { today: "2026-04-05", avgPrior: 28 });
    expect(pred).not.toBeNull();
    expect(pred!.predictedDate).toBe("2026-04-23"); // 2026-03-26 + 28
    expect(pred!.confidence).toBe("medium"); // 3 cycles
  });

  it("labels phases, anchoring the luteal phase backward from the next onset", () => {
    const logs = buildLogs(["2026-01-01", "2026-01-29", "2026-02-26", "2026-03-26"]);
    const r = buildPhaseResolver(logs, { today: "2026-04-05", avgPrior: 28 });
    expect(r.phaseOf("2026-01-02").phase).toBe("menstrual"); // within the bleed
    expect(r.phaseOf("2026-01-15").phase).toBe("ovulatory"); // ~ovulation (28-14)
    expect(r.phaseOf("2026-01-25").phase).toBe("luteal"); // post-ovulation
    expect(r.phaseOf("2026-01-10").phase).toBe("follicular");
  });

  it("flags the most recent completed cycle as late vs the personal baseline", () => {
    const logs = buildLogs([
      "2026-01-01",
      "2026-01-29", // 28
      "2026-02-26", // 28
      "2026-03-26", // 28 — last completed cycle is 03-26 → 04-30 = 35 days (late)
      "2026-04-30", // opens the current cycle, closing the 35-day one before it
    ]);
    const cycles = deriveCycles(logs);
    const stats = cycleStats(cycles);
    const dev = lastDeviation(cycles, stats);
    expect(dev).not.toBeNull();
    expect(dev!.classification).toBe("late");
    expect(dev!.deviationDays).toBeGreaterThan(0);
  });

  it("raises a gentle red flag for consistently short cycles", () => {
    const logs = buildLogs(["2026-01-01", "2026-01-21", "2026-02-10", "2026-03-02"]); // 20-day cycles
    const cycles = deriveCycles(logs);
    const stats = cycleStats(cycles);
    const flags = cycleRedFlags(cycles, stats, logs, "2026-03-10");
    expect(flags.some((f) => f.id === "short-cycles")).toBe(true);
  });

  it("returns no prediction and unknown phase when nothing is logged", () => {
    expect(predictNextOnset([], cycleStats([]), { today: "2026-04-05", avgPrior: 28 })).toBeNull();
    const r = buildPhaseResolver([], { today: "2026-04-05", avgPrior: 28 });
    expect(r.phaseOf("2026-04-05").phase).toBe("unknown");
  });
});
