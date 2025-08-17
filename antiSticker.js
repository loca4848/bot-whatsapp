// antiSticker.js - Versión Final Corregida
let stickerCount = {};
let lastStickerTime = {};
let lastWarnTime = {};

// Configuración
const CONFIG = {
    MAX_STICKERS: 2,           // Máximo de stickers permitidos (permite 2, borra el 3ro)
    COOLDOWN_TIME: 15000,      // 15 segundos de cooldown
    WARN_COOLDOWN: 30000       // 30 segundos entre advertencias
};

async function antiSticker(sock, msg) {
    try {
        // Validaciones básicas mejoradas
        if (!msg || !msg.message || !msg.key) return;
        if (msg.key.fromMe) return; // Ignorar mensajes del bot
        if (!msg.key.remoteJid) return;

        const chatId = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const messageType = Object.keys(msg.message)[0];

        // Solo procesar stickers
        if (messageType !== 'stickerMessage') return;

        // Verificar si el sender es administrador (NO aplicar anti-sticker)
        const isAdmin = await checkIfAdmin(sock, chatId, sender);
        if (isAdmin) {
            console.log(`👑 Admin detectado: ${sender.split('@')[0]} - Stickers ilimitados`);
            return;
        }

        const now = Date.now();
        
        // Inicializar si es la primera vez
        if (!stickerCount[sender]) {
            stickerCount[sender] = 0;
            lastStickerTime[sender] = 0;
            lastWarnTime[sender] = 0;
        }

        // Verificar si debe hacer reset (han pasado más de 15 segundos)
        const timeSinceLastSticker = now - lastStickerTime[sender];
        if (timeSinceLastSticker > CONFIG.COOLDOWN_TIME) {
            // Reset: este sticker cuenta como el primero
            stickerCount[sender] = 1;
            lastStickerTime[sender] = now;
            console.log(`🔄 Reset - Primer sticker permitido para ${sender.split('@')[0]}`);
            return; // Este sticker está permitido, salir
        }

        // No ha pasado suficiente tiempo, incrementar contador
        stickerCount[sender]++;
        lastStickerTime[sender] = now;

        console.log(`📊 ${sender.split('@')[0]}: Sticker #${stickerCount[sender]} (límite: ${CONFIG.MAX_STICKERS})`);

        // Verificar si supera el límite
        if (stickerCount[sender] > CONFIG.MAX_STICKERS) {
            console.log(`🚫 Eliminando sticker excedente de ${sender.split('@')[0]}`);
            
            // Eliminar el mensaje
            const deleteSuccess = await deleteMessage(sock, chatId, msg.key);
            
            // Enviar advertencia (solo si no se ha enviado una recientemente)
            const timeSinceLastWarn = now - (lastWarnTime[sender] || 0);
            if (deleteSuccess && timeSinceLastWarn > CONFIG.WARN_COOLDOWN) {
                await sendWarning(sock, chatId, sender);
                lastWarnTime[sender] = now;
            }
        } else {
            console.log(`✅ Sticker #${stickerCount[sender]} permitido para ${sender.split('@')[0]}`);
        }

    } catch (error) {
        console.error('❌ Error en antiSticker:', error.message);
    }
}

// Función para verificar si un usuario es administrador
async function checkIfAdmin(sock, chatId, userId) {
    try {
        // Solo verificar en chats grupales
        if (!chatId || !chatId.includes('@g.us')) {
            return false;
        }
        
        const groupMetadata = await sock.groupMetadata(chatId);
        if (!groupMetadata || !groupMetadata.participants) {
            return false;
        }
        
        const admins = groupMetadata.participants
            .filter(participant => 
                participant.admin === 'admin' || 
                participant.admin === 'superadmin'
            )
            .map(participant => participant.id);
            
        return admins.includes(userId);
    } catch (error) {
        console.error('⚠️ Error al verificar admin:', error.message);
        return false; // Por seguridad, asumir que no es admin
    }
}

// Función auxiliar para eliminar mensajes
async function deleteMessage(sock, chatId, messageKey) {
    try {
        await sock.sendMessage(chatId, { delete: messageKey });
        console.log('✅ Sticker eliminado correctamente');
        return true;
    } catch (error) {
        console.error('❌ Error al eliminar sticker:', error.message);
        
        // Diagnóstico de errores comunes
        if (error.message.includes('forbidden')) {
            console.error('⚠️ Error: El bot no tiene permisos para eliminar mensajes');
        } else if (error.message.includes('not found')) {
            console.error('⚠️ Error: Mensaje no encontrado (tal vez ya fue eliminado)');
        } else if (error.message.includes('admin')) {
            console.error('⚠️ Error: El bot necesita ser administrador del grupo');
        }
        
        return false;
    }
}

// Función auxiliar para enviar advertencias
async function sendWarning(sock, chatId, sender) {
    try {
        const warningMessages = [
            `🚫 @${sender.split('@')[0]} máximo 2 stickers 🚫`,
            `⚠️ @${sender.split('@')[0]} límite alcanzado espera un poco ⚠️`,
            `🛑 @${sender.split('@')[0]} demasiados stickers! Pausa 15 segundos 🛑`
        ];
        
        const randomMessage = warningMessages[Math.floor(Math.random() * warningMessages.length)];
        
        await sock.sendMessage(chatId, {
            text: randomMessage,
            mentions: [sender]
        });
        
        console.log(`⚠️ Advertencia enviada a ${sender.split('@')[0]}`);
        return true;
    } catch (error) {
        console.error('❌ Error al enviar advertencia:', error.message);
        return false;
    }
}

// Función para limpiar datos antiguos (evitar acumulación de memoria)
function cleanupOldData() {
    const now = Date.now();
    const CLEANUP_TIME = 600000; // 10 minutos
    
    let cleanedCount = 0;
    Object.keys(lastStickerTime).forEach(sender => {
        if (now - lastStickerTime[sender] > CLEANUP_TIME) {
            delete stickerCount[sender];
            delete lastStickerTime[sender];
            delete lastWarnTime[sender];
            cleanedCount++;
        }
    });
    
    if (cleanedCount > 0) {
        console.log(`🧹 Limpieza completada: ${cleanedCount} usuarios limpiados`);
    }
}

// Limpiar datos cada 10 minutos
setInterval(cleanupOldData, 600000);

// Función para obtener estadísticas de uso
function getStats() {
    const activeUsers = Object.keys(stickerCount).length;
    const totalStickers = Object.values(stickerCount).reduce((total, count) => total + count, 0);
    
    return {
        activeUsers,
        totalStickers,
        config: CONFIG,
        memoryUsage: {
            stickerCount: Object.keys(stickerCount).length,
            lastStickerTime: Object.keys(lastStickerTime).length,
            lastWarnTime: Object.keys(lastWarnTime).length
        }
    };
}

// Función para resetear manualmente un usuario (útil para testing)
function resetUser(userId) {
    delete stickerCount[userId];
    delete lastStickerTime[userId];
    delete lastWarnTime[userId];
    console.log(`🔄 Usuario ${userId.split('@')[0]} reseteado manualmente`);
}

module.exports = {
    antiSticker,
    getStats,
    cleanupOldData,
    checkIfAdmin,
    resetUser
};