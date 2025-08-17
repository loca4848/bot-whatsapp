// autoChat.js
const schedule = require("node-schedule")

function autoChat(sock, groupId) {
    // ⏰ Programar ENCENDIDO del grupo todos los días a la 1:00 PM (hora Lima)
    schedule.scheduleJob({ hour: 13, minute: 0, tz: "America/Lima" }, async () => {
        try {
            await sock.groupSettingUpdate(groupId, "not_announcement") // 🔓 Abrir chat
            await sock.sendMessage(groupId, { text: "🔥 El chat está *prendido* 🔥" })
            console.log("✅ Chat abierto automáticamente (13:00 Lima)")
        } catch (e) {
            console.error("❌ Error al abrir chat:", e)
        }
    })

    // ⏰ Programar APAGADO del grupo todos los días a las 12:30 AM (hora Lima)
    schedule.scheduleJob({ hour: 0, minute: 30, tz: "America/Lima" }, async () => {
        try {
            await sock.groupSettingUpdate(groupId, "announcement") // 🔒 Cerrar chat
            await sock.sendMessage(groupId, { text: "🌙 El chat está *apagado* 🌙" })
            console.log("❌ Chat cerrado automáticamente (00:30 Lima)")
        } catch (e) {
            console.error("❌ Error al cerrar chat:", e)
        }
    })
}

module.exports = autoChat
