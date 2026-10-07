# Spendwise Simplification and Reliability Plan

## Objective

Refocus Spendwise on:

- Monthly obligation forecasting and payment tracking.
- Bank, cash, wallet, card, pay-later, recurring-payment, loan, and debt management.
- Income planning and money owed to the user.
- Accurate loan principal, interest, variable installments, and repayment history.
- Reliable backup and restore across schema versions.

The app should not expose general transaction management. An internal ledger may remain for balance changes, payment reversals, and backup integrity.

## Target Information Architecture

| Area | Responsibility |
| --- | --- |
| Plan | Current- and next-month cash-flow forecast |
| Payments | Monthly checklist of overdue, upcoming, and paid obligations |
| Accounts → Banks | Bank, cash, and wallet balances |
| Accounts → Cards | Credit cards and pay-later accounts |
| Accounts → Recurring | Rent, utilities, subscriptions, insurance, and similar records |
| Accounts → Loans | Loan/debt accounts and full repayment schedules |
| Income | Salary, other income, and money owed to the user |
| Settings | Profile, backup/restore, and destructive actions |

Ownership rules:

- Loans must only be managed in Accounts → Loans.
- Recurring records must only be managed in Accounts → Recurring.
- Payments must track monthly occurrences and must not be another management screen.
- Pay-later accounts belong under Cards, not Loans.
- Money owed to the user belongs under Income.

## Audit Findings

### Critical financial correctness

1. The monthly planner ignores lender-provided variable installment schedules and uses one default EMI and due day.
2. Loan payment validation compares the complete EMI against outstanding principal, even though the EMI includes interest.
3. The loan payment form also caps the complete payment at remaining principal.
4. Reversing a payment always increases the selected bank balance, which is incorrect when reversing money received from a borrower.
5. Internal ledger entries are located by fuzzy name and amount matching rather than a stable relationship.
6. Payments are associated with installments by calendar month rather than an installment identifier.
7. Card payments have no dedicated payment record, history, or reliable undo operation.
8. Card bill data is mutable and does not preserve individual statement cycles.
9. Paid recurring obligations disappear from the monthly checklist instead of remaining visible as completed items.
10. Previous unpaid recurring obligations are not consistently carried into the current month.

### Product ownership and navigation

1. Recurring payments can currently be created from more than one screen.
2. Loans exist both as a route and as an imported page inside Accounts.
3. Dashboard links bypass the Accounts section and open the standalone debt route.
4. `PAY_LATER` exists in both card and debt concepts.
5. Navigation uses inconsistent names such as Payments, Recurring Payments, Bills, Other payments, and Commitments.
6. Account subsection state is not represented in the URL, so refresh and browser navigation reset the selected section.
7. Completed loans are hidden, making their history inaccessible.

### Loan management

1. The database supports official repayment totals and custom schedules, but the loan form cannot enter them.
2. There is no paid-through-date or bulk paid-installment setup for loans that started earlier.
3. There is no interface for variable first, middle, or final installments.
4. Generated schedules and lender-provided schedules are not clearly distinguished.
5. Principal outstanding, future installment total, and future interest need consistently labelled values.

### UI and code consistency

1. The Accounts page contains multiple domains, forms, reconciliation, and imported pages in one large component.
2. Shared UI primitives are concentrated in one large file.
3. Pages use different spacing, summary-card layouts, action placement, empty states, and loading states.
4. Several operations ignore failed API responses and can display success or close forms after a failure.
5. Native confirmation dialogs and custom sheets are mixed.
6. The custom Select lacks complete keyboard and screen-reader behavior.
7. Sheets need dialog semantics, focus trapping, Escape support, and focus restoration.
8. Several icon-only actions lack accessible labels.
9. The drawer uses emoji while the bottom navigation uses a different icon system.
10. Large inline JSX blocks make behavior difficult to test and maintain.

### Planning and settings

1. The currency setting is not applied to displayed values; formatting defaults to INR.
2. Weekly and one-time income exist in the schema but are not implemented by the planner and UI.
3. Optional and required commitments are calculated differently without sufficiently clear labels.
4. Card minimum due and full due are displayed and forecast inconsistently.

### Backup and restore

1. Current backups include custom schedules, official totals, principal portions, and payment history.
2. Restore input is not validated with a complete versioned schema.
3. Unsupported future backup versions are not explicitly rejected.
4. There is no restore preview or collection-count summary.
5. Legacy and current recurring collections can potentially be imported together.
6. IDs are reused directly, making cross-account imports fragile.
7. Compatibility coverage is limited to one current-format round-trip test.
8. The supplied production version 3.0 backup contains no loans, so it cannot recreate the locally imported Bajaj and Finnable records.

### Legacy and operational concerns

1. User-facing transaction pages are gone, but transaction mutation APIs and forms remain.
2. The Android client is still transaction-focused and can create arbitrary expenses.
3. The internal ledger is still required for balance changes and reversals and should not simply be deleted.
4. One integration-test scenario depends on hardcoded calendar dates.
5. There are no browser-level accessibility or responsive-layout tests.
6. Production runs migrations from the Docker entrypoint, but migration failure recovery and database backup procedures are undocumented.
7. Prisma's package-based seed configuration is deprecated.

## Implementation Phases

## Phase 0 — Protect Existing Data

### Work

- Create sanitized fixtures representing the current local Bajaj and Finnable loans.
- Export a fresh local backup containing both corrected loans.
- Record expected principal outstanding, paid amount, future interest, and future installment total for each loan.
- Add a database migration checklist and rollback notes.
- Keep production seeding disabled unless `SEED_DATABASE=true`.

### Acceptance criteria

- A fresh backup can reproduce both loans exactly in a temporary user account.
- No implementation phase starts without passing the backup round-trip test.

## Phase 1 — Correct Loan and Payment Accounting

### Data model

Extend debt payments with stable schedule and ledger relationships:

- `installmentNumber`
- `scheduledDueDate`
- `interestAmount`
- `transactionId`

Consider a unique constraint on `(debtId, installmentNumber)` when an installment number is present.

### API behavior

- Resolve the scheduled installment before validating a payment.
- Compare only the principal component against principal outstanding.
- Allow the complete scheduled payment even when it exceeds final principal outstanding.
- Store principal and interest components explicitly.
- Reverse borrowed and lent payments in the correct balance direction.
- Reverse the exact linked internal ledger entry.
- Reject duplicate installment payments atomically.

### Tests

- Variable first installment.
- Variable final installment.
- Final EMI greater than remaining principal.
- Borrowed payment and reversal.
- Lent repayment and reversal.
- Duplicate payment protection.
- Concurrent repayment protection.

### Acceptance criteria

- Bajaj and Finnable balances match their source documents after every recorded installment.
- Pay and undo restore the exact previous account and loan balances.

## Phase 2 — Create a Canonical Monthly Obligation Service

### Work

Replace encoded IDs such as `debt-<id>-<date>` with typed obligation objects containing:

- Source type.
- Source record ID.
- Occurrence or installment ID.
- Installment number where relevant.
- Due date.
- Scheduled amount.
- Principal and interest where relevant.
- Required or optional status.
- Overdue, upcoming, or paid status.
- Payment date and payment account.
- Supported actions.

Generation rules:

- Recurring records use their monthly occurrence.
- Loans use lender-provided schedules first.
- Loans without a custom schedule use the generated schedule.
- One-time debts use their deadline.
- Card obligations use a card bill occurrence.
- Paid items remain in the selected month.
- Previous missed obligations are carried forward as overdue.

### Acceptance criteria

- Payments shows the exact amount and due date for every obligation.
- Paid records stay visible and can be safely marked unpaid.
- Forecast and Payments consume the same obligation data.

## Phase 3 — Normalize Recurring Payments and Card Bills

### Recurring payments

Support full management of:

- Name and type.
- Amount.
- Due day.
- Start and optional end date.
- Default payment account.
- Required or optional status.
- Active or paused status.
- Edit, archive, and history.

Add a symmetric mark-unpaid operation for recurring occurrences.

### Card bills

Introduce card bill occurrences with:

- Statement date.
- Due date.
- Statement amount.
- Minimum due.
- Paid amount.
- Paid date.
- Status.

Keep card usage, statement balance, minimum due, and available limit as distinct values.

### Acceptance criteria

- Every monthly card bill is historically reproducible.
- A card payment can be safely reversed.
- Forecast labels clearly state whether they reserve full due or minimum due.

## Phase 4 — Restructure Navigation and Screen Ownership

### Routes

- Keep main navigation: Plan, Payments, Accounts, Income.
- Make account sections URL-addressable, for example `/accounts?section=loans`.
- Redirect old `/debts` and `/bills` routes to their canonical destinations.
- Update Dashboard links to canonical routes.

### Accounts sections

Extract focused components:

- `BankAccountsPanel`
- `CardsPanel`
- `RecurringPaymentsPanel`
- `LoansPanel`

Do not import complete route pages inside other route pages.

### Naming

Use these labels consistently:

- Payments
- Bank accounts
- Cards & pay later
- Recurring
- Loans & debts
- Income

### Acceptance criteria

- Every record type has exactly one management location.
- Refresh, Back, and shared links preserve the selected Accounts section.
- Main Payments contains no record-creation form.

## Phase 5 — Build a Consistent UI System

### Shared components

Create:

- `PageContainer`
- `SectionTabs`
- `SummaryCard`
- `RecordList`
- `RecordRow`
- `EmptyState`
- `LoadingState`
- `InlineError`
- `ConfirmDialog`
- `FormSection`

Split the existing shared UI file into focused modules.

### Visual rules

- One summary-card structure across all account sections.
- One spacing scale for page, section, card, and form layout.
- One action hierarchy for primary, secondary, edit, and destructive actions.
- Consistent empty, loading, error, and success feedback.
- Consistent icons across bottom navigation and drawer navigation.
- Avoid nested page containers and duplicate padding.

### Accessibility

- Use accessible native selects or implement a complete listbox pattern.
- Associate every label with its field.
- Add dialog semantics and focus management to sheets.
- Support Escape to close.
- Restore focus to the trigger.
- Label every icon-only action.
- Ensure keyboard access to tabs, dialogs, actions, and disclosure controls.

### Acceptance criteria

- Bank, card, recurring, and loan sections use the same visual hierarchy.
- Screens remain usable at 320px width and on desktop.
- Keyboard-only navigation works through all primary flows.

## Phase 6 — Improve Loan Setup and Detail Experience

### Creation modes

Provide two modes:

1. Simple fixed loan:
   - Original principal.
   - Interest rate.
   - Regular EMI.
   - Term.
   - First installment date.

2. Lender schedule:
   - Original principal.
   - Current principal outstanding.
   - Official total interest.
   - Official total repayment.
   - Editable installment schedule.

### Existing loans

Support:

- Paid-through month.
- Bulk mark paid through the current month.
- Variable first and final installment.
- Manual per-installment adjustment.
- Importing a schedule from backup data.

### Detail page

Show:

- Original principal.
- Principal outstanding.
- Total paid.
- Principal paid.
- Interest paid.
- Future principal.
- Future interest.
- Future payable total.
- Complete installment list.
- Active and completed status.

### Acceptance criteria

- A user can recreate Bajaj and Finnable from the UI without direct database edits.
- Completed loans remain available under a Completed filter.

## Phase 7 — Correct Income and Currency Behavior

### Income

- Keep money owed to the user exclusively under Income.
- Keep its internal storage separate from the Loans management UI.
- Decide whether weekly and one-time income are supported.
- If supported, implement their planning rules and forms.
- Otherwise remove those unused options until implemented.

### Currency

- Load the user's selected currency into a shared application context.
- Pass it consistently to every formatted value.
- Add formatting tests for supported currencies.

### Acceptance criteria

- Changing currency updates every amount consistently.
- Income frequency options match actual forecast behavior.

## Phase 8 — Harden Backup and Restore

### Backup schema

- Define a complete Zod schema for each supported backup version.
- Include explicit format, version, schema, and creation timestamp.
- Preserve inactive/completed records and all payment histories.
- Preserve internal ledger references required for reversals.

### Restore flow

1. Parse and validate the file without changing data.
2. Reject unsupported future versions.
3. Convert supported older versions into the current in-memory shape.
4. Validate references and financial invariants.
5. Show a preview with collection counts and warnings.
6. Confirm replacement.
7. Restore atomically.
8. Return restored counts and compatibility notes.

Avoid processing legacy and current recurring collections simultaneously.

### Tests

- Current schema round trip.
- Supplied version 3.0 backup.
- Legacy recurring-expense backup.
- Variable loan schedules.
- Principal and interest payment portions.
- Completed loans.
- Paid and unpaid monthly occurrences.
- Invalid JSON and truncated files.
- Unsupported future versions.
- Invalid references with rollback verification.

### Acceptance criteria

- A failed restore leaves all existing data unchanged.
- A successful restore reports exactly what was imported.
- A restored backup produces the same totals and monthly obligations as its source.

## Phase 9 — Remove or Isolate Legacy Transaction Features

### Work

- Keep the internal ledger as an implementation detail.
- Remove unused transaction forms and user-facing transaction mutations.
- Prevent the mobile client from creating arbitrary transactions unless that feature is intentionally retained.
- Rename internal transaction concepts where useful to clarify that they are system ledger entries.
- Update or retire the Android client based on current product scope.

### Acceptance criteria

- Users cannot accidentally return to the old transaction-driven product experience.
- Balance reconciliation, payment recording, reversals, and backups continue to work.

## Phase 10 — Testing, Deployment, and Operations

### Testing

- Replace hardcoded test dates with a controlled clock.
- Add unit tests for schedule calculations and obligation generation.
- Add integration tests for all pay/unpay flows.
- Add end-to-end tests for the four main navigation areas.
- Add responsive checks at common phone widths.
- Add accessibility checks for forms, tabs, and sheets.

### Deployment

- Keep `prisma migrate deploy` in the production entrypoint.
- Keep seeding opt-in only.
- Migrate Prisma seed configuration to `prisma.config.ts`.
- Add database and application health checks.
- Document migration failure recovery.
- Take a production database snapshot before migrations that change financial records.

### Acceptance criteria

- TypeScript, integration, end-to-end, and backup compatibility tests pass.
- A failed migration prevents the new application process from starting.
- Production deployment never seeds demo data unless explicitly requested.

## Recommended Delivery Order

1. Phase 0: protect existing data.
2. Phase 1: fix financial correctness.
3. Phase 2: create canonical obligations.
4. Phase 3: normalize recurring records and card bills.
5. Phase 4: settle navigation and ownership.
6. Phase 5: apply the visual and accessibility system.
7. Phase 6: complete loan onboarding and details.
8. Phase 7: correct income and currency behavior.
9. Phase 8: harden backup and restore.
10. Phases 9–10: remove legacy surface area and finish operations.

## Release Gates

Do not release a phase unless:

- Existing user data remains intact.
- Backup round-trip passes.
- Account balances reconcile after pay and undo actions.
- Monthly Payments and Plan show the same obligation amounts.
- Bajaj and Finnable document totals still match.
- TypeScript and all relevant automated tests pass.
- Mobile-width layouts have been checked.

## Definition of Done

The revamp is complete when:

- Each financial record has one obvious management location.
- Payments behaves as a monthly checklist, including paid and unpaid states.
- Variable loan schedules drive forecasts and payments.
- Principal and interest are tracked separately and accurately.
- Completed loans and payment histories remain accessible.
- The UI uses consistent components and interaction patterns.
- Backup and restore safely reproduce every current feature.
- Legacy transaction functionality is no longer exposed as a competing product model.
