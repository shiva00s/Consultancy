// src/services/syncEngine.ts
import { useOfflineStore } from "../store/offlineStore";
import api, { put, del } from "./api";

export const SyncEngine = {
    async processQueue() {
        const { syncQueue, clearQueue, setNetworkStatus } = useOfflineStore.getState();

        if (syncQueue.length === 0) {
            console.log("SyncEngine: Queue empty.");
            return;
        }

        console.log(`SyncEngine: Processing ${syncQueue.length} items...`);
        setNetworkStatus("pending");

        const successful: string[] = [];

        for (const record of syncQueue) {
            try {
                let response;

                if (record.method === "POST") {
                    response = await api.post(record.endpoint, record.payload);
                } else if (record.method === "PUT") {
                    response = await put(record.endpoint, record.payload);
                } else if (record.method === "DELETE") {
                    response = await del(record.endpoint);
                } else {
                    // Skip invalid methods but don't stop the loop
                    continue;
                }

                if (response?.data?.success) {
                    console.log("Synced:", record.localId);
                    successful.push(record.localId);
                } else {
                    console.error("Server rejected record:", record.localId, response?.data?.error);
                    // CRITICAL FIX: Do NOT break. Continue to try the next record.
                    // We only want to stop if the network itself is down.
                }
            } catch (error: any) {
                // Check if it's a network error (no response) or a server error (4xx/5xx)
                if (!error.response) {
                    console.log("Network failure detected. Stopping sync.");
                    setNetworkStatus("offline");
                    // Stop processing only on genuine network failure
                    break;
                } else {
                    console.error("Sync Error (Server Side) for:", record.localId, error.message);
                    // If it's a server error (e.g. 500), we skip this item and try the next one
                }
            }
        }

        // Remove only the successfully synced items from the queue
        if (successful.length > 0) {
            clearQueue(successful);
        }

        const remaining = useOfflineStore.getState().syncQueue.length;
        setNetworkStatus(remaining === 0 ? "online" : "offline");

        console.log(`SyncEngine complete. Cleared ${successful.length} items.`);
    }
};