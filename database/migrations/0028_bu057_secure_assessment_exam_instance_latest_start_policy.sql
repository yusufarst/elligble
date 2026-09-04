-- Migration 0028_bu057_secure_assessment_exam_instance_latest_start_policy
-- Target: public.secure_assessment_exam_instances
-- Adds latest_start_policy column to support BU-057

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'secure_assessment_exam_instances' 
          AND column_name = 'latest_start_policy'
    ) THEN
        ALTER TABLE public.secure_assessment_exam_instances
            ADD COLUMN latest_start_policy TEXT NULL;
        
        ALTER TABLE public.secure_assessment_exam_instances
            ADD CONSTRAINT ck_sa_exam_instances_latest_start_policy
            CHECK (
                latest_start_policy IS NULL
                OR latest_start_policy IN (
                    'FULL_DURATION_BEYOND_WINDOW',
                    'REMAINING_WINDOW_ONLY',
                    'LATE_START_BLOCKED'
                )
            );
            
        INSERT INTO public.elligble_migration_history (migration_id) 
        VALUES ('0028_bu057_secure_assessment_exam_instance_latest_start_policy');
    END IF;
END $$;
