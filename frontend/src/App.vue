<script setup>
import AppHeader from "./components/AppHeader.vue";
import AppLoader from './components/AppLoader.vue'
import AppNotifications from './components/AppNotifications.vue'
import { useAuthStore } from "./stores/auth.js";
import { useRoute } from "vue-router";
import { onMounted } from "vue";

const authStore = useAuthStore();
const route = useRoute()

// Инициализируем авторизацию при запуске приложения
console.log('Initializing app, calling initializeAuth...');

onMounted(async () => {
  await authStore.initializeAuth();
  console.log('App mounted, user:', authStore.user);
  console.log('App mounted, isAuthenticated:', authStore.isAuthenticated);
  console.log('App mounted, current route:', route.name);
});
</script>
<template>
  <AppHeader v-if="route.name != 'login' && route.name !='email_verify'"/>
  <main>
    <div class="wrap-loader" v-if="authStore.loading">
      <AppLoader />
    </div>
    <router-view v-else v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </main>
  
  <!-- Компонент уведомлений -->
  <AppNotifications />
</template>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700;800;900&display=swap');

* {
  font-family: 'Inter', sans-serif;
  font-weight: 500;
  box-sizing: border-box;
}

html, body {
  scroll-behavior: smooth;
  overflow-x: hidden;
  background-color: white;
  margin: 0;
  padding: 0;
}

#app {
  background-color: white;
  min-height: 100vh;
}

/* Глобальные анимации */
.fade-enter-active, .fade-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Анимация для уведомлений */
.notification-enter-active, .notification-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.notification-enter-from {
  opacity: 0;
  transform: translateX(100%) scale(0.9);
}

.notification-leave-to {
  opacity: 0;
  transform: translateX(100%) scale(0.9);
}

/* Универсальные стили кнопок */
.btn-modern {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 24px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

/* Современные карточки */
.card-modern {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid #e2e8f0;
  transition: all 0.3s ease;
}

.card-modern:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
}

/* Стили для загрузки */
.loading-spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid #f3f3f3;
  border-radius: 50%;
  border-top-color: #1233EA;
  animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

#app {
  font-family: "Inter", sans-serif;
  width: 100%;
  min-height: 100vh; /* Обеспечиваем минимальную высоту */
}
* {
  padding: 0px;
  margin: 0px;
  border: none;
  font-weight: 400;
  font-size: 16px;
  line-height: 21px;
  font-style: normal;
  font-family: "Inter", sans-serif;
  color: #16171B;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

.wrap {
  display: flex;
  justify-content: space-evenly;
  padding: 40px;
  width: 100%;
}

body,
#app {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* Links */

a,
a:link,
a:visited {
  text-decoration: none;
}

a:hover {
  text-decoration: none;
}

/* Common */

aside,
nav,
footer,
header,
section,
main {
  display: block;
}

ul,
ul li {
  list-style: none;
}

img {
  vertical-align: top;
}

img,
svg {
  max-width: 100%;
  height: auto;
}

address {
  font-style: normal;
}

/* Form */

input,
textarea,
button,
select {
  font-family: inherit;
  font-size: inherit;
  color: inherit;
  background-color: transparent;
}

input::-ms-clear {
  display: none;
}

button,
input[type="submit"] {
  display: inline-block;
  box-shadow: none;
  background-color: transparent;
  background: none;
  cursor: pointer;
}

input:focus,
input:active,
button:focus,
button:active {
  outline: none;
  box-shadow: none;
}

button::-moz-focus-inner {
  padding: 0;
  border: 0;
}

.card {
  transition: all 500ms ease;
  cursor: pointer;
}

.wrap-loader {
  width: 100%;
  height: 90vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wrap {
  max-width: 1440px;
  margin: 0 auto;
}

h1 {
  font-weight: 500;
  font-size: 24px;
  color: #16171B;
}

.group-input {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.group-item {
  font-size: 14px;
  line-height: 16px;
}

.group-value {
  background-color: #F8F9FC;
  border: 1px solid #F1F2F4;
  padding: 12px 16px;
  border-radius: 8px;
}

.group-value::placeholder {
  font-weight: 300;
  color: #8C93A6;
  font-size: 14px;
  line-height: 22px;
}
</style>
