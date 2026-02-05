# Story 2.8: Normalization Rules

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As IT staff,
I want to apply normalization rules to generated credentials,
So that output formats are consistent (e.g., lowercase, remove spaces).

## Acceptance Criteria

### AC1: Configure Normalization Rules

**Given** IT staff is configuring credential generation
**When** they define normalization rules
**Then** they can configure per-system rules including:
  - Convert to lowercase
  - Remove spaces
  - Remove special characters
  - Truncate to maximum length
  - Custom regex replacements

### AC2: Normalization Applied During Credential Generation

**Given** normalization rules are configured for a system
**When** credentials are generated for a user
**Then** the rules are applied to the extracted LDAP field value
**And** the normalized value is used in the credential output

### AC3: Preview Shows Normalization Results

**Given** credentials are being previewed (Story 2.3)
**When** normalization rules are configured
**Then** the preview displays both:
  - Original value from LDAP
  - Normalized value after rules applied
**And** indicates which rules were applied

### AC4: Rule Priority and Ordering

**Given** multiple normalization rules are configured
**When** they are applied
**Then** they execute in a defined order (configurable)
**And** the order can be adjusted by IT staff

### AC5: Per-System Rule Configuration

**Given** different systems may need different formats
**When** IT staff configures normalization
**Then** rules can be defined globally (default) or per-system
**And** per-system rules override global rules

### AC6: Validation of Normalized Output

**Given** normalization rules are applied
**When** the result is generated
**Then** the system validates the output meets minimum requirements:
  - Not empty after normalization
  - Within acceptable length limits
  - Contains required character types (if configured)

### AC7: Audit Logging for Rule Changes

**Given** normalization rules are created, updated, or deleted
**When** the action is completed
**Then** an audit log entry is created with:
  - Actor (IT staff who performed the action)
  - Action: `normalization_rule.create`, `normalization_rule.update`, or `normalization_rule.delete`
  - System identifier (if per-system)
  - Rule changes (old → new for updates)
  - Timestamp

## Tasks / Subtasks

- [x] **Task 1: Database Schema Extension** (AC: 5, 7)
  - [x] Add `normalization_rules` table to store rule configurations
  - [x] Schema: `id`, `system_id` (nullable, FK to system_configs), `rule_type`, `rule_config` (JSON), `priority`, `is_active`, `created_at`, `updated_at`
  - [x] Add relationship to `system_configs` table (optional per-system rules)
  - [x] Create Prisma migration
  - [x] Update `schema.prisma` with new model

- [x] **Task 2: Normalization Rule Service Layer** (AC: 1, 4, 5, 6, 7)
  - [x] Create `getNormalizationRules(systemId?)` - List rules (global or per-system)
  - [x] Create `createNormalizationRule(ruleData)` - Create new rule with validation
  - [x] Create `updateNormalizationRule(ruleId, updates)` - Update existing rule
  - [x] Create `deleteNormalizationRule(ruleId)` - Delete rule
  - [x] Create `reorderNormalizationRules(orderedIds)` - Adjust rule priority/order
  - [x] Create `applyNormalizationRules(value, systemId?)` - Apply rules to a value
  - [x] Implement rule validation (prevent empty outputs, invalid regex)
  - [x] Add audit logging for all rule CRUD operations

- [x] **Task 3: API Endpoints** (AC: 1, 4, 5, 7)
  - [x] `GET /api/v1/normalization-rules` - List global rules
  - [x] `GET /api/v1/normalization-rules?systemId={id}` - List rules for specific system
  - [x] `POST /api/v1/normalization-rules` - Create new rule
  - [x] `PUT /api/v1/normalization-rules/:ruleId` - Update rule
  - [x] `DELETE /api/v1/normalization-rules/:ruleId` - Delete rule
  - [x] `POST /api/v1/normalization-rules/reorder` - Reorder rules (priority adjustment)
  - [x] `POST /api/v1/normalization-rules/preview` - Preview normalization on sample value
  - [x] Implement Zod validation for request bodies
  - [x] Add RBAC checks (IT role only for rule management)
  - [x] Implement RFC 9457 error handling

- [x] **Task 4: Integrate with Credential Generation Service** (AC: 2, 3)
  - [x] Update `generateUserCredentials()` to apply normalization rules
  - [x] Fetch applicable rules (global + per-system, ordered by priority)
  - [x] Apply rules sequentially to extracted username value
  - [x] Pass both original and normalized values to preview
  - [x] Handle validation errors (empty output, length violations)

- [x] **Task 5: Frontend - Normalization Rule List** (AC: 1, 4)
  - [x] Create `NormalizationRuleList.jsx` component
  - [x] Display rules in priority order with drag-and-drop or up/down controls
  - [x] Show rule type, configuration summary, and scope (global/system)
  - [x] Add "Add Rule" button
  - [x] Add Edit/Delete actions per rule
  - [x] Implement empty state when no rules configured
  - [x] Add loading and error states

- [x] **Task 6: Frontend - Normalization Rule Form** (AC: 1, 5)
  - [x] Create `NormalizationRuleForm.jsx` component (modal or page)
  - [x] Rule type selector (dropdown: lowercase, remove_spaces, remove_special, truncate, regex)
  - [x] Dynamic configuration fields based on rule type:
    - Truncate: max length input
    - Regex: pattern input + replacement input
  - [x] Scope selector (global vs per-system)
  - [x] System dropdown (if per-system selected)
  - [x] Priority/order input
  - [x] Form validation with error messages
  - [x] Save/Cancel buttons

- [x] **Task 7: Frontend - Normalization Preview** (AC: 3)
  - [x] Create `NormalizationPreview.jsx` component
  - [x] Input field for test value
  - [x] System selector (to test per-system rules)
  - [x] "Preview" button to apply rules
  - [x] Display original value
  - [x] Display normalized result
  - [x] List applied rules with before/after for each
  - [x] Show validation errors if result is invalid

- [x] **Task 8: Frontend - API Integration** (AC: 1, 4)
  - [x] Add API functions to `normalizationRules.js`
  - [x] Create TanStack Query hooks: `useNormalizationRules`, `useCreateNormalizationRule`, `useUpdateNormalizationRule`, `useDeleteNormalizationRule`, `useReorderNormalizationRules`, `usePreviewNormalization`
  - [x] Implement optimistic updates for better UX
  - [x] Handle error states with RFC 9457 error display
  - [x] Add success toast notifications

- [x] **Task 9: Update Credential Preview Component** (AC: 3)
  - [x] Modify credential preview to show normalization details
  - [x] Display original LDAP value
  - [x] Display normalized value
  - [x] Show which rules were applied
  - [x] Highlight if validation warnings exist

- [x] **Task 10: Testing** (AC: 1-7)
  - [x] Unit tests for normalization service functions
  - [x] Unit tests for each rule type (lowercase, remove_spaces, etc.)
  - [x] Integration tests for API endpoints
  - [x] Test rule priority/order enforcement
  - [x] Test global vs per-system rule application
  - [x] Test validation (empty output prevention)
  - [x] Test audit log creation
  - [x] Frontend component tests

- [x] **Task 11: Documentation** (AC: 1-7)
  - [x] Update API documentation with normalization rule endpoints
  - [x] Document available rule types and configuration options
  - [x] Add examples of common normalization patterns
  - [x] Add troubleshooting guide for rule conflicts

## Dev Notes

### Architecture Requirements

**Database Schema Extension:**

```prisma
// Add to schema.prisma

model NormalizationRule {
  id          String   @id @default(uuid())
  systemId    String?  @map("system_id") // NULL = global rule, FK to system_configs
  ruleType    String   @map("rule_type") // 'lowercase', 'remove_spaces', 'remove_special', 'truncate', 'regex'
  ruleConfig  Json     @map("rule_config") // Rule-specific config (e.g., { maxLength: 20 }, { pattern: '[^a-z0-9]', replacement: '' })
  priority    Int      @default(0) // Execution order (lower = first)
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  
  // Relations
  system      SystemConfig? @relation(fields: [systemId], references: [systemId])
  
  @@map("normalization_rules")
}

// Update existing SystemConfig model
model SystemConfig {
  // ... existing fields ...
  
  // Relations
  normalizationRules NormalizationRule[]
  
  // ... rest of fields ...
}
```

**Key Schema Points:**
- `NormalizationRule.systemId`: NULL for global rules, FK for per-system rules
- `NormalizationRule.ruleType`: Enum-like string for rule implementation selection
- `NormalizationRule.ruleConfig`: JSON for flexible rule-specific parameters
- `NormalizationRule.priority`: Determines execution order (ascending)
- Relation to `SystemConfig` for per-system rule scoping

**API Patterns:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/normalization-rules` | GET | List normalization rules (global or by system) |
| `/normalization-rules` | POST | Create new normalization rule |
| `/normalization-rules/:ruleId` | PUT | Update normalization rule |
| `/normalization-rules/:ruleId` | DELETE | Delete normalization rule |
| `/normalization-rules/reorder` | POST | Reorder rules (update priorities) |
| `/normalization-rules/preview` | POST | Preview normalization on sample value |

**Request/Response Formats:**

```javascript
// Create/Update Request Body
{
  systemId: "corporate-vpn",           // optional, omit for global rule
  ruleType: "lowercase",               // required: lowercase, remove_spaces, remove_special, truncate, regex
  ruleConfig: {},                      // type-specific config (empty for lowercase)
  priority: 1                          // optional, defaults to 0
}

// Truncate rule config
{
  ruleType: "truncate",
  ruleConfig: { maxLength: 20 }
}

// Regex rule config
{
  ruleType: "regex",
  ruleConfig: { 
    pattern: "[^a-z0-9]", 
    replacement: "",
    flags: "gi"
  }
}

// Response (Success)
{
  data: {
    id: "uuid",
    systemId: "corporate-vpn",
    ruleType: "lowercase",
    ruleConfig: {},
    priority: 1,
    isActive: true,
    createdAt: "2026-02-02T10:30:00Z",
    updatedAt: "2026-02-02T10:30:00Z"
  }
}

// Preview Request
{
  value: "John.Doe@Company.com",
  systemId: "corporate-vpn"           // optional
}

// Preview Response
{
  data: {
    original: "John.Doe@Company.com",
    normalized: "johndoe",
    rulesApplied: [
      { ruleType: "lowercase", before: "John.Doe@Company.com", after: "john.doe@company.com" },
      { ruleType: "remove_special", before: "john.doe@company.com", after: "johndoecompanycom" },
      { ruleType: "truncate", before: "johndoecompanycom", after: "johndoe", config: { maxLength: 8 } }
    ],
    validation: {
      isValid: true,
      warnings: []
    }
  }
}

// Error Response - Invalid Rule Config (RFC 9457)
{
  "type": "/problems/invalid-rule-config",
  "title": "Invalid Rule Configuration",
  "status": 400,
  "detail": "The regex pattern '[invalid' is not valid",
  "field": "ruleConfig.pattern",
  "suggestion": "Ensure the regex pattern is valid JavaScript regex"
}

// Error Response - Empty Output (RFC 9457)
{
  "type": "/problems/normalization-empty",
  "title": "Normalization Produced Empty Output",
  "status": 422,
  "detail": "Applying these rules to value 'ABC' would produce an empty string",
  "value": "ABC",
  "rulesApplied": ["remove_special", "truncate"],
  "suggestion": "Review rules to ensure at least some characters remain"
}
```

**Security Requirements:**
- RBAC: IT role only for normalization rule CRUD operations
- Audit: All rule changes must be logged
- Validation: Prevent regex injection or overly aggressive rules that produce empty outputs

### Feature Structure (MUST FOLLOW)

```
apps/api/src/features/normalization-rules/
├── routes.js              # Normalization rule CRUD endpoints
├── service.js             # Business logic for normalization
├── repo.js                # Database operations
├── schema.js              # Zod validation schemas
└── index.js               # Module exports

apps/web/src/features/normalization-rules/
├── components/
│   ├── NormalizationRuleList.jsx       # List view with reordering
│   ├── NormalizationRuleForm.jsx       # Create/Edit form
│   └── NormalizationPreview.jsx        # Preview/test component
├── api/
│   └── normalizationRules.js           # API client functions
├── hooks/
│   └── useNormalizationRules.js        # TanStack Query hooks
└── index.js                            # Module exports

// Update existing credential feature
apps/api/src/features/credentials/
├── service.js             # MODIFY: Apply normalization in generateUserCredentials()
└── ...
```

### Technical Specifications

**Normalization Rule Types:**

| Rule Type | Description | Config Parameters | Example |
|-----------|-------------|-------------------|---------|
| `lowercase` | Convert to lowercase | None | "John" → "john" |
| `remove_spaces` | Remove all whitespace | None | "john doe" → "johndoe" |
| `remove_special` | Remove special chars (keep alphanum) | None | "john@doe" → "johndoe" |
| `truncate` | Limit max length | `{ maxLength: number }` | "johndoe" → "johnd" (max 5) |
| `regex` | Custom regex replacement | `{ pattern: string, replacement: string, flags?: string }` | Pattern: "@.*", Replace: "" → "john@doe.com" → "john" |

**Rule Application Flow:**

```
1. IT Staff creates normalization rules
   └─> Global rules apply to all systems
   └─> Per-system rules override for specific system

2. Rules are ordered by priority (ascending)
   └─> Priority 0 executes first
   └─> Priority 1 executes second, etc.

3. During credential generation:
   a. Extract username from LDAP field (Story 2.7)
   b. Fetch global rules (ordered by priority)
   c. Fetch per-system rules for target system (ordered by priority)
   d. Apply global rules first
   e. Apply per-system rules second (overriding global)
   f. Validate output not empty
   g. Use normalized value in credential

4. In preview mode:
   a. Show original LDAP value
   b. Show each rule's before/after
   c. Show final normalized value
   d. Show validation status
```

**Service Implementation Pattern:**

```javascript
// In apps/api/src/features/normalization-rules/service.js

export async function applyNormalizationRules(value, systemId = null) {
  if (!value || typeof value !== 'string') {
    throw new ValidationError('Value must be a non-empty string');
  }
  
  // Fetch rules in priority order
  const globalRules = await repo.getActiveRulesBySystemId(null); // global
  const systemRules = systemId ? await repo.getActiveRulesBySystemId(systemId) : [];
  
  // Combine: global first, then system (system rules act as overrides/additions)
  const rules = [...globalRules, ...systemRules].sort((a, b) => a.priority - b.priority);
  
  let normalized = value;
  const appliedRules = [];
  
  for (const rule of rules) {
    const before = normalized;
    
    switch (rule.ruleType) {
      case 'lowercase':
        normalized = normalized.toLowerCase();
        break;
      case 'remove_spaces':
        normalized = normalized.replace(/\s/g, '');
        break;
      case 'remove_special':
        normalized = normalized.replace(/[^a-zA-Z0-9]/g, '');
        break;
      case 'truncate':
        const maxLength = rule.ruleConfig.maxLength;
        if (maxLength && normalized.length > maxLength) {
          normalized = normalized.substring(0, maxLength);
        }
        break;
      case 'regex':
        const { pattern, replacement = '', flags = 'g' } = rule.ruleConfig;
        try {
          const regex = new RegExp(pattern, flags);
          normalized = normalized.replace(regex, replacement);
        } catch (err) {
          throw new InvalidRuleConfigError(`Invalid regex pattern: ${pattern}`);
        }
        break;
      default:
        logger.warn(`Unknown rule type: ${rule.ruleType}`);
    }
    
    if (normalized !== before) {
      appliedRules.push({
        ruleId: rule.id,
        ruleType: rule.ruleType,
        before,
        after: normalized,
        config: rule.ruleConfig
      });
    }
  }
  
  // Validation: ensure not empty
  if (!normalized || normalized.length === 0) {
    throw new NormalizationEmptyError(value, appliedRules);
  }
  
  return {
    original: value,
    normalized,
    rulesApplied: appliedRules,
    validation: {
      isValid: true,
      length: normalized.length,
      warnings: []
    }
  };
}

export async function createNormalizationRule(ruleData, performedBy) {
  // 1. Validate rule type
  const validTypes = ['lowercase', 'remove_spaces', 'remove_special', 'truncate', 'regex'];
  if (!validTypes.includes(ruleData.ruleType)) {
    throw new ValidationError(`Invalid rule type. Must be one of: ${validTypes.join(', ')}`);
  }
  
  // 2. Validate rule config based on type
  validateRuleConfig(ruleData.ruleType, ruleData.ruleConfig);
  
  // 3. Validate system exists if specified
  if (ruleData.systemId) {
    const system = await systemConfigRepo.getSystemConfig(ruleData.systemId);
    if (!system) {
      throw new NotFoundError(`System '${ruleData.systemId}' not found`);
    }
  }
  
  // 4. Check for duplicate (same type + config for same scope)
  const existing = await repo.findDuplicateRule(ruleData);
  if (existing) {
    throw new ConflictError(`A similar rule already exists for this scope`);
  }
  
  // 5. Create rule
  const rule = await repo.createNormalizationRule(ruleData);
  
  // 6. Create audit log
  await createAuditLog({
    action: 'normalization_rule.create',
    actor: performedBy,
    target: rule.id,
    details: { 
      systemId: rule.systemId,
      ruleType: rule.ruleType,
      priority: rule.priority 
    }
  });
  
  return rule;
}

function validateRuleConfig(ruleType, config) {
  switch (ruleType) {
    case 'truncate':
      if (!config || typeof config.maxLength !== 'number' || config.maxLength < 1) {
        throw new ValidationError('Truncate rule requires maxLength >= 1');
      }
      break;
    case 'regex':
      if (!config || !config.pattern) {
        throw new ValidationError('Regex rule requires pattern');
      }
      try {
        new RegExp(config.pattern, config.flags || 'g');
      } catch (err) {
        throw new ValidationError(`Invalid regex pattern: ${config.pattern}`);
      }
      break;
    // lowercase, remove_spaces, remove_special require no config
  }
}
```

**Zod Schemas:**

```javascript
// In apps/api/src/features/normalization-rules/schema.js

export const ruleTypeEnum = z.enum([
  'lowercase', 
  'remove_spaces', 
  'remove_special', 
  'truncate', 
  'regex'
]);

export const createNormalizationRuleSchema = z.object({
  systemId: z.string().optional(), // omit for global rule
  ruleType: ruleTypeEnum,
  ruleConfig: z.object({}).passthrough(), // validated based on ruleType
  priority: z.number().int().min(0).default(0)
}).refine(
  (data) => {
    // Validate config based on ruleType
    switch (data.ruleType) {
      case 'truncate':
        return data.ruleConfig && typeof data.ruleConfig.maxLength === 'number' && data.ruleConfig.maxLength >= 1;
      case 'regex':
        return data.ruleConfig && typeof data.ruleConfig.pattern === 'string';
      default:
        return true; // lowercase, remove_spaces, remove_special need no config
    }
  },
  { message: "Invalid ruleConfig for the specified ruleType" }
);

export const updateNormalizationRuleSchema = z.object({
  ruleConfig: z.object({}).passthrough().optional(),
  priority: z.number().int().min(0).optional(),
  isActive: z.boolean().optional()
}).refine(
  data => data.ruleConfig !== undefined || data.priority !== undefined || data.isActive !== undefined,
  { message: "At least one field must be provided for update" }
);

export const reorderRulesSchema = z.object({
  ruleIds: z.array(z.string().uuid()).min(1)
});

export const previewNormalizationSchema = z.object({
  value: z.string().min(1),
  systemId: z.string().optional()
});
```

**Integration with Credential Generation:**

```javascript
// In apps/api/src/features/credentials/service.js

import { applyNormalizationRules } from '../normalization-rules/service.js';

export async function generateUserCredentials(userId, systemId, templateData) {
  // 1. Get user with LDAP data
  const user = await userRepo.getUserWithLdapData(userId);
  
  // 2. Get system configuration (Story 2.7)
  const systemConfig = await systemConfigRepo.getSystemConfig(systemId);
  
  // 3. Determine username field
  let usernameField = 'mail'; // default fallback
  
  if (systemConfig) {
    usernameField = systemConfig.usernameLdapField;
  }
  
  // 4. Extract username from LDAP data
  const rawUsername = user.ldapData[usernameField];
  if (!rawUsername) {
    throw new MissingLdapFieldError(userId, usernameField);
  }
  
  // 5. Apply normalization rules (THIS STORY)
  const normalizationResult = await applyNormalizationRules(rawUsername, systemId);
  const normalizedUsername = normalizationResult.normalized;
  
  // 6. Generate credential using template with normalized username
  const credential = await generateFromTemplate(normalizedUsername, templateData);
  
  return {
    ...credential,
    metadata: {
      systemId,
      usernameField,
      originalUsername: rawUsername,
      normalizedUsername,
      normalizationRulesApplied: normalizationResult.rulesApplied.map(r => r.ruleType),
      wasNormalized: rawUsername !== normalizedUsername
    }
  };
}
```

### UI/UX Specifications

**NormalizationRuleList Layout:**

```
┌─────────────────────────────────────────────────────────┐
│ Normalization Rules                                  [+] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Global Rules (apply to all systems)                     │
│ ┌───────────────────────────────────────────────────┐   │
│ │ ↑ [1] lowercase                              [Edit][🗑] │   │
│ │     Convert all characters to lowercase             │   │
│ ├───────────────────────────────────────────────────┤   │
│ │ ↓ [2] remove_spaces                          [Edit][🗑] │   │
│ │     Remove all whitespace characters                │   │
│ └───────────────────────────────────────────────────┘   │
│                                                         │
│ Per-System Rules: corporate-vpn                         │
│ ┌───────────────────────────────────────────────────┐   │
│ │ [1] truncate (max: 8)                        [Edit][🗑] │   │
│ │     Limit to 8 characters                           │   │
│ └───────────────────────────────────────────────────┘   │
│                                                         │
│ [Add Rule]                                              │
└─────────────────────────────────────────────────────────┘
```

**NormalizationRuleForm Layout:**

```
┌────────────────────────────────────────────┐
│ Add Normalization Rule                  [X] │
├────────────────────────────────────────────┤
│                                            │
│ Rule Type *                                │
│ ┌────────────────────────────────────────┐ │
│ │ [▼ lowercase                 ]        │ │
│ │  lowercase                               │ │
│ │  remove_spaces                           │ │
│ │  remove_special                          │ │
│ │  truncate                                │ │
│ │  regex                                   │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ Scope                                      │
│ ┌────────────────────────────────────────┐ │
│ │ (•) Global (apply to all systems)     │ │
│ │ ( ) Per-System                          │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ System (if Per-System selected)            │
│ ┌────────────────────────────────────────┐ │
│ │ [▼ corporate-vpn             ]        │ │
│ │  email                                   │ │
│ │  corporate-vpn                           │ │
│ │  wifi-guest                              │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ Rule Configuration                         │
│ (Dynamic based on rule type)               │
│                                            │
│ For "truncate":                            │
│ Maximum Length *                           │
│ ┌────────────────────────────────────────┐ │
│ │ [20                          ]        │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ For "regex":                               │
│ Pattern *                                  │
│ ┌────────────────────────────────────────┐ │
│ │ [@[^\s]+                     ]        │ │
│ └────────────────────────────────────────┘ │
│ Replacement                                │
│ ┌────────────────────────────────────────┐ │
│ │ [                            ]        │ │
│ │ (empty = remove matches)                │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ Priority (optional)                        │
│ ┌────────────────────────────────────────┐ │
│ │ [0                           ]        │ │
│ │ (lower = executes first)                │ │
│ └────────────────────────────────────────┘ │
│                                            │
│        [Cancel]            [Save Rule]     │
└────────────────────────────────────────────┘
```

**NormalizationPreview Layout:**

```
┌──────────────────────────────────────────────────────┐
│ Normalization Preview                                 │
├──────────────────────────────────────────────────────┤
│                                                      │
│ Test Value                                           │
│ ┌──────────────────────────────────────────────────┐ │
│ │ [John.Doe@Company.com                  ]        │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│ System (optional)                                    │
│ ┌──────────────────────────────────────────────────┐ │
│ │ [▼ corporate-vpn                       ]        │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│ [Preview Normalization]                              │
│                                                      │
│ ───────────────────────────────────────────────────  │
│                                                      │
│ Original Value:                                      │
│ John.Doe@Company.com                                 │
│                                                      │
│ Normalization Steps:                                 │
│ ┌──────────────────────────────────────────────────┐ │
│ │ lowercase                                          │ │
│ │ John.Doe@Company.com → john.doe@company.com       │ │
│ ├──────────────────────────────────────────────────┤ │
│ │ remove_special                                     │ │
│ │ john.doe@company.com → johndoecompanycom          │ │
│ ├──────────────────────────────────────────────────┤ │
│ │ truncate (max: 8)                                  │ │
│ │ johndoecompanycom → johndoe                       │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│ Final Result:                                        │
│ ┌──────────────────────────────────────────────────┐ │
│ │ johndoe                                           │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│ ✅ Output is valid                                   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Dependencies on Previous Stories

**This story depends on:**
- **Story 2.1 (Global Credential Template)**: Template structure for credential generation
- **Story 2.2 (Deterministic Credential Generation)**: Credential generation service patterns
- **Story 2.3 (Credential Preview & Confirmation)**: Preview/confirm UI pattern
- **Story 2.4 (Regeneration with Confirmation)**: Service layer patterns, audit logging
- **Story 2.5 (Credential History)**: Audit trail patterns
- **Story 2.6 (Per-User Credential Override)**: RBAC enforcement, RFC 9457 error handling
- **Story 2.7 (Username Field Mapping per System)**: System configuration foundation, per-system scoping
- **Epic 1 Stories**: User management, RBAC, LDAP sync

**This story enables:**
- **Story 2.9 (Credential Lock/Unlock)**: Systems defined here can be locked
- **Story 2.10 (Disabled User Guardrails)**: Normalized credentials for disabled user checks
- **Story 2.11 (IMAP Credentials)**: IMAP system configuration with normalization
- **Stories 3.x (Exports)**: Normalized credentials in exports

### Critical Rules from Project Context

- **Naming**: Database columns in snake_case (`system_id`, `rule_type`), API payloads in camelCase (`systemId`, `ruleType`)
- **Database naming**: snake_case for columns (`rule_config`, `is_active`)
- **API naming**: camelCase in JSON payloads (`ruleConfig`, `isActive`)
- **No hard deletes**: Rules can be deactivated (`isActive: false`) but records remain for audit
- **Audit everything**: All rule CRUD operations must write to audit log
- **IT-only access**: Normalization rule management restricted to IT role via RBAC
- **RFC 9457 errors**: All API errors follow this format
- **Feature structure**: Code stays in `features/normalization-rules/`
- **Rule validation**: Prevent rules that produce empty outputs or invalid regex
- **Order matters**: Rules execute by priority, lower numbers first

### REUSE PATTERNS FROM PREVIOUS STORIES

**From Story 2.7 (Username Field Mapping per System):**
- Per-system configuration pattern
- System config relationship and FK handling
- Service layer organization with clear separation
- Modal-based UI with form validation
- RBAC enforcement at API layer (IT role only)

**From Story 2.6 (Per-User Credential Override):**
- RBAC enforcement pattern (IT role only)
- RFC 9457 error format with custom error classes
- Audit logging pattern for actions
- Service layer organization
- Transaction-based atomic operations

**From Story 2.2 (Deterministic Credential Generation):**
- Credential service structure
- Integration with credential generation flow
- Preview/confirmation flow patterns

**From Epic 1 (User Management):**
- LDAP field availability checking
- User schema introspection

## Previous Story Intelligence

### Story 2.7: Username Field Mapping per System (Status: review)

**Key Patterns Established:**
- Per-system configuration with `system_configs` table
- System-to-credential relationship for usage tracking
- Service layer with CRUD operations and validation
- Modal-based UI for create/edit operations
- RBAC enforcement at API layer (IT role only)
- Audit logging for all configuration changes

**Code to Reuse:**
- `SystemConfig` model and repository patterns
- System configuration UI components (adapt for rules)
- LDAP field validation patterns
- RFC 9457 error response helper
- RBAC middleware pattern from `auth/` feature

**Integration Points:**
- Normalization rules reference `SystemConfig` for per-system scoping
- Credential generation service already fetches system config, now adds normalization

### Story 2.6: Per-User Credential Override (Status: review)

**Key Patterns Established:**
- RBAC enforcement at API layer (IT role only)
- RFC 9457 error format with custom error classes
- Audit logging for all sensitive actions
- Service layer organization with clear separation of concerns
- Modal-based UI with preview/confirmation
- Transaction-based atomic operations

**Code to Reuse:**
- `DisabledUserError` pattern for validation errors
- Audit log creation function from `audit/` feature
- RBAC middleware pattern from `auth/` feature
- RFC 9457 error response helper

### Story 2.4: Regeneration with Confirmation (Status: review)

**Key Patterns Established:**
- Transaction-based database operations
- Service layer error handling
- Audit logging on actions
- Preview/confirmation flow

**Patterns to Apply:**
- Preview endpoint for testing normalization
- Transaction wrapper for rule updates
- Error handling with descriptive messages

## References

### Source Documents

1. **Epics Document**: `_bmad-output/planning-artifacts/epics.md`
   - Epic 2: Credential Lifecycle Management
   - Story 2.8: Normalization Rules (Lines 447-460)
   - FR17: IT staff can apply configurable normalization rules to credential generation

2. **Architecture Document**: `_bmad-output/planning-artifacts/architecture.md`
   - Technology Stack: Fastify API, Prisma ORM, React SPA
   - API Patterns: REST + JSON, RFC 9457 errors, `{ data, meta }` responses
   - Project Structure: Feature-based vertical slices
   - Security: RBAC, audit logging

3. **Project Context**: `_bmad-output/project-context.md`
   - Technology versions and constraints
   - Naming conventions (DB snake_case, API camelCase)
   - Security rules (audit logging, RBAC)
   - Critical "Don't Miss" rules

4. **Previous Story**: `_bmad-output/implementation-artifacts/2-7-username-field-mapping-per-system.md`
   - Per-system configuration patterns
   - System configuration UI components
   - Service layer organization
   - RBAC and audit logging implementation

### Related Implementation Files

- `apps/api/src/features/system-configs/` - Reference for per-system patterns (Story 2.7)
- `apps/api/src/features/credentials/` - Modify for integration
- `apps/api/prisma/schema.prisma` - Add NormalizationRule model
- `apps/web/src/features/system-configs/` - Reference for UI patterns

---

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

**Expected Modified Files:**
- `apps/api/prisma/schema.prisma` - Add NormalizationRule model
- `apps/api/src/features/credentials/service.js` - Integrate normalization in credential generation
- `apps/api/src/features/system-configs/` - May need minor updates for relationship

**Expected New Files:**
- `apps/api/src/features/normalization-rules/routes.js` - CRUD endpoints
- `apps/api/src/features/normalization-rules/service.js` - Business logic
- `apps/api/src/features/normalization-rules/repo.js` - Database operations
- `apps/api/src/features/normalization-rules/schema.js` - Zod schemas
- `apps/api/src/features/normalization-rules/index.js` - Module exports
- `apps/web/src/features/normalization-rules/components/NormalizationRuleList.jsx`
- `apps/web/src/features/normalization-rules/components/NormalizationRuleForm.jsx`
- `apps/web/src/features/normalization-rules/components/NormalizationPreview.jsx`
- `apps/web/src/features/normalization-rules/api/normalizationRules.js`
- `apps/web/src/features/normalization-rules/hooks/useNormalizationRules.js`

**Test Files:**
- `tests/api/normalization-rule.test.mjs` - API integration tests
- `tests/api/normalization-rule-service.test.mjs` - Service unit tests

---

## Change Log

| Date | Changes | Author |
|------|---------|--------|
| 2026-02-02 | Initial story creation - Comprehensive context for Story 2.8 | create-story |

---

**Story ID**: 2.8
**Story Key**: 2-8-normalization-rules
**Epic**: 2 - Credential Lifecycle Management
**Priority**: Medium (depends on Stories 2.1-2.7, enables Stories 2.9-2.11 and 3.x)
**Created**: 2026-02-02
**Status**: ready-for-dev
**FRs**: FR17

**Previous Story**: Story 2.7 - Username Field Mapping per System
**Next Story**: Story 2.9 - Credential Lock/Unlock
