function nl2br(str) {
            return str.replace(/\n/g, '<br>');
        }

function formatResponse(str) {
            return str
                .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
                .replace(/\n/g, '<br>');
}

document.addEventListener('DOMContentLoaded', function() {
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');

    sendButton.addEventListener('click', function() {
        const messageInput = document.getElementById('chat-input');
        const message = messageInput.value.trim();
        const chatWindow = document.getElementById('chat-window');

        if (message.length > 0) {
            // Exibe imediatamente a mensagem do usuário
            chatWindow.innerHTML += `
                <div class="message user-message">
                    <div class="message-content">
                        <div class="assistant-type">Você</div>
                        ${message}
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

            // Enviar a mensagem para o backend
            fetch('/chat/message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message })
            })
            .then(response => response.json())
            .then(data => {
                // Substitui o balão de loading pela resposta do assistente
                const spinnerDiv = document.getElementById(spinnerId);
                if (spinnerDiv) {
                    spinnerDiv.innerHTML = `
                        <div class="message-content">
                            <div class="assistant-type">${data.assistantType}</div>
                            ${formatResponse(data.response)}
                        </div>
                    `;
                }
                chatWindow.scrollTop = chatWindow.scrollHeight;
            })
            .catch(err => {
                // Em caso de erro, remove o spinner e mostra mensagem de erro
                const spinnerDiv = document.getElementById(spinnerId);
                if (spinnerDiv) {
                    spinnerDiv.innerHTML = `
                        <div class="message-content text-danger">
                            Erro ao enviar mensagem. Tente novamente.
                        </div>
                    `;
                }
                console.error('Erro ao enviar mensagem:', err);
            });
        }
    });

    // Enviar ao pressionar "Enter"
    chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendButton.click();
            this.value = '';
        }
    });
});