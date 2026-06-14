let meuGraficoPizza = null; // Guarda o gráfico para podermos destruí-lo e recriá-lo ao atualizar
let meuGraficoBarras = null; // NOVO: Guarda a instância do gráfico de barras horizontal
let meuGraficoPizzaSaldo = null; // <-- ADICIONE ISSO AQUI PARA O NOVO GRÁFICO
let meuGraficoConectores = null;
const API_URL = "https://script.google.com/macros/s/AKfycbyVgQbFq3IilXWR5vuULMRSrwThO7Gj_rS2AhIQ4g4DPlCtAPClb9Y6xEbhlq6nv1Nysg/exec"; 

let historicoDeRegistros = [];
let filtroGraficoAtual = 'hoje'; 
let dataAlvoCalendario = ""; // Guarda a data selecionada no calendário (Formato DD/MM/AAAA)

function alternarAba(nomeAba) {
    // 1. Esconde todas as abas de conteúdo
    document.querySelectorAll('.aba-conteudo').forEach(aba => {
        aba.style.display = 'none'; // Garante que some tudo
        aba.classList.remove('active');
    });

    // 2. Remove o destaque visual de todos os botões do topo
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // 3. Mostra a aba clicada e acende o botão correspondente
    if (nomeAba === 'dashboard') {
        const aba = document.getElementById('aba-dashboard');
        if(aba) aba.style.display = 'block';
        document.getElementById('aba-dashboard').classList.add('active');
        document.getElementById('btn-aba-dash').classList.add('active');
        atualizarDashboard(); 
    } else if (nomeAba === 'ranking') {
        const aba = document.getElementById('aba-ranking');
        if(aba) aba.style.display = 'block';
        document.getElementById('aba-ranking').classList.add('active');
        document.getElementById('btn-aba-ranking').classList.add('active');
        atualizarDashboard(); 
    } else if (nomeAba === 'formulario') {
        const aba = document.getElementById('aba-formulario');
        if(aba) aba.style.display = 'block';
        document.getElementById('aba-formulario').classList.add('active');
        document.getElementById('btn-aba-form').classList.add('active');
    } else if (nomeAba === 'conectores') {
        const aba = document.getElementById('aba-conectores');
        if(aba) aba.style.display = 'block';
        document.getElementById('aba-conectores').classList.add('active');
        document.getElementById('btn-aba-conectores').classList.add('active');
    }
}

// 1. CARREGAR DASHBOARD COM MÉTRICAS AVANÇADAS E GRÁFICOS (GET)
async function atualizarDashboard() {
    try {
        const urlSemCache = API_URL + (API_URL.includes('?') ? '&' : '?') + '_ts=' + new Date().getTime();
        const response = await fetch(urlSemCache);
        if (!response.ok) throw new Error(`Erro: ${response.status}`);
        
        const respostaObjeto = await response.json();
        
        if (respostaObjeto && respostaObjeto.status === "sucesso" && !respostaObjeto.historicoCompleto) {
            console.log("Confirmação de salvamento recebida. Ignorando atualização pesada.");
            return; 
        }

        const historicoCompleto = respostaObjeto.historicoCompleto || [];
        historicoDeRegistros = historicoCompleto;

        if (!Array.isArray(historicoCompleto) || historicoCompleto.length === 0) {
            if (document.getElementById("prod-diaria")) document.getElementById("prod-diaria").textContent = "0";
            if (document.getElementById("prod-quinzenal")) document.getElementById("prod-quinzenal").textContent = "0";
            if (document.getElementById("prod-mensal")) document.getElementById("prod-mensal").textContent = "0";
            if (document.getElementById("total-equipamentos")) document.getElementById("total-equipamentos").textContent = "0";
            
            const tabRanking = document.getElementById("tabela-ranking");
            if (tabRanking) {
                tabRanking.innerHTML = `<tr><td colspan="6" class="loading">Nenhuma baixa registrada ainda.</td></tr>`;
            }
            processarDadosConectoresDoDashboard(respostaObjeto);
            return;
        }

        // CONFIGURAÇÃO DOS MARCOS TEMPORAIS (DATAS)
        const agora = new Date();
        const hojeStringLocal = agora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        
        const limite15Dias = new Date();
        limite15Dias.setDate(agora.getDate() - 15);
        const tempo15 = limite15Dias.getTime();
        
        const limite30Dias = new Date();
        limite30Dias.setDate(agora.getDate() - 30);
        const tempo30 = limite30Dias.getTime();

        let totalHoje = 0;
        let total15 = 0;
        let total30 = 0;

        let saídasOntHoje = 0;
        let saídasOnuHoje = 0;
        let saídasRoteadorHoje = 0;

        let qtdOntFiltrado = 0;
        let qtdOnuFiltrado = 0;
        let qtdRoteadorFiltrado = 0;

        const estatisticasTecnicos = {};

        historicoCompleto.forEach(registro => {
            if (!registro) return; 
            const nome = registro.tecnico || registro.Tecnico || "Sem Nome";
            if (!registro.data) return;

            // TRATAMENTO ULTRA BLINDADO DE DATA
            let dataObjeto;
            let dataRaw = String(registro.data).trim();

            if (dataRaw.includes(" ")) dataRaw = dataRaw.split(" ")[0];
            if (dataRaw.includes("T")) dataRaw = dataRaw.split("T")[0];

            if (dataRaw.includes("-")) {
                const [ano, mes, dia] = dataRaw.split("-");
                dataObjeto = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
            } else if (dataRaw.includes("/")) {
                const [dia, mes, ano] = dataRaw.split("/");
                dataObjeto = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
            } else {
                dataObjeto = new Date(registro.data);
            }

            if (isNaN(dataObjeto.getTime())) return;

            const dataReg = dataObjeto.getTime();
            const dataRegistroStringLocal = dataObjeto.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

            // INICIALIZA O TÉCNICO NO OBJETO DE ESTATÍSTICAS
            if (!estatisticasTecnicos[nome]) {
                estatisticasTecnicos[nome] = { nome: nome, totalGeral: 0, hoje: 0, ultimos15: 0, ultimos30: 0, customizado: 0 };
            }

            // CONTADORES FIXOS DE TOPO (SEMPRE BASEADOS NO DIA DE HOJE REAL)
            if (dataRegistroStringLocal === hojeStringLocal) {
                totalHoje++;
                estatisticasTecnicos[nome].hoje++;

                const equipRaw = registro.equipamento || "";
                const equipStr = String(equipRaw).toUpperCase();
                if (equipStr.includes("ROTEADOR") || equipStr.includes("ROTEADORES")) saídasRoteadorHoje++;
                else if (equipStr.includes("ONT")) saídasOntHoje++;
                else if (equipStr.includes("ONU")) saídasOnuHoje++;
            }
            
            if (dataReg >= tempo15) {
                total15++;
                estatisticasTecnicos[nome].ultimos15++;
            }
            if (dataReg >= tempo30) {
                total30++;
                estatisticasTecnicos[nome].ultimos30++;
            }

            estatisticasTecnicos[nome].totalGeral += 1;

            // CASO SEJA FILTRO POR CALENDÁRIO ESPECÍFICO
            if (filtroGraficoAtual === 'customizado' && dataRegistroStringLocal === dataAlvoCalendario) {
                estatisticasTecnicos[nome].customizado++;
            }

            // DEFINE SE O REGISTRO ENTRA NOS GRÁFICOS DINÂMICOS
            let incluirNoGraficoPizza = false;
            if (filtroGraficoAtual === 'hoje' && dataRegistroStringLocal === hojeStringLocal) incluirNoGraficoPizza = true;
            else if (filtroGraficoAtual === '15dias' && dataReg >= tempo15) incluirNoGraficoPizza = true;
            else if (filtroGraficoAtual === '30dias' && dataReg >= tempo30) incluirNoGraficoPizza = true;
            else if (filtroGraficoAtual === 'customizado' && dataRegistroStringLocal === dataAlvoCalendario) incluirNoGraficoPizza = true;
            else if (filtroGraficoAtual === 'tudo') incluirNoGraficoPizza = true;

            if (incluirNoGraficoPizza) {
                const equipRaw = registro.equipamento || "";
                const equipStr = String(equipRaw).toUpperCase();
                if (equipStr.includes("ROTEADOR") || equipStr.includes("ROTEADORES")) qtdRoteadorFiltrado++;
                else if (equipStr.includes("ONT")) qtdOntFiltrado++;
                else if (equipStr.includes("ONU")) qtdOnuFiltrado++;
            }
        });

        // Atualiza os KPIs superiores na tela
        if (document.getElementById("prod-diaria")) document.getElementById("prod-diaria").textContent = totalHoje;
        if (document.getElementById("prod-quinzenal")) document.getElementById("prod-quinzenal").textContent = total15;
        if (document.getElementById("prod-mensal")) document.getElementById("prod-mensal").textContent = total30;
        if (document.getElementById("total-equipamentos")) document.getElementById("total-equipamentos").textContent = historicoCompleto.length;

        // Atualiza os contadores internos do gráfico de pizza conforme o filtro ativo
        if (document.getElementById("qtd-ont-hoje")) document.getElementById("qtd-ont-hoje").textContent = qtdOntFiltrado;
        if (document.getElementById("qtd-onu-hoje")) document.getElementById("qtd-onu-hoje").textContent = qtdOnuFiltrado;
        if (document.getElementById("qtd-roteador-hoje")) document.getElementById("qtd-roteador-hoje").textContent = qtdRoteadorFiltrado;

        // Atualiza os dados de Saídas do Balanço do Dia (Sempre Hoje)
        if (document.getElementById("saida-ont-hoje")) document.getElementById("saida-ont-hoje").textContent = saídasOntHoje;
        if (document.getElementById("saida-onu-hoje")) document.getElementById("saida-onu-hoje").textContent = saídasOnuHoje;
        if (document.getElementById("saida-roteador-hoje")) document.getElementById("saida-roteador-hoje").textContent = saídasRoteadorHoje;

        calcularDiferencaBalanco();

        const listaOrdenada = Object.values(estatisticasTecnicos);
        listaOrdenada.sort((a, b) => b.totalGeral - a.totalGeral);

        // --- ATUALIZAÇÃO DO GRÁFICO DE BARRAS DOS TÉCNICOS ---
        const canvasBarras = document.getElementById('graficoBarrasTecnicos');
        if (canvasBarras) {
            const ctxBarras = canvasBarras.getContext('2d');
            if (meuGraficoBarras !== null) meuGraficoBarras.destroy();

            const labelsTecnicos = listaOrdenada.map(t => t.nome);
            const dadosTotais = listaOrdenada.map(t => {
                if (filtroGraficoAtual === 'hoje') return t.hoje;
                if (filtroGraficoAtual === 'customizado') return t.customizado;
                if (filtroGraficoAtual === '15dias') return t.ultimos15;
                if (filtroGraficoAtual === '30dias') return t.ultimos30;
                return t.totalGeral;
            });
            
            const labelDinamica = filtroGraficoAtual === 'hoje' ? 'Equipamentos Concluídos Hoje' :
                                  filtroGraficoAtual === 'customizado' ? `Equipamentos em ${dataAlvoCalendario}` :
                                  filtroGraficoAtual === '15dias' ? 'Equipamentos (Últimos 15 dias)' : 
                                  filtroGraficoAtual === '30dias' ? 'Equipamentos (Últimos 30 dias)' : 'Total Histórico';

            const tetoDinamico = dadosTotais.length > 0 ? Math.max(...dadosTotais) : 10;

            meuGraficoBarras = new Chart(ctxBarras, {
                type: 'bar',
                data: {
                    labels: labelsTecnicos,
                    datasets: [{
                        label: labelDinamica,
                        data: dadosTotais,
                        backgroundColor: '#3b82f6', 
                        borderRadius: 4,
                        borderWidth: 0
                    }]
                },
                options: {
                    indexAxis: 'y', 
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: {
                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                            ticks: { color: '#9ca3af', stepSize: 2 },
                            max: tetoDinamico,
                            grace: 0
                        },
                        y: {
                            grid: { display: false },
                            ticks: { color: '#ffffff', font: { weight: 'bold' } }
                        }
                    }
                }
            });
        }

        // --- GRÁFICO DE PIZZA GERAL ---
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

        // TABELA DE RANKING
        const tabela = document.getElementById("tabela-ranking");
        if (tabela) {
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
        }
        
        processarDadosConectoresDoDashboard(respostaObjeto);

    } catch (error) {
        console.error("Erro ao atualizar painel de métricas:", error);
    }
}

// FUNÇÃO ACIONADA PELO BOTÃO "FILTRAR DIA" DO CALENDÁRIO
function aplicarFiltroCalendario() {
    const dataInput = document.getElementById('filtro-data-dia')?.value;
    
    if (!dataInput) {
        alert("Por favor, selecione uma data no calendário primeiro!");
        return;
    }

    const [ano, mes, dia] = dataInput.split('-');
    dataAlvoCalendario = `${dia.padStart(2, '0')}/${mes.padStart(2, '0')}/${ano}`;
    
    filtroGraficoAtual = 'customizado';
    
    // Reseta o visual dos botões rápidos
    document.getElementById('btn-filtro-hoje')?.classList.remove('active');
    document.getElementById('btn-filtro-15')?.classList.remove('active');
    document.getElementById('btn-filtro-30')?.classList.remove('active');

    atualizarDashboard();
}

function mudarPeriodoGrafico(tipoFiltro) {
    filtroGraficoAtual = tipoFiltro;
    
    document.getElementById('btn-filtro-hoje')?.classList.remove('active');
    document.getElementById('btn-filtro-15')?.classList.remove('active');
    document.getElementById('btn-filtro-30')?.classList.remove('active');
    
    if (tipoFiltro === 'hoje') document.getElementById('btn-filtro-hoje')?.classList.add('active');
    if (tipoFiltro === '15dias') document.getElementById('btn-filtro-15')?.classList.add('active');
    if (tipoFiltro === '30dias') document.getElementById('btn-filtro-30')?.classList.add('active');
    
    // Limpa o input do calendário se clicou num período pré-definido
    if (tipoFiltro !== 'customizado') {
        const inputCalendario = document.getElementById('filtro-data-dia');
        if (inputCalendario) inputCalendario.value = '';
    }
    
    atualizarDashboard();
}

function processarDadosConectoresDoDashboard(respostaObjeto) {
    if (!respostaObjeto) return;
    
    const conectoresDados = {
        nasdaRec: parseInt(respostaObjeto.nasdaRec) || 0,
        nasdaSuc: parseInt(respostaObjeto.nasdaSuc) || 0,
        maxprintRec: parseInt(respostaObjeto.maxprintRec) || 0,
        maxprintSuc: parseInt(respostaObjeto.maxprintSuc) || 0,
        transcendRec: parseInt(respostaObjeto.transcendRec) || 0,
        transcendSuc: parseInt(respostaObjeto.transcendSuc) || 0,
        
        // CAPTURA DOS NOVOS VALORES UPC:
        nasdaUpcRec: parseInt(respostaObjeto.nasdaUpcRec) || 0,
        nasdaUpcSuc: parseInt(respostaObjeto.nasdaUpcSuc) || 0,
        maxprintUpcRec: parseInt(respostaObjeto.maxprintUpcRec) || 0,
        maxprintUpcSuc: parseInt(respostaObjeto.maxprintUpcSuc) || 0,
        transcendUpcRec: parseInt(respostaObjeto.transcendUpcRec) || 0,
        transcendUpcSuc: parseInt(respostaObjeto.transcendUpcSuc) || 0
    };

    renderizarGraficoConectores(conectoresDados);
}

function renderizarGraficoConectores(dados) {
    const ctx = document.getElementById('graficoBarrasConectores');
    if (!ctx) return;

    // Constantes APC
    const nasdaRec = dados.nasdaRec || 0;
    const nasdaSuc = dados.nasdaSuc || 0;
    const maxprintRec = dados.maxprintRec || 0;
    const maxprintSuc = dados.maxprintSuc || 0;
    const transcendRec = dados.transcendRec || 0;
    const transcendSuc = dados.transcendSuc || 0;

    // Novas Constantes UPC
    const nasdaUpcRec = dados.nasdaUpcRec || 0;
    const nasdaUpcSuc = dados.nasdaUpcSuc || 0;
    const maxprintUpcRec = dados.maxprintUpcRec || 0;
    const maxprintUpcSuc = dados.maxprintUpcSuc || 0;
    const transcendUpcRec = dados.transcendUpcRec || 0;
    const transcendUpcSuc = dados.transcendUpcSuc || 0;

    // ATUALIZAÇÃO DOS CONTADORES FIXOS DE TEXTO
    // Se quiser manter os contadores antigos somando APC + UPC por marca nas caixinhas:
    if(document.getElementById('total-apc-hoje')) document.getElementById('total-apc-hoje').textContent = (nasdaRec + nasdaSuc) + (nasdaUpcRec + nasdaUpcSuc);
    if(document.getElementById('total-upc-hoje')) document.getElementById('total-upc-hoje').textContent = (maxprintRec + maxprintSuc) + (maxprintUpcRec + maxprintUpcSuc);
    if(document.getElementById('total-transcend-hoje')) document.getElementById('total-transcend-hoje').textContent = (transcendRec + transcendSuc) + (transcendUpcRec + transcendUpcSuc);
    
    // Total Geral de todos os conectores recuperados juntos (APC + UPC)
    const totalGeralRecuperados = nasdaRec + maxprintRec + transcendRec + nasdaUpcRec + maxprintUpcRec + transcendUpcRec;
    if(document.getElementById('total-conectores-recuperados-geral')) {
        document.getElementById('total-conectores-recuperados-geral').textContent = totalGeralRecuperados;
    }

    if (meuGraficoConectores) meuGraficoConectores.destroy();

    meuGraficoConectores = new Chart(ctx, {
        type: 'bar',
        data: {
            // Adicionado os 3 novos rótulos UPC ao gráfico
            labels: [
                'NASDA APC', 'NASDA UPC', 'TRANSCEND APC',
                'TRANSCEND UPC ', 'MAXPRINT APC ', 'MAXPRINT UPC '
            ],
            datasets: [
                {
                    label: 'Recuperados',
                    data: [nasdaRec, maxprintRec, transcendRec, nasdaUpcRec, maxprintUpcRec, transcendUpcRec],
                    backgroundColor: '#10b981', 
                    borderColor: '#10b981',
                    borderWidth: 1,
                    barPercentage: 0.7,
                    categoryPercentage: 0.6
                },
                {
                    label: 'Sucata',
                    data: [nasdaSuc, maxprintSuc, transcendSuc, nasdaUpcSuc, maxprintUpcSuc, transcendUpcSuc],
                    backgroundColor: '#ef4444', 
                    borderColor: '#ef4444',
                    borderWidth: 1,
                    barPercentage: 0.7,
                    categoryPercentage: 0.6
                }
            ]
        },
        options: {
            indexAxis: 'y', 
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af', stepSize: 1 } },
                y: { grid: { display: false }, ticks: { color: '#ffffff', font: { weight: 'bold', size: 9 } } }
            },
            plugins: { legend: { labels: { color: '#9ca3af' } } }
        }
    });
}

function calcularDiferencaBalanco() {
    const entOnt = parseInt(document.getElementById("input-entrada-ont")?.value) || 0;
    const entOnu = parseInt(document.getElementById("input-entrada-onu")?.value) || 0;
    const entRoteador = parseInt(document.getElementById("input-entrada-roteador")?.value) || 0;

    const saiOnt = parseInt(document.getElementById("saida-ont-hoje")?.textContent) || 0;
    const saiOnu = parseInt(document.getElementById("saida-onu-hoje")?.textContent) || 0;
    const saiRoteador = parseInt(document.getElementById("saida-roteador-hoje")?.textContent) || 0;

    const totalEntradas = entOnt + entOnu + entRoteador;
    const totalSaidas = saiOnt + saiOnu + saiRoteador;

    const elTotalEntrada = document.getElementById("total-entrada-hoje");
    if (elTotalEntrada) elTotalEntrada.textContent = totalEntradas;

    const elTotalSaida = document.getElementById("total-saida-hoje");
    if (elTotalSaida) elTotalSaida.textContent = totalSaidas;

    const saldoOnt = saiOnt - entOnt;
    const saldoOnu = saiOnu - entOnu;
    const saldoRoteador = saiRoteador - entRoteador;

    const saldoTotalReal = saldoOnt + saldoOnu + saldoRoteador;

    const elSaldoTotal = document.getElementById("saldo-total-hoje");
    if (elSaldoTotal) {
        elSaldoTotal.textContent = `${saldoTotalReal} un`;
        if (saldoTotalReal < 0) elSaldoTotal.style.color = "#ef4444"; 
        else if (saldoTotalReal === 0) elSaldoTotal.style.color = "#9ca3af"; 
        else elSaldoTotal.style.color = "#10b981"; 
    }

    const canvasSaldo = document.getElementById('graficoPizzaSaldo');
    if (canvasSaldo) {
        const ctxSaldo = canvasSaldo.getContext('2d');
        if (meuGraficoPizzaSaldo !== null) meuGraficoPizzaSaldo.destroy();

        const debitoOnt = saldoOnt < 0 ? Math.abs(saldoOnt) : 0;
        const debitoOnu = saldoOnu < 0 ? Math.abs(saldoOnu) : 0;
        const debitoRoteador = saldoRoteador < 0 ? Math.abs(saldoRoteador) : 0;

        const temPendenciaAtiva = (debitoOnt + debitoOnu + debitoRoteador) > 0;

        meuGraficoPizzaSaldo = new Chart(ctxSaldo, {
            type: 'pie',
            data: {
                labels: ['ONT Pendente', 'ONU Pendente', 'Roteador Pendente'],
                datasets: [{
                    data: temPendenciaAtiva ? [debitoOnt, debitoOnu, debitoRoteador] : [1, 1, 1],
                    backgroundColor: temPendenciaAtiva ? ['#3b82f6', '#10b981', '#f59e0b'] : ['#374151', '#374151', '#374151'],
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.1)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { color: '#9ca3af', font: { family: 'sans-serif', size: 11 } } },
                    tooltip: { enabled: temPendenciaAtiva }
                }
            }
        });
    }
}

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

    const linesMac = document.querySelectorAll(".input-mac-lote");
    const linesSerial = document.querySelectorAll(".input-serial-lote");

    let loteParaEnviar = [];
    for (let i = 0; i < linesMac.length; i++) {
        loteParaEnviar.push({
            tecnico: tecnico,
            equipamento: equipamento,
            mac: linesMac[i].value.trim(),
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

async function enviarDadosConectores(event) {
    event.preventDefault();

    const btnEnviar = document.getElementById("btn-enviar-conectores");
    const msgStatus = document.getElementById("msg-status-conectores");

    const tecnico = document.getElementById("select-tecnico-conector").value;
    const origen = document.getElementById("select-origem-conector").value;

    let conectoresSelecionados = [];
    document.querySelectorAll('input[name="tipo-conector"]:checked').forEach(cb => conectoresSelecionados.push(cb.value));
    const tiposConectoresTexto = conectoresSelecionados.length > 0 ? conectoresSelecionados.join(", ") : "Nenhum";

    const qtdRecuperada = parseInt(document.getElementById("input-conectores-recuperados").value) || 0;
    const qtdSucata = parseInt(document.getElementById("input-conectores-sucata").value) || 0;

    let acopladoresSelecionados = [];
    document.querySelectorAll('input[name="tipo-acoplador"]:checked').forEach(cb => acopladoresSelecionados.push(cb.value));
    const tiposAcopladoresTexto = acopladoresSelecionados.length > 0 ? acopladoresSelecionados.join(", ") : "Nenhum";

    const qtdAcopladoresRecuperados = parseInt(document.getElementById("input-acopladores-recuperados").value) || 0;

    const dadosConectores = {
        acao: "salvarConectores",
        tecnico: tecnico,
        origem: origen,
        tiposConectores: tiposConectoresTexto,
        conectoresRecuperados: qtdRecuperada,
        conectoresSucata: qtdSucata,
        tiposAcopladores: tiposAcopladoresTexto,
        acopladoresRecuperados: qtdAcopladoresRecuperados
    };

    btnEnviar.disabled = true;
    btnEnviar.textContent = "Salvando Registro...";
    msgStatus.style.color = "#9ca3af";
    msgStatus.textContent = "Enviando dados para a planilha...";

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify(dadosConectores)
        });

        const resultado = await response.json();

        if (resultado.status === "sucesso") {
            msgStatus.style.color = "#10b981";
            msgStatus.textContent = "Sucesso: Dados registrados!";
            document.getElementById("form-conectores").reset();
            await atualizarDashboard();
        } else {
            throw new Error(resultado.mensagem);
        }

    } catch (error) {
        console.error("Erro no envio dos conectores:", error);
        msgStatus.style.color = "#ef4444";
        msgStatus.textContent = "Erro ao registrar. Tente novamente.";
    } finally {
        btnEnviar.disabled = false;
        btnEnviar.textContent = "Salvar Registro de Conectores";
    }
}

// Inicializador único e limpo
document.addEventListener("DOMContentLoaded", () => {
    // Insere por padrão a data de hoje no calendário ao carregar a página
    const inputData = document.getElementById('filtro-data-dia');
    if (inputData) {
        const hoje = new Date();
        const ano = hoje.getFullYear();
        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
        const dia = String(hoje.getDate()).padStart(2, '0');
        inputData.value = `${ano}-${mes}-${dia}`;
    }

    atualizarDashboard();
    setInterval(atualizarDashboard, 120000);
});