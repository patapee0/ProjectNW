/**
 * MainNavigator — Tab + Stack Navigation
 * ถ้ายังไม่มี profile → แสดง RegisterScreen
 * ถ้ามี profile แล้ว → แสดง Tab Navigator (Explore, Matches, Profile)
 */
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, View, StyleSheet, Platform } from 'react-native';

import { useApp } from '../context/AppContext';
import { COLORS } from '../constants/colors';

import ExploreScreen from '../screens/ExploreScreen';
import MatchesScreen from '../screens/MatchesScreen';
import ChatScreen from '../screens/ChatScreen';
import ProfileScreen from '../screens/ProfileScreen';
import RegisterScreen from '../screens/RegisterScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Tab icon component
function TabIcon({ icon, label, focused, badgeCount }) {
  return (
    <View style={styles.tabIconContainer}>
      <Text style={[styles.tabIcon, focused && styles.tabIconActive]}>{icon}</Text>
      {badgeCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeCount}</Text>
        </View>
      )}
      {focused && <View style={styles.tabDot} />}
    </View>
  );
}

// Matches Stack (includes ChatScreen)
function MatchesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MatchesList" component={MatchesScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
    </Stack.Navigator>
  );
}

// Main Tab Navigator
function MainTabs() {
  const { matches } = useApp();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="Explore"
        component={ExploreScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="🔥" label="สำรวจ" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Matches"
        component={MatchesStack}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="💬" label="แชท" focused={focused} badgeCount={matches.length} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="👤" label="โปรไฟล์" focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Root Navigator — checks if user has profile
export default function MainNavigator() {
  const { myProfile, isLoading } = useApp();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingIcon}>💖</Text>
        <Text style={styles.loadingText}>KKU Dating</Text>
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {myProfile ? (
        <Stack.Screen name="MainTabs" component={MainTabs} />
      ) : (
        <Stack.Screen name="Register" component={RegisterScreen} />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    height: Platform.OS === 'ios' ? 78 : 65,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    paddingTop: 8,
  },
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabIcon: { fontSize: 22, opacity: 0.5 },
  tabIconActive: { opacity: 1 },
  tabDot: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: COLORS.accentGold,
    marginTop: 4,
  },
  badge: {
    position: 'absolute', top: -4, right: -10,
    backgroundColor: COLORS.primaryKKU,
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.bgDark,
  },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: '700' },
  loadingContainer: {
    flex: 1, backgroundColor: COLORS.bgDark,
    alignItems: 'center', justifyContent: 'center',
  },
  loadingIcon: { fontSize: 48, marginBottom: 16 },
  loadingText: {
    fontSize: 24, fontWeight: '700',
    color: COLORS.accentGold,
  },
});
