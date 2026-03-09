// chatbot.js — Widget de xat flotant per a totes les pàgines de CarQuest

(function () {
    // ── HTML del widget ────────────────────────────────────────────────────
    const html = `
    <div id="cq-chat-widget">
        <!-- Botó flotant -->
        <button id="cq-chat-btn" aria-label="Obrir assistent">
            <span class="cq-icon-chat">💬</span>
            <span class="cq-icon-close">✕</span>
            <span class="cq-badge" id="cq-badge" hidden>1</span>
        </button>

        <!-- Panell de xat -->
        <div id="cq-chat-panel" aria-hidden="true">
            <!-- Capçalera -->
            <div class="cq-header">
                <div class="cq-header-avatar">🚗</div>
                <div class="cq-header-info">
                    <div class="cq-header-name">Assistent CarQuest</div>
                    <div class="cq-header-status">
                        <span class="cq-dot"></span> En línia
                    </div>
                </div>
                <button class="cq-header-close" id="cq-close-btn" aria-label="Tancar">✕</button>
            </div>

            <!-- Missatges -->
            <div class="cq-messages" id="cq-messages">
                <div class="cq-msg cq-msg-bot">
                    <div class="cq-msg-avatar">🚗</div>
                    <div class="cq-msg-bubble">
                        Hola! Soc l'assistent de <strong>CarQuest</strong>.<br>
                        Puc ajudar-te amb teoria de conducció, preguntes del test i consells per aprovar. Com et puc ajudar?
                    </div>
                </div>
                <div class="cq-suggestions">
                    <button class="cq-sugg" data-text="Explica'm una norma de circulació">📖 Normes de circulació</button>
                    <button class="cq-sugg" data-text="Com puc millorar la meva racha?">🔥 Millorar la racha</button>
                    <button class="cq-sugg" data-text="Quins jocs hi ha disponibles?">🎯 Jocs disponibles</button>
                </div>
            </div>

            <!-- Input -->
            <div class="cq-input-area">
                <textarea
                    id="cq-input"
                    class="cq-input"
                    placeholder="Escriu la teva pregunta..."
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

    // Enviar missatge (de moment només afegeix el text a la UI)
    function sendMessage() {
        const text = input.value.trim();
        if (!text) return;

        // Missatge usuari
        addMessage(text, 'user');
        input.value = '';
        input.style.height = 'auto';
        sendBtn.disabled = true;

        // Typing indicator
        const typing = addTyping();

        // Resposta placeholder (1.5s)
        setTimeout(() => {
            typing.remove();
            addMessage('Gràcies per la pregunta! Aviat podré respondre\'t amb intel·ligència artificial. Per ara, explora els <strong>Tests</strong> i <strong>Jocs</strong> disponibles 🚗', 'bot');
            sendBtn.disabled = false;
        }, 1500);
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
