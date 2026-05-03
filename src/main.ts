import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { VsxIcon } from 'vue-iconsax';
import App from './App.vue';
import router from './router';
import './style.css';

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.component('VsxIcon', VsxIcon);

app.mount('#app');
