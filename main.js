// 1. Cole aqui a URL gerada na última implantação do seu Google Apps Script
const API_URL = "https://script.google.com/macros/s/AKfycbxxDvX_5po_IiWbCNmI12Lm8Mfja0xIhKnDc_cctZmT2GMH9_F2VKnG8MREkrOvlm7ouQ/exec"; 

// ==========================================
// CONTROLE DE NAVEGAÇÃO (ABAS DO SITE)
// ==========================================
function alternarAba(nomeAba) {
    // Remove a classe ativa de todas as abas e botões
    document.querySelectorAll('.aba-conteudo').forEach(aba => aba.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

    // Ativa a aba e o botão selecionados
    if (nomeAba === 'dashboard') {
        document.getElementById('aba-dashboard').classList.add('active');
        document.getElementById('btn-aba-dash').classList.add('active');
        atualizarDashboard(); // Recarrega os dados do ranking ao voltar para a aba
    } else if (nomeAba === 'formulario') {
        document.getElementById('aba-formulario').classList.add('active');
        document.getElementById('btn-aba-form').classList.add('active');
    }
}

// ==========================================
// FUNÇÃO 1: BUSCAR DADOS E GERAR RANKING (GET)
// ==========================================
async function atualizarDashboard() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`Erro: ${response.status}`);
        
        const dados = await response.json();

        // Se a planilha estiver zerada
        if (!dados || dados.length === 0) {
            document.getElementById("total-equipamentos").textContent = "0";
            document.getElementById("lider-nome").textContent = "-";
            document.getElementById("tabela-ranking").innerHTML = `
                <tr><td colspan="4" class="loading">Nenhuma baixa registrada ainda.</td></tr>
            `;
            return;
        }

        // Como o Apps Script já envia os dados contados e somados, apenas tratamos maiúsculas/minúsculas
        dados.forEach(item => {
            item.NomeTratado = item.Tecnico || item.tecnico || "Sem Nome";
            item.QtdTratada = Number(item.Quantidade) || 0;
        });

        // Ordena o ranking: maior produtor no topo
        dados.sort((a, b) => b.QtdTratada - a.QtdTratada);

        // Calcula KPIs básicos
        const totalEquipamentos = dados.reduce((sum, item) => sum + item.QtdTratada, 0);
        const liderTurno = dados[0].NomeTratado;
        const maiorProducao = dados[0].QtdTratada || 1;

        // Injeta nos elementos do HTML
        document.getElementById("total-equipamentos").textContent = totalEquipamentos;
        document.getElementById("lider-nome").textContent = liderTurno;

        // Renderiza as linhas do ranking
        const tabela = document.getElementById("tabela-ranking");
        tabela.innerHTML = ""; 

        dados.forEach((item, index) => {
            const posicao = index + 1;
            const classePosicao = posicao <= 3 ? `pos-${posicao}` : "";
            const percentual = ((item.QtdTratada / maiorProducao) * 100).toFixed(0);

            const row = document.createElement("tr");
            row.innerHTML = `
                <td class="${classePosicao}">#${posicao}</td>
                <td><strong>${item.NomeTratado}</strong></td>
                <td>${item.QtdTratada} un</td>
                <td>
                    <div class="progress-bar-container" title="${percentual}% do líder">
                        <div class="progress-bar" style="width: ${percentual}%"></div>
                    </div>
                </td>
            `;
            tabela.appendChild(row);
        });

    } catch (error) {
        console.error("Erro ao atualizar painel:", error);
    }
}

// ==========================================
// FUNÇÃO 2: ENVIAR FORMULÁRIO PARA PLANILHA (POST)
// ==========================================
async function enviarDadosFormulario(event) {
    event.preventDefault(); // Impede a página de dar recarga (F5) ao enviar

    const btnEnviar = document.getElementById("btn-enviar");
    const msgStatus = document.getElementById("msg-status");

    // Captura os elementos e valores do formulário
    const tecnico = document.getElementById("select-tecnico").value;
    const mac = document.getElementById("input-mac").value.trim();
    const serial = document.getElementById("input-serial").value.trim();
    
    // Captura o rádio button selecionado do Equipamento
    const equipamentoSelecionado = document.querySelector('input[name="equipamento"]:checked');
    const equipamento = equipamentoSelecionado ? equipamentoSelecionado.value : "";

    // Objeto com os dados exatamente mapeados para o doPost da planilha
    const dadosParaEnviar = {
        tecnico: tecnico,
        equipamento: equipamento,
        mac: mac,
        serial: serial
    };

    // Bloqueia o botão para evitar cliques duplos durante o envio
    btnEnviar.disabled = true;
    btnEnviar.textContent = "Salvando...";
    msgStatus.className = "status-message";
    msgStatus.textContent = "Conectando ao banco de dados...";

    try {
        // Envia os dados para a URL do Google Apps Script usando o método POST
        const response = await fetch(API_URL, {
            method: "POST",
            mode: "cors", // Evita problemas de bloqueio de segurança entre domínios diferentes
            headers: {
                "Content-Type": "text/plain;charset=utf-8" // O Google Apps Script prefere receber texto puro e fazer o parse manual
            },
            body: JSON.stringify(dadosParaEnviar)
        });

        const resultado = await response.json();

        if (resultado.status === "sucesso") {
            // Feedback visual positivo
            msgStatus.className = "status-message sucesso";
            msgStatus.textContent = `Sucesso: ${resultado.mensagem}`;
            
            // Limpa os campos de MAC, Serial e Checkbox para a próxima baixa
            document.getElementById("input-mac").value = "";
            document.getElementById("input-serial").value = "";
            if (equipamentoSelecionado) equipamentoSelecionado.checked = false;

        } else {
            throw new Error(resultado.mensagem);
        }

    } catch (error) {
        // Feedback visual de erro
        console.error("Erro ao enviar dados:", error);
        msgStatus.className = "status-message erro";
        msgStatus.textContent = "Erro ao registrar. Tente novamente.";
    } finally {
        // Reativa o botão do formulário
        btnEnviar.disabled = false;
        btnEnviar.textContent = "Salvar Registro";
    }
}

// ==========================================
// INICIALIZAÇÃO AUTOMÁTICA
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // Inicializa a primeira tela buscando o ranking
    atualizarDashboard();
    
    // Mantém o ranking se atualizando sozinho de fundo a cada 2 minutos
    setInterval(atualizarDashboard, 120000);
});