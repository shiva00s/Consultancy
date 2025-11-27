// src/store/offlineStore.ts
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { persist, createJSONStorage } from "zustand/middleware";

interface CandidateQueue {
  localId: string;
  payload: any;
  endpoint: string;
  method: "POST" | "PUT" | "DELETE";
}

export interface OfflineStoreState {
  networkStatus: "online" | "offline" | "pending";
  syncQueue: CandidateQueue[];

  setNetworkStatus: (status: "online" | "offline" | "pending") => void;
  addToQueue: (record: CandidateQueue) => void;
  clearQueue: (localIds: string[]) => void;
}

export const useOfflineStore = create<OfflineStoreState>()(
  persist(
    (set, get) => ({
      networkStatus: "pending",
      syncQueue: [],

      setNetworkStatus: (status) => set(() => ({ networkStatus: status })),

      addToQueue: (record) =>
        set((state) => ({
          syncQueue: [...state.syncQueue, record],
        })),

      clearQueue: (localIds) =>
        set((state) => ({
          syncQueue: state.syncQueue.filter(
            (record) => !localIds.includes(record.localId)
          ),
        })),
    }),
    {
      name: "offline-sync-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
