export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  userId: string;
  preferredCurrency: string;
  avatarUrl?: string;
  costSensitivity: 'budget' | 'balanced' | 'splurge';
  preferredPace: 'relaxed' | 'moderate' | 'fast';
  primaryPriority: string;
  willingnessToPaySpeed: number; // 0.0 to 1.0
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  token: string;
  tokenType: string;
  expiresInMs: number;
  user: AuthUser;
  profile: UserProfile;
}

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  termsAccepted: boolean;
}

export interface LoginInput {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface UpdateProfileInput {
  fullName?: string;
  preferredCurrency?: string;
  avatarUrl?: string;
  costSensitivity?: 'budget' | 'balanced' | 'splurge';
  preferredPace?: 'relaxed' | 'moderate' | 'fast';
  primaryPriority?: string;
  willingnessToPaySpeed?: number;
}
