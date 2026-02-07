# UI/UX TODO Progress Tracker

Дата обновления: 2026-02-07 (после закрытия TECH-001/TECH-002)  
Источник: `docs/UI_UX_SPRINT_PLAN_EN.md`, `docs/UI_UX_IMPLEMENTATION_BACKLOG_RU.md`

## Общий прогресс

- Выполнено: `18 / 18` задач
- В процессе: `0 / 18`
- Не начато: `0 / 18`

---

## Sprint 1 (P0 Stabilization)

- [x] `UX-001` Единый источник hotkeys
- [x] `UX-002` Визуализация processing-status
- [x] `UX-003` Честность security copy
- [x] `UX-004` Нормализация поведения Log out
- [x] `UX-005` Удаление fake validation из wizard

Статус: `5/5 done`

---

## Sprint 2 (P1 Core Experience)

- [x] `UX-101` Переработка главной action-панели
- [x] `UX-102` State lane для live-потока
- [x] `UX-103` Error-to-action recovery (inline, не только toast)
- [x] `UX-104` Доступность: типографика и target size (critical path baseline)

Статус: `4/4 done`

---

## Sprint 3 (P1 Architecture Completion)

- [x] `UX-105` Упрощение IA главного потока
- [x] `UX-106` Привязка wizard-настроек к runtime
- [x] `UX-107` Очистка legacy-состояний и текстов (subscription/supabase surface cleanup)

Статус: `3/3 done`

---

## Sprint 4 (P2 Enhancements + Hardening)

- [x] `UX-201` Response Workspace v2
- [x] `UX-202` Debug Workspace v2
- [x] `UX-203` History/Session log
- [x] `UX-204` Motion polish (functional only)

Статус: `4/4 done`

---

## Техническая валидация (последний прогон)

- [x] `eslint` по измененным UI-flow файлам
- [x] `npm run test` (26/26)
- [x] `npm run build`
- [x] `eslint` по legacy Electron strict-файлам (`electron/preload.ts`, `electron/ipcHandlers.ts`, `electron/ProcessingHelper.ts`)
- [x] `git fsck --full`
- [x] `git diff --name-only` / `git log --oneline -n 12`

---

## Известные блокеры / риски

- [x] Активные блокеры отсутствуют.

---

## Технический TODO (после Sprint 4)

- [x] `TECH-001` Закрыт: убраны strict ESLint ошибки в Electron-слое (`electron/preload.ts`, `electron/ipcHandlers.ts`, `electron/ProcessingHelper.ts`).
- [x] `TECH-002` Закрыт: восстановлена целостность git metadata/pack, `git diff` и история работают стабильно.

---

## Next (пошагово)

1. Провести UX smoke по history restore flows (solution/debug snippets).
2. Отдельно прогнать ручной сценарий first-run -> session -> history -> restore.
3. Подготовить релизный changelog по Sprint 4.
4. Собрать финальный PR с кратким change summary по Sprint 1-4 + tech hardening.
5. Провести финальный QA pass перед release candidate.
