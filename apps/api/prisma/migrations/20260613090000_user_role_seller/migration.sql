-- Agrega el rol de vendedor al enum UserRole.
-- (En su propia migración para que el valor quede confirmado antes de usarse.)
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SELLER';
