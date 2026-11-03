# Especificação Técnica — Engenharia de Features, YOLO, Serialização TOON e Prompt de 10 Blocos

## 1. Engenharia de Features e Recomendação Neural

### 1.1. Fórmula de Normalização Min-Max
Para qualquer variável contínua $x \in \{\text{idade}, \text{preço}\}$:
$$\text{normalizeMinMax}(x, \min, \max) = \begin{cases} 0, & \text{se } \max = \min \\ \frac{x - \min}{\max - \min}, & \text{se } \max > \min \end{cases}$$

### 1.2. Codificação Categórica Ponderada (`oneHotWeighted`)
Dado um índice categórico $i$ num vocabulário de tamanho $K$ e um peso $w \in (0, 1]$, o vetor resultante $v \in \mathbb{R}^K$ possui:
$$v_j = \begin{cases} w, & \text{se } j = i \\ 0, & \text{se } j \neq i \end{cases}$$

Pesos aplicados na montagem do vetor de features do produto:
- **Categoria (`categoryWeight`):** $0.40$
- **Cor (`colorWeight`):** $0.25$
- **Preço Normalizado (`priceWeight`):** $0.20$
- **Idade Média dos Compradores Normalizada (`avgBuyerAgeWeight`):** $0.15$

### 1.3. Vetor de Perfil do Utilizador
- **Com histórico ($N \ge 1$ produtos comprados):** Empilha os vetores de features dos produtos comprados com `tf.stack(productTensors)` e calcula a média no eixo $0$ (`tf.mean(..., 0)`).
- **Sem histórico (Cold Start, $N = 0$):** Gera um vetor de fallback onde as dimensões categóricas e de preço assumem valor neutro/médio e a componente de idade recebe a idade normalizada do utilizador ponderada por `avgBuyerAgeWeight`.

---

## 2. Agente Visual YOLO no Browser

1. **Captura:** `const bitmap = await createImageBitmap(canvasElement)` transferido via `postMessage({ type: 'FRAME', bitmap }, [bitmap])` para o Worker.
2. **Pré-processamento (`tf.tidy`):**
   ```ts
   const inputTensor = tf.tidy(() =>
     tf.browser.fromPixels(bitmap)
       .resizeBilinear([640, 640])
       .div(255.0)
       .expandDims(0)
   );
   ```
3. **Filtragem e Centro da Bounding Box:**
   - Considera apenas detecções com `score >= 0.40`.
   - Para cada caixa $[x_1, y_1, x_2, y_2]$:
     $$\text{centerX} = x_1 + \frac{x_2 - x_1}{2}$$

---

## 3. Pipeline RAG: Serialização JSON Tabular, TOON e 10 Blocos Anti-Alucinação

### 3.1. Formatos de Serialização da Fonte da Verdade

Dado um conjunto de chunks recuperados do Neo4j com `id`, `title`, `section`, `videoMinute`, `score` e `text`:

#### A. JSON Tabular
Separa o cabeçalho (`columns`) das linhas (`rows`), eliminando a repetição das chaves em cada objeto:
```json
{
  "columns": ["id", "title", "section", "videoMinute", "score", "text"],
  "rows": [
    ["c1", "Manual Câmera Pro", "Lentes e Foco", "04:15", 0.92, "O foco contínuo opera em 60fps..."]
  ]
}
```

#### B. TOON (Token Oriented Object Notation)
Notação orientada à economia extrema de tokens com cabeçalho tipado por delimitadores compactos:
```text
@schema[id|title|section|videoMinute|score|text]
c1|Manual Câmera Pro|Lentes e Foco|04:15|0.92|O foco contínuo opera em 60fps...
```

### 3.2. Estrutura dos 10 Blocos Anti-Alucinação

Todo prompt enviado ao LLM Router (`Ollama -> OpenRouter`) é validado contra a presença dos 10 blocos obrigatórios:

1. **`contexto` (`context`):** Papel do assistente e domínio da plataforma.
2. **`tom` (`tone`):** Diretriz de comunicação (objetivo, técnico, preciso).
3. **`fonte da verdade` (`sourceOfTruth`):** Dados recuperados do Neo4j serializados em `JSON Tabular` ou `TOON`.
4. **`contrato operacional` (`operationalContract`):** Regra estrita de responder apenas com base na fonte da verdade e citar `[título | secção | minuto]`.
5. **`exemplos` (`examples`):** Few-shot curto demonstrando citação correta vs. recusa segura quando a informação não consta nos chunks.
6. **`histórico` (`history`):** Resumo compacto das interações recentes da sessão.
7. **`pedido` (`request`):** A pergunta atual do utilizador.
8. **`raciocínio` (`reasoning`):** Instrução de verificação passo a passo entre a pergunta e os chunks antes de redigir a resposta.
9. **`formato` (`format`):** Especificação do schema de saída esperado.
10. **`restrições` (`constraints`):** Proibição explícita de inventar fatos, extrapolar metadados ou omitir a fonte.

