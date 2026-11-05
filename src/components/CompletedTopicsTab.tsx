import React, { useEffect, useState, useMemo } from 'react';
import {
  CheckCircle2,
  Calendar,
  Search,
  Eye,
  FileText,
  UserCheck,
  ArrowUpDown,
  Layers,
} from 'lucide-react';
import { MinuteRecord } from '../types/minutes';
import { loadFullMinute } from '../services/minutesService';
import { toArabicNumerals, formatMinuteNumber } from '../utils/numerals';

export interface CompletedTopicItem {
  id: string;
  minuteId: string;
  minuteNumber: number;
  year: number;
  minuteDate: string;
  minuteTime: string;
  minuteLocation: string;
  minuteMainSubject: string;
  chairmanName: string;
  secretaryName: string;
  minuteStatus: string;
  sectionTitle: string;
  subject: string;
  recommendations: string;
  responsiblePerson: string;
  executionDate: string;
  status: string;
  sourceMinuteLabel?: string;
}

interface CompletedTopicsTabProps {
  minutes: MinuteRecord[];
  onPreviewMinute: (minuteId: string) => void;
}

export function isCompletedStatusValue(status?: string): boolean {
  if (!status) return false;
  const normalized = status.trim().toLowerCase();
  return (
    normalized.includes('مكتمل') ||
    normalized.includes('تم التنفيذ') ||
    normalized.includes('تم الإنجاز') ||
    normalized.includes('تم الانجاز') ||
    normalized.includes('منجز') ||
    normalized.includes('انتهى') ||
    normalized === 'تم' ||
    normalized === 'completed' ||
    normalized === 'done'
  );
}

export const CompletedTopicsTab: React.FC<CompletedTopicsTabProps> = ({
  minutes,
  onPreviewMinute,
}) => {
  const [topics, setTopics] = useState<CompletedTopicItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('all');
  const [dateSortField, setDateSortField] = useState<'executionDate' | 'minuteDate'>('executionDate');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  useEffect(() => {
    let isMounted = true;

    const fetchAllCompletedTopics = async () => {
      if (minutes.length === 0) {
        if (isMounted) {
          setTopics([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const bundles = await Promise.all(
          minutes.map(async (m) => {
            try {
              return await loadFullMinute(m.id);
            } catch {
              return null;
            }
          })
        );

        if (!isMounted) return;

        const collected: CompletedTopicItem[] = [];

        bundles.forEach((bundle) => {
          if (!bundle) return;
          const { minute, outcomes, ongoingTopics, newTopics, customTables } = bundle;

          // 1. Section 3: Outcomes
          outcomes.forEach((o, idx) => {
            if (isCompletedStatusValue(o.status)) {
              collected.push({
                id: `${minute.id}_out_${o.id || idx}`,
                minuteId: minute.id,
                minuteNumber: minute.minuteNumber,
                year: minute.year,
                minuteDate: minute.date || '',
                minuteTime: minute.time || '',
                minuteLocation: minute.location || '',
                minuteMainSubject: minute.mainSubject || '',
                chairmanName: minute.chairmanName || '',
                secretaryName: minute.secretaryName || '',
                minuteStatus: minute.status,
                sectionTitle: 'ثالثاً: مدخلات ونتائج الاجتماع',
                subject: o.subject || '',
                recommendations: o.recommendations || '',
                responsiblePerson: o.responsiblePerson || '',
                executionDate: o.executionDate || minute.date || '',
                status: o.status || 'مكتمل',
              });
            }
          });

          // 2. Section 4: Ongoing Topics
          if (bundle.showOngoingTable !== false) {
            ongoingTopics.forEach((t, idx) => {
              if (isCompletedStatusValue(t.topicStatus)) {
                collected.push({
                  id: `${minute.id}_ong_${t.id || idx}`,
                  minuteId: minute.id,
                  minuteNumber: minute.minuteNumber,
                  year: minute.year,
                  minuteDate: minute.date || '',
                  minuteTime: minute.time || '',
                  minuteLocation: minute.location || '',
                  minuteMainSubject: minute.mainSubject || '',
                  chairmanName: minute.chairmanName || '',
                  secretaryName: minute.secretaryName || '',
                  minuteStatus: minute.status,
                  sectionTitle: 'رابعاً: المواضيع المستمرة',
                  subject: t.subject || '',
                  recommendations: t.recommendationOrAction || '',
                  responsiblePerson: t.followUpPerson || '',
                  executionDate: t.followUpDate || minute.date || '',
                  status: t.topicStatus || 'مكتمل',
                  sourceMinuteLabel: t.sourceMinuteLabel || '',
                });
              }
            });
          }

          // 3. Section 5: New Topics
          if (bundle.showNewTopicsTable !== false) {
            newTopics.forEach((n, idx) => {
              if (isCompletedStatusValue(n.status)) {
                collected.push({
                  id: `${minute.id}_new_${n.id || idx}`,
                  minuteId: minute.id,
                  minuteNumber: minute.minuteNumber,
                  year: minute.year,
                  minuteDate: minute.date || '',
                  minuteTime: minute.time || '',
                  minuteLocation: minute.location || '',
                  minuteMainSubject: minute.mainSubject || '',
                  chairmanName: minute.chairmanName || '',
                  secretaryName: minute.secretaryName || '',
                  minuteStatus: minute.status,
                  sectionTitle: 'خامساً: المواضيع الجديدة',
                  subject: n.subject || '',
                  recommendations: n.recommendationsAndDecisions || '',
                  responsiblePerson: n.responsiblePerson || '',
                  executionDate: n.executionDate || minute.date || '',
                  status: n.status || 'مكتمل',
                });
              }
            });
          }

          // 4. Custom Added Tables
          (customTables ?? []).forEach((ct) => {
            ct.rows.forEach((r, idx) => {
              if (isCompletedStatusValue(r.status)) {
                collected.push({
                  id: `${minute.id}_ct_${ct.id}_${r.id || idx}`,
                  minuteId: minute.id,
                  minuteNumber: minute.minuteNumber,
                  year: minute.year,
                  minuteDate: minute.date || '',
                  minuteTime: minute.time || '',
                  minuteLocation: minute.location || '',
                  minuteMainSubject: minute.mainSubject || '',
                  chairmanName: minute.chairmanName || '',
                  secretaryName: minute.secretaryName || '',
                  minuteStatus: minute.status,
                  sectionTitle: ct.title || 'جدول إضافي',
                  subject: r.subject || '',
                  recommendations: r.recommendations || '',
                  responsiblePerson: r.responsiblePerson || '',
                  executionDate: r.executionDate || minute.date || '',
                  status: r.status || 'مكتمل',
                });
              }
            });
          });
        });

        setTopics(collected);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchAllCompletedTopics();

    return () => {
      isMounted = false;
    };
  }, [minutes]);

  // Extract distinct dates for filtering
  const availableDates = useMemo(() => {
    const set = new Set<string>();
    topics.forEach((t) => {
      const d = (dateSortField === 'executionDate' ? t.executionDate : t.minuteDate) || t.minuteDate;
      if (d) set.add(d);
    });
    return Array.from(set).sort((a, b) => (sortDirection === 'desc' ? b.localeCompare(a) : a.localeCompare(b)));
  }, [topics, dateSortField, sortDirection]);

  // Filter and sort topics by date
  const filteredAndSorted = useMemo(() => {
    const q = toArabicNumerals(searchQuery).trim().toLowerCase();

    return topics
      .filter((t) => {
        const activeDate =
          (dateSortField === 'executionDate' ? t.executionDate : t.minuteDate) || t.minuteDate || 'غير محدد';
        if (selectedDateFilter !== 'all' && activeDate !== selectedDateFilter) {
          return false;
        }
        if (!q) return true;
        return (
          t.subject.toLowerCase().includes(q) ||
          t.recommendations.toLowerCase().includes(q) ||
          t.responsiblePerson.toLowerCase().includes(q) ||
          t.status.toLowerCase().includes(q) ||
          t.sectionTitle.toLowerCase().includes(q) ||
          t.minuteLocation.toLowerCase().includes(q) ||
          t.chairmanName.toLowerCase().includes(q) ||
          t.secretaryName.toLowerCase().includes(q) ||
          formatMinuteNumber(t.minuteNumber).includes(q) ||
          String(t.minuteNumber).includes(q) ||
          String(t.year).includes(q) ||
          t.executionDate.includes(q) ||
          t.minuteDate.includes(q)
        );
      })
      .sort((a, b) => {
        const dateA =
          (dateSortField === 'executionDate' ? a.executionDate : a.minuteDate) || a.minuteDate || '';
        const dateB =
          (dateSortField === 'executionDate' ? b.executionDate : b.minuteDate) || b.minuteDate || '';

        if (dateA !== dateB) {
          return sortDirection === 'desc' ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB);
        }
        if (b.year !== a.year) return b.year - a.year;
        return b.minuteNumber - a.minuteNumber;
      });
  }, [topics, searchQuery, selectedDateFilter, dateSortField, sortDirection]);

  // Group sorted topics by date
  const groupedByDate = useMemo(() => {
    const groups: Array<{ dateKey: string; items: CompletedTopicItem[] }> = [];
    const map = new Map<string, CompletedTopicItem[]>();

    filteredAndSorted.forEach((item) => {
      const key =
        (dateSortField === 'executionDate' ? item.executionDate : item.minuteDate) ||
        item.minuteDate ||
        'تاريخ غير محدد';
      if (!map.has(key)) {
        const arr: CompletedTopicItem[] = [];
        map.set(key, arr);
        groups.push({ dateKey: key, items: arr });
      }
      map.get(key)!.push(item);
    });

    return groups;
  }, [filteredAndSorted, dateSortField]);

  return (
    <div className="space-y-5">
      {/* Executive Header & Controls */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#101F3D] to-[#1746B8] text-[#C7A66B] flex items-center justify-center shrink-0 shadow-xs">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base sm:text-lg font-extrabold text-[#101F3D] font-display">
                المواضيع المكتملة
              </h2>
              <span className="px-2.5 py-0.5 text-xs font-extrabold bg-emerald-50 text-[#059669] border border-emerald-200 rounded-md font-mono-num">
                {filteredAndSorted.length}
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              سجل شامل لجميع المواضيع والبنود التي تم الانتهاء من تنفيذها واكتمالها في محاضر الاجتماعات مرتبة حسب التاريخ مع كامل البيانات التفصيلية
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-[#64748B] absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(toArabicNumerals(e.target.value))}
              placeholder="بحث في الموضوع، التوصيات، المسؤول، رقم المحضر..."
              className="w-full pr-10 pl-3.5 py-2.5 text-xs border border-slate-300 rounded-xl bg-[#F4F7FC]/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1746B8]"
            />
          </div>

          {/* Sort Basis Selector */}
          <select
            value={dateSortField}
            onChange={(e) => {
              setDateSortField(e.target.value as 'executionDate' | 'minuteDate');
              setSelectedDateFilter('all');
            }}
            className="px-3.5 py-2.5 text-xs font-bold border border-slate-300 rounded-xl bg-white text-[#101F3D] focus:outline-none focus:ring-2 focus:ring-[#1746B8] cursor-pointer"
            title="أساس الترتيب الزمني"
          >
            <option value="executionDate">الترتيب حسب: تاريخ التنفيذ</option>
            <option value="minuteDate">الترتيب حسب: تاريخ المحضر</option>
          </select>

          {/* Date Filter */}
          <select
            value={selectedDateFilter}
            onChange={(e) => setSelectedDateFilter(e.target.value)}
            className="px-3.5 py-2.5 text-xs font-bold border border-slate-300 rounded-xl bg-white text-[#101F3D] focus:outline-none focus:ring-2 focus:ring-[#1746B8] font-mono-num cursor-pointer"
          >
            <option value="all">جميع التواريخ ({availableDates.length})</option>
            {availableDates.map((d) => (
              <option key={d} value={d}>
                {toArabicNumerals(d)}
              </option>
            ))}
          </select>

          {/* Sort Direction Button */}
          <button
            type="button"
            onClick={() => setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
            className="px-3.5 py-2.5 text-xs font-bold text-[#101F3D] bg-[#F4F7FC] hover:bg-slate-200/80 border border-slate-300 rounded-xl flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            title="تبديل اتجاه الترتيب الزمني"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-[#1746B8]" />
            <span>{sortDirection === 'desc' ? 'من الأحدث إلى الأقدم' : 'من الأقدم إلى الأحدث'}</span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl py-14 text-center text-xs text-[#64748B] font-medium">
          جاري استرجاع وفرز المواضيع المكتملة من جميع المحاضر...
        </div>
      ) : groupedByDate.length === 0 ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl py-14 px-6 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-3 text-[#059669]">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <p className="text-sm font-extrabold text-[#101F3D]">
            لا توجد مواضيع مكتملة مسجلة حالياً
          </p>
          <p className="text-xs text-[#64748B] mt-1 max-w-lg mx-auto leading-relaxed">
            عند تحديد حالة أي موضوع في جداول المحضر إلى «مكتمل» أو «تم التنفيذ» أو «منجز» وحفظ المحضر، سيظهر هنا تلقائياً مرتباً حسب التاريخ مع جميع بياناته التفصيلية.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByDate.map((group) => (
            <div
              key={group.dateKey}
              className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs"
            >
              {/* Date Group Header */}
              <div className="bg-gradient-to-l from-emerald-50/90 via-white to-[#F4F7FC] border-b border-slate-200 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#059669] text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#101F3D]">
                      {dateSortField === 'executionDate' ? 'تاريخ التنفيذ: ' : 'تاريخ الاجتماع: '}
                    </span>
                    <span className="text-sm font-extrabold font-mono-num text-[#059669]" dir="ltr">
                      {toArabicNumerals(group.dateKey)}
                    </span>
                  </div>
                </div>
                <span className="px-3 py-1 text-xs font-bold bg-white text-[#101F3D] border border-emerald-300 rounded-lg font-mono-num shadow-2xs">
                  عدد المواضيع المكتملة في هذا التاريخ: {toArabicNumerals(group.items.length)}
                </span>
              </div>

              {/* Complete Details Table for this Date */}
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-l from-[#101F3D] via-[#152F61] to-[#1746B8] text-white text-xs font-bold">
                      <th className="py-3.5 px-3 text-center w-12 border-l border-white/10">م</th>
                      <th className="py-3.5 px-4 w-1/5 border-l border-white/10">الموضوع المكتمل</th>
                      <th className="py-3.5 px-4 w-1/4 border-l border-white/10">
                        التوصيات والقرارات المتخذة
                      </th>
                      <th className="py-3.5 px-4 whitespace-nowrap border-l border-white/10">
                        مسؤولية التنفيذ
                      </th>
                      <th className="py-3.5 px-3 text-center whitespace-nowrap border-l border-white/10">
                        تاريخ التنفيذ
                      </th>
                      <th className="py-3.5 px-3 text-center whitespace-nowrap border-l border-white/10">
                        الحالة
                      </th>
                      <th className="py-3.5 px-4 border-l border-white/10">بيانات المحضر المرتبط</th>
                      <th className="py-3.5 px-3 text-center whitespace-nowrap">الإجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80 text-xs">
                    {group.items.map((item, idx) => (
                      <tr
                        key={item.id}
                        className="hover:bg-[#F4F7FC] transition-colors even:bg-slate-50/40"
                      >
                        <td className="py-3.5 px-3 text-center font-mono-num font-bold text-[#101F3D] align-top">
                          {toArabicNumerals(idx + 1)}
                        </td>

                        {/* Subject + Section Info */}
                        <td className="py-3.5 px-4 align-top space-y-1.5">
                          <div className="font-bold text-[#101F3D] whitespace-pre-wrap break-words leading-relaxed">
                            {toArabicNumerals(item.subject) || '-'}
                          </div>
                          <div className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1746B8] bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-md">
                            <Layers className="w-3 h-3 text-[#1746B8] shrink-0" />
                            <span>{toArabicNumerals(item.sectionTitle)}</span>
                          </div>
                          {item.sourceMinuteLabel && (
                            <div className="text-[11px] text-[#64748B]">
                              مرحّل من: {toArabicNumerals(item.sourceMinuteLabel)}
                            </div>
                          )}
                        </td>

                        {/* Recommendations */}
                        <td className="py-3.5 px-4 align-top text-slate-800 whitespace-pre-wrap break-words leading-relaxed">
                          {toArabicNumerals(item.recommendations) || '-'}
                        </td>

                        {/* Responsible Person */}
                        <td className="py-3.5 px-4 align-top font-bold text-[#101F3D]">
                          <div className="flex items-center gap-1.5">
                            <UserCheck className="w-3.5 h-3.5 text-[#1746B8] shrink-0" />
                            <span>{toArabicNumerals(item.responsiblePerson) || '-'}</span>
                          </div>
                        </td>

                        {/* Execution Date */}
                        <td className="py-3.5 px-3 text-center font-mono-num font-bold text-[#101F3D] align-top whitespace-nowrap">
                          {toArabicNumerals(item.executionDate) || '-'}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3.5 px-3 text-center align-top whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-[#059669] border border-emerald-200 font-bold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#059669] shrink-0" />
                            <span>{toArabicNumerals(item.status)}</span>
                          </span>
                        </td>

                        {/* Related Minute Metadata (Location, Chairman, and Secretary strictly excluded per user request) */}
                        <td className="py-3.5 px-4 align-top space-y-1 text-[11px] text-slate-700">
                          <div className="flex items-center gap-1.5 font-bold text-[#101F3D]">
                            <FileText className="w-3.5 h-3.5 text-[#1746B8] shrink-0" />
                            <span>
                              محضر رقم (#{formatMinuteNumber(item.minuteNumber)}) لسنة{' '}
                              {toArabicNumerals(item.year)}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                item.minuteStatus === 'saved'
                                  ? 'bg-emerald-50 text-[#059669] border-emerald-200'
                                  : 'bg-amber-50 text-[#D97706] border-amber-200'
                              }`}
                            >
                              {item.minuteStatus === 'saved' ? 'معتمد' : 'مسودة'}
                            </span>
                          </div>
                          <div className="font-mono-num text-[#64748B]">
                            تاريخ الاجتماع: {toArabicNumerals(item.minuteDate) || '-'} | الوقت:{' '}
                            {toArabicNumerals(item.minuteTime) || '-'}
                          </div>
                        </td>

                        {/* Action: Preview Source Minute */}
                        <td className="py-3.5 px-3 text-center align-top whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onPreviewMinute(item.minuteId)}
                            className="px-3 py-1.5 text-[11px] font-bold text-white bg-gradient-to-l from-[#1746B8] to-[#101F3D] hover:from-[#123896] hover:to-[#0C1830] rounded-lg inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            title="معاينة المحضر المرتبط بهذا الموضوع"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#C7A66B]" />
                            <span>معاينة المحضر</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
