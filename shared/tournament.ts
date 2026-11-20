export interface Team {
  id: string;
  name: string;
}

export type LeagueProgression =
  | { type: "none" }
  | { type: "top-2-final" }
  | { type: "top-4-semifinal" }
  | { type: "custom"; qualifierCount: number };

/** Explicit user selection; this is never inferred from the team count. */
export type TournamentFormat =
  | { type: "league"; progression: LeagueProgression }
  | { type: "groups"; groupCount: number; qualifiersPerGroup: number }
  | { type: "direct-knockout" };

export interface TournamentGroup {
  id: string;
  name: string;
  teamIds: string[];
}

export type FixtureStage = "league" | "group" | "knockout";
export type FixtureStatus = "scheduled" | "completed" | "bye";

export interface Fixture {
  id: string;
  stage: FixtureStage;
  round: number;
  groupId?: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homePenaltyScore?: number;
  awayPenaltyScore?: number;
  /** Set for a bye; the advancing team is recorded as the fixture winner. */
  byeTeamId?: string;
  winnerTeamId?: string;
  status: FixtureStatus;
}

export interface TournamentState {
  id: string;
  name: string;
  format: TournamentFormat;
  teams: Team[];
  groups: TournamentGroup[];
  fixtures: Fixture[];
}

export interface Standing {
  teamId: string;
  teamName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface PenaltyScore {
  home: number;
  away: number;
}

const assertTeams = (teams: Team[]): void => {
  if (!teams.length) throw new Error("A tournament needs at least one team.");
  const ids = new Set<string>();
  for (const team of teams) {
    if (!team.id || !team.name) throw new Error("Each team needs a non-empty ID and name.");
    if (ids.has(team.id)) throw new Error(`Duplicate team ID: ${team.id}`);
    ids.add(team.id);
  }
};

const assertPositiveInteger = (value: number, label: string): void => {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }
};

const emptyFixture = (
  id: string,
  stage: FixtureStage,
  round: number,
  homeTeamId: string | null,
  awayTeamId: string | null,
  groupId?: string
): Fixture => ({
  id,
  stage,
  round,
  ...(groupId ? { groupId } : {}),
  homeTeamId,
  awayTeamId,
  homeScore: null,
  awayScore: null,
  status: "scheduled",
});

/**
 * Generates a single round-robin schedule using the circle method. Odd-sized
 * fields receive one explicit bye fixture per round; no team plays itself.
 */
export function generateRoundRobinFixtures(
  teams: Team[],
  stage: "league" | "group" = "league",
  groupId?: string
): Fixture[] {
  assertTeams(teams);
  const entries: Array<Team | null> = [...teams];
  if (entries.length % 2 !== 0) entries.push(null);
  const slotCount = entries.length;
  let rotation = [...entries];
  const fixtures: Fixture[] = [];
  const groupKey = groupId ?? "all";
  const rounds = Math.max(1, slotCount - 1);

  for (let roundIndex = 0; roundIndex < rounds; roundIndex += 1) {
    let matchIndex = 0;
    for (let pairIndex = 0; pairIndex < slotCount / 2; pairIndex += 1) {
      let first = rotation[pairIndex];
      let second = rotation[slotCount - 1 - pairIndex];
      if (!first || !second) {
        const byeTeam = first ?? second;
        if (byeTeam) {
          const fixture = emptyFixture(
            `${stage}-${groupKey}-r${roundIndex + 1}-bye-${byeTeam.id}`,
            stage,
            roundIndex + 1,
            null,
            null,
            groupId
          );
          fixture.byeTeamId = byeTeam.id;
          fixture.winnerTeamId = byeTeam.id;
          fixture.status = "bye";
          fixtures.push(fixture);
        }
        continue;
      }
      if ((roundIndex + pairIndex) % 2 === 1) [first, second] = [second, first];
      fixtures.push(
        emptyFixture(
          `${stage}-${groupKey}-r${roundIndex + 1}-m${matchIndex + 1}`,
          stage,
          roundIndex + 1,
          first.id,
          second.id,
          groupId
        )
      );
      matchIndex += 1;
    }
    // Keep the first slot fixed and rotate the remaining slots by one.
    rotation = [rotation[0], rotation[slotCount - 1], ...rotation.slice(1, slotCount - 1)];
  }
  return fixtures;
}

const groupLabel = (index: number): string => {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
};

/** Creates a fully initialized state while preserving the explicitly selected format. */
export function createTournamentState(
  teams: Team[],
  format: TournamentFormat,
  options: { id?: string; name?: string } = {}
): TournamentState {
  assertTeams(teams);
  const selectedFormat: TournamentFormat = structuredClone(format);
  const copiedTeams = teams.map((team) => ({ ...team }));
  let groups: TournamentGroup[] = [];
  let fixtures: Fixture[] = [];

  if (selectedFormat.type === "league") {
    const progression = selectedFormat.progression;
    if (progression.type === "custom") {
      assertPositiveInteger(progression.qualifierCount, "Qualifier count");
      if (progression.qualifierCount > teams.length) {
        throw new Error("Qualifier count cannot exceed the number of teams.");
      }
    }
    if (progression.type === "top-2-final" && teams.length < 2) {
      throw new Error("A top-2 final requires at least two teams.");
    }
    if (progression.type === "top-4-semifinal" && teams.length < 4) {
      throw new Error("A top-4 semifinal requires at least four teams.");
    }
    fixtures = generateRoundRobinFixtures(copiedTeams, "league");
  } else if (selectedFormat.type === "groups") {
    assertPositiveInteger(selectedFormat.groupCount, "Group count");
    assertPositiveInteger(selectedFormat.qualifiersPerGroup, "Qualifiers per group");
    if (selectedFormat.groupCount > teams.length) {
      throw new Error("Group count cannot exceed the number of teams.");
    }
    if (selectedFormat.groupCount > Math.floor(teams.length / 2)) {
      throw new Error("Each group must contain at least two teams.");
    }
    if (selectedFormat.qualifiersPerGroup > Math.floor(teams.length / selectedFormat.groupCount)) {
      throw new Error("Each group must contain enough teams for the selected qualifiers.");
    }
    const groupTeams: Team[][] = Array.from({ length: selectedFormat.groupCount }, () => []);
    // Deal teams in order across groups. Group sizes differ by at most one.
    copiedTeams.forEach((team, index) => groupTeams[index % selectedFormat.groupCount].push(team));
    groups = groupTeams.map((members, index) => ({
      id: `group-${groupLabel(index)}`,
      name: `Group ${groupLabel(index)}`,
      teamIds: members.map((team) => team.id),
    }));
    fixtures = groupTeams.flatMap((members, index) =>
      generateRoundRobinFixtures(members, "group", groups[index].id)
    );
  } else {
    fixtures = generateKnockoutFixtures(copiedTeams);
  }

  return {
    id: options.id ?? "tournament-1",
    name: options.name ?? "Tournament",
    format: selectedFormat,
    teams: copiedTeams,
    groups,
    fixtures,
  };
}

/**
 * Computes standings for the supplied league/group teams. Ties resolve by
 * points, goal difference, goals scored, then original team order and ID.
 */
export function computeStandings(
  teams: Team[],
  fixtures: Fixture[],
  options: { stage?: "league" | "group"; groupId?: string } = {}
): Standing[] {
  const originalOrder = new Map(teams.map((team, index) => [team.id, index]));
  const rows = new Map<string, Standing>(
    teams.map((team) => [
      team.id,
      {
        teamId: team.id,
        teamName: team.name,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
      },
    ])
  );

  for (const fixture of fixtures) {
    if (options.stage && fixture.stage !== options.stage) continue;
    if (options.groupId && fixture.groupId !== options.groupId) continue;
    if (
      fixture.status !== "completed" ||
      fixture.homeTeamId === null ||
      fixture.awayTeamId === null ||
      fixture.homeScore === null ||
      fixture.awayScore === null
    ) continue;
    const home = rows.get(fixture.homeTeamId);
    const away = rows.get(fixture.awayTeamId);
    if (!home || !away) continue;
    home.played += 1;
    away.played += 1;
    home.goalsFor += fixture.homeScore;
    home.goalsAgainst += fixture.awayScore;
    away.goalsFor += fixture.awayScore;
    away.goalsAgainst += fixture.homeScore;
    if (fixture.homeScore > fixture.awayScore) {
      home.wins += 1;
      away.losses += 1;
      home.points += 3;
    } else if (fixture.homeScore < fixture.awayScore) {
      away.wins += 1;
      home.losses += 1;
      away.points += 3;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  const standings = [...rows.values()];
  standings.forEach((row) => { row.goalDifference = row.goalsFor - row.goalsAgainst; });
  const primaryCompare = (a: Standing, b: Standing) =>
    b.points - a.points ||
    b.goalDifference - a.goalDifference ||
    b.goalsFor - a.goalsFor;
  const finalFallback = (a: Standing, b: Standing) =>
    (originalOrder.get(a.teamId) ?? Number.MAX_SAFE_INTEGER) -
      (originalOrder.get(b.teamId) ?? Number.MAX_SAFE_INTEGER) ||
    a.teamId.localeCompare(b.teamId);
  standings.sort((a, b) => primaryCompare(a, b) || finalFallback(a, b));

  // Apply head-to-head points, goal difference, then goals only inside groups
  // still tied on the table's main criteria.
  for (let start = 0; start < standings.length;) {
    let end = start + 1;
    while (end < standings.length && primaryCompare(standings[start], standings[end]) === 0) end += 1;
    const tied = standings.slice(start, end);
    if (tied.length > 1) {
      const tiedIds = new Set(tied.map((row) => row.teamId));
      const headToHead = new Map(tied.map((row) => [row.teamId, { points: 0, gd: 0, gf: 0 }]));
      for (const fixture of fixtures) {
        if (
          (options.stage && fixture.stage !== options.stage) ||
          (options.groupId && fixture.groupId !== options.groupId) ||
          fixture.status !== "completed" ||
          fixture.homeTeamId === null || fixture.awayTeamId === null ||
          fixture.homeScore === null || fixture.awayScore === null ||
          !tiedIds.has(fixture.homeTeamId) || !tiedIds.has(fixture.awayTeamId)
        ) continue;
        const home = headToHead.get(fixture.homeTeamId)!;
        const away = headToHead.get(fixture.awayTeamId)!;
        home.gf += fixture.homeScore;
        home.gd += fixture.homeScore - fixture.awayScore;
        away.gf += fixture.awayScore;
        away.gd += fixture.awayScore - fixture.homeScore;
        if (fixture.homeScore > fixture.awayScore) home.points += 3;
        else if (fixture.homeScore < fixture.awayScore) away.points += 3;
        else { home.points += 1; away.points += 1; }
      }
      tied.sort((a, b) => {
        const aH2h = headToHead.get(a.teamId)!;
        const bH2h = headToHead.get(b.teamId)!;
        return bH2h.points - aH2h.points || bH2h.gd - aH2h.gd ||
          bH2h.gf - aH2h.gf || finalFallback(a, b);
      });
      standings.splice(start, tied.length, ...tied);
    }
    start = end;
  }
  return standings;
}

/** Returns qualifiers according to the progression explicitly stored in state. */
export function selectQualifiers(state: TournamentState): Team[] {
  const teamsById = new Map(state.teams.map((team) => [team.id, team]));
  if (state.format.type === "direct-knockout") return [...state.teams];

  if (state.format.type === "league") {
    const progression = state.format.progression;
    const count = progression.type === "none"
      ? 0
      : progression.type === "top-2-final"
        ? 2
        : progression.type === "top-4-semifinal"
          ? 4
          : progression.qualifierCount;
    return computeStandings(state.teams, state.fixtures, { stage: "league" })
      .slice(0, count)
      .map((standing) => teamsById.get(standing.teamId)!)
      .filter(Boolean);
  }

  const qualifiers: Team[] = [];
  for (const group of state.groups) {
    const groupTeams = group.teamIds.map((id) => teamsById.get(id)!).filter(Boolean);
    const standings = computeStandings(groupTeams, state.fixtures, {
      stage: "group",
      groupId: group.id,
    });
    qualifiers.push(
      ...standings
        .slice(0, state.format.qualifiersPerGroup)
        .map((standing) => teamsById.get(standing.teamId)!)
        .filter(Boolean)
    );
  }
  return qualifiers;
}

const seededSlotOrder = (size: number): number[] => {
  let order = [1, 2];
  while (order.length < size) {
    const nextSize = order.length * 2;
    order = order.flatMap((seed) => [seed, nextSize + 1 - seed]);
  }
  return order;
};

/** Makes the first knockout round only, assigning non-power-of-two byes to top seeds. */
export function generateKnockoutFixtures(teams: Team[]): Fixture[] {
  assertTeams(teams);
  let bracketSize = 1;
  while (bracketSize < teams.length) bracketSize *= 2;
  if (bracketSize === 1) bracketSize = 2;
  const slots = Array<Team | null>(bracketSize).fill(null);
  const order = seededSlotOrder(bracketSize);
  teams.forEach((team, index) => {
    const slotIndex = order.indexOf(index + 1);
    slots[slotIndex] = team;
  });

  const fixtures: Fixture[] = [];
  for (let index = 0; index < bracketSize; index += 2) {
    const home = slots[index];
    const away = slots[index + 1];
    if (!home && !away) continue;
    const fixture = emptyFixture(
      `knockout-r1-m${index / 2 + 1}`,
      "knockout",
      1,
      home?.id ?? null,
      away?.id ?? null
    );
    if (!home || !away) {
      const byeTeam = home ?? away;
      if (byeTeam) {
        fixture.byeTeamId = byeTeam.id;
        fixture.winnerTeamId = byeTeam.id;
        fixture.status = "bye";
      }
    }
    fixtures.push(fixture);
  }
  return fixtures;
}

/** Records or replaces a score; a tied knockout match needs unequal penalties to have a winner. */
export function recordMatchScore(
  state: TournamentState,
  fixtureId: string,
  homeScore: number,
  awayScore: number,
  penalties?: PenaltyScore
): TournamentState {
  for (const [score, label] of [[homeScore, "Home score"], [awayScore, "Away score"]] as const) {
    if (!Number.isInteger(score) || score < 0) throw new Error(`${label} must be a non-negative integer.`);
  }
  if (penalties) {
    for (const [score, label] of [[penalties.home, "Home penalty score"], [penalties.away, "Away penalty score"]] as const) {
      if (!Number.isInteger(score) || score < 0) throw new Error(`${label} must be a non-negative integer.`);
    }
  }
  const index = state.fixtures.findIndex((fixture) => fixture.id === fixtureId);
  if (index < 0) throw new Error(`Fixture not found: ${fixtureId}`);
  const current = state.fixtures[index];
  if (current.stage === "knockout" && (current.status === "bye" || current.byeTeamId)) {
    throw new Error("A bye fixture cannot be scored.");
  }

  let winnerTeamId: string | undefined;
  if (homeScore > awayScore) winnerTeamId = current.homeTeamId ?? undefined;
  else if (awayScore > homeScore) winnerTeamId = current.awayTeamId ?? undefined;
  else if (current.stage === "knockout" && penalties && penalties.home !== penalties.away) {
    winnerTeamId = penalties.home > penalties.away
      ? current.homeTeamId ?? undefined
      : current.awayTeamId ?? undefined;
  }

  const updated: Fixture = {
    ...current,
    homeScore,
    awayScore,
    status: "completed",
    ...(winnerTeamId ? { winnerTeamId } : {}),
  };
  delete updated.homePenaltyScore;
  delete updated.awayPenaltyScore;
  if (current.stage === "knockout" && homeScore === awayScore && penalties) {
    updated.homePenaltyScore = penalties.home;
    updated.awayPenaltyScore = penalties.away;
  }
  if (!winnerTeamId) delete updated.winnerTeamId;

  const fixtures = [...state.fixtures];
  fixtures[index] = updated;
  return { ...state, fixtures };
}
