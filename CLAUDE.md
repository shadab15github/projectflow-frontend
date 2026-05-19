# CLAUDE.md — ProjectFlow Frontend

> Frontend SPA for ProjectFlow SaaS — a multi-tenant project management platform.

---

## Tech Stack

- **Vue 3** (Composition API + `<script setup lang="ts">`)
- **TypeScript** — strict mode enabled
- **Vite** — build tool
- **TanStack Query (`@tanstack/vue-query`)** — server state: data fetching, caching, mutations, invalidation
- **Pinia** — auth/session client state only (`store/auth.ts`)
- **Vue Router 4** — routing with navigation guards
- **Axios** — HTTP client with request/response interceptors
- **Tailwind CSS v4** — utility-first styling
- **shadcn-vue** — UI component library (Vega style, Reka base, Lucide icons)

---

## Project Structure

```
src/
├── main.ts                    # App entry — mounts Vue, Pinia, VueQueryPlugin, Router
├── App.vue                    # Root component
├── style.css                  # Tailwind + shadcn-vue CSS variables
├── components/
│   └── ui/                    # shadcn-vue components (auto-added via CLI)
├── lib/
│   ├── utils.ts               # shadcn-vue utility (cn helper)
│   └── queryClient.ts         # Shared TanStack QueryClient (staleTime, retry policy)
├── modules/
│   ├── public/                # LandingPage
│   ├── auth/                  # LoginPage.vue, SignupPage.vue
│   ├── app/                   # DashboardPage.vue, ProjectDetailPage.vue, WorkItemDetailPage.vue
│   └── admin/                 # AdminPage.vue (super_admin only)
├── layouts/
│   ├── AppLayout.vue          # Sidebar + top bar + <RouterView>
│   ├── AuthLayout.vue         # Centered card layout
│   └── PublicLayout.vue       # Marketing/landing layout
├── router/
│   └── index.ts               # Routes + beforeEach auth guard
├── store/                     # Auth uses Pinia; everything else is TanStack Query composables
│   ├── auth.ts                # Pinia: user, token, login(), logout(), isAuthenticated
│   ├── project.ts             # useProjects(), useProject(slug), useCreateProject(), useUpdateProject(), useDeleteProject()
│   ├── tenant.ts              # useCurrentTenant()
│   ├── user.ts                # useUsers(), useUserLookup() — list + byId/displayName/initials helpers
│   ├── sprint.ts              # useSprintStore() — sprints, mutations; backed by TanStack Query
│   ├── component.ts           # useComponentStore() — project components; backed by TanStack Query
│   └── workItem.ts            # useWorkItemStore() — items, filters (client state), mutations
├── services/
│   └── api.ts                 # Axios instance, interceptors (401 → /login)
├── types/
│   └── index.ts               # Shared interfaces: User, Project, WorkItem, Sprint, ...
└── composables/               # Vue composables (as needed)
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server at `http://localhost:5173` |
| `npm run build` | Type-check + build for production |
| `npm run preview` | Preview production build locally |

---

## Environment Variables

```
VITE_API_BASE_URL=http://localhost:5000/api
```

---

## shadcn-vue Usage

Components are installed via CLI and placed in `src/components/ui/`:

```bash
npx shadcn-vue@latest add button     # adds src/components/ui/button/
npx shadcn-vue@latest add input      # adds src/components/ui/input/
npx shadcn-vue@latest add card       # etc.
```

- Config file: `components.json`
- Style: **Vega** | Base: **Reka** | Icons: **Lucide**
- Import alias: `@/components/ui/...`
- All components are local (not from node_modules) — you can edit them freely

---

## Coding Rules

- **All code is TypeScript** — no `.js` files in `src/`. Vue SFCs use `<script setup lang="ts">`
- **Strict typing** — avoid `any`; define interfaces in `src/types/index.ts`
- **Use shadcn-vue components** for all UI — buttons, inputs, cards, dialogs, dropdowns, etc.
- **Never store JWT in localStorage** — use httpOnly cookies; the Pinia `auth` store holds user state in-memory only
- **Use async/await** — no raw `.then()` chains
- **Use `@/` import alias** for all project imports
- **Keep modules self-contained** — pages live in their module folder
- **Server state lives in TanStack Query** — use `useQuery` for reads and `useMutation` for writes. Each domain (`project`, `tenant`, `user`, `sprint`, `component`, `workItem`) exposes its composables and a `xKeys` query-key factory in `src/store/`. Mutations should update the query cache (`setQueryData` or `invalidateQueries`) on success.
- **Client state stays minimal** — only auth/session uses Pinia. UI filters and selections live in component-local refs.
- **Sign out clears the query cache** — `authStore.logout()` calls `queryClient.clear()` so cached server data doesn't leak across users.

---

## Routes

| Path | Layout | Page | Auth |
|------|--------|------|------|
| `/` | PublicLayout | LandingPage | Public |
| `/login` | AuthLayout | LoginPage | Public |
| `/signup` | AuthLayout | SignupPage | Public |
| `/app` | AppLayout | DashboardPage | Required |
| `/app/projects/:id` | AppLayout | ProjectDetailPage | Required |
| `/app/tasks/:id` | AppLayout | TaskDetailPage | Required |
| `/admin` | AppLayout | AdminPage | super_admin |

---

## Deployment (Vercel)

- Framework preset: Vite
- SPA rewrite: `vercel.json` with `rewrites: [{ "source": "/(.*)", "destination": "/index.html" }]`
- Set `VITE_API_BASE_URL` in Vercel environment variables
