# ماتریس RBAC پنل (از admin_role_permissions مهاجرت 0020 + توسعهٔ v2)
| دامنه | OWNER | SUPER_ADMIN | CONTENT_MANAGER | AUTHOR | SCI-REVIEWER | RIGHTS-REVIEWER | MAP-REVIEWER | PUBLISHER | SUPPORT | OPS | ANALYST | AUDITOR |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Registry write | ✔ | ✔ | ✔ | — | — | — | — | — | — | — | — | — |
| Books/Editions/Nodes (registry:write) | ✔ | ✔ | ✔ | — | — | — | — | — | — | — | — | — |
| Mapping decide (review:mapping:approve) | ✔ | — | — | — | — | — | ✔ | — | — | — | — | — |
| Scientific approve | ✔ | — | — | — | ✔ | — | — | — | — | — | — | — |
| Rights approve | ✔ | — | — | — | — | ✔ | — | — | — | — | — | — |
| Release publish | ✔ | ✔ | — | — | — | — | — | ✔ | — | — | — | — |
| Feedback read/reply (user:read_limited) | ✔ | ✔ | — | — | — | — | — | — | ✔ | — | — | — |
| Audit read | ✔ | ✔ | — | — | — | — | — | — | — | ✔ | ✔ | ✔ |
- Default Deny؛ SoD: author≠reviewer (تست)، mapped_by≠reviewed_by (Trigger+API)، Publisher تنها = بدون امضای علمی/حقوقی.
