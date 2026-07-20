import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { NextFunction, Request, Response } from "express";
import { pool } from "@workspace/db";

const scrypt = promisify(scryptCallback);
const DEFAULT_SESSION_DAYS = 7;
const DEFAULT_INVITE_HOURS = 72;
const COOKIE_NAME = process.env["AUTH_COOKIE_NAME"] || "insight_hub_session";

export type AuthRole = "admin" | "user";

export type AuthUser = {
  id: number;
  email: string;
  displayName: string;
  role: AuthRole;
  enabled: boolean;
};

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

type SharedWriteRule = {
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  path: RegExp;
  action: string;
};

const SHARED_WRITE_RULES: SharedWriteRule[] = [
  { method: "PUT", path: /^\/portal-links\/?$/, action: "portal-links.update" },
  { method: "POST", path: /^\/entity-discovery\/locations\/?$/, action: "entity-discovery.collect" },
  { method: "POST", path: /^\/entities\/manual-location\/?$/, action: "locations.create-manual" },
  { method: "PATCH", path: /^\/locations\/\d+\/details\/?$/, action: "locations.update" },
  { method: "POST", path: /^\/entities\/\d+\/verify-selected\/?$/, action: "locations.verify" },
  { method: "POST", path: /^\/entities\/import-company-location-text\/?$/, action: "locations.import-text" },
  { method: "POST", path: /^\/entities\/manual-locations\/?$/, action: "locations.import-manual" },
  { method: "POST", path: /^\/intelligence\/ingest\/company\/?$/, action: "intelligence.ingest" },
];

let schemaPromise: Promise<void> | null = null;
let bootstrapPromise: Promise<void> | null = null;

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeEmail(value: unknown): string {
  return String(value || "").trim().toLowerCase().slice(0, 320);
}

function cleanDisplayName(value: unknown, email: string): string {
  const cleaned = String(value || "").trim().replace(/\s+/g, " ").slice(0, 120);
  return cleaned || email.split("@")[0] || "Insight Hub User";
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function requestIpHash(req: Request): string | null {
  const raw = req.ip || req.socket.remoteAddress || "";
  return raw ? createHash("sha256").update(raw).digest("hex") : null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, expectedHex] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !expectedHex) return false;

  try {
    const expected = Buffer.from(expectedHex, "hex");
    const actual = (await scrypt(password, salt, expected.length)) as Buffer;
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function validatePassword(password: unknown): string | null {
  if (typeof password !== "string" || password.length < 12) {
    return "Password must contain at least 12 characters.";
  }
  if (password.length > 256) return "Password is too long.";
  return null;
}

export async function ensureAuthSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS app_users (
        id serial PRIMARY KEY,
        email text NOT NULL UNIQUE,
        display_name text NOT NULL,
        role text NOT NULL CHECK (role IN ('admin', 'user')),
        password_hash text NOT NULL,
        enabled boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS app_sessions (
        id bigserial PRIMARY KEY,
        token_hash text NOT NULL UNIQUE,
        user_id integer NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        last_seen_at timestamptz NOT NULL DEFAULT now(),
        user_agent text,
        ip_hash text
      );

      CREATE INDEX IF NOT EXISTS app_sessions_user_id_idx ON app_sessions(user_id);
      CREATE INDEX IF NOT EXISTS app_sessions_expires_at_idx ON app_sessions(expires_at);

      CREATE TABLE IF NOT EXISTS app_invitations (
        id bigserial PRIMARY KEY,
        email text NOT NULL,
        role text NOT NULL CHECK (role IN ('admin', 'user')),
        token_hash text NOT NULL UNIQUE,
        expires_at timestamptz NOT NULL,
        accepted_at timestamptz,
        created_by integer REFERENCES app_users(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS app_invitations_email_idx ON app_invitations(email);
      CREATE INDEX IF NOT EXISTS app_invitations_expires_at_idx ON app_invitations(expires_at);

      CREATE TABLE IF NOT EXISTS security_audit_log (
        id bigserial PRIMARY KEY,
        actor_user_id integer REFERENCES app_users(id) ON DELETE SET NULL,
        action text NOT NULL,
        target_type text,
        target_id text,
        details jsonb NOT NULL DEFAULT '{}'::jsonb,
        ip_hash text,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS security_audit_log_created_at_idx ON security_audit_log(created_at DESC);
    `).then(() => undefined).catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  await schemaPromise;
}

export async function ensureBootstrapAdmin(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      await ensureAuthSchema();
      const countResult = await pool.query<{ count: string }>("SELECT count(*)::text AS count FROM app_users");
      if (Number(countResult.rows[0]?.count || 0) > 0) return;

      const email = normalizeEmail(process.env["AUTH_ADMIN_EMAIL"]);
      const password = process.env["AUTH_ADMIN_PASSWORD"] || "";
      if (!email || !password) return;

      const passwordError = validatePassword(password);
      if (passwordError) throw new Error(`AUTH_ADMIN_PASSWORD is invalid: ${passwordError}`);

      const displayName = cleanDisplayName(process.env["AUTH_ADMIN_NAME"], email);
      const passwordHash = await hashPassword(password);
      await pool.query(
        `INSERT INTO app_users (email, display_name, role, password_hash, enabled)
         VALUES ($1, $2, 'admin', $3, true)
         ON CONFLICT (email) DO NOTHING`,
        [email, displayName, passwordHash],
      );
    })().catch((error) => {
      bootstrapPromise = null;
      throw error;
    });
  }
  await bootstrapPromise;
}

export async function authConfigurationStatus(): Promise<{ configured: boolean; bootstrapReady: boolean; userCount: number }> {
  await ensureBootstrapAdmin();
  const result = await pool.query<{ count: string }>("SELECT count(*)::text AS count FROM app_users");
  const userCount = Number(result.rows[0]?.count || 0);
  return {
    configured: userCount > 0,
    bootstrapReady: Boolean(process.env["AUTH_ADMIN_EMAIL"] && process.env["AUTH_ADMIN_PASSWORD"]),
    userCount,
  };
}

function cookieOptions() {
  const sessionDays = positiveNumber(process.env["AUTH_SESSION_DAYS"], DEFAULT_SESSION_DAYS);
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionDays * 24 * 60 * 60 * 1000,
  };
}

export async function createSession(req: Request, res: Response, userId: number): Promise<AuthUser> {
  await ensureAuthSchema();
  const rawToken = randomBytes(32).toString("base64url");
  const sessionDays = positiveNumber(process.env["AUTH_SESSION_DAYS"], DEFAULT_SESSION_DAYS);
  const expiresAt = new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000);

  await pool.query("DELETE FROM app_sessions WHERE expires_at <= now()");
  await pool.query(
    `INSERT INTO app_sessions (token_hash, user_id, expires_at, user_agent, ip_hash)
     VALUES ($1, $2, $3, $4, $5)`,
    [tokenHash(rawToken), userId, expiresAt, String(req.get("user-agent") || "").slice(0, 500), requestIpHash(req)],
  );

  res.cookie(COOKIE_NAME, rawToken, cookieOptions());
  const user = await getUserById(userId);
  if (!user) throw new Error("Unable to create session for user.");
  return user;
}

export async function destroySession(req: Request, res: Response): Promise<void> {
  await ensureAuthSchema();
  const rawToken = String(req.cookies?.[COOKIE_NAME] || "");
  if (rawToken) {
    await pool.query("DELETE FROM app_sessions WHERE token_hash = $1", [tokenHash(rawToken)]);
  }
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
}

async function getUserById(id: number): Promise<AuthUser | null> {
  const result = await pool.query<{
    id: number;
    email: string;
    display_name: string;
    role: AuthRole;
    enabled: boolean;
  }>(
    "SELECT id, email, display_name, role, enabled FROM app_users WHERE id = $1 LIMIT 1",
    [id],
  );
  const row = result.rows[0];
  return row ? { id: row.id, email: row.email, displayName: row.display_name, role: row.role, enabled: row.enabled } : null;
}

export async function authenticateRequest(req: Request): Promise<AuthUser | null> {
  await ensureBootstrapAdmin();
  const rawToken = String(req.cookies?.[COOKIE_NAME] || "");
  if (!rawToken) return null;

  const result = await pool.query<{
    id: number;
    email: string;
    display_name: string;
    role: AuthRole;
    enabled: boolean;
  }>(
    `SELECT u.id, u.email, u.display_name, u.role, u.enabled
     FROM app_sessions s
     JOIN app_users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now() AND u.enabled = true
     LIMIT 1`,
    [tokenHash(rawToken)],
  );

  const row = result.rows[0];
  if (!row) return null;
  await pool.query("UPDATE app_sessions SET last_seen_at = now() WHERE token_hash = $1", [tokenHash(rawToken)]);
  return { id: row.id, email: row.email, displayName: row.display_name, role: row.role, enabled: row.enabled };
}

export async function auditSecurityEvent(
  req: Request,
  action: string,
  details: Record<string, unknown> = {},
  targetType?: string,
  targetId?: string,
): Promise<void> {
  try {
    await ensureAuthSchema();
    await pool.query(
      `INSERT INTO security_audit_log (actor_user_id, action, target_type, target_id, details, ip_hash)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
      [req.authUser?.id || null, action, targetType || null, targetId || null, JSON.stringify(details), requestIpHash(req)],
    );
  } catch {
    // Audit logging must not expose secrets or replace the primary API response.
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const status = await authConfigurationStatus();
    if (!status.configured) {
      res.status(503).json({
        ok: false,
        code: "AUTH_NOT_CONFIGURED",
        error: "Secure access is not configured. Set AUTH_ADMIN_EMAIL and AUTH_ADMIN_PASSWORD on the server.",
      });
      return;
    }

    const user = await authenticateRequest(req);
    if (!user) {
      res.status(401).json({ ok: false, code: "AUTH_REQUIRED", error: "Sign in is required for this operation." });
      return;
    }

    req.authUser = user;
    next();
  } catch {
    res.status(503).json({ ok: false, code: "AUTH_UNAVAILABLE", error: "Secure access is temporarily unavailable." });
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  await requireAuth(req, res, () => {
    if (req.authUser?.role !== "admin") {
      res.status(403).json({ ok: false, code: "ADMIN_REQUIRED", error: "Admin access is required for this operation." });
      return;
    }
    next();
  });
}

export async function protectSharedWrites(req: Request, res: Response, next: NextFunction): Promise<void> {
  const rule = SHARED_WRITE_RULES.find((candidate) => candidate.method === req.method && candidate.path.test(req.path));
  if (!rule) {
    next();
    return;
  }

  await requireAdmin(req, res, () => {
    res.on("finish", () => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        void auditSecurityEvent(req, rule.action, { method: req.method, path: req.path, statusCode: res.statusCode });
      }
    });
    next();
  });
}

export const authInternals = {
  cookieName: COOKIE_NAME,
  inviteHours: () => positiveNumber(process.env["AUTH_INVITE_HOURS"], DEFAULT_INVITE_HOURS),
  normalizeEmail,
  cleanDisplayName,
  tokenHash,
};
