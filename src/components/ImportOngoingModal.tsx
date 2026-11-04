import React, { useState } from 'react';
import { X, History, ArrowDownToLine, FileText } from 'lucide-react';
import { MinuteRecord, OngoingTopicRow } from '../types/minutes';
import { loadFullMinute, generateSafeId } from '../services/minutesService';
import { formatMinuteNumber } from '../utils/numerals';

interface ImportOngoingModalProps {
  isOpen: boolean;
  onClose: () => void;
  allMinutes: MinuteRecord[];
  currentMinuteId: string;
  ownerId: string;
  onImportTopic: (topic: OngoingTopicRow) => void;
}

export const ImportOngoingModal: React.FC<ImportOngoingModalProps> = ({
  isOpen,
  onClose,
  allMinutes,
  currentMinuteId,
  ownerId,
  onImportTopic,
}) => {
  const [selectedMinuteId, setSelectedMinuteId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<
    Array<{
      sourceType: string;
      subject: string;
      latestUpdates: string;
      recommendation: string;
      person: string;
      date: string;
      historyLog: string;
      sourceLabel: string;
    }>
  >([]);

  if (!isOpen) return null;

  const previousMinutes = allMinutes.filter((m) => m.id !== currentMinuteId);

  const handleSelectMinute = async (minId: string) => {
    setSelectedMinuteId(minId);
    if (!minId) {
      setCandidates([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const full = await loadFullMinute(minId);
      const label = `محضر رقم (${formatMinuteNumber(full.minute.minuteNumber)}) لسنة ${full.minute.year} - بتاريخ ${full.minute.date}`;
      const list: typeof candidates = [];

      full.ongoingTopics.forEach((t) => {
        const prevHist = t.historyLog ? `${t.historyLog}\n` : '';
        const newHistEntry = `[${label}] المستجدات: ${t.latestUpdates || '-'} | التوصية: ${
          t.recommendationOrAction || '-'
        }`;
        list.push({
          sourceType: 'موضوع مستمر سابق',
          subject: t.subject,
          latestUpdates: t.latestUpdates,
          recommendation: t.recommendationOrAction,
          person: t.followUpPerson,
          date: t.followUpDate,
          historyLog: `${prevHist}${newHistEntry}`.slice(0, 7500),
          sourceLabel: label,
        });
      });

      full.outcomes.forEach((o) => {
        const newHistEntry = `[${label} - مدخلات ونتائج] التوصية السابقة: ${o.recommendations || '-'}`;
        list.push({
          sourceType: 'مدخلات ونتائج الاجتماع',
          subject: o.subject,
          latestUpdates: `تمت مناقشته في ${label}`,
          recommendation: o.recommendations,
          person: o.responsiblePerson,
          date: o.executionDate,
          historyLog: newHistEntry,
          sourceLabel: label,
        });
      });

      full.newTopics.forEach((n) => {
        const newHistEntry = `[${label} - موضوع جديد] المناقشة: ${
          n.discussionSummary || '-'
        } | القرارات: ${n.recommendationsAndDecisions || '-'}`;
        list.push({
          sourceType: 'موضوع جديد سابق',
          subject: n.subject,
          latestUpdates: n.discussionSummary,
          recommendation: n.recommendationsAndDecisions,
          person: n.responsiblePerson,
          date: n.executionDate,
          historyLog: newHistEntry,
          sourceLabel: label,
        });
      });

      setCandidates(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل بيانات المحضر السابق.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-lg max-w-3xl w-full max-h-[85vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-blue-800" />
            <h3 className="text-base font-bold text-slate-900">
              استيراد موضوع من محضر اجتماع سابق إلى قسم المواضيع المستمرة
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          <p className="text-xs text-slate-600 leading-relaxed">
            اختر أحد المحاضر المحفوظة سابقاً لاستعراض بنوده ومواضيعه وتوصياته، ونقل أي موضوع منها إلى المحضر الحالي كـ
            <strong className="text-slate-900"> موضوع مستمر </strong>
            مع الاحتفاظ الكامل بسجله التاريخي دون المساس ببيانات المحضر الأصلي.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              اختر المحضر السابق
            </label>
            <select
              value={selectedMinuteId}
              onChange={(e) => handleSelectMinute(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-700"
            >
              <option value="">-- اختر محضراً من القائمة --</option>
              {previousMinutes.map((m) => (
                <option key={m.id} value={m.id}>
                  محضر رقم ({formatMinuteNumber(m.minuteNumber)}) لسنة {m.year} — التاريخ: {m.date} — المكان: {m.location || 'غير محدد'}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-md">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-10 text-center text-sm text-slate-500">
              جاري تحميل موضوعات وتوصيات المحضر المختار...
            </div>
          ) : selectedMinuteId && candidates.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-md">
              لا توجد موضوعات مسجلة في هذا المحضر.
            </div>
          ) : (
            <div className="space-y-3">
              {candidates.map((c, idx) => (
                <div
                  key={idx}
                  className="border border-slate-200 rounded-md p-4 hover:border-blue-300 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-50/50"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <FileText className="w-3.5 h-3.5 text-blue-800" />
                      <span>{c.sourceType}</span>
                      <span>·</span>
                      <span>المسؤول: {c.person || 'غير محدد'}</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">{c.subject || 'بدون عنوان'}</h4>
                    {c.recommendation && (
                      <p className="text-xs text-slate-600 line-clamp-2">
                        التوصية السابقة: {c.recommendation}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onImportTopic({
                        id: generateSafeId('ong'),
                        minuteId: currentMinuteId,
                        orderIndex: 1,
                        itemNumber: '',
                        subject: c.subject,
                        latestUpdates: c.latestUpdates,
                        recommendationOrAction: c.recommendation,
                        followUpPerson: c.person,
                        followUpDate: c.date,
                        topicStatus: 'مستمر - قيد المتابعة',
                        sourceMinuteId: selectedMinuteId,
                        sourceMinuteLabel: c.sourceLabel,
                        historyLog: c.historyLog,
                        ownerId,
                      });
                    }}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-800 hover:bg-blue-900 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <ArrowDownToLine className="w-3.5 h-3.5" />
                    استيراد كموضوع مستمر
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
