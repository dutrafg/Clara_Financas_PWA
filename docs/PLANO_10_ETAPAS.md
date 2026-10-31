# Clara Finanças PWA Local — plano de desenvolvimento em 10 etapas

**Origem dos requisitos:** `Clara_Financas_Dashboard_Pro.xlsx` (6 abas: Painel, Movimentações, Planejamento, Ajustes, Assistentes e Conferências).
**Identidade visual:** Clara independente, com princípios de navegação do EvoluFísico2; não copiar dados de alunos, regras clínicas ou banco do EvoluFísico2.
**Arquitetura:** A — PWA local, sem backend e com dados no dispositivo. A opção de pasta funciona como **espelho JSON de recuperação** quando suportada pelo navegador, não como banco de dados compartilhado.
**Regra de execução:** somente marcar uma etapa concluída quando seus testes e critérios específicos estiverem satisfeitos. Atualizar identificação de etapa em aplicativo, histórico e entrega.

| Etapa | Escopo e critério de aceite | Situação |
|---|---|---|
| **01** | **Auditoria das 6 abas, motor monetário em centavos, competência por data efetiva de pagamento, pendente/cancelado/realizado, transferência neutra, migração de backup v1→v2, integridade e testes com planilha.** Comparação dos valores-caches e testes de interface devem passar. | **CONCLUÍDA (v0.2.0)** |
| **02** | **Arquitetura técnica e design:** migrar para React, TypeScript e Vite; manter PWA e banco local; adaptar design do EvoluFísico2, responsividade e navegação sem regredir funcionalidades da etapa 01. | **EM HOMOLOGAÇÃO (v0.3.0):** interface, regressão e prévia aprovadas; npm/Vite build oficial e PWA instalada pendentes. |
| **03** | **Movimentações completas:** cadastro, pesquisa, filtros, datas, duplicidades, agendamentos e importação estruturada, com casos positivos/negativos de integridade. | Pendente |
| **04** | **Assistentes:** parcelamento de 1 a 60 parcelas e datas mensais, última parcela compensando centavos; lotes com confirmação, recorrências e cancelamentos coerentes. | Pendente |
| **05** | **Ajustes:** categorias, contas/cartões, saldos iniciais, meta de economia e data de acompanhamento; atualização das listas em todos os módulos. | Pendente |
| **06** | **Planejamento:** orçamento previsto/realizado, metas, dívidas e contratos, classificação de risco e projeções integradas. | Pendente |
| **07** | **Conferências:** saldos de extrato, conciliação por conta, diferenças, busca refinada e histórico de auditoria. | Pendente |
| **08** | **Dashboard Pro:** indicadores da planilha, alertas de atraso e vencimento, classificação de saúde financeira, projeções, gráfico anual, navegação acionável e design clean. | Pendente |
| **09** | **Relatórios e exportações:** relatórios por período/conta/categoria, PDF profissional, CSV consistente, trilha de alterações e exportação integral. | Pendente |
| **10** | **PWA local comercializável:** persistência robusta, permissões de pasta, recuperação, criptografia de backup opcional, teste real offline no Android/Windows, atualizações seguras, acessibilidade, regressões e documentação. | Pendente |

## Mapeamento auditado da planilha

- **Painel:** somatórios por ano/mês da data efetiva (Movimentações K, L e M), somente Realizado (N), saldos das contas (Ajustes H), indicadores de prioridades e gráfico anual.
- **Movimentações:** A=data/vencimento; I=data do pagamento; K=data efetiva (I, se preenchida; caso contrário A); D=tipo; E=valor; F/H=contas; G/N=situação; J=impacto de receita/despesa; O=diagnóstico; P=priorização; Q=coincidência; R=filtros; S=data futura.
- **Planejamento:** D=despesa realizada; E=realizada + pendente; F=disponível; G=uso; H=faixa/limite; metas, dívidas e contratos.
- **Ajustes:** cadastro de categorias e contas, saldo inicial e saldo calculado, data de acompanhamento e meta de economia.
- **Assistentes:** parcelas de 1 a 60 com EDATE e ajuste do resíduo na última parcela; saída pendente.
- **Conferências:** extrato da conta versus saldo calculado, diferenças, filtro de lançamentos e síntese financeira.

A Etapa 01 implementa o motor base de lançamento e caixa, mas **não representa a conclusão das funções de Assistentes, Conferências ou Painel**. Elas são entregas próprias nas etapas 04, 07 e 08.

## Aceite da Etapa 01 — v0.2.0

- [x] Inventário das seis abas e dependências principais.
- [x] `amountCents` inteiro com validação de moeda brasileira.
- [x] `date` (vencimento) e `paidAt` (pagamento) salvos separadamente no formulário, no banco e no backup.
- [x] Lançamentos realizados contabilizados no mês da data efetiva; pendentes no mês do vencimento; cancelados neutros.
- [x] Transferências não inflam receitas e despesas; saldos por conta preservados.
- [x] Projeções orçamentárias contabilizam realizado + pendente.
- [x] Migração explícita e conservadora de schema 1 para schema 2, incluindo backup em pasta.
- [x] IDs de lançamentos/contas/metas e nomes de categorias/contas validados contra duplicação.
- [x] Formulários/tabelas/CSV expõem vencimento e pagamento quando aplicável.
- [x] 61 valores-caches calculados da planilha Excel coincidem com o motor da versão atual.
- [x] 31 cenários financeiros, 12 verificações isoladas do armazenamento e 13 fluxos visuais aprovados.
- [x] 19 verificações anteriores mantidas e regressão visual de preview aprovada.
- [x] Código da etapa 1 empacotado sem qualquer publicação no GitHub.

**Limitação explícita:** Chromium no ambiente de testes bloqueou navegação para `file://`, `localhost` e domínio virtual. Logo, não houve validação E2E real do IndexedDB e Service Worker em origem HTTP/HTTPS; estes testes e a seleção física de pasta estão previstos na etapa 10 e precisam ser executados em dispositivo/navegador compatível. Os testes de persistência desta etapa usam simulador de API, não substituem prova em hardware.
