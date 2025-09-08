-- Add request_body field to manual_verification_log table
ALTER TABLE "t3gallery_manual_verification_log" ADD COLUMN "request_body" json;

-- Add request_body field to appointment_reminder_log table  
ALTER TABLE "t3gallery_appointment_reminder_log" ADD COLUMN "request_body" json;
