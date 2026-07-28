-- CreateTable
CREATE TABLE "directories" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "parentId" UUID,
    "parentScopeId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "directories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "directoryId" UUID,
    "parentScopeId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "titleKey" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "contentBytes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "directories_userId_parentId_idx" ON "directories"("userId", "parentId");

-- CreateIndex
CREATE INDEX "directories_parentId_idx" ON "directories"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "directories_parentScopeId_nameKey_key" ON "directories"("parentScopeId", "nameKey");

-- CreateIndex
CREATE INDEX "documents_userId_directoryId_idx" ON "documents"("userId", "directoryId");

-- CreateIndex
CREATE INDEX "documents_directoryId_idx" ON "documents"("directoryId");

-- CreateIndex
CREATE UNIQUE INDEX "documents_parentScopeId_titleKey_key" ON "documents"("parentScopeId", "titleKey");

-- AddForeignKey
ALTER TABLE "directories" ADD CONSTRAINT "directories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directories" ADD CONSTRAINT "directories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "directories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_directoryId_fkey" FOREIGN KEY ("directoryId") REFERENCES "directories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
