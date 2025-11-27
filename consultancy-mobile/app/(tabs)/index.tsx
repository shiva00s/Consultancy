import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import api from '../../src/services/api';
import * as SecureStore from 'expo-secure-store';
import { SyncEngine } from '../../src/services/syncEngine';
import NetInfo from '@react-native-community/netinfo';
import { useOfflineStore } from '../../src/store/offlineStore';

// CandidateList child component (unchanged behavior)
const CandidateList = ({ candidates, refreshing, onRefresh }: { candidates: any[]; refreshing: boolean; onRefresh: () => void }) => {
  const router = useRouter();

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'New': return styles.badgeNew;
      case 'Completed': return styles.badgeGreen;
      default: return styles.badgeOther;
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => {
        router.push(`/candidate/${item.server_id}` as any);
      }}
    >
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.name}>{item.name}</Text>
          <View style={[styles.badge, getStatusStyle(item.status)]}>
            <Text style={styles.badgeText}>{item.status}</Text>
          </View>
        </View>
        <Text style={styles.detail}>Passport: {item.passportNo}</Text>
        <Text style={styles.detail}>Status: {item.status}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appHeader}>
        <Text style={styles.headerTitle}>Candidates (Offline Mode)</Text>
        <Text style={styles.subHeader}>
          Data Source: Local DB / Last Sync: {candidates[0] ? new Date(candidates[0].lastModified || 0).toLocaleTimeString() : 'N/A'}
        </Text>
      </View>
      <FlatList
        data={candidates}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.emptyText}>No candidates found locally. Pull down to sync.</Text>}
      />
    </SafeAreaView>
  );
};


// Hook: network listener + safe sync trigger (NO subscriptions to syncQueue)
const useNetworkAndSync = () => {
  // Only subscribe to setNetworkStatus (stable function) to avoid snapshot cache problems.
  const setNetworkStatus = useOfflineStore((s) => s.setNetworkStatus);

  useEffect(() => {
    const handleState = (state: any) => {
      // isInternetReachable can be null on some platforms; treat null as true-ish only when connected is true.
      const isConnected = !!state.isConnected && (state.isInternetReachable !== false);
      const status = isConnected ? 'online' : 'offline';
      setNetworkStatus(status);

      if (isConnected) {
        // Read queue length directly from store WITHOUT creating a React subscription
        const currentQueue = useOfflineStore.getState().syncQueue;
        if (currentQueue && currentQueue.length > 0) {
          // Fire-and-forget; SyncEngine handles its own errors and sets network state accordingly
          SyncEngine.processQueue().catch((err) => {
            // In the unlikely event of an unhandled rejection, mark offline to prevent tight loop of retries
            console.error("SyncEngine.processQueue() uncaught error:", err);
            setNetworkStatus('offline');
          });
        }
      }
    };

    // Subscribe to network changes
    const unsubscribe = NetInfo.addEventListener(handleState);

    // Do an initial check
    NetInfo.fetch().then(handleState).catch((err) => {
      console.warn("NetInfo.fetch failed:", err);
      setNetworkStatus('offline');
    });

    return () => {
      unsubscribe();
    };
    // Intentionally empty deps array: we intentionally do not depend on syncQueue (avoids re-running on store changes)
  }, [setNetworkStatus]);
};


export default function CandidateListContainer() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [candidates, setCandidates] = useState<any[]>([]);

  // Start network monitoring and automatic sync (safe)
  useNetworkAndSync();

  // Full sync function - robust handling for network errors (sets offline status on failure)
  const runFullSync = async () => {
    setRefreshing(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) {
        throw new Error("User not logged in.");
      }

      // Attempt server fetch
      const response = await api.get('/candidates');
      const serverCandidates = response?.data?.data ?? [];

      // Do whatever you need with serverCandidates; for now we set local state to display
      // (In production you'd also update local DB)
      setCandidates(serverCandidates);
      // If successful, ensure network state is online
      useOfflineStore.getState().setNetworkStatus('online');
    } catch (error: any) {
      console.error("Sync Failed:", error?.message ?? error);
      // Mark offline so other parts of app know
      useOfflineStore.getState().setNetworkStatus('offline');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Run initial sync on mount
  useEffect(() => {
    runFullSync();
   
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={{ marginTop: 10 }}>Loading candidates...</Text>
      </View>
    );
  }

  return (
    <CandidateList candidates={candidates} refreshing={refreshing} onRefresh={runFullSync} />
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  appHeader: { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee', paddingTop: 40 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  subHeader: { fontSize: 12, color: '#666', marginTop: 5 },
  list: { padding: 15 },
  card: { backgroundColor: '#fff', padding: 15, marginBottom: 10, borderRadius: 8, elevation: 2, shadowColor:'#000', shadowOpacity:0.1, shadowRadius:4 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  name: { fontSize: 18, fontWeight: 'bold' },
  detail: { fontSize: 14, color: '#555', marginBottom: 4 },
  badge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4 },
  badgeNew: { backgroundColor: '#007bff' },
  badgeGreen: { backgroundColor: '#10b981' },
  badgeOther: { backgroundColor: '#6c757d' },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', marginTop: 50, color: '#777' }
});
