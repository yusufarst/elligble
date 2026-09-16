# SECURITY_ENFORCEMENT_REGISTRY

## Endpoint Context Isolation
### GET /api/v1/assessment/teacher-readiness
- **Isolation Level:** Strict Tenant Isolation.
- **Identity:** Evaluated via injected identity context (trusted).
- **Enforcement:** Validates `tenant_memberships` and `tenant_teacher_assignments` to verify caller is a teacher in the requested tenant. Returns 403 Forbidden for any missing, invalid, or unauthorized context. No cross-tenant data leakage is possible.
