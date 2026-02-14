<template>
    <button class="login-btn">
        Войти
    </button>
</template>

<style scoped>
.login-btn {
    width: 100%;
    background: linear-gradient(135deg, #1233EA, #0f29d1);
    color: white;
    border: none;
    padding: 16px 24px;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
}

.login-btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.6s;
}

.login-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 30px rgba(18, 51, 234, 0.4);
}

.login-btn:hover::before {
    left: 100%;
}

.login-btn:active {
    transform: translateY(0);
    box-shadow: 0 5px 15px rgba(18, 51, 234, 0.3);
}

.login-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
}
</style>

<script setup>
</script>