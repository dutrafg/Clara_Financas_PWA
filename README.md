# Clara Finanças RC3.6.10 — PWA em homologação

Aplicativo financeiro pessoal com **sete módulos** (Painel, Movimentações, Planejamento, Assistentes, Conferências, Histórico e Configurações). A dashboard oferece **15 miniaplicativos** editáveis. No smartphone (largura de até 760 px), a navegação usa dock/menu flutuante; em telas maiores, usa barra lateral. O primeiro acesso começa sem movimentações fictícias, com conta principal de saldo inicial zero e categorias predefinidas.

**Estado da versão:** candidata a homologação, ainda não liberada como versão comercial ou certificada. A presença de recursos no código não substitui validação de execução em navegadores/dispositivos reais.

## O que mudou na RC3.6.10

- O botão isolado de QA foi removido da barra lateral compacta, evitando controle órfão.
- A Central de QA permanece disponível em **Configurações → Segurança → Manutenção avançada**, além do acesso em Conferências.
- A abertura e o fechamento da Central de QA preservam o foco do teclado, devolvendo-o ao controle de origem.
- Os recursos existentes (atualizador, Perfil, Histórico, cofre e 15 miniaplicativos) foram mantidos. A integridade funcional deve ser confirmada na bateria de testes.

As notas acima devem coincidir com as exibidas pelo aplicativo em `CLARA_RELEASE_NOTES` e no `version.json`.

## Segurança e armazenamento

A RC3.6.10 implementa um **cofre local criptografado**: AES-256-GCM via Web Crypto, chave derivada da senha usando PBKDF2-HMAC-SHA-256 com 310.000 iterações, salt aleatório de 16 bytes e IV aleatório de 12 bytes a cada gravação. A senha de criação requer pelo menos 12 caracteres. A cópia persistida fica no `localStorage`, na chave `clara-financas-vault-aesgcm-v1`, mas o conteúdo financeiro do cofre é cifrado — diferentemente das prévias sem criptografia.

Ao criar o cofre, o aplicativo tenta migrar os dados da chave legada `clara-html-preview-planilha-optio-v2` e remover a cópia não cifrada depois de salvar a versão cifrada. Confirmar esse comportamento no QA, inclusive em migrações com falha de gravação. Não presumir que o navegador apaga cópias externas, backups antigos, histórico de arquivos ou informações capturadas antes da migração.

- **Bloqueio:** o app bloqueia quando vai para segundo plano ou perde a página, e exige a senha para reabrir o cofre.
- **Backup:** exportação em arquivo `.clara` cifrado; a restauração exige a senha do backup e, depois de validada, grava os dados no cofre atual. Faça uma cópia antes de atualizações e migrações.
- **Limites:** a criptografia em repouso não protege contra scripts maliciosos executados na mesma origem, extensões comprometidas ou acesso ao aparelho enquanto o app estiver desbloqueado. Não há, neste documento, certificação de segurança nem teste de penetração independente.
- **Recuperação:** a senha do cofre não tem recuperação automática documentada; perda da senha sem cópia recuperável pode implicar perda dos dados.
- **Origens:** versões em domínios diferentes da Vercel, Chrome e Samsung Internet não compartilham automaticamente o mesmo armazenamento; migrar por backup exportado/importado, preservando a confidencialidade do arquivo.

**Não utilizar dados financeiros sensíveis reais antes da conclusão da homologação e da validação da migração/backup em dispositivos físicos.**

## Build, PWA e atualização

- Requisitos: Node.js 20 ou superior, Vercel com framework **Other**, comando `npm run build` e diretório de saída `dist/`.
- Artefatos canônicos: `index.html`, `manifest.webmanifest`, `sw.js`, `version.json` e `assets/icon-192.png` / `assets/icon-512.png`.
- As rotas de manifesto, instalação e Service Worker usam `./` para respeitar a origem/escopo e evitar apontamentos para versões antigas.
- O build verifica as referências e forma o nome do cache com **versão + SHA-256** dos arquivos relevantes; não reutilizar `dist/` antigo.
- O Service Worker pré-carrega recursos da nova revisão usando a rede. Ao atualizar, o usuário deve confirmar; antes da ativação, o app aguarda a gravação pendente do cofre com `ClaraSecurity.flush()`.
- A consulta de `version.json` prioriza a rede, com fallback offline. Atualização e instalação não implicam migração automática entre navegadores ou domínios.
- A instalação no Chrome Android depende da elegibilidade apresentada pelo navegador (evento `beforeinstallprompt`). No Samsung Internet e em outros navegadores, o aplicativo mostra instruções de instalação manual; nunca simular sucesso.

## Validação obrigatória antes da main

Executar na branch de homologação:

```bash
npm test
npm run build
npm run verify:paths
```

Executar também a bateria de navegador com Chromium/Playwright em servidor local:

```bash
python -m pip install playwright
python -m playwright install chromium
python -m http.server 8765 --directory dist
# Em outro terminal:
python tests/pwa_browser.py
```

A bateria deve cobrir 390 px, 768 px e 1440 px, inicialização vazia, senha e cofre, QA, ajustes minimalistas, instalador, Service Worker, offline e os fluxos principais dos miniaplicativos. Os testes automatizados **não equivalem** à validação física.

O protocolo manual está em [docs/QA-RC3.6.10.md](docs/QA-RC3.6.10.md). Homologar **Chrome Android, Samsung Internet e Chrome/Edge Windows**, incluindo atualização a partir da versão instalada, backup/restauração, persistência após recarga, bloqueio ao sair e operação offline após instalação. Não apagar dados reais para fazer testes; usar base fictícia e perfil de teste.

## Contrato entre versões

- Manter `package.json` e `version.json` na mesma versão e sincronizar título HTML, notas de versão e testes.
- Não renomear IDs, chaves de armazenamento, rotas ou esquema sem migração validada e sem preservar backups.
- Não remover ligações entre lançamentos, saldos, contas, relatórios, Configurações e os 15 miniaplicativos sem testes específicos.
- Se o QA encontrar falha em migração, cofre, persistência, atualização, offline ou navegação, **bloquear a publicação em main** até corrigir.
- Não considerar um status `READY` da Vercel como prova de compatibilidade em navegador: verificar a versão efetivamente servida, o hash do build e as operações do usuário.

**Branch recomendada para homologação:** `release/rc3610-menu-clean`. A integração à `main` deve ocorrer somente após a bateria de QA e a aprovação correspondente.
