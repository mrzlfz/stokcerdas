/**
 * Login Screen Component
 * Halaman login dengan form authentication
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

// Components
import TextInput from '@/components/common/TextInput';
import Button from '@/components/common/Button';
import Checkbox from '@/components/common/Checkbox';

// Hooks & Store
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useLoginMutation } from '@/store/api/authApi';
import { selectAuthLoading } from '@/store/slices/authSlice';

// Types & Constants
import type { LoginFormData } from '@/types';
import { UI_CONFIG, APP_CONFIG } from '@/constants/config';

const { width } = Dimensions.get('window');

// Validation schema
const loginSchema = yup.object({
  email: yup
    .string()
    .email('Format email tidak valid')
    .required('Email wajib diisi'),
  password: yup
    .string()
    .min(6, 'Password minimal 6 karakter')
    .required('Password wajib diisi'),
  rememberMe: yup.boolean(),
});

const LoginScreen: React.FC = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const isLoading = useAppSelector(selectAuthLoading);
  
  const [showPassword, setShowPassword] = useState(false);
  const [tenantId, setTenantId] = useState('demo-tenant'); // Default tenant for demo
  
  const [login] = useLoginMutation();

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<LoginFormData>({
    resolver: yupResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
    mode: 'onChange',
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login({
        ...data,
        tenantId,
      }).unwrap();
      
      // Navigation will be handled automatically by AppNavigator
      // when authentication state changes
    } catch (error: any) {
      Alert.alert(
        'Login Gagal',
        error?.data?.error?.message || 'Terjadi kesalahan saat login. Silakan coba lagi.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleForgotPassword = () => {
    navigation.navigate('ForgotPassword' as never);
  };

  const handleRegister = () => {
    navigation.navigate('Register' as never);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoEmoji}>📦</Text>
            </View>
            <Text style={styles.title}>{APP_CONFIG.APP_NAME}</Text>
            <Text style={styles.subtitle}>
              Masuk ke akun Anda untuk mengelola inventori
            </Text>
          </View>

          {/* Login Form */}
          <View style={styles.formContainer}>
            {/* Email Input */}
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  label="Email"
                  placeholder="Masukkan email Anda"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.email?.message}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="emailAddress"
                  leftIcon="email"
                />
              )}
            />

            {/* Password Input */}
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  label="Password"
                  placeholder="Masukkan password Anda"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.password?.message}
                  secureTextEntry={!showPassword}
                  textContentType="password"
                  leftIcon="lock"
                  rightIcon={showPassword ? 'visibility-off' : 'visibility'}
                  onRightIconPress={() => setShowPassword(!showPassword)}
                />
              )}
            />

            {/* Remember Me & Forgot Password */}
            <View style={styles.optionsRow}>
              <Controller
                control={control}
                name="rememberMe"
                render={({ field: { onChange, value } }) => (
                  <Checkbox
                    label="Ingat saya"
                    checked={value}
                    onPress={() => onChange(!value)}
                  />
                )}
              />
              
              <TouchableOpacity
                onPress={handleForgotPassword}
                style={styles.forgotPasswordButton}
              >
                <Text style={styles.forgotPasswordText}>
                  Lupa password?
                </Text>
              </TouchableOpacity>
            </View>

            {/* Login Button */}
            <Button
              title="Masuk"
              onPress={handleSubmit(onSubmit)}
              loading={isLoading}
              disabled={!isValid || isLoading}
              style={styles.loginButton}
            />

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>atau</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Register Link */}
            <TouchableOpacity
              onPress={handleRegister}
              style={styles.registerButton}
              disabled={isLoading}
            >
              <Text style={styles.registerText}>
                Belum punya akun?{' '}
                <Text style={styles.registerLinkText}>Daftar sekarang</Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.versionText}>
              Versi {APP_CONFIG.VERSION}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI_CONFIG.BACKGROUND_COLOR,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: UI_CONFIG.PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoEmoji: {
    fontSize: 36,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: UI_CONFIG.TEXT_PRIMARY,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: UI_CONFIG.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
  },
  formContainer: {
    flex: 1,
    paddingBottom: 32,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 16,
  },
  forgotPasswordButton: {
    paddingVertical: 8,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: UI_CONFIG.PRIMARY_COLOR,
    fontWeight: '500',
  },
  loginButton: {
    marginTop: 24,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 32,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: UI_CONFIG.BORDER_COLOR,
  },
  dividerText: {
    fontSize: 14,
    color: UI_CONFIG.TEXT_SECONDARY,
    paddingHorizontal: 16,
  },
  registerButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  registerText: {
    fontSize: 16,
    color: UI_CONFIG.TEXT_SECONDARY,
    textAlign: 'center',
  },
  registerLinkText: {
    color: UI_CONFIG.PRIMARY_COLOR,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  versionText: {
    fontSize: 12,
    color: UI_CONFIG.TEXT_SECONDARY,
  },
});

export default LoginScreen;