import React, { useState } from 'react';
import {
  FileText,
  Edit3,
  Eye,
  Printer,
  FileDown,
  Trash2,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Lock,
  Calendar,
  MapPin,
  User,
  Users,
  ClipboardList,
} from 'lucide-react';
import { MinuteRecord } from '../types/minutes';
import {
  formatDateTimeArabicNumerals,
  toArabicNumerals,
  formatMinuteNumber,
} from '../utils/numerals';

interface ActiveMinutesTabProps {
  minutes: MinuteRecord[];
  loading: boolean;
  canEdit: boolean;
  onCreateNew: () => void;
  onOpenApprovedTab: () => void;
  onViewDetails: (minuteId: string) => void;
  onEditMinute: (minuteId: string) => void;
  onPreviewMinute: (minuteId: string) => void;
  onPrintMinute: (minuteId: string) => void;
  onExportPdf: (minuteId: string) => void;
  onExportWord: (minuteId: string) => void;
  onArchiveMinute: (minuteId: string) => void;
  onDeleteMinute: (minuteId: string) => void;
}

export const ActiveMinutesTab: React.FC<ActiveMinutesTabProps> = ({
  minutes,
  loading,
  canEdit,
  onCreateNew,
  onOpenApprovedTab,
  onViewDetails,
  onEditMinute,
  onPreviewMinute,
  onPrintMinute,
  onExportPdf,
  onExportWord,
  onDeleteMinute,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [yearFilter, setYearFilter] = useState<string>('all');

  // Draft minutes under preparation (Approved minutes are placed in "المحاضر المعتمدة")
  const activeMinutes = minutes.filter((m) => m.status === 'draft');
  const approvedCount = minutes.filter((m) => m.status === 'saved').length;

  const years = Array.from(new Set(activeMinutes.map((m) => m.year))).sort((a, b) => b - a);

  const filtered = activeMinutes
    .filter((m) => {
      if (yearFilter !== 'all' && String(m.year) !== yearFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = toArabicNumerals(searchQuery).toLowerCase();
      return (
        formatMinuteNumber(m.minuteNumber).includes(q) ||
        String(m.minuteNumber).includes(q) ||
        String(m.year).includes(q) ||
        m.location.toLowerCase().includes(q) ||
        m.mainSubject.toLowerCase().includes(q) ||
        m.chairmanName.toLowerCase().includes(q) ||
        m.secretaryName.toLowerCase().includes(q) ||
        m.searchText.includes(q)
      );
    })
    .sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      return b.minuteNumber - a.minuteNumber;
    });

  const formatDateTime = (iso?: string) => formatDateTimeArabicNumerals(iso);

  return (
    <div className="space-y-5">
      {/* Executive Control & Filter Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#101F3D] to-[#1746B8] text-[#C7A66B] flex items-center justify-center shrink-0 shadow-xs">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base sm:text-lg font-extrabold text-[#101F3D] font-display">
                عرض المحاضر وتحريرها (المسودات قيد الإعداد)
              </h2>
              <span className="px-2.5 py-0.5 text-xs font-extrabold bg-[#F4F7FC] text-[#1746B8] border border-blue-200 rounded-md font-mono-num">
                {filtered.length}
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              قائمة مسودات المحاضر قيد الإعداد والتحرير — تنتقل المحاضر فور اعتمادها إلى تبويب «المحاضر المعتمدة»
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 text-[#64748B] absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(toArabicNumerals(e.target.value))}
              placeholder="بحث برقم المحضر، المكان، الرئيس، الموضوع..."
              className="w-full pr-10 pl-3.5 py-2.5 text-xs border border-slate-300 rounded-xl bg-[#F4F7FC]/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1746B8] transition-colors"
            />
          </div>

          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="px-3.5 py-2.5 text-xs font-bold border border-slate-300 rounded-xl bg-white text-[#101F3D] focus:outline-none focus:ring-2 focus:ring-[#1746B8] cursor-pointer"
          >
            <option value="all">جميع السنوات</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>
                سنة {y}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onOpenApprovedTab}
            className="px-4 py-2.5 text-xs font-bold text-[#059669] bg-emerald-50/90 border border-emerald-200 hover:bg-emerald-100 rounded-xl flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4 text-[#059669]" />
            <span>المحاضر المعتمدة ({approvedCount})</span>
          </button>

          {canEdit && (
            <button
              type="button"
              onClick={onCreateNew}
              className="px-4 py-2.5 text-xs font-bold text-white bg-gradient-to-l from-[#1746B8] to-[#101F3D] hover:from-[#123896] hover:to-[#0C1830] rounded-xl shadow-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#C7A66B]" />
              <span>محضر جديد</span>
            </button>
          )}
        </div>
      </div>

      {/* Executive Data Table matching Reference Image */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-gradient-to-l from-[#101F3D] via-[#152F61] to-[#1746B8] text-white text-xs font-bold">
                <th className="py-3.5 px-4 whitespace-nowrap border-l border-white/10">رقم المحضر</th>
                <th className="py-3.5 px-4 whitespace-nowrap border-l border-white/10">السنة</th>
                <th className="py-3.5 px-4 whitespace-nowrap border-l border-white/10">تاريخ الاجتماع</th>
                <th className="py-3.5 px-4 whitespace-nowrap border-l border-white/10">وقت الاجتماع</th>
                <th className="py-3.5 px-4 border-l border-white/10">مكان الاجتماع</th>
                <th className="py-3.5 px-4 border-l border-white/10">رئيس الاجتماع</th>
                <th className="py-3.5 px-4 border-l border-white/10">مقرر الاجتماع</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap border-l border-white/10">
                  عدد المشاركين
                </th>
                <th className="py-3.5 px-4 whitespace-nowrap border-l border-white/10">
                  تاريخ آخر تعديل
                </th>
                <th className="py-3.5 px-4 whitespace-nowrap border-l border-white/10">
                  حالة المحضر
                </th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-14 text-center text-[#64748B] font-medium">
                    جاري تحميل المحاضر من قاعدة البيانات...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-14 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-[#F4F7FC] border border-slate-200 flex items-center justify-center mx-auto mb-3 text-[#1746B8]">
                      <FileText className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-extrabold text-[#101F3D]">
                      لا توجد محاضر نشطة مطابقة للبحث
                    </p>
                    <p className="text-xs text-[#64748B] mt-1 mb-4">
                      يمكنك إنشاء محضر اجتماع جديد للبدء في تدوين الحضور والموضوعات والتوصيات
                    </p>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={onCreateNew}
                        className="px-4 py-2.5 text-xs font-bold text-white bg-gradient-to-l from-[#1746B8] to-[#101F3D] hover:from-[#123896] hover:to-[#0C1830] rounded-xl inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <Plus className="w-4 h-4 text-[#C7A66B]" />
                        <span>إنشاء محضر جديد</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <tr
                    key={m.id}
                    className="hover:bg-[#F4F7FC] transition-colors even:bg-slate-50/40"
                  >
                    <td className="py-3.5 px-4 font-extrabold text-[#101F3D] font-mono-num whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F4F7FC] border border-slate-200/90 text-[#101F3D]">
                        <FileText className="w-3.5 h-3.5 text-[#1746B8] shrink-0" />
                        <span>#{formatMinuteNumber(m.minuteNumber)}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono-num font-bold text-slate-700 whitespace-nowrap">
                      {m.year}
                    </td>
                    <td className="py-3.5 px-4 font-mono-num text-slate-700 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#1746B8] shrink-0" />
                        <span>{m.date || '-'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono-num text-slate-700 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
                        <span>{m.time || '-'}</span>
                      </div>
                    </td>
                    <td
                      className="py-3.5 px-4 text-[#101F3D] font-medium max-w-[190px] truncate"
                      title={m.location}
                    >
                      <div className="inline-flex items-center gap-1.5 max-w-full">
                        <MapPin className="w-3.5 h-3.5 text-[#1746B8] shrink-0" />
                        <span className="truncate">{m.location || '-'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#101F3D] font-medium">
                      <div className="inline-flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-[#1746B8] shrink-0" />
                        <span>{m.chairmanName || '-'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      <div className="inline-flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
                        <span>{m.secretaryName || '-'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono-num font-bold text-[#101F3D]">
                      <span className="inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 text-[#101F3D]">
                        <Users className="w-3.5 h-3.5 text-[#1746B8]" />
                        <span>{m.participantsCount}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                      <div className="font-mono-num font-medium text-[#101F3D]">
                        {formatDateTime(m.updatedAtIso)}
                      </div>
                      {m.updatedByName && (
                        <div className="text-[11px] text-[#64748B]">بواسطة: {m.updatedByName}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {m.status === 'saved' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-[#059669] border border-emerald-200 font-bold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>محفوظ ومعتمد</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-[#1746B8] border border-blue-200 font-bold text-[11px]">
                          <Clock className="w-3.5 h-3.5 text-[#D97706]" />
                          <span>قيد الإعداد (مسودة)</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => onViewDetails(m.id)}
                          className="px-2.5 py-1.5 text-[11px] font-bold text-[#101F3D] bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                          title="عرض التفاصيل"
                        >
                          عرض التفاصيل
                        </button>
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => onEditMinute(m.id)}
                            className="px-2.5 py-1.5 text-[11px] font-bold text-[#1746B8] bg-blue-50 hover:bg-blue-100 border border-blue-200/80 rounded-lg flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                            title="تعديل المحضر الأصلي"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>تعديل</span>
                          </button>
                        ) : (
                          <span className="px-2.5 py-1.5 text-[11px] text-slate-400 flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            <span>للقراءة</span>
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => onPreviewMinute(m.id)}
                          className="px-2.5 py-1.5 text-[11px] font-bold text-[#101F3D] bg-[#F4F7FC] hover:bg-slate-200/70 border border-slate-200 rounded-lg flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                          title="معاينة المحضر"
                        >
                          <Eye className="w-3 h-3 text-[#1746B8]" />
                          <span>معاينة</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onPrintMinute(m.id)}
                          className="px-2.5 py-1.5 text-[11px] font-bold text-[#101F3D] bg-[#F4F7FC] hover:bg-slate-200/70 border border-slate-200 rounded-lg flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                          title="طباعة المحضر"
                        >
                          <Printer className="w-3 h-3 text-[#1746B8]" />
                          <span>طباعة</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onExportPdf(m.id)}
                          className="px-2.5 py-1.5 text-[11px] font-bold text-[#059669] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                          title="تصدير PDF"
                        >
                          <FileDown className="w-3 h-3" />
                          <span>PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onExportWord(m.id)}
                          className="px-2.5 py-1.5 text-[11px] font-bold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                          title="تصدير Word DOCX قابل للتحرير"
                        >
                          <FileDown className="w-3 h-3" />
                          <span>Word</span>
                        </button>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => onDeleteMinute(m.id)}
                            className="px-2.5 py-1.5 text-[11px] font-bold text-[#DC2626] bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                            title="حذف المحضر نهائياً"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>حذف</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Executive Table Summary Footer */}
        <div className="bg-[#F4F7FC] border-t border-slate-200/90 px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[#64748B]">
          <div className="font-semibold text-[#101F3D]">
            عرض <span className="font-mono-num font-bold text-[#1746B8]">{filtered.length}</span> من أصل{' '}
            <span className="font-mono-num font-bold">{activeMinutes.length}</span> مسودة محضر قيد الإعداد
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-[11px] font-bold text-[#101F3D]">
              التسلسل السنوي مفعّل تلقائياً
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
