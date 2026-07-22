<div align="center">

# 👓 OPP Web

**Desenvolvimento de Produto (Design) — Chilli Beans**

Acompanhamento das demandas de design do Mix ao Set Final, no mesmo padrão do
SysPlan Web.

`React 18` · `TypeScript` · `Vite` · `Tailwind CSS` · `Supabase (PostgreSQL + Auth + RLS)` · `Cloudinary` · `Vercel`

</div>

---

## 📌 O que é

O **OPP** controla o funil de desenvolvimento de produto do Design: cada demanda
percorre as etapas **Mix → Desenvolvimento → Desenho Técnico → Protótipo →
Color Sample → Set Final**. A etapa atual é calculada automaticamente pelo banco
a partir das datas de aprovação preenchidas.

## ✨ Principais recursos

- **Lista de Demandas** — tabela central com autofiltro estilo Excel, filtros
  rápidos, miniatura da ficha, exportação Excel/PDF.
- **Seleção e edição em massa** — clique seleciona/desmarca a linha,
  Shift+clique seleciona o intervalo, duplo clique abre a edição individual.
  Com 2+ linhas selecionadas aparece o painel de **Edição em massa** (campo +
  novo valor + Aplicar), auditado campo a campo pelo banco.
- **Inclusão em massa** — informe a quantidade de linhas e os valores comuns;
  todas entram na etapa MIX com um novo CD.
- **Edição individual** — abas Dados / Etapas / Histórico, upload da ficha
  (Cloudinary, comprimida para ≤ 300 KB) e comentários por etapa.
- **Administração** — usuários, permissões por tela, parâmetros (domínios dos
  combos) e logs de auditoria.

## 🔒 Segurança

- **RLS** em todas as tabelas; acesso por `fn_tem_permissao(tela, editar)`.
- Novos usuários **sempre** nascem com perfil `usuario` (trigger do banco);
  promoção a admin só por um administrador.
- Auditoria campo a campo via trigger (`log_transacoes`).
- Headers de segurança no `vercel.json` (CSP, X-Frame-Options, HSTS...).

## 🚀 Implantação

### 1. Criar o banco (uma vez)
No **SQL Editor** do Supabase, execute [`supabase/schema.sql`](supabase/schema.sql):
cria tabelas, funções, triggers, RLS e os seeds (telas e domínios iniciais).

### 2. Criar o administrador inicial
Crie o usuário em **Authentication → Users** (ou pela tela de cadastro) e promova:

```sql
update usuarios set perfil = 'admin' where email = 'seu-email@chillibeans.com.br';
```

### 3. Configurar o `.env`
Copie `.env.example` para `.env` e preencha `VITE_SUPABASE_URL` e
`VITE_SUPABASE_ANON_KEY` (Project Settings → API). Para upload de fichas, crie
um upload preset **não-assinado** no Cloudinary e informe em
`VITE_CLOUDINARY_UPLOAD_PRESET`.

### 4. Rodar a aplicação

```bash
npm install
npm run dev        # desenvolvimento — http://localhost:5174
npm run build      # build de produção — pasta dist/
```

O deploy é automático na **Vercel** a cada push (ajuste o host do Supabase no
CSP do `vercel.json` se quiser restringir além de `*.supabase.co`).

## 🗂️ Estrutura

```
supabase/           schema.sql completo (tabelas, RLS, triggers, seeds)
public/             assets estáticos (favicon)
src/
  components/       UI (shadcn-style) + DataTable genérica + layout
  context/          Auth (sessão, perfil, permissões) e tema claro/escuro
  lib/              cliente Supabase, exportações, Cloudinary, imagem
  pages/            demandas (lista, edição, massa), admin, login, dashboard
  services/         hooks de dados (domínios)
  types/            tipos das entidades
```

## 👥 Perfis

| Perfil | Acesso |
| --- | --- |
| **Administrador** | Total. Gerencia usuários, permissões por tela, parâmetros e logs. |
| **Usuário** | Somente as telas liberadas em *Administração → Permissões* (visualizar/editar por tela), aplicado no banco via RLS. |
