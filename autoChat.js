// autoChat.js - Versión Mejorada
const schedule = require("node-schedule");

let sock = null;
let currentGroupId = null;
let jobs = {}; // Para mantener referencia de los trabajos programados

function autoChat(sockInstance, groupId) {
    try {
        // Actualizar referencias globales
        sock = sockInstance;
        
        // Validar que tenemos un grupo válido
        if (!groupId || !groupId.includes('@g.us')) {
            console.log('⚠️ AutoChat: Esperando grupo válido...');
            return;
        }
        
        // Si ya hay trabajos programados para otro grupo, cancelarlos
        if (currentGroupId && currentGroupId !== groupId) {
            cancelJobs();
            console.log(`🔄 AutoChat: Cambiando de grupo ${currentGroupId} a ${groupId}`);
        }
        
        currentGroupId = groupId;
        
        // Cancelar trabajos existentes para este grupo (evitar duplicados)
        cancelJobs();
        
        // ⏰ ENCENDIDO del grupo todos los días a la 1:00 PM (hora Lima)
        jobs.openJob = schedule.scheduleJob('open-chat', { hour: 13, minute: 0, tz: "America/Lima" }, async () => {
            await openChat();
        });
        
        // ⏰ APAGADO del grupo todos los días a las 12:30 AM (hora Lima)  
        jobs.closeJob = schedule.scheduleJob('close-chat', { hour: 0, minute: 30, tz: "America/Lima" }, async () => {
            await closeChat();
        });
        
        console.log(`✅ AutoChat configurado para grupo: ${groupId.split('@')[0]}`);
        console.log('📅 Horarios programados:');
        console.log('   🔓 Abrir chat: 13:00 (Lima)');
        console.log('   🔒 Cerrar chat: 00:30 (Lima)');
        
    } catch (error) {
        console.error('❌ Error configurando autoChat:', error);
    }
}

// Función para abrir el chat
async function openChat() {
    try {
        if (!sock || !currentGroupId) {
            console.error('❌ AutoChat: No hay conexión o grupo configurado');
            return;
        }
        
        // Verificar que el grupo aún existe
        const groupExists = await checkGroupExists();
        if (!groupExists) return;
        
        // Abrir chat (quitar restricciones)
        await sock.groupSettingUpdate(currentGroupId, "not_announcement");
        
        // Enviar mensaje de confirmación
        await sock.sendMessage(currentGroupId, { 
            text: "🔥 Chat prendido 🔥" 
        });
        
        console.log(`✅ Chat abierto automáticamente (13:00 Lima) - Grupo: ${currentGroupId.split('@')[0]}`);
        
    } catch (error) {
        console.error("❌ Error al abrir chat automáticamente:", error.message);
        
        // Reintentar en 5 minutos si falla
        setTimeout(() => {
            console.log('🔄 Reintentando abrir chat...');
            openChat();
        }, 300000); // 5 minutos
    }
}

// Función para cerrar el chat
async function closeChat() {
    try {
        if (!sock || !currentGroupId) {
            console.error('❌ AutoChat: No hay conexión o grupo configurado');
            return;
        }
        
        // Verificar que el grupo aún existe
        const groupExists = await checkGroupExists();
        if (!groupExists) return;
        
        // Cerrar chat (solo admins pueden escribir)
        await sock.groupSettingUpdate(currentGroupId, "announcement");
        
        // Enviar mensaje de confirmación
        await sock.sendMessage(currentGroupId, { 
            text: "🌙 Chat apagado 🌙" 
        });
        
        console.log(`❌ Chat cerrado automáticamente (00:30 Lima) - Grupo: ${currentGroupId.split('@')[0]}`);
        
    } catch (error) {
        console.error("❌ Error al cerrar chat automáticamente:", error.message);
        
        // Reintentar en 5 minutos si falla
        setTimeout(() => {
            console.log('🔄 Reintentando cerrar chat...');
            closeChat();
        }, 300000); // 5 minutos
    }
}

// Verificar si el grupo aún existe
async function checkGroupExists() {
    try {
        await sock.groupMetadata(currentGroupId);
        return true;
    } catch (error) {
        console.error(`❌ El grupo ${currentGroupId.split('@')[0]} ya no existe o no tengo acceso`);
        cancelJobs();
        return false;
    }
}

// Cancelar trabajos programados
function cancelJobs() {
    Object.values(jobs).forEach(job => {
        if (job) {
            job.cancel();
        }
    });
    jobs = {};
    console.log('🗑️ Trabajos de AutoChat cancelados');
}

// Función para obtener el estado actual
function getStatus() {
    return {
        isConfigured: !!currentGroupId,
        groupId: currentGroupId,
        jobs: {
            openJob: jobs.openJob ? 'Programado' : 'No programado',
            closeJob: jobs.closeJob ? 'Programado' : 'No programado'
        },
        nextRun: {
            open: jobs.openJob ? jobs.openJob.nextInvocation() : null,
            close: jobs.closeJob ? jobs.closeJob.nextInvocation() : null
        }
    };
}

// Funciones manuales (para comandos de admin)
async function manualOpen() {
    await openChat();
}

async function manualClose() {
    await closeChat();
}

// Función para cambiar horarios (opcional)
function updateSchedule(openHour = 13, openMinute = 0, closeHour = 0, closeMinute = 30) {
    if (!currentGroupId) {
        console.error('❌ No hay grupo configurado para actualizar horarios');
        return false;
    }
    
    try {
        // Cancelar trabajos existentes
        cancelJobs();
        
        // Crear nuevos trabajos con los nuevos horarios
        jobs.openJob = schedule.scheduleJob('open-chat-custom', 
            { hour: openHour, minute: openMinute, tz: "America/Lima" }, 
            async () => await openChat()
        );
        
        jobs.closeJob = schedule.scheduleJob('close-chat-custom', 
            { hour: closeHour, minute: closeMinute, tz: "America/Lima" }, 
            async () => await closeChat()
        );
        
        console.log(`✅ Horarios actualizados:`);
        console.log(`   🔓 Abrir: ${openHour.toString().padStart(2, '0')}:${openMinute.toString().padStart(2, '0')}`);
        console.log(`   🔒 Cerrar: ${closeHour.toString().padStart(2, '0')}:${closeMinute.toString().padStart(2, '0')}`);
        
        return true;
    } catch (error) {
        console.error('❌ Error actualizando horarios:', error);
        return false;
    }
}

module.exports = {
    autoChat,
    getStatus,
    manualOpen,
    manualClose,
    updateSchedule,
    cancelJobs
};