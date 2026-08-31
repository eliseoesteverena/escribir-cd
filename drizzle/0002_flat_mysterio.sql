CREATE TABLE `letters` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`courier` text NOT NULL,
	`remitente` text NOT NULL,
	`destinatario` text NOT NULL,
	`cuerpo_html` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
