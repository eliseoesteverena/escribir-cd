CREATE TABLE `share_links` (
	`id` text PRIMARY KEY NOT NULL,
	`letter_id` text NOT NULL,
	`token` text NOT NULL,
	`permission` text NOT NULL,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`letter_id`) REFERENCES `letters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `share_links_token_unique` ON `share_links` (`token`);--> statement-breakpoint
CREATE TABLE `templates` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`remitente` text NOT NULL,
	`destinatario` text NOT NULL,
	`cuerpo_html` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
