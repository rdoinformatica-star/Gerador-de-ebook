// Backend serverless (Vercel) — guarda a chave do Gemini em segredo.
// O site chama /api/roteiro; aqui validamos a senha e falamos com a IA.
//
// Variáveis de ambiente (configuradas no painel do Vercel, nunca no código):
//   GEMINI_KEY       -> sua chave da API do Google Gemini
//   ACCESS_PASSWORD  -> a senha de acesso que você define

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
  const key = process.env.GEMINI_KEY;
  if (!key) {
    return res.status(500).json({ error: "Servidor sem chave da IA configurada (GEMINI_KEY)." });
  }

  // 3) Monta a requisição para o Gemini
  const modelo = "gemini-2.5-flash";
  const corpo = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 16384 }
  };
  if (aoVivo) {
    corpo.tools = [{ google_search: {} }]; // busca na web
  } else if (schema) {
    corpo.generationConfig.responseMimeType = "application/json";
    corpo.generationConfig.responseSchema = schema;
  }

  // 4) Chama a IA e devolve só o texto gerado
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${encodeURIComponent(key)}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corpo)
    });
    const j = await r.json();
    if (!r.ok) {
      const detalhe = (j && j.error && j.error.message) || JSON.stringify(j);
      return res.status(r.status).json({ error: detalhe });
    }
    const cand = j.candidates && j.candidates[0];
    let texto = "";
    if (cand && cand.content && cand.content.parts) {
      texto = cand.content.parts.map(p => p.text || "").join("");
    }
    return res.status(200).json({ text: texto });
  } catch (e) {
    return res.status(500).json({ error: "Falha ao contatar a IA: " + (e.message || e) });
  }
}
