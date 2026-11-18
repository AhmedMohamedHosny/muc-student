const CACHE_NAME = "muc-student-offline-v43";

const CORE_ASSETS = [
    "./",
    "./index.html",
    "./firebase.js",
    "./errors-guide.js",
    "./config.js",
    "./logo.png",
    "./logo.jpg",
    "./may.jpg",
    "./manifest.json",
    "https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css",
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js",
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js",
    "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"
];

// 1. التثبيت: سحب أحدث نسخة من السيرفر فوراً وتخزينها للأوفلاين (مع تخطي كاش المتصفح)
self.addEventListener("install", (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            for (const url of CORE_ASSETS) {
                try {
                    const freshReq = new Request(url, { cache: "reload" });
                    const res = await fetch(freshReq);
                    if (res && res.status === 200) {
                        await cache.put(url, res);
                    }
                } catch (err) {
                    console.warn("SW Cache skip:", url);
                }
            }
        })
    );
});

// 2. التفعيل: مسح كل الكاش القديم + إجبار صفحات الطلاب المفتوحة على التحديث فوراً في الخلفية
self.addEventListener("activate", (event) => {
    event.waitUntil(
        (async () => {
            const keys = await caches.keys();
            await Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) return caches.delete(key);
                })
            );
await self.clients.claim();
            await checkAndFireTwoHourReminder();

            // إجبار جميع التبويبات المفتوحة عند الطلاب على التحميل بالنسخة الجديدة فوراً
            const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
            for (const client of clientsList) {
                try {
                    await client.navigate(client.url);
                } catch (e) {}
            }
        })()
    );
});

// 3. جلب الملفات: الأولوية لأحدث نسخة من السيرفر (وحفظها للأوفلاين)، وعند انقطاع النت يعمل من الكاش فوراً
self.addEventListener("fetch", (event) => {
    const req = event.request;

    if (req.method !== "GET" || req.url.includes("firestore.googleapis.com") || req.url.includes("identitytoolkit")) {
        return;
    }

    const urlObj = new URL(req.url);
    const isCoreCode = req.mode === "navigate" ||
                       urlObj.pathname.endsWith("/") ||
                       urlObj.pathname.endsWith(".html") ||
                       urlObj.pathname.endsWith(".js") ||
                       urlObj.pathname.endsWith(".json");

    // أ) لملفات الكود والصفحة: اسحب الأحدث دائماً من السيرفر بدون كاش، وحدث نسخة الأوفلاين في الخلفية
    if (isCoreCode && urlObj.origin === self.location.origin) {
        event.respondWith(
            fetch(req, { cache: "no-store" })
                .then((networkRes) => {
                    if (networkRes && networkRes.status === 200) {
                        const clone = networkRes.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            if (req.mode === "navigate") {
                                cache.put("./index.html", clone);
                            } else {
                                cache.put(urlObj.pathname, clone);
                            }
                        });
                    }
                    return networkRes;
                })
                .catch(async () => {
                    const cache = await caches.open(CACHE_NAME);
                    if (req.mode === "navigate") {
                        return (await cache.match("./index.html", { ignoreSearch: true })) ||
                               (await cache.match("index.html", { ignoreSearch: true })) ||
                               (await cache.match("./", { ignoreSearch: true })) ||
                               Response.error();
                    }
                    return (await cache.match(req, { ignoreSearch: true })) || Response.error();
                })
        );
        return;
    }

    // ب) للصور والمكتبات الثابتة: الكاش أولاً لسرعة الفتح، وتحديثها إن لم تكن موجودة
    event.respondWith(
        caches.match(req, { ignoreSearch: true }).then((cachedRes) => {
            if (cachedRes) return cachedRes;
            return fetch(req).then((networkRes) => {
                if (networkRes && networkRes.status === 200) {
                    const clone = networkRes.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
                }
return networkRes;
            }).catch(() => Response.error());
        })
    );
});

// 🚀 الرفع التلقائي لحضور الأوفلاين في الخلفية بمجرد التقاط الهاتف للإنترنت حتى لو المتصفح مغلق
self.addEventListener("sync", (event) => {
    if (event.tag === "muc-bg-sync-attendance") {
        event.waitUntil(processBackgroundAttendanceUpload());
    }
});

async function processBackgroundAttendanceUpload() {
    try {
        const db = await new Promise((resolve, reject) => {
            const req = indexedDB.open("muc_bg_sync_db", 1);
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = reject;
        });

        if (!db.objectStoreNames.contains("kv")) return;

        const { queue, cfg } = await new Promise((resolve) => {
            const tx = db.transaction("kv", "readonly");
            const store = tx.objectStore("kv");
            const r1 = store.get("pending_records");
            const r2 = store.get("firebase_cfg");
            tx.oncomplete = () => resolve({ queue: r1.result || [], cfg: r2.result || null });
            tx.onerror = () => resolve({ queue: [], cfg: null });
        });

        if (!Array.isArray(queue) || queue.length === 0 || !cfg || !cfg.projectId || !cfg.apiKey) return;

        const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${cfg.apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({})
        });
        if (!authRes.ok) return;
        const { idToken } = await authRes.json();
        if (!idToken) return;

        const baseUrl = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents`;
        const headers = {
            "Authorization": `Bearer ${idToken}`,
            "Content-Type": "application/json"
        };

        const remaining = [];
        const bgUploadedReceipts = [];

        for (const item of queue) {
            try {
                let matchedSessionId = item.sessionId;
                if (item.pin) {
                    const pinStr = String(item.pin).trim();
                    const pinRes = await fetch(`${baseUrl}/attendance_pins/${encodeURIComponent(pinStr)}`, { headers });
                    if (pinRes.ok) {
                        const pinDoc = await pinRes.json();
                        if (pinDoc?.fields?.sessionId?.stringValue) {
                            matchedSessionId = pinDoc.fields.sessionId.stringValue;
                        }
                    } else {
                        const queryRes = await fetch(`${baseUrl}:runQuery`, {
                            method: "POST",
                            headers,
                            body: JSON.stringify({
                                structuredQuery: {
                                    from: [{ collectionId: "attendance_sessions" }],
                                    where: {
                                        fieldFilter: {
                                            field: { fieldPath: "pinHistory" },
                                            op: "ARRAY_CONTAINS",
                                            value: { integerValue: String(Number(pinStr)) }
                                        }
                                    },
                                    limit: 1
                                }
                            })
                        });
                        if (queryRes.ok) {
                            const qRows = await queryRes.json();
                            const docPath = qRows?.[0]?.document?.name || "";
                            if (docPath) matchedSessionId = docPath.split("/").pop();
                        }
                    }
                }

                const sessRes = await fetch(`${baseUrl}/attendance_sessions/${encodeURIComponent(matchedSessionId)}`, { headers });
                if (!sessRes.ok) {
                    remaining.push(item);
                    continue;
                }
                const sessDoc = await sessRes.json();
                const sFields = sessDoc.fields || {};
                if (sFields.status?.stringValue === "deleted") continue;

                // التحقق من مطابقة يوم المحاضرة لمنع تصادم الأكواد عبر الأسابيع
                const itemDate = item.startedAtDate || new Date(item.scannedAt || Date.now()).toLocaleDateString("en-CA");
                const sessDate = sFields.startedAtDate?.stringValue || "";
                if (sessDate && sessDate !== itemDate) {
                    remaining.push(item);
                    continue;
                }

                const stdRes = await fetch(`${baseUrl}/students/${encodeURIComponent(item.studentId)}`, { headers });
                if (!stdRes.ok) continue;
                const stdDoc = await stdRes.json();
                const realName = stdDoc.fields?.name?.stringValue || item.studentName || "Student";

                const recordId = `${matchedSessionId}_${item.studentId}`;
                const lecNum = sFields.lectureNumber?.integerValue || String(item.lectureNumber || 1);
                const cName = sFields.courseName?.stringValue || item.courseName || "Course";
                const sType = sFields.sessionType?.stringValue || item.sessionType || "lecture";

                const writeRes = await fetch(
                    `${baseUrl}/attendance_records/${encodeURIComponent(recordId)}?updateMask.fieldPaths=recordId&updateMask.fieldPaths=sessionId&updateMask.fieldPaths=courseId&updateMask.fieldPaths=courseName&updateMask.fieldPaths=lectureNumber&updateMask.fieldPaths=sessionType&updateMask.fieldPaths=studentId&updateMask.fieldPaths=studentName&updateMask.fieldPaths=deviceId&updateMask.fieldPaths=status&updateMask.fieldPaths=method&updateMask.fieldPaths=recordedAt`,
                    {
                        method: "PATCH",
                        headers,
                        body: JSON.stringify({
                            fields: {
                                recordId: { stringValue: recordId },
                                sessionId: { stringValue: matchedSessionId },
                                courseId: { stringValue: sFields.courseId?.stringValue || item.courseId || "MUC_COURSE" },
                                courseName: { stringValue: cName },
                                lectureNumber: { integerValue: String(lecNum) },
                                sessionType: { stringValue: sType },
                                studentId: { stringValue: String(item.studentId) },
                                studentName: { stringValue: realName },
                                deviceId: { stringValue: String(item.deviceId || "bg_sync") },
                                status: { stringValue: "Present" },
                                method: { stringValue: item.pin ? "OFFLINE_PIN_BG_SYNC" : "OFFLINE_QR_BG_SYNC" },
                                recordedAt: { timestampValue: new Date().toISOString() }
                            }
                        })
                    }
                );

                if (writeRes.ok) {
                    const nowBg = new Date();
                    bgUploadedReceipts.push({
                        studentName: realName,
                        studentId: String(item.studentId),
                        courseName: cName,
                        lectureNumber: Number(lecNum),
                        sessionType: sType,
                        status: "Present",
                        date: nowBg.toLocaleDateString("en-US"),
                        time: nowBg.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
                    });
                } else {
                    remaining.push(item);
                }
            } catch (_) {
                remaining.push(item);
            }
        }

        const writeTx = db.transaction("kv", "readwrite");
        const wStore = writeTx.objectStore("kv");
        wStore.put(remaining, "pending_records");
        if (bgUploadedReceipts.length > 0) {
            wStore.put(bgUploadedReceipts, "last_bg_synced_receipts");
        }
        if (remaining.length === 0) {
            wStore.delete("reminder_meta");
            await closeOfflineReminderNotifications();
        }
    } catch (_) {}
}

// ========================================================
// ⏰ محرك إشعار التذكير بعد ساعتين لمن لديه محاضرة أوفلاين معلقة فقط
// ========================================================
let _swReminderTimeout = null;

async function closeOfflineReminderNotifications() {
    try {
        clearTimeout(_swReminderTimeout);
        const list = await self.registration.getNotifications({ tag: "muc-offline-reminder" });
        list.forEach(n => n.close());
    } catch (_) {}
}

async function checkAndFireTwoHourReminder() {
    try {
        const db = await new Promise((resolve, reject) => {
            const req = indexedDB.open("muc_bg_sync_db", 1);
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = reject;
        });

        if (!db.objectStoreNames.contains("kv")) return;

        const { queue, meta } = await new Promise((resolve) => {
            const tx = db.transaction("kv", "readonly");
            const store = tx.objectStore("kv");
            const r1 = store.get("pending_records");
            const r2 = store.get("reminder_meta");
            tx.oncomplete = () => resolve({ queue: r1.result || [], meta: r2.result || null });
            tx.onerror = () => resolve({ queue: [], meta: null });
        });

        if (!Array.isArray(queue) || queue.length === 0) {
            await closeOfflineReminderNotifications();
            return;
        }

        if (!meta || meta.reminded || Date.now() < Number(meta.remindAt || 0)) return;

        await processBackgroundAttendanceUpload();

        const stillPending = await new Promise((resolve) => {
            const tx = db.transaction("kv", "readonly");
            const r = tx.objectStore("kv").get("pending_records");
            tx.oncomplete = () => resolve(Array.isArray(r.result) ? r.result : []);
            tx.onerror = () => resolve(queue);
        });

        if (stillPending.length === 0) return;

        const writeTx = db.transaction("kv", "readwrite");
        writeTx.objectStore("kv").put({ ...meta, reminded: true }, "reminder_meta");

        const courseLabel = meta.courseName ? ` (${meta.courseName})` : "";
        await self.registration.showNotification("⚠️ تذكير: حضورك لم يُرفع بعد!", {
            body: `مرّت ساعتان وما زال لديك (${stillPending.length}) سجل حضور أوفلاين${courseLabel} معلق على هاتفك. افتح الإنترنت واضغط هنا لرفعه الآن.`,
            icon: "./logo.png",
            badge: "./logo.png",
            tag: "muc-offline-reminder",
            renotify: true,
            requireInteraction: true,
            vibrate: [250, 120, 250],
            data: { url: "./index.html" }
        });
    } catch (_) {}
}

self.addEventListener("message", (event) => {
    const msg = event.data || {};
    if (msg.type === "CANCEL_OFFLINE_REMINDER") {
        event.waitUntil(closeOfflineReminderNotifications());
        return;
    }

    if (msg.type === "SCHEDULE_OFFLINE_REMINDER") {
        const remindAt = Number(msg.remindAt || (Date.now() + 2 * 60 * 60 * 1000));
        const delayMs = Math.max(1000, remindAt - Date.now());

        clearTimeout(_swReminderTimeout);
        _swReminderTimeout = setTimeout(() => {
            checkAndFireTwoHourReminder();
        }, Math.min(delayMs, 2147483647));

        try {
            if ("showTrigger" in Notification.prototype && typeof TimestampTrigger !== "undefined") {
                const courseLabel = msg.courseName ? ` (${msg.courseName})` : "";
                event.waitUntil(
                    self.registration.showNotification("⚠️ تذكير: حضورك لم يُرفع بعد!", {
                        body: `مرّت ساعتان وما زال لديك حضور أوفلاين${courseLabel} معلق على هاتفك. افتح الإنترنت واضغط هنا لتأكيد حضورك.`,
                        icon: "./logo.png",
                        badge: "./logo.png",
                        tag: "muc-offline-reminder",
                        showTrigger: new TimestampTrigger(remindAt),
                        data: { url: "./index.html" }
                    }).catch(() => {})
                );
            }
        } catch (_) {}
    }
});

self.addEventListener("periodicsync", (event) => {
    if (event.tag === "muc-offline-reminder-check") {
        event.waitUntil(checkAndFireTwoHourReminder());
    }
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const targetUrl = (event.notification.data && event.notification.data.url) || "./index.html";
    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsList) => {
            for (const client of clientsList) {
                if ("focus" in client) {
                    return client.focus();
                }
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow(targetUrl);
            }
        })
    );
});
