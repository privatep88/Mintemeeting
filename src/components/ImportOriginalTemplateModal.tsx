import React, { useState } from 'react';
import { X, Upload, Users, FileCheck } from 'lucide-react';
import {
  ParticipantRow,
  OutcomeRow,
  OngoingTopicRow,
  NewTopicRow,
  FullMinuteBundle,
} from '../types/minutes';
import { generateSafeId } from '../services/minutesService';

interface ImportOriginalTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  ownerId: string;
  currentMinuteId: string;
  onImportParticipantsOnly: (participants: ParticipantRow[]) => void;
  onImportFullMinute: (bundle: Partial<FullMinuteBundle>) => void;
}

export const ImportOriginalTemplateModal: React.FC<ImportOriginalTemplateModalProps> = ({
  isOpen,
  onClose,
  ownerId,
  currentMinuteId,
  onImportParticipantsOnly,
  onImportFullMinute,
}) => {
  const [rawParticipantsText, setRawParticipantsText] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleParseVerbatimParticipants = () => {
    const lines = rawParticipantsText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setError('يرجى لصق قائمة الأسماء والمسميات الوظيفية أو رفع ملف للاستيراد الحرفي.');
      return;
    }

    const parsed: ParticipantRow[] = lines.map((line, index) => {
      // Support tab, pipe, comma, or dash separation verbatim without altering names
      let name = line;
      let jobTitle = '';
      let notes = '';

      if (line.includes('\t')) {
        const parts = line.split('\t').map((s) => s.trim());
        name = parts[0] || '';
        jobTitle = parts[1] || '';
        notes = parts[2] || '';
      } else if (line.includes('|')) {
        const parts = line.split('|').map((s) => s.trim());
        name = parts[0] || '';
        jobTitle = parts[1] || '';
        notes = parts[2] || '';
      } else if (line.includes(' - ')) {
        const parts = line.split(' - ').map((s) => s.trim());
        name = parts[0] || '';
        jobTitle = parts.slice(1).join(' - ');
      } else if (line.includes('،')) {
        const parts = line.split('،').map((s) => s.trim());
        name = parts[0] || '';
        jobTitle = parts.slice(1).join('، ');
      } else if (line.includes(',')) {
        const parts = line.split(',').map((s) => s.trim());
        name = parts[0] || '';
        jobTitle = parts.slice(1).join(', ');
      }

      return {
        id: generateSafeId(`imp_p_${index}`),
        minuteId: currentMinuteId,
        orderIndex: index + 1,
        name,
        jobTitle,
        attendanceStatus: 'present',
        notes,
        ownerId,
      };
    });

    onImportParticipantsOnly(parsed);
    onClose();
  };

  const handleJsonOrCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = String(ev.target?.result || '');
      if (file.name.endsWith('.json')) {
        try {
          const data = JSON.parse(content);
          const importedParticipants: ParticipantRow[] = Array.isArray(data.participants)
            ? data.participants.map((p: Partial<ParticipantRow>, i: number) => ({
                id: generateSafeId(`p_${i}`),
                minuteId: currentMinuteId,
                orderIndex: i + 1,
                name: String(p.name || ''),
                jobTitle: String(p.jobTitle || ''),
                attendanceStatus: p.attendanceStatus || 'present',
                notes: String(p.notes || ''),
                ownerId,
              }))
            : [];

          const importedOutcomes: OutcomeRow[] = Array.isArray(data.outcomes)
            ? data.outcomes.map((o: Partial<OutcomeRow>, i: number) => ({
                id: generateSafeId(`o_${i}`),
                minuteId: currentMinuteId,
                orderIndex: i + 1,
                subject: String(o.subject || ''),
                recommendations: String(o.recommendations || ''),
                responsiblePerson: String(o.responsiblePerson || ''),
                executionDate: String(o.executionDate || ''),
                ownerId,
              }))
            : [];

          const importedOngoing: OngoingTopicRow[] = Array.isArray(data.ongoingTopics)
            ? data.ongoingTopics.map((t: Partial<OngoingTopicRow>, i: number) => ({
                id: generateSafeId(`ong_${i}`),
                minuteId: currentMinuteId,
                orderIndex: i + 1,
                itemNumber: String(t.itemNumber || i + 1),
                subject: String(t.subject || ''),
                latestUpdates: String(t.latestUpdates || ''),
                recommendationOrAction: String(t.recommendationOrAction || ''),
                followUpPerson: String(t.followUpPerson || ''),
                followUpDate: String(t.followUpDate || ''),
                topicStatus: String(t.topicStatus || ''),
                sourceMinuteId: String(t.sourceMinuteId || ''),
                sourceMinuteLabel: String(t.sourceMinuteLabel || ''),
                historyLog: String(t.historyLog || ''),
                ownerId,
              }))
            : [];

          const importedNew: NewTopicRow[] = Array.isArray(data.newTopics)
            ? data.newTopics.map((n: Partial<NewTopicRow>, i: number) => ({
                id: generateSafeId(`new_${i}`),
                minuteId: currentMinuteId,
                orderIndex: i + 1,
                itemNumber: String(n.itemNumber || i + 1),
                subject: String(n.subject || ''),
                discussionSummary: String(n.discussionSummary || ''),
                recommendationsAndDecisions: String(n.recommendationsAndDecisions || ''),
                responsiblePerson: String(n.responsiblePerson || ''),
                executionDate: String(n.executionDate || ''),
                ownerId,
              }))
            : [];

          onImportFullMinute({
            minute: data.minute,
            participants: importedParticipants,
            outcomes: importedOutcomes,
            ongoingTopics: importedOngoing,
            newTopics: importedNew,
          });
          onClose();
        } catch {
          setError('صيغة ملف JSON غير صالحة.');
        }
      } else {
        // Treat CSV / TXT as verbatim participant lines
        setRawParticipantsText(content);
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#101F3D]/70 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-l from-[#101F3D] to-[#1746B8] text-white border-b border-[#C7A66B]/40">
          <div className="flex items-center gap-2.5">
            <Upload className="w-5 h-5 text-[#C7A66B]" />
            <h3 className="text-base font-extrabold text-white font-display">
              استيراد محضر أو قائمة المشاركين كما وردت حرفياً
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-md text-xs text-slate-700 leading-relaxed">
            التزاماً بضوابط النظام: لا يتم إدراج أي بيانات افتراضية للمحاضر الجديدة تلقائياً. يمكنك من هنا استيراد الأسماء والمسميات الوظيفية حرفياً كما وردت في ملفك (CSV / TXT / Excel منسوخ) أو استيراد ملف محضر كامل (JSON) دون أي تعديل أو اختراع للبيانات.
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-md">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              1. استيراد من ملف خارجي (JSON لمحضر كامل، أو CSV / TXT لقائمة الحضور)
            </label>
            <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 rounded-md cursor-pointer hover:border-blue-700 hover:bg-blue-50/30 transition-colors text-xs font-semibold text-slate-700">
              <FileCheck className="w-4 h-4 text-blue-800" />
              <span>اختر ملفاً من جهازك (.json, .csv, .txt)</span>
              <input
                type="file"
                accept=".json,.csv,.txt"
                onChange={handleJsonOrCsvFileUpload}
                className="hidden"
              />
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              2. أو الصق الأسماء والمسميات الوظيفية حرفياً (سطر لكل مشارك: الاسم - المسمى الوظيفي)
            </label>
            <textarea
              rows={6}
              value={rawParticipantsText}
              onChange={(e) => setRawParticipantsText(e.target.value)}
              placeholder={`مثال:\nأحمد محمد العلي - مدير إدارة العمليات\nخالد سعيد المنصوري - رئيس قسم الجودة`}
              className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
          </div>
        </div>

        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleParseVerbatimParticipants}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-800 hover:bg-blue-900 rounded-md flex items-center gap-1.5"
          >
            <Users className="w-3.5 h-3.5" />
            استيراد الأسماء والمسميات حرفياً
          </button>
        </div>
      </div>
    </div>
  );
};
