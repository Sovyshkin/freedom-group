import { createApp } from "vue";
import App from "./App.vue";
import "./plugins/axios"; // Импортируем настроенный axios
import { createPinia } from "pinia";
import router from "./router";
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import VueCookies from 'vue3-cookies'

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

createApp(App).use(router).use(pinia).use(VueCookies).mount("#app");
