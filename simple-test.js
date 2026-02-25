const https = require('https');

const token = "8230758106:AAFSwD8bgyZZfSWh3xoSeoZW4-7k3LTVEv4";
const chatId = "8079426010";

const data = JSON.stringify({
    chat_id: chatId,
    text: '🔔 اختبار نهائي: إذا رأيت هذه الرسالة فالبوت والتوكن يعملان 100%.'
});

const options = {
    hostname: 'api.telegram.org',
    port: 443,
    path: `/bot${token}/sendMessage`,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
    }
};

const req = https.request(options, (res) => {
    let responseData = '';
    res.on('data', (d) => { responseData += d; });
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Response:', responseData);
    });
});

req.on('error', (e) => {
    console.error('Error:', e);
});

req.write(data);
req.end();
