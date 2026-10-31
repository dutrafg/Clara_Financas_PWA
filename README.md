# Clara Finanças RC3.5 — PWA offline

Aplicativo de gestão financeira pessoal com seis módulos, Configurações ao final, menu flutuante **somente em smartphones** e sem dados financeiros de demonstração. Contém apenas uma conta inicial de saldo zero e categorias editáveis sem orçamento.

## Executar

`npm install && npm test && npm run build`

O diretório `dist/` pode ser publicado no Vercel como site estático. Este projeto não exige banco remoto.

## Dados e backups

Dados ficam no `localStorage` **sem criptografia**, por origem. Para transferir dados do HTML aberto como arquivo para o PWA hospedado, exporte JSON em Configurações e importe no PWA. Nunca limpe dados do navegador antes de salvar um backup.

## Testes

Testes de lógica via `node --test`, ClaraQA no navegador e Playwright em resolução 320, 390, 600, 768 e 1440px.

## Atenção

A PWA não inclui sincronização entre dispositivos nem integração bancária. Testes em hardware real ainda são recomendados antes de uso financeiro relevante.
