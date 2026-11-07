import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
const router = createRouter({
    history: createWebHistory(),
    routes: [
        { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { public: true } },
        { path: '/', name: 'dashboard', component: () => import('@/views/DashboardView.vue') },
        { path: '/hostel', name: 'hostel', component: () => import('@/views/hostel/HostelView.vue') },
        { path: '/restaurant', name: 'restaurant', component: () => import('@/views/restaurant/RestaurantView.vue') },
        { path: '/grocery', name: 'grocery', component: () => import('@/views/grocery/GroceryView.vue') },
        { path: '/team', name: 'users', component: () => import('@/views/UsersView.vue') },
        { path: '/finance', name: 'finance', component: () => import('@/views/FinanceView.vue') },
        { path: '/expenses', redirect: '/finance' },
    ],
});
router.beforeEach((to) => {
    const auth = useAuthStore();
    if (!to.meta.public && !auth.isAuthenticated) {
        return { name: 'login', query: { redirect: to.fullPath } };
    }
    if (to.name === 'login' && auth.isAuthenticated) {
        return { name: 'dashboard' };
    }
    const section = String(to.name ?? '');
    if (['hostel', 'restaurant', 'grocery', 'finance', 'users'].includes(section) && !auth.canSee(section))
        return { name: 'dashboard' };
    return true;
});
export default router;
