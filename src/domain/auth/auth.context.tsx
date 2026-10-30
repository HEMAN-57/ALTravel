import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthUser, LoginInput, RegisterInput, UpdateProfileInput, UserProfile } from './auth.types';
import { apiClient } from '../../lib/api-client';

interface AuthContextType {
  user: AuthUser | null;
  profile: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (input: UpdateProfileInput) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Restore session on mount
  useEffect(() => {
    try {
      const session = apiClient.getSession();
      const currentToken = apiClient.getToken();
      if (session.user && currentToken) {
        setUser(session.user);
        setProfile(session.profile);
        setToken(currentToken);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.login(input);
      setUser(res.user);
      setProfile(res.profile);
      setToken(res.token);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed. Please check your credentials.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.register(input);
      setUser(res.user);
      setProfile(res.profile);
      setToken(res.token);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await apiClient.logout();
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.removeItem('tripsync_guest_active_trip_v1');
        } catch {
          // ignore
        }
      }
    } finally {
      setUser(null);
      setProfile(null);
      setToken(null);
      setIsLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (input: UpdateProfileInput) => {
    setIsLoading(true);
    setError(null);
    try {
      const updated = await apiClient.updateProfile(input);
      setProfile(updated);
      if (input.fullName && user) {
        setUser({ ...user, fullName: input.fullName });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile.';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: AuthContextType = {
    user,
    profile,
    token,
    isAuthenticated: !!user && !!token,
    isLoading,
    error,
    login,
    register,
    logout,
    updateProfile,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
