const https = require('https');
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

console.log('Token:', token);
console.log('Chat ID:', chatId);

const data = JSON.stringify({
    chat_id: chatId,
    text: '🔔 اختبار من السكريبت المحلي: إذا وصلت هذه الرسالة فالبيانات صحيحة.'
});

const options = {
    hostname: 'api.telegram.org',
    port: 4443, // Using 443
    path: `/bot${token}/sendMessage`,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = https.request({ ...options, port: 443 }, (res) => {
    let responseData = '';
    res.on('data', (d) => { responseData += d; });
    res.on('end', () => {
        console.log('Response:', responseData);
    });
});

req.on('error', (e) => {
    console.error('Error:', e);
});

req.write(data);
req.end();
