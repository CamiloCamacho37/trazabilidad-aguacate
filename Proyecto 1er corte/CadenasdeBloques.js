const SHA256 = CryptoJS.SHA256;

const STORAGE_KEY = "aguacate_blockchain_v1";

class Block {
    constructor(index, data, previoHash = "", createdAtISO = null) {
        this.index = index;
        this.createdAt = createdAtISO || new Date().toISOString();
        this.data = data;
        this.previoHash = previoHash;
        this.hash = this.createHash();
    }

    createHash() {
        return SHA256(
            String(this.index) +
            String(this.createdAt) +
            String(this.previoHash) +
            JSON.stringify(this.data)
        ).toString();
    }
}

class BlockChain {
    constructor(genesisData) {
        const loaded = this.load();
        if (loaded) {
            this.chain = loaded;
        } else {
            this.chain = [this.createFirstBlock(genesisData)];
            this.save();
        }
    }

    createFirstBlock(genesisData) {
        return new Block(0, {
            type: "genesis",
            app: "Trazabilidad Aguacate",
            ...genesisData,
        });
    }

    getLastBlock() {
        return this.chain[this.chain.length - 1];
    }

    isValidChain(chain = this.chain) {
        if (!Array.isArray(chain) || chain.length === 0) return false;
        for (let i = 0; i < chain.length; i++) {
            const b = chain[i];
            const recomputed = SHA256(
                String(b.index) +
                String(b.createdAt) +
                String(b.previoHash) +
                JSON.stringify(b.data)
            ).toString();
            if (b.hash !== recomputed) return false;
            if (i > 0) {
                const prev = chain[i - 1];
                if (b.previoHash !== prev.hash) return false;
                if (b.index !== prev.index + 1) return false;
            } else {
                if (b.index !== 0) return false;
            }
        }
        return true;
    }

    save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.chain));
        } catch (e) {
            console.warn("No se pudo guardar la cadena en localStorage.", e);
        }
    }

    load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!this.isValidChain(parsed)) return null;
            return parsed;
        } catch {
            return null;
        }
    }

    reset() {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) {
            console.warn("No se pudo limpiar localStorage.", e);
        }
        this.chain = [this.createFirstBlock({ resetAt: new Date().toISOString() })];
        this.save();
    }

    addBlock(data) {
        const prevBlock = this.getLastBlock();
        const block = new Block(prevBlock.index + 1, data, prevBlock.hash);
        this.chain.push(block);
        this.save();
        return block;
    }

    /**
     * Campo: etapa, ubicacion, responsable, fechaEvento, detalles
     * Distribución (dos fases): faseDistribucion = campo_industria | industria_punto_venta
     *   + idEnvio, transporte, fechas salida/llegada, origen/destino, estados, cantidad, personas
     */
    addEvento(evento) {
        const cat = String(evento.categoria || "").trim().toLowerCase();
        const idLote = String(evento.idLote || "").trim();

        if (!idLote || !cat) {
            throw new Error("Evento inválido: falta idLote o categoría.");
        }

        if (cat === "campo") {
            const etapa = String(evento.etapa || "").trim();
            const ubicacion = String(evento.ubicacion || "").trim();
            const responsable = String(evento.responsable || "").trim();
            const fechaEvento = evento.fechaEvento
                ? String(evento.fechaEvento)
                : new Date().toISOString();
            const detalles = evento.detalles ? String(evento.detalles) : "";

            if (!etapa || !ubicacion || !responsable) {
                throw new Error("Campo: completa etapa, ubicación y responsable.");
            }

            return this.addBlock({
                type: "evento",
                categoria: "campo",
                idLote,
                etapa,
                ubicacion,
                responsable,
                fechaEvento,
                detalles,
            });
        }

        if (cat === "distribucion" || cat === "distribución") {
            const fase = String(evento.faseDistribucion || "").trim();
            if (fase !== "campo_industria" && fase !== "industria_punto_venta") {
                throw new Error("Distribución: elige la fase (Campo→Industria o Industria→Punto de venta).");
            }

            const idEnvio = String(evento.idEnvio || "").trim();
            const empresaTransporte = String(evento.empresaTransporte || "").trim();
            const placaVehiculo = String(evento.placaVehiculo || "").trim();
            const fechaSalida = String(evento.fechaSalida || "").trim();
            const fechaLlegada = String(evento.fechaLlegada || "").trim();
            const origen = String(evento.origen || "").trim();
            const destino = String(evento.destino || "").trim();
            const estadoAlSalir = String(evento.estadoAlSalir || "").trim();
            const estadoAlLlegar = String(evento.estadoAlLlegar || "").trim();
            const cantidadRecibida = String(evento.cantidadRecibida ?? "").trim();
            const personaEntrega = String(evento.personaEntrega || "").trim();
            const personaRecibe = String(evento.personaRecibe || "").trim();
            const detalles = evento.detalles ? String(evento.detalles) : "";

            const faltan = [
                idEnvio,
                empresaTransporte,
                placaVehiculo,
                fechaSalida,
                fechaLlegada,
                origen,
                destino,
                estadoAlSalir,
                estadoAlLlegar,
                cantidadRecibida,
                personaEntrega,
                personaRecibe,
            ].some((v) => !v);

            if (faltan) {
                throw new Error("Distribución: completa todos los campos del envío.");
            }

            const etapaEtiqueta =
                fase === "campo_industria"
                    ? "Distribución — Fase 1: Campo → Industria"
                    : "Distribución — Fase 2: Industria → Punto de venta";

            const fechaEvento = fechaLlegada
                ? new Date(fechaLlegada).toISOString()
                : new Date(fechaSalida).toISOString();

            return this.addBlock({
                type: "evento",
                categoria: "distribucion",
                faseDistribucion: fase,
                idLote,
                idEnvio,
                empresaTransporte,
                placaVehiculo,
                fechaSalida,
                fechaLlegada,
                origen,
                destino,
                estadoAlSalir,
                estadoAlLlegar,
                cantidadRecibida,
                personaEntrega,
                personaRecibe,
                detalles,
                etapa: etapaEtiqueta,
                ubicacion: `${origen} → ${destino}`,
                responsable: `${personaEntrega} / ${personaRecibe}`,
                fechaEvento,
            });
        }

        throw new Error("Categoría no válida.");
    }

    getEventos({ idLote = "" } = {}) {
        const filtro = String(idLote || "").trim();
        const eventos = [];

        for (const b of this.chain) {
            if (!b || !b.data || b.data.type !== "evento") continue;
            const ev = b.data;
            if (filtro && String(ev.idLote) !== filtro) continue;
            eventos.push({
                ...ev,
                createdAt: b.createdAt,
                blockIndex: b.index,
                blockHash: b.hash,
            });
        }

        eventos.sort((a, b) => {
            const ta = new Date(a.fechaEvento || a.createdAt).getTime();
            const tb = new Date(b.fechaEvento || b.createdAt).getTime();
            return ta - tb;
        });

        return eventos;
    }
}

// Hacemos disponible la cadena en el navegador
window.naniCoin = new BlockChain({ createdAt: new Date().toISOString() });