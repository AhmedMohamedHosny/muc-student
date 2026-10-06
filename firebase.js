/**
 * MUC Student Attendance Client Module
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
    getAuth, 
    signInAnonymously 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc,
    setDoc,
    collection,
    runTransaction, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { CONFIG } from "./config.js";

const app = initializeApp(CONFIG.firebase);
export const auth = getAuth(app);
export const db = getFirestore(app);

function getLocalDeviceId() {
    try {
        let id = localStorage.getItem("muc_device_id");
        if (!id) {
            id = Array.from(window.crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, "0")).join("");
            localStorage.setItem("muc_device_id", id);
        }
        return id;
    } catch (e) {
        return "dev" + Date.now();
    }
}


export async function recordStudentAttendance(sessionId, clientToken, studentIdInput, deviceId) {
    const cleanedStudentId = String(studentIdInput).trim();
    if (!cleanedStudentId) throw new Error("يرجى إدخال الرقم الجامعي.");
    if (cleanedStudentId.includes("/")) throw new Error("الرقم الجامعي غير صالح.");

    if (!auth.currentUser) await signInAnonymously(auth);

    const safeDeviceId = String(deviceId || getLocalDeviceId()).replace(/[^a-zA-Z0-9_-]/g, "");
    const sessionRef = doc(db, "attendance_sessions", sessionId);
    const recordId = `${sessionId}_${cleanedStudentId}`;
    const recordRef = doc(db, "attendance_records", recordId);
    const deviceRef = doc(db, "attendance_devices", `${sessionId}_${safeDeviceId}`);

    try {
        return await runTransaction(db, async (transaction) => {
            const sessionDoc = await transaction.get(sessionRef);
            if (!sessionDoc.exists()) throw new Error("جلسة الحضور غير موجودة أو تم إنهاؤها.");
            const sessionData = sessionDoc.data();
            if (sessionData.status !== "active") throw new Error("جلسة الحضور مغلقة حالياً من قبل أستاذ المادة.");

            // جلب بيانات الطالب المراد تسجيله
            const studentDoc = await transaction.get(doc(db, "students", cleanedStudentId));
            if (!studentDoc.exists()) {
                throw new Error(`الرقم الجامعي (${cleanedStudentId}) غير مقيد بقاعدة البيانات.`);
            }
            const studentData = studentDoc.data();

// ========================================================
            // 1. فحص الحضور المكرر (موقوف مؤقتاً للتجربة والاختبار)
            // ========================================================
            /*
            const deviceDoc = await transaction.get(deviceRef);
            if (deviceDoc.exists()) {
                const prevStudentId = deviceDoc.data().studentId;
                if (prevStudentId === cleanedStudentId) {
                    throw new Error(`تم تسجيل حضورك مسبقاً يا ${studentData.name}.`);
                }
                const err = new Error("DEVICE_DUPLICATE");
                err.originalStudentId = prevStudentId;
                err.targetStudentId = cleanedStudentId;
                err.targetStudentName = studentData.name;
                throw err;
            }

            const existing = await transaction.get(recordRef);
            if (existing.exists()) throw new Error(`تم تسجيل حضورك مسبقاً يا ${studentData.name}.`);
            */

            // ========================================================
            // 2. الفحص الثاني: فحص سكرين شوت متأخر (جهاز جديد برمز قديم)
            // ========================================================
            const t = sessionData.currentToken || {};
            if (!clientToken || (t.token !== clientToken && t.prevToken !== clientToken)) {
                const err = new Error("QR_EXPIRED");
                err.studentId = cleanedStudentId;
                err.studentName = studentData.name;
                throw err;
            }

            if (!(studentData.enrolledCourses || []).includes(sessionData.courseId)) {
                throw new Error(`عفواً يا ${studentData.name}، أنت غير مقيد في هذا المقرر.`);
            }

            if (sessionData.hostRole === "ta") {
                const secInfo = (studentData.sections || {})[sessionData.courseId] || {};
                const studentGroup = typeof secInfo === "string" ? secInfo : (secInfo.group || secInfo.groupName || "جروب 1");
                const sessionGroup = sessionData.group || "جروب 1";

                const stdNum = (studentGroup.match(/\d+/) || ["1"])[0];
                const sessNum = (sessionGroup.match(/\d+/) || ["1"])[0];

                let isAssigned = false;
                if (stdNum === sessNum) isAssigned = true;
                if (!isAssigned && secInfo.taId && secInfo.taId === sessionData.doctorId) isAssigned = true;
                if (!isAssigned && (!sessionData.group || sessionData.group === "")) isAssigned = true;

                if (!isAssigned) {
                    throw new Error(`عفواً يا ${studentData.name}، أنت مقيد في (جروب ${stdNum}) وهذا السكشن خاص بطلاب (جروب ${sessNum}).`);
                }
            }

            const startTime = sessionData.startTime ? sessionData.startTime.toDate() : new Date();
            const diffMinutes = (Date.now() - startTime.getTime()) / 60000;
            const status = diffMinutes > (sessionData.lateThresholdMinutes || CONFIG.attendance.lateThresholdMinutes)
                ? CONFIG.attendance.statuses.LATE
                : CONFIG.attendance.statuses.PRESENT;

            transaction.set(recordRef, {
                recordId: recordId,
                sessionId: sessionId,
                courseId: sessionData.courseId,
                courseName: sessionData.courseName,
                studentId: cleanedStudentId,
                sessionType: sessionData.sessionType || "lecture",
                studentName: studentData.name,
                academicYear: studentData.academicYear || "1",
                deviceId: safeDeviceId,
                token: clientToken,
                status: status,
                recordedAt: serverTimestamp(),
                method: "QR_SCAN"
            });

            // ربط الهاتف بـ ID الطالب الأول
            transaction.set(deviceRef, {
                sessionId: sessionId,
                deviceId: safeDeviceId,
                studentId: cleanedStudentId,
                createdAt: serverTimestamp()
            });

            const now = new Date();
            return {
                success: true,
                studentName: studentData.name,
                studentId: cleanedStudentId,
                courseName: sessionData.courseName,
                status: status,
                sessionType: sessionData.sessionType || "lecture",
                date: now.toLocaleDateString("ar-EG", { year: 'numeric', month: 'long', day: 'numeric' }),
                time: now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })
            };
        });
    } catch (err) {
// ==========================================
        // 🚨 رادار التنبيهات (تم إيقافه مؤقتاً بكومنت)
        // ==========================================
        /*
        // سيناريو 1: تسجيل زميل من نفس الهاتف
        if (err.message === "DEVICE_DUPLICATE") {
            try {
                let origName = err.originalStudentId;
                const origSnap = await getDoc(doc(db, "students", err.originalStudentId));
                if (origSnap.exists()) origName = origSnap.data().name;

                await setDoc(doc(collection(db, "attendance_alerts")), {
                    sessionId: sessionId,
                    type: "SAME_DEVICE",
                    originalStudentId: err.originalStudentId,
                    originalStudentName: origName,
                    targetStudentId: err.targetStudentId,
                    targetStudentName: err.targetStudentName,
                    createdAt: serverTimestamp()
                });
            } catch (e) { console.warn("Alert log error:", e); }
            throw new Error("⚠️ تنبيه أمني: تم تسجيل حضور مسبقاً من هذا الهاتف لطالب آخر! تم إبلاغ شاشة المحاضرة بمحاولة التسجيل لزميلك.");
        }

        // سيناريو 2: استخدام صورة قديمة من هاتف متأخر
        if (err.message === "QR_EXPIRED") {
            try {
                await setDoc(doc(collection(db, "attendance_alerts")), {
                    sessionId: sessionId,
                    type: "EXPIRED_SCREENSHOT",
                    targetStudentId: err.studentId,
                    targetStudentName: err.studentName || err.studentId,
                    createdAt: serverTimestamp()
                });
            } catch (e) { console.warn("Alert log error:", e); }
            throw new Error("رمز QR انتهت مدته (سكرين شوت قديمة). يرجى مسح الرمز الحي المحدث من الشاشة.");
        }
        */

        // رسائل خطأ عادية وبسيطة للطالب بدون إرسال أي تنبيهات للشاشة:
        if (err.message === "DEVICE_DUPLICATE") {
            throw new Error("عفواً، تم تسجيل الحضور مسبقاً من هذا الهاتف.");
        }
        if (err.message === "QR_EXPIRED") {
            throw new Error("انتهت صلاحية الرمز، يرجى مسح الباركود الجديد من الشاشة.");
        }

        throw err;
    }
}
// ==========================================
// 📴 محرك حفظ ومزامنة الحضور أوفلاين (إضافة جديدة)
// ==========================================

// 1. تسجيل الحضور محلياً داخل ذاكرة الهاتف عند انقطاع الشبكة
export async function queueOfflineAttendance({ studentId, studentName, sessionId, courseId, courseName, timeSlot, hash }) {
    const queue = JSON.parse(localStorage.getItem("muc_pending_records") || "[]");
    
    // منع تكرار نفس الطالب لنفس الجلسة
    const exists = queue.some(q => q.sessionId === sessionId && q.studentId === studentId);
    if (exists) throw new Error("تم تسجيل حضورك لهذه المحاضرة بالفعل ومحفوظ على هاتفك!");

    const record = {
        studentId: String(studentId).trim(),
        studentName: studentName || "طالب",
        sessionId: sessionId,
        courseId: courseId || "MUC_COURSE",
        courseName: courseName || "المقرر الدراسي",
        timeSlot: timeSlot,
        hash: hash,
        deviceId: getLocalDeviceId(),
        scannedAt: Date.now()
    };

    queue.push(record);
    localStorage.setItem("muc_pending_records", JSON.stringify(queue));

    // إذا وُجد إنترنت حالياً يرفعه فوراً
    if (navigator.onLine) {
        syncPendingAttendance();
    }

    return record;
}

// 2. محرك المزامنة التلقائي مع Firestore أول ما الهاتف يلقط شبكة
export async function syncPendingAttendance() {
    if (!navigator.onLine) return;
    const queue = JSON.parse(localStorage.getItem("muc_pending_records") || "[]");
    if (queue.length === 0) return;

    if (!auth.currentUser) {
        try { await signInAnonymously(auth); } catch (e) { return; }
    }

    const remaining = [];
    for (const item of queue) {
        try {
            const recordId = `${item.sessionId}_${item.studentId}`;
            await setDoc(doc(db, "attendance_records", recordId), {
                recordId: recordId,
                sessionId: item.sessionId,
                courseId: item.courseId,
                courseName: item.courseName,
                studentId: item.studentId,
                studentName: item.studentName,
                deviceId: item.deviceId,
                status: "Present",
                method: "OFFLINE_QR_SYNC",
                timeSlot: item.timeSlot,
                recordedAt: serverTimestamp(),
                offlineScannedAt: new Date(item.scannedAt).toISOString()
            }, { merge: true });

            console.log(`☁️ تمت مزامنة حضور الطالب (${item.studentId}) بنجاح.`);
        } catch (err) {
            console.error("فشل رفع سجل:", err);
            remaining.push(item);
        }
    }
    localStorage.setItem("muc_pending_records", JSON.stringify(remaining));
}

// تشغيل المزامنة تلقائياً عند عودة الإنترنت
window.addEventListener("online", () => {
    syncPendingAttendance();
});
