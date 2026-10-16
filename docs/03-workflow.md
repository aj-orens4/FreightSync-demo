# Business Process Flow & System Workflow

## 1. Business Process Flow — End-to-End

```mermaid
flowchart TD
    A[Route Planner defines service route] --> B[Logistics Manager reviews route]
    B --> C{Approved?}
    C -->|Yes| D[Route status = Active]
    C -->|No| A
    D --> E[Logistics Manager creates Tariff for route's service/vehicle type]
    E --> F[Tariff submitted for approval]
    F --> G{Approved?}
    G -->|Yes| H[Tariff status = Approved, effective date activated]
    G -->|No| E
    D --> I[Route Planner builds Schedule against Active route]
    I --> J{Conflict detected?}
    J -->|Yes| I
    J -->|No| K[Schedule = Scheduled]
    K --> L[Operations Coordinator monitors transit]
    L --> M{Delay?}
    M -->|Yes| N[Log delay, update ETA, status = Delayed]
    M -->|No| O[Schedule = Completed]
    N --> O
    H --> P[SOP Manager: relevant SOPs drafted per route/category]
    P --> Q[SOP submitted -> Approved -> Published]
    Q --> L
```

## 2. System Workflow — Tariff Approval (detailed)

```mermaid
sequenceDiagram
    participant U as Logistics Manager (UI)
    participant API as Express API
    participant DB as MySQL

    U->>API: POST /api/v1/tariffs (draft)
    API->>DB: INSERT INTO tariffs (status='Draft')
    DB-->>API: tariff_id
    API-->>U: 201 Created

    U->>API: PATCH /api/v1/tariffs/:id/submit
    API->>DB: UPDATE status='Pending Approval'
    API-->>U: 200 OK

    U->>API: PATCH /api/v1/tariffs/:id/approve
    API->>DB: BEGIN TRANSACTION
    API->>DB: INSERT INTO tariff_history (snapshot of previous approved row, if any)
    API->>DB: UPDATE tariffs SET status='Approved'
    API->>DB: INSERT INTO audit_logs (action='APPROVE_TARIFF')
    API->>DB: COMMIT
    API-->>U: 200 OK (tariff approved)
```

## 3. System Workflow — Schedule Conflict Detection

```mermaid
flowchart TD
    A[POST /api/v1/schedules] --> B[Validate route_id, vehicle exists]
    B --> C[Query schedules WHERE vehicle = X AND date overlaps]
    C --> D{Overlap found?}
    D -->|Yes| E[Return 409 Conflict + conflicting schedule_id]
    D -->|No| F[INSERT schedule, status='Scheduled']
    F --> G[INSERT audit_logs]
    G --> H[Return 201 Created]
```

## 4. SOP Version Control Workflow

```mermaid
flowchart TD
    A[Edit request on Published SOP] --> B[Copy current row into sop_versions]
    B --> C[Increment version_number on sops]
    C --> D[Apply edits to sops row]
    D --> E[Status reset to Draft or kept Published depending on minor/major flag]
    E --> F[Audit log entry: UPDATE_SOP_VERSION]
```
