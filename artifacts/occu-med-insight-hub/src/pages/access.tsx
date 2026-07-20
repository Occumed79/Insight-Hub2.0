import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Check, Clipboard, LogIn, LogOut, ShieldCheck, UserPlus, Users } from "lucide-react";
import {
  acceptInvitation,
  createInvitation,
  fetchAuthSession,
  loadAccessDirectory,
  login,
  logout,
  updateUser,
  type AuthRole,
  type AuthSession,
  type AuthUser,
  type PendingInvitation,
} from "@/data/authApi";

function AccessCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`glass-card rounded-[28px] border border-cyan-100/16 p-6 ${className}`}>{children}</section>;
}

function ErrorNotice({ message }: { message: string }) {
  if (!message) return null;
  return <p className="rounded-2xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">{message}</p>;
}

function LoginPanel({ onAuthenticated, configured }: { onAuthenticated: (user: AuthUser) => void; configured: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      onAuthenticated(await login(email, password));
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccessCard className="mx-auto max-w-xl">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl border border-cyan-100/20 bg-cyan-200/10 p-3 text-cyan-100"><LogIn className="h-5 w-5" /></div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/50">Secure access</p>
          <h2 className="mt-1 text-2xl font-bold text-white">Sign in to Insight Hub</h2>
        </div>
      </div>

      {!configured && (
        <p className="mt-5 rounded-2xl border border-yellow-300/20 bg-yellow-300/8 px-4 py-3 text-sm leading-6 text-yellow-100/85">
          The first Admin account has not been initialized. Set <code>AUTH_ADMIN_EMAIL</code> and <code>AUTH_ADMIN_PASSWORD</code> on the server, then reopen this page.
        </p>
      )}

      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-cyan-50/80">Email</span>
          <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-2xl border border-cyan-100/16 bg-white/[0.055] px-4 py-3 text-white outline-none transition focus:border-cyan-200/45" />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-cyan-50/80">Password</span>
          <input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-2xl border border-cyan-100/16 bg-white/[0.055] px-4 py-3 text-white outline-none transition focus:border-cyan-200/45" />
        </label>
        <ErrorNotice message={error} />
        <button type="submit" disabled={busy || !configured} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-200/32 bg-cyan-200/12 px-4 py-3 font-semibold text-cyan-50 transition hover:bg-cyan-200/18 disabled:cursor-not-allowed disabled:opacity-50">
          <LogIn className="h-4 w-4" /> {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </AccessCard>
  );
}

function InvitationAcceptance({ token, onAuthenticated }: { token: string; onAuthenticated: (user: AuthUser) => void }) {
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      onAuthenticated(await acceptInvitation(token, displayName, password));
      window.history.replaceState({}, "", `${import.meta.env.BASE_URL.replace(/\/$/, "")}/access`);
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : "Unable to accept invitation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccessCard className="mx-auto max-w-xl">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl border border-emerald-200/20 bg-emerald-200/10 p-3 text-emerald-100"><UserPlus className="h-5 w-5" /></div>
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100/50">Invitation</p><h2 className="mt-1 text-2xl font-bold text-white">Create your account</h2></div>
      </div>
      <p className="mt-5 text-sm leading-6 text-cyan-50/65">This invitation is single-use. Choose your display name and a password containing at least 12 characters.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block"><span className="mb-2 block text-sm font-semibold text-cyan-50/80">Display name</span><input required value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="w-full rounded-2xl border border-cyan-100/16 bg-white/[0.055] px-4 py-3 text-white outline-none focus:border-cyan-200/45" /></label>
        <label className="block"><span className="mb-2 block text-sm font-semibold text-cyan-50/80">Password</span><input type="password" minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-2xl border border-cyan-100/16 bg-white/[0.055] px-4 py-3 text-white outline-none focus:border-cyan-200/45" /></label>
        <label className="block"><span className="mb-2 block text-sm font-semibold text-cyan-50/80">Confirm password</span><input type="password" minLength={12} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full rounded-2xl border border-cyan-100/16 bg-white/[0.055] px-4 py-3 text-white outline-none focus:border-cyan-200/45" /></label>
        <ErrorNotice message={error} />
        <button type="submit" disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200/30 bg-emerald-200/12 px-4 py-3 font-semibold text-emerald-50 transition hover:bg-emerald-200/18 disabled:opacity-50"><Check className="h-4 w-4" /> {busy ? "Creating account..." : "Create account"}</button>
      </form>
    </AccessCard>
  );
}

function AdminDirectory({ currentUser }: { currentUser: AuthUser }) {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AuthRole>("user");
  const [invitationUrl, setInvitationUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function refresh() {
    try {
      const directory = await loadAccessDirectory();
      setUsers(directory.users);
      setInvitations(directory.invitations);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load access directory.");
    }
  }

  useEffect(() => { void refresh(); }, []);

  async function submitInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setInvitationUrl("");
    try {
      const invitation = await createInvitation(inviteEmail, inviteRole);
      setInvitationUrl(invitation.invitationUrl);
      setInviteEmail("");
      await refresh();
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "Unable to create invitation.");
    } finally {
      setBusy(false);
    }
  }

  async function applyUserUpdate(user: AuthUser, patch: { role?: AuthRole; enabled?: boolean }) {
    setError("");
    try {
      const updated = await updateUser(user.id, patch);
      setUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update user.");
    }
  }

  async function copyInvitation() {
    await navigator.clipboard.writeText(invitationUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <AccessCard>
        <div className="flex items-center gap-3"><UserPlus className="h-5 w-5 text-cyan-100" /><h2 className="text-xl font-bold text-white">Invite a user</h2></div>
        <p className="mt-3 text-sm leading-6 text-cyan-50/60">Create a secure, expiring link and send it manually. There is no public registration or email-service integration.</p>
        <form onSubmit={submitInvite} className="mt-5 space-y-4">
          <input type="email" required placeholder="person@example.com" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} className="w-full rounded-2xl border border-cyan-100/16 bg-white/[0.055] px-4 py-3 text-white outline-none placeholder:text-cyan-50/28 focus:border-cyan-200/45" />
          <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as AuthRole)} className="w-full rounded-2xl border border-cyan-100/16 bg-[#080f20] px-4 py-3 text-white outline-none focus:border-cyan-200/45"><option value="user">User</option><option value="admin">Admin</option></select>
          <button type="submit" disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-200/30 bg-cyan-200/12 px-4 py-3 font-semibold text-cyan-50 transition hover:bg-cyan-200/18 disabled:opacity-50"><UserPlus className="h-4 w-4" /> {busy ? "Creating..." : "Create invitation"}</button>
        </form>
        {invitationUrl && <div className="mt-5 rounded-2xl border border-emerald-200/20 bg-emerald-200/8 p-4"><p className="break-all text-xs leading-5 text-emerald-50/80">{invitationUrl}</p><button type="button" onClick={copyInvitation} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-emerald-100"><Clipboard className="h-4 w-4" /> {copied ? "Copied" : "Copy invitation link"}</button></div>}
        {invitations.length > 0 && <div className="mt-6"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/45">Pending invitations</p><div className="mt-3 space-y-2">{invitations.map((invite) => <div key={invite.id} className="rounded-xl border border-white/8 bg-white/[0.035] px-3 py-2 text-sm text-cyan-50/70"><b className="text-white">{invite.email}</b><span className="ml-2 text-xs uppercase text-cyan-100/45">{invite.role}</span><p className="mt-1 text-xs text-cyan-100/40">Expires {new Date(invite.expiresAt).toLocaleString()}</p></div>)}</div></div>}
      </AccessCard>

      <AccessCard>
        <div className="flex items-center gap-3"><Users className="h-5 w-5 text-cyan-100" /><h2 className="text-xl font-bold text-white">Workspace users</h2></div>
        <div className="mt-5 space-y-3">{users.map((user) => <div key={user.id} className="rounded-2xl border border-white/8 bg-white/[0.035] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold text-white">{user.displayName}</p><p className="mt-1 text-sm text-cyan-50/55">{user.email}</p></div><div className="flex items-center gap-2"><select value={user.role} disabled={user.id === currentUser.id} onChange={(event) => void applyUserUpdate(user, { role: event.target.value as AuthRole })} className="rounded-xl border border-cyan-100/14 bg-[#080f20] px-3 py-2 text-sm text-white disabled:opacity-50"><option value="user">User</option><option value="admin">Admin</option></select><button type="button" disabled={user.id === currentUser.id} onClick={() => void applyUserUpdate(user, { enabled: !user.enabled })} className={`rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-50 ${user.enabled ? "border-emerald-200/20 bg-emerald-200/8 text-emerald-100" : "border-red-200/20 bg-red-200/8 text-red-100"}`}>{user.enabled ? "Enabled" : "Disabled"}</button></div></div></div>)}</div>
      </AccessCard>
      <div className="lg:col-span-2"><ErrorNotice message={error} /></div>
    </div>
  );
}

export default function AccessPage() {
  const [, navigate] = useLocation();
  const invitationToken = useMemo(() => new URLSearchParams(window.location.search).get("invite") || "", []);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAuthSession().then(setSession).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load access status."));
  }, []);

  async function signOut() {
    try {
      await logout();
      setSession((current) => ({ authenticated: false, configured: current?.configured ?? true }));
      navigate("/access");
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : "Unable to sign out.");
    }
  }

  const authenticatedUser = session?.authenticated ? session.user : undefined;

  return (
    <main className="aurora-bg min-h-screen px-5 py-8 text-white">
      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4"><Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-50/65 transition hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to Insight Hub</Link>{authenticatedUser && <button type="button" onClick={() => void signOut()} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-4 py-2 text-sm font-semibold text-cyan-50/75 transition hover:border-white/20 hover:text-white"><LogOut className="h-4 w-4" /> Sign out</button>}</div>
        <header className="mx-auto mb-8 mt-10 max-w-3xl text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-100/20 bg-cyan-200/10 text-cyan-100 shadow-[0_0_36px_rgba(34,211,238,.16)]"><ShieldCheck className="h-7 w-7" /></div><p className="mt-5 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100/50">One shared workspace</p><h1 className="mt-3 text-4xl font-black tracking-[-0.045em] text-white md:text-5xl">Access & security</h1><p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-cyan-50/65">Invite-only access with two roles: Admin and User. Shared intelligence remains shared; state-changing operations are restricted to Admin accounts.</p></header>
        <ErrorNotice message={error} />
        {!session && <AccessCard className="mx-auto max-w-xl text-center text-cyan-50/65">Loading secure access...</AccessCard>}
        {session && invitationToken && !authenticatedUser && <InvitationAcceptance token={invitationToken} onAuthenticated={(user) => setSession({ authenticated: true, configured: true, user })} />}
        {session && !invitationToken && !authenticatedUser && <LoginPanel configured={session.configured} onAuthenticated={(user) => setSession({ authenticated: true, configured: true, user })} />}
        {authenticatedUser && <div className="space-y-6"><AccessCard><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm text-cyan-50/55">Signed in as</p><h2 className="mt-1 text-2xl font-bold text-white">{authenticatedUser.displayName}</h2><p className="mt-1 text-sm text-cyan-50/55">{authenticatedUser.email}</p></div><span className="rounded-full border border-cyan-100/20 bg-cyan-200/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-cyan-100">{authenticatedUser.role}</span></div></AccessCard>{authenticatedUser.role === "admin" ? <AdminDirectory currentUser={authenticatedUser} /> : <AccessCard><h2 className="text-xl font-bold text-white">User access</h2><p className="mt-3 text-sm leading-7 text-cyan-50/65">You can use the shared intelligence workspace and read verified data. Portal-link changes, location verification/imports, and intelligence ingestion require an Admin account.</p></AccessCard>}</div>}
      </div>
    </main>
  );
}
