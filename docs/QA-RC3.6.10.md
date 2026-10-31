# QA de homologação — Clara Finanças RC3.6.10

Data de preparação: 31/10/2026 · Branch: `release/rc3610-menu-clean` · Alvo: `3.6.10-rc`.

Este é um **roteiro de execução**, não um certificado. Inicialmente, o resultado de cada caso é **PENDENTE** até ser executado no ambiente indicado. Executar somente com dados fictícios e com backup exportado antes de simular migrações ou exclusões.

## Ambientes mínimos

| Ambiente | Navegador | Resolução/condição | Resultado |
|---|---|---|---|
| Android smartphone | Chrome Android | 390 px / instalação PWA | PENDENTE (dispositivo físico) |
| Android smartphone | Samsung Internet | 390 px / instalação via menu | PENDENTE (dispositivo físico) |
| Android tablet | Chrome Android | 768 px / orientação dupla | PENDENTE (dispositivo físico) |
| Windows 11 | Chrome | 1440 px / instalado e aba | PENDENTE (dispositivo físico) |
| Windows 11 | Edge | 1440 px / instalado e aba | PENDENTE (dispositivo físico) |
| Chromium automatizado | Playwright | 390, 768 e 1440 px | PENDENTE (execução CI) |

Registre para cada caso: data, navegador/versão, URL/origem, versão exibida, evidência (print/log), PASSOU/FALHOU/BLOQUEADO e descrição da falha. Não considerar resultados de outra origem como validação da origem de produção.

## Identidade, publicação e atualização

| ID | Ação | Resultado esperado |
|---|---|---|
| V01 | Abrir `/version.json` na mesma origem do app | Versão `3.6.10-rc`, sem cache antigo |
| V02 | Abrir Configurações → Segurança | Versão instalada mostra `3.6.10-rc`; cabeçalho combina com versão |
| V03 | Verificar agora, conectado | Consulta versão publicada sem apagar/alterar dados |
| V04 | Atualizar instalação antiga 3.6.9 → 3.6.10, com lançamentos fictícios e backup | Aviso visível; atualização apenas após confirmação; valores, conta, perfil, histórico e metas preservados |
| V05 | Interromper a confirmação de atualização | Nenhuma atualização forçada, perda de dados ou recarga inesperada |
| V06 | Editar lançamento, deixar modal aberto e tentar atualizar | Atualização bloqueada enquanto há edição aberta |
| V07 | Desconectar a rede e clicar Verificar agora | Mensagem de offline; PWA continua utilizável sem erro fatal |
| V08 | Testar URL nova e URL anterior em navegadores diferentes | Não pressupor compartilhamento de dados: backup/restauração cifrada deve ser possível |

## Instalação, Service Worker e offline

| ID | Ação | Resultado esperado |
|---|---|---|
| P01 | Abrir HTTPS no Chrome Android e procurar instalação | Instalar quando navegador oferecer; caso contrário instruções verdadeiras |
| P02 | Abrir HTTPS no Samsung Internet | Orientações manuais, sem afirmar instalação bem-sucedida antes de ocorrer |
| P03 | Instalar no Windows Chrome ou Edge | Manifesto, ícone, nome Clara e abertura standalone corretos |
| P04 | Carregar uma vez online, desligar Wi-Fi/dados, encerrar e reabrir | App instalado abre offline, respeitando bloqueio do cofre |
| P05 | Offline: navegar por todos os módulos e dashboard | Sem tela em branco, links quebrados ou recursos ausentes |
| P06 | Fechar e reabrir depois de atualizar | Service Worker e cache novos; mesma versão e mesmos registros |
| P07 | Limpar somente o cache HTTP comum, preservando storage da origem | Dados continuam preservados; comportamento de serviço deve ser explicado |
| P08 | Verificar 192/512 px, start_url e scope do manifesto | Recursos presentes e caminhos relativos à origem vigente |

## Cofre, integridade e migração

| ID | Ação | Resultado esperado |
|---|---|---|
| S01 | Primeiro acesso limpo: criar senha de 12+ caracteres | Cofre criado; conta sem lançamentos, saldo inicial zero |
| S02 | Tentar criar senha curta ou senha diferente da confirmação | Erro de validação, sem cofre criado |
| S03 | Criar receita e despesa; fechar/reabrir aplicativo | Dados persistem e permanecem inacessíveis sem senha |
| S04 | Inspecionar localStorage em perfil de teste | Chave cifrada `clara-financas-vault-aesgcm-v1`; dados financeiros não aparecem em texto puro |
| S05 | Inspecionar dados legados após migração bem-sucedida | Chave `clara-html-preview-planilha-optio-v2` removida após gravação cifrada |
| S06 | Simular falha de armazenamento/migração | Bloqueia edição, não afirma sucesso nem apaga o único backup |
| S07 | Testar senha incorreta e conteúdo do cofre adulterado | Bloqueio e erro explícito, sem redefinição silenciosa |
| S08 | Exportar `.clara`, restaurar usando senha do arquivo, conferir saldos | Integridade e consistência da restauração; preservar cópia prévia |
| S09 | Trocar de app/aba e retornar | Cofre bloqueado e exige autenticação |
| S10 | Abrir duas abas e gravar dados em uma | Sem sobrescrita silenciosa da outra |
| S11 | Clicar Começar do zero | Confirmação explícita e backup antes de limpar |
| S12 | Migrar do Chrome para Samsung via backup, em perfil de teste | Restaurar corretamente sem assumir sincronização entre navegadores |

## Navegação e design responsivo

| ID | Ação | Resultado esperado |
|---|---|---|
| U01 | Sidebar compacta no desktop/tablet | Nenhum botão de QA isolado/órfão |
| U02 | Configurações → Segurança → Manutenção avançada → Diagnóstico → Executar | Central de QA abre; Fechar retorna foco corretamente |
| U03 | Conferências → Rodar autotestes | Mesma Central de QA abre/fecha sem erro |
| U04 | Alternar abas Aparência/Painel/Financeiro/Contas/Segurança | Controles funcionam, preferências persistem |
| U05 | Alternar seis paletas, acabamento e plano de fundo | Aplicação e persistência após reabertura |
| U06 | Smartphone 390 px: dock flutuante e bolha de Perfil | Sem sobreposição, texto cortado, scroll horizontal ou ação global Novo |
| U07 | Tablet 768 px e desktop 1440 px | Layout responsivo, sidebar e navegação corretos |
| U08 | Abrir/editar Perfil com imagem e bloquear | Dados recuperados após autenticação, sem vazamento em storage |
| U09 | Conferir título, número da versão e “O que há de novidade” | Notas específicas da RC3.6.10, coerentes com `version.json` |

## Operações financeiras e os 15 miniaplicativos

Cobrir cadastro, edição, exclusão, cancelamento, competência financeira, pagamentos, contas, metas, orçamento, histórico, relatórios CSV/PDF/impressão, importação e filtros. Em cada ação confirmar valores antes/depois, persistência, auditoria e ausência de duplicação ao recarregar.

| ID | Miniaplicativo | Verificação mínima |
|---|---|---|
| M01 | Central de atenção | Pendências e ação para resolvê-las |
| M02 | Agenda financeira | Baixar pagamento; confirmar data e status |
| M03 | Lançamentos rápidos | Novo lançamento e persistência |
| M04 | Orçamentos por categoria | Limites e alertas sem divergência |
| M05 | Metas financeiras | Criar/editar meta e progresso |
| M06 | Contas e cartões | Saldos e acesso às contas |
| M07 | Comparativo de meses | Valores e filtros coerentes |
| M08 | Movimentações recentes | Editar/duplicar com confirmação |
| M09 | Insights automáticos | Mensagens coerentes com dados |
| M10 | Fluxo de caixa projetado | Projeção não gravada como lançamento |
| M11 | Conferências e auditoria | Acesso aos registros e integridade |
| M12 | Onde estou gastando? | Categorias e distribuição corretas |
| M13 | Histórico mensal | Competência e filtro independente |
| M14 | Recorrências identificadas | Identificação sem criar lançamentos silenciosos |
| M15 | Simulador financeiro | Simulação sem alterar saldos sem confirmação |

Verificar também que o editor mantém os 15 cards selecionáveis, ordem/visibilidade após recarga, e que não há “ClaraStore” nesta versão.

## Critérios de liberação

**Bloqueadores (falhou = não publicar na main):** perda/corrupção de dados; cofre legível em texto puro; migração que apaga o único exemplar; recuperação de senha inadequada; conflito de abas sem aviso; atualização forçada; app não abrindo no Chrome; quebra de instalação/offline; versão divergente; ações financeiras com cálculo incorreto.

**Não bloqueadores:** pequenos ajustes de espaçamento sem perda de interação, textos de ajuda e cosmética; documentar cada ocorrência.

Registro de aprovação:

- Responsável pela validação: __________________
- Data e ambiente: __________________
- URL e commit implantado: __________________
- Testes automatizados (log/URL): __________________
- Testes físicos (evidências): __________________
- Bloqueadores em aberto: __________________
- Decisão: [ ] APROVADO  [ ] REPROVADO  [ ] AINDA PENDENTE

Nenhuma célula “PENDENTE” deve ser convertida para “PASSOU” sem execução real e evidência.
