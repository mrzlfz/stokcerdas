/**
 * Custom Button Component
 * Reusable button dengan berbagai variant dan state
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  TouchableOpacityProps,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { UI_CONFIG } from '@/constants/config';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'text';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: string;
  rightIcon?: string;
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  fullWidth = true,
  style,
  ...props
}) => {
  const isDisabled = disabled || loading;

  const getButtonStyle = () => {
    const baseStyle = [styles.button, styles[`button_${size}`]];
    
    if (fullWidth) {
      baseStyle.push(styles.fullWidth);
    }

    switch (variant) {
      case 'primary':
        baseStyle.push(styles.primaryButton);
        if (isDisabled) baseStyle.push(styles.primaryButtonDisabled);
        break;
      case 'secondary':
        baseStyle.push(styles.secondaryButton);
        if (isDisabled) baseStyle.push(styles.secondaryButtonDisabled);
        break;
      case 'outline':
        baseStyle.push(styles.outlineButton);
        if (isDisabled) baseStyle.push(styles.outlineButtonDisabled);
        break;
      case 'text':
        baseStyle.push(styles.textButton);
        if (isDisabled) baseStyle.push(styles.textButtonDisabled);
        break;
    }

    return baseStyle;
  };

  const getTextStyle = () => {
    const baseStyle = [styles.text, styles[`text_${size}`]];

    switch (variant) {
      case 'primary':
        baseStyle.push(styles.primaryText);
        break;
      case 'secondary':
        baseStyle.push(styles.secondaryText);
        break;
      case 'outline':
        baseStyle.push(styles.outlineText);
        if (isDisabled) baseStyle.push(styles.outlineTextDisabled);
        break;
      case 'text':
        baseStyle.push(styles.textButtonText);
        if (isDisabled) baseStyle.push(styles.textButtonTextDisabled);
        break;
    }

    return baseStyle;
  };

  const getIconSize = () => {
    switch (size) {
      case 'small':
        return 16;
      case 'medium':
        return 18;
      case 'large':
        return 20;
      default:
        return 18;
    }
  };

  const getIconColor = () => {
    if (isDisabled) {
      return variant === 'primary' || variant === 'secondary' 
        ? 'rgba(255, 255, 255, 0.5)' 
        : UI_CONFIG.TEXT_SECONDARY;
    }

    switch (variant) {
      case 'primary':
      case 'secondary':
        return '#FFFFFF';
      case 'outline':
        return UI_CONFIG.PRIMARY_COLOR;
      case 'text':
        return UI_CONFIG.PRIMARY_COLOR;
      default:
        return '#FFFFFF';
    }
  };

  return (
    <TouchableOpacity
      style={[getButtonStyle(), style]}
      disabled={isDisabled}
      activeOpacity={0.7}
      {...props}
    >
      <View style={styles.content}>
        {/* Left Icon */}
        {leftIcon && !loading && (
          <Icon
            name={leftIcon}
            size={getIconSize()}
            color={getIconColor()}
            style={styles.leftIcon}
          />
        )}

        {/* Loading Indicator */}
        {loading && (
          <ActivityIndicator
            size="small"
            color={getIconColor()}
            style={styles.leftIcon}
          />
        )}

        {/* Button Text */}
        <Text style={getTextStyle()}>
          {title}
        </Text>

        {/* Right Icon */}
        {rightIcon && !loading && (
          <Icon
            name={rightIcon}
            size={getIconSize()}
            color={getIconColor()}
            style={styles.rightIcon}
          />
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  fullWidth: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Size variants
  button_small: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    minHeight: 36,
  },
  button_medium: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    minHeight: 48,
  },
  button_large: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    minHeight: 56,
  },

  // Button variants
  primaryButton: {
    backgroundColor: UI_CONFIG.PRIMARY_COLOR,
    shadowColor: UI_CONFIG.PRIMARY_COLOR,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  primaryButtonDisabled: {
    backgroundColor: UI_CONFIG.TEXT_SECONDARY,
    shadowOpacity: 0,
    elevation: 0,
  },
  
  secondaryButton: {
    backgroundColor: UI_CONFIG.ACCENT_COLOR,
    shadowColor: UI_CONFIG.ACCENT_COLOR,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  secondaryButtonDisabled: {
    backgroundColor: UI_CONFIG.TEXT_SECONDARY,
    shadowOpacity: 0,
    elevation: 0,
  },

  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: UI_CONFIG.PRIMARY_COLOR,
  },
  outlineButtonDisabled: {
    borderColor: UI_CONFIG.TEXT_SECONDARY,
  },

  textButton: {
    backgroundColor: 'transparent',
  },
  textButtonDisabled: {
    backgroundColor: 'transparent',
  },

  // Text styles
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
  text_small: {
    fontSize: 14,
  },
  text_medium: {
    fontSize: 16,
  },
  text_large: {
    fontSize: 18,
  },

  primaryText: {
    color: '#FFFFFF',
  },
  secondaryText: {
    color: '#FFFFFF',
  },
  outlineText: {
    color: UI_CONFIG.PRIMARY_COLOR,
  },
  outlineTextDisabled: {
    color: UI_CONFIG.TEXT_SECONDARY,
  },
  textButtonText: {
    color: UI_CONFIG.PRIMARY_COLOR,
  },
  textButtonTextDisabled: {
    color: UI_CONFIG.TEXT_SECONDARY,
  },

  // Icon styles
  leftIcon: {
    marginRight: 8,
  },
  rightIcon: {
    marginLeft: 8,
  },
});

export default Button;