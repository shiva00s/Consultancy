import axios from 'axios';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { API_URL } from './src/config';

export default function App() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCandidates = async () => {
    try {
      // Connects to your PC Server
      const response = await axios.get(`${API_URL}/candidates`);
      if (response.data.success) {
        setCandidates(response.data.data);
      }
    } catch (error) {
      console.error("Connection Error:", error);
      alert("Could not connect to PC Server. Check IP or Wi-Fi.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCandidates();
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={[styles.badge, item.status === 'New' ? styles.badgeNew : styles.badgeOther]}>
          {item.status}
        </Text>
      </View>
      <Text style={styles.detail}>Passport: {item.passportNo}</Text>
      <Text style={styles.detail}>Position: {item.Position || 'N/A'}</Text>
      <Text style={styles.detail}>Contact: {item.contact || 'N/A'}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appHeader}>
        <Text style={styles.headerTitle}>Consultancy Mobile</Text>
        <Text style={styles.subHeader}>Connected to: {API_URL}</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#007bff" style={{marginTop: 50}} />
      ) : (
        <FlatList
          data={candidates}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>No candidates found.</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  appHeader: { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee', paddingTop: 50 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  subHeader: { fontSize: 12, color: 'green', marginTop: 5 },
  list: { padding: 15 },
  card: { backgroundColor: '#fff', padding: 15, marginBottom: 10, borderRadius: 8, elevation: 2, shadowColor:'#000', shadowOpacity:0.1, shadowRadius:4 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  name: { fontSize: 18, fontWeight: 'bold' },
  detail: { fontSize: 14, color: '#555', marginBottom: 2 },
  badge: { fontSize: 12, paddingVertical: 2, paddingHorizontal: 8, borderRadius: 10, overflow: 'hidden', color: '#fff' },
  badgeNew: { backgroundColor: '#007bff' },
  badgeOther: { backgroundColor: '#6c757d' },
  emptyText: { textAlign: 'center', marginTop: 50, color: '#777' }
});