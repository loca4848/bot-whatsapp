const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode'); // Para guardar QR como imagen
const axios = require('axios');
const xml2js = require('xml2js');

const reglas = `..…🎮REGLAS DEL GRUPO 🎮….

✅ Respeto ante todo.  
✅ Sé activo y aporta. 
❓ ¿Dudas? Pregunta, aquí nos ayudamos.  
🚫 No spam ni stickers molestos.  
🚫 Links solo por privado.  
🚫 Nada de gore ni nopor.
📸 Mandar fotos o videos para UNA VEZ.

❌ Romper reglas = ELIMINACIÓN automáticamatica.

🚀Disfruta del grupo terriblee🚀`;

const canalYT = "https://www.youtube.com/@The.FrancoX";
const canalID = "UCV46Pdse-OZH5WmqYHs2r-w";
const feedURL = `https://www.youtube.com/feeds/videos.xml?channel_id=${canalID}`;

let stickerSpamTracker = {};

// --- INICIO: Servidor Express para UptimeRobot ---
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot activo 🚀');
});

app.listen(port, () => {
    console.log(`Servidor escuchando en el puerto ${port}`);
});
// --- FIN: Servidor Express ---

// --- Configuración de horario ---
const HORA_INICIO = 13;  // 1 PM
const MINUTO_INICIO = 0;

const HORA_FIN = 0;      // 12 AM
const MINUTO_FIN = 30;

function dentroDelHorario() {
    const ahora = new Date();
    const hora = ahora.getHours();
    const minuto = ahora.getMinutes();

    // Maneja horario que cruza medianoche
    if ((hora > HORA_INICIO || (hora === HORA_INICIO && minuto >= MINUTO_INICIO)) || 
        (hora < HORA_FIN || (hora === HORA_FIN && minuto < MINUTO_FIN))) {
        return true;
    }
    return false;
}

// --- Función principal del bot ---
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth');
    const sock = makeWASocket({ auth: state, printQRInTerminal: false });

    // Mostrar QR en consola + guardar + link online
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            qrcode.generate(qr, { small: true });
            await QRCode.toFile('qr.png', qr);
            console.log("✅ QR guardado como qr.png");

            // --- Link online para escanear el QR ---
            const qrLink = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`;
            console.log("🌐 Abre este link en otra pestaña para escanear el QR:");
            console.log(qrLink);
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = reason !== DisconnectReason.loggedOut;
            console.log("⚠ Conexión cerrada. Reconectando...");
            if (shouldReconnect) startBot();
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Bienvenida
    sock.ev.on('group-participants.update', async (m) => {
        if (!dentroDelHorario()) return;
        try {
            if (m.action === 'add') {
                const user = m.participants[0];
                const info = await sock.onWhatsApp(user);
                const nombre = info?.[0]?.notify || user.split('@')[0];
                await sock.sendMessage(m.id, { text: `Mi terriblee ${nombre}, te estábamos esperando.. 😈¡Para la locura!😈` });
                await sock.sendMessage(m.id, { text: reglas });
            }
        } catch (e) {
            console.error("Error en bienvenida:", e);
        }
    });

    // Mensajes
    sock.ev.on('messages.upsert', async (msg) => {
        if (!dentroDelHorario()) return;
        try {
            const m = msg.messages[0];
            if (!m.message || m.key.fromMe) return;

            const from = m.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const type = Object.keys(m.message)[0];
            const sender = m.key.participant || m.key.remoteJid;

            // Anti-spam stickers
            if (isGroup && type === 'stickerMessage') {
                const now = Date.now();
                if (!stickerSpamTracker[sender]) {
                    stickerSpamTracker[sender] = { count: 1, lastTime: now };
                } else {
                    const timeDiff = now - stickerSpamTracker[sender].lastTime;
                    stickerSpamTracker[sender].lastTime = now;

                    if (timeDiff < 5000) {
                        stickerSpamTracker[sender].count++;
                    } else {
                        stickerSpamTracker[sender].count = 1;
                    }

                    if (stickerSpamTracker[sender].count > 2) {
                        await sock.sendMessage(from, { delete: m.key });
                        await sock.sendMessage(from, { text: "🚫Spam de stickers detectado🚫" });
                        return;
                    }
                }
            }

            const text = (type === 'conversation' ? m.message.conversation : m.message?.extendedTextMessage?.text || '').trim();

            // Anti-links
            if (isGroup && text.match(/https?:\/\/\S+/gi)) {
                const metadata = await sock.groupMetadata(from);
                const isAdmin = metadata.participants.find(p => p.id === sender && p.admin);
                if (!isAdmin) {
                    await sock.sendMessage(from, { delete: m.key });
                    await sock.sendMessage(from, { text: "🚫Este link fue eliminado por incumplir las reglas.🚫" });
                    return;
                }
            }

            if (text === '#reglas') await sock.sendMessage(from, { text: reglas });
            if (text === '#canal') await sock.sendMessage(from, { text: `📺 Mi terriblee, ¿ya fuiste a ver mi canal de YouTube? ¡SUSCRÍBETE!\n👉 ${canalYT}` });

            if (text === '#video') {
                await sock.sendMessage(from, { text: '🔍 Buscando tu último video en YouTube...' });
                try {
                    const { data } = await axios.get(feedURL);
                    const parsed = await xml2js.parseStringPromise(data);
                    const ultimoVideo = parsed.feed.entry[0];
                    const titulo = ultimoVideo.title[0];
                    const link = ultimoVideo.link[0].$.href;
                    const descripcion = ultimoVideo['media:group'][0]['media:description'][0];
                    const thumbnail = ultimoVideo['media:group'][0]['media:thumbnail'][0].$.url;
                    const fecha = new Date(ultimoVideo.published[0]).toLocaleDateString('es-PE');

                    const mensaje = `🔥 ¡Nuevo Video Disponible! 🔥
🎯 ${titulo}
📅 Publicado: ${fecha}

📝 Descripción:
${descripcion}

📺 Míralo aquí: ${link}`.trim();

                    await sock.sendMessage(from, { image: { url: thumbnail }, caption: mensaje });

                } catch (error) {
                    console.error(error);
                    await sock.sendMessage(from, { text: '❌ No se pudo obtener el último video de tu canal.' });
                }
            }

            if (text === '#bam' && isGroup) {
                const metadata = await sock.groupMetadata(from);
                const isAdmin = metadata.participants.find(p => p.id === sender && p.admin);
                if (!isAdmin) return;

                if (m.message?.extendedTextMessage?.contextInfo?.participant) {
                    const target = m.message.extendedTextMessage.contextInfo.participant;
                    await sock.groupParticipantsUpdate(from, [target], 'remove');
                    await sock.sendMessage(from, {
                        text: `🚫 Usuario @${target.split('@')[0]} baneado por incumplir las reglas.`,
                        mentions: [target]
                    });
                }
            }
        } catch (err) {
            console.error("Error procesando mensaje:", err);
        }
    });
}

// --- Iniciar bot ---
startBot();
