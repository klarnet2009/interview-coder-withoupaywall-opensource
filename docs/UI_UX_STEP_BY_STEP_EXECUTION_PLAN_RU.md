# Пошаговый план создания переработанного UI/UX

Дата: 2026-02-07  
Проект: `interview-coder-withoupaywall-opensource`  
Назначение: практический roadmap "что делать по шагам", от discovery до релиза.

Связанные документы:
- `docs/UI_UX_AUDIT_AND_REDESIGN_MASTER_RU.md`
- `docs/UI_UX_EXECUTIVE_SUMMARY_RU.md`
- `docs/UI_UX_IMPLEMENTATION_BACKLOG_RU.md`

---

## 1. Цель плана

Собрать обновленный UI/UX так, чтобы продукт стал:
- предсказуемым в live-сценарии;
- быстрым в критичном пути (capture/listen -> answer);
- честным в коммуникации (security, тесты, статусы);
- масштабируемым для ежедневного использования.

---

## 2. Принципы реализации

1. Сначала операционная надежность, потом визуальный polish.
2. Любая задержка должна быть объяснена в UI.
3. Один термин = одно действие (особенно hotkeys и logout).
4. Никаких "fake success" в onboarding.
5. Изменения принимаются только по measurable acceptance criteria.

---

## 3. Команда и роли (минимум)

1. Product Owner: приоритеты, scope, критерии.
2. UX Designer: user flows, wireframes, interaction rules.
3. UI Designer: визуальная система, компоненты, состояния.
4. Frontend Engineer: renderer UI, routing, состояния.
5. Electron/Main Engineer: shortcuts, IPC, event pipeline.
6. QA: сценарии, регрессии, smoke/perf/accessibility.

---

## 4. Пошаговый execution-план

## Шаг 0. Kickoff и freeze baseline

### Что делаем
1. Фиксируем baseline текущего UX (скриншоты ключевых экранов + проблемы).
2. Подтверждаем scope: что входит в редизайн, что не входит.
3. Создаем общий трекер задач (по backlog ID).

### Артефакты
1. Baseline board (before-state).
2. Scope документ на 1 страницу.
3. Приоритизированный board (P0/P1/P2).

### Done
1. Все участники согласовали приоритеты.
2. Нет разночтений по целям ближайшего релиза.

---

## Шаг 1. Truth alignment (критичные противоречия)

Связь с backlog: `UX-001`, `UX-003`, `UX-004`, `UX-005`.

### Что делаем
1. Выравниваем hotkeys во всем UI с `electron/shortcuts.ts`.
2. Исправляем security copy на фактическую модель хранения ключа.
3. Приводим `Log out` к единой семантике.
4. Убираем симуляционные формулировки тестов или делаем проверки реальными.

### Артефакты
1. Обновленный copy-гайд (hotkeys/security/logout/test language).
2. Матрица "действие -> ожидаемый результат" для logout/reset/setup.

### Done
1. Ни одного конфликтующего текста по hotkeys.
2. Security текст технически корректен.
3. `Log out` одинаково работает из всех экранов.

---

## Шаг 2. Состояния и latency visibility

Связь с backlog: `UX-002`, `UX-102`.

### Что делаем
1. Проводим end-to-end карту событий:
- processing pipeline
- live interview states
2. Добавляем в UI state lane:
- listening
- transcribing
- generating
- no_signal
- error
3. Подключаем `processing-status` в renderer.

### Артефакты
1. State diagram (технический и UX-вариант).
2. Таблица "event -> UI indicator -> fallback behavior".

### Done
1. Пользователь в любой момент видит текущий этап.
2. Нет "silent wait" во время обработки.

---

## Шаг 3. Пересборка critical path интерфейса

Связь с backlog: `UX-101`, `UX-104`.

### Что делаем
1. Редизайн главной панели:
- укрупнение primary actions;
- уменьшение конкурирующих controls.
2. Повышаем читаемость:
- минимум 13-14px в ключевых текстах;
- увеличенные hit areas.
3. Отделяем destructive actions от utility.

### Артефакты
1. Low-fi wireframes (Session HUD).
2. Список компонентных изменений (before/after).

### Done
1. Критичные действия находятся и читаются за <2 сек.
2. Снижен риск misclick на primary controls.

---

## Шаг 4. Onboarding 2.0 (честный и рабочий)

Связь с backlog: `UX-005`, `UX-106`.

### Что делаем
1. Убираем fake тесты; добавляем реальные проверки.
2. Проверяем, что wizard-настройки применяются в runtime.
3. Упрощаем первый запуск до четкого пути:
- setup -> verify -> start session.

### Артефакты
1. Новый flow onboarding (A->Z).
2. QA сценарии first-run.

### Done
1. First-run setup не дает ложных "success".
2. Выбранные настройки реально влияют на поведение панели.

---

## Шаг 5. Error recovery redesign

Связь с backlog: `UX-103`.

### Что делаем
1. Заменяем toast-only ошибки на inline recovery cards.
2. Для каждой частой ошибки добавляем next action:
- retry
- open settings
- switch source
- reset context

### Артефакты
1. Error taxonomy.
2. Recovery matrix.

### Done
1. Любая частая ошибка имеет actionable путь.
2. Пользователь восстанавливает поток в 1-2 клика.

---

## Шаг 6. IA cleanup и удаление legacy-шумов

Связь с backlog: `UX-105`, `UX-107`.

### Что делаем
1. Закрепляем основную IA:
- Session (primary)
- Setup (secondary)
- Debug/History (tertiary)
2. Вычищаем legacy-поверхности из активного UX.
3. Нормализуем API surface и типы.

### Артефакты
1. Обновленная карта экранов.
2. Список удаленных/изолированных legacy paths.

### Done
1. Нет пользовательских маршрутов к неактуальным сущностям.
2. Основной путь не рвется на лишние режимы.

---

## Шаг 7. Visual system consolidation

Связь с backlog: `UX-104`, `UX-204`.

### Что делаем
1. Фиксируем обновленные UI правила:
- типографика
- контраст
- spacing
- motion usage
2. Унифицируем токены и компонентные варианты.

### Артефакты
1. Mini design system spec.
2. Component checklist для экранов Session/Setup.

### Done
1. Компоненты визуально консистентны.
2. Motion используется только функционально.

---

## Шаг 8. Implementation waves (разработка)

### Wave A (P0, 1 спринт)
1. `UX-001`, `UX-002`, `UX-003`, `UX-004`, `UX-005`.

### Wave B (P1 core, 1 спринт)
1. `UX-101`, `UX-102`, `UX-103`, `UX-104`.

### Wave C (P1 completion, 1 спринт)
1. `UX-105`, `UX-106`, `UX-107`.

### Wave D (P2, 1-2 спринта)
1. `UX-201`, `UX-202`, `UX-203`, `UX-204`.

### Done для каждой wave
1. Все acceptance criteria закрыты.
2. Пройден smoke + regression набор.
3. Обновлена документация изменений.

---

## Шаг 9. QA, доступность и производительность

### Что делаем
1. Smoke сценарии:
- first launch
- setup
- screenshot flow
- live flow
- error recovery
- re-entry
2. Проверки accessibility:
- размер/контраст
- focus states
- keyboard flow
3. Проверки производительности:
- отзывчивость панели;
- задержки на state transitions.

### Артефакты
1. QA test report.
2. Bug list с severity.

### Done
1. Нет блокирующих дефектов в critical path.
2. UX критерии читаемости соблюдены.

---

## Шаг 10. Rollout и post-release контроль

### Что делаем
1. Релиз в staged формате:
- internal
- pilot
- full
2. Мониторим KPI и собираем обратную связь.
3. Делаем post-release patch на критичные инсайты.

### KPI
1. Time to first useful answer.
2. Доля silent confusion событий.
3. Успешность first-run setup.
4. Количество ошибок по hotkeys/некорректным действиям.
5. Recovery success rate.

### Done
1. KPI улучшаются относительно baseline.
2. Нет критичных UX-регрессий в production.

---

## 5. Календарный план (пример на 8 недель)

1. Неделя 1: Шаг 0-1 (baseline + truth alignment).
2. Неделя 2: Шаг 2 (states/latency visibility).
3. Неделя 3: Шаг 3 (critical path panel redesign).
4. Неделя 4: Шаг 4 (onboarding 2.0).
5. Неделя 5: Шаг 5 (error recovery).
6. Неделя 6: Шаг 6 (IA cleanup + legacy removal).
7. Неделя 7: Шаг 7-9 (visual consolidation + QA/perf/accessibility).
8. Неделя 8: Шаг 10 (rollout + stabilization patch).

Примечание: если нужно быстрее, можно сжать до 4-5 недель, но только при сокращении P2.

---

## 6. Контрольные точки (go/no-go)

1. Gate A (после недели 2):
- есть видимые статусы pipeline и нет silent wait.
2. Gate B (после недели 4):
- onboarding честный и операционно рабочий.
3. Gate C (после недели 6):
- IA упрощена, legacy не влияет на основной UX.
4. Gate D (pre-release):
- критичный smoke + accessibility check пройдены.

---

## 7. Финальный Definition of Done

1. Пользователь за 1-2 секунды понимает "что происходит" и "что делать дальше".
2. Задержки прозрачно объясняются состояниями интерфейса.
3. Все критичные тексты и действия консистентны и технически правдивы.
4. Основной сценарий (capture/live -> answer -> recovery) работает без тупиков.
5. KPI после релиза показывают улучшение относительно baseline.
