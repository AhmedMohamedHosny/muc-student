/**
 * MUC Smart Attendance - Complete Student Errors & Troubleshooting Guide
 * يعمل 100% أونلاين وأوفلاين
 */

const MUC_ERRORS_CATALOG = [
    // ====================================================
    // 1. أخطاء مرحلة ما قبل إدخال الرقم الجامعي (تسجيل الدخول وربط الهاتف)
    // ====================================================
    {
        stage: "before",
        title: "الرقم الجامعي غير صحيح / غير مسجل في قاعدة بيانات الجامعة",
        symptom: "⚠️ الرقم الجامعي (XXXXXXX) غير مسجل في قاعدة بيانات الجامعة!",
        cause: "كتابة رقم جامعي خاطئ أو ناقص، أو كتابة كود المحاضرة (6 أرقام) في خانة الرقم الجامعي، أو أنك طالب محوّل حديثاً ولم يُدرج كشفك بعد.",
        solution: "تأكد من كتابة رقمك الجامعي الصحيح (8 أرقام) من الكارنيه. إذا كان الرقم صحيحاً 100% تواصل مع دكتور المادة لإضافتك في الكشف."
    },
    {
        stage: "before",
        title: "الرقم الجامعي مربوط بهاتف ومتصفح آخر (1/1)",
        symptom: "🚫 عفواً، الرقم الجامعي مربوط بالفعل بمتصفح الطالب الأساسي (مسموح بهاتف ومتصفح واحد فقط لكل طالب)!",
        cause: "رقمك الجامعي مربوط مسبقاً بمتصفحك الأساسي (مثل Chrome أو Safari)، وأنت تحاول الآن فتحه من المتصفح الخفي (Incognito) أو من متصفح آخر أو من هاتف زميلك.",
        solution: "أغلق المتصفح الخفي وافتح الرابط من متصفحك العادي الأصلي. إذا غيّرت هاتفك أو قمت بعمل فورمات، اطلب من دكتور المادة الضغط على أيقونة فك ربط الهاتف (📱🔓) بجانب اسمك في الكشف."
    },
    {
        stage: "before",
        title: "ممنوع فتح حساب طالب آخر على نفس الهاتف",
        symptom: "🚫 هذا الهاتف مربوط بالفعل بالطالب: [الاسم] (الرقم الجامعي)",
        cause: "هذا الهاتف مسجل ومملوك لطالب آخر، والنظام يمنع تسجيل أكثر من طالب من نفس الموبايل لمنع التحضير بالنيابة.",
        solution: "يجب أن يسجل كل طالب من هاتفه الشخصي فقط. إذا اشتريت الهاتف من زميلك، اطلب من مشرف المنظومة فك ربط الهاتف من لوحة الإدارة."
    },
    {
        stage: "before",
        title: "تم إلغاء ربط هذا الهاتف",
        symptom: "🚫 قام مشرف المنظومة بإلغاء ربط هذا الهاتف بالرقم الجامعي.",
        cause: "قام دكتور المادة أو مشرف المنظومة بعمل إعادة ضبط (Reset) لربط هاتفك بناءً على طلبك أو لمراجعة البيانات.",
        solution: "أعد كتابة رقمك الجامعي واضغط (Yes - نعم، متأكد) لتثبيت ربط هاتفك من جديد."
    },
    {
        stage: "before",
        title: "مطلوب اتصال بالإنترنت عند أول تسجيل دخول",
        symptom: "⚠️ تفعيل الرقم الجامعي وربطه بالهاتف لأول مرة يتطلب اتصالاً بالإنترنت / الشبكة ضعيفة حالياً.",
        cause: "ربط الرقم الجامعي بالهاتف لأول مرة فقط يحتاج اتصالاً بالسيرفر للتحقق من اسمك ومقرراتك وتثبيت بصمة الجهاز.",
        solution: "افتح بيانات الهاتف (Mobile Data) أو الـ Wi-Fi لمدة 5 ثوانٍ لتفعيل حسابك، وبعدها سيعمل التطبيق معك أونلاين وأوفلاين طوال الفصل الدراسي."
    },
    {
        stage: "before",
        title: "ممنوع استخدام المتصفح الخفي (Incognito)",
        symptom: "ممنوع استخدام المتصفح الخفي! تم رصد فتح المنظومة في وضع Incognito / Private.",
        cause: "المتصفح الخفي يمسح بصمة الجهاز والكاش تلقائياً، لذلك تحظره المنظومة.",
        solution: "أغلق علامة التبويب الخفية وافتح الرابط من المتصفح العادي (Chrome أو Safari)."
    },

    // ====================================================
    // 2. أخطاء مرحلة ما بعد إدخال الرقم الجامعي (المسح، PIN، السكشن، الأوفلاين)
    // ====================================================
    {
        stage: "after",
        title: "هذه المحاضرة أونلاين وتتطلب اتصالاً بالإنترنت",
        symptom: "🌐 هذه المحاضرة أونلاين (مباشرة) وتتطلب اتصالاً بالإنترنت لتسجيل حضورك فوراً على شاشة المدرج!",
        cause: "الدكتور فتح المحاضرة بنظام الأونلاين المباشر وهاتفك غير متصل بالإنترنت (أو وضع الطيران مفعل).",
        solution: "افتح بيانات الهاتف (4G/5G) أو الواي فاي ثم اضغط على زر (Try Again) وأعد المسح أو إدخال الكود."
    },
    {
        stage: "after",
        title: "Weak Network Signal (إشارة الإنترنت ضعيفة في المدرج)",
        symptom: "⚠️ إشارة الإنترنت في المدرج ضعيفة جداً حالياً. يرجى الضغط على Try Again للمحاولة مرة أخرى.",
        cause: "ازدحام الشبكة داخل المدرج أو ضعف التغطية أدى إلى تأخر وصول الطلب للسيرفر.",
        solution: "انتظر ثانيتين واضغط (Try Again)، أو استخدم زر (Enter 6-Digit PIN) لإدخال الكود الرقمي الظاهر أعلى الباركود."
    },
    {
        stage: "after",
        title: "انتهاء صلاحية الباركود أو الكود الرقمي (Expired QR / PIN)",
        symptom: "QR Code expired! / ⏰ انتهت صلاحية الكود الرقمي لأن الرمز تجدد أو أُغلقت المحاضرة!",
        cause: "الباركود وكود الـ PIN يتغيران تلقائياً كل 15 إلى 20 ثانية لمنع تصوير الشاشة وإرسالها خارج المدرج، والكود الذي استخدمته انتهى وقته.",
        solution: "وجّه الكاميرا نحو الباركود الجديد الظاهر الآن على البروجيكتور أو اكتب الـ 6 أرقام الجديدة فوراً."
    },
    {
        stage: "after",
        title: "Invalid PIN (الكود الرقمي غير صحيح)",
        symptom: "❌ الكود الرقمي (XXXXXX) غير صحيح أو منتهي الصلاحية!",
        cause: "إدخال رقم ناقص أو خاطئ، أو كتابة رقمك الجامعي (8 أرقام) بالخطأ بدلاً من كود المحاضرة (6 أرقام).",
        solution: "انقل الـ 6 أرقام المكتوبة باللون الأصفر أعلى الباركود على شاشة المدرج بدقة."
    },
    {
        stage: "after",
        title: "غير مقيد في المقرر الدراسي (Not Enrolled)",
        symptom: "غير مقيد في مقرر (...) / You are not enrolled in this course.",
        cause: "تحاول تسجيل حضور لمادة غير مدرجة في جدولك الدراسي المسجل بالمنظومة.",
        solution: "تأكد أنك في المحاضرة الصحيحة لمادتك. إذا كانت المادة مسجلة لك رسمياً راجع دكتور المادة لإضافة رقمك الجامعي للكشف."
    },
    {
        stage: "after",
        title: "غير مسموح بالتسجيل في سكشن أو مجموعة أخرى",
        symptom: "🚫 غير مسموح بتسجيل الحضور! الطالب مقيد في [سكشن X] ولا يمكنه التسجيل في [سكشن Y].",
        cause: "أنت تحاول تسجيل الحضور في سكشن أو معمل يخص مجموعة أخرى غير مجموعتك المسجلة في النظام.",
        solution: "التزم بالحضور في موعد سكشنك الرسمي، أو اطلب من المعيد/الدكتور تحضيرك يدوياً إذا كان لديك عذر رسمي."
    },
    {
        stage: "after",
        title: "لقد قمت بتسجيل حضورك لهذه المحاضرة بالفعل",
        symptom: "⚠️ لقد قمت بتسجيل حضورك لهذه المحاضرة بالفعل (Lecture #X)!",
        cause: "تم تسجيل حضورك على السيرفر بنجاح في المحاولة الأولى (حتى لو انقطع الإنترنت لحظة ظهور الإيصال)، وتحاول التسجيل مرة ثانية لنفس المحاضرة.",
        solution: "لا تقلق، حضورك مثبت بالفعل في كشف الدكتور ولا تحتاج لإعادة التسجيل."
    },
    {
        stage: "after",
        title: "تعذر فتح الكاميرا أو وجود تطبيق عائم",
        symptom: "تعذر فتح إذن الكاميرا بسبب وجود تطبيق عائم على الشاشة / حظر إذن الكاميرا.",
        cause: "رفض صلاحية الكاميرا في المتصفح، أو وجود فقاعات شات (Messenger) أو تطبيق تسجيل شاشة أو فلتر إضاءة يغطي الشاشة.",
        solution: "اسحب فقاعات الشات لأسفل وأغلق أي نافذة عائمة، أو اضغط على زر (Enter 6-Digit PIN) وسجّل حضورك بالكود الرقمي مباشرة بدون كاميرا."
    },
    {
        stage: "after",
        title: "Saved Offline ⏳ (لماذا لم يظهر اسمي على الشاشة فوراً؟)",
        symptom: "Saved Offline ⏳ (Pending Sync) / Waiting for instructor to upload offline lecture...",
        cause: "الدكتور فتح المحاضرة في وضع عدم الاتصال (Offline Mode)، وتم حفظ حضورك بأمان داخل هاتفك لحين رفع الجلسة.",
        solution: "لا تمسح بيانات المتصفح؛ وعند عودة الإنترنت افتح التطبيق واضغط على الزر الأصفر (Sync Attendance Now) لرفع حضورك للسيرفر."
    }
];

function injectErrorsModalDOM() {
    if (document.getElementById("muc-errors-guide-modal")) return;

    const modal = document.createElement("div");
    modal.id = "muc-errors-guide-modal";
    modal.className = "d-none";
    modal.dir = "rtl";
    modal.style.cssText = "position:fixed; inset:0; background:rgba(15, 2, 5, 0.88); z-index:100005; display:flex; align-items:center; justify-content:center; padding:0.9rem; backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px);";

    modal.innerHTML = `
        <div style="background:#ffffff; color:#0F172A; border-radius:20px; width:100%; max-width:460px; max-height:90vh; display:flex; flex-direction:column; box-shadow:0 25px 55px rgba(0,0,0,0.6); border-top:6px solid #DC2626; overflow:hidden;">
            <!-- Header -->
            <div style="padding:0.95rem 1.15rem; background:#FEF2F2; border-bottom:1px solid #FECACA; display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="width:40px; height:40px; border-radius:50%; background:#DC2626; color:#fff; display:flex; align-items:center; justify-content:center; font-size:1.25rem; box-shadow:0 4px 12px rgba(220,38,38,0.35);">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                    </div>
                    <div style="text-align:right;">
                        <h4 style="margin:0; font-size:1.05rem; font-weight:900; color:#7A0C16;">دليل الأخطاء المتوقعة وحلولها</h4>
                        <span style="font-size:0.74rem; color:#991B1B; font-weight:700;">لو ظهرلك أي خطأ اعرف السبب والحل فوراً</span>
                    </div>
                </div>
                <button type="button" id="btn-close-errors-guide" style="background:#FEE2E2; border:1px solid #FECACA; color:#DC2626; width:34px; height:34px; border-radius:10px; font-size:1.1rem; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>

            <!-- Search & Stage Tabs -->
            <div style="padding:0.75rem 1.1rem; background:#F8FAFC; border-bottom:1px solid #E2E8F0;">
                <div style="position:relative; margin-bottom:8px;">
                    <i class="fa-solid fa-magnifying-glass" style="position:absolute; right:12px; top:50%; transform:translateY(-50%); color:#94A3B8; font-size:0.85rem;"></i>
                    <input type="text" id="errors-guide-search" placeholder="ابحث بكلمة من رسالة الخطأ (مثال: PIN، سكشن، خفي، نت)..." style="width:100%; padding:0.55rem 2.1rem 0.55rem 0.75rem; border:1.5px solid #CBD5E1; border-radius:10px; font-size:0.82rem; font-weight:700; outline:none;">
                </div>
                <div style="display:flex; gap:6px;">
                    <button type="button" class="err-stage-tab" data-stage="all" style="flex:1; padding:5px 6px; border-radius:8px; border:1.5px solid #DC2626; background:#DC2626; color:#fff; font-size:0.74rem; font-weight:800; cursor:pointer;">الكل (${MUC_ERRORS_CATALOG.length})</button>
                    <button type="button" class="err-stage-tab" data-stage="before" style="flex:1; padding:5px 6px; border-radius:8px; border:1.5px solid #CBD5E1; background:#fff; color:#334155; font-size:0.74rem; font-weight:800; cursor:pointer;">قبل إدخال الـ ID</button>
                    <button type="button" class="err-stage-tab" data-stage="after" style="flex:1; padding:5px 6px; border-radius:8px; border:1.5px solid #CBD5E1; background:#fff; color:#334155; font-size:0.74rem; font-weight:800; cursor:pointer;">بعد إدخال الـ ID</button>
                </div>
            </div>

            <!-- List -->
            <div id="errors-guide-list" style="flex:1; overflow-y:auto; padding:0.85rem 1.1rem; display:flex; flex-direction:column; gap:10px; background:#FFFFFF;"></div>
        </div>
    `;

    document.body.appendChild(modal);

    let currentStage = "all";
    const searchInput = modal.querySelector("#errors-guide-search");
    const listContainer = modal.querySelector("#errors-guide-list");
    const tabs = modal.querySelectorAll(".err-stage-tab");

    function renderErrorsList() {
        const q = (searchInput.value || "").trim().toLowerCase();
        const filtered = MUC_ERRORS_CATALOG.filter(item => {
            if (currentStage !== "all" && item.stage !== currentStage) return false;
            if (!q) return true;
            return (
                item.title.toLowerCase().includes(q) ||
                item.symptom.toLowerCase().includes(q) ||
                item.cause.toLowerCase().includes(q) ||
                item.solution.toLowerCase().includes(q)
            );
        });

        if (filtered.length === 0) {
            listContainer.innerHTML = `<div style="text-align:center; padding:2rem 1rem; color:#94A3B8; font-weight:700; font-size:0.85rem;">لا توجد نتائج مطابقة لبحثك.</div>`;
            return;
        }

        listContainer.innerHTML = filtered.map((item, idx) => {
            const stageTag = item.stage === "before"
                ? `<span style="background:#FEF3C7; color:#92400E; padding:1px 7px; border-radius:6px; font-size:0.66rem; font-weight:800;">قبل إدخال الـ ID</span>`
                : `<span style="background:#E0F2FE; color:#075985; padding:1px 7px; border-radius:6px; font-size:0.66rem; font-weight:800;">بعد إدخال الـ ID</span>`;

            return `
                <div style="border:1.5px solid #E2E8F0; border-right:4px solid #DC2626; border-radius:12px; padding:10px 12px; background:#F8FAFC; text-align:right;">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; margin-bottom:5px;">
                        <strong style="font-size:0.86rem; color:#7A0C16; font-weight:900;">${idx + 1}. ${item.title}</strong>
                        ${stageTag}
                    </div>
                    <div style="background:#FEE2E2; color:#991B1B; padding:5px 8px; border-radius:7px; font-size:0.75rem; font-weight:800; margin-bottom:6px; line-height:1.45;">
                        <i class="fa-solid fa-circle-xmark"></i> لو ظهرلك: ${item.symptom}
                    </div>
                    <div style="font-size:0.78rem; color:#334155; font-weight:700; margin-bottom:4px; line-height:1.5;">
                        <span style="color:#B45309; font-weight:900;">• السبب:</span> ${item.cause}
                    </div>
                    <div style="font-size:0.78rem; color:#065F46; font-weight:700; line-height:1.5; background:#ECFDF5; padding:5px 8px; border-radius:7px; border:1px solid #A7F3D0;">
                        <span style="font-weight:900;">✔ الحل:</span> ${item.solution}
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
                t.style.background = active ? "#DC2626" : "#fff";
                t.style.color = active ? "#fff" : "#334155";
                t.style.borderColor = active ? "#DC2626" : "#CBD5E1";
            });
            renderErrorsList();
        };
    });

    searchInput.oninput = renderErrorsList;
    modal.querySelector("#btn-close-errors-guide").onclick = () => modal.classList.add("d-none");
    modal.onclick = (e) => { if (e.target === modal) modal.classList.add("d-none"); };

    modal._setStageAndOpen = (stage = "all") => {
        searchInput.value = "";
        const targetTab = modal.querySelector(`.err-stage-tab[data-stage="${stage}"]`) || tabs[0];
        targetTab.click();
        modal.classList.remove("d-none");
    };
}

export function openErrorsGuideModal(stage = "all") {
    injectErrorsModalDOM();
    const modal = document.getElementById("muc-errors-guide-modal");
    if (modal && modal._setStageAndOpen) {
        modal._setStageAndOpen(stage);
    }
}

window.openErrorsGuideModal = openErrorsGuideModal;
