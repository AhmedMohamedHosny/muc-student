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

    return await runTransaction(db, async (transaction) => {
        const sessionDoc = await transaction.get(sessionRef);
        if (!sessionDoc.exists()) throw new Error("جلسة الحضور غير موجودة أو تم إنهاؤها.");
        const sessionData = sessionDoc.data();
        if (sessionData.status !== "active") throw new Error("جلسة الحضور مغلقة حالياً.");

        const t = sessionData.currentToken || {};
        if (!clientToken || (t.token !== clientToken && t.prevToken !== clientToken)) {
            throw new Error("رمز QR انتهت صلاحيته. امسح الرمز المحدث من الشاشة.");
        }

        const studentDoc = await transaction.get(doc(db, "students", cleanedStudentId));
        if (!studentDoc.exists()) {
            throw new Error(`الرقم الجامعي (${cleanedStudentId}) غير مقيد بقاعدة البيانات.`);
        }
        const studentData = studentDoc.data();

        if (!(studentData.enrolledCourses || []).includes(sessionData.courseId)) {
            throw new Error(`عفواً يا ${studentData.name}، أنت غير مقيد في هذا المقرر.`);
        }

if (sessionData.hostRole === "ta") {
            const secInfo = (studentData.sections || {})[sessionData.courseId] || {};
            const studentGroup = typeof secInfo === "string" ? secInfo : (secInfo.group || secInfo.groupName || "جروب 1");
            const sessionGroup = sessionData.group || "جروب 1";

            // استخراج رقم الجروب فقط (مثال: جروب 1 يستخرج منه الرقم 1)
            const stdNum = (studentGroup.match(/\d+/) || ["1"])[0];
            const sessNum = (sessionGroup.match(/\d+/) || ["1"])[0];

            let isAssigned = false;

            // 1. لو رقم الجروب متطابق (1 مع 1) يدخل فوراً
            if (stdNum === sessNum) {
                isAssigned = true;
            }

            // 2. لو الطالب متسكن مع نفس المعيد
            if (!isAssigned && secInfo.taId && secInfo.taId === sessionData.doctorId) {
                isAssigned = true;
            }

            // 3. لو الجلسة قديمة بدون جروب
            if (!isAssigned && (!sessionData.group || sessionData.group === "")) {
                isAssigned = true;
            }

            if (!isAssigned) {
                throw new Error(`عفواً يا ${studentData.name}، أنت مقيد في (جروب ${stdNum}) وهذا السكشن خاص بطلاب (جروب ${sessNum}).`);
            }
        }

        const existing = await transaction.get(recordRef);
        if (existing.exists()) throw new Error(`تم تسجيل حضورك مسبقاً يا ${studentData.name}.`);

        const deviceDoc = await transaction.get(deviceRef);
        if (deviceDoc.exists()) {
            throw new Error("⚠️ تنبيه: تم تسجيل حضور مسبقاً من هذا الهاتف لهذه المحاضرة.");
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

        transaction.set(deviceRef, {
            sessionId: sessionId,
            deviceId: safeDeviceId,
            studentId: cleanedStudentId,
            createdAt: serverTimestamp()
        });

        return {
            success: true,
            studentName: studentData.name,
            studentId: cleanedStudentId,
            courseName: sessionData.courseName,
            status: status,
            time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })
        };
    });
}
