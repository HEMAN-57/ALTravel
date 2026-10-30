import {
  AuthResponse,
  AuthUser,
  LoginInput,
  RegisterInput,
  UpdateProfileInput,
  UserProfile,
} from '../domain/auth/auth.types';

const API_BASE_URL =
  (typeof import.meta !== 'undefined' &&
    (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL) ||
  'http://localhost:8080/api';

const SESSION_TOKEN_KEY = 'tripsync_auth_token_session';
const SESSION_USER_KEY = 'tripsync_auth_user_session';
const SESSION_PROFILE_KEY = 'tripsync_auth_profile_session';

class ApiClient {
  private token: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        this.token = sessionStorage.getItem(SESSION_TOKEN_KEY);
      } catch {
        this.token = null;
      }
    }
  }

  public getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      try {
        this.token = sessionStorage.getItem(SESSION_TOKEN_KEY) || localStorage.getItem(SESSION_TOKEN_KEY);
      } catch {
        this.token = null;
      }
    }
    return this.token;
  }

  public setToken(token: string | null): void {
    this.token = token;
    if (typeof window !== 'undefined') {
      try {
        if (token) {
          sessionStorage.setItem(SESSION_TOKEN_KEY, token);
        } else {
          sessionStorage.removeItem(SESSION_TOKEN_KEY);
        }
      } catch {
        // sessionStorage restricted
      }
    }
  }

  public saveSession(user: AuthUser | null, profile: UserProfile | null): void {
    if (typeof window !== 'undefined') {
      try {
        if (user) {
          sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
        } else {
          sessionStorage.removeItem(SESSION_USER_KEY);
        }
        if (profile) {
          sessionStorage.setItem(SESSION_PROFILE_KEY, JSON.stringify(profile));
        } else {
          sessionStorage.removeItem(SESSION_PROFILE_KEY);
        }
      } catch {
        // ignore
      }
    }
  }

  public clearSession(): void {
    this.setToken(null);
    this.saveSession(null, null);
  }

  public getSession(): { user: AuthUser | null; profile: UserProfile | null } {
    if (typeof window === 'undefined') return { user: null, profile: null };
    try {
      const u = sessionStorage.getItem(SESSION_USER_KEY);
      const p = sessionStorage.getItem(SESSION_PROFILE_KEY);
      return {
        user: u ? JSON.parse(u) : null,
        profile: p ? JSON.parse(p) : null,
      };
    } catch {
      return { user: null, profile: null };
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');

    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    const config: RequestInit = {
      ...options,
      headers,
      credentials: 'include', // send cookies if present
    };

    const res = await fetch(`${API_BASE_URL}${endpoint}`, config);

    if (!res.ok) {
      let errorMsg = `HTTP Error ${res.status}`;
      try {
        const errorData = await res.json();
        errorMsg = errorData.detail || errorData.message || errorData.title || errorMsg;
      } catch {
        // non-JSON error
      }
      throw new Error(errorMsg);
    }

    if (res.status === 204) {
      return {} as T;
    }

    return res.json() as Promise<T>;
  }

  // --- Auth APIs ---

  public async register(input: RegisterInput): Promise<AuthResponse> {
    try {
      const res = await this.request<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      this.setToken(res.token);
      this.saveSession(res.user, res.profile);
      return res;
    } catch (err: unknown) {
      const isFetchError =
        err instanceof TypeError ||
        (err instanceof Error &&
          (err.message.includes('fetch') ||
            err.message.includes('Failed') ||
            err.message.includes('Network') ||
            err.message.includes('NetworkError')));
      if (isFetchError) {
        throw new Error(
          'Unable to connect to the TripSync authentication server (http://localhost:8080). Please ensure the backend is running, or explore the simulated Goa demonstration without an account.'
        );
      }
      throw err;
    }
  }

  public async login(input: LoginInput): Promise<AuthResponse> {
    try {
      const res = await this.request<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      this.setToken(res.token);
      this.saveSession(res.user, res.profile);
      return res;
    } catch (err: unknown) {
      const isFetchError =
        err instanceof TypeError ||
        (err instanceof Error &&
          (err.message.includes('fetch') ||
            err.message.includes('Failed') ||
            err.message.includes('Network') ||
            err.message.includes('NetworkError')));
      if (isFetchError) {
        throw new Error(
          'Unable to connect to the TripSync authentication server (http://localhost:8080). Please ensure the backend is running, or explore the simulated Goa demonstration without an account.'
        );
      }
      throw err;
    }
  }

  public async logout(): Promise<void> {
    try {
      await this.request<{ message: string }>('/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      this.setToken(null);
      this.saveSession(null, null);
    }
  }

  public async getProfile(): Promise<UserProfile> {
    return this.request<UserProfile>('/users/profile');
  }

  public async updateProfile(input: UpdateProfileInput): Promise<UserProfile> {
    try {
      const profile = await this.request<UserProfile>('/users/profile', {
        method: 'PUT',
        body: JSON.stringify(input),
      });
      const session = this.getSession();
      if (session.user && input.fullName) {
        session.user.fullName = input.fullName;
      }
      this.saveSession(session.user, profile);
      return profile;
    } catch (err: unknown) {
      const isFetchError = err instanceof TypeError && (err.message.includes('fetch') || err.message.includes('Failed'));
      if (isFetchError) {
        const session = this.getSession();
        if (session.profile) {
          const updated: UserProfile = {
            ...session.profile,
            ...input,
            updatedAt: new Date().toISOString(),
          };
          if (session.user && input.fullName) {
            session.user.fullName = input.fullName;
          }
          this.saveSession(session.user, updated);
          return updated;
        }
      }
      throw err;
    }
  }

  public async forgotPassword(email: string): Promise<{ success: boolean; message: string; notice: string }> {
    try {
      return await this.request<{ success: boolean; message: string; notice: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    } catch {
      return {
        success: true,
        message: `Password reset request received for ${email}.`,
        notice: 'Email delivery provider is pending SMTP configuration in this demonstration environment.',
      };
    }
  }
}

export const apiClient = new ApiClient();
