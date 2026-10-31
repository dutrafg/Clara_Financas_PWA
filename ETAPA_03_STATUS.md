# Etapa 3/10 — Movimentações completas

**Status:** código 0.4.0 RC preparado e testado localmente; aguardando publicação do pacote e homologação do GitHub Actions.

## Escopo da RC
- Receitas, despesas, transferências e quitação/reabertura.
- Recorrências finitas (2 a 24, semanal/mensal/anual), com ocorrências independentes.
- Busca, filtros por conta/categoria/status, intervalo, atrasos, ordenação e data-base.
- Importação/exportação CSV, rejeição de dados inválidos e prevenção de duplicidades.
- Banco IndexedDB v2 e backups antigos preservados; interface responsiva.

## Testes antes da publicação
- 31 cenários da Etapa 1, 12 verificações do banco, 12 da Etapa 2.
- 57 testes novos de motor, recorrências e CSV.
- TypeScript em validação offline; revisão visual/funcional da prévia HTML no Chromium.

## Critérios para concluir
1. Enviar **clara-etapa03.zip** para esta branch.
2. O workflow **Homologar Clara Finanças Etapa 03** deverá extrair o pacote, confirmar as dependências e publicar as fontes nesta branch.
3. A compilação oficial `npm run build`, `npm test` e o teste de Chromium/IndexedDB/Service Worker/offline precisam passar.
4. Não enviar dados pessoais reais; não atualizar `main` sem aprovação.

O parcelamento de compras com juros e ajuste de centavos pertence à Etapa 4.
