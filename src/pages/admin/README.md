# Área administrativa

As rotas deste diretório compõem o painel privado em `/admin`. A autenticação e a autorização são aplicadas pelo middleware; cada usuário precisa estar vinculado ao evento da V3, operações sensíveis exigem o perfil `ADMIN`, e todas as mutações relevantes geram auditoria.

Não adicione endpoints mutáveis fora dessas proteções. Preserve a validação de origem, o token CSRF derivado da sessão, sessões `HttpOnly`/`SameSite=Strict`, `Cache-Control: no-store`, consultas parametrizadas, transações, escopo por evento e autorização por perfil. O lifecycle permanece editável no PostgreSQL sem deploy.
