# Clara Finanças 4.x — matriz de homologação

**Versão de referência:** 4.2.5-rc
**Política:** toda versão passa pela bateria local e CI de homologação; só integrar à `main` depois que os checks do commit estiverem verdes.

## Fluxos essenciais — modo simples

| ID | Ação | Resultado esperado |
|---|---|---|
| S01 | Primeira abertura após senha do cofre | Início limpo, saldo R$ 0,00, nenhuma demonstração financeira |
| S02 | Navegar no smartphone | Quatro opções: Início, Lançar, Planejar e Mais |
| S03 | Navegar no desktop/tablet | Menu lateral com quatro destinos, sem módulos técnicos |
| S04 | Tocar Despesa | Formulário original com tipo Despesa; salvamento cifrado |
| S05 | Tocar Receita | Formulário original com tipo Receita |
| S06 | Tocar Transferir | Formulário mostra origem e destino, não altera saldo geral |
| S07 | Cadastrar conta futura | Mostra vencimento com ação Pagar |
| S08 | Confirmar pagamento | Atualiza saldo, data, histórico e status |
| S09 | Editar lançamento | Abre registro correto e preserva centavos |
| S10 | Comparar entradas e saídas | Totais apenas de operações realizadas |
| S11 | Ocultar valores | Mascara os valores financeiros expostos |
| S12 | Abrir Planejar | Metas e limites acessíveis, mesmo com base vazia |
| S13 | Adicionar meta e atualizar valor reservado | Persiste após recarga |
| S14 | Mais → Contas e cartões | Vai para Contas e permite editar |
| S15 | Mais → Histórico | Consulta meses passados sem alterar dados |
| S16 | Mais → Relatórios | CSV e impressão disponíveis |
| S17 | Mais → Parcelamentos | Prévia exata antes da confirmação |
| S18 | Mais → Segurança e backup | Exportar e restaurar .clara |
| S19 | Mais → Aparência | Claro/escuro e preferências preservadas |
| S20 | Mais → Meu perfil | Nome, foto, e-mail e telefone preservados |

## Avançado, segurança e compatibilidade

| ID | Ação | Resultado esperado |
|---|---|---|
| A01 | Mais → Ativar modo avançado | Editor e 15 miniaplicativos reaparecem |
| A02 | Expandir todos os miniaplicativos | Todos têm ações reais |
| A03 | Ocultar/ordenar cards | Persistem após recarga |
| A04 | Voltar ao modo simples | Nenhuma transação ou preferência é excluída |
| A05 | Reabrir modo avançado | Ordem e visibilidade antigas permanecem |
| A06 | Importar backup RC3.6.10 | Esquema 2, preferências novas têm valor padrão |
| A07 | Simular duas abas conflitantes | Sem sobrescrita silenciosa |
| A08 | Abrir QA interno | Diagnósticos fora da navegação principal |
| A09 | Migrar 3.6.10 para 4.0 | Contas, metas e histórico idênticos |
| A10 | Restaurar backup criptografado | Senha verificada antes da substituição |

## Service Worker e offline

| ID | Ação | Resultado esperado |
|---|---|---|
| P01 | Executar npm test | Sem erros |
| P02 | Executar npm run build | Copia HTML, CSS, JS, manifest, ícones e versão |
| P03 | Executar npm run verify:paths | Valida hash de HTML, CSS, JS e do SW |
| P04 | Alterar somente código do SW (teste isolado) | Nome de cache muda |
| P05 | Inicializar online e depois ficar offline | Interface e dados locais continuam |
| P06 | Atualizar PWA | Nova versão preparada, sem ativação forçada |
| P07 | Aprovar update com cofre em edição | Gravação concluída antes da troca |
| P08 | Abrir Chrome Android | Sem tela em branco e sem ERR_FAILED |
| P09 | Abrir Samsung Internet | Instalação e uso offline corretos |
| P10 | Abrir Chrome/Edge Windows | Layout desktop e offline corretos |
| P11 | Reiniciar PWA após update | Versão 4.0.0-rc e cache novo |
| P12 | Falha de rede durante update | Preserva dados e cache anterior |
| P13 | Download longo com avanço de arquivos | Estado continua preparando e mostra progresso real |
| P14 | Sem progresso por dois minutos | Falha recuperável com ação de tentar novamente |
| P15 | Recurso do pacote falha ou retorna HTTP inválido | Descarta apenas o candidato; cache anterior continua disponível |
| P16 | Nova versão falha ao inicializar módulo crítico (Chromium integrado) | Seleciona shell anterior e recarrega sem apagar o cofre |
| P17 | Atualização já ativada em outra aba | Confirma cache/HTML e só reabre após proteger os dados |
| P18 | Metadado semver inválido ou muito grande | Rejeita a versão e não a apresenta como pronta |
| P19 | Atualização com modal aberto ou cofre bloqueado | Não ativa o worker até concluir edição e desbloquear o cofre |

## Entradas inválidas e segurança

| ID | Ação | Resultado esperado |
|---|---|---|
| V01 | Lançar `1,001`, `1e3`, `0x10`, texto, zero, valor negativo ou acima do limite | Rejeita com erro visível; nenhum registro persistido |
| V02 | Importar JSON truncado, campos em tipo incorreto ou IDs duplicados | Rejeita sem sobrescrever o cofre atual |
| V03 | Importar datas impossíveis e relações de conta/categoria inválidas | Rejeita antes de renderizar ou persistir |
| V04 | Usar HTML/atributos de evento como descrição de lançamento | Mostra como texto inerte; não executa código |
| V05 | Senha incorreta, cofre cifrado, migração e backup | Segredo permanece cifrado; senha errada não desbloqueia |
| V06 | Abrir o app embutido em iframe de outra origem | `X-Frame-Options: DENY` impede framing |
| V07 | Ler respostas estáticas e arquivos de script | `nosniff` e política explícita de referrer presentes |

## Gate antes da main

1. Revisar todo o diff e executar `npm test`, `npm run build`, `npm run verify:paths` e verificações de sintaxe.
2. Rodar no Chromium as suítes `pwa_browser.py`, `security_pwa.py`, `input_validation_browser.py`, `version_paths_browser.py`, `update_recovery_browser.py`, `updater_rollback_browser.py`, agenda, Studio, demonstração, backups e miniapps ampliados.
3. Confirmar os checks verdes no commit exato e examinar logs/artifacts.
4. Fazer validação física em Chrome Android, Samsung Internet, Windows Chrome/Edge e offline antes de recomendar uso com dados financeiros reais.
5. Só então integrar à `main`; checar deployment, versão, cabeçalhos e cache publicados.

## Plataformas e legado

Testar explicitamente **Chrome Android**, **Samsung Internet**, **Windows 11** (Chrome e Edge) e operação **offline**, incluindo instalação como PWA e migração a partir de RC3.6.10. Conferir os 15 miniaplicativos no modo avançado, especialmente o **M15 (Simulador financeiro)**: não pode gravar valores simulados como lançamentos sem confirmação.

## Critérios de bloqueio

Validar em 390, 768 e 1440 px, Android Chrome, Samsung Internet, Windows Chrome e Edge. Testar teclado, tamanho de toque, foco, contraste, scroll horizontal e retorno após segundo plano.

**Bloqueia publicação na main:** perda de dados, cofre sem criptografia, saldo ou centavos divergentes, falha offline, botões sem ação, Service Worker sem ativos, atualização sem novo hash do SW, ou migração que destrua o único backup.

Registre data, URL, commit SHA, navegador, prints/logs e resultado de cada caso. Mantenha PENDENTE sem evidência real. Um deployment READY da Vercel não equivale à aprovação funcional.
