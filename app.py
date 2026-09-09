import re
from flask import Flask, request, jsonify
from flask_cors import CORS
from bs4 import BeautifulSoup

app = Flask(__name__)
# Libera chamadas do SGPD para o Vercel
CORS(app, resources={r"/api/*": {"origins": "*"}})


def remover_acentos(texto):
    return ''.join(c for c in unicodedata.normalize('NFD', texto) if unicodedata.category(c) != 'Mn').upper()

def extrair_conformidade_sgpd(html_content, lista_filtro=None):
    soup = BeautifulSoup(html_content, 'html.parser')
    resultados = []

    filtros = [f.strip().upper() for f in lista_filtro if f.strip()] if lista_filtro else []

    linhas = soup.find_all('tr')

    for linha in linhas:
        input_mcu = linha.find('input', {'name': 'mcuUnidade'})
        input_nome = linha.find('input', {'name': 'nomeUnidade'})
        btn_resto = linha.find('button', {'id': 'btn_resto'})

        if not (input_mcu or input_nome or btn_resto):
            continue

        mcu = input_mcu['value'].strip() if input_mcu else 'N/A'
        unidade = input_nome['value'].strip() if input_nome else 'DESCONHECIDA'

        if filtros:
            corresponde = any(f in unidade.upper() or f in mcu for f in filtros)
            if not corresponde:
                continue

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

@app.route('/', methods=['GET'])
def home():
    return jsonify({
        'status': 'online',
        'mensagem': 'API SGPD Resíduos operando no Vercel'
    })

@app.route('/api/analisar', methods=['POST', 'OPTIONS'])
def analisar():
    if request.method == 'OPTIONS':
        return jsonify({'ok': True}), 200

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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
