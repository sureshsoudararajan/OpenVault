-- AlterTable
ALTER TABLE "files" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "thumbnail_key" VARCHAR(500);

-- AlterTable
ALTER TABLE "folders" ADD COLUMN     "color" VARCHAR(7),
ADD COLUMN     "is_trashed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trashed_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "share_links" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "opens_at" TIMESTAMP(3),
ADD COLUMN     "otp_code" VARCHAR(6),
ADD COLUMN     "otp_enabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "activation_expires" TIMESTAMP(3),
ADD COLUMN     "activation_token" VARCHAR(255),
ADD COLUMN     "email_code" VARCHAR(10),
ADD COLUMN     "email_code_expires" TIMESTAMP(3),
ADD COLUMN     "is_activated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reset_password_expires" TIMESTAMP(3),
ADD COLUMN     "reset_password_token" VARCHAR(255),
ADD COLUMN     "secondary_email" VARCHAR(255);

-- CreateTable
CREATE TABLE "recovery_codes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code_hash" VARCHAR(255) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used_at" TIMESTAMP(3),

    CONSTRAINT "recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "color" VARCHAR(7) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_tags" (
    "id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "file_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_access_logs" (
    "id" UUID NOT NULL,
    "share_link_id" UUID NOT NULL,
    "action" VARCHAR(30) NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recovery_codes_user_id_idx" ON "recovery_codes"("user_id");

-- CreateIndex
CREATE INDEX "tags_user_id_idx" ON "tags"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "tags_user_id_name_key" ON "tags"("user_id", "name");

-- CreateIndex
CREATE INDEX "file_tags_file_id_idx" ON "file_tags"("file_id");

-- CreateIndex
CREATE INDEX "file_tags_tag_id_idx" ON "file_tags"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "file_tags_file_id_tag_id_key" ON "file_tags"("file_id", "tag_id");

-- CreateIndex
CREATE INDEX "share_access_logs_share_link_id_idx" ON "share_access_logs"("share_link_id");

-- CreateIndex
CREATE INDEX "share_access_logs_created_at_idx" ON "share_access_logs"("created_at");

-- AddForeignKey
ALTER TABLE "recovery_codes" ADD CONSTRAINT "recovery_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_tags" ADD CONSTRAINT "file_tags_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_tags" ADD CONSTRAINT "file_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_access_logs" ADD CONSTRAINT "share_access_logs_share_link_id_fkey" FOREIGN KEY ("share_link_id") REFERENCES "share_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;
