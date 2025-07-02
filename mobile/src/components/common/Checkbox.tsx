/**
 * Custom Checkbox Component
 * Reusable checkbox dengan styling custom
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { UI_CONFIG } from '@/constants/config';

interface CheckboxProps {
  checked: boolean;
  onPress: () => void;
  label?: string;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  color?: string;
  style?: any;
  labelStyle?: any;
}

const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onPress,
  label,
  disabled = false,
  size = 'medium',
  color = UI_CONFIG.PRIMARY_COLOR,
  style,
  labelStyle,
}) => {
  const getCheckboxSize = () => {
    switch (size) {
      case 'small':
        return 18;
      case 'medium':
        return 20;
      case 'large':
        return 24;
      default:
        return 20;
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'small':
        return 14;
      case 'medium':
        return 16;
      case 'large':
        return 18;
      default:
        return 16;
    }
  };

  const checkboxSize = getCheckboxSize();
  const iconSize = getIconSize();

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.checkbox,
          {
            width: checkboxSize,
            height: checkboxSize,
          },
          checked && styles.checkedCheckbox,
          checked && { backgroundColor: color, borderColor: color },
          disabled && styles.disabledCheckbox,
        ]}
      >
        {checked && (
          <Icon
            name="check"
            size={iconSize}
            color="#FFFFFF"
          />
        )}
      </View>

      {label && (
        <Text
          style={[
            styles.label,
            disabled && styles.disabledLabel,
            labelStyle,
          ]}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    borderWidth: 2,
    borderColor: UI_CONFIG.BORDER_COLOR,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: UI_CONFIG.SURFACE_COLOR,
  },
  checkedCheckbox: {
    backgroundColor: UI_CONFIG.PRIMARY_COLOR,
    borderColor: UI_CONFIG.PRIMARY_COLOR,
  },
  disabledCheckbox: {
    backgroundColor: '#F5F5F5',
    borderColor: UI_CONFIG.TEXT_SECONDARY,
    opacity: 0.6,
  },
  label: {
    fontSize: 14,
    color: UI_CONFIG.TEXT_PRIMARY,
    marginLeft: 8,
    flex: 1,
  },
  disabledLabel: {
    color: UI_CONFIG.TEXT_SECONDARY,
    opacity: 0.6,
  },
});

export default Checkbox;