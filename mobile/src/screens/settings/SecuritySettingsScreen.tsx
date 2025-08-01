/**
 * Security Settings Screen Component
 * Placeholder untuk security settings
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UI_CONFIG } from '@/constants/config';

const SecuritySettingsScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Security Settings</Text>
        <Text style={styles.subtitle}>
          Pengaturan keamanan akan diimplementasikan di sini
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI_CONFIG.BACKGROUND_COLOR,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: UI_CONFIG.TEXT_PRIMARY,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: UI_CONFIG.TEXT_SECONDARY,
    textAlign: 'center',
  },
});

export default SecuritySettingsScreen;