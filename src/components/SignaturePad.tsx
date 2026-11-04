import React, { useRef, useState, useEffect } from 'react';
import { Eraser, PenTool, Type, ImagePlus, Upload, CheckCircle2 } from 'lucide-react';

interface SignaturePadProps {
  label: string;
  nameValue: string;
  onNameChange: (val: string) => void;
  signatureValue: string;
  onSignatureChange: (val: string) => void;
  participantOptions: string[];
  disabled?: boolean;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  label,
  nameValue,
  onNameChange,
  signatureValue,
  onSignatureChange,
  participantOptions,
  disabled = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);

  const [mode, setMode] = useState<'draw' | 'upload' | 'text'>(() => {
    if (signatureValue && !signatureValue.startsWith('data:image')) {
      return 'text';
    }
    if (signatureValue && signatureValue.startsWith('data:image')) {
      return 'upload';
    }
    return 'upload';
  });

  useEffect(() => {
    if (mode === 'draw' && canvasRef.current && signatureValue.startsWith('data:image')) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        const img = new Image();
        img.onload = () => {
          if (!canvasRef.current) return;
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          const scale = Math.min(
            canvasRef.current.width / img.width,
            canvasRef.current.height / img.height,
            1
          );
          const drawW = img.width * scale;
          const drawH = img.height * scale;
          const offsetX = (canvasRef.current.width - drawW) / 2;
          const offsetY = (canvasRef.current.height - drawH) / 2;
          ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
        };
        img.src = signatureValue;
      }
    } else if (mode === 'draw' && canvasRef.current && !signatureValue) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  }, [signatureValue, mode]);

  const processSignatureImageFile = (file: File) => {
    setUploadError(null);
    if (!file.type.startsWith('image/')) {
      setUploadError('يرجى اختيار ملف صورة صالح (PNG, JPG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const resultStr = typeof reader.result === 'string' ? reader.result : '';
      if (!resultStr) {
        setUploadError('تعذر قراءة ملف الصورة.');
        return;
      }

      const img = new Image();
      img.onload = () => {
        const maxWidth = 440;
        const maxHeight = 160;
        const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
        const targetW = Math.max(1, Math.round(img.width * scale));
        const targetH = Math.max(1, Math.round(img.height * scale));

        const offCanvas = document.createElement('canvas');
        offCanvas.width = targetW;
        offCanvas.height = targetH;
        const ctx = offCanvas.getContext('2d');
        if (!ctx) {
          setUploadError('تعذر معالجة صورة التوقيع.');
          return;
        }

        ctx.clearRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);

        let finalDataUrl = offCanvas.toDataURL('image/png');
        // Ensure it fits safely within the 150,000 char Firestore rule limit
        if (finalDataUrl.length > 135000) {
          finalDataUrl = offCanvas.toDataURL('image/webp', 0.85);
        }
        if (finalDataUrl.length > 135000) {
          finalDataUrl = offCanvas.toDataURL('image/jpeg', 0.8);
        }

        setAttachedFileName(file.name);
        setMode('upload');
        onSignatureChange(finalDataUrl);
      };
      img.onerror = () => {
        setUploadError('ملف الصورة غير مدعوم أو تالف.');
      };
      img.src = resultStr;
    };
    reader.onerror = () => {
      setUploadError('حدث خطأ أثناء قراءة الملف المرفق.');
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSignatureImageFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSignatureImageFile(file);
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (canvasRef.current) {
      setAttachedFileName(null);
      onSignatureChange(canvasRef.current.toDataURL('image/png'));
    }
  };

  const clearSignature = () => {
    if (disabled) return;
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    setAttachedFileName(null);
    setUploadError(null);
    onSignatureChange('');
  };

  const datalistId = `sig-list-${label.replace(/\s+/g, '-')}`;

  return (
    <div className="border border-slate-200 bg-white p-5 rounded-lg">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
        <h4 className="text-base font-bold text-slate-900">{label}</h4>
        <span className="text-xs text-slate-500">إرفاق صورة توقيع أو رسم أو توقيع نصي</span>
      </div>

      {/* Hidden File Input for Signature Image Attachment */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/*"
        onChange={handleFileInputChange}
        className="hidden"
      />

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            الاسم (اختيار من المشاركين أو إدخال يدوي)
          </label>
          <input
            type="text"
            list={datalistId}
            value={nameValue}
            disabled={disabled}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={`أدخل اسم ${label} أو اختر من القائمة...`}
            className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-blue-700 disabled:bg-slate-100"
          />
          <datalist id={datalistId}>
            {participantOptions.map((name, i) => (
              <option key={`${name}-${i}`} value={name} />
            ))}
          </datalist>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <label className="block text-xs font-semibold text-slate-700">
              التوقيع (مرفق صورة / رسم إلكتروني / نصي)
            </label>
            {!disabled && (
              <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-0.5 rounded-md">
                <button
                  type="button"
                  onClick={() => setMode('upload')}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap shrink-0 transition-colors ${
                    mode === 'upload' ? 'bg-white text-blue-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  مرفق صورة
                </button>
                <button
                  type="button"
                  onClick={() => setMode('draw')}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap shrink-0 transition-colors ${
                    mode === 'draw' ? 'bg-white text-blue-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <PenTool className="w-3.5 h-3.5" />
                  رسم توقيع
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('text');
                    if (signatureValue.startsWith('data:image')) onSignatureChange('');
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap shrink-0 transition-colors ${
                    mode === 'text' ? 'bg-white text-blue-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Type className="w-3.5 h-3.5" />
                  توقيع نصي
                </button>
                {signatureValue && (
                  <button
                    type="button"
                    onClick={clearSignature}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 rounded whitespace-nowrap shrink-0"
                    title="مسح التوقيع"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    مسح
                  </button>
                )}
              </div>
            )}
          </div>

          {uploadError && (
            <div className="mb-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {uploadError}
            </div>
          )}

          {mode === 'upload' ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                if (!disabled) setIsDraggingOver(true);
              }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-md p-4 transition-colors flex flex-col items-center justify-center min-h-[148px] ${
                isDraggingOver
                  ? 'border-blue-600 bg-blue-50/60'
                  : 'border-slate-300 bg-slate-50/60'
              }`}
            >
              {signatureValue && signatureValue.startsWith('data:image') ? (
                <div className="w-full flex flex-col items-center">
                  <div className="bg-white border border-slate-200 rounded-md p-2.5 shadow-2xs max-w-full flex items-center justify-center">
                    <img
                      src={signatureValue}
                      alt={`توقيع ${label}`}
                      className="max-h-24 max-w-full object-contain"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {attachedFileName ? `تم إرفاق: ${attachedFileName}` : 'صورة التوقيع مرفقة'}
                    </span>
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1 text-xs font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded flex items-center gap-1"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        تغيير صورة التوقيع
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-200 text-blue-800 flex items-center justify-center mx-auto">
                    <ImagePlus className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-700">
                      أرفق صورة التوقيع الخاصة بـ ({label})
                    </p>
                    <p className="text-[11px] text-slate-500">
                      يدعم صور التوقيع بصيغة PNG أو JPG أو WEBP (أو اسحب الصورة وأفلتها هنا)
                    </p>
                  </div>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-1 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-800 hover:bg-blue-900 rounded-md shadow-2xs"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      اختيار صورة التوقيع من المرفقات
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : mode === 'draw' ? (
            <div className="relative border border-dashed border-slate-300 rounded-md bg-slate-50/60 flex flex-col items-center justify-center p-2">
              <canvas
                ref={canvasRef}
                width={380}
                height={120}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="bg-white border border-slate-200 rounded cursor-crosshair touch-none max-w-full"
              />
              <span className="text-[11px] text-slate-400 mt-1.5">
                ارسم التوقيع بالماوس أو اللمس داخل الإطار، أو اختر «مرفق صورة» لرفع صورة التوقيع
              </span>
            </div>
          ) : (
            <input
              type="text"
              value={signatureValue.startsWith('data:image') ? '' : signatureValue}
              disabled={disabled}
              onChange={(e) => onSignatureChange(e.target.value)}
              placeholder="اكتب عبارة الاعتماد أو التوقيع النصي (أو اتركه فارغاً للتوقيع اليدوي عند الطباعة)..."
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
          )}
        </div>
      </div>
    </div>
  );
};
