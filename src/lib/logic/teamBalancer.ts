import { PlayerWithStatsT } from "@/types/models";
import { shuffle } from "./shuffle";

export type TeamStats = {
  players: PlayerWithStatsT[];
  totalKills: number;
  totalDeaths: number;
  totalWins: number;
  weightedScore: number;
  squadName?: string; // Custom name from squad, used for slot export
};

// ─── Helper: get player's weighted score ────────────────────
function ws(p: PlayerWithStatsT): number {
  // @ts-expect-error weightedScore is added at runtime
  return p.weightedScore ?? 0;
}

// ─── Helper: compute team weighted score from players ───────
function teamScore(players: PlayerWithStatsT[]): number {
  return players.reduce((s, p) => s + ws(p), 0);
}

// ─── Helper: build TeamStats from players ───────────────────
function buildTeam(players: PlayerWithStatsT[], seasonId?: string): TeamStats {
  return {
    players,
    totalKills: players.reduce((s, p) => s + (p.stats.find(st => st.seasonId === seasonId)?.kills ?? 0), 0),
    totalDeaths: players.reduce((s, p) => s + (p.stats.find(st => st.seasonId === seasonId)?.matches ?? 0), 0),
    totalWins: 0,
    weightedScore: teamScore(players),
  };
}

// ─── Helper: check previous teammates ───────────────────────
function hasPreviousTeammate(
  playerIds: string[],
  previousTeammates?: Map<string, Set<string>>,
): boolean {
  if (!previousTeammates) return false;
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      if (previousTeammates.get(playerIds[i])?.has(playerIds[j])) return true;
    }
  }
  return false;
}

// ─── Post-assignment optimizer ──────────────────────────────
/**
 * Swaps players between teams to minimize score variance.
 * For each pair of teams, tries swapping players in the same
 * "slot" (position within the team) to keep tier mixing valid.
 * Falls back to cross-slot swaps if same-slot doesn't help.
 *
 * Runs up to MAX_ROUNDS passes. Each pass tries all team pairs.
 * Accepts a swap if it reduces the score range (max - min).
 */
function optimizeTeamBalance(
  teams: TeamStats[],
  previousTeammates?: Map<string, Set<string>>,
  maxRounds = 50,
): void {
  if (teams.length < 2) return;

  const getRange = () => {
    const scores = teams.map(t => t.weightedScore);
    return Math.max(...scores) - Math.min(...scores);
  };

  for (let round = 0; round < maxRounds; round++) {
    let improved = false;

    for (let a = 0; a < teams.length - 1; a++) {
      for (let b = a + 1; b < teams.length; b++) {
        const teamA = teams[a];
        const teamB = teams[b];
        const scoreDiff = Math.abs(teamA.weightedScore - teamB.weightedScore);
        if (scoreDiff < 1) continue; // Already balanced enough

        // Try swapping each player from A with each player from B
        for (let i = 0; i < teamA.players.length; i++) {
          for (let j = 0; j < teamB.players.length; j++) {
            const pA = teamA.players[i];
            const pB = teamB.players[j];

            // Skip if players have the same score (swap won't help)
            if (Math.abs(ws(pA) - ws(pB)) < 0.1) continue;

            // Calculate new team scores after swap
            const newScoreA = teamA.weightedScore - ws(pA) + ws(pB);
            const newScoreB = teamB.weightedScore - ws(pB) + ws(pA);
            const newDiff = Math.abs(newScoreA - newScoreB);

            // Only accept if this swap improves balance
            if (newDiff >= scoreDiff) continue;

            // Check previous teammates constraint
            const newPlayersA = [...teamA.players];
            newPlayersA[i] = pB;
            const newPlayersB = [...teamB.players];
            newPlayersB[j] = pA;

            if (hasPreviousTeammate(newPlayersA.map(p => p.id), previousTeammates)) continue;
            if (hasPreviousTeammate(newPlayersB.map(p => p.id), previousTeammates)) continue;

            // Perform the swap
            teamA.players[i] = pB;
            teamB.players[j] = pA;
            teamA.weightedScore = newScoreA;
            teamB.weightedScore = newScoreB;
            improved = true;
          }
        }
      }
    }

    if (!improved) break;
  }

  // Log final balance stats
  const scores = teams.map(t => t.weightedScore);
  const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
  const stdDev = Math.sqrt(scores.reduce((s, v) => s + (v - avg) ** 2, 0) / scores.length);
  const range = Math.max(...scores) - Math.min(...scores);
  console.log(
    `[TeamBalancer] ${teams.length} teams | avg=${avg.toFixed(1)} | range=${range.toFixed(1)} | stddev=${stdDev.toFixed(1)}`
  );
}

// ─── Balanced Duo Creator ───────────────────────────────────
/**
 * Creates balanced duo teams.
 * Step 1: Sort players by score, pair strongest with weakest (fold pairing)
 * Step 2: Run optimizer to fine-tune balance
 * Step 3: Respect previous teammate avoidance
 */
export function createBalancedDuos(
  players: PlayerWithStatsT[],
  seasonId?: string,
  previousTeammates?: Map<string, Set<string>>,
): TeamStats[] {
  const sorted = [...players].sort((a, b) => ws(b) - ws(a));
  const numTeams = Math.floor(sorted.length / 2);
  const teams: TeamStats[] = [];

  // Fold pairing: 1st with last, 2nd with 2nd-to-last, etc.
  for (let i = 0; i < numTeams; i++) {
    const strong = sorted[i];
    const weak = sorted[sorted.length - 1 - i];
    teams.push(buildTeam([strong, weak], seasonId));
  }

  // Respect previous teammates — swap weak players if needed
  if (previousTeammates) {
    for (let i = 0; i < teams.length; i++) {
      const [p1, p2] = teams[i].players;
      if (!previousTeammates.get(p1.id)?.has(p2.id)) continue;

      // Find best swap partner
      let bestJ = -1;
      let bestDiff = Infinity;
      for (let j = i + 1; j < teams.length; j++) {
        const [q1, q2] = teams[j].players;
        // Try swapping p2 <-> q2
        if (previousTeammates.get(p1.id)?.has(q2.id)) continue;
        if (previousTeammates.get(q1.id)?.has(p2.id)) continue;
        const newDiff = Math.abs((ws(p1) + ws(q2)) - (ws(q1) + ws(p2)));
        if (newDiff < bestDiff) { bestDiff = newDiff; bestJ = j; }
      }
      if (bestJ !== -1) {
        const temp = teams[i].players[1];
        teams[i].players[1] = teams[bestJ].players[1];
        teams[bestJ].players[1] = temp;
        teams[i].weightedScore = teamScore(teams[i].players);
        teams[bestJ].weightedScore = teamScore(teams[bestJ].players);
      }
    }
  }

  // Optimize: swap players between teams to minimize variance
  optimizeTeamBalance(teams, previousTeammates);

  // Recalculate kills/deaths after optimization
  for (const t of teams) {
    t.totalKills = t.players.reduce((s, p) => s + (p.stats.find(st => st.seasonId === seasonId)?.kills ?? 0), 0);
    t.totalDeaths = t.players.reduce((s, p) => s + (p.stats.find(st => st.seasonId === seasonId)?.matches ?? 0), 0);
  }

  return shuffle(teams);
}

// ─── Balanced Trio Creator ──────────────────────────────────
/**
 * Creates balanced trio teams.
 * Step 1: Sort players, split into 3 tiers (strong/medium/weak)
 * Step 2: Pair one from each tier per team
 * Step 3: Run optimizer to fine-tune balance
 */
export function createBalancedTrios(
  players: PlayerWithStatsT[],
  seasonId?: string,
  previousTeammates?: Map<string, Set<string>>,
): TeamStats[] {
  const sorted = [...players].sort((a, b) => ws(b) - ws(a));
  const numTeams = Math.floor(sorted.length / 3);
  if (numTeams === 0) return [];

  // Split into 3 tiers
  const tier1 = sorted.slice(0, numTeams);
  const tier2 = sorted.slice(numTeams, numTeams * 2);
  const tier3 = sorted.slice(numTeams * 2, numTeams * 3);

  // Shuffle tier 2 and 3 for variety
  const shuffled2 = shuffle([...tier2]);
  const shuffled3 = shuffle([...tier3]);

  const teams: TeamStats[] = [];
  const used2 = new Set<number>();
  const used3 = new Set<number>();

  for (let i = 0; i < numTeams; i++) {
    const p1 = tier1[i]; // Strong (keep sorted order)

    // Find best medium + weak combination
    let bestIdx2 = -1;
    let bestIdx3 = -1;
    let bestTeamScore = Infinity;

    // First: find any valid combination
    for (let m = 0; m < numTeams; m++) {
      if (used2.has(m)) continue;
      for (let w = 0; w < numTeams; w++) {
        if (used3.has(w)) continue;
        const ids = [p1.id, shuffled2[m].id, shuffled3[w].id];
        if (hasPreviousTeammate(ids, previousTeammates)) continue;

        // Pick the combination closest to the ideal average team score
        const score = ws(p1) + ws(shuffled2[m]) + ws(shuffled3[w]);
        const idealAvg = sorted.reduce((s, p) => s + ws(p), 0) / numTeams;
        const diff = Math.abs(score - idealAvg);

        if (diff < bestTeamScore) {
          bestTeamScore = diff;
          bestIdx2 = m;
          bestIdx3 = w;
        }
      }
    }

    // Fallback: if no valid combo found, use first available
    if (bestIdx2 === -1 || bestIdx3 === -1) {
      for (let m = 0; m < numTeams; m++) {
        if (used2.has(m)) { continue; }
        if (bestIdx2 === -1) bestIdx2 = m;
      }
      for (let w = 0; w < numTeams; w++) {
        if (used3.has(w)) { continue; }
        if (bestIdx3 === -1) bestIdx3 = w;
      }
    }

    used2.add(bestIdx2);
    used3.add(bestIdx3);

    teams.push(buildTeam([p1, shuffled2[bestIdx2], shuffled3[bestIdx3]], seasonId));
  }

  // Optimize: swap players between teams to minimize variance
  optimizeTeamBalance(teams, previousTeammates);

  // Recalculate kills/deaths after optimization
  for (const t of teams) {
    t.totalKills = t.players.reduce((s, p) => s + (p.stats.find(st => st.seasonId === seasonId)?.kills ?? 0), 0);
    t.totalDeaths = t.players.reduce((s, p) => s + (p.stats.find(st => st.seasonId === seasonId)?.matches ?? 0), 0);
  }

  return shuffle(teams);
}

// ─── Balanced Quad Creator ──────────────────────────────────
/**
 * Creates balanced quad teams.
 * Step 1: Sort players, split into 4 tiers
 * Step 2: Pair one from each tier per team
 * Step 3: Run optimizer to fine-tune balance
 */
export function createBalancedQuads(
  players: PlayerWithStatsT[],
  seasonId?: string,
  previousTeammates?: Map<string, Set<string>>,
): TeamStats[] {
  const sorted = [...players].sort((a, b) => ws(b) - ws(a));
  const numTeams = Math.floor(sorted.length / 4);
  if (numTeams === 0) return [];

  // Split into 4 tiers
  const tier1 = sorted.slice(0, numTeams);
  const tier2 = sorted.slice(numTeams, numTeams * 2);
  const tier3 = sorted.slice(numTeams * 2, numTeams * 3);
  const tier4 = sorted.slice(numTeams * 3, numTeams * 4);

  // Shuffle tiers 2-4 for variety
  const shuffled2 = shuffle([...tier2]);
  const shuffled3 = shuffle([...tier3]);
  const shuffled4 = shuffle([...tier4]);

  const teams: TeamStats[] = [];
  const used2 = new Set<number>();
  const used3 = new Set<number>();
  const used4 = new Set<number>();

  const idealAvg = sorted.reduce((s, p) => s + ws(p), 0) / numTeams;

  for (let i = 0; i < numTeams; i++) {
    const p1 = tier1[i];

    let bestIdx2 = -1, bestIdx3 = -1, bestIdx4 = -1;
    let bestDiff = Infinity;

    // Try to find best combination closest to ideal average
    for (let a = 0; a < numTeams; a++) {
      if (used2.has(a)) continue;
      for (let b = 0; b < numTeams; b++) {
        if (used3.has(b)) continue;
        for (let c = 0; c < numTeams; c++) {
          if (used4.has(c)) continue;
          const ids = [p1.id, shuffled2[a].id, shuffled3[b].id, shuffled4[c].id];
          if (hasPreviousTeammate(ids, previousTeammates)) continue;

          const score = ws(p1) + ws(shuffled2[a]) + ws(shuffled3[b]) + ws(shuffled4[c]);
          const diff = Math.abs(score - idealAvg);

          if (diff < bestDiff) {
            bestDiff = diff;
            bestIdx2 = a; bestIdx3 = b; bestIdx4 = c;
          }
        }
      }
    }

    // Fallback
    if (bestIdx2 === -1) { for (let a = 0; a < numTeams; a++) { if (!used2.has(a)) { bestIdx2 = a; break; } } }
    if (bestIdx3 === -1) { for (let b = 0; b < numTeams; b++) { if (!used3.has(b)) { bestIdx3 = b; break; } } }
    if (bestIdx4 === -1) { for (let c = 0; c < numTeams; c++) { if (!used4.has(c)) { bestIdx4 = c; break; } } }

    used2.add(bestIdx2);
    used3.add(bestIdx3);
    used4.add(bestIdx4);

    teams.push(buildTeam([p1, shuffled2[bestIdx2], shuffled3[bestIdx3], shuffled4[bestIdx4]], seasonId));
  }

  // Optimize: swap players between teams to minimize variance
  optimizeTeamBalance(teams, previousTeammates);

  // Recalculate kills/deaths after optimization
  for (const t of teams) {
    t.totalKills = t.players.reduce((s, p) => s + (p.stats.find(st => st.seasonId === seasonId)?.kills ?? 0), 0);
    t.totalDeaths = t.players.reduce((s, p) => s + (p.stats.find(st => st.seasonId === seasonId)?.matches ?? 0), 0);
  }

  return shuffle(teams);
}

/**
 * Legacy snake draft — kept for reference but no longer used by default.
 */
export function assignPlayersToTeamsBalanced(
  players: PlayerWithStatsT[],
  teamCount: number,
  groupSize: number,
  seasonId?: string,
): TeamStats[] {
  const teams: TeamStats[] = Array.from({ length: teamCount }, () => ({
    players: [],
    totalKills: 0,
    totalDeaths: 0,
    totalWins: 0,
    weightedScore: 0,
  }));

  let direction = 1;
  let teamIdx = 0;

  for (let i = 0; i < teamCount * groupSize; i++) {
    const player = players[i];
    const team = teams[teamIdx];

    team.players.push(player);
    team.totalKills += player.stats.find((p) => p.seasonId === seasonId)?.kills ?? 0;
    team.totalDeaths += player.stats.find((p) => p.seasonId === seasonId)?.matches ?? 0;
    team.totalWins += 0;
    team.weightedScore += ws(player);

    teamIdx += direction;
    if (teamIdx >= teamCount) {
      teamIdx = teamCount - 1;
      direction = -1;
    } else if (teamIdx < 0) {
      teamIdx = 0;
      direction = 1;
    }
  }

  return teams;
}

/**
 * Logs balance stats for debugging.
 */
export function analyzeTeamBalance(teams: TeamStats[]): void {
  if (teams.length === 0) return;
  const scores = teams.map(t => t.weightedScore);
  const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
  const stdDev = Math.sqrt(scores.reduce((s, v) => s + (v - avg) ** 2, 0) / scores.length);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  console.log(
    `[TeamBalance] ${teams.length} teams | scores: ${scores.map(s => s.toFixed(1)).join(", ")} | avg=${avg.toFixed(1)} range=${(max - min).toFixed(1)} stddev=${stdDev.toFixed(1)}`
  );
}
