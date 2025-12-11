function formatTimestamp(date) {
    return date.toLocaleString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
    }).replace(',', ' -');
}

function nl2br(str) {
    const s = (str == null) ? '' : String(str);
    return s.replace(/\n/g, '<br>');
}

function formatResponse(str) {
    const s = (str == null) ? '' : String(str);
    return s
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/\n/g, '<br>');
}

document.addEventListener('DOMContentLoaded', function () {
    // Adiciona CSS para o nome do agente se não existir
    if (!document.querySelector('style[data-agent-name]')) {
        const style = document.createElement('style');
        style.setAttribute('data-agent-name', 'true');
        style.textContent = `
            .agent-name {
                font-size: 0.7rem !important;
                color: #aaa !important;
                margin-top: 3px !important;
                text-align: left !important;
                font-style: italic;
            }
        `;
        document.head.appendChild(style);
    }

    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');

    sendButton.addEventListener('click', function () {
        const messageInput = document.getElementById('chat-input');
        const message = messageInput.value.trim();
        const chatWindow = document.getElementById('chat-window');

        if (message.length > 0) {
            // Exibe imediatamente a mensagem do usuário
            const userTimestamp = formatTimestamp(new Date());
            chatWindow.innerHTML += `
                <div class="message user-message">
                    <div class="message-content">
                        <div class="assistant-type">Você</div>
                        ${message}
                        <div class="message-timestamp">
                            ${userTimestamp}
                        </div>
                    </div>
                </div>
            `;
            chatWindow.scrollTop = chatWindow.scrollHeight;
            messageInput.value = '';

            // Adiciona balão de loading do assistente
            const spinnerId = 'spinner-' + Date.now();
            chatWindow.innerHTML += `
                <div class="message assistant-message" id="${spinnerId}">
                    <div class="message-content" style="display:flex;align-items:center;gap:10px;">
                        <img src="/public/load.gif" alt="Carregando..." style="width:50px;height:50px;">
                    </div>
                </div>
            `;
            chatWindow.scrollTop = chatWindow.scrollHeight;

            // Enviar a mensagem para o backend (STREAMING)
            fetch('/chat/message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message })
            })
                .then(async response => {
                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();
                    let buffer = '';

                    // Prepara balão do assistente
                    const assistantTimestamp = formatTimestamp(new Date());
                    const spinnerDiv = document.getElementById(spinnerId);

                    // Variáveis para montar a resposta final
                    let fullText = '';
                    let assistantType = 'Assistente';
                    let assistantName = '';

                    // Loop de leitura do stream
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n\n'); // SSE separa eventos por \n\n
                        buffer = lines.pop(); // Guarda o resto incompleto

                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                const dataStr = line.replace('data: ', '');
                                try {
                                    const data = JSON.parse(dataStr);

                                    if (data.chunk) {
                                        // Chegou pedaço de texto
                                        fullText += data.chunk;

                                        // Atualiza UI instantaneamente
                                        if (spinnerDiv) {
                                            spinnerDiv.innerHTML = `
                                            <div class="message-content">
                                                <div class="assistant-type">${assistantType}</div>
                                                ${formatResponse(fullText)}
                                                <div class="message-timestamp">${assistantTimestamp}</div>
                                            </div>
                                        `;
                                        }
                                        chatWindow.scrollTop = chatWindow.scrollHeight;
                                    }
                                    else if (data.done) {
                                        // Fim do stream com metadados
                                        // Se quiser atualizar algo na tela com data.dadosUso ou data.weather, faz aqui.
                                        // Ex: atualizar nome do assistente se vier
                                        if (data.assistantName) assistantName = data.assistantName;
                                    }
                                    else if (data.error) {
                                        console.error('Erro no stream:', data.error);
                                        fullText += '\n[Erro ao processar resposta]';
                                    }

                                } catch (e) {
                                    console.warn('Erro parse JSON stream:', e);
                                }
                            }
                        }
                    }
                })
                .catch(err => {
                    const spinnerDiv = document.getElementById(spinnerId);
                    if (spinnerDiv) {
                        spinnerDiv.innerHTML = `
                        <div class="message-content text-danger">
                            Erro de conexão. Tente novamente.
                        </div>
                    `;
                    }
                    console.error('Erro geral fetch:', err);
                });
        }
    });

    // Enviar ao pressionar "Enter"
    chatInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendButton.click();
            this.value = '';
        }
    });
});