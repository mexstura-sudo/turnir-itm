// Проверка имён участников (страница олимпиады и пульт). Та же логика — в SQL: t_name_fix / t_name_problem.
// Фильтр мягкий: настоящие фамилии не должны отсекаться, поэтому «сомнительное» оставлено на модерацию в пульте.
(function () {
  'use strict';
  var PARTICLES = ['оглы', 'кызы', 'улы', 'гызы'];
  // целые слова: клички, оскорбления, «пустые» имена
  var WORDS = ['сука', 'суки', 'сучка', 'тварь', 'мразь', 'чмо', 'лох', 'лошара', 'дебил', 'дибил', 'идиот', 'дурак', 'дура', 'тупой', 'тупица',
    'урод', 'уродина', 'козлина', 'свинья', 'жопа', 'задница', 'какашка', 'лузер', 'нуб', 'нубас', 'нагибатор', 'админ', 'администратор',
    'модератор', 'тест', 'аноним', 'анонимус', 'неизвестный', 'неизвестно', 'никто', 'ктото', 'кто', 'привет', 'лол', 'кек', 'хз', 'ник',
    'никнейм', 'игрок', 'пользователь', 'юзер', 'бот', 'студент', 'ученик', 'учитель', 'препод', 'гитлер'];
  // корни мата: в любом месте слова, а «еб…» и «дроч…» — только в начале (иначе страдают фамилии вроде Ребане)
  var ROOTS = /пизд|хуй|хуе[вл]|хуя[рч]|хуил|бляд|блят|мудак|мудил|залуп|шлюх|гандон|гондон|пидор|пидар|пидр|педик|(^|[^е])говн|дерьм|сперм|засран|обосра|насра|^дроч|^(за|у|вы|до|по|на|отъ|съ|раз|рас|недо|пере|под)?еб(ан|ат|ал|л[аоиы]|уч|ну)/;

  // «иванов  иван» → «Иванов Иван»; частицы оглы/кызы — строчными
  function fix(s) {
    return String(s || '').trim().replace(/\s+/g, ' ').split(' ').filter(Boolean).map(function (w) {
      var l = w.toLowerCase();
      if (PARTICLES.indexOf(l.replace(/ё/g, 'е')) >= 0) return l;
      return l.split('-').map(function (p) { return p.charAt(0).toUpperCase() + p.slice(1); }).join('-');
    }).join(' ');
  }
  // null — имя подходит; 'BAD_NAME' — меньше двух слов; 'NAME_RULES' — не похоже на настоящие ФИО
  function problem(s) {
    var n = String(s || '').toLowerCase().replace(/ё/g, 'е').trim().replace(/\s+/g, ' ');
    var ws = n ? n.split(' ') : [];
    if (ws.length < 2) return 'BAD_NAME';
    if (ws.length > 4 || n.length > 80 || !/^[а-я -]+$/.test(n)) return 'NAME_RULES';
    for (var i = 0; i < ws.length; i++) {
      var w = ws[i];
      if (PARTICLES.indexOf(w) >= 0) continue;
      var parts = w.split('-');
      for (var j = 0; j < parts.length; j++) {
        var p = parts[j];
        if (p.length < 2 || p.length > 25 || !/[аеиоуыэюя]/.test(p) || /(.)\1\1/.test(p)) return 'NAME_RULES';
      }
      if (WORDS.indexOf(w) >= 0 || ROOTS.test(w)) return 'NAME_RULES';
    }
    return null;
  }
  window.ITM_NAMES = { fix: fix, problem: problem, WORDS: WORDS, ROOTS: ROOTS.source };
})();
