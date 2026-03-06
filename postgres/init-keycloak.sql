-- Creates the Keycloak database alongside the application database.
-- This script runs automatically on the first start of the postgres container
-- (only when the data directory is empty / a fresh volume).
-- The POSTGRES_USER (set in .env) owns both databases.
CREATE DATABASE keycloak;
