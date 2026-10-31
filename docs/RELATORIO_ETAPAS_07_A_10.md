# Clara Finanças — Etapas 7 a 10: validação e limites de lançamento

**Versão do aplicativo:** 1.0.0 RC1 (candidata a lançamento)  
**Origem:** `homologacao/etapa-06` → `homologacao/etapa-07` → `homologacao/etapa-08` → `homologacao/etapa-09` → `homologacao/etapa-10`.  
**Publicação em `main`:** não autorizada, portanto nenhuma promoção automática.

## Entregas realizadas
**Etapa 7 — Conciliação e auditoria:** comparação manual dos saldos por conta/data contra extrato, divergência, histórico, auditoria de possíveis duplicidades e pagamentos vencidos. Não modifica saldos automaticamente. [Actions aprovado](https://github.com/dutrafg/Clara_Financas_PWA/actions/runs/41167650031).

**Etapa 8 — Dashboard Pro:** novos KPIs, compromissos, alerta de orçamento, dívidas, metas e previsão do trimestre com fluxo de caixa existente. [Actions aprovado](https://github.com/dutrafg/Clara_Financas_PWA/actions/runs/41167770664).

**Etapa 9 — Relatórios:** resumo mensal e anual, contas, categorias, CSV seguro (sanitização de conteúdo iniciado por sinais de fórmula), PDF gerado no dispositivo via biblioteca incluída no pacote, sem serviço de terceiros. [Actions aprovado](https://github.com/dutrafg/Clara_Financas_PWA/actions/runs/41168060888).

**Etapa 10 — Segurança e QA:** backups exportados com PBKDF2-SHA256 (310.000 iterações) e AES-256-GCM com salt/IV aleatórios; proteção contra arquivos adulterados e senhas incorretas; bloqueio visual local com PBKDF2, com configuração voluntária; regressões e navegação móvel. Consultar o workflow da branch para situação atual.

## Homologação automatizada da Etapa 10 — APROVADA
- [Execução GitHub Actions #41168319885](https://github.com/dutrafg/Clara_Financas_PWA/actions/runs/41168319885): `success`, todas as tarefas aprovadas.
- `npm test`: etapas 1 a 10 aprovadas, incluindo 29 testes da Etapa 7, 25 da Etapa 8, 28 da Etapa 9 e 22 da Etapa 10, além das anteriores.
- `npm run build`: TypeScript e Vite aprovados.
- Chromium: IndexedDB persistente com 63 registros, offline com Service Worker, criação e quitação, auditoria, projeção, PDF/CSV, backup AES-GCM, restauração protegida e desbloqueio aprovados.
- O pipeline confirma o funcionamento automatizado, **não** o aceite em hardware Android ou Windows real.
- Não considerar a versão pronta para distribuição comercial até concluir o checklist físico e decidir sobre criptografia do armazenamento local.

## Verificações automatizadas
- `npm test`: módulos financeiros desde a etapa 1, conciliação, indicadores, relatórios, criptografia e desbloqueio.
- `npm run build`: TypeScript e compilação de produção.
- Playwright Chromium: renderização e persistência real no IndexedDB; Service Worker; navegação offline; CRUD, recorrências, dívidas, conciliação, PDF/CSV, backup criptografado, restauração e desbloqueio.
- Sem uso de dados bancários reais.

## Checklist manual para Android real e Windows (AINDA NÃO HOMOLOGADO)
- [ ] Instalar pelo navegador Chrome Android e confirmar ícone e inicialização fora da aba.
- [ ] Verificar funcionamento sem rede depois de instalar e usar todos os módulos, inclusive PDF.
- [ ] Confirmar persistência depois de fechar/reabrir o PWA e reiniciar o dispositivo.
- [ ] Exportar `.clara` e restaurar em outro perfil/dispositivo com a senha correta.
- [ ] Confirmar erro seguro com senha incorreta e com arquivo adulterado.
- [ ] Verificar bloqueio ao trocar para outro aplicativo e voltar.
- [ ] Comparar saldo de extrato real manualmente, sem inserir dados bancários pessoais em repositórios públicos.
- [ ] Testar seleção/perda/retomada de permissão da pasta quando o navegador suportar.
- [ ] Validar impressão/PDF em Chrome Android, Edge Windows e Firefox Windows.
- [ ] Verificar tema claro/escuro, teclado, contraste, barras, rolagem e orientação no celular.
- [ ] Conferir exportação e restauração de backup antigo v1/v2 com cópia de segurança.

## Restrições de segurança que impedem declarar versão comercial estabilizada
- **Dados do IndexedDB continuam em claro no perfil do navegador.** O bloqueio local impede visualização casual, mas não é criptografia do banco. Não protege contra acesso ao perfil ou ao armazenamento por outra aplicação.
- **Espelho automático de pasta e exportação JSON legada ainda não são criptografados**; não compartilhar. A nova opção `.clara` é criptografada.
- A senha do backup criptografado não é recuperável; sua perda impede restauração.
- Biometria nativa ainda não foi implementada; o navegador pode ou não disponibilizar WebAuthn, mas não se deve confundir autenticação visual com proteção do banco.
- Em dispositivos físicos ainda não foram validados seleção de pasta, instalação PWA ou perfis/permissões reais.
- Não existe sincronização automática entre aparelhos nem integração bancária.

## Critério para promover para main
Aprovação explícita do usuário e aceite manual do checklist, incluindo avaliação de proteção de dados em repouso. Até lá, manter em branch de homologação.

