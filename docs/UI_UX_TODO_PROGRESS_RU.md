# UI/UX TODO Progress Tracker

Дата обновления: 2026-02-07 (после Sprint 5 — i18n & Polish)  
Источник: `docs/UI_UX_SPRINT_PLAN_EN.md`, `docs/UI_UX_IMPLEMENTATION_BACKLOG_RU.md`

## Общий прогресс

- Выполнено: `24 / 24` задач
- В процессе: `0 / 24`
- Не начато: `0 / 24`

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

## Sprint 5 (i18n & Polish)

- [x] `I18N-001` i18n инфраструктура (`react-i18next` + `i18next`, `en.json` / `ru.json`)
- [x] `I18N-002` Локализация WelcomeScreen, Wizard, App.tsx
- [x] `I18N-003` Локализация AudioSettings (30+ ключей)
- [x] `I18N-004` Локализация SettingsPage — Mode, Profile, Style (38+ ключей)
- [x] `I18N-005` Анимация переходов секций настроек (`animate-fade-in`)
- [x] `TECH-003` Фикс ElectronAPI типов (удалён дублирующий интерфейс из `env.d.ts`)

Статус: `6/6 done`

---

## Техническая валидация (последний прогон)

- [x] `eslint` по измененным UI-flow файлам
- [x] `npm run test` (26/26)
- [x] `npm run build`
- [x] `eslint` по legacy Electron strict-файлам (`electron/preload.ts`, `electron/ipcHandlers.ts`, `electron/ProcessingHelper.ts`)
- [x] `git fsck --full`
- [x] `git diff --name-only` / `git log --oneline -n 12`
- [x] `tsc --noEmit` — все ошибки pre-existing, не связаны с i18n/settings

---

## Известные блокеры / риски

- [x] Активные блокеры отсутствуют.
- Pre-existing TS ошибки в `SolutionCommands.tsx`, `Solutions.tsx`, `DebugView.tsx` (не связаны с i18n).

---

## Технический TODO (после Sprint 4)

- [x] `TECH-001` Закрыт: убраны strict ESLint ошибки в Electron-слое (`electron/preload.ts`, `electron/ipcHandlers.ts`, `electron/ProcessingHelper.ts`).
- [x] `TECH-002` Закрыт: восстановлена целостность git metadata/pack, `git diff` и история работают стабильно.
- [x] `TECH-003` Закрыт: удалён дублирующий `ElectronAPI` из `env.d.ts`. Канонический тип — `src/types/electron.d.ts`.

---

## Tech Hardening (2026-02-08)

- [x] `TECH-004` Закрыт: восстановлен IPC parity для session history каналов
  - Добавлены хендлеры: `get-session-history`, `get-session-history-item`, `delete-session-history-item`, `clear-session-history`
- [x] `TECH-005` Закрыт: устранён mismatch `openExternal` канала
  - `preload` переведён на `open-external-url`, добавлен backward-compatible alias `openExternal` в main IPC
- [x] `TECH-006` Закрыт: API key вынесен из `config.json` в secure storage path
  - Включён `safeStorage.isEncryptionAvailable()` в `SecureStorage`
  - `ConfigHelper` мигрирует plaintext ключ из `config.json` в secure storage и больше не сохраняет ключ в файл
- [x] `TECH-007` Закрыт: усилена стабильность live phrase finalization
  - Добавлен forced hint fallback таймер
  - Добавлен explicit `endTurn` после устойчивой тишины для снятия зависаний при пропущенном `turnComplete`
- [x] `TECH-008` Закрыт: ESLint scope приведен к исходникам (исключены generated/legacy директории и lock files)
  - `npm run lint` сокращен с ~`2970` проблем до `55` реальных source-code проблем
- [ ] `TECH-009` В работе: довести strict-линтинг Electron/Renderer слоёв до стабильного CI baseline
  - После `TECH-008` остаются `55` pre-existing ошибок (`no-explicit-any`, `no-unused-vars`, `ban-ts-comment`, `no-empty-object-type`, legacy `require`)

---

## Next (пошагово)

1. Исправить pre-existing TS ошибки в `SolutionCommands.tsx`, `Solutions.tsx`, `DebugView.tsx`.
2. Провести UX smoke по history restore flows (solution/debug snippets).
3. Подготовить релизный changelog по Sprint 1-5 + tech hardening.
4. Собрать финальный PR с кратким change summary.
5. Провести финальный QA pass перед release candidate.
