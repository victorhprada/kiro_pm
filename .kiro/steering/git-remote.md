# Git remote e autenticação — pm_wiipo

Contexto fixo deste repositório. Use direto, sem precisar redescobrir.

## Remote

- `origin` → `git@github-personal:victorhprada/kiro_pm.git` (SSH, via alias do `~/.ssh/config`)
- `upstream` → mesmo URL em HTTPS, **não usar** para push.

## Autenticação

- Push **sempre** via SSH usando o alias `github-personal`. Esse alias está em `~/.ssh/config` apontando para `~/.ssh/id_ed25519_personal`, cadastrada na conta GitHub `victorhprada`.
- **Não tentar HTTPS** (`https://github.com/victorhprada/...`). O Keychain do macOS está com token da conta corporativa `victor-prada_SeniorSA`, que não tem permissão neste repo, e o push retorna `403 Permission denied`.
- Aliases SSH disponíveis no Mac (em `~/.ssh/config`):
  - `github-personal` → conta `victorhprada` (pessoal). Usar neste repo.
  - `github-work` → conta corporativa. Não usar neste repo.

## Fluxo padrão de push

1. `git status` para confirmar o que está staged.
2. `git push origin main` — vai resolver pelo alias SSH automaticamente.
3. Se aparecer erro `Permission to victorhprada/... denied to victor-prada_SeniorSA`, o remote voltou para HTTPS por algum motivo. Restaurar com:
   ```
   git remote set-url origin git@github-personal:victorhprada/kiro_pm.git
   ```

## Branch padrão

- Trabalho direto em `main` neste repo (não há fluxo de PR formal — é repositório pessoal de organização do PM). Outras regras de git safety do system prompt continuam valendo (ex.: nunca force push, nunca alterar git config sem pedir).
