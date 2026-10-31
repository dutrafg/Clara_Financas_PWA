# Clara Finanças — Etapa 4/10 | Parcelamentos e Assistentes Financeiros

**Versão:** 0.5.0 RC  
**Branch:** `homologacao/etapa-04`  
**Status:** desenvolvimento concluído e homologação automatizada aprovada. Nenhuma alteração na `main`.

## Recursos entregues
- Assistente de compras parceladas integrado ao módulo Movimentações, com prévia antes do cadastro.
- Parcelamentos sem juros com distribuição determinística de centavos (ex.: 100,00 / 3 = 33,34 + 33,33 + 33,33).
- Simulação pela **Tabela Price** (juros mensais compostos, amortização e última prestação ajustada para zerar o saldo).
- Entrada opcional (com lançamento próprio), encargos financiados e até 60 parcelas.
- Vencimentos mensais ancorados na data inicial, inclusive 28, 29, 30 e 31.
- Cada parcela é um lançamento independente e inicia **Pendente**. Apenas pagamentos confirmados alteram saldos.
- Identificação e resumo dos grupos: parcelas pagas, pendentes, valores e juros.
- Validação de metadados no esquema existente v2, sem quebrar backups das etapas anteriores; edição da data/conta/situação sem permitir alteração acidental do principal calculado.
- Interface responsiva e manutenção dos temas claro/escuro.

## Homologação
- [Execução GitHub Actions aprovada — etapa 4](https://github.com/dutrafg/Clara_Financas_PWA/actions/runs/41159009615)
- `npm test`: aprovado, incluindo **67 novos testes da etapa 4** e as suítes das etapas 1, 2 e 3.
- `npm run build`: TypeScript + Vite aprovados.
- Chromium + Playwright: Service Worker, IndexedDB real, recarga, offline, backup JSON, dispositivos móveis e compra Price 4x com entrada e juros aprovados.
- Evidências em artefato de captura de telas `clara-etapa04-testes` (retenção limitada pelo GitHub).

## Regras de cálculo
- Valores armazenados em centavos inteiros.
- Juros expressos em centésimos de percentual ao mês (1,50% = 150).
- Encargos são incorporados ao valor financiado e sujeitos à taxa informada.
- Sem juros, as diferenças de arredondamento são distribuídas em centavos, sem perda de valor.
- Tabela Price com última parcela ajustada para liquidar exatamente o saldo; o total de juros é conferido contra soma das prestações.
- Não representa cálculo de CET, IOF, seguros ou regras contratuais específicas. Esses componentes só entram quando informados explicitamente como encargos.
- A opção de entrada não é automaticamente marcada como paga.

## Limites de homologação
- O teste automatizado em Chromium não substitui a seleção física de pasta no Android ou Windows; esses casos fazem parte da Etapa 10.
- O backup JSON continua sem criptografia; manter em pasta segura.
- A ausência de conexão bancária foi preservada. Não enviar dados financeiros reais para o GitHub (repositório atualmente público).
- O sistema ainda não implementa todas as fórmulas do Excel: próximas etapas incluem Contas/Ajustes (5), Planejamento/Dívidas (6), Conferências (7), Dashboard (8), Relatórios (9) e homologação final (10).

**Próxima etapa:** 5/10 — Contas, categorias e ajustes.
