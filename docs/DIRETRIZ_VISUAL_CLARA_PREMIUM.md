# Clara Finanças — Direção visual de homologação

## Referência
Capturas públicas do perfil `app.optio` no Instagram foram fornecidas pelo usuário. Este arquivo descreve **características gerais de interface** utilizadas como referência; não autoriza uso do logotipo, imagens, ícones proprietários, código, textos promocionais ou identidade de marca da Optio.

## Padrão Clara Premium
- **Identidade própria:** nome Clara, monograma C, gradiente azul-petróleo/turquesa e tipografia já usada no aplicativo.
- **Modo escuro:** grafite profundo (#090f16), cartões (#131c27), linhas discretas (#253243), texto de alto contraste, destaques turquesa (#40d1c0).
- **Modo claro:** mesmo ritmo, com superfícies brancas e divisórias sutis, preservando opção azul.
- **Saldo principal:** bloco protagonista com hierarquia clara (saldo, período, contas ativas, ação útil).
- **KPIs:** receitas, despesas e resultado em cartões compactos de leitura imediata.
- **Categorias:** gráfico de rosca com legenda, percentuais e alternativa textual acessível; valores calculados sobre movimentações realizadas.
- **Planejamento:** escolha funcional de 3, 6 e 12 meses no motor já existente, sem promessas de IA nem rentabilidade.
- **Objetivos e orçamentos:** barras discretas e alertas baseados em dados já cadastrados.
- **Móvel:** cards com espaçamento consistente e barra inferior compacta, adaptada a telas estreitas.
- **Acessibilidade:** foco visível, texto alternativo no gráfico, componentes sem movimento obrigatório, contraste adequado.
- **Desempenho e offline:** a rosca é SVG e CSS, sem imagens remotas, bibliotecas adicionais nem dependência de internet.

## O que não entra no Clara nesta revisão
- Nenhum módulo de investimento, carteira de ativos, Open Finance ou conexão bancária.
- Nenhuma afirmação de categorização automática real quando inexistente.
- Nenhuma previsão financeira via IA: são projeções determinísticas sobre valores cadastrados.
- Nenhuma publicação direta na `main`; manter `homologacao/visual-optio-referencia` isolada da branch `homologacao/rc2-seguranca`.

## Critérios de aprovação
1. `npm test` e `npm run build` aprovados.
2. Chromium com modo escuro e claro, dashboard com saldo e rosca de categorias, layout sem rolagem horizontal.
3. Alterar horizonte 3→12 meses sem recalcular saldos antigos nem apagar dados.
4. Regressões em CSV/PDF, IndexedDB, recorrências, dívidas, backup cifrado e offline intactas.
5. Inspeção manual da interface em Android real antes de publicar.
