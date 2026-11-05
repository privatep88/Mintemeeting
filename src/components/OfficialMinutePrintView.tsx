import React from 'react';
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

  return (
    <div
      dir="rtl"
      className="print-container bg-white text-slate-900 border border-slate-300 p-8 md:p-10 max-w-[210mm] min-h-[297mm] mx-auto shadow-xs"
    >
      {/* Official Institutional Header */}
      <div className="avoid-break flex items-center justify-between border-b-2 border-slate-900 pb-5 mb-6">
        <div className="space-y-1 text-right">
          <p className="text-sm font-bold text-slate-900">نظام ساعـد المؤسسي (SAAED)</p>
          <p className="text-xs text-slate-600">الأمانة العامة لإدارة الاجتماعات واللجان</p>
          <p className="text-xs text-slate-600 font-mono-num">
            المرجع الرسمي: MIN-{toArabicNumerals(minute.year)}-{formatMinuteNumber(minute.minuteNumber)}
          </p>
        </div>

        <div className="text-center">
          <img
            src={`${import.meta.env.BASE_URL}assets/aistudio/logo_1afd1154.png`}
            alt="شعار ساعد SAAED"
            referrerPolicy="no-referrer"
            className="h-16 object-contain mx-auto"
          />
        </div>

        <div className="space-y-1 text-left font-mono-num text-xs text-slate-700">
          <p>
            <span className="font-semibold">رقم المحضر:</span> {formatMinuteNumber(minute.minuteNumber)} / {toArabicNumerals(minute.year)}
          </p>
          <p>
            <span className="font-semibold">التاريخ:</span> {toArabicNumerals(minute.date) || '-'}
          </p>
          <p>
            <span className="font-semibold">الوقت:</span> {toArabicNumerals(minute.time) || '-'}
          </p>
        </div>
      </div>

      {/* Document Main Title */}
      <div className="avoid-break text-center mb-6">
        <h1 className="print-section-title text-xl font-bold text-slate-900">
          محضر اجتماع رقم ({formatMinuteNumber(minute.minuteNumber)}) لسنة {toArabicNumerals(minute.year)}
        </h1>
        {minute.mainSubject && (
          <p className="text-sm font-semibold text-slate-700 mt-1">
            الموضوع الرئيسي: {toArabicNumerals(minute.mainSubject)}
          </p>
        )}
      </div>

      {/* Section 1: Meeting Metadata */}
      <section className="print-section mb-6 avoid-break">
        <h2 className="print-section-title text-sm font-bold text-slate-900 bg-slate-100 border border-slate-300 px-3 py-2 mb-0">
          أولاً: بيانات الاجتماع
        </h2>
        <table className="w-full border-collapse border border-slate-300 text-xs">
          <tbody>
            <tr>
              <th className="border border-slate-300 bg-slate-50 px-3 py-2 text-right font-bold w-1/6">
                رقم المحضر
              </th>
              <td className="border border-slate-300 px-3 py-2 font-mono-num w-2/6">
                {formatMinuteNumber(minute.minuteNumber)}
              </td>
              <th className="border border-slate-300 bg-slate-50 px-3 py-2 text-right font-bold w-1/6">
                سنة الاجتماع
              </th>
              <td className="border border-slate-300 px-3 py-2 font-mono-num w-2/6">
                {toArabicNumerals(minute.year)}
              </td>
            </tr>
            <tr>
              <th className="border border-slate-300 bg-slate-50 px-3 py-2 text-right font-bold">
                تاريخ الاجتماع
              </th>
              <td className="border border-slate-300 px-3 py-2 font-mono-num">
                {toArabicNumerals(minute.date) || '-'}
              </td>
              <th className="border border-slate-300 bg-slate-50 px-3 py-2 text-right font-bold">
                وقت الاجتماع
              </th>
              <td className="border border-slate-300 px-3 py-2 font-mono-num">
                {toArabicNumerals(minute.time) || '-'}
              </td>
            </tr>
            <tr>
              <th className="border border-slate-300 bg-slate-50 px-3 py-2 text-right font-bold">
                مكان الاجتماع
              </th>
              <td className="border border-slate-300 px-3 py-2">
                {toArabicNumerals(minute.location) || '-'}
              </td>
              <th className="border border-slate-300 bg-slate-50 px-3 py-2 text-right font-bold">
                موضوع الاجتماع الرئيسي
              </th>
              <td className="border border-slate-300 px-3 py-2">
                {toArabicNumerals(minute.mainSubject) || '-'}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Section 2: Participants */}
      <section className="print-section mb-6">
        <h2 className="print-section-title text-sm font-bold text-slate-900 bg-slate-100 border border-b-0 border-slate-300 px-3 py-2">
          ثانياً: جدول الحضور والمشاركين ({toArabicNumerals(participants.length)})
        </h2>
        <table className="w-full border-collapse border border-slate-300 text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-900">
              <th className="border border-slate-300 px-2.5 py-2 text-center w-10">م</th>
              <th className="border border-slate-300 px-3 py-2 text-right">الاسم</th>
              <th className="border border-slate-300 px-3 py-2 text-right">المسمى الوظيفي</th>
              <th className="border border-slate-300 px-3 py-2 text-center w-28">حالة الحضور</th>
              <th className="border border-slate-300 px-3 py-2 text-right">ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            {participants.length === 0 ? (
              <tr>
                <td colSpan={5} className="border border-slate-300 px-3 py-4 text-center text-slate-500">
                  لم يتم إدراج مشاركين في هذا المحضر
                </td>
              </tr>
            ) : (
              participants.map((p, index) => (
                <tr key={p.id}>
                  <td className="border border-slate-300 px-2.5 py-2 text-center font-mono-num">
                    {toArabicNumerals(index + 1)}
                  </td>
                  <td className="border border-slate-300 px-3 py-2 font-semibold">{toArabicNumerals(p.name)}</td>
                  <td className="border border-slate-300 px-3 py-2">{toArabicNumerals(p.jobTitle) || '-'}</td>
                  <td className="border border-slate-300 px-3 py-2 text-center font-semibold">
                    {getAttendanceLabel(p.attendanceStatus)}
                  </td>
                  <td className="border border-slate-300 px-3 py-2 whitespace-pre-wrap break-words">
                    {toArabicNumerals(p.notes) || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {/* Section 3: Inputs & Outcomes */}
      <section className="print-section mb-6">
        <h2 className="print-section-title text-sm font-bold text-slate-900 bg-slate-100 border border-b-0 border-slate-300 px-3 py-2">
          ثالثاً: مدخلات ونتائج الاجتماع مفصلة أدناه
        </h2>
        <table className="w-full border-collapse border border-slate-300 text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-900">
              <th className="border border-slate-300 px-2.5 py-2 text-center w-10">م</th>
              <th className="border border-slate-300 px-3 py-2 text-right w-1/4">الموضوع</th>
              <th className="border border-slate-300 px-3 py-2 text-right">التوصيات</th>
              <th className="border border-slate-300 px-3 py-2 text-right w-32">مسؤولية التنفيذ</th>
              <th className="border border-slate-300 px-3 py-2 text-center w-24">تاريخ التنفيذ</th>
              <th className="border border-slate-300 px-3 py-2 text-center w-24">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {outcomes.length === 0 ? (
              <tr>
                <td colSpan={6} className="border border-slate-300 px-3 py-4 text-center text-slate-500">
                  لا توجد مدخلات أو نتائج مسجلة في هذا القسم
                </td>
              </tr>
            ) : (
              outcomes.map((o, index) => {
                const completed = isCompletedTopicStatus(o.status);
                return (
                  <tr key={o.id} className={completed ? 'bg-emerald-50/80' : ''}>
                    <td className="border border-slate-300 px-2.5 py-2 text-center font-mono-num align-top">
                      {toArabicNumerals(index + 1)}
                    </td>
                    <td
                      className={`border border-slate-300 px-3 py-2 whitespace-pre-wrap break-words align-top font-semibold ${
                        completed ? 'text-emerald-950' : ''
                      }`}
                    >
                      {toArabicNumerals(o.subject)}
                    </td>
                    <td className="border border-slate-300 px-3 py-2 whitespace-pre-wrap break-words align-top">
                      {toArabicNumerals(o.recommendations)}
                    </td>
                    <td className="border border-slate-300 px-3 py-2 align-top">
                      {toArabicNumerals(o.responsiblePerson) || '-'}
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-center font-mono-num align-top">
                      {toArabicNumerals(o.executionDate) || '-'}
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-center align-top font-semibold">
                      {completed ? (
                        <span className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold">
                          <span>✓</span>
                          <span>{toArabicNumerals(o.status)}</span>
                        </span>
                      ) : (
                        toArabicNumerals(o.status) || '-'
                      )}
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
        <section className="print-section mb-6">
          <h2 className="print-section-title text-sm font-bold text-slate-900 bg-slate-100 border border-b-0 border-slate-300 px-3 py-2">
            رابعاً: المواضيع المستمرة
          </h2>
          <table className="w-full border-collapse border border-slate-300 text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-900">
                <th className="border border-slate-300 px-2.5 py-2 text-center w-10">م</th>
                <th className="border border-slate-300 px-3 py-2 text-right w-1/4">الموضوع</th>
                <th className="border border-slate-300 px-3 py-2 text-right">التوصيات</th>
                <th className="border border-slate-300 px-3 py-2 text-right w-32">مسؤولية التنفيذ</th>
                <th className="border border-slate-300 px-3 py-2 text-center w-24">تاريخ التنفيذ</th>
                <th className="border border-slate-300 px-3 py-2 text-center w-24">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {ongoingTopics.length === 0 ? (
                <tr>
                  <td colSpan={6} className="border border-slate-300 px-3 py-4 text-center text-slate-500">
                    لا توجد مواضيع مستمرة مسجلة في هذا القسم
                  </td>
                </tr>
              ) : (
                ongoingTopics.map((t, index) => {
                  const completed = isCompletedTopicStatus(t.topicStatus);
                  return (
                    <tr key={t.id} className={completed ? 'bg-emerald-50/80' : ''}>
                      <td className="border border-slate-300 px-2.5 py-2 text-center font-mono-num align-top">
                        {toArabicNumerals(index + 1)}
                      </td>
                      <td
                        className={`border border-slate-300 px-3 py-2 whitespace-pre-wrap break-words align-top font-semibold ${
                          completed ? 'text-emerald-950' : ''
                        }`}
                      >
                        <div>{toArabicNumerals(t.subject)}</div>
                        {t.sourceMinuteLabel && (
                          <div className="text-[10px] text-slate-500 mt-1">
                            مرحّل من: {toArabicNumerals(t.sourceMinuteLabel)}
                          </div>
                        )}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 whitespace-pre-wrap break-words align-top">
                        {toArabicNumerals(t.recommendationOrAction) || '-'}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 align-top">
                        {toArabicNumerals(t.followUpPerson) || '-'}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-mono-num align-top">
                        {toArabicNumerals(t.followUpDate) || '-'}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-center align-top font-semibold">
                        {completed ? (
                          <span className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold">
                            <span>✓</span>
                            <span>{toArabicNumerals(t.topicStatus)}</span>
                          </span>
                        ) : (
                          toArabicNumerals(t.topicStatus) || '-'
                        )}
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
        <section className="print-section mb-6">
          <h2 className="print-section-title text-sm font-bold text-slate-900 bg-slate-100 border border-b-0 border-slate-300 px-3 py-2">
            خامساً: المواضيع الجديدة
          </h2>
          <table className="w-full border-collapse border border-slate-300 text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-900">
                <th className="border border-slate-300 px-2.5 py-2 text-center w-10">م</th>
                <th className="border border-slate-300 px-3 py-2 text-right w-1/4">الموضوع</th>
                <th className="border border-slate-300 px-3 py-2 text-right">التوصيات</th>
                <th className="border border-slate-300 px-3 py-2 text-right w-32">مسؤولية التنفيذ</th>
                <th className="border border-slate-300 px-3 py-2 text-center w-24">تاريخ التنفيذ</th>
                <th className="border border-slate-300 px-3 py-2 text-center w-24">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {newTopics.length === 0 ? (
                <tr>
                  <td colSpan={6} className="border border-slate-300 px-3 py-4 text-center text-slate-500">
                    لا توجد مواضيع جديدة مسجلة في هذا القسم
                  </td>
                </tr>
              ) : (
                newTopics.map((n, index) => {
                  const completed = isCompletedTopicStatus(n.status);
                  return (
                    <tr key={n.id} className={completed ? 'bg-emerald-50/80' : ''}>
                      <td className="border border-slate-300 px-2.5 py-2 text-center font-mono-num align-top">
                        {toArabicNumerals(index + 1)}
                      </td>
                      <td
                        className={`border border-slate-300 px-3 py-2 whitespace-pre-wrap break-words align-top font-semibold ${
                          completed ? 'text-emerald-950' : ''
                        }`}
                      >
                        {toArabicNumerals(n.subject)}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 whitespace-pre-wrap break-words align-top">
                        {toArabicNumerals(n.recommendationsAndDecisions) || '-'}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 align-top">
                        {toArabicNumerals(n.responsiblePerson) || '-'}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-mono-num align-top">
                        {toArabicNumerals(n.executionDate) || '-'}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-center align-top font-semibold">
                        {completed ? (
                          <span className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold">
                            <span>✓</span>
                            <span>{toArabicNumerals(n.status)}</span>
                          </span>
                        ) : (
                          toArabicNumerals(n.status) || '-'
                        )}
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
        <section key={ct.id} className="print-section mb-6">
          <h2 className="print-section-title text-sm font-bold text-slate-900 bg-slate-100 border border-b-0 border-slate-300 px-3 py-2">
            {toArabicNumerals(ct.title)}
          </h2>
          <table className="w-full border-collapse border border-slate-300 text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-900">
                <th className="border border-slate-300 px-2.5 py-2 text-center w-10">م</th>
                <th className="border border-slate-300 px-3 py-2 text-right w-1/4">الموضوع</th>
                <th className="border border-slate-300 px-3 py-2 text-right">التوصيات</th>
                <th className="border border-slate-300 px-3 py-2 text-right w-32">مسؤولية التنفيذ</th>
                <th className="border border-slate-300 px-3 py-2 text-center w-24">تاريخ التنفيذ</th>
                <th className="border border-slate-300 px-3 py-2 text-center w-24">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {ct.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="border border-slate-300 px-3 py-4 text-center text-slate-500">
                    لا توجد بنود مسجلة في هذا الجدول
                  </td>
                </tr>
              ) : (
                ct.rows.map((row, index) => {
                  const completed = isCompletedTopicStatus(row.status);
                  return (
                    <tr key={row.id} className={completed ? 'bg-emerald-50/80' : ''}>
                      <td className="border border-slate-300 px-2.5 py-2 text-center font-mono-num align-top">
                        {toArabicNumerals(index + 1)}
                      </td>
                      <td
                        className={`border border-slate-300 px-3 py-2 whitespace-pre-wrap break-words align-top font-semibold ${
                          completed ? 'text-emerald-950' : ''
                        }`}
                      >
                        {toArabicNumerals(row.subject)}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 whitespace-pre-wrap break-words align-top">
                        {toArabicNumerals(row.recommendations) || '-'}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 align-top">
                        {toArabicNumerals(row.responsiblePerson) || '-'}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-center font-mono-num align-top">
                        {toArabicNumerals(row.executionDate) || '-'}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-center align-top font-semibold">
                        {completed ? (
                          <span className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold">
                            <span>✓</span>
                            <span>{toArabicNumerals(row.status)}</span>
                          </span>
                        ) : (
                          toArabicNumerals(row.status) || '-'
                        )}
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
      <section className="print-section mt-8 avoid-break">
        <h2 className="print-section-title text-sm font-bold text-slate-900 bg-slate-100 border border-b-0 border-slate-300 px-3 py-2">
          سادساً: الاعتماد والتوقيعات
        </h2>
        <div className="grid grid-cols-2 border border-slate-300 divide-x divide-x-reverse divide-slate-300 text-xs">
          {/* Secretary */}
          <div className="p-4 flex flex-col justify-between min-h-[150px]">
            <div>
              <p className="font-bold text-slate-900 text-sm mb-2">مقرر الاجتماع</p>
              <p className="text-slate-700">
                <span className="font-semibold">الاسم: </span>
                {toArabicNumerals(minute.secretaryName) || '........................................................'}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-dashed border-slate-300">
              <p className="font-semibold text-slate-700 mb-2">التوقيع:</p>
              {minute.secretarySignature ? (
                minute.secretarySignature.startsWith('data:image') ? (
                  <img
                    src={minute.secretarySignature}
                    alt="توقيع مقرر الاجتماع"
                    className="h-16 object-contain"
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
          <div className="p-4 flex flex-col justify-between min-h-[150px]">
            <div>
              <p className="font-bold text-slate-900 text-sm mb-2">رئيس الاجتماع</p>
              <p className="text-slate-700">
                <span className="font-semibold">الاسم: </span>
                {toArabicNumerals(minute.chairmanName) || '........................................................'}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-dashed border-slate-300">
              <p className="font-semibold text-slate-700 mb-2">التوقيع:</p>
              {minute.chairmanSignature ? (
                minute.chairmanSignature.startsWith('data:image') ? (
                  <img
                    src={minute.chairmanSignature}
                    alt="توقيع رئيس الاجتماع"
                    className="h-16 object-contain"
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
      <footer className="avoid-break mt-8 pt-3 border-t border-slate-300 flex items-center justify-between text-[11px] text-slate-500">
        <span>نظام ساعـد (SAAED) لإدارة محاضر الاجتماعات والأرشفة الرقمية</span>
        <span className="font-mono-num">
          محضر رقم ({formatMinuteNumber(minute.minuteNumber)}) لسنة {toArabicNumerals(minute.year)}
        </span>
      </footer>
    </div>
  );
};
