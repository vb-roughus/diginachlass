-- CreateTable
CREATE TABLE `compendium_entries` (
    `id` VARCHAR(191) NOT NULL,
    `serviceId` VARCHAR(191) NOT NULL,
    `contactPoint` TEXT NOT NULL,
    `steps` JSON NOT NULL,
    `links` JSON NOT NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `compendium_entries_serviceId_key`(`serviceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `compendium_entries` ADD CONSTRAINT `compendium_entries_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `catalog_services`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
