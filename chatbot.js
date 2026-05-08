// chatbot.js — Widget de chat flotante para todas las páginas de CarQuest

(function () {
    // ── HTML del widget ────────────────────────────────────────────────────
    const html = `
    <div id="cq-chat-widget">
        <!-- Botón flotante -->
        <button id="cq-chat-btn" aria-label="Abrir asistente">
            <span class="cq-icon-chat">💬</span>
            <span class="cq-icon-close">✕</span>
            <span class="cq-badge" id="cq-badge" hidden>1</span>
        </button>

        <!-- Panel de chat -->
        <div id="cq-chat-panel" aria-hidden="true">
            <!-- Cabecera -->
            <div class="cq-header">
                <div class="cq-header-avatar">🚗</div>
                <div class="cq-header-info">
                    <div class="cq-header-name">Asistente CarQuest</div>
                    <div class="cq-header-status">
                        <span class="cq-dot"></span> En línea
                    </div>
                </div>
                <button class="cq-header-close" id="cq-close-btn" aria-label="Cerrar">✕</button>
            </div>

            <!-- Mensajes -->
            <div class="cq-messages" id="cq-messages">
                <div class="cq-msg cq-msg-bot">
                    <div class="cq-msg-avatar">🚗</div>
                    <div class="cq-msg-bubble">
                        ¡Hola! Soy el asistente de <strong>CarQuest</strong>.<br>
                        Puedo ayudarte con teoría de conducción, preguntas del test y consejos para aprobar. ¿Cómo puedo ayudarte?
                    </div>
                </div>
                <div class="cq-suggestions">
                    <button class="cq-sugg" data-text="Explícame una norma de circulación">📖 Normas de circulación</button>
                    <button class="cq-sugg" data-text="¿Cómo puedo mejorar mi racha?">🔥 Mejorar la racha</button>
                    <button class="cq-sugg" data-text="¿Qué juegos hay disponibles?">🎯 Juegos disponibles</button>
                </div>
            </div>

            <!-- Input -->
            <div class="cq-input-area">
                <textarea
                    id="cq-input"
                    class="cq-input"
                    placeholder="Escribe tu pregunta..."
                    rows="1"
                    maxlength="500"
                ></textarea>
                <button id="cq-send-btn" class="cq-send-btn" aria-label="Enviar">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                </button>
            </div>
        </div>
    </div>`;

    // ── Injectar HTML ──────────────────────────────────────────────────────
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html.trim();
    document.body.appendChild(wrapper.firstChild);

    // ── Injectar CSS ───────────────────────────────────────────────────────
    const style = document.createElement('style');
    style.textContent = `
    /* ── Widget contenidor ── */
    #cq-chat-widget {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 9999;
        font-family: 'Inter', 'Segoe UI', sans-serif;
    }

    /* ── Botó flotant ── */
    #cq-chat-btn {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        border: none;
        background: linear-gradient(135deg, #FF6B35, #ff8c5a);
        color: #fff;
        font-size: 28px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 20px rgba(255, 107, 53, 0.5);
        transition: transform .2s, box-shadow .2s;
        position: relative;
        margin-left: auto;
    }
    #cq-chat-btn:hover {
        transform: scale(1.08);
        box-shadow: 0 6px 28px rgba(255, 107, 53, 0.65);
    }
    #cq-chat-btn:active { transform: scale(.95); }

    .cq-icon-close { display: none; font-size: 18px; font-weight: 700; }

    #cq-chat-widget.open .cq-icon-chat  { display: none; }
    #cq-chat-widget.open .cq-icon-close { display: block; }

    /* Notificació */
    .cq-badge {
        position: absolute;
        top: -4px;
        right: -4px;
        background: #E63946;
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid #0b1220;
    }

    /* ── Panell de xat ── */
    #cq-chat-panel {
        position: absolute;
        bottom: 78px;
        right: 0;
        width: 420px;
        max-height: 580px;
        background: linear-gradient(180deg, #131c2e, #0f172a);
        border: 1px solid rgba(255, 255, 255, .08);
        border-radius: 18px;
        box-shadow: 0 12px 48px rgba(0, 0, 0, .6);
        display: flex;
        flex-direction: column;
        overflow: hidden;

        opacity: 0;
        transform: translateY(16px) scale(.97);
        pointer-events: none;
        transition: opacity .25s ease, transform .25s ease;
    }
    #cq-chat-widget.open #cq-chat-panel {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: auto;
    }

    /* ── Capçalera ── */
    .cq-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 18px;
        background: linear-gradient(135deg, rgba(255,107,53,.15), rgba(255,107,53,.05));
        border-bottom: 1px solid rgba(255,255,255,.07);
        flex-shrink: 0;
    }
    .cq-header-avatar {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: linear-gradient(135deg, #FF6B35, #ff8c5a);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 22px;
        flex-shrink: 0;
    }
    .cq-header-info { flex: 1; }
    .cq-header-name {
        font-size: 15px;
        font-weight: 700;
        color: #fff;
    }
    .cq-header-status {
        font-size: 11px;
        color: rgba(255,255,255,.5);
        display: flex;
        align-items: center;
        gap: 5px;
        margin-top: 2px;
    }
    .cq-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #06A77D;
        display: inline-block;
        box-shadow: 0 0 6px #06A77D;
    }
    .cq-header-close {
        background: none;
        border: none;
        color: rgba(255,255,255,.4);
        font-size: 16px;
        cursor: pointer;
        padding: 4px;
        line-height: 1;
        transition: color .15s;
    }
    .cq-header-close:hover { color: #fff; }

    /* ── Àrea de missatges ── */
    .cq-messages {
        flex: 1;
        overflow-y: auto;
        padding: 18px 16px;
        display: flex;
        flex-direction: column;
        gap: 14px;
        scroll-behavior: smooth;
    }
    .cq-messages::-webkit-scrollbar { width: 4px; }
    .cq-messages::-webkit-scrollbar-thumb {
        background: rgba(255,255,255,.1);
        border-radius: 4px;
    }

    /* Missatge bot */
    .cq-msg {
        display: flex;
        gap: 8px;
        align-items: flex-end;
    }
    .cq-msg-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: linear-gradient(135deg, #FF6B35, #ff8c5a);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 17px;
        flex-shrink: 0;
    }
    .cq-msg-bubble {
        background: rgba(255,255,255,.07);
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 16px 16px 16px 4px;
        padding: 11px 15px;
        font-size: 14px;
        color: rgba(255,255,255,.85);
        line-height: 1.55;
        max-width: 310px;
    }
    .cq-msg-bubble strong { color: #FF6B35; }

    /* Missatge usuari */
    .cq-msg.cq-msg-user {
        flex-direction: row-reverse;
    }
    .cq-msg.cq-msg-user .cq-msg-bubble {
        background: linear-gradient(135deg, rgba(255,107,53,.25), rgba(255,107,53,.12));
        border-color: rgba(255,107,53,.3);
        border-radius: 16px 16px 4px 16px;
        color: #fff;
    }

    /* Typing indicator */
    .cq-typing .cq-msg-bubble {
        display: flex;
        gap: 4px;
        padding: 12px 16px;
    }
    .cq-typing-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: rgba(255,255,255,.4);
        animation: cq-bounce .9s infinite ease-in-out;
    }
    .cq-typing-dot:nth-child(2) { animation-delay: .15s; }
    .cq-typing-dot:nth-child(3) { animation-delay: .3s; }
    @keyframes cq-bounce {
        0%, 80%, 100% { transform: translateY(0); }
        40%            { transform: translateY(-6px); }
    }

    /* Suggeriments ràpids */
    .cq-suggestions {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding-left: 36px;
    }
    .cq-sugg {
        background: rgba(255,107,53,.08);
        border: 1px solid rgba(255,107,53,.2);
        border-radius: 20px;
        color: rgba(255,255,255,.75);
        font-size: 13px;
        font-weight: 600;
        padding: 7px 14px;
        cursor: pointer;
        text-align: left;
        transition: background .15s, border-color .15s, color .15s;
        font-family: inherit;
    }
    .cq-sugg:hover {
        background: rgba(255,107,53,.18);
        border-color: rgba(255,107,53,.4);
        color: #fff;
    }

    /* ── Input ── */
    .cq-input-area {
        display: flex;
        align-items: flex-end;
        gap: 8px;
        padding: 14px 16px;
        border-top: 1px solid rgba(255,255,255,.07);
        background: rgba(255,255,255,.02);
        flex-shrink: 0;
    }
    .cq-input {
        flex: 1;
        background: rgba(255,255,255,.07);
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 12px;
        color: #fff;
        font-size: 14px;
        font-family: inherit;
        padding: 11px 15px;
        resize: none;
        max-height: 100px;
        overflow-y: auto;
        line-height: 1.5;
        transition: border-color .15s;
        outline: none;
    }
    .cq-input::placeholder { color: rgba(255,255,255,.3); }
    .cq-input:focus { border-color: rgba(255,107,53,.5); }

    .cq-send-btn {
        width: 42px;
        height: 42px;
        border-radius: 11px;
        border: none;
        background: linear-gradient(135deg, #FF6B35, #ff8c5a);
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        flex-shrink: 0;
        transition: transform .15s, box-shadow .15s;
        box-shadow: 0 2px 10px rgba(255,107,53,.35);
    }
    .cq-send-btn svg { width: 18px; height: 18px; }
    .cq-send-btn:hover { transform: scale(1.07); box-shadow: 0 4px 16px rgba(255,107,53,.5); }
    .cq-send-btn:active { transform: scale(.94); }
    .cq-send-btn:disabled { opacity: .4; cursor: not-allowed; transform: none; }

    /* ── Mòbil ── */
    @media (max-width: 520px) {
        #cq-chat-panel {
            width: calc(100vw - 24px);
            right: -12px;
            bottom: 76px;
            max-height: 72vh;
        }
        #cq-chat-widget { bottom: 16px; right: 16px; }
    }`;
    document.head.appendChild(style);

    // ── Lògica ────────────────────────────────────────────────────────────
    const widget   = document.getElementById('cq-chat-widget');
    const btn      = document.getElementById('cq-chat-btn');
    const closeBtn = document.getElementById('cq-close-btn');
    const panel    = document.getElementById('cq-chat-panel');
    const messages = document.getElementById('cq-messages');
    const input    = document.getElementById('cq-input');
    const sendBtn  = document.getElementById('cq-send-btn');
    const badge    = document.getElementById('cq-badge');

    let isOpen = false;

    function togglePanel() {
        isOpen = !isOpen;
        widget.classList.toggle('open', isOpen);
        panel.setAttribute('aria-hidden', !isOpen);
        if (isOpen) {
            badge.hidden = true;
            input.focus();
            scrollToBottom();
        }
    }

    function scrollToBottom() {
        messages.scrollTop = messages.scrollHeight;
    }

    // Auto-resize textarea
    input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 100) + 'px';
    });

    // ── Base de conocimiento ──────────────────────────────────────────────
    const KB = [
        // ── VELOCIDADES ──
        { tags: ['velocidad','limite','máxima','km/h','kmh','autopista','autovía','carretera','ciudad','urbana','velocidades'],
          r: `🚗 <strong>Límites de velocidad generales en España:</strong><br>
• Autopistas y autovías: <strong>120 km/h</strong><br>
• Carreteras convencionales con arcén ≥ 1,5m: <strong>90 km/h</strong><br>
• Carreteras convencionales sin arcén: <strong>90 km/h</strong><br>
• Vías urbanas: <strong>50 km/h</strong><br>
• Zonas 30: <strong>30 km/h</strong><br>
• Vías de plataforma única: <strong>20 km/h</strong><br><br>
⚠️ Recuerda: en condiciones adversas (lluvia, niebla) debes reducir la velocidad.` },

        // ── ALCOHOL ──
        { tags: ['alcohol','tasa','alcoholemia','beber','copa','gramos','0,5','0.5','novato','profesional'],
          r: `🍺 <strong>Tasas de alcoholemia permitidas:</strong><br>
• Conductores en general: <strong>0,5 g/l</strong> en sangre (0,25 mg/l en aire)<br>
• Conductores noveles (< 2 años de carné): <strong>0,3 g/l</strong> (0,15 mg/l en aire)<br>
• Conductores profesionales y transporte escolar: <strong>0,3 g/l</strong> (0,15 mg/l en aire)<br><br>
⚠️ Lo más seguro es <strong>0,0</strong> — no bebas si vas a conducir.` },

        // ── SEÑALES ──
        { tags: ['señal','señales','triángulo','círculo','rojo','azul','cuadrada','octogonal','stop','ceda','prioridad','vertical'],
          r: `🚦 <strong>Tipos de señales de tráfico:</strong><br>
• <strong>Triángulo rojo</strong> → Peligro (peligros próximos)<br>
• <strong>Círculo rojo</strong> → Prohibición o restricción<br>
• <strong>Círculo azul</strong> → Obligación<br>
• <strong>Cuadrado/Rectángulo azul</strong> → Indicación<br>
• <strong>STOP (octógono rojo)</strong> → Detención obligatoria<br>
• <strong>Ceda el paso (triángulo invertido)</strong> → Cede la prioridad<br><br>
💡 Practica reconociendo señales en el <strong>Senyal Challenge</strong> de Juegos.` },

        // ── SEMÁFOROS ──
        { tags: ['semáforo','semaforo','verde','naranja','ámbar','ambar','rojo','luz','luces'],
          r: `🚦 <strong>Semáforos:</strong><br>
• <strong>Verde</strong> → Paso permitido<br>
• <strong>Ámbar (naranja)</strong> → Prepararse para detenerse (solo sigue si ya es peligroso frenar)<br>
• <strong>Rojo</strong> → Detención obligatoria<br>
• <strong>Verde parpadeante</strong> → Va a cambiar a ámbar pronto<br>
• <strong>Ámbar parpadeante</strong> → Precaución, actúa como señal de peligro` },

        // ── DISTANCIA DE SEGURIDAD ──
        { tags: ['distancia','seguridad','separación','espacio','seguir','detrás','delantera'],
          r: `📏 <strong>Distancia de seguridad:</strong><br>
La distancia mínima no está fijada en metros exactos — depende de la velocidad y condiciones.<br><br>
• La <strong>regla de los 2 segundos</strong>: elige un punto fijo, cuando el coche de delante lo pase, deberías tardar al menos 2 segundos en llegar tú.<br>
• En autopista a 120 km/h → mínimo ~65 metros<br>
• Con lluvia o niebla → dobla la distancia<br><br>
⚠️ No mantener distancia de seguridad es una infracción <strong>grave</strong>.` },

        // ── ADELANTAMIENTO ──
        { tags: ['adelantar','adelantamiento','sobrepasar','rebasar','línea','continua','discontinua'],
          r: `🚗 <strong>Adelantamiento:</strong><br>
• Solo está permitido si hay <strong>línea discontinua</strong> en tu carril<br>
• <strong>Línea continua</strong> → Prohibido adelantar<br>
• Debes asegurarte de que la vía está despejada por delante<br>
• Señaliza con el intermitente antes de adelantar<br>
• Prohibido adelantar: en curvas sin visibilidad, cimas de colinas, paso a nivel, intersecciones (salvo excepciones)<br>
• Vuelve al carril derecho en cuanto puedas de forma segura` },

        // ── PRIORIDAD / DERECHA ──
        { tags: ['prioridad','preferencia','derecha','izquierda','ceder','paso','intersección','cruce'],
          r: `🛑 <strong>Normas de prioridad:</strong><br>
• <strong>Regla general</strong>: ceder el paso al vehículo que viene por la derecha<br>
• <strong>Señal de prioridad</strong>: el que la tiene no cede<br>
• <strong>Ceda el paso</strong>: debes ceder a todos los vehículos de la vía principal<br>
• <strong>Rotondas</strong>: prioridad a quien está dentro de la rotonda<br>
• Los vehículos de emergencia (con sirena y luces) siempre tienen prioridad` },

        // ── ROTONDAS ──
        { tags: ['rotonda','glorieta','circular','redondel'],
          r: `🔄 <strong>Rotondas:</strong><br>
• Los vehículos que ya están <strong>dentro</strong> tienen prioridad<br>
• Entra siempre por la derecha<br>
• Usa el carril exterior para salidas próximas, el interior para dar más vueltas<br>
• Señaliza al salir con el intermitente derecho<br>
• Velocidad máxima dentro: 50 km/h (o la señalizada)` },

        // ── CINTURÓN ──
        { tags: ['cinturón','cinturon','seguridad','obligatorio','abrocharse','silla','bebé','bebé','niño','infantil'],
          r: `🔒 <strong>Cinturón de seguridad:</strong><br>
• <strong>Obligatorio</strong> en todos los asientos y para todos los ocupantes<br>
• Niños menores de 135 cm → sistema de retención infantil homologado<br>
• Niños de 135 cm o más → cinturón normal<br>
• No se puede eximir de llevar cinturón en ningún tipo de vía<br><br>
⚠️ No llevarlo es infracción <strong>grave</strong> con pérdida de 3 puntos.` },

        // ── MÓVIL / TELÉFONO ──
        { tags: ['móvil','movil','teléfono','telefono','manos libres','auricular','whatsapp','llamada','mano'],
          r: `📵 <strong>Uso del móvil al volante:</strong><br>
• <strong>Prohibido</strong> sujetar el móvil con la mano mientras conduces<br>
• <strong>Manos libres sin auriculares</strong>: permitido si el dispositivo está fijo<br>
• <strong>Auriculares en ambos oídos</strong>: prohibido (reducen la percepción del entorno)<br>
• Infracción <strong>grave</strong>: -6 puntos del carné<br><br>
⚠️ Incluso detenido en un semáforo, el motor en marcha = infracción.` },

        // ── PUNTOS DEL CARNÉ ──
        { tags: ['puntos','carné','carne','permiso','conducir','recuperar','quitar','perder','saldo'],
          r: `📋 <strong>Sistema de puntos del carné:</strong><br>
• Puntos iniciales: <strong>12 puntos</strong> (15 tras 3 años sin infracciones graves)<br>
• Conductores noveles los primeros 3 años: <strong>8 puntos</strong><br>
• Recuperación de puntos: cursos de sensibilización (máx. 6 puntos cada 2 años)<br><br>
<strong>Ejemplos de infracciones graves:</strong><br>
• Exceso de velocidad > 20 km/h: -2 a -6 puntos<br>
• Alcohol > tasa permitida: -4 a -6 puntos<br>
• No usar cinturón: -3 puntos<br>
• Usar el móvil con la mano: -6 puntos` },

        // ── ESTACIONAMIENTO ──
        { tags: ['aparcar','estacionar','estacionamiento','parking','zona azul','prohibido aparcar','parar'],
          r: `🅿️ <strong>Estacionamiento:</strong><br>
• <strong>Prohibido aparcar</strong> en: pasos de peatones, carriles bus, salidas de vehículos (vados), intersecciones, arcenes de autopista<br>
• <strong>Zona azul</strong>: tiempo limitado con ticket o app (residentes suelen estar exentos)<br>
• <strong>Doble fila</strong>: solo permitido con conductor dentro y motor apagado, por tiempo mínimo<br>
• En cuesta: gira las ruedas hacia el bordillo cuesta abajo, al contrario cuesta arriba` },

        // ── NIEBLA ──
        { tags: ['niebla','lluvia','condiciones','adversas','visibilidad','luces','antiniebla','hidropla'],
          r: `🌫️ <strong>Conducción con visibilidad reducida:</strong><br>
• Usa <strong>luces de cruce</strong> (cortas) con niebla o lluvia fuerte<br>
• <strong>Antiniebla traseras</strong>: solo cuando visibilidad < 50 metros<br>
• <strong>Antiniebla delanteras</strong>: cuando la niebla dificulta ver la calzada<br>
• Reduce la velocidad y aumenta la distancia de seguridad<br>
• Riesgo de <strong>aquaplaning</strong>: levanta el pie del acelerador suavemente, no frenes bruscamente` },

        // ── CASCO ──
        { tags: ['casco','moto','motocicleta','ciclomotor','bici','bicicleta','patinete','vmp'],
          r: `🪖 <strong>Casco y protección:</strong><br>
• <strong>Obligatorio</strong> para conductores y pasajeros de motos y ciclomotores<br>
• Bicicletas: obligatorio fuera de ciudad y para menores de 16 años<br>
• Patinetes eléctricos (VMP): obligatorio el casco en muchos municipios<br>
• El casco debe estar <strong>homologado</strong> (marcado CE o ECE 22.06)<br>
• No llevarlo: infracción grave, -4 puntos` },

        // ── AUTOPISTAS ──
        { tags: ['autopista','autovía','peaje','arc','arcén','parada','emergencia','avería'],
          r: `🛣️ <strong>Autopistas y autovías:</strong><br>
• Velocidad máxima: <strong>120 km/h</strong> (mínima: 60 km/h)<br>
• En caso de avería: <strong>arcén derecho</strong>, triángulos de señalización, chaleco reflectante<br>
• <strong>Chaleco reflectante</strong>: obligatorio antes de salir del vehículo en la calzada o arcén<br>
• Prohibido: ir marcha atrás, dar la vuelta, circular por el arcén (salvo emergencia)<br>
• Entrada: incorporarse por el carril de aceleración adaptando la velocidad al tráfico` },

        // ── PASO DE PEATONES ──
        { tags: ['peatón','peatones','paso','cebra','zebra','atropello','acera','semáforo peatonal'],
          r: `🚶 <strong>Peatones y pasos de peatones:</strong><br>
• Debes ceder el paso a peatones en <strong>pasos señalizados</strong><br>
• Si hay semáforo: rojo para ti = peatones tienen prioridad<br>
• En <strong>calles peatonales o zonas 10/20</strong>: los peatones tienen prioridad total<br>
• <strong>Peatones con visibilidad reducida</strong> (bastón blanco, perro guía): prioridad absoluta<br>
• Infracción por no ceder el paso: <strong>grave</strong>, -4 puntos` },

        // ── APP CARQUEST GENERAL ──
        { tags: ['carquest','aplicación','app','cómo funciona','qué es','para qué'],
          r: `🚗 <strong>¿Qué es CarQuest?</strong><br>
CarQuest es una app para preparar el examen de conducir de forma divertida. Incluye:<br>
• 📝 <strong>Tests</strong>: 2947 preguntas oficiales DGT agrupadas en tests de 30 preguntas<br>
• 🎮 <strong>Juegos</strong>: Aparcar, Conducción Dirigida, Senyal Challenge, Elige Responsable, Temps de Reacció<br>
• 📖 <strong>Teoría</strong>: Contenido dividido por temas<br>
• 📅 <strong>Retos Diarios</strong>: 3 retos cada día con recompensas<br>
• 🏆 <strong>Ranking</strong>: Compite con otros usuarios<br>
• 🛒 <strong>Tienda</strong>: Usa tus monedas para desbloquear cosas` },

        // ── XP Y NIVELES ──
        { tags: ['xp','experiencia','nivel','subir','rang','rango','puntos','ganar','recompensa'],
          r: `⭐ <strong>Sistema de XP y Rangos:</strong><br>
• 🙂 <strong>Conductor Novato</strong>: 0 – 500 XP<br>
• 🚗 <strong>Conductor Intermedio</strong>: 500 – 2.000 XP<br>
• 🛣️ <strong>Piloto Seguro</strong>: 2.000 – 5.000 XP<br>
• 👑 <strong>Piloto Experto</strong>: 5.000 – 10.000 XP<br>
• 🏆 <strong>Piloto Maestro</strong>: 10.000+ XP<br><br>
Ganas XP completando tests, juegos y retos diarios. ¡Cuanto más practicas, más rápido subes!` },

        // ── RACHA ──
        { tags: ['racha','racha diaria','días','consecutivos','streak','fuego','quemar','mantener'],
          r: `🔥 <strong>Racha diaria:</strong><br>
La racha cuenta los días consecutivos que haces tests. ¡No la pierdas!<br><br>
• Haz al menos <strong>1 test</strong> al día para mantenerla<br>
• Si un día no haces ningún test, la racha se reinicia a 0<br>
• La racha te motiva a estudiar regularmente, que es la clave para aprobar 💪` },

        // ── RETOS DIARIOS ──
        { tags: ['reto','retos','diario','diarios','desafío','bonus','bonificación','monedas'],
          r: `📅 <strong>Retos Diarios:</strong><br>
Cada día tienes 3 retos nuevos:<br>
• 📝 Completar un número de tests<br>
• ✅ Aprobar un número de tests<br>
• 🎮 Completar minijuegos<br><br>
Las recompensas van de <strong>50 a 300 XP</strong> y monedas 🪙<br>
¡Si completas los 3 retos, ganas un <strong>bonus especial</strong> de +300 XP y +50 🪙!` },

        // ── JUEGOS ──
        { tags: ['juego','juegos','minijuego','aparcar','conducción','conduccion','señales','reacción','reaccion','responsable'],
          r: `🎮 <strong>Juegos disponibles en CarQuest:</strong><br>
• 🅿️ <strong>Aparcar</strong>: Practica el aparcamiento en paralelo y en batería<br>
• 🚗 <strong>Conducción Dirigida</strong>: Sigue instrucciones de dirección y señales<br>
• 🚦 <strong>Senyal Challenge</strong>: Identifica señales de tráfico rápidamente<br>
• ⚖️ <strong>Elige Responsable</strong>: Decide quién tiene la culpa en situaciones de tráfico<br>
• ⏱️ <strong>Temps de Reacció</strong>: Mide tu tiempo de reacción<br><br>
Cada juego te da XP y cuenta para los retos diarios.` },

        // ── TESTS ──
        { tags: ['test','tests','preguntas','examen','aprobar','suspender','dgt','oficial','cuántas','responder'],
          r: `📝 <strong>Tests de teoría:</strong><br>
• La app tiene <strong>2947 preguntas oficiales DGT</strong><br>
• Cada test tiene <strong>30 preguntas</strong><br>
• Para aprobar el examen real necesitas <strong>27/30 aciertos</strong> (máx. 3 fallos)<br>
• En la app puedes hacer los tests en modo libre o seguir el orden numerado<br><br>
💡 Consejo: repite los tests que suspendes hasta dominarlos antes de pasar al siguiente.` },

        // ── RANKING ──
        { tags: ['ranking','clasificación','clasificacion','posición','posicion','top','mejor','competir','tabla'],
          r: `🏆 <strong>Ranking:</strong><br>
El ranking muestra los 10 usuarios con más XP de CarQuest.<br><br>
• Se actualiza en tiempo real<br>
• Cuanto más tests hagas y juegos completes, más XP acumulas<br>
• ¡Los retos diarios son la forma más rápida de escalar posiciones!<br>
• También puedes ver tu posición exacta en el ranking global` },

        // ── MONEDAS ──
        { tags: ['moneda','monedas','tienda','comprar','gastar','🪙','coin'],
          r: `🪙 <strong>Monedas:</strong><br>
Las monedas son la moneda de CarQuest.<br>
• Se ganan completando tests, juegos y retos diarios<br>
• El bonus diario da <strong>+50 🪙</strong> extra<br>
• Se pueden gastar en la <strong>Tienda</strong> para desbloquear elementos<br>
• ¡Los retos diarios son la mejor fuente de monedas!` },

        // ── CONSEJOS PARA APROBAR ──
        { tags: ['consejo','consejos','aprobar','pasar','preparar','preparación','examen','trucos','tip'],
          r: `💡 <strong>Consejos para aprobar el examen DGT:</strong><br>
1. <strong>Constancia</strong>: estudia un poco cada día, no todo de golpe<br>
2. <strong>Repite los fallos</strong>: haz tests hasta que los errores sean 0<br>
3. <strong>Practica señales</strong>: son muchas preguntas — usa el Senyal Challenge<br>
4. <strong>Lee bien las preguntas</strong>: palabras como "NUNCA", "SIEMPRE", "EXCEPTO" cambian la respuesta<br>
5. <strong>Mantén la racha</strong>: estudiar a diario es la clave<br>
6. <strong>Velocidades y tasas de alcohol</strong>: memorízalas, siempre caen en el examen` },

        // ── SALUDO ──
        { tags: ['hola','buenas','hi','hey','saludos','buenos días','buenas tardes','ola'],
          r: `¡Hola! 👋 Soy el asistente de <strong>CarQuest</strong>.<br>Puedo ayudarte con:<br>
• 🚦 Normas y señales de tráfico (DGT)<br>
• 📝 Preguntas de teoría de conducción<br>
• 🎮 Cómo funcionan los juegos y la app<br><br>
¿Qué quieres saber?` },

        // ── GRACIAS ──
        { tags: ['gracias','thanks','thx','genial','perfecto','ok','bien','entendido'],
          r: `¡De nada! 😊 Si tienes más dudas sobre conducción o la app, aquí estoy. ¡Mucho ánimo con el examen! 🚗💪` },
    ];

    function buscarRespuesta(texto) {
        const t = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        let mejorPuntuacion = 0;
        let mejorRespuesta = null;

        for (const entrada of KB) {
            let puntos = 0;
            for (const tag of entrada.tags) {
                const tagNorm = tag.normalize('NFD').replace(/[̀-ͯ]/g, '');
                if (t.includes(tagNorm)) puntos++;
            }
            if (puntos > mejorPuntuacion) {
                mejorPuntuacion = puntos;
                mejorRespuesta = entrada.r;
            }
        }

        if (mejorPuntuacion === 0) {
            return `No tengo información específica sobre eso, pero puedo ayudarte con:<br>
• 🚦 Velocidades, señales, semáforos, prioridad...<br>
• 🍺 Alcohol, cinturón, móvil, puntos del carné...<br>
• 📝 Cómo funcionan los tests y juegos de CarQuest<br><br>
¿Sobre qué quieres saber más?`;
        }

        return mejorRespuesta;
    }

    function simularTyping(texto, bubble, cb) {
        let i = 0;
        bubble.innerHTML = '';
        const interval = setInterval(() => {
            if (i >= texto.length) {
                clearInterval(interval);
                bubble.innerHTML = texto;
                scrollToBottom();
                if (cb) cb();
                return;
            }
            // Avanza en chunks de 4 chars para que sea rápido pero fluido
            i = Math.min(i + 4, texto.length);
            bubble.innerHTML = texto.slice(0, i) + '<span style="opacity:.3">▌</span>';
            scrollToBottom();
        }, 12);
    }

    function sendMessage() {
        const text = input.value.trim();
        if (!text) return;

        addMessage(text, 'user');
        input.value = '';
        input.style.height = 'auto';
        sendBtn.disabled = true;

        const typing = addTyping();

        // Tiempo de "pensar" proporcional al texto (entre 400ms y 900ms)
        const delay = Math.min(900, 400 + text.length * 5);

        setTimeout(() => {
            typing.remove();
            const respuesta = buscarRespuesta(text);
            const div = addMessage('', 'bot');
            const bubble = div.querySelector('.cq-msg-bubble');
            simularTyping(respuesta, bubble, () => { sendBtn.disabled = false; });
        }, delay);
    }

    function addMessage(text, role) {
        const isBot = role === 'bot';
        const div = document.createElement('div');
        div.className = `cq-msg cq-msg-${role}`;
        div.innerHTML = isBot
            ? `<div class="cq-msg-avatar">🚗</div><div class="cq-msg-bubble">${text}</div>`
            : `<div class="cq-msg-bubble">${escapeHtml(text)}</div>`;
        messages.appendChild(div);
        scrollToBottom();
        return div;
    }

    function addTyping() {
        const div = document.createElement('div');
        div.className = 'cq-msg cq-msg-bot cq-typing';
        div.innerHTML = `<div class="cq-msg-avatar">🚗</div>
            <div class="cq-msg-bubble">
                <span class="cq-typing-dot"></span>
                <span class="cq-typing-dot"></span>
                <span class="cq-typing-dot"></span>
            </div>`;
        messages.appendChild(div);
        scrollToBottom();
        return div;
    }

    function escapeHtml(str) {
        return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    // Suggeriments ràpids
    messages.addEventListener('click', e => {
        const sugg = e.target.closest('.cq-sugg');
        if (!sugg) return;
        input.value = sugg.dataset.text;
        sugg.closest('.cq-suggestions')?.remove();
        sendMessage();
    });

    // Events
    btn.addEventListener('click', togglePanel);
    closeBtn.addEventListener('click', togglePanel);

    sendBtn.addEventListener('click', sendMessage);

    input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Tancar clicant fora (ignorar si l'element ja no és al DOM)
    document.addEventListener('click', e => {
        if (isOpen && e.target.isConnected && !widget.contains(e.target)) togglePanel();
    });

    // Mostrar badge inicial als 3s si el panell està tancat
    setTimeout(() => {
        if (!isOpen) badge.hidden = false;
    }, 3000);
})();
