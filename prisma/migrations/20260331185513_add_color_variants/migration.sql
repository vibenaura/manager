/*
  Warnings:

  - You are about to drop the column `colors` on the `TShirtTemplate` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "TShirtTemplate" DROP COLUMN "colors";

-- CreateTable
CREATE TABLE "TShirtTemplateColorVariant" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "colorName" TEXT NOT NULL,
    "colorHex" TEXT,
    "frontImage" TEXT,
    "backImage" TEXT,
    "sideImage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TShirtTemplateColorVariant_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TShirtTemplateColorVariant" ADD CONSTRAINT "TShirtTemplateColorVariant_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TShirtTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
