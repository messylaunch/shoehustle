import "server-only";

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@prisma/client";
import { prisma } from "./db";
import { DEFAULT_CHANNELS } from "./constants";

const scryptAsync = promisify(scrypt);

const SESSION_COOKIE = "sh_session";
const SESSION_DAYS = 30;
const KEY_LENGTH = 64;

// ---------------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------------

/** Stored as `scrypt$<salt hex>$<hash hex>` so the format can change later. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const derived = (await scryptAsync(password, salt, expected.length)) as Buffer;

  // Lengths must match before timingSafeEqual, which throws otherwise.
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/** Minimum bar for a password. Returns a reason, or null when it's fine. */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return "Password needs to be at least 8 characters.";
  if (password.length > 200) return "That password is too long.";
  return null;
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({ data: { token, userId, expiresAt } });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }
  jar.delete(SESSION_COOKIE);
}

/** The signed-in user, or null. Expired sessions are cleaned up on read. */
export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (!session.user.active) return null;

  return session.user;
}

/** For pages that need a signed-in seller. Redirects instead of throwing. */
export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/app");
  return user;
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

/** False on a brand new install, which sends you to /setup instead of /login. */
export async function hasAnyUser(): Promise<boolean> {
  return (await prisma.user.count()) > 0;
}

export interface NewUserInput {
  email: string;
  password: string;
  name: string;
  role?: string;
  handle?: string | null;
}

/**
 * Creates a seller with the default selling channels already filled in, so
 * the calculator produces a real number on their first visit.
 */
export async function createUser(input: NewUserInput): Promise<User> {
  const passwordHash = await hashPassword(input.password);
  return prisma.user.create({
    data: {
      email: input.email.trim().toLowerCase(),
      name: input.name.trim(),
      passwordHash,
      role: input.role ?? "SELLER",
      handle: input.handle?.trim() || null,
      channels: { create: DEFAULT_CHANNELS },
    },
  });
}

/** Returns the user on success, or null — never says which half was wrong. */
export async function authenticate(
  email: string,
  password: string,
): Promise<User | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (!user || !user.active) {
    // Hash anyway so a missing account doesn't answer faster than a wrong
    // password and leak which emails exist.
    await hashPassword(password);
    return null;
  }
  const ok = await verifyPassword(password, user.passwordHash);
  return ok ? user : null;
}
