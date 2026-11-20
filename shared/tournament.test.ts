import { describe, expect, it } from "vitest";
import {
  computeStandings,
  createTournamentState,
  generateKnockoutFixtures,
  generateRoundRobinFixtures,
  recordMatchScore,
  selectQualifiers,
  type Team,
} from "./tournament";

const teams = (count: number): Team[] =>
  Array.from({ length: count }, (_, index) => ({ id: `team-${index + 1}`, name: `Team ${index + 1}` }));

const playedPairs = (teamList: Team[], fixtures: ReturnType<typeof generateRoundRobinFixtures>) => {
  const pairs = fixtures
    .filter((fixture) => fixture.homeTeamId && fixture.awayTeamId)
    .map((fixture) => [fixture.homeTeamId!, fixture.awayTeamId!].sort().join("|"));
  const expected = new Set<string>();
  for (let left = 0; left < teamList.length; left += 1) {
    for (let right = left + 1; right < teamList.length; right += 1) {
      expected.add([teamList[left].id, teamList[right].id].sort().join("|"));
    }
  }
  expect(pairs).toHaveLength(expected.size);
  expect(new Set(pairs)).toEqual(expected);
};

describe("round-robin fixtures", () => {
  it("schedules each pair exactly once for an even field", () => {
    const field = teams(6);
    const fixtures = generateRoundRobinFixtures(field);
    expect(fixtures).toHaveLength(15);
    expect(fixtures.every((fixture) => fixture.status !== "bye")).toBe(true);
    playedPairs(field, fixtures);
  });

  it("schedules each pair once and one explicit bye per round for an odd field", () => {
    const field = teams(5);
    const fixtures = generateRoundRobinFixtures(field);
    expect(fixtures.filter((fixture) => fixture.status === "bye")).toHaveLength(5);
    expect(new Set(fixtures.map((fixture) => fixture.round))).toHaveProperty("size", 5);
    playedPairs(field, fixtures);
  });
});

describe("tournament setup and standings", () => {
  it("balances the user-selected number of groups without inferring a format", () => {
    const state = createTournamentState(teams(10), { type: "groups", groupCount: 3, qualifiersPerGroup: 2 });
    expect(state.format).toEqual({ type: "groups", groupCount: 3, qualifiersPerGroup: 2 });
    expect(state.groups.map((group) => group.teamIds.length)).toEqual([4, 3, 3]);
    expect(state.groups.map((group) => group.teamIds).flat()).toHaveLength(10);

    const direct = createTournamentState(teams(10), { type: "direct-knockout" });
    expect(direct.format.type).toBe("direct-knockout");
    expect(direct.groups).toHaveLength(0);
  });

  it("computes W/D/L, goals, goal difference, points, and selected qualifiers", () => {
    const field = teams(4);
    let state = createTournamentState(field, {
      type: "league",
      progression: { type: "top-2-final" },
    });
    const results: Record<string, [number, number]> = {
      "team-1|team-2": [2, 0],
      "team-1|team-3": [1, 1],
      "team-1|team-4": [0, 1],
      "team-2|team-3": [1, 0],
      "team-2|team-4": [2, 2],
      "team-3|team-4": [0, 3],
    };
    const played = state.fixtures.filter((fixture) => fixture.stage === "league");
    for (const fixture of played) {
      const pair = [fixture.homeTeamId!, fixture.awayTeamId!].sort().join("|");
      const [lowerIdScore, higherIdScore] = results[pair];
      const scores = fixture.homeTeamId === pair.split("|")[0]
        ? [lowerIdScore, higherIdScore]
        : [higherIdScore, lowerIdScore];
      state = recordMatchScore(state, fixture.id, scores[0], scores[1]);
    }

    const standings = computeStandings(state.teams, state.fixtures, { stage: "league" });
    expect(standings.map(({ teamId }) => teamId)).toEqual(["team-4", "team-1", "team-2", "team-3"]);
    expect(standings[0]).toMatchObject({ played: 3, wins: 2, draws: 1, losses: 0, goalsFor: 6, goalsAgainst: 2, goalDifference: 4, points: 7 });
    expect(standings[1]).toMatchObject({ played: 3, wins: 1, draws: 1, losses: 1, goalsFor: 3, goalsAgainst: 2, goalDifference: 1, points: 4 });
    expect(selectQualifiers(state).map((team) => team.id)).toEqual(["team-4", "team-1"]);
  });
});

describe("knockout fixtures and scores", () => {
  it("gives a five-team initial bracket three advancing byes", () => {
    const fixtures = generateKnockoutFixtures(teams(5));
    expect(fixtures).toHaveLength(4);
    expect(fixtures.filter((fixture) => fixture.status === "bye")).toHaveLength(3);
    expect(fixtures.filter((fixture) => fixture.byeTeamId).map((fixture) => fixture.byeTeamId)).toEqual([
      "team-1", "team-2", "team-3",
    ]);
    expect(fixtures.filter((fixture) => fixture.status === "scheduled")).toHaveLength(1);
  });

  it("only resolves a regulation draw when unequal penalty scores are supplied", () => {
    const state = createTournamentState(teams(2), { type: "direct-knockout" });
    const fixtureId = state.fixtures[0].id;
    const unresolved = recordMatchScore(state, fixtureId, 1, 1);
    expect(unresolved.fixtures[0].winnerTeamId).toBeUndefined();
    const resolved = recordMatchScore(unresolved, fixtureId, 1, 1, { home: 4, away: 3 });
    expect(resolved.fixtures[0]).toMatchObject({ winnerTeamId: "team-1", homePenaltyScore: 4, awayPenaltyScore: 3 });
    expect(state.fixtures[0].homeScore).toBeNull();
  });
});

describe("head-to-head tie-break", () => {
  it("uses the direct result when points, goal difference, and goals scored are tied", () => {
    const field = teams(4);
    let state = createTournamentState(field, { type: "league", progression: { type: "none" } });
    const results: Record<string, [number, number]> = {
      "team-1|team-2": [1, 0],
      "team-1|team-3": [0, 1],
      "team-1|team-4": [1, 0],
      "team-2|team-3": [1, 0],
      "team-2|team-4": [1, 0],
      "team-3|team-4": [0, 0],
    };
    for (const fixture of state.fixtures) {
      const pair = [fixture.homeTeamId!, fixture.awayTeamId!].sort().join("|");
      const [left, right] = results[pair];
      const [homeScore, awayScore] = fixture.homeTeamId === pair.split("|")[0] ? [left, right] : [right, left];
      state = recordMatchScore(state, fixture.id, homeScore, awayScore);
    }
    const standings = computeStandings(state.teams, state.fixtures, { stage: "league" });
    expect(standings.slice(0, 2).map((row) => row.teamId)).toEqual(["team-1", "team-2"]);
    expect(standings[0]).toMatchObject({ points: 6, goalDifference: 1, goalsFor: 2 });
    expect(standings[1]).toMatchObject({ points: 6, goalDifference: 1, goalsFor: 2 });
  });
});
