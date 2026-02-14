<script setup>
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'
// import LogInButton from "@/components/ui/buttons/LogInButton.vue";
import SendAgainButton from "@/components/ui/buttons/SendAgainButton.vue";
import { useMainStore } from "@/stores/main.ts";

const mainStore = useMainStore();

const digits = ref(['', '', '', ''])
const inputs = ref([])
const canResend = ref(false)
const countdown = ref(60) // 60 секунд таймера
const timerInterval = ref(null) // Ссылка на интервал таймера

const handleInput = (index, event) => {
  const value = event.target.value.replace(/\D/g, '') // Оставляем только цифры
  
  digits.value[index] = value
  
  // Если введено число и есть следующий инпут, переходим к нему
  if (value && index < digits.value.length - 1) {
    nextTick(() => {
      inputs.value[index + 1]?.focus()
    })
  }
  
  // Автоматическая отправка при заполнении всех полей
  if (digits.value.every(digit => digit !== '')) {
    handleLogin()
  }
}

const handleKeydown = (index, event) => {
  // Обработка удаления и перемещения между полями
  if (event.key === 'Backspace' && !digits.value[index] && index > 0) {
    inputs.value[index - 1]?.focus()
  }
}

const handlePaste = (event) => {
  event.preventDefault()
  const pasteData = event.clipboardData.getData('text').replace(/\D/g, '')
  
  // Вставляем только первые 4 цифры
  const codes = pasteData.slice(0, 4).split('')
  
  codes.forEach((code, index) => {
    if (index < digits.value.length) {
      digits.value[index] = code
    }
  })
  
  // Переходим к последнему заполненному инпуту
  const lastFilledIndex = Math.min(codes.length - 1, digits.value.length - 1)
  nextTick(() => {
    inputs.value[lastFilledIndex]?.focus()
  })

  handleLogin()
}

const handleLogin = () => {
  console.log('handleLogin called with code:', digits.value.join(''));
  mainStore.code = digits.value.join('')
  if (mainStore.code.length === 4) {
    mainStore.verifyCode()
  }
}

// Функция для запуска таймера
const startCountdown = () => {
  console.log('startCountdown called, current countdown:', countdown.value, 'canResend:', canResend.value);
  
  // Не перезапускаем таймер если он уже идет
  if (!canResend.value && countdown.value > 0 && timerInterval.value) {
    console.log('Timer already running, not restarting');
    return;
  }
  
  // Очищаем предыдущий таймер если есть
  if (timerInterval.value) {
    clearInterval(timerInterval.value);
  }
  
  canResend.value = false
  countdown.value = 60
  
  timerInterval.value = setInterval(() => {
    countdown.value -= 1
    
    if (countdown.value <= 0) {
      clearInterval(timerInterval.value)
      timerInterval.value = null
      canResend.value = true
      console.log('Timer finished, can resend now');
    }
  }, 1000)
}

// Обработчик повторной отправки
const handleResend = () => {
  if (canResend.value) {
    // Вызов метода отправки кода из store
    mainStore.sendCodeAgain()
    startCountdown()
  }
}

// Форматирование времени для таймера
const formattedTime = computed(() => {
  const seconds = countdown.value
  return `00:${seconds.toString().padStart(2, '0')}`
})

// Фокус на первый инпут при монтировании
onMounted(() => {
  console.log('EmailVerify component mounted');
  nextTick(() => {
    inputs.value[0]?.focus()
  })
  
  // Запускаем таймер при загрузке компонента только если он не запущен
  console.log('About to start countdown, current state:', countdown.value, canResend.value);
  startCountdown()
})

// Очищаем таймер при размонтировании
onUnmounted(() => {
  console.log('EmailVerify component unmounted, clearing timer');
  if (timerInterval.value) {
    clearInterval(timerInterval.value);
    timerInterval.value = null;
  }
})
</script>

<template>
  <div class="wrap">
    <div class="wrap-image">
      <img src="@/assets/email.svg" alt="Email Icon" />
    </div>
    <h1>Авторизация</h1>
    <p>Мы отправили код для авторизации. На почту {{ mainStore.email }}</p>
    
    <div class="code-inputs">
      <input
        v-for="(digit, index) in digits"
        :key="index"
        v-model="digits[index]"
        @input="handleInput(index, $event)"
        @keydown="handleKeydown(index, $event)"
        @paste="handlePaste"
        type="text"
        inputmode="numeric"
        pattern="[0-9]*"
        maxlength="1"
        class="code-input"
        :ref="el => { if (el) inputs[index] = el }"
      />
    </div>
    
    <div class="wrap-buttons">
      <!-- <LogInButton/> -->
      <SendAgainButton 
        :disabled="!canResend" 
        @click="handleResend"
      />
      
      <div v-if="!canResend" class="timer-section">
        <p class="timer-text">Отправить код повторно можно через:</p>
        <div class="timer">
          <span class="timer-digits">{{ formattedTime }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wrap {
  margin: 0 auto;
  display: flex;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  height: 100vh;
  gap: 24px;
  width: 360px;
  background-color: white;
  font-family: 'Inter', sans-serif;
  font-weight: 500;
}

.wrap-image {
  width: 64px;
  height: 64px;
  background-color: rgba(18, 51, 234, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  border-radius: 50%;
}

.wrap-image img {
  width: 32px;
  height: 32px;
}

h1 {
  font-size: 24px;
  font-weight: 600;
  color: #333;
  margin: 0;
}

p {
  text-align: center;
  color: #666;
  margin: 0;
  line-height: 1.5;
}

.code-inputs {
  display: flex;
  gap: 12px;
  margin: 16px 0;
}

.code-input {
  width: 50px;
  height: 50px;
  text-align: center;
  font-size: 24px;
  border: 1px solid #ddd;
  border-radius: 8px;
  transition: border-color 0.2s;
}

.code-input:focus {
  border-color: #1233ea;
  outline: none;
  box-shadow: 0 0 0 2px rgba(18, 51, 234, 0.2);
}

.wrap-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  align-items: center;
}

.timer-section {
  text-align: center;
  margin-top: 8px;
}

.timer-text {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
}

.timer {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #1233EA;
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-family: 'Courier New', monospace;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.timer-digits {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 2px;
  color: white;
}

/* Стили для disabled кнопки */
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Анимация для таймера */
.timer {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(1);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  }
}

/* Responsive Design */
@media (max-width: 480px) {
  .wrap {
    min-width: 100%;
    max-width: 100%;
    padding: 0 16px;
    gap: 20px;
  }
  
  h1 {
    font-size: 24px;
  }
  
  .code-input {
    width: 45px;
    height: 45px;
    font-size: 20px;
  }
  
  .code-inputs {
    gap: 8px;
  }
  
  .text-info {
    font-size: 14px;
  }
}
</style>