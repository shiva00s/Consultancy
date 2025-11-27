import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, TextInput, TouchableOpacity, Alert } from 'react-native';
import DocumentPicker, { types } from 'react-native-document-picker';
//import { v4 as uuidv4 } from 'uuid';

// FIX: Use the '~' alias for safer imports (configured in babel/tsconfig)
import api, { put } from '../../src/services/api';
import { useOfflineStore, OfflineStoreState } from '../../src/store/offlineStore';

interface CandidateDetails {
  name: string;
  status: string;
  passportNo: string;
  contact: string;
  [key: string]: any; 
}

// CRITICAL: This must be 'export default'
export default function CandidateDetailScreen() {
  const { id } = useLocalSearchParams(); 
  //const router = useRouter(); 
  const [candidate, setCandidate] = useState<CandidateDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState(false); 
  const [formData, setFormData] = useState<CandidateDetails | null>(null);

  const networkStatus = useOfflineStore((state: OfflineStoreState) => state.networkStatus);
  const addToQueue = useOfflineStore((state: OfflineStoreState) => state.addToQueue);
  const syncQueue = useOfflineStore((state: OfflineStoreState) => state.syncQueue);
  
  const fetchDetails = useCallback(async () => { 
    setLoading(true);
    const candidateId = id as string;
    
    const pendingUpdate = syncQueue.find((r: any) => r.endpoint.includes(candidateId) && r.method === 'PUT');
    const isPendingDelete = syncQueue.find((r: any) => r.endpoint.includes(candidateId) && r.method === 'DELETE');
    
    if (isPendingDelete) {
        setLoading(false);
        return Alert.alert("Record Deleted", "This candidate is marked for deletion.");
    }
    
    try {
      const res = await api.get(`/candidates/${candidateId}`);
      if (res.data.success) {
        const serverCandidate = res.data.data.candidate;
        setCandidate(serverCandidate);
        setFormData(serverCandidate);
      } else {
        throw new Error("Server: Candidate record not found.");
      }
    } catch (error: any) {
      console.log("Fetch Error (Offline fallback):", error.message);
      
      if (pendingUpdate) {
          setCandidate(pendingUpdate.payload as CandidateDetails);
          setFormData(pendingUpdate.payload as CandidateDetails);
          Alert.alert("Offline View", "Showing locally queued version.");
      } else {
          Alert.alert("Data Unavailable", "Could not fetch candidate details.");
      }
    } finally {
      setLoading(false);
    }
  }, [id, syncQueue]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]); 

  const handleFormChange = (key: keyof CandidateDetails, value: string) => {
    setFormData((prev) => (prev ? { ...prev, [key]: value } : null));
  };
  
  const handleSave = async () => {
    if (!formData || !formData.name || !formData.passportNo) {
        Alert.alert("Validation", "Name and Passport are required.");
        return;
    }
    setLoading(true);
    const payload = { ...formData, candidate_id: id };
    
    try {
        if (networkStatus === 'online') {
            const res = await put(`/candidates/${id}`, payload);
            if (res.data.success) {
                setCandidate(res.data.data);
                setIsEditing(false);
                Alert.alert("Success", "Candidate updated.");
            } else {
                throw new Error(res.data.error);
            }
        } else {
            const localId = `update-${id}`;
            addToQueue({
                localId: localId,
                payload: payload,
                endpoint: `/candidates/${id}`,
                method: 'PUT',
            });
            setCandidate(formData); 
            setIsEditing(false);
            Alert.alert("Offline Save", "Changes queued for sync.");
        }
    } catch (error: any) {
        Alert.alert("Error", error.message || "Failed to save.");
    } finally {
        setLoading(false);
    }
  };

  const handleDocumentUpload = async () => {
    if (networkStatus !== 'online') {
        Alert.alert("Offline", "Uploads require active connection.");
        return;
    }

    setUploading(true);
    try {
      const result = await DocumentPicker.pickSingle({
        type: [types.pdf, types.images, types.plainText],
      });

      if (!result.uri) return; 

      const uploadData = new FormData();
      uploadData.append('document', { uri: result.uri, name: result.name || 'doc.pdf', type: result.type || 'application/pdf', } as any); 
      uploadData.append('category', 'Uncategorized'); 
      
      const response = await api.post(`/documents/${id}`, uploadData, { headers: { 'Content-Type': 'multipart/form-data', }, });

      if (response.data.success) {
        Alert.alert("Success", `Document uploaded!`);
      } else {
        Alert.alert("Failed", response.data.error);
      }
    } catch (err: any) {
      if (!DocumentPicker.isCancel(err)) {
        Alert.alert("Error", err.message);
      }
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <ActivityIndicator size="large" color="#007bff" style={styles.loading} />;
  if (!candidate) return <Text style={styles.errorText}>Candidate not found</Text>;

  const displayData = isEditing ? formData : candidate;

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen 
        options={{ 
            title: candidate?.name || 'Details',
            headerRight: () => (
                <TouchableOpacity onPress={() => setIsEditing(!isEditing)} style={styles.headerButton}>
                    <Text style={styles.headerButtonText}>{isEditing ? 'Cancel' : 'Edit'}</Text>
                </TouchableOpacity>
            )
        }} 
      />

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Profile Details</Text>
        
        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={displayData?.name || ''} onChangeText={(t) => handleFormChange('name', t)} editable={isEditing} />
        
        <Text style={styles.label}>Passport</Text>
        <TextInput style={styles.input} value={displayData?.passportNo || ''} onChangeText={(t) => handleFormChange('passportNo', t)} editable={isEditing} />

        {isEditing && (
            <TouchableOpacity style={styles.btn} onPress={handleSave} disabled={loading}>
                <Text style={styles.btnText}>Save Changes</Text>
            </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.documentSection}>
          <Text style={styles.sectionTitle}>Documents</Text>
          <TouchableOpacity 
              style={styles.uploadBtn} 
              onPress={handleDocumentUpload} 
              disabled={uploading}
          >
              {uploading ? <ActivityIndicator color="#fff"/> : <Text style={styles.btnText}>Upload Document</Text>}
          </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f2f5', padding: 15 },
    loading: { flex: 1, marginTop: 50 },
    errorText: { padding: 20, textAlign: 'center', color: '#dc3545' },
    headerButton: { paddingHorizontal: 10 },
    headerButtonText: { color: '#007bff', fontSize: 16, fontWeight: '600' },
    card: { backgroundColor: '#fff', padding: 20, borderRadius: 10, marginBottom: 20 },
    label: { fontSize: 14, color: '#666', marginTop: 10, marginBottom: 5 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#333' },
    input: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, fontSize: 16 },
    btn: { backgroundColor: '#007bff', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 30 },
    btnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    documentSection: { backgroundColor: '#fff', padding: 20, borderRadius: 10, marginBottom: 20 },
    uploadBtn: { backgroundColor: '#10b981', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
});