# Clara Finanças — Etapa 6/10 | Homologação concluída

**Versão:** 0.7.0 RC  
**Branch:** `homologacao/etapa-06`  
**Status:** desenvolvimento concluído, validação financeira e teste real de navegador automatizado aprovados. A `main` permanece inalterada.

## Entregas
- Controle de dívidas com credor, valor total, pagamentos históricos previamente realizados, prestação de referência, vencimento final e categoria.
- Registro de **pagamento efetivo vinculado a uma dívida**, gerando uma única movimentação de despesa realizada. O cadastro da obrigação por si só **não** reduz o saldo em conta.
- Proteção contra pagamento superior ao saldo pendente, categoria inexistente, datas inválidas e exclusão de dívida com pagamentos vinculados.
- Dívidas preservadas em backup local; vínculos de pagamentos conferidos e protegidos contra alteração inconsistente.
- Acompanhamento de metas com cálculo do aporte mensal necessário, considerando saldo informado, alvo e prazo.
- Projeção de fluxo de caixa para seis meses (motor suporta 1 a 12), a partir de transações **realizadas e pendentes já cadastradas**, com cálculo por competência de pagamento/vencimento e neutralidade das transferências entre contas.
- Ajuste da renomeação de categorias para manter o vínculo com dívidas.
- Compatibilidade com backups antigos v1/v2 por migração aditiva sem alteração do esquema v2.
- Interface integrada ao módulo Planejamento, responsiva e compatível com temas claro/escuro.

## Evidências de homologação
- **[GitHub Actions — execução 41163860900](https://github.com/dutrafg/Clara_Financas_PWA/actions/runs/41163860900)**: `success` (todos os jobs).
- `npm test`: aprovado, incluindo **82 novos testes da Etapa 6**, 77 da Etapa 5, 67 da Etapa 4 e 57 da Etapa 3, mais as suítes anteriores.
- `npm run build`: TypeScript e Vite aprovados.
- Teste Chromium + Playwright: Service Worker, IndexedDB real, 63 exemplos, backup JSON offline, interface móvel, módulos anteriores, cadastro de dívida, pagamento associado e persistência após recarregar aprovados.
- Evidências em artefato GitHub Actions `clara-etapa06-evidencias` (retenção temporária).

## Limites e transparência dos dados
- **Previsão não é promessa de saldo futuro.** O simulador considera exclusivamente os lançamentos existentes. Não extrapola salários, despesas novas, taxas variáveis ou gastos atrasados anteriores ao início da projeção.
- Pagamentos já efetuados **antes de registrar a dívida** entram como saldo histórico informado e não geram lançamentos automáticos.
- O valor `savedCents` das metas continua como reserva **declarada manualmente** e não movimenta contas bancárias.
- Não são calculados CET, IOF ou amortizações contratuais de operações de crédito; as dívidas representam obrigações informadas pelo usuário.
- O backup exportado não é criptografado. O repositório está público; nunca comitar registros financeiros pessoais.
- Instalação PWA em dispositivo físico e acesso à pasta externa serão homologados na Etapa 10.

## Correção de regressão — pagamento de dívida (31/10/2026)
- Corrigida a perda de `debtId` ao editar um lançamento originado de pagamento de dívida.
- Edição e reabertura passam por `reviseDebtPayment`: mantém o vínculo com o credor, obriga tipo e categoria compatíveis e bloqueia valores acima do saldo restante.
- Exclusão passa por `removeDebtPayment`, com confirmação explícita na interface, preservando a dívida e recalculando sua evolução.
- A validação de backup exige a mesma categoria entre pagamento e dívida.
- Foram acrescentados **36 testes de regressão**: o conjunto da Etapa 6 passou de 82 para **118 verificações**.
- Teste ponta a ponta acrescentado para editar o valor do pagamento, reabrir, excluir e conferir o IndexedDB e os saldos após recarregar.
- **Homologação completa aprovada:** [GitHub Actions 41166156199](https://github.com/dutrafg/Clara_Financas_PWA/actions/runs/41166156199), incluindo testes das etapas 1–6, TypeScript, Vite e Chromium móvel.
- Restrições anteriores mantidas: testes em Android físico, seleção de pasta e segurança dos backups permanecem na Etapa 10.

**Próxima etapa:** 7/10 — Conciliação financeira, auditoria e correção de inconsistências.
