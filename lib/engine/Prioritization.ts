import { CodeNode, PriorityLevel } from "./types";

export function calculateTestPriorities(
  tests: CodeNode[],
  impactDistances: Map<string, number>
): CodeNode[] {
  return tests.map(test => {
    const distance = impactDistances.has(test.id) ? impactDistances.get(test.id)! : -1;
    let score = 0;
    const reasons: string[] = [];
    let level: PriorityLevel = 'NONE';

    // 1. Dependency Proximity (Honest assessment)
    if (distance === 1) {
      score = 85;
      level = 'HIGH';
      reasons.push("Directly depends on changed code (1 hop)");
    } else if (distance === 2) {
      score = 65;
      level = 'MEDIUM';
      reasons.push("Indirectly depends on changed code (2 hops)");
    } else if (distance > 2) {
      score = 30;
      level = 'LOW';
      reasons.push(`Extended dependency chain (${distance} hops)`);
    } else {
      score = 0;
      level = 'LOW';
      reasons.push("Low / No Detected Impact path from changes");
    }

    if (distance !== -1) {
      // 2. Historical Failures (ONLY if explicitly provided)
      if (test.historyFailures && test.historyFailures > 0) {
        score += Math.min(test.historyFailures * 3, 15);
        reasons.push(`Historically flaky/failed (${test.historyFailures} times)`);
      }

      // 3. Execution Time
      if (test.executionTimeMs && test.executionTimeMs < 100) {
        score += 5;
        reasons.push(`Fast execution (${test.executionTimeMs}ms)`);
      }
    }

    // Clamp score 0-100
    score = Math.min(Math.max(score, 0), 100);

    // Upgrade level if score pushes it over the threshold due to other factors (if they exist)
    if (score >= 80) level = 'HIGH';
    else if (score >= 50) level = 'MEDIUM';
    else level = 'LOW';

    return {
      ...test,
      priorityScore: score,
      priorityLevel: level,
      priorityReason: reasons.join(" • ")
    };
  }).sort((a, b) => {
    // Sort HIGH > MEDIUM > LOW > NO IMPACT
    return (b.priorityScore || 0) - (a.priorityScore || 0);
  });
}
