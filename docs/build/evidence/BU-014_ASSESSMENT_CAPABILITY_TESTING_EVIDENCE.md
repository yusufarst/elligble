# BU-014 INTEGRATED CAPABILITY TESTING EVIDENCE

- valid tenant / participant / Attempt / snapshots created.
- Timer start: 200
- Timer read: 200, remaining: 10
- Answer 1 save: 200, version: undefined, error: undefined
- Answer 2 save: 200, version: undefined, error: undefined
- Resume readback: 200, answers count: 2, timer status: active
- Timer adjustment applied (-15 seconds).
- Timer read after expiry: 200, remaining: 0, status: expired
- Answer 1 exact retry after expiry: 200, version: undefined
- Answer 1 mutate after expiry: 409, error: timer_expired
- Submission: 200, id: undefined
- Submission retry: 200, id matches: true
- Answer mutate after submission: 409
- Answer 2 exact retry after submission: 200, version: undefined
- Resume readback after submission: 200, submitted: true
- Tenant isolation check: 404
- Final authoritative answer row count: 2
