-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('INDIVIDUAL', 'ACCOUNTANT', 'ADMIN');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('STARTER', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('DRAFT', 'FILED', 'AMENDED');

-- CreateEnum
CREATE TYPE "IvaCategory" AS ENUM ('CREDIT', 'COST_EXPENSE', 'NOT_APPLICABLE', 'UNCLASSIFIED', 'NON_DEDUCTIBLE');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'CLASSIFIED', 'EXCLUDED');

-- CreateEnum
CREATE TYPE "SalesTreatment" AS ENUM ('TAXED', 'ZERO_NO_CREDIT', 'ZERO_WITH_CREDIT', 'EXPORT_GOODS', 'EXPORT_SERVICES', 'NON_OBJECT_EXEMPT', 'UNCLASSIFIED');

-- CreateEnum
CREATE TYPE "ClassificationEventType" AS ENUM ('INVOICE_CLASSIFIED', 'INVOICE_RECLASSIFIED', 'SALES_MARKED', 'SALES_REMARKED');

-- CreateEnum
CREATE TYPE "FormStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ColumnKind" AS ENUM ('GROSS', 'NET', 'TAX', 'SINGLE');

-- CreateEnum
CREATE TYPE "MappingMethod" AS ENUM ('ATTRIBUTES', 'AI');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'INDIVIDUAL',
    "plan" "Plan" NOT NULL DEFAULT 'STARTER',
    "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_taxpayers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taxpayerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_taxpayers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taxpayers" (
    "id" TEXT NOT NULL,
    "ruc" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "economicActivities" TEXT[],
    "ivaRegime" TEXT NOT NULL,
    "ivaPeriodicity" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "taxpayers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_periods" (
    "id" TEXT NOT NULL,
    "taxpayerId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'DRAFT',
    "formVersionId" TEXT,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_files" (
    "id" TEXT NOT NULL,
    "taxpayerId" TEXT NOT NULL,
    "taxPeriodId" TEXT,
    "filename" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices_received" (
    "id" TEXT NOT NULL,
    "taxpayerId" TEXT NOT NULL,
    "taxPeriodId" TEXT NOT NULL,
    "accessKey" TEXT NOT NULL,
    "emissionDate" TIMESTAMP(3) NOT NULL,
    "emitterRuc" TEXT NOT NULL,
    "emitterName" TEXT NOT NULL,
    "voucherType" TEXT NOT NULL,
    "voucherSeries" TEXT NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "vat" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "ivaCategory" "IvaCategory" NOT NULL DEFAULT 'UNCLASSIFIED',
    "suggestedCategory" "IvaCategory",
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "excludedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_received_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices_issued" (
    "id" TEXT NOT NULL,
    "taxpayerId" TEXT NOT NULL,
    "taxPeriodId" TEXT NOT NULL,
    "accessKey" TEXT NOT NULL,
    "emissionDate" TIMESTAMP(3) NOT NULL,
    "voucherSeries" TEXT NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "vat" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "salesTreatment" "SalesTreatment" NOT NULL DEFAULT 'UNCLASSIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_issued_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_rules" (
    "id" TEXT NOT NULL,
    "taxpayerId" TEXT NOT NULL,
    "emitterRuc" TEXT NOT NULL,
    "activityFingerprint" TEXT NOT NULL,
    "decision" "IvaCategory" NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classification_events" (
    "id" TEXT NOT NULL,
    "taxpayerId" TEXT NOT NULL,
    "taxPeriodId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invoiceReceivedId" TEXT,
    "invoiceIssuedId" TEXT,
    "eventType" "ClassificationEventType" NOT NULL,
    "previousCategory" "IvaCategory",
    "newCategory" "IvaCategory",
    "previousTreatment" "SalesTreatment",
    "newTreatment" "SalesTreatment",
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "classification_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "period_results" (
    "id" TEXT NOT NULL,
    "taxPeriodId" TEXT NOT NULL,
    "resultKey" TEXT NOT NULL,
    "value" DECIMAL(14,4) NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "period_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_versions" (
    "id" TEXT NOT NULL,
    "formCode" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "status" "FormStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceSha256" TEXT,
    "importedBy" TEXT,
    "importedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_fields" (
    "id" TEXT NOT NULL,
    "formVersionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "section" TEXT,
    "columnKind" "ColumnKind" NOT NULL DEFAULT 'SINGLE',
    "displayOrder" INTEGER NOT NULL,
    "observed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "result_mappings" (
    "id" TEXT NOT NULL,
    "formVersionId" TEXT NOT NULL,
    "resultKey" TEXT NOT NULL,
    "formFieldId" TEXT,
    "method" "MappingMethod" NOT NULL DEFAULT 'ATTRIBUTES',
    "reason" TEXT NOT NULL,
    "confidence" DECIMAL(3,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "result_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_rates" (
    "id" TEXT NOT NULL,
    "rateType" TEXT NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "source" TEXT NOT NULL,
    "sourceDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared_supplier_catalog" (
    "id" TEXT NOT NULL,
    "ruc" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "suggestedCategory" "IvaCategory" NOT NULL,
    "observations" TEXT,
    "frequency" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shared_supplier_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "user_taxpayers_userId_idx" ON "user_taxpayers"("userId");

-- CreateIndex
CREATE INDEX "user_taxpayers_taxpayerId_idx" ON "user_taxpayers"("taxpayerId");

-- CreateIndex
CREATE UNIQUE INDEX "user_taxpayers_userId_taxpayerId_key" ON "user_taxpayers"("userId", "taxpayerId");

-- CreateIndex
CREATE UNIQUE INDEX "taxpayers_ruc_key" ON "taxpayers"("ruc");

-- CreateIndex
CREATE INDEX "taxpayers_ruc_idx" ON "taxpayers"("ruc");

-- CreateIndex
CREATE INDEX "tax_periods_taxpayerId_idx" ON "tax_periods"("taxpayerId");

-- CreateIndex
CREATE INDEX "tax_periods_status_idx" ON "tax_periods"("status");

-- CreateIndex
CREATE UNIQUE INDEX "tax_periods_taxpayerId_year_month_key" ON "tax_periods"("taxpayerId", "year", "month");

-- CreateIndex
CREATE INDEX "source_files_taxpayerId_idx" ON "source_files"("taxpayerId");

-- CreateIndex
CREATE INDEX "source_files_sha256_idx" ON "source_files"("sha256");

-- CreateIndex
CREATE INDEX "invoices_received_taxpayerId_idx" ON "invoices_received"("taxpayerId");

-- CreateIndex
CREATE INDEX "invoices_received_taxPeriodId_idx" ON "invoices_received"("taxPeriodId");

-- CreateIndex
CREATE INDEX "invoices_received_emitterRuc_idx" ON "invoices_received"("emitterRuc");

-- CreateIndex
CREATE INDEX "invoices_received_emissionDate_idx" ON "invoices_received"("emissionDate");

-- CreateIndex
CREATE INDEX "invoices_received_ivaCategory_idx" ON "invoices_received"("ivaCategory");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_received_taxpayerId_accessKey_key" ON "invoices_received"("taxpayerId", "accessKey");

-- CreateIndex
CREATE INDEX "invoices_issued_taxpayerId_idx" ON "invoices_issued"("taxpayerId");

-- CreateIndex
CREATE INDEX "invoices_issued_taxPeriodId_idx" ON "invoices_issued"("taxPeriodId");

-- CreateIndex
CREATE INDEX "invoices_issued_emissionDate_idx" ON "invoices_issued"("emissionDate");

-- CreateIndex
CREATE INDEX "invoices_issued_salesTreatment_idx" ON "invoices_issued"("salesTreatment");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_issued_taxpayerId_accessKey_key" ON "invoices_issued"("taxpayerId", "accessKey");

-- CreateIndex
CREATE INDEX "supplier_rules_taxpayerId_idx" ON "supplier_rules"("taxpayerId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_rules_taxpayerId_emitterRuc_activityFingerprint_key" ON "supplier_rules"("taxpayerId", "emitterRuc", "activityFingerprint");

-- CreateIndex
CREATE INDEX "classification_events_taxPeriodId_idx" ON "classification_events"("taxPeriodId");

-- CreateIndex
CREATE INDEX "classification_events_userId_idx" ON "classification_events"("userId");

-- CreateIndex
CREATE INDEX "classification_events_eventType_idx" ON "classification_events"("eventType");

-- CreateIndex
CREATE INDEX "period_results_taxPeriodId_idx" ON "period_results"("taxPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "period_results_taxPeriodId_resultKey_key" ON "period_results"("taxPeriodId", "resultKey");

-- CreateIndex
CREATE INDEX "form_versions_status_idx" ON "form_versions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "form_versions_formCode_validFrom_key" ON "form_versions"("formCode", "validFrom");

-- CreateIndex
CREATE INDEX "form_fields_formVersionId_idx" ON "form_fields"("formVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "form_fields_formVersionId_code_key" ON "form_fields"("formVersionId", "code");

-- CreateIndex
CREATE INDEX "result_mappings_formVersionId_idx" ON "result_mappings"("formVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "result_mappings_formVersionId_resultKey_key" ON "result_mappings"("formVersionId", "resultKey");

-- CreateIndex
CREATE INDEX "tax_rates_rateType_idx" ON "tax_rates"("rateType");

-- CreateIndex
CREATE INDEX "tax_rates_validFrom_idx" ON "tax_rates"("validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "tax_rates_rateType_validFrom_key" ON "tax_rates"("rateType", "validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "shared_supplier_catalog_ruc_key" ON "shared_supplier_catalog"("ruc");

-- CreateIndex
CREATE INDEX "shared_supplier_catalog_ruc_idx" ON "shared_supplier_catalog"("ruc");

-- AddForeignKey
ALTER TABLE "user_taxpayers" ADD CONSTRAINT "user_taxpayers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_taxpayers" ADD CONSTRAINT "user_taxpayers_taxpayerId_fkey" FOREIGN KEY ("taxpayerId") REFERENCES "taxpayers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_periods" ADD CONSTRAINT "tax_periods_taxpayerId_fkey" FOREIGN KEY ("taxpayerId") REFERENCES "taxpayers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_periods" ADD CONSTRAINT "tax_periods_formVersionId_fkey" FOREIGN KEY ("formVersionId") REFERENCES "form_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_files" ADD CONSTRAINT "source_files_taxpayerId_fkey" FOREIGN KEY ("taxpayerId") REFERENCES "taxpayers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_files" ADD CONSTRAINT "source_files_taxPeriodId_fkey" FOREIGN KEY ("taxPeriodId") REFERENCES "tax_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices_received" ADD CONSTRAINT "invoices_received_taxpayerId_fkey" FOREIGN KEY ("taxpayerId") REFERENCES "taxpayers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices_received" ADD CONSTRAINT "invoices_received_taxPeriodId_fkey" FOREIGN KEY ("taxPeriodId") REFERENCES "tax_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices_issued" ADD CONSTRAINT "invoices_issued_taxpayerId_fkey" FOREIGN KEY ("taxpayerId") REFERENCES "taxpayers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices_issued" ADD CONSTRAINT "invoices_issued_taxPeriodId_fkey" FOREIGN KEY ("taxPeriodId") REFERENCES "tax_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_rules" ADD CONSTRAINT "supplier_rules_taxpayerId_fkey" FOREIGN KEY ("taxpayerId") REFERENCES "taxpayers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classification_events" ADD CONSTRAINT "classification_events_taxPeriodId_fkey" FOREIGN KEY ("taxPeriodId") REFERENCES "tax_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classification_events" ADD CONSTRAINT "classification_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "period_results" ADD CONSTRAINT "period_results_taxPeriodId_fkey" FOREIGN KEY ("taxPeriodId") REFERENCES "tax_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_fields" ADD CONSTRAINT "form_fields_formVersionId_fkey" FOREIGN KEY ("formVersionId") REFERENCES "form_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_mappings" ADD CONSTRAINT "result_mappings_formVersionId_fkey" FOREIGN KEY ("formVersionId") REFERENCES "form_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_mappings" ADD CONSTRAINT "result_mappings_formFieldId_fkey" FOREIGN KEY ("formFieldId") REFERENCES "form_fields"("id") ON DELETE SET NULL ON UPDATE CASCADE;
