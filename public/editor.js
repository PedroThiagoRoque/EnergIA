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

function configuraPrompt(prompt) {

}
