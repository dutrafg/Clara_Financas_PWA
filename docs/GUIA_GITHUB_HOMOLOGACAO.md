# Clara Finanças — publicação privada e homologação da Etapa 2/10

## Situação atual
Este pacote é de **homologação**, não um produto já aprovado. Os testes financeiros locais passaram, mas a compilação oficial React 19/Vite e o IndexedDB/Service Worker reais ainda precisam passar no GitHub Actions. A instalação no Android e o acesso físico à pasta permanecem dependentes de dispositivo compatível.

## 1. Criar repositório privado (uma única ação manual)
1. No GitHub, abra https://github.com/new.
2. Proprietário: `dutrafg`, nome: `Clara_Financas_PWA`.
3. Visibilidade **Private**.
4. **Não** marque README, `.gitignore` ou License. O repositório deve estar vazio.
5. Clique **Create repository**. Não copie dados financeiros pessoais para o repositório.

## 2. Publicar o histórico Git incluído neste pacote
Este pacote vem acompanhado de `Clara_Financas_PWA_Etapa02_Git.bundle`, com as branches:
- `main` — apenas README indicando que o PWA não foi aprovado;
- `homologacao/etapa-02` — código React, testes e workflow.

### Windows 11 (PowerShell com Git instalado)
Na pasta que contém o arquivo `.bundle`:
```powershell
git clone .\Clara_Financas_PWA_Etapa02_Git.bundle Clara_Financas_PWA
cd Clara_Financas_PWA
git branch main origin/main
git remote remove origin
git remote add origin https://github.com/dutrafg/Clara_Financas_PWA.git
git push -u origin main
git push -u origin homologacao/etapa-02
```

### Android Termux / Linux / macOS (Git instalado)
```sh
git clone ./Clara_Financas_PWA_Etapa02_Git.bundle Clara_Financas_PWA
cd Clara_Financas_PWA
git branch main origin/main
git remote remove origin
git remote add origin https://github.com/dutrafg/Clara_Financas_PWA.git
git push -u origin main
git push -u origin homologacao/etapa-02
```
O GitHub solicitará autenticação no momento do push. Não inclua tokens em capturas de tela nem neste código. Caso só tenha navegador no Android, envie a pasta do projeto por um ambiente com Git (por exemplo, Termux), pois GitHub não extrai ZIP enviado pela interface.

## 3. Verificar GitHub Actions
No repositório, abra **Actions → Clara Finanças · homologação Etapa 02**. O push para `homologacao/etapa-02` inicia a automação. Caso o workflow seja desativado por política da conta, habilite Actions em Settings → Actions → General. Logs e evidências podem ser baixados em Artifacts.

**Critérios de aprovação:** `npm test`, `npm run build` e `tests/e2e_production.py` sem falhas. Os testes E2E verificam funcionamento com dados demonstrativos, IndexedDB, Service Worker, reload, offline e layout mobile. Se qualquer teste falhar, registrar a falha, corrigir e executar novamente. Nenhum workflow faz merge ou publica automaticamente na branch `main`.

## 4. Publicar uma prévia HTTPS (depois de CI aprovado)
Conectar o repositório privado à Vercel, selecionar a branch `homologacao/etapa-02` e usar Framework Vite, Build `npm run build`, Output `dist`. Configurar proteção de acesso conforme a conta/ambiente. A PWA **não precisa de backend** e não envia movimentos bancários para o GitHub/Vercel; os dados permanecem no IndexedDB da origem do site e no arquivo exportado pelo usuário.

## 5. Testar em Android e Windows
Com HTTPS, instalar a PWA no Chrome. Confirmar: cadastro de lançamento, fechamento/reabertura, persistência local, funcionamento sem rede depois de visitar as telas, exportação e restauração JSON. Testar a pasta no Windows Chrome/Edge e usar backup JSON no Android se File System Access não estiver disponível. Teste com dados fictícios.

**Atenção:** o banco do navegador é vinculado ao domínio. Ao trocar o endereço Vercel/localhost, os dados não migram automaticamente. Exporte, importe e confira o resultado antes de mudar de origem.
