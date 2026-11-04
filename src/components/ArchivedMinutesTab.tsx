import React, { useState } from 'react';
import {
  ArchiveRestore,
  Eye,
  Printer,
  FileDown,
  Search,
  ArrowUpDown,
  RotateCcw,
  Archive,
  FileText,
} from 'lucide-react';
import { MinuteRecord } from '../types/minutes';
import {
  formatDateTimeArabicNumerals,
  toArabicNumerals,
  formatMinuteNumber,
} from '../utils/numerals';

interface ArchivedMinutesTabProps {
  minutes: MinuteRecord[];
  loading: boolean;
  canRestore: boolean;
  onViewMinute: (minuteId: string) => void;
  onPreviewMinute: (minuteId: string) => void;
  onPrintMinute: (minuteId: string) => void;
  onExportPdf: (minuteId: string) => void;
  onExportWord: (minuteId: string) => void;
  onRestoreMinute: (minuteId: string) => void;
}

export const ArchivedMinutesTab: React.FC<ArchivedMinutesTabProps> = ({
  minutes,
  loading,
  canRestore,
  onViewMinute,
  onPreviewMinute,
  onPrintMinute,
  onExportPdf,
  onExportWord,
  onRestoreMinute,
}) => {
  // 9 Search & Filter states
  const [searchNumber, setSearchNumber] = useState('');
  const [searchYear, setSearchYear] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [searchChairOrSec, setSearchChairOrSec] = useState('');
  const [searchParticipant, setSearchParticipant] = useState('');
  const [searchKeywords, setSearchKeywords] = useState('');
  const [filterYearDropdown, setFilterYearDropdown] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortField, setSortField] = useState<'minuteNumber' | 'date' | 'archivedAt'>('minuteNumber');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const archivedMinutes = minutes.filter((m) => m.status === 'archived');
  const availableYears = Array.from(new Set(archivedMinutes.map((m) => m.year))).sort(
    (a, b) => b - a
  );

  const resetFilters = () => {
    setSearchNumber('');
    setSearchYear('');
    setSearchDate('');
    setSearchChairOrSec('');
    setSearchParticipant('');
    setSearchKeywords('');
    setFilterYearDropdown('all');
    setDateFrom('');
    setDateTo('');
    setSortField('minuteNumber');
    setSortOrder('desc');
  };

  const filtered = archivedMinutes
    .filter((m) => {
      // 1. Search by minute number
      if (searchNumber.trim()) {
        const cleanSearch = toArabicNumerals(searchNumber).trim();
        const matchesFormatted = formatMinuteNumber(m.minuteNumber) === cleanSearch;
        const matchesRaw = String(m.minuteNumber) === cleanSearch;
        const matchesNumeric = Number(m.minuteNumber) === Number(cleanSearch);
        if (!matchesFormatted && !matchesRaw && !matchesNumeric) {
          return false;
        }
      }
      // 2. Search by year input
      if (searchYear.trim() && !String(m.year).includes(toArabicNumerals(searchYear).trim())) {
        return false;
      }
      // 3. Search by exact meeting date
      if (searchDate && m.date !== searchDate) {
        return false;
      }
      // 4. Search by Chairman or Secretary name
      if (searchChairOrSec.trim()) {
        const q = toArabicNumerals(searchChairOrSec).toLowerCase();
        const inChair = m.chairmanName.toLowerCase().includes(q);
        const inSec = m.secretaryName.toLowerCase().includes(q);
        if (!inChair && !inSec) return false;
      }
      // 5. Search by Participant name (indexed inside searchText)
      if (searchParticipant.trim()) {
        const q = toArabicNumerals(searchParticipant).toLowerCase();
        if (!m.searchText.includes(q)) return false;
      }
      // 6. Search by Topic or Recommendation keywords (indexed inside searchText & mainSubject)
      if (searchKeywords.trim()) {
        const q = toArabicNumerals(searchKeywords).toLowerCase();
        if (!m.searchText.includes(q) && !m.mainSubject.toLowerCase().includes(q)) {
          return false;
        }
      }
      // 7. Filter by Year dropdown
      if (filterYearDropdown !== 'all' && String(m.year) !== filterYearDropdown) {
        return false;
      }
      // 8. Filter by Date range
      if (dateFrom && m.date < dateFrom) {
        return false;
      }
      if (dateTo && m.date > dateTo) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      // 9. Sort ascending or descending
      let cmp = 0;
      if (sortField === 'minuteNumber') {
        cmp = a.year !== b.year ? a.year - b.year : a.minuteNumber - b.minuteNumber;
      } else if (sortField === 'date') {
        cmp = (a.date || '').localeCompare(b.date || '');
      } else {
        cmp = (a.archivedAt || '').localeCompare(b.archivedAt || '');
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });

  const formatDate = (iso?: string) => formatDateTimeArabicNumerals(iso);

  return (
    <div className="space-y-6">
      {/* Search & Filter Panel */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">محاضر الاجتماعات المؤرشفة</h2>
            <p className="text-xs text-slate-500 mt-1">
              الأرشيف الرقمي الدائم للمحاضر مع محرك بحث متقدم وتصفية شاملة واستعادة فورية بكامل البيانات الأصلية
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              الترتيب: {sortOrder === 'asc' ? 'تصاعدي' : 'تنازلي'}
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              إعادة تعيين الفلاتر
            </button>
          </div>
        </div>

        {/* 9 Search & Filter Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              1. البحث برقم المحضر
            </label>
            <input
              type="text"
              inputMode="numeric"
              lang="en-GB"
              value={searchNumber}
              onChange={(e) => setSearchNumber(toArabicNumerals(e.target.value))}
              placeholder="مثال: 01"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono-num focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              2. البحث بسنة الاجتماع
            </label>
            <input
              type="number"
              lang="en-GB"
              value={searchYear}
              onChange={(e) => setSearchYear(toArabicNumerals(e.target.value))}
              placeholder="مثال: 2026"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono-num focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              3. البحث بتاريخ الاجتماع
            </label>
            <input
              type="date"
              lang="en-GB"
              value={searchDate}
              onChange={(e) => setSearchDate(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono-num focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              4. البحث برئيس الاجتماع أو المقرر
            </label>
            <input
              type="text"
              value={searchChairOrSec}
              onChange={(e) => setSearchChairOrSec(e.target.value)}
              placeholder="اسم الرئيس أو المقرر..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              5. البحث باسم أحد المشاركين
            </label>
            <input
              type="text"
              value={searchParticipant}
              onChange={(e) => setSearchParticipant(e.target.value)}
              placeholder="اسم المشارك في الحضور..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              6. البحث بكلمات من الموضوعات أو التوصيات
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchKeywords}
                onChange={(e) => setSearchKeywords(e.target.value)}
                placeholder="كلمة مفتاحية في البنود أو القرارات..."
                className="w-full pr-8 pl-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              7. التصفية حسب السنة
            </label>
            <select
              value={filterYearDropdown}
              onChange={(e) => setFilterYearDropdown(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-700"
            >
              <option value="all">جميع السنوات</option>
              {availableYears.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              9. معيار الترتيب
            </label>
            <select
              value={sortField}
              onChange={(e) =>
                setSortField(e.target.value as 'minuteNumber' | 'date' | 'archivedAt')
              }
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-700"
            >
              <option value="minuteNumber">رقم المحضر والسنة</option>
              <option value="date">تاريخ الاجتماع</option>
              <option value="archivedAt">تاريخ الأرشفة</option>
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                8. التصفية حسب الفترة الزمنية (من تاريخ)
              </label>
              <input
                type="date"
                lang="en-GB"
                value={dateFrom}
                onChange={(e) => setDateFrom(toArabicNumerals(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono-num focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                إلى تاريخ
              </label>
              <input
                type="date"
                lang="en-GB"
                value={dateTo}
                onChange={(e) => setDateTo(toArabicNumerals(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono-num focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Archived Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
                <th className="py-3.5 px-4 whitespace-nowrap">رقم المحضر</th>
                <th className="py-3.5 px-4 whitespace-nowrap">سنة الاجتماع</th>
                <th className="py-3.5 px-4 whitespace-nowrap">تاريخ الاجتماع</th>
                <th className="py-3.5 px-4">مكان الاجتماع</th>
                <th className="py-3.5 px-4">رئيس الاجتماع</th>
                <th className="py-3.5 px-4">مقرر الاجتماع</th>
                <th className="py-3.5 px-4 whitespace-nowrap">تاريخ الأرشفة</th>
                <th className="py-3.5 px-4 whitespace-nowrap">المستخدم الذي أرشف المحضر</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">الإجراءات المتاحة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    جاري تحميل الأرشيف من قاعدة البيانات...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center">
                    <Archive className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700">
                      لا توجد محاضر مؤرشفة مطابقة لمعايير البحث والتصفية
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      جميع المحاضر التي يتم أرشفتها تظهر هنا مع الاحتفاظ بكافة جداولها وتوقيعاتها
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 font-mono-num">
                      #{formatMinuteNumber(m.minuteNumber)}
                    </td>
                    <td className="py-3 px-4 font-mono-num text-slate-700">{toArabicNumerals(m.year)}</td>
                    <td className="py-3 px-4 font-mono-num text-slate-700">{toArabicNumerals(m.date) || '-'}</td>
                    <td className="py-3 px-4 text-slate-800">{toArabicNumerals(m.location) || '-'}</td>
                    <td className="py-3 px-4 text-slate-800">{toArabicNumerals(m.chairmanName) || '-'}</td>
                    <td className="py-3 px-4 text-slate-800">{toArabicNumerals(m.secretaryName) || '-'}</td>
                    <td className="py-3 px-4 font-mono-num text-slate-600 whitespace-nowrap">
                      {formatDate(m.archivedAt)}
                    </td>
                    <td className="py-3 px-4 text-slate-700">{toArabicNumerals(m.archivedByName) || '-'}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => onViewMinute(m.id)}
                          className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded flex items-center gap-1 whitespace-nowrap shrink-0"
                        >
                          <FileText className="w-3 h-3" />
                          عرض المحضر كاملاً
                        </button>
                        <button
                          type="button"
                          onClick={() => onPreviewMinute(m.id)}
                          className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded flex items-center gap-1 whitespace-nowrap shrink-0"
                        >
                          <Eye className="w-3 h-3" />
                          معاينة
                        </button>
                        <button
                          type="button"
                          onClick={() => onPrintMinute(m.id)}
                          className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded flex items-center gap-1 whitespace-nowrap shrink-0"
                        >
                          <Printer className="w-3 h-3" />
                          طباعة
                        </button>
                        <button
                          type="button"
                          onClick={() => onExportPdf(m.id)}
                          className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded flex items-center gap-1 whitespace-nowrap shrink-0"
                        >
                          <FileDown className="w-3 h-3" />
                          PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => onExportWord(m.id)}
                          className="px-2.5 py-1 text-[11px] font-medium text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded flex items-center gap-1 whitespace-nowrap shrink-0"
                        >
                          <FileDown className="w-3 h-3" />
                          Word
                        </button>
                        {canRestore && (
                          <button
                            type="button"
                            onClick={() => onRestoreMinute(m.id)}
                            className="px-2.5 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded flex items-center gap-1 whitespace-nowrap shrink-0"
                          >
                            <ArchiveRestore className="w-3.5 h-3.5" />
                            استعادة إلى النشطة
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
      </div>
    </div>
  );
};
