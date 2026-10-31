# Clara Finanças — Etapa 5/10 | Homologação concluída

**Versão:** 0.6.0 RC  
**Branch:** `homologacao/etapa-05`  
**Status:** funcionalidades da etapa concluídas, pipeline GitHub Actions aprovado.

## Entregas
- CRUD de contas: criar, editar, arquivar/reativar, excluir contas não utilizadas.
- Bloqueio de exclusão quando existir lançamento referenciando a conta e preservação do saldo/histórico das arquivadas.
- CRUD de categorias: receitas/despesas; arquivamento/reativação e bloqueio de exclusão para categorias utilizadas.
- Renomear categoria atualiza suas movimentações e seus orçamentos vinculados no mesmo commit do banco local; impede mudança de tipo quando já está em uso.
- Seletores de novos lançamentos excluem contas/categorias arquivadas, mantendo as opções antigas quando se edita uma movimentação histórica.
- Preferências: meta mensal em centavos e dia de revisão (1–28). Apresentação de progresso em Planejamento.
- Navegação móvel corrigida para incluir Contas; mantendo seis módulos.
- Banco IndexedDB mantém o nome original e esquema v2; backups v1/v2 migram sem perda dos registros.
- Interface preserva layout, paleta e temas.

## Evidências de teste
- [GitHub Actions — execução aprovada](https://github.com/dutrafg/Clara_Financas_PWA/actions/runs/41160009313)
- `npm test`: todas as suítes aprovadas, incluindo **77 testes novos da Etapa 5**, além dos 57 da Etapa 3 e 67 da Etapa 4.
- `npm run build`: TypeScript e Vite concluídos.
- Chromium: Service Worker, IndexedDB real, 63 exemplos, recarga, backup offline, recorrência, Price, criação/renomeação/arquivamento de categorias, contas e persistência de preferências aprovados.
- Capturas da execução em artefato `clara-etapa05-evidencias` (prazo de retenção do Actions).

## Limitações e salvaguardas
- A meta mensal reflete receitas realizadas menos despesas realizadas, não saldo bancário reservado.
- A edição do saldo inicial altera o saldo histórico; o formulário alerta para realizar backup.
- O armazenamento do navegador não elimina a necessidade de cópias externas.
- A seleção física de pasta e a instalação em Android real serão homologadas na Etapa 10.
- O repositório está público; não inserir backups ou dados reais de contas no GitHub.
- Não foram alteradas a branch `main` nem as versões Android.

**Próxima:** Etapa 6/10 — Planejamento, metas, dívidas e projeções.
