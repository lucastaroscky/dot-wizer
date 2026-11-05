# Documentação

O que a API e o servidor do jogo esperam em cada caso de uso, e o que fazem quando algo dá errado. Há dois tipos de documento, e um não substitui o outro.

## OpenAPI (referência de cada rota)

Gerado dos schemas zod do `packages/api-contract`, então não sai do compasso com o código.

```
npm run openapi --workspace @pontinho/api
```

O comando grava `apps/api/openapi.json`, que o git ignora. A API só monta o documento fora de produção e não tem interface; abra o arquivo em qualquer visualizador de OpenAPI. Ele lista as rotas do app e as de `/internal`, com os códigos de erro que cada uma pode devolver.

O OpenAPI diz o que cada rota recebe e responde. Não diz quem chama, em que ordem, nem o que fazer com cada erro. Isso é dos documentos abaixo.

## `docs/jogo`

Um arquivo por caso de uso do servidor do jogo: [entrada](jogo/entrada.md), [início](jogo/inicio.md), [rodada](jogo/rodada.md), [eliminação](jogo/eliminacao.md) e [encerramento](jogo/encerramento.md). Cada um traz a chamada à API, o sucesso, a tabela de erros, a regra com a fonte e os testes que cobrem.

## `docs/telas`

Um arquivo por tela do app: [cadastro](telas/cadastro.md), [menu](telas/menu.md), [perfil](telas/perfil.md), [pagamentos](telas/pagamentos.md), [ajuste da partida](telas/ajuste-da-partida.md) e [jogar online](telas/jogar-online.md). Os erros que valem para toda rota ficam em [erros comuns](telas/erros-comuns.md). Cada um traz a chamada, o sucesso, cada erro com o efeito na tela e a chave do texto, a regra com a fonte e os testes. O "o que a tela mostra" vem do protótipo aprovado pelo Lucas.

## Como escrever um documento

- A tabela de erros das respostas da API tem a primeira coluna `Código da API`, com um só código por linha, e a coluna `Status`. O código vem do `API_ERROR_STATUS` em `packages/api-contract/src/errors.ts`.
- O teste `packages/api-contract/test/docs.test.ts` lê essas tabelas em todo `docs/**/*.md` e falha se um código não existir ou se o status não for o da tabela. Outras tabelas, como as de falhas sem resposta e de recusas, não são conferidas.
- Regra de negócio leva a fonte entre parênteses, como `(Regras.md, «Fim da partida»)`. Comportamento que nenhuma regra escrita cobre fica dito como tal.
- Regras.md, Plano.md, Arquitetura.md e Revisao.md ficam no Obsidian, em `dotwize/`, fora do repositório.
- O texto que o jogador lê é do app (`apps/mobile/src/messages`). Estes documentos descrevem o efeito no jogador e as chaves, nunca o texto.
