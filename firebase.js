/**
 * MUC Student Attendance Client Module - Fully Protected
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
    arrayUnion,
    serverTimestamp,
    Timestamp 
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

// 1. التسجيل الأونلاين المباشر بحماية وتفادي أخطاء الصلاحيات
export async function recordStudentAttendance(sessionId, clientToken, studentIdInput, deviceId) {
    const cleanedStudentId = String(studentIdInput).trim();
    if (!cleanedStudentId) throw new Error("Please enter your Student ID.");

    if (!auth.currentUser) await signInAnonymously(auth);

    const safeDeviceId = String(deviceId || getLocalDeviceId()).replace(/[^a-zA-Z0-9_-]/g, "");
    const sessionRef = doc(db, "attendance_sessions", sessionId);
    const recordId = `${sessionId}_${cleanedStudentId}`;
    const recordRef = doc(db, "attendance_records", recordId);
    const deviceRef = doc(db, "attendance_devices", `${sessionId}_${safeDeviceId}`);

    // 1. فحص الجلسة والرمز
    const sessionDoc = await getDoc(sessionRef);
    if (!sessionDoc.exists()) {
        throw new Error("Attendance session not found or already closed.");
    }
    const sessionData = sessionDoc.data();
    if (sessionData.status !== "active") {
        throw new Error("Attendance session is currently closed by the instructor.");
    }

    const t = sessionData.currentToken || {};
    if (!clientToken || t.token !== clientToken) {
        throw new Error("QR Code expired! Please scan the updated code on the screen.");
    }

    // 2. فحص التسجيل المكرر للطالب
    const existingRecord = await getDoc(recordRef);
    if (existingRecord.exists()) {
        throw new Error(`Attendance already recorded for Student ID (${cleanedStudentId})!`);
    }

    // 3. جلب اسم الطالب بأمان
    let studentRealName = cleanedStudentId;
    try {
        const studentDoc = await getDoc(doc(db, "students", cleanedStudentId));
        if (studentDoc.exists()) {
            studentRealName = studentDoc.data().name || cleanedStudentId;
        }
    } catch (e) {
        console.warn("Student name fetch skipped:", e.message);
    }

    // 4. فحص بصمة الهاتف (منع تسجيل الزميل)
    try {
        const deviceDoc = await getDoc(deviceRef);
        if (deviceDoc.exists()) {
            const devData = deviceDoc.data();
            if (devData.studentId && devData.studentId !== cleanedStudentId) {
                throw new Error("Security Alert: This phone was already used to check in for another student!");
            }
        }
    } catch (e) {
        if (e.message.includes("Security Alert")) throw e;
    }

    const startTime = sessionData.startTime ? sessionData.startTime.toDate() : new Date();
    const diffMinutes = (Date.now() - startTime.getTime()) / 60000;
    const status = diffMinutes > (sessionData.lateThresholdMinutes || CONFIG.attendance.lateThresholdMinutes)
        ? CONFIG.attendance.statuses.LATE
        : CONFIG.attendance.statuses.PRESENT;

    // 5. تسجيل الحضور في سجلات الحضور (مسموح بها للطلاب دائماً)
    await setDoc(recordRef, {
        recordId: recordId,
        sessionId: sessionId,
        courseId: sessionData.courseId || "MUC_COURSE",
        courseName: sessionData.courseName || "Course",
        studentId: cleanedStudentId,
        studentName: studentRealName,
        deviceId: safeDeviceId,
        status: status,
        recordedAt: serverTimestamp(),
        method: "QR_SCAN"
    }, { merge: true });

    // 6. قفل الهاتف للجلسة (محاولة آمنة)
    try {
        await setDoc(deviceRef, {
            sessionId: sessionId,
            deviceId: safeDeviceId,
            studentId: cleanedStudentId,
            createdAt: serverTimestamp()
        }, { merge: true });
    } catch (e) {
        console.warn("Device log skipped:", e.message);
    }

    // 7. تحديث مصفوفة الجلسة (محاولة إضافية إن سمحت الصلاحيات دون إيقاف العملية)
    try {
        await setDoc(sessionRef, {
            presentStudents: arrayUnion(cleanedStudentId)
        }, { merge: true });
    } catch (e) {
        console.warn("Session doc update skipped:", e.message);
    }

    const now = new Date();
    return {
        success: true,
        studentName: studentRealName,
        studentId: cleanedStudentId,
        courseName: sessionData.courseName || "Course",
        status: status,
        date: now.toLocaleDateString("en-US"),
        time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    };
}

// 2. تسجيل الحضور محلياً أوفلاين مع حفظ رقم المحاضرة وتاريخ اليوم (معالجة أمنية فورية)
export async function queueOfflineAttendance({ studentId, studentName, sessionId, courseId, courseName, lectureNumber, timeSlot, hash, sessionStart, sessionType, group, hostRole, doctorId }) {
    if (!sessionId) {
        throw new Error("⚠️ رمز الحضور غير صالح، يرجى مسح الباركود مرة أخرى.");
    }

    const queue = JSON.parse(localStorage.getItem("muc_pending_records") || "[]");
    const deviceId = getLocalDeviceId();

    // 🔒 1. حماية أمنية: منع تكرار تسجيل نفس الطالب في نفس الجلسة
    const studentExists = queue.some(q => q.sessionId === sessionId && q.studentId === studentId);
    if (studentExists) {
        throw new Error("تم تسجيل حضورك لهذه المحاضرة بالفعل ومحفوظ على هاتفك!");
    }

    // 🔒 2. حماية أمنية: قفل بصمة الهاتف (منع تسجيل الزميل من نفس الهاتف أوفلاين)
    const deviceExists = queue.some(q => q.sessionId === sessionId && q.deviceId === deviceId);
    if (deviceExists) {
        throw new Error("⚠️ حماية أمنية: تم استخدام هذا الهاتف لتسجيل طالب آخر في هذه المحاضرة!");
    }

    const record = {
        studentId: String(studentId).trim(),
        studentName: studentName || "طالب",
        sessionId: String(sessionId).trim(),
        courseId: courseId || "MUC_COURSE",
        courseName: courseName || "المقرر الدراسي",
        lectureNumber: Number(lectureNumber) || 1,
        startedAtDate: new Date().toLocaleDateString("en-CA"),
        deviceId: deviceId,
        timeSlot: timeSlot || 0,
        hash: hash || "",
        scannedAt: Date.now(),
        sessionStart: Number(sessionStart) || 0,
        sessionType: sessionType || "",
        hostRole: hostRole || "",
        group: group || "",
        doctorId: doctorId || ""
    };

    queue.push(record);
    localStorage.setItem("muc_pending_records", JSON.stringify(queue));

    // إذا كان الهاتف متصلاً بالإنترنت حالياً، يرفع الحضور فوراً
    if (navigator.onLine) syncPendingAttendance(); // بدون await

    return record;
}

let isSyncing = false;

function withTimeout(promise, ms = 10000) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))
    ]);
}

function removeFromQueue(item) {
    const q = JSON.parse(localStorage.getItem("muc_pending_records") || "[]");
    localStorage.setItem("muc_pending_records", JSON.stringify(
        q.filter(x => !(x.sessionId === item.sessionId && x.studentId === item.studentId))
    ));
}

export async function syncPendingAttendance() {
    if (isSyncing || !navigator.onLine) return -1;
    const queue = JSON.parse(localStorage.getItem("muc_pending_records") || "[]");
    if (queue.length === 0) return 0;

    let uploaded = 0;
    isSyncing = true;
    try {
        // 🔄 محاولة الاتصال بالفايربيز حتى 3 مرات أوتوماتيكياً للغلب على تأخير شبكة الموبايل
        let connected = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                if (!auth.currentUser) {
                    await withTimeout(signInAnonymously(auth), 5000);
                }
                connected = true;
                break; // نجاح الاتصال، اخرج من الحلقة
            } catch (err) {
                if (attempt < 3) {
                    await new Promise(res => setTimeout(res, 1500)); // انتظار ثانية ونصف قبل إعادة المحاولة
                }
            }
        }

        if (!connected && !auth.currentUser) {
            throw new Error("Network connection pending");
        }

        for (const item of queue) {
            try {
                let realStudentName = item.studentName && item.studentName !== "طالب" ? item.studentName : "طالب";
                try {
                    const stdSnap = await withTimeout(getDoc(doc(db, "students", item.studentId)), 6000);
                    if (stdSnap.exists()) realStudentName = stdSnap.data().name || realStudentName;
                } catch (e) { console.warn(e); }

                const startMs = item.sessionStart || item.scannedAt || Date.now();
                const recordId = `${item.sessionId}_${item.studentId}`;
                const recordData = {
                    recordId,
                    sessionId: item.sessionId,
                    courseId: item.courseId || "MUC_COURSE",
                    courseName: item.courseName || "المقرر الدراسي",
                    studentId: item.studentId,
                    studentName: realStudentName,
                    deviceId: item.deviceId || getLocalDeviceId(),
                    status: "Present",
                    method: "OFFLINE_QR_SYNC",
                    recordedAt: serverTimestamp(),
                    offlineScannedAt: new Date(item.scannedAt || Date.now()).toISOString()
                };
                if (item.timeSlot) recordData.timeSlot = item.timeSlot;
                if (item.hash) recordData.hash = item.hash;

                // 1) الأهم: سجل الطالب
                await withTimeout(setDoc(doc(db, "attendance_records", recordId), recordData, { merge: true }));

                // 2) مستند الجلسة (محاولة إضافية — لو الـRules رفضتها السجل أعلاه محفوظ)
                try {
                    const sessionData = {
                        sessionId: item.sessionId,
                        courseId: item.courseId || "MUC_COURSE",
                        courseName: item.courseName || "المقرر الدراسي",
                        lectureNumber: Number(item.lectureNumber) || 1,
                        startTime: Timestamp.fromMillis(startMs),
                        startedAtDate: new Date(startMs).toLocaleDateString("en-CA"),
                        sessionType: item.sessionType || "lecture",
                        hostRole: item.hostRole || "doctor",
                        status: "closed",
                        presentStudents: arrayUnion(item.studentId)
                    };
                    if (item.group) sessionData.group = item.group;
                    if (item.doctorId) sessionData.doctorId = item.doctorId;
                    await withTimeout(setDoc(doc(db, "attendance_sessions", item.sessionId), sessionData, { merge: true }));
                } catch (e) { console.warn("session merge skipped:", e.message); }

                // 3) بصمة الجهاز
                try {
                    await withTimeout(setDoc(doc(db, "attendance_devices", `${item.sessionId}_${item.deviceId}`), {
                        sessionId: item.sessionId,
                        deviceId: item.deviceId,
                        studentId: item.studentId,
                        createdAt: serverTimestamp()
                    }, { merge: true }));
                } catch (e) { console.warn(e.message); }

                removeFromQueue(item); // يتشال من الطابور فور نجاحه
                uploaded++;
            } catch (err) {
                console.error("فشل رفع سجل الطالب:", item.studentId, err);
            }
        }
    } catch (e) {
        console.warn("sync aborted:", e);
    } finally {
        isSyncing = false;
    }
    return uploaded;
}

export function getPendingCount() {
    return JSON.parse(localStorage.getItem("muc_pending_records") || "[]").length;
}

window.addEventListener("online", () => syncPendingAttendance());
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") syncPendingAttendance();
});
setInterval(syncPendingAttendance, 20000); // محاولة كل 20 ثانية والصفحة مفتوحة
export function subscribeToCourseAttendance(courseId, onChange) {
    let sessions = null, records = null;
    const fire = () => { if (sessions && records) onChange({ sessions, records }); };

    const u1 = onSnapshot(query(collection(db, "attendance_sessions"), where("courseId", "==", courseId)), (s) => {
        sessions = s.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => ((a.startTime && a.startTime.seconds) || 0) - ((b.startTime && b.startTime.seconds) || 0));
        fire();
    });
    const u2 = onSnapshot(query(collection(db, "attendance_records"), where("courseId", "==", courseId)), (s) => {
        records = s.docs.map(d => ({ id: d.id, ...d.data() }));
        fire();
    });
    return () => { u1(); u2(); };
}
