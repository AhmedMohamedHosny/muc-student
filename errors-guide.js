/**
 * MUC Smart Attendance - Smart Context-Aware Errors & Troubleshooting Guide
 * يتعرف تلقائياً على الشاشة الحالية للطالب ويعرض محاكاة بصرية للإيرور الفعلي والحل الفوري
 */

const MUC_ERRORS_CATALOG = [
    // =========================================================================
    // المرحلة الأولى (before): أخطاء ما قبل إدخال الرقم الجامعي (تسجيل الدخول وربط الهاتف)
    // =========================================================================
    {
        id: "err_invalid_id",
        stage: "before",
        icon: "fa-id-card-clip",
        severity: "danger",
        matchKeywords: ["غير مسجل في قاعدة بيانات الجامعة", "الرقم الجامعي غير صحيح", "اكتب رقمك الجامعي الصحيح"],
        category: "تحقق الهوية",
        title: "الرقم الجامعي غير صحيح أو غير مسجل بالجامعة",
        mockTitle: "الرقم الجامعي غير صحيح",
        mockMessage: "⚠️ الرقم الجامعي (XXXXXXXX) غير مسجل في قاعدة بيانات الجامعة! تأكد من كتابة الـ ID الصحيح.",
        cause: "كتابة رقم جامعي ناقص أو به رقم خطأ، أو كتابة كود المحاضرة (6 أرقام) بالخطأ داخل خانة الرقم الجامعي، أو أنك طالب محوّل حديثاً ولم يُدرج كشفك بعد.",
        steps: [
            "راجع رقمك الجامعي المكون من 8 أرقام من الكارنيه الجامعي واكتبه بدقة.",
            "لا تكتب كود المحاضرة (6 أرقام) في شاشة البداية.",
            "إذا كان رقمك صحيحاً 100% ولا يزال مرفوضاً، تواصل مع دكتور المادة لإضافة رقمك للكشف."
        ]
    },
    {
        id: "err_bound_other_browser",
        stage: "before",
        icon: "fa-mobile-screen-button",
        severity: "danger",
        matchKeywords: ["مربوط بالفعل بمتصفح الطالب الأساسي", "مسموح بهاتف ومتصفح واحد فقط", "مربوط بهاتف ومتصفح آخر"],
        category: "حماية الأجهزة (1/1)",
        title: "الرقم الجامعي مربوط بهاتف أو متصفح آخر",
        mockTitle: "الرقم الجامعي مربوط بهاتف ومتصفح آخر!",
        mockMessage: "🚫 عفواً، الرقم الجامعي (XXXXXXXX) مربوط بالفعل بمتصفح الطالب الأساسي (مسموح بهاتف ومتصفح واحد فقط لكل طالب)! لا يمكن فتح الحساب من المتصفح الخفي أو من متصفح أو هاتف آخر.",
        cause: "حسابك مربوط مسبقاً بمتصفحك الأساسي (مثل Chrome أو Safari)، وأنت تحاول الآن الدخول من المتصفح الخفي (Incognito) أو متصفح ثانٍ أو هاتف زميلك.",
        steps: [
            "أغلق المتصفح الخفي أو المتصفح البديل وافتح الرابط من متصفحك العادي الأصلي.",
            "إذا اشتريت هاتفاً جديداً أو قمت بعمل فورمات للهاتف، اطلب من دكتور المادة الضغط على أيقونة فك القفل (📱🔓) بجانب اسمك في الكشف لإعادة الربط."
        ]
    },
    {
        id: "err_phone_owned_by_other",
        stage: "before",
        icon: "fa-user-lock",
        severity: "danger",
        matchKeywords: ["مربوط بالفعل بالطالب", "ممنوع فتح حساب طالب آخر", "أكثر من حساب واحد على نفس الهاتف"],
        category: "قفل ملكية الهاتف",
        title: "ممنوع فتح حساب طالب آخر على نفس الهاتف",
        mockTitle: "ممنوع فتح حساب طالب آخر!",
        mockMessage: "🚫 هذا الهاتف مربوط بالفعل بالطالب: [اسم الطالب] (XXXXXXXX) — لا يسمح النظام بفتح أكثر من حساب واحد على نفس الهاتف.",
        cause: "هذا الهاتف مسجل ومملوك لطالب آخر، والمنظومة تمنع تسجيل أكثر من طالب من نفس الموبايل لمنع التحضير بالنيابة.",
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
        category: "إعادة ضبط الربط",
        title: "تم إلغاء ربط هذا الهاتف بواسطة المشرف",
        mockTitle: "تم إلغاء ربط هذا الهاتف",
        mockMessage: "🚫 قام مشرف المنظومة بإلغاء ربط هذا الهاتف بالرقم الجامعي (XXXXXXXX). يرجى إدخال رقمك الجامعي الصحيح والموافقة على الربط من جديد.",
        cause: "قام دكتور المادة أو مشرف المنظومة بفك ربط هاتفك بناءً على طلبك أو لتحديث بيانات الأجهزة.",
        steps: [
            "اكتب رقمك الجامعي في الخانة واضغط (تسجيل الدخول ومتابعة).",
            "ستظهر لك نافذة التأكيد، اضغط (Yes - نعم، متأكد) لتثبيت ربط هاتفك من جديد."
        ]
    },
    {
        id: "err_first_login_offline",
        stage: "before",
        icon: "fa-wifi",
        severity: "warning",
        matchKeywords: ["تفعيل الرقم الجامعي وربطه بالهاتف لأول مرة", "مطلوب اتصال بالإنترنت", "الشبكة ضعيفة حالياً"],
        category: "اتصال التفعيل",
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
        category: "أمان المتصفح",
        title: "حظر الدخول من المتصفح الخفي (Incognito)",
        mockTitle: "ممنوع استخدام المتصفح الخفي!",
        mockMessage: "عفواً يا بشمهندس، تم رصد فتح المنظومة في وضع (Incognito / Private Browsing). يُرجى فتح الرابط من المتصفح العادي.",
        cause: "المتصفح الخفي يقوم بمسح بصمة الجهاز والكاش تلقائياً بمجرد إغلاقه، لذلك ترفضه المنظومة.",
        steps: [
            "أغلق نافذة التصفح الخفي تماماً.",
            "افتح الرابط من متصفح Chrome أو Safari العادي."
        ]
    },

    // =========================================================================
    // المرحلة الثانية (after): أخطاء ما بعد إدخال الرقم الجامعي (المسح، PIN، السكشن، الأوفلاين)
    // =========================================================================
    {
        id: "err_online_required",
        stage: "after",
        icon: "fa-globe",
        severity: "danger",
        matchKeywords: ["تتطلب اتصالاً بالإنترنت لتسجيل حضورك", "تتطلب اتصالاً فعلياً بالإنترنت"],
        category: "محاضرة أونلاين",
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
        category: "بطء الشبكة بالمدرج",
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
        category: "تحديث الرمز",
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
        category: "كود الـ PIN",
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
        category: "قيد المقررات",
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
        category: "توزيع السكاشن",
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
        category: "تكرار التسجيل",
        title: "تم تسجيل حضورك لهذه المحاضرة مسبقاً",
        mockTitle: "Check-in Failed",
        mockMessage: "⚠️ لقد قمت بتسجيل حضورك لهذه المحاضرة بالفعل (Lecture #X)!",
        cause: "تم تسجيل حضورك على السيرفر بنجاح في المحاولة الأولى (حتى لو ضعفت الشبكة لحظة ظهور الإيصال) وتحاول التسجيل مرة ثانية.",
        steps: [
            "لا تقلق، حضورك مثبت بالفعل في كشف الدكتور ولا تحتاج لإعادة المسح."
        ]
    },
    {
        id: "err_camera_blocked",
        stage: "after",
        icon: "fa-camera-rotate",
        severity: "warning",
        matchKeywords: ["إذن الكاميرا", "تطبيق عائم", "تعذر تشغيل الكاميرا"],
        category: "صلاحية الكاميرا",
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
        category: "الحضور بدون نت",
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

// الكشف التلقائي عن الشاشة المفتوحة حالياً والخطأ الظاهر إن وجد
function detectCurrentAppContext() {
    const inputStep = document.getElementById("input-step");
    const scannerStep = document.getElementById("scanner-step");
    const resultStep = document.getElementById("result-step");

    const isInputVisible = inputStep && !inputStep.classList.contains("d-none");
    const isResultVisible = resultStep && !resultStep.classList.contains("d-none");
    const isScannerVisible = scannerStep && !scannerStep.classList.contains("d-none");

    let activeErrorText = "";
    if (isResultVisible) {
        const t = document.getElementById("status-title")?.innerText || "";
        const m = document.getElementById("status-msg")?.innerText || "";
        activeErrorText = `${t} ${m}`.trim();
    }

    if (isInputVisible) {
        return {
            stage: "before",
            label: "شاشة إدخال الرقم الجامعي (قبل الدخول)",
            activeErrorText
        };
    }

    if (isResultVisible || isScannerVisible) {
        return {
            stage: "after",
            label: isResultVisible ? "شاشة نتيجة التحضير (بعد الدخول)" : "شاشة مسح الباركود والكود (بعد الدخول)",
            activeErrorText
        };
    }

    const hasSavedId = Boolean(localStorage.getItem("muc_saved_student_id"));
    return {
        stage: hasSavedId ? "after" : "before",
        label: hasSavedId ? "شاشة مسح الباركود والكود (بعد الدخول)" : "شاشة إدخال الرقم الجامعي (قبل الدخول)",
        activeErrorText
    };
}

function injectErrorsModalDOM() {
    if (document.getElementById("muc-errors-guide-modal")) return;

    const styleTag = document.createElement("style");
    styleTag.textContent = `
        @keyframes errModalSlideUp {
            from { opacity: 0; transform: translateY(22px) scale(0.97); }
            to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .muc-err-card-item {
            background: #ffffff;
            border: 1px solid #E2E8F0;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05);
            transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .muc-err-card-item.matched-highlight {
            border: 2px solid #DC2626;
            box-shadow: 0 10px 28px rgba(220, 38, 38, 0.22);
        }
        .muc-err-mockup-box {
            background: #FFFFFF;
            border: 1.5px solid #FECACA;
            border-top: 4px solid #C59B27;
            border-radius: 12px;
            padding: 10px 12px;
            margin: 8px 0 10px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        }
    `;
    document.head.appendChild(styleTag);

    const modal = document.createElement("div");
    modal.id = "muc-errors-guide-modal";
    modal.className = "d-none";
    modal.dir = "rtl";
    modal.style.cssText = "position:fixed; inset:0; background:rgba(12, 2, 4, 0.86); z-index:100005; display:flex; align-items:center; justify-content:center; padding:0.85rem; backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px);";

    modal.innerHTML = `
        <div style="background:#F8FAFC; color:#0F172A; border-radius:22px; width:100%; max-width:470px; max-height:91vh; display:flex; flex-direction:column; box-shadow:0 28px 60px rgba(0,0,0,0.65); border-top:6px solid #7A0C16; overflow:hidden; animation: errModalSlideUp 0.28s ease-out;">
            
            <!-- Header -->
            <div style="padding:0.95rem 1.15rem; background:linear-gradient(135deg, #7A0C16, #4A040A); color:#fff; display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="width:42px; height:42px; border-radius:12px; background:rgba(255,255,255,0.14); border:1px solid rgba(253,230,138,0.45); color:#FDE68A; display:flex; align-items:center; justify-content:center; font-size:1.25rem;">
                        <i class="fa-solid fa-shield-virus"></i>
                    </div>
                    <div style="text-align:right;">
                        <h4 style="margin:0; font-size:1.05rem; font-weight:900; color:#FFFFFF;">مركز حلول الأخطاء الذكي</h4>
                        <div id="err-detected-stage-badge" style="font-size:0.72rem; color:#FDE68A; font-weight:700; margin-top:2px;">
                            <i class="fa-solid fa-location-crosshairs"></i> جاري تحديد الشاشة الحالية...
                        </div>
                    </div>
                </div>
                <button type="button" id="btn-close-errors-guide" style="background:rgba(255,255,255,0.14); border:1px solid rgba(255,255,255,0.25); color:#fff; width:36px; height:36px; border-radius:10px; font-size:1.1rem; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>

            <!-- Search & Auto-Stage Switcher -->
            <div style="padding:0.75rem 1rem; background:#FFFFFF; border-bottom:1px solid #E2E8F0;">
                <div style="position:relative; margin-bottom:8px;">
                    <i class="fa-solid fa-magnifying-glass" style="position:absolute; right:12px; top:50%; transform:translateY(-50%); color:#94A3B8; font-size:0.85rem;"></i>
                    <input type="text" id="errors-guide-search" placeholder="ابحث بكلمة من الخطأ (مثال: PIN، سكشن، خفي، نت)..." style="width:100%; padding:0.55rem 2.2rem 0.55rem 0.75rem; border:1.5px solid #CBD5E1; border-radius:10px; font-size:0.82rem; font-weight:700; outline:none; background:#F8FAFC;">
                </div>
                <div style="display:flex; gap:6px; background:#F1F5F9; padding:4px; border-radius:10px;">
                    <button type="button" class="err-stage-tab" data-stage="before" style="flex:1; padding:6px 4px; border-radius:8px; border:none; background:transparent; color:#475569; font-size:0.74rem; font-weight:800; cursor:pointer; transition:0.15s;">
                        <i class="fa-solid fa-right-to-bracket"></i> قبل إدخال الـ ID
                    </button>
                    <button type="button" class="err-stage-tab" data-stage="after" style="flex:1; padding:6px 4px; border-radius:8px; border:none; background:transparent; color:#475569; font-size:0.74rem; font-weight:800; cursor:pointer; transition:0.15s;">
                        <i class="fa-solid fa-qrcode"></i> بعد إدخال الـ ID
                    </button>
                    <button type="button" class="err-stage-tab" data-stage="all" style="padding:6px 10px; border-radius:8px; border:none; background:transparent; color:#475569; font-size:0.74rem; font-weight:800; cursor:pointer; transition:0.15s;">
                        الكل
                    </button>
                </div>
            </div>

            <!-- Cards Container -->
            <div id="errors-guide-list" style="flex:1; overflow-y:auto; padding:0.85rem 1rem; display:flex; flex-direction:column; gap:12px;"></div>
        </div>
    `;

    document.body.appendChild(modal);

    let currentStage = "before";
    let currentActiveErrText = "";
    const searchInput = modal.querySelector("#errors-guide-search");
    const listContainer = modal.querySelector("#errors-guide-list");
    const tabs = modal.querySelectorAll(".err-stage-tab");

    function renderErrorsList() {
        const q = (searchInput.value || "").trim().toLowerCase();
        const errLower = currentActiveErrText.toLowerCase();

        let filtered = MUC_ERRORS_CATALOG.filter(item => {
            if (currentStage !== "all" && item.stage !== currentStage) return false;
            if (!q) return true;
            return (
                item.title.toLowerCase().includes(q) ||
                item.mockTitle.toLowerCase().includes(q) ||
                item.mockMessage.toLowerCase().includes(q) ||
                item.cause.toLowerCase().includes(q) ||
                item.steps.some(s => s.toLowerCase().includes(q))
            );
        });

        // إذا كان هناك خطأ ظاهر حالياً في شاشة الطالب، نضعه في المقدمة تلقائياً
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

        if (filtered.length === 0) {
            listContainer.innerHTML = `
                <div style="text-align:center; padding:2.5rem 1rem; color:#94A3B8;">
                    <i class="fa-solid fa-magnifying-glass-minus" style="font-size:2rem; opacity:0.4; margin-bottom:8px;"></i>
                    <div style="font-weight:800; font-size:0.88rem;">لا توجد نتائج مطابقة لبحثك</div>
                </div>`;
            return;
        }

        listContainer.innerHTML = filtered.map((item, idx) => {
            const isMatchedNow = item.id === matchedItemId;
            const sevColors = item.severity === "danger"
                ? { badgeBg: "#FEE2E2", badgeText: "#DC2626", iconBg: "#FEF2F2", iconColor: "#DC2626", iconSymbol: "fa-circle-xmark" }
                : (item.severity === "warning"
                    ? { badgeBg: "#FEF3C7", badgeText: "#B45309", iconBg: "#FFFBEB", iconColor: "#D97706", iconSymbol: "fa-triangle-exclamation" }
                    : { badgeBg: "#E0F2FE", badgeText: "#0369A1", iconBg: "#F0F9FF", iconColor: "#0284C7", iconSymbol: "fa-circle-info" });

            const stepsHtml = item.steps.map((step, sIdx) => `
                <div style="display:flex; align-items:flex-start; gap:7px; margin-top:4px;">
                    <span style="min-width:18px; height:18px; border-radius:50%; background:#10B981; color:#fff; font-size:0.68rem; font-weight:900; display:inline-flex; align-items:center; justify-content:center; margin-top:2px;">${sIdx + 1}</span>
                    <span style="flex:1;">${step}</span>
                </div>
            `).join("");

            return `
                <div class="muc-err-card-item ${isMatchedNow ? "matched-highlight" : ""}">
                    ${isMatchedNow ? `
                        <div style="background:#DC2626; color:#fff; font-size:0.74rem; font-weight:900; padding:4px 12px; display:flex; align-items:center; gap:6px;">
                            <i class="fa-solid fa-bullseye"></i>
                            <span>هذا هو الخطأ الظاهر أمامك الآن — إليك السبب والحل:</span>
                        </div>
                    ` : ""}

                    <div style="padding:12px;">
                        <!-- عنوان المشكلة والتصنيف -->
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:6px;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <div style="width:32px; height:32px; border-radius:9px; background:${sevColors.iconBg}; color:${sevColors.iconColor}; display:flex; align-items:center; justify-content:center; font-size:0.95rem; flex-shrink:0;">
                                    <i class="fa-solid ${item.icon}"></i>
                                </div>
                                <strong style="font-size:0.9rem; color:#0F172A; font-weight:900; line-height:1.35;">${idx + 1}. ${item.title}</strong>
                            </div>
                            <span style="background:${sevColors.badgeBg}; color:${sevColors.badgeText}; padding:2px 8px; border-radius:20px; font-size:0.66rem; font-weight:800; white-space:nowrap; flex-shrink:0;">
                                ${item.category}
                            </span>
                        </div>

                        <!-- محاكاة بصرية لشكل الإيرور الفعلي على الشاشة -->
                        <div class="muc-err-mockup-box">
                            <div style="font-size:0.66rem; color:#94A3B8; font-weight:800; margin-bottom:5px; text-transform:uppercase; letter-spacing:0.4px;">
                                <i class="fa-solid fa-mobile-screen"></i> شكل الرسالة التي تظهر لك على الشاشة:
                            </div>
                            <div style="width:34px; height:34px; border-radius:50%; background:${sevColors.iconBg}; color:${sevColors.iconColor}; display:flex; align-items:center; justify-content:center; margin:0 auto 5px; font-size:1.05rem;">
                                <i class="fa-solid ${sevColors.iconSymbol}"></i>
                            </div>
                            <div style="font-size:0.84rem; font-weight:900; color:#0F172A; margin-bottom:3px;" dir="auto">${item.mockTitle}</div>
                            <div style="font-size:0.75rem; font-weight:700; color:#475569; line-height:1.45;" dir="auto">${item.mockMessage}</div>
                        </div>

                        <!-- السبب -->
                        <div style="background:#FFFBEB; border:1px solid #FDE68A; border-radius:10px; padding:8px 10px; margin-bottom:8px; font-size:0.78rem; color:#78350F; font-weight:700; line-height:1.5;">
                            <div style="font-weight:900; color:#B45309; margin-bottom:2px;">
                                <i class="fa-solid fa-circle-question"></i> لماذا ظهر هذا الخطأ؟
                            </div>
                            ${item.cause}
                        </div>

                        <!-- خطوات الحل -->
                        <div style="background:#ECFDF5; border:1px solid #A7F3D0; border-radius:10px; padding:8px 10px; font-size:0.78rem; color:#065F46; font-weight:700; line-height:1.5;">
                            <div style="font-weight:900; color:#047857; margin-bottom:3px;">
                                <i class="fa-solid fa-wand-magic-sparkles"></i> خطوات الحل الفوري:
                            </div>
                            ${stepsHtml}
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    }

    tabs.forEach(tab => {
        tab.onclick = () => {
            currentStage = tab.dataset.stage;
            tabs.forEach(t => {
                const active = t.dataset.stage === currentStage;
                t.style.background = active ? "#7A0C16" : "transparent";
                t.style.color = active ? "#FFFFFF" : "#475569";
                t.style.boxShadow = active ? "0 2px 8px rgba(122,12,22,0.28)" : "none";
            });
            renderErrorsList();
        };
    });

    searchInput.oninput = renderErrorsList;
    modal.querySelector("#btn-close-errors-guide").onclick = () => modal.classList.add("d-none");
    modal.onclick = (e) => { if (e.target === modal) modal.classList.add("d-none"); };

    modal._openWithAutoContext = (requestedStage = "auto") => {
        const ctx = detectCurrentAppContext();
        const targetStage = requestedStage === "auto" ? ctx.stage : requestedStage;
        currentActiveErrText = ctx.activeErrorText || "";
        searchInput.value = "";

        const badgeEl = modal.querySelector("#err-detected-stage-badge");
        if (badgeEl) {
            badgeEl.innerHTML = `<i class="fa-solid fa-location-crosshairs"></i> الشاشة الحالية: ${ctx.label}`;
        }

        const targetTab = modal.querySelector(`.err-stage-tab[data-stage="${targetStage}"]`) || tabs[0];
        targetTab.click();
        listContainer.scrollTop = 0;
        modal.classList.remove("d-none");
    };
}

export function openErrorsGuideModal(stage = "auto") {
    injectErrorsModalDOM();
    const modal = document.getElementById("muc-errors-guide-modal");
    if (modal && modal._openWithAutoContext) {
        modal._openWithAutoContext(stage);
    }
}

window.openErrorsGuideModal = openErrorsGuideModal;
