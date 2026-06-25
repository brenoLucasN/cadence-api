ALTER TABLE "workouts" ADD COLUMN "days" text DEFAULT '0000000' NOT NULL;--> statement-breakpoint
ALTER TABLE "workouts" ADD COLUMN "scheduled_time" text;
