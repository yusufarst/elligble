# API_CONTRACT_REGISTRY

## GET /api/v1/assessment/teacher-readiness
**Payload Type:** TeacherReadinessResponse
**Description:** Provides readiness state projections (baseline and room/proctor) for all exams scheduled for a teacher. Filters out all participant PII and internal sensitive data.
```json
{
  "exams": [
    {
      "examInstanceId": "uuid",
      "subjectLabel": "string",
      "baseline": {
        "type": "baseline_readiness_checks_pass | not_ready | invalid_state | denied | unavailable",
        "category": "string",
        "blocker": "string"
      },
      "roomProctor": {
        "type": "room_proctor_readiness_not_applicable | room_proctor_readiness_ready | not_ready | invalid_state | denied | unavailable",
        "roomBasedOperationsEnabled": "boolean",
        "proctorPerRoomRequired": "boolean",
        "blocker": "string"
      }
    }
  ]
}
```
