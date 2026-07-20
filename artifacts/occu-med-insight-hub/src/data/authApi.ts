export type AuthRole = "admin" | "user";

export type AuthUser = {
  id: number;
  email: string;
  displayName: string;
  role: AuthRole;
  enabled: boolean;
  createdAt?: string;
};

export type AuthSession = {
  authenticated: boolean;
  configured: boolean;
  user?: AuthUser;
};

export type PendingInvitation = {
  id: number;
  email: string;
  role: AuthRole;
  expiresAt: string;
  createdAt: string;
};

type ApiEnvelope = {
  ok?: boolean;
  error?: string;
  code?: string;
};

async function apiRequest<T extends ApiEnvelope>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({ error: "The server returned an unreadable response." })) as T;
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

export async function fetchAuthSession(): Promise<AuthSession> {
  const data = await apiRequest<ApiEnvelope & AuthSession>("/api/auth/session");
  return { authenticated: data.authenticated, configured: data.configured, user: data.user };
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const data = await apiRequest<ApiEnvelope & { user: AuthUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return data.user;
}

export async function logout(): Promise<void> {
  await apiRequest<ApiEnvelope>("/api/auth/logout", { method: "POST" });
}

export async function acceptInvitation(token: string, displayName: string, password: string): Promise<AuthUser> {
  const data = await apiRequest<ApiEnvelope & { user: AuthUser }>("/api/auth/invitations/accept", {
    method: "POST",
    body: JSON.stringify({ token, displayName, password }),
  });
  return data.user;
}

export async function loadAccessDirectory(): Promise<{ users: AuthUser[]; invitations: PendingInvitation[] }> {
  const data = await apiRequest<ApiEnvelope & { users: AuthUser[]; invitations: PendingInvitation[] }>("/api/auth/users");
  return { users: data.users, invitations: data.invitations };
}

export async function createInvitation(email: string, role: AuthRole): Promise<{ email: string; role: AuthRole; expiresAt: string; invitationUrl: string }> {
  const data = await apiRequest<ApiEnvelope & { invitation: { email: string; role: AuthRole; expiresAt: string; invitationUrl: string } }>("/api/auth/invitations", {
    method: "POST",
    body: JSON.stringify({ email, role }),
  });
  return data.invitation;
}

export async function updateUser(userId: number, patch: { role?: AuthRole; enabled?: boolean }): Promise<AuthUser> {
  const data = await apiRequest<ApiEnvelope & { user: AuthUser }>(`/api/auth/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return data.user;
}
