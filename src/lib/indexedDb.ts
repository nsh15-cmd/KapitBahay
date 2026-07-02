import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export type ReportCategory = 'hazard' | 'resource' | 'rescue' | 'infrastructure' | 'status';
export type ReportSyncStatus = 'pending' | 'synced' | 'failed' | 'on_the_way' | 'resolved' | 'false_report' | 'needs_verification';
export type ReportLifecycleStatus = 'pending' | 'on_the_way' | 'resolved' | 'false_report' | 'needs_verification';

// --- NEW: Announcement Types ---
export type AnnouncementPriority = 'emergency' | 'urgent' | 'normal';

export interface Announcement {
  id: string;
  title: string;
  description: string;
  priority: AnnouncementPriority;
  startDate: number;
  endDate: number;
  createdAt: number;
  status: 'active' | 'expired';
  imageDataUrl?: string; // Added to support flyer uploads
}

export interface ReportComment {
  id: string;
  authorName: string;
  authorRole: 'user' | 'lgu' | 'admin';
  message: string;
  createdAt: number;
}

export interface CachedLocation {
  key: 'cachedLocation';
  lat: number;
  lng: number;
  address?: string;
  savedAt: number;
}

export interface LocalReport {
  id: string;
  _id: string;
  category: ReportCategory;
  type: ReportCategory;
  title: string;
  description?: string;
  reporterName?: string;
  location: { lat: number; lng: number };
  locationText?: string;
  address?: string;
  imageDataUrl?: string;
  timestamp: number;
  status: ReportSyncStatus;
  lifecycleStatus?: ReportLifecycleStatus;
  comments?: ReportComment[];
  synced: boolean;
  uploadedAt?: string;
  origin: 'local' | 'peer';
}

export interface EvacuationArea {
  id: string;
  name: string;
  description?: string;
  location: { lat: number; lng: number };
  timestamp: number;
  synced: boolean;
  active: boolean;
}

interface KapitBahayDB extends DBSchema {
  pendingReports: { key: string; value: LocalReport };
  metadata: { key: string; value: CachedLocation };
  evacuationAreas: { key: string; value: EvacuationArea };
  announcements: { key: string; value: Announcement };
}

const DB_NAME = 'kapitbahay-offline-db';
const STORE_REPORTS = 'pendingReports';
const STORE_META = 'metadata';
const STORE_EVAC = 'evacuationAreas';
const STORE_ANNOUNCEMENTS = 'announcements';

export const initDB = async (): Promise<IDBPDatabase<KapitBahayDB>> => {
  return openDB<KapitBahayDB>(DB_NAME, 4, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_REPORTS)) db.createObjectStore(STORE_REPORTS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META);
      if (!db.objectStoreNames.contains(STORE_EVAC)) db.createObjectStore(STORE_EVAC, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_ANNOUNCEMENTS)) db.createObjectStore(STORE_ANNOUNCEMENTS, { keyPath: 'id' });
    },
  });
};

// --- Announcement Helpers ---
export const saveAnnouncementLocally = async (announcement: Announcement) => {
  const db = await initDB();
  await db.put(STORE_ANNOUNCEMENTS, announcement);
};

export const getAnnouncements = async (): Promise<Announcement[]> => {
  const db = await initDB();
  return (await db.getAll(STORE_ANNOUNCEMENTS)).sort((a, b) => b.createdAt - a.createdAt);
};

export const deleteAnnouncementLocally = async (id: string) => {
  const db = await initDB();
  await db.delete(STORE_ANNOUNCEMENTS, id);
};

// --- Evacuation Area Helpers ---
export const saveEvacuationAreaLocally = async (area: EvacuationArea) => {
  const db = await initDB();
  await db.put(STORE_EVAC, area);
};

export const getEvacuationAreas = async (): Promise<EvacuationArea[]> => {
  const db = await initDB();
  return (await db.getAll(STORE_EVAC)).sort((a, b) => b.timestamp - a.timestamp);
};

export const deleteEvacuationAreaLocally = async (id: string) => {
  const db = await initDB();
  await db.delete(STORE_EVAC, id);
};

// --- Existing Report Helpers ---
export const saveReportLocally = async (report: LocalReport) => {
  const db = await initDB();
  await db.put(STORE_REPORTS, report);
};

export const getPendingReports = async (): Promise<LocalReport[]> => {
  const db = await initDB();
  return (await db.getAll(STORE_REPORTS)).sort((a, b) => b.timestamp - a.timestamp);
};

export const getReportById = async (id: string): Promise<LocalReport | undefined> => {
  const db = await initDB();
  return db.get(STORE_REPORTS, id);
};

export const updateReportStatus = async (
  id: string,
  status: ReportSyncStatus,
  synced?: boolean
) => {
  const db = await initDB();
  const report = await db.get(STORE_REPORTS, id);
  if (!report) return;

  report.status = status;
  if (synced !== undefined) report.synced = synced;
  if (status === 'synced') {
    report.uploadedAt = report.uploadedAt || new Date().toISOString();
  }

  await db.put(STORE_REPORTS, report);
};

export const upsertReportDetails = async (
  id: string,
  details: Partial<Pick<LocalReport, 'lifecycleStatus' | 'comments' | 'status' | 'synced' | 'uploadedAt'>>
) => {
  const db = await initDB();
  const report = await db.get(STORE_REPORTS, id);
  if (!report) return;

  Object.assign(report, details);
  await db.put(STORE_REPORTS, report);
};

export const deleteLocalReport = async (id: string) => {
  const db = await initDB();
  await db.delete(STORE_REPORTS, id);
};

export const saveCachedLocation = async (location: Omit<CachedLocation, 'key'>) => {
  const db = await initDB();
  await db.put(STORE_META, { ...location, key: 'cachedLocation' });
};

export const getCachedLocation = async (): Promise<CachedLocation | undefined> => {
  const db = await initDB();
  return db.get(STORE_META, 'cachedLocation');
};