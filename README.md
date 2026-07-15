# PR Network (visualize-git)

App local (Vite + React) para acompanhar PRs do GitHub: lista, filtros, pastas de repos, notas e pins — tudo no browser, sem backend.

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
| Só repos públicos | `public_repo` | Read access to public repositories |
| Repos privados + orgs | `repo` | Contents + Pull requests (read) |

O token fica só no **localStorage** (`gh_pat`) e é enviado apenas para `https://api.github.com/graphql`. **Não** entra no export/backup. Depois de salvar, a UI só mostra “Salvo neste navegador” (Trocar para editar); Markdown da descrição/notas passa por sanitização.

## Funcionalidades

- **Escopos:** Sua rede (`involves:@me`), um repositório, ou uma pasta de repos (só repos diretos da pasta)
- **Filtros de API:** Só os meus, estado (Open / Merged / Closed)
- **Filtros locais:** busca textual, só com notas, só com conflito, abertos há N dias
- **Notas e pins:** locais ao navegador (indicadores na lista; pin e notas no drawer de detalhes)
- **Organizar:** pastas com subpastas, mesmo repo em várias pastas, ocultar repos; as mudanças só gravam ao clicar em **Salvar**
- **Tema:** claro / escuro (botão ao lado do PAT; preferência no navegador)
- **Backup:** export/import JSON (notas, pins, layout, preferência da sidebar) — sem tema e sem PAT

## Arquitetura (resumo)

```
src/
  domain/      # tipos e regras puras
  github/      # adaptador GraphQL + PAT
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
npm run preview  # preview do build
npm test         # testes unitários (Vitest)
npm run lint     # oxlint
```
