# Clara Finanças RC4.1.2 — Design Clara Studio

Aplicativo financeiro pessoal com **quatro áreas principais** (Início, Lançar, Planejar, Mais). O modo avançado preserva as sete rotas financeiras originais e os **15 miniaplicativos**. No smartphone (até 760 px), a navegação usa pílula flutuante compacta. Em tablets, a pílula inferior reúne os oito destinos; em desktops (1024 px ou mais), ela fica vertical à esquerda e centralizada na altura da janela; o painel lateral não é exibido. O primeiro acesso começa sem movimentações fictícias, com conta principal de saldo inicial zero e categorias predefinidas.

**Estado da versão:** candidata à estabilização, sem certificação comercial ou auditoria independente. A presença de recursos no código não substitui validação de execução em navegadores/dispositivos reais.

## O que mudou na RC4.0.0

- **Modo simples por padrão:** saldo, entradas e saídas, contas próximas, registros e uma dica, sem exibir os 15 miniaplicativos de uma vez.
- **Quatro destinos claros:** Início, Lançar, Planejar e Mais. Os recursos técnicos ficam disponíveis por Mais ou modo avançado.
- **Lançamento direto:** despesa, receita e transferência; os fluxos financeiros antigos continuam sendo usados e os dados permanecem no cofre.
- **Modo avançado reversível:** recupera editor dos miniaplicativos, análises, filtros e preferências anteriores; não modifica lançamentos.
- **Configurações essenciais:** aparência reduzida a claro/escuro e seções menos comuns escondidas, preservando segurança, atualização, backups e contas.
- **Service Worker renovado em cada versão:** o build considera o código do SW, o HTML, o CSS e o JS na revisão SHA-256; todos entram no pré-cache offline.
- **Sem mudanças automáticas em produção:** homologar em branch antes de integrar à main.

Consulte o [plano de QA da Clara 4.0](docs/QA-Clara-4.md) e o [protocolo anterior](docs/QA-RC3.6.10.md). Os modos simples e avançado compartilham os mesmos dados; nenhum deles é um banco separado.

## Segurança e armazenamento

A Clara implementa um **cofre local criptografado**: AES-256-GCM via Web Crypto, chave derivada da senha usando PBKDF2-HMAC-SHA-256 com 310.000 iterações, salt aleatório de 16 bytes e IV aleatório de 12 bytes a cada gravação. A senha de criação requer pelo menos 12 caracteres. A cópia persistida fica no `localStorage`, na chave `clara-financas-vault-aesgcm-v1`, mas o conteúdo financeiro do cofre é cifrado — diferentemente das prévias sem criptografia.

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

**Branch recomendada para homologação:** `feature/clara-4-simples`. A integração à `main` deve ocorrer somente após a bateria de QA e a aprovação correspondente.

## Estabilização RC4.0.6 (2026-11-01)

- Calendário com lembretes para o dia, a véspera e **até 1 hora antes**, quando existe horário cadastrado. A central é atualizada enquanto a Clara está em execução; **não envia push remoto com o aplicativo totalmente fechado**.
- Sino de notificações fixo no canto superior direito. Navegação compacta no telefone, dock de oito destinos em tablets e desktop, sem painel lateral.
- Banco privado OPFS e cópia criptografada de compatibilidade mantidos. **A exclusão dos dados do site também pode excluir o cofre**: exporte backups externos regularmente.
- Autenticação biométrica opcional por WebAuthn PRF, dependendo do navegador/aparelho e de autenticação local. **Cadastro biométrico físico ainda requer QA em dispositivo real**.
- QA canônico: `.github/workflows/rc3610-qa.yml` (main e homologacao/**); testes de 390/768/1440 px, offline, 15 miniaplicativos, agenda e armazenamento.
- Ambientes: Vercel recebe produção de `main`; homologação usa branch `homologacao/**` e workflow do GitHub Pages. **Configurar Pages → Build and deployment → Source: GitHub Actions** para retirar a antiga publicação automática de main; requer acesso do proprietário às configurações do repositório.
- PRs antigos de releases devem ser revisados individualmente, não mesclados sem reconciliação com a RC4.0.6.

## Clara Studio RC4.1.0 — padrão de qualidade

- Sistema visual próprio inspirado em referências de excelência de produtos digitais, com tipografia editorial, hierarquia de espaços, superfícies refinadas, estados acessíveis e transições discretas. Não utiliza código, imagens, fontes ou marcas da Apple.
- Remoção concluída nesta versão: elemento `aside.sidebar`, renderização duplicada de `sideNav`, configurações `sidebarCompact` e regras CSS legadas associadas.
- Navegação única: pílula compacta no telefone; dock de oito destinos no tablet/desktop; menu expandido no smartphone; perfil preservado.
- Gestão de dívida técnica obrigatória: a cada versão identificar componentes órfãos, dependências e seletores inativos; remover **apenas após** cobertura de testes e preservar contratos de dados/backups.
- Critérios de qualidade: contraste, responsividade em 320/390/768/1024/1440/1920 px, temas claro/escuro, teclado/foco, movimento reduzido, atualização offline, UX de cofre e nenhuma regressão nos 15 miniaplicativos.
- O pacote visual é local e pré-cacheado; não usa dependências externas de CDN nem fontes descarregadas pela rede.

## Clara Studio RC4.1.2 — demonstração e desktop em largura útil

- A opção **Conhecer a Clara sem criar senha** só aparece quando não existe cofre nem armazenamento legado. O usuário pode navegar por informações financeiras **fictícias em memória**, sem criar lançamentos reais, sem acesso aos dados de outra pessoa e sem salvar a demonstração.
- Ações de cadastro, edição, importação e gravação exigem a criação do cofre com senha local de pelo menos 12 caracteres. Ao escolher **Criar meu cofre**, a demonstração é descartada e o banco financeiro começa vazio.
- No desktop (largura a partir de 1024 px), o dock dos oito módulos fica flutuante na lateral esquerda, centralizado verticalmente; o conteúdo principal ocupa toda a largura útil à direita, sem o limite central fixo de 1000/1460 px. Há espaço reservado de 105 px para evitar sobreposição.
- No tablet (761–1023 px), a dock continua horizontal na parte inferior. No smartphone, o menu compacto original é mantido.
- Dados do cofre, Service Worker, backup e recursos de biometria não são alterados pela demonstração; ela não permite persistir dados sem a senha.


## Lembretes, notas e backups offline — RC4.1.2

- **Lembretes**: miniaplicativo na Dashboard de ambos os modos, com prioridade, data/hora, conclusão, edição e integração à agenda e ao sino.
- **Bloco de notas**: anotações privadas criptografadas com busca, fixação, edição e exclusão. A demonstração utiliza registros fictícios sem gravá-los.
- **Backup offline**: cartões na Dashboard e em Segurança, exportação .clara e retenção de até 30 cópias automáticas locais, guardadas em pasta privada OPFS, ou IndexedDB quando indisponível.
- **2h da manhã**: verificação diária local enquanto a Clara estiver aberta. Se estiver fechada, a cópia automática será tentada quando abrir após as 02:00 e desbloquear o cofre. Navegadores não garantem execução agendada com o PWA totalmente encerrado.
- **Limitação essencial**: backups no próprio navegador podem ser apagados junto com os dados do site. É recomendado exportar regularmente um arquivo criptografado para armazenamento externo.
