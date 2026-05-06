# Produtividade

Dashboard web com 2 visoes:

- Operadores: total de Preparo, Liberacao, Scanner, Mio, Air e total por operador.
- Movimentadores: total de movimentacoes acumulado e por movimentador.

Recursos implementados:

- Filtro por data (calendario) para visualizar somente um dia.
- Atualizacao automatica a cada 10 minutos.
- Botao de sincronizacao manual (forca novo fetch nas planilhas).
- Rotas API server-side para leitura segura de Google Sheets.

## Configuracao

1. Crie um arquivo `.env.local` baseado em `.env.example`.
2. Preencha as variaveis:
	- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
	- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
3. Compartilhe todas as planilhas com o e-mail da service account em modo de leitura.

## Rodar local

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

## Deploy na Vercel

1. Suba o repositorio no GitHub.
2. Importe o projeto na Vercel.
3. Configure as mesmas variaveis de ambiente no painel da Vercel.
4. Faça deploy.

## Endpoints

- `GET /api/reports/operators`
- `GET /api/reports/movers`

Query params suportadas:

- `date=YYYY-MM-DD`
- `refresh=1` (forca sincronizacao)
