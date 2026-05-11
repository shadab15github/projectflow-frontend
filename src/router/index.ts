import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import type { Role } from '@/types';
import { useAuthStore } from '@/store/auth';

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
    roles?: Role[];
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('@/layouts/PublicLayout.vue'),
    children: [
      {
        path: '',
        name: 'landing',
        component: () => import('@/modules/public/LandingPage.vue'),
      },
    ],
  },
  {
    path: '/',
    component: () => import('@/layouts/AuthLayout.vue'),
    children: [
      {
        path: 'login',
        name: 'login',
        component: () => import('@/modules/auth/LoginPage.vue'),
      },
      {
        path: 'signup',
        name: 'signup',
        component: () => import('@/modules/auth/SignupPage.vue'),
      },
    ],
  },
  {
    path: '/app',
    component: () => import('@/layouts/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'dashboard',
        component: () => import('@/modules/app/DashboardPage.vue'),
      },
      {
        path: 'for-you',
        name: 'for-you',
        component: () => import('@/modules/app/ForYouPage.vue'),
      },
      {
        path: 'projects/:slug',
        component: () => import('@/modules/app/ProjectDetailPage.vue'),
        children: [
          {
            path: '',
            name: 'project-detail',
            redirect: (to) => ({
              name: 'project-summary',
              params: { slug: to.params.slug },
            }),
          },
          {
            path: 'summary',
            name: 'project-summary',
            component: () => import('@/modules/app/project/SummaryTab.vue'),
          },
          {
            path: 'backlog',
            name: 'project-backlog',
            component: () => import('@/modules/app/project/BacklogTab.vue'),
          },
          {
            path: 'list',
            name: 'project-list',
            component: () => import('@/modules/app/project/ListTab.vue'),
          },
          {
            path: 'board',
            name: 'project-board',
            component: () => import('@/modules/app/project/BoardTab.vue'),
          },
          {
            path: 'timeline',
            name: 'project-timeline',
            component: () => import('@/modules/app/project/TimelineTab.vue'),
          },
          {
            path: 'components',
            name: 'project-components',
            component: () =>
              import('@/modules/app/project/ComponentsTab.vue'),
          },
          {
            path: 'docs',
            name: 'project-docs',
            component: () => import('@/modules/app/project/DocsTab.vue'),
          },
        ],
      },
      {
        path: 'work-items/:id',
        name: 'workitem-detail',
        component: () => import('@/modules/app/WorkItemDetailPage.vue'),
      },
    ],
  },
  {
    path: '/admin',
    component: () => import('@/layouts/AppLayout.vue'),
    meta: { requiresAuth: true, roles: ['super_admin'] },
    children: [
      {
        path: '',
        name: 'admin',
        component: () => import('@/modules/admin/AdminPage.vue'),
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  const auth = useAuthStore();

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  if (to.meta.roles && to.meta.roles.length > 0) {
    const role = auth.user?.role;
    if (!role || !to.meta.roles.includes(role)) {
      return { name: 'dashboard' };
    }
  }

  return true;
});

export default router;
