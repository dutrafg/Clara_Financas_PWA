# Clara Finanças — Etapa 1: estabilização do núcleo

**Base:** `main` em `581cd7af4e614aa4c07a7b07aec6c038a5a2ec26` (Clara 4.3.0-rc).  
**Branch isolada:** `homologacao/clara-etapa1-core-audit-20261103`.  
**Regra:** sem funcionalidades novas ou alterações de layout enquanto a Etapa 1 não for aceita.

## Objetivo e limites

Isolar e estabilizar o processamento de contas e transações, validação de importação, cofre AES-256-GCM, persistência OPFS/localStorage, exportação e restauração autenticadas e atualização PWA com recuperação. Preservar o esquema `version: 2` e todos os dados existentes. Não remover dados da origem, caches de versões boas, arquivos de backup ou histórico.

## Cobertura automatizada existente (baseline 4.3.0-rc)

- `npm test`: cálculos, integridade da PWA, metadados e atualizador.
- `npm run build` e `npm run verify:paths`: pacote canônico, hashes, arquivos obrigatórios e referências relativas.
- `tests/history_browser.py`: 1.000 operações, saldos, transferências de soma zero, pendências e histórico.
- `tests/security_pwa.py`: criação e desbloqueio do cofre, senha incorreta, migração, auditoria, snapshot pré-restauração e recuperação.
- `tests/input_validation_browser.py`: entradas inválidas e conteúdo HTML inerte.
- `tests/extras_backup_browser.py`: arquivos cifrados, backup em pasta local e restauração.
- `tests/update_recovery_browser.py`, `tests/updater_rollback_browser.py`, `tests/version_paths_browser.py`: timeout, rollback, cache e operação offline.

## Regressões adicionais da Etapa 1

- `tests/core_integrity_browser.py`: centavos exatos, saldos por conta, transferência de soma zero, receitas e despesas pendentes, importações hostis, duplicações de ID, relacionamentos cruzados, limite agregado de inteiros seguros, backup cifrado, senha de restauração incorreta, adulteração do backup e persistência após bloquear/desbloquear.
- `validateData`: limite acumulado conservador em centavos para que saldos, estatísticas e relatórios não usem inteiros acima de `Number.MAX_SAFE_INTEGER`. A verificação considera os valores absolutos dos saldos iniciais e todos os lançamentos, inclusive os ainda pendentes.
- Pipeline: `node --check` dos módulos críticos e `python -m compileall -q tests`, além da regressão no Chromium.

## Critérios de aceitação da Etapa 1

1. Todos os testes automatizados passam no **SHA exato** candidato, sem ignorar erros.
2. Saldo, receita, despesa, transferência, pendência, status, conciliação, corte de data e fechamento mensal preservam centavos e invariantes contábeis.
3. Importação rejeita dados inválidos, duplicados, adulterados ou numericamente inseguros sem alterar o cofre.
4. Criação, desbloqueio, bloqueio, exportação e restauração mantêm dados; falha de snapshot cancela restauração.
5. OPFS e cópia cifrada de compatibilidade preservam o último estado consistente em falhas de gravação.
6. Atualização parcial, offline, cache antigo ou falha no boot não apaga dados e mantém rollback.
7. Chrome/Edge Windows, Chrome Android e Samsung Internet são testados em dispositivos reais com **dados fictícios**. Não equivaler Chromium CI à validação física.
8. Publicação na `main` apenas após os itens anteriores e avaliação do diff.

## Etapas seguintes

**Etapa 2 — Refatoração controlada:** modularizar finanças, segurança, persistência, relatórios e UI gradualmente; eliminar código morto com testes por módulo.  
**Etapa 3 — Refinamento da experiência:** preservar a dock Glass 20%, modos simples/avançado e design clean.  
**Etapa 4 — Homologação estável:** cenários de longa duração, migração real, testes em dispositivos e aceite final.

> Estado: **em homologação**. O êxito do CI não equivale à conclusão da Etapa 1 sem os testes de dispositivo e recuperação acima.
