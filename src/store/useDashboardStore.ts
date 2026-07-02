// C:\Users\Renz Jericho Buday\KapitBahay\src\store\useDashboardStore.ts
import { create } from 'zustand';
import { collection, onSnapshot, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type ReportStatus = 'pending' | 'verified' | 'resolved' | 'on_the_way';

export interface DashboardReport {
  id: string;
  type: 'hazard' | 'resource';
  description: string;
  location: { lat: number; lng: number };
  timestamp: number;
  status: ReportStatus;
}

interface DashboardState {
  reports: DashboardReport[];
  filter: 'all' | 'hazard' | 'resource';
  setFilter: (filter: 'all' | 'hazard' | 'resource') => void;
  updateReportStatus: (id: string, status: ReportStatus) => Promise<void>;
  startLiveStream: () => () => void; // Returns an unsubscribe function
}

export const useDashboardStore = create<DashboardState>((set) => ({
  reports: [],
  filter: 'all',
  setFilter: (filter) => set({ filter }),

  // Now updates both the local UI and the actual Firebase Database
  updateReportStatus: async (id, status) => {
    // 1. Optimistic UI update (feels instant to the user)
    set((state) => ({
      reports: state.reports.map((report) =>
        report.id === id ? { ...report, status } : report
      )
    }));

    // 2. Push the status change to the cloud
    try {
      const reportRef = doc(db, 'reports', id);
      await updateDoc(reportRef, { status });
    } catch (error) {
      console.error("Error updating report status in Firestore:", error);
    }
  },

  // Replaces the old 'loadMockData' with a live database hook
  startLiveStream: () => {
    // Query reports, showing the newest ones first
    const q = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const liveReports: DashboardReport[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Ensure we only grab valid reports with coordinates
        if (data.location && data.location.lat && data.location.lng) {
          liveReports.push({
            id: doc.id,
            type: data.type,
            description: data.description,
            location: data.location,
            timestamp: data.timestamp,
            status: data.status || 'pending', // Default to pending if not explicitly set
          });
        }
      });

      set({ reports: liveReports });
    }, (error) => {
      console.error("Error streaming live reports:", error);
    });

    return unsubscribe; // Allow components to clean up the listener
  },
}));