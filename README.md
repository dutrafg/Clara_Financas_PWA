> **Clara Finanças 1.0.0 RC1 — Etapas 7 a 10 em homologação.** Confira [o relatório e checklist físico](docs/RELATORIO_ETAPAS_07_A_10.md).

# Clara Finanças — RC1 | Segurança, Conciliação, Dashboard Pro e Relatórios

Migração da interface para **React + TypeScript + Vite**. Projeto independente com identidade visual inspirada no EvoluFísico2. É uma **PWA local**: o banco principal é IndexedDB e o usuário pode criar uma cópia JSON em uma pasta escolhida, quando houver suporte no navegador. Não há login, servidor, API bancária ou coleta remota de dados.

## Instalação e execução do PWA

**Requisitos:** Node.js 22.12+ (ou 20.19+), npm e conexão com a internet para instalar as dependências, uma única vez.

```sh
npm install
npm run dev
```

Abra `http://localhost:5173` no computador. Para compilar os arquivos publicáveis:

```sh
npm run build
npm run preview
```

Publique o diretório `dist/` em uma hospedagem estática HTTPS; no Vercel, use *Framework: Vite*, build `npm run build`, diretório `dist`. O desenvolvimento e a publicação não necessitam de backend. **O pacote-fonte sem `node_modules` não deve ser aberto diretamente como `index.html`: é preciso rodar o Vite ou publicar a compilação.**

### Teste rápido no Android

Existe, separado do ZIP, um `Clara_Financas_Preview_Etapa_02_Android.html`. Ele contém uma **prévia autocontida para avaliar o visual e os fluxos**, usando um adaptador temporário de React e banco simulado **em memória**. **Não guarde dados reais nesta prévia:** eles podem desaparecer ao fechar. A PWA compilada usa IndexedDB real.

## Módulos implementados e preservados

- Dashboard: receitas, despesas, resultado, saldo global, gráfico de 12 meses, categorias, últimas movimentações, acompanhamento.
- Movimentações: criar, editar, excluir, buscar, filtrar e manter datas de vencimento/pagamento, status e transferências.
- Contas/cartões: saldos por conta, edição, cadastro e exclusão protegida.
- Planejamento: orçamento mensal, projeção de realizado + pendente, metas.
- Relatórios: resumo anual, exportação CSV (com proteção contra fórmulas) e impressão/PDF do navegador.
- Configurações: tema claro/escuro, destaque petróleo/azul, privacidade visual, pasta local, exportação/restauração JSON, demonstração e base vazia.

## Integridade e migração

O motor da etapa 01 está em `src/legacy/core.mjs` e o acesso persistente em `src/legacy/db.mjs`, consumidos por adaptadores tipados em `src/domain/`. As regras não foram reescritas na migração visual para evitar divergência. O banco mantém **o mesmo nome** `clara-financas-local-v1`, **o mesmo esquema v2**, os dados em centavos, IDs e datas. A reabertura no **mesmo endereço/origem** deve usar os dados antigos; domínios diferentes têm armazenamento separado — faça exportação/importação JSON.

A pasta local é um **espelho de recuperação**, não um banco compartilhado/sincronizado. A seleção direta requer navegador compatível, HTTPS ou localhost e permissão do usuário. Em outros navegadores use **Exportar backup** e **Restaurar arquivo**.

## Testes

```sh
npm test
```

No ambiente com Python e Playwright:

```sh
python tests/ui_flows_stage2.py
python tests/browser_stage2.py
```

`tsc -p tsconfig.offline-test.json --pretty false` valida a estrutura tipada usando declarações mínimas *exclusivas de teste*. A compilação oficial `npm run build` precisa das dependências reais.

**Status de homologação:** a interface, os cálculos herdados, a prévia e a checagem tipada offline foram validados. A instalação npm, o build oficial Vite e o funcionamento do Service Worker/IndexedDB instalado em dispositivo real **não foram executados neste ambiente por bloqueio de acesso ao registro npm/navegação**. Não classificar como versão final homologada; consultar `docs/RELATORIO_ETAPA_02.md`.

## Limites de escopo

Parcelamentos automáticos (etapa 4), conciliação com extratos (etapa 7), dashboard Pro avançada (etapa 8), relatórios profissionais (etapa 9) e teste PWA em hardware (etapa 10) permanecem pendentes.

> Não execute `npm install` em arquivos extraídos dentro de um visualizador de ZIP. Extraia antes para uma pasta local e instale em terminal no Windows/macOS/Linux.

## Revisão RC2 — verificação de conclusão da Etapa 2

Adicionados testes E2E de produção (`tests/e2e_production.py`), workflow de CI (`.github/workflows/validar-etapa-02.yml`) e revisor de IndexedDB/SW reais (`qa-pwa/`). **A conclusão permanece bloqueada** por impossibilidade de instalar os pacotes npm e abrir localhost neste ambiente. Consulte `docs/RESULTADO_FINAL_TENTATIVA_ETAPA_02.md` para evidências, limites e comandos de aceite.


## Homologação privada no GitHub

Ver [Guia de publicação e critérios](docs/GUIA_GITHUB_HOMOLOGACAO.md). Branch de homologação: `homologacao/etapa-02`; sem publicação automática na `main`.
