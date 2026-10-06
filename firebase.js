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

// 2. تسجيل الحضور محلياً أوفلاين مع الحماية من التكرار وتسجيل الصحاب
export async function queueOfflineAttendance({ studentId, studentName, sessionId, courseId, courseName, timeSlot, hash }) {
    // ⏱️ فحص الفاصل الزمني للأوفلاين (الـ QR يتغير كل 15 ثانية)
    if (timeSlot) {
        const currentSlot = Math.floor(Date.now() / 15000);
        // رفض التسجيل إذا كان الفارق الزمني أكبر من فترة الصلاحية الحالية
        if (Math.abs(currentSlot - timeSlot) > 1) {
            throw new Error("⚠️ انتهت صلاحية هذا الرمز الأوفلاين! صوّب الكاميرا والتقط الرمز الحي الجديد من الشاشة.");
        }
    }

    const queue = JSON.parse(localStorage.getItem("muc_pending_records") || "[]");
    const deviceId = getLocalDeviceId();

    // 🔒 حماية 1: منع تكرار نفس الطالب لنفس الجلسة أوفلاين
    const studentExists = queue.some(q => q.sessionId === sessionId && q.studentId === studentId);
    if (studentExists) throw new Error("تم تسجيل حضورك لهذه المحاضرة بالفعل ومحفوظ على هاتفك!");

    // 🔒 حماية 2: منع استخدام نفس الهاتف لتسجيل طالب آخر (منع تسجيل الصحاب أوفلاين)
    const deviceExists = queue.some(q => q.sessionId === sessionId && q.deviceId === deviceId);
    if (deviceExists) throw new Error("⚠️ حماية أمنية: تم استخدام هذا الهاتف لتسجيل طالب آخر في هذه المحاضرة!");

    const record = {
        studentId: String(studentId).trim(),
        studentName: studentName || "طالب",
        sessionId: String(sessionId).trim(),
        courseId: courseId || "MUC_COURSE",
        courseName: courseName || "المقرر الدراسي",
        deviceId: deviceId,
        scannedAt: Date.now()
    };

    if (timeSlot) record.timeSlot = timeSlot;
    if (hash) record.hash = hash;

    queue.push(record);
    localStorage.setItem("muc_pending_records", JSON.stringify(queue));

    if (navigator.onLine) {
        await syncPendingAttendance();
    }

    return record;
}

// 3. المزامنة التلقائية لرفع الحضور لشيت الدكتور فور توفر الشبكة
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
            // جلب اسم الطالب الحقيقي من الفايربيز
            let realStudentName = item.studentName && item.studentName !== "طالب" ? item.studentName : "طالب";
            try {
                const stdSnap = await getDoc(doc(db, "students", item.studentId));
                if (stdSnap.exists()) {
                    realStudentName = stdSnap.data().name || realStudentName;
                }
            } catch (e) { console.warn(e); }

            const recordId = `${item.sessionId}_${item.studentId}`;
            const recordData = {
                recordId: recordId,
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

            // 1. رفع السجل الفردي
            await setDoc(doc(db, "attendance_records", recordId), recordData, { merge: true });

            // 2. تحديث مصفوفة الجلسة الرسمية لشيت الدكتور لإظهار علامة (✔)
            const sessionRef = doc(db, "attendance_sessions", item.sessionId);
            await setDoc(sessionRef, {
                sessionId: item.sessionId,
                courseId: item.courseId || "MUC_COURSE",
                courseName: item.courseName || "المقرر الدراسي",
                presentStudents: arrayUnion(item.studentId)
            }, { merge: true });

            // 3. قفل الجهاز أونلاين
            const deviceRef = doc(db, "attendance_devices", `${item.sessionId}_${item.deviceId}`);
            await setDoc(deviceRef, {
                sessionId: item.sessionId,
                deviceId: item.deviceId,
                studentId: item.studentId,
                createdAt: serverTimestamp()
            }, { merge: true });

            console.log(`☁️ تمت المزامنة بنجاح للطالب (${item.studentId} - ${realStudentName})!`);
        } catch (err) {
            console.error("فشل رفع سجل الطالب:", item.studentId, err);
            remaining.push(item);
        }
    }
    localStorage.setItem("muc_pending_records", JSON.stringify(remaining));
}

// تشغيل المزامنة فور رجوع النت
window.addEventListener("online", () => {
    syncPendingAttendance();
});
