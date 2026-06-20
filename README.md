# Gerador de Roteiro de Viagem

Ferramenta web que cria **roteiros de viagem personalizados com inteligência artificial**.

## O que faz

O usuário informa o destino, número de dias, interesses (restaurantes, museus, praias, experiências únicas...), ritmo e época da viagem. A ferramenta monta automaticamente um roteiro dia a dia, organizado de forma inteligente, com:

- Atividades por período (manhã, tarde, noite), **agrupadas por região** para um deslocamento lógico
- **Fotos** dos locais (via Wikipédia)
- **Estimativa de preços** por atividade
- Botão **"Ver no mapa"** por local e **"Ver rota do dia"** no Google Maps
- **Autocompletar** do destino enquanto digita
- **Salvar** roteiros, **compartilhar no WhatsApp** e exportar em **PDF**

## Como usar

1. Abra o arquivo `index.html` no navegador (duplo clique).
2. Crie uma chave de API **gratuita** do Google Gemini em [aistudio.google.com/apikey](https://aistudio.google.com/apikey) e cole no app.
3. Preencha o formulário e clique em **"Gerar meu roteiro"**.

## Tecnologia

Página única (HTML + CSS + JavaScript), sem dependências externas. Usa:

- **Google Gemini** (`gemini-2.5-flash`) para gerar o roteiro
- **Wikipédia** para as fotos dos locais
- **OpenStreetMap / Photon** para o autocompletar de destino

> ⚠️ **Aviso:** esta é uma versão protótipo — a chave de API fica salva no navegador (localStorage). Para publicar a ferramenta para clientes finais, é necessário um backend que guarde a chave com segurança.
