/**
 * Auth Slice - Authentication State Management
 * Mengelola state authentication, user data, dan session
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AuthState, User, AuthTokens } from '@/types';

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  tokens: null,
  tenantId: null,
  permissions: [],
  isLoading: false,
  error: null,
  biometricEnabled: false,
  rememberMe: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Login actions
    loginStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    loginSuccess: (state, action: PayloadAction<{
      user: User;
      tokens: AuthTokens;
      tenantId: string;
      permissions: string[];
    }>) => {
      state.isAuthenticated = true;
      state.user = action.payload.user;
      state.tokens = action.payload.tokens;
      state.tenantId = action.payload.tenantId;
      state.permissions = action.payload.permissions;
      state.isLoading = false;
      state.error = null;
    },
    loginFailure: (state, action: PayloadAction<string>) => {
      state.isAuthenticated = false;
      state.user = null;
      state.tokens = null;
      state.tenantId = null;
      state.permissions = [];
      state.isLoading = false;
      state.error = action.payload;
    },

    // Logout actions
    logout: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.tokens = null;
      state.tenantId = null;
      state.permissions = [];
      state.isLoading = false;
      state.error = null;
    },

    // Token refresh
    refreshTokenStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    refreshTokenSuccess: (state, action: PayloadAction<AuthTokens>) => {
      state.tokens = action.payload;
      state.isLoading = false;
      state.error = null;
    },
    refreshTokenFailure: (state, action: PayloadAction<string>) => {
      state.isAuthenticated = false;
      state.user = null;
      state.tokens = null;
      state.tenantId = null;
      state.permissions = [];
      state.isLoading = false;
      state.error = action.payload;
    },

    // User profile updates
    updateUserProfile: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },

    // Permissions updates
    updatePermissions: (state, action: PayloadAction<string[]>) => {
      state.permissions = action.payload;
    },

    // Biometric settings
    setBiometricEnabled: (state, action: PayloadAction<boolean>) => {
      state.biometricEnabled = action.payload;
    },

    // Remember me setting
    setRememberMe: (state, action: PayloadAction<boolean>) => {
      state.rememberMe = action.payload;
    },

    // Clear error
    clearError: (state) => {
      state.error = null;
    },

    // Set tenant
    setTenantId: (state, action: PayloadAction<string>) => {
      state.tenantId = action.payload;
    },

    // Registration actions
    registerStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    registerSuccess: (state) => {
      state.isLoading = false;
      state.error = null;
    },
    registerFailure: (state, action: PayloadAction<string>) => {
      state.isLoading = false;
      state.error = action.payload;
    },

    // Reset password actions
    resetPasswordStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    resetPasswordSuccess: (state) => {
      state.isLoading = false;
      state.error = null;
    },
    resetPasswordFailure: (state, action: PayloadAction<string>) => {
      state.isLoading = false;
      state.error = action.payload;
    },
  },
});

export const {
  loginStart,
  loginSuccess,
  loginFailure,
  logout,
  refreshTokenStart,
  refreshTokenSuccess,
  refreshTokenFailure,
  updateUserProfile,
  updatePermissions,
  setBiometricEnabled,
  setRememberMe,
  clearError,
  setTenantId,
  registerStart,
  registerSuccess,
  registerFailure,
  resetPasswordStart,
  resetPasswordSuccess,
  resetPasswordFailure,
} = authSlice.actions;

export default authSlice.reducer;

// Selectors
export const selectAuth = (state: { auth: AuthState }) => state.auth;
export const selectUser = (state: { auth: AuthState }) => state.auth.user;
export const selectIsAuthenticated = (state: { auth: AuthState }) => state.auth.isAuthenticated;
export const selectTokens = (state: { auth: AuthState }) => state.auth.tokens;
export const selectTenantId = (state: { auth: AuthState }) => state.auth.tenantId;
export const selectPermissions = (state: { auth: AuthState }) => state.auth.permissions;
export const selectAuthLoading = (state: { auth: AuthState }) => state.auth.isLoading;
export const selectAuthError = (state: { auth: AuthState }) => state.auth.error;
export const selectBiometricEnabled = (state: { auth: AuthState }) => state.auth.biometricEnabled;
export const selectRememberMe = (state: { auth: AuthState }) => state.auth.rememberMe;

// Permission checker
export const selectHasPermission = (permission: string) => (state: { auth: AuthState }) =>
  state.auth.permissions.includes(permission);

// Role checker
export const selectHasRole = (role: string) => (state: { auth: AuthState }) =>
  state.auth.user?.role === role;

// Access token getter
export const selectAccessToken = (state: { auth: AuthState }) =>
  state.auth.tokens?.accessToken;

// Refresh token getter
export const selectRefreshToken = (state: { auth: AuthState }) =>
  state.auth.tokens?.refreshToken;