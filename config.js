/**
 * MUC Attendance Management System
 * May University in Cairo (جامعة مايو بالقاهرة)
 * Central Configuration File
 */

export const CONFIG = {
    // University Branding & Identification
    university: {
        name: "جامعة مايو بالقاهرة",
        nameEn: "May University in Cairo",
        shortName: "MUC",
        systemName: "MUC Attendance Management System",
        portalTitle: "Doctor Portal - بوابة أعضاء هيئة التدريس",
        logoPath: "logo.png",
        faviconPath: "favicon.ico",
        supportEmail: "it-support@muc.edu.eg"
    },

    // Session & QR Attendance Rules
attendance: {
        qrRefreshIntervalMs: 60000,       // دقيقة كاملة (60 ثانية)
        tokenGracePeriodSeconds: 90,       // مهلة كافية عشان الطالب وهو بيكتب رقمه الرمز ميعلقش معاه
        lateThresholdMinutes: 15,          
        allowManualOverride: true,         
        statuses: {
            PRESENT: "Present",
            LATE: "Late",
            ABSENT: "Absent",
            EXCUSED: "Excused"
        }
    },

    // System Preferences
    preferences: {
        defaultLanguage: "ar",                // اللغة الافتراضية
        defaultTheme: "light",                // النمط الافتراضي
        autoLockSessionAfterHours: 3          // إغلاق المحاضرة تلقائياً بعد 3 ساعات في حال نسيانها
    },
        // الفصل الدراسي الحالي
    semester: {
        name: "الخريف 2026/2027",
        plannedLectures: 14
    },

    // Firebase Configuration
    firebase: {
        apiKey: "AIzaSyCGnV3fa6ztAR5tpeXBmXHSwt3-eG1sqyc",
        authDomain: "muc-attend.firebaseapp.com",
        projectId: "muc-attend",
        storageBucket: "muc-attend.firebasestorage.app",
        messagingSenderId: "330133047470",
        appId: "1:330133047470:web:6ceb94e6ebd9cc11d5453f",
        measurementId: "G-JM1GF1VYK6"
    }
};

export default CONFIG;
