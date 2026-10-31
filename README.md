# Clara Finanças RC3.5 — PWA em homologação

App offline de finanças pessoais, com seis módulos, tema violeta/azul/petróleo, Configurações por último e navegação flutuante **somente para smartphones** (até 760px). Primeira abertura sem dados fictícios: uma conta neutra com saldo R$0 e categorias predefinidas.

**Build Vercel:** Node.js 20+, framework *Other*, `npm run build`, saída `dist/`. `npm test` executa verificações estáticas; o workflow testa Chromium, Service Worker, base vazia e offline. Para instalar, abra o endereço HTTPS no Chrome Android ou Chrome/Edge Windows e use Instalar App. Ao migrar de `file://` ou de outro endereço, exporte/importar JSON; os armazenamentos são separados.

**Segurança:** os dados financeiros da RC3.5 ficam em `localStorage` sem criptografia em repouso. Não são enviados a servidor, mas não estão protegidos contra leitura de quem tenha acesso ao perfil do navegador. É **prévia técnica** e não versão comercial homologada. A RC2 React com cofre criptografado continua preservada na branch de homologação. Antes do uso com dados sensíveis, integrar o cofre e testar Android/Windows físico.
