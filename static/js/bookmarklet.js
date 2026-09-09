(function () {
    if (!document.getElementById('sgpd-style')) {
        const style = document.createElement('style');
        style.id = 'sgpd-style';
        style.innerHTML = `
            #sgpd-panel {
                position: fixed; top: 20px; right: 20px; width: 380px; z-index: 999999;
                background: #1e293b; color: #fff; padding: 15px; border-radius: 8px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.5); font-family: sans-serif; font-size: 13px;
            }
            #sgpd-panel h3 { margin: 0 0 10px 0; font-size: 15px; color: #38bdf8; }
            #sgpd-panel textarea { width: 100%; height: 60px; margin-bottom: 10px; background: #0f172a; color: #fff; border: 1px solid #334155; border-radius: 4px; padding: 6px; box-sizing: border-box; font-size: 12px; }
            #sgpd-panel button { width: 100%; padding: 8px; background: #0284c7; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }
            #sgpd-panel button:disabled { background: #64748b; cursor: not-allowed; }
            #sgpd-panel .status-bar { display: flex; justify-content: space-between; margin: 10px 0; text-align: center; }
            #sgpd-panel .stat-box { background: #0f172a; padding: 8px; border-radius: 4px; width: 48%; }
            #sgpd-panel .stat-box span { display: block; font-size: 18px; font-weight: bold; }
            #sgpd-table-container { max-height: 250px; overflow-y: auto; margin-top: 10px; border: 1px solid #334155; }
            #sgpd-panel table { width: 100%; border-collapse: collapse; }
            #sgpd-panel th, #sgpd-panel td { padding: 6px; text-align: left; border-bottom: 1px solid #334155; font-size: 11px; }
            .st-lancado { color: #38bdf8; font-weight: bold; }
            .st-pendente { color: #f87171; font-weight: bold; }
            #sgpd-progress { color: #f59e0b; margin: 5px 0; font-weight: bold; text-align: center; font-size: 12px; }
        `;
        document.head.appendChild(style);
    }

    let panel = document.getElementById('sgpd-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'sgpd-panel';
        panel.innerHTML = `
            <h3>SGPD - Varredura Inteligente</h3>
            <label>Unidades/MCUs a buscar (separadas por vírgula):</label>
            <textarea id="sgpd-unidades" placeholder="Ex: AC BILAC, AC MARTINOPOLIS, AC PIRAPOZINHO, AC ADAMANTINA"></textarea>
            <button id="sgpd-btn-iniciar">Iniciar Varredura</button>
            <div id="sgpd-progress"></div>
            <div class="status-bar">
                <div class="stat-box">Lançados: <span id="sgpd-l" style="color: #38bdf8;">0</span></div>
                <div class="stat-box">Pendentes: <span id="sgpd-p" style="color: #f87171;">0</span></div>
            </div>
            <div id="sgpd-table-container">
                <table>
                    <thead>
                        <tr><th>Unidade / MCU</th><th>Status</th></tr>
                    </thead>
                    <tbody id="sgpd-tb"></tbody>
                </table>
            </div>
        `;
        document.body.appendChild(panel);
    }

    // Limpa acentos e caracteres especiais para comparação flexível
    const sanitizar = text => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");

    document.getElementById('sgpd-btn-iniciar').onclick = async function () {
        const btn = this;
        const progress = document.getElementById('sgpd-progress');
        const inputFiltro = document.getElementById('sgpd-unidades').value;
        
        // Mapeia os alvos digitados pelo usuário
        const listaAlvos = inputFiltro.split(',')
            .map(s => ({ original: s.trim(), limpo: sanitizar(s) }))
            .filter(item => item.limpo.length > 0);

        btn.disabled = true;
        let htmlAcumulado = '';
        let unidadesEncontradas = new Set();

        const paginadorContainer = document.querySelector('.paginador-controles') || document.querySelector('[data-paginas]');
        const totalPaginas = paginadorContainer ? parseInt(paginadorContainer.getAttribute('data-paginas') || '38') : 38;

        for (let pag = 1; pag <= totalPaginas; pag++) {
            progress.innerText = `Analisando página ${pag} de ${totalPaginas}...`;

            const tabelaAtual = document.querySelector('table');
            if (tabelaAtual) {
                htmlAcumulado += tabelaAtual.querySelector('tbody') ? tabelaAtual.querySelector('tbody').innerHTML : tabelaAtual.innerHTML;

                if (listaAlvos.length > 0) {
                    const textoPaginaLimpo = sanitizar(tabelaAtual.innerText);

                    // Valida termo por termo
                    listaAlvos.forEach(alvo => {
                        if (textoPaginaLimpo.includes(alvo.limpo)) {
                            unidadesEncontradas.add(alvo.limpo);
                        }
                    });

                    // PARADA IMEDIATA: Se a contagem de únicos bateu com o total da lista, interrompe na hora!
                    if (unidadesEncontradas.size >= listaAlvos.length) {
                        progress.innerText = `Todas as ${listaAlvos.length} unidades foram localizadas na página ${pag}! Finalizando...`;
                        break;
                    }
                }
            }

            if (pag >= totalPaginas) break;

            // Próxima página
            const proximaPagina = pag + 1;
            let botaoProximo = Array.from(document.querySelectorAll('.paginador-controles button, .paginador-controles a, .pagination a, .pagination button, table tfoot a, table tfoot button'))
                .find(el => el.innerText.trim() === String(proximaPagina));

            if (!botaoProximo) {
                botaoProximo = document.querySelector('.paginador-controles button .fa-chevron-right')?.parentElement 
                            || document.querySelector('.fa-chevron-right')?.parentElement
                            || document.querySelector('button[title*="Próxima"]')
                            || document.querySelector('a[title*="Próxima"]');
            }

            if (botaoProximo) {
                botaoProximo.click();
                await new Promise(r => setTimeout(r, 1200));
            } else {
                break;
            }
        }

        progress.innerText = "Processando no Vercel...";

        try {
            const resp = await fetch('https://sgpdcarga.vercel.app/api/analisar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    html: `<table>${htmlAcumulado}</table>`,
                    unidades: listaAlvos.map(a => a.original)
                })
            });

            if (!resp.ok) {
                throw new Error(`Status ${resp.status}`);
            }

            const data = await resp.json();

            if (data.sucesso) {
                document.getElementById('sgpd-l').innerText = data.resumo.lancados;
                document.getElementById('sgpd-p').innerText = data.resumo.pendentes;

                const tbody = document.getElementById('sgpd-tb');
                tbody.innerHTML = '';

                if (data.resultados.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:#f87171;">Nenhuma unidade encontrada.</td></tr>';
                } else {
                    data.resultados.forEach(item => {
                        const tr = document.createElement('tr');
                        const cssClass = item.is_lancado ? 'st-lancado' : 'st-pendente';
                        tr.innerHTML = `<td><b>${item.unidade}</b><br><small>${item.mcu}</small></td><td class="${cssClass}">${item.status}</td>`;
                        tbody.appendChild(tr);
                    });
                }

                progress.innerText = `Concluído! ${data.resultados.length} unidades exibidas.`;
            } else {
                progress.innerText = "Erro no servidor: " + data.erro;
            }
        } catch (err) {
            progress.innerText = "Erro de conexão: " + err.message;
            console.error(err);
        } finally {
            btn.disabled = false;
        }
    };
})();
