// Backend serverless (Vercel) — guarda a chave do Gemini em segredo.
// O site chama /api/roteiro; aqui validamos a senha e falamos com a IA.
//
// Variáveis de ambiente (configuradas no painel do Vercel, nunca no código):
//   GEMINI_KEY       -> sua chave da API do Google Gemini
//   ACCESS_PASSWORD  -> a senha de acesso que você define

// Coleta todas as chaves do Gemini configuradas (para rotação):
//   GEMINI_KEY, GEMINI_KEY_2, GEMINI_KEY_3 ... (até 8) e/ou
//   GEMINI_KEYS = "chave1,chave2,chave3" (separadas por vírgula)
function coletarChaves() {
  const keys = [];
  if (process.env.GEMINI_KEY) keys.push(process.env.GEMINI_KEY.trim());
  for (let i = 2; i <= 8; i++) {
    const k = process.env["GEMINI_KEY_" + i];
    if (k) keys.push(k.trim());
  }
  if (process.env.GEMINI_KEYS) {
    process.env.GEMINI_KEYS.split(",").map(s => s.trim()).filter(Boolean).forEach(k => keys.push(k));
  }
  return [...new Set(keys.filter(Boolean))];
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  const { prompt, aoVivo, schema, senha } = req.body || {};

  // 1) Confere a senha de acesso
  if (!process.env.ACCESS_PASSWORD) {
    return res.status(500).json({ error: "Servidor sem senha configurada (ACCESS_PASSWORD)." });
  }
  if (!senha || senha !== process.env.ACCESS_PASSWORD) {
    return res.status(401).json({ error: "Senha de acesso incorreta." });
  }

  // 2) Confere os dados e a chave da IA
  if (!prompt) {
    return res.status(400).json({ error: "Faltou o pedido (prompt)." });
  }
  const keys = coletarChaves();
  if (!keys.length) {
    return res.status(500).json({ error: "Servidor sem chave da IA configurada (GEMINI_KEY)." });
  }

  // 3) Monta o corpo da requisição para o Gemini
  function montarCorpo(usarBusca) {
    const corpo = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 16384 }
    };
    if (usarBusca) {
      corpo.tools = [{ google_search: {} }]; // busca na web (grounding)
    } else if (schema) {
      corpo.generationConfig.responseMimeType = "application/json";
      corpo.generationConfig.responseSchema = schema;
    }
    return corpo;
  }

  // Ordem de tentativas — degrada com elegância quando bate o limite (429):
  //   1) modelo principal, COM busca na web se o usuário pediu
  //   2) modelo principal SEM busca (o grounding do Google Search tem cota
  //      gratuita separada e bem menor — costuma ser o primeiro a estourar)
  //   3) modelo "lite" (limites gratuitos maiores), sem busca
  const tentativas = [{ modelo: "gemini-2.5-flash", busca: !!aoVivo }];
  if (aoVivo) tentativas.push({ modelo: "gemini-2.5-flash", busca: false });
  tentativas.push({ modelo: "gemini-2.5-flash-lite", busca: false });

  // 4) Executa as tentativas; dentro de cada uma, roda todas as chaves (rotação
  //    a partir de um ponto aleatório para distribuir a carga).
  let erroFinal = null, statusFinal = 429;
  for (const t of tentativas) {
    const bodyStr = JSON.stringify(montarCorpo(t.busca));
    const inicio = Math.floor(Math.random() * keys.length);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[(inicio + i) % keys.length];
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${t.modelo}:generateContent?key=${encodeURIComponent(key)}`;
        const r = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: bodyStr
        });
        const j = await r.json();
        if (r.ok) {
          const cand = j.candidates && j.candidates[0];
          let texto = "";
          if (cand && cand.content && cand.content.parts) {
            texto = cand.content.parts.map(p => p.text || "").join("");
          }
          return res.status(200).json({ text: texto });
        }
        erroFinal = (j && j.error && j.error.message) || JSON.stringify(j);
        statusFinal = r.status;
        if (r.status === 429) continue; // esta chave no limite -> tenta a próxima chave
        break;                          // outro erro -> parte para a próxima tentativa (fallback)
      } catch (e) {
        erroFinal = "Falha ao contatar a IA: " + (e.message || e);
        statusFinal = 502;
      }
    }
    // esta tentativa não retornou sucesso -> segue para o fallback seguinte
  }

  // Nada funcionou: repassa o melhor erro que obtivemos
  return res.status(statusFinal).json({ error: erroFinal || "Todas as chaves atingiram o limite. Tente novamente em 1 minuto." });
}
