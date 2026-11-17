CREATE TABLE `foto` (
	`jenis` text NOT NULL,
	`owner_id` text NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`jenis`, `owner_id`)
);
