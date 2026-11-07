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
  Lock,
  Copy,
  ClipboardList,
  Layers,
  FolderOpen,
  FileText,
  FileEdit,
  Plus,
  LogOut,
  Briefcase,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import {
  db,
  auth,
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
  duplicateFullMinuteInDb,
  updateMinuteArchiveState,
  deleteFullMinuteFromDb,
  addEmployeeToDirectory,
  removeEmployeeFromDirectory,
} from './services/minutesService';
import { exportMinuteToDocx } from './utils/docxExport';
import { formatMinuteNumber, toArabicNumerals } from './utils/numerals';
import {
  getOfficialMinuteFileBaseName,
  triggerOfficialMinutePrint,
  exportMinuteToPdf,
} from './utils/printMinute';
import { ActiveMinutesTab } from './components/ActiveMinutesTab';
import { ApprovedMinutesTab } from './components/ApprovedMinutesTab';
import { CompletedTopicsTab, isCompletedStatusValue } from './components/CompletedTopicsTab';
import { MinuteEditorView } from './components/MinuteEditorView';
import { OfficialMinutePrintView } from './components/OfficialMinutePrintView';
import {
  LoginPage,
  AuthenticatedSession,
  AUTH_SESSION_LOCAL_KEY,
  AUTH_SESSION_TEMP_KEY,
} from './components/LoginPage';
import heroBoardroomImg from './assets/images/saaed_target_boardroom_scene_1793880520448.jpg';
import archiveHeaderImg from './assets/images/saaed_digital_archiving_header_1793877730074.jpg';
import deskPanoramicMatImg from './assets/images/saaed_executive_desk_luxury_mat_1794037923000.jpg';

type ActiveTab = 'editor' | 'active_list' | 'approved_list' | 'completed_topics' | 'directory' | 'preview';

type UserRole = 'admin' | 'secretary' | 'viewer';

const LOCAL_AUTOSAVE_KEY = 'saaed_minutes_autosave_v2';

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
  const [authSession, setAuthSession] = useState<AuthenticatedSession | null>(() => {
    try {
      const savedLocal = localStorage.getItem(AUTH_SESSION_LOCAL_KEY);
      if (savedLocal) {
        const parsed = JSON.parse(savedLocal) as AuthenticatedSession;
        if (parsed && parsed.username && parsed.tokenHash) return parsed;
      }
      const savedTemp = sessionStorage.getItem(AUTH_SESSION_TEMP_KEY);
      if (savedTemp) {
        const parsed = JSON.parse(savedTemp) as AuthenticatedSession;
        if (parsed && parsed.username && parsed.tokenHash) return parsed;
      }
    } catch {
      // Ignore storage errors
    }
    return null;
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('active_list');
  const [userRole, setUserRole] = useState<UserRole>(() => authSession?.role || 'admin');
  const [operatorName, setOperatorName] = useState<string>(
    () => authSession?.displayName || 'مسؤول النظام - ساعد'
  );

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
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  // Toast & Confirmation Modal States
  const [bannerMessage, setBannerMessage] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
    title: string;
    categoryLabel: string;
    details: string[];
  } | null>(null);

  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    details?: string[];
    onConfirm: () => void;
  } | null>(null);

  // Directory Form State
  const [dirNameInput, setDirNameInput] = useState('');
  const [dirTitleInput, setDirTitleInput] = useState('');
  const [dirDeptInput, setDirDeptInput] = useState('');

  const showToast = useCallback(
    (
      type: 'success' | 'error' | 'warning',
      text: string,
      options?: { title?: string; categoryLabel?: string; details?: string[] }
    ) => {
      let title = options?.title || '';
      let categoryLabel = options?.categoryLabel || '';
      let details = options?.details || [];

      if (!categoryLabel) {
        categoryLabel =
          type === 'success'
            ? 'إشعار موافقة واعتماد العملية'
            : type === 'error'
            ? 'إشعار خطأ وتنبيه إجرائي'
            : 'تنبيه وملاحظة نظامية';
      }

      if (!title || details.length === 0) {
        if (text.includes('عدم وجود توقيع من الطرفين')) {
          title = title || 'تعذر حفظ أو اعتماد المحضر — نقص في التوقيعات الرسمية';
          categoryLabel = 'إشعار خطأ — شرط التوقيعات إلزامي';
          if (details.length === 0) {
            details = [
              'يشترط النظام وجود توقيع كلٍ من «مقرر الاجتماع» و«رئيس الاجتماع» قبل السماح بحفظ المحضر أو اعتماده.',
              'يمكنك إرفاق صورة التوقيع، أو الرسم الإلكتروني المباشر، أو كتابة التوقيع النصي في قسم «سادساً: الاعتماد والتوقيعات».',
              'بعد استكمال توقيع الطرفين، أعد الضغط على زر الحفظ أو الاعتماد لإتمام العملية بنجاح.',
            ];
          }
        } else if (text.includes('تم اعتماد المحضر')) {
          title = title || 'تم اعتماد المحضر رسمياً ونقله إلى المحاضر المعتمدة';
          categoryLabel = 'إشعار اعتماد رسمي مكتمل';
          if (details.length === 0) {
            details = [
              'تم التحقق من اكتمال بيانات المحضر وتوقيعات الطرفين (مقرر الاجتماع ورئيس الاجتماع).',
              'تم ترحيل المحضر إلى تبويب «المحاضر المعتمدة» وتفعيل الحماية ضد الحذف أو التعديل غير المخوّل.',
              'المحضر متاح الآن للمعاينة الرسمية، والطباعة بمقاس A4، والحفظ بصيغة PDF أو التصدير إلى Word.',
            ];
          }
        } else if (text.includes('كمسودة في قاعدة البيانات')) {
          title = title || 'تم حفظ مسودة المحضر في قاعدة البيانات بنجاح';
          categoryLabel = 'إشعار حفظ المسودة';
          if (details.length === 0) {
            details = [
              'تم حفظ كافة بيانات المحضر، وقائمة المشاركين، والجداول، والتوقيعات في قاعدة البيانات.',
              'تم حجز وتثبيت رقم المحضر التسلسلي ضمن السنة الحالية لمنع تكراره.',
              'يمكنك متابعة تحرير المسودة في أي وقت أو اعتمادها نهائياً لنقلها إلى «المحاضر المعتمدة».',
            ];
          }
        } else if (text.includes('تم تكرار ونسخ المحضر')) {
          title = title || 'تم تكرار ونسخ المحضر برقم تسلسلي جديد';
          categoryLabel = 'إشعار نسخ وتكرار المحضر';
          if (details.length === 0) {
            details = [
              'تم إنشاء نسخة مطابقة من المحضر تشمل جميع الجداول، المشاركين، التوصيات، والحالات.',
              'قام النظام تلقائياً بتخصيص رقم المحضر التسلسلي التالي في نفس السنة للنسخة الجديدة.',
              'يمكنك الآن استعراض النسخة الجديدة أو تعديل بياناتها وتاريخها حسب الاجتماع الجديد.',
            ];
          }
        } else if (text.includes('تم أرشفة المحضر')) {
          title = title || 'تم نقل المحضر إلى الأرشيف المؤسسي بنجاح';
          categoryLabel = 'إشعار أرشفة رسمية';
          if (details.length === 0) {
            details = [
              'تم نقل المحضر إلى تبويب «محاضر الاجتماعات المؤرشفة» مع الاحتفاظ بكامل بياناته وتوقيعاته.',
              'يبقى المحضر المؤرشف متاحاً للمعاينة والطباعة والتصدير في أي وقت.',
              'يمكن استعادة المحضر من الأرشيف إلى قائمة المحاضر المعتمدة متى دعت الحاجة.',
            ];
          }
        } else if (text.includes('تم استعادة المحضر')) {
          title = title || 'تم استعادة المحضر من الأرشيف بنجاح';
          categoryLabel = 'إشعار استعادة سجل مؤرشف';
          if (details.length === 0) {
            details = [
              'تمت إعادة المحضر بكامل بياناته وجداوله وتوقيعاته الأصلية إلى تبويب «المحاضر المعتمدة».',
              'لم يتم إنشاء أي سجل مكرر، وتم الحفاظ على رقم المحضر التسلسلي الأصلي.',
            ];
          }
        } else if (text.includes('تم حذف المحضر')) {
          title = title || 'تم حذف المحضر نهائياً من قاعدة البيانات';
          categoryLabel = 'إشعار إتمام الحذف النهائي';
          if (details.length === 0) {
            details = [
              'تم حذف سجل المحضر وجميع جداوله الفرعية نهائياً من قاعدة البيانات.',
              'تم تحرير رقم المحضر التسلسلي ليكون متاحاً للاستخدام مجدداً ضمن نفس السنة.',
            ];
          }
        } else if (text.includes('تصدير ملف Word')) {
          title = title || 'تم تصدير المحضر بصيغة Word (DOCX) بنجاح';
          categoryLabel = 'إشعار تصدير المستند';
          if (details.length === 0) {
            details = [
              'تم إنشاء وتحميل ملف Word رسمي منسق باللغة العربية (RTL) مطابق لهيكل المحضر.',
              'يتضمن الملف جميع الجداول، وأسماء المشاركين، والحالات، والتوقيعات المعتمدة.',
            ];
          }
        } else if (text.includes('تصدير ملف PDF')) {
          title = title || 'تم تصدير وحفظ المحضر بصيغة PDF بنجاح';
          categoryLabel = 'إشعار تصدير مستند PDF رسمي';
          if (details.length === 0) {
            details = [
              'تم إنشاء وتحميل ملف PDF رسمي بمقاس A4 عمودي مطابق لتصميم المعاينة الرسمية.',
              'يتضمن الملف كافة العناوين، الجداول، تمييز المواضيع المكتملة، والتوقيعات الرسمية.',
            ];
          }
        } else if (text.includes('سجل المشاركين')) {
          title = title || 'تم تحديث سجل المشاركين الدائم';
          categoryLabel = 'إشعار تحديث بيانات السجل';
          if (details.length === 0) {
            details = [
              'تم حفظ بيانات الموظف بنجاح في السجل الدائم للمشاركين.',
              'سيظهر الاسم تلقائياً ضمن القوائم المنسدلة في جميع المحاضر القادمة.',
            ];
          }
        } else if (
          text.includes('مدير مخوّل') ||
          text.includes('صلاحية') ||
          text.includes('قابل للمعاينة فقط')
        ) {
          title = title || 'تنبيه صلاحيات النظام وحماية المحاضر المعتمدة';
          categoryLabel =
            type === 'error' ? 'إشعار رفض العملية — نقص الصلاحية' : 'تنبيه حماية المحضر المعتمد';
          if (details.length === 0) {
            details = [
              'تخضع المحاضر المعتمدة لحماية صارمة تمنع التعديل أو الحذف أو النقل غير المصرح به.',
              'يُسمح لغير المدير المخوّل بمعاينة المحضر المعتمد وطباعته وتصديره بصيغة PDF أو Word فقط.',
              'لإجراء أي تعديل أو حذف على محضر معتمد، يجب أن تكون الصلاحية مضبوطة على «مدير مخوّل (كامل الصلاحيات)».',
            ];
          }
        } else if (text.includes('مسودة العمل غير المحفوظة')) {
          title = title || 'تمت استعادة مسودة العمل تلقائياً';
          categoryLabel = 'تنبيه حماية البيانات من الفقدان';
          if (details.length === 0) {
            details = [
              'اكتشف النظام وجود تعديلات غير محفوظة قبل تحديث الصفحة وقام باستعادتها بالكامل.',
              'يرجى مراجعة بيانات المحضر واستكمال التوقيعات ثم الضغط على «حفظ كمسودة» أو «حفظ واعتماد المحضر».',
            ];
          }
        } else if (text.includes('إلغاء التعديلات')) {
          title = title || 'تم إلغاء التعديلات غير المحفوظة';
          categoryLabel = 'إشعار التراجع عن التعديلات';
          if (details.length === 0) {
            details = [
              'تم إهمال التغييرات الأخيرة التي لم يتم حفظها في قاعدة البيانات.',
              'تمت استعادة الحالة الأصلية للمحضر بنجاح.',
            ];
          }
        } else {
          title =
            title ||
            (type === 'success'
              ? 'تم تنفيذ العملية بنجاح'
              : type === 'error'
              ? 'تعذر إتمام العملية — يرجى مراجعة التفاصيل'
              : 'تنبيه إجرائي من النظام');
          if (details.length === 0) {
            details = [
              type === 'error'
                ? 'يرجى التحقق من صحة واكتمال البيانات المدخلة أو الصلاحيات المطلوبة ثم المحاولة مرة أخرى.'
                : 'تم تحديث حالة النظام وفق الإجراء الذي قمت باختياره.',
            ];
          }
        }
      }

      setBannerMessage({
        type,
        text,
        title,
        categoryLabel,
        details,
      });
    },
    []
  );

  // 1. Real-time Firestore Listeners for Minutes and Employee Directory (Protected by Auth Session)
  useEffect(() => {
    if (!authSession) {
      setLoadingMinutes(false);
      return;
    }
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
  }, [authSession]);

  const handleLoginSuccess = useCallback((session: AuthenticatedSession) => {
    setAuthSession(session);
    if (session.displayName) {
      setOperatorName(session.displayName);
    }
    if (session.role) {
      setUserRole(session.role);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch {
      // Ignore signOut errors if not signed in via Firebase Auth
    }
    try {
      localStorage.removeItem(AUTH_SESSION_LOCAL_KEY);
      sessionStorage.removeItem(AUTH_SESSION_TEMP_KEY);
    } catch {
      // Ignore storage errors
    }
    setAuthSession(null);
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

  // Ensure viewer role defaults to visible tabs when 'active_list' and 'directory' are hidden
  useEffect(() => {
    if (!canEdit && (activeTab === 'active_list' || activeTab === 'directory')) {
      setActiveTab('approved_list');
    }
  }, [canEdit, activeTab]);

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

    const hasSecretarySignature = Boolean(currentBundle.minute.secretarySignature?.trim());
    const hasChairmanSignature = Boolean(currentBundle.minute.chairmanSignature?.trim());

    if (targetStatus === 'saved' && (!hasSecretarySignature || !hasChairmanSignature)) {
      showToast(
        'error',
        'لا يمكن اعتماد المحضر رسمياً عند عدم وجود توقيع من الطرفين (مقرر الاجتماع ورئيس الاجتماع). يمكنك حفظ المحضر «كمسودة» لحين استكمال التوقيعات.',
        {
          title: 'تعذر اعتماد المحضر — التوقيعات الرسمية غير مكتملة',
          categoryLabel: 'إشعار خطأ — شرط التوقيعات إلزامي للاعتماد',
          details: [
            `حالة توقيع مقرر الاجتماع (${currentBundle.minute.secretaryName || 'غير محدد'}): ${
              hasSecretarySignature
                ? 'مكتمل ومرفق بنجاح ✓'
                : 'غير موجود — يجب إرفاق صورة التوقيع أو الرسم الإلكتروني أو التوقيع النصي ✗'
            }`,
            `حالة توقيع رئيس الاجتماع (${currentBundle.minute.chairmanName || 'غير محدد'}): ${
              hasChairmanSignature
                ? 'مكتمل ومرفق بنجاح ✓'
                : 'غير موجود — يجب إرفاق صورة التوقيع أو الرسم الإلكتروني أو التوقيع النصي ✗'
            }`,
            'الإجراء المتاح: يمكنك الضغط على «حفظ كمسودة» لحفظ بيانات المحضر حالياً، أو استكمال توقيع الطرفين في قسم «سادساً: الاعتماد والتوقيعات» لاعتماد المحضر نهائياً.',
          ],
        }
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

  // Duplicate & Copy Minute with Auto-Next Sequential Number
  const handleDuplicateMinute = async (minuteId: string) => {
    const sourceMin = allMinutes.find((m) => m.id === minuteId);
    const sourceNumber = sourceMin?.minuteNumber || currentBundle.minute.minuteNumber;
    setDuplicatingId(minuteId);
    try {
      const cloned = await duplicateFullMinuteInDb(minuteId, operatorName);
      setCurrentBundle(cloned);
      setIsExistingRecord(true);
      setOriginalYearAndNumber({
        year: cloned.minute.year,
        minuteNumber: cloned.minute.minuteNumber,
      });
      setHasUnsavedChanges(false);
      showToast(
        'success',
        `تم تكرار ونسخ المحضر رقم (${formatMinuteNumber(sourceNumber)}) كمسودة برقم المحضر الجديد التالي (${formatMinuteNumber(cloned.minute.minuteNumber)}) لسنة ${cloned.minute.year} مع حذف الاعتمادات والاحتفاظ بالمحضر الأصلي.`,
        {
          title: 'تم تكرار ونسخ المحضر كمسودة برقم تسلسلي جديد',
          categoryLabel: 'إشعار نسخ وتكرار المحضر',
          details: [
            `المحضر الأصلي رقم (${formatMinuteNumber(sourceNumber)}) محفوظ كما هو بكامل اعتماداتـه وتوقيعاته في «المحاضر المعتمدة».`,
            `النسخة الجديدة رقم (${formatMinuteNumber(cloned.minute.minuteNumber)}) لسنة ${cloned.minute.year} تم حفظها «كمسودة» في تبويب «عرض المحاضر وتحريرها».`,
            'تم تفريغ وحذف التوقيعات والاعتمادات من النسخة الجديدة لإتاحة تعديلها واعتمادها من جديد.',
          ],
        }
      );
    } catch (err) {
      showToast(
        'error',
        err instanceof Error ? err.message : 'حدث خطأ أثناء تكرار ونسخ المحضر.'
      );
    } finally {
      setDuplicatingId(null);
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
          setActiveTab('approved_list');
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

  // Export PDF directly from list or editor
  const handleExportPdfById = async (minuteId: string) => {
    try {
      const full =
        currentBundle.minute.id === minuteId && (activeTab === 'editor' || activeTab === 'preview')
          ? currentBundle
          : await loadFullMinute(minuteId);
      await exportMinuteToPdf(full);
      showToast(
        'success',
        `تم تصدير ملف PDF للمحضر رقم (${formatMinuteNumber(full.minute.minuteNumber)}) بالاسم (${getOfficialMinuteFileBaseName(full)}.pdf) بنجاح.`
      );
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'تعذر تصدير ملف PDF.');
    }
  };

  // Real-time KPI Statistics derived strictly from actual application state
  const totalMinutesCount = allMinutes.length;
  const draftMinutesCount = allMinutes.filter((m) => m.status === 'draft').length;
  const approvedMinutesCount = allMinutes.filter((m) => m.status === 'saved').length;
  const participantsDirectoryCount = employeeDirectory.length;

  const [completedTopicsCount, setCompletedTopicsCount] = useState<number>(0);

  useEffect(() => {
    let active = true;
    if (allMinutes.length === 0) {
      setCompletedTopicsCount(0);
      return;
    }
    Promise.all(
      allMinutes.map(async (m) => {
        try {
          return await loadFullMinute(m.id);
        } catch {
          return null;
        }
      })
    )
      .then((bundles) => {
        if (!active) return;
        let totalCompleted = 0;
        bundles.forEach((b) => {
          if (!b) return;
          b.outcomes.forEach((o) => {
            if (isCompletedStatusValue(o.status)) totalCompleted++;
          });
          if (b.showOngoingTable !== false) {
            b.ongoingTopics.forEach((t) => {
              if (isCompletedStatusValue(t.topicStatus)) totalCompleted++;
            });
          }
          if (b.showNewTopicsTable !== false) {
            b.newTopics.forEach((n) => {
              if (isCompletedStatusValue(n.status)) totalCompleted++;
            });
          }
          (b.customTables ?? []).forEach((ct) => {
            ct.rows.forEach((r) => {
              if (isCompletedStatusValue(r.status)) totalCompleted++;
            });
          });
        });
        setCompletedTopicsCount(totalCompleted);
      })
      .catch(() => {
        // Ignore transient count error
      });
    return () => {
      active = false;
    };
  }, [allMinutes]);

  const showDashboardHeroAndKpis =
    activeTab === 'active_list' ||
    activeTab === 'approved_list' ||
    activeTab === 'completed_topics' ||
    activeTab === 'directory';

  if (!authSession) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="print-root-wrapper min-h-screen flex flex-col bg-[#F4F7FC] text-[#101F3D]">
      {/* Primary Executive Navigation Bar (Hidden in Print) */}
      <header className="no-print sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs px-4 sm:px-8">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-4 min-h-[68px]">
          {/* Zone 1 (Right in RTL): Official SAAED Brand Identity */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              guardedNavigate(() => setActiveTab('active_list'));
            }}
            className="flex items-center gap-3 shrink-0 group py-2"
          >
            <img
              src={`${import.meta.env.BASE_URL}assets/aistudio/logo_1afd1154.png`}
              alt="شعار ساعد"
              referrerPolicy="no-referrer"
              className="h-9 sm:h-10 object-contain transition-transform duration-200 group-hover:scale-[1.02]"
            />
            <div className="flex flex-col">
              <span className="text-base sm:text-lg font-extrabold tracking-tight text-[#101F3D] whitespace-nowrap font-display leading-tight">
                ساعـد (SAAED)
              </span>
              <span className="text-[10px] font-semibold text-[#64748B] hidden sm:inline">
                النظام المؤسسي لإدارة المحاضر
              </span>
            </div>
          </a>

          {/* Zone 2 (Center): Main Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-2 text-sm">
            {canEdit && (
              <button
                type="button"
                onClick={() => guardedNavigate(() => setActiveTab('active_list'))}
                className={`px-5 py-3.5 transition-all whitespace-nowrap shrink-0 flex items-center gap-2.5 rounded-t-xl cursor-pointer ${
                  activeTab === 'active_list'
                    ? 'bg-gradient-to-b from-[#162F63] to-[#101F3D] text-white font-bold border-b-[3px] border-[#C7A66B] shadow-md'
                    : 'text-[#101F3D]/80 hover:text-[#101F3D] hover:bg-slate-100/90 font-bold border-b-[3px] border-transparent rounded-xl'
                }`}
              >
                <ClipboardList
                  className={`w-4 h-4 shrink-0 ${
                    activeTab === 'active_list' ? 'text-[#C7A66B]' : 'text-[#1746B8]'
                  }`}
                />
                <span>عرض المحاضر وتحريرها</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => guardedNavigate(() => setActiveTab('approved_list'))}
              className={`px-5 py-3.5 transition-all whitespace-nowrap shrink-0 flex items-center gap-2.5 rounded-t-xl cursor-pointer ${
                activeTab === 'approved_list'
                  ? 'bg-gradient-to-b from-[#162F63] to-[#101F3D] text-white font-bold border-b-[3px] border-[#C7A66B] shadow-md'
                  : 'text-[#101F3D]/80 hover:text-[#101F3D] hover:bg-slate-100/90 font-bold border-b-[3px] border-transparent rounded-xl'
              }`}
            >
              <CheckCircle2
                className={`w-4 h-4 shrink-0 ${
                  activeTab === 'approved_list' ? 'text-[#C7A66B]' : 'text-[#1746B8]'
                }`}
              />
              <span>المحاضر المعتمدة</span>
            </button>

            <button
              type="button"
              onClick={() => guardedNavigate(() => setActiveTab('completed_topics'))}
              className={`px-5 py-3.5 transition-all whitespace-nowrap shrink-0 flex items-center gap-2.5 rounded-t-xl cursor-pointer ${
                activeTab === 'completed_topics'
                  ? 'bg-gradient-to-b from-[#162F63] to-[#101F3D] text-white font-bold border-b-[3px] border-[#C7A66B] shadow-md'
                  : 'text-[#101F3D]/80 hover:text-[#101F3D] hover:bg-slate-100/90 font-bold border-b-[3px] border-transparent rounded-xl'
              }`}
            >
              <Layers
                className={`w-4 h-4 shrink-0 ${
                  activeTab === 'completed_topics' ? 'text-[#C7A66B]' : 'text-[#1746B8]'
                }`}
              />
              <span>المواضيع المكتملة</span>
            </button>

            {canEdit && (
              <button
                type="button"
                onClick={() => guardedNavigate(() => setActiveTab('directory'))}
                className={`px-5 py-3.5 transition-all whitespace-nowrap shrink-0 flex items-center gap-2.5 rounded-t-xl cursor-pointer ${
                  activeTab === 'directory'
                    ? 'bg-gradient-to-b from-[#162F63] to-[#101F3D] text-white font-bold border-b-[3px] border-[#C7A66B] shadow-md'
                    : 'text-[#101F3D]/80 hover:text-[#101F3D] hover:bg-slate-100/90 font-bold border-b-[3px] border-transparent rounded-xl'
                }`}
              >
                <Users
                  className={`w-4 h-4 shrink-0 ${
                    activeTab === 'directory' ? 'text-[#C7A66B]' : 'text-[#1746B8]'
                  }`}
                />
                <span>سجل المشاركين</span>
              </button>
            )}
          </nav>

          {/* Zone 3 (Left in RTL): Primary CTA Button */}
          <div className="flex items-center gap-3 shrink-0">
            {canEdit && (
              <button
                type="button"
                onClick={() => guardedNavigate(startNewMinute)}
                className="px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-gradient-to-l from-[#1746B8] to-[#102C73] hover:from-[#123896] hover:to-[#0C2157] rounded-xl shadow-sm transition-all flex items-center gap-2 whitespace-nowrap shrink-0 border border-[#2878E3]/40 cursor-pointer"
              >
                <FilePlus className="w-4 h-4 text-[#C7A66B]" />
                <span>محضر جديد</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Secondary Executive Governance & Privilege Bar (Hidden in Print) */}
      <div className="no-print bg-[#101F3D] text-white border-b border-[#C7A66B]/30 px-4 sm:px-8 py-2.5 shadow-2xs">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-[#C7A66B] shrink-0" />
            <span className="font-bold text-white/95">
              وحدة إدارة محاضر الاجتماعات والأرشفة المؤسسية
            </span>
            <span className="hidden xl:inline text-white/40">|</span>
            <span className="hidden xl:inline text-[#C7A66B] font-semibold tracking-wide">
              SAAED Executive Meeting Intelligence
            </span>
          </div>

          {/* Mobile Nav + Operator Name + Role Permissions Switcher */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex lg:hidden items-center gap-1 bg-white/10 p-1 rounded-lg border border-white/15">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => guardedNavigate(() => setActiveTab('active_list'))}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                    activeTab === 'active_list'
                      ? 'bg-[#C7A66B] text-[#101F3D]'
                      : 'text-white/85 hover:text-white'
                  }`}
                >
                  المسودات
                </button>
              )}
              <button
                type="button"
                onClick={() => guardedNavigate(() => setActiveTab('approved_list'))}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                  activeTab === 'approved_list'
                    ? 'bg-[#C7A66B] text-[#101F3D]'
                    : 'text-white/85 hover:text-white'
                }`}
              >
                المعتمدة
              </button>
              <button
                type="button"
                onClick={() => guardedNavigate(() => setActiveTab('completed_topics'))}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                  activeTab === 'completed_topics'
                    ? 'bg-[#C7A66B] text-[#101F3D]'
                    : 'text-white/85 hover:text-white'
                }`}
              >
                المواضيع المكتملة
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => guardedNavigate(() => setActiveTab('directory'))}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                    activeTab === 'directory'
                      ? 'bg-[#C7A66B] text-[#101F3D]'
                      : 'text-white/85 hover:text-white'
                  }`}
                >
                  السجل
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-lg border border-white/15">
              <UserCheck className="w-3.5 h-3.5 text-[#C7A66B] shrink-0" />
              <span className="text-white/80 font-medium">اسم الموظف المعدّل:</span>
              <input
                type="text"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                placeholder="اسم المستخدم لتوثيق التعديلات..."
                className="px-2 py-0.5 text-xs border border-white/20 rounded bg-white text-[#101F3D] font-semibold w-36 sm:w-44 focus:outline-none focus:ring-2 focus:ring-[#C7A66B]"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-lg border border-white/15">
              <ShieldCheck className="w-3.5 h-3.5 text-[#C7A66B] shrink-0" />
              <span className="text-white/80 font-medium">الصلاحية:</span>
              <select
                value={userRole}
                onChange={(e) => setUserRole(e.target.value as UserRole)}
                className="px-2 py-0.5 text-xs font-bold border border-white/20 rounded bg-white text-[#101F3D] focus:outline-none focus:ring-2 focus:ring-[#C7A66B]"
              >
                <option value="admin">مدير مخوّل (كامل الصلاحيات — تعديل وحذف المحاضر المعتمدة)</option>
                <option value="secretary">مقرر اجتماع (إضافة وتعديل المسودات + معاينة المعتمدة)</option>
                <option value="viewer">مطلع (عرض ومعاينة وطباعة فقط)</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => guardedNavigate(handleLogout)}
              title="تسجيل الخروج والعودة إلى صفحة الدخول"
              className="flex items-center gap-1.5 bg-red-500/20 hover:bg-red-500/35 text-white px-2.5 py-1 rounded-lg border border-red-400/30 text-xs font-bold transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-[#C7A66B] shrink-0" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </div>

      {/* Popup Notification Modal for Errors, Approvals, and Accreditations */}
      {bannerMessage && (
        <div
          onClick={() => setBannerMessage(null)}
          className="no-print fixed inset-0 z-50 bg-[#101F3D]/70 backdrop-blur-[3px] flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Colored Top Header */}
            <div
              className={`px-6 py-4 border-b flex items-start justify-between gap-3 ${
                bannerMessage.type === 'success'
                  ? 'bg-emerald-50/95 border-emerald-200'
                  : bannerMessage.type === 'error'
                  ? 'bg-red-50/95 border-red-200'
                  : 'bg-amber-50/95 border-amber-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                    bannerMessage.type === 'success'
                      ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                      : bannerMessage.type === 'error'
                      ? 'bg-red-100 border-red-300 text-red-800'
                      : 'bg-amber-100 border-amber-300 text-amber-800'
                  }`}
                >
                  {bannerMessage.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
                  {bannerMessage.type === 'error' && <AlertTriangle className="w-5 h-5" />}
                  {bannerMessage.type === 'warning' && <AlertTriangle className="w-5 h-5" />}
                </div>
                <div className="space-y-1">
                  <span
                    className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${
                      bannerMessage.type === 'success'
                        ? 'bg-white border-emerald-300 text-emerald-800'
                        : bannerMessage.type === 'error'
                        ? 'bg-white border-red-300 text-red-800'
                        : 'bg-white border-amber-300 text-amber-800'
                    }`}
                  >
                    {bannerMessage.categoryLabel}
                  </span>
                  <h3 className="text-sm sm:text-base font-extrabold text-[#101F3D] leading-snug">
                    {bannerMessage.title}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBannerMessage(null)}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-black/5 rounded-lg transition-colors shrink-0"
                title="إغلاق الإشعار"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body Content with Explanation */}
            <div className="p-6 space-y-4">
              <div
                className={`p-3.5 rounded-xl border text-xs font-bold leading-relaxed ${
                  bannerMessage.type === 'success'
                    ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                    : bannerMessage.type === 'error'
                    ? 'bg-red-50/50 border-red-200 text-red-950'
                    : 'bg-amber-50/50 border-amber-200 text-amber-950'
                }`}
              >
                {bannerMessage.text}
              </div>

              {bannerMessage.details && bannerMessage.details.length > 0 && (
                <div className="bg-[#F4F7FC] border border-slate-200/90 rounded-xl p-4 space-y-2.5">
                  <div className="text-xs font-bold text-[#101F3D] border-b border-slate-200 pb-2 flex items-center justify-between">
                    <span>شرح وتفاصيل العملية:</span>
                    <span className="text-[11px] font-normal text-slate-500">
                      نظام إدارة محاضر الاجتماعات — ساعد
                    </span>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-700 leading-relaxed">
                    {bannerMessage.details.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span
                          className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                            bannerMessage.type === 'success'
                              ? 'bg-emerald-100 text-emerald-800'
                              : bannerMessage.type === 'error'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <span className="flex-1">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Footer Action */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setBannerMessage(null)}
                className={`px-5 py-2 text-xs font-bold text-white rounded-xl transition-colors cursor-pointer ${
                  bannerMessage.type === 'success'
                    ? 'bg-[#059669] hover:bg-emerald-700'
                    : bannerMessage.type === 'error'
                    ? 'bg-[#DC2626] hover:bg-red-700'
                    : 'bg-[#D97706] hover:bg-amber-700'
                }`}
              >
                حسناً، إغلاق الإشعار
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area (Opens Directly Without Any Login Page) */}
      <main
        className={`print-main-wrapper flex-1 w-full mx-auto ${
          activeTab === 'preview'
            ? 'max-w-none px-0 py-0'
            : 'max-w-[1440px] px-4 sm:px-8 py-6 space-y-6'
        }`}
      >
        {/* Executive Hero Banner & Live KPI Strip (Shown on Main Dashboard Tabs, Hidden in Print) */}
        {showDashboardHeroAndKpis && (
          <div className="no-print space-y-6">
            {/* Pixel-Precise Executive Hero Banner Matching Target Reference (100% Real Selectable DOM Text) */}
            <section
              aria-label="نظام إدارة محاضر الاجتماعات والأرشفة المؤسسية"
              className="relative rounded-[18px] overflow-hidden border border-[#1E3A6D]/45 shadow-[0_12px_32px_-8px_rgba(11,25,53,0.45)] bg-[#0B1935] min-h-[210px] sm:min-h-[230px] lg:h-[246px] flex flex-col lg:block select-text"
            >
              {/* Left-Side Photorealistic 4K Executive Boardroom Scene */}
              <div className="relative w-full lg:absolute lg:inset-y-0 lg:left-0 lg:w-[63%] h-[200px] sm:h-[225px] lg:h-full overflow-hidden pointer-events-none select-none">
                <img
                  src={heroBoardroomImg}
                  alt="قاعة الاجتماعات التنفيذية — ساعد (SAAED)"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-[center_64%] scale-[1.03]"
                />
                {/* Subtle right-edge shadow where the chevron overlaps the photograph */}
                <div
                  className="hidden lg:block absolute inset-y-0 right-0 w-28"
                  style={{
                    background:
                      'linear-gradient(270deg, rgba(6, 15, 34, 0.72) 0%, rgba(6, 15, 34, 0.25) 55%, transparent 100%)',
                  }}
                />
              </div>

              {/* Desktop SVG Geometric Chevron Navy/Royal-Blue Background Panel & Bevelled Edge */}
              <svg
                className="hidden lg:block absolute inset-0 w-full h-full pointer-events-none select-none z-[1]"
                viewBox="0 0 1440 246"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  {/* Main Dark Navy to Royal Blue Panel Fill */}
                  <linearGradient id="heroNavyPanelGrad" x1="0%" y1="15%" x2="100%" y2="85%">
                    <stop offset="0%" stopColor="#0C2960" />
                    <stop offset="28%" stopColor="#0B2250" />
                    <stop offset="68%" stopColor="#081A3E" />
                    <stop offset="100%" stopColor="#06132E" />
                  </linearGradient>

                  {/* 3D Bevelled Chevron Ribbon Fill */}
                  <linearGradient id="heroChevronBevelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="45%" stopColor="#1D4ED8" />
                    <stop offset="55%" stopColor="#1746A2" />
                    <stop offset="100%" stopColor="#0F2C67" />
                  </linearGradient>

                  {/* Outer Cyan/Electric-Blue Specular Edge */}
                  <linearGradient id="heroChevronEdgeGlow" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#93C5FD" stopOpacity="0.95" />
                    <stop offset="48%" stopColor="#60A5FA" stopOpacity="1" />
                    <stop offset="75%" stopColor="#2563EB" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#1E40AF" stopOpacity="0.75" />
                  </linearGradient>

                  {/* Radial Royal Blue Atmospheric Highlight inside Panel */}
                  <radialGradient id="heroInnerRadialGlow" cx="72%" cy="46%" r="36%">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity="0.38" />
                    <stop offset="55%" stopColor="#1746A2" stopOpacity="0.16" />
                    <stop offset="100%" stopColor="#081A3E" stopOpacity="0" />
                  </radialGradient>

                  {/* Bottom Right Metallic Gold Lip Gradient */}
                  <linearGradient id="heroBottomGoldLip" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#C59B46" />
                    <stop offset="35%" stopColor="#E5C87D" />
                    <stop offset="70%" stopColor="#D5B36A" />
                    <stop offset="100%" stopColor="#B68B3A" />
                  </linearGradient>

                  <filter id="chevronDropShadow" x="-10%" y="-10%" width="120%" height="120%">
                    <feDropShadow dx="-8" dy="2" stdDeviation="7" floodColor="#020817" floodOpacity="0.65" />
                  </filter>
                </defs>

                {/* Drop-Shadowed Main Right Panel with Left-Pointing Rounded Chevron */}
                <path
                  d="M 832,0 L 1440,0 L 1440,246 L 866,246 L 788,136 Q 778,122 788,108 Z"
                  fill="url(#heroNavyPanelGrad)"
                  filter="url(#chevronDropShadow)"
                />

                {/* Radial Blue Spotlight Overlay */}
                <path
                  d="M 832,0 L 1440,0 L 1440,246 L 866,246 L 788,136 Q 778,122 788,108 Z"
                  fill="url(#heroInnerRadialGlow)"
                />

                {/* Subtle Geometric Network / Constellation Lines on the Right */}
                <g stroke="#60A5FA" strokeOpacity="0.1" strokeWidth="1" fill="none">
                  <line x1="1260" y1="22" x2="1385" y2="95" />
                  <line x1="1385" y1="95" x2="1310" y2="195" />
                  <line x1="1310" y1="195" x2="1425" y2="225" />
                  <line x1="1210" y1="145" x2="1310" y2="195" />
                  <line x1="1150" y1="30" x2="1260" y2="22" />
                  <line x1="860" y1="38" x2="945" y2="12" />
                </g>
                <g fill="#93C5FD" fillOpacity="0.18">
                  <circle cx="1260" cy="22" r="2.5" />
                  <circle cx="1385" cy="95" r="2.5" />
                  <circle cx="1310" cy="195" r="2" />
                  <circle cx="1210" cy="145" r="2" />
                </g>

                {/* 3D Bevelled Chevron Border Strip */}
                <path
                  d="M 830,0 L 848,0 L 805,109 Q 796,122 805,135 L 883,246 L 864,246 L 786,136 Q 776,122 786,108 Z"
                  fill="url(#heroChevronBevelGrad)"
                />

                {/* Luminous Outer Cyan-Blue Highlight Line on Chevron */}
                <path
                  d="M 830,0 L 786,108 Q 776,122 786,136 L 864,246"
                  fill="none"
                  stroke="url(#heroChevronEdgeGlow)"
                  strokeWidth="2.5"
                />

                {/* Inner Subtle Specular Line on Chevron */}
                <path
                  d="M 848,0 L 805,109 Q 796,122 805,135 L 883,246"
                  fill="none"
                  stroke="#60A5FA"
                  strokeOpacity="0.35"
                  strokeWidth="1.2"
                />

                {/* Top Edge Electric Blue Flare (Near x=1090) */}
                <ellipse cx="1095" cy="1.5" rx="95" ry="2.5" fill="#60A5FA" fillOpacity="0.75" />
                <ellipse cx="1095" cy="1.5" rx="42" ry="1.5" fill="#FFFFFF" fillOpacity="0.9" />

                {/* Bottom Metallic Gold Bar / Lip (From x=1035 to right corner) */}
                <path
                  d="M 1038,246 L 1046,238 L 1440,238 L 1440,246 Z"
                  fill="url(#heroBottomGoldLip)"
                />
                <line
                  x1="1046"
                  y1="238"
                  x2="1440"
                  y2="238"
                  stroke="#FFF3C4"
                  strokeOpacity="0.65"
                  strokeWidth="1"
                />
              </svg>

              {/* Right-Side Content Container (Real Selectable HTML/DOM Text + 3D Gold Folder SVG) */}
              <div
                className="relative z-10 w-full lg:w-[45.5%] lg:mr-0 lg:ml-auto h-full flex items-center justify-end px-5 sm:px-8 lg:pl-6 lg:pr-7 py-6 lg:py-0 bg-gradient-to-b from-[#0C2554] to-[#07152E] lg:bg-none"
                dir="rtl"
              >
                <div className="w-full flex items-center justify-end gap-4 sm:gap-5 lg:gap-6">
                  {/* Right-Most Element in RTL: 3D Metallic Gold Folder & Document Icon */}
                  <div className="shrink-0 flex items-center justify-center order-1">
                    <svg
                      className="w-14 h-14 sm:w-16 sm:h-16 lg:w-[70px] lg:h-[70px] drop-shadow-[0_6px_14px_rgba(0,0,0,0.5)]"
                      viewBox="0 0 88 84"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <defs>
                        <linearGradient id="goldFolderFront" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#F5E1A4" />
                          <stop offset="45%" stopColor="#D7B46A" />
                          <stop offset="85%" stopColor="#B58B3E" />
                          <stop offset="100%" stopColor="#8F6824" />
                        </linearGradient>
                        <linearGradient id="goldFolderBack" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#DFC079" />
                          <stop offset="100%" stopColor="#9A732C" />
                        </linearGradient>
                        <linearGradient id="docSheetGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#FFFFFF" />
                          <stop offset="100%" stopColor="#DCE6F7" />
                        </linearGradient>
                      </defs>

                      {/* Back Folder Frame (Gold Outline) */}
                      <path
                        d="M12 24C12 20.6863 14.6863 18 18 18H33L39 24H68C71.3137 24 74 26.6863 74 30V66C74 69.3137 71.3137 72 68 72H18C14.6863 72 12 69.3137 12 66V24Z"
                        fill="#0B214A"
                        stroke="url(#goldFolderBack)"
                        strokeWidth="3.2"
                      />

                      {/* White/Silver Document Sheet Protruding from Folder */}
                      <path
                        d="M24 12C24 9.79086 25.7909 8 28 8H55L65 18V54C65 56.2091 63.2091 58 61 58H28C25.7909 58 24 56.2091 24 54V12Z"
                        fill="#0E2A5C"
                        stroke="url(#docSheetGrad)"
                        strokeWidth="2.8"
                        strokeLinejoin="round"
                      />
                      {/* Folded Corner of Document */}
                      <path
                        d="M54 8V18H64"
                        stroke="url(#docSheetGrad)"
                        strokeWidth="2.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {/* Horizontal Document Text Lines */}
                      <line
                        x1="31"
                        y1="21"
                        x2="48"
                        y2="21"
                        stroke="#E2E8F0"
                        strokeWidth="2.6"
                        strokeLinecap="round"
                      />
                      <line
                        x1="31"
                        y1="28"
                        x2="57"
                        y2="28"
                        stroke="#E2E8F0"
                        strokeWidth="2.6"
                        strokeLinecap="round"
                      />
                      <line
                        x1="31"
                        y1="35"
                        x2="57"
                        y2="35"
                        stroke="#E2E8F0"
                        strokeWidth="2.6"
                        strokeLinecap="round"
                      />

                      {/* 3D Slanted Metallic Gold Front Folder Flap */}
                      <path
                        d="M14 71L23 41C23.8 38.4 26.2 36.6 28.9 36.6H75.5C78.8 36.6 81.1 39.8 80.1 43L71.5 68.5C70.7 70.9 68.4 72.5 65.8 72.5H15.5C14.5 72.5 13.7 71.9 14 71Z"
                        fill="url(#goldFolderFront)"
                        stroke="#FBE8B2"
                        strokeWidth="1.2"
                      />
                    </svg>
                  </div>

                  {/* Text Column (To the Left of the Gold Folder Icon, Right-Aligned RTL) */}
                  <div className="flex-1 min-w-0 text-right order-2 space-y-1.5">
                    {/* 1. Arabic Main Title (Single Line on Desktop) */}
                    <h1
                      style={{ fontFamily: "'Cairo', 'IBM Plex Sans Arabic', sans-serif" }}
                      className="text-xs sm:text-base lg:text-[17.5px] xl:text-[19.5px] font-extrabold text-white tracking-tight leading-snug lg:whitespace-nowrap drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]"
                    >
                      نظام إدارة محاضر الاجتماعات والأرشفة المؤسسية
                    </h1>

                    {/* 2. English Subtitle (Right-Aligned Directly Under Arabic Title) */}
                    <p
                      dir="ltr"
                      style={{ fontFamily: "'Inter', 'Cairo', sans-serif" }}
                      className="text-xs sm:text-base lg:text-[17.5px] xl:text-[19.5px] font-semibold text-[#E2C074] tracking-[0.01em] leading-snug text-right drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
                    >
                      Meeting Minutes &amp; Digital Archiving System
                    </p>

                    {/* 3. Metallic Gold Horizontal Divider with Glowing Blue/White Optical Flare */}
                    <div className="relative w-full h-[2px] my-2.5 flex items-center">
                      <div
                        className="w-full h-[1.5px] rounded-full"
                        style={{
                          background:
                            'linear-gradient(270deg, #D5B36A 0%, #E8CC88 45%, #93C5FD 64%, #D5B36A 82%, rgba(213,179,106,0.35) 100%)',
                        }}
                      />
                      {/* Glowing Optical Light Flare on the Line */}
                      <div
                        className="absolute left-[33%] w-24 h-[5px] -translate-x-1/2 rounded-full blur-[2px] pointer-events-none"
                        style={{
                          background:
                            'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(96,165,250,0.85) 45%, transparent 100%)',
                        }}
                      />
                    </div>

                    {/* 4. Arabic Description (2 Balanced Lines Right-Aligned) */}
                    <p
                      style={{ fontFamily: "'Cairo', 'IBM Plex Sans Arabic', sans-serif" }}
                      className="text-xs sm:text-sm lg:text-[15px] xl:text-[16px] font-semibold text-[#F1F5F9] leading-[1.65] pt-0.5 drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]"
                    >
                      منصة موحدة لإدارة الاجتماعات، توثيق المحاضر والقرارات،
                      <br className="hidden sm:inline" /> ومتابعة الاعتمادات والأرشفة المؤسسية بكفاءة واحترافية.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Real-Time Executive KPI Cards Strip (100% Live Data from Firestore) */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* KPI Card 1 (Primary Featured Navy/Royal Blue Card with Gold Accent): Total Minutes */}
              <div
                onClick={() => guardedNavigate(() => setActiveTab('active_list'))}
                className="relative rounded-2xl p-5 text-white shadow-md border border-[#C7A66B]/60 overflow-hidden cursor-pointer group transition-all hover:-translate-y-0.5 hover:shadow-lg"
                style={{
                  background:
                    'linear-gradient(135deg, #101F3D 0%, #14326E 55%, #1746B8 100%)',
                }}
              >
                {/* Gold Corner Accent */}
                <div className="absolute -bottom-5 -left-5 w-16 h-16 rounded-full bg-gradient-to-tr from-[#C7A66B] to-[#E5C98B] opacity-85 pointer-events-none" />
                <div className="relative z-10 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-200">إجمالي المحاضر</p>
                    <p className="text-3xl font-extrabold font-mono-num text-white mt-1">
                      {totalMinutesCount}
                    </p>
                    <p className="text-[11px] text-[#C7A66B] font-semibold mt-1.5">
                      جميع السجلات المسجلة بالنظام
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <FileText className="w-6 h-6 text-[#C7A66B]" />
                  </div>
                </div>
              </div>

              {/* KPI Card 2 (White Executive Card): Draft Minutes Under Preparation */}
              <div
                onClick={() => guardedNavigate(() => setActiveTab('active_list'))}
                className={`bg-white rounded-2xl p-5 border transition-all cursor-pointer group hover:-translate-y-0.5 hover:shadow-md ${
                  activeTab === 'active_list'
                    ? 'border-[#1746B8] ring-2 ring-[#1746B8]/10 shadow-sm'
                    : 'border-slate-200/90 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-[#101F3D]">المحاضر قيد الإعداد</p>
                    <p className="text-3xl font-extrabold font-mono-num text-[#101F3D] mt-1">
                      {draftMinutesCount}
                    </p>
                    <p className="text-[11px] font-semibold text-[#D97706] mt-1.5 flex items-center gap-1">
                      <span>مسودة قيد الإعداد والتحرير</span>
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-[#F4F7FC] border border-slate-200 flex items-center justify-center shrink-0 text-[#1746B8] group-hover:bg-[#1746B8] group-hover:text-white transition-colors">
                    <FileEdit className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* KPI Card 3 (White Executive Card): Approved Minutes */}
              <div
                onClick={() => guardedNavigate(() => setActiveTab('approved_list'))}
                className={`bg-white rounded-2xl p-5 border transition-all cursor-pointer group hover:-translate-y-0.5 hover:shadow-md ${
                  activeTab === 'approved_list'
                    ? 'border-[#059669] ring-2 ring-[#059669]/10 shadow-sm'
                    : 'border-slate-200/90 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-[#101F3D]">المحاضر المعتمدة</p>
                    <p className="text-3xl font-extrabold font-mono-num text-[#101F3D] mt-1">
                      {approvedMinutesCount}
                    </p>
                    <p className="text-[11px] font-semibold text-[#059669] mt-1.5 flex items-center gap-1">
                      <span>▲ معتمدة وموثقة رسمياً</span>
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center shrink-0 text-[#059669] group-hover:bg-[#059669] group-hover:text-white transition-colors">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* KPI Card 4 (White Executive Card): Completed Topics */}
              <div
                onClick={() => guardedNavigate(() => setActiveTab('completed_topics'))}
                className={`bg-white rounded-2xl p-5 border transition-all cursor-pointer group hover:-translate-y-0.5 hover:shadow-md ${
                  activeTab === 'completed_topics'
                    ? 'border-[#059669] ring-2 ring-[#059669]/10 shadow-sm'
                    : 'border-slate-200/90 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-[#101F3D]">الموضوعات المكتملة</p>
                    <p className="text-3xl font-extrabold font-mono-num text-[#101F3D] mt-1">
                      {completedTopicsCount}
                    </p>
                    <p className="text-[11px] font-semibold text-[#059669] mt-1.5 flex items-center gap-1">
                      <span>▲ منجزة ومكتملة التنفيذ</span>
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-center shrink-0 text-[#1746B8] group-hover:bg-[#1746B8] group-hover:text-white transition-colors">
                    <Layers className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* KPI Card 5 (White Executive Card): Participants Count */}
              <div
                onClick={() => guardedNavigate(() => setActiveTab('directory'))}
                className={`bg-white rounded-2xl p-5 border transition-all cursor-pointer group hover:-translate-y-0.5 hover:shadow-md ${
                  activeTab === 'directory'
                    ? 'border-[#1746B8] ring-2 ring-[#1746B8]/10 shadow-sm'
                    : 'border-slate-200/90 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-[#101F3D]">عدد المشاركين</p>
                    <p className="text-3xl font-extrabold font-mono-num text-[#101F3D] mt-1">
                      {participantsDirectoryCount}
                    </p>
                    <p className="text-[11px] font-semibold text-[#059669] mt-1.5 flex items-center gap-1">
                      <span>▲ مسجلون في سجل المشاركين</span>
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-[#F4F7FC] border border-slate-200 flex items-center justify-center shrink-0 text-[#1746B8] group-hover:bg-[#1746B8] group-hover:text-white transition-colors">
                    <Users className="w-6 h-6" />
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'active_list' ? (
          <ActiveMinutesTab
            minutes={allMinutes}
            loading={loadingMinutes}
            canEdit={canEdit}
            isAuthorizedAdmin={isAuthorizedAdmin}
            onCreateNew={startNewMinute}
            onOpenApprovedTab={() => setActiveTab('approved_list')}
            onViewDetails={(id) => openMinuteFromDb(id, 'view')}
            onEditMinute={(id) => openMinuteFromDb(id, 'edit')}
            onPreviewMinute={(id) => openMinuteFromDb(id, 'preview')}
            onPrintMinute={(id) => openMinuteFromDb(id, 'print')}
            onExportPdf={handleExportPdfById}
            onExportWord={handleExportDocxById}
            onArchiveMinute={handleArchiveMinute}
            onDeleteMinute={handleDeleteMinute}
          />
        ) : activeTab === 'approved_list' ? (
          <ApprovedMinutesTab
            minutes={allMinutes}
            loading={loadingMinutes}
            isAuthorizedAdmin={isAuthorizedAdmin}
            duplicatingId={duplicatingId}
            onDuplicateMinute={handleDuplicateMinute}
            onEditMinute={(id) => openMinuteFromDb(id, 'edit')}
            onPreviewMinute={(id) => openMinuteFromDb(id, 'preview')}
            onPrintMinute={(id) => openMinuteFromDb(id, 'print')}
            onExportPdf={handleExportPdfById}
            onExportWord={handleExportDocxById}
            onArchiveMinute={handleArchiveMinute}
            onDeleteMinute={handleDeleteMinute}
          />
        ) : activeTab === 'completed_topics' ? (
          <CompletedTopicsTab
            minutes={allMinutes}
            onPreviewMinute={(id) => openMinuteFromDb(id, 'preview')}
          />
        ) : activeTab === 'directory' ? (
          /* Employee / Participant Directory Management */
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
            {/* Directory Visual Header */}
            <div className="relative bg-gradient-to-l from-[#101F3D] via-[#142C5E] to-[#1746B8] text-white p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#C7A66B]/40">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/10 border border-[#C7A66B]/50 flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6 text-[#C7A66B]" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg font-extrabold text-white font-display">
                      سجل المشاركين والموظفين الدائم
                    </h2>
                    <span className="px-2.5 py-0.5 text-xs font-bold bg-[#C7A66B] text-[#101F3D] rounded-md font-mono-num">
                      {employeeDirectory.length}
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 mt-1">
                    يُستخدم هذا السجل لاختيار الموظفين والمشاركين ورئيس ومقرر الاجتماع بسرعة داخل المحاضر مع إمكانية الإدخال اليدوي المباشر في أي محضر
                  </p>
                </div>
              </div>
              <div className="hidden lg:block w-44 h-16 rounded-xl overflow-hidden border border-white/20 shrink-0">
                <img
                  src={archiveHeaderImg}
                  alt="الأرشفة المؤسسية"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <div className="p-6 space-y-6">
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
                  className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-[#F4F7FC] p-5 rounded-xl border border-slate-200/90 items-end"
                >
                  <div>
                    <label className="block text-xs font-bold text-[#101F3D] mb-1.5">
                      الاسم الكامل
                    </label>
                    <input
                      type="text"
                      required
                      value={dirNameInput}
                      onChange={(e) => setDirNameInput(e.target.value)}
                      placeholder="اسم الموظف..."
                      className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1746B8]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#101F3D] mb-1.5">
                      المسمى الوظيفي
                    </label>
                    <input
                      type="text"
                      value={dirTitleInput}
                      onChange={(e) => setDirTitleInput(e.target.value)}
                      placeholder="المسمى الوظيفي..."
                      className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1746B8]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#101F3D] mb-1.5">
                      الإدارة / القسم (اختياري)
                    </label>
                    <input
                      type="text"
                      value={dirDeptInput}
                      onChange={(e) => setDirDeptInput(e.target.value)}
                      placeholder="الإدارة..."
                      className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1746B8]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2.5 text-xs font-bold text-white bg-gradient-to-l from-[#1746B8] to-[#101F3D] hover:from-[#123896] hover:to-[#0C1830] rounded-lg shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-[#C7A66B]" />
                    <span>إضافة إلى سجل المشاركين</span>
                  </button>
                </form>
              )}

              <div className="overflow-x-auto rounded-xl border border-slate-200/90">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-gradient-to-l from-[#101F3D] via-[#152F61] to-[#1746B8] text-white font-bold">
                      <th className="py-3.5 px-4 w-14 text-center border-l border-white/10">م</th>
                      <th className="py-3.5 px-4 border-l border-white/10">الاسم</th>
                      <th className="py-3.5 px-4 border-l border-white/10">المسمى الوظيفي</th>
                      <th className="py-3.5 px-4 border-l border-white/10">الإدارة / القسم</th>
                      {canEdit && <th className="py-3.5 px-4 w-24 text-center">حذف</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80">
                    {employeeDirectory.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-slate-500">
                          <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          سجل المشاركين فارغ حالياً. يمكنك إضافة الموظفين هنا أو إدخالهم مباشرة داخل جدول المحضر.
                        </td>
                      </tr>
                    ) : (
                      employeeDirectory.map((emp, idx) => (
                        <tr
                          key={emp.id}
                          className="hover:bg-[#F4F7FC] transition-colors even:bg-slate-50/40"
                        >
                          <td className="py-3 px-4 text-center font-mono-num font-bold text-[#101F3D]">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-4 font-bold text-[#101F3D]">{emp.name}</td>
                          <td className="py-3 px-4 text-slate-700 font-medium">
                            {emp.jobTitle || '-'}
                          </td>
                          <td className="py-3 px-4 text-slate-600">{emp.department || '-'}</td>
                          {canEdit && (
                            <td className="py-3 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => removeEmployeeFromDirectory(emp.id)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
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
          </div>
        ) : activeTab === 'preview' ? (
          /* Official Print & PDF Preview Mode — Pixel-Accurate Executive Workspace */
          <div className="print-preview-wrapper w-full space-y-0">
            {/* Layer 03 & 04: Panoramic Executive Meeting Room Hero Banner & Right-Side Text Overlay (Screen Only) */}
            <section
              aria-label="معاينة محضر الاجتماع"
              className="no-print relative w-full overflow-hidden border-b border-[#1E3A6D]/50 bg-[#091B3D] h-[185px] sm:h-[200px] flex items-center select-text"
            >
              <img
                src={heroBoardroomImg}
                alt="قاعة الاجتماعات التنفيذية — ساعد"
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover object-[center_52%] select-none pointer-events-none"
              />
              {/* Right-to-left navy gradient behind text keeping boardroom table visible on the left */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'linear-gradient(270deg, rgba(9, 27, 61, 0.90) 0%, rgba(13, 35, 76, 0.85) 45%, rgba(13, 35, 76, 0.28) 72%, rgba(9, 27, 61, 0.12) 100%)',
                }}
              />
              <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#091B3D]/65 to-transparent pointer-events-none" />

              {/* Real Selectable HTML Text Positioned on the Right Side (Matching Reference) */}
              <div className="relative z-20 max-w-[1169px] w-full mx-auto px-4 sm:px-8 py-4 flex justify-center md:justify-start">
                <div className="w-full max-w-[540px] md:mr-14 lg:mr-20 text-center select-text">
                  <h1 className="text-[26px] sm:text-[32px] font-extrabold text-white font-display tracking-tight leading-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)] select-text">
                    معاينة محضر الاجتماع
                  </h1>
                  <h2
                    className="text-[18px] sm:text-[22px] font-bold text-white mt-0.5 tracking-wide leading-snug drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)] select-text"
                    dir="ltr"
                  >
                    Meeting Minutes Preview
                  </h2>
                  {/* Subtle glowing horizontal divider */}
                  <div className="w-64 sm:w-[410px] max-w-full h-[1px] mx-auto my-2 bg-gradient-to-r from-transparent via-[#7FB3FF] to-transparent opacity-95" />
                  <p className="text-[11.5px] sm:text-[12.5px] font-semibold text-slate-100 leading-relaxed drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)] select-text">
                    منصة مؤسسية متكاملة لعرض المحاضر الرسمية وإدارتها واعتمادها وأرشفتها
                  </p>
                </div>
              </div>
            </section>

            {/* Layer 05, 06 & 07: Luxury Executive Desk Workspace, Document Action Toolbar & Centered Document */}
            <div className="print-preview-workspace relative w-full bg-[#0B1322] pt-5 sm:pt-6 pb-14 sm:pb-20 overflow-x-clip min-h-[900px]">
              {/* Executive Desk Panoramic Surface Image (Layered underneath document, seamlessly blended) */}
              <div
                aria-hidden="true"
                className="no-print absolute top-0 inset-x-0 w-full h-[880px] pointer-events-none select-none z-0 overflow-hidden flex justify-center"
              >
                <img
                  src={deskPanoramicMatImg}
                  alt="بيئة مكتبية تنفيذية راقية — ساعد"
                  className="w-[1440px] max-w-none h-[880px] object-cover object-top select-none pointer-events-none opacity-95"
                />
                {/* Smooth vertical fade blending bottom of desk photo into the solid deep navy workspace */}
                <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-[#0B1322] via-[#0B1322]/80 to-transparent pointer-events-none" />
                {/* Subtle radial vignette bringing focus to the central document */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      'radial-gradient(circle at 50% 30%, rgba(255, 255, 255, 0.02) 0%, rgba(11, 19, 34, 0.2) 60%, rgba(11, 19, 34, 0.85) 100%)',
                  }}
                />
              </div>

              {/* Layer 05: Document Action Toolbar (~975px width, positioned cleanly below Hero Section — Screen Only) */}
              <div className="no-print relative z-30 mt-0 mx-auto max-w-[975px] w-[94%]">
                <div className="bg-white/95 backdrop-blur-md border border-[#CAD8EB]/80 rounded-[16px] px-4 sm:px-5 py-3.5 h-auto shadow-[0_16px_36px_-6px_rgba(2,8,20,0.5)] space-y-3">
                  {/* Top Row: Document Title & Metadata */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-b from-[#10264D] to-[#091B3D] text-[#C7A66B] border border-[#C7A66B]/35 shadow-2xs flex items-center justify-center shrink-0">
                        <Briefcase className="w-4 h-4" />
                      </div>
                      <div className="text-right">
                        <h2 className="text-[13px] sm:text-[14px] font-extrabold text-[#10264D] font-display leading-snug">
                          {isAuthorizedAdmin
                            ? 'معاينة المحضر الرسمية (مطابقة للطباعة وتصدير PDF / Word)'
                            : 'معاينة المحضر الرسمية (مطابقة للطباعة وتصدير PDF)'}
                        </h2>
                        <p className="text-[11px] text-[#60718A] mt-0.5 font-medium leading-relaxed">
                          (مقاس الورق 210 × 297 مم) — الملف:{' '}
                          <span className="font-mono-num font-bold text-[#1647A4]" dir="ltr">
                            {getOfficialMinuteFileBaseName(currentBundle)}.pdf
                          </span>
                          {' '}— بتاريخ:{' '}
                          <span className="font-mono-num font-bold text-[#172640]">
                            {toArabicNumerals(currentBundle.minute.date) || '-'}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Row: All Original Action Buttons Preserved with Reference Styling */}
                  <div className="flex flex-wrap items-center justify-center sm:justify-between gap-2 pt-1 border-t border-[#EDF2F9]">
                    {currentBundle.minute.status === 'saved' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setActiveTab('approved_list')}
                          className="h-[34px] px-3.5 text-[11.5px] font-bold text-[#172640] bg-[#EEF3FA] hover:bg-[#DCEBFA]/85 border border-[#CBD8EA] rounded-[9px] flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                        >
                          <ArrowRight className="w-3.5 h-3.5 text-[#172640]" />
                          العودة إلى المحاضر المعتمدة
                        </button>
                        {isAuthorizedAdmin && (
                          <button
                            type="button"
                            disabled={duplicatingId === currentBundle.minute.id}
                            onClick={() => handleDuplicateMinute(currentBundle.minute.id)}
                            className="h-[34px] px-3.5 text-[11.5px] font-bold text-[#0E6F53] bg-gradient-to-b from-[#EBF9F4] to-[#D7F3E9] hover:from-[#D7F3E9] hover:to-[#C2ECDD] border border-[#9FE0CB] rounded-[9px] flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shadow-2xs whitespace-nowrap"
                            title="تكرار ونسخ المحضر وإعطاؤه رقم المحضر الجديد التالي تلقائياً"
                          >
                            <Copy className="w-3.5 h-3.5 text-[#13A87B]" />
                            {duplicatingId === currentBundle.minute.id ? 'جاري النسخ...' : 'تكرار ونسخ المحضر'}
                          </button>
                        )}
                        {isAuthorizedAdmin ? (
                          <button
                            type="button"
                            onClick={() => {
                              setReadOnlyMode(false);
                              setActiveTab('editor');
                            }}
                            className="h-[34px] px-3.5 text-[11.5px] font-bold text-[#1647A4] bg-gradient-to-b from-[#EBF3FF] to-[#DCEBFA] hover:from-[#DCEBFA] hover:to-[#C8DDF6] border border-[#B6C9E2] rounded-[9px] flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                          >
                            <Users className="w-3.5 h-3.5 text-[#1647A4]" />
                            تحرير المحضر (للمدير المخوّل)
                          </button>
                        ) : (
                          <span className="h-[34px] px-3 text-[11.5px] font-bold text-amber-900 bg-amber-50 border border-amber-200 rounded-[9px] flex items-center gap-1.5 whitespace-nowrap">
                            <Lock className="w-3.5 h-3.5 text-amber-700" />
                            محضر معتمد — قابل للمعاينة فقط
                          </span>
                        )}
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveTab('editor')}
                        className="h-[34px] px-3.5 text-[11.5px] font-bold text-[#172640] bg-[#EEF3FA] hover:bg-[#DCEBFA]/85 border border-[#CBD8EA] rounded-[9px] flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                      >
                        <ArrowRight className="w-3.5 h-3.5 text-[#172640]" />
                        العودة إلى تحرير المحضر
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        void triggerOfficialMinutePrint(currentBundle);
                      }}
                      className="h-[34px] px-4 text-[11.5px] font-bold text-white bg-gradient-to-b from-[#1E56B8] to-[#0F2F6B] hover:from-[#18489E] hover:to-[#0B2352] border border-[#143B82] rounded-[9px] flex items-center gap-1.5 transition-all cursor-pointer shadow-xs whitespace-nowrap"
                    >
                      <Printer className="w-3.5 h-3.5 text-[#E5CFA0]" />
                      طباعة المحضر
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await exportMinuteToPdf(currentBundle);
                          showToast(
                            'success',
                            `تم تصدير ملف PDF للمحضر رقم (${formatMinuteNumber(currentBundle.minute.minuteNumber)}) بالاسم (${getOfficialMinuteFileBaseName(currentBundle)}.pdf) بنجاح.`
                          );
                        } catch (err) {
                          showToast('error', err instanceof Error ? err.message : 'تعذر تصدير ملف PDF.');
                        }
                      }}
                      className="h-[34px] px-4 text-[11.5px] font-bold text-[#0B5D44] bg-gradient-to-b from-[#CCF5E7] to-[#B0EBD7] hover:from-[#BCEFDE] hover:to-[#9CE2CA] border border-[#84D6BC] rounded-[9px] flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                    >
                      <FileDown className="w-3.5 h-3.5 text-[#0D6E52]" />
                      تصدير PDF
                    </button>

                    {isAuthorizedAdmin && (
                      <button
                        type="button"
                        onClick={async () => {
                          await exportMinuteToDocx(currentBundle);
                          showToast('success', 'تم تصدير ملف Word (DOCX) بنجاح.');
                        }}
                        className="h-[34px] px-4 text-[11.5px] font-bold text-[#1647A4] bg-gradient-to-b from-[#E8F0FE] to-[#D4E3FC] hover:from-[#D8E6FD] hover:to-[#C0D6FA] border border-[#B6C9E2] rounded-[9px] flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                      >
                        <FileDown className="w-3.5 h-3.5 text-[#1647A4]" />
                        تصدير Word (DOCX)
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Layer 07: Centered Official Minutes Document on Executive Leather Blotter */}
              <div className="relative z-10 mt-5 sm:mt-6 px-3 sm:px-6">
                <div className="relative max-w-[735px] w-full mx-auto">
                  {/* Executive Navy Leather Desk Blotter Frame (Backing Pad with Gold Perimeter Accent) */}
                  <div
                    aria-hidden="true"
                    className="no-print absolute -inset-2.5 sm:-inset-4 rounded-xl sm:rounded-2xl pointer-events-none select-none z-0"
                    style={{
                      background: 'linear-gradient(180deg, #132442 0%, #0D192F 100%)',
                      boxShadow:
                        '0 30px 60px -12px rgba(0, 0, 0, 0.75), 0 10px 24px -6px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.12)',
                      border: '1px solid rgba(199, 166, 107, 0.35)',
                    }}
                  >
                    {/* Interior perimeter stitching line */}
                    <div className="absolute inset-1.5 rounded-lg sm:rounded-xl border border-dashed border-[#C7A66B]/25 pointer-events-none" />
                  </div>

                  {/* The Official Document with Realistic Physical Paper Elevation */}
                  <div className="relative z-10 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.55),0_6px_20px_-4px_rgba(0,0,0,0.35)] rounded-[3px] overflow-hidden">
                    <OfficialMinutePrintView bundle={currentBundle} />
                  </div>
                </div>
              </div>
            </div>
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
              }, 100);
            }}
            onExportPdf={async () => {
              try {
                await exportMinuteToPdf(currentBundle);
                showToast(
                  'success',
                  `تم تصدير ملف PDF للمحضر رقم (${formatMinuteNumber(currentBundle.minute.minuteNumber)}) بالاسم (${getOfficialMinuteFileBaseName(currentBundle)}.pdf) بنجاح.`
                );
              } catch (err) {
                showToast('error', err instanceof Error ? err.message : 'تعذر تصدير ملف PDF.');
              }
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
        <div
          onClick={() => setConfirmModal(null)}
          className="no-print fixed inset-0 z-50 bg-[#101F3D]/70 backdrop-blur-[3px] flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="bg-amber-50/95 border-b border-amber-200 px-6 py-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                </div>
                <div className="space-y-1">
                  <span className="inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-md border bg-white border-amber-300 text-amber-800">
                    طلب تأكيد وموافقة على العملية
                  </span>
                  <h3 className="text-sm sm:text-base font-extrabold text-[#101F3D] leading-snug">
                    {confirmModal.title}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-black/5 rounded-lg transition-colors shrink-0"
                title="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3.5 rounded-xl border bg-amber-50/40 border-amber-200 text-xs font-bold text-amber-950 leading-relaxed">
                {confirmModal.message}
              </div>

              <div className="bg-[#F4F7FC] border border-slate-200/90 rounded-xl p-4 space-y-2">
                <div className="text-xs font-bold text-[#101F3D] border-b border-slate-200 pb-2">
                  شرح وتفاصيل الإجراء قبل الموافقة:
                </div>
                <ul className="space-y-1.5 text-xs text-slate-700 leading-relaxed list-disc list-inside">
                  {confirmModal.title.includes('أرشفة') ? (
                    <>
                      <li>سيتم نقل المحضر إلى تبويب «محاضر الاجتماعات المؤرشفة» دون فقدان أي بيانات.</li>
                      <li>تظل جميع الجداول والتوقيعات محفوظة ويمكن استعادتها أو طباعتها في أي وقت.</li>
                    </>
                  ) : confirmModal.title.includes('استعادة') ? (
                    <>
                      <li>سيتم إرجاع المحضر بكامل بياناته وتوقيعاته إلى تبويب «المحاضر المعتمدة».</li>
                      <li>يحتفظ المحضر برقمه التسلسلي الأصلي دون إنشاء نسخة مكررة.</li>
                    </>
                  ) : confirmModal.title.includes('حذف') ? (
                    <>
                      <li>سيتم مسح المحضر وجداوله الفرعية نهائياً من قاعدة البيانات.</li>
                      <li>سيصبح رقم المحضر متاحاً للاستخدام مرة أخرى ضمن نفس السنة.</li>
                    </>
                  ) : (
                    <>
                      <li>لديك تغييرات حالية في نموذج المحضر لم يتم حفظها في قاعدة البيانات بعد.</li>
                      <li>الموافقة على هذا الإجراء ستؤدي إلى إهمال التعديلات غير المحفوظة.</li>
                    </>
                  )}
                </ul>
              </div>
            </div>

            <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                تراجع وإلغاء
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-l from-[#1746B8] to-[#101F3D] hover:from-[#123896] hover:to-[#0C1830] rounded-xl cursor-pointer"
              >
                {confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Executive Institutional Footer (Hidden in Print) */}
      <footer className="no-print bg-[#101F3D] text-white border-t-2 border-[#C7A66B]/50 py-4 px-6 mt-auto">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-[#C7A66B]" />
            <span className="font-bold text-white">
              ساعـد (SAAED) — نظام إدارة محاضر الاجتماعات والأرشفة المؤسسية
            </span>
          </div>
          <span className="text-slate-300 font-medium">
            جميع البيانات مرتبطة بقاعدة البيانات الفعلية ومحفوظة بأمان — SAAED Executive Meeting Intelligence
          </span>
        </div>
      </footer>
    </div>
  );
}
