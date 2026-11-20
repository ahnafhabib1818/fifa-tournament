import { nanoid } from "nanoid";
import { z } from "zod";
import { createTournamentState, type TournamentFormat, type TournamentState } from "../shared/tournament";
import { getTournamentById, insertTournament, listTournaments, saveTournamentState, TournamentVersionConflictError } from "./db";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";

const progressionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({ type: z.literal("top-2-final") }),
  z.object({ type: z.literal("top-4-semifinal") }),
  z.object({ type: z.literal("custom"), qualifierCount: z.number().int().min(2).max(64) }),
]);

const formatSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("league"), progression: progressionSchema }),
  z.object({
    type: z.literal("groups"),
    groupCount: z.number().int().min(2).max(32),
    qualifiersPerGroup: z.number().int().min(1).max(32),
  }),
  z.object({ type: z.literal("direct-knockout") }),
]);

const teamSchema = z.object({ id: z.string().min(1).max(80), name: z.string().trim().min(1).max(80) }).strict();
const fixtureSchema = z.object({
  id: z.string().min(1).max(120),
  stage: z.enum(["league", "group", "knockout"]),
  round: z.number().int().min(1).max(64),
  groupId: z.string().max(80).optional(),
  homeTeamId: z.string().max(80).nullable(),
  awayTeamId: z.string().max(80).nullable(),
  homeScore: z.number().int().min(0).max(99).nullable(),
  awayScore: z.number().int().min(0).max(99).nullable(),
  homePenaltyScore: z.number().int().min(0).max(99).optional(),
  awayPenaltyScore: z.number().int().min(0).max(99).optional(),
  byeTeamId: z.string().max(80).optional(),
  winnerTeamId: z.string().max(80).optional(),
  status: z.enum(["scheduled", "completed", "bye"]),
}).strict();

const stateSchema = z.object({
  id: z.string().min(1).max(36),
  name: z.string().trim().min(1).max(120),
  format: formatSchema,
  teams: z.array(teamSchema).min(2).max(64),
  groups: z.array(z.object({
    id: z.string().min(1).max(80),
    name: z.string().min(1).max(80),
    teamIds: z.array(z.string().max(80)).max(64),
  }).strict()).max(32),
  fixtures: z.array(fixtureSchema).max(2048),
}).strict().superRefine((state, ctx) => {
  const teamIds = new Set(state.teams.map((team) => team.id));
  if (teamIds.size !== state.teams.length) {
    ctx.addIssue({ code: "custom", message: "Team IDs must be unique.", path: ["teams"] });
  }
  const groupIds = new Set(state.groups.map((group) => group.id));
  if (groupIds.size !== state.groups.length) {
    ctx.addIssue({ code: "custom", message: "Group IDs must be unique.", path: ["groups"] });
  }
  for (const [index, fixture] of state.fixtures.entries()) {
    for (const teamId of [fixture.homeTeamId, fixture.awayTeamId, fixture.byeTeamId, fixture.winnerTeamId]) {
      if (teamId && !teamIds.has(teamId)) {
        ctx.addIssue({ code: "custom", message: "Fixture references an unknown team.", path: ["fixtures", index] });
      }
    }
    if (fixture.groupId && !groupIds.has(fixture.groupId)) {
      ctx.addIssue({ code: "custom", message: "Fixture references an unknown group.", path: ["fixtures", index, "groupId"] });
    }
  }
});

function getStatus(state: TournamentState): "active" | "completed" {
  const knockoutRounds = state.fixtures.filter((fixture) => fixture.stage === "knockout").map((fixture) => fixture.round);
  if (knockoutRounds.length) {
    const finalRound = Math.max(...knockoutRounds);
    const finalFixtures = state.fixtures.filter((fixture) => fixture.stage === "knockout" && fixture.round === finalRound);
    return finalFixtures.length === 1 && Boolean(finalFixtures[0].winnerTeamId) ? "completed" : "active";
  }
  if (state.format.type === "league" && state.format.progression.type === "none") {
    const fixtures = state.fixtures.filter((fixture) => fixture.stage === "league");
    return fixtures.length > 0 && fixtures.every((fixture) => fixture.status === "completed" || fixture.status === "bye")
      ? "completed"
      : "active";
  }
  return "active";
}

function normalizeState(state: TournamentState, id: string): TournamentState {
  return { ...state, id, name: state.name.trim() };
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  tournament: router({
    list: publicProcedure.query(async () => listTournaments()),
    get: publicProcedure.input(z.object({ id: z.string().min(1).max(36) })).query(async ({ input }) => {
      const record = await getTournamentById(input.id);
      return record ?? null;
    }),
    create: publicProcedure.input(z.object({
      name: z.string().trim().min(1).max(120),
      teams: z.array(teamSchema).min(2).max(64),
      format: formatSchema,
    })).mutation(async ({ input }) => {
      const id = nanoid(12);
      let state: TournamentState;
      try {
        state = createTournamentState(input.teams, input.format as TournamentFormat, { id, name: input.name.trim() });
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Invalid tournament setup." });
      }
      try {
        await insertTournament({ id, name: state.name, format: state.format.type, state, status: getStatus(state) });
        return await getTournamentById(id);
      } catch (error) {
        console.error("[Tournament] Create failed:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "টুর্নামেন্ট সংরক্ষণ করা যায়নি। আবার চেষ্টা করো।" });
      }
    }),
    update: publicProcedure.input(z.object({
      id: z.string().min(1).max(36),
      version: z.number().int().min(0).max(2147483646),
      state: stateSchema,
    })).mutation(async ({ input }) => {
      const existing = await getTournamentById(input.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "টুর্নামেন্টটি পাওয়া যায়নি।" });
      if (existing.version !== input.version) throw new TRPCError({ code: "CONFLICT", message: "অন্য কেউ নতুন ফল সেভ করেছে—সর্বশেষ তথ্য আনা হচ্ছে, আবার চেষ্টা করো।" });
      if (input.state.id !== input.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Tournament ID mismatch." });
      const state = normalizeState(input.state as TournamentState, input.id);
      try {
        await saveTournamentState({
          id: input.id,
          name: state.name,
          format: state.format.type,
          state,
          status: getStatus(state),
          version: input.version,
        });
        return await getTournamentById(input.id);
      } catch (error) {
        if (error instanceof TournamentVersionConflictError) throw new TRPCError({ code: "CONFLICT", message: "অন্য কেউ নতুন ফল সেভ করেছে—সর্বশেষ তথ্য আনা হচ্ছে, আবার চেষ্টা করো।" });
        console.error("[Tournament] Save failed:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "পরিবর্তন সংরক্ষণ করা যায়নি। আবার চেষ্টা করো।" });
      }
    }),
  }),
});

export type AppRouter = typeof appRouter;
