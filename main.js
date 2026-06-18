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
    const inputOnt = document.getElementById("input-entrada-ont");
    const inputOnu = document.getElementById("input-entrada-onu");
    const inputRoteador = document.getElementById("input-entrada-roteador");

    // --- NOVA LÓGICA: SALVAR E CHECAR DATA NO LOCALSTORAGE ---
    const hojeString = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const dataUltimoSalvamento = localStorage.getItem("balanco_data_dia");

    // Se mudou o dia, zera os valores salvos anteriormente
    if (dataUltimoSalvamento && dataUltimoSalvamento !== hojeString) {
        localStorage.setItem("entrada_ont", "0");
        localStorage.setItem("entrada_onu", "0");
        localStorage.setItem("entrada_roteador", "0");
        
        if (inputOnt) inputOnt.value = 0;
        if (inputOnu) inputOnu.value = 0;
        if (inputRoteador) inputRoteador.value = 0;
    }
    
    // Salva a data atual como o último dia modificado
    localStorage.setItem("balanco_data_dia", hojeString);

    // Salva o que o usuário digitou atualmente para não perder no refresh
    if (inputOnt) localStorage.setItem("entrada_ont", inputOnt.value);
    if (inputOnu) localStorage.setItem("entrada_onu", inputOnu.value);
    if (inputRoteador) localStorage.setItem("entrada_roteador", inputRoteador.value);
    // --------------------------------------------------------

    const entOnt = parseInt(inputOnt?.value) || 0;
    const entOnu = parseInt(inputOnu?.value) || 0;
    const entRoteador = parseInt(inputRoteador?.value) || 0;

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


// FUNÇÃO AUXILIAR PARA GERAR O HASH DA SENHA (CRIPTOGRAFIA MILITAR SHA-256)
// FUNÇÃO AUXILIAR PARA GERAR O HASH DA SENHA (SHA-256)
// FUNÇÃO AUXILIAR PARA GERAR O HASH DA SENHA (VERSÃO ULTRA COMPATÍVEL E BLINDADA)
// FUNÇÃO DE CONFIGURAÇÃO DE SEGURANÇA LOCAL (BLINDADA PARA ARQUIVOS LOCAL/FILE)
function verificarSenhaLaboratorio(senhaDigitada) {
    // Texto ofuscado correspondente a senha "lab123" invertida
    const CHAVE_AUTORIZADA = "MzIxbGFi"; 
    
    // Inverte a senha digitada e converte em Base64 para comparar em segredo
    const senhaInvertida = senhaDigitada.trim().split('').reverse().join('');
    const tokenGerado = btoa(senhaInvertida);
    
    return tokenGerado === CHAVE_AUTORIZADA;
}

// Inicializador único e limpo com bloqueio de segurança compatível com arquivos locais
// ALGORITMO CRIPTOGRÁFICO SHA-256 LOCAL (RODA EM QUALQUER LUGAR, INCLUINDO FILE:///)
function calcularHashSHA256Local(str) {
    const buffer = new TextEncoder().encode(str);
    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    const w = new Array(64);
    
    let len = buffer.length;
    let words = new Uint32Array(16);
    for (let i = 0; i < len; i++) words[i >> 2] |= buffer[i] << (24 - (i & 3) * 8);
    words[len >> 2] |= 0x80 << (24 - (len & 3) * 8);
    words[15] = len * 8;

    for (let i = 0; i < 16; i++) w[i] = words[i];
    for (let i = 16; i < 64; i++) {
        let s0 = ((w[i-15] >>> 7) | (w[i-15] << 25)) ^ ((w[i-15] >>> 18) | (w[i-15] << 14)) ^ (w[i-15] >>> 3);
        let s1 = ((w[i-2] >>> 17) | (w[i-2] << 15)) ^ ((w[i-2] >>> 19) | (w[i-2] << 13)) ^ (w[i-2] >>> 10);
        w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    const k = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];

    for (let i = 0; i < 64; i++) {
        let S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        let ch = (e & f) ^ ((~e) & g);
        let temp1 = (h + S1 + ch + k[i] + w[i]) | 0;
        let S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        let maj = (a & b) ^ (a & c) ^ (b & c);
        let temp2 = (S0 + maj) | 0;
        h = g; g = f; f = e; d = (d + temp1) | 0; e = (c + temp1) | 0; c = b; b = a; a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;

    return [h0, h1, h2, h3, h4, h5, h6, h7].map(v => ('00000000' + (v >>> 0).toString(16)).slice(-8)).join('');
}

// FUNÇÃO ACIONADA PELO BOTÃO DA TELA VISUAL DO INDEX.HTML
function validarPinLaboratorio() {
    const inputPin = document.getElementById("input-pin-lab");
    const msgErro = document.getElementById("erro-pin-lab");
    if (!inputPin) return;

    const pinDigitado = inputPin.value.trim();
    
    // Hash SHA-256 real do PIN "4815". Operações inversas matemáticas aqui dão ZERO resultado!
    const HASH_REAL_SECRETO = "38bc52655bfd240e87d377b5a2bfbf84ecdfa364132e0e4701a24cb4d241d9e2";
    
    const hashDigitado = calcularHashSHA256Local(pinDigitado);

    if (hashDigitado === HASH_REAL_SECRETO) {
        localStorage.setItem("lab_autorizado", "true");
        const telaLogin = document.getElementById("tela-login-laboratorio");
        if (telaLogin) telaLogin.style.display = "none";
        window.location.reload(); 
    } else {
        if (msgErro) msgErro.textContent = "Código PIN inválido!";
        inputPin.value = "";
        inputPin.focus();
    }
}

// INICIALIZADOR COMPLETO DA PÁGINA (A partir da antiga linha 270)
document.addEventListener("DOMContentLoaded", () => {
    // --- VERIFICAÇÃO INTEGRADA DA TELA DE BLOQUEIO DO LABORATÓRIO ---
    const telaLogin = document.getElementById("tela-login-laboratorio");
    
    if (localStorage.getItem("lab_autorizado") !== "true") {
        if (telaLogin) {
            telaLogin.style.display = "flex"; 
            
            // Atalho para enviar a senha clicando em "Enter" no teclado físico
            document.getElementById("input-pin-lab")?.addEventListener("keypress", (e) => {
                if (e.key === "Enter") validarPinLaboratorio();
            });
        }
        return; // Trava a inicialização de qualquer dado ou gráfico até passar do PIN
    }
    // ------------------------------------------------------------------

    // Inicialização do calendário padrão
    const inputDataEsp = document.getElementById('filtro-data-especifica');
    if (inputDataEsp) {
        const hoje = new Date();
        const ano = hoje.getFullYear();
        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
        const dia = String(hoje.getDate()).padStart(2, '0');
        inputDataEsp.value = `${ano}-${mes}-${dia}`;
    }

    const inputData = document.getElementById('filtro-data-dia');
    if (inputData) {
        const hoje = new Date();
        const ano = hoje.getFullYear();
        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
        const dia = String(hoje.getDate()).padStart(2, '0');
        inputData.value = `${ano}-${mes}-${dia}`;
    }

    // Carregamento de dados persistidos das Entradas diárias
    const hojeString = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const dataUltimoSalvamento = localStorage.getItem("balanco_data_dia");

    if (dataUltimoSalvamento === hojeString) {
        if (document.getElementById("input-entrada-ont")) {
            document.getElementById("input-entrada-ont").value = localStorage.getItem("entrada_ont") || 0;
        }
        if (document.getElementById("input-entrada-onu")) {
            document.getElementById("input-entrada-onu").value = localStorage.getItem("entrada_onu") || 0;
        }
        if (document.getElementById("input-entrada-roteador")) {
            document.getElementById("input-entrada-roteador").value = localStorage.getItem("entrada_roteador") || 0;
        }
    }

    // Inicializa o Dashboard com requisições e atualiza a cada 2 minutos
    atualizarDashboard();
    setInterval(atualizarDashboard, 120000); 
});