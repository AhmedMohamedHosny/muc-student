const crypto = require("crypto");

function base64Url(input) {
    return Buffer.from(input)
        .toString("base64")
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
}

async function getGoogleAccessToken(clientEmail, privateKey) {
    const now = Math.floor(Date.now() / 1000);
    const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const payload = base64Url(JSON.stringify({
        iss: clientEmail,
        scope: "https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/datastore",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600
    }));

    const unsignedJwt = `${header}.${payload}`;
    const signer = crypto.createSign("RSA-SHA256");
    signer.update(unsignedJwt);
    const signature = signer.sign(privateKey, "base64url");
    const jwt = `${unsignedJwt}.${signature}`;

    const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });
    const data = await res.json();
    if (!res.ok || !data.access_token) {
        throw new Error("OAuth Error: " + JSON.stringify(data));
    }
    return data.access_token;
}

module.exports = async function handler(req, res) {
    try {
        const projectId = (process.env.FIREBASE_PROJECT_ID || "").trim();
        const clientEmail = (process.env.FIREBASE_CLIENT_EMAIL || "").trim();
        const rawKey = process.env.FIREBASE_PRIVATE_KEY || "";
        const privateKey = rawKey.replace(/^"|"$/g, "").replace(/\\n/g, "\n");

        if (!projectId || !clientEmail || !privateKey) {
            return res.status(500).json({
                ok: false,
                error: "Missing FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY in Vercel"
            });
        }

        const accessToken = await getGoogleAccessToken(clientEmail, privateKey);
        const firestoreBase = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
        const authHeaders = {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        };

        // جلب جميع تذكيرات الأوفلاين المعلقة التي حان وقتها ولم تُرسل بعد
        const queryRes = await fetch(`${firestoreBase}:runQuery`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
                structuredQuery: {
                    from: [{ collectionId: "push_reminders" }],
                    where: {
                        fieldFilter: {
                            field: { fieldPath: "sent" },
                            op: "EQUAL",
                            value: { booleanValue: false }
                        }
                    },
                    limit: 200
                }
            })
        });

        const rows = await queryRes.json();
        const nowMs = Date.now();
        let sentCount = 0;
        let skippedAlreadyUploaded = 0;

        for (const row of rows) {
            const docObj = row?.document;
            if (!docObj?.name) continue;

            const docId = docObj.name.split("/").pop();
            const f = docObj.fields || {};
            const remindAt = Number(f.remindAt?.integerValue || f.remindAt?.doubleValue || 0);
            if (!remindAt || nowMs < remindAt) continue;

            const studentId = f.studentId?.stringValue || "";
            const sessionId = f.sessionId?.stringValue || "";
            const courseName = f.courseName?.stringValue || "المقرر الدراسي";
            let fcmToken = f.fcmToken?.stringValue || "";

            // 1. التأكد من الداتابيز: هل الطالب رفع حضوره بالفعل أم لسه؟
            if (sessionId && studentId) {
                const recCheck = await fetch(
                    `${firestoreBase}/attendance_records/${encodeURIComponent(`${sessionId}_${studentId}`)}`,
                    { headers: authHeaders }
                );
                if (recCheck.ok) {
                    await fetch(
                        `${firestoreBase}/push_reminders/${encodeURIComponent(docId)}?updateMask.fieldPaths=sent&updateMask.fieldPaths=status`,
                        {
                            method: "PATCH",
                            headers: authHeaders,
                            body: JSON.stringify({
                                fields: {
                                    sent: { booleanValue: true },
                                    status: { stringValue: "already_uploaded" }
                                }
                            })
                        }
                    );
                    skippedAlreadyUploaded++;
                    continue;
                }
            }

            if (!fcmToken && studentId) {
                const stdRes = await fetch(`${firestoreBase}/students/${encodeURIComponent(studentId)}`, { headers: authHeaders });
                if (stdRes.ok) {
                    const stdDoc = await stdRes.json();
                    fcmToken = stdDoc.fields?.fcmToken?.stringValue || "";
                }
            }

            // 2. إرسال الإشعار لموبايل الطالب عبر Firebase Cloud Messaging v1
            if (fcmToken) {
                const fcmRes = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
                    method: "POST",
                    headers: authHeaders,
                    body: JSON.stringify({
                        message: {
                            token: fcmToken,
                            data: {
                                title: "⚠️ تذكير: حضورك لم يُرفع بعد!",
                                body: `مرّت ساعتان وما زال حضورك الأوفلاين في (${courseName}) معلقاً. افتح الإنترنت واضغط هنا لتأكيد حضورك الآن.`,
                                url: "/index.html"
                            },
                            android: { priority: "high" },
                            webpush: {
                                headers: { Urgency: "high" }
                            }
                        }
                    })
                });
                if (fcmRes.ok) sentCount++;
            }

            // 3. إغلاق التذكير حتى لا يتكرر
            await fetch(
                `${firestoreBase}/push_reminders/${encodeURIComponent(docId)}?updateMask.fieldPaths=sent&updateMask.fieldPaths=sentAt`,
                {
                    method: "PATCH",
                    headers: authHeaders,
                    body: JSON.stringify({
                        fields: {
                            sent: { booleanValue: true },
                            sentAt: { integerValue: String(nowMs) }
                        }
                    })
                }
            );
        }

        return res.status(200).json({
            ok: true,
            checkedAt: new Date().toISOString(),
            sentCount,
            skippedAlreadyUploaded
        });
    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
    }
};
