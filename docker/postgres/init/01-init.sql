-- StokCerdas Database Initialization Script
-- This script sets up the basic database structure for development

-- Create additional databases for testing
CREATE DATABASE stokcerdas_test;
CREATE DATABASE stokcerdas_staging;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Connect to main database
\c stokcerdas_dev;

-- Create extensions in main database
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create basic schemas
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS logs;

-- Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE stokcerdas_dev TO stokcerdas;
GRANT ALL PRIVILEGES ON DATABASE stokcerdas_test TO stokcerdas;
GRANT ALL PRIVILEGES ON DATABASE stokcerdas_staging TO stokcerdas;

-- Create basic audit table for tracking changes
CREATE TABLE IF NOT EXISTS audit.activity_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tenant_id UUID NOT NULL,
    user_id UUID,
    action VARCHAR(50) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_activity_log_tenant_id ON audit.activity_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON audit.activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_log_table_name ON audit.activity_log(table_name);

-- Create system logs table
CREATE TABLE IF NOT EXISTS logs.system_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    level VARCHAR(10) NOT NULL,
    message TEXT NOT NULL,
    meta JSONB,
    service VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for logs
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON logs.system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON logs.system_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_system_logs_service ON logs.system_logs(service);

-- Success message
SELECT 'StokCerdas database initialized successfully!' as message;