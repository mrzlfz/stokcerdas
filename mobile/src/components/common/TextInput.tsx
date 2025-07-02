/**
 * Custom TextInput Component
 * Reusable text input dengan styling dan validation
 */

import React, { forwardRef } from 'react';
import {
  View,
  Text,
  TextInput as RNTextInput,
  TextInputProps as RNTextInputProps,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { UI_CONFIG } from '@/constants/config';

interface TextInputProps extends RNTextInputProps {
  label?: string;
  error?: string;
  leftIcon?: string;
  rightIcon?: string;
  onRightIconPress?: () => void;
  containerStyle?: any;
  inputStyle?: any;
  helperText?: string;
  required?: boolean;
}

const TextInput = forwardRef<RNTextInput, TextInputProps>(
  (
    {
      label,
      error,
      leftIcon,
      rightIcon,
      onRightIconPress,
      containerStyle,
      inputStyle,
      helperText,
      required = false,
      ...props
    },
    ref
  ) => {
    const hasError = !!error;
    const hasLeftIcon = !!leftIcon;
    const hasRightIcon = !!rightIcon;

    return (
      <View style={[styles.container, containerStyle]}>
        {/* Label */}
        {label && (
          <Text style={styles.label}>
            {label}
            {required && <Text style={styles.required}> *</Text>}
          </Text>
        )}

        {/* Input Container */}
        <View style={[
          styles.inputContainer,
          hasError && styles.inputContainerError,
          props.editable === false && styles.inputContainerDisabled,
        ]}>
          {/* Left Icon */}
          {hasLeftIcon && (
            <View style={styles.leftIconContainer}>
              <Icon
                name={leftIcon}
                size={20}
                color={hasError ? UI_CONFIG.ERROR_COLOR : UI_CONFIG.TEXT_SECONDARY}
              />
            </View>
          )}

          {/* Text Input */}
          <RNTextInput
            ref={ref}
            style={[
              styles.input,
              hasLeftIcon && styles.inputWithLeftIcon,
              hasRightIcon && styles.inputWithRightIcon,
              inputStyle,
            ]}
            placeholderTextColor={UI_CONFIG.TEXT_SECONDARY}
            selectionColor={UI_CONFIG.PRIMARY_COLOR}
            {...props}
          />

          {/* Right Icon */}
          {hasRightIcon && (
            <TouchableOpacity
              style={styles.rightIconContainer}
              onPress={onRightIconPress}
              disabled={!onRightIconPress}
            >
              <Icon
                name={rightIcon}
                size={20}
                color={hasError ? UI_CONFIG.ERROR_COLOR : UI_CONFIG.TEXT_SECONDARY}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Error Message */}
        {hasError && (
          <Text style={styles.errorText}>{error}</Text>
        )}

        {/* Helper Text */}
        {helperText && !hasError && (
          <Text style={styles.helperText}>{helperText}</Text>
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: UI_CONFIG.TEXT_PRIMARY,
    marginBottom: 8,
  },
  required: {
    color: UI_CONFIG.ERROR_COLOR,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: UI_CONFIG.BORDER_COLOR,
    borderRadius: 8,
    backgroundColor: UI_CONFIG.SURFACE_COLOR,
    minHeight: 48,
  },
  inputContainerError: {
    borderColor: UI_CONFIG.ERROR_COLOR,
  },
  inputContainerDisabled: {
    backgroundColor: '#F5F5F5',
    opacity: 0.6,
  },
  leftIconContainer: {
    paddingLeft: 12,
    paddingRight: 8,
  },
  rightIconContainer: {
    paddingLeft: 8,
    paddingRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: UI_CONFIG.TEXT_PRIMARY,
    paddingVertical: 12,
    paddingHorizontal: 12,
    textAlignVertical: 'center',
  },
  inputWithLeftIcon: {
    paddingLeft: 0,
  },
  inputWithRightIcon: {
    paddingRight: 0,
  },
  errorText: {
    fontSize: 12,
    color: UI_CONFIG.ERROR_COLOR,
    marginTop: 4,
    marginLeft: 4,
  },
  helperText: {
    fontSize: 12,
    color: UI_CONFIG.TEXT_SECONDARY,
    marginTop: 4,
    marginLeft: 4,
  },
});

TextInput.displayName = 'TextInput';

export default TextInput;