import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Bus, Users, MessageCircle, LogOut, Home, Star, Eye, EyeOff,
  CheckCircle2, RefreshCw, Loader2, AlertCircle, User, Send,
  ChevronRight, Camera, PhoneCall, Play, Square, MapPin, Siren,
  Clock, UserX, Navigation, ShieldCheck, ShieldAlert,
} from "lucide-react";
import { supabase } from "./supabaseClient";

/*
  Bybus — تطبيق المشرفة
  =========================
  الحساب نفسه (بريد + كلمة مرور) بتسجله الإدارة مسبقاً — مفيش شاشة تسجيل حساب
  جديد هنا خالص. بعد الدخول، بتتطلب خطوة تحقق بالصورة (مش بديل عن كلمة
  المرور، خطوة إضافية بعد الدخول) — مايمنعش الرحلة لو الصورة معملتش match،
  بس بيتسجل تنبيه للإدارة تراجعه.

  ⚠️ ملاحظة أمانة مهمة: مقارنة الصورة هنا حالياً بسيطة (Pixel similarity على
  المتصفح مباشرة، بدون أي مكتبة تانية ومن غير رفع لأي سيرفر خارجي) — مش
  "تعرف على الوجه" حقيقي بمعايير الدقة العالية. دي بداية مجانية 100% تخدم
  الفكرة (تنبيه الإدارة لو في اختلاف واضح جداً) لحد ما نستبدلها بمكتبة
  تعرف على وجوه حقيقية زي face-api.js أو MediaPipe لاحقاً بنفس الفلسفة
  (بصفر جنيه). مذكور في README كبند Backlog.
*/

const COLORS = {
  sun: "#FFC93C",
  sky: "#4FB6E8",
  mint: "#4ECDC4",
  orange: "#FF8C42",
  danger: "#EF4444",
};

const TS_STATUS_LABELS = {
  pending: { label: "منتظر", color: "#9CA3AF" },
  boarded: { label: "صعد", color: COLORS.sky },
  dropped_off: { label: "نزل", color: COLORS.mint },
  absent: { label: "غائب", color: COLORS.danger },
  delayed: { label: "متأخر", color: COLORS.orange },
};

function todayStr() {
  return new Date().toLocaleDateString("en-CA");
}

// المسافة بين نقطتين بالكيلومتر (Haversine)
function distanceKm(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return Infinity;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function BybusMark({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect x="4" y="16" width="56" height="34" rx="14" fill={COLORS.sky} />
      <rect x="10" y="22" width="14" height="12" rx="4" fill="white" />
      <rect x="28" y="22" width="14" height="12" rx="4" fill="white" />
      <circle cx="18" cy="52" r="6" fill="#2D3436" />
      <circle cx="46" cy="52" r="6" fill="#2D3436" />
      <path d="M14 40 Q 20 46 26 40" stroke="#2D3436" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <circle cx="15" cy="30" r="2" fill="#2D3436" />
      <circle cx="35" cy="30" r="2" fill="#2D3436" />
      <rect x="46" y="24" width="10" height="16" rx="4" fill={COLORS.sun} />
    </svg>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-10 text-gray-300">
      <Loader2 size={22} className="animate-spin" />
    </div>
  );
}

function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div className="mx-4 flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl p-3 mb-3">
      <AlertCircle size={16} className="shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  );
}

function TopBar({ title, subtitle, right }) {
  return (
    <div className="flex items-center justify-between px-4 pt-5 pb-3">
      <div>
        <h1 className="text-lg font-bold text-gray-800">{title}</h1>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

/* ================= شاشة تسجيل الدخول ================= */

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("من فضلك أدخلي البريد الإلكتروني وكلمة المرور");
      return;
    }
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw new Error("البريد الإلكتروني أو كلمة المرور غير صحيحة");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", authData.user.id)
        .single();

      if (profileError || !profile || profile.role !== "supervisor") {
        await supabase.auth.signOut();
        throw new Error("هذا الحساب مش حساب مشرفة — الحساب ده بتسجله الإدارة فقط");
      }
      // باقي الشغل هيتم أوتوماتيك عن طريق onAuthStateChange في App
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 px-4" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="rounded-3xl p-4 mb-3" style={{ backgroundColor: "#EAF6FC" }}>
            <BybusMark size={56} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Bybus</h1>
          <p className="text-gray-400 text-sm mt-1">تطبيق المشرفة</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl p-3 mb-4">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <label className="block text-sm font-medium text-gray-600 mb-1.5">البريد الإلكتروني</label>
          <input
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="supervisor@bybus.app"
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 mb-4 text-sm text-left focus:outline-none focus:ring-2 focus:ring-sky-300"
          />

          <label className="block text-sm font-medium text-gray-600 mb-1.5">كلمة المرور</label>
          <div className="relative mb-6">
            <input
              type={showPw ? "text" : "password"}
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-left focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
            <button type="button" onClick={() => setShowPw(!showPw)} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-3 text-white font-semibold text-sm transition-transform active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70"
            style={{ backgroundColor: COLORS.orange }}
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? "جارٍ التحقق..." : "تسجيل الدخول"}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          بيانات الدخول بتوصلك من إدارة Bybus — لو نسيتي كلمة المرور تواصلي معاهم مباشرة
        </p>
      </div>
    </div>
  );
}

/* ================= خطوة التحقق بالصورة بعد الدخول ================= */

// تحميل صورة (من URL أو من blob) كـ ImageData مصغّرة 24x24 رمادية للمقارنة السريعة
async function imageToGraySignature(source) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = url;
  });
  const size = 24;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  const gray = new Array(size * size);
  for (let i = 0; i < gray.length; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    gray[i] = (r + g + b) / 3;
  }
  if (typeof source !== "string") URL.revokeObjectURL(url);
  return gray;
}

function similarityScore(sigA, sigB) {
  if (!sigA || !sigB || sigA.length !== sigB.length) return 0;
  let diffSum = 0;
  for (let i = 0; i < sigA.length; i++) diffSum += Math.abs(sigA[i] - sigB[i]);
  const avgDiff = diffSum / sigA.length; // 0..255
  return Math.max(0, 1 - avgDiff / 255); // 0..1 (1 = مطابقة تامة)
}

function FaceCheckScreen({ profile, bus, onDone }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [phase, setPhase] = useState("starting"); // starting | ready | captured | uploading | done | error
  const [error, setError] = useState("");
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [capturedUrl, setCapturedUrl] = useState(null);
  const [resultNote, setResultNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setPhase("ready");
      } catch (err) {
        setError("تعذر الوصول للكاميرا (" + err.message + "). تقدري تكملي من غير الخطوة دي، وهيتسجل تنبيه للإدارة.");
        setPhase("error");
      }
    }
    startCamera();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        setCapturedBlob(blob);
        setCapturedUrl(URL.createObjectURL(blob));
        setPhase("captured");
        streamRef.current?.getTracks().forEach((t) => t.stop());
      },
      "image/jpeg",
      0.85
    );
  }

  async function retake() {
    setCapturedBlob(null);
    setCapturedUrl(null);
    setPhase("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPhase("ready");
    } catch (err) {
      setError("تعذر الوصول للكاميرا مرة تانية.");
      setPhase("error");
    }
  }

  async function raiseAlert(message) {
    try {
      await supabase.from("alerts").insert({
        type: "face_mismatch",
        raised_by: profile.id,
        bus_id: bus?.id || null,
        message,
      });
    } catch {
      // فشل تسجيل التنبيه مش لازم يوقف دخول المشرفة أبداً
    }
  }

  async function confirmAndUpload() {
    setPhase("uploading");
    setError("");
    try {
      const path = `${profile.id}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from("supervisor-faces").upload(path, capturedBlob, {
        contentType: "image/jpeg",
      });
      if (uploadError) throw uploadError;

      if (!profile.face_reference_url) {
        setResultNote("تم رفع الصورة بنجاح. لسه معندكيش صورة مرجعية معتمدة من الإدارة، فتم تسجيل هذه المحاولة لمراجعتها.");
        await raiseAlert("أول صورة تحقق للمشرفة — لا توجد صورة مرجعية معتمدة بعد، بانتظار اعتماد الإدارة. مسار الصورة: " + path);
      } else {
        const { data: signedRef, error: signError } = await supabase.storage
          .from("supervisor-faces")
          .createSignedUrl(profile.face_reference_url, 300);
        if (signError || !signedRef?.signedUrl) {
          setResultNote("تم رفع الصورة، بس تعذر تحميل الصورة المرجعية للمقارنة. تم تنبيه الإدارة.");
          await raiseAlert("تعذر تحميل الصورة المرجعية للمقارنة (مشكلة وصول للملف). مسار الصورة الجديدة: " + path);
          setPhase("done");
          return;
        }
        const [refSig, newSig] = await Promise.all([
          imageToGraySignature(signedRef.signedUrl).catch(() => null),
          imageToGraySignature(capturedBlob),
        ]);
        const score = similarityScore(refSig, newSig);
        if (score < 0.55) {
          setResultNote("الصورة لسه اتسجلت، بس فيه اختلاف واضح عن الصورة المرجعية. الرحلة مش هتتمنع، وتم تنبيه الإدارة للمراجعة.");
          await raiseAlert(`عدم تطابق صورة الدخول اليومية (نسبة تشابه تقريبية: ${(score * 100).toFixed(0)}%). مسار الصورة: ${path}`);
        } else {
          setResultNote("تم التحقق من الصورة بنجاح ✓");
        }
      }
      setPhase("done");
    } catch (err) {
      setError(err.message || "حصل خطأ أثناء رفع صورة التحقق");
      setPhase("error");
    }
  }

  async function skipStep() {
    await raiseAlert("تخطّت المشرفة خطوة التحقق بالصورة بعد الدخول (تعذر الوصول للكاميرا أو مشكلة تقنية).");
    onDone();
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 px-4 py-8" dir="rtl">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col items-center mb-4">
          <div className="rounded-2xl p-3 mb-2" style={{ backgroundColor: "#EAF6FC" }}>
            <ShieldCheck size={28} color={COLORS.sky} />
          </div>
          <h2 className="text-base font-bold text-gray-800">خطوة تحقق سريعة</h2>
          <p className="text-xs text-gray-400 mt-1 text-center">
            لقطة سريعة لوجهك للتأكد إنك اللي داخلة فعلاً. الخطوة دي متمنعش دخولك أبداً حتى لو حصل خطأ.
          </p>
        </div>

        {error && phase !== "done" && <ErrorBanner message={error} />}

        <div className="rounded-2xl overflow-hidden bg-gray-100 mb-4" style={{ aspectRatio: "1/1" }}>
          {phase === "captured" || phase === "uploading" || phase === "done" ? (
            capturedUrl && <img src={capturedUrl} alt="لقطة التحقق" className="w-full h-full object-cover" />
          ) : phase === "error" ? (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              <ShieldAlert size={40} />
            </div>
          ) : (
            <video ref={videoRef} muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
          )}
        </div>

        {phase === "done" && (
          <div className="flex items-start gap-2 bg-green-50 border border-green-100 text-green-700 text-xs rounded-xl p-3 mb-4">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            <span>{resultNote}</span>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {phase === "ready" && (
            <button
              onClick={capture}
              className="w-full rounded-xl py-3 text-white font-semibold text-sm flex items-center justify-center gap-2"
              style={{ backgroundColor: COLORS.sky }}
            >
              <Camera size={16} /> التقاط الصورة
            </button>
          )}

          {phase === "captured" && (
            <>
              <button
                onClick={confirmAndUpload}
                className="w-full rounded-xl py-3 text-white font-semibold text-sm flex items-center justify-center gap-2"
                style={{ backgroundColor: COLORS.orange }}
              >
                <CheckCircle2 size={16} /> تأكيد الصورة والمتابعة
              </button>
              <button onClick={retake} className="w-full rounded-xl py-2.5 text-sm font-semibold border border-gray-200 text-gray-500">
                إعادة الالتقاط
              </button>
            </>
          )}

          {phase === "uploading" && (
            <div className="w-full rounded-xl py-3 text-white font-semibold text-sm flex items-center justify-center gap-2 opacity-80" style={{ backgroundColor: COLORS.orange }}>
              <Loader2 size={16} className="animate-spin" /> جارٍ الرفع والتحقق...
            </div>
          )}

          {phase === "done" && (
            <button
              onClick={onDone}
              className="w-full rounded-xl py-3 text-white font-semibold text-sm flex items-center justify-center gap-2"
              style={{ backgroundColor: COLORS.mint }}
            >
              الدخول للتطبيق
            </button>
          )}

          {(phase === "error" || phase === "starting") && phase !== "uploading" && (
            <button onClick={skipStep} className="w-full rounded-xl py-2.5 text-sm font-semibold border border-gray-200 text-gray-500">
              تخطي الخطوة دلوقتي
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================= الرحلة الحالية (الصفحة الرئيسية) ================= */

function SosButton({ profile, bus, tripId }) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);

  async function sendSos() {
    setSending(true);
    try {
      await supabase.from("alerts").insert({
        type: "sos",
        raised_by: profile.id,
        bus_id: bus?.id || null,
        trip_id: tripId || null,
        message: note.trim() || "استغاثة فورية من المشرفة",
      });
      setSent(true);
    } catch (err) {
      // حتى لو فشل التسجيل، السيناريو الحقيقي بيعتمد على رقم الطوارئ الهاتفي كبديل
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 left-4 z-30 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg"
        style={{ backgroundColor: COLORS.danger }}
        title="استغاثة SOS"
      >
        <Siren size={24} />
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4" dir="rtl">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            {!sent ? (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <Siren size={20} color={COLORS.danger} />
                  <h3 className="font-bold text-gray-800 text-base">إرسال استغاثة للإدارة</h3>
                </div>
                <p className="text-xs text-gray-400 mb-3">هيوصل تنبيه فوري لكل الإدارة. استخدميها في أي حالة طارئة حقيقية بس.</p>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="وصف مختصر للحالة (اختياري)"
                  rows={3}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-200"
                />
                <div className="flex gap-2">
                  <button onClick={() => setOpen(false)} className="flex-1 rounded-xl py-2.5 text-sm font-semibold border border-gray-200 text-gray-500">
                    إلغاء
                  </button>
                  <button
                    onClick={sendSos}
                    disabled={sending}
                    className="flex-1 rounded-xl py-2.5 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-70"
                    style={{ backgroundColor: COLORS.danger }}
                  >
                    {sending && <Loader2 size={14} className="animate-spin" />}
                    إرسال الآن
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3 text-green-600">
                  <CheckCircle2 size={20} />
                  <h3 className="font-bold text-base">تم إرسال الاستغاثة للإدارة</h3>
                </div>
                <button
                  onClick={() => {
                    setOpen(false);
                    setSent(false);
                    setNote("");
                  }}
                  className="w-full rounded-xl py-2.5 text-white text-sm font-bold"
                  style={{ backgroundColor: COLORS.sky }}
                >
                  تمام
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function StudentStopCard({ ts, distKm, onMark, onPhoto, uploadingPhoto }) {
  const student = ts.students;
  const statusInfo = TS_STATUS_LABELS[ts.status] || { label: ts.status, color: "#9CA3AF" };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-3.5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0" style={{ backgroundColor: COLORS.sun }}>
          {student?.full_name?.trim().slice(0, 2) || "؟"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-gray-800 truncate">{student?.full_name}{student?.grade ? ` · ${student.grade}` : ""}</div>
          <div className="text-xs text-gray-400 truncate">
            {student?.home_address_text || "بدون عنوان نصي"}
            {Number.isFinite(distKm) && distKm !== Infinity ? ` · على بعد ${distKm.toFixed(1)} كم` : ""}
          </div>
        </div>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0" style={{ backgroundColor: statusInfo.color + "20", color: statusInfo.color }}>
          {statusInfo.label}
        </span>
      </div>

      <div className="flex gap-1.5 mt-3 flex-wrap">
        {ts.status === "pending" && (
          <button onClick={() => onMark(ts, "boarded")} className="flex-1 min-w-[80px] rounded-lg py-2 text-[11px] font-bold text-white" style={{ backgroundColor: COLORS.sky }}>
            صعد الباص
          </button>
        )}
        {ts.status === "boarded" && (
          <button onClick={() => onMark(ts, "dropped_off")} className="flex-1 min-w-[80px] rounded-lg py-2 text-[11px] font-bold text-white" style={{ backgroundColor: COLORS.mint }}>
            نزل
          </button>
        )}
        {(ts.status === "pending" || ts.status === "boarded") && (
          <>
            <button onClick={() => onMark(ts, "absent")} className="rounded-lg py-2 px-2.5 text-[11px] font-bold border border-gray-200 text-gray-500 flex items-center gap-1">
              <UserX size={12} /> غياب
            </button>
            {ts.status === "pending" && (
              <button onClick={() => onMark(ts, "delayed")} className="rounded-lg py-2 px-2.5 text-[11px] font-bold border border-gray-200 text-gray-500 flex items-center gap-1">
                <Clock size={12} /> تأخير
              </button>
            )}
          </>
        )}
        <button
          onClick={() => onPhoto(ts)}
          disabled={uploadingPhoto === ts.id}
          className="rounded-lg py-2 px-2.5 text-[11px] font-bold border border-gray-200 text-gray-500 flex items-center gap-1 disabled:opacity-50"
        >
          {uploadingPhoto === ts.id ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
        </button>
      </div>
    </div>
  );
}

function HomePage({ profile }) {
  const [bus, setBus] = useState(null);
  const [trips, setTrips] = useState([]);
  const [currentTrip, setCurrentTrip] = useState(null);
  const [tripStudents, setTripStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [gpsLoc, setGpsLoc] = useState(null);
  const [startingTrip, setStartingTrip] = useState(false);
  const [endingTrip, setEndingTrip] = useState(false);
  const [uploadingPhotoFor, setUploadingPhotoFor] = useState(null);
  const fileInputRef = useRef(null);
  const pendingPhotoTs = useRef(null);

  const loadData = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const { data: busData, error: busError } = await supabase
        .from("buses")
        .select("id, bus_code, plate_number, vehicle_model, company_name, is_active")
        .eq("supervisor_id", profile.id)
        .maybeSingle();
      if (busError) throw busError;
      setBus(busData);
      if (!busData) {
        setTrips([]);
        setCurrentTrip(null);
        setTripStudents([]);
        return;
      }

      const today = todayStr();
      const { data: tripsData, error: tripsError } = await supabase
        .from("trips")
        .select("id, trip_type, status, scheduled_time, started_at, ended_at, current_lat, current_lng")
        .eq("bus_id", busData.id)
        .eq("trip_date", today)
        .order("scheduled_time", { ascending: true });
      if (tripsError) throw tripsError;
      setTrips(tripsData || []);

      const active = (tripsData || []).find((t) => t.status === "active");
      const next = (tripsData || [])
        .filter((t) => t.status === "scheduled" || t.status === "delayed")
        .sort((a, b) => (a.scheduled_time > b.scheduled_time ? 1 : -1))[0];
      const theTrip = active || next || null;
      setCurrentTrip(theTrip);

      if (theTrip) {
        const { data: tsData, error: tsError } = await supabase
          .from("trip_students")
          .select("id, status, absence_type, photo_url, checked_at, stop_order, students(id, full_name, grade, home_lat, home_lng, home_address_text)")
          .eq("trip_id", theTrip.id);
        if (tsError) throw tsError;
        setTripStudents(tsData || []);
      } else {
        setTripStudents([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!bus) return;
    const channel = supabase
      .channel("supervisor-home-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "trips", filter: `bus_id=eq.${bus.id}` }, () => loadData(true))
      .on("postgres_changes", { event: "*", schema: "public", table: "trip_students" }, () => loadData(true))
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [bus, loadData]);

  function getLocationOnce() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  async function handleStartTrip() {
    if (!currentTrip) return;
    setStartingTrip(true);
    setError("");
    try {
      const loc = await getLocationOnce();
      const { error: updateError } = await supabase
        .from("trips")
        .update({
          status: "active",
          started_at: new Date().toISOString(),
          current_lat: loc?.lat ?? null,
          current_lng: loc?.lng ?? null,
          location_updated_at: loc ? new Date().toISOString() : null,
        })
        .eq("id", currentTrip.id);
      if (updateError) throw updateError;

      // حضور المشرفة تلقائي: تسجيل وقت الحضور لو لسه معملتش تسجيل النهاردة
      const today = todayStr();
      const { data: existingAttendance } = await supabase
        .from("staff_attendance")
        .select("id, check_in_at")
        .eq("staff_id", profile.id)
        .eq("work_date", today)
        .maybeSingle();
      if (!existingAttendance) {
        await supabase.from("staff_attendance").insert({ staff_id: profile.id, work_date: today, check_in_at: new Date().toISOString() });
      } else if (!existingAttendance.check_in_at) {
        await supabase.from("staff_attendance").update({ check_in_at: new Date().toISOString() }).eq("id", existingAttendance.id);
      }

      loadData(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setStartingTrip(false);
    }
  }

  async function handleEndTrip() {
    if (!currentTrip) return;
    setEndingTrip(true);
    setError("");
    try {
      const { error: updateError } = await supabase
        .from("trips")
        .update({ status: "completed", ended_at: new Date().toISOString() })
        .eq("id", currentTrip.id);
      if (updateError) throw updateError;

      const today = todayStr();
      await supabase
        .from("staff_attendance")
        .update({ check_out_at: new Date().toISOString() })
        .eq("staff_id", profile.id)
        .eq("work_date", today);

      loadData(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setEndingTrip(false);
    }
  }

  async function handleUpdateLocationNow() {
    if (!currentTrip || currentTrip.status !== "active") return;
    const loc = await getLocationOnce();
    if (!loc) return;
    await supabase
      .from("trips")
      .update({ current_lat: loc.lat, current_lng: loc.lng, location_updated_at: new Date().toISOString() })
      .eq("id", currentTrip.id);
    loadData(true);
  }

  async function handleMarkStudent(ts, newStatus) {
    try {
      const payload = { status: newStatus, checked_at: new Date().toISOString() };
      if (newStatus === "absent") payload.absence_type = "on_route";
      const { error: updateError } = await supabase.from("trip_students").update(payload).eq("id", ts.id);
      if (updateError) throw updateError;
      setTripStudents((prev) => prev.map((t) => (t.id === ts.id ? { ...t, ...payload } : t)));
    } catch (err) {
      setError(err.message);
    }
  }

  function openPhotoCapture(ts) {
    pendingPhotoTs.current = ts;
    fileInputRef.current?.click();
  }

  async function handlePhotoSelected(e) {
    const file = e.target.files?.[0];
    const ts = pendingPhotoTs.current;
    e.target.value = "";
    if (!file || !ts || !currentTrip) return;
    setUploadingPhotoFor(ts.id);
    try {
      const path = `${currentTrip.id}/${ts.students?.id || ts.id}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from("trip-photos").upload(path, file, { contentType: file.type || "image/jpeg" });
      if (uploadError) throw uploadError;
      const { data: pub } = supabase.storage.from("trip-photos").getPublicUrl(path);
      await supabase.from("trip_students").update({ photo_url: pub?.publicUrl || path, checked_at: new Date().toISOString() }).eq("id", ts.id);
      loadData(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingPhotoFor(null);
    }
  }

  const counts = tripStudents.reduce(
    (acc, ts) => {
      acc.total++;
      if (ts.status === "boarded") acc.boarded++;
      else if (ts.status === "dropped_off") acc.dropped++;
      else if (ts.status === "absent") acc.absent++;
      else acc.pending++;
      return acc;
    },
    { total: 0, boarded: 0, dropped: 0, absent: 0, pending: 0 }
  );

  const busLat = currentTrip?.current_lat ?? gpsLoc?.lat;
  const busLng = currentTrip?.current_lng ?? gpsLoc?.lng;

  const sortedStops = [...tripStudents]
    .filter((ts) => ts.status === "pending" || ts.status === "boarded")
    .map((ts) => ({ ts, dist: distanceKm(busLat, busLng, ts.students?.home_lat, ts.students?.home_lng) }))
    .sort((a, b) => a.dist - b.dist);

  const doneStops = tripStudents.filter((ts) => ts.status === "dropped_off" || ts.status === "absent" || ts.status === "delayed");

  useEffect(() => {
    if (!currentTrip || currentTrip.status !== "active") return;
    getLocationOnce().then((loc) => loc && setGpsLoc(loc));
    const interval = setInterval(() => {
      handleUpdateLocationNow();
    }, 45000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrip?.id, currentTrip?.status]);

  return (
    <div className="pb-4">
      <TopBar
        title={`أهلاً، ${profile.full_name?.split(" ")[0] || ""}`}
        subtitle={bus ? `${bus.bus_code} · ${bus.plate_number}` : "لسه مفيش باص مرتبط بحسابك"}
        right={
          <button onClick={() => loadData(true)} disabled={refreshing} className="rounded-xl border border-gray-200 p-2 text-gray-500 disabled:opacity-50">
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          </button>
        }
      />

      <ErrorBanner message={error} />

      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoSelected} />

      <div className="px-4">
        {loading ? (
          <Spinner />
        ) : !bus ? (
          <div className="text-center py-14 text-sm text-gray-400 bg-white rounded-2xl border border-gray-100">
            لسه معندكيش باص مسجّل على حسابك — تواصلي مع إدارة Bybus
          </div>
        ) : !currentTrip ? (
          <div className="text-center py-14 text-sm text-gray-400 bg-white rounded-2xl border border-gray-100">
            مفيش رحلة مجدولة النهاردة على باصك دلوقتي
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg p-2" style={{ backgroundColor: COLORS.sky + "18" }}>
                    <Bus size={18} color={COLORS.sky} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-800">{currentTrip.trip_type === "morning" ? "رحلة الذهاب" : "رحلة العودة"}</div>
                    <div className="text-xs text-gray-400">الموعد {currentTrip.scheduled_time?.slice(0, 5)}</div>
                  </div>
                </div>
                <span
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                  style={{
                    backgroundColor: (currentTrip.status === "active" ? COLORS.mint : "#9CA3AF") + "20",
                    color: currentTrip.status === "active" ? COLORS.mint : "#6B7280",
                  }}
                >
                  {currentTrip.status === "active" ? "الرحلة شغالة" : currentTrip.status === "delayed" ? "متأخرة" : "لسه ما بدأتش"}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 mb-4 text-center">
                <div className="bg-gray-50 rounded-xl py-2">
                  <div className="text-sm font-bold text-gray-700">{counts.total}</div>
                  <div className="text-[10px] text-gray-400">الكل</div>
                </div>
                <div className="bg-gray-50 rounded-xl py-2">
                  <div className="text-sm font-bold" style={{ color: COLORS.mint }}>{counts.boarded + counts.dropped}</div>
                  <div className="text-[10px] text-gray-400">مغادرين</div>
                </div>
                <div className="bg-gray-50 rounded-xl py-2">
                  <div className="text-sm font-bold" style={{ color: "#9CA3AF" }}>{counts.pending}</div>
                  <div className="text-[10px] text-gray-400">منتظرين</div>
                </div>
                <div className="bg-gray-50 rounded-xl py-2">
                  <div className="text-sm font-bold" style={{ color: COLORS.danger }}>{counts.absent}</div>
                  <div className="text-[10px] text-gray-400">غائبين</div>
                </div>
              </div>

              {currentTrip.status !== "active" ? (
                <button
                  onClick={handleStartTrip}
                  disabled={startingTrip}
                  className="w-full rounded-xl py-3 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-70"
                  style={{ backgroundColor: COLORS.orange }}
                >
                  {startingTrip ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                  بدء الرحلة
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleUpdateLocationNow}
                    className="rounded-xl px-3.5 py-3 text-sm font-semibold border border-gray-200 text-gray-500 flex items-center gap-1.5"
                    title="تحديث الموقع الآن"
                  >
                    <Navigation size={16} />
                  </button>
                  <button
                    onClick={handleEndTrip}
                    disabled={endingTrip}
                    className="flex-1 rounded-xl py-3 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-70"
                    style={{ backgroundColor: COLORS.danger }}
                  >
                    {endingTrip ? <Loader2 size={16} className="animate-spin" /> : <Square size={16} />}
                    إنهاء الرحلة
                  </button>
                </div>
              )}
              {currentTrip.status === "active" && (
                <div className="text-[11px] text-gray-400 mt-2 flex items-center gap-1.5">
                  <MapPin size={12} />
                  {currentTrip.current_lat ? "بيتم تحديث الموقع تلقائياً كل شوية" : "لسه مفيش موقع GPS محدث"}
                </div>
              )}
            </div>

            <div className="mb-2 text-xs font-bold text-gray-400 px-1">
              محطات الطلاب {busLat != null ? "(الأقرب أولاً)" : "(بالترتيب المسجّل)"}
            </div>
            <div className="flex flex-col gap-2 mb-4">
              {sortedStops.length === 0 ? (
                <div className="text-center py-8 text-xs text-gray-400 bg-white rounded-2xl border border-gray-100">
                  مفيش طلاب منتظرين دلوقتي
                </div>
              ) : (
                sortedStops.map(({ ts, dist }) => (
                  <StudentStopCard
                    key={ts.id}
                    ts={ts}
                    distKm={busLat != null ? dist : Infinity}
                    onMark={handleMarkStudent}
                    onPhoto={openPhotoCapture}
                    uploadingPhoto={uploadingPhotoFor}
                  />
                ))
              )}
            </div>

            {doneStops.length > 0 && (
              <>
                <div className="mb-2 text-xs font-bold text-gray-400 px-1">تم التعامل معهم</div>
                <div className="flex flex-col gap-2">
                  {doneStops.map((ts) => (
                    <StudentStopCard key={ts.id} ts={ts} distKm={Infinity} onMark={handleMarkStudent} onPhoto={openPhotoCapture} uploadingPhoto={uploadingPhotoFor} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {bus && <SosButton profile={profile} bus={bus} tripId={currentTrip?.id} />}
    </div>
  );
}

/* ================= صفحة الدردشة ================= */

function ChatThread({ conversationId, profile, onBack }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const loadThread = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [convRes, msgsRes] = await Promise.all([
        supabase
          .from("conversations")
          .select("id, type, status, bus_id, participant_a_id, profiles!conversations_participant_a_id_fkey(full_name)")
          .eq("id", conversationId)
          .single(),
        supabase.from("messages").select("id, sender_id, content, created_at").eq("conversation_id", conversationId).order("created_at", { ascending: true }),
      ]);
      if (convRes.error) throw convRes.error;
      if (msgsRes.error) throw msgsRes.error;
      setConversation(convRes.data);
      setMessages(msgsRes.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    loadThread();
    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, () => loadThread())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [conversationId, loadThread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend(e) {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setSending(true);
    setError("");
    try {
      const { error: sendError } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: profile.id,
        content: newMessage.trim(),
      });
      if (sendError) throw sendError;
      setNewMessage("");
      loadThread();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="p-4 border-b border-gray-100 flex items-center gap-2">
        <button onClick={onBack} className="text-gray-400"><ChevronRight size={20} /></button>
        <div className="font-semibold text-gray-700 text-sm">
          {conversation?.type === "support" ? "الدعم الفني" : conversation?.profiles?.full_name || "ولي أمر"}
        </div>
      </div>

      <ErrorBanner message={error} />

      <div className="flex-1 overflow-auto p-4 flex flex-col gap-2">
        {loading ? (
          <Spinner />
        ) : messages.length === 0 ? (
          <div className="text-center text-xs text-gray-400 py-6">ابدئي المحادثة بإرسال أول رسالة</div>
        ) : (
          messages.map((m) => {
            const fromMe = m.sender_id === profile.id;
            return (
              <div
                key={m.id}
                className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${fromMe ? "self-end text-white" : "self-start bg-gray-100 text-gray-700"}`}
                style={fromMe ? { backgroundColor: COLORS.sky } : {}}
              >
                {m.content}
                <div className={`text-[10px] mt-1 ${fromMe ? "text-white/70" : "text-gray-400"}`}>
                  {new Date(m.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="p-4 border-t border-gray-100 flex gap-2">
        <input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="اكتبي رسالتك..."
          className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
        />
        <button
          type="submit"
          disabled={sending || !newMessage.trim()}
          className="rounded-xl px-4 text-white text-sm font-bold disabled:opacity-50"
          style={{ backgroundColor: COLORS.orange }}
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </form>
    </div>
  );
}

function ChatPage({ profile, bus }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [starting, setStarting] = useState(false);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let query = supabase
        .from("conversations")
        .select("id, type, status, bus_id, participant_a_id, updated_at, profiles!conversations_participant_a_id_fkey(full_name)")
        .order("updated_at", { ascending: false });

      if (bus?.id) {
        query = query.or(`and(type.eq.parent_supervisor,bus_id.eq.${bus.id}),and(type.eq.support,participant_a_id.eq.${profile.id})`);
      } else {
        query = query.eq("type", "support").eq("participant_a_id", profile.id);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setConversations(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [bus?.id, profile.id]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  async function startSupportChat() {
    setStarting(true);
    setError("");
    try {
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("type", "support")
        .eq("participant_a_id", profile.id)
        .eq("status", "open")
        .maybeSingle();

      let convId = existing?.id;
      if (!convId) {
        const { data: created, error: createError } = await supabase
          .from("conversations")
          .insert({ type: "support", participant_a_id: profile.id })
          .select("id")
          .single();
        if (createError) throw createError;
        convId = created.id;
      }
      await loadConversations();
      setSelectedId(convId);
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  }

  if (selectedId) {
    return <ChatThread conversationId={selectedId} profile={profile} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="pb-4">
      <TopBar title="الدردشة" subtitle={`${conversations.length} محادثة`} />
      <ErrorBanner message={error} />

      <div className="px-4 mb-3">
        <button
          onClick={startSupportChat}
          disabled={starting}
          className="w-full rounded-2xl py-3 text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-70"
          style={{ backgroundColor: COLORS.orange }}
        >
          {starting && <Loader2 size={14} className="animate-spin" />}
          + تواصل مع الدعم الفني
        </button>
      </div>

      <div className="px-4">
        {loading ? (
          <Spinner />
        ) : conversations.length === 0 ? (
          <div className="text-center py-14 text-sm text-gray-400 bg-white rounded-2xl border border-gray-100">
            مفيش محادثات لسه — هتظهر هنا أول ما ولي أمر يبدأ محادثة معاكي
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className="w-full text-right flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-gray-100 hover:bg-gray-50"
              >
                <div className="rounded-lg p-2.5 shrink-0" style={{ backgroundColor: (c.type === "support" ? COLORS.orange : COLORS.sky) + "18" }}>
                  <MessageCircle size={16} color={c.type === "support" ? COLORS.orange : COLORS.sky} />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-700">
                    {c.type === "support" ? "الدعم الفني" : c.profiles?.full_name || "ولي أمر"}
                  </div>
                  <div className="text-[11px] text-gray-400">{c.status === "open" ? "مفتوحة" : "مقفولة"}</div>
                </div>
                <ChevronRight size={18} className="text-gray-300 shrink-0 rotate-180" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ================= صفحة حسابي ================= */

function ChangePasswordForm() {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 6) {
      setError("كلمة المرور لازم تكون 6 حروف/أرقام على الأقل");
      return;
    }
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSaved(true);
      setPassword("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {error && <ErrorBanner message={error} />}
      {saved && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-100 text-green-600 text-xs rounded-xl p-3">
          <CheckCircle2 size={16} className="shrink-0" /> تم تغيير كلمة المرور
        </div>
      )}
      <input
        type="password"
        dir="ltr"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="كلمة المرور الجديدة"
        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-left focus:outline-none focus:ring-2 focus:ring-sky-300"
      />
      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-xl py-2.5 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-70"
        style={{ backgroundColor: COLORS.sky }}
      >
        {saving && <Loader2 size={16} className="animate-spin" />}
        تغيير كلمة المرور
      </button>
    </form>
  );
}

function LeaveRequestForm({ employee }) {
  const [form, setForm] = useState({ start_date: "", end_date: "", reason: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!employee?.id) {
      setError("لسه معندكيش سجل موظف مربوط بالحساب، تواصلي مع الإدارة");
      return;
    }
    if (!form.start_date || !form.end_date) {
      setError("لازم تحددي تاريخ بداية ونهاية الإجازة");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { error: insertError } = await supabase.from("leave_requests").insert({
        employee_id: employee.id,
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason || null,
        status: "pending",
      });
      if (insertError) throw insertError;
      setSaved(true);
      setForm({ start_date: "", end_date: "", reason: "" });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {error && <ErrorBanner message={error} />}
      {saved && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-100 text-green-600 text-xs rounded-xl p-3">
          <CheckCircle2 size={16} className="shrink-0" /> تم إرسال طلب الإجازة للإدارة للمراجعة
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <input type="date" dir="ltr" className={inputClass + " text-left"} value={form.start_date} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} />
        <input type="date" dir="ltr" className={inputClass + " text-left"} value={form.end_date} onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))} />
      </div>
      <input className={inputClass} placeholder="السبب (اختياري)" value={form.reason} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))} />
      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-xl py-2.5 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-70"
        style={{ backgroundColor: COLORS.sky }}
      >
        {saving && <Loader2 size={16} className="animate-spin" />}
        إرسال طلب الإجازة
      </button>
    </form>
  );
}

function AccountPage({ profile, bus }) {
  const [employee, setEmployee] = useState(null);
  const [stats, setStats] = useState({ tripsCompleted: 0, avgRating: null, ratingsCount: 0 });
  const [supportPhone, setSupportPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState("profile");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [empRes, settingsRes] = await Promise.all([
          supabase.from("employees").select("id, employee_code, job_title, employment_status, hire_date").eq("profile_id", profile.id).maybeSingle(),
          supabase.from("app_settings").select("support_phone").single(),
        ]);
        setEmployee(empRes.data || null);
        setSupportPhone(settingsRes.data?.support_phone || "");

        if (bus?.id) {
          const [tripsRes, ratingsRes] = await Promise.all([
            supabase.from("trips").select("id", { count: "exact", head: true }).eq("bus_id", bus.id).eq("status", "completed"),
            supabase.from("ratings").select("stars").eq("bus_id", bus.id),
          ]);
          const ratings = ratingsRes.data || [];
          setStats({
            tripsCompleted: tripsRes.count || 0,
            avgRating: ratings.length ? (ratings.reduce((s, r) => s + r.stars, 0) / ratings.length).toFixed(1) : null,
            ratingsCount: ratings.length,
          });
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [profile.id, bus?.id]);

  const tabs = [
    { key: "profile", label: "بياناتي" },
    { key: "leave", label: "طلب إجازة" },
  ];

  return (
    <div className="pb-4">
      <TopBar title="حسابي" subtitle={profile.full_name} />

      <div className="px-4 flex gap-2 mb-4 overflow-auto no-scrollbar">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setSection(t.key)}
            className="rounded-full px-4 py-2 text-xs font-bold shrink-0"
            style={section === t.key ? { backgroundColor: COLORS.sky, color: "white" } : { backgroundColor: "#F3F4F6", color: "#6B7280" }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4">
        {loading ? (
          <Spinner />
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            {section === "profile" && (
              <div className="flex flex-col gap-5">
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-xs text-gray-600 flex flex-col gap-1.5">
                  <div>الاسم: {profile.full_name}</div>
                  <div dir="ltr" className="text-right">التليفون: {profile.phone || "—"}</div>
                  {employee?.employee_code && <div dir="ltr" className="text-right">كود الموظف: {employee.employee_code}</div>}
                  {employee?.job_title && <div>المسمى الوظيفي: {employee.job_title}</div>}
                  {bus && (
                    <>
                      <div>الباص: {bus.bus_code} · {bus.plate_number}</div>
                      {bus.company_name && <div>الشركة: {bus.company_name}</div>}
                    </>
                  )}
                  <div className="text-[10px] text-gray-400 mt-1">تعديل البيانات الأساسية من صلاحية الإدارة فقط.</div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <div className="text-lg font-bold text-gray-700">{stats.tripsCompleted}</div>
                    <div className="text-[10px] text-gray-400">رحلة منجزة</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 text-center flex flex-col items-center">
                    <div className="flex items-center gap-1">
                      <Star size={14} color={COLORS.sun} fill={COLORS.sun} />
                      <span className="text-lg font-bold text-gray-700">{stats.avgRating ?? "—"}</span>
                    </div>
                    <div className="text-[10px] text-gray-400">{stats.ratingsCount} تقييم</div>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-4">
                  <div className="text-xs font-bold text-gray-400 mb-3">تغيير كلمة المرور</div>
                  <ChangePasswordForm />
                </div>
              </div>
            )}

            {section === "leave" && <LeaveRequestForm employee={employee} />}
          </div>
        )}

        {supportPhone && (
          <a href={`tel:${supportPhone}`} className="mt-3 w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold border border-gray-200 text-gray-600">
            <PhoneCall size={16} /> اتصال بالدعم الفني ({supportPhone})
          </a>
        )}

        <button
          onClick={() => supabase.auth.signOut()}
          className="mt-3 w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-red-500 border border-red-100 bg-red-50"
        >
          <LogOut size={16} /> تسجيل الخروج
        </button>
      </div>
    </div>
  );
}

/* ================= الهيكل الرئيسي (Bottom Nav) ================= */

function BottomNav({ page, setPage }) {
  const items = [
    { key: "home", label: "الرئيسية", icon: Home },
    { key: "chat", label: "الدردشة", icon: MessageCircle },
    { key: "account", label: "حسابي", icon: User },
  ];
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 flex items-stretch z-40" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {items.map((it) => {
        const Icon = it.icon;
        const active = page === it.key;
        return (
          <button key={it.key} onClick={() => setPage(it.key)} className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5">
            <Icon size={20} color={active ? COLORS.sky : "#9CA3AF"} />
            <span className="text-[10px] font-bold" style={{ color: active ? COLORS.sky : "#9CA3AF" }}>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function Dashboard({ profile }) {
  const [page, setPage] = useState("home");
  const [bus, setBus] = useState(null);

  useEffect(() => {
    async function loadBus() {
      const { data } = await supabase.from("buses").select("id, bus_code, plate_number, company_name").eq("supervisor_id", profile.id).maybeSingle();
      setBus(data || null);
    }
    loadBus();
  }, [profile.id]);

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div style={{ paddingBottom: 70 }}>
        {page === "home" && <HomePage profile={profile} />}
        {page === "chat" && <ChatPage profile={profile} bus={bus} />}
        {page === "account" && <AccountPage profile={profile} bus={bus} />}
      </div>
      <BottomNav page={page} setPage={setPage} />
    </div>
  );
}

/* ================= الجذر ================= */

export default function App() {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [bus, setBus] = useState(null);
  const [faceChecked, setFaceChecked] = useState(false);

  useEffect(() => {
    async function loadProfileForSession(currentSession) {
      if (!currentSession) {
        setSession(null);
        setProfile(null);
        return;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, role, face_reference_url")
        .eq("id", currentSession.user.id)
        .single();

      if (error || !data || data.role !== "supervisor") {
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
        return;
      }
      setProfile(data);
      setSession(currentSession);

      const { data: busData } = await supabase.from("buses").select("id").eq("supervisor_id", data.id).maybeSingle();
      setBus(busData || null);

      const flagKey = `bybus_face_checked_${data.id}`;
      setFaceChecked(sessionStorage.getItem(flagKey) === "1");
    }

    supabase.auth.getSession().then(({ data }) => loadProfileForSession(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      loadProfileForSession(currentSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  function handleFaceCheckDone() {
    if (profile) sessionStorage.setItem(`bybus_face_checked_${profile.id}`, "1");
    setFaceChecked(true);
  }

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-300 text-sm">جارٍ التحقق من الجلسة...</div>
      </div>
    );
  }

  if (!session || !profile) return <LoginScreen />;

  if (!faceChecked) {
    return <FaceCheckScreen profile={profile} bus={bus} onDone={handleFaceCheckDone} />;
  }

  return <Dashboard profile={profile} />;
}
