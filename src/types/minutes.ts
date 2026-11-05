export type AttendanceStatus = 'present' | 'absent' | 'excused';

export type MinuteStatus = 'draft' | 'saved' | 'archived';

export interface ParticipantRow {
  id: string;
  minuteId: string;
  orderIndex: number;
  name: string;
  jobTitle: string;
  attendanceStatus: AttendanceStatus;
  notes: string;
  ownerId: string;
}

export interface OutcomeRow {
  id: string;
  minuteId: string;
  orderIndex: number;
  subject: string;
  recommendations: string; // Supports multiple recommendations separated by newline or bullet items
  responsiblePerson: string;
  executionDate: string;
  status?: string;
  ownerId: string;
}

export interface OngoingTopicRow {
  id: string;
  minuteId: string;
  orderIndex: number;
  itemNumber: string;
  subject: string;
  latestUpdates: string;
  recommendationOrAction: string;
  followUpPerson: string;
  followUpDate: string;
  topicStatus: string;
  sourceMinuteId: string;
  sourceMinuteLabel: string;
  historyLog: string; // JSON string or formatted history log of previous meetings
  ownerId: string;
}

export interface NewTopicRow {
  id: string;
  minuteId: string;
  orderIndex: number;
  itemNumber: string;
  subject: string;
  discussionSummary: string;
  recommendationsAndDecisions: string;
  responsiblePerson: string;
  executionDate: string;
  status?: string;
  ownerId: string;
}

export interface MinuteRecord {
  id: string;
  minuteNumber: number;
  year: number;
  location: string;
  date: string;
  time: string;
  mainSubject: string;
  secretaryName: string;
  secretarySignature: string;
  chairmanName: string;
  chairmanSignature: string;
  status: MinuteStatus;
  participantsCount: number;
  searchText: string;
  ownerId: string;
  createdByName: string;
  updatedByName: string;
  archivedAt: string;
  archivedByName: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdAtIso?: string;
  updatedAtIso?: string;
}

export interface CustomTableRow {
  id: string;
  orderIndex: number;
  subject: string;
  recommendations: string;
  responsiblePerson: string;
  executionDate: string;
  status?: string;
}

export interface CustomTableSection {
  id: string;
  title: string;
  rows: CustomTableRow[];
}

export interface FullMinuteBundle {
  minute: MinuteRecord;
  participants: ParticipantRow[];
  outcomes: OutcomeRow[];
  ongoingTopics: OngoingTopicRow[];
  newTopics: NewTopicRow[];
  showOngoingTable?: boolean;
  showNewTopicsTable?: boolean;
  customTables?: CustomTableSection[];
}

export interface EmployeeDirectoryItem {
  id: string;
  name: string;
  jobTitle: string;
  department: string;
  ownerId: string;
}

