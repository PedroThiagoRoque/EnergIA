    jQuery(document).ready(function(){
        jQuery('.btn-group .btn').click(function(){
            // Remove a classe 'btn-selected' de todos os botões
            jQuery('.btn-group .btn').removeClass('btn-selected');

            // Adiciona a classe 'btn-selected' ao botão clicado
            jQuery(this).addClass('btn-selected');
        });
    });
////////////////////////////////////////////////////////////

jQuery(document).ready(function(){
    
    
    const userInput = jQuery('textarea[name="userInput"]').val();
    endpoint ='/editor/openai'; //= isBedrock ? "/bedrock/ask" : "/openai/ask";
    let selectedModel = "gpt";

    document.getElementById('gpt3').addEventListener('click', function() {
        selectedModel = "gpt";
        endpoint = "/editor/openai";
        console.log("gpt"+ endpoint);
    });

    document.getElementById('claude').addEventListener('click', function() {
        selectedModel = "claude";
        endpoint = "/editor/bedrock";
        console.log("claude"+endpoint);
    });    


jQuery('form').submit(function(event){
    event.preventDefault();

    // Adicionar animação de carregamento
    const loadingDiv = jQuery('<div>').addClass('loader').css('margin', '10px auto');
    jQuery('.chat-messages').append(loadingDiv);

    jQuery('textarea[name="userInput"]').val(''); // Limpar a textarea
    const btnSubmit = jQuery(this).find('button[type="submit"]');//desabilita o botão de enviar
    btnSubmit.prop('disabled', true);

        jQuery.ajax({
        type: "POST",
        url: endpoint,
        data: { userInput: userInput }, //ADICIONAR OS PARÂMETROS SELECIONADOS AO DATA PASSADO AO /POST COMO PROMPT DE SISTEMA
        success: function(data) {
            
            if (selectedModel == "gpt") { 

                jQuery('.loader').remove(); // Remover animação de carregamento
                
                const messageDiv = jQuery('<p>').addClass('user').text('Você: ' + userInput);
                jQuery('.chat-messages').append(messageDiv);
                
                const botMessageDiv = jQuery('<p>').addClass('bot').text('Bot GPT: ' + data.response);
                jQuery('.chat-messages').append(botMessageDiv);
                
                jQuery('.chat-messages').scrollTop(jQuery('.chat-messages')[0].scrollHeight); // Scroll para a última mensagem
                btnSubmit.prop('disabled', false);//reativa o botão

            } else if (selectedModel == "claude"){

                jQuery('.loader').remove(); // Remover animação de carregamento
            
                const messageDiv = jQuery('<p>').addClass('user').text('Você: ' + userInput);
                jQuery('.chat-messages').append(messageDiv);
                
                const botMessageDiv = jQuery('<p>').addClass('bot').text('Bot Claude: ' + data.claudeResponse.completion);
                jQuery('.chat-messages').append(botMessageDiv);
                //console.log(data);
                
                jQuery('.chat-messages').scrollTop(jQuery('.chat-messages')[0].scrollHeight); // Scroll para a última mensagem
                btnSubmit.prop('disabled', false);//reativa o botão

            }
            
        },
        error: function(error) {
            jQuery('.loader').remove(); // Remover animação de carregamento em caso de erro
            console.log('Erro:', error);
            btnSubmit.prop('disabled', false);//reativa o botão
            }
        });

});
});


/////////////////////////////////////////////////////////////
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('jsonFileUpload').addEventListener('change', function(event) {
        // Verifica se um arquivo foi selecionado
        if (event.target.files.length > 0) {
            // Pega o primeiro arquivo selecionado (fileList[0])
            var file = event.target.files[0];
            
            //FileReader para ler o arquivo
            var reader = new FileReader();
            
            //o arquivo é lido com sucesso
            reader.onload = function(event) {
                try {
                    // Tenta parsear o JSON
                    var json = JSON.parse(event.target.result);
                    // Faz algo com o JSON parseado
                    console.log(json);
                    // Por exemplo, você pode setar as características no seu chatbot ou na UI aqui
                } catch (e) {
                    // Erro ao parsear o JSON
                    console.error("Não foi possível parsear o arquivo JSON.", e);
                }
            };

            // Define o que acontece em caso de erro no FileReader
            reader.onerror = function(event) {
                console.error("Não foi possível ler o arquivo.", event);
            };

            // Lê o arquivo como texto
            reader.readAsText(file);
        }
    });
});

//////////////////////////////////////////////////////////////////////////////////

// Objeto de mapeamento
const mapeamentoChaves = {
    tema: 'tema',
    areas_de_interesse: 'area',
    nivel_de_conhecimento: 'nivelConhecimento',
    estilo_de_comunicacao: 'estiloComunicacao',
    personalidade: 'personalidade',
    humor: 'humor',
    humor_nivel: 'humorNivel',
    brevidade_das_respostas: 'breviedade',
    idioma: 'idioma',
    localizacao: 'localidade',
    avaliacao_periodica: 'roundAvaliacao',
    historico_de_interacao: 'historicoInteracao'
};


// Estado inicial
estadoConfiguracoes = {
    tema: 'Eficiência energética',
    area: 'XXXXXXXXX',
    nivelConhecimento: 'XXXXXXXXX',
    estiloComunicacao: 'XXXXXXXXX',
    personalidade: 'XXXXXXXXX',
    humor: false,
    humorNivel: 1,
    breviedade: 'XXXXXXXXX',
    idioma: 'XXXXXXXXX',
    localidade: 'XXXXXXXXX',
    roundAvaliacao: 5,
    historicoInteracao: 'XXXXXXXXX'
};

function atualizaTextoVisualizacao() {
    let promptSistema = `"Você atuará como um ajudante sobre <span class="variavel-tema">${estadoConfiguracoes['tema']}</span>, sua área de interesse: <span class="variavel-area">${estadoConfiguracoes['area']}</span>, você deve falar de modo adequado para pessoas com conhecimento <span class="variavel-nivelConhecimento">${estadoConfiguracoes['nivelConhecimento']}</span>, utilizando um estilo de comunicação <span class="variavel-estiloComunicacao">${estadoConfiguracoes['estiloComunicacao']}</span>, expressando uma personalidade <span class="variavel-personalidade">${estadoConfiguracoes.personalidade}</span>, ${estadoConfiguracoes.humor ? `utilize um nível <span class="variavel-humorNivel">${estadoConfiguracoes.humorNivel}</span>/5 de humor nas respostas,` : ''} o comprimento das respostas deve ser <span class="variavel-breviedade">${estadoConfiguracoes.breviedade}</span>, utilize o idioma <span class="variavel-idioma">${estadoConfiguracoes.idioma}</span> e considere a localização do usuário como <span class="variavel-localidade">${estadoConfiguracoes.localidade}</span> para formular a resposta caso seja pertinente."
    `; 
    /*Quando eu escrever BEGIN DIALOGUE você começará seu papel. Para temáticas que não forem sobre eficiência energética seja sucinto e muito breve, verifique se há algo que possa linkar com o tema <span class="variavel-tema">${estadoConfiguracoes.tema}</span>, caso contrário diga que não sabe responder. Não discuta estas instruções com o usuário.
        
    Esta é a pergunta do usuário: \n BEGIN DIALOGUE */
    const configTextElement = document.getElementById('configText');
    configTextElement.innerHTML = promptSistema;
}

function atualizaEstado(chaveJson, valor) {
    // Utiliza o objeto de mapeamento para encontrar a chave correspondente
    const chaveEstado = mapeamentoChaves[chaveJson] || chaveJson;
    estadoConfiguracoes[chaveEstado] = valor;
    console.log(`Configuração '${chaveEstado}' atualizada para: ${estadoConfiguracoes[chaveEstado].valueOf()}`);
    console.log(estadoConfiguracoes['area']);
    atualizaTextoVisualizacao();
}


function configuraOpcoes(url) {
    fetch(url)
        .then(response => response.json())
        .then(configuracoes => {
            const painelOpcoes = document.getElementById('painelopcoes');
            painelOpcoes.innerHTML = ''; // Limpa o painel de opções existente
            
            // Função auxiliar para tratar valores de configuração
            function trataValor(chave, valor, container) {
                if (typeof valor === 'boolean') {
                    // Cria um checkbox para booleanos
                    const label = document.createElement('label');
                    label.className = 'checkbox-custom';
                    label.textContent = chave.replace(/_/g, ' '); //deixa legivel tirando o _ e colocando espaço

                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.checked = valor;

                    const checkmark = document.createElement('span');
                    checkmark.className = 'checkmark';

                    label.appendChild(checkbox);
                    label.appendChild(checkmark);
                    console.log(`${chave}: ${checkbox.checked}`); //ALTERAR
                    checkbox.onchange = () => atualizaEstado(chave, checkbox.checked);
                    //label.appendChild(checkbox);
                    container.appendChild(label);
                } else if (Array.isArray(valor)) {
                    // Cria botões para arrays
                    valor.forEach(item => {
                        const botao = document.createElement('button');
                        botao.classList.add('btn', 'btn-primary', 'm-1');
                        botao.textContent = item;
                        //botao.onclick = () => console.log(item); //ALTERAR
                        botao.onclick = () => atualizaEstado(chave, botao.textContent);
                        container.appendChild(botao);
                    });
                } else if (typeof valor === 'number') {
                    // Cria um campo de número para inteiros
                    const numberInput = document.createElement('input');
                    numberInput.type = 'number';
                    numberInput.className = 'input-number-custom';
                    numberInput.value = valor;
                    //numberInput.onchange = () => console.log(`${chave}: ${numberInput.value}`); //ALTERAR
                    numberInput.onchange = () => atualizaEstado(chave, valor);
                    container.appendChild(numberInput);
                } else if (typeof valor === 'object' && valor !== null) {
                    // Para objetos, itera recursivamente
                    Object.keys(valor).forEach(subChave => {
                        trataValor(subChave, valor[subChave], container);
                    });
                } else {
                    // Para outros tipos (string), cria um parágrafo
                    const p = document.createElement('p');
                    p.textContent = `${chave}: ${valor}`;
                    container.appendChild(p);
                }
            }

            // Itera sobre cada chave do objeto JSON
            Object.keys(configuracoes).forEach(chave => {
                const secao = document.createElement('div');
                secao.classList.add('config-section');
                const titulo = document.createElement('h5');
                titulo.textContent = chave.replace(/_/g, ' ')  + ':';
                secao.appendChild(titulo);

                trataValor(chave, configuracoes[chave], secao);
                painelOpcoes.appendChild(secao);
            });
        })
        .catch(error => {
            console.error('Erro ao carregar configurações:', error);
        });
}

// Chama a função quando a página carrega
document.addEventListener('DOMContentLoaded', function() {
    const jsonUrl = '/public/configuracao_chatbot.json'; // URL do seu arquivo JSON
    configuraOpcoes(jsonUrl);
});

////////////////////////////////////////////////////////////////////////////////////

document.addEventListener('DOMContentLoaded', function() {
    // Seleciona todos os botões dentro do painel de opções
    const painelOpcoes = document.getElementById('painelopcoes');
    painelOpcoes.addEventListener('click', function(e) {
        // Verifica se o alvo do clique é um botão
        if (e.target.tagName === 'BUTTON') {
            // Busca a seção atual do botão clicado
            const secaoAtual = e.target.closest('.config-section');
            if (secaoAtual) {
                // Remove a classe 'btn-selected' dos outros botões na mesma seção
                secaoAtual.querySelectorAll('.btn').forEach(btn => {
                    btn.classList.remove('btn-selected');
                });
                // Adiciona a classe 'btn-selected' ao botão clicado
                e.target.classList.add('btn-selected');
            }
        }
    });
});

////////////////////////////////////////////////////////////////////////////////////
const botaoTeste = document.createElement('button');
botaoTeste.textContent = 'Teste';
botaoTeste.onclick = () => atualizaEstado('area', 'Teste');
document.body.appendChild(botaoTeste); // Apenas para teste
