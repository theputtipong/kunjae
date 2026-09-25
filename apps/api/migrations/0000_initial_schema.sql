CREATE TABLE `accounts` (
	`account_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`account_salt` text NOT NULL,
	`argon2_memory_kib` integer NOT NULL,
	`argon2_iterations` integer NOT NULL,
	`argon2_parallelism` integer NOT NULL,
	`argon2_hash_length` integer NOT NULL,
	`auth_key_hash` text NOT NULL,
	`token_epoch` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "accounts_argon2_positive" CHECK("accounts"."argon2_memory_kib" > 0 AND "accounts"."argon2_iterations" > 0
          AND "accounts"."argon2_parallelism" > 0 AND "accounts"."argon2_hash_length" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_email_unique` ON `accounts` (`email`);--> statement-breakpoint
CREATE TABLE `items` (
	`item_id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`vault_id` text NOT NULL,
	`version` integer NOT NULL,
	`deleted` integer DEFAULT false NOT NULL,
	`envelope` text,
	`revision` integer NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`vault_id`) REFERENCES `vaults`(`vault_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "items_tombstone_has_no_content" CHECK(("items"."deleted" = 0 AND "items"."envelope" IS NOT NULL)
          OR ("items"."deleted" = 1 AND "items"."envelope" IS NULL)),
	CONSTRAINT "items_version_positive" CHECK("items"."version" > 0)
);
--> statement-breakpoint
CREATE INDEX `items_account_revision_idx` ON `items` (`account_id`,`revision`);--> statement-breakpoint
CREATE INDEX `items_vault_idx` ON `items` (`vault_id`);--> statement-breakpoint
CREATE TABLE `vaults` (
	`vault_id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`wrapped_vault_key` text NOT NULL,
	`metadata` text NOT NULL,
	`revision` integer NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`account_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `vaults_account_revision_idx` ON `vaults` (`account_id`,`revision`);
