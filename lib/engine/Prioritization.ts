import { CodeNode, PriorityLevel } from "./types";

export function calculateTestPriorities(
  tests: CodeNode[],
  impactDistances: Map<string, number>
): CodeNode[] {
  return tests.map(test => {
    const distance = impactDistances.has(test.id) ? impactDistances.get(test.id)! : -1;
    let score = 0;
    const reasons: string[] = [];

    // 1. Dependency Proximity
    if (distance === 1) {
      score += 75;
      reasons.push("Directly depends on modified code");
    } else if (distance === 2) {
      score += 55;
      reasons.push("1 hop from modified code");
    } else if (distance > 2) {
      score += 35;
      reasons.push(`${distance - 1} hops from modified code`);
    } else {
      score = Math.floor(Math.random() * 10); // Small random baseline for unaffected tests
      reasons.push("No direct dependency on changes");
    }

    if (distance !== -1) {
      // 2. Historical Failures
      const failures = test.historyFailures || 0;
      if (failures > 0) {
        const failScore = Math.min(failures * 3, 15);
        score += failScore;
        reasons.push(`Historically flaky/failed (${failures} times)`);
      }

      // 3. Module Criticality
      const criticalModules = ['payment', 'auth', 'orders'];
      if (test.module && criticalModules.some(m => test.module?.toLowerCase().includes(m))) {
        score += 10;
        reasons.push(`High criticality module (${test.module})`);
      }

      // 4. Execution Time (favor faster tests slightly for fail-fast)
      if (test.executionTimeMs && test.executionTimeMs < 100) {
        score += 5;
        reasons.push("Fast execution time");
      }
    }

    // Clamp score 0-100
    score = Math.min(Math.max(score, 0), 100);

    let level: PriorityLevel = 'NONE';
    if (score >= 80) level = 'HIGH';
    else if (score >= 50) level = 'MEDIUM';
    else if (score > 10) level = 'LOW';
    else level = 'LOW'; // Everything unaffected is low

    return {
      ...test,
      priorityScore: score,
      priorityLevel: level,
      priorityReason: reasons.join(" • ")
    };
  }).sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
}
