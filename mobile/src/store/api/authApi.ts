/**
 * Auth API - RTK Query untuk authentication endpoints
 * Menangani login, register, refresh token, dan profile management
 */

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { 
  LoginRequest, 
  LoginResponse, 
  RegisterRequest, 
  RefreshTokenRequest, 
  AuthTokens,
  User,
  ApiResponse,
} from '@/types';
import { API_CONFIG, STORAGE_KEYS } from '@/constants/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Base query dengan authentication header
const baseQuery = fetchBaseQuery({
  baseUrl: `${API_CONFIG.BASE_URL}/auth`,
  timeout: API_CONFIG.TIMEOUT,
  prepareHeaders: async (headers, { getState }) => {
    // Add tenant ID from state or storage
    const state = getState() as any;
    const tenantId = state.auth?.tenantId || await AsyncStorage.getItem(STORAGE_KEYS.TENANT_ID);
    
    if (tenantId) {
      headers.set('x-tenant-id', tenantId);
    }

    // Add auth token for protected endpoints
    const token = state.auth?.tokens?.accessToken || await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }

    headers.set('content-type', 'application/json');
    headers.set('accept', 'application/json');
    
    return headers;
  },
});

// Enhanced base query with automatic token refresh
const baseQueryWithReauth = async (args: any, api: any, extraOptions: any) => {
  let result = await baseQuery(args, api, extraOptions);
  
  // If we get 401, try to refresh token
  if (result.error && result.error.status === 401) {
    const state = api.getState() as any;
    const refreshToken = state.auth?.tokens?.refreshToken;
    
    if (refreshToken) {
      // Try to refresh token
      const refreshResult = await baseQuery(
        {
          url: '/refresh',
          method: 'POST',
          body: { refreshToken },
        },
        api,
        extraOptions
      );
      
      if (refreshResult.data) {
        // Store new tokens
        const newTokens = (refreshResult.data as ApiResponse<AuthTokens>).data;
        await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, newTokens.accessToken);
        await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, newTokens.refreshToken);
        
        // Update state
        api.dispatch({ 
          type: 'auth/refreshTokenSuccess', 
          payload: newTokens 
        });
        
        // Retry original request
        result = await baseQuery(args, api, extraOptions);
      } else {
        // Refresh failed, logout user
        api.dispatch({ type: 'auth/logout' });
        await AsyncStorage.multiRemove([
          STORAGE_KEYS.ACCESS_TOKEN,
          STORAGE_KEYS.REFRESH_TOKEN,
          STORAGE_KEYS.USER_DATA,
        ]);
      }
    } else {
      // No refresh token, logout user
      api.dispatch({ type: 'auth/logout' });
    }
  }
  
  return result;
};

export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['User', 'Profile', 'Permissions'],
  endpoints: (builder) => ({
    // Login
    login: builder.mutation<ApiResponse<LoginResponse>, LoginRequest & { tenantId: string }>({
      query: ({ tenantId, ...credentials }) => ({
        url: '/login',
        method: 'POST',
        body: credentials,
        headers: {
          'x-tenant-id': tenantId,
        },
      }),
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          const loginData = data.data;
          
          // Store tokens in AsyncStorage
          await AsyncStorage.multiSet([
            [STORAGE_KEYS.ACCESS_TOKEN, loginData.accessToken],
            [STORAGE_KEYS.REFRESH_TOKEN, loginData.refreshToken],
            [STORAGE_KEYS.USER_DATA, JSON.stringify(loginData.user)],
            [STORAGE_KEYS.TENANT_ID, arg.tenantId],
          ]);
          
          // Get user permissions
          const permissions = await dispatch(authApi.endpoints.getPermissions.initiate()).unwrap();
          
          // Update auth state
          dispatch({
            type: 'auth/loginSuccess',
            payload: {
              user: loginData.user,
              tokens: {
                accessToken: loginData.accessToken,
                refreshToken: loginData.refreshToken,
                expiresIn: loginData.expiresIn,
                tokenType: loginData.tokenType,
              },
              tenantId: arg.tenantId,
              permissions: permissions.data.permissions,
            },
          });
        } catch (error) {
          dispatch({
            type: 'auth/loginFailure',
            payload: 'Login gagal. Silakan periksa kredensial Anda.',
          });
        }
      },
    }),

    // Register
    register: builder.mutation<ApiResponse<{ message: string }>, RegisterRequest & { tenantId: string }>({
      query: ({ tenantId, ...userData }) => ({
        url: '/register',
        method: 'POST',
        body: userData,
        headers: {
          'x-tenant-id': tenantId,
        },
      }),
    }),

    // Refresh Token
    refreshToken: builder.mutation<ApiResponse<AuthTokens>, RefreshTokenRequest>({
      query: (refreshData) => ({
        url: '/refresh',
        method: 'POST',
        body: refreshData,
      }),
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          const tokens = data.data;
          
          // Update stored tokens
          await AsyncStorage.multiSet([
            [STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken],
            [STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken],
          ]);
          
          // Update state
          dispatch({
            type: 'auth/refreshTokenSuccess',
            payload: tokens,
          });
        } catch (error) {
          dispatch({
            type: 'auth/refreshTokenFailure',
            payload: 'Gagal memperbarui token. Silakan login ulang.',
          });
        }
      },
    }),

    // Get Profile
    getProfile: builder.query<ApiResponse<Partial<User>>, void>({
      query: () => '/profile',
      providesTags: ['Profile'],
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch({
            type: 'auth/updateUserProfile',
            payload: data.data,
          });
        } catch (error) {
          // Handle profile fetch error
        }
      },
    }),

    // Get Permissions
    getPermissions: builder.query<ApiResponse<{ permissions: string[] }>, void>({
      query: () => '/permissions',
      providesTags: ['Permissions'],
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch({
            type: 'auth/updatePermissions',
            payload: data.data.permissions,
          });
        } catch (error) {
          // Handle permissions fetch error
        }
      },
    }),

    // Logout
    logout: builder.mutation<ApiResponse<{ message: string }>, void>({
      query: () => ({
        url: '/logout',
        method: 'POST',
      }),
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } catch (error) {
          // Even if logout fails on server, clean up local state
        } finally {
          // Clear all auth data
          await AsyncStorage.multiRemove([
            STORAGE_KEYS.ACCESS_TOKEN,
            STORAGE_KEYS.REFRESH_TOKEN,
            STORAGE_KEYS.USER_DATA,
            STORAGE_KEYS.TENANT_ID,
          ]);
          
          dispatch({ type: 'auth/logout' });
        }
      },
    }),

    // Update Profile
    updateProfile: builder.mutation<ApiResponse<User>, Partial<User>>({
      query: (updates) => ({
        url: '/profile',
        method: 'PATCH',
        body: updates,
      }),
      invalidatesTags: ['Profile'],
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch({
            type: 'auth/updateUserProfile',
            payload: data.data,
          });
          
          // Update stored user data
          await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(data.data));
        } catch (error) {
          // Handle update error
        }
      },
    }),

    // Change Password
    changePassword: builder.mutation<ApiResponse<{ message: string }>, {
      currentPassword: string;
      newPassword: string;
    }>({
      query: (passwordData) => ({
        url: '/change-password',
        method: 'POST',
        body: passwordData,
      }),
    }),

    // Forgot Password
    forgotPassword: builder.mutation<ApiResponse<{ message: string }>, { email: string; tenantId: string }>({
      query: ({ tenantId, email }) => ({
        url: '/forgot-password',
        method: 'POST',
        body: { email },
        headers: {
          'x-tenant-id': tenantId,
        },
      }),
    }),

    // Reset Password
    resetPassword: builder.mutation<ApiResponse<{ message: string }>, {
      token: string;
      newPassword: string;
    }>({
      query: (resetData) => ({
        url: '/reset-password',
        method: 'POST',
        body: resetData,
      }),
    }),

    // Verify Email
    verifyEmail: builder.mutation<ApiResponse<{ message: string }>, { token: string }>({
      query: (verificationData) => ({
        url: '/verify-email',
        method: 'POST',
        body: verificationData,
      }),
    }),

    // Resend Verification Email
    resendVerificationEmail: builder.mutation<ApiResponse<{ message: string }>, void>({
      query: () => ({
        url: '/resend-verification',
        method: 'POST',
      }),
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useRefreshTokenMutation,
  useGetProfileQuery,
  useGetPermissionsQuery,
  useLogoutMutation,
  useUpdateProfileMutation,
  useChangePasswordMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useVerifyEmailMutation,
  useResendVerificationEmailMutation,
} = authApi;