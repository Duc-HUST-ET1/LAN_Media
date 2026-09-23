export interface AuthUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatar: string | null;
  role: 'USER' | 'ADMIN';
  createdAt: string;
  updatedAt: string;
}

interface UserResponse { user: AuthUser }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/auth${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (response.status === 204) return undefined as T;
  const body = await response.json() as { user?: AuthUser; error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message ?? 'The request could not be completed.');
  return body as T;
}

export const AuthApi = {
  async getCurrentUser(): Promise<AuthUser> {
    return (await request<UserResponse>('/me')).user;
  },
  async register(input: { username: string; email: string; displayName: string; password: string }): Promise<AuthUser> {
    return (await request<UserResponse>('/register', { method: 'POST', body: JSON.stringify(input) })).user;
  },
  async login(identifier: string, password: string): Promise<AuthUser> {
    return (await request<UserResponse>('/login', { method: 'POST', body: JSON.stringify({ identifier, password }) })).user;
  },
  logout(): Promise<void> {
    return request<void>('/logout', { method: 'POST' });
  },
};
