# Clara Finanças RC3.6 — PWA em homologação

App offline de finanças pessoais, com seis módulos, tema violeta/azul/petróleo, Configurações por último e navegação flutuante **somente para smartphones** (até 760px). Primeira abertura sem dados fictícios: uma conta neutra com saldo R$0 e categorias predefinidas.

**Build Vercel:** Node.js 20+, framework *Other*, `npm run build`, saída `dist/`. `npm test` executa verificações estáticas; o workflow testa Chromium, Service Worker, base vazia e offline. Para instalar, abra o endereço HTTPS no Chrome Android ou Chrome/Edge Windows e use Instalar App. Ao migrar de `file://` ou de outro endereço, exporte/importar JSON; os armazenamentos são separados.

**Segurança:** os dados financeiros da RC3.6 ficam em `localStorage` sem criptografia em repouso. Não são enviados a servidor, mas não estão protegidos contra leitura de quem tenha acesso ao perfil do navegador. É **prévia técnica** e não versão comercial homologada. A RC2 React com cofre criptografado continua preservada na branch de homologação. Antes do uso com dados sensíveis, integrar o cofre e testar Android/Windows físico.

## Contrato obrigatório de atualização entre versões

A fonte canônica é `index.html` + `manifest.webmanifest` + `sw.js` + `version.json` e os ícones em `assets/`. A publicação na Vercel usa exclusivamente `dist/` produzido por `npm run build`. Não reutilizar arquivos da pasta `dist/` de uma versão anterior.

**Sempre que uma versão for criada:**
- Atualizar `package.json` e `version.json` para o mesmo identificador de versão, e conferir título/rotulagem do HTML.
- Usar caminhos relativos para Service Worker, manifest e ícones. O manifesto declara `id`, `start_url` e `scope` como `./`, para não fixar a instalação na raiz de outra versão.
- O build verifica os arquivos referenciados antes de copiar e gera o nome do cache com **versão + hash SHA-256** do HTML, manifesto, versão e ícones. Assim, alterações feitas sem mudança de versão também renovam o cache.
- O Service Worker armazena a distribuição nova somente após pré-carregar os recursos; na ativação, elimina apenas os caches antigos cujo nome começa com `clara-financas-`. O `version.json` é consultado na rede quando disponível e usa o cache somente como fallback offline.
- Executar `npm test && npm run build && npm run verify:paths` e o workflow Chromium offline, sempre na branch de homologação, **antes de integrar à `main`**.
- Verificar se o acesso PWA, relatórios, backup/restauração, menu, formulários e 15 miniaplicativos ainda apontam para as mesmas funções e IDs. Na migração de dados, preservar a chave de armazenamento e o schema antigo ou criar migração validada, nunca renomeá-los silenciosamente.
- Se uma referência antiga quebrada for encontrada, bloquear a publicação até restaurá-la ou implementar uma migração/redirect verificável. Registrar essa alteração nas notas de versão.

**Segurança ainda pendente:** o armazenamento desta prévia continua em `localStorage`, sem cofre criptografado. Homologar criptografia, migração e proteção inicial antes de armazenar dados financeiros reais.
