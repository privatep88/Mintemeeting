import React from 'react';
import {
  Calendar,
  Users,
  ClipboardList,
  RefreshCw,
  FileText,
  PenTool,
} from 'lucide-react';
import { FullMinuteBundle } from '../types/minutes';
import { toArabicNumerals, formatMinuteNumber } from '../utils/numerals';

interface OfficialMinutePrintViewProps {
  bundle: FullMinuteBundle;
}

export const OfficialMinutePrintView: React.FC<OfficialMinutePrintViewProps> = ({ bundle }) => {
  const { minute, participants, outcomes, ongoingTopics, newTopics } = bundle;

  const getAttendanceLabel = (status: string) => {
    if (status === 'present') return 'حاضر';
    if (status === 'absent') return 'غائب';
    if (status === 'excused') return 'معتذر';
    return status;
  };

  const isCompletedTopicStatus = (status?: string): boolean => {
    if (!status) return false;
    const normalized = status.trim().toLowerCase();
    return (
      normalized.includes('مكتمل') ||
      normalized.includes('تم التنفيذ') ||
      normalized.includes('تم الإنجاز') ||
      normalized.includes('تم الانجاز') ||
      normalized.includes('منجز') ||
      normalized === 'تم' ||
      normalized === 'completed' ||
      normalized === 'done'
    );
  };

  const renderTopicStatusCell = (status?: string) => {
    if (!status || !status.trim()) return '-';
    const displayStatus = toArabicNumerals(status);
    if (isCompletedTopicStatus(status)) {
      return (
        <span className="inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded bg-[#E1F7EE] text-[#0D6E52] border border-[#88D8C0] font-bold mx-auto">
          <span>✓</span>
          <span>{displayStatus}</span>
        </span>
      );
    }
    if (status.includes('متأخر')) {
      return (
        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded bg-red-50 text-red-800 border border-red-200 font-bold mx-auto">
          {displayStatus}
        </span>
      );
    }
    return <span className="font-bold text-[#172640]">{displayStatus}</span>;
  };

  const formatMeetingTime = (rawTime?: string): string => {
    if (!rawTime || !rawTime.trim()) return '-';
    const trimmed = rawTime.trim();

    // If it already contains Arabic period designation, return as is
    if (trimmed.includes('صباح') || trimmed.includes('مساء')) {
      return toArabicNumerals(trimmed);
    }

    // Check for HH:mm or HH:mm:ss format
    const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM|am|pm))?$/);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = timeMatch[2];
      const meridiem = timeMatch[4]?.toUpperCase();

      let period = 'صباحاً';

      if (meridiem) {
        period = meridiem === 'PM' ? 'مساءً' : 'صباحاً';
        if (meridiem === 'PM' && hours < 12) hours += 12;
        if (meridiem === 'AM' && hours === 12) hours = 0;
      } else {
        period = hours >= 12 ? 'مساءً' : 'صباحاً';
      }

      // Convert 24h to 12h display
      const displayHours = hours % 12 === 0 ? 12 : hours % 12;
      const formattedTime = `${String(displayHours).padStart(2, '0')}:${minutes}`;

      return `${toArabicNumerals(formattedTime)} ${period}`;
    }

    return toArabicNumerals(trimmed);
  };

  return (
    <div
      dir="rtl"
      className="print-container bg-white text-[#172640] border border-[#CFDCEB] rounded-[16px] p-5 sm:p-7 max-w-[735px] w-full mx-auto shadow-[0_18px_45px_rgba(9,27,61,0.16),0_4px_12px_rgba(9,27,61,0.06)]"
    >
      {/* Official Institutional Header */}
      <div className="avoid-break grid grid-cols-3 items-center border-b-2 border-[#102347] pb-4 mb-5">
        <div className="space-y-1 text-right">
          <p className="text-xs text-slate-600 font-mono-num whitespace-nowrap">نظام ساعـد المؤسسي (SAAED)</p>
          <p className="text-xs text-slate-600 font-mono-num whitespace-nowrap">إدارة الخدمات العامة - قسم إدارة المرافق</p>
          <p className="text-xs text-slate-600 font-mono-num whitespace-nowrap">
            {`المرجع الرسمي: MIN-${toArabicNumerals(minute.year)}-${formatMinuteNumber(minute.minuteNumber)}`}
          </p>
        </div>

        <div className="flex items-center justify-center text-center">
          <img
            src={`${import.meta.env.BASE_URL}assets/aistudio/logo_1afd1154.png`}
            alt="شعار ساعد SAAED"
            referrerPolicy="no-referrer"
            className="h-16 object-contain mx-auto"
          />
        </div>

        <div className="space-y-1 text-left font-mono-num text-xs text-slate-600 whitespace-nowrap">
          <p>
            {`رقم المحضر: ${formatMinuteNumber(minute.minuteNumber)} / ${toArabicNumerals(minute.year)}`}
          </p>
          <p>
            {`التاريخ: ${toArabicNumerals(minute.date) || '-'}`}
          </p>
          <p>
            {`الوقت: ${formatMeetingTime(minute.time)}`}
          </p>
        </div>
      </div>

      {/* Document Main Title Banner */}
      <div
        className="avoid-break rounded-lg border border-[#1E3A6D] px-4 py-3 text-center mb-5 shadow-2xs"
        style={{
          background: 'linear-gradient(90deg, #0E2042 0%, #163366 50%, #0E2042 100%)',
        }}
      >
        <h1 className="print-section-title text-lg sm:text-xl font-extrabold text-white">
          {`محضر اجتماع رقم (${formatMinuteNumber(minute.minuteNumber)}) لسنة ${toArabicNumerals(minute.year)}`}
        </h1>
        {minute.mainSubject && (
          <p className="text-xs sm:text-sm font-semibold text-slate-200 mt-1">
            {`الموضوع الرئيسي: ${toArabicNumerals(minute.mainSubject)}`}
          </p>
        )}
      </div>

      {/* Section 1: Meeting Metadata */}
      <section className="print-section mb-5 avoid-break">
        <h2
          className="print-section-title text-right text-xs sm:text-sm font-extrabold text-[#102347] border border-b-0 border-[#9FB2CC] rounded-t-md px-3.5 py-2 mb-0 flex items-center justify-start gap-2"
          style={{
            background: 'linear-gradient(270deg, #B8C7DC 0%, #C7D4E6 55%, #D6E1F0 100%)',
          }}
        >
          <Calendar className="w-4 h-4 text-[#102347] shrink-0" />
          <span>أولاً: بيانات الاجتماع</span>
        </h2>
        <table className="saaed-minute-document-table w-full border-collapse border border-[#9FB2CC] text-xs">
          <tbody>
            <tr>
              <th className="border border-[#B8C7DC] bg-[#E3EBF6] text-[#102347] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold w-1/6">
                رقم المحضر
              </th>
              <td className="border border-[#B8C7DC] bg-white px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-mono-num font-semibold w-2/6">
                {formatMinuteNumber(minute.minuteNumber)}
              </td>
              <th className="border border-[#B8C7DC] bg-[#E3EBF6] text-[#102347] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold w-1/6">
                سنة الاجتماع
              </th>
              <td className="border border-[#B8C7DC] bg-white px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-mono-num font-semibold w-2/6">
                {toArabicNumerals(minute.year)}
              </td>
            </tr>
            <tr>
              <th className="border border-[#B8C7DC] bg-[#E3EBF6] text-[#102347] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold">
                تاريخ الاجتماع
              </th>
              <td className="border border-[#B8C7DC] bg-white px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-mono-num">
                {toArabicNumerals(minute.date) || '-'}
              </td>
              <th className="border border-[#B8C7DC] bg-[#E3EBF6] text-[#102347] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold">
                وقت الاجتماع
              </th>
              <td className="border border-[#B8C7DC] bg-white px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-mono-num">
                {formatMeetingTime(minute.time)}
              </td>
            </tr>
            <tr>
              <th className="border border-[#B8C7DC] bg-[#E3EBF6] text-[#102347] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold">
                مكان الاجتماع
              </th>
              <td className="border border-[#B8C7DC] bg-white px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed">
                {toArabicNumerals(minute.location) || '-'}
              </td>
              <th className="border border-[#B8C7DC] bg-[#E3EBF6] text-[#102347] px-2.5 py-2 text-center align-middle whitespace-nowrap leading-relaxed font-bold">
                موضوع الاجتماع الرئيسي
              </th>
              <td className="border border-[#B8C7DC] bg-white px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed">
                {toArabicNumerals(minute.mainSubject) || '-'}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Section 2: Participants */}
      <section className="print-section mb-5">
        <h2
          className="print-section-title text-right text-xs sm:text-sm font-extrabold text-[#102347] border border-b-0 border-[#9FB2CC] rounded-t-md px-3.5 py-2 mb-0 flex items-center justify-start gap-2"
          style={{
            background: 'linear-gradient(270deg, #B8C7DC 0%, #C7D4E6 55%, #D6E1F0 100%)',
          }}
        >
          <Users className="w-4 h-4 text-[#102347] shrink-0" />
          <span>{`ثانياً: جدول الحضور والمشاركين (${toArabicNumerals(participants.length)})`}</span>
        </h2>
        <table className="saaed-minute-document-table w-full border-collapse border border-[#9FB2CC] text-xs">
          <thead>
            <tr className="bg-[#DCE6F2] text-[#102347]">
              <th className="border border-[#B8C7DC] px-2.5 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold w-10">
                م
              </th>
              <th className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold">
                الاسم
              </th>
              <th className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold">
                المسمى الوظيفي
              </th>
              <th className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold w-28">
                حالة الحضور
              </th>
              <th className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold">
                ملاحظات
              </th>
            </tr>
          </thead>
          <tbody>
            {participants.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="border border-[#B8C7DC] px-3 py-4 text-center align-middle whitespace-normal break-words leading-relaxed text-slate-500"
                >
                  لم يتم إدراج مشاركين في هذا المحضر
                </td>
              </tr>
            ) : (
              participants.map((p, index) => (
                <tr key={p.id} className="bg-white">
                  <td className="border border-[#B8C7DC] px-2.5 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-mono-num">
                    {toArabicNumerals(index + 1)}
                  </td>
                  <td className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold text-[#102347]">
                    {toArabicNumerals(p.name)}
                  </td>
                  <td className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed">
                    {toArabicNumerals(p.jobTitle) || '-'}
                  </td>
                  <td className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-semibold">
                    {getAttendanceLabel(p.attendanceStatus)}
                  </td>
                  <td className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed">
                    {toArabicNumerals(p.notes) || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {/* Section 3: Inputs & Outcomes */}
      <section className="print-section mb-5">
        <h2
          className="print-section-title text-right text-xs sm:text-sm font-extrabold text-[#102347] border border-b-0 border-[#9FB2CC] rounded-t-md px-3.5 py-2 mb-0 flex items-center justify-start gap-2"
          style={{
            background: 'linear-gradient(270deg, #B8C7DC 0%, #C7D4E6 55%, #D6E1F0 100%)',
          }}
        >
          <ClipboardList className="w-4 h-4 text-[#102347] shrink-0" />
          <span>ثالثاً: مدخلات ونتائج الاجتماع مفصلة أدناه</span>
        </h2>
        <table className="saaed-minute-document-table w-full border-collapse border border-[#9FB2CC] text-xs">
          <thead>
            <tr className="bg-[#DCE6F2] text-[#102347]">
              <th className="border border-[#B8C7DC] px-2.5 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold w-10">
                م
              </th>
              <th className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold w-1/4">
                الموضوع
              </th>
              <th className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold">
                التوصيات
              </th>
              <th className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold w-32">
                مسؤولية التنفيذ
              </th>
              <th className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold w-24">
                تاريخ التنفيذ
              </th>
              <th className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold w-24">
                الحالة
              </th>
            </tr>
          </thead>
          <tbody>
            {outcomes.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="border border-[#B8C7DC] px-3 py-4 text-center align-middle whitespace-normal break-words leading-relaxed text-slate-500"
                >
                  لا توجد مدخلات أو نتائج مسجلة في هذا القسم
                </td>
              </tr>
            ) : (
              outcomes.map((o, index) => {
                const completed = isCompletedTopicStatus(o.status);
                return (
                  <tr key={o.id} className="bg-white">
                    <td className="border border-[#B8C7DC] px-2.5 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-mono-num">
                      {toArabicNumerals(index + 1)}
                    </td>
                    <td
                      className={`border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold ${
                        completed ? 'text-emerald-950' : 'text-[#102347]'
                      }`}
                    >
                      {toArabicNumerals(o.subject)}
                    </td>
                    <td className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed">
                      {toArabicNumerals(o.recommendations)}
                    </td>
                    <td className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed">
                      {toArabicNumerals(o.responsiblePerson) || '-'}
                    </td>
                    <td className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-mono-num">
                      {toArabicNumerals(o.executionDate) || '-'}
                    </td>
                    <td className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-semibold">
                      {renderTopicStatusCell(o.status)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {/* Section 4: Ongoing Topics */}
      {bundle.showOngoingTable !== false && (
        <section className="print-section mb-5">
          <h2
            className="print-section-title text-right text-xs sm:text-sm font-extrabold text-[#102347] border border-b-0 border-[#9FB2CC] rounded-t-md px-3.5 py-2 mb-0 flex items-center justify-start gap-2"
            style={{
              background: 'linear-gradient(270deg, #B8C7DC 0%, #C7D4E6 55%, #D6E1F0 100%)',
            }}
          >
            <RefreshCw className="w-4 h-4 text-[#102347] shrink-0" />
            <span>رابعاً: المواضيع المستمرة</span>
          </h2>
          <table className="saaed-minute-document-table w-full border-collapse border border-[#9FB2CC] text-xs">
            <thead>
              <tr className="bg-[#DCE6F2] text-[#102347]">
                <th className="border border-[#B8C7DC] px-2.5 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold w-10">
                  م
                </th>
                <th className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold w-1/4">
                  الموضوع
                </th>
                <th className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold">
                  التوصيات
                </th>
                <th className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold w-32">
                  مسؤولية التنفيذ
                </th>
                <th className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold w-24">
                  تاريخ التنفيذ
                </th>
                <th className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold w-24">
                  الحالة
                </th>
              </tr>
            </thead>
            <tbody>
              {ongoingTopics.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="border border-[#B8C7DC] px-3 py-4 text-center align-middle whitespace-normal break-words leading-relaxed text-slate-500"
                  >
                    لا توجد مواضيع مستمرة مسجلة في هذا القسم
                  </td>
                </tr>
              ) : (
                ongoingTopics.map((t, index) => {
                  const completed = isCompletedTopicStatus(t.topicStatus);
                  return (
                    <tr key={t.id} className="bg-white">
                      <td className="border border-[#B8C7DC] px-2.5 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-mono-num">
                        {toArabicNumerals(index + 1)}
                      </td>
                      <td
                        className={`border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold ${
                          completed ? 'text-emerald-950' : 'text-[#102347]'
                        }`}
                      >
                        <div className="text-center">{toArabicNumerals(t.subject)}</div>
                        {t.sourceMinuteLabel && (
                          <div className="text-[10px] text-slate-500 mt-1 text-center">
                            {`مرحّل من: ${toArabicNumerals(t.sourceMinuteLabel)}`}
                          </div>
                        )}
                      </td>
                      <td className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed">
                        {toArabicNumerals(t.recommendationOrAction) || '-'}
                      </td>
                      <td className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed">
                        {toArabicNumerals(t.followUpPerson) || '-'}
                      </td>
                      <td className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-mono-num">
                        {toArabicNumerals(t.followUpDate) || '-'}
                      </td>
                      <td className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-semibold">
                        {renderTopicStatusCell(t.topicStatus)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>
      )}

      {/* Section 5: New Topics */}
      {bundle.showNewTopicsTable !== false && (
        <section className="print-section mb-5">
          <h2
            className="print-section-title text-right text-xs sm:text-sm font-extrabold text-[#102347] border border-b-0 border-[#9FB2CC] rounded-t-md px-3.5 py-2 mb-0 flex items-center justify-start gap-2"
            style={{
              background: 'linear-gradient(270deg, #B8C7DC 0%, #C7D4E6 55%, #D6E1F0 100%)',
            }}
          >
            <FileText className="w-4 h-4 text-[#102347] shrink-0" />
            <span>خامساً: المواضيع الجديدة</span>
          </h2>
          <table className="saaed-minute-document-table w-full border-collapse border border-[#9FB2CC] text-xs">
            <thead>
              <tr className="bg-[#DCE6F2] text-[#102347]">
                <th className="border border-[#B8C7DC] px-2.5 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold w-10">
                  م
                </th>
                <th className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold w-1/4">
                  الموضوع
                </th>
                <th className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold">
                  التوصيات
                </th>
                <th className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold w-32">
                  مسؤولية التنفيذ
                </th>
                <th className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold w-24">
                  تاريخ التنفيذ
                </th>
                <th className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold w-24">
                  الحالة
                </th>
              </tr>
            </thead>
            <tbody>
              {newTopics.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="border border-[#B8C7DC] px-3 py-4 text-center align-middle whitespace-normal break-words leading-relaxed text-slate-500"
                  >
                    لا توجد مواضيع جديدة مسجلة في هذا القسم
                  </td>
                </tr>
              ) : (
                newTopics.map((n, index) => {
                  const completed = isCompletedTopicStatus(n.status);
                  return (
                    <tr key={n.id} className="bg-white">
                      <td className="border border-[#B8C7DC] px-2.5 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-mono-num">
                        {toArabicNumerals(index + 1)}
                      </td>
                      <td
                        className={`border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold ${
                          completed ? 'text-emerald-950' : 'text-[#102347]'
                        }`}
                      >
                        {toArabicNumerals(n.subject)}
                      </td>
                      <td className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed">
                        {toArabicNumerals(n.recommendationsAndDecisions) || '-'}
                      </td>
                      <td className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed">
                        {toArabicNumerals(n.responsiblePerson) || '-'}
                      </td>
                      <td className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-mono-num">
                        {toArabicNumerals(n.executionDate) || '-'}
                      </td>
                      <td className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-semibold">
                        {renderTopicStatusCell(n.status)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>
      )}

      {/* Custom Added Tables */}
      {(bundle.customTables ?? []).map((ct) => (
        <section key={ct.id} className="print-section mb-5">
          <h2
            className="print-section-title text-right text-xs sm:text-sm font-extrabold text-[#102347] border border-b-0 border-[#9FB2CC] rounded-t-md px-3.5 py-2 mb-0 flex items-center justify-start gap-2"
            style={{
              background: 'linear-gradient(270deg, #B8C7DC 0%, #C7D4E6 55%, #D6E1F0 100%)',
            }}
          >
            <FileText className="w-4 h-4 text-[#102347] shrink-0" />
            <span>{toArabicNumerals(ct.title)}</span>
          </h2>
          <table className="saaed-minute-document-table w-full border-collapse border border-[#9FB2CC] text-xs">
            <thead>
              <tr className="bg-[#DCE6F2] text-[#102347]">
                <th className="border border-[#B8C7DC] px-2.5 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold w-10">
                  م
                </th>
                <th className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold w-1/4">
                  الموضوع
                </th>
                <th className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold">
                  التوصيات
                </th>
                <th className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold w-32">
                  مسؤولية التنفيذ
                </th>
                <th className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold w-24">
                  تاريخ التنفيذ
                </th>
                <th className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold w-24">
                  الحالة
                </th>
              </tr>
            </thead>
            <tbody>
              {ct.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="border border-[#B8C7DC] px-3 py-4 text-center align-middle whitespace-normal break-words leading-relaxed text-slate-500"
                  >
                    لا توجد بنود مسجلة في هذا الجدول
                  </td>
                </tr>
              ) : (
                ct.rows.map((row, index) => {
                  const completed = isCompletedTopicStatus(row.status);
                  return (
                    <tr key={row.id} className="bg-white">
                      <td className="border border-[#B8C7DC] px-2.5 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-mono-num">
                        {toArabicNumerals(index + 1)}
                      </td>
                      <td
                        className={`border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-bold ${
                          completed ? 'text-emerald-950' : 'text-[#102347]'
                        }`}
                      >
                        {toArabicNumerals(row.subject)}
                      </td>
                      <td className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed">
                        {toArabicNumerals(row.recommendations) || '-'}
                      </td>
                      <td className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed">
                        {toArabicNumerals(row.responsiblePerson) || '-'}
                      </td>
                      <td className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-mono-num">
                        {toArabicNumerals(row.executionDate) || '-'}
                      </td>
                      <td className="border border-[#B8C7DC] px-3 py-2 text-center align-middle whitespace-normal break-words leading-relaxed font-semibold">
                        {renderTopicStatusCell(row.status)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>
      ))}

      {/* Section 6: Approvals & Signatures */}
      <section className="print-section mt-6 avoid-break">
        <h2
          className="print-section-title text-right text-xs sm:text-sm font-extrabold text-[#102347] border border-b-0 border-[#9FB2CC] rounded-t-md px-3.5 py-2 mb-0 flex items-center justify-start gap-2"
          style={{
            background: 'linear-gradient(270deg, #B8C7DC 0%, #C7D4E6 55%, #D6E1F0 100%)',
          }}
        >
          <PenTool className="w-4 h-4 text-[#102347] shrink-0" />
          <span>سادساً: الاعتماد والتوقيعات</span>
        </h2>
        <div className="grid grid-cols-2 border border-[#9FB2CC] divide-x divide-x-reverse divide-[#B8C7DC] bg-[#F8FAFC]/40 rounded-b-md text-xs">
          {/* Secretary */}
          <div className="p-4 flex flex-col justify-between min-h-[145px]">
            <div className="text-center">
              <p className="font-extrabold text-[#102347] text-sm mb-1.5">مقرر الاجتماع</p>
              <p className="text-slate-700 font-semibold">
                {`الاسم: ${toArabicNumerals(minute.secretaryName) || '........................................................'}`}
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-dashed border-slate-300 text-center">
              <p className="font-bold text-slate-700 mb-1.5">التوقيع:</p>
              {minute.secretarySignature ? (
                minute.secretarySignature.startsWith('data:image') ? (
                  <img
                    src={minute.secretarySignature}
                    alt="توقيع مقرر الاجتماع"
                    className="h-16 object-contain mx-auto"
                  />
                ) : (
                  <p className="font-semibold text-blue-900 py-2">{toArabicNumerals(minute.secretarySignature)}</p>
                )
              ) : (
                <div className="h-14" />
              )}
            </div>
          </div>

          {/* Chairman */}
          <div className="p-4 flex flex-col justify-between min-h-[145px]">
            <div className="text-center">
              <p className="font-extrabold text-[#102347] text-sm mb-1.5">رئيس الاجتماع</p>
              <p className="text-slate-700 font-semibold">
                {`الاسم: ${toArabicNumerals(minute.chairmanName) || '........................................................'}`}
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-dashed border-slate-300 text-center">
              <p className="font-bold text-slate-700 mb-1.5">التوقيع:</p>
              {minute.chairmanSignature ? (
                minute.chairmanSignature.startsWith('data:image') ? (
                  <img
                    src={minute.chairmanSignature}
                    alt="توقيع رئيس الاجتماع"
                    className="h-16 object-contain mx-auto"
                  />
                ) : (
                  <p className="font-semibold text-blue-900 py-2">{toArabicNumerals(minute.chairmanSignature)}</p>
                )
              ) : (
                <div className="h-14" />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Official Institutional Footer */}
      <footer className="avoid-break mt-6 pt-3 border-t border-slate-300 flex items-center justify-between text-[11px] text-slate-600 font-medium">
        <span>نظام ساعـد (SAAED) لإدارة محاضر الاجتماعات والأرشفة الرقمية</span>
        <span className="font-mono-num">
          {`محضر رقم (${formatMinuteNumber(minute.minuteNumber)}) لسنة ${toArabicNumerals(minute.year)}`}
        </span>
      </footer>
    </div>
  );
};
