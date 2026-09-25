# Anna Sophie 15 — V3

Hotsite independente em Astro + TypeScript + Tailwind CSS + GSAP/ScrollTrigger, com renderização no servidor Node e PostgreSQL.

Evento: **06/12/2026, 17h30 (America/Sao_Paulo)**. Estação 840, Avenida Marechal Rondon, 840 — Centro, Osasco/SP.

## Iniciar

Requer Node 22.13+ e npm.

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

Acesse http://localhost:4321. Sem DATABASE_URL, as páginas públicas funcionam com o Save the Date e catálogo editorial em preview; **nenhuma confirmação é simulada ou salva em memória pela aplicação**.

Use um banco dedicado à V3, separado das versões anteriores. Preencha DATABASE_URL com a conexão PostgreSQL (postgresql://...). Um endereço HTTP de ferramenta administrativa, como localhost:5227, não é uma conexão SQL. Não cole senhas no chat nem versione .env.

```powershell
npm run db:migrate
npm run invite -- "Família Exemplo" 4 family
npm run build
npm start
```

O comando de convite exibe o link secreto apenas para o operador. O banco guarda somente seu SHA-256. Tipos: individual, couple, family, group. Sem busca pública por nome e sem formulário genérico. O mesmo token consulta e altera um único RSVP. Quem possui o link pode alterar o convite; compartilhe-o apenas com seus integrantes.

## Um único ambiente

Existe um único conjunto de variáveis, uma DATABASE_URL e um evento. Não há configuração DEV/HML/PROD. O modo de desenvolvimento do Astro serve apenas para edição e preview local.

Use um servidor PostgreSQL normal para persistência real. Os testes usam PostgreSQL WASM/PGlite temporário, sem convidados reais, sem banco persistente e sem substituir a configuração da aplicação.

## Calendário do site

Todas as datas de abertura e encerramento começam como **null**, inclusive o pós-evento. Nenhuma data foi inventada.

- Sem abertura do convite definida: Save the Date.
- Abertura do convite: INVITATION, dentro de sua janela.
- 06/12/2026 às 17h30: EVENT_DAY.
- A partir do postEvent.startsAt configurado: POST_EVENT.
- RSVP, presentes e PIX exigem suas próprias datas de abertura. null não abre essas funções.
- Encerramentos são exclusivos: exatamente no horário definido, a função fecha.
- POST_EVENT sempre desativa RSVP, presentes e PIX.
- Se o encerramento do Save the Date for definido sem uma fase seguinte, o cartão permanece como fallback seguro. Evite lacunas entre janelas.
- Sem postEvent.startsAt, EVENT_DAY permanece ativo: é necessário definir o término real da festa.

Com banco conectado, o campo events.lifecycle é a fonte de verdade e é lido a cada requisição. Para atualizar sem deploy:

```powershell
Copy-Item lifecycle.example.json lifecycle.json
# Preencha apenas as datas aprovadas, com fuso explícito: -03:00 ou Z.
npm run lifecycle -- lifecycle.json
```

A primeira migration importa as variáveis de datas do .env, se definidas. Execuções posteriores não sobrescrevem o calendário existente. Depois disso, edite o JSON no banco com o comando acima. Páginas abertas verificam mudanças a cada 60 segundos; o backend revalida a janela ao gravar o RSVP, dentro da transação.

Preview visual apenas com npm run dev:

- /?previewPhase=save-the-date
- /?previewPhase=invitation
- /?previewPhase=event-day
- /?previewPhase=post-event
- /presentes?previewPhase=invitation

O preview não abre gravações RSVP. O build de produção ignora o parâmetro.

## Rotas

/, /save-the-date, /confirmar-presenca/[token], /presentes, /fotos, /obrigado.
Também: /evento.ics, /sitemap.xml, /robots.txt e /api/state.
Links antigos mostram mensagens apropriadas, incluindo depois da festa.

## Administração

O painel privado fica em `/admin` e exige usuário ativo com sessão autenticada. Ele oferece dashboard de convidados, busca e filtros de convites, criação e edição, RSVP manual, regeneração de token, importação CSV/XLSX com prévia, exportação, auditoria e gestão de usuários. No RSVP, cada participante pode ser classificado como `0 a 7 anos`, `8 a 12 anos` ou `13 anos ou mais`; o dashboard e as exportações consolidam essas faixas.

O número 100 é tratado como mínimo contratado, não como capacidade máxima. O sistema não bloqueia convites nem confirmações acima desse número. O dashboard avisa quando a referência é atingida ou ultrapassada. A estimativa financeira considera pessoas de 13 anos ou mais como uma unidade, de 8 a 12 anos como meia unidade e de 0 a 7 anos como isentas, exibindo o equivalente excedente apenas para acompanhamento.

Há dois perfis: `EDITOR`, para a operação cotidiana, e `ADMIN`, para ações sensíveis como liberar vagas, regenerar tokens e administrar acessos. Não existe cadastro público. Para criar ou redefinir o primeiro acesso sem enviar a senha pela linha de comando:

```powershell
$env:ADMIN_INITIAL_PASSWORD = 'uma-senha-forte-com-12-ou-mais-caracteres'
npm run admin:provision -- "Nome" email@dominio.com ADMIN
Remove-Item Env:ADMIN_INITIAL_PASSWORD
```

Defina também `ADMIN_TOKEN_ENCRYPTION_KEY` com 32 bytes em base64. O banco continua armazenando apenas o hash usado pela rota pública; a chave protege a cópia reversível disponível exclusivamente no painel. Rotas administrativas usam cookies `HttpOnly`, `SameSite=Strict`, expiração de sessão, proteção de origem, `no-store` e trilha de auditoria.

## Imagens e Cloudflare R2

As composições provisórias foram geradas especificamente para a V3. A imagem de referência não é usada como background de interface. Os originais de design ficam em assets/source (fora de public); os assets utilizados têm versões WebP 640/960/1440.

```powershell
node scripts/images.mjs
```

Para as fotos oficiais e arquivos pesados, configure R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME e R2_PUBLIC_URL no .env. O bucket deve ter domínio público de leitura das imagens (custom domain ou URL R2 configurada), sem expor credenciais.

```powershell
npm run media:upload -- "C:\Fotos\ensaio.jpg" anna-sophie "Ensaio da Anna Sophie"
```

O comando gera WebP e thumbnail, envia ao R2 e salva somente URLs/metadados no PostgreSQL. São preparados os álbuns Anna Sophie, Família, Amigos, Cerimônia, Valsa, Baile, Pista, Detalhes e Bastidores. A galeria lê os registros ativos e oferece filtro e ampliação por teclado.

Se as fotos forem colocadas no R2 manualmente, cadastre suas URLs em photos (image_url, thumbnail_url, album_id, title, sort_order, active). Não grave imagens binárias no PostgreSQL.

A substituição da protagonista é centralizada em src/lib/media.ts:
base, focalPoint, alt e placeholder. Use as variantes -640.webp, -960.webp, -1440.webp em public/images/anna/final ou uma base pública equivalente no R2. O layout e as animações são preservados. Atualize também a imagem Open Graph quando o ensaio estiver disponível.

## Presentes e PIX

Sete categorias e 37 sugestões de marcas, com lojas reais. Bershka foi corrigida conforme o link fornecido. Tênis 35, calças 36 e blusas P.

O catálogo inicial fica em src/lib/gifts.ts e é importado para gift_categories/gifts. Com PostgreSQL conectado, o catálogo vem do banco.

PIX_ENABLED=false oculta completamente o PIX. Para exibi-lo: PIX_ENABLED=true, dados do destinatário/chave definidos e janelas gifts/pix abertas. O modal tem chave, cópia, QR Code BR Code estático sem valor, Escape e retorno de foco nativo. Não há processamento de pagamento no site.

## Segurança

Consultas SQL parametrizadas; token aleatório de 256 bits; max_guests validado no serviço e por trigger SQL; uma resposta por convite; atualização atômica dos participantes; bloqueio por revogação, expiração e prazo; limite de corpo de 16 KB; rate limit de 30 requisições/minuto por endereço de conexão na rota RSVP; validação de origem e proteção de origem do Astro.

Páginas privadas usam noindex, nofollow, noarchive, Cache-Control: no-store e Referrer-Policy: same-origin (não enviam o token para sites externos). Não há analytics externo. A política same-origin preserva o cabeçalho Origin necessário ao POST nativo.

O rate limiter é básico por processo. Para múltiplas instâncias, adicione limitação compartilhada no proxy; configure corretamente o IP de conexão sem confiar em cabeçalhos arbitrários. Configure os logs do proxy para ocultar o token na URL.

## Verificações

```powershell
npm test
npm run build
```

Os testes cobrem migrations SQL, ciclo RSVP usando pg sobre protocolo PostgreSQL, limites, revogação/expiração, datas com fuso, previews, janelas, tokens, CRC PIX, limites do formulário, autenticação administrativa, autorização por perfil, cofre de tokens e validação de importação.

Validação manual: seis larguras de 375 a 1440, navegação, Save the Date, convite, presentes, pós-evento, formulário com dados fictícios e console do navegador. Consulte VALIDATION.md para resultados e pendências de infraestrutura.

Referências técnicas: [Astro SSR](https://docs.astro.build/en/guides/on-demand-rendering/), [PGlite Socket](https://pglite.dev/docs/pglite-socket), [padrões PIX do Banco Central](https://www.bcb.gov.br/estabilidadefinanceira/pix-normas).

## PostgreSQL local configurado

O banco da V3 usa compose.yaml: container anna-sophie-v3-postgres, imagem local postgres:17-alpine (pull_policy: never), porta 127.0.0.1:5433 e volume persistente anna-sophie-v3-postgres-data. Nenhum container da Affinity é reutilizado.

Usuário, senha exclusiva gerada e DATABASE_URL estão somente no .env ignorado pelo Git. A aplicação Node usa URL postgresql://, não o formato Host=... de clientes .NET. Não sobrescreva o .env existente ao reiniciar.

```powershell
docker compose up -d --pull never --wait
npm run db:migrate
npm run dev -- --port 4325
```

Acesse http://localhost:4325/. O calendário real continua sem datas de abertura definidas; o convite completo pode ser revisado em http://localhost:4325/?previewPhase=invitation. A porta 5227 não é usada pela aplicação.
