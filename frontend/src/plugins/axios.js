import axios from 'axios';

// Определяем базовый URL в зависимости от окружения
const getBaseURL = () => {
  const hostname = window.location.hostname;
  
  // Если фронтенд открыт по IP адресу, используем тот же IP для бэкенда
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return `http://${hostname}:3001/api`;
  }
  
  // Для localhost используем стандартный адрес
  return 'http://localhost:3001/api';
};

// Устанавливаем базовый URL для API
axios.defaults.baseURL = getBaseURL(); 
// axios.defaults.baseURL = 'http://87.236.23.19:1337/api';

// Настройка interceptor для автоматической обработки истечения токенов
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  
  failedQueue = [];
};

// Request interceptor для добавления токена к каждому запросу
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('jwt');
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

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Если уже обновляем токен, добавляем запрос в очередь
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return axios(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refreshToken');

      if (refreshToken) {
        try {
          const response = await axios.post('/auth/refresh', {
            refreshToken: refreshToken
          });

          const { jwt: newToken } = response.data;
          localStorage.setItem('jwt', newToken);
          
          // Обновляем заголовок по умолчанию
          axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
          
          processQueue(null, newToken);
          
          // Повторяем оригинальный запрос с новым токеном
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return axios(originalRequest);
          
        } catch (refreshError) {
          processQueue(refreshError, null);
          
          // Удаляем токены и перенаправляем на логин
          localStorage.removeItem('jwt');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('tokenExpiration');
          localStorage.removeItem('user');
          
          // Перенаправляем на страницу входа
          window.location.href = '/login';
          
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      } else {
        // Нет refresh токена, перенаправляем на логин
        localStorage.removeItem('jwt');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('tokenExpiration');
        localStorage.removeItem('user');
        
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default axios;