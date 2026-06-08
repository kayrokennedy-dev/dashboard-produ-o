let meuGraficoPizza = null; // Guarda o gráfico para podermos destruí-lo e recriá-lo ao atualizar
const API_URL = "https://script.google.com/macros/s/AKfycbw-qaK5-ysKd09NTU-a9rBACdjGelFWl98jxMTf_qAQMiiOuVVqwxbUi04v12FYEMn7jQ/exec"; 

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

// 1. CARREGAR DASHBOARD COM MÉTRICAS AVANÇADAS E GRÁFICO DE PIZZA (GET)
async function atualizarDashboard() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`Erro: ${response.status}`);
        
        const respostaObjeto = await response.json();
        const historicoCompleto = respostaObjeto.historicoCompleto || [];
        historicoDeRegistros = historicoCompleto;

        if (historicoCompleto.length === 0) {
            document.getElementById("prod-diaria").textContent = "0";
            document.getElementById("prod-quinzenal").textContent = "0";
            document.getElementById("prod-mensal").textContent = "0";
            document.getElementById("total-equipamentos").textContent = "0";
            document.getElementById("tabela-ranking").innerHTML = `
                <tr><td colspan="6" class="loading">Nenhuma baixa registrada ainda.</td></tr>
            `;
            return;
        }

        // Configuração dos tempos
        const agora = new Date();
        const hojeInicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();
        
        const limite15Dias = new Date();
        limite15Dias.setDate(agora.getDate() - 15);
        const tempo15 = limite15Dias.getTime();
        
        const limite30Dias = new Date();
        limite30Dias.setDate(agora.getDate() - 30);
        const tempo30 = limite30Dias.getTime();

        // Totais Gerais
        let totalHoje = 0;
        let total15 = 0;
        let total30 = 0;

        // Contadores específicos de equipamentos para HOJE
        let qtdOntHoje = 0;
        let qtdOnuHoje = 0;
        let qtdRoteadorHoje = 0;

        // Objeto organizador por Técnico
        const estatisticasTecnicos = {};

        historicoCompleto.forEach(registro => {
            const nome = registro.tecnico || registro.Tecnico || "Sem Nome";
            if (!registro.data) return;

            const dataReg = new Date(registro.data).getTime();

            if (!estatisticasTecnicos[nome]) {
                estatisticasTecnicos[nome] = { nome: nome, totalGeral: 0, hoje: 0, ultimos15: 0, ultimos30: 0 };
            }

            estatisticasTecnicos[nome].totalGeral += 1;

            // Filtros de tempo gerais
            if (dataReg >= hojeInicio) {
                totalHoje++;
                estatisticasTecnicos[nome].hoje++;

                // Métrica específica de Equipamentos de HOJE
                // Força o texto para maiúsculo para evitar erros de digitação (Ex: ont, Ont, ONT)
                const equipStr = String(registro.equipamento || "").toUpperCase();
                
                if (equipStr.includes("ONT")) {
                    qtdOntHoje++;
                } else if (equipStr.includes("ONU")) {
                    qtdOnuHoje++;
                } else if (equipStr.includes("ROTEADOR") || equipStr.includes("ROTEADORES")) {
                    qtdRoteadorHoje++;
                }
            }
            if (dataReg >= tempo15) {
                total15++;
                estatisticasTecnicos[nome].ultimos15++;
            }
            if (dataReg >= tempo30) {
                total30++;
                estatisticasTecnicos[nome].ultimos30++;
            }
        });

        // Atualiza os Cards de Produção Geral no topo
        document.getElementById("prod-diaria").textContent = totalHoje;
        document.getElementById("prod-quinzenal").textContent = total15;
        document.getElementById("prod-mensal").textContent = total30;
        document.getElementById("total-equipamentos").textContent = historicoCompleto.length;

        // Atualiza os mini-cards de equipamentos de hoje
        document.getElementById("qtd-ont-hoje").textContent = qtdOntHoje;
        document.getElementById("qtd-onu-hoje").textContent = qtdOnuHoje;
        document.getElementById("qtd-roteador-hoje").textContent = qtdRoteadorHoje;

        // ==========================================
        // RENDERIZAÇÃO / ATUALIZAÇÃO DO GRÁFICO DE PIZZA
        // ==========================================
        const ctx = document.getElementById('graficoPizzaEquipamentos').getContext('2d');
        
        // Se o gráfico já existia de uma atualização anterior, destrói para não duplicar na tela
        if (meuGraficoPizza !== null) {
            meuGraficoPizza.destroy();
        }

        // Cria a nova instância do gráfico com os dados contados de hoje
        meuGraficoPizza = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['ONTs', 'ONUs', 'Roteadores'],
                datasets: [{
                    data: [qtdOntHoje, qtdOnuHoje, qtdRoteadorHoje],
                    backgroundColor: [
                        '#3b82f6', // Azul para ONT
                        '#10b981', // Verde para ONU
                        '#f59e0b'  // Laranja para Roteador
                    ],
                    borderWidth: 1,
                    borderColor: 'var(--border)'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#9ca3af', // Cor cinza suave para os nomes da legenda combinando com o tema escuro
                            font: { family: 'sans-serif', size: 12 }
                        }
                    }
                }
            }
        });

        // ==========================================
        // RENDERIZAÇÃO DA TABELA DO RANKING
        // ==========================================
        const listaOrdenada = Object.values(estatisticasTecnicos);
        listaOrdenada.sort((a, b) => b.totalGeral - a.totalGeral);

        const tabela = document.getElementById("tabela-ranking");
        tabela.innerHTML = "";

        listaOrdenada.forEach((tecnico, index) => {
            const posicao = index + 1;
            const classePosicao = posicao <= 3 ? `pos-${posicao}` : "";

            const mediaDiaria = tecnico.hoje.toFixed(1);
            const mediaQuinzenal = (tecnico.ultimos15 / 15).toFixed(1);
            const mediaMensal = (tecnico.ultimos30 / 30).toFixed(1);

            const row = document.createElement("tr");
            row.innerHTML = `
                <td class="${classePosicao}">#${posicao}</td>
                <td><strong>${tecnico.nome}</strong></td>
                <td>${tecnico.totalGeral} un</td>
                <td>${mediaDiaria} un/dia</td>
                <td>${mediaQuinzenal} un/dia</td>
                <td>${mediaMensal} un/dia</td>
            `;
            tabela.appendChild(row);
        });

    } catch (error) {
        console.error("Erro ao atualizar painel de métricas:", error);
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