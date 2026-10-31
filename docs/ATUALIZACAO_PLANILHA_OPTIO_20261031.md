# Atualização da planilha Clara Finanças — 31/10/2026

## Documento de referência

`Clara_Financas_Optio_Todas_As_Abas.xlsx` (fornecido pelo usuário) comparado com `Clara_Financas_Dashboard_Pro.xlsx` (referência anterior).

As seis abas originais foram preservadas: **Painel, Movimentações, Planejamento, Ajustes, Assistentes, Conferências**. Não foram removidos campos de conteúdo existentes; a versão nova adiciona resumos, métricas e áreas de visualização.

| Aba | Principais acréscimos |
|---|---|
| Painel | Saldo disponível após pendências de 30 dias, despesas pendentes 30 dias, reservas, top 5 orçamentos, quatro meses de fluxo pendente, progresso de metas |
| Movimentações | Resumo superior de entradas, saídas, pendências, revisões, acesso rápido ao painel |
| Planejamento | Resumo de limite global, despesas, disponível, uso e categorias fora do limite |
| Ajustes | Resumos de cadastros, contas, saldos e instruções de preenchimento |
| Assistentes | Resumo do parcelamento, média por prestação e validação mais visível |
| Conferências | Diferença líquida, quantidade a conferir e quantidade conciliada |

## Integração PWA — RC3

- Novo cálculo puro em `src/legacy/spreadsheet-insights.mjs`, importado por `src/domain/spreadsheet-insights.ts`.
- Dashboard React passa a mostrar saldo disponível após pendências, pendências até 30 dias, reservas, cinco principais orçamentos, metas e fluxo futuro de quatro meses.
- Os valores respeitam centavos inteiros e são calculados sobre dados cadastrados; não recorrem a IA nem a serviços bancários.
- Não é feita importação automática da planilha para o IndexedDB. O HTML de revisão usa os **63 registros de demonstração** da própria planilha, nunca dados bancários reais.
- A branch `main` permanece inalterada.

## Revisor HTML independente

Arquivo `Clara_Financas_Preview_Planilha_Atualizada_Responsivo.html`, disponibilizado na conversa. Contém seis módulos funcionais e armazenamento local de teste via `localStorage`.

### QA local

- Chromium headless: larguras de 1440, 820, 390 e 320 pixels, sem rolagem horizontal nem erros JavaScript.
- Navegação por seis módulos, edição de orçamentos, conciliação, lançamento avulso, prévia de parcelamento e gravação de seis prestações.
- 22 verificações independentes de modelo financeiro.
- GitHub Actions: 21 novos testes financeiros da planilha e compilação React/Vite aprovados.
- Homologação end-to-end completa permanece condicionada à resolução de uma falha herdada da RC2 na reabertura após desativação do cofre criptografado.

## Segurança e privacidade

O HTML é apenas um revisor offline, sem criptografia de dados locais. Não substitui a RC2 PWA. Não informe nele dados financeiros sensíveis até que a implantação final e os testes de segurança estejam homologados.

**Data:** 31/10/2026.
