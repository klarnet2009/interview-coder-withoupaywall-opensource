# UI/UX TODO Progress Tracker

Дата обновления: 2026-02-08 (после UnifiedPanel decomposition + ProcessingHelper cancel-race tests)  
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
- [x] `npm run test` (45/45)
- [x] `npm run build`
- [x] `eslint` по legacy Electron strict-файлам (`electron/preload.ts`, `electron/ipcHandlers.ts`, `electron/ProcessingHelper.ts`)
- [x] `git fsck --full`
- [x] `git diff --name-only` / `git log --oneline -n 12`
- [x] `tsc --noEmit` — проходит без ошибок (после фиксов `SolutionCommands` / `Solutions` / `DebugView` и API typings)
- [x] `npm run lint` — `0` ошибок (после закрытия `TECH-009`)
- [x] `history restore smoke` — добавлены unit-smoke тесты для snippet restore (`tests/unit/sessionRestore.test.ts`)
- [x] `build chunking` — включен manual chunking для renderer + external deps для Electron main
- [x] `build warnings` — предупреждения `Some chunks are larger than 500 kB` отсутствуют
- [x] `electron ts phase-a` — `tsconfig.electron.json`: `noImplicitAny: true`, сборка без TS ошибок
- [x] `integration tests` — добавлены `tests/integration/ipcContract.integration.test.ts` и `tests/integration/liveInterviewLifecycle.integration.test.ts` (`34/34`)
- [x] `electron ts phase-b/c` — `strictNullChecks: true` и `strict: true`, Electron сборка стабильна
- [x] `processing integration tests` — покрыты screenshot-processing/recovery ветки `ProcessingHelper` (`tests/integration/processingHelper.integration.test.ts`)
- [x] `processing formatter tests` — добавлены unit-тесты для solution/debug formatters (`tests/unit/responseFormatters.test.ts`)
- [x] `processing cancel-race integration tests` — покрыты cancellation race окна (queue/debug) для `ProcessingHelper`

---

## Известные блокеры / риски

- [x] Активные блокеры отсутствуют.
- Значимых активных технических блокеров нет; остаются только плановые улучшения архитектуры и QA-покрытия.

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
- [x] `TECH-009` Закрыт: strict-линтинг Electron/Renderer доведен до стабильного CI baseline
  - Исправлены pre-existing ошибки (`no-explicit-any`, `no-unused-vars`, `ban-ts-comment`, `no-empty-object-type`, legacy `require`)
  - Текущий результат: `npm run lint` проходит без ошибок
- [x] `TECH-010` Закрыт: оптимизирован bundle/perf baseline
  - `vite.config.ts`: manual chunks для renderer (`code-highlighting`, `radix-ui`, `react-query`, `i18n`, `react-core`, `vendor`)
  - `vite.config.ts`: externalized runtime dependencies для Electron main build
  - Вынесен облегченный `CodeSyntax` (`PrismLight` + ограниченный language set) и подключен в `Solutions`/`Debug`
- [x] `TECH-011` Закрыт: внедрен Electron TypeScript strictness Phase A
  - `tsconfig.electron.json`: `noImplicitAny` переведен в `true`
  - `npx tsc -p tsconfig.electron.json` проходит без ошибок
- [x] `TECH-012` Закрыт: `ProcessingHelper` переведен на provider strategy + orchestration
  - Добавлен слой `electron/processing/providers/*` (`OpenAI`, `Gemini`, `Anthropic`)
  - Добавлен `electron/processing/ProcessingProviderOrchestrator.ts`
  - `electron/ProcessingHelper.ts` использует единый провайдер-интерфейс вместо branch-heavy inline API логики
- [x] `TECH-013` Закрыт: усилен IPC/live runtime QA и устранен IPC contract gap
  - Добавлен `clear-store` handler в `electron/ipcHandlers.ts`
  - Добавлен `clearStoreData` helper в `electron/store.ts`
  - Добавлены integration tests на контракт preload/main и live lifecycle
- [x] `TECH-014` Закрыт: завершена Electron TypeScript strict migration
  - `tsconfig.electron.json`: `strictNullChecks` и `strict` переведены в `true`
  - `npx tsc -p tsconfig.electron.json`, `npm run lint`, `npm test`, `npm run build` проходят
- [x] `TECH-015` Закрыт: добавлено integration coverage для screenshot processing/recovery
  - Тестовые сценарии: queue-empty, extraction-failure + recovery, queue-success transition, debug-success path, provider-not-configured path
  - Файл: `tests/integration/processingHelper.integration.test.ts`
- [x] `TECH-016` Закрыт: вынесен response parsing/shaping из `ProcessingHelper` в formatters
  - `electron/processing/formatters/solutionResponseFormatter.ts`
  - `electron/processing/formatters/debugResponseFormatter.ts`
  - `ProcessingHelper` переключен на formatter-функции, добавлено unit-покрытие (`tests/unit/responseFormatters.test.ts`)
- [x] `TECH-017` Закрыт: декомпозирован `UnifiedPanel` на целевые UI-модули
  - Добавлены `src/components/UnifiedPanel/{types.ts,constants.ts,LiveStateLane.tsx,ActionNoticeBanner.tsx,ResponseSection.tsx,AudioSourceSelector.tsx,renderFormattedText.tsx}`
  - `src/components/UnifiedPanel/UnifiedPanel.tsx` сокращен и оставлен как runtime-controller слой
- [x] `TECH-018` Закрыт: добавлено integration покрытие cancellation race для `ProcessingHelper`
  - Новые тест-кейсы в `tests/integration/processingHelper.integration.test.ts`:
    - отмена queue processing без stale success событий
    - отмена debug processing без stale debug success
  - `npm test` обновлен baseline: `45/45`

---

## Next (пошагово)

1. [x] Исправить pre-existing TS ошибки в `SolutionCommands.tsx`, `Solutions.tsx`, `DebugView.tsx`.
2. [x] Провести UX smoke по history restore flows (solution/debug snippets).
3. [x] Подготовить релизный changelog по Sprint 1-5 + tech hardening.
   - `docs/RELEASE_CHANGELOG_SPRINT1_5_EN.md`
4. [x] Собрать финальный PR с кратким change summary.
5. [x] Провести финальный QA pass перед release candidate.
   - `docs/FINAL_PR_AND_QA_SUMMARY_EN.md`
