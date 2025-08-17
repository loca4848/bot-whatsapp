// antiSticker.js
let stickerCount = {}
let lastWarnTime = {} // guarda la última vez que se mandó la advertencia

async function antiSticker(sock, msg) {
    if (!msg.message || msg.key.fromMe) return

    const chatId = msg.key.remoteJid
    const sender = msg.key.participant || msg.key.remoteJid // en grupo = user, en privado = chat
    const messageType = Object.keys(msg.message)[0]

    if (messageType === 'stickerMessage') {
        if (!stickerCount[sender]) {
            stickerCount[sender] = 1
        } else {
            stickerCount[sender] += 1
        }

        console.log(`📌 Sticker de ${sender} en ${chatId} → total: ${stickerCount[sender]}`)

        if (stickerCount[sender] >= 2) {
            try {
                // 🔥 Eliminar el mensaje
                await sock.sendMessage(chatId, {
                    delete: {
                        remoteJid: chatId,
                        fromMe: false,
                        id: msg.key.id,
                        participant: msg.key.participant
                    }
                })

                const now = Date.now()

                // 📢 Si es la primera vez que pasa el límite → AVISO INMEDIATO
                if (!lastWarnTime[sender]) {
                    await sock.sendMessage(chatId, { 
                        text: ` @${sender.split('@')[0]} deja de spamear stickers 🚫`, 
                        mentions: [sender] 
                    })
                    lastWarnTime[sender] = now
                }
                // 📢 Si sigue mandando → solo cada 30 segundos
                else if (now - lastWarnTime[sender] > 30000) {
                    await sock.sendMessage(chatId, { 
                        text: `⚠️ @${sender.split('@')[0]} ya te dije, no spamees⚠️`, 
                        mentions: [sender] 
                    })
                    lastWarnTime[sender] = now
                }

            } catch (e) {
                console.error('❌ Error al borrar sticker:', e)
            }
        }
    }
}

module.exports = antiSticker
