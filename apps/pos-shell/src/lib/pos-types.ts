
export type LocalMasterIdentity = {
  ok: true;
  service: "localMaster";
  instance_id: string;
  location_id: string;
  port: number;
  version: string;
  service_version: string;
  api_version: number;
  minimum_client_api_version: number;
  maximum_client_api_version: number;
  clients?: number;
  orders?: number;
};

export type PairingSession = {
  code: string;
  expires_at: number;
  instance_id: string;
  local_master_url: string | null;
  location_id: string;
};

export type TerminalPairingConfig = {
  localMasterUrl: string;
  localMasterInstanceId: string;
  terminalId: string;
  terminalName: string;
  terminalRole: string;
  terminalSecret: string;
  pairedAt: number;
  lastSeenAt: number;
};

export type TerminalRecord = {
  id: string;
  instance_id: string;
  name: string;
  role: string;
  device_fingerprint: string | null;
  paired_at: number;
  last_seen_at: number;
};

export type CloudBinding = {
  status: "UNPAIRED" | "PAIRED" | "PAIRED_BOOTSTRAP_FAILED" | "INVALID";
  tenant_id: string | null;
  location_id: string | null;
  local_master_instance_id: string | null;
  relay_base_url: string | null;
  paired_at: string | null;
  last_verified_at: string | null;
  invalid_reason: string | null;
  bootstrap_completed_at: string | null;
  bootstrap_error: string | null;
  relay_token_present: boolean;
};
export type PosProduct = {
  id: string;
  product_type: "BASIC" | "SERVICE";
  name: string;
  category: string;
  price: number;
  tax_code_id: string;
  tax_code_name: string;
  tax_rate_bps: number;
  is_available: boolean;
  station: string;
};

export type CatalogOutputStation = {
  id: string;
  tenant_id: string;
  name: string;
  kind?: string;
  has_kds: boolean;
  has_printer: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: number;
  updated_at: number;
};

export type LocalDeviceType = "PRINTER" | "KDS_DISPLAY";

export type LocalDeviceProvider = "manual" | "windows" | "escpos" | "browser";

export type LocalDevice = {
  id: string;
  name: string;
  type: LocalDeviceType;
  provider: LocalDeviceProvider;
  address_or_device_id: string | null;
  created_at: number;
  updated_at: number;
};

export type LocalDeviceInput = {
  name: string;
  type: LocalDeviceType;
  provider: LocalDeviceProvider;
  address_or_device_id?: string | null;
};

export type StationDeviceBinding = {
  station_id: string;
  kds_device_id: string | null;
  printer_device_id: string | null;
  updated_at: number;
};

export type StationDeviceBindingUpdateRequest = {
  kds_device_id?: string | null;
  printer_device_id?: string | null;
};

export type PosDeviceBinding = {
  terminal_id: string;
  receipt_printer_device_id: string | null;
  z_report_printer_device_id: string | null;
  updated_at: number;
};

export type PosDeviceBindingUpdateRequest = {
  receipt_printer_device_id?: string | null;
  z_report_printer_device_id?: string | null;
};

export type PrintLogSource = "TEST" | "STATION" | "RECEIPT" | "Z_REPORT";

export type PrintLog = {
  id: string;
  device_id: string;
  device_name: string;
  source: PrintLogSource;
  title: string;
  body: string;
  created_at: number;
};

export type PrintJobStatus = "PENDING" | "PRINTING" | "PRINTED" | "FAILED";

export type PrintJob = {
  id: string;
  source: PrintLogSource;
  device_id: string;
  device_name: string;
  status: PrintJobStatus;
  title: string;
  body: string;
  error: string | null;
  order_id: string | null;
  order_number: string | null;
  station_id: string | null;
  station_name: string | null;
  terminal_id: string | null;
  attempt_count: number;
  last_attempt_at: number | null;
  created_at: number;
  updated_at: number;
};

export type ProductVariantGroupItem = {
  id: string;
  variant_group_id: string;
  name: string;
  price_delta: number;
  is_default: boolean;
  sort_order: number;
};

export type ProductVariantGroup = {
  id: string;
  applies_to: "PRODUCT" | "CATEGORY";
  product_id: string | null;
  category: string | null;
  name: string;
  selection_type: "SINGLE" | "MULTIPLE";
  min_select: number;
  max_select: number;
  sort_order: number;
  is_required: boolean;
  items: ProductVariantGroupItem[];
};

export type ProductCard = PosProduct;

export type BasketLineVariant = {
  variant_group_id: string;
  variant_group_name: string;
  variant_item_id: string;
  variant_item_name: string;
  price_delta: number;
};

export type BasketLine = {
  id: string;
  product_id: string;
  product_type: PosProduct["product_type"];
  product_name: string;
  product_category: string;
  base_price: number;
  tax_code_id: string;
  tax_code_name: string;
  tax_rate_bps: number;
  station: string;
  variants: BasketLineVariant[];
  unit_total: number;
  quantity: number;
  line_total: number;
};

export type CreatedOrderSnapshot = {
  id: string;
  order_number: string;
  status: "OPEN" | string;
  payment_status: "UNPAID" | string;
  subtotal: number;
  tax_total: number;
  total: number;
  created_at: number;
  table_id: string | null;
  table_name: string | null;
  continued_existing_order: boolean;
};

export type CreateOrderSnapshotRequest = {
  request_id: string;
  lines: BasketLine[];
  table_context: TableContext;
};

export type PaymentMethod = "CASH" | "WALLEE_TERMINAL";

export type PaymentLifecycleState =
  | "payment_started"
  | "provider_pending"
  | "provider_authorized"
  | "provider_completed"
  | "local_recorded"
  | "receipt_pending"
  | "receipt_queued"
  | "completed"
  | "declined"
  | "cancelled"
  | "failed"
  | "reversal_required"
  | "reconciliation_required";

export type PaymentRequest = {
  request_id?: string;
  payment_method: PaymentMethod;
  received_cash?: number;
  change_given?: number;
  terminal_id?: string;
};

export type WalleeTerminalPaymentRequest = {
  request_id: string;
  lines: BasketLine[];
  table_context: TableContext | null;
  wallee_terminal_config_id?: string;
  pos_terminal_id?: string;
};

export type PaymentResult = {
  order_id: string;
  order_number: string;
  payment_id: string;
  payment_attempt_id: string | null;
  request_id: string;
  payment_method: PaymentMethod | string;
  amount: number;
  received_cash: number | null;
  change_given: number | null;
  status: "COMPLETED" | string;
  paid_at: number;
  terminal_id: string | null;
  provider: string;
  provider_transaction_id: string | null;
  provider_status: string;
  lifecycle_state: PaymentLifecycleState;
  reconciliation_required: boolean;
  receipt_print_job_id: string | null;
  failure_reason: string | null;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
};

export type PaymentAttemptStatus = {
  payment_attempt_id: string;
  payment_id: string | null;
  order_id: string | null;
  provider_transaction_id: string | null;
  provider_state: string | null;
  lifecycle_state: PaymentLifecycleState;
  reconciliation_required: boolean;
  failure_reason: string | null;
};

export type OrderSnapshotResponse = {
  id: string;
  order_id: string;
  order_number: string;
  snapshot_type: "PAID";
  table_context: TableContext | null;
  lines: BasketLine[];
  subtotal: number;
  tax_total: number;
  total: number;
  payment: {
    payment_id: string;
    request_id: string;
    method: string;
    amount: number;
    terminal_id: string | null;
    provider: string;
    provider_transaction_id: string | null;
    provider_status: string;
    lifecycle_state: string;
    paid_at: number;
  };
  terminal_id: string | null;
  business_date: string;
  created_at: number;
  refunded_total: number;
  remaining_total: number;
};

export type OrderSnapshotListItem = OrderSnapshotResponse & {
  storno_state: "NONE" | "PARTIAL" | "FULL";
};

export type CreateOrderStornoRequest = {
  request_id: string;
  kind: "FULL" | "PARTIAL";
  reason: string;
  terminal_id?: string;
  business_date?: string;
  lines?: Array<{
    line_id: string;
    quantity: number;
  }>;
  provider?: string;
  provider_refund_id?: string;
  provider_status?: string;
};

export type SalesLedgerEntry = {
  id: string;
  request_id: string;
  entry_type: "SALE_COMPLETED" | "PAYMENT_RECORDED" | "ORDER_VOIDED" | "ORDER_PARTIALLY_VOIDED" | "REFUND_RECORDED";
  order_id: string;
  order_number: string;
  payment_id: string | null;
  original_entry_id: string | null;
  line_id: string | null;
  product_id: string | null;
  product_name: string | null;
  product_category: string | null;
  quantity: number;
  gross_amount: number;
  tax_amount: number;
  payment_method: string | null;
  terminal_id: string | null;
  provider: string | null;
  provider_transaction_id: string | null;
  provider_refund_id: string | null;
  provider_status: string | null;
  reason: string | null;
  business_date: string;
  occurred_at: number;
};

export type StornoResult = {
  order_id: string;
  order_number: string;
  kind: "FULL" | "PARTIAL";
  reason: string;
  refunded_amount: number;
  remaining_amount: number;
  provider: string;
  provider_transaction_id: string | null;
  provider_refund_id: string | null;
  provider_status: string;
  ledger_entries: SalesLedgerEntry[];
};

export type OpenTableOrderBasket = {
  order_id: string;
  order_number: string;
  lines: BasketLine[];
};

export type TableContext = {
  tenant_id: string;
  location_id: string;
  floor_id: string;
  area_id: string;
  table_id: string;
  table_name: string;
  area_name: string;
  floor_name: string;
  seats: number;
};

export type TableLayout = {
  tenant: {
    id: string;
    name: string;
  };
  location: {
    id: string;
    tenant_id: string;
    name: string;
  };
  floors: TableLayoutFloor[];
};

export type TableLayoutFloor = {
  id: string;
  location_id: string;
  name: string;
  sort_order: number;
  areas: TableLayoutArea[];
};

export type TableLayoutArea = {
  id: string;
  floor_id: string;
  name: string;
  sort_order: number;
  tables: TableLayoutTable[];
};

export type TableLayoutTable = {
  id: string;
  area_id: string;
  name: string;
  seats: number;
  sort_order: number;
  open_order_id: string | null;
  open_order_number: string | null;
  open_total: number;
  open_order_count: number;
};

export type PosPeripheralSettings = {
  enabled: boolean;
  provider: string;
  device_id: string | null;
};

export type LocationServiceMode = "TABLE_SERVICE" | "COUNTER_SERVICE";

export type PosSettings = {
  schema_version: number;
  tenant_id: string;
  location_id: string;
  service_mode: LocationServiceMode;
  language: string;
  business_day_cutover_time: string;
  receipt_printer: PosPeripheralSettings;
  payment_terminal: PosPeripheralSettings;
};

export type PosSettingsFile = {
  path: string;
  settings: PosSettings;
};

export type DayClosePreview = {
  business_date: string;
  business_day_cutover_time: string;
  window_start_ms: number;
  window_end_ms: number;
  expected_cash: number;
  expected_card: number;
  expected_total: number;
  order_count: number;
  item_count: number;
  product_sales: DayCloseProductSale[];
  existing_close: {
    counted_cash: number;
    cash_difference: number;
    created_at: number;
  } | null;
};

export type DayCloseProductSale = {
  product_id: string;
  product_name: string;
  product_category: string;
  quantity: number;
  total: number;
};

export type SavedDayClose = {
  business_date: string;
  total_cash: number;
  total_card: number;
  counted_cash: number;
  cash_difference: number;
  order_count: number;
  item_count: number;
  created_at: number;
};

export type SaveDayCloseRequest = {
  request_id: string;
  business_date: string;
  business_day_cutover_time: string;
  counted_cash: number;
  terminal_id?: string;
};
