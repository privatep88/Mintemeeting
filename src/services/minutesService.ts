import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp,
  Timestamp,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import {
  FullMinuteBundle,
  MinuteRecord,
  ParticipantRow,
  OutcomeRow,
  OngoingTopicRow,
  NewTopicRow,
  CustomTableSection,
  CustomTableRow,
  EmployeeDirectoryItem,
} from '../types/minutes';
import { formatMinuteNumber } from '../utils/numerals';

export const DEFAULT_WORKSPACE_OWNER_ID = 'saaed_org_workspace';

export function getActiveOwnerId(): string {
  return auth.currentUser?.uid || DEFAULT_WORKSPACE_OWNER_ID;
}

export function getActiveUserDisplay(customOperatorName?: string): string {
  if (customOperatorName && customOperatorName.trim()) {
    return truncate(customOperatorName.trim(), 200);
  }
  return truncate(
    auth.currentUser?.displayName || auth.currentUser?.email || 'مسؤول النظام - ساعد',
    200
  );
}

function sanitizeId(id: string): string {
  const cleaned = id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return cleaned || `id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function generateSafeId(prefix = 'item'): string {
  return sanitizeId(`${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);
}

function truncate(val: string | undefined | null, max: number): string {
  if (!val) return '';
  return String(val).slice(0, max);
}

function formatTimestamp(ts: unknown): string {
  if (!ts) return '';
  if (ts instanceof Timestamp) {
    return ts.toDate().toISOString();
  }
  if (typeof ts === 'object' && ts !== null && 'seconds' in ts) {
    const sec = (ts as { seconds: number }).seconds;
    return new Date(sec * 1000).toISOString();
  }
  if (typeof ts === 'string') return ts;
  return '';
}

export function buildLockId(ownerId: string, year: number, minuteNumber: number): string {
  return sanitizeId(`lock_${ownerId}_${year}_${minuteNumber}`);
}

export function computeSearchText(bundle: {
  minute: MinuteRecord;
  participants: ParticipantRow[];
  outcomes: OutcomeRow[];
  ongoingTopics: OngoingTopicRow[];
  newTopics: NewTopicRow[];
  customTables?: CustomTableSection[];
}): string {
  const customParts: string[] = [];
  (bundle.customTables || []).forEach((ct) => {
    customParts.push(ct.title);
    ct.rows.forEach((r) => {
      customParts.push(`${r.subject} ${r.recommendations} ${r.responsiblePerson}`);
    });
  });

  const parts: string[] = [
    String(bundle.minute.minuteNumber),
    formatMinuteNumber(bundle.minute.minuteNumber),
    String(bundle.minute.year),
    bundle.minute.location,
    bundle.minute.mainSubject,
    bundle.minute.chairmanName,
    bundle.minute.secretaryName,
    ...bundle.participants.map((p) => `${p.name} ${p.jobTitle} ${p.notes}`),
    ...bundle.outcomes.map((o) => `${o.subject} ${o.recommendations} ${o.responsiblePerson}`),
    ...bundle.ongoingTopics.map(
      (t) => `${t.subject} ${t.latestUpdates} ${t.recommendationOrAction} ${t.followUpPerson}`
    ),
    ...bundle.newTopics.map(
      (n) => `${n.subject} ${n.discussionSummary} ${n.recommendationsAndDecisions} ${n.responsiblePerson}`
    ),
    ...customParts,
  ];
  return truncate(parts.join(' | ').toLowerCase(), 14500);
}

/**
 * Checks whether a minuteNumber already exists in the same year.
 * Returns the conflicting minuteId if taken by another minute, or null if available.
 */
export async function checkMinuteNumberConflict(
  year: number,
  minuteNumber: number,
  currentMinuteId?: string
): Promise<string | null> {
  const uid = getActiveOwnerId();

  const lockId = buildLockId(uid, year, minuteNumber);
  const lockRef = doc(db, 'minute_locks', lockId);
  try {
    const snap = await getDoc(lockRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.minuteId && data.minuteId !== currentMinuteId) {
        return data.minuteId as string;
      }
    }
  } catch {
    // Document might not exist yet
  }

  const q = query(
    collection(db, 'minutes'),
    where('ownerId', '==', uid),
    where('year', '==', year),
    where('minuteNumber', '==', minuteNumber)
  );
  try {
    const qSnap = await getDocs(q);
    for (const d of qSnap.docs) {
      if (d.id !== currentMinuteId) {
        return d.id;
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'minutes');
  }

  return null;
}

/**
 * Computes the next sequential minuteNumber for the specified year.
 */
export async function getNextSequentialMinuteNumber(year: number): Promise<number> {
  const uid = getActiveOwnerId();

  const q = query(
    collection(db, 'minutes'),
    where('ownerId', '==', uid),
    where('year', '==', year)
  );

  try {
    const snap = await getDocs(q);
    if (snap.empty) return 1;
    const usedNumbers = new Set<number>();
    snap.forEach((docSnap) => {
      const num = Number(docSnap.data().minuteNumber) || 0;
      if (num > 0) usedNumbers.add(num);
    });
    let candidate = 1;
    while (usedNumbers.has(candidate)) {
      candidate += 1;
    }
    return candidate;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'minutes');
  }
}

/**
 * Loads the full minute record along with all 4 subcollections.
 */
export async function loadFullMinute(minuteId: string): Promise<FullMinuteBundle> {
  const uid = getActiveOwnerId();

  const minuteRef = doc(db, 'minutes', minuteId);
  let minuteSnap;
  try {
    minuteSnap = await getDoc(minuteRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `minutes/${minuteId}`);
  }

  if (!minuteSnap || !minuteSnap.exists()) {
    throw new Error('لم يتم العثور على المحضر المطلوب في قاعدة البيانات.');
  }

  const raw = minuteSnap.data();
  const minute: MinuteRecord = {
    id: minuteSnap.id,
    minuteNumber: Number(raw.minuteNumber) || 1,
    year: Number(raw.year) || new Date().getFullYear(),
    location: raw.location || '',
    date: raw.date || '',
    time: raw.time || '',
    mainSubject: raw.mainSubject || '',
    secretaryName: raw.secretaryName || '',
    secretarySignature: raw.secretarySignature || '',
    chairmanName: raw.chairmanName || '',
    chairmanSignature: raw.chairmanSignature || '',
    status: raw.status || 'draft',
    participantsCount: Number(raw.participantsCount) || 0,
    searchText: raw.searchText || '',
    ownerId: raw.ownerId || uid,
    createdByName: raw.createdByName || '',
    updatedByName: raw.updatedByName || '',
    archivedAt: raw.archivedAt || '',
    archivedByName: raw.archivedByName || '',
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    createdAtIso: formatTimestamp(raw.createdAt),
    updatedAtIso: formatTimestamp(raw.updatedAt),
  };

  // Load subcollections filtered by ownerId for security rules compliance
  const loadSub = async <T extends { id: string; orderIndex?: number }>(
    subName: string
  ): Promise<T[]> => {
    const subQuery = query(
      collection(db, 'minutes', minuteId, subName),
      where('ownerId', '==', minute.ownerId)
    );
    try {
      const snap = await getDocs(subQuery);
      const list = snap.docs.map(
        (d) =>
          ({
            id: d.id,
            ...d.data(),
          }) as unknown as T
      );
      return list.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, `minutes/${minuteId}/${subName}`);
    }
  };

  const [participants, outcomes, ongoingTopics, rawNewTopics] = await Promise.all([
    loadSub<ParticipantRow>('participants'),
    loadSub<OutcomeRow>('outcomes'),
    loadSub<OngoingTopicRow>('ongoing_topics'),
    loadSub<NewTopicRow>('new_topics'),
  ]);

  let showOngoingTable = true;
  let showNewTopicsTable = true;
  let customTablesMeta: Array<{ id: string; title: string }> = [];

  const metaDoc = rawNewTopics.find((r) => r.itemNumber === '__META_CONFIG__');
  if (metaDoc && metaDoc.discussionSummary) {
    try {
      const parsed = JSON.parse(metaDoc.discussionSummary);
      if (typeof parsed.showOngoingTable === 'boolean') {
        showOngoingTable = parsed.showOngoingTable;
      }
      if (typeof parsed.showNewTopicsTable === 'boolean') {
        showNewTopicsTable = parsed.showNewTopicsTable;
      }
      if (Array.isArray(parsed.customTablesMeta)) {
        customTablesMeta = parsed.customTablesMeta;
      }
    } catch {
      // Ignore malformed metadata
    }
  }

  const customRowDocs = rawNewTopics.filter((r) =>
    String(r.itemNumber || '').startsWith('__CT_ROW__:')
  );
  const newTopics = rawNewTopics
    .filter(
      (r) =>
        r.itemNumber !== '__META_CONFIG__' &&
        !String(r.itemNumber || '').startsWith('__CT_ROW__:')
    )
    .map((n, idx) => ({
      ...n,
      orderIndex: idx + 1,
      itemNumber: String(idx + 1),
    }));

  const customTableMap = new Map<string, CustomTableSection>();
  customTablesMeta.forEach((meta) => {
    if (meta && meta.id) {
      customTableMap.set(meta.id, {
        id: meta.id,
        title: meta.title || 'جدول إضافي',
        rows: [],
      });
    }
  });

  customRowDocs.forEach((docRow) => {
    const tableId = docRow.itemNumber.replace('__CT_ROW__:', '');
    if (!customTableMap.has(tableId)) {
      customTableMap.set(tableId, {
        id: tableId,
        title: docRow.discussionSummary || 'جدول إضافي',
        rows: [],
      });
    }
    const section = customTableMap.get(tableId)!;
    const rowItem: CustomTableRow = {
      id: docRow.id,
      orderIndex: section.rows.length + 1,
      subject: docRow.subject || '',
      recommendations: docRow.recommendationsAndDecisions || '',
      responsiblePerson: docRow.responsiblePerson || '',
      executionDate: docRow.executionDate || '',
    };
    section.rows.push(rowItem);
  });

  const customTables = Array.from(customTableMap.values());

  return {
    minute,
    participants,
    outcomes,
    ongoingTopics,
    newTopics,
    showOngoingTable,
    showNewTopicsTable,
    customTables,
  };
}

/**
 * Saves or updates a complete meeting minute atomically in Firestore,
 * enforcing uniqueness on (year, minuteNumber) and syncing all subcollections
 * without creating duplicate records.
 */
export async function saveFullMinuteToDb(
  bundle: FullMinuteBundle,
  isExistingRecord: boolean,
  previousYear?: number,
  previousMinuteNumber?: number,
  operatorName?: string
): Promise<FullMinuteBundle> {
  const uid = getActiveOwnerId();
  const userDisplay = getActiveUserDisplay(operatorName);
  const minuteId = sanitizeId(bundle.minute.id || generateSafeId('min'));

  const year = Number(bundle.minute.year);
  const minuteNumber = Number(bundle.minute.minuteNumber);

  if (!year || year < 1900 || year > 2200) {
    throw new Error('سنة الاجتماع غير صالحة.');
  }
  if (!minuteNumber || minuteNumber < 1) {
    throw new Error('رقم المحضر يجب أن يكون رقماً موجباً.');
  }

  // 1. Check DB uniqueness for (year, minuteNumber)
  const conflictId = await checkMinuteNumberConflict(
    year,
    minuteNumber,
    isExistingRecord ? minuteId : undefined
  );
  if (conflictId) {
    throw new Error(
      `رقم المحضر (${formatMinuteNumber(minuteNumber)}) مسجل مسبقاً في سنة (${year}). يمنع النظام تكرار رقم المحضر داخل السنة نفسها.`
    );
  }

  const recordOwnerId = bundle.minute.ownerId || uid;

  const normalizedParticipants: ParticipantRow[] = bundle.participants.map((p, idx) => ({
    id: sanitizeId(p.id || generateSafeId(`part_${idx}`)),
    minuteId,
    orderIndex: idx + 1,
    name: truncate(p.name.trim() || 'مشارك', 200),
    jobTitle: truncate(p.jobTitle.trim(), 200),
    attendanceStatus: p.attendanceStatus || 'present',
    notes: truncate(p.notes, 1000),
    ownerId: recordOwnerId,
  }));

  const normalizedOutcomes: OutcomeRow[] = bundle.outcomes.map((o, idx) => ({
    id: sanitizeId(o.id || generateSafeId(`out_${idx}`)),
    minuteId,
    orderIndex: idx + 1,
    subject: truncate(o.subject, 5000),
    recommendations: truncate(o.recommendations, 8000),
    responsiblePerson: truncate(o.responsiblePerson, 300),
    executionDate: truncate(o.executionDate, 30),
    ownerId: recordOwnerId,
  }));

  const showOngoingTable = bundle.showOngoingTable ?? true;
  const showNewTopicsTable = bundle.showNewTopicsTable ?? true;
  const customTables = bundle.customTables ?? [];

  const activeOngoingTopics = showOngoingTable ? bundle.ongoingTopics : [];
  const activeNewTopics = showNewTopicsTable ? bundle.newTopics : [];

  const normalizedOngoing: OngoingTopicRow[] = activeOngoingTopics.map((t, idx) => ({
    id: sanitizeId(t.id || generateSafeId(`ong_${idx}`)),
    minuteId,
    orderIndex: idx + 1,
    itemNumber: truncate(t.itemNumber || String(idx + 1), 50),
    subject: truncate(t.subject, 5000),
    latestUpdates: truncate(t.latestUpdates, 5000),
    recommendationOrAction: truncate(t.recommendationOrAction, 5000),
    followUpPerson: truncate(t.followUpPerson, 300),
    followUpDate: truncate(t.followUpDate, 30),
    topicStatus: truncate(t.topicStatus || 'قيد المتابعة', 100),
    sourceMinuteId: truncate(t.sourceMinuteId, 128),
    sourceMinuteLabel: truncate(t.sourceMinuteLabel, 200),
    historyLog: truncate(t.historyLog, 8000),
    ownerId: recordOwnerId,
  }));

  const normalizedNew: NewTopicRow[] = activeNewTopics.map((n, idx) => ({
    id: sanitizeId(n.id || generateSafeId(`new_${idx}`)),
    minuteId,
    orderIndex: idx + 1,
    itemNumber: truncate(String(idx + 1), 50),
    subject: truncate(n.subject, 5000),
    discussionSummary: truncate(n.discussionSummary, 5000),
    recommendationsAndDecisions: truncate(n.recommendationsAndDecisions, 5000),
    responsiblePerson: truncate(n.responsiblePerson, 300),
    executionDate: truncate(n.executionDate, 30),
    ownerId: recordOwnerId,
  }));

  // Persist section visibility and custom tables metadata + rows inside new_topics collection
  const customTablesMeta = customTables.map((ct) => ({
    id: sanitizeId(ct.id),
    title: truncate(ct.title || 'جدول إضافي', 200),
  }));

  const metaConfigRow: NewTopicRow = {
    id: 'meta_sections_config',
    minuteId,
    orderIndex: 9000,
    itemNumber: '__META_CONFIG__',
    subject: '__META_CONFIG__',
    discussionSummary: truncate(
      JSON.stringify({
        showOngoingTable,
        showNewTopicsTable,
        customTablesMeta,
      }),
      4900
    ),
    recommendationsAndDecisions: '',
    responsiblePerson: '',
    executionDate: '',
    ownerId: recordOwnerId,
  };

  const customTableAsNewTopicRows: NewTopicRow[] = [];
  let customGlobalOrder = 1000;
  customTables.forEach((ct) => {
    const cleanTableId = sanitizeId(ct.id).slice(0, 35);
    const cleanTitle = truncate(ct.title || 'جدول إضافي', 200);
    ct.rows.forEach((r, idx) => {
      customGlobalOrder += 1;
      customTableAsNewTopicRows.push({
        id: sanitizeId(r.id || generateSafeId(`ct_${idx}`)),
        minuteId,
        orderIndex: customGlobalOrder,
        itemNumber: truncate(`__CT_ROW__:${cleanTableId}`, 50),
        subject: truncate(r.subject, 5000),
        discussionSummary: cleanTitle,
        recommendationsAndDecisions: truncate(r.recommendations, 5000),
        responsiblePerson: truncate(r.responsiblePerson, 300),
        executionDate: truncate(r.executionDate, 30),
        ownerId: recordOwnerId,
      });
    });
  });

  const allNewTopicsForDb: NewTopicRow[] = [
    ...normalizedNew,
    ...customTableAsNewTopicRows,
    metaConfigRow,
  ];

  const updatedMinute: MinuteRecord = {
    ...bundle.minute,
    id: minuteId,
    minuteNumber,
    year,
    location: truncate(bundle.minute.location, 300),
    date: truncate(bundle.minute.date || new Date().toISOString().slice(0, 10), 20),
    time: truncate(bundle.minute.time || '10:00', 20),
    mainSubject: truncate(bundle.minute.mainSubject, 500),
    secretaryName: truncate(bundle.minute.secretaryName, 200),
    secretarySignature: truncate(bundle.minute.secretarySignature, 150000),
    chairmanName: truncate(bundle.minute.chairmanName, 200),
    chairmanSignature: truncate(bundle.minute.chairmanSignature, 150000),
    status: bundle.minute.status || 'saved',
    participantsCount: normalizedParticipants.length,
    ownerId: recordOwnerId,
    createdByName: truncate(bundle.minute.createdByName || userDisplay, 200),
    updatedByName: userDisplay,
    archivedAt: truncate(bundle.minute.archivedAt || '', 50),
    archivedByName: truncate(bundle.minute.archivedByName || '', 200),
    searchText: '',
  };

  updatedMinute.searchText = computeSearchText({
    minute: updatedMinute,
    participants: normalizedParticipants,
    outcomes: normalizedOutcomes,
    ongoingTopics: normalizedOngoing,
    newTopics: normalizedNew,
    customTables,
  });

  const batch = writeBatch(db);
  const minuteRef = doc(db, 'minutes', minuteId);

  let existingCreatedAt: unknown = serverTimestamp();
  if (isExistingRecord) {
    try {
      const snap = await getDoc(minuteRef);
      if (snap.exists()) {
        existingCreatedAt = snap.data().createdAt || serverTimestamp();
      }
    } catch {
      // Fallback
    }
  }

  const minuteDocPayload = {
    minuteNumber: updatedMinute.minuteNumber,
    year: updatedMinute.year,
    location: updatedMinute.location,
    date: updatedMinute.date,
    time: updatedMinute.time,
    mainSubject: updatedMinute.mainSubject,
    secretaryName: updatedMinute.secretaryName,
    secretarySignature: updatedMinute.secretarySignature,
    chairmanName: updatedMinute.chairmanName,
    chairmanSignature: updatedMinute.chairmanSignature,
    status: updatedMinute.status,
    participantsCount: updatedMinute.participantsCount,
    searchText: updatedMinute.searchText,
    ownerId: updatedMinute.ownerId,
    createdByName: updatedMinute.createdByName,
    updatedByName: updatedMinute.updatedByName,
    archivedAt: updatedMinute.archivedAt,
    archivedByName: updatedMinute.archivedByName,
    createdAt: isExistingRecord ? existingCreatedAt : serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  batch.set(minuteRef, minuteDocPayload);

  // Handle minute_locks
  const newLockId = buildLockId(updatedMinute.ownerId, year, minuteNumber);
  const newLockRef = doc(db, 'minute_locks', newLockId);

  if (
    isExistingRecord &&
    previousYear !== undefined &&
    previousMinuteNumber !== undefined &&
    (previousYear !== year || previousMinuteNumber !== minuteNumber)
  ) {
    const oldLockId = buildLockId(updatedMinute.ownerId, previousYear, previousMinuteNumber);
    if (oldLockId !== newLockId) {
      batch.delete(doc(db, 'minute_locks', oldLockId));
    }
  }

  let lockCreatedAt: unknown = serverTimestamp();
  try {
    const existingLock = await getDoc(newLockRef);
    if (existingLock.exists()) {
      lockCreatedAt = existingLock.data().createdAt || serverTimestamp();
    }
  } catch {
    // Ignore if doesn't exist yet
  }

  batch.set(newLockRef, {
    minuteId,
    year,
    minuteNumber,
    ownerId: updatedMinute.ownerId,
    createdAt: lockCreatedAt,
  });

  // Sync subcollections: delete removed items, set current items
  const syncSubcollection = async <T extends { id: string }>(
    subName: string,
    items: T[],
    toPayload: (item: T) => Record<string, unknown>
  ) => {
    if (isExistingRecord) {
      const existingQ = query(
        collection(db, 'minutes', minuteId, subName),
        where('ownerId', '==', updatedMinute.ownerId)
      );
      const existingSnap = await getDocs(existingQ);
      const keepIds = new Set(items.map((i) => i.id));
      existingSnap.forEach((docSnap) => {
        if (!keepIds.has(docSnap.id)) {
          batch.delete(docSnap.ref);
        }
      });
    }
    for (const item of items) {
      const itemRef = doc(db, 'minutes', minuteId, subName, item.id);
      batch.set(itemRef, toPayload(item));
    }
  };

  await Promise.all([
    syncSubcollection('participants', normalizedParticipants, (p) => ({
      minuteId,
      orderIndex: p.orderIndex,
      name: p.name,
      jobTitle: p.jobTitle,
      attendanceStatus: p.attendanceStatus,
      notes: p.notes,
      ownerId: p.ownerId,
      updatedAt: serverTimestamp(),
    })),
    syncSubcollection('outcomes', normalizedOutcomes, (o) => ({
      minuteId,
      orderIndex: o.orderIndex,
      subject: o.subject,
      recommendations: o.recommendations,
      responsiblePerson: o.responsiblePerson,
      executionDate: o.executionDate,
      ownerId: o.ownerId,
      updatedAt: serverTimestamp(),
    })),
    syncSubcollection('ongoing_topics', normalizedOngoing, (t) => ({
      minuteId,
      orderIndex: t.orderIndex,
      itemNumber: t.itemNumber,
      subject: t.subject,
      latestUpdates: t.latestUpdates,
      recommendationOrAction: t.recommendationOrAction,
      followUpPerson: t.followUpPerson,
      followUpDate: t.followUpDate,
      topicStatus: t.topicStatus,
      sourceMinuteId: t.sourceMinuteId,
      sourceMinuteLabel: t.sourceMinuteLabel,
      historyLog: t.historyLog,
      ownerId: t.ownerId,
      updatedAt: serverTimestamp(),
    })),
    syncSubcollection('new_topics', allNewTopicsForDb, (n) => ({
      minuteId,
      orderIndex: n.orderIndex,
      itemNumber: n.itemNumber,
      subject: n.subject,
      discussionSummary: n.discussionSummary,
      recommendationsAndDecisions: n.recommendationsAndDecisions,
      responsiblePerson: n.responsiblePerson,
      executionDate: n.executionDate,
      ownerId: n.ownerId,
      updatedAt: serverTimestamp(),
    })),
  ]);

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `minutes/${minuteId}`);
  }

  return await loadFullMinute(minuteId);
}

/**
 * Archives or restores a minute record without deleting any data.
 */
export async function updateMinuteArchiveState(
  minuteId: string,
  archive: boolean,
  operatorName?: string
): Promise<MinuteRecord> {
  const full = await loadFullMinute(minuteId);
  const userDisplay = getActiveUserDisplay(operatorName);

  full.minute.status = archive ? 'archived' : 'saved';
  full.minute.archivedAt = archive ? new Date().toISOString() : '';
  full.minute.archivedByName = archive ? userDisplay : '';
  full.minute.updatedByName = userDisplay;

  const saved = await saveFullMinuteToDb(
    full,
    true,
    full.minute.year,
    full.minute.minuteNumber,
    userDisplay
  );
  return saved.minute;
}

/**
 * Permanently deletes a minute record, all its subcollections, and its annual number lock.
 */
export async function deleteFullMinuteFromDb(minuteId: string): Promise<{
  minuteNumber: number;
  year: number;
}> {
  const minRef = doc(db, 'minutes', minuteId);
  let minuteNumber = 0;
  let year = new Date().getFullYear();
  let ownerId = getActiveOwnerId();

  try {
    const minSnap = await getDoc(minRef);
    if (minSnap.exists()) {
      const data = minSnap.data();
      minuteNumber = Number(data.minuteNumber) || 0;
      year = Number(data.year) || year;
      ownerId = String(data.ownerId || ownerId);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `minutes/${minuteId}`);
  }

  const subNames = ['participants', 'outcomes', 'ongoing_topics', 'new_topics'];
  const subBatch = writeBatch(db);
  let hasSubDocs = false;

  for (const subName of subNames) {
    try {
      const subQ = query(
        collection(db, 'minutes', minuteId, subName),
        where('ownerId', '==', ownerId)
      );
      const snap = await getDocs(subQ);
      snap.forEach((docSnap) => {
        subBatch.delete(docSnap.ref);
        hasSubDocs = true;
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, `minutes/${minuteId}/${subName}`);
    }
  }

  if (hasSubDocs) {
    try {
      await subBatch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `minutes/${minuteId}`);
    }
  }

  const mainBatch = writeBatch(db);
  if (minuteNumber > 0) {
    const lockId = buildLockId(ownerId, year, minuteNumber);
    mainBatch.delete(doc(db, 'minute_locks', lockId));
  }
  mainBatch.delete(minRef);

  try {
    await mainBatch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `minutes/${minuteId}`);
  }

  return { minuteNumber, year };
}

export const OFFICIAL_PARTICIPANTS_DIRECTORY: EmployeeDirectoryItem[] = [
  {
    id: 'emp_saaed_01',
    name: 'الأستاذ / فيصل سويد السليماني',
    jobTitle: 'رئيس قسم ادارة المرافق',
    department: 'قسم ادارة المرافق',
    ownerId: DEFAULT_WORKSPACE_OWNER_ID,
  },
  {
    id: 'emp_saaed_02',
    name: 'الأستاذ / معاذ حسين المصعبي',
    jobTitle: 'ضابط أول خدمات مرافق وأصول',
    department: 'قسم ادارة المرافق',
    ownerId: DEFAULT_WORKSPACE_OWNER_ID,
  },
  {
    id: 'emp_saaed_03',
    name: 'الأستاذ / خالد احمد الهاشمي',
    jobTitle: 'ضابط أول الدعم اللوجستي والاستقبال',
    department: 'قسم ادارة المرافق',
    ownerId: DEFAULT_WORKSPACE_OWNER_ID,
  },
  {
    id: 'emp_saaed_04',
    name: 'الأستاذة / ندى حسن العامري',
    jobTitle: 'ضابط أول سلامة وامن وحماية المرافق',
    department: 'قسم ادارة المرافق',
    ownerId: DEFAULT_WORKSPACE_OWNER_ID,
  },
  {
    id: 'emp_saaed_05',
    name: 'الأستاذ / خالد خميس اليحيائي',
    jobTitle: 'ضابط خدمات مرافق وأصول',
    department: 'قسم ادارة المرافق',
    ownerId: DEFAULT_WORKSPACE_OWNER_ID,
  },
  {
    id: 'emp_saaed_06',
    name: 'الأستاذ / مالك سرور راشد اليحيائي',
    jobTitle: 'ضابط خدمات مرافق وأصول',
    department: 'قسم ادارة المرافق',
    ownerId: DEFAULT_WORKSPACE_OWNER_ID,
  },
  {
    id: 'emp_saaed_07',
    name: 'الأستاذ / إبراهيم  عبدربه  أديب',
    jobTitle: 'ضابط خدمات مرافق وأصول',
    department: 'قسم ادارة المرافق',
    ownerId: DEFAULT_WORKSPACE_OWNER_ID,
  },
  {
    id: 'emp_saaed_08',
    name: 'الأستاذ / م . علي يحيى سعيد',
    jobTitle: 'ضابط خدمات مرافق وأصول',
    department: 'قسم ادارة المرافق',
    ownerId: DEFAULT_WORKSPACE_OWNER_ID,
  },
];

/**
 * Ensures the official participants directory is persisted in Firestore without duplicates,
 * and migrates any outdated participant names (e.g., الجفري -> الهاشمي).
 */
export async function seedOfficialParticipantsDirectory(): Promise<void> {
  const ownerId = getActiveOwnerId();
  try {
    const q = query(
      collection(db, 'employee_directory'),
      where('ownerId', '==', ownerId)
    );
    const snap = await getDocs(q);
    const existingIds = new Set(snap.docs.map((d) => d.id));
    const existingNames = new Set(snap.docs.map((d) => String(d.data().name || '').trim()));

    const batch = writeBatch(db);
    let hasChanges = false;

    // Update any existing directory record that still has "الجفري" to "الهاشمي"
    snap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const currentName = String(data.name || '');
      if (currentName.includes('الجفري')) {
        const updatedName = currentName.replace(/الجفري/g, 'الهاشمي');
        batch.update(doc(db, 'employee_directory', docSnap.id), {
          name: updatedName,
        });
        existingNames.add(updatedName.trim());
        hasChanges = true;
      }
    });

    for (const emp of OFFICIAL_PARTICIPANTS_DIRECTORY) {
      if (!existingIds.has(emp.id) && !existingNames.has(emp.name.trim())) {
        batch.set(doc(db, 'employee_directory', emp.id), {
          name: emp.name,
          jobTitle: emp.jobTitle,
          department: emp.department || '',
          ownerId,
          createdAt: serverTimestamp(),
        });
        hasChanges = true;
      }
    }

    if (hasChanges) {
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'employee_directory');
  }
}

/**
 * Adds an employee to the persistent Employee Directory for fast selection.
 */
export async function addEmployeeToDirectory(
  name: string,
  jobTitle: string,
  department = ''
): Promise<EmployeeDirectoryItem> {
  const ownerId = getActiveOwnerId();
  const id = generateSafeId('emp');
  const payload = {
    name: truncate(name.trim(), 200),
    jobTitle: truncate(jobTitle.trim(), 200),
    department: truncate(department.trim(), 200),
    ownerId,
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'employee_directory', id), payload);
    return {
      id,
      name: payload.name,
      jobTitle: payload.jobTitle,
      department: payload.department,
      ownerId,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `employee_directory/${id}`);
  }
}

export async function removeEmployeeFromDirectory(employeeId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'employee_directory', employeeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `employee_directory/${employeeId}`);
  }
}

