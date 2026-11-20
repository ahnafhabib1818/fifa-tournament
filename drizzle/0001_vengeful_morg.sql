CREATE TABLE `tournaments` (
	`id` varchar(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`format` varchar(32) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'active',
	`state` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tournaments_id` PRIMARY KEY(`id`)
);
