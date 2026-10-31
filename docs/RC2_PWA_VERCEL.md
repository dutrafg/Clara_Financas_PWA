# Clara Finanças — RC2 Integrada | PWA, Vercel e segurança

**Situação:** candidata de homologação, antes de promoção para `main`.

## Referência arquitetural

O projeto `dutrafg/Evolufisico2` foi consultado em seu código de produção (`sw.js`, `vercel.json`, `manifest.webmanifest` e `version.json`). O Clara reaproveita apenas as práticas gerais:

- PWA instalável com `manifest.webmanifest` e HTTPS.
- `Service Worker` com cache versionado de **toda uma release**; instalação é considerada completa somente depois de baixar HTML, CSS, JavaScript e ícones.
- Arquivos de uma mesma versão são servidos juntos quando offline. Evita HTML antigo carregando scripts de nova publicação.
- `sw.js` nunca fica preso no cache HTTP da Vercel.
- Atualizações são detectadas e aplicadas após confirmação do usuário. O IndexedDB não é limpo durante atualização.
- Vercel hospeda apenas os arquivos estáticos; **nenhum registro financeiro é enviado para a Vercel**.

Diferença técnica: o EvoluFísico2 contém muitas fontes estáticas individuais; o Clara usa React/Vite. Por isso `tools/build-pwa.mjs` lê `dist/`, injeta o manifesto completo de assets compilados no `sw.js` e produz uma chave de cache por hash de conteúdo.

## Instalação e publicação

**Ambiente de build:** Node.js 22+, `npm install`, `npm run build`. O build gera `dist/index.html`, `dist/sw.js` versionado e `dist/version.json`.

**Configuração Vercel:** `framework: vite`, `buildCommand: npm run build`, `outputDirectory: dist`; cabeçalhos de cache e rota SPA em `vercel.json`.

**Android Chrome:** abra o site via HTTPS, use `Adicionar à tela inicial` / `Instalar app`, carregue uma vez os módulos online e teste com modo avião. Nem todos os navegadores Android oferecem seleção de pasta; alternativa: exportar `.clara`.

**Windows Chrome/Edge:** abra o site HTTPS, use `Instalar aplicativo`; verifique o ícone, recarga, atualização e permissão de pasta.

**Firefox Windows:** uso web e offline é possível se o Service Worker for suportado, mas a experiência de instalação e seleção de pasta difere. Não declarar paridade de instalação sem QA físico.

## Banco e backups

- **Padrão de compatibilidade:** o banco local `clara-financas-local-v1` continua legível até a pessoa ativar o cofre nas Configurações.
- **Cofre opcional:** ativa AES-256-GCM, chave derivada por PBKDF2-SHA256 (310 mil iterações), por transação atômica que apaga o registro legível `state` e grava `state-vault`.
- **Abertura:** após atualização da página, o cofre exige senha; não inicializa uma base vazia nem faz fallback para texto claro se a senha estiver errada.
- **Senha esquecida:** não existe recuperação local; restaure cópia externa com senha em um perfil diferente. Não limpe o armazenamento até ter cópia de segurança.
- **Pasta:** grava em `clara-financas-dados.clara` criptografado. Senha de espelhamento mantida apenas em memória durante a sessão; sem senha, o banco salva localmente e avisa que a pasta não foi atualizada.
- **JSON legado:** importação explícita com aviso. Arquivo antigo não é apagado nem sobrescrito ao escolher a pasta; o usuário pode eliminá-lo somente depois de confirmar que existe cópia cifrada.
- **Backup manual:** exportações protegidas `.clara`; o comando de JSON em claro existe apenas para compatibilidade, com confirmação.
- **Limites:** cofre é criptografia do registro em repouso, não defesa contra dispositivo comprometido, extensões maliciosas ou conteúdo já renderizado. Não há sincronização bancária, Open Finance ou nuvem de dados.

## Testes automatizados

`npm test`: finanças das etapas 1–10, backup AES-GCM, migração de cofre e pasta cifrada.

`npm run build`: TypeScript, Vite e geração de lista de arquivos offline por hash.

`python tests/e2e_production.py`: Chromium real, IndexedDB, backup, restauração, bloqueio e desbloqueio, offline, responsividade, relatórios PDF/CSV e validação de assets da release.

## Critérios não concluídos só com CI

- [ ] Instalação e persistência em Android Chrome em aparelho real.
- [ ] Instalação e seleção de pasta em Windows Chrome/Edge reais.
- [ ] Restauração de backup em aparelho ou perfil diferente.
- [ ] Verificação sem rede em PWA instalada depois de reinicializar o dispositivo.
- [ ] Contraste, teclados, navegação e Android com baixa memória.
- [ ] Aprovação explícita para promover `main` e publicar como produção estável.

**Regra:** prévias Vercel podem ser publicadas para QA sem liberar a `main`. Nenhum número de testes automatizados deve ser apresentado como aprovação de testes físicos.
