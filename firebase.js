/**
 * MUC Student Attendance Client Module - Fully Protected
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
    getAuth, 
    signInAnonymously 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
    initializeFirestore,
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
export const db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true
});

let _anonAuthPromise = null;
export async function ensureStudentAuth() {
    if (auth.currentUser) return auth.currentUser;
    if (!_anonAuthPromise) {
        _anonAuthPromise = signInAnonymously(auth).finally(() => {
            _anonAuthPromise = null;
        });
    }
    return _anonAuthPromise;
}

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
    if (s.includes("praxis")) return 27;
    if (!s) return 0;
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = (h * 31 + s.charCodeAt(i)) % 30;
    }
    return Math.abs(h) % 30;
}

export function cleanCourseDisplayName(name) {
    const s = String(name || "").trim();
    if (!s) return "";
    if (s.toLowerCase().includes("praxis")) return "Praxis Programming";
    return s.replace(/\s*[-–—]?\s*(محاضرة|Lecture|Lec)\s*[12]/gi, "").trim();
}

const KNOWN_MUC_COURSES = {
    "cse216": "Web Design and Database (CSE216)",
    "user_centered": "User Centered Design",
    "cse_modern_workshop": "Modern Workshop",
    "cse122": "Logic Design (CSE122)",
    "praxis_programming_lec1": "Praxis Programming",
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
const saltVal = Math.floor(codeVal / 900);
const typeIdx = isOfflineModePin ? Math.floor(saltVal / 3) : 0;
const sessionType = typeIdx === 2 ? "lab" : (typeIdx === 1 ? "section" : "lecture");
    let courseId = "";
    let courseName = "";

    try {
        const cachedMap = JSON.parse(localStorage.getItem("muc_course_names_map") || "{}");
        const enrolled = JSON.parse(localStorage.getItem("muc_student_courses") || "[]");

        // 1. فحص مقررات الطالب المقيد بها أولاً بدقة
        for (const cid of enrolled) {
            if (getCoursePinIndex(cid) === courseIdx) {
                courseId = cid;
                courseName = cachedMap[cid] || formatReadableCourseId(cid);
                break;
            }
        }
        // 2. فحص كاش المقررات المحفوظ في الهاتف
        if (!courseName) {
            for (const [cid, cname] of Object.entries(cachedMap)) {
                if (getCoursePinIndex(cid) === courseIdx) {
                    courseId = cid;
                    courseName = cname;
                    break;
                }
            }
        }
        // 3. فحص القائمة المعرفة رسمياً
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

    const resolvedName = cleanCourseDisplayName(courseName) || formatReadableCourseId(courseId) || "المقرر الدراسي";

    return {
        isOfflineModePin,
        lectureNumber: extractedLecNum,
        courseIdx,
                sessionType,
        courseId: courseId || "MUC_COURSE",
        courseName: resolvedName
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
    return false;
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
    return null;
}

// مطابقة ذكية لأرقام وأسماء السكاشن (مثال: Section 01 = سكشن 1 = جروب 1، ويرفض Section 03)
export function doSectionGroupsMatch(stdGrpRaw, sessGrpRaw) {
    const toEnDigits = (s) => String(s || "").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).trim().toLowerCase();
    const a = toEnDigits(stdGrpRaw);
    const b = toEnDigits(sessGrpRaw);
    if (!a || !b) return true;
    if (a === b) return true;

    const getDeptTag = (str) => {
        if (/comp|حاسب|cse/.test(str)) return "comp";
        if (/eee|elec|كهرب/.test(str)) return "eee";
        if (/robo|روبوت|mecha/.test(str)) return "robo";
        if (/arch|معمار/.test(str)) return "arch";
        return "";
    };
    const deptA = getDeptTag(a);
    const deptB = getDeptTag(b);
    if (deptA && deptB && deptA !== deptB) return false;

    const numA = a.match(/\d+/);
    const numB = b.match(/\d+/);
    if (numA && numB) {
        return parseInt(numA[0], 10) === parseInt(numB[0], 10);
    }
    return a === b;
}

// استخراج سكشن ومعيد الطالب في المقرر الحالي ومقارنته بجلسة السكشن/المعمل المفتوحة
export function verifyStudentSectionAndTA(studentData, sessionData) {
    if (!studentData || !sessionData) return;

    const sessType = String(sessionData.sessionType || "").toLowerCase();
    const hostRole = String(sessionData.hostRole || "").toLowerCase();
    const rawSessGroup = String(sessionData.group || "").trim();
    const isLectureGroupLabel = /^(محاضره|محاضرة|lecture|lec)\s*\d*$/i.test(rawSessGroup);

    // الفحص يطبق على السكاشن والمعامل وجلسات المعيدين فقط (وليس محاضرات الدكتور العامة)
    const isSectionOrLab = sessType === "section" || sessType === "lab" || hostRole === "ta" || (rawSessGroup && !isLectureGroupLabel);
    if (!isSectionOrLab) return;

    const cid = String(sessionData.courseId || "").trim().toLowerCase();
    const ccode = String(sessionData.courseCode || "").trim().toLowerCase();
    const isPraxis = cid.includes("praxis") || ccode.includes("praxis") || cid.includes("cse212");
    const sections = studentData.sections || {};

    let stdGroup = "";
    let stdTaId = "";

    // 1. البحث في سكشن المقرر الحالي للطالب
    for (const [k, v] of Object.entries(sections)) {
        const lk = String(k).trim().toLowerCase();
        if (lk === cid || (ccode && lk === ccode) || (isPraxis && (lk.includes("praxis") || lk.includes("cse212")))) {
            if (typeof v === "string") {
                stdGroup = v.trim();
            } else if (v && typeof v === "object") {
                stdGroup = String(v.group || v.groupName || v.section || "").trim();
                stdTaId = String(v.taId || "").trim();
            }
            break;
        }
    }

    // 2. احتياطي من السكشن العام للطالب إذا لم يكن مسجلاً تحت اسم المادة مباشرة
    if (!stdGroup) {
        stdGroup = String(studentData.section || studentData.group || "").trim();
    }
    if (!stdGroup) {
        const firstSec = Object.values(sections)[0];
        if (typeof firstSec === "string") stdGroup = firstSec.trim();
        else if (firstSec && typeof firstSec === "object") {
            stdGroup = String(firstSec.group || firstSec.groupName || firstSec.section || "").trim();
        }
    }

    const studentRealName = studentData.name || studentData.studentId || "الطالب";

    // أ) إذا كان السكشن المفتوح محدداً برقم سكشن/مجموعة (مثل سكشن 3) والطالب في سكشن آخر (مثل سكشن 1) -> رفض فوري!
    if (rawSessGroup && !isLectureGroupLabel && stdGroup) {
        if (!doSectionGroupsMatch(stdGroup, rawSessGroup)) {
            throw new Error(`WRONG_SECTION:${studentRealName}:${stdGroup}:${rawSessGroup}:${sessionData.doctorName || ""}`);
        }
    }

    // ب) إذا كان الطالب مربوطاً بمعيد محدد في هذه المادة والسكشن مفتوح من معيد آخر لمجموعة أخرى -> رفض فوري!
    if (hostRole === "ta" && stdTaId && sessionData.doctorId && stdTaId !== sessionData.doctorId) {
        if (!rawSessGroup || !stdGroup || !doSectionGroupsMatch(stdGroup, rawSessGroup)) {
            throw new Error(`WRONG_SECTION:${studentRealName}:${stdGroup || "مجموعة أخرى"}:${rawSessGroup || "سكشن المعيد الحالي"}:${sessionData.doctorName || ""}`);
        }
    }
}

const activeSubmissionLocks = new Set();

function withTimeout(promise, ms = 10000) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("NETWORK_TIMEOUT")), ms))
    ]);
}

// فحص كود الـ PIN على السيرفر بسرعة فائقة وعلى التوازي
export async function verifyPinOnServerFast(enteredPin) {
    await withTimeout(ensureStudentAuth(), 6000);
    const pinNum = Number(enteredPin);

    const checkOnce = async () => {
        const [pinDocRes, queryRes] = await Promise.allSettled([
            withTimeout(getDoc(doc(db, "attendance_pins", String(enteredPin))), 7000),
            withTimeout(getDocs(query(collection(db, "attendance_sessions"), where("pinHistory", "array-contains", pinNum))), 7000)
        ]);

        if (pinDocRes.status === "fulfilled" && pinDocRes.value.exists()) {
            const pData = pinDocRes.value.data() || {};
            if (pData.sessionId) {
                try {
                    const sSnap = await withTimeout(getDoc(doc(db, "attendance_sessions", pData.sessionId)), 6000);
                    if (sSnap.exists()) {
                        const sData = sSnap.data() || {};
                        if (sData.status === "deleted" || sData.finalized === true || sData.pinClosed === true) {
                            return { status: "EXPIRED" };
                        }
                        if (!sData.qrOffline && sData.status !== "active") {
                            return { status: "EXPIRED" };
                        }
                        const isCurrentOrPrevPin =
                            !sData.activePinCode ||
                            Number(sData.activePinCode) === pinNum ||
                            Number(sData.prevPinCode) === pinNum;
                        if (!isCurrentOrPrevPin) return { status: "EXPIRED" };
                        return { status: "VALID", sessionId: sSnap.id, sessionData: sData, pinMeta: pData };
                    }
                } catch (e) {}
            }
        }

        if (queryRes.status === "fulfilled" && !queryRes.value.empty) {
            const qSnap = queryRes.value;
            const activeDoc = qSnap.docs.find(d => d.data().status === "active" || d.data().qrOffline === true) || qSnap.docs[0];
            const sData = activeDoc.data() || {};
            if (sData.status === "deleted" || sData.finalized === true || sData.pinClosed === true) {
                return { status: "EXPIRED" };
            }
            if (!sData.qrOffline && sData.status !== "active") {
                return { status: "EXPIRED" };
            }
            const isCurrentOrPrevPin =
                !sData.activePinCode ||
                Number(sData.activePinCode) === pinNum ||
                Number(sData.prevPinCode) === pinNum;
            if (!isCurrentOrPrevPin) return { status: "EXPIRED" };
            return { status: "VALID", sessionId: activeDoc.id, sessionData: sData, pinMeta: sData };
        }

        return { status: "NOT_FOUND" };
    };

    let resCheck = await checkOnce();
    if (resCheck.status === "NOT_FOUND") {
        await new Promise(r => setTimeout(r, 900));
        resCheck = await checkOnce();
    }
    return resCheck;
}

export async function recordStudentAttendance(sessionId, clientToken, studentIdInput, deviceId, preloadedSessionData = null) {
    const cleanedStudentId = String(studentIdInput || "").trim();
    if (!cleanedStudentId) throw new Error("Please enter your Student ID.");

    const lockKey = `${sessionId}_${cleanedStudentId}`;
    if (activeSubmissionLocks.has(lockKey)) {
        throw new Error("Your check-in is already being processed. Please wait a moment.");
    }
    activeSubmissionLocks.add(lockKey);

    try {
        await withTimeout(ensureStudentAuth(), 6000);

        const safeDeviceId = String(deviceId || getLocalDeviceId()).replace(/[^a-zA-Z0-9_-]/g, "");
        const sessionRef = doc(db, "attendance_sessions", sessionId);
        const recordId = `${sessionId}_${cleanedStudentId}`;
        const recordRef = doc(db, "attendance_records", recordId);
        const deviceRef = doc(db, "attendance_devices", `${sessionId}_${safeDeviceId}`);
        const studentRef = doc(db, "students", cleanedStudentId);
        const idLockRef = doc(db, "attendance_devices", `id_lock_${cleanedStudentId}`);

        // ⚡ جلب كافة المستندات معاً في طلب متوازٍ واحد لتسريع التسجيل 5 أضعاف في المدرج
        const [sessionSnap, existingRecord, studentDoc, deviceDoc, idLockSnap] = await withTimeout(
            Promise.all([
                preloadedSessionData ? Promise.resolve({ exists: () => true, data: () => preloadedSessionData }) : getDoc(sessionRef),
                getDoc(recordRef),
                getDoc(studentRef),
                getDoc(deviceRef).catch(() => ({ exists: () => false })),
                getDoc(idLockRef).catch(() => ({ exists: () => false }))
            ]),
            10000
        );

        let sessionData = sessionSnap.exists() ? sessionSnap.data() : null;
        if (!sessionData) {
            await new Promise(r => setTimeout(r, 900));
            const retrySnap = await withTimeout(getDoc(sessionRef), 7000);
            if (!retrySnap.exists()) {
                throw new Error("جاري بدء وتثبيت الجلسة على السيرفر.. يرجى إعادة المحاولة خلال ثوانٍ.");
            }
            sessionData = retrySnap.data();
        }

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

        // 1. فحص السجل المباشر للجلسة الحالية على السيرفر
        if (existingRecord && existingRecord.exists()) {
            markLectureAttendedLocally(cleanedStudentId, sessionData.courseId, currentLecNum, sessionId);
            throw new Error(`⚠️ لقد قمت بتسجيل حضورك لهذه المحاضرة بالفعل (Lecture #${currentLecNum})!`);
        }

        // 2. فحص السحابة لمادة البراكسيس لمنع حضور الفترتين L1 و L2 لنفس المحاضرة
        if (isPraxis) {
            try {
                const qAlready = query(collection(db, "attendance_records"), where("studentId", "==", cleanedStudentId));
                const prevSnap = await withTimeout(getDocs(qAlready), 4500);
                const alreadyAttended = prevSnap.docs.some(docSnap => {
                    const r = docSnap.data();
                    const rCourse = String(r.courseId || "").toLowerCase();
                    const rIsPraxis = rCourse.includes("praxis") || String(r.courseName || "").toLowerCase().includes("praxis");
                    return rIsPraxis && Number(r.lectureNumber || 0) === currentLecNum;
                });
                if (alreadyAttended) {
                    markLectureAttendedLocally(cleanedStudentId, sessionData.courseId, currentLecNum, sessionId);
                    throw new Error(`⚠️ لقد قمت بتسجيل حضورك لهذه المحاضرة بالفعل (Lecture #${currentLecNum})!`);
                }
            } catch (checkErr) {
                if (String(checkErr.message || "").includes("لقد قمت بتسجيل حضورك")) throw checkErr;
            }
        }

        clearLectureAttendedLocally(cleanedStudentId, sessionData.courseId, currentLecNum);

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

        // فحص صارم للسكشن والمعيد: منع طالب سكشن 1 من التسجيل في سكشن 3
        verifyStudentSectionAndTA(studentData, sessionData);

        if (deviceDoc && deviceDoc.exists()) {
            const devData = deviceDoc.data();
            if (devData.studentId && devData.studentId !== cleanedStudentId) {
                throw new Error("Security Alert: This phone was already used to check in for another student!");
            }
        }

        // فحص قفل الجهاز (حد أقصى هاتفين)
        const hwKey = localStorage.getItem("muc_hw_bound_key") || safeDeviceId;
        const lockData = (idLockSnap && idLockSnap.exists()) ? (idLockSnap.data() || {}) : {};
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
        if (idLockSnap && idLockSnap.exists() && !isMyDev && boundDevicesList.length >= 2) {
            throw new Error("🚫 هذا الرقم الجامعي مسجل ومربوط بهاتفين بالفعل (الحد الأقصى هاتفان)! يرجى التحدث مع المشرف.");
        }

        const startTime = (sessionData.startTime && sessionData.startTime.toDate) ? sessionData.startTime.toDate() : new Date();
        const diffMinutes = (Date.now() - startTime.getTime()) / 60000;
        const status = (!isAllowedOfflineSession && diffMinutes > (sessionData.lateThresholdMinutes || CONFIG.attendance.lateThresholdMinutes))
            ? CONFIG.attendance.statuses.LATE
            : CONFIG.attendance.statuses.PRESENT;

        const cleanSavedCourseName = isPraxis ? "Praxis Programming" : String(sessionData.courseName || "Course").replace(/\s*[-–—]?\s*(Lecture|محاضرة|Lec)\s*[12]/gi, "").trim();

        const writePromises = [
            setDoc(recordRef, {
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
            }, { merge: true })
        ];

        if (!idLockSnap || !idLockSnap.exists() || !isMyDev) {
            const ua = navigator.userAgent || "";
            const quickPhoneName = /iPhone/i.test(ua) ? "Apple iPhone" : (/Android/i.test(ua) ? ((ua.match(/Android\s+[\d.]+;\s*([^;)]+)/i) || ["", "Android Phone"])[1].replace(/Build\/.*/i, "").trim()) : "هاتف ذكي");
            const newDevObj = {
                deviceId: hwKey,
                legacyDeviceId: safeDeviceId,
                deviceName: quickPhoneName,
                screenInfo: `${screen.width}x${screen.height}`,
                lockedAtISO: nowISO
            };
            const otherDev = boundDevicesList.find(d => d.deviceId !== hwKey && d.deviceId !== safeDeviceId);
            const updatedList = (boundDevicesList.length > 0 && otherDev) ? [otherDev, newDevObj] : [newDevObj];
            const firstTime = (otherDev && otherDev.lockedAtISO) || lockData.firstLockedAtISO || nowISO;
            const secondTime = otherDev ? nowISO : (lockData.secondLockedAtISO || "");

            writePromises.push(
                setDoc(idLockRef, {
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
                }, { merge: true }).catch(() => {})
            );
            localStorage.setItem(`muc_lock_claimed_${cleanedStudentId}`, "1");
        }

        await withTimeout(Promise.all(writePromises), 9000);
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

// فحص قيد الطالب وسكشنه محلياً في وضع الأوفلاين
    try {
        const enrolled = JSON.parse(localStorage.getItem("muc_student_courses") || "[]").map(c => String(c).toLowerCase().trim());
        const studentSections = JSON.parse(localStorage.getItem("muc_student_sections") || "{}");
        const studentGeneralGroup = localStorage.getItem("muc_student_group") || "";
        const cidLower = String(courseId || "").toLowerCase().trim();

        // 1. فحص القيد في المقرر
        if (enrolled.length > 0) {
            const isPraxis = cidLower.includes("praxis") || String(courseName || "").toLowerCase().includes("praxis");
            const pinIdx = pin ? decodePinMetadata(pin).courseIdx : (cidLower && cidLower !== "muc_course" ? getCoursePinIndex(cidLower) : -1);

            const isEnrolled = (cidLower && cidLower !== "muc_course" && enrolled.includes(cidLower)) ||
                               (pinIdx >= 0 && enrolled.some(c => getCoursePinIndex(c) === pinIdx)) ||
                               (isPraxis && enrolled.some(c => c.includes("praxis") || c.includes("cse212")));

            if (!isEnrolled) {
                throw new Error(`NOT_ENROLLED:${studentName || cleanedStudentId}:${courseName || courseId}`);
            }
        }

        // 2. فحص السكشن الأوفلاين: منع طالب سكشن 1 من التسجيل في سكشن 4
        const sessGroup = String(group || "").trim();
        const isSessSection = sessionType === "section" || sessionType === "lab" || (sessGroup && !/^(محاضره|محاضرة|lecture|lec)\s*\d*$/i.test(sessGroup));

        if (isSessSection && sessGroup) {
            let myCourseGroup = "";
            for (const [k, v] of Object.entries(studentSections)) {
                if (String(k).toLowerCase().trim() === cidLower || cidLower.includes(String(k).toLowerCase().trim())) {
                    myCourseGroup = typeof v === "string" ? v : (v?.group || v?.groupName || v?.section || "");
                    break;
                }
            }
            if (!myCourseGroup) myCourseGroup = studentGeneralGroup;

            if (myCourseGroup && typeof doSectionGroupsMatch === "function") {
                if (!doSectionGroupsMatch(myCourseGroup, sessGroup)) {
                    throw new Error(`WRONG_SECTION:${studentName || cleanedStudentId}:${myCourseGroup}:${sessGroup}:${doctorId || ""}`);
                }
            }
        }
    } catch (e) {
        if (e.message && (e.message.startsWith("NOT_ENROLLED:") || e.message.startsWith("WRONG_SECTION:"))) throw e;
    }


    const queue = JSON.parse(localStorage.getItem("muc_pending_records") || "[]");
    const deviceId = getLocalDeviceId();
    const todayCA = new Date().toLocaleDateString("en-CA");
    const nowMs = Date.now();
    const SAME_LEC_WINDOW_MS = 45 * 60 * 1000;
const isPraxis = String(courseId || "").toLowerCase().includes("praxis") || String(courseName || "").toLowerCase().includes("praxis");
    const targetLec = Number(lectureNumber || 1);

// حماية أمنية: منع تسجيل طالب آخر من نفس الهاتف خلال نفس المحاضرة
    const deviceExists = queue.some(q => q.studentId !== cleanedStudentId && (
        q.sessionId === sessionId || (nowMs - (q.scannedAt || 0) < SAME_LEC_WINDOW_MS)
    ));
    if (deviceExists) {
        throw new Error("⚠️ حماية أمنية: تم استخدام هذا الهاتف لتسجيل طالب آخر في هذه المحاضرة!");
    }

    // استبدال أي سجل أوفلاين قديم لنفس الطالب في نفس المحاضرة بالسجل الجديد (لدعم إعادة المحاضرة بدون خطأ)
    const cleanedQueue = queue.filter(q => {
        if (q.studentId !== cleanedStudentId) return true;
        if (q.sessionId === sessionId) return false;
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
    if (isSyncing) return 0;

    const queue = JSON.parse(localStorage.getItem("muc_pending_records") || "[]");
    if (!Array.isArray(queue) || queue.length === 0) return 0;

    let uploaded = 0;
    isSyncing = true;

    try {
        if (!auth.currentUser) {
            await withTimeout(signInAnonymously(auth), 5000);
        }

        for (const item of queue) {
            try {
                let matchedSessionId = null;
                let matchedSessionData = null;

                // 1. إذا كان التسجيل بكود PIN: يجب أن يطابق الكود الفعلي للجلسة الحالية حصراً
                if (item.pin) {
                    const pinStr = String(item.pin).trim();
                    const pinNum = Number(pinStr);

                    // أ) البحث في جدول أكواد الـ PIN النشطة
                    try {
                        const pinSnap = await withTimeout(getDoc(doc(db, "attendance_pins", pinStr)), 4000);
                        if (pinSnap.exists()) {
                            const pData = pinSnap.data() || {};
                            if (pData.sessionId) {
                                matchedSessionId = pData.sessionId;
                                matchedSessionData = pData;
                            }
                        }
                    } catch (_) {}

                    // ب) البحث في تاريخ أكواد جلسة الدكتور
                    if (!matchedSessionId) {
                        try {
                            const qSnap = await withTimeout(getDocs(query(
                                collection(db, "attendance_sessions"),
                                where("pinHistory", "array-contains", pinNum)
                            )), 4500);
                            if (!qSnap.empty) {
                                const matchedDoc = qSnap.docs[0];
                                matchedSessionId = matchedDoc.id;
                                matchedSessionData = matchedDoc.data();
                            }
                        } catch (_) {}
                    }

                    // 🛑 إذا لم يرفع الدكتور الجلسة بعد: نتوقف فوراً ونُبقي السجل بأمان داخل هاتف الطالب
                    if (!matchedSessionId) {
                        console.log(`⏳ PIN (${pinStr}) not found on server yet. Waiting for instructor to sync...`);
                        continue;
                    }
                } else {
                    // في حالة مسح الـ QR: نستخدم معرّف الجلسة المباشر
                    matchedSessionId = item.sessionId;
                }

                // 2. التحقق من وجود الجلسة على السيرفر وأنها ليست محذوفة
                const sessSnap = await withTimeout(getDoc(doc(db, "attendance_sessions", matchedSessionId)), 4500);
                if (!sessSnap.exists()) {
                    continue; // الدكتور لم يرفع المحاضرة بعد -> انتظر ولا تمسح السجل
                }

                const sData = sessSnap.data() || {};
                if (sData.status === "deleted") {
                    removeFromQueue(item);
                    continue;
                }

                // 3. التحقق من قيد الطالب
                const stdSnap = await withTimeout(getDoc(doc(db, "students", item.studentId)), 4500);
                if (!stdSnap.exists()) {
                    removeFromQueue(item);
                    continue;
                }

                const studentRealName = stdSnap.data()?.name || item.studentName || "Student";
                const recordId = `${matchedSessionId}_${item.studentId}`;

                // 4. رفع وتثبيت حضور الطالب في جلسة الدكتور الفعلية
                const recordPayload = {
                    recordId,
                    sessionId: matchedSessionId,
                    courseId: sData.courseId || item.courseId || "MUC_COURSE",
                    courseName: sData.courseName || item.courseName || "Course",
                    lectureNumber: Number(sData.lectureNumber || item.lectureNumber || 1),
                    sessionType: sData.sessionType || item.sessionType || "lecture",
                    studentId: item.studentId,
                    studentName: studentRealName,
                    deviceId: item.deviceId || getLocalDeviceId(),
                    status: "Present",
                    method: item.pin ? "OFFLINE_PIN_SYNC" : "OFFLINE_QR_SYNC",
                    recordedAt: serverTimestamp(),
                    offlineScannedAt: new Date(item.scannedAt || Date.now()).toISOString()
                };

                await withTimeout(setDoc(doc(db, "attendance_records", recordId), recordPayload, { merge: true }), 4500);

                // حذف السجل من طابور الهاتف فقط بعد التأكد التام من وصوله للسيرفر
                removeFromQueue(item);
                uploaded++;
                console.log(`✅ Successfully synced attendance for student (${item.studentId})`);

            } catch (itemErr) {
                console.warn("Item sync postponed:", itemErr.message);
            }
        }
    } catch (err) {
        console.warn("Sync batch notice:", err.message);
    } finally {
        isSyncing = false;
    }

    return uploaded;
}

export function getPendingCount() {
    try {
        const rawQueue = JSON.parse(localStorage.getItem("muc_pending_records") || "[]");
        if (!Array.isArray(rawQueue)) return 0;
        return rawQueue.filter(item => item && String(item.studentId || "").trim().length >= 7).length;
    } catch (_) {
        return 0;
    }
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