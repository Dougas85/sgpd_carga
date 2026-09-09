document.addEventListener('DOMContentLoaded', () => {
    const btnAnalisar = document.getElementById('btn-analisar');

    btnAnalisar.addEventListener('click', async () => {
        const html = document.getElementById('html-input').value.trim();
        const filtroRaw = document.getElementById('filtro-unidades').value.trim();
        const unidades = filtroRaw ? filtroRaw.split(',').map(s => s.trim()) : [];

        if (!html) {
            alert('Cole o HTML da consulta do SGPD antes de prosseguir.');
            return;
        }

        try {
            const response = await fetch('/api/analisar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ html, unidades })
            });

            const data = await response.json();

            if (data.sucesso) {
                document.getElementById('stat-total').innerText = data.resumo.total;
                document.getElementById('stat-ok').innerText = data.resumo.lancados;
                document.getElementById('stat-pend').innerText = data.resumo.pendentes;

                const tbody = document.getElementById('tabela-resultados');
                tbody.innerHTML = '';

                data.resultados.forEach(item => {
                    const tr = document.createElement('tr');
                    const color = item.is_lancado ? '#34d399' : '#f87171';
                    tr.innerHTML = `
                        <td style="font-family: monospace;">${item.mcu}</td>
                        <td><b>${item.unidade}</b></td>
                        <td style="color: ${color}; font-weight: bold;">${item.status}</td>
                    `;
                    tbody.appendChild(tr);
                });

                document.getElementById('painel-resultados').style.display = 'block';
            } else {
                alert('Erro: ' + data.erro);
            }
        } catch (err) {
            console.error(err);
            alert('Erro de comunicação com o servidor.');
        }
    });
});