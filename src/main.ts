import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './style.css';

const app = createApp(App);

app.use(createPinia());

// Router will be added in TASK F-02
// import router from './router';
// app.use(router);

app.mount('#app');
