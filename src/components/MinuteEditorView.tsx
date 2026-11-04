import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  FilePlus,
  Eye,
  Printer,
  FileDown,
  Archive,
  ArchiveRestore,
  RotateCcw,
  ArrowRight,
  Lock,
  Unlock,
  Upload,
  History,
  UserPlus,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Edit3,
  CornerDownLeft,
} from 'lucide-react';
import {
  FullMinuteBundle,
  ParticipantRow,
  OutcomeRow,
  OngoingTopicRow,
  NewTopicRow,
  CustomTableSection,
  CustomTableRow,
  EmployeeDirectoryItem,
  MinuteRecord,
  AttendanceStatus,
} from '../types/minutes';
import { generateSafeId } from '../services/minutesService';
import { toArabicNumerals, formatMinuteNumber } from '../utils/numerals';
import { SignaturePad } from './SignaturePad';
import { ImportOngoingModal } from './ImportOngoingModal';
import { ImportOriginalTemplateModal } from './ImportOriginalTemplateModal';

interface MinuteEditorViewProps {
  bundle: FullMinuteBundle;
  isExistingRecord: boolean;
  readOnly: boolean;
  hasUnsavedChanges: boolean;
  saving: boolean;
  canAuthorizeManualNumber: boolean;
  canArchiveOrRestore: boolean;
  employeeDirectory: EmployeeDirectoryItem[];
  allMinutes: MinuteRecord[];
  onChangeBundle: (updater: (prev: FullMinuteBundle) => FullMinuteBundle) => void;
  onYearChangeSuggestNumber: (newYear: number) => void;
  onSaveDraft: () => void;
  onSaveFinal: () => void;
  onEnableEditMode: () => void;
  onPreview: () => void;
  onPrint: () => void;
  onExportPdf: () => void;
  onExportWord: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onCancelChanges: () => void;
  onBackToList: () => void;
  onAddDirectoryEmployee: (name: string, jobTitle: string) => Promise<void>;
}

export const MinuteEditorView: React.FC<MinuteEditorViewProps> = ({
  bundle,
  isExistingRecord,
  readOnly,
  hasUnsavedChanges,
  saving,
  canAuthorizeManualNumber,
  canArchiveOrRestore,
  employeeDirectory,
  allMinutes,
  onChangeBundle,
  onYearChangeSuggestNumber,
  onSaveDraft,
  onSaveFinal,
  onEnableEditMode,
  onPreview,
  onPrint,
  onExportPdf,
  onExportWord,
  onArchive,
  onRestore,
  onCancelChanges,
  onBackToList,
  onAddDirectoryEmployee,
}) => {
  const [manualNumberUnlocked, setManualNumberUnlocked] = useState(false);
  const [editingMinuteNumberText, setEditingMinuteNumberText] = useState<string | null>(null);
  const [selectedDirectoryEmpId, setSelectedDirectoryEmpId] = useState('');
  const [newDirName, setNewDirName] = useState('');
  const [newDirTitle, setNewDirTitle] = useState('');
  const [showAddDirForm, setShowAddDirForm] = useState(false);

  const [isImportOngoingOpen, setIsImportOngoingOpen] = useState(false);
  const [isImportTemplateOpen, setIsImportTemplateOpen] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [newTableTitleInput, setNewTableTitleInput] = useState('');

  const { minute, participants, outcomes, ongoingTopics, newTopics } = bundle;
  const showOngoingTable = bundle.showOngoingTable ?? true;
  const showNewTopicsTable = bundle.showNewTopicsTable ?? true;
  const customTables = bundle.customTables ?? [];

  const participantNamesList = Array.from(
    new Set([
      ...participants.map((p) => p.name).filter(Boolean),
      ...employeeDirectory.map((e) => e.name).filter(Boolean),
    ])
  );

  // --- Section 1: Metadata Handlers ---
  const updateMinuteField = <K extends keyof MinuteRecord>(key: K, value: MinuteRecord[K]) => {
    if (readOnly) return;
    const normalizedValue =
      typeof value === 'string' && !value.startsWith('data:image')
        ? (toArabicNumerals(value) as MinuteRecord[K])
        : value;
    onChangeBundle((prev) => ({
      ...prev,
      minute: {
        ...prev.minute,
        [key]: normalizedValue,
      },
    }));
  };

  // --- Section 2: Participants Handlers ---
  const addParticipantRow = (name = '', jobTitle = '') => {
    if (readOnly) return;
    onChangeBundle((prev) => {
      const next: ParticipantRow[] = [
        ...prev.participants,
        {
          id: generateSafeId('part'),
          minuteId: prev.minute.id,
          orderIndex: prev.participants.length + 1,
          name: toArabicNumerals(name),
          jobTitle: toArabicNumerals(jobTitle),
          attendanceStatus: 'present',
          notes: '',
          ownerId: prev.minute.ownerId,
        },
      ];
      return { ...prev, participants: next };
    });
  };

  const handleSelectFromDirectory = () => {
    if (!selectedDirectoryEmpId || readOnly) return;
    const emp = employeeDirectory.find((e) => e.id === selectedDirectoryEmpId);
    if (!emp) return;
    addParticipantRow(emp.name, emp.jobTitle);
    setSelectedDirectoryEmpId('');
  };

  const updateParticipant = <K extends keyof ParticipantRow>(
    id: string,
    key: K,
    val: ParticipantRow[K]
  ) => {
    if (readOnly) return;
    const normalizedVal =
      typeof val === 'string' ? (toArabicNumerals(val) as ParticipantRow[K]) : val;
    onChangeBundle((prev) => ({
      ...prev,
      participants: prev.participants.map((p) => (p.id === id ? { ...p, [key]: normalizedVal } : p)),
    }));
  };

  const removeParticipant = (id: string) => {
    if (readOnly) return;
    onChangeBundle((prev) => {
      const filtered = prev.participants
        .filter((p) => p.id !== id)
        .map((p, idx) => ({ ...p, orderIndex: idx + 1 }));
      return { ...prev, participants: filtered };
    });
  };

  const moveParticipant = (index: number, direction: 'up' | 'down') => {
    if (readOnly) return;
    onChangeBundle((prev) => {
      const copy = [...prev.participants];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= copy.length) return prev;
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      const reindexed = copy.map((p, i) => ({ ...p, orderIndex: i + 1 }));
      return { ...prev, participants: reindexed };
    });
  };

  // --- Section 3: Outcomes Handlers ---
  const addOutcomeRow = () => {
    if (readOnly) return;
    onChangeBundle((prev) => ({
      ...prev,
      outcomes: [
        ...prev.outcomes,
        {
          id: generateSafeId('out'),
          minuteId: prev.minute.id,
          orderIndex: prev.outcomes.length + 1,
          subject: '',
          recommendations: '',
          responsiblePerson: '',
          executionDate: '',
          ownerId: prev.minute.ownerId,
        },
      ],
    }));
  };

  const updateOutcome = <K extends keyof OutcomeRow>(id: string, key: K, val: OutcomeRow[K]) => {
    if (readOnly) return;
    const normalizedVal = typeof val === 'string' ? (toArabicNumerals(val) as OutcomeRow[K]) : val;
    onChangeBundle((prev) => ({
      ...prev,
      outcomes: prev.outcomes.map((o) => (o.id === id ? { ...o, [key]: normalizedVal } : o)),
    }));
  };

  const appendSubRecommendation = (id: string) => {
    if (readOnly) return;
    onChangeBundle((prev) => ({
      ...prev,
      outcomes: prev.outcomes.map((o) => {
        if (o.id !== id) return o;
        const lines = o.recommendations ? o.recommendations.split('\n').filter(Boolean) : [];
        const nextNum = lines.length + 1;
        const updated = o.recommendations
          ? `${o.recommendations}\n${nextNum}- توصية إضافية: `
          : `1- `;
        return { ...o, recommendations: updated };
      }),
    }));
  };

  const removeOutcome = (id: string) => {
    if (readOnly) return;
    onChangeBundle((prev) => ({
      ...prev,
      outcomes: prev.outcomes
        .filter((o) => o.id !== id)
        .map((o, idx) => ({ ...o, orderIndex: idx + 1 })),
    }));
  };

  const moveOutcome = (index: number, direction: 'up' | 'down') => {
    if (readOnly) return;
    onChangeBundle((prev) => {
      const copy = [...prev.outcomes];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= copy.length) return prev;
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return {
        ...prev,
        outcomes: copy.map((o, i) => ({ ...o, orderIndex: i + 1 })),
      };
    });
  };

  // --- Section 4: Ongoing Topics Handlers ---
  const addOngoingTopicRow = (imported?: OngoingTopicRow) => {
    if (readOnly) return;
    onChangeBundle((prev) => {
      const nextIdx = prev.ongoingTopics.length + 1;
      const item: OngoingTopicRow = imported
        ? {
            ...imported,
            orderIndex: nextIdx,
            itemNumber: imported.itemNumber || String(nextIdx),
          }
        : {
            id: generateSafeId('ong'),
            minuteId: prev.minute.id,
            orderIndex: nextIdx,
            itemNumber: String(nextIdx),
            subject: '',
            latestUpdates: '',
            recommendationOrAction: '',
            followUpPerson: '',
            followUpDate: '',
            topicStatus: 'قيد المتابعة',
            sourceMinuteId: '',
            sourceMinuteLabel: '',
            historyLog: '',
            ownerId: prev.minute.ownerId,
          };
      return {
        ...prev,
        ongoingTopics: [...prev.ongoingTopics, item],
      };
    });
  };

  const updateOngoingTopic = <K extends keyof OngoingTopicRow>(
    id: string,
    key: K,
    val: OngoingTopicRow[K]
  ) => {
    if (readOnly) return;
    const normalizedVal =
      typeof val === 'string' ? (toArabicNumerals(val) as OngoingTopicRow[K]) : val;
    onChangeBundle((prev) => ({
      ...prev,
      ongoingTopics: prev.ongoingTopics.map((t) =>
        t.id === id ? { ...t, [key]: normalizedVal } : t
      ),
    }));
  };

  const appendOngoingSubRecommendation = (id: string) => {
    if (readOnly) return;
    onChangeBundle((prev) => ({
      ...prev,
      ongoingTopics: prev.ongoingTopics.map((t) => {
        if (t.id !== id) return t;
        const lines = t.recommendationOrAction
          ? t.recommendationOrAction.split('\n').filter(Boolean)
          : [];
        const nextNum = lines.length + 1;
        const updated = t.recommendationOrAction
          ? `${t.recommendationOrAction}\n${nextNum}- توصية إضافية: `
          : `1- `;
        return { ...t, recommendationOrAction: updated };
      }),
    }));
  };

  const removeOngoingTopic = (id: string) => {
    if (readOnly) return;
    onChangeBundle((prev) => ({
      ...prev,
      ongoingTopics: prev.ongoingTopics
        .filter((t) => t.id !== id)
        .map((t, idx) => ({ ...t, orderIndex: idx + 1, itemNumber: String(idx + 1) })),
    }));
  };

  const moveOngoingTopic = (index: number, direction: 'up' | 'down') => {
    if (readOnly) return;
    onChangeBundle((prev) => {
      const copy = [...prev.ongoingTopics];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= copy.length) return prev;
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return {
        ...prev,
        ongoingTopics: copy.map((t, i) => ({
          ...t,
          orderIndex: i + 1,
          itemNumber: String(i + 1),
        })),
      };
    });
  };

  // --- Section 5: New Topics Handlers ---
  const addNewTopicRow = () => {
    if (readOnly) return;
    onChangeBundle((prev) => {
      const nextIdx = prev.newTopics.length + 1;
      return {
        ...prev,
        newTopics: [
          ...prev.newTopics,
          {
            id: generateSafeId('new'),
            minuteId: prev.minute.id,
            orderIndex: nextIdx,
            itemNumber: String(nextIdx),
            subject: '',
            discussionSummary: '',
            recommendationsAndDecisions: '',
            responsiblePerson: '',
            executionDate: '',
            ownerId: prev.minute.ownerId,
          },
        ],
      };
    });
  };

  const updateNewTopic = <K extends keyof NewTopicRow>(
    id: string,
    key: K,
    val: NewTopicRow[K]
  ) => {
    if (readOnly) return;
    const normalizedVal =
      typeof val === 'string' ? (toArabicNumerals(val) as NewTopicRow[K]) : val;
    onChangeBundle((prev) => ({
      ...prev,
      newTopics: prev.newTopics.map((n) => (n.id === id ? { ...n, [key]: normalizedVal } : n)),
    }));
  };

  const appendNewTopicSubRecommendation = (id: string) => {
    if (readOnly) return;
    onChangeBundle((prev) => ({
      ...prev,
      newTopics: prev.newTopics.map((n) => {
        if (n.id !== id) return n;
        const lines = n.recommendationsAndDecisions
          ? n.recommendationsAndDecisions.split('\n').filter(Boolean)
          : [];
        const nextNum = lines.length + 1;
        const updated = n.recommendationsAndDecisions
          ? `${n.recommendationsAndDecisions}\n${nextNum}- توصية إضافية: `
          : `1- `;
        return { ...n, recommendationsAndDecisions: updated };
      }),
    }));
  };

  const removeNewTopic = (id: string) => {
    if (readOnly) return;
    onChangeBundle((prev) => ({
      ...prev,
      newTopics: prev.newTopics
        .filter((n) => n.id !== id)
        .map((n, idx) => ({ ...n, orderIndex: idx + 1, itemNumber: String(idx + 1) })),
    }));
  };

  const moveNewTopic = (index: number, direction: 'up' | 'down') => {
    if (readOnly) return;
    onChangeBundle((prev) => {
      const copy = [...prev.newTopics];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= copy.length) return prev;
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return {
        ...prev,
        newTopics: copy.map((n, i) => ({
          ...n,
          orderIndex: i + 1,
          itemNumber: String(i + 1),
        })),
      };
    });
  };

  // Explicit user-initiated transfer of a New Topic to Ongoing Topics
  const transferNewTopicToOngoing = (topic: NewTopicRow) => {
    if (readOnly) return;
    onChangeBundle((prev) => {
      const nextIdx = prev.ongoingTopics.length + 1;
      const sourceLabel = `محضر رقم (${formatMinuteNumber(prev.minute.minuteNumber)}) لسنة ${prev.minute.year}`;
      const transferred: OngoingTopicRow = {
        id: generateSafeId('ong'),
        minuteId: prev.minute.id,
        orderIndex: nextIdx,
        itemNumber: String(nextIdx),
        subject: topic.subject,
        latestUpdates: topic.discussionSummary,
        recommendationOrAction: topic.recommendationsAndDecisions,
        followUpPerson: topic.responsiblePerson,
        followUpDate: topic.executionDate,
        topicStatus: 'مستمر - مرحّل',
        sourceMinuteId: prev.minute.id,
        sourceMinuteLabel: sourceLabel,
        historyLog: `[${sourceLabel}] تم ترحيله من قسم المواضيع الجديدة | المناقشة: ${
          topic.discussionSummary || '-'
        } | القرارات: ${topic.recommendationsAndDecisions || '-'}`,
        ownerId: prev.minute.ownerId,
      };
      return {
        ...prev,
        showOngoingTable: true,
        ongoingTopics: [...prev.ongoingTopics, transferred],
      };
    });
  };

  // --- Delete / Restore Section 4 & Section 5 + Manage Custom Tables ---
  const deleteOngoingSectionTable = () => {
    if (readOnly) return;
    onChangeBundle((prev) => ({
      ...prev,
      showOngoingTable: false,
      ongoingTopics: [],
    }));
  };

  const restoreOngoingSectionTable = () => {
    if (readOnly) return;
    onChangeBundle((prev) => ({
      ...prev,
      showOngoingTable: true,
    }));
  };

  const deleteNewTopicsSectionTable = () => {
    if (readOnly) return;
    onChangeBundle((prev) => ({
      ...prev,
      showNewTopicsTable: false,
      newTopics: [],
    }));
  };

  const restoreNewTopicsSectionTable = () => {
    if (readOnly) return;
    onChangeBundle((prev) => ({
      ...prev,
      showNewTopicsTable: true,
    }));
  };

  const addCustomTableSection = () => {
    if (readOnly) return;
    onChangeBundle((prev) => {
      const currentCustom = prev.customTables ?? [];
      const tableNum = currentCustom.length + 1;
      const defaultTitle =
        newTableTitleInput.trim() || `جدول إضافي (${tableNum}): بنود وموضوعات الاجتماع`;
      const newTable: CustomTableSection = {
        id: generateSafeId(`tbl_${tableNum}`),
        title: defaultTitle,
        rows: [
          {
            id: generateSafeId('ct_row'),
            orderIndex: 1,
            subject: '',
            recommendations: '',
            responsiblePerson: '',
            executionDate: '',
          },
        ],
      };
      return {
        ...prev,
        customTables: [...currentCustom, newTable],
      };
    });
    setNewTableTitleInput('');
  };

  const updateCustomTableTitle = (tableId: string, newTitle: string) => {
    if (readOnly) return;
    const normalizedTitle = toArabicNumerals(newTitle);
    onChangeBundle((prev) => ({
      ...prev,
      customTables: (prev.customTables ?? []).map((ct) =>
        ct.id === tableId ? { ...ct, title: normalizedTitle } : ct
      ),
    }));
  };

  const removeCustomTableSection = (tableId: string) => {
    if (readOnly) return;
    onChangeBundle((prev) => ({
      ...prev,
      customTables: (prev.customTables ?? []).filter((ct) => ct.id !== tableId),
    }));
  };

  const addCustomTableRow = (tableId: string) => {
    if (readOnly) return;
    onChangeBundle((prev) => ({
      ...prev,
      customTables: (prev.customTables ?? []).map((ct) => {
        if (ct.id !== tableId) return ct;
        const nextOrder = ct.rows.length + 1;
        return {
          ...ct,
          rows: [
            ...ct.rows,
            {
              id: generateSafeId('ct_row'),
              orderIndex: nextOrder,
              subject: '',
              recommendations: '',
              responsiblePerson: '',
              executionDate: '',
            },
          ],
        };
      }),
    }));
  };

  const updateCustomTableRow = <K extends keyof CustomTableRow>(
    tableId: string,
    rowId: string,
    key: K,
    val: CustomTableRow[K]
  ) => {
    if (readOnly) return;
    const normalizedVal =
      typeof val === 'string' ? (toArabicNumerals(val) as CustomTableRow[K]) : val;
    onChangeBundle((prev) => ({
      ...prev,
      customTables: (prev.customTables ?? []).map((ct) => {
        if (ct.id !== tableId) return ct;
        return {
          ...ct,
          rows: ct.rows.map((r) => (r.id === rowId ? { ...r, [key]: normalizedVal } : r)),
        };
      }),
    }));
  };

  const appendCustomTableSubRecommendation = (tableId: string, rowId: string) => {
    if (readOnly) return;
    onChangeBundle((prev) => ({
      ...prev,
      customTables: (prev.customTables ?? []).map((ct) => {
        if (ct.id !== tableId) return ct;
        return {
          ...ct,
          rows: ct.rows.map((r) => {
            if (r.id !== rowId) return r;
            const lines = r.recommendations
              ? r.recommendations.split('\n').filter(Boolean)
              : [];
            const nextNum = lines.length + 1;
            const updated = r.recommendations
              ? `${r.recommendations}\n${nextNum}- توصية إضافية: `
              : `1- `;
            return { ...r, recommendations: updated };
          }),
        };
      }),
    }));
  };

  const removeCustomTableRow = (tableId: string, rowId: string) => {
    if (readOnly) return;
    onChangeBundle((prev) => ({
      ...prev,
      customTables: (prev.customTables ?? []).map((ct) => {
        if (ct.id !== tableId) return ct;
        return {
          ...ct,
          rows: ct.rows
            .filter((r) => r.id !== rowId)
            .map((r, idx) => ({ ...r, orderIndex: idx + 1 })),
        };
      }),
    }));
  };

  const moveCustomTableRow = (tableId: string, index: number, direction: 'up' | 'down') => {
    if (readOnly) return;
    onChangeBundle((prev) => ({
      ...prev,
      customTables: (prev.customTables ?? []).map((ct) => {
        if (ct.id !== tableId) return ct;
        const copy = [...ct.rows];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= copy.length) return ct;
        const temp = copy[index];
        copy[index] = copy[targetIndex];
        copy[targetIndex] = temp;
        return {
          ...ct,
          rows: copy.map((r, i) => ({ ...r, orderIndex: i + 1 })),
        };
      }),
    }));
  };

  const getAttendanceBadgeClasses = (status: AttendanceStatus) => {
    if (status === 'present') {
      return 'bg-emerald-50 text-emerald-800 border-emerald-300';
    }
    if (status === 'absent') {
      return 'bg-red-50 text-red-800 border-red-300';
    }
    return 'bg-amber-50 text-amber-800 border-amber-300';
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Section 7: Top Action Control Bar (All 12 Required Buttons) */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>
                  {isExistingRecord ? 'تحرير محضر مسجل في قاعدة البيانات' : 'إنشاء محضر اجتماع جديد'}
                </span>
                <span>·</span>
                <span className="font-mono-num">
                  رقم ({formatMinuteNumber(minute.minuteNumber)}) / {minute.year}
                </span>
                {hasUnsavedChanges && (
                  <>
                    <span>·</span>
                    <span className="text-amber-700 font-semibold">تغييرات غير محفوظة (محفوظة مؤقتاً محلياً)</span>
                  </>
                )}
              </div>
              <h2 className="text-base font-bold text-slate-900 mt-0.5">
                {minute.mainSubject || `محضر اجتماع رقم (${formatMinuteNumber(minute.minuteNumber)}) لسنة ${minute.year}`}
              </h2>
            </div>
          </div>

          {/* 12 Control Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onBackToList}
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              العودة إلى قائمة المحاضر
            </button>

            {!readOnly && (
              <button
                type="button"
                onClick={() => {
                  // Reset to new minute via parent handler
                  onCancelChanges();
                }}
                className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                إلغاء التعديلات
              </button>
            )}

            {readOnly ? (
              minute.status === 'saved' && !canAuthorizeManualNumber ? (
                <span className="px-3 py-2 text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-200 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0">
                  <Lock className="w-3.5 h-3.5 text-amber-700" />
                  محضر معتمد — للمعاينة فقط (التعديل للمدير المخوّل)
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onEnableEditMode}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-800 hover:bg-blue-900 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  تعديل المحضر
                </button>
              )
            ) : (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={onSaveDraft}
                  className="px-3.5 py-2 text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-300 hover:bg-amber-100 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'جاري الحفظ...' : 'حفظ كمسودة'}
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={onSaveFinal}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'جاري الاعتماد...' : 'حفظ واعتماد المحضر'}
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onPreview}
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Eye className="w-3.5 h-3.5" />
              معاينة المحضر
            </button>

            <button
              type="button"
              onClick={onPrint}
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              طباعة المحضر
            </button>

            <button
              type="button"
              onClick={onExportPdf}
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <FileDown className="w-3.5 h-3.5" />
              تصدير PDF
            </button>

            <button
              type="button"
              onClick={onExportWord}
              className="px-3 py-2 text-xs font-semibold text-indigo-900 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <FileDown className="w-3.5 h-3.5" />
              تصدير Word
            </button>

            {isExistingRecord &&
              canArchiveOrRestore &&
              (minute.status !== 'saved' || canAuthorizeManualNumber) &&
              (minute.status === 'archived' ? (
                <button
                  type="button"
                  onClick={onRestore}
                  className="px-3 py-2 text-xs font-semibold text-emerald-900 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <ArchiveRestore className="w-3.5 h-3.5" />
                  استعادة المحضر من الأرشيف
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onArchive}
                  className="px-3 py-2 text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-300 hover:bg-amber-100 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Archive className="w-3.5 h-3.5" />
                  أرشفة المحضر
                </button>
              ))}
          </div>
        </div>
      </div>

      {/* SECTION 1: Meeting Metadata */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4 mb-5">
          <div>
            <h3 className="text-base font-bold text-slate-900">أولاً: بيانات الاجتماع</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              يتم اقتراح رقم المحضر التالي تلقائياً وفق التسلسل السنوي مع التحقق من عدم التكرار في قاعدة البيانات
            </p>
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={() => setIsImportTemplateOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              استيراد محضر أو قائمة الحضور حرفياً
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Minute Number */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">رقم المحضر</label>
              {canAuthorizeManualNumber && !readOnly && (
                <button
                  type="button"
                  onClick={() => setManualNumberUnlocked((v) => !v)}
                  className="text-[11px] font-medium text-blue-800 hover:underline flex items-center gap-1"
                >
                  {manualNumberUnlocked ? (
                    <>
                      <Unlock className="w-3 h-3" />
                      التعديل اليدوي مفعّل
                    </>
                  ) : (
                    <>
                      <Lock className="w-3 h-3" />
                      تعديل الرقم يدوياً (للمخوّل)
                    </>
                  )}
                </button>
              )}
            </div>
            <input
              type="text"
              inputMode="numeric"
              lang="en-GB"
              dir="ltr"
              value={
                editingMinuteNumberText !== null
                  ? editingMinuteNumberText
                  : formatMinuteNumber(minute.minuteNumber)
              }
              disabled={readOnly || !manualNumberUnlocked}
              onFocus={() => setEditingMinuteNumberText(formatMinuteNumber(minute.minuteNumber))}
              onChange={(e) => {
                const rawDigits = toArabicNumerals(e.target.value).replace(/[^0-9]/g, '');
                setEditingMinuteNumberText(rawDigits);
                const parsed = parseInt(rawDigits, 10);
                if (!Number.isNaN(parsed) && parsed >= 1) {
                  updateMinuteField('minuteNumber', parsed);
                }
              }}
              onBlur={() => {
                const parsed = parseInt(editingMinuteNumberText || '', 10);
                const finalNum = Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
                updateMinuteField('minuteNumber', finalNum);
                setEditingMinuteNumberText(null);
              }}
              className="w-full px-3.5 py-2 text-sm font-mono-num font-bold text-right border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700 disabled:bg-slate-100 disabled:text-slate-700"
            />
          </div>

          {/* Year */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              سنة الاجتماع
            </label>
            <input
              type="number"
              lang="en-GB"
              min={2000}
              max={2100}
              value={minute.year}
              disabled={readOnly}
              onChange={(e) => {
                const yr = Number(toArabicNumerals(e.target.value)) || new Date().getFullYear();
                updateMinuteField('year', yr);
                if (!isExistingRecord) {
                  onYearChangeSuggestNumber(yr);
                }
              }}
              className="w-full px-3.5 py-2 text-sm font-mono-num border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700 disabled:bg-slate-100"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              مكان الاجتماع
            </label>
            <input
              type="text"
              value={minute.location}
              disabled={readOnly}
              onChange={(e) => updateMinuteField('location', e.target.value)}
              placeholder="مثال: قاعة الاجتماعات الرئيسية - المقر الرئيسي"
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700 disabled:bg-slate-100"
            />
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              تاريخ الاجتماع (Date Picker)
            </label>
            <input
              type="date"
              lang="en-GB"
              value={minute.date}
              disabled={readOnly}
              onChange={(e) => updateMinuteField('date', e.target.value)}
              className="w-full px-3.5 py-2 text-sm font-mono-num border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700 disabled:bg-slate-100"
            />
          </div>

          {/* Time Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              وقت الاجتماع (Time Picker)
            </label>
            <input
              type="time"
              lang="en-GB"
              value={minute.time}
              disabled={readOnly}
              onChange={(e) => updateMinuteField('time', e.target.value)}
              className="w-full px-3.5 py-2 text-sm font-mono-num border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700 disabled:bg-slate-100"
            />
          </div>

          {/* Optional Main Subject */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              موضوع الاجتماع الرئيسي (اختياري)
            </label>
            <input
              type="text"
              value={minute.mainSubject}
              disabled={readOnly}
              onChange={(e) => updateMinuteField('mainSubject', e.target.value)}
              placeholder="موضوع أو عنوان الاجتماع العام..."
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700 disabled:bg-slate-100"
            />
          </div>
        </div>
      </div>

      {/* SECTION 2: Participants & Attendance Table */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4 mb-5">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              ثانياً: جدول الحضور والمشاركين ({participants.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              إضافة عدد غير محدود من المشاركين، اختيار من سجل المشاركين أو إدخال يدوي، مع إعادة الترقيم التلقائي عند الحذف أو الترتيب
            </p>
          </div>

          {!readOnly && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <select
                  value={selectedDirectoryEmpId}
                  onChange={(e) => setSelectedDirectoryEmpId(e.target.value)}
                  className="px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-700"
                >
                  <option value="">-- اختيار موظف من سجل المشاركين --</option>
                  {employeeDirectory.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} — {emp.jobTitle}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!selectedDirectoryEmpId}
                  onClick={handleSelectFromDirectory}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md disabled:opacity-40 whitespace-nowrap shrink-0"
                >
                  إدراج في الجدول
                </button>
              </div>

              {employeeDirectory.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onChangeBundle((prev) => {
                      const existingNames = new Set(prev.participants.map((p) => p.name.trim()));
                      const toAdd = employeeDirectory
                        .filter((emp) => !existingNames.has(emp.name.trim()))
                        .map((emp, idx) => ({
                          id: generateSafeId(`p_dir_${idx}`),
                          minuteId: prev.minute.id,
                          orderIndex: prev.participants.length + idx + 1,
                          name: emp.name,
                          jobTitle: emp.jobTitle,
                          attendanceStatus: 'present' as AttendanceStatus,
                          notes: '',
                          ownerId: prev.minute.ownerId,
                        }));
                      return {
                        ...prev,
                        participants: [...prev.participants, ...toAdd],
                      };
                    });
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-blue-900 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-md whitespace-nowrap shrink-0"
                >
                  إدراج جميع أعضاء السجل ({employeeDirectory.length})
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowAddDirForm((v) => !v)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <UserPlus className="w-3.5 h-3.5" />
                حفظ موظف جديد بالسجل
              </button>

              <button
                type="button"
                onClick={() => addParticipantRow('', '')}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-800 hover:bg-blue-900 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                إضافة مشارك يدوياً
              </button>
            </div>
          )}
        </div>

        {/* Optional Quick Add to Persistent Employee Directory */}
        {showAddDirForm && !readOnly && (
          <div className="mb-4 p-4 bg-slate-50 border border-slate-200 rounded-md flex flex-col sm:flex-row items-end gap-3">
            <div className="flex-1 w-full">
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                اسم الموظف لحفظه في سجل المشاركين الدائم
              </label>
              <input
                type="text"
                value={newDirName}
                onChange={(e) => setNewDirName(e.target.value)}
                placeholder="الاسم الكامل..."
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded bg-white"
              />
            </div>
            <div className="flex-1 w-full">
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                المسمى الوظيفي
              </label>
              <input
                type="text"
                value={newDirTitle}
                onChange={(e) => setNewDirTitle(e.target.value)}
                placeholder="المسمى الوظيفي..."
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded bg-white"
              />
            </div>
            <button
              type="button"
              onClick={async () => {
                if (!newDirName.trim()) return;
                await onAddDirectoryEmployee(newDirName, newDirTitle);
                addParticipantRow(newDirName, newDirTitle);
                setNewDirName('');
                setNewDirTitle('');
                setShowAddDirForm(false);
              }}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded whitespace-nowrap shrink-0"
            >
              حفظ في السجل وإضافة للجدول
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse border border-slate-200">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
                <th className="py-3 px-3 border-l border-slate-200 w-12 text-center">م</th>
                <th className="py-3 px-3 border-l border-slate-200 min-w-[200px]">الاسم</th>
                <th className="py-3 px-3 border-l border-slate-200 min-w-[180px]">المسمى الوظيفي</th>
                <th className="py-3 px-3 border-l border-slate-200 w-44">حالة الحضور</th>
                <th className="py-3 px-3 border-l border-slate-200 min-w-[200px]">ملاحظات</th>
                {!readOnly && <th className="py-3 px-3 w-28 text-center">الترتيب / حذف</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {participants.length === 0 ? (
                <tr>
                  <td colSpan={readOnly ? 5 : 6} className="py-8 text-center text-slate-500">
                    لا يوجد مشاركون مضافون حالياً. اضغط على «إضافة مشارك يدوياً» أو اختر من سجل المشاركين أو استورد القائمة حرفياً.
                  </td>
                </tr>
              ) : (
                participants.map((p, index) => (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-3 border-l border-slate-200 text-center font-mono-num font-bold text-slate-700">
                      {index + 1}
                    </td>
                    <td className="py-2 px-2.5 border-l border-slate-200">
                      <input
                        type="text"
                        value={p.name}
                        disabled={readOnly}
                        onChange={(e) => updateParticipant(p.id, 'name', e.target.value)}
                        placeholder="اسم المشارك..."
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-700 disabled:bg-transparent disabled:border-transparent"
                      />
                    </td>
                    <td className="py-2 px-2.5 border-l border-slate-200">
                      <input
                        type="text"
                        value={p.jobTitle}
                        disabled={readOnly}
                        onChange={(e) => updateParticipant(p.id, 'jobTitle', e.target.value)}
                        placeholder="المسمى الوظيفي..."
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-700 disabled:bg-transparent disabled:border-transparent"
                      />
                    </td>
                    <td className="py-2 px-2.5 border-l border-slate-200">
                      <div className="flex items-center gap-1.5">
                        {p.attendanceStatus === 'present' && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        )}
                        {p.attendanceStatus === 'absent' && (
                          <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                        )}
                        {p.attendanceStatus === 'excused' && (
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        )}
                        <select
                          value={p.attendanceStatus}
                          disabled={readOnly}
                          onChange={(e) =>
                            updateParticipant(
                              p.id,
                              'attendanceStatus',
                              e.target.value as AttendanceStatus
                            )
                          }
                          className={`w-full px-2 py-1 text-xs font-semibold border rounded focus:outline-none ${getAttendanceBadgeClasses(
                            p.attendanceStatus
                          )}`}
                        >
                          <option value="present">حاضر</option>
                          <option value="absent">غائب</option>
                          <option value="excused">معتذر</option>
                        </select>
                      </div>
                    </td>
                    <td className="py-2 px-2.5 border-l border-slate-200">
                      <input
                        type="text"
                        value={p.notes}
                        disabled={readOnly}
                        onChange={(e) => updateParticipant(p.id, 'notes', e.target.value)}
                        placeholder="ملاحظات الحضور..."
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-700 disabled:bg-transparent disabled:border-transparent"
                      />
                    </td>
                    {!readOnly && (
                      <td className="py-2 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => moveParticipant(index, 'up')}
                            className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                            title="تحريك لأعلى"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={index === participants.length - 1}
                            onClick={() => moveParticipant(index, 'down')}
                            className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                            title="تحريك لأسفل"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeParticipant(p.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="حذف المشارك"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 3: Meeting Inputs and Outcomes */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4 mb-5">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              ثالثاً: مدخلات ونتائج الاجتماع مفصلة أدناه
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              دعم النصوص الطويلة وتعدد التوصيات المرتبطة بالموضوع الواحد مع تعيين مسؤول التنفيذ وتاريخ التنفيذ
            </p>
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={addOutcomeRow}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-800 hover:bg-blue-900 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              إضافة موضوع وتوصيات
            </button>
          )}
        </div>

        <datalist id="outcome-participants-list">
          {participantNamesList.map((name, idx) => (
            <option key={`${name}-${idx}`} value={name} />
          ))}
        </datalist>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse border border-slate-200">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
                <th className="py-3 px-3 border-l border-slate-200 w-12 text-center">م</th>
                <th className="py-3 px-3 border-l border-slate-200 min-w-[240px]">الموضوع</th>
                <th className="py-3 px-3 border-l border-slate-200 min-w-[280px]">التوصيات</th>
                <th className="py-3 px-3 border-l border-slate-200 w-48">مسؤولية التنفيذ</th>
                <th className="py-3 px-3 border-l border-slate-200 w-40">تاريخ التنفيذ</th>
                {!readOnly && <th className="py-3 px-3 w-28 text-center">إجراءات</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {outcomes.length === 0 ? (
                <tr>
                  <td colSpan={readOnly ? 5 : 6} className="py-8 text-center text-slate-500">
                    لا توجد مدخلات أو نتائج مضافة بعد. اضغط على «إضافة موضوع وتوصيات» لإدراج بند جديد.
                  </td>
                </tr>
              ) : (
                outcomes.map((o, index) => (
                  <tr key={o.id} className="align-top hover:bg-slate-50/60">
                    <td className="py-3 px-3 border-l border-slate-200 text-center font-mono-num font-bold text-slate-700">
                      {index + 1}
                    </td>
                    <td className="py-2.5 px-2.5 border-l border-slate-200">
                      <textarea
                        rows={3}
                        value={o.subject}
                        disabled={readOnly}
                        onChange={(e) => updateOutcome(o.id, 'subject', e.target.value)}
                        placeholder="اكتب الموضوع بالتفصيل..."
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-700 resize-y disabled:bg-transparent"
                      />
                    </td>
                    <td className="py-2.5 px-2.5 border-l border-slate-200 space-y-1.5">
                      <textarea
                        rows={3}
                        value={o.recommendations}
                        disabled={readOnly}
                        onChange={(e) => updateOutcome(o.id, 'recommendations', e.target.value)}
                        placeholder="أدخل التوصية أو عدة توصيات مرتبطة بهذا الموضوع..."
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-700 resize-y disabled:bg-transparent"
                      />
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => appendSubRecommendation(o.id)}
                          className="text-[11px] font-medium text-blue-800 hover:underline flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          إدراج توصية فرعية مرقمة لهذا الموضوع
                        </button>
                      )}
                    </td>
                    <td className="py-2.5 px-2.5 border-l border-slate-200">
                      <input
                        type="text"
                        list="outcome-participants-list"
                        value={o.responsiblePerson}
                        disabled={readOnly}
                        onChange={(e) => updateOutcome(o.id, 'responsiblePerson', e.target.value)}
                        placeholder="اختر أو اكتب المسؤول..."
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-700 disabled:bg-transparent"
                      />
                    </td>
                    <td className="py-2.5 px-2.5 border-l border-slate-200">
                      <input
                        type="date"
                        lang="en-GB"
                        value={o.executionDate}
                        disabled={readOnly}
                        onChange={(e) => updateOutcome(o.id, 'executionDate', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs font-mono-num border border-slate-200 rounded focus:outline-none focus:border-blue-700 disabled:bg-transparent"
                      />
                    </td>
                    {!readOnly && (
                      <td className="py-2.5 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => moveOutcome(index, 'up')}
                            className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={index === outcomes.length - 1}
                            onClick={() => moveOutcome(index, 'down')}
                            className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeOutcome(o.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 4: Ongoing Topics (Can be deleted/hidden by user) */}
      {showOngoingTable && (
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4 mb-5">
            <div>
              <h3 className="text-base font-bold text-slate-900">رابعاً: المواضيع المستمرة</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                متابعة المواضيع المرحلة من اجتماعات سابقة مع الاحتفاظ بسجلها التاريخي الكامل دون تعديل المحاضر السابقة
              </p>
            </div>
            {!readOnly && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportOngoingOpen(true)}
                  className="px-3 py-1.5 text-xs font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <History className="w-3.5 h-3.5" />
                  استيراد موضوع من محضر سابق
                </button>
                <button
                  type="button"
                  onClick={() => addOngoingTopicRow()}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-800 hover:bg-blue-900 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  إضافة موضوع مستمر
                </button>
                <button
                  type="button"
                  onClick={deleteOngoingSectionTable}
                  className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  title="حذف جدول المواضيع المستمرة من هذا المحضر"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  حذف الجدول
                </button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse border border-slate-200">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
                  <th className="py-3 px-3 border-l border-slate-200 w-12 text-center">م</th>
                  <th className="py-3 px-3 border-l border-slate-200 min-w-[240px]">الموضوع</th>
                  <th className="py-3 px-3 border-l border-slate-200 min-w-[280px]">التوصيات</th>
                  <th className="py-3 px-3 border-l border-slate-200 w-48">مسؤولية التنفيذ</th>
                  <th className="py-3 px-3 border-l border-slate-200 w-40">تاريخ التنفيذ</th>
                  {!readOnly && <th className="py-3 px-3 w-28 text-center">إجراءات</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {ongoingTopics.length === 0 ? (
                  <tr>
                    <td colSpan={readOnly ? 5 : 6} className="py-8 text-center text-slate-500">
                      لا توجد مواضيع مستمرة مسجلة. يمكنك إضافة موضوع مستمر أو استيراد موضوع من محضر اجتماع سابق.
                    </td>
                  </tr>
                ) : (
                  ongoingTopics.map((t, index) => (
                    <React.Fragment key={t.id}>
                      <tr className="align-top hover:bg-slate-50/60">
                        <td className="py-3 px-3 border-l border-slate-200 text-center font-mono-num font-bold text-slate-700">
                          {index + 1}
                        </td>
                        <td className="py-2.5 px-2.5 border-l border-slate-200 space-y-1.5">
                          <textarea
                            rows={3}
                            value={t.subject}
                            disabled={readOnly}
                            onChange={(e) => updateOngoingTopic(t.id, 'subject', e.target.value)}
                            placeholder="اكتب الموضوع بالتفصيل..."
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-700 resize-y disabled:bg-transparent"
                          />
                          {t.sourceMinuteLabel && (
                            <div className="flex items-center justify-between text-[11px] text-blue-800 bg-blue-50/70 px-2 py-1 rounded">
                              <span>مرتبط بـ: {t.sourceMinuteLabel}</span>
                              {t.historyLog && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedHistoryId(expandedHistoryId === t.id ? null : t.id)
                                  }
                                  className="underline font-semibold mr-2"
                                >
                                  {expandedHistoryId === t.id ? 'إخفاء السجل' : 'عرض السجل السابق'}
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-2.5 border-l border-slate-200 space-y-1.5">
                          <textarea
                            rows={3}
                            value={t.recommendationOrAction}
                            disabled={readOnly}
                            onChange={(e) =>
                              updateOngoingTopic(t.id, 'recommendationOrAction', e.target.value)
                            }
                            placeholder="أدخل التوصية أو عدة توصيات مرتبطة بهذا الموضوع..."
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-700 resize-y disabled:bg-transparent"
                          />
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={() => appendOngoingSubRecommendation(t.id)}
                              className="text-[11px] font-medium text-blue-800 hover:underline flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              إدراج توصية فرعية مرقمة لهذا الموضوع
                            </button>
                          )}
                        </td>
                        <td className="py-2.5 px-2.5 border-l border-slate-200">
                          <input
                            type="text"
                            list="outcome-participants-list"
                            value={t.followUpPerson}
                            disabled={readOnly}
                            onChange={(e) =>
                              updateOngoingTopic(t.id, 'followUpPerson', e.target.value)
                            }
                            placeholder="اختر أو اكتب المسؤول..."
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-700 disabled:bg-transparent"
                          />
                        </td>
                        <td className="py-2.5 px-2.5 border-l border-slate-200">
                          <input
                            type="date"
                            lang="en-GB"
                            value={t.followUpDate}
                            disabled={readOnly}
                            onChange={(e) => updateOngoingTopic(t.id, 'followUpDate', e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs font-mono-num border border-slate-200 rounded focus:outline-none focus:border-blue-700 disabled:bg-transparent"
                          />
                        </td>
                        {!readOnly && (
                          <td className="py-2.5 px-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => moveOngoingTopic(index, 'up')}
                                className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={index === ongoingTopics.length - 1}
                                onClick={() => moveOngoingTopic(index, 'down')}
                                className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeOngoingTopic(t.id)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                      {expandedHistoryId === t.id && t.historyLog && (
                        <tr className="bg-slate-50">
                          <td colSpan={readOnly ? 5 : 6} className="px-4 py-3 text-xs text-slate-700">
                            <div className="font-bold text-slate-900 mb-1">
                              السجل التاريخي للموضوع في المحاضر السابقة (محفوظ دون تعديل):
                            </div>
                            <pre className="whitespace-pre-wrap font-sans text-xs text-slate-600 bg-white p-3 border border-slate-200 rounded">
                              {t.historyLog}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 5: New Topics (Can be deleted/hidden by user) */}
      {showNewTopicsTable && (
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4 mb-5">
            <div>
              <h3 className="text-base font-bold text-slate-900">خامساً: المواضيع الجديدة</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                جدول مستقل للمواضيع الجديدة المطروحة في الاجتماع، ولا تُدمج مع المواضيع المستمرة إلا باختيار صريح من المستخدم
              </p>
            </div>
            {!readOnly && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={addNewTopicRow}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-800 hover:bg-blue-900 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  إضافة موضوع جديد
                </button>
                <button
                  type="button"
                  onClick={deleteNewTopicsSectionTable}
                  className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  title="حذف جدول المواضيع الجديدة من هذا المحضر"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  حذف الجدول
                </button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse border border-slate-200">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
                  <th className="py-3 px-3 border-l border-slate-200 w-12 text-center">م</th>
                  <th className="py-3 px-3 border-l border-slate-200 min-w-[240px]">الموضوع</th>
                  <th className="py-3 px-3 border-l border-slate-200 min-w-[280px]">التوصيات</th>
                  <th className="py-3 px-3 border-l border-slate-200 w-48">مسؤولية التنفيذ</th>
                  <th className="py-3 px-3 border-l border-slate-200 w-40">تاريخ التنفيذ</th>
                  {!readOnly && <th className="py-3 px-3 w-28 text-center">إجراءات</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {newTopics.length === 0 ? (
                  <tr>
                    <td colSpan={readOnly ? 5 : 6} className="py-8 text-center text-slate-500">
                      لا توجد مواضيع جديدة مضافة في هذا الاجتماع. اضغط على «إضافة موضوع جديد» لإدراج بند.
                    </td>
                  </tr>
                ) : (
                  newTopics.map((n, index) => (
                    <tr key={n.id} className="align-top hover:bg-slate-50/60">
                      <td className="py-3 px-3 border-l border-slate-200 text-center font-mono-num font-bold text-slate-700">
                        {index + 1}
                      </td>
                      <td className="py-2.5 px-2.5 border-l border-slate-200">
                        <textarea
                          rows={3}
                          value={n.subject}
                          disabled={readOnly}
                          onChange={(e) => updateNewTopic(n.id, 'subject', e.target.value)}
                          placeholder="اكتب الموضوع بالتفصيل..."
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-700 resize-y disabled:bg-transparent"
                        />
                      </td>
                      <td className="py-2.5 px-2.5 border-l border-slate-200 space-y-1.5">
                        <textarea
                          rows={3}
                          value={n.recommendationsAndDecisions}
                          disabled={readOnly}
                          onChange={(e) =>
                            updateNewTopic(n.id, 'recommendationsAndDecisions', e.target.value)
                          }
                          placeholder="أدخل التوصية أو عدة توصيات مرتبطة بهذا الموضوع..."
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-700 resize-y disabled:bg-transparent"
                        />
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => appendNewTopicSubRecommendation(n.id)}
                            className="text-[11px] font-medium text-blue-800 hover:underline flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            إدراج توصية فرعية مرقمة لهذا الموضوع
                          </button>
                        )}
                      </td>
                      <td className="py-2.5 px-2.5 border-l border-slate-200">
                        <input
                          type="text"
                          list="outcome-participants-list"
                          value={n.responsiblePerson}
                          disabled={readOnly}
                          onChange={(e) => updateNewTopic(n.id, 'responsiblePerson', e.target.value)}
                          placeholder="اختر أو اكتب المسؤول..."
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-700 disabled:bg-transparent"
                        />
                      </td>
                      <td className="py-2.5 px-2.5 border-l border-slate-200">
                        <input
                          type="date"
                          lang="en-GB"
                          value={n.executionDate}
                          disabled={readOnly}
                          onChange={(e) => updateNewTopic(n.id, 'executionDate', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs font-mono-num border border-slate-200 rounded focus:outline-none focus:border-blue-700 disabled:bg-transparent"
                        />
                      </td>
                      {!readOnly && (
                        <td className="py-2.5 px-2 text-center space-y-1.5">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => moveNewTopic(index, 'up')}
                              className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={index === newTopics.length - 1}
                              onClick={() => moveNewTopic(index, 'down')}
                              className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeNewTopic(n.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => transferNewTopicToOngoing(n)}
                            className="w-full px-2 py-1 text-[10px] font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 rounded flex items-center justify-center gap-1"
                            title="نقل هذا الموضوع إلى قسم المواضيع المستمرة باختيارك الصريح"
                          >
                            <CornerDownLeft className="w-3 h-3" />
                            نقل للمستمرة
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CUSTOM ADDED TABLES (Matches Section 3 Columns 100%) */}
      {customTables.map((ct) => (
        <div key={ct.id} className="bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4 mb-5">
            <div className="flex-1 max-w-xl">
              {readOnly ? (
                <h3 className="text-base font-bold text-slate-900">{ct.title}</h3>
              ) : (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    عنوان الجدول (قابل للتعديل)
                  </label>
                  <input
                    type="text"
                    value={ct.title}
                    onChange={(e) => updateCustomTableTitle(ct.id, e.target.value)}
                    placeholder="اكتب عنوان الجدول..."
                    className="w-full px-3 py-1.5 text-sm font-bold text-slate-900 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                </div>
              )}
            </div>
            {!readOnly && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => addCustomTableRow(ct.id)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-800 hover:bg-blue-900 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  إضافة موضوع وتوصيات
                </button>
                <button
                  type="button"
                  onClick={() => removeCustomTableSection(ct.id)}
                  className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  title="حذف هذا الجدول بالكامل"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  حذف الجدول
                </button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse border border-slate-200">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
                  <th className="py-3 px-3 border-l border-slate-200 w-12 text-center">م</th>
                  <th className="py-3 px-3 border-l border-slate-200 min-w-[240px]">الموضوع</th>
                  <th className="py-3 px-3 border-l border-slate-200 min-w-[280px]">التوصيات</th>
                  <th className="py-3 px-3 border-l border-slate-200 w-48">مسؤولية التنفيذ</th>
                  <th className="py-3 px-3 border-l border-slate-200 w-40">تاريخ التنفيذ</th>
                  {!readOnly && <th className="py-3 px-3 w-28 text-center">إجراءات</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {ct.rows.length === 0 ? (
                  <tr>
                    <td colSpan={readOnly ? 5 : 6} className="py-8 text-center text-slate-500">
                      لا توجد بنود مضافة في هذا الجدول بعد. اضغط على «إضافة موضوع وتوصيات» لإدراج بند جديد.
                    </td>
                  </tr>
                ) : (
                  ct.rows.map((r, index) => (
                    <tr key={r.id} className="align-top hover:bg-slate-50/60">
                      <td className="py-3 px-3 border-l border-slate-200 text-center font-mono-num font-bold text-slate-700">
                        {index + 1}
                      </td>
                      <td className="py-2.5 px-2.5 border-l border-slate-200">
                        <textarea
                          rows={3}
                          value={r.subject}
                          disabled={readOnly}
                          onChange={(e) =>
                            updateCustomTableRow(ct.id, r.id, 'subject', e.target.value)
                          }
                          placeholder="اكتب الموضوع بالتفصيل..."
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-700 resize-y disabled:bg-transparent"
                        />
                      </td>
                      <td className="py-2.5 px-2.5 border-l border-slate-200 space-y-1.5">
                        <textarea
                          rows={3}
                          value={r.recommendations}
                          disabled={readOnly}
                          onChange={(e) =>
                            updateCustomTableRow(ct.id, r.id, 'recommendations', e.target.value)
                          }
                          placeholder="أدخل التوصية أو عدة توصيات مرتبطة بهذا الموضوع..."
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-700 resize-y disabled:bg-transparent"
                        />
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => appendCustomTableSubRecommendation(ct.id, r.id)}
                            className="text-[11px] font-medium text-blue-800 hover:underline flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            إدراج توصية فرعية مرقمة لهذا الموضوع
                          </button>
                        )}
                      </td>
                      <td className="py-2.5 px-2.5 border-l border-slate-200">
                        <input
                          type="text"
                          list="outcome-participants-list"
                          value={r.responsiblePerson}
                          disabled={readOnly}
                          onChange={(e) =>
                            updateCustomTableRow(ct.id, r.id, 'responsiblePerson', e.target.value)
                          }
                          placeholder="اختر أو اكتب المسؤول..."
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-700 disabled:bg-transparent"
                        />
                      </td>
                      <td className="py-2.5 px-2.5 border-l border-slate-200">
                        <input
                          type="date"
                          lang="en-GB"
                          value={r.executionDate}
                          disabled={readOnly}
                          onChange={(e) =>
                            updateCustomTableRow(ct.id, r.id, 'executionDate', e.target.value)
                          }
                          className="w-full px-2.5 py-1.5 text-xs font-mono-num border border-slate-200 rounded focus:outline-none focus:border-blue-700 disabled:bg-transparent"
                        />
                      </td>
                      {!readOnly && (
                        <td className="py-2.5 px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => moveCustomTableRow(ct.id, index, 'up')}
                              className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={index === ct.rows.length - 1}
                              onClick={() => moveCustomTableRow(ct.id, index, 'down')}
                              className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeCustomTableRow(ct.id, r.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* ADD NEW TABLE / RESTORE DELETED TABLES BAR */}
      {!readOnly && (
        <div className="bg-slate-100 border border-dashed border-slate-300 rounded-lg p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-900">إدارة وإضافة جداول المحضر</h4>
            <p className="text-xs text-slate-600">
              يمكنك إضافة جدول جديد بنفس هيكل الأعمدة المعتمد (م، الموضوع، التوصيات، مسؤولية التنفيذ، تاريخ التنفيذ) أو استعادة الجداول المحذوفة
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {!showOngoingTable && (
              <button
                type="button"
                onClick={restoreOngoingSectionTable}
                className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5 text-blue-800" />
                استعادة جدول «رابعاً: المواضيع المستمرة»
              </button>
            )}

            {!showNewTopicsTable && (
              <button
                type="button"
                onClick={restoreNewTopicsSectionTable}
                className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5 text-blue-800" />
                استعادة جدول «خامساً: المواضيع الجديدة»
              </button>
            )}

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newTableTitleInput}
                onChange={(e) => setNewTableTitleInput(e.target.value)}
                placeholder="عنوان الجدول الجديد (اختياري)..."
                className="px-3 py-2 text-xs border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-700 w-56"
              />
              <button
                type="button"
                onClick={addCustomTableSection}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-800 hover:bg-blue-900 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                إضافة جدول جديد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 6: Approvals & Signatures */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="border-b border-slate-200 pb-4 mb-5">
          <h3 className="text-base font-bold text-slate-900">سادساً: الاعتماد والتوقيعات</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            تحديد مقرر الاجتماع ورئيس الاجتماع من سجل المشاركين أو يدوياً، مع إمكانية إرفاق صورة التوقيع من المرفقات أو الرسم الإلكتروني أو التوقيع النصي
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SignaturePad
            label="مقرر الاجتماع"
            nameValue={minute.secretaryName}
            onNameChange={(val) => updateMinuteField('secretaryName', val)}
            signatureValue={minute.secretarySignature}
            onSignatureChange={(val) => updateMinuteField('secretarySignature', val)}
            participantOptions={participantNamesList}
            disabled={readOnly}
          />

          <SignaturePad
            label="رئيس الاجتماع"
            nameValue={minute.chairmanName}
            onNameChange={(val) => updateMinuteField('chairmanName', val)}
            signatureValue={minute.chairmanSignature}
            onSignatureChange={(val) => updateMinuteField('chairmanSignature', val)}
            participantOptions={participantNamesList}
            disabled={readOnly}
          />
        </div>
      </div>

      {/* Modals */}
      <ImportOngoingModal
        isOpen={isImportOngoingOpen}
        onClose={() => setIsImportOngoingOpen(false)}
        allMinutes={allMinutes}
        currentMinuteId={minute.id}
        ownerId={minute.ownerId}
        onImportTopic={(topic) => {
          addOngoingTopicRow(topic);
          setIsImportOngoingOpen(false);
        }}
      />

      <ImportOriginalTemplateModal
        isOpen={isImportTemplateOpen}
        onClose={() => setIsImportTemplateOpen(false)}
        ownerId={minute.ownerId}
        currentMinuteId={minute.id}
        onImportParticipantsOnly={(importedParticipants) => {
          onChangeBundle((prev) => ({
            ...prev,
            participants: [
              ...prev.participants,
              ...importedParticipants.map((p, idx) => ({
                ...p,
                orderIndex: prev.participants.length + idx + 1,
              })),
            ],
          }));
        }}
        onImportFullMinute={(importedBundle) => {
          onChangeBundle((prev) => ({
            minute: {
              ...prev.minute,
              ...(importedBundle.minute || {}),
              id: prev.minute.id,
              ownerId: prev.minute.ownerId,
            },
            participants: importedBundle.participants ?? prev.participants,
            outcomes: importedBundle.outcomes ?? prev.outcomes,
            ongoingTopics: importedBundle.ongoingTopics ?? prev.ongoingTopics,
            newTopics: importedBundle.newTopics ?? prev.newTopics,
          }));
        }}
      />
    </div>
  );
};
