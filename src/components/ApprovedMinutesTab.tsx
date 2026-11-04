import React, { useState } from 'react';
import {
  FileCheck2,
  Edit3,
  Eye,
  Printer,
  FileDown,
  Archive,
  Trash2,
  Search,
  CheckCircle2,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { MinuteRecord } from '../types/minutes';
import {
  formatDateTimeArabicNumerals,
  toArabicNumerals,
  formatMinuteNumber,
} from '../utils/numerals';

interface ApprovedMinutesTabProps {
  minutes: MinuteRecord[];
  loading: boolean;
  isAuthorizedAdmin: boolean;
  onEditMinute: (minuteId: string) => void;
  onPreviewMinute: (minuteId: string) => void;
  onPrintMinute: (minuteId: string) => void;
  onExportPdf: (minuteId: string) => void;
  onExportWord: (minuteId: string) => void;
  onArchiveMinute: (minuteId: string) => void;
  onDeleteMinute: (minuteId: string) => void;
}

export const ApprovedMinutesTab: React.FC<ApprovedMinutesTabProps> = ({
  minutes,
  loading,
  isAuthorizedAdmin,
  onEditMinute,
  onPreviewMinute,
  onPrintMinute,
  onExportPdf,
  onExportWord,
  onArchiveMinute,
  onDeleteMinute,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [yearFilter, setYearFilter] = useState<string>('all');

  // All approved minutes (status === 'saved') are placed here
  const approvedMinutes = minutes.filter((m) => m.status === 'saved');

  const years = Array.from(new Set(approvedMinutes.map((m) => m.year))).sort((a, b) => b - a);

  const filtered = approvedMinutes
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
    <div className="space-y-6">
      {/* Header & Search Controls */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-emerald-700" />
            <h2 className="text-lg font-bold text-slate-900">المحاضر المعتمدة</h2>
            <span className="px-2.5 py-0.5 text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-mono-num">
              {approvedMinutes.length}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            سجل جميع المحاضر المعتمدة رسمياً — المحضر المعتمد قابل للمعاينة فقط ويُمنع حذفه أو تحريره أو التعديل عليه إلا من خلال مدير مخوّل (كامل الصلاحيات)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(toArabicNumerals(e.target.value))}
              placeholder="بحث برقم المحضر، المكان، الرئيس، الموضوع..."
              className="w-full pr-9 pl-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
          </div>

          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-700"
          >
            <option value="all">جميع السنوات</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>
                سنة {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Protection & Privilege Notice Banner */}
      <div
        className={`border rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs ${
          isAuthorizedAdmin
            ? 'bg-blue-50/80 border-blue-200 text-blue-950'
            : 'bg-amber-50/80 border-amber-200 text-amber-950'
        }`}
      >
        <div className="flex items-center gap-2.5">
          {isAuthorizedAdmin ? (
            <ShieldCheck className="w-4 h-4 text-blue-800 shrink-0" />
          ) : (
            <Lock className="w-4 h-4 text-amber-800 shrink-0" />
          )}
          <span className="font-semibold">
            {isAuthorizedAdmin
              ? 'صلاحية مدير مخوّل (كامل الصلاحيات) مفعّلة: يمكنك معاينة المحاضر المعتمدة، كما يتاح لك استثنائياً تحريرها أو التعديل عليها أو حذفها.'
              : 'حماية المحاضر المعتمدة مفعّلة: هذه المحاضر معتمدة رسمياً ومتاحة للمعاينة فقط، ويُمنع حذفها أو تحريرها أو التعديل عليها إلا من خلال مدير مخوّل (كامل الصلاحيات).'}
          </span>
        </div>
      </div>

      {/* Approved Minutes Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
                <th className="py-3.5 px-4 whitespace-nowrap">رقم المحضر</th>
                <th className="py-3.5 px-4 whitespace-nowrap">السنة</th>
                <th className="py-3.5 px-4 whitespace-nowrap">تاريخ الاجتماع</th>
                <th className="py-3.5 px-4 whitespace-nowrap">وقت الاجتماع</th>
                <th className="py-3.5 px-4">مكان الاجتماع</th>
                <th className="py-3.5 px-4">رئيس الاجتماع</th>
                <th className="py-3.5 px-4">مقرر الاجتماع</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">عدد المشاركين</th>
                <th className="py-3.5 px-4 whitespace-nowrap">تاريخ الاعتماد / التعديل</th>
                <th className="py-3.5 px-4 whitespace-nowrap">حالة المحضر</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-500">
                    جاري تحميل المحاضر المعتمدة من قاعدة البيانات...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center">
                    <FileCheck2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700">
                      لا توجد محاضر معتمدة حالياً
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      عند حفظ واعتماد أي محضر اجتماع سينتقل تلقائياً إلى هذا التبويب لحفظه وحمايته من التعديل أو الحذف غير المخوّل
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 font-mono-num">
                      #{formatMinuteNumber(m.minuteNumber)}
                    </td>
                    <td className="py-3 px-4 font-mono-num text-slate-700">{m.year}</td>
                    <td className="py-3 px-4 font-mono-num text-slate-700">{m.date || '-'}</td>
                    <td className="py-3 px-4 font-mono-num text-slate-700">{m.time || '-'}</td>
                    <td
                      className="py-3 px-4 text-slate-800 max-w-[180px] truncate"
                      title={m.location}
                    >
                      {m.location || '-'}
                    </td>
                    <td className="py-3 px-4 text-slate-800">{m.chairmanName || '-'}</td>
                    <td className="py-3 px-4 text-slate-800">{m.secretaryName || '-'}</td>
                    <td className="py-3 px-4 text-center font-mono-num font-semibold text-slate-800">
                      {m.participantsCount}
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      <div className="font-mono-num">{formatDateTime(m.updatedAtIso)}</div>
                      {m.updatedByName && (
                        <div className="text-[11px] text-slate-400">بواسطة: {m.updatedByName}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        معتمد رسمياً
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {/* Primary Action: Preview is always available */}
                        <button
                          type="button"
                          onClick={() => onPreviewMinute(m.id)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-white bg-blue-800 hover:bg-blue-900 rounded flex items-center gap-1 whitespace-nowrap shrink-0"
                          title="معاينة المحضر المعتمد"
                        >
                          <Eye className="w-3 h-3" />
                          معاينة المحضر
                        </button>

                        <button
                          type="button"
                          onClick={() => onPrintMinute(m.id)}
                          className="px-2 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded flex items-center gap-1 whitespace-nowrap shrink-0"
                          title="طباعة المحضر"
                        >
                          <Printer className="w-3 h-3" />
                          طباعة
                        </button>

                        <button
                          type="button"
                          onClick={() => onExportPdf(m.id)}
                          className="px-2 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded flex items-center gap-1 whitespace-nowrap shrink-0"
                          title="تصدير PDF"
                        >
                          <FileDown className="w-3 h-3" />
                          PDF
                        </button>

                        <button
                          type="button"
                          onClick={() => onExportWord(m.id)}
                          className="px-2 py-1 text-[11px] font-medium text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded flex items-center gap-1 whitespace-nowrap shrink-0"
                          title="تصدير Word DOCX"
                        >
                          <FileDown className="w-3 h-3" />
                          Word
                        </button>

                        {/* Strictly restricted to Authorized Admin (مدير مخول - كامل الصلاحيات) */}
                        {isAuthorizedAdmin ? (
                          <>
                            <button
                              type="button"
                              onClick={() => onEditMinute(m.id)}
                              className="px-2 py-1 text-[11px] font-medium text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded flex items-center gap-1 whitespace-nowrap shrink-0"
                              title="تحرير وتعديل المحضر المعتمد (خاص بالمدير المخوّل)"
                            >
                              <Edit3 className="w-3 h-3" />
                              تحرير / تعديل
                            </button>
                            <button
                              type="button"
                              onClick={() => onArchiveMinute(m.id)}
                              className="px-2 py-1 text-[11px] font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded flex items-center gap-1 whitespace-nowrap shrink-0"
                              title="أرشفة المحضر المعتمد (خاص بالمدير المخوّل)"
                            >
                              <Archive className="w-3 h-3" />
                              أرشفة
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteMinute(m.id)}
                              className="px-2 py-1 text-[11px] font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded flex items-center gap-1 whitespace-nowrap shrink-0"
                              title="حذف المحضر المعتمد نهائياً (خاص بالمدير المخوّل)"
                            >
                              <Trash2 className="w-3 h-3" />
                              حذف
                            </button>
                          </>
                        ) : (
                          <span
                            className="px-2 py-1 text-[11px] text-slate-500 bg-slate-100 border border-slate-200 rounded flex items-center gap-1 whitespace-nowrap shrink-0"
                            title="يمنع التعديل أو الحذف إلا من خلال مدير مخوّل (كامل الصلاحيات)"
                          >
                            <Lock className="w-3 h-3 text-slate-400" />
                            للمعاينة فقط
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
