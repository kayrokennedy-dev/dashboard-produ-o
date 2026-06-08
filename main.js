const API_URL = "https://script.google.com/macros/s/AKfycbzDNPNaf1-EvZLNUJZWGJ_IaRkhJet7vxhsulNdQOaafksza_H8OK_28yg-Jt6Qk9CZ3A/exec"; 

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

// 1. CARREGAR DASHBOARD (GET)
async function atualizarDashboard() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`Erro: ${response.status}`);
        
        const respostaObjeto = await response.json();
        const dadosRanking = respostaObjeto.ranking || [];
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

// ==========================================
// FUNÇÕES DE MANIPULAÇÃO DO LOTE DINÂMICO
// ==========================================

function adicionarLinhaEquipamento() {
    const container = document.getElementById("container-lote-equipamentos");
    
    const novaLinha = document.createElement("div");
    novaLinha.className = "linha-equipamento-lote";
    novaLinha.innerHTML = `
        <input type="text" class="input-mac-lote" placeholder="MAC (Ex: 00:1A:3F...)" required oninput="verificarDuplicadosEmLote()">
        <input type="text" class="input-serial-lote" placeholder="SERIAL NUMBER" required oninput="verificarDuplicadosEmLote()">
        <button type="button" class="btn-remover-linha" onclick="removerLinhaEquipamento(this)">✕</button>
    `;
    
    container.appendChild(novaLinha);
}

function removerLinhaEquipamento(botao) {
    const container = document.getElementById("container-lote-equipamentos");
    // Garante que o usuário não delete a última linha restante
    if (container.children.length > 1) {
        botao.parentElement.remove();
        verificarDuplicadosEmLote();
    }
}

// Varre todos os inputs dinâmicos abertos comparando com a planilha
function verificarDuplicadosEmLote() {
    const inputsMac = document.querySelectorAll(".input-mac-lote");
    const inputsSerial = document.querySelectorAll(".input-serial-lote");

    // Limpa estilos de alerta anteriores
    inputsMac.forEach(input => input.style.borderColor = "");
    inputsSerial.forEach(input => input.style.borderColor = "");

    if (historicoDeRegistros.length === 0) return;

    // Valida MACs
    inputsMac.forEach(input => {
        const val = input.value.trim().toUpperCase();
        if (val && historicoDeRegistros.some(r => r.mac === val)) {
            input.style.borderColor = "#f59e0b"; // Borda laranja de aviso
        }
    });

    // Valida Seriais
    inputsSerial.forEach(input => {
        const val = input.value.trim().toUpperCase();
        if (val && historicoDeRegistros.some(r => r.serial === val)) {
            input.style.borderColor = "#f59e0b";
        }
    });
}

// ==========================================
// 2. ENVIAR FORMULÁRIO EM LOTE (POST)
// ==========================================
async function enviarDadosFormulario(event) {
    event.preventDefault();

    const btnEnviar = document.getElementById("btn-enviar");
    const msgStatus = document.getElementById("msg-status");

    const tecnico = document.getElementById("select-tecnico").value;
    const equipamentoSelecionado = document.querySelector('input[name="equipamento"]:checked');
    const equipamento = equipamentoSelecionado ? equipamentoSelecionado.value : "";

    // Captura os defeitos
    const checkboxesDefeitos = document.querySelectorAll('input[name="defeito"]:checked');
    let defeitosSelecionados = [];
    checkboxesDefeitos.forEach(cb => defeitosSelecionados.push(cb.value));
    const defeitosTexto = defeitosSelecionados.length > 0 ? defeitosSelecionados.join(", ") : "Não especificado";

    // Pega todas as linhas de MAC e Serial criadas na tela
    const linhasMac = document.querySelectorAll(".input-mac-lote");
    const linhasSerial = document.querySelectorAll(".input-serial-lote");

    // Cria a Array contendo um objeto para cada linha preenchida
    let loteParaEnviar = [];
    for (let i = 0; i < linhasMac.length; i++) {
        loteParaEnviar.push({
            tecnico: tecnico,
            equipamento: equipamento,
            mac: linhasMac[i].value.trim(),
            serial: linhasSerial[i].value.trim(),
            defeitos: defeitosTexto
        });
    }

    btnEnviar.disabled = true;
    btnEnviar.textContent = "Salvando Lote...";
    msgStatus.className = "status-message";
    msgStatus.textContent = `Enviando ${loteParaEnviar.length} equipamentos...`;

    try {
        // Faz o POST enviando a Array completa dentro do Body
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify(loteParaEnviar)
        });

        const resultado = await response.json();

        if (resultado.status === "sucesso") {
            msgStatus.className = "status-message sucesso";
            msgStatus.textContent = `Sucesso: ${resultado.mensagem}`;
            
            // Reseta o container de lotes deixando apenas uma linha limpa
            const container = document.getElementById("container-lote-equipamentos");
            container.innerHTML = `
                <div class="linha-equipamento-lote">
                    <input type="text" class="input-mac-lote" placeholder="MAC (Ex: 00:1A:3F...)" required oninput="verificarDuplicadosEmLote()">
                    <input type="text" class="input-serial-lote" placeholder="SERIAL NUMBER" required oninput="verificarDuplicadosEmLote()">
                    <button type="button" class="btn-remover-linha" onclick="removerLinhaEquipamento(this)">✕</button>
                </div>
            `;

            // Limpa defeitos e equipamento selecionado
            if (equipamentoSelecionado) equipamentoSelecionado.checked = false;
            checkboxesDefeitos.forEach(cb => cb.checked = false);

            // Atualiza o ranking global na hora
            await atualizarDashboard();
        } else {
            throw new Error(resultado.mensagem);
        }

    } catch (error) {
        console.error("Erro no envio do lote:", error);
        msgStatus.className = "status-message erro";
        msgStatus.textContent = "Erro ao registrar o lote. Tente novamente.";
    } finally {
        btnEnviar.disabled = false;
        btnEnviar.textContent = "Salvar Registro";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    atualizarDashboard();
    setInterval(atualizarDashboard, 120000);
});