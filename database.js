// ==========================================
// DATABASE.JS - Conexión con Supabase
// REG Marketing S.A.S - Sistema de Producción
// ==========================================

const SUPABASE_URL = 'https://qyzmijeachrzzpitfdxf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5em1pamVhY2hyenpwaXRmZHhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNzg4NDgsImV4cCI6MjA4Njk1NDg0OH0.01PQASOkdzqUP3kyf5h0SlWoIatN7hmW_PtVueIPsiE';

// Importar Supabase desde CDN
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// FUNCIONES PARA ÓRDENES
// ==========================================

/**
 * Obtener todas las órdenes activas
 */
async function obtenerOrdenes() {
    try {
        const { data, error } = await supabaseClient
            .from('ordenes')
            .select('*')
            .eq('estado_general', 'activa')
            .order('fecha_creacion', { ascending: false });
        
        if (error) throw error;
        
        // Convertir formato de base de datos a formato del sistema
        return data.map(convertirOrdenDesdeBD);
    } catch (error) {
        console.error('Error al obtener órdenes:', error);
        return [];
    }
}

/**
 * Crear nueva orden
 */
async function crearOrden(orden) {
    try {
        const ordenBD = convertirOrdenParaBD(orden);
        
        const { data, error } = await supabaseClient
            .from('ordenes')
            .insert([ordenBD])
            .select();
        
        if (error) throw error;
        
        console.log('✅ Orden creada en Supabase:', data[0].numero_orden);
        return { success: true, data: data[0] };
    } catch (error) {
        console.error('❌ Error al crear orden:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Actualizar orden existente
 */
async function actualizarOrden(numeroOrden, cambios) {
    try {
        const { data, error } = await supabaseClient
            .from('ordenes')
            .update(cambios)
            .eq('numero_orden', numeroOrden)
            .select();
        
        if (error) throw error;
        
        console.log('✅ Orden actualizada:', numeroOrden);
        return { success: true, data: data[0] };
    } catch (error) {
        console.error('❌ Error al actualizar orden:', error);
        return { success: false, error: error.message };
    }
}


/**
 * Actualizar estado de un área específica
 */
async function actualizarEstadoArea(numeroOrden, area, nuevoEstado) {
    try {
        const cambios = {};
        cambios[`estado_${area}`] = nuevoEstado;
        
        return await actualizarOrden(numeroOrden, cambios);
    } catch (error) {
        console.error('❌ Error al actualizar estado:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Actualizar progreso de un área (por talla)
 */
async function actualizarProgresoArea(numeroOrden, area, progreso) {
    try {
        const cambios = {};
        cambios[`progreso_${area}`] = progreso;
        
        return await actualizarOrden(numeroOrden, cambios);
    } catch (error) {
        console.error('❌ Error al actualizar progreso:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Eliminar orden
 */
async function eliminarOrden(numeroOrden) {
    try {
        const { error } = await supabaseClient
            .from('ordenes')
            .delete()
            .eq('numero_orden', numeroOrden);
        
        if (error) throw error;
        
        console.log('✅ Orden eliminada:', numeroOrden);
        return { success: true };
    } catch (error) {
        console.error('❌ Error al eliminar orden:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Mover orden al historial
 */
async function moverAHistorial(orden) {
    try {
        // 1. Guardar en historial
        const totalPrendas = Object.values(orden.tallas).reduce((sum, val) => sum + val, 0);
        
        const { error: errorHistorial } = await supabaseClient
            .from('historial_ordenes')
            .insert([{
                numero_orden: orden.numeroOrden,
                cliente: orden.cliente,
                tipo_prenda: orden.tipoPrenda,
                total_prendas: totalPrendas,
                fecha_pedido: orden.fechaPedido,
                fecha_entrega: orden.fechaEntrega,
                fecha_completado: new Date().toISOString(),
                datos_completos: orden
            }]);
        
        if (errorHistorial) throw errorHistorial;
        
        // 2. Actualizar estado en órdenes
        const { error: errorUpdate } = await supabaseClient
            .from('ordenes')
            .update({
                estado_general: 'completada',
                fecha_completado: new Date().toISOString()
            })
            .eq('numero_orden', orden.numeroOrden);
        
        if (errorUpdate) throw errorUpdate;
        
        console.log('✅ Orden movida al historial:', orden.numeroOrden);
        return { success: true };
    } catch (error) {
        console.error('❌ Error al mover al historial:', error);
        return { success: false, error: error.message };
    }
    
}

/**
 * Obtener historial de órdenes
 */
async function obtenerHistorial() {
    try {
        const { data, error } = await supabaseClient
            .from('historial_ordenes')
            .select('*')
            .order('fecha_completado', { ascending: false });
        
        if (error) throw error;
        
        return data;
    } catch (error) {
        console.error('Error al obtener historial:', error);
        return [];
    }
}

// ==========================================
// FUNCIONES DE CONVERSIÓN
// ==========================================

/**
 * Convertir orden del formato del sistema al formato de BD
 */
function convertirOrdenParaBD(orden) {
    return {
        numero_orden: orden.numeroOrden,
        cliente: orden.cliente,
        fecha_pedido: orden.fechaPedido,
        fecha_entrega: orden.fechaEntrega,
        arte: orden.arte,
        impresora: orden.impresora,
        tipo_prenda: orden.tipoPrenda,
        tela: orden.tela,
        cuello: orden.cuello,
        color_cuello: orden.colorCuello,
        marquilla: orden.marquilla,
        observaciones: orden.observaciones,
        imagen_diseno: orden.imagenDiseno,
        
        // Tallas
        talla_8: orden.tallas['8'] || 0,
        talla_12: orden.tallas['12'] || 0,
        talla_16: orden.tallas['16'] || 0,
        talla_xs: orden.tallas['XS'] || 0,
        talla_s: orden.tallas['S'] || 0,
        talla_m: orden.tallas['M'] || 0,
        talla_l: orden.tallas['L'] || 0,
        talla_xl: orden.tallas['XL'] || 0,
        talla_2xl: orden.tallas['2XL'] || 0,
        talla_3xl: orden.tallas['3XL'] || 0,
        
        // Estados
        estado_corte: orden.estado?.corte || 'pendiente',
        estado_confeccion: orden.estado?.confeccion || 'pendiente',
        estado_impresion: orden.estado?.impresion || 'pendiente',
        estado_sublimacion: orden.estado?.sublimacion || 'pendiente',
        estado_despacho: orden.estado?.despacho || 'pendiente',
        
        // Progreso
        progreso_corte: orden.progreso_corte || {},
        progreso_confeccion: orden.progreso_confeccion || {},
        progreso_impresion: orden.progreso_impresion || {},
        progreso_sublimacion: orden.progreso_sublimacion || {},
        progreso_despacho: orden.progreso_despacho || {}
    };
}

/**
 * Convertir orden del formato de BD al formato del sistema
 */
function convertirOrdenDesdeBD(ordenBD) {
    return {
        numeroOrden: ordenBD.numero_orden,
        cliente: ordenBD.cliente,
        fechaPedido: ordenBD.fecha_pedido,
        fechaEntrega: ordenBD.fecha_entrega,
        arte: ordenBD.arte,
        impresora: ordenBD.impresora,
        tipoPrenda: ordenBD.tipo_prenda,
        tela: ordenBD.tela,
        cuello: ordenBD.cuello,
        colorCuello: ordenBD.color_cuello,
        marquilla: ordenBD.marquilla,
        observaciones: ordenBD.observaciones,
        imagenDiseno: ordenBD.imagen_diseno,
        
        // Tallas
        tallas: {
            '8': ordenBD.talla_8 || 0,
            '12': ordenBD.talla_12 || 0,
            '16': ordenBD.talla_16 || 0,
            'XS': ordenBD.talla_xs || 0,
            'S': ordenBD.talla_s || 0,
            'M': ordenBD.talla_m || 0,
            'L': ordenBD.talla_l || 0,
            'XL': ordenBD.talla_xl || 0,
            '2XL': ordenBD.talla_2xl || 0,
            '3XL': ordenBD.talla_3xl || 0
        },
        
        // Estados
        estado: {
            corte: ordenBD.estado_corte,
            confeccion: ordenBD.estado_confeccion,
            impresion: ordenBD.estado_impresion,
            sublimacion: ordenBD.estado_sublimacion,
            despacho: ordenBD.estado_despacho
        },
        
        // Progreso
        progreso_corte: ordenBD.progreso_corte || {},
        progreso_confeccion: ordenBD.progreso_confeccion || {},
        progreso_impresion: ordenBD.progreso_impresion || {},
        progreso_sublimacion: ordenBD.progreso_sublimacion || {},
        progreso_despacho: ordenBD.progreso_despacho || {}
    };
}

// ==========================================
// SINCRONIZACIÓN CON LOCALSTORAGE
// ==========================================

/**
 * Sincronizar datos locales con Supabase
 */
async function sincronizarConSupabase() {
    try {
        console.log('🔄 Sincronizando con Supabase...');
        
        // 1. Obtener órdenes de Supabase
        const ordenesSupabase = await obtenerOrdenes();
        
        // 2. Obtener órdenes locales
        const ordenesLocales = JSON.parse(localStorage.getItem('ordenes') || '[]');
        
        // 3. Si hay órdenes locales que no están en Supabase, subirlas
        for (const ordenLocal of ordenesLocales) {
            const existeEnSupabase = ordenesSupabase.find(o => o.numeroOrden === ordenLocal.numeroOrden);
            
            if (!existeEnSupabase) {
                console.log('📤 Subiendo orden local a Supabase:', ordenLocal.numeroOrden);
                await crearOrden(ordenLocal);
            }
        }
        
        // 4. Actualizar localStorage con datos de Supabase
        const ordenesActualizadas = await obtenerOrdenes();
        localStorage.setItem('ordenes', JSON.stringify(ordenesActualizadas));
        
        console.log('✅ Sincronización completada');
        return { success: true, total: ordenesActualizadas.length };
    } catch (error) {
        console.error('❌ Error en sincronización:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Modo offline: guardar en localStorage como respaldo
 */
function guardarRespaldoLocal(key, data) {
    try {
        localStorage.setItem(`backup_${key}`, JSON.stringify(data));
    } catch (error) {
        console.error('Error al guardar respaldo local:', error);
    }
}

// ==========================================
// VERIFICACIÓN DE CONEXIÓN
// ==========================================

/**
 * Verificar si hay conexión con Supabase
 */
async function verificarConexion() {
    try {
        const { data, error } = await supabaseClient
            .from('ordenes')
            .select('id')
            .limit(1);
        
        if (error) throw error;
        
        console.log('✅ Conexión con Supabase: OK');
        return true;
    } catch (error) {
        console.error('❌ Error de conexión con Supabase:', error);
        return false;
    }
}

// ==========================================
// INICIALIZACIÓN
// ==========================================

// Verificar conexión al cargar
window.addEventListener('load', async () => {
    const conectado = await verificarConexion();
    
    if (conectado) {
        console.log('🌐 Sistema conectado a Supabase');
        // Sincronizar automáticamente
        await sincronizarConSupabase();
    } else {
        console.warn('⚠️ Modo offline - usando localStorage');
    }
});
// ==========================================
// LIMPIAR HISTORIAL
// ==========================================

/**
 * Limpiar todo el historial de órdenes
 */
async function limpiarHistorial() {
    try {
        const { error } = await supabaseClient
            .from('historial_ordenes')
            .delete()
            .gte('id', 0); // Eliminar todos los registros
        
        if (error) throw error;
        
        console.log('✅ Historial limpiado en Supabase');
        return { success: true };
    } catch (error) {
        console.error('❌ Error al limpiar historial:', error);
        return { success: false, error: error.message };
    }
}
// ==========================================
// EXPORTAR FUNCIONES
// ==========================================

// Para usar en otros archivos:
window.DB = {
    // Órdenes
    obtenerOrdenes,
    crearOrden,
    actualizarOrden,
    eliminarOrden,
    actualizarEstadoArea,
    actualizarProgresoArea,
    
    // Historial
    moverAHistorial,
    obtenerHistorial,
    limpiarHistorial,  // ← AGREGAR ESTA LÍNEA
    
    // Utilidades
    sincronizarConSupabase,
    verificarConexion,
    guardarRespaldoLocal
};



console.log('✅ Database.js cargado correctamente');
