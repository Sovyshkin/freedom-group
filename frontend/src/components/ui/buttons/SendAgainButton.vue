<template>
    <button class="send-again-btn">
        Отправить повторно
    </button>
</template>

<style scoped>
.send-again-btn {
    width: 100%;
    background: rgba(18, 51, 234, 0.08);
    color: #1233EA;
    border: 2px solid rgba(18, 51, 234, 0.2);
    padding: 14px 24px;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
}

.send-again-btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(18, 51, 234, 0.1), transparent);
    transition: left 0.5s;
}

.send-again-btn:hover {
    background: rgba(18, 51, 234, 0.12);
    border-color: rgba(18, 51, 234, 0.3);
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(18, 51, 234, 0.15);
}

.send-again-btn:hover::before {
    left: 100%;
}

.send-again-btn:active {
    transform: translateY(0);
    box-shadow: 0 4px 12px rgba(18, 51, 234, 0.1);
}

.send-again-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
}
</style>

<script setup>
</script>