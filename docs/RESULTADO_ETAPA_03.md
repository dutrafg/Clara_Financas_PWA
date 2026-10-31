# Clara Finanças — Etapa 3/10: Movimentações completas

Versão candidata: **0.4.0 RC**. Branch: `homologacao/etapa-03` (não publicar na main até aceite).

## Escopo entregue

- Registro, edição e exclusão de receitas, despesas e transferências, com validação de valores inteiros em centavos.
- Data de vencimento independente da data efetiva; pendente/cancelado não altera saldo, realização produz os efeitos no caixa, transferência movimenta duas contas sem afetar resultado.
- Confirmação de pagamentos com data local e reabertura de pagamentos, com remoção do pagamento antigo.
- Criação de séries finitas de 2 a 24 ocorrências semanais, mensais e anuais; próximas ocorrências pendentes, cada uma com ID próprio. Datas como 31 de janeiro e 29 de fevereiro são tratadas com ancoragem/clamp.
- Alteração de ocorrência individual, sem afetar demais itens da série, e persistência do identificador de agrupamento.
- Filtros por busca, tipo, situação, conta (origem e destino), categoria, data-base (vencimento ou efetiva), intervalo, ordenação, atrasados e visualização de todos os meses.
- Indicadores de despesas realizadas, valores a receber/pagar e total filtrado.
- Identificação preventiva de lançamentos aparentemente duplicados pelo mesmo valor, descrição, tipo, conta e vencimento.
- Importação CSV estruturada do próprio Clara, com validação do cabeçalho, datas, contas, categorias, valores, duplicidades e transação atômica. A exportação permanece disponível.
- Exibição clara de status e atrasos no módulo de movimentações.
- Preservação do banco `clara-financas-local-v1`, esquema v2, backups JSON anteriores e cópia em pasta compatível.

## Exclusões desta etapa

- Parcelamentos com juros, juros compostos, fechamento de cartão e compras parceladas: **Etapa 4**.
- Conciliação de extratos e auditoria completa: **Etapa 7**.
- A recorrência é **finita e materializada** no cadastro, não uma agenda infinita ou execução automática em segundo plano.

## Aceite e riscos

Executar `npm test`, `npm run build`, `python tests/e2e_production.py` no GitHub Actions. Confirmar os casos de migração de dados, parcelas distintas, competência, duplicidade, datas-borda, filtros, quitação e persistência após reload. Não validar a seleção de pasta física no Android com testes headless; manter para homologação física na Etapa 10.

**Status do documento:** código concluído; homologação remota depende do resultado registrado no Actions para o SHA efetivamente publicado.
