import { randomBytes } from "node:crypto";
import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import {
  auditSecurityEvent,
  authenticateRequest,
  authConfigurationStatus,
  authInternals,
  createSession,
  destroySession,
  ensureAuthSchema,
  ensureBootstrapAdmin,
  hashPassword,
  requireAdmin,
  validatePassword,
  verifyPassword,
  type AuthRole,
} from "../lib/auth";

const router: IRouter = Router();

function publicUser(user: { id: number; email: string; display_name: string; role: AuthRole; enabled: boolean; created_at?: Date }) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    role: user.role,
    enabled: user.enabled,
    createdAt: user.created_at?.toISOString(),
  };
}

router.get("/auth/status", async (_req, res) => {
  try {
    const status = await authConfigurationStatus();
    res.json({ ok: true, ...status, inviteOnly: true, roles: ["admin", "user"] });
  } catch {
    res.status(503).json({ ok: false, configured: false, error: "Secure access is temporarily unavailable." });
  }
});

router.get("/auth/session", async (req, res) => {
  try {
    const status = await authConfigurationStatus();
    if (!status.configured) {
      res.json({ ok: true, authenticated: false, configured: false });
      return;
    }
    const user = await authenticateRequest(req);
    if (!user) {
      res.json({ ok: true, authenticated: false, configured: true });
      return;
    }
    req.authUser = user;
    res.json({ ok: true, authenticated: true, configured: true, user });
  } catch {
    res.status(503).json({ ok: false, authenticated: false, error: "Secure access is temporarily unavailable." });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    await ensureBootstrapAdmin();
    const email = authInternals.normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    if (!email || !password) {
      res.status(400).json({ ok: false, error: "Email and password are required." });
      return;
    }

    const result = await pool.query<{
      id: number;
      email: string;
      display_name: string;
      role: AuthRole;
      enabled: boolean;
      password_hash: string;
    }>(
      "SELECT id, email, display_name, role, enabled, password_hash FROM app_users WHERE email = $1 LIMIT 1",
      [email],
    );
    const row = result.rows[0];
    const valid = row ? await verifyPassword(password, row.password_hash) : false;
    if (!row || !valid) {
      await auditSecurityEvent(req, "auth.login-failed", { email });
      res.status(401).json({ ok: false, error: "Email or password is incorrect." });
      return;
    }
    if (!row.enabled) {
      res.status(403).json({ ok: false, error: "This account is disabled." });
      return;
    }

    const user = await createSession(req, res, row.id);
    req.authUser = user;
    await auditSecurityEvent(req, "auth.login", { role: user.role }, "user", String(user.id));
    res.json({ ok: true, authenticated: true, user });
  } catch {
    res.status(503).json({ ok: false, error: "Unable to sign in right now." });
  }
});

router.post("/auth/logout", async (req, res) => {
  try {
    const user = await authenticateRequest(req);
    if (user) req.authUser = user;
    await destroySession(req, res);
    await auditSecurityEvent(req, "auth.logout", {}, "user", user ? String(user.id) : undefined);
    res.json({ ok: true, authenticated: false });
  } catch {
    res.status(503).json({ ok: false, error: "Unable to sign out right now." });
  }
});

router.get("/auth/users", requireAdmin, async (_req, res) => {
  try {
    await ensureAuthSchema();
    const users = await pool.query<{
      id: number;
      email: string;
      display_name: string;
      role: AuthRole;
      enabled: boolean;
      created_at: Date;
    }>("SELECT id, email, display_name, role, enabled, created_at FROM app_users ORDER BY created_at ASC");

    const invitations = await pool.query<{
      id: number;
      email: string;
      role: AuthRole;
      expires_at: Date;
      accepted_at: Date | null;
      created_at: Date;
    }>(
      `SELECT id, email, role, expires_at, accepted_at, created_at
       FROM app_invitations
       WHERE accepted_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC`,
    );

    res.json({
      ok: true,
      users: users.rows.map(publicUser),
      invitations: invitations.rows.map((invite) => ({
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expires_at.toISOString(),
        acceptedAt: invite.accepted_at?.toISOString(),
        createdAt: invite.created_at.toISOString(),
      })),
    });
  } catch {
    res.status(500).json({ ok: false, error: "Unable to load users." });
  }
});

router.post("/auth/invitations", requireAdmin, async (req, res) => {
  try {
    const email = authInternals.normalizeEmail(req.body?.email);
    const role: AuthRole = req.body?.role === "admin" ? "admin" : "user";
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      res.status(400).json({ ok: false, error: "A valid email is required." });
      return;
    }

    const existing = await pool.query("SELECT id FROM app_users WHERE email = $1 LIMIT 1", [email]);
    if (existing.rowCount) {
      res.status(409).json({ ok: false, error: "A user with this email already exists." });
      return;
    }

    await pool.query("DELETE FROM app_invitations WHERE email = $1 AND accepted_at IS NULL", [email]);
    const rawToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + authInternals.inviteHours() * 60 * 60 * 1000);
    const result = await pool.query<{ id: number }>(
      `INSERT INTO app_invitations (email, role, token_hash, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [email, role, authInternals.tokenHash(rawToken), expiresAt, req.authUser?.id],
    );

    const configuredBase = String(process.env["PUBLIC_APP_URL"] || "").trim().replace(/\/$/, "");
    const forwardedProto = String(req.get("x-forwarded-proto") || req.protocol).split(",")[0].trim();
    const forwardedHost = String(req.get("x-forwarded-host") || req.get("host") || "").split(",")[0].trim();
    const requestBase = forwardedHost ? `${forwardedProto}://${forwardedHost}` : "";
    const baseUrl = configuredBase || requestBase;
    const invitationUrl = `${baseUrl}/access?invite=${encodeURIComponent(rawToken)}`;

    await auditSecurityEvent(req, "auth.invitation-created", { email, role, invitationId: result.rows[0]?.id }, "invitation", String(result.rows[0]?.id || ""));
    res.status(201).json({ ok: true, invitation: { email, role, expiresAt: expiresAt.toISOString(), invitationUrl } });
  } catch {
    res.status(500).json({ ok: false, error: "Unable to create invitation." });
  }
});

router.post("/auth/invitations/accept", async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureAuthSchema();
    const token = String(req.body?.token || "").trim();
    const password = String(req.body?.password || "");
    if (!token) {
      res.status(400).json({ ok: false, error: "Invitation token is required." });
      return;
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      res.status(400).json({ ok: false, error: passwordError });
      return;
    }

    await client.query("BEGIN");
    const inviteResult = await client.query<{
      id: number;
      email: string;
      role: AuthRole;
      expires_at: Date;
      accepted_at: Date | null;
    }>(
      `SELECT id, email, role, expires_at, accepted_at
       FROM app_invitations
       WHERE token_hash = $1
       FOR UPDATE`,
      [authInternals.tokenHash(token)],
    );
    const invite = inviteResult.rows[0];
    if (!invite || invite.accepted_at || invite.expires_at.getTime() <= Date.now()) {
      await client.query("ROLLBACK");
      res.status(410).json({ ok: false, error: "This invitation is invalid, expired, or already used." });
      return;
    }

    const displayName = authInternals.cleanDisplayName(req.body?.displayName, invite.email);
    const passwordHash = await hashPassword(password);
    const userResult = await client.query<{
      id: number;
      email: string;
      display_name: string;
      role: AuthRole;
      enabled: boolean;
    }>(
      `INSERT INTO app_users (email, display_name, role, password_hash, enabled)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, display_name, role, enabled`,
      [invite.email, displayName, invite.role, passwordHash],
    );
    const row = userResult.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      res.status(409).json({ ok: false, error: "A user with this email already exists." });
      return;
    }

    await client.query("UPDATE app_invitations SET accepted_at = now() WHERE id = $1", [invite.id]);
    await client.query("COMMIT");

    const user = await createSession(req, res, row.id);
    req.authUser = user;
    await auditSecurityEvent(req, "auth.invitation-accepted", { invitationId: invite.id }, "user", String(user.id));
    res.status(201).json({ ok: true, authenticated: true, user });
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    res.status(500).json({ ok: false, error: "Unable to accept invitation." });
  } finally {
    client.release();
  }
});

router.patch("/auth/users/:id", requireAdmin, async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      res.status(400).json({ ok: false, error: "Valid user ID is required." });
      return;
    }

    const requestedRole: AuthRole | undefined = req.body?.role === "admin" || req.body?.role === "user" ? req.body.role : undefined;
    const requestedEnabled = typeof req.body?.enabled === "boolean" ? req.body.enabled : undefined;
    if (requestedRole === undefined && requestedEnabled === undefined) {
      res.status(400).json({ ok: false, error: "Provide role and/or enabled." });
      return;
    }
    if (userId === req.authUser?.id && requestedEnabled === false) {
      res.status(400).json({ ok: false, error: "You cannot disable your own account." });
      return;
    }

    const currentResult = await pool.query<{ id: number; role: AuthRole; enabled: boolean }>(
      "SELECT id, role, enabled FROM app_users WHERE id = $1 LIMIT 1",
      [userId],
    );
    const current = currentResult.rows[0];
    if (!current) {
      res.status(404).json({ ok: false, error: "User not found." });
      return;
    }

    const removesAdmin = current.role === "admin" && (requestedRole === "user" || requestedEnabled === false);
    if (removesAdmin) {
      const adminCount = await pool.query<{ count: string }>(
        "SELECT count(*)::text AS count FROM app_users WHERE role = 'admin' AND enabled = true AND id <> $1",
        [userId],
      );
      if (Number(adminCount.rows[0]?.count || 0) === 0) {
        res.status(400).json({ ok: false, error: "At least one enabled Admin account must remain." });
        return;
      }
    }

    const result = await pool.query<{
      id: number;
      email: string;
      display_name: string;
      role: AuthRole;
      enabled: boolean;
      created_at: Date;
    }>(
      `UPDATE app_users
       SET role = COALESCE($2, role), enabled = COALESCE($3, enabled), updated_at = now()
       WHERE id = $1
       RETURNING id, email, display_name, role, enabled, created_at`,
      [userId, requestedRole || null, requestedEnabled ?? null],
    );

    if (requestedEnabled === false) {
      await pool.query("DELETE FROM app_sessions WHERE user_id = $1", [userId]);
    }
    const user = result.rows[0];
    await auditSecurityEvent(req, "auth.user-updated", { role: user.role, enabled: user.enabled }, "user", String(user.id));
    res.json({ ok: true, user: publicUser(user) });
  } catch {
    res.status(500).json({ ok: false, error: "Unable to update user." });
  }
});

export default router;
