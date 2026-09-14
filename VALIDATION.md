# Validação da V3 — 13/09/2026

Local definitivo: C:\Projetos\Pessoal\anna-sophie-15-v3

## Concluído

- V3 independente, com package-lock, dependências e build próprios.
- V2 executada por cópia isolada. Comparação SHA-256 dos 23 arquivos de src/public: zero alterações.
- npm ci e npm run build na pasta definitiva: sucesso. Astro check: 39 arquivos, zero erros, zero avisos.
- npm test: 11 testes passaram.
- Migration SQL executada em PostgreSQL WASM/PGlite, com conexão pg via protocolo PostgreSQL.
- Comando de migrations executado duas vezes: sucesso sem duplicação do catálogo.
- RSVP: confirmação, alteração no mesmo registro, recusa, reconfirmação, capacidade, token inválido, revogação e expiração testados.
- Gravação e alteração do convite fictício verificadas também no navegador.
- Testes HTTP: oito rotas públicas responderam 200; token inválido 404; origem externa 403; excesso de convidados 400; corpo acima de 16 KB 413; limite de requisições 429.
- Build de produção ignorou previewPhase tanto na Home quanto na API de estado.
- Calendário ICS contém DTSTART:20261206T211500Z (18h15 em São Paulo).
- PIX ausente com flag desativada. Modal/QR exibidos com configuração fictícia; Escape fecha e devolve foco ao botão.
- CRC PIX conferido com vetor padrão 123456789 -> 29B1. Nenhum pagamento foi realizado.
- Home do convite inspecionada em 375, 390, 430, 768, 1024 e 1440 pixels: sem overflow horizontal.
- Save the Date, presentes e pós-evento inspecionados visualmente; console da página de presentes sem erros/avisos.
- Reduced motion implementado em CSS e na condição de carregamento/animação do GSAP.
- Imagens próprias geradas e convertidas em WebP responsivo; imagem de referência não é utilizada como interface.
- Bershka atualizada para o endereço fornecido pelo usuário.

## Configuração ainda necessária

1. PostgreSQL real conectado e validado: container anna-sophie-v3-postgres, imagem local postgres:17-alpine, porta 127.0.0.1:5433 e volume anna-sophie-v3-postgres-data. Migrations e seeds executados duas vezes sem duplicação (37 presentes, 7 categorias, 9 álbuns). Confirmação e recusa gravadas pelo navegador. Dados fictícios removidos e lifecycle original restaurado. Os 11 testes e o build passaram novamente. Containers de outros projetos preservados.
2. Credenciais/domínio público do R2 ou URLs das imagens que o usuário colocará no storage. A abstração e o comando de upload estão implementados; upload real não foi executado.
3. Datas de abertura do convite, RSVP, presentes e início do pós-evento. Permanecem null conforme solicitado. A transição final não ocorre até postEvent.startsAt ser definido.
4. Chave e destinatário PIX se desejado. A configuração entregue permanece desativada.
5. Fotos oficiais de Anna Sophie. As atuais são composições artísticas provisórias.

O servidor de revisão é local. O site não foi publicado.


