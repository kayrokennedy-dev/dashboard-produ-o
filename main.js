// 1. Cole aqui a URL exata que o Google gerou na "Nova Implantação" do Apps Script
const API_URL = "https://script.google.com/macros/s/AKfycbzVn4QczjD7MnDGTTEOmFRpRE3NvJGq_OI25RK0g4iXgm2bRXhr198c6-EMHF3YjWQFqQ/exec"; 

async function atualizarDashboard() {
    try {
        // Faz a chamada para a API do Google Sheets
        const response = await fetch(API_URL);
        
        if (!response.ok) {
            throw new Error(`Erro na requisição: ${response.status}`);
        }
        
        const dados = await response.json();

        // Se a planilha estiver vazia, interrompe para não quebrar a tela
        if (!dados || dados.length === 0) return;

        // 2. TRATAMENTO DE DADOS
        // Garante que o campo Quantidade seja tratado como número real
        dados.forEach(item => {
            item.NomeFinal = item.Tecnico || item.Técnico || item.tecnico || item.Nome || "Sem nome";

            let qtdBruta = item.Quantidade || item.quantidade || item.Qtd || item.qtd || 0;
        });

        // Ordena os técnicos: quem produziu MAIS (maior número) fica no topo
        dados.sort((a, b) => b.Quantidade - a.Quantidade);

        // 3. CÁLCULO DOS CARDS (KPIs)
        // Soma a quantidade de todo mundo para ter o total geral
        const totalEquipamentos = dados.reduce((sum, item) => sum + item.Quantidade, 0);
        
        // Como já está ordenado, o primeiro do array ([0]) é o líder atual
        const liderTurno = dados[0].Tecnico || "Nenhum";
        const maiorProducao = dados[0].Quantidade || 1; // Evita divisão por zero no cálculo da barra

        // Atualiza os valores nos cards do HTML
        document.getElementById("total-equipamentos").textContent = totalEquipamentos;
        document.getElementById("lider-nome").textContent = liderTurno;

        // 4. RENDERIZAÇÃO DA TABELA
        const tabela = document.getElementById("tabela-ranking");
        tabela.innerHTML = ""; // Limpa a mensagem de "Carregando..." ou dados antigos

        dados.forEach((item, index) => {
            const posicao = index + 1;
            
            // Define uma classe CSS especial para destacar o pódio (#1, #2 e #3)
            const classePosicao = posicao <= 3 ? `pos-${posicao}` : "";

            // Calcula a largura da barra de progresso em relação ao líder (líder = 100%)
            const percentual = ((item.Quantidade / maiorProducao) * 100).toFixed(0);

            // Cria a linha da tabela de forma dinâmica
            const row = document.createElement("tr");
            row.innerHTML = `
                <td class="${classePosicao}">#${posicao}</td>
                <td><strong>${item.Tecnico}</strong></td>
                <td>${item.Quantidade} un</td>
                <td>
                    <div class="progress-bar-container" title="${percentual}% do líder">
                        <div class="progress-bar" style="width: ${percentual}%"></div>
                    </div>
                </td>
            `;
            tabela.appendChild(row);
        });

        console.log("Dashboard atualizada com sucesso!");

    } catch (error) {
        console.error("Falha ao sincronizar dashboard:", error);
    }
}

// 5. CONTROLE DE EXECUÇÃO
document.addEventListener("DOMContentLoaded", () => {
    // Roda a função assim que a página abre
    atualizarDashboard();
    
    // O PULO DO GATO: Atualiza sozinho em background a cada 2 minutos (120000 milissegundos)
    // Sem dar refresh na página e sem o usuário notar
    setInterval(atualizarDashboard, 120000);
});