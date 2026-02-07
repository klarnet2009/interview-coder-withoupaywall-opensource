# UI/UX Implementation Backlog

Дата: 2026-02-07  
Проект: `interview-coder-withoupaywall-opensource`

Легенда приоритетов:
- `P0` критично (немедленно)
- `P1` высокий импакт
- `P2` улучшения после стабилизации

---

## P0 задачи

## UX-001 — Единый источник hotkeys
- Приоритет: P0
- Описание: синхронизировать все подсказки hotkeys с реально зарегистрированными shortcuts.
- Файлы:
- `electron/shortcuts.ts`
- `src/components/WelcomeScreen.tsx`
- `src/components/Wizard/WizardSteps/StepReady.tsx`
- `src/components/Wizard/WizardSteps/StepDisplay.tsx`
- `src/components/Settings/SettingsDialog.tsx`
- Acceptance Criteria:
- toggle/show-hide везде одинаковый (`Ctrl/Cmd + B`);
- нет расхождений между копирайтом и поведением.
- Оценка: 4-6 часов.

## UX-002 — Визуализация processing-status
- Приоритет: P0
- Описание: подписать renderer на `processing-status` и показать этап + прогресс.
- Файлы:
- `electron/preload.ts`
- `src/_pages/Queue.tsx`
- `src/_pages/Solutions.tsx`
- `src/components/UnifiedPanel/UnifiedPanel.tsx`
- Acceptance Criteria:
- при screenshot processing пользователь видит шаги и прогресс;
- исчезает "silent wait".
- Оценка: 6-10 часов.

## UX-003 — Честность security copy
- Приоритет: P0
- Описание: исправить тексты про хранение API key в соответствии с фактической реализацией.
- Файлы:
- `electron/SecureStorage.ts`
- `src/components/Wizard/WizardSteps/StepApiKey.tsx`
- `src/components/Settings/SettingsDialog.tsx`
- Acceptance Criteria:
- нет заявлений про OS-level encryption, если оно не активно;
- copy отражает реальное состояние storage.
- Оценка: 2-4 часа.

## UX-004 — Нормализация поведения Log out
- Приоритет: P0
- Описание: привести `Log out` к одной бизнес-семантике (например, clear key + reset state + open setup).
- Файлы:
- `src/components/UnifiedPanel/UnifiedPanel.tsx`
- `src/components/Solutions/SolutionCommands.tsx`
- `src/App.tsx`
- `electron/ConfigHelper.ts`
- Acceptance Criteria:
- из любого экрана `Log out` дает одинаковый результат;
- пользователь понимает последствия.
- Оценка: 4-8 часов.

## UX-005 — Удаление fake validation из wizard
- Приоритет: P0
- Описание: заменить симуляции на реальные проверки, либо маркировать как demo.
- Файлы:
- `src/components/Wizard/WizardSteps/StepAudio.tsx`
- `src/components/Wizard/WizardSteps/StepTest.tsx`
- `electron/ipcHandlers.ts`
- Acceptance Criteria:
- нет "успешных" тестов на основе random/timeout-only;
- результат теста технически обоснован.
- Оценка: 8-14 часов.

---

## P1 задачи

## UX-101 — Переработка главной action-панели
- Приоритет: P1
- Описание: сократить количество конкурентных действий и укрупнить critical controls.
- Файлы:
- `src/components/UnifiedPanel/UnifiedPanel.tsx`
- `src/_pages/Queue.tsx`
- Acceptance Criteria:
- первичные действия читаются за <2 сек;
- снижен риск misclick.
- Оценка: 10-16 часов.

## UX-102 — State lane для live-потока
- Приоритет: P1
- Описание: явная визуализация `listening/transcribing/generating/no_signal/error`.
- Файлы:
- `src/components/UnifiedPanel/UnifiedPanel.tsx`
- `electron/audio/LiveInterviewService.ts`
- Acceptance Criteria:
- каждый этап clearly visible;
- при latency пользователь видит, что система работает.
- Оценка: 8-12 часов.

## UX-103 — Error-to-action recovery
- Приоритет: P1
- Описание: заменить "только toast" на inline recovery controls.
- Файлы:
- `src/components/UnifiedPanel/UnifiedPanel.tsx`
- `src/_pages/Solutions.tsx`
- `src/_pages/Queue.tsx`
- Acceptance Criteria:
- каждая частая ошибка имеет next action;
- recovery path доступен в 1 клик.
- Оценка: 8-12 часов.

## UX-104 — Доступность: типографика и target size
- Приоритет: P1
- Описание: поднять min size текста и увеличить hit areas в critical path.
- Файлы:
- `src/components/UnifiedPanel/UnifiedPanel.tsx`
- `src/_pages/Solutions.tsx`
- `src/components/WelcomeScreen.tsx`
- `src/index.css`
- Acceptance Criteria:
- критичные подписи >= 13px;
- кнопки критичного пути имеют комфортный target.
- Оценка: 6-10 часов.

## UX-105 — Упрощение IA главного потока
- Приоритет: P1
- Описание: сделать один основной Session flow и убрать лишние режимные разрывы.
- Файлы:
- `src/App.tsx`
- `src/_pages/SubscribedApp.tsx`
- `src/_pages/Queue.tsx`
- `src/_pages/Solutions.tsx`
- Acceptance Criteria:
- ясный primary route;
- минимизированы jump между режимами.
- Оценка: 10-18 часов.

## UX-106 — Привязка wizard-настроек к runtime
- Приоритет: P1
- Описание: гарантировать, что выборы в wizard реально применяются на рабочем экране.
- Файлы:
- `src/components/Wizard/WizardContainer.tsx`
- `src/components/Wizard/WizardSteps/*.tsx`
- `src/components/UnifiedPanel/UnifiedPanel.tsx`
- `electron/ConfigHelper.ts`
- Acceptance Criteria:
- выбранный source/mode/display влияет на runtime;
- нет "мертвых" предпочтений.
- Оценка: 8-14 часов.

## UX-107 — Очистка legacy-состояний и текстов
- Приоритет: P1
- Описание: убрать остатки subscription/supabase-потока из актуального UX.
- Файлы:
- `src/_pages/SubscribePage.tsx`
- `src/lib/supabase.ts`
- `electron/preload.ts`
- `src/types/electron.d.ts`
- Acceptance Criteria:
- пользователь не видит неактуальные сущности;
- API surface соответствует реальному продукту.
- Оценка: 6-12 часов.

---

## P2 задачи

## UX-201 — Response Workspace v2
- Приоритет: P2
- Описание: структурировать output в формат "Key points / Code / Complexity / Next step".
- Файлы:
- `src/_pages/Solutions.tsx`
- `src/components/Response/AIResponse.tsx`
- `src/_pages/Debug.tsx`
- Acceptance Criteria:
- ответы легче сканируются под нагрузкой;
- сокращено время поиска нужного блока.
- Оценка: 10-16 часов.

## UX-202 — Debug Workspace v2
- Приоритет: P2
- Описание: нормализовать дебаг-ответы в Issue -> Fix -> Why -> Verify.
- Файлы:
- `src/_pages/Debug.tsx`
- `electron/ProcessingHelper.ts`
- Acceptance Criteria:
- debug-анализ структурирован и repeatable;
- улучшена recoverability.
- Оценка: 8-14 часов.

## UX-203 — History/Session log
- Приоритет: P2
- Описание: добавить легковесную историю последних сессий и ответов.
- Файлы:
- `src/components/Sessions/SessionHistory.tsx`
- `src/types/index.ts`
- `electron/store.ts`
- Acceptance Criteria:
- есть доступ к последним N сессиям;
- можно быстро вернуться к предыдущему ответу.
- Оценка: 12-20 часов.

## UX-204 — Motion polish (functional only)
- Приоритет: P2
- Описание: анимации только для state transitions и stream feedback.
- Файлы:
- `src/index.css`
- `src/components/UnifiedPanel/UnifiedPanel.tsx`
- Acceptance Criteria:
- нет декоративных "шумовых" анимаций;
- motion повышает, а не снижает читаемость.
- Оценка: 4-8 часов.

---

## Рекомендуемая последовательность внедрения

1. Сначала P0 целиком.
2. Затем UX-101/102/103 как ядро P1.
3. Затем IA cleanup и runtime-wizard consistency.
4. Потом P2 улучшения и polish.

---

## Минимальный QA checklist после каждого блока

1. First launch -> onboarding -> ready flow проходит без тупиков.
2. Hotkeys работают и совпадают с UI-подсказками.
3. Screenshot flow показывает явные этапы обработки.
4. Live audio состояния читаемы и логичны.
5. Error scenarios имеют recovery-кнопки.
6. Log out ведет к предсказуемому результату.
7. После re-entry состояние корректно восстанавливается.

---

## KPI для контроля результата

1. Time to first useful answer.
2. Доля "silent wait confusion" событий.
3. Успешность first-run setup.
4. Количество misclick в critical path.
5. Доля успешного recovery после ошибки.
