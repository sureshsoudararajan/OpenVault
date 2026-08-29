-- CreateTable
CREATE TABLE "ytdlp_cookies" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "domain" VARCHAR(255),
    "storage_key" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ytdlp_cookies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ytdlp_cookies_user_id_idx" ON "ytdlp_cookies"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ytdlp_cookies_user_id_name_key" ON "ytdlp_cookies"("user_id", "name");

-- AddForeignKey
ALTER TABLE "ytdlp_cookies" ADD CONSTRAINT "ytdlp_cookies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
