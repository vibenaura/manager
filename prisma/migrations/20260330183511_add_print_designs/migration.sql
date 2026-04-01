-- CreateTable
CREATE TABLE "DesignCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintDesign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "categoryId" TEXT,
    "tags" TEXT DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ENABLED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrintDesign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DesignCategory_name_key" ON "DesignCategory"("name");

-- AddForeignKey
ALTER TABLE "PrintDesign" ADD CONSTRAINT "PrintDesign_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "DesignCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
