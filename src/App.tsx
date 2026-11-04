import React, { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import {
  FilePlus,
  Printer,
  FileDown,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  X,
  ArrowRight,
  Users,
  Trash2,
  UserCheck,
  LogOut,
  Lock,
} from 'lucide-react';
import {
  db,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  FullMinuteBundle,
  MinuteRecord,
  EmployeeDirectoryItem,
} from './types/minutes';
import {
  DEFAULT_WORKSPACE_OWNER_ID,
  OFFICIAL_PARTICIPANTS_DIRECTORY,
  seedOfficialParticipantsDirectory,
  generateSafeId,
  getNextSequentialMinuteNumber,
  loadFullMinute,
  saveFullMinuteToDb,
  updateMinuteArchiveState,
  deleteFullMinuteFromDb,
  addEmployeeToDirectory,
  removeEmployeeFromDirectory,
} from './services/minutesService';
import { exportMinuteToDocx } from './utils/docxExport';
import { formatMinuteNumber } from './utils/numerals';
import {
  getOfficialMinuteFileBaseName,
  triggerOfficialMinutePrint,
} from './utils/printMinute';
import { ActiveMinutesTab } from './components/ActiveMinutesTab';
import { ApprovedMinutesTab } from './components/ApprovedMinutesTab';
import { ArchivedMinutesTab } from './components/ArchivedMinutesTab';
import { MinuteEditorView } from './components/MinuteEditorView';
import { OfficialMinutePrintView } from './components/OfficialMinutePrintView';
import { LoginView } from './components/LoginView';

type ActiveTab = 'editor' | 'active_list' | 'approved_list' | 'archived_list' | 'directory' | 'preview';

type UserRole = 'admin' | 'secretary' | 'viewer';

const LOCAL_AUTOSAVE_KEY = 'saaed_minutes_autosave_v1';

function createEmptyBundle(
  uid: string,
  userName: string,
  year: number,
  nextNum: number,
  directory: EmployeeDirectoryItem[] = OFFICIAL_PARTICIPANTS_DIRECTORY
): FullMinuteBundle {
  const today = new Date().toISOString().slice(0, 10);
  const minId = generateSafeId('min');
  const sourceDirectory =
    directory && directory.length > 0 ? directory : OFFICIAL_PARTICIPANTS_DIRECTORY;

  const autoParticipants = sourceDirectory.map((emp, idx) => ({
    id: generateSafeId(`part_${idx + 1}`),
    minuteId: minId,
    orderIndex: idx + 1,
    name: emp.name,
    jobTitle: emp.jobTitle,
    attendanceStatus: 'present' as const,
    notes: '',
    ownerId: uid,
  }));

  return {
    minute: {
      id: minId,
      minuteNumber: nextNum,
      year,
      location: '',
      date: today,
      time: '10:00',
      mainSubject: '',
      secretaryName: '',
      secretarySignature: '',
      chairmanName: '',
      chairmanSignature: '',
      status: 'draft',
      participantsCount: autoParticipants.length,
      searchText: '',
      ownerId: uid,
      createdByName: userName,
      updatedByName: userName,
      archivedAt: '',
      archivedByName: '',
    },
    participants: autoParticipants,
    outcomes: [],
    ongoingTopics: [],
    newTopics: [],
    showOngoingTable: true,
    showNewTopicsTable: true,
    customTables: [],
  };
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('active_list');
  const [userRole, setUserRole] = useState<UserRole>('admin');
  const [operatorName, setOperatorName] = useState<string>('مسؤول النظام - ساعد');

  const [allMinutes, setAllMinutes] = useState<MinuteRecord[]>([]);
  const [loadingMinutes, setLoadingMinutes] = useState(true);
  const [employeeDirectory, setEmployeeDirectory] = useState<EmployeeDirectoryItem[]>(
    OFFICIAL_PARTICIPANTS_DIRECTORY
  );

  // Current Editor State
  const [currentBundle, setCurrentBundle] = useState<FullMinuteBundle>(() =>
    createEmptyBundle(
      DEFAULT_WORKSPACE_OWNER_ID,
      'مسؤول النظام - ساعد',
      new Date().getFullYear(),
      1,
      OFFICIAL_PARTICIPANTS_DIRECTORY
    )
  );
  const [isExistingRecord, setIsExistingRecord] = useState(false);
  const [originalYearAndNumber, setOriginalYearAndNumber] = useState<{
    year: number;
    minuteNumber: number;
  }>({ year: new Date().getFullYear(), minuteNumber: 1 });
  const [readOnlyMode, setReadOnlyMode] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Toast & Confirmation Modal States
  const [bannerMessage, setBannerMessage] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
  } | null>(null);

  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  // Directory Form State
  const [dirNameInput, setDirNameInput] = useState('');
  const [dirTitleInput, setDirTitleInput] = useState('');
  const [dirDeptInput, setDirDeptInput] = useState('');

  const showToast = useCallback((type: 'success' | 'error' | 'warning', text: string) => {
    setBannerMessage({ type, text });
  }, []);

  // 1. Real-time Firestore Listeners for Minutes and Employee Directory (Direct Access, No Login Screen)
  useEffect(() => {
    setLoadingMinutes(true);
    seedOfficialParticipantsDirectory().catch(() => {
      // Handled via error listener if needed
    });

    const minQuery = query(
      collection(db, 'minutes'),
      where('ownerId', '==', DEFAULT_WORKSPACE_OWNER_ID)
    );

    const unsubMinutes = onSnapshot(
      minQuery,
      (snap) => {
        const list: MinuteRecord[] = snap.docs.map((d) => {
          const data = d.data();
          const formatTs = (ts: unknown) => {
            if (ts instanceof Timestamp) return ts.toDate().toISOString();
            if (typeof ts === 'string') return ts;
            return '';
          };
          return {
            id: d.id,
            minuteNumber: Number(data.minuteNumber) || 1,
            year: Number(data.year) || new Date().getFullYear(),
            location: data.location || '',
            date: data.date || '',
            time: data.time || '',
            mainSubject: data.mainSubject || '',
            secretaryName: data.secretaryName || '',
            secretarySignature: data.secretarySignature || '',
            chairmanName: data.chairmanName || '',
            chairmanSignature: data.chairmanSignature || '',
            status: data.status || 'saved',
            participantsCount: Number(data.participantsCount) || 0,
            searchText: data.searchText || '',
            ownerId: data.ownerId || DEFAULT_WORKSPACE_OWNER_ID,
            createdByName: data.createdByName || '',
            updatedByName: data.updatedByName || '',
            archivedAt: data.archivedAt || '',
            archivedByName: data.archivedByName || '',
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            createdAtIso: formatTs(data.createdAt),
            updatedAtIso: formatTs(data.updatedAt),
          };
        });
        setAllMinutes(list);
        setLoadingMinutes(false);
      },
      (err) => {
        setLoadingMinutes(false);
        handleFirestoreError(err, OperationType.LIST, 'minutes');
      }
    );

    const empQuery = query(
      collection(db, 'employee_directory'),
      where('ownerId', '==', DEFAULT_WORKSPACE_OWNER_ID)
    );

    const unsubEmp = onSnapshot(
      empQuery,
      (snap) => {
        const emps: EmployeeDirectoryItem[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name || '',
            jobTitle: data.jobTitle || '',
            department: data.department || '',
            ownerId: data.ownerId || DEFAULT_WORKSPACE_OWNER_ID,
          };
        });
        emps.sort((a, b) => a.id.localeCompare(b.id));
        if (emps.length > 0) {
          setEmployeeDirectory(emps);
          setCurrentBundle((prev) => ({
            ...prev,
            participants: prev.participants.map((p) =>
              p.name.includes('الجفري')
                ? { ...p, name: p.name.replace(/الجفري/g, 'الهاشمي') }
                : p
            ),
          }));
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'employee_directory');
      }
    );

    return () => {
      unsubMinutes();
      unsubEmp();
    };
  }, []);

  // 2. LocalStorage Recovery on Page Reload / Connection Interruption
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCAL_AUTOSAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.bundle && parsed.hasUnsavedChanges) {
          const recoveredBundle: FullMinuteBundle = {
            ...parsed.bundle,
            participants: Array.isArray(parsed.bundle.participants)
              ? parsed.bundle.participants.map((p: FullMinuteBundle['participants'][number]) =>
                  p.name && p.name.includes('الجفري')
                    ? { ...p, name: p.name.replace(/الجفري/g, 'الهاشمي') }
                    : p
                )
              : [],
          };
          setCurrentBundle(recoveredBundle);
          setIsExistingRecord(Boolean(parsed.isExistingRecord));
          setOriginalYearAndNumber(
            parsed.originalYearAndNumber || {
              year: parsed.bundle.minute.year,
              minuteNumber: parsed.bundle.minute.minuteNumber,
            }
          );
          setHasUnsavedChanges(true);
          setActiveTab('editor');
          showToast(
            'warning',
            'تم استعادة مسودة العمل غير المحفوظة تلقائياً بعد تحديث الصفحة لضمان عدم فقدان بياناتك.'
          );
        }
      }
    } catch {
      // Ignore corrupt cache
    }
  }, [showToast]);

  // Persist unsaved changes to LocalStorage automatically
  useEffect(() => {
    if (hasUnsavedChanges) {
      try {
        localStorage.setItem(
          LOCAL_AUTOSAVE_KEY,
          JSON.stringify({
            bundle: currentBundle,
            isExistingRecord,
            originalYearAndNumber,
            hasUnsavedChanges: true,
          })
        );
      } catch {
        // Ignore quota errors
      }
    } else {
      localStorage.removeItem(LOCAL_AUTOSAVE_KEY);
    }
  }, [currentBundle, hasUnsavedChanges, isExistingRecord, originalYearAndNumber]);

  // Warn before browser tab close / reload if unsaved changes exist
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Sync document.title when in Preview mode so Save as PDF (button or Ctrl+P) defaults to محضر_اجتماع_رقم_المحضر_تاريخ_الاجتماع.pdf
  useEffect(() => {
    if (activeTab === 'preview') {
      document.title = getOfficialMinuteFileBaseName(currentBundle);
    } else {
      document.title = 'ساعـد (SAAED) — نظام إدارة محاضر الاجتماعات والأرشفة المؤسسية';
    }
  }, [activeTab, currentBundle]);

  // Permissions Derived from Role
  const isAuthorizedAdmin = userRole === 'admin';
  const canEdit = userRole === 'admin' || userRole === 'secretary';
  const canAuthorizeManualNumber = userRole === 'admin';
  const canArchiveOrRestore = userRole === 'admin' || userRole === 'secretary';

  // Navigation Guard with Unsaved Changes Confirmation
  const guardedNavigate = (action: () => void) => {
    if (hasUnsavedChanges && activeTab === 'editor' && !readOnlyMode) {
      setConfirmModal({
        title: 'تنبيه: تغييرات غير محفوظة',
        message:
          'لديك تعديلات غير محفوظة في المحضر الحالي. هل أنت متأكد من مغادرة الصفحة وإهمال هذه التعديلات؟',
        confirmLabel: 'نعم، مغادرة دون حفظ',
        onConfirm: () => {
          setHasUnsavedChanges(false);
          setConfirmModal(null);
          action();
        },
      });
    } else {
      action();
    }
  };

  // Start a New Minute with Auto-Suggested Sequential Number
  const startNewMinute = async () => {
    const currentYear = new Date().getFullYear();
    try {
      const nextNum = await getNextSequentialMinuteNumber(currentYear);
      const fresh = createEmptyBundle(
        DEFAULT_WORKSPACE_OWNER_ID,
        operatorName,
        currentYear,
        nextNum,
        employeeDirectory
      );
      setCurrentBundle(fresh);
      setIsExistingRecord(false);
      setOriginalYearAndNumber({ year: currentYear, minuteNumber: nextNum });
      setReadOnlyMode(false);
      setHasUnsavedChanges(false);
      setActiveTab('editor');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'تعذر تهيئة محضر جديد.');
    }
  };

  const handleYearChangeSuggestNumber = async (newYear: number) => {
    try {
      const nextNum = await getNextSequentialMinuteNumber(newYear);
      setCurrentBundle((prev) => ({
        ...prev,
        minute: {
          ...prev.minute,
          year: newYear,
          minuteNumber: nextNum,
        },
      }));
    } catch {
      // Fallback
    }
  };

  // Open an existing minute for View or Edit
  const openMinuteFromDb = async (
    minuteId: string,
    mode: 'edit' | 'view' | 'preview' | 'print'
  ) => {
    try {
      const loaded = await loadFullMinute(minuteId);
      setCurrentBundle(loaded);
      setIsExistingRecord(true);
      setOriginalYearAndNumber({
        year: loaded.minute.year,
        minuteNumber: loaded.minute.minuteNumber,
      });
      setHasUnsavedChanges(false);

      const isApproved = loaded.minute.status === 'saved';

      // Approved minutes are strictly preview-only for non-admins
      if (isApproved && !isAuthorizedAdmin) {
        setReadOnlyMode(true);
        if (mode === 'print') {
          setActiveTab('preview');
          setTimeout(() => {
            void triggerOfficialMinutePrint(loaded);
          }, 200);
          return;
        }
        if (mode === 'edit') {
          showToast(
            'warning',
            'المحضر المعتمد قابل للمعاينة فقط؛ يمنع تحريره أو التعديل عليه إلا من خلال مدير مخوّل (كامل الصلاحيات).'
          );
        }
        setActiveTab('preview');
        return;
      }

      if (mode === 'edit') {
        setReadOnlyMode(!canEdit);
        setActiveTab('editor');
      } else if (mode === 'view') {
        setReadOnlyMode(true);
        setActiveTab('editor');
      } else if (mode === 'preview') {
        setActiveTab('preview');
      } else if (mode === 'print') {
        setActiveTab('preview');
        setTimeout(() => {
          void triggerOfficialMinutePrint(loaded);
        }, 200);
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'فشل استرجاع المحضر من قاعدة البيانات.');
    }
  };

  // Save Minute (Draft or Final)
  const handleSaveMinute = async (targetStatus: 'draft' | 'saved') => {
    if (!canEdit) {
      showToast('error', 'ليس لديك صلاحية لحفظ أو تعديل المحاضر في وضع القراءة فقط.');
      return;
    }

    if (isExistingRecord && currentBundle.minute.status === 'saved' && !isAuthorizedAdmin) {
      showToast(
        'error',
        'يمنع تحرير أو التعديل على المحضر المعتمد إلا من خلال مدير مخوّل (كامل الصلاحيات).'
      );
      return;
    }

    setSaving(true);
    try {
      const bundleToSave: FullMinuteBundle = {
        ...currentBundle,
        minute: {
          ...currentBundle.minute,
          status:
            currentBundle.minute.status === 'archived' && targetStatus === 'saved'
              ? 'archived'
              : targetStatus,
        },
      };

      const verifiedSaved = await saveFullMinuteToDb(
        bundleToSave,
        isExistingRecord,
        originalYearAndNumber.year,
        originalYearAndNumber.minuteNumber,
        operatorName
      );

      setCurrentBundle(verifiedSaved);
      setIsExistingRecord(true);
      setOriginalYearAndNumber({
        year: verifiedSaved.minute.year,
        minuteNumber: verifiedSaved.minute.minuteNumber,
      });
      setHasUnsavedChanges(false);

      if (verifiedSaved.minute.status === 'saved') {
        if (!isAuthorizedAdmin) {
          setReadOnlyMode(true);
        }
        setActiveTab('approved_list');
      }

      showToast(
        'success',
        targetStatus === 'draft'
          ? `تم حفظ المحضر رقم (${formatMinuteNumber(verifiedSaved.minute.minuteNumber)}) لسنة ${verifiedSaved.minute.year} كمسودة في قاعدة البيانات بنجاح.`
          : `تم اعتماد المحضر رقم (${formatMinuteNumber(verifiedSaved.minute.minuteNumber)}) لسنة ${verifiedSaved.minute.year} ونقله إلى تبويب «المحاضر المعتمدة» بنجاح.`
      );
    } catch (err) {
      showToast(
        'error',
        err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ في قاعدة البيانات.'
      );
    } finally {
      setSaving(false);
    }
  };

  // Archive Minute with Confirmation
  const handleArchiveMinute = (minuteId: string) => {
    const targetMin = allMinutes.find((m) => m.id === minuteId);
    if (targetMin?.status === 'saved' && !isAuthorizedAdmin) {
      showToast(
        'error',
        'يمنع التعديل على المحضر المعتمد أو نقله إلا من خلال مدير مخوّل (كامل الصلاحيات).'
      );
      return;
    }

    if (!canArchiveOrRestore) {
      showToast('error', 'ليس لديك صلاحية لأرشفة المحاضر.');
      return;
    }

    setConfirmModal({
      title: 'تأكيد أرشفة المحضر',
      message:
        'هل أنت متأكد من نقل هذا المحضر إلى تبويب «محاضر الاجتماعات المؤرشفة»؟ سيتم الاحتفاظ بجميع بياناته وجداوله وتوقيعاته كاملة في قاعدة البيانات.',
      confirmLabel: 'تأكيد الأرشفة',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const updated = await updateMinuteArchiveState(minuteId, true, operatorName);
          if (currentBundle.minute.id === minuteId) {
            setCurrentBundle((prev) => ({ ...prev, minute: updated }));
          }
          showToast(
            'success',
            `تم أرشفة المحضر رقم (${formatMinuteNumber(updated.minuteNumber)}) لسنة ${updated.year} بنجاح.`
          );
          setActiveTab('archived_list');
        } catch (err) {
          showToast('error', err instanceof Error ? err.message : 'فشلت عملية الأرشفة.');
        }
      },
    });
  };

  // Restore Minute from Archive
  const handleRestoreMinute = (minuteId: string) => {
    if (!canArchiveOrRestore) {
      showToast('error', 'ليس لديك صلاحية لاستعادة المحاضر من الأرشيف.');
      return;
    }

    setConfirmModal({
      title: 'استعادة المحضر من الأرشيف',
      message:
        'سيتم استعادة المحضر بكامل بياناته الأصلية إلى تبويب «المحاضر المعتمدة» دون إنشاء سجل مكرر. هل ترغب بالمتابعة؟',
      confirmLabel: 'نعم، استعادة المحضر',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const updated = await updateMinuteArchiveState(minuteId, false, operatorName);
          if (currentBundle.minute.id === minuteId) {
            setCurrentBundle((prev) => ({ ...prev, minute: updated }));
          }
          showToast(
            'success',
            `تم استعادة المحضر رقم (${formatMinuteNumber(updated.minuteNumber)}) لسنة ${updated.year} إلى تبويب «المحاضر المعتمدة» بنجاح.`
          );
          setActiveTab('approved_list');
        } catch (err) {
          showToast('error', err instanceof Error ? err.message : 'فشلت عملية الاستعادة.');
        }
      },
    });
  };

  // Delete Minute Permanently with Confirmation
  const handleDeleteMinute = (minuteId: string) => {
    const targetMin = allMinutes.find((m) => m.id === minuteId);
    if (targetMin?.status === 'saved' && !isAuthorizedAdmin) {
      showToast(
        'error',
        'يمنع حذف المحضر المعتمد إلا من خلال مدير مخوّل (كامل الصلاحيات).'
      );
      return;
    }

    if (!canEdit) {
      showToast('error', 'ليس لديك صلاحية لحذف المحاضر.');
      return;
    }

    const label = targetMin
      ? `المحضر رقم (${formatMinuteNumber(targetMin.minuteNumber)}) لسنة ${targetMin.year}`
      : 'هذا المحضر';

    setConfirmModal({
      title: 'تأكيد حذف المحضر نهائياً',
      message: `هل أنت متأكد من حذف ${label} نهائياً من قاعدة البيانات؟ سيتم حذف جميع بيانات المحضر وجداوله وإتاحة رقمه للاستخدام مجدداً.`,
      confirmLabel: 'تأكيد الحذف النهائي',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const deleted = await deleteFullMinuteFromDb(minuteId);
          if (currentBundle.minute.id === minuteId) {
            const nextYear = new Date().getFullYear();
            const nextNum = await getNextSequentialMinuteNumber(nextYear);
            const fresh = createEmptyBundle(
              DEFAULT_WORKSPACE_OWNER_ID,
              operatorName,
              nextYear,
              nextNum,
              employeeDirectory
            );
            setCurrentBundle(fresh);
            setIsExistingRecord(false);
            setOriginalYearAndNumber({ year: nextYear, minuteNumber: nextNum });
            setHasUnsavedChanges(false);
          }
          showToast(
            'success',
            `تم حذف المحضر رقم (${formatMinuteNumber(deleted.minuteNumber)}) لسنة ${deleted.year} من قاعدة البيانات بنجاح.`
          );
        } catch (err) {
          showToast('error', err instanceof Error ? err.message : 'فشلت عملية حذف المحضر.');
        }
      },
    });
  };

  // Cancel Edits with Confirmation
  const handleCancelChanges = () => {
    if (!hasUnsavedChanges) {
      if (isExistingRecord) {
        openMinuteFromDb(currentBundle.minute.id, 'view');
      } else {
        setActiveTab('active_list');
      }
      return;
    }

    setConfirmModal({
      title: 'تأكيد إلغاء التعديلات',
      message:
        'هل أنت متأكد من إلغاء جميع التعديلات غير المحفوظة واسترجاع آخر نسخة محفوظة في قاعدة البيانات؟',
      confirmLabel: 'تأكيد إلغاء التعديلات',
      onConfirm: async () => {
        setConfirmModal(null);
        setHasUnsavedChanges(false);
        if (isExistingRecord) {
          await openMinuteFromDb(currentBundle.minute.id, 'edit');
          showToast('warning', 'تم إلغاء التعديلات واستعادة النسخة المحفوظة في قاعدة البيانات.');
        } else {
          await startNewMinute();
          showToast('warning', 'تم تفريغ الحقول وإلغاء التعديلات.');
        }
      },
    });
  };

  // Export DOCX from list or editor
  const handleExportDocxById = async (minuteId: string) => {
    try {
      const full =
        currentBundle.minute.id === minuteId && activeTab === 'editor'
          ? currentBundle
          : await loadFullMinute(minuteId);
      await exportMinuteToDocx(full);
      showToast(
        'success',
        `تم تصدير ملف Word (DOCX قابل للتحرير) للمحضر رقم (${formatMinuteNumber(full.minute.minuteNumber)}) بنجاح.`
      );
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'تعذر تصدير ملف Word.');
    }
  };

  if (!isAuthenticated) {
    return (
      <LoginView
        onLoginSuccess={(loggedInUser) => {
          if (loggedInUser && loggedInUser.trim()) {
            setOperatorName(loggedInUser.trim());
          }
          setIsAuthenticated(true);
        }}
      />
    );
  }

  return (
    <div className="print-root-wrapper min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar Contract: 3 Zones separated by gap-8 (Hidden in Print) */}
      <header className="no-print sticky top-0 z-30 bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element Brand wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            guardedNavigate(() => setActiveTab('active_list'));
          }}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 font-display"
        >
          ساعـد (SAAED)
        </a>

        {/* Zone 2: 5 Concise Single-Line Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => guardedNavigate(() => setActiveTab('active_list'))}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'active_list'
                ? 'border-blue-800 text-blue-900 font-bold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            عرض المحاضر وتحريرها
          </button>
          <button
            type="button"
            onClick={() => guardedNavigate(() => setActiveTab('approved_list'))}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'approved_list'
                ? 'border-blue-800 text-blue-900 font-bold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            المحاضر المعتمدة
          </button>
          <button
            type="button"
            onClick={() => guardedNavigate(() => setActiveTab('editor'))}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'editor'
                ? 'border-blue-800 text-blue-900 font-bold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            نموذج المحضر الحالي
          </button>
          <button
            type="button"
            onClick={() => guardedNavigate(() => setActiveTab('archived_list'))}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'archived_list'
                ? 'border-blue-800 text-blue-900 font-bold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            محاضر الاجتماعات المؤرشفة
          </button>
          <button
            type="button"
            onClick={() => guardedNavigate(() => setActiveTab('directory'))}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'directory'
                ? 'border-blue-800 text-blue-900 font-bold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            سجل المشاركين
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action Button */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => guardedNavigate(startNewMinute)}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-800 hover:bg-blue-900 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <FilePlus className="w-4 h-4" />
            محضر جديد
          </button>
        </div>
      </header>

      {/* Secondary Institutional Context Bar (Hidden in Print) */}
      <div className="no-print bg-slate-100 border-b border-slate-200 px-6 py-2.5">
        <div className="max-w-[1400px] mx-auto flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <img
              src="/assets/aistudio/logo_1afd1154.png"
              alt="شعار ساعد"
              referrerPolicy="no-referrer"
              className="h-7 object-contain"
            />
            <span className="font-semibold text-slate-800">
              وحدة إدارة محاضر الاجتماعات والأرشفة المؤسسية
            </span>
          </div>

          {/* Mobile Nav + Operator Name + Role Permissions Switcher */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex md:hidden items-center gap-1 bg-white p-1 rounded border border-slate-200">
              <button
                type="button"
                onClick={() => guardedNavigate(() => setActiveTab('active_list'))}
                className={`px-2 py-1 rounded text-[11px] font-semibold ${
                  activeTab === 'active_list' ? 'bg-blue-800 text-white' : 'text-slate-700'
                }`}
              >
                المسودات
              </button>
              <button
                type="button"
                onClick={() => guardedNavigate(() => setActiveTab('approved_list'))}
                className={`px-2 py-1 rounded text-[11px] font-semibold ${
                  activeTab === 'approved_list' ? 'bg-blue-800 text-white' : 'text-slate-700'
                }`}
              >
                المعتمدة
              </button>
              <button
                type="button"
                onClick={() => guardedNavigate(() => setActiveTab('editor'))}
                className={`px-2 py-1 rounded text-[11px] font-semibold ${
                  activeTab === 'editor' ? 'bg-blue-800 text-white' : 'text-slate-700'
                }`}
              >
                المحرر
              </button>
              <button
                type="button"
                onClick={() => guardedNavigate(() => setActiveTab('archived_list'))}
                className={`px-2 py-1 rounded text-[11px] font-semibold ${
                  activeTab === 'archived_list' ? 'bg-blue-800 text-white' : 'text-slate-700'
                }`}
              >
                الأرشيف
              </button>
              <button
                type="button"
                onClick={() => guardedNavigate(() => setActiveTab('directory'))}
                className={`px-2 py-1 rounded text-[11px] font-semibold ${
                  activeTab === 'directory' ? 'bg-blue-800 text-white' : 'text-slate-700'
                }`}
              >
                السجل
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-slate-600" />
              <span className="text-slate-600">اسم الموظف المعدّل:</span>
              <input
                type="text"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                placeholder="اسم المستخدم لتوثيق التعديلات..."
                className="px-2.5 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 w-40 focus:outline-none focus:ring-1 focus:ring-blue-700"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-800" />
              <span className="text-slate-600">الصلاحية:</span>
              <select
                value={userRole}
                onChange={(e) => setUserRole(e.target.value as UserRole)}
                className="px-2.5 py-1 text-xs font-semibold border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-700"
              >
                <option value="admin">مدير مخوّل (كامل الصلاحيات — تعديل وحذف المحاضر المعتمدة)</option>
                <option value="secretary">مقرر اجتماع (إضافة وتعديل المسودات + معاينة المعتمدة)</option>
                <option value="viewer">مطلع (عرض ومعاينة وطباعة فقط)</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => guardedNavigate(() => setIsAuthenticated(false))}
              className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded flex items-center gap-1.5 whitespace-nowrap shrink-0"
              title="العودة إلى صفحة تسجيل الدخول"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-600" />
              تسجيل الخروج
            </button>
          </div>
        </div>
      </div>

      {/* Notification Banner */}
      {bannerMessage && (
        <div className="no-print max-w-[1400px] w-full mx-auto px-6 pt-4">
          <div
            className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg border text-xs font-semibold ${
              bannerMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : bannerMessage.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {bannerMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
              {bannerMessage.type === 'error' && <AlertTriangle className="w-4 h-4 shrink-0" />}
              {bannerMessage.type === 'warning' && <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span>{bannerMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setBannerMessage(null)}
              className="p-1 hover:bg-black/5 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area (Opens Directly Without Any Login Page) */}
      <main className="print-main-wrapper flex-1 max-w-[1400px] w-full mx-auto px-6 py-6">
        {activeTab === 'active_list' ? (
          <ActiveMinutesTab
            minutes={allMinutes}
            loading={loadingMinutes}
            canEdit={canEdit}
            onCreateNew={startNewMinute}
            onOpenApprovedTab={() => setActiveTab('approved_list')}
            onViewDetails={(id) => openMinuteFromDb(id, 'view')}
            onEditMinute={(id) => openMinuteFromDb(id, 'edit')}
            onPreviewMinute={(id) => openMinuteFromDb(id, 'preview')}
            onPrintMinute={(id) => openMinuteFromDb(id, 'print')}
            onExportPdf={(id) => openMinuteFromDb(id, 'print')}
            onExportWord={handleExportDocxById}
            onArchiveMinute={handleArchiveMinute}
            onDeleteMinute={handleDeleteMinute}
          />
        ) : activeTab === 'approved_list' ? (
          <ApprovedMinutesTab
            minutes={allMinutes}
            loading={loadingMinutes}
            isAuthorizedAdmin={isAuthorizedAdmin}
            onEditMinute={(id) => openMinuteFromDb(id, 'edit')}
            onPreviewMinute={(id) => openMinuteFromDb(id, 'preview')}
            onPrintMinute={(id) => openMinuteFromDb(id, 'print')}
            onExportPdf={(id) => openMinuteFromDb(id, 'print')}
            onExportWord={handleExportDocxById}
            onArchiveMinute={handleArchiveMinute}
            onDeleteMinute={handleDeleteMinute}
          />
        ) : activeTab === 'archived_list' ? (
          <ArchivedMinutesTab
            minutes={allMinutes}
            loading={loadingMinutes}
            canRestore={canArchiveOrRestore}
            onViewMinute={(id) => openMinuteFromDb(id, 'view')}
            onPreviewMinute={(id) => openMinuteFromDb(id, 'preview')}
            onPrintMinute={(id) => openMinuteFromDb(id, 'print')}
            onExportPdf={(id) => openMinuteFromDb(id, 'print')}
            onExportWord={handleExportDocxById}
            onRestoreMinute={handleRestoreMinute}
          />
        ) : activeTab === 'directory' ? (
          /* Employee / Participant Directory Management */
          <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-lg font-bold text-slate-900">سجل المشاركين والموظفين الدائم</h2>
              <p className="text-xs text-slate-500 mt-1">
                يُستخدم هذا السجل لاختيار الموظفين والمشاركين ورئيس ومقرر الاجتماع بسرعة داخل المحاضر مع إمكانية الإدخال اليدوي المباشر في أي محضر
              </p>
            </div>

            {canEdit && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!dirNameInput.trim()) return;
                  try {
                    await addEmployeeToDirectory(dirNameInput, dirTitleInput, dirDeptInput);
                    setDirNameInput('');
                    setDirTitleInput('');
                    setDirDeptInput('');
                    showToast('success', 'تمت إضافة الموظف إلى سجل المشاركين بنجاح.');
                  } catch (err) {
                    showToast('error', err instanceof Error ? err.message : 'تعذر إضافة الموظف.');
                  }
                }}
                className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-md border border-slate-200 items-end"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    الاسم الكامل
                  </label>
                  <input
                    type="text"
                    required
                    value={dirNameInput}
                    onChange={(e) => setDirNameInput(e.target.value)}
                    placeholder="اسم الموظف..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    المسمى الوظيفي
                  </label>
                  <input
                    type="text"
                    value={dirTitleInput}
                    onChange={(e) => setDirTitleInput(e.target.value)}
                    placeholder="المسمى الوظيفي..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    الإدارة / القسم (اختياري)
                  </label>
                  <input
                    type="text"
                    value={dirDeptInput}
                    onChange={(e) => setDirDeptInput(e.target.value)}
                    placeholder="الإدارة..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded bg-white"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-800 hover:bg-blue-900 rounded"
                >
                  إضافة إلى سجل المشاركين
                </button>
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse border border-slate-200 text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                    <th className="py-3 px-4 w-12 text-center">م</th>
                    <th className="py-3 px-4">الاسم</th>
                    <th className="py-3 px-4">المسمى الوظيفي</th>
                    <th className="py-3 px-4">الإدارة / القسم</th>
                    {canEdit && <th className="py-3 px-4 w-24 text-center">حذف</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {employeeDirectory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        <Users className="w-7 h-7 text-slate-300 mx-auto mb-1.5" />
                        سجل المشاركين فارغ حالياً. يمكنك إضافة الموظفين هنا أو إدخالهم مباشرة داخل جدول المحضر.
                      </td>
                    </tr>
                  ) : (
                    employeeDirectory.map((emp, idx) => (
                      <tr key={emp.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 text-center font-mono-num">{idx + 1}</td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">{emp.name}</td>
                        <td className="py-2.5 px-4 text-slate-700">{emp.jobTitle || '-'}</td>
                        <td className="py-2.5 px-4 text-slate-600">{emp.department || '-'}</td>
                        {canEdit && (
                          <td className="py-2.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => removeEmployeeFromDirectory(emp.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="حذف من السجل"
                            >
                              <Trash2 className="w-4 h-4" />
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
        ) : activeTab === 'preview' ? (
          /* Official Print & PDF Preview Mode */
          <div className="print-preview-wrapper space-y-6">
            <div className="no-print bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  معاينة المحضر الرسمية (مطابقة للطباعة وتصدير PDF / Word)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  مقاس A4 عمودي (210 × 297 مم) — الاسم الافتراضي للملف:{' '}
                  <span className="font-mono-num font-semibold text-slate-700" dir="ltr">
                    {getOfficialMinuteFileBaseName(currentBundle)}.pdf
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {currentBundle.minute.status === 'saved' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveTab('approved_list')}
                      className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md flex items-center gap-1.5"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      العودة إلى المحاضر المعتمدة
                    </button>
                    {isAuthorizedAdmin ? (
                      <button
                        type="button"
                        onClick={() => {
                          setReadOnlyMode(false);
                          setActiveTab('editor');
                        }}
                        className="px-3.5 py-2 text-xs font-semibold text-blue-900 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-md flex items-center gap-1.5"
                      >
                        تحرير المحضر (للمدير المخوّل)
                      </button>
                    ) : (
                      <span className="px-3 py-2 text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-200 rounded-md flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-amber-700" />
                        محضر معتمد — قابل للمعاينة فقط
                      </span>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveTab('editor')}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md flex items-center gap-1.5"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    العودة إلى تحرير المحضر
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    void triggerOfficialMinutePrint(currentBundle);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-800 hover:bg-blue-900 rounded-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  طباعة / حفظ كملف PDF
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await exportMinuteToDocx(currentBundle);
                    showToast('success', 'تم تصدير ملف Word (DOCX) بنجاح.');
                  }}
                  className="px-4 py-2 text-xs font-semibold text-indigo-900 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-md flex items-center gap-1.5 cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  تصدير Word (DOCX)
                </button>
              </div>
            </div>

            <OfficialMinutePrintView bundle={currentBundle} />
          </div>
        ) : (
          /* Full Minute Editor View */
          <MinuteEditorView
            bundle={currentBundle}
            isExistingRecord={isExistingRecord}
            readOnly={
              readOnlyMode ||
              !canEdit ||
              (isExistingRecord && currentBundle.minute.status === 'saved' && !isAuthorizedAdmin)
            }
            hasUnsavedChanges={hasUnsavedChanges}
            saving={saving}
            canAuthorizeManualNumber={canAuthorizeManualNumber}
            canArchiveOrRestore={canArchiveOrRestore}
            employeeDirectory={employeeDirectory}
            allMinutes={allMinutes}
            onChangeBundle={(updater) => {
              if (isExistingRecord && currentBundle.minute.status === 'saved' && !isAuthorizedAdmin) {
                showToast(
                  'error',
                  'يمنع تحرير أو التعديل على المحضر المعتمد إلا من خلال مدير مخوّل (كامل الصلاحيات).'
                );
                return;
              }
              setCurrentBundle((prev) => updater(prev));
              setHasUnsavedChanges(true);
            }}
            onYearChangeSuggestNumber={handleYearChangeSuggestNumber}
            onSaveDraft={() => handleSaveMinute('draft')}
            onSaveFinal={() => handleSaveMinute('saved')}
            onEnableEditMode={() => {
              if (currentBundle.minute.status === 'saved' && !isAuthorizedAdmin) {
                showToast(
                  'error',
                  'المحضر المعتمد قابل للمعاينة فقط؛ يمنع تحريره أو التعديل عليه إلا من خلال مدير مخوّل (كامل الصلاحيات).'
                );
                return;
              }
              if (!canEdit) {
                showToast('error', 'الرجاء التبديل إلى صلاحية مقرر أو مدير مخوّل لتعديل المحضر.');
                return;
              }
              setReadOnlyMode(false);
            }}
            onPreview={() => setActiveTab('preview')}
            onPrint={() => {
              setActiveTab('preview');
              setTimeout(() => {
                void triggerOfficialMinutePrint(currentBundle);
              }, 200);
            }}
            onExportPdf={() => {
              setActiveTab('preview');
              setTimeout(() => {
                void triggerOfficialMinutePrint(currentBundle);
              }, 200);
            }}
            onExportWord={async () => {
              await exportMinuteToDocx(currentBundle);
              showToast('success', 'تم تصدير ملف Word (DOCX قابل للتحرير) بنجاح.');
            }}
            onArchive={() => handleArchiveMinute(currentBundle.minute.id)}
            onRestore={() => handleRestoreMinute(currentBundle.minute.id)}
            onCancelChanges={handleCancelChanges}
            onBackToList={() =>
              guardedNavigate(() =>
                setActiveTab(
                  currentBundle.minute.status === 'saved' ? 'approved_list' : 'active_list'
                )
              )
            }
            onAddDirectoryEmployee={async (name, title) => {
              await addEmployeeToDirectory(name, title);
              showToast('success', `تم حفظ "${name}" في سجل المشاركين الدائم.`);
            }}
          />
        )}
      </main>

      {/* Confirmation Dialog Modal */}
      {confirmModal && (
        <div className="no-print fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2.5 text-amber-800">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-slate-900">{confirmModal.title}</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{confirmModal.message}</p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-md"
              >
                {confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clean Institutional Footer (Hidden in Print) */}
      <footer className="no-print bg-white border-t border-slate-200 py-4 px-6 mt-auto">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>ساعـد (SAAED) — نظام إدارة محاضر الاجتماعات والأرشفة المؤسسية</span>
          <span>جميع البيانات مرتبطة بقاعدة البيانات الفعلية ومحفوظة بأمان</span>
        </div>
      </footer>
    </div>
  );
}
