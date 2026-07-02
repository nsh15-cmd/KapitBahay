// src/lib/useMeshPresence.ts
import { useEffect, useState } from "react";
import { syncEventEmitter } from "./syncEngine";

export function useMeshPresence() {
    const [peerCount, setPeerCount] = useState(0);

    useEffect(() => {
        const handlePresenceUpdate = (event: Event) => {
            const customEvent = event as CustomEvent<{ count: number }>;
            setPeerCount(customEvent.detail.count);
        };

        syncEventEmitter.addEventListener('mesh-presence-update', handlePresenceUpdate);

        return () => {
            syncEventEmitter.removeEventListener('mesh-presence-update', handlePresenceUpdate);
        };
    }, []);

    return peerCount;
}