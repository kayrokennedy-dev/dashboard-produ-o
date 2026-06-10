let meuGraficoPizza = null; // Guarda o gráfico para podermos destruí-lo e recriá-lo ao atualizar
let meuGraficoBarras = null; // NOVO: Guarda a instância do gráfico de barras horizontal
const API_URL = "https://script.google.com/macros/s/AKfycbzWT2Rf0LBGA_-2m6aXYTWrUmCMcXk7FHWpHcNWrIMU9dQ4E_Fb0u5WTfPIJXCkmxCfHQ/exec"; 

let historicoDeRegistros = [];
let filtroGraficoAtual = 'hoje'; 

function alternarAba(nomeAba) {
    // 1. Esconde todas as abas de conteúdo
    document.querySelectorAll('.aba-conteudo').forEach(aba => {
        aba.classList.remove('active');
    });

    // 2. Remove o destaque visual de todos os botões do topo
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // 3. Mostra a aba clicada e acende o botão correspondente
    if (nomeAba === 'dashboard') {
        document.getElementById('aba-dashboard').classList.add('active');
        document.getElementById('btn-aba-dash').classList.add('active');
        atualizarDashboard(); 
    } else if (nomeAba === 'ranking') {
        document.getElementById('aba-ranking').classList.add('active');
        document.getElementById('btn-aba-ranking').classList.add('active');
        atualizarDashboard(); 
    } else if (nomeAba === 'formulario') {
        document.getElementById('aba-formulario').classList.add('active');
        document.getElementById('btn-aba-form').classList.add('active');
    }
}

// 1. CARREGAR DASHBOARD COM MÉTRICAS AVANÇADAS E GRÁFICOS (GET)
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

        // ==========================================
        // CONFIGURAÇÃO DOS MARCOS TEMPORAIS (DATAS)
        // ==========================================
        const agora = new Date();
        const hojeStringLocal = agora.toLocaleDateString('pt-BR');
        
        const limite15Dias = new Date();
        limite15Dias.setDate(agora.getDate() - 15);
        const tempo15 = limite15Dias.getTime();
        
        const limite30Dias = new Date();
        limite30Dias.setDate(agora.getDate() - 30);
        const tempo30 = limite30Dias.getTime();

        let totalHoje = 0;
        let total15 = 0;
        let total30 = 0;

        let qtdOntFiltrado = 0;
        let qtdOnuFiltrado = 0;
        let qtdRoteadorFiltrado = 0;

        const estatisticasTecnicos = {};

        historicoCompleto.forEach(registro => {
            const nome = registro.tecnico || registro.Tecnico || "Sem Nome";
            if (!registro.data) return;

            let dataObjeto = new Date(registro.data);
            if (isNaN(dataObjeto.getTime())) {
                const dataFormatada = String(registro.data).replace(" ", "T");
                dataObjeto = new Date(dataFormatada);
            }

            const dataReg = dataObjeto.getTime();
            if (isNaN(dataReg)) return;

            const dataRegistroStringLocal = dataObjeto.toLocaleDateString('pt-BR');

            if (!estatisticasTecnicos[nome]) {
                estatisticasTecnicos[nome] = { nome: nome, totalGeral: 0, hoje: 0, ultimos15: 0, ultimos30: 0 };
            }

            estatisticasTecnicos[nome].totalGeral += 1;

            if (dataRegistroStringLocal === hojeStringLocal) {
                totalHoje++;
                estatisticasTecnicos[nome].hoje++;
            }
            if (dataReg >= tempo15) {
                total15++;
                estatisticasTecnicos[nome].ultimos15++;
            }
            if (dataReg >= tempo30) {
                total30++;
                estatisticasTecnicos[nome].ultimos30++;
            }

            let incluirNoGrafico = false;

            if (filtroGraficoAtual === 'hoje' && dataRegistroStringLocal === hojeStringLocal) {
                incluirNoGrafico = true;
            } else if (filtroGraficoAtual === '15dias' && dataReg >= tempo15) {
                incluirNoGrafico = true;
            } else if (filtroGraficoAtual === '30dias' && dataReg >= tempo30) {
                incluirNoGrafico = true;
            } else if (filtroGraficoAtual === 'customizado') {
                const inputData = document.getElementById('filtro-data-especifica').value; 
                if (inputData) {
                    const [ano, mes, dia] = inputData.split('-');
                    const dataCalendarioStringLocal = `${dia}/${mes}/${ano}`;
                    if (dataRegistroStringLocal === dataCalendarioStringLocal) {
                        incluirNoGrafico = true;
                    }
                }
            }

            if (incluirNoGrafico) {
                const equipRaw = registro.equipamento || "";
                const equipStr = String(equipRaw).toUpperCase();

                if (equipStr.includes("ROTEADOR") || equipStr.includes("ROTEADORES")) {
                    qtdRoteadorFiltrado++;
                } else if (equipStr.includes("ONT")) {
                    qtdOntFiltrado++;
                } else if (equipStr.includes("ONU")) {
                    qtdOnuFiltrado++;
                }
            }
        });

        // Atualiza os Cards de Produção Geral (elementos agora ficam na aba de ranking no HTML)
        const elProdDiaria = document.getElementById("prod-diaria");
        const elProdQuinzenal = document.getElementById("prod-quinzenal");
        const elProdMensal = document.getElementById("prod-mensal");
        const elTotalEquip = document.getElementById("total-equipamentos");

        if (elProdDiaria) elProdDiaria.textContent = totalHoje;
        if (elProdQuinzenal) elProdQuinzenal.textContent = total15;
        if (elProdMensal) elProdMensal.textContent = total30;
        if (elTotalEquip) elTotalEquip.textContent = historicoCompleto.length;

        // Atualiza os mini-cards de aparelhos
        document.getElementById("qtd-ont-hoje").textContent = qtdOntFiltrado;
        document.getElementById("qtd-onu-hoje").textContent = qtdOnuFiltrado;
        document.getElementById("qtd-roteador-hoje").textContent = qtdRoteadorFiltrado;

        // Gera e ordena a lista de técnicos de forma decrescente para o Ranking e para o Gráfico de Barras
        const listaOrdenada = Object.values(estatisticasTecnicos);
        listaOrdenada.sort((a, b) => b.totalGeral - a.totalGeral);

        // ==========================================
        // NOVO: RENDERIZAÇÃO DO GRÁFICO DE BARRAS HORIZONTAL
        // ==========================================
        const canvasBarras = document.getElementById('graficoBarrasTecnicos');
        if (canvasBarras) {
            const ctxBarras = canvasBarras.getContext('2d');
            if (meuGraficoBarras !== null) meuGraficoBarras.destroy();

            // Mapeia os dados decrescentes obtidos da listaOrdenada
            const labelsTecnicos = listaOrdenada.map(t => t.nome);
            const dadosTotais = listaOrdenada.map(t => t.totalGeral);

            meuGraficoBarras = new Chart(ctxBarras, {
                type: 'bar',
                data: {
                    labels: labelsTecnicos,
                    datasets: [{
                        label: 'Equipamentos Concluídos',
                        data: dadosTotais,
                        backgroundColor: '#3b82f6', // Cor azul combinando com o tema
                        borderRadius: 4,
                        borderWidth: 0
                    }]
                },
                options: {
                    indexAxis: 'y', // DEFINE O GRÁFICO COMO HORIZONTAL
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false } // Esconde legenda já que é uma métrica única
                    },
                    scales: {
                        x: {
                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                            ticks: { color: '#9ca3af' }
                        },
                        y: {
                            grid: { display: false },
                            ticks: { color: '#ffffff', font: { weight: 'bold' } }
                        }
                    }
                }
            });
        }

        // ==========================================
        // RENDERIZAÇÃO / ATUALIZAÇÃO DO GRÁFICO DE PIZZA
        // ==========================================
        const canvasElement = document.getElementById('graficoPizzaEquipamentos');
        if (canvasElement) {
            const ctx = canvasElement.getContext('2d');
            if (meuGraficoPizza !== null) meuGraficoPizza.destroy();

            const temDadosFiltrados = (qtdOntFiltrado + qtdOnuFiltrado + qtdRoteadorFiltrado) > 0;

            meuGraficoPizza = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: ['ONTs', 'ONUs', 'Roteadores'],
                    datasets: [{
                        data: temDadosFiltrados ? [qtdOntFiltrado, qtdOnuFiltrado, qtdRoteadorFiltrado] : [1, 1, 1],
                        backgroundColor: temDadosFiltrados ? ['#3b82f6', '#10b981', '#f59e0b'] : ['#374151', '#374151', '#374151'], 
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.1)'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false, 
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { color: '#9ca3af', font: { family: 'sans-serif', size: 12 } }
                        }
                    }
                }
            });
        }

        // ==========================================
        // RENDERIZAÇÃO DA TABELA DO RANKING
        // ==========================================
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
    if (container.children.length > 1) {
        botao.parentElement.remove();
        verificarDuplicadosEmLote();
    }
}

function verificarDuplicadosEmLote() {
    const inputsMac = document.querySelectorAll(".input-mac-lote");
    const inputsSerial = document.querySelectorAll(".input-serial-lote");

    inputsMac.forEach(input => input.style.borderColor = "");
    inputsSerial.forEach(input => input.style.borderColor = "");

    if (historicoDeRegistros.length === 0) return;

    inputsMac.forEach(input => {
        const val = input.value.trim().toUpperCase();
        if (val && historicoDeRegistros.some(r => r.mac === val)) {
            input.style.borderColor = "#f59e0b"; 
        }
    });

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

    const checkboxesDefeitos = document.querySelectorAll('input[name="defeito"]:checked');
    let defeitosSelecionados = [];
    checkboxesDefeitos.forEach(cb => defeitosSelecionados.push(cb.value));
    const defeitosTexto = defeitosSelecionados.length > 0 ? defeitosSelecionados.join(", ") : "Não especificado";

    const linhasMac = document.querySelectorAll(".input-mac-lote");
    const linesSerial = document.querySelectorAll(".input-serial-lote");

    let loteParaEnviar = [];
    for (let i = 0; i < linhasMac.length; i++) {
        loteParaEnviar.push({
            tecnico: tecnico,
            equipamento: equipamento,
            mac: linhasMac[i].value.trim(),
            serial: linesSerial[i].value.trim(),
            defeitos: defeitosTexto
        });
    }

    btnEnviar.disabled = true;
    btnEnviar.textContent = "Salvando Lote...";
    msgStatus.className = "status-message";
    msgStatus.textContent = `Enviando ${loteParaEnviar.length} equipamentos...`;

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify(loteParaEnviar)
        });

        const resultado = await response.json();

        if (resultado.status === "sucesso") {
            msgStatus.className = "status-message sucesso";
            msgStatus.textContent = `Sucesso: ${resultado.mensagem}`;
            
            const container = document.getElementById("container-lote-equipamentos");
            container.innerHTML = `
                <div class="linha-equipamento-lote">
                    <input type="text" class="input-mac-lote" placeholder="MAC (Ex: 00:1A:3F...)" required oninput="verificarDuplicadosEmLote()">
                    <input type="text" class="input-serial-lote" placeholder="SERIAL NUMBER" required oninput="verificarDuplicadosEmLote()">
                    <button type="button" class="btn-remover-linha" onclick="removerLinhaEquipamento(this)">✕</button>
                </div>
            `;

            if (equipamentoSelecionado) equipamentoSelecionado.checked = false;
            checkboxesDefeitos.forEach(cb => cb.checked = false);

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

function mudarPeriodoGrafico(tipoFiltro) {
    filtroGraficoAtual = tipoFiltro;
    
    document.getElementById('btn-filtro-hoje').classList.remove('active');
    document.getElementById('btn-filtro-15').classList.remove('active');
    document.getElementById('btn-filtro-30').classList.remove('active');
    
    if (tipoFiltro !== 'customizado') {
        document.getElementById('filtro-data-especifica').value = '';
    }
    
    if (tipoFiltro === 'hoje') document.getElementById('btn-filtro-hoje').classList.add('active');
    if (tipoFiltro === '15dias') document.getElementById('btn-filtro-15').classList.add('active');
    if (tipoFiltro === '30dias') document.getElementById('btn-filtro-30').classList.add('active');
    
    atualizarDashboard();
}