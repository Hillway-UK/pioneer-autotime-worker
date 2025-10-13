-- Add clock_entry_id column to link expenses to specific clock entries
ALTER TABLE additional_costs ADD COLUMN IF NOT EXISTS clock_entry_id UUID REFERENCES clock_entries(id);

-- Update the existing additional_costs table structure to ensure proper functionality
ALTER TABLE additional_costs ALTER COLUMN worker_id DROP NOT NULL;
ALTER TABLE additional_costs ALTER COLUMN date DROP NOT NULL;