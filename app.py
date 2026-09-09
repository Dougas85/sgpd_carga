import re
from flask import Flask, render_template, request, jsonify
from bs4 import BeautifulSoup

app = Flask(__name__)

def extrair_conformidade_sgpd(html_content, lista_filtro=None):
    soup = BeautifulSoup(html_content, 'html.parser')
    resultados = []

    # Trata lista de filtros passados (ex: ["DESCALVADO", "DIVINOLANDIA", "00027237"])
    filtros = [f.strip().upper() for f in lista_filtro if f.strip()] if lista_filtro else []

    # Procura todas as linhas de tabela na tela do SGPD
    linhas = soup.find_all('tr')

    for linha in linhas:
        # Busca pelos inputs ocultos que o SGPD usa nativamente por linha
        input_mcu = linha.find('input', {'name': 'mcuUnidade'})
        input_nome = linha.find('input', {'name': 'nomeUnidade'})
        btn_resto = linha.find('button', {'id': 'btn_resto'})

        # Se não tiver essa estrutura, pula a linha (cabeçalhos, modais, etc.)
        if not (input_mcu or input_nome or btn_resto):
            continue

        mcu = input_mcu['value'].strip() if input_mcu else 'N/A'
        unidade = input_nome['value'].strip() if input_nome else 'DESCONHECIDA'

        # Validação do Filtro
        if filtros:
            corresponde = any(f in unidade.upper() or f in mcu for f in filtros)
            if not corresponde:
                continue

        # Identifica status pela classe do botão ('azul' para lançado, 'cinza' para não lançado)
        classes_botao = btn_resto.get('class', []) if btn_resto else []
        texto_botao = btn_resto.get_text(strip=True) if btn_resto else ''

        if 'azul' in classes_botao or 'RESTO LANÇADO' in texto_botao.upper():
            status = "Resto Lançado"
            is_lancado = True
        else:
            status = "Resto Não Lançado"
            is_lancado = False

        resultados.append({
            "mcu": mcu,
            "unidade": unidade,
            "status": status,
            "is_lancado": is_lancado
        })

    return resultados

@app.route('/api/analisar', methods=['POST'])
def analisar():
    try:
        data = request.get_json() or {}
        html_dom = data.get('html', '')
        unidades_filtro = data.get('unidades', [])

        if not html_dom:
            return jsonify({'sucesso': False, 'erro': 'HTML da página não enviado'}), 400

        dados = extrair_conformidade_sgpd(html_dom, unidades_filtro)

        total = len(dados)
        lancados = sum(1 for d in dados if d['is_lancado'])
        pendentes = total - lancados

        return jsonify({
            'sucesso': True,
            'resumo': {
                'total': total,
                'lancados': lancados,
                'pendentes': pendentes
            },
            'resultados': dados
        })

    except Exception as e:
        return jsonify({'sucesso': False, 'erro': str(e)}), 500

@app.route('/')
def home():
    return jsonify({
        'status': 'online',
        'mensagem': 'API SGPD Resíduos operando no Vercel'
    })

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    return response

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
