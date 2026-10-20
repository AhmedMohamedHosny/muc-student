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
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { CONFIG } from "./config.js";

const app = initializeApp(CONFIG.firebase);
export const auth = getAuth(app);
export const db = getFirestore(app);

function getLocalDeviceId() {
    try {
        const screenFeatures = `${screen.width}x${screen.height}x${screen.colorDepth}`;
        const cpuCores = navigator.hardwareConcurrency || 4;
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Cairo";
        const platform = navigator.platform || "Unknown";
        
        let rawSignature = `${screenFeatures}_${cpuCores}_${timezone}_${platform}`;
        let hash = 0;
        for (let i = 0; i < rawSignature.length; i++) {
            hash = ((hash << 5) - hash) + rawSignature.charCodeAt(i);
            hash |= 0;
        }
        const hardwareSignature = "hw_" + Math.abs(hash).toString(36);

        let localToken = "";
        try { localToken = localStorage.getItem("muc_device_id") || ""; } catch(e) {}
        
        if (!localToken) {
            localToken = Array.from(window.crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, "0")).join("");
            try { localStorage.setItem("muc_device_id", localToken); } catch(e) {}
        }

        return `${hardwareSignature}_${localToken}`;
    } catch (e) {
        return "dev_" + Math.random().toString(36).substring(2, 10);
    }
}

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
export function getCoursePinIndex(courseId) {
    const s = String(courseId || "").trim().toLowerCase();
    if (!s) return 0;
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = (h * 31 + s.charCodeAt(i)) % 30;
    }
    return Math.abs(h) % 30;
}

export function cleanCourseDisplayName(name) {
    const s = String(name || "");
    if (s.toLowerCase().includes("praxis")) return "Praxis Programming";
    return s.replace(/\s*[-–—]?\s*(محاضرة|Lecture|Lec)\s*[12]/gi, "").trim() || "المقرر الدراسي";
}

const KNOWN_MUC_COURSES = {
    "praxis_programming_lec1": "Praxis Programming",
    "praxis_programming_lec2": "Praxis Programming",
    "cse216": "Web Design and Database (CSE216)",
    "cse_web_design": "Web Design and Database (CSE216)",
    "CSE_UC": "User Centered Design",
    "cse_uc": "User Centered Design",
    "user_centered_design": "User Centered Design",
    "cse_modern_workshop": "Modern Workshop",
    "cse122": "Logic Design (CSE122)"
};

function formatReadableCourseId(cid) {
    if (!cid) return "";
    if (KNOWN_MUC_COURSES[cid]) return KNOWN_MUC_COURSES[cid];
    return cleanCourseDisplayName(String(cid).replace(/^cse_/, "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()));
}

export function decodePinMetadata(pin) {
    const s = String(pin || "").trim();
    const prefix4 = Number(s.slice(0, 4));
    const codeVal = prefix4 - 1000;
    const isOfflineModePin = (codeVal % 2) === 1;
    const extractedLecNum = (Math.floor(codeVal / 2) % 15) || 15;
    const courseIdx = Math.floor(codeVal / 30) % 30;

    let courseId = "";
    let courseName = "";

    try {
        const cachedMap = JSON.parse(localStorage.getItem("muc_course_names_map") || "{}");
        const enrolled = JSON.parse(localStorage.getItem("muc_student_courses") || "[]");

        for (const cid of enrolled) {
            if (getCoursePinIndex(cid) === courseIdx) {
                courseId = cid;
                courseName = cachedMap[cid] || formatReadableCourseId(cid);
                break;
            }
        }
        if (!courseName) {
            for (const [cid, cname] of Object.entries(cachedMap)) {
                if (getCoursePinIndex(cid) === courseIdx) {
                    courseId = cid;
                    courseName = cname;
                    break;
                }
            }
        }
        if (!courseName) {
            for (const [cid, cname] of Object.entries(KNOWN_MUC_COURSES)) {
                if (getCoursePinIndex(cid) === courseIdx) {
                    courseId = cid;
                    courseName = cname;
                    break;
                }
            }
        }
    } catch (e) {}

    return {
        isOfflineModePin,
        lectureNumber: extractedLecNum,
        courseIdx,
        courseId: courseId || "MUC_COURSE",
        courseName: cleanCourseDisplayName(courseName || "Praxis Programming")
    };
}

// دوال تتبع المحاضرات مربوطة برقم الجلسة الفريد (لتسمح للطالب بالتسجيل لو الدكتور أعاد فتح المحاضرة)
export function markLectureAttendedLocally(sid, courseId, lecNum, sessionId = "") {
    try {
        const key = `muc_attended_history_${sid}`;
        const hist = JSON.parse(localStorage.getItem(key) || "{}");
        const cKey = String(courseId).toLowerCase().includes("praxis") ? "praxis" : String(courseId).toLowerCase();
        hist[`${cKey}_L${lecNum}`] = {
            sessionId: String(sessionId || "").trim(),
            date: new Date().toLocaleDateString("en-CA"),
            timestamp: Date.now()
        };
        localStorage.setItem(key, JSON.stringify(hist));
    } catch(e) {}
}

export function isLectureAlreadyAttendedLocally(sid, courseId, lecNum, sessionId = "") {
    try {
        const key = `muc_attended_history_${sid}`;
        const hist = JSON.parse(localStorage.getItem(key) || "{}");
        const cKey = String(courseId).toLowerCase().includes("praxis") ? "praxis" : String(courseId).toLowerCase();
        const record = hist[`${cKey}_L${lecNum}`];
        if (!record) return false;
        // إذا تغيرت الجلسة (لأن الدكتور مسح القديمة وبدأ واحدة جديدة)، لا نمنع الطالب ونسمح له بالتسجيل
        if (sessionId && record.sessionId) {
            return record.sessionId === String(sessionId).trim();
        }
        return false;
    } catch(e) {
        return false;
    }
}

export function clearLectureAttendedLocally(sid, courseId, lecNum) {
    try {
        const key = `muc_attended_history_${sid}`;
        const hist = JSON.parse(localStorage.getItem(key) || "{}");
        const cKey = String(courseId).toLowerCase().includes("praxis") ? "praxis" : String(courseId).toLowerCase();
        delete hist[`${cKey}_L${lecNum}`];
        localStorage.setItem(key, JSON.stringify(hist));
    } catch(e) {}
}

export function isValidPinChecksum(pin) {
    const s = String(pin || "").trim();
    if (!/^\d{6}$/.test(s)) return false;
    const d1 = Number(s[0]), d2 = Number(s[1]), d3 = Number(s[2]), d4 = Number(s[3]);
    if (d1 === 0) return false;

    // 1. البصمة الرباعية الجديدة (تحمل اسم المقرر ورقم المحاضرة ونوعها)
    const sig2 = ((d1 * 73 + d2 * 59 + d3 * 31 + d4 * 17 + 43) % 100);
    if (String(sig2).padStart(2, "0") === s.slice(4)) return true;

    // 2. توافق مع البصمة الثلاثية السابقة
    const directSig = ((d1 * 739 + d2 * 521 + d3 * 313 + 419) % 1000);
    if (String(directSig).padStart(3, "0") === s.slice(3)) return true;

    return false;
}

export function checkPinLectureMatch(pin, studentId) {
    return null; // التحقق يتم فعلياً من قيد الطالب في المقرر والسكشن على السيرفر
}

const activeSubmissionLocks = new Set();

function withTimeout(promise, ms = 4500) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("NETWORK_TIMEOUT")), ms))
    ]);
}

export async function recordStudentAttendance(sessionId, clientToken, studentIdInput, deviceId) {
    const cleanedStudentId = String(studentIdInput || "").trim();
    if (!cleanedStudentId) throw new Error("Please enter your Student ID.");

    const lockKey = `${sessionId}_${cleanedStudentId}`;
    if (activeSubmissionLocks.has(lockKey)) {
        throw new Error("Your check-in is already being processed. Please wait a moment.");
    }
    activeSubmissionLocks.add(lockKey);

    try {
        if (!auth.currentUser) await withTimeout(signInAnonymously(auth), 4000);

        const safeDeviceId = String(deviceId || getLocalDeviceId()).replace(/[^a-zA-Z0-9_-]/g, "");
        const sessionRef = doc(db, "attendance_sessions", sessionId);
        const recordId = `${sessionId}_${cleanedStudentId}`;
        const recordRef = doc(db, "attendance_records", recordId);
        const deviceRef = doc(db, "attendance_devices", `${sessionId}_${safeDeviceId}`);
let sessionDoc = await withTimeout(getDoc(sessionRef), 4500);
        if (!sessionDoc.exists()) {
            // محاولة ثانية سريعة في حال كان اتصال الدكتور متأخراً ثانية واحدة
            await new Promise(r => setTimeout(r, 1200));
            sessionDoc = await withTimeout(getDoc(sessionRef), 4500);
            if (!sessionDoc.exists()) {
                throw new Error("جاري بدء وتثبيت الجلسة على السيرفر.. يرجى إعادة المحاولة خلال ثوانٍ.");
            }
        }
        const sessionData = sessionDoc.data();

        const isAllowedOfflineSession = sessionData.qrOffline === true && !sessionData.finalized;
        if (sessionData.status !== "active" && !isAllowedOfflineSession) {
            throw new Error("Attendance session is currently closed by the instructor.");
        }

const t = sessionData.currentToken || {};
        const isOfflineToken = String(clientToken || "").startsWith("OFF_");
        if (clientToken !== "PIN_VERIFIED" && !isOfflineToken && (!clientToken || (t.token !== clientToken && t.prevToken !== clientToken))) {
            throw new Error("QR Code expired! Please scan the updated code on the screen.");
        }

const currentLecNum = Number(sessionData.lectureNumber || 1);
        const isPraxis = String(sessionData.courseId || "").toLowerCase().includes("praxis") || String(sessionData.courseName || "").toLowerCase().includes("praxis");

// 1. فحص السجل المباشر للجلسة الحالية على السيرفر (Ground Truth)
        const existingRecord = await withTimeout(getDoc(recordRef), 4000);
        if (existingRecord.exists()) {
            markLectureAttendedLocally(cleanedStudentId, sessionData.courseId, currentLecNum, sessionId);
            throw new Error(`⚠️ لقد قمت بتسجيل حضورك لهذه المحاضرة بالفعل (Lecture #${currentLecNum})!`);
        }

        // 2. فحص السحابة (يقتصر فقط على مادة البراكسيس لمنع حضور الفترتين L1 و L2 لنفس المحاضرة)
        if (isPraxis) {
            try {
                const qAlready = query(
                    collection(db, "attendance_records"),
                    where("studentId", "==", cleanedStudentId)
                );
                const prevSnap = await withTimeout(getDocs(qAlready), 3500);
                const alreadyAttended = prevSnap.docs.some(docSnap => {
                    const r = docSnap.data();
                    const rCourse = String(r.courseId || "").toLowerCase();
                    const rIsPraxis = rCourse.includes("praxis") || String(r.courseName || "").toLowerCase().includes("praxis");
                    const matchLec = Number(r.lectureNumber || 0) === currentLecNum;
                    return rIsPraxis && matchLec;
                });

                if (alreadyAttended) {
                    markLectureAttendedLocally(cleanedStudentId, sessionData.courseId, currentLecNum, sessionId);
                    throw new Error(`⚠️ لقد قمت بتسجيل حضورك لهذه المحاضرة بالفعل (Lecture #${currentLecNum})!`);
                }
            } catch (checkErr) {
                if (String(checkErr.message || "").includes("لقد قمت بتسجيل حضورك")) throw checkErr;
            }
        }

        // إذا كان السجل محذوفاً من السيرفر (لأن الدكتورة أعادت المحاضرة)، ننظف كاش الهاتف فوراً
        clearLectureAttendedLocally(cleanedStudentId, sessionData.courseId, currentLecNum);

        const studentDoc = await withTimeout(getDoc(doc(db, "students", cleanedStudentId)), 4500);
        if (!studentDoc.exists()) {
            throw new Error(`⚠️ الرقم الجامعي (${cleanedStudentId}) غير مسجل بقاعدة بيانات الجامعة!`);
        }
        const studentData = studentDoc.data();
        const studentRealName = studentData.name || cleanedStudentId;
        localStorage.setItem(`muc_student_name_${cleanedStudentId}`, studentRealName);

const enrolledList = studentData.enrolledCourses || [];
        const currentCourseId = String(sessionData.courseId || "").trim();
        const lowerCourseId = currentCourseId.toLowerCase();
        const lowerCourseCode = String(sessionData.courseCode || "").trim().toLowerCase();

        const isPraxisCourse = lowerCourseId.includes("praxis");
        const isEnrolledInAnyPraxis = isPraxisCourse && (
            enrolledList.some(id => String(id).toLowerCase().includes("praxis") || String(id).toLowerCase().includes("cse212")) ||
            (studentData.sections && Object.keys(studentData.sections).some(k => k.toLowerCase().includes("praxis") || k.toLowerCase().includes("cse212")))
        );

        const isEnrolled = !currentCourseId || currentCourseId === "MUC_COURSE" ||
            enrolledList.some(id => {
                const lid = String(id).trim().toLowerCase();
                return lid === lowerCourseId || (lowerCourseCode && lid === lowerCourseCode);
            }) ||
            isEnrolledInAnyPraxis ||
            (studentData.sections && Object.keys(studentData.sections).some(k => {
                const lk = String(k).trim().toLowerCase();
                return lk === lowerCourseId || (lowerCourseCode && lk === lowerCourseCode);
            }));

        if (!isEnrolled) {
            throw new Error(`NOT_ENROLLED:${studentRealName}:${sessionData.courseName || "هذا المقرر"}`);
        }

        try {
            const deviceDoc = await withTimeout(getDoc(deviceRef), 3500);
            if (deviceDoc.exists()) {
                const devData = deviceDoc.data();
                if (devData.studentId && devData.studentId !== cleanedStudentId) {
                    throw new Error("Security Alert: This phone was already used to check in for another student!");
                }
            }
        } catch (e) {
            if (e.message && e.message.includes("Security Alert")) throw e;
        }

// قفل الرقم الجامعي بحد أقصى هاتفين (2 Devices) مع حفظ توقيت وموديل كل هاتف بصورة مستقلة
        try {
            const hwKey = localStorage.getItem("muc_hw_bound_key") || safeDeviceId;
            const idLockRef = doc(db, "attendance_devices", `id_lock_${cleanedStudentId}`);
            const idLockSnap = await withTimeout(getDoc(idLockRef), 3000);
            const lockData = idLockSnap.exists() ? (idLockSnap.data() || {}) : {};
            const nowISO = new Date().toISOString();

            let boundDevicesList = Array.isArray(lockData.devices) ? [...lockData.devices] : [];
            if (boundDevicesList.length === 0 && lockData.deviceId) {
                const rawName = String(lockData.deviceName || "");
                const namePart1 = rawName.includes(" + ") ? rawName.split(" + ")[0].trim() : (rawName.includes(" | ") ? rawName.split(" | ")[0].replace(/^[هاتف 1]\s*/, "").trim() : (rawName || "هاتف 1"));
                boundDevicesList.push({
                    deviceId: lockData.deviceId,
                    legacyDeviceId: lockData.legacyDeviceId || lockData.deviceId,
                    deviceName: namePart1,
                    screenInfo: lockData.screenInfo || "",
                    lockedAtISO: lockData.firstLockedAtISO || lockData.lockedAtISO || nowISO
                });
            }

            const isMyDev = boundDevicesList.some(d => d.deviceId === hwKey || d.deviceId === safeDeviceId || d.legacyDeviceId === safeDeviceId);

            if (idLockSnap.exists() && !isMyDev && boundDevicesList.length >= 2) {
                throw new Error("🚫 هذا الرقم الجامعي مسجل ومربوط بهاتفين بالفعل (الحد الأقصى هاتفان)! يرجى التحدث مع المشرف.");
            } else if (!idLockSnap.exists() || !isMyDev) {
                const ua = navigator.userAgent || "";
                const quickPhoneName = /iPhone/i.test(ua) ? "Apple iPhone" : (/Android/i.test(ua) ? ((ua.match(/Android\s+[\d.]+;\s*([^;)]+)/i) || ["", "Android Phone"])[1].replace(/Build\/.*/i, "").trim()) : "هاتف ذكي");
                
                const newDevObj = {
                    deviceId: hwKey,
                    legacyDeviceId: safeDeviceId,
                    deviceName: quickPhoneName,
                    screenInfo: `${screen.width}x${screen.height}`,
                    lockedAtISO: nowISO
                };

                let updatedList = [];
                let firstTime = lockData.firstLockedAtISO || (boundDevicesList[0]?.lockedAtISO) || nowISO;
                let secondTime = lockData.secondLockedAtISO || "";

                if (boundDevicesList.length === 0) {
                    updatedList = [newDevObj];
                    firstTime = nowISO;
                } else {
                    const otherDev = boundDevicesList.find(d => d.deviceId !== hwKey && d.deviceId !== safeDeviceId);
                    if (otherDev) {
                        updatedList = [otherDev, newDevObj];
                        firstTime = otherDev.lockedAtISO || firstTime;
                        secondTime = nowISO;
                    } else {
                        updatedList = [newDevObj];
                        firstTime = newDevObj.lockedAtISO || nowISO;
                    }
                }

                await withTimeout(setDoc(idLockRef, {
                    studentId: cleanedStudentId,
                    studentName: studentRealName,
                    department: studentData.department || "هندسة الحاسب",
                    academicYear: String(studentData.academicYear || "2"),
                    devices: updatedList,
                    deviceIds: updatedList.map(d => d.deviceId),
                    deviceId: updatedList[0]?.deviceId || hwKey,
                    secondDeviceId: updatedList[1]?.deviceId || "",
                    deviceName: updatedList.map((d, i) => `[هاتف ${i+1}] ${d.deviceName}`).join(" | "),
                    screenInfo: updatedList[0]?.screenInfo || `${screen.width}x${screen.height}`,
                    firstLockedAtISO: firstTime,
                    secondLockedAtISO: secondTime,
                    lockedAt: serverTimestamp(),
                    lockedAtISO: secondTime || firstTime
                }, { merge: true }), 3000);
                localStorage.setItem(`muc_lock_claimed_${cleanedStudentId}`, "1");
            }
        } catch (lockErr) {
            if (String(lockErr.message || "").includes("مربوط بهاتفين")) throw lockErr;
        }
        const startTime = (sessionData.startTime && sessionData.startTime.toDate) ? sessionData.startTime.toDate() : new Date();

        const diffMinutes = (Date.now() - startTime.getTime()) / 60000;
        const status = (!isAllowedOfflineSession && diffMinutes > (sessionData.lateThresholdMinutes || CONFIG.attendance.lateThresholdMinutes))
            ? CONFIG.attendance.statuses.LATE
            : CONFIG.attendance.statuses.PRESENT;

const cleanSavedCourseName = isPraxis ? "Praxis Programming" : String(sessionData.courseName || "Course").replace(/\s*[-–—]?\s*(Lecture|محاضرة|Lec)\s*[12]/gi, "").trim();

await withTimeout(setDoc(recordRef, {
            recordId: recordId,
            sessionId: sessionId,
            courseId: sessionData.courseId || "MUC_COURSE",
            courseName: cleanSavedCourseName,
            lectureNumber: currentLecNum,
            studentId: cleanedStudentId,
            studentName: studentRealName,
            deviceId: safeDeviceId,
            status: status,
            recordedAt: serverTimestamp(),
            method: clientToken === "PIN_VERIFIED" ? "PIN_CODE" : "QR_SCAN"
        }, { merge: true }), 4500);

markLectureAttendedLocally(cleanedStudentId, sessionData.courseId, currentLecNum, sessionId);


        removeFromQueue({ studentId: cleanedStudentId, sessionId: sessionId, courseId: sessionData.courseId, scannedAt: Date.now() });

const now = new Date();
return {
            success: true,
            studentName: studentRealName,
            studentId: cleanedStudentId,
            courseName: cleanSavedCourseName,
            lectureNumber: Number(sessionData.lectureNumber || 1),
            sessionType: sessionData.sessionType || "lecture",
            status: status,
            date: now.toLocaleDateString("en-US"),
            time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
        };

    } finally {
        activeSubmissionLocks.delete(lockKey);
    }
}

export async function queueOfflineAttendance({ studentId, studentName, sessionId, courseId, courseName, lectureNumber, timeSlot, hash, sessionStart, sessionType, group, hostRole, doctorId, pin }) {
    const cleanedStudentId = String(studentId).trim();
    if (!sessionId) {
        throw new Error("⚠️ رمز الحضور غير صالح، يرجى مسح الباركود مرة أخرى.");
    }



    const queue = JSON.parse(localStorage.getItem("muc_pending_records") || "[]");
    const deviceId = getLocalDeviceId();
    const todayCA = new Date().toLocaleDateString("en-CA");
    const nowMs = Date.now();
    const SAME_LEC_WINDOW_MS = 45 * 60 * 1000;
const isPraxis = String(courseId || "").toLowerCase().includes("praxis") || String(courseName || "").toLowerCase().includes("praxis");
    const targetLec = Number(lectureNumber || 1);

// فحص هل المحاضرة مسجلة لنفس كود الجلسة (sessionId) تحديداً على هذا الهاتف
    if (isLectureAlreadyAttendedLocally(cleanedStudentId, courseId, targetLec, sessionId)) {
        throw new Error(`⚠️ لقد قمت بتسجيل حضورك لهذه المحاضرة بالفعل (Lecture #${targetLec})!\n\nYou have already checked in for Lecture #${targetLec}!`);
    }

    const exactSessionExists = queue.some(q => q.studentId === cleanedStudentId && q.sessionId === sessionId);
    if (exactSessionExists) {
        throw new Error(`⚠️ لقد قمت بتسجيل حضورك لهذه المحاضرة بالفعل ومحفوظ على هاتفك!\n\nYou have already checked in for this session!`);
    }
    const deviceExists = queue.some(q => q.studentId !== cleanedStudentId && (
        q.sessionId === sessionId || (nowMs - (q.scannedAt || 0) < SAME_LEC_WINDOW_MS)
    ));
    if (deviceExists) {
        throw new Error("⚠️ حماية أمنية: تم استخدام هذا الهاتف لتسجيل طالب آخر في هذه المحاضرة!");
    }

// استبدال أي محاولة سابقة لنفس رقم المحاضرة عند إعادة فتحها من قِبل الدكتور
    const cleanedQueue = queue.filter(q => {
        if (q.studentId !== cleanedStudentId) return true;
        const isSameLectureAttempt = (String(q.courseId).toLowerCase() === String(courseId).toLowerCase()) && Number(q.lectureNumber || 1) === targetLec;
        return !isSameLectureAttempt;
    });

    const record = {
        studentId: cleanedStudentId,
        studentName: studentName || "طالب",
        sessionId: String(sessionId).trim(),
        courseId: courseId || "MUC_COURSE",
        courseName: courseName || "المقرر الدراسي",
        lectureNumber: Number(lectureNumber) || 1,
        startedAtDate: todayCA,
        deviceId: deviceId,
        timeSlot: timeSlot || 0,
        hash: hash || "",
        scannedAt: nowMs,
        sessionStart: Number(sessionStart) || 0,
        sessionType: sessionType || "",
        hostRole: hostRole || "",
        group: group || "",
        pin: pin || "",
        doctorId: doctorId || ""
    };

cleanedQueue.push(record);
    localStorage.setItem("muc_pending_records", JSON.stringify(cleanedQueue));
markLectureAttendedLocally(cleanedStudentId, courseId, targetLec, sessionId);
    return record;
}

let isSyncing = false;

function checkLectureMatch(courseId, courseName, studentId) {
    return null;
}

function removeFromQueue(item) {
    const key = item.origSessionId || item.sessionId;
    const q = JSON.parse(localStorage.getItem("muc_pending_records") || "[]");
    localStorage.setItem("muc_pending_records", JSON.stringify(
        q.filter(x => {
            if (x.studentId !== item.studentId) return true;
            if (x.sessionId === key || x.sessionId === item.sessionId) return false;
            if (x.pin && Math.abs((x.scannedAt || 0) - (item.scannedAt || 0)) < 45 * 60 * 1000) return false;
            return true;
        })
    ));
}

export async function syncPendingAttendance() {
    if (!navigator.onLine) return -1;
    if (isSyncing) {
        for (let w = 0; w < 12 && isSyncing; w++) {
            await new Promise(r => setTimeout(r, 350));
        }
        return getPendingCount() === 0 ? 1 : 0;
    }

    const queue = JSON.parse(localStorage.getItem("muc_pending_records") || "[]");
    if (queue.length === 0) return 0;

    let uploaded = 0;
    isSyncing = true;
    try {
        if (!auth.currentUser) {
            await withTimeout(signInAnonymously(auth), 4500);
        }

for (const item of queue) {
            try {
                // أ) لو السجل عبارة عن PIN أوفلاين، نبحث في attendance_pins ثم في pinHistory ثم بمطابقة رقم المحاضرة والمقرر
                if (item.pin) {
                    item.origSessionId = item.origSessionId || item.sessionId;
                    let matchedSessionData = null;
                    const decodedMeta = decodePinMetadata(item.pin);

                    try {
                        const pinSnap = await withTimeout(getDoc(doc(db, "attendance_pins", String(item.pin))), 4000);
                        if (pinSnap.exists()) {
                            matchedSessionData = pinSnap.data() || {};
                        }
                    } catch (e) {}

                    if (!matchedSessionData) {
                        try {
                            const qSnap = await withTimeout(getDocs(query(
                                collection(db, "attendance_sessions"),
                                where("pinHistory", "array-contains", Number(item.pin))
                            )), 4500);
                            if (!qSnap.empty) {
                                const sortedDocs = qSnap.docs.slice().sort((a, b) => {
                                    const tA = (a.data().startTime && a.data().startTime.seconds) || 0;
                                    const tB = (b.data().startTime && b.data().startTime.seconds) || 0;
                                    return tB - tA;
                                });
                                const docMatch = sortedDocs.find(d =>
                                    (!item.courseId || item.courseId === "MUC_COURSE" || String(d.data().courseId || "").toLowerCase() === String(item.courseId).toLowerCase()) &&
                                    (!item.lectureNumber || Number(d.data().lectureNumber) === Number(item.lectureNumber))
                                ) || sortedDocs[0];
                                matchedSessionData = { sessionId: docMatch.id, ...docMatch.data() };
                            }
                        } catch (e) {}
                    }

                    // بحث بديل ذكي: لو الدكتور كان أوفلاين وقت توليد الـ PIN ورفع المحاضرة لاحقاً بدون pinHistory
                    if (!matchedSessionData) {
                        try {
                            const targetLecNum = Number(item.lectureNumber || decodedMeta.lectureNumber || 1);
                            const qLecSnap = await withTimeout(getDocs(query(
                                collection(db, "attendance_sessions"),
                                where("lectureNumber", "==", targetLecNum)
                            )), 4500);
                            if (!qLecSnap.empty) {
                                const candidates = qLecSnap.docs
                                    .map(d => ({ sessionId: d.id, ...d.data() }))
                                    .filter(s => s.status !== "deleted" && !s.finalized)
                                    .filter(s => {
                                        const sCid = String(s.courseId || s.courseCode || "").trim().toLowerCase();
                                        const iCid = String(item.courseId || "").trim().toLowerCase();
                                        return (iCid && iCid !== "muc_course" && sCid === iCid) ||
                                               getCoursePinIndex(s.courseId || s.courseCode || "") === decodedMeta.courseIdx;
                                    })
                                    .sort((a, b) => ((b.startTime && b.startTime.seconds) || 0) - ((a.startTime && a.startTime.seconds) || 0));

                                if (candidates.length > 0) {
                                    matchedSessionData = candidates[0];
                                }
                            }
                        } catch (e) {}
                    }

                    if (!matchedSessionData || !matchedSessionData.sessionId) {
                        if (Date.now() - (item.scannedAt || 0) > 12 * 3600 * 1000) removeFromQueue(item);
                        continue;
                    }

                    item.sessionId = matchedSessionData.sessionId;
                    item.courseId = matchedSessionData.courseId || item.courseId || "";
                    item.courseName = matchedSessionData.courseName || item.courseName || "المقرر الدراسي";
                }

                // ب) فحص الجلسة على السيرفر وتوحيد حالة أحرف courseId مع السيرفر
                let sessionDeletedOrFinalized = false;
                let sessionExistsOnServer = false;
                try {
                    const sessSnap = await withTimeout(getDoc(doc(db, "attendance_sessions", item.sessionId)), 4500);
                    if (sessSnap.exists()) {
                        sessionExistsOnServer = true;
                        const sData = sessSnap.data() || {};
                        if (sData.status === "deleted" || sData.finalized === true) {
                            sessionDeletedOrFinalized = true;
                        }
                        if (sData.courseId) item.courseId = sData.courseId;
                        if (sData.courseName) item.courseName = sData.courseName;
                    }
                } catch (err) {}

                if (sessionDeletedOrFinalized) {
                    removeFromQueue(item);
                    continue;
                }

                if (!sessionExistsOnServer) {
                    if (Date.now() - (item.scannedAt || 0) > 12 * 3600 * 1000) removeFromQueue(item);
                    continue;
                }

                const mismatch = checkLectureMatch(item.courseId, item.courseName, item.studentId);
                if (mismatch) {
                    localStorage.setItem("muc_sync_error", mismatch === "WRONG_LEC_2"
                        ? `⚠️ حضور الرقم (${item.studentId}) لم يُسجَّل: هذه المحاضرة الأولى وأنت مسجل في المحاضرة الثانية.`
                        : `⚠️ حضور الرقم (${item.studentId}) لم يُسجَّل: هذه المحاضرة الثانية وأنت مسجل في المحاضرة الأولى.`);
                    removeFromQueue(item);
                    continue;
                }

                let realStudentName = item.studentName || "طالب";
                const stdSnap = await withTimeout(getDoc(doc(db, "students", item.studentId)), 4500);
                if (stdSnap.exists()) {
                    const sData = stdSnap.data();
                    realStudentName = sData.name || realStudentName;
                    localStorage.setItem(`muc_student_name_${item.studentId}`, realStudentName);

                    const enrolled = sData.enrolledCourses || [];
                    const lowerCourseId = String(item.courseId || "").trim().toLowerCase();
                    const isPraxisSync = lowerCourseId.includes("praxis") && enrolled.some(id => String(id).toLowerCase().includes("praxis") || String(id).toLowerCase().includes("cse212"));
                    const isEnrolledSync = !lowerCourseId || lowerCourseId === "muc_course" || isPraxisSync ||
                        enrolled.some(id => String(id).trim().toLowerCase() === lowerCourseId) ||
                        (sData.sections && Object.keys(sData.sections).some(k => String(k).trim().toLowerCase() === lowerCourseId));

                    if (!isEnrolledSync) {
                        localStorage.setItem("muc_sync_error", `⚠️ الرقم (${item.studentId}) غير مقيد في مقرر (${item.courseName || item.courseId})!`);
                        removeFromQueue(item);
                        continue;
                    }
                } else {
                    localStorage.setItem("muc_sync_error", `⚠️ الرقم الجامعي (${item.studentId}) غير مسجل بقاعدة البيانات!`);
                    removeFromQueue(item);
                    continue;
                }

                const recordId = `${item.sessionId}_${item.studentId}`;
                const existingRecSnap = await withTimeout(getDoc(doc(db, "attendance_records", recordId)), 4000);
                if (existingRecSnap.exists()) {
                    removeFromQueue(item);
                    uploaded++;
                    continue;
                }

                const isPraxisSync = String(item.courseId || "").toLowerCase().includes("praxis") || String(item.courseName || "").toLowerCase().includes("praxis");
                const cleanSyncCourseName = isPraxisSync ? "Praxis Programming" : String(item.courseName || "المقرر الدراسي").replace(/\s*[-–—]?\s*(Lecture|محاضرة|Lec)\s*[12]/gi, "").trim();

                const recordData = {
                    recordId,
                    sessionId: item.sessionId,
                    courseId: item.courseId || "MUC_COURSE",
                    courseName: cleanSyncCourseName,
                    lectureNumber: Number(item.lectureNumber || 1),
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

                await withTimeout(setDoc(doc(db, "attendance_records", recordId), recordData, { merge: true }), 4500);

                try {
                    await withTimeout(setDoc(doc(db, "attendance_devices", `${item.sessionId}_${item.deviceId}`), {
                        sessionId: item.sessionId,
                        deviceId: item.deviceId,
                        studentId: item.studentId,
                        createdAt: serverTimestamp()
                    }, { merge: true }), 3000);
                } catch (e) {}

                removeFromQueue(item);
                uploaded++;
            } catch (err) {
                console.warn("Retaining offline record until session is available:", err.message);
            }
        }
    } catch (e) {
        console.warn("sync notice:", e);
    } finally {
        isSyncing = false;
    }
    return uploaded;
}

export function getPendingCount() {
    if (!localStorage.getItem("muc_purge_old_sync_v3")) {
        localStorage.removeItem("muc_pending_records");
        localStorage.removeItem("muc_sync_error");
        localStorage.setItem("muc_purge_old_sync_v3", "done");
        return 0;
    }

    const rawQueue = JSON.parse(localStorage.getItem("muc_pending_records") || "[]");
    if (rawQueue.length === 0) return 0;

    const nowMs = Date.now();
    const MAX_AGE_MS = 12 * 3600 * 1000;
    const seenLectureKeys = new Set();

    const cleanQueue = rawQueue.filter(item => {
        const sid = String(item.studentId || "").trim();
        if (sid.length < 7) return false;
        if (nowMs - (item.scannedAt || 0) > MAX_AGE_MS) return false;

        // مفتاح فريد لكل محاضرة/مقرر حتى لا يمسح محاضرة مادة أخرى لو حضر الطالب محاضرتين أوفلاين متتاليتين
        const lecKey = item.pin
            ? `${sid}_PIN_${Math.floor((item.scannedAt || 0) / (45 * 60 * 1000))}`
            : `${sid}_${item.courseId && item.courseId !== "MUC_COURSE" ? item.courseId + "_" + (item.lectureNumber || 1) : item.sessionId}`;

        if (seenLectureKeys.has(lecKey)) return false;
        seenLectureKeys.add(lecKey);
        return true;
    });

    if (cleanQueue.length !== rawQueue.length) {
        localStorage.setItem("muc_pending_records", JSON.stringify(cleanQueue));
    }

    return cleanQueue.length;
}

function triggerSmoothSync() {
    if (!navigator.onLine || isSyncing) return;
    const randomJitterMs = Math.floor(Math.random() * 4000) + 800;
    setTimeout(() => {
        syncPendingAttendance();
    }, randomJitterMs);
}

window.addEventListener("online", triggerSmoothSync);
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") triggerSmoothSync();
});
setInterval(triggerSmoothSync, 20000);

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