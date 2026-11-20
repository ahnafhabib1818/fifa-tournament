import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, TournamentRow, tournaments, users } from "../drizzle/schema";
import type { TournamentState } from "../shared/tournament";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

/** Lazily create the database client so local tooling can run without a DB. */
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function listTournaments(): Promise<TournamentRow[]> {
  const db = await getDb();
  if (!db) throw new Error("Tournament archive database is not available.");
  return db.select().from(tournaments).orderBy(desc(tournaments.updatedAt));
}

export async function getTournamentById(id: string): Promise<TournamentRow | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Tournament archive database is not available.");
  const rows = await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  return rows[0];
}

export async function insertTournament(input: {
  id: string;
  name: string;
  format: string;
  state: TournamentState;
  status: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Tournament archive database is not available.");
  await db.insert(tournaments).values(input);
}

export class TournamentVersionConflictError extends Error {
  constructor() {
    super("Tournament changed since it was opened.");
    this.name = "TournamentVersionConflictError";
  }
}

export async function saveTournamentState(input: {
  id: string;
  name: string;
  format: string;
  state: TournamentState;
  status: string;
  version: number;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Tournament archive database is not available.");
  const result = await db.update(tournaments).set({
    name: input.name,
    format: input.format,
    state: input.state,
    status: input.status,
    version: input.version + 1,
  }).where(and(eq(tournaments.id, input.id), eq(tournaments.version, input.version)));
  if (result[0].affectedRows === 0) throw new TournamentVersionConflictError();
}
