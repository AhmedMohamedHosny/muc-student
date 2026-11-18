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
import { getMessaging, getToken } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js";
import { CONFIG } from "./config.js";

const app = initializeApp(CONFIG.firebase);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true
});

let _anonAuthPromise = null;
export async function ensureStudentAuth() {
    if (!auth.currentUser) {
        if (!_anonAuthPromise) {
            _anonAuthPromise = signInAnonymously(auth).finally(() => {
                _anonAuthPromise = null;
            });
        }
        await _anonAuthPromise;
    }
    registerStudentWebPushToken().catch(() => {});
    return auth.currentUser;
}

export async function registerStudentWebPushToken() {
    try {
        if (!CONFIG.vapidKey || !("Notification" in window) || !("serviceWorker" in navigator)) return "";
        if (Notification.permission === "default") {
            await Notification.requestPermission();
        }
        if (Notification.permission !== "granted") return "";

        const reg = await navigator.serviceWorker.ready;
        const messaging = getMessaging(app);
        const token = await getToken(messaging, {
            vapidKey: CONFIG.vapidKey,
            serviceWorkerRegistration: reg
        });

        if (token) {
            localStorage.setItem("muc_fcm_token", token);
            const sid = localStorage.getItem("muc_saved_student_id");
            if (sid && navigator.onLine) {
                await setDoc(doc(db, "students", sid), {
                    fcmToken: token,
                    pushUpdatedAt: serverTimestamp()
                }, { merge: true }).catch(() => {});
            }
        }
        return token || "";
    } catch (_) {
        return "";
    }
}

// بصمة هاردوير بدون عشوائية لمنع نفس الموبايل من تحضير طالبين في نفس المحاضرة حتى من المتصفح الخفي
export function getSessionHardwareSignature() {
    try {
        const w = Math.min(screen.width || 0, screen.height || 0);
        const h = Math.max(screen.width || 0, screen.height || 0);
        const dpr = window.devicePixelRatio || 1;
        const cores = navigator.hardwareConcurrency || 4;
        const mem = navigator.deviceMemory || 0;
        const ua = navigator.userAgent || "";
        const modelMatch = ua.match(/Android\s+[\d.]+;\s*([^;)]+)/i) || ua.match(/iPhone\s+OS\s+[\d_]+/i) || ["", ""];
        const modelStr = (modelMatch[1] || modelMatch[0] || "").replace(/Build\/.*/i, "").trim();

        let gpu = "";
        try {
            const c = document.createElement("canvas");
            const gl = c.getContext("webgl") || c.getContext("experimental-webgl");
            if (gl) {
                const dbg = gl.getExtension("WEBGL_debug_renderer_info");
                if (dbg) gpu = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || "";
            }
        } catch (_) {}

        const raw = `${w}x${h}x${dpr}_${cores}_${mem}_${modelStr}_${gpu}`;
        let hash = 2166136261;
        for (let i = 0; i < raw.length; i++) {
            hash ^= raw.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return "shw_" + (hash >>> 0).toString(36);
    } catch (_) {
        return "shw_default";
    }
}

function getLocalDeviceId() {
    try {
        const savedHw = localStorage.getItem("muc_hw_bound_key");
        if (savedHw) return savedHw;

        const screenFeatures = `${Math.min(screen.width, screen.height)}x${Math.max(screen.width, screen.height)}x${screen.colorDepth}`;
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
    const s = String(name || "").trim();
    if (!s) return "";
    if (s.toLowerCase().includes("praxis")) return "Praxis Programming";
    return s.replace(/\s*[-–—]?\s*(محاضرة|Lecture|Lec)\s*[12]/gi, "").trim();
}

const KNOWN_MUC_COURSES = {
    "eng101": "Introduction to Engineering (ENG101)",
    "phm111": "Mathematics for Engineers and Scientists 1 (PHM111)",
    "phm112": "Mathematics for Engineers and Scientists 2 (PHM112)",
    "cse111": "Discrete Mathematics (CSE111)",
    "cse122": "Logic Design (CSE122)",
    "cse212": "Praxis Programming (CSE212)",
    "cse214": "Data Structures and Algorithms (CSE214)",
    "cse215": "Database Systems (CSE215)",
    "cse216": "Web Design and Database (CSE216)",
    "cse219": "Software Engineering (CSE219)",
    "user_centered": "User Centered Design",
    "cse_uc": "User Centered Design",
    "cse_modern_workshop": "Modern Workshop",
    "praxis_programming": "Praxis Programming",
    "praxis_programming_lec1": "Praxis Programming",
    "praxis_programming_lec2": "Praxis Programming"
};

function formatReadableCourseId(cid) {
    if (!cid) return "";
    const lower = String(cid).trim().toLowerCase();
    if (KNOWN_MUC_COURSES[lower]) return KNOWN_MUC_COURSES[lower];
    if (/^[a-z]{2,4}\d{3}$/i.test(lower)) return `Course (${lower.toUpperCase()})`;
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

        // إذا فشل الطلبان معاً بسبب بطء الشبكة في المدرج -> نرفع خطأ NETWORK_TIMEOUT لإعادة المحاولة تلقائياً
        if (pinDocRes.status === "rejected" && queryRes.status === "rejected") {
            throw new Error("NETWORK_TIMEOUT");
        }

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

// 🔒 قفل صارم (هاتف واحد ومتصفح واحد لكل طالب 1/1): منع المتصفح الخفي وأي متصفح أو هاتف آخر
        const hwKey = localStorage.getItem("muc_hw_bound_key") || safeDeviceId;
        const ownerRef = doc(db, "attendance_devices", `device_owner_${hwKey}`);
        const ownerSnap = await withTimeout(getDoc(ownerRef), 4000).catch(() => ({ exists: () => false }));

        if (ownerSnap && ownerSnap.exists()) {
            const oData = ownerSnap.data() || {};
            const ownerSid = String(oData.studentId || "").trim();
            if (ownerSid && ownerSid !== cleanedStudentId) {
                throw new Error(`🚫 مرفوض أمنياً: هذا الهاتف مربوط بالفعل بالطالب (${oData.studentName || ownerSid}) ولا يمكن استخدامه لطالب آخر!`);
            }
        }

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

        // السماح فقط بالمتصفح الأساسي الأول للطالب (1/1) ورفض أي متصفح خفي أو متصفح ثانٍ
        const primaryBoundList = boundDevicesList.slice(0, 1);
        const isMyDev = primaryBoundList.some(d => d.deviceId === hwKey || d.deviceId === safeDeviceId || d.legacyDeviceId === safeDeviceId || d.legacyDeviceId === hwKey);

        if (idLockSnap && idLockSnap.exists() && !isMyDev && primaryBoundList.length >= 1) {
            throw new Error("🚫 هذا الرقم الجامعي مربوط بالفعل بمتصفحك الأساسي! لا يمكن تسجيل الحضور من المتصفح الخفي أو من هاتف/متصفح آخر.");
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
                deviceId: hwKey,
                status: status,
                recordedAt: serverTimestamp(),
                method: clientToken === "PIN_VERIFIED" ? "PIN_CODE" : "QR_SCAN"
            }, { merge: true }),
            setDoc(deviceRef, {
                sessionId: sessionId,
                deviceId: safeDeviceId,
                studentId: cleanedStudentId,
                createdAt: serverTimestamp()
            }, { merge: true }).catch(() => {}),
            setDoc(ownerRef, {
                deviceId: hwKey,
                studentId: cleanedStudentId,
                studentName: studentRealName,
                department: studentData.department || "هندسة الحاسب",
                academicYear: String(studentData.academicYear || "2"),
                boundAt: serverTimestamp(),
                boundAtISO: nowISO
            }, { merge: true }).catch(() => {})
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
            const updatedList = [newDevObj];
            const firstTime = lockData.firstLockedAtISO || nowISO;

            writePromises.push(
                setDoc(idLockRef, {
                    studentId: cleanedStudentId,
                    studentName: studentRealName,
                    department: studentData.department || "هندسة الحاسب",
                    academicYear: String(studentData.academicYear || "2"),
                    devices: updatedList,
                    deviceIds: [hwKey],
                    deviceId: hwKey,
                    secondDeviceId: "",
                    deviceName: `[هاتف 1] ${quickPhoneName}`,
                    screenInfo: `${screen.width}x${screen.height}`,
                    firstLockedAtISO: firstTime,
                    secondLockedAtISO: "",
                    lockedAt: serverTimestamp(),
                    lockedAtISO: firstTime
                }, { merge: true }).catch(() => {})
            );
            localStorage.setItem(`muc_lock_claimed_${cleanedStudentId}`, "1");
        }

try {
            await withTimeout(Promise.all(writePromises), 9000);
        } catch (writeErr) {
            if (String(writeErr?.message || "") === "NETWORK_TIMEOUT") {
                const checkSaved = await withTimeout(getDoc(recordRef), 4500).catch(() => null);
                if (!checkSaved || !checkSaved.exists()) throw writeErr;
            } else {
                throw writeErr;
            }
        }
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
    mirrorQueueToBackgroundDB(cleanedQueue);

    // تسجيل تذكرة التذكير على السيرفر (مؤقت 30 ثانية للتجربة)
    const fcmTok = localStorage.getItem("muc_fcm_token") || "";
    if (fcmTok) {
        const remindAtMs = nowMs + (30 * 1000);
        setDoc(doc(db, "push_reminders", `${record.sessionId}_${cleanedStudentId}`), {
            studentId: cleanedStudentId,
            studentName: record.studentName,
            sessionId: record.sessionId,
            courseName: record.courseName,
            fcmToken: fcmTok,
            remindAt: remindAtMs,
            sent: false,
            createdAt: serverTimestamp()
        }, { merge: true }).catch(() => {});
    }

    return record;
}

// تسجيل طلب المزامنة في نظام التشغيل فوراً قبل إغلاق التطبيق
function registerOsBackgroundSyncNow() {
    if ("serviceWorker" in navigator && "SyncManager" in window) {
        navigator.serviceWorker.ready
            .then(reg => reg.sync.register("muc-bg-sync-attendance"))
            .catch(() => {});
    }
}

// نسخ الطابور وإعدادات السيرفر وتوقيت تذكير الساعتين داخل IndexedDB للرفع والتذكير في الخلفية
async function mirrorQueueToBackgroundDB(queueArr) {
    try {
        const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
        const hasItems = Array.isArray(queueArr) && queueArr.length > 0;
        let remindAt = Number(localStorage.getItem("muc_offline_remind_at") || 0);

        if (hasItems) {
            registerOsBackgroundSyncNow();
            const oldestScan = Math.min(...queueArr.map(x => Number(x.scannedAt) || Date.now()));
            const isPastLectureOverdue = (Date.now() - oldestScan) >= TWO_HOURS_MS;

            if (!remindAt) {
                remindAt = isPastLectureOverdue ? (Date.now() + 10000) : (oldestScan + TWO_HOURS_MS);
                localStorage.setItem("muc_offline_remind_at", String(remindAt));
                localStorage.removeItem("muc_offline_reminded");
            }
        } else {
            remindAt = 0;
            localStorage.removeItem("muc_offline_remind_at");
            localStorage.removeItem("muc_offline_reminded");
            localStorage.removeItem("muc_offline_last_reminded_at");
        }

        let cachedAuth = null;
        try {
            if (auth.currentUser) {
                const token = await auth.currentUser.getIdToken();
                cachedAuth = {
                    idToken: token,
                    refreshToken: auth.currentUser.refreshToken || "",
                    savedAt: Date.now()
                };
            }
        } catch (_) {}

        const latestCourse = hasItems ? (queueArr[queueArr.length - 1]?.courseName || "المقرر الدراسي") : "";

        const req = indexedDB.open("muc_bg_sync_db", 1);
        req.onupgradeneeded = (e) => {
            const idb = e.target.result;
            if (!idb.objectStoreNames.contains("kv")) idb.createObjectStore("kv");
        };
        req.onsuccess = (e) => {
            const idb = e.target.result;
            const tx = idb.transaction("kv", "readwrite");
            const store = tx.objectStore("kv");
            store.put(queueArr, "pending_records");
            store.put({
                projectId: CONFIG.firebase.projectId,
                apiKey: CONFIG.firebase.apiKey
            }, "firebase_cfg");
            if (cachedAuth) {
                store.put(cachedAuth, "auth_session");
            }

            if (hasItems) {
                store.put({
                    remindAt,
                    reminded: false,
                    count: queueArr.length,
                    courseName: latestCourse
                }, "reminder_meta");
            } else {
                store.delete("reminder_meta");
            }

            tx.oncomplete = async () => {
                if ("serviceWorker" in navigator) {
                    try {
                        const reg = await navigator.serviceWorker.ready;
                        const swWorker = reg.active || reg.waiting || reg.installing;
                        if (hasItems) {
                            registerOsBackgroundSyncNow();
                            swWorker?.postMessage({
                                type: "SCHEDULE_OFFLINE_REMINDER",
                                remindAt,
                                courseName: latestCourse,
                                count: queueArr.length
                            });
                        } else {
                            swWorker?.postMessage({ type: "CANCEL_OFFLINE_REMINDER" });
                        }
                    } catch (_) {}
                }
            };
        };
    } catch (_) {}
}

let isSyncing = false;

function checkLectureMatch(courseId, courseName, studentId) {
    return null;
}

function removeFromQueue(item) {
    const key = item.origSessionId || item.sessionId;
    const q = JSON.parse(localStorage.getItem("muc_pending_records") || "[]");
    const nextQ = q.filter(x => {
        if (x.studentId !== item.studentId) return true;
        if (x.sessionId === key || x.sessionId === item.sessionId) return false;
        if (x.pin && Math.abs((x.scannedAt || 0) - (item.scannedAt || 0)) < 45 * 60 * 1000) return false;
        return true;
    });
    localStorage.setItem("muc_pending_records", JSON.stringify(nextQ));
    mirrorQueueToBackgroundDB(nextQ);
}

export async function syncPendingAttendance() {
    if (!navigator.onLine) return -1;
    if (isSyncing) return 0;

    const queue = JSON.parse(localStorage.getItem("muc_pending_records") || "[]");
    if (!Array.isArray(queue) || queue.length === 0) return 0;

let uploaded = 0;
    const syncedReceipts = [];
    isSyncing = true;

    try {
if (!auth.currentUser) {
            await withTimeout(signInAnonymously(auth), 10000);
        }

        for (const item of queue) {
            try {
                // جلب بيانات الطالب أولاً للتحقق من القيد والسكشن بدقة
                const stdSnap = await withTimeout(getDoc(doc(db, "students", item.studentId)), 10000);
                if (!stdSnap.exists()) {
                    localStorage.setItem("muc_sync_error", `⚠️ الرقم الجامعي (${item.studentId}) غير مسجل بقاعدة البيانات!`);
                    removeFromQueue(item);
                    continue;
                }

                const stdData = stdSnap.data() || {};
                const studentRealName = stdData.name || item.studentName || "Student";
                const enrolled = stdData.enrolledCourses || [];

                let matchedSessionId = null;
                let sData = null;

                // دالة فحص ذكية تمنع تصادم أكواد الـ PIN القديمة أو الخاصة بسكاشن أخرى
                const isSessionMatchingStudentPin = (candSession) => {
                    if (!candSession || candSession.status === "deleted") return false;

                    // 1. يجب أن تكون الجلسة في نفس يوم تسجيل الطالب (عدم مطابقة جلسات أسابيع سابقة)
                    const itemDate = item.startedAtDate || new Date(item.scannedAt || Date.now()).toLocaleDateString("en-CA");
                    const sessStartMs = (candSession.startTime?.seconds || 0) * 1000;
                    const scanMs = Number(item.scannedAt || Date.now());
                    const sameDay = candSession.startedAtDate === itemDate || (sessStartMs > 0 && Math.abs(scanMs - sessStartMs) < 18 * 60 * 60 * 1000);
                    if (!sameDay) return false;

                    // 2. يجب أن تطابق المقرر الدراسي
                    const cid = String(candSession.courseId || "").trim().toLowerCase();
                    const itemCid = String(item.courseId || "").trim().toLowerCase();
                    if (itemCid && itemCid !== "muc_course" && cid && cid !== "muc_course") {
                        const sameCourse = cid === itemCid || getCoursePinIndex(cid) === getCoursePinIndex(itemCid);
                        if (!sameCourse) return false;
                    }

                    // 3. يجب أن تطابق سكشن الطالب (أو تكون محاضرة عامة)
                    try {
                        verifyStudentSectionAndTA(stdData, candSession);
                    } catch (_) {
                        return false;
                    }

                    return true;
                };

                if (item.pin) {
                    const pinStr = String(item.pin).trim();
                    const pinNum = Number(pinStr);

                    // أ) فحص جدول أكواد الـ PIN المباشرة
                    try {
                        const pinSnap = await withTimeout(getDoc(doc(db, "attendance_pins", pinStr)), 4000);
                        if (pinSnap.exists()) {
                            const pData = pinSnap.data() || {};
                            if (pData.sessionId) {
                                const candSnap = await withTimeout(getDoc(doc(db, "attendance_sessions", pData.sessionId)), 4000);
                                if (candSnap.exists() && isSessionMatchingStudentPin(candSnap.data())) {
                                    matchedSessionId = candSnap.id;
                                    sData = candSnap.data();
                                }
                            }
                        }
                    } catch (_) {}

                    // ب) فحص جميع الجلسات التي تحتوي على هذا الكود واختيار الجلسة المطابقة ليوم وسكشن الطالب فقط
                    if (!matchedSessionId) {
                        try {
                            const qSnap = await withTimeout(getDocs(query(
                                collection(db, "attendance_sessions"),
                                where("pinHistory", "array-contains", pinNum)
                            )), 4500);
                            if (!qSnap.empty) {
                                const validDoc = qSnap.docs.find(d => isSessionMatchingStudentPin(d.data()));
                                if (validDoc) {
                                    matchedSessionId = validDoc.id;
                                    sData = validDoc.data();
                                }
                            }
                        } catch (_) {}
                    }

                    // 🛑 إذا لم يرفع الدكتور جلسته بعد: نبقي السجل بأمان في تليفون الطالب بدون أي رسالة خطأ أو حذف
                    if (!matchedSessionId || !sData) {
                        if (Date.now() - (item.scannedAt || Date.now()) > 72 * 60 * 60 * 1000) {
                            removeFromQueue(item);
                        } else {
                            console.log(`⏳ Waiting for instructor to upload session for PIN (${pinStr})...`);
                        }
                        continue;
                    }
                } else {
                    // في حالة مسح الـ QR: معرّف الجلسة فريد 100%
                    matchedSessionId = item.sessionId;
                    const sessSnap = await withTimeout(getDoc(doc(db, "attendance_sessions", matchedSessionId)), 4500);
                    if (!sessSnap.exists()) {
                        continue; // الدكتور لم يرفع المحاضرة بعد -> انتظر ولا تمسح السجل
                    }
                    sData = sessSnap.data() || {};
                    if (sData.status === "deleted") {
                        removeFromQueue(item);
                        continue;
                    }
                    try {
                        verifyStudentSectionAndTA(stdData, sData);
                    } catch (secErr) {
                        const parts = String(secErr.message || "").split(":");
                        localStorage.setItem("muc_sync_error", `🚫 لم يُسجَّل الحضور: الطالب (${studentRealName}) مقيد في [${parts[2] || "سكشن آخر"}] وليس [${parts[3] || "هذا السكشن"}].`);
                        removeFromQueue(item);
                        continue;
                    }
                }

                // التحقق من قيد الطالب في المقرر
                const cid = String(sData.courseId || "").trim().toLowerCase();
                const ccode = String(sData.courseCode || "").trim().toLowerCase();
                const isPraxisSync = cid.includes("praxis") || ccode.includes("praxis");
                const isEnrolledSync = !cid || cid === "muc_course" ||
                    enrolled.some(id => String(id).trim().toLowerCase() === cid || (ccode && String(id).trim().toLowerCase() === ccode)) ||
                    (isPraxisSync && enrolled.some(id => String(id).toLowerCase().includes("praxis") || String(id).toLowerCase().includes("cse212"))) ||
                    (stdData.sections && Object.keys(stdData.sections).some(k => String(k).trim().toLowerCase() === cid || (ccode && String(k).trim().toLowerCase() === ccode)));

                if (!isEnrolledSync) {
                    localStorage.setItem("muc_sync_error", `⚠️ الرقم (${item.studentId}) غير مقيد في مقرر (${sData.courseName || sData.courseId})!`);
                    removeFromQueue(item);
                    continue;
                }

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

                const nowSync = new Date();
                const rawCName = sData.courseName || item.courseName || "Course";
                syncedReceipts.push({
                    studentName: studentRealName,
                    studentId: item.studentId,
                    courseName: String(rawCName).toLowerCase().includes("praxis") ? "Praxis Programming" : cleanCourseDisplayName(rawCName),
                    lectureNumber: Number(sData.lectureNumber || item.lectureNumber || 1),
                    sessionType: sData.sessionType || item.sessionType || "lecture",
                    status: "Present",
                    date: nowSync.toLocaleDateString("en-US"),
                    time: nowSync.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
                });
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

    if (syncedReceipts.length > 0) {
        window._lastSyncedOfflineReceipts = syncedReceipts;
        if (!window._suppressSyncPopup) {
            window.dispatchEvent(new CustomEvent("muc:offline-synced", { detail: syncedReceipts }));
        }
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

function reconcileBackgroundSyncedItems() {
    return new Promise((resolve) => {
        try {
            const req = indexedDB.open("muc_bg_sync_db", 1);
            req.onerror = () => resolve(false);
            req.onsuccess = (e) => {
                const idb = e.target.result;
                if (!idb.objectStoreNames.contains("kv")) return resolve(false);
                const tx = idb.transaction("kv", "readwrite");
                const store = tx.objectStore("kv");
                const getReq = store.get("pending_records");
                const recReq = store.get("last_bg_synced_receipts");

                tx.oncomplete = () => {
                    let wasCleanedByBg = false;
                    if (Array.isArray(getReq.result)) {
                        const localQ = JSON.parse(localStorage.getItem("muc_pending_records") || "[]");
                        if (localQ.length > 0 && getReq.result.length === 0) {
                            localStorage.setItem("muc_pending_records", "[]");
                            localStorage.removeItem("muc_offline_remind_at");
                            localStorage.removeItem("muc_offline_reminded");
                            localStorage.removeItem("muc_offline_last_reminded_at");
                            wasCleanedByBg = true;
                        }
                    }
                    if (Array.isArray(recReq.result) && recReq.result.length > 0) {
                        const delTx = idb.transaction("kv", "readwrite");
                        delTx.objectStore("kv").delete("last_bg_synced_receipts");
                        window.dispatchEvent(new CustomEvent("muc:offline-synced", { detail: recReq.result }));
                    }
                    resolve(wasCleanedByBg);
                };
                tx.onerror = () => resolve(false);
            };
        } catch (_) {
            resolve(false);
        }
    });
}

async function triggerSmoothSync() {
    await reconcileBackgroundSyncedItems();
    try {
        const localQ = JSON.parse(localStorage.getItem("muc_pending_records") || "[]");
        if (Array.isArray(localQ) && localQ.length > 0) {
            await mirrorQueueToBackgroundDB(localQ);
        }
    } catch (_) {}

    if (!navigator.onLine || isSyncing) return;
    syncPendingAttendance();
}

window.addEventListener("online", triggerSmoothSync);
window.addEventListener("pageshow", triggerSmoothSync);
window.addEventListener("focus", triggerSmoothSync);
window.addEventListener("pagehide", () => {
    if (getPendingCount() > 0) registerOsBackgroundSyncNow();
});
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        triggerSmoothSync();
    } else if (getPendingCount() > 0) {
        registerOsBackgroundSyncNow();
    }
});
setInterval(triggerSmoothSync, 10000);

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
