# Clara Finanças RC3.2 — Acessibilidade e consistência temporal

Data: 2026-10-31. Branch exclusiva de homologação; nenhuma alteração na `main`.

## Implementado no PWA React

- Confirmação rápida de pagamento passa a pedir a data efetiva (AAAA-MM-DD), rejeita data impossível e mantém o vencimento original.
- O botão móvel é rotulado como confirmação de pagamento, sem sugerir que será automaticamente registrado na data de hoje.
- Cores de categorias estáveis em gráficos circulares.
- Tokens de contraste, legibilidade em tamanho pequeno, indicador de foco visível e toast no topo.
- Versão `1.0.0-rc.3.2` em `package.json` e adaptador do motor.

## HTML independente complementar

Arquivo entregue nesta conversa: `Clara_Financas_RC3_2_HTML_Validacao_Completo.html`.

- Edição e exclusão de contas, movimentações, metas e conferências com validação de referências.
- Data efetiva explícita em novas movimentações e quitações.
- Avisos distintos para corrupção e indisponibilidade do armazenamento.
- Painel de três níveis, tipografia a partir de 12 px, SVG na navegação, contraste WCAG AA ajustado, central de testes em Ajustes.
- 90 autotestes e 13 cenários de interação avaliados em ambiente isolado.

## Evidência PWA

[GitHub Actions #41219224111](https://github.com/dutrafg/Clara_Financas_PWA/actions/runs/41219224111): aprovado (financeiro, TypeScript, Vite, IndexedDB, Service Worker/offline, backup AES-GCM e Chromium).

## Limites

- O HTML é protótipo de demonstração, sem criptografia IndexedDB e sem instalação PWA. Não usar com dados financeiros sensíveis.
- Os testes HTML locais usaram `page.set_content` e substituto de `localStorage`, pois URLs locais e localhost estavam bloqueadas no navegador da execução.
- Instalação em Android e Windows físicos, compatibilidade entre navegadores, axe/Lighthouse e zoom de 200% ainda requerem validação.
- `Cartão` no HTML permanece conta simples, sem ciclo de fatura; não declarar este modelo equivalente a cartão de crédito real.
- Não foi feita publicação da `main` ou do ambiente Vercel de produção.
