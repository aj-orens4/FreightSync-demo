# Database Design — ERD & Schema Notes

## 1. Entity-Relationship Diagram

```mermaid
erDiagram
    ROLES ||--o{ USERS : "has"
    SERVICE_PROVIDERS ||--o{ USERS : "employs (SP admin)"
    SERVICE_PROVIDERS ||--o{ ROUTES : "operates"
    SERVICE_PROVIDERS ||--o{ SCHEDULES : "operates"

    ROUTES ||--o{ ROUTE_STOPS : "contains"
    ROUTES ||--o{ SCHEDULES : "used in"

    TARIFFS ||--o{ TARIFF_HISTORY : "versioned into"
    USERS ||--o{ TARIFFS : "creates/approves"

    SOPS ||--o{ SOP_VERSIONS : "versioned into"
    SOPS ||--o{ SOP_DOCUMENTS : "attaches"
    USERS ||--o{ SOPS : "authors"

    SCHEDULES ||--o{ SCHEDULE_DELAYS : "logs"
    USERS ||--o{ SCHEDULES : "creates"

    USERS ||--o{ AUDIT_LOGS : "performs"

    USERS {
        int user_id PK
        string username
        string email
        string password_hash
        int role_id FK
        int provider_id FK
    }
    ROLES {
        int role_id PK
        string role_name
    }
    SERVICE_PROVIDERS {
        int provider_id PK
        string provider_code
        string provider_name
        string status
    }
    ROUTES {
        int route_id PK
        string route_code
        string origin
        string destination
        decimal total_distance_km
        string route_status
        int provider_id FK
    }
    ROUTE_STOPS {
        int stop_id PK
        int route_id FK
        string stop_name
        int sequence_no
    }
    TARIFFS {
        int tariff_id PK
        string service_type
        string vehicle_type
        decimal base_rate
        decimal fuel_surcharge
        decimal additional_charges
        decimal total_freight_cost
        string status
    }
    TARIFF_HISTORY {
        int history_id PK
        int tariff_id FK
        json snapshot_json
    }
    SOPS {
        int sop_id PK
        string sop_title
        string category
        int version_number
        string approval_status
    }
    SOP_VERSIONS {
        int version_id PK
        int sop_id FK
        int version_number
        json snapshot_json
    }
    SOP_DOCUMENTS {
        int document_id PK
        int sop_id FK
        string file_name
    }
    SCHEDULES {
        int schedule_id PK
        int route_id FK
        datetime departure_time
        datetime arrival_time
        string vehicle_code
        string status
    }
    SCHEDULE_DELAYS {
        int delay_id PK
        int schedule_id FK
        string delay_reason
        datetime revised_arrival_time
    }
    AUDIT_LOGS {
        int log_id PK
        int user_id FK
        string action
        string entity_type
        int entity_id
    }
```

## 2. Normalization Notes

- All tables are in **3NF**: no repeating groups, no partial dependencies (every non-key column depends on the full primary key), no transitive dependencies.
- `tariffs.total_freight_cost` is a **generated/computed column** (`base_rate + additional_charges + fuel_surcharge`), stored for fast read/filter without risking drift from the formula.
- Historical data (`tariff_history`, `sop_versions`) is stored as **JSON snapshots** rather than duplicating the full column set as a parallel table — this keeps the schema stable even if the parent table gains columns later, at the small cost of losing native SQL filtering on historical field values (acceptable since history is read rarely and sequentially).
- `route_stops` uses a composite uniqueness constraint `(route_id, sequence_no)` to guarantee stop ordering integrity.
- `schedules` indexes `(vehicle_code, departure_time, arrival_time)` specifically to make conflict-detection queries (FR-4.2) fast.

## 3. Standardized IDs for Cross-Module Integration

Every primary entity exposes both:
1. An internal auto-increment `*_id` (INT) — used for FK relationships within Module 9.
2. A human/system-readable `*_code` (e.g. `RT-0001`, `TR-0002`, `SOP-0001`, `SC-0001`) — this is the identifier other modules should reference when linking (e.g., Shipment Management storing `route_code` rather than the raw internal `route_id`), so Module 9's internal numbering can evolve without breaking external references.
