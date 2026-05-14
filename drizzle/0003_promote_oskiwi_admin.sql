-- Data migration: promote oskiwi@gmail.com to admin and reset password to
-- "12345678". Idempotent — if the user doesn't exist yet (fresh DB), this is
-- a no-op and the seed will happen later via signup or admin-create.
--
-- The bcrypt hash below was generated with bcryptjs cost 10 for plaintext
-- "12345678". This is a DEVELOPMENT seed: the password is intentionally weak
-- and known. Change it on first login in any non-throwaway environment.

UPDATE "users"
SET
  "role" = 'admin',
  "password_hash" = '$2a$10$Ca7CNiNmaLKyu2clVoK9AOYxfbRjXrezM6moAZs.uX4Dt4myVWs32',
  "updated_at" = now()
WHERE "email_normalized" = 'oskiwi@gmail.com';
