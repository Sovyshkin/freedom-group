import axios from 'axios';
import { useAuthStore } from '@/stores/auth';

// Определяем базовый URL в зависимости от окружения
const getBaseURL = () => {
  // const hostname = window.location.hostname;
  
  // // Если фронтенд открыт по IP адресу, используем тот же IP для бэкенда
  // if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
  //   return `http://${hostname}/api`;
  // }
  
  // Для localhost используем стандартный адрес
  return 'http://localhost:3001/api';
};

// Устанавливаем базовый URL для API
axios.defaults.baseURL = getBaseURL(); 
//  axios.defaults.baseURL = 'http://localhost:3001/api'; 

// Request interceptor для добавления токена к каждому запросу
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor для обработки ответов
axios.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Обрабатываем 401 ошибку (неавторизован)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // Получаем auth store
      const authStore = useAuthStore();
      
      // Выходим из системы и перенаправляем на логин
      console.error('401 Unauthorized - logging out');
      authStore.logout();
      
      // Перенаправляем на страницу входа (если не на ней)
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

export default axios;