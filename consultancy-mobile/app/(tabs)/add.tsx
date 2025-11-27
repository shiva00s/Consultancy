import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../src/services/api';
import { useOfflineStore } from '../../src/store/offlineStore'; // <--- NEW IMPORT
import { v4 as uuidv4 } from 'uuid'; // Need to install uuid if not present: npm install uuid

export default function AddCandidateScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const networkStatus = useOfflineStore(state => state.networkStatus);
    const addToQueue = useOfflineStore(state => state.addToQueue);


  const [form, setForm] = useState({
    name: '',
    passportNo: '',
    contact: '',
    Position: '',
    status: 'New',
    notes: 'Added via Mobile App'
  });

  const handleChange = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
        if (!form.name || !form.passportNo) {
            Alert.alert("Validation Error", "Name and Passport Number are required.");
            return;
        }

        setLoading(true);
        const localId = uuidv4(); // Generate a unique ID for the queue
        
        try {
            if (networkStatus === 'online') {
                // --- A. ONLINE MODE: Attempt immediate sync ---
                const res = await api.post('/candidates', form);
                
                if (res.data.success) {
                    Alert.alert("Success", "Candidate added and synced successfully!");
                    router.push("/(tabs)"); 
                } else {
                    throw new Error(res.data.error || "Server failed to save.");
                }

            } else {
                // --- B. OFFLINE MODE: Queue for later sync ---
                addToQueue({
                    localId: localId,
                    payload: form,
                    endpoint: '/candidates',
                    method: 'POST',
                });
                
                Alert.alert("Offline Success", "Candidate saved locally and will sync when you connect to the network.");
                router.push("/(tabs)"); 
            }
        } catch (error: any) {
            console.error(error);
            // Handle errors for immediate online attempts
            Alert.alert("Error", error.message || "Could not reach PC Server.");
        } finally {
            setLoading(false);
        }
    };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Add New Candidate</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Full Name *</Text>
        <TextInput 
            style={styles.input} 
            value={form.name} 
            onChangeText={(t) => handleChange('name', t)} 
            placeholder="Enter Name" 
        />

        <Text style={styles.label}>Passport Number *</Text>
        <TextInput 
            style={styles.input} 
            value={form.passportNo} 
            onChangeText={(t) => handleChange('passportNo', t)} 
            placeholder="X1234567" 
            autoCapitalize="characters"
        />

        <Text style={styles.label}>Position</Text>
        <TextInput 
            style={styles.input} 
            value={form.Position} 
            onChangeText={(t) => handleChange('Position', t)} 
            placeholder="e.g. Welder" 
        />

        <Text style={styles.label}>Contact Number</Text>
        <TextInput 
            style={styles.input} 
            value={form.contact} 
            onChangeText={(t) => handleChange('contact', t)} 
            placeholder="9876543210" 
            keyboardType="phone-pad"
        />

        <TouchableOpacity 
            style={[styles.btn, loading && styles.btnDisabled]} 
            onPress={handleSubmit}
            disabled={loading}
        >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save Candidate</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f2f5' },
  header: { padding: 20, backgroundColor: '#fff', paddingTop: 50, borderBottomWidth: 1, borderColor: '#eee' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  form: { padding: 20 },
  label: { fontSize: 14, color: '#555', marginBottom: 5, marginTop: 10, fontWeight: '600' },
  input: { backgroundColor: '#fff', padding: 15, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', fontSize: 16 },
  btn: { backgroundColor: '#007bff', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 30 },
  btnDisabled: { backgroundColor: '#b3d7ff' },
  btnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});