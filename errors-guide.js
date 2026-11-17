/**
 * MUC Smart Attendance - Context-Aware Errors & Solutions Guide
 * يعرض تلقائياً المشاكل والحلول الخاصة بالشاشة المفتوحة أمام الطالب فقط
 */

const MUC_ERRORS_CATALOG = [
    // =========================================================================
    // مشاكل شاشة إدخال الرقم الجامعي (قبل الدخول)
    // =========================================================================
    {
        id: "err_invalid_id",
        stage: "before",
        icon: "fa-id-card-clip",
        severity: "danger",
        matchKeywords: ["غير مسجل في قاعدة بيانات الجامعة", "الرقم الجامعي غير صحيح", "اكتب رقمك الجامعي الصحيح"],
        title: "الرقم الجامعي غير صحيح أو غير مسجل بالجامعة",
        mockTitle: "الرقم الجامعي غير صحيح",
        mockMessage: "⚠️ الرقم الجامعي (XXXXXXXX) غير مسجل في قاعدة بيانات الجامعة! تأكد من كتابة الـ ID الصحيح.",
        cause: "كتابة رقم جامعي ناقص أو به رقم خطأ، أو كتابة كود المحاضرة (6 أرقام) بالخطأ في خانة الرقم الجامعي، أو أنك طالب محوّل حديثاً ولم يُدرج كشفك بعد.",
        steps: [
            "راجع رقمك الجامعي المكون من 8 أرقام من الكارنيه الجامعي واكتبه بدقة.",
            "لا تكتب كود المحاضرة (6 أرقام) في هذه الخانة.",
            "إذا كان رقمك صحيحاً 100% ولا يزال مرفوضاً، تواصل مع دكتور المادة لإضافتك في الكشف."
        ]
    },
    {
        id: "err_bound_other_browser",
        stage: "before",
        icon: "fa-mobile-screen-button",
        severity: "danger",
        matchKeywords: ["مربوط بالفعل بمتصفح الطالب الأساسي", "مسموح بهاتف ومتصفح واحد فقط", "مربوط بهاتف ومتصفح آخر"],
        title: "الرقم الجامعي مربوط بهاتف أو متصفح آخر",
        mockTitle: "الرقم الجامعي مربوط بهاتف ومتصفح آخر!",
        mockMessage: "🚫 عفواً، الرقم الجامعي (XXXXXXXX) مربوط بالفعل بمتصفح الطالب الأساسي (مسموح بهاتف ومتصفح واحد فقط لكل طالب)! لا يمكن فتح الحساب من المتصفح الخفي أو من متصفح أو هاتف آخر.",
        cause: "حسابك مربوط مسبقاً بمتصفحك الأساسي (مثل Chrome أو Safari)، وأنت تحاول الآن الدخول من المتصفح الخفي (Incognito) أو متصفح ثانٍ أو هاتف زميلك.",
        steps: [
            "أغلق المتصفح الخفي أو المتصفح البديل وافتح الرابط من متصفحك العادي الأصلي.",
            "إذا اشتريت هاتفاً جديداً أو قمت بعمل فورمات للهاتف، اطلب من دكتور المادة الضغط على أيقونة فك القفل (📱🔓) بجانب اسمك في الكشف."
        ]
    },
    {
        id: "err_phone_owned_by_other",
        stage: "before",
        icon: "fa-user-lock",
        severity: "danger",
        matchKeywords: ["مربوط بالفعل بالطالب", "ممنوع فتح حساب طالب آخر", "أكثر من حساب واحد على نفس الهاتف"],
        title: "ممنوع فتح حساب طالب آخر على نفس الهاتف",
        mockTitle: "ممنوع فتح حساب طالب آخر!",
        mockMessage: "🚫 هذا الهاتف مربوط بالفعل بالطالب: [اسم الطالب] (XXXXXXXX) — لا يسمح النظام بفتح أكثر من حساب واحد على نفس الهاتف.",
        cause: "هذا الهاتف مسجل ومملوك لطالب آخر، والنظام يمنع تسجيل أكثر من طالب من نفس الموبايل لمنع التحضير بالنيابة.",
        steps: [
            "يجب أن يسجل كل طالب حضوره من هاتفه الشخصي فقط.",
            "إذا انتقلت ملكية هذا الهاتف إليك من زميلك، راجع مشرف المنظومة لفك ارتباط الهاتف من لوحة الإدارة."
        ]
    },
    {
        id: "err_device_unbound",
        stage: "before",
        icon: "fa-link-slash",
        severity: "warning",
        matchKeywords: ["تم إلغاء ربط هذا الهاتف", "بإلغاء ربط هذا الهاتف"],
        title: "تم إلغاء ربط هذا الهاتف بواسطة المشرف",
        mockTitle: "تم إلغاء ربط هذا الهاتف",
        mockMessage: "🚫 قام مشرف المنظومة بإلغاء ربط هذا الهاتف بالرقم الجامعي (XXXXXXXX). يرجى إدخال رقمك الجامعي الصحيح والموافقة على الربط من جديد.",
        cause: "قام دكتور المادة أو مشرف المنظومة بفك ربط هاتفك بناءً على طلبك أو لتحديث بيانات الأجهزة.",
        steps: [
            "اكتب رقمك الجامعي في الخانة واضغط (تسجيل الدخول ومتابعة).",
            "عند ظهور رسالة التأكيد اضغط (Yes - نعم، متأكد) لتثبيت ربط هاتفك من جديد."
        ]
    },
    {
        id: "err_first_login_offline",
        stage: "before",
        icon: "fa-wifi",
        severity: "warning",
        matchKeywords: ["تفعيل الرقم الجامعي وربطه بالهاتف لأول مرة", "مطلوب اتصال بالإنترنت", "الشبكة ضعيفة حالياً"],
        title: "مطلوب إنترنت عند أول تسجيل دخول فقط",
        mockTitle: "مطلوب اتصال بالإنترنت",
        mockMessage: "⚠️ تفعيل الرقم الجامعي وربطه بالهاتف لأول مرة يتطلب اتصالاً بالإنترنت. يرجى فتح Wi-Fi أو بيانات الهاتف والمحاولة مرة أخرى.",
        cause: "ربط الرقم الجامعي بالهاتف لأول مرة يحتاج اتصالاً بسيرفر الجامعة للتحقق من اسمك ومقرراتك وتأمين بصمة الجهاز.",
        steps: [
            "افتح بيانات الهاتف (Mobile Data) أو الواي فاي لمدة 5 ثوانٍ وأعد المحاولة.",
            "بعد التفعيل الأول، سيعمل معك التطبيق أونلاين وأوفلاين طوال الفصل الدراسي."
        ]
    },
    {
        id: "err_incognito",
        stage: "before",
        icon: "fa-user-secret",
        severity: "danger",
        matchKeywords: ["ممنوع استخدام المتصفح الخفي", "Incognito"],
        title: "حظر الدخول من المتصفح الخفي (Incognito)",
        mockTitle: "ممنوع استخدام المتصفح الخفي!",
        mockMessage: "تم رصد فتح المنظومة في وضع (Incognito / Private Browsing). يُرجى إغلاق علامة التبويب هذه وفتح الرابط من المتصفح العادي.",
        cause: "المتصفح الخفي يقوم بمسح بصمة الجهاز والكاش تلقائياً بمجرد إغلاقه، لذلك تحظره المنظومة.",
        steps: [
            "أغلق نافذة التصفح الخفي تماماً.",
            "افتح الرابط من متصفح Chrome أو Safari العادي."
        ]
    },

    // =========================================================================
    // مشاكل ما بعد الدخول (مسح الباركود، الـ PIN، السكشن، والأوفلاين)
    // =========================================================================
    {
        id: "err_online_required",
        stage: "after",
        icon: "fa-globe",
        severity: "danger",
        matchKeywords: ["تتطلب اتصالاً بالإنترنت لتسجيل حضورك", "تتطلب اتصالاً فعلياً بالإنترنت"],
        title: "هذه المحاضرة أونلاين وتتطلب اتصالاً بالإنترنت",
        mockTitle: "Check-in Failed",
        mockMessage: "🌐 هذه المحاضرة أونلاين (مباشرة) وتتطلب اتصالاً بالإنترنت لتسجيل حضورك فوراً على شاشة المدرج! يرجى فتح بيانات الهاتف أو الـ Wi-Fi.",
        cause: "الدكتور فتح جلسة الحضور بنظام الأونلاين المباشر، وهاتفك غير متصل بالإنترنت حالياً.",
        steps: [
            "افتح بيانات الهاتف (4G/5G) أو اتصل بشبكة Wi-Fi.",
            "اضغط على زر (Try Again) بالأسفل وأعد مسح الباركود أو إدخال الـ PIN."
        ]
    },
    {
        id: "err_weak_signal",
        stage: "after",
        icon: "fa-signal",
        severity: "warning",
        matchKeywords: ["Weak Network Signal", "إشارة الإنترنت في المدرج ضعيفة"],
        title: "ضعف إشارة الإنترنت في المدرج (Weak Signal)",
        mockTitle: "Weak Network Signal",
        mockMessage: "⚠️ إشارة الإنترنت في المدرج ضعيفة جداً حالياً. يرجى الضغط على Try Again للمحاولة مرة أخرى.",
        cause: "ازدحام الشبكة داخل المدرج أو ضعف التغطية أدى إلى تأخر وصول طلب التحضير للسيرفر.",
        steps: [
            "انتظر ثانيتين واضغط على زر (Try Again) لإعادة الإرسال.",
            "إذا استمر البطء، استخدم زر (Enter 6-Digit PIN) واكتب الكود الرقمي الظاهر أعلى الباركود."
        ]
    },
    {
        id: "err_expired_code",
        stage: "after",
        icon: "fa-hourglass-end",
        severity: "warning",
        matchKeywords: ["expired", "انتهت صلاحية الكود الرقمي", "الرمز تجدد"],
        title: "انتهاء صلاحية الباركود أو كود الـ PIN",
        mockTitle: "Check-in Failed",
        mockMessage: "QR Code expired! Please scan the updated code on the screen. / ⏰ انتهت صلاحية الكود الرقمي لأن الرمز تجدد!",
        cause: "الباركود وكود الـ PIN يتغيران تلقائياً كل 15–20 ثانية لمنع تصوير الشاشة وإرسالها خارج المدرج، والكود الذي التقطته انتهت مدته.",
        steps: [
            "اضغط (Try Again) ووجّه الكاميرا نحو الباركود الجديد الظاهر الآن على البروجيكتور.",
            "أو انقل الـ 6 أرقام الجديدة الظاهرة باللون الأصفر فور تحديثها."
        ]
    },
    {
        id: "err_invalid_pin",
        stage: "after",
        icon: "fa-keyboard",
        severity: "danger",
        matchKeywords: ["Invalid PIN", "غير صحيح أو منتهي الصلاحية"],
        title: "الكود الرقمي (PIN) غير صحيح",
        mockTitle: "Invalid PIN",
        mockMessage: "❌ الكود الرقمي (XXXXXX) غير صحيح أو منتهي الصلاحية! يرجى كتابة الكود الجديد الظاهر على شاشة المدرج.",
        cause: "إدخال رقم ناقص أو خاطئ، أو كتابة رقمك الجامعي (8 أرقام) بالخطأ بدلاً من كود المحاضرة (6 أرقام).",
        steps: [
            "تأكد من نقل الـ 6 أرقام الظاهرة باللون الأصفر أعلى الباركود على شاشة المدرج.",
            "أدخل الكود فور ظهوره قبل انتهاء عداد الثواني."
        ]
    },
    {
        id: "err_not_enrolled",
        stage: "after",
        icon: "fa-book-skull",
        severity: "danger",
        matchKeywords: ["غير مقيد في مقرر", "not enrolled in this course"],
        title: "غير مقيد في هذا المقرر الدراسي",
        mockTitle: "Check-in Failed",
        mockMessage: "غير مقيد في مقرر (...). تواصل مع الدكتور. / You are not enrolled in this course.",
        cause: "تحاول تسجيل حضور لمادة غير مدرجة في جدولك الدراسي المسجل بالمنظومة.",
        steps: [
            "تأكد أنك في المحاضرة الصحيحة لمادتك.",
            "إذا كانت المادة مسجلة لك رسمياً في الجدول، راجع دكتور المادة لإضافة رقمك الجامعي للكشف."
        ]
    },
    {
        id: "err_wrong_section",
        stage: "after",
        icon: "fa-users-slash",
        severity: "danger",
        matchKeywords: ["غير مسموح بتسجيل الحضور", "مقيد في ["],
        title: "غير مسموح بالتسجيل في سكشن أو مجموعة أخرى",
        mockTitle: "Check-in Failed",
        mockMessage: "🚫 غير مسموح بتسجيل الحضور! الطالب مقيد في [Section 01] ولا يمكنه التسجيل في [Section 03].",
        cause: "أنت تحاول تسجيل الحضور في سكشن أو معمل يخص مجموعة أخرى غير مجموعتك المسجلة في الكشف.",
        steps: [
            "التزم بالحضور في موعد سكشنك الرسمي المسجل لك.",
            "إذا حضرت في سكشن بديل بعذر رسمي، اطلب من المعيد/الدكتور تحضيرك يدوياً من جهازه."
        ]
    },
    {
        id: "err_already_attended",
        stage: "after",
        icon: "fa-circle-check",
        severity: "info",
        matchKeywords: ["لقد قمت بتسجيل حضورك لهذه المحاضرة بالفعل"],
        title: "تم تسجيل حضورك لهذه المحاضرة مسبقاً",
        mockTitle: "Check-in Failed",
        mockMessage: "⚠️ لقد قمت بتسجيل حضورك لهذه المحاضرة بالفعل (Lecture #X)!",
        cause: "تم تسجيل حضورك على السيرفر بنجاح في المحاولة الأولى (حتى لو ضعفت الشبكة لحظة ظهور الإيصال) وتحاول التسجيل مرة ثانية.",
        steps: [
            "لا تقلق، حضورك مثبت بالفعل في كشف الدكتور ولا تحتاج لإعادة التسجيل."
        ]
    },
    {
        id: "err_camera_blocked",
        stage: "after",
        icon: "fa-camera-rotate",
        severity: "warning",
        matchKeywords: ["إذن الكاميرا", "تطبيق عائم", "تعذر تشغيل الكاميرا"],
        title: "تعذر فتح الكاميرا أو وجود تطبيق عائم",
        mockTitle: "تنبيه صلاحية الكاميرا",
        mockMessage: "تعذر فتح إذن الكاميرا بسبب وجود تطبيق عائم على الشاشة (مثل: فقاعات ماسنجر، تطبيق تسجيل الشاشة).",
        cause: "نظام الحماية في الهاتف يمنع فتح الكاميرا لوجود فقاعة شات أو تطبيق تسجيل شاشة يغطي الواجهة، أو بسبب رفض إذن الكاميرا.",
        steps: [
            "اسحب فقاعات الماسنجر لأسفل وأغلق أي نافذة عائمة.",
            "أو استخدم الحل الأسرع: اضغط على زر (Enter 6-Digit PIN) وسجل حضورك بالكود الرقمي بدون كاميرا."
        ]
    },
    {
        id: "err_offline_pending",
        stage: "after",
        icon: "fa-clock",
        severity: "info",
        matchKeywords: ["Saved Offline", "Pending Sync", "Waiting for instructor"],
        title: "تم الحفظ أوفلاين (لماذا لم يظهر اسمي على الشاشة فوراً؟)",
        mockTitle: "Saved Offline ⏳ (Pending Sync)",
        mockMessage: "Saved locally on your phone. Waiting for instructor to upload offline lecture to server...",
        cause: "الدكتور فتح المحاضرة في وضع عدم الاتصال (Offline Mode)، وتم حفظ حضورك مشفراً داخل هاتفك لحين رفع المحاضرة.",
        steps: [
            "لا تقم بمسح بيانات المتصفح (Clear Data) حتى لا يضيع السجل المحفوظ.",
            "عند عودة الإنترنت وبعد أن يرفع الدكتور الجلسة، افتح التطبيق واضغط الزر الأصفر (Sync Attendance Now)."
        ]
    }
];

function detectCurrentAppContext() {
    const inputStep = document.getElementById("input-step");
    const scannerStep = document.getElementById("scanner-step");
    const resultStep = document.getElementById("result-step");

    const isInputVisible = inputStep && !inputStep.classList.contains("d-none");
    const isResultVisible = resultStep && !resultStep.classList.contains("d-none");
    const isScannerVisible = scannerStep && !scannerStep.classList.contains("d-none");

let activeErrorText = "";
    const isErrorResult = document.getElementById("status-icon")?.classList.contains("icon-danger");
    if (isResultVisible && isErrorResult) {
        const t = document.getElementById("status-title")?.innerText || "";
        const m = document.getElementById("status-msg")?.innerText || "";
        activeErrorText = `${t} ${m}`.trim();
    }

    if (isInputVisible) {
        return { stage: "before", activeErrorText };
    }
    if (isResultVisible || isScannerVisible) {
        return { stage: "after", activeErrorText };
    }

    const hasSavedId = Boolean(localStorage.getItem("muc_saved_student_id"));
    return { stage: hasSavedId ? "after" : "before", activeErrorText };
}

function injectErrorsModalDOM() {
    if (document.getElementById("muc-errors-guide-modal")) return;

    const styleTag = document.createElement("style");
    styleTag.textContent = `
        @keyframes errModalPopIn {
            from { opacity: 0; transform: translateY(18px) scale(0.97); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .muc-err-card-item {
            display: block;
            width: 100%;
            margin-bottom: 14px;
            background: #ffffff;
            border: 1.5px solid #E2E8F0;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
        }
        .muc-err-card-item:last-child {
            margin-bottom: 0;
        }
        .muc-err-card-item.matched-highlight {
            border: 2px solid #DC2626;
            box-shadow: 0 10px 26px rgba(220, 38, 38, 0.22);
        }
        .muc-err-mockup-box {
            background: #FFFFFF;
            border: 1.5px solid #FECACA;
            border-top: 4px solid #C59B27;
            border-radius: 12px;
            padding: 10px 12px;
            margin: 10px 0;
            text-align: center;
            box-shadow: 0 3px 10px rgba(0, 0, 0, 0.05);
        }
    `;
    document.head.appendChild(styleTag);

    const modal = document.createElement("div");
    modal.id = "muc-errors-guide-modal";
    modal.className = "d-none";
    modal.dir = "rtl";
    modal.style.cssText = "position:fixed; inset:0; background:rgba(12, 2, 4, 0.86); z-index:100005; display:flex; align-items:center; justify-content:center; padding:12px; backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px);";

    modal.innerHTML = `
        <div style="background:#F1F5F9; color:#0F172A; border-radius:20px; width:100%; max-width:460px; max-height:88vh; display:flex; flex-direction:column; box-shadow:0 25px 55px rgba(0,0,0,0.65); border-top:6px solid #7A0C16; overflow:hidden; animation: errModalPopIn 0.25s ease-out;">
            
            <!-- Header -->
            <div style="flex-shrink:0; padding:14px 16px; background:linear-gradient(135deg, #7A0C16, #4A040A); color:#fff; display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="width:40px; height:40px; border-radius:11px; background:rgba(255,255,255,0.14); border:1px solid rgba(253,230,138,0.45); color:#FDE68A; display:flex; align-items:center; justify-content:center; font-size:1.2rem; flex-shrink:0;">
                        <i class="fa-solid fa-circle-exclamation"></i>
                    </div>
                    <div style="text-align:right;">
                        <h4 style="margin:0; font-size:1.05rem; font-weight:900; color:#FFFFFF;">دليل المشاكل والحلول</h4>
                        <div style="font-size:0.74rem; color:#FDE68A; font-weight:700; margin-top:2px;">المشاكل المحتملة في خطوتك الحالية وكيفية حلها</div>
                    </div>
                </div>
                <button type="button" id="btn-close-errors-guide" style="background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.28); color:#fff; width:36px; height:36px; border-radius:10px; font-size:1.1rem; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>

            <!-- Scrollable Cards Container -->
            <div id="errors-guide-list" style="flex:1 1 auto; min-height:0; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:14px; display:block;"></div>
        </div>
    `;

    document.body.appendChild(modal);

    const listContainer = modal.querySelector("#errors-guide-list");
    modal.querySelector("#btn-close-errors-guide").onclick = () => modal.classList.add("d-none");
    modal.onclick = (e) => { if (e.target === modal) modal.classList.add("d-none"); };

    modal._renderForCurrentContext = () => {
        const ctx = detectCurrentAppContext();
        const errLower = (ctx.activeErrorText || "").toLowerCase();

        let filtered = MUC_ERRORS_CATALOG.filter(item => item.stage === ctx.stage);

        let matchedItemId = null;
        if (errLower) {
            const matched = filtered.find(item =>
                item.matchKeywords.some(kw => errLower.includes(kw.toLowerCase()))
            );
            if (matched) {
                matchedItemId = matched.id;
                filtered = [matched, ...filtered.filter(x => x.id !== matched.id)];
            }
        }

        listContainer.innerHTML = filtered.map((item, idx) => {
            const isMatchedNow = item.id === matchedItemId;
            const sevColors = item.severity === "danger"
                ? { iconBg: "#FEE2E2", iconColor: "#DC2626", iconSymbol: "fa-circle-xmark" }
                : (item.severity === "warning"
                    ? { iconBg: "#FEF3C7", iconColor: "#D97706", iconSymbol: "fa-triangle-exclamation" }
                    : { iconBg: "#E0F2FE", iconColor: "#0284C7", iconSymbol: "fa-circle-info" });

            const stepsHtml = item.steps.map((step, sIdx) => `
                <div style="display:flex; align-items:flex-start; gap:8px; margin-top:6px;">
                    <span style="min-width:20px; height:20px; border-radius:50%; background:#10B981; color:#fff; font-size:0.72rem; font-weight:900; display:inline-flex; align-items:center; justify-content:center; margin-top:2px; flex-shrink:0;">${sIdx + 1}</span>
                    <span style="flex:1; color:#065F46; font-size:0.8rem; font-weight:700; line-height:1.55;">${step}</span>
                </div>
            `).join("");

            return `
                <div class="muc-err-card-item ${isMatchedNow ? "matched-highlight" : ""}">
                    ${isMatchedNow ? `
                        <div style="background:#DC2626; color:#fff; font-size:0.76rem; font-weight:900; padding:6px 12px; display:flex; align-items:center; gap:6px;">
                            <i class="fa-solid fa-bullseye"></i>
                            <span>هذا هو الخطأ الظاهر لديك الآن — إليك السبب والحل:</span>
                        </div>
                    ` : ""}

                    <div style="padding:14px;">
                        <!-- عنوان المشكلة -->
                        <div style="display:flex; align-items:center; gap:9px; margin-bottom:6px;">
                            <div style="width:34px; height:34px; border-radius:10px; background:${sevColors.iconBg}; color:${sevColors.iconColor}; display:flex; align-items:center; justify-content:center; font-size:1rem; flex-shrink:0;">
                                <i class="fa-solid ${item.icon}"></i>
                            </div>
                            <strong style="font-size:0.94rem; color:#0F172A; font-weight:900; line-height:1.35;">${idx + 1}. ${item.title}</strong>
                        </div>

                        <!-- شكل الإيرور الفعلي على الشاشة -->
                        <div class="muc-err-mockup-box">
                            <div style="font-size:0.68rem; color:#94A3B8; font-weight:800; margin-bottom:6px;">
                                <i class="fa-solid fa-mobile-screen"></i> شكل الرسالة التي تظهر لك:
                            </div>
                            <div style="width:36px; height:36px; border-radius:50%; background:${sevColors.iconBg}; color:${sevColors.iconColor}; display:flex; align-items:center; justify-content:center; margin:0 auto 6px; font-size:1.1rem;">
                                <i class="fa-solid ${sevColors.iconSymbol}"></i>
                            </div>
                            <div style="font-size:0.86rem; font-weight:900; color:#0F172A; margin-bottom:4px;" dir="auto">${item.mockTitle}</div>
                            <div style="font-size:0.78rem; font-weight:700; color:#475569; line-height:1.5;" dir="auto">${item.mockMessage}</div>
                        </div>

                        <!-- السبب -->
                        <div style="background:#FFFBEB; border:1px solid #FDE68A; border-radius:10px; padding:9px 11px; margin-bottom:8px;">
                            <div style="font-size:0.8rem; font-weight:900; color:#B45309; margin-bottom:3px;">
                                <i class="fa-solid fa-circle-question"></i> السبب:
                            </div>
                            <div style="font-size:0.8rem; color:#78350F; font-weight:700; line-height:1.55;">${item.cause}</div>
                        </div>

                        <!-- الحل -->
                        <div style="background:#ECFDF5; border:1px solid #A7F3D0; border-radius:10px; padding:9px 11px;">
                            <div style="font-size:0.8rem; font-weight:900; color:#047857; margin-bottom:2px;">
                                <i class="fa-solid fa-circle-check"></i> الحل:
                            </div>
                            ${stepsHtml}
                        </div>
                    </div>
                </div>
            `;
        }).join("");

        listContainer.scrollTop = 0;
        modal.classList.remove("d-none");
    };
}

export function openErrorsGuideModal() {
    injectErrorsModalDOM();
    const modal = document.getElementById("muc-errors-guide-modal");
    if (modal && modal._renderForCurrentContext) {
        modal._renderForCurrentContext();
    }
}

window.openErrorsGuideModal = openErrorsGuideModal;
