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

            // فحص سكرين شوت متأخر
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

            // ربط الهاتف بـ ID الطالب
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
// 📴 محرك حفظ ومزامنة الحضور أوفلاين
// ==========================================

// 1. تسجيل الحضور محلياً داخل ذاكرة الهاتف عند انقطاع الشبكة
export async function queueOfflineAttendance({ studentId, studentName, sessionId, courseId, courseName, timeSlot, hash }) {
    const queue = JSON.parse(localStorage.getItem("muc_pending_records") || "[]");
    
    // منع تكرار نفس الطالب لنفس الجلسة محلياً
    const exists = queue.some(q => q.sessionId === sessionId && q.studentId === studentId);
    if (exists) throw new Error("تم تسجيل حضورك لهذه المحاضرة بالفعل ومحفوظ على هاتفك!");

    const record = {
        studentId: String(studentId).trim(),
        studentName: studentName || "طالب",
        sessionId: String(sessionId).trim(),
        courseId: courseId || "MUC_COURSE",
        courseName: courseName || "المقرر الدراسي",
        deviceId: getLocalDeviceId(),
        scannedAt: Date.now()
    };

    if (timeSlot) record.timeSlot = timeSlot;
    if (hash) record.hash = hash;

    queue.push(record);
    localStorage.setItem("muc_pending_records", JSON.stringify(queue));

    // إذا وُجد إنترنت حالياً يرفعه فوراً
    if (navigator.onLine) {
        await syncPendingAttendance();
    }

    return record;
}

// 2. محرك المزامنة التلقائي مع Firestore عند توفر الشبكة
export async function syncPendingAttendance() {
    if (!navigator.onLine) return;
    const queue = JSON.parse(localStorage.getItem("muc_pending_records") || "[]");
    if (queue.length === 0) return;

    if (!auth.currentUser) {
        try { 
            await signInAnonymously(auth); 
        } catch (e) { 
            console.error("خطأ في تسجيل الدخول المجهول أثناء المزامنة:", e);
            return; 
        }
    }

    const remaining = [];
    for (const item of queue) {
        try {
            const recordId = `${item.sessionId}_${item.studentId}`;

            // جلب اسم الطالب الحقيقي من قاعدة البيانات فور توفر الإنترنت
            let realStudentName = item.studentName && item.studentName !== "طالب" ? item.studentName : "طالب";
            try {
                const studentSnap = await getDoc(doc(db, "students", item.studentId));
                if (studentSnap.exists()) {
                    realStudentName = studentSnap.data().name || realStudentName;
                }
            } catch (e) {
                console.warn("تعذر جلب اسم الطالب أثناء المزامنة:", e);
            }
            
            // 1. بناء السجل وتنظيف الحقول من أي undefined
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

            // رفع السجل الفردي إلى attendance_records
            await setDoc(doc(db, "attendance_records", recordId), recordData, { merge: true });

            // 2. تحديث قائمة الحضور في الجلسة عبر arrayUnion لضمان ظهور علامة (✔) في شيت الدكتور فوراً
            const sessionRef = doc(db, "attendance_sessions", item.sessionId);
            await setDoc(sessionRef, {
                sessionId: item.sessionId,
                courseId: item.courseId || "MUC_COURSE",
                courseName: item.courseName || "المقرر الدراسي",
                presentStudents: arrayUnion(item.studentId)
            }, { merge: true });

            console.log(`☁️ تمت مزامنة حضور الطالب (${item.studentId} - ${realStudentName}) وظهوره في شيت الدكتور بنجاح! ✅`);
        } catch (err) {
            console.error("فشل رفع سجل الطالب:", item.studentId, err);
            remaining.push(item);
        }
    }
    localStorage.setItem("muc_pending_records", JSON.stringify(remaining));
}

// تشغيل المزامنة تلقائياً عند عودة الإنترنت
window.addEventListener("online", () => {
    syncPendingAttendance();
});
