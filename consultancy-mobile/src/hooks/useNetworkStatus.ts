import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useOfflineStore } from '../store/offlineStore'; // Corrected path/casing

export const useNetworkStatus = () => {
    // Explicitly type the selector callback parameter
    const setNetworkStatus = useOfflineStore((state: any) => state.setNetworkStatus); 
    
    useEffect(() => {
        // Fix implicit 'any' on state listener callback
        const unsubscribe = NetInfo.addEventListener((state: any) => { 
            const isConnected = state.isConnected && state.isInternetReachable;
            setNetworkStatus(isConnected ? 'online' : 'offline');
        });

        // Add setNetworkStatus to dependency array to satisfy exhaustive-deps linter
        return () => unsubscribe();
    }, [setNetworkStatus]); 
};