import { defineStore } from "pinia";
import { ref } from "vue";
import axios from "axios";
import { useRouter } from "vue-router";
import { cookieStorage } from "./persist";

export const useMainStore = defineStore(
  "main",
  () => {
    const isLoading = ref(false);
    const email = ref("");
    const code = ref("");
    const isAddProjectModalOpen = ref(false);
    const isAddTehkartaModalOpen = ref(false);
    const router = useRouter();
    const jwt = ref("");
    const refreshToken = ref("");
    const tokenExpiration = ref(null);
    const isAuthenticated = ref(false);
    const user = ref({});
    const excelFile = ref<File | null>(null);
    const tehkartaFile = ref<File | null>(null);
    const userNotFound = ref(false);
    
    // Состояния для обработки ошибок
    const errorMessage = ref("");
    const successMessage = ref("");
    const showError = ref(false);
    const showSuccess = ref(false);
    const proekts = ref([])
    const proektSelected = ref({});
    const proektId = ref("");
    const elements = ref([]);
    const elementSelected = ref({});
    const stages = ref([]);
    const stageSelected = ref({});
    const blankStages = ref([])

    // Функция для проверки роли администратора
    const isAdmin = () => {
      return user.value && user.value.role && user.value.role.type === 'administrator';
    };

    const logIn = async () => {
      try {
        isLoading.value = true;
        userNotFound.value = false;
        hideMessages();
        
        let response = await axios.post("/email-auth/send-code", {
          email: email.value,
        });
        
        console.log(response);
        
        if (response.data.success) {
          showSuccessMessage("Код отправлен на вашу почту");
          router.push({ name: "email_verify" });
        } else if (response.data.userExists === false) {
          userNotFound.value = true;
          showErrorMessage("Пользователь с такой почтой не найден");
        }
      } catch (err) {
        console.log(err);
        showErrorMessage("Ошибка при отправке кода. Попробуйте позже");
      } finally {
        isLoading.value = false;
      }
    };

    const sendCodeAgain = async () => {
      try {
        isLoading.value = true;
        hideMessages();
        
        let response = await axios.post("/email-auth/send-code", {
          email: email.value,
        });
        console.log(response);
        
        if (response.data.success) {
          showSuccessMessage("Код отправлен повторно");
        }
      } catch (error) {
        console.log("Ошибка при повторной отправке кода:", error);
        showErrorMessage("Ошибка при повторной отправке кода");
      } finally {
        isLoading.value = false;
      }
    };

    // Функция проверки кода и получения токена
    const verifyCode = async () => {
      try {
        isLoading.value = true;
        hideMessages();
        
        let response = await axios.post("/email-auth/verify-code", {
          email: email.value,
          code: code.value,
        });
        
        if (response.data.jwt) {
          // Сохраняем токены
          setTokens(response.data.jwt, response.data.refreshToken);
          
          // Сохраняем данные пользователя
          user.value = response.data.user;
          isAuthenticated.value = true;
          
          // Сохраняем пользователя в localStorage
          localStorage.setItem('user', JSON.stringify(response.data.user));
          
          showSuccessMessage("Успешная авторизация!");
          
          // Проверяем, есть ли сохраненный returnUrl
          const returnUrl = localStorage.getItem('returnUrl');
          if (returnUrl) {
            // Удаляем returnUrl из localStorage
            localStorage.removeItem('returnUrl');
            // Перенаправляем на сохраненную страницу
            router.push(returnUrl);
          } else {
            // Перенаправляем на главную страницу
            router.push({ name: "proekts" });
          }
        } else {
          showErrorMessage("Неверный код подтверждения");
        }
      } catch (error) {
        console.log("Ошибка при проверке кода:", error);
        showErrorMessage("Неверный код подтверждения");
      } finally {
        isLoading.value = false;
      }
    };

    // Функция сохранения токенов
    const setTokens = (accessToken, refreshTokenValue) => {
      jwt.value = accessToken;
      refreshToken.value = refreshTokenValue;
      
      // Вычисляем время истечения токена (обычно 15 минут для access token)
      const expirationTime = new Date().getTime() + (15 * 60 * 1000); // 15 минут
      tokenExpiration.value = expirationTime;
      
      // Сохраняем в localStorage
      localStorage.setItem('jwt', accessToken);
      localStorage.setItem('refreshToken', refreshTokenValue);
      localStorage.setItem('tokenExpiration', expirationTime.toString());
      
      // Устанавливаем токен в axios по умолчанию
      axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    };

    // Функция проверки действительности токена
    const isTokenValid = () => {
      if (!jwt.value || !tokenExpiration.value) return false;
      return new Date().getTime() < tokenExpiration.value;
    };

    // Функция обновления токена
    const refreshAccessToken = async () => {
      try {
        if (!refreshToken.value) {
          throw new Error('No refresh token available');
        }
        
        const response = await axios.post('/auth/refresh', {
          refreshToken: refreshToken.value
        });
        
        if (response.data.jwt) {
          setTokens(response.data.jwt, response.data.refreshToken || refreshToken.value);
          
          // Если в ответе есть обновленные данные пользователя, сохраняем их
          if (response.data.user) {
            user.value = response.data.user;
            localStorage.setItem('user', JSON.stringify(response.data.user));
          }
          
          return true;
        }
        return false;
      } catch (error) {
        console.log('Ошибка обновления токена:', error);
        // Не вызываем logout сразу, даем возможность повторить операцию
        // logout будет вызван только при явной попытке пользователя выполнить действие
        return false;
      }
    };

    // Функция выхода из системы
    const logout = () => {
      jwt.value = "";
      refreshToken.value = "";
      tokenExpiration.value = null;
      isAuthenticated.value = false;
      user.value = {};
      
      // Удаляем из localStorage
      localStorage.removeItem('jwt');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('tokenExpiration');
      localStorage.removeItem('user');
      
      // Удаляем токен из axios
      delete axios.defaults.headers.common['Authorization'];
      
      // Перенаправляем на страницу входа
      router.push({ name: "login" });
    };

    // Функция инициализации при загрузке приложения
    const initializeAuth = () => {
      const savedJwt = localStorage.getItem('jwt');
      const savedRefreshToken = localStorage.getItem('refreshToken');
      const savedExpiration = localStorage.getItem('tokenExpiration');
      const savedUser = localStorage.getItem('user');
      
      console.log('Initializing auth:', { savedJwt: !!savedJwt, savedRefreshToken: !!savedRefreshToken, savedUser });
      
      if (savedJwt && savedRefreshToken) {
        jwt.value = savedJwt;
        refreshToken.value = savedRefreshToken;
        
        if (savedExpiration) {
          tokenExpiration.value = parseInt(savedExpiration);
        }
        
        if (savedUser) {
          try {
            const parsedUser = JSON.parse(savedUser);
            user.value = parsedUser;
            console.log('User restored from localStorage:', parsedUser);
          } catch (e) {
            console.error('Ошибка парсинга данных пользователя:', e);
          }
        }
        
        // Устанавливаем токен в axios
        axios.defaults.headers.common['Authorization'] = `Bearer ${savedJwt}`;
        
        // Считаем пользователя авторизованным, токен проверится в нужном месте
        isAuthenticated.value = true;
        console.log('User state restored from localStorage');
      } else {
        console.log('No saved tokens found');
      }
    };

    // Функция для проверки авторизации перед каждым запросом
    const checkAuthBeforeRequest = async () => {
      if (!isAuthenticated.value) {
        // Не перенаправляем сразу, даем возможность приложению продолжить работу
        return false;
      }
      
      if (!isTokenValid()) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
          // Только при явной неудаче делаем logout
          isAuthenticated.value = false;
          return false;
        }
      }
      
      return true;
    };

    // Функция для явной проверки авторизации с показом ошибки
    const requireAuth = async () => {
      const isAuthorized = await checkAuthBeforeRequest();
      if (!isAuthorized) {
        showErrorMessage('Сессия истекла. Необходимо войти в систему заново.');
        router.push({ name: "login" });
        return false;
      }
      return true;
    };

    // Функции для работы с сообщениями
    const showErrorMessage = (message) => {
      errorMessage.value = message;
      showError.value = true;
      setTimeout(() => {
        showError.value = false;
        errorMessage.value = "";
      }, 5000); // Скрываем через 5 секунд
    };

    const showSuccessMessage = (message) => {
      successMessage.value = message;
      showSuccess.value = true;
      setTimeout(() => {
        showSuccess.value = false;
        successMessage.value = "";
      }, 3000); // Скрываем через 3 секунды
    };

    const hideMessages = () => {
      showError.value = false;
      showSuccess.value = false;
      errorMessage.value = "";
      successMessage.value = "";
    };

    const excelUpload = async (fileParam = null, projectName = null) => {
      try {
        isLoading.value = true;
        hideMessages();
        
        // Используем переданный файл или файл из store
        const fileToUse = fileParam || excelFile.value;
        
        if (!fileToUse) {
          showErrorMessage('Файл не выбран');
          return;
        }
        
        const formData = new FormData()
        formData.append('excel', fileToUse)
        
        // Добавляем название проекта в FormData, если оно предоставлено
        if (projectName && projectName.trim()) {
          formData.append('projectName', projectName.trim())
        }
        
        let response = await axios.post(`/proekt/excel-upload`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
        
        // После успешного создания проекта
        if (response.data && response.data.project) {
          showSuccessMessage('Проект успешно создан');
          isAddProjectModalOpen.value = false;
          
          // Обновляем proektId на ID нового проекта
          proektId.value = response.data.project.id.toString();
          console.log('Updated proektId to:', proektId.value);
          
          // Безопасная очистка файла
          try {
            console.log('excelFile before clearing:', excelFile);
            console.log('typeof excelFile:', typeof excelFile);
            if (excelFile && typeof excelFile === 'object' && 'value' in excelFile) {
              excelFile.value = null;
            } else {
              console.warn('excelFile is not a proper ref object:', excelFile);
            }
          } catch (clearError) {
            console.error('Error clearing excelFile:', clearError);
          }
          
          // Обновляем список проектов (ошибки обновления игнорируем)
          try {
            await getProekts();
          } catch (refreshError) {
            console.log('Failed to refresh projects list:', refreshError);
            // Не показываем ошибку пользователю, проект уже создан
          }
        } else {
          // Если нет данных проекта в ответе - это ошибка
          showErrorMessage('Ошибка при создании проекта: неожиданный ответ сервера');
        }
      } catch (err) {
        console.log('Error creating project:', err);
        
        // Проверяем код ошибки для доступа
        if (err.response?.status === 403) {
          showErrorMessage('Недостаточно прав. Требуются права администратора.');
          router.push('/access-denied');
        } else {
          // Показываем ошибку создания проекта
          const errorMessage = err.response?.data?.message || err.message || 'Неизвестная ошибка';
          showErrorMessage('Ошибка при создании проекта: ' + errorMessage);
        }
      } finally {
        isLoading.value = false;
      }
    };
    
    // Флаг для определения, заменяем ли мы техкарту или добавляем новую
    const isReplacingTechCard = ref(false);
    
    // Флаг для определения типа замены: 'techcard' или 'project'
    const replacementType = ref('techcard');
    
    const tehkartaUpload = async (fileParam = null) => {
      try {
        // Проверяем авторизацию перед запросом
        const isAuthorized = await checkAuthBeforeRequest();
        if (!isAuthorized) return;
        
        isLoading.value = true;
        hideMessages();
        
        console.log('tehkartaUpload: checking for file...');
        console.log('tehkartaFile.value:', tehkartaFile.value);
        console.log('fileParam:', fileParam);
        
        // Используем переданный файл или файл из store
        const fileToUse = fileParam || tehkartaFile.value;
        
        if (!fileToUse) {
          console.log('No file available, showing error');
          showErrorMessage('Файл не выбран');
          isLoading.value = false;
          return;
        }
        
        console.log('Creating FormData with file:', fileToUse);
        
        // Используем proektId как есть, без увеличения на 1
        const formData = new FormData();
        formData.append("excel", fileToUse);
        
        let response = await axios.post(`/element-tehkarties/createTechCardsFromExcel?proektId=${proektId.value}&isReplacing=${isReplacingTechCard.value}`, formData);
        console.log(response);
        
        if (response.data) {
          console.log('Upload successful, response data:', response.data);
          
          // Формируем сообщение с учетом пропущенных записей
          let successMessage = `Техкарта загружена: создано ${response.data.techCardsCreated} элементов`;
          
          if (response.data.techCardsSkipped > 0) {
            successMessage += `, пропущено ${response.data.techCardsSkipped} записей без материала`;
          }
          
          showSuccessMessage(successMessage);
          isAddTehkartaModalOpen.value = false;
          
          // Проверяем тип tehkartaFile перед присваиванием
          console.log('tehkartaFile type before clearing:', typeof tehkartaFile);
          console.log('tehkartaFile value before clearing:', tehkartaFile);
          
          if (tehkartaFile && typeof tehkartaFile === 'object' && 'value' in tehkartaFile) {
            tehkartaFile.value = null;
          } else {
            console.error('tehkartaFile is not a ref object, skipping clear:', tehkartaFile);
            // Не пытаемся очистить поврежденный ref
          }
          
          try {
            await getProekts();
            console.log('Projects reloaded successfully');
          } catch (getProjectsError) {
            console.error('Error reloading projects:', getProjectsError);
            // Не показываем ошибку пользователю, так как основная операция прошла успешно
          }
        }
      } catch (err) {
        console.error('Error in tehkartaUpload:', err);
        
        // Проверяем код ошибки для доступа
        if (err.response?.status === 403) {
          showErrorMessage('Недостаточно прав. Требуются права администратора.');
          router.push('/access-denied');
        } else {
          if (err.response) {
            console.error('Response error:', err.response.data);
          }
          showErrorMessage('Ошибка при загрузке техкарты: ' + (err.response?.data?.message || err.message));
        }
      } finally {
        isLoading.value = false;
      }
    };

    // Новый метод для замены всего проекта (элементы + этапы + подэтапы)
    const replaceProjectElements = async (fileParam = null) => {
      try {
        // Проверяем авторизацию перед запросом
        const isAuthorized = await checkAuthBeforeRequest();
        if (!isAuthorized) return;
        
        isLoading.value = true;
        hideMessages();
        
        console.log('replaceProjectElements: checking for file...');
        console.log('tehkartaFile.value:', tehkartaFile.value);
        console.log('fileParam:', fileParam);
        
        // Используем переданный файл или файл из store
        const fileToUse = fileParam || tehkartaFile.value;
        
        if (!fileToUse) {
          console.log('No file available, showing error');
          showErrorMessage('Файл не выбран');
          isLoading.value = false;
          return;
        }
        
        console.log('Creating FormData with file:', fileToUse);
        
        const formData = new FormData();
        formData.append("excel", fileToUse);
        
        let response = await axios.put(`/proekt/${proektId.value}/replace-tech-card`, formData);
        console.log(response);
        
        if (response.data) {
          console.log('Replace successful, showing success message');
          showSuccessMessage('Проект успешно заменен');
          isAddTehkartaModalOpen.value = false;
          
          // Проверяем тип tehkartaFile перед присваиванием
          console.log('tehkartaFile type before clearing:', typeof tehkartaFile);
          console.log('tehkartaFile value before clearing:', tehkartaFile);
          
          if (tehkartaFile && typeof tehkartaFile === 'object' && 'value' in tehkartaFile) {
            tehkartaFile.value = null;
          } else {
            console.error('tehkartaFile is not a ref object, skipping clear:', tehkartaFile);
            // Не пытаемся очистить поврежденный ref
          }
          
          try {
            await getProekts();
            console.log('Projects reloaded successfully');
          } catch (getProjectsError) {
            console.error('Error reloading projects:', getProjectsError);
            // Не показываем ошибку пользователю, так как основная операция прошла успешно
          }
        }
      } catch (err) {
        console.error('Error in replaceProjectElements:', err);
        if (err.response) {
          console.error('Response error:', err.response.data);
        }
        showErrorMessage('Ошибка при замене проекта: ' + (err.response?.data?.message || err.message));
      } finally {
        isLoading.value = false;
      }
    };

    const getProekts = async () => {
      try {
        let response = await axios.get('/proekts')
        proekts.value = response.data.projects
      } catch (err) {
        console.log('Error loading projects:', err.message);
        // Не показываем ошибку пользователю при фоновой загрузке
        throw err; // Пробрасываем ошибку наверх для обработки
      }
    }

    const getProekt = async (id) => {
      try {
        let response = await axios.get(`/proekts/${id}`)
        proektSelected.value = response.data.project;
      } catch (err) {
        console.log(err);
        
      }
    }

    const getElements = async () => {
      try {
        if (!proektSelected.value || !proektSelected.value['id']) {
          console.error('Проект не выбран');
          return;
        }
        let response = await axios.get(`/proekt/${proektSelected.value['id'] + 1}/elements`)
        console.log(response);
        elements.value = response.data.elements
      } catch (err) {
        console.log(err);
        
      }
    }

    const getElement = async (id) => {
      try {
        let response = await axios.get(`/element/${id}`)
        elementSelected.value = response.data.element;
      } catch (err) {
        console.log(err);
        
      }
    }

    const getStages = async () => {
      try {
        if (!elementSelected.value || !elementSelected.value['id']) {
          console.error('Элемент не выбран');
          return;
        }
        let response = await axios.get(`/element/${elementSelected.value['id'] + 1}/stages`)
        console.log(response);
        stages.value = response.data.stages
      } catch (err) {
        console.log(err);
      }
    }

    const getStage = async (id) => {
      try {
        let response = await axios.get(`/stage/${id}`)
        stageSelected.value = response.data.stage;
      } catch (err) {
        console.log(err);
        
      }
    }

    const getStagesBlank = async () => {
      try {
        if (!stageSelected.value || !stageSelected.value['id']) {
          console.error('Стадия не выбрана');
          return;
        }
        let response = await axios.get(`/blank/${stageSelected.value['id'] + 1}/stages`)
        console.log(response);
        blankStages.value = response.data.stages
      } catch (err) {
        console.log(err);
      }
    }

    // Глобальный поиск
    const searchResults = ref([]);
    const isSearching = ref(false);
    
    const globalSearch = async (query) => {
      try {
        if (!query || query.trim().length < 2) {
          searchResults.value = [];
          return;
        }
        
        // Проверяем авторизацию перед запросом
        const isAuthorized = await checkAuthBeforeRequest();
        if (!isAuthorized) return;
        
        isSearching.value = true;
        
        const response = await axios.get('/search', {
          params: { query: query.trim(), limit: 20 }
        });
        
        searchResults.value = response.data.results;
        console.log('Search results:', response.data);
        
        return response.data.results;
        
      } catch (err) {
        console.error('Error in global search:', err);
        searchResults.value = [];
        showErrorMessage('Ошибка при выполнении поиска');
        return [];
      } finally {
        isSearching.value = false;
      }
    };

    const clearSearchResults = () => {
      searchResults.value = [];
    };

    // Функция для получения техкарт проекта
    const projectTechCards = ref([]);
    
    const getProjectTechCards = async (projectId) => {
      try {
        // Проверяем авторизацию перед запросом
        const isAuthorized = await checkAuthBeforeRequest();
        if (!isAuthorized) return;
        
        const response = await axios.get(`/element-tehkarties/getByProject/${projectId}`);
        projectTechCards.value = response.data.techCards || [];
        console.log('Project tech cards loaded:', projectTechCards.value.length);
        
        return projectTechCards.value;
      } catch (err) {
        console.error('Error loading project tech cards:', err);
        projectTechCards.value = [];
        return [];
      }
    };

    return {
      isLoading,
      email,
      code,
      isAddProjectModalOpen,
      isAddTehkartaModalOpen,
      jwt,
      refreshToken,
      tokenExpiration,
      isAuthenticated,
      user,
      excelFile,
      tehkartaFile,
      userNotFound,
      errorMessage,
      successMessage,
      showError,
      showSuccess,
      proekts,
      proektSelected, 
      proektId,
      elements,
      elementSelected, 
      stages,
      blankStages,
      stageSelected,
      isReplacingTechCard,
      replacementType,
      isAdmin,
      logIn,
      verifyCode,
      sendCodeAgain,
      setTokens,
      isTokenValid,
      refreshAccessToken,
      logout,
      initializeAuth,
      checkAuthBeforeRequest,
      requireAuth,
      showErrorMessage,
      showSuccessMessage,
      hideMessages,
      excelUpload,
      tehkartaUpload,
      replaceProjectElements,
      getProekts,
      getProekt,
      getElements,
      getElement, 
      getStages,
      getStage,
      getStagesBlank,
      searchResults,
      isSearching,
      globalSearch,
      clearSearchResults,
      projectTechCards,
      getProjectTechCards
    };
  }
);
