# Security Specification (`security_spec.md`)

## 1. Data Invariants
1. Every document in `minutes`, `minute_locks`, `employee_directory`, and subcollections (`participants`, `outcomes`, `ongoing_topics`, `new_topics`) must belong to an authenticated, email-verified user (`ownerId == request.auth.uid`) or the bootstrapped administrator (`mr.aljefre@gmail.com`).
2. `minute_locks/{lockId}` guarantees uniqueness of `(year, minuteNumber)` per user/organization. A lock cannot be created without a valid `minuteId` and matching `ownerId`.
3. Subcollections under `/minutes/{minuteId}` (`participants`, `outcomes`, `ongoing_topics`, `new_topics`) must verify relational sync with the parent `/minutes/{minuteId}` document (`get(/databases/$(database)/documents/minutes/$(minuteId)).data.ownerId == request.auth.uid` or `isAdmin()`).
4. Immutable fields (`ownerId`, `createdAt`) cannot be altered during `update` operations.
5. Temporal fields (`createdAt`, `updatedAt`) must strictly equal `request.time`.
6. All string fields must enforce explicit `.size() <= maxLength` constraints matching `firebase-blueprint.json`.

## 2. The "Dirty Dozen" Payloads
1. **Identity Spoofing on Minute Create**: `ownerId: "attacker_uid"` when `request.auth.uid == "victim_uid"`.
2. **Unverified Email Spoof**: Authenticated request where `email == "mr.aljefre@gmail.com"` but `email_verified == false`.
3. **Shadow Field Injection on Create**: Adding `isSuperAdmin: true` to `/minutes/{minuteId}`.
4. **Shadow Field Injection on Update**: Modifying `role: "admin"` during an update to `/minutes/{minuteId}`.
5. **Value Poisoning on String Size**: Sending a 500,000-character string in `location` (exceeds maxLength 300).
6. **ID Poisoning Attack**: Creating a document with a 200-character ID containing special characters (`$#%`).
7. **Timestamp Forgery on Create**: Setting `createdAt` to a past timestamp instead of `request.time`.
8. **Immortal Field Mutation**: Attempting to change `ownerId` or `createdAt` during an `update` on `/minutes/{minuteId}`.
9. **Orphaned Subcollection Write**: Writing to `/minutes/{minuteId}/participants/{participantId}` when the parent `/minutes/{minuteId}` belongs to another user.
10. **Invalid Enum State**: Setting `status: "hacked"` on `/minutes/{minuteId}` (outside `['draft', 'saved', 'archived']`).
11. **Unauthorized List Scraping**: Calling `list` on `/minutes` without filtering by `resource.data.ownerId == request.auth.uid`.
12. **Update-Gap Bypass**: Updating a whitelisted key (`location`) with an integer `12345` instead of a valid bounded string.
