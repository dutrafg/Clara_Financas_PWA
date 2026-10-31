# Clara Finanças — Etapa 2/10 — revisão técnica RC2

**Estado: NÃO HOMOLOGADA INTEGRALMENTE.** A migração de código React/TypeScript/Vite está implementada, mas a compilação Vite e o teste PWA real não foram realizados com sucesso no ambiente desta conversa. Não chamar de versão estável.

## O que foi comprovado nesta revisão

- `npm test` passou: 19 testes financeiros de base, 31 cenários da Etapa 1, 12 cenários simulados de IndexedDB/pasta e 12 verificações estruturais da Etapa 2.
- `tsc -p tsconfig.offline-test.json --pretty false` passou com declarações de compatibilidade, **não com os tipos oficiais do React**.
- `python tests/ui_flows_stage2.py` passou em 18 fluxos de interface de prévia (React16 com adaptação de hooks e armazenamento simulado). Esse não é o runtime React19 de produção.
- Foi criado um revisor `qa-pwa/` que usa IndexedDB e Service Worker verdadeiros **quando servido em localhost/HTTPS**, diferentemente da prévia Android de arquivo único. Não confundir o revisor QA com o build Vite de produção.
- Foi criado `tests/e2e_production.py` para verificar build oficial, IndexedDB real, 63 registros, recarga, modo offline, backup e responsividade em navegador.
- Foi criada `.github/workflows/validar-etapa-02.yml` para executar instalação, testes, build Vite e Playwright em CI quando o repositório for atualizado. Esse workflow **ainda não foi executado** e não publica o site.

## Limitações observadas diretamente

1. `npm install` não conclui: DNS do registro npm indisponível. Assim, não foi possível gerar um `package-lock.json` confiável nem executar `npm run build` com dependências reais.
2. Chromium do ambiente retorna `ERR_BLOCKED_BY_ADMINISTRATOR` para URL `http://127.0.0.1:8765/`, `http://localhost:8765/`, `https://clara.test/` e arquivos `file://`.
3. `page.set_content()` em `about:blank` tem origem opaca: o IndexedDB real retorna `SecurityError`. Foi possível testar a **prévia simulada**, mas não certificar persistência/offline reais nesse ambiente.
4. Não foi feito teste físico em Android Chrome ou Windows Chrome/Edge; permissão de pasta real também precisa de teste no dispositivo.

## Critérios de conclusão — Etapa 2

- [x] Código React + TypeScript criado
- [x] Configuração Vite e arquivos estáticos de PWA criados
- [x] Seis módulos e estilo inspirado no EvoluFísico2 incorporados
- [x] Motor financeiro e esquema IndexedDB v2 preservados por testes
- [x] Prévia visual desktop/mobile e fluxos principais aprovados
- [x] Teste E2E/CI automatizados preparados
- [ ] `npm install` + `npm run build` oficiais aprovados
- [ ] E2E aprovado contra `dist/` com IndexedDB e Service Worker **reais**
- [ ] Confirmação de preservação de dados e pasta local em navegadores de uso

**Regra de avanço:** permanecer na etapa 2 até os itens pendentes passarem; não publicar na `main` nem anunciar conclusão. A homologação em hardware pode ser coordenada com a etapa 10, mas ao menos build real e IndexedDB/SW em navegador devem passar para esta etapa ser tecnicamente concluída.

## Como homologar em um computador com Node 22 e acesso ao npm

```sh
npm install
npm test
npm run build
python -m pip install playwright==1.55.0
python -m playwright install chromium
python tests/e2e_production.py
```

Para o revisor QA opcional (não build React19):

```sh
python tools/build_qa_pwa.py
python -m http.server 8765 --directory qa-pwa
```

Acesse `http://localhost:8765/`; use dados fictícios. Não limpar o armazenamento do navegador se houver dados reais de outras versões na mesma origem.
