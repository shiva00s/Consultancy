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
                    // FIX: use exported 'put' instead of 'api.put'
                    response = await put(record.endpoint, record.payload);

                } else if (record.method === "DELETE") {
                    // FIX: use exported 'del'
                    response = await del(record.endpoint);

                } else {
                    continue;
                }

                if (response?.data?.success) {
                    console.log("Synced:", record.localId);
                    successful.push(record.localId);
                } else {
                    console.log("Server rejected:", record.localId);
                    break;
                }
            } catch {
                // FIX: removed unused "err" variable
                console.log("Network failure. Stopping sync.");
                setNetworkStatus("offline");
                return;
            }
        }

        if (successful.length > 0) {
            clearQueue(successful);
        }

        const remaining = useOfflineStore.getState().syncQueue.length;
        setNetworkStatus(remaining === 0 ? "online" : "offline");

        console.log("SyncEngine complete.");
    }
};