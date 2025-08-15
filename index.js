const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcodeTerminal = require('qrcode-terminal');
const qrcode = require('qrcode');
const express = require('express');
const axios = require('axios');
const xml2js = require('xml2js');
const schedule = require('node-schedule'); // para horarios automáticos

const app = express();
const PORT = process.env.PORT || 3000; // Railway asigna automáticamente el puerto
let qrCodeData = ''; // Guardamos el QR para la página

// Servir QR en la ruta /qr
app.get('/qr', (req, res) => {
    if (!qrCodeData) return res.send('QR aún no generado...');
    res.send(`
        <h1>Escanea el QR para WhatsApp</h1>
        <img src="${qrCodeData}" />
    `);
});

// Redirigir la raíz / al QR automáticamente
app.get('/', (req, res) => {
    res.redirect('/qr');
});

app.listen(PORT, () => console.log(`🔗 QR listo en web: https://bot-whatsapp.up.railway.app/qr`));

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

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth');
    const sock = makeWASocket({ auth: state, printQRInTerminal: false }); // terminal QR manejado manualmente

    // --- Conexión y QR ---
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            // Mostrar QR en terminal
            qrcodeTerminal.generate(qr, { small: true });

            // Generar QR como Data URL para web
            qrCodeData = await qrcode.toDataURL(qr);
            console.log(`🔗 QR listo en web: https://bot-whatsapp.up.railway.app/qr`);
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = reason !== DisconnectReason.loggedOut;
            console.log("⚠ Conexión cerrada. Reconectando...");
            if (shouldReconnect) startBot();
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // --- Bienvenida ---
    sock.ev.on('group-participants.update', async (m) => {
        try {
            if (m.action === 'add') {
                const user = m.participants[0];
                const info = await sock.onWhatsApp(user);
                const nombre = info?.[0]?.notify || user.split('@')[0];
                await sock.sendMessage(m.id, { text: `😈 Mi terriblee ${nombre}, te estábamos esperandooo... ¡la locura! 😈` });
                await sock.sendMessage(m.id, { text: reglas });
            }
        } catch (e) {
            console.error("Error en bienvenida:", e);
        }
    });

    // --- Mensajes ---
    let grupoActual = ''; // Guardar el ID del grupo actual

    sock.ev.on('messages.upsert', async (msg) => {
        try {
            const m = msg.messages[0];
            if (!m.message || m.key.fromMe) return;

            const from = m.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const type = Object.keys(m.message)[0];
            const text = (type === 'conversation' ? m.message.conversation : m.message?.extendedTextMessage?.text || '').trim();
            const sender = m.key.participant || m.key.remoteJid;

            // Guardamos el grupo actual para horarios
            if (isGroup && !grupoActual) grupoActual = from;

            // Anti-links
            if (isGroup && text.match(/https?:\/\/\S+/gi)) {
                const metadata = await sock.groupMetadata(from);
                const isAdmin = metadata.participants.find(p => p.id === sender && p.admin);
                if (!isAdmin) {
                    await sock.sendMessage(from, { delete: m.key });
                    await sock.sendMessage(from, { text: "🚫 Spam" });
                    return;
                }
            }

            // Anti-stickers (>2)
            if (type === 'sticker') {
                const count = stickerSpamTracker[sender] || 0;
                stickerSpamTracker[sender] = count + 1;

                if (stickerSpamTracker[sender] > 2) {
                    await sock.sendMessage(from, { delete: m.key });
                    await sock.sendMessage(from, { text: "🚫 No se pueden enviar más de 2 stickers seguidos" });
                    stickerSpamTracker[sender] = 0;
                }

                setTimeout(() => stickerSpamTracker[sender] = 0, 10000);
            }

            // Comandos
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

                    const mensaje = `
🔥 ¡Nuevo Video Disponible! 🔥
🎯 ${titulo}
📅 Publicado: ${fecha}

📝 Descripción:
${descripcion}

📺 Míralo aquí: ${link}
                    `.trim();

                    await sock.sendMessage(from, { image: { url: thumbnail }, caption: mensaje });
                } catch (error) {
                    console.error(error);
                    await sock.sendMessage(from, { text: '❌ No se pudo obtener el último video de tu canal.' });
                }
            }

            // #bam (solo admins)
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

    // --- HORARIOS AUTOMÁTICOS ---
    // Activar chat a las 13:00
    schedule.scheduleJob('0 13 * * *', async () => {
        if (!grupoActual) return;
        try {
            await sock.groupSettingUpdate(grupoActual, 'not_announcement'); // permite mensajes de todos
            console.log('💬 Chat activado a las 13:00');
        } catch (err) {
            console.error('Error al activar chat:', err);
        }
    });

    // Desactivar chat a las 00:30
    schedule.scheduleJob('30 0 * * *', async () => {
        if (!grupoActual) return;
        try {
            await sock.groupSettingUpdate(grupoActual, 'announcement'); // solo admins
            console.log('🔒 Chat desactivado a las 00:30');
        } catch (err) {
            console.error('Error al desactivar chat:', err);
        }
    });

}

startBot(); // llamada para iniciar el bot
