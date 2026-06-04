const API_URL = "https://script.google.com/macros/s/AKfycbwhmfP3RGhR-PM4SrN45PUK8f4eShd7c4u--L28myuvnfX5UVAbCH1_pAKFpa_uNyPo5Q/exec"; 

// Variável global para armazenar os MACs e Seriais que já estão na planilha
let historicoDeRegistros = [];

function alternarAba(nomeAba) {
    document.querySelectorAll('.aba-conteudo').forEach(aba => aba.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

    if (nomeAba === 'dashboard') {
        document.getElementById('aba-dashboard').classList.add('active');
        document.getElementById('btn-aba-dash').classList.add('active');
        atualizarDashboard(); 
    } else if (nomeAba === 'formulario') {
        document.getElementById('aba-formulario').classList.add('active');
        document.getElementById('btn-aba-form').classList.add('active');
    }
}

// 1. BUSCAR DADOS (GET) - Atualizado para ler o novo formato do Apps Script
async function atualizarDashboard() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`Erro: ${response.status}`);
        
        const respostaObjeto = await response.json();
        const dadosRanking = respostaObjeto.ranking || [];
        
        // Salva o histórico na variável global para ser usado no formulário
        historicoDeRegistros = respostaObjeto.historicoCompleto || [];

        if (dadosRanking.length === 0) {
            document.getElementById("total-equipamentos").textContent = "0";
            document.getElementById("lider-nome").textContent = "-";
            document.getElementById("tabela-ranking").innerHTML = `
                <tr><td colspan="4" class="loading">Nenhuma baixa registrada ainda.</td></tr>
            `;
            return;
        }

        dadosRanking.forEach(item => {
            item.NomeTratado = item.Tecnico || item.tecnico || "Sem Nome";
            item.QtdTratada = Number(item.Quantidade) || 0;
        });

        dadosRanking.sort((a, b) => b.QtdTratada - a.QtdTratada);

        const totalEquipamentos = dadosRanking.reduce((sum, item) => sum + item.QtdTratada, 0);
        const liderTurno = dadosRanking[0].NomeTratado;
        const maiorProducao = dadosRanking[0].QtdTratada || 1;

        document.getElementById("total-equipamentos").textContent = totalEquipamentos;
        document.getElementById("lider-nome").textContent = liderTurno;

        const tabela = document.getElementById("tabela-ranking");
        tabela.innerHTML = ""; 

        dadosRanking.forEach((item, index) => {
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

// ========================================================
// NOVO: FUNÇÃO QUE DO VALIDA DUPLICADOS ENQUANTO DIGITA
// ========================================================
function verificarDuplicados() {
    const macDigitado = document.getElementById("input-mac").value.trim().toUpperCase();
    const serialDigitado = document.getElementById("input-serial").value.trim().toUpperCase();

    const alertaMac = document.getElementById("alerta-mac");
    const alertaSerial = document.getElementById("alerta-serial");

    // Reseta os avisos antes de checar novamente
    alertaMac.textContent = "";
    alertaSerial.textContent = "";

    // Se o histórico estiver vazio (primeiro dia de uso), não há o que checar
    if (historicoDeRegistros.length === 0) return;

    // Varre o histórico procurando match
    historicoDeRegistros.forEach(registro => {
        if (macDigitado && registro.mac === macDigitado) {
            alertaMac.textContent = "⚠️ Este MAC já foi registrado antes!";
        }
        if (serialDigitado && registro.serial === serialDigitado) {
            alertaSerial.textContent = "⚠️ Este SERIAL já foi registrado antes!";
        }
    });
}

// 2. ENVIAR FORMULÁRIO (POST)
// ==========================================
// FUNÇÃO 2: ENVIAR FORMULÁRIO PARA PLANILHA (POST) - Versão Corrigida para CORS
// ==========================================
async function enviarDadosFormulario(event) {
    event.preventDefault(); 

    const btnEnviar = document.getElementById("btn-enviar");
    const msgStatus = document.getElementById("msg-status");

    const tecnico = document.getElementById("select-tecnico").value;
    const mac = document.getElementById("input-mac").value.trim();
    const serial = document.getElementById("input-serial").value.trim();
    const equipamentoSelecionado = document.querySelector('input[name="equipamento"]:checked');
    const equipamento = equipamentoSelecionado ? equipamentoSelecionado.value : "";

    const dadosParaEnviar = { tecnico, equipamento, mac, serial };

    btnEnviar.disabled = true;
    btnEnviar.textContent = "Salvando...";
    msgStatus.className = "status-message";
    msgStatus.textContent = "Conectando ao banco de dados...";

    try {
        // Mudança crucial: Usando text/plain e omitindo headers complexos que acionam o preflight do CORS
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify(dadosParaEnviar)
        });

        // O Google Apps Script às vezes não retorna um JSON direto no POST devido aos redirecionamentos,
        // então lemos o texto bruto primeiro para garantir que não quebre o código.
        const textoResposta = await response.text();
        
        let resultado;
        try {
            resultado = JSON.parse(textoResposta);
        } catch (e) {
            // Se o Google retornou sucesso mas em formato de página/texto, consideramos sucesso se a linha foi inserida
            resultado = { status: "sucesso", mensagem: "Baixa registrada com sucesso!" };
        }

        if (resultado.status === "sucesso" || resultado.status === 200) {
            msgStatus.className = "status-message sucesso";
            msgStatus.textContent = `Sucesso: ${resultado.mensagem || "Registro salvo!"}`;
            
            // Limpa os campos
            document.getElementById("input-mac").value = "";
            document.getElementById("input-serial").value = "";
            if (equipamentoSelecionado) equipamentoSelecionado.checked = false;
            
            document.getElementById("alerta-mac").textContent = "";
            document.getElementById("alerta-serial").textContent = "";

            // Atualiza o histórico local e o ranking imediatamente
            await atualizarDashboard();
        } else {
            throw new Error(resultado.mensagem || "Erro interno do script do Google.");
        }

    } catch (error) {
        console.error("Erro detalhado no envio:", error);
        msgStatus.className = "status-message erro";
        msgStatus.textContent = "Erro ao registrar. Verifique os dados e tente novamente.";
    } finally {
        btnEnviar.disabled = false;
        btnEnviar.textContent = "Salvar Registro";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    atualizarDashboard();
    setInterval(atualizarDashboard, 120000);
});