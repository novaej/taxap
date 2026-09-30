-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('INDIVIDUAL', 'ACCOUNTANT', 'ADMIN');

-- CreateEnum
CREATE TYPE "TaxpayerAccess" AS ENUM ('OWNER', 'COLLABORATOR');

-- CreateEnum
CREATE TYPE "TaxRegime" AS ENUM ('RIMPE_POPULAR', 'RIMPE_EMPRENDEDOR', 'GENERAL');

-- CreateEnum
CREATE TYPE "Periodicity" AS ENUM ('MONTHLY', 'SEMIANNUAL', 'ANNUAL');

-- CreateEnum
CREATE TYPE "TaxType" AS ENUM ('IVA', 'INCOME_TAX', 'WITHHOLDING');

-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'FILED');

-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('PURCHASES_TXT', 'SALES_TXT');

-- CreateEnum
CREATE TYPE "IvaCategory" AS ENUM ('CREDIT', 'COST_EXPENSE', 'NON_DEDUCTIBLE', 'NOT_APPLICABLE', 'UNCLASSIFIED');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('UNCLASSIFIED', 'PROCESSED', 'REQUIRES_MANUAL_REVIEW', 'EXCLUDED');

-- CreateEnum
CREATE TYPE "ClassificationSourceType" AS ENUM ('RULE', 'CATALOG', 'AI', 'USER', 'DETERMINISTIC');

-- CreateEnum
CREATE TYPE "SalesTreatment" AS ENUM ('TAXED', 'ZERO_NO_CREDIT', 'ZERO_WITH_CREDIT', 'EXPORT_GOODS', 'EXPORT_SERVICES', 'NON_OBJECT_EXEMPT', 'UNCLASSIFIED');

-- CreateEnum
CREATE TYPE "RuleSource" AS ENUM ('USER', 'CATALOG', 'AI');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'ENGINE');

-- CreateEnum
CREATE TYPE "TaxRateType" AS ENUM ('IVA');

-- CreateEnum
CREATE TYPE "FormStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ColumnKind" AS ENUM ('GROSS', 'NET', 'TAX', 'SINGLE');

-- CreateEnum
CREATE TYPE "MappingMethod" AS ENUM ('ATTRIBUTES', 'AI');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'INDIVIDUAL',
    "plan_code" TEXT NOT NULL DEFAULT 'STARTER',
    "ai_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "code" TEXT NOT NULL,
    "max_taxpayers" INTEGER NOT NULL,
    "max_users" INTEGER NOT NULL DEFAULT 1,
    "ai_included" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "user_taxpayers" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "taxpayer_id" UUID NOT NULL,
    "access" "TaxpayerAccess" NOT NULL DEFAULT 'OWNER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_taxpayers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taxpayers" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "ruc" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "trade_name" TEXT,
    "regime" "TaxRegime" NOT NULL DEFAULT 'GENERAL',
    "iva_periodicity" "Periodicity" NOT NULL DEFAULT 'MONTHLY',
    "economic_activities" JSONB NOT NULL DEFAULT '[]',
    "activity_fingerprint" TEXT NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "taxpayers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_periods" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "taxpayer_id" UUID NOT NULL,
    "tax_type" "TaxType" NOT NULL DEFAULT 'IVA',
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "periodicity" "Periodicity" NOT NULL DEFAULT 'MONTHLY',
    "status" "PeriodStatus" NOT NULL DEFAULT 'DRAFT',
    "form_version_id" UUID,
    "proportionality_factor" DECIMAL(5,4),
    "factor_inputs" JSONB,
    "filed_at" TIMESTAMP(3),
    "locked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_files" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "taxpayer_id" UUID NOT NULL,
    "tax_period_id" UUID,
    "kind" "SourceKind" NOT NULL,
    "filename" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "rows_imported" INTEGER NOT NULL DEFAULT 0,
    "rows_rejected" INTEGER NOT NULL DEFAULT 0,
    "uploaded_by" UUID NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices_received" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "taxpayer_id" UUID NOT NULL,
    "tax_period_id" UUID NOT NULL,
    "source_file_id" UUID,
    "access_key" CHAR(49) NOT NULL,
    "supplier_ruc" TEXT NOT NULL,
    "supplier_name" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "issue_date" DATE NOT NULL,
    "authorization_date" TIMESTAMP(3),
    "subtotal" DECIMAL(14,2) NOT NULL,
    "vat_amount" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "modified_document" TEXT,
    "iva_category" "IvaCategory" NOT NULL DEFAULT 'UNCLASSIFIED',
    "processing_status" "ProcessingStatus" NOT NULL DEFAULT 'REQUIRES_MANUAL_REVIEW',
    "classification_source" "ClassificationSourceType",
    "applied_rule_id" UUID,
    "ai_confidence" DECIMAL(3,2),
    "ai_reasoning" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_received_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices_issued" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "taxpayer_id" UUID NOT NULL,
    "tax_period_id" UUID NOT NULL,
    "source_file_id" UUID,
    "access_key" CHAR(49) NOT NULL,
    "document_type" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "issue_date" TIMESTAMP(3) NOT NULL,
    "authorization_date" TIMESTAMP(3),
    "subtotal" DECIMAL(14,2) NOT NULL,
    "vat_amount" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "sales_treatment" "SalesTreatment" NOT NULL DEFAULT 'UNCLASSIFIED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_issued_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_rules" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "taxpayer_id" UUID NOT NULL,
    "supplier_ruc" TEXT NOT NULL,
    "activity_fingerprint" TEXT NOT NULL,
    "iva_category" "IvaCategory" NOT NULL,
    "source" "RuleSource" NOT NULL,
    "created_by" UUID,
    "times_applied" INTEGER NOT NULL DEFAULT 0,
    "revoked_at" TIMESTAMP(3),
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared_supplier_catalog" (
    "supplier_ruc" TEXT NOT NULL,
    "supplier_name" TEXT NOT NULL,
    "suggested_iva_category" "IvaCategory" NOT NULL,
    "agreement_ratio" DECIMAL(3,2) NOT NULL,
    "sample_count" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shared_supplier_catalog_pkey" PRIMARY KEY ("supplier_ruc")
);

-- CreateTable
CREATE TABLE "classification_events" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "received_invoice_id" UUID,
    "issued_invoice_id" UUID,
    "taxpayer_id" UUID NOT NULL,
    "tax_period_id" UUID NOT NULL,
    "field" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "actor_type" "ActorType" NOT NULL,
    "actor_user_id" UUID,
    "source" "ClassificationSourceType",
    "rules_version" TEXT,
    "model_id" TEXT,
    "prompt_version" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "classification_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_rates" (
    "tax" "TaxRateType" NOT NULL,
    "rate" DECIMAL(5,4) NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,

    CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("tax","valid_from")
);

-- CreateTable
CREATE TABLE "form_versions" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "form_code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,
    "status" "FormStatus" NOT NULL DEFAULT 'DRAFT',
    "source_sha256" TEXT,
    "imported_by" UUID,
    "imported_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),

    CONSTRAINT "form_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_fields" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "form_version_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "section" TEXT,
    "column_kind" "ColumnKind" NOT NULL DEFAULT 'SINGLE',
    "display_order" INTEGER NOT NULL,
    "observed" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "form_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "result_mappings" (
    "form_version_id" UUID NOT NULL,
    "result_key" TEXT NOT NULL,
    "form_field_id" UUID,
    "method" "MappingMethod" NOT NULL DEFAULT 'ATTRIBUTES',
    "reason" TEXT NOT NULL,
    "confidence" DECIMAL(3,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "result_mappings_pkey" PRIMARY KEY ("form_version_id","result_key")
);

-- CreateTable
CREATE TABLE "period_results" (
    "tax_period_id" UUID NOT NULL,
    "result_key" TEXT NOT NULL,
    "value" DECIMAL(14,4) NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "period_results_pkey" PRIMARY KEY ("tax_period_id","result_key")
);

-- CreateTable
CREATE TABLE "ai_usage" (
    "user_id" UUID NOT NULL,
    "taxpayer_id" UUID NOT NULL,
    "period" DATE NOT NULL,
    "calls" INTEGER NOT NULL DEFAULT 0,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("user_id","taxpayer_id","period")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "user_taxpayers_user_id_idx" ON "user_taxpayers"("user_id");

-- CreateIndex
CREATE INDEX "user_taxpayers_taxpayer_id_idx" ON "user_taxpayers"("taxpayer_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_taxpayers_user_id_taxpayer_id_key" ON "user_taxpayers"("user_id", "taxpayer_id");

-- CreateIndex
CREATE UNIQUE INDEX "taxpayers_ruc_key" ON "taxpayers"("ruc");

-- CreateIndex
CREATE INDEX "taxpayers_ruc_idx" ON "taxpayers"("ruc");

-- CreateIndex
CREATE INDEX "tax_periods_taxpayer_id_idx" ON "tax_periods"("taxpayer_id");

-- CreateIndex
CREATE INDEX "tax_periods_status_idx" ON "tax_periods"("status");

-- CreateIndex
CREATE UNIQUE INDEX "tax_periods_taxpayer_id_tax_type_period_start_key" ON "tax_periods"("taxpayer_id", "tax_type", "period_start");

-- CreateIndex
CREATE INDEX "source_files_taxpayer_id_idx" ON "source_files"("taxpayer_id");

-- CreateIndex
CREATE INDEX "source_files_sha256_idx" ON "source_files"("sha256");

-- CreateIndex
CREATE INDEX "invoices_received_taxpayer_id_tax_period_id_processing_stat_idx" ON "invoices_received"("taxpayer_id", "tax_period_id", "processing_status");

-- CreateIndex
CREATE INDEX "invoices_received_taxpayer_id_supplier_ruc_idx" ON "invoices_received"("taxpayer_id", "supplier_ruc");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_received_taxpayer_id_access_key_key" ON "invoices_received"("taxpayer_id", "access_key");

-- CreateIndex
CREATE INDEX "invoices_issued_taxpayer_id_idx" ON "invoices_issued"("taxpayer_id");

-- CreateIndex
CREATE INDEX "invoices_issued_tax_period_id_idx" ON "invoices_issued"("tax_period_id");

-- CreateIndex
CREATE INDEX "invoices_issued_issue_date_idx" ON "invoices_issued"("issue_date");

-- CreateIndex
CREATE INDEX "invoices_issued_sales_treatment_idx" ON "invoices_issued"("sales_treatment");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_issued_taxpayer_id_access_key_key" ON "invoices_issued"("taxpayer_id", "access_key");

-- CreateIndex
CREATE INDEX "supplier_rules_taxpayer_id_idx" ON "supplier_rules"("taxpayer_id");

-- CreateIndex
CREATE INDEX "classification_events_tax_period_id_idx" ON "classification_events"("tax_period_id");

-- CreateIndex
CREATE INDEX "classification_events_actor_user_id_idx" ON "classification_events"("actor_user_id");

-- CreateIndex
CREATE INDEX "form_versions_status_idx" ON "form_versions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "form_versions_form_code_valid_from_key" ON "form_versions"("form_code", "valid_from");

-- CreateIndex
CREATE INDEX "form_fields_form_version_id_idx" ON "form_fields"("form_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "form_fields_form_version_id_code_key" ON "form_fields"("form_version_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "result_mappings_form_version_id_form_field_id_key" ON "result_mappings"("form_version_id", "form_field_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_plan_code_fkey" FOREIGN KEY ("plan_code") REFERENCES "plans"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_taxpayers" ADD CONSTRAINT "user_taxpayers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_taxpayers" ADD CONSTRAINT "user_taxpayers_taxpayer_id_fkey" FOREIGN KEY ("taxpayer_id") REFERENCES "taxpayers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taxpayers" ADD CONSTRAINT "taxpayers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_periods" ADD CONSTRAINT "tax_periods_taxpayer_id_fkey" FOREIGN KEY ("taxpayer_id") REFERENCES "taxpayers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_periods" ADD CONSTRAINT "tax_periods_form_version_id_fkey" FOREIGN KEY ("form_version_id") REFERENCES "form_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_files" ADD CONSTRAINT "source_files_taxpayer_id_fkey" FOREIGN KEY ("taxpayer_id") REFERENCES "taxpayers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_files" ADD CONSTRAINT "source_files_tax_period_id_fkey" FOREIGN KEY ("tax_period_id") REFERENCES "tax_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_files" ADD CONSTRAINT "source_files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices_received" ADD CONSTRAINT "invoices_received_taxpayer_id_fkey" FOREIGN KEY ("taxpayer_id") REFERENCES "taxpayers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices_received" ADD CONSTRAINT "invoices_received_tax_period_id_fkey" FOREIGN KEY ("tax_period_id") REFERENCES "tax_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices_issued" ADD CONSTRAINT "invoices_issued_taxpayer_id_fkey" FOREIGN KEY ("taxpayer_id") REFERENCES "taxpayers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices_issued" ADD CONSTRAINT "invoices_issued_tax_period_id_fkey" FOREIGN KEY ("tax_period_id") REFERENCES "tax_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_rules" ADD CONSTRAINT "supplier_rules_taxpayer_id_fkey" FOREIGN KEY ("taxpayer_id") REFERENCES "taxpayers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classification_events" ADD CONSTRAINT "classification_events_tax_period_id_fkey" FOREIGN KEY ("tax_period_id") REFERENCES "tax_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classification_events" ADD CONSTRAINT "classification_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_versions" ADD CONSTRAINT "form_versions_imported_by_fkey" FOREIGN KEY ("imported_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_fields" ADD CONSTRAINT "form_fields_form_version_id_fkey" FOREIGN KEY ("form_version_id") REFERENCES "form_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_mappings" ADD CONSTRAINT "result_mappings_form_version_id_fkey" FOREIGN KEY ("form_version_id") REFERENCES "form_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_mappings" ADD CONSTRAINT "result_mappings_form_field_id_fkey" FOREIGN KEY ("form_field_id") REFERENCES "form_fields"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "period_results" ADD CONSTRAINT "period_results_tax_period_id_fkey" FOREIGN KEY ("tax_period_id") REFERENCES "tax_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_taxpayer_id_fkey" FOREIGN KEY ("taxpayer_id") REFERENCES "taxpayers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
