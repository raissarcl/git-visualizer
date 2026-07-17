# PR Network (visualize-git)

App local (Vite + React) para acompanhar PRs e GitHub Actions: lista, filtros, pastas de repos, notas, pins, rerun/cancel e `workflow_dispatch` — tudo no browser, sem backend.

## Como rodar

```bash
npm install
npm run dev
```

Abra a URL do Vite (geralmente `http://localhost:5173`), cole um Personal Access Token e clique em **Salvar**.

## Personal Access Token

Crie em [GitHub → Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens).

| Situação | Classic PAT | Fine-grained |
|----------|-------------|--------------|
| Só repos públicos | `public_repo` | Contents + Pull requests (read) + **Actions: Read and write** |
| Repos privados + orgs | `repo` | Contents + Pull requests (read) + **Actions: Read and write** |

- Classic: o scope `repo` (ou `public_repo`) cobre PRs e Actions (ler runs, cancelar, rerun, disparar). O scope `workflow` só é necessário se for **editar** arquivos YAML de workflow.
- Fine-grained: sem **Actions: Read and write**, a aba Actions falha com 403.

O token fica só no **localStorage** (`gh_pat`) e é enviado para `https://api.github.com/graphql` (PRs) e `https://api.github.com` REST (Actions). **Não** entra no export/backup. Depois de salvar, a UI só mostra “Salvo neste navegador” (Trocar para editar); Markdown da descrição/notas passa por sanitização.

## Funcionalidades

- **Abas:** `PRs` | `Actions` (mesma sidebar de repos/pastas)
- **Escopos:** Sua rede (`involves:@me` nos PRs), um repositório, ou uma pasta de repos (inclui subpastas). Em Actions, rede pede para escolher repo/pasta.
- **Filtros de API (PRs):** Só os meus, estado (Open / Merged / Closed)
- **Filtros locais (PRs):** busca textual, só com notas, só com conflito, abertos há N dias, atualizados nos últimos N dias
- **Actions:** runs recentes (poll ~15s enquanto houver runs em andamento); filtros locais por texto, status, período e só com notas; detalhe com jobs; cancelar / rerun / rerun failed (com confirmação); disparar `workflow_dispatch` (repo, branch, inputs lidos do YAML)
- **Notas e pins:** locais ao navegador — notas em PRs e em runs; pins só em PRs (indicadores na lista; pin/notas no drawer)
- **Organizar:** pastas com subpastas, mesmo repo em várias pastas, ocultar repos; as mudanças só gravam ao clicar em **Salvar**
- **Tema:** claro / escuro (botão ao lado do PAT; preferência no navegador)
- **Backup:** export/import JSON (notas, pins, layout, preferência da sidebar) — sem tema e sem PAT

## Arquitetura (resumo)

```
src/
  domain/      # tipos e regras puras
  github/      # adaptador GraphQL + REST Actions + PAT
  storage/     # localStorage (sem PAT)
  hooks/       # estado de aplicação
  components/  # UI
  App.tsx      # composição
```

Detalhes em [docs/architecture.md](docs/architecture.md).

## Scripts

```bash
npm run dev      # desenvolvimento
npm run build    # produção
npm run preview  # preview
npm test         # testes unitários (Vitest)
npm run lint     # oxlint
```
