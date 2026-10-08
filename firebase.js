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

// 1. التسجيل الأونلاين المباشر مع تفعيل الحماية لمنع تسجيل الصحاب والتكرار
export async function recordStudentAttendance(sessionId, clientToken, studentIdInput, deviceId) {
    const cleanedStudentId = String(studentIdInput).trim();
    if (!cleanedStudentId) throw new Error("يرجى إدخال الرقم الجامعي.");

    if (!auth.currentUser) await signInAnonymously(auth);

    const safeDeviceId = String(deviceId || getLocalDeviceId()).replace(/[^a-zA-Z0-9_-]/g, "");
    const sessionRef = doc(db, "attendance_sessions", sessionId);
    const recordId = `${sessionId}_${cleanedStudentId}`;
    const recordRef = doc(db, "attendance_records", recordId);
    const deviceRef = doc(db, "attendance_devices", `${sessionId}_${safeDeviceId}`);

    return await runTransaction(db, async (transaction) => {
        const sessionDoc = await transaction.get(sessionRef);
        if (!sessionDoc.exists()) throw new Error("جلسة الحضور غير موجودة أو تم إنهاؤها.");
        const sessionData = sessionDoc.data();
        if (sessionData.status !== "active") throw new Error("جلسة الحضور مغلقة حالياً من قبل أستاذ المادة.");

        // جلب بيانات الطالب
        const studentDoc = await transaction.get(doc(db, "students", cleanedStudentId));
        if (!studentDoc.exists()) {
            throw new Error(`الرقم الجامعي (${cleanedStudentId}) غير مقيد بقاعدة البيانات.`);
        }
        const studentData = studentDoc.data();

        // 🔒 حماية 1: فحص تسجيل الطالب المكرر لنفس المحاضرة
        const existingRecord = await transaction.get(recordRef);
        if (existingRecord.exists()) {
            throw new Error(`عفواً يا ${studentData.name}، تم تسجيل حضورك مسبقاً لهذه المحاضرة!`);
        }

        // 🔒 حماية 2: فحص بصمة الموبايل (منع التسجيل للصحاب من نفس الهاتف)
        const deviceDoc = await transaction.get(deviceRef);
        if (deviceDoc.exists()) {
            throw new Error(`⚠️ حماية أمنية: تم تسجيل حضور مسبقاً من هذا الهاتف لطالب آخر! لا يمكن تسجيل الحضور لزميلك.`);
        }

const t = sessionData.currentToken || {};
            // مطابقة حصرية وصارمة مع الرمز الحالي فقط، مع إلغاء قبول الرمز السابق
            if (!clientToken || t.token !== clientToken) {
                throw new Error("⚠️ انتهت صلاحية هذا الرمز! صوّب الكاميرا نحو الشاشة والتقط الرمز الجديد بسرعة.");
            }

        if (!(studentData.enrolledCourses || []).includes(sessionData.courseId)) {
            throw new Error(`عفواً يا ${studentData.name}، أنت غير مقيد في هذا المقرر.`);
        }

        const startTime = sessionData.startTime ? sessionData.startTime.toDate() : new Date();
        const diffMinutes = (Date.now() - startTime.getTime()) / 60000;
        const status = diffMinutes > (sessionData.lateThresholdMinutes || CONFIG.attendance.lateThresholdMinutes)
            ? CONFIG.attendance.statuses.LATE
            : CONFIG.attendance.statuses.PRESENT;

        // تسجيل الحضور
        transaction.set(recordRef, {
            recordId: recordId,
            sessionId: sessionId,
            courseId: sessionData.courseId,
            courseName: sessionData.courseName,
            studentId: cleanedStudentId,
            studentName: studentData.name,
            deviceId: safeDeviceId,
            status: status,
            recordedAt: serverTimestamp(),
            method: "QR_SCAN"
        });

        // قفل الهاتف لهذه الجلسة
        transaction.set(deviceRef, {
            sessionId: sessionId,
            deviceId: safeDeviceId,
            studentId: cleanedStudentId,
            createdAt: serverTimestamp()
        });

        // إدراج الطالب في مصفوفة الجلسة الرسمية لشيت الدكتور
        transaction.update(sessionRef, {
            presentStudents: arrayUnion(cleanedStudentId)
        });

        const now = new Date();
        return {
            success: true,
            studentName: studentData.name,
            studentId: cleanedStudentId,
            courseName: sessionData.courseName,
            status: status,
            date: now.toLocaleDateString("ar-EG"),
            time: now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })
        };
    });
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
