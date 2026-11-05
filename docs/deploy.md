# Deploy do MVP

A API e o servidor do jogo rodam no Render, no plano grátis, pelo [render.yaml](../render.yaml). O app web roda na Vercel, pelo [apps/mobile/vercel.json](../apps/mobile/vercel.json). Os dois fazem o deploy sozinhos a cada push na `main`. O Render só faz depois que o CI passa (`autoDeployTrigger: checksPass`).

Faça na ordem abaixo. Segredo só se cola no painel, nunca no repositório.

## 1. Supabase: a string do banco

O Render só sai por IPv4, e a conexão direta do Supabase (`db.afxxnbapxslagtqpuiis.supabase.co`) só responde em IPv6. Use o pooler compartilhado em modo sessão, na porta 5432. Ele serve para o app e para o `prisma migrate deploy`. O modo transação (6543) não serve para migração. Fontes: [Supabase, IPv4](https://supabase.com/docs/guides/platform/ipv4-address), [Supabase, conectar](https://supabase.com/docs/guides/database/connecting-to-postgres) e [Supabase com Prisma](https://supabase.com/docs/guides/database/prisma).

1. No projeto do Supabase, clique em **Connect**, no topo da página.
2. Em **Method**, escolha **Session pooler** e copie a URI. Ela tem a forma `postgresql://postgres.afxxnbapxslagtqpuiis:[YOUR-PASSWORD]@aws-…pooler.supabase.com:5432/postgres`. Copie o host como está: ele não se deduz da região.
3. Troque `[YOUR-PASSWORD]` pela senha do banco. Se não tiver a senha, troque em **Database → Settings**. Caracteres como `&`, `#`, `?` e espaço vão codificados (`%26`, `%23`…).

Guarde também a chave **service_role** e a **anon** (ou publishable), em **Project Settings → API Keys**.

## 2. Render: o Blueprint

1. No Render, **New → Blueprint**, escolha o repositório e a branch `main`. O Render lê o `render.yaml` e cria os dois serviços e o grupo `pontinho-shared`.
2. Ele pede os valores marcados com `sync: false`, só nesta primeira vez ([Blueprint](https://render.com/docs/blueprint-spec)). No `pontinho-api`, cole:
   - `DATABASE_URL`: a URI do passo 1.
   - `SUPABASE_SERVICE_ROLE_KEY`: a chave service_role.
3. O `SERVICE_TOKEN` o Render gera sozinho e os dois serviços leem do mesmo grupo.
4. Depois do primeiro deploy, confira os endereços dos dois serviços. Se o Render não deu `pontinho-api.onrender.com` e `pontinho-game.onrender.com`, troque `API_URL` no `render.yaml` e as URLs em `apps/mobile/.env.production`.

Como o plano grátis se comporta ([Render, plano grátis](https://render.com/docs/free)):

- Sem tráfego por 15 minutos, o serviço dorme. O primeiro acesso depois disso leva cerca de um minuto. Uma partida em andamento se perde se o servidor do jogo reiniciar.
- Não há comando de pré-deploy ([Deploys](https://render.com/docs/deploys)), por isso a migração roda no fim do build da API.
- O mês tem 750 horas grátis por workspace, somando os dois serviços.

A API sobe com `NODE_ENV=staging`: aceita o provedor de pagamento de teste, não tem o login de QA e loga em `info`. O Render põe `NODE_ENV=production` no servidor do jogo, só na execução ([variáveis do Render](https://render.com/docs/environment-variables)).

## 3. Vercel: o app web

1. Na Vercel, **Add New → Project** e importe o repositório.
2. Em **Root Directory**, escolha `apps/mobile`. Deixe ligada a opção de incluir os arquivos fora dessa pasta, que já vem ligada ([monorepos](https://vercel.com/docs/monorepos/monorepo-faq)): o app usa os pacotes de `packages/`.
3. O `vercel.json` já define o build e a saída. Em **Environment Variables**, cole só a `EXPO_PUBLIC_SUPABASE_ANON_KEY` com a chave anon. As outras três estão em `apps/mobile/.env.production`, que o `expo export` lê ([variáveis do Expo](https://docs.expo.dev/guides/environment-variables/)).
4. Faça o deploy e anote o domínio. Se não for `pontinho.vercel.app`, troque `CORS_ORIGINS` no `render.yaml` e faça o push.

O app sai como página única (`web.output: "single"`), e o `vercel.json` manda toda rota para o `index.html`, como na [doc do Expo](https://docs.expo.dev/guides/publishing-websites/).

## 4. Supabase Auth: os endereços de volta

Em **Authentication → URL Configuration** ([Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)):

- **Site URL**: `https://pontinho.vercel.app`. É para onde volta o link do e-mail de login.
- **Redirect URLs**: adicione `https://pontinho.vercel.app/**`. O login com Google no navegador volta para o endereço do próprio app.
