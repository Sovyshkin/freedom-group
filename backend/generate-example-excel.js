const XLSX = require('xlsx');

// Создаем данные для листа Partner
const partnerData = [
  {
    Inc: 5, // ID партнера из базы данных (тестовый партнер)
    DateBeg: 45658, // 01.01.2026 в Excel формате
    DateEnd: 45688, // 31.01.2026 в Excel формате
    Amount: 50000.00,
    PayAmount: 59000.00,
    TaxAmount: 9000.00
  }
];

// Создаем workbook
const workbook = XLSX.utils.book_new();

// Создаем worksheet из данных
const worksheet = XLSX.utils.json_to_sheet(partnerData);

// Добавляем worksheet в workbook
XLSX.utils.book_append_sheet(workbook, worksheet, 'Partner');

// Сохраняем файл
XLSX.writeFile(workbook, 'example_claim.xlsx');

console.log('Пример Excel файла создан: example_claim.xlsx');
console.log('Структура файла:');
console.log('- Лист: Partner');
console.log('- Поля: Inc, DateBeg, DateEnd, Amount, PayAmount, TaxAmount');
console.log('- Даты в формате Excel serial date (01.01.2026 = 45658, 31.01.2026 = 45688)');
console.log('- Inc: 5 (ID тестового партнера "ИП Тестовый Партнер")');