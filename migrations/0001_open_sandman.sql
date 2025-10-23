CREATE TABLE "moulding" (
	"sku" varchar PRIMARY KEY NOT NULL,
	"width" numeric NOT NULL,
	"join_cost" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_config" (
	"key" varchar PRIMARY KEY NOT NULL,
	"value" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supply" (
	"sku" varchar PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"price" numeric NOT NULL
);
