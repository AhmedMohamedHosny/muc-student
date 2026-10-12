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
    query,
    where,
    getDocs,
    onSnapshot,
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
// قائمة الأرقام الجامعية لطلاب المحاضرة الثانية (167 طالباً) مدمجة لمنع فشل الاستدعاء
const PRAXIS_LEC2_STUDENTS = new Set([
  "24120490","25120899","25120933","25221096","25221102","25120837","25120836","26121713","25120874",
  "26121631","26121641","26121677","26121654","26121694","26121676","26121674","26121657","26121667",
  "26121647","26121648","26121650","26121642","26121690","26121660","25120979","26121664","26121697",
  "26121696","26121714","26121673","26121679","26121649","26121672","26121715","26121688","26121669",
  "26121652","26121661","26121629","25120995","25120958","25120955","24120548","25221092","26121126",
  "26121195","26121123","26121271","26121212","26121283","26121216","26121296","26121310","26121190",
  "26121221","26121191","26121260","26121246","26121132","26121249","26121334","26121227","26121181",
  "26121306","26121311","26121223","26121174","26121171","26121355","26121304","26121170","26121188",
  "26121233","25121117","25221097","25121083","25120936","25120978","25120872","25120845","26121444",
  "26121135","26121700","25120940","26121701","26121726","26121681","26121702","26121735","26121695",
  "26121706","26121705","26121656","26121717","26121689","26121710","26121658","26121687","26121703",
  "26121698","26121734","25120862","26121711","26121699","26121708","25221106","26121415","26121525",
  "26121645","26121428","26121563","26121482","26121562","26121400","26121655","25120818","26121518",
  "26121507","26121553","26121455","26121583","26121513","26121554","26121363","26121608","26121486",
  "26121377","26121558","26121470","26121639","26121460","26121497","26121646","26121465","26121368",
  "25221093","25120807","25120863","25120857","25121045","25120969","25121076","25120932","25121041",
  "25120813","25120854","25120817","25121010","25121047","25120953","25120923","25120834","25120913",
  "25120981","25121051","25120850","25120901","25120908","25121042","25221103","25120970","25121012",
  "25221113","25121069","25121018","25121088","25120976"
]);
// فحص فوري: أول رقم في الـ PIN يدل على المحاضرة (1 = محاضرة 1، 2 = محاضرة 2)
export function checkPinLectureMatch(pin, studentId) {
    const first = String(pin).charAt(0);
    const isLec2Std = PRAXIS_LEC2_STUDENTS.has(String(studentId).trim());
    if (first === "1" && isLec2Std) return "WRONG_LEC_2";
    if (first === "2" && !isLec2Std) return "WRONG_LEC_1";
    return null;
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

const sessionDoc = await getDoc(sessionRef);
    if (!sessionDoc.exists()) {
        throw new Error("Attendance session not found or already closed.");
    }
    const sessionData = sessionDoc.data();
    if (sessionData.status !== "active") {
        throw new Error("Attendance session is currently closed by the instructor.");
    }

    // 🔒 فحص أمني حاسم: منع تسجيل طالب المحاضرة الثانية في المحاضرة الأولى والعكس
    const sessionCourseKey = `${sessionData.courseId || ""} ${sessionData.courseName || ""}`.toLowerCase();
    const isLec1Session = sessionCourseKey.includes("lec1") || sessionCourseKey.includes("l1") || sessionCourseKey.includes("محاضرة 1");
    const isLec2Session = sessionCourseKey.includes("lec2") || sessionCourseKey.includes("l2") || sessionCourseKey.includes("محاضرة 2");

    if (isLec1Session || isLec2Session) {
        const isLec2Std = PRAXIS_LEC2_STUDENTS.has(cleanedStudentId);
        if (isLec1Session && isLec2Std) {
            throw new Error("WRONG_LEC_2");
        }
        if (isLec2Session && !isLec2Std) {
            throw new Error("WRONG_LEC_1");
        }
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

// 3. فحص أكاديمي شامل: التحقق من وجود الطالب وقيده في المقرر
    const studentDoc = await getDoc(doc(db, "students", cleanedStudentId));
    if (!studentDoc.exists()) {
        throw new Error(`⚠️ الرقم الجامعي (${cleanedStudentId}) غير مسجل بقاعدة بيانات الجامعة!`);
    }

    const studentData = studentDoc.data();
    const studentRealName = studentData.name || cleanedStudentId;

    // فحص القيد في المادة (ديناميكي لجميع المقررات والدكاترة)
    const enrolledList = studentData.enrolledCourses || [];
    const currentCourseId = sessionData.courseId || "";
    const isEnrolled = enrolledList.includes(currentCourseId) || 
                       (studentData.sections && (studentData.sections[currentCourseId] || Object.keys(studentData.sections).some(k => k.toLowerCase() === currentCourseId.toLowerCase())));

    if (!isEnrolled) {
        throw new Error(`NOT_ENROLLED:${studentRealName}:${sessionData.courseName || "هذا المقرر"}`);
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

// تم فك الاختناق: الطالب يكتب سجله المستقل فقط ولا يلمس مستند الجلسة
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

export async function queueOfflineAttendance({ studentId, studentName, sessionId, courseId, courseName, lectureNumber, timeSlot, hash, sessionStart, sessionType, group, hostRole, doctorId, pin }) {
        const cleanedStudentId = String(studentId).trim();
    if (!sessionId) {
        throw new Error("⚠️ رمز الحضور غير صالح، يرجى مسح الباركود مرة أخرى.");
    }

    // 🔒 فحص عزل محاضرة 1 عن محاضرة 2 في الأوفلاين
    const sessionCourseKey = `${courseId || ""} ${courseName || ""}`.toLowerCase();
    const isLec1Session = sessionCourseKey.includes("lec1") || sessionCourseKey.includes("l1") || sessionCourseKey.includes("محاضرة 1");
    const isLec2Session = sessionCourseKey.includes("lec2") || sessionCourseKey.includes("l2") || sessionCourseKey.includes("محاضرة 2");

    if (isLec1Session || isLec2Session) {
        const isLec2Std = PRAXIS_LEC2_STUDENTS.has(cleanedStudentId);
        if (isLec1Session && isLec2Std) {
            throw new Error("⚠️ غير مصرح: أنت مسجل في (محاضرة 2) ولا يمكنك تسجيل الحضور في محاضرة 1!");
        }
        if (isLec2Session && !isLec2Std) {
            throw new Error("⚠️ غير مصرح: أنت مسجل في (محاضرة 1) ولا يمكنك تسجيل الحضور في محاضرة 2!");
        }
    }

    const queue = JSON.parse(localStorage.getItem("muc_pending_records") || "[]");
    const deviceId = getLocalDeviceId();

    // 🔒 منع تكرار تسجيل نفس الطالب لنفس المحاضرة
    const studentExists = queue.some(q => q.sessionId === sessionId && q.studentId === cleanedStudentId);
    if (studentExists) {
        throw new Error("تم تسجيل حضورك لهذه المحاضرة بالفعل ومحفوظ على هاتفك!");
    }

    // 🔒 منع تسجيل طالبين مختلفين من نفس الهاتف
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
                pin: pin || "",
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
function checkLectureMatch(courseId, courseName, studentId) {
    const key = `${courseId || ""} ${courseName || ""}`.toLowerCase();
    const isLec1 = key.includes("lec1") || key.includes("l1") || key.includes("محاضرة 1");
    const isLec2 = key.includes("lec2") || key.includes("l2") || key.includes("محاضرة 2");
    if (!isLec1 && !isLec2) return null;
    const isLec2Std = PRAXIS_LEC2_STUDENTS.has(String(studentId).trim());
    if (isLec1 && isLec2Std) return "WRONG_LEC_2";
    if (isLec2 && !isLec2Std) return "WRONG_LEC_1";
    return null;
}
function removeFromQueue(item) {
    const key = item.origSessionId || item.sessionId;
    const q = JSON.parse(localStorage.getItem("muc_pending_records") || "[]");
    localStorage.setItem("muc_pending_records", JSON.stringify(
        q.filter(x => !(x.sessionId === key && x.studentId === item.studentId))
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
                                // 0) سجل PIN أوفلاين: نحوّله لجلسة حقيقية بالكود
                if (item.pin) {
                    item.origSessionId = item.sessionId;   // عشان removeFromQueue يلاقيه
                    const ps = await withTimeout(
                        getDocs(query(collection(db, "attendance_sessions"), where("pinHistory", "array-contains", Number(item.pin)))),
                        8000
                    );
                    // نفس يوم التسجيل، عشان الكود مايتطابقش مع جلسة قديمة بالصدفة
                    const matches = ps.docs.filter(d => {
                        const sd0 = d.data().startedAtDate;
                        return !sd0 || !item.startedAtDate || sd0 === item.startedAtDate;
                    });
                    if (matches.length === 0) {
                        // يفضل في الطابور، ويتشال بعد 48 ساعة
                        if (Date.now() - (item.scannedAt || 0) > 48 * 3600 * 1000) removeFromQueue(item);
                        continue;
                    }
                    const sd = matches[0];
                    item.sessionId = sd.id;
                    item.courseId = sd.data().courseId || "";
                    item.courseName = sd.data().courseName || item.courseName;
                }
                // 1) التحقق أولاً: هل المحاضرة لا تزال موجودة في السيرفر أم حذفها الدكتور؟
                let sessionExists = true;
                try {
                    const sessSnap = await withTimeout(getDoc(doc(db, "attendance_sessions", item.sessionId)), 5000);
                    if (!sessSnap.exists() || sessSnap.data()?.status === "deleted") {
                        sessionExists = false;
                    }
                } catch (err) {
                    // إذا كان الخطأ رفض صلاحية، فهذا يعني أن الجلسة حُذفت
                    if (err.message && err.message.includes("permission-denied")) sessionExists = false;
                }

                if (!sessionExists) {
                    removeFromQueue(item); // حذف السجل فوراً من هاتف الطالب لأن الدكتور حذف المحاضرة
                    continue;
                }
                                // 1.5) عزل المحاضرة 1 عن 2 (المحاضرة بتتعرف وقت الرفع في سجلات الـ PIN الأوفلاين)
                const mismatch = checkLectureMatch(item.courseId, item.courseName, item.studentId);
                if (mismatch) {
                    localStorage.setItem("muc_sync_error", mismatch === "WRONG_LEC_2"
                        ? `⚠️ حضور الرقم (${item.studentId}) لم يُسجَّل: هذه المحاضرة الأولى وأنت مسجل في المحاضرة الثانية. تواصل مع الدكتور.\n\nNot registered: this is Lecture 1 but you belong to Lecture 2. Please contact your doctor.`
                        : `⚠️ حضور الرقم (${item.studentId}) لم يُسجَّل: هذه المحاضرة الثانية وأنت مسجل في المحاضرة الأولى. تواصل مع الدكتور.\n\nNot registered: this is Lecture 2 but you belong to Lecture 1. Please contact your doctor.`);
                    removeFromQueue(item);
                    continue;
                }
// 2) التحقق من وجود وقيد الطالب في السيرفر
                let realStudentName = item.studentName || "طالب";
                const stdSnap = await withTimeout(getDoc(doc(db, "students", item.studentId)), 6000);
                if (stdSnap.exists()) {
                    const sData = stdSnap.data();
                    realStudentName = sData.name || realStudentName;
                    localStorage.setItem(`muc_student_name_${item.studentId}`, realStudentName);
                    const enrolled = sData.enrolledCourses || [];
                    if (item.courseId && !enrolled.includes(item.courseId)) {
                        localStorage.setItem("muc_sync_error", `⚠️ الرقم (${item.studentId}) غير مقيد في هذا المقرر!`);
                        removeFromQueue(item);
                        continue;
                    }
                } else {
                    localStorage.setItem("muc_sync_error", `⚠️ الرقم الجامعي (${item.studentId}) غير مسجل بعد!`);
                    removeFromQueue(item);
                    continue;
                }

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

                await withTimeout(setDoc(doc(db, "attendance_records", recordId), recordData, { merge: true }));

                try {
                    await withTimeout(setDoc(doc(db, "attendance_devices", `${item.sessionId}_${item.deviceId}`), {
                        sessionId: item.sessionId,
                        deviceId: item.deviceId,
                        studentId: item.studentId,
                        createdAt: serverTimestamp()
                    }, { merge: true }));
                } catch (e) { console.warn(e.message); }

                removeFromQueue(item);
                uploaded++;
            } catch (err) {
                // إذا رفض السيرفر الحفظ لأن المحاضرة ملغاة، احذف السجل المعلق
                if (err.message && (err.message.includes("permission-denied") || err.message.includes("not found"))) {
                    removeFromQueue(item);
                }
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
