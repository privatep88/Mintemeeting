import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  ImageRun,
  AlignmentType,
  WidthType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  ShadingType,
} from 'docx';
import { saveAs } from 'file-saver';
import { FullMinuteBundle } from '../types/minutes';
import { toArabicNumerals, formatMinuteNumber } from './numerals';

const BORDER_COLOR = 'CBD5E1';
const HEADER_BG = 'F1F5F9';
const PRIMARY_COLOR = '1E3A8A';

function createRtlParagraph(
  text: string,
  options?: {
    bold?: boolean;
    size?: number;
    color?: string;
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    spacingAfter?: number;
    spacingBefore?: number;
  }
): Paragraph {
  const normalizedText = toArabicNumerals(text || '-');
  const lines = normalizedText.split('\n');
  const children: TextRun[] = [];
  lines.forEach((line, idx) => {
    children.push(
      new TextRun({
        text: line,
        bold: options?.bold ?? false,
        size: options?.size ?? 22, // 11pt
        color: options?.color ?? '0F172A',
        font: 'Arial',
        rightToLeft: true,
        break: idx > 0 ? 1 : undefined,
      })
    );
  });

  return new Paragraph({
    alignment: options?.alignment ?? AlignmentType.RIGHT,
    bidirectional: true,
    spacing: {
      before: options?.spacingBefore ?? 60,
      after: options?.spacingAfter ?? 60,
    },
    children,
  });
}

function createHeaderCell(text: string, widthPercent?: number): TableCell {
  return new TableCell({
    width: widthPercent ? { size: widthPercent, type: WidthType.PERCENTAGE } : undefined,
    shading: {
      fill: HEADER_BG,
      type: ShadingType.CLEAR,
      color: 'auto',
    },
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    children: [
      createRtlParagraph(text, {
        bold: true,
        size: 22,
        color: PRIMARY_COLOR,
        alignment: AlignmentType.CENTER,
      }),
    ],
  });
}

function createDataCell(
  text: string,
  alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.RIGHT
): TableCell {
  return new TableCell({
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [createRtlParagraph(text || '-', { size: 21, alignment })],
  });
}

function getAttendanceArabic(status: string): string {
  if (status === 'present') return 'حاضر';
  if (status === 'absent') return 'غائب';
  if (status === 'excused') return 'معتذر';
  return status;
}

export async function exportMinuteToDocx(bundle: FullMinuteBundle): Promise<void> {
  const { minute, participants, outcomes, ongoingTopics, newTopics } = bundle;

  const tableBorders = {
    top: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
    left: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
    right: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
    insideVertical: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
  };

  // 1. Meeting Info Table
  const infoTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    visuallyRightToLeft: true,
    borders: tableBorders,
    rows: [
      new TableRow({
        children: [
          createHeaderCell('رقم المحضر', 18),
          createDataCell(`${formatMinuteNumber(minute.minuteNumber)} / ${minute.year}`, AlignmentType.CENTER),
          createHeaderCell('سنة الاجتماع', 18),
          createDataCell(String(minute.year), AlignmentType.CENTER),
        ],
      }),
      new TableRow({
        children: [
          createHeaderCell('تاريخ الاجتماع', 18),
          createDataCell(minute.date || '-', AlignmentType.CENTER),
          createHeaderCell('وقت الاجتماع', 18),
          createDataCell(minute.time || '-', AlignmentType.CENTER),
        ],
      }),
      new TableRow({
        children: [
          createHeaderCell('مكان الاجتماع', 18),
          createDataCell(minute.location || '-'),
          createHeaderCell('موضوع الاجتماع الرئيسي', 18),
          createDataCell(minute.mainSubject || '-'),
        ],
      }),
    ],
  });

  // 2. Participants Table
  const participantRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        createHeaderCell('م', 8),
        createHeaderCell('الاسم', 30),
        createHeaderCell('المسمى الوظيفي', 27),
        createHeaderCell('حالة الحضور', 15),
        createHeaderCell('ملاحظات', 20),
      ],
    }),
  ];

  if (participants.length === 0) {
    participantRows.push(
      new TableRow({
        children: [
          createDataCell('-', AlignmentType.CENTER),
          createDataCell('لا يوجد مشاركون مسجلون'),
          createDataCell('-'),
          createDataCell('-', AlignmentType.CENTER),
          createDataCell('-'),
        ],
      })
    );
  } else {
    participants.forEach((p, idx) => {
      participantRows.push(
        new TableRow({
          children: [
            createDataCell(String(idx + 1), AlignmentType.CENTER),
            createDataCell(p.name),
            createDataCell(p.jobTitle),
            createDataCell(getAttendanceArabic(p.attendanceStatus), AlignmentType.CENTER),
            createDataCell(p.notes || '-'),
          ],
        })
      );
    });
  }

  const participantsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    visuallyRightToLeft: true,
    borders: tableBorders,
    rows: participantRows,
  });

  // 3. Inputs & Outcomes Table
  const outcomeRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        createHeaderCell('م', 7),
        createHeaderCell('الموضوع', 30),
        createHeaderCell('التوصيات', 33),
        createHeaderCell('مسؤولية التنفيذ', 17),
        createHeaderCell('تاريخ التنفيذ', 13),
      ],
    }),
  ];

  if (outcomes.length === 0) {
    outcomeRows.push(
      new TableRow({
        children: [
          createDataCell('-', AlignmentType.CENTER),
          createDataCell('لا توجد مدخلات أو نتائج مسجلة'),
          createDataCell('-'),
          createDataCell('-'),
          createDataCell('-', AlignmentType.CENTER),
        ],
      })
    );
  } else {
    outcomes.forEach((o, idx) => {
      outcomeRows.push(
        new TableRow({
          children: [
            createDataCell(String(idx + 1), AlignmentType.CENTER),
            createDataCell(o.subject),
            createDataCell(o.recommendations),
            createDataCell(o.responsiblePerson),
            createDataCell(o.executionDate || '-', AlignmentType.CENTER),
          ],
        })
      );
    });
  }

  const outcomesTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    visuallyRightToLeft: true,
    borders: tableBorders,
    rows: outcomeRows,
  });

  // 4. Ongoing Topics Table
  const ongoingRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        createHeaderCell('م', 7),
        createHeaderCell('الموضوع', 30),
        createHeaderCell('التوصيات', 33),
        createHeaderCell('مسؤولية التنفيذ', 17),
        createHeaderCell('تاريخ التنفيذ', 13),
      ],
    }),
  ];

  if (ongoingTopics.length === 0) {
    ongoingRows.push(
      new TableRow({
        children: [
          createDataCell('-', AlignmentType.CENTER),
          createDataCell('لا توجد مواضيع مستمرة مسجلة'),
          createDataCell('-'),
          createDataCell('-'),
          createDataCell('-', AlignmentType.CENTER),
        ],
      })
    );
  } else {
    ongoingTopics.forEach((t, idx) => {
      ongoingRows.push(
        new TableRow({
          children: [
            createDataCell(String(idx + 1), AlignmentType.CENTER),
            createDataCell(t.subject + (t.sourceMinuteLabel ? `\n[من: ${t.sourceMinuteLabel}]` : '')),
            createDataCell(t.recommendationOrAction),
            createDataCell(t.followUpPerson),
            createDataCell(t.followUpDate || '-', AlignmentType.CENTER),
          ],
        })
      );
    });
  }

  const ongoingTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    visuallyRightToLeft: true,
    borders: tableBorders,
    rows: ongoingRows,
  });

  // 5. New Topics Table
  const newTopicRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        createHeaderCell('م', 7),
        createHeaderCell('الموضوع', 30),
        createHeaderCell('التوصيات', 33),
        createHeaderCell('مسؤولية التنفيذ', 17),
        createHeaderCell('تاريخ التنفيذ', 13),
      ],
    }),
  ];

  if (newTopics.length === 0) {
    newTopicRows.push(
      new TableRow({
        children: [
          createDataCell('-', AlignmentType.CENTER),
          createDataCell('لا توجد مواضيع جديدة مسجلة'),
          createDataCell('-'),
          createDataCell('-'),
          createDataCell('-', AlignmentType.CENTER),
        ],
      })
    );
  } else {
    newTopics.forEach((n, idx) => {
      newTopicRows.push(
        new TableRow({
          children: [
            createDataCell(String(idx + 1), AlignmentType.CENTER),
            createDataCell(n.subject),
            createDataCell(n.recommendationsAndDecisions),
            createDataCell(n.responsiblePerson),
            createDataCell(n.executionDate || '-', AlignmentType.CENTER),
          ],
        })
      );
    });
  }

  const newTopicsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    visuallyRightToLeft: true,
    borders: tableBorders,
    rows: newTopicRows,
  });

  const buildSignatureParagraphs = (name: string, sig: string): Paragraph[] => {
    const paragraphs: Paragraph[] = [
      createRtlParagraph(`الاسم: ${name || '........................................'}`, {
        bold: true,
      }),
    ];

    if (sig && sig.startsWith('data:image')) {
      try {
        const commaIndex = sig.indexOf(',');
        const base64Data = commaIndex !== -1 ? sig.slice(commaIndex + 1) : '';
        const binaryString = window.atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        paragraphs.push(
          createRtlParagraph('التوقيع:', { spacingBefore: 160, spacingAfter: 40 }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            bidirectional: true,
            spacing: { before: 40, after: 60 },
            children: [
              new ImageRun({
                data: bytes,
                transformation: {
                  width: 150,
                  height: 55,
                },
                type: 'png',
              }),
            ],
          })
        );
        return paragraphs;
      } catch {
        // Fallback if base64 decoding fails
      }
    }

    paragraphs.push(
      createRtlParagraph(
        `التوقيع: ${
          sig && !sig.startsWith('data:image')
            ? sig
            : sig
            ? '[توقيع إلكتروني معتمد]'
            : '........................................'
        }`,
        { spacingBefore: 240 }
      )
    );
    return paragraphs;
  };

  // 6. Signatures Table
  const signaturesTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    visuallyRightToLeft: true,
    borders: tableBorders,
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          createHeaderCell('مقرر الاجتماع', 50),
          createHeaderCell('رئيس الاجتماع', 50),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            margins: { top: 140, bottom: 260, left: 160, right: 160 },
            children: buildSignatureParagraphs(minute.secretaryName, minute.secretarySignature),
          }),
          new TableCell({
            margins: { top: 140, bottom: 260, left: 160, right: 160 },
            children: buildSignatureParagraphs(minute.chairmanName, minute.chairmanSignature),
          }),
        ],
      }),
    ],
  });

  const customDocxElements: (Paragraph | Table)[] = [];
  (bundle.customTables ?? []).forEach((ct) => {
    const ctRows: TableRow[] = [
      new TableRow({
        tableHeader: true,
        children: [
          createHeaderCell('م', 7),
          createHeaderCell('الموضوع', 30),
          createHeaderCell('التوصيات', 33),
          createHeaderCell('مسؤولية التنفيذ', 17),
          createHeaderCell('تاريخ التنفيذ', 13),
        ],
      }),
    ];

    if (ct.rows.length === 0) {
      ctRows.push(
        new TableRow({
          children: [
            createDataCell('-', AlignmentType.CENTER),
            createDataCell('لا توجد بنود مسجلة في هذا الجدول'),
            createDataCell('-'),
            createDataCell('-'),
            createDataCell('-', AlignmentType.CENTER),
          ],
        })
      );
    } else {
      ct.rows.forEach((r, idx) => {
        ctRows.push(
          new TableRow({
            children: [
              createDataCell(String(idx + 1), AlignmentType.CENTER),
              createDataCell(r.subject),
              createDataCell(r.recommendations),
              createDataCell(r.responsiblePerson),
              createDataCell(r.executionDate || '-', AlignmentType.CENTER),
            ],
          })
        );
      });
    }

    customDocxElements.push(
      createRtlParagraph(ct.title, {
        bold: true,
        size: 26,
        color: PRIMARY_COLOR,
        spacingBefore: 260,
        spacingAfter: 100,
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        visuallyRightToLeft: true,
        borders: tableBorders,
        rows: ctRows,
      })
    );
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        headers: {
          default: new Header({
            children: [
              createRtlParagraph(
                `ساعـد (SAAED) — محضر اجتماع رقم (${formatMinuteNumber(minute.minuteNumber)}) لسنة ${minute.year}`,
                {
                  bold: true,
                  size: 18,
                  color: '475569',
                  alignment: AlignmentType.CENTER,
                }
              ),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                bidirectional: true,
                children: [
                  new TextRun({
                    text: 'صفحة ',
                    font: 'Arial',
                    size: 18,
                    rightToLeft: true,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: 'Arial',
                    size: 18,
                  }),
                  new TextRun({
                    text: ' من ',
                    font: 'Arial',
                    size: 18,
                    rightToLeft: true,
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    font: 'Arial',
                    size: 18,
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          createRtlParagraph('محضر اجتماع رسمي', {
            bold: true,
            size: 32,
            color: PRIMARY_COLOR,
            alignment: AlignmentType.CENTER,
            spacingAfter: 180,
          }),
          createRtlParagraph('أولاً: بيانات الاجتماع', {
            bold: true,
            size: 26,
            color: PRIMARY_COLOR,
            spacingBefore: 160,
            spacingAfter: 100,
          }),
          infoTable,

          createRtlParagraph('ثانياً: جدول الحضور والمشاركين', {
            bold: true,
            size: 26,
            color: PRIMARY_COLOR,
            spacingBefore: 260,
            spacingAfter: 100,
          }),
          participantsTable,

          createRtlParagraph('ثالثاً: مدخلات ونتائج الاجتماع مفصلة أدناه', {
            bold: true,
            size: 26,
            color: PRIMARY_COLOR,
            spacingBefore: 260,
            spacingAfter: 100,
          }),
          outcomesTable,

          ...(bundle.showOngoingTable !== false
            ? [
                createRtlParagraph('رابعاً: المواضيع المستمرة', {
                  bold: true,
                  size: 26,
                  color: PRIMARY_COLOR,
                  spacingBefore: 260,
                  spacingAfter: 100,
                }),
                ongoingTable,
              ]
            : []),

          ...(bundle.showNewTopicsTable !== false
            ? [
                createRtlParagraph('خامساً: المواضيع الجديدة', {
                  bold: true,
                  size: 26,
                  color: PRIMARY_COLOR,
                  spacingBefore: 260,
                  spacingAfter: 100,
                }),
                newTopicsTable,
              ]
            : []),

          ...customDocxElements,

          createRtlParagraph('سادساً: الاعتماد والتوقيعات', {
            bold: true,
            size: 26,
            color: PRIMARY_COLOR,
            spacingBefore: 260,
            spacingAfter: 100,
          }),
          signaturesTable,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `محضر_اجتماع_${formatMinuteNumber(minute.minuteNumber)}_لسنة_${minute.year}.docx`);
}
