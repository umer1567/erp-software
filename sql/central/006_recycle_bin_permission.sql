-- Register Recycle Bin in the central User Rights system.
-- Existing permissions for SUB_ADMIN and USER are not changed.

INSERT INTO public.permissions (
    permission_key,
    permission_name,
    module,
    description
)
VALUES (
    'recycle_bin',
    'Recycle Bin',
    'Administration',
    'View, restore and permanently delete records in the Recycle Bin.'
)
ON CONFLICT (permission_key) DO NOTHING;

-- Grant full access only to the global system ADMIN role.
INSERT INTO public.role_permissions (
    role_id,
    permission_id,
    can_view,
    can_create,
    can_update,
    can_delete
)
SELECT
    r.role_id,
    p.permission_id,
    TRUE,
    TRUE,
    TRUE,
    TRUE
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.company_id IS NULL
  AND r.is_system_role = TRUE
  AND UPPER(r.role_name) = 'ADMIN'
  AND p.permission_key = 'recycle_bin'
ON CONFLICT (role_id, permission_id)
DO UPDATE SET
    can_view = TRUE,
    can_create = TRUE,
    can_update = TRUE,
    can_delete = TRUE,
    updated_at = CURRENT_TIMESTAMP;