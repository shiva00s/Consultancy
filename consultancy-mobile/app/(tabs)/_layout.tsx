import { Stack, useRouter, Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; 
// Note: Removed unused useRouter import

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: Platform.select({
          ios: { position: 'absolute' },
          default: {},
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Candidates',
          tabBarIcon: ({ color }: { color: string }) => <Ionicons name="people" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Add New',
          tabBarIcon: ({ color }: { color: string }) => <Ionicons name="add-circle" size={28} color={color} />,
        }}
      />
    </Tabs>
  );
}